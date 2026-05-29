// generator.js — generatiepipeline (modi A, B, C) — v0.002

import { claudeComplete, geminiGenerateImage } from './api.js';
import * as storage from './storage.js';
import { STYLE_DEFS } from './style_defs.js';
import bordewijkStory from './stories/bordewijk_verplaatsing.js';
import { STRIP_STYLES } from './strip_styles.js';

export const VERSION = 'v0.036';

// ─── Hulpfuncties ────────────────────────────────────────────────────────────

function buildFullStoryText(story) {
  let out = '';
  let lastCh = null;
  for (const p of story.paragraphs) {
    if (p.chapter !== lastCh) {
      const ch = story.chapters.find(c => c.id === p.chapter);
      if (ch) out += `\n\n[${ch.title}]\n\n`;
      lastCh = p.chapter;
    }
    out += `§${p.id}: ${p.text}\n\n`;
  }
  return out.trim();
}

function getParaText(ids, story) {
  return ids
    .map(id => story.paragraphs.find(p => p.id === id)?.text || '')
    .filter(Boolean)
    .join(' ');
}

function splitSentences(text) {
  const parts = [];
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    if ('.!?'.includes(text[i])) {
      const rest = text.slice(i + 1);
      if (rest === '' || /^\s+[A-ZÀ-Ö]/.test(rest)) {
        parts.push(text.slice(last, i + 1).trim());
        last = i + 1;
        while (last < text.length && text[last] === ' ') last++;
      }
    }
  }
  if (last < text.length) parts.push(text.slice(last).trim());
  return parts.filter(s => s.length > 0);
}

// Berekent de tekst voor een segment-object uit _computeSegments()
function getSegmentText(seg, story) {
  const full = getParaText(seg.paras, story);
  if (!seg.textSlice || seg.splitAt === undefined) return full;
  const sentences = splitSentences(full);
  if (seg.textSlice === 'first')  return sentences.slice(0, seg.splitAt + 1).join(' ');
  if (seg.textSlice === 'second') return sentences.slice(seg.splitAt + 1).join(' ');
  return full;
}

function shortTitle(text) {
  return text.split(/\s+/).slice(0, 5).join(' ');
}

function _scenesLabel(mode, sceneSource, n) {
  if (mode === 'A') {
    if (sceneSource === 'marks')  return 'Scène bepalen uit §-selectie (Claude)…';
    if (sceneSource === 'random') return 'Willekeurige scène kiezen…';
    return 'Claude kiest de beste scène…';
  }
  if (mode === 'B') {
    if (sceneSource === 'marks')  return 'Scènes bepalen uit §-selectie (Claude)…';
    if (sceneSource === 'random') return 'Willekeurige scènes kiezen…';
    return 'Claude kiest 3–5 scènes…';
  }
  if (sceneSource === 'highlight') return `Claude bepaalt hoogtepunt (stap 1 van 2)…`;
  if (sceneSource === 'marks')     return `${n} panels plannen uit §-selectie (Claude)…`;
  return `${n} panels verdelen over het verhaal (Claude)…`;
}

// Robuuste JSON-array-extractie: bracket-teller voorkomt dat greedy regex
// voorbij de sluitende ] schiet als Claude tekst toevoegt na het array-blok.
// Fallback: saniteer letterlijke newlines in string-waarden.
function safeParseJsonArray(raw) {
  // Zoek het eerste [ dat een JSON array van objecten opent — sla preamble-tekst met [ over
  const startMatch = raw.match(/\[\s*\{/);
  if (!startMatch) return [];
  const start = startMatch.index;

  // Zoek de bijbehorende sluitende ] via bracket-teller
  let depth = 0, inString = false, escaped = false, end = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escaped)    { escaped = false; continue; }
    if (inString)   { if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"')  { inString = true; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { if (--depth === 0) { end = i; break; } }
  }

  const jsonStr = end !== -1 ? raw.slice(start, end + 1) : raw.slice(start);

  try { return JSON.parse(jsonStr); } catch (e1) {
    // Saniteer letterlijke newlines en tabs die binnen string-waarden terechtkwamen
    const sanitized = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/gs,
      (_, s) => '"' + s.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ') + '"'
    );
    try { return JSON.parse(sanitized); } catch (e2) {
      console.error('[NV] safeParseJsonArray mislukt. Eerste fout:', e1.message);
      console.error('[NV] Ruwe Claude-respons (eerste 2000 tekens):', raw.slice(0, 2000));
      return [];
    }
  }
}

// STYLE_DEFS en STRIP_STYLES worden geïmporteerd uit hun eigen bestanden (zie imports bovenaan).

function buildStyleDirective(style) {
  const { w1, w2, w3, realism } = style;

  // Style mix
  const rows = [
    { key: 'goudeneeuw', w: w1, def: STYLE_DEFS.goudeneeuw },
    { key: 'jugend',     w: w2, def: STYLE_DEFS.jugend     },
    { key: 'magischrealisme', w: w3, def: STYLE_DEFS.magischrealisme },
  ].sort((a, b) => b.w - a.w);

  const dom = rows[0];
  const sec = rows.filter(r => r.w >= 0.15 && r !== dom);

  let artStyle;
  if (dom.w >= 0.85) {
    artStyle = `ART STYLE: ${dom.def.full}`;
  } else if (sec.length === 0) {
    artStyle = `ART STYLE (primarily ${dom.def.label}): ${dom.def.full}`;
  } else {
    artStyle = `ART STYLE (hybrid — ${dom.def.label} ${Math.round(dom.w*100)}% + ${sec.map(r=>`${r.def.label} ${Math.round(r.w*100)}%`).join(' + ')}):
Primary: ${dom.def.full}
Secondary elements: ${sec.map(r => r.def.accent).join('; ')}.`;
  }

  // At realism=100, photography override comes FIRST — before art style.
  // Art style text instructs rendering techniques (oil paint, ink lines, etc.)
  // that directly contradict "real photograph". Placing photography first makes
  // it the dominant instruction; art style is reframed as world design only.
  if (realism === 100) {
    const worldDesign = artStyle.replace(
      /^ART STYLE(\s*\([^)]*\))?/,
      'WORLD DESIGN LANGUAGE — aesthetic of the photographed world, does NOT define rendering medium'
    );
    return `RENDERING MEDIUM — READ THIS FIRST, HIGHEST PRIORITY:
This image is a PHOTOGRAPH taken with a camera. A real camera image. NOT a painting, NOT an illustration, NOT a drawing, NOT a render, NOT concept art.
Every pixel must have photographic fidelity: physically accurate light and shadow, real material surfaces (skin pores, fabric weave, weathered stone), natural depth of field, lens characteristics, photographic grain or digital sensor noise.
ABSOLUTELY NO: brush strokes, ink outlines, paint texture, impasto, drawn or sketched quality, painterly softness, watercolour wash, halftone dots, comic shading, or any mark that reveals an artistic medium. The result must be indistinguishable from a real photograph shot on location.

${worldDesign}`;
  }

  // Rendering fidelity (steps 0 / 25 / 50 / 75)
  const rendering =
    realism === 0  ? `RENDERING: Flat graphic art. Zero shading, zero gradients. Bold outlines, pure flat colour fills. Like a printed poster or comic page.` :
    realism <= 25  ? `RENDERING: Stylized illustration. Expressive loose brushwork or clean graphic lines. Simple tonal variation, clearly artistic — not photographic.` :
    realism <= 50  ? `RENDERING: Semi-realistic illustration. Detailed painterly technique, natural lighting, visible artistic style — halfway between graphic art and realism.` :
                     `RENDERING: Realistic illustration. Accurate anatomy, natural light and shadow, detailed textures. High technical quality — looks like a finished oil or gouache painting by a skilled illustrator.`;

  return `${artStyle}\n\n${rendering}`;
}


// Claude schrijft ALLEEN de scène-inhoud (wat is er te zien) — GEEN stijl, GEEN techniek
// charAppearances: CHARACTER APPEARANCE blok uit consistentieprofiel voor named character cues
// sceneProps: SCENE PROPS blok voor prop-eigendoms-verificatie
// correctionNote: optionele vrije tekst bij herGeneratie (bijsturing karakter, omgeving, etc.)
function buildImagePromptRequest(scene, charAppearances, sceneProps = '', correctionNote = '') {
  const keyEls = (scene.key_elements || []).join(', ') || '—';
  const worldState = scene.world_state ? `\nNarrative state: ${scene.world_state}` : '';
  const forbidden = scene.scene_forbidden?.length
    ? `\nFORBIDDEN in this specific scene: ${scene.scene_forbidden.join(', ')}`
    : '';

  // Named character cues: inject appearance lines only for the active characters in this scene
  let charNamedCues = '';
  if (scene.active_characters?.length) {
    const lines = scene.active_characters.map(c => {
      // Strip "young"/"old" suffix before matching — CHARACTER APPEARANCE uses year only (e.g. "· 1956")
      const yearOnly = c.temporal_version.replace(/\s+(young|old)$/i, '').trim();
      const re = charAppearances
        ? new RegExp(`-\\s*${c.name}[^\\n]*${yearOnly}[^\\n]*`, 'i')
        : null;
      const match = re ? charAppearances.match(re) : null;
      const appearance = match ? match[0].replace(/^-\s*/, '') : null;
      const actionNote = c.action ? `\n  SCENE ACTION: ${c.action}` : '';
      return appearance
        ? `${c.name} (${c.role}): ${appearance}${actionNote}`
        : `${c.name} (${c.role})${actionNote}`;
    });
    charNamedCues = `\n\nCHARACTER VISUAL REFERENCE — refer to each character by name:\n${lines.join('\n')}\nRules: (1) Use character names in your description. (2) Use ONLY the visual traits listed — do NOT add hats, accessories, or garments not listed. (3) Each character must perform their stated SCENE ACTION — do not swap actions between characters.`;
  }

  // Prop ownership constraint: prevents Claude from reassigning props to the wrong character
  const propConstraint = sceneProps
    ? `\n\nPROP OWNERSHIP — respect these assignments, do not reassign:\n${sceneProps}`
    : '';

  const correction = correctionNote.trim()
    ? `\n\nCORRECTION FOR THIS REGENERATION: ${correctionNote.trim()}\nApply this to the scene description — it overrides the default description where they conflict.`
    : '';

  return `You are a visual content analyst preparing scene descriptions for an AI image generator.

Describe ONLY the visual content of the scene: who is present and what they are doing, the setting and environment, the camera angle and composition, the lighting conditions. Do NOT mention art style, medium, or rendering technique.

SCENE:
Title: ${scene.scene_title}
Description: ${scene.visual_description}
Key elements: ${keyEls}${worldState}${forbidden}${charNamedCues}${propConstraint}${correction}

Context: 1950s Netherlands. People wear plain working-class 1950s Dutch clothing. Technology is ordinary: bicycles, modest brick buildings, simple tools. No machinery or apparatus should be described unless it is mundane 1950s Dutch. If the sea hangs overhead, describe it as a natural atmospheric feature — a vast dark ceiling of water far above, like storm clouds.

Write 60–80 words in English. Reply with the scene content description only — no style words, no preamble.`;
}

// Bouwt de definitieve Gemini-prompt: stijlblok EERST, dan wereld + karakter + scène
function buildFinalGeminiPrompt(claudePrompt, style, consistencyProfile, balloonText, stripStyle, scene, hasStyleProof = false, worldRules = '', charLabels = null) {
  const hasStrip = !!(stripStyle && STRIP_STYLES[stripStyle]);
  let styleDirective = buildStyleDirective(style);

  // Gradueer de FIDELITY LEVEL label op basis van uitvoerings-niveau.
  // Bij lage uitvoering overschrijft de stripstijl volledig; bij hoge uitvoering is het een smaakje.
  if (hasStrip && style.realism < 100) {
    const overrideLabel =
      style.realism <= 25 ? 'FIDELITY LEVEL (fully overridden by COMIC BOOK RENDERING below):' :
      style.realism <= 50 ? 'FIDELITY LEVEL (strongly shaped by COMIC BOOK RENDERING below):' :
      style.realism <= 75 ? 'FIDELITY LEVEL (partially moderated by COMIC BOOK RENDERING below):' :
                            'FIDELITY LEVEL (lightly flavored by COMIC BOOK RENDERING below):';
    styleDirective = styleDirective.replace(/^RENDERING:/m, overrideLabel);
  }

  const parts = [];

  // Preamble: bij actieve stripstijl met lage-tot-gemiddelde uitvoering zet een expliciete
  // RENDERING MODE instructie bóven het ART STYLE blok. Dit voorkomt dat Gemini door de
  // uitgebreide olieverf-taal (impasto, canvas, museum masterwork) in het ART STYLE blok
  // semantisch wordt getrokken naar een realistisch schildermedium voordat de COMIC BOOK
  // RENDERING-instructie is bereikt — met name bij scenes die sterk resoneren met die stijl.
  if (hasStrip && style.realism <= 75) {
    parts.push(`RENDERING MODE — COMIC ILLUSTRATION: Read this before the ART STYLE section. The ART STYLE block defines color palette and compositional mood only. All oil-painting medium terms ("oil on canvas", "impasto", "glazes", "sfumato", "museum masterwork", "painterly technique") apply to palette and atmosphere — NOT to drawing technique or medium. The COMIC BOOK RENDERING block below is the sole authority for line work, rendering style, and medium.`);
  } else if (hasStrip) {
    parts.push(`RENDERING MODE — COMIC AESTHETIC: The ART STYLE section defines color palette and mood. Medium-specific terms ("oil on canvas", "impasto") inform texture and atmosphere only. The COMIC BOOK RENDERING block defines the primary visual character.`);
  }

  parts.push(styleDirective);

  if (hasStrip) {
    // Bridge note: verduidelijkt de verhouding ART STYLE ↔ COMIC BOOK RENDERING.
    // Voorkomt dat ART STYLE-schildertechniek (Oil on canvas, impasto, etc.) de stripstijl
    // overschrijft wanneer de scene-inhoud semantisch resoneert met de dominante stijlmix.
    // Autoriteit schaalt omgekeerd met uitvoering (zie ARCHITECTURE.md stijlsysteem-schema).
    const r = style.realism;
    const bridgeNote =
      r >= 100
        ? `RENDERING FLAVOR (photorealistic): The photographic rendering above is the primary medium. The COMIC BOOK RENDERING below provides a very subtle aesthetic flavor only — it may influence character proportions, color palette choices, and overall visual tone without overriding the photographic medium.`
        : r <= 25
        ? `RENDERING PRIORITY: This image is a COMIC ILLUSTRATION. The COMIC BOOK RENDERING block below is the sole authority for medium, line technique, and color application. Any oil-paint, brushwork, or realistic-medium references in the ART STYLE block above define COLOR PALETTE and MOOD ATMOSPHERE only — not the rendering medium. Apply the named painters' color choices and compositional atmosphere within the comic rendering technique.`
        : r <= 50
        ? `RENDERING BLEND (comic-dominant): Primarily a COMIC ILLUSTRATION with dimensional volume. The COMIC BOOK RENDERING block below is the primary rendering framework; the fidelity level adds depth and detail within that framework. The ART STYLE block above defines palette and mood — apply those within the comic technique.`
        : r <= 75
        ? `RENDERING BLEND (realistic-dominant): Primarily a REALISTIC ILLUSTRATION. The COMIC BOOK RENDERING block below serves as a strong aesthetic reference — it informs character treatment, color palette, and line quality without fully overriding the realistic medium. ART STYLE defines the painterly palette and atmosphere.`
        : `RENDERING FLAVOR (near-realistic): Near-realistic illustration. The COMIC BOOK RENDERING block below provides a subtle aesthetic flavor only — slight stylization in character treatment and color palette. The fidelity level and ART STYLE are the primary rendering authorities.`;
    parts.push(bridgeNote);
    parts.push(STRIP_STYLES[stripStyle]);
  }

  // Vaste wereldregels — altijd aanwezig, ook bij fotorealisme
  if (worldRules) parts.push(worldRules);

  // Karakterprofiel uit consistentieprofiel (als beschikbaar)
  if (consistencyProfile) {
    parts.push(consistencyProfile);
  }

  // Stijlreferentie-instructie wanneer een stijlproef-afbeelding is bijgevoegd,
  // en/of compositiedirectief voor grafische roman (elk panel uniek camerastandpunt).
  const compDir = scene?.composition_directive || scene?.composition_type;
  if (hasStyleProof) {
    // Expliciete waarschuwing dat de stijlproef een KARAKTER-LINEUP is, geen scène.
    // Zonder dit kan Gemini de lineup-compositie als template behandelen.
    parts.push(`STYLE REFERENCE IMAGE — CHARACTER REFERENCE SHEET ONLY: The attached image is a neutral character lineup (figures standing side by side, facing the viewer, plain background). It establishes ONLY visual style: line technique, color palette, how each character looks. It is NOT a scene composition. Do NOT reproduce its arrangement: no characters standing in a row, no frontal neutral poses, no plain empty background. Every scene image must place characters in active, narrative staging — in motion, in context, in environment.`);
  }
  if (compDir) {
    parts.push(`COMPOSITION: ${compDir}.`);
  }

  // Actieve karakters voor deze scène — welke tijdversie per personage
  if (scene?.active_characters?.length) {
    const charCues = scene.active_characters
      .map(c => `- ${c.name} (${c.temporal_version}, ${c.role})`)
      .join('\n');
    parts.push(`ACTIVE CHARACTERS — draw ONLY these temporal versions from the CHARACTER SHEET above:\n${charCues}`);
  }

  // Scène-specifieke contextuele beperking (wanneer Claude dit heeft bepaald)
  if (scene?.world_state) {
    parts.push(`SCENE-SPECIFIC STATE: ${scene.world_state}`);
  }
  if (scene?.scene_forbidden?.length) {
    parts.push(`SCENE-SPECIFIC FORBIDDEN: ${scene.scene_forbidden.join('; ')}`);
  }

  parts.push(`SCENE CONTENT:\n${claudePrompt}`);

  if (balloonText) {
    parts.push(`SPEECH BUBBLE: Include exactly one speech bubble in the image containing the text: "${balloonText}". Draw it in the dominant art style with a tail pointing at the speaking character. No other text or lettering anywhere.`);
  } else if (charLabels && charLabels.length) {
    parts.push(`IMPORTANT — CHARACTER NAME LABELS REQUIRED: Write each character's name in large, legible text directly below their feet. Names (left to right): ${charLabels.map(n => `"${n}"`).join(', ')}. These name labels are the ONLY text permitted in the image. No other lettering, captions, or speech bubbles.`);
  } else {
    parts.push('IMPORTANT: No text, no lettering, no speech bubbles, no captions anywhere in the image.');
  }

  return parts.join('\n\n');
}

function buildFilename(scene, style, idx, fileCode = 'WK') {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const hh  = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seq = String(idx + 1).padStart(3, '0');
  const dateStr = `${yy}${mm}${dd}_${hh}${min}`;

  const titleSlug = (scene.scene_title || `scene${idx + 1}`)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 36);

  const p1  = Math.round((style.w1 || 0) * 100);
  const p2  = Math.round((style.w2 || 0) * 100);
  const p3  = Math.round((style.w3 || 0) * 100);
  const ids = (scene.paragraph_ids || [scene.panel_number]).join('-');
  return `${fileCode}_${dateStr}_${seq}_${titleSlug}_§${ids}_s${p1}-${p2}-${p3}_r${style.realism}.png`;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export class Generator {
  constructor() {
    this._handlers = {};
    this._ac = null;    // AbortController
    this._story = bordewijkStory;
  }

  setStory(storyDef) {
    this._story = storyDef;
  }

  on(event, fn) {
    (this._handlers[event] ||= []).push(fn);
    return this;
  }

  _emit(event, data) {
    (this._handlers[event] || []).forEach(fn => fn(data));
  }

  stop() {
    this._ac?.abort();
    this._ac = null;
  }

  async generate({ mode, style, marks, segments, sceneSource, textOpts, novelCount, bCount, stripStyle }) {
    this._ac = new AbortController();
    const sig = this._ac.signal;

    const model    = storage.getGeminiModel();
    const strategy = storage.getGenerationStrategy();
    const debug    = storage.getDebugMode();

    try {
      // ── Stap 0: Consistentieprofiel (Prompt 0) ────────────────────────────
      let consistency = storage.getConsistency();
      if (!consistency) {
        this._emit('consistency-start', {});
        consistency = await this._generateConsistencyProfile(sig, debug);
        storage.setConsistency(consistency);
        storage.setConsistencyTs(new Date().toISOString());
        this._emit('consistency-ready', { consistency });
      }

      // Extraheer CHARACTER APPEARANCE en sla op voor named scene descriptions
      let charAppearances = storage.getCharAppearances();
      if (!charAppearances && consistency) {
        charAppearances = this._extractCharAppearances(consistency);
        if (charAppearances) storage.setCharAppearances(charAppearances);
      }

      // Extraheer SCENE PROPS voor prop-eigendomsinjectie in scene-selectieprompts
      const sceneProps = consistency ? this._extractSceneProps(consistency) : '';

      // ── Stap 0b: Karakterreferentie-afbeelding (optioneel) ───────────────
      const useProofGlobal = sceneSource !== 'random';
      const calibEnabled  = storage.getCalibrationEnabled();
      if (calibEnabled && useProofGlobal && !storage.getStyleProof()) {
        let calibApproved = false;
        let calibCorrection = '';
        while (!calibApproved) {
          this._emit('calibration-start', {});
          try {
            const calDataUrl = await this._generateCalibrationImage(
              style, consistency, charAppearances, stripStyle, model, sig, debug, calibCorrection
            );
            if (sig.aborted) { this._emit('done', {}); return; }
            storage.setStyleProof(calDataUrl);

            // Wacht op gebruikersgoedkeuring — { action: 'approve'|'regen', note: string }
            const { action, note } = await new Promise((resolve, reject) => {
              if (sig.aborted) { reject(new DOMException('Afgebroken', 'AbortError')); return; }
              const onAbort = () => reject(new DOMException('Afgebroken', 'AbortError'));
              sig.addEventListener('abort', onAbort, { once: true });
              this._emit('calibration-image', {
                dataUrl: calDataUrl,
                charNames: this._extractCharNames(charAppearances),
                onDecide: (action, note = '') => {
                  sig.removeEventListener('abort', onAbort);
                  resolve({ action, note });
                },
              });
            });

            calibApproved = (action === 'approve');
            if (!calibApproved) {
              calibCorrection = note;
              storage.clearStyleProof();
            }
          } catch (calErr) {
            if (sig.aborted) { this._emit('done', {}); return; }
            // Mislukking is niet fataal — stijlproef blijft leeg, eerste scène wordt anker
            console.warn('[NV] Kalibratie mislukt:', calErr.message);
            this._emit('calibration-error', { message: calErr.message });
            calibApproved = true;
          }
        }
      }

      // ── Stap 1: Scènes verzamelen ─────────────────────────────────────────
      const scenesLabel = _scenesLabel(mode, sceneSource, novelCount);
      this._emit('scenes-start', { label: scenesLabel });
      let scenes = [];
      if (mode === 'A') {
        scenes = await this._getScenesA(sceneSource, marks, sig, debug, sceneProps);
      } else if (mode === 'B') {
        scenes = await this._getScenesB(sceneSource, marks, segments, bCount || 4, sig, debug, sceneProps);
      } else if (mode === 'C') {
        scenes = await this._getScenesC(novelCount, sceneSource, marks, sig, debug, sceneProps);
      }

      if (!scenes.length) {
        this._emit('error', { message: 'Geen scènes geselecteerd.' });
        this._emit('done', {});
        return;
      }

      this._emit('start', { total: scenes.length, mode });

      const runScene = async (scene, index) => {
        if (sig.aborted) return;
        const title = scene.scene_title || (scene.panel_number
          ? `Panel ${scene.panel_number}`
          : `Scène ${index + 1}`);
        this._emit('progress', { index, total: scenes.length, title });

        try {
          // Prompt 4: genereer Gemini-beeldprompt via Claude
          const promptReq = buildImagePromptRequest(scene, charAppearances, sceneProps);
          if (debug) console.log(`[NV] Prompt 4 (scène ${index + 1}):`, promptReq);

          const claudePrompt = await claudeComplete(
            [{ role: 'user', content: promptReq }],
            '',
            sig
          );
          if (debug) console.log('[NV] Claude beeldprompt:', claudePrompt);

          // Bouw definitieve Gemini-prompt (balloon pas beschikbaar na caption; we bouwen later)
          // (finalPrompt wordt hieronder gebouwd na balloon-fetch)

          // Prompt 5 (optioneel): onderschrift
          let caption = null;
          if (textOpts?.caption && scene.paragraph_ids?.length) {
            caption = await this._getCaption(scene, sig, debug);
          } else if (scene.caption_text) {
            caption = scene.caption_text;
          }

          // Scènetekst naast afbeelding: ruwe verhaaltekst (geen extra API-call)
          const sidetext = (textOpts?.sidetext && scene.paragraph_ids?.length)
            ? getParaText(scene.paragraph_ids, this._story)
            : null;

          // Tekstballon: haal dialoogtekst op als de optie aan staat
          let balloonText = null;
          if (textOpts?.balloon) {
            if (scene.balloon_text) {
              balloonText = scene.balloon_text;
            } else if (scene.paragraph_ids?.length) {
              balloonText = await this._getBalloonText(scene, sig, debug);
            }
          }

          // Stijlproef meesturen als referentie voor stijlconsistentie
          const styleProof = useProofGlobal ? (storage.getStyleProof() || null) : null;

          // Nu pas definitieve Gemini-prompt bouwen (met balloonText en info of stijlproef meegaat)
          const finalPrompt = buildFinalGeminiPrompt(claudePrompt.trim(), style, consistency, balloonText, stripStyle, scene, !!styleProof, this._story.worldRules);

          if (sig.aborted) return;
          let dataUrl;
          try {
            dataUrl = await geminiGenerateImage(finalPrompt, model, sig, styleProof);
          } catch (firstErr) {
            if (sig.aborted) return;
            // Eenmalige retry na 3 seconden — vangt tijdelijke Gemini-fouten op
            await new Promise(r => setTimeout(r, 3000));
            if (sig.aborted) return;
            dataUrl = await geminiGenerateImage(finalPrompt, model, sig, styleProof);
          }

          // Eerste scène als stijlproef opslaan als er nog geen is (fallback als kalibratie uit stond)
          let isAutoProof = false;
          if (useProofGlobal && !storage.getStyleProof()) {
            storage.setStyleProof(dataUrl);
            isAutoProof = true;
            this._emit('style-proof-set', { dataUrl, index });
          }

          const filename = buildFilename(scene, style, index, this._story?.fileCode || 'WK');

          this._emit('image', {
            index,
            dataUrl,
            scene,
            style: { ...style },
            caption,
            sidetext,
            filename,
            prompt: finalPrompt,
            isAutoProof,
          });
        } catch (err) {
          if (sig.aborted) return;
          this._emit('image-error', { index, message: err.message, scene });
        }
      };

      if (strategy === 'batch') {
        await Promise.all(scenes.map((sc, i) => runScene(sc, i)));
      } else {
        for (let i = 0; i < scenes.length; i++) {
          if (sig.aborted) break;
          await runScene(scenes[i], i);
        }
      }

      this._emit('done', {});
    } catch (err) {
      if (!sig.aborted) {
        this._emit('error', { message: err.message });
        this._emit('done', {});
      }
    }
  }

  // ─── Scene getters ──────────────────────────────────────────────────────────

  async _getScenesA(sceneSource, marks, sig, debug, sceneProps = '') {
    if (sceneSource === 'random') {
      const para = this._story.paragraphs[Math.floor(Math.random() * this._story.paragraphs.length)];
      return [{
        scene_title: shortTitle(para.text),
        visual_description: para.text,
        key_elements: [],
        paragraph_ids: [para.id],
      }];
    }

    if (sceneSource === 'marks' && marks.length) {
      const paraText = getParaText(marks, this._story);
      const scenes = [{
        scene_title: shortTitle(paraText),
        visual_description: paraText,
        key_elements: [],
        paragraph_ids: marks,
      }];
      return this._addCompositionDirectives(scenes, sig, debug);
    }

    const propContext = sceneProps
      ? `\nPROP OWNERSHIP — assign props correctly in visual_description:\n${sceneProps}\n`
      : '';

    // Claude chooses the best single scene
    const prompt = `Je bent een visueel redacteur gespecialiseerd in het illustreren van literatuur.

Het volgende verhaal is "${this._story.title}" van ${this._story.author} (${this._story.year}).

VERHAAL:
${buildFullStoryText(this._story)}
${propContext}
Kies het ene moment uit dit verhaal dat het meest geschikt is voor een enkele dramatische illustratie. Kies een moment met sterke visuele impact, duidelijke ruimtelijke compositie, en dat kenmerkend is voor de sfeer van het verhaal.

Antwoord uitsluitend als JSON (geen andere tekst):
{
  "paragraph_ids": [<array van §-nummers>],
  "scene_title": "<korte Nederlandse titel>",
  "visual_description": "<Nederlandse beschrijving, 2–4 zinnen>",
  "key_elements": ["<visueel element>"],
  "world_state": "<one sentence in English: state of the world at this point in the story — has the sea been displaced? what is visible above the characters? season/time of day?>",
  "scene_forbidden": ["<visual element that must NOT appear in THIS specific scene, based on the story text — in English>"],
  "active_characters": [{"name": "<character name>", "temporal_version": "<e.g. '1956 young' or '2006 old'>", "role": "<protagonist|antagonist|mentor|bystander>", "action": "<what this character is physically doing in this specific scene — verb phrase, max 10 words>"}],
  "composition_directive": "<camera angle + shot size + figure-to-space ratio + compositional energy, chosen for this scene's specific action and emotional register — e.g. 'extreme low angle wide shot, tiny figures dwarfed by sea overhead, diagonal tension left to right' or 'tight close-up, face half in shadow, static intensity' or 'medium shot eye-level, two figures facing each other, horizontal calm'>"
}`;

    if (debug) console.log('[NV] Prompt 1 (scene A):', prompt);
    const raw = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
    if (debug) console.log('[NV] Claude scene A response:', raw);
    const scene = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return [scene];
  }

  async _getScenesB(sceneSource, marks, segments, bCount, sig, debug, sceneProps = '') {
    const n = bCount || 4;

    if (sceneSource === 'random') {
      const total = this._story.paragraphs.length;
      const step  = Math.max(1, Math.floor(total / n));
      const offset = Math.floor(Math.random() * step);
      return Array.from({ length: n }, (_, i) => {
        const para = this._story.paragraphs[Math.min(offset + i * step, total - 1)];
        return {
          scene_title: shortTitle(para.text),
          visual_description: para.text,
          key_elements: [],
          paragraph_ids: [para.id],
        };
      });
    }

    if (sceneSource === 'marks' && marks.length) {
      const segs = (segments && segments.length > 0)
        ? segments
        : marks.map(id => ({ paras: [id] }));
      const scenes = segs.map(seg => {
        const text = getSegmentText(seg, this._story);
        return {
          scene_title: shortTitle(text),
          visual_description: text,
          key_elements: [],
          paragraph_ids: seg.paras,
        };
      });
      return this._addCompositionDirectives(scenes, sig, debug);
    }

    const propContext = sceneProps
      ? `\nPROP OWNERSHIP — assign props correctly in visual_description:\n${sceneProps}\n`
      : '';

    const prompt = `Je bent een visueel redacteur gespecialiseerd in het illustreren van literatuur.

Het volgende verhaal is "${this._story.title}" van ${this._story.author} (${this._story.year}).

VERHAAL:
${buildFullStoryText(this._story)}
${propContext}
Kies precies ${n} momenten die samen een visueel coherente reeks vormen. Zorg voor variatie in sfeer en compositie. Toon samen het arc van het verhaal (begin, hoogtepunt, slot).

Antwoord uitsluitend als JSON-array met precies ${n} objecten (geen andere tekst):
[
  {
    "paragraph_ids": [<§-nummers>],
    "scene_title": "<korte Nederlandse titel>",
    "visual_description": "<2–4 zinnen>",
    "key_elements": ["<element>"],
    "world_state": "<one sentence in English: state of the world at this point — has the sea been displaced? what is visible above the characters?>",
    "scene_forbidden": ["<visual element that must NOT appear in THIS specific scene — in English>"],
    "active_characters": [{"name": "<character name>", "temporal_version": "<'1956 young'|'1956 old'|'2006 old'>", "role": "<protagonist|antagonist|mentor|bystander>", "action": "<what this character is physically doing in this specific scene — verb phrase, max 10 words>"}],
    "composition_directive": "<camera angle + shot size + figure-to-space ratio + compositional energy, chosen for this scene's specific action and emotional register — e.g. 'extreme low angle wide shot, tiny figures dwarfed by sea overhead, diagonal tension left to right' or 'tight close-up, face half in shadow, static intensity' or 'medium shot eye-level, two figures facing each other, horizontal calm'>"
  }
]`;

    if (debug) console.log('[NV] Prompt 2 (scenes B):', prompt);
    const raw = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
    if (debug) console.log('[NV] Claude scenes B response:', raw);
    return safeParseJsonArray(raw);
  }

  async _getScenesC(n, sceneSource, marks, sig, debug, sceneProps = '') {
    const compRule = `COMPOSITIEREGEL: Elk panel krijgt een unieke "composition_directive" op basis van de scène-inhoud en emotionele lading van dat specifieke moment. Varieer bewust over alle ${n} panels: geen twee panels mogen dezelfde combinatie van camerastandpunt, shot-grootte en compositie-energie hebben. Leidraad: actie → diagonaal of laag standpunt; dialoog → medium shot ooghoogte; schaal of eenzaamheid → kleine figuur in grote omgeving; emotionele piek → close-up of extreme close-up; overzicht → vogelperspectief of breed totaalshot. Volg de emotionele lading van het verhaalmoment.`;

    // Korte beschrijvingen bij grote aantallen om tokenlimieten te vermijden
    const lengthNote = n >= 12
      ? 'Houd visual_description kort: maximaal 2 zinnen. caption_text maximaal 15 woorden.'
      : 'visual_description: 2–4 zinnen. caption_text: maximaal 35 woorden.';

    const panelSchema = `[
  {
    "panel_number": 1,
    "paragraph_ids": [<§-nummers>],
    "scene_title": "<korte Nederlandse titel>",
    "visual_description": "<wat er visueel te zien is, 2–4 zinnen>",
    "key_elements": ["<element>"],
    "caption_text": "<maximaal 35 woorden, citaat of parafrase>",
    "balloon_text": "<maximaal 15 woorden dialoog, of null>",
    "world_state": "<one sentence in English: state of the world at this point in the story>",
    "scene_forbidden": ["<visual element that must NOT appear in this specific panel — in English>"],
    "active_characters": [{"name": "<character name>", "temporal_version": "<'1956 young'|'1956 old'|'2006 old'>", "role": "<protagonist|antagonist|mentor|bystander>", "action": "<what this character is physically doing in this specific scene — verb phrase, max 10 words>"}],
    "composition_directive": "<camera angle + shot size + figure-to-space ratio + compositional energy — specific to this panel's scene and emotional register, e.g. 'low angle wide shot, figures small against vast sea overhead, diagonal tension'; 'tight close-up filling frame, static intensity'; 'bird's eye, lone figure in empty street, vertical isolation'>"
  }
]`;

    const propContext = sceneProps
      ? `\nPROP OWNERSHIP — assign props correctly in visual_description:\n${sceneProps}\n`
      : '';

    let prompt;

    if (sceneSource === 'marks') {
      // Gebruik gemarkeerde §-nummers als bronmateriaal; bij geen markering: volledig verhaal
      const marksText = marks.length ? getParaText(marks, this._story) : buildFullStoryText(this._story);
      const sourceLabel = marks.length
        ? 'De gebruiker heeft het volgende fragment gemarkeerd:\n\nFRAGMENT:'
        : 'Gebruik het volledige verhaal als bron:\n\nVERHAAL:';
      const coverInstruction = marks.length
        ? `Maak precies ${n} panels die dit fragment als grafische roman vertellen. Dek de volledige inhoud van het fragment.`
        : `Verdeel dit verhaal in precies ${n} panels voor een grafische roman. De panels moeten samen het volledige verhaal dekken en narratief logisch zijn.`;
      prompt = `Je bent een grafisch romanadapteur gespecialiseerd in het omzetten van literatuur naar stripverhalen.

${sourceLabel}
${marksText}
${propContext}
${coverInstruction}

${compRule}
${lengthNote}

Antwoord uitsluitend als JSON-array met precies ${n} objecten (geen andere tekst):
${panelSchema}`;

    } else if (sceneSource === 'highlight') {
      // Eerste stap: laat Claude het hoogtepunt kiezen
      const [highlight] = await this._getScenesA('claude', [], sig, debug, sceneProps);
      this._emit('status', { label: `Hoogtepunt gevonden — ${n} panels uitwerken (stap 2 van 2, Claude)…` });
      const highlightDesc = `Titel: ${highlight.scene_title}\nBeschrijving: ${highlight.visual_description}`;

      prompt = `Je bent een grafisch romanadapteur gespecialiseerd in het omzetten van literatuur naar stripverhalen.

Het volgende verhaal is "${this._story.title}" van ${this._story.author} (${this._story.year}).

VERHAAL:
${buildFullStoryText(this._story)}
${propContext}
Het dramatische hoogtepunt van dit verhaal is:
${highlightDesc}

Maak precies ${n} panels die dit hoogtepunt centraal stellen. De panels mogen de aanloop naar en de nasleep van dit moment bevatten, maar de kern van de reeks draait om dit hoogtepunt. Breng de maximale narratieve spanning op het hoogtepunt.

${compRule}
${lengthNote}

Antwoord uitsluitend als JSON-array met precies ${n} objecten (geen andere tekst):
${panelSchema}`;

    } else {
      // 'claude' — vrij verdeeld over het volledige verhaal
      prompt = `Je bent een grafisch romanadapteur gespecialiseerd in het omzetten van literatuur naar stripverhalen.

Het volgende verhaal is "${this._story.title}" van ${this._story.author} (${this._story.year}).

VERHAAL:
${buildFullStoryText(this._story)}
${propContext}
Verdeel dit verhaal in precies ${n} panels voor een grafische roman. De panels moeten samen het volledige verhaal dekken en narratief logisch zijn. Zorg voor variatie in sfeer: begin, spanning, hoogtepunt, nasleep.

${compRule}
${lengthNote}

Antwoord uitsluitend als JSON-array met precies ${n} objecten (geen andere tekst):
${panelSchema}`;
    }

    if (debug) console.log('[NV] Prompt 3 (panels C):', prompt);
    const raw = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
    console.log('[NV] Claude panels C response (eerste 500):', raw.slice(0, 500));
    if (debug) console.log('[NV] Claude panels C volledige respons:', raw);
    return safeParseJsonArray(raw);
  }

  async _getCaption(scene, sig, debug) {
    const paraText = getParaText(scene.paragraph_ids || [], this._story);
    const prompt = `Het volgende is een fragment uit "${this._story.title}" van ${this._story.author}:

${paraText}

Kies of parafraseer één zin die geschikt is als onderschrift bij een illustratie van dit moment. Maximaal 20 woorden. Behoud de schrijfstijl van ${this._story.author}: ${this._story.writerStyle}. Antwoord uitsluitend met de zin, geen aanhalingstekens, geen uitleg.`;

    if (debug) console.log('[NV] Prompt 5 (caption):', prompt);
    const result = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
    return result.trim();
  }

  async _getBalloonText(scene, sig, debug) {
    const paraText = getParaText(scene.paragraph_ids || [], this._story);
    const prompt = `Het volgende is een fragment uit "${this._story.title}" van ${this._story.author}:

${paraText}

Bevat dit fragment directe rede of dialoog die geschikt is als tekstballon in een illustratie?
- Zo ja: geef de kortste relevante zin letterlijk terug (maximaal 12 woorden), zonder aanhalingstekens, geen uitleg.
- Zo nee: antwoord uitsluitend met het woord GEEN.`;

    if (debug) console.log('[NV] Prompt ballon:', prompt);
    const result = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
    const text = result.trim();
    return text === 'GEEN' ? null : text;
  }

  // ─── Composition directives voor marks-bronscènes ─────────────────────────
  // Marks/random-bronnen genereren scenes zonder Claude-keuze en hebben daardoor
  // geen composition_directive. Deze methode voegt die toe via één Claude-call.
  async _addCompositionDirectives(scenes, sig, debug) {
    if (!scenes.length) return scenes;
    const listed = scenes.map((s, i) =>
      `Scene ${i + 1}: "${s.scene_title}" — ${(s.visual_description || '').slice(0, 300)}`
    ).join('\n\n');

    const prompt = `You are a visual composition editor for a graphic novel. The descriptions below are literary text excerpts — extract the most dramatically charged single moment from each and assign a composition directive.

STRICT RULE: Never suggest characters simply standing side by side facing the viewer — that is a character reference sheet, not a scene. Every directive must place characters in ACTIVE, NARRATIVE staging: in motion, reacting, in environment, interacting with space.

For each scene write a "composition_directive" specifying: camera angle (e.g. low-angle, overhead, dutch tilt, eye-level) + shot size (extreme close-up / close-up / medium / wide / establishing) + figure-to-space ratio + compositional energy/tension (e.g. diagonal, radial, static, kinetic).

${listed}

Reply ONLY as a JSON array with exactly ${scenes.length} objects, no other text:
[{"composition_directive": "..."}, ...]`;

    if (debug) console.log('[NV] Composition directives prompt:', prompt);
    try {
      const raw = await claudeComplete([{ role: 'user', content: prompt }], '', sig);
      if (debug) console.log('[NV] Composition directives response:', raw);
      const directives = safeParseJsonArray(raw);
      return scenes.map((s, i) => ({
        ...s,
        composition_directive: directives[i]?.composition_directive || '',
      }));
    } catch {
      return scenes;
    }
  }

  // ─── Consistentieprofiel (Prompt 0) ────────────────────────────────────────

  // Publieke methode — roepbaar vanuit app.js voor de "Genereer profiel"-knop
  async generateConsistencyProfile(signal) {
    const debug = storage.getDebugMode();
    return await this._generateConsistencyProfile(signal, debug);
  }

  async _generateConsistencyProfile(signal, debug) {
    const prompt = `Je bent een visueel continuïteitsredacteur voor een geïllustreerde editie van "${this._story.title}" van ${this._story.author} (${this._story.year}).

Lees het verhaal en genereer een compact consistentieprofiel in het Engels, uitsluitend bedoeld als vaste prefix voor AI-beeldprompts.

VERHAAL:
${buildFullStoryText(this._story)}

Genereer het profiel in PRECIES dit formaat, geen andere tekst.

Regels voor CHARACTER APPEARANCE:
- Één regel per tijdversie per personage
- Specificeer EXACTE kleuren voor kleding en haar (bijv. "beige trench coat" niet "working-class coat")
- Alleen stabiele visuele kenmerken: bouw, gezicht, haar, kleding — GEEN props of accessoires
- Maximaal 6 kommagescheiden kenmerken per regel, geen volledige zinnen
- De twee personages moeten visueel duidelijk van elkaar te onderscheiden zijn

CHARACTER APPEARANCE — exact visual anchors, used verbatim in all image prompts:
- Bordemanse · 1956 young (protagonist): [height/build, distinctive face feature, hair color+style, hat color+type, jacket/coat color+type, trouser color — 5–6 items]
- Bordemanse · 2006 old (protagonist): [height/build, same distinctive face feature as young, hair color, coat color+type, trouser color — 4–5 items]
- Drebbel · 1956 (antagonist): [height/build, distinctive face/posture feature, hair color+style, hat or no hat, jacket color+type, trouser color — 5–6 items, clearly different from Bordemanse]

SCENE PROPS — NARRATIVE REFERENCE ONLY — do NOT draw unless listed in "PROPS IN THIS SCENE":
- [prop]: [owner, narrative §§ range when present]
- [prop]: [owner, narrative §§ range when present]

WORLD RULES
- [wereldregel 1: de zee, de hoogte, het licht]
- [wereldregel 2: de zeebodem]
- [wereldregel 3: tijdperk en locatie]
- [eventuele extra regels uit het verhaal]

RECURRING ELEMENTS
- [terugkerend visueel element 1]
- [terugkerend visueel element 2]
- [...]

FORBIDDEN
- [wat nooit in een afbeelding mag voorkomen, bv. moderne elementen, water op de grond]`;

    if (debug) console.log('[NV] Prompt 0 (consistentieprofiel):', prompt);
    const result = await claudeComplete([{ role: 'user', content: prompt }], '', signal);
    if (debug) console.log('[NV] Consistentieprofiel:\n', result);
    return result.trim();
  }

  // Extraheer het CHARACTER APPEARANCE blok uit het consistentieprofiel.
  // Dit blok wordt apart opgeslagen voor gebruik in named scene descriptions.
  _extractCharAppearances(consistencyText) {
    const match = consistencyText.match(/CHARACTER APPEARANCE[\s\S]*?(?=\nSCENE PROPS|\nWORLD RULES|\nRECURRING)/);
    return match ? match[0].trim() : '';
  }

  // Extraheer karakter namen uit charAppearances voor label-overlay op kalibratie-afbeelding.
  // Geeft ["Bordemanse · 1956 young", "Drebbel · 1956"] terug, in volgorde van het profiel.
  _extractCharNames(charAppearances) {
    const names = [];
    for (const line of (charAppearances || '').split('\n')) {
      const m = line.match(/^-\s+(.+?)\s*\((?:protagonist|antagonist|mentor|bystander)\)/i);
      if (m) names.push(m[1].trim());
    }
    return names;
  }

  // Extraheer het SCENE PROPS blok — eigendomsinformatie voor scene-selectieprompts.
  _extractSceneProps(consistencyText) {
    const match = consistencyText.match(/SCENE PROPS[\s\S]*?(?=\nWORLD RULES|\nRECURRING|\nFORBIDDEN|$)/);
    return match ? match[0].trim() : '';
  }

  // ─── Karakter-kalibratie-afbeelding ──────────────────────────────────────
  // Genereert een "character lineup" als 0e stijlproef vóór de verhaalscènes.
  // Beide personages frontaal, vol lichaam, neutraal strand — geen verhaalcompositie.
  async _generateCalibrationImage(style, consistency, charAppearances, stripStyle, model, sig, debug, correctionNote = '') {
    // Tel het aantal characters op basis van bullet-regels in charAppearances
    const charCount = (charAppearances.match(/^-\s+\S/gm) || []).length || 2;
    const positions = charCount === 2
      ? 'The taller character stands on the LEFT, the shorter on the RIGHT.'
      : `Characters arranged left to right, tallest to shortest (${charCount} figures total).`;

    const charNames = this._extractCharNames(charAppearances);

    const lineupDesc = `CHARACTER LINEUP — establish the definitive visual reference for all characters in this series.

Draw exactly ${charCount} character${charCount === 1 ? '' : 's'} standing side by side, facing the viewer directly, full body visible from head to toe. Simple neutral setting: empty beach, pre-displacement morning, calm sea at the horizon, no story action.

${charAppearances}

STRICT RULE: this image contains ONLY the ${charCount} character${charCount === 1 ? '' : 's'} described above — no other figures, no bystanders, no background people whatsoever.
${positions}
Every character is relaxed, hands at sides, no props held, no action, no interaction. Clear full-body view of each. Characters visually distinct and individually recognizable.${correctionNote ? `\n\nUSER CORRECTION FOR THIS ATTEMPT: ${correctionNote}\nApply this instruction — it overrides the defaults above where they conflict.` : ''}`;

    const finalPrompt = buildFinalGeminiPrompt(lineupDesc, style, consistency, null, stripStyle, null, false, this._story.worldRules, charNames.length ? charNames : null);
    if (debug) console.log('[NV] Kalibratie-prompt:\n', finalPrompt);
    return await geminiGenerateImage(finalPrompt, model, sig, null);
  }

  // ─── Stijltest: 3 uitersten voor dezelfde scène ────────────────────────────

  async generateStyleTest() {
    this._ac = new AbortController();
    const sig = this._ac.signal;
    const model = storage.getGeminiModel();
    const debug = storage.getDebugMode();

    const variants = [
      { w1: 1, w2: 0, w3: 0, realism: 0,  label: '100% Gouden Eeuw — Geïllustreerd' },
      { w1: 0, w2: 1, w3: 0, realism: 50, label: '100% Jugendstil/Art Déco — Semi-realistisch' },
      { w1: 0, w2: 0, w3: 1, realism: 75, label: '100% Magisch Realisme — Realistisch' },
    ];

    try {
      let consistency = storage.getConsistency();
      if (!consistency) {
        this._emit('consistency-start', {});
        consistency = await this._generateConsistencyProfile(sig, debug);
        storage.setConsistency(consistency);
        storage.setConsistencyTs(new Date().toISOString());
        this._emit('consistency-ready', { consistency });
      }

      // Eén scène, zodat alle drie varianten exact hetzelfde afbeelden
      const styleTestSceneProps = consistency ? this._extractSceneProps(consistency) : '';
      const styleTestCharAppearances = storage.getCharAppearances() || '';
      const [scene] = await this._getScenesA('claude', [], sig, debug, styleTestSceneProps);
      const contentPrompt = buildImagePromptRequest(scene, styleTestCharAppearances, styleTestSceneProps);
      if (debug) console.log('[NV] Stijltest scène:', contentPrompt);
      const claudeContent = await claudeComplete([{ role: 'user', content: contentPrompt }], '', sig);

      this._emit('start', { total: 3, mode: 'B' });

      for (let i = 0; i < variants.length; i++) {
        if (sig.aborted) break;
        const v = variants[i];
        this._emit('progress', { index: i, total: 3, title: v.label });
        try {
          const finalPrompt = buildFinalGeminiPrompt(claudeContent.trim(), v, consistency, null, undefined, undefined, false, this._story.worldRules);
          if (debug) console.log(`[NV] Stijltest variant ${i + 1} prompt:\n`, finalPrompt);
          const dataUrl = await geminiGenerateImage(finalPrompt, model, sig, null);
          this._emit('image', {
            index: i,
            dataUrl,
            scene: { ...scene, scene_title: v.label },
            style: { ...v },
            caption: v.label,
            filename: `${this._story?.fileCode || 'WK'}_styletest_${String(i + 1).padStart(3, '0')}.png`,
            prompt: finalPrompt,
            isAutoProof: false,
          });
        } catch (err) {
          if (!sig.aborted) this._emit('image-error', { index: i, message: err.message });
        }
      }
      this._emit('done', {});
    } catch (err) {
      if (!sig.aborted) {
        this._emit('error', { message: err.message });
        this._emit('done', {});
      }
    }
  }

  // ─── Gouden Eeuw uitvoeringstest: 5 niveaus, geen stripstijl ────────────────
  async generateGoudenEeuwTest() {
    this._ac = new AbortController();
    const sig = this._ac.signal;
    const model = storage.getGeminiModel();
    const debug = storage.getDebugMode();

    const variants = [
      { w1: 1, w2: 0, w3: 0, realism: 0,   label: '100% Gouden Eeuw — Flat grafisch' },
      { w1: 1, w2: 0, w3: 0, realism: 25,  label: '100% Gouden Eeuw — Geïllustreerd' },
      { w1: 1, w2: 0, w3: 0, realism: 50,  label: '100% Gouden Eeuw — Semi-realistisch' },
      { w1: 1, w2: 0, w3: 0, realism: 75,  label: '100% Gouden Eeuw — Realistisch' },
      { w1: 1, w2: 0, w3: 0, realism: 100, label: '100% Gouden Eeuw — Fotografisch' },
    ];

    try {
      let consistency = storage.getConsistency();
      if (!consistency) {
        this._emit('consistency-start', {});
        consistency = await this._generateConsistencyProfile(sig, debug);
        storage.setConsistency(consistency);
        storage.setConsistencyTs(new Date().toISOString());
        this._emit('consistency-ready', { consistency });
      }

      const sceneProps = consistency ? this._extractSceneProps(consistency) : '';
      const charAppearances = storage.getCharAppearances() || '';
      const [scene] = await this._getScenesA('claude', [], sig, debug, sceneProps);
      const contentPrompt = buildImagePromptRequest(scene, charAppearances, sceneProps);
      if (debug) console.log('[NV] Gouden Eeuw-test scène:', contentPrompt);
      const claudeContent = await claudeComplete([{ role: 'user', content: contentPrompt }], '', sig);

      this._emit('start', { total: variants.length, mode: 'B' });

      for (let i = 0; i < variants.length; i++) {
        if (sig.aborted) break;
        const v = variants[i];
        this._emit('progress', { index: i, total: variants.length, title: v.label });
        try {
          // Geen stripstijl — test puur de uitvoering van Gouden Eeuw
          const finalPrompt = buildFinalGeminiPrompt(claudeContent.trim(), v, consistency, null, undefined, undefined, false, this._story.worldRules);
          if (debug) console.log(`[NV] Gouden Eeuw-test variant ${i + 1} prompt:\n`, finalPrompt);
          const dataUrl = await geminiGenerateImage(finalPrompt, model, sig, null);
          this._emit('image', {
            index: i,
            dataUrl,
            scene: { ...scene, scene_title: v.label },
            style: { ...v },
            caption: v.label,
            filename: `${this._story?.fileCode || 'WK'}_goudeneeuwtest_${String(i + 1).padStart(3, '0')}.png`,
            prompt: finalPrompt,
            isAutoProof: false,
          });
        } catch (err) {
          if (!sig.aborted) this._emit('image-error', { index: i, message: err.message });
        }
      }
      this._emit('done', {});
    } catch (err) {
      if (!sig.aborted) {
        this._emit('error', { message: err.message });
        this._emit('done', {});
      }
    }
  }

  // ─── Stripstijltest: 8 stripstijlen voor dezelfde scène ──────────────────────

  async generateStripStyleTest(sceneSource, marks) {
    this._ac = new AbortController();
    const sig = this._ac.signal;
    const model = storage.getGeminiModel();
    const debug = storage.getDebugMode();

    const neutralStyle = { w1: 1 / 3, w2: 1 / 3, w3: 1 / 3, realism: 0 };

    // Derive label from the first line of each strip style block
    const variants = Object.keys(STRIP_STYLES).map(key => ({
      key,
      label: STRIP_STYLES[key].match(/COMIC BOOK RENDERING — ([^(:\n]+)/)?.[1]?.trim() || key,
    }));

    try {
      let consistency = storage.getConsistency();
      if (!consistency) {
        this._emit('consistency-start', {});
        consistency = await this._generateConsistencyProfile(sig, debug);
        storage.setConsistency(consistency);
        storage.setConsistencyTs(new Date().toISOString());
        this._emit('consistency-ready', { consistency });
      }

      const [scene] = await this._getScenesA(sceneSource, marks, sig, debug);
      const contentPrompt = buildImagePromptRequest(scene);
      if (debug) console.log('[NV] Stripstijltest scène:', contentPrompt);
      const claudeContent = await claudeComplete([{ role: 'user', content: contentPrompt }], '', sig);

      this._emit('start', { total: variants.length, mode: 'B' });

      for (let i = 0; i < variants.length; i++) {
        if (sig.aborted) break;
        const { key, label } = variants[i];
        this._emit('progress', { index: i, total: variants.length, title: label });
        try {
          const finalPrompt = buildFinalGeminiPrompt(claudeContent.trim(), neutralStyle, consistency, null, key, scene, false, this._story.worldRules);
          if (debug) console.log(`[NV] Stripstijltest ${key} prompt:\n`, finalPrompt);
          const dataUrl = await geminiGenerateImage(finalPrompt, model, sig, null);
          this._emit('image', {
            index: i,
            dataUrl,
            scene: { ...scene, scene_title: label },
            style: { ...neutralStyle },
            caption: label,
            filename: `${this._story?.fileCode || 'WK'}_striptest_${key}.png`,
            prompt: finalPrompt,
            isAutoProof: false,
          });
        } catch (err) {
          if (!sig.aborted) this._emit('image-error', { index: i, message: err.message });
        }
      }
      this._emit('done', {});
    } catch (err) {
      if (!sig.aborted) {
        this._emit('error', { message: err.message });
        this._emit('done', {});
      }
    }
  }

  // ─── Kosten­schatting ───────────────────────────────────────────────────────

  // ─── Hergenerate één scène ────────────────────────────────────────────────────
  // Gebruikt de opgeslagen scène- en stijldata; optioneel met bijstuuringstekst.
  async regenerateScene({ scene, style, stripStyle, correctionNote = '', signal }) {
    const debug = storage.getDebugMode();
    const model = storage.getGeminiModel();
    const consistency = storage.getConsistency() || '';
    const charAppearances = storage.getCharAppearances() || '';
    const sceneProps = consistency ? this._extractSceneProps(consistency) : '';

    const promptReq = buildImagePromptRequest(scene, charAppearances, sceneProps, correctionNote);
    if (debug) console.log('[NV] Regenerate prompt 4:', promptReq);

    const claudePrompt = await claudeComplete([{ role: 'user', content: promptReq }], '', signal);
    if (debug) console.log('[NV] Regenerate Claude output:', claudePrompt);

    const styleProof = storage.getStyleProof() || null;
    const finalPrompt = buildFinalGeminiPrompt(
      claudePrompt.trim(), style, consistency, null, stripStyle, scene, !!styleProof, this._story.worldRules
    );
    if (debug) console.log('[NV] Regenerate Gemini prompt:\n', finalPrompt);

    const dataUrl = await geminiGenerateImage(finalPrompt, model, signal, styleProof);
    return { dataUrl, prompt: finalPrompt };
  }

  static estimateCost(mode, novelCount, geminiModel) {
    const imageCount = mode === 'A' ? 1 : novelCount;
    const isFreeTier = geminiModel.startsWith('gemini-');
    const imagenFast = geminiModel.includes('fast');

    const imageCostPerUnit = isFreeTier ? 0 : imagenFast ? 0.02 : 0.04;
    const imageCost = imageCount * imageCostPerUnit;

    return {
      imageCount,
      imageCost,
      label: isFreeTier
        ? `~${imageCount} afbeelding${imageCount !== 1 ? 'en' : ''} (gratis model)`
        : `~${imageCount} afbeelding${imageCount !== 1 ? 'en' : ''}, ~€${imageCost.toFixed(2)}`,
    };
  }
}

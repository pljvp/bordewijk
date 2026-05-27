// story_creator.js — vrije tekst → StoryDef via Claude
import { claudeComplete } from './api.js';

const SPLIT_THRESHOLD = 5000; // tekens; boven deze grens: twee Claude-calls

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'verhaal_' + Date.now();
}

function sanitizeJson(s) {
  s = s.replace(/,(\s*[\]}])/g, '$1');
  s = s.replace(/\}(\s+)\{/g, '},$1{');
  s = s.replace(/"((?:[^"\\]|\\.)*)"/gs,
    (_, v) => '"' + v.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ') + '"');
  return s;
}

function extractJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Geen JSON gevonden in Claude-respons');
  try { return JSON.parse(m[0]); }
  catch { return JSON.parse(sanitizeJson(m[0])); }
}

function extractJsonArray(raw) {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Geen JSON-array gevonden in Claude-respons');
  try { return JSON.parse(m[0]); }
  catch { return JSON.parse(sanitizeJson(m[0])); }
}

// Splits tekst op de dichtstbijzijnde alineagrens na het midden
function splitAtMidpoint(text) {
  if (text.length <= SPLIT_THRESHOLD) return [text, null];
  const mid = Math.floor(text.length / 2);
  const breakIdx = text.indexOf('\n\n', mid);
  if (breakIdx === -1) return [text, null];
  return [text.slice(0, breakIdx).trim(), text.slice(breakIdx).trim()];
}

function normalize(def) {
  def.id = slugify(def.title || 'verhaal');
  def.paragraphs = (def.paragraphs || []).map((p, i) => ({
    id: typeof p.id === 'number' ? p.id : i + 1,
    chapter: p.chapter || 'ch1',
    text: String(p.text || '').trim(),
  })).filter(p => p.text);
  def.chapters = def.chapters?.length ? def.chapters : [{ id: 'ch1', title: '' }];
  def.worldRules = def.worldRules || '';
  def.defaultStyle = def.defaultStyle || { w1: 0.34, w2: 0.33, w3: 0.33, realism: 50 };
  def.sourceUrl = null;
  if (!def.fileCode || !/^[A-Z]{2}$/.test(def.fileCode)) {
    const words = (def.title || '').toUpperCase()
      .replace(/[^A-Z\s]/g, '').split(/\s+/)
      .filter(w => !['DE', 'HET', 'EEN', 'VAN', 'IN', 'OP', 'THE', 'A', 'AN', 'OF'].includes(w))
      .filter(Boolean);
    def.fileCode = ((words[0]?.[0] || 'X') + (words[1]?.[0] || words[0]?.[1] || 'X')).toUpperCase();
  }
  return def;
}

const BASE_PROMPT = (text) => `Je bent een literair redacteur die verhaaltekst omzet naar een gestructureerd StoryDef-JSON-object voor een illustratiegenerator.

VERHAALTEKST:
${text}

Genereer een JSON-object met PRECIES deze structuur (geen andere tekst):
{
  "title": "de verhaaltitel (afleidbaar uit de tekst, of stel er zelf een voor)",
  "author": "auteursnaam of 'Anoniem'",
  "year": null of het jaar als integer,
  "genre": "roman | sf | sprookje | thriller | saga | poëzie | overig",
  "fileCode": "2 hoofdletters voor bestandsnamen (bijv. 'VE' voor Verplaatsing van elementen, 'BS' voor Bolifur Saga)",
  "writerStyle": "3-6 kenmerken van de schrijfstijl, kommagescheiden",
  "worldRules": "Beschrijf in het Engels de vaste visuele wereldregels die ALTIJD van toepassing zijn bij beeldgeneratie: bijzondere locaties, tijdperk, technologie, kledingstijl, atmosfeer. Wees concreet en beeldend. Minimaal 3 zinnen.",
  "chapters": [{"id": "ch1", "title": "hoofdstuktitel"}],
  "paragraphs": [{"id": 1, "chapter": "ch1", "text": "alineatekst zonder §-nummers"}],
  "defaultStyle": {"w1": 0.34, "w2": 0.33, "w3": 0.33, "realism": 50}
}

Regels:
- Splits de tekst op in zinvolle, zelfstandig leesbare alinea's
- Elke alinea krijgt een uniek oplopend numeriek id (1, 2, 3, …)
- Schrijf GEEN §-nummers of alinea-nummers in de tekst zelf
- Als er hoofdstukken zijn, maak ze herkenbaar in chapters[] en wijs elk paragraaf de juiste chapter-id toe
- Als er geen duidelijke hoofdstukken zijn, gebruik één hoofdstuk: {"id": "ch1", "title": ""}
- fileCode: kies 2 onderscheidende hoofdletters afgeleid van de titel (initialen van kernwoorden, NIET "DE"/"HET"/"EEN")
- defaultStyle: kies w1/w2/w3 die passen bij de sfeer (w1=gouden eeuw, w2=jugendstil, w3=magisch realisme); zorg dat ze optellen tot 1.0
- Antwoord UITSLUITEND met het JSON-object`;

const CONTINUATION_PROMPT = (text, startId, chapters) => `Je bent een literair redacteur. Zet onderstaande verhaaltekst om naar een JSON-array van alinea-objecten.

VERHAALTEKST (tweede helft):
${text}

Beschikbare hoofdstukken: ${JSON.stringify(chapters)}

Regels:
- Begin met id ${startId} en tel oplopend verder
- Wijs elk alinea de juiste chapter-id toe op basis van de inhoud
- Schrijf GEEN §-nummers in de tekst zelf
- Antwoord UITSLUITEND met een JSON-array: [{"id": ${startId}, "chapter": "chX", "text": "..."}, ...]`;

export async function generateStoryDef(text, signal) {
  const [firstHalf, secondHalf] = splitAtMidpoint(text);

  // — Eerste call: metadata + paragrafen van eerste helft —
  const raw1 = await claudeComplete([{ role: 'user', content: BASE_PROMPT(firstHalf) }], '', signal, 16000);

  let def;
  try {
    def = extractJson(raw1);
  } catch (parseErr) {
    const e = new Error(`JSON-fout (deel 1): ${parseErr.message}`);
    e.rawResponse = raw1;
    throw e;
  }

  normalize(def);

  // — Tweede call: alleen paragrafen van tweede helft —
  if (secondHalf) {
    const startId = (def.paragraphs.at(-1)?.id ?? 0) + 1;
    const raw2 = await claudeComplete(
      [{ role: 'user', content: CONTINUATION_PROMPT(secondHalf, startId, def.chapters) }],
      '', signal, 16000
    );

    let extraParas;
    try {
      extraParas = extractJsonArray(raw2);
    } catch (parseErr) {
      const e = new Error(`JSON-fout (deel 2): ${parseErr.message}`);
      e.rawResponse = raw2;
      throw e;
    }

    const normalized = extraParas
      .map((p, i) => ({
        id: typeof p.id === 'number' ? p.id : startId + i,
        chapter: p.chapter || def.chapters.at(-1)?.id || 'ch1',
        text: String(p.text || '').trim(),
      }))
      .filter(p => p.text);

    def.paragraphs = [...def.paragraphs, ...normalized];
  }

  return def;
}

// storage.js — centrale localStorage-toegang voor Novelizer

const P = 'nv_';

// Actief verhaal-ID — beïnvloedt verhaalspecifieke sleutels en wordt gepersisteerd
let _storyId = localStorage.getItem('nv_active_story') || 'bordewijk_verplaatsing';
export function setActiveStoryId(id) {
  _storyId = id;
  localStorage.setItem('nv_active_story', id);
}
export function getActiveStoryId() { return _storyId; }

// Globale sleutel (API-sleutels, instellingen, enz.)
export function get(key) { return localStorage.getItem(P + key); }
export function set(key, value) { localStorage.setItem(P + key, value); }
export function remove(key) { localStorage.removeItem(P + key); }

// Verhaalspecifieke sleutel: nv_{storyId}_{key}
function sk(key) { return `${P}${_storyId}_${key}`; }
function sget(key)        { return localStorage.getItem(sk(key)); }
function sset(key, value) { localStorage.setItem(sk(key), value); }
function srem(key)        { localStorage.removeItem(sk(key)); }

export function clear() {
  Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => localStorage.removeItem(k));
}

export function getClaudeKey() { return get('key_claude') || ''; }
export function setClaudeKey(v) { set('key_claude', v); }

export function getGeminiKey() { return get('key_gemini') || ''; }
export function setGeminiKey(v) { set('key_gemini', v); }

export function getGeminiModel() {
  return get('model_gemini') || 'gemini-3.1-flash-image-preview';
}
export function setGeminiModel(v) { set('model_gemini', v); }

export function getStyle() {
  try { return JSON.parse(get('style')); } catch { return null; }
}
export function setStyle(s) { set('style', JSON.stringify(s)); }

export function getDefaultStyle() {
  return { w1: 1/3, w2: 1/3, w3: 1/3, realism: 50 };
}

export function getMode() { return get('mode') || 'A'; }
export function setMode(v) { set('mode', v); }

export function getNovelCount() { return parseInt(get('novel_count')) || 6; }
export function setNovelCount(v) { set('novel_count', String(v)); }

export function getBCount() { return parseInt(get('b_count')) || 4; }
export function setBCount(v) { set('b_count', String(v)); }

export function getTextOpts() {
  try { return JSON.parse(get('text_opts')) || {}; } catch { return {}; }
}
export function setTextOpts(v) { set('text_opts', JSON.stringify(v)); }

export function getGenerationStrategy() { return get('gen_strategy') || 'sequential'; }
export function setGenerationStrategy(v) { set('gen_strategy', v); }

export function getDebugMode() { return get('debug') === 'true'; }
export function setDebugMode(v) { set('debug', v ? 'true' : 'false'); }

export function getSceneSource(mode) { return get(`scene_src_${mode}`) || 'claude'; }
export function setSceneSource(mode, v) { set(`scene_src_${mode}`, v); }

export function getShowParaNums() { return get('show_para_nums') !== 'false'; }
export function setShowParaNums(v) { set('show_para_nums', v ? 'true' : 'false'); }

// ─── Consistentieprofiel [verhaalspecifiek] ────────────────────────────────
export function getConsistency() { return sget('consistency') || ''; }
export function setConsistency(v) { sset('consistency', v); }
export function clearConsistency() { srem('consistency'); }

// ISO-tijdstempel van laatste aanmaak ("" als nog niet gegenereerd)
export function getConsistencyTs() { return sget('consistency_ts') || ''; }
export function setConsistencyTs(v) { sset('consistency_ts', v); }

// ─── Stijlproef [verhaalspecifiek] ────────────────────────────────────────
export function getStyleProof() { return sget('style_proof') || ''; }
export function setStyleProof(v) { sset('style_proof', v); }
export function clearStyleProof() { srem('style_proof'); }

// ─── Karakteruiterlijk [verhaalspecifiek] ─────────────────────────────────
export function getCharAppearances() { return sget('char_appearances') || ''; }
export function setCharAppearances(v) { sset('char_appearances', v); }
export function clearCharAppearances() { srem('char_appearances'); }

// ─── Karakterreferentie-afbeelding genereren (optioneel, default aan) ───────
export function getCalibrationEnabled() { return get('calibration') !== 'false'; }
export function setCalibrationEnabled(v) { set('calibration', v ? 'true' : 'false'); }

// ─── Stripstijl-invloed ────────────────────────────────────────────────────
export function getStripStyle() { return get('strip_style') || ''; }
export function setStripStyle(v) { set('strip_style', v); }

// ─── Segmentgrenzen [verhaalspecifiek] ────────────────────────────────────
// Grens op positie N = splitsing na §N (voor de eerstvolgende gemarkeerde § na N)
// N is altijd een gemarkeerd paragraaf-ID.
export function getSegmentBoundaries() {
  try { return new Set(JSON.parse(sget('seg_bounds')) || []); } catch { return new Set(); }
}
export function setSegmentBoundaries(s) { sset('seg_bounds', JSON.stringify([...s])); }

// ─── Intra-paragraaf splitsingen [verhaalspecifiek] ───────────────────────
// { [paraId]: sentenceIndex } — splitsing na zin sentenceIndex (0-gebaseerd)
export function getIntraSplits() {
  try { return JSON.parse(sget('intra_splits')) || {}; } catch { return {}; }
}
export function setIntraSplits(v) { sset('intra_splits', JSON.stringify(v)); }

// ─── Markeringen [verhaalspecifiek] ───────────────────────────────────────
export function getMarks() {
  try { return JSON.parse(sget('marks')) || []; } catch { return []; }
}
export function setMarks(m) { sset('marks', JSON.stringify(m)); }

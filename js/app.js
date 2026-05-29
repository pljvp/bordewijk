// app.js — initialisatie, event-wiring, instellingen-modal

import * as storage from './storage.js';
import { TriangleWidget } from './widget_triangle.js';
import { StoryView } from './story_view.js';
import { Generator, VERSION } from './generator.js';
import { OutputView } from './output.js';
import { testClaudeConnection, testGeminiConnection } from './api.js';
import { getLibraryStories, addUserStory, getActiveStory } from './story_library.js';
import { generateStoryDef } from './story_creator.js';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app-version').textContent = VERSION;
  document.getElementById('over-version').textContent = VERSION.replace(/^v/, '');
  document.title = `Novelizer ${VERSION}`;

  // Actief verhaal is al persistent in storage (defaults naar DEFAULT_STORY_ID)

  // Ververs = stijlproef wissen (stijl-afhankelijk visueel anker).
  // Consistentieprofiel blijft bewaard — het verhaal verandert nooit.
  // API-sleutels blijven bewaard.
  storage.clearStyleProof();

  // ─── Initialiseer modules ──────────────────────────────────────────────────

  const storyView = new StoryView({
    textEl:       document.getElementById('story-text'),
    searchEl:     document.getElementById('search-input'),
    prevBtn:      document.getElementById('search-prev'),
    nextBtn:      document.getElementById('search-next'),
    clearBtn:     document.getElementById('search-clear'),
    countEl:      document.getElementById('search-count'),
    showNumsToggle: document.getElementById('toggle-para-nums'),
  });

  const triangleWidget = new TriangleWidget(document.getElementById('triangle-container'));
  const generator = new Generator();
  const outputView = new OutputView(document.getElementById('output-container'));
  const _activeStory = getActiveStory();
  storyView.setStory(_activeStory);
  generator.setStory(_activeStory);
  outputView.setStory(_activeStory);

  // HerGeneratie-callback: roept generator aan voor één afbeelding
  outputView.onRegenerate(async ({ data, correctionNote, onResult, onError }) => {
    try {
      _debugLog(`HerGeneratie gestart: "${correctionNote || '(geen bijsturing)'}"`);
      const { dataUrl, prompt } = await generator.regenerateScene({
        scene:          data.scene,
        style:          data.style,
        stripStyle:     storage.getStripStyle(),
        correctionNote,
      });
      onResult(dataUrl, prompt);
      _debugLog(`HerGeneratie gereed. Prompt:\n${prompt}`);
    } catch (err) {
      onError(err.message || 'Onbekende fout bij herGeneratie');
      _debugLog(`HerGeneratie mislukt: ${err.message}`);
    }
  });

  // ─── Laad persistente staat ────────────────────────────────────────────────

  let style = storage.getStyle() || storage.getDefaultStyle();
  triangleWidget.setWeights(style.w1, style.w2, style.w3);
  document.getElementById('realism-slider').value = style.realism;

  let currentMode = storage.getMode();
  _setMode(currentMode);

  document.getElementById('novel-count').value = storage.getNovelCount();
  document.getElementById('b-count').value = storage.getBCount();

  const stripStyleSelect = document.getElementById('strip-style-select');
  if (stripStyleSelect) stripStyleSelect.value = storage.getStripStyle();

  const textOpts = storage.getTextOpts();
  document.getElementById('opt-caption').checked   = !!textOpts.caption;
  document.getElementById('opt-balloon').checked   = !!textOpts.balloon;
  document.getElementById('opt-sidetext').checked  = !!textOpts.sidetext;

  // Scene source radios
  ['A', 'B', 'C'].forEach(m => {
    const src = storage.getSceneSource(m);
    const radio = document.querySelector(`[name="scene-src-${m}"][value="${src}"]`);
    if (radio) radio.checked = true;
  });

  _updateMarksPreview(storyView.getMarkedParagraphs(), currentMode);
  _updateCostEstimate();
  _updateConsistencyStatus();
  _updateStyleProofStatus();
  _renderStoryLibrary();
  _updateHeaderStoryLink();

  // Debug mode
  const _debugToolbar = document.getElementById('debug-toolbar');
  if (new URLSearchParams(location.search).get('dev') === '1' || storage.getDebugMode()) {
    document.getElementById('debug-panel').classList.add('visible');
    _debugToolbar.classList.add('visible');
    document.body.classList.add('is-dev');
  }

  // ─── Triangle → style sync ─────────────────────────────────────────────────

  triangleWidget.onChange(([w1, w2, w3]) => {
    style = { ...style, w1, w2, w3 };
    storage.setStyle(style);
    _updateCostEstimate();
    _clearStyleProofIfStale();
  });

  // ─── Realism slider ────────────────────────────────────────────────────────

  const realismSlider = document.getElementById('realism-slider');

  realismSlider.addEventListener('input', () => {
    const v = parseInt(realismSlider.value);
    style = { ...style, realism: v };
    storage.setStyle(style);
    _clearStyleProofIfStale();
  });

  if (stripStyleSelect) {
    stripStyleSelect.addEventListener('change', () => {
      storage.setStripStyle(stripStyleSelect.value);
      _clearStyleProofIfStale();
    });
  }

  // ─── Mode selector ─────────────────────────────────────────────────────────

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _setMode(btn.dataset.mode);
    });
  });

  document.getElementById('novel-count').addEventListener('change', e => {
    storage.setNovelCount(e.target.value);
    _updateCostEstimate();
  });

  document.getElementById('b-count').addEventListener('change', e => {
    storage.setBCount(e.target.value);
    _updateCostEstimate();
  });

  // ─── Scene source radios ───────────────────────────────────────────────────

  document.querySelectorAll('[name^="scene-src-"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const m = radio.name.replace('scene-src-', '');
      storage.setSceneSource(m, radio.value);
      _updateBCountVisibility();
      _updateMarksPreview(storyView.getMarkedParagraphs(), currentMode);
      _updateCostEstimate();
    });
  });

  // ─── Marks callbacks ───────────────────────────────────────────────────────

  storyView.onMarksChange(marks => {
    _updateMarksPreview(marks, currentMode);
    _updateCostEstimate();
  });

  document.getElementById('btn-clear-marks').addEventListener('click', () => {
    storyView.clearAllMarks();
  });

  document.getElementById('btn-select-all-C').addEventListener('click', () => {
    storyView.selectAllMarks();
  });

  document.getElementById('btn-clear-marks-C').addEventListener('click', () => {
    storyView.clearAllMarks();
  });

  document.getElementById('btn-clear-output').addEventListener('click', () => {
    outputView.clearOutput();
  });

  // ─── Voorbeelden ──────────────────────────────────────────────────────────

  let _exampleSeries = null;
  document.getElementById('btn-examples').addEventListener('click', async () => {
    if (!_exampleSeries) {
      try {
        const res = await fetch('voorbeeld/index.json');
        const data = await res.json();
        _exampleSeries = data.series;
      } catch {
        _exampleSeries = [];
      }
    }
    outputView.showExamplePicker(_exampleSeries, series => {
      outputView.loadExamples(series);
      _autoOpenOutput();
    });
  });

  // ─── Text options ──────────────────────────────────────────────────────────

  ['caption', 'balloon', 'sidetext'].forEach(key => {
    document.getElementById(`opt-${key}`).addEventListener('change', () => {
      const opts = storage.getTextOpts();
      opts[key] = document.getElementById(`opt-${key}`).checked;
      storage.setTextOpts(opts);
    });
  });

  // ─── Generate ──────────────────────────────────────────────────────────────

  const btnGenerate = document.getElementById('btn-generate');
  const btnStop     = document.getElementById('btn-stop');
  let generating = false;

  btnGenerate.addEventListener('click', async () => {
    if (!_checkKeys()) return;

    generating = true;
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Bezig…';
    btnStop.style.display = 'block';
    _logBuffer.length = 0;
    document.getElementById('debug-panel').innerHTML = '';

    outputView.setMode(currentMode, parseInt(document.getElementById('novel-count').value));

    const sceneSource = document.querySelector(`[name="scene-src-${currentMode}"]:checked`)?.value || 'claude';

    let _total = 0;

    generator
      .on('consistency-start', () => {
        outputView.showConsistencyProgress();
        _setStatus('Consistentieprofiel ophalen (Claude)…');
        _debugLog('Consistentieprofiel genereren…');
      })
      .on('consistency-ready', ({ consistency }) => {
        outputView.hideConsistencyProgress();
        _setStatus('');
        _updateConsistencyStatus();
        _debugLog(`Consistentieprofiel gereed:\n${consistency}`);
      })
      .on('calibration-start', () => {
        outputView.showCalibrationProgress();
        _setStatus('Karakterreferentie genereren (Gemini)…');
        _debugLog('Karakterreferentie genereren…');
      })
      .on('calibration-image', ({ dataUrl, charNames, onDecide }) => {
        outputView.showCalibrationImage(dataUrl, onDecide, charNames);
        _updateStyleProofStatus();
        _setStatus(onDecide ? 'Karakterreferentie gereed — keur goed of genereer opnieuw.' : '');
        _debugLog('Karakterreferentie gereed — wacht op goedkeuring.');
      })
      .on('calibration-error', ({ message }) => {
        outputView.hideCalibrationProgress();
        _setStatus('');
        _debugLog(`Karakterreferentie mislukt: ${message}`);
      })
      .on('scenes-start', ({ label }) => {
        _setStatus(label);
        _debugLog(`Scènes ophalen: ${label}`);
      })
      .on('status', ({ label }) => {
        _setStatus(label);
        _debugLog(label);
      })
      .on('style-proof-set', ({ index }) => {
        _updateStyleProofStatus();
        _debugLog(`Stijlproef auto-ingesteld op afbeelding ${index + 1}`);
      })
      .on('start', ({ total, mode }) => {
        _total = total;
        _setStatus(`Afbeelding 1 van ${total} genereren (Gemini)…`);
        _debugLog(`Generatie gestart: modus ${mode}, ${total} afbeelding(en)`);
      })
      .on('progress', ({ index, total, title }) => {
        outputView.showProgress(index, total, title);
        _setStatus(`Afbeelding ${index + 1} van ${total} genereren (Gemini)…`);
        _debugLog(`Afbeelding ${index + 1} van ${total}: ${title}`);
      })
      .on('image', data => {
        _autoOpenOutput();
        outputView.addImage(data);
        _debugLog(`Afbeelding ${data.index + 1} gereed. Prompt:\n${data.prompt}`);
      })
      .on('image-error', ({ index, message, scene }) => {
        outputView.addError(index, _total, message, scene);
        _debugLog(`Afbeelding ${index + 1} mislukt: ${message}`);
      })
      .on('error', ({ message }) => {
        outputView.addError(0, _total, message);
        _setStatus('');
      })
      .on('done', () => {
        outputView.showDone(currentMode !== 'A');
        _setStatus('');
        generating = false;
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Genereer';
        btnStop.style.display = 'none';
        generator._handlers = {};
      });

    await generator.generate({
      mode: currentMode,
      style: { ...style },
      marks: storyView.getMarkedParagraphs(),
      segments: storyView.getSegments(),
      sceneSource,
      textOpts: storage.getTextOpts(),
      novelCount: parseInt(document.getElementById('novel-count').value),
      bCount: parseInt(document.getElementById('b-count').value),
      stripStyle: storage.getStripStyle(),
    });
  });

  btnStop.addEventListener('click', () => {
    generator.stop();
    generating = false;
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Genereer';
    _enableTestBtns();
    btnStop.style.display = 'none';
    _setStatus('');
    generator._handlers = {};
  });

  // ─── Stijltest ────────────────────────────────────────────────────────────

  const btnTestStyles     = document.getElementById('btn-test-styles');
  const btnTestGoudenEeuw = document.getElementById('btn-test-goudeneeuw');
  const btnTestStripstijl = document.getElementById('btn-test-stripstijl');

  const _allTestBtns = [btnTestStyles, btnTestGoudenEeuw, btnTestStripstijl];
  const _disableTestBtns = () => _allTestBtns.forEach(b => { b.disabled = true; });
  const _enableTestBtns  = () => _allTestBtns.forEach(b => { b.disabled = false; });

  btnTestStyles.addEventListener('click', async () => {
    if (!_checkKeys()) return;
    generating = true;
    btnGenerate.disabled = true;
    _disableTestBtns();
    btnStop.style.display = 'block';

    outputView.setMode('B', 3);

    generator
      .on('consistency-start', () => {
        outputView.showConsistencyProgress();
        _debugLog('Consistentieprofiel genereren…');
      })
      .on('consistency-ready', ({ consistency }) => {
        outputView.hideConsistencyProgress();
        _updateConsistencyStatus();
        _debugLog(`Consistentieprofiel gereed`);
      })
      .on('start', ({ total }) => {
        _debugLog(`Stijltest gestart: ${total} varianten`);
      })
      .on('progress', ({ index, total, title }) => {
        outputView.showProgress(index, total, title);
      })
      .on('image', data => {
        _autoOpenOutput();
        outputView.addImage(data);
        _debugLog(`Stijltest variant ${data.index + 1} gereed.\nPrompt:\n${data.prompt}`);
      })
      .on('image-error', ({ index, message }) => {
        outputView.addError(index, 3, message);
      })
      .on('error', ({ message }) => {
        outputView.addError(0, 3, message);
      })
      .on('done', () => {
        outputView.showDone(true);
        generating = false;
        btnGenerate.disabled = false;
        _enableTestBtns();
        btnStop.style.display = 'none';
        generator._handlers = {};
      });

    await generator.generateStyleTest();
  });

  // ─── Gouden Eeuw uitvoeringstest ─────────────────────────────────────────────

  btnTestGoudenEeuw.addEventListener('click', async () => {
    if (!_checkKeys()) return;
    generating = true;
    btnGenerate.disabled = true;
    _disableTestBtns();
    btnStop.style.display = 'block';

    outputView.setMode('B', 5);
    outputView.showConsistencyProgress();

    const _resetGoudenEeuwButtons = () => {
      generating = false;
      btnGenerate.disabled = false;
      _enableTestBtns();
      btnStop.style.display = 'none';
      generator._handlers = {};
    };

    generator
      .on('consistency-start', () => {
        _debugLog('Consistentieprofiel genereren…');
      })
      .on('consistency-ready', ({ consistency }) => {
        _updateConsistencyStatus();
        _debugLog('Consistentieprofiel gereed');
      })
      .on('start', ({ total }) => {
        outputView.hideConsistencyProgress();
        _debugLog(`Gouden Eeuw-test gestart: ${total} varianten`);
      })
      .on('progress', ({ index, total, title }) => {
        outputView.showProgress(index, total, title);
      })
      .on('image', data => {
        _autoOpenOutput();
        outputView.addImage(data);
        _debugLog(`Gouden Eeuw-test variant ${data.index + 1} gereed.\nPrompt:\n${data.prompt}`);
      })
      .on('image-error', ({ index, message }) => {
        outputView.addError(index, 5, message);
      })
      .on('error', ({ message }) => {
        outputView.addError(0, 5, message);
      })
      .on('done', () => {
        outputView.showDone(true);
        _resetGoudenEeuwButtons();
      });

    try {
      await generator.generateGoudenEeuwTest();
    } catch (err) {
      outputView.addError(0, 5, err.message);
      _resetGoudenEeuwButtons();
    }
  });

  // ─── Stripstijltest ──────────────────────────────────────────────────────────

  btnTestStripstijl.addEventListener('click', async () => {
    if (!_checkKeys()) return;
    generating = true;
    btnGenerate.disabled = true;
    _disableTestBtns();
    btnStop.style.display = 'block';

    outputView.setMode('B', 8);
    // Show immediate feedback — hides once the generator emits 'start'
    outputView.showConsistencyProgress();

    const testSceneSource = document.querySelector('[name="scene-src-A"]:checked')?.value || 'claude';
    const testMarks = storyView.getMarkedParagraphs();

    const _resetStripstijlButtons = () => {
      generating = false;
      btnGenerate.disabled = false;
      _enableTestBtns();
      btnStop.style.display = 'none';
      generator._handlers = {};
    };

    generator
      .on('consistency-start', () => {
        _debugLog('Consistentieprofiel genereren…');
      })
      .on('consistency-ready', ({ consistency }) => {
        _updateConsistencyStatus();
        _debugLog('Consistentieprofiel gereed');
      })
      .on('start', ({ total }) => {
        outputView.hideConsistencyProgress();
        _debugLog(`Stripstijltest gestart: ${total} varianten`);
      })
      .on('progress', ({ index, total, title }) => {
        outputView.showProgress(index, total, title);
      })
      .on('image', data => {
        _autoOpenOutput();
        outputView.addImage(data);
        _debugLog(`Stripstijltest variant ${data.index + 1} gereed.\nPrompt:\n${data.prompt}`);
      })
      .on('image-error', ({ index, message }) => {
        outputView.addError(index, 8, message);
      })
      .on('error', ({ message }) => {
        outputView.addError(0, 8, message);
      })
      .on('done', () => {
        outputView.showDone(true);
        _resetStripstijlButtons();
      });

    try {
      await generator.generateStripStyleTest(testSceneSource, testMarks);
    } catch (err) {
      outputView.addError(0, 8, err.message);
      _resetStripstijlButtons();
    }
  });

  // ─── Settings modal ────────────────────────────────────────────────────────

  const modal = document.getElementById('modal-settings');

  // Tab switching in modal
  modal.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      modal.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    _populateModal();
    modal.classList.remove('hidden');
  });

  document.getElementById('modal-close').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Auto-save API keys on input
  document.getElementById('key-claude').addEventListener('input', e => {
    storage.setClaudeKey(e.target.value.trim());
  });
  document.getElementById('key-gemini').addEventListener('input', e => {
    storage.setGeminiKey(e.target.value.trim());
  });
  document.getElementById('gemini-model').addEventListener('change', e => {
    storage.setGeminiModel(e.target.value);
    _updateCostEstimate();
  });
  document.getElementById('gen-strategy').addEventListener('change', e => {
    storage.setGenerationStrategy(e.target.value);
  });
  document.getElementById('debug-toggle').addEventListener('change', e => {
    storage.setDebugMode(e.target.checked);
    document.getElementById('debug-panel').classList.toggle('visible', e.target.checked);
    _debugToolbar.classList.toggle('visible', e.target.checked);
  });
  document.getElementById('calibration-toggle').addEventListener('change', e => {
    storage.setCalibrationEnabled(e.target.checked);
  });

  // Test buttons
  document.getElementById('btn-test-claude').addEventListener('click', async function() {
    const key = document.getElementById('key-claude').value.trim();
    this.textContent = '…';
    const ok = await testClaudeConnection(key).catch(() => false);
    this.textContent = ok ? '✓ OK' : '✗ Fout';
    this.className = `btn-test ${ok ? 'ok' : 'fail'}`;
    setTimeout(() => { this.textContent = 'Test'; this.className = 'btn-test'; }, 3000);
  });

  document.getElementById('btn-test-gemini').addEventListener('click', async function() {
    const key = document.getElementById('key-gemini').value.trim();
    this.textContent = '…';
    const ok = await testGeminiConnection(key).catch(() => false);
    this.textContent = ok ? '✓ OK' : '✗ Fout';
    this.className = `btn-test ${ok ? 'ok' : 'fail'}`;
    setTimeout(() => { this.textContent = 'Test'; this.className = 'btn-test'; }, 3000);
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!confirm('Wis alle API-sleutels, instellingen en markeringen?')) return;
    storage.clear();
    storyView.clearAllMarks();
    modal.classList.add('hidden');
    location.reload();
  });

  // ─── Consistentieprofiel ───────────────────────────────────────────────────

  document.getElementById('btn-gen-consistency').addEventListener('click', async function () {
    if (!_checkKeys()) return;
    this.disabled = true;
    this.textContent = 'Bezig…';
    try {
      const profile = await generator.generateConsistencyProfile();
      storage.setConsistency(profile);
      storage.setConsistencyTs(new Date().toISOString());
      _updateConsistencyStatus();
      _debugLog(`Consistentieprofiel handmatig vernieuwd:\n${profile}`);
    } catch (err) {
      alert(`Fout bij genereren consistentieprofiel: ${err.message}`);
    } finally {
      this.disabled = false;
      this.textContent = 'Genereer profiel';
    }
  });

  document.getElementById('btn-clear-consistency').addEventListener('click', () => {
    storage.clearConsistency();
    storage.clearCharAppearances();
    storage.setConsistencyTs('');
    _updateConsistencyStatus();
  });

  // ─── Stijlproef ───────────────────────────────────────────────────────────

  document.getElementById('btn-clear-style-proof').addEventListener('click', () => {
    storage.clearStyleProof();
    _updateStyleProofStatus();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function _updateBCountVisibility() {
    const src = document.querySelector('[name="scene-src-B"]:checked')?.value || 'claude';
    const show = currentMode === 'B' && src !== 'marks';
    document.getElementById('b-count-row').style.display = show ? 'flex' : 'none';
  }

  function _setMode(mode) {
    currentMode = mode;
    storage.setMode(mode);
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (mode === 'C' && !storyView.getMarkedParagraphs().length) {
      storyView.selectAllMarks();
    }
    _updateBCountVisibility();
    document.getElementById('novel-count-row').style.display = mode === 'C' ? 'flex' : 'none';
    document.getElementById('scene-sel-A').style.display = mode === 'A' ? 'block' : 'none';
    document.getElementById('scene-sel-B').style.display = mode === 'B' ? 'block' : 'none';
    document.getElementById('scene-sel-C').style.display = mode === 'C' ? 'block' : 'none';
    _updateMarksPreview(storyView.getMarkedParagraphs(), mode);
    _updateCostEstimate();
  }

  function _formatMarksCompact(marks) {
    if (!marks.length) return '';
    const sorted = [...marks].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `§${start}` : `§${start}–${end}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? `§${start}` : `§${start}–${end}`);
    return ranges.join(', ');
  }

  function _updateMarksPreview(marks, mode) {
    const previewA = document.getElementById('marks-preview-A');
    const previewB = document.getElementById('marks-preview-B');
    const previewC = document.getElementById('marks-preview-C');
    const footer   = document.getElementById('marks-footer-summary');
    let text, textC, footerText;
    if (!marks.length) {
      text       = 'Geen markeringen — klik op §-nummers in het verhaal.';
      textC      = 'Geen selectie — volledig verhaal wordt gebruikt.';
      footerText = 'Geen markeringen';
    } else {
      const segs    = storyView.getSegments();
      const segInfo = segs.length > 1 ? ` → ${segs.length} segmenten` : '';
      const compact = _formatMarksCompact(marks);
      text       = `${compact} (${marks.length}§${segInfo})`;
      textC      = text;
      footerText = `Markeringen: ${compact} (${marks.length}§${segInfo})`;
    }
    if (previewA) previewA.textContent = text;
    if (previewB) previewB.textContent = text;
    if (previewC) previewC.textContent = textC;
    if (footer)   footer.textContent   = footerText;
  }

  function _clearStyleProofIfStale() {
    if (storage.getStyleProof()) {
      storage.clearStyleProof();
      _updateStyleProofStatus();
    }
  }

  function _updateCostEstimate() {
    let count;
    if (currentMode === 'B') {
      const sceneSource = document.querySelector('[name="scene-src-B"]:checked')?.value || 'claude';
      if (sceneSource === 'marks') {
        const segs = storyView.getSegments();
        count = segs.length || (parseInt(document.getElementById('b-count').value) || 4);
      } else {
        count = parseInt(document.getElementById('b-count').value) || 4;
      }
    } else {
      count = parseInt(document.getElementById('novel-count').value) || 6;
    }
    const model = storage.getGeminiModel();
    const est = Generator.estimateCost(currentMode, count, model);
    document.getElementById('cost-estimate').textContent = est.label;
  }

  function _checkKeys() {
    if (!storage.getClaudeKey()) {
      _populateModal();
      modal.classList.remove('hidden');
      document.getElementById('key-claude').focus();
      return false;
    }
    if (!storage.getGeminiKey()) {
      _populateModal();
      modal.classList.remove('hidden');
      document.getElementById('key-gemini').focus();
      return false;
    }
    return true;
  }

  function _populateModal() {
    document.getElementById('key-claude').value  = storage.getClaudeKey();
    document.getElementById('key-gemini').value  = storage.getGeminiKey();
    document.getElementById('gemini-model').value = storage.getGeminiModel();
    document.getElementById('gen-strategy').value = storage.getGenerationStrategy();
    document.getElementById('debug-toggle').checked = storage.getDebugMode();
    document.getElementById('calibration-toggle').checked = storage.getCalibrationEnabled();
    _updateConsistencyStatus();
    _updateStyleProofStatus();
  }

  function _updateConsistencyStatus() {
    const el = document.getElementById('consistency-status');
    if (!el) return;
    const profile = storage.getConsistency();
    const ts = storage.getConsistencyTs();
    if (profile) {
      const when = ts ? new Date(ts).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '?';
      const escaped = profile.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      el.className = 'consistency-status has-profile';
      el.innerHTML = `<span>✓ Profiel aanwezig (${when})</span>
        <details style="margin-top:6px">
          <summary style="cursor:pointer;font-size:10px;color:var(--text-muted)">Bekijk profiel ▾</summary>
          <pre style="margin:6px 0 0;font-size:9px;line-height:1.5;white-space:pre-wrap;max-height:200px;overflow-y:auto;background:var(--bg-deep);padding:6px;border-radius:3px;border:1px solid var(--border)">${escaped}</pre>
        </details>`;
    } else {
      el.textContent = 'Geen profiel — wordt automatisch aangemaakt bij eerste generatie.';
      el.className = 'consistency-status';
    }
  }

  function _updateStyleProofStatus() {
    const label = document.getElementById('style-proof-label');
    const thumb = document.getElementById('style-proof-thumb');
    if (!label || !thumb) return;
    const proof = storage.getStyleProof();
    if (proof) {
      label.textContent = '✓ Stijlproef ingesteld';
      thumb.src = proof;
      thumb.style.display = 'block';
    } else {
      label.textContent = 'Geen stijlproef — wordt automatisch ingesteld op de eerste afbeelding.';
      thumb.style.display = 'none';
    }
  }

  function _autoOpenOutput() {
    if (!window.matchMedia('(max-width:768px)').matches) return;
    const output = document.querySelector('.col-output');
    if (!output || output.dataset.open === 'true') return;
    // Accordion: sluit andere secties, open output
    document.querySelectorAll('section[data-open]').forEach(s => { s.dataset.open = 'false'; });
    output.dataset.open = 'true';
  }

  function _setStatus(text) {
    const el = document.getElementById('generate-status');
    if (el) el.textContent = text;
  }

  const _logBuffer = [];

  function _debugLog(msg) {
    const ts = new Date().toLocaleTimeString();
    _logBuffer.push(`[${ts}] ${msg}`);
    const panel = document.getElementById('debug-panel');
    if (!panel.classList.contains('visible')) return;
    const line = document.createElement('div');
    line.textContent = `[${ts}] ${msg}`;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  }

  document.getElementById('debug-dl-btn').addEventListener('click', () => {
    if (!_logBuffer.length) return;
    const now = new Date();
    const ts = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const blob = new Blob([_logBuffer.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `debug_${ts}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  });

  document.getElementById('debug-clear-btn').addEventListener('click', () => {
    _logBuffer.length = 0;
    const panel = document.getElementById('debug-panel');
    panel.innerHTML = '';
  });

  // ─── Verhaalbibliotheek ────────────────────────────────────────────────────

  function _renderStoryLibrary() {
    const list = document.getElementById('story-library-list');
    if (!list) return;
    const activeId = storage.getActiveStoryId();
    list.innerHTML = '';
    getLibraryStories().forEach(storyDef => {
      const card = document.createElement('div');
      const isEmpty = !storyDef.paragraphs.length;
      card.className = 'story-card' + (storyDef.id === activeId ? ' active' : '') + (isEmpty ? ' story-card-placeholder' : '');
      card.innerHTML = `<div class="story-card-title">${storyDef.title}</div>
        <div class="story-card-meta">${storyDef.author}${storyDef.year ? ' · ' + storyDef.year : ''}${storyDef.genre && storyDef.genre !== '—' ? ' · ' + storyDef.genre : ''}</div>`;
      if (!isEmpty) {
        card.addEventListener('click', () => _switchStory(storyDef));
      }
      list.appendChild(card);
    });
  }

  function _updateHeaderStoryLink() {
    const story = getActiveStory();
    if (!story) return;
    const h1 = document.getElementById('header-story-sub');
    const h2 = document.getElementById('header-story-title');
    if (h1) h1.textContent = `ode aan ${story.author}`;
    if (h2) {
      const label = `${story.title}${story.year ? ' (' + story.year + ')' : ''}`;
      h2.innerHTML = story.sourceUrl
        ? `<a href="${story.sourceUrl}" target="_blank" rel="noopener">${label}</a>`
        : label;
    }
  }

  function _switchStory(storyDef) {
    if (storyDef.id === storage.getActiveStoryId()) return;
    generator.stop();
    storage.setActiveStoryId(storyDef.id);
    generator.setStory(storyDef);
    storyView.setStory(storyDef);
    outputView.setStory(storyDef);
    outputView.clearOutput();
    storage.clearStyleProof();
    _updateConsistencyStatus();
    _updateStyleProofStatus();
    _updateMarksPreview(storyView.getMarkedParagraphs(), currentMode);
    _updateCostEstimate();
    _renderStoryLibrary();
    _updateHeaderStoryLink();
    _debugLog(`Verhaal gewisseld naar: ${storyDef.id}`);
  }

  // ─── Story creator modal ───────────────────────────────────────────────────

  let _creatorLastDef = null;
  let _creatorLastRaw = null;
  let _creatorAc = null;

  function _openCreatorModal() {
    document.getElementById('creator-modal').classList.remove('hidden');
    document.getElementById('creator-input').focus();
  }
  function _closeCreatorModal() {
    document.getElementById('creator-modal').classList.add('hidden');
    _creatorAc?.abort();
    _creatorAc = null;
  }

  document.getElementById('btn-new-story').addEventListener('click', _openCreatorModal);
  document.getElementById('creator-close').addEventListener('click', _closeCreatorModal);
  document.getElementById('creator-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeCreatorModal();
  });

  document.getElementById('btn-creator-generate').addEventListener('click', async () => {
    const text = document.getElementById('creator-input').value.trim();
    if (!text) return;
    const btn = document.getElementById('btn-creator-generate');
    const statusEl = document.getElementById('creator-status');
    const exportBtn = document.getElementById('btn-creator-export');

    _creatorAc?.abort();
    _creatorAc = new AbortController();

    btn.disabled = true;
    btn.textContent = 'Genereren…';
    statusEl.className = 'creator-status';
    statusEl.textContent = 'Claude verwerkt de tekst…';
    exportBtn.disabled = true;
    _creatorLastRaw = null;

    try {
      const def = await generateStoryDef(text, _creatorAc.signal);
      _creatorLastDef = def;
      addUserStory(def);
      _switchStory(def);
      _renderStoryLibrary();
      exportBtn.disabled = false;
      document.getElementById('btn-creator-save-js').disabled = false;
      statusEl.className = 'creator-status ok';
      statusEl.textContent = `Verhaal aangemaakt: "${def.title}" (${def.paragraphs.length} §§)`;
      _debugLog(`Story creator: "${def.title}" — ${def.paragraphs.length} paragrafen`);
    } catch (err) {
      if (err.name === 'AbortError') return;
      statusEl.className = 'creator-status error';
      if (err.rawResponse) {
        _creatorLastRaw = err.rawResponse;
        exportBtn.disabled = false;
        statusEl.textContent = `Fout: ${err.message} — gebruik ↓ Exporteer JSON om de ruwe tekst te downloaden en handmatig te repareren.`;
      } else {
        statusEl.textContent = `Fout: ${err.message}`;
      }
      _debugLog(`Story creator fout: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Genereer storydata (Claude)';
    }
  });

  document.getElementById('btn-creator-export').addEventListener('click', () => {
    if (!_creatorLastDef && !_creatorLastRaw) return;
    const isRaw = !_creatorLastDef && _creatorLastRaw;
    const content = isRaw ? _creatorLastRaw : JSON.stringify(_creatorLastDef, null, 2);
    const filename = isRaw ? 'raw_response.txt' : `${_creatorLastDef.id}.json`;
    const type = isRaw ? 'text/plain' : 'application/json';
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  });

  document.getElementById('creator-import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('creator-status');
    try {
      const text = await file.text();
      const def = JSON.parse(text);
      if (!def.title || !Array.isArray(def.paragraphs)) throw new Error('Ongeldig StoryDef-formaat');
      def.id = def.id || def.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
      _creatorLastDef = def;
      addUserStory(def);
      _switchStory(def);
      _renderStoryLibrary();
      document.getElementById('btn-creator-export').disabled = false;
      document.getElementById('btn-creator-save-js').disabled = false;
      statusEl.className = 'creator-status ok';
      statusEl.textContent = `Geïmporteerd: "${def.title}" (${def.paragraphs.length} §§)`;
    } catch (err) {
      statusEl.className = 'creator-status error';
      statusEl.textContent = `Import mislukt: ${err.message}`;
    }
    e.target.value = '';
  });

  document.getElementById('btn-creator-save-js').addEventListener('click', () => {
    if (!_creatorLastDef) return;
    const js = _formatStoryDefAsJs(_creatorLastDef);
    console.log(`%c// Kopieer onderstaande inhoud naar js/stories/${_creatorLastDef.id}.js\n`, 'color:#b8860b;font-weight:bold');
    console.log(js);
    const statusEl = document.getElementById('creator-status');
    navigator.clipboard?.writeText(js).then(
      () => { statusEl.className = 'creator-status ok'; statusEl.textContent = 'JS gekopieerd naar klembord + geprint in console.'; },
      () => { statusEl.className = 'creator-status ok'; statusEl.textContent = 'JS geprint in console (klembord niet beschikbaar).'; }
    ) ?? (statusEl.className = 'creator-status ok', statusEl.textContent = 'JS geprint in console.');
  });
});

function _formatStoryDefAsJs(def) {
  const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const q   = v => v === null || v === undefined ? 'null' : JSON.stringify(v);
  const ds  = def.defaultStyle || {};

  const chapLines = (def.chapters || [])
    .map(c => `    { id: ${q(c.id)}, title: ${q(c.title)} },`)
    .join('\n');

  const paraLines = (def.paragraphs || [])
    .map(p => `    { id: ${p.id}, chapter: ${q(p.chapter)}, text: ${q(p.text)} },`)
    .join('\n');

  return `// js/stories/${def.id}.js — StoryDef
// ${def.title} — ${def.author}

export default {
  id: ${q(def.id)},
  title: ${q(def.title)},
  author: ${q(def.author)},
  year: ${q(def.year)},
  genre: ${q(def.genre || 'overig')},
  fileCode: ${q(def.fileCode || 'XX')},
  writerStyle: ${q(def.writerStyle || '')},
  sourceUrl: ${q(def.sourceUrl)},
  defaultStyle: { w1: ${ds.w1 ?? 0.34}, w2: ${ds.w2 ?? 0.33}, w3: ${ds.w3 ?? 0.33}, realism: ${ds.realism ?? 50} },

  worldRules: \`${esc(def.worldRules || '')}\`,

  chapters: [
${chapLines}
  ],

  paragraphs: [
${paraLines}
  ],
};
`;
}

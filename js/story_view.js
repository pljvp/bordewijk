// story_view.js — verhaalweergave, zoeken, markeren, segmentering

import bordewijkStory from './stories/bordewijk_verplaatsing.js';
import * as storage from './storage.js';

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Splits tekst in zinnen op .!? gevolgd door spatie of einde
function splitSentences(text) {
  const parts = [];
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    if ('.!?'.includes(text[i])) {
      // kijk of dit echt een zinsgrens is (gevolgd door spatie + hoofdletter of einde)
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

export class StoryView {
  constructor(opts) {
    this._textEl         = opts.textEl;
    this._searchEl       = opts.searchEl;
    this._prevBtn        = opts.prevBtn;
    this._nextBtn        = opts.nextBtn;
    this._clearBtn       = opts.clearBtn;
    this._countEl        = opts.countEl;
    this._showNumsToggle = opts.showNumsToggle;

    this._story          = bordewijkStory;
    this._marks          = new Set(storage.getMarks());
    this._boundaries     = new Set(storage.getSegmentBoundaries());
    this._intraSplits    = storage.getIntraSplits(); // { [paraId]: sentenceIndex }
    this._marksCallbacks = [];
    this._searchQuery    = '';
    this._searchHits     = [];
    this._searchIdx      = 0;
    this._dragStart      = null;
    this._dragRange      = new Set();
    this._showNums       = storage.getShowParaNums();

    // Long press drag state
    this._lpTimer             = null;
    this._lpParaId            = null;
    this._lpSentences         = null;
    this._lpCurrentIdx        = null;
    this._lpMoveHandler       = null; // non-passive touch handler
    this._lpMouseMoveHandler  = null; // mouse drag handler
    this._lpMouseUpHandler    = null; // mouse up handler
    this._lpWasActive         = false; // voorkomt click-na-longpress

    this._render();
    this._bindEvents();
    this._applyMarks();
  }

  // ── Publieke API ────────────────────────────────────────────────────────────

  getMarkedParagraphs() {
    return [...this._marks].sort((a, b) => a - b);
  }

  getSegments() {
    return this._computeSegments();
  }

  onMarksChange(cb) {
    this._marksCallbacks.push(cb);
  }

  setStory(storyDef) {
    this._story      = storyDef;
    this._marks      = new Set(storage.getMarks());
    this._boundaries = new Set(storage.getSegmentBoundaries());
    this._intraSplits = storage.getIntraSplits();
    this._searchQuery = '';
    this._searchHits  = [];
    this._searchIdx   = 0;
    if (this._searchEl) this._searchEl.value = '';
    if (this._countEl)  this._countEl.textContent = '';
    this._render();
    this._applyMarks();
    this._marksCallbacks.forEach(cb => cb(this.getMarkedParagraphs()));
  }

  clearAllMarks() {
    this._marks.clear();
    this._boundaries.clear();
    this._intraSplits = {};
    this._saveAll();
    this._applyMarks();
  }

  selectAllMarks() {
    this._story.paragraphs.forEach(p => this._marks.add(p.id));
    this._saveAll();
    this._applyMarks();
  }

  scrollToParagraph(id) {
    document.getElementById(`para-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Opslaan ─────────────────────────────────────────────────────────────────

  _saveAll() {
    storage.setMarks([...this._marks]);
    storage.setSegmentBoundaries(this._boundaries);
    storage.setIntraSplits(this._intraSplits);
    this._notify();
  }

  _notify() {
    this._marksCallbacks.forEach(cb => cb(this.getMarkedParagraphs()));
  }

  // ── Segmenten ───────────────────────────────────────────────────────────────

  _computeSegments() {
    const sorted = [...this._marks].sort((a, b) => a - b);
    if (!sorted.length) return [];

    const segments = [];
    let group = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (this._boundaries.has(prev)) {
        // boundary after prev → flush group, start new
        segments.push(...this._groupToSegments(group));
        group = [curr];
      } else {
        group.push(curr);
      }
    }
    segments.push(...this._groupToSegments(group));
    return segments;
  }

  // Zet een groep (array van paragraaf-IDs die samensmelten) om naar segment-objecten.
  // Als een paragraaf een intra-split heeft → twee segmenten.
  _groupToSegments(group) {
    const results = [];
    for (const paraId of group) {
      const splitAt = this._intraSplits[paraId];
      if (splitAt !== undefined) {
        // Dit paragraaf staat alleen (intra-split trumpt merge)
        results.push({ paras: [paraId], textSlice: 'first',  splitAt });
        results.push({ paras: [paraId], textSlice: 'second', splitAt });
      } else if (results.length > 0 && results[results.length - 1].textSlice === undefined) {
        // Voeg samen met vorige segment in deze groep
        results[results.length - 1].paras.push(paraId);
      } else {
        results.push({ paras: [paraId] });
      }
    }
    return results;
  }

  // ── Boundaries updaten bij mark-wijzigingen ─────────────────────────────────

  _onMarkAdded(id) {
    const sorted = [...this._marks].sort((a, b) => a - b);
    const idx = sorted.indexOf(id);
    // Voeg grens toe na de vorige gemarkeerde § (scheidt hem van id)
    if (idx > 0) this._boundaries.add(sorted[idx - 1]);
    // Voeg grens toe na id zelf (scheidt id van de volgende gemarkeerde §)
    if (idx < sorted.length - 1) this._boundaries.add(id);
  }

  _onMarkRemoved(id) {
    // De grens NA id vervalt (die koppeling bestaat niet meer)
    this._boundaries.delete(id);
    // Verwijder ook eventuele intra-split
    delete this._intraSplits[id];
  }

  // ── DOM renderen ─────────────────────────────────────────────────────────────

  _render() {
    let html = '';
    let lastChapter = null;

    for (const para of this._story.paragraphs) {
      if (para.chapter !== lastChapter) {
        const ch = this._story.chapters.find(c => c.id === para.chapter);
        if (ch) html += `<div class="chapter-heading">${escHtml(ch.title)}</div>`;
        lastChapter = para.chapter;
      }
      html += `<div class="para-row" data-id="${para.id}" id="para-${para.id}">
        <span class="para-num" data-id="${para.id}">&sect;${para.id}</span>
        <span class="para-body" data-id="${para.id}">${escHtml(para.text)}</span>
      </div>`;
    }

    this._textEl.innerHTML = html;
    if (this._showNumsToggle) this._showNumsToggle.checked = this._showNums;
    this._applyShowNums();
  }

  _applyShowNums() {
    this._textEl.querySelectorAll('.para-num').forEach(el => {
      el.style.visibility = this._showNums ? 'visible' : 'hidden';
    });
  }

  _applyMarks() {
    this._textEl.querySelectorAll('.para-row').forEach(row => {
      const id = parseInt(row.dataset.id);
      row.classList.toggle('marked', this._marks.has(id));
      row.querySelector('.para-num')?.classList.toggle('marked', this._marks.has(id));
    });
    this._updateSearchHighlight();
    this._applyBoundaries();
  }

  // ── Boundaries in de DOM ────────────────────────────────────────────────────

  _applyBoundaries() {
    // Verwijder alle bestaande boundary-elementen
    this._textEl.querySelectorAll('.seg-cap, .seg-between, .seg-intra').forEach(el => el.remove());

    const sorted = [...this._marks].sort((a, b) => a - b);
    if (!sorted.length) return;

    // Bereken per gemarkeerde § welke buren hij heeft
    for (let i = 0; i < sorted.length; i++) {
      const id      = sorted[i];
      const prevMk  = i > 0 ? sorted[i - 1] : null;
      const nextMk  = i < sorted.length - 1 ? sorted[i + 1] : null;
      const paraEl  = document.getElementById(`para-${id}`);
      if (!paraEl) continue;

      const isAdjPrev = prevMk !== null && prevMk === id - 1;
      const isAdjNext = nextMk !== null && nextMk === id + 1;

      // ── Top cap (alleen als er geen aangrenzende gemarkeerde § boven is) ───
      if (!isAdjPrev) {
        const div = document.createElement('div');
        div.className = 'seg-cap seg-cap-top';
        div.dataset.id = id;
        if (prevMk !== null) {
          // Niet-aangrenzend, maar er is een vorige gemarkeerde §
          const merged = !this._boundaries.has(prevMk);
          div.classList.add(merged ? 'is-merged' : 'is-split');
          if (merged) {
            div.innerHTML = `<button class="seg-btn seg-remove" data-pos="${prevMk}" title="Herscheiden">−</button>`;
          }
        }
        paraEl.insertAdjacentElement('beforebegin', div);
      }

      // ── Bottom cap (alleen als er geen aangrenzende gemarkeerde § onder is) ─
      if (!isAdjNext) {
        const div = document.createElement('div');
        div.className = 'seg-cap seg-cap-bottom';
        div.dataset.id = id;
        if (nextMk !== null) {
          // Niet-aangrenzend, maar er is een volgende gemarkeerde §
          const merged = !this._boundaries.has(id);
          div.classList.add(merged ? 'is-merged' : 'is-split');
          if (merged) {
            div.innerHTML = `<button class="seg-btn seg-remove" data-pos="${id}" title="Herscheiden">−</button>`;
          }
        }
        paraEl.insertAdjacentElement('afterend', div);
      }

      // ── Between: één element tussen aangrenzende gemarkeerde §§ ───────────
      if (isAdjNext) {
        const isSplit = this._boundaries.has(id);
        const div = document.createElement('div');
        div.className = `seg-between ${isSplit ? 'is-split' : 'is-merged'}`;
        div.dataset.pos = id;
        if (isSplit) {
          div.innerHTML = `<button class="seg-btn seg-remove" data-pos="${id}" title="Samenvoegen">−</button>`;
        } else {
          div.innerHTML = `<button class="seg-btn seg-add" data-pos="${id}" title="Opsplitsen">+</button>`;
        }
        paraEl.insertAdjacentElement('afterend', div);
      }

      // ── Intra-split binnen de paragraaf ────────────────────────────────────
      this._renderIntraSplit(id);
    }
  }

  _renderIntraSplit(paraId) {
    const paraEl = document.getElementById(`para-${paraId}`);
    if (!paraEl) return;
    // Verwijder oude intra-split elementen voor dit paragraaf
    paraEl.querySelectorAll('.seg-intra').forEach(el => el.remove());

    const splitAt = this._intraSplits[paraId];
    const bodyEl  = paraEl.querySelector('.para-body');
    if (!bodyEl) return;

    const para = this._story.paragraphs.find(p => p.id === paraId);
    if (!para) return;

    if (splitAt === undefined) {
      bodyEl.classList.remove('has-split');
      bodyEl.innerHTML = escHtml(para.text);
      return;
    }

    const sentences = splitSentences(para.text);
    if (sentences.length < 2) return;

    bodyEl.classList.add('has-split');
    const firstHalf  = sentences.slice(0, splitAt + 1).join(' ');
    const secondHalf = sentences.slice(splitAt + 1).join(' ');
    bodyEl.innerHTML =
      `<span class="seg-half">${escHtml(firstHalf)}</span>` +
      `<div class="seg-intra-bar" data-id="${paraId}">` +
        `<span class="seg-intra-grip" data-id="${paraId}" title="Sleep om te herpositioneren">⠿</span>` +
        `<button class="seg-btn seg-intra-remove" data-id="${paraId}" title="Splitsing verwijderen">−</button>` +
      `</div>` +
      `<span class="seg-half">${escHtml(secondHalf)}</span>`;
  }

  // ── Marks wijzigen ──────────────────────────────────────────────────────────

  _toggleMark(id) {
    if (this._marks.has(id)) {
      this._marks.delete(id);
      this._onMarkRemoved(id);
    } else {
      this._marks.add(id);
      this._onMarkAdded(id);
    }
    this._saveAll();
    this._applyMarks();
  }

  _setRangeMark(ids, value) {
    const sorted = [...ids].sort((a, b) => a - b);

    if (value) {
      sorted.forEach(id => {
        this._marks.add(id);
        // Tijdelijk toevoegen zodat _onMarkAdded correcte sorted-volgorde ziet
      });
      // Stel grenzen in na het toevoegen van alle IDs
      const allSorted = [...this._marks].sort((a, b) => a - b);
      for (let i = 0; i < allSorted.length - 1; i++) {
        // Standaard: elke § is zijn eigen segment
        this._boundaries.add(allSorted[i]);
      }
      // Maar: §§ die aan de grenzen van het bereik liggen hoeven niet
      // nogmaals te worden gesplitst als ze al apart waren
    } else {
      sorted.forEach(id => {
        this._marks.delete(id);
        this._boundaries.delete(id);
        delete this._intraSplits[id];
      });
    }

    this._saveAll();
    this._applyMarks();
  }

  // ── Boundary-knoppen afhandelen ─────────────────────────────────────────────

  _handleBoundaryBtn(btn) {
    if (btn.classList.contains('seg-intra-remove')) {
      const paraId = parseInt(btn.dataset.id);
      delete this._intraSplits[paraId];
      this._saveAll();
      this._renderIntraSplit(paraId);
      // Herstel originele tekst
      const paraEl = document.getElementById(`para-${paraId}`);
      const bodyEl = paraEl?.querySelector('.para-body');
      if (bodyEl) {
        const para = this._story.paragraphs.find(p => p.id === paraId);
        if (para) bodyEl.innerHTML = escHtml(para.text);
      }
      return;
    }

    const pos = parseInt(btn.dataset.pos);

    if (btn.classList.contains('seg-remove')) {
      this._boundaries.delete(pos);
      this._saveAll();
      this._applyBoundaries();
      return;
    }
    if (btn.classList.contains('seg-add')) {
      this._boundaries.add(pos);
      this._saveAll();
      this._applyBoundaries();
      return;
    }
  }

  // ── Long press: intra-paragraaf splitsing ───────────────────────────────────

  _startLongPress(id, touchY) {
    if (!this._marks.has(id)) return;
    const para = this._story.paragraphs.find(p => p.id === id);
    if (!para) return;
    const sentences = splitSentences(para.text);
    if (sentences.length < 2) return;

    this._lpParaId    = id;
    this._lpSentences = sentences;
    this._lpCurrentIdx = this._intraSplits[id] !== undefined
      ? this._intraSplits[id]
      : 0;

    // Bereken initiële positie op basis van waar de vinger zit
    this._moveLpDrag(touchY);

    this._lpWasActive = true;

    // Non-passive touchmove: voorkomt scrollen tijdens touch-drag
    this._lpMoveHandler = e => {
      e.preventDefault();
      this._moveLpDrag(e.touches[0].clientY);
    };
    this._textEl.addEventListener('touchmove', this._lpMoveHandler, { passive: false });

    // Mouse drag handlers voor desktop
    this._lpMouseMoveHandler = e => this._moveLpDrag(e.clientY);
    this._lpMouseUpHandler   = () => { this._removeLpHandlers(); this._commitLpDrag(); };
    window.addEventListener('mousemove', this._lpMouseMoveHandler);
    window.addEventListener('mouseup',   this._lpMouseUpHandler);
  }

  _renderLpDrag(paraId) {
    const paraEl = document.getElementById(`para-${paraId}`);
    const bodyEl = paraEl?.querySelector('.para-body');
    if (!bodyEl || !this._lpSentences) return;

    bodyEl.classList.add('has-split');
    const sentences = this._lpSentences;
    const splitIdx  = this._lpCurrentIdx;

    // Render elke zin als aparte span zodat we hun Y-positie kunnen meten
    let html = '';
    for (let i = 0; i < sentences.length; i++) {
      if (i === splitIdx + 1) {
        html += `<div class="seg-intra-bar" data-id="${paraId}"><span class="seg-intra-grip" data-id="${paraId}">⠿</span></div>`;
      }
      html += `<span class="seg-sentence" data-idx="${i}">${escHtml(sentences[i])}</span>`;
      if (i < sentences.length - 1) html += ' ';
    }
    bodyEl.innerHTML = html;
  }

  _moveLpDrag(clientY) {
    if (this._lpParaId === null || !this._lpSentences) return;
    const paraEl = document.getElementById(`para-${this._lpParaId}`);
    const bodyEl = paraEl?.querySelector('.para-body');
    if (!paraEl || !bodyEl) return;

    const maxIdx      = this._lpSentences.length - 2;
    const sentenceEls = [...bodyEl.querySelectorAll('.seg-sentence')];

    let newIdx;
    if (!sentenceEls.length) {
      // Eerste aanroep — nog geen zinnen in DOM, gebruik para-rect als schatting
      const rect = paraEl.getBoundingClientRect();
      newIdx = Math.round(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) * maxIdx);
    } else {
      // Zoek het zinnengrens-gap dat het dichtst bij de cursor zit
      newIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i <= maxIdx; i++) {
        const el   = sentenceEls[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        // Grens na zin i = onderkant van zin i
        const gapY = rect.bottom;
        const dist = Math.abs(clientY - gapY);
        if (dist < minDist) { minDist = dist; newIdx = i; }
      }
    }

    this._lpCurrentIdx = Math.max(0, Math.min(maxIdx, newIdx));
    this._renderLpDrag(this._lpParaId);
  }

  _removeLpHandlers() {
    if (this._lpMoveHandler) {
      this._textEl.removeEventListener('touchmove', this._lpMoveHandler);
      this._lpMoveHandler = null;
    }
    if (this._lpMouseMoveHandler) {
      window.removeEventListener('mousemove', this._lpMouseMoveHandler);
      this._lpMouseMoveHandler = null;
    }
    if (this._lpMouseUpHandler) {
      window.removeEventListener('mouseup', this._lpMouseUpHandler);
      this._lpMouseUpHandler = null;
    }
  }

  _commitLpDrag() {
    if (this._lpParaId === null) return;
    const paraId = this._lpParaId;
    const idx    = this._lpCurrentIdx;

    this._removeLpHandlers();
    this._lpParaId     = null;
    this._lpSentences  = null;
    this._lpCurrentIdx = null;

    this._intraSplits[paraId] = idx;
    this._saveAll();
    this._renderIntraSplit(paraId);
  }

  _cancelLpDrag() {
    if (this._lpParaId === null) return;
    const paraId = this._lpParaId;

    this._removeLpHandlers();
    this._lpParaId     = null;
    this._lpSentences  = null;
    this._lpCurrentIdx = null;

    // _renderIntraSplit herstelt correct op basis van _intraSplits (ook has-split klasse)
    this._renderIntraSplit(paraId);
  }

  // ── Events koppelen ─────────────────────────────────────────────────────────

  _bindEvents() {
    // Klikken: boundary-knoppen + paragraaf-toggle
    this._textEl.addEventListener('click', e => {
      // Altijd als eerste: swallow de click na een long press (voorkomt directe verwijdering)
      if (this._lpWasActive) { this._lpWasActive = false; return; }

      const btn = e.target.closest('.seg-btn');
      if (btn) { this._handleBoundaryBtn(btn); return; }

      if (!e.target.closest('.para-body')) return;
      if (window.getSelection().toString()) return;
      const row = e.target.closest('.para-row');
      if (!row) return;
      this._toggleMark(parseInt(row.dataset.id));
    });

    // Grip-handle: direct drag starten (geen 500ms wacht)
    this._textEl.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const handle = e.target.closest('.seg-intra-grip');
      if (handle) {
        e.preventDefault();
        const paraId = parseInt(handle.dataset.id);
        this._startLongPress(paraId, e.clientY);
        return;
      }
      // Desktop long press (mousedown 500ms) voor nieuwe intra-splitsing
      if (e.target.closest('.seg-intra-bar, .seg-btn, .para-num')) return;
      if (!e.target.closest('.para-body')) return;
      const row = e.target.closest('.para-row');
      if (!row) return;
      const id = parseInt(row.dataset.id);
      this._lpTimer = setTimeout(() => {
        this._lpTimer = null;
        this._startLongPress(id, e.clientY);
      }, 500);
    });

    // Grip-handle: touch drag starten
    this._textEl.addEventListener('touchstart', e => {
      const handle = e.target.closest('.seg-intra-grip');
      if (!handle) return;
      e.preventDefault();
      const paraId = parseInt(handle.dataset.id);
      this._startLongPress(paraId, e.touches[0].clientY);
    }, { passive: false });

    // §-nummer slepen voor reeks
    this._textEl.addEventListener('mousedown', e => {
      const numEl = e.target.closest('.para-num');
      if (!numEl) return;
      e.preventDefault();
      const id = parseInt(numEl.dataset.id);
      this._dragStart = id;
      this._dragRange = new Set([id]);
    });

    this._textEl.addEventListener('mousemove', e => {
      if (this._dragStart === null) return;
      const numEl = e.target.closest('.para-num');
      if (!numEl) return;
      const id  = parseInt(numEl.dataset.id);
      const min = Math.min(this._dragStart, id);
      const max = Math.max(this._dragStart, id);
      this._dragRange = new Set();
      for (let i = min; i <= max; i++) this._dragRange.add(i);
      this._textEl.querySelectorAll('.para-row').forEach(row => {
        row.classList.toggle('drag-preview', this._dragRange.has(parseInt(row.dataset.id)));
      });
    });

    window.addEventListener('mouseup', e => {
      // Annuleer desktop long-press timer als die nog loopt
      if (this._lpTimer) { clearTimeout(this._lpTimer); this._lpTimer = null; }
      if (this._dragStart === null) return;
      this._textEl.querySelectorAll('.para-row').forEach(r => r.classList.remove('drag-preview'));

      if (this._dragRange.size <= 1) {
        this._toggleMark(this._dragStart);
      } else {
        const anyUnmarked = [...this._dragRange].some(id => !this._marks.has(id));
        this._setRangeMark([...this._dragRange], anyUnmarked);
      }
      this._dragStart = null;
      this._dragRange = new Set();
    });

    // Long press touch — intra-paragraaf splitsing via drag
    this._textEl.addEventListener('touchstart', e => {
      // Niet triggeren op de marker/grip of op knoppen
      if (e.target.closest('.seg-intra-bar, .seg-intra-grip, .seg-btn')) return;
      const row = e.target.closest('.para-row');
      if (!row) return;
      const id = parseInt(row.dataset.id);
      const touch = e.touches[0];

      this._lpTimer = setTimeout(() => {
        this._lpTimer = null;
        this._startLongPress(id, touch.clientY);
      }, 500);
    }, { passive: true });

    this._textEl.addEventListener('touchmove', () => {
      // Lang-indruk timer annuleren bij scrollen (voor drag is een aparte non-passive handler)
      clearTimeout(this._lpTimer);
      this._lpTimer = null;
    }, { passive: true });

    this._textEl.addEventListener('touchend', () => {
      clearTimeout(this._lpTimer);
      this._lpTimer = null;
      if (this._lpParaId !== null) {
        this._commitLpDrag();
      }
    }, { passive: true });

    this._textEl.addEventListener('touchcancel', () => {
      clearTimeout(this._lpTimer);
      this._lpTimer = null;
      this._cancelLpDrag();
    }, { passive: true });

    // Zoeken
    this._searchEl?.addEventListener('input', () => {
      this._searchQuery = this._searchEl.value.trim();
      this._runSearch();
    });

    this._prevBtn?.addEventListener('click', () => {
      if (!this._searchHits.length) return;
      this._searchIdx = (this._searchIdx - 1 + this._searchHits.length) % this._searchHits.length;
      this._updateSearchHighlight();
      this._scrollToCurrentHit();
    });

    this._nextBtn?.addEventListener('click', () => {
      if (!this._searchHits.length) return;
      this._searchIdx = (this._searchIdx + 1) % this._searchHits.length;
      this._updateSearchHighlight();
      this._scrollToCurrentHit();
    });

    this._clearBtn?.addEventListener('click', () => {
      this._searchEl.value = '';
      this._searchQuery = '';
      this._runSearch();
      this._searchEl.focus();
    });

    this._showNumsToggle?.addEventListener('change', () => {
      this._showNums = this._showNumsToggle.checked;
      storage.setShowParaNums(this._showNums);
      this._applyShowNums();
    });
  }

  // ── Zoeken ──────────────────────────────────────────────────────────────────

  _runSearch() {
    this._searchHits = [];
    this._searchIdx  = 0;
    this._updateSearchHighlight();
    if (this._countEl) this._countEl.textContent = '';

    if (!this._searchQuery) {
      this._textEl.querySelectorAll('.para-body').forEach(el => {
        const para = this._story.paragraphs.find(p => p.id === parseInt(el.dataset.id));
        if (para) el.innerHTML = escHtml(para.text);
      });
      return;
    }

    const re = new RegExp(escRegex(this._searchQuery), 'gi');

    this._textEl.querySelectorAll('.para-body').forEach(el => {
      const para = this._story.paragraphs.find(p => p.id === parseInt(el.dataset.id));
      if (!para) return;
      const escaped = escHtml(para.text);
      if (re.test(para.text)) {
        this._searchHits.push(para.id);
        re.lastIndex = 0;
        el.innerHTML = escaped.replace(
          new RegExp(escRegex(this._searchQuery), 'gi'),
          m => `<mark>${m}</mark>`
        );
      } else {
        el.innerHTML = escaped;
      }
    });

    if (this._countEl) {
      this._countEl.textContent = this._searchHits.length
        ? `${this._searchHits.length} gevonden`
        : 'Geen resultaten';
    }

    this._updateSearchHighlight();
    if (this._searchHits.length) this._scrollToCurrentHit();
  }

  _updateSearchHighlight() {
    const currentId = this._searchHits[this._searchIdx];
    this._textEl.querySelectorAll('.para-row').forEach(row => {
      const id = parseInt(row.dataset.id);
      row.classList.toggle('search-highlight', this._searchHits.includes(id));
      row.classList.toggle('search-current',   id === currentId);
    });
  }

  _scrollToCurrentHit() {
    const id = this._searchHits[this._searchIdx];
    if (!id) return;
    document.getElementById(`para-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// output.js — resultaatweergave, galerij, download PNG/ZIP

// Tekent een label-balk onder de afbeelding met de karakter-namen.
// Geeft een nieuwe dataUrl terug (origineel ongewijzigd).
function _addCharLabels(dataUrl, names) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const fontSize = Math.max(13, Math.round(W / 38));
      const barH = Math.round(fontSize * 2.4);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H + barH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, H, W, barH);
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#cccccc';
      const n = names.length;
      names.forEach((name, i) => {
        ctx.fillText(name, (W / n) * (i + 0.5), H + barH / 2);
      });
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export class OutputView {
  constructor(containerEl) {
    this._el = containerEl;
    this._images = [];  // { index, dataUrl, scene, style, caption, sidetext, filename, prompt }
    this._nextUid = 0;  // monotonically increasing; prevents cross-run index collisions
    this._mode = 'A';
    this._novelCount = 6;
    this._lbEl = null;
    this._lbIndex = -1;
    this._calibrationCard = null;
    this._calibrationDataUrl = null;
    this._regenCb = null;
    this._story = null;
    this._pickerEl = null;
    this._setupLightbox();
    this._clear();
  }

  setStory(storyDef) { this._story = storyDef; }

  // ─── Lightbox ────────────────────────────────────────────────────────────────

  _setupLightbox() {
    const lb = document.createElement('div');
    lb.className = 'lightbox hidden';
    lb.innerHTML = `
      <button class="lb-close" title="Sluiten (Esc)">✕</button>
      <div class="lb-counter"></div>
      <div class="lb-img-wrap">
        <img src="" alt="">
      </div>
      <div class="lb-info">
        <div class="lb-title"></div>
        <div class="lb-caption"></div>
        <div class="lb-style"></div>
      </div>
      <button class="lb-nav lb-prev" title="Vorige (←)">‹</button>
      <button class="lb-nav lb-next" title="Volgende (→)">›</button>
      <button class="lb-dl" title="Download PNG">↓ PNG</button>`;
    document.body.appendChild(lb);
    this._lbEl = lb;

    lb.addEventListener('click', e => { if (e.target === lb) this._closeLightbox(); });
    lb.querySelector('.lb-close').addEventListener('click', () => this._closeLightbox());
    lb.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); this._lbNav(-1); });
    lb.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); this._lbNav(+1); });
    lb.querySelector('.lb-dl').addEventListener('click', e => {
      e.stopPropagation();
      const d = this._images[this._lbIndex];
      if (d) _downloadDataUrl(d.dataUrl, d.filename || `${this._story?.fileCode || 'WK'}_${String(d.index + 1).padStart(3,'0')}.png`);
    });

    document.addEventListener('keydown', e => {
      if (this._lbEl.classList.contains('hidden')) return;
      if (e.key === 'Escape')      this._closeLightbox();
      if (e.key === 'ArrowLeft')   this._lbNav(-1);
      if (e.key === 'ArrowRight')  this._lbNav(+1);
    });
  }

  _openLightbox(index) {
    this._lbIndex = index;
    this._lbRefresh();
    this._lbEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  _closeLightbox() {
    this._lbEl.classList.add('hidden');
    document.body.style.overflow = '';
  }

  _lbNav(dir) {
    const imgs = this._images.filter(Boolean);
    const pos = imgs.findIndex(d => d.index === this._lbIndex);
    const next = imgs[pos + dir];
    if (next) { this._lbIndex = next.index; this._lbRefresh(); }
  }

  _lbRefresh() {
    const d = this._images[this._lbIndex];
    if (!d) return;
    const imgs = this._images.filter(Boolean);
    const pos = imgs.findIndex(x => x.index === this._lbIndex);
    const lb = this._lbEl;

    lb.querySelector('.lb-img-wrap img').src = d.dataUrl;
    lb.querySelector('.lb-title').textContent = d.scene.scene_title || `Scène ${d.index + 1}`;
    lb.querySelector('.lb-caption').textContent = d.caption || '';
    lb.querySelector('.lb-style').textContent =
      `Gouden Eeuw ${Math.round(d.style.w1*100)}% · Jugendstil·Déco ${Math.round(d.style.w2*100)}% · Magisch Realisme ${Math.round(d.style.w3*100)}% · Realisme ${d.style.realism}`;
    lb.querySelector('.lb-counter').textContent = imgs.length > 1 ? `${pos + 1} / ${imgs.length}` : '';
    lb.querySelector('.lb-prev').disabled = pos <= 0;
    lb.querySelector('.lb-next').disabled = pos >= imgs.length - 1;
  }

  // Registreer callback voor herGeneratie: fn({ data, correctionNote, onResult, onError })
  onRegenerate(cb) { this._regenCb = cb; }

  setMode(mode, novelCount) {
    this._mode = mode;
    this._novelCount = novelCount || 6;
  }

  _clear() {
    this._images = [];
    this._nextUid = 0;
    this._calibrationCard = null;
    this._calibrationDataUrl = null;
    this._el.innerHTML = `
      <div class="output-empty">
        <div class="output-empty-icon">◻</div>
        <p>Kies een modus, stel de stijl in<br>en klik op Genereer.</p>
      </div>`;
  }

  clearOutput() { this._clear(); }

  // ─── Voorbeeld-picker ────────────────────────────────────────────────────────

  showExamplePicker(series, onSelect) {
    if (this._pickerEl) {
      this._pickerEl.remove();
      this._pickerEl = null;
      return;
    }
    const picker = document.createElement('div');
    picker.className = 'example-picker';
    picker.innerHTML = `<div class="example-picker-heading">Kies een serie</div><div class="example-picker-list"></div>`;
    const list = picker.querySelector('.example-picker-list');
    series.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'example-picker-btn';
      btn.textContent = `${s.title} (${s.images.length})`;
      btn.addEventListener('click', () => {
        this._pickerEl?.remove();
        this._pickerEl = null;
        onSelect(s);
      });
      list.appendChild(btn);
    });
    this._pickerEl = picker;
    this._el.parentElement.insertBefore(picker, this._el);
  }

  loadExamples(series) {
    this._clear();
    this.setMode('B', series.images.length);
    const folder = series.folder;
    series.images.forEach((filename) => {
      const url = `voorbeeld/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
      const title = _titleFromFilename(filename);
      this.addImage({
        dataUrl: url,
        scene: { scene_title: title },
        style: { w1: 0, w2: 0, w3: 0, realism: 0 },
        caption: '',
        filename,
        isExample: true,
      });
    });
  }

  showProgress(index, total, title) {
    if (this._el.querySelector('.output-empty')) this._el.innerHTML = '';
    const existing = this._el.querySelector(`[data-progress="${index}"]`);
    if (existing) return;

    const el = document.createElement('div');
    el.className = 'progress-item';
    el.dataset.progress = index;
    el.innerHTML = `
      <div class="spinner"></div>
      <span>${index + 1}/${total} — ${_escHtml(title)}</span>`;
    this._el.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showConsistencyProgress() {
    if (this._el.querySelector('.output-empty')) this._el.innerHTML = '';
    if (this._el.querySelector('#prog-consistency')) return;
    const el = document.createElement('div');
    el.id = 'prog-consistency';
    el.className = 'progress-item progress-consistency';
    el.innerHTML = `<div class="spinner"></div><span>Consistentieprofiel genereren…</span>`;
    this._el.prepend(el);
  }

  hideConsistencyProgress() {
    this._el.querySelector('#prog-consistency')?.remove();
  }

  showCalibrationProgress() {
    if (this._el.querySelector('.output-empty')) this._el.innerHTML = '';
    if (this._el.querySelector('#prog-calibration')) return;
    const el = document.createElement('div');
    el.id = 'prog-calibration';
    el.className = 'progress-item progress-calibration';
    el.innerHTML = `<div class="spinner"></div><span>Karakterreferentie genereren (Gemini)…</span>`;
    this._el.prepend(el);
  }

  hideCalibrationProgress() {
    this._el.querySelector('#prog-calibration')?.remove();
  }

  async showCalibrationImage(dataUrl, onDecide, charNames = []) {
    this.hideCalibrationProgress();
    // Verwijder eventuele vorige kaart (bij ↺ Opnieuw)
    if (this._calibrationCard) { this._calibrationCard.remove(); this._calibrationCard = null; }
    if (this._el.querySelector('.output-empty')) this._el.innerHTML = '';

    // Voeg karakter-naam labels toe als donkere balk onder de afbeelding.
    // De stijlproef die naar Gemini gaat (opgeslagen in generator) blijft zonder tekst.
    const displayUrl = charNames.length ? await _addCharLabels(dataUrl, charNames) : dataUrl;

    const card = document.createElement('div');
    card.className = 'calibration-card';
    card.innerHTML = `
      <div class="calibration-label">Karakterreferentie ✦</div>
      <img alt="Karakterreferentie" class="calibration-img">
      <div class="calibration-footer">
        <button class="calibration-dl" title="Download PNG">↓ PNG</button>
        ${onDecide ? '' : '<button class="calibration-rm" title="Verwijder karakterreferentie">✕ Verwijder</button>'}
      </div>
      ${onDecide ? `<div class="calibration-approval">
        <input class="calib-correction" type="text" maxlength="200"
          placeholder="Optionele bijsturing voor herGeneratie — bijv. 'Drebbel groter', 'jongere Bordemanse', 'minder details'…">
        <div class="calibration-approval-btns">
          <button class="calibration-approve">✓ Goedkeuren — ga verder</button>
          <button class="calibration-regen-btn">↺ Opnieuw genereren</button>
        </div>
      </div>` : ''}`;

    card.querySelector('.calibration-img').src = displayUrl;
    card.querySelector('.calibration-img').addEventListener('click', () => {
      this._openLightboxCalibration(displayUrl);
    });
    card.querySelector('.calibration-dl').addEventListener('click', () => {
      _downloadDataUrl(displayUrl, `${this._story?.fileCode || 'WK'}_${this._makeDatetime()}_000_karakterreferentie.png`);
    });

    if (onDecide) {
      card.querySelector('.calibration-approve').addEventListener('click', () => {
        card.querySelector('.calibration-approval').remove();
        // Voeg delete-knop toe na goedkeuring
        const rmBtn = document.createElement('button');
        rmBtn.className = 'calibration-rm';
        rmBtn.title = 'Verwijder karakterreferentie';
        rmBtn.textContent = '✕ Verwijder';
        rmBtn.addEventListener('click', () => {
          this._calibrationCard = null;
          this._calibrationDataUrl = null;
          card.remove();
        });
        card.querySelector('.calibration-footer').appendChild(rmBtn);
        onDecide('approve');
      });
      card.querySelector('.calibration-regen-btn').addEventListener('click', () => {
        const note = card.querySelector('.calib-correction')?.value.trim() || '';
        // Toon meteen een spinner — showCalibrationImage vervangt de kaart als het klaar is
        this._calibrationCard.remove();
        this._calibrationCard = null;
        this._calibrationDataUrl = null;
        this.showCalibrationProgress();
        onDecide('regen', note);
      });
    } else {
      card.querySelector('.calibration-rm').addEventListener('click', () => {
        this._calibrationCard = null;
        this._calibrationDataUrl = null;
        card.remove();
      });
    }

    this._calibrationCard = card;
    this._calibrationDataUrl = displayUrl;
    this._el.prepend(card);
  }

  _openLightboxCalibration(dataUrl) {
    const lb = this._lbEl;
    lb.querySelector('.lb-img-wrap img').src = dataUrl;
    lb.querySelector('.lb-title').textContent = 'Karakterreferentie';
    lb.querySelector('.lb-caption').textContent = '';
    lb.querySelector('.lb-style').textContent = '';
    lb.querySelector('.lb-counter').textContent = '';
    lb.querySelector('.lb-prev').disabled = true;
    lb.querySelector('.lb-next').disabled = true;
    this._lbIndex = -1;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  addImage(data) {
    this._el.querySelector(`[data-progress="${data.index}"]`)?.remove();

    // Use a session-global uid so images from different runs never overwrite each other.
    const uid = this._nextUid++;
    const stored = { ...data, index: uid };
    this._images[uid] = stored;

    if (this._mode === 'A') {
      this._renderSingle(stored);
    } else if (this._mode === 'B') {
      this._renderGallery();
    } else if (this._mode === 'C') {
      this._renderNovel();
    }
  }

  addError(index, total, message, scene) {
    const prog = this._el.querySelector(`[data-progress="${index}"]`);
    prog?.remove();

    const el = document.createElement('div');
    el.className = 'error-card';

    const label = scene?.panel_number
      ? `Panel ${scene.panel_number}/${total}`
      : `Afbeelding ${index + 1}/${total}`;

    let sceneHtml = '';
    if (scene) {
      const title = scene.scene_title ? `<div class="error-scene-title">${_escHtml(scene.scene_title)}</div>` : '';
      const chars = scene.active_characters?.length
        ? `<div class="error-scene-chars"><em>Karakters:</em> ${_escHtml(scene.active_characters.map(c => c.name).join(', '))}</div>`
        : '';
      const desc = scene.visual_description
        ? `<details class="error-scene-desc"><summary>Visuele beschrijving (voor handmatige retry)</summary><pre>${_escHtml(scene.visual_description)}</pre></details>`
        : '';
      const paras = scene.paragraph_ids?.length
        ? `<div class="error-scene-chars"><em>Paragrafen:</em> ${_escHtml(scene.paragraph_ids.join(', '))}</div>`
        : '';
      sceneHtml = `<div class="error-scene-info">${title}${chars}${paras}${desc}</div>`;
    }

    el.innerHTML = `<strong>${_escHtml(label)} mislukt (ook na retry):</strong> ${_escHtml(message)}${sceneHtml}`;
    this._el.appendChild(el);
  }

  showDone(hasZip) {
    this._el.querySelectorAll('.progress-item').forEach(el => el.remove());

    if (this._el.querySelector('.btn-action-row')) return;

    const storyImages = this._images.filter(Boolean);
    const totalDownloadable = storyImages.length + (this._calibrationDataUrl ? 1 : 0);
    const hasImages = storyImages.length > 0 || this._calibrationDataUrl;
    if (!hasImages) return;

    const row = document.createElement('div');
    row.className = 'btn-action-row';

    if (hasZip && totalDownloadable > 1) {
      const zipBtn = document.createElement('button');
      zipBtn.className = 'btn btn-zip';
      zipBtn.textContent = 'Download als ZIP';
      zipBtn.addEventListener('click', () => this._downloadZip());
      row.appendChild(zipBtn);
    }

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-export-composite';
    exportBtn.textContent = '↓ Exporteer met tekst';
    exportBtn.addEventListener('click', () => this._exportComposite(exportBtn));
    row.appendChild(exportBtn);

    this._el.appendChild(row);
  }

  // ─── Render modes ───────────────────────────────────────────────────────────

  _renderSingle(data) {
    // When images from earlier runs are present, integrate into gallery so
    // card types don't mix (compact gallery + standalone non-compact = layout artifacts).
    if (this._images.filter(Boolean).length > 1) {
      this._renderGallery();
      return;
    }
    this._el.innerHTML = '';
    if (this._calibrationCard) this._el.prepend(this._calibrationCard);
    this._el.appendChild(this._makeCard(data, false));
  }

  _renderGallery() {
    this._el.innerHTML = '';
    if (this._calibrationCard) this._el.prepend(this._calibrationCard);
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    this._images.filter(Boolean).forEach(data => {
      grid.appendChild(this._makeCard(data, true));
    });
    this._el.appendChild(grid);
  }

  _renderNovel() {
    const cols = this._novelCount === 6 ? 2 : 3;
    this._el.innerHTML = '';
    if (this._calibrationCard) this._el.prepend(this._calibrationCard);
    const filled = this._images.filter(Boolean);
    for (let i = 0; i < filled.length; i += cols) {
      const row = document.createElement('div');
      row.className = cols === 2 ? 'gn-grid-2' : 'gn-grid-3';
      for (let j = i; j < Math.min(i + cols, filled.length); j++) {
        row.appendChild(this._makeCard(filled[j], true, true));
      }
      this._el.appendChild(row);
    }
  }

  // ─── Card builder ────────────────────────────────────────────────────────────

  _makeCard(data, compact, isPanel) {
    const { index, dataUrl, scene, style, caption, sidetext, filename, prompt, isExample } = data;
    const title = scene.scene_title || (scene.panel_number
      ? `Panel ${scene.panel_number}`
      : `Scène ${index + 1}`);
    const styleInfo = `Gouden Eeuw ${Math.round(style.w1*100)}% / Jugendstil·Déco ${Math.round(style.w2*100)}% / Magisch Realisme ${Math.round(style.w3*100)}% / Realisme ${style.realism}`;

    const card = document.createElement('div');
    card.className = 'image-card' + (isExample ? ' is-example' : '');
    card.dataset.idx = index;
    if (isPanel && scene.panel_number) card.dataset.panel = scene.panel_number;

    card.innerHTML = `
      <div class="image-card-header">
        <span class="image-card-title">${_escHtml(title)}</span>
        ${isPanel && scene.panel_number ? `<span class="image-card-panel-num">#${scene.panel_number}</span>` : ''}
      </div>
      ${sidetext
        ? `<div class="image-card-body">
            <img src="${dataUrl}" alt="${_escHtml(title)}" loading="lazy">
            <div class="image-card-sidetext">${_escHtml(sidetext)}</div>
          </div>`
        : `<img src="${dataUrl}" alt="${_escHtml(title)}" loading="lazy">`}
      ${caption ? `<div class="image-card-caption">${_escHtml(caption)}</div>` : ''}
      <div class="image-card-footer">
        <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
          <details class="image-card-style-info">
            <summary>Stijl ▾</summary>
            <div style="padding-top:4px">${_escHtml(styleInfo)}</div>
          </details>
          ${prompt ? `<details class="image-card-style-info">
            <summary>Prompt ▾</summary>
            <pre style="margin:4px 0 0;white-space:pre-wrap;font-size:9px;line-height:1.4;max-height:180px;overflow-y:auto">${_escHtml(prompt)}</pre>
          </details>` : ''}
          ${(scene?.composition_directive || scene?.composition_type) ? `<details class="image-card-style-info">
            <summary>Compositie ▾</summary>
            <div style="padding-top:4px;font-size:10px;line-height:1.5">${_escHtml(scene.composition_directive || scene.composition_type)}</div>
          </details>` : ''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn-sm btn-dl">↓ PNG</button>
          ${isExample ? '' : '<button class="btn-sm btn-regen" title="Opnieuw genereren met optionele bijsturing">↺</button>'}
          <button class="btn-sm btn-remove-img" title="Verwijder deze afbeelding" style="color:var(--accent);border-color:rgba(232,89,74,.3)">✕</button>
        </div>
      </div>
      ${isExample ? '' : `<div class="regen-panel">
        <input class="regen-input" type="text" maxlength="200"
          placeholder="Optionele bijsturing — bijv. 'Drebbel links', 'donkerder licht', 'geen fiets'…">
        <div class="regen-actions">
          <button class="btn-sm regen-submit">↺ Genereer</button>
          <button class="btn-sm regen-cancel">Annuleer</button>
        </div>
      </div>`}`;

    const imgEl = card.querySelector('img');
    imgEl.style.cursor = 'zoom-in';
    imgEl.addEventListener('click', () => this._openLightbox(index));

    card.querySelector('.btn-dl').addEventListener('click', () => {
      _downloadDataUrl(dataUrl, filename || `${this._story?.fileCode || 'WK'}_${String(index + 1).padStart(3,'0')}.png`);
    });

    card.querySelector('.btn-remove-img').addEventListener('click', () => {
      this._images[index] = null;
      card.remove();
    });

    card.querySelector('.btn-regen')?.addEventListener('click', () => {
      const panel = card.querySelector('.regen-panel');
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) panel.querySelector('.regen-input').focus();
    });

    card.querySelector('.regen-cancel')?.addEventListener('click', () => {
      card.querySelector('.regen-panel').classList.remove('open');
    });

    card.querySelector('.regen-submit')?.addEventListener('click', () => {
      const correctionNote = card.querySelector('.regen-input').value.trim();
      const submitBtn = card.querySelector('.regen-submit');
      const cancelBtn = card.querySelector('.regen-cancel');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Bezig…';
      cancelBtn.disabled = true;
      this._regenCb?.({
        data,
        correctionNote,
        onResult: (newDataUrl, newPrompt) => {
          card.querySelector('img').src = newDataUrl;
          data.dataUrl = newDataUrl;
          if (newPrompt) {
            data.prompt = newPrompt;
            const preEl = card.querySelector('.image-card-style-info pre');
            if (preEl) preEl.textContent = newPrompt;
          }
          card.querySelector('.regen-panel').classList.remove('open');
          submitBtn.disabled = false;
          submitBtn.textContent = '↺ Genereer';
          cancelBtn.disabled = false;
        },
        onError: (msg) => {
          submitBtn.disabled = false;
          submitBtn.textContent = '↺ Genereer';
          cancelBtn.disabled = false;
          let errEl = card.querySelector('.regen-error');
          if (!errEl) {
            errEl = document.createElement('div');
            errEl.className = 'regen-error';
            card.querySelector('.regen-panel').appendChild(errEl);
          }
          errEl.textContent = msg;
        },
      });
    });

    return card;
  }

  // ─── Composite PNG export ────────────────────────────────────────────────────

  async _exportComposite(btn) {
    const images = this._images.filter(Boolean);
    if (!images.length && !this._calibrationDataUrl) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }

    try {
      const fc = this._story?.fileCode || 'WK';
      const files = [];

      if (this._calibrationDataUrl) {
        const dataUrl = await this._compositeTitlePage();
        files.push({ dataUrl, filename: `${fc}_${this._makeDatetime()}_000_karakterreferentie.png` });
      }

      for (const data of images) {
        const dataUrl = await this._compositePanel(data);
        const origFn = data.filename || `${fc}_${String(data.index + 1).padStart(3,'0')}.png`;
        files.push({ dataUrl, filename: origFn.replace(/\.png$/, '_c.png') });
      }

      if (typeof JSZip !== 'undefined' && files.length > 1) {
        const zip = new JSZip();
        files.forEach(({ dataUrl, filename }) =>
          zip.file(filename, dataUrl.split(',')[1], { base64: true }));
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this._makeZipName(files.length, '_composiet');
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        let delay = 0;
        files.forEach(({ dataUrl, filename }) => {
          setTimeout(() => _downloadDataUrl(dataUrl, filename), delay);
          delay += 300;
        });
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↓ Exporteer met tekst'; }
    }
  }

  async _compositePanel(data) {
    const story = this._story;
    const img = await _loadImg(data.dataUrl);
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;

    const P = 28;
    const titleText = data.scene?.scene_title || `Panel ${data.index + 1}`;
    const bodyText  = data.caption || data.scene?.visual_description || '';
    const footerText = story
      ? `${story.title}  —  ${story.author}${story.year ? '  ·  ' + story.year : ''}`
      : '';

    const mc = document.createElement('canvas');
    const mctx = mc.getContext('2d');
    mctx.font = '15px Georgia, serif';
    const bodyLines = _wrapLines(mctx, bodyText, W - 2 * P);

    const textH = P + 28 + (bodyLines.length ? 14 + bodyLines.length * 22 : 0) + 14 + 18 + P;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H + 2 + textH;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, H, W, 2);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, H + 2, W, textH);

    let y = H + 2 + P;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    ctx.font      = 'bold 20px Georgia, serif';
    ctx.fillStyle = '#f5f0e8';
    ctx.fillText(titleText, P, y);
    y += 28;

    if (bodyLines.length) {
      y += 14;
      ctx.font      = '15px Georgia, serif';
      ctx.fillStyle = '#b8b0a0';
      for (const line of bodyLines) {
        ctx.fillText(line, P, y);
        y += 22;
      }
    }

    y += 14;
    ctx.font      = '12px Arial, sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(footerText, P, y);

    return canvas.toDataURL('image/png');
  }

  async _compositeTitlePage() {
    if (!this._calibrationDataUrl) return null;
    const story = this._story;
    const img = await _loadImg(this._calibrationDataUrl);
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;

    const P = 28;
    const titleText  = story?.title || 'Verhaal';
    const authorText = story
      ? `${story.author}${story.year ? '  ·  ' + story.year : ''}`
      : '';

    const textH = P + 38 + (authorText ? 28 + 10 : 0) + 10 + 20 + P;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H + 2 + textH;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, H, W, 2);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, H + 2, W, textH);

    let y = H + 2 + P;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    ctx.font      = 'bold 28px Georgia, serif';
    ctx.fillStyle = '#f5f0e8';
    ctx.fillText(titleText, P, y);
    y += 38;

    if (authorText) {
      ctx.font      = '20px Georgia, serif';
      ctx.fillStyle = '#b8b0a0';
      ctx.fillText(authorText, P, y);
      y += 28 + 10;
    }

    y += 10;
    ctx.font      = 'italic 14px Georgia, serif';
    ctx.fillStyle = '#555555';
    ctx.fillText('Karakterreferentie', P, y);

    return canvas.toDataURL('image/png');
  }

  // ─── ZIP download ────────────────────────────────────────────────────────────

  _makeDatetime() {
    const now = new Date();
    const d = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const t = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    return `${d}_${t}`;
  }

  _makeZipName(count, suffix = '') {
    const fc   = this._story?.fileCode || 'WK';
    const slug = (this._story?.title || 'verhaal')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '').trim()
      .replace(/\s+/g, '-').slice(0, 40);
    const now  = new Date();
    const date = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    return `${fc}_${slug}_${date}_${count}afb${suffix}.zip`;
  }

  async _downloadZip() {
    const images = this._images.filter(Boolean);
    if (!images.length && !this._calibrationDataUrl) return;

    if (typeof JSZip !== 'undefined') {
      const zip = new JSZip();
      const fc = this._story?.fileCode || 'WK';
      if (this._calibrationDataUrl) {
        zip.file(`${fc}_${this._makeDatetime()}_000_karakterreferentie.png`, this._calibrationDataUrl.split(',')[1], { base64: true });
      }
      for (const data of images) {
        let b64;
        if (data.isExample) {
          try {
            const res = await fetch(data.dataUrl);
            const buf = await res.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            b64 = btoa(bin);
          } catch { continue; }
        } else {
          b64 = data.dataUrl.split(',')[1];
        }
        zip.file(data.filename || `${fc}_${String(data.index + 1).padStart(3,'0')}.png`, b64, { base64: true });
      }
      const count = images.length + (this._calibrationDataUrl ? 1 : 0);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this._makeZipName(count);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      // Fallback: download individually
      let delay = 0;
      if (this._calibrationDataUrl) {
        setTimeout(() => _downloadDataUrl(this._calibrationDataUrl, `${this._story?.fileCode || 'WK'}_${this._makeDatetime()}_000_karakterreferentie.png`), delay);
        delay += 200;
      }
      images.forEach(data => {
        setTimeout(() => _downloadDataUrl(data.dataUrl, data.filename || `${this._story?.fileCode || 'WK'}_${String(data.index + 1).padStart(3,'0')}.png`), delay);
        delay += 200;
      });
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _titleFromFilename(filename) {
  const stem = filename.replace(/\.png$/i, '').replace(/_c$/, '');
  const skip = /^([A-Za-z]{2}|\d{3,6}|s\d.*|r\d.*|c)$/;
  for (const part of stem.split('_')) {
    if (!skip.test(part)) return part.replace(/-/g, ' ');
  }
  return stem.replace(/_/g, ' ');
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function _loadImg(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

function _wrapLines(ctx, text, maxWidth) {
  if (!text) return [];
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

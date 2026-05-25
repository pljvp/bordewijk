// widget_triangle.js — Stijldriehoek SVG-widget (barycentrisch)
// w1 = Gouden Eeuw (amber, linksonder), w2 = Jugendstil·Art Déco (blauw, top), w3 = Magisch Realisme (violet, rechtsonder)

const W = 420, H = 315;
// Triangle vertices in SVG space — triangle centered in the wider viewBox
const VA = { x: 210, y: 34 };   // Jugendstil · Art Déco (top)
const VB = { x: 70,  y: 282 };  // Gouden Eeuw (linksonder)
const VC = { x: 350, y: 282 };  // Magisch Realisme (rechtsonder)

const COL_JUGEND   = { r: 79, g: 141, b: 193, hex: '#4f8dc1' };
const COL_GOUDENEEUW = { r: 184, g: 124, b: 50, hex: '#b87c32' };
const COL_MAGISCHREALISME = { r: 123, g: 94, b: 167, hex: '#7b5ea7' };

function baryToCart(w1, w2, w3) {
  return {
    x: w1 * VB.x + w2 * VA.x + w3 * VC.x,
    y: w1 * VB.y + w2 * VA.y + w3 * VC.y,
  };
}

function cartToBary(px, py) {
  const det = (VA.y - VC.y) * (VB.x - VC.x) + (VC.x - VA.x) * (VB.y - VC.y);
  let w1 = ((VA.y - VC.y) * (px - VC.x) + (VC.x - VA.x) * (py - VC.y)) / det;
  let w2 = ((VC.y - VB.y) * (px - VC.x) + (VB.x - VC.x) * (py - VC.y)) / det;
  let w3 = 1 - w1 - w2;
  // Clamp to triangle
  w1 = Math.max(0, w1); w2 = Math.max(0, w2); w3 = Math.max(0, w3);
  const sum = w1 + w2 + w3 || 1;
  return [w1 / sum, w2 / sum, w3 / sum];
}

function mixColor(w1, w2, w3) {
  const r = Math.round(w1 * COL_GOUDENEEUW.r + w2 * COL_JUGEND.r + w3 * COL_MAGISCHREALISME.r);
  const g = Math.round(w1 * COL_GOUDENEEUW.g + w2 * COL_JUGEND.g + w3 * COL_MAGISCHREALISME.g);
  const b = Math.round(w1 * COL_GOUDENEEUW.b + w2 * COL_JUGEND.b + w3 * COL_MAGISCHREALISME.b);
  return `rgb(${r},${g},${b})`;
}

function pct(w) { return Math.round(w * 100); }

export class TriangleWidget {
  constructor(containerEl) {
    this.container = containerEl;
    this.weights = [1/3, 1/3, 1/3]; // [w1GoudenEeuw, w2Jugend, w3MagischRealisme]
    this._callbacks = [];
    this._dragging = false;
    this._build();
    this._update();
  }

  getWeights() { return [...this.weights]; }

  setWeights(w1, w2, w3) {
    const sum = w1 + w2 + w3 || 1;
    this.weights = [w1/sum, w2/sum, w3/sum];
    this._update();
  }

  onChange(cb) { this._callbacks.push(cb); }

  _notify() { this._callbacks.forEach(cb => cb([...this.weights])); }

  _build() {
    const pts = `${VA.x},${VA.y} ${VB.x},${VB.y} ${VC.x},${VC.y}`;

    this.container.innerHTML = `
      <div class="triangle-container">
        <div class="triangle-svg-wrap" tabindex="0" role="slider"
             aria-label="Stijldriehoek — pijltjestoetsen verplaatsen het punt">
          <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="rg-jugend" cx="${VA.x}" cy="${VA.y}" r="320"
                              gradientUnits="userSpaceOnUse">
                <stop offset="0%"  stop-color="${COL_JUGEND.hex}" stop-opacity="0.45"/>
                <stop offset="70%" stop-color="${COL_JUGEND.hex}" stop-opacity="0"/>
              </radialGradient>
              <radialGradient id="rg-goudeneeuw" cx="${VB.x}" cy="${VB.y}" r="320"
                              gradientUnits="userSpaceOnUse">
                <stop offset="0%"  stop-color="${COL_GOUDENEEUW.hex}" stop-opacity="0.45"/>
                <stop offset="70%" stop-color="${COL_GOUDENEEUW.hex}" stop-opacity="0"/>
              </radialGradient>
              <radialGradient id="rg-magisch" cx="${VC.x}" cy="${VC.y}" r="320"
                              gradientUnits="userSpaceOnUse">
                <stop offset="0%"  stop-color="${COL_MAGISCHREALISME.hex}" stop-opacity="0.45"/>
                <stop offset="70%" stop-color="${COL_MAGISCHREALISME.hex}" stop-opacity="0"/>
              </radialGradient>
              <clipPath id="tri-clip">
                <polygon points="${pts}"/>
              </clipPath>
            </defs>
            <!-- Triangle background -->
            <polygon points="${pts}" fill="#1e2a3a" stroke="#334a60" stroke-width="1.5"/>
            <!-- Gradient overlays (clipped to triangle) -->
            <polygon points="${pts}" fill="url(#rg-jugend)"      clip-path="url(#tri-clip)"/>
            <polygon points="${pts}" fill="url(#rg-goudeneeuw)" clip-path="url(#tri-clip)"/>
            <polygon points="${pts}" fill="url(#rg-magisch)"    clip-path="url(#tri-clip)"/>
            <!-- Vertex dots -->
            <circle cx="${VA.x}" cy="${VA.y}" r="5" fill="${COL_JUGEND.hex}"/>
            <circle cx="${VB.x}" cy="${VB.y}" r="5" fill="${COL_GOUDENEEUW.hex}"/>
            <circle cx="${VC.x}" cy="${VC.y}" r="5" fill="${COL_MAGISCHREALISME.hex}"/>
            <!-- Labels — all middle-anchored so they never clip at edges -->
            <text x="${VA.x}" y="20" text-anchor="middle" fill="${COL_JUGEND.hex}"
                  font-size="18" font-family="sans-serif">Jugendstil·Déco</text>
            <text x="${VB.x}" y="${VB.y + 26}" text-anchor="middle" fill="${COL_GOUDENEEUW.hex}"
                  font-size="18" font-family="sans-serif">Gouden Eeuw</text>
            <text x="${VC.x}" y="${VC.y + 26}" text-anchor="middle" fill="${COL_MAGISCHREALISME.hex}"
                  font-size="18" font-family="sans-serif">Magisch·Realisme</text>
            <!-- Draggable point -->
            <circle class="drag-point" r="9" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"
                    cursor="move" style="filter:drop-shadow(0 0 4px rgba(0,0,0,0.6))"/>
          </svg>
        </div>
        <div class="triangle-inputs">
          <div class="triangle-input-row">
            <span class="triangle-input-swatch" style="background:${COL_GOUDENEEUW.hex}"></span>
            <span class="triangle-input-label">Gouden Eeuw</span>
            <input type="number" id="ti-goudeneeuw" min="0" max="100" step="1">
            <span style="color:var(--text-muted);font-size:11px">%</span>
          </div>
          <div class="triangle-input-row">
            <span class="triangle-input-swatch" style="background:${COL_JUGEND.hex}"></span>
            <span class="triangle-input-label">Jugendstil·Déco</span>
            <input type="number" id="ti-jugend" min="0" max="100" step="1">
            <span style="color:var(--text-muted);font-size:11px">%</span>
          </div>
          <div class="triangle-input-row">
            <span class="triangle-input-swatch" style="background:${COL_MAGISCHREALISME.hex}"></span>
            <span class="triangle-input-label">Magisch Realisme</span>
            <input type="number" id="ti-magisch" min="0" max="100" step="1">
            <span style="color:var(--text-muted);font-size:11px">%</span>
          </div>
          <div class="triangle-reset-row">
            <button class="btn-reset" id="ti-reset">Reset</button>
          </div>
        </div>
      </div>`;

    this._svg   = this.container.querySelector('svg');
    this._point = this.container.querySelector('.drag-point');
    this._wrap  = this.container.querySelector('.triangle-svg-wrap');
    this._inGoudenEeuw = this.container.querySelector('#ti-goudeneeuw');
    this._inJugend = this.container.querySelector('#ti-jugend');
    this._inMagisch  = this.container.querySelector('#ti-magisch');
    this._btnReset = this.container.querySelector('#ti-reset');

    this._bindEvents();
  }

  _bindEvents() {
    // Mouse drag on SVG
    this._wrap.addEventListener('mousedown', e => this._onDown(e));
    window.addEventListener('mousemove', e => this._onMove(e));
    window.addEventListener('mouseup', () => { this._dragging = false; });

    // Touch support
    this._wrap.addEventListener('touchstart', e => {
      e.preventDefault();
      this._dragging = true;
      this._applyPointer(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', e => {
      if (!this._dragging) return;
      e.preventDefault();
      this._applyPointer(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', () => { this._dragging = false; });

    // Keyboard (arrow keys)
    this._wrap.addEventListener('keydown', e => this._onKey(e));

    // Numeric inputs
    [
      [this._inGoudenEeuw, 0],
      [this._inJugend, 1],
      [this._inMagisch,  2],
    ].forEach(([el, idx]) => {
      el.addEventListener('input', () => this._onInputChange(idx, el));
    });

    // Reset
    this._btnReset.addEventListener('click', () => {
      this.setWeights(1/3, 1/3, 1/3);
      this._notify();
    });
  }

  _onDown(e) {
    if (e.button !== 0) return;
    this._dragging = true;
    this._applyPointer(e);
  }

  _onMove(e) {
    if (!this._dragging) return;
    this._applyPointer(e);
  }

  _applyPointer(e) {
    const rect = this._svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;
    const [w1, w2, w3] = cartToBary(px, py);
    this.weights = [w1, w2, w3];
    this._update();
    this._notify();
  }

  _onKey(e) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const [w1, w2, w3] = this.weights;
    const pos = baryToCart(w1, w2, w3);
    let { x, y } = pos;
    if (e.key === 'ArrowLeft')  { x -= step * W; }
    else if (e.key === 'ArrowRight') { x += step * W; }
    else if (e.key === 'ArrowUp')    { y -= step * H; }
    else if (e.key === 'ArrowDown')  { y += step * H; }
    else return;
    e.preventDefault();
    const [nw1, nw2, nw3] = cartToBary(x, y);
    this.weights = [nw1, nw2, nw3];
    this._update();
    this._notify();
  }

  _onInputChange(idx, el) {
    const val = Math.max(0, Math.min(100, parseInt(el.value) || 0));
    el.value = val;
    const ws = this.weights.map(w => pct(w));
    ws[idx] = val;
    // Normalise: adjust others proportionally
    const other = ws.filter((_, i) => i !== idx);
    const otherSum = other.reduce((a, b) => a + b, 0);
    const remaining = 100 - val;
    if (otherSum === 0) {
      const eq = remaining / 2;
      const indices = [0, 1, 2].filter(i => i !== idx);
      ws[indices[0]] = Math.floor(eq);
      ws[indices[1]] = remaining - Math.floor(eq);
    } else {
      const scale = remaining / otherSum;
      [0, 1, 2].forEach(i => {
        if (i !== idx) ws[i] = Math.round(ws[i] * scale);
      });
      // Fix rounding
      const sum = ws.reduce((a, b) => a + b, 0);
      ws[idx] += 100 - sum;
    }
    this.weights = ws.map(v => v / 100);
    this._update();
    this._notify();
  }

  _update() {
    const [w1, w2, w3] = this.weights;
    const pos = baryToCart(w1, w2, w3);
    const col = mixColor(w1, w2, w3);
    this._point.setAttribute('cx', pos.x.toFixed(1));
    this._point.setAttribute('cy', pos.y.toFixed(1));
    this._point.setAttribute('fill', col);
    // Update inputs without triggering their event
    this._inGoudenEeuw.value = pct(w1);
    this._inJugend.value = pct(w2);
    this._inMagisch.value  = pct(w3);
  }
}

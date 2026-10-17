import * as THREE from 'three';

// All textures are generated procedurally on canvases so the game ships with no binary assets.

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let maxAniso = 8;
export function setMaxAnisotropy(v) {
  maxAniso = Math.min(16, v || 8);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function grain(ctx, w, h, amount, rand, alpha = 0.08) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  // speckles
  ctx.globalAlpha = alpha;
  for (let i = 0; i < (w * h) / 60; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- Road
// Tile covers 16 m (road width, u) x 16 m (length, v). Lane dashes repeat every 8 m.
export function roadTexture(wet = false) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(42);
  ctx.fillStyle = wet ? '#1d1f23' : '#2c2e33';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 34, rand, 0.12);
  const px = (m) => ((m + 8) / 16) * S;
  // tire wear in lane centers
  for (const lane of [-6, -2, 2, 6]) {
    for (const off of [-0.8, 0.8]) {
      const g = ctx.createLinearGradient(px(lane + off - 0.5), 0, px(lane + off + 0.5), 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px(lane + off - 0.5), 0, px(lane + off + 0.5) - px(lane + off - 0.5), S);
    }
  }
  // cracks / patches
  ctx.strokeStyle = 'rgba(10,10,12,0.5)';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    let x = rand() * S, y = rand() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const paint = (x0, x1, y0, y1, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(px(x0), (y0 / 16) * S, px(x1) - px(x0), ((y1 - y0) / 16) * S);
  };
  const white = 'rgba(235,235,230,0.92)';
  const yellow = 'rgba(240,190,40,0.92)';
  paint(-7.75, -7.6, 0, 16, white);
  paint(7.6, 7.75, 0, 16, white);
  paint(-0.3, -0.18, 0, 16, yellow);
  paint(0.18, 0.3, 0, 16, yellow);
  for (const x of [-4, 4]) {
    for (const y0 of [0, 8]) paint(x - 0.07, x + 0.07, y0, y0 + 3, white);
  }
  // worn paint
  ctx.globalCompositeOperation = 'source-atop';
  grain(ctx, S, S, 10, rand, 0.05);
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

export function plainAsphaltTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(7);
  ctx.fillStyle = '#2c2e33';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 34, rand, 0.12);
  return toTexture(c);
}

export function crosswalkTexture() {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(240,240,236,0.95)';
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const x = (i / stripes) * 512 + 10;
    ctx.fillRect(x, 0, 512 / stripes - 26, 128);
  }
  const t = toTexture(c, { repeat: false });
  return t;
}

export function sidewalkTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(3);
  ctx.fillStyle = '#9a9a97';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 22, rand, 0.08);
  ctx.strokeStyle = 'rgba(60,60,60,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo((i * S) / 4, 0); ctx.lineTo((i * S) / 4, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (i * S) / 4); ctx.lineTo(S, (i * S) / 4); ctx.stroke();
  }
  return toTexture(c);
}

export function plazaTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(11);
  ctx.fillStyle = '#5d5f5e';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 26, rand, 0.1);
  ctx.strokeStyle = 'rgba(30,30,30,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo((i * S) / 8, 0); ctx.lineTo((i * S) / 8, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (i * S) / 8); ctx.lineTo(S, (i * S) / 8); ctx.stroke();
  }
  return toTexture(c);
}

export function dirtTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(19);
  ctx.fillStyle = '#3b2f25';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) {
    const g = 30 + rand() * 50;
    ctx.fillStyle = `rgba(${g + 20},${g + 8},${g},0.6)`;
    ctx.beginPath();
    ctx.arc(rand() * S, rand() * S, 1 + rand() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, S, S, 30, rand, 0.1);
  return toTexture(c);
}

export function concreteWallTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(23);
  ctx.fillStyle = '#8a8780';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 30, rand, 0.1);
  ctx.strokeStyle = 'rgba(40,40,40,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo((i * S) / 2, 0); ctx.lineTo((i * S) / 2, S); ctx.stroke();
  }
  // water stains
  for (let i = 0; i < 30; i++) {
    const x = rand() * S;
    const g = ctx.createLinearGradient(0, S * 0.5, 0, S);
    g.addColorStop(0, 'rgba(30,40,30,0)');
    g.addColorStop(1, 'rgba(30,40,30,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x, S * 0.5, 4 + rand() * 20, S * 0.5);
  }
  return toTexture(c);
}

// ---------------------------------------------------------------- Facades
// Tile = 8 window columns x 16 floors (28 m x 56 m).
export const FACADE_TILE_W = 28;
export const FACADE_TILE_H = 56;

export function facadeTextures(style, litRatio, seed) {
  const W = 512, H = 1024;
  const cols = 8, rows = 16;
  const cw = W / cols, rh = H / rows;
  const [c, ctx] = makeCanvas(W, H);
  const [e, ectx] = makeCanvas(W, H);
  const rand = mulberry32(seed);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);

  const litColor = () => {
    const r = rand();
    if (r < 0.55) return `rgba(255,${190 + rand() * 40},${120 + rand() * 50},1)`;
    if (r < 0.85) return `rgba(${200 + rand() * 55},${220 + rand() * 35},255,1)`;
    return `rgba(255,255,${220 + rand() * 35},1)`;
  };
  const lightWindow = (x, y, w, h) => {
    if (rand() < litRatio) {
      const a = 0.45 + rand() * 0.55;
      ectx.globalAlpha = a;
      ectx.fillStyle = litColor();
      ectx.fillRect(x, y, w, h);
      // blinds / interior variation
      ectx.globalAlpha = a * 0.5;
      ectx.fillStyle = '#000';
      if (rand() < 0.5) ectx.fillRect(x, y, w, h * rand() * 0.6);
      ectx.globalAlpha = 1;
    }
  };

  if (style === 'glass' || style === 'dark') {
    const base = style === 'glass' ? [52, 78, 104] : [20, 24, 30];
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgb(${base[0] + 40},${base[1] + 45},${base[2] + 50})`);
    g.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`);
    g.addColorStop(1, `rgb(${base[0] + 20},${base[1] + 25},${base[2] + 35})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const v = (rand() - 0.5) * 22;
        ctx.fillStyle = `rgba(${128 + v},${140 + v},${155 + v},0.12)`;
        ctx.fillRect(k * cw + 2, r * rh + 2, cw - 4, rh - 4);
        lightWindow(k * cw + 3, r * rh + 6, cw - 6, rh - 10);
      }
    }
    ctx.fillStyle = style === 'glass' ? 'rgba(190,200,210,0.9)' : 'rgba(70,74,80,0.9)';
    for (let k = 0; k <= cols; k++) ctx.fillRect(k * cw - 2, 0, 4, H);
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * rh - 3, W, 6);
  } else if (style === 'concrete') {
    const tone = 150 + rand() * 50;
    ctx.fillStyle = `rgb(${tone},${tone - 8},${tone - 18})`;
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 16, rand, 0.06);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = k * cw + cw * 0.2, y = r * rh + rh * 0.22;
        const w = cw * 0.6, h = rh * 0.58;
        ctx.fillStyle = 'rgba(40,40,40,0.6)';
        ctx.fillRect(x - 3, y - 3, w + 6, h + 8);
        const gg = ctx.createLinearGradient(x, y, x + w, y + h);
        gg.addColorStop(0, '#5a6d7c');
        gg.addColorStop(1, '#1d2730');
        ctx.fillStyle = gg;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(220,220,220,0.5)';
        ctx.fillRect(x - 3, y + h + 2, w + 6, 4);
        lightWindow(x, y, w, h);
      }
    }
  } else {
    // modern: white floor slabs with ribbon windows
    ctx.fillStyle = '#e9e9e6';
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 10, rand, 0.04);
    for (let r = 0; r < rows; r++) {
      const y = r * rh + rh * 0.28, h = rh * 0.62;
      const gg = ctx.createLinearGradient(0, y, 0, y + h);
      gg.addColorStop(0, '#2b3946');
      gg.addColorStop(1, '#0f151b');
      ctx.fillStyle = gg;
      ctx.fillRect(0, y, W, h);
      for (let k = 0; k < cols; k++) {
        ctx.fillStyle = 'rgba(200,205,210,0.7)';
        ctx.fillRect(k * cw - 1, y, 2, h);
        lightWindow(k * cw + 2, y + 2, cw - 4, h - 4);
      }
    }
  }
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

export function roofTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = mulberry32(5);
  ctx.fillStyle = '#3e4044';
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 30, rand, 0.1);
  return toTexture(c);
}

export function storefrontTextures(seed, litRatio) {
  const W = 512, H = 64;
  const [c, ctx] = makeCanvas(W, H);
  const [e, ectx] = makeCanvas(W, H);
  const rand = mulberry32(seed);
  ctx.fillStyle = '#16181b';
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * W + 6, w = W / n - 12;
    const g = ctx.createLinearGradient(0, 8, 0, H);
    g.addColorStop(0, '#4c5a66');
    g.addColorStop(1, '#20262c');
    ctx.fillStyle = g;
    ctx.fillRect(x, 10, w, H - 10);
    const hue = Math.floor(rand() * 360);
    ctx.fillStyle = `hsl(${hue},40%,55%)`;
    ctx.fillRect(x, 2, w, 6);
    ectx.fillStyle = `hsl(${hue},70%,60%)`;
    ectx.fillRect(x, 2, w, 6);
    // shop interior: warm light with shelves and people silhouettes
    ectx.globalAlpha = Math.min(1, litRatio * 1.3);
    ectx.fillStyle = '#ffd9a8';
    ectx.fillRect(x, 10, w, H - 10);
    ectx.fillStyle = '#3a2a1a';
    for (let k = 0; k < 3; k++) ectx.fillRect(x + 4, 20 + k * 14, w - 8, 3);
    for (let k = 0; k < 3; k++) {
      const px = x + 8 + rand() * (w - 20);
      ectx.fillRect(px, 30, 8, H - 30);
      ectx.beginPath(); ectx.arc(px + 4, 26, 5, 0, Math.PI * 2); ectx.fill();
    }
    ectx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 10, w * 0.35, H - 10);
  }
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

// ---------------------------------------------------------------- FX
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.5)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c, { repeat: false });
}

export function waterNormalTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const waves = [];
  const rand = mulberry32(99);
  for (let i = 0; i < 9; i++) {
    waves.push({ fx: Math.floor(rand() * 7) - 3, fy: Math.floor(rand() * 7) + 1, a: 0.5 + rand(), p: rand() * 6.28 });
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const ph = ((w.fx * x + w.fy * y) / S) * Math.PI * 2 + w.p;
        const cph = Math.cos(ph) * w.a;
        dx += cph * w.fx;
        dy += cph * w.fy;
      }
      const nx = -dx * 0.06, ny = -dy * 0.06, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false });
}

export function textTexture(text, { color = '#ffffff', glow = '#ff2a3a', w = 1024, h = 256, font = '700 150px "Helvetica Neue", Arial, sans-serif', bg = null } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 30;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 6);
  ctx.shadowBlur = 0;
  ctx.fillText(text, w / 2, h / 2 + 6);
  return toTexture(c, { repeat: false });
}

export function checkerTexture() {
  const [c, ctx] = makeCanvas(256, 64);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const t = toTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function hazardTexture() {
  const [c, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#111';
  for (let i = -2; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 64);
    ctx.lineTo(i * 32 + 16, 64);
    ctx.lineTo(i * 32 + 48, 0);
    ctx.lineTo(i * 32 + 32, 0);
    ctx.fill();
  }
  return toTexture(c);
}

export function barrierTexture() {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#d9d6cf';
  ctx.fillRect(0, 0, 256, 128);
  const rand = mulberry32(31);
  grain(ctx, 256, 128, 20, rand, 0.08);
  ctx.fillStyle = '#d4231d';
  for (let i = -2; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 40, 128);
    ctx.lineTo(i * 40 + 20, 128);
    ctx.lineTo(i * 40 + 60, 50);
    ctx.lineTo(i * 40 + 40, 50);
    ctx.fill();
  }
  return toTexture(c);
}

// Echo: the canvas, glow sprites, Lumi's looks, layout and camera, and the painted cave art.
"use strict";

// ---------- Canvas ----------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d"), mainCtx = ctx;
// If a phone can't keep up, frames are drawn at a lower resolution (see frame()).
let qualityCap = 2, slowFrames = 0, frameCount = 0;
let SDPR = 1, W = 0, H = 0, DPR = 1, TS = 32, OX = 0, OY = 0, bgGrad = null, vignette = null;
const $ = id => document.getElementById(id);

function makeGlow(r, g, b) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},0.14)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return c;
}
const GLOW = {
  cyan: makeGlow(126, 232, 255),
  gold: makeGlow(255, 205, 100),
  violet: makeGlow(180, 130, 255),
  pink: makeGlow(255, 140, 200),
  green: makeGlow(150, 255, 190),
  white: makeGlow(255, 255, 255),
  ember: makeGlow(255, 140, 70),
};
// Accessories for Lumi, unlocked by earning awards.
const HATS = [
  { name: "None", need: 0 },
  { name: "Leaf", need: 2 },
  { name: "Bow", need: 4 },
  { name: "Crown", need: 6 },
  { name: "Star", need: 8 },
  { name: "Flower", need: 10 },
];
const awardsEarned = () => Object.keys(save.ach || {}).length;
const hatUnlocked = k => awardsEarned() >= HATS[k].need;
// Draws an accessory on Lumi's head; (0, 0) is the middle of Lumi and R its radius.
function drawHat(k, R, ctx = mainCtx) {
  if (!k || !hatUnlocked(k)) return;
  ctx.save();
  if (k === 1) {        // a leaf resting on one side
    ctx.fillStyle = "#7fe39a";
    ctx.beginPath(); ctx.ellipse(R * 0.55, -R * 0.75, R * 0.42, R * 0.2, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3f9e5a"; ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.beginPath(); ctx.moveTo(R * 0.25, -R * 0.55); ctx.lineTo(R * 0.85, -R * 0.95); ctx.stroke();
  } else if (k === 2) { // a pink bow
    ctx.fillStyle = "#ff8cc8";
    ctx.beginPath(); ctx.moveTo(R * 0.5, -R * 0.78); ctx.lineTo(R * 0.15, -R * 1.02); ctx.lineTo(R * 0.18, -R * 0.55); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R * 0.5, -R * 0.78); ctx.lineTo(R * 0.88, -R * 1.0); ctx.lineTo(R * 0.85, -R * 0.52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff5aa8"; ctx.beginPath(); ctx.arc(R * 0.5, -R * 0.78, R * 0.1, 0, Math.PI * 2); ctx.fill();
  } else if (k === 3) { // a little gold crown
    ctx.fillStyle = "#ffd36e";
    ctx.beginPath();
    ctx.moveTo(-R * 0.45, -R * 0.78); ctx.lineTo(-R * 0.5, -R * 1.22); ctx.lineTo(-R * 0.22, -R * 0.98); ctx.lineTo(0, -R * 1.3);
    ctx.lineTo(R * 0.22, -R * 0.98); ctx.lineTo(R * 0.5, -R * 1.22); ctx.lineTo(R * 0.45, -R * 0.78); ctx.closePath(); ctx.fill();
  } else if (k === 4) { // a star clip
    ctx.fillStyle = "#ffe6a0";
    ctx.beginPath();
    for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? R * 0.14 : R * 0.32; ctx.lineTo(-R * 0.55 + Math.cos(a) * rr, -R * 0.72 + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  } else if (k === 5) { // a flower
    ctx.fillStyle = "#ffffff";
    for (let q = 0; q < 5; q++) { const a = q * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(R * 0.55 + Math.cos(a) * R * 0.17, -R * 0.75 + Math.sin(a) * R * 0.17, R * 0.13, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#ffd36e"; ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.75, R * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// Looks for Lumi, unlocked by collecting stars.
const SKINS = [
  { name: "Moonbeam",  need: 0,   c: [126, 232, 255], body: ["#ffffff", "#c9f6ff", "#6fd9ff"] },
  { name: "Rosy",      need: 12,  c: [255, 140, 200], body: ["#ffffff", "#ffd1ea", "#ff8cc8"] },
  { name: "Minty",     need: 30,  c: [130, 255, 190], body: ["#ffffff", "#d2ffe6", "#6fe8a8"] },
  { name: "Sunny",     need: 60,  c: [255, 205, 100], body: ["#ffffff", "#fff0c2", "#ffc94d"] },
  { name: "Lilac",     need: 100, c: [185, 140, 255], body: ["#ffffff", "#e6d9ff", "#a98bff"] },
  { name: "Ember",     need: 150, c: [255, 150, 90],  body: ["#fff6ee", "#ffd2b0", "#ff8a4d"] },
  { name: "Frosty",    need: 225, c: [210, 235, 255], body: ["#ffffff", "#f0f8ff", "#b8dcff"] },
  { name: "Starlight", need: 300, c: null, body: null },
];
const RAINBOW = [[255, 120, 160], [255, 200, 110], [150, 255, 160], [110, 220, 255], [170, 140, 255], [255, 140, 230]];
const skinGlows = SKINS.map(k => (k.c ? makeGlow(...k.c) : null));
const rainbowGlows = RAINBOW.map(c => makeGlow(...c));
const skinUnlocked = k => totalStars() >= SKINS[k].need;
function lumiLook() {
  const k = SKINS[save.skin] && skinUnlocked(save.skin) ? save.skin : 0, sk = SKINS[k];
  if (sk.c) return { glow: skinGlows[k], body: sk.body };
  const q = Math.floor(clock * 2) % RAINBOW.length, c = RAINBOW[q];
  return { glow: rainbowGlows[q], body: ["#ffffff", `rgb(${c.map(v => Math.round(v * 0.5 + 127)).join(",")})`, `rgb(${c.join(",")})`] };
}

function glow(sprite, x, y, radius, alpha) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, qualityCap);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  // The lit cave is blended at a lower resolution than the screen and scaled up: the rock is
  // soft anyway, and this is the most expensive step of every frame.
  SDPR = Math.min(DPR, 1.25);
  scene.width = Math.round(W * SDPR);
  scene.height = Math.round(H * SDPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bgGrad = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  bgGrad.addColorStop(0, "#080b22");
  bgGrad.addColorStop(1, "#03040b");
  vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.6)");
  layout();
}
// Caves up to 18 rows fit the screen. Taller caves keep the same tile size and the
// camera follows Lumi up and down.
const VIEW = { top: 0, bottom: 0 };
function layout() {
  if (!L) return;
  VIEW.top = 62 + safeInset("top");
  VIEW.bottom = H - 16 - safeInset("bottom");
  const avail = VIEW.bottom - VIEW.top;
  // Tiles are sized for an 11 by 18 cave; bigger caves keep that size and the camera follows Lumi.
  TS = Math.max(8, Math.floor(Math.min((W - 16) / Math.min(L.cols, 11), avail / Math.min(L.rows, 18))));
  L.scrollX = L.cols * TS > W - 16 + 1;
  OX = L.scrollX ? cameraTargetX() : Math.round((W - TS * L.cols) / 2);
  L.scroll = L.rows * TS > avail + 1;
  OY = L.scroll ? cameraTarget() : Math.round(VIEW.top + (avail - TS * L.rows) / 2);
  // The painted rock and the light map cover the cave plus enough margin for anything on screen.
  LM.mx = L.scrollX ? Math.ceil((8 + TS * 0.4) / TS) + 2 : Math.ceil(OX / TS) + 1;
  LM.my = L.scroll
    ? Math.ceil((Math.max(VIEW.top, H - VIEW.bottom) + TS * 0.4) / TS) + 1
    : Math.ceil(Math.max(OY, H - OY - L.rows * TS) / TS) + 1;
  lightCanvas.width = (L.cols + LM.mx * 2) * LPT;
  lightCanvas.height = (L.rows + LM.my * 2) * LPT;
  buildArt();
  buildBackdrop();
}
function cameraTarget() {
  const want = (VIEW.top + VIEW.bottom) / 2 - L.lumi.y * TS;
  return Math.max(VIEW.bottom - L.rows * TS - TS * 0.3, Math.min(VIEW.top + TS * 0.3, want));
}
function cameraTargetX() {
  const want = W / 2 - L.lumi.x * TS;
  return Math.max(W - 8 - L.cols * TS - TS * 0.3, Math.min(8 + TS * 0.3, want));
}
function moveCamera(dt) {
  if (L.scroll) OY += (cameraTarget() - OY) * Math.min(1, dt * 5);
  if (L.scrollX) OX += (cameraTargetX() - OX) * Math.min(1, dt * 5);
}

// ---------- Painted cave ----------
// The cave is painted once per level: smooth rock shaped from the tile map, roughened with
// noise, with stalactites, stone texture and lit rims. Light then decides what you can see.
const scene = document.createElement("canvas"), sctx = scene.getContext("2d");
const art = document.createElement("canvas"), actx = art.getContext("2d");
const lightCanvas = document.createElement("canvas"), lctx = lightCanvas.getContext("2d");
const LPT = 8;            // light-map pixels per tile
const LM = { mx: 0, my: 0 };
const LIGHT = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
})();

const PERM = new Uint8Array(512), RND = new Float32Array(256);
(() => {
  let seed = 1337;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) RND[i] = r();
})();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const X = xi & 255, Y = yi & 255;
  const a = RND[PERM[X + PERM[Y]]], b = RND[PERM[X + 1 + PERM[Y]]];
  const c = RND[PERM[X + PERM[Y + 1]]], d = RND[PERM[X + 1 + PERM[Y + 1]]];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
let fieldBuf = new Float32Array(0);
// A faint, far-away layer of cave mist and specks behind the cave, in the world's colours.
const backdrop = document.createElement("canvas"), bctx = backdrop.getContext("2d");
function buildBackdrop() {
  const w = Math.max(1, Math.round(W / 2)), h = Math.max(1, Math.round(H * 0.8));
  backdrop.width = w; backdrop.height = h;
  const th = themeOf(levelIndex), r = seeded(levelIndex * 977 + 3);
  // The dark background colour is painted in here too, so each frame draws one image
  // instead of a full-screen gradient plus an image.
  const bg = bctx.createRadialGradient(w / 2, h * 0.47, 0, w / 2, h * 0.47, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#080b22");
  bg.addColorStop(1, "#03040b");
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) {
    const x = r() * w, y = r() * h, rad = (0.15 + r() * 0.35) * w;
    const g = bctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = k % 3 ? th.floor2 : th.rim;
    g.addColorStop(0, `rgba(${c.join(",")},${k % 3 ? 0.16 : 0.05})`);
    g.addColorStop(1, `rgba(${c.join(",")},0)`);
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, w, h);
  }
  for (let k = 0; k < 40; k++) {
    bctx.fillStyle = `rgba(${th.rim.join(",")},${0.15 + r() * 0.25})`;
    bctx.beginPath();
    bctx.arc(r() * w, r() * h, 0.4 + r() * 0.9, 0, Math.PI * 2);
    bctx.fill();
  }
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function buildArt() {
  const sc = Math.min(DPR, L.rows > 18 ? 1 : 1.25);
  const w = Math.max(1, Math.round((L.cols + LM.mx * 2) * TS * sc)), h = Math.max(1, Math.round((L.rows + LM.my * 2) * TS * sc));
  art.width = w; art.height = h;
  const { cols, rows } = L, SUB = 2, PAD = 3;

  // Rock occupancy at two samples per tile, blurred once so corners round off
  // while tile edges stay where the collisions are.
  const gw = (cols + PAD * 2) * SUB, gh = (rows + PAD * 2) * SUB;
  const g = new Float32Array(gw * gh), tmp = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const tx = Math.floor(gx / SUB) - PAD, ty = Math.floor(gy / SUB) - PAD;
    g[gy * gw + gx] = tx < 0 || ty < 0 || tx >= cols || ty >= rows || L.tile[ty * cols + tx] === "#" ? 1 : 0;
  }
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
    tmp[y * gw + x] = (g[y * gw + Math.max(0, x - 1)] + 2 * g[y * gw + x] + g[y * gw + Math.min(gw - 1, x + 1)]) / 4;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
    g[y * gw + x] = (tmp[Math.max(0, y - 1) * gw + x] + 2 * tmp[y * gw + x] + tmp[Math.min(gh - 1, y + 1) * gw + x]) / 4;
  const sample = (tx, ty) => {
    const fx = (tx + PAD) * SUB - 0.5, fy = (ty + PAD) * SUB - 0.5;
    if (fx < 0 || fy < 0 || fx >= gw - 1 || fy >= gh - 1) return 1;
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, k = y0 * gw + x0;
    return (g[k] + (g[k + 1] - g[k]) * ax) * (1 - ay) + (g[k + gw] + (g[k + gw + 1] - g[k + gw]) * ax) * ay;
  };
  // Water tint, blended between tile centres so rivers have soft banks.
  const water = (tx, ty) => {
    const fx = tx - 0.5, fy = ty - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const at = (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows && L.flow[y * cols + x] ? 1 : 0);
    return (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
  };

  const seed = levelIndex * 37.1 + 5;
  const th = themeOf(levelIndex);
  const inv = 1 / (TS * sc), ox = LM.mx, oy = LM.my;
  if (fieldBuf.length < w * h) fieldBuf = new Float32Array(w * h);
  const f = fieldBuf;
  for (let py = 0; py < h; py++) {
    const ty = (py + 0.5) * inv - oy, iy = Math.floor(ty);
    for (let px = 0; px < w; px++) {
      const tx = (px + 0.5) * inv - ox, ix = Math.floor(tx);
      let v = sample(tx, ty);
      // The shape noise moves the field by at most 0.16, and rock shading stops changing 0.3
      // above the edge, so deep enough inside solid rock the noise can't change any pixel.
      if (v > TH + 0.47) { f[py * w + px] = TH + 0.5; continue; }
      v += (vnoise(tx * 1.7 + seed, ty * 1.7) - 0.5) * 0.24 + (vnoise(tx * 4.3, ty * 4.3 + seed) - 0.5) * 0.08;
      if (ix >= 0 && iy >= 0 && ix < cols && iy < rows) {
        const sp = L.spikes[iy * cols + ix];
        if (sp) for (const s of sp) {
          const dy = (ty - s.base) * s.dir;
          if (dy < -0.1 || dy > s.len) continue;
          const hw = s.w * Math.min(1, 1 - dy / s.len + 0.15), dx = Math.abs(tx - s.x);
          if (dx < hw) v = Math.max(v, TH - 0.03 + 0.3 * (1 - dx / hw));
        }
      }
      f[py * w + px] = v;
    }
  }

  const img = actx.createImageData(w, h), D = img.data;
  const hasWater = L.flow.some(Boolean);
  let patch = 0;
  for (let py = 0; py < h; py++) {
    const ty = (py + 0.5) * inv - oy;
    for (let px = 0; px < w; px++) {
      const i = py * w + px, v = f[i], tx = (px + 0.5) * inv - ox;
      const tex = vnoise(tx * 7 + 3, ty * 7) * 0.6 + vnoise(tx * 19, ty * 19 + 7) * 0.4;
      const t = 0.78 + tex * 0.44;
      const k4 = i * 4;
      if (v > TH + 0.3) {
        // Deep rock: just its darkest colour with stone texture.
        D[k4] = th.deep[0] * t; D[k4 + 1] = th.deep[1] * t; D[k4 + 2] = th.deep[2] * t; D[k4 + 3] = 255;
        continue;
      }
      const cover = smooth(TH - 0.025, TH + 0.025, v);

      // Open cave: deep blue with teal and violet patches, darker where it meets rock.
      // Colour patches are a couple of tiles across, so every fourth pixel is plenty.
      if ((px & 3) === 0) patch = vnoise(tx * 0.45 + seed, ty * 0.45 - seed);
      const ao = smooth(TH - 0.32, TH, v);
      let fr = th.floor[0] + (th.floor2[0] - th.floor[0]) * patch;
      let fg = th.floor[1] + (th.floor2[1] - th.floor[1]) * patch;
      let fb = th.floor[2] + (th.floor2[2] - th.floor[2]) * patch;
      const wt = hasWater ? water(tx, ty) : 0;
      if (wt > 0) { fr += (14 - fr) * wt * 0.8; fg += (62 - fg) * wt * 0.8; fb += (96 - fb) * wt * 0.8; }
      const fk = t * (1 - ao * 0.6);
      fr *= fk; fg *= fk; fb *= fk;

      // Rock: lighter near its surface, catching light on faces that look up and left.
      const gx = f[i + (px < w - 1 ? 1 : 0)] - f[i - (px > 0 ? 1 : 0)];
      const gy = f[i + (py < h - 1 ? w : 0)] - f[i - (py > 0 ? w : 0)];
      const m = Math.hypot(gx, gy) + 1e-6;
      const facing = Math.max(0, (gy / m) * 0.8 - (gx / m) * 0.35);
      const depth = Math.min(1, Math.max(0, (v - TH) / 0.3));
      const rim = 1 - smooth(TH, TH + 0.12, v);
      const hl = rim * (0.35 + 0.65 * facing);
      let rr = (th.rock[0] + (th.deep[0] - th.rock[0]) * depth) * t + th.rim[0] * hl;
      let rg = (th.rock[1] + (th.deep[1] - th.rock[1]) * depth) * t + th.rim[1] * hl;
      let rb = (th.rock[2] + (th.deep[2] - th.rock[2]) * depth) * t + th.rim[2] * hl;

      const k = i * 4;
      D[k] = fr + (rr - fr) * cover;
      D[k + 1] = fg + (rg - fg) * cover;
      D[k + 2] = fb + (rb - fb) * cover;
      D[k + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
}
const insetProbe = document.createElement("div");
insetProbe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
document.body.appendChild(insetProbe);
function safeInset(side) { return parseFloat(getComputedStyle(insetProbe)["padding" + (side === "top" ? "Top" : "Bottom")]) || 0; }

// Echo: the canvas, glow sprites, Lumi's looks, layout and camera, and the painted cave art.
"use strict";

// ---------- Canvas ----------
const canvas = document.getElementById("game");
// ctx is the screen; drawLit() (draw.js) briefly points it at a side canvas to light creatures.
let ctx = canvas.getContext("2d");
const mainCtx = ctx;
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
  SDPR = Math.min(DPR, qualityCap >= 2 ? 2 : 1.25);
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
  // The camera sits close: about 8 tiles across and 13 down are on screen, and it follows Lumi,
  // so caves have to be explored rather than seen all at once.
  TS = Math.max(8, Math.floor(Math.min((W - 16) / Math.min(L.cols, VIEW_COLS), avail / Math.min(L.rows, VIEW_ROWS))));
  const b = L.bounds;
  L.scrollX = (b.x1 - b.x0 + 2) * TS > W - 16 + 1;
  L.scroll = (b.y1 - b.y0 + 2) * TS > avail + 1;
  OX = Math.round(cameraTargetX());
  OY = Math.round(cameraTarget());
  // The painted rock and the light map cover the cave plus enough margin for anything on screen.
  LM.mx = Math.max(2, Math.ceil(Math.max(OX, W - OX - L.cols * TS) / TS) + 1);
  LM.my = Math.max(2, Math.ceil(Math.max(VIEW.top, H - VIEW.bottom, OY, H - OY - L.rows * TS) / TS) + 1);
  lightCanvas.width = (L.cols + LM.mx * 2) * LPT;
  lightCanvas.height = (L.rows + LM.my * 2) * LPT;
  buildArt();
  buildBackdrop();
}
const VIEW_COLS = 8, VIEW_ROWS = 13;
// The camera keeps to the cave itself: at most a sliver of its outer rock shows at the edges,
// never the dark beyond. When the cave is smaller than the view, it's centred.
function camRange(lo, hi, from, to, at) {
  const span = (hi - lo) * TS, room = to - from;
  if (span <= room) return from + (room - span) / 2 - lo * TS;
  const want = (from + to) / 2 - at * TS;
  return Math.max(to - hi * TS, Math.min(from - lo * TS, want));
}
function cameraTarget() {
  const b = L.bounds;
  return camRange(b.y0 - 0.5, b.y1 + 1.5, VIEW.top, VIEW.bottom, L.lumi.y + L.lumi.vy * 0.3);
}
function cameraTargetX() {
  const b = L.bounds;
  return camRange(b.x0 - 0.5, b.x1 + 1.5, 8, W - 8, L.lumi.x + L.lumi.vx * 0.3);
}
function moveCamera(dt) {
  OY += (cameraTarget() - OY) * Math.min(1, dt * 5);
  OX += (cameraTargetX() - OX) * Math.min(1, dt * 5);
}

// ---------- Painted cave ----------
// The cave is painted once per level: smooth rock shaped from the tile map, roughened with
// noise, with stalactites, stone texture and lit rims. Light then decides what you can see.
const scene = document.createElement("canvas"), sctx = scene.getContext("2d");
let art = document.createElement("canvas"), actx = art.getContext("2d");
// The bump map that goes with the art (which way each bit of rock faces), for gl.js.
let normArt = document.createElement("canvas"), artVersion = 0;
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

// The cave's rock as a smooth field (above TH is rock), shared by the painter and the
// decorations so that things sit exactly on the rock you see.
function levelShape() {
  if (L.shape) return L.shape;
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
  const seed = levelIndex * 37.1 + 5;
  const bare = (tx, ty) => sample(tx, ty) + (vnoise(tx * 1.7 + seed, ty * 1.7) - 0.5) * 0.24 + (vnoise(tx * 4.3, ty * 4.3 + seed) - 0.5) * 0.08;
  const at = (tx, ty) => {
    let v = sample(tx, ty);
    // The shape noise moves the field by at most 0.16, and rock shading stops changing 0.3
    // above the edge, so deep enough inside solid rock the noise can't change anything.
    if (v > TH + 0.47) return TH + 0.5;
    v = bare(tx, ty);
    const ix = Math.floor(tx), iy = Math.floor(ty);
    // Every rock tile keeps a solid core, so a lone pillar never thins into a ghost.
    if (ix >= 0 && iy >= 0 && ix < cols && iy < rows && L.tile[iy * cols + ix] === "#") {
      const core = 1 - Math.hypot(tx - ix - 0.5, ty - iy - 0.5) / 0.4;
      if (core > 0) v = Math.max(v, TH - 0.06 + core * 0.3);
    }
    return v;
  };
  // Where the rock surface is, searching from (x, y) down (dir 1) or up (dir -1); null if
  // there's no rock within reach.
  const surface = (x, y, dir) => {
    for (let k = 0; k <= 70; k++) {
      const yy = y - dir * 0.5 + dir * k * 0.02;
      if (at(x, yy) >= TH) return yy;
    }
    return null;
  };
  return (L.shape = { sample, at, surface });
}

// The cave is painted twice: a quick, soft pass so the level starts at once, then a sharp pass
// at full screen resolution a few milliseconds per frame, swapped in when it's done.
let artJob = null;
function buildArt() {
  artJob = null;
  const quick = paintArt(art, Math.min(DPR, TS > 40 ? 0.55 : 0.8), normArt);
  while (!quick.next().done);
  paintDecor(actx, art.width / ((L.cols + LM.mx * 2) * TS), normArt);
  artVersion++;
  const sharp = Math.min(DPR, qualityCap >= 2 ? 1.6 : 1);
  if (sharp > art.width / ((L.cols + LM.mx * 2) * TS) + 0.1) {
    const canvas = document.createElement("canvas"), norm = document.createElement("canvas");
    artJob = { canvas, norm, steps: paintArt(canvas, sharp, norm), level: L, sc: sharp };
  }
}
function stepArtJob(budgetMs) {
  if (!artJob) return;
  if (artJob.level !== L) { artJob = null; return; }
  const until = performance.now() + budgetMs;
  while (performance.now() < until) {
    if (artJob.steps.next().done) {
      paintDecor(artJob.canvas.getContext("2d"), artJob.sc, artJob.norm);
      art = artJob.canvas;
      actx = art.getContext("2d");
      normArt = artJob.norm;
      artVersion++;
      artJob = null;
      return;
    }
  }
}

// What grows on each world's rock: colour and strength on top of ledges, and under them.
const SURFACES = [
  { top: [70, 118, 150, 0.45], under: [40, 70, 100, 0.25] },   // Moonlit Grotto: wet, glinting stone
  { top: [62, 128, 58, 0.95], under: [38, 92, 52, 0.6] },     // Mossy Hollow: thick moss, dripping moss below
  { top: [118, 86, 170, 0.4], under: [70, 50, 110, 0.3] },    // Amethyst Deep: crystal dust
  { top: [74, 62, 58, 0.6], under: [56, 30, 24, 0.35] },      // Ember Caverns: ash on ledges, scorched below
  { top: [222, 236, 250, 0.95], under: [160, 200, 230, 0.5] },// Frost Tunnels: snow on top, frost below
  { top: [52, 128, 112, 0.75], under: [120, 70, 110, 0.4] },  // Coral Depths: algae and sponge
  { top: [128, 106, 70, 0.5], under: [80, 64, 42, 0.3] },     // Golden Mines: dust and grit
  { top: [86, 70, 132, 0.45], under: [60, 40, 100, 0.35] },   // Starlight Abyss: violet frost
];

function* paintArt(target, sc, normTarget) {
  const w = Math.max(1, Math.round((L.cols + LM.mx * 2) * TS * sc)), h = Math.max(1, Math.round((L.rows + LM.my * 2) * TS * sc));
  target.width = w; target.height = h;
  const tctx = target.getContext("2d");
  const { cols, rows } = L;
  const shape = levelShape();
  // Water tint, blended between tile centres so rivers have soft banks.
  const water = (tx, ty) => {
    const fx = tx - 0.5, fy = ty - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const at = (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows && L.flow[y * cols + x] ? 1 : 0);
    return (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
  };

  const seed = levelIndex * 37.1 + 5;
  const th = themeOf(levelIndex), mat = SURFACES[themeIndex(levelIndex)];
  const inv = 1 / (TS * sc), ox = LM.mx, oy = LM.my;
  const f = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    const ty = (py + 0.5) * inv - oy;
    for (let px = 0; px < w; px++) f[py * w + px] = shape.at((px + 0.5) * inv - ox, ty);
    if ((py & 15) === 15) yield;
  }

  const img = tctx.createImageData(w, h), D = img.data;
  const hgt = new Float32Array(w * h), rk = new Uint8Array(w * h);  // height and "is rock", for the bump map
  const hasWater = L.flow.some(Boolean);
  let patch = 0, far = 0, near = 0;
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
        hgt[i] = 1 + tex * 0.06; rk[i] = 255;
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
      // Depth: two layers of far-off rock behind the open cave, hazy and soft-edged like
      // stone seen through mist, the nearer one darker.
      if ((px & 1) === 0) {
        far = smooth(0.5, 0.6, vnoise(tx * 0.32 + seed, ty * 0.55 + 11));
        near = smooth(0.58, 0.64, vnoise(tx * 0.62 - seed, ty * 0.95 + 3) + (ty - rows) * 0.004);
      }
      if (far > 0) {
        const a = far * 0.32;
        fr += (th.rock[0] * 0.75 + th.floor2[0] * 0.5 - fr) * a; fg += (th.rock[1] * 0.75 + th.floor2[1] * 0.5 - fg) * a; fb += (th.rock[2] * 0.75 + th.floor2[2] * 0.5 - fb) * a;
      }
      if (near > 0) {
        const a = near * 0.55;
        fr += (th.deep[0] * 0.8 - fr) * a; fg += (th.deep[1] * 0.8 - fg) * a; fb += (th.deep[2] * 0.8 - fb) * a;
      }
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
      // Stone detail: wavy layers, fine cracks and grain, so the rock holds up close.
      let detail = 1;
      if (cover > 0) {
        const strata = 0.9 + 0.1 * Math.sin(ty * 5.3 + vnoise(tx * 0.8, ty * 0.8 + seed) * 6);
        const cn = vnoise(tx * 2.6 + seed, ty * 2.6), crack = smooth(0.9, 0.985, 1 - Math.abs(cn * 2 - 1));
        detail = strata * (1 - crack * 0.45 * (1 - rim)) * (0.92 + vnoise(tx * 41, ty * 41) * 0.16);
      }
      let rr = ((th.rock[0] + (th.deep[0] - th.rock[0]) * depth) * t * detail) + th.rim[0] * hl;
      let rg = ((th.rock[1] + (th.deep[1] - th.rock[1]) * depth) * t * detail) + th.rim[1] * hl;
      let rb = ((th.rock[2] + (th.deep[2] - th.rock[2]) * depth) * t * detail) + th.rim[2] * hl;
      // The world's own surface: moss, snow, ash... grows on the rock itself, thickest on
      // ledges facing up, in clumps, so it always follows the stone exactly.
      let fluff = 0;
      if (mat && cover > 0) {
        const up = (gy / m), clump = vnoise(tx * 1.4 + seed, ty * 1.4 - seed), edge = vnoise(tx * 6, ty * 6 + seed);
        const band = 1 - smooth(TH + 0.04 + edge * 0.05, TH + 0.1 + edge * 0.1 + clump * 0.06, v);
        const top = band * smooth(0.15, 0.6, up) * mat.top[3] * (0.55 + 0.45 * clump);
        const under = band * smooth(0.2, 0.7, -up) * mat.under[3] * (0.4 + 0.6 * clump);
        const side = band * (1 - Math.abs(up)) * mat.under[3] * 0.5 * smooth(0.45, 0.7, clump);
        const grain = 0.75 + vnoise(tx * 23, ty * 23 + 3) * 0.5;
        for (const [c, amt] of [[mat.top, top], [mat.under, under + side]]) {
          if (amt <= 0) continue;
          rr += (c[0] * grain * t - rr) * amt; rg += (c[1] * grain * t - rg) * amt; rb += (c[2] * grain * t - rb) * amt;
        }
        fluff = (top + under * 0.5) * (0.6 + grain * 0.4);
      }

      const k = i * 4;
      D[k] = fr + (rr - fr) * cover;
      D[k + 1] = fg + (rg - fg) * cover;
      D[k + 2] = fb + (rb - fb) * cover;
      D[k + 3] = 255;
      // Rock rises from its edge into a rounded, bumpy mass; the open cave behind is nearly flat.
      hgt[i] = cover * (0.25 + 0.75 * depth) * (0.88 + (detail - 1) * 0.9) + tex * (0.02 + cover * 0.05) + fluff * 0.06;
      rk[i] = cover * 255;
    }
    if ((py & 7) === 7) yield;
  }
  tctx.putImageData(img, 0, 0);
  if (!normTarget) return;

  // Bump map: the slope of the height field at each pixel, as a direction the surface faces.
  normTarget.width = w; normTarget.height = h;
  const nctx = normTarget.getContext("2d"), nimg = nctx.createImageData(w, h), N = nimg.data;
  const S = TS * sc * 0.42;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const dx = (hgt[px < w - 1 ? i + 1 : i] - hgt[px > 0 ? i - 1 : i]) * S;
      const dy = (hgt[py < h - 1 ? i + w : i] - hgt[py > 0 ? i - w : i]) * S;
      const m = 1 / Math.sqrt(dx * dx + dy * dy + 1), k = i * 4;
      N[k] = (-dx * m * 0.5 + 0.5) * 255;
      N[k + 1] = (-dy * m * 0.5 + 0.5) * 255;
      N[k + 2] = (m * 0.5 + 0.5) * 255;
      N[k + 3] = rk[i];
    }
    if ((py & 15) === 15) yield;
  }
  nctx.putImageData(nimg, 0, 0);
}

const insetProbe = document.createElement("div");
insetProbe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
document.body.appendChild(insetProbe);
function safeInset(side) { return parseFloat(getComputedStyle(insetProbe)["padding" + (side === "top" ? "Top" : "Bottom")]) || 0; }

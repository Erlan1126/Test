// Echo: level state, how songs travel, input, and the game update.
"use strict";

// ---------- Level state ----------
let L = null;          // the cave being played
let levelIndex = 0;
let screen = "title";  // title | levels | play | pause | result

function loadLevel(i, demo = false) {
  levelIndex = i;
  const def = getLevel(i);
  const rows = def.map.length, cols = def.map[0].length, n = rows * cols;
  L = {
    def, rows, cols, n,
    tile: new Array(n),       // "#", "D" or "."
    flow: new Array(n).fill(null),
    door: new Float32Array(n),   // seconds a door stays open
    doorAnim: new Float32Array(n),
    lit: new Float32Array(n),
    glowT: new Float32Array(n),
    glow: new Float32Array(n),
    seen: new Uint8Array(n),
    lights: [], crystals: [], critters: [], moths: [], gloom: [], runes: [], gate: null, baby: null,
    goal: def.goal || "explore", dark: !!def.dark && !save.settings.glow, songLimit: def.songs || 0,
  // From World 3 lights stop glowing through the dark: you have to sing to find them.
  hideLights: (!!def.dark || i >= 11) && !save.settings.glow,
    timeLeft: save.settings.relaxed ? 0 : def.time || 0, failWhy: "", portalHintCd: 0, runeHinted: false,
    exit: null,
    lumi: { x: 0, y: 0, vx: 0, vy: 0, look: 0, sing: 0, blink: 2, squash: 0 },
    waves: [], particles: [], spores: [], trail: [], echoWalls: new Set(), charge: 0, path: [], thorns: [], invuln: 0, mobs: [], slow: 0,
    pings: 0, time: 0, got: 0,
    pingCd: 0, bumpCd: 0,
    ending: 0, done: false,
    tut: 0, moved: 0,
    demo, demoT: 1.2, flash: 0, bumps: 0, hits: 0, failing: 0, lowCd: 0, ambT: 2,
    useEnergy: (i >= 2 || isChallenge(i)) && !save.settings.relaxed, energy: 100, drain: fairDrain(i, def, rows),
  };
  const dirs = { ">": [1, 0], "<": [-1, 0], "^": [0, -1], "v": [0, 1] };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = def.map[y][x], i2 = y * cols + x;
    L.tile[i2] = ch === "#" || ch === "W" ? "#" : ch === "D" ? "D" : ch === "G" ? "G" : ".";
    if (ch === "W") L.echoWalls.add(i2);
    const cx = x + 0.5, cy = y + 0.5;
    if (dirs[ch]) L.flow[i2] = dirs[ch];
    if (ch === "S") { L.lumi.x = cx; L.lumi.y = cy; }
    if (ch === "E") L.exit = { x: cx, y: cy, i: i2 };
    if (ch === "o") L.lights.push({ x: cx, y: cy, i: i2, got: false, ph: Math.random() * 6 });
    if (ch === "c") L.crystals.push({ x: cx, y: cy, i: i2, on: 0, cells: null });
    if (ch === "z") L.critters.push({ x: cx, y: cy, hx: cx, hy: cy, i: i2, awake: 0, ph: Math.random() * 6 });
    if (ch === "b") L.moths.push({ x: cx, y: cy, hx: cx, hy: cy, following: false, ph: Math.random() * 6, idx: 0 });
    if (ch === "r") L.runes.push({ x: cx, y: cy, i: i2, on: 0, far: 0 });
    if (ch === "G") L.gate = { x: cx, y: cy, i: i2, open: 0 };
    if (ch === "m") L.baby = { x: cx, y: cy, hx: cx, hy: cy, following: false, ph: Math.random() * 6 };
    if (ch === "g" && !save.settings.relaxed) L.gloom.push({ x: cx, y: cy, hx: cx, hy: cy, hunt: 0, gone: 0, ph: Math.random() * 6 });
    if (ch === "B" && !save.settings.relaxed) L.gloom.push({ x: cx, y: cy, hx: cx, hy: cy, hunt: 0, gone: 0, ph: Math.random() * 6, big: true });
    if (MOB_KINDS.includes(ch) && !save.settings.relaxed) L.mobs.push(makeMob(ch, cx, cy, i2));
    if (ch === "t") L.thorns.push({ x: cx, y: cy, i: i2, ph: Math.random() * Math.PI * 2, rattle: Math.random() });
    if (ch === "f") L.family = { x: cx, y: cy, i: i2, got: false, ph: Math.random() * 6, w: worldOf(i) };
  }
  // The open part of the cave, which the camera keeps to.
  L.bounds = { x0: cols, x1: 0, y0: rows, y1: 0 };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (L.tile[y * cols + x] === "#") continue;
    L.bounds.x0 = Math.min(L.bounds.x0, x); L.bounds.x1 = Math.max(L.bounds.x1, x);
    L.bounds.y0 = Math.min(L.bounds.y0, y); L.bounds.y1 = Math.max(L.bounds.y1, y);
  }
  initMobs();
  // Each Thornling patrols the longer of its row or column of open tiles, end to end.
  for (const t of L.thorns) {
    const tx = Math.floor(t.x), ty = Math.floor(t.y), open = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && L.tile[y * cols + x] === ".";
    let l = tx, r = tx, u = ty, d = ty;
    while (open(l - 1, ty)) l--;
    while (open(r + 1, ty)) r++;
    while (open(tx, u - 1)) u--;
    while (open(tx, d + 1)) d++;
    const across = r - l >= d - u;
    t.a = across ? [l + 0.5, ty + 0.5] : [tx + 0.5, u + 0.5];
    t.b = across ? [r + 0.5, ty + 0.5] : [tx + 0.5, d + 0.5];
    t.len = Math.max(0.01, Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]));
  }
  let seed = ((i + 1000003) * 9973) % 2147483647 || 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  L.shrooms = [];
  const rock = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || L.tile[y * cols + x] === "#";
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i2 = y * cols + x;
    if (L.tile[i2] !== "." || !rock(x, y + 1) || rnd() >= 0.26) continue;
    const k = 1 + Math.floor(rnd() * 2), x0 = x + 0.25 + rnd() * 0.4;
    for (let q = 0; q < k; q++) L.shrooms.push({ x: x0 + q * 0.22, y: y + 1.06, s: q ? 0.09 + rnd() * 0.03 : 0.13 + rnd() * 0.04, pink: rnd() < 0.35, i: i2, ph: rnd() * 6 });
  }
  planDecor();
  mood = MOODS[themeIndex(i)];
  musicStart(i === WEEKLY ? weekNumber() + 7 : i < 0 ? dayNumber() : i, demo ? 0 : 2);
  layout();
  updateHud();
  if (demo) return;
  setHint(def.hint === "first" ? "Tap anywhere to sing 🎵" : def.hint || goalLine(), def.hint === "first" ? 0 : 4.5);
}

// One short line about what this cave asks of you, shown at the start and in the pause menu.
function goalLine() {
  const i = levelIndex;
  if (L.goal === "quiet") return `Only ${L.songLimit} songs here. Make them count`;
  if (L.goal === "rescue") return "Find the lost baby moth and bring it home";
  if (L.goal === "race" && L.timeLeft) return `Reach the portal in ${Math.ceil(L.timeLeft)} seconds`;
  if (L.dark) return "Total darkness. Only your song shows the way";
  if (L.runes.length) return "Sing close to each rune stone to open the gate";
  if (i === 2) return "Lights and crystals refill Lumi's glow";
  if (i === DAILY) return "Today's cave is the same for everyone";
  if (i === WEEKLY) return "This week's cave: harder, and the same for everyone";
  if (i > 0 && isFinale(i)) return "World finale: one extra light to find";
  if (i > 0 && i % PER_WORLD === 0) return `World ${worldOf(i) + 1}: ${worldName(worldOf(i))}`;
  return "";
}

// How fast Lumi's light fades. It gets a little faster deeper in, but never so fast that a
// careful player swimming the whole route at a slow pace (and singing as they go) runs out.
function fairDrain(i, def, rows) {
  const base = (1.0 + depthOf(i) * 0.5) * 18 / rows;
  if (!def.walk) return base;
  const flat = def.map.join(""), lights = flat.split("o").length - 1, gloom = (flat.match(/[gB]/g) || []).length + (flat.match(/[tnakwj]/g) || []).length * 0.9;
  // Light gained from lights, minus what songs (about one every five tiles) and a couple of
  // Gloomling touches cost, spread over the time a careful swim takes.
  const songs = (def.walk / 5) * 2.5 * (def.dark ? 0.6 : 1);
  const budget = Math.max(60, 100 + 35 * lights - songs - gloom * 30);
  const seconds = def.walk / 2 + 10;
  return Math.max(0.35, Math.min(base, (budget * 0.6) / seconds));
}

const idx = (x, y) => y * L.cols + x;
function solidAt(x, y) {
  if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return true;
  const i = y * L.cols + x, t = L.tile[i];
  return t === "#" || (t === "D" && L.door[i] <= 0) || (t === "G" && !L.gate.open);
}

// Distances the song travels from a point, flowing around corners but never through rock.
let doneBuf = new Uint8Array(0), frontier = [];
function soundMap(px, py, maxD, out) {
  const n = L.n, dist = out || new Float32Array(n);
  dist.fill(Infinity);
  if (doneBuf.length !== n) doneBuf = new Uint8Array(n);
  const done = doneBuf;
  done.fill(0);
  const sx = Math.floor(px), sy = Math.floor(py);
  if (solidAt(sx, sy)) return dist;
  const s0 = idx(sx, sy);
  dist[s0] = Math.hypot(px - sx - 0.5, py - sy - 0.5);
  frontier.length = 0;
  frontier.push(s0);
  while (frontier.length) {
    let bk = 0;
    for (let k = 1; k < frontier.length; k++) if (dist[frontier[k]] < dist[frontier[bk]]) bk = k;
    const best = frontier[bk], bd = dist[best];
    frontier[bk] = frontier[frontier.length - 1];
    frontier.pop();
    if (done[best]) continue;
    if (bd > maxD) break;
    done[best] = 1;
    const x = best % L.cols, y = (best / L.cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (solidAt(nx, ny)) continue;
      if (dx && dy && (solidAt(x + dx, y) || solidAt(x, y + dy))) continue;
      const j = idx(nx, ny), nd = bd + (dx && dy ? 1.414 : 1);
      if (nd < dist[j]) { dist[j] = nd; frontier.push(j); }
    }
  }
  return dist;
}

// Call fn(neighbourIndex, isSide) for the rock around an open tile.
function eachSolidNeighbour(i, fn) {
  const x = i % L.cols, y = (i / L.cols) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
    if (solidAt(nx, ny)) fn(idx(nx, ny), !(dx && dy));
  }
}

// ---------- Actions ----------
const LONG_RANGE = 11.5, LONG_SPEED = 6.5;
// Floating particles per cave style: motes, pollen, sparkles, embers, snow, bubbles, gold dust, stars.
const PARTICLES = [
  { glow: "white", vy: -0.12, wob: 0.05, rate: 7 },
  { glow: "green", vy: -0.05, wob: 0.14, rate: 7 },
  { glow: "violet", vy: 0, wob: 0.02, rate: 6, twinkle: true },
  { glow: "ember", vy: -0.5, wob: 0.1, rate: 9 },
  { glow: "white", vy: 0.38, wob: 0.12, rate: 11 },
  { glow: "cyan", vy: -0.32, wob: 0.1, rate: 6, bubble: true },
  { glow: "gold", vy: 0.08, wob: 0.04, rate: 6 },
  { glow: "pink", vy: 0, wob: 0.02, rate: 6, twinkle: true },
];
function ping(long = false) {
  if (!L || L.ending || L.failing || L.pingCd > 0 || (screen !== "play" && !L.demo)) return;
  if (L.songLimit && L.pings >= L.songLimit && !L.demo) {
    setHint("No songs left. Remember the way!", 2.5);
    buzz(15);
    L.pingCd = 0.6;
    return;
  }
  L.pingCd = 0.4;
  if (!L.demo) L.pings++;
  // Dark caves need more songs, so each costs less there; a long song costs more.
  if (L.useEnergy && !L.demo) L.energy = Math.max(0.5, L.energy - (L.dark ? 1.5 : 2.5) * (long ? 1.6 : 1));
  const range = long ? LONG_RANGE : WAVE_RANGE;
  L.waves.push({ dist: soundMap(L.lumi.x, L.lumi.y, range + 1), r: 0, prev: -1, range, speed: long ? LONG_SPEED : WAVE_SPEED, echoed: new Set(), long });
  L.lumi.sing = long ? 0.9 : 0.45;
  if (!L.demo) { long ? sfx.longSong(L.pings - 1) : sfx.ping(L.pings - 1); buzz(long ? [10, 30, 20] : 8); }
  for (let k = 0; k < 14; k++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 1.5;
    spark(L.lumi.x, L.lumi.y, Math.cos(a) * s, Math.sin(a) * s, 0.6, "skin", 0.12);
  }
  if (L.def.hint === "first" && L.tut === 0 && !L.demo && !long) { L.tut = 1; setHint("Now put your thumb down anywhere and slide it to swim", 0); }
  updateHud();
}

const RUNE_RANGE = 2.6;
function reveal(i, d = 0, w = null) {
  L.lit[i] = 1;
  const snore = w && w.snore;  // a Snoozle's snore lights the walls but wakes nothing
  for (const r of L.runes) {
    if (snore) break;
    if (r.i !== i || r.on) continue;
    if (d <= RUNE_RANGE) wakeRune(r);
    else {
      r.far = 1;
      if (!L.runeHinted && !L.demo) { L.runeHinted = true; setHint("The rune stone heard you, but faintly. Sing closer to it", 3.5); }
    }
  }
  L.seen[i] = 1;
  eachSolidNeighbour(i, (j, side) => {
    L.lit[j] = 1;
    L.seen[j] = 1;
    if (side && L.tile[j] === "D") openDoor(j);
    if (side && w && L.echoWalls.has(j) && !w.echoed.has(j) && L.waves.length < 10) echoFrom(i, j, d, w);
  });
  for (const c of L.crystals) if (c.i === i && !c.on) lightCrystal(c);
  if (!snore) wakeMobsAt(i);
  for (const g of L.gloom) {
    if (snore || g.gone > 0 || g.hunt > 0 || g.calm > 0 || idx(Math.floor(g.x), Math.floor(g.y)) !== i) continue;
    // Only a song heard fairly close by wakes a Gloomling, not a faint echo from far away.
    if (Math.hypot(g.x - L.lumi.x, g.y - L.lumi.y) > (g.big ? 7 : 6)) continue;
    g.hunt = g.big ? 5 : 2.8;
    sfx.gloomWake(g.x - L.lumi.x, g.big);
  }
}

function echoFrom(i, j, d, w) {
  w.echoed.add(j);
  const left = Math.max(3.5, w.range - d + 2.5);
  const x = (i % L.cols) + 0.5, y = ((i / L.cols) | 0) + 0.5;
  L.waves.push({ dist: soundMap(x, y, left + 1), r: 0, prev: -1, range: left, speed: w.speed, echoed: new Set(w.echoed), echo: true });
  L.echoFlash = L.echoFlash || new Map();
  L.echoFlash.set(j, 1);
  sfx.echo(x - L.lumi.x);
}

function wakeRune(r) {
  r.on = 0.001;
  sfx.rune();
  buzz(15);
  for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28; spark(r.x, r.y, Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0.8, "green", 0.09); }
  if (L.gate && L.runes.every(q => q.on)) {
    L.gate.open = 1;
    sfx.gate();
    buzz([20, 30, 40]);
    L.lit[L.gate.i] = 1;
    eachSolidNeighbour(L.gate.i, j => { L.lit[j] = 1; L.seen[j] = 1; });
    for (let k = 0; k < 24; k++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 2; spark(L.gate.x, L.gate.y, Math.cos(a) * s, Math.sin(a) * s, 1, "green", 0.1); }
    if (!L.demo) setHint("The gate is open!", 2.5);
  }
}

function openDoor(j) {
  if (L.door[j] <= 0) sfx.door();
  L.door[j] = DOOR_TIME;
}

function lightCrystal(c) {
  c.on = 0.001;
  const d = soundMap(c.x, c.y, 2.6);
  c.cells = [];
  for (let i = 0; i < L.n; i++) if (d[i] < 2.6) {
    const v = 1 - d[i] / 2.8;
    c.cells.push(i, v);
    eachSolidNeighbour(i, j => c.cells.push(j, v * 0.95));
  }
  sfx.crystal();
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * Math.PI * 2;
    spark(c.x, c.y, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.9, "violet", 0.1);
  }
}

function spark(x, y, vx, vy, life, color, size) {
  if (L.particles.length > 300) return;
  L.particles.push({ x, y, vx, vy, life, max: life, color, size });
}

// ---------- Input ----------
const pointers = new Map();
let steer = null;
const keys = {};

canvas.addEventListener("pointerdown", e => {
  audio();
  if (screen === "title") return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), moved: false });
  if (steer == null) steer = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener("pointermove", e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true;
  // If the thumb slides past the edge of the stick, drag the stick along so turning back is instant.
  const dx = p.x - p.ax, dy = p.y - p.ay, d = Math.hypot(dx, dy);
  if (d > STICK_R) { p.ax = p.x - dx / d * STICK_R; p.ay = p.y - dy / d * STICK_R; }
});
// Controls: "dual" (slide to swim, Sing button for the other thumb; the default), "stick"
// (slide to swim, tap to sing, hold still for a long song) or "tap" (tap where to go).
const controlMode = () => save.settings.controls || "dual";
const LONG_HOLD = 380;  // ms of holding still before a long song starts charging

// Tap-to-move: Lumi finds its own way to the tapped spot along open tiles.
function travelTo(px, py) {
  if (!L || L.ending || L.failing) return;
  let tx = Math.floor((px - OX) / TS), ty = Math.floor((py - OY) / TS);
  if (solidAt(tx, ty)) {
    let best = null, bd = Infinity;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!solidAt(tx + dx, ty + dy) && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); best = [tx + dx, ty + dy]; }
    }
    if (!best) return;
    [tx, ty] = best;
  }
  const sx0 = Math.floor(L.lumi.x), sy0 = Math.floor(L.lumi.y), prev = new Map([[sx0 + "," + sy0, null]]), q = [[sx0, sy0]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + "," + (y + dy);
      if (solidAt(x + dx, y + dy) || prev.has(k)) continue;
      prev.set(k, [x, y]);
      q.push([x + dx, y + dy]);
    }
  }
  if (!prev.has(tx + "," + ty)) { setHint("Lumi can't find a way there yet", 1.5); return; }
  const path = [];
  for (let c = [tx, ty]; c; c = prev.get(c + "")) path.unshift([c[0] + 0.5, c[1] + 0.5]);
  path.shift();
  L.autoPath = path;
  L.tapMark = { x: tx + 0.5, y: ty + 0.5, t: 1 };
}

// The Sing button (tap-to-move mode): tap to sing, hold for a long song.
let singHold = 0;
const singBtn = document.getElementById("singBtn");
singBtn.addEventListener("pointerdown", e => { e.stopPropagation(); audio(); singHold = performance.now(); try { singBtn.setPointerCapture(e.pointerId); } catch (err) {} });
singBtn.addEventListener("pointerup", e => {
  e.stopPropagation();
  if (!singHold || !L) return;
  const held = performance.now() - singHold;
  singHold = 0;
  if (held < LONG_HOLD) ping(); else if (L.charge >= 1) ping(true);
  L.charge = 0;
});
singBtn.addEventListener("pointercancel", () => { singHold = 0; if (L) L.charge = 0; });
function pointerEnd(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  const held = performance.now() - p.t;
  if (!p.moved && e.type === "pointerup" && L) {
    if (controlMode() === "tap") { if (held < LONG_HOLD) travelTo(p.x, p.y); }
    else if (held < LONG_HOLD) ping();
    else if (L.charge >= 1) ping(true);
  }
  if (L) L.charge = 0;
  if (steer === e.pointerId) steer = pointers.size ? pointers.keys().next().value : null;
}
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);

window.addEventListener("keydown", e => {
  audio();
  keys[e.key.toLowerCase()] = true;
  if (screen === "play") {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) ping(e.shiftKey); }
    if (e.key === "Escape" || e.key.toLowerCase() === "p") pause();
  } else if (screen === "pause" && (e.key === "Escape" || e.key.toLowerCase() === "p")) resume();
});
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

// ---------- Update ----------
function update(dt) {
  L.time += dt;
  moveCamera(dt);
  L.pingCd -= dt;
  L.bumpCd -= dt;
  const lumi = L.lumi;

  // Holding a finger still charges a long song; the ring around Lumi shows how full it is.
  {
    const hp = steer != null ? pointers.get(steer) : null;
    const held = singHold ? performance.now() - singHold - LONG_HOLD
      : hp && !hp.moved && controlMode() === "stick" ? performance.now() - hp.t - LONG_HOLD : -1;
    const before = L.charge;
    L.charge = held > 0 && !L.ending && !L.failing ? Math.min(1, held / 550) : 0;
    if (before < 1 && L.charge >= 1) { buzz(12); sfx.charged(); }
  }

  // Steering: the floating stick or the keyboard sets the speed Lumi wants to swim at.
  let wx = 0, wy = 0;
  const ctl = !L.ending && !L.failing && !L.demo;
  const p = steer != null ? pointers.get(steer) : null;
  if (L.demo) {
    // Title screen: Lumi floats in place and sings now and then.
    lumi.vy = Math.sin(L.time * 1.4) * 0.12;
    if ((L.demoT -= dt) <= 0) { L.demoT = 3.2; ping(); }
  }
  if (p && p.moved && ctl) {
    const dx = p.x - p.ax, dy = p.y - p.ay, d = Math.hypot(dx, dy);
    if (d > STICK_DEAD) {
      const k = SWIM_MAX * Math.min(1, (d - STICK_DEAD) / (STICK_R - STICK_DEAD)) / d;
      wx = dx * k; wy = dy * k;
    }
  }
  if (ctl) {
    const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); wx = kx / m * SWIM_MAX; wy = ky / m * SWIM_MAX; }
  }
  // Following a tapped route, unless the player steers by hand.
  if (wx || wy) L.autoPath = null;
  else if (L.autoPath && L.autoPath.length && ctl) {
    let [tx, ty] = L.autoPath[0];
    if (Math.hypot(tx - lumi.x, ty - lumi.y) < 0.3) { L.autoPath.shift(); if (!L.autoPath.length) L.autoPath = null; }
    if (L.autoPath) {
      [tx, ty] = L.autoPath[0];
      const dx = tx - lumi.x, dy = ty - lumi.y, d = Math.hypot(dx, dy) || 1;
      const sp = SWIM_MAX * Math.min(1, 0.45 + d);
      wx = dx / d * sp; wy = dy / d * sp;
    }
  }
  if (L.tapMark) L.tapMark.t -= dt * 1.5;
  const steering = wx || wy;
  if (steering) {
    L.moved += dt;
    if (L.def.hint === "first" && L.tut === 1 && L.moved > 0.6) { L.tut = 2; setHint("Find the golden light, then the portal ✦", 6); }
    // Lane assist: when heading into an open tunnel, ease Lumi toward its middle so corners don't catch.
    // If the way straight ahead is rock but the tunnel opens just beside it, slide over to it.
    const cx = Math.floor(lumi.x), cy = Math.floor(lumi.y);
    // open(d): the tile d steps sideways is open, and so is the tile ahead of it.
    const lane = (pos, center, open, narrow) => {
      if (open(0)) return narrow ? (center - pos) * 6 : 0;
      const pref = pos < center ? -1 : 1;
      for (const sd of [pref, -pref]) if (open(sd)) return sd * SWIM_MAX * 0.9;
      return 0;
    };
    if (Math.abs(wx) > Math.abs(wy) * 1.2) {
      const ax = Math.sign(wx);
      wy += lane(lumi.y, cy + 0.5, d => !solidAt(cx, cy + d) && !solidAt(cx + ax, cy + d), solidAt(cx + ax, cy - 1) && solidAt(cx + ax, cy + 1));
    } else if (Math.abs(wy) > Math.abs(wx) * 1.2) {
      const ay = Math.sign(wy);
      wx += lane(lumi.x, cx + 0.5, d => !solidAt(cx + d, cy) && !solidAt(cx + d, cy + ay), solidAt(cx - 1, cy + ay) && solidAt(cx + 1, cy + ay));
    }
  }

  // A Frostwisp's touch leaves Lumi half frozen for a moment.
  if (L.slow > 0) { wx *= 0.45; wy *= 0.45; }
  // Lumi eases toward the wanted speed: quick to start, quick to stop.
  const grip = 1 - Math.exp(-(steering ? SWIM_GRIP : SWIM_GRIP * 0.75) * dt);
  lumi.vx += (wx - lumi.vx) * grip;
  lumi.vy += (wy - lumi.vy) * grip;

  // Water currents push you along.
  const ti = idx(Math.floor(lumi.x), Math.floor(lumi.y));
  const f = L.flow[ti];
  if (f) { lumi.vx += f[0] * CURRENT_ACC * dt; lumi.vy += f[1] * CURRENT_ACC * dt; }
  const sp = Math.hypot(lumi.vx, lumi.vy), maxSp = SWIM_MAX * (f ? 1.4 : 1.15);
  if (sp > maxSp) { lumi.vx *= maxSp / sp; lumi.vy *= maxSp / sp; }
  if (sp > 0.25) lumi.look = Math.atan2(lumi.vy, lumi.vx);

  if (!L.ending && !L.failing) {
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      lumi.x += lumi.vx * dt / steps;
      lumi.y += lumi.vy * dt / steps;
      collide(lumi);
    }
  }
  lumi.sing = Math.max(0, lumi.sing - dt);
  lumi.squash = Math.max(0, lumi.squash - dt * 4);
  lumi.blink -= dt;
  if (lumi.blink < -0.12) lumi.blink = 2 + Math.random() * 3;
  if (Math.random() < dt * 14 && sp > 0.5) spark(lumi.x - lumi.vx * 0.05, lumi.y - lumi.vy * 0.05, -lumi.vx * 0.15, -lumi.vy * 0.15, 0.5, "skin", 0.06);

  // Doors close again after a while (never on top of Lumi).
  for (let i = 0; i < L.n; i++) {
    if (L.tile[i] !== "D") continue;
    if (L.door[i] > 0) {
      L.door[i] -= dt;
      if (L.door[i] <= 0) {
        const x = i % L.cols, y = (i / L.cols) | 0;
        const nx = Math.max(x, Math.min(lumi.x, x + 1)), ny = Math.max(y, Math.min(lumi.y, y + 1));
        if (Math.hypot(lumi.x - nx, lumi.y - ny) < LUMI_R + 0.02) L.door[i] = 0.15;
        else { L.door[i] = 0; sfx.doorClose(); L.lit[i] = Math.max(L.lit[i], 0.6); }
      }
    }
    L.doorAnim[i] += ((L.door[i] > 0 ? 1 : 0) - L.doorAnim[i]) * Math.min(1, dt * 8);
  }

  // Song waves spread through the cave.
  for (let k = L.waves.length - 1; k >= 0; k--) {
    const w = L.waves[k];
    w.r += w.speed * dt;
    for (let i = 0; i < L.n; i++) {
      const d = w.dist[i];
      if (d > w.prev && d <= w.r && d <= w.range) reveal(i, d, w);
    }
    w.prev = w.r;
    if (w.r > w.range + 1.5) L.waves.splice(k, 1);
  }

  // Light: song fades, Lumi, moths and crystals glow.
  for (let i = 0; i < L.n; i++) { L.lit[i] = Math.max(0, L.lit[i] - dt * 0.42); L.glowT[i] = 0; }
  const followers = L.moths.filter(m => m.following).length;
  const R = (1.5 + followers * 0.75) * (L.useEnergy ? 0.55 + 0.45 * Math.min(1, L.energy / 40) : 1);
  const near = soundMap(lumi.x, lumi.y, R, L.nearBuf || (L.nearBuf = new Float32Array(L.n)));
  for (let i = 0; i < L.n; i++) if (near[i] < R) {
    const v = 1 - near[i] / R;
    if (v > L.glowT[i]) L.glowT[i] = v;
    eachSolidNeighbour(i, j => { const vv = v * 0.9; if (vv > L.glowT[j]) L.glowT[j] = vv; if (vv > 0.35) L.seen[j] = 1; });
  }
  for (const c of L.crystals) {
    if (!c.on) continue;
    c.on = Math.min(1, c.on + dt * 1.5);
    for (let q = 0; q < c.cells.length; q += 2) {
      const v = c.cells[q + 1] * c.on * 0.85, j = c.cells[q];
      if (v > L.glowT[j]) L.glowT[j] = v;
      L.seen[j] = 1;
    }
  }
  const blend = Math.min(1, dt * 7);
  for (let i = 0; i < L.n; i++) L.glow[i] += (L.glowT[i] - L.glow[i]) * blend;

  // Lost lights.
  for (const o of L.lights) {
    if (o.got || L.demo || Math.hypot(o.x - lumi.x, o.y - lumi.y) > 0.5) continue;
    o.got = true;
    L.got++;
    L.happy = 1.5;
    if (L.useEnergy) L.energy = Math.min(100, L.energy + 35);
    music.layers = 3;
    sfx.light();
    buzz(20);
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 2;
      spark(o.x, o.y, Math.cos(a) * s, Math.sin(a) * s, 0.9, "gold", 0.1);
    }
    updateHud();
    if (L.got === L.lights.length && L.lights.length > 1) setHint("All lights found! Now find the portal", 3.5);
  }

  // Glow-moths.
  let fi = 0;
  for (const m of L.moths) {
    m.ph += dt;
    if (!m.following && !L.demo && Math.hypot(m.x - lumi.x, m.y - lumi.y) < 0.7) {
      m.following = true;
      L.mothsMet = (L.mothsMet || 0) + 1;
      if (L.useEnergy) L.energy = Math.min(100, L.energy + 15);
      sfx.moth();
      buzz(10);
    }
    let tx, ty;
    if (m.following) {
      const a = L.time * 1.6 + fi * (Math.PI * 2 / Math.max(1, followers));
      tx = lumi.x + Math.cos(a) * 0.6; ty = lumi.y + Math.sin(a) * 0.45 - 0.15;
      fi++;
    } else {
      tx = m.hx + Math.sin(m.ph * 1.3) * 0.12; ty = m.hy + Math.cos(m.ph * 0.9) * 0.1;
    }
    m.x += (tx - m.x) * Math.min(1, dt * 4);
    m.y += (ty - m.y) * Math.min(1, dt * 4);
  }

  // Snoozles push you away if you bump them. While asleep they snore, and each snore is a
  // tiny pulse of sound that lights the walls around them (handy in the dark).
  for (const c of L.critters) {
    c.ph += dt;
    c.awake = Math.max(0, c.awake - dt);
    c.quiet = Math.max(0, (c.quiet || 0) - dt);
    if (!c.awake && !c.quiet && !L.demo && (c.snoreT = (c.snoreT == null ? Math.random() * 3 : c.snoreT) - dt) <= 0) {
      c.snoreT = 3.2 + Math.random() * 1.6;
      L.waves.push({ dist: soundMap(c.hx, c.hy, 3), r: 0, prev: -1, range: 2.3, speed: 3.5, echoed: new Set(), snore: true });
      if (Math.hypot(c.x - lumi.x, c.y - lumi.y) < 7) sfx.snore(c.x - lumi.x);
    }
    const dx = lumi.x - c.x, dy = lumi.y - c.y, d = Math.hypot(dx, dy);
    if (d < LUMI_R + CRITTER_R && !L.ending && !L.failing && !L.demo) {
      const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : 1;
      lumi.x = c.x + nx * (LUMI_R + CRITTER_R + 0.01);
      lumi.y = c.y + ny * (LUMI_R + CRITTER_R + 0.01);
      lumi.vx = nx * 4.5; lumi.vy = ny * 4.5;
      collide(lumi);
      lumi.squash = 1;
      if (c.awake < 1) { sfx.grumble(); buzz(35); }
      c.awake = 1.8;
      c.quiet = 8;
      L.lit[c.i] = 1;
      eachSolidNeighbour(c.i, j => { L.lit[j] = Math.max(L.lit[j], 0.8); L.seen[j] = 1; });
    }
    const wob = c.awake > 0 ? Math.sin(c.ph * 30) * 0.03 * c.awake : 0;
    c.x = c.hx + wob;
  }

  // Gloomlings drift at home, then chase you for a while after hearing a song.
  // They're shadows, so rock doesn't stop them. Touching one costs light.
  for (const g of L.gloom) {
    g.ph += dt;
    if (g.gone > 0) { g.gone -= dt; if (g.gone <= 0) { g.x = g.hx; g.y = g.hy; } continue; }
    // After a touch, a Gloomling rests at home for a while before a song can wake it again.
    g.calm = Math.max(0, (g.calm || 0) - dt);
    g.hunt = Math.max(0, g.hunt - dt);
    const hunting = g.hunt > 0 && ctl;
    const tx = hunting ? lumi.x : g.hx + Math.sin(g.ph * 0.7) * 0.3;
    const ty = hunting ? lumi.y : g.hy + Math.cos(g.ph * 0.5) * 0.3;
    const spd = g.big ? (hunting ? 0.85 : 0.35) : hunting ? 1.15 + depthOf(levelIndex) * 0.3 : 0.6;
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { const m = Math.min(d, spd * dt) / d; g.x += dx * m; g.y += dy * m; }
    if (ctl && Math.hypot(lumi.x - g.x, lumi.y - g.y) < LUMI_R + (g.big ? 0.6 : 0.28)) {
      const nx = (lumi.x - g.x) / (Math.hypot(lumi.x - g.x, lumi.y - g.y) || 1), ny = (lumi.y - g.y) / (Math.hypot(lumi.x - g.x, lumi.y - g.y) || 1);
      lumi.vx = nx * 4; lumi.vy = ny * 4;
      lumi.squash = 1;
      if (L.useEnergy) L.energy = Math.max(0, L.energy - (g.big ? 26 : 16));
      L.hits++;
      g.gone = g.big ? 10 : 8;
      g.calm = g.big ? 8 : 6;
      sfx.hurt();
      buzz(50);
      for (let k = 0; k < 16; k++) { const a = Math.random() * 6.28; spark(g.x, g.y, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.7, "violet", 0.1); }
    }
  }

  // Light energy: drains slowly, crystals recharge it, and running out ends the try.
  if (L.useEnergy && ctl) {
    L.energy -= dt * L.drain;
    for (const c of L.crystals) if (c.on && Math.hypot(c.x - lumi.x, c.y - lumi.y) < 1.4) L.energy += dt * 22;
    L.energy = Math.min(100, L.energy);
    if (L.energy < 25 && (L.lowCd -= dt) <= 0) { sfx.lowEnergy(); L.lowCd = 1.5; }
    if (L.energy <= 0) {
      L.energy = 0;
      L.failing = 0.001;
      L.failWhy = "energy";
      musicStop();
      sfx.fail();
      buzz([40, 60, 40]);
      setHint("", 0);
    }
  }
  if (L.failing) {
    L.failing += dt;
    if (L.failing > 1.5 && !L.done) { L.done = true; failLevel(); }
  }

  // The lost baby moth waits to be found, then stays close to Lumi.
  const baby = L.baby;
  if (baby) {
    baby.ph += dt;
    if (!baby.following && ctl && Math.hypot(baby.x - lumi.x, baby.y - lumi.y) < 0.7) {
      baby.following = true;
      sfx.moth();
      sfx.light();
      buzz(20);
      setHint("Found it! Now bring the baby moth to the portal", 3);
    }
    const tx = baby.following ? lumi.x - Math.cos(lumi.look) * 0.55 : baby.hx + Math.sin(baby.ph * 2) * 0.1;
    const ty = baby.following ? lumi.y - Math.sin(lumi.look) * 0.55 - 0.1 : baby.hy + Math.cos(baby.ph * 1.6) * 0.08;
    baby.x += (tx - baby.x) * Math.min(1, dt * 5);
    baby.y += (ty - baby.y) * Math.min(1, dt * 5);
  }
  // Race caves count down; running out of time ends the try.
  if (L.timeLeft > 0 && ctl) {
    L.timeLeft -= dt;
    if (Math.ceil(L.timeLeft) !== L.shownTime) { L.shownTime = Math.ceil(L.timeLeft); updateHud(); if (L.timeLeft < 10 && L.timeLeft > 0) sfx.tick(); }
    if (L.timeLeft <= 0) {
      L.timeLeft = 0;
      L.failing = 0.001;
      L.failWhy = "time";
      musicStop();
      sfx.fail();
      buzz([40, 60, 40]);
      setHint("", 0);
    }
  }
  for (const r of L.runes) { if (r.on) r.on = Math.min(1, r.on + dt * 2); r.far = Math.max(0, r.far - dt * 1.5); }
  if (L.gate && L.gate.open) L.gate.open = Math.min(2, L.gate.open + dt);
  L.portalHintCd -= dt;

  // Thornlings glide back and forth along their tunnels. They're hard to see in the dark, but
  // they rattle when close; touching one costs light and bounces Lumi back.
  L.invuln = Math.max(0, L.invuln - dt);
  for (const t of L.thorns) {
    t.ph += dt * (1.4 + depthOf(levelIndex) * 0.8) * Math.PI / t.len;
    const k = (1 - Math.cos(t.ph)) / 2;
    t.x = t.a[0] + (t.b[0] - t.a[0]) * k;
    t.y = t.a[1] + (t.b[1] - t.a[1]) * k;
    const dx = lumi.x - t.x, dy = lumi.y - t.y, d = Math.hypot(dx, dy);
    if (d < 3.5 && !L.demo && (t.rattle -= dt * (1.6 - d * 0.3)) <= 0) { t.rattle = 0.7; sfx.rattle(t.x - lumi.x, 1 - d / 3.5); }
    if (ctl && L.invuln <= 0 && d < LUMI_R + 0.27) {
      const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : 1;
      lumi.vx = nx * 5; lumi.vy = ny * 5;
      lumi.squash = 1;
      L.invuln = 1.2;
      L.hits++;
      if (L.useEnergy) L.energy = Math.max(0, L.energy - 12);
      sfx.hurt();
      buzz([30, 30, 30]);
      L.lit[t.i] = 1;
      for (let q = 0; q < 12; q++) { const a = Math.random() * 6.28; spark(lumi.x, lumi.y, Math.cos(a) * 2, Math.sin(a) * 2, 0.5, "ember", 0.08); }
    }
  }

  updateMobs(dt, ctl);

  // Lumi's mood: scared when a Gloomling hunts nearby, happy after a find, sleepy when dim.
  L.happy = Math.max(0, (L.happy || 0) - dt);
  L.mood = L.gloom.some(g => g.hunt > 0 && !g.gone && Math.hypot(g.x - lumi.x, g.y - lumi.y) < (g.big ? 5 : 3)) ? "scared"
    : L.happy > 0 ? "happy" : L.useEnergy && L.energy < 25 ? "sleepy" : "";

  // One of Lumi's little lights.
  const fam = L.family;
  if (fam && !fam.got) {
    fam.ph += dt;
    if (ctl && Math.hypot(fam.x - lumi.x, fam.y - lumi.y) < 0.55) {
      fam.got = true;
      save.family = save.family || {};
      save.family[fam.w] = 1;
      persist();
      L.happy = 2.5;
      sfx.unlock();
      buzz([20, 30, 20]);
      for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, s = 0.5 + Math.random() * 2.5; spark(fam.x, fam.y, Math.cos(a) * s, Math.sin(a) * s, 1.1, k % 2 ? "pink" : "gold", 0.1); }
      setHint("One of Lumi's little lights! It joins Lumi's family", 3.5);
    }
  }

  // Cave sounds now and then.
  if (!L.demo && (L.ambT -= dt) <= 0) { L.ambT = 3 + Math.random() * 5; sfx.ambient(); }
  L.flash = Math.max(0, L.flash - dt * 1.6);

  // Portal.
  const portalLocked = L.goal === "rescue" && L.baby && !L.baby.following;
  if (ctl && portalLocked && Math.hypot(L.exit.x - lumi.x, L.exit.y - lumi.y) < 0.6 && L.portalHintCd <= 0) {
    L.portalHintCd = 3;
    setHint("The portal is asleep. Bring the lost baby moth here first", 3);
  }
  if (ctl && !portalLocked && Math.hypot(L.exit.x - lumi.x, L.exit.y - lumi.y) < 0.45) {
    L.ending = 0.001;
    L.flash = 1;
    musicStop();
    sfx.win();
    buzz([20, 40, 20]);
    setHint("", 0);
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      spark(L.exit.x, L.exit.y, Math.cos(a) * s, Math.sin(a) * s, 1.2, ["skin", "violet", "gold"][k % 3], 0.1);
    }
  }
  if (L.ending) {
    L.ending += dt;
    lumi.x += (L.exit.x - lumi.x) * Math.min(1, dt * 6);
    lumi.y += (L.exit.y - lumi.y) * Math.min(1, dt * 6);
    if (L.ending > 1.1 && !L.done) { L.done = true; finish(); }
  }

  // Each world has its own floating particles (snow, embers, bubbles...), seen where it's lit.
  const pt = PARTICLES[themeIndex(levelIndex)];
  if (Math.random() < dt * pt.rate) {
    const a = Math.random() * Math.PI * 2, d = 0.5 + Math.random() * 3;
    L.spores.push({ x: lumi.x + Math.cos(a) * d, y: lumi.y + Math.sin(a) * d - pt.vy * 2, vx: (Math.random() - 0.5) * 0.15, life: 0, max: 3 + Math.random() * 3, ph: Math.random() * 6 });
  }
  for (let k = L.spores.length - 1; k >= 0; k--) {
    const s = L.spores[k];
    s.life += dt;
    if (s.life >= s.max) { L.spores.splice(k, 1); continue; }
    s.x += (s.vx + Math.sin(s.life * 1.3 + s.ph) * pt.wob) * dt;
    s.y += pt.vy * dt;
  }
  // Lumi's route, for the map on the results screen.
  if (ctl && (L.pathT = (L.pathT || 0) - dt) <= 0) { L.pathT = 0.2; L.path.push([lumi.x, lumi.y]); }
  L.trail.push([lumi.x, lumi.y]);
  if (L.trail.length > 14) L.trail.shift();

  for (let k = L.particles.length - 1; k >= 0; k--) {
    const q = L.particles[k];
    q.life -= dt;
    if (q.life <= 0) { L.particles.splice(k, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.96; q.vy *= 0.96;
  }

  updateHint(dt);
}

function collide(e) {
  let bump = 0;
  const r = LUMI_R;
  const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solidAt(tx, ty)) continue;
    // Corners of rock that stick out are rounded, like the painted rock, so Lumi glides
    // around them instead of catching on an invisible square edge.
    const RC = 0.35;
    const cxs = e.x < tx + RC ? -1 : e.x > tx + 1 - RC ? 1 : 0, cys = e.y < ty + RC ? -1 : e.y > ty + 1 - RC ? 1 : 0;
    const round = cxs && cys && !solidAt(tx + cxs, ty) && !solidAt(tx, ty + cys);
    const nx = round ? tx + (cxs < 0 ? RC : 1 - RC) : Math.max(tx, Math.min(e.x, tx + 1));
    const ny = round ? ty + (cys < 0 ? RC : 1 - RC) : Math.max(ty, Math.min(e.y, ty + 1));
    const reach = round ? r + RC : r;
    let dx = e.x - nx, dy = e.y - ny, d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    if (d < 1e-6) { dx = e.x - (tx + 0.5); dy = e.y - (ty + 0.5); d = Math.hypot(dx, dy) || 1; e.x += dx / d * 0.05; e.y += dy / d * 0.05; continue; }
    dx /= d; dy /= d;
    e.x += dx * (reach - d); e.y += dy * (reach - d);
    const vn = e.vx * dx + e.vy * dy;
    if (vn < 0) { e.vx -= vn * dx * 1.25; e.vy -= vn * dy * 1.25; bump = Math.max(bump, -vn); }
    if (-vn > 1.5) {
      const j = idx(tx, ty);
      L.lit[j] = Math.max(L.lit[j], 0.7);
      L.seen[j] = 1;
    }
  }
  if (bump > 1.8 && L.bumpCd <= 0) {
    L.bumpCd = 0.25;
    L.bumps++;
    e.squash = Math.min(1, bump / 3);
    sfx.bump();
    buzz(12);
    for (let k = 0; k < 6; k++) spark(e.x, e.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, "cyan", 0.05);
  }
}

// Lumen Rush: the city has blacked out. You are a being of light, swinging across the skyline on a
// tether of light: hold anywhere to latch onto the nearest glowing anchor ahead (masts, lanterns,
// hover-lamps, balloons, neon hoops), let go to fling yourself. Every building you pass lights back
// up behind you, while a wave of darkness follows from behind. Land on rooftops and run; keep off
// the street, building walls, live wires and drones. Let go at the right moment for a Perfect.
// It plugs into the run's shell in run.js (the `run` object, hearts, missions, continue, pause,
// the end card); the 3D view (makeSwing3D) is built on first use.
"use strict";

const RUNNER_POWERS = {
  magnet: { name: "Magnet", dur: 9, rgb: "255,90,110" },
  shield: { name: "Shield", dur: 14, rgb: "90,210,255" },
  comet: { name: "Comet", dur: 4, rgb: "255,200,80" },
};
const runnerM = () => run.dist / RUN.M;
// Forms of light (each with a perk), glow colours, scarves and tethers, bought with lights.
const RUNNER_CHARS = [
  { name: "Aurora", cost: 0, perk: "All-rounder", look: { core: 0xe9fbff, glow: 0x5fe0ff } },
  { name: "Ember", cost: 600, perk: "Your tether reaches 25% further", look: { core: 0xfff0dc, glow: 0xff8a3d } },
  { name: "Tide", cost: 1200, perk: "Starts every run with an extra heart", look: { core: 0xe6fff6, glow: 0x3dffc1 } },
  { name: "Volt", cost: 2000, perk: "Perfect releases fling you harder", look: { core: 0xfffbe0, glow: 0xffd23d } },
  { name: "Nova", cost: 3500, perk: "Every 10th light in a combo is worth +5", look: { core: 0xffeefb, glow: 0xff5cd1 } },
];
const RUNNER_TOPS = [{ name: "Natural", c: null, cost: 0 }, { name: "Sunrise", c: 0xff9a5c, cost: 150 }, { name: "Mint", c: 0x5fffc0, cost: 150 }, { name: "Lilac", c: 0xb39dff, cost: 200 }, { name: "Gold", c: 0xffc23d, cost: 250 }, { name: "Rose", c: 0xff7ab0, cost: 250 }, { name: "Ice", c: 0x9fe8ff, cost: 300 }, { name: "Pure white", c: 0xffffff, cost: 500 }];
const RUNNER_SHOES = [{ name: "Ribbon", c: null, cost: 0, len: 26, w: 0.5 }, { name: "Long silk", c: null, cost: 150, len: 44, w: 0.45 }, { name: "Comet tail", c: 0xffc23d, cost: 200, len: 30, w: 0.8 }, { name: "Twin ribbons", c: null, cost: 300, len: 28, w: 0.4, twin: true }, { name: "Ember", c: 0xff6a3d, cost: 300, len: 22, w: 0.65 }, { name: "Prism", c: "prism", cost: 800, len: 36, w: 0.55 }];
const RUNNER_BOARDS = [{ name: "Classic", c: 0xbff4ff, cost: 0 }, { name: "Gold", c: 0xffc850, cost: 200 }, { name: "Magenta", c: 0xff3d9e, cost: 300 }, { name: "Lime", c: 0x8dff3d, cost: 300 }, { name: "Prism", c: "prism", cost: 800 }];
function runnerLook() {
  if (!save.look || typeof save.look !== "object" || save.look.char == null || save.look.v !== 2) save.look = { v: 2, char: 0, top: 0, shoe: 0, board: 0, own: { c0: 1, t0: 1, s0: 1, b0: 1 } };
  return save.look;
}
const runnerChar = () => RUNNER_CHARS[runnerLook().char] || RUNNER_CHARS[0];
const runnerPerk = name => !run || run.attract ? false : runnerChar().name === name;
const runnerGlow = () => { const L = runnerLook(), c = (RUNNER_TOPS[L.top] || {}).c; return c ?? runnerChar().look.glow; };
// Districts: each has its own buildings and its own kind of anchors.
const RUNNER_THEMES = [
  { name: "Downtown", fac: [0, 2, 3, 0], anchor: "lamp", neon: 0.25, ad: 0.35 },
  { name: "Market Street", fac: [1, 5, 1, 4], anchor: "lantern", neon: 0.3, ad: 0.1, low: true },
  { name: "Waterfront", fac: [1, 4, 2], anchor: "balloon", neon: 0.1, ad: 0.15, water: true, low: true },
  { name: "Neon Arcade", fac: [3, 3, 0, 2], anchor: "ring", neon: 0.85, ad: 0.6 },
  { name: "Park Avenue", fac: [5, 1, 4, 2], anchor: "balloon", neon: 0.15, ad: 0.15, park: true },
];
const runnerTheme = m => typeof run !== "undefined" && run && run.stageInfo ? RUNNER_THEMES[run.stageInfo.theme] : RUNNER_THEMES[Math.floor(Math.max(0, m) / RUN.BIOME_M) % RUNNER_THEMES.length];
// The daily letter hunt: find L-U-M-E-N in the sky in one day.
const HUNT = "LUMEN";
function huntState() { const d = dayNumber(); if (!save.hunt || save.hunt.day !== d) save.hunt = { day: d, got: "" }; return save.hunt; }

// The city you've restored across all runs (3,000 buildings is the whole city).
const cityPct = () => Math.min(100, Math.floor(((save.city && save.city.lit) || 0) / 30));
// Light capsules: open them for lights or a random look you don't own yet.
function openCapsule() {
  if (!(save.capsules > 0)) return null;
  save.capsules--;
  const L = runnerLook(), pool = [];
  [["t", RUNNER_TOPS], ["s", RUNNER_SHOES], ["b", RUNNER_BOARDS]].forEach(([k, list]) => list.forEach((it, i) => { if (!L.own[k + i]) pool.push([k, i, it.name]); }));
  let out;
  if (pool.length && Math.random() < 0.4) { const [k, i, name] = pool[Math.floor(Math.random() * pool.length)]; L.own[k + i] = 1; out = `New: ${name}!`; }
  else { const n = [40, 60, 80, 120, 200, 300][Math.floor(Math.random() ** 1.6 * 6)]; save.glow = (save.glow || 0) + n; out = `+${n} ✦`; }
  persist(); return out;
}
// A little story as you go: who put the city out, and why it's coming back.
const SWING_STORY = [
  ["The Hush took every light in one night.", "Swing on. The city remembers how to shine."],
  ["The markets were the last to go dark.", "Their lanterns are waiting for you."],
  ["The harbour lights guided ships home.", "Something below the water is listening."],
  ["The Hush hates music and neon most.", "Make the arcade loud again."],
  ["The park's old trees still hold the light.", "Dawn is close. Don't let the Heart catch you."],
];
const perfectWindow = R => { const h = R && R.stageInfo ? R.stageInfo.hard : 0; return [5 + h * 9, 75 - h * 12, 10 + h * 4]; };
const SWING = { G: 22, REACH: 28, MAXV: 38 };

function runnerStart(R) {
  Object.assign(R, {
    mode3: true, px: -6, py: 30, vx: 13, vy: 0, hold: false, teth: null, L: 0, anchors: [], blds: [], motes: [], haz: [], ups: [],
    genX: -60, lastA: null, darkX: -50, lit: 0, perfects: 0, roof: null, spin: 0, spinV: 0, fizzle: 0, fireworks: [], nextMile: 500,
    ev: null, nextEv: 380, rec: [], letterOut: false, phase: 0, kick: 0, slowT: 0, nearT: 0, v: 13, nextEvent: 1e9,
    flow: 0, od: 0, dashes: 1, tethT: 0, perfT: 0, dashT: 0, bursts: [], restored: 0,
  });
  if (runnerPerk("Tide")) R.hearts++;
  const gh = save.ghost; R.ghost = R.daily && gh && gh.day === dayNumber() ? gh.rec : null;
  // The run starts mid-swing from a first anchor overhead.
  if (R.stageInfo) {
    Object.assign(R, { stageLen: R.stageInfo.len, darkX: -75, motesTotal: 0, motesGot: 0, trace: [], traceT: 0, stageT: 0, hitsTaken: 0, nextEv: 1e9 });
    const nw = !R.attract && typeof STAGE_NEW !== "undefined" && STAGE_NEW[R.stageInfo.n];
    R.banner = 1.6;
    if (nw && !R.tut) runMsg(nw[0], nw[1], 3, true);
    if (R.stageInfo.boss) { R.ev = { kind: "heart", t: 1e9, hits: 0 }; R.hearted = { all: true }; for (const f of [0.3, 0.6, 0.85]) R.ups.push({ x: R.stageInfo.len * f, y: 26 + runR() * 6, kind: "shard" }); }
  }
  const a0 = { x: 2, y: 40, kind: "lamp", id: 0 }; R.anchors.push(a0); R.lastA = a0;
  swingGen(R, 220);
  R.teth = a0; R.L = Math.hypot(R.px - a0.x, R.py - a0.y); R.hold = true;
  if (R.tut) R.tut = 1;
}

// ---------- Making the skyline ahead ----------
function swingGen(R, toX) {
  const r = runR;
  while (R.genX < toX) {
    const m = Math.max(0, R.genX), th = runnerTheme(m), hard = R.stageInfo ? R.stageInfo.hard : Math.min(1, m / 3000);
    // Anchors: a chain ahead, always reachable from the one before.
    while (R.lastA.x < R.genX + 70 && !(R.stageLen && R.lastA.x > R.stageLen + 40)) {
      const p = R.lastA, ax = p.x + 9 + r() * 5 + hard * (R.stageLen ? 5 : 3), ath = runnerTheme(ax);
      const a = { x: ax, y: Math.max(27, Math.min(46, p.y + (r() - 0.5) * 12)), kind: ath.anchor, id: R.anchors.length, ph: r() * 6 };
      // Special anchors: gold (bonus), crumbling (let go quickly), drifting (moves), spring (launches you).
      const roll = r();
      const wk = weekEvent().id, goldK = wk === "frost" ? 3 : 1;
      const dK = R.stageLen ? hard : null;
      a.type = ax < 60 ? "" : roll < 0.07 * goldK ? "gold" : roll < 0.07 + ((dK != null ? dK > 0.1 : ax > 300) ? 0.08 + (dK || 0) * 0.1 : 0) ? "crumble" : roll < 0.18 + ((dK != null ? dK > 0.16 : ax > 500) ? 0.08 + (dK || 0) * 0.1 : 0) ? "drift" : roll < 0.37 + (wk === "spring" ? 0.25 : 0) ? "spring" : "";
      if (a.type === "drift") a.bx = ax;
      R.anchors.push(a); R.lastA = a;
      // Lights along the arc you'd swing between them.
      if (r() < (R.stageLen ? 0.9 : 0.8) && ax > 10 && !(R.stageLen && ax > R.stageLen)) { const n = 5; for (let q = 1; q <= n; q++) { const t = q / (n + 1); R.motes.push({ x: p.x + (a.x - p.x) * t, y: p.y + (a.y - p.y) * t - 13 * Math.sin(Math.PI * t) - 1, line: a.id }); if (R.stageLen) R.motesTotal++; } }
      // The sky route (stages): a daring pair of high anchors with a trail of bonus lights.
      if (R.stageLen && ax > 60 && ax < R.stageLen - 30 && Math.floor(ax / 85) !== Math.floor(p.x / 85)) {
        const h1 = { x: ax + 3, y: 53 + r() * 3, kind: "lamp", id: R.anchors.length + 5000, ph: r() * 6, type: "gold" }; R.anchors.push(h1);
        for (let q = 0; q < 6; q++) { R.motes.push({ x: ax - 6 + q * 2.6, y: 48 + Math.sin(q / 5 * Math.PI) * 3, line: -2 }); R.motesTotal++; }
      }
      // Power-ups and the letter hunt, on the arc's low point.
      if (R.stageLen && ax > R.stageLen) continue;
      if (ax > 120 && r() < 0.07) { const kinds = Object.keys(RUNNER_POWERS).filter(k => !(R.stageLen && k === "comet")); R.ups.push({ x: (p.x + a.x) / 2, y: (p.y + a.y) / 2 - 12, kind: kinds[Math.floor(r() * kinds.length)] }); }
      else if (!R.attract && !R.tut && !R.letterOut && ax > 160 && r() < 0.06) { const h = huntState(); if (h.got.length < HUNT.length) { R.ups.push({ x: (p.x + a.x) / 2, y: (p.y + a.y) / 2 - 11, kind: "letter", ch: HUNT[h.got.length] }); R.letterOut = true; } }
      // Drones patrol between some anchors later on.
      if ((R.stageLen ? hard > 0.1 && ax > 70 : ax > 260) && r() < 0.12 + hard * 0.26) R.haz.push({ kind: "drone", x: (p.x + a.x) / 2 + (r() - 0.5) * 3, y0: (p.y + a.y) / 2 - 6 - r() * 6, amp: 2.5 + r() * 3, ph: r() * 6 });
    }
    // One building (or a tree in the park), never so tall that it blocks the anchors.
    const gap = (th.water ? 6 : 3) + r() * (th.water ? 10 : 7) + (r() < 0.12 ? 8 : 0), w = 9 + r() * 10, x0 = R.genX + gap, x1 = x0 + w;
    let maxH = 60; for (const a of R.anchors) if (a.x > x0 - 5 && a.x < x1 + 5) maxH = Math.min(maxH, a.y - 14);
    if (x0 < 45) maxH = Math.min(maxH, 15);   // the opening swing always has room
    const tall = (th.low ? 9 : 14) + r() * (th.low ? 12 : 26) + hard * 8;
    const tree = th.park && r() < 0.5;
    const b = { x0, x1: tree ? x0 + 8 + r() * 4 : x1, h: Math.max(7, Math.min(maxH, tree ? 12 + r() * 8 : tall)), style: th.fac[Math.floor(r() * th.fac.length)], litT: -1, n: R.blds.length, tree, seed: r() };
    if (tree) b.x1 = Math.min(b.x1, x1);
    // A live wire between two rooftops of a similar height.
    const prev = R.blds[R.blds.length - 1];
    if (prev && (R.stageLen ? hard > 0.04 && x0 > 50 && x0 < R.stageLen : x0 > 250) && r() < 0.14 + hard * 0.22 && !tree && !prev.tree && Math.abs(prev.h - b.h) < 5 && gap < 9) R.haz.push({ kind: "wire", x0: prev.x1 - 0.4, x1: x0 + 0.4, y: Math.min(prev.h, b.h) + 2.4 });
    R.blds.push(b); R.genX = b.x1;
  }
}
const swingBldAt = (R, x) => R.blds.find(b => x >= b.x0 && x <= b.x1);

// ---------- Holding and letting go ----------
function swingFindAnchor(R) {
  const reach = SWING.REACH * (runnerPerk("Ember") ? 1.25 : 1) * (R.stageInfo ? 1 - R.stageInfo.hard * 0.2 : 1);
  let best = null, bs = -1e9;
  for (const a of R.anchors) {
    if (a.x < R.px - 3 || a.x > R.px + reach) continue;
    const d = Math.hypot(a.x - R.px, a.y - R.py);
    if (d > reach || d < 3 || a.y < R.py + 1 || a.broken) continue;
    const s = (a.x - R.px) - Math.abs(d - 13) * 0.6;
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}
function swingAttach(R) {
  const a = swingFindAnchor(R);
  if (!a) { R.fizzle = 0.25; return false; }
  R.teth = a; R.L = Math.hypot(R.px - a.x, R.py - a.y); R.Lt = Math.max(7, Math.min(11.5, R.L)); R.roof = null; R.spinV = 0; R.tethT = 0; R.dashes = 1;
  R.bursts.push({ x: a.x, y: a.y, t: 0, c: a.type === "gold" ? 0xffd25a : null });
  if (a.type === "gold" && !a.paid) { a.paid = true; R.lights += 5; swingFlow(R, 0.15); if (!R.attract) { runBonus("Gold! +5 ✦", 0, R.dist + 2, R.x); sfx.unlock(); } }
  if (!R.attract) { sfx.jump(); buzz(8); }
  if (R.tut === 2) runnerTutStep();
  return true;
}
function swingHold(down) {
  const R = run;
  if (!R || !R.mode3 || R.over || R.paused) return;
  if (down) { R.hold = true; if (!R.teth) swingAttach(R); return; }
  R.hold = false;
  if (!R.teth) return;
  const was = R.teth; R.teth = null;
  // A spring anchor launches you on release.
  if (was.type === "spring") { R.vy = Math.max(R.vy, 0) + 9; R.vx += 3; if (!R.attract) { runBonus("Boing!", 0, R.dist + 2, R.x); sfx.jump(); } }
  // A Perfect: let go moving forward and up, fast.
  const ang = Math.atan2(R.vy, R.vx) * 180 / Math.PI, spd = Math.hypot(R.vx, R.vy);
  R.vx += 1.5;
  const [pwLo, pwHi, pwV] = perfectWindow(R);
  if (R.vx > 4 && ang > pwLo && ang < pwHi && spd > pwV) {
    const k = runnerPerk("Volt") ? 1.2 : 1.1; R.vx *= k; R.vy *= k; R.perfects++; R.spinV = 9;
    R.perfT = 0.45; R.slowT = Math.max(R.slowT, 0.18); swingFlow(R, 0.17); R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: 0xffffff, big: true });
    if (!R.attract) buzz(15);
    R.combo++; R.comboT = 2; R.comboBest = Math.max(R.comboBest, R.combo);
    R.pChain = (R.pChain || 0) + 1;
    if (!R.attract) { runBonus(R.pChain > 1 ? `Perfect ×${R.pChain}! +${1 + R.pChain} ✦` : "Perfect! +2 ✦", 0, R.dist + 2, R.x); R.lights += 1 + R.pChain; sfx.perfect(R.pChain); runMission("trail", R.perfects); }
  } else { R.spinV = 4; R.pChain = 0; }
  if (!R.attract) sfx.whoosh(Math.hypot(R.vx, R.vy));
  if (R.tut === 1) runnerTutStep();
}
function runnerTutStep() {
  const R = run;
  R.tut++; R.slow = 1; R.tutText = "";
  if (R.tut > 2) { R.tut = 0; const s = runSave(); s.tutDone = true; persist(); runMsg("You've got it!", "Swing on, and light up the city", 2.4, true); }
}
// The Flow bar lives in the page (not the canvas), touched only when it changes.
const flowEls = {};
function swingFlowHud(R) {
  const el = flowEls.bar || (flowEls.bar = document.getElementById("flowBar")); if (!el) return;
  if (el.hidden) { el.hidden = false; flowEls.fill = document.getElementById("flowFill"); flowEls.dash = document.getElementById("flowDash"); flowEls.text = document.getElementById("flowText"); }
  const od = R.od > 0, k = Math.round((od ? R.od / 6 : R.flow) * 100) / 100, txt = od ? "OVERDRIVE" : R.combo >= 3 ? `FLOW · ×${R.combo}` : "FLOW";
  if (k !== flowEls.k) { flowEls.k = k; flowEls.fill.style.transform = `scaleX(${k})`; }
  if (od !== flowEls.od) { flowEls.od = od; el.classList.toggle("od", od); }
  if (txt !== flowEls.txt) { flowEls.txt = txt; flowEls.text.textContent = txt; }
  const dz = R.dashes > 0; if (dz !== flowEls.dz) { flowEls.dz = dz; flowEls.dash.classList.toggle("off", !dz); }
}
// Flow: Perfects, lights and gold anchors fill it; full Flow sets off Overdrive.
function swingFlow(R, k) {
  if (R.od > 0) return;
  if (weekEvent().id === "rush") k *= 2;
  R.flow = Math.min(1, R.flow + k);
  if (R.flow >= 1) {
    R.od = 6; R.flow = 1; R.darkX -= 20; R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: 0xffd25a, big: true });
    if (!R.attract) { runMsg("OVERDRIVE!", "Double lights · the dark falls back", 2, true); sfx.power(); buzz([20, 30, 20]); }
  }
}
// A dash: swipe forward in the air. One charge, back when you grab an anchor.
function swingDash() {
  const R = run;
  if (!R || !R.mode3 || R.over || R.paused || R.roof) return;
  if (R.teth) swingHold(false);
  if (R.dashes <= 0) { R.fizzle = 0.25; return; }
  R.dashes--; R.dashT = 0.35; R.vx = Math.min(SWING.MAXV, Math.max(R.vx, 8) + 11); R.vy = Math.max(R.vy, 2.5); R.spinV = 0;
  R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: null });
  if (!R.attract) sfx.close();
}
// Keep the old swipe entry point harmless.
function runnerSwipe() {}

function swingHit(R, why) {
  if (R.inv > 0 || R.attract) { if (R.attract) R.inv = 1; return; }
  R.combo = 0; R.shake = 0.7; R.flow = Math.max(0, R.flow - 0.5); R.hitsTaken = (R.hitsTaken || 0) + 1;
  if (R.power && R.power.kind === "shield") { R.power = null; R.inv = 1; R.flash = -0.6; runMsg("Shield!", "", 1.2); sfx.gate(); return; }
  if (why) runMsg(why, "", 1.4);
  runHit();
}

// ---------- Each frame ----------
function runnerUpdate(dt) {
  const R = run;
  R.t += dt;
  if (R.over) { R.over += dt; R.crashT = (R.crashT || 0) + dt; R.vy -= SWING.G * dt; R.py = Math.max(0.3, R.py + R.vy * dt); R.px += R.vx * dt; R.vx *= 0.97; return; }
  R.inv = Math.max(0, R.inv - dt); R.flash = Math.max(0, R.flash - dt * 2); R.banner = Math.max(0, R.banner - dt);
  R.shake = Math.max(0, (R.shake || 0) - dt * 2.5); R.happy = Math.max(0, (R.happy || 0) - dt); R.fizzle = Math.max(0, R.fizzle - dt); R.kick = Math.max(0, R.kick - dt * 2);
  if (R.comboT > 0) R.comboT -= dt; else R.combo = 0;
  if (R.msgs.length) { R.msgs[0].t -= dt; if (R.msgs[0].t <= 0) R.msgs.shift(); }
  for (const p of R.pops || []) p.t += dt; R.pops = (R.pops || []).filter(p => p.t < 1.2);
  if (R.power) { R.power.t -= dt; if (R.power.t <= 0) R.power = null; }
  if (!R.attract) { const k = !!(keys && (keys[" "] || keys.arrowup)); if (k !== !!R.kHold) { R.kHold = k; swingHold(k); } const kd = !!(keys && keys.arrowright); if (kd && !R.kDash) swingDash(); R.kDash = kd; }
  if (R.hold && !R.teth && !R.roof) swingAttach(R);
  // Anchors that move, and anchors that crumble under you.
  for (const a of R.anchors) if (a.type === "drift") a.x = a.bx + Math.sin(R.t * 0.9 + a.ph) * 3.2;
  if (R.teth) { R.tethT += dt; if (R.teth.type === "crumble" && R.tethT > 1.9) { const a = R.teth; a.broken = true; R.teth = null; R.hold = false; R.bursts.push({ x: a.x, y: a.y, t: 0, c: 0xff6a3d, big: true }); if (!R.attract) { runMsg("It crumbled!", "Let go of orange anchors quickly", 1.4); sfx.bump(); } } }
  // Flow fades slowly; Overdrive runs down.
  if (R.od > 0) { R.od -= dt; R.darkX = Math.min(R.darkX, R.px - 35); if (R.od <= 0) { R.od = 0; R.flow = 0; } } else R.flow = Math.max(0, R.flow - dt * 0.045);
  R.perfT = Math.max(0, R.perfT - dt); R.dashT = Math.max(0, R.dashT - dt); if (R.teth) R.streetT = 0; R.streetT = Math.max(0, (R.streetT || 0) - dt);
  for (const b of R.bursts) b.t += dt; R.bursts = R.bursts.filter(b => b.t < 0.8);
  const comet = R.power && R.power.kind === "comet";
  // Physics in small steps: gravity, the tether (a pendulum), rooftops, walls and the street.
  const N = 3, h = dt / N;
  for (let s = 0; s < N; s++) {
    const ox = R.px, oy = R.py;
    if (comet) { R.teth = null; R.vx += (32 - R.vx) * Math.min(1, h * 3); R.vy = (34 - R.py) * 2; R.px += R.vx * h; R.py += R.vy * h; continue; }
    R.vy -= SWING.G * h;
    if (R.teth) {
      const a = R.teth, dx = R.px - a.x, dy = R.py - a.y, d = Math.hypot(dx, dy) || 1, tx = -dy / d, ty = dx / d, along = R.vx * tx + R.vy * ty;
      // A little push along the swing keeps it lively; a gentle reel-in.
      // A push along the swing; below the anchor and slow, a push forward so you never stall.
      if (dy < 0) { const sg = along >= 0 ? 1 : -1, slowK = (Math.hypot(R.vx, R.vy) < 10 ? 1.6 : 1) * (R.stageInfo ? 1 - R.stageInfo.hard * 0.6 : 1); R.vx += tx * sg * 10 * slowK * h; R.vy += ty * sg * 10 * slowK * h; if (along < 0 && dx > -2 && Math.hypot(R.vx, R.vy) < 6) { R.vx += tx * 14 * h; R.vy += ty * 14 * h; } }
      R.L += ((R.Lt || R.L) - R.L) * Math.min(1, h * 3.5);
    } else R.vx *= 1 - 0.03 * h;
    R.px += R.vx * h; R.py += R.vy * h;
    if (R.teth) {
      const a = R.teth, dx = R.px - a.x, dy = R.py - a.y, d = Math.hypot(dx, dy) || 1;
      if (d > R.L) { R.px = a.x + dx / d * R.L; R.py = a.y + dy / d * R.L; const rv = (R.vx * dx + R.vy * dy) / d; if (rv > 0) { R.vx -= rv * dx / d; R.vy -= rv * dy / d; } }
    }
    const sp = Math.hypot(R.vx, R.vy); if (sp > SWING.MAXV) { R.vx *= SWING.MAXV / sp; R.vy *= SWING.MAXV / sp; }
    // Rooftops and walls.
    const b = swingBldAt(R, R.px);
    if (R.roof && (R.px > R.roof.x1 || R.px < R.roof.x0)) R.roof = null;
    if (b && R.py < b.h) {
      if (oy >= b.h - 0.25 || R.roof === b) {
        if (!R.roof && R.vy < -14) { R.kick = 0.4; if (!R.attract) sfx.land(); }
        R.py = b.h; if (R.vy < 0) R.vy = 0; R.roof = b; R.teth = null; R.spinV = 0;
      } else if (ox < b.x0) {
        // Wall run: up the wall and over the top.
        R.px = b.x0 - 0.35; R.vx = 2.5; R.vy = Math.max(R.vy, 14); R.teth = null; R.shake = 0.25; R.wallT = 0.4;
        if (!R.attract && !R.wallMsg) { R.wallMsg = true; runMsg("Wall run!", "", 0.9); }
      }
      else { R.py = b.h; R.vy = Math.max(R.vy, 0); R.roof = b; }
    }
    if (R.roof) { R.py = R.roof.h; R.vx = Math.max(R.vx * (1 - 0.15 * h), 9); }
    // The street.
    if (R.py < 0.4) {
      R.py = 0.4; R.vy = 19; R.vx = Math.max(R.vx, 10); R.teth = null; R.flow = Math.max(0, R.flow - 0.3);
      if (R.streetT > 0 || (R.stageInfo && (R.stageInfo.daily || R.stageInfo.n >= 5))) swingHit(R, "Keep off the street!"); else if (!R.attract) { runMsg("Bounce!", "Grab a light before you land again", 1.2); sfx.land(); }
      R.streetT = 4;
    }
  }
  R.spinV *= R.teth || R.roof ? 0.8 : 0.995; R.spin += R.spinV * dt;
  R.phase += dt * Math.max(4, R.vx) * 0.8;
  R.v = Math.hypot(R.vx, R.vy); R.speed = R.v * RUN.M;
  // Stages: the clock, your path (for ghosts), and the finish gate.
  if (R.stageLen) {
    if (!R.cleared) { R.stageT += dt; R.traceT += dt; while (R.traceT >= 0.1) { R.traceT -= 0.1; R.trace.push([R.px, R.py]); } }
    if (!R.cleared && R.px >= R.stageLen) stageClear(R);
    if (!R.cleared && !R.attract && R.pChain >= 3 && (!R.shotAt || R.t - R.shotAt > 4)) R.wantShot = true;
  }
  R.dist = Math.max(R.dist, Math.max(0, R.px) * RUN.M);
  R.x = 200; R.tilt = 0;
  const m = runnerM();
  // Ahead: keep the skyline coming; behind: forget it.
  swingGen(R, R.px + 160);
  const cut = R.px - 80;
  R.anchors = R.anchors.filter(a => a.x > cut || a === R.teth); R.blds = R.blds.filter(b => b.x1 > cut);
  R.motes = R.motes.filter(c => !c.gone && c.x > cut); R.haz = R.haz.filter(z => (z.x1 ?? z.x) > cut); R.ups = R.ups.filter(u => !u.got && u.x > cut);
  // The darkness behind you.
  const surge = R.ev && R.ev.kind === "surge";
  R.darkX += (R.stageLen ? (4.5 + R.stageInfo.hard * 8) * (R.stageInfo.boss && R.ev && R.ev.kind === "heart" ? 1.35 : 1) : Math.min(14, 4 + Math.max(0, m - 80) * 0.0035)) * (surge ? 1.6 : 1) * (weekEvent().id === "shadow" ? 1.2 : 1) * (R.tut ? 0 : 1) * dt;
  R.darkX = Math.max(R.darkX, R.px - 60);
  if (R.px < R.darkX + 1 && !R.attract) { R.darkX = R.px - 38; swingHit(R, "The dark caught you!"); R.vx = Math.max(R.vx, 16); R.vy = Math.max(R.vy, 10); }
  // Buildings light back up as you pass.
  for (const b of R.blds) if (b.litT >= 0) b.litT += dt;
  for (const b of R.blds) if (b.litT < 0 && R.px > b.x0 - 3) { b.litT = 0; R.lit++; if (!R.attract) { runMission("free", R.lit); progressEvent("free"); if (!b.tree) sfx.clear(); } }
  // Lights.
  const mag = R.power && R.power.kind === "magnet";
  for (const c of R.motes) {
    if (c.got) { c.t += dt; if (c.t > 0.35) c.gone = true; continue; }
    const d = Math.hypot(c.x - R.px, c.y - R.py - 0.9);
    if ((mag || R.od > 0) && d < 9 + runUpg("magnet") * 2) { c.x += (R.px - c.x) * Math.min(1, dt * 8); c.y += (R.py + 0.9 - c.y) * Math.min(1, dt * 8); }
    if (d < 1.5 || comet && d < 3) {
      c.got = true; c.t = 0; if (R.stageLen) R.motesGot++; R.lights += (weekEvent().id === "gold" ? 2 : 1) * (R.od > 0 ? 2 : 1); swingFlow(R, 0.022);
      R.combo++; R.comboT = 2; R.comboBest = Math.max(R.comboBest, R.combo);
      if (runnerPerk("Nova") && R.combo % 10 === 0) { R.lights += 5; runBonus("+5 ✦", 0, R.dist + 2, R.x); }
      if (!R.attract) { sfx.coin(R.combo); runMission("lights", R.lights); }
    }
  }
  // Power-ups and letters.
  for (const u of R.ups) if (!u.got && Math.hypot(u.x - R.px, u.y - R.py - 0.9) < 2) {
    u.got = true;
    if (u.kind === "shard") {
      if (!R.ev || R.ev.kind !== "heart") continue;
      R.ev.hits++; R.darkX -= 18; R.bursts.push({ x: u.x, y: u.y, t: 0, c: 0xb08cff, big: true }); swingFlow(R, 0.2); sfx.flip(); buzz(20);
      if (R.ev.hits >= 3) { runBonus("The Heart breaks! +60 ✦", 60, R.dist + 2, R.x); R.fireworks.push({ t: 0, seed: Math.random() }); R.darkX = R.px - 70; R.ev = null; R.nextEv = runnerM() + 300; sfx.unlock(); progressEvent("boss"); }
      else runMsg(`Shard ${R.ev.hits} of 3`, "", 1.2, true);
      continue;
    }
    if (u.kind === "letter") {
      R.letterOut = false; if (R.attract) continue;
      const hs = huntState(); hs.got += u.ch; persist(); sfx.unlock();
      if (hs.got.length >= HUNT.length) { save.glow = (save.glow || 0) + 250; persist(); runMsg("LUMEN complete! +250 ✦", "Come back tomorrow for a new hunt", 2.6, true); }
      else runMsg(`Letter ${u.ch}!`, `${hs.got}${"·".repeat(HUNT.length - hs.got.length)}  find LUMEN today`, 2, true);
      continue;
    }
    R.power = { kind: u.kind, t: RUNNER_POWERS[u.kind].dur * (1 + runUpg("song") * 0.2) }; R.happy = 1;
    if (!R.attract) { sfx.power(); runMsg(RUNNER_POWERS[u.kind].name + "!", { magnet: "Lights fly to you", shield: "One hit is on us", comet: "Blaze across the sky" }[u.kind], 1.6, true); }
  }
  // Hazards: live wires and drones.
  for (const z of R.haz) {
    if (z.kind === "wire") { if (R.px > z.x0 && R.px < z.x1 && R.py < z.y + 0.4 && R.py + 1.7 > z.y && !comet) { z.hit = true; swingHit(R, "Zap!"); } }
    else if (z.kind === "drone") {
      z.y = z.y0 + Math.sin(R.t * 1.4 + z.ph) * z.amp; const d = Math.hypot(z.x - R.px, z.y - R.py - 0.9);
      if (d < 1.5 && !comet) swingHit(R, "Drone!");
      else if (d < 3.5 && !z.near && !R.attract) { z.near = true; progressEvent("near"); runBonus("Close call! +2 ✦", 2, R.dist + 2, R.x); sfx.close(); R.slowT = 0.3; }
    }
  }
  // The first run teaches by doing: let go, then hold.
  if (R.tut === 1) { const a = R.teth; if (a && R.px > a.x + 1 && R.vy > 1) { R.slow = 0.3; R.tutText = "Let go to fly!"; } else if (a) R.tutText = "Hold on…"; }
  else if (R.tut === 2) { R.tutText = "Hold to grab the next light"; R.slow = R.vy < 0 ? 0.35 : 1; }
  else { R.slow = R.slowT > 0 ? (R.perfT > 0.3 ? 0.35 : 0.5) : 1; }
  R.slowT = Math.max(0, R.slowT - dt * 2);
  // Events: a light shower, a surge of darkness.
  if (!R.attract && !R.tut) {
    if (!R.ev && m > R.nextEv && m % RUN.BIOME_M < RUN.BIOME_M - 130) { const kind = (R.evN = (R.evN || 0) + 1) % 2 ? "shower" : "surge"; R.ev = { kind, t: kind === "shower" ? 8 : 10 }; runMsg(...(kind === "shower" ? ["Light shower!", "Catch them as they fall"] : ["The dark surges!", "Swing faster!"]), 2.2, true); sfx.power(); }
    if (R.ev) {
      R.ev.t -= dt;
      if (R.ev.kind === "shower" && Math.random() < dt * 9) R.motes.push({ x: R.px + 8 + Math.random() * 22, y: R.py + 10 + Math.random() * 8, fall: 4 + Math.random() * 3, line: -1 });
      if (R.ev.kind === "heart") R.darkX += 4.5 * dt;
      if (R.ev.t <= 0) { if (R.ev.kind === "heart") runMsg("The Heart slips away…", "", 1.6); if (R.ev.kind === "surge") runBonus("Outran it! +20 ✦", 20, R.dist + 2, R.x); R.ev = null; R.nextEv = m + 500 + Math.floor(runR() * 250); }
    }
  }
  for (const c of R.motes) if (c.fall && !c.got) c.y -= c.fall * dt;
  if (R.daily) R.rec[Math.floor(Math.max(0, R.px))] = Math.round(R.py);
  if (!R.attract) runMission("nohit", Math.floor(m - (R.hitAt || 0)));
  const bb = Math.floor(m / RUN.BIOME_M);
  if (bb !== R.biome && !R.stageLen) {
    R.biome = bb; R.banner = 3;
    if (!R.attract) { runMission("biome", bb + 1); const st = SWING_STORY[bb % SWING_STORY.length]; runMsg(st[0], st[1], 3.6); }
  }
  // The Heart of the Dark: near the end of every district it comes for you. Grab its three shards.
  if (!R.stageLen && !R.attract && !R.tut && !R.ev && m % RUN.BIOME_M > RUN.BIOME_M - 110 && !(R.hearted || (R.hearted = {}))[bb] && m > 200) {
    R.hearted[bb] = true; R.ev = { kind: "heart", t: 22, hits: 0 };
    // Three shards ahead, always: on swing arcs where there are anchors, at a reachable height otherwise.
    const ahead = R.anchors.filter(a => a.x > R.px + 8).slice(0, 7);
    for (let q = 0; q < 3; q++) { const a = ahead[q * 2], b2 = ahead[q * 2 + 1]; R.ups.push(a && b2 ? { x: (a.x + b2.x) / 2, y: (a.y + b2.y) / 2 - 10, kind: "shard" } : { x: R.px + 24 + q * 26, y: 24 + runR() * 6, kind: "shard" }); }
    runMsg("The Heart of the Dark!", "Grab its 3 shards to break it", 2.6, true); sfx.power(); buzz([30, 40, 30]);
  }
  if (!R.attract) runMission("dist", Math.floor(m));
  if (!R.stageLen && m >= R.nextMile) { R.nextMile += 500; R.fireworks.push({ t: 0, seed: Math.random() }); if (!R.attract) { runMsg(`${Math.floor(m)} m!`, "The city glows for you", 1.8, true); sfx.unlock(); } }
  for (const f of R.fireworks) f.t += dt; R.fireworks = R.fireworks.filter(f => f.t < 3);
  if (!R.attract) { music.intensity = Math.min(1, (R.v - 10) / 22); music.layers = R.combo >= 12 ? 3 : 2; }
  if (!R.attract) swingFlowHud(R);
  if (!R.attract && Math.floor(R.t * 4) !== Math.floor((R.t - dt) * 4)) runHud();
}

// The title screen swings by itself.
function runnerAuto() {
  const R = run;
  if (R.teth) { if ((R.px > R.teth.x + 1 && R.vy > 0.5 && R.vx > 5) || (R.teth.type === "crumble" && R.tethT > 1.6)) swingHold(false); }
  else if (R.roof) { const b = R.roof; if (R.px > b.x1 - 4) swingHold(true); }
  else if ((R.vy < -2 || R.py < 16) && !R.hold) swingHold(true);
}

// ---------- Drawing: the skyline in 3D ----------
let RUNNER3D_ = undefined;
function runnerReset3D() { if (RUNNER3D_) { try { RUNNER3D_.destroy(); } catch (e) {} } RUNNER3D_ = undefined; }
function runner3D() {
  if (RUNNER3D_ !== undefined) return RUNNER3D_;
  try { RUNNER3D_ = makeSwing3D(); } catch (e) { console.warn("3D view unavailable", e); RUNNER3D_ = null; }
  return RUNNER3D_;
}
function makeSwing3D() {
  const T = window.THREE;
  if (!T) return null;
  const view = document.createElement("canvas"); view.id = "runner3d";
  const hiDpi = (window.devicePixelRatio || 1) >= 2;
  const renderer = new T.WebGLRenderer({ canvas: view, antialias: !hiDpi, powerPreference: "high-performance", stencil: false });
  if (!renderer.getContext()) return null;
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const modest = typeof modestPhone !== "undefined" && modestPhone;
  // Lighter graphics (Settings, or a slow phone): no shadows, lower resolution, fewer people.
  const lite = modest || (save.settings && save.settings.lighting === false);
  renderer.shadowMap.enabled = !lite; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(62, 0.5, 0.2, 420);
  scene.fog = new T.Fog(0xffffff, 60, 190);
  const hemi = new T.HemisphereLight(0xffffff, 0x445566, 0.9); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 1.5); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(modest ? 1024 : 2048, modest ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 26, bottom: -26, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const SUN_DIR = new T.Vector3(-0.55, 0.75, 0.35).normalize();
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const C = (c, out) => (out || new T.Color()).setRGB(c[0] / 255, c[1] / 255, c[2] / 255);
  const WHITE = new T.Color(1, 1, 1), tmpGlow = new T.Color(), tmpTower = new T.Color(), tmpTowerL = new T.Color(), tmpA = new T.Color(), tmpB = new T.Color(), tmpCloud = new T.Color();
  const tex = (w, h, paint, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso; t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const rnd = seeded(2024);
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const glowTex = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const glow = (c, s, a = 0.8) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: a, blending: T.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, 1); return sp; };
  const std = (o) => new T.MeshStandardMaterial(o);
  // Gloss without the cost: plain standard materials everywhere.
  const phys = (o) => { const q = Object.assign({}, o); delete q.clearcoat; delete q.clearcoatRoughness; delete q.sheen; return new T.MeshStandardMaterial(q); };
  const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
  const shadowAll = (g, cast = true, rec = false) => g.traverse(m => { if (m.isMesh && !m.material.isMeshBasicMaterial && !m.material.transparent) { m.castShadow = cast; m.receiveShadow = rec; } });

  // ---------- Sky ----------
  const skyU = { top: { value: new T.Color() }, mid: { value: new T.Color() }, bot: { value: new T.Color() } };
  const skyMat = new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.7, h)) : mix(bot, mid, smoothstep(-0.2, 0.08, h)); gl_FragColor = vec4(c, 1.0); }" });
  const sky = new T.Mesh(new T.SphereGeometry(400, 32, 16), skyMat); scene.add(sky);
  const starGeo = new T.BufferGeometry(), sp = []; for (let q = 0; q < 600; q++) { const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380); }
  starGeo.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
  const stars = new T.Points(starGeo, new T.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); scene.add(stars);
  const sunSpr = glow(0xfff2d8, 120, 0.9); sunSpr.material.fog = false; scene.add(sunSpr);
  const moon = new T.Mesh(new T.SphereGeometry(9, 24, 16), new T.MeshBasicMaterial({ color: 0xf4f1e4, fog: false, transparent: true })); scene.add(moon);
  const cloudTex = tex(256, 128, (g) => { for (const [x, y, r] of [[80, 76, 44], [128, 58, 52], [180, 76, 40], [128, 88, 44], [60, 92, 28], [200, 92, 30]]) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.65, "rgba(255,255,255,0.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
  const clouds = []; for (let q = 0; q < 9; q++) { const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false })); scene.add(s); clouds.push({ s, x: (rnd() - 0.5) * 300, y: 70 + rnd() * 60, z: -150 - rnd() * 200, w: 60 + rnd() * 60 }); }
  // Reflections: the sky (and a city below the horizon) as a panorama.
  const envCanvas = document.createElement("canvas"); envCanvas.width = 512; envCanvas.height = 256;
  const envTex = new T.CanvasTexture(envCanvas); envTex.mapping = T.EquirectangularReflectionMapping; envTex.encoding = T.sRGBEncoding;
  let pmrem = null, envRT = null, envKey = "";
  function skyEnv(P, night) {
    const key = P.sky.map(c => c.map(v => v >> 4).join(".")).join("|") + Math.round(night * 5);
    if (key === envKey) return; envKey = key;
    const g = envCanvas.getContext("2d"), css = c => `rgb(${c.map(v => Math.round(v)).join(",")})`, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, css(P.sky[0])); gr.addColorStop(0.32, css(P.sky[1])); gr.addColorStop(0.49, css(P.sky[2])); gr.addColorStop(0.51, css(P.tower.map(v => v * (0.55 - night * 0.35)))); gr.addColorStop(1, "#06070b");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const r = seeded(3); for (let q = 0; q < 50; q++) { const x = r() * 512, w = 8 + r() * 24, hh = 14 + r() * 60; g.fillStyle = css(P.tower.map(v => v * (0.45 - night * 0.3))); g.fillRect(x, 128 - hh, w, hh + 2); }
    if (night > 0.3) for (let q = 0; q < 300; q++) { g.fillStyle = `rgba(${P.winC.join(",")},${0.4 + r() * 0.6})`; g.fillRect(r() * 512, 70 + r() * 150, 2, 2); }
    if (night < 0.7) { const s = g.createRadialGradient(380, 60, 0, 380, 60, 60); s.addColorStop(0, `rgba(255,250,235,${1 - night})`); s.addColorStop(1, "rgba(255,240,210,0)"); g.fillStyle = s; g.fillRect(300, 0, 160, 130); }
    envTex.needsUpdate = true;
    if (!pmrem) pmrem = new T.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(envTex); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
  }

  // ---------- Buildings ----------
  // Facade styles share canvas textures; each building gets its own box with UVs scaled to its size.
  // Each style paints in three modes from the same layout: "map" (colour), "lit" (which windows glow
  // at night, whole panes at a time) and "rm" (glass is smooth and mirror-like, frames are matte).
  const paneFill = (g, mode, x, y, w, h, c0, c1, lit) => {
    if (mode === "lit") { g.fillStyle = lit ? `rgb(${150 + Math.floor(lit * 105)},${110 + Math.floor(lit * 90)},${60 + Math.floor(lit * 70)})` : "#000"; g.fillRect(x, y, w, h); return; }
    if (mode === "rm") { g.fillStyle = "rgb(0,22,230)"; g.fillRect(x, y, w, h); return; }
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(x, y, w, h);
  };
  const base = (g, mode, col) => { g.fillStyle = mode === "lit" ? "#000" : mode === "rm" ? "rgb(0,170,10)" : col; g.fillRect(0, 0, 512, 512); };
  const FAC = [
    { name: "glass", paint(g, mode, r) { base(g, mode, "#cfd6de"); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) paneFill(g, mode, x * 128 + 6, y * 128 + 6, 116, 116, "#3f5872", "#8aa7c2", r() < 0.4 && r()); } },
    { name: "brick", paint(g, mode, r) { base(g, mode, "#a45f47"); if (mode === "map") { const rr = seeded(5); for (let y = 0; y < 512; y += 16) for (let x = 0; x < 512; x += 32) { const v = rr() * 26; g.fillStyle = `rgb(${150 + v},${84 + v * 0.6},${64 + v * 0.4})`; g.fillRect(x + (y / 16 % 2) * 16, y, 30, 13); } }
      for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { const X = x * 170 + 38, Y = y * 128 + 22; if (mode === "map") { g.fillStyle = "#efe7dc"; g.fillRect(X - 8, Y - 8, 108, 98); } paneFill(g, mode, X, Y, 92, 82, "#2c3846", "#55677a", r() < 0.45 && r()); if (mode === "map") { g.fillStyle = "#efe7dc"; g.fillRect(X + 44, Y, 4, 82); } } } },
    { name: "white", paint(g, mode, r) { base(g, mode, "#f1f1ee"); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) paneFill(g, mode, x * 128 + 2, y * 128 + 38, 124, 64, "#26303d", "#4b5a6c", r() < 0.4 && r()); } },
    { name: "dark", paint(g, mode, r) { base(g, mode, "#1b2029"); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) paneFill(g, mode, x * 128 + 4, y * 64 + 4, 120, 56, "#2c394a", "#4a5d74", r() < 0.35 && r()); } },
    { name: "concrete", paint(g, mode, r) { base(g, mode, "#bdb8ae"); for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) { const X = x * 256 + 24, Y = y * 128 + 20; paneFill(g, mode, X, Y, 208, 70, "#2b3541", "#536273", r() < 0.45 && r()); if (mode === "map") { g.fillStyle = "#e4e0d8"; g.fillRect(X - 10, Y + 70, 228, 14); g.fillStyle = "#7f8a96"; for (let b = 0; b < 9; b++) g.fillRect(X - 6 + b * 26, Y + 56, 3, 14); } } } },
    { name: "pastel", paint(g, mode, r) { base(g, mode, "#e8c9b8"); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const X = x * 128 + 30, Y = y * 128 + 22; if (mode === "map") { g.fillStyle = "#fff6ee"; g.fillRect(X - 6, Y - 6, 80, 96); } paneFill(g, mode, X, Y, 68, 84, "#35414f", "#5f7083", r() < 0.45 && r()); if (mode === "map") { g.fillStyle = "#6fa9a0"; g.fillRect(X - 6, Y + 84, 80, 8); } } } },
  ];
  const facMetal = 0.25;
  FAC.forEach((f, i) => {
    f.map = tex(512, 512, g => f.paint(g, "map", seeded(i + 1))); f.lit = tex(512, 512, g => f.paint(g, "lit", seeded(i + 1))); f.rm = tex(512, 512, g => f.paint(g, "rm", seeded(i + 1)), false);
    f.mat = std({ map: f.map, emissiveMap: f.lit, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: f.rm, metalnessMap: f.rm, roughness: 1, metalness: facMetal });
  });
  const TILE = 9;                        // metres of facade per texture tile
  const boxCache = new Map();
  function boxUVc(w, h, d) {
    const W2 = Math.max(0.5, Math.round(w * 2) / 2), H2 = Math.max(0.5, Math.round(h * 2) / 2), D2 = Math.round(d), key = W2 + "|" + H2 + "|" + D2;
    let g = boxCache.get(key); if (!g) { g = boxUV(W2, H2, D2); g.userData.cached = true; boxCache.set(key, g); } return g;
  }
  function boxUV(w, h, d) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let q = 0; q < 4; q++) { const i = f * 4 + q; uv.setXY(i, uv.getX(i) * dims[f][0] / TILE, uv.getY(i) * dims[f][1] / TILE); }
    return g;
  }
  // Billboards: animated screens with made-up ads.
  const ADS = [
    { a: "#ff3d7f", b: "#7b2cff", t1: "RUN THE CITY", t2: "new season · live now" },
    { a: "#00c2ff", b: "#00e0a4", t1: "FIZZ", t2: "taste the skyline" },
    { a: "#ffb000", b: "#ff4d00", t1: "SKYLINE FM", t2: "98.4 · always on" },
    { a: "#9b5cff", b: "#ff5cd1", t1: "NEON NIGHTS", t2: "festival · saturday" },
    { a: "#111827", b: "#334155", t1: "AIR STEP", t2: "the lightest sneaker yet" },
  ];
  const adCanvases = ADS.map(() => { const c = document.createElement("canvas"); c.width = 384; c.height = 192; return c; });
  const adTex = adCanvases.map(c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = aniso; return t; });
  const adMats = adTex.map(t => new T.MeshBasicMaterial({ map: t, toneMapped: false }));
  function paintAds(t) {
    ADS.forEach((ad, i) => {
      const g = adCanvases[i].getContext("2d"), W = 384, H = 192, k = (t * 0.25 + i * 0.2) % 1;
      const gr = g.createLinearGradient(W * k - W, 0, W * k + W, H); gr.addColorStop(0, ad.a); gr.addColorStop(0.5, ad.b); gr.addColorStop(1, ad.a); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.18; g.fillStyle = "#fff"; for (let q = 0; q < 5; q++) { const x = ((t * 40 + q * 90) % (W + 120)) - 60; g.beginPath(); g.arc(x, 40 + q * 30, 26 + q * 6, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
      g.fillStyle = "#fff"; g.textAlign = "left"; g.font = "900 46px Inter, system-ui, sans-serif"; g.fillText(ad.t1, 24, 96 + Math.sin(t * 2 + i) * 3);
      g.font = "600 20px Inter, system-ui, sans-serif"; g.globalAlpha = 0.9; g.fillText(ad.t2, 26, 132); g.globalAlpha = 1;
      g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(24, 150, 90 + 40 * Math.sin(t * 3 + i), 6);
      adTex[i].needsUpdate = true;
    });
  }
  paintAds(1.3);
  const NEON_WORDS = ["HOTEL", "BAR", "OPEN", "CAFE", "TAXI", "CLUB", "24H"];
  const neonTex = NEON_WORDS.map(w => tex(64, 320, (g) => { g.fillStyle = "#121318"; g.fillRect(0, 0, 64, 320); g.strokeStyle = "#fff"; g.lineWidth = 4; g.strokeRect(4, 4, 56, 312); g.fillStyle = "#fff"; g.font = "800 40px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; [...w].forEach((ch, q) => g.fillText(ch, 32, 160 + (q - (w.length - 1) / 2) * 50)); }));
  const NEON_COL = [0xff3d7f, 0x22e0ff, 0xffc23d, 0x9b6bff, 0x3dffa8];
  const metalDark = std({ color: 0x2b2f38, metalness: 0.7, roughness: 0.35 });
  const roofMat = std({ color: 0x8d9097, roughness: 0.8 });
  const lampMat = std({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4 }), lampHead = basic(0xfff1c8);
  const leafMats = [std({ color: 0x4f8a3c, roughness: 0.8 }), std({ color: 0x6aa04a, roughness: 0.8 }), std({ color: 0xd98c3a, roughness: 0.8 })];
  const trunkMat = std({ color: 0x5a4434, roughness: 0.9 }), planterMat = std({ color: 0xb8b3aa, roughness: 0.8 });
  const benchMat = std({ color: 0x8a5a3a, roughness: 0.7 });
  function makeLamp() { const g = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 6, 10), lampMat); pole.position.y = 3; g.add(pole); const arm = new T.Mesh(boxGeo, lampMat); arm.scale.set(1.4, 0.1, 0.1); arm.position.set(0.7, 6, 0); g.add(arm); const head = new T.Mesh(boxGeo, lampHead); head.scale.set(0.6, 0.12, 0.3); head.position.set(1.3, 5.92, 0); g.add(head); const gl = glow(0xffe2a8, 1.8, 0); gl.position.set(1.3, 5.8, 0); g.add(gl); shadowAll(g); g.userData.glow = gl; return g; }
  function makeTree(k) { const g = new T.Group(); const p = new T.Mesh(boxGeo, planterMat); p.scale.set(1.3, 0.5, 1.3); p.position.y = 0.25; g.add(p); const t = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 2.4, 8), trunkMat); t.position.y = 1.5; g.add(t); for (let q = 0; q < 3; q++) { const f = new T.Mesh(new T.IcosahedronGeometry(1 - q * 0.15, 1), leafMats[k % 3 === 2 ? 2 : q % 2]); f.position.set((q - 1) * 0.35, 3.1 + q * 0.45, (q % 2 - 0.5) * 0.4); f.rotation.set(q, q * 2, 0); g.add(f); } shadowAll(g); return g; }
  function makeBench() { const g = new T.Group(); const s = new T.Mesh(boxGeo, benchMat); s.scale.set(0.5, 0.08, 1.8); s.position.y = 0.48; g.add(s); const b = new T.Mesh(boxGeo, benchMat); b.scale.set(0.08, 0.45, 1.8); b.position.set(0.22, 0.75, 0); g.add(b); for (const z of [-0.75, 0.75]) { const l = new T.Mesh(boxGeo, lampMat); l.scale.set(0.45, 0.48, 0.06); l.position.set(0, 0.24, z); g.add(l); } shadowAll(g); return g; }
  // Flying cars high above the avenue.
  const hoverMat = phys({ color: 0xffffff, metalness: 0.4, roughness: 0.25, clearcoat: 1 });
  const flyers = [];
  for (let q = 0; q < 7; q++) { const g = new T.Group(), b = new T.Mesh(new T.SphereGeometry(1, 20, 12), hoverMat.clone()); b.scale.set(1.1, 0.45, 2.4); g.add(b); const cab = new T.Mesh(new T.SphereGeometry(0.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), phys({ color: 0x1b2433, roughness: 0.05, metalness: 0.4, clearcoat: 1 })); cab.position.set(0, 0.25, -0.3); cab.scale.set(1, 0.8, 1.4); g.add(cab); const strip = new T.Mesh(boxGeo, basic(NEON_COL[q % NEON_COL.length])); strip.scale.set(2.1, 0.08, 0.1); strip.position.set(0, -0.15, 2.3); g.add(strip); const tail = glow(NEON_COL[q % NEON_COL.length], 3, 0.6); tail.position.set(0, 0, 2.6); g.add(tail); b.material.color.set([0xffffff, 0xff4d64, 0x2b2f38, 0xffc23d, 0x3a86ff][q % 5]); scene.add(g); flyers.push({ g, x: (rnd() - 0.5) * 30, y: 18 + rnd() * 26, z: -rnd() * 300, v: (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 16) }); }
  // Birds by day.
  const birdMat = new T.MeshBasicMaterial({ color: 0x2a2a30, side: T.DoubleSide });
  const birds = []; for (let q = 0; q < 10; q++) { const g = new T.Group(); for (const s of [-1, 1]) { const w = new T.Mesh(new T.PlaneGeometry(0.5, 0.18), birdMat); w.position.x = s * 0.25; g.add(w); g.userData[s] = w; } scene.add(g); birds.push({ g, off: [q % 5 * 1.1 - 2, Math.abs(q % 5 - 2) * 0.8, Math.floor(q / 5) * 30] }); }
  // Rain.
  const rainN = 500, rainPos = new Float32Array(rainN * 6), rainGeo = new T.BufferGeometry(); rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.4 })); scene.add(rain);
  const rainSeed = Array.from({ length: rainN }, () => [Math.random(), Math.random(), Math.random()]);
  // Fireworks.
  const fwN = 600, fwPos = new Float32Array(fwN * 3), fwCol = new Float32Array(fwN * 3), fwGeo = new T.BufferGeometry();
  fwGeo.setAttribute("position", new T.BufferAttribute(fwPos, 3)); fwGeo.setAttribute("color", new T.BufferAttribute(fwCol, 3));
  const fw = new T.Points(fwGeo, new T.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, map: glowTex })); scene.add(fw);

  renderer.shadowMap.enabled = false; sun.castShadow = false;
  // ---------- The street far below: asphalt, sidewalk, passing cars, lamps ----------
  const roadMat = std({ color: 0x24272e, roughness: 0.55, metalness: 0.2 });
  const road = new T.Mesh(new T.PlaneGeometry(400, 60), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -10); scene.add(road);
  const walkMat = std({ color: 0x6d6f74, roughness: 0.9 });
  const walk = new T.Mesh(new T.BoxGeometry(400, 0.25, 4), walkMat); walk.position.set(0, 0.12, 4); scene.add(walk);
  const waterMat = std({ color: 0x15476a, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.95 });
  const water = new T.Mesh(new T.PlaneGeometry(RUN.BIOME_M, 80), waterMat); water.rotation.x = -Math.PI / 2; water.visible = false; scene.add(water);
  const cars = []; for (let q = 0; q < 10; q++) { const g = new T.Group(), body = new T.Mesh(boxGeo, phys({ color: [0xffffff, 0xd62839, 0x1b1f27, 0xf2c230, 0x3a86ff][q % 5], metalness: 0.5, roughness: 0.3, clearcoat: 1 })); body.scale.set(4.2, 1.1, 1.9); body.position.y = 0.75; g.add(body); const cab = new T.Mesh(boxGeo, phys({ color: 0x141a24, roughness: 0.05, clearcoat: 1 })); cab.scale.set(2.2, 0.7, 1.7); cab.position.set(-0.2, 1.6, 0); g.add(cab); const hl = glow(0xfff4d0, 2.2, 0.8); g.add(hl); const tl = glow(0xff3040, 1.4, 0.7); g.add(tl); scene.add(g); cars.push({ g, hl, tl, x: rnd() * 200, z: q % 2 ? 7 : 9.5, v: (q % 2 ? 1 : -1) * (9 + rnd() * 6) }); }
  // ---------- Buildings in the play line, which light back up as you pass ----------
  const darkTint = new T.Color(0.16, 0.17, 0.22);
  const bldGroups = new Set(), anchorGroups = new Set();
  function bldMesh(b) {
    if (b.mesh) return b.mesh;
    const g = new T.Group(), w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, r = seeded(Math.floor(b.seed * 1e6));
    if (b.tree) {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.5, 0.8, b.h, 10), std({ color: 0x5a4434, roughness: 0.9 })); trunk.position.set(cx, b.h / 2 - 1.5, -2); g.add(trunk);
      const leaf = std({ color: 0x3f7a35, roughness: 0.85, emissive: 0x6fcf5a, emissiveIntensity: 0 });
      for (let q = 0; q < 4; q++) { const f = new T.Mesh(new T.IcosahedronGeometry(w * (0.38 - q * 0.04), 1), leaf); f.position.set(cx + (q - 1.5) * w * 0.15, b.h - 1.5 + (q % 2) * 1.6, -2 + (q % 2 - 0.5) * 2); f.rotation.set(q, q * 2, 0); g.add(f); }
      const lights = []; for (let q = 0; q < 12; q++) { const s = glow([0xffe08a, 0xff9ad0, 0x9fe8ff][q % 3], 0.9, 0); s.position.set(cx + (r() - 0.5) * w * 0.8, b.h - 2 + (r() - 0.3) * 3, 0.5 + r()); g.add(s); lights.push(s); }
      g.userData = { leaf, lights }; scene.add(g); b.mesh = g; bldGroups.add(g); return g;
    }
    const st = FAC[b.style], mat = st.mat.clone(); mat.emissiveIntensity = 0;
    const main = new T.Mesh(boxUVc(w, b.h, 12), mat); main.position.set(cx, b.h / 2, -4.5); g.add(main);
    const cap = new T.Mesh(boxGeo, roofMat); cap.scale.set(w + 0.4, 0.5, 12.4); cap.position.set(cx, b.h + 0.25 - 0.5, -4.5); g.add(cap);
    for (let q = 0; q < 2; q++) { const ac = new T.Mesh(boxGeo, roofMat); ac.scale.set(1.6 + r() * 1.5, 1, 1.6 + r()); ac.position.set(b.x0 + 1.5 + r() * (w - 3), b.h + 0.5, -6 - r() * 3); g.add(ac); }
    if (r() < 0.3 && w > 10) { const tank = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 2.4, 16), std({ color: 0x8a6a4a, roughness: 0.8 })); tank.position.set(b.x0 + 2 + r() * (w - 4), b.h + 2.6, -7); g.add(tank); const capT = new T.Mesh(new T.ConeGeometry(1.4, 0.9, 16), std({ color: 0x5a4632, roughness: 0.8 })); capT.position.set(tank.position.x, b.h + 4.2, -7); g.add(capT); for (const [a2, c2] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const leg = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1.4, 6), metalDark); leg.position.set(tank.position.x + a2, b.h + 0.7, -7 + c2); g.add(leg); } }
    // A rim of light along the roof edge once it's lit: the line you can land on.
    const rim = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: runnerGlow(), toneMapped: false, transparent: true, opacity: 0 })); rim.scale.set(w + 0.45, 0.08, 0.12); rim.position.set(cx, b.h + 0.02, 1.55); g.add(rim);
    // The relight sweep: a band of light climbing the facade.
    const sweep = new T.Mesh(new T.PlaneGeometry(w, 1.2), new T.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); sweep.position.set(cx, 0, 1.56); g.add(sweep);
    // A neon sign or a billboard now and then.
    const th = runnerTheme(b.x0), roll = r();
    if (roll < th.ad && b.h > 16) { const ai = Math.floor(r() * ADS.length), bw = Math.min(w - 2, 9), bb = new T.Mesh(new T.PlaneGeometry(bw, bw / 2), adMats[ai]); bb.position.set(cx, Math.min(b.h - bw / 4 - 2, 7 + r() * 6), 1.62); g.add(bb); g.userData.ad = bb; }
    else if (roll < th.ad + th.neon && b.h > 12) { const wi = Math.floor(r() * NEON_WORDS.length), col = NEON_COL[Math.floor(r() * NEON_COL.length)], faceM = new T.MeshBasicMaterial({ map: neonTex[wi], color: col, toneMapped: false }); const s2 = new T.Mesh(boxGeo, [metalDark, metalDark, metalDark, metalDark, faceM, faceM]); s2.scale.set(1.3, 5, 0.4); s2.position.set(b.x0 + 1.2 + r() * (w - 2.4), 6 + r() * Math.max(1, b.h - 12), 1.9); g.add(s2); g.userData.neon = faceM; g.userData.neonCol = col; }
    // A street lamp in front, dark until the building lights up.
    const leds = []; for (const ex of [b.x0 + 0.08, b.x1 - 0.08]) { const ld = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: runnerGlow(), toneMapped: false, transparent: true, opacity: 0 })); ld.scale.set(0.14, b.h, 0.14); ld.position.set(ex, b.h / 2, 1.58); g.add(ld); leds.push(ld); }
    const beacon = glow(0xff3048, 1.6, 0); beacon.position.set(b.x0 + w * (0.3 + r() * 0.4), b.h + 1.6, -3); g.add(beacon);
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 1.6, 6), metalDark); pole.position.set(beacon.position.x, b.h + 0.8, -3); g.add(pole);
    g.userData = Object.assign(g.userData, { mat, rim, sweep, leds, beacon, ph: r() * 6 });
    scene.add(g); b.mesh = g; bldGroups.add(g); return g;
  }
  // The skyline behind: three layers that wake up as you pass.
  const layers = [{ z: -30, sp: 16, h: [22, 60] }, { z: -62, sp: 22, h: [35, 90] }, { z: -120, sp: 34, h: [50, 140] }];
  // Background towers are clean silhouettes; sparse warm windows wake as you pass.
  const dotsTex = tex(256, 256, (g2) => { g2.fillStyle = "#000"; g2.fillRect(0, 0, 256, 256); const r2 = seeded(31); for (let y = 6; y < 256; y += 14) for (let x = 6; x < 256; x += 12) if (r2() < 0.28) { g2.fillStyle = `rgb(255,${200 + r2() * 40},${130 + r2() * 60})`; g2.fillRect(x, y, 5, 7); } });
  const bgLit = layers.map(() => std({ color: 0x000000, emissiveMap: dotsTex, emissive: 0xffd9a0, emissiveIntensity: 1, roughness: 1 })), bgDark = layers.map(() => std({ color: 0x000000, emissiveMap: dotsTex, emissive: 0xffd9a0, emissiveIntensity: 0.06, roughness: 1 }));
  const bgList = layers.map(() => ({ list: [], next: null }));
  // ---------- Anchors ----------
  const nodeGeo = new T.SphereGeometry(0.42, 18, 12);
  function anchorMesh(a, R) {
    if (a.mesh) return a.mesh;
    const g = new T.Group(), col = new T.Color(runnerGlow());
    const node = new T.Mesh(nodeGeo, new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); g.add(node);
    const halo = glow(col, 2.4, 0.7); g.add(halo);
    const ring = new T.Mesh(new T.TorusGeometry(0.9, 0.05, 8, 40), new T.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.6 })); g.add(ring);
    const b = R.blds.find(q => a.x >= q.x0 - 0.5 && a.x <= q.x1 + 0.5 && !q.tree);
    if (b && a.y - b.h < 22) {
      // A mast on the roof.
      const ht = a.y - b.h, mast = new T.Mesh(new T.CylinderGeometry(0.08, 0.18, ht, 8), metalDark); mast.position.set(0, -ht / 2, -0.5); g.add(mast);
      for (let q = 1; q < 4; q++) { const bar = new T.Mesh(boxGeo, metalDark); bar.scale.set(1.2 - q * 0.25, 0.06, 0.06); bar.position.set(0, -ht * q / 4, -0.5); g.add(bar); }
    } else if (a.kind === "lantern") {
      // A lantern on wires strung between the nearest rooftops.
      node.material.color.set(0xffb34d); node.scale.set(1.1, 1.4, 1.1);
      for (const sd of [-1, 1]) { const nb = R.blds.filter(q => (sd < 0 ? q.x1 < a.x : q.x0 > a.x)).sort((p, q) => Math.abs((sd < 0 ? p.x1 : p.x0) - a.x) - Math.abs((sd < 0 ? q.x1 : q.x0) - a.x))[0]; if (!nb) continue; const ex = (sd < 0 ? nb.x1 : nb.x0) - a.x, ey = nb.h + 2 - a.y, len = Math.hypot(ex, ey), wire = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, len, 4), metalDark); wire.position.set(ex / 2, ey / 2, 0); wire.rotation.z = Math.atan2(ey, ex) - Math.PI / 2; g.add(wire); }
    } else if (a.kind === "balloon") {
      const bal = new T.Mesh(new T.SphereGeometry(1.6, 24, 18), phys({ color: [0xff5a6e, 0xffbe3c, 0x5ac8ff, 0xaa78ff][a.id % 4], roughness: 0.25, clearcoat: 1 })); bal.scale.set(1, 1.2, 1); bal.position.y = 3.6; g.add(bal);
      const str = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 1.8, 4), basic(0xffffff)); str.position.y = 1.4; g.add(str); g.userData.bob = true;
    } else if (a.kind === "ring") {
      ring.scale.setScalar(1.9); ring.material.color.set(NEON_COL[a.id % NEON_COL.length]); ring.material.opacity = 1;
      for (const sd of [-1, 1]) { const c2 = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 30, 4), metalDark); c2.position.set(sd * 1.2, 16, 0); c2.rotation.z = sd * 0.06; g.add(c2); }
    } else {
      // A hover-lamp: a little drone carrying the light.
      const body = new T.Mesh(new T.SphereGeometry(0.55, 18, 12), phys({ color: 0xeef1f6, metalness: 0.3, roughness: 0.25, clearcoat: 1 })); body.scale.set(1.4, 0.45, 1); body.position.y = 0.8; g.add(body);
      const props2 = []; for (const sd of [-1, 1]) { const pr = new T.Mesh(boxGeo, std({ color: 0x2b2f38, roughness: 0.4 })); pr.scale.set(1.1, 0.02, 0.08); pr.position.set(sd * 0.95, 1.05, 0); g.add(pr); props2.push(pr); }
      g.userData.props = props2; g.userData.bob = true;
    }
    // Special anchors: gold shimmer, crumbling cracks, drifting arrows, a spring coil.
    if (a.type === "gold") { node.material.color.set(0xffd25a); g.add(glow(0xffd25a, 5.5, 0.5)); }
    else if (a.type === "crumble") { node.material.color.set(0xff7a3d); for (let q = 0; q < 3; q++) { const cr = new T.Mesh(boxGeo, basic(0x3a1408)); cr.scale.set(0.05, 0.5, 0.05); cr.rotation.z = q * 1.1 + 0.3; cr.position.z = 0.42; g.add(cr); } }
    else if (a.type === "drift") { node.material.color.set(0x7ff0ff); for (const sd of [-1, 1]) { const ar = new T.Mesh(new T.ConeGeometry(0.22, 0.45, 3), basic(0x7ff0ff)); ar.rotation.z = -sd * Math.PI / 2; ar.position.set(sd * 1.25, 0, 0); g.add(ar); } }
    else if (a.type === "spring") { node.material.color.set(0x8dff6a); for (let q = 0; q < 4; q++) { const co = new T.Mesh(new T.TorusGeometry(0.32, 0.05, 6, 20), basic(0x8dff6a)); co.rotation.x = Math.PI / 2; co.position.y = -0.55 - q * 0.22; g.add(co); } }
    g.userData.node = node; g.userData.halo = halo; g.userData.ring = ring;
    g.position.set(a.x, a.y, 0); scene.add(g); a.mesh = g; anchorGroups.add(g); return g;
  }
  // ---------- The being of light ----------
  function makeLight(L) {
    const ch = RUNNER_CHARS[L.char] || RUNNER_CHARS[0], glowC = runnerGlow();
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const core = new T.MeshBasicMaterial({ color: ch.look.core, toneMapped: false }), soft = new T.MeshBasicMaterial({ color: glowC, toneMapped: false, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
    const cap = (r, len, mat) => { const q = new T.Group(); const c = new T.Mesh(new T.CylinderGeometry(r, r * 0.85, len, 12), mat); c.position.y = -len / 2; q.add(c); const e1 = new T.Mesh(new T.SphereGeometry(r, 12, 8), mat); q.add(e1); const e2 = new T.Mesh(new T.SphereGeometry(r * 0.85, 12, 8), mat); e2.position.y = -len; q.add(e2); return q; };
    const hips = new T.Group(); hips.position.y = 0.95; body.add(hips);
    const torso = new T.Group(); hips.add(torso);
    const chest = new T.Mesh(new T.SphereGeometry(0.2, 18, 14), core); chest.scale.set(1, 1.55, 0.75); chest.position.y = 0.3; torso.add(chest);
    const head = new T.Mesh(new T.SphereGeometry(0.15, 18, 14), core); head.position.y = 0.78; head.scale.set(0.9, 1.05, 0.95); torso.add(head);
    const arms = [], legs = [];
    for (const s of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(0, 0.58, s * 0.2); torso.add(sh); const up = cap(0.055, 0.28, core); sh.add(up); const el = new T.Group(); el.position.y = -0.28; sh.add(el); el.add(cap(0.045, 0.26, core)); arms.push({ sh, el });
      const hip = new T.Group(); hip.position.set(0, 0, s * 0.1); hips.add(hip); hip.add(cap(0.075, 0.42, core)); const kn = new T.Group(); kn.position.y = -0.42; hip.add(kn); kn.add(cap(0.06, 0.42, core)); legs.push({ hip, kn });
    }
    const aura = glow(glowC, 3.4, 0.6); aura.position.y = 1.1; g.add(aura);
    const aura2 = glow(0xffffff, 1.4, 0.8); aura2.position.y = 1.2; g.add(aura2);
    const shield = new T.Mesh(new T.SphereGeometry(1.3, 28, 18), new T.MeshBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending })); shield.position.y = 1; shield.visible = false; g.add(shield);
    g.userData = { body, hips, torso, arms, legs, aura, shield, core, soft };
    return g;
  }
  let hero = makeLight(runnerLook()); scene.add(hero);
  const lookOf = () => { const L = runnerLook(); return `${L.char}.${L.top}.${L.shoe}.${L.board}`; };
  let lookKey = lookOf();
  // The scarf: a ribbon of light trailing from the shoulders.
  const SC = 48, scPos = new Float32Array(SC * 2 * 3), scCol = new Float32Array(SC * 2 * 3), scIdx = [];
  for (let q = 0; q < SC - 1; q++) { const a = q * 2; scIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const scGeo = new T.BufferGeometry(); scGeo.setAttribute("position", new T.BufferAttribute(scPos, 3)); scGeo.setAttribute("color", new T.BufferAttribute(scCol, 3)); scGeo.setIndex(scIdx);
  const scMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const scarf = new T.Mesh(scGeo, scMat); scarf.frustumCulled = false; scene.add(scarf);
  const scarf2 = new T.Mesh(scGeo.clone(), scMat); scarf2.frustumCulled = false; scene.add(scarf2);
  const hist = [];
  // The tether.
  const tether = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1, 8), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); scene.add(tether);
  const tetherGlow = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1, 8), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); scene.add(tetherGlow);
  // The ghost of today's best daily run.
  const ghost = glow(0x9fe8ff, 2.2, 0.5); scene.add(ghost);
  const finish3 = new T.Group(); { const pole = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 90, 8), basic(0xffffff)); pole.position.y = 45; finish3.add(pole); const beam = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 90, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false })); beam.position.y = 45; finish3.add(beam); finish3.visible = false; scene.add(finish3); }
  // The darkness: a towering wall of shadow with a violet edge.
  const darkTex = tex(128, 256, (g2) => { const gr = g2.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, "rgba(4,2,10,1)"); gr.addColorStop(0.75, "rgba(10,4,24,0.92)"); gr.addColorStop(1, "rgba(40,10,70,0)"); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 256); });
  const darkWall = new T.Mesh(new T.PlaneGeometry(90, 140), new T.MeshBasicMaterial({ map: darkTex, transparent: true, depthWrite: false, fog: false })); darkWall.position.z = 6; scene.add(darkWall);
  const darkEdge = []; for (let q = 0; q < 6; q++) { const s2 = glow(0x8a3dff, 10, 0.35); scene.add(s2); darkEdge.push(s2); }
  const smokeTex = tex(128, 128, (g2) => { const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(6,2,16,0.95)"); gr.addColorStop(0.6, "rgba(16,6,36,0.6)"); gr.addColorStop(1, "rgba(16,6,36,0)"); g2.fillStyle = gr; g2.beginPath(); for (let q = 0; q < 9; q++) { const a3 = q / 9 * Math.PI * 2, rr = 40 + (q % 3) * 12; g2.lineTo(64 + Math.cos(a3) * rr, 64 + Math.sin(a3) * rr); } g2.fill(); });
  const tendrils = []; for (let q = 0; q < (lite ? 5 : 8); q++) { const td = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, fog: false })); scene.add(td); tendrils.push(td); }
  const heartCore = new T.Group(); { const core = new T.Mesh(new T.SphereGeometry(1, 28, 18), new T.MeshBasicMaterial({ color: 0x07030f })); heartCore.add(core); heartCore.add(glow(0x8a3dff, 4.5, 0.7)); const eye = new T.Mesh(new T.SphereGeometry(0.25, 16, 10), basic(0xd9b8ff)); eye.position.set(0.55, 0.15, 0.8); heartCore.add(eye); for (let q = 0; q < 6; q++) { const sp = new T.Mesh(new T.ConeGeometry(0.18, 1.1, 6), new T.MeshBasicMaterial({ color: 0x150828 })); const a3 = q / 6 * Math.PI * 2; sp.position.set(Math.cos(a3) * 1.05, Math.sin(a3) * 1.05, 0); sp.rotation.z = a3 - Math.PI / 2; heartCore.add(sp); } heartCore.visible = false; scene.add(heartCore); }
  const boltGeo = new T.BufferGeometry(); boltGeo.setAttribute("position", new T.BufferAttribute(new Float32Array(24), 3));
  const bolt = new T.Line(boltGeo, new T.LineBasicMaterial({ color: 0xc9a8ff, transparent: true, opacity: 0.9, fog: false })); bolt.frustumCulled = false; scene.add(bolt);
  // Sky extras.
  const starTex = tex(256, 16, (g2) => { const gr = g2.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.9, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,1)"); g2.fillStyle = gr; g2.fillRect(0, 6, 256, 4); });
  const star2 = new T.Mesh(new T.PlaneGeometry(26, 1.2), new T.MeshBasicMaterial({ map: starTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); star2.rotation.z = 0.34; star2.visible = false; scene.add(star2);
  const auroraTex = tex(256, 128, (g2) => { for (let x = 0; x < 256; x += 2) { const h2 = 50 + Math.sin(x * 0.05) * 20 + Math.sin(x * 0.13) * 10, gr = g2.createLinearGradient(0, 128 - h2, 0, 128); gr.addColorStop(0, "rgba(120,255,210,0)"); gr.addColorStop(0.5, `rgba(${x % 64 < 32 ? "120,255,210" : "150,140,255"},0.5)`); gr.addColorStop(1, "rgba(120,255,210,0)"); g2.fillStyle = gr; g2.fillRect(x, 128 - h2, 2, h2); } });
  const auroras = [0, 1, 2].map(() => { const au = new T.Mesh(new T.PlaneGeometry(160, 60), new T.MeshBasicMaterial({ map: auroraTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 })); scene.add(au); return au; });
  const rayTex = tex(256, 256, (g2) => { g2.translate(128, 128); for (let q = 0; q < 14; q++) { g2.rotate(Math.PI * 2 / 14); const gr = g2.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, "rgba(255,236,200,0.6)"); gr.addColorStop(1, "rgba(255,236,200,0)"); g2.fillStyle = gr; g2.beginPath(); g2.moveTo(0, 0); g2.lineTo(128, -6 - (q % 3) * 3); g2.lineTo(128, 6 + (q % 3) * 3); g2.fill(); } });
  const rays = new T.Sprite(new T.SpriteMaterial({ map: rayTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 })); rays.scale.set(300, 300, 1); scene.add(rays);
  // Pickups and hazards.
  const pools = {};
  const get = (kind, make) => { const P = pools[kind] || (pools[kind] = { list: [], used: 0 }); if (P.used >= P.list.length) { const o = make(); scene.add(o); P.list.push(o); } const o = P.list[P.used++]; o.visible = true; return o; };
  const poolsBegin = () => { for (const k in pools) pools[k].used = 0; };
  const poolsEnd = () => { for (const k in pools) { const P = pools[k]; for (let q = P.used; q < P.list.length; q++) P.list[q].visible = false; } };
  const letterTex = {};
  const makers = {
    mote: () => { const g = new T.Group(); g.add(new T.Mesh(new T.OctahedronGeometry(0.3, 0), basic(0xffd25a))); g.add(glow(0xffc23d, 1.2, 0.55)); return g; },
    up: () => { const g = new T.Group(); const ring = new T.Mesh(new T.TorusGeometry(0.75, 0.07, 10, 40), basic(0xffffff)); g.add(ring); const core = new T.Mesh(new T.IcosahedronGeometry(0.42, 1), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); g.add(core); const gl = glow(0xffffff, 3.4, 0.7); g.add(gl); g.userData = { ring, core, gl }; return g; },
    wire: () => { const g = new T.Group(); const w2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1, 6), basic(0x2b2f38)); w2.rotation.z = Math.PI / 2; g.add(w2); const sp = []; for (let q = 0; q < 4; q++) { const s2 = glow(0x7fd8ff, 1.2, 0.9); g.add(s2); sp.push(s2); } for (const sd of [-1, 1]) { const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 2.6, 8), metalDark); pole.position.set(sd * 0.5, -1.3, 0); g.add(pole); g.userData["p" + sd] = pole; } g.userData.w = w2; g.userData.sp = sp; return g; },
    drone: () => { const g = new T.Group(); const b2 = new T.Mesh(new T.SphereGeometry(0.55, 20, 12), phys({ color: 0x1f2430, metalness: 0.7, roughness: 0.25, clearcoat: 1 })); b2.scale.set(1.3, 0.6, 1); g.add(b2); const eye = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), basic(0xff2b4a)); eye.position.z = 0.55; g.add(eye); g.add(glow(0xff2b4a, 2.4, 0.7)); const pr = []; for (const sd of [-1, 1]) { const p2 = new T.Mesh(boxGeo, std({ color: 0xbfc5cc, roughness: 0.4 })); p2.scale.set(1, 0.02, 0.08); p2.position.set(sd * 0.9, 0.35, 0); g.add(p2); pr.push(p2); } g.userData.pr = pr; return g; },
    spark: () => glow(0xffd25a, 0.8, 1),
    shard: () => { const g = new T.Group(); g.add(new T.Mesh(new T.OctahedronGeometry(0.7, 0), new T.MeshBasicMaterial({ color: 0xe6d8ff, toneMapped: false }))); g.add(glow(0xb08cff, 5, 0.8)); g.add(new T.Mesh(new T.TorusGeometry(1.2, 0.05, 6, 32), basic(0xb08cff))); return g; },
    shock: () => new T.Mesh(new T.TorusGeometry(1, 0.07, 6, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })),
    burst: () => new T.Mesh(new T.TorusGeometry(1, 0.06, 6, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })),
    pulse: () => glow(0xffffff, 0.9, 0.9),
  };
  const letterMaker = ch => () => { const g = new T.Group(); const t2 = letterTex[ch] || (letterTex[ch] = tex(128, 128, (c) => { c.fillStyle = "#ffffff"; c.font = "900 104px Inter, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "#ffd25a"; c.shadowBlur = 16; c.fillText(ch, 64, 70); })); g.add(new T.Mesh(new T.PlaneGeometry(1.8, 1.8), new T.MeshBasicMaterial({ map: t2, color: 0xffe08a, transparent: true, toneMapped: false, depthWrite: false }))); g.add(new T.Mesh(new T.TorusGeometry(1.15, 0.06, 10, 40), basic(0xffd25a))); g.add(glow(0xffd25a, 4, 0.5)); return g; };

  // ---------- Size ----------
  let W0 = 0, H0 = 0, dpr0 = 0, last = 0, onFail = false, adT = 0, lastPx = null;
  const dprMax = lite ? 1 : 1.5;
  let dprCap = dprMax, ema = 0.016, emaT = 0;
  function size(W, H) {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    if (W === W0 && H === H0 && dpr === dpr0) return;
    W0 = W; H0 = H; dpr0 = dpr; renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  const v3 = new T.Vector3(), up3 = new T.Vector3(0, 1, 0);
  const placeBetween = (mesh, x1, y1, x2, y2, z = 0) => { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); mesh.scale.set(1, len, 1); mesh.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2); };

  function draw(ctx2d, W, H, P) {
    if (onFail) return null;
    const R = run, t = R.t, c2 = ctx2d.canvas;
    if (view.parentNode !== c2.parentNode) c2.parentNode.insertBefore(view, c2);
    size(W, H);
    const now = performance.now(), dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    // Adaptive resolution: if frames are slow, draw fewer pixels; if there's room, more.
    ema += (dt - ema) * 0.05; emaT += dt;
    if (emaT > 1) { emaT = 0; if (ema > 0.021 && dprCap > 0.75) { dprCap = Math.max(0.75, dprCap - 0.25); W0 = 0; } else if (ema < 0.0145 && dprCap < dprMax) { dprCap = Math.min(dprMax, dprCap + 0.25); W0 = 0; } }
    const night = P.night, day = 1 - night, blackout = !!P.blackout;
    // A new run: clear the old skyline.
    const jumped = lastPx == null || R.px < lastPx - 40 || R.px > lastPx + 300;
    if (jumped) { for (const L2 of bgList) { L2.list.forEach(o => scene.remove(o.m)); L2.list = []; L2.next = null; } for (const o of bldGroups) scene.remove(o); bldGroups.clear(); for (const o of anchorGroups) scene.remove(o); anchorGroups.clear(); }
    lastPx = R.px;
    // Camera: side-on, looking ahead, pulling back as you speed up.
    const spd = R.v || 10, fit = Math.max(1, 0.5 / (W / H)) * 0.9;
    const aim = R.teth || swingFindAnchor(R);
    let tx = R.px + 5 + Math.max(0, R.vx) * 0.12, ty = R.py + 4;
    if (aim) { tx = tx * 0.6 + (aim.x + 2) * 0.4; ty = ty * 0.55 + (aim.y - 2) * 0.45; }
    ty = Math.max(9, Math.min(60, ty));
    // Always keep the figure in view: in the left part of the screen, with room ahead and above.
    const Dt = (34 + Math.min(12, Math.max(0, spd - 10) * 0.45)) * fit, halfH = Dt * Math.tan(25 * Math.PI / 180), halfW = halfH * (W / H);
    tx = Math.max(R.px + halfW * 0.15, Math.min(R.px + halfW * 0.55, tx));
    ty = Math.max(R.py - halfH * 0.35, Math.min(R.py + halfH * 0.45, ty));
    const cam = camera.userData; if (jumped) cam.x = cam.y = null; cam.x = cam.x == null ? tx : cam.x + (tx - cam.x) * Math.min(1, dt * 3.5); cam.y = cam.y == null ? ty : cam.y + (ty - cam.y) * Math.min(1, dt * 2.5);
    cam.x = Math.max(R.px + halfW * 0.05, Math.min(R.px + halfW * 0.7, cam.x)); cam.y = Math.max(R.py - halfH * 0.55, Math.min(R.py + halfH * 0.6, cam.y));
    const D = Dt, sh = R.shake > 0 ? R.shake * 0.5 : 0;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + 1.5 - (R.kick || 0) + (Math.random() - 0.5) * sh, D); camera.lookAt(cam.x, cam.y, 0);
    // Sky and light.
    skyU.top.value.copy(C(P.sky[0])); skyU.mid.value.copy(C(P.sky[1])); skyU.bot.value.copy(C(P.sky[2]));
    sky.position.copy(camera.position);
    scene.fog.color.copy(C(P.sky[2])).lerp(C(P.sky[1]), 0.35); scene.fog.near = 50; scene.fog.far = 210 + night * 40;
    hemi.color.copy(C(P.sky[1])).lerp(new T.Color(1, 1, 1), 0.5); hemi.groundColor.copy(C(P.tower)).multiplyScalar(0.4); hemi.intensity = blackout ? 0.15 : 0.35 + day * 0.6;
    sun.color.copy(C(P.sky[2])).lerp(new T.Color(1, 1, 1), 0.5); sun.intensity = blackout ? 0.05 : 0.2 + day * 1.3; sun.position.set(camera.position.x - 40, 80, 60); sun.target.position.set(camera.position.x, 0, 0);
    stars.material.opacity = Math.max(0, night - 0.35) / 0.65; stars.visible = stars.material.opacity > 0.01; stars.position.copy(camera.position);
    sunSpr.material.opacity = day * 0.9; sunSpr.visible = day > 0.05; sunSpr.position.set(camera.position.x + 120, 170, -330);
    moon.visible = night > 0.3; moon.material.opacity = Math.max(0, night - 0.3) / 0.7; moon.position.set(camera.position.x - 60, 150, -330);
    const cloudC = C(P.sky[2], tmpCloud).lerp(WHITE, 0.55);
    clouds.forEach(cl => { cl.s.position.set(camera.position.x + cl.x * 0.6, cl.y, cl.z); cl.s.scale.set(cl.w, cl.w * 0.45, 1); cl.s.material.opacity = Math.max(0, 0.8 - night); cl.s.visible = night < 0.78; cl.s.material.color.copy(cloudC); });
    scene.environment = null;
    rain.visible = !!P.rain;
    if (P.rain) { for (let q = 0; q < rainN; q++) { const s = rainSeed[q], x = (s[0] - 0.5) * 70 + cam.x, z = 10 - s[1] * 40, y = cam.y + 30 - ((s[2] * 60 + t * 30) % 60); rainPos.set([x, y, z, x - 0.1, y - 1.2, z], q * 6); } rainGeo.attributes.position.needsUpdate = true; }
    // The street and the water.
    road.position.x = walk.position.x = cam.x;
    const th = runnerTheme(R.px), dStart = Math.floor(Math.max(0, R.px) / RUN.BIOME_M) * RUN.BIOME_M;
    let wx = null; for (const s0 of [dStart - RUN.BIOME_M, dStart, dStart + RUN.BIOME_M]) if (s0 >= 0 && runnerTheme(s0).water && Math.abs(s0 + RUN.BIOME_M / 2 - cam.x) < RUN.BIOME_M) wx = s0;
    water.visible = wx != null; if (wx != null) water.position.set(wx + RUN.BIOME_M / 2, 0.08, -8);
    cars.forEach(cr => { cr.x += cr.v * dt; if (cr.x < cam.x - 80) cr.x += 160; if (cr.x > cam.x + 80) cr.x -= 160; cr.g.position.set(cr.x, 0, cr.z); cr.g.rotation.y = cr.v > 0 ? 0 : Math.PI; cr.hl.position.set(2.2, 0.8, 0); cr.tl.position.set(-2.2, 0.8, 0); cr.hl.material.opacity = 0.3 + night * 0.6; cr.tl.material.opacity = 0.2 + night * 0.5; cr.g.visible = !water.visible || Math.abs(cr.x - (wx + RUN.BIOME_M / 2)) > RUN.BIOME_M / 2; });
    poolsBegin();
    // Play-line buildings: lit ones glow; the sweep climbs as they wake.
    const glowC = tmpGlow.set(runnerGlow()), towerC = C(P.tower, tmpTower), towerLight = tmpTowerL.copy(towerC).lerp(WHITE, 0.55 + day * 0.2);
    for (const b of R.blds) {
      const g = bldMesh(b); g.userData.swingOld = true; g.visible = true;
      const k = b.litT < 0 ? 0 : Math.min(1, b.litT / 0.9), u = g.userData;
      if (b.tree) { u.leaf.emissiveIntensity = k * 0.35 * night; u.lights.forEach(s2 => (s2.material.opacity = k * (0.4 + night * 0.6))); continue; }
      // Windows flick on in steps, with a little flicker while they wake.
      const ks = k >= 1 ? 1 : Math.floor(k * 6) / 6 * (0.75 + 0.25 * Math.random());
      u.mat.emissiveIntensity = ks * (blackout ? 0.3 : 0.2 + night * 0.6);
      u.leds.forEach(ld => { ld.material.opacity = k * (0.55 + 0.35 * Math.sin(t * 2 + u.ph)) * (0.4 + night * 0.6); ld.material.color.copy(glowC); });
      u.beacon.material.opacity = k > 0.5 ? (Math.sin(t * 3 + u.ph) > 0.6 ? 0.9 : 0.1) * (0.3 + night * 0.7) : 0;
      if (b.litT >= 0 && b.litT < 0.8) { const sw = get("shock", makers.shock), q2 = b.litT / 0.8; sw.position.set((b.x0 + b.x1) / 2, b.h * 0.6, 1.8); sw.scale.setScalar(1 + q2 * (b.x1 - b.x0) * 0.9); sw.material.opacity = 0.8 * (1 - q2); sw.material.color.copy(glowC); }
      u.mat.color.copy(towerLight); if (k < 1) u.mat.color.lerp(darkTint, (1 - k) * (0.5 + night * 0.45));
      u.rim.material.opacity = k * 0.9; u.rim.material.color.copy(glowC);
      u.sweep.visible = k > 0 && k < 1; u.sweep.material.opacity = u.sweep.visible ? 0.55 * Math.sin(k * Math.PI) : 0; u.sweep.position.y = k * b.h;
      if (u.neon) u.neon.color.set(u.neonCol).multiplyScalar(0.2 + k * (0.5 + night * 0.9));
    }
    { const live = new Set(); for (const b of R.blds) if (b.mesh) live.add(b.mesh);
      for (const o of bldGroups) if (!live.has(o)) { scene.remove(o); bldGroups.delete(o); o.traverse(q => { if (q.geometry && q.geometry !== boxGeo && !q.geometry.userData.cached) q.geometry.dispose(); if (q.material && q.material.isMaterial && q.material !== roofMat && q.material !== metalDark && !q.material.map) q.material.dispose(); }); } }

    // The skyline behind.
    layers.forEach((Ly, li) => {
      const L2 = bgList[li]; if (L2.next == null) L2.next = cam.x - 120;
      while (L2.next < cam.x + 200) { const r = seeded(Math.floor(L2.next * 7.31) + li * 999), w = Ly.sp * (0.6 + r() * 0.6), hh = Ly.h[0] + r() * (Ly.h[1] - Ly.h[0]), st = li, m2 = new T.Mesh(boxUVc(w, hh, 14), bgDark[li]); m2.position.set(L2.next + w / 2, hh / 2, Ly.z); scene.add(m2); L2.list.push({ m: m2, x: L2.next + w / 2, st }); L2.next += w + 2 + r() * 6; }
      L2.list = L2.list.filter(o => { if (o.x < cam.x - 160) { scene.remove(o.m); return false; } return true; });
      for (const o of L2.list) o.m.material = (o.x < R.px + 10 + li * 6) && !blackout ? bgLit[o.st] : bgDark[o.st];
    });
    // Each layer fades toward the horizon colour with distance (aerial perspective).
    layers.forEach((Ly, li) => { const base = C(P.tower, tmpA).multiplyScalar(0.18 + day * 0.35).lerp(C(P.sky[2], tmpB), 0.15 + li * 0.22); bgLit[li].color.copy(base); bgDark[li].color.copy(base); bgLit[li].emissiveIntensity = (0.25 + night * 0.75) * (1 - li * 0.25); });
    // Anchors: the best one to grab glows brighter, with a ring.
    const best = !R.teth ? swingFindAnchor(R) : null;
    for (const a of R.anchors) {
      const g = anchorMesh(a, R), u = g.userData; g.visible = Math.abs(a.x - cam.x) < 90; g.userData.swingAnchor = true;
      const hot = a === best || a === R.teth;
      u.ring.material.opacity = hot ? 0.9 : a.kind === "ring" ? 0.8 : 0.25; u.ring.scale.setScalar((a.kind === "ring" ? 1.9 : 1) * (hot ? 1 + 0.12 * Math.sin(t * 8) : 1));
      u.halo.material.opacity = hot ? 0.95 : 0.45; u.halo.material.color.copy(glowC);
      if (u.bob && !a.broken) g.position.y = a.y + Math.sin(t * 1.5 + (a.ph || 0)) * 0.12;
      if (u.props) u.props.forEach((p2, q) => (p2.rotation.y = t * 30 + q));
      if (a.type === "drift") g.position.x = a.x;
      if (a.type === "gold") { g.rotation.z = t * 0.8; u.halo.material.color.set(0xffd25a); }
      if (a.type === "crumble") { const shake = a === R.teth ? Math.min(1, R.tethT / 1.25) : 0; g.position.x = a.x + (Math.random() - 0.5) * shake * 0.3; u.node.material.color.setRGB(1, 0.48 - shake * 0.3, 0.24 - shake * 0.2); }
      if (a.broken) { a.fallV = (a.fallV || 0) + dt * 25; g.position.y -= a.fallV * dt; g.rotation.z += dt * 3; u.halo.material.opacity = 0; u.ring.material.opacity = 0; }
    }
    { const live = new Set(); for (const a of R.anchors) if (a.mesh) live.add(a.mesh); for (const o of anchorGroups) if (!live.has(o)) { scene.remove(o); anchorGroups.delete(o); } }
    // The being of light.
    const lk = lookOf(); if (lk !== lookKey) { lookKey = lk; scene.remove(hero); hero = makeLight(runnerLook()); scene.add(hero); }
    const u = hero.userData, blink = R.inv > 0.3 && Math.floor(R.inv * 12) % 2;
    hero.visible = !blink; hero.position.set(R.px, R.py, 0); hero.scale.setScalar(1.3);
    const p = R.phase, s = Math.sin(p), air = !R.teth && !R.roof;
    const lr = (o, k, v) => (o[k] += (v - o[k]) * Math.min(1, dt * 14));
    if (R.roof) { lr(u.legs[0].hip.rotation, "z", s * 0.9); lr(u.legs[1].hip.rotation, "z", -s * 0.9); u.legs.forEach((l, q) => lr(l.kn.rotation, "z", -(0.2 + Math.max(0, (q ? 1 : -1) * Math.sin(p - 0.9)) * 1.2))); lr(u.arms[0].sh.rotation, "z", -s * 0.8); lr(u.arms[1].sh.rotation, "z", s * 0.8); u.arms.forEach(a => lr(a.el.rotation, "z", 1.2)); lr(hero.rotation, "z", -0.25); }
    else if (R.teth) {
      // Reaching up the tether with one arm, legs trailing.
      const a = R.teth, ang = Math.atan2(a.y - R.py - 1.4, a.x - R.px);
      lr(hero.rotation, "z", (ang - Math.PI / 2) * 0.6); lr(u.arms[1].sh.rotation, "z", Math.PI - 0.1); lr(u.arms[1].el.rotation, "z", 0); lr(u.arms[0].sh.rotation, "z", 0.6); lr(u.arms[0].el.rotation, "z", 0.8);
      lr(u.legs[0].hip.rotation, "z", -0.3 - R.vx * 0.01); lr(u.legs[1].hip.rotation, "z", 0.25 - R.vx * 0.01); u.legs.forEach(l => lr(l.kn.rotation, "z", -0.5));
    } else {
      // Flying: tucked into a spin after a release.
      hero.rotation.z = -R.spin; const tuck = Math.min(1, Math.abs(R.spinV) / 4);
      u.legs.forEach(l => { lr(l.hip.rotation, "z", 1.3 * tuck + 0.2); lr(l.kn.rotation, "z", -1.8 * tuck); }); u.arms.forEach((a, q) => { lr(a.sh.rotation, "z", (q ? 2.6 : 2.2) * (1 - tuck) + 0.6 * tuck); lr(a.el.rotation, "z", 1 * tuck); });
    }
    u.shield.visible = R.power && R.power.kind === "shield";
    u.aura.material.opacity = 0.45 + night * 0.3 + (R.power ? 0.25 : 0) + (R.od > 0 ? 0.35 : 0); u.aura.material.color.copy(R.od > 0 ? new T.Color(0xffc23d) : R.power ? new T.Color(`rgb(${RUNNER_POWERS[R.power.kind].rgb})`) : glowC); u.aura.scale.setScalar(R.od > 0 ? 4.6 + Math.sin(t * 10) * 0.3 : R.dashT > 0 ? 4.2 : 3.4);
    if (R.over) { hero.rotation.z += dt * 6; }
    // The scarf follows the shoulders.
    const nk = new T.Vector3(0, 1.45, 0).applyMatrix4(hero.matrixWorld.compose(hero.position, hero.quaternion.setFromEuler(hero.rotation), hero.scale));
    { const e = hist.length >= SC ? hist.pop() : [0, 0]; e[0] = nk.x; e[1] = nk.y; hist.unshift(e); } const scf = RUNNER_SHOES[runnerLook().shoe] || RUNNER_SHOES[0], N2 = Math.min(SC, scf.len); if (hist.length > SC) hist.length = SC;
    const scC = scf.c === "prism" || R.od > 0 ? null : tmpB.set(scf.c ?? runnerGlow());
    const fill = (geo, off) => { const pos = geo.attributes.position.array, col = geo.attributes.color.array;
      for (let q = 0; q < SC; q++) { const h0 = hist[Math.min(q, hist.length - 1)] || [R.px, R.py + 1.45], k = q / (N2 - 1), wv = q < N2 ? scf.w * (1 - k) * (0.6 + 0.4 * Math.sin(t * 9 - q * 0.5)) : 0, yo = Math.sin(t * 7 - q * 0.45) * 0.12 * k + off;
        const o = q * 6; pos[o] = pos[o + 3] = h0[0]; pos[o + 1] = h0[1] + yo + wv / 2; pos[o + 4] = h0[1] + yo - wv / 2; pos[o + 2] = pos[o + 5] = -0.15;
        const c3 = scC || tmpA.setHSL((t * 0.3 + q * 0.03) % 1, 0.9, 0.6), f = q < N2 ? (1 - k) : 0; col[o] = col[o + 3] = c3.r * f; col[o + 1] = col[o + 4] = c3.g * f; col[o + 2] = col[o + 5] = c3.b * f; }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; };
    fill(scGeo, 0); scarf2.visible = !!scf.twin; if (scf.twin) fill(scarf2.geometry, -0.35);
    // The tether.
    tether.visible = tetherGlow.visible = !!R.teth;
    if (R.teth) { const bc = (RUNNER_BOARDS[runnerLook().board] || RUNNER_BOARDS[0]).c, tc = bc === "prism" ? new T.Color().setHSL((t * 0.4) % 1, 0.9, 0.65) : new T.Color(bc); const hy = R.py + 1.7; placeBetween(tether, R.px, hy, R.teth.x, R.teth.y); placeBetween(tetherGlow, R.px, hy, R.teth.x, R.teth.y); tether.material.color.copy(tc); tetherGlow.material.color.copy(tc); tetherGlow.material.opacity = 0.3 + Math.sin(t * 20) * 0.08; }
    // The ghost.
    const gp3 = R.ghostTrace ? stageGhostAt(R.ghostTrace, R.stageT || 0) : null, gy = gp3 ? null : R.ghost && !R.attract ? R.ghost[Math.floor(Math.max(0, R.px)) + 6] : null; ghost.visible = gy != null || !!gp3; if (gp3) ghost.position.set(gp3[0], gp3[1] + 1.1, -0.3); else if (gy != null) ghost.position.set(R.px + 6, gy + 1, -0.3);
    finish3.visible = !!R.stageLen; if (R.stageLen) { finish3.position.set(R.stageLen, 0, 0); finish3.children[1].material.opacity = 0.35 + Math.sin(t * 4) * 0.1; }
    if (R.teth) { const hy = R.py + 1.7; for (let q = 0; q < 4; q++) { const f2 = (t * 1.8 + q / 4) % 1, pu = get("pulse", makers.pulse); pu.position.set(R.px + (R.teth.x - R.px) * f2, hy + (R.teth.y - hy) * f2, 0.1); pu.material.opacity = 0.9 * Math.sin(f2 * Math.PI); pu.material.color.copy(tether.material.color); } }
    for (const bu of R.bursts) { const ring2 = get("burst", makers.burst), q2 = bu.t / 0.8; ring2.position.set(bu.x, bu.y, 0.3); ring2.scale.setScalar((bu.big ? 1 : 0.5) + q2 * (bu.big ? 5 : 2.5)); ring2.material.opacity = 0.9 * (1 - q2); ring2.material.color.set(bu.c ?? runnerGlow()); }
    // The Heart of the Dark: a great dark core with a violet eye, riding the darkness.
    heartCore.visible = !!(R.ev && R.ev.kind === "heart");
    if (heartCore.visible) { heartCore.position.set(R.darkX + 3, R.py + 2 + Math.sin(t * 1.3) * 1.5, 2); heartCore.scale.setScalar(4.5 * (1 - R.ev.hits * 0.18) + Math.sin(t * 6) * 0.2); heartCore.rotation.y = t; }
    // The darkness: tendrils curling at its edge, violet lightning now and then.
    tendrils.forEach((td, q) => { const a2 = t * (0.4 + q * 0.05) + q; td.position.set(R.darkX + 2 + Math.sin(a2) * 3, cam.y - 26 + q * (52 / tendrils.length) + Math.cos(a2 * 1.3) * 2, 6.1); td.material.rotation = a2; td.scale.setScalar(7 + Math.sin(a2 * 2) * 2); });
    bolt.visible = Math.random() < 0.04; if (bolt.visible) { const pos = bolt.geometry.attributes.position.array; let bx2 = R.darkX + 1, by2 = cam.y + 20; for (let q = 0; q < 8; q++) { pos[q * 3] = bx2; pos[q * 3 + 1] = by2; pos[q * 3 + 2] = 6.3; bx2 += (Math.random() - 0.3) * 3; by2 -= 4 + Math.random() * 3; } bolt.geometry.attributes.position.needsUpdate = true; }
    // The sky: shooting stars and an aurora at night, rays of light at dawn.
    if (!star2.userData.t || star2.userData.t > 1.2) { if (night > 0.6 && Math.random() < dt * 0.25) star2.userData = { t: 0, x: cam.x + (Math.random() - 0.2) * 80, y: cam.y + 40 + Math.random() * 30 }; }
    if (star2.userData.t != null && star2.userData.t <= 1.2) { star2.userData.t += dt; const k2 = star2.userData.t / 1.2; star2.visible = true; star2.position.set(star2.userData.x - k2 * 50, star2.userData.y - k2 * 18, -150); star2.material.opacity = Math.sin(k2 * Math.PI); } else star2.visible = false;
    auroras.forEach((au, q) => { au.position.set(cam.x + (q - 1) * 120, cam.y + 70 + q * 8, -260); au.material.opacity = Math.max(0, night - 0.6) * 1.4 * (0.6 + 0.4 * Math.sin(t * 0.3 + q * 2)); au.visible = !lite && au.material.opacity > 0.01; au.rotation.z = Math.sin(t * 0.1 + q) * 0.06; });
    rays.position.set(camera.position.x + 120, 170, -320); rays.material.opacity = Math.max(0, Math.min(night - 0.15, 0.65 - night)) * 1.6; rays.visible = rays.material.opacity > 0.01; rays.material.rotation = t * 0.02;
    // The darkness.
    const darkOn = R.darkX > cam.x - 45; darkWall.visible = darkOn; darkEdge.forEach(e2 => (e2.visible = darkOn)); tendrils.forEach(td => (td.visible = darkOn));
    darkWall.position.set(R.darkX - 45, cam.y, 6); darkEdge.forEach((e2, q) => { e2.position.set(R.darkX + Math.sin(t * 2 + q) * 1.5, cam.y - 28 + q * 11, 6.2); e2.material.opacity = 0.3 + Math.sin(t * 3 + q) * 0.1; });
    // Lights, power-ups, letters, wires, drones.
    for (const c of R.motes) { if (Math.abs(c.x - cam.x) > 45) continue; const g = get("mote", makers.mote); if (c.got) { const k = c.t / 0.35; g.position.set(c.x + (R.px - c.x) * k, c.y + (R.py + 1 - c.y) * k, 0); g.scale.setScalar(1 - k * 0.7); continue; } g.scale.setScalar(1); g.position.set(c.x, c.y + Math.sin(t * 3 + c.x) * 0.1, 0); g.rotation.y = t * 3 + c.x; }
    for (const u2 of R.ups) {
      if (Math.abs(u2.x - cam.x) > 50) continue;
      if (u2.kind === "shard") { const g = get("shard", makers.shard); g.position.set(u2.x, u2.y + Math.sin(t * 3) * 0.25, 0); g.rotation.set(t, t * 1.4, 0); continue; }
      if (u2.kind === "letter") { const g = get("letter_" + u2.ch, letterMaker(u2.ch)); g.position.set(u2.x, u2.y + Math.sin(t * 3) * 0.2, 0); g.rotation.y = Math.sin(t * 2) * 0.4; continue; }
      const g = get("up", makers.up), col = new T.Color(`rgb(${RUNNER_POWERS[u2.kind].rgb})`); g.position.set(u2.x, u2.y + Math.sin(t * 3) * 0.2, 0); g.userData.ring.rotation.set(Math.sin(t) * 0.4, t * 2, 0); g.userData.core.material.color.copy(col); g.userData.ring.material.color.copy(col); g.userData.gl.material.color.copy(col);
    }
    for (const z of R.haz) {
      if (z.kind === "wire") { if (Math.abs((z.x0 + z.x1) / 2 - cam.x) > 60) continue; const g = get("wire", makers.wire), L3 = z.x1 - z.x0; g.position.set((z.x0 + z.x1) / 2, z.y, 0.6); g.userData.w.scale.set(1, L3, 1); g.userData["p-1"].position.x = -L3 / 2; g.userData.p1.position.x = L3 / 2; g.userData.sp.forEach((s2, q) => { s2.position.set((seeded(Math.floor(t * 14) + q)() - 0.5) * L3, 0, 0.1); s2.material.opacity = Math.random() < 0.6 ? 0.9 : 0.2; }); }
      else { if (Math.abs(z.x - cam.x) > 50) continue; const g = get("drone", makers.drone); g.position.set(z.x, (z.y ?? z.y0) + 0.9, 0); g.rotation.z = Math.sin(t * 2 + z.ph) * 0.15; g.userData.pr.forEach((p2, q) => (p2.rotation.y = t * 40 + q)); }
    }
    for (const p2 of R.pops || []) { if (p2.t > 0.5) continue; for (let q = 0; q < 6; q++) { const g = get("spark", makers.spark), a = q / 6 * Math.PI * 2, d = p2.t * 5; g.position.set(R.px + Math.cos(a) * d, R.py + 1.2 + Math.sin(a) * d, 0.5); g.material.opacity = 1 - p2.t * 2; } }
    poolsEnd();
    // Flying cars, birds, fireworks.
    flyers.forEach(f => { f.z = -14 - (f.y % 3) * 6; f.x2 = (f.x2 ?? cam.x + f.x * 3) + f.v * dt; if (f.x2 < cam.x - 80) f.x2 += 160; if (f.x2 > cam.x + 80) f.x2 -= 160; f.g.position.set(f.x2, f.y + 20 + Math.sin(t + f.x) * 0.5, f.z); f.g.rotation.y = f.v > 0 ? -Math.PI / 2 : Math.PI / 2; });
    birds.forEach((b2, q) => { const fx = cam.x + 40 - ((t * 6 + b2.off[2]) % 100); b2.g.visible = day > 0.4; b2.g.position.set(fx + b2.off[0], cam.y + 18 + b2.off[1], -20); b2.g.rotation.y = Math.PI / 2; const fl = Math.sin(t * 12 + q) * 0.6; b2.g.userData[-1].rotation.y = fl; b2.g.userData[1].rotation.y = -fl; });
    let fi = 0; const fwOn = R.fireworks.length > 0 || fw.userData.on; fw.userData.on = R.fireworks.length > 0; fw.visible = fwOn;
    if (fwOn) for (const f of R.fireworks) { const r = seeded(Math.floor(f.seed * 1e6)); for (let b2 = 0; b2 < 3; b2++) { const bx = cam.x + (r() - 0.3) * 50, by = cam.y + 15 + r() * 15, bz = -40 - r() * 30, col = new T.Color().setHSL(r(), 0.9, 0.6), tt = Math.max(0, f.t - b2 * 0.35); for (let q = 0; q < 120 && fi < fwN; q++, fi++) { const a = r() * Math.PI * 2, e = (r() - 0.5) * Math.PI, sp = 10 + r() * 6, d = sp * Math.min(tt, 1.6) * (1 - tt * 0.15); fwPos.set([bx + Math.cos(a) * Math.cos(e) * d, by + Math.sin(e) * d - tt * tt * 2, bz + Math.sin(a) * Math.cos(e) * d], fi * 3); const k = tt > 0 ? Math.max(0, 1 - tt / 2.4) : 0; fwCol.set([col.r * k, col.g * k, col.b * k], fi * 3); } } }
    if (fwOn) { for (; fi < fwN; fi++) fwCol.set([0, 0, 0], fi * 3); fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true; }
    try { renderer.render(scene, camera); } catch (e) { console.warn("swing render failed", e); onFail = true; view.remove(); return null; }
    const scr = (x, y) => { v3.set(x, y, 0).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
    R.scrAim = aim ? scr(aim.x, aim.y) : null; R.scrDark = scr(R.darkX, cam.y)[0];
    return (x, at) => scr(R.px, R.py + 2.6);
  }
  function hide() { if (view.parentNode) view.remove(); }
  function destroy() { hide(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
  return { draw, hide, destroy, get pxU() { return 1; }, scene, renderer, lite };
}

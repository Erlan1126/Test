// Lumen Rush: the city has blacked out. You are a being of light, swinging across the skyline on a
// tether of light: hold anywhere to latch onto the nearest glowing anchor ahead (masts, lanterns,
// hover-lamps, balloons, neon hoops), let go to fling yourself. Every building you pass lights back
// up behind you, while a wave of darkness follows from behind. Land on rooftops and run; keep off
// the street, building walls, live wires and drones. Let go at the right moment for a Perfect.
// It plugs into the run's shell in run.js (the `run` object, hearts, missions, continue, pause,
// the end card); swing2d.js draws it.
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
const SWING = { G: 28, REACH: 24, MAXV: 36, CRUISE: 30, PULL: 6, LMIN: 5.5, ROPE: 13, YANK: 30 };

function runnerStart(R) {
  Object.assign(R, {
    mode3: true, px: -6, py: 30, vx: 13, vy: 0, hold: false, teth: null, L: 0, anchors: [], blds: [], motes: [], haz: [], ups: [],
    genX: -60, lastA: null, darkX: -50, lit: 0, perfects: 0, roof: null, spin: 0, spinV: 0, fizzle: 0, fireworks: [], nextMile: 500,
    ev: null, nextEv: 380, rec: [], letterOut: false, phase: 0, kick: 0, slowT: 0, nearT: 0, v: 13, nextEvent: 1e9,
    flow: 0, od: 0, dashes: 1, tethT: 0, perfT: 0, dashT: 0, bursts: [], restored: 0, boosts: [], winds: [], updrafts: [], ringT: 0,
  });
  if (runnerPerk("Tide")) R.hearts++;
  const gh = save.ghost; R.ghost = R.daily && gh && gh.day === dayNumber() ? gh.rec : null;
  // The run starts mid-swing from a first anchor overhead.
  if (R.stageInfo) {
    R.outage = !R.stageInfo.daily && Math.floor((R.stageInfo.n - 1) / 10) === outageDistrict();
    Object.assign(R, { stageLen: R.stageInfo.len, darkX: -75, motesTotal: 0, motesGot: 0, trace: [], traceT: 0, stageT: 0, hitsTaken: 0, nextEv: 1e9 });
    const nw = !R.attract && STAGE_NEW[R.stageInfo.n];
    R.banner = 2.6;
    if (nw && !R.tut) runMsg(nw[0], nw[1], 3, true);
    if (R.outage && !R.attract && !R.tut) runMsg("⚡ Outage week", "Some lights flicker out · every light counts double", 2.6, true);
    if (R.stageInfo.boss) { R.ev = { kind: "heart", t: 1e9, hits: 0 }; R.hearted = { all: true }; for (const f of [0.3, 0.6, 0.85]) R.ups.push({ x: R.stageInfo.len * f, y: 26 + runR() * 6, kind: "shard" }); }
  }
  const a0 = { x: 2, y: 40, kind: "lamp", id: 0 }; R.anchors.push(a0); R.lastA = a0;
  swingGen(R, 220);
  R.teth = a0; R.L = Math.hypot(R.px - a0.x, R.py - a0.y); R.hold = true;
  if (R.tut) R.tut = 1;
  if (!R.stageInfo && !R.attract && !R.tut) { const nb = ((save.run || {}).night || {}); runMsg("Night shift", `Light as many windows as you can${nb.week === weekNumber() && nb.best ? ` · this week's best: ${nb.best}` : ""}`, 2.6, true); }
}

// ---------- Sections: what each stretch of a stage is like ----------
// Every 110 m a new section: flow (the classic), a climb, a low fast dive, a zigzag, a big gap (with a
// boost ring; a good release or the air dash), a run of springs, or a course of boost rings. Fixed per
// stage (from its seed); the first stretch is always calm.
const SECTIONS = ["flow", "climb", "dive", "zigzag", "gap", "springs", "rings"];
function swingSection(R, x) {
  if (!R.stageLen) return x > 200 ? SECTIONS[Math.floor(x / 110) % SECTIONS.length] : "flow";
  const i = Math.floor(x / 110); if (i < 1 || x > R.stageLen - 30) return "flow";
  const r = seeded(R.stageInfo.seed * 31 + i * 977)(), early = R.stageInfo.n < 4 && !R.stageInfo.daily;
  const pool = early ? ["flow", "climb", "rings", "dive"] : SECTIONS;
  return pool[Math.floor(r * pool.length)];
}
// ---------- Making the skyline ahead ----------
function swingGen(R, toX) {
  const r = runR;
  while (R.genX < toX) {
    const m = Math.max(0, R.genX), th = runnerTheme(m), hard = R.stageInfo ? R.stageInfo.hard : Math.min(1, m / 3000);
    // Anchors: a chain ahead, always reachable from the one before.
    while (R.lastA.x < R.genX + 70 && !(R.stageLen && R.lastA.x > R.stageLen + 40)) {
      // Stages are built from short sections, each with its own shape (see swingSection).
      const p = R.lastA, sec = swingSection(R, p.x + 10), gapK = sec === "gap" && (R.anchors.length % 2) ? 6 : 0;
      const ax = p.x + 9 + r() * 5 + hard * (R.stageLen ? 5 : 3) + gapK, ath = runnerTheme(ax);
      let ay = Math.max(28, Math.min(45, p.y + (r() - 0.5) * 8));
      if (sec === "climb") ay = Math.min(46, p.y + 2.5 + r() * 1.5); else if (sec === "dive") ay = 28 + r() * 2.5; else if (sec === "zigzag") ay = p.y > 37 ? 30 + r() * 1.5 : 43 + r() * 1.5;
      const a = { x: ax, y: ay, kind: ath.anchor, id: R.anchors.length, ph: r() * 6, sec };
      // Special anchors: gold (bonus), crumbling (let go quickly), drifting (moves), spring (launches you).
      const roll = r();
      const wk = R.stageLen ? "" : weekEvent().id, goldK = wk === "frost" ? 3 : 1;   // stages keep the same course every week (ghosts must match); weekly anchor events are for the Night shift
      const dK = R.stageLen ? hard : null;
      a.type = ax < 60 ? "" : roll < 0.07 * goldK ? "gold" : roll < 0.07 + ((dK != null ? dK > 0.1 : ax > 300) ? 0.08 + (dK || 0) * 0.1 : 0) ? "crumble" : roll < 0.18 + ((dK != null ? dK > 0.16 : ax > 500) ? 0.08 + (dK || 0) * 0.1 : 0) ? "drift" : roll < 0.27 + (wk === "spring" ? 0.25 : 0) ? "spring" : "";
      if (sec === "springs" && ax > 60) a.type = "spring"; else if ((sec === "zigzag" || sec === "climb") && a.type === "crumble") a.type = "";
      if (a.type === "drift") a.bx = ax;
      if (ath.anchor === "lantern" && !a.type) { a.sway = true; a.bx = ax; a.by = a.y; }
      if (R.outage && !a.type && ax > 40 && a.id % 3 === 0) a.flicker = true;   // (no random draw: the course stays the same)
      R.anchors.push(a); R.lastA = a;
      // A boost ring where you'd fly after letting go: through it for speed, lights and Flow.
      if (ax > 50 && (r() < (R.stageLen ? 0.22 : 0.16) || sec === "rings" || gapK) && !(R.stageLen && ax > R.stageLen)) R.boosts.push({ x: p.x + (a.x - p.x) * 0.62 + 2, y: (p.y + a.y) / 2 - 3, r: 1.7 });
      // Wind stages: gusts that push you sideways.
      if (R.stageInfo && R.stageInfo.wind && ax > 60 && ax < R.stageLen && r() < 0.3) { const dir = r() < 0.5 ? -1 : 1; R.winds.push({ x0: p.x, x1: ax, f: dir * (5 + R.stageInfo.hard * 6) }); }
      // Lights along the arc you'd swing between them.
      if (r() < (R.stageLen ? 0.9 : 0.8) && ax > 10 && !(R.stageLen && ax > R.stageLen)) { const n = 5; for (let q = 1; q <= n; q++) { const t = q / (n + 1); R.motes.push({ x: p.x + (a.x - p.x) * t, y: p.y + (a.y - p.y) * t - 10.5 * Math.sin(Math.PI * t) - 1, line: a.id }); if (R.stageLen) R.motesTotal++; } }
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
      if ((R.stageLen ? hard > 0.1 && ax > 70 : ax > 260) && r() < 0.06 + hard * 0.12) R.haz.push({ kind: "drone", x: (p.x + a.x) / 2 + (r() - 0.5) * 3, y0: (p.y + a.y) / 2 - 6 - r() * 6, amp: 2.5 + r() * 3, ph: r() * 6 });
    }
    // One building (or a tree in the park), never so tall that it blocks the anchors.
    const gap = (th.water ? 6 : 3) + r() * (th.water ? 10 : 7) + (r() < 0.12 ? 8 : 0), w = 9 + r() * 10, x0 = R.genX + gap, x1 = x0 + w;
    let maxH = 60; for (const a of R.anchors) if (a.x > x0 - 5 && a.x < x1 + 5) maxH = Math.min(maxH, a.y - 14);
    if (x0 < 45) maxH = Math.min(maxH, 15);   // the opening swing always has room
    const tall = (th.low ? 9 : 14) + r() * (th.low ? 12 : 26) + hard * 8;
    const tree = th.park && r() < 0.5, pad = th.neon > 0.8 && r() < 0.35;
    const b = { x0, x1: tree ? x0 + 8 + r() * 4 : x1, h: Math.max(7, Math.min(maxH, tree ? 12 + r() * 8 : tall)), style: th.fac[Math.floor(r() * th.fac.length)], litT: -1, n: R.blds.length, tree, seed: r() };
    // Leave the plot past the finish free for the home of the person who's waiting.
    if (R.stageLen && b.x1 > R.stageLen + 1 && b.x0 < R.stageLen + 17) { R.genX = Math.max(R.genX + 1, R.stageLen + 18); continue; }
    if (tree) { b.x1 = Math.min(b.x1, x1); const ta = { x: (b.x0 + b.x1) / 2, y: b.h + 4, kind: "tree", id: R.anchors.length + 9000, ph: r() * 6, type: "", tree: true }; R.anchors.push(ta); }
    if (pad && !tree) b.pad = true;
    // What the district builds (decided without a random draw, so courses stay the same).
    { const dk = R.stageInfo && !R.stageInfo.daily ? Math.min(5, Math.floor((R.stageInfo.n - 1) / 10)) : Math.max(0, RUNNER_THEMES.indexOf(th)), mix = (b.n * 7) % 10; b.kind = ["office", "shop", "warehouse", "neon", "shop", "glass"][dk]; if (mix < 2 && dk !== 5) b.kind = "office"; b.dist = dk; }
    if (R.stageInfo && R.stageInfo.tower && b.x0 > 40 && b.x0 < R.stageLen && r() < 0.35) R.updrafts.push({ x0: b.x1 + 0.5, x1: b.x1 + 6, f: 34 });
    // A live wire between two rooftops of a similar height.
    const prev = R.blds[R.blds.length - 1];
    if (prev && (R.stageLen ? hard > 0.04 && x0 > 50 && x0 < R.stageLen : x0 > 250) && r() < 0.14 + hard * 0.22 && !tree && !prev.tree && Math.abs(prev.h - b.h) < 5 && gap < 9) R.haz.push({ kind: "wire", x0: prev.x1 - 0.4, x1: x0 + 0.4, y: Math.min(prev.h, b.h) + 2.4 });
    R.blds.push(b); R.genX = b.x1;
  }
}
const swingBldAt = (R, x) => R.blds.find(b => x >= b.x0 && x <= b.x1);

// ---------- Holding and letting go ----------
// ---------- Aiming: one target at a time, shown on screen, and holding grabs exactly that ----------
// The target is always the nearest anchor ahead of you (not the one you just let go of).
// It can be grabbed when it is above you and within reach; otherwise it shows dim.
function swingReach(R) { return SWING.REACH * (runnerPerk("Ember") ? 1.25 : 1) * (R.stageInfo ? 1 - R.stageInfo.hard * 0.15 : 1); }
function swingAim(R) {
  // The nearest anchor ahead that you can reach; if none can be reached, the nearest one ahead (shown dim).
  const reach = swingReach(R); let best = null, near = null;
  for (const a of R.anchors) {
    if (a.broken || a.off || a === R.teth || a === R.lastLet || a.x < R.px - 1) continue;
    if (!near || a.x < near.x) near = a;
    const d = Math.hypot(a.x - R.px, a.y - R.py);
    if (d <= reach && d >= 1.5 && a.y > R.py + 1 && (!best || a.x < best.x)) best = a;
  }
  R.aim = best || near; R.aimOk = !!best;
  R.aimWhy = best || !near ? "" : near.y <= R.py + 1 ? "below" : "far";
  return best;
}
function swingFindAnchor(R) { swingAim(R); return R.aimOk ? R.aim : null; }
// ---------- Feel: sparks, shockwaves and a split-second freeze on the moments that matter ----------
function swingFx(R, kind, x, y) {
  if (R.attract) return; const P = R.parts || (R.parts = []), add = (n, sp, col, life, size, extra) => { for (let q = 0; q < n; q++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8); P.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * (0.7 + Math.random() * 0.6), c: col, size }, extra || {})); } };
  if (kind === "grab") { add(10, 9, [190, 240, 255], 0.35, 0.35); P.push({ x, y, ring: true, t: 0, life: 0.3, c: [190, 240, 255], size: 2.2 }); R.hitstop = Math.max(R.hitstop || 0, 0.035); }
  else if (kind === "perfect") { add(22, 15, [255, 214, 90], 0.6, 0.45); P.push({ x, y, ring: true, t: 0, life: 0.45, c: [255, 214, 90], size: 5 }); R.hitstop = Math.max(R.hitstop || 0, 0.06); }
  else if (kind === "light") add(4, 5, [255, 220, 140], 0.45, 0.25, { home: true });
  else if (kind === "land") add(8, 6, [220, 225, 235], 0.4, 0.3, { grav: true });
  if (P.length > 180) P.splice(0, P.length - 180);
}
function swingAttach(R) {
  const a = swingFindAnchor(R);
  if (!a) return false;
  R.teth = a; R.L = Math.max(4, Math.hypot(R.px - a.x, R.py - a.y)); R.roof = null; R.spinV = 0; R.tethT = 0; R.dashes = 1; R.grabBuf = 0; R.lastLet = null;
  R.bursts.push({ x: a.x, y: a.y, t: 0, c: a.type === "gold" ? 0xffd25a : null }); swingFx(R, "grab", a.x, a.y);
  if (a.type === "gold" && !a.paid) { a.paid = true; R.lights += 5; swingFlow(R, 0.15); if (!R.attract) { runBonus("Gold! +5 ✦", 0, R.dist + 2, R.x); sfx.unlock(); } }
  if (!R.attract) { sfx.jump(); buzz(8); }
  if (R.tut === 2) runnerTutStep();
  return true;
}
function swingHold(down) {
  const R = run;
  if (!R || !R.mode3) return;
  if (!down && (R.over || R.paused)) { R.hold = false; R.grabBuf = 0; R.kHold = false; return; }
  if (R.over || R.paused) return;
  // Press: grab the target now; if it's not quite in reach, keep trying for a moment, then fizzle.
  if (down) {
    R.hold = true;
    if (!R.teth && !swingAttach(R)) {
      // On a rooftop with nothing in reach: jump. Keep holding and you grab the ringed light as soon as it's in reach.
      if (R.roof) { R.roof = null; R.py += 0.1; R.vy = 16; R.vx = Math.max(R.vx, 12); R.dust = { x: R.px, y: R.py, t: 0, k: 0.8 }; R.jumpT = 0.3; if (!R.attract) { sfx.jump(); buzz(6); } }
      // In the air with nothing in reach: an air dash, forward and up (one per grab). Keep holding to grab.
      else if (R.dashes > 0) { R.dashes--; R.dashT = 0.35; R.vy = Math.max(R.vy, 13); R.vx = Math.min(SWING.MAXV, Math.max(R.vx, 10) + 3); R.spinV = 0; R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: null }); if (!R.attract) { sfx.whoosh(18); buzz(6); if (!R.dashTip && !R.tut) { R.dashTip = true; runMsg("Air dash!", "Tap in the air when nothing's in reach", 1.6); } } }
      else R.grabBuf = 0.25;
    }
    return;
  }
  R.hold = false; R.grabBuf = 0;
  if (!R.teth) return;
  const was = R.teth; R.teth = null; R.lastLet = was; R.snap = { x: was.x, y: was.y, t: 0 };
  // A spring anchor launches you on release.
  if (was.type === "spring") { R.vy = Math.max(R.vy, 0) + 10.5; R.vx += 3; if (!R.attract) { runBonus("Boing!", 0, R.dist + 2, R.x); sfx.jump(); } }
  // A Perfect: let go moving forward and up, fast.
  const ang = Math.atan2(R.vy, R.vx) * 180 / Math.PI, spd = Math.hypot(R.vx, R.vy);
  const [pwLo, pwHi, pwV] = perfectWindow(R);
  if (R.vx > 2.5 && ang > pwLo && ang < pwHi && spd > pwV) {
    // The boost tapers off at high speed, so a Perfect chain feels fast without getting out of hand.
    const k0 = runnerPerk("Volt") ? 1.2 : 1.1, k = 1 + (k0 - 1) * Math.max(0, Math.min(1, (SWING.CRUISE - spd) / 8)); R.vx *= k; R.vy *= k; R.perfects++; R.spinV = 9; R.flipT = 0.5;
    swingFx(R, "perfect", R.px, R.py + 1); R.perfT = 0.45; const big = !R.pChain || (R.pChain + 1) % 5 === 0; if (big) R.slowT = Math.max(R.slowT, 0.18); swingFlow(R, 0.17); R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: 0xffffff, big: true });
    if (!R.attract) buzz(15);
    R.combo++; R.comboT = 2; R.comboBest = Math.max(R.comboBest, R.combo);
    R.pChain = (R.pChain || 0) + 1; if (!R.attract) { progressEvent("perfect"); progressEvent("pchain", R.pChain); }
    if (!R.attract) { runBonus(R.pChain > 1 ? `Perfect ×${R.pChain}! +${1 + R.pChain} ✦` : "Perfect! +2 ✦", 0, R.dist + 2, R.x); R.lights += 1 + R.pChain; sfx.perfect(R.pChain); runMission("trail", R.perfects); }
  } else if (R.vx > 1.5 && ang > pwLo - 12 && ang < pwHi + 12 && spd > pwV - 3) {
    R.vx *= 1.04; R.vy *= 1.04; R.spinV = 6; R.pChain = 0; R.lights += 1; swingFlow(R, 0.06);
    if (!R.attract) { runBonus("Good +1 ✦", 0, R.dist + 2, R.x); sfx.clear(); }
  } else { R.spinV = 4; R.pChain = 0; }
  if (!R.attract) sfx.whoosh(Math.hypot(R.vx, R.vy));
  if (R.tut === 1 || R.tut === 3) runnerTutStep();
}
function runnerTutStep() {
  const R = run;
  R.tut++; R.slow = 1; R.tutText = "";
  if (R.tut > 3) { R.tut = 0; const s = runSave(); s.tutDone = true; persist(); runMsg("You've got it!", "The ringed light is always the one you'll grab", 2.6, true); }
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

function swingHit(R, why) {
  if (R.inv > 0 || R.attract || R.cleared || R.over) { if (R.attract) R.inv = 1; return; }
  R.combo = 0; R.shake = 0.7; R.flow = Math.max(0, R.flow - 0.5); R.hitsTaken = (R.hitsTaken || 0) + 1;
  if (R.power && R.power.kind === "shield") { R.power = null; R.inv = 1; R.flash = -0.6; runMsg("Shield!", "", 1.2); sfx.gate(); return; }
  if (why) runMsg(why, "", 1.4);
  runHit();
}

// ---------- Each frame ----------
function runnerUpdate(dt) {
  const R = run;
  R.t += dt;
  if (R.shatter) for (const q of R.shatter) { q.vy -= 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; }
  if (R.over) { R.over += dt; R.crashT = (R.crashT || 0) + dt; if (R.crashT > 0.6) R.slow = 1; R.vy -= SWING.G * dt; R.py = Math.max(0.3, R.py + R.vy * dt); R.px += R.vx * dt; R.vx *= 0.97; return; }
  R.inv = Math.max(0, R.inv - dt); R.flash = Math.max(0, R.flash - dt * 2); R.banner = Math.max(0, R.banner - dt);
  R.shake = Math.max(0, (R.shake || 0) - dt * 2.5); R.happy = Math.max(0, (R.happy || 0) - dt); R.fizzle = Math.max(0, R.fizzle - dt); R.kick = Math.max(0, R.kick - dt * 2);
  if (R.comboT > 0) R.comboT -= dt; else R.combo = 0;
  if (R.msgs.length) { R.msgs[0].t -= dt; if (R.msgs[0].t <= 0) R.msgs.shift(); }
  for (const p of R.pops || []) p.t += dt; R.pops = (R.pops || []).filter(p => p.t < 1.2);
  if (R.power) { R.power.t -= dt; if (R.power.t <= 0) R.power = null; }
  if (!R.attract) { const k = !!(keys && (keys[" "] || keys.arrowup)); if (k !== !!R.kHold) { R.kHold = k; swingHold(k); } const kd = !!(keys && keys.arrowright); if (kd && !R.kDash) swingDash(); R.kDash = kd; }
  swingAim(R);
  // Holding grabs the highlighted anchor the moment it comes into reach. A press that finds it
  // still out of reach a moment later shows why ("Too far" / "Below you").
  // Holding on a rooftop with nothing in reach: hop off after a beat, so holding always does something.
  if (R.roof && R.hold && !R.teth && !R.aimOk) { R.roofHoldT = (R.roofHoldT || 0) + dt; if (R.roofHoldT > 0.18) { R.roofHoldT = 0; R.hold = false; swingHold(true); } } else R.roofHoldT = 0;
  if (R.hold && !R.teth) { if (swingAttach(R)) R.grabBuf = 0; else if (R.grabBuf > 0 && (R.grabBuf -= dt) <= 0) { R.grabBuf = 0; R.fizzle = 0.35; } }
  // Anchors that move, and anchors that crumble under you.
  for (const a of R.anchors) { if (a.flicker) a.off = a !== R.teth && Math.sin(R.t * 2.1 + a.ph * 3) < -0.35; if (a.type === "drift") a.x = a.bx + Math.sin(R.t * 0.9 + a.ph) * 3.2; else if (a.sway && a !== R.teth) { const w = Math.sin(R.t * 1.3 + a.ph) * 0.35; a.x = a.bx + Math.sin(w) * 4; a.y = a.by + (1 - Math.cos(w)) * 4; } }
  if (R.teth) { R.tethT += dt; if (R.teth.type === "crumble" && R.tethT > 1.9) { const a = R.teth; a.broken = true; R.teth = null; R.hold = false; R.bursts.push({ x: a.x, y: a.y, t: 0, c: 0xff6a3d, big: true }); if (!R.attract) { runMsg("It crumbled!", "Let go of orange anchors quickly", 1.4); sfx.bump(); } } }
  // Flow fades slowly; Overdrive runs down.
  if (R.od > 0) { R.od -= dt; R.darkX = Math.min(R.darkX, R.px - 35); if (R.od <= 0) { R.od = 0; R.flow = 0; } } else R.flow = Math.max(0, R.flow - dt * 0.045);
  R.perfT = Math.max(0, R.perfT - dt); R.dashT = Math.max(0, R.dashT - dt); if (R.teth) R.streetT = 0; R.streetT = Math.max(0, (R.streetT || 0) - dt);
  if (R.snap) { R.snap.t += dt; if (R.snap.t > 0.2) R.snap = null; }
  if (R.dust) { R.dust.t += dt; if (R.dust.t > 0.5) R.dust = null; }
  if (R.splash) { R.splash.t += dt; if (R.splash.t > 0.9) R.splash = null; }
  if (R.wantShotAt && R.t >= R.wantShotAt) { R.wantShotAt = 0; R.wantShot = true; }
  if (R.cleared && !R.chimed && R.clearAt != null && R.t - R.clearAt > 0.65) { R.chimed = true; if (!R.attract) { sfx.home(); buzz([10, 30, 10]); } }
  // Danger: falling toward the street with nothing to grab (it costs a heart from stage 5).
  { const streetHurts = R.stageInfo && (R.stageInfo.daily || R.stageInfo.n >= 5) && !runnerTheme(R.px).water; const tHit = R.vy < 0 ? R.py / -R.vy : 9; R.danger = !R.teth && !R.roof && !R.aimOk && streetHurts && tHit < 0.9 && !swingBldAt(R, R.px + R.vx * tHit) ? Math.min(1, (R.danger || 0) + dt * 5) : Math.max(0, (R.danger || 0) - dt * 4); }
  for (const b of R.bursts) b.t += dt; R.bursts = R.bursts.filter(b => b.t < 0.8);
  const comet = R.power && R.power.kind === "comet";
  // Physics in small steps: gravity, the tether (a pendulum), rooftops, walls and the street.
  const N = 3, h = dt / N;
  for (let s = 0; s < N; s++) {
    const ox = R.px, oy = R.py;
    if (comet) { R.teth = null; R.vx += (32 - R.vx) * Math.min(1, h * 3); R.vy = (34 - R.py) * 2; R.px += R.vx * h; R.py += R.vy * h; continue; }
    R.vy -= SWING.G * h;
    if (R.teth) {
      const a = R.teth, dx = R.px - a.x, dy = R.py - a.y, d = Math.hypot(dx, dy) || 1;
      // Holding pulls you in. A shorter rope spins faster (angular momentum is kept), so reeling in
      // at the bottom of a swing is how you gain speed. No other forces: just gravity and the rope.
      // A long rope pulls taut quickly to its working length (you see it reel you in).
      if (R.L > SWING.ROPE) R.L = Math.max(SWING.ROPE, R.L - SWING.YANK * h);
      else if (R.hold && R.tethT > 0.12 && R.L > SWING.LMIN) {
        const L2 = Math.max(SWING.LMIN, R.L - SWING.PULL * h), k = R.L / L2;
        if (d > L2) { const rv = R.vx * dx / d + R.vy * dy / d; R.vx = (R.vx - rv * dx / d) * k + rv * dx / d; R.vy = (R.vy - rv * dy / d) * k + rv * dy / d; }
        R.reelAcc = (R.reelAcc || 0) + (R.L - L2); R.L = L2;
        if (R.reelAcc > 1.4) { R.reelAcc = 0; if (!R.attract) { sfx.reel(Math.max(0, Math.min(1, 1 - (R.L - SWING.LMIN) / 14))); buzz(3); } }
      }
    } else R.vx *= 1 - 0.03 * h;
    for (const w of R.winds) if (R.px > w.x0 && R.px < w.x1) { R.vx += w.f * h; break; }
    for (const u of R.updrafts) if (R.px > u.x0 && R.px < u.x1 && R.py < 55) { R.vy += u.f * h; break; }
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
        if (!R.roof && R.vy < -6) R.dust = { x: R.px, y: b.h, t: 0, k: Math.min(1, -R.vy / 20) };
        if (!R.roof && !R.attract && !R.roofTip && !R.tut) { R.roofTip = true; runMsg("Tap to jump", "Then hold to grab the ringed light", 1.6); }
        if (!R.roof && R.vy < -14) { R.kick = 0.4; if (!R.attract) sfx.land(); }
        if (!R.roof && R.vy < -8) swingFx(R, "land", R.px, b.h + 0.2);
        R.py = b.h; if (R.vy < 0) R.vy = 0; R.roof = b; R.teth = null; R.spinV = 0; R.dashes = 1;
        if (b.pad) { R.roof = null; R.vy = 24; R.vx = Math.max(R.vx, 14); R.padT = 0.5; b.padHit = R.t; R.bursts.push({ x: R.px, y: b.h, t: 0, c: 0xff5ad2, big: true }); if (!R.attract) { sfx.jump(); buzz(12); if (!R.padMsg) { R.padMsg = true; runBonus("Boing! Neon pad", 0, R.dist + 2, R.x); } } }
      } else if (ox < b.x0) {
        // Wall run: up the wall and over the top.
        R.px = b.x0 - 0.35; R.vx = Math.max(3, R.vx * 0.3); R.vy = Math.max(R.vy, 15); R.teth = null; R.shake = 0.25; R.wallT = 0.4;
        if (!R.attract && !R.wallMsg) { R.wallMsg = true; runMsg("Wall run!", "", 0.9); }
      }
      else { R.py = b.h; R.vy = Math.max(R.vy, 0); R.roof = b; }
    }
    if (R.roof) { R.py = R.roof.h; R.vx = Math.max(R.vx * (1 - 0.15 * h), 9); }
    // The street.
    if (R.py < 0.4 && runnerTheme(R.px).water && !R.attract) {
      // The harbour: you splash into the water instead of hitting the street. No heart lost, but it
      // drags your speed down and costs Flow; you bob back up.
      R.py = 0.4; R.vy = 17; R.vx = Math.max(6, R.vx * 0.55); R.teth = null; R.flow = Math.max(0, R.flow - 0.35); R.combo = 0; R.pChain = 0;
      R.splash = { x: R.px, t: 0 }; R.shake = 0.35; R.bursts.push({ x: R.px, y: 0.5, t: 0, c: 0x7fd8ff, big: true });
      if (!R.wetMsg) { R.wetMsg = true; runMsg("Splash!", "The water slows you down. Stay up high", 1.4); } sfx.land(); buzz(10);
    }
    else if (R.py < 0.4) {
      R.py = 0.4; R.vy = 21.5; R.vx = Math.max(R.vx, 10); R.teth = null; R.flow = Math.max(0, R.flow - 0.3);
      if (R.streetT > 0 || (R.stageInfo && (R.stageInfo.daily || R.stageInfo.n >= 5))) swingHit(R, "Keep off the street!"); else if (!R.attract) { runMsg("Bounce!", "Grab a light before you land again", 1.2); sfx.land(); }
      R.streetT = 4;
    }
  }
  // Arrived: glide in and land on their roof (the physics hands over to a short, gentle flight).
  if (R.cleared && R.stageLen && R.clearAt != null) {
    if (!R.glide) R.glide = { x: R.px, y: R.py };
    const k = Math.min(1, (R.t - R.clearAt) / 0.9), e = k * k * (3 - 2 * k), tx = R.stageLen + 6.5, ty = 17;
    R.teth = null; R.hold = false; R.px = R.glide.x + (tx - R.glide.x) * e; R.py = R.glide.y + (ty - R.glide.y) * e + Math.sin(e * Math.PI) * 4;
    R.vx = k < 1 ? 8 : 0; R.vy = 0; R.roof = k >= 1 ? (R.homeRoof || (R.homeRoof = { x0: R.stageLen + 3, x1: R.stageLen + 15, h: 17, home: true })) : null;
    if (k >= 1 && !R.landedHome) { R.landedHome = true; R.dust = { x: R.px, y: ty, t: 0, k: 0.6 }; }
  }
  R.spinV *= R.teth || R.roof ? 0.8 : 0.995; R.spin += R.spinV * dt; R.flipT = Math.max(0, (R.flipT || 0) - dt);
  R.phase += dt * Math.max(4, R.vx) * 0.8;
  R.v = Math.hypot(R.vx, R.vy); R.speed = R.v * RUN.M;
  // Stages: the clock, your path (for ghosts), and the finish gate.
  if (R.stageLen) {
    if (!R.cleared) { R.stageT += dt; R.traceT += dt; while (R.traceT >= 0.1) { R.traceT -= 0.1; R.trace.push([R.px, R.py]); } }
    if (!R.cleared && !R.over && R.px >= R.stageLen) stageClear(R);
    // The halfway lantern on long stages: fall after it and you can start again from here.
    if (!R.cp && !R.attract && !R.stageInfo.daily && R.stageLen >= 800 && R.px > R.stageLen * 0.5 && !R.over) { R.cp = { x: R.stageLen * 0.5, t: R.stageT }; R.bursts.push({ x: R.px, y: R.py + 1, t: 0, c: 0x8be9ff, big: true }); runMsg("Halfway!", "Fall now and you can start again from here", 1.6, true); sfx.clear(); }
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
  R.darkX += (R.stageLen ? (4 + R.stageInfo.hard * 6.5) * (R.stageInfo.boss && R.ev && R.ev.kind === "heart" ? 1.2 : 1) : Math.min(14, 4 + Math.max(0, m - 80) * 0.0035)) * (surge ? 1.6 : 1) * (weekEvent().id === "shadow" ? 1.2 : 1) * (R.tut ? 0 : 1) * dt;
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
      c.got = true; c.t = 0; swingFx(R, "light", c.x, c.y); if (R.stageLen) R.motesGot++; { const w = (weekEvent().id === "gold" ? 2 : 1) * (R.od > 0 ? 2 : 1) * (R.outage ? 2 : 1); R.lights += w; if (!R.attract) progressEvent("lights", w); } swingFlow(R, 0.022);
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
  // Boost rings.
  for (const b of R.boosts) if (!b.got && Math.hypot(b.x - R.px, b.y - R.py - 0.9) < b.r + 0.4) {
    b.got = true; b.t = 0; R.vx = Math.min(SWING.MAXV, R.vx + 6); R.vy += 2; R.lights += 3; swingFlow(R, 0.12); R.ringT = 0.35;
    R.combo++; R.comboT = 2; R.comboBest = Math.max(R.comboBest, R.combo);
    R.bursts.push({ x: b.x, y: b.y, t: 0, c: 0x7ff0ff, big: true });
    if (!R.attract) { runBonus("Ring! +3 ✦", 0, R.dist + 2, R.x); sfx.perfect(2); buzz(10); }
  }
  for (const b of R.boosts) if (b.got) b.t += dt;
  R.boosts = R.boosts.filter(b => b.x > R.px - 60 && (!b.got || b.t < 0.6)); R.winds = R.winds.filter(w => w.x1 > R.px - 60); R.ringT = Math.max(0, R.ringT - dt);
  // Hazards: live wires and drones.
  for (const z of R.haz) {
    if (z.kind === "wire") { if (R.px > z.x0 && R.px < z.x1 && R.py < z.y + 0.4 && R.py + 1.7 > z.y && !comet) { z.hit = true; swingHit(R, "Zap!"); } }
    else if (z.kind === "drone" && !z.dead) {
      z.y = z.y0 + Math.sin(R.t * 1.4 + z.ph) * z.amp; const d = Math.hypot(z.x - R.px, z.y - R.py - 0.9);
      // Warning: will you meet in the next 0.8 s? (where you'd be, flying straight; where it will be)
      if (Math.abs(z.x - R.px) < 25) { let w = false; for (let k = 1; k <= 8 && !w; k++) { const tt = k * 0.1, zy = z.y0 + Math.sin((R.t + tt) * 1.4 + z.ph) * z.amp;
        // Two guesses: flying free from here, and staying on the rope; either one meeting the drone warns.
        const fx = R.px + R.vx * tt, fy = R.py + 0.9 + R.vy * tt - SWING.G * tt * tt / 2; if (Math.hypot(z.x - fx, zy - fy) < 2.2) w = true;
        if (R.teth && !w) { const ax = R.teth.x, ay = R.teth.y, dx = R.px - ax, dy = R.py - ay, rr = Math.hypot(dx, dy) || 1, om = (dx * R.vy - dy * R.vx) / (rr * rr), th = Math.atan2(dy, dx) + om * tt; if (Math.hypot(z.x - (ax + Math.cos(th) * rr), zy - (ay + Math.sin(th) * rr + 0.9)) < 2.2) w = true; } } z.warn = w ? Math.min(1, (z.warn || 0) + dt * 8) : Math.max(0, (z.warn || 0) - dt * 4); }
      // A drone that hits you breaks apart: one hit per drone, never the same one twice.
      if (d < 1.2 && !comet) { if (!(R.inv > 0)) { z.dead = true; R.bursts.push({ x: z.x, y: z.y, t: 0, c: 0xff2b4a, big: true }); } swingHit(R, "Drone!"); }
      else if (d < 3.5 && !z.near && !R.attract) { z.near = true; progressEvent("near"); runBonus("Close call! +2 ✦", 2, R.dist + 2, R.x); sfx.close(); R.slowT = 0.3; }
    }
  }
  // The first run teaches by doing: let go, then hold.
  // Lesson 1: wait for the swing to come up, then let go (time slows right at that moment, and only then).
  if (R.tut === 1) { const a = R.teth; if (a && R.px > a.x + 1 && R.vy > 1) { R.slow = 0.35; R.tutText = "Let go now!"; } else { R.slow = 1; R.tutText = a ? "Wait for the swing up…" : ""; } }
  // Lesson 2: hold to grab the ringed light (slows while you fall, so there is time to read it).
  else if (R.tut === 2) { R.tutText = R.teth ? "" : "Hold to grab the ringed light"; R.slow = !R.teth && R.vy < 0 ? 0.45 : 1; }
  // Lesson 3: keep holding to reel in (the rope shortens, you speed up), then let go.
  else if (R.tut === 3) { R.slow = 1; R.tutText = R.teth ? (R.L > SWING.LMIN + 1 ? "Keep holding to reel in" : "Let go as you swing up!") : ""; }
  else { R.slow = R.slowT > 0 ? 0.55 : 1; }
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
  if (!R.attract) { const boss = R.stageInfo && R.stageInfo.boss || (R.ev && R.ev.kind === "heart"); music.intensity = boss ? 1 : Math.min(1, (R.v - 10) / 22); music.layers = (R.pChain || 0) >= 6 ? 4 : (R.pChain || 0) >= 3 || R.combo >= 12 || R.od > 0 || boss ? 3 : 2; }
  if (!R.attract) swingFlowHud(R);
  if (!R.attract && Math.floor(R.t * 4) !== Math.floor((R.t - dt) * 4)) runHud();
}

// The title screen swings by itself.
function runnerAuto() {
  const R = run;
  if (R.teth) {
    // Let go swinging forward and up (the Perfect window), or quickly off a crumbling anchor.
    const ang = Math.atan2(R.vy, R.vx) * 180 / Math.PI, [lo, hi] = perfectWindow(R);
    if ((R.px > R.teth.x && R.vx > 4 && ang > lo + 4 && ang < hi - 10) || (R.px > R.teth.x + 2 && R.vy > 0 && R.vy > R.vx * 1.4) || (R.teth.type === "crumble" && R.tethT > 1.6) || (R.tethT > 0.8 && Math.hypot(R.vx, R.vy) < 5)) swingHold(false);
  } else if (!R.hold && R.aimOk && (R.vy < 1 || R.roof || R.py < 16)) swingHold(true);
  else if (R.roof && !R.hold && R.px > R.roof.x1 - 5) swingHold(true);   // jump off the edge of a roof
}

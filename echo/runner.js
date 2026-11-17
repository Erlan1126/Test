// The runner: a 3D endless run through a living city. A young runner in a hoodie and sneakers
// races forward down a three-lane tram avenue: swipe left/right to change lanes, up to jump,
// down to slide; gather coins (lights), dodge trams, cars and roadworks. The avenue is lined
// with glass towers, shops, billboards, lamp posts, trees and people; traffic flies overhead;
// the sky turns from morning to night as the run goes on (the same districts as before).
// It reuses the run's shell from run.js: the `run` object, HUD, missions, hearts, continue,
// pause and the end card. Game logic is here (runnerStart/runnerUpdate/runnerSwipe); drawing is
// RUNNER3D, built on first use. If WebGL is missing the classic run is used instead.
"use strict";

const LANE_W = 2.5;
const RUNNER_POWERS = {
  magnet: { name: "Magnet", dur: 9, rgb: "255,90,110" },
  shield: { name: "Shield", dur: 14, rgb: "90,210,255" },
  jet: { name: "Jetboard", dur: 7, rgb: "255,200,80" },
};
const runnerM = () => run.dist / RUN.M;
// Characters (each with a small perk), hoodie colours, sneakers and jetboards, bought with lights.
const RUNNER_CHARS = [
  { name: "Kai", cost: 0, perk: "All-rounder", hair: "cap", look: { top: 0x2f6bff, pants: 0x1c1f26, skin: 0xc98d68, hat: 0x111318, hairC: 0x1b1410, shoe: 0xffffff, accent: 0xff7a1a } },
  { name: "Mika", cost: 600, perk: "The magnet reaches further and lasts longer", hair: "pony", look: { top: 0xff6b9a, pants: 0xf2efe9, skin: 0xf1c7a5, hat: 0, hairC: 0x2a1a12, shoe: 0x15171b, accent: 0x5fd8ff } },
  { name: "Zee", cost: 1200, perk: "Starts every run with an extra heart", hair: "beanie", look: { top: 0x2a9d8f, pants: 0x34363c, skin: 0x6b4430, hat: 0xe9c46a, hairC: 0x111111, shoe: 0xf2c230, accent: 0xffffff } },
  { name: "Ray", cost: 2000, perk: "The jetboard lasts 50% longer", hair: "band", look: { top: 0xf2f2ef, pants: 0x223355, skin: 0xd9a27c, hat: 0xd62839, hairC: 0x6b4a2b, shoe: 0xd62839, accent: 0xd62839 } },
  { name: "Nova", cost: 3500, perk: "Every 10th coin in a combo is worth +5", hair: "buns", look: { top: 0x6c63ff, pants: 0x15171b, skin: 0xa86f4c, hat: 0, hairC: 0xff8fd8, shoe: 0xffffff, accent: 0xffc23d } },
];
const RUNNER_TOPS = [{ name: "Signature", c: null, cost: 0 }, { name: "Sunset", c: 0xff7a1a, cost: 150 }, { name: "Mint", c: 0x5fd3a8, cost: 150 }, { name: "Lilac", c: 0xb39dff, cost: 200 }, { name: "Ink", c: 0x1b1f27, cost: 250 }, { name: "Cream", c: 0xf2e8d5, cost: 250 }, { name: "Cherry", c: 0xd62839, cost: 300 }, { name: "Gold", c: 0xffc23d, cost: 500 }];
const RUNNER_SHOES = [{ name: "Signature", c: null, cost: 0 }, { name: "Volt", c: 0xd4ff3d, cost: 150 }, { name: "Ice", c: 0x9fe8ff, cost: 150 }, { name: "Shadow", c: 0x15171b, cost: 200 }, { name: "Rose", c: 0xff8fb1, cost: 200 }, { name: "Chrome", c: 0xc9ced6, cost: 400 }];
const RUNNER_BOARDS = [{ name: "Classic", c: 0xffc850, cost: 0 }, { name: "Aqua", c: 0x3de0ff, cost: 200 }, { name: "Magenta", c: 0xff3d9e, cost: 300 }, { name: "Lime", c: 0x8dff3d, cost: 300 }, { name: "Prism", c: "prism", cost: 800 }];
function runnerLook() {
  if (!save.look || typeof save.look !== "object" || save.look.char == null) save.look = { char: 0, top: 0, shoe: 0, board: 0, own: { c0: 1, t0: 1, s0: 1, b0: 1 } };
  return save.look;
}
const runnerChar = () => RUNNER_CHARS[runnerLook().char] || RUNNER_CHARS[0];
const runnerPerk = name => !run || run.attract ? false : runnerChar().name === name;
// Districts: each has its own streets, not just its own sky.
const RUNNER_THEMES = [
  { name: "Downtown", fac: [0, 2, 3, 0], neon: 0.25, ad: 0.3 },
  { name: "Market Street", fac: [1, 5, 1, 4], neon: 0.3, ad: 0.1, lanterns: true, stalls: true },
  { name: "Waterfront", fac: [0, 2, 4], neon: 0.15, ad: 0.25, water: -1 },
  { name: "Neon Arcade", fac: [3, 3, 0, 2], neon: 0.8, ad: 0.6 },
  { name: "Park Avenue", fac: [5, 1, 4, 2], neon: 0.15, ad: 0.15, park: 1 },
];
const runnerTheme = m => RUNNER_THEMES[Math.floor(Math.max(0, m) / RUN.BIOME_M) % RUNNER_THEMES.length];
// The daily letter hunt: find L-U-M-E-N on the streets in one day.
const HUNT = "LUMEN";
function huntState() { const d = dayNumber(); if (!save.hunt || save.hunt.day !== d) save.hunt = { day: d, got: "" }; return save.hunt; }
const laneX = l => l * LANE_W;

function runnerStart(R) {
  Object.assign(R, {
    mode3: true, lane: 0, prevLane: 0, px: 0, py: 0, vy: 0, slide: 0, laneT: 9, swipeBuf: null,
    obs: [], coins: [], ups: [], nextRow: 34, laneBusy: [0, 0, 0], noWallUntil: 0, lineSeq: 0, lines: {},
    shieldHit: false, fireworks: [], cheerT: 0, nextMile: 500, stumbleT: 0, phase: 0, nextEvent: 1e9,
    gnd: 0, kick: 0, slowT: 0, flipT: 0, flipBonus: false, ev: null, nextEv: 420, rec: [], letterOut: false,
  });
  if (runnerPerk("Zee")) R.hearts++;
  // A daily run races the ghost of today's best daily run.
  const gh = save.ghost; R.ghost = R.daily && gh && gh.day === dayNumber() ? gh.rec : null;
}

// ---------- Making the avenue ahead ----------
// Obstacles: hurdle (jump), bar (slide), wall (change lane), tram (change lane; later they come at
// you), car (oncoming; jump it or change lane).
const OBS = {
  hurdle: { len: 0.4, y0: 0, y1: 1.0 },
  bar: { len: 0.5, y0: 1.15, y1: 3.2 },
  ramp: { len: 7, y0: 0, y1: 0 },
  bus: { len: 11, y0: 0, y1: 3.6 },
  drone: { len: 0.8, y0: 1.15, y1: 2.1 },
  wall: { len: 1.4, y0: 0, y1: 2.4 },
  tram: { len: 20, y0: 0, y1: 3.4 },
  car: { len: 4.2, y0: 0, y1: 1.45 },
};
function runnerAddObs(kind, lane, z, extra) {
  const o = Object.assign({ kind, lane, z, len: OBS[kind].len, y0: OBS[kind].y0, y1: OBS[kind].y1, v: 0, id: Math.random() }, extra || {});
  run.obs.push(o); return o;
}
function runnerCoinLine(lane, z, n, arc) {
  const id = ++run.lineSeq; run.lines[id] = { n, got: 0 };
  for (let q = 0; q < n; q++) run.coins.push({ lane, z: z + q * 2.2, y: arc ? 0.9 + Math.sin(q / (n - 1) * Math.PI) * 1.6 : 0.9, line: id });
}
function runnerSpawnRow() {
  const R = run, r = runR, z = R.nextRow, m = z, hard = Math.min(1, m / 3000);
  // The first run teaches: a wall in the middle, then a hurdle, then a bar.
  if (R.tut && m < 200) {
    if (m < 50) { runnerAddObs("wall", 0, 46, { tut: 1 }); runnerCoinLine(-1, 34, 6); runnerCoinLine(1, 34, 6); R.nextRow = 80; return; }
    if (m < 100) { for (const l of [-1, 0, 1]) runnerAddObs("hurdle", l, 92, { tut: 2 }); runnerCoinLine(0, 86, 6, true); R.nextRow = 128; return; }
    for (const l of [-1, 0, 1]) runnerAddObs("bar", l, 140, { tut: 3 }); runnerCoinLine(0, 146, 6); R.nextRow = 175; return;
  }
  const gap = Math.max(11, 24 - m * 0.005) * (R.hard ? 0.85 : 1);
  const open = [-1, 0, 1].filter(l => R.laneBusy[l + 1] < z - 2);
  const roll = r();
  if (R.ev && R.ev.kind === "rush") {
    // Coin rush: every open lane fills with coins.
    for (const l of open) runnerCoinLine(l, z, 8, r() < 0.3);
    R.nextRow = z + 19; return;
  }
  // Power-ups now and then.
  if (r() < 0.07 && open.length) { const l = open[Math.floor(r() * open.length)], kinds = Object.keys(RUNNER_POWERS); R.ups.push({ lane: l, z, kind: kinds[Math.floor(r() * kinds.length)] }); }
  if (roll < 0.22 && open.length >= 2 && m > 120) {
    // A tram in one lane; later ones come toward you.
    const l = open[Math.floor(r() * open.length)], len = 14 + Math.floor(r() * 3) * 7, moving = m > 400 && r() < 0.25 + hard * 0.35;
    const ramp = !moving && r() < 0.55;
    if (ramp) { runnerAddObs("ramp", l, z - 7, { len: 7 }); const id = ++R.lineSeq; R.lines[id] = { n: Math.floor((len - 2) / 2.2), got: 0 }; for (let q = 0; q < R.lines[id].n; q++) R.coins.push({ lane: l, z: z + 1 + q * 2.2, y: 4.35, line: id }); }
    runnerAddObs("tram", l, z, { len, v: moving ? 7 + hard * 7 : 0, ramp });
    R.laneBusy[l + 1] = z + len + (moving ? 40 : 0);
    if (moving) R.noWallUntil = z + len + 30;
    const other = open.filter(q => q !== l);
    runnerCoinLine(other[Math.floor(r() * other.length)], z, 8);
    if (r() < 0.5) runnerCoinLine(l, z + len + 4, 6);
    R.nextRow = z + gap + (moving ? 6 : 0); return;
  }
  if (!R.attract && !R.tut && !R.letterOut && m > 150 && open.length && r() < 0.06) {
    const h = huntState(); if (h.got.length < HUNT.length) { R.ups.push({ lane: open[Math.floor(r() * open.length)], z, kind: "letter", ch: HUNT[h.got.length] }); R.letterOut = true; }
  }
  if (roll < 0.29 && m > 350 && open.length >= 2) {
    // A bus: tall, no ramp; later ones roll toward you slowly.
    const l = open[Math.floor(r() * open.length)], moving = m > 700 && r() < 0.4;
    runnerAddObs("bus", l, z, { v: moving ? 3 + hard * 3 : 0, color: Math.floor(r() * 3) });
    R.laneBusy[l + 1] = z + 11 + (moving ? 25 : 0);
    runnerCoinLine(open.filter(q => q !== l)[0], z, 6);
    R.nextRow = z + gap + 4; return;
  }
  if (roll < 0.34 && m > 600) {
    // A drone sweeping across all three lanes at head height: slide under it.
    runnerAddObs("drone", 0, z, { ph: r() * 6, sweep: true });
    runnerCoinLine(open[Math.floor(r() * open.length)], z - 6, 5);
    R.nextRow = z + gap; return;
  }
  if (roll < 0.41 && m > 250 && open.length >= 2) {
    // An oncoming car.
    const l = open[Math.floor(r() * open.length)];
    runnerAddObs("car", l, z + 10, { v: 6 + hard * 6, color: Math.floor(r() * 5) });
    runnerCoinLine(open.filter(q => q !== l)[0], z, 7);
    R.nextRow = z + gap; return;
  }
  // A row of roadworks: one or two lanes blocked (never all), or a full-width hurdle or bar.
  const full = r() < 0.32;
  if (full) {
    const kind = r() < 0.5 ? "hurdle" : "bar";
    for (const l of open) runnerAddObs(kind, l, z);
    runnerCoinLine(open[Math.floor(r() * open.length)], z - 5, 5, kind === "hurdle");
  } else {
    const walls = z < R.noWallUntil ? [] : open.filter(() => r() < 0.45 + hard * 0.2).slice(0, Math.max(0, open.length - 1));
    for (const l of walls) runnerAddObs(r() < 0.55 ? "wall" : r() < 0.5 ? "hurdle" : "bar", l, z);
    const free = open.filter(l => !walls.includes(l));
    if (free.length) runnerCoinLine(free[Math.floor(r() * free.length)], z - 2, 6 + Math.floor(r() * 5));
  }
  R.nextRow = z + gap;
}

// ---------- Moving ----------
function runnerSwipe(dir) {
  const R = run;
  if (!R || !R.mode3 || R.over || R.paused) return;
  if (dir === "left" || dir === "right") {
    const nl = Math.max(-1, Math.min(1, R.lane + (dir === "left" ? -1 : 1)));
    if (nl === R.lane) { R.shake = 0.25; if (!R.attract) sfx.bump(); return; }
    R.prevLane = R.lane; R.lane = nl; R.laneT = 0;
    if (R.tut === 1) runnerTutStep();
  } else if (dir === "up") {
    if (R.py <= R.gnd + 0.05 && !(R.power && R.power.kind === "jet")) {
      R.vy = R.gnd > 1 ? 10.5 : 9.6; R.slide = 0;
      if (R.gnd > 1) { R.flipT = 0.75; R.flipBonus = true; }
      if (!R.attract) sfx.jump();
    }
    if (R.tut === 2) runnerTutStep();
  } else if (dir === "down") {
    if (R.py > R.gnd + 0.05) R.vy = -22; R.slide = 0.75; if (!R.attract) sfx.slide();
    if (R.tut === 3) runnerTutStep();
  }
}
function runnerTutStep() {
  const R = run;
  R.tut++; R.slow = 1; R.tutText = "";
  if (R.tut > 3) { R.tut = 0; const s = runSave(); s.tutDone = true; persist(); runMsg("You've got it!", "Gather coins, dodge everything", 2.2, true); }
}
const runnerPlayerH = R => (R.slide > 0 ? 0.85 : 1.85);
// What's under the runner's feet: the street, a ramp, or the roof of a tram or bus.
function runnerGround(R, m) {
  let g = 0;
  for (const o of R.obs) {
    if (Math.abs(laneX(o.lane) - R.px) > 0.9 || m < o.z || m > o.z + o.len) continue;
    if (o.kind === "ramp") g = Math.max(g, (m - o.z) / o.len * 3.45);
    else if ((o.kind === "tram" || o.kind === "bus") && R.py > o.y1 - 0.4) g = Math.max(g, o.y1 + 0.05);
  }
  return g;
}

function runnerUpdate(dt) {
  const R = run;
  R.t += dt;
  const m = runnerM();
  if (R.over) { R.over += dt; R.crashT = (R.crashT || 0) + dt; return; }
  const jet = R.power && R.power.kind === "jet";
  const v = (Math.min(30, 12.5 + m * 0.009) * (R.hard ? 1.12 : 1)) * (jet ? 1.25 : 1);
  R.speed = v * RUN.M; R.v = v;
  R.dist += v * RUN.M * dt;
  R.inv = Math.max(0, R.inv - dt); R.flash = Math.max(0, R.flash - dt * 2); R.banner = Math.max(0, R.banner - dt);
  R.shake = Math.max(0, (R.shake || 0) - dt * 2.5); R.happy = Math.max(0, (R.happy || 0) - dt);
  R.laneT += dt; R.stumbleT = Math.max(0, R.stumbleT - dt); R.cheerT = Math.max(0, R.cheerT - dt);
  if (R.comboT > 0) R.comboT -= dt; else R.combo = 0;
  if (R.msgs.length) { R.msgs[0].t -= dt; if (R.msgs[0].t <= 0) R.msgs.shift(); }
  for (const p of R.pops || []) p.t += dt; R.pops = (R.pops || []).filter(p => p.t < 1.2);
  if (R.power) { R.power.t -= dt; if (R.power.t <= 0) R.power = null; }
  if (!R.attract && keys) {
    if (keys.arrowleft && !R.kl) runnerSwipe("left"); if (keys.arrowright && !R.kr) runnerSwipe("right");
    if (keys.arrowup && !R.ku) runnerSwipe("up"); if (keys.arrowdown && !R.kd) runnerSwipe("down");
    R.kl = keys.arrowleft; R.kr = keys.arrowright; R.ku = keys.arrowup; R.kd = keys.arrowdown;
  }
  // Sideways: a quick slide between lanes.
  const tx = laneX(R.lane), dx = tx - R.px;
  R.px += dx * Math.min(1, dt * 14); R.tilt = Math.max(-0.4, Math.min(0.4, dx * 0.25));
  R.x = 200 + R.px * 40;
  // Up and down: jumping, the jetboard high above the street.
  if (jet) { R.py += (7 - R.py) * Math.min(1, dt * 3); R.vy = 0; }
  else {
    const gnd = runnerGround(R, m); R.gnd = gnd;
    const land = () => {
      if (R.vy < -6) { R.kick = 0.35; if (!R.attract) sfx.land(); }
      R.py = gnd; R.vy = 0;
      if (R.flipBonus) { R.flipBonus = false; if (!R.attract) { runBonus("Flip! +5 ✦", 5, m * RUN.M + 2, R.x); sfx.flip(); } }
    };
    if (R.py > gnd + 0.02 || R.vy > 0) { R.vy -= 30 * dt; R.py += R.vy * dt; if (R.py <= gnd) land(); }
    else if (R.vy < 0) land();
    else { R.py = gnd; R.vy = 0; }
  }
  R.flipT = Math.max(0, R.flipT - dt); R.kick = Math.max(0, R.kick - dt * 2);
  R.slide = Math.max(0, R.slide - dt);
  R.phase += dt * v * 0.62;
  // Ahead: keep the avenue filled.
  while (R.nextRow < m + 170) runnerSpawnRow();
  for (const o of R.obs) { if (o.v) o.z -= o.v * dt; if (o.sweep) o.lane = Math.sin(R.t * 1.25 + o.ph); }
  // The ghost of today's best daily run, and this run's track for the next one.
  if (R.daily) R.rec[Math.floor(m)] = (R.lane + 1) + 3 * Math.min(9, Math.round(R.py * 2));
  R.obs = R.obs.filter(o => o.z + o.len > m - 12);
  R.coins = R.coins.filter(c => !c.gone && c.z > m - 6);
  R.ups = R.ups.filter(u => !u.got && u.z > m - 6);
  if (!R.attract && !R.tut) {
    if (!R.ev && m > R.nextEv) runnerStartEvent();
    if (R.ev) { R.ev.t -= dt; if (R.ev.t <= 0) runnerEndEvent(); }
  }
  // Tutorial: time slows near the lesson until you do it.
  if (R.tut) {
    const o = R.obs.find(q => q.tut === R.tut && q.z > m);
    if (o && o.z - m < 13) { R.slow = 0.22; R.tutText = ["", "Swipe left or right", "Swipe up to jump", "Swipe down to slide"][R.tut]; }
  }
  // Coins.
  const mag = R.power && R.power.kind === "magnet", h = runnerPlayerH(R);
  for (const c of R.coins) {
    if (c.got) { c.t += dt; if (c.t > 0.35) c.gone = true; continue; }
    const cx = laneX(c.lane);
    if (mag && Math.abs(c.z - m) < 14 + runUpg("magnet") * 4 + (runnerPerk("Mika") ? 6 : 0)) { c.mx = (c.mx ?? cx) + (R.px - (c.mx ?? cx)) * Math.min(1, dt * 9); c.z += (m - c.z) * Math.min(1, dt * 6); c.y += (R.py + 0.9 - c.y) * Math.min(1, dt * 6); }
    const x = c.mx ?? cx;
    if (Math.abs(x - R.px) < 0.9 && Math.abs(c.z - m) < 0.9 && c.y > R.py - 0.4 && c.y < R.py + h + 0.3) {
      c.got = true; c.t = 0;
      R.lights += weekEvent().id === "gold" ? 2 : 1;
      R.combo++; R.comboT = 1.6; R.comboBest = Math.max(R.comboBest, R.combo);
      if (runnerPerk("Nova") && R.combo % 10 === 0) { R.lights += 5; runBonus("+5 ✦", 0, m * RUN.M + 2, R.x); }
      if (!R.attract) { sfx.coin(R.combo); runMission("lights", R.lights); }
      const L = R.lines[c.line]; if (L && ++L.got === L.n) { R.trails++; if (!R.attract) runMission("trail", R.trails); }
    }
  }
  // Power-ups.
  for (const u of R.ups) if (!u.got && Math.abs(laneX(u.lane) - R.px) < 1 && Math.abs(u.z - m) < 1 && R.py < 2.5) {
    u.got = true;
    if (u.kind === "letter") {
      R.letterOut = false; if (R.attract) continue;
      const h = huntState(); h.got += u.ch; persist(); sfx.unlock();
      if (h.got.length >= HUNT.length) { save.glow = (save.glow || 0) + 250; persist(); runMsg("LUMEN complete! +250 ✦", "Come back tomorrow for a new hunt", 2.6, true); }
      else runMsg(`Letter ${u.ch}!`, `${h.got}${"·".repeat(HUNT.length - h.got.length)}  find LUMEN today`, 2, true);
      continue;
    }
    const perkK = (u.kind === "jet" && runnerPerk("Ray") ? 1.5 : 1) * (u.kind === "magnet" && runnerPerk("Mika") ? 1.3 : 1);
    R.power = { kind: u.kind, t: RUNNER_POWERS[u.kind].dur * (1 + runUpg("song") * 0.2) * perkK }; R.happy = 1;
    if (!R.attract) { sfx.power(); runMsg(RUNNER_POWERS[u.kind].name + "!", { magnet: "Coins fly to you", shield: "One hit is on us", jet: "Ride above the city" }[u.kind], 1.6, true); }
    if (u.kind === "jet") for (let q = 0; q < 3; q++) runnerCoinLine([-1, 0, 1][q], m + 12 + q * 34, 14, false), R.coins.slice(-14).forEach(c => (c.y = 7.6));
  }
  // Obstacles: hits, bumps from the side, clean jumps and slides, close calls.
  for (const o of R.obs) {
    if (o.kind === "ramp" || (o.ramp && R.py > 2.4)) continue;
    const ox = laneX(o.lane), zOver = o.z <= m + 0.45 && o.z + o.len >= m - 0.45, xOver = Math.abs(ox - R.px) < 1.0, yOver = R.py < o.y1 && R.py + h > o.y0;
    if (zOver && xOver && yOver && !o.hit && !jet) {
      const side = Math.abs(ox - R.px) > 0.35 && R.laneT < 0.3 && o.lane === R.lane;
      if (side && R.prevLane !== R.lane) {
        // Bumped from the side: back to the lane you came from.
        R.lane = R.prevLane; R.laneT = 9; R.stumbleT = 0.5; R.shake = 0.5; R.combo = 0;
        if (R.ev && R.ev.kind === "chase" && !R.attract) { R.ev.gap -= 0.5; if (R.ev.gap <= 0) { R.ev.gap = 1; if (R.inv <= 0) { runMsg("Caught!", "", 1.2); runHit(); } } }
        if (!R.attract) { sfx.bump(); buzz(20); }
        continue;
      }
      if (R.inv > 0) continue;
      o.hit = true;
      if (R.power && R.power.kind === "shield") { R.power = null; o.smash = 0.001; R.shake = 0.6; R.flash = -0.6; if (!R.attract) { runMsg("Shield!", "", 1.2); sfx.gate(); } continue; }
      R.combo = 0;
      if (R.ev && R.ev.kind === "chase") R.ev.gap = Math.max(0.1, R.ev.gap - 0.5);
      if (!R.attract) runHit(); else R.inv = 1;
      continue;
    }
    // Passed it.
    if (!o.passed && o.z + o.len < m - 0.45) {
      o.passed = true;
      if (o.hit) continue;
      if (Math.round(o.lane) === R.lane && (o.kind === "hurdle" || o.kind === "bar" || o.kind === "car" || o.kind === "drone" || ((o.kind === "tram" || o.kind === "bus") && R.py > 2))) {
        R.freed++; if (!R.attract) { sfx.clear(); runMission("free", R.freed); progressEvent("free"); R.combo++; R.comboT = 1.6; runBonus("Nice!", 0, m * RUN.M + 2, R.x); }
      } else if (Math.abs(o.lane * LANE_W - R.px) < 2.8 && R.laneT < 0.6 && (o.kind === "tram" || o.kind === "wall" || o.kind === "car" || o.kind === "bus")) {
        R.slowT = 0.3;
        if (!R.attract) { sfx.close(); progressEvent("near"); runBonus("Close call! +2 ✦", 2, m * RUN.M + 2, R.x); }
      }
    }
  }
  if (!R.attract) runMission("nohit", Math.floor(m - (R.hitAt || 0)));
  // Districts: the sky moves on as you go.
  const b = Math.floor(m / RUN.BIOME_M);
  if (b !== R.biome) { R.biome = b; R.banner = 3; if (!R.attract) runMission("biome", b + 1); }
  if (!R.attract) runMission("dist", Math.floor(m));
  // Every 500 m: fireworks and a cheering crowd.
  if (m >= R.nextMile) { R.nextMile += 500; R.cheerT = 3; R.fireworks.push({ t: 0, seed: Math.random() }); if (!R.attract) { runMsg(`${Math.floor(m)} m!`, "The city cheers", 1.8, true); sfx.unlock(); } }
  for (const f of R.fireworks) f.t += dt; R.fireworks = R.fireworks.filter(f => f.t < 3);
  if (!R.tut) R.slow = R.slowT > 0 ? 0.5 : 1;
  R.slowT = Math.max(0, R.slowT - dt * 2);
  if (!R.attract) { music.intensity = Math.min(1, (v - 12) / 16); music.layers = R.combo >= 12 ? 3 : 2; }
  if (!R.attract && Math.floor(R.t * 4) !== Math.floor((R.t - dt) * 4)) runHud();
}

function runnerStartEvent() {
  const R = run, kinds = ["rush", "blackout", "chase"], kind = kinds[(R.evN = (R.evN || 0) + 1) % 3 === 1 ? 0 : R.evN % 3 === 2 ? 1 : 2];
  R.ev = { kind, t: { rush: 8, blackout: 12, chase: 16 }[kind], gap: 1 };
  runMsg(...{ rush: ["Coin Rush!", "Grab everything for 8 seconds"], blackout: ["Blackout!", "The power's out. Follow the neon"], chase: ["Security drone!", "Don't trip up: it's right behind you"] }[kind], 2.4, true);
  sfx.power();
}
function runnerEndEvent() {
  const R = run, k = R.ev.kind;
  if (k === "chase") runBonus("Escaped! +30 ✦", 30, R.dist + 2, R.x);
  if (k === "blackout") runBonus("Lights back on! +15 ✦", 15, R.dist + 2, R.x);
  R.ev = null; R.nextEv = runnerM() + 550 + Math.floor(runR() * 250);
}

// The title screen plays by itself: it dodges and gathers.
function runnerAuto() {
  const R = run, m = runnerM();
  const ahead = R.obs.filter(o => o.kind !== "ramp" && o.z + o.len > m && o.z - m < 16);
  const dr = ahead.find(o => o.kind === "drone" && o.z - m < 5 && Math.abs(laneX(o.lane) - R.px) < 1.4);
  if (dr && R.slide <= 0) { runnerSwipe("down"); return; }
  const inLane = l => ahead.find(o => o.lane === l && o.kind !== "drone" && !(o.kind === "tram" && o.ramp && (R.py > 0.3 || o.z - m > 0)) && o.z - m < 14);
  const o = inLane(R.lane);
  if (o) {
    if (o.kind === "hurdle" && o.z - m < 4.5 && R.py < 0.05) runnerSwipe("up");
    else if (o.kind === "bar" && o.z - m < 5) runnerSwipe("down");
    else if (o.kind === "wall" || o.kind === "tram" || o.kind === "car" || o.kind === "bus") {
      const free = [-1, 0, 1].filter(l => Math.abs(l - R.lane) === 1 && !inLane(l));
      if (free.length && R.laneT > 0.3) runnerSwipe(free[0] < R.lane ? "left" : "right");
      else if (o.kind === "car" && o.z - m < 6 && R.py < 0.05) runnerSwipe("up");
    }
  } else if (R.laneT > 0.8) {
    const c = R.coins.find(c => !c.got && c.z > m + 3 && c.z < m + 16);
    if (c && c.lane !== R.lane && !inLane(c.lane) && Math.abs(c.lane - R.lane) === 1) runnerSwipe(c.lane < R.lane ? "left" : "right");
  }
}

// ---------- Drawing: the city in 3D ----------
let RUNNER3D_ = undefined;
function runnerReset3D() { if (RUNNER3D_) { try { RUNNER3D_.destroy(); } catch (e) {} } RUNNER3D_ = undefined; }
function runner3D() {
  if (RUNNER3D_ !== undefined) return RUNNER3D_;
  try { RUNNER3D_ = makeRunner3D(); } catch (e) { console.warn("runner 3D unavailable", e); RUNNER3D_ = null; }
  return RUNNER3D_;
}
function makeRunner3D() {
  const T = window.THREE;
  if (!T) return null;
  const view = document.createElement("canvas"); view.id = "runner3d";
  const renderer = new T.WebGLRenderer({ canvas: view, antialias: true, powerPreference: "high-performance" });
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
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const C = c => new T.Color(c[0] / 255, c[1] / 255, c[2] / 255);
  const tex = (w, h, paint, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso; t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const rnd = seeded(2024);
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const glowTex = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const glow = (c, s, a = 0.8) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: a, blending: T.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, 1); return sp; };
  const std = (o) => new T.MeshStandardMaterial(o);
  const phys = (o) => new T.MeshPhysicalMaterial(o);
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

  // ---------- The avenue: asphalt with tram rails, sidewalks, curbs ----------
  const ROAD_TILE = 10;
  const roadTex = tex(512, 512, (g) => {
    g.fillStyle = "#3a3d44"; g.fillRect(0, 0, 512, 512);
    const r = seeded(7); for (let q = 0; q < 9000; q++) { const v = 40 + r() * 40; g.fillStyle = `rgba(${v},${v + 2},${v + 6},0.35)`; g.fillRect(r() * 512, r() * 512, 2, 2); }
    const X = x => (x + 4.5) / 9 * 512;
    for (const l of [-1, 0, 1]) for (const s of [-1, 1]) { const x = X(l * LANE_W + s * 0.72); g.fillStyle = "#24262b"; g.fillRect(x - 6, 0, 12, 512); g.fillStyle = "#b9bec8"; g.fillRect(x - 2.5, 0, 5, 512); }
    g.fillStyle = "#e9ecef"; for (const s of [-1, 1]) { const x = X(s * LANE_W / 2); for (let y = 0; y < 512; y += 128) g.fillRect(x - 3, y, 6, 70); }
    g.fillStyle = "#f2c94c"; for (const s of [-1, 1]) g.fillRect(X(s * 4.15) - 3, 0, 6, 512);
  });
  const roadRM = tex(512, 512, (g) => { g.fillStyle = "rgb(0,225,0)"; g.fillRect(0, 0, 512, 512); const X = x => (x + 4.5) / 9 * 512; for (const l of [-1, 0, 1]) for (const s of [-1, 1]) { g.fillStyle = "rgb(0,70,255)"; g.fillRect(X(l * LANE_W + s * 0.72) - 2.5, 0, 5, 512); } }, false);
  roadTex.repeat.set(1, 200 / ROAD_TILE); roadRM.repeat.copy(roadTex.repeat);
  const roadMat = std({ map: roadTex, roughnessMap: roadRM, metalnessMap: roadRM, roughness: 1, metalness: 1 });
  const road = new T.Mesh(new T.PlaneGeometry(9, 200), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -90); road.receiveShadow = true; scene.add(road);
  const paveTex = tex(256, 256, (g) => { g.fillStyle = "#c9c6bf"; g.fillRect(0, 0, 256, 256); const r = seeded(11); for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 64) { const v = 185 + r() * 25; g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + (y / 32 % 2) * 32 + 1, y + 1, 62, 30); } });
  paveTex.repeat.set(2, 200 / 4);
  const paveMat = std({ map: paveTex, roughness: 0.9 });
  const curbMat = std({ color: 0xd9dbe0, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const w = new T.Mesh(new T.BoxGeometry(5, 0.18, 200), paveMat); w.position.set(s * 7, 0.09, -90); w.receiveShadow = true; scene.add(w);
    const c = new T.Mesh(new T.BoxGeometry(0.3, 0.2, 200), curbMat); c.position.set(s * 4.6, 0.1, -90); c.receiveShadow = true; scene.add(c);
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
  FAC.forEach((f, i) => {
    f.map = tex(512, 512, g => f.paint(g, "map", seeded(i + 1))); f.lit = tex(512, 512, g => f.paint(g, "lit", seeded(i + 1))); f.rm = tex(512, 512, g => f.paint(g, "rm", seeded(i + 1)), false);
    f.mat = std({ map: f.map, emissiveMap: f.lit, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: f.rm, metalnessMap: f.rm, roughness: 1, metalness: 1 });
  });
  const TILE = 9;                        // metres of facade per texture tile
  function boxUV(w, h, d) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let q = 0; q < 4; q++) { const i = f * 4 + q; uv.setXY(i, uv.getX(i) * dims[f][0] / TILE, uv.getY(i) * dims[f][1] / TILE); }
    return g;
  }
  // Shops on the ground floor, with awnings and warm windows.
  const SHOPS = [["NOVA CAFE", "#1f6f63", "#f6d6a8"], ["RAMEN 24", "#b8323a", "#ffd9a0"], ["KICKS", "#232a35", "#ffffff"], ["BLOOM", "#e58fa8", "#fff1f4"], ["VINYL", "#3a2f5b", "#f9e3ff"], ["MARKET", "#2f6b2f", "#fff7da"], ["PIXEL", "#155a9c", "#dff0ff"], ["BAKERY", "#a8692e", "#fff3df"]];
  const shopTex = SHOPS.map(([name, col, glow]) => tex(512, 128, (g) => {
    g.fillStyle = "#e7e3dc"; g.fillRect(0, 0, 512, 128);
    g.fillStyle = col; g.fillRect(0, 0, 512, 34); g.fillStyle = glow; g.font = "800 24px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, 256, 18);
    for (let q = 0; q < 3; q++) { const x = 16 + q * 168, gr = g.createLinearGradient(0, 42, 0, 124); gr.addColorStop(0, "#f8d9a0"); gr.addColorStop(1, "#9a6a3c"); g.fillStyle = gr; g.fillRect(x, 42, 144, 82); g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x + 8, 42, 18, 82); g.fillStyle = "rgba(40,30,20,0.5)"; for (let k = 0; k < 4; k++) g.fillRect(x + 20 + k * 32, 92, 18, 32); }
    g.fillStyle = "#2b2f36"; g.fillRect(0, 124, 512, 4);
  }));
  const shopMats = shopTex.map(t => std({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 }));
  const awningMats = SHOPS.map(s => std({ color: s[1], roughness: 0.7 }));
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
  const NEON_WORDS = ["HOTEL", "BAR", "OPEN", "CAFE", "TAXI", "CLUB", "24H"];
  const neonTex = NEON_WORDS.map(w => tex(64, 320, (g) => { g.fillStyle = "#121318"; g.fillRect(0, 0, 64, 320); g.strokeStyle = "#fff"; g.lineWidth = 4; g.strokeRect(4, 4, 56, 312); g.fillStyle = "#fff"; g.font = "800 40px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; [...w].forEach((ch, q) => g.fillText(ch, 32, 160 + (q - (w.length - 1) / 2) * 50)); }));
  const NEON_COL = [0xff3d7f, 0x22e0ff, 0xffc23d, 0x9b6bff, 0x3dffa8];
  const metalDark = std({ color: 0x2b2f38, metalness: 0.7, roughness: 0.35 });
  const roofMat = std({ color: 0x8d9097, roughness: 0.8 });
  const sides = { [-1]: { list: [], next: -30 }, [1]: { list: [], next: -22 } };
  function makeBuilding(side, z0, n) {
    const r = seeded(n * 7919 + (side > 0 ? 17 : 3)), len = 12 + Math.floor(r() * 4) * 4, depth = 14 + r() * 8, h = 14 + Math.floor(r() * 9) * 5;
    const th = runnerTheme(z0);
    if (th.water === side) return makeWater(side, z0, len, r);
    if (th.park === side && r() < 0.75) return makePark(side, z0, len, r);
    const style = FAC[th.fac[Math.floor(r() * th.fac.length)]], g = new T.Group();
    const xIn = side * 9.6, cx = xIn + side * depth / 2;
    const main = new T.Mesh(boxUV(depth, h, len - 0.6), style.mat); main.position.set(cx, h / 2 + 4, 0); main.castShadow = true; main.receiveShadow = true; g.add(main);
    // A setback crown on taller towers.
    if (h > 34 && r() < 0.6) { const h2 = 6 + r() * 14, crown = new T.Mesh(boxUV(depth * 0.7, h2, len * 0.7), style.mat); crown.position.set(cx + side * depth * 0.12, h + 4 + h2 / 2, 0); crown.castShadow = true; g.add(crown); }
    // Ground floor: a shop.
    const si = Math.floor(r() * SHOPS.length), shop = new T.Mesh(boxGeo, [roofMat, roofMat, roofMat, roofMat, roofMat, roofMat]);
    shop.scale.set(depth, 4, len - 0.6); shop.position.set(cx, 2, 0); g.add(shop);
    const front = new T.Mesh(new T.PlaneGeometry(len - 1, 4), shopMats[si]); front.position.set(xIn - side * 0.02, 2, 0); front.rotation.y = -side * Math.PI / 2; front.receiveShadow = true; g.add(front);
    const awn = new T.Mesh(boxGeo, awningMats[si]); awn.scale.set(1.6, 0.12, len - 2); awn.position.set(xIn - side * 0.8, 3.25, 0); awn.rotation.z = side * 0.25; awn.castShadow = true; g.add(awn);
    // A billboard or a neon blade sign now and then.
    const roll = r();
    if (roll < th.ad && h > 18) { const ai = Math.floor(r() * ADS.length), bw = Math.min(len - 2, 10), bh = bw / 2, bb = new T.Group(); const scr = new T.Mesh(new T.PlaneGeometry(bw, bh), adMats[ai]); bb.add(scr); const frame = new T.Mesh(boxGeo, metalDark); frame.scale.set(bw + 0.4, bh + 0.4, 0.3); frame.position.z = -0.17; bb.add(frame); bb.position.set(xIn - side * 0.25, 9 + r() * 6, 0); bb.rotation.y = -side * Math.PI / 2; g.add(bb); g.userData.ad = scr; }
    else if (roll < th.ad + th.neon) { const wi = Math.floor(r() * NEON_WORDS.length), col = NEON_COL[Math.floor(r() * NEON_COL.length)], sign = new T.Group(); const faceM = new T.MeshBasicMaterial({ map: neonTex[wi], color: col, toneMapped: false }); const s = new T.Mesh(boxGeo, [metalDark, metalDark, metalDark, metalDark, faceM, faceM]); s.scale.set(0.5, 5, 1.4); sign.add(s); sign.position.set(xIn - side * 0.95, 9 + r() * 4, len * 0.25 * (r() < 0.5 ? -1 : 1)); g.add(sign); g.userData.neon = faceM; g.userData.neonCol = col; }
    // Rooftop things.
    for (let q = 0; q < 2; q++) { const ac = new T.Mesh(boxGeo, roofMat); ac.scale.set(2 + r() * 2, 1.2, 2 + r() * 2); ac.position.set(cx + (r() - 0.5) * depth * 0.5, h + 4.6, (r() - 0.5) * len * 0.5); ac.castShadow = true; g.add(ac); }
    if (r() < 0.25) { const wt = new T.Group(), tank = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 2.6, 18), std({ color: 0x8a6a4a, roughness: 0.8 })); tank.position.y = 3.2; wt.add(tank); const cap = new T.Mesh(new T.ConeGeometry(1.6, 1, 18), std({ color: 0x5a4632, roughness: 0.8 })); cap.position.y = 5; wt.add(cap); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 2, 6), metalDark); leg.position.set(a * 0.9, 1, b * 0.9); wt.add(leg); } wt.position.set(cx, h + 4, 0); shadowAll(wt); g.add(wt); }
    g.userData.style = style; g.userData.len = len; g.userData.z0 = z0;
    scene.add(g);
    return { g, z0, len };
  }
  // The waterfront: a railing, the harbour, boats, the far shore.
  const waterMat = std({ color: 0x1d5a80, roughness: 0.06, metalness: 0.35 });
  const railMat = std({ color: 0xdfe3e8, metalness: 0.7, roughness: 0.3 });
  function makeWater(side, z0, len, r) {
    const g = new T.Group();
    const w = new T.Mesh(new T.PlaneGeometry(160, len), waterMat); w.rotation.x = -Math.PI / 2; w.position.set(side * 89.6, -0.7, 0); w.receiveShadow = true; g.add(w);
    const wall = new T.Mesh(boxGeo, concreteMat); wall.scale.set(0.6, 1.4, len); wall.position.set(side * 9.8, -0.5, 0); g.add(wall);
    const rail = new T.Mesh(boxGeo, railMat); rail.scale.set(0.07, 0.07, len); rail.position.set(side * 9.35, 1.2, 0); g.add(rail);
    for (let q = 0; q < len; q += 2) { const post = new T.Mesh(boxGeo, railMat); post.scale.set(0.06, 1.05, 0.06); post.position.set(side * 9.35, 0.7, q - len / 2); g.add(post); }
    if (r() < 0.45) {
      const boat = new T.Group(), hull = new T.Mesh(boxGeo, std({ color: 0xf4f4f2, roughness: 0.4 })); hull.scale.set(2.6, 0.9, 7); boat.add(hull);
      const bow = new T.Mesh(new T.ConeGeometry(1.3, 2.4, 4), hull.material); bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.35); bow.position.set(0, 0, -4.6); boat.add(bow);
      const cab = new T.Mesh(boxGeo, std({ color: [0x2a9d8f, 0xd62839, 0x3a86ff][Math.floor(r() * 3)], roughness: 0.5 })); cab.scale.set(1.8, 1.2, 2.6); cab.position.set(0, 1, 0.8); boat.add(cab);
      const stripe = new T.Mesh(boxGeo, cab.material); stripe.scale.set(2.62, 0.15, 7.02); stripe.position.y = 0.2; boat.add(stripe);
      boat.position.set(side * (15 + r() * 22), -0.4, (r() - 0.5) * len * 0.5); boat.rotation.y = (r() - 0.5) * 0.6; shadowAll(boat); g.add(boat); g.userData.boat = boat;
    }
    for (let q = 0; q < 2; q++) { const hh = 30 + r() * 60, b = new T.Mesh(boxUV(22, hh, len * 0.45), FAC[[0, 3, 2][Math.floor(r() * 3)]].mat); b.position.set(side * (120 + r() * 40), hh / 2 - 0.7, (q - 0.5) * len * 0.5); g.add(b); }
    g.userData.len = len; g.userData.z0 = z0; scene.add(g);
    return { g, z0, len };
  }
  // A park: lawn, trees, hedges, a low pavilion behind.
  const grassMat = std({ color: 0x5f9a45, roughness: 0.95 }), hedgeMat = std({ color: 0x3f7a35, roughness: 0.9 });
  function makePark(side, z0, len, r) {
    const g = new T.Group();
    const lawn = new T.Mesh(new T.PlaneGeometry(26, len), grassMat); lawn.rotation.x = -Math.PI / 2; lawn.position.set(side * 22.6, 0.12, 0); lawn.receiveShadow = true; g.add(lawn);
    const hedge = new T.Mesh(boxGeo, hedgeMat); hedge.scale.set(0.9, 0.8, len - 1); hedge.position.set(side * 10.1, 0.4, 0); hedge.castShadow = true; g.add(hedge);
    for (let q = 0; q < 3; q++) { const t = makeTree(Math.floor(r() * 9)); t.scale.setScalar(1.3 + r() * 0.7); t.position.set(side * (13 + r() * 14), 0.12, (r() - 0.5) * len); g.add(t); }
    const hh = 8 + r() * 6, pav = new T.Mesh(boxUV(14, hh, len * 0.7), FAC[5].mat); pav.position.set(side * 42, hh / 2, 0); pav.castShadow = true; g.add(pav);
    g.userData.len = len; g.userData.z0 = z0; scene.add(g);
    return { g, z0, len };
  }
  // The market: lanterns strung across the avenue and stalls on the sidewalks.
  const lanternCols = [0xff4d4d, 0xffa53d, 0xffd84d, 0xff6fb5];
  function makeLanterns(n) {
    const g = new T.Group(), pts = [];
    for (let q = 0; q <= 12; q++) { const x = -4.9 + q * 9.8 / 12, k = x / 4.9; pts.push(new T.Vector3(x, 7.8 - 1.0 * (1 - k * k), 0)); }
    const wire = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.02, 4), metalDark); g.add(wire);
    const glows = [];
    for (let q = 1; q < 8; q++) { const x = -4.9 + q * 9.8 / 8, k = x / 4.9, y = 7.8 - 1.0 * (1 - k * k) - 0.35; const ln = new T.Mesh(new T.SphereGeometry(0.22, 14, 10), basic(lanternCols[(q + n) % 4])); ln.scale.set(1, 1.3, 1); ln.position.set(x, y, 0); g.add(ln); const gl = glow(lanternCols[(q + n) % 4], 1.4, 0); gl.position.set(x, y, 0.05); g.add(gl); glows.push(gl); }
    for (const sd of [-1, 1]) { const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 8, 8), lampMat); pole.position.set(sd * 4.95, 4, 0); g.add(pole); }
    g.userData.glows = glows; return g;
  }
  const awnTex = tex(128, 32, (g) => { for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16) % 2 ? "#ffffff" : "#e85d4a"; g.fillRect(x, 0, 16, 32); } });
  const fruitCols = [0xff5a3d, 0xffc23d, 0x8fd14f, 0xff8a1f, 0xd62839];
  function makeStall(k) {
    const g = new T.Group(), wood = std({ color: 0x9a6a3e, roughness: 0.8 });
    const table = new T.Mesh(boxGeo, wood); table.scale.set(1.3, 0.9, 2.4); table.position.y = 0.45; g.add(table);
    for (const [x, z] of [[-0.6, -1.15], [0.6, -1.15], [-0.6, 1.15], [0.6, 1.15]]) { const p2 = new T.Mesh(boxGeo, wood); p2.scale.set(0.06, 2.4, 0.06); p2.position.set(x, 1.2, z); g.add(p2); }
    const aw = new T.Mesh(boxGeo, std({ map: awnTex, roughness: 0.7 })); aw.scale.set(1.6, 0.06, 2.7); aw.position.y = 2.4; aw.rotation.z = 0.15; g.add(aw);
    for (let q = 0; q < 10; q++) { const f = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), std({ color: fruitCols[(q + k) % 5], roughness: 0.6 })); f.position.set(-0.4 + (q % 3) * 0.4, 0.98, -0.9 + Math.floor(q / 3) * 0.6); g.add(f); }
    shadowAll(g); return g;
  }
  // Street furniture and people along the sidewalks.
  const lampMat = std({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4 }), lampHead = basic(0xfff1c8);
  const leafMats = [std({ color: 0x4f8a3c, roughness: 0.8 }), std({ color: 0x6aa04a, roughness: 0.8 }), std({ color: 0xd98c3a, roughness: 0.8 })];
  const trunkMat = std({ color: 0x5a4434, roughness: 0.9 }), planterMat = std({ color: 0xb8b3aa, roughness: 0.8 });
  const benchMat = std({ color: 0x8a5a3a, roughness: 0.7 });
  function makeLamp() { const g = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 6, 10), lampMat); pole.position.y = 3; g.add(pole); const arm = new T.Mesh(boxGeo, lampMat); arm.scale.set(1.4, 0.1, 0.1); arm.position.set(0.7, 6, 0); g.add(arm); const head = new T.Mesh(boxGeo, lampHead); head.scale.set(0.6, 0.12, 0.3); head.position.set(1.3, 5.92, 0); g.add(head); const gl = glow(0xffe2a8, 1.8, 0); gl.position.set(1.3, 5.8, 0); g.add(gl); shadowAll(g); g.userData.glow = gl; return g; }
  function makeTree(k) { const g = new T.Group(); const p = new T.Mesh(boxGeo, planterMat); p.scale.set(1.3, 0.5, 1.3); p.position.y = 0.25; g.add(p); const t = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 2.4, 8), trunkMat); t.position.y = 1.5; g.add(t); for (let q = 0; q < 3; q++) { const f = new T.Mesh(new T.IcosahedronGeometry(1 - q * 0.15, 1), leafMats[k % 3 === 2 ? 2 : q % 2]); f.position.set((q - 1) * 0.35, 3.1 + q * 0.45, (q % 2 - 0.5) * 0.4); f.rotation.set(q, q * 2, 0); g.add(f); } shadowAll(g); return g; }
  function makeBench() { const g = new T.Group(); const s = new T.Mesh(boxGeo, benchMat); s.scale.set(0.5, 0.08, 1.8); s.position.y = 0.48; g.add(s); const b = new T.Mesh(boxGeo, benchMat); b.scale.set(0.08, 0.45, 1.8); b.position.set(0.22, 0.75, 0); g.add(b); for (const z of [-0.75, 0.75]) { const l = new T.Mesh(boxGeo, lampMat); l.scale.set(0.45, 0.48, 0.06); l.position.set(0, 0.24, z); g.add(l); } shadowAll(g); return g; }
  // People: simple, stylish figures in modern clothes.
  const SKIN = [0xf1c7a5, 0xd9a27c, 0xa86f4c, 0x6b4430, 0xe8b894];
  const CLOTH = [0xf4f4f2, 0x1f2937, 0xe76f51, 0x2a9d8f, 0xe9c46a, 0x6c63ff, 0xff6b9a, 0x3a86ff, 0x8d99ae, 0x111111];
  const capsule = (r, h, mat) => { const g = new T.Group(); const c = new T.Mesh(new T.CylinderGeometry(r, r, h, 12), mat); g.add(c); for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(r, 12, 8), mat); e.position.y = s * h / 2; g.add(e); } return g; };
  const matCache = {}; const matOf = (c, rough = 0.7) => matCache[c + "_" + rough] || (matCache[c + "_" + rough] = std({ color: c, roughness: rough }));
  function makePerson(k) {
    const r = seeded(k * 131 + 7), g = new T.Group(), skin = matOf(SKIN[Math.floor(r() * SKIN.length)]), top = matOf(CLOTH[Math.floor(r() * CLOTH.length)]), bottom = matOf(CLOTH[Math.floor(r() * CLOTH.length)]), hair = matOf([0x1a1410, 0x3b2a1e, 0x6b4a2b, 0xd9b26a, 0x222222][Math.floor(r() * 5)]);
    const legs = []; for (const s of [-1, 1]) { const hip = new T.Group(); hip.position.set(s * 0.1, 0.9, 0); const l = capsule(0.075, 0.7, bottom); l.position.y = -0.42; hip.add(l); const shoe = new T.Mesh(boxGeo, matOf(r() < 0.5 ? 0xffffff : 0x222222, 0.5)); shoe.scale.set(0.12, 0.08, 0.26); shoe.position.set(0, -0.84, -0.05); hip.add(shoe); g.add(hip); legs.push(hip); }
    const torso = capsule(0.17, 0.42, top); torso.position.y = 1.22; torso.scale.set(1, 1, 0.75); g.add(torso);
    const arms = []; for (const s of [-1, 1]) { const sh = new T.Group(); sh.position.set(s * 0.24, 1.42, 0); const a = capsule(0.055, 0.5, top); a.position.y = -0.3; sh.add(a); const hand = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), skin); hand.position.y = -0.6; sh.add(hand); g.add(sh); arms.push(sh); }
    const head = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.68; g.add(head);
    const hr = new T.Mesh(new T.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.y = 1.69; g.add(hr);
    const sc = 0.92 + r() * 0.16; g.scale.setScalar(sc);
    shadowAll(g);
    g.userData = { legs, arms, walk: r() < 0.6, dir: r() < 0.5 ? -1 : 1, ph: r() * 6, speed: 1 + r() * 0.6 };
    return g;
  }
  const props = [];                       // street furniture and people, in slots along the sidewalk
  const SLOT = 6;
  let nextSlot = -2;
  function fillSlot(n) {
    const r = seeded(n * 104729 + 11), z0 = n * SLOT, out = [];
    for (const side of [-1, 1]) {
      const x = side * 5.4;
      if (n % 3 === 0) { const l = makeLamp(); l.position.set(side * 4.95, 0.18, 0); l.rotation.y = side > 0 ? Math.PI : 0; out.push(l); }
      else if (r() < 0.55) { const t = makeTree(n + side); t.position.set(x + side * 0.2, 0.18, 0); out.push(t); }
      else if (r() < 0.3) { const th = runnerTheme(z0); if (th.stalls && r() < 0.7) { const st = makeStall(n); st.position.set(side * 8.3, 0.18, 0); out.push(st); } else { const b = makeBench(); b.position.set(side * 8.6, 0.18, 0); b.rotation.y = side > 0 ? 0 : Math.PI; out.push(b); } }
      const crowd = r() < (lite ? 0.3 : 0.6) ? 1 + Math.floor(r() * (lite ? 1 : 2)) : 0;
      for (let q = 0; q < crowd; q++) { const p = makePerson(n * 5 + q + (side > 0 ? 2 : 0)); p.position.set(side * (6.4 + r() * 2.2), 0.18, (r() - 0.5) * SLOT); p.rotation.y = p.userData.walk ? (p.userData.dir > 0 ? 0 : Math.PI) : side > 0 ? -Math.PI / 2 : Math.PI / 2; p.userData.side = side; out.push(p); }
    }
    if (runnerTheme(z0).lanterns && n % 2 === 0) out.push(makeLanterns(n));
    out.forEach(o => { o.userData.slotZ = z0 + (o.position.z || 0); o.userData.baseZ = o.position.z; scene.add(o); });
    return { n, out };
  }
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

  // ---------- The runner ----------
  function makeRunner(L) {
    const ch = RUNNER_CHARS[L.char] || RUNNER_CHARS[0], lk = ch.look, topC = (RUNNER_TOPS[L.top] || {}).c ?? lk.top, shoeC = (RUNNER_SHOES[L.shoe] || {}).c ?? lk.shoe, chrome = shoeC === 0xc9ced6;
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const hoodie = std({ color: topC, roughness: 0.78 }), pants = std({ color: lk.pants, roughness: 0.8 }), skin = std({ color: lk.skin, roughness: 0.55 });
    const shoe = phys({ color: shoeC, roughness: chrome ? 0.12 : 0.35, metalness: chrome ? 0.9 : 0, clearcoat: 0.6 }), sole = basic(lk.accent), capM = std({ color: lk.hat || 0x111318, roughness: 0.6 }), phones = phys({ color: 0xf2f2f2, roughness: 0.3, clearcoat: 1 }), hairM = std({ color: lk.hairC, roughness: 0.75 });
    const hips = new T.Group(); hips.position.y = 0.98; body.add(hips);
    // Torso: a hoodie with a hood on the back and a pocket.
    const torsoG = new T.Group(); hips.add(torsoG);
    const prof = [[0.16, 0], [0.19, 0.08], [0.2, 0.25], [0.235, 0.42], [0.245, 0.5], [0.2, 0.58], [0.07, 0.63]].map(([x, y]) => new T.Vector2(x, y));
    const torso = new T.Mesh(new T.LatheGeometry(prof, 28), hoodie); torso.scale.set(1, 1, 0.72); torsoG.add(torso);
    const hood = new T.Mesh(new T.SphereGeometry(0.15, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hoodie); hood.position.set(0, 0.56, 0.11); hood.rotation.x = -0.9; hood.scale.set(1.15, 1, 0.8); torsoG.add(hood);
    const band = new T.Mesh(new T.TorusGeometry(0.165, 0.025, 8, 28), hoodie); band.rotation.x = Math.PI / 2; band.position.y = 0.02; band.scale.set(1, 0.72, 1); torsoG.add(band);
    const stripe = new T.Mesh(new T.TorusGeometry(0.236, 0.012, 6, 32), basic(lk.accent)); stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.4; stripe.scale.set(1, 0.72, 1); torsoG.add(stripe);
    // Head: hair, a backwards cap, headphones.
    const neck = new T.Group(); neck.position.y = 0.64; torsoG.add(neck);
    const head = new T.Mesh(new T.SphereGeometry(0.125, 24, 18), skin); head.position.y = 0.13; head.scale.set(0.95, 1.08, 1); neck.add(head);
    const hair = new T.Mesh(new T.SphereGeometry(0.132, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM); hair.position.y = 0.135; hair.rotation.x = 0.35; neck.add(hair);
    if (ch.hair === "cap") {
      const cap = new T.Mesh(new T.SphereGeometry(0.136, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), capM); cap.position.y = 0.15; neck.add(cap);
      const brim = new T.Mesh(boxGeo, capM); brim.scale.set(0.2, 0.02, 0.14); brim.position.set(0, 0.17, 0.17); brim.rotation.x = -0.15; neck.add(brim);
    } else if (ch.hair === "beanie") {
      const bn = new T.Mesh(new T.SphereGeometry(0.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), capM); bn.scale.set(1, 1.25, 1); bn.position.y = 0.15; neck.add(bn);
      const cuffB = new T.Mesh(new T.TorusGeometry(0.135, 0.03, 8, 28), capM); cuffB.rotation.x = Math.PI / 2; cuffB.position.y = 0.16; neck.add(cuffB);
    } else if (ch.hair === "pony") {
      const tail = capsule(0.045, 0.2, hairM); tail.position.set(0, 0.06, 0.15); tail.rotation.x = 0.5; neck.add(tail);
      const tie = new T.Mesh(new T.TorusGeometry(0.035, 0.012, 6, 14), basic(lk.accent)); tie.position.set(0, 0.17, 0.13); tie.rotation.x = 0.9; neck.add(tie);
    } else if (ch.hair === "band") {
      const bd = new T.Mesh(new T.TorusGeometry(0.13, 0.018, 8, 28), capM); bd.rotation.x = Math.PI / 2 - 0.15; bd.position.y = 0.18; neck.add(bd);
      for (let q = 0; q < 5; q++) { const sp = new T.Mesh(new T.ConeGeometry(0.035, 0.09, 8), hairM); sp.position.set((q - 2) * 0.045, 0.27, 0.02 + Math.abs(q - 2) * 0.01); sp.rotation.x = 0.4; neck.add(sp); }
    } else if (ch.hair === "buns") {
      for (const sd of [-1, 1]) { const bun = new T.Mesh(new T.SphereGeometry(0.055, 14, 10), hairM); bun.position.set(sd * 0.08, 0.27, 0.02); neck.add(bun); }
    }
    const arc = new T.Mesh(new T.TorusGeometry(0.145, 0.018, 8, 28, Math.PI), phones); arc.position.y = 0.13; neck.add(arc);
    for (const s of [-1, 1]) { const cup = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.05, 18), phones); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.14, 0.12, 0); neck.add(cup); const ring = new T.Mesh(new T.TorusGeometry(0.042, 0.008, 6, 18), basic(lk.accent)); ring.rotation.y = Math.PI / 2; ring.position.set(s * 0.167, 0.12, 0); neck.add(ring); }
    // Arms.
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(s * 0.25, 0.5, 0); torsoG.add(sh);
      const up = capsule(0.06, 0.2, hoodie); up.position.y = -0.14; sh.add(up);
      const el = new T.Group(); el.position.y = -0.28; sh.add(el);
      const lo = capsule(0.052, 0.18, hoodie); lo.position.y = -0.12; el.add(lo);
      const hand = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), skin); hand.position.y = -0.27; el.add(hand);
      arms.push({ sh, el });
    }
    // Legs: joggers and bright sneakers.
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(s * 0.1, 0, 0); hips.add(hip);
      const th = capsule(0.085, 0.3, pants); th.position.y = -0.22; hip.add(th);
      const kn = new T.Group(); kn.position.y = -0.44; hip.add(kn);
      const sh2 = capsule(0.07, 0.3, pants); sh2.position.y = -0.2; kn.add(sh2);
      const cuff = new T.Mesh(new T.CylinderGeometry(0.068, 0.068, 0.05, 12), std({ color: lk.accent, roughness: 0.7 })); cuff.position.y = -0.4; kn.add(cuff);
      const foot = new T.Group(); foot.position.y = -0.46; kn.add(foot);
      const sn = new T.Mesh(new T.SphereGeometry(0.1, 18, 12), shoe); sn.scale.set(0.95, 0.6, 1.55); sn.position.set(0, 0, -0.05); foot.add(sn);
      const so = new T.Mesh(boxGeo, sole); so.scale.set(0.17, 0.035, 0.31); so.position.set(0, -0.05, -0.05); foot.add(so);
      legs.push({ hip, kn, foot });
    }
    shadowAll(g);
    // A glow ring at the feet for powers.
    const aura = glow(0xffffff, 2.4, 0); aura.position.y = 0.9; g.add(aura);
    const shield = new T.Mesh(new T.SphereGeometry(1.2, 32, 20), new T.MeshPhysicalMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false })); shield.position.y = 0.95; shield.visible = false; g.add(shield);
    const board = new T.Group(); const deck = new T.Mesh(new T.BoxGeometry(0.55, 0.06, 1.4), phys({ color: 0x111318, metalness: 0.5, roughness: 0.3, clearcoat: 1 })); board.add(deck); const bglow = new T.Mesh(boxGeo, basic(0xffc850)); bglow.scale.set(0.5, 0.02, 1.3); bglow.position.y = -0.04; board.add(bglow); const bl = glow(0xffc850, 2.4, 0.7); bl.position.y = -0.2; board.add(bl); board.visible = false; g.add(board);
    g.userData = { body, hips, torsoG, neck, arms, legs, aura, shield, board, hoodie };
    return g;
  }
  let hero = makeRunner(runnerLook()); scene.add(hero);
  let lookKey = JSON.stringify(runnerLook());
  // The ghost of today's best daily run: the same runner, see-through.
  const ghostMat = new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.28, depthWrite: false });
  let ghost = null, ghostPairs = [];
  function buildGhost() {
    if (ghost) scene.remove(ghost);
    ghost = makeRunner(runnerLook()); ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } if (o.isSprite) o.visible = false; });
    ghost.userData.shield.visible = false; ghost.userData.board.visible = false; scene.add(ghost);
    const a = [], b = []; hero.traverse(o => a.push(o)); ghost.traverse(o => b.push(o)); ghostPairs = a.map((o, q) => [o, b[q]]).filter(p => p[1]);
  }
  buildGhost(); ghost.visible = false;
  let chaser = null;
  const blob = new T.Mesh(new T.CircleGeometry(0.5, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  function animateRunner(R, dt) {
    const u = hero.userData, p = R.phase, air = R.py > (R.gnd || 0) + 0.05 && !(R.power && R.power.kind === "jet"), jet = R.power && R.power.kind === "jet", slide = R.slide > 0 && !air;
    const s = Math.sin(p), c = Math.cos(p);
    let thL = s * 0.95, thR = -s * 0.95, knL = -(0.25 + 1.2 * Math.max(0, -Math.sin(p - 0.9))), knR = -(0.25 + 1.2 * Math.max(0, Math.sin(p - 0.9)));
    let shL = -s * 0.85, shR = s * 0.85, elb = 1.35, lean = -0.22, bodyY = Math.abs(c) * 0.06, bodyRotX = 0;
    if (air) { thL = 1.1; thR = 0.4; knL = -1.6; knR = -1.1; shL = 2.5; shR = 2.1; elb = 0.4; lean = -0.1; }
    if (jet) { thL = 0.25; thR = -0.15; knL = -0.5; knR = -0.4; shL = 0.5; shR = -0.4; elb = 0.6; lean = -0.05; bodyY = 0.12; }
    if (slide) { bodyRotX = 1.05; thL = 1.5; thR = 0.6; knL = -0.1; knR = -1.4; shL = 0.9; shR = -0.6; elb = 0.4; lean = 0; bodyY = -0.62; }
    if (R.stumbleT > 0) lean += Math.sin(R.stumbleT * 30) * 0.2;
    if (R.over) { bodyRotX = -1.45; bodyY = -0.72; thL = thR = 0.3; knL = knR = -0.4; shL = shR = 2.8; elb = 0.2; lean = 0; }
    const k = Math.min(1, dt * 18), lerp = (o, key, v) => (o[key] += (v - o[key]) * k);
    lerp(u.legs[0].hip.rotation, "x", thL); lerp(u.legs[1].hip.rotation, "x", thR); lerp(u.legs[0].kn.rotation, "x", knL); lerp(u.legs[1].kn.rotation, "x", knR);
    u.legs.forEach(l => lerp(l.foot.rotation, "x", -l.kn.rotation.x * 0.3));
    lerp(u.arms[0].sh.rotation, "x", shL); lerp(u.arms[1].sh.rotation, "x", shR); u.arms.forEach(a => { lerp(a.el.rotation, "x", elb); a.sh.rotation.z = (a === u.arms[0] ? 1 : -1) * (air ? 0.4 : 0.12); });
    lerp(u.torsoG.rotation, "x", lean); u.torsoG.rotation.y = Math.sin(p) * 0.18; u.neck.rotation.y = -u.torsoG.rotation.y * 0.7;
    lerp(u.body.rotation, "x", bodyRotX); lerp(u.body.position, "y", bodyY);
    // A flip off a ramp or a roof: a full turn, tucked.
    if (R.flipT > 0) { const k2 = 1 - R.flipT / 0.75; u.body.rotation.x = -k2 * Math.PI * 2; u.body.position.y = 0.4 * Math.sin(k2 * Math.PI); }
    // The board's colour.
    const bc = (RUNNER_BOARDS[runnerLook().board] || RUNNER_BOARDS[0]).c, bcol = bc === "prism" ? new T.Color().setHSL((R.t * 0.4) % 1, 0.9, 0.6) : new T.Color(bc);
    u.board.children[1].material.color.copy(bcol); u.board.children[2].material.color.copy(bcol);
    u.body.rotation.z = -(R.tilt || 0) * 0.6;
    const pw = R.power && R.power.kind; u.shield.visible = pw === "shield"; u.board.visible = !!jet; u.board.position.y = 0.05; u.board.rotation.y = 0;
    if (pw) { u.aura.material.color.set(`rgb(${RUNNER_POWERS[pw].rgb})`); u.aura.material.opacity = 0.35 + Math.sin(R.t * 6) * 0.1; } else u.aura.material.opacity = 0;
    if (u.shield.visible) { u.shield.rotation.y = R.t; u.shield.material.opacity = 0.15 + Math.sin(R.t * 5) * 0.05; }
  }

  // ---------- Obstacles, coins, power-ups ----------
  const stripeTex = tex(256, 32, (g) => { for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? "#ffffff" : "#e63946"; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.lineTo(x - 16, 32); g.fill(); } });
  const hazardTex = tex(256, 64, (g) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#16181d"; for (let x = -64; x < 256; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 20, 64); g.lineTo(x + 84, 0); g.lineTo(x + 64, 0); g.fill(); } g.fillStyle = "#16181d"; g.fillRect(84, 16, 88, 32); g.fillStyle = "#f2c230"; g.font = "900 26px Inter, system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("LOW", 128, 33); });
  const stripeMat = std({ map: stripeTex, roughness: 0.5 }), hazardMat = std({ map: hazardTex, roughness: 0.5 });
  const concreteMat = std({ color: 0xd8d6d0, roughness: 0.85 }), coneMat = std({ color: 0xff6a1a, roughness: 0.5 }), whiteMat = std({ color: 0xffffff, roughness: 0.5 });
  const reflector = basic(0xff3030);
  const chevTex = tex(128, 128, (g) => { g.fillStyle = "#2b2f38"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#f2c230"; for (let y = -64; y < 128; y += 42) { g.beginPath(); g.moveTo(0, y + 30); g.lineTo(64, y); g.lineTo(128, y + 30); g.lineTo(128, y + 46); g.lineTo(64, y + 16); g.lineTo(0, y + 46); g.fill(); } });
  const rampTop = std({ map: chevTex, roughness: 0.6, metalness: 0.2 });
  const letterTex = {};
  const letterMaker = ch => () => { const g = new T.Group(); const t2 = letterTex[ch] || (letterTex[ch] = tex(128, 128, (c) => { c.fillStyle = "#ffffff"; c.font = "900 104px Inter, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "#ffd25a"; c.shadowBlur = 16; c.fillText(ch, 64, 70); })); const pl = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), new T.MeshBasicMaterial({ map: t2, color: 0xffe08a, transparent: true, toneMapped: false, side: T.DoubleSide, depthWrite: false })); g.add(pl); const ring = new T.Mesh(new T.TorusGeometry(0.85, 0.05, 10, 40), basic(0xffd25a)); g.add(ring); g.add(glow(0xffd25a, 3.2, 0.5)); return g; };
  const pools = {};
  const get = (kind, make) => { const P = pools[kind] || (pools[kind] = { list: [], used: 0 }); if (P.used >= P.list.length) { const o = make(); scene.add(o); P.list.push(o); } const o = P.list[P.used++]; o.visible = true; return o; };
  const poolsBegin = () => { for (const k in pools) pools[k].used = 0; };
  const poolsEnd = () => { for (const k in pools) { const P = pools[k]; for (let q = P.used; q < P.list.length; q++) P.list[q].visible = false; } };
  const makers = {
    hurdle: () => { const g = new T.Group(); for (const s of [-1, 1]) { const leg = new T.Mesh(boxGeo, metalDark); leg.scale.set(0.08, 1, 0.08); leg.position.set(s * 1.0, 0.5, 0); g.add(leg); const foot = new T.Mesh(boxGeo, metalDark); foot.scale.set(0.12, 0.05, 0.6); foot.position.set(s * 1.0, 0.03, 0); g.add(foot); const lt = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), reflector); lt.position.set(s * 1.0, 1.05, 0); g.add(lt); } const bar = new T.Mesh(boxGeo, stripeMat); bar.scale.set(2.2, 0.28, 0.08); bar.position.y = 0.82; g.add(bar); const bar2 = bar.clone(); bar2.position.y = 0.45; g.add(bar2); shadowAll(g); return g; },
    bar: () => { const g = new T.Group(); for (const s of [-1, 1]) { const post = new T.Mesh(boxGeo, metalDark); post.scale.set(0.14, 3.2, 0.14); post.position.set(s * 1.15, 1.6, 0); g.add(post); } const sign = new T.Mesh(boxGeo, [metalDark, metalDark, metalDark, metalDark, hazardMat, hazardMat]); sign.scale.set(2.4, 0.6, 0.12); sign.position.y = 1.5; g.add(sign); const top = new T.Mesh(boxGeo, metalDark); top.scale.set(2.5, 0.12, 0.14); top.position.y = 3.15; g.add(top); for (const s of [-1, 1]) { const l = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), basic(0xffb020)); l.position.set(s * 0.95, 1.88, 0.06); g.add(l); } shadowAll(g); return g; },
    wall: () => { const g = new T.Group(); const sh = new T.Shape(); sh.moveTo(-1.1, 0); sh.lineTo(1.1, 0); sh.lineTo(1.0, 0.3); sh.lineTo(0.35, 0.55); sh.lineTo(0.28, 1.15); sh.lineTo(-0.28, 1.15); sh.lineTo(-0.35, 0.55); sh.lineTo(-1.0, 0.3); sh.lineTo(-1.1, 0); const wrap = new T.Group(); const jw2 = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false }), concreteMat); jw2.position.set(0, 0, -0.6); jw2.scale.set(1, 1, 1); wrap.add(jw2); g.add(wrap); const st = new T.Mesh(boxGeo, stripeMat); st.scale.set(2.0, 0.22, 0.02); st.position.set(0, 0.85, 0.62); g.add(st); const board = new T.Mesh(boxGeo, [metalDark, metalDark, metalDark, metalDark, hazardMat, hazardMat]); board.scale.set(1.6, 0.55, 0.06); board.position.set(0, 1.75, 0.3); g.add(board); for (const s of [-1, 1]) { const cone = new T.Group(); const cm = new T.Mesh(new T.ConeGeometry(0.2, 0.7, 16), coneMat); cm.position.y = 0.35; cone.add(cm); const wb = new T.Mesh(new T.CylinderGeometry(0.115, 0.15, 0.12, 16), whiteMat); wb.position.y = 0.38; cone.add(wb); const base = new T.Mesh(boxGeo, coneMat); base.scale.set(0.45, 0.05, 0.45); cone.add(base); cone.position.set(s * 0.85, 0, 1.1); g.add(cone); } const blink = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), basic(0xffb020)); blink.position.set(0, 2.1, 0.3); g.add(blink); g.userData.blink = blink; shadowAll(g); return g; },
    car: () => { const g = new T.Group(); const paint = phys({ color: 0xffffff, metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }); const low = new T.Mesh(new T.BoxGeometry(1.9, 0.6, 4.2), paint); low.position.y = 0.55; g.add(low); const hood = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint); hood.scale.set(0.95, 0.35, 2.05); hood.position.y = 0.84; g.add(hood); const cab = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), phys({ color: 0x141a24, metalness: 0.3, roughness: 0.05, clearcoat: 1 })); cab.scale.set(0.82, 0.55, 1.25); cab.position.set(0, 0.86, 0.15); g.add(cab); for (const [x, z] of [[-0.92, -1.35], [0.92, -1.35], [-0.92, 1.35], [0.92, 1.35]]) { const w = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.26, 20), std({ color: 0x15171b, roughness: 0.6 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); const rim = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.27, 12), std({ color: 0xbfc5cc, metalness: 0.9, roughness: 0.2 })); rim.rotation.z = Math.PI / 2; rim.position.set(x, 0.36, z); g.add(rim); } const hl = new T.Mesh(boxGeo, basic(0xffffff)); hl.scale.set(1.5, 0.07, 0.05); hl.position.set(0, 0.72, 2.11); g.add(hl); const tl = new T.Mesh(boxGeo, basic(0xff2a3a)); tl.scale.set(1.6, 0.08, 0.05); tl.position.set(0, 0.74, -2.11); g.add(tl); for (const s of [-1, 1]) { const gl = glow(0xfff4d0, 2.2, 0.7); gl.position.set(s * 0.6, 0.72, 2.3); g.add(gl); } shadowAll(g); g.userData.paint = paint; return g; },
    tram: () => { const g = new T.Group(); const bodyM = phys({ color: 0xf4f6f8, metalness: 0.3, roughness: 0.3, clearcoat: 1 }), stripeM = std({ color: 0x00a6a6, roughness: 0.4 }), glassM = phys({ color: 0x18202c, metalness: 0.2, roughness: 0.05, clearcoat: 1, emissive: 0xffe2b0, emissiveIntensity: 0 });
      const body = new T.Mesh(boxGeo, bodyM); g.add(body); const win = new T.Mesh(boxGeo, glassM); g.add(win); const st = new T.Mesh(boxGeo, stripeM); g.add(st); const roof = new T.Mesh(boxGeo, std({ color: 0x9aa1aa, metalness: 0.6, roughness: 0.4 })); g.add(roof); const skirt = new T.Mesh(boxGeo, std({ color: 0x2b2f38, roughness: 0.6 })); g.add(skirt);
      const nose = new T.Mesh(new T.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), bodyM); nose.rotation.x = Math.PI / 2; g.add(nose); const wind = new T.Mesh(new T.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassM); wind.rotation.x = Math.PI / 2; g.add(wind);
      const lights = []; for (const s of [-1, 1]) { const l = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), basic(0xfff4d0)); g.add(l); lights.push(l); const gl = glow(0xfff1c8, 2.4, 0.7); g.add(gl); lights.push(gl); }
      const disp = new T.Mesh(boxGeo, basic(0xffa020)); g.add(disp); const panto = new T.Mesh(boxGeo, metalDark); g.add(panto);
      shadowAll(g); g.userData = { body, win, st, roof, skirt, nose, wind, lights, disp, panto, glassM }; return g; },
    coin: () => { const g = new T.Group(); const c = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.07, 28), std({ color: 0xffc83d, metalness: 1, roughness: 0.22, emissive: 0x5a3a00, emissiveIntensity: 0.6 })); c.rotation.x = Math.PI / 2; g.add(c); const inner = new T.Mesh(new T.TorusGeometry(0.24, 0.025, 8, 24), std({ color: 0xfff0b0, metalness: 1, roughness: 0.2 })); inner.position.z = 0.04; g.add(inner); const gl = glow(0xffd25a, 1.3, 0.35); g.add(gl); g.userData.gl = gl; return g; },
    up: () => { const g = new T.Group(); const ring = new T.Mesh(new T.TorusGeometry(0.55, 0.06, 10, 40), basic(0xffffff)); g.add(ring); const core = new T.Mesh(new T.IcosahedronGeometry(0.32, 1), phys({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2, clearcoat: 1 })); g.add(core); const gl = glow(0xffffff, 2.6, 0.6); g.add(gl); g.userData = { ring, core, gl }; return g; },
    spark: () => glow(0xffd25a, 0.6, 1),
    ramp: () => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(7, 0); sh.lineTo(7, 3.45); sh.lineTo(0, 0); const geo = new T.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(-1.1, 0, 0); const m2 = new T.Mesh(geo, [metalDark, rampTop]); m2.castShadow = true; m2.receiveShadow = true; const g = new T.Group(); g.add(m2); return g; },
    bus: () => { const g = makers.tram(), u = g.userData, m2 = phys({ color: 0xff8a1f, metalness: 0.3, roughness: 0.3, clearcoat: 1 }); u.body.material = m2; u.nose.material = m2; u.st.material = std({ color: 0xffffff, roughness: 0.4 }); u.panto.visible = false; u.busM = m2; return g; },
    drone: () => { const g = new T.Group(); const body = new T.Mesh(new T.SphereGeometry(0.42, 24, 14), phys({ color: 0x1f2430, metalness: 0.7, roughness: 0.25, clearcoat: 1 })); body.scale.set(1.3, 0.55, 1); g.add(body); const eye = new T.Mesh(new T.SphereGeometry(0.12, 14, 10), basic(0xff2b4a)); eye.position.set(0, -0.05, 0.42); g.add(eye); const props2 = []; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const arm = new T.Mesh(boxGeo, metalDark); arm.scale.set(0.9, 0.05, 0.06); arm.position.set(x * 0.4, 0.05, z * 0.3); arm.rotation.y = -Math.atan2(z * 0.3, x * 0.4); g.add(arm); const pr = new T.Mesh(boxGeo, std({ color: 0xbfc5cc, roughness: 0.4 })); pr.scale.set(0.7, 0.015, 0.06); pr.position.set(x * 0.8, 0.12, z * 0.6); g.add(pr); props2.push(pr); } const beam = new T.Mesh(new T.ConeGeometry(0.9, 1.6, 20, 1, true), new T.MeshBasicMaterial({ color: 0xff2b4a, transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); beam.position.y = -0.85; g.add(beam); const gl = glow(0xff2b4a, 1.2, 0.8); gl.position.set(0, -0.05, 0.5); g.add(gl); shadowAll(g); g.userData = { props: props2 }; return g; },
    arch: () => { const g = new T.Group(); for (const sd of [-1, 1]) { const p2 = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 7, 10), railMat); p2.position.set(sd * 4.8, 3.5, 0); g.add(p2); } const c = document.createElement("canvas"); c.width = 512; c.height = 64; const t2 = new T.CanvasTexture(c); t2.encoding = T.sRGBEncoding; const ban = new T.Mesh(new T.PlaneGeometry(9.6, 1.2), new T.MeshBasicMaterial({ map: t2, toneMapped: false, transparent: true, side: T.DoubleSide })); ban.position.y = 6.4; g.add(ban); g.userData = { c, t2, txt: "" }; return g; },
  };
  const CAR_COL = [0xffffff, 0xd62839, 0x1b1f27, 0xf2c230, 0x3a86ff];

  // ---------- Size ----------
  let W0 = 0, H0 = 0, dpr0 = 0, last = 0, onFail = false, lastM = null;
  function size(W, H) {
    const dpr = Math.min(lite ? 1.25 : 2.25, window.devicePixelRatio || 1);
    if (W === W0 && H === H0 && dpr === dpr0) return;
    W0 = W; H0 = H; dpr0 = dpr; renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  const v3 = new T.Vector3();
  let adT = 0;

  function draw(ctx2d, W, H, P) {
    if (onFail) return null;
    const R = run, m = runnerM(), t = R.t, c2 = ctx2d.canvas;
    if (view.parentNode !== c2.parentNode) c2.parentNode.insertBefore(view, c2);
    size(W, H);
    const now = performance.now(), dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const night = P.night, day = 1 - night, Z = z => -(z - m), blackout = !!P.blackout;
    // Camera: behind and above, easing after the runner; wider when fast.
    const fit = Math.max(1, 0.56 / (W / H));
    camera.fov = 60 + Math.min(10, (R.v || 12) - 12) * 0.6; camera.updateProjectionMatrix();
    const cx = (camera.userData.x ?? 0) + (R.px * 0.65 - (camera.userData.x ?? 0)) * Math.min(1, dt * 5); camera.userData.x = cx;
    const cy = (camera.userData.y ?? 3.1) + ((3.1 + R.py * 0.55 - (R.kick || 0) * 0.8) - (camera.userData.y ?? 3.1)) * Math.min(1, dt * 6); camera.userData.y = cy;
    const sh = R.shake > 0 ? R.shake * 0.25 : 0;
    camera.position.set(cx + (Math.random() - 0.5) * sh, cy + (Math.random() - 0.5) * sh, 5.6 * fit);
    camera.lookAt(cx * 0.85, 1.1 + R.py * 0.4, -10);
    // Sky, light and weather.
    skyU.top.value.copy(C(P.sky[0])); skyU.mid.value.copy(C(P.sky[1])); skyU.bot.value.copy(C(P.sky[2]));
    sky.position.copy(camera.position);
    scene.fog.color.copy(C(P.sky[2])).lerp(C(P.sky[1]), 0.3); scene.fog.near = 50; scene.fog.far = 175 + night * 40;
    hemi.color.copy(C(P.sky[1])).lerp(new T.Color(1, 1, 1), 0.55); hemi.groundColor.copy(C(P.tower)).multiplyScalar(0.45); hemi.intensity = 0.35 + day * 0.6;
    sun.color.copy(C(P.sky[2])).lerp(new T.Color(1, 1, 1), 0.55); sun.intensity = 0.25 + day * 1.4;
    sun.target.position.set(0, 0, -12); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60);
    stars.material.opacity = Math.max(0, night - 0.35) / 0.65; stars.position.copy(camera.position);
    sunSpr.material.opacity = day * 0.9; sunSpr.position.set(110, 160, -330);
    moon.visible = night > 0.3; moon.material.opacity = Math.max(0, night - 0.3) / 0.7; moon.position.set(-90, 150, -330);
    clouds.forEach(cl => { cl.s.position.set(cl.x + Math.sin(t * 0.02 + cl.y) * 10, cl.y, cl.z); cl.s.scale.set(cl.w, cl.w * 0.45, 1); cl.s.material.opacity = Math.max(0, 0.8 - night) ; cl.s.material.color.copy(C(P.sky[2])).lerp(new T.Color(1, 1, 1), 0.55); });
    try { skyEnv(P, night); } catch (e) { scene.environment = null; }
    roadTex.offset.y = roadRM.offset.y = (m / ROAD_TILE) % 1; paveTex.offset.y = (m / 4) % 1;
    const wet = P.rain ? 1 : 0;
    roadMat.roughness = 1 - wet * 0.65; roadMat.envMapIntensity = 0.6 + wet * 1.4; roadMat.color.setScalar(1 - wet * 0.25);
    rain.visible = !!P.rain;
    if (P.rain) { for (let q = 0; q < rainN; q++) { const s = rainSeed[q], x = (s[0] - 0.5) * 30 + cx, z = 4 - s[1] * 60, y = 18 - ((s[2] * 22 + t * 26) % 22); rainPos.set([x, y, z, x - 0.05, y - 0.8, z], q * 6); } rainGeo.attributes.position.needsUpdate = true; }
    // A new run (or a jump back): clear the old street and start again here.
    if (lastM == null || m < lastM - 30 || m > lastM + 400) {
      for (const side of [-1, 1]) { sides[side].list.forEach(b => scene.remove(b.g)); sides[side].list = []; sides[side].next = m - 30 + (side > 0 ? 8 : 0); }
      props.forEach(sl => sl.out.forEach(o => scene.remove(o))); props.length = 0; nextSlot = Math.floor((m - 12) / SLOT);
    }
    lastM = m;
    // Buildings: keep each side filled ahead, drop what's behind.
    for (const side of [-1, 1]) {
      const S = sides[side];
      while (S.next < m + 210) { const n = Math.floor(S.next * 13.37 + side * 1000); const b = makeBuilding(side, S.next, n); S.list.push(b); S.next += b.len; }
      S.list = S.list.filter(b => { if (b.z0 + b.len < m - 20) { scene.remove(b.g); b.g.traverse(o => { if (o.geometry && o.geometry !== boxGeo && o.geometry.type !== "PlaneGeometry") o.geometry.dispose(); }); return false; } return true; });
      for (const b of S.list) { b.g.position.z = Z(b.z0 + b.len / 2); if (b.g.userData.boat) { const bt = b.g.userData.boat; bt.position.y = -0.4 + Math.sin(t * 1.2 + b.z0) * 0.12; bt.rotation.z = Math.sin(t * 0.9 + b.z0) * 0.04; } if (b.g.userData.neon) b.g.userData.neon.color.set(b.g.userData.neonCol).multiplyScalar(0.55 + night * 0.9 + (Math.sin(t * 9 + b.z0) > 0.97 ? -0.4 : 0)); }
    }
    FAC.forEach(f => { f.mat.emissiveIntensity = blackout ? 0 : night * 1.1; f.mat.color.copy(C(P.tower)).lerp(new T.Color(1, 1, 1), 0.55 + day * 0.25); });
    shopMats.forEach(s => (s.emissiveIntensity = blackout ? 0.02 : 0.12 + night * 0.85));
    if (blackout) { hemi.intensity = 0.12; sun.intensity = 0.05; }
    adT += dt; if (adT > 1 / 15) { adT = 0; paintAds(t); }
    // Sidewalk slots.
    while (nextSlot * SLOT < m + 150) { props.push(fillSlot(nextSlot)); nextSlot++; }
    for (let q = props.length - 1; q >= 0; q--) { const sl = props[q]; if (sl.n * SLOT < m - 15) { sl.out.forEach(o => scene.remove(o)); props.splice(q, 1); } }
    const cheer = R.cheerT > 0;
    for (const sl of props) for (const o of sl.out) {
      const u = o.userData; let z = sl.n * SLOT + (u.baseZ || 0);
      if (u.legs) {
        if (u.walk && !cheer) { u.walked = (u.walked || 0) + dt * u.speed * u.dir; z -= u.walked; const ph = t * 6 * u.speed + u.ph; u.legs[0].rotation.x = Math.sin(ph) * 0.5; u.legs[1].rotation.x = -Math.sin(ph) * 0.5; u.arms[0].rotation.x = -Math.sin(ph) * 0.4; u.arms[1].rotation.x = Math.sin(ph) * 0.4; o.position.y = 0.18; }
        else if (cheer) { o.rotation.y = u.side > 0 ? -Math.PI / 2 : Math.PI / 2; const j = Math.abs(Math.sin(t * 9 + u.ph)); o.position.y = 0.18 + j * 0.25; u.arms[0].rotation.set(0, 0, -2.7 + j * 0.3); u.arms[1].rotation.set(0, 0, 2.7 - j * 0.3); u.legs[0].rotation.x = u.legs[1].rotation.x = 0; }
        else { u.arms[0].rotation.set(0.1 * Math.sin(t + u.ph), 0, 0); u.arms[1].rotation.set(0, 0, 0); o.position.y = 0.18; }
      }
      if (u.glow) u.glow.material.opacity = blackout ? 0 : night * 0.55;
      if (u.glows) u.glows.forEach(gl => (gl.material.opacity = 0.15 + night * 0.7));
      o.position.z = Z(z);
    }
    // Flying traffic.
    flyers.forEach(f => { f.z += (f.v + (R.v || 12)) * dt; if (f.z > 40) f.z -= 400; if (f.z < -360) f.z += 400; f.g.position.set(f.x, f.y + Math.sin(t + f.x) * 0.5, f.z); f.g.rotation.y = f.v > 0 ? 0 : Math.PI; });
    // Birds by day.
    birds.forEach((b, q) => { const fz = -60 - ((t * 9 + b.off[2]) % 160), fx = 20 - ((t * 4 + b.off[2]) % 60); b.g.visible = day > 0.4; b.g.position.set(fx + b.off[0], 26 + b.off[1], fz); const fl = Math.sin(t * 12 + q) * 0.6; b.g.userData[-1].rotation.y = fl; b.g.userData[1].rotation.y = -fl; });
    // Fireworks.
    let fi = 0;
    for (const f of R.fireworks) { const r = seeded(Math.floor(f.seed * 1e6)); for (let b = 0; b < 3; b++) { const bx = (r() - 0.5) * 40, by = 35 + r() * 20, bz = -60 - r() * 40, col = new T.Color().setHSL(r(), 0.9, 0.6), tt = Math.max(0, f.t - b * 0.35); for (let q = 0; q < 120 && fi < fwN; q++, fi++) { const a = r() * Math.PI * 2, e = (r() - 0.5) * Math.PI, sp = 10 + r() * 6, d = sp * Math.min(tt, 1.6) * (1 - tt * 0.15); fwPos.set([bx + Math.cos(a) * Math.cos(e) * d, by + Math.sin(e) * d - tt * tt * 2, bz + Math.sin(a) * Math.cos(e) * d], fi * 3); const k = tt > 0 ? Math.max(0, 1 - tt / 2.4) : 0; fwCol.set([col.r * k, col.g * k, col.b * k], fi * 3); } } }
    for (; fi < fwN; fi++) fwCol.set([0, 0, 0], fi * 3);
    fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true;
    // The runner.
    const lk2 = JSON.stringify(runnerLook());
    if (lk2 !== lookKey) { lookKey = lk2; scene.remove(hero); hero = makeRunner(runnerLook()); scene.add(hero); buildGhost(); }
    animateRunner(R, dt);
    // The ghost: where today's best daily run was at this distance.
    const gv = R.ghost && !R.attract ? R.ghost[Math.floor(m)] : null;
    ghost.visible = gv != null;
    if (gv != null) { for (const [a, b] of ghostPairs) if (a !== hero) { b.rotation.copy(a.rotation); b.position.copy(a.position); } const gl = (gv % 3) - 1, gp = Math.floor(gv / 3) / 2; ghost.position.x += (laneX(gl) - ghost.position.x) * Math.min(1, dt * 12); ghost.position.y = gp; ghost.position.z = -0.6; }
    const blink = R.inv > 0.3 && Math.floor(R.inv * 12) % 2;
    hero.visible = !blink; hero.position.set(R.px, R.py, 0); hero.rotation.y = 0;
    const gy = R.gnd || 0; blob.position.set(R.px, gy + 0.02, 0); blob.material.opacity = 0.28 * Math.max(0, 1 - (R.py - gy) / 4); blob.scale.setScalar(1 - Math.min(0.5, (R.py - gy) / 8));
    // Obstacles, coins, power-ups.
    poolsBegin();
    for (const o of R.obs) {
      const z = Z(o.z); if (z < -200 || z > 20) continue;
      const x = laneX(o.lane);
      if (o.smash) { o.smash += dt; if (o.smash > 0.6) continue; }
      const g = get(o.kind, makers[o.kind]);
      if (o.kind === "ramp") { g.position.set(x, 0, Z(o.z)); continue; }
      if (o.kind === "drone") { g.position.set(x, 1.65 + Math.sin(t * 3 + o.ph) * 0.06, Z(o.z + 0.4)); g.rotation.set(0, 0, Math.cos(t * 1.25 + o.ph) * 0.25); g.userData.props.forEach((p2, q) => (p2.rotation.y = t * 40 + q)); continue; }
      if (o.kind === "tram" || o.kind === "bus") {
        const u = g.userData, L = o.len, mid = Z(o.z + L / 2);
        if (u.busM) u.busM.color.set([0xff8a1f, 0x2a9d8f, 0xd62839][o.color || 0]);
        g.position.set(x, 0, mid); g.rotation.set(0, 0, 0);
        u.body.scale.set(2.3, 2.2, L - 1.6); u.body.position.set(0, 1.55, 0);
        u.win.scale.set(2.34, 0.85, L - 2.4); u.win.position.set(0, 2.05, 0); u.glassM.emissiveIntensity = night * 0.9;
        u.st.scale.set(2.36, 0.18, L - 1.8); u.st.position.set(0, 1.25, 0);
        u.skirt.scale.set(2.1, 0.45, L - 1.2); u.skirt.position.set(0, 0.3, 0);
        u.roof.scale.set(1.6, 0.25, L - 3); u.roof.position.set(0, 2.78, 0);
        u.nose.scale.set(1.15, 0.8, 1.1); u.nose.position.set(0, 1.55, (L - 1.6) / 2); u.nose.scale.y = 1.1;
        u.wind.scale.set(1.0, 0.55, 0.85); u.wind.position.set(0, 2.0, (L - 1.6) / 2 + 0.2);
        u.lights[0].position.set(-0.7, 0.95, (L - 1.6) / 2 + 0.95); u.lights[1].position.copy(u.lights[0].position).setZ(u.lights[0].position.z + 0.2); u.lights[2].position.set(0.7, 0.95, (L - 1.6) / 2 + 0.95); u.lights[3].position.copy(u.lights[2].position).setZ(u.lights[2].position.z + 0.2);
        u.lights[1].material.opacity = u.lights[3].material.opacity = o.v ? 0.9 : 0.25 + night * 0.4;
        u.disp.scale.set(1.0, 0.2, 0.05); u.disp.position.set(0, 2.6, (L - 1.6) / 2 + 0.55);
        u.panto.scale.set(0.08, 0.8, 1.2); u.panto.position.set(0, 3.2, -L * 0.2); u.panto.rotation.x = 0.6;
        g.scale.y = o.kind === "bus" ? 1.06 : 1;
        continue;
      }
      g.position.set(x, 0, Z(o.z + o.len / 2)); g.rotation.set(0, 0, 0);
      if (o.smash) { g.position.y = o.smash * 4; g.rotation.set(o.smash * 6, o.smash * 4, 0); }
      if (o.kind === "car") { g.userData.paint.color.set(CAR_COL[o.color || 0]); g.position.y = Math.sin(t * 20 + o.id * 9) * 0.01; }
      if (o.kind === "wall") g.userData.blink.visible = Math.sin(t * 6 + o.id * 10) > 0;
    }
    for (const c of R.coins) {
      const z = Z(c.z); if (z < -150 || z > 8) continue;
      const g = get("coin", makers.coin), x = c.mx ?? laneX(c.lane);
      if (c.got) { const k = c.t / 0.35; g.position.set(x + (R.px - x) * k, c.y + k * 1.2, z); g.scale.setScalar(1 - k * 0.7); g.rotation.y = t * 20; continue; }
      g.scale.setScalar(1); g.position.set(x, c.y + Math.sin(t * 3 + c.z) * 0.06, z); g.rotation.y = t * 3 + c.z * 0.3; g.userData.gl.material.opacity = 0.2 + night * 0.4;
    }
    for (const u of R.ups) {
      const z = Z(u.z); if (z < -150 || z > 8) continue;
      if (u.kind === "letter") { const g = get("letter_" + u.ch, letterMaker(u.ch)); g.position.set(laneX(u.lane), 1.4 + Math.sin(t * 3) * 0.15, z); g.rotation.y = Math.sin(t * 2) * 0.5; continue; }
      const g = get("up", makers.up), col = new T.Color(`rgb(${RUNNER_POWERS[u.kind].rgb})`);
      g.position.set(laneX(u.lane), 1.2 + Math.sin(t * 3) * 0.12, z); g.userData.ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.3, t * 2, 0); g.userData.core.rotation.set(t, t * 1.3, 0);
      g.userData.core.material.color.copy(col); g.userData.core.material.emissive.copy(col); g.userData.ring.material.color.copy(col).multiplyScalar(1.5); g.userData.gl.material.color.copy(col);
    }
    for (const p of R.pops || []) { if (p.t > 0.5) continue; for (let q = 0; q < 6; q++) { const g = get("spark", makers.spark), a = q / 6 * Math.PI * 2, d = p.t * 4; g.position.set(R.px + Math.cos(a) * d, 1.2 + Math.sin(a) * d, -1); g.material.opacity = 1 - p.t * 2; } }
    // Your best distance: an arch across the avenue.
    const bestM = (save.run && save.run.bestM) || 0;
    if (!R.attract && bestM > 40 && bestM > m - 5 && bestM < m + 180) {
      const a = get("arch", makers.arch), txt = `BEST  ${bestM.toLocaleString()} m`;
      if (a.userData.txt !== txt) { a.userData.txt = txt; const c = a.userData.c.getContext("2d"); c.clearRect(0, 0, 512, 64); c.fillStyle = "rgba(14,16,24,0.85)"; c.fillRect(0, 0, 512, 64); c.fillStyle = "#ffd25a"; c.fillRect(0, 60, 512, 4); c.fillStyle = "#ffffff"; c.font = "900 38px Inter, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 256, 32); a.userData.t2.needsUpdate = true; }
      a.position.set(0, 0, Z(bestM));
    }
    // The chase: a security drone right behind you.
    if (R.ev && R.ev.kind === "chase") {
      if (!chaser) { chaser = makers.drone(); chaser.scale.setScalar(0.9); scene.add(chaser); }
      chaser.visible = true; const gap = R.ev.gap; chaser.position.set(R.px * 0.85 + Math.sin(t * 2) * 0.3, 3.3 + gap * 0.5 + Math.sin(t * 3) * 0.15, 0.2 + gap * 1.1); chaser.rotation.set(-0.35, 0, Math.sin(t * 2) * 0.2); chaser.userData.props.forEach((p2, q) => (p2.rotation.y = t * 40 + q));
    } else if (chaser) chaser.visible = false;
    poolsEnd();
    try { renderer.render(scene, camera); } catch (e) { console.warn("runner render failed", e); onFail = true; view.remove(); return null; }
    return (x, at) => { v3.set(R.px, (at === R.dist ? 2.2 : 1.6) + R.py, Math.min(-0.3, Z(at / RUN.M))).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
  }
  function hide() { if (view.parentNode) view.remove(); }
  function destroy() { hide(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
  return { draw, hide, destroy, get pxU() { return 1.2; }, scene, renderer, lite };
}

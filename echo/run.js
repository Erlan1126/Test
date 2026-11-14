// Echo: the endless run. Lumi glides up an endless glowing cave toward the surface, toward home.
// Slide a finger to steer. Trails of golden lights play a melody as you gather them. Shadows
// (Hushlings) drift in the cave: tap to sing, and the ones your song reaches turn back into
// light; if one touches you first, Lumi's light dims (three touches and the run rests). Every
// few hundred metres the cave becomes a new world. Missions raise your score multiplier; the
// lights you gather buy upgrades and light up the Singer's city.
"use strict";

const RUN = {
  BIOME_M: 350,                  // metres per world
  M: 40,                         // world units per metre
  missions: [
    { kind: "lights", goal: 40, text: n => `Gather ${n} lights in one run` },
    { kind: "dist", goal: 400, text: n => `Reach ${n} m` },
    { kind: "free", goal: 6, text: n => `Sing ${n} shadows back into light in one run` },
    { kind: "nohit", goal: 300, text: n => `Reach ${n} m without being touched` },
    { kind: "trail", goal: 3, text: n => `Gather ${n} whole light trails in one run` },
    { kind: "biome", goal: 2, text: n => `Reach world ${n}` },
  ],
  upgrades: [
    { id: "magnet", name: "Magnet", tiers: [40, 90, 160], tip: lv => lv ? `Pulls in lights from ${40 + lv * 30} away` : "Lights drift toward Lumi" },
    { id: "song", name: "Bigger song", tiers: [50, 110, 190], tip: lv => `Song reaches ${150 + lv * 28}, recharges in ${(1.1 - lv * 0.2).toFixed(1)} s` },
    { id: "heart", name: "Brighter heart", tiers: [120], tip: lv => `Start each run with ${3 + lv} lights of your own` },
  ],
};
const runUpg = id => ((save.run || {}).upg || {})[id] || 0;
function runSave() {
  save.run = save.run || {};
  const r = save.run;
  r.best = r.best || 0; r.mult = r.mult || 1; r.lights = r.lights || 0; r.upg = r.upg || {}; r.runs = r.runs || 0;
  if (!r.missions) r.missions = [0, 1, 2].map(k => ({ k, goal: RUN.missions[k].goal, done: false }));
  return r;
}

// ---------- The cave ----------
// The passage at distance a: its middle wanders, its width breathes, and it narrows slowly.
const caveMid = a => 200 + 72 * Math.sin(a * 0.0021) + 38 * Math.sin(a * 0.0057 + 1.3) + 14 * Math.sin(a * 0.013);
const caveHalf = (a, d) => Math.max(92, 150 - Math.min(52, d * 0.0016) + 24 * Math.sin(a * 0.0033 + 0.7));

let run = null;
function startRun(opts = {}) {
  audio();
  const r = runSave();
  const daily = !!opts.daily;
  run = {
    daily, rng: daily ? seeded(dayNumber() * 7919 + 13) : null, attract: !!opts.attract,
    combo: 0, comboBest: 0, comboT: 0, boost: 0, dashCd: 0, dashT: 0, power: null, event: null, nextEvent: 250, hunterGap: 1, pops: [], banner2: null, friendSpawned: false,
    dist: 0, speed: 170, x: caveMid(0), tx: caveMid(0), vx: 0, hearts: 3 + runUpg("heart"), inv: 0, over: 0,
    lights: 0, freed: 0, songs: 0, hitAt: 0, trails: 0, songCd: 0, rings: [], items: [], parts: [], trail: [],
    next: 260, note: 0, biome: 0, banner: 1.5, flash: 0, t: 0, mult: r.mult, paused: false, nohit: true,
  };
  if (opts.attract) { run.hearts = 1e9; return run; }
  for (const m of r.missions) m.run = 0;
  mood = MOODS[0];
  musicStart(4242, 2);
  show("run");
  $("runOver").hidden = true; $("runPause").hidden = true;
  runHud();
  requestAnimationFrame(runLoop);
}
const runMetres = () => Math.floor(run.dist / RUN.M);
const runScore = () => Math.floor(run.dist / RUN.M * run.mult + run.lights * 2 * run.mult);

// What comes next in the cave: a trail of lights, drifting shadows, a rock, now and then a heart.
function runSpawn(at) {
  const extra = runSpawnExtra(at);
  if (extra) return extra;
  const R = runR, mid = caveMid(at), hw = caveHalf(at, run.dist);
  const roll = R(), hard = Math.min(1, run.dist / 40000);
  if (roll < 0.46) {
    const n = 7 + Math.floor(R() * 6), amp = hw * (0.25 + R() * 0.35), ph = R() * 6, id = R();
    for (let q = 0; q < n; q++) { const a = at + q * 34; run.items.push({ type: "light", at: a, x: caveMid(a) + Math.sin(ph + q * 0.5) * amp, trail: id, of: n }); }
    return n * 34 + 80;
  }
  if (roll < 0.8) {
    const n = R() < 0.25 + hard * 0.4 ? 2 : 1;
    for (let q = 0; q < n; q++) run.items.push({ type: "shadow", at: at + q * 70, x: mid + (R() - 0.5) * hw * 1.1, ph: R() * 6, amp: 20 + R() * 40 + hard * 30 });
    return 200 + R() * 90 - hard * 50;
  }
  if (roll < 0.96) { run.items.push({ type: "rock", at, x: mid + (R() - 0.5) * hw * 0.9, r: 18 + R() * 16, seed: R() * 99 }); return 170 + R() * 80; }
  run.items.push({ type: "heart", at, x: mid + (R() - 0.5) * hw * 0.6 });
  return 160;
}

function runSing() {
  if (!run || run.over || run.paused || (run.songCd > 0 && !(run.power && run.power.kind === "choir"))) return;
  run.songCd = 1.1 - runUpg("song") * 0.2;
  run.songs++;
  run.rings.push({ x: run.x, at: run.dist, r: 0, max: 150 + runUpg("song") * 28 });
  if (!run.attract) { sfx.ping(run.songs); buzz(8); }
  runMission("songs", run.songs);
}
function runHit() {
  run.hearts--; run.inv = 1.6; run.flash = 1; run.nohit = false; run.hitAt = runMetres(); run.shake = 1;
  sfx.caught(); buzz([30, 40, 30]);
  if (run.hearts <= 0) runEnd();
}
function runMission(kind, value) {
  if (run.attract) return;
  const r = save.run;
  for (const m of r.missions) {
    const def = RUN.missions[m.k];
    if (def.kind !== kind || m.done || value < m.goal) continue;
    m.done = true; r.mult = Math.min(10, r.mult + 1); run.mult = r.mult;
    run.missionMsg = { text: `Mission done! ×${r.mult}`, t: 2.5 }; sfx.unlock(); buzz([10, 30, 10]);
    // A new, a little harder, mission takes its place.
    const k = Math.floor(Math.random() * RUN.missions.length);
    Object.assign(m, { k, goal: Math.round(RUN.missions[k].goal * (1 + 0.5 * (r.mult - 1))), done: false });
  }
}
function runEnd() {
  run.over = 0.001;
  const r = save.run, score = runScore(), best = score > r.best;
  if (best) r.best = score;
  r.lights += run.lights; r.runs++;
  if (run.daily) { r.dailyDay = dayNumber(); r.dailyBest = Math.max(r.dailyDay === dayNumber() ? r.dailyBest || 0 : 0, score); }
  save.glow = (save.glow || 0) + run.lights;
  persist();
  musicStop(); sfx.fail();
  setTimeout(() => {
    if (!run) return;
    $("runOverScore").textContent = score.toLocaleString();
    $("runOverBest").textContent = best ? "A new best!" : `Best ${r.best.toLocaleString()}`;
    $("runOverInfo").textContent = `${runMetres()} m · ✦ ${run.lights} lights · best combo ${run.comboBest}` + (run.friendFound ? ` · found ${run.friendFound}` : "");
    $("runOverTitle").textContent = run.daily ? "Daily run" : "Lumi rests";
    runMissions($("runOverMissions")); runShop();
    $("runOver").hidden = false;
  }, 900);
}
function runMissions(el) {
  const r = runSave();
  el.innerHTML = r.missions.map(m => `<li>${RUN.missions[m.k].text(m.goal)}</li>`).join("") + `<li class="mult">Score multiplier ×${r.mult}</li>`;
}
function runHud() {
  if (run.attract) return;
  $("runScore").textContent = runScore().toLocaleString();
  $("runLights").textContent = `✦ ${run.lights}`;
  $("runHearts").textContent = "●".repeat(Math.max(0, run.hearts)) + "○".repeat(Math.max(0, 3 + runUpg("heart") - run.hearts));
  $("runMult").textContent = `×${run.mult}`;
  $("runPower").textContent = run.power ? `${RUN_POWERS[run.power.kind].name} ${Math.ceil(run.power.t)}` : "";
}

// ---------- Variety: worlds, big moments, power-ups, friends ----------
// Each world adds its own hazard: currents (Mossy Hollow), crystal gates (Amethyst Deep), lava
// bursts (Ember Caverns), falling icicles (Frost Tunnels), bubbles to ride (Coral Depths),
// swinging lanterns (Golden Mines) and a Lurker's sweeping eye (Starlight Abyss).
const RUN_POWERS = {
  comet: { name: "Comet", dur: 5, rgb: "255,210,120", tip: "Unstoppable!" },
  magnet: { name: "Magnet", dur: 8, rgb: "255,170,230", tip: "Lights fly to you" },
  lantern: { name: "Lantern", dur: 10, rgb: "255,240,190", tip: "Double lights, no dark" },
  choir: { name: "Choir", dur: 8, rgb: "170,240,255", tip: "Singing by itself" },
};
const RUN_EVENTS = {
  dark: { dur: 14, banner: "Darkness falls", sub: "Sing to see the walls" },
  rush: { dur: 8, banner: "Rush!", sub: "The current takes you" },
  hunter: { dur: 16, banner: "Something is chasing you", sub: "Stay fast. Dash to get away" },
};
// Friends lost in the caves: find one floating in a run and it moves into your city.
const RUN_FRIENDS = [
  { name: "Nim", says: "I've been floating down there forever. Thanks for the lift!" },
  { name: "Bo", says: "Did you see the bubbles? I rode one all the way up. Well, halfway." },
  { name: "Juniper", says: "The moss sings, if you listen. Very quietly." },
  { name: "Quill", says: "I counted every crystal. There are a lot." },
  { name: "Soot", says: "It was warm by the lava. Too warm. Much too warm." },
  { name: "Frost", says: "I'm not cold. I'm just very, very still." },
  { name: "Ripple", says: "Bubbles! Bubbles everywhere! Is it always like this up here?" },
  { name: "Copper", says: "The lanterns kept swinging. I kept ducking." },
  { name: "Vela", says: "That eye looked at me for a hundred years. I looked back." },
  { name: "Dot", says: "I'm the smallest light in the whole city. Hi!" },
  { name: "Wisp", says: "I used to be a shadow. You sang to me." },
  { name: "Hollis", says: "Home. I'd almost forgotten the word." },
];
const runR = () => (run && run.rng ? run.rng() : Math.random());
const worldAt = at => Math.floor(at / RUN.M / RUN.BIOME_M);

function runHazard(at, w, mid, hw) {
  const R = runR;
  switch (w % 8) {
    case 1: run.items.push({ type: "current", at, len: 320, dir: R() < 0.5 ? -1 : 1 }); return 380;
    case 2: run.items.push({ type: "gate", at, ph: R() * 6 }); return 260;
    case 3: run.items.push({ type: "lava", at, side: R() < 0.5 ? -1 : 1, ph: R() * 6 }); return 240;
    case 4: run.items.push({ type: "ice", at, x: mid + (R() - 0.5) * hw * 1.2 }); return 170;
    case 5: run.items.push({ type: "bubble", at, x: mid + (R() - 0.5) * hw * 0.9, ph: R() * 6 }); return 200;
    case 6: run.items.push({ type: "lantern", at, ph: R() * 6 }); return 250;
    case 7: run.items.push({ type: "eye", at, side: R() < 0.5 ? -1 : 1, ph: R() * 6, burn: 0 }); return 320;
    default: run.items.push({ type: "rock", at, x: mid + (R() - 0.5) * hw * 0.9, r: 18 + R() * 16, seed: R() * 99 }); return 180;
  }
}
// Called by runSpawn before the usual lights, shadows and rocks.
function runSpawnExtra(at) {
  const R = runR, mid = caveMid(at), hw = caveHalf(at, run.dist), w = worldAt(at);
  // A lost friend, once a run, somewhere past 300 m.
  const met = save.runFriends || {}, left = RUN_FRIENDS.map((_, i) => i).filter(i => !met[i]);
  if (!run.friendSpawned && at / RUN.M > 300 && left.length && R() < 0.08) {
    run.friendSpawned = true;
    run.items.push({ type: "friend", at, x: mid + (R() - 0.5) * hw * 0.8, idx: left[Math.floor(R() * left.length)] });
    return 160;
  }
  // Rush: tight rows of lights.
  if (run.event && run.event.kind === "rush") {
    const id = R();
    for (let q = 0; q < 12; q++) { const a = at + q * 26; run.items.push({ type: "light", at: a, x: caveMid(a) + Math.sin(q * 0.4) * hw * 0.4, trail: id, of: 12 }); }
    return 12 * 26 + 30;
  }
  const roll = R();
  if (roll < 0.06) { const kinds = Object.keys(RUN_POWERS); run.items.push({ type: "power", at, x: mid + (R() - 0.5) * hw * 0.7, kind: kinds[Math.floor(R() * kinds.length)] }); return 170; }
  if (roll < 0.06 + (w > 0 ? 0.26 : 0.12)) return runHazard(at, w, mid, hw);
  return 0;
}

function runDash() {
  if (!run || run.over || run.paused || run.dashCd > 0 || run.attract) return;
  run.dashCd = 2.5; run.boost = Math.max(run.boost, 0.45); run.dashT = 0.45;
  if (run.event && run.event.kind === "hunter") run.hunterGap = Math.min(1, run.hunterGap + 0.18);
  // A dash is loud: shadows nearby turn toward you.
  for (const it of run.items) if (it.type === "shadow" && !it.freed && Math.abs(it.at - run.dist) < 260) it.x += Math.sign(run.x - (it.cx ?? it.x)) * 40;
  sfx.dash(); buzz(12);
  for (let k = 0; k < 14; k++) run.parts.push({ x: run.x + (Math.random() - 0.5) * 16, at: run.dist - 10, vx: (Math.random() - 0.5) * 50, va: -80 - Math.random() * 120, life: 0.5 });
}
function runBonus(text, lights, at = run.dist + 30, x = run.x) {
  run.lights += lights; run.pops.push({ text, x, at, t: 0 });
}
function runPower(kind) {
  run.power = { kind, t: RUN_POWERS[kind].dur };
  run.banner2 = { text: `${RUN_POWERS[kind].name}! ${RUN_POWERS[kind].tip}`, t: 2 };
  sfx.unlock(); buzz([10, 20, 10]);
}
function runStartEvent() {
  const kinds = Object.keys(RUN_EVENTS), k = kinds[Math.floor(runR() * kinds.length)];
  run.event = { kind: k, t: RUN_EVENTS[k].dur };
  run.banner2 = { text: RUN_EVENTS[k].banner, sub: RUN_EVENTS[k].sub, t: 2.6 };
  if (k === "hunter") { run.hunterGap = 1; sfx.gloomWake(0, true); }
  if (k === "dark") sfx.deepBreath(0);
  if (k === "rush") sfx.gate();
  buzz([20, 30, 20]);
}
function runEndEvent() {
  const k = run.event.kind;
  if (k === "hunter") runBonus("Escaped! +30 ✦", 30);
  if (k === "dark") runBonus("Through the dark! +15 ✦", 15);
  run.event = null; run.nextEvent = runMetres() + 260 + Math.floor(runR() * 120);
}

// Per frame: hazards, power-ups, the big moment under way, near misses, combos.
function runTick(dt) {
  const R = run, quiet = R.attract;
  R.boost = Math.max(0, R.boost - dt); R.dashCd = Math.max(0, R.dashCd - dt); R.dashT = Math.max(0, R.dashT - dt);
  if (R.comboT > 0) R.comboT -= dt;
  if (R.banner2) { R.banner2.t -= dt; if (R.banner2.t <= 0) R.banner2 = null; }
  // Power-ups.
  if (R.power) {
    R.power.t -= dt;
    if (R.power.kind === "choir" && (R.choirT = (R.choirT || 0) - dt) <= 0) { R.choirT = 0.7; R.songCd = 0; runSing(); }
    if (R.power.t <= 0) R.power = null;
  }
  // The big moments, one every few hundred metres.
  if (!R.event && runMetres() >= R.nextEvent && !quiet) runStartEvent();
  if (R.event) {
    R.event.t -= dt;
    if (R.event.kind === "hunter") {
      R.hunterGap -= dt * 0.07 * (R.speed < 260 ? 1.6 : 1);
      if (R.hunterGap <= 0) { R.hunterGap = 0.55; if (R.inv <= 0 && !(R.power && R.power.kind === "comet")) runHit(); }
    }
    if (R.event.t <= 0) runEndEvent();
  }
  const comet = R.power && R.power.kind === "comet";
  for (const it of R.items) {
    if (it.gone) continue;
    const dy = it.at - R.dist;
    if (dy > 400 || dy < -200) continue;
    const mid = caveMid(it.at), hw = caveHalf(it.at, R.dist), t = R.t;
    let hit = false;
    if (it.type === "current" && dy < 0 && dy > -it.len) R.vx += it.dir * 380 * dt;
    if (it.type === "gate" && Math.abs(dy) < 9) { const gap = 34 + 30 * (0.5 + 0.5 * Math.sin(t * 1.6 + it.ph)); if (Math.abs(R.x - mid) > gap) hit = true; }
    if (it.type === "lava") { it.len = hw * 1.5 * Math.max(0, Math.sin(t * 1.3 + it.ph)) ** 2; const wall = mid + it.side * hw; if (Math.abs(dy) < 13 && it.len > 25 && (it.side < 0 ? R.x < wall + it.len : R.x > wall - it.len)) hit = true; }
    if (it.type === "ice") { if (dy < 320) it.at -= dt * 260; if (Math.hypot(it.x - R.x, it.at - R.dist) < 16) hit = true; }
    if (it.type === "bubble" && !it.used && Math.hypot(it.x - R.x, dy) < 26) { it.used = true; it.gone = true; R.boost = Math.max(R.boost, 1.3); if (!quiet) { note(880, { dur: 0.3, vol: 0.06, glide: 1400, echo: 0.6 }); runBonus("Bubble ride!", 2); } }
    if (it.type === "lantern") { it.x = mid + Math.sin(t * 1.4 + it.ph) * hw * 0.78; if (Math.hypot(it.x - R.x, dy) < 18) hit = true; }
    if (it.type === "eye") {
      const ex = mid + it.side * hw, ang = (it.side < 0 ? 0 : Math.PI) + Math.sin(t * 0.9 + it.ph) * 0.75, la = Math.atan2(-dy, R.x - ex);
      let da = Math.abs(Math.atan2(Math.sin(la - ang), Math.cos(la - ang)));
      it.ang = ang;
      if (da < 0.17 && Math.hypot(R.x - ex, dy) < 300 && !(R.power && R.power.kind === "lantern")) { it.burn += dt; if (it.burn > 0.45) { hit = true; it.burn = -1; } } else it.burn = Math.max(0, it.burn - dt);
    }
    if (it.type === "power" && Math.hypot(it.x - R.x, dy) < 24) { it.gone = true; if (!quiet) runPower(it.kind); }
    if (it.type === "friend" && Math.hypot(it.x - R.x, dy) < 26) {
      it.gone = true;
      if (!quiet) {
        save.runFriends = save.runFriends || {}; save.runFriends[it.idx] = 1; persist();
        R.banner2 = { text: `You found ${RUN_FRIENDS[it.idx].name}!`, sub: "They'll wait for you in the city", t: 3 };
        runBonus("+20 ✦", 20); sfx.memory(); buzz([10, 40, 10]); R.friendFound = RUN_FRIENDS[it.idx].name;
      }
    }
    if (hit && R.inv <= 0) { if (comet) { it.gone = true; runBonus("Smash!", 2); } else if (!quiet) runHit(); }
    // Near misses: skimming past a rock or a shadow.
    if ((it.type === "rock" || it.type === "shadow") && !it.near && !it.freed && Math.abs(dy) < 8) {
      const ix = it.type === "shadow" ? it.cx : it.x, d = Math.abs(ix - R.x), r = it.type === "rock" ? it.r : 14;
      if (d > r + 12 && d < r + 34) { it.near = true; if (!quiet) { runBonus("Close!", 2, R.dist + 20, ix); R.boost = Math.max(R.boost, 0.35); note(1320, { dur: 0.2, vol: 0.04, echo: 0.4 }); } }
    }
    // A light left behind breaks the combo.
    if (it.type === "light" && it.got == null && dy < -24 && !it.missed) { it.missed = true; if (R.combo >= 5 && !quiet) R.pops.push({ text: "Combo lost", x: R.x, at: R.dist + 20, t: 0 }); R.combo = 0; }
  }
}

// ---------- Update ----------
function runUpdate(dt) {
  const R = run;
  R.t += dt;
  if (R.over) { R.over += dt; R.speed *= 0.96; R.dist += R.speed * dt; return; }
  const base = Math.min(400, 200 + R.dist * 0.006);
  R.speed = base * (1 + (R.boost > 0 ? 0.6 : 0) + (R.event && R.event.kind === "rush" ? 0.55 : 0) + (R.power && R.power.kind === "comet" ? 0.6 : 0));
  runTick(dt);
  R.dist += R.speed * dt;
  R.songCd = Math.max(0, R.songCd - dt); R.inv = Math.max(0, R.inv - dt); R.flash = Math.max(0, R.flash - dt * 2); R.banner = Math.max(0, R.banner - dt);
  if (R.missionMsg) R.missionMsg.t -= dt;
  // Steering: Lumi glides toward where your finger has slid it.
  if (keys.arrowleft || keys.a) R.tx -= 320 * dt;
  if (keys.arrowright || keys.d) R.tx += 320 * dt;
  const mid = caveMid(R.dist), hw = caveHalf(R.dist, R.dist), lo = mid - hw + 16, hi = mid + hw - 16;
  R.tx = Math.max(lo - 30, Math.min(hi + 30, R.tx));
  R.vx = (R.vx || 0) + ((R.tx - R.x) * 70 - R.vx * 15) * dt;
  R.x += R.vx * dt;
  R.tilt = (R.tilt || 0) + (Math.max(-0.5, Math.min(0.5, R.vx * 0.0035)) - (R.tilt || 0)) * Math.min(1, dt * 10);
  R.camX = (R.camX || 0) + ((R.x - 200) * 0.3 - (R.camX || 0)) * Math.min(1, dt * 3);
  R.shake = Math.max(0, (R.shake || 0) - dt * 2.5); R.happy = Math.max(0, (R.happy || 0) - dt);
  for (const p of R.pops || []) p.t += dt; R.pops = (R.pops || []).filter(p => p.t < 1.2);
  // The walls nudge Lumi back softly.
  if (R.x < lo) { R.x += (lo - R.x) * Math.min(1, dt * 14); R.tx = Math.max(R.tx, lo); R.vx = Math.max(R.vx, 0); }
  if (R.x > hi) { R.x += (hi - R.x) * Math.min(1, dt * 14); R.tx = Math.min(R.tx, hi); R.vx = Math.min(R.vx, 0); }
  R.trail.unshift([R.x, R.dist]); if (R.trail.length > 26) R.trail.pop();
  // A new world every few hundred metres.
  const b = Math.floor(runMetres() / RUN.BIOME_M);
  if (b !== R.biome) { R.biome = b; R.banner = 3; if (!R.attract) { mood = MOODS[b % MOODS.length]; sfx.gate(); } runMission("biome", b + 1); }
  while (R.next < R.dist + 1100) R.next += runSpawn(R.next);
  const magnet = R.power && R.power.kind === "magnet" ? 170 : runUpg("magnet") ? 40 + runUpg("magnet") * 30 : 0;
  for (const it of R.items) {
    if (it.gone) continue;
    const dy = it.at - R.dist;
    if (it.type === "shadow" && !it.freed) { it.ph += dt; if (dy > 0 && dy < 260) it.x += Math.sign(R.x - (it.cx ?? it.x)) * dt * 22; it.cx = it.x + Math.sin(it.ph * 0.9) * it.amp; it.at -= dt * 18; }
    if (it.got != null) { it.got += dt; if (it.got > 0.16) it.gone = true; continue; }
    const ix = it.type === "shadow" ? it.cx : it.x, d = Math.hypot(ix - R.x, dy);
    if (it.type === "light" && magnet && d < magnet) { it.x += (R.x - it.x) * Math.min(1, dt * 8); it.at += (R.dist - it.at) * Math.min(1, dt * 8); }
    if (it.type === "light" && it.got == null && d < 20) {
      it.got = 0; R.happy = 0.25;
      R.combo++; R.comboBest = Math.max(R.comboBest, R.combo); R.comboT = 1.6;
      R.lights += (1 + Math.floor(R.combo / 10)) * (R.power && R.power.kind === "lantern" ? 2 : 1);
      // Each light is the next note of a melody, a little higher the longer the combo runs.
      const tune = LULLABY_TUNE[R.note++ % LULLABY_TUNE.length][0];
      if (!R.attract) note(261.63 * Math.pow(2, (tune + 12 + Math.min(12, Math.floor(R.combo / 8) * 2)) / 12), { dur: 0.7, vol: 0.05, fm: 3, fmDepth: 0.6, echo: 0.8 });
      if (R.combo > 0 && R.combo % 10 === 0 && !R.attract) R.pops.push({ text: `Combo ${R.combo}!`, x: R.x, at: R.dist + 50, t: 0 });
      for (let k = 0; k < 6; k++) R.parts.push({ x: it.x, at: it.at, vx: (Math.random() - 0.5) * 60, va: (Math.random() - 0.3) * 60, life: 0.6, gold: true });
      if (!R.items.some(o => o.trail === it.trail && o.type === "light" && !o.gone && o.got == null)) { R.trails++; runMission("trail", R.trails); R.pops = R.pops || []; R.pops.push({ text: "Whole trail!", x: R.x, at: R.dist + 40, t: 0 }); }
      runMission("lights", R.lights);
    }
    if (it.type === "heart" && d < 22) { it.gone = true; R.hearts = Math.min(3 + runUpg("heart"), R.hearts + 1); sfx.light(); }
    if ((it.type === "rock" || it.type === "shadow") && !it.freed && R.power && R.power.kind === "comet" && d < 30) { it.gone = true; it.freed = true; if (!R.attract) runBonus("Smash!", 2, it.at, ix); continue; }
    if (it.type === "rock" && d < it.r + 12 && R.inv <= 0 && !(R.dashT > 0)) { R.tx += ix < R.x ? 40 : -40; R.vx += ix < R.x ? 260 : -260; R.speed *= 0.85; R.inv = 0.4; R.shake = 0.5; if (R.event && R.event.kind === "hunter") R.hunterGap -= 0.25; if (!R.attract) { sfx.bump(); buzz(15); } }
    if (it.type === "shadow" && !it.freed && d < 24 && R.inv <= 0) { it.freed = true; it.gone = true; if (!R.attract) runHit(); }
    if (dy < -500) it.gone = true;
  }
  R.items = R.items.filter(it => !it.gone || it.burst);
  // Songs roll out; shadows they reach turn back into light.
  for (const ring of R.rings) {
    ring.r += dt * 380; ring.at = R.dist;
    for (const it of R.items) if (it.type === "shadow" && !it.freed && Math.hypot(it.cx - ring.x, it.at - ring.at) < ring.r) {
      it.freed = true; R.freed++; R.lights += 3; R.pops.push({ text: "+3 ✦", x: it.cx, at: it.at, t: 0 });
      ring.count = (ring.count || 0) + 1;
      if (ring.count === 3) { runBonus("Chorus! +10 ✦", 10); R.flash = -0.6; }
      for (let k = 0; k < 16; k++) R.parts.push({ x: it.cx, at: it.at, vx: (Math.random() - 0.5) * 120, va: Math.random() * 120, life: 1.2, gold: true });
      if (!R.attract) sfx.rune(); runMission("free", R.freed); runMission("lights", R.lights);
      it.gone = true;
    }
  }
  R.rings = R.rings.filter(r => r.r < r.max);
  for (const p of R.parts) { p.life -= dt; p.x += p.vx * dt; p.at += p.va * dt; }
  R.parts = R.parts.filter(p => p.life > 0);
  runMission("dist", runMetres());
  if (R.nohit) runMission("nohit", runMetres());
  if (Math.floor(R.t * 4) !== Math.floor((R.t - dt) * 4)) runHud();
}

// ---------- Drawing ----------
const runGlowCache = {};
function runGlow(rgb) {
  if (runGlowCache[rgb]) return runGlowCache[rgb];
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.3, `rgba(${rgb},0.4)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (runGlowCache[rgb] = c);
}
let runMaskC = null;
const runMask = (W, H) => { if (!runMaskC) runMaskC = document.createElement("canvas"); if (runMaskC.width !== Math.round(W)) { runMaskC.width = Math.round(W); runMaskC.height = Math.round(H); } return runMaskC; };
const mixC = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
// Rough rock: the smooth passage edge plus two finer ripples, so walls look broken, not drawn.
const rockEdge = a => Math.sin(a * 0.045) * 7 + Math.sin(a * 0.11 + 2) * 3.2 + Math.sin(a * 0.27) * 1.1;
// What floats in each world's air: motes, pollen, sparkles, embers, snow, bubbles, gold dust, stars.
const RUN_AIR = [
  { rgb: "200,225,255", vy: 0.25, size: 5 }, { rgb: "170,255,170", vy: 0.1, size: 5 }, { rgb: "210,170,255", vy: 0.3, size: 6, twinkle: 1 },
  { rgb: "255,150,80", vy: -0.6, size: 6 }, { rgb: "240,248,255", vy: 0.9, size: 6 }, { rgb: "150,235,255", vy: -0.4, size: 7, bubble: 1 },
  { rgb: "255,215,120", vy: 0.15, size: 5 }, { rgb: "255,190,240", vy: 0.3, size: 6, twinkle: 1 },
];
function runDraw(ctx, W, H) {
  const R = run, t = R.t;
  // The camera: follows Lumi a little sideways, pulls back as you speed up, shakes when you're hit.
  const zoom = 1 - Math.min(0.1, (R.speed - 200) / 2000), S = W / 400 * zoom;
  const LY = H / S * (0.7 + Math.min(0.05, (R.speed - 200) / 4000));
  const shake = R.shake > 0 ? R.shake * 6 : 0, camX = R.camX || 0;
  const m = R.dist / RUN.M, b = Math.floor(m / RUN.BIOME_M), f = Math.max(0, (m % RUN.BIOME_M - (RUN.BIOME_M - 60)) / 60);
  const th = THEMES[b % THEMES.length], th2 = THEMES[(b + 1) % THEMES.length];
  const rim = mixC(th.rim, th2.rim, f), deep = mixC(th.deep, th2.deep, f), floor = mixC(th.floor2, th2.floor2, f), rock = mixC(th.rock, th2.rock, f);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${mixC(deep, [0, 0, 0], 0.5)})`); sky.addColorStop(0.5, `rgb(${mixC(floor, deep, 0.35)})`); sky.addColorStop(1, `rgb(${mixC(deep, [0, 0, 0], 0.55)})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 + (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); ctx.scale(S, S); ctx.translate(-200 - camX, 0);
  const Hu = H / S, yOf = at => LY - (at - R.dist), left = -60 + camX, right = 460 + camX;
  // A soft light high above: home.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5; ctx.drawImage(runGlow(rim.join(",")), 200 + camX * 0.5 - 260, -260, 520, 520); ctx.globalAlpha = 1;
  // Light shafts.
  for (let q = 0; q < 3; q++) { const x = 60 + q * 140 + Math.sin(t * 0.2 + q) * 30 + camX * 0.6, g = ctx.createLinearGradient(x, 0, x + 60, Hu); g.addColorStop(0, `rgba(${rim},0.09)`); g.addColorStop(1, `rgba(${rim},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, Hu); ctx.lineTo(x + 40, Hu); ctx.fill(); }
  ctx.globalCompositeOperation = "source-over";
  // Three layers of far cave, each moving slower the further away it is: hanging and rising spires.
  [[0.18, 0.55, 260], [0.32, 0.4, 200], [0.5, 0.25, 150]].forEach(([par, fog, gap], layer) => {
    ctx.fillStyle = `rgb(${mixC(mixC(deep, [0, 0, 0], 0.3), mixC(floor, deep, 0.4), fog)})`;
    for (let q = -1; q < Hu / gap + 2; q++) {
      const base = Math.floor(R.dist * par / gap) + q, r = seeded(base * 13 + layer * 101), y = LY - (base * gap - R.dist * par);
      const x = left + r() * (right - left) + camX * (par - 1), w = 18 + r() * 34 * (1 + layer * 0.3), h = 90 + r() * 140, up = r() < 0.5;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.3, y + (up ? -h * 0.6 : h * 0.6), x, y + (up ? -h : h)); ctx.quadraticCurveTo(x + w * 0.3, y + (up ? -h * 0.6 : h * 0.6), x + w, y); ctx.closePath(); ctx.fill();
    }
  });
  // Drifting bands of fog.
  for (let q = 0; q < 3; q++) { const y = ((q * 0.37 + t * 0.012 + R.dist * 0.0004) % 1.2 - 0.1) * Hu, g = ctx.createLinearGradient(0, y - 60, 0, y + 60); g.addColorStop(0, `rgba(${rim},0)`); g.addColorStop(0.5, `rgba(${mixC(rim, deep, 0.5)},0.07)`); g.addColorStop(1, `rgba(${rim},0)`); ctx.fillStyle = g; ctx.fillRect(left, y - 60, right - left, 120); }
  // The world's air.
  const air = RUN_AIR[b % RUN_AIR.length];
  for (let q = 0; q < 60; q++) {
    const r = seeded(q * 13 + 1), x = left + r() * (right - left) + Math.sin(t * 0.5 + q) * 8, y = (((r() * Hu + R.dist * (0.25 + r() * 0.4) + t * 40 * air.vy) % Hu) + Hu) % Hu;
    ctx.globalAlpha = (0.3 + 0.5 * (air.twinkle ? Math.abs(Math.sin(t * 2 + q)) : r())) * 0.9; const s = air.size * (0.5 + r());
    if (air.bubble) { ctx.strokeStyle = `rgba(${air.rgb},0.7)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(air.rgb), x - s, y - s, s * 2, s * 2); ctx.globalCompositeOperation = "source-over"; }
  }
  ctx.globalAlpha = 1;
  // Speed: faint streaks when the cave is really moving.
  const fast = Math.max(0, (R.speed - 260) / 140);
  if (fast > 0) { ctx.strokeStyle = `rgba(${rim},${0.18 * fast})`; ctx.lineWidth = 1; for (let q = 0; q < 14; q++) { const r = seeded(q * 7), x = left + r() * (right - left), y = ((r() * Hu + R.dist * 1.4) % (Hu + 80)) - 40; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30 + fast * 30); ctx.stroke(); } }
  // The cave walls: layered dark rock with broken edges that catch the world's glow, brighter
  // where Lumi's light falls on them.
  const edge = (side, inset = 0) => { const pts = []; for (let y = -30; y <= Hu + 30; y += 7) { const a = R.dist + (LY - y); pts.push([caveMid(a) + side * (caveHalf(a, R.dist) + rockEdge(a + side * 500) + inset), y]); } return pts; };
  const line = pts => { ctx.beginPath(); pts.forEach((p, q) => (q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  for (const side of [-1, 1]) {
    const pts = edge(side), outer = side < 0 ? left - 20 : right + 20;
    const g = ctx.createLinearGradient(side < 0 ? left : right, 0, 200 + side * 60, 0); g.addColorStop(0, "#010104"); g.addColorStop(1, `rgb(${mixC(rock, [0, 0, 0], 0.82)})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(outer, -30); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(outer, Hu + 30); ctx.fill();
    // Strata: fainter ledges further into the rock.
    ctx.lineJoin = "round";
    for (const [inset, a] of [[16, 0.13], [38, 0.06]]) { ctx.strokeStyle = `rgba(${rim},${a})`; ctx.lineWidth = 1.2; line(edge(side, inset)); ctx.stroke(); }
    for (const [w, a] of [[10, 0.06], [4, 0.2], [1.6, 0.85]]) { ctx.strokeStyle = `rgba(${rim},${a})`; ctx.lineWidth = w; line(pts); ctx.stroke(); }
    // Lumi lights the rock near it.
    const lg = ctx.createLinearGradient(0, LY - 150, 0, LY + 150); lg.addColorStop(0, "rgba(190,245,255,0)"); lg.addColorStop(0.5, `rgba(190,245,255,${0.55 + 0.2 * Math.sin(t * 3)})`); lg.addColorStop(1, "rgba(190,245,255,0)");
    ctx.strokeStyle = lg; ctx.lineWidth = 3; line(pts.filter(p => Math.abs(p[1] - LY) < 160)); ctx.stroke();
    // Crystals growing from the walls.
    for (let q = -2; q < 12; q++) { const base = Math.floor(R.dist / 120) + q, r = seeded(base * 31 + (side > 0 ? 7 : 0)); if (r() < 0.55) continue; const a = base * 120, y = yOf(a), x = caveMid(a) + side * (caveHalf(a, R.dist) + rockEdge(a + side * 500)), s = 6 + r() * 9, tilt = (r() - 0.5) * 0.8;
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(rim.join(",")), x - s * 3, y - s * 3, s * 6, s * 6); ctx.globalCompositeOperation = "source-over";
      for (let c = 0; c < 3; c++) { const cs = s * (1 - c * 0.28), ang = tilt + (c - 1) * 0.5; ctx.fillStyle = `rgba(${mixC(rim, [255, 255, 255], 0.35 + c * 0.2)},0.9)`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - side * Math.cos(ang) * cs * 1.4 - Math.sin(ang) * cs * 0.3, y - Math.sin(ang) * cs * 1.4); ctx.lineTo(x - side * cs * 0.3, y + cs * 0.3); ctx.fill(); } }
  }
  // Glow-worms: threads of tiny lights hanging from the walls.
  for (let q = -2; q < 16; q++) {
    const base = Math.floor(R.dist / 90) + q, r = seeded(base * 17 + 5); if (r() < 0.5) continue;
    const side = r() < 0.5 ? -1 : 1, a = base * 90, y0 = yOf(a), x0 = caveMid(a) + side * (caveHalf(a, R.dist) + rockEdge(a + side * 500) - 2), len = 3 + Math.floor(r() * 5);
    for (let k = 0; k < len; k++) { const x = x0 - side * (2 + k * 0.6), y = y0 + k * 7 + Math.sin(t * 1.5 + base) * 1.5; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + k + base); ctx.drawImage(runGlow("170,255,220"), x - 3, y - 3, 6, 6); }
  }
  ctx.globalAlpha = 1;
  // World hazards.
  for (const it of R.items) {
    if (it.gone) continue;
    const y = yOf(it.at); if (y < -120 || y > Hu + 120) continue;
    const mid = caveMid(it.at), hw = caveHalf(it.at, R.dist);
    if (it.type === "current") {
      // Streams of green light flowing sideways.
      ctx.strokeStyle = "rgba(160,255,190,0.35)"; ctx.lineWidth = 1.5;
      for (let q = 0; q < 14; q++) { const yy = y - (q / 14) * it.len, ph = ((t * 1.4 + q * 0.37) % 1), x0 = mid - hw + ph * hw * 2; ctx.beginPath(); ctx.moveTo(x0 - it.dir * 18, yy); ctx.lineTo(x0 + it.dir * 18, yy); ctx.lineTo(x0 + it.dir * 10, yy - 5); ctx.stroke(); }
    } else if (it.type === "gate") {
      const gap = 34 + 30 * (0.5 + 0.5 * Math.sin(t * 1.6 + it.ph));
      for (const side of [-1, 1]) {
        const x0 = mid + side * (hw + 10), x1 = mid + side * gap;
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6; ctx.drawImage(runGlow("200,160,255"), Math.min(x0, x1) - 20, y - 26, Math.abs(x1 - x0) + 40, 52); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#d9c4ff"; ctx.beginPath(); ctx.moveTo(x0, y - 6); ctx.lineTo(x1, y - 2); ctx.lineTo(x1 - side * 6, y + 6); ctx.lineTo(x0, y + 7); ctx.fill();
        for (let c = 0; c < 4; c++) { const cx = x1 + (x0 - x1) * (c / 4 + 0.1); ctx.beginPath(); ctx.moveTo(cx - 5, y - 4); ctx.lineTo(cx, y - 15 - c * 2); ctx.lineTo(cx + 5, y - 4); ctx.fill(); }
      }
    } else if (it.type === "lava") {
      const wall = mid + it.side * hw, warn = Math.max(0, Math.sin(t * 1.3 + it.ph - 0.6));
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + warn * 0.6; ctx.drawImage(runGlow("255,120,40"), wall - 30, y - 30, 60, 60); ctx.globalAlpha = 1;
      if (it.len > 4) { const x2 = wall - it.side * it.len, g = ctx.createLinearGradient(wall, 0, x2, 0); g.addColorStop(0, "rgba(255,240,180,0.95)"); g.addColorStop(0.5, "rgba(255,130,40,0.8)"); g.addColorStop(1, "rgba(255,60,20,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(wall, y - 10); ctx.quadraticCurveTo((wall + x2) / 2, y - 14 + Math.sin(t * 20) * 3, x2, y); ctx.quadraticCurveTo((wall + x2) / 2, y + 14, wall, y + 10); ctx.fill(); }
      ctx.globalCompositeOperation = "source-over";
    } else if (it.type === "ice") {
      // Its shadow on Lumi's line warns where it will land.
      const warn = Math.max(0, 1 - Math.abs(it.at - R.dist) / 320);
      ctx.strokeStyle = `rgba(220,240,255,${0.5 * warn})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, LY, 10 + (1 - warn) * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#e8f6ff"; ctx.beginPath(); ctx.moveTo(it.x - 6, y - 20); ctx.lineTo(it.x + 6, y - 20); ctx.lineTo(it.x, y + 14); ctx.fill();
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("200,235,255"), it.x - 16, y - 16, 32, 32); ctx.globalCompositeOperation = "source-over";
    } else if (it.type === "bubble") {
      const r = 18 + Math.sin(t * 3 + it.ph) * 1.5;
      ctx.strokeStyle = "rgba(170,240,255,0.8)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(it.x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(170,240,255,0.12)"; ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(it.x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    } else if (it.type === "lantern") {
      const ax = mid + Math.sin(it.ph) * 10, ay = y - 140;
      ctx.strokeStyle = "rgba(200,170,110,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(it.x || mid, y); ctx.stroke();
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,200,110"), (it.x || mid) - 34, y - 34, 68, 68); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#2a1e10"; ctx.fillRect((it.x || mid) - 7, y - 9, 14, 18); ctx.fillStyle = "#ffd98a"; ctx.fillRect((it.x || mid) - 4, y - 6, 8, 12);
    } else if (it.type === "eye") {
      const ex = mid + it.side * hw, ang = it.ang ?? 0;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(ex, y, 10, ex, y, 300); g.addColorStop(0, `rgba(255,210,110,${0.35 + Math.max(0, it.burn) * 0.8})`); g.addColorStop(1, "rgba(255,200,90,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ex, y); ctx.arc(ex, y, 300, -ang - 0.17, -ang + 0.17); ctx.closePath(); ctx.fill();
      ctx.drawImage(runGlow("255,200,90"), ex - 30, y - 30, 60, 60); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(ex, y, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1a0e02"; ctx.beginPath(); ctx.ellipse(ex + Math.cos(-ang) * 4, y + Math.sin(-ang) * 4, 2.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    } else if (it.type === "power") {
      const P = RUN_POWERS[it.kind], bob = Math.sin(t * 3) * 3;
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(P.rgb), it.x - 34, y - 34 + bob, 68, 68); ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = `rgba(${P.rgb},0.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(it.x, y + bob, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "16px system-ui"; ctx.textAlign = "center"; ctx.fillText({ comet: "☄", magnet: "✧", lantern: "☀", choir: "♫" }[it.kind], it.x, y + bob + 6);
    } else if (it.type === "friend") {
      const bob = Math.sin(t * 2) * 5;
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,180,220"), it.x - 40, y - 40 + bob, 80, 80); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff0f8"; ctx.beginPath(); ctx.arc(it.x, y + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a1830"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(it.x + sd * 3, y + bob - 1, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "rgba(255,220,240,0.85)"; ctx.font = "italic 11px Georgia, serif"; ctx.textAlign = "center"; ctx.fillText("help!", it.x, y + bob - 16);
    }
  }
  // Golden threads between the lights of a trail.
  ctx.strokeStyle = "rgba(255,215,130,0.18)"; ctx.lineWidth = 1;
  let prev = null;
  for (const it of R.items) { if (it.type !== "light" || it.gone || it.got) { prev = null; continue; } const y = yOf(it.at); if (prev && prev.trail === it.trail) { ctx.beginPath(); ctx.moveTo(prev.x, yOf(prev.at)); ctx.lineTo(it.x, y); ctx.stroke(); } prev = it; }
  // Things in the cave.
  for (const it of R.items) {
    if (it.gone) continue;
    const y = yOf(it.at); if (y < -60 || y > Hu + 60) continue;
    if (it.type === "light") {
      // A little star; once gathered, it streaks into Lumi.
      let x = it.x, yy = y + Math.sin(t * 3 + it.at * 0.05) * 3, s = 1;
      if (it.got) { const k = Math.min(1, it.got / 0.16); x += (R.x - x) * k; yy += (LY - yy) * k; s = 1 - k * 0.6; }
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,205,110"), x - 20 * s, yy - 20 * s, 40 * s, 40 * s); ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(x, yy); ctx.rotate(t * 1.2 + it.at); ctx.fillStyle = "#fff6d6"; ctx.beginPath();
      for (let p = 0; p < 8; p++) { const rr = (p % 2 ? 1.6 : 5.5) * s, a = p / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill(); ctx.restore();
    } else if (it.type === "heart") {
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("160,235,255"), it.x - 28, y - 28, 56, 56); ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(it.x, y); ctx.rotate(Math.sin(t * 2) * 0.2); ctx.fillStyle = "#e6fbff"; ctx.beginPath(); for (let p = 0; p < 8; p++) { const rr = p % 2 ? 3 : 10, a = p / 8 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore();
    } else if (it.type === "rock") {
      const r = seeded(it.seed); ctx.fillStyle = `rgb(${mixC(rock, [0, 0, 0], 0.85)})`; ctx.beginPath();
      const pts = []; for (let q = 0; q < 10; q++) { const a = q / 10 * Math.PI * 2, rr = it.r * (0.78 + r() * 0.4); pts.push([it.x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      pts.forEach((p, q) => (q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${rim},0.75)`; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = `rgba(${rim},0.15)`; ctx.lineWidth = 6; ctx.stroke();
    } else if (it.type === "shadow") {
      // A drifting knot of smoke with two eyes that watch Lumi.
      const x = it.cx, look = Math.max(-2, Math.min(2, (R.x - x) * 0.03));
      ctx.globalAlpha = 0.9; ctx.drawImage(runGlow("90,40,140"), x - 34, y - 38, 68, 68); ctx.globalAlpha = 1;
      for (let q = 0; q < 6; q++) { const a = t * (1.2 + q * 0.2) + q * 1.1, sx = x + Math.cos(a) * 5, sy = y - 4 + q * 5 + Math.sin(a) * 3, rr = 17 - q * 2.3; ctx.fillStyle = `rgba(5,2,12,${0.62 - q * 0.08})`; ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.85, a * 0.2, 0, Math.PI * 2); ctx.fill(); }
      for (let q = 0; q < 3; q++) { ctx.strokeStyle = "rgba(10,4,20,0.5)"; ctx.lineWidth = 3 - q * 0.6; ctx.beginPath(); const bx = x + (q - 1) * 8; ctx.moveTo(bx, y + 12); ctx.quadraticCurveTo(bx + Math.sin(t * 3 + q) * 8, y + 24, bx + Math.sin(t * 2 + q) * 5, y + 34); ctx.stroke(); }
      const blink = (t * 0.6 + it.ph) % 3 < 0.1 ? 0.15 : 1, near = Math.max(0, 1 - Math.abs(it.at - R.dist) / 260);
      for (const sd of [-1, 1]) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6 + near * 0.4; ctx.drawImage(runGlow("255,110,185"), x + sd * 7 + look - 10, y - 13, 20, 20); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ffc0e0"; ctx.beginPath(); ctx.ellipse(x + sd * 7 + look, y - 3, 3.6, 2.4 * blink, sd * -0.3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Song rings: a bright ring with a softer echo behind it, sparkling where it runs.
  for (const ring of R.rings) {
    const k = ring.r / ring.max, y = yOf(ring.at);
    for (const [rr, a, w] of [[ring.r, 0.85, 3], [ring.r * 0.82, 0.35, 2], [ring.r * 0.6, 0.15, 1.5]]) { ctx.strokeStyle = `rgba(175,240,255,${a * (1 - k)})`; ctx.lineWidth = w * (1 - k) + 0.6; ctx.beginPath(); ctx.arc(ring.x, y, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - k;
    for (let q = 0; q < 12; q++) { const a = q / 12 * Math.PI * 2 + t; ctx.drawImage(runGlow("190,245,255"), ring.x + Math.cos(a) * ring.r - 5, y + Math.sin(a) * ring.r - 5, 10, 10); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  // Sparkles.
  ctx.globalCompositeOperation = "lighter";
  for (const p of R.parts) { const y = yOf(p.at); ctx.globalAlpha = Math.min(1, p.life * 2); const s = p.size || 8; ctx.drawImage(runGlow(p.gold ? "255,215,130" : "170,240,255"), p.x - s, y - s, s * 2, s * 2); }
  ctx.globalAlpha = 1;
  // Lumi's trail: a smooth ribbon of light that thins and fades behind it.
  // One tapered shape, filled with a gradient that fades toward the tail (no overlapping beads).
  const ribbon = (wide, rgb, a) => {
    const n = R.trail.length; if (n < 3) return;
    const L2 = [], R2 = [];
    for (let q = 0; q < n; q++) {
      const p = R.trail[q], pn = R.trail[Math.min(n - 1, q + 1)], pp = R.trail[Math.max(0, q - 1)];
      const dx = pn[0] - pp[0], dy = yOf(pn[1]) - yOf(pp[1]), len = Math.hypot(dx, dy) || 1, w = wide * (1 - q / n) + 0.5;
      L2.push([p[0] - dy / len * w, yOf(p[1]) + dx / len * w]); R2.push([p[0] + dy / len * w, yOf(p[1]) - dx / len * w]);
    }
    const g = ctx.createLinearGradient(0, yOf(R.trail[0][1]), 0, yOf(R.trail[n - 1][1]));
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); L2.forEach((p, q) => (q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let q = n - 1; q >= 0; q--) ctx.lineTo(R2[q][0], R2[q][1]); ctx.closePath(); ctx.fill();
  };
  ribbon(14, "150,235,255", 0.35); ribbon(5, "235,252,255", 0.7);
  // Lumi: a halo, a soft pulsing ring, the body leaning into its turns and stretching with speed.
  const pulse = 1 + Math.sin(t * 3) * 0.06 + (R.songCd > 0.8 ? 0.25 : 0);
  ctx.drawImage(runGlow(R.power ? RUN_POWERS[R.power.kind].rgb : "150,235,255"), R.x - 70 * pulse, LY - 70 * pulse, 140 * pulse, 140 * pulse);
  if (R.power && R.power.kind === "comet") { ctx.drawImage(runGlow("255,200,100"), R.x - 50, LY - 20, 100, 160); }
  ctx.globalCompositeOperation = "source-over";
  if (!(R.inv > 0.4 && Math.floor(R.inv * 12) % 2)) {
    const tilt = R.tilt || 0, stretch = 1 + Math.min(0.18, Math.abs(R.vx || 0) * 0.0007) + fast * 0.06, bob = Math.sin(t * 2.6) * 1.5;
    ctx.save(); ctx.translate(R.x, LY + bob); ctx.rotate(tilt);
    ctx.strokeStyle = `rgba(200,245,255,${0.35 + 0.25 * Math.sin(t * 3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 17 * pulse, 0, Math.PI * 2); ctx.stroke();
    // The antenna sways the other way.
    ctx.strokeStyle = "#bfefff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(-tilt * 14 + 2, -20, -tilt * 18 + 1, -25); ctx.stroke();
    ctx.drawImage(runGlow("220,250,255"), -tilt * 18 + 1 - 7, -32, 14, 14);
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    const sk = SKINS[save.skin] && skinUnlocked(save.skin) && SKINS[save.skin].body ? SKINS[save.skin].body : ["#ffffff", "#d6f6ff", "#7fd8f5"];
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 13); g.addColorStop(0, sk[0]); g.addColorStop(0.65, sk[1]); g.addColorStop(1, sk[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    const look = Math.max(-2.2, Math.min(2.2, (R.vx || 0) * 0.012)), blink = (t % 3.4) < 0.12 ? 0.15 : 1, happy = R.happy > 0;
    ctx.fillStyle = "#123049";
    for (const sd of [-1, 1]) { ctx.beginPath(); if (happy) { ctx.lineWidth = 1.6; ctx.strokeStyle = "#123049"; ctx.arc(sd * 4.5 + look, 0, 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } else { ctx.ellipse(sd * 4.5 + look, -1, 1.8, 2.7 * blink, 0, 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = "rgba(255,150,190,0.45)"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 7.5, 4, 2.4, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  // The Hunter: a vast shadow rising behind Lumi, closer as the gap closes.
  if (R.event && R.event.kind === "hunter") {
    const gy = H * (1.15 - (1 - R.hunterGap) * 0.42), gx = W / 2 + Math.sin(t * 0.8) * W * 0.1;
    const g = ctx.createRadialGradient(gx, gy, 10, gx, gy, W * 0.75); g.addColorStop(0, "rgba(4,1,10,0.97)"); g.addColorStop(0.6, "rgba(10,3,24,0.85)"); g.addColorStop(1, "rgba(10,3,24,0)");
    ctx.fillStyle = g; ctx.fillRect(0, gy - W * 0.75, W, W * 1.5);
    for (const sd of [-1, 1]) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,90,170"), gx + sd * W * 0.12 - 40, gy - W * 0.2 - 40, 80, 80); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ffb0d8"; ctx.beginPath(); ctx.ellipse(gx + sd * W * 0.12, gy - W * 0.2, 14, 6, sd * -0.3, 0, Math.PI * 2); ctx.fill(); }
  }
  // Darkness falls: only Lumi's light and its songs show the cave.
  if (R.event && R.event.kind === "dark" && !(R.power && R.power.kind === "lantern")) {
    const mk = runMask(W, H), m2 = mk.getContext("2d"), fade = Math.min(1, (RUN_EVENTS.dark.dur - R.event.t) / 1.2, R.event.t / 1.2);
    m2.globalCompositeOperation = "source-over"; m2.clearRect(0, 0, W, H); m2.fillStyle = `rgba(0,0,0,${0.94 * fade})`; m2.fillRect(0, 0, W, H);
    m2.globalCompositeOperation = "destination-out";
    const hole = (x, y, r) => { const g = m2.createRadialGradient(x, y, r * 0.3, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); m2.fillStyle = g; m2.fillRect(x - r, y - r, r * 2, r * 2); };
    const toX = x => W / 2 + (x - 200 - camX) * S;
    hole(toX(R.x), LY * S, 95 * S);
    for (const ring of R.rings) hole(toX(ring.x), (LY - (ring.at - R.dist)) * S, (ring.r + 60) * S);
    ctx.drawImage(mk, 0, 0, W, H);
  }
  // Close dark rock rushing past at the edges: depth.
  ctx.save(); ctx.scale(S, S); ctx.fillStyle = "rgba(1,1,4,0.92)";
  for (let q = -1; q < 4; q++) { const base = Math.floor(R.dist * 1.6 / 420) + q, r = seeded(base * 29 + 11); if (r() < 0.4) continue; const side = r() < 0.5 ? -1 : 1, y = LY - (base * 420 - R.dist * 1.6), x = side < 0 ? -20 + r() * 20 : W / S + 20 - r() * 20, w = 50 + r() * 40, h = 120 + r() * 90;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, side * 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Touched: a flash of violet.
  if (R.flash > 0) { ctx.fillStyle = `rgba(120,40,160,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  if (R.flash < 0) { ctx.fillStyle = `rgba(255,230,170,${-R.flash * 0.35})`; ctx.fillRect(0, 0, W, H); R.flash = Math.min(0, R.flash + 0.03); }
  // The combo counter.
  if (R.combo >= 3 && !R.attract) { ctx.globalAlpha = Math.min(1, 0.4 + R.comboT); ctx.textAlign = "center"; ctx.fillStyle = "#ffe2a0"; ctx.font = `600 ${Math.round(W * 0.05 + Math.min(10, R.combo / 4))}px system-ui, sans-serif`; ctx.fillText(`${R.combo} combo`, W / 2, H * 0.14); ctx.globalAlpha = 1; }
  if (R.banner2) { ctx.globalAlpha = Math.min(1, R.banner2.t * 1.5); ctx.textAlign = "center"; ctx.fillStyle = "#fff4d6"; ctx.font = `600 ${Math.round(W * 0.06)}px system-ui, sans-serif`; ctx.fillText(R.banner2.text, W / 2, H * 0.45); if (R.banner2.sub) { ctx.font = `italic ${Math.round(W * 0.042)}px "Cormorant Garamond", Georgia, serif`; ctx.fillStyle = "#c8d6ee"; ctx.fillText(R.banner2.sub, W / 2, H * 0.45 + W * 0.065); } ctx.globalAlpha = 1; }
  // A vignette.
  const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, H * 0.8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // Floating "+3" when a shadow is sung free.
  ctx.textAlign = "center";
  for (const p of R.pops || []) { const k = p.t / 1.2; ctx.globalAlpha = 1 - k; ctx.fillStyle = "#ffe2a0"; ctx.font = `600 ${Math.round(W * 0.045)}px system-ui, sans-serif`; ctx.fillText(p.text, W / 2 + (p.x - 200 - camX) * S, (yOf(p.at) - k * 40) * S); }
  ctx.globalAlpha = 1;
  // The world's name as you enter it; mission messages.
  if (R.banner > 0) {
    ctx.globalAlpha = Math.min(1, R.banner, (3 - R.banner) * 2); ctx.fillStyle = "#eef8ff";
    ctx.font = `500 ${Math.round(W * 0.075)}px Cinzel, Georgia, serif`; ctx.fillText(THEMES[R.biome % THEMES.length].name, W / 2, H * 0.3);
    ctx.font = `italic ${Math.round(W * 0.045)}px "Cormorant Garamond", Georgia, serif`; ctx.fillStyle = "#b8c8e4"; ctx.fillText(`World ${R.biome + 1}`, W / 2, H * 0.3 + W * 0.07); ctx.globalAlpha = 1;
  }
  if (R.missionMsg && R.missionMsg.t > 0) { ctx.globalAlpha = Math.min(1, R.missionMsg.t); ctx.fillStyle = "#ffd98a"; ctx.font = `600 ${Math.round(W * 0.05)}px system-ui, sans-serif`; ctx.fillText(R.missionMsg.text, W / 2, H * 0.4); ctx.globalAlpha = 1; }
}

function runLoop(now) {
  if (!run || screen !== "run") return;
  const c = $("runCanvas"), d = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const dt = Math.min(0.05, (now - (run.last || now)) / 1000); run.last = now;
  if (!run.paused) runUpdate(dt);
  const ctx = c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  runDraw(ctx, W, H);
  requestAnimationFrame(runLoop);
}

// ---------- Input: slide to steer, tap to sing ----------
{
  const c = document.getElementById("runCanvas");
  let p = null;
  c.addEventListener("pointerdown", e => { audio(); p = { x: e.clientX, y: e.clientY, sx: e.clientX, t: performance.now(), moved: false, tx: run ? run.tx : 0 }; try { c.setPointerCapture(e.pointerId); } catch (err) {} });
  c.addEventListener("pointermove", e => {
    if (!p || !run) return;
    if (Math.abs(e.clientX - p.sx) > 6) p.moved = true;
    if (!p.dashed && p.y - e.clientY > 45 && performance.now() - p.t < 300) { p.dashed = true; p.moved = true; runDash(); }
    run.tx = p.tx + (e.clientX - p.sx) / (c.clientWidth / 400) * 1.25;
  });
  const end = () => { if (p && !p.moved && performance.now() - p.t < 350) runSing(); p = null; };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", () => { p = null; });
  window.addEventListener("keydown", e => { if (screen !== "run") return; if (e.key === " ") { e.preventDefault(); runSing(); } if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") { e.preventDefault(); runDash(); } });
}
document.getElementById("runPauseBtn").addEventListener("click", e => { e.stopPropagation(); if (!run || run.over) return; run.paused = true; $("runPause").hidden = false; musicStop(); });
document.getElementById("runResume").addEventListener("click", () => { run.paused = false; run.last = 0; $("runPause").hidden = true; musicStart(4242, 2); });
document.getElementById("runQuit").addEventListener("click", () => { run = null; showTitle(); });
document.getElementById("runAgain").addEventListener("click", () => startRun({ daily: run && run.daily }));
document.getElementById("runCity").addEventListener("click", () => { run = null; showCity(); });
document.getElementById("runShopList").addEventListener("click", e => {
  const b = e.target.closest("button[data-run]");
  if (!b) return;
  if (runBuy(b.dataset.run)) runShop();
});
// ---------- The title: a run that plays itself ----------
let titleRun = null, titleRaf = 0;
function startTitleRun() {
  if (!titleRun) { const keep = run; titleRun = startRun({ attract: true }); run = keep; }
  if (!titleRaf) titleRaf = requestAnimationFrame(titleLoop);
}
function titleLoop(now) {
  titleRaf = 0;
  if (screen !== "title" || !titleRun) return;
  const c = $("titleCanvas"), d = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
  if (W && c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const keep = run; run = titleRun;
  const dt = Math.min(0.05, (now - (titleRun.last || now)) / 1000); titleRun.last = now;
  // It steers itself along the light trails and sings at shadows.
  const ahead = titleRun.items.find(it => it.type === "light" && it.got == null && it.at > titleRun.dist && it.at < titleRun.dist + 220);
  titleRun.tx = ahead ? ahead.x : caveMid(titleRun.dist + 120);
  if (titleRun.items.some(it => it.type === "shadow" && !it.freed && it.at - titleRun.dist < 140 && it.at > titleRun.dist)) runSing();
  titleRun.inv = 1; titleRun.speed = 0;
  runUpdate(dt);
  if (titleRun.dist > 60000) { titleRun = null; run = keep; startTitleRun(); return; }
  const ctx = c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  if (W) runDraw(ctx, W, H);
  run = keep;
  titleRaf = requestAnimationFrame(titleLoop);
}
document.getElementById("titleCanvas").addEventListener("click", () => { if (!titleRun) return; const keep = run; run = titleRun; run.songCd = 0; runSing(); run = keep; });
// Upgrades, from the end of a run or the city.
function runBuy(id) {
  const u = RUN.upgrades.find(q => q.id === id), r = runSave(), lv = runUpg(u.id), cost = u.tiers[lv];
  if (cost == null || (save.glow || 0) < cost) return false;
  save.glow -= cost; r.upg[u.id] = lv + 1; persist(); sfx.unlock(); buzz(20); return true;
}
function runShopHtml() {
  return RUN.upgrades.map(u => {
    const lv = runUpg(u.id), next = u.tiers[lv], afford = next != null && (save.glow || 0) >= next;
    return `<li><span><b>${u.name}</b> ${"◆".repeat(lv)}${"◇".repeat(u.tiers.length - lv)}<small>${u.tip(lv)}</small></span>` +
      (next == null ? `<em>Best</em>` : `<button data-run="${u.id}" ${afford ? "" : "disabled"}>✦ ${next}</button>`) + "</li>";
  }).join("");
}
function runShop() {
  $("runShopList").innerHTML = runShopHtml();
  $("runGlowLeft").textContent = save.glow || 0;
}

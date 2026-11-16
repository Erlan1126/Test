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
    { kind: "biome", goal: 2, text: n => `Reach district ${n}` },
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
const caveHalf = (a, d) => Math.max(76, 150 - Math.min(68, d * 0.0021) + 24 * Math.sin(a * 0.0033 + 0.7));

let run = null;
function startRun(opts = {}) {
  audio();
  const r = runSave();
  const daily = !!opts.daily;
  run = {
    daily, rng: opts.challenge ? seeded(opts.challenge.seed) : daily ? seeded(dayNumber() * 7919 + 13) : null, attract: !!opts.attract,
    seed: opts.challenge ? opts.challenge.seed : daily ? dayNumber() * 7919 + 13 : 0, challenge: opts.challenge || null, hard: !opts.attract && !!(save.run || {}).hardOn, boss: null, forks: 0,
    combo: 0, comboBest: 0, comboT: 0, boost: 0, dashCd: 0, dashT: 0, power: null, event: null, nextEvent: 250, hunterGap: 1, pops: [], msgs: [], friendSpawned: false, continues: 0, slow: 1, tut: 0, tutText: '',
    dist: 0, speed: 170, x: caveMid(0), tx: caveMid(0), vx: 0, hearts: 3 + runUpg("heart"), inv: 0, over: 0,
    lights: 0, freed: 0, songs: 0, hitAt: 0, trails: 0, songCd: 0, rings: [], items: [], parts: [], trail: [],
    next: 260, note: 0, biome: 0, banner: 1.5, flash: 0, t: 0, mult: r.mult, paused: false, nohit: true,
  };
  if (opts.attract) { run.hearts = 1e9; return run; }
  if (!r.tutDone && !daily) run.tut = 1;
  if (run.hard) run.hearts = 1;
  if (perk(11)) run.hearts++;
  // Without a seed, pick one now, so the run can be shared as a challenge.
  if (!run.rng) { run.seed = 1 + Math.floor(Math.random() * 1e9); run.rng = seeded(run.seed); }
  if (perk(0)) { run.power = { kind: "magnet", t: 6 }; }
  progressEvent("runs");
  for (const m of r.missions) m.run = 0;
  mood = MOODS[0];
  musicStart(4242, 2);
  show("run");
  $("runOver").hidden = true; $("runPause").hidden = true;
  runHud();
  requestAnimationFrame(runLoop);
}
const runMetres = () => Math.floor(run.dist / RUN.M);
const runScore = () => Math.floor((run.dist / RUN.M * run.mult + run.lights * 2 * run.mult) * (run.hard ? 2 : 1) * (weekEvent().id === "shadow" ? 1.5 : 1));

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
  if (roll < 0.8 && at / RUN.M < 60) { const id = R(); for (let q = 0; q < 8; q++) { const a = at + q * 34; run.items.push({ type: "light", at: a, x: caveMid(a) + Math.sin(q * 0.5) * hw * 0.3, trail: id, of: 8 }); } return 8 * 34 + 80; }
  if (roll < 0.8) {
    const n = R() < 0.25 + hard * 0.4 ? 2 : 1;
    for (let q = 0; q < n; q++) run.items.push({ type: "shadow", at: at + q * 70, x: mid + (R() - 0.5) * hw * 1.1, ph: R() * 6, amp: 20 + R() * 40 + hard * 30 });
    return 200 + R() * 90 - hard * 50;
  }
  if (roll < 0.96) { run.items.push({ type: "rock", at, x: mid + (R() - 0.5) * hw * 0.9, r: 18 + R() * 16, seed: R() * 99 }); return 170 + R() * 80; }
  run.items.push({ type: "heart", at, x: mid + (R() - 0.5) * hw * 0.6 });
  return 160;
}

// The first run teaches: slide to steer; time slows at the first shadow until you sing; then dash.
function runTutorial(dt) {
  const R = run;
  if (R.attract || !R.tut) return;
  if (R.tut === 1) { R.tutText = "Slide your finger to steer"; R.tutMoved = (R.tutMoved || 0) + Math.abs(R.vx || 0) * dt; if (R.tutMoved > 90 && R.t > 1.5) R.tut = 2; }
  else if (R.tut === 2) {
    R.tutText = ""; R.slow = 1;
    let sh = R.items.find(it => it.type === "shadow" && !it.freed && !it.gone && it.at > R.dist);
    if (!sh || sh.at - R.dist > 420) { R.items.push(sh = { type: "shadow", at: R.dist + 400, x: caveMid(R.dist + 400), ph: 0, amp: 10 }); }
    if (sh.at - R.dist < 190) { R.slow = 0.25; R.tutText = "Tap to sing!"; }
  } else if (R.tut === 3) { R.slow = 1; R.tutText = ""; if (runMetres() > 110) { R.tut = 4; } }
  else if (R.tut === 4) { R.tutText = "Swipe up to dash"; }
}
function runSing() {
  if (!run || run.over || run.paused || (run.songCd > 0 && !(run.power && run.power.kind === "choir"))) return;
  run.songCd = 1.1 - runUpg("song") * 0.2;
  run.songs++;
  run.rings.push({ x: run.x, at: run.dist, r: 0, max: (150 + runUpg("song") * 28) * (perk(6) ? 1.25 : 1) });
  if (!run.attract) { sfx.ping(run.songs); buzz(8); }
  if (run.tut === 2) { run.tut = 3; run.slow = 1; run.tutText = ""; runMsg("That's it!", "Your song turns shadows back into light", 2.2); }
  runMission("songs", run.songs);
}
function runHit() {
  run.hearts--; run.inv = 1.6; run.flash = 1; run.nohit = false; run.hitAt = runMetres(); run.shake = 1;
  sfx.caught(); buzz([30, 40, 30]);
  if (run.hearts <= 0) { if (!run.hard && run.continues < 2 && (save.glow || 0) + run.lights >= continueCost()) runOfferContinue(); else runEnd(); }
}
function runMission(kind, value) {
  if (run.attract) return;
  const r = save.run;
  for (const m of r.missions) {
    const def = RUN.missions[m.k];
    if (def.kind !== kind || m.done || value < m.goal) continue;
    m.done = true; r.mult = Math.min(10, r.mult + 1); run.mult = r.mult;
    runMsg("Mission done!", `Score multiplier ×${r.mult}`, 2.2, true); sfx.unlock(); buzz([10, 30, 10]);
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
  const before = lumiLevel(r.xp || 0), gained = Math.round(score / 10);
  r.xp = (r.xp || 0) + gained;
  const after = lumiLevel(r.xp), newTrails = RUN_TRAILS.filter(tr => tr.lv > before.lv && tr.lv <= after.lv);
  if (newTrails.length) r.trail = RUN_TRAILS.indexOf(newTrails[newTrails.length - 1]);
  run.levelInfo = { before, after, gained, newTrails };
  if (run.daily) { r.dailyDay = dayNumber(); r.dailyBest = Math.max(r.dailyDay === dayNumber() ? r.dailyBest || 0 : 0, score); }
  const streak = streakTouch(), bonus = Math.round(run.lights * streakBonus());
  save.glow = (save.glow || 0) + run.lights + bonus;
  run.streakBonus = bonus;
  progressEvent("dist", runMetres());
  run.seasonPaid = seasonGain(Math.round(score / 10));
  if (run.hard) { save.prog = save.prog || {}; save.prog.hardDist = Math.max(save.prog.hardDist || 0, runMetres()); }
  persist();
  checkAchievements();
  musicStop(); sfx.fail();
  setTimeout(() => {
    if (!run) return;
    // The score counts up; a new best glows.
    const t0 = performance.now(), el = $("runOverScore");
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); el.textContent = Math.round(score * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1 && run) requestAnimationFrame(tick); };
    tick();
    $("runOver").classList.toggle("best", best);
    $("runOverBest").textContent = best ? "New best" : `Best ${r.best.toLocaleString()}`;
    $("roDist").textContent = runMetres().toLocaleString(); $("roLights").textContent = (run.lights + (run.streakBonus || 0)).toLocaleString(); $("roCombo").textContent = run.comboBest;
    const li = run.levelInfo;
    $("runLevel").textContent = `Level ${li.after.lv}` + (li.after.lv > li.before.lv ? " · Level up!" : "") + ` · +${li.gained} xp`;
    $("runLevelBar").style.width = `${Math.round(li.after.into / li.after.need * 100)}%`;
    $("runTrail").textContent = `Trail · ${RUN_TRAILS[r.trail || 0].name}` + (li.newTrails.length ? " · new" : "") + " ›";
    if (best) { sfx.win(); buzz([20, 40, 20, 40]); }
    $("runOverInfo").textContent = `${runMetres()} m · ✦ ${run.lights} lights · best combo ${run.comboBest}` + (run.friendFound ? ` · found ${run.friendFound}` : "");
    $("runOverTitle").textContent = run.challenge ? (score > run.challenge.score ? "Challenge won" : "Challenge lost") : run.daily ? "Daily run" : run.hard ? "Hard run" : "Run over";
    const dm = dailyMissions();
    $("runOverDaily").textContent = `Daily missions ${dm.list.filter(m => m.done).length}/3` + (streakNow() ? ` · ${streakNow()}-day streak` : "") + (run.streakBonus ? ` · +${run.streakBonus} streak lights` : "") + (run.seasonPaid ? ` · season +${run.seasonPaid}` : "");
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
  const maxH = Math.max(run.hearts, (run.hard ? 1 : 3 + runUpg("heart")) + (perk(11) ? 1 : 0));
  $("runHearts").innerHTML = Array.from({ length: maxH }, (_, q) => `<i class="${q < run.hearts ? "on" : ""}"></i>`).join("");
  const ab = $("abilityBtn"), as = playingAs();
  if (ab.hidden === as >= 0) ab.hidden = as < 0;
  if (as >= 0) { $("abilityName").textContent = run.abilityCd > 0 ? Math.ceil(run.abilityCd) : RUN_POWERS[FRIEND_ABILITY[as]].name; ab.classList.toggle("cool", run.abilityCd > 0); }
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
  if (at / RUN.M > 200 && roll > 0.94) return runSpawnFork(at);
  if (at / RUN.M > 150 && roll < 0.06 + (w > 0 ? 0.26 : 0.12)) {
    const gap = weekEvent().id === "frost" && R() < 0.5 ? runHazard(at, 4, mid, hw) : runHazard(at, w, mid, hw);
    if (at / RUN.M > 600 && R() < 0.45) run.items.push({ type: "shadow", at: at + gap * 0.5, x: mid + (R() - 0.5) * hw, ph: R() * 6, amp: 20 + R() * 30 });
    return gap;
  }
  return 0;
}

function runMsg(text, sub = "", dur = 2, gold = false) {
  if (run.attract) return;
  if (run.msgs.length > 2) run.msgs.splice(1, 1);
  run.msgs.push({ text, sub, t: dur, dur, gold });
}

// ---------- Lumi's level and trails ----------
// Every run earns experience (a tenth of the score); each level asks a little more.
const RUN_TRAILS = [
  { name: "Moonbeam", rgb: "150,235,255", core: "235,252,255", lv: 1 },
  { name: "Aurora", rgb: "120,255,190", core: "220,255,236", lv: 3 },
  { name: "Ember", rgb: "255,150,80", core: "255,230,200", lv: 5 },
  { name: "Rose", rgb: "255,140,200", core: "255,225,240", lv: 7 },
  { name: "Gold", rgb: "255,205,100", core: "255,245,210", lv: 9 },
  { name: "Violet", rgb: "185,150,255", core: "236,226,255", lv: 12 },
  { name: "Rainbow", rgb: "rainbow", core: "255,255,255", lv: 15 },
];
const xpFor = lv => Math.round(90 * Math.pow(lv, 1.35));
function lumiLevel(xp = (save.run || {}).xp || 0) {
  let lv = 1, left = xp;
  while (left >= xpFor(lv)) { left -= xpFor(lv); lv++; }
  return { lv, into: left, need: xpFor(lv) };
}
function trailRgb(t) {
  const tr = RUN_TRAILS[(save.run || {}).trail || 0] || RUN_TRAILS[0];
  if (tr.rgb !== "rainbow") return tr.rgb;
  const h = (t * 60) % 360, c = k => Math.round(255 * (0.55 + 0.45 * Math.cos((h / 180) * Math.PI + k)));
  return `${c(0)},${c(2.1)},${c(4.2)}`;
}

// ---------- Keep going? ----------
// The first time the light runs out (and a second time, dearer), spend lights to carry on.
const continueCost = () => 25 * (run.continues + 1);
let continueTimer = 0;
function runOfferContinue() {
  run.paused = true;
  const cost = continueCost(), have = (save.glow || 0) + run.lights;
  $("runContinueCost").textContent = cost; $("runContinueGo").disabled = have < cost;
  $("runContinue").hidden = false;
  let left = 5; $("runContinueTime").textContent = left;
  clearInterval(continueTimer);
  continueTimer = setInterval(() => { left--; $("runContinueTime").textContent = left; if (left <= 0) runDecline(); }, 1000);
}
function runDecline() { clearInterval(continueTimer); $("runContinue").hidden = true; if (run) { run.paused = false; run.last = 0; runEnd(); } }
function runContinue() {
  clearInterval(continueTimer);
  let cost = continueCost();
  const fromRun = Math.min(run.lights, cost); run.lights -= fromRun; cost -= fromRun; save.glow = Math.max(0, (save.glow || 0) - cost);
  run.continues++; run.hearts = 1; run.inv = 2.5; run.paused = false; run.last = 0;
  // Clear the way a little.
  for (const it of run.items) if ((it.type === "shadow" || it.type === "rock" || it.type === "ice") && Math.abs(it.at - run.dist) < 400) it.gone = true;
  if (run.event && run.event.kind === "hunter") run.hunterGap = 1;
  $("runContinue").hidden = true; sfx.gate(); runMsg("Keep going!", "", 1.4, true); runHud();
}
document.getElementById("runContinueGo").addEventListener("click", e => { e.stopPropagation(); runContinue(); });
document.getElementById("runContinueNo").addEventListener("click", e => { e.stopPropagation(); runDecline(); });

function runDash() {
  if (!run || run.over || run.paused || run.dashCd > 0 || run.attract) return;
  run.dashCd = 2.5; run.boost = Math.max(run.boost, 0.45); run.dashT = 0.45;
  if (run.event && run.event.kind === "hunter") run.hunterGap = Math.min(1, run.hunterGap + 0.18);
  // A dash is loud: shadows nearby turn toward you.
  for (const it of run.items) if (it.type === "shadow" && !it.freed && Math.abs(it.at - run.dist) < 260) it.x += Math.sign(run.x - (it.cx ?? it.x)) * 40;
  sfx.dash(); buzz(12);
  if (run.tut === 4) { run.tut = 0; run.tutText = ""; save.run.tutDone = 1; persist(); runMsg("You're ready", "Gather lights, keep the combo, find lost friends", 2.6, true); }
  for (let k = 0; k < 14; k++) run.parts.push({ x: run.x + (Math.random() - 0.5) * 16, at: run.dist - 10, vx: (Math.random() - 0.5) * 50, va: -80 - Math.random() * 120, life: 0.5 });
}
function runBonus(text, lights, at = run.dist + 30, x = run.x) {
  run.lights += lights; run.pops.push({ text, x, at, t: 0 });
}
function runPower(kind) {
  run.power = { kind, t: RUN_POWERS[kind].dur };
  runMsg(`${RUN_POWERS[kind].name}!`, RUN_POWERS[kind].tip, 1.8);
  sfx.unlock(); buzz([10, 20, 10]);
}
function runStartEvent() {
  const kinds = Object.keys(RUN_EVENTS).filter(k => !(k === "dark" && perk(8)));
  const k = weekEvent().id === "rush" ? "rush" : kinds[Math.floor(runR() * kinds.length)];
  run.event = { kind: k, t: RUN_EVENTS[k].dur };
  runMsg(RUN_EVENTS[k].banner, RUN_EVENTS[k].sub, 2.6);
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
  R.boost = Math.max(0, R.boost - dt); R.dashCd = Math.max(0, R.dashCd - dt); R.dashT = Math.max(0, R.dashT - dt); R.abilityCd = Math.max(0, (R.abilityCd || 0) - dt);
  if (R.comboT > 0) R.comboT -= dt;
  if (R.msgs.length) { R.msgs[0].t -= dt; if (R.msgs[0].t <= 0) R.msgs.shift(); }
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
    if (it.type === "current" && dy < 0 && dy > -it.len && !perk(2)) R.vx += it.dir * 380 * dt;
    if (it.type === "gate" && Math.abs(dy) < 9) { const gap = 34 + 30 * (0.5 + 0.5 * Math.sin(t * 1.6 + it.ph)) + (perk(3) ? 22 : 0); if (Math.abs(R.x - mid) > gap) hit = true; }
    if (it.type === "lava") { it.len = hw * 1.5 * Math.max(0, Math.sin(t * 1.3 + it.ph)) ** 2; const wall = mid + it.side * hw; if (Math.abs(dy) < 13 && it.len > 25 && (it.side < 0 ? R.x < wall + it.len : R.x > wall - it.len) && !perk(4)) hit = true; }
    if (it.type === "ice") { if (dy < 320) it.at -= dt * (perk(5) ? 110 : 260); if (Math.hypot(it.x - R.x, it.at - R.dist) < 16) hit = true; }
    if (it.type === "bubble" && !it.used && Math.hypot(it.x - R.x, dy) < 26) { it.used = true; it.gone = true; R.boost = Math.max(R.boost, perk(1) ? 2.6 : 1.3); if (!quiet) { note(880, { dur: 0.3, vol: 0.06, glide: 1400, echo: 0.6 }); runBonus("Bubble ride!", 2); } }
    if (it.type === "lantern") { it.x = mid + Math.sin(t * (perk(7) ? 0.8 : 1.4) + it.ph) * hw * 0.78; if (Math.hypot(it.x - R.x, dy) < 18) hit = true; }
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
        runMsg(`You found ${RUN_FRIENDS[it.idx].name}!`, "They'll wait for you in the city", 3);
        runBonus("+20 ✦", 20); sfx.memory(); buzz([10, 40, 10]); R.friendFound = RUN_FRIENDS[it.idx].name;
      }
    }
    if (hit && R.inv <= 0) { if (comet) { it.gone = true; runBonus("Smash!", 2); } else if (!quiet) runHit(); }
    // Near misses: skimming past a rock or a shadow.
    if ((it.type === "rock" || it.type === "shadow") && !it.near && !it.freed && Math.abs(dy) < 8) {
      const ix = it.type === "shadow" ? it.cx : it.x, d = Math.abs(ix - R.x), r = it.type === "rock" ? it.r : 14;
      if (d > r + 12 && d < r + (perk(9) ? 44 : 34)) { it.near = true; if (!quiet) { progressEvent("near"); runBonus("Close!", 2, R.dist + 20, ix); R.boost = Math.max(R.boost, 0.35); note(1320, { dur: 0.2, vol: 0.04, echo: 0.4 }); } }
    }
    // A light left behind breaks the combo.
    if (it.type === "light" && it.got == null && dy < -24 && !it.missed) { it.missed = true; if (R.combo >= 5 && !quiet) R.pops.push({ text: "Combo lost", x: R.x, at: R.dist + 20, t: 0 }); R.combo = 0; }
  }
}

// ---------- Blackouts: a storm boss at the start of every new district ----------
// A vast shadow guards the way into each world. It hangs ahead of Lumi and throws fans of
// shadow bolts. Every few seconds it stops to listen, its eyes turning gold, and swoops close:
// sing then, three times, and it's calmed. Songs also break bolts. After 35 s it lets you pass.
const WARDEN_NAMES = ["", "a Blackout over Glass Heights", "a Blackout over Golden Hour", "a Blackout over Pink Dusk", "a Blackout over Neon Avenue", "a Blackout in the rain", "a Blackout at midnight", "a Blackout over the Starline"];
function runStartBoss(b) {
  run.boss = { b, t: 0, hp: 3 + Math.min(2, Math.floor(b / 3)), x: 200, off: 300, listen: 0, cycle: 2.5, vol: 1.6, bolts: [], hurt: 0 };
  runMsg(`${WARDEN_NAMES[b % 8] || "a Blackout"} rolls in`.replace(/^./, c => c.toUpperCase()), "Sing when its eyes turn gold", 2.8);
  sfx.gloomWake(0, true); buzz([30, 50, 30]);
}
function runBossTick(dt) {
  const R = run, B = R.boss;
  B.t += dt; B.hurt = Math.max(0, B.hurt - dt);
  const hw = caveHalf(R.dist + B.off, R.dist);
  B.off += ((B.listen > 0 ? 135 : 290) - B.off) * Math.min(1, dt * 3);
  B.at = R.dist + B.off; B.x = caveMid(B.at) + Math.sin(B.t * 0.7) * hw * 0.45;
  if (B.listen > 0) { B.listen -= dt; if (B.listen <= 0) B.cycle = 3.4 - Math.min(1.2, R.dist / 80000); }
  else if ((B.cycle -= dt) <= 0) { B.listen = 1.3; if (!R.attract) note(pitch(4, 1), { dur: 0.6, vol: 0.06, type: "triangle", echo: 0.8 }); }
  // Volleys of shadow bolts, faster and wider deeper in.
  if (B.listen <= 0 && (B.vol -= dt) <= 0) {
    B.vol = Math.max(0.9, 1.7 - B.b * 0.08);
    const n = 3 + Math.min(4, B.b), spread = 0.9;
    for (let q = 0; q < n; q++) { const a = -Math.PI / 2 + (q / (n - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.1; B.bolts.push({ x: B.x, at: B.at, vx: Math.cos(a) * 120, va: Math.sin(a) * 150 - 40 }); }
    if (!R.attract) sfx.whoosh(0);
  }
  for (const b of B.bolts) {
    b.x += b.vx * dt; b.at += b.va * dt;
    if (Math.hypot(b.x - R.x, b.at - R.dist) < (perk(9) ? 13 : 16) && R.inv <= 0 && !b.gone) { b.gone = true; if (!(R.power && R.power.kind === "comet")) runHit(); }
    for (const ring of R.rings) if (Math.hypot(b.x - ring.x, b.at - ring.at) < ring.r) b.gone = true;
  }
  B.bolts = B.bolts.filter(b => !b.gone && b.at > R.dist - 200);
  // A song reaching it while it listens calms it a little.
  for (const ring of R.rings) {
    if (ring.hitBoss || B.listen <= 0) continue;
    if (Math.hypot(B.x - ring.x, B.at - ring.at) < ring.r + 40) {
      ring.hitBoss = true; B.hp--; B.hurt = 0.6; B.listen = 0; B.cycle = 2.6; B.bolts.length = 0;
      if (!R.attract) { sfx.rune(); buzz([20, 30]); }
      if (B.hp <= 0) { R.boss = null; runBonus("The Blackout clears! +50 ✦", 50, R.dist + 120); R.flash = -0.8; progressEvent("boss"); R.next = Math.max(R.next, R.dist + 300); if (!R.attract) sfx.gate(); return; }
    }
  }
  if (B.t > 35) { R.boss = null; runMsg("The Blackout drifts away", "", 2); R.next = Math.max(R.next, R.dist + 300); }
}

// ---------- Forks: the cave splits around a great rock ----------
// One way is safe; the other is full of lights, and shadows.
const islandHalf = (it, a) => (a < it.at || a > it.at + it.len) ? 0 : 52 * Math.sin(Math.PI * (a - it.at) / it.len);
function runSpawnFork(at) {
  const len = 560, risky = runR() < 0.5 ? -1 : 1, it = { type: "island", at, len, risky };
  run.items.push(it);
  const id = runR();
  for (let q = 1; q < 14; q++) {
    const a = at + q * (len / 14), mid = caveMid(a), hw = caveHalf(a, run.dist), side = mid + risky * (islandHalf(it, a) + (hw - islandHalf(it, a)) / 2);
    run.items.push({ type: "light", at: a, x: side, trail: id, of: 13 });
    if (q % 4 === 2) run.items.push({ type: "shadow", at: a + 15, x: side + (runR() - 0.5) * 20, ph: runR() * 6, amp: 8 });
  }
  return len + 120;
}

// ---------- Update ----------
function runUpdate(dt) {
  const R = run;
  R.t += dt;
  if (R.over) { R.over += dt; R.speed *= 0.96; R.dist += R.speed * dt; return; }
  const base = Math.min(540, 205 + R.dist * 0.0105) * (R.hard ? 1.15 : 1);
  R.speed = base * (1 + (R.boost > 0 ? 0.6 : 0) + (R.event && R.event.kind === "rush" ? 0.55 : 0) + (R.power && R.power.kind === "comet" ? 0.6 : 0));
  runTick(dt);
  if (!R.attract) { music.layers = R.combo >= 10 ? 3 : 2; music.tension = R.event && R.event.kind === "hunter" ? 0.4 + (1 - R.hunterGap) * 0.6 : 0; }
  runTutorial(dt);
  R.dist += R.speed * dt;
  R.songCd = Math.max(0, R.songCd - dt); R.inv = Math.max(0, R.inv - dt); R.flash = Math.max(0, R.flash - dt * 2); R.banner = Math.max(0, R.banner - dt);
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
  // A fork: the great rock in the middle of the cave keeps Lumi to one side or the other.
  for (const it of R.items) {
    if (it.type !== "island" || R.dist < it.at || R.dist > it.at + it.len) continue;
    const ih = islandHalf(it, R.dist) + 12, m2 = caveMid(R.dist);
    if (Math.abs(R.x - m2) < ih) { const side = R.x < m2 ? -1 : 1; R.x = m2 + side * ih; R.tx = side < 0 ? Math.min(R.tx, R.x) : Math.max(R.tx, R.x); R.vx *= 0.5; }
    if (!it.chosen && R.dist > it.at + it.len * 0.5) { it.chosen = true; if (Math.sign(R.x - m2) === it.risky) { progressEvent("fork"); R.forks++; } }
  }
  // The walls nudge Lumi back softly.
  if (R.x < lo) { R.x += (lo - R.x) * Math.min(1, dt * 14); R.tx = Math.max(R.tx, lo); R.vx = Math.max(R.vx, 0); }
  if (R.x > hi) { R.x += (hi - R.x) * Math.min(1, dt * 14); R.tx = Math.min(R.tx, hi); R.vx = Math.min(R.vx, 0); }
  R.trail.unshift([R.x, R.dist]); if (R.trail.length > 26) R.trail.pop();
  // A new world every few hundred metres.
  const b = Math.floor(runMetres() / RUN.BIOME_M);
  if (b !== R.biome) { R.biome = b; R.banner = 3; if (!R.attract) { mood = MOODS[b % MOODS.length]; sfx.gate(); if (b >= 1) runStartBoss(b); } runMission("biome", b + 1); }
  if (R.boss) runBossTick(dt);
  else while (R.next < R.dist + 1100) R.next += runSpawn(R.next) * Math.max(0.62, 1 - R.dist / 80000);
  const magnet = R.power && R.power.kind === "magnet" ? 170 : runUpg("magnet") ? 40 + runUpg("magnet") * 30 : 0;
  for (const it of R.items) {
    if (it.gone) continue;
    const dy = it.at - R.dist;
    if (it.type === "shadow" && !it.freed) { it.ph += dt; if (dy > 0 && dy < 260) it.x += Math.sign(R.x - (it.cx ?? it.x)) * dt * (22 + Math.min(70, R.dist / 700)) * (perk(10) ? -1 : 1) * (weekEvent().id === "shadow" ? 1.3 : 1); it.cx = it.x + Math.sin(it.ph * 0.9) * it.amp; it.at -= dt * 18; }
    if (it.got != null) { it.got += dt; if (it.got > 0.16) it.gone = true; continue; }
    const ix = it.type === "shadow" ? it.cx : it.x, d = Math.hypot(ix - R.x, dy);
    if (it.type === "light" && magnet && d < magnet) { it.x += (R.x - it.x) * Math.min(1, dt * 8); it.at += (R.dist - it.at) * Math.min(1, dt * 8); }
    if (it.type === "light" && it.got == null && d < 20) {
      it.got = 0; R.happy = 0.25;
      R.combo++; R.comboBest = Math.max(R.comboBest, R.combo); R.comboT = 1.6;
      const worth = (1 + Math.floor(R.combo / 10)) * (R.power && R.power.kind === "lantern" ? 2 : 1) * (weekEvent().id === "gold" ? 2 : 1);
      R.lights += worth; progressEvent("lights", worth); if (R.combo % 5 === 0) progressEvent("combo", R.combo);
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
    if (it.type === "shadow" && !it.freed && d < (perk(9) ? 19 : 24) && R.inv <= 0) { it.freed = true; it.gone = true; if (!R.attract) runHit(); }
    if (dy < -500) it.gone = true;
  }
  R.items = R.items.filter(it => !it.gone || it.burst);
  // Songs roll out; shadows they reach turn back into light.
  for (const ring of R.rings) {
    ring.r += dt * 380; ring.at = R.dist;
    for (const it of R.items) if (it.type === "shadow" && !it.freed && Math.hypot(it.cx - ring.x, it.at - ring.at) < ring.r) {
      it.freed = true; R.freed++; R.lights += 3; progressEvent("free"); progressEvent("lights", 3); R.pops.push({ text: "+3 ✦", x: it.cx, at: it.at, t: 0 });
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
// Echo's city: Lumi climbs between skyscrapers, from a bright morning up through golden hour
// and pink dusk into neon night, and out above the rooftops under the stars. Each district has
// its own sky, towers, windows and neon.
const RUN_WORLDS = [
  { name: "Morning Plaza", sky: [[96, 170, 255], [170, 214, 255], [236, 246, 255]], tower: [214, 226, 242], win: [150, 196, 240], neon: [64, 156, 255], night: 0, sun: 1, cloud: 1 },
  { name: "Glass Heights", sky: [[70, 160, 250], [150, 210, 252], [232, 248, 255]], tower: [196, 222, 236], win: [130, 200, 230], neon: [40, 210, 190], night: 0, sun: 1, cloud: 1 },
  { name: "Golden Hour", sky: [[255, 140, 90], [255, 190, 130], [255, 228, 190]], tower: [222, 182, 150], win: [255, 214, 150], neon: [255, 130, 60], night: 0.15, sun: 1, cloud: 1 },
  { name: "Pink Dusk", sky: [[80, 66, 150], [196, 110, 170], [255, 172, 150]], tower: [98, 84, 130], win: [255, 200, 150], neon: [255, 100, 200], night: 0.55, cloud: 1 },
  { name: "Neon Avenue", sky: [[14, 10, 42], [40, 20, 80], [76, 30, 110]], tower: [26, 24, 48], win: [120, 230, 255], neon: [40, 225, 255], neon2: [255, 60, 240], night: 1 },
  { name: "Rain Lights", sky: [[10, 18, 32], [24, 40, 61], [34, 56, 80]], tower: [20, 28, 40], win: [120, 255, 200], neon: [60, 255, 180], neon2: [255, 90, 120], night: 1, rain: 1 },
  { name: "Midnight Gold", sky: [[5, 7, 15], [14, 19, 40], [27, 33, 64]], tower: [16, 19, 31], win: [255, 205, 110], neon: [255, 200, 90], night: 1 },
  { name: "Starline", sky: [[2, 3, 19], [10, 15, 46], [26, 24, 70]], tower: [11, 13, 26], win: [190, 180, 255], neon: [155, 140, 255], neon2: [120, 255, 220], night: 1, stars: 1 },
];
const runWorld = b => RUN_WORLDS[b % RUN_WORLDS.length];
// Buildings along each side: the passage edge, held level for each block, so the walls step like towers.
const BLOCK = 92;
const blockEdge = (k, side) => { const a = k * BLOCK + BLOCK / 2, r = seeded(k * 7 + (side > 0 ? 3 : 0)); return caveMid(a) + side * (caveHalf(a, run ? run.dist : 0) + r() * 10); };

function runDraw(ctx, W, H) {
  const R = run, t = R.t;
  // The camera: follows Lumi a little sideways, pulls back as you speed up, shakes when you're hit.
  const zoom = 1 - Math.min(0.1, (R.speed - 200) / 2000), S = W / 400 * zoom;
  const LY = H / S * (0.7 + Math.min(0.05, (R.speed - 200) / 4000));
  const shake = R.shake > 0 ? R.shake * 6 : 0, camX = R.camX || 0;
  const m = R.dist / RUN.M, b = Math.floor(m / RUN.BIOME_M), f = Math.max(0, (m % RUN.BIOME_M - (RUN.BIOME_M - 60)) / 60);
  const w1 = runWorld(b), w2 = runWorld(b + 1), mixW = k => mixC(w1[k], w2[k], f);
  const night = w1.night + (w2.night - w1.night) * f, tower = mixW("tower"), winC = mixW("win"), neon = mixW("neon"), neon2 = mixC(w1.neon2 || w1.neon, w2.neon2 || w2.neon, f);
  const rim = neon, rock = tower, deep = mixC(w1.sky[0], w2.sky[0], f);
  // The sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${mixC(w1.sky[0], w2.sky[0], f)})`); sky.addColorStop(0.55, `rgb(${mixC(w1.sky[1], w2.sky[1], f)})`); sky.addColorStop(1, `rgb(${mixC(w1.sky[2], w2.sky[2], f)})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 + (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); ctx.scale(S, S); ctx.translate(-200 - camX, 0);
  const Hu = H / S, yOf = at => LY - (at - R.dist), left = -60 + camX, right = 460 + camX;
  // Sun by day, moon by night; stars and an aurora up high.
  const day = 1 - night;
  if (day > 0.05) { ctx.globalAlpha = day; const g = ctx.createRadialGradient(290 + camX * 0.2, 90, 6, 290 + camX * 0.2, 90, 150); g.addColorStop(0, "rgba(255,250,235,1)"); g.addColorStop(0.18, "rgba(255,240,210,0.85)"); g.addColorStop(1, "rgba(255,230,190,0)"); ctx.fillStyle = g; ctx.fillRect(140 + camX * 0.2, -60, 300, 300); ctx.globalAlpha = 1; }
  if (night > 0.4) {
    ctx.globalAlpha = (night - 0.4) / 0.6;
    const r = seeded(9); for (let q = 0; q < 80; q++) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * 0.7 + q))})`; ctx.fillRect(left + r() * (right - left), r() * Hu * 0.6, 1.4, 1.4); }
    ctx.fillStyle = "#f4f2e8"; ctx.beginPath(); ctx.arc(120 + camX * 0.2, 80, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${mixC(w1.sky[0], w2.sky[0], f)})`; ctx.beginPath(); ctx.arc(127 + camX * 0.2, 75, 14, 0, Math.PI * 2); ctx.fill();
    if (w1.stars) { ctx.globalCompositeOperation = "lighter"; for (let q = 0; q < 3; q++) { const g = ctx.createLinearGradient(0, 40 + q * 30, 0, 180 + q * 30); g.addColorStop(0, "rgba(120,255,210,0)"); g.addColorStop(0.5, `rgba(${q ? "150,140,255" : "120,255,210"},0.12)`); g.addColorStop(1, "rgba(120,255,210,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(left, 120 + q * 30); for (let x = left; x <= right; x += 20) ctx.lineTo(x, 100 + q * 30 + Math.sin(x * 0.015 + t * 0.4 + q) * 30); ctx.lineTo(right, 220 + q * 30); ctx.lineTo(left, 220 + q * 30); ctx.fill(); } ctx.globalCompositeOperation = "source-over"; }
    ctx.globalAlpha = 1;
  }
  // Soft clouds drifting by in the day and at dusk.
  if (night < 0.7) {
    ctx.globalAlpha = Math.min(1, (0.7 - night) * 1.6) * 0.9;
    for (let q = -1; q < 5; q++) {
      const base = Math.floor(R.dist * 0.12 / 220) + q, r = seeded(base * 5 + 1), y = LY - (base * 220 - R.dist * 0.12), x = left + r() * (right - left) + Math.sin(t * 0.05 + q) * 20, w = 60 + r() * 80;
      ctx.fillStyle = night > 0.3 ? `rgba(${mixC([255, 190, 200], [120, 100, 160], night)},0.7)` : "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(x - w * 0.4, y + 4, w * 0.5, w * 0.18, 0, 0, Math.PI * 2); ctx.ellipse(x + w * 0.35, y - 6, w * 0.45, w * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // The far skyline: two layers of towers, paler and slower the further away.
  [[0.14, 0.72, 46], [0.3, 0.45, 60]].forEach(([par, haze, wd], layer) => {
    const skyMid = mixC(w1.sky[1], w2.sky[1], f), col = mixC(mixC(tower, [0, 0, 0], night * 0.55), skyMid, haze);
    for (let q = -2; q < 12; q++) {
      const base = Math.floor(camX * par / wd) + q, r = seeded(base * 13 + layer * 101), x = base * wd - camX * par + left * 0 + r() * 8 - 40, w = wd * (0.55 + r() * 0.4);
      const top = Hu * (0.25 + r() * 0.35) + layer * 40 - ((R.dist * par * 0.15) % 40);
      ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x, top, w, Hu);
      if (night > 0.3) { ctx.fillStyle = `rgba(${winC},${0.3 * night * (1 - haze * 0.6)})`; for (let wy = top + 8; wy < Hu; wy += 12) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (seeded(wx * 3 + wy)() < 0.18) ctx.fillRect(wx, wy, 3, 4); }
    }
  });
  // The district's air: dust by day, petals at dusk, neon bokeh, rain, gold sparks, stars.
  for (let q = 0; q < 34; q++) {
    const r = seeded(q * 13 + 1), x = left + r() * (right - left) + Math.sin(t * 0.5 + q) * 8;
    if (w1.rain) { const y = (((r() * Hu + t * 700 + R.dist * 0.6) % Hu) + Hu) % Hu; ctx.strokeStyle = "rgba(190,220,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 18); ctx.stroke(); continue; }
    const y = (((r() * Hu + R.dist * (0.25 + r() * 0.4) - t * 12) % Hu) + Hu) % Hu, s = 2 + r() * 4;
    if (night > 0.5) { ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(t + q)); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(q % 2 ? neon.join(",") : neon2.join(",")), x - s * 2, y - s * 2, s * 4, s * 4); ctx.globalCompositeOperation = "source-over"; }
    else { ctx.globalAlpha = 0.5; ctx.fillStyle = night > 0.3 ? "rgba(255,190,210,0.9)" : "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.6, s * 0.35, t + q, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // Speed: faint streaks when the city is really rushing by.
  const fast = Math.max(0, (R.speed - 260) / 140);
  if (fast > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.2 * fast})`; ctx.lineWidth = 1; for (let q = 0; q < 14; q++) { const r = seeded(q * 7), x = left + r() * (right - left), y = ((r() * Hu + R.dist * 1.4) % (Hu + 80)) - 40; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30 + fast * 30); ctx.stroke(); } }
  // The towers either side: glass by day, dark with lit windows and neon strips at night.
  const k0 = Math.floor((R.dist - (Hu - LY) - 40) / BLOCK), k1 = Math.ceil((R.dist + LY + 40) / BLOCK);
  for (const side of [-1, 1]) {
    for (let k = k0; k <= k1; k++) {
      const r = seeded(k * 31 + (side > 0 ? 17 : 0)), edgeX = blockEdge(k, side), yTop = yOf((k + 1) * BLOCK), yBot = yOf(k * BLOCK);
      const outer = side < 0 ? left - 30 : right + 30, x0 = Math.min(edgeX, outer), wB = Math.abs(outer - edgeX), shade = 0.88 + r() * 0.2;
      const base = mixC(tower.map(v => v * shade), [0, 0, 0], night * 0.25);
      const g = ctx.createLinearGradient(edgeX, 0, edgeX + side * 160, 0);
      g.addColorStop(0, `rgb(${mixC(base, [255, 255, 255], day * 0.25)})`); g.addColorStop(1, `rgb(${mixC(base, [0, 0, 0], 0.25 + night * 0.4)})`);
      ctx.fillStyle = g; ctx.fillRect(x0, yTop + 2, wB, yBot - yTop - 2);
      // Windows: rows of glass, a few lit (more at night).
      for (let wy = yTop + 10; wy < yBot - 8; wy += 14) for (let c = 0; c < 6; c++) {
        const wx = edgeX + side * (12 + c * 15) - (side > 0 ? 0 : 8), lit = seeded(k * 97 + c * 7 + Math.floor(wy))() < 0.25 + night * 0.4;
        ctx.fillStyle = night > 0.3 ? (lit ? `rgba(${winC},${0.85})` : "rgba(255,255,255,0.05)") : `rgba(${mixC(winC, [255, 255, 255], lit ? 0.5 : 0)},${lit ? 0.9 : 0.55})`;
        ctx.fillRect(wx, wy, 8, 8);
      }
      // A ledge between floors and a neon strip on the corner.
      ctx.fillStyle = `rgba(${mixC(base, [255, 255, 255], 0.35)},0.9)`; ctx.fillRect(x0, yTop + 1, wB, 2);
      ctx.strokeStyle = `rgba(${side < 0 ? neon : neon2},${0.35 + night * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(edgeX, yTop + 2); ctx.lineTo(edgeX, yBot); ctx.stroke();
      if (night > 0.3) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = night * 0.35; ctx.drawImage(runGlow((side < 0 ? neon : neon2).join(",")), edgeX - 14, yTop, 28, yBot - yTop); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
      // Now and then a neon sign hangs on the corner.
      if (r() < 0.22) {
        const sy = (yTop + yBot) / 2, sx = edgeX + side * 30, nc = r() < 0.5 ? neon : neon2, word = ["OPEN", "24H", "CAFE", "◆◆", "HOTEL", "♪", "BAR", "NEON"][Math.floor(r() * 8)];
        if (night > 0.3) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(nc.join(",")), sx - 40, sy - 24, 80, 48); ctx.globalCompositeOperation = "source-over"; }
        ctx.strokeStyle = `rgba(${nc},${0.5 + night * 0.5})`; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 20, sy - 9, 40, 18);
        ctx.fillStyle = night > 0.3 ? `rgb(${mixC(nc, [255, 255, 255], 0.4)})` : `rgb(${nc})`; ctx.font = "700 9px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(word, sx, sy + 3.5);
      }
    }
  }
  // Lumi's light on the towers close by.
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25 + night * 0.35;
  for (const side of [-1, 1]) { const ex = caveMid(R.dist) + side * caveHalf(R.dist, R.dist); ctx.drawImage(runGlow("190,245,255"), ex - 40, LY - 120, 80, 240); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  // City hazards.
  for (const it of R.items) {
    if (it.gone) continue;
    const y = yOf(it.at); if (y < -160 || y > Hu + 160) continue;
    const mid = caveMid(it.at), hw = caveHalf(it.at, R.dist);
    if (it.type === "current") {
      // A gust of wind: white streaks sweeping sideways.
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + night * 0.2})`; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      for (let q = 0; q < 12; q++) { const yy = y - (q / 12) * it.len, ph = ((t * 1.6 + q * 0.37) % 1), x0 = mid - hw + ph * hw * 2; ctx.beginPath(); ctx.moveTo(x0 - it.dir * 22, yy); ctx.quadraticCurveTo(x0, yy - 6, x0 + it.dir * 22, yy); ctx.stroke(); }
    } else if (it.type === "gate") {
      // A laser gate: beams from emitters on the towers, a gap that breathes.
      const gap = 34 + 30 * (0.5 + 0.5 * Math.sin(t * 1.6 + it.ph)) + (perk(3) ? 22 : 0);
      for (const side of [-1, 1]) {
        const x0 = mid + side * (hw + 6), x1 = mid + side * gap;
        ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,60,120"), Math.min(x0, x1) - 10, y - 14, Math.abs(x1 - x0) + 20, 28); ctx.globalCompositeOperation = "source-over";
        for (const dy of [-4, 0, 4]) { ctx.strokeStyle = dy ? "rgba(255,80,140,0.8)" : "#fff0f5"; ctx.lineWidth = dy ? 1.2 : 2; ctx.beginPath(); ctx.moveTo(x0, y + dy); ctx.lineTo(x1, y + dy); ctx.stroke(); }
        ctx.fillStyle = "#1c1f2b"; ctx.fillRect(x1 - (side > 0 ? 0 : 7), y - 9, 7, 18); ctx.fillStyle = "#ff3d7f"; ctx.fillRect(x1 - (side > 0 ? -2 : 5), y - 2, 3, 4);
      }
    } else if (it.type === "lava") {
      // A steam vent bursting from the tower wall.
      const wall = mid + it.side * hw, warn = Math.max(0, Math.sin(t * 1.3 + it.ph - 0.6));
      ctx.fillStyle = "#2a2e3a"; ctx.fillRect(wall - (it.side > 0 ? 10 : 0), y - 10, 10, 20);
      ctx.fillStyle = `rgba(255,170,60,${0.4 + warn * 0.6})`; ctx.fillRect(wall - (it.side > 0 ? 8 : -2), y - 6, 6, 12);
      if (it.len > 4) for (let q = 0; q < 9; q++) { const k = q / 8, x2 = wall - it.side * it.len * k, r2 = 8 + k * 14; ctx.fillStyle = `rgba(245,248,255,${0.75 - k * 0.5})`; ctx.beginPath(); ctx.arc(x2, y + Math.sin(t * 8 + q) * 3, r2, 0, Math.PI * 2); ctx.fill(); }
    } else if (it.type === "ice") {
      // A pane of glass falling from far above; its shadow on Lumi's line warns where.
      const warn = Math.max(0, 1 - Math.abs(it.at - R.dist) / 320);
      ctx.strokeStyle = `rgba(${night > 0.5 ? "200,230,255" : "40,60,90"},${0.5 * warn})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, LY, 10 + (1 - warn) * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(it.x, y); ctx.rotate(Math.sin(t * 3 + it.at) * 0.3);
      ctx.fillStyle = "rgba(170,220,255,0.6)"; ctx.fillRect(-9, -14, 18, 26); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -14, 18, 26);
      ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(4, 6); ctx.stroke(); ctx.restore();
    } else if (it.type === "bubble") {
      // A balloon to ride.
      const bob = Math.sin(t * 2 + it.ph) * 3, c = ["255,90,110", "255,190,60", "90,200,255", "170,120,255"][Math.floor((it.ph * 10) % 4)];
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(it.x, y + 18 + bob); ctx.quadraticCurveTo(it.x + 5, y + 30 + bob, it.x, y + 40 + bob); ctx.stroke();
      ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.ellipse(it.x, y + bob, 15, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(it.x - 5, y - 6 + bob, 4, 6, -0.4, 0, Math.PI * 2); ctx.fill();
    } else if (it.type === "lantern") {
      // A cable car swinging across the street.
      const x = it.x || mid, ax = mid + Math.sin(it.ph) * 10, ay = y - 150;
      ctx.strokeStyle = "rgba(60,64,80,0.8)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mid - hw, ay); ctx.lineTo(mid + hw, ay); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y - 12); ctx.stroke();
      ctx.fillStyle = night > 0.5 ? "#e94e6a" : "#ff5a6e"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 14, y - 12, 28, 22, 5); else ctx.rect(x - 14, y - 12, 28, 22); ctx.fill();
      ctx.fillStyle = night > 0.5 ? `rgb(${winC})` : "#cfe8ff"; ctx.fillRect(x - 10, y - 8, 8, 8); ctx.fillRect(x + 2, y - 8, 8, 8);
    } else if (it.type === "eye") {
      // A searchlight on a rooftop, its beam sweeping across the street.
      const ex = mid + it.side * hw, ang = it.ang ?? 0;
      const g = ctx.createRadialGradient(ex, y, 10, ex, y, 300); g.addColorStop(0, `rgba(255,250,220,${0.5 + Math.max(0, it.burn) * 0.8})`); g.addColorStop(1, "rgba(255,245,210,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ex, y); ctx.arc(ex, y, 300, -ang - 0.17, -ang + 0.17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2a2e3a"; ctx.beginPath(); ctx.arc(ex, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(ex + Math.cos(-ang) * 4, y + Math.sin(-ang) * 4, 6, 0, Math.PI * 2); ctx.fill();
    } else if (it.type === "power") {
      const P = RUN_POWERS[it.kind], bob = Math.sin(t * 3) * 3;
      ctx.globalCompositeOperation = night > 0.4 ? "lighter" : "source-over"; ctx.globalAlpha = night > 0.4 ? 1 : 0.5; ctx.drawImage(runGlow(P.rgb), it.x - 34, y - 34 + bob, 68, 68); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(20,22,30,0.75)"; ctx.beginPath(); ctx.arc(it.x, y + bob, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgb(${P.rgb})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "15px system-ui"; ctx.textAlign = "center"; ctx.fillText({ comet: "☄", magnet: "✧", lantern: "☀", choir: "♫" }[it.kind], it.x, y + bob + 5);
    } else if (it.type === "friend") {
      const bob = Math.sin(t * 2) * 5;
      ctx.globalAlpha = night > 0.4 ? 1 : 0.6; ctx.drawImage(runGlow("255,180,220"), it.x - 40, y - 40 + bob, 80, 80); ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff0f8"; ctx.beginPath(); ctx.arc(it.x, y + bob, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,120,190,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#3a1830"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(it.x + sd * 3, y + bob - 1, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "rgba(20,22,30,0.75)"; ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; const tw = ctx.measureText("help!").width + 12; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(it.x - tw / 2, y + bob - 30, tw, 15, 7); else ctx.rect(it.x - tw / 2, y + bob - 30, tw, 15); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText("help!", it.x, y + bob - 19);
    }
  }
  // The fork: a tower standing in the middle of the street.
  for (const it of R.items) {
    if (it.type !== "island" || it.gone) continue;
    const y0 = yOf(it.at), y1 = yOf(it.at + it.len); if (y0 < -40 || y1 > Hu + 40) continue;
    const pts = []; for (let a = it.at; a <= it.at + it.len; a += 14) pts.push([caveMid(a) - islandHalf(it, a), yOf(a)]);
    for (let a = it.at + it.len; a >= it.at; a -= 14) pts.push([caveMid(a) + islandHalf(it, a), yOf(a)]);
    ctx.fillStyle = `rgb(${mixC(tower, [0, 0, 0], 0.15 + night * 0.4)})`; ctx.beginPath(); pts.forEach((p, q) => (q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${neon},0.9)`; ctx.lineWidth = 1.6; ctx.stroke();
    for (let a = it.at + 30; a < it.at + it.len - 30; a += 16) { const hwI = islandHalf(it, a) - 8; for (let x = caveMid(a) - hwI; x < caveMid(a) + hwI - 6; x += 12) if (seeded(a + x)() < 0.3 + night * 0.4) { ctx.fillStyle = `rgba(${winC},0.85)`; ctx.fillRect(x, yOf(a), 6, 6); } }
  }
  // A storm: a living thundercloud over the street, eyes violet; gold when it's listening.
  if (R.boss) {
    const B = R.boss, x = B.x, y = yOf(B.at), s = 70 + Math.sin(R.t * 2) * 3;
    if (Math.random() < 0.03) { ctx.strokeStyle = "rgba(220,200,255,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); let lx = x + (Math.random() - 0.5) * s, ly = y + s * 0.3; ctx.moveTo(lx, ly); for (let q = 0; q < 5; q++) { lx += (Math.random() - 0.5) * 30; ly += 24; ctx.lineTo(lx, ly); } ctx.stroke(); }
    for (let q = 0; q < 9; q++) { const a = q / 9 * Math.PI * 2 + R.t * 0.3, rr = s * (0.55 + 0.15 * Math.sin(R.t * 1.5 + q)); ctx.fillStyle = B.hurt > 0 ? "rgba(90,70,130,0.95)" : "rgba(28,26,44,0.96)"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.55, y - s * 0.3 + Math.sin(a) * s * 0.35, rr, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = B.hurt > 0 ? "rgba(90,70,130,0.95)" : "rgba(28,26,44,0.98)"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.3, s * 0.9, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    const ec = B.listen > 0 ? "255,215,120" : "190,150,255";
    for (const sd of [-1, 1]) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(ec), x + sd * s * 0.3 - 24, y - s * 0.35 - 24, 48, 48); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = `rgb(${ec})`; ctx.beginPath(); ctx.ellipse(x + sd * s * 0.3, y - s * 0.35, 9, B.listen > 0 ? 7 : 4, sd * -0.3, 0, Math.PI * 2); ctx.fill(); }
    for (let q = 0; q < B.hp; q++) { ctx.fillStyle = "#ffd98a"; ctx.beginPath(); ctx.arc(x + (q - (B.hp - 1) / 2) * 12, y - s * 1.05, 3.5, 0, Math.PI * 2); ctx.fill(); }
    if (B.listen > 0) { ctx.fillStyle = "#ffe2a0"; ctx.font = "22px Georgia, serif"; ctx.textAlign = "center"; ctx.fillText("♪", x, y - s * 0.05); }
    for (const bl of B.bolts) { const by = yOf(bl.at); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("170,120,255"), bl.x - 14, by - 14, 28, 28); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(bl.x - 3, by - 7); ctx.lineTo(bl.x + 4, by - 1); ctx.lineTo(bl.x - 1, by); ctx.lineTo(bl.x + 3, by + 7); ctx.lineTo(bl.x - 4, by + 1); ctx.lineTo(bl.x + 1, by); ctx.fill(); }
  }
  // Golden threads between the lights of a trail.
  ctx.strokeStyle = night > 0.4 ? "rgba(255,215,130,0.18)" : "rgba(255,170,40,0.35)"; ctx.lineWidth = 1;
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
      ctx.globalCompositeOperation = night > 0.4 ? "lighter" : "source-over"; ctx.globalAlpha = night > 0.4 ? 1 : 0.55; ctx.drawImage(runGlow("255,190,80"), x - 20 * s, yy - 20 * s, 40 * s, 40 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(x, yy); ctx.rotate(t * 1.2 + it.at); ctx.fillStyle = night > 0.4 ? "#fff6d6" : "#ffb81c"; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let p = 0; p < 8; p++) { const rr = (p % 2 ? 2 : 6.5) * s, a = p / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); if (night <= 0.4) ctx.stroke(); ctx.restore();
    } else if (it.type === "heart") {
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("160,235,255"), it.x - 28, y - 28, 56, 56); ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(it.x, y); ctx.rotate(Math.sin(t * 2) * 0.2); ctx.fillStyle = "#e6fbff"; ctx.beginPath(); for (let p = 0; p < 8; p++) { const rr = p % 2 ? 3 : 10, a = p / 8 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore();
    } else if (it.type === "rock") {
      // A delivery drone hovering in the street: a body, four spinning rotors, a blinking light.
      const x = it.x, rr = it.r, bob = Math.sin(t * 4 + it.seed) * 2;
      ctx.fillStyle = night > 0.5 ? "#1c1f2b" : "#2a2f3d"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - rr * 0.55, y - rr * 0.35 + bob, rr * 1.1, rr * 0.7, 6); else ctx.rect(x - rr * 0.55, y - rr * 0.35 + bob, rr * 1.1, rr * 0.7); ctx.fill();
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.strokeStyle = "#2a2f3d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + bob); ctx.lineTo(x + dx * rr * 0.8, y + dy * rr * 0.6 + bob); ctx.stroke(); ctx.fillStyle = "rgba(200,210,230,0.45)"; ctx.beginPath(); ctx.ellipse(x + dx * rr * 0.8, y + dy * rr * 0.6 + bob, rr * 0.45, rr * 0.12, (t * 30 + dx) % Math.PI, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = Math.sin(t * 6 + it.seed) > 0 ? "#ff3b5c" : "#5a1020"; ctx.beginPath(); ctx.arc(x, y + bob, 2.6, 0, Math.PI * 2); ctx.fill();
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
  const tr = RUN_TRAILS[(save.run || {}).trail || 0] || RUN_TRAILS[0];
  ribbon(14, R.attract ? "150,235,255" : trailRgb(t), 0.35); ribbon(5, R.attract ? "235,252,255" : tr.core, 0.7);
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
    const sk = !R.attract && playingAs() >= 0 ? ["#fff8fc", "#ffe0f0", "#ff9ccc"] : SKINS[save.skin] && skinUnlocked(save.skin) && SKINS[save.skin].body ? SKINS[save.skin].body : ["#ffffff", "#d6f6ff", "#7fd8f5"];
    if (!R.attract && perk(9)) ctx.scale(0.8, 0.8);
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
  ctx.save(); ctx.scale(S, S); ctx.fillStyle = `rgba(${mixC(tower, [0, 0, 0], 0.55 + night * 0.35)},0.9)`;
  for (let q = -1; q < 4; q++) { const base = Math.floor(R.dist * 1.6 / 420) + q, r = seeded(base * 29 + 11); if (r() < 0.4) continue; const side = r() < 0.5 ? -1 : 1, y = LY - (base * 420 - R.dist * 1.6), x = side < 0 ? -20 + r() * 20 : W / S + 20 - r() * 20, w = 50 + r() * 40, h = 120 + r() * 90;
    ctx.fillRect(x - w, y - h, w * 2, h * 2); }
  ctx.restore();
  // Touched: a flash of violet.
  if (R.flash > 0) { ctx.fillStyle = `rgba(120,40,160,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  if (R.flash < 0) { ctx.fillStyle = `rgba(255,230,170,${-R.flash * 0.35})`; ctx.fillRect(0, 0, W, H); R.flash = Math.min(0, R.flash + 0.03); }
  // The combo counter.
  // The combo: a ring around Lumi filling toward the next ten, and the count above it.
  if (R.combo >= 3 && !R.attract) {
    const cx = W / 2 + (R.x - 200 - camX) * S, cy = LY * S, rr = 26 * S, k = (R.combo % 10) / 10;
    ctx.globalAlpha = Math.min(1, 0.5 + R.comboT);
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#ffd98a"; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, k)); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.font = `800 ${Math.round(W * 0.038)}px Inter, system-ui, sans-serif`; ctx.fillText(`×${R.combo}`, cx, cy - rr - 8);
    ctx.globalAlpha = 1;
  }
  // One message at a time in the middle, sliding in and fading out.
  const msg = R.msgs[0];
  if (msg && !R.banner) {
    const age = msg.dur - msg.t, y = H * 0.19 + Math.max(0, 0.2 - age) * 40;
    ctx.globalAlpha = Math.min(1, msg.t * 2.5, age * 5); ctx.textAlign = "center";
    ctx.font = `700 ${Math.round(W * 0.042)}px Inter, system-ui, sans-serif`;
    const t1 = msg.text, t2 = msg.sub || "", w1 = ctx.measureText(t1).width; ctx.font = `500 ${Math.round(W * 0.034)}px Inter, system-ui, sans-serif`; const w2 = ctx.measureText(t2).width;
    const pw = Math.max(w1, w2) + W * 0.1, ph = t2 ? W * 0.15 : W * 0.1;
    ctx.fillStyle = "rgba(14,16,24,0.72)"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2); else ctx.rect(W / 2 - pw / 2, y - ph / 2, pw, ph); ctx.fill();
    ctx.strokeStyle = msg.gold ? "rgba(255,217,138,0.5)" : "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `700 ${Math.round(W * 0.042)}px Inter, system-ui, sans-serif`; ctx.fillStyle = msg.gold ? "#ffd98a" : "#ffffff"; ctx.fillText(t1, W / 2, y + (t2 ? -W * 0.008 : W * 0.014));
    if (t2) { ctx.font = `500 ${Math.round(W * 0.034)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#9aa1b4"; ctx.fillText(t2, W / 2, y + W * 0.045); }
    ctx.globalAlpha = 1;
  }
  // The first run teaches by doing.
  if (R.tutText) { ctx.globalAlpha = 0.65 + 0.35 * Math.sin(R.t * 4); ctx.textAlign = "center"; ctx.fillStyle = "#eaf6ff"; ctx.font = `600 ${Math.round(W * 0.055)}px Inter, system-ui, sans-serif`; ctx.fillText(R.tutText, W / 2, H * 0.86); ctx.globalAlpha = 1; }
  // A vignette.
  const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, H * 0.8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${0.2 + night * 0.35})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // Floating "+3" when a shadow is sung free.
  ctx.textAlign = "center";
  for (const p of R.attract ? [] : R.pops || []) { const k = p.t / 1.2; ctx.globalAlpha = 1 - k; ctx.fillStyle = "#ffe2a0"; ctx.font = `600 ${Math.round(W * 0.045)}px Inter, system-ui, sans-serif`; ctx.fillText(p.text, W / 2 + (p.x - 200 - camX) * S, (yOf(p.at) - k * 40) * S); }
  ctx.globalAlpha = 1;
  // The world's name as you enter it; mission messages.
  if (R.banner > 0) {
    ctx.globalAlpha = Math.min(1, R.banner, (3 - R.banner) * 2); ctx.textAlign = "center";
    ctx.font = `600 ${Math.round(W * 0.03)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#9aa1b4"; ctx.fillText(`DISTRICT ${R.biome + 1}`.split("").join(String.fromCharCode(8202)), W / 2, H * 0.26);
    ctx.font = `700 ${Math.round(W * 0.07)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#ffffff"; ctx.fillText(runWorld(R.biome).name, W / 2, H * 0.26 + W * 0.08); ctx.globalAlpha = 1;
  }

}

function runLoop(now) {
  if (!run || screen !== "run") return;
  const c = $("runCanvas"), d = Math.min(modestPhone ? 1.25 : 1.75, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const dt = Math.min(0.05, (now - (run.last || now)) / 1000); run.last = now;
  if (!run.paused) runUpdate(dt * (run.slow || 1));
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
document.getElementById("runAgain").addEventListener("click", () => startRun({ daily: run && run.daily, challenge: run && run.challenge }));
document.getElementById("runShare").addEventListener("click", () => { if (run) shareRun(runScore(), runMetres(), run.comboBest, run.seed); });
document.getElementById("runCity").addEventListener("click", () => { run = null; showTitle(); });
// Playing as a friend: their ability.
document.getElementById("abilityBtn").addEventListener("pointerdown", e => {
  e.stopPropagation(); audio();
  const as = playingAs();
  if (!run || run.over || run.paused || as < 0 || run.abilityCd > 0) return;
  runPower(FRIEND_ABILITY[as]); run.power.t = 4; run.abilityCd = 25; runHud();
});
// Tap the trail to wear the next one you've earned.
document.getElementById("runTrail").addEventListener("click", () => {
  const r = runSave(), lv = lumiLevel(r.xp || 0).lv, open = RUN_TRAILS.map((t, i) => i).filter(i => RUN_TRAILS[i].lv <= lv);
  r.trail = open[(open.indexOf(r.trail || 0) + 1) % open.length]; persist();
  $("runTrail").textContent = `Trail: ${RUN_TRAILS[r.trail].name} ›`; sfx.tick();
});
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
  const c = $("titleCanvas"), d = Math.min(modestPhone ? 1.25 : 1.75, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
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
document.getElementById("titleCanvas").addEventListener("click", () => { if (screen === "title" && typeof playNow === "function") { playNow(challengeFrom ? { challenge: challengeFrom } : {}); return; } if (!titleRun) return; const keep = run; run = titleRun; run.songCd = 0; runSing(); run = keep; });
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

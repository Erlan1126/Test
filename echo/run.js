// Lumen Rush: the run's shell. A run is a stage (stages.js), the Night shift (endless) or the
// title's attract run; the swing itself (physics, anchors, the skyline) lives in swing.js and is
// drawn by swing2d.js. This file starts runs, keeps the HUD, missions, hearts and the "keep
// going?" offer, draws the overlay (messages, banners, the aim arrow), runs the frame loop and
// the pause and run-over cards, and plays the title's run that swings by itself.
"use strict";

const RUN = {
  BIOME_M: 350,                  // metres per world
  M: 40,                         // world units per metre
  missions: [
    { kind: "lights", goal: 40, text: n => `Gather ${n} lights in one run` },
    { kind: "dist", goal: 400, text: n => `Reach ${n} m` },
    { kind: "free", goal: 6, text: n => `Light up ${n} buildings in one run` },
    { kind: "nohit", goal: 300, text: n => `Reach ${n} m without being touched` },
    { kind: "trail", goal: 3, text: n => `Make ${n} perfect releases in one run` },
    { kind: "biome", goal: 2, text: n => `Reach district ${n}` },
  ],
  upgrades: [
    { id: "magnet", name: "Light magnet", tiers: [40, 90, 160], tip: lv => `Lights fly to you from ${9 + lv * 2} m` },
    { id: "song", name: "Longer power-ups", tiers: [50, 110, 190], tip: lv => `Power-ups last ${100 + lv * 20}% as long` },
    { id: "heart", name: "Extra heart", tiers: [120], tip: lv => `Start every stage with ${3 + lv} hearts` },
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

let run = null;
function startRun(opts = {}) {
  audio();
  const r = runSave();
  const daily = !!opts.daily;
  run = {
    daily, rng: opts.challenge ? seeded(opts.challenge.seed) : daily ? seeded(dayNumber() * 7919 + 13) : null, attract: !!opts.attract,
    seed: opts.challenge ? opts.challenge.seed : daily ? dayNumber() * 7919 + 13 : 0, challenge: opts.challenge || null, hard: !opts.attract && !!(save.run || {}).hardOn, boss: null, forks: 0,
    combo: 0, comboBest: 0, comboT: 0, boost: 0, dashCd: 0, dashT: 0, power: null, event: null, nextEvent: 250, hunterGap: 1, pops: [], msgs: [], friendSpawned: false, continues: 0, slow: 1, tut: 0, tutText: '',
    dist: 0, speed: 170, x: 200, tx: 200, vx: 0, hearts: 3 + runUpg("heart"), inv: 0, over: 0,
    lights: 0, freed: 0, songs: 0, hitAt: 0, trails: 0, songCd: 0, rings: [], items: [], parts: [], trail: [],
    next: 260, note: 0, biome: 0, banner: 1.5, flash: 0, t: 0, mult: r.mult, paused: false, nohit: true,
  };
  // A stage: a fixed course (same seed every time), a ghost to race.
  if (opts.stage != null) { const si = stageInfo(opts.stage); Object.assign(run, { stage: opts.stage, stageInfo: si, rng: seeded(si.seed), seed: si.seed, ghostTrace: opts.ghost || null, ghostLabel: opts.ghostLabel || "", raceTime: opts.raceTime || 0 }); }
  runnerStart(run);
  if (opts.attract) { run.hearts = 1e9; return run; }
  if (!r.tutDone && !daily) run.tut = 1;
  if (run.hard) run.hearts = 1;
  // Without a seed, pick one now, so the run can be shared as a challenge.
  if (!run.rng) { run.seed = 1 + Math.floor(Math.random() * 1e9); run.rng = seeded(run.seed); }
  progressEvent("runs");
  for (const m of r.missions) m.run = 0;
  musicStart(4242, 2);
  // Each district has its own groove: key, chords and tempo; the Night shift keeps the first one.
  { const dn = run.stageInfo && !run.stageInfo.daily ? Math.min(5, Math.floor((run.stageInfo.n - 1) / 10)) : -1; music.district = [{ base: 110, prog: [0, 5, 2, 6], bpm: 116 }, { base: 146.83, prog: [0, 3, 4, 0], bpm: 108 }, { base: 98, prog: [0, 5, 3, 4], bpm: 100 }, { base: 123.47, prog: [0, 6, 5, 4], bpm: 126 }, { base: 130.81, prog: [0, 4, 5, 3], bpm: 104 }, { base: 110, prog: [0, 2, 5, 6], bpm: 120 }][dn] || null; }
  show("run");
  $("runOver").hidden = true; $("runPause").hidden = true; if ($("stageCard")) $("stageCard").hidden = true;
  runHud();
  // One render loop only: a retry or a second tap must not start another.
  if (!runLoop.on) { runLoop.on = true; requestAnimationFrame(runLoop); }
}
const runMetres = () => Math.floor(run.dist / RUN.M);
const runScore = () => Math.floor((run.dist / RUN.M * run.mult + run.lights * 2 * run.mult) * (run.hard ? 2 : 1) * (weekEvent().id === "shadow" ? 1.5 : 1));

function runHit() {
  run.hearts--; run.inv = 1.6; run.flash = 1; run.nohit = false; run.hitAt = runMetres(); run.shake = 1;
  sfx.crash(); buzz([30, 40, 30]);
  if (run.hearts <= 0 && run.mode3) { run.shatter = Array.from({ length: 28 }, (_, q) => { const a = q / 28 * Math.PI * 2 + Math.random() * 0.2, v = 6 + Math.random() * 10; return { x: run.px, y: run.py + 1, vx: Math.cos(a) * v + (run.vx || 0) * 0.3, vy: Math.sin(a) * v + 4 }; }); run.slow = 0.35; }
  if (run.hearts <= 0 && run.stageInfo) { stageFail(); return; }
  if (run.hearts <= 0) { if (!run.hard && run.continues < 2 && (save.glow || 0) + run.lights >= continueCost()) runOfferContinue(); else runEnd(); }
}
function runMission(kind, value) {
  if (run.attract || run.cleared) return;
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
  const after = lumiLevel(r.xp);
  run.levelInfo = { before, after, gained };
  if (run.daily) { r.dailyDay = dayNumber(); r.dailyBest = Math.max(r.dailyDay === dayNumber() ? r.dailyBest || 0 : 0, score); }
  streakTouch();
  const bonus = Math.round(run.lights * streakBonus());
  save.glow = (save.glow || 0) + run.lights + bonus;
  run.streakBonus = bonus;
  progressEvent("dist", runMetres());
  run.seasonPaid = seasonGain(Math.round(score / 10));
  if (run.hard) { save.prog = save.prog || {}; save.prog.hardDist = Math.max(save.prog.hardDist || 0, runMetres()); }
  // Your best distance (the arch on the avenue), your top runs, and today's daily ghost.
  r.bestM = Math.max(r.bestM || 0, runMetres());
  // Restoring the city: every building you relight counts for good; every 150 pays out.
  if (run.mode3) {
    const c = save.city || (save.city = { lit: 0 }), before = Math.floor(c.lit / 150); c.lit += run.lit || 0;
    const tiers = Math.floor(c.lit / 150) - before; if (tiers > 0) save.glow = (save.glow || 0) + tiers * 50;
    run.cityTiers = tiers;
    // A light capsule for a long or skilful run.
    if (runMetres() >= 600 || (run.perfects || 0) >= 10) { save.capsules = (save.capsules || 0) + 1; run.gotCapsule = true; }
  }
  r.top = (r.top || []).concat([{ s: score, m: runMetres(), d: dayNumber(), c: runnerChar().name, daily: !!run.daily }]).sort((a, b) => b.s - a.s).slice(0, 10);
  if (run.mode3 && run.daily && run.rec && (!save.ghost || save.ghost.day !== dayNumber() || score >= (save.ghost.s || 0))) save.ghost = { day: dayNumber(), s: score, rec: Array.from(run.rec, v => v ?? null) };
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
    if (run.mode3) $("runLevel").textContent += ` · ${run.lit} relit · City ${cityPct()}%` + (run.cityTiers ? ` · +${run.cityTiers * 50} ✦` : "") + (run.gotCapsule ? " · Light capsule!" : "");
    $("runLevelBar").style.width = `${Math.round(li.after.into / li.after.need * 100)}%`;
    if (best) { sfx.win(); buzz([20, 40, 20, 40]); }
    $("runOverInfo").textContent = `${runMetres()} m · ✦ ${run.lights} lights · best combo ${run.comboBest}`;
    $("runOverTitle").textContent = run.challenge ? (score > run.challenge.score ? "Challenge won" : "Challenge lost") : run.daily ? "Daily run" : run.hard ? "Hard run" : "Run over";
    const dm = dailyMissions();
    // Endless is the Night shift: how many windows you lit, and this week's best.
    if (run.mode3 && !run.stageInfo && !run.challenge && !run.daily) {
      const wk = weekNumber(), ns = r.night && r.night.week === wk ? r.night : (r.night = { week: wk, best: 0 }), lit = run.lit || 0, nb = lit > ns.best; if (nb) ns.best = lit; progressEvent("nightlit", lit); checkAchievements(); persist();
      $("runOverTitle").textContent = "Night shift over"; $("roCombo").textContent = lit; $("roCombo").nextElementSibling.textContent = "windows lit";
      $("runOverBest").textContent = nb ? "Week's best" : best ? "New best" : `Best ${r.best.toLocaleString()}`;
    } else if ($("roCombo").nextElementSibling) $("roCombo").nextElementSibling.textContent = "best combo";
    $("runOverDaily").textContent = (run.mode3 && !run.stageInfo && !run.challenge && !run.daily ? `This week's best: ${(r.night || {}).best || 0} windows · ` : "") + `Daily missions ${dm.list.filter(m => m.done).length}/3` + (streakNow() ? ` · ${streakNow()}-day streak` : "") + (run.streakBonus ? ` · +${run.streakBonus} streak lights` : "") + (run.seasonPaid ? ` · season +${run.seasonPaid}` : "");
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
  const H = runHud.c || (runHud.c = {}), set = (k, v, f) => { if (H[k] !== v) { H[k] = v; f(v); } };
  if (run.stageInfo) {
    // The clock, green while you're under par.
    const tm = (run.stageT || 0).toFixed(1), par = run.stageInfo.par, cls = run.stageT <= par ? "under" : "over";
    set("tm", tm, v => { $("runScore").textContent = v; }); set("tcls", cls, v => { $("runScore").className = "score " + v; });
    // Stars as you earn them: 40% of the lights, then 70% with no hits under par (dims once it's out of reach).
    const sh = (run.motesGot || 0) / Math.max(1, run.motesTotal || 1), s2 = sh >= 0.4, s3ok = !run.hitsTaken && run.stageT <= par, s3 = sh >= 0.7 && s3ok;
    set("stars", `${s2}${s3}${s3ok}${!!run.cleared}`, () => { const st = $("runStars"); st.hidden = false; const is = st.children; is[0].className = run.cleared ? "on" : ""; is[1].className = s2 ? "on" : ""; is[2].className = s3 ? "on" : s3ok ? "" : "lost"; });
  } else { set("tm", runScore().toLocaleString(), v => { $("runScore").textContent = v; }); set("tcls", "", () => { $("runScore").className = "score"; $("runStars").hidden = true; }); }
  set("li", run.lights, v => { const el = $("runLights"); el.textContent = `✦ ${v}`; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); });
  { const sp = $("stageProg"); if (sp) { const on = !!run.stageInfo; if (sp.hidden === on) sp.hidden = !on; if (on) { const k = Math.max(0, Math.min(1, (run.px || 0) / (run.stageLen || 1))), w = (k * 100).toFixed(1) + "%"; { const bf = $("jBest"); if (run.bestFlash > 0) { run.bestFlash = Math.max(0, run.bestFlash - 0.02); bf.style.transform = `translateX(-50%) scale(${1 + run.bestFlash * 0.8})`; bf.style.color = "#fff"; } else if (bf.style.color) { bf.style.transform = ""; bf.style.color = ""; } } if (sp.dataset.w !== w) { sp.dataset.w = w; $("stageProgFill").style.width = w; $("jFig").style.left = w; } if (sp.dataset.n !== String(run.stage)) { sp.dataset.n = String(run.stage); $("jName").textContent = typeof stagePerson === "function" ? stagePerson(run.stage)[0] : ""; const bp = run.stageInfo.daily ? 0 : ((stageSave().pct || {})[run.stage] || 0); $("jBest").hidden = !(bp > 0); $("jBest").style.left = bp + "%"; } } } }
  const maxH = Math.max(run.hearts, run.hard ? 1 : 3 + runUpg("heart"));
  set("hearts", `${run.hearts}/${maxH}`, () => { $("runHearts").innerHTML = Array.from({ length: maxH }, (_, q) => `<i class="${q < run.hearts ? "on" : ""}"></i>`).join(""); });
  set("mult", run.stageInfo ? `${run.stageInfo.daily ? "Daily" : `Stage ${run.stageInfo.n}`} · ${Math.max(0, Math.min(100, Math.floor((run.px || 0) / (run.stageLen || 1) * 100)))}%` : `×${run.mult}`, v => { $("runMult").textContent = v; });
  $("runPower").textContent = run.power ? `${RUNNER_POWERS[run.power.kind].name} ${Math.ceil(run.power.t)}` : "";
}

const runR = () => (run && run.rng ? run.rng() : Math.random());

function runMsg(text, sub = "", dur = 2, gold = false) {
  if (run.attract) return;
  // After the finish, only the celebration speaks.
  if (run.cleared && !gold) return;
  if (run.msgs.length > 2) run.msgs.splice(1, 1);
  run.msgs.push({ text, sub, t: dur, dur, gold });
}

// ---------- Your level ----------
// Every run earns experience (a tenth of the score); each level asks a little more.
const xpFor = lv => Math.round(90 * Math.pow(lv, 1.35));
function lumiLevel(xp = (save.run || {}).xp || 0) {
  let lv = 1, left = xp;
  while (left >= xpFor(lv)) { left -= xpFor(lv); lv++; }
  return { lv, into: left, need: xpFor(lv) };
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
  if (run) { run.shatter = null; run.slow = 1; run.hold = false; run.grabBuf = 0; }
  clearInterval(continueTimer);
  let cost = continueCost();
  const fromRun = Math.min(run.lights, cost); run.lights -= fromRun; cost -= fromRun; save.glow = Math.max(0, (save.glow || 0) - cost);
  run.continues++; run.hearts = 1; run.inv = 2.5; run.paused = false; run.last = 0;
  $("runContinue").hidden = true; sfx.gate(); runMsg("Keep going!", "", 1.4, true); runHud();
}
document.getElementById("runContinueGo").addEventListener("click", e => { e.stopPropagation(); runContinue(); });
document.getElementById("runContinueNo").addEventListener("click", e => { e.stopPropagation(); runDecline(); });

function runBonus(text, lights, at = run.dist + 30, x = run.x) {
  run.lights += lights;
  // One message at a time: a new one replaces the last instead of stacking on top of it.
  if (run.mode3) run.pops = run.pops.filter(p => p.t > 0.9);
  run.pops.push({ text, x, at, t: 0 });
}

// ---------- Update ----------
function runUpdate(dt) { runnerUpdate(dt); }

// ---------- Drawing ----------
const mixC = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
// The city's skies and colours, from a bright morning through golden hour and pink dusk into
// neon night and the stars. Each has its own sky, towers, windows and neon; the swing reads them
// in reverse, from midnight toward dawn.
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
// Each district has its own hour of the night, and the Tower climbs toward dawn (stage 60 is sunrise).
// (The swing view reads the worlds in reverse, hence 7 - index.)
const stageSky = si => 7 - (si.daily ? [6, 5, 4, 7, 3][dayNumber() % 5] : si.n === 60 ? 2 : si.n > 55 ? 3 : [6, 3, 5, 4, 7, 7][Math.min(5, Math.floor((si.n - 1) / 10))]);

function runDraw(ctx, W, H) {
  const R = run;
  // Each district has its own sky and colours; in the Night shift they blend into the next.
  const m = R.dist / RUN.M, b = R.stageInfo ? stageSky(R.stageInfo) : Math.floor(m / RUN.BIOME_M), f = R.stageInfo ? 0 : Math.max(0, (m % RUN.BIOME_M - (RUN.BIOME_M - 60)) / 60);
  const w1 = runWorld(7 - (b % 8)), w2 = runWorld(7 - ((b + 1) % 8)), mixW = k => mixC(w1[k], w2[k], f);
  const night = w1.night + (w2.night - w1.night) * f, tower = mixW("tower"), winC = mixW("win"), neon = mixW("neon"), neon2 = mixC(w1.neon2 || w1.neon, w2.neon2 || w2.neon, f);
  const pal = { night, tower, winC, neon, neon2, rain: f < 0.5 ? w1.rain : w2.rain, sky: [mixC(w1.sky[0], w2.sky[0], f), mixC(w1.sky[1], w2.sky[1], f), mixC(w1.sky[2], w2.sky[2], f)] };
  if (R.ev && R.ev.kind === "blackout") Object.assign(pal, { night: 1, blackout: true, sky: [[3, 4, 9], [7, 9, 16], [12, 14, 24]] });
  const P2 = SW2D.draw(ctx, W, H, pal), pxU = SW2D.pxU;
  if (!P2) { ctx.fillStyle = "#0b0d14"; ctx.fillRect(0, 0, W, H); return; }
  // Touched: a flash of violet.
  if (R.flash > 0 && !(save.settings && save.settings.calm)) { ctx.fillStyle = `rgba(120,40,160,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  if (R.flash < 0) { ctx.fillStyle = `rgba(255,230,170,${-R.flash * 0.35})`; ctx.fillRect(0, 0, W, H); R.flash = Math.min(0, R.flash + 0.03); }

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
  if (R.tutText) {
    const cx = W / 2, cy = H * 0.78, rr = W * 0.07, held = R.hold || !!R.teth, pulse = 1 + 0.12 * Math.sin(R.t * 6);
    ctx.strokeStyle = "rgba(191,244,255,0.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr * pulse, 0, Math.PI * 2); ctx.stroke();
    if (held) { ctx.fillStyle = "rgba(191,244,255,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, rr * pulse, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#eaf6ff"; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  if (R.tutText) { ctx.globalAlpha = 0.65 + 0.35 * Math.sin(R.t * 4); ctx.textAlign = "center"; ctx.fillStyle = "#eaf6ff"; ctx.font = `600 ${Math.round(W * 0.055)}px Inter, system-ui, sans-serif`; ctx.fillText(R.tutText, W / 2, H * 0.86); ctx.globalAlpha = 1; }
  // Speed: streaks rushing out from the middle when the runner is flying.
  const calmFx = !!(save.settings && save.settings.calm);
  if (R.od > 0 && (R.v || 0) > 16 && !R.over && !R.attract && !calmFx) {
    const k = Math.min(1, ((R.v || 0) - 16) / 12) * (R.power && R.power.kind === "jet" ? 1.4 : 1), cx = W / 2, cy = H * 0.42;
    ctx.strokeStyle = `rgba(255,255,255,${0.09 * k})`; ctx.lineWidth = 1.5;
    for (let q = 0; q < 12; q++) { const r = seeded(q * 31 + Math.floor(R.t * 5)), a = r() * Math.PI * 2, d0 = W * (0.35 + r() * 0.3), d1 = d0 + W * (0.1 + k * 0.25); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 1.4); ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1 * 1.4); ctx.stroke(); }
  }
  // The swing: an arrow to the next anchor when it's off screen, and the darkness creeping in.
  if (!R.attract && !R.over) {
    // A Perfect: a white flash and a ring around the figure.
    if (R.perfT > 0 && !calmFx) { const k = 1 - R.perfT / 0.45, q = P2(R.x, R.dist); if (!R.pChain || R.pChain === 1 || R.pChain % 5 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - k)})`; ctx.fillRect(0, 0, W, H); } ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1] + W * 0.05, W * (0.05 + k * 0.3), 0, Math.PI * 2); ctx.stroke(); }
    if (R.od > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); g.addColorStop(0, "rgba(255,190,60,0)"); g.addColorStop(1, `rgba(255,190,60,${0.18 + 0.06 * Math.sin(R.t * 8)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (R.scrDark != null && R.scrDark > -W * 0.6) { const k = Math.max(0, Math.min(1, (R.scrDark + W * 0.6) / (W * 0.8))), g = ctx.createLinearGradient(0, 0, W * (0.15 + 0.35 * k), 0); g.addColorStop(0, `rgba(10,3,24,${0.85 * k})`); g.addColorStop(1, "rgba(10,3,24,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const a = R.scrAim;
    if (a && (a[0] < 16 || a[0] > W - 16 || a[1] < 16 || a[1] > H - 16)) {
      const cx = Math.max(22, Math.min(W - 22, a[0])), cy = Math.max(70, Math.min(H - 90, a[1])), ang = Math.atan2(a[1] - cy, a[0] - cx) || -Math.PI / 4;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(R.t * 8); ctx.fillStyle = "#bff4ff";
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // Floating "+3" when a shadow is sung free.
  ctx.textAlign = "center";
  for (const p of R.attract ? [] : R.pops || []) { const k = p.t / 1.2; ctx.globalAlpha = 1 - k; ctx.fillStyle = "#ffe2a0"; ctx.font = `600 ${Math.round(W * 0.045)}px Inter, system-ui, sans-serif`; const q = P2(p.x, p.at); ctx.fillText(p.text, q[0], q[1] - k * 40 * pxU); }
  ctx.globalAlpha = 1;
  // The world's name as you enter it; mission messages.
  if (R.banner > 0 && !R.attract) {
    ctx.globalAlpha = Math.min(1, R.banner, (3 - R.banner) * 2); ctx.textAlign = "center";
    ctx.font = `600 ${Math.round(W * 0.03)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#9aa1b4"; ctx.fillText((R.stageInfo ? (!R.stageInfo.daily ? stageChapter(R.stageInfo.n) : runnerTheme(0).name).toUpperCase() : runWorld(7 - (R.biome % 8)).name.toUpperCase()).split("").join(String.fromCharCode(8202)), W / 2, H * 0.26);
    ctx.font = `700 ${Math.round(W * 0.07)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#ffffff"; ctx.fillText(R.stageInfo ? (R.stageInfo.daily ? "Daily stage" : R.stageInfo.boss ? `Boss · Stage ${R.stageInfo.n}` : `Stage ${R.stageInfo.n}`) : runnerTheme(R.biome * RUN.BIOME_M).name, W / 2, H * 0.26 + W * 0.08);
    if (R.stageInfo) { ctx.font = `600 ${Math.round(W * 0.042)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#ffd98a"; ctx.fillText(`${stageWaiting(R.stageInfo.n)} in the dark`, W / 2, H * 0.26 + W * 0.15); if (R.attempt > 1) { ctx.font = `700 ${Math.round(W * 0.036)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillText(`Attempt ${R.attempt}`, W / 2, H * 0.26 + W * 0.22); } }
    ctx.globalAlpha = 1;
  }

}

// Frame pacing: an FPS counter (Settings) and, in the 2D view, a resolution that adapts to the phone.
const pace = { ema: 0.016, t: 0, frames: 0, fpsT: 0, d2: 1.5 };
function paceTick(dt) {
  if (!(dt > 0 && dt < 0.25)) return;
  pace.ema += (dt - pace.ema) * 0.06; pace.t += dt; pace.frames++; pace.fpsT += dt;
  if (pace.fpsT >= 0.5) { if (save.settings && save.settings.fps) { const el = $("fpsMeter"); el.hidden = false; el.textContent = `${Math.round(pace.frames / pace.fpsT)} fps · ${pace.d2.toFixed(2)}x`; } pace.frames = 0; pace.fpsT = 0; }
  if (pace.t > 1.2) { pace.t = 0; if (pace.ema > 0.0205 && pace.d2 > 1) pace.d2 = Math.max(1, pace.d2 - 0.25); else if (pace.ema < 0.0148 && pace.d2 < 1.5) pace.d2 = Math.min(1.5, pace.d2 + 0.25); }
}
function smoothCanvas(c, on) {
  let sc = c.smoothTwin;
  if (!sc && on) { sc = document.createElement("canvas"); sc.className = "smoothc"; c.parentNode.insertBefore(sc, c); c.smoothTwin = sc; sc.ctx = sc.getContext("2d", { alpha: false }); }
  if (sc) sc.style.display = on ? "" : "none";
  c.style.opacity = on ? "0" : "";
  return on ? sc : c;
}
const canvasD = () => Math.min(pace.d2, window.devicePixelRatio || 1);
function runLoop(now) {
  if (!run || screen !== "run") { runLoop.on = false; return; }
  const c0 = $("runCanvas"), c = smoothCanvas(c0, true), d = canvasD(), W = c0.clientWidth, H = c0.clientHeight;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const dt = Math.min(0.05, (now - (run.last || now)) / 1000); run.last = now; paceTick((now - (pace.last || now)) / 1000); pace.last = now;
  // A split-second freeze on a grab or a Perfect makes it land (the picture still draws).
  if (run.hitstop > 0 && !run.paused) run.hitstop -= dt; else if (!run.paused) runUpdate(dt * (run.slow || 1));
  const ctx = c.ctx || c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  // While paused, the picture stands still: draw it once, then rest (saves battery and heat).
  if (!run.paused || !run.drawnPaused) { runDraw(ctx, W, H); run.drawnPaused = run.paused; }
  // The best moment of the run, kept as a picture to share.
  if (run && run.wantShot) { run.wantShot = false; try { run.moment = c.toDataURL("image/jpeg", 0.72); } catch (e) {} run.shotAt = run.t; }
  requestAnimationFrame(runLoop);
}

// ---------- Input: hold to grab, let go to fly, swipe right to dash ----------
{
  const c = document.getElementById("runCanvas");
  let p = null; const downs = new Set();
  c.addEventListener("pointerdown", e => { audio(); downs.add(e.pointerId); if (run) swingHold(true); p = { x: e.clientX, y: e.clientY, sx: e.clientX }; try { c.setPointerCapture(e.pointerId); } catch (err) {} });
  c.addEventListener("pointermove", e => {
    if (!p || !run) return;
    if (!p.dashed && e.clientX - p.sx > 45 && Math.abs(e.clientY - p.y) < 70) { p.dashed = true; swingDash(); }
  });
  const end = e => { downs.delete(e.pointerId); if (downs.size) return; if (run) swingHold(false); p = null; };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
  // Leaving the page or pausing forgets any finger that was down.
  window.addEventListener("blur", () => { downs.clear(); if (run) swingHold(false); p = null; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { downs.clear(); if (run) swingHold(false); p = null; } });
  window.addEventListener("keydown", e => { if (screen === "run" && e.key === " ") e.preventDefault(); });
}
// The pause card: who is waiting, and how each star is going so far.
function runPauseInfo() {
  const R = run, who = $("pzWho"), ul = $("pzGoals"); if (!who || !ul) return;
  if (!R || !R.stageInfo) { who.textContent = ""; ul.innerHTML = ""; return; }
  const tot = Math.max(1, R.motesTotal), share = R.motesGot / tot, par = R.stageInfo.par, pct = Math.max(0, Math.min(100, Math.floor(R.px / R.stageLen * 100)));
  who.textContent = `${stageWaiting(R.stageInfo.n)} · ${pct}% of the way`;
  const g = (stars, text, now, ok, alive = true) => `<li class="${ok ? "ok" : alive ? "" : "no"}"><b>${stars}</b><span>${text}</span><em>${now}</em></li>`;
  ul.innerHTML = g("★", "Reach their home", `${pct}%`, false) + g("★★", "Catch 40% of the lights", `${Math.round(share * 100)}%`, share >= 0.4) +
    g("★★★", `70% lights, no hits, under ${par.toFixed(1)} s`, `${Math.round(share * 100)}% · ${R.hitsTaken || 0} hit${R.hitsTaken === 1 ? "" : "s"} · ${(R.stageT || 0).toFixed(1)} s`, false, !R.hitsTaken && (R.stageT || 0) < par);
}
document.getElementById("runPauseBtn").addEventListener("click", e => { e.stopPropagation(); if (!run || run.over) return; run.paused = true; runPauseInfo(); $("runPause").hidden = false; musicStop(); });
document.getElementById("runResume").addEventListener("click", () => { run.paused = false; run.hold = false; run.grabBuf = 0; run.last = 0; $("runPause").hidden = true; musicStart(4242, 2); });
document.getElementById("runQuit").addEventListener("click", () => { run = null; showTitle(); });
document.getElementById("runAgain").addEventListener("click", () => startRun({ daily: run && run.daily, challenge: run && run.challenge }));
document.getElementById("runShare").addEventListener("click", () => { if (run) shareRun(runScore(), runMetres(), run.comboBest, run.seed); });
document.getElementById("runCity").addEventListener("click", () => { run = null; showTitle(); });
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
  const c0 = $("titleCanvas"), c = smoothCanvas(c0, true), d = Math.min(pace.d2, window.devicePixelRatio || 1), W = c0.clientWidth, H = c0.clientHeight;
  paceTick((now - (pace.last || now)) / 1000); pace.last = now;
  if (W && c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const keep = run; run = titleRun;
  const dt = Math.min(0.05, (now - (titleRun.last || now)) / 1000); titleRun.last = now;
  // It swings by itself.
  runnerAuto(); titleRun.inv = Math.max(titleRun.inv, 0);
  runUpdate(dt);
  if (titleRun.dist > 60000) { titleRun = null; run = keep; startTitleRun(); return; }
  const ctx = c.ctx || c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  if (W) runDraw(ctx, W, H);
  run = keep;
  titleRaf = requestAnimationFrame(titleLoop);
}
// Tapping the city behind the title plays (a challenge link starts the friend's run).
document.getElementById("titleCanvas").addEventListener("click", () => { if (screen !== "title") return; if (!challengeFrom) { $("playBtn").click(); return; } playNow({ challenge: challengeFrom }); });
// Upgrades, from the Shop.
function runBuy(id) {
  const u = RUN.upgrades.find(q => q.id === id), r = runSave(), lv = runUpg(u.id), cost = u.tiers[lv];
  if (cost == null || (save.glow || 0) < cost) return false;
  save.glow -= cost; r.upg[u.id] = lv + 1; persist(); sfx.unlock(); buzz(20); return true;
}
function runShopHtml() {
  const icons = { magnet: "🧲", song: "⏳", heart: "❤" };
  return RUN.upgrades.map(u => {
    const lv = runUpg(u.id), next = u.tiers[lv], afford = next != null && (save.glow || 0) >= next;
    return `<li class="shop-upg"><span class="ui">${icons[u.id] || "✦"}</span><span><b>${u.name}</b><small>${u.tip(lv)}${next != null ? ` → <b>${u.tip(lv + 1).replace(/^.*?(\d+[^ ]*).*$/, "$1")}</b>` : ""}</small><span class="lv">${u.tiers.map((_, q) => `<i class="${q < lv ? "on" : ""}"></i>`).join("")}</span></span>` +
      (next == null ? `<em>Maxed</em>` : `<button data-run="${u.id}" ${afford ? "" : "disabled"}>✦ ${next}</button>`) + "</li>";
  }).join("");
}
function runShop() {
  $("runShopList").innerHTML = runShopHtml();
  $("runGlowLeft").textContent = save.glow || 0;
}

// Leaving the app mid-run pauses it.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "run" && run && !run.over && !run.paused && !run.attract) { run.paused = true; run.drawnPaused = false; runPauseInfo(); $("runPause").hidden = false; musicStop(); }
});

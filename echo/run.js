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
function startRun() {
  audio();
  const r = runSave();
  run = {
    dist: 0, speed: 170, x: caveMid(0), tx: caveMid(0), vx: 0, hearts: 3 + runUpg("heart"), inv: 0, over: 0,
    lights: 0, freed: 0, songs: 0, hitAt: 0, trails: 0, songCd: 0, rings: [], items: [], parts: [], trail: [],
    next: 260, note: 0, biome: 0, banner: 1.5, flash: 0, t: 0, mult: r.mult, paused: false, nohit: true,
  };
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
  const R = Math.random, mid = caveMid(at), hw = caveHalf(at, run.dist);
  const roll = R(), hard = Math.min(1, run.dist / 40000);
  if (roll < 0.46) {
    const n = 7 + Math.floor(R() * 6), amp = hw * (0.25 + R() * 0.35), ph = R() * 6, id = Math.random();
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
  if (!run || run.over || run.paused || run.songCd > 0) return;
  run.songCd = 1.1 - runUpg("song") * 0.2;
  run.songs++;
  run.rings.push({ x: run.x, at: run.dist, r: 0, max: 150 + runUpg("song") * 28 });
  sfx.ping(run.songs); buzz(8);
  runMission("songs", run.songs);
}
function runHit() {
  run.hearts--; run.inv = 1.6; run.flash = 1; run.nohit = false; run.hitAt = runMetres(); run.shake = 1;
  sfx.caught(); buzz([30, 40, 30]);
  if (run.hearts <= 0) runEnd();
}
function runMission(kind, value) {
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
  save.glow = (save.glow || 0) + run.lights;
  persist();
  musicStop(); sfx.fail();
  setTimeout(() => {
    if (!run) return;
    $("runOverScore").textContent = score.toLocaleString();
    $("runOverBest").textContent = best ? "A new best!" : `Best ${r.best.toLocaleString()}`;
    $("runOverInfo").textContent = `${runMetres()} m · ✦ ${run.lights} lights · ${run.freed} shadows set free`;
    runMissions($("runOverMissions")); runShop();
    $("runOver").hidden = false;
  }, 900);
}
function runMissions(el) {
  const r = runSave();
  el.innerHTML = r.missions.map(m => `<li>${RUN.missions[m.k].text(m.goal)}</li>`).join("") + `<li class="mult">Score multiplier ×${r.mult}</li>`;
}
function runHud() {
  $("runScore").textContent = runScore().toLocaleString();
  $("runLights").textContent = `✦ ${run.lights}`;
  $("runHearts").textContent = "●".repeat(Math.max(0, run.hearts)) + "○".repeat(Math.max(0, 3 + runUpg("heart") - run.hearts));
  $("runMult").textContent = `×${run.mult}`;
}

// ---------- Update ----------
function runUpdate(dt) {
  const R = run;
  R.t += dt;
  if (R.over) { R.over += dt; R.speed *= 0.96; R.dist += R.speed * dt; return; }
  R.speed = Math.min(400, 200 + R.dist * 0.006);
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
  if (b !== R.biome) { R.biome = b; R.banner = 3; mood = MOODS[b % MOODS.length]; sfx.gate(); runMission("biome", b + 1); }
  while (R.next < R.dist + 1100) R.next += runSpawn(R.next);
  const magnet = runUpg("magnet") ? 40 + runUpg("magnet") * 30 : 0;
  for (const it of R.items) {
    if (it.gone) continue;
    const dy = it.at - R.dist;
    if (it.type === "shadow" && !it.freed) { it.ph += dt; if (dy > 0 && dy < 260) it.x += Math.sign(R.x - it.cx) * dt * 22; it.cx = it.x + Math.sin(it.ph * 0.9) * it.amp; it.at -= dt * 18; }
    if (it.got != null) { it.got += dt; if (it.got > 0.16) it.gone = true; continue; }
    const ix = it.type === "shadow" ? it.cx : it.x, d = Math.hypot(ix - R.x, dy);
    if (it.type === "light" && magnet && d < magnet) { it.x += (R.x - it.x) * Math.min(1, dt * 8); it.at += (R.dist - it.at) * Math.min(1, dt * 8); }
    if (it.type === "light" && it.got == null && d < 20) {
      it.got = 0; R.lights++; R.happy = 0.25;
      // Each light is the next note of a melody.
      const tune = LULLABY_TUNE[R.note++ % LULLABY_TUNE.length][0];
      note(261.63 * Math.pow(2, (tune + 12) / 12), { dur: 0.7, vol: 0.05, fm: 3, fmDepth: 0.6, echo: 0.8 });
      for (let k = 0; k < 6; k++) R.parts.push({ x: it.x, at: it.at, vx: (Math.random() - 0.5) * 60, va: (Math.random() - 0.3) * 60, life: 0.6, gold: true });
      if (!R.items.some(o => o.trail === it.trail && o.type === "light" && !o.gone && o.got == null)) { R.trails++; runMission("trail", R.trails); R.pops = R.pops || []; R.pops.push({ text: "Whole trail!", x: R.x, at: R.dist + 40, t: 0 }); }
      runMission("lights", R.lights);
    }
    if (it.type === "heart" && d < 22) { it.gone = true; R.hearts = Math.min(3 + runUpg("heart"), R.hearts + 1); sfx.light(); }
    if (it.type === "rock" && d < it.r + 12 && R.inv <= 0) { R.tx += ix < R.x ? 40 : -40; R.vx += ix < R.x ? 260 : -260; R.speed *= 0.85; R.inv = 0.4; R.shake = 0.5; sfx.bump(); buzz(15); }
    if (it.type === "shadow" && !it.freed && d < 24 && R.inv <= 0) { it.freed = true; it.gone = true; runHit(); }
    if (dy < -500) it.gone = true;
  }
  R.items = R.items.filter(it => !it.gone || it.burst);
  // Songs roll out; shadows they reach turn back into light.
  for (const ring of R.rings) {
    ring.r += dt * 380; ring.at = R.dist;
    for (const it of R.items) if (it.type === "shadow" && !it.freed && Math.hypot(it.cx - ring.x, it.at - ring.at) < ring.r) {
      it.freed = true; R.freed++; R.lights += 3; R.pops = R.pops || []; R.pops.push({ text: "+3 ✦", x: it.cx, at: it.at, t: 0 });
      for (let k = 0; k < 16; k++) R.parts.push({ x: it.cx, at: it.at, vx: (Math.random() - 0.5) * 120, va: Math.random() * 120, life: 1.2, gold: true });
      sfx.rune(); runMission("free", R.freed); runMission("lights", R.lights);
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
  ctx.drawImage(runGlow("150,235,255"), R.x - 70 * pulse, LY - 70 * pulse, 140 * pulse, 140 * pulse);
  ctx.globalCompositeOperation = "source-over";
  if (!(R.inv > 0.4 && Math.floor(R.inv * 12) % 2)) {
    const tilt = R.tilt || 0, stretch = 1 + Math.min(0.18, Math.abs(R.vx || 0) * 0.0007) + fast * 0.06, bob = Math.sin(t * 2.6) * 1.5;
    ctx.save(); ctx.translate(R.x, LY + bob); ctx.rotate(tilt);
    ctx.strokeStyle = `rgba(200,245,255,${0.35 + 0.25 * Math.sin(t * 3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 17 * pulse, 0, Math.PI * 2); ctx.stroke();
    // The antenna sways the other way.
    ctx.strokeStyle = "#bfefff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(-tilt * 14 + 2, -20, -tilt * 18 + 1, -25); ctx.stroke();
    ctx.drawImage(runGlow("220,250,255"), -tilt * 18 + 1 - 7, -32, 14, 14);
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 13); g.addColorStop(0, "#ffffff"); g.addColorStop(0.65, "#d6f6ff"); g.addColorStop(1, "#7fd8f5");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    const look = Math.max(-2.2, Math.min(2.2, (R.vx || 0) * 0.012)), blink = (t % 3.4) < 0.12 ? 0.15 : 1, happy = R.happy > 0;
    ctx.fillStyle = "#123049";
    for (const sd of [-1, 1]) { ctx.beginPath(); if (happy) { ctx.lineWidth = 1.6; ctx.strokeStyle = "#123049"; ctx.arc(sd * 4.5 + look, 0, 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } else { ctx.ellipse(sd * 4.5 + look, -1, 1.8, 2.7 * blink, 0, 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = "rgba(255,150,190,0.45)"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 7.5, 4, 2.4, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  // Close dark rock rushing past at the edges: depth.
  ctx.save(); ctx.scale(S, S); ctx.fillStyle = "rgba(1,1,4,0.92)";
  for (let q = -1; q < 4; q++) { const base = Math.floor(R.dist * 1.6 / 420) + q, r = seeded(base * 29 + 11); if (r() < 0.4) continue; const side = r() < 0.5 ? -1 : 1, y = LY - (base * 420 - R.dist * 1.6), x = side < 0 ? -20 + r() * 20 : W / S + 20 - r() * 20, w = 50 + r() * 40, h = 120 + r() * 90;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, side * 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Touched: a flash of violet.
  if (R.flash > 0) { ctx.fillStyle = `rgba(120,40,160,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
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
    run.tx = p.tx + (e.clientX - p.sx) / (c.clientWidth / 400) * 1.25;
  });
  const end = () => { if (p && !p.moved && performance.now() - p.t < 350) runSing(); p = null; };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", () => { p = null; });
  window.addEventListener("keydown", e => { if (screen === "run" && (e.key === " " || e.key === "ArrowUp")) { e.preventDefault(); runSing(); } });
}
document.getElementById("runPauseBtn").addEventListener("click", e => { e.stopPropagation(); if (!run || run.over) return; run.paused = true; $("runPause").hidden = false; musicStop(); });
document.getElementById("runResume").addEventListener("click", () => { run.paused = false; run.last = 0; $("runPause").hidden = true; musicStart(4242, 2); });
document.getElementById("runQuit").addEventListener("click", () => { run = null; showTitle(); });
document.getElementById("runAgain").addEventListener("click", () => startRun());
document.getElementById("runCity").addEventListener("click", () => { run = null; showCity(); });
document.getElementById("runShopList").addEventListener("click", e => {
  const b = e.target.closest("button[data-run]");
  if (!b) return;
  const u = RUN.upgrades.find(q => q.id === b.dataset.run), r = runSave(), lv = runUpg(u.id), cost = u.tiers[lv];
  if (cost == null || (save.glow || 0) < cost) return;
  save.glow -= cost; r.upg[u.id] = lv + 1; persist(); sfx.unlock(); buzz(20); runShop();
});
function runShop() {
  $("runShopList").innerHTML = RUN.upgrades.map(u => {
    const lv = runUpg(u.id), next = u.tiers[lv], afford = next != null && (save.glow || 0) >= next;
    return `<li><span><b>${u.name}</b> ${"◆".repeat(lv)}${"◇".repeat(u.tiers.length - lv)}<small>${u.tip(lv)}</small></span>` +
      (next == null ? `<em>Best</em>` : `<button data-run="${u.id}" ${afford ? "" : "disabled"}>✦ ${next}</button>`) + "</li>";
  }).join("");
  $("runGlowLeft").textContent = save.glow || 0;
}

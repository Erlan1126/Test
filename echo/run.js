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
  run.hearts--; run.inv = 1.6; run.flash = 1; run.nohit = false; run.hitAt = runMetres();
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
  R.x += (R.tx - R.x) * Math.min(1, dt * 10);
  // The walls nudge Lumi back softly.
  if (R.x < lo) { R.x += (lo - R.x) * Math.min(1, dt * 14); R.tx = Math.max(R.tx, lo); }
  if (R.x > hi) { R.x += (hi - R.x) * Math.min(1, dt * 14); R.tx = Math.min(R.tx, hi); }
  R.trail.unshift([R.x, R.dist]); if (R.trail.length > 22) R.trail.pop();
  // A new world every few hundred metres.
  const b = Math.floor(runMetres() / RUN.BIOME_M);
  if (b !== R.biome) { R.biome = b; R.banner = 3; mood = MOODS[b % MOODS.length]; sfx.gate(); runMission("biome", b + 1); }
  while (R.next < R.dist + 1100) R.next += runSpawn(R.next);
  const magnet = runUpg("magnet") ? 40 + runUpg("magnet") * 30 : 0;
  for (const it of R.items) {
    if (it.gone) continue;
    const dy = it.at - R.dist;
    if (it.type === "shadow" && !it.freed) { it.ph += dt; it.cx = it.x + Math.sin(it.ph * 0.9) * it.amp; it.at -= dt * 18; }
    const ix = it.type === "shadow" ? it.cx : it.x, d = Math.hypot(ix - R.x, dy);
    if (it.type === "light" && magnet && d < magnet) { it.x += (R.x - it.x) * Math.min(1, dt * 8); it.at += (R.dist - it.at) * Math.min(1, dt * 8); }
    if (it.type === "light" && d < 20) {
      it.gone = true; R.lights++;
      // Each light is the next note of a melody.
      const tune = LULLABY_TUNE[R.note++ % LULLABY_TUNE.length][0];
      note(261.63 * Math.pow(2, (tune + 12) / 12), { dur: 0.7, vol: 0.05, fm: 3, fmDepth: 0.6, echo: 0.8 });
      for (let k = 0; k < 6; k++) R.parts.push({ x: it.x, at: it.at, vx: (Math.random() - 0.5) * 60, va: (Math.random() - 0.3) * 60, life: 0.6, gold: true });
      if (!R.items.some(o => o.trail === it.trail && o.type === "light" && !o.gone)) { R.trails++; runMission("trail", R.trails); }
      runMission("lights", R.lights);
    }
    if (it.type === "heart" && d < 22) { it.gone = true; R.hearts = Math.min(3 + runUpg("heart"), R.hearts + 1); sfx.light(); }
    if (it.type === "rock" && d < it.r + 12 && R.inv <= 0) { R.tx += ix < R.x ? 40 : -40; R.speed *= 0.85; R.inv = 0.4; sfx.bump(); buzz(15); }
    if (it.type === "shadow" && !it.freed && d < 24 && R.inv <= 0) { it.freed = true; it.gone = true; runHit(); }
    if (dy < -500) it.gone = true;
  }
  R.items = R.items.filter(it => !it.gone || it.burst);
  // Songs roll out; shadows they reach turn back into light.
  for (const ring of R.rings) {
    ring.r += dt * 380; ring.at = R.dist;
    for (const it of R.items) if (it.type === "shadow" && !it.freed && Math.hypot(it.cx - ring.x, it.at - ring.at) < ring.r) {
      it.freed = true; R.freed++; R.lights += 3;
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
function runDraw(ctx, W, H) {
  const R = run, S = W / 400, LY = H / S * 0.72, t = R.t;
  // The world's colours, blending into the next world near the border.
  const m = R.dist / RUN.M, b = Math.floor(m / RUN.BIOME_M), f = Math.max(0, (m % RUN.BIOME_M - (RUN.BIOME_M - 60)) / 60);
  const th = THEMES[b % THEMES.length], th2 = THEMES[(b + 1) % THEMES.length];
  const rim = mixC(th.rim, th2.rim, f), deep = mixC(th.deep, th2.deep, f), floor = mixC(th.floor2, th2.floor2, f);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${mixC(deep, [0, 0, 0], 0.4)})`); sky.addColorStop(0.55, `rgb(${mixC(floor, deep, 0.4)})`); sky.addColorStop(1, `rgb(${mixC(deep, [0, 0, 0], 0.5)})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.scale(S, S);
  const Wu = 400, Hu = H / S, yOf = at => LY - (at - R.dist);
  // Light shafts from far above.
  ctx.globalCompositeOperation = "lighter";
  for (let q = 0; q < 3; q++) { const x = 60 + q * 140 + Math.sin(t * 0.2 + q) * 30, g = ctx.createLinearGradient(x, 0, x + 60, Hu); g.addColorStop(0, `rgba(${rim},0.08)`); g.addColorStop(1, `rgba(${rim},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, Hu); ctx.lineTo(x + 40, Hu); ctx.fill(); }
  ctx.globalCompositeOperation = "source-over";
  // Far rock columns, drifting slowly (parallax).
  ctx.fillStyle = `rgba(${mixC(deep, [0, 0, 0], 0.25)},0.9)`;
  for (let q = -1; q < 8; q++) { const base = Math.floor(R.dist * 0.35 / 160) + q, y = LY - (base * 160 - R.dist * 0.35), r = seeded(base * 7 + 3), x = r() * 400, w = 30 + r() * 50; ctx.beginPath(); ctx.ellipse(x, y, w, 110 + r() * 60, 0, 0, Math.PI * 2); ctx.fill(); }
  // Drifting motes.
  for (let q = 0; q < 50; q++) { const r = seeded(q * 13), x = (r() * 400 + Math.sin(t * 0.3 + q) * 10), y = ((r() * Hu + R.dist * (0.2 + r() * 0.5)) % Hu); ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(t + q)); ctx.drawImage(runGlow(rim), x - 3, y - 3, 6, 6); }
  ctx.globalAlpha = 1;
  // The cave walls: dark silhouettes with glowing edges.
  const edge = side => { const pts = []; for (let y = -20; y <= Hu + 20; y += 10) { const a = R.dist + (LY - y); pts.push([caveMid(a) + side * caveHalf(a, R.dist), y]); } return pts; };
  for (const side of [-1, 1]) {
    const pts = edge(side), outer = side < 0 ? -40 : 440;
    const g = ctx.createLinearGradient(side < 0 ? 0 : 400, 0, side < 0 ? 200 : 200, 0); g.addColorStop(0, "#020208"); g.addColorStop(1, `rgb(${mixC(deep, [0, 0, 0], 0.55)})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(outer, -20); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(outer, Hu + 20); ctx.fill();
    ctx.lineJoin = "round";
    for (const [w, a] of [[9, 0.08], [4, 0.22], [1.6, 0.9]]) { ctx.strokeStyle = `rgba(${rim},${a})`; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, q) => (q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    // Crystals growing from the walls.
    for (let q = -2; q < 12; q++) { const base = Math.floor(R.dist / 120) + q, r = seeded(base * 31 + (side > 0 ? 7 : 0)); if (r() < 0.55) continue; const a = base * 120, y = yOf(a), x = caveMid(a) + side * caveHalf(a, R.dist), s = 6 + r() * 8;
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow(rim), x - s * 3, y - s * 3, s * 6, s * 6); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${mixC(rim, [255, 255, 255], 0.5)},0.9)`; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x - side * s * 0.9, y); ctx.lineTo(x, y + s * 0.6); ctx.fill(); }
  }
  // Glow-worms: threads of tiny lights hanging from the walls.
  for (let q = -2; q < 16; q++) {
    const base = Math.floor(R.dist / 90) + q, r = seeded(base * 17 + 5); if (r() < 0.5) continue;
    const side = r() < 0.5 ? -1 : 1, a = base * 90, y0 = yOf(a), x0 = caveMid(a) + side * (caveHalf(a, R.dist) - 2), len = 3 + Math.floor(r() * 5);
    for (let k = 0; k < len; k++) { const x = x0 - side * (2 + k * 0.6), y = y0 + k * 7 + Math.sin(t * 1.5 + base) * 1.5; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + k + base); ctx.drawImage(runGlow("170,255,220"), x - 3, y - 3, 6, 6); }
  }
  ctx.globalAlpha = 1;
  // Things in the cave.
  for (const it of R.items) {
    if (it.gone) continue;
    const y = yOf(it.at); if (y < -60 || y > Hu + 60) continue;
    if (it.type === "light") {
      const bob = Math.sin(t * 3 + it.at * 0.05) * 3;
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,210,120"), it.x - 18, y - 18 + bob, 36, 36); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(it.x, y + bob, 4, 0, Math.PI * 2); ctx.fill();
    } else if (it.type === "heart") {
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("160,235,255"), it.x - 26, y - 26, 52, 52); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#e6fbff"; ctx.font = "20px system-ui"; ctx.textAlign = "center"; ctx.fillText("✦", it.x, y + 7);
    } else if (it.type === "rock") {
      const r = seeded(it.seed); ctx.fillStyle = "#05050c"; ctx.beginPath();
      for (let q = 0; q < 9; q++) { const a = q / 9 * Math.PI * 2, rr = it.r * (0.8 + r() * 0.35); ctx.lineTo(it.x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = `rgba(${rim},0.7)`; ctx.lineWidth = 1.4; ctx.stroke();
    } else if (it.type === "shadow") {
      const x = it.cx;
      for (let q = 0; q < 4; q++) { const sx = x + Math.sin(t * 2 + q * 1.7) * 6, sy = y - 6 + q * 9; ctx.fillStyle = `rgba(6,3,14,${0.55 - q * 0.1})`; ctx.beginPath(); ctx.ellipse(sx, sy, 18 - q * 3, 14 - q * 2, 0, 0, Math.PI * 2); ctx.fill(); }
      const blink = (t * 0.6 + it.ph) % 3 < 0.1 ? 0.15 : 1;
      for (const sd of [-1, 1]) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(runGlow("255,120,190"), x + sd * 7 - 9, y - 12, 18, 18); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ffb0d8"; ctx.beginPath(); ctx.ellipse(x + sd * 7, y - 3, 3.4, 2.2 * blink, sd * -0.3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Song rings.
  for (const ring of R.rings) { const k = ring.r / ring.max, y = yOf(ring.at); ctx.strokeStyle = `rgba(170,240,255,${0.8 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(ring.x, y, ring.r, 0, Math.PI * 2); ctx.stroke(); }
  // Sparkles.
  ctx.globalCompositeOperation = "lighter";
  for (const p of R.parts) { const y = yOf(p.at); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.drawImage(runGlow(p.gold ? "255,215,130" : "170,240,255"), p.x - 8, y - 8, 16, 16); }
  ctx.globalAlpha = 1;
  // Lumi and its trail.
  R.trail.forEach((p, q) => { if (!q) return; const k = 1 - q / R.trail.length; ctx.globalAlpha = k * 0.6; const s = 8 + k * 22; ctx.drawImage(runGlow("150,235,255"), p[0] - s, yOf(p[1]) - s, s * 2, s * 2); });
  ctx.globalAlpha = 1;
  ctx.drawImage(runGlow("150,235,255"), R.x - 60, LY - 60, 120, 120);
  ctx.globalCompositeOperation = "source-over";
  if (!(R.inv > 0 && Math.floor(R.inv * 10) % 2)) {
    const lean = Math.max(-0.4, Math.min(0.4, (R.tx - R.x) * 0.01));
    ctx.save(); ctx.translate(R.x, LY); ctx.rotate(lean);
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 13); g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#d6f6ff"); g.addColorStop(1, "#7fd8f5");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    const look = Math.max(-2, Math.min(2, (R.tx - R.x) * 0.05)), blink = (t % 3.4) < 0.12 ? 0.15 : 1;
    ctx.fillStyle = "#123049"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 4.5 + look, -1, 1.7, 2.6 * blink, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  // Dark rock rushing past close to the eye, faster than the cave: depth.
  ctx.save(); ctx.scale(S, S);
  ctx.fillStyle = "rgba(1,1,4,0.92)";
  for (let q = -1; q < 4; q++) { const base = Math.floor(R.dist * 1.6 / 420) + q, r = seeded(base * 29 + 11); if (r() < 0.4) continue; const side = r() < 0.5 ? -1 : 1, y = LY - (base * 420 - R.dist * 1.6), x = side < 0 ? -20 + r() * 20 : 420 - r() * 20, w = 50 + r() * 40, h = 120 + r() * 90;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, side * 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Touched: a flash of violet.
  if (R.flash > 0) { ctx.fillStyle = `rgba(120,40,160,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  // A vignette.
  const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, H * 0.8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // The world's name as you enter it; mission messages.
  if (R.banner > 0) {
    ctx.globalAlpha = Math.min(1, R.banner, (3 - R.banner) * 2); ctx.textAlign = "center"; ctx.fillStyle = "#eef8ff";
    ctx.font = `500 ${Math.round(W * 0.075)}px Cinzel, Georgia, serif`; ctx.fillText(THEMES[R.biome % THEMES.length].name, W / 2, H * 0.3);
    ctx.font = `italic ${Math.round(W * 0.045)}px "Cormorant Garamond", Georgia, serif`; ctx.fillStyle = "#b8c8e4"; ctx.fillText(`World ${R.biome + 1}`, W / 2, H * 0.3 + W * 0.07); ctx.globalAlpha = 1;
  }
  if (R.missionMsg && R.missionMsg.t > 0) { ctx.globalAlpha = Math.min(1, R.missionMsg.t); ctx.textAlign = "center"; ctx.fillStyle = "#ffd98a"; ctx.font = `600 ${Math.round(W * 0.05)}px system-ui, sans-serif`; ctx.fillText(R.missionMsg.text, W / 2, H * 0.4); ctx.globalAlpha = 1; }
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

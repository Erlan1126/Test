// Stages: short courses (about 30–45 s) with a glowing finish gate, 1–3 stars and an instant
// retry. Every stage is the same course every time (a fixed seed), so you can learn it, race the
// ghost of your best run, and send a friend a link to race yours. A daily stage, the same for
// everyone each day. Endless stays as its own mode.
// Stars: ★ finish · ★★ catch 40% of the lights · ★★★ catch 70% without a hit, under par time.
"use strict";

const STAGES_N = 60;
function stageInfo(n) {
  const daily = n === 0, k = daily ? 8 + (dayNumber() % 12) : n;
  // Difficulty climbs the whole way: to 0.75 by stage 19, then slowly to the full 1 at stage 55
  // (it used to stop climbing at stage 19, so the second half of the game felt the same throughout).
  const len = Math.min(980, 400 + k * 20), hard = k <= 19 ? (k - 1) / 18 * 0.75 : Math.min(1, 0.75 + (k - 19) / 36 * 0.25);
  return { n, daily, len, hard, boss: !daily && n % 10 === 0, wind: !daily && n >= 7 && n % 3 === 1, par: len / (25 + hard * 5), theme: daily ? (k - 1) % 5 : Math.min(4, Math.floor((n - 1) / 10)), tower: !daily && n > 50, seed: daily ? dayNumber() * 7919 + 77 : n * 104729 + 13 };
}
function stageSave() {
  const S = save.stages || (save.stages = {});
  S.best = S.best || {}; S.ghosts = S.ghosts || {}; S.unlocked = S.unlocked || 1;
  return S;
}
function stageNext() { const S = stageSave(); for (let n = 1; n <= S.unlocked; n++) if (!(S.best[n] && S.best[n].stars)) return n; return Math.min(STAGES_N, S.unlocked); }
const stageStars = n => ((stageSave().best[n] || {}).stars) || 0;
const starText = k => "★".repeat(k) + "☆".repeat(3 - k);

// ---------- The people: why you swing ----------
// The Hush put out every light in the city. At the end of each stage someone is waiting in a dark
// window; you bring the light back to them. Relight all 60 homes and dawn comes back to the city.
const STAGE_CHAPTERS = ["Downtown", "The Markets", "The Harbour", "The Arcade", "The Park", "The Tower"];
const STAGE_PEOPLE = [
  ["Mara", "Now she can read to her son again."], ["Old Tomas", "His radio plays the late-night jazz again."], ["Ines", "She finished her drawing by the window."],
  ["The twins", "Two night lights, two faces at the glass."], ["Mr. Okafor", "His bakery opens at four. It will today."], ["Lena", "She waves her phone light back at you."],
  ["Sami", "He was scared of the dark. Not tonight."], ["Grandma Rue", "Her knitting needles click again."], ["Theo", "He was halfway through his exam notes."],
  ["The night nurses", "The whole ward glows. They cheer at the windows."],
  ["Paco", "His fruit stall sparkles like a jewel box."], ["Yuki", "Her lanterns float up the alley, one by one."], ["Amir", "The spice smell and the light came back together."],
  ["Bea", "She counts the coins she couldn't see."], ["Little Juno", "Her goldfish is fine. She checked."], ["Mrs. Halloran", "She sings while she sweeps the stall."],
  ["Dev", "His food truck neon flickers, then holds."], ["Rosa", "Her flowers looked grey. Now they're red."], ["Kofi", "He fixed the old clock by your light."],
  ["The market choir", "Every stall lights up, row after row."],
  ["Captain Ide", "The lighthouse is turning again."], ["Nell", "She sees her father's boat coming in."], ["Rafa", "The fish market hums awake."],
  ["Signe", "She'd been waiting at the pier all night."], ["Bo", "His dog stopped howling at the water."], ["Mila", "She can see the stars on the water again."],
  ["Old Fenn", "He hasn't fished at night in years. He will now."], ["Pip", "His paper boat has a lamp on it now."], ["Esme", "The ferry bell rings, and she's on it."],
  ["The harbour crews", "Every crane lights up like a ship's mast."],
  ["Zed", "Game over? Not tonight. High score."], ["Luz", "The dance floor remembers its colours."], ["Ravi", "His pinball machine plays its little song."],
  ["Coco", "She won the claw machine on her first try."], ["Mo and Ari", "They finish their duet in the karaoke booth."], ["Ola", "The neon cat on her sign winks again."],
  ["Jun", "His arcade cabinet booted up first time."], ["Fifi", "She roller-skates in circles under the lights."], ["Ike", "The jukebox drops a coin all by itself."],
  ["The arcade crowd", "Every screen flashes INSERT COIN at once."],
  ["Wren", "The old oak lights up like a lantern."], ["Hugo", "He finds the bench where he proposed."], ["Tali", "Fireflies follow your light down the path."],
  ["Ms. Adeyemi", "She can finally see the chess board."], ["Kit", "His kite has a light on its tail now."], ["Noor", "The pond reflects the city back."],
  ["The Ellis family", "They finish their picnic at midnight."], ["Avi", "The carousel creaks and turns."], ["June", "She plants a seed and watches it glow."],
  ["Everyone in the park", "The whole park glows like daybreak."],
  ["The lift operator", "The tower lift rises again."], ["Ada", "Her telescope finds the moon."], ["Basil", "The radio tower calls the city back."],
  ["Iris", "She opens every window on the top floor."], ["Mateo", "His drum echoes down the stairwell."], ["Sol", "The rooftop garden blooms in light."],
  ["Vera", "She saved the city's last lamp. She hands it to you."], ["Elio", "He rings the tower bell for dawn."], ["Anouk", "The clock face shines over every street."],
  ["The whole city", "Dawn. Every window is lit. You did this."],
];
// The daily stage: a different neighbour each day, the same one for everyone.
const DAILY_PEOPLE = [["Felix", "He'd been holding a candle for hours."], ["Hana", "Her cat finally came out from under the bed."], ["Mr. Duarte", "He reads the letter he'd been saving."], ["Priya", "She can see her plants are okay."], ["Gus", "His model train circles the window again."], ["Odette", "She plays one more song on the piano."], ["Tariq", "He finds his daughter's lost earring."], ["Lou", "The kettle's on. Stay a minute?"], ["Ayla", "She writes the last page of her diary."], ["Bram", "His telescope points at you now."], ["Cleo", "She paints the sunrise from memory."], ["Nico", "His aquarium shimmers blue again."], ["Saoirse", "She reads her grandmother's recipe."], ["Wes", "He finally finds the light switch. It works."]];
const stagePerson = n => n === 0 ? DAILY_PEOPLE[dayNumber() % DAILY_PEOPLE.length] : STAGE_PEOPLE[(n - 1) % STAGE_PEOPLE.length];
const stageChapter = n => STAGE_CHAPTERS[Math.min(STAGE_CHAPTERS.length - 1, Math.floor((n - 1) / 10))];
const stageWaiting = n => { const w = stagePerson(n)[0]; return `${w} ${/^(The twins|The night nurses|The harbour crews|Mo and Ari)$/.test(w) ? "are" : "is"} waiting`; };
// The weekly outage: one district a week flickers (some anchors go dark for moments) but every light there counts double.
// Each district's chapter of the story, shown the first time you arrive there.
const CHAPTER_STORY = [
  "The Hush took every light in one night. Start where it began: Downtown.",
  "The Markets were the last to go dark. Their lanterns are waiting.",
  "The Harbour's lights guided every ship home. Something below the water is listening.",
  "The Hush hates music and neon most. Make the Arcade loud again.",
  "The Park's old trees still remember the light. Dawn is close.",
  "The Tower holds the city's last lamp. Climb it, and bring back the dawn.",
];
// Your reward for lighting every home in a district: something to wear from that district.
const CHAPTER_REWARD = [["t", "Lamplight glow"], ["s", "Lantern string scarf"], ["b", "Lighthouse tether"], ["t", "Neon glow"], ["s", "Firefly trail scarf"], ["b", "Dawn tether"]];
function chapterRewardItem(c) { const k = CHAPTER_REWARD[c][0], list = { t: RUNNER_TOPS, s: RUNNER_SHOES, b: RUNNER_BOARDS }[k]; return [k, list.findIndex(it => it.reward === c)]; }
function showChapterIntro(c, go) {
  const el = $("chapIntro"); if (!el) { go(); return; }
  $("ciName").textContent = STAGE_CHAPTERS[c]; $("ciLine").textContent = CHAPTER_STORY[c]; $("ciNum").textContent = `Chapter ${c + 1} of ${STAGE_CHAPTERS.length}`;
  $("ciHomes").textContent = "10 homes waiting in the dark"; $("ciCredits").hidden = true; $("ciGo").textContent = "Bring the light";
  el.className = "chap-intro d" + c; el.hidden = false; sfx.unlock();
  $("ciGo").onclick = e => { e.stopPropagation(); el.hidden = true; save.chapSeen = save.chapSeen || {}; save.chapSeen[c] = 1; persist(); go(); };
}
// The ending: the last home is lit and dawn comes back. Shown once, after the stage card of stage 60.
function showEnding(go) {
  const el = $("chapIntro"); if (!el) { go(); return; }
  $("ciNum").textContent = "The end"; $("ciName").textContent = "Dawn";
  $("ciLine").textContent = "Every window in the city is lit. The Hush is gone, and everyone you reached is waking up to the sun.";
  $("ciHomes").textContent = `${homesLit()} of ${STAGES_N} homes relit · ${allStars()} of ${STAGES_N * 3} ★`;
  const cr = $("ciCredits"); cr.innerHTML = "Lumen Rush · a game by Big Bruce Studios<br>Thank you for playing. The Night shift and a new neighbour every day are still waiting."; cr.hidden = false;
  $("ciGo").textContent = "Back to the city";
  el.className = "chap-intro dawn"; el.hidden = false; sfx.win(); buzz([20, 40, 20, 40]);
  $("ciGo").onclick = e => { e.stopPropagation(); el.hidden = true; save.dawnSeen = 1; persist(); go(); };
}
const outageDistrict = () => 1 + weekNumber() % (STAGE_CHAPTERS.length - 1);   // never Downtown: new players learn without it
const homesLit = () => Object.values(stageSave().best).filter(b => b && b.stars).length;

// ---------- Ghosts: a run's path, sampled every 0.1 s, packed small enough for a link ----------
function ghostEncode(trace) {
  const bytes = []; let px = 0, py = 0;
  for (const [x, y] of trace) { const dx = Math.max(-127, Math.min(127, Math.round((x - px) * 10))), dy = Math.max(-127, Math.min(127, Math.round((y - py) * 10))); px += dx / 10; py += dy / 10; bytes.push(dx & 255, dy & 255); }
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function ghostDecode(str) {
  try {
    const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/")), out = []; let x = 0, y = 0;
    for (let i = 0; i + 1 < bin.length; i += 2) { const dx = bin.charCodeAt(i), dy = bin.charCodeAt(i + 1); x += (dx > 127 ? dx - 256 : dx) / 10; y += (dy > 127 ? dy - 256 : dy) / 10; out.push([x, y]); }
    return out.length ? out : null;
  } catch (e) { return null; }
}
// Where a ghost is at time t (seconds into the stage).
function stageGhostAt(tr, t) {
  if (!tr || !tr.length) return null;
  const f = t / 0.1, i = Math.floor(f); if (i >= tr.length - 1) return null;
  const a = tr[i], b = tr[i + 1], k = f - i; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
// A friend's challenge from a link: ?st=<stage>&gt=<time>&g=<ghost>.
const stageRace = (() => {
  try { const q = new URLSearchParams(location.search), n = Number(q.get("st")), g = q.get("g"); if (!(n >= 0) || q.get("st") == null || !g) return null; const tr = ghostDecode(g); return tr ? { n, time: Number(q.get("gt")) || 0, trace: tr } : null; } catch (e) { return null; }
})();
const stageLink = (n, time, trace) => `${location.origin}${location.pathname}?st=${n}&gt=${time.toFixed(1)}&g=${ghostEncode(trace)}`;

// ---------- Playing a stage ----------
function startStage(n, opts = {}) {
  const S = stageSave(), info = stageInfo(n);
  if (!info.daily && n > S.unlocked && !opts.race) return;
  const own = !info.daily && S.ghosts[n] && S.ghosts[n].v === 3 ? ghostDecode(S.ghosts[n].g) : info.daily && save.dailyStage && save.dailyStage.day === dayNumber() && save.dailyStage.g ? ghostDecode(save.dailyStage.g) : null;
  const race = opts.race || null;
  // Arriving in a new district: its chapter card first.
  { const c = Math.floor((n - 1) / 10); if (!info.daily && !opts.cp && !opts.chapOk && n % 10 === 1 && n > 1 && !((save.chapSeen || {})[c])) { showChapterIntro(c, () => startStage(n, Object.assign({}, opts, { chapOk: true }))); return; } }
  // Attempts, like a level counter in a rhythm game: every try counts.
  if (!info.daily && !opts.race) { S.att = S.att || {}; S.att[n] = (S.att[n] || 0) + 1; persist(); }
  $("stageCard").hidden = true;
  const attempt = !info.daily && S.att ? S.att[n] : 0;
  startRun({ stage: n, ghost: opts.cp ? null : race ? race.trace : own, ghostLabel: race ? "FRIEND" : own ? "BEST" : "", raceTime: race ? race.time : 0 });
  if (run && run.stage === n) run.attempt = attempt;
  // A helping hand: each time in a row you run out of light on a stage, the dark comes a little
  // slower on your next try (up to 28% after four; 40% on a boss). Clearing the stage resets it.
  if (run && run.stage === n && !info.daily && !race) run.assist = Math.min(info.boss ? 0.4 : 0.28, ((S.fails || {})[n] || 0) * 0.07);
  // Starting again from the halfway lantern: swing in from the anchor there, with the time you had.
  if (opts.cp && run && run.stage === n) {
    const R = run, cp = opts.cp; swingGen(R, cp.x + 220);
    const a = R.anchors.filter(q => !q.type && !q.broken && q.x >= cp.x - 2).sort((p, q) => p.x - q.x)[0];
    if (a) { R.px = a.x - 6; R.py = a.y - 8; R.vx = 12; R.vy = 0; R.teth = a; R.L = Math.hypot(6, 8); R.hold = true; }
    R.darkX = R.px - 55; R.stageT = cp.t; R.cpUsed = true; R.cp = cp; R.tut = 0; R.banner = 0; R.msgs.length = 0;
    for (const m of R.motes) if (m.x < R.px) m.skip = true;
    runMsg("From halfway", "Reach their home (1 ★ from here)", 1.8, true);
  }
}
function stageClear(R) {
  R.cleared = true; R.msgs.length = 0; R.clearAt = R.t; R.clearFrom = { x: R.px, y: R.py + 1.2 }; R.inv = 9; R.slowT = 0.6; R.fireworks.push({ t: 0, seed: Math.random() }, { t: -0.4, seed: Math.random() });
  const total = Math.max(1, R.motesTotal), share = R.motesGot / total, time = R.stageT;
  const stars = R.cpUsed ? 1 : 1 + (share >= 0.4 ? 1 : 0) + (share >= 0.7 && R.hitsTaken === 0 && time <= R.stageInfo.par ? 1 : 0);
  R.stageStars = stars; R.stageTime = time;
  if (R.attract) return;
  const S = stageSave(), n = R.stage, info = R.stageInfo;
  R.hadStars = !!(S.best[n] && S.best[n].stars);
  let newBest = false;
  if (info.daily) {
    const d = save.dailyStage && save.dailyStage.day === dayNumber() ? save.dailyStage : (save.dailyStage = { day: dayNumber() });
    if (!d.time || time < d.time) { d.time = time; d.g = ghostEncode(R.trace); newBest = true; } d.stars = Math.max(d.stars || 0, stars);
    streakTouch();
  } else {
    const b = S.best[n] || {};
    // A run from the halfway lantern relights the home, but doesn't set a best time or a ghost.
    S.best[n] = { stars: Math.max(b.stars || 0, stars), time: R.cpUsed ? b.time || time : b.time ? Math.min(b.time, time) : time };
    // (v3: the course as built from sections; an older ghost or best time doesn't block saving a v3 ghost.)
    if (!R.cpUsed && (!b.time || time < b.time || !(S.ghosts[n] && S.ghosts[n].v === 3))) { S.ghosts[n] = { v: 3, g: ghostEncode(R.trace), t: time }; newBest = true; }
    S.unlocked = Math.max(S.unlocked, Math.min(STAGES_N, n + 1));
    if (S.fails) delete S.fails[n];
  }
  R.newBest = newBest;
  starRewards();
  save.glow = (save.glow || 0) + R.lights + stars * 10;
  const r = save.run || runSave(); r.xp = (r.xp || 0) + Math.round(R.lights + stars * 20);
  seasonGain(Math.round(stars * 15 + R.lights / 2));
  // The whole district lit: a reward to wear.
  if (!info.daily) { const c = Math.floor((n - 1) / 10); save.chapDone = save.chapDone || {}; if (!save.chapDone[c] && distLit(c)) { save.chapDone[c] = 1; const [k, i] = chapterRewardItem(c); if (i >= 0) { runnerLook().own[k + i] = 1; setTimeout(() => toast(`<b>${STAGE_CHAPTERS[c]} is lit!</b> Unlocked: ${CHAPTER_REWARD[c][1]}`, true), 2600); } } }
  progressEvent("dist", Math.floor(R.px)); progressEvent("home"); progressEvent("stars", stars); if (info.daily) progressEvent("daily"); persist(); checkAchievements();
  R.wantShotAt = R.t + 1.3;   // the picture to share: their window lit, them waving
  sfx.unlock(); buzz([20, 40, 20]);
  if (!info.daily && n % 10 === 0) runMsg(`${stageChapter(n)} shines again!`, n === STAGES_N ? "Dawn has come back to the city" : `On to ${stageChapter(n + 1)}`, 2.6, true);
  else runMsg(stars === 3 ? "Perfect stage!" : `Light brought home to ${stagePerson(info.n)[0]}`, starText(stars), 2, true);
  setTimeout(() => showStageCard(true), 1300);
}
function stageFail() {
  const R = run; if (!R || R.cleared) return; R.over = 0.001; R.failed = true; musicStop(); sfx.fail();
  // How far you got, and your best on this stage.
  if (!R.stageInfo.daily && !R.cpUsed && !R.raceTime) { const S = stageSave(), pct = Math.max(0, Math.min(99, Math.floor(R.px / R.stageLen * 100))); S.pct = S.pct || {}; R.failPct = pct; R.newBestPct = pct > (S.pct[R.stage] || 0); if (R.newBestPct) S.pct[R.stage] = pct; R.bestPct = S.pct[R.stage]; persist(); }
  if (!R.stageInfo.daily && !R.raceTime && !R.attract) { const S = stageSave(); S.fails = S.fails || {}; S.fails[R.stage] = (S.fails[R.stage] || 0) + 1; persist(); }
  setTimeout(() => showStageCard(false), 650);
}
// What to try next, by what took your last heart.
const FAIL_TIPS = {
  "The dark caught you!": "Keep your speed up: let go on the gold arc, and tap in mid-air for a dash to outrun the dark.",
  "Drone!": "Drones patrol between anchors. Wait a beat for one to pass, or swing above it.",
  "Zap!": "Live wires spark between rooftops. Let go a little later to fly over them.",
  "Keep off the street!": "Grab the next ringed light before you fall too low.",
  "": "Grab anchors early, let go on the gold arc.",
};
function showStageCard(won) {
  const R = run; if (!R || !R.stage && R.stage !== 0) return;
  const info = R.stageInfo, el = $("stageCard");
  $("stTitle").textContent = info.daily ? "Daily stage" : `Stage ${info.n}`;
  // Who you brought the light to (or who is still waiting).
  { const [who, line] = stagePerson(info.n), pe = $("stPerson"); if (pe) { pe.hidden = false; pe.innerHTML = won ? `<b>You brought light to ${who}.</b><span>“${line}”</span><small>${info.daily ? "Back tomorrow: someone new will be waiting" : `${homesLit()} of ${STAGES_N} homes relit`}</small>` : `<b>${stageWaiting(info.n).replace("waiting", "still waiting")} in the dark.</b><span>Try again. They're counting on you.</span>`; } }
  $("stBadge").textContent = won ? (R.newBest ? "New best" : "") : R.failPct != null ? `${R.failPct}%${R.newBestPct ? " · New best!" : ""}` : "Out of light";
  $("stStars").innerHTML = [0, 1, 2].map(q => `<span class="${won && q < R.stageStars ? "" : "off"}">★</span>`).join("");
  $("stStars").classList.toggle("lost", !won);
  // Show the card first: the count-up below only animates while the card is showing.
  el.hidden = false;
  // The numbers count up; each star lands with its own chime.
  const count = (id, to, fmt, ms = 700) => { const el = $(id), t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1 && !$("stageCard").hidden) requestAnimationFrame(f); }; f(t0); };
  if (won) count("stTime", R.stageTime, v => v.toFixed(1)); else $("stTime").textContent = "–";
  count("stLights", R.motesGot, v => `${Math.round(v)}/${R.motesTotal}`); count("stPerf", R.perfects, v => String(Math.round(v)));
  if (won) for (let q = 0; q < R.stageStars; q++) setTimeout(() => { if (!$("stageCard").hidden) { sfx.star(q); buzz(q === 2 ? [20, 30, 40] : 10); } }, 120 + q * 180);
  const raceNote = R.raceTime ? (won ? (R.stageTime < R.raceTime ? `You beat your friend by ${(R.raceTime - R.stageTime).toFixed(1)} s!` : `Your friend was ${(R.stageTime - R.raceTime).toFixed(1)} s faster`) : "Your friend's ghost made it. Try again!") : "";
  const attNote = won && R.attempt && !R.hadStars ? `Cleared on attempt ${R.attempt}${R.attempt === 1 ? ". First try!" : ""} · ` : !won && R.bestPct != null && !R.newBestPct ? `Your best: ${R.bestPct}% · ` : "";
  $("stNote").textContent = attNote + (raceNote || (won ? (R.stageStars < 3 ? (R.stageStars < 2 ? "Catch 40% of the lights for ★★" : `★★★: 70% of the lights, no hits, under ${R.stageInfo.par.toFixed(1)} s`) : "Flawless.") : (FAIL_TIPS[R.lastWhy] || FAIL_TIPS[""])));
  // After the last stage, the first time: the ending.
  const dawn = won && !info.daily && info.n === STAGES_N && !save.dawnSeen;
  const next = $("stNext"); next.textContent = dawn ? "See the dawn" : won && !info.daily && info.n < STAGES_N ? `Next: ${stagePerson(info.n + 1)[0]}` : "Retry";
  next.dataset.go = dawn ? "dawn" : won && !info.daily && info.n < STAGES_N ? String(info.n + 1) : String(info.n);
  $("stRetry").hidden = !(dawn || (won && !info.daily && info.n < STAGES_N));
  $("stShare").hidden = !won;
  { const cb = $("stFromCp"); if (cb) cb.hidden = !!(won || !R.cp); }
  runHud();
}
// Share: the best moment of the run as a picture, plus a link to race your ghost.
async function stageShare() {
  const R = run; if (!R) return;
  const info = R.stageInfo, url = R.trace && R.trace.length ? stageLink(info.n, R.stageTime || 0, R.trace) : location.href;
  const text = `I brought the light back to ${stagePerson(info.n)[0]} in ${info.daily ? "today's Lumen Rush daily stage" : `Lumen Rush · Stage ${info.n}`}: ${starText(R.stageStars || 0)} in ${(R.stageTime || 0).toFixed(1)} s. Race my ghost:`;
  try {
    if (R.moment && navigator.canShare) {
      const img = new Image(); img.src = R.moment; await img.decode();
      const c = document.createElement("canvas"); c.width = 720; c.height = 1280; const g = c.getContext("2d");
      const k = Math.max(720 / img.width, 1280 / img.height); g.drawImage(img, (720 - img.width * k) / 2, (1280 - img.height * k) / 2, img.width * k, img.height * k);
      const gr = g.createLinearGradient(0, 860, 0, 1280); gr.addColorStop(0, "rgba(6,7,11,0)"); gr.addColorStop(1, "rgba(6,7,11,0.92)"); g.fillStyle = gr; g.fillRect(0, 860, 720, 420);
      g.fillStyle = "#fff"; g.font = "800 64px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.fillText(info.daily ? "Daily stage" : `Stage ${info.n}`, 360, 1080);
      g.fillStyle = "#ffd98a"; g.font = "700 60px Inter, system-ui, sans-serif"; g.fillText(`${starText(R.stageStars || 0)}  ${(R.stageTime || 0).toFixed(1)} s`, 360, 1160);
      g.fillStyle = "#ffffff"; g.font = "700 32px Inter, system-ui, sans-serif"; g.fillText(`Light brought home to ${stagePerson(info.n)[0]}`, 360, 990);
      g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "italic 500 26px Inter, system-ui, sans-serif"; g.fillText(`“${stagePerson(info.n)[1]}”`, 360, 1032, 660);
      g.fillStyle = "#8be9ff"; g.font = "800 34px Inter, system-ui, sans-serif"; g.fillText("LUMEN RUSH", 360, 1230);
      const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85)), file = new File([blob], "lumen-rush.jpg", { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}` }); return; }
    }
    if (navigator.share) { await navigator.share({ title: "Lumen Rush", text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied: send it to a friend");
  } catch (e) {
    // Closing the share sheet is fine; anything else falls back to copying the link.
    if (e && e.name === "AbortError") return;
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied: send it to a friend"); } catch (e2) { toast("Sharing isn't available in this browser"); }
  }
}
// ---------- The stage map ----------
// ---------- The city map: six districts, ten homes each; a window lights up for everyone you reach ----------
let mapPick = null;
function stagesHtml() {
  const S = stageSave(), d = save.dailyStage && save.dailyStage.day === dayNumber() ? save.dailyStage : null, lit = homesLit();
  const stars = Object.values(S.best).reduce((a, b) => a + (b.stars || 0), 0), nr = nextStarReward(), nx = stageNext();
  if (mapPick == null || mapPick > S.unlocked) mapPick = nx;
  let h = `<li class="dawn"><div><b>${lit}/${STAGES_N}</b> homes relit<span>${lit >= STAGES_N ? "Dawn has come back to the city" : `${STAGES_N - lit} still waiting in the dark`}</span></div><div class="dawn-bar"><i style="width:${(lit / STAGES_N * 100).toFixed(1)}%"></i></div><small>${stars}/${STAGES_N * 3} ★${nr ? ` · next reward at ${nr[0]}★: ${rewardName(nr)}` : ""}</small></li>`;
  // Who lives in the building you picked.
  { const n = mapPick, b = S.best[n], [who, line] = stagePerson(n), done = b && b.stars;
    h += `<li class="map-pick ${done ? "won" : ""}"><span><small>${stageChapter(n)} · Stage ${n}${n % 10 === 0 ? " · Boss" : ""}${done ? ` · ${starText(b.stars)} · ${b.time.toFixed(1)} s` : ""}</small><b>${done ? who : stageWaiting(n)}</b><small>${done ? `“${line}”` : "Their window is still dark"}</small></span><button data-stage="${n}">${done ? (b.stars < 3 ? "For 3★" : "Again") : "Go"}</button></li>`; }
  for (let c = 0; c < STAGE_CHAPTERS.length; c++) {
    let got = 0; for (let n = c * 10 + 1; n <= c * 10 + 10; n++) if (S.best[n] && S.best[n].stars) got++;
    const open = c * 10 + 1 <= S.unlocked;
    h += `<li class="district ${got === 10 ? "full" : ""} ${open ? "" : "shut"} ${c === outageDistrict() ? "outage" : ""}"><div class="dist-head"><b>${STAGE_CHAPTERS[c]}${c === outageDistrict() ? ` <em class="out-badge">⚡ Outage week · ×2 lights</em>` : ""}</b><span>${open ? `${got}/10 lit` : "Locked"}</span></div><div class="skyline">`;
    for (let n = c * 10 + 1; n <= c * 10 + 10; n++) {
      const b = S.best[n], locked = n > S.unlocked, r = seeded(n * 131)(), ht = n % 10 === 0 ? 100 : 46 + Math.round(r * 40);
      h += `<button class="bld${b && b.stars ? " lit" : ""}${locked ? " lock" : ""}${n === nx && !locked ? " next" : ""}${n === mapPick ? " sel" : ""}${n % 10 === 0 ? " boss" : ""}" style="height:${ht}%" data-pick="${n}" ${locked ? "disabled" : ""} aria-label="Stage ${n}"><i></i><i></i><small>${n}</small></button>`;
    }
    h += `</div></li>`;
  }
  h += `<li class="sec">Daily neighbour</li><li class="${d ? "won" : ""}"><span><b>${stageWaiting(0).replace(" waiting", d ? " got their light" : " waiting today")}</b><small>${d ? `${starText(d.stars || 0)} · ${d.time.toFixed(1)} s · race your ghost` : "The same stage for everyone today"}</small></span><button data-stage="0">${d ? "Again" : "Play"}</button></li>`;
  return h;
}
document.getElementById("shopList").addEventListener("click", e => {
  const pb = e.target.closest("button[data-pick]"); if (!pb) return;
  mapPick = Number(pb.dataset.pick); $("shopList").innerHTML = stagesHtml();
});
document.getElementById("shopList").addEventListener("click", e => {
  const b = e.target.closest("button[data-stage]"); if (!b) return;
  $("sheet").hidden = true; const n = Number(b.dataset.stage);
  if (screen === "title") { $("titleScreen").classList.add("launch"); setTimeout(() => startStage(n), 200); } else startStage(n);
});
document.getElementById("stNext").addEventListener("click", () => {
  const go = $("stNext").dataset.go;
  if (go === "dawn") { $("stageCard").hidden = true; showEnding(() => { run = null; showTitle(); }); return; }
  startStage(Number(go));
});
document.getElementById("stRetry").addEventListener("click", () => run && startStage(run.stage));
document.getElementById("stStages").addEventListener("click", () => { $("stageCard").hidden = true; run = null; showTitle(); openSheet("stages"); });
document.getElementById("stShare").addEventListener("click", stageShare);
document.getElementById("stFromCp").addEventListener("click", () => { if (run && run.cp) startStage(run.stage, { cp: run.cp }); });

// What's new on a stage: a short line the first time something appears.
const STAGE_NEW = { 11: ["The Markets", "Lantern strings sway in the breeze: time your grab"], 21: ["The Harbour", "Fall in the water and you splash: it slows you down"], 31: ["The Arcade", "Neon pads on the rooftops bounce you sky-high"], 41: ["The Park", "Grab the glowing treetops for low, fast swings"], 51: ["The Tower", "Updrafts between the towers lift you up"], 7: ["New: wind", "Gusts push you sideways. Watch the streaks"], 2: ["New: live wires", "Don't touch the sparks between rooftops"], 3: ["New: drones and crumbling anchors", "Let go of orange anchors quickly"], 4: ["New: drifting anchors", "They slide; time your grab"], 5: ["The street bites now", "Every touch costs a heart"] };

// Star rewards: stars from stages unlock looks for free.
const STAR_REWARDS = [[6, "s", 1], [12, "t", 2], [20, "b", 1], [30, "c", 1], [42, "s", 2], [55, "t", 6], [70, "b", 2], [85, "c", 2], [100, "s", 3], [120, "t", 7], [140, "b", 4], [160, "c", 3], [180, "s", 5]];
const rewardName = ([, k, i]) => ({ c: RUNNER_CHARS, t: RUNNER_TOPS, s: RUNNER_SHOES, b: RUNNER_BOARDS }[k][i].name) + ({ c: " (form)", t: " glow", s: " scarf", b: " tether" }[k]);
const stageTotalStars = () => Object.values(stageSave().best).reduce((a, b) => a + (b.stars || 0), 0);
function starRewards() {
  const L = runnerLook(), have = stageTotalStars();
  for (const rw of STAR_REWARDS) if (have >= rw[0] && !L.own[rw[1] + rw[2]]) { L.own[rw[1] + rw[2]] = 1; if (!run || !run.attract) runMsg(`Unlocked: ${rewardName(rw)}`, `${rw[0]} stars · wear it in the Locker`, 2.6, true); }
  persist();
}
const nextStarReward = () => STAR_REWARDS.find(rw => !runnerLook().own[rw[1] + rw[2]]);

// ---------- The opening: why the city is dark, and who is waiting (first Play only, about 10 s) ----------
function playOpening(done) {
  const el = $("opening"), c = $("openingCanvas"), cap = $("opCap"), go = $("opGo"), skip = $("opSkip");
  if (!el || !c) { done(); return; }
  if (!el.hidden) return;   // already playing (a second Play press)
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  el.hidden = false; go.hidden = true; let t0 = performance.now(), ended = false, lastCap = -1;
  const caps = ["Every night, the city glowed.", "Then the <b>Hush</b> came,<br>and put out every light.", "But one light was left.<br><b>You.</b>", `<b>${stagePerson(1)[0]}</b> is waiting in the dark.<br>Bring the light back.`];
  const finish = () => { if (ended) return; ended = true; el.hidden = true; save.opening = 1; persist(); done(); };
  skip.onclick = e => { e.stopPropagation(); finish(); };
  go.onclick = e => { e.stopPropagation(); audio(); finish(); };
  const d = Math.min(2, window.devicePixelRatio || 1);
  const blds = Array.from({ length: 16 }, (_, i) => { const r = seeded(i * 77 + 5); return { x: i / 16, w: 0.05 + r() * 0.05, h: 0.18 + r() * 0.32, wins: Array.from({ length: 40 }, () => [r(), r(), r()]) }; });
  const frame = now => {
    if (ended) return;
    const t = (now - t0) / 1000, W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
    const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    const scene = t < 2.6 ? 0 : t < 5.2 ? 1 : t < 7.6 ? 2 : 3;
    if (scene !== lastCap) { lastCap = scene; cap.classList.add("out"); setTimeout(() => { cap.innerHTML = caps[scene]; cap.classList.remove("out"); }, lastCap ? 350 : 0); if (scene === 3) setTimeout(() => { go.hidden = false; }, 700); }
    // Sky.
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#05060f"); g.addColorStop(1, scene === 0 ? "#2a1d3a" : "#0b0d1a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rs = seeded(9); x.fillStyle = "#fff"; for (let q = 0; q < 70; q++) { x.globalAlpha = 0.25 + rs() * 0.5; x.fillRect(rs() * W, rs() * H * 0.5, 1.2, 1.2); } x.globalAlpha = 1;
    // The Hush: a front of darkness sweeping right to left during scene 1.
    const hush = t < 2.6 ? W * 1.2 : t < 4.8 ? W * 1.2 - (t - 2.6) / 2.2 * W * 1.5 : -W;
    const base = H * 0.78;
    for (const b of blds) {
      const bx = b.x * W, bw = b.w * W, bh = b.h * H; x.fillStyle = "#121624"; x.fillRect(bx, base - bh, bw, bh + H);
      for (const [u, v, k] of b.wins) { const wx = bx + 4 + u * (bw - 10), wy = base - bh + 6 + v * (bh - 12), on = wx < hush && k < 0.7; if (!on) continue; x.fillStyle = `rgba(255,${200 + k * 40},${130 + k * 60},0.9)`; x.fillRect(wx, wy, 3, 4); }
    }
    if (scene === 1) { const gg = x.createLinearGradient(hush, 0, hush + 120, 0); gg.addColorStop(0, "rgba(4,5,10,0)"); gg.addColorStop(0.3, "rgba(60,20,90,0.55)"); gg.addColorStop(1, "rgba(4,5,10,0.85)"); x.fillStyle = gg; x.fillRect(hush, 0, W, H); }
    x.fillStyle = "#07080e"; x.fillRect(0, base, W, H - base);
    // The spark that becomes you.
    if (scene >= 2) { const k = Math.min(1, (t - 5.2) / 1.4), px = W * 0.5, py = H * 0.5 - (scene === 3 ? Math.min(1, (t - 7.6)) * H * 0.12 : 0), r = 6 + k * 46 + Math.sin(t * 5) * 3;
      const sg = x.createRadialGradient(px, py, 0, px, py, r * 2.4); sg.addColorStop(0, "rgba(200,245,255,0.95)"); sg.addColorStop(0.3, "rgba(139,233,255,0.45)"); sg.addColorStop(1, "rgba(139,233,255,0)"); x.fillStyle = sg; x.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
      if (k > 0.6) { x.globalAlpha = (k - 0.6) / 0.4; x.strokeStyle = "#fff"; x.lineWidth = 4; x.lineCap = "round"; x.beginPath(); x.moveTo(px, py - 10); x.lineTo(px, py + 12); x.moveTo(px, py - 6); x.lineTo(px - 12, py - 18); x.moveTo(px, py - 6); x.lineTo(px + 12, py - 18); x.moveTo(px, py + 12); x.lineTo(px - 8, py + 28); x.moveTo(px, py + 12); x.lineTo(px + 8, py + 28); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(px, py - 18, 6, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; } }
    // Far away, one window waiting.
    if (scene === 3) { const k = Math.min(1, (t - 7.6) / 1.2), b = blds[12], bx = b.x * W + b.w * W * 0.3, by = base - b.h * H * 0.55, pulse = 0.5 + 0.5 * Math.sin(t * 3);
      x.fillStyle = `rgba(255,200,120,${0.12 * k * pulse})`; x.beginPath(); x.arc(bx + 6, by + 8, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#1b2030"; x.fillRect(bx, by, 14, 18); x.fillStyle = `rgba(150,160,190,${0.7 * k})`; x.beginPath(); x.arc(bx + 7, by + 7, 3, 0, Math.PI * 2); x.fill(); x.fillRect(bx + 4, by + 10, 6, 8);
      x.strokeStyle = `rgba(255,217,138,${0.5 * k * pulse})`; x.lineWidth = 1.5; x.setLineDash([4, 6]); x.beginPath(); x.moveTo(W * 0.5, H * 0.5 - H * 0.12 * k); x.lineTo(bx + 7, by + 9); x.stroke(); x.setLineDash([]); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

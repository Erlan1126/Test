// Stages: short courses (about 30–45 s) with a glowing finish gate, 1–3 stars and an instant
// retry. Every stage is the same course every time (a fixed seed), so you can learn it, race the
// ghost of your best run, and send a friend a link to race yours. A daily stage, the same for
// everyone each day. Endless stays as its own mode.
// Stars: ★ finish · ★★ catch half the lights · ★★★ catch 80% without a hit, under par time.
"use strict";

const STAGES_N = 60;
function stageInfo(n) {
  const daily = n === 0, k = daily ? 8 + (dayNumber() % 12) : n;
  const len = Math.min(980, 520 + k * 16), hard = Math.min(1, (k - 1) / 18);
  return { n, daily, len, hard, boss: !daily && n % 10 === 0, par: len / (25 + hard * 5), theme: (k - 1) % 5, seed: daily ? dayNumber() * 7919 + 77 : n * 104729 + 13 };
}
function stageSave() {
  const S = save.stages || (save.stages = {});
  S.best = S.best || {}; S.ghosts = S.ghosts || {}; S.unlocked = S.unlocked || 1;
  return S;
}
function stageNext() { const S = stageSave(); for (let n = 1; n <= S.unlocked; n++) if (!(S.best[n] && S.best[n].stars)) return n; return Math.min(STAGES_N, S.unlocked); }
const stageStars = n => ((stageSave().best[n] || {}).stars) || 0;
const starText = k => "★".repeat(k) + "☆".repeat(3 - k);

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
  if (!info.daily && n > S.unlocked) return;
  const own = !info.daily && S.ghosts[n] ? ghostDecode(S.ghosts[n].g) : info.daily && save.dailyStage && save.dailyStage.day === dayNumber() && save.dailyStage.g ? ghostDecode(save.dailyStage.g) : null;
  const race = opts.race || null;
  $("stageCard").hidden = true;
  startRun({ stage: n, ghost: race ? race.trace : own, ghostLabel: race ? "FRIEND" : own ? "BEST" : "", raceTime: race ? race.time : 0 });
}
function stageClear(R) {
  R.cleared = true; R.inv = 9; R.slowT = 0.6; R.fireworks.push({ t: 0, seed: Math.random() }, { t: -0.4, seed: Math.random() });
  const total = Math.max(1, R.motesTotal), share = R.motesGot / total, time = R.stageT;
  const stars = 1 + (share >= 0.5 ? 1 : 0) + (share >= 0.8 && R.hitsTaken === 0 && time <= R.stageInfo.par ? 1 : 0);
  R.stageStars = stars; R.stageTime = time;
  if (R.attract) return;
  const S = stageSave(), n = R.stage, info = R.stageInfo;
  let newBest = false;
  if (info.daily) {
    const d = save.dailyStage && save.dailyStage.day === dayNumber() ? save.dailyStage : (save.dailyStage = { day: dayNumber() });
    if (!d.time || time < d.time) { d.time = time; d.g = ghostEncode(R.trace); newBest = true; } d.stars = Math.max(d.stars || 0, stars);
    if (typeof streakTouch === "function") streakTouch();
  } else {
    const b = S.best[n] || {}; S.best[n] = { stars: Math.max(b.stars || 0, stars), time: b.time ? Math.min(b.time, time) : time };
    if (!b.time || time < b.time) { S.ghosts[n] = { g: ghostEncode(R.trace), t: time }; newBest = true; }
    S.unlocked = Math.max(S.unlocked, Math.min(STAGES_N, n + 1));
  }
  R.newBest = newBest;
  save.glow = (save.glow || 0) + R.lights + stars * 10;
  const r = save.run || runSave(); r.xp = (r.xp || 0) + Math.round(R.lights + stars * 20);
  if (typeof seasonGain === "function") seasonGain(Math.round(stars * 15 + R.lights / 2));
  progressEvent("dist", Math.floor(R.px)); persist(); if (typeof checkAchievements === "function") checkAchievements();
  R.wantShot = true;
  sfx.unlock(); buzz([20, 40, 20]);
  runMsg(stars === 3 ? "Perfect stage!" : "Stage clear!", starText(stars), 2, true);
  setTimeout(() => showStageCard(true), 1300);
}
function stageFail() {
  const R = run; R.over = 0.001; R.failed = true; musicStop(); sfx.fail();
  setTimeout(() => showStageCard(false), 900);
}
function showStageCard(won) {
  const R = run; if (!R || !R.stage && R.stage !== 0) return;
  const info = R.stageInfo, el = $("stageCard");
  $("stTitle").textContent = info.daily ? "Daily stage" : `Stage ${info.n}`;
  $("stBadge").textContent = won ? (R.newBest ? "New best" : "") : "Out of light";
  $("stStars").textContent = won ? starText(R.stageStars) : "☆☆☆";
  $("stStars").classList.toggle("lost", !won);
  $("stTime").textContent = won ? R.stageTime.toFixed(1) : "–";
  $("stLights").textContent = `${R.motesGot}/${R.motesTotal}`;
  $("stPerf").textContent = R.perfects;
  const raceNote = R.raceTime ? (won ? (R.stageTime < R.raceTime ? `You beat your friend by ${(R.raceTime - R.stageTime).toFixed(1)} s!` : `Your friend was ${(R.stageTime - R.raceTime).toFixed(1)} s faster`) : "Your friend's ghost made it. Try again!") : "";
  $("stNote").textContent = raceNote || (won ? (R.stageStars < 3 ? (R.stageStars < 2 ? "Catch half the lights for ★★" : `★★★: 80% of the lights, no hits, under ${R.stageInfo.par.toFixed(1)} s`) : "Flawless.") : "Grab anchors early, let go on the gold arc.");
  const next = $("stNext"); next.textContent = won && !info.daily && info.n < STAGES_N ? "Next stage" : "Retry";
  next.dataset.go = won && !info.daily && info.n < STAGES_N ? String(info.n + 1) : String(info.n);
  $("stRetry").hidden = !(won && !info.daily && info.n < STAGES_N);
  $("stShare").hidden = !won;
  el.hidden = false; runHud();
}
// Share: the best moment of the run as a picture, plus a link to race your ghost.
async function stageShare() {
  const R = run; if (!R) return;
  const info = R.stageInfo, url = R.trace && R.trace.length ? stageLink(info.n, R.stageTime || 0, R.trace) : location.href;
  const text = `${info.daily ? "Today's Lumen Rush daily stage" : `Lumen Rush · Stage ${info.n}`}: ${starText(R.stageStars || 0)} in ${(R.stageTime || 0).toFixed(1)} s. Race my ghost:`;
  try {
    if (R.moment && navigator.canShare) {
      const img = new Image(); img.src = R.moment; await img.decode();
      const c = document.createElement("canvas"); c.width = 720; c.height = 1280; const g = c.getContext("2d");
      const k = Math.max(720 / img.width, 1280 / img.height); g.drawImage(img, (720 - img.width * k) / 2, (1280 - img.height * k) / 2, img.width * k, img.height * k);
      const gr = g.createLinearGradient(0, 860, 0, 1280); gr.addColorStop(0, "rgba(6,7,11,0)"); gr.addColorStop(1, "rgba(6,7,11,0.92)"); g.fillStyle = gr; g.fillRect(0, 860, 720, 420);
      g.fillStyle = "#fff"; g.font = "800 64px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.fillText(info.daily ? "Daily stage" : `Stage ${info.n}`, 360, 1080);
      g.fillStyle = "#ffd98a"; g.font = "700 60px Inter, system-ui, sans-serif"; g.fillText(`${starText(R.stageStars || 0)}  ${(R.stageTime || 0).toFixed(1)} s`, 360, 1160);
      g.fillStyle = "#8be9ff"; g.font = "800 34px Inter, system-ui, sans-serif"; g.fillText("LUMEN RUSH", 360, 1230);
      const blob = await new Promise(res => c.toBlob(res, "image/jpeg", 0.85)), file = new File([blob], "lumen-rush.jpg", { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}` }); return; }
    }
    if (navigator.share) { await navigator.share({ title: "Lumen Rush", text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied: send it to a friend");
  } catch (e) {}
}
// ---------- The stage map ----------
function stagesHtml() {
  const S = stageSave(), d = save.dailyStage && save.dailyStage.day === dayNumber() ? save.dailyStage : null;
  let h = `<li class="sec">Daily stage</li><li class="${d ? "won" : ""}"><span><b>Today's stage</b><small>${d ? `${starText(d.stars || 0)} · ${d.time.toFixed(1)} s · race your ghost` : "The same course for everyone today"}</small></span><button data-stage="0">${d ? "Again" : "Play"}</button></li>`;
  const stars = Object.values(S.best).reduce((a, b) => a + (b.stars || 0), 0);
  h += `<li class="sec">Stages · ${stars}/${STAGES_N * 3} ★</li><li class="stgrid">`;
  for (let n = 1; n <= STAGES_N; n++) { const b = S.best[n], locked = n > S.unlocked; h += `<button class="st ${locked ? "lock" : b ? "done" : "next"}${n % 10 === 0 ? " boss" : ""}" data-stage="${n}" ${locked ? "disabled" : ""}><b>${n % 10 === 0 ? "☠" + n : n}</b><i>${locked ? "🔒" : b ? starText(b.stars) : "·"}</i></button>`; }
  return h + "</li>";
}
document.getElementById("shopList").addEventListener("click", e => {
  const b = e.target.closest("button[data-stage]"); if (!b) return;
  $("sheet").hidden = true; const n = Number(b.dataset.stage);
  if (screen === "title") { $("titleScreen").classList.add("launch"); setTimeout(() => startStage(n), 200); } else startStage(n);
});
document.getElementById("stNext").addEventListener("click", () => startStage(Number($("stNext").dataset.go)));
document.getElementById("stRetry").addEventListener("click", () => run && startStage(run.stage));
document.getElementById("stStages").addEventListener("click", () => { $("stageCard").hidden = true; run = null; showTitle(); openSheet("stages"); });
document.getElementById("stShare").addEventListener("click", stageShare);

// What's new on a stage: a short line the first time something appears.
const STAGE_NEW = { 2: ["New: live wires", "Don't touch the sparks between rooftops"], 3: ["New: drones and crumbling anchors", "Let go of orange anchors quickly"], 4: ["New: drifting anchors", "They slide; time your grab"], 5: ["The street bites now", "Every touch costs a heart"], 10: ["Boss: the Heart of the Dark", "Grab its 3 shards before it catches you"] };

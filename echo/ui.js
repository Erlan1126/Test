// Lumen Rush: the home screen, the Today panel, settings, backup and startup.
"use strict";

// ---------- Screens ----------
const screens = { title: $("titleScreen"), run: $("runScreen"), settings: $("settingsScreen") };
function show(name) {
  screen = name;
  // The tab bar sits under Home; sheets close when the screen changes.
  document.body.classList.toggle("tabs", name === "title");
  document.body.classList.toggle("inrun", name === "run");
  $("tabHome").classList.toggle("on", name === "title");
  for (const id of ["todayPanel", "sheet"]) $(id).hidden = true;
  if (name === "title") $("titleScreen").classList.remove("launch");
  for (const k in screens) screens[k].classList.toggle("on", k === name);
  // Away from the title, keep one history entry so the phone's Back button stays in the game.
  if (name !== "title" && !backArmed) {
    try { history.pushState({ echo: 1 }, ""); backArmed = true; } catch (e) {}
  }
}

// The phone's Back button goes from any other screen back to the title. Only on the title does
// Back leave the game.
let backArmed = false;
window.addEventListener("popstate", () => {
  backArmed = false;
  if (screen !== "title") showTitle();
});
function showTitle() {
  if (typeof music !== "undefined") music.district = null;   // the next game picks its own music
  renderTitle();
  show("title");
}

// Messages show one at a time so several unlocks never pile up over the screen.
const toastQueue = [];
let toastBusy = false;
function toast(html, sound) {
  toastQueue.push([html, sound]);
  if (!toastBusy) nextToast();
}
function nextToast() {
  // Mid-run, awards wait for the run to end so nothing covers the game.
  if (toastQueue.length && screen === "run" && run && !run.paused && $("stageCard").hidden && $("runOver").hidden) { toastBusy = true; setTimeout(nextToast, 800); return; }
  const item = toastQueue.shift();
  if (!item) { toastBusy = false; return; }
  toastBusy = true;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = item[0];
  $("toasts").appendChild(el);
  if (item[1]) sfx.unlock();
  setTimeout(() => { el.remove(); nextToast(); }, 2650);
}

// ---------- Home ----------
function renderTitle() {
  const rs = runSave();
  { const hl = homesLit(); $("homeBestLabel").textContent = `of ${STAGES_N} lit`; $("homeBest").textContent = `${hl}`; $("heroRing").style.setProperty("--p", (hl / STAGES_N * 100).toFixed(1)); $("tileCity").textContent = `${hl}/${STAGES_N} homes lit`; }
  $("playSub").textContent = "Hold to swing, let go to fly";
  $("chipLights").querySelector("b").textContent = (save.glow || 0).toLocaleString();
  $("chipLevel").textContent = `Lv ${lumiLevel(rs.xp || 0).lv}`;
  { const ds = save.dailyStage && save.dailyStage.day === dayNumber() ? save.dailyStage : null; $("tileDaily").textContent = ds ? `${"★".repeat(ds.stars || 1)} · ${ds.time.toFixed(1)} s` : `${stagePerson(0)[0]} waits`; }
  { const open = endlessOpen(); $("hardBtn").classList.toggle("locked", !open); $("tileEndless").textContent = !open ? "Finish Downtown" : rs.night && rs.night.week === weekNumber() && rs.night.best ? `Week: ${rs.night.best} windows` : rs.best ? `Best ${rs.best.toLocaleString()}` : "Night shift: light the city"; }
  $("todayDot").hidden = calState().claimed;
  { const n = stageNext(), st = stageStars(n); $("playLabel").textContent = st ? `Replay stage ${n}` : "Bring the light"; $("playSub").textContent = st ? `${starText(st)} · go for 3 stars` : `Stage ${n} · ${stageChapter(n)}`;
    const [who, line] = stagePerson(n); $("heroWhere").textContent = `${stageChapter(n)} · Stage ${n}${n % 10 === 0 ? " · Boss" : ""}`; $("heroWho").textContent = stageWaiting(n); $("heroLine").textContent = st ? `“${line}”` : "Their window is still dark. Bring the light home."; }
  if (stageRace && !stageRace.done) { $("playLabel").textContent = "Race your friend"; $("playSub").textContent = `${stageRace.n ? `Stage ${stageRace.n}` : "Daily stage"} · beat ${stageRace.time.toFixed(1)} s`; }
  else if (challengeFrom) { $("playLabel").textContent = "Accept challenge"; $("playSub").textContent = `Beat ${challengeFrom.score.toLocaleString()}`; }
  // The daily gift waits on the Today tab (its dot); nothing pops up over Play.
  $("titleMeta").textContent = "";
  startTitleRun();
}

const tap = (id, fn) => $(id).addEventListener("click", e => { e.stopPropagation(); audio(); fn(e); });
// Play starts the next stage (after the opening, the first time); a friend's link races them.
function playNow(opts = {}) {
  if (screen !== "title") return startRun(opts);
  $("titleScreen").classList.add("launch");
  setTimeout(() => startRun(opts), 230);
}
tap("playBtn", () => { if (stageRace && !stageRace.done) { stageRace.done = true; $("titleScreen").classList.add("launch"); setTimeout(() => { startStage(stageRace.n, { race: stageRace }); if (screen !== "run") $("titleScreen").classList.remove("launch"); }, 200); return; } if (!save.opening && !(stageSave().best[1] && stageSave().best[1].stars)) { playOpening(() => { $("titleScreen").classList.add("launch"); setTimeout(() => startStage(1), 200); }); return; } $("titleScreen").classList.add("launch"); setTimeout(() => { startStage(stageNext()); if (screen !== "run") $("titleScreen").classList.remove("launch"); }, 200); });
tap("stagesBtn", () => openSheet("stages"));
tap("dailyRunBtn", () => { $("titleScreen").classList.add("launch"); setTimeout(() => startStage(0), 200); });
// The Night shift (endless) opens once Downtown is finished: the story comes first.
function endlessOpen() { return !!(stageSave().best[10] && stageSave().best[10].stars) || (runSave().best || 0) > 0; }
tap("hardBtn", () => { if (!endlessOpen()) { toast("Endless opens when Downtown is lit: finish stage 10"); return; } playNow({}); });
tap("todayBtn", openToday);
tap("todayClose", () => { $("todayPanel").hidden = true; });
tap("calClaim", () => { const n = calClaim(); if (n) { sfx.unlock(); buzz([10, 30, 10]); toast(`Daily gift · <b>+${n}</b> lights`, true); } renderToday2(); if (screen === "title") { const keep = $("todayPanel").hidden; renderTitle(); $("todayPanel").hidden = keep; } });
function openToday() { renderToday2(); $("sheet").hidden = true; $("todayPanel").hidden = false; }
function renderToday2() {
  const st = calState(), we = weekEvent();
  $("weekEv").textContent = `${we.name} · ${we.text}`;
  $("calStreak").textContent = streakNow() ? `${streakNow()}-day streak · +${Math.round(streakBonus() * 100)}% lights` : "Play a run to start a streak";
  $("calGrid").innerHTML = CAL.map((n, i) => `<div class="${i + 1 < st.day || (i + 1 === st.day && st.claimed) ? "past" : i + 1 === st.day ? "now" : ""}">Day ${i + 1}<b>${n}</b></div>`).join("");
  $("calClaim").disabled = st.claimed; $("calClaim").textContent = st.claimed ? "Come back tomorrow" : `Claim +${CAL[st.day - 1]} ✦`;
  const dm = dailyMissions();
  const se = seasonState(), tier = seasonTier(se.xp);
  $("seasonInfo").textContent = `Tier ${tier.n} of ${SEASON_TIERS} · ${seasonDaysLeft()} days left`;
  $("seasonBar").style.width = `${Math.round(tier.into / SEASON_XP * 100)}%`;
  $("seasonNext").textContent = tier.n >= SEASON_TIERS ? "Season complete. A new one starts next month." : `Next: +${seasonReward(tier.n + 1)} lights at tier ${tier.n + 1}`;
  const rr = runSave();
  $("multInfo").textContent = `Score ×${rr.mult}`;
  $("todayRunMissions").innerHTML = rr.missions.map(m => `<li><span>${RUN.missions[m.k].text(m.goal)}</span><em>+1×</em></li>`).join("");
  $("dmList").innerHTML = dm.list.map(m => { const d = DM_POOL[m.i], k = Math.min(1, m.prog / d.goal); return `<li class="${m.done ? "done" : ""}"><span style="flex:1">${d.text(d.goal)}<span class="dm-bar"><i style="width:${Math.round(k * 100)}%"></i></span></span><span>+${DM_REWARD} ✦</span></li>`; }).join("");
}
for (const [id, kind] of [["tabShop", "upgrades"], ["tabFriends", "ranks"], ["todayAwards", "awards"], ["levelsBtn", "locker"], ["looksBtn", "locker"]])
  tap(id, () => openSheet(kind));
tap("tabHome", () => showTitle());
// Tapping the dimmed backdrop closes a sheet.
for (const id of ["sheet", "todayPanel"]) $(id).addEventListener("click", e => { if (e.target.id === id) $(id).hidden = true; });
// A soft tick when a switch changes, so settings feel alive.
document.addEventListener("click", e => { if (e.target.closest && e.target.closest(".toggle")) sfx.tick(); });

// ---------- Settings ----------
function renderSettings() {
  const st = save.settings;
  $("setMusic").value = st.music;
  $("setSfx").value = st.sfx;
  $("setVibrate").setAttribute("aria-pressed", String(!!st.vibrate));
  $("setFps").setAttribute("aria-pressed", String(!!st.fps));
  $("setCalm").setAttribute("aria-pressed", String(!!st.calm));
  $("saveCode").value = "";
  $("setReset").textContent = "Erase all progress";
  resetArmed = false;
}
let resetArmed = false;
const saveCode = () => "ECHO1:" + btoa(unescape(encodeURIComponent(JSON.stringify(save))));
tap("settingsBtn", () => { renderSettings(); show("settings"); });
tap("settingsBack", showTitle);
$("setMusic").addEventListener("input", e => { save.settings.music = +e.target.value; applyVolumes(); persist(); });
$("setSfx").addEventListener("input", e => { save.settings.sfx = +e.target.value; applyVolumes(); persist(); });
$("setSfx").addEventListener("change", () => sfx.light());
tap("setVibrate", () => { save.settings.vibrate = !save.settings.vibrate; persist(); renderSettings(); buzz(20); });
tap("setCalm", () => { save.settings.calm = !save.settings.calm; persist(); renderSettings(); });
tap("setFps", () => { save.settings.fps = !save.settings.fps; persist(); renderSettings(); $("fpsMeter").hidden = !save.settings.fps; });
tap("copyCode", async () => {
  const code = saveCode(), box = $("saveCode");
  box.value = code;
  try { await navigator.clipboard.writeText(code); toast("Save code copied"); }
  catch (e) { box.focus(); box.select(); toast("Select the code above and copy it"); }
});
tap("restoreCode", () => {
  const raw = $("saveCode").value.trim();
  try {
    if (!raw.startsWith("ECHO1:")) throw new Error("not a save code");
    const data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(6)))));
    if (!data || !Array.isArray(data.stars)) throw new Error("no stars");
    for (const k of ["settings", "stats", "daily"]) Object.assign(save[k], data[k] || {});
    for (const k in data) if (!["settings", "stats", "daily"].includes(k) && data[k] != null) save[k] = data[k];
    persist();
    muted = !!save.muted;
    applyVolumes();
    renderSettings();
    renderTitle();
    toast(`Progress restored: <b>${homesLit()}/${STAGES_N} homes lit</b>`);
  } catch (e) {
    toast("That code didn't work. Paste the whole code, starting with ECHO1:");
  }
});
tap("setReset", () => {
  if (!resetArmed) {
    resetArmed = true;
    $("setReset").textContent = "Tap again to erase everything";
    setTimeout(() => { if (resetArmed) renderSettings(); }, 3500);
    return;
  }
  save.stars = []; save.best = []; save.skin = 0; save.skinsSeen = 1; save.looksViewed = 1; save.ach = {}; save.story = {}; save.cards = {};
  save.stats = { lights: 0, moths: 0, songs: 0, clean: 0, quiet: 0, gloom: 0 };
  save.daily = { last: "", streak: 0, best: 0, stars: {} };
  for (const k of ["found", "family", "hat", "weekly", "glow", "home", "quests", "variants", "vs", "lookSeen"]) delete save[k];
  persist();
  toast("Progress erased");
  renderSettings();
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

showTitle();

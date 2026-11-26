// Lumen Rush: coming back. A seven-day reward calendar, three daily missions, a daily streak, a
// weekly event, awards, the monthly season, challenge links for friends and a score card to share.
"use strict";

const today = () => dayNumber();
const gain = n => { save.glow = (save.glow || 0) + n; };

// ---------- The calendar: open the game each day for a gift ----------
const CAL = [20, 30, 40, 60, 80, 100, 200];
function calState() {
  save.cal = save.cal || { last: -1, day: 0 };
  const c = save.cal, t = today();
  if (c.last === t) return { day: c.day, claimed: true };
  return { day: c.last === t - 1 ? (c.day % 7) + 1 : 1, claimed: false };
}
function calClaim() {
  const st = calState();
  if (st.claimed) return 0;
  save.cal = { last: today(), day: st.day };
  gain(CAL[st.day - 1]); persist();
  return CAL[st.day - 1];
}

// ---------- The streak: days in a row you've played a run ----------
function streakTouch() {
  save.streak = save.streak || { last: -1, n: 0, best: 0 };
  const s = save.streak, t = today();
  if (s.last === t) return s.n;
  s.n = s.last === t - 1 ? s.n + 1 : 1; s.last = t; s.best = Math.max(s.best, s.n);
  return s.n;
}
const streakNow = () => { const s = save.streak; return s && (s.last === today() || s.last === today() - 1) ? s.n : 0; };
// Each day of the streak adds 5% to the lights you bring home (up to +50%).
const streakBonus = () => Math.min(0.5, streakNow() * 0.05);

// ---------- Daily missions: three a day, the same for everyone ----------
// Today's three missions, all things you do in the swing game.
const DM_POOL = [
  { k: "home", goal: 3, text: n => `Bring light to ${n} homes today` },
  { k: "perfect", goal: 30, text: n => `Land ${n} Perfects today` },
  { k: "pchain", goal: 5, text: n => `Chain ${n} Perfects in a row`, max: true },
  { k: "lights", goal: 250, text: n => `Catch ${n} lights today` },
  { k: "free", goal: 40, text: n => `Light up ${n} buildings today` },
  { k: "stars", goal: 3, text: () => "Earn 3 stars on any stage", max: true },
  { k: "daily", goal: 1, text: () => "Bring light to today's neighbour" },
  { k: "nightlit", goal: 15, text: n => `Light ${n} windows in one Night shift`, max: true },
  { k: "near", goal: 8, text: n => `Get ${n} close calls with drones today` },
];
const DM_REWARD = 30, DM_ALL = 50;
function dailyMissions() {
  const t = today();
  if (!save.dm || save.dm.day !== t || save.dm.v !== 2 || save.dm.list.some(m => !DM_POOL[m.i])) {
    const r = seeded(t * 31 + 5), pool = DM_POOL.map((_, i) => i), list = [];
    while (list.length < 3) list.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    save.dm = { v: 2, day: t, list: list.map(i => ({ i, prog: 0, done: false })), all: false };
  }
  return save.dm;
}
// Something happened in a run: count it toward today's missions and the achievements.
function progressEvent(k, v = 1) {
  if (run && (run.attract || run.free)) return;
  const dm = dailyMissions();
  for (const m of dm.list) {
    const def = DM_POOL[m.i];
    if (def.k !== k || m.done) continue;
    m.prog = def.max ? Math.max(m.prog, v) : m.prog + v;
    if (m.prog >= def.goal) { m.done = true; gain(DM_REWARD); if (run && !run.over) runMsg("Daily mission done!", `+${DM_REWARD} ✦`, 2, true); }
  }
  if (!dm.all && dm.list.every(m => m.done)) { dm.all = true; gain(DM_ALL); if (run && !run.over) runMsg("All daily missions!", `+${DM_ALL} ✦`, 2.4, true); }
  save.prog = save.prog || {};
  if (["free", "boss", "near", "fork", "runs", "home", "perfect", "daily", "lights"].includes(k)) save.prog[k] = (save.prog[k] || 0) + v;
  if (["combo", "dist", "pchain", "nightlit", "stars"].includes(k)) save.prog[k] = Math.max(save.prog[k] || 0, v);
}

// ---------- The weekly event ----------
const WEEK_EVENTS = [
  { id: "gold", name: "Golden Week", text: "Every light counts double" },
  { id: "frost", name: "Gold Rush Week", text: "Gold anchors everywhere" },
  { id: "shadow", name: "Dark Week", text: "The dark is faster, ×1.5 score" },
  { id: "rush", name: "Overdrive Week", text: "Flow fills twice as fast" },
  { id: "spring", name: "Spring Week", text: "Spring anchors everywhere" },
];
const weekEvent = () => WEEK_EVENTS[weekNumber() % WEEK_EVENTS.length];

// ---------- Achievements ----------
// Awards: the story of the city coming back, and the skills that get you there.
const distLit = c => { const S = stageSave(); for (let n = c * 10 + 1; n <= c * 10 + 10; n++) if (!(S.best[n] && S.best[n].stars)) return false; return true; };
const allStars = () => Object.values(stageSave().best).reduce((a, b) => a + ((b && b.stars) || 0), 0);
const threeStars = () => Object.values(stageSave().best).filter(b => b && b.stars === 3).length;
const RUN_ACHS = [
  { id: "home1", name: "First light", text: "Bring the light back to your first home", test: () => (save.prog || {}).home >= 1, r: 30 },
  { id: "d0", name: "Downtown glows", text: "Relight every home in Downtown", test: () => distLit(0), r: 80 },
  { id: "d1", name: "Market lanterns", text: "Relight every home in the Markets", test: () => distLit(1), r: 100 },
  { id: "d2", name: "Lighthouse keeper", text: "Relight every home in the Harbour", test: () => distLit(2), r: 120 },
  { id: "d3", name: "Insert coin", text: "Relight every home in the Arcade", test: () => distLit(3), r: 140 },
  { id: "d4", name: "Firefly", text: "Relight every home in the Park", test: () => distLit(4), r: 160 },
  { id: "dawn", name: "Dawn", text: "Relight all 60 homes", test: () => distLit(5) && [0, 1, 2, 3, 4].every(distLit), r: 500 },
  { id: "boss1", name: "Heartbreaker", text: "Break the Heart of the Dark", test: () => (save.prog || {}).boss >= 1, r: 60 },
  { id: "t5", name: "Flawless", text: "Earn 3 stars on 5 stages", test: () => threeStars() >= 5, r: 80 },
  { id: "t90", name: "Starlight", text: "Collect 90 stars", test: () => allStars() >= 90, r: 200 },
  { id: "pc10", name: "In tune", text: "Chain 10 Perfects in a row", test: () => (save.prog || {}).pchain >= 10, r: 80 },
  { id: "p500", name: "Perfectionist", text: "Land 500 Perfects", test: () => (save.prog || {}).perfect >= 500, r: 150 },
  { id: "n30", name: "Night owl", text: "Light 30 windows in one Night shift", test: () => (save.prog || {}).nightlit >= 30, r: 100 },
  { id: "dy7", name: "Good neighbour", text: "Reach 7 daily neighbours", test: () => (save.prog || {}).daily >= 7, r: 120 },
  { id: "s7", name: "Every day", text: "Play 7 days in a row", test: () => (save.streak || {}).best >= 7, r: 100 },
];
function checkAchievements() {
  save.runAch = save.runAch || {};
  const fresh = RUN_ACHS.filter(a => !save.runAch[a.id] && a.test());
  for (const a of fresh) { save.runAch[a.id] = 1; gain(a.r); toast(`Award · <b>${a.name}</b> · +${a.r} lights`, true); }
  if (fresh.length) persist();
  return fresh;
}

// ---------- The season: a free reward track, new every month ----------
const SEASON_TIERS = 30, SEASON_XP = 150;
const seasonId = () => { const d = new Date(); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const seasonDaysLeft = () => { const d = new Date(), end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); return Math.max(1, Math.ceil((end - d.getTime()) / 86400000)); };
const seasonReward = n => 15 + n * 5 + (n % 10 === 0 ? n * 15 : 0);
function seasonState() { if (!save.season || save.season.id !== seasonId()) save.season = { id: seasonId(), xp: 0, paid: 0 }; return save.season; }
const seasonTier = xp => ({ n: Math.min(SEASON_TIERS, Math.floor(xp / SEASON_XP)), into: xp >= SEASON_TIERS * SEASON_XP ? SEASON_XP : xp % SEASON_XP });
// Experience from a run moves the season along; each tier reached pays its reward at once.
function seasonGain(xp) {
  const se = seasonState(); se.xp += xp;
  const n = seasonTier(se.xp).n; let paid = 0;
  while (se.paid < n) { se.paid++; const r = seasonReward(se.paid); gain(r); paid += r; }
  if (paid) toast(`Season tier ${n} · <b>+${paid}</b> lights`, true);
  return paid;
}

// ---------- Challenge a friend; share a score card ----------
// A link carries a seed and a score: your friend plays the very same Night shift and tries to beat you.
const challengeFrom = (() => {
  try { const p = new URLSearchParams(location.search).get("ch"); if (!p) return null; const [seed, score] = p.split(".").map(Number); return seed > 0 ? { seed, score: score || 0 } : null; } catch (e) { return null; }
})();
function challengeLink(seed, score) { return `${location.origin}${location.pathname}?ch=${seed}.${score}`; }
async function shareRun(score, metres, combo, seed) {
  const c = document.createElement("canvas"); c.width = 720; c.height = 900;
  const g = c.getContext("2d"), bg = g.createLinearGradient(0, 0, 0, 900);
  bg.addColorStop(0, "#070a1c"); bg.addColorStop(0.6, "#1a1438"); bg.addColorStop(1, "#05060e"); g.fillStyle = bg; g.fillRect(0, 0, 720, 900);
  const glowAt = (x, y, r, rgb) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  for (let q = 0; q < 40; q++) glowAt(Math.random() * 720, Math.random() * 900, 6, "255,215,130");
  glowAt(360, 560, 160, "150,235,255");
  g.fillStyle = "#fff"; g.beginPath(); g.arc(360, 560, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#123049"; g.beginPath(); g.ellipse(344, 556, 6, 9, 0, 0, Math.PI * 2); g.ellipse(376, 556, 6, 9, 0, 0, Math.PI * 2); g.fill();
  g.textAlign = "center"; g.fillStyle = "#eef8ff"; g.font = "800 60px Inter, system-ui, sans-serif"; g.fillText("LUMEN RUSH", 360, 120);
  g.font = "600 110px system-ui, sans-serif"; g.fillText(score.toLocaleString(), 360, 300);
  g.font = "34px system-ui, sans-serif"; g.fillStyle = "#ffd98a"; g.fillText(`${metres} m  ·  ${combo} combo`, 360, 370);
  g.font = "italic 34px Georgia, serif"; g.fillStyle = "#c8d6ee"; g.fillText("Can you glide further?", 360, 780);
  const url = challengeLink(seed, score), text = `I scored ${score.toLocaleString()} in Lumen Rush (${metres} m). Run my street and beat me: ${url}`;
  try {
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const file = new File([blob], "lumen-rush.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Challenge link copied! Paste it to a friend"); } catch (e) { toast(text); }
}

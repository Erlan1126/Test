// Echo: coming back. A seven-day reward calendar, three daily missions, a daily streak, a
// weekly event, achievements, playable friends with perks, rebuilding the Singer's city with
// lights, challenge links for friends and a score card to share.
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
const DM_POOL = [
  { k: "lights", goal: 150, text: n => `Gather ${n} lights today` },
  { k: "free", goal: 20, text: n => `Sing ${n} shadows free today` },
  { k: "dist", goal: 800, text: n => `Reach ${n} m in one run`, max: true },
  { k: "boss", goal: 1, text: () => "Calm a world's Warden" },
  { k: "runs", goal: 3, text: n => `Play ${n} runs` },
  { k: "combo", goal: 25, text: n => `Reach a ${n} combo`, max: true },
  { k: "near", goal: 12, text: n => `Get ${n} close calls today` },
  { k: "fork", goal: 2, text: n => `Take the risky way at ${n} forks` },
];
const DM_REWARD = 30, DM_ALL = 50;
function dailyMissions() {
  const t = today();
  if (!save.dm || save.dm.day !== t) {
    const r = seeded(t * 31 + 5), pool = DM_POOL.map((_, i) => i), list = [];
    while (list.length < 3) list.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    save.dm = { day: t, list: list.map(i => ({ i, prog: 0, done: false })), all: false };
  }
  return save.dm;
}
// Something happened in a run: count it toward today's missions and the achievements.
function progressEvent(k, v = 1) {
  if (run && run.attract) return;
  const dm = dailyMissions();
  for (const m of dm.list) {
    const def = DM_POOL[m.i];
    if (def.k !== k || m.done) continue;
    m.prog = def.max ? Math.max(m.prog, v) : m.prog + v;
    if (m.prog >= def.goal) { m.done = true; gain(DM_REWARD); if (run && !run.over) runMsg("Daily mission done!", `+${DM_REWARD} ✦`, 2, true); }
  }
  if (!dm.all && dm.list.every(m => m.done)) { dm.all = true; gain(DM_ALL); if (run && !run.over) runMsg("All daily missions!", `+${DM_ALL} ✦`, 2.4, true); }
  save.prog = save.prog || {};
  if (["free", "boss", "near", "fork", "runs"].includes(k)) save.prog[k] = (save.prog[k] || 0) + v;
  if (k === "combo" || k === "dist") save.prog[k] = Math.max(save.prog[k] || 0, v);
}

// ---------- The weekly event ----------
const WEEK_EVENTS = [
  { id: "gold", name: "Golden Week", text: "Every light counts double" },
  { id: "frost", name: "Frost Week", text: "Icicles fall in every world" },
  { id: "shadow", name: "Shadow Week", text: "More shadows, ×1.5 score" },
  { id: "rush", name: "Rush Week", text: "Every big moment is a rush" },
];
const weekEvent = () => WEEK_EVENTS[weekNumber() % WEEK_EVENTS.length];

// ---------- Playable friends ----------
// Friends you find in runs can be played as; each brings a small gift.
const FRIEND_PERKS = [
  "Starts each run with a Magnet", "Bubbles carry you twice as far", "Currents can't push you", "Crystal gates open wider",
  "Lava can't hurt you", "Icicles fall slowly", "Songs reach a quarter further", "Lanterns swing slower",
  "Sees through the dark", "Small: close calls are easier", "Shadows drift away from you", "One extra light of your own",
];
const playingAs = () => { const c = (save.run || {}).char; return c != null && c >= 0 && (save.runFriends || {})[c] ? c : -1; };
const perk = i => playingAs() === i;

// ---------- Rebuilding the city ----------
const CITY_BUILDS = [
  { id: "lamps", name: "Street lamps", cost: 40, text: "Light the street again" },
  { id: "bakery", name: "The bakery", cost: 90, text: "Warm windows and the smell of bread" },
  { id: "fountain", name: "The fountain", cost: 160, text: "Singing water in the square" },
  { id: "houses", name: "The old houses", cost: 260, text: "Every window lit" },
  { id: "garden", name: "The glow garden", cost: 380, text: "Glowing flowers along the street" },
  { id: "bridge", name: "The stone bridge", cost: 520, text: "Lanterns across the river" },
  { id: "hall", name: "The music hall", cost: 700, text: "A dome full of songs" },
  { id: "tower", name: "The Singer's tower", cost: 1000, text: "The heart of the city, shining" },
];
const built = id => !!(save.builds || {})[id];
function buildIt(id) {
  const b = CITY_BUILDS.find(q => q.id === id);
  if (!b || built(id) || (save.glow || 0) < b.cost) return false;
  save.glow -= b.cost; save.builds = save.builds || {}; save.builds[id] = 1; persist();
  sfx.gate(); buzz([20, 40, 20]); checkAchievements();
  return true;
}

// ---------- Achievements ----------
const RUN_ACHS = [
  { id: "m500", name: "Deep breath", text: "Reach 500 m", test: () => (save.prog || {}).dist >= 500, r: 30 },
  { id: "m1500", name: "Long way home", text: "Reach 1,500 m", test: () => (save.prog || {}).dist >= 1500, r: 80 },
  { id: "m3000", name: "Almost the sky", text: "Reach 3,000 m", test: () => (save.prog || {}).dist >= 3000, r: 200 },
  { id: "c30", name: "In tune", text: "Reach a 30 combo", test: () => (save.prog || {}).combo >= 30, r: 40 },
  { id: "c80", name: "Perfect song", text: "Reach an 80 combo", test: () => (save.prog || {}).combo >= 80, r: 120 },
  { id: "f50", name: "Choir", text: "Sing 50 shadows free", test: () => (save.prog || {}).free >= 50, r: 50 },
  { id: "b1", name: "Peacemaker", text: "Calm a Warden", test: () => (save.prog || {}).boss >= 1, r: 40 },
  { id: "b5", name: "Warden's friend", text: "Calm 5 Wardens", test: () => (save.prog || {}).boss >= 5, r: 120 },
  { id: "fr3", name: "Not alone", text: "Find 3 lost friends", test: () => Object.keys(save.runFriends || {}).length >= 3, r: 50 },
  { id: "fr12", name: "Everyone home", text: "Find all 12 lost friends", test: () => Object.keys(save.runFriends || {}).length >= 12, r: 300 },
  { id: "s7", name: "Every day", text: "Play 7 days in a row", test: () => (save.streak || {}).best >= 7, r: 100 },
  { id: "build4", name: "Rebuilder", text: "Rebuild 4 places in the city", test: () => Object.keys(save.builds || {}).length >= 4, r: 80 },
  { id: "tower", name: "The heart shines", text: "Rebuild the Singer's tower", test: () => built("tower"), r: 300 },
  { id: "hard", name: "Fearless", text: "Reach 500 m in Hard mode", test: () => (save.prog || {}).hardDist >= 500, r: 100 },
];
function checkAchievements() {
  save.runAch = save.runAch || {};
  const fresh = RUN_ACHS.filter(a => !save.runAch[a.id] && a.test());
  for (const a of fresh) { save.runAch[a.id] = 1; gain(a.r); toast(`🏆 <b>${a.name}</b> · +${a.r} ✦`, true); }
  if (fresh.length) persist();
  return fresh;
}

// ---------- Challenge a friend; share a score card ----------
// A link carries a seed and a score: your friend plays the very same cave and tries to beat you.
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
  g.textAlign = "center"; g.fillStyle = "#eef8ff"; g.font = "500 64px Cinzel, Georgia, serif"; g.fillText("E C H O", 360, 120);
  g.font = "600 110px system-ui, sans-serif"; g.fillText(score.toLocaleString(), 360, 300);
  g.font = "34px system-ui, sans-serif"; g.fillStyle = "#ffd98a"; g.fillText(`${metres} m  ·  ${combo} combo`, 360, 370);
  g.font = "italic 34px Georgia, serif"; g.fillStyle = "#c8d6ee"; g.fillText("Can you glide further?", 360, 780);
  const url = challengeLink(seed, score), text = `I scored ${score.toLocaleString()} in Echo (${metres} m). Play my cave and beat me: ${url}`;
  try {
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const file = new File([blob], "echo-run.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Challenge link copied! Paste it to a friend"); } catch (e) { toast(text); }
}

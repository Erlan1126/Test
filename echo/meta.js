// Echo: reasons to come back each day. The daily cave's twist, streak rewards and shields,
// three daily quests, Lumi's home (decorated with glow earned in caves), rare Hushlings to
// spot, a spoiler-free result to share with a friend's score to beat, and a nudge to keep
// Echo on the home screen.
"use strict";

// ---------- The daily cave ----------
const ECHO_EPOCH = 20756;               // the day before the first numbered daily cave
const dailyNumber = (day = dayNumber()) => day - ECHO_EPOCH;
const dayOfKey = key => Math.round(Date.parse(key) / 86400000);
const GAME_URL = "https://erlan1126.github.io/Test/echo.html";

// Each day's cave has a twist, the same for everyone.
const TWISTS = [
  { id: "calm",   ico: "🌙", name: "Quiet Waters",   text: "A calm cave. Take your time." },
  { id: "hush",   ico: "👀", name: "Hushling Night", text: "Extra Hushlings are out tonight." },
  { id: "silent", ico: "🤫", name: "Silent Day",     text: "Only a few songs. Make them count." },
  { id: "dark",   ico: "🌑", name: "Deep Dark",      text: "Even Lumi's own light barely reaches the walls." },
  { id: "stars",  ico: "✨", name: "Star Shower",    text: "Extra lost lights are hiding everywhere." },
  { id: "swift",  ico: "⏱️", name: "Swift Current",  text: "Reach the portal before time runs out." },
];
const twistFor = (day = dayNumber()) => TWISTS[Math.floor(seeded(day * 7349 + 11)() * TWISTS.length)];

// Changes a freshly generated daily cave to suit the day's twist.
function applyTwist(def, day) {
  const tw = twistFor(day), g = def.map.map(r => r.split("")), r = seeded(day * 911 + 5);
  let S = [0, 0];
  g.forEach((row, y) => row.forEach((c, x) => { if (c === "S") S = [x, y]; }));
  const spots = () => {
    const out = [];
    g.forEach((row, y) => row.forEach((c, x) => {
      if (c !== "." || Math.abs(x - S[0]) + Math.abs(y - S[1]) < 6) return;
      for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++)
        if (g[yy] && "tnakwjgBo".includes(g[yy][xx])) return;
      out.push([x, y]);
    }));
    return out;
  };
  const place = (ch, n) => { for (let k = 0; k < n; k++) { const s = spots(); if (!s.length) return; const [x, y] = s[Math.floor(r() * s.length)]; g[y][x] = ch; } };
  const out = Object.assign({}, def, { twist: tw.id });
  if (tw.id === "hush") place("g", 2);
  if (tw.id === "stars") place("o", 3);
  if (tw.id === "silent" && !def.songs) out.songs = def.par + 3;
  if (tw.id === "dark") out.dark = true;
  if (tw.id === "swift" && !def.time) {
    const crit = g.flat().filter(c => "tnakwjgB".includes(c)).length;
    out.time = Math.ceil(def.walk / 2 + 14 + crit * 2.5);
  }
  out.map = g.map(row => row.join(""));
  return out;
}

// A friend's score to beat, from a shared link (?vs=number.songs.seconds).
(() => {
  try {
    const m = /[?&]vs=(\d+)\.(\d+)\.(\d+)/.exec(location.search);
    if (m) { save.vs = { n: +m[1], songs: +m[2], secs: +m[3] }; persist(); }
  } catch (e) {}
})();
const friendScore = () => (save.vs && save.vs.n === dailyNumber() ? save.vs : null);

// ---------- Streaks ----------
// A missed day can be covered by a streak shield; one is earned every 7 days (up to 2).
function streakAlive() {
  const d = save.daily;
  if (!d.streak || !d.last) return false;
  const gap = dayNumber() - dayOfKey(d.last);
  return gap <= 1 + (d.shields || 0);
}
// Called when the daily cave is cleared; returns a line for the results screen.
function dailyCleared(stars) {
  const d = save.daily, today = dayKey(), notes = [];
  if (d.last !== today) {
    const gap = d.last ? dayNumber() - dayOfKey(d.last) : 99;
    if (gap === 1) d.streak++;
    else if (d.streak && gap > 1 && gap - 1 <= (d.shields || 0)) {
      d.shields -= gap - 1;
      d.streak++;
      notes.push(`🛡️ Streak shield used`);
    } else d.streak = 1;
    d.last = today;
    d.best = Math.max(d.best, d.streak);
    if (d.streak % 7 === 0 && (d.shields || 0) < 2) { d.shields = (d.shields || 0) + 1; notes.push("🛡️ You earned a streak shield"); }
    const reward = STREAK_REWARDS.find(s => s.day === d.streak);
    if (reward) notes.push(`🎁 ${reward.text}`);
    earnGlow(10);
  }
  d.stars[today] = Math.max(d.stars[today] || 0, stars);
  return [`🔥 ${d.streak} day streak`, ...notes].join(" · ");
}
const STREAK_REWARDS = [
  { day: 3, text: "3 days! The night cap is yours" },
  { day: 7, text: "A whole week! New look: Dawn" },
  { day: 14, text: "14 days! The halo is yours" },
  { day: 30, text: "30 days! New look: Golden Lumi" },
];

// ---------- Glow: earned in caves, spent on Lumi's home ----------
function earnGlow(n) {
  if (save.glow == null) save.glow = (save.stats && save.stats.lights) || 0;
  save.glow += n;
}
const glowNow = () => (save.glow == null ? (save.stats && save.stats.lights) || 0 : save.glow);

// ---------- Daily quests ----------
const QUESTS = [
  { id: "escape",    goal: 3, text: "Escape 3 Hushlings by running or hiding" },
  { id: "lights",    goal: 5, text: "Collect 5 lost lights" },
  { id: "caves",     goal: 2, text: "Finish 2 caves" },
  { id: "untouched", goal: 1, text: "Finish a cave with creatures without being touched" },
  { id: "bright",    goal: 1, text: "Finish a cave with half your light left" },
  { id: "stars3",    goal: 1, text: "Get 3 stars in a cave" },
  { id: "quiet",     goal: 1, text: "Finish a cave singing 4 times or fewer" },
  { id: "daily",     goal: 1, text: "Clear today's daily cave" },
  { id: "rune",      goal: 2, text: "Wake 2 rune stones" },
];
const QUEST_GLOW = 15, QUEST_BONUS = 25;
function todayQuests() {
  const r = seeded(dayNumber() * 31 + 7), pool = QUESTS.slice(), out = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
function questState() {
  const day = dayNumber();
  if (!save.quests || save.quests.day !== day) save.quests = { day, prog: {}, done: {}, bonus: false };
  return save.quests;
}
function questEvent(id, n = 1) {
  if (!L || L.demo) return;
  const q = questState(), quest = todayQuests().find(x => x.id === id);
  if (!quest || q.done[id]) return;
  q.prog[id] = (q.prog[id] || 0) + n;
  if (q.prog[id] < quest.goal) return;
  q.done[id] = 1;
  earnGlow(QUEST_GLOW);
  toast(`✅ Quest done: <b>${quest.text}</b> · +${QUEST_GLOW} ✦`, true);
  if (!q.bonus && todayQuests().every(x => q.done[x.id])) {
    q.bonus = true;
    earnGlow(QUEST_BONUS);
    toast(`🌟 All of today's quests! <b>+${QUEST_BONUS} ✦</b>`, true);
  }
  persist();
}
// Quests checked when a cave is finished.
function questsOnFinish(stars) {
  questEvent("caves");
  if (L.hits === 0 && (L.gloom.length || L.mobs.length || L.thorns.length)) questEvent("untouched");
  if (L.useEnergy && L.energy >= 50) questEvent("bright");
  if (stars === 3) questEvent("stars3");
  if (L.pings <= 4) questEvent("quiet");
  if (levelIndex === DAILY) questEvent("daily");
}

// ---------- Rare Hushlings ----------
// About one cave in eighteen has a rare Hushling. Spotting each kind for the first time is a
// little event, and they're collected in the journal.
const VARIANTS = {
  gold:   { name: "Golden Hushling", tip: "So rare! It glitters as it hunts.", body: ["#6a4a10", "#2e1f06", "#140c02"], eye: "#ffd36e", glow: "gold" },
  sleepy: { name: "Sleepy Hushling", tip: "Half asleep, and a little slower.", body: ["#2a2f4e", "#14182a", "#080a14"], eye: "#9fd8ff", glow: "cyan" },
  tiny:   { name: "Tiny Hushling",   tip: "Small, quick and very cross.",      body: ["#3a1a4e", "#1a0a26", "#08040e"], eye: "#ff9ad0", glow: "pink" },
  pale:   { name: "Pale Hushling",   tip: "A ghost of a ghost. Barely there.", body: ["#9aa6c8", "#4a5578", "#1e2440"], eye: "#e8f4ff", glow: "white" },
};
function assignVariant(i) {
  const pool = L.gloom.filter(g => !g.big);
  if (!pool.length || (i >= 0 && i < 19)) return;
  const r = seeded((i === DAILY ? dailyNumber() * 3 + 900000 : i * 977) + 3);
  if (r() > 0.055) return;
  const kinds = Object.keys(VARIANTS), g = pool[Math.floor(r() * pool.length)];
  g.variant = kinds[Math.floor(r() * kinds.length)];
}
// The first sighting of each rare kind: returns true if a banner was shown.
function spotVariant(g) {
  save.variants = save.variants || {};
  if (!g.variant || save.variants[g.variant]) return false;
  save.variants[g.variant] = 1;
  earnGlow(20);
  persist();
  const v = VARIANTS[g.variant];
  $("encounter").querySelector("small").textContent = "Rare sighting!";
  $("encounterName").textContent = v.name;
  $("encounterTip").textContent = `${v.tip} +20 ✦`;
  $("encounter").classList.add("on");
  sfx.unlock();
  buzz([20, 40, 20]);
  return true;
}

// ---------- Lumi's home ----------
const HOME_ITEMS = [
  { id: "shrooms",  name: "Mushroom patch", cost: 20 },
  { id: "lantern",  name: "Lantern",        cost: 40 },
  { id: "rug",      name: "Moss rug",       cost: 60 },
  { id: "crystal",  name: "Crystal cluster", cost: 90 },
  { id: "jar",      name: "Glow-moth jar",  cost: 120 },
  { id: "falls",    name: "Little waterfall", cost: 160 },
  { id: "mobile",   name: "Star mobile",    cost: 220 },
  { id: "hammock",  name: "Hammock",        cost: 300 },
];
const ITEM_ART = {
  shrooms: '<g transform="translate(46 150)"><path d="M-2 0q1-9 0-14h4q-1 5 0 14z" fill="#d7d0bd"/><path d="M-11-13q11-15 22 0q-11 3-22 0z" fill="#3f8f7d"/><circle cx="-4" cy="-17" r="1.6" fill="#c8ffeb"/><circle cx="3" cy="-19" r="1.2" fill="#c8ffeb"/><path d="M13 0q1-6 0-9h3q-1 4 0 9z" fill="#d7d0bd"/><path d="M7-8q8-11 16 0q-8 2-16 0z" fill="#a8507a"/></g>',
  lantern: '<g transform="translate(232 34)"><path d="M0-34V0" stroke="#7a6a50" stroke-width="1.2"/><circle cy="10" r="22" fill="#ffd36e" opacity=".15"/><rect x="-6" y="0" width="12" height="3" fill="#3a2a1a"/><rect x="-5" y="3" width="10" height="14" rx="2" fill="#ffd27a"/><rect x="-6" y="17" width="12" height="3" fill="#3a2a1a"/></g>',
  rug: '<ellipse cx="150" cy="158" rx="62" ry="9" fill="#2f6b3e"/><ellipse cx="150" cy="157" rx="52" ry="6" fill="#3f8a4f"/>',
  crystal: '<g transform="translate(262 152)"><path d="M0 0l-6-26 6-8 6 8z" fill="#cdb2ff"/><path d="M0 0l6-26-6-8z" fill="#7a55c4"/><path d="M-8 0l-10-16 3-6 9 10z" fill="#9e7ae0"/><path d="M8 0l9-14-2-6-9 9z" fill="#5d3f9e"/><circle cy="-14" r="24" fill="#b48cff" opacity=".12"/></g>',
  jar: '<g transform="translate(86 128)"><circle cy="10" r="20" fill="#9dffbf" opacity=".14"/><rect x="-9" y="0" width="18" height="22" rx="5" fill="#bfe8ff" opacity=".25" stroke="#bfe8ff" stroke-opacity=".6"/><rect x="-7" y="-4" width="14" height="5" rx="1" fill="#6a5238"/><circle cx="-2" cy="9" r="2" fill="#c8ffd8"/><circle cx="3" cy="15" r="1.6" fill="#c8ffd8"/></g>',
  falls: '<g><path d="M12 20q10 60 4 140" stroke="#7ee8ff" stroke-opacity=".5" stroke-width="8" fill="none"/><path d="M14 20q8 60 3 140" stroke="#e9fbff" stroke-opacity=".6" stroke-width="2" fill="none"/><ellipse cx="18" cy="160" rx="16" ry="4" fill="#7ee8ff" opacity=".35"/></g>',
  mobile: '<g transform="translate(150 22)"><path d="M0-22V0M-24 0h48M-24 0v12M0 0v20M24 0v10" stroke="#8ea3c8" stroke-width="1"/><path d="M-24 12l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#ffe6a0"/><path d="M0 20l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#ffd1ea"/><path d="M24 10l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#c9f6ff"/></g>',
  hammock: '<g><path d="M178 70q32 26 64 0" stroke="#c9a46a" stroke-width="3" fill="none"/><path d="M180 72q30 20 60 0" fill="#d9b37a" opacity=".85"/><path d="M178 70l-6-30M242 70l6-30" stroke="#7a6a50" stroke-width="1.2"/></g>',
};
function homeSvg() {
  const own = save.home || {}, fam = Object.keys(save.family || {}).map(Number).sort((a, b) => a - b);
  const items = HOME_ITEMS.filter(it => own[it.id]).map(it => ITEM_ART[it.id]).join("");
  const sk = SKINS[save.skin] && skinUnlocked(save.skin) && SKINS[save.skin].body ? SKINS[save.skin].body : ["#ffffff", "#c9f6ff", "#6fd9ff"];
  const face = (x, y, r, col) => `<g transform="translate(${x} ${y})"><circle r="${r * 2.2}" fill="${col}" opacity=".18"/><circle r="${r}" fill="${col}"/><circle cx="${-r * 0.33}" cy="${-r * 0.15}" r="${r * 0.15}" fill="#123049"/><circle cx="${r * 0.33}" cy="${-r * 0.15}" r="${r * 0.15}" fill="#123049"/><path d="M${-r * 0.28} ${r * 0.28}q${r * 0.28} ${r * 0.22} ${r * 0.56} 0" stroke="#123049" stroke-width="${r * 0.12}" fill="none" stroke-linecap="round"/></g>`;
  const spots = [[112, 146], [190, 146], [130, 132], [172, 132], [96, 150], [206, 150], [150, 126], [76, 154]];
  const famArt = fam.map((w, k) => face(spots[k % spots.length][0], spots[k % spots.length][1], 6, `rgb(${THEMES[w % THEMES.length].rim.map(v => Math.round(v * 0.5 + 127)).join(",")})`)).join("");
  return `<svg viewBox="0 0 300 180" aria-label="Lumi's home"><defs><radialGradient id="homeBg" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#1c2a4e"/><stop offset="1" stop-color="#070a18"/></radialGradient></defs>
    <rect width="300" height="180" fill="url(#homeBg)"/>
    <path d="M0 0h300v40q-30-30-70-24q-30-26-80-14q-50-12-80 14q-40-6-70 24z" fill="#141c34"/>
    <path d="M0 180v-24q40-8 80-4q40-10 70-2q40-8 80 0q40-6 70 6v24z" fill="#141c34"/>
    <path d="M0 158q40-8 80-4q40-10 70-2q40-8 80 0q40-6 70 6" stroke="#3a4f7a" stroke-width="1.5" fill="none"/>
    ${items}${famArt}${face(150, 140, 10, sk[1])}</svg>`;
}
function renderHome() {
  const own = save.home || {}, fam = Object.keys(save.family || {}).length;
  $("homeScene").innerHTML = homeSvg();
  $("homeSub").textContent = fam ? `${fam} of Lumi's family ${fam === 1 ? "lives" : "live"} here now.` : "Find Lumi's family in the caves and they'll come home.";
  $("homeWallet").innerHTML = `<b>✦ ${glowNow()}</b> glow · earned from lights, stars and quests`;
  const q = questState();
  $("homeQuests").innerHTML = todayQuests().map(x => `<li class="${q.done[x.id] ? "done" : ""}"><span>${q.done[x.id] ? "✅" : "◻️"} ${x.text}</span><span>${q.done[x.id] ? "" : `${Math.min(q.prog[x.id] || 0, x.goal)}/${x.goal}`}</span></li>`).join("");
  const shop = $("homeShop");
  shop.innerHTML = "";
  for (const it of HOME_ITEMS) {
    const b = document.createElement("button");
    b.className = "shop-item" + (own[it.id] ? " owned" : "");
    b.innerHTML = `<span>${it.name}</span><span>${own[it.id] ? "✓" : `✦ ${it.cost}`}</span>`;
    b.addEventListener("click", () => {
      if (own[it.id]) return;
      if (glowNow() < it.cost) { toast(`You need <b>${it.cost - glowNow()}</b> more glow`); return; }
      earnGlow(-it.cost);
      save.home = Object.assign(save.home || {}, { [it.id]: 1 });
      persist();
      sfx.unlock();
      renderHome();
    });
    shop.appendChild(b);
  }
}

// ---------- Today's cave on the title screen ----------
function untilTomorrow() {
  const ms = (dayNumber() + 1) * 86400000 - Date.now(), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function renderToday() {
  const tw = twistFor(), d = save.daily, done = d.last === dayKey(), st = d.stars[dayKey()] || 0, q = questState();
  const qd = todayQuests().filter(x => q.done[x.id]).length, fr = friendScore();
  $("todayIco").textContent = tw.ico;
  $("todayName").textContent = `Daily #${dailyNumber()} · ${tw.name}`;
  $("todayInfo").textContent = done
    ? `Done ${"★".repeat(st)}${"☆".repeat(3 - st)} · next cave in ${untilTomorrow()}`
    : fr ? `A friend sang ${fr.songs} times in ${fmtTime(fr.secs)}. Beat it!` : `${tw.text} · ${untilTomorrow()} left`;
  $("todayStreak").textContent = streakAlive() ? `🔥 ${d.streak}` : "🔥 0";
  $("todayQuests").textContent = `Quests ${qd}/3`;
  $("todayCard").classList.toggle("done", done);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
setInterval(() => { if (screen === "title") renderToday(); }, 30000);

// ---------- Sharing a daily result ----------
function shareDaily(stars) {
  const tw = twistFor(), secs = Math.round(L.time), n = dailyNumber();
  const text = `Echo #${n} · ${tw.name} ${tw.ico}\n${"★".repeat(stars)}${"☆".repeat(3 - stars)} · 🎵 ${L.pings} songs · ⏱ ${fmtTime(secs)} · 🔥 ${save.daily.streak}\nCan you beat me? ${GAME_URL}?vs=${n}.${L.pings}.${secs}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Copied! Paste it anywhere"), () => toast(text.replace(/\n/g, "<br>")));
  else toast(text.replace(/\n/g, "<br>"));
}
// How you did against the friend whose link you opened.
function friendVerdict() {
  const fr = friendScore();
  if (!fr || levelIndex !== DAILY) return "";
  const me = L.pings * 1000 + Math.round(L.time), them = fr.songs * 1000 + fr.secs;
  return me < them ? "🏆 You beat your friend's score!" : me === them ? "🤝 A tie with your friend!" : `Your friend wins: ${fr.songs} songs · ${fmtTime(fr.secs)}`;
}

// ---------- Keep Echo on the home screen ----------
let installEvent = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; });
const isInstalled = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
function maybeAskInstall() {
  if (save.installAsked || isInstalled() || save.stars.filter(Boolean).length < 3) return false;
  save.installAsked = 1;
  persist();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $("installText").textContent = installEvent ? "Add Echo to your home screen to open it in one tap, even offline."
    : ios ? "Tap the Share button in Safari, then “Add to Home Screen”. Echo will open in one tap, even offline."
    : "Open your browser's menu and choose “Add to Home screen” or “Install app”. Echo will open in one tap, even offline.";
  $("installGo").hidden = !installEvent;
  show("install");
  return true;
}

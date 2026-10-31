// Echo: menus and screens, rewards, settings, and startup.
"use strict";

// ---------- UI ----------
const screens = {
  title: $("titleScreen"), levels: $("levelScreen"), pause: $("pauseScreen"), result: $("resultScreen"),
  challenges: $("challengeScreen"), fail: $("failScreen"), story: $("storyScreen"), card: $("cardScreen"), looks: $("looksScreen"), awards: $("awardsScreen"), settings: $("settingsScreen"),
};
let backTo = "title";
function applyLayoutPrefs() {
  document.body.classList.toggle("big-text", !!save.settings.bigText);
  document.body.classList.toggle("left-hand", save.settings.hand === "left");
}
function show(name) {
  screen = name;
  $("singBtn").hidden = name !== "play" || controlMode() === "stick";
  document.body.classList.toggle("sing-on", !$("singBtn").hidden);
  for (const k in screens) screens[k].classList.toggle("on", k === name);
  $("hud").classList.toggle("on", name === "play" || name === "pause");
  if (name !== "play") { pointers.clear(); steer = null; }
  if (name !== "play" && name !== "pause") { setHint("", 0); $("levelCard").classList.remove("on"); }
  // Away from the title, keep one history entry so the phone's Back button stays in the game.
  if (name !== "title" && !backArmed) {
    try { history.pushState({ echo: 1 }, ""); backArmed = true; } catch (e) {}
  }
}

// The phone's Back button: pause a level, leave the pause menu for the map, and go from any
// other screen back to the title. Only on the title does Back leave the game.
let backArmed = false;
window.addEventListener("popstate", () => {
  backArmed = false;
  if (screen === "play") pause();
  else if (screen === "pause") (isChallenge(levelIndex) ? showTitle() : openMap());
  else if (screen === "settings" && backTo === "pause") show("pause");
  else if (screen !== "title") showTitle();
  if (screen !== "title" && !backArmed) {
    try { history.pushState({ echo: 1 }, ""); backArmed = true; } catch (e) {}
  }
});
function showTitle() {
  // The cave behind the title is the next one you'll play, in your current world's colours.
  // Lumi floats near the middle of it and sings now and then.
  loadLevel(nextUnplayed(), true);
  let best = null, bd = Infinity;
  for (let y = 1; y < L.rows - 1; y++) for (let x = 1; x < L.cols - 1; x++) {
    if (L.def.map[y][x] !== ".") continue;
    const d = Math.hypot(x - (L.cols - 1) / 2, (y - L.rows * 0.6) * 1.2);
    if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
  }
  if (best) { L.lumi.x = best[0]; L.lumi.y = best[1]; }
  L.seen.fill(1);
  renderTitle();
  show("title");
}

let hintTimer = 0;
function setHint(text, seconds) {
  const el = $("hint");
  if (text) { el.textContent = text; el.classList.add("on"); }
  else el.classList.remove("on");
  hintTimer = seconds || 0;
}
function updateHint(dt) {
  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $("hint").classList.remove("on"); }
}
// Messages show one at a time so several unlocks never pile up over the screen.
const toastQueue = [];
let toastBusy = false;
function toast(html, sound) {
  toastQueue.push([html, sound]);
  if (!toastBusy) nextToast();
}
function nextToast() {
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

const levelLabel = i => (i === DAILY ? "Daily Cave" : i === WEEKLY ? "Weekly Cave" : `Level ${i + 1}`);
function updateHud() {
  if (!L) return;
  $("lightsPill").textContent = `✦ ${L.got}/${L.lights.length}`;
  const pill = $("pingsPill");
  pill.hidden = levelIndex >= 0 && levelIndex < 10;
  if (L.songLimit) {
    const left = Math.max(0, L.songLimit - L.pings);
    pill.innerHTML = `♪ ${left} <small>left</small>`;
    pill.style.color = left <= 1 ? "#ff9fb8" : "";
  } else {
    pill.innerHTML = `♪ ${L.pings} <small>/ ${L.def.par}</small>`;
    pill.style.color = L.pings > L.def.par ? "#ff9fb8" : "";
  }
  const name = isChallenge(levelIndex) ? `<b>${levelLabel(levelIndex)}</b>` : `<b>${levelIndex + 1}.</b> ${L.def.name}`;
  if (L.timeLeft > 0 || L.failWhy === "time") {
    const t = Math.ceil(L.timeLeft);
    $("levelName").innerHTML = `<b style="color:${t <= 10 ? "#ff9fb8" : "inherit"}">⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}</b>`;
  } else $("levelName").innerHTML = name;
}
function updateMute() {
  $("muteBtn").textContent = muted ? "🔇" : "🔊";
  applyVolumes();
}

// Picture cards that explain a new idea the first time a cave uses it.
const LUMI_SVG = '<g><circle r="17" fill="url(#cardGlow)"/><circle r="9" fill="#dff8ff"/><circle cx="-3" cy="-1.5" r="1.4" fill="#123049"/><circle cx="3" cy="-1.5" r="1.4" fill="#123049"/><path d="M-2.5 2.5q2.5 2 5 0" stroke="#123049" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>';
const CARD_DEFS = '<defs><radialGradient id="cardGlow"><stop offset="0" stop-color="#7ee8ff" stop-opacity=".7"/><stop offset="1" stop-color="#7ee8ff" stop-opacity="0"/></radialGradient><radialGradient id="cardGold"><stop offset="0" stop-color="#ffd36e"/><stop offset="1" stop-color="#ffd36e" stop-opacity="0"/></radialGradient></defs>';
const CARDS = {
  energy: { title: "Light energy", text: "Lumi's glow slowly fades as you explore. Lost lights, crystals and glow-moths fill it back up.",
    art: `<g transform="translate(80 44)">${LUMI_SVG}</g><rect x="40" y="80" width="80" height="8" rx="4" fill="rgba(255,255,255,.12)"/><rect x="40" y="80" width="52" height="8" rx="4" fill="#7ee8ff"/><circle cx="132" cy="40" r="12" fill="url(#cardGold)"/><path d="M28 34l6 10-6 10-6-10z" fill="#d2b4ff"/>` },
  rescue: { title: "Lost baby moths", text: "Some caves hide a little lost moth. Find it, and it follows you. The portal only wakes up once you bring it home.",
    art: `<g transform="translate(50 60)">${LUMI_SVG}</g><g fill="#ffd1ea"><ellipse cx="80" cy="56" rx="4" ry="6" transform="rotate(-25 80 56)"/><ellipse cx="88" cy="56" rx="4" ry="6" transform="rotate(25 88 56)"/></g><path d="M100 58h22" stroke="#8ea3c8" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/><g fill="none" stroke="#b48cff" stroke-width="2.5"><circle cx="136" cy="58" r="12" stroke-dasharray="20 10"/><circle cx="136" cy="58" r="6"/></g>` },
  runes: { title: "Rune stones", text: "A stone gate blocks the way. Sing close to every rune stone, inside its dotted ring, and the gate opens for good.",
    art: `<circle cx="56" cy="56" r="34" fill="none" stroke="#96ffbe" stroke-opacity=".5" stroke-dasharray="3 6"/><circle cx="56" cy="56" r="13" fill="#283a46"/><g stroke="#96ffbe" stroke-width="2" fill="none"><circle cx="56" cy="56" r="2" fill="#96ffbe"/><path d="M49 51a8 8 0 0 0 0 10M63 51a8 8 0 0 1 0 10"/></g><g transform="translate(36 72)">${LUMI_SVG}</g><rect x="112" y="34" width="34" height="44" rx="3" fill="#3a4656"/><rect x="117" y="39" width="24" height="34" fill="none" stroke="#96ffbe" stroke-width="1.5"/>` },
  gloom: { title: "Gloomlings", text: "Shadows that drift through rock. When your song reaches one, it chases you for a while. Touching it costs light.",
    art: `<g transform="translate(44 56)">${LUMI_SVG}</g><g fill="none" stroke="#7ee8ff" stroke-opacity=".5" stroke-width="2"><path d="M66 44a16 16 0 0 1 0 24"/><path d="M74 38a24 24 0 0 1 0 36"/></g><g fill="#160c26" opacity=".95"><circle cx="118" cy="56" r="17"/><circle cx="128" cy="50" r="12"/><circle cx="108" cy="62" r="12"/></g><circle cx="112" cy="53" r="3" fill="#ff8cc8"/><circle cx="124" cy="53" r="3" fill="#ff8cc8"/>` },
  quiet: { title: "Quiet caves", text: "These caves only let you sing a few times. Watch the counter, sing where it matters, and remember the way.",
    art: `<g transform="translate(52 56)">${LUMI_SVG}</g><g fill="#e9f3ff"><path d="M98 30v34a8 6 0 1 1-4-5V34l26-6v30a8 6 0 1 1-4-5V36z"/></g><text x="128" y="92" fill="#ff9fb8" font-size="18" font-family="Fredoka, sans-serif" font-weight="600">3 left</text>` },
  dark: { title: "Dark caves", text: "Nothing glows here, not even the lights or the portal, until your song finds them. If it's too hard, turn on Guiding glow in Settings.",
    art: `<rect x="10" y="10" width="140" height="90" rx="14" fill="#03040b"/><g fill="none" stroke="#7ee8ff" stroke-width="1.5"><circle cx="80" cy="56" r="22" stroke-opacity=".5"/><circle cx="80" cy="56" r="36" stroke-opacity=".25"/></g><g transform="translate(80 56)">${LUMI_SVG}</g>` },
  tall: { title: "Big caves", text: "Some caves are bigger than your screen. The view follows Lumi, so sing often to see what's ahead.",
    art: `<rect x="56" y="8" width="48" height="94" rx="8" fill="none" stroke="#8ea3c8" stroke-width="2"/><rect x="62" y="40" width="36" height="40" rx="4" fill="rgba(126,232,255,.12)" stroke="#7ee8ff"/><g transform="translate(80 64)">${LUMI_SVG}</g><path d="M124 80V30m-8 8 8-8 8 8" stroke="#e9f3ff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
  thorns: { title: "Thornlings", text: "Spiky creatures patrol the tunnels. They hide in the dark, so sing to see them, or listen for their rattle. Touching one costs light.",
    art: `<path d="M20 60h120" stroke="#3a4656" stroke-width="22" stroke-linecap="round"/><g transform="translate(92 60)"><circle r="9" fill="#5a1d2a"/><g stroke="#ff7a6a" stroke-width="2.5" stroke-linecap="round">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${(Math.cos(k * 0.785) * 9).toFixed(1)} ${(Math.sin(k * 0.785) * 9).toFixed(1)}L${(Math.cos(k * 0.785) * 15).toFixed(1)} ${(Math.sin(k * 0.785) * 15).toFixed(1)}"/>`).join("")}</g></g><path d="M74 60h-14M110 60h14" stroke="#8ea3c8" stroke-width="2" stroke-dasharray="3 4"/><g transform="translate(36 60) scale(.8)">${LUMI_SVG}</g>` },
  mobn: { title: "Snapvines", text: "Hungry plants grow from the walls of Mossy Hollow. Swim close and one shivers, then lunges. Watch for the shiver and dart past.",
    art: `<path d="M24 20v70" stroke="#3a4656" stroke-width="16"/><path d="M32 56q20-6 40 0" stroke="#3f8f4f" stroke-width="5" fill="none"/><ellipse cx="82" cy="56" rx="16" ry="10" fill="#4caf5c"/><ellipse cx="86" cy="56" rx="9" ry="5" fill="#ff6f9a"/><g transform="translate(130 60) scale(.8)">${LUMI_SVG}</g>` },
  moba: { title: "Shardbats", text: "Crystal bats roost on the ceilings of Amethyst Deep. A song nearby wakes one, and it swoops at where it heard you. Sing, then move.",
    art: `<g transform="translate(80 40)"><path d="M-8 0L-44 -14L-30 10Z" fill="#a77bff"/><path d="M8 0L44 -14L30 10Z" fill="#a77bff"/><circle r="12" fill="#2e1f52"/><circle cx="-4" r="3.5" fill="#fff"/><circle cx="4" r="3.5" fill="#fff"/><circle cx="-4" cy="1" r="2" fill="#ff4fa0"/><circle cx="4" cy="1" r="2" fill="#ff4fa0"/></g><path d="M80 56q0 16 -30 30" stroke="#b48cff" stroke-dasharray="3 5" stroke-width="2" fill="none"/><g transform="translate(46 86) scale(.7)">${LUMI_SVG}</g>` },
  mobk: { title: "Cinder Crabs", text: "Fiery crabs scuttle along the floors of Ember Caverns, pausing at each end. Cross while they pause.",
    art: `<path d="M16 82h128" stroke="#3a2a28" stroke-width="10"/><g transform="translate(80 66)"><ellipse rx="22" ry="14" fill="#e0502c"/><circle cx="-28" cy="-8" r="8" fill="#ff6a3d"/><circle cx="28" cy="-8" r="8" fill="#ff6a3d"/><circle cx="-6" cy="-24" r="4" fill="#fff"/><circle cx="6" cy="-24" r="4" fill="#fff"/><circle cx="-6" cy="-23" r="2" fill="#1b1030"/><circle cx="6" cy="-23" r="2" fill="#1b1030"/></g><path d="M118 66h18m-6-5 6 5-6 5" stroke="#ffd36e" stroke-width="2" fill="none"/>` },
  mobw: { title: "Frostwisps", text: "Little ghosts of ice drift toward Lumi whenever they can see it. A touch costs light and leaves Lumi half frozen for a moment. Break their line of sight.",
    art: `<g transform="translate(96 54)"><circle r="26" fill="url(#cardGlow)"/><path d="M0-26C14-10 14 12 0 12S-14-10 0-26Z" fill="#bfeaff"/><path d="M-6 0h4M-4-2v4M4 0h4M6-2v4" stroke="#1d4a7a" stroke-width="1.5"/></g><g transform="translate(44 64) scale(.8)">${LUMI_SVG}</g><path d="M70 60h-8" stroke="#bfeaff" stroke-dasharray="2 3" stroke-width="2"/>` },
  mobj: { title: "Jellyglows", text: "Glowing jellies bob up and down the shafts of Coral Depths. Their sting costs light. Time your way past.",
    art: `<path d="M80 10v92" stroke="#ff9fcf" stroke-dasharray="3 6" stroke-width="2"/><g transform="translate(80 48)"><path d="M-18 0A18 18 0 0 1 18 0Q0 8 -18 0" fill="#ffb3dc"/><path d="M-10 4v18M0 6v20M10 4v18" stroke="#ffb3dc" stroke-width="2.5"/><circle cx="-5" cy="-6" r="3" fill="#fff"/><circle cx="5" cy="-6" r="3" fill="#fff"/></g><g transform="translate(36 80) scale(.7)">${LUMI_SVG}</g>` },
  long: { title: "Long songs", text: "Hold your finger still to charge a long, low song. It travels much further, but uses more of Lumi's light. Tap for a quick song as before.",
    art: `<g fill="none" stroke-linecap="round"><circle cx="80" cy="56" r="20" stroke="rgba(255,255,255,.15)" stroke-width="4"/><path d="M80 36a20 20 0 1 1-19 26" stroke="#ffe6a0" stroke-width="4"/><circle cx="80" cy="56" r="40" stroke="#7ee8ff" stroke-opacity=".35" stroke-width="2"/><circle cx="80" cy="56" r="52" stroke="#7ee8ff" stroke-opacity=".18" stroke-width="2"/></g><g transform="translate(80 56)">${LUMI_SVG}</g>` },
  echo: { title: "Echo crystals", text: "Violet crystals in the rock catch your song and sing it onward, carrying it around corners and into far tunnels.",
    art: `<path d="M20 30h70v50" fill="none" stroke="#3a4656" stroke-width="18"/><g fill="#d6beff"><path d="M98 66l6 10-6 12-6-12z"/><path d="M110 60l5 9-5 10-5-10z"/></g><g transform="translate(40 56)">${LUMI_SVG}</g><g fill="none" stroke-width="2" stroke-linecap="round"><path d="M58 50a12 12 0 0 1 0 14" stroke="#7ee8ff"/><path d="M120 70a14 14 0 0 1 10 14" stroke="#b48cff"/><path d="M124 62a22 22 0 0 1 16 24" stroke="#b48cff" stroke-opacity=".6"/></g>` },
  boss: { title: "The Great Gloom", text: "At the end of some worlds a huge, slow Gloomling waits. It hunts anything that sings nearby, and a touch costs a lot of light. Sing far from it.",
    art: `<g fill="#120a20"><circle cx="100" cy="56" r="34"/><circle cx="122" cy="40" r="22"/><circle cx="78" cy="70" r="22"/></g><circle cx="90" cy="50" r="5" fill="#ff8cc8"/><circle cx="112" cy="50" r="5" fill="#ff8cc8"/><g transform="translate(32 70) scale(.8)">${LUMI_SVG}</g>` },
  family: { title: "Lumi's family", text: "Somewhere in this world, one of Lumi's little lights is hiding. Find it and it joins Lumi's journal for good.",
    art: `<g transform="translate(64 56)">${LUMI_SVG}</g><g transform="translate(104 60) scale(.6)"><circle r="17" fill="url(#cardGlow)"/><circle r="9" fill="#ffd1ea"/><circle cx="-3" cy="-1.5" r="1.4" fill="#123049"/><circle cx="3" cy="-1.5" r="1.4" fill="#123049"/></g><path d="M80 40c6-10 18-10 22 0" stroke="#ff9fb8" stroke-width="2" fill="none"/>` },
  race: { title: "Races", text: "Reach the portal before the clock runs out. Currents can help you, and in Relaxed mode there's no timer at all.",
    art: `<circle cx="64" cy="56" r="30" fill="none" stroke="#e9f3ff" stroke-width="3"/><path d="M64 56V36M64 56l13 8" stroke="#ffd36e" stroke-width="3" stroke-linecap="round"/><rect x="57" y="20" width="14" height="6" rx="2" fill="#e9f3ff"/><g stroke="#7ee8ff" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M108 44h30m-8-6 8 6-8 6"/><path d="M108 62h22m-8-6 8 6-8 6"/></g>` },
};

// The picture card a level should show first: its own, or one for the first new thing in it.
function cardFor(i) {
  const def = getLevel(i), m = def.map.join(""), seen = save.cards || {};
  const wants = [def.card, i >= 8 && "long", def.map.join("").includes("t") && "thorns", ...[..."nakwj"].map(k => m.includes(k) && "mob" + k), m.includes("W") && "echo", m.includes("B") && "boss", m.includes("f") && "family",
    def.map[0].length > 11 && "tall"];
  return wants.find(k => k && CARDS[k] && !seen[k]) || null;
}

let pendingLevel = 0;
function startLevel(i, skip = false) {
  audio();
  const skipStory = skip === true || skip.story, skipCard = skip === true || skip.card;
  const w = worldOf(i);
  save.story = save.story || {};
  save.cards = save.cards || {};
  const card = i >= 0 && cardFor(i);
  if (!skipStory && i >= 0 && i % PER_WORLD === 0 && !save.story[w]) {
    save.story[w] = 1;
    persist();
    pendingLevel = i;
    const th = THEMES[w % THEMES.length];
    $("storyScreen").style.setProperty("--world", `rgb(${th.rim.join(",")})`);
    $("storyNum").textContent = `World ${w + 1}`;
    $("storyName").textContent = worldName(w);
    $("storyText").textContent = w === THEMES.length
      ? `Lumi's song finally reached the surface, and for the first time it saw the real stars. ${Object.keys(save.family || {}).length ? "Its little lights gathered close." : ""} But far below, the caves were still singing, and Lumi went back down to listen.`
      : (w > THEMES.length ? "The caves twist and change, but Lumi keeps singing. " : "") + STORY[w % STORY.length];
    $("storyGo").textContent = w === 0 ? "Begin" : "Continue";
    show("story");
    return;
  }
  if (!skipCard && card && CARDS[card] && !save.cards[card]) {
    save.cards[card] = 1;
    persist();
    pendingLevel = i;
    const c = CARDS[card];
    $("cardArt").innerHTML = `<svg viewBox="0 0 160 110" aria-hidden="true">${CARD_DEFS}${c.art}</svg>`;
    $("cardTitle").textContent = c.title;
    $("cardText").textContent = c.text;
    show("card");
    return;
  }
  loadLevel(i);
  energyShown = -1;
  L.fade = 1;
  show("play");
  showLevelCard(i);
}
function showLevelCard(i) {
  const card = $("levelCard"), th = themeOf(i);
  card.style.setProperty("--world", `rgb(${th.rim.join(",")})`);
  $("lcNum").textContent = isChallenge(i) ? levelLabel(i) : `Level ${i + 1}`;
  $("lcName").textContent = i === DAILY ? dayKey() : i === WEEKLY ? `Week of ${dayKey(weekNumber() * 7 - 3)}` : L.def.name;
  card.classList.remove("on");
  void card.offsetWidth;  // restart the animation
  card.classList.add("on");
}

function pause() {
  if (screen !== "play") return;
  $("pauseSub").textContent = isChallenge(levelIndex) ? levelLabel(levelIndex) : `Level ${levelIndex + 1} · ${L.def.name}`;
  $("pauseGoal").textContent = goalLine() || "Find every light, then swim into the portal";
  show("pause");
}
function resume() { audio(); show("play"); last = performance.now(); }

// ---------- Rewards ----------
const levelsDone = () => save.stars.filter(x => x > 0).length;
const perfects = () => save.stars.filter(x => x === 3).length;
function worldsDone() {
  let n = 0;
  for (let w = 0; w < WORLDS; w++) {
    let all = true;
    for (let k = 0; k < PER_WORLD; k++) if (!save.stars[w * PER_WORLD + k]) { all = false; break; }
    if (all) n++; else if (w * PER_WORLD > save.stars.length) break;
  }
  return n;
}
const ACHS = [
  { id: "first",   ico: "🎵", name: "First Song",         desc: "Finish your first cave",                     goal: 1,   val: levelsDone },
  { id: "explore", ico: "🧭", name: "Explorer",           desc: "Finish 20 levels",                           goal: 20,  val: levelsDone },
  { id: "diver",   ico: "🌊", name: "Cave Diver",         desc: "Finish 100 levels",                          goal: 100, val: levelsDone },
  { id: "world",   ico: "🗺️", name: "World Traveller",    desc: "Finish every level in a world",              goal: 1,   val: worldsDone },
  { id: "lights",  ico: "✨", name: "Light Collector",    desc: "Find 100 lost lights",                       goal: 100, val: () => save.stats.lights },
  { id: "perfect", ico: "⭐", name: "Perfect Echo",       desc: "Get 3 stars on 10 levels",                   goal: 10,  val: perfects },
  { id: "stars",   ico: "🌟", name: "Star Gazer",         desc: "Collect 100 stars",                          goal: 100, val: totalStars },
  { id: "quiet",   ico: "🤫", name: "Quiet Voice",        desc: "Finish a cave singing 2 times or fewer",     goal: 1,   val: () => save.stats.quiet },
  { id: "smooth",  ico: "🫧", name: "Smooth Swimmer",     desc: "Finish 5 caves without bumping a wall",      goal: 5,   val: () => save.stats.clean },
  { id: "moths",   ico: "🦋", name: "Moth Whisperer",     desc: "Make friends with 10 glow-moths",            goal: 10,  val: () => save.stats.moths },
  { id: "brave",   ico: "🛡️", name: "Brave Little Light", desc: "Finish 5 caves that have Gloomlings",        goal: 5,   val: () => save.stats.gloom },
  { id: "rescue",  ico: "🪽", name: "Moth Rescuer",       desc: "Bring 5 lost baby moths home",               goal: 5,   val: () => save.stats.rescues || 0 },
  { id: "runes",   ico: "🗝️", name: "Gatekeeper",         desc: "Open 5 rune gates",                          goal: 5,   val: () => save.stats.gates || 0 },
  { id: "daily",   ico: "📅", name: "Daily Habit",        desc: "Play the daily cave 3 days in a row",        goal: 3,   val: () => save.daily.best },
];
function checkRewards() {
  const news = [];
  for (const a of ACHS) {
    if (save.ach[a.id] || a.val() < a.goal) continue;
    save.ach[a.id] = Date.now();
    news.push(`🏆 Award: <b>${a.name}</b>`);
  }
  const open = SKINS.filter((k, i) => skinUnlocked(i)).length;
  let look = "";
  for (let i = save.skinsSeen; i < open; i++) { news.push(`✨ New look for Lumi: <b>${SKINS[i].name}</b>`); look = SKINS[i].name; }
  save.skinsSeen = Math.max(save.skinsSeen, open);
  persist();
  if (news.length) setTimeout(() => news.forEach(h => toast(h, true)), 900);
  return look;
}

function finish() {
  const allLights = L.got === L.lights.length;
  const underPar = L.pings <= L.def.par;
  const stars = 1 + (allLights ? 1 : 0) + (underPar ? 1 : 0);
  const st = save.stats;
  st.lights += L.got;
  st.moths += L.mothsMet || 0;
  st.songs += L.pings;
  if (L.bumps === 0 && levelIndex !== 0) st.clean++;
  if (L.pings <= 2 && levelIndex >= 1) st.quiet++;
  if (L.gloom.length) st.gloom++;
  if (L.goal === "rescue") st.rescues = (st.rescues || 0) + 1;
  if (L.gate && L.gate.open) st.gates = (st.gates || 0) + 1;
  // Remember what's been met, for the journal.
  save.found = save.found || {};
  const flat = L.def.map.join("");
  for (const [k, ch] of Object.entries(FIND)) if (ch.some(c => flat.includes(c))) save.found[k] = 1;

  let newBest = "", streakMsg = "", hadBest = false;
  if (levelIndex === WEEKLY) {
    save.weekly = save.weekly || {};
    const wk = weekNumber(), prev = save.weekly[wk] || 0;
    save.weekly[wk] = Math.max(prev, stars);
    streakMsg = prev ? `Best this week: ${"★".repeat(save.weekly[wk])}` : "This week's cave, cleared!";
  } else if (levelIndex === DAILY) {
    const d = save.daily, today = dayKey(), yesterday = dayKey(dayNumber() - 1);
    if (d.last !== today) {
      d.streak = d.last === yesterday ? d.streak + 1 : 1;
      d.last = today;
      d.best = Math.max(d.best, d.streak);
    }
    d.stars[today] = Math.max(d.stars[today] || 0, stars);
    streakMsg = `Daily streak: ${d.streak} day${d.streak === 1 ? "" : "s"}`;
  } else {
    save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
    const best = save.best[levelIndex];
    hadBest = !!best;
    if (!best || L.pings < best.pings || (L.pings === best.pings && L.time < best.time)) {
      if (best) newBest = "New personal best!";
      save.best[levelIndex] = { pings: L.pings, time: Math.round(L.time * 10) / 10 };
    }
  }
  persist();
  const look = checkRewards();

  const t = L.time, mm = Math.floor(t / 60), ss = Math.floor(t % 60);
  $("resultTitle").textContent = ["", "Cave cleared!", "Lovely singing!", "Perfect echo!"][stars];
  $("resultSub").textContent = `${levelLabel(levelIndex)} · ${L.def.name} · ${mm}:${String(ss).padStart(2, "0")}`;
  $("newBest").textContent = streakMsg || newBest;
  const worldDone = levelIndex >= 0 && isFinale(levelIndex);
  $("unlockMsg").textContent = [worldDone ? `World ${worldOf(levelIndex) + 1} complete! A new cave opens ahead` : "", look ? `New look unlocked: ${look}` : ""].filter(Boolean).join(" · ");
  $("g1v").textContent = "✓";
  $("g2v").textContent = `${L.got}/${L.lights.length}`;
  $("g3v").textContent = `${L.pings} / ${L.def.par}`;
  $("goal1").firstElementChild.textContent = L.goal === "rescue" ? "Bring the lost moth home" : L.goal === "race" ? "Beat the clock" : "Reach the portal";
  $("goal3").firstElementChild.textContent = `Sing ${L.def.par} times or fewer`;
  $("goal1").className = "ok";
  $("goal2").className = allLights ? "ok" : "";
  $("goal3").className = underPar ? "ok" : "";
  $("nextBtn").textContent = isChallenge(levelIndex) ? "Done" : levelIndex === TOTAL - 1 ? "Level map" : "Next level";
  const best = levelIndex >= 0 && save.best[levelIndex];
  if (best && hadBest && !newBest && !streakMsg) $("newBest").textContent = `Best: ${best.pings} songs · ${Math.floor(best.time / 60)}:${String(Math.floor(best.time % 60)).padStart(2, "0")}`;
  const spans = $("resultStars").children;
  for (let k = 0; k < 3; k++) spans[k].className = "";
  show("result");
  drawResultMap();
  for (let k = 0; k < 3; k++) {
    setTimeout(() => {
      spans[k].className = "show" + (k < stars ? " got" : "");
      if (k < stars) sfx.star(k);
    }, 250 + k * 280);
  }
}
function failLevel() {
  $("failTitle").textContent = L.failWhy === "time" ? "Out of time" : "Lumi's light faded";
  $("failSub").textContent = L.failWhy === "time"
    ? "The cave closed before Lumi reached the portal. Sing early to plan your route."
    : L.hits
    ? "Gloomlings took some of Lumi's light. Sing less near them, or swim away fast."
    : "Lost lights, crystals and glow-moths all help Lumi stay bright.";
  show("fail");
}

// ---------- Level map ----------
let mapWorld = 0;
function renderLevels(world) {
  if (world != null) mapWorld = Math.max(0, Math.min(WORLDS - 1, world));
  const th = THEMES[mapWorld % THEMES.length];
  $("levelScreen").style.setProperty("--world", `rgb(${th.rim.join(",")})`);
  $("worldNum").textContent = `World ${mapWorld + 1} of ${WORLDS}`;
  $("worldName").textContent = worldName(mapWorld);
  $("worldPrev").disabled = mapWorld === 0;
  $("worldNext").disabled = mapWorld === WORLDS - 1;
  const grid = $("levelGrid");
  grid.innerHTML = "";
  const cur = nextUnplayed();
  // Levels wind upward from the bottom, snaking left and right like a trail.
  for (let k = 0; k < PER_WORLD; k++) {
    const i = mapWorld * PER_WORLD + k, row = Math.floor(k / 4), col = k % 4;
    const b = document.createElement("button");
    const open = unlocked(i), st = save.stars[i] || 0;
    b.className = "node" + (open ? "" : " locked") + (i === cur && !st ? " current" : "");
    b.style.gridRow = String(5 - row);
    b.style.gridColumn = String(row % 2 ? 4 - col : col + 1);
    b.innerHTML = open ? `${i + 1}<span class="st">${"<i>★</i>".repeat(st)}${"★".repeat(3 - st)}</span>` : `<span class="lock">🔒</span>`;
    b.setAttribute("aria-label", `Level ${i + 1}${open ? `, ${st} stars` : ", locked"}`);
    b.addEventListener("click", () => { if (open) startLevel(i); else note(220, { dur: 0.2, vol: 0.08 }); });
    grid.appendChild(b);
  }
  $("levelsTotal").textContent = `★ ${totalStars()} stars collected`;
  requestAnimationFrame(drawMapPath);
}
function drawMapPath() {
  const svg = $("mapPath"), box = $("levelMap").getBoundingClientRect();
  const pts = [...$("levelGrid").children]
    .map(n => ({ k: [...n.parentNode.children].indexOf(n), r: n.getBoundingClientRect() }))
    .sort((a, b) => a.k - b.k)
    .map(({ r }) => [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]);
  if (!pts.length) return;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    d += y0 === y1 ? ` L${x1},${y1}` : ` C${x0 + (x0 > box.width / 2 ? 40 : -40)},${y0} ${x1 + (x1 > box.width / 2 ? 40 : -40)},${y1} ${x1},${y1}`;
  }
  svg.innerHTML = `<path d="${d}" fill="none" stroke="var(--world)" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>`;
}
const openMap = () => {
  renderLevels(worldOf(screen === "title" || levelIndex < 0 ? nextUnplayed() : levelIndex));
  show("levels");
  requestAnimationFrame(drawMapPath);
};
function nextUnplayed() {
  for (let i = 0; i < TOTAL; i++) if (!save.stars[i]) return unlocked(i) ? i : Math.max(0, i - 1);
  return TOTAL - 1;
}

// ---------- Title, looks, awards, settings ----------
function renderTitle() {
  const t = totalStars(), next = nextUnplayed(), started = save.stars.some(x => x);
  $("starCount").textContent = t;
  $("playLabel").textContent = started ? "Continue" : "Play";
  $("playSub").textContent = `Level ${next + 1} · ${getLevel(next).name}`;
  const doneToday = save.daily.last === dayKey();
  $("dailyDot").hidden = doneToday;
  $("looksDot").hidden = SKINS.filter((k, i) => skinUnlocked(i)).length <= (save.looksViewed || 1);
  $("titleMeta").textContent = save.daily.streak && (doneToday || save.daily.last === dayKey(dayNumber() - 1))
    ? `Daily streak · ${save.daily.streak} day${save.daily.streak === 1 ? "" : "s"}` : "";
}
function renderChallenges() {
  const d = save.daily, today = save.daily.last === dayKey(), wk = (save.weekly || {})[weekNumber()] || 0;
  const daysLeft = 7 - ((dayNumber() + 3) % 7);
  $("dailyInfo").textContent = today ? `Done today · ${d.streak} day streak` : d.streak && d.last === dayKey(dayNumber() - 1) ? `Keep your ${d.streak} day streak going` : "A new cave every day";
  $("weeklyInfo").textContent = (wk ? `Best: ${"★".repeat(wk)} · ` : "Harder, with more to find · ") + `new cave in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

function renderLooks() {
  const grid = $("looksGrid");
  grid.innerHTML = "";
  SKINS.forEach((k, i) => {
    const open = skinUnlocked(i), b = document.createElement("button");
    b.className = "look" + (save.skin === i ? " on" : "") + (open ? "" : " locked");
    const ball = document.createElement("span");
    ball.className = "ball";
    if (k.body) {
      ball.style.background = `radial-gradient(circle at 38% 34%, ${k.body[0]}, ${k.body[1]} 55%, ${k.body[2]})`;
      ball.style.setProperty("--glow", `rgba(${k.c.join(",")},0.7)`);
    } else {
      ball.style.background = "conic-gradient(from 30deg, #ff7aa0, #ffc86e, #96ffa0, #6edcff, #aa8cff, #ff8ce6, #ff7aa0)";
      ball.style.setProperty("--glow", "rgba(255,255,255,0.6)");
    }
    b.appendChild(ball);
    b.appendChild(document.createTextNode(open ? k.name : `★ ${k.need}`));
    b.setAttribute("aria-label", open ? `${k.name}${save.skin === i ? ", wearing" : ""}` : `${k.name}, needs ${k.need} stars`);
    b.addEventListener("click", () => {
      if (!open) { toast(`Collect <b>${k.need - totalStars()}</b> more stars to unlock ${k.name}`); return; }
      save.skin = i;
      persist();
      sfx.moth();
      renderLooks();
    });
    grid.appendChild(b);
  });
}
// What the journal lists, and which map letters mean you've met it.
const FIND = { crystals: ["c"], curtains: ["D"], currents: [">", "<", "^", "v"], moths: ["b"], snoozles: ["z"], runes: ["r"],
  echo: ["W"], babies: ["m"], gloom: ["g"], boss: ["B"], thorns: ["t"], snapvines: ["n"], bats: ["a"], crabs: ["k"], wisps: ["w"], jellies: ["j"] };
const JOURNAL = [
  ["crystals", "💎", "Crystals", "Keep glowing once your song touches them, and refill Lumi's light."],
  ["curtains", "🎐", "Sound curtains", "Part for a few seconds when a song reaches them."],
  ["currents", "🌊", "Currents", "Underground rivers that carry Lumi along."],
  ["moths", "🦋", "Glow-moths", "Follow Lumi and make its light bigger."],
  ["snoozles", "😴", "Snoozles", "Sleepy blobs. Their snores light up the walls nearby."],
  ["runes", "🪨", "Rune stones", "Open stone gates when they hear a song from close by."],
  ["echo", "🔮", "Echo crystals", "Catch a song and sing it onward around corners."],
  ["babies", "🪽", "Baby moths", "Lost little moths that need help finding the portal."],
  ["thorns", "🌰", "Thornlings", "Spiky patrollers that hide in the dark and rattle when near."],
  ["snapvines", "🌿", "Snapvines", "Wall plants that shiver, then lunge at anything close."],
  ["bats", "🦇", "Shardbats", "Crystal bats that swoop at songs they hear."],
  ["crabs", "🦀", "Cinder Crabs", "Fiery crabs that dash along floors and pause at the ends."],
  ["wisps", "❄️", "Frostwisps", "Ice ghosts that drift toward Lumi and freeze it on touch."],
  ["jellies", "🪼", "Jellyglows", "Glowing jellies that bob through shafts and sting."],
  ["gloom", "👀", "Gloomlings", "Shadows that drift through rock and chase songs."],
  ["boss", "🌑", "The Great Gloom", "A huge, slow shadow that guards the end of some worlds."],
];
function renderJournal() {
  const fam = save.family || {}, got = Object.keys(fam).length;
  let html = `<h3 class="journal-h">Lumi's family</h3><div class="family">`;
  for (let w = 0; w < 8; w++) html += `<span class="${fam[w] ? "got" : ""}" title="World ${w + 1}"></span>`;
  html += `</div><p class="journal-note">${got} of ${WORLDS} little lights found. One hides in every world, often off the main path.</p><h3 class="journal-h">Discoveries</h3><ul class="awards">`;
  for (const [k, ico, name, desc] of JOURNAL) {
    const seen = save.found && save.found[k];
    html += `<li class="award${seen ? " done" : ""}"><span class="ico">${seen ? ico : "❔"}</span><span><span class="nm">${seen ? name : "Not found yet"}</span><br><span class="ds">${seen ? desc : "Keep exploring"}</span></span></li>`;
  }
  $("journal").innerHTML = html + "</ul>";
}
function awardsTab(journal) {
  $("tabAwards").setAttribute("aria-selected", String(!journal));
  $("tabJournal").setAttribute("aria-selected", String(journal));
  $("awardsList").hidden = journal;
  $("journal").hidden = !journal;
  $("awardsCount").hidden = journal;
  if (journal) renderJournal();
}
function renderHats() {
  const grid = $("hatsGrid");
  grid.innerHTML = "";
  HATS.forEach((h, k) => {
    const open = hatUnlocked(k), b = document.createElement("button");
    b.className = "look" + ((save.hat || 0) === k ? " on" : "") + (open ? "" : " locked");
    const c = document.createElement("canvas");
    c.width = c.height = 92; c.style.width = c.style.height = "46px";
    const cx = c.getContext("2d");
    cx.translate(46, 54); cx.scale(2, 2);
    cx.fillStyle = "#c9f6ff"; cx.beginPath(); cx.arc(0, 0, 12, 0, Math.PI * 2); cx.fill();
    if (open) drawHat(k, 12, cx);
    b.appendChild(c);
    b.appendChild(document.createTextNode(open ? h.name : `🏆 ${h.need}`));
    b.addEventListener("click", () => {
      if (!open) { toast(`Earn <b>${h.need - awardsEarned()}</b> more awards to unlock the ${h.name.toLowerCase()}`); return; }
      save.hat = k; persist(); sfx.moth(); renderHats();
    });
    grid.appendChild(b);
  });
}

function renderAwards() {
  const list = $("awardsList");
  list.innerHTML = "";
  let got = 0;
  for (const a of ACHS) {
    const done = !!save.ach[a.id], v = Math.min(a.goal, a.val());
    if (done) got++;
    const li = document.createElement("li");
    li.className = "award" + (done ? " done" : "");
    li.innerHTML = `<span class="ico">${a.ico}</span><span><span class="nm"></span><br><span class="ds"></span></span>` +
      (a.goal > 1 && !done ? `<span class="bar"><i style="width:${(v / a.goal) * 100}%"></i></span>` : "");
    li.querySelector(".nm").textContent = a.name + (a.goal > 1 && !done ? `  ${v}/${a.goal}` : done ? "  ✓" : "");
    li.querySelector(".ds").textContent = a.desc;
    list.appendChild(li);
  }
  $("awardsCount").textContent = `${got} of ${ACHS.length} earned`;
}
function renderSettings() {
  const st = save.settings;
  $("setMusic").value = st.music;
  $("setSfx").value = st.sfx;
  $("setVibrate").setAttribute("aria-pressed", String(!!st.vibrate));
  $("setContrast").setAttribute("aria-pressed", String(!!st.contrast));
  $("setLighting").setAttribute("aria-pressed", String(st.lighting !== false));
  $("setRelaxed").setAttribute("aria-pressed", String(!!st.relaxed));
  $("setGlow").setAttribute("aria-pressed", String(!!st.glow));
  $("setBigText").setAttribute("aria-pressed", String(!!st.bigText));
  [...$("setControls").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === controlMode())));
  [...$("setHand").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === (st.hand || "right"))));
  $("handRow").hidden = controlMode() === "stick";
  applyLayoutPrefs();
  $("setUnlockAll").setAttribute("aria-pressed", String(!!st.unlockAll));
  $("testRow").hidden = !st.unlockAll && !testTaps.shown;
  $("saveCode").value = "";
  [...$("setStick").children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === st.stick)));
  $("setReset").textContent = "Erase all progress";
  resetArmed = false;
}
let resetArmed = false;
const testTaps = { n: 0, t: 0, shown: false };
const saveCode = () => "ECHO1:" + btoa(unescape(encodeURIComponent(JSON.stringify(save))));

async function shareMap() {
  const c = $("resultMap");
  try {
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const file = new File([blob], "echo-cave-map.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Echo", text: `${levelLabel(levelIndex)} · ${L.def.name} in Echo` });
      return;
    }
    toast("Press and hold the map to save or share it");
  } catch (e) {
    if (e && e.name === "AbortError") return;
    toast("Sharing pictures isn't available here");
  }
}

async function shareGame() {
  const url = "https://erlan1126.github.io/Test/echo.html";
  const t = totalStars();
  const text = t ? `I've collected ${t} stars in Echo, a game about finding your way through dark caves with sound. Can you beat me?` : "Echo: find your way through dark caves using only sound.";
  try {
    if (navigator.share) { await navigator.share({ title: "Echo", text, url }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Link copied. Paste it to a friend!");
  } catch (e) {
    toast(`Share this link: <b>${url}</b>`);
  }
}

const tap = (id, fn) => $(id).addEventListener("click", e => { e.stopPropagation(); audio(); fn(e); });
tap("playBtn", () => startLevel(nextUnplayed()));
tap("levelsBtn", openMap);
tap("dailyBtn", () => { renderChallenges(); show("challenges"); });
tap("playDaily", () => startLevel(DAILY));
tap("playWeekly", () => startLevel(WEEKLY));
tap("challengesBack", showTitle);
tap("tabAwards", () => awardsTab(false));
tap("tabJournal", () => awardsTab(true));
tap("shareMapBtn", shareMap);
tap("looksBtn", () => { save.looksViewed = SKINS.filter((k, i) => skinUnlocked(i)).length; persist(); renderLooks(); renderHats(); show("looks"); });
tap("awardsBtn", () => { renderAwards(); awardsTab(false); show("awards"); });
tap("settingsBtn", () => { backTo = "title"; renderSettings(); show("settings"); });
tap("pauseSettings", () => { backTo = "pause"; renderSettings(); show("settings"); });
tap("shareBtn", shareGame);
tap("looksBack", showTitle);
tap("awardsBack", showTitle);
tap("settingsBack", () => (backTo === "pause" ? show("pause") : showTitle()));
tap("worldPrev", () => renderLevels(mapWorld - 1));
tap("worldNext", () => renderLevels(mapWorld + 1));
tap("levelsBack", showTitle);
tap("pauseBtn", pause);
tap("muteBtn", () => { muted = !muted; save.muted = muted; persist(); updateMute(); });
tap("resumeBtn", resume);
tap("restartBtn", () => startLevel(levelIndex));
tap("quitBtn", () => (isChallenge(levelIndex) ? showTitle() : openMap()));
tap("retryBtn", () => startLevel(levelIndex));
tap("resultLevels", openMap);
tap("failRetry", () => startLevel(levelIndex));
tap("storyGo", () => startLevel(pendingLevel, { story: true }));
tap("cardGo", () => startLevel(pendingLevel, { story: true, card: true }));
tap("failMap", () => (isChallenge(levelIndex) ? showTitle() : openMap()));
tap("nextBtn", () => {
  if (isChallenge(levelIndex)) showTitle();
  else if (levelIndex < TOTAL - 1) startLevel(levelIndex + 1);
  else openMap();
});
$("setMusic").addEventListener("input", e => { save.settings.music = +e.target.value; applyVolumes(); persist(); });
$("setSfx").addEventListener("input", e => { save.settings.sfx = +e.target.value; applyVolumes(); persist(); });
$("setSfx").addEventListener("change", () => sfx.light());
tap("setVibrate", () => { save.settings.vibrate = !save.settings.vibrate; persist(); renderSettings(); buzz(20); });
tap("setLighting", () => { save.settings.lighting = save.settings.lighting === false; persist(); renderSettings(); });
tap("setContrast", () => { save.settings.contrast = !save.settings.contrast; persist(); renderSettings(); });
tap("setRelaxed", () => { save.settings.relaxed = !save.settings.relaxed; persist(); renderSettings(); toast(save.settings.relaxed ? "Relaxed mode on. It starts with your next cave" : "Relaxed mode off"); });
[...$("setControls").children].forEach(b => b.addEventListener("click", () => { save.settings.controls = b.dataset.v; persist(); renderSettings(); }));
[...$("setHand").children].forEach(b => b.addEventListener("click", () => { save.settings.hand = b.dataset.v; persist(); renderSettings(); }));
tap("setBigText", () => { save.settings.bigText = !save.settings.bigText; persist(); renderSettings(); });
tap("setGlow", () => { save.settings.glow = !save.settings.glow; persist(); renderSettings(); });
tap("setUnlockAll", () => { save.settings.unlockAll = !save.settings.unlockAll; persist(); renderSettings(); });
// Tapping the Settings title five times shows the testing switch.
tap("settingsTitle", () => {
  const now = performance.now();
  testTaps.n = now - testTaps.t < 600 ? testTaps.n + 1 : 1;
  testTaps.t = now;
  if (testTaps.n >= 5 && !testTaps.shown) { testTaps.shown = true; renderSettings(); toast("Testing options shown"); }
});
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
    for (const k of ["stars", "best", "muted", "skin", "skinsSeen", "looksViewed", "ach", "story", "cards"]) if (data[k] != null) save[k] = data[k];
    persist();
    STICK_R = STICK_SIZES[save.settings.stick] || 46;
    muted = !!save.muted;
    updateMute();
    renderSettings();
    toast(`Progress restored: <b>★ ${totalStars()}</b>`);
  } catch (e) {
    toast("That code didn't work. Paste the whole code, starting with ECHO1:");
  }
});
[...$("setStick").children].forEach(b => b.addEventListener("click", () => {
  save.settings.stick = +b.dataset.v;
  STICK_R = STICK_SIZES[save.settings.stick];
  persist();
  renderSettings();
}));
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
  persist();
  toast("Progress erased");
  renderSettings();
});
["pauseBtn", "muteBtn"].forEach(id => $(id).addEventListener("pointerdown", e => e.stopPropagation()));

document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
// Releasing keys or fingers outside the page shouldn't leave Lumi swimming on its own.
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; pointers.clear(); steer = null; });
let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); if (screen === "levels") drawMapPath(); }, 120); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

window.__echo = { LEVELS, TOTAL, DAILY, WEEKLY, getLevel, get L() { return L; }, get screen() { return screen; }, save, startLevel, ping, finish };

resize();
applyLayoutPrefs();
updateMute();
showTitle();
requestAnimationFrame(frame);

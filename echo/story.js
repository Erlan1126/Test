// Echo: the story. A chapter opens each of the first eight worlds, told in a few illustrated
// pages and read aloud (Narration in Settings). Each world's family member remembers one line
// of an old lullaby; at the bottom of the Starlight Abyss, Lumi sings it to the Great Hush.
"use strict";

// The last level of World 8, where Lumi sings to the Great Hush.
const STORY_FINALE = PER_WORLD * 8 - 1;

const LULLABY = [
  "Hush now, little light, the dark is only deep,",
  "the stones are humming softly, the moss has gone to sleep.",
  "The crystals ring a lantern-song, the embers keep you warm,",
  "the frost will hold your echo safe through every winter storm.",
  "The sea will rock you gently, the old mines know your name,",
  "and if you sing into the dark, I'll always sing the same.",
  "So follow every echo home, however far you roam:",
  "somebody's always listening. Somebody calls you home.",
];
const versesFound = () => LULLABY.map((l, w) => !!(save.family || {})[w]);

// Each page: text, plus what the picture shows.
const CHAPTERS = [
  { title: "The Last Song", pages: [
    { text: "Long ago, the caves under the world were full of song. Every light that lived there had a voice, and every voice had an echo.", crowd: 1, notes: 1 },
    { text: "But one voice was always alone. It sang and sang, and nobody ever sang back. Slowly it grew quiet. And then it grew hungry.", hush: "far", notes: 1 },
    { text: "It became the Hush. It swallowed every song in the deep, and all the little lights went dark and fell asleep.", hush: "big", sleepers: 1 },
    { text: "All but one. A tiny light called Lumi woke up alone in the dark. Far above, the sky was waiting.", lumi: 1 },
    { text: "Sing, little light. Your song will show the way. But be careful. The Hushlings are listening.", lumi: 1, hushlings: 1 },
  ] },
  { title: "The Humming Moss", pages: [
    { text: "The moss hums back whenever Lumi sings. The caves aren't empty after all. They're only sleeping.", lumi: 1, notes: 1 },
    { text: "Somewhere in every world, one of Lumi's family is hiding. Each of them remembers a single line of an old lullaby, older than the caves.", lumi: 1, family: 2 },
    { text: "Nobody knows who wrote it. But when Lumi hums it, the Hushlings stop, just for a moment, as if they're listening.", lumi: 1, hushlings: 1, notes: 1 },
  ] },
  { title: "Bells in the Stone", pages: [
    { text: "Purple crystals ring like little bells. Inside them Lumi sees pictures from long ago: a lonely voice, singing to no one.", crystals: 1, hush: "ghost" },
    { text: "The lullaby is getting clearer. It doesn't sound like a song for falling asleep. It sounds like a song for someone to come home.", lumi: 1, family: 3, notes: 1 },
  ] },
  { title: "The Shadow King", pages: [
    { text: "Warm air rises through the glowing cracks. And here, for the first time, Lumi sees the Great Hush: enormous, silent, crowned in shadow.", hush: "big", lumi: 1 },
    { text: "It doesn't roar. It only looks at Lumi, and its eyes are terribly sad. Then the dark closes in, and Lumi runs.", hush: "big", lumi: 1, hushlings: 1 },
  ] },
  { title: "The Far Voice", pages: [
    { text: "Everything is cold and still. Each song echoes for a long, long time.", lumi: 1, frost: 1 },
    { text: "And in the echoes, very far away, Lumi hears another voice humming along to the lullaby. Someone else knows it.", lumi: 1, notes: 1, hush: "far" },
  ] },
  { title: "The First Singer", pages: [
    { text: "An old underground sea. Tiny glowing creatures drift in the water, and they tell Lumi a secret.", lumi: 1, sea: 1 },
    { text: "The Hush wasn't born in the dark. It was the very first singer of all. It wrote the lullaby, for anyone who would listen.", hush: "ghost", notes: 1 },
    { text: "But nobody ever came.", hush: "far" },
  ] },
  { title: "Is Anyone There?", pages: [
    { text: "Someone lived in these mines long ago. On the walls, Lumi finds the lullaby, carved in small careful letters, over and over and over.", lumi: 1, carving: 1 },
    { text: "At the very bottom, scratched deep into the stone: “Is anyone there?”", carving: 1 },
  ] },
  { title: "The Answer", pages: [
    { text: "The deepest place of all, where the Great Hush waits. Far above, Lumi can almost hear the stars.", lumi: 1, hush: "far", stars: 1 },
    { text: "Lumi's family gather close. They're scared, and so is Lumi. But now Lumi knows what the Hush needs. Not a fight. An answer.", lumi: 1, family: 5 },
  ] },
];

function endingPages() {
  const all = versesFound().every(Boolean);
  return [
    { text: all ? "Lumi swam right up to the Great Hush, closer than anyone had ever dared, and sang the lullaby. Every single line."
      : "Lumi swam right up to the Great Hush, closer than anyone had ever dared, and sang the lullaby: the lines it knew, and hummed the rest.", lumi: 1, hush: "big", notes: 1 },
    { text: "The Hush went very still. Then, softly, from somewhere deep inside the dark, it sang back.", hush: "big", notes: 1 },
    { text: "It remembered. It had written this song long ago, for whoever would come. And at last, someone had.", hush: "healing", lumi: 1 },
    { text: "The shadow cracked like an eggshell, and light poured out: a great, gentle light, the oldest voice in the deep. The Hushlings turned into fireflies and floated home.", hush: "healed", fireflies: 1 },
    { text: "All through the caves, the songs woke up. And Lumi, with its whole family and one very big new friend, rose up, and up, and up, and for the first time, saw the stars.", hush: "healed", lumi: 1, family: 5, stars: 1 },
    { text: "The End. But the caves are deep, and a few lost echoes of the Hush still wander down there. Lumi is going back to help them find their songs.", lumi: 1, stars: 1, hushlings: 1 },
  ];
}
const AFTER = [
  { text: "Lumi's family live in the light now, and the great old singer hums them to sleep each night.", hush: "healed", family: 5, stars: 1 },
  { text: "But deep below, lost Hushlings still wander, remembering only silence. Lumi dives back down, singing, to bring them home.", lumi: 1, hushlings: 1 },
];

// ---------- Pictures ----------
function storyArt(p, w) {
  const th = THEMES[w % THEMES.length], rgb = c => `rgb(${c.join(",")})`, lift = (c, k) => c.map(v => Math.min(255, Math.round(v * k)));
  const r = seeded(w * 131 + (p.text || "").length);
  let s = `<svg viewBox="0 0 300 170" aria-hidden="true">${CARD_DEFS}<defs><radialGradient id="sbg" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="${rgb(lift(th.floor2, 1.7))}"/><stop offset="1" stop-color="${rgb(th.deep)}"/></radialGradient>
    <radialGradient id="warm"><stop offset="0" stop-color="#fff6d8"/><stop offset=".4" stop-color="#ffd36e" stop-opacity=".7"/><stop offset="1" stop-color="#ffd36e" stop-opacity="0"/></radialGradient></defs>
    <rect width="300" height="170" fill="url(#sbg)"/>`;
  if (p.stars) {
    s += `<rect width="300" height="60" fill="#0b1030" opacity=".6"/>`;
    for (let k = 0; k < 26; k++) s += `<circle cx="${r() * 300}" cy="${r() * 55}" r="${0.5 + r()}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`;
  }
  // Rock above and below.
  s += `<path d="M0 0h300v${p.stars ? 8 : 34}q-40 ${p.stars ? 10 : 18}-80 6q-40 18-80 0q-40 16-70 2q-40 18-70-2z" fill="${rgb(th.deep)}"/>
    <path d="M0 170v-28q50-14 90-4q40-12 70 0q50-14 80-2q30-6 60 4v30z" fill="${rgb(th.deep)}"/>
    <path d="M0 142q50-14 90-4q40-12 70 0q50-14 80-2q30-6 60 4" stroke="${rgb(th.rim)}" stroke-opacity=".35" fill="none"/>`;
  if (p.crystals) for (const [x, h] of [[40, 26], [58, 18], [250, 30], [268, 20]]) s += `<path d="M${x} 140l-6-${h} 6-8 6 8z" fill="#b48cff" opacity=".85"/><path d="M${x} 140l6-${h}-6-8z" fill="#6a46b8"/>`;
  if (p.frost) for (let k = 0; k < 9; k++) { const x = 20 + k * 32; s += `<path d="M${x} ${30 + (k % 2) * 6}l4 ${14 + (k % 3) * 6}l4-${14 + (k % 3) * 6}z" fill="#d8ecff" opacity=".7"/>`; }
  if (p.sea) s += `<path d="M0 110q40-8 75 0t75 0t75 0t75 0v40H0z" fill="#3fb6c8" opacity=".18"/>` + [...Array(8)].map(() => `<circle cx="${r() * 300}" cy="${95 + r() * 40}" r="${1 + r() * 2}" fill="#9ffff0" opacity=".8"/>`).join("");
  if (p.carving) for (let k = 0; k < 5; k++) s += `<path d="M${30 + k * 6} ${50 + k * 16}h${120 + r() * 60}" stroke="#ffe6a0" stroke-opacity=".35" stroke-dasharray="${2 + r() * 4} 3"/>`;
  if (p.carving && !p.lumi) s += `<text x="150" y="150" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="14" fill="#ffe6a0" opacity=".85">Is anyone there?</text>`;
  const face = (x, y, rad, col, happy = true) => `<g transform="translate(${x} ${y})"><circle r="${rad * 2.2}" fill="${col}" opacity=".18"/><circle r="${rad}" fill="${col}"/><circle cx="${-rad * 0.33}" cy="${-rad * 0.15}" r="${rad * 0.15}" fill="#123049"/><circle cx="${rad * 0.33}" cy="${-rad * 0.15}" r="${rad * 0.15}" fill="#123049"/>${happy ? `<path d="M${-rad * 0.28} ${rad * 0.28}q${rad * 0.28} ${rad * 0.22} ${rad * 0.56} 0" stroke="#123049" stroke-width="${rad * 0.12}" fill="none" stroke-linecap="round"/>` : ""}</g>`;
  const famCol = k => rgb(lift(THEMES[k % THEMES.length].rim, 1.15));
  if (p.crowd) for (let k = 0; k < 9; k++) s += face(30 + k * 30, 120 - (k % 3) * 18, 7, famCol(k));
  if (p.sleepers) for (let k = 0; k < 7; k++) s += `<circle cx="${40 + k * 36}" cy="${132 - (k % 2) * 8}" r="6" fill="#5a6488" opacity=".5"/>`;
  const hushAt = (x, y, k, op, eye) => `<g transform="translate(${x} ${y}) scale(${k})" opacity="${op}"><path d="M-14 6Q-18 22-8 30Q-4 20 0 30Q4 20 8 30Q18 22 14 6z" fill="#140a22" opacity=".7"/><path d="M-16 6C-17-6-12-13-9-14L-12-23L-4-16Q0-17 4-16L12-23L9-14C12-13 17-6 16 6Q0 13-16 6z" fill="#160c26" stroke="#6a4a9a" stroke-width=".5"/><path d="M-9-29l3-9 3 9zM-2-31l3-11 3 11zM5-29l3-9 3 9z" fill="#0c0616"/><ellipse cx="-6" cy="-4" rx="3.4" ry="1.6" fill="${eye}"/><ellipse cx="6" cy="-4" rx="3.4" ry="1.6" fill="${eye}"/><path d="M-9-7l5 1M9-7l-5 1" stroke="${eye}" stroke-width=".8" opacity=".6"/></g>`;
  if (p.hush === "far") s += hushAt(240, 92, 1.1, 0.75, "#c9a8ff");
  if (p.hush === "ghost") s += hushAt(205, 85, 2.2, 0.35, "#e8f4ff");
  if (p.hush === "big") s += hushAt(205, 82, 2.6, 1, "#c9a8ff");
  if (p.hush === "healing") s += `<circle cx="205" cy="80" r="70" fill="url(#warm)" opacity=".7"/>` + hushAt(205, 82, 2.6, 0.6, "#ffe6a0");
  if (p.hush === "healed") s += `<circle cx="205" cy="78" r="80" fill="url(#warm)"/>` + face(205, 80, 24, "#fff1c8");
  if (p.hushlings) for (const [x, y] of [[262, 60], [30, 70], [280, 118]]) s += `<g opacity=".8"><ellipse cx="${x - 4}" cy="${y}" rx="2.6" ry="1.4" fill="#ff9ad0"/><ellipse cx="${x + 4}" cy="${y}" rx="2.6" ry="1.4" fill="#ff9ad0"/></g>`;
  if (p.fireflies) for (let k = 0; k < 18; k++) s += `<circle cx="${r() * 300}" cy="${20 + r() * 120}" r="${1 + r() * 1.5}" fill="#fff1a8" opacity="${0.5 + r() * 0.5}"/>`;
  if (p.family) for (let k = 0; k < p.family; k++) s += face(p.hush ? 50 + k * 22 : 160 + (k - (p.family - 1) / 2) * 28, 118 + (k % 2) * 8, 6, famCol(k));
  if (p.lumi) s += `<g transform="translate(${p.hush || p.carving ? 95 : 150} ${p.family && !p.hush ? 84 : 96}) scale(1.6)">${LUMI_SVG}</g>`;
  if (p.notes) for (let k = 0; k < 5; k++) { const x = 70 + r() * 170, y = 30 + r() * 60; s += `<g fill="#e9f3ff" opacity="${0.4 + r() * 0.5}"><ellipse cx="${x}" cy="${y + 8}" rx="3.2" ry="2.4"/><path d="M${x + 2.8} ${y + 8}V${y - 2}l5 2" stroke="#e9f3ff" stroke-width="1.2" fill="none"/></g>`; }
  return s + "</svg>";
}

// ---------- Narration ----------
// Read aloud with the phone's own voice, warm and a little slow, if it has one.
let storyVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const want = ["Samantha", "Karen", "Moira", "Serena", "Google UK English Female", "Daniel", "Google US English"];
    storyVoice = want.map(n => vs.find(v => v.name.includes(n))).find(Boolean) || vs.find(v => v.localService) || vs[0] || null;
  } catch (e) {}
}
try { speechSynthesis.addEventListener("voiceschanged", pickVoice); pickVoice(); } catch (e) {}
const narrationOn = () => save.settings.narrate !== false && "speechSynthesis" in window;
function narrate(text) {
  if (!narrationOn()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/“|”/g, ""));
    if (storyVoice) u.voice = storyVoice;
    u.rate = 0.9; u.pitch = 1.05; u.volume = Math.max(0.3, save.settings.sfx ?? 0.9);
    speechSynthesis.speak(u);
  } catch (e) {}
}
function stopNarration() { try { speechSynthesis.cancel(); } catch (e) {} }

// ---------- Playing a chapter ----------
let story = null;
function playStory(pages, { num, name, world, last = "Continue", done }) {
  story = { pages, k: 0, num, name, world, last, done };
  const th = THEMES[world % THEMES.length];
  $("storyScreen").style.setProperty("--world", `rgb(${th.rim.join(",")})`);
  show("story");
  storyPageShow();
}
function storyPageShow() {
  const st = story, p = st.pages[st.k];
  $("storyNum").textContent = st.num;
  $("storyName").textContent = st.name;
  $("storyArt").innerHTML = storyArt(p, st.world);
  $("storyText").textContent = p.text;
  $("storyDots").innerHTML = st.pages.map((x, k) => `<i class="${k === st.k ? "on" : ""}"></i>`).join("");
  $("storyGo").textContent = st.k < st.pages.length - 1 ? "Next" : st.last;
  $("storyVoice").textContent = narrationOn() ? "🔊 Narration on" : "🔈 Narration off";
  narrate(p.text);
}
function storyNext() {
  if (!story) return;
  if (story.k < story.pages.length - 1) { story.k++; storyPageShow(); return; }
  stopNarration();
  const done = story.done;
  story = null;
  done();
}
// The chapter that opens a world, or null after the first eight (and the coda that follows them).
function worldChapter(w) {
  if (w < CHAPTERS.length) return { name: CHAPTERS[w].title, pages: CHAPTERS[w].pages };
  if (w === CHAPTERS.length) return { name: "The Long Echo", pages: AFTER };
  return null;
}

// ---------- The lullaby ----------
// A gentle tune, the same every time, played when Lumi sings to the Great Hush.
function playLullaby() {
  const C = 261.63, f = s => C * Math.pow(2, s / 12);
  const tune = [[7, 1], [4, 0.5], [5, 0.5], [7, 1], [9, 1], [7, 2], [5, 1], [4, 0.5], [2, 0.5], [0, 1], [2, 1], [4, 2],
    [7, 1], [9, 0.5], [7, 0.5], [12, 1], [11, 1], [9, 2], [7, 1], [5, 0.5], [4, 0.5], [2, 1], [4, 1], [0, 3]];
  let t = 0;
  for (const [s, len] of tune) {
    note(f(s), { at: t * 0.42, dur: len * 0.5 + 0.3, vol: 0.07, type: "triangle", echo: 0.8 });
    t += len;
  }
  // A low warm answer underneath: the Hush singing back.
  [[-12, 0], [-17, 4], [-15, 8], [-12, 12], [-17, 16], [-20, 20]].forEach(([s, at]) => note(f(s), { at: at * 0.42, dur: 1.8, vol: 0.05, type: "sine", echo: 0.9 }));
  return t * 0.42;
}

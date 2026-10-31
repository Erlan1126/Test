// Echo: the story. A chapter opens each of the first eight worlds, told in a few illustrated
// pages over a music-box lullaby. The Great Hush was
// once the Singer, who sang every light to sleep, until its littlest light, Lumi, was lost in
// a flood. Each world's family member remembers one line of its lullaby; at the bottom of the
// Starlight Abyss, Lumi sings it back.
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
// Lumi's family: one hides in each of the first eight worlds, and each remembers one line.
const FAMILY = [
  { name: "Pip",    says: "You're real! I thought I was the only one left." },
  { name: "Fern",   says: "I fell asleep humming. I think I've been humming ever since." },
  { name: "Bell",   says: "The crystals kept saying you'd come. I stopped believing them. I'm sorry." },
  { name: "Kindle", says: "I kept one little ember warm. Just in case somebody came back." },
  { name: "Wren",   says: "It's so cold without the song. Can I stay close to you?" },
  { name: "Tide",   says: "The sea remembers the night we lost you. It never stopped looking either." },
  { name: "Penny",  says: "I read the walls every night. I know every word by heart." },
  { name: "Nova",   says: "Look up, Lumi. Can you see it? That's the sky." },
];

// The story. Pages name what the picture shows; the words carry the rest.
const CHAPTERS = [
  { title: "The Last Song", pages: [
    { text: "Before Lumi remembers anything else, it remembers a voice. Something very big and very warm, humming close by in the dark. Hush now, little light…", memory: 1 },
    { text: "Long ago, the caves under the world were full of song. A great Singer sang every light in the deep to sleep each night, and every light sang back.", crowd: 1, notes: 1 },
    { text: "Then, one by one, the songs went quiet. Something swallowed them. The lights went dark, and fell asleep, and forgot.", hush: "big", sleepers: 1 },
    { text: "Lumi wakes up alone, in a silence so deep it hurts. Somewhere far above, there must be a sky. And somewhere, maybe, someone still remembers that song.", lumi: 1 },
    { text: "So Lumi does the only thing a little light can do. It sings. And out in the dark, something hears.", lumi: 1, hushlings: 1 },
    { text: "Something small. A glow-moth no bigger than a crumb of light wobbles out of the dark and lands on Lumi's head. “You sang,” it says. “Nobody sings anymore.”", lumi: 1, flick: 1 },
    { text: "Its name is Flick. It talks too much, it's scared of everything, and it has decided, apparently, to stay.", lumi: 1, flick: 1, notes: 1 },
  ] },
  { title: "The Humming Moss", pages: [
    { text: "The moss hums back whenever Lumi sings. “See?” says Flick. “The caves aren't empty. They're only sleeping.”", lumi: 1, flick: 1, notes: 1 },
    { text: "Lumi isn't the only light left. One of its family hides in every world, curled up small in the dark. Each one remembers a single line of the old lullaby.", lumi: 1, family: 2 },
    { text: "Alone, a line is only a whisper. But if Lumi finds them all, maybe they can find the whole song. And maybe, whoever sang it.", lumi: 1, family: 2, notes: 1 },
  ] },
  { title: "Bells in the Stone", pages: [
    { text: "The crystals here remember everything ever sung near them. Touch one, and it rings with an old, old voice: the Singer, humming to someone very small.", crystals: 1, hush: "ghost", notes: 1 },
    { text: "“It had a favourite,” the crystals chime. “The littlest one. It sang them that song every single night.”", crystals: 1, memory: 1 },
    { text: "“What happened to the littlest one?” Lumi asks. The crystals don't answer. One by one, they go dark.", crystals: 1, lumi: 1 },
  ] },
  { title: "The Shadow King", pages: [
    { text: "In the heat of the Ember Caverns, Lumi finally sees it. The Great Hush: enormous, silent, crowned in shadow.", hush: "big", lumi: 1 },
    { text: "It doesn't roar. It only looks at Lumi for a long, long moment, with the saddest eyes Lumi has ever seen. Then it reaches out of the dark.", hush: "big", lumi: 1, flick: 1 },
    { text: "Flick, who is scared of everything, flies straight at it. “Run, Lumi!” A flash of green. The shadow closes. And Flick is gone.", hush: "big", flickGone: 1 },
    { text: "Lumi hides for a long time. It is very, very quiet without Flick. But Flick said nobody sings anymore. So Lumi wipes its eyes, and sings anyway.", lumi: 1 },
    { text: "And Lumi notices something strange. The Hushlings never tried to bite. They were looking at its face, as if they were looking for someone.", lumi: 1, hushlings: 1 },
  ] },
  { title: "Tears", pages: [
    { text: "In the frozen tunnels, Lumi watches a Hushling from behind an icicle. Up close, it isn't scary at all. It's crying.", frost: 1, hushlings: 1, lumi: 1 },
    { text: "Every time the Great Hush weeps, a tear falls into the dark and becomes a Hushling. They chase every song they hear, because they're looking for one voice. Just one.", hush: "far", tears: 1 },
    { text: "And far away, so faint it might be the wind, someone hums along to Lumi's song. Then stops, as if it's afraid to hope.", lumi: 1, notes: 1, hush: "far" },
    { text: "Somewhere inside all that silence, Lumi tells itself, a very small light is still glowing. Hold on, Flick.", lumi: 1, hush: "far" },
  ] },
  { title: "The Night of the Flood", pages: [
    { text: "The old sea remembers. One night, long ago, the water rose through the deep caves, fast and cold, and in the dark the Singer's littlest light was swept away.", sea: 1, memory: 1 },
    { text: "The Singer searched for years. It sang the lullaby into every tunnel, every crack, every echo. Nobody answered. It sang until its voice broke.", hush: "ghost", notes: 1 },
    { text: "After that, it couldn't bear to hear any song that wasn't that one little voice. So it swallowed them all, and waited in the silence, listening. The lights called it the Hush, after the first word of its song.", hush: "far" },
  ] },
  { title: "Is Anyone There?", pages: [
    { text: "Deep in the old mines, the lullaby is carved into every wall. Over and over, in big, shaking letters.", carving: 1, lumi: 1 },
    { text: "Under the last verse, scratched so many times the stone is worn smooth, there's a name. Lumi reads it, and its light flickers. The name is Lumi.", carving: 1, name: 1 },
    { text: "Lumi's family gather close. “The littlest one,” someone whispers. “It was you. It was always you.”", lumi: 1, family: 4 },
  ] },
  { title: "The Answer", pages: [
    { text: "The deepest place of all. The Great Hush is waiting at the bottom, the way it has waited for a hundred years.", lumi: 1, hush: "far", stars: 1 },
    { text: "“What if it swallows you too?” the smallest of them asks. Lumi thinks about it for a long time. “Then I'll find Flick. And it won't be alone anymore.”", lumi: 1, family: 5 },
    { text: "Lumi doesn't need to run this time. It only needs to sing.", lumi: 1, notes: 1 },
  ] },
];

// The ending changes with the lullaby: only the whole song brings Flick home.
const flickCanReturn = () => versesFound().every(Boolean);
function endingPages() {
  const all = flickCanReturn();
  const pages = [
    { text: "Lumi swam right up to the Great Hush, so close it could feel the cold of the shadow, and began to sing. " + (all ? "Every line, the way its family had taught it." : "Where it didn't know the words, it hummed."), lumi: 1, hush: "big", notes: 1 },
    { text: "The Hush went still. A hundred years of silence held its breath.", hush: "big" },
    { text: "Then, very softly, the way it used to every night, it sang the next line back. Its voice was cracked and old. It was the most beautiful thing Lumi had ever heard.", hush: "healing", lumi: 1, notes: 1 },
    { text: "“You came back,” it said. “I'm sorry,” said Lumi. “I didn't know the way.” “But you found it. You sang, and sang, until you found it.”", hush: "healing", lumi: 1 },
    { text: "The shadow broke like a shell, and the Singer was inside it all along: warm, and golden, and so very glad. Every Hushling, every lost tear, flew home to it and turned to light.", hush: "healed", fireflies: 1 },
  ];
  if (all) pages.push(
    { text: "And out of all that light, wobbling, no bigger than a crumb, came a glow-moth. “You sang,” said Flick. “I knew you would. I told everyone in there. Nobody believed me.”", hush: "healed", lumi: 1, flick: 1 },
    { text: "That night, under the stars, the Singer hummed the lullaby one more time, with Lumi's whole family curled up close. And this time, everyone sang back.", hush: "healed", lumi: 1, flick: 1, family: 5, stars: 1 },
    { text: "The End. Somebody's always listening.", stars: 1, lumi: 1, flick: 1 });
  else pages.push(
    { text: "Lumi searched the light for a small, wobbling glow. It searched for a long time. There wasn't one.", hush: "healed", lumi: 1 },
    { text: "“Some lights only come back to the whole song,” the Singer said softly. Somewhere, a few lines of the lullaby were still hiding, with Lumi's family.", hush: "healed", lumi: 1, notes: 1 },
    { text: "The End? Find every line of the lullaby, then sing to the Singer again.", stars: 1, lumi: 1 });
  return pages;
}
const AFTER = [
  { text: "Lumi's family live in the light now, and every night the Singer hums them to sleep.", hush: "healed", family: 5, stars: 1 },
  { text: "But a few lost Hushlings never heard the song. They're still down there, crying in the dark. So Lumi goes back down, singing, to bring every last one of them home.", lumi: 1, hushlings: 1 },
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
  if (p.name) s += `<text x="150" y="128" text-anchor="middle" font-family="Georgia, serif" font-size="30" letter-spacing="6" fill="#ffe6a0" opacity=".9">LUMI</text><path d="M95 136h110" stroke="#ffe6a0" stroke-opacity=".5"/>`;
  else if (p.carving && !p.lumi) s += `<text x="150" y="150" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="14" fill="#ffe6a0" opacity=".85">Is anyone there?</text>`;
  // A memory: something big and warm, humming over a very small light.
  if (p.memory) s += `<circle cx="150" cy="88" r="72" fill="url(#warm)" opacity=".55"/><ellipse cx="150" cy="78" rx="44" ry="38" fill="#fff1c8" opacity=".18"/><circle cx="150" cy="116" r="9" fill="#ffffff" opacity=".9"/><circle cx="150" cy="116" r="20" fill="#c9f6ff" opacity=".25"/><path d="M120 60q30-18 60 0" stroke="#fff1c8" stroke-opacity=".5" fill="none"/>`;
  // Tears falling into the dark and opening their eyes as Hushlings.
  if (p.tears) for (const [x, y, k] of [[200, 70, 0], [215, 95, 0.4], [190, 118, 0.8], [228, 132, 1]]) s += k < 1
    ? `<path d="M${x} ${y - 6}q5 8 0 11q-5-3 0-11z" fill="#9fb6ff" opacity="${0.8 - k * 0.4}"/>`
    : `<g><circle cx="${x}" cy="${y}" r="9" fill="#160c26"/><ellipse cx="${x - 3}" cy="${y - 1}" rx="2.2" ry="1.2" fill="#ff9ad0"/><ellipse cx="${x + 3}" cy="${y - 1}" rx="2.2" ry="1.2" fill="#ff9ad0"/></g>`;
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
  // Flick: a tiny glow-moth perched near Lumi, or the green flash where it was swallowed.
  const lumiX = p.hush || p.carving ? 95 : 150, lumiY = p.family && !p.hush ? 84 : 96;
  if (p.flick) s += `<g transform="translate(${lumiX + 20} ${lumiY - 26})"><circle r="12" fill="#b6ff9a" opacity=".2"/><ellipse cx="-4" rx="4.5" ry="6" transform="rotate(-25 -4 0)" fill="#c8ffb0"/><ellipse cx="4" rx="4.5" ry="6" transform="rotate(25 4 0)" fill="#c8ffb0"/><circle r="1.6" fill="#fff8d0"/></g>`;
  if (p.flickGone) s += `<circle cx="150" cy="96" r="30" fill="#b6ff9a" opacity=".25"/>` + [...Array(9)].map(() => `<circle cx="${130 + r() * 40}" cy="${80 + r() * 30}" r="${0.8 + r() * 1.5}" fill="#c8ffb0" opacity="${0.4 + r() * 0.6}"/>`).join("");
  if (p.notes) for (let k = 0; k < 5; k++) { const x = 70 + r() * 170, y = 30 + r() * 60; s += `<g fill="#e9f3ff" opacity="${0.4 + r() * 0.5}"><ellipse cx="${x}" cy="${y + 8}" rx="3.2" ry="2.4"/><path d="M${x + 2.8} ${y + 8}V${y - 2}l5 2" stroke="#e9f3ff" stroke-width="1.2" fill="none"/></g>`; }
  return s + "</svg>";
}

// ---------- Playing a chapter ----------
let story = null;
// A soft music-box lullaby plays under the story, one note at a time so it stops the moment
// the story closes.
let storyTuneT = 0, storyNote = 0;
function storyTune() {
  clearTimeout(storyTuneT);
  if (!story || screen !== "story") return;
  const [st, len] = LULLABY_TUNE[storyNote];
  note(261.63 * Math.pow(2, (st + 12) / 12), { dur: len * 0.6 + 0.6, vol: 0.03, type: "sine", echo: 0.9 });
  storyNote = (storyNote + 1) % LULLABY_TUNE.length;
  storyTuneT = setTimeout(storyTune, len * 500 + (storyNote === 0 ? 2500 : 0));
}
function playStory(pages, { num, name, world, last = "Continue", done }) {
  audio();
  story = { pages, k: 0, num, name, world, last, done };
  storyNote = 0;
  clearTimeout(storyTuneT);
  storyTuneT = setTimeout(storyTune, 400);
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
}
function storyNext() {
  if (!story) return;
  if (story.k < story.pages.length - 1) { story.k++; storyPageShow(); return; }
  clearTimeout(storyTuneT);
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
const LULLABY_TUNE = [[7, 1], [4, 0.5], [5, 0.5], [7, 1], [9, 1], [7, 2], [5, 1], [4, 0.5], [2, 0.5], [0, 1], [2, 1], [4, 2],
  [7, 1], [9, 0.5], [7, 0.5], [12, 1], [11, 1], [9, 2], [7, 1], [5, 0.5], [4, 0.5], [2, 1], [4, 1], [0, 3]];
function playLullaby() {
  const f = s => 261.63 * Math.pow(2, s / 12);
  let t = 0;
  for (const [s, len] of LULLABY_TUNE) {
    note(f(s), { at: t * 0.42, dur: len * 0.5 + 0.3, vol: 0.07, type: "triangle", echo: 0.8 });
    t += len;
  }
  // A low warm answer underneath: the Hush singing back.
  [[-12, 0], [-17, 4], [-15, 8], [-12, 12], [-17, 16], [-20, 20]].forEach(([s, at]) => note(f(s), { at: at * 0.42, dur: 1.8, vol: 0.05, type: "sine", echo: 0.9 }));
  return t * 0.42;
}

// Echo: the handmade caves, worlds and themes, and the level generator.
"use strict";

// ---------- Caves ----------
// # rock   . open   S start   E portal   o lost light   c crystal
// D sound door   b glow-moth   z sleepy Snoozle   > < ^ v water current
const LEVELS = [
  { name: "First Song", par: 4, hint: "first", map: [
    "###########",
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "##.......##",
    "##.#####.##",
    "##.#...#.##",
    "##.#.o.#.##",
    "##.#...#.##",
    "##.##.##.##",
    "##.......##",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
  ]},
  { name: "Crystal Path", par: 6, hint: "Crystals keep glowing once your song touches them", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#c....#####",
    "#.###....c#",
    "#.###.##..#",
    "#...#.##.##",
    "###.#.o#.##",
    "#o..#..#.##",
    "#####.##..#",
    "#.......#.#",
    "#.#####.#.#",
    "#.#c..#...#",
    "#.#.#.#####",
    "#...#.S.###",
    "#####...###",
    "###########",
  ]},
  { name: "Three Lights", par: 7, hint: "Three lights are hiding in here. Can you find them all?", map: [
    "###########",
    "###..E..###",
    "###.....###",
    "####.#.####",
    "#..o.#....#",
    "#.##.#.##.#",
    "#.#..#..#.#",
    "#.#.###.#c#",
    "#...#o#...#",
    "###.#.#.###",
    "#c..#.#..o#",
    "#.###.###.#",
    "#.....#...#",
    "###.#.#.#.#",
    "#...#...#.#",
    "#.#.#.#.#.#",
    "#...#S#...#",
    "###########",
  ]},
  { name: "Sound Doors", par: 7, hint: "Sound curtains open when your song reaches them, but not for long", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####D#####",
    "##.......##",
    "##.#####.##",
    "##.#.o.#.##",
    "##.#...#.##",
    "##.##D##.##",
    "##.......##",
    "#####.#####",
    "#o..#.#..c#",
    "#.#.#.#.#.#",
    "#.#.D.D.#.#",
    "#.#.#.#.#.#",
    "#...#S#...#",
    "###########",
    "###########",
  ]},
  { name: "The Current", par: 6, hint: "Underground rivers carry you along. Go with the flow!", map: [
    "###########",
    "#####E#####",
    "####...####",
    "####.#.####",
    "#>>>>>>>v.#",
    "#^#####.v.#",
    "#^#.o.#.v.#",
    "#^#.#.#.v.#",
    "#^#...#.v.#",
    "#^###.#.v.#",
    "#^....#.v.#",
    "#^#####.v.#",
    "#^<<<<<<<.#",
    "#.#######.#",
    "#...o..t..#",
    "#####.#####",
    "#####S#####",
    "###########",
  ]},
  { name: "Glow Friends", par: 7, hint: "Glow-moths follow you and make your light bigger", map: [
    "###########",
    "#E..#.....#",
    "###.#.###.#",
    "#b..#.#o..#",
    "#.###.#.###",
    "#...#...#b#",
    "###.#.#.#.#",
    "#o#...#...#",
    "#.###.#####",
    "#.....#..o#",
    "#.#####.#.#",
    "#...b.#.#.#",
    "###.#.#.#.#",
    "#...#...#.#",
    "#.#######.#",
    "#....S....#",
    "###########",
    "###########",
  ]},
  { name: "Sleepy Hollow", par: 6, hint: "Shh… don't bump the sleepy Snoozles", map: [
    "###########",
    "####.E.####",
    "####...####",
    "###.....###",
    "###.z.z.###",
    "###.....###",
    "#####.#####",
    "#o.t..#...#",
    "#.###.#.#.#",
    "#.#.....#.#",
    "#.#.z.z.#.#",
    "#.#.....#.#",
    "#.###.###.#",
    "#...#.#..o#",
    "###.....###",
    "###.z.z.###",
    "###..S..###",
    "###########",
  ]},
  { name: "Echo Maze", par: 9, hint: "Remember what you hear. The cave keeps a faint map of it", map: [
    "###########",
    "#E....#...#",
    "#####.#.#.#",
    "#o..#...#.#",
    "#.#.#####.#",
    "#.#...c...#",
    "#.#####.###",
    "#...#...#o#",
    "###.#.###.#",
    "#c#.#.....#",
    "#.#.#####.#",
    "#...#...#.#",
    "#.###.#.#.#",
    "#.....#.#.#",
    "#######.#.#",
    "#o......#.#",
    "#####S....#",
    "###########",
  ]},
  { name: "Undertow", par: 9, map: [
    "###########",
    "#....E....#",
    "#.#######.#",
    "#.#c.o..#.#",
    "#.#.###.#.#",
    "#...###...#",
    "###D###D###",
    "#<<<<<<<<<#",
    "#.#######.#",
    "#o#..t..#.#",
    "#.#.###.#.#",
    "#.#.#o#.#.#",
    "#...#.#...#",
    "#.###.###.#",
    "#>>>>.<<<<#",
    "#.#######.#",
    "#....S...o#",
    "###########",
  ]},
  { name: "Heart of the Cave", par: 10, hint: "Everything you've learned so far, all in one cave", map: [
    "###########",
    "#...#E#...#",
    "#.#.#D#.#.#",
    "#.#.....#.#",
    "#b#.z.z.#c#",
    "#.#.....#.#",
    "#.###.###.#",
    "#.....#o..#",
    "#####.#.###",
    "#o.D..#...#",
    "#.#.###>>v#",
    "#.#.....#v#",
    "#.#z#.#.#v#",
    "#...#.#.<<#",
    "###.#.#####",
    "#c..#..t..#",
    "#####S#..o#",
    "###########",
  ]},
];

// ---------- Worlds ----------
// 50 worlds of 20 levels. The first 10 levels are handmade; the rest are built from a seed,
// so every player gets the same cave for the same level number.
const PER_WORLD = 20, WORLDS = 50, TOTAL = PER_WORLD * WORLDS;
const THEMES = [
  { name: "Moonlit Grotto",  floor: [18, 46, 58], floor2: [30, 30, 72], rock: [62, 82, 128],   deep: [14, 18, 32], rim: [80, 160, 200] },
  { name: "Mossy Hollow",    floor: [16, 44, 36], floor2: [28, 40, 34], rock: [56, 92, 70],    deep: [12, 22, 18], rim: [110, 200, 140] },
  { name: "Amethyst Deep",   floor: [30, 22, 56], floor2: [46, 24, 72], rock: [92, 70, 140],   deep: [18, 12, 34], rim: [170, 120, 230] },
  { name: "Ember Caverns",   floor: [44, 20, 26], floor2: [54, 28, 20], rock: [120, 62, 52],   deep: [28, 12, 12], rim: [230, 130, 80] },
  { name: "Frost Tunnels",   floor: [28, 48, 70], floor2: [40, 54, 84], rock: [116, 146, 180], deep: [24, 32, 48], rim: [180, 225, 255] },
  { name: "Coral Depths",    floor: [14, 48, 56], floor2: [50, 28, 58], rock: [70, 110, 120],  deep: [12, 24, 30], rim: [255, 140, 170] },
  { name: "Golden Mines",    floor: [40, 32, 20], floor2: [34, 30, 40], rock: [116, 92, 54],   deep: [26, 20, 12], rim: [240, 190, 90] },
  { name: "Starlight Abyss", floor: [16, 16, 40], floor2: [30, 18, 52], rock: [52, 52, 100],   deep: [8, 8, 22],   rim: [255, 150, 220] },
];
const STORY = [
  "Lumi woke up alone, deep under the world. Somewhere far above, the sky is waiting. Only a song can light the way. But the Hush lives down here too, and its Hushlings hate every song.",
  "Soft moss hums back whenever Lumi sings. The cave is alive, and it seems to be listening.",
  "Purple crystals ring like little bells. Lumi feels braver now, and every song travels further.",
  "Warm air rises from glowing cracks in the rock. The lost lights down here burn brighter than ever.",
  "Everything is quiet and cold. Each song echoes for a long, long time before it fades.",
  "An old underground sea. Tiny creatures glow in the water, and some of them want to be friends.",
  "Someone lived here long ago. Their lanterns are gone, but the tunnels still remember their songs.",
  "The deepest place of all, where the Great Hush was born. Far above, Lumi can almost hear the stars singing back.",
];
const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII"];
const DAILY = -1;
const worldOf = i => Math.floor(i / PER_WORLD);
// The daily cave changes at midnight UTC, so everyone in the world gets the same one.
const dayNumber = () => Math.floor(Date.now() / 86400000);
const dayKey = (n = dayNumber()) => new Date(n * 86400000).toISOString().slice(0, 10);
const WEEKLY = -2;
const weekNumber = () => Math.floor((dayNumber() + 3) / 7);  // weeks start on Monday (UTC)
const isChallenge = i => i < 0;
const themeIndex = i => (i === WEEKLY ? weekNumber() + 3 : i < 0 ? dayNumber() : worldOf(i)) % THEMES.length;
const themeOf = i => THEMES[themeIndex(i)];
// Energy and Hushlings get gently harder with depth; the daily cave sits in the middle.
const depthOf = i => (i === WEEKLY ? 0.8 : i < 0 ? 0.5 : Math.min(1, Math.max(0, 0.1 + (i - 19) / 320)));
const worldName = w => THEMES[w % THEMES.length].name + ROMAN[Math.floor(w / THEMES.length)];

// Handmade levels that introduce each new idea, placed where it first appears. Each one opens
// with a picture card (see CARDS in ui.js) the first time it's played.
const INTRO_DEFS = {
  thorns: { name: "Thorn Alley", par: 5, card: "thorns", hint: "Listen for the rattle. Sing to see what's moving", map: [
    "###########",
    "#####E#####",
    "####...####",
    "#####.#####",
    "#o...t...o#",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "#.....t...#",
    "#.###.###.#",
    "#.#.....#.#",
    "#.#.#t#.#.#",
    "#...#.#...#",
    "#####.#####",
    "####...####",
    "####S..####",
    "###########",
    "###########",
  ]},
  energy: { name: "Fading Light", par: 6, card: "energy", map: [
    "###########",
    "#####E#####",
    "####...####",
    "####.#.####",
    "#o..c#c..o#",
    "#.###.###.#",
    "#.#.....#.#",
    "#.#.###.#.#",
    "#...#o#...#",
    "###.#.#.###",
    "#...#.#...#",
    "#.###.###.#",
    "#.c.......#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "###########",
    "###########",
  ]},
  rescue: { name: "Lost and Found", par: 6, card: "rescue", goal: "rescue", map: [
    "###########",
    "#E..#.....#",
    "###.#.###.#",
    "#...#.#...#",
    "#.###.#.###",
    "#.....#...#",
    "#####.###.#",
    "#m..#.....#",
    "###.#.#####",
    "#...#.....#",
    "#.#####.#.#",
    "#.....#.#.#",
    "#.###.#.#.#",
    "#.#...#.#o#",
    "#.#.###.###",
    "#....S....#",
    "###########",
    "###########",
  ]},
  runes: { name: "Listening Stones", par: 6, card: "runes", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####G#####",
    "#.........#",
    "#.###.###.#",
    "#.#r#.#.#.#",
    "#.#.#.#.#.#",
    "#...#.#...#",
    "###.#.#.###",
    "#o..#.#..r#",
    "#####.#####",
    "###.....###",
    "###.....###",
    "###..S..###",
    "###########",
    "###########",
    "###########",
  ]},
  gloom: { name: "Shadows", par: 7, card: "gloom", map: [
    "###########",
    "###..E..###",
    "###.....###",
    "#####.#####",
    "#o....g...#",
    "#.###.###.#",
    "#.#.....#.#",
    "#.#.#.#.#.#",
    "#...#.#...#",
    "###.#.#.###",
    "#...#c#..o#",
    "#.###.###.#",
    "#.........#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "###########",
    "###########",
  ]},
  quiet: { name: "Hush", par: 6, songs: 8, card: "quiet", goal: "quiet", map: [
    "###########",
    "#E....#...#",
    "#####.#.#.#",
    "#.....#.#.#",
    "#.#####.#.#",
    "#.......#.#",
    "#########.#",
    "#o......#.#",
    "#.#####.#.#",
    "#...#...#.#",
    "###.#.###.#",
    "#...#.....#",
    "#.#########",
    "#.........#",
    "#########.#",
    "#S........#",
    "###########",
    "###########",
  ]},
  dark: { name: "Into the Dark", par: 8, card: "dark", dark: true, map: [
    "###########",
    "#...#...#E#",
    "#.#.#.#.#.#",
    "#.#...#...#",
    "#.#####.###",
    "#.....#...#",
    "#####.###.#",
    "#o..#.....#",
    "###.#.#####",
    "#...#.....#",
    "#.#####.#.#",
    "#.#...#.#o#",
    "#.#.#.#.###",
    "#...#.....#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "###########",
  ]},
  tall: { name: "The Long Climb", par: 9, card: "tall", map: [
    "###########",
    "#....E....#",
    "#.#######.#",
    "#.........#",
    "#######.###",
    "#.........#",
    "#.###.#####",
    "#...#.....#",
    "###.#####.#",
    "#o..#.....#",
    "#.###.#####",
    "#.........#",
    "#####.###.#",
    "#.......#.#",
    "#.#####.#.#",
    "#.#c..#...#",
    "#.#.#.###.#",
    "#...#.....#",
    "#####.###.#",
    "#o....#...#",
    "#.###.#.###",
    "#...#.....#",
    "###.#####.#",
    "#.....S...#",
    "###########",
    "###########",
  ]},
  race: { name: "Race the Tide", par: 5, time: 30, card: "race", goal: "race", map: [
    "###########",
    "#####E#####",
    "####...####",
    "####.^.####",
    "#>>>>^<<<<#",
    "#.###^###.#",
    "#.#..^..#.#",
    "#.#.#^#.#.#",
    "#...#^#...#",
    "###.#^#.###",
    "#o..#^#..o#",
    "#####^#####",
    "###..^..###",
    "###.....###",
    "###..S..###",
    "###########",
    "###########",
    "###########",
  ]},
};
// The first levels, in order: a two-level tutorial, then something new every level or two, so
// the game gets interesting (and dangerous) fast.
const FIXED_ORDER = [
  LEVELS[0], LEVELS[1], INTRO_DEFS.energy, LEVELS[3], INTRO_DEFS.thorns, LEVELS[4], INTRO_DEFS.gloom, LEVELS[6],
  INTRO_DEFS.rescue, LEVELS[9], INTRO_DEFS.quiet, LEVELS[2], INTRO_DEFS.runes, LEVELS[5], INTRO_DEFS.dark, LEVELS[7],
  INTRO_DEFS.tall, LEVELS[8], INTRO_DEFS.race,
];
// Every handmade level by its index, and the ones that introduce something with a card.
const INTRO = {};
FIXED_ORDER.forEach((d, i) => { INTRO[i] = d; });
const INTRO_LEVELS = Object.keys(INTRO).map(Number).filter(i => INTRO[i].card);

// Every generated cave gets its own name in its world's style.
const NAME_ADJ = ["Whispering", "Hidden", "Silent", "Glimmering", "Winding", "Sleeping", "Forgotten", "Echoing", "Misty", "Gentle",
  "Ancient", "Shimmering", "Quiet", "Lonely", "Tangled", "Drowsy", "Velvet", "Secret", "Distant", "Humming"];
const NAME_NOUN = [
  ["Grotto", "Moonpool", "Burrow", "Nook", "Passage", "Chamber", "Basin", "Hollow"],
  ["Fernway", "Mossbank", "Thicket", "Rootway", "Glade", "Dell", "Burrow", "Hollow"],
  ["Geode", "Spire", "Vault", "Crystalway", "Prism", "Hall", "Gallery", "Grotto"],
  ["Forge", "Hearth", "Cinderway", "Furnace", "Kiln", "Vent", "Crucible", "Hall"],
  ["Icefall", "Glacier", "Rimeway", "Snowdrift", "Floe", "Frost Hall", "Hollow", "Passage"],
  ["Reef", "Lagoon", "Tidepool", "Shoal", "Undertow", "Kelpway", "Grotto", "Shell Cave"],
  ["Mine", "Shaft", "Vein", "Tunnel", "Lantern Hall", "Seam", "Quarry", "Gallery"],
  ["Abyss", "Rift", "Starwell", "Chasm", "Skyway", "Comet Hall", "Deep", "Hollow"],
];
function caveName(n) {
  const t = worldOf(n) % THEMES.length, r = seeded(n * 389 + 11);
  if (isFinale(n)) return "Heart of the " + THEMES[t].name.split(" ")[1];
  const noun = NAME_NOUN[t][Math.floor(r() * 8)];
  let adj = NAME_ADJ[Math.floor(r() * NAME_ADJ.length)];
  if (noun.includes(adj) || adj === noun) adj = "Hidden";
  return `${adj} ${noun}`;
}

const levelCache = new Map();
function getLevel(i) {
  if (i === WEEKLY) {
    const week = weekNumber(), key = "weekly" + week;
    if (!levelCache.has(key)) levelCache.set(key, generateLevel(90000 + week * 17, { hard: 0.8, name: "Weekly Cave" }));
    return levelCache.get(key);
  }
  if (i === DAILY) {
    const day = dayNumber(), key = "daily" + day;
    if (!levelCache.has(key)) levelCache.set(key, applyTwist(generateLevel(50000 + day * 13, { hard: 0.35 + (day % 7) * 0.04, name: "Daily Cave" }), day));
    return levelCache.get(key);
  }
  if (INTRO[i]) return INTRO[i];
  if (!levelCache.has(i)) levelCache.set(i, generateLevel(i));
  return levelCache.get(i);
}

function seeded(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Builds a cave: a winding maze with extra loops and open chambers, then places the start,
// the portal far away, lights in dead ends, and features that grow with the level number.
// Difficulty climbs slowly, with an easy "breather" every fifth level and a bigger
// finale at the end of each world.
const isBreather = n => n % 5 === 3 && n % PER_WORLD !== PER_WORLD - 1;
const isFinale = n => n % PER_WORLD === PER_WORLD - 1;
// The level in each world where one of Lumi's little lights is hiding.
const familyLevel = w => w * PER_WORLD + (w === 0 ? 19 : 9);

// Each world leans on one or two ideas it introduces, so worlds feel different from each
// other. A level only uses ideas that have been introduced by then, and never more than
// three big ones at once.
const BASICS = ["doors", "currents", "snoozles", "thorns"];
const SIGNATURE = [
  ["thorns", "gloom"],        // 1 Moonlit Grotto: Thornlings and the first Hushlings
  ["rescue"],                 // 2 Mossy Hollow: lost baby moths
  ["runes", "echo"],          // 3 Amethyst Deep: rune stones, gates and echo crystals
  ["gloom", "quiet", "thorns"], // 4 Ember Caverns: Hushlings, quiet caves and Thornlings
  ["dark", "tall"],           // 5 Frost Tunnels: dark caves and long climbs
  ["race", "currents"],       // 6 Coral Depths: races on the tide
  ["runes", "doors", "tall"], // 7 Golden Mines
  ["gloom", "dark", "race", "echo"], // 8 Starlight Abyss
];
// Where each idea is first introduced (by a handmade level in INTRO).
const UNLOCK = { doors: 3, thorns: 4, currents: 5, gloom: 6, snoozles: 7, rescue: 8, quiet: 10, runes: 12, dark: 14, tall: 16, race: 18, echo: 24 };
const GOALS = ["rescue", "quiet", "race"];
// Each world's signature creature, and where each creature first appears.
const WORLD_MOB = ["t", "n", "a", "k", "w", "j", "k", "a"];
const MOB_UNLOCK = { t: 4, n: 20, a: 40, k: 60, w: 80, j: 100 };
function planLevel(n, daily, hard, pre) {
  const w = daily ? dayNumber() % THEMES.length : worldOf(n), sig = SIGNATURE[w % SIGNATURE.length];
  // The daily cave stays one screen tall, so it fits a coffee break.
  const open = Object.keys(UNLOCK).filter(k => (daily ? k !== "tall" : n >= UNLOCK[k]));
  const plan = new Set();
  for (const k of open) {
    const signature = sig.includes(k);
    const chance = GOALS.includes(k) ? (signature ? 0.4 : 0.12) : (signature ? 0.6 : 0.28) + hard * 0.2;
    if (pre() < chance) plan.add(k);
  }
  // Only one goal per level, preferring the world's own.
  const goals = [...plan].filter(k => GOALS.includes(k)).sort((a, b) => sig.includes(b) - sig.includes(a));
  goals.slice(1).forEach(k => plan.delete(k));
  // At most three big ideas (one on a breather level), keeping the world's signature first.
  const limit = !daily && isBreather(n) ? 1 : 3;
  const ranked = [...plan].sort((a, b) => sig.includes(b) - sig.includes(a) || pre() - 0.5);
  const chosen = new Set(ranked.filter(k => k !== "gloom").slice(0, limit));
  // Hushlings are the caves' villains: once they've appeared, they're in every cave.
  if (open.includes("gloom")) chosen.add("gloom");
  return chosen;
}

function generateLevel(n, opts = {}) {
  const daily = opts.hard != null;
  // Difficulty starts a fifth of the way up as soon as the handmade levels end.
  let hard = daily ? opts.hard : Math.min(1, 0.2 + Math.max(0, n - 19) / 300);
  if (!daily && isBreather(n)) hard *= 0.4;
  if (!daily && isFinale(n)) hard = Math.min(1, hard + 0.25);
  const pre = seeded(n * 131 + 7);
  const plan = planLevel(n, daily, hard, pre);
  // Big caves are either tall (scrolling up and down) or, from level 101, wide (scrolling sideways).
  const wide = plan.has("tall") && (daily || n >= 100) && pre() < 0.4;
  const C = wide ? 17 : 11, R = plan.has("tall") && !wide ? (pre() < 0.55 ? 26 : 34) : 18;
  const dark = plan.has("dark");
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], big = (R * C) / (18 * 11);
  for (let attempt = 0; ; attempt++) {
    const r = seeded(n * 7919 + attempt * 104729 + 17);
    const pick = a => a[Math.floor(r() * a.length)];
    const g = Array.from({ length: R }, () => Array(C).fill("#"));
    const open = (x, y) => x > 0 && y > 0 && x < C - 1 && y < R - 1 && g[y][x] !== "#";
    const inside = (x, y) => x > 0 && y > 0 && x < C - 1 && y < R - 2;

    // Each cave gets one of four shapes so levels don't all feel the same.
    const style = attempt > 12 ? "maze" : pick(["maze", "maze", "caverns", "chambers", "winding"]);
    if (style === "caverns") {
      // Cellular caves: random rock that settles into blobby open caverns.
      for (let y = 1; y < R - 2; y++) for (let x = 1; x < C - 1; x++) g[y][x] = r() < 0.42 ? "#" : ".";
      for (let k = 0; k < 4; k++) {
        const next = g.map(row => row.slice());
        for (let y = 1; y < R - 2; y++) for (let x = 1; x < C - 1; x++) {
          let walls = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] === "#") walls++;
          next[y][x] = walls >= 5 ? "#" : ".";
        }
        for (let y = 0; y < R; y++) g[y] = next[y];
      }
      // Keep only the biggest connected cavern.
      const seen = new Set();
      let best = [];
      for (let y = 1; y < R - 2; y++) for (let x = 1; x < C - 1; x++) {
        if (g[y][x] !== "." || seen.has(x + "," + y)) continue;
        const part = [], q = [[x, y]];
        seen.add(x + "," + y);
        while (q.length) {
          const [cx, cy] = q.pop();
          part.push([cx, cy]);
          for (const [dx, dy] of D4) {
            const nx = cx + dx, ny = cy + dy;
            if (inside(nx, ny) && g[ny][nx] === "." && !seen.has(nx + "," + ny)) { seen.add(nx + "," + ny); q.push([nx, ny]); }
          }
        }
        if (part.length > best.length) best = part;
      }
      const keep = new Set(best.map(p => p + ""));
      for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) if (!keep.has(x + "," + y)) g[y][x] = "#";
      if (best.length < 55 * big) continue;
    } else if (style === "chambers") {
      // A string of rooms joined by tunnels.
      const rooms = [];
      for (let k = 0, tries = 0; rooms.length < Math.round(5 * big) && tries < 90; tries++) {
        const w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
        const x = 1 + Math.floor(r() * (C - 1 - w)), y = 1 + Math.floor(r() * (R - 2 - h));
        if (rooms.some(o => x < o.x + o.w + 1 && o.x < x + w + 1 && y < o.y + o.h + 1 && o.y < y + h + 1)) continue;
        rooms.push({ x, y, w, h });
      }
      rooms.sort((a, b) => b.y - a.y);
      for (const o of rooms) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) g[y][x] = ".";
      for (let k = 1; k < rooms.length; k++) {
        const a = rooms[k - 1], b = rooms[k];
        let x = a.x + Math.floor(r() * a.w), y = a.y + Math.floor(r() * a.h);
        const tx = b.x + Math.floor(r() * b.w), ty = b.y + Math.floor(r() * b.h);
        const horizFirst = r() < 0.5;
        while (x !== tx || y !== ty) {
          if ((horizFirst && x !== tx) || y === ty) x += Math.sign(tx - x); else y += Math.sign(ty - y);
          g[y][x] = ".";
        }
      }
      if (rooms.length < Math.round(4 * big)) continue;
    }
    if (style === "maze" || style === "winding") {
      // Maze over cells at odd coordinates.
      const cells = [];
      for (let y = 1; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) cells.push([x, y]);
      const visited = new Set();
      const stack = [pick(cells)];
      visited.add(stack[0] + "");
      g[stack[0][1]][stack[0][0]] = ".";
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const nb = D4.map(([dx, dy]) => [x + dx * 2, y + dy * 2, dx, dy])
          .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < C - 1 && ny < R - 2 && !visited.has(nx + "," + ny));
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = pick(nb);
        g[y + dy][x + dx] = ".";
        g[ny][nx] = ".";
        visited.add(nx + "," + ny);
        stack.push([nx, ny]);
      }
      // Loops so there's more than one way around (winding caves get very few).
      const loops = Math.round((style === "winding" ? 1 : 3 + Math.floor(r() * 5)) * big);
      for (let k = 0, tries = 0; k < loops && tries < 200; tries++) {
        const x = 1 + Math.floor(r() * (C - 2)), y = 1 + Math.floor(r() * (R - 3));
        if (g[y][x] !== "#") continue;
        if ((open(x - 1, y) && open(x + 1, y) && !open(x, y - 1) && !open(x, y + 1)) ||
            (open(x, y - 1) && open(x, y + 1) && !open(x - 1, y) && !open(x + 1, y))) { g[y][x] = "."; k++; }
      }
      // Open chambers.
      const rooms = style === "winding" ? 0 : Math.round((1 + Math.floor(r() * 3)) * big);
      for (let k = 0; k < rooms; k++) {
        const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2);
        const rx = 1 + Math.floor(r() * (C - 1 - w)), ry = 1 + Math.floor(r() * (R - 2 - h));
        for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) g[y][x] = ".";
      }
    }

    const bfs = (sx, sy, blocked) => {
      const d = Array.from({ length: R }, () => Array(C).fill(-1)), par = {};
      d[sy][sx] = 0;
      const q = [[sx, sy]];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!open(nx, ny) || d[ny][nx] >= 0 || (blocked && blocked.has(nx + "," + ny))) continue;
          d[ny][nx] = d[y][x] + 1;
          par[nx + "," + ny] = [x, y];
          q.push([nx, ny]);
        }
      }
      return { d, par };
    };

    const floor = [];
    for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) if (g[y][x] === ".") floor.push([x, y]);
    const low = floor.filter(([, y]) => y >= R - 5);
    const S = pick(low.length ? low : floor);
    g[S[1]][S[0]] = "S";
    let { d, par } = bfs(S[0], S[1]);
    let E = S, far = 0;
    for (const [x, y] of floor) if (d[y][x] > far || (d[y][x] === far && y < E[1])) { far = d[y][x]; E = [x, y]; }
    if (far < (style === "caverns" ? 9 : 12) * big) continue;
    g[E[1]][E[0]] = "E";

    // Main route from start to portal.
    const route = [];
    for (let p = E; p; p = par[p + ""]) route.unshift(p);
    const onRoute = new Set(route.map(p => p + ""));
    const free = (x, y) => g[y][x] === "." && Math.abs(x - S[0]) + Math.abs(y - S[1]) > 1 && Math.abs(x - E[0]) + Math.abs(y - E[1]) > 1;

    // Currents along a straight stretch of the route.
    let doors = 0;
    if (plan.has("currents")) {
      for (let k = 1; k < route.length - 4; k++) {
        const dx = route[k + 1][0] - route[k][0], dy = route[k + 1][1] - route[k][1];
        let len = 0;
        while (k + len + 1 < route.length - 1 && route[k + len + 1][0] - route[k + len][0] === dx && route[k + len + 1][1] - route[k + len][1] === dy) len++;
        if (len >= 3 && r() < 0.6) {
          const against = r() < 0.15 + hard * 0.2;
          const ch = { "1,0": ">", "-1,0": "<", "0,1": "v", "0,-1": "^" }[(against ? -dx : dx) + "," + (against ? -dy : dy)];
          for (let q = 0; q < len; q++) { const [x, y] = route[k + q]; if (g[y][x] === ".") g[y][x] = ch; }
          break;
        }
      }
    }
    // Sound doors in narrow spots on the route.
    if (plan.has("doors")) {
      const want = 1 + (r() < hard ? 1 : 0);
      const spots = route.slice(3, -2).filter(([x, y]) => free(x, y) &&
        ((!open(x - 1, y) && !open(x + 1, y)) || (!open(x, y - 1) && !open(x, y + 1))));
      for (let k = 0; k < want && spots.length; k++) {
        const [x, y] = spots.splice(Math.floor(r() * spots.length), 1)[0];
        g[y][x] = "D";
        doors++;
      }
    }
    // Rune puzzle: a stone gate on the route that opens for good once every rune stone has
    // heard a song sung close by. The runes are always reachable without passing the gate.
    const runes = [];
    let gate = null;
    if (plan.has("runes")) {
      // Only where the gate really blocks the way to the portal, so it can't be skipped.
      const spots = route.slice(Math.floor(route.length * 0.45), -3).filter(([x, y]) => free(x, y) &&
        ((!open(x - 1, y) && !open(x + 1, y)) || (!open(x, y - 1) && !open(x, y + 1))) &&
        bfs(S[0], S[1], new Set([x + "," + y])).d[E[1]][E[0]] < 0);
      if (spots.length) {
        gate = pick(spots);
        const before = bfs(S[0], S[1], new Set([gate + ""])).d;
        const cand = floor.filter(([x, y]) => free(x, y) && before[y][x] >= 4 && Math.abs(x - gate[0]) + Math.abs(y - gate[1]) >= 3);
        const want = 1 + (r() < 0.4 + hard * 0.3 ? 1 : 0);
        for (let k = 0; k < want && cand.length; k++) {
          const [x, y] = cand.splice(Math.floor(r() * cand.length), 1)[0];
          g[y][x] = "r";
          runes.push([x, y]);
        }
        if (runes.length) g[gate[1]][gate[0]] = "G"; else gate = null;
      }
    }
    // Lights, mostly hidden in dead ends.
    const lightCount = Math.min(5, 1 + Math.floor(r() * 2 + hard * 2.5) + (!daily && isFinale(n) ? 1 : 0) + (R > 18 ? 1 : 0));
    const ends = floor.filter(([x, y]) => free(x, y) && D4.filter(([dx, dy]) => open(x + dx, y + dy)).length === 1);
    const others = floor.filter(([x, y]) => free(x, y) && !onRoute.has(x + "," + y));
    const lights = [];
    for (let k = 0; k < lightCount; k++) {
      const pool = (ends.length ? ends : others).filter(([x, y]) => free(x, y));
      if (!pool.length) break;
      const [x, y] = pick(pool);
      g[y][x] = "o";
      lights.push([x, y]);
    }
    if (!lights.length) continue;
    const placeSome = (ch, count, ok) => {
      for (let k = 0, tries = 0; k < count && tries < 60; tries++) {
        const [x, y] = pick(floor);
        if (free(x, y) && (!ok || ok(x, y))) { g[y][x] = ch; k++; }
      }
    };
    if (r() < 0.5) placeSome("c", 1 + Math.floor(r() * 2));
    if (n >= 5 && r() < (SIGNATURE[worldOf(n) % SIGNATURE.length].includes("rescue") ? 0.5 : 0.25)) placeSome("b", 1 + Math.floor(r() * 2));
    // Snoozles only where you can get around them.
    if (plan.has("snoozles")) {
      const want = 1 + Math.floor(r() * (1 + hard * 3));
      const goals = [E, ...lights];
      for (let k = 0, tries = 0; k < want && tries < 40; tries++) {
        const [x, y] = pick(floor);
        if (!free(x, y)) continue;
        let around = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open(x + dx, y + dy)) around++;
        if (around < 4) continue;
        let crowded = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] === "z") crowded = true;
        if (crowded) continue;
        const blocked = new Set(Object.keys(critterSpots(g)).concat([x + "," + y]));
        const t = bfs(S[0], S[1], blocked).d;
        const tg = gate ? bfs(S[0], S[1], new Set([...blocked, gate + ""])).d : t;
        if (goals.every(([gx, gy]) => t[gy][gx] >= 0) && runes.every(([gx, gy]) => tg[gy][gx] >= 0)) { g[y][x] = "z"; k++; }
      }
    }

    // Hushlings: shadows that come looking when they hear you sing.
    if (plan.has("gloom")) {
      // Finales with the Great Hush get at most one ordinary Hushling besides.
      // Hushlings count toward the cap of five creatures per cave (six in a big one).
      const others = g.flat().filter(c => "tnakwj".includes(c)).length, room = Math.max(0, (R * C > 198 ? 6 : 5) - others);
      const want = Math.min(room, !daily && isFinale(n) ? 1 : 3, 1 + Math.floor(r() * (1 + hard * 2)));
      for (let k = 0, tries = 0; k < want && tries < 40; tries++) {
        const [x, y] = pick(floor);
        if (free(x, y) && Math.abs(x - S[0]) + Math.abs(y - S[1]) >= 6) { g[y][x] = "g"; k++; }
      }
    }

    // Thornlings patrol straight tunnels on the way to the portal.
    // A patrol lane never passes close to the start, so nothing hits Lumi before it can look.
    const laneNearStart = (x, y) => {
      let l = x, rr = x, u = y, dd = y;
      while (open(l - 1, y) && g[y][l - 1] !== "D") l--;
      while (open(rr + 1, y) && g[y][rr + 1] !== "D") rr++;
      while (open(x, u - 1) && g[u - 1][x] !== "D") u--;
      while (open(x, dd + 1) && g[dd + 1][x] !== "D") dd++;
      return rr - l >= dd - u ? Math.abs(y - S[1]) <= 1 && S[0] >= l - 1 && S[0] <= rr + 1 : Math.abs(x - S[0]) <= 1 && S[1] >= u - 1 && S[1] <= dd + 1;
    };
    if (plan.has("thorns")) {
      const want = Math.min(3, 1 + Math.floor(r() * (1.5 + hard * 2)));
      const spots = route.slice(3, -3).filter(([x, y]) => g[y][x] === "." &&
        ((open(x - 1, y) && open(x + 1, y) && (open(x - 2, y) || open(x + 2, y))) || (open(x, y - 1) && open(x, y + 1) && (open(x, y - 2) || open(x, y + 2)))));
      for (let k = 0; k < want && spots.length; k++) {
        const [x, y] = spots.splice(Math.floor(r() * spots.length), 1)[0];
        if (Math.abs(x - S[0]) + Math.abs(y - S[1]) > 3 && !laneNearStart(x, y)) g[y][x] = "t";
      }
    }

    // Every cave beyond the handmade ones has creatures, more the deeper you go: mostly the
    // world's own, plus ones met in earlier worlds.
    {
      const w = (daily ? dayNumber() : worldOf(n)) % WORLD_MOB.length, own = WORLD_MOB[w];
      const met = Object.keys(MOB_UNLOCK).filter(k => daily || n >= MOB_UNLOCK[k]);
      const count = Math.max(1, Math.min(6, 1 + Math.floor(hard * 3.5) + (r() < 0.5 ? 1 : 0) + (R * C > 198 ? 1 : 0) - (!daily && isBreather(n) ? 1 : 0)));
      const fits = (kind, x, y) => {
        if (!free(x, y) || Math.abs(x - S[0]) + Math.abs(y - S[1]) < 5) return false;
        // Creatures keep their distance from each other, so no spot needs dodging two at once.
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++)
          if (Math.abs(xx - x) + Math.abs(yy - y) <= 2 && g[yy] && "tnakwjgB".includes(g[yy][xx])) return false;
        if (kind === "t") return ((open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1))) && !laneNearStart(x, y);
        if (kind === "n") return D4.filter(([dx, dy]) => !open(x + dx, y + dy)).length === 1;
        if (kind === "a") return !open(x, y - 1) && open(x, y + 1);
        if (kind === "k") return !open(x, y + 1) && open(x - 1, y) && open(x + 1, y) && (open(x - 2, y) || open(x + 2, y)) && Math.abs(y - S[1]) > 1;
        if (kind === "j") return open(x, y - 1) && open(x, y + 1) && (open(x, y - 2) || open(x, y + 2)) && Math.abs(x - S[0]) > 1;
        return true;
      };
      // Never more than five creatures in a cave (six in a big one), counting Thornlings and Hushlings.
      const already = g.flat().filter(c => "tgB".includes(c)).length, cap = (R * C > 198 ? 6 : 5) - already;
      for (let k = 0; k < Math.min(count, cap) && met.length; k++) {
        const kind = met.includes(own) && r() < 0.6 ? own : pick(met);
        const spots = floor.filter(([x, y]) => fits(kind, x, y));
        if (spots.length) { const [x, y] = pick(spots); g[y][x] = kind; }
      }
    }

    // Echo crystals: rock faces that bounce a song onward, carrying it around corners.
    if (plan.has("echo")) {
      const faces = [];
      for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
        if (g[y][x] !== "#") continue;
        const openSides = D4.filter(([dx, dy]) => open(x + dx, y + dy)).length;
        if (openSides >= 1 && openSides <= 2) faces.push([x, y]);
      }
      const want = Math.min(faces.length, 2 + Math.floor(r() * 3) + Math.round(big));
      for (let k = 0; k < want; k++) { const [x, y] = faces.splice(Math.floor(r() * faces.length), 1)[0]; g[y][x] = "W"; }
    }

    // The Great Hush guards world finales from World 4, halfway along the way to the portal.
    if (!daily && isFinale(n) && n >= UNLOCK.gloom) {
      const mid = route.slice(Math.floor(route.length * 0.35), Math.floor(route.length * 0.7)).filter(([x, y]) => g[y][x] === ".");
      if (mid.length) { const [x, y] = pick(mid); g[y][x] = "B"; }
    }
    // One of Lumi's little lights hides in one level of every world, away from the main path.
    if (!daily && n === familyLevel(worldOf(n))) {
      // Reachable without squeezing past a Snoozle, which would block a narrow tunnel.
      ({ d } = bfs(S[0], S[1], new Set(Object.keys(critterSpots(g)))));
      const spots = floor.filter(([x, y]) => free(x, y) && !onRoute.has(x + "," + y) && d[y][x] >= 6).sort((a, b) => d[b[1]][b[0]] - d[a[1]][a[0]]);
      if (!spots.length) continue;
      const [x, y] = spots[Math.floor(r() * Math.min(4, spots.length))];
      g[y][x] = "f";
    }

    // Level goal. Most caves are about exploring; some ask for something different.
    let goal = "explore", baby = null;
    goal = GOALS.find(k => plan.has(k)) || "explore";
    if (goal === "rescue") {
      ({ d } = bfs(S[0], S[1]));
      const spots = floor.filter(([x, y]) => free(x, y) && d[y][x] >= 8 * big);
      if (spots.length) { baby = pick(spots); g[baby[1]][baby[0]] = "m"; } else goal = "explore";
    }

    // Par: route length past every light (and the lost moth), plus a little room for doors and runes.
    ({ d } = bfs(S[0], S[1]));
    let pos = S, walk = 0;
    const left = lights.concat(baby ? [baby] : [], runes);
    while (left.length) {
      const dd = bfs(pos[0], pos[1]).d;
      left.sort((a, b) => dd[a[1]][a[0]] - dd[b[1]][b[0]]);
      walk += Math.max(0, dd[left[0][1]][left[0][0]]);
      pos = left.shift();
    }
    walk += Math.max(0, bfs(pos[0], pos[1]).d[E[1]][E[0]]);
    // Tighter than before: in testing a robot that knew the map used under half the target.
    const parPings = Math.ceil(walk / 8) + 1 + doors + runes.length + (lights.length >= 3 ? 1 : 0) + (dark ? 2 : 0);
    return {
      name: opts.name || caveName(n), par: parPings, map: g.map(row => row.join("")), style, dark, goal, walk,
      songs: goal === "quiet" ? parPings + 2 : 0,
      time: goal === "race" ? Math.ceil(walk / 2.3 + 10 + doors * 3 + runes.length * 3 + g.flat().filter(c => "tnakwjgB".includes(c)).length * 2.5) : 0,
    };
  }
}
function critterSpots(g) {
  const out = {};
  g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "z") out[x + "," + y] = 1; }));
  return out;
}

const WAVE_SPEED = 8.5;   // tiles per second
const WAVE_RANGE = 7.5;   // tiles the song travels
const MEMORY = 0.13;      // how bright remembered walls stay
const TH = 0.55;          // where rock begins in the cave's shape field
const SWIM_MAX = 4.6;     // tiles per second at full stick
const SWIM_GRIP = 18;     // how quickly Lumi reaches the speed you ask for
const CURRENT_ACC = 14;
const STICK_SIZES = [36, 46, 60];
let STICK_R = 46;         // px the thumb travels for full speed (set from settings once loaded)
const STICK_DEAD = 5;
const DOOR_TIME = 5;
const LUMI_R = 0.3;
const CRITTER_R = 0.32;

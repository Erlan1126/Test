// Echo: the handmade caves, worlds and themes, and the level generator.
"use strict";

// ---------- Worlds ----------
// 50 worlds of 20 levels. The first 10 levels are handmade; the rest are built from a seed,
// so every player gets the same cave for the same level number.
// Eight worlds of twenty caves: fewer than before, but each one with a job of its own.

// ---------- The core: ten caves made by hand ----------
// Each one is built around one idea. R is an old ring stone: when a song reaches it, it rings
// out loud three times, and every Hushling that hears goes to it.
const CORE = true;
const CORE_LEVELS = [
  { name: "First Song", par: 4, theme: 0, hint: "first", map: [
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
  { name: "Fading Echoes", par: 10, theme: 0, hint: "Echoes don't last. Sing again when the walls fade, or remember the way", map: [
    "###########",
    "#E....#...#",
    "####..#.#.#",
    "#o#..##.#.#",
    "#.#.###.#.#",
    "#...#...#.#",
    "###.#.###.#",
    "#...#.#...#",
    "#.###.#.###",
    "#.#...#...#",
    "#.#.#####.#",
    "#...#o....#",
    "#####.#####",
    "#.....#...#",
    "#.###.#.#.#",
    "#...#...#.#",
    "###.#####S#",
    "###########",
  ]},
  { name: "Three Lights", par: 7, theme: 0, hint: "Three lights are hiding in here. Can you find them all?", map: [
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
  { name: "Something Listening", par: 6, theme: 1, hint: "Something is listening. It can't see you, it only hears. Sing, then slip away", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#.........#",
    "#.#######.#",
    "#.#.....#.#",
    "#.#..g..#.#",
    "#.#..o..#.#",
    "#.###.###.#",
    "#.........#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
    "###########",
  ]},
  { name: "The Ring Stone", par: 6, theme: 1, hint: "Something guards the way. Let your song reach the old ring stone, and it will call it away", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "####...####",
    "####.g.####",
    "####...####",
    "#####.#####",
    "##....#####",
    "##.########",
    "##.########",
    "##.######R#",
    "##.######.#",
    "##.######.#",
    "##o.......#",
    "##S########",
    "###########",
    "###########",
  ]},
  { name: "Tiptoe", par: 5, theme: 2, hint: "No way around them. Push the stick only a little to swim slowly: a slow light makes no sound", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "##......o##",
    "##.......##",
    "##.g...g.##",
    "##.......##",
    "##.......##",
    "##.g...g.##",
    "##.......##",
    "##o......##",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
  ]},
  { name: "The Hunter", par: 8, theme: 3, goal: "escape", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.#o#.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "####.S.####",
    "###########",
  ]},
  { name: "The Lost Moth", par: 9, theme: 5, goal: "rescue", map: [
    "###########",
    "#.E.##.m..#",
    "#...##....#",
    "##.###.####",
    "##.###.####",
    "##.###.g###",
    "##.###.####",
    "##.###.####",
    "##.###.####",
    "##.###..R##",
    "##.###.####",
    "##.###.####",
    "##.......##",
    "#####.#####",
    "####...####",
    "####.S.####",
    "###########",
    "###########",
  ]},
  { name: "The Deep Maze", par: 14, theme: 4, hint: "Three of them, two stones, and only your memory", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#####.#####",
    "#####.#####",
    "###..g..###",
    "#####.#####",
    "#R........#",
    "#.###.###.#",
    "#.#.....#.#",
    "#.#..g..#.#",
    "#.#.....#.#",
    "#.###.###.#",
    "#....R....#",
    "#.#######.#",
    "#.#.o.#...#",
    "#.#.#.#.#.#",
    "#...#...#.#",
    "#####.###.#",
    "#.g.....#.#",
    "#.#####.#.#",
    "#.........#",
    "#####.#####",
    "####.S.####",
    "###########",
  ]},
  { name: "The Great Hush", par: 8, theme: 7, map: [
    "###########",
    "####.E.####",
    "##.......##",
    "#.........#",
    "#....B....#",
    "#.........#",
    "##.......##",
    "####...####",
    "#####.#####",
    "##.......##",
    "##.g...g.##",
    "##.......##",
    "#####.#####",
    "#R.......R#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "###########",
  ]},
  // ---------- Act two: the long echo ----------
  // Pebbles from cave 11 on, and Lurkers (u): deaf, but they see Lumi's light. Sneaking makes the
  // light small; singing makes it big. M is a hidden memory.
  { name: "Pebble Path", par: 6, theme: 4, hint: "A guard in the hall. Throw a pebble along it, and while it looks, slip past", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#####.#####",
    "##...g...##",
    "##.#####.##",
    "##.#####.##",
    "##.......##",
    "#####.#####",
    "#M#.....#o#",
    "#.#.#.#.#.#",
    "#...#.#...#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
  ] },
  { name: "Two Guards", par: 7, theme: 4, hint: "Two guards, and pebbles to spare. Throw, wait, slip by", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "###..g..###",
    "#####.#####",
    "#o.......o#",
    "#####.#####",
    "#####.#####",
    "###..g..###",
    "#####.#####",
    "#.........#",
    "#.###.###.#",
    "#M#..S..#.#",
    "###########",
    "###########",
    "###########",
    "###########",
  ] },
  { name: "Something Watching", par: 6, theme: 5, hint: "This one has no ears. It sees light. Sneak, and your light grows small", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#####.#####",
    "#####.#####",
    "#####.#####",
    "###uo.#####",
    "#####.#####",
    "#####.#####",
    "#####.#####",
    "#####..u###",
    "#####.#####",
    "#M....#####",
    "#####.#####",
    "####.S.####",
    "####...####",
    "###########",
  ] },
  { name: "Light and Sound", par: 7, theme: 5, hint: "One hears, one sees. Don't sing where the eye can see you", map: [
    "###########",
    "#E.......u#",
    "#.#######.#",
    "#.#######.#",
    "#..g......#",
    "######.##.#",
    "######.##.#",
    "######.##.#",
    "######.#M.#",
    "#########.#",
    "#o........#",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
    "###########",
  ] },
  { name: "Moth in the Mines", par: 8, theme: 6, goal: "rescue", map: [
    "###########",
    "#m.##u##.E#",
    "#.###.###.#",
    "#.........#",
    "#####.#####",
    "#####.#####",
    "###..g..###",
    "#####.#####",
    "#.........#",
    "#.###.###.#",
    "#o#.....#M#",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
  ] },
  { name: "Cave-in", par: 9, theme: 3, goal: "escape", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "###.....###",
    "##o.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.M##",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.###",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "###.....###",
    "###.###.o##",
    "###.###.###",
    "###.....###",
    "#####.#####",
    "####.S.####",
    "###########",
    "###########",
    "###########",
    "###########",
  ] },
  { name: "The Choir", par: 7, theme: 2, hint: "Five of them. Thread between them, or call them away with the stones", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#R...o...R#",
    "#.........#",
    "#.g.....g.#",
    "#.........#",
    "#....g....#",
    "#.........#",
    "#.g.....g.#",
    "#.........#",
    "#####.#####",
    "#M.....####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
  ] },
  { name: "Sightlines", par: 6, theme: 6, hint: "Every crossing is watched. Small light, slow swim", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "###u...u###",
    "#####.#####",
    "#####.#####",
    "###u...u###",
    "#####.#####",
    "#o.......M#",
    "#####.#####",
    "###u...u###",
    "#####.#####",
    "####...####",
    "####.S.####",
    "####...####",
    "###########",
    "###########",
  ] },
  { name: "Everything Below", par: 14, theme: 3, hint: "Everything you've learned, all the way up", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "###u...u###",
    "#####.#####",
    "#R...g...R#",
    "#.###.###.#",
    "#.........#",
    "#####.#####",
    "#.........#",
    "#.###.###.#",
    "#.#..g..#.#",
    "#.#..o..#.#",
    "#.###.###.#",
    "#.......M.#",
    "#####.#####",
    "#u........#",
    "#########.#",
    "#o........#",
    "#.#######.#",
    "#.g.......#",
    "#####.#####",
    "####.S.####",
    "###########",
    "###########",
  ] },
  { name: "Sing Them Home", par: 10, theme: 7, healAll: true, hint: "The last lost Hushlings. Hold to sing close to each one, and bring them all home", map: [
    "###########",
    "####.E.####",
    "####...####",
    "#####.#####",
    "#.........#",
    "#.g.#.#.g.#",
    "#...#.#...#",
    "##.##.##.##",
    "#....u....#",
    "#.###.###.#",
    "#.#.....#.#",
    "#.#.g.g.#.#",
    "#.#.....#.#",
    "#.###.###.#",
    "#....M....#",
    "#####.#####",
    "####.S.####",
    "###########",
  ] },
];
// A hidden memory (M) in each of the first ten caves too.
const markTile = (map, x, y, ch) => map.map((r, j) => (j === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));
[[0, 6, 9], [1, 3, 16], [2, 1, 16], [3, 3, 6], [4, 9, 12], [5, 2, 4], [6, 2, 16], [7, 1, 2], [8, 8, 16], [9, 2, 2]]
  .forEach(([i, x, y]) => { CORE_LEVELS[i] = Object.assign({}, CORE_LEVELS[i], { map: markTile(CORE_LEVELS[i].map, x, y, "M") }); });
// Each act is a "world" of ten caves.
const PER_WORLD = CORE ? 10 : 20, WORLDS = CORE ? CORE_LEVELS.length / 10 : 8, TOTAL = PER_WORLD * WORLDS;
const ACT_NAMES = ["The Last Song", "The Long Echo"];
// What Lumi remembers, one memory hidden in each cave.
const MEMORIES = [
  "A voice, humming. Something enormous, holding something very small.",
  "“Count the echoes, little light. Every wall is a word.”",
  "Little lights asleep in a row, and a big warm shadow keeping watch.",
  "The first Hushling was a tear. It fell from very high up and never stopped looking.",
  "The Singer tuned the ring stones, one for every street, so no one would ever get lost.",
  "“Quiet now. Swim like a feather. The dark is only sleeping.”",
  "The night of the flood, the water was so loud nobody heard a little voice calling.",
  "A moth once followed Lumi all the way home. Moths always know the way to the light.",
  "The Singer carved the maze for the little ones, to play hide and seek in.",
  "“You came back.” Three words, waited for a hundred years.",
  "Not every shadow was a tear. Some were already down here, long before the song.",
  "Pebbles in a pocket: the Singer's old game. Throw one, and the dark looks the other way.",
  "Lurkers have no ears at all. They drink light, and they are always thirsty.",
  "Sound for the Hushlings, light for the Lurkers. Be quiet, and be small.",
  "Down in the mines, a lantern still remembers whose hand held it.",
  "The deep caves fall in on themselves when something old wakes up.",
  "The Choir: every Hushling used to sing together, before they forgot the words.",
  "In the dark, a Lurker's eye looks like a friendly star. It isn't.",
  "The last of them cry the loudest, because they have waited the longest.",
  "Somebody's always listening. Now it's Lumi's turn to sing them home.",
];
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
const themeIndex = i => (CORE && i >= 0 && i < TOTAL ? CORE_LEVELS[i].theme : (i === WEEKLY ? weekNumber() + 3 : i < 0 ? dayNumber() : worldOf(i))) % THEMES.length;
const themeOf = i => THEMES[themeIndex(i)];
// Energy and Hushlings get gently harder with depth; the daily cave sits in the middle.
const depthOf = i => (i === WEEKLY ? 0.8 : i < 0 ? 0.5 : Math.min(1, Math.max(0, 0.1 + (i - 19) / 160)));
const worldName = w => (CORE && w < ACT_NAMES.length ? ACT_NAMES[w] : THEMES[w % THEMES.length].name + ROMAN[Math.floor(w / THEMES.length)]);

// ---------- Daily and weekly caves ----------
// Built from handmade rooms, five rows each, stacked between the portal and the start. Each
// room is one small idea under the same rules as the story caves; rooms join through the
// middle column, and a room may be mirrored. The same seed gives everyone the same cave.
const ROOMS = [
  ["##...g...##", "##.#####.##", "##.#####.##", "##...o...##", "#####.#####"],   // a guard in the hall: pebble it away
  ["####...####", "####.g.####", "####...####", "#R.......o#", "#####.#####"],   // a guard, and a stone to call it
  ["#####.#####", "###u...u###", "#####.#####", "#o.......o#", "#####.#####"],   // a crossing two Lurkers watch
  ["#.........#", "#.g.....g.#", "#....o....#", "#.........#", "#####.#####"],   // two Hushlings: thread between them
  ["#####.#####", "#####..u###", "###u..#####", "#####.#####", "#####.#####"],   // a crooked corridor, watched
  ["#####.#####", "#.........#", "#.###g###.#", "#....o....#", "#####.#####"],   // a guard in the middle: go round
  ["#####.#####", "####...####", "#g...o...g#", "####...####", "#####.#####"],   // a light between two
];
function buildCave(seed, rooms, name) {
  const r = seeded(seed), order = [];
  let bag = [];
  while (order.length < rooms) { if (!bag.length) bag = ROOMS.map((_, k) => k); order.push(bag.splice(Math.floor(r() * bag.length), 1)[0]); }
  const map = ["###########", "####.E.####", "####...####"];
  for (const k of order) { map.push("#####.#####"); map.push(...(r() < 0.5 ? ROOMS[k] : ROOMS[k].map(row => [...row].reverse().join("")))); }
  map.push("#####.#####", "####.S.####", "####...####", "###########");
  // How long the swim is, start to portal (twists such as a timer use it).
  const at = ch => { const y = map.findIndex(row => row.includes(ch)); return [map[y].indexOf(ch), y]; };
  const [sx, sy] = at("S"), [ex, ey] = at("E"), dist = new Map([[sx + "," + sy, 0]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (map[ny][nx] === "#" || dist.has(nx + "," + ny)) continue;
      dist.set(nx + "," + ny, dist.get(x + "," + y) + 1); q.push([nx, ny]);
    }
  }
  return { name, par: 4 + rooms * 2, map, walk: dist.get(ex + "," + ey) || 30 };
}

const levelCache = new Map();
function getLevel(i) {
  if (i === WEEKLY) {
    const key = "weekly" + weekNumber();
    if (!levelCache.has(key)) levelCache.set(key, buildCave(90000 + weekNumber() * 17, 5, "Weekly Cave"));
    return levelCache.get(key);
  }
  if (i === DAILY) {
    const day = dayNumber(), key = "daily" + day;
    if (!levelCache.has(key)) levelCache.set(key, applyTwist(buildCave(50000 + day * 13, 4, "Daily Cave"), day));
    return levelCache.get(key);
  }
  return CORE_LEVELS[i];
}

function seeded(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const isFinale = n => n % PER_WORLD === PER_WORLD - 1;

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

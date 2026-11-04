// Tower skins and the facade looks used to draw buildings.

/** How a building's walls are drawn. */
export interface Look {
  /** ribbon: continuous glass bands with mullions. punched: individual framed windows. */
  kind: "ribbon" | "punched";
  glass: string;
  frame: string;
  slab: string;
  slabH: number;
  lit: string[];
  /** Glowing floor-edge trim. */
  neon?: boolean;
  /** Windows lit even in daylight. */
  alwaysLit?: boolean;
}

export type SkinUnlock =
  /** Free once your best tower passes MILESTONES[at]. */
  | { at: number }
  /** Bought in the shop with stars. */
  | { price: number }
  /** Earned by keeping a play streak this many days. */
  | { streak: number }
  /** A premium skin, unlocked by buying the named product. */
  | { product: string }
  /** A Sky Pass reward from the named season theme. */
  | { pass: string };

export interface Skin extends Look {
  id: string;
  name: string;
  floors: string[];
  /** Colors for the little swatch, if the floor colors don't say enough. */
  swatch?: string[];
  /** No unlock means free from the start. */
  unlock?: SkinUnlock;
}

export const SKINS: Skin[] = [
  { id: "glass", name: "Glass Tower", kind: "ribbon",
    floors: ["#3f7fe0", "#2f9fd6", "#4a6ee0", "#25aec4", "#5b8ff0"],
    glass: "#7fc2f0", frame: "#eef6ff", slab: "#dfe9f7", slabH: 0.1, lit: ["#ffe7a1", "#fff3cf"] },
  { id: "brick", name: "Brick Block", unlock: { at: 0 }, kind: "punched",
    floors: ["#b8543f", "#c4624a", "#ad4b3a", "#bf5c45"],
    glass: "#35507a", frame: "#f4efe6", slab: "#e9dfd0", slabH: 0.12, lit: ["#ffd8a0", "#ffe9b8"] },
  { id: "ocean", name: "Ocean Breeze", unlock: { at: 1 }, kind: "ribbon",
    floors: ["#14a39a", "#22b8b0", "#0f8fa8", "#3cc6d8"],
    glass: "#b9f3ff", frame: "#ffffff", slab: "#e6fbfc", slabH: 0.12, lit: ["#fff4c2", "#d7fbff"] },
  { id: "candy", name: "Candy Tower", unlock: { at: 2 }, kind: "punched",
    floors: ["#ff9ec7", "#8fe3c0", "#ffc29e", "#b5b0ff", "#9fd8ff"],
    glass: "#ffffff", frame: "#ffffff", slab: "#ffffff", slabH: 0.18, lit: ["#fff1a8", "#ffd6ec"] },
  { id: "desert", name: "Desert Sandstone", unlock: { at: 3 }, kind: "punched",
    floors: ["#d9a066", "#e2b47c", "#cc9258", "#dcaa70"],
    glass: "#4a3326", frame: "#f6e6cc", slab: "#c48850", slabH: 0.16, lit: ["#ffcf7a", "#ffe2a8"] },
  { id: "retro", name: "Retro Future", unlock: { at: 4 }, kind: "ribbon",
    floors: ["#f4a261", "#e9c46a", "#2a9d8f", "#e76f51"],
    glass: "#264653", frame: "#fefae0", slab: "#fefae0", slabH: 0.14, lit: ["#fefae0", "#ffd6a0"] },
  { id: "bridge", name: "Bridge Red", unlock: { at: 5 }, kind: "punched",
    floors: ["#c0362c", "#cf4630", "#b32d25", "#d25235"],
    glass: "#2f3b4d", frame: "#ffe0d0", slab: "#8f241d", slabH: 0.14, lit: ["#ffd29a", "#ffe8c4"] },
  { id: "neon", name: "Neon Nights", unlock: { at: 6 }, kind: "ribbon", neon: true,
    floors: ["#241d48", "#2b2256", "#1e1940"],
    glass: "#151231", frame: "#3a3170", slab: "#120f28", slabH: 0.08,
    lit: ["#ff4fd8", "#3bf0ff", "#b6ff3b", "#ffb13b"], alwaysLit: true, swatch: ["#ff4fd8", "#3bf0ff", "#b6ff3b"] },
  { id: "deco", name: "Art Deco", unlock: { at: 7 }, kind: "punched",
    floors: ["#1d1d24", "#26262f", "#1a1a21"],
    glass: "#34343f", frame: "#d4af37", slab: "#d4af37", slabH: 0.14, lit: ["#ffd877", "#fff0c0"],
    swatch: ["#1d1d24", "#d4af37", "#26262f"] },
  { id: "diamond", name: "Diamond Spire", unlock: { at: 8 }, kind: "ribbon",
    floors: ["#e4ebf5", "#cfdcef", "#f2f6fb", "#d9e4f3"],
    glass: "#9cc4ff", frame: "#ffffff", slab: "#ffffff", slabH: 0.12, lit: ["#ffffff", "#e3f0ff"] },
  // Streak skins, earned by playing day after day.
  { id: "ember", name: "Ember", unlock: { streak: 7 }, kind: "ribbon",
    floors: ["#5a1a12", "#6e2214", "#4a150f"],
    glass: "#2a0d08", frame: "#ff7a3d", slab: "#3a100a", slabH: 0.1, neon: true,
    lit: ["#ff7a3d", "#ffb13b", "#ff4f4f"], alwaysLit: true, swatch: ["#5a1a12", "#ff7a3d", "#ffb13b"] },
  { id: "gilded", name: "Gilded", unlock: { streak: 30 }, kind: "punched",
    floors: ["#f2c94c", "#e8b923", "#f7d774"],
    glass: "#3b2a05", frame: "#fff3c4", slab: "#c99a14", slabH: 0.16, lit: ["#fff1b0", "#ffffff"],
    swatch: ["#f2c94c", "#fff3c4", "#c99a14"] },
  // Premium skins, bought with real money.
  { id: "crystal", name: "Crystal Palace", unlock: { product: "skin_crystal" }, kind: "ribbon",
    floors: ["#bfe9ff", "#d9f4ff", "#a8ddff", "#e8f9ff"],
    glass: "#e6f9ff", frame: "#ffffff", slab: "#ffffff", slabH: 0.1, lit: ["#e8fbff", "#b8f0ff", "#ffffff"], alwaysLit: true,
    swatch: ["#bfe9ff", "#ffffff", "#7fd3ff"] },
  { id: "sakura", name: "Sakura Spire", unlock: { product: "skin_sakura" }, kind: "punched",
    floors: ["#f7b6cc", "#fbc8d8", "#f2a3bd", "#fdd6e2"],
    glass: "#5a2a3a", frame: "#fff7fa", slab: "#c95f86", slabH: 0.14, lit: ["#ffd3a0", "#ffe7c4", "#ffb8c8"],
    swatch: ["#f7b6cc", "#fff7fa", "#c95f86"] },
  { id: "royal", name: "Royal Amethyst", unlock: { product: "skin_royal" }, kind: "punched",
    floors: ["#4b2a7a", "#5a3290", "#42246c"],
    glass: "#1e1236", frame: "#e7c25a", slab: "#e7c25a", slabH: 0.14, lit: ["#ffe08a", "#fff3c4"],
    swatch: ["#4b2a7a", "#e7c25a", "#5a3290"] },
  { id: "cyber", name: "Cyber City", unlock: { product: "skin_cyber" }, kind: "ribbon", neon: true,
    floors: ["#0d0f1c", "#121528", "#0a0c16"],
    glass: "#080a14", frame: "#1d2a4a", slab: "#05060c", slabH: 0.08,
    lit: ["#00f0ff", "#ff2bd6", "#7cff4f"], alwaysLit: true, swatch: ["#0d0f1c", "#00f0ff", "#ff2bd6"] },
  // Shop skins, bought with stars.
  { id: "starlight", name: "Starlight", unlock: { price: 10 }, kind: "ribbon",
    floors: ["#1b2a5e", "#22336e", "#182553"],
    glass: "#0e1740", frame: "#6f86d6", slab: "#2b3d80", slabH: 0.1,
    lit: ["#ffffff", "#bcd4ff", "#ffe9a8"], alwaysLit: true, swatch: ["#1b2a5e", "#bcd4ff", "#ffe9a8"] },
  { id: "rainbow", name: "Rainbow Rise", unlock: { price: 25 }, kind: "ribbon",
    floors: ["#ff6b6b", "#ff922b", "#51cf66", "#339af0", "#845ef7", "#f06595"],
    glass: "#eaf6ff", frame: "#ffffff", slab: "#ffffff", slabH: 0.12, lit: ["#fff4c2", "#ffe0f0"] },
  { id: "aurora", name: "Aurora", unlock: { price: 50 }, kind: "ribbon", neon: true,
    floors: ["#0b3d3a", "#0f4f4a", "#0a3431"],
    glass: "#0a2624", frame: "#1d6b62", slab: "#08201e", slabH: 0.08,
    lit: ["#3ee6c4", "#7cf5ff", "#b48cff"], alwaysLit: true, swatch: ["#0b3d3a", "#3ee6c4", "#b48cff"] },
];

// Sky Pass skins, three per season theme (see data/pass.ts).
SKINS.push(
  // Golden Hour
  { id: "sunset", name: "Sunset Glass", unlock: { pass: "Golden Hour" }, kind: "ribbon",
    floors: ["#ff8a5c", "#ff9f6e", "#f7744d", "#ffb07f"],
    glass: "#ffd2a8", frame: "#fff3e6", slab: "#e86a45", slabH: 0.1, lit: ["#fff1c4", "#ffe0a8"], swatch: ["#ff8a5c", "#ffd2a8", "#fff3e6"] },
  { id: "copper", name: "Copper Crown", unlock: { pass: "Golden Hour" }, kind: "punched",
    floors: ["#b5653a", "#c27448", "#a65a32"],
    glass: "#2e1c14", frame: "#f0c9a0", slab: "#7a3f22", slabH: 0.16, lit: ["#ffc98a", "#ffe2b8"], swatch: ["#b5653a", "#f0c9a0", "#7a3f22"] },
  { id: "goldenhour", name: "Golden Hour", unlock: { pass: "Golden Hour" }, kind: "ribbon", neon: true,
    floors: ["#3b1f12", "#47261a", "#33190e"],
    glass: "#1f0f08", frame: "#ffb347", slab: "#2a140a", slabH: 0.08, lit: ["#ffd36b", "#ff9f43", "#fff1b0"], alwaysLit: true,
    swatch: ["#3b1f12", "#ffb347", "#ffd36b"] },
  // Frostbite
  { id: "glacier", name: "Glacier", unlock: { pass: "Frostbite" }, kind: "ribbon",
    floors: ["#9ed8f5", "#b6e4fa", "#86cbee", "#cdeefd"],
    glass: "#e8f8ff", frame: "#ffffff", slab: "#6fb6dd", slabH: 0.12, lit: ["#ffffff", "#d6f3ff"], swatch: ["#9ed8f5", "#ffffff", "#6fb6dd"] },
  { id: "snowdrift", name: "Snowdrift", unlock: { pass: "Frostbite" }, kind: "punched",
    floors: ["#eef3f8", "#e2eaf2", "#f6f9fc"],
    glass: "#4b6a88", frame: "#ffffff", slab: "#c7d6e6", slabH: 0.2, lit: ["#ffe6a8", "#fff3d1"], swatch: ["#eef3f8", "#4b6a88", "#c7d6e6"] },
  { id: "frostqueen", name: "Frost Queen", unlock: { pass: "Frostbite" }, kind: "ribbon", neon: true,
    floors: ["#13203f", "#182850", "#101a35"],
    glass: "#0b1430", frame: "#8fd8ff", slab: "#0a1228", slabH: 0.08, lit: ["#bdf0ff", "#8fd8ff", "#e2d4ff"], alwaysLit: true,
    swatch: ["#13203f", "#8fd8ff", "#e2d4ff"] },
  // Neon Carnival
  { id: "arcade", name: "Arcade", unlock: { pass: "Neon Carnival" }, kind: "punched", neon: true,
    floors: ["#2a1450", "#341a63", "#22103f"],
    glass: "#140a2a", frame: "#ff5fd2", slab: "#1a0c33", slabH: 0.1, lit: ["#ff5fd2", "#ffe14f", "#4ff0ff"], alwaysLit: true,
    swatch: ["#2a1450", "#ff5fd2", "#ffe14f"] },
  { id: "carnival", name: "Carnival", unlock: { pass: "Neon Carnival" }, kind: "punched",
    floors: ["#e63946", "#ffffff", "#e63946", "#ffd166"],
    glass: "#1d3557", frame: "#ffffff", slab: "#f1faee", slabH: 0.14, lit: ["#ffd166", "#fff3c4"], swatch: ["#e63946", "#ffffff", "#ffd166"] },
  { id: "hyperdrive", name: "Hyperdrive", unlock: { pass: "Neon Carnival" }, kind: "ribbon", neon: true,
    floors: ["#07070f", "#0c0c1a", "#05050b"],
    glass: "#04040a", frame: "#7c4dff", slab: "#030308", slabH: 0.06, lit: ["#ff5fd2", "#7c4dff", "#4ff0ff", "#ffe14f"], alwaysLit: true,
    swatch: ["#07070f", "#7c4dff", "#ff5fd2"] },
  // Jungle Temple
  { id: "jade", name: "Jade", unlock: { pass: "Jungle Temple" }, kind: "ribbon",
    floors: ["#2f9e6e", "#38b07c", "#278a5f"],
    glass: "#c9f2dc", frame: "#eafff2", slab: "#1d6e4b", slabH: 0.12, lit: ["#fff4c2", "#d9ffe8"], swatch: ["#2f9e6e", "#c9f2dc", "#1d6e4b"] },
  { id: "mossy", name: "Mossy Stone", unlock: { pass: "Jungle Temple" }, kind: "punched",
    floors: ["#7d8a6a", "#8b9877", "#6f7c5d"],
    glass: "#2b3324", frame: "#c9d6a8", slab: "#55603f", slabH: 0.18, lit: ["#ffd98a", "#ffecc0"], swatch: ["#7d8a6a", "#c9d6a8", "#55603f"] },
  { id: "idol", name: "Emerald Idol", unlock: { pass: "Jungle Temple" }, kind: "punched", neon: true,
    floors: ["#0f3b2a", "#134833", "#0b2f21"],
    glass: "#082319", frame: "#ffd23f", slab: "#0a281c", slabH: 0.12, lit: ["#5fd18b", "#ffd23f", "#b8ffd8"], alwaysLit: true,
    swatch: ["#0f3b2a", "#ffd23f", "#5fd18b"] },
  // Spring Bloom
  { id: "bloom", name: "Bloom", unlock: { pass: "Spring Bloom" }, kind: "ribbon",
    floors: ["#ffc9de", "#c9f0d8", "#ffd9ea", "#d8f5e4"],
    glass: "#fff6fa", frame: "#ffffff", slab: "#f49ac1", slabH: 0.12, lit: ["#fff3c4", "#ffe0ee"], swatch: ["#ffc9de", "#c9f0d8", "#f49ac1"] },
  { id: "tulip", name: "Tulip Row", unlock: { pass: "Spring Bloom" }, kind: "punched",
    floors: ["#e5484d", "#f5b83d", "#e5484d", "#ff8a65"],
    glass: "#3a2533", frame: "#fff8e8", slab: "#4e8a3e", slabH: 0.16, lit: ["#ffe6a0", "#fff4d6"], swatch: ["#e5484d", "#f5b83d", "#4e8a3e"] },
  { id: "eden", name: "Eden", unlock: { pass: "Spring Bloom" }, kind: "ribbon", neon: true,
    floors: ["#123a2a", "#174733", "#0e3022"],
    glass: "#0b2419", frame: "#ff9fcf", slab: "#0a2017", slabH: 0.08, lit: ["#ff9fcf", "#b8ffcf", "#fff1a8"], alwaysLit: true,
    swatch: ["#123a2a", "#ff9fcf", "#b8ffcf"] },
  // Deep Sea
  { id: "tide", name: "Tide", unlock: { pass: "Deep Sea" }, kind: "ribbon",
    floors: ["#1d8fa6", "#25a3b8", "#177d92", "#2fb6c6"],
    glass: "#bff5ff", frame: "#e8fdff", slab: "#0f5f72", slabH: 0.1, lit: ["#e8ffff", "#b8f3ff"], swatch: ["#1d8fa6", "#bff5ff", "#0f5f72"] },
  { id: "coral", name: "Coral Reef", unlock: { pass: "Deep Sea" }, kind: "punched",
    floors: ["#ff7f6a", "#ff9479", "#f2695a", "#ffa98f"],
    glass: "#1f3d4d", frame: "#fff1ea", slab: "#d9534f", slabH: 0.16, lit: ["#ffe3a8", "#fff0d2"], swatch: ["#ff7f6a", "#fff1ea", "#1f3d4d"] },
  { id: "abyss", name: "Abyss", unlock: { pass: "Deep Sea" }, kind: "ribbon", neon: true,
    floors: ["#04182a", "#062036", "#031321"],
    glass: "#020c16", frame: "#3fd6d0", slab: "#020a12", slabH: 0.06, lit: ["#3fd6d0", "#7cf2ff", "#c08cff"], alwaysLit: true,
    swatch: ["#04182a", "#3fd6d0", "#c08cff"] },
  // Desert Mirage
  { id: "oasis", name: "Oasis", unlock: { pass: "Desert Mirage" }, kind: "ribbon",
    floors: ["#2fb5a5", "#e8c98f", "#38c2b1", "#f0d6a2"],
    glass: "#d8fff7", frame: "#fffaf0", slab: "#c9a465", slabH: 0.12, lit: ["#fff1c4", "#e0fff8"], swatch: ["#2fb5a5", "#e8c98f", "#c9a465"] },
  { id: "dune", name: "Dune", unlock: { pass: "Desert Mirage" }, kind: "punched",
    floors: ["#d9b27c", "#e3c08e", "#cfa46e"],
    glass: "#4a3423", frame: "#f7e8cf", slab: "#b88a52", slabH: 0.2, lit: ["#ffcf7a", "#ffe6b0"], swatch: ["#d9b27c", "#f7e8cf", "#b88a52"] },
  { id: "pharaoh", name: "Pharaoh", unlock: { pass: "Desert Mirage" }, kind: "punched", neon: true,
    floors: ["#1b1a2e", "#22203a", "#161526"],
    glass: "#0e0d1c", frame: "#f2c46b", slab: "#f2c46b", slabH: 0.14, lit: ["#f2c46b", "#3fd6d0", "#fff1b0"], alwaysLit: true,
    swatch: ["#1b1a2e", "#f2c46b", "#3fd6d0"] },
  // Cosmic Voyage
  { id: "nebula", name: "Nebula", unlock: { pass: "Cosmic Voyage" }, kind: "ribbon",
    floors: ["#5b3fa8", "#7a4cc2", "#4b3290", "#8f5ad1"],
    glass: "#e6d9ff", frame: "#f4eeff", slab: "#2f2163", slabH: 0.1, lit: ["#ffd6f5", "#d9e6ff"], swatch: ["#5b3fa8", "#e6d9ff", "#ff8ad8"] },
  { id: "comet", name: "Comet", unlock: { pass: "Cosmic Voyage" }, kind: "punched",
    floors: ["#c9d1e3", "#d7deec", "#bcc5da"],
    glass: "#253049", frame: "#ffffff", slab: "#8d98b3", slabH: 0.14, lit: ["#bfe3ff", "#ffffff"], swatch: ["#c9d1e3", "#253049", "#bfe3ff"] },
  { id: "galaxy", name: "Galaxy", unlock: { pass: "Cosmic Voyage" }, kind: "ribbon", neon: true,
    floors: ["#0b0820", "#110c2e", "#080617"],
    glass: "#05040f", frame: "#b48cff", slab: "#04030c", slabH: 0.06, lit: ["#b48cff", "#ff8ad8", "#7cf2ff", "#fff1a8"], alwaysLit: true,
    swatch: ["#0b0820", "#b48cff", "#ff8ad8"] },
);

export const skinById = (id: string): Skin => SKINS.find(s => s.id === id) ?? SKINS[0];

/** The neighbors on the island. */
export const NEIGHBOR_LOOK: Look = { kind: "punched", glass: "#7f9cc4", frame: "#ffffff", slab: "#d9d3c7", slabH: 0.1, lit: ["#ffe7a1"] };

/** Special floors draw in their own colors whatever the skin. */
export const SPECIAL_COLORS = {
  gold: "#ffd23f",
  ice: "#a6e4ff",
  garden: "#6fbf5a",
} as const;

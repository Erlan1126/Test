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
  | { streak: number };

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

export const skinById = (id: string): Skin => SKINS.find(s => s.id === id) ?? SKINS[0];

/** The neighbors on the island. */
export const NEIGHBOR_LOOK: Look = { kind: "punched", glass: "#7f9cc4", frame: "#ffffff", slab: "#d9d3c7", slabH: 0.1, lit: ["#ffe7a1"] };

/** Special floors draw in their own colors whatever the skin. */
export const SPECIAL_COLORS = {
  gold: "#ffd23f",
  ice: "#a6e4ff",
  garden: "#6fbf5a",
} as const;

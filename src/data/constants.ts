// Core tuning. Gameplay is measured in world units, not pixels, so it plays the same on
// every screen.
export const BLOCK_SIZE = 10;       // starting width and depth of a floor
export const RANGE = 13;            // how far the sliding floor travels from the tower's center
export const PERFECT = 0.35;        // smallest forgiveness for a perfect drop, in world units
export const PERFECT_TIME = 0.045;  // ...which grows with speed so it always covers about 45 ms of movement
export const GROW = 0.6;            // how much a floor grows back during a perfect streak
export const METERS_PER_FLOOR = 5;
export const PEOPLE_PER_AREA = 0.2; // a full 10 x 10 floor holds 20 people
export const WIND_START = 25;       // floor where gusts begin
export const ISLAND = 22;           // half-size of the floating island

export const GOLD = "#ffd23f";      // reserved for penthouse floors

export interface Milestone {
  m: number;
  name: string;
}

export const MILESTONES: Milestone[] = [
  { m: 15, name: "a house" },
  { m: 51, name: "Niagara Falls" },
  { m: 93, name: "the Statue of Liberty" },
  { m: 139, name: "the Great Pyramid" },
  { m: 184, name: "the Space Needle" },
  { m: 227, name: "the Golden Gate Bridge" },
  { m: 330, name: "the Eiffel Tower" },
  { m: 443, name: "the Empire State Building" },
  { m: 828, name: "the Burj Khalifa" },
];

/** Sky colors (top, bottom) by tower height in floors: day, sunset, dusk, night. */
export const SKY = [
  { at: 0, top: "#3d9be0", bottom: "#bfe8fb" },
  { at: 22, top: "#4f7fd6", bottom: "#ffe0b0" },
  { at: 42, top: "#5a3f93", bottom: "#ff9468" },
  { at: 62, top: "#22195a", bottom: "#8a3f78" },
  { at: 90, top: "#060a1e", bottom: "#1b1f50" },
];

/** Each island's own sky through the same climb (same heights as SKY): a cold, clear sky
 *  over the snow, a hot one over the desert, a pink dawn over the cherry trees... */
export const ISLAND_SKIES: Record<string, { top: string; bottom: string }[]> = {
  snow: [
    { top: "#7fb2e8", bottom: "#eef6ff" }, { top: "#8aa6d8", bottom: "#ffe6dc" }, { top: "#5b6aa8", bottom: "#c9b6e6" },
    { top: "#202b5e", bottom: "#5f86c4" }, { top: "#070c24", bottom: "#1d3560" },
  ],
  desert: [
    { top: "#2f8fe6", bottom: "#ffe3ad" }, { top: "#4f72cc", bottom: "#ffbf73" }, { top: "#6a3f86", bottom: "#ff7a45" },
    { top: "#2a1a50", bottom: "#a8486a" }, { top: "#0b0a22", bottom: "#3a2340" },
  ],
  blossom: [
    { top: "#8fa8ee", bottom: "#ffe0ee" }, { top: "#a08ee0", bottom: "#ffc2d9" }, { top: "#6b4fa0", bottom: "#ff9cb8" },
    { top: "#2e2266", bottom: "#a2508a" }, { top: "#0b0a26", bottom: "#3a2252" },
  ],
  volcano: [
    { top: "#5a4a7a", bottom: "#ffb48a" }, { top: "#4a2a5a", bottom: "#ff8a5a" }, { top: "#3a1a40", bottom: "#ff5a3a" },
    { top: "#1e0f2a", bottom: "#a0302a" }, { top: "#08060f", bottom: "#4a1414" },
  ],
  candy: [
    { top: "#9fd8ff", bottom: "#ffe0f4" }, { top: "#b8b0ff", bottom: "#ffd0ea" }, { top: "#9a7ae6", bottom: "#ffb0d8" },
    { top: "#4a3a9a", bottom: "#e080c0" }, { top: "#1a1648", bottom: "#6a3a90" },
  ],
};

export const DISPLAY_FONT = '"Bungee", Impact, "Arial Black", sans-serif';
export const NUM_FONT = '"Lilita One", "Arial Black", sans-serif';
export const UI_FONT = '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';

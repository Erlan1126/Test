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
  /** Stable id (saves store postcards by it, so the list can grow). */
  id: string;
  m: number;
  name: string;
}

/** Real landmarks by height, each passed as your tower climbs. Saves refer to them by id. */
export const MILESTONES: Milestone[] = [
  { id: "house", m: 15, name: "a house" },
  { id: "niagara", m: 51, name: "Niagara Falls" },
  { id: "pisa", m: 57, name: "the Leaning Tower of Pisa" },
  { id: "taj", m: 73, name: "the Taj Mahal" },
  { id: "liberty", m: 93, name: "the Statue of Liberty" },
  { id: "bigben", m: 96, name: "Big Ben" },
  { id: "pyramid", m: 139, name: "the Great Pyramid" },
  { id: "needle", m: 184, name: "the Space Needle" },
  { id: "goldengate", m: 227, name: "the Golden Gate Bridge" },
  { id: "eiffel", m: 330, name: "the Eiffel Tower" },
  { id: "empire", m: 443, name: "the Empire State Building" },
  { id: "taipei", m: 508, name: "Taipei 101" },
  { id: "cntower", m: 553, name: "the CN Tower" },
  { id: "skytree", m: 634, name: "the Tokyo Skytree" },
  { id: "merdeka", m: 679, name: "Merdeka 118" },
  { id: "burj", m: 828, name: "the Burj Khalifa" },
  { id: "jeddah", m: 1000, name: "the Jeddah Tower" },
];

/** A landmark's place in MILESTONES by id. */
export const msAt = (id: string): number => MILESTONES.findIndex(m => m.id === id);

/** Sky colors (top, bottom) by tower height in floors: day, sunset, dusk, night. */
export const SKY = [
  { at: 0, top: "#3d9be0", bottom: "#bfe8fb" },
  { at: 22, top: "#4f7fd6", bottom: "#ffe0b0" },
  { at: 42, top: "#5a3f93", bottom: "#ff9468" },
  { at: 62, top: "#2c2a7a", bottom: "#9a4f8c" },
  { at: 90, top: "#1c2a6e", bottom: "#4458a8" },
];

/** Each island's own sky through the same climb (same heights as SKY): a cold, clear sky
 *  over the snow, a hot one over the desert, a pink dawn over the cherry trees... */
export const ISLAND_SKIES: Record<string, { top: string; bottom: string }[]> = {
  snow: [
    { top: "#7fb2e8", bottom: "#eef6ff" }, { top: "#8aa6d8", bottom: "#ffe6dc" }, { top: "#5b6aa8", bottom: "#c9b6e6" },
    { top: "#2a3a80", bottom: "#6f96d4" }, { top: "#1a2c70", bottom: "#4a6cb0" },
  ],
  desert: [
    { top: "#2f8fe6", bottom: "#ffe3ad" }, { top: "#4f72cc", bottom: "#ffbf73" }, { top: "#6a3f86", bottom: "#ff7a45" },
    { top: "#36256e", bottom: "#b4587a" }, { top: "#262470", bottom: "#5e4486" },
  ],
  blossom: [
    { top: "#8fa8ee", bottom: "#ffe0ee" }, { top: "#a08ee0", bottom: "#ffc2d9" }, { top: "#6b4fa0", bottom: "#ff9cb8" },
    { top: "#3a2e80", bottom: "#b2609a" }, { top: "#272672", bottom: "#64489a" },
  ],
  volcano: [
    { top: "#5a4a7a", bottom: "#ffb48a" }, { top: "#4a2a5a", bottom: "#ff8a5a" }, { top: "#3a1a40", bottom: "#ff5a3a" },
    { top: "#2e1a46", bottom: "#b0403a" }, { top: "#221a4a", bottom: "#6a2a2e" },
  ],
  candy: [
    { top: "#9fd8ff", bottom: "#ffe0f4" }, { top: "#b8b0ff", bottom: "#ffd0ea" }, { top: "#9a7ae6", bottom: "#ffb0d8" },
    { top: "#5446aa", bottom: "#e890c8" }, { top: "#2e2a78", bottom: "#7a4aa6" },
  ],
};

export const DISPLAY_FONT = '"Bungee", Impact, "Arial Black", sans-serif';
export const NUM_FONT = '"Lilita One", "Arial Black", sans-serif';
export const UI_FONT = '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';

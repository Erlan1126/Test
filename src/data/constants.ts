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
export const ISLAND = 17;           // half-size of the floating island

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

export const DISPLAY_FONT = '"Bungee", Impact, "Arial Black", sans-serif';
export const NUM_FONT = '"Lilita One", "Arial Black", sans-serif';
export const UI_FONT = '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';

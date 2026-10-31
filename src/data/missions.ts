import { fmt } from "../core/util";

// Three missions are active at a time. Finishing one earns stars and deals a new one.
// "game" missions must be done within a single tower; the others add up across towers.
export const MISSION_TYPES = {
  perfects: { game: true, tiers: [5, 10, 20], text: (n: number) => `Land ${n} perfect drops in one tower` },
  streak: { game: true, tiers: [3, 6, 10], text: (n: number) => `Get a perfect streak of ${n}` },
  height: { game: true, tiers: [60, 120, 200], text: (n: number) => `Build a tower taller than ${n} m` },
  people: { game: true, tiers: [400, 1000, 2000], text: (n: number) => `House ${fmt(n)} people in one tower` },
  wind: { game: true, tiers: [5, 12, 25], text: (n: number) => `Build ${n} floors in the wind` },
  penthouse: { game: false, tiers: [1, 3, 6], text: (n: number) => `Land ${n} gold penthouse${n > 1 ? "s" : ""} perfectly` },
  towers: { game: false, tiers: [3, 5, 8], text: (n: number) => `Build ${n} towers` },
  floors: { game: false, tiers: [50, 150, 300], text: (n: number) => `Build ${n} floors in total` },
  daily: { game: false, tiers: [1, 1, 1], text: () => "Build today's daily tower" },
} as const;

export type MissionKey = keyof typeof MISSION_TYPES;
export const MISSION_KEYS = Object.keys(MISSION_TYPES) as MissionKey[];

export interface Mission {
  t: MissionKey;
  /** Target. */
  n: number;
  /** Reward in stars. */
  r: number;
  /** Progress. */
  p: number;
  /** Done today (missions stay on the list, ticked, until tomorrow's set). */
  d?: boolean;
}

export const missionText = (m: Mission): string => MISSION_TYPES[m.t].text(m.n);

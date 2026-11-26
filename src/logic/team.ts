// Friend teams (Buildaroo): you and your friends share one goal each week, homes built or
// grown together. Each player's city snapshot (shared with the server every few minutes)
// carries their homes this week; the team's total is theirs plus yours, and each step of
// the goal pays everyone who claims it.
import { weekIndex } from "../data/events";
import type { SaveData } from "./save";

export interface TeamState { week: number; homes: number; claimed: number[] }
export const newTeam = (): TeamState => ({ week: -1, homes: 0, claimed: [] });

/** The steps: homes built together, and the crystals each pays. */
export const TEAM_STEPS = [
  { at: 20, crystals: 10 },
  { at: 60, crystals: 20 },
  { at: 150, crystals: 35 },
  { at: 300, crystals: 60 },
];

/** This week's team state (it starts over each Monday). */
export function teamWeek(s: SaveData, now = Date.now()): TeamState {
  const w = weekIndex(now);
  if (s.team.week !== w) s.team = { week: w, homes: 0, claimed: [] };
  return s.team;
}

/** Counts homes built or grown this week. */
export function teamHomes(s: SaveData, n: number, now = Date.now()): void {
  if (n > 0) { const tm = teamWeek(s, now); tm.homes = Math.min(1e5, tm.homes + n); }
}

/** The team's total this week: ours plus each friend's (only counted if it's this week's). */
export function teamTotal(s: SaveData, friends: { week?: number; homes?: number }[], now = Date.now()): number {
  const w = weekIndex(now);
  return teamWeek(s, now).homes + friends.reduce((a, f) => a + (f.week === w ? Math.max(0, Math.min(1e5, Math.floor(f.homes ?? 0))) : 0), 0);
}

/** Claims a step reached by the team. Returns the crystals, or 0. */
export function claimTeam(s: SaveData, i: number, total: number, now = Date.now()): number {
  const tm = teamWeek(s, now), st = TEAM_STEPS[i];
  if (!st || total < st.at || tm.claimed.includes(i)) return 0;
  tm.claimed.push(i);
  s.crystals += st.crystals;
  return st.crystals;
}

export function normalizeTeam(v: unknown): TeamState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : 0);
  return {
    week: typeof o.week === "number" && Number.isFinite(o.week) ? Math.floor(o.week) : -1,
    homes: Math.max(0, Math.min(1e5, n(o.homes))),
    claimed: Array.isArray(o.claimed) ? [...new Set(o.claimed.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < TEAM_STEPS.length))] : [],
  };
}

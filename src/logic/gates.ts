// A calm start (the city game): the extras open one City Hall level at a time, so a new
// player's first minutes are about one thing at a time: the Coffee Cart, its first sale, a
// level, a manager. Daily rewards, golden customers and the daily quests come with City
// Hall level 2; the week's event (and its pass), the friend team, the city album and the
// Season Pass with level 3. (The tower game has no City Hall: everything is open there.)
import { HAS_CITY } from "../edition";
import type { SaveData } from "./save";
import { hallLevel } from "./tycoon";

export type Gate = "daily" | "golden" | "quests" | "event" | "team" | "album" | "season";

/** The City Hall level each extra opens at. */
export const GATE_HALL: Record<Gate, number> = { daily: 2, golden: 2, quests: 2, event: 3, team: 3, album: 3, season: 3 };

export const gateOpen = (s: SaveData, g: Gate): boolean => !HAS_CITY || hallLevel(s) >= GATE_HALL[g];

/** The next City Hall level that opens more of these (undefined once they're all open). */
export function nextGateHall(s: SaveData): number | undefined {
  if (!HAS_CITY) return undefined;
  const h = hallLevel(s), ahead = Object.values(GATE_HALL).filter(n => n > h);
  return ahead.length ? Math.min(...ahead) : undefined;
}

/** How long a brand-new game stays free of the daily calendar (ms). */
export const FRESH_CALM_MS = 5 * 60e3;

/** May the daily rewards calendar open by itself now? Never during the first steps, never in
 *  the first minutes of a brand-new game (`freshSince`: when this session began a new game,
 *  0 for a game that was already going), and never over a card or a sheet (`busy`): it waits
 *  for a calm moment, or the next time the game starts. */
export function dailyMayOpen(s: SaveData, o: { busy: boolean; freshSince: number; now?: number }): boolean {
  const now = o.now ?? Date.now();
  if (!gateOpen(s, "daily") || s.tycoon.tips < 3 || o.busy) return false;
  return !(o.freshSince && now - o.freshSince < FRESH_CALM_MS);
}

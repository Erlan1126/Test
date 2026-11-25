// The New Era nudge: when a player has unlocked nothing new for about a day (no business
// opened or grown, no City Hall level, no new home, land, upgrade or manager) and a New Era
// would pay Sky Gems, the town suggests one, once a day at most.
import { ERA_SCALE, GEM_BONUS } from "../data/tycoon";
import type { SaveData } from "./save";

// (The same sums as logic/tycoon.ts, written here so the save code can load this file early
// without pulling the whole economy in with it; a test checks they agree.)
const hallLevel = (s: SaveData) => 1 + Math.max(0, s.chapters?.done ?? 0);
export const nudgeGems = (s: SaveData): number => Math.max(0, Math.floor(10 * Math.sqrt(s.tycoon.lifetime / ERA_SCALE)) - s.tycoon.gems);

export interface EraNudgeState { sig: string; at: number; off: number }
export const newEraNudge = (): EraNudgeState => ({ sig: "", at: 0, off: 0 });

/** How long with nothing new before the nudge shows, and how long "Not now" hides it. */
export const ERA_NUDGE_AFTER = 22 * 3600e3;
export const ERA_NUDGE_SNOOZE = 24 * 3600e3;

/** What the player has unlocked so far, as one string (it changes when anything new opens). */
export function unlockSig(s: SaveData): string {
  const t = s.tycoon;
  return [
    Object.values(t.levels).filter(l => l > 0).length,
    Object.values(t.evolved ?? {}).reduce((a, b) => a + b, 0),
    hallLevel(s),
    Object.values(s.props ?? {}).reduce((a, l) => a + l, 0),
    s.land?.length ?? 0,
    t.upgrades.length,
    t.managers.length,
    t.eras,
  ].join(",");
}

/** Notes the time whenever something new was unlocked. Call it now and then. */
export function trackUnlocks(s: SaveData, now = Date.now()): void {
  const sig = unlockSig(s), n = s.eraNudge;
  if (sig !== n.sig || !n.at) { n.sig = sig; n.at = now; }
}

/** The nudge to show now, or null: the gems a New Era gives, and earnings before and after. */
export function eraNudge(s: SaveData, now = Date.now()): { gems: number; before: number; after: number; pct: number } | null {
  trackUnlocks(s, now);
  const g = nudgeGems(s), n = s.eraNudge;
  if (g <= 0 || now - n.at < ERA_NUDGE_AFTER || now < n.off) return null;
  const before = 1 + s.tycoon.gems * GEM_BONUS, after = 1 + (s.tycoon.gems + g) * GEM_BONUS;
  return { gems: g, before, after, pct: Math.round((after / before - 1) * 100) };
}

/** "Not now": hidden for a day. */
export function snoozeEraNudge(s: SaveData, now = Date.now()): void { s.eraNudge.off = now + ERA_NUDGE_SNOOZE; }

export function normalizeEraNudge(v: unknown): EraNudgeState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
  return { sig: typeof o.sig === "string" ? o.sig.slice(0, 200) : "", at: num(o.at), off: num(o.off) };
}

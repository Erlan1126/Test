// The Community Spire: every week, all players' perfect drops in ranked towers build one
// giant shared tower. At each height reached, everyone who added at least one floor that
// week collects a reward. The server counts the floors (from towers it replays and checks),
// so nobody can add floors they didn't build.

/** The heights of the week's Spire (in perfect floors) and what each pays. */
export const SPIRE_GOALS: { floors: number; stars: number }[] = [
  { floors: 1000, stars: 10 },
  { floors: 5000, stars: 20 },
  { floors: 15000, stars: 35 },
  { floors: 40000, stars: 60 },
];
/** The most one tower adds (so a single huge tower can't build it alone). */
export const SPIRE_PER_TOWER = 60;

/** What one checked ranked tower adds to the Spire. */
export const spireAdd = (perfects: number): number => Math.max(0, Math.min(SPIRE_PER_TOWER, Math.floor(perfects) || 0));

/** This week's Spire, as the server reports it. */
export interface SpireNow { week: number; floors: number; builders: number; mine: number }

/** What this player has collected (kept in the save). */
export interface SpireSave { week: number; claimed: number }
export const newSpire = (): SpireSave => ({ week: -1, claimed: 0 });
export function normalizeSpire(raw: unknown): SpireSave {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : d);
  return { week: int(r.week, -1), claimed: Math.max(0, Math.min(SPIRE_GOALS.length, int(r.claimed, 0))) };
}

/** Heights reached this week that the player can still collect (they need to have built). */
export function spireReady(s: SpireSave, now: SpireNow): number {
  if (now.mine < 1) return 0;
  const reached = SPIRE_GOALS.filter(g => now.floors >= g.floors).length;
  const claimed = s.week === now.week ? s.claimed : 0;
  return Math.max(0, reached - claimed);
}

/** Collects every reward reached; returns the stars paid. */
export function claimSpire(s: SpireSave, now: SpireNow): number {
  const n = spireReady(s, now);
  if (!n) return 0;
  const from = s.week === now.week ? s.claimed : 0;
  const stars = SPIRE_GOALS.slice(from, from + n).reduce((a, g) => a + g.stars, 0);
  s.week = now.week;
  s.claimed = from + n;
  return stars;
}

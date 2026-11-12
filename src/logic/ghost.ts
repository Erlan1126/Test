// Ghost racing: a see-through floor that climbs at the pace of a tower to beat (the
// player just above you on the rankings, or your own best), so you can see whether
// you're ahead or behind as you build.

/** Floors kept in a ghost. */
export const MAX_GHOST = 1000;

export interface Ghost {
  name: string;
  /** `pace[k]` is the game tick at which that tower reached k + 1 floors. */
  pace: number[];
  /** Your own best tower (not someone else's). */
  self: boolean;
}

/** How many floors the ghost had built by `ticks`. */
export function ghostFloors(pace: number[], ticks: number): number {
  let lo = 0, hi = pace.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pace[mid] <= ticks) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** A pace from untrusted data: whole ticks that never go down, at most MAX_GHOST. */
export function cleanPace(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v.slice(0, MAX_GHOST)) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || (out.length && x < out[out.length - 1])) break;
    out.push(Math.floor(x));
  }
  return out;
}

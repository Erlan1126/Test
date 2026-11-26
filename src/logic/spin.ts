// The daily spin wheel (Buildaroo): one free spin each calendar day, and one more for
// watching a rewarded ad. The wheel's slices pay cash (minutes of the city's income),
// Sky Crystals, a construction boom, a free build finish, or, rarely, a jackpot. Odds are
// weighted and the pick takes an injectable random function, so it's testable.
import type { SaveData } from "./save";
import { dayKey } from "./rules";
import { earn, perSecond, startBoom } from "./tycoon";

export interface SpinState {
  /** The calendar day (dayKey) the counts below are for. */
  day: string;
  /** Today's free spin is used. */
  used: boolean;
  /** Extra spins from rewarded ads today. */
  ads: number;
  /** Spins ever. */
  total: number;
}
export const newSpin = (): SpinState => ({ day: "", used: false, ads: 0, total: 0 });

/** Extra spins a day for watching an ad. */
export const SPIN_ADS_PER_DAY = 1;

export type SpinKind = "cash" | "crystals" | "boom" | "build" | "jackpot";
export interface SpinSlice {
  kind: SpinKind;
  /** Chance, out of the slices' total weight. */
  weight: number;
  /** Cash slices: minutes of income. */
  minutes?: number;
  /** Crystal slices (and the jackpot's crystals). */
  crystals?: number;
  /** The slice's colour on the wheel. */
  color: string;
}

/** The wheel, clockwise from the top. Weights add up to 100. */
export const SPIN_SLICES: SpinSlice[] = [
  { kind: "cash", minutes: 10, weight: 22, color: "#3fcf7a" },
  { kind: "crystals", crystals: 2, weight: 20, color: "#5ab8ff" },
  { kind: "boom", weight: 12, color: "#ff9f3a" },
  { kind: "cash", minutes: 30, weight: 14, color: "#25b06a" },
  { kind: "crystals", crystals: 5, weight: 14, color: "#3f8cff" },
  { kind: "build", weight: 10, color: "#ff6f91" },
  { kind: "crystals", crystals: 25, weight: 4, color: "#8a5cff" },
  { kind: "jackpot", minutes: 240, crystals: 10, weight: 4, color: "#ffc61a" },
];
/** Crystals when the builders' slice lands with nothing being built. */
export const SPIN_BUILD_CRYSTALS = 5;
/** The least a minute of cash pays (a new city with no managers yet). */
export const SPIN_MIN_PER_MINUTE = 15;

/** Today's spin state (it starts over each calendar day). */
export function spinToday(s: SaveData, now = Date.now()): SpinState {
  const d = dayKey(0, now);
  if (s.spin.day !== d) s.spin = { day: d, used: false, ads: 0, total: s.spin.total };
  return s.spin;
}

/** The wheel is open: the city game, once the first chapter is done. */
export const spinOpen = (s: SaveData, city: boolean): boolean => city && (s.chapters?.done ?? 0) >= 1;

/** Today's free spin is still waiting (doesn't change the save). */
export const spinFree = (s: SaveData, now = Date.now()): boolean => s.spin.day !== dayKey(0, now) || !s.spin.used;

/** An extra spin for watching an ad can be offered (after the free one). */
export const spinAdLeft = (s: SaveData, now = Date.now()): boolean =>
  !spinFree(s, now) && (s.spin.day !== dayKey(0, now) ? 0 : s.spin.ads) < SPIN_ADS_PER_DAY;

/** Cash for `minutes` of the city's income (managers' base rate, no short boosts). */
export const spinCash = (s: SaveData, minutes: number, now = Date.now()): number =>
  Math.round(Math.max(SPIN_MIN_PER_MINUTE * minutes, perSecond(s, now, false) * minutes * 60));

/** Picks a slice by weight. `rnd` returns [0, 1). */
export function pickSlice(rnd: () => number = Math.random): number {
  const total = SPIN_SLICES.reduce((a, x) => a + x.weight, 0);
  let r = Math.max(0, Math.min(0.999999, rnd())) * total;
  for (let i = 0; i < SPIN_SLICES.length; i++) {
    r -= SPIN_SLICES[i].weight;
    if (r < 0) return i;
  }
  return SPIN_SLICES.length - 1;
}

export interface SpinResult {
  /** The slice the wheel stops on. */
  slice: number;
  kind: SpinKind;
  cash: number;
  crystals: number;
  /** A construction boom started. */
  boom: boolean;
  /** A build was finished for free (it completes on the next tick). */
  built: boolean;
}

/**
 * Spins the wheel: today's free spin, or (`ad`) the extra one for a watched ad. Pays the
 * reward into the save and returns it, or null when there's no spin left.
 */
export function spin(s: SaveData, now = Date.now(), rnd: () => number = Math.random, ad = false): SpinResult | null {
  const st = spinToday(s, now);
  if (ad ? !st.used || st.ads >= SPIN_ADS_PER_DAY : st.used) return null;
  if (ad) st.ads++; else st.used = true;
  st.total++;
  const i = pickSlice(rnd), sl = SPIN_SLICES[i];
  const out: SpinResult = { slice: i, kind: sl.kind, cash: 0, crystals: 0, boom: false, built: false };
  if (sl.minutes) out.cash = spinCash(s, sl.minutes, now);
  if (sl.crystals) out.crystals = sl.crystals;
  if (sl.kind === "boom") { startBoom(s, now); out.boom = true; }
  if (sl.kind === "build") {
    // The build that would finish soonest is done now; with none going, crystals instead.
    const job = (s.tycoon.builds ?? []).filter(b => b.end > now).sort((a, b) => a.end - b.end)[0];
    if (job) { job.end = now; out.built = true; } else out.crystals = SPIN_BUILD_CRYSTALS;
  }
  earn(s, out.cash);
  s.crystals += out.crystals;
  return out;
}

export function normalizeSpin(v: unknown): SpinState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0);
  const day = typeof o.day === "string" && /^\d{4}-\d{1,2}-\d{1,2}$/.test(o.day) ? o.day : "";
  return { day, used: day !== "" && o.used === true, ads: day ? n(o.ads, SPIN_ADS_PER_DAY) : 0, total: n(o.total, 1e7) };
}

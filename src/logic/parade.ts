// The holiday parade (Buildaroo, Winter Lights only): every few minutes while the game is open,
// and right after an Advent calendar door is opened, a little procession drives along the
// town's streets: a marching band, four floats and balloon characters. Tapping a float tips
// the town a few seconds of income, once per float per parade. This is the pure part: when a
// parade starts, whether it's still on, and the tips. (render3d/parade.ts draws it.)
import { citySeason } from "../data/season";

/** The floats, in the order they come down the street. */
export const PARADE_FLOATS = ["present", "snowman", "gingerbread", "sleigh"] as const;
export type ParadeFloat = (typeof PARADE_FLOATS)[number];

/** A parade every four minutes while the game is open (counted from the last one's start). */
export const PARADE_EVERY_MS = 4 * 60e3;
/** The first one comes a little after the town opens, not straight away. */
export const PARADE_FIRST_MS = 45e3;
/** How long a parade is on (a little longer than the procession takes to go by, about a
 *  minute, so a float still on the street can always be tipped). */
export const PARADE_MS = 90e3;
/** A float's tip: this many seconds of the town's income. */
export const PARADE_TIP_SECONDS = 8;
/** The smallest tip (a town that earns almost nothing yet still gets a little). */
export const PARADE_TIP_MIN = 25;

export interface ParadeState {
  /** When the parade on now (or the last one) started; 0 when there's been none. */
  at: number;
  /** When the next one is due; 0 until the season's first look. */
  next: number;
  /** The floats already tipped in this parade (indices into PARADE_FLOATS). */
  tipped: number[];
}
export const newParade = (): ParadeState => ({ at: 0, next: 0, tipped: [] });

/** Parades are a Winter Lights thing. */
export const paradeSeason = (now = Date.now()): boolean => citySeason(now) === "winter";

/** A parade is going down the street right now. */
export const paradeRunning = (st: ParadeState, now = Date.now()): boolean => st.at > 0 && now >= st.at && now - st.at < PARADE_MS;

/** Time for the next one: Winter Lights is on, none is running, and its time has come. The
 *  first look of a session only schedules it (PARADE_FIRST_MS from now). */
export function paradeDue(st: ParadeState, now = Date.now()): boolean {
  if (!paradeSeason(now) || paradeRunning(st, now)) return false;
  if (!st.next) { st.next = now + PARADE_FIRST_MS; return false; }
  return now >= st.next;
}

/** Starts a parade (the timer's, an Advent door's or the debug one). False out of season or
 *  while one is still going. */
export function startParade(st: ParadeState, now = Date.now()): boolean {
  if (!paradeSeason(now) || paradeRunning(st, now)) return false;
  st.at = now;
  st.tipped = [];
  st.next = now + PARADE_EVERY_MS;
  return true;
}

/** A float's tip for a town earning `rate` a second. */
export const paradeTipValue = (rate: number): number => Math.round(Math.max(PARADE_TIP_MIN, (Number.isFinite(rate) ? rate : 0) * PARADE_TIP_SECONDS));

/** Tips a float (index into PARADE_FLOATS): marks it and returns the tip, or 0 when there's no
 *  parade on, the float isn't one, or it was already tipped this parade. The caller pays it. */
export function tipFloat(st: ParadeState, float: number, rate: number, now = Date.now()): number {
  if (!paradeRunning(st, now) || !Number.isInteger(float) || float < 0 || float >= PARADE_FLOATS.length || st.tipped.includes(float)) return 0;
  st.tipped = [...st.tipped, float];
  return paradeTipValue(rate);
}

// The Advent calendar (Buildaroo): from December 1 to 24, one door a day, by the player's own
// calendar. Today's door and any earlier one still shut can be opened (a missed day is never
// lost), and nothing opens before its date. Each door holds a small prize: cash (minutes of the
// city's income, like the rainbow's pot of gold), Sky Crystals, and behind door 24 the snowy
// gingerbread house, a decoration found nowhere else. The calendar starts over each December.
import type { SaveData } from "./save";
import { spinCash } from "./spin";
import { earn } from "./tycoon";

export interface AdventState {
  /** The December these doors are for. */
  year: number;
  /** The doors opened that December (1-24). */
  opened: number[];
}
export const newAdvent = (): AdventState => ({ year: 0, opened: [] });

export const ADVENT_DOORS = 24;
/** The decoration behind the last door (logic/placedecor.ts). */
export const ADVENT_DECOR = "gingerbread";
/** Crystals behind door 24 when the gingerbread house is already the player's (a past year). */
export const ADVENT_DECOR_CRYSTALS = 25;

export type AdventKind = "cash" | "crystals" | "decor";
export interface AdventPrize {
  kind: AdventKind;
  /** Cash doors: minutes of income. */
  minutes?: number;
  /** Crystal doors. */
  crystals?: number;
}

/** What's behind each door, 1 to 24: cash most days, crystals every third day, and the
 *  gingerbread house last. */
const CASH_MINUTES: Record<number, number> = { 1: 10, 2: 15, 4: 20, 5: 10, 7: 20, 8: 15, 10: 25, 11: 15, 13: 20, 14: 30, 16: 20, 17: 25, 19: 30, 20: 20, 22: 30, 23: 45 };
const CRYSTALS: Record<number, number> = { 3: 3, 6: 3, 9: 5, 12: 5, 15: 5, 18: 8, 21: 10 };
export function doorPrize(door: number): AdventPrize {
  if (door === ADVENT_DOORS) return { kind: "decor" };
  if (CRYSTALS[door]) return { kind: "crystals", crystals: CRYSTALS[door] };
  return { kind: "cash", minutes: CASH_MINUTES[door] ?? 10 };
}

/** It's December (by the player's clock): the calendar is out (the card shows all month). */
export const adventOn = (now = Date.now()): boolean => new Date(now).getMonth() === 11;

/** The highest door that may be opened now: today's date up to 24 in December, else 0. */
export function adventDay(now = Date.now()): number {
  const d = new Date(now);
  return d.getMonth() === 11 ? Math.min(ADVENT_DOORS, d.getDate()) : 0;
}

/** This December's doors (a new December starts with all of them shut). */
export function adventState(s: SaveData, now = Date.now()): AdventState {
  const y = new Date(now).getFullYear();
  if (adventOn(now) && s.advent.year !== y) s.advent = { year: y, opened: [] };
  return s.advent;
}

/** The doors opened this December (doesn't change the save). */
export const adventOpened = (s: SaveData, now = Date.now()): number[] =>
  adventOn(now) && s.advent.year === new Date(now).getFullYear() ? s.advent.opened : [];

/** Can this door be opened now: its date has come, and it's still shut. */
export const doorOpenable = (s: SaveData, door: number, now = Date.now()): boolean =>
  Number.isInteger(door) && door >= 1 && door <= adventDay(now) && !adventOpened(s, now).includes(door);

/** Doors waiting to be opened now (today's and any missed ones). */
export function adventReady(s: SaveData, now = Date.now()): number {
  let n = 0;
  for (let d = 1; d <= adventDay(now); d++) if (doorOpenable(s, d, now)) n++;
  return n;
}

export interface AdventResult {
  door: number;
  kind: AdventKind;
  cash: number;
  crystals: number;
  /** The decoration won (now the player's, put away until they place it). */
  decor: string;
}

/** Opens a door: pays its prize into the save and returns it, or null when it can't open. */
export function openDoor(s: SaveData, door: number, now = Date.now()): AdventResult | null {
  if (!doorOpenable(s, door, now)) return null;
  const st = adventState(s, now);
  st.opened = [...st.opened, door].sort((a, b) => a - b);
  const p = doorPrize(door), out: AdventResult = { door, kind: p.kind, cash: 0, crystals: 0, decor: "" };
  if (p.kind === "cash") out.cash = spinCash(s, p.minutes ?? 10, now);
  else if (p.kind === "crystals") out.crystals = p.crystals ?? 0;
  else if (ADVENT_DECOR in s.placed) { out.kind = "crystals"; out.crystals = ADVENT_DECOR_CRYSTALS; }
  else { s.placed[ADVENT_DECOR] = ""; out.decor = ADVENT_DECOR; }
  earn(s, out.cash);
  s.crystals += out.crystals;
  return out;
}

/** Time until the next door's date (local midnight), in ms, or 0 when none is coming. */
export function nextDoorIn(now = Date.now()): number {
  const d = new Date(now);
  if (d.getMonth() !== 11 || d.getDate() >= ADVENT_DOORS) return 0;
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  return m.getTime() - now;
}

export function normalizeAdvent(v: unknown): AdventState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const year = typeof o.year === "number" && Number.isInteger(o.year) && o.year >= 2000 && o.year < 3000 ? o.year : 0;
  const opened = Array.isArray(o.opened) ? [...new Set(o.opened.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= ADVENT_DOORS))].sort((a, b) => a - b) : [];
  return { year, opened: year ? opened : [] };
}

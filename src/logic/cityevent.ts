// The weekly city event: a theme each week, points for growing the city (business levels,
// finished builds, home upgrades, golden customers), and rewards along the way. The last
// reward is a decoration that is free only this week (it's sold for crystals otherwise).
// The event pass (crystals) doubles every point and adds crystals to each reward.
import { DECOR, WEEKLY_DECOR } from "../data/decor";
import { citySeason, seasonInfo } from "../data/season";
import { eventEndsIn, weekIndex } from "../data/events";
import type { SaveData } from "./save";

export interface CityEventState { week: number; pts: number; claimed: number[]; pass: boolean }
export const newCityEvent = (): CityEventState => ({ week: -1, pts: 0, claimed: [], pass: false });

export const EVENT_THEMES = [
  { name: "Harbor Festival", icon: "⛵" },
  { name: "Garden Week", icon: "🌷" },
  { name: "Neon Nights", icon: "🌃" },
  { name: "Sky Fair", icon: "🎪" },
  { name: "Builders' Week", icon: "🏗️" },
];
/** Points for each thing that grows the city. */
export const EVENT_POINTS = { level: 1, build: 15, home: 8, golden: 10, business: 20 } as const;
export type EventAction = keyof typeof EVENT_POINTS;
/** The milestones: points needed and what each pays (the last is the week's decoration). */
export const EVENT_STEPS: { at: number; crystals: number; passCrystals: number; prize?: boolean }[] = [
  { at: 40, crystals: 5, passCrystals: 15 },
  { at: 120, crystals: 10, passCrystals: 25 },
  { at: 250, crystals: 15, passCrystals: 40 },
  { at: 450, crystals: 0, passCrystals: 60, prize: true },
];
export const EVENT_PASS_CRYSTALS = 120;

/** This week's event (resets each Monday, like the weekly tournament). */
export function cityEvent(s: SaveData, now = Date.now()): CityEventState {
  const w = weekIndex(now);
  if (!s.cityEvent || s.cityEvent.week !== w) s.cityEvent = { week: w, pts: 0, claimed: [], pass: false };
  return s.cityEvent;
}

/** A season takes over the weekly event while it's on (data/season.ts). */
export const eventTheme = (now = Date.now()) => seasonInfo(citySeason(now)) ?? EVENT_THEMES[((weekIndex(now) % EVENT_THEMES.length) + EVENT_THEMES.length) % EVENT_THEMES.length];
/** The week's decoration prize. */
export const eventPrize = (now = Date.now()) => { const se = seasonInfo(citySeason(now)); return se ? DECOR.find(d => d.id === se.prize)! : WEEKLY_DECOR[((weekIndex(now) % WEEKLY_DECOR.length) + WEEKLY_DECOR.length) % WEEKLY_DECOR.length]; };


/** When this week's event ends (ms), or undefined once its prize is won. */
export function cityEventEndsAt(s: SaveData, now = Date.now()): number | undefined {
  const e = cityEvent(s, now);
  if (e.claimed.includes(EVENT_STEPS.length - 1)) return undefined;
  // Weeks start on Monday 00:00 (data/events.ts, the same moment for everyone): the exact
  // start of the next one, so the countdown ticks down by the minute.
  return now + eventEndsIn(now);
}

/** Adds points for something the player did. Returns the points added. */
export function eventPoints(s: SaveData, what: EventAction, n = 1, now = Date.now()): number {
  if (!(n > 0)) return 0;
  const e = cityEvent(s, now), add = EVENT_POINTS[what] * n * (e.pass ? 2 : 1);
  e.pts = Math.min(1e6, e.pts + add);
  return add;
}

/** Milestones reached but not yet claimed. */
export const eventReady = (s: SaveData, now = Date.now()): number[] => {
  const e = cityEvent(s, now);
  return EVENT_STEPS.map((st, i) => (e.pts >= st.at && !e.claimed.includes(i) ? i : -1)).filter(i => i >= 0);
};

/** Claims a milestone: its crystals (more with the pass) and, last, the week's decoration
 *  (or crystals worth it if it's already owned). */
export function claimEventStep(s: SaveData, i: number, now = Date.now()): { crystals: number; decor?: string } | null {
  const e = cityEvent(s, now), st = EVENT_STEPS[i];
  if (!st || e.pts < st.at || e.claimed.includes(i)) return null;
  e.claimed.push(i);
  let crystals = st.crystals + (e.pass ? st.passCrystals : 0), decor: string | undefined;
  if (st.prize) {
    const d = eventPrize(now);
    if (s.decor.includes(d.id)) crystals += Math.round((d.crystals ?? 60) / 2);
    else { s.decor.push(d.id); decor = d.id; }
  }
  s.crystals += crystals;
  return { crystals, decor };
}

/** Buys the event pass for this week (doubles points from now, and its rewards). */
export function buyEventPass(s: SaveData, now = Date.now()): "ok" | "short" | "owned" {
  const e = cityEvent(s, now);
  if (e.pass) return "owned";
  if (s.crystals < EVENT_PASS_CRYSTALS) return "short";
  s.crystals -= EVENT_PASS_CRYSTALS;
  e.pass = true;
  return "ok";
}

export function normalizeCityEvent(v: unknown): CityEventState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : 0);
  return {
    week: typeof o.week === "number" && Number.isFinite(o.week) ? Math.floor(o.week) : -1,
    pts: Math.max(0, Math.min(1e6, n(o.pts))),
    claimed: Array.isArray(o.claimed) ? [...new Set(o.claimed.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < EVENT_STEPS.length))] : [],
    pass: o.pass === true,
  };
}

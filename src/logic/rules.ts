// Pure game rules: speeds, scoring, XP, and the calendar for daily features.
import { clamp } from "../core/util";
import { METERS_PER_FLOOR, MILESTONES, PEOPLE_PER_AREA, PERFECT, PERFECT_TIME, WIND_START } from "../data/constants";
import type { RunSummary } from "./types";

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * Sliding speed in world units per second. Nearly flat for the first 15 floors so new
 * players can find the rhythm, then it ramps up and tops out around floor 50.
 */
export const floorSpeed = (n: number): number => Math.min(20, 6.5 + n * 0.06 + Math.max(0, n - 15) * 0.32);

/** Wind strength (0 to 1) at floor n. It starts at `from` and is full 30 floors later. */
export const windAt = (n: number, from = WIND_START): number => clamp((n - from) / 30, 0, 1);

export const peopleIn = (b: Box): number => Math.round((b.x1 - b.x0) * (b.z1 - b.z0) * PEOPLE_PER_AREA);

/** Perfect drops allow a fixed slice of time rather than distance, so fast floors stay fair. */
export const perfectWindow = (speed: number): number => Math.max(PERFECT, speed * PERFECT_TIME);

export const metersFor = (floors: number): number => floors * METERS_PER_FLOOR;

/** Index of the highest landmark a tower of this height is taller than, or -1. */
export function landmarkIndex(meters: number): number {
  let reached = -1;
  MILESTONES.forEach((ms, i) => { if (meters > ms.m) reached = i; });
  return reached;
}

// ---------- XP and builder levels ----------

/** XP needed to go from level l to the next one. */
export const xpNeeded = (l: number): number => 150 + (l - 1) * 75;

/** XP for a finished tower. Every tower earns some; daily towers earn more, Zen towers less. */
export function runXp(run: RunSummary, newBest: boolean): number {
  let xp = run.floors * 2 + run.perfects * 3 + Math.floor(run.score / 20) + (newBest ? 50 : 0);
  if (run.mode === "daily") xp *= 1.5;
  if (run.mode === "zen") xp /= 2;
  return Math.round(xp * (run.xpMultiplier ?? 1));
}

/** Adds XP, handling any number of level-ups. Each level gives a star, every fifth gives 3. */
export function addXp(level: number, xp: number, gained: number) {
  xp += gained;
  let ups = 0, stars = 0;
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level++;
    ups++;
    stars += level % 5 === 0 ? 3 : 1;
  }
  return { level, xp, ups, stars };
}

// ---------- Calendar ----------

/** Day 1 of the daily tower. Daily towers change at midnight UTC so everyone shares one. */
const DAY_ZERO = Date.UTC(2026, 9, 27);

export const dayNumber = (now = Date.now()): number => Math.max(1, Math.floor((now - DAY_ZERO) / 864e5) + 1);
export const dailyEndsIn = (now = Date.now()): number => Math.max(0, DAY_ZERO + dayNumber(now) * 864e5 - now);
export const dailySeed = (day: number): number => day * 7919 + 17;

/**
 * The player's own calendar day, for the daily gift streak. Steps by calendar date rather
 * than 24 hours so daylight-saving days can't skip or repeat a day.
 */
export function dayKey(offset = 0, now = Date.now()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "5h 12m" or "12m". */
export function duration(ms: number): string {
  const days = Math.floor(ms / 864e5), hrs = Math.floor((ms % 864e5) / 36e5), mins = Math.floor((ms % 36e5) / 6e4);
  if (days) return `${days}d ${hrs}h`;
  return hrs ? `${hrs}h ${mins}m` : `${Math.max(1, mins)}m`;
}

// ---------- Daily gift ----------

/** Stars for each day of a 7-day streak; the cycle repeats after day 7. */
export const GIFTS = [1, 1, 2, 2, 3, 3, 5];
export const giftAmount = (streak: number): number => GIFTS[(Math.max(1, streak) - 1) % GIFTS.length];

/** Whether today's gift is waiting, and the streak it would count toward. */
export function giftState(gift: { last: string; streak: number }, now = Date.now()) {
  if (gift.last === dayKey(0, now)) return { ready: false, streak: gift.streak };
  return { ready: true, streak: gift.last === dayKey(-1, now) ? gift.streak + 1 : 1 };
}

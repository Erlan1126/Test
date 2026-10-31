// Daily habits: the play streak with freezes and milestone rewards, daily missions and
// their chest, island rent and city buildings, and the weekly league. Pure functions
// over SaveData, so they're tested.
import { CHEST, CITY, LEAGUES, MAX_FREEZES, MIN_RENT_PER_HOUR, RENT_BONUS_PER_BUILD, RENT_CAP_HOURS, STREAK_REWARDS } from "../data/daily";
import { weekIndex } from "../data/events";
import { MISSION_KEYS, MISSION_TYPES } from "../data/missions";
import { dayKey } from "./rules";
import type { SaveData } from "./save";
import type { Reward, RunSummary } from "./types";

/** Whole calendar days from one day key to another (DST-safe). */
export function daysBetween(a: string, b: string): number {
  const parse = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); };
  return Math.round((parse(b) - parse(a)) / 864e5);
}

// ---------- Streak ----------

/** Adds this week's free streak freeze (up to the cap). */
function refillFreezes(save: SaveData, now: number): void {
  const w = weekIndex(now), s = save.streak;
  if (s.freezeWeek === w) return;
  s.freezeWeek = w;
  s.freezes = Math.min(MAX_FREEZES, s.freezes + 1);
}

export interface StreakView {
  /** The streak as it stands right now (0 if it has run out). */
  count: number;
  /** Already played today. */
  doneToday: boolean;
  /** Played yesterday or protected by a freeze, but not yet today. */
  atRisk: boolean;
  /** A freeze will be used if the player builds today. */
  needsFreeze: boolean;
  freezes: number;
  next?: (typeof STREAK_REWARDS)[number];
}

export function streakView(save: SaveData, now = Date.now()): StreakView {
  refillFreezes(save, now);
  const s = save.streak, today = dayKey(0, now);
  const gap = s.last ? daysBetween(s.last, today) : Infinity;
  const alive = gap <= 1 || (gap === 2 && s.freezes > 0);
  const count = alive ? s.count : 0;
  return {
    count,
    doneToday: gap === 0,
    atRisk: alive && gap > 0 && s.count > 0,
    needsFreeze: gap === 2 && s.freezes > 0,
    freezes: s.freezes,
    next: STREAK_REWARDS.find(r => r.day > count),
  };
}

/** Counts today's tower toward the streak and pays any milestone reached. */
export function tickStreak(save: SaveData, now = Date.now()): Reward[] {
  refillFreezes(save, now);
  const s = save.streak, today = dayKey(0, now);
  if (s.last === today) return [];
  const gap = s.last ? daysBetween(s.last, today) : Infinity;
  const rewards: Reward[] = [];
  if (gap === 1) s.count++;
  else if (gap === 2 && s.freezes > 0) {
    s.freezes--;
    s.count++;
    rewards.push({ kind: "star", text: `A streak freeze saved your ${s.count - 1}-day streak` });
  } else s.count = 1;
  s.last = today;
  s.best = Math.max(s.best, s.count);
  if (s.count > 1) rewards.unshift({ kind: "star", text: `🔥 ${s.count}-day streak!` });
  for (const m of STREAK_REWARDS) {
    if (s.count < m.day || s.claimed.includes(m.day)) continue;
    s.claimed.push(m.day);
    save.stars += m.stars;
    save.starsEarned += m.stars;
    save.coins += m.coins;
    // A skin it unlocks is announced with the other new skins.
    rewards.push({ kind: "star", text: `${m.day}-day streak reward: +${m.stars} ★ and +${m.coins} coins` });
  }
  return rewards;
}

// ---------- Daily missions ----------

const missionTier = (save: SaveData): number => (save.profile.level < 5 ? 0 : save.profile.level < 12 ? 1 : 2);

/** Fills empty mission slots with types not already in use. */
export function dealMissions(save: SaveData, rng: () => number = Math.random): void {
  const tier = missionTier(save);
  while (save.missions.slots.length < 3) {
    const taken = save.missions.slots.map(m => m.t);
    const pool = MISSION_KEYS.filter(t => !taken.includes(t));
    const t = pool[Math.floor(rng() * pool.length)];
    save.missions.slots.push({ t, n: MISSION_TYPES[t].tiers[tier], r: tier + 1, p: 0, d: false });
  }
}

/** Three fresh missions every day. Returns true when it dealt a new set. */
export function refreshMissions(save: SaveData, now = Date.now(), rng: () => number = Math.random): boolean {
  const today = dayKey(0, now);
  if (save.missions.day === today && save.missions.slots.length === 3) return false;
  if (save.missions.day !== today) save.missions.slots = [];
  save.missions.day = today;
  dealMissions(save, rng);
  return true;
}

export const allMissionsDone = (save: SaveData): boolean =>
  save.missions.slots.length === 3 && save.missions.slots.every(m => m.d);

export const chestReady = (save: SaveData, now = Date.now()): boolean =>
  allMissionsDone(save) && save.missions.chest !== dayKey(0, now) && save.missions.day === dayKey(0, now);

/** Opens today's chest once all three missions are done. */
export function claimChest(save: SaveData, now = Date.now()): { stars: number; coins: number } | null {
  if (!chestReady(save, now)) return null;
  save.missions.chest = dayKey(0, now);
  save.stars += CHEST.stars;
  save.starsEarned += CHEST.stars;
  save.coins += CHEST.coins;
  return { ...CHEST };
}

// ---------- Rent and the city ----------

export const rentPerHour = (save: SaveData): number =>
  Math.round(Math.max(MIN_RENT_PER_HOUR, save.best / 25) * (1 + save.city.length * RENT_BONUS_PER_BUILD));

/** Coins waiting to be collected. Rent starts once you've built a tower. */
export function rentWaiting(save: SaveData, now = Date.now()): number {
  if (!save.rent.last) return 0;
  const hours = Math.min(RENT_CAP_HOURS, Math.max(0, (now - save.rent.last) / 36e5));
  return Math.floor(rentPerHour(save) * hours);
}

/** Hours until the rent box is full. */
export const rentFullIn = (save: SaveData, now = Date.now()): number =>
  save.rent.last ? Math.max(0, RENT_CAP_HOURS - (now - save.rent.last) / 36e5) : RENT_CAP_HOURS;

export function startRent(save: SaveData, now = Date.now()): void {
  if (!save.rent.last) save.rent.last = now;
}

export function collectRent(save: SaveData, now = Date.now()): number {
  const n = rentWaiting(save, now);
  if (n <= 0) return 0;
  save.coins += n;
  save.rent.last = now;
  return n;
}

export type BuildResult = "ok" | "owned" | "poor" | "unknown";

export function buyBuild(save: SaveData, id: string): BuildResult {
  const b = CITY.find(c => c.id === id);
  if (!b) return "unknown";
  if (save.city.includes(id)) return "owned";
  if (save.coins < b.price) return "poor";
  save.coins -= b.price;
  save.city.push(id);
  return "ok";
}

// ---------- Weekly league ----------

export const leagueFor = (points: number) => [...LEAGUES].reverse().find(l => points >= l.min) ?? LEAGUES[0];

/** League points for a tower: Daily towers count double, Zen towers don't count. */
export function leaguePoints(run: RunSummary): number {
  if (run.mode === "zen") return 0;
  return Math.round(run.score / 10) * (run.mode === "daily" ? 2 : 1) + run.floors;
}

/** Starts a new week when one has begun, keeping last week's result to be rewarded. */
export function rollLeague(save: SaveData, now = Date.now()): void {
  const w = weekIndex(now), L = save.league;
  if (L.week === w) return;
  if (L.points > 0 && L.week !== 0 && L.rewarded !== L.week) {
    L.lastWeek = L.week;
    L.lastPoints = L.points;
  }
  L.week = w;
  L.points = 0;
}

/** Adds a tower's points. Returns the new league's name if it moved up a tier. */
export function addLeague(save: SaveData, run: RunSummary, now = Date.now()): string | null {
  rollLeague(save, now);
  const before = leagueFor(save.league.points);
  save.league.points += leaguePoints(run);
  const after = leagueFor(save.league.points);
  return after !== before ? after.name : null;
}

/** Last week's reward, if it hasn't been claimed. */
export function pendingLeagueReward(save: SaveData, now = Date.now()): { league: string; stars: number } | null {
  rollLeague(save, now);
  const L = save.league;
  if (!L.lastWeek || L.rewarded === L.lastWeek) return null;
  const l = leagueFor(L.lastPoints);
  return l.stars > 0 ? { league: l.name, stars: l.stars } : null;
}

export function claimLeagueReward(save: SaveData, now = Date.now()): { league: string; stars: number } | null {
  const r = pendingLeagueReward(save, now);
  save.league.rewarded = save.league.lastWeek;
  if (!r) return null;
  save.stars += r.stars;
  save.starsEarned += r.stars;
  return r;
}

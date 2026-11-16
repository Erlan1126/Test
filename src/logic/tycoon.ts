// The Tycoon economy: earning, buying levels, managers, offline earnings, boosts and the
// New Era reset. All pure functions over the save, so they're easy to test.
import { BUSINESSES, COIN_BOOST_CRYSTALS, ERA_SCALE, GEM_BONUS, MILESTONES_AT, OFFLINE_HOURS, OFFLINE_HOURS_VIP, WARP_24H_CRYSTALS, WARP_4H_CRYSTALS, type Business } from "../data/tycoon";
import type { SaveData } from "./save";
import { vipActive } from "./vip";

export interface TycoonState {
  coins: number;
  /** Coins earned in all eras (New Era gems come from this). */
  lifetime: number;
  levels: Record<string, number>;
  managers: string[];
  /** When each business's current cycle started (ms); 0 = idle, waiting for a tap. */
  runs: Record<string, number>;
  gems: number;
  /** The permanent ×2 coin booster. */
  boost: boolean;
  /** The last time the economy was brought up to date (ms). */
  last: number;
  eras: number;
  /** Floors built in towers that count as offices (not Zen, which never ends). */
  floors: number;
}

export const newTycoon = (): TycoonState =>
  ({ coins: 0, lifetime: 0, levels: { coffee: 1 }, managers: [], runs: {}, gems: 0, boost: false, last: 0, eras: 0, floors: 0 });

export const businessById = (id: string): Business | undefined => BUSINESSES.find(b => b.id === id);
export const levelOf = (s: SaveData, id: string): number => s.tycoon.levels[id] ?? 0;

/** Workers from the sky city: more people living in Skyhaven, more earnings everywhere. */
export const workerBonus = (s: SaveData): number => 1 + Math.sqrt(Math.max(0, s.population)) / 200;

/** Everything that multiplies all earnings. */
export function multiplier(s: SaveData, now = Date.now()): number {
  return workerBonus(s) * (1 + s.tycoon.gems * GEM_BONUS) * (s.tycoon.boost ? 2 : 1) * (vipActive(s, now) ? 1.25 : 1);
}

/** Milestones reached at a level (each doubles the speed). */
export const milestonesAt = (level: number): number => MILESTONES_AT.filter(m => level >= m).length;
/** The next milestone above a level, if any. */
export const nextMilestone = (level: number): number | undefined => MILESTONES_AT.find(m => level < m);

/** Seconds per cycle at a level. */
export const cycleOf = (b: Business, level: number): number => b.cycle / Math.pow(2, milestonesAt(level));
/** Coins one cycle pays right now. */
export const payOf = (s: SaveData, b: Business, now = Date.now()): number => b.income * levelOf(s, b.id) * multiplier(s, now);

/** Coins a second from businesses that run by themselves (managed). */
export function perSecond(s: SaveData, now = Date.now()): number {
  let n = 0;
  for (const b of BUSINESSES) {
    const lv = levelOf(s, b.id);
    if (lv > 0 && s.tycoon.managers.includes(b.id)) n += payOf(s, b, now) / cycleOf(b, lv);
  }
  return n;
}

/** The price of the next `n` levels. */
export function costOf(b: Business, level: number, n: number): number {
  const g = b.growth;
  return b.cost * Math.pow(g, level) * (Math.pow(g, n) - 1) / (g - 1);
}

/** How many levels the coins can buy right now (at least 0). */
export function affordable(b: Business, level: number, coinsHave: number): number {
  const g = b.growth, first = b.cost * Math.pow(g, level);
  if (coinsHave < first) return 0;
  return Math.max(0, Math.floor(Math.log(coinsHave * (g - 1) / first + 1) / Math.log(g)));
}

/** Office floors: every floor the player has ever built is an office (plus the ten of the
 *  first office building), and each business level fills one. More floors come from
 *  building towers, so the tower game is how the company grows. */
export const FREE_FLOORS = 10;
export const officeFloors = (s: SaveData): number => FREE_FLOORS + Math.max(0, s.tycoon.floors);
export const usedFloors = (s: SaveData): number => Object.values(s.tycoon.levels).reduce((a, b) => a + b, 0);
export const freeFloors = (s: SaveData): number => Math.max(0, officeFloors(s) - usedFloors(s));

/** A business is offered once the one before it has been bought. */
export const unlockedBusiness = (s: SaveData, i: number): boolean => i === 0 || levelOf(s, BUSINESSES[i - 1].id) > 0;

function earn(s: SaveData, n: number): void {
  if (!(n > 0) || !Number.isFinite(n)) return;
  s.tycoon.coins += n;
  s.tycoon.lifetime += n;
}

/** Buys `n` levels ("max" buys as many as the coins allow). Returns the levels bought. */
export function buyLevels(s: SaveData, id: string, n: number | "max", now = Date.now()): number {
  const b = businessById(id), i = BUSINESSES.findIndex(x => x.id === id);
  if (!b || !unlockedBusiness(s, i)) return 0;
  const lv = levelOf(s, id);
  // Never more levels than there are empty office floors.
  const count = Math.min(n === "max" ? affordable(b, lv, s.tycoon.coins) : n, freeFloors(s));
  if (count <= 0 || (n !== "max" && count < n)) return 0;
  const price = costOf(b, lv, count);
  if (price > s.tycoon.coins) return 0;
  s.tycoon.coins -= price;
  s.tycoon.levels[id] = lv + count;
  // A business bought for the first time with a manager already... starts at once.
  if (lv === 0 && s.tycoon.managers.includes(id)) s.tycoon.runs[id] = now;
  return count;
}

export function hireManager(s: SaveData, id: string, now = Date.now()): boolean {
  const b = businessById(id);
  if (!b || s.tycoon.managers.includes(id) || levelOf(s, id) === 0 || s.tycoon.coins < b.manager) return false;
  s.tycoon.coins -= b.manager;
  s.tycoon.managers.push(id);
  if (!s.tycoon.runs[id]) s.tycoon.runs[id] = now;
  return true;
}

/** A tap on a business without a manager: starts one cycle. */
export function runOnce(s: SaveData, id: string, now = Date.now()): boolean {
  if (levelOf(s, id) === 0 || s.tycoon.runs[id]) return false;
  s.tycoon.runs[id] = now;
  return true;
}

/** How far through its cycle a business is (0 to 1), for its progress bar. */
export function progressOf(s: SaveData, id: string, now = Date.now()): number {
  const b = businessById(id), start = s.tycoon.runs[id];
  if (!b || !start) return 0;
  const c = cycleOf(b, levelOf(s, id)) * 1000;
  return ((now - start) % c) / c;
}

/** Brings the economy up to date and returns the coins earned since last time. Managed
 *  businesses keep earning while the game is closed, up to the offline limit. */
export function tick(s: SaveData, now = Date.now()): number {
  const t = s.tycoon;
  const capMs = (vipActive(s, now) ? OFFLINE_HOURS_VIP : OFFLINE_HOURS) * 3600e3;
  let total = 0;
  for (const b of BUSINESSES) {
    const lv = levelOf(s, b.id), start = t.runs[b.id];
    if (lv === 0 || !start) continue;
    const c = cycleOf(b, lv) * 1000;
    if (now < start) { t.runs[b.id] = now; continue; } // the clock went back
    if (t.managers.includes(b.id)) {
      const elapsed = now - start, counted = Math.min(elapsed, capMs);
      const k = Math.floor(counted / c);
      if (k > 0) total += k * payOf(s, b, now);
      // Keep the part-done cycle; time past the cap is simply lost.
      t.runs[b.id] = now - (elapsed % c);
    } else if (now - start >= c) {
      total += payOf(s, b, now);
      t.runs[b.id] = 0;
    }
  }
  earn(s, total);
  t.last = now;
  return total;
}

/** A finished tower pays the businesses a visit: its floors' worth of seconds of earnings
 *  (ten seconds a floor, up to ten minutes), at least a little even before any managers. */
export function towerBonus(s: SaveData, floors: number, now = Date.now()): number {
  if (floors < 1) return 0;
  s.tycoon.floors += floors; // every floor becomes an office
  const rate = Math.max(perSecond(s, now), payOf(s, BUSINESSES[0], now) / BUSINESSES[0].cycle);
  const n = rate * Math.min(600, floors * 10);
  earn(s, n);
  return n;
}

/** Sky Gems a New Era would give now. */
export const eraGems = (s: SaveData): number =>
  Math.max(0, Math.floor(10 * Math.sqrt(s.tycoon.lifetime / ERA_SCALE)) - s.tycoon.gems);

/** Starts a New Era: businesses and coins reset, gems are kept and grow. */
export function newEra(s: SaveData, now = Date.now()): number {
  const g = eraGems(s);
  if (g <= 0) return 0;
  const t = s.tycoon;
  t.gems += g;
  t.coins = 0;
  t.levels = { coffee: 1 };
  t.managers = [];
  t.runs = {};
  t.eras++;
  t.last = now;
  return g;
}

/** Crystal boosts: the permanent ×2 booster and time warps (hours of managed earnings now). */
export function buyBoost(s: SaveData): boolean {
  if (s.tycoon.boost || s.crystals < COIN_BOOST_CRYSTALS) return false;
  s.crystals -= COIN_BOOST_CRYSTALS;
  s.tycoon.boost = true;
  return true;
}

export function timeWarp(s: SaveData, hours: 4 | 24, now = Date.now()): number {
  const price = hours === 4 ? WARP_4H_CRYSTALS : WARP_24H_CRYSTALS;
  const rate = perSecond(s, now);
  if (s.crystals < price || rate <= 0) return 0;
  s.crystals -= price;
  const n = rate * hours * 3600;
  earn(s, n);
  return n;
}

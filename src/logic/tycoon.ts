// The Tycoon economy: earning, buying levels, managers, offline earnings, boosts and the
// New Era reset. All pure functions over the save, so they're easy to test.
import { ADVISORS, BOOM_MINUTES, BOOM_MULT, CRATE_CRYSTALS, FESTIVAL_MULT, HQ_FLOORS, STAGE_MULT, UPGRADES, VAULT_COST, VAULT_HOURS, type Advisor, BUSINESSES, RUSH_MULT, RUSH_SECONDS, STAGE_AT, STAGE_NAMES, COIN_BOOST_CRYSTALS, ERA_SCALE, GEM_BONUS, MILESTONES_AT, OFFLINE_HOURS, OFFLINE_HOURS_VIP, SPEEDUPS_PER_DAY, DOUBLE_CRYSTALS_PER_HOUR, WARP_1H_CRYSTALS, WARP_8H_CRYSTALS, type Business, DAILY_REWARDS } from "../data/tycoon";
import type { SaveData } from "./save";
import { cafeMult } from "./cafe";
import { vipActive } from "./vip";
import { dayKey } from "./rules";

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
  /** Rush hour: a business earning extra until a time. */
  rush: { id: string; until: number };
  /** Crystal speed-ups used today. */
  speedups: { day: string; n: number };
  /** Economy version: saves from the first, much faster economy start the company over. */
  econ: number;
  /** The company was just started over (Mayor Pip explains it once). */
  fresh: boolean;
  /** First steps done: 0 tap the cart, 1 buy a level, 2 hire a manager, 3 all done. */
  tips: number;
  /** Today's three company goals, and whether the all-done bonus was paid. */
  goals: { day: string; list: CompanyGoal[]; bonus: boolean };
  /** The stage each business has evolved to (its new headquarters built). */
  evolved: Record<string, number>;
  /** Upgrades bought. */
  upgrades: string[];
  /** Advisors collected. */
  advisors: string[];
  /** Free advisor picks earned (daily calendar, all daily goals): spent on the advisor the player chooses. */
  picks: number;
  /** Vault upgrades bought (each adds hours of earning while away). */
  vault: number;
  /** A construction boom (after a tower with a long perfect streak) until this time. */
  boom: number;
  /** Five-star reviews from a food critic: business id → until. */
  reviews: Record<string, number>;
  /** A brand-new company's grand opening: everything earns more until this time (0 = not yet). */
  opening: number;
  /** Golden customers seen today. */
  golden: { day: string; n: number };
}

export type GoalType = "vip" | "buy" | "taps" | "rush";
export interface CompanyGoal { t: GoalType; n: number; p: number }

/** The current economy version (see TycoonState.econ). */
export const ECONOMY = 2;

export const newTycoon = (): TycoonState =>
  ({ coins: 0, lifetime: 0, levels: { coffee: 1 }, managers: [], runs: {}, gems: 0, boost: false, last: 0, eras: 0, floors: 0, rush: { id: "", until: 0 }, speedups: { day: "", n: 0 }, econ: ECONOMY, fresh: false, tips: 0, goals: { day: "", list: [], bonus: false }, evolved: {}, upgrades: [], advisors: [], picks: 0, vault: 0, boom: 0, reviews: {}, opening: 0, golden: { day: "", n: 0 } });

export const businessById = (id: string): Business | undefined => BUSINESSES.find(b => b.id === id);
export const levelOf = (s: SaveData, id: string): number => s.tycoon.levels[id] ?? 0;

/** Workers from the sky city: more people living in Skyhaven, more earnings everywhere. */
export const workerBonus = (s: SaveData): number => 1 + Math.sqrt(Math.max(0, s.population)) / 1000;

const has = (s: SaveData, id: string): boolean => s.tycoon.advisors.includes(id);
const perkOf = (s: SaveData, perk: Advisor["perk"]): Advisor[] => ADVISORS.filter(a => a.perk === perk && has(s, a.id));

/** Everything that multiplies all earnings. `live` adds the short-lived boosts (a
 *  construction boom), which time warps and tower bonuses leave out. */
export function multiplier(s: SaveData, now = Date.now(), live = true): number {
  const ups = UPGRADES.filter(u => u.biz === "all" && s.tycoon.upgrades.includes(u.id)).reduce((m, u) => m * u.mult, 1);
  const adv = perkOf(s, "all").reduce((m, a) => m * a.n, 1);
  return workerBonus(s) * (1 + s.tycoon.gems * GEM_BONUS) * (s.tycoon.boost ? 2 : 1) * (vipActive(s, now) ? 1.25 : 1) * ups * adv
    * (live && s.tycoon.boom > now ? BOOM_MULT : 1) * (live && s.tycoon.opening > now ? OPENING_MULT : 1);
}

/** A grand opening for a brand-new company: its first minutes earn five times as much, so
 *  a new player opens a second business, hires a manager and grows a building in their
 *  first session. It happens once, ever. Returns true when it starts now. */
export const OPENING_MULT = 5, OPENING_MINUTES = 20;
export function startOpening(s: SaveData, now = Date.now()): boolean {
  if (s.tycoon.opening !== 0 || s.tycoon.lifetime > 2000 || s.tycoon.eras > 0) return false;
  s.tycoon.opening = now + OPENING_MINUTES * 60e3;
  return true;
}

/** This week's festival business (it earns more all week). */
export function festivalBiz(now = Date.now()): string {
  const week = Math.floor((Math.floor(now / 864e5) + 3) / 7);
  return BUSINESSES[((week % BUSINESSES.length) + BUSINESSES.length) % BUSINESSES.length].id;
}

/** What multiplies one business: its evolved stage, its upgrades, advisors, the festival
 *  and (live) a critic's five-star review. */
export function bizMult(s: SaveData, b: Business, now = Date.now(), live = true): number {
  const ups = UPGRADES.filter(u => u.biz === b.id && s.tycoon.upgrades.includes(u.id)).reduce((m, u) => m * u.mult, 1);
  const adv = perkOf(s, "biz").filter(a => a.biz?.includes(b.id)).reduce((m, a) => m * a.n, 1);
  return Math.pow(STAGE_MULT, stageNow(s, b.id)) * ups * adv * (festivalBiz(now) === b.id ? FESTIVAL_MULT : 1) * (b.id === "coffee" ? cafeMult(s.cafe) : 1)
    * (live && (s.tycoon.reviews[b.id] ?? 0) > now ? 2 : 1);
}

/** Milestones reached at a level (each doubles the speed). */
export const milestonesAt = (level: number): number => MILESTONES_AT.filter(m => level >= m).length;
/** The next milestone above a level, if any. */
export const nextMilestone = (level: number): number | undefined => MILESTONES_AT.find(m => level < m);

/** Seconds per cycle at a level. */
export const cycleOf = (b: Business, level: number): number => b.cycle / Math.pow(2, milestonesAt(level));
/** Coins one cycle pays right now. */
export const payOf = (s: SaveData, b: Business, now = Date.now()): number => basePay(s, b, now) * (rushOn(s, b.id, now) ? RUSH_MULT : 1);
/** What one cycle pays without a rush hour (and, unless `live`, without other short boosts). */
export const basePay = (s: SaveData, b: Business, now = Date.now(), live = true): number =>
  b.income * levelOf(s, b.id) * multiplier(s, now, live) * bizMult(s, b, now, live);

/** How long a rush hour lasts (an advisor makes it longer). */
export const rushSeconds = (s: SaveData): number => RUSH_SECONDS * perkOf(s, "rush").reduce((m, a) => m * a.n, 1);

/** Is a business in its rush hour right now? */
export const rushOn = (s: SaveData, id: string, now = Date.now()): boolean => s.tycoon.rush.id === id && s.tycoon.rush.until > now;

/** Starts a rush hour on a random business the player owns (returns its id, or ""). */
export function startRush(s: SaveData, now = Date.now(), rnd = Math.random): string {
  const owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0);
  if (!owned.length || s.tycoon.rush.until > now) return "";
  const b = owned[Math.floor(rnd() * owned.length)];
  s.tycoon.rush = { id: b.id, until: now + rushSeconds(s) * 1000 };
  return b.id;
}

/** The stage a level is big enough for (0 = stand ... 4 = empire). A business only
 *  reaches it once its new headquarters is built: see stageNow and evolve. */
export const stageOf = (level: number): number => Math.max(0, STAGE_AT.filter(a => level >= a).length - 1);
/** The stage a business is at now: as big as its level allows and its headquarters built. */
export const stageNow = (s: SaveData, id: string): number => Math.min(stageOf(levelOf(s, id)), s.tycoon.evolved[id] ?? 0);
export const stageName = (id: string, stage: number): string => STAGE_NAMES[id]?.[Math.max(0, Math.min(4, stage))] ?? id;
/** The stage a business is ready to grow into (its level is big enough), or 0. */
export function readyStage(s: SaveData, id: string): number {
  const now = s.tycoon.evolved[id] ?? 0;
  return levelOf(s, id) > 0 && stageOf(levelOf(s, id)) > now ? now + 1 : 0;
}
/** Floors the headquarters for a stage needs. */
export const hqFloors = (stage: number): number => HQ_FLOORS[Math.max(0, Math.min(HQ_FLOORS.length - 1, stage))];
/** A tower of `floors` was built for a business's new headquarters: grows it a stage if
 *  it's tall enough. Returns the new stage, or 0. */
export function evolve(s: SaveData, id: string, floors: number): number {
  const next = readyStage(s, id);
  if (!next || floors < hqFloors(next)) return 0;
  s.tycoon.evolved[id] = next;
  return next;
}

/** A tower with a long perfect streak starts a construction boom. */
export function startBoom(s: SaveData, now = Date.now()): void {
  s.tycoon.boom = Math.max(s.tycoon.boom, now) + BOOM_MINUTES * 60e3 - Math.max(0, s.tycoon.boom - now);
}

/** A food critic's five-star review doubles a business for an hour. */
export function review(s: SaveData, id: string, now = Date.now()): void {
  if (levelOf(s, id) > 0) s.tycoon.reviews[id] = now + 3600e3;
}

// ---------- Upgrades, advisors and the vault ----------

export const upgradeById = (id: string) => UPGRADES.find(u => u.id === id);
/** Upgrades on offer: for businesses that are open, not bought yet, cheapest first. */
export const upgradesOnOffer = (s: SaveData) =>
  UPGRADES.filter(u => !s.tycoon.upgrades.includes(u.id) && (u.biz === "all" || levelOf(s, u.biz) > 0));
export function buyUpgrade(s: SaveData, id: string): boolean {
  const u = upgradeById(id);
  if (!u || s.tycoon.upgrades.includes(id) || s.tycoon.coins < u.cost || (u.biz !== "all" && levelOf(s, u.biz) === 0)) return false;
  s.tycoon.coins -= u.cost;
  s.tycoon.upgrades.push(id);
  return true;
}

/** A random advisor the player doesn't have yet (or undefined when all are collected). */
export function giveAdvisor(s: SaveData, rnd = Math.random): Advisor | undefined {
  const left = ADVISORS.filter(a => !has(s, a.id));
  if (!left.length) return undefined;
  const a = left[Math.floor(rnd() * left.length)];
  s.tycoon.advisors.push(a.id);
  return a;
}
/** Earns a free advisor pick while any advisor is left to collect. False when all are collected. */
export function earnPick(s: SaveData): boolean {
  if (ADVISORS.filter(a => !has(s, a.id)).length <= s.tycoon.picks) return false;
  s.tycoon.picks++;
  return true;
}
/** Hires the advisor the player chose, with a free pick if they have one, else for crystals: no randomness, the perk is shown
 *  before buying, and an advisor already on the team can't be bought again. */
export function hireAdvisor(s: SaveData, id: string): Advisor | undefined {
  const a = ADVISORS.find(x => x.id === id);
  if (!a || has(s, a.id)) return undefined;
  if (s.tycoon.picks > 0) s.tycoon.picks--;
  else if (s.crystals >= CRATE_CRYSTALS) s.crystals -= CRATE_CRYSTALS;
  else return undefined;
  s.tycoon.advisors.push(a.id);
  return a;
}
/** VIPs come this many times as often; their tips are this many times bigger. */
export const vipRate = (s: SaveData): number => perkOf(s, "vip").reduce((m, a) => m * a.n, 1);
export const tipMult = (s: SaveData): number => perkOf(s, "tips").reduce((m, a) => m * a.n, 1);

export const vaultCost = (s: SaveData): number | undefined => VAULT_COST[s.tycoon.vault];
export function buyVault(s: SaveData): boolean {
  const c = vaultCost(s);
  if (c === undefined || s.tycoon.coins < c) return false;
  s.tycoon.coins -= c;
  s.tycoon.vault++;
  return true;
}
export const nextStage = (level: number): number | undefined => STAGE_AT.find(a => a > level && a > 1);

/** A VIP customer's tip: half a minute of what the business earns, and never less than a
 *  quarter of the cheapest next level, so a tip always feels worth the tap. */
export function vipTip(s: SaveData, id: string, now = Date.now()): number {
  const b = businessById(id);
  if (!b || levelOf(s, id) === 0) return 0;
  const cheapest = Math.min(...BUSINESSES.filter(x => levelOf(s, x.id) > 0).map(x => costOf(x, levelOf(s, x.id), 1)));
  const n = Math.max((payOf(s, b, now) / cycleOf(b, levelOf(s, id))) * 30, cheapest * 0.25) * tipMult(s);
  earn(s, n);
  return n;
}

/** Coins a second from businesses that run by themselves (managed). Without `rush`, a
 *  rush hour going on is left out (for time warps and tower bonuses, which pay hours). */
export function perSecond(s: SaveData, now = Date.now(), rush = true): number {
  let n = 0;
  for (const b of BUSINESSES) {
    const lv = levelOf(s, b.id);
    if (lv > 0 && s.tycoon.managers.includes(b.id)) n += (rush ? payOf(s, b, now) : basePay(s, b, now, false)) / cycleOf(b, lv);
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
  let k = Math.max(0, Math.floor(Math.log(coinsHave * (g - 1) / first + 1) / Math.log(g)));
  // (Rounding can make the formula one too generous.)
  while (k > 0 && costOf(b, level, k) > coinsHave) k--;
  return k;
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
  // Never more levels than there are empty office floors (buying what fits).
  const count = Math.min(n === "max" ? affordable(b, lv, s.tycoon.coins) : n, freeFloors(s));
  if (count <= 0) return 0;
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

/** How many hours the managers keep earning while the game is closed. */
export const offlineHours = (s: SaveData, now = Date.now()): number =>
  (vipActive(s, now) ? OFFLINE_HOURS_VIP : OFFLINE_HOURS) + s.tycoon.vault * VAULT_HOURS + perkOf(s, "away").reduce((h, a) => h + a.n, 0);

/** Times when something that changes a business's pay starts or stops (a grand opening,
 *  a boom, VIP, a review, a rush hour, a new festival week), between two moments. */
function payBreaks(s: SaveData, b: Business, from: number, to: number): number[] {
  const t = s.tycoon, out: number[] = [];
  const rushStart = t.rush.id === b.id ? t.rush.until - rushSeconds(s) * 1000 : NaN;
  for (const x of [t.opening, t.boom, s.vip.until, s.vip.gift, t.reviews[b.id] ?? 0, rushStart, t.rush.id === b.id ? t.rush.until : NaN]) {
    if (x > from && x < to) out.push(x);
  }
  // Festival weeks change on a fixed day (see festivalBiz).
  const day = 864e5;
  for (let w = Math.ceil((from / day + 3) / 7); (w * 7 - 3) * day < to; w++) { const x = (w * 7 - 3) * day; if (x > from) out.push(x); }
  return out.sort((x, y) => x - y);
}

/** What one cycle of `b` finishing at `at` pays: the boosts on at that moment, and a rush
 *  hour only if the cycle finished inside it. */
function payAt(s: SaveData, b: Business, at: number): number {
  const t = s.tycoon, inRush = t.rush.id === b.id && at <= t.rush.until && at > t.rush.until - rushSeconds(s) * 1000;
  return basePay(s, b, at) * (inRush ? RUSH_MULT : 1);
}

/** Brings the economy up to date and returns the coins earned since last time. Managed
 *  businesses keep earning while the game is closed, up to the offline limit.
 *
 *  Every finished cycle is paid as it was when it finished, so a long stretch settled at
 *  once (coming back to the game) pays the same as the same stretch played second by
 *  second, even when a boost started or ran out in the middle of it. */
export function tick(s: SaveData, now = Date.now()): number {
  const t = s.tycoon;
  const capMs = offlineHours(s, now) * 3600e3;
  let total = 0;
  for (const b of BUSINESSES) {
    const lv = levelOf(s, b.id), start = t.runs[b.id];
    if (lv === 0 || !start) continue;
    const c = cycleOf(b, lv) * 1000;
    if (now < start) { t.runs[b.id] = now; continue; } // the clock went back
    if (t.managers.includes(b.id)) {
      const elapsed = now - start, counted = Math.min(elapsed, capMs), end = start + counted;
      const k = Math.floor(counted / c);
      if (k > 0) {
        // Cycles finish at start + c, start + 2c, ...; between two breaks they all pay the same.
        let done = 0, rushed = 0;
        for (const to of [...payBreaks(s, b, start, end), end]) {
          const n = Math.floor((to - start) / c) - done;
          if (n <= 0) continue;
          const at = start + (done + 1) * c, pay = payAt(s, b, at);
          total += n * pay;
          if (pay > basePay(s, b, at)) rushed += n;
          done += n;
        }
        // A rush hour that came and went between two cycles still pays one rushed cycle.
        if (!rushed && t.rush.id === b.id) {
          const rs = t.rush.until - rushSeconds(s) * 1000;
          if (t.rush.until > start && rs < end) {
            const at = Math.min(end, t.rush.until);
            total += basePay(s, b, at) * (RUSH_MULT - 1);
          }
        }
      }
      // Keep the part-done cycle; time past the cap is simply lost.
      t.runs[b.id] = now - (elapsed % c);
    } else if (now - start >= c) {
      // A cycle started by a tap pays as it was when it finished.
      total += payAt(s, b, start + c);
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
  const rate = Math.max(perSecond(s, now, false), basePay(s, BUSINESSES[0], now, false) / BUSINESSES[0].cycle);
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

/** Crystal speed-ups left today. */
export function speedupsLeft(s: SaveData, now = Date.now()): number {
  return s.tycoon.speedups.day === dayKey(0, now) ? Math.max(0, SPEEDUPS_PER_DAY - s.tycoon.speedups.n) : SPEEDUPS_PER_DAY;
}
function useSpeedup(s: SaveData, now: number): void {
  const day = dayKey(0, now);
  s.tycoon.speedups = { day, n: (s.tycoon.speedups.day === day ? s.tycoon.speedups.n : 0) + 1 };
}

export const warpPrice = (hours: 1 | 8): number => (hours === 1 ? WARP_1H_CRYSTALS : WARP_8H_CRYSTALS);

export function timeWarp(s: SaveData, hours: 1 | 8, now = Date.now()): number {
  const price = warpPrice(hours);
  const rate = perSecond(s, now, false);
  if (s.crystals < price || rate <= 0 || speedupsLeft(s, now) <= 0) return 0;
  s.crystals -= price;
  useSpeedup(s, now);
  const n = rate * hours * 3600;
  earn(s, n);
  return n;
}

/** Crystals to double the coins earned while away (by how long it was, up to the cap). */
export function doublePrice(s: SaveData, awayMs: number, now = Date.now()): number {
  const cap = offlineHours(s, now) * 3600e3;
  return Math.max(10, Math.ceil((Math.min(awayMs, cap) / 3600e3) * DOUBLE_CRYSTALS_PER_HOUR / 10) * 10);
}

/** Doubles the welcome-back coins for crystals (one of the day's speed-ups). */
export function doubleAway(s: SaveData, earned: number, awayMs: number, now = Date.now()): boolean {
  const price = doublePrice(s, awayMs, now);
  if (!(earned > 0) || s.crystals < price || speedupsLeft(s, now) <= 0) return false;
  s.crystals -= price;
  useSpeedup(s, now);
  earn(s, earned);
  return true;
}

// ---------- Company goals: three a day ----------

/** Goal kinds with three sizes; each pays stars by size, all three a crystal bonus. */
export const GOAL_TIERS: Record<GoalType, number[]> = { vip: [2, 4, 6], buy: [10, 25, 50], taps: [30, 60, 120], rush: [1, 2, 3] };
export const GOAL_STARS = [3, 5, 8], GOALS_BONUS_CRYSTALS = 10;

/** Deals today's goals if they're from another day. */
export function dealGoals(s: SaveData, now = Date.now(), rnd = Math.random): void {
  const day = dayKey(0, now), g = s.tycoon.goals;
  if (g.day === day && g.list.length) return;
  const kinds = (Object.keys(GOAL_TIERS) as GoalType[]).sort(() => rnd() - 0.5).slice(0, 3);
  s.tycoon.goals = { day, bonus: false, list: kinds.map(k => ({ t: k, n: GOAL_TIERS[k][Math.floor(rnd() * 3)], p: 0 })) };
}

/** Counts progress toward today's goals. Returns the stars paid (and the crystals, if the
 *  last of the three was finished). */
export function goalStep(s: SaveData, kind: GoalType, by = 1, now = Date.now()): { stars: number; crystals: number; pick?: boolean; done: CompanyGoal[] } {
  dealGoals(s, now);
  const out: { stars: number; crystals: number; pick?: boolean; done: CompanyGoal[] } = { stars: 0, crystals: 0, done: [] };
  for (const g of s.tycoon.goals.list) {
    if (g.t !== kind || g.p >= g.n) continue;
    g.p = Math.min(g.n, g.p + by);
    if (g.p >= g.n) {
      const stars = GOAL_STARS[Math.max(0, GOAL_TIERS[kind].indexOf(g.n))];
      s.stars += stars; s.starsEarned += stars; out.stars += stars; out.done.push(g);
    }
  }
  if (!s.tycoon.goals.bonus && s.tycoon.goals.list.every(g => g.p >= g.n)) {
    s.tycoon.goals.bonus = true;
    // A free advisor pick while there are any left to collect, else crystals.
    out.pick = earnPick(s);
    if (!out.pick) { s.crystals += GOALS_BONUS_CRYSTALS; out.crystals = GOALS_BONUS_CRYSTALS; }
  }
  return out;
}

/** What day `streak` of the daily calendar pays (1-based; the week repeats). */
export function dailyReward(s: SaveData, streak: number, now = Date.now()): { cash: number; gems: number; advisor: boolean } {
  const r = DAILY_REWARDS[(Math.max(1, streak) - 1) % DAILY_REWARDS.length];
  const rate = perSecond(s, now, false);
  const cash = r.cash ? Math.max(r.min ?? 0, Math.round(rate * r.cash * 60)) : 0;
  return { cash, gems: r.gems ?? 0, advisor: !!r.advisor && ADVISORS.some(a => !has(s, a.id)) };
}
/** Pays day `streak` of the calendar. Returns what it gave (and the advisor, if one joined). */
export function claimDaily(s: SaveData, streak: number, now = Date.now()): { cash: number; gems: number; pick: boolean } {
  const r = dailyReward(s, streak, now);
  earn(s, r.cash);
  s.crystals += r.gems;
  // Day 7's advisor is a free pick: the player chooses who joins (with crystals once all are collected).
  let gems = r.gems, pick = false;
  if (r.advisor) { pick = earnPick(s); if (!pick) { gems += CRATE_CRYSTALS; s.crystals += CRATE_CRYSTALS; } }
  return { cash: r.cash, gems, pick };
}

/** Golden customers: rare, sparkling, gone in a minute, and they tip big (about ten minutes
 *  of earnings). A few a day, so it's worth popping in to catch one. */
export const GOLDEN_PER_DAY = 5, GOLDEN_SECONDS = 60;
export const goldenLeft = (s: SaveData, now = Date.now()): number =>
  s.tycoon.golden.day === dayKey(0, now) ? Math.max(0, GOLDEN_PER_DAY - s.tycoon.golden.n) : GOLDEN_PER_DAY;
/** A golden customer arrives (counts toward today's). */
export function goldenArrives(s: SaveData, now = Date.now()): boolean {
  if (goldenLeft(s, now) <= 0) return false;
  const day = dayKey(0, now);
  s.tycoon.golden = { day, n: (s.tycoon.golden.day === day ? s.tycoon.golden.n : 0) + 1 };
  return true;
}
/** What a golden customer tips (and pays it). */
export function goldenTip(s: SaveData, now = Date.now()): number {
  const owned = BUSINESSES.filter(x => levelOf(s, x.id) > 0);
  if (!owned.length) return 0;
  const cheapest = Math.min(...owned.map(x => costOf(x, levelOf(s, x.id), 1)));
  const n = Math.max(perSecond(s, now, false) * 600, cheapest * 0.6, 250) * tipMult(s);
  earn(s, n);
  return n;
}

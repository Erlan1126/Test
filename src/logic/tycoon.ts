// The Tycoon economy: earning, buying levels, managers, offline earnings, boosts and the
// New Era reset. All pure functions over the save, so they're easy to test.
import { HAS_CITY } from "../edition";
import { ANNEX_BONUS, RANK_BONUS, RANKS } from "../data/ranks";
import { LAND_BONUS } from "../data/land";
import { PROP_BONUS } from "../data/props";
import { decorMult } from "./decor";
import { ADVISORS, BOOM_MINUTES, BOOM_MULT, CRATE_CRYSTALS, FESTIVAL_MULT, HQ_FLOORS, STAGE_MULT, UPGRADES, VAULT_COST, VAULT_HOURS, type Advisor, BUSINESSES, RUSH_MULT, RUSH_SECONDS, STAGE_AT, STAGE_NAMES, COIN_BOOST_CRYSTALS, COST_K, ERA_SCALE, PAY_K, GEM_BONUS, MILESTONES_AT, OFFLINE_HOURS, OFFLINE_HOURS_VIP, SPEEDUPS_PER_DAY, DOUBLE_CRYSTALS_PER_HOUR, WARP_1H_CRYSTALS, WARP_8H_CRYSTALS, type Business, DAILY_REWARDS } from "../data/tycoon";
import type { SaveData } from "./save";
import { placedBonus } from "./placedecor";
import { cafeMult } from "./cafe";
import { orderMult } from "./orders";
import { vipActive } from "./vip";
import { snowDayMult, snowDaySpan } from "./weather";
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
  /** The highest town rank ever reached: a rank is for good, even after a New Era. */
  rankBest?: number;
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
  /** Office blocks built in the city with cash (each adds OFFICE_BLOCK_FLOORS office floors). */
  offices: number;
  /** Builds under way (see logic/builds.ts). */
  builds: { kind: "office" | "terrace" | "land" | "home" | "hq" | "project"; id: string; start: number; end: number }[];
  /** Builders hired with crystals. */
  builders: number;
  /** Builds finished, all time (the City Plan counts them). */
  built: number;
}

export type GoalType = "vip" | "buy" | "taps" | "rush" | "build" | "home" | "ask" | "decor" | "talk" | "golden";
export interface CompanyGoal { t: GoalType; n: number; p: number }

/** The current economy version (see TycoonState.econ). */
export const ECONOMY = 2;

export const newTycoon = (): TycoonState =>
  ({ coins: 0, lifetime: 0, levels: { coffee: 1 }, managers: [], runs: {}, gems: 0, boost: false, last: 0, eras: 0, rankBest: 0, floors: 0, rush: { id: "", until: 0 }, speedups: { day: "", n: 0 }, econ: ECONOMY, fresh: false, tips: 0, goals: { day: "", list: [], bonus: false }, evolved: {}, upgrades: [], advisors: [], picks: 0, vault: 0, boom: 0, reviews: {}, opening: 0, golden: { day: "", n: 0 }, offices: 0, builds: [], builders: 0, built: 0 });

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
  return workerBonus(s) * (1 + townRank(s) * RANK_BONUS) * (s.annex?.pick ? 1 + ANNEX_BONUS : 1) * (1 + (s.land?.length ?? 0) * LAND_BONUS) * (1 + PROP_BONUS * Object.values(s.props ?? {}).reduce((a, l) => a + Math.max(0, Math.min(5, l) - 1), 0)) * (1 + s.tycoon.gems * GEM_BONUS) * (1 + placedBonus(s)) * (s.tycoon.boost ? 2 : 1) * (vipActive(s, now) ? 1.25 : 1) * ups * adv
    * (live && s.tycoon.boom > now ? BOOM_MULT : 1) * (live && s.tycoon.opening > now ? OPENING_MULT : 1);
}

/** A grand opening for a brand-new company: its first minutes earn twice as much, so
 *  a new player opens a second business, hires a manager and grows a building in their
 *  first session. It happens once, ever. Returns true when it starts now. */
export const OPENING_MULT = 2, OPENING_MINUTES = 20;
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

/** What multiplies one business: its evolved stage, its upgrades, advisors, the festival,
 *  a snow day (cozy businesses) and (live) a critic's five-star review. */
export function bizMult(s: SaveData, b: Business, now = Date.now(), live = true): number {
  const ups = UPGRADES.filter(u => u.biz === b.id && s.tycoon.upgrades.includes(u.id)).reduce((m, u) => m * u.mult, 1);
  const adv = perkOf(s, "biz").filter(a => a.biz?.includes(b.id)).reduce((m, a) => m * a.n, 1);
  return Math.pow(STAGE_MULT, stageNow(s, b.id)) * ups * adv * (festivalBiz(now) === b.id ? FESTIVAL_MULT : 1) * (b.id === "coffee" ? cafeMult(s.cafe) : 1) * decorMult(s) * orderMult(s.orders, b.id) * snowDayMult(s, b.id, now)
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
  b.income * PAY_K * levelOf(s, b.id) * multiplier(s, now, live) * bizMult(s, b, now, live);

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
export const stageName = (id: string, stage: number): string => STAGE_NAMES[id]?.[Math.max(0, Math.min(STAGE_AT.length - 1, stage))] ?? id;
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
  return b.cost * COST_K * Math.pow(g, level) * (Math.pow(g, n) - 1) / (g - 1);
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

/** Office floors: every floor the player has ever built gives two offices (plus the 25 of the
 *  first office building), and each business level fills one. More floors come from
 *  building towers, so the tower game is how the company grows. */
export const FREE_FLOORS = 25;
/** Office floors an office block adds (built from the Build menu, with cash). */
export const OFFICE_BLOCK_FLOORS = 10;
export const officeFloors = (s: SaveData): number => FREE_FLOORS + 2 * Math.max(0, s.tycoon.floors) + OFFICE_BLOCK_FLOORS * Math.max(0, s.tycoon.offices ?? 0);

/** What the next office block costs: about three of the company's typical next levels
 *  (the middle one of its businesses', so it keeps pace with the city), and 8% more for
 *  each one built. */
export function officePrice(s: SaveData): number {
  const next = BUSINESSES.filter(b => levelOf(s, b.id) > 0).map(b => costOf(b, levelOf(s, b.id), 1)).sort((a, b) => a - b);
  const mid = next.length ? next[Math.floor((next.length - 1) / 2)] : 0;
  return Math.ceil(Math.max(60, mid * 3) * Math.pow(1.08, Math.max(0, s.tycoon.offices ?? 0)));
}

/** Builds an office block with cash. Returns false if the coins aren't there. */
export function buildOffice(s: SaveData): boolean {
  const price = officePrice(s);
  if (!(s.tycoon.coins >= price)) return false;
  s.tycoon.coins -= price;
  s.tycoon.offices = (s.tycoon.offices ?? 0) + 1;
  return true;
}
export const usedFloors = (s: SaveData): number => Object.values(s.tycoon.levels).reduce((a, b) => a + b, 0);

/** The town's rank (0 = Hamlet), from all its business levels together. */
/** How many blocks of the city grid are built: the city starts as the town alone and spreads
 *  out, a few blocks for every 40 business levels. */
export const cityGrow = (s: SaveData): number => 4 * Math.floor(usedFloors(s) / 40);
/** How many of the town's own home blocks are built: a few at the start, one more for every
 *  6 business levels, nearest the middle first. */
export const townHomes = (s: SaveData): number => 2 + Math.floor(usedFloors(s) / 6);
/** In the city game the town's rank follows the City Hall: the rank each City Hall level
 *  brings (level 2 a Village, 3 a Town, 4 a City, 5 a Big City, 6 a Metropolis, 8 the Sky
 *  Capital). The tower game's company ranks up by business levels. */
export const HALL_RANK = [0, 0, 1, 2, 3, 4, 5, 5, 6, 6, 6, 6];
/** The City Hall level that makes the town this rank. */
export const rankHall = (rank: number): number => Math.max(1, HALL_RANK.indexOf(rank));
export const townRank = (s: SaveData): number => HAS_CITY
  ? Math.max(HALL_RANK[Math.min(HALL_RANK.length - 1, hallLevel(s))], Math.min(RANKS.length - 1, s.tycoon.rankBest ?? 0))
  : rankByLevels(s);
const rankByLevels = (s: SaveData): number => { const n = usedFloors(s); let r = 0; RANKS.forEach((x, i) => { if (n >= x.at) r = i; }); return Math.max(r, Math.min(RANKS.length - 1, s.tycoon.rankBest ?? 0)); };
/** Office floors only limit the tower game's company (towers add them). The city game has no
 *  such limit: its main path is the City Hall's level instead (see hallLevel). */
export const FLOOR_LIMIT = !HAS_CITY;
export const freeFloors = (s: SaveData): number => FLOOR_LIMIT ? Math.max(0, officeFloors(s) - usedFloors(s)) : 1e9;

/** The City Hall, the city's main building: its level goes up by one for every chapter of
 *  Mayor Pip's story finished (level 1 at the start), and each level opens new businesses. */
export const hallLevel = (s: SaveData): number => 1 + Math.max(0, s.chapters?.done ?? 0);
/** The City Hall level each town business opens at (the city game only). */
export const HALL_UNLOCK: Record<string, number> = { coffee: 1, flowers: 1, bakery: 2, pizza: 2, cinema: 3, hotel: 3, mall: 4, airport: 4, casino: 5, spaceport: 6 };
/** The City Hall level each district goes on sale at, in the order of data/land.ts (the Beach
 *  Resort opens with Downtown, at level 7: it goes on sale once Downtown is bought). */
export const LAND_HALL = [5, 6, 7, 7, 8, 9, 10];
export const hallNeed = (id: string): number => (HAS_CITY ? HALL_UNLOCK[id] ?? 1 : 1);
/** Waiting for a higher City Hall (it would open otherwise). */
export const hallLocked = (s: SaveData, id: string): boolean => levelOf(s, id) === 0 && hallLevel(s) < hallNeed(id);
/** The town businesses a City Hall level opens. */
export const hallOpens = (level: number): Business[] => (HAS_CITY ? BUSINESSES.filter(b => !b.land && HALL_UNLOCK[b.id] === level) : []);

/** A business is offered once the one before it has been bought. */
/** The business opened just before this one in its own place (the town, or its district), or -1. */
export const prevBusiness = (i: number): number => {
  const land = BUSINESSES[i]?.land;
  for (let j = i - 1; j >= 0; j--) if (BUSINESSES[j].land === land) return j;
  return -1;
};
/** Whether business i can be opened: the town's one after another; a district's once the
 *  district is bought, then one after another there too. */
export const unlockedBusiness = (s: SaveData, i: number): boolean => {
  const b = BUSINESSES[i];
  if (!b) return false;
  if (b.land && !s.land.includes(b.land)) return false;
  if (hallLocked(s, b.id)) return false;
  const p = prevBusiness(i);
  return p < 0 || levelOf(s, BUSINESSES[p].id) > 0;
};
/** Shown in the lists (open now, or the next one to open). */
export const shownBusiness = (s: SaveData, i: number): boolean => {
  if (unlockedBusiness(s, i)) return true;
  const b = BUSINESSES[i], p = prevBusiness(i);
  // (One waiting for the City Hall shows once the one before it is open, with its lock.)
  if (hallLocked(s, b.id) && !b.land) return p < 0 || levelOf(s, BUSINESSES[p].id) > 0;
  if (b.land) return p >= 0 ? unlockedBusiness(s, p) : false;
  return p >= 0 && unlockedBusiness(s, p);
};

export function earn(s: SaveData, n: number): void {
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

/** Each extra tap on a business that's already selling (and has no manager yet) hurries the
 *  sale along by this share of its cycle: the first minutes are tapping, and tapping should
 *  feel like it does something, not like waiting for a bar. */
export const HURRY_SHARE = 0.12;
/** Hurries a sale under way (no manager). Returns false if there's nothing to hurry. */
export function hurry(s: SaveData, id: string, now = Date.now()): boolean {
  const b = businessById(id), start = s.tycoon.runs[id], lv = levelOf(s, id);
  if (!b || !start || lv === 0 || s.tycoon.managers.includes(id) || start > now) return false;
  const c = cycleOf(b, lv) * 1000;
  // (Never past the end of the cycle: the next tick pays it once, as a normal sale.)
  s.tycoon.runs[id] = Math.max(now - c, start - c * HURRY_SHARE);
  return true;
}

/** How far through its cycle a business is (0 to 1), for its progress bar. */
export function progressOf(s: SaveData, id: string, now = Date.now()): number {
  const b = businessById(id), start = s.tycoon.runs[id];
  if (!b || !start) return 0;
  const c = cycleOf(b, levelOf(s, id)) * 1000;
  // (A clock set back can put the start in the future: no negative bar.)
  if (now <= start || !(c > 0)) return 0;
  return Math.min(0.9999, ((now - start) % c) / c);
}

/** How many hours the managers keep earning while the game is closed. */
export const offlineHours = (s: SaveData, now = Date.now()): number =>
  (vipActive(s, now) ? OFFLINE_HOURS_VIP : OFFLINE_HOURS) + s.tycoon.vault * VAULT_HOURS + perkOf(s, "away").reduce((h, a) => h + a.n, 0);

/** Times when something that changes a business's pay starts or stops (a grand opening,
 *  a boom, VIP, a review, a rush hour, a new festival week), between two moments. */
function payBreaks(s: SaveData, b: Business, from: number, to: number): number[] {
  const t = s.tycoon, out: number[] = [];
  const rushStart = t.rush.id === b.id ? t.rush.until - rushSeconds(s) * 1000 : NaN;
  const snow = snowDaySpan(s) ?? [NaN, NaN];
  for (const x of [t.opening, t.boom, s.vip.until, s.vip.gift, t.reviews[b.id] ?? 0, rushStart, t.rush.id === b.id ? t.rush.until : NaN, ...snow]) {
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
          // Cycles strictly inside the stretch all pay the same; the first and last may land
          // exactly on a break, so they're priced on their own (as the live tick would).
          const first = start + (done + 1) * c, last = start + (done + n) * c;
          const each = (at: number, k: number) => { const pay = payAt(s, b, at); total += k * pay; if (pay > basePay(s, b, at)) rushed += k; };
          each(first, 1);
          if (n > 2) each(first + c, n - 2);
          if (n > 1) each(last, 1);
          done += n;
        }
        // A rush hour that came and went between two cycles still pays one rushed cycle.
        if (!rushed && t.rush.id === b.id) {
          const rs = t.rush.until - rushSeconds(s) * 1000;
          // (Only when the whole rush fell between two finished cycles: a cycle that finished
          // during it was already paid rushed, by an earlier tick in live play.)
          if (rs >= start && t.rush.until > start && rs < end) {
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
  // A new era starts the city over: its rank, every building's height, the districts and
  // the floating island bought with cash, business HQs and upgrades. (What was paid for with
  // crystals, the gems, the story so far and the player's own towers stay.)
  t.rankBest = 0;
  t.gems += g;
  t.coins = 0;
  t.levels = { coffee: 1 };
  t.managers = [];
  t.runs = {};
  t.evolved = {};
  t.upgrades = [];
  s.props = {};
  s.land = [];
  s.annex = { pick: "" };
  t.offices = 0;
  t.builds = [];
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

/** What a time warp pays: the managers' base rate (no short boosts) for that many hours.
 *  Every screen quotes this, so the quote is always what the player gets. */
export const warpGain = (s: SaveData, hours: 1 | 8, now = Date.now()): number => perSecond(s, now, false) * hours * 3600;

/** A first time warp's welcome price (a one-time deal for a new player). */
export const WELCOME_WARP_CRYSTALS = 25;
export function timeWarp(s: SaveData, hours: 1 | 8, now = Date.now(), price = warpPrice(hours)): number {
  const n = warpGain(s, hours, now);
  if (s.crystals < price || n <= 0 || speedupsLeft(s, now) <= 0) return 0;
  s.crystals -= price;
  useSpeedup(s, now);
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

/** In the city game, rewards that were stars pay cash instead (two currencies only: cash
 *  and crystals). One star's worth is about a minute of the company's earnings. */
export function starCash(s: SaveData, n: number, now = Date.now()): number {
  return Math.round(n * Math.max(25, perSecond(s, now, false) * 60));
}
/** Pays a reward of `n` stars: cash in the city game, stars in the tower game. Returns the
 *  cash paid (0 when it paid stars). */
export function payStars(s: SaveData, n: number, now = Date.now()): number {
  if (!(n > 0)) return 0;
  if (HAS_CITY) { const c = starCash(s, n, now); earn(s, c); return c; }
  s.stars += n; s.starsEarned += n;
  return 0;
}

/** Doubles the welcome-back coins after a rewarded ad (free; the ad's daily limit applies). */
export function adDoubleAway(s: SaveData, earned: number): boolean {
  if (!(earned > 0)) return false;
  earn(s, earned);
  return true;
}

// ---------- Company goals: three a day ----------

/** Goal kinds with three sizes; each pays stars by size, all three a crystal bonus. */
export const GOAL_TIERS: Record<GoalType, number[]> = { vip: [2, 4, 6], buy: [10, 25, 50], taps: [30, 60, 120], rush: [1, 2, 3], build: [1, 2, 3], home: [1, 2, 3], ask: [1, 2, 2], decor: [1, 2, 3], talk: [2, 4, 6], golden: [1, 2, 3] };
/** The city game's building goals: finish builds, build or grow homes, help neighbours. */
export const BUILD_GOALS: GoalType[] = ["build", "home", "ask"];
/** City quests, only in the city game: place or move a decoration (once City Hall allows
 *  them), chat with the people walking about, catch golden customers. */
export const CITY_GOALS: GoalType[] = ["decor", "talk", "golden"];
export const GOAL_STARS = [3, 5, 8], GOALS_BONUS_CRYSTALS = 10;
/** The hand-selling goal for a company with no manager yet. */
export const FRESH_TAPS = 15;

/** Deals today's goals if they're from another day. */
export function dealGoals(s: SaveData, now = Date.now(), rnd = Math.random): void {
  const day = dayKey(0, now), g = s.tycoon.goals;
  if (g.day === day && g.list.length) return;
  // (The city game always has at least one building goal; the tower game never does.)
  // (The city game also always has one city quest.)
  const hall = 1 + Math.max(0, s.chapters?.done ?? 0);
  const city = CITY_GOALS.filter(k => k !== "decor" || hall >= 2);
  const pool = (Object.keys(GOAL_TIERS) as GoalType[]).filter(k => HAS_CITY ? !CITY_GOALS.includes(k) || city.includes(k) : !BUILD_GOALS.includes(k) && !CITY_GOALS.includes(k));
  let kinds = pool.sort(() => rnd() - 0.5).slice(0, 3);
  if (HAS_CITY && !kinds.some(k => BUILD_GOALS.includes(k))) kinds = [BUILD_GOALS[Math.floor(rnd() * 2) % 2], ...kinds.filter(k => !BUILD_GOALS.includes(k)).slice(0, 2)];
  if (HAS_CITY && !kinds.some(k => CITY_GOALS.includes(k))) {
    // (It takes the place of a goal that isn't the building one.)
    let i = kinds.length - 1;
    while (i > 0 && BUILD_GOALS.includes(kinds[i])) i--;
    kinds[i] = city[Math.floor(rnd() * city.length) % city.length];
  }
  // Before the first manager, selling by hand is slow work: a day-one goal stays small.
  const fresh = s.tycoon.managers.length === 0;
  s.tycoon.goals = { day, bonus: false, list: kinds.map(k => ({ t: k, n: fresh && k === "taps" ? FRESH_TAPS : GOAL_TIERS[k][Math.floor(rnd() * 3)], p: 0 })) };
}

/** Counts progress toward today's goals. Returns the stars paid (and the crystals, if the
 *  last of the three was finished). */
export function goalStep(s: SaveData, kind: GoalType, by = 1, now = Date.now()): { stars: number; cash?: number; crystals: number; pick?: boolean; done: CompanyGoal[] } {
  dealGoals(s, now);
  const out: { stars: number; cash?: number; crystals: number; pick?: boolean; done: CompanyGoal[] } = { stars: 0, crystals: 0, done: [] };
  for (const g of s.tycoon.goals.list) {
    if (g.t !== kind || g.p >= g.n) continue;
    g.p = Math.min(g.n, g.p + by);
    if (g.p >= g.n) {
      const stars = GOAL_STARS[Math.max(0, GOAL_TIERS[kind].indexOf(g.n))];
      out.cash = (out.cash ?? 0) + payStars(s, stars, now); out.stars += stars; out.done.push(g);
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
/** A happy customer's little tip (tapping their reaction bubble in the town): a few seconds
 *  of earnings, never less than a tenth of the cheapest next level. */
export function reactionTip(s: SaveData, now = Date.now()): number {
  const owned = BUSINESSES.filter(x => levelOf(s, x.id) > 0);
  if (!owned.length) return 0;
  const cheapest = Math.min(...owned.map(x => costOf(x, levelOf(s, x.id), 1)));
  const n = Math.max(perSecond(s, now, false) * 3, cheapest * 0.08, 1) * tipMult(s);
  earn(s, n);
  return n;
}

export function goldenTip(s: SaveData, now = Date.now()): number {
  const owned = BUSINESSES.filter(x => levelOf(s, x.id) > 0);
  if (!owned.length) return 0;
  const cheapest = Math.min(...owned.map(x => costOf(x, levelOf(s, x.id), 1)));
  const n = Math.max(perSecond(s, now, false) * 300, cheapest * 0.4, 250) * tipMult(s);
  earn(s, n);
  return n;
}

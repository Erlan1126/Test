// Skyhaven Tycoon: the businesses of the sky city. Each one earns coins every cycle; buying
// levels raises what it earns, every few milestones it runs twice as fast, a manager runs it
// on its own (even while the game is closed), and a "New Era" resets the businesses for Sky
// Gems that make every later era richer. The numbers never stop growing.

export interface Business {
  id: string;
  name: string;
  /** Icon name in the drawn icon set (src/ui/icons.ts). */
  icon: string;
  /** Two colors for its badge. */
  color: [string, string];
  /** Price of the first level, in coins. */
  cost: number;
  /** How much each further level's price grows. */
  growth: number;
  /** Coins one level earns per cycle. */
  income: number;
  /** Seconds per cycle before speed milestones. */
  cycle: number;
  /** What a manager costs. */
  manager: number;
}

export const BUSINESSES: Business[] = [
  { id: "coffee", name: "Coffee Cart", icon: "coffee", color: ["#ffb36b", "#e0743a"], cost: 12, growth: 1.17, income: 1, cycle: 4, manager: 1500 },
  { id: "flowers", name: "Flower Kiosk", icon: "leaf", color: ["#ff9ac8", "#e8457a"], cost: 150, growth: 1.13, income: 0.4, cycle: 6, manager: 10000 },
  { id: "bakery", name: "Cloud Bakery", icon: "sun", color: ["#ffe27a", "#ffb13b"], cost: 3000, growth: 1.13, income: 3, cycle: 15, manager: 150000 },
  { id: "pizza", name: "Pizza Place", icon: "dish", color: ["#ff8a6b", "#e0433a"], cost: 50000, growth: 1.13, income: 25, cycle: 40, manager: 3e6 },
  { id: "cinema", name: "Sky Cinema", icon: "film", color: ["#b48cff", "#6a3cff"], cost: 2e5, growth: 1.12, income: 300, cycle: 120, manager: 1e7 },
  { id: "hotel", name: "Cloud Hotel", icon: "building", color: ["#7fd3ff", "#3a8dff"], cost: 3e6, growth: 1.11, income: 3000, cycle: 300, manager: 2e8 },
  { id: "mall", name: "Sky Mall", icon: "gift", color: ["#5ee0a0", "#19a87a"], cost: 4e7, growth: 1.1, income: 35000, cycle: 900, manager: 3e9 },
  { id: "airport", name: "Airship Port", icon: "airship", color: ["#9fe6ff", "#4f8bff"], cost: 6e8, growth: 1.09, income: 400000, cycle: 1800, manager: 5e10 },
  { id: "casino", name: "Star Casino", icon: "star", color: ["#ffd23f", "#ff4f8b"], cost: 1e10, growth: 1.08, income: 5e+06, cycle: 3600, manager: 1e12 },
  { id: "spaceport", name: "Space Port", icon: "rocket", color: ["#8a96ff", "#2a1f6e"], cost: 2e11, growth: 1.07, income: 1e+08, cycle: 7200, manager: 2e13 },
];

/** Level milestones: reaching each one makes a business run twice as fast. */
export const MILESTONES_AT = [25, 100, 200, 400, 600, 800, 1000];
/** Every Sky Gem adds this much to all earnings. */
export const GEM_BONUS = 0.02;
/** Offline earnings stop piling up after this long (longer with VIP). */
export const OFFLINE_HOURS = 8, OFFLINE_HOURS_VIP = 24;
/** Crystal prices for the boosts. */
export const COIN_BOOST_CRYSTALS = 1200;
export const WARP_1H_CRYSTALS = 100, WARP_8H_CRYSTALS = 500;
/** Crystal speed-ups (time warps and doubling the welcome-back coins) allowed a day:
 *  crystals help, but the company still grows at its own pace. */
export const SPEEDUPS_PER_DAY = 3;
/** Doubling what managers earned while away costs this many crystals an hour away. */
export const DOUBLE_CRYSTALS_PER_HOUR = 40;
/** Lifetime coins needed for the first New Era gem (the formula is a square root of this). */
export const ERA_SCALE = 2e8;

const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
/** 1234 → "1.23K", 5.6e15 → "5.60Qa", then aa, ab, ac... for the truly endless. */
export function coins(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  let tier = Math.floor(Math.log10(n) / 3);
  const v = n / Math.pow(10, tier * 3);
  const txt = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  if (tier < SUFFIX.length) return txt + SUFFIX[tier];
  tier -= SUFFIX.length;
  const a = "abcdefghijklmnopqrstuvwxyz";
  return txt + a[Math.floor(tier / 26) % 26] + a[tier % 26];
}

/** Every business grows through five stages as it levels up: a stand becomes a shop, a
 *  store, a flagship and finally an empire. Each stage has its own name and a bigger,
 *  richer room. */
export const STAGE_AT = [1, 25, 100, 200, 400];
export const STAGE_LABEL = ["Stand", "Shop", "Store", "Flagship", "Empire"];
export const STAGE_NAMES: Record<string, string[]> = {
  coffee: ["Coffee Cart", "Coffee Shop", "Corner Café", "Coffee House", "Coffee Empire"],
  flowers: ["Flower Kiosk", "Flower Shop", "Garden Boutique", "Botanical Hall", "Bloom Empire"],
  bakery: ["Cloud Bakery", "Bakery Shop", "Patisserie", "Grand Bakery", "Pastry Empire"],
  pizza: ["Pizza Place", "Pizzeria", "Trattoria", "Pizza Palace", "Pizza Empire"],
  cinema: ["Sky Cinema", "Movie Theater", "Multiplex", "Cinema Plaza", "Film Studio"],
  hotel: ["Cloud Hotel", "Boutique Hotel", "Grand Hotel", "Luxury Resort", "Hotel Empire"],
  mall: ["Sky Mall", "Shopping Center", "Mega Mall", "Shopping Plaza", "Mall Empire"],
  airport: ["Airship Port", "Airfield", "Sky Airport", "Air Hub", "Sky Gateway"],
  casino: ["Star Casino", "Game Hall", "Grand Casino", "Casino Resort", "Casino Empire"],
  spaceport: ["Space Port", "Launch Pad", "Space Center", "Star Base", "Galaxy Gate"],
};
/** Rush hour: one business earns this many times more for a short while. */
export const RUSH_MULT = 3, RUSH_SECONDS = 45;

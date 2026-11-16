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
  { id: "coffee", name: "Coffee Cart", icon: "coffee", color: ["#ffb36b", "#e0743a"], cost: 4, growth: 1.07, income: 1, cycle: 0.8, manager: 1000 },
  { id: "flowers", name: "Flower Kiosk", icon: "leaf", color: ["#ff9ac8", "#e8457a"], cost: 60, growth: 1.15, income: 60, cycle: 3, manager: 15000 },
  { id: "bakery", name: "Cloud Bakery", icon: "sun", color: ["#ffe27a", "#ffb13b"], cost: 720, growth: 1.14, income: 540, cycle: 6, manager: 100000 },
  { id: "pizza", name: "Pizza Place", icon: "dish", color: ["#ff8a6b", "#e0433a"], cost: 8640, growth: 1.13, income: 4320, cycle: 12, manager: 500000 },
  { id: "cinema", name: "Sky Cinema", icon: "film", color: ["#b48cff", "#6a3cff"], cost: 103680, growth: 1.12, income: 51840, cycle: 24, manager: 1.2e6 },
  { id: "hotel", name: "Cloud Hotel", icon: "building", color: ["#7fd3ff", "#3a8dff"], cost: 1244160, growth: 1.11, income: 622080, cycle: 96, manager: 1e7 },
  { id: "mall", name: "Sky Mall", icon: "gift", color: ["#5ee0a0", "#19a87a"], cost: 14929920, growth: 1.1, income: 7464960, cycle: 384, manager: 1.11e8 },
  { id: "airport", name: "Airship Port", icon: "airship", color: ["#9fe6ff", "#4f8bff"], cost: 179159040, growth: 1.09, income: 89579520, cycle: 1536, manager: 5.55e8 },
  { id: "casino", name: "Star Casino", icon: "star", color: ["#ffd23f", "#ff4f8b"], cost: 2149908480, growth: 1.08, income: 1074954000, cycle: 6144, manager: 1e10 },
  { id: "spaceport", name: "Space Port", icon: "rocket", color: ["#8a96ff", "#2a1f6e"], cost: 25798901760, growth: 1.07, income: 29668737024, cycle: 36864, manager: 1e11 },
];

/** Level milestones: reaching each one makes a business run twice as fast. */
export const MILESTONES_AT = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
/** Every Sky Gem adds this much to all earnings. */
export const GEM_BONUS = 0.02;
/** Offline earnings stop piling up after this long (longer with VIP). */
export const OFFLINE_HOURS = 8, OFFLINE_HOURS_VIP = 24;
/** Crystal prices for the boosts. */
export const COIN_BOOST_CRYSTALS = 1200;
export const WARP_4H_CRYSTALS = 100, WARP_24H_CRYSTALS = 400;
/** Lifetime coins needed for the first New Era gem (the formula is a square root of this). */
export const ERA_SCALE = 1e9;

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

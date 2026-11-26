import { LAND, type LandId } from "./land";
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
  /** The district it stands in (data/land.ts); none: the town. */
  land?: LandId;
}

/** The economy's two big dials: what every sale pays, and what every level and manager
 *  costs. A tougher economy pays less and charges more, so growing takes time (and
 *  crystals let a player hurry). */
export const PAY_K = 0.7, COST_K = 1.6, MANAGER_K = 1.5;

const BUSINESSES_BASE: Business[] = [
  { id: "coffee", name: "Coffee Cart", icon: "biz-coffee", color: ["#ffb36b", "#e0743a"], cost: 10, growth: 1.1, income: 1, cycle: 3, manager: 60 },
  { id: "flowers", name: "Flower Kiosk", icon: "biz-flowers", color: ["#ff9ac8", "#e8457a"], cost: 100, growth: 1.13, income: 12, cycle: 6, manager: 1200 },
  { id: "bakery", name: "Cloud Bakery", icon: "biz-bakery", color: ["#ffe27a", "#ffb13b"], cost: 1200, growth: 1.12, income: 110, cycle: 12, manager: 15000 },
  { id: "pizza", name: "Pizza Place", icon: "biz-pizza", color: ["#ff8a6b", "#e0433a"], cost: 14000, growth: 1.11, income: 1000, cycle: 24, manager: 180000 },
  { id: "cinema", name: "Sky Cinema", icon: "biz-cinema", color: ["#b48cff", "#6a3cff"], cost: 170000, growth: 1.1, income: 9000, cycle: 48, manager: 9e5 },
  { id: "hotel", name: "Cloud Hotel", icon: "biz-hotel", color: ["#7fd3ff", "#3a8dff"], cost: 4e6, growth: 1.11, income: 80000, cycle: 96, manager: 1.6e7 },
  { id: "mall", name: "Sky Mall", icon: "biz-mall", color: ["#5ee0a0", "#19a87a"], cost: 1.2e8, growth: 1.11, income: 700000, cycle: 192, manager: 5e8 },
  { id: "airport", name: "Airship Port", icon: "biz-airport", color: ["#9fe6ff", "#4f8bff"], cost: 4e9, growth: 1.1, income: 6e6, cycle: 384, manager: 1.6e10 },
  { id: "casino", name: "Starlight Stage", icon: "biz-casino", color: ["#ffd23f", "#ff4f8b"], cost: 1.5e11, growth: 1.1, income: 5.2e7, cycle: 768, manager: 6e11 },
  { id: "spaceport", name: "Space Port", icon: "biz-spaceport", color: ["#8a96ff", "#2a1f6e"], cost: 6e12, growth: 1.09, income: 4.5e8, cycle: 1536, manager: 2.4e13 },
  ...districtBusinesses(),
];
export const BUSINESSES: Business[] = BUSINESSES_BASE.map(b => ({ ...b, manager: Math.round(b.manager * MANAGER_K) }));

/** Each district's own six businesses, opened one after another once the district is bought:
 *  priced from the district's price, each about 14 times the one before, earning like a town
 *  business of the same price (the same curve of income and cycle time). */
function districtBusinesses(): Business[] {
  const D: [LandId, [string, string, string, string][]][] = [
    ["meadow", [["fishmarket", "Fish Market", "dish", "#7fd3ff"], ["surfshop", "Surf Shop", "sun", "#ffb13b"], ["boattours", "Boat Tours", "flag", "#4f8bff"], ["seafood", "Seafood Grill", "fire", "#ff8a5c"], ["marina", "Marina Club", "star", "#3ac0c0"], ["cruise", "Cruise Terminal", "globe", "#2f6fff"]]],
    ["lakeside", [["icecream", "Ice Cream Parlor", "gift", "#ff9ac8"], ["toystore", "Toy Store", "balloon", "#ffd23a"], ["gardencenter", "Garden Center", "leaf", "#5ee0a0"], ["pettingzoo", "Petting Zoo", "home", "#c89a5a"], ["themepark", "Theme Park", "star", "#ff5f8b"], ["golfclub", "Golf Club", "flag", "#19a87a"]]],
    ["hills", [["boutique", "Fashion Boutique", "gift", "#e8457a"], ["gym", "City Gym", "fire", "#ff8a3b"], ["startup", "Tech Startup", "sparkle", "#6a3cff"], ["bank", "Grand Bank", "gem", "#e8b020"], ["exchange", "Stock Exchange", "building", "#3a8dff"], ["tvstudio", "TV Studio", "film", "#b48cff"]]],
    ["resort", [["smoothiebar", "Smoothie Bar", "coffee", "#ff9a4a"], ["cabanaclub", "Cabana Club", "sun", "#ffd23a"], ["waterpark", "Water Park", "balloon", "#3ad0e8"], ["divecenter", "Dive Center", "globe", "#2f8fd8"], ["yachtclub", "Yacht Club", "flag", "#ff5f8b"], ["grandresort", "Grand Resort Hotel", "building", "#2ec4a0"]]],
    ["cloud", [["cloudspa", "Cloud Spa", "cloud", "#bfe6ff"], ["royalbakery", "Royal Bakery", "sun", "#ffe27a"], ["skyopera", "Sky Opera", "star", "#d9ccff"], ["palacehotel", "Palace Hotel", "building", "#ffd86a"], ["goldexchange", "Gold Exchange", "gem", "#e8b020"], ["royalball", "Royal Ball", "sparkle", "#ff9ac8"]]],
    ["crystal", [["gemshop", "Gem Shop", "gem", "#b48cff"], ["crystalcafe", "Crystal Café", "coffee", "#8af0ff"], ["lightshow", "Light Show", "sparkle", "#ff8ae0"], ["jewelry", "Jewelry House", "gem", "#7ad0ff"], ["crystallab", "Crystal Lab", "globe", "#9a7aff"], ["prismtower", "Prism Tower", "building", "#c8a8ff"]]],
    ["orbit", [["spacediner", "Space Diner", "dish", "#5ae0ff"], ["zerogym", "Zero-G Gym", "fire", "#8a96ff"], ["satellite", "Satellite Co.", "globe", "#3a8dff"], ["moontours", "Moon Tours", "rocket", "#c8d0e4"], ["rocketworks", "Rocket Works", "rocket", "#ff5f6d"], ["starport", "Star Port", "star", "#ffd23f"]]],
  ];
  // The town's curve: price to income and to cycle, read off between the town's businesses.
  const TOWN: [number, number, number][] = [[10, 1, 3], [100, 12, 6], [1200, 110, 12], [14000, 1000, 24], [170000, 9000, 48], [4e6, 80000, 96], [1.2e8, 7e5, 192], [4e9, 6e6, 384], [1.5e11, 5.2e7, 768], [6e12, 4.5e8, 1536]];
  const along = (cost: number): [number, number] => {
    const lc = Math.log10(cost);
    let a = TOWN[0], b = TOWN[1];
    for (let i = 0; i < TOWN.length - 1; i++) { a = TOWN[i]; b = TOWN[i + 1]; if (lc <= Math.log10(b[0])) break; }
    const f = (lc - Math.log10(a[0])) / (Math.log10(b[0]) - Math.log10(a[0]));
    return [10 ** (Math.log10(a[1]) + f * (Math.log10(b[1]) - Math.log10(a[1]))), 10 ** (Math.log10(a[2]) + f * (Math.log10(b[2]) - Math.log10(a[2])))];
  };
  const dark = (hex: string) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, k = 0.72; return "#" + [r, g, b].map(v => Math.round(v * k).toString(16).padStart(2, "0")).join(""); };
  const out: Business[] = [];
  for (const [land, list] of D) {
    const base = (LAND.find(l => l.id === land)?.min ?? 1e6) * 0.3;
    list.forEach(([id, name, icon, c], j) => {
      const cost = Math.round(base * 14 ** j), [income, cycle] = along(cost);
      out.push({ id, name, icon, color: [c, dark(c)], cost, growth: 1.1, income: Math.round(income), cycle: Math.round(cycle), manager: Math.round(cost * 4), land });
    });
  }
  return out;
}

/** Level milestones: reaching each one makes a business run twice as fast. */
export const MILESTONES_AT = [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000];
/** Every Sky Gem adds this much to all earnings. */
export const GEM_BONUS = 0.02;
/** Offline earnings stop piling up after this long (longer with VIP). */
export const OFFLINE_HOURS = 4, OFFLINE_HOURS_VIP = 12;
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
/** Skyhaven Inc.'s money is cash: 1234 → "$1.23K", 5.6e15 → "$5.60Qa", then aa, ab... */
export function coins(n: number): string {
  return (n < 0 ? "-$" : "$") + amount(Math.abs(n));
}
/** The number alone: 1234 → "1.23K". */
export function amount(n: number): string {
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
export const STAGE_AT = [1, 25, 100, 200, 400, 600, 800, 1000];
export const STAGE_LABEL = ["Stand", "Shop", "Store", "Flagship", "Empire", "Skyscraper", "Megatower", "Sky Wonder"];
export const STAGE_NAMES: Record<string, string[]> = new Proxy({

  coffee: ["Coffee Cart", "Coffee Shop", "Corner Café", "Coffee House", "Coffee Empire", "Coffee Tower", "Coffee Megatower", "Coffee Sky Wonder"],
  flowers: ["Flower Kiosk", "Flower Shop", "Garden Boutique", "Botanical Hall", "Bloom Empire", "Bloom Tower", "Bloom Megatower", "Bloom Sky Wonder"],
  bakery: ["Cloud Bakery", "Bakery Shop", "Patisserie", "Grand Bakery", "Pastry Empire", "Pastry Tower", "Pastry Megatower", "Pastry Sky Wonder"],
  pizza: ["Pizza Place", "Pizzeria", "Trattoria", "Pizza Palace", "Pizza Empire", "Pizza Tower", "Pizza Megatower", "Pizza Sky Wonder"],
  cinema: ["Sky Cinema", "Movie Theater", "Multiplex", "Cinema Plaza", "Film Studio", "Film Tower", "Film Megatower", "Film Sky Wonder"],
  hotel: ["Cloud Hotel", "Boutique Hotel", "Grand Hotel", "Luxury Resort", "Hotel Empire", "Hotel Tower", "Hotel Megatower", "Hotel Sky Wonder"],
  mall: ["Sky Mall", "Shopping Center", "Mega Mall", "Shopping Plaza", "Mall Empire", "Mall Tower", "Mall Megatower", "Mall Sky Wonder"],
  airport: ["Airship Port", "Airfield", "Sky Airport", "Air Hub", "Sky Gateway", "Sky Port Tower", "Sky Port Megatower", "Sky Port Wonder"],
  casino: ["Starlight Stage", "Concert Hall", "Starlight Arena", "Arena Resort", "Arena Empire", "Arena Tower", "Arena Megatower", "Arena Sky Wonder"],
  spaceport: ["Space Port", "Launch Pad", "Space Center", "Star Base", "Galaxy Gate", "Star Tower", "Star Megatower", "Galaxy Wonder"],
} as Record<string, string[]>, {
  // (The districts' businesses: their name, then grander versions of it.)
  get: (t, id: string) => t[id] ?? (() => { const n = BUSINESSES.find(b => b.id === id)?.name ?? id; return [n, `Big ${n}`, `Grand ${n}`, `${n} Plaza`, `${n} Empire`, `${n} Tower`, `${n} Megatower`, `${n} Sky Wonder`]; })(),
});
/** Rush hour: one business earns this many times more for a short while. */
export const RUSH_MULT = 3, RUSH_SECONDS = 45;

// ---------- Grand openings: every evolution needs its new headquarters built ----------

/** Floors the new headquarters needs, by the stage it opens (stage 0 needs none). */
export const HQ_FLOORS = [0, 15, 30, 50, 80, 100, 125, 150];
/** Each evolved stage doubles what a business earns. */
export const STAGE_MULT = 1.5;
/** A tower built with a perfect streak this long starts a construction boom... */
export const BOOM_STREAK = 10;
/** ...earning this much more for this long. */
export const BOOM_MULT = 2, BOOM_MINUTES = 10;

// ---------- Upgrades: one-time buys that multiply earnings ----------

export interface Upgrade {
  id: string;
  name: string;
  /** The business it boosts, or "all". */
  biz: string;
  mult: number;
  cost: number;
  icon: string;
}

const BIZ_UPGRADES: Record<string, [string, string, string]> = {
  coffee: ["Espresso Machine", "Barista Training", "Latte Art"],
  flowers: ["Greenhouse", "Delivery Bikes", "Wedding Contracts"],
  bakery: ["Stone Oven", "Night Shift", "Cake Atelier"],
  pizza: ["Wood-fired Oven", "Scooter Fleet", "Secret Sauce"],
  cinema: ["3D Glasses", "Popcorn Bar", "Giant Screen"],
  hotel: ["Rooftop Pool", "Spa", "Concierge"],
  mall: ["Escalators", "Food Court", "Fashion Week"],
  airport: ["Second Runway", "VIP Lounge", "Duty Free"],
  casino: ["Light Show", "VIP Box", "Encore"],
  spaceport: ["Reusable Rockets", "Moon Tours", "Warp Drive"],
};
/** Upgrade prices, as multiples of the business's first-level price. */
export const UPGRADE_COST = [5000, 1e6, 2e8];
export const UPGRADES: Upgrade[] = [
  ...BUSINESSES.flatMap(b => (BIZ_UPGRADES[b.id] ?? ["Better Tools", "Extra Staff", "Star Service"]).map((name, k) => ({ id: `${b.id}${k}`, name, biz: b.id, mult: 3, cost: b.cost * UPGRADE_COST[k], icon: b.icon }))),
  { id: "all0", name: "Neon Signs", biz: "all", mult: 2, cost: 1e7, icon: "sparkle" },
  { id: "all1", name: "City Billboards", biz: "all", mult: 2, cost: 1e9, icon: "star" },
  { id: "all2", name: "Sky Subway", biz: "all", mult: 2, cost: 1e11, icon: "rocket" },
].sort((a, b) => a.cost - b.cost);

// ---------- Advisors: collectible characters with perks ----------

export type Perk = "biz" | "all" | "vip" | "rush" | "away" | "tips";
export interface Advisor {
  id: string;
  name: string;
  /** What they're known for. */
  title: string;
  perk: Perk;
  /** For "biz": the businesses they boost. */
  biz?: string[];
  /** The perk's size (a multiplier, or hours for "away"). */
  n: number;
  /** Look: skin, hair, outfit colors and a hat or accessory. */
  look: { skin: string; hair: string; outfit: string; extra: "chef" | "glasses" | "cap" | "bow" | "beret" | "headset" | "none" | "crown" };
}
export const ADVISORS: Advisor[] = [
  { id: "leo", name: "Leo", title: "Coffee roaster", perk: "biz", biz: ["coffee"], n: 3, look: { skin: "#f2c39a", hair: "#3a2a1a", outfit: "#a0522d", extra: "cap" } },
  { id: "ivy", name: "Ivy", title: "Florist", perk: "biz", biz: ["flowers"], n: 3, look: { skin: "#f6d0b0", hair: "#c0504d", outfit: "#e8457a", extra: "bow" } },
  { id: "bruno", name: "Bruno", title: "Master baker", perk: "biz", biz: ["bakery"], n: 3, look: { skin: "#e0a87c", hair: "#5a3a22", outfit: "#ffffff", extra: "chef" } },
  { id: "rosa", name: "Chef Rosa", title: "Pizza chef", perk: "biz", biz: ["pizza"], n: 3, look: { skin: "#c98b62", hair: "#1c1640", outfit: "#e0433a", extra: "chef" } },
  { id: "stella", name: "Stella", title: "Showbiz star", perk: "biz", biz: ["cinema", "hotel"], n: 2, look: { skin: "#f6d0b0", hair: "#ffd23f", outfit: "#6a3cff", extra: "glasses" } },
  { id: "max", name: "Max", title: "Charmer", perk: "vip", n: 2, look: { skin: "#8d5a3b", hair: "#1c1640", outfit: "#ffc93c", extra: "glasses" } },
  { id: "penny", name: "Penny", title: "Hostess", perk: "tips", n: 3, look: { skin: "#f2c39a", hair: "#ff8a5c", outfit: "#19a87a", extra: "beret" } },
  { id: "nova", name: "Nova", title: "Hype planner", perk: "rush", n: 2, look: { skin: "#d9a07a", hair: "#b48cff", outfit: "#ff4f8b", extra: "headset" } },
  { id: "otto", name: "Otto", title: "Night manager", perk: "away", n: 4, look: { skin: "#e8b48a", hair: "#9a9aa8", outfit: "#2a3590", extra: "none" } },
  { id: "gus", name: "Gus", title: "Tycoon legend", perk: "all", n: 1.5, look: { skin: "#f2c39a", hair: "#e2e2ea", outfit: "#1c1640", extra: "crown" } },
];
/** Hiring an advisor of your choice costs this many crystals. */
export const CRATE_CRYSTALS = 150;

// ---------- The managers' vault: more hours away ----------

/** Each vault upgrade adds two hours of earning while away. */
export const VAULT_HOURS = 2;
export const VAULT_COST = [2e4, 2e6, 2e8];

// ---------- Weekly festival: one business earns more all week ----------

export const FESTIVAL_MULT = 2;

/** The daily rewards calendar: seven days, each better than the last; day 7 is the big one.
 *  Cash is minutes of your company's earnings (with a floor for young companies). The
 *  streak resets if a day is missed, and the week starts again after day 7. */
export interface DailyReward { cash?: number; min?: number; gems?: number; advisor?: boolean }
export const DAILY_REWARDS: DailyReward[] = [
  { cash: 20, min: 300 },
  { gems: 10 },
  { cash: 45, min: 800 },
  { gems: 15 },
  { cash: 90, min: 2000 },
  { gems: 25 },
  { advisor: true, gems: 50, cash: 180, min: 5000 },
];

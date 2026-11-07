// Tuning for the reasons to come back every day: the play streak, island rent and city
// buildings, and the weekly league.

/** Rewards for keeping a streak going. Each pays once, ever. */
export const STREAK_REWARDS: { day: number; stars: number; skin?: string }[] = [
  { day: 3, stars: 3 },
  { day: 7, stars: 8, skin: "ember" },
  { day: 14, stars: 13 },
  { day: 30, stars: 25, skin: "gilded" },
  { day: 60, stars: 45 },
  { day: 100, stars: 100 },
];

/** Streak freezes held at most; one is added each week. */
export const MAX_FREEZES = 2;

/** Rent: stars per hour from the people in your best tower, saved up for at most this long.
 *  (There used to be coins too; 100 coins became 1 star.) */
export const RENT_CAP_HOURS = 12;
export const MIN_RENT_PER_HOUR = 0.1;
/** Old saves' coins turn into stars at this rate. */
export const COINS_PER_STAR = 100;

export interface CityBuild {
  id: string;
  icon: string;
  name: string;
  text: string;
  price: number;
}

/** Buildings bought with stars. Each one also raises your rent by 15%. */
export const CITY: CityBuild[] = [
  { id: "cafe", icon: "☕", name: "Corner café", text: "Striped awning and tables outside", price: 3 },
  { id: "playground", icon: "🛝", name: "Playground", text: "Swings, a slide and a sandpit", price: 6 },
  { id: "statue", icon: "🗽", name: "Founder's statue", text: "A golden builder on a pedestal", price: 10 },
  { id: "windmill", icon: "🌾", name: "Windmill", text: "Its sails turn in the breeze", price: 16 },
  { id: "observatory", icon: "🔭", name: "Observatory", text: "A domed telescope for star-gazing", price: 26 },
  { id: "lighthouse", icon: "🗼", name: "Sky lighthouse", text: "Sweeps a beam across the night sky", price: 40 },
  { id: "rocket", icon: "🚀", name: "Rocket pad", text: "Every so often, a rocket launches", price: 70 },
];

export const RENT_BONUS_PER_BUILD = 0.15;

/** Weekly league tiers by points; points come from towers built this week. */
export const LEAGUES: { name: string; min: number; stars: number; color: string }[] = [
  { name: "Bronze", min: 0, stars: 0, color: "#d08b5b" },
  { name: "Silver", min: 400, stars: 2, color: "#c9d3e6" },
  { name: "Gold", min: 1200, stars: 4, color: "#ffd23f" },
  { name: "Diamond", min: 3000, stars: 7, color: "#7cf5ff" },
  { name: "Legend", min: 6000, stars: 12, color: "#ff6f9c" },
];

/** Stars in the chest for finishing all of today's missions. */
export const CHEST = { stars: 4 };

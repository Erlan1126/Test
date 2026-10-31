// Tuning for the reasons to come back every day: the play streak, island rent and city
// buildings, and the weekly league.

/** Rewards for keeping a streak going. Each pays once, ever. */
export const STREAK_REWARDS: { day: number; stars: number; coins: number; skin?: string }[] = [
  { day: 3, stars: 2, coins: 100 },
  { day: 7, stars: 5, coins: 250, skin: "ember" },
  { day: 14, stars: 8, coins: 500 },
  { day: 30, stars: 15, coins: 1000, skin: "gilded" },
  { day: 60, stars: 25, coins: 2000 },
  { day: 100, stars: 50, coins: 5000 },
];

/** Streak freezes held at most; one is added each week. */
export const MAX_FREEZES = 2;

/** Rent: coins per hour from the people in your best tower, saved up for at most this long. */
export const RENT_CAP_HOURS = 12;
export const MIN_RENT_PER_HOUR = 10;

export interface CityBuild {
  id: string;
  name: string;
  text: string;
  price: number;
}

/** Buildings bought with coins. Each one also raises your rent by 15%. */
export const CITY: CityBuild[] = [
  { id: "cafe", name: "Corner café", text: "Striped awning and tables outside", price: 150 },
  { id: "playground", name: "Playground", text: "Swings, a slide and a sandpit", price: 300 },
  { id: "statue", name: "Founder's statue", text: "A golden builder on a pedestal", price: 500 },
  { id: "windmill", name: "Windmill", text: "Its sails turn in the breeze", price: 800 },
  { id: "observatory", name: "Observatory", text: "A domed telescope for star-gazing", price: 1300 },
  { id: "lighthouse", name: "Sky lighthouse", text: "Sweeps a beam across the night sky", price: 2000 },
  { id: "rocket", name: "Rocket pad", text: "Every so often, a rocket launches", price: 3500 },
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

/** Coins and stars in the chest for finishing all of today's missions. */
export const CHEST = { stars: 2, coins: 150 };

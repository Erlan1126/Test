import type { RunSummary } from "../logic/types";

/** What trophies can look at besides the tower just built. */
export interface TrophyContext {
  dailyDays: number;
  giftStreak: number;
  skinsUnlocked: number;
  challengesDone: number;
  /** Lifetime totals. */
  towers: number;
  floors: number;
  perfects: number;
  level: number;
  population: number;
}

export interface Trophy {
  id: string;
  name: string;
  text: string;
  /** Can be earned in Zen mode. */
  zen?: boolean;
  test(run: RunSummary | null, ctx: TrophyContext): boolean;
}

// Trophies are meant to take a while: a few come in the first days, most over weeks.
export const TROPHIES: Trophy[] = [
  { id: "first", name: "Groundbreaker", text: "Build your first tower", zen: true, test: run => !!run },
  { id: "f25", name: "Getting Tall", text: "Build 40 floors in one tower", test: run => !!run && run.floors >= 40 },
  { id: "f60", name: "Sky High", text: "Build 100 floors in one tower", test: run => !!run && run.floors >= 100 },
  { id: "liberty", name: "Lady Liberty", text: "Build taller than the Statue of Liberty", test: run => !!run && run.meters > 93 },
  { id: "eiffel", name: "Parisian", text: "Build taller than the Eiffel Tower", test: run => !!run && run.meters > 330 },
  { id: "burj", name: "World Record", text: "Build taller than the Burj Khalifa", test: run => !!run && run.meters > 828 },
  { id: "jeddah", name: "Above the Clouds", text: "Build taller than the Jeddah Tower", test: run => !!run && run.meters > 1000 },
  { id: "s10", name: "In the Zone", text: "Get a perfect streak of 15", test: run => !!run && run.bestStreak >= 15 },
  { id: "s25", name: "Laser Focus", text: "Get a perfect streak of 40", test: run => !!run && run.bestStreak >= 40 },
  { id: "s60", name: "Untouchable", text: "Get a perfect streak of 75", test: run => !!run && run.bestStreak >= 75 },
  { id: "p1000", name: "Small Town", text: "House 2,500 people in one tower", test: run => !!run && run.score >= 2500 },
  { id: "p3000", name: "Big City", text: "House 10,000 people in one tower", test: run => !!run && run.score >= 10000 },
  { id: "gold3", name: "Golden Touch", text: "Land 6 penthouses perfectly in one tower", test: run => !!run && run.penthouses >= 6 },
  { id: "comeback", name: "Second Wind", text: "Build 25 floors after a rewind", test: run => !!run && run.afterRewind >= 25 },
  { id: "daily3", name: "Regular", text: "Play the daily tower on 7 different days", zen: true, test: (_r, c) => c.dailyDays >= 7 },
  { id: "daily30", name: "Daily Devotee", text: "Play the daily tower on 30 different days", zen: true, test: (_r, c) => c.dailyDays >= 30 },
  { id: "week", name: "Dedicated", text: "Claim the daily gift 14 days in a row", zen: true, test: (_r, c) => c.giftStreak >= 14 },
  { id: "zen50", name: "Inner Peace", text: "Build 50 floors in one Zen tower", zen: true, test: run => !!run && run.mode === "zen" && run.floors >= 50 },
  { id: "skins6", name: "Collector", text: "Unlock 10 tower skins", zen: true, test: (_r, c) => c.skinsUnlocked >= 10 },
  { id: "challenger", name: "Challenger", text: "Complete 10 Journey stages", zen: true, test: (_r, c) => c.challengesDone >= 10 },
  { id: "towers25", name: "Busy Builder", text: "Build 25 towers", zen: true, test: (_r, c) => c.towers >= 25 },
  { id: "towers100", name: "Master Builder", text: "Build 100 towers", zen: true, test: (_r, c) => c.towers >= 100 },
  { id: "floors2000", name: "Skyline Maker", text: "Build 2,000 floors in all", zen: true, test: (_r, c) => c.floors >= 2000 },
  { id: "perfect1000", name: "Perfectionist", text: "Land 1,000 perfect drops in all", zen: true, test: (_r, c) => c.perfects >= 1000 },
  { id: "level15", name: "Seasoned", text: "Reach builder level 15", zen: true, test: (_r, c) => c.level >= 15 },
  { id: "metropolis", name: "Metropolis", text: "Grow Skyhaven to 100,000 people", zen: true, test: (_r, c) => c.population >= 100000 },
];

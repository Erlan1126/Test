import type { RunSummary } from "../logic/types";

/** What trophies can look at besides the tower just built. */
export interface TrophyContext {
  dailyDays: number;
  giftStreak: number;
  skinsUnlocked: number;
  challengesDone: number;
}

export interface Trophy {
  id: string;
  name: string;
  text: string;
  /** Can be earned in Zen mode. */
  zen?: boolean;
  test(run: RunSummary | null, ctx: TrophyContext): boolean;
}

export const TROPHIES: Trophy[] = [
  { id: "first", name: "Groundbreaker", text: "Build your first tower", zen: true, test: run => !!run },
  { id: "f25", name: "Getting Tall", text: "Build 25 floors in one tower", test: run => !!run && run.floors >= 25 },
  { id: "f60", name: "Sky High", text: "Build 60 floors in one tower", test: run => !!run && run.floors >= 60 },
  { id: "liberty", name: "Lady Liberty", text: "Build taller than the Statue of Liberty", test: run => !!run && run.meters > 93 },
  { id: "eiffel", name: "Parisian", text: "Build taller than the Eiffel Tower", test: run => !!run && run.meters > 330 },
  { id: "burj", name: "World Record", text: "Build taller than the Burj Khalifa", test: run => !!run && run.meters > 828 },
  { id: "s10", name: "In the Zone", text: "Get a perfect streak of 10", test: run => !!run && run.bestStreak >= 10 },
  { id: "s25", name: "Laser Focus", text: "Get a perfect streak of 25", test: run => !!run && run.bestStreak >= 25 },
  { id: "p1000", name: "Small Town", text: "House 1,000 people in one tower", test: run => !!run && run.score >= 1000 },
  { id: "p3000", name: "Big City", text: "House 3,000 people in one tower", test: run => !!run && run.score >= 3000 },
  { id: "gold3", name: "Golden Touch", text: "Land 3 penthouses perfectly in one tower", test: run => !!run && run.penthouses >= 3 },
  { id: "comeback", name: "Second Wind", text: "Build 10 floors after a rewind", test: run => !!run && run.afterRewind >= 10 },
  { id: "daily3", name: "Regular", text: "Play the daily tower on 3 different days", zen: true, test: (_r, c) => c.dailyDays >= 3 },
  { id: "week", name: "Dedicated", text: "Claim the daily gift 7 days in a row", zen: true, test: (_r, c) => c.giftStreak >= 7 },
  { id: "zen50", name: "Inner Peace", text: "Build 50 floors in one Zen tower", zen: true, test: run => !!run && run.mode === "zen" && run.floors >= 50 },
  { id: "skins6", name: "Collector", text: "Unlock 6 tower skins", zen: true, test: (_r, c) => c.skinsUnlocked >= 6 },
  { id: "challenger", name: "Challenger", text: "Complete 3 landmark challenges", zen: true, test: (_r, c) => c.challengesDone >= 3 },
];

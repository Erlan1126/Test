// The story of Skyhaven, told by Mayor Pip in chapters. Each chapter has three goals made
// from things the player does anyway (towers, height, people, city buildings...); finishing
// all three pays a reward and opens the next chapter. It gives the game a beginning, a
// middle and an end: from an empty meadow to the capital of the sky.
import { usedFloors } from "../logic/tycoon";
import { RANKS } from "./ranks";
import type { SaveData } from "../logic/save";

export interface ChapterGoal {
  /** "Build {n} towers" style text; {n} is the target. */
  text: string;
  need: number;
  have: (s: SaveData) => number;
}

export interface Chapter {
  title: string;
  /** What Mayor Pip says when the chapter starts. */
  intro: string;
  /** What Mayor Pip says when it's done. */
  outro: string;
  goals: ChapterGoal[];
  reward: { stars: number; crystals: number };
}

const towers = (s: SaveData) => s.profile.towers;
const best = (s: SaveData) => s.bestMeters;
const managers = (s: SaveData) => s.tycoon.managers.length;
const businesses = (s: SaveData) => Object.keys(s.tycoon.levels).length;
const terrace = (s: SaveData) => (s.cafe.terrace === 2 ? 1 : 0);
const projects = (s: SaveData) => s.cafe.done.length;
const grown = (s: SaveData) => Object.values(s.tycoon.evolved).filter(v => v >= 1).length;
/** All business levels together (as for the town's rank; a rank reached is kept for good). */
const levels = (s: SaveData) => Math.max(usedFloors(s), RANKS[Math.min(RANKS.length - 1, s.tycoon.rankBest ?? 0)].at);

// One chapter per town rank: Pip's story and the goal bar in the town tell the same story.
// The last goal of each chapter is the rank itself.
export const CHAPTERS: Chapter[] = [
  {
    title: "The Village",
    intro: "Welcome to Skyhaven! Your first neighbor needs a place to sit and a busier street. Grow the businesses and our hamlet becomes a village, with a street market!",
    outro: "We're a village! Hear that? Stalls, shoppers, music in the plaza. And it all started with one coffee.",
    goals: [
      { text: "Build {n} towers", need: 3, have: towers },
      { text: "Open the café terrace", need: 1, have: terrace },
      { text: "Reach {n} business levels", need: 50, have: levels },
    ],
    reward: { stars: 10, crystals: 20 },
  },
  {
    title: "The Town",
    intro: "A village needs a heart. Give the block its next project, put managers to work, and Skyhaven becomes a town: with its own little tram!",
    outro: "Ding ding! The tram is running. Your neighbor already has a favorite seat by the window.",
    goals: [
      { text: "Finish a block project", need: 1, have: projects },
      { text: "Hire {n} managers", need: 3, have: managers },
      { text: "Reach {n} business levels", need: 150, have: levels },
    ],
    reward: { stars: 15, crystals: 30 },
  },
  {
    title: "The City",
    intro: "Shops are growing into stores. Build their headquarters, and Skyhaven turns into a real city, bright lights on every corner.",
    outro: "Look at those billboards glow! People come from the other islands just to see our streets.",
    goals: [
      { text: "Grow {n} businesses with a new HQ", need: 2, have: grown },
      { text: "Build a tower {n} m tall", need: 60, have: best },
      { text: "Reach {n} business levels", need: 300, have: levels },
    ],
    reward: { stars: 20, crystals: 40 },
  },
  {
    title: "The Big City",
    intro: "The whole sky is noticing us. Open more businesses and finish the block, and the airships will start coming to Skyhaven.",
    outro: "Airships over Skyhaven! Visitors from every island. We're a big city now.",
    goals: [
      { text: "Open {n} businesses", need: 6, have: businesses },
      { text: "Finish both block projects", need: 2, have: projects },
      { text: "Reach {n} business levels", need: 500, have: levels },
    ],
    reward: { stars: 30, crystals: 60 },
  },
  {
    title: "The Metropolis",
    intro: "There's no more room on the island, so we'll build on the floating islands next door. Grow, and a skyline rises over the clouds!",
    outro: "A skyline on the floating islands! I remember when all of this was a meadow.",
    goals: [
      { text: "Open {n} businesses", need: 8, have: businesses },
      { text: "Build a tower {n} m tall", need: 150, have: best },
      { text: "Reach {n} business levels", need: 800, have: levels },
    ],
    reward: { stars: 40, crystals: 80 },
  },
  {
    title: "Capital of the sky",
    intro: "One last dream: make Skyhaven the capital of the sky, and raise the golden Skyhaven Tower for everyone who lives here.",
    outro: "You did it! Skyhaven is the capital of the sky, and you built every floor of it. Thank you, builder!",
    goals: [
      { text: "Open all {n} businesses", need: 10, have: businesses },
      { text: "Build a tower {n} m tall", need: 300, have: best },
      { text: "Reach {n} business levels", need: 1200, have: levels },
    ],
    reward: { stars: 60, crystals: 150 },
  },
];

/** Saves from the old chapters (islands and people) move to these: the chapters whose goals
 *  are already met count as done, without paying their reward again. */
export const CHAPTERS_V = 2;
export function migrateChapters(s: SaveData): boolean {
  if (s.chapters.v === CHAPTERS_V) return false;
  let done = 0;
  while (done < CHAPTERS.length && s.chapters.done > 0 && CHAPTERS[done].goals.every(g => g.have(s) >= g.need)) done++;
  s.chapters = { done, seen: done - 1, v: CHAPTERS_V };
  return true;
}

/** The chapter the player is on (CHAPTERS.length once the story is finished). */
export const chapterIndex = (s: SaveData): number => Math.min(s.chapters.done, CHAPTERS.length);
export const goalDone = (s: SaveData, g: ChapterGoal): boolean => g.have(s) >= g.need;
export const chapterReady = (s: SaveData): boolean => {
  const c = CHAPTERS[chapterIndex(s)];
  return !!c && c.goals.every(g => goalDone(s, g));
};

/** Pays the finished chapter and moves on. Returns its reward, or null if not ready. */
export function claimChapter(s: SaveData): Chapter["reward"] | null {
  if (!chapterReady(s)) return null;
  const c = CHAPTERS[chapterIndex(s)];
  s.chapters.done++;
  s.stars += c.reward.stars;
  s.starsEarned += c.reward.stars;
  s.crystals += c.reward.crystals;
  return c.reward;
}

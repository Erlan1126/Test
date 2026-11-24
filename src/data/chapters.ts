// The story of Skyhaven, told by Mayor Pip in chapters. Each chapter has three goals made
// from things the player does anyway (towers, height, people, city buildings...); finishing
// all three pays a reward and opens the next chapter. It gives the game a beginning, a
// middle and an end: from an empty meadow to the capital of the sky.
import { payStars } from "../logic/tycoon";
import { HAS_CITY } from "../edition";
import { townRank, usedFloors } from "../logic/tycoon";
import { RANKS } from "./ranks";
import { BUSINESSES } from "./tycoon";
import type { LandId } from "./land";
import type { SaveData } from "../logic/save";

export interface ChapterGoal {
  /** "Build {n} towers" style text; {n} is the target. */
  text: string;
  need: number;
  have: (s: SaveData) => number;
  /** What kind of step it is (what the Next step card sends the player to do). */
  kind?: "towers" | "height" | "terrace" | "levels" | "projects" | "managers" | "grown" | "open" | "land" | "landOpen" | "builds" | "offices";
  /** The district a "land" or "landOpen" goal is about. */
  land?: LandId;
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
/** All business levels together. A rank already reached (kept through a New Era) counts as met;
 *  the next one counts real levels only, so Pip and the town's goal bar always agree. */
const levelsFor = (need: number) => (s: SaveData) => (need <= RANKS[townRank(s)].at ? need : usedFloors(s));
const lv = (need: number): ChapterGoal => ({ text: "Reach {n} business levels", need, have: levelsFor(need), kind: "levels" });
// (The city game starts in the city: its chapters ask for city builds, not towers.)
const tw = (need: number): ChapterGoal => HAS_CITY
  // (Towers built before count too, so no one who played the tower way is held back.)
  ? { text: "Finish {n} builds", need, have: s => (s.tycoon.built ?? 0) + s.profile.towers, kind: "builds" }
  : { text: "Build {n} towers", need, have: towers, kind: "towers" };
const ht = (need: number): ChapterGoal => HAS_CITY
  ? { text: "Build {n} office blocks", need: Math.max(2, Math.round(need / 25)), have: s => Math.max(s.tycoon.offices ?? 0, Math.floor(s.bestMeters / 25)), kind: "offices" }
  : { text: "Build a tower {n} m tall", need, have: best, kind: "height" };
const open = (need: number, text = "Open {n} businesses"): ChapterGoal => ({ text, need, have: businesses, kind: "open" });
const townOpen = (s: SaveData) => BUSINESSES.filter(b => !b.land && (s.tycoon.levels[b.id] ?? 0) > 0).length;
/** Owning a district. */
const own = (land: LandId, name: string): ChapterGoal => ({ text: `Buy the ${name}`, need: 1, have: s => (s.land.includes(land) ? 1 : 0), kind: "land", land });
/** Businesses open in a district. */
const inLand = (land: LandId, name: string, need: number): ChapterGoal => ({ text: `Open {n} businesses in the ${name}`, need, have: s => BUSINESSES.filter(b => b.land === land && (s.tycoon.levels[b.id] ?? 0) > 0).length, kind: "landOpen", land });

// One chapter per town rank: Pip's story and the goal bar in the town tell the same story.
// The last goal of each chapter is the rank itself.
export const CHAPTERS: Chapter[] = [
  {
    title: "The Village",
    intro: "Welcome to Skyhaven! Your first neighbor needs a place to sit and a busier street. Grow the businesses and our hamlet becomes a village, with a street market!",
    outro: "We're a village! Hear that? Stalls, shoppers, music in the plaza. And it all started with one coffee.",
    goals: [
      tw(3),
      { text: "Open the café terrace", need: 1, have: terrace, kind: "terrace" },
      lv(50),
    ],
    reward: { stars: 10, crystals: 20 },
  },
  {
    title: "The Town",
    intro: "A village needs a heart. Give the block its next project, put managers to work, and Skyhaven becomes a town: with its own little tram!",
    outro: "Ding ding! The tram is running. Your neighbor already has a favorite seat by the window.",
    goals: [
      { text: "Finish a block project", need: 1, have: projects, kind: "projects" },
      { text: "Hire {n} managers", need: 3, have: managers, kind: "managers" },
      lv(150),
    ],
    reward: { stars: 15, crystals: 30 },
  },
  {
    title: "The City",
    intro: "Shops are growing into stores. Build their headquarters, and Skyhaven turns into a real city, bright lights on every corner.",
    outro: "Look at those billboards glow! People come from the other islands just to see our streets.",
    goals: [
      { text: "Grow {n} businesses with a new HQ", need: 2, have: grown, kind: "grown" },
      ht(60),
      lv(300),
    ],
    reward: { stars: 20, crystals: 40 },
  },
  {
    title: "The Big City",
    intro: "The whole sky is noticing us. Open more businesses and finish the block, and the airships will start coming to Skyhaven.",
    outro: "Airships over Skyhaven! Visitors from every island. We're a big city now.",
    goals: [
      open(6),
      { text: "Finish both block projects", need: 2, have: projects, kind: "projects" },
      lv(500),
    ],
    reward: { stars: 30, crystals: 60 },
  },
  {
    title: "Harbor District",
    intro: "The town is full! West of the square there's room for a harbor: boats, a fish market, a lighthouse. Buy the land and open its first businesses.",
    outro: "Smell that sea air? Fishing boats in, tourists off the ferry. The harbor was the right call.",
    goals: [own("meadow", "Harbor District"), inLand("meadow", "Harbor District", 3), lv(800)],
    reward: { stars: 40, crystals: 80 },
  },
  {
    title: "Garden Hills",
    intro: "Families want to live here now. East of town, Garden Hills has room for parks, a lake and big homes. Let's make it ours.",
    outro: "A Ferris wheel over the lake! Every family in the sky wants to move to Garden Hills.",
    goals: [own("lakeside", "Garden Hills"), inLand("lakeside", "Garden Hills", 3), open(10, "Open all {n} businesses in town")].map((g, i) => (i === 2 ? { ...g, have: townOpen } : g)),
    reward: { stars: 50, crystals: 100 },
  },
  {
    title: "Downtown",
    intro: "Big companies are calling. Downtown is where the towers go: offices, banks, a stock exchange. Build our business quarter!",
    outro: "Look at that skyline! Downtown makes us the business capital of the islands.",
    goals: [own("hills", "Downtown"), inLand("hills", "Downtown", 3), lv(1200)],
    reward: { stars: 60, crystals: 120 },
  },
  {
    title: "Cloud Kingdom",
    intro: "There's no more ground left, so we build up: a whole city on the clouds above Skyhaven, with marble villas and a golden palace.",
    outro: "A kingdom in the clouds! I had to hold on to my hat on the way up.",
    goals: [own("cloud", "Cloud Kingdom"), inLand("cloud", "Cloud Kingdom", 3), ht(150)],
    reward: { stars: 70, crystals: 150 },
  },
  {
    title: "Crystal Spire",
    intro: "Higher still: glowing crystal towers round a giant spire. It will light up the whole sky at night.",
    outro: "The spire shines all the way to the horizon. Ships steer by it now!",
    goals: [own("crystal", "Crystal Spire"), inLand("crystal", "Crystal Spire", 3), open(30)],
    reward: { stars: 80, crystals: 180 },
  },
  {
    title: "Capital of the sky",
    intro: "One last dream: Orbit Station, at the very top of the sky city. Open every business in Skyhaven and make it the capital of the sky.",
    outro: "You did it! Skyhaven is the capital of the sky, and you built every floor of it. Thank you, builder!",
    goals: [own("orbit", "Orbit Station"), open(BUSINESSES.length, "Open all {n} businesses"), ht(300)],
    reward: { stars: 100, crystals: 250 },
  },
];

/** Saves from the old chapters (islands and people) move to these: the chapters whose goals
 *  are already met count as done, without paying their reward again. */
export const CHAPTERS_V = 3;
export function migrateChapters(s: SaveData): boolean {
  if (s.chapters.v === CHAPTERS_V) return false;
  let done = 0;
  // (Never past the chapters they'd already finished: a later chapter that's met pays normally.)
  const old = s.chapters.done;
  while (done < Math.min(CHAPTERS.length, old) && CHAPTERS[done].goals.every(g => g.have(s) >= g.need)) done++;
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
export function claimChapter(s: SaveData): (Chapter["reward"] & { cash: number }) | null {
  if (!chapterReady(s)) return null;
  const c = CHAPTERS[chapterIndex(s)];
  s.chapters.done++;
  // (In the city game the stars come as cash: see payStars.)
  const cash = payStars(s, c.reward.stars);
  s.crystals += c.reward.crystals;
  return { ...c.reward, cash };
}

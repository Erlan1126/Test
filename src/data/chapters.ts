// The story of Skyhaven, told by Mayor Pip in chapters. Each chapter has three goals made
// from things the player does anyway (towers, height, people, city buildings...); finishing
// all three pays a reward and opens the next chapter. It gives the game a beginning, a
// middle and an end: from an empty meadow to the capital of the sky.
import { payLevelUp, perSecond, stageName } from "../logic/tycoon";
import { HAS_CITY } from "../edition";
import { townRank, usedFloors } from "../logic/tycoon";
import { isLot } from "../logic/props";
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
  kind?: "towers" | "height" | "terrace" | "levels" | "projects" | "managers" | "grown" | "open" | "land" | "landOpen" | "builds" | "offices"
    | "income" | "milestone" | "hq" | "biz" | "homes" | "decor" | "golden";
  /** The district a "land" or "landOpen" goal is about. */
  land?: LandId;
  /** The business a "biz" (open it) or "hq" (build its headquarters) goal is about. */
  biz?: string;
  /** "hq": the stage its new headquarters grows it to. */
  stage?: number;
  /** "milestone": the level ({lv} in the text) each business must reach. */
  lv?: number;
  /** The target and progress are cash (shown as $). */
  cash?: boolean;
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
/** The city game asks for more (each City Hall level should take a few play sessions, not
 *  minutes): `city` there, `need` in the tower game. */
const pick = (need: number, city: number) => (HAS_CITY ? city : need);
// (The city game starts in the city: its chapters ask for city builds, not towers.)
const tw = (need: number): ChapterGoal => HAS_CITY
  // (Towers built before count too, so no one who played the tower way is held back.)
  ? { text: "Finish {n} builds", need, have: s => (s.tycoon.built ?? 0) + s.profile.towers, kind: "builds" }
  : { text: "Build {n} towers", need, have: towers, kind: "towers" };
// (The city game has no office floors to build: managers stand in for height.)
const ht = (need: number): ChapterGoal => HAS_CITY
  ? { text: "Hire {n} managers", need: Math.max(4, Math.round(need / 10)), have: managers, kind: "managers" }
  : { text: "Build a tower {n} m tall", need, have: best, kind: "height" };
const open = (need: number, text = "Open {n} businesses"): ChapterGoal => ({ text, need, have: businesses, kind: "open" });
const townOpen = (s: SaveData) => BUSINESSES.filter(b => !b.land && (s.tycoon.levels[b.id] ?? 0) > 0).length;
/** Owning a district. */
const own = (land: LandId, name: string): ChapterGoal => ({ text: `Buy the ${name}`, need: 1, have: s => (s.land.includes(land) ? 1 : 0), kind: "land", land });
/** Businesses open in a district. */
const inLand = (land: LandId, name: string, need: number): ChapterGoal => ({ text: `Open {n} businesses in the ${name}`, need, have: s => BUSINESSES.filter(b => b.land === land && (s.tycoon.levels[b.id] ?? 0) > 0).length, kind: "landOpen", land });

/** Coins a second the managers make, without short boosts (a grand opening or a rush hour
 *  never finishes a goal that's gone again a minute later). As of the last tick. */
const earning = (s: SaveData) => perSecond(s, s.tycoon.last || Date.now(), false);
/** Earning so much a second. */
const income = (need: number): ChapterGoal => ({ text: "Earn {n} a second", need, have: earning, kind: "income", cash: true });
/** Businesses at a speed milestone level (each milestone doubles a business's speed). */
const speed = (need: number, level: number): ChapterGoal => ({ text: "Get {n} businesses to level {lv}", need, lv: level, have: s => Object.values(s.tycoon.levels).filter(l => l >= level).length, kind: "milestone" });
/** A business's new headquarters, grown to a stage. */
const hq = (id: string, stage: number): ChapterGoal => ({ text: "Build the {name} HQ", need: 1, biz: id, stage, have: s => ((s.tycoon.evolved[id] ?? 0) >= stage ? 1 : 0), kind: "hq" });
/** Opening one business. */
const openBiz = (id: string): ChapterGoal => ({ text: "Open the {name}", need: 1, biz: id, have: s => ((s.tycoon.levels[id] ?? 0) > 0 ? 1 : 0), kind: "biz" });
/** Every home built on a lot or made bigger: the levels the city's homes have grown. */
export const homeBuilds = (s: SaveData): number => Object.entries(s.props).reduce((a, [k, l]) => a + Math.max(0, l - (isLot(k) ? 0 : 1)), 0);
const homes = (need: number): ChapterGoal => ({ text: "Build or upgrade {n} homes", need, have: homeBuilds, kind: "homes" });
/** Decorations standing in the city now. */
const decor = (need: number): ChapterGoal => ({ text: "Place {n} decorations", need, have: s => Object.values(s.placed).filter(Boolean).length, kind: "decor" });
/** Golden customers caught, all time. */
const golden = (need: number): ChapterGoal => ({ text: "Serve {n} golden customers", need, have: s => s.tycoon.goldenAll ?? 0, kind: "golden" });
/** The city game's goals, or the tower game's (which stay as they were). */
const city = (c: ChapterGoal[], tower: ChapterGoal[]): ChapterGoal[] => (HAS_CITY ? c : tower);

/** The name in a goal's text ({name}: the business, or its new HQ), in English. */
export const goalName = (g: ChapterGoal): string => (!g.biz ? "" : g.kind === "hq" ? stageName(g.biz, g.stage ?? 1) : BUSINESSES.find(b => b.id === g.biz)?.name ?? g.biz);

// One chapter per town rank: Pip's story and the goal bar in the town tell the same story.
// In the tower game the last goal of each chapter is the rank itself. The city game asks for
// varied steps instead (open a business, build an HQ, earn so much a second, homes,
// decorations, golden customers), each about as long as the others: see scripts/pacing-sim.ts
// for how long each City Hall level takes.
export const CHAPTERS: Chapter[] = [
  {
    title: "The Village",
    intro: "Welcome to Skyhaven! Your first neighbor needs a place to sit and a busier street. Grow the businesses and our hamlet becomes a village, with a street market!",
    outro: "We're a village! Hear that? Stalls, shoppers, music in the plaza. And it all started with one coffee.",
    goals: city(
      [{ text: "Open the café terrace", need: 1, have: terrace, kind: "terrace" }, openBiz("flowers"), tw(3)],
      [tw(3), { text: "Open the café terrace", need: 1, have: terrace, kind: "terrace" }, lv(50)],
    ),
    reward: { stars: 10, crystals: 20 },
  },
  {
    title: "The Town",
    intro: "A village needs a heart. Give the block its next project, put managers to work, and Skyhaven becomes a town: with its own little tram!",
    outro: "Ding ding! The tram is running. Your neighbor already has a favorite seat by the window.",
    goals: city(
      [{ text: "Build the Flower market or the Playground", need: 1, have: projects, kind: "projects" }, { text: "Hire {n} managers", need: 4, have: managers, kind: "managers" }, income(6e3)],
      [{ text: "Finish a block project", need: 1, have: projects, kind: "projects" }, { text: "Hire {n} managers", need: 3, have: managers, kind: "managers" }, lv(150)],
    ),
    reward: { stars: 15, crystals: 30 },
  },
  {
    title: "The City",
    intro: "Shops are growing into stores. Build their headquarters, and Skyhaven turns into a real city, bright lights on every corner.",
    outro: "Look at those billboards glow! People come from the other islands just to see our streets.",
    goals: city(
      [openBiz("cinema"), decor(3), hq("coffee", 2), speed(4, 50)],
      [{ text: "Grow {n} businesses with a new HQ", need: 2, have: grown, kind: "grown" }, ht(60), lv(300)],
    ),
    reward: { stars: 20, crystals: 40 },
  },
  {
    title: "The Big City",
    intro: "The whole sky is noticing us. Open more businesses and finish the block, and the airships will start coming to Skyhaven.",
    outro: "Airships over Skyhaven! Visitors from every island. We're a big city now.",
    goals: city(
      [openBiz("airport"), homes(30), income(60e6)],
      [open(6), { text: "Finish both block projects", need: 2, have: projects, kind: "projects" }, lv(500)],
    ),
    reward: { stars: 30, crystals: 60 },
  },
  {
    title: "Harbor District",
    intro: "The town is full! West of the square there's room for a harbor: boats, a fish market, a lighthouse. Buy the land and open its first businesses.",
    outro: "Smell that sea air? Fishing boats in, tourists off the ferry. The harbor was the right call.",
    goals: [own("meadow", "Harbor District"), inLand("meadow", "Harbor District", pick(3, 4)), ...city([golden(12)], [lv(800)])],
    reward: { stars: 40, crystals: 80 },
  },
  {
    title: "Garden Hills",
    intro: "Families want to live here now. East of town, Garden Hills has room for parks, a lake and big homes. Let's make it ours.",
    outro: "A Ferris wheel over the lake! Every family in the sky wants to move to Garden Hills.",
    goals: city(
      [own("lakeside", "Garden Hills"), openBiz("spaceport"), income(6e9)],
      [own("lakeside", "Garden Hills"), inLand("lakeside", "Garden Hills", 3), { ...open(10, "Open all {n} businesses in town"), have: townOpen }],
    ),
    reward: { stars: 50, crystals: 100 },
  },
  {
    title: "Downtown",
    intro: "Big companies are calling. Downtown is where the towers go: offices, banks, a stock exchange. Build our business quarter!",
    outro: "Look at that skyline! Downtown makes us the business capital of the islands.",
    goals: [own("hills", "Downtown"), inLand("hills", "Downtown", pick(3, 4)), ...city([income(15e9)], [lv(1200)])],
    reward: { stars: 60, crystals: 120 },
  },
  {
    title: "Cloud Kingdom",
    intro: "There's no more ground left, so we build up: a whole city on the clouds above Skyhaven, with marble villas and a golden palace.",
    outro: "A kingdom in the clouds! I had to hold on to my hat on the way up.",
    goals: [own("cloud", "Cloud Kingdom"), inLand("cloud", "Cloud Kingdom", pick(3, 4)), ht(pick(150, 160))],
    reward: { stars: 70, crystals: 150 },
  },
  {
    title: "Crystal Spire",
    intro: "Higher still: glowing crystal towers round a giant spire. It will light up the whole sky at night.",
    outro: "The spire shines all the way to the horizon. Ships steer by it now!",
    goals: [own("crystal", "Crystal Spire"), inLand("crystal", "Crystal Spire", pick(3, 2)), open(30)],
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
 *  are already met count as done, without paying their reward again.
 *
 *  Version 4 changed the city game's goals (earnings, speed milestones, HQs, homes, golden
 *  customers instead of business-level counts). A save from version 3 keeps its City Hall
 *  level as it is: its goals are worked out from the city as it stands, so a chapter half
 *  done stays about half done. Only golden customers weren't counted before: each City Hall
 *  level already reached counts for two, so that goal doesn't start from nothing. */
export const CHAPTERS_V = 4;
export const GOLDEN_PER_HALL = 2;
export function migrateChapters(s: SaveData): boolean {
  if (s.chapters.v === CHAPTERS_V) return false;
  const was = s.chapters.v;
  let done = s.chapters.done;
  if (was !== 3) {
    // (Never past the chapters they'd already finished: a later chapter that's met pays normally.)
    const old = s.chapters.done;
    done = 0;
    while (done < Math.min(CHAPTERS.length, old) && CHAPTERS[done].goals.every(g => g.have(s) >= g.need)) done++;
  }
  s.chapters = { done, seen: was === 3 ? s.chapters.seen : done - 1, v: CHAPTERS_V };
  s.tycoon.goldenAll = Math.max(s.tycoon.goldenAll ?? 0, GOLDEN_PER_HALL * done);
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
  // (In the city game the stars come as cash, capped at a few minutes' earnings: see payLevelUp.)
  const cash = payLevelUp(s, c.reward.stars);
  s.crystals += c.reward.crystals;
  return { ...c.reward, cash };
}

/** How to do a goal, in one plain line (shown under it in Pip's card). */
export const GOAL_HOW: Record<NonNullable<ChapterGoal["kind"]>, string> = {
  projects: "Tap Build, then choose the Flower market or the Playground.",
  managers: "Tap a business, then Hire manager. A manager sells for you, even while you're away.",
  levels: "Every level you buy for any business counts. Tap a business and press Buy.",
  grown: "When a business says it's ready to grow, tap it and press Grow it!",
  terrace: "Tap Build and choose the café terrace.",
  builds: "Everything you build counts: homes, headquarters, projects.",
  open: "Tap Build to open a new business.",
  land: "Tap Build and buy the new district.",
  landOpen: "Tap Build to open businesses in the new district.",
  towers: "Tap Play to build a tower.",
  height: "Tap Play and stack your tower higher.",
  offices: "Tap Build and add office floors.",
  income: "Buy levels, hire managers and build headquarters: everything that earns more counts.",
  milestone: "At levels 10, 25, 50, 100 and on, a business runs twice as fast. Tap one and press Buy.",
  hq: "When the business is ready to grow, tap it and build its new headquarters.",
  biz: "Tap Build to open it, once you have the cash.",
  homes: "Tap Build to build on an empty lot or upgrade a home.",
  decor: "Tap an empty lot and choose a decoration.",
  golden: "Golden customers sparkle at your businesses now and then. Tap them before they leave!",
};

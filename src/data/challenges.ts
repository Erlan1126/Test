// The Skyline Journey: a path of 60 stages, each a fixed tower with a goal and special
// rules. Each pays stars the first time you finish it, finishing one opens the next, and
// the better you build it (more perfect drops) the more map stars it earns (up to 3).
// The first six are hand-made; the rest follow a steady climb in difficulty.

export interface Challenge {
  id: string;
  name: string;
  text: string;
  goal: { type: "height" | "streak" | "penthouses"; n: number };
  rules: {
    /** Wind from this floor instead of the usual height. */
    windFrom?: number;
    /** Every Nth floor is icy. */
    iceEvery?: number;
    /** Chance of a gold penthouse on each floor. */
    goldChance?: number;
    noRewind?: boolean;
  };
  reward: number;
  /** Same seed, same tower for everyone. */
  seed: number;
}

export const CHALLENGES: Challenge[] = [
  { id: "niagara", name: "First Splash", text: "Build taller than Niagara Falls (51 m)",
    goal: { type: "height", n: 51 }, rules: {}, reward: 2, seed: 101 },
  { id: "icebreaker", name: "Icebreaker", text: "Build taller than Niagara Falls when every third floor is ice",
    goal: { type: "height", n: 51 }, rules: { iceEvery: 3 }, reward: 3, seed: 202 },
  { id: "perfectionist", name: "Perfectionist", text: "Land 8 perfect drops in a row",
    goal: { type: "streak", n: 8 }, rules: {}, reward: 3, seed: 303 },
  { id: "stormfront", name: "Stormfront", text: "Build taller than the Statue of Liberty (93 m) with wind from the first floor",
    goal: { type: "height", n: 93 }, rules: { windFrom: 1 }, reward: 4, seed: 404 },
  { id: "goldrush", name: "Gold Rush", text: "Land 3 gold penthouses perfectly",
    goal: { type: "penthouses", n: 3 }, rules: { goldChance: 0.35 }, reward: 4, seed: 505 },
  { id: "pyramid", name: "Pyramid Climb", text: "Build taller than the Great Pyramid (139 m) without a rewind",
    goal: { type: "height", n: 139 }, rules: { noRewind: true }, reward: 6, seed: 606 },
];

/** Chapters of ten stages, each named after a part of the sky city. */
export const CHAPTERS = ["Downtown", "Harbor", "Sunset Heights", "Storm Coast", "Golden Mile", "Cloud City"];
export const STAGES_PER_CHAPTER = 10;

/** Stages 7 to 60: height, streak and penthouse goals in turn, with rules mixed in. */
function generated(): Challenge[] {
  const out: Challenge[] = [];
  for (let i = 6; i < CHAPTERS.length * STAGES_PER_CHAPTER; i++) {
    const kind = i % 5;
    const goal: Challenge["goal"] = kind === 3 ? { type: "streak", n: Math.min(14, 5 + Math.floor(i / 8)) }
      : kind === 4 ? { type: "penthouses", n: Math.min(6, 2 + Math.floor(i / 14)) }
      : { type: "height", n: 40 + i * 4 };
    const rules: Challenge["rules"] = {};
    if (i % 3 === 0) rules.windFrom = Math.max(1, 24 - Math.floor(i / 3));
    if (i % 4 === 1) rules.iceEvery = i > 30 ? 3 : 4;
    if (goal.type === "penthouses") rules.goldChance = 0.3;
    if (i % 7 === 0) rules.noRewind = true;
    const chapter = CHAPTERS[Math.floor(i / STAGES_PER_CHAPTER)];
    out.push({ id: `stage${i + 1}`, name: chapter, text: "", goal, rules, reward: 2 + Math.floor(i / 10), seed: 1000 + i * 37 });
  }
  return out;
}
CHALLENGES.push(...generated());

/** Map stars for a won stage: 1, plus 1 for half the floors perfect, plus 1 for 80%. */
export function stageStars(won: boolean, floors: number, perfects: number): number {
  if (!won) return 0;
  const r = perfects / Math.max(1, floors);
  return 1 + (r >= 0.5 ? 1 : 0) + (r >= 0.8 ? 1 : 0);
}

/** Crystals in the chest at the end of each chapter. */
export const CHAPTER_CHEST = 25;

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find(c => c.id === id);

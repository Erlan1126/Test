// Landmark challenges: fixed towers with a goal and special rules. Each pays stars the
// first time you finish it, and finishing one opens the next.

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

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find(c => c.id === id);

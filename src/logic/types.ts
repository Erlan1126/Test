// Types shared by the game rules, the save system and the screens.

export type Mode = "classic" | "daily" | "zen" | "challenge";

/** Everything the rules need to know about a finished tower. */
export interface RunSummary {
  mode: Mode;
  score: number;
  floors: number;
  meters: number;
  perfects: number;
  bestStreak: number;
  /** Gold penthouses landed perfectly. */
  penthouses: number;
  windFloors: number;
  /** Floors built after the last rewind (0 if no rewind was used). */
  afterRewind: number;
  rewindsUsed: number;
  challengeId?: string;
  challengeWon?: boolean;
  /** XP multiplier from boosts and events. */
  xpMultiplier?: number;
}

/** A line on the game-over card. */
export interface Reward {
  kind: "star" | "skin" | "island";
  text: string;
}

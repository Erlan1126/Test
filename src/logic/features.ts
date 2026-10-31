// New players start with one button. Features open up as they build towers, and each
// shows a "New" badge until it's been opened.
import type { SaveData } from "./save";

export type Feature = "skins" | "profile" | "missions" | "daily" | "zen" | "shop" | "challenges";

/** Towers you need to have built before each feature appears. */
export const FEATURE_TOWERS: Record<Feature, number> = {
  skins: 1,
  profile: 1,
  missions: 1,
  daily: 2,
  challenges: 3,
  shop: 3,
  zen: 4,
};

export const FEATURE_NAMES: Record<Feature, string> = {
  skins: "Tower skins",
  profile: "Builder profile",
  missions: "Missions",
  daily: "Daily tower",
  challenges: "Landmark challenges",
  shop: "Star shop",
  zen: "Zen mode",
};

const FEATURES = Object.keys(FEATURE_TOWERS) as Feature[];

export const isOpen = (save: SaveData, f: Feature): boolean => save.profile.towers >= FEATURE_TOWERS[f];
export const isNew = (save: SaveData, f: Feature): boolean => isOpen(save, f) && !save.seenFeatures.includes(f);

export function markSeen(save: SaveData, f: Feature): void {
  if (!save.seenFeatures.includes(f)) save.seenFeatures.push(f);
}

/** Features that open when the tower count goes from `before` to `after`. */
export const openedBetween = (before: number, after: number): Feature[] =>
  FEATURES.filter(f => FEATURE_TOWERS[f] > before && FEATURE_TOWERS[f] <= after);

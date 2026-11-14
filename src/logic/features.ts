// New players start with one button. Features open up as they build towers, and each
// shows a "New" badge until it's been opened.
import type { SaveData } from "./save";

export type Feature = "skins" | "profile" | "missions" | "daily" | "zen" | "shop" | "challenges" | "city" | "pass";

/** Towers you need to have built before each feature appears: spread over the first 15
 *  towers, so a new player meets one new thing at a time instead of a dozen at once. */
export const FEATURE_TOWERS: Record<Feature, number> = {
  skins: 1,
  profile: 2,
  missions: 3,
  daily: 4,
  city: 5,
  challenges: 7,
  shop: 10,
  pass: 12,
  zen: 15,
};

export const FEATURE_NAMES: Record<Feature, string> = {
  skins: "Tower skins",
  profile: "Builder profile",
  missions: "Missions",
  daily: "Daily tower",
  challenges: "Landmark challenges",
  city: "Your city",
  pass: "Sky Pass",
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

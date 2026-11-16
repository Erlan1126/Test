// New players start with one button. Features open up as they level up (the Journey
// screen shows what each level brings), and each shows a "New" badge until it's opened.
import type { SaveData } from "./save";

export type Feature = "skins" | "profile" | "missions" | "daily" | "zen" | "shop" | "challenges" | "city" | "pass" | "ranks";

/** Builder level at which each feature opens. */
export const FEATURE_LEVEL: Record<Feature, number> = {
  profile: 1,
  missions: 2,
  skins: 3,
  shop: 3,
  daily: 4,
  city: 5,
  challenges: 6,
  pass: 7,
  zen: 8,
  ranks: 9,
};

/** Before levels, features opened after this many towers. Saves from then keep what they
 *  had (see save.ts). */
export const OLD_FEATURE_TOWERS: Partial<Record<Feature, number>> = {
  skins: 1, profile: 2, missions: 3, daily: 4, city: 5, challenges: 7, shop: 10, pass: 12, zen: 15, ranks: 6,
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
  ranks: "Rankings",
};

export const FEATURES = Object.keys(FEATURE_LEVEL) as Feature[];

/** Open by level, or kept from before (anything the player has seen stays open). */
export const isOpen = (save: SaveData, f: Feature): boolean => save.profile.level >= FEATURE_LEVEL[f] || save.seenFeatures.includes(f);
export const isNew = (save: SaveData, f: Feature): boolean => isOpen(save, f) && !save.seenFeatures.includes(f);

export function markSeen(save: SaveData, f: Feature): void {
  // Opening something early (from a shortcut) mustn't unlock it for good.
  if (save.profile.level < FEATURE_LEVEL[f]) return;
  if (!save.seenFeatures.includes(f)) save.seenFeatures.push(f);
}

/** Features that open when the builder level goes from `before` to `after`. */
export const openedBetween = (before: number, after: number): Feature[] =>
  FEATURES.filter(f => FEATURE_LEVEL[f] > before && FEATURE_LEVEL[f] <= after);

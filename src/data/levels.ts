// The level journey: everything each builder level brings, in one list (new places and
// modes, titles, building shapes, and the stars and crystals every level-up pays).
import { FEATURE_LEVEL, FEATURE_NAMES, type Feature } from "../logic/features";
import { levelReward } from "./pass";
import { SHAPES } from "./shapes";
import { TITLES } from "./titles";

export interface LevelStep {
  level: number;
  /** New places or modes opened at this level. */
  features: Feature[];
  title?: { name: string; icon: string };
  shapes: string[];
  stars: number;
  crystals: number;
}

/** Feature → icon name in the drawn icon set (src/ui/icons.ts). */
export const FEATURE_ICON: Record<Feature, string> = {
  profile: "crown", missions: "target", skins: "tower", shop: "gift", daily: "calendar",
  city: "city", challenges: "map", pass: "star", zen: "leaf", ranks: "trophy",
};

export const FEATURE_TEXT: Record<Feature, string> = {
  profile: "Your builder profile and trophies",
  missions: "Three new goals every day",
  skins: "Paint your towers in new skins",
  shop: "Spend your stars on skins and boosts",
  daily: "One tower a day, the same for everyone",
  city: "Grow your sky city and collect rent",
  challenges: "Landmark stages with three stars each",
  pass: "A month of rewards on the Sky Pass",
  zen: "Build calmly: no misses, no end",
  ranks: "Compete on the world leaderboards",
};

export function levelStep(level: number): LevelStep {
  const r = levelReward(level);
  const title = TITLES.find(x => x.min === level);
  return {
    level,
    features: (Object.keys(FEATURE_LEVEL) as Feature[]).filter(f => FEATURE_LEVEL[f] === level && f !== "profile"),
    title: title ? { name: title.name, icon: title.icon } : undefined,
    shapes: SHAPES.filter(s => s.unlock && "level" in s.unlock && s.unlock.level === level).map(s => s.name),
    stars: level > 1 ? r.stars : 0,
    crystals: level > 1 ? r.crystals : 0,
  };
}

export { FEATURE_NAMES };

// The City Hall's level-up, the city game's biggest moment: when it's ready it leads the Next
// card, and what a level opens is gathered in one place for its reward card.
import { CHAPTERS, chapterIndex, chapterReady } from "../data/chapters";
import { LAND, type LandId } from "../data/land";
import { RANKS } from "../data/ranks";
import type { Business } from "../data/tycoon";
import { HAS_CITY, playerStarted } from "../edition";
import { gatesAt, type Gate } from "./gates";
import { landHall } from "./land";
import type { SaveData } from "./save";
import { HALL_RANK, hallOpens } from "./tycoon";

/** The City Hall can go up a level now: every goal of its chapter is done (the city game,
 *  once the first steps are over). */
export function hallUpgradeReady(s: SaveData): boolean {
  return HAS_CITY && playerStarted(s) && s.tycoon.tips >= 3 && !!CHAPTERS[chapterIndex(s)] && chapterReady(s);
}

/** The step the Next card leads with, ahead of its usual order (first-time objectives,
 *  rewards to collect, golden customers...): the City Hall's level-up, once it's ready. */
export const nextStepLead = (s: SaveData): "hall" | null => (hallUpgradeReady(s) ? "hall" : null);

export interface HallUnlocks {
  businesses: Business[];
  lands: { id: LandId; name: string; icon: string }[];
  gates: Gate[];
  /** The town rank this level brings (and its new landmark), or -1 if it stays the same. */
  rank: number;
}

/** Everything a City Hall level opens: businesses, districts, extras and a new town rank. */
export function hallUnlocks(level: number): HallUnlocks {
  const at = (n: number) => HALL_RANK[Math.max(0, Math.min(HALL_RANK.length - 1, n))] ?? 0;
  const rk = at(level);
  return {
    businesses: hallOpens(level),
    lands: HAS_CITY ? LAND.filter(l => landHall(l.id) === level).map(l => ({ id: l.id, name: l.name, icon: l.icon })) : [],
    gates: gatesAt(level),
    rank: HAS_CITY && rk > at(level - 1) && RANKS[rk] ? rk : -1,
  };
}

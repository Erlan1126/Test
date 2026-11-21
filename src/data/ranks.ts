// Town ranks: as the company grows (all its business levels together), Skyhaven grows from a
// hamlet to the sky capital. Every rank changes the town for good (something new to see),
// and makes every business earn a little more.

export interface TownRank {
  name: string;
  /** Business levels (all businesses together) to reach it. */
  at: number;
  /** What appears in the town. */
  unlock: string;
  icon: string;
}

/** The floating island next to the town: it opens at this rank (Big City), and what's built
 *  there makes every business earn this much more, for good. */
export const ANNEX_RANK = 4;
export const ANNEX_BONUS = 0.1;

/** Each rank above the first adds this much to every business's earnings. */
export const RANK_BONUS = 0.1;

export const RANKS: TownRank[] = [
  { name: "Hamlet", at: 0, unlock: "", icon: "home" },
  { name: "Village", at: 50, unlock: "A street market opens: striped stalls and shoppers", icon: "gift" },
  { name: "Town", at: 150, unlock: "A little tram starts running round the streets", icon: "map" },
  { name: "City", at: 300, unlock: "Glowing billboards light up the corners", icon: "film" },
  { name: "Big City", at: 500, unlock: "Airships float over the island", icon: "airship" },
  { name: "Metropolis", at: 800, unlock: "A skyline rises on the floating islands", icon: "building" },
  { name: "Sky Capital", at: 1200, unlock: "The golden Skyhaven Tower stands over everything", icon: "crown" },
];

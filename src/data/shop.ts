// One-tower boosts bought with stars. They apply automatically to your next Classic tower.

export type BoostId = "rewind" | "xp" | "gold";

export interface Boost {
  id: BoostId;
  name: string;
  text: string;
  price: number;
}

export const BOOSTS: Boost[] = [
  { id: "rewind", name: "Extra rewind", text: "One more chance if a floor falls", price: 4 },
  { id: "xp", name: "Double XP", text: "Level up twice as fast", price: 3 },
  { id: "gold", name: "Gold rush", text: "Twice as many gold penthouses", price: 3 },
];

/** You can hold at most this many of each boost. */
export const MAX_BOOSTS = 5;

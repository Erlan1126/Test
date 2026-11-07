// Your skyline: the tallest towers you've built stay standing on an island of their own.
import type { SaveData } from "./save";

export interface SkylineTower {
  /** Floors. */
  f: number;
  /** Skin id. */
  s: string;
  /** Shape id. */
  h: string;
}

export const SKYLINE_SIZE = 9;
/** Shorter towers than this don't join the skyline. */
export const SKYLINE_MIN = 8;

/** Adds a finished tower if it's among your tallest. Returns true when it joined. */
export function addToSkyline(save: SaveData, tower: SkylineTower): boolean {
  if (tower.f < SKYLINE_MIN) return false;
  const list = save.skyline;
  if (list.length >= SKYLINE_SIZE && tower.f <= Math.min(...list.map(t => t.f))) return false;
  list.push(tower);
  list.sort((a, b) => b.f - a.f);
  if (list.length > SKYLINE_SIZE) list.length = SKYLINE_SIZE;
  return list.includes(tower);
}

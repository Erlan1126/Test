// Your skyline: the tallest towers you've built stay standing on an island of their own.
import type { SaveData } from "./save";

export interface SkylineTower {
  /** Floors. */
  f: number;
  /** Skin id. */
  s: string;
  /** Shape id. */
  h: string;
  /** The district (island theme id) it stands in. */
  d: string;
}

export const SKYLINE_SIZE = 9;
/** Shorter towers than this don't join the skyline. */
export const SKYLINE_MIN = 8;

/** Towers standing in one district, tallest first. */
export const districtTowers = (save: SaveData, d: string): SkylineTower[] => save.skyline.filter(t => t.d === d);

/** Adds a finished tower to its district if it's among that district's tallest nine.
 *  Returns true when it joined. */
export function addToSkyline(save: SaveData, tower: SkylineTower): boolean {
  if (tower.f < SKYLINE_MIN) return false;
  const here = districtTowers(save, tower.d);
  if (here.length >= SKYLINE_SIZE && tower.f <= Math.min(...here.map(t => t.f))) return false;
  here.push(tower);
  here.sort((a, b) => b.f - a.f);
  const keep = here.slice(0, SKYLINE_SIZE);
  save.skyline = [...save.skyline.filter(t => t.d !== tower.d), ...keep];
  return keep.includes(tower);
}

// Buying land next to the island (data/land.ts).
import { LAND, type LandId, type LandPlot } from "../data/land";
import type { SaveData } from "./save";
import { perSecond, levelOf } from "./tycoon";
import { BUSINESSES } from "../data/tycoon";

const owned = (s: SaveData) => BUSINESSES.filter(b => levelOf(s, b.id) > 0).length;

export const landBought = (s: SaveData, id: LandId): boolean => s.land.includes(id);

/** The piece of land on sale now (one at a time, in order), or null. */
export function landOnSale(s: SaveData): LandPlot | null {
  if (owned(s) < 2 || s.tycoon.tips < 3) return null;
  return LAND.find(l => !s.land.includes(l.id)) ?? null;
}

export const landPrice = (s: SaveData, l: LandPlot, now = Date.now()): number => Math.max(l.min, Math.round(perSecond(s, now, false) * 60 * l.minutes));

export function buyLand(s: SaveData, id: LandId, now = Date.now()): "ok" | "locked" | "bought" | "short" {
  if (s.land.includes(id)) return "bought";
  const l = landOnSale(s);
  if (!l || l.id !== id) return "locked";
  const price = landPrice(s, l, now);
  if (s.tycoon.coins < price) return "short";
  s.tycoon.coins -= price;
  s.land.push(id);
  return "ok";
}

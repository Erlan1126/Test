// Upgrading the town's properties (data/props.ts).
import { PROP_BONUS, PROP_MAX } from "../data/props";
import type { SaveData } from "./save";
import { perSecond, levelOf } from "./tycoon";
import { BUSINESSES } from "../data/tycoon";

export const propLevel = (s: SaveData, key: string): number => Math.max(1, Math.min(PROP_MAX, s.props[key] ?? 1));
/** Levels above 1, summed over every property: what the rent bonus counts. */
export const propUpgrades = (s: SaveData): number => Object.values(s.props).reduce((a, l) => a + Math.max(0, Math.min(PROP_MAX, l) - 1), 0);
export const propsOpen = (s: SaveData): boolean => s.tycoon.tips >= 3 && BUSINESSES.some(b => levelOf(s, b.id) > 0);

/** The price of the next level: a few minutes of what the company earns (more for the
 *  higher levels, and a little more for every upgrade already made), never less than a floor. */
export function propPrice(s: SaveData, key: string, now = Date.now()): number {
  const l = propLevel(s, key);
  const floor = 400 * Math.pow(6, l - 1), mins = 1 + 1.5 * (l - 1);
  return Math.round(Math.max(floor, perSecond(s, now, false) * 60 * mins) * (1 + 0.02 * propUpgrades(s)));
}

/** What a property adds to earnings now (a share of the company's earnings a second). */
export function propRent(s: SaveData, key: string, now = Date.now(), level = propLevel(s, key)): number {
  const total = 1 + PROP_BONUS * propUpgrades(s);
  return (perSecond(s, now, false) * PROP_BONUS * (level - 1)) / total;
}

export function upgradeProp(s: SaveData, key: string, now = Date.now()): "ok" | "max" | "short" | "locked" {
  if (!propsOpen(s)) return "locked";
  const l = propLevel(s, key);
  if (l >= PROP_MAX) return "max";
  const price = propPrice(s, key, now);
  if (s.tycoon.coins < price) return "short";
  s.tycoon.coins -= price;
  s.props[key] = l + 1;
  return "ok";
}

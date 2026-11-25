// Upgrading the town's properties (data/props.ts).
import { PROP_BONUS, PROP_MAX, PROP_PEOPLE } from "../data/props";
import type { SaveData } from "./save";
import { hallLevel, perSecond, levelOf } from "./tycoon";
import { BUSINESSES } from "../data/tycoon";

/** A city block ("g:" keys) starts as an empty lot (level 0) that you build on; the
 *  neighbourhood's homes and the districts' buildings start at level 1. */
export const isLot = (key: string): boolean => key.startsWith("g:");
export const propLevel = (s: SaveData, key: string): number => { const lo = isLot(key) ? 0 : 1; return Math.max(lo, Math.min(PROP_MAX, s.props[key] ?? lo)); };
/** How many city lots City Hall lets you build on: a few to start, more every level. */
export const lotsAllowed = (s: SaveData): number => 1 + 2 * hallLevel(s);
export const lotsBuilt = (s: SaveData): number => Object.entries(s.props).filter(([k, l]) => isLot(k) && l >= 1).length;
/** The tallest a building can grow at this City Hall level (Apartments at Lv 1, a glass
 *  skyscraper from Lv 4). */
export const propCap = (s: SaveData): number => Math.min(PROP_MAX, hallLevel(s) + 1);
/** Why this property can't take its next level right now: "" (it can), "max", "hall" (City
 *  Hall must level up first: the building is as big as it allows, or every lot it allows is
 *  built) or "locked" (the company isn't running yet). */
export function propBlock(s: SaveData, key: string, building = 0): "" | "max" | "hall" | "locked" {
  if (!propsOpen(s)) return "locked";
  const l = propLevel(s, key);
  if (l >= PROP_MAX) return "max";
  if (l >= 1 && l >= propCap(s)) return "hall";
  if (l === 0 && lotsBuilt(s) + building >= lotsAllowed(s)) return "hall";
  return "";
}
/** The City Hall level that lets this property grow (or this lot be built). */
export function propHallNeed(s: SaveData, key: string): number {
  const l = propLevel(s, key);
  if (l >= 1) return l;
  let h = hallLevel(s); while (1 + 2 * h <= lotsBuilt(s)) h++;
  return h;
}

/** Levels above 1, summed over every property: what the rent bonus counts. */
export const propUpgrades = (s: SaveData): number => Object.values(s.props).reduce((a, l) => a + Math.max(0, Math.min(PROP_MAX, l) - 1), 0);
export const propsOpen = (s: SaveData): boolean => s.tycoon.tips >= 3 && BUSINESSES.some(b => levelOf(s, b.id) > 0);

/** The price of the next level: a few minutes of what the company earns (more for the
 *  higher levels, and a little more for every upgrade already made), never less than a floor. */
export function propPrice(s: SaveData, key: string, now = Date.now()): number {
  const l = propLevel(s, key);
  if (l === 0) return Math.round(Math.max(300, perSecond(s, now, false) * 40) * (1 + 0.02 * propUpgrades(s)));
  const floor = 400 * Math.pow(6, l - 1), mins = 1 + 1.5 * (l - 1);
  return Math.round(Math.max(floor, perSecond(s, now, false) * 60 * mins) * (1 + 0.02 * propUpgrades(s)));
}

/** What a property adds to earnings now (a share of the company's earnings a second). */
export function propRent(s: SaveData, key: string, now = Date.now(), level = propLevel(s, key)): number {
  const total = 1 + PROP_BONUS * propUpgrades(s);
  return (perSecond(s, now, false) * PROP_BONUS * Math.max(0, level - 1)) / total;
}

export function upgradeProp(s: SaveData, key: string, now = Date.now()): "ok" | "max" | "short" | "locked" {
  const why = propBlock(s, key);
  if (why === "locked" || why === "hall") return "locked";
  if (why === "max") return "max";
  const l = propLevel(s, key);
  const price = propPrice(s, key, now);
  if (s.tycoon.coins < price) return "short";
  s.tycoon.coins -= price;
  s.props[key] = l + 1;
  return "ok";
}

/** Everyone living in the city's homes. */
export const townPeople = (s: SaveData): number => Object.values(s.props).reduce((a, l) => a + (PROP_PEOPLE[Math.max(0, Math.min(5, l))] ?? 0), 0);

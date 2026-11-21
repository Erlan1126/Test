// The floating island next to the town (it opens at Big City): the player builds one landmark
// there, a greenhouse or a lookout, with the company's cash. It stays for good (a New Era keeps
// it, like the town's rank) and every business earns a little more.
import { ANNEX_RANK } from "../data/ranks";
import type { SaveData } from "./save";
import { perSecond, townRank } from "./tycoon";

export type AnnexPick = "greenhouse" | "lookout";

export const annexOpen = (s: SaveData): boolean => townRank(s) >= ANNEX_RANK;
export const annexBuilt = (s: SaveData): boolean => !!s.annex.pick;

/** What it costs: half an hour of what the company earns (never less than $5M). */
export const annexPrice = (s: SaveData, now = Date.now()): number => Math.max(5e6, Math.round(perSecond(s, now, false) * 1800));

export function buildAnnex(s: SaveData, pick: AnnexPick, now = Date.now()): "ok" | "locked" | "built" | "short" {
  if (annexBuilt(s)) return "built";
  if (!annexOpen(s)) return "locked";
  const price = annexPrice(s, now);
  if (s.tycoon.coins < price) return "short";
  s.tycoon.coins -= price;
  s.annex.pick = pick;
  return "ok";
}

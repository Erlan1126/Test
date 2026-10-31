// Spending stars: shop skins and one-tower boosts.
import { BOOSTS, MAX_BOOSTS, type BoostId } from "../data/shop";
import { SKINS } from "../data/skins";
import type { SaveData } from "./save";

export type BuyResult = "ok" | "owned" | "poor" | "full" | "unknown";

export function buySkin(save: SaveData, id: string): BuyResult {
  const skin = SKINS.find(s => s.id === id);
  if (!skin?.unlock || !("price" in skin.unlock)) return "unknown";
  if (save.ownedSkins.includes(id)) return "owned";
  if (save.stars < skin.unlock.price) return "poor";
  save.stars -= skin.unlock.price;
  save.ownedSkins.push(id);
  return "ok";
}

export function buyBoost(save: SaveData, id: BoostId): BuyResult {
  const boost = BOOSTS.find(b => b.id === id);
  if (!boost) return "unknown";
  if (save.boosts[id] >= MAX_BOOSTS) return "full";
  if (save.stars < boost.price) return "poor";
  save.stars -= boost.price;
  save.boosts[id]++;
  return "ok";
}

export interface ActiveBoosts {
  rewind: boolean;
  xp: boolean;
  gold: boolean;
}

/** Uses up one of each boost the player holds, for the Classic tower that's starting. */
export function takeBoosts(save: SaveData): ActiveBoosts {
  const take = (id: BoostId) => {
    if (save.boosts[id] <= 0) return false;
    save.boosts[id]--;
    return true;
  };
  return { rewind: take("rewind"), xp: take("xp"), gold: take("gold") };
}

export const boostCount = (save: SaveData): number => save.boosts.rewind + save.boosts.xp + save.boosts.gold;

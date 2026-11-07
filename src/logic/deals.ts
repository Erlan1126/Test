// Daily deals: three discounted offers that change every day (the same for everyone on a
// given day), so there's a reason to look in the shop each day.
import { seeded } from "../core/rng";
import { PRODUCTS } from "../data/premium";
import { SHAPES } from "../data/shapes";
import { SKINS } from "../data/skins";
import { MAX_BOOSTS } from "../data/shop";
import { grantPurchase, ownsProduct } from "./premium";
import type { SaveData } from "./save";

export type DealKind = "skin" | "product" | "shape" | "boosts";

export interface Deal {
  kind: DealKind;
  /** Skin, product or shape id ("" for the boost pack). */
  ref: string;
  name: string;
  currency: "stars" | "crystals";
  price: number;
  was: number;
}

const off = (price: number, pct: number) => Math.max(1, Math.round(price * (1 - pct)));

/** Today's deals for this player (things they already own are left out). */
export function dealsFor(save: SaveData, day: number): Deal[] {
  const rng = seeded(day * 7919 + 17);
  const pick = <T>(list: T[]): T | undefined => list.length ? list[Math.floor(rng() * list.length)] : undefined;
  const out: Deal[] = [];

  const skin = pick(SKINS.filter(s => s.unlock && "price" in s.unlock && !save.ownedSkins.includes(s.id)));
  if (skin && skin.unlock && "price" in skin.unlock) out.push({ kind: "skin", ref: skin.id, name: skin.name, currency: "stars", was: skin.unlock.price, price: off(skin.unlock.price, 0.3) });

  const prod = pick(PRODUCTS.filter(p => p.kind !== "bundle" && !ownsProduct(save, p.id)));
  if (prod) out.push({ kind: "product", ref: prod.id, name: prod.name, currency: "crystals", was: prod.crystals, price: off(prod.crystals, 0.25) });

  const shape = pick(SHAPES.filter(s => s.unlock && !("level" in s.unlock) && !save.ownedShapes.includes(s.id)));
  if (shape && shape.unlock && !("level" in shape.unlock)) {
    const stars = "stars" in shape.unlock;
    const was = stars ? (shape.unlock as { stars: number }).stars : (shape.unlock as { crystals: number }).crystals;
    out.push({ kind: "shape", ref: shape.id, name: shape.name, currency: stars ? "stars" : "crystals", was, price: off(was, 0.3) });
  }

  // One of each boost, for less than buying them one by one.
  out.push({ kind: "boosts", ref: "", name: "Boost pack", currency: "stars", was: 30, price: 18 });
  return out.slice(0, 3);
}

export const dealBought = (save: SaveData, day: number, d: Deal): boolean =>
  save.deals.day === day && save.deals.bought.includes(`${d.kind}:${d.ref}`);

export type DealResult = "ok" | "bought" | "short" | "full";

export function buyDeal(save: SaveData, day: number, d: Deal): DealResult {
  if (save.deals.day !== day) save.deals = { day, bought: [] };
  if (dealBought(save, day, d)) return "bought";
  if (d.kind === "boosts" && (["rewind", "xp", "gold"] as const).every(b => save.boosts[b] >= MAX_BOOSTS)) return "full";
  const have = d.currency === "stars" ? save.stars : save.crystals;
  if (have < d.price) return "short";
  if (d.currency === "stars") save.stars -= d.price; else save.crystals -= d.price;
  if (d.kind === "skin") save.ownedSkins.push(d.ref);
  else if (d.kind === "shape") save.ownedShapes.push(d.ref);
  else if (d.kind === "product") grantPurchase(save, d.ref);
  else for (const b of ["rewind", "xp", "gold"] as const) save.boosts[b] = Math.min(MAX_BOOSTS, save.boosts[b] + 1);
  save.deals.bought.push(`${d.kind}:${d.ref}`);
  return "ok";
}

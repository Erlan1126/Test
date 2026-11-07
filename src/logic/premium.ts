// Sky Crystals: buying packs, spending crystals on premium items, and what those items unlock.
import { PRODUCTS, packById, productById } from "../data/premium";
import type { SaveData } from "./save";

/** Skin and island ids unlocked by the premium items this player owns. */
export function premiumGrants(save: SaveData): { skins: Set<string>; themes: Set<string> } {
  const skins = new Set<string>(), themes = new Set<string>();
  for (const id of save.purchases) {
    const p = productById(id);
    p?.grants.skins?.forEach(s => skins.add(s));
    p?.grants.themes?.forEach(t => themes.add(t));
  }
  return { skins, themes };
}

export const ownsProduct = (save: SaveData, id: string): boolean =>
  save.purchases.includes(id) || PRODUCTS.some(p => p.kind === "bundle" && save.purchases.includes(p.id) && covers(p.id, id));

/** Whether a bundle includes everything another product grants. */
function covers(bundleId: string, id: string): boolean {
  const b = productById(bundleId), p = productById(id);
  if (!b || !p || b === p) return false;
  return (p.grants.skins ?? []).every(s => b.grants.skins?.includes(s)) && (p.grants.themes ?? []).every(t => b.grants.themes?.includes(t))
    && (p.grants.shapes ?? []).every(s => b.grants.shapes?.includes(s));
}

/** Records an owned item. One-off extras (bundle coins) are paid once per product. */
export function grantPurchase(save: SaveData, id: string): boolean {
  const p = productById(id);
  if (!p) return false;
  if (!save.purchases.includes(id)) save.purchases.push(id);
  for (const sh of p.grants.shapes ?? []) if (!save.ownedShapes.includes(sh)) save.ownedShapes.push(sh);
  if (p.grants.coins && !save.coinsGranted.includes(id)) {
    save.coinsGranted.push(id);
    save.coins += p.grants.coins;
  }
  return true;
}

/** What a premium item costs this player: a bundle is cheaper by what they already own. */
export function itemPrice(save: SaveData, id: string): number {
  const p = productById(id);
  if (!p) return Infinity;
  if (p.kind !== "bundle") return p.crystals;
  const owned = PRODUCTS.filter(x => x.kind !== "bundle" && covers(p.id, x.id) && ownsProduct(save, x.id))
    .reduce((n, x) => n + x.crystals, 0);
  return Math.max(Math.round(p.crystals * 0.4), p.crystals - owned);
}

export type SpendResult = "ok" | "owned" | "short";

/** Buys a premium item with crystals. */
export function buyWithCrystals(save: SaveData, id: string): SpendResult {
  if (ownsProduct(save, id)) return "owned";
  const price = itemPrice(save, id);
  if (save.crystals < price) return "short";
  save.crystals -= price;
  grantPurchase(save, id);
  return "ok";
}

/** Adds a bought pack's crystals once per transaction. Returns the crystals added. */
export function grantPack(save: SaveData, packId: string, tx: string): number {
  const pack = packById(packId);
  if (!pack || !tx || save.crystalTx.includes(tx)) return 0;
  save.crystalTx.push(tx);
  if (save.crystalTx.length > 300) save.crystalTx.splice(0, save.crystalTx.length - 300);
  save.crystals += pack.crystals;
  return pack.crystals;
}

/** A random, unguessable id the servers use to know this player. */
export function newPlayerId(rand: () => number = Math.random): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "p-" + Array.from({ length: 24 }, () => Math.floor(rand() * 36).toString(36)).join("");
}

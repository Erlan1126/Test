// What premium purchases unlock, and keeping the save in step with the payment server.
import { PRODUCTS, productById } from "../data/premium";
import type { SaveData } from "./save";

/** Skin and island ids unlocked by the products this player owns. */
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
  return (p.grants.skins ?? []).every(s => b.grants.skins?.includes(s)) && (p.grants.themes ?? []).every(t => b.grants.themes?.includes(t));
}

/** Records a completed purchase. One-off extras (bundle coins) are paid once per product. */
export function grantPurchase(save: SaveData, id: string): boolean {
  const p = productById(id);
  if (!p) return false;
  if (!save.purchases.includes(id)) save.purchases.push(id);
  if (p.grants.coins && !save.coinsGranted.includes(id)) {
    save.coinsGranted.push(id);
    save.coins += p.grants.coins;
  }
  return true;
}

/**
 * Makes the save match what the payment server says this player owns. The server is the
 * source of truth: a purchase it doesn't know about (say, one typed into a save code) is
 * removed, and new ones are granted. Returns the products newly granted.
 */
export function syncPurchases(save: SaveData, owned: string[]): string[] {
  const valid = owned.filter(id => productById(id));
  const added = valid.filter(id => !save.purchases.includes(id));
  save.purchases = save.purchases.filter(id => valid.includes(id));
  added.forEach(id => grantPurchase(save, id));
  return added;
}

/** A random, unguessable id the payment server uses to remember this player's purchases. */
export function newPlayerId(rand: () => number = Math.random): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "p-" + Array.from({ length: 24 }, () => Math.floor(rand() * 36).toString(36)).join("");
}

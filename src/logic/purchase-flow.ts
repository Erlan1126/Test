// What happens when the App Store or Google Play approves a purchase.
//
// The store keeps offering an approved purchase (on every launch) until the game says it's
// finished. So the game only says so once the crystals AND the purchase's transaction id
// are safely saved together. If saving fails, or the app closes first, the store hands the
// purchase over again later, and the saved transaction id makes sure it's only ever
// credited once.
import { grantPack } from "./premium";
import type { SaveData } from "./save";

/** One store transaction, as the store plugin reports it. */
export interface ApprovedTx {
  id: string;
  products: string[];
  finish(): Promise<void>;
}

export interface ApprovalDeps {
  /** A store product id that is a crystal pack (or the Starter Pack). */
  isPack(product: string): boolean;
  /** A store product id that is the VIP subscription. */
  isVip?(product: string): boolean;
  /** Credits the pack (if it wasn't already) and saves; resolves true only once the credit
   *  and its transaction id are saved durably. */
  credit(pack: string, tx: string): Promise<boolean>;
  /** VIP turned on. */
  vip?(): void;
  /** A purchase the player is waiting on finished (credited or already counted). */
  delivered?(product: string): void;
}

/** Makes the store's "approved" handler. Repeated or overlapping calls for the same
 *  transaction finish it at most once. */
export function approvalHandler(deps: ApprovalDeps, prefix: string): (t: ApprovedTx) => Promise<boolean> {
  const busy = new Set<string>();
  const finished = new Set<string>();
  return async t => {
    const key = `${prefix}:${t.id}`;
    // The same transaction arriving again while it's being handled (or after it's
    // finished): nothing more to do.
    if (busy.has(key) || finished.has(key)) return finished.has(key);
    busy.add(key);
    try {
      let safe = true;
      for (const p of t.products) {
        if (deps.isVip?.(p)) { deps.vip?.(); deps.delivered?.(p); continue; }
        if (!deps.isPack(p)) continue;
        let ok = false;
        try { ok = await deps.credit(p, key); } catch { ok = false; }
        // The player sees their crystals either way; only the store's confirmation waits.
        deps.delivered?.(p);
        if (!ok) safe = false;
      }
      if (!safe) return false; // not saved: the store will offer it again
      await t.finish();
      finished.add(key);
      return true;
    } finally {
      busy.delete(key);
    }
  };
}

/** Credits a pack once and saves. `persist` must resolve true only when the save (with the
 *  transaction id in it) is durably written. Returns what was added (0 if this transaction
 *  was already counted) and whether it's safe to tell the store the purchase is done. */
export async function creditDurably(save: SaveData, pack: string, tx: string, persist: () => Promise<boolean>, now = Date.now()): Promise<{ added: number; durable: boolean }> {
  const added = grantPack(save, pack, tx, now);
  // Unknown pack ids are never credited, and never finished either.
  if (!added && !save.crystalTx.includes(tx)) return { added: 0, durable: false };
  let durable = false;
  try { durable = await persist(); } catch { durable = false; }
  return { added, durable };
}

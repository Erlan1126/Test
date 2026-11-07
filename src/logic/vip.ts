// Skyrise VIP: a monthly subscription bought in Google Play or the App Store. While it's
// on: 50 Sky Crystals and a free Extra rewind every day, and the Platinum skin.
import { MAX_BOOSTS } from "../data/shop";
import type { SaveData } from "./save";

export const VIP_ID = "vip_monthly";
export const VIP_CENTS = 499;
export const VIP_DAILY_CRYSTALS = 50;
export const VIP_SKIN = "platinum";
/** How long VIP keeps working without hearing from the store (offline play). */
const GRACE_MS = 3 * 864e5;

export const vipActive = (save: SaveData, now = Date.now()): boolean => save.vip.until > now;

/** What the store says. Active extends the grace period; not active ends VIP at once. */
export function setVip(save: SaveData, active: boolean, now = Date.now()): boolean {
  const before = vipActive(save, now);
  save.vip.until = active ? now + GRACE_MS : 0;
  return before !== active;
}

export const vipClaimReady = (save: SaveData, day: number, now = Date.now()): boolean =>
  vipActive(save, now) && save.vip.claimed !== day;

/** Today's VIP gift. Returns false if it was already claimed or VIP isn't on. */
export function claimVip(save: SaveData, day: number, now = Date.now()): boolean {
  if (!vipClaimReady(save, day, now)) return false;
  save.vip.claimed = day;
  save.crystals += VIP_DAILY_CRYSTALS;
  save.boosts.rewind = Math.min(MAX_BOOSTS, save.boosts.rewind + 1);
  return true;
}

// The Starter Pack: offered once, after the fifth tower, for 48 hours.
import type { SaveData } from "./save";

export const STARTER_AFTER = 5;
export const STARTER_HOURS = 48;

/** Milliseconds left on the offer, or 0 when it isn't (or is no longer) available. */
export function starterLeft(save: SaveData, now = Date.now()): number {
  if (save.starter.bought || !save.starter.offeredAt) return 0;
  return Math.max(0, save.starter.offeredAt + STARTER_HOURS * 36e5 - now);
}

/** Starts the offer the first time a player qualifies. Returns true when it just started. */
export function maybeOfferStarter(save: SaveData, now = Date.now()): boolean {
  if (save.starter.offeredAt || save.starter.bought || save.profile.towers < STARTER_AFTER) return false;
  save.starter.offeredAt = now;
  return true;
}

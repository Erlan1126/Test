// The Starter Pack: offered once (after the fifth tower; in the city game, at City Hall
// level 2), for 48 hours.
import { HAS_CITY } from "../edition";
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
  // (The city game offers it once the City Hall reaches level 2.)
  const ready = HAS_CITY ? (save.chapters?.done ?? 0) >= 1 : save.profile.towers >= STARTER_AFTER;
  if (save.starter.offeredAt || save.starter.bought || !ready) return false;
  save.starter.offeredAt = now;
  return true;
}

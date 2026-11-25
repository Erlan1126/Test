// Gifts between friends (Buildaroo): visiting a friend's city, you can leave them a gift once
// a day; they collect it the next time they play. Each gift pays a few minutes' earnings and
// a Sky Crystal.
import { payStars } from "./tycoon";
import type { SaveData } from "./save";

export const GIFT_CRYSTALS = 1;
/** A gift's cash, in "stars" (about a minute of earnings each). */
export const GIFT_STARS = 4;

/** Pays `n` gifts. Returns what they gave. */
export function openGifts(s: SaveData, n: number, now = Date.now()): { cash: number; crystals: number } {
  if (!(n > 0)) return { cash: 0, crystals: 0 };
  const cash = payStars(s, GIFT_STARS * n, now), crystals = GIFT_CRYSTALS * n;
  s.crystals += crystals;
  return { cash, crystals };
}

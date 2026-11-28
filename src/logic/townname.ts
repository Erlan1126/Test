// The town's name in what Pip and the game say. "Skyhaven" is only the default: once the
// player has named their city, every line about the town uses that name. (The translations
// keep "Skyhaven" as it is, so the swap works in every language.)
import { CITY_NAME } from "./city";

export const townName = (s: { cityName?: string }): string => s.cityName?.trim() || CITY_NAME;

/** `text` (already translated) with the default town name swapped for the player's. */
export function townText(s: { cityName?: string }, text: string): string {
  const name = townName(s);
  return name === CITY_NAME ? text : text.split(CITY_NAME).join(name);
}

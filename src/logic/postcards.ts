// The postcard album: passing a landmark in clear skies, rain or snow sends you a postcard.
// Collect all three of a landmark for a set bonus, and the whole album for crystals.
import { MILESTONES } from "../data/constants";
import type { SaveData } from "./save";

export const WEATHERS = ["clear", "rain", "snow"] as const;
export type PostcardWeather = (typeof WEATHERS)[number];

/** Landmarks with postcards (the little house at 15 m doesn't count). */
export const POSTCARD_LANDMARKS = MILESTONES.map((_, i) => i).slice(1);
export const POSTCARD_COUNT = POSTCARD_LANDMARKS.length * WEATHERS.length;

export const POSTCARD_STARS = 3;
export const SET_STARS = 20;
export const ALBUM_CRYSTALS = 200;

export const postcardId = (landmark: number, w: PostcardWeather): string => `${MILESTONES[landmark]?.id ?? landmark}:${w}`;

/** Older saves stored postcards by the landmark's place in the original list. */
const OLD_ORDER = ["house", "niagara", "liberty", "pyramid", "needle", "goldengate", "eiffel", "empire", "burj"];
export const migratePostcard = (id: string): string => id.replace(/^(\d+):/, (_, n) => `${OLD_ORDER[Number(n)] ?? n}:`);
export const ALL_POSTCARDS = POSTCARD_LANDMARKS.flatMap(i => WEATHERS.map(w => postcardId(i, w)));

export interface PostcardGain { fresh: boolean; set: boolean; album: boolean }

/** Collects a postcard and pays for it. Nothing happens if it's already in the album. */
export function collectPostcard(save: SaveData, landmark: number, weather: PostcardWeather): PostcardGain {
  const id = postcardId(landmark, weather);
  if (!ALL_POSTCARDS.includes(id) || save.postcards.includes(id)) return { fresh: false, set: false, album: false };
  save.postcards.push(id);
  save.stars += POSTCARD_STARS;
  save.starsEarned += POSTCARD_STARS;
  const set = WEATHERS.every(w => save.postcards.includes(postcardId(landmark, w)));
  if (set) { save.stars += SET_STARS; save.starsEarned += SET_STARS; }
  const album = save.postcards.length === POSTCARD_COUNT;
  if (album) save.crystals += ALBUM_CRYSTALS;
  return { fresh: true, set, album };
}

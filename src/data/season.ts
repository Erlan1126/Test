// The city's seasons: Winter Lights (snow, string lights and a holiday tree in the City Hall
// square, from December 1 to January 6) and the weather over the town, which changes every
// couple of hours and is the same for everyone at that hour.
import type { WeatherKind } from "../render/atmosphere";

export type CitySeason = "" | "winter";

/** Testing: force a season or the weather (set from the address bar with ?debug). */
export const seasonDebug: { season?: CitySeason; weather?: WeatherKind } = {};

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();

/** Winter Lights is on from December 1 to January 6. */
export function citySeason(now = Date.now()): CitySeason {
  if (seasonDebug.season !== undefined) return seasonDebug.season;
  const x = md(new Date(now));
  return x >= 1201 || x <= 106 ? "winter" : "";
}

/** The days left in Winter Lights (1 on its last day), or 0 when it isn't on. */
export function winterDaysLeft(now = Date.now()): number {
  if (citySeason(now) !== "winter") return 0;
  const d = new Date(now), end = new Date(d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(), 0, 6, 23, 59, 59);
  return Math.max(1, Math.ceil((end.getTime() - now) / 864e5));
}

/** A key for this year's Winter Lights (its goal starts over each year). */
export function winterKey(now = Date.now()): string {
  const d = new Date(now);
  return `winter-${d.getMonth() === 11 ? d.getFullYear() : d.getFullYear() - 1}`;
}

/** The town's weather right now: it changes every two hours. Snow is common in winter
 *  (December to February), rain now and then the rest of the year, and most hours are clear. */
export function townWeather(now = Date.now()): WeatherKind {
  if (seasonDebug.weather) return seasonDebug.weather;
  const slot = Math.floor(now / 72e5);
  // (A steady little hash, so every player sees the same weather at the same hour.)
  let h = (slot * 2654435761) >>> 0;
  h = ((h ^ (h >>> 15)) * 2246822519) >>> 0;
  const r = ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  const m = new Date(now).getMonth() + 1;
  const winter = m === 12 || m <= 2;
  if (winter) return r < 0.45 ? "snow" : r < 0.52 ? "rain" : "clear";
  const wetMonth = m === 4 || m === 10 || m === 11;
  return r < (wetMonth ? 0.22 : 0.12) ? "rain" : "clear";
}

// The city's seasons, each a few weeks a year with its own look, weekly-event name and prize:
// Spring Blossom, Summer Festival, Spooky Town and Winter Lights. And the weather over the
// town, which changes every couple of hours and is the same for everyone at that hour.
import type { WeatherKind } from "../render/atmosphere";

export type CitySeason = "" | "spring" | "summer" | "halloween" | "winter";

export interface SeasonInfo {
  id: Exclude<CitySeason, "">;
  name: string;
  icon: string;
  /** [month, day] it starts and ends (inclusive); may wrap over New Year. */
  from: [number, number];
  to: [number, number];
  /** The colours of its string lights. */
  bulbs: string[];
  /** Its prize decoration (data/decor.ts), shown in the plaza fountain each year it's on. */
  prize: string;
  /** What the town says when it starts. */
  hello: string;
}

export const SEASONS: SeasonInfo[] = [
  { id: "spring", name: "Spring Blossom", icon: "🌸", from: [3, 20], to: [5, 5], bulbs: ["#ffb3d1", "#fff3a8", "#b8f0c8", "#c9b8ff", "#ffffff"], prize: "blossomarch",
    hello: "🌸 Spring Blossom is here! Flowers on every corner, and a blossom arch to win in Goals ({n} days)" },
  { id: "summer", name: "Summer Festival", icon: "☀️", from: [6, 21], to: [8, 31], bulbs: ["#ff4d4d", "#ffd23a", "#4fd1ff", "#5ee07a", "#ff8ad8"], prize: "bandstand",
    hello: "☀️ The Summer Festival is on! Bunting on the streets, and a bandstand to win in Goals ({n} days)" },
  { id: "halloween", name: "Spooky Town", icon: "🎃", from: [10, 10], to: [11, 2], bulbs: ["#ff8a1f", "#9a4dff", "#7dff6a", "#ff8a1f"], prize: "giantpumpkin",
    hello: "🎃 Spooky Town is here! Pumpkins and purple lights, and a giant pumpkin to win in Goals ({n} days)" },
  { id: "winter", name: "Winter Lights", icon: "❄️", from: [12, 1], to: [1, 6], bulbs: ["#ff4d4d", "#ffd23a", "#4fd1ff", "#5ee07a", "#ff8ad8", "#ffffff"], prize: "bigtree",
    hello: "❄️ Winter Lights is here! Snow, string lights, and a giant holiday tree to win in Goals ({n} days)" },
];
export const seasonInfo = (id: CitySeason): SeasonInfo | undefined => SEASONS.find(x => x.id === id);

/** Testing: force a season or the weather (set from the address bar with ?debug). */
export const seasonDebug: { season?: CitySeason; weather?: WeatherKind } = {};

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();

/** The season on now, if any. */
export function citySeason(now = Date.now()): CitySeason {
  if (seasonDebug.season !== undefined) return seasonDebug.season;
  const x = md(new Date(now));
  for (const s of SEASONS) {
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
    if (a <= b ? x >= a && x <= b : x >= a || x <= b) return s.id;
  }
  return "";
}

/** The days left in the season on now (1 on its last day), or 0 when none is on. */
export function seasonDaysLeft(now = Date.now()): number {
  const s = seasonInfo(citySeason(now));
  if (!s) return 0;
  const d = new Date(now), wraps = s.from[0] > s.to[0] && d.getMonth() + 1 >= s.from[0];
  const end = new Date(d.getFullYear() + (wraps ? 1 : 0), s.to[0] - 1, s.to[1], 23, 59, 59);
  return Math.max(1, Math.ceil((end.getTime() - now) / 864e5));
}
export const winterDaysLeft = (now = Date.now()): number => (citySeason(now) === "winter" ? seasonDaysLeft(now) : 0);

/** A key for this year's run of the season on now (its welcome is said once a year). */
export function seasonKey(now = Date.now()): string {
  const id = citySeason(now), d = new Date(now);
  // (Winter that started in December belongs to that December's year.)
  return `${id}-${id === "winter" && d.getMonth() !== 11 ? d.getFullYear() - 1 : d.getFullYear()}`;
}
export const winterKey = (now = Date.now()): string => (citySeason(now) === "winter" ? seasonKey(now) : `winter-${new Date(now).getMonth() === 11 ? new Date(now).getFullYear() : new Date(now).getFullYear() - 1}`);

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
  // (Summer is mostly sunny; spring and autumn showers.)
  if (m >= 6 && m <= 8) return r < 0.06 ? "rain" : "clear";
  const wetMonth = m === 4 || m === 10 || m === 11;
  return r < (wetMonth ? 0.22 : 0.12) ? "rain" : "clear";
}

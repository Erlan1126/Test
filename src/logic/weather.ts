// The weather's moments in the town (data/season.ts has the weather itself):
// - a rainbow after rain: said once, and its pot of gold pays a little cash once per rainbow;
// - a snow day: while it snows, the cozy businesses (coffee, bakeries) earn a bit more.
import { HAS_CITY } from "../edition";
import { rainbowNow, townWeather, weatherSlot } from "../data/season";
import type { SaveData } from "./save";

export interface WeatherState {
  /** The slot (data/season.ts weatherSlot) whose rainbow was said hello to. */
  seen: number;
  /** The slot whose pot of gold was claimed. */
  gold: number;
  /** The slot that is (or was) a snow day: cozy businesses earn more during it. */
  snowDay: number;
}
export const newWeatherState = (): WeatherState => ({ seen: -1, gold: -1, snowDay: -1 });
export function normalizeWeather(raw: unknown): WeatherState {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const slot = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= -1 && v < 1e9 ? v : -1);
  return { seen: slot(r.seen), gold: slot(r.gold), snowDay: slot(r.snowDay) };
}

/** The businesses that do well on a snow day: hot drinks, fresh bread, a warm spa. */
export const COZY = ["coffee", "bakery", "royalbakery", "crystalcafe", "cloudspa"];
export const SNOW_DAY_MULT = 1.5;

/** Is a snow day on now (it starts when the player is in town while it snows)? */
export const snowDayOn = (s: SaveData, now = Date.now()): boolean => !!s.weather && s.weather.snowDay === weatherSlot(now);
/** What the snow day multiplies a business's pay by now (1 when it isn't cozy or no snow day). */
export const snowDayMult = (s: SaveData, id: string, now = Date.now()): number => (COZY.includes(id) && snowDayOn(s, now) ? SNOW_DAY_MULT : 1);
/** When the snow day `s` has starts and ends (for settling earnings over it), or null. */
export const snowDaySpan = (s: SaveData): [number, number] | null => (s.weather && s.weather.snowDay >= 0 ? [s.weather.snowDay * 72e5, (s.weather.snowDay + 1) * 72e5] : null);

/** Starts the snow day when it's snowing in town and it isn't on yet. Returns true when it
 *  starts now (say so). */
export function startSnowDay(s: SaveData, now = Date.now()): boolean {
  if (!HAS_CITY || townWeather(now) !== "snow") return false;
  const slot = weatherSlot(now);
  if (s.weather.snowDay === slot) return false;
  s.weather.snowDay = slot;
  return true;
}

/** A rainbow's hello: true once per rainbow (the first time it's asked during one). */
export function greetRainbow(s: SaveData, now = Date.now()): boolean {
  if (!HAS_CITY || !rainbowNow(now)) return false;
  const slot = weatherSlot(now);
  if (s.weather.seen === slot) return false;
  s.weather.seen = slot;
  return true;
}

/** Is the rainbow's pot of gold there to claim now? */
export const rainbowGoldOn = (s: SaveData, now = Date.now()): boolean => HAS_CITY && rainbowNow(now) && s.weather.gold !== weatherSlot(now);

/** What the pot of gold is worth: three minutes of the company's earnings (`rate`: coins a
 *  second), never less than 100. */
export const rainbowGoldValue = (rate: number): number => Math.round(Math.max(100, rate * 180));

/** Claims the pot of gold (once per rainbow): marks it and returns what it's worth, or 0 when
 *  there's none to claim. The caller pays it. */
export function claimRainbowGold(s: SaveData, rate: number, now = Date.now()): number {
  if (!rainbowGoldOn(s, now)) return 0;
  s.weather.gold = weatherSlot(now);
  return rainbowGoldValue(rate);
}

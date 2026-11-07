// Progress toward a holiday event's skin.
import { holidayAt, holidayKey, type Holiday } from "../data/holidays";
import type { SaveData } from "./save";

/** Towers built in this year's run of the holiday on now (0 if none is on). */
export function holidayProgress(save: SaveData, now = Date.now()): { h: Holiday; towers: number; done: boolean } | null {
  const h = holidayAt(now);
  if (!h) return null;
  const towers = save.holiday.key === holidayKey(h, now) ? save.holiday.towers : 0;
  return { h, towers, done: save.ownedSkins.includes(h.skin) };
}

/** Counts a finished tower toward the holiday skin. Returns the holiday when the skin was just earned. */
export function holidayTower(save: SaveData, now = Date.now()): Holiday | null {
  const h = holidayAt(now);
  if (!h) return null;
  const key = holidayKey(h, now);
  if (save.holiday.key !== key) save.holiday = { key, towers: 0 };
  save.holiday.towers++;
  if (save.holiday.towers >= h.towers && !save.ownedSkins.includes(h.skin)) {
    save.ownedSkins.push(h.skin);
    return h;
  }
  return null;
}

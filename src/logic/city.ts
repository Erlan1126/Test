// The sky city: every tower's people move into your city for good. Its population is your
// lifelong progress and opens new districts (floating islands with their own look). You
// choose which district your next tower goes up in, and its best towers stand there.
import { ISLAND_THEMES, type IslandTheme } from "../data/islands";
import type { SaveData } from "./save";
import { premiumGrants } from "./premium";

export const CITY_NAME = "Skyhaven";

/** Districts in the order they open. */
export const DISTRICTS: IslandTheme[] = [...ISLAND_THEMES].sort((a, b) => a.people - b.people);

/** Is a district open: by population, by an older builder-level unlock, or bought. */
export function districtOpen(save: SaveData, t: IslandTheme): boolean {
  if (save.population >= t.people) return true;
  if (t.product) return premiumGrants(save).themes.has(t.id);
  return save.profile.level >= t.level && t.people <= 20000;
}

/** The next district your population will open, if any. */
export const nextDistrict = (save: SaveData): IslandTheme | undefined =>
  DISTRICTS.find(t => !districtOpen(save, t));

/** How a finished tower adds to the city. Zen towers count a quarter (they can't fail). */
export const peopleFrom = (score: number, zen: boolean): number => Math.max(0, Math.round(zen ? score / 4 : score));

/** Moves a tower's people into the city. Returns districts that just opened. */
export function addPopulation(save: SaveData, people: number): IslandTheme[] {
  const before = DISTRICTS.filter(t => districtOpen(save, t));
  save.population += people;
  return DISTRICTS.filter(t => districtOpen(save, t) && !before.includes(t));
}

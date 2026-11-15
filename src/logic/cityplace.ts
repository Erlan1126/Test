// Where each city building stands on the island. Every building has a home spot, and the
// player can move a building to any other spot big enough for it (swapping with whatever
// stands there). `cityPlacement` turns the player's choices into a full, collision-free
// map, so a building bought later whose home spot is taken simply goes to a free one.
import { BUILD_SPOTS } from "../data/spots";
import type { SaveData } from "./save";

const fits = (building: string, spot: string): boolean =>
  !!BUILD_SPOTS[building] && !!BUILD_SPOTS[spot] && BUILD_SPOTS[spot].r >= BUILD_SPOTS[building].r - 0.25;

/** Building id → spot id for every building the player owns. */
export function cityPlacement(save: Pick<SaveData, "city" | "cityPlace">): Record<string, string> {
  const out: Record<string, string> = {}, taken = new Set<string>();
  const owned = save.city.filter(id => BUILD_SPOTS[id]);
  // The player's own choices first, then home spots, then any free spot that fits.
  for (const id of owned) {
    const s = save.cityPlace[id];
    if (s && fits(id, s) && !taken.has(s)) { out[id] = s; taken.add(s); }
  }
  for (const id of owned) if (!out[id] && !taken.has(id)) { out[id] = id; taken.add(id); }
  for (const id of owned) {
    if (out[id]) continue;
    const free = Object.keys(BUILD_SPOTS).find(s => !taken.has(s) && fits(id, s));
    if (free) { out[id] = free; taken.add(free); }
  }
  return out;
}

/** Spots a building could move to (any spot it fits, free or holding another building
 *  that fits back in its place), with whatever stands there now. */
export function moveTargets(save: Pick<SaveData, "city" | "cityPlace">, id: string): { spot: string; other?: string }[] {
  const place = cityPlacement(save), here = place[id];
  if (!here) return [];
  const at = new Map(Object.entries(place).map(([b, s]) => [s, b]));
  return Object.keys(BUILD_SPOTS)
    .filter(s => s !== here && fits(id, s))
    .map(s => ({ spot: s, other: at.get(s) }))
    .filter(t => !t.other || fits(t.other, here));
}

/** Moves a building to a spot, swapping with the building there. Returns false if it can't. */
export function moveBuilding(save: SaveData, id: string, spot: string): boolean {
  const target = moveTargets(save, id).find(t => t.spot === spot);
  if (!target) return false;
  const place = cityPlacement(save), here = place[id];
  // Pin everything where it stands now, so the swap doesn't shuffle other buildings.
  save.cityPlace = { ...place, [id]: spot };
  if (target.other) save.cityPlace[target.other] = here;
  return true;
}

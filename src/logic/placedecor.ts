// Decorations the player places in the city themselves: on any empty lot, moved to another
// lot whenever they like, or put away for later. Each one placed makes every business earn a
// little more (people come to see them). The Grand Stadium is a model made in Blender
// (launch/blender/stadium.py).
import type { SaveData } from "./save";

export interface PlaceItem {
  id: string;
  name: string;
  text: string;
  icon: string;
  /** Price in cash. */
  cash: number;
  /** Earnings bonus while placed (0.02 = +2% for every business). */
  bonus: number;
  /** The City Hall level it needs. */
  hall: number;
  /** Never sold: only won (the gingerbread house is behind the Advent calendar's last door). */
  won?: boolean;
}

export const PLACE_ITEMS: PlaceItem[] = [
  { id: "pocketpark", name: "Pocket park", text: "Shady trees, a bench and flower beds: a quiet green corner", icon: "🌳", cash: 60e3, bonus: 0.01, hall: 2 },
  { id: "fountain", name: "Fountain plaza", text: "A paved square round a splashing fountain", icon: "⛲", cash: 400e3, bonus: 0.015, hall: 3 },
  { id: "garden", name: "Flower garden", text: "Rows of tulips and roses round a little glasshouse", icon: "🌷", cash: 2.5e6, bonus: 0.02, hall: 3 },
  { id: "statue", name: "Hero statue", text: "A bronze statue of the town's founder on a stone plinth", icon: "🗽", cash: 15e6, bonus: 0.025, hall: 4 },
  { id: "clocktower", name: "Clock tower", text: "A stone clock tower with glowing faces and a bell, on its own little plaza", icon: "🕰️", cash: 40e6, bonus: 0.025, hall: 4 },
  { id: "market", name: "Market stalls", text: "Striped stalls selling fruit, flowers and snacks", icon: "🍎", cash: 180e6, bonus: 0.03, hall: 4 },
  { id: "lighthouse", name: "Lighthouse", text: "A red and white lighthouse on the rocks, its lamp shining at night", icon: "🗼", cash: 350e6, bonus: 0.04, hall: 4 },
  { id: "ferris", name: "Ferris wheel", text: "A big wheel that really turns, with ten colourful cabins", icon: "🎡", cash: 800e6, bonus: 0.05, hall: 6 },
  { id: "stadium", name: "Grand Stadium", text: "A stadium with a full pitch, floodlights and flags, modelled in Blender", icon: "🏟️", cash: 1.5e9, bonus: 0.06, hall: 6 },
  { id: "gingerbread", name: "Gingerbread house", text: "A snowy gingerbread house with icing on the roof and candy canes by the door, from the Advent calendar", icon: "🍪", cash: 0, bonus: 0.03, hall: 1, won: true },
  { id: "airport", name: "City airport", text: "A terminal, a control tower, a runway and a little plane: the city goes global", icon: "✈️", cash: 6e9, bonus: 0.08, hall: 7 },
];

export const placeItem = (id: string): PlaceItem | undefined => PLACE_ITEMS.find(p => p.id === id);

/** Where each owned decoration stands: a lot key, or "" while it's put away. */
export type PlacedState = Record<string, string>;

const hall = (s: SaveData) => 1 + Math.max(0, s.chapters?.done ?? 0);

/** The decoration standing on a lot, if any. */
export const placedOn = (s: SaveData, lot: string): PlaceItem | undefined => {
  for (const [id, at] of Object.entries(s.placed)) if (at === lot) return placeItem(id);
  return undefined;
};
/** Lot key → decoration id, for the town to draw. */
export const placedMap = (s: SaveData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [id, at] of Object.entries(s.placed)) if (at) out[at] = id;
  return out;
};

/** What every placed decoration adds to all earnings together (0.05 = +5%). */
export const placedBonus = (s: Pick<SaveData, "placed">): number =>
  Object.entries(s.placed ?? {}).reduce((a, [id, at]) => a + (at ? placeItem(id)?.bonus ?? 0 : 0), 0);

export type PlaceResult = "ok" | "short" | "hall" | "taken" | "unknown";

/** Can this lot take a decoration? Only empty lots (nothing built, nothing standing there). */
export const lotFree = (s: SaveData, lot: string): boolean =>
  lot.startsWith("g:") && (s.props[lot] ?? 0) === 0 && !placedOn(s, lot) && !(s.tycoon.builds ?? []).some(b => b.kind === "home" && b.id === lot);

/** Buys a decoration (if not owned yet) and places it on the lot. */
export function buyPlace(s: SaveData, id: string, lot: string): PlaceResult {
  const it = placeItem(id);
  if (!it) return "unknown";
  if (!lotFree(s, lot)) return "taken";
  if (id in s.placed) { s.placed[id] = lot; return "ok"; }
  if (it.won) return "unknown";
  if (hall(s) < it.hall) return "hall";
  if (s.tycoon.coins < it.cash) return "short";
  s.tycoon.coins -= it.cash;
  s.placed[id] = lot;
  return "ok";
}

/** Moves a placed decoration to another empty lot. */
export function movePlace(s: SaveData, id: string, lot: string): boolean {
  if (!(id in s.placed) || !lotFree(s, lot)) return false;
  s.placed[id] = lot;
  return true;
}

/** Puts a decoration away (it can be placed again for free). */
export function storePlace(s: SaveData, id: string): boolean {
  if (!(id in s.placed)) return false;
  s.placed[id] = "";
  return true;
}

export function normalizePlaced(v: unknown): PlacedState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>, out: PlacedState = {}, used = new Set<string>();
  for (const it of PLACE_ITEMS) {
    if (!(it.id in o)) continue;
    const at = typeof o[it.id] === "string" && /^g:-?\d+,-?\d+$/.test(o[it.id] as string) && !used.has(o[it.id] as string) ? (o[it.id] as string) : "";
    if (at) used.add(at);
    out[it.id] = at;
  }
  return out;
}

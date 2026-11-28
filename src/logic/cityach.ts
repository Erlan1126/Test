// Buildaroo's trophies: milestones in growing the city. They show in the game (Me ▸ Buildings)
// and, on iPhone, go to Game Center as achievements (ids "buildaroo.<id>", see
// launch/GAMECENTER.md).
import { bookCount, BOOK_SIZE, levelCount, DESIGNS_PER_LEVEL } from "./collection";
import type { SaveData } from "./save";

export interface CityTrophy { id: string; name: string; text: string; done: (s: SaveData) => boolean }

// (Worked out here rather than imported, so the save code can load this file early.)
const hallLevel = (s: SaveData) => 1 + Math.max(0, s.chapters?.done ?? 0);
const lotsBuilt = (s: SaveData) => Object.entries(s.props).filter(([k, l]) => k.startsWith("g:") && l >= 1).length;
const anyRow = (s: SaveData) => [1, 2, 3, 4, 5].some(l => levelCount(s, l) >= DESIGNS_PER_LEVEL);

export const CITY_TROPHIES: CityTrophy[] = [
  { id: "first_sale", name: "Open for Business", text: "Sell your first coffee", done: s => s.tycoon.tips > 0 },
  { id: "manager", name: "Delegator", text: "Hire your first manager", done: s => s.tycoon.managers.length > 0 },
  { id: "named", name: "Name on the Map", text: "Give your city a name", done: s => !!s.cityName },
  { id: "hall3", name: "Town Hall", text: "Reach City Hall level 3", done: s => hallLevel(s) >= 3 },
  { id: "hall6", name: "Proper City", text: "Reach City Hall level 6", done: s => hallLevel(s) >= 6 },
  { id: "hall11", name: "Metropolis", text: "Reach City Hall level 11", done: s => hallLevel(s) >= 11 },
  { id: "homes10", name: "Neighborhood", text: "Build 10 homes", done: s => lotsBuilt(s) >= 10 },
  { id: "homes30", name: "Suburbia", text: "Build 30 homes", done: s => lotsBuilt(s) >= 30 },
  { id: "skyscraper", name: "Skyline", text: "Grow a building to a skyscraper", done: s => Object.entries(s.props).some(([k, l]) => k.startsWith("g:") && l >= 5) },
  { id: "million", name: "Millionaire", text: "Earn $1M in total", done: s => s.tycoon.lifetime >= 1e6 },
  { id: "helper", name: "Good Neighbor", text: "Finish 5 neighbor requests", done: s => s.asks.done >= 5 },
  { id: "row", name: "Collector", text: "Find every design of one building level", done: anyRow },
  { id: "book", name: "Master Builder", text: `Find all ${BOOK_SIZE} building designs`, done: s => bookCount(s) >= BOOK_SIZE },
  { id: "holiday", name: "Winter Lights", text: "Win the giant holiday tree", done: s => s.decor.includes("bigtree") },
];

/** Trophies just earned (and marks them). */
export function checkCityTrophies(s: SaveData): CityTrophy[] {
  const out: CityTrophy[] = [];
  for (const tr of CITY_TROPHIES) if (!s.cityTrophies.includes(tr.id) && tr.done(s)) { s.cityTrophies.push(tr.id); out.push(tr); }
  return out;
}

export const normalizeCityTrophies = (v: unknown): string[] =>
  Array.isArray(v) ? CITY_TROPHIES.map(t => t.id).filter(id => (v as unknown[]).includes(id)) : [];

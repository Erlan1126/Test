// The building collection book: every design of every building level (render3d/houses.ts
// draws 10 designs for each of the 5 levels). A design counts once it has stood in the
// player's town; a finished level row pays crystals, and so does the whole book.
import type { SaveData } from "./save";

export const DESIGN_LEVELS = 5;
export const DESIGNS_PER_LEVEL = 10;
/** Crystals for finishing a level's row, and for the whole book. */
export const ROW_CRYSTALS = 15;
export const BOOK_CRYSTALS = 60;
/** What each level is called in the book. */
export const LEVEL_NAMES = ["Houses", "Shops", "Apartments", "Offices", "Skyscrapers"];

export interface CollectionState { seen: string[]; paid: number[] }
export const newCollection = (): CollectionState => ({ seen: [], paid: [] });

const valid = (k: string) => {
  const m = /^(\d):(\d)$/.exec(k);
  return !!m && +m[1] >= 1 && +m[1] <= DESIGN_LEVELS && +m[2] < DESIGNS_PER_LEVEL;
};

/** Adds the designs standing in the town now. Returns the ones that are new. */
export function addDesigns(s: SaveData, designs: string[]): string[] {
  const have = new Set(s.collection.seen), fresh: string[] = [];
  for (const d of designs) if (valid(d) && !have.has(d)) { have.add(d); fresh.push(d); }
  if (fresh.length) s.collection.seen = [...have];
  return fresh;
}

export const hasDesign = (s: SaveData, level: number, i: number): boolean => s.collection.seen.includes(`${level}:${i}`);
export const levelCount = (s: SaveData, level: number): number => s.collection.seen.filter(k => k.startsWith(`${level}:`)).length;
export const bookCount = (s: SaveData): number => s.collection.seen.length;
export const BOOK_SIZE = DESIGN_LEVELS * DESIGNS_PER_LEVEL;

/** Rewards ready to claim: level rows (1-5) and the whole book (0). */
export function bookReady(s: SaveData): number[] {
  const out: number[] = [];
  for (let l = 1; l <= DESIGN_LEVELS; l++) if (levelCount(s, l) >= DESIGNS_PER_LEVEL && !s.collection.paid.includes(l)) out.push(l);
  if (bookCount(s) >= BOOK_SIZE && !s.collection.paid.includes(0)) out.push(0);
  return out;
}

/** Claims a finished row (1-5) or the whole book (0). Returns the crystals, or 0. */
export function claimBook(s: SaveData, which: number): number {
  if (!bookReady(s).includes(which)) return 0;
  const n = which === 0 ? BOOK_CRYSTALS : ROW_CRYSTALS;
  s.collection.paid.push(which);
  s.crystals += n;
  return n;
}

export function normalizeCollection(v: unknown): CollectionState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const seen = Array.isArray(o.seen) ? [...new Set(o.seen.filter((x): x is string => typeof x === "string" && valid(x)))] : [];
  const paid = Array.isArray(o.paid) ? [...new Set(o.paid.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= DESIGN_LEVELS))] : [];
  return { seen, paid };
}

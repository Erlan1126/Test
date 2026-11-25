// Building paint (Buildaroo): each business's building can wear another pair of colours.
// A few paints are free, some cost crystals, and the seasonal ones (and Gold) come from the
// Season Pass (logic/seasonpass.ts).
import type { SaveData } from "./save";

export interface Paint {
  id: string;
  name: string;
  /** Main and accent colours. */
  c: [string, string];
  /** Crystals to own it (0: free). */
  crystals: number;
  /** Only from the Season Pass (never sold). */
  pass?: boolean;
}

export const PAINTS: Paint[] = [
  { id: "sunny", name: "Sunny", c: ["#ffc93a", "#ff7a2f"], crystals: 0 },
  { id: "ocean", name: "Ocean", c: ["#3fa4ff", "#1f5fd0"], crystals: 0 },
  { id: "mint", name: "Mint", c: ["#4fe0b0", "#1f9f7a"], crystals: 0 },
  { id: "berry", name: "Berry", c: ["#ff5f8f", "#b02a63"], crystals: 0 },
  { id: "candy", name: "Candy", c: ["#ff9ad5", "#7fd8ff"], crystals: 20 },
  { id: "midnight", name: "Midnight", c: ["#2c2f6e", "#8a7dff"], crystals: 20 },
  { id: "royal", name: "Royal", c: ["#7a3fd0", "#ffcf3a"], crystals: 30 },
  { id: "rosegold", name: "Rose Gold", c: ["#f2b8a8", "#c98a6a"], crystals: 30 },
  { id: "blossom", name: "Blossom", c: ["#ffc2dc", "#ff7fb0"], crystals: 0, pass: true },
  { id: "beach", name: "Beach Day", c: ["#ffe08a", "#2fc4d8"], crystals: 0, pass: true },
  { id: "pumpkin", name: "Pumpkin", c: ["#ff8a1f", "#5a2f8f"], crystals: 0, pass: true },
  { id: "frost", name: "Frost", c: ["#dff4ff", "#5fa8e8"], crystals: 0, pass: true },
  { id: "gold", name: "Solid Gold", c: ["#ffd23a", "#c88a10"], crystals: 0, pass: true },
];
export const paintById = (id: string): Paint | undefined => PAINTS.find(p => p.id === id);

export const ownsPaint = (s: SaveData, id: string): boolean => {
  const p = paintById(id);
  return !!p && ((p.crystals === 0 && !p.pass) || s.paints.includes(id));
};

/** A business's colours: its paint's, or its own. */
export function bizColors(s: SaveData, bizId: string, own: [string, string]): [string, string] {
  const p = paintById(s.paint[bizId] ?? "");
  return p && ownsPaint(s, p.id) ? p.c : own;
}

/** Paints a business (buying the paint with crystals if needed). "" goes back to its own colours. */
export function setPaint(s: SaveData, bizId: string, id: string): "ok" | "short" | "locked" {
  if (!id) { delete s.paint[bizId]; return "ok"; }
  const p = paintById(id);
  if (!p) return "locked";
  if (!ownsPaint(s, id)) {
    if (p.pass) return "locked";
    if (s.crystals < p.crystals) return "short";
    s.crystals -= p.crystals;
    s.paints.push(id);
  }
  s.paint[bizId] = id;
  return "ok";
}

export function normalizePaint(v: unknown): Record<string, string> {
  const o = v && typeof v === "object" ? v as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(o).filter(([k, x]) => /^[a-z0-9_-]{1,24}$/.test(k) && typeof x === "string" && !!paintById(x)).slice(0, 40)) as Record<string, string>;
}
export const normalizePaints = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!paintById(x)))] : [];

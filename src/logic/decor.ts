// Buying island decorations with Sky Crystals, and what they add to the company.
import { DECOR, DECOR_BONUS, decorById } from "../data/decor";
import type { SaveData } from "./save";

export type DecorResult = "ok" | "owned" | "short" | "unknown";

export function buyDecor(save: SaveData, id: string): DecorResult {
  const d = decorById(id);
  if (!d) return "unknown";
  if (save.decor.includes(id)) return "owned";
  if (save.crystals < d.crystals) return "short";
  save.crystals -= d.crystals;
  save.decor.push(id);
  return "ok";
}

/** What the decorations add to every business's earnings. */
export const decorMult = (save: Pick<SaveData, "decor">): number => 1 + DECOR_BONUS * save.decor.filter(id => decorById(id)).length;

/** Only known decoration ids, each once. */
export const normalizeDecor = (raw: unknown): string[] =>
  Array.isArray(raw) ? DECOR.map(d => d.id).filter(id => (raw as unknown[]).includes(id)) : [];

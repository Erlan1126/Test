// Unlocking and buying building shapes.
import { SHAPES, type Shape } from "../data/shapes";
import type { SaveData } from "./save";

export function shapeUnlocked(save: SaveData, s: Shape): boolean {
  const u = s.unlock;
  if (!u) return true;
  if ("level" in u) return save.profile.level >= u.level;
  return save.ownedShapes.includes(s.id);
}

export type ShapeBuy = "ok" | "owned" | "poor" | "unknown";

/** Buys a shape with stars or Sky Crystals, whichever it's priced in. */
export function buyShape(save: SaveData, id: string): ShapeBuy {
  const s = SHAPES.find(x => x.id === id);
  if (!s?.unlock || "level" in s.unlock) return "unknown";
  if (save.ownedShapes.includes(id)) return "owned";
  if ("stars" in s.unlock) {
    if (save.stars < s.unlock.stars) return "poor";
    save.stars -= s.unlock.stars;
  } else {
    if (save.crystals < s.unlock.crystals) return "poor";
    save.crystals -= s.unlock.crystals;
  }
  save.ownedShapes.push(id);
  return "ok";
}

/** The shape to build with: the chosen one, if it's still unlocked. */
export function currentShape(save: SaveData): Shape {
  const s = SHAPES.find(x => x.id === save.shape);
  return s && shapeUnlocked(save, s) ? s : SHAPES[0];
}

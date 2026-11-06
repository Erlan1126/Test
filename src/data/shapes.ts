// Building shapes: how each floor's footprint looks. Shapes are only drawn differently; the
// game still scores each floor by its rectangle, so every shape plays exactly the same.

export type ShapeUnlock =
  /** Free from builder level n. */
  | { level: number }
  /** Bought in the shop with stars. */
  | { stars: number }
  /** Bought with Sky Crystals. */
  | { crystals: number };

export interface Shape {
  id: string;
  name: string;
  /** Points of the footprint in a square from -1 to 1, going around. Must be convex. */
  pts: (floor: number) => [number, number][];
  /** No unlock means free from the start. */
  unlock?: ShapeUnlock;
}

const ring = (n: number, turn = 0, rx = 1, rz = 1): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * rz] as [number, number];
  });

/** A square with rounded corners (radius r, 0 to 1). */
function rounded(r: number): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  corners.forEach(([sx, sz], k) => {
    const start = k * Math.PI / 2;
    for (let i = 0; i <= 5; i++) {
      const a = start + (i / 5) * (Math.PI / 2);
      out.push([sx * (1 - r) + Math.cos(a) * r, sz * (1 - r) + Math.sin(a) * r]);
    }
  });
  return out;
}

/** A square turned by `a` radians, shrunk to fit inside the floor. */
function turned(a: number): [number, number][] {
  const k = 1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
  return ring(4, Math.PI / 4 + a, Math.SQRT2 * k, Math.SQRT2 * k);
}

const OCTAGON: [number, number][] = [[1, 0.42], [0.42, 1], [-0.42, 1], [-1, 0.42], [-1, -0.42], [-0.42, -1], [0.42, -1], [1, -0.42]];
const ROUND = ring(36);
const HEXAGON = ring(6, Math.PI / 6, 1 / Math.cos(Math.PI / 6), 1);
const DIAMOND = ring(4);
const SOFT = rounded(0.4);
const PILL = rounded(0.95);
const SQUARE: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

export const SHAPES: Shape[] = [
  { id: "square", name: "Classic Block", pts: () => SQUARE },
  { id: "round", name: "Rotunda", pts: () => ROUND, unlock: { level: 3 } },
  { id: "octagon", name: "Octagon", pts: () => OCTAGON, unlock: { level: 6 } },
  { id: "soft", name: "Soft Corners", pts: () => SOFT, unlock: { stars: 40 } },
  { id: "hexagon", name: "Hive", pts: () => HEXAGON, unlock: { level: 10 } },
  { id: "diamond", name: "Diamond", pts: () => DIAMOND, unlock: { stars: 80 } },
  { id: "pill", name: "Pebble", pts: () => PILL, unlock: { level: 15 } },
  // Each floor turns a little, like the famous twisting towers.
  { id: "twist", name: "Twister", pts: f => turned(((f * 6) % 90) * Math.PI / 180), unlock: { crystals: 300 } },
  { id: "spiral", name: "Helix", pts: f => ring(6, (f * 7 * Math.PI) / 180, 0.98, 0.98), unlock: { crystals: 300 } },
  { id: "wave", name: "Wave", pts: f => { const s = 0.78 + 0.22 * Math.cos(f * 0.5); return ring(36, 0, s, 1.56 - s); }, unlock: { crystals: 450 } },
];

export const shapeById = (id: string): Shape => SHAPES.find(s => s.id === id) ?? SHAPES[0];

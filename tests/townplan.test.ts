import { describe, expect, it } from "vitest";
import { ALL, BEACH, C, CIVIC, CIVIC_H, CIVIC_IN, HALL_PLAZA, HALL_SCALE, STREET_HALF, baseOutline, cellXZ, growGrid, hallSpot, insidePoly, isCivic, landJoin, landSpot, onHall } from "../src/render3d/townplan";
import { LAND } from "../src/data/land";

const groundLand = LAND.map((_, k) => k).filter(k => landJoin(k) === "ground");
const key = (c: [number, number]) => `${c[0]},${c[1]}`;
type Rect = { x0: number; x1: number; z0: number; z1: number };
/** Whether two rectangles overlap by more than a hair (touching edges don't count). */
const overlaps = (a: Rect, b: Rect) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-6 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-6;
/** The civic block inside its streets: the curb, sidewalk, lawn, square and hall. */
const civicInside = (): Rect => { const s = hallSpot(); return { x0: s.x - CIVIC_IN, x1: s.x + CIVIC_IN, z0: s.z - CIVIC_IN, z1: s.z + CIVIC_IN }; };
const cellRect = (c: [number, number]): Rect => { const p = cellXZ(c); return { x0: p.x - C / 2, x1: p.x + C / 2, z0: p.z - C / 2, z1: p.z + C / 2 }; };

/** Every piece of street the town draws for a set of blocks: the street (asphalt, curbs and
 *  zebra crossings) along each side of each block, and the crossroads at each corner. Each is
 *  as wide as the street, centred on the line between two blocks. */
function streetPieces(blocks: [number, number][]): Rect[] {
  const out: Rect[] = [], R = STREET_HALF;
  for (const c of blocks) {
    const { x0, x1, z0, z1 } = cellRect(c);
    for (const x of [x0, x1]) out.push({ x0: x - R, x1: x + R, z0, z1 });
    for (const z of [z0, z1]) out.push({ x0, x1, z0: z - R, z1: z + R });
    for (const x of [x0, x1]) for (const z of [z0, z1]) out.push({ x0: x - R, x1: x + R, z0: z - R, z1: z + R });
  }
  return out;
}

describe("the City Hall's civic block", () => {
  it("is one fixed spot, the middle of its own 2 by 2 block, the hall big and square on it", () => {
    const a = hallSpot(), b = hallSpot();
    expect(a).toEqual(b);
    expect(CIVIC).toHaveLength(4);
    const xs = CIVIC.map(c => c[0]), zs = CIVIC.map(c => c[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
    expect(Math.max(...zs) - Math.min(...zs)).toBe(1);
    const mid = CIVIC.map(cellXZ).reduce((p, q) => ({ x: p.x + q.x / 4, z: p.z + q.z / 4 }), { x: 0, z: 0 });
    expect(a.x).toBeCloseTo(mid.x);
    expect(a.z).toBeCloseTo(mid.z);
    expect(HALL_SCALE).toBeGreaterThanOrEqual(1.06);
    // Square to its block's streets (so it lines up with the sidewalks round it), its front
    // (+z, turned by rot) toward the town's blocks across the street.
    const qa = Math.abs(((a.rot % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    expect(Math.min(qa, Math.PI / 2 - qa)).toBeLessThan(1e-9);
    const fx = Math.sin(a.rot), fz = Math.cos(a.rot);
    expect(ALL.some(c => { const p = cellXZ(c); return Math.abs(p.x - (a.x + fx * C * 1.5)) < C / 2 + 0.01 && Math.abs(p.z - (a.z + fz * C * 1.5)) < C / 2 + 0.01; })).toBe(true);
    // The square fits inside the block's lawn, inside its sidewalk.
    expect(HALL_PLAZA).toBeLessThan(CIVIC_IN - 0.8);
  });

  it("stands on the island from the first day, off the town's blocks and the beach", () => {
    const s = hallSpot(), hull = baseOutline();
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) expect(insidePoly(hull, s.x + dx * CIVIC_H, s.z + dz * CIVIC_H, 1)).toBe(true);
    for (const c of [...ALL, ...BEACH]) expect(isCivic(c[0], c[1])).toBe(false);
    for (const c of [...ALL, ...BEACH]) expect(overlaps(cellRect(c), civicInside())).toBe(false);
  });

  it("never has a grid block on it, however far the city grows", () => {
    for (const land of [[], groundLand.slice(0, 1), groundLand]) for (const n of [0, 1, 5, 12, 40, 200]) {
      const grid = growGrid([], land, n);
      for (const c of grid) { expect(isCivic(c[0], c[1])).toBe(false); expect(onHall(cellXZ(c).x, cellXZ(c).z, C / 2 - 0.01)).toBe(false); }
    }
  });

  it("has no street, sidewalk or crossing inside it, at any growth", () => {
    for (const land of [[], groundLand.slice(0, 1), groundLand]) for (const n of [0, 1, 3, 5, 8, 12, 20, 40, 80, 200]) {
      const blocks = [...ALL, ...growGrid([], land, n)];
      // (The ground districts' own streets: their blocks fill a square 2 blocks each way.)
      for (const k of land) { const sp = landSpot(k, true); for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) blocks.push([Math.round((sp.x + (i + 0.5) * C + 2 * C) / C), Math.round((sp.z + (j + 0.5) * C + 2 * C) / C)]); }
      const pieces = streetPieces(blocks);
      for (const r of pieces) expect(overlaps(r, civicInside())).toBe(false);
      // Its own ring of streets stays outside its curb, too: each civic cell's street runs
      // only along the block's outer edge.
      const s = hallSpot();
      for (const c of CIVIC) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (isCivic(c[0] + a, c[1] + b)) continue;
        const p = cellXZ(c), ex = p.x + (a * C) / 2, ez = p.z + (b * C) / 2;
        expect(Math.max(Math.abs(ex - s.x), Math.abs(ez - s.z))).toBeCloseTo(CIVIC_H);
      }
    }
  });

  it("leaves every grid block joined to the town's streets", () => {
    const grid = growGrid([], groundLand, 200), keys = new Set([...ALL, ...CIVIC, ...grid].map(key));
    const seen = new Set(ALL.map(key)), todo = [...ALL];
    while (todo.length) {
      const [x, z] = todo.pop()!;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + a},${z + b}`; if (keys.has(k) && !seen.has(k)) { seen.add(k); todo.push([x + a, z + b]); } }
    }
    // (Blocks beside a district join its streets instead.)
    const nearDist = (c: [number, number]) => groundLand.some(k => { const sp = landSpot(k, true), p = cellXZ(c); return Math.abs(p.x - sp.x) <= 2 * C + C && Math.abs(p.z - sp.z) <= 2 * C + C; });
    for (const c of grid) expect(seen.has(key(c)) || nearDist(c)).toBe(true);
    // The civic block itself is beside the town's streets from the start.
    expect(CIVIC.some(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => ALL.some(t => t[0] === c[0] + a && t[1] === c[1] + b)))).toBe(true);
  });

  it("is clear of every district beside the town", () => {
    for (const k of groundLand) { const sp = landSpot(k, true); expect(onHall(sp.x, sp.z, 2 * C - 0.01)).toBe(false); }
  });
});

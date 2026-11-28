import { describe, expect, it } from "vitest";
import { ALL, BEACH, C, DIST_H, HALL_R, HALL_SCALE, baseOutline, cellXZ, growGrid, hallSpot, insidePoly, landJoin, landSpot, onHall, townMiddle } from "../src/render3d/townplan";
import { LAND } from "../src/data/land";

/** How far a point is from a block (street included) of the grid. */
const toCell = (c: [number, number], x: number, z: number) => { const p = cellXZ(c); return Math.hypot(Math.max(0, Math.abs(x - p.x) - C / 2), Math.max(0, Math.abs(z - p.z) - C / 2)); };
const groundLand = LAND.map((_, k) => k).filter(k => landJoin(k) === "ground");

describe("the City Hall's square", () => {
  it("is one fixed spot, at full size or bigger, turned to face the middle of town", () => {
    const a = hallSpot(), b = hallSpot();
    expect(a).toEqual(b);
    expect(HALL_SCALE).toBeGreaterThanOrEqual(1);
    const m = townMiddle();
    // Not square to the streets: at an angle, facing the middle.
    const q = Math.abs(((a.rot % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    expect(Math.min(q, Math.PI / 2 - q)).toBeGreaterThan(0.2);
    expect(Math.atan2(m.x - a.x, m.z - a.z)).toBeCloseTo(a.rot);
  });

  it("stands on the island, off the town's blocks and the beach", () => {
    const s = hallSpot();
    expect(insidePoly(baseOutline(), s.x, s.z, HALL_R)).toBe(true);
    for (const c of [...ALL, ...BEACH]) expect(toCell(c, s.x, s.z)).toBeGreaterThan(HALL_R);
  });

  it("never has a grid block on it, however far the city grows", () => {
    const s = hallSpot();
    for (const land of [[], groundLand.slice(0, 1), groundLand]) for (const n of [1, 5, 12, 40, 200]) {
      const grid = growGrid([], land, n);
      for (const c of grid) expect(toCell(c, s.x, s.z)).toBeGreaterThan(HALL_R);
    }
  });

  it("leaves every grid block joined to the town's streets", () => {
    const grid = growGrid([], groundLand, 200), keys = new Set([...ALL, ...grid].map(c => `${c[0]},${c[1]}`));
    const seen = new Set(ALL.map(c => `${c[0]},${c[1]}`)), todo = [...ALL];
    while (todo.length) {
      const [x, z] = todo.pop()!;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + a},${z + b}`; if (keys.has(k) && !seen.has(k)) { seen.add(k); todo.push([x + a, z + b]); } }
    }
    // (Blocks beside a district join its streets instead.)
    const nearDist = (c: [number, number]) => groundLand.some(k => { const sp = landSpot(k, true), p = cellXZ(c); return Math.abs(p.x - sp.x) <= 2 * C + C && Math.abs(p.z - sp.z) <= 2 * C + C; });
    for (const c of grid) expect(seen.has(`${c[0]},${c[1]}`) || nearDist(c)).toBe(true);
  });

  it("is clear of every district beside the town", () => {
    for (const k of groundLand) { const sp = landSpot(k, true); expect(onHall(sp.x, sp.z, DIST_H, 1)).toBe(false); }
  });
});

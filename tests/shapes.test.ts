import { describe, expect, it } from "vitest";
import { SHAPES, shapeById } from "../src/data/shapes";
import { buyShape, currentShape, shapeUnlocked } from "../src/logic/shapes";
import { defaultSave, normalize } from "../src/logic/save";
import { clipToBox, footprint } from "../src/render/footprint";
import { TowerSim } from "../src/logic/sim";
import { seeded } from "../src/core/rng";

const area = (pts: [number, number][]) => Math.abs(pts.reduce((s, [x, z], i) => { const [x2, z2] = pts[(i + 1) % pts.length]; return s + x * z2 - x2 * z; }, 0)) / 2;

describe("building shapes", () => {
  it("every shape fits inside its floor and goes counter-clockwise", () => {
    const box = { x0: -4, x1: 4, z0: -3, z1: 3 };
    for (const s of SHAPES) for (const y of [0, 7, 33]) {
      const pts = footprint(s, box, y);
      for (const [x, z] of pts) {
        expect(x).toBeGreaterThanOrEqual(-4.001); expect(x).toBeLessThanOrEqual(4.001);
        expect(z).toBeGreaterThanOrEqual(-3.001); expect(z).toBeLessThanOrEqual(3.001);
      }
      const signed = pts.reduce((a, [x, z], i) => { const [x2, z2] = pts[(i + 1) % pts.length]; return a + x * z2 - x2 * z; }, 0);
      expect(signed, s.id).toBeGreaterThan(0);
    }
  });

  it("a cut floor keeps the shape of the whole floor, sliced flat", () => {
    const frame = { x0: -4, x1: 4, z0: -4, z1: 4 }, box = { x0: -4, x1: 1, z0: -4, z1: 4 };
    const pts = footprint(shapeById("round"), box, 3, frame);
    expect(Math.max(...pts.map(p => p[0]))).toBeCloseTo(1);
    expect(area(pts)).toBeLessThan(area(footprint(shapeById("round"), frame, 3)));
    expect(clipToBox([[0, 0], [1, 0], [0, 1]], { x0: 5, x1: 6, z0: 5, z1: 6 })).toEqual([]);
  });

  it("the sim remembers a cut floor's whole outline when it is cut", () => {
    const sim = new TowerSim({ mode: "classic", rng: seeded(1), rewinds: 0 });
    for (let i = 0; i < 5000 && !(Math.abs(sim.offset()) > 1 && Math.abs(sim.offset()) < 2); i++) sim.step();
    const out = sim.drop();
    expect(out?.type).toBe("land");
    if (out?.type !== "land") return;
    expect(out.piece?.frame).toEqual(out.floor.frame);
    const f = out.floor.frame!;
    expect(f.x1 - f.x0 + f.z1 - f.z0).toBeGreaterThan(out.floor.x1 - out.floor.x0 + out.floor.z1 - out.floor.z0);
  });

  it("unlocks by level, stars or crystals, and saves the choice", () => {
    const save = defaultSave();
    expect(currentShape(save).id).toBe("square");
    expect(shapeUnlocked(save, shapeById("round"))).toBe(false);
    save.profile.level = 3;
    expect(shapeUnlocked(save, shapeById("round"))).toBe(true);
    save.stars = 39;
    expect(buyShape(save, "soft")).toBe("poor");
    save.stars = 40;
    expect(buyShape(save, "soft")).toBe("ok");
    expect(save.stars).toBe(0);
    expect(buyShape(save, "soft")).toBe("owned");
    save.crystals = 300;
    expect(buyShape(save, "twist")).toBe("ok");
    expect(save.crystals).toBe(0);
    expect(buyShape(save, "round")).toBe("unknown");
    save.shape = "twist";
    const back = normalize(JSON.parse(JSON.stringify(save)));
    expect(back.shape).toBe("twist");
    expect(back.ownedShapes).toEqual(["soft", "twist"]);
    expect(normalize({ ...save, shape: "blob" } as never).shape).toBe("square");
    // A shape you can no longer use falls back to the classic block.
    back.ownedShapes = [];
    expect(currentShape(back).id).toBe("square");
  });
});

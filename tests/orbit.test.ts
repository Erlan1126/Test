import { describe, expect, it } from "vitest";
import { aimError, findCapture, orbitPoint, rayDistance, spinFromApproach, tangent, type Planet } from "../src/logic/orbit";

const planet = (id: number, x: number, y: number, orbitR = 100): Planet => ({
  id, x, y, r: 40, orbitR, baseX: x, sway: 0, swaySpeed: 1, swayPhase: 0, look: 0,
});

describe("orbit math", () => {
  it("places points on the orbit circle", () => {
    const p = orbitPoint({ x: 10, y: 20 }, 50, Math.PI / 2);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(70);
  });

  it("moves along the orbit, perpendicular to the radius", () => {
    for (const angle of [0, 1, 2.5, -2]) {
      for (const spin of [1, -1] as const) {
        const t = tangent(angle, spin);
        expect(Math.hypot(t.x, t.y)).toBeCloseTo(1);
        expect(t.x * Math.cos(angle) + t.y * Math.sin(angle)).toBeCloseTo(0);
      }
    }
  });

  it("keeps the direction the player arrived with", () => {
    // Moving along the tangent of a spin, the approach should read back as that spin.
    for (const spin of [1, -1] as const) {
      const angle = 0.7;
      const rel = orbitPoint({ x: 0, y: 0 }, 100, angle);
      expect(spinFromApproach(rel, tangent(angle, spin))).toBe(spin);
    }
  });

  it("captures only inside the pull and skips the planet just left", () => {
    const a = planet(1, 0, 0), b = planet(2, 0, -300);
    expect(findCapture({ x: 0, y: -195 }, [a, b], -1, 10)?.id).toBe(2);
    expect(findCapture({ x: 0, y: -150 }, [a, b], -1, 10)).toBeNull();
    expect(findCapture({ x: 0, y: -90 }, [a, b], 1, 10)).toBeNull();
  });

  it("measures how far a launch misses its target", () => {
    expect(aimError({ x: 0, y: 0 }, { x: 0, y: -5 }, { x: 0, y: -100 })).toBeCloseTo(0);
    expect(aimError({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: -100 })).toBeCloseTo(Math.PI / 2);
    expect(aimError({ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 0, y: -100 })).toBeCloseTo(Math.PI);
  });

  it("measures how close a straight path passes a point", () => {
    expect(rayDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 50, y: 30 })).toBeCloseTo(30);
    // Points behind the start are measured from the start.
    expect(rayDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -40, y: 30 })).toBeCloseTo(50);
  });
});

import { describe, expect, it } from "vitest";
import { createRng } from "../src/logic/rng";
import { difficulty, WORLD_W, WorldGen } from "../src/logic/world";
import type { Planet } from "../src/logic/orbit";

function build(seed: number, count: number) {
  const gen = new WorldGen(createRng(seed));
  const planets: Planet[] = [gen.first()];
  const segments = [];
  for (let i = 1; i < count; i++) {
    const seg = gen.next(planets[planets.length - 1], i);
    planets.push(seg.planet);
    segments.push(seg);
  }
  return { planets, segments };
}

describe("world generation", () => {
  it("is the same for the same seed", () => {
    expect(build(42, 30).planets).toEqual(build(42, 30).planets);
    expect(build(42, 30).planets).not.toEqual(build(43, 30).planets);
  });

  it("climbs upward without overlapping orbits", () => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const { planets } = build(seed, 120);
      for (let i = 1; i < planets.length; i++) {
        const a = planets[i - 1], b = planets[i];
        expect(b.y).toBeLessThan(a.y);
        expect(a.y - b.y).toBeGreaterThan(a.orbitR + b.orbitR + 40);
      }
    }
  });

  it("keeps every orbit on screen, even while swaying", () => {
    for (const seed of [5, 6, 7, 8]) {
      for (const p of build(seed, 150).planets) {
        expect(p.baseX - p.sway - p.orbitR).toBeGreaterThanOrEqual(0);
        expect(p.baseX + p.sway + p.orbitR).toBeLessThanOrEqual(WORLD_W);
      }
    }
  });

  it("puts stars between planets and keeps asteroids in bounds", () => {
    const { planets, segments } = build(11, 200);
    segments.forEach((seg, i) => {
      for (const s of seg.stars) {
        expect(s.y).toBeLessThan(planets[i].y);
        expect(s.y).toBeGreaterThan(seg.planet.y);
      }
      for (const a of seg.asteroids) {
        expect(a.x).toBeGreaterThanOrEqual(a.minX);
        expect(a.x).toBeLessThanOrEqual(a.maxX);
      }
    });
    expect(segments.some(s => s.asteroids.length > 0)).toBe(true);
  });

  it("starts gentle and gets harder", () => {
    const early = difficulty(0), late = difficulty(40);
    expect(early.swayChance).toBe(0);
    expect(early.asteroidChance).toBe(0);
    expect(late.orbitSpeed).toBeGreaterThan(early.orbitSpeed);
    expect(late.gapMax).toBeGreaterThan(early.gapMax);
    expect(late.swayChance).toBeGreaterThan(0);
  });
});

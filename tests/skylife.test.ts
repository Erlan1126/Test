// The sky around a growing tower: something passes now and then, fitting the height, and
// never while you're not building.
import { describe, expect, it } from "vitest";
import { SKY_GAP, SkyLife, skyKind } from "../src/render3d/skylife";
import { seeded } from "../src/core/rng";

describe("life in the sky", () => {
  it("sends birds low down, balloons higher and planes above the clouds", () => {
    expect(skyKind(5, 0.9)).toBe("birds");
    expect(skyKind(30, 0.1)).toBe("balloon");
    expect(skyKind(30, 0.9)).toBe("birds");
    expect(skyKind(58, 0.1)).toBe("plane");
    expect(skyKind(58, 0.9)).toBe("balloon");
  });

  it("sends sky lanterns at twilight and comets among the stars", () => {
    expect(skyKind(70, 0.1)).toBe("lanterns");
    expect(skyKind(70, 0.6)).toBe("plane");
    expect(skyKind(95, 0.1)).toBe("comet");
    expect(skyKind(95, 0.7)).toBe("lanterns");
    for (const level of [70, 95]) {
      const sky = new SkyLife(seeded(level));
      const seen = new Set<string>();
      for (let i = 0; i < 60 * 600; i++) { sky.update(1 / 60, i / 60, level, true, 1); if (sky.passing) seen.add(sky.passing); }
      expect([...seen].sort()).toEqual(level === 70 ? ["balloon", "lanterns", "plane"] : ["comet", "lanterns", "plane"]);
      // Only the one passing by shows.
      expect(sky.group.children.filter(c => c.visible).length).toBeLessThanOrEqual(1);
    }
  });

  it("only comes while you build, every so often, and goes again", () => {
    const sky = new SkyLife(seeded(7));
    for (let i = 0; i < 60 * 30; i++) sky.update(1 / 60, i / 60, 20, false, 0);
    expect(sky.passing).toBeNull();
    let seen = 0, frames = 0, was: string | null = null;
    for (let i = 0; i < 60 * 120; i++) {
      sky.update(1 / 60, i / 60, 20, true, 0);
      if (sky.passing && !was) seen++;
      if (sky.passing) frames++;
      was = sky.passing;
    }
    // Two minutes of building: several passers-by, but the sky isn't always busy.
    expect(seen).toBeGreaterThanOrEqual(120 / (SKY_GAP[1] + 15));
    expect(seen).toBeLessThanOrEqual(120 / SKY_GAP[0]);
    expect(frames).toBeLessThan(60 * 120);
    expect(sky.group.children.some(c => c.visible)).toBe(!!sky.passing);
  });

  it("hurries over when a landmark is passed", () => {
    const sky = new SkyLife(seeded(3));
    sky.update(1 / 60, 0, 10, true, 0);
    sky.soon();
    for (let i = 0; i < 40; i++) sky.update(1 / 60, i / 60, 10, true, 0);
    expect(sky.passing).toBe("birds");
  });
});

describe("the home screen's tower", () => {
  it("is your tallest tower in the district, the first one built on a tie", async () => {
    const { bestTower } = await import("../src/logic/skyline");
    expect(bestTower([])).toBeNull();
    const a = { f: 20, s: "classic", h: "square", d: "meadow" }, b = { f: 31, s: "glass", h: "round", d: "meadow" }, c = { f: 31, s: "neon", h: "square", d: "meadow" };
    expect(bestTower([a, b, c])).toBe(b);
    expect(bestTower([a])).toBe(a);
  });
});

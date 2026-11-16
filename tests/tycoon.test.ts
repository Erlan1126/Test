import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { BUSINESSES, coins } from "../src/data/tycoon";
import { affordable, buyLevels, costOf, cycleOf, eraGems, hireManager, multiplier, newEra, perSecond, runOnce, tick, timeWarp, towerBonus } from "../src/logic/tycoon";

const T0 = 1_800_000_000_000;

describe("Skyhaven Tycoon", () => {
  it("starts with a coffee cart that pays once per tap", () => {
    const s = defaultSave();
    s.tycoon.last = T0;
    expect(s.tycoon.levels.coffee).toBe(1);
    expect(runOnce(s, "coffee", T0)).toBe(true);
    expect(tick(s, T0 + 500)).toBe(0);
    const got = tick(s, T0 + 900);
    expect(got).toBeCloseTo(multiplier(s, T0));
    expect(tick(s, T0 + 5000)).toBe(0); // no manager: it waits for the next tap
  });

  it("prices levels on a growing curve and buys the most it can afford", () => {
    const b = BUSINESSES[0];
    expect(costOf(b, 1, 1)).toBeCloseTo(b.cost * b.growth);
    const s = defaultSave();
    s.tycoon.coins = 1000;
    const n = affordable(b, 1, 1000);
    expect(costOf(b, 1, n)).toBeLessThanOrEqual(1000);
    expect(costOf(b, 1, n + 1)).toBeGreaterThan(1000);
    expect(buyLevels(s, "coffee", "max")).toBe(n);
    expect(s.tycoon.levels.coffee).toBe(1 + n);
  });

  it("doubles speed at milestones", () => {
    const b = BUSINESSES[0];
    expect(cycleOf(b, 24)).toBe(b.cycle);
    expect(cycleOf(b, 25)).toBe(b.cycle / 2);
    expect(cycleOf(b, 100)).toBe(b.cycle / 8);
  });

  it("keeps earning with a manager while away, up to the offline limit", () => {
    const s = defaultSave();
    s.tycoon.coins = 5000;
    expect(hireManager(s, "coffee", T0)).toBe(true);
    const rate = perSecond(s, T0);
    const hour = tick(s, T0 + 3600e3);
    expect(hour).toBeGreaterThan(rate * 3590);
    const s2 = defaultSave();
    s2.tycoon.coins = 5000;
    hireManager(s2, "coffee", T0);
    // Two days away pays only the 8-hour cap.
    expect(tick(s2, T0 + 48 * 3600e3)).toBeLessThan(rate * 8.01 * 3600);
  });

  it("gives Sky Gems for a New Era and they raise every later era's earnings", () => {
    const s = defaultSave();
    s.tycoon.lifetime = 4e11;
    const before = multiplier(s, T0);
    const g = eraGems(s);
    expect(g).toBe(200);
    expect(newEra(s, T0)).toBe(200);
    expect(s.tycoon.levels).toEqual({ coffee: 1 });
    expect(multiplier(s, T0)).toBeCloseTo(before * 5);
    expect(eraGems(s)).toBe(0);
  });

  it("feeds on the sky city: more people, more earnings; towers pay a bonus", () => {
    const s = defaultSave();
    const base = multiplier(s, T0);
    s.population = 40000;
    expect(multiplier(s, T0)).toBeCloseTo(base * 2);
    expect(towerBonus(s, 0, T0)).toBe(0);
    expect(towerBonus(s, 20, T0)).toBeGreaterThan(0);
  });

  it("time warps cost crystals and need a manager", () => {
    const s = defaultSave();
    s.crystals = 500;
    expect(timeWarp(s, 4, T0)).toBe(0);
    s.tycoon.coins = 5000; hireManager(s, "coffee", T0);
    expect(timeWarp(s, 4, T0)).toBeGreaterThan(0);
    expect(s.crystals).toBe(400);
  });

  it("survives a save round trip and shortens huge numbers", () => {
    const s = defaultSave();
    s.tycoon.coins = 1.5e20; s.tycoon.levels.pizza = 30; s.tycoon.managers = ["coffee", "bogus"];
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.tycoon.coins).toBe(1.5e20);
    expect(back.tycoon.levels.pizza).toBe(30);
    expect(back.tycoon.managers).toEqual(["coffee"]);
    expect(coins(1234)).toBe("1.23K");
    expect(coins(5.6e15)).toBe("5.60Qa");
    expect(coins(1e40)).toMatch(/^10\\.0[a-z]{2}$|^10.0[a-z]{2}$/);
  });
});

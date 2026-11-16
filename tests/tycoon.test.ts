import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { BUSINESSES, coins, ERA_SCALE } from "../src/data/tycoon";
import { doubleAway, doublePrice, speedupsLeft } from "../src/logic/tycoon";
import { affordable, buyLevels, freeFloors, costOf, cycleOf, eraGems, hireManager, multiplier, newEra, perSecond, runOnce, tick, timeWarp, towerBonus } from "../src/logic/tycoon";

const T0 = 1_800_000_000_000;

describe("Skyhaven Tycoon", () => {
  it("starts with a coffee cart that pays once per tap", () => {
    const s = defaultSave();
    s.tycoon.last = T0;
    expect(s.tycoon.levels.coffee).toBe(1);
    expect(runOnce(s, "coffee", T0)).toBe(true);
    expect(tick(s, T0 + 500)).toBe(0);
    expect(BUSINESSES[0].income).toBe(1); // a whole coin per tap from the start
    const got = tick(s, T0 + BUSINESSES[0].cycle * 1000 + 100);
    expect(got).toBeCloseTo(multiplier(s, T0));
    expect(tick(s, T0 + 20000)).toBe(0); // no manager: it waits for the next tap
  });

  it("prices levels on a growing curve and buys the most it can afford", () => {
    const b = BUSINESSES[0];
    expect(costOf(b, 1, 1)).toBeCloseTo(b.cost * b.growth);
    const s = defaultSave();
    s.tycoon.floors = 500; // plenty of office floors
    s.tycoon.coins = 1000;
    const n = affordable(b, 1, 1000);
    expect(costOf(b, 1, n)).toBeLessThanOrEqual(1000);
    expect(costOf(b, 1, n + 1)).toBeGreaterThan(1000);
    expect(buyLevels(s, "coffee", "max")).toBe(n);
    expect(s.tycoon.levels.coffee).toBe(1 + n);
  });

  it("needs an empty office floor for every level: towers add floors", () => {
    const s = defaultSave();
    s.tycoon.coins = 1e12;
    expect(freeFloors(s)).toBe(9); // ten floors, one used by the coffee cart
    expect(buyLevels(s, "coffee", 10)).toBe(0);
    expect(buyLevels(s, "coffee", "max")).toBe(9);
    expect(freeFloors(s)).toBe(0);
    towerBonus(s, 20); // a 20-floor tower
    expect(buyLevels(s, "coffee", 10)).toBe(10);
  });

  it("doubles speed at milestones", () => {
    const b = BUSINESSES[0];
    expect(cycleOf(b, 24)).toBe(b.cycle);
    expect(cycleOf(b, 25)).toBe(b.cycle / 2);
    expect(cycleOf(b, 99)).toBe(b.cycle / 2);
    expect(cycleOf(b, 100)).toBe(b.cycle / 4); // speed-ups come with each new stage
    expect(cycleOf(b, 400)).toBe(b.cycle / 16);
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
    s.tycoon.lifetime = ERA_SCALE * 400;
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
    s.population = 1e6;
    expect(multiplier(s, T0)).toBeCloseTo(base * 2);
    expect(towerBonus(s, 0, T0)).toBe(0);
    expect(towerBonus(s, 20, T0)).toBeGreaterThan(0);
  });

  it("time warps cost crystals, need a manager, and only a few a day", () => {
    const s = defaultSave();
    s.crystals = 5000;
    expect(timeWarp(s, 1, T0)).toBe(0);
    s.tycoon.coins = 5000; hireManager(s, "coffee", T0);
    const rate = perSecond(s, T0);
    expect(timeWarp(s, 1, T0)).toBeCloseTo(rate * 3600);
    expect(s.crystals).toBe(4900);
    expect(timeWarp(s, 8, T0)).toBeCloseTo(rate * 8 * 3600);
    expect(s.crystals).toBe(4400);
    expect(doubleAway(s, 1000, 2 * 3600e3, T0)).toBe(true); // the third speed-up today
    expect(s.crystals).toBe(4400 - doublePrice(s, 2 * 3600e3, T0));
    expect(timeWarp(s, 1, T0)).toBe(0);
    expect(speedupsLeft(s, T0)).toBe(0);
    expect(speedupsLeft(s, T0 + 86400e3)).toBe(3);
    expect(timeWarp(s, 1, T0 + 86400e3)).toBeGreaterThan(0);
  });

  it("doubling the welcome-back coins costs more the longer you were away", () => {
    const s = defaultSave();
    expect(doublePrice(s, 60e3, T0)).toBe(10);
    expect(doublePrice(s, 2 * 3600e3, T0)).toBe(80);
    expect(doublePrice(s, 30 * 3600e3, T0)).toBe(320); // capped at 8 hours
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

import { STAGE_NAMES } from "../src/data/tycoon";
import { nextStage, payOf, rushOn, stageName, stageOf, startRush, vipTip } from "../src/logic/tycoon";

describe("tycoon evolution and live events", () => {
  it("businesses grow through five named stages", () => {
    expect([1, 24, 25, 99, 100, 200, 399, 400, 9999].map(stageOf)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
    expect(stageName("coffee", 1)).toBe("Coffee Cart");
    expect(stageName("coffee", 25)).toBe("Coffee Shop");
    expect(stageName("mall", 400)).toBe("Mall Empire");
    expect(nextStage(1)).toBe(25);
    expect(nextStage(150)).toBe(200);
    expect(nextStage(400)).toBeUndefined();
    for (const b of BUSINESSES) {
      expect(STAGE_NAMES[b.id]).toHaveLength(5);
      expect(STAGE_NAMES[b.id][0]).toBe(b.name);
    }
  });

  it("rush hour triples one business for a while, and only once at a time", () => {
    const s = defaultSave();
    const b = BUSINESSES[0], before = payOf(s, b, T0);
    expect(startRush(s, T0, () => 0)).toBe("coffee");
    expect(rushOn(s, "coffee", T0 + 1000)).toBe(true);
    expect(payOf(s, b, T0 + 1000)).toBeCloseTo(before * 3);
    expect(startRush(s, T0 + 2000)).toBe("");
    expect(rushOn(s, "coffee", T0 + 46_000)).toBe(false);
    expect(payOf(s, b, T0 + 46_000)).toBeCloseTo(before);
  });

  it("a rush doesn't count for a long stretch away", () => {
    const s = defaultSave();
    s.tycoon.managers = ["coffee"];
    s.tycoon.runs.coffee = T0;
    startRush(s, T0, () => 0);
    s.tycoon.rush.until = T0 + 10 * 3600e3; // even a bad value: away 1h earns normal pay
    const plain = defaultSave();
    plain.tycoon.managers = ["coffee"];
    plain.tycoon.runs.coffee = T0;
    expect(tick(s, T0 + 3600e3)).toBeCloseTo(tick(plain, T0 + 3600e3));
  });

  it("a VIP tips about twenty seconds of earnings", () => {
    const s = defaultSave();
    const b = BUSINESSES[0];
    const tip = vipTip(s, "coffee", T0);
    expect(tip).toBeCloseTo((payOf(s, b, T0) / cycleOf(b, 1)) * 20);
    expect(s.tycoon.coins).toBeCloseTo(tip);
    expect(vipTip(s, "spaceport", T0)).toBe(0);
  });

  it("a saved rush survives loading, a bad one is dropped", () => {
    const a = defaultSave();
    a.tycoon.rush = { id: "coffee", until: T0 };
    expect(normalize(JSON.parse(JSON.stringify(a))).tycoon.rush).toEqual({ id: "coffee", until: T0 });
    const bad = JSON.parse(JSON.stringify(a));
    bad.tycoon.rush = { id: "nope", until: "x" };
    expect(normalize(bad).tycoon.rush.id).toBe("");
  });
});

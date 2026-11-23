import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { BUSINESSES, coins, ERA_SCALE } from "../src/data/tycoon";
import { doubleAway, doublePrice, FREE_FLOORS, speedupsLeft } from "../src/logic/tycoon";
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
    expect(freeFloors(s)).toBe(FREE_FLOORS - 1); // the free floors, one used by the coffee cart
    expect(buyLevels(s, "coffee", FREE_FLOORS + 5)).toBe(FREE_FLOORS - 1); // buys what fits
    expect(buyLevels(s, "coffee", "max")).toBe(0);
    expect(freeFloors(s)).toBe(0);
    towerBonus(s, 20); // a 20-floor tower: two office floors each
    expect(freeFloors(s)).toBe(40);
    expect(buyLevels(s, "coffee", 10)).toBe(10);
  });

  it("doubles speed at milestones", () => {
    const b = BUSINESSES[0];
    expect(cycleOf(b, 9)).toBe(b.cycle);
    expect(cycleOf(b, 10)).toBe(b.cycle / 2); // an early first one
    expect(cycleOf(b, 24)).toBe(b.cycle / 2);
    expect(cycleOf(b, 25)).toBe(b.cycle / 4);
    expect(cycleOf(b, 50)).toBe(b.cycle / 8);
    expect(cycleOf(b, 100)).toBe(b.cycle / 16); // speed-ups come with each new stage too
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
    expect(coins(1234)).toBe("$1.23K");
    expect(coins(12)).toBe("$12");
    expect(coins(5.6e15)).toBe("$5.60Qa");
    expect(coins(1e40)).toMatch(/^\$10\.0[a-z]{2}$/);
  });
});

import { STAGE_NAMES } from "../src/data/tycoon";
import { nextStage, payOf, rushOn, stageName, stageOf, startRush, vipTip } from "../src/logic/tycoon";

describe("tycoon evolution and live events", () => {
  it("businesses grow through eight named stages", () => {
    expect([1, 24, 25, 99, 100, 200, 399, 400, 599, 600, 800, 999, 1000, 9999].map(stageOf)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7]);
    expect(stageName("coffee", 0)).toBe("Coffee Cart");
    expect(stageName("coffee", 1)).toBe("Coffee Shop");
    expect(stageName("mall", 4)).toBe("Mall Empire");
    expect(nextStage(1)).toBe(25);
    expect(nextStage(150)).toBe(200);
    expect(nextStage(400)).toBe(600);
    expect(nextStage(1000)).toBeUndefined();
    expect(stageName("mall", 7)).toBe("Mall Sky Wonder");
    for (const b of BUSINESSES) {
      expect(STAGE_NAMES[b.id]).toHaveLength(8);
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

  it("a VIP tips half a minute of earnings, never less than a quarter of the next level", () => {
    const s = defaultSave();
    const b = BUSINESSES[0];
    const tip = vipTip(s, "coffee", T0);
    expect(tip).toBeCloseTo(Math.max((payOf(s, b, T0) / cycleOf(b, 1)) * 30, costOf(b, 1, 1) * 0.25));
    expect(tip).toBeGreaterThanOrEqual(costOf(b, 1, 1) * 0.25);
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

describe("tycoon economy reset", () => {
  it("a company from the old, too-fast economy starts over once, keeping floors and the booster", () => {
    const old = JSON.parse(JSON.stringify(defaultSave()));
    old.tycoon = { coins: 2e8, lifetime: 5e9, levels: { coffee: 120, flowers: 60, mall: 3 }, managers: ["coffee"], runs: {}, gems: 40, boost: true, last: 0, eras: 1, floors: 900 };
    const t = normalize(old).tycoon;
    expect(t.coins).toBe(0);
    expect(t.lifetime).toBe(0);
    expect(t.levels).toEqual({ coffee: 1 });
    expect(t.managers).toEqual([]);
    expect(t.gems).toBe(0);
    expect(t.floors).toBe(900);
    expect(t.boost).toBe(true);
    // ...and only once: a new-economy company is kept as it is.
    const now = normalize(JSON.parse(JSON.stringify({ ...defaultSave(), tycoon: { ...t, coins: 500, levels: { coffee: 7 } } }))).tycoon;
    expect(now.coins).toBe(500);
    expect(now.levels).toEqual({ coffee: 7 });
  });
});

import { basePay, dealGoals, goalStep } from "../src/logic/tycoon";

describe("company goals and first steps", () => {
  it("deals three different goals a day and pays stars, then a crystal bonus for all three", () => {
    const s = defaultSave();
    dealGoals(s, T0, () => 0.1);
    const g = s.tycoon.goals.list;
    expect(g).toHaveLength(3);
    expect(new Set(g.map(x => x.t)).size).toBe(3);
    const stars0 = s.stars, crystals0 = s.crystals;
    for (const x of [...g]) {
      const r = goalStep(s, x.t, x.n, T0);
      expect(r.stars).toBeGreaterThan(0);
    }
    expect(s.stars).toBeGreaterThan(stars0);
    expect(s.tycoon.picks).toBe(1); // the bonus: a free advisor pick while any are left
    expect(s.tycoon.advisors).toHaveLength(0); // the player chooses who joins
    expect(s.crystals).toBe(crystals0);
    // Nothing more today...
    expect(goalStep(s, g[0].t, 5, T0).stars).toBe(0);
    // ...and a new set tomorrow.
    dealGoals(s, T0 + 86400e3);
    expect(s.tycoon.goals.list.every(x => x.p === 0)).toBe(true);
    expect(s.tycoon.goals.bonus).toBe(false);
  });

  it("goals and first steps survive a save round trip; old companies are told about the fresh start", () => {
    const s = defaultSave();
    dealGoals(s, T0);
    goalStep(s, s.tycoon.goals.list[0].t, 1, T0);
    s.tycoon.tips = 2;
    const back = normalize(JSON.parse(JSON.stringify(s))).tycoon;
    expect(back.goals).toEqual(s.tycoon.goals);
    expect(back.tips).toBe(2);
    expect(back.fresh).toBe(false);
    const old = JSON.parse(JSON.stringify(defaultSave()));
    old.tycoon = { coins: 5, levels: { coffee: 3 }, managers: [] };
    expect(normalize(old).tycoon.fresh).toBe(true);
  });
});

describe("rush hour fairness", () => {
  it("triples a slow managed business's cycle that finishes during the rush, but not a time warp", () => {
    const s = defaultSave();
    s.tycoon.floors = 100;
    s.tycoon.levels.cinema = 1;
    s.tycoon.managers = ["cinema"];
    const b = BUSINESSES.find(x => x.id === "cinema")!, c = cycleOf(b, 1) * 1000;
    s.tycoon.runs.cinema = T0;
    s.tycoon.rush = { id: "cinema", until: T0 + c + 10_000 };
    const plain = basePay(s, b, T0);
    expect(tick(s, T0 + c + 1000)).toBeCloseTo(plain * 3);
    // A time warp during the rush pays the normal rate.
    s.crystals = 1000;
    const rate = perSecond(s, T0 + c + 2000, false);
    expect(timeWarp(s, 1, T0 + c + 2000)).toBeCloseTo(rate * 3600);
    expect(rate).toBeCloseTo(plain / cycleOf(b, 1));
  });
});

import { ADVISORS, HQ_FLOORS, STAGE_MULT, UPGRADES, VAULT_COST } from "../src/data/tycoon";
import { buyUpgrade, buyVault, evolve, festivalBiz, giveAdvisor, offlineHours, hireAdvisor, readyStage, stageNow, startBoom, review } from "../src/logic/tycoon";

describe("grand openings, upgrades, advisors and the vault", () => {
  it("a business only evolves once its new headquarters is built tall enough", () => {
    const s = defaultSave();
    s.tycoon.levels.coffee = 30;
    expect(stageNow(s, "coffee")).toBe(0);
    expect(readyStage(s, "coffee")).toBe(1);
    const b = BUSINESSES[0], before = basePay(s, b, T0);
    expect(evolve(s, "coffee", HQ_FLOORS[1] - 1)).toBe(0);
    expect(evolve(s, "coffee", HQ_FLOORS[1])).toBe(1);
    expect(stageNow(s, "coffee")).toBe(1);
    expect(readyStage(s, "coffee")).toBe(0);
    expect(basePay(s, b, T0)).toBeCloseTo(before * STAGE_MULT);
  });

  it("old saves keep the stages their levels had reached", () => {
    const old = JSON.parse(JSON.stringify(defaultSave()));
    old.tycoon.levels = { coffee: 120, flowers: 30 };
    delete old.tycoon.evolved;
    const t = normalize(old).tycoon;
    expect(t.evolved).toEqual({ coffee: 2, flowers: 1 });
  });

  it("upgrades multiply earnings once, for coins", () => {
    const s = defaultSave();
    const u = UPGRADES.find(x => x.biz === "coffee")!, b = BUSINESSES[0];
    const before = basePay(s, b, T0);
    expect(buyUpgrade(s, u.id)).toBe(false);
    s.tycoon.coins = u.cost;
    expect(buyUpgrade(s, u.id)).toBe(true);
    expect(s.tycoon.coins).toBe(0);
    expect(buyUpgrade(s, u.id)).toBe(false);
    expect(basePay(s, b, T0)).toBeCloseTo(before * u.mult);
  });

  it("advisors are collected one by one, never twice, and their perks work", () => {
    const s = defaultSave();
    for (let i = 0; i < ADVISORS.length; i++) expect(giveAdvisor(s)).toBeDefined();
    expect(new Set(s.tycoon.advisors).size).toBe(ADVISORS.length);
    expect(giveAdvisor(s)).toBeUndefined();
    s.crystals = 1000;
    expect(hireAdvisor(s, "otto")).toBeUndefined(); // already on the team: no crystals taken
    expect(s.crystals).toBe(1000);
    expect(offlineHours(s, T0)).toBe(8 + 4); // Otto
  });

  it("crystals hire the advisor you choose, once, with nothing random", () => {
    const s = defaultSave();
    s.tycoon.advisors.push("penny"); // owned before stays owned
    s.crystals = 400;
    const a = hireAdvisor(s, "gus");
    expect(a?.id).toBe("gus");
    expect(s.crystals).toBe(400 - 150);
    expect(s.tycoon.advisors).toEqual(["penny", "gus"]);
    expect(hireAdvisor(s, "gus")).toBeUndefined();
    expect(hireAdvisor(s, "nobody")).toBeUndefined();
    s.crystals = 100;
    expect(hireAdvisor(s, "nova")).toBeUndefined(); // not enough crystals
    expect(s.crystals).toBe(100);
  });

  it("the vault adds hours away; booms and reviews are short boosts warps leave out", () => {
    const s = defaultSave();
    s.tycoon.coins = VAULT_COST[0];
    expect(buyVault(s)).toBe(true);
    expect(offlineHours(s, T0)).toBe(10);
    const b = BUSINESSES[0], base = basePay(s, b, T0);
    startBoom(s, T0);
    review(s, "coffee", T0);
    expect(basePay(s, b, T0 + 1000)).toBeCloseTo(base * 4);
    expect(basePay(s, b, T0 + 1000, false)).toBeCloseTo(base);
    expect(basePay(s, b, T0 + 3601e3)).toBeCloseTo(base);
  });

  it("the festival moves to another business each week", () => {
    const ids = new Set(Array.from({ length: 10 }, (_, w) => festivalBiz(T0 + w * 7 * 864e5)));
    expect(ids.size).toBe(10);
  });
});

it("the daily calendar pays more each day and the week repeats", async () => {
  const { defaultSave } = await import("../src/logic/save");
  const { claimDaily, dailyReward } = await import("../src/logic/tycoon");
  const s = defaultSave();
  expect(dailyReward(s, 1).cash).toBe(300);       // a young company gets the floor
  expect(dailyReward(s, 2).gems).toBe(10);
  expect(dailyReward(s, 8)).toEqual(dailyReward(s, 1));
  const r = claimDaily(s, 7, Date.now());
  expect(r.gems).toBe(50);
  expect(s.crystals).toBe(50);
  // Day 7's advisor is a free pick, not a random one: nobody joins until the player chooses.
  expect(r.pick).toBe(true);
  expect(s.tycoon.picks).toBe(1);
  expect(s.tycoon.advisors).toHaveLength(0);
  expect(s.tycoon.coins).toBeGreaterThanOrEqual(5000);
});

it("a free advisor pick hires the advisor the player chooses, without crystals", async () => {
  const { defaultSave } = await import("../src/logic/save");
  const { earnPick, hireAdvisor } = await import("../src/logic/tycoon");
  const { ADVISORS } = await import("../src/data/tycoon");
  const s = defaultSave();
  expect(hireAdvisor(s, ADVISORS[2].id)).toBeUndefined(); // no pick, no crystals
  expect(earnPick(s)).toBe(true);
  expect(hireAdvisor(s, ADVISORS[2].id)?.id).toBe(ADVISORS[2].id);
  expect(s.tycoon.picks).toBe(0);
  expect(s.crystals).toBe(0);
  // Never more picks than advisors left to collect.
  for (const a of ADVISORS) if (!s.tycoon.advisors.includes(a.id)) s.tycoon.advisors.push(a.id);
  expect(earnPick(s)).toBe(false);
});

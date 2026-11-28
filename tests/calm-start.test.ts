// A calm first ten minutes: extras open with the City Hall, the daily calendar waits for a calm
// moment, boosts show apart from the base rate, and the little numbers mean what they say.
import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { BUSINESSES, DAILY_REWARDS, PAY_K } from "../src/data/tycoon";
import { dailyMayOpen, FRESH_CALM_MS, GATE_HALL, gateOpen, nextGateHall } from "../src/logic/gates";
import { costOf, dailyReward, hallLevel, openPay, payOf, perSecond, rateView, startOpening, startRush, buyLevels, OPENING_MULT } from "../src/logic/tycoon";
import { cityEventEndsAt } from "../src/logic/cityevent";
import { townText } from "../src/logic/townname";
import { Backoff } from "../src/online";

const T0 = 1_800_000_000_000;

/** A save at City Hall level `hall`, past its first steps. */
function at(hall: number) {
  const s = defaultSave();
  s.chapters.done = hall - 1;
  s.tycoon.tips = 3;
  return s;
}

describe("features open one City Hall level at a time", () => {
  it("keeps the extras closed in a new game", () => {
    const s = at(1);
    expect(hallLevel(s)).toBe(1);
    for (const g of Object.keys(GATE_HALL) as (keyof typeof GATE_HALL)[]) expect(gateOpen(s, g)).toBe(false);
    expect(nextGateHall(s)).toBe(2);
  });

  it("opens daily rewards, golden customers and quests at level 2, the rest at level 3", () => {
    const s = at(2);
    expect(["daily", "golden", "quests"].every(g => gateOpen(s, g as "daily"))).toBe(true);
    expect(["event", "team", "album", "season"].some(g => gateOpen(s, g as "event"))).toBe(false);
    expect(nextGateHall(s)).toBe(3);
    const s3 = at(3);
    for (const g of Object.keys(GATE_HALL) as (keyof typeof GATE_HALL)[]) expect(gateOpen(s3, g)).toBe(true);
    expect(nextGateHall(s3)).toBeUndefined();
  });
});

describe("the daily rewards calendar waits for a calm moment", () => {
  it("never opens before City Hall level 2, during the first steps, over a card or a sheet", () => {
    expect(dailyMayOpen(at(1), { busy: false, freshSince: 0, now: T0 })).toBe(false);
    const s = at(2);
    expect(dailyMayOpen(s, { busy: false, freshSince: 0, now: T0 })).toBe(true);
    expect(dailyMayOpen(s, { busy: true, freshSince: 0, now: T0 })).toBe(false);
    s.tycoon.tips = 2;
    expect(dailyMayOpen(s, { busy: false, freshSince: 0, now: T0 })).toBe(false);
  });

  it("leaves a brand-new game alone for its first minutes", () => {
    const s = at(2);
    expect(dailyMayOpen(s, { busy: false, freshSince: T0, now: T0 + 60e3 })).toBe(false);
    expect(dailyMayOpen(s, { busy: false, freshSince: T0, now: T0 + FRESH_CALM_MS + 1 })).toBe(true);
  });
});

describe("the daily reward", () => {
  it("is a small amount on day 1 (about five minutes of base income) and grows day by day", () => {
    const s = defaultSave();
    s.tycoon.levels.coffee = 400;
    s.tycoon.managers = ["coffee"];
    const rate = perSecond(s, T0, false);
    expect(dailyReward(s, 1, T0).cash).toBe(Math.round(rate * 5 * 60));
    // (A boost on now doesn't make it bigger: it's base income.)
    startOpening(s, T0);
    expect(dailyReward(s, 1, T0).cash).toBe(Math.round(rate * 5 * 60));
    const cash = [1, 3, 5, 7].map(d => dailyReward(s, d, T0).cash);
    for (let i = 1; i < cash.length; i++) expect(cash[i]).toBeGreaterThan(cash[i - 1]);
    // Day 7 is the big one, but no more than an hour of base income.
    expect(cash[3]).toBeLessThanOrEqual(Math.round(rate * 3600) + 1);
    expect(DAILY_REWARDS[0].min).toBeLessThanOrEqual(100);
  });
});

describe("boosts", () => {
  it("shows the base rate with the boosts apart", () => {
    const s = defaultSave();
    s.tycoon.levels.coffee = 10;
    s.tycoon.managers = ["coffee"];
    const base = rateView(s, T0);
    expect(base.boost).toBeCloseTo(1);
    startOpening(s, T0);
    const boosted = rateView(s, T0 + 1000);
    expect(boosted.base).toBeCloseTo(base.base);
    expect(boosted.boost).toBeCloseTo(OPENING_MULT);
  });

  it("starts no rush hour during the grand opening", () => {
    const s = defaultSave();
    s.tycoon.levels.coffee = 5;
    expect(startOpening(s, T0)).toBe(true);
    expect(startRush(s, T0 + 60e3, () => 0)).toBe("");
    expect(startRush(s, T0 + 21 * 60e3, () => 0)).toBe("coffee");
  });

  it("promises a new business exactly what it pays once opened", () => {
    const s = defaultSave();
    s.tycoon.coins = 1e9;
    const b = BUSINESSES[1];
    const promised = openPay(s, b, T0);
    expect(promised).toBeCloseTo(b.income * PAY_K);
    expect(buyLevels(s, b.id, 1, T0)).toBe(1);
    expect(payOf(s, b, T0)).toBeCloseTo(promised);
    expect(costOf(b, 1, 1)).toBeGreaterThan(0);
  });
});

describe("the weekly event's countdown", () => {
  it("ends exactly at the start of next week (Monday 00:00), so it ticks by the minute", () => {
    const s = defaultSave();
    // Wednesday 2026-12-02, 13:37:20 UTC.
    const now = Date.UTC(2026, 11, 2, 13, 37, 20);
    const end = cityEventEndsAt(s, now)!;
    expect(end).toBe(Date.UTC(2026, 11, 7));
    expect(new Date(end).getUTCDay()).toBe(1);
    expect(cityEventEndsAt(s, now + 60e3)).toBe(end);
  });
});

describe("the town's name", () => {
  it("uses the player's name for the town once they've named it", () => {
    const s = defaultSave();
    expect(townText(s, "Skyhaven is now a Town!")).toBe("Skyhaven is now a Town!");
    s.cityName = "Rooville";
    expect(townText(s, "Skyhaven is now a Town!")).toBe("Rooville is now a Town!");
  });
});

describe("going online", () => {
  it("waits longer after each failed sign-up, up to ten minutes", () => {
    let clock = 0;
    const b = new Backoff(20e3, 10 * 60e3, () => clock);
    expect(b.ready()).toBe(true);
    b.fail();
    expect(b.ready()).toBe(false);
    clock = 20e3;
    expect(b.ready()).toBe(true);
    const waits: number[] = [];
    for (let i = 0; i < 8; i++) { b.fail(); waits.push(b.delay()); }
    expect(waits.slice(0, 4)).toEqual([40e3, 80e3, 160e3, 320e3]);
    expect(Math.max(...waits)).toBe(10 * 60e3);
    b.ok();
    expect(b.ready()).toBe(true);
  });
});

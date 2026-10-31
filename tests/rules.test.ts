import { describe, expect, it } from "vitest";
import { addXp, dayKey, floorSpeed, giftAmount, giftState, landmarkIndex, perfectWindow, runXp, windAt, xpNeeded } from "../src/logic/rules";
import type { RunSummary } from "../src/logic/types";

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: "classic", score: 0, floors: 0, meters: 0, perfects: 0, bestStreak: 0, penthouses: 0,
  windFloors: 0, afterRewind: 0, rewindsUsed: 0, ...over,
});

describe("speed and fairness", () => {
  it("starts gentle and never gets slower as you climb", () => {
    expect(floorSpeed(1)).toBeLessThan(7);
    expect(floorSpeed(15) - floorSpeed(1)).toBeLessThan(1.5);
    for (let n = 1; n < 120; n++) expect(floorSpeed(n + 1)).toBeGreaterThanOrEqual(floorSpeed(n));
    expect(floorSpeed(200)).toBe(20);
  });

  it("gives perfect drops the same slice of time at any speed", () => {
    expect(perfectWindow(5)).toBeCloseTo(0.35);
    expect(perfectWindow(20) / 20).toBeCloseTo(0.045);
  });

  it("brings in wind gradually from floor 25", () => {
    expect(windAt(24)).toBe(0);
    expect(windAt(40)).toBeCloseTo(0.5);
    expect(windAt(80)).toBe(1);
    expect(windAt(1, 1)).toBe(0);
    expect(windAt(16, 1)).toBeCloseTo(0.5);
  });

  it("only counts a landmark once you're taller than it", () => {
    expect(landmarkIndex(15)).toBe(-1);
    expect(landmarkIndex(20)).toBe(0);
    expect(landmarkIndex(900)).toBe(8);
  });
});

describe("XP and levels", () => {
  it("handles several level-ups at once and pays stars", () => {
    const r = addXp(4, 0, xpNeeded(4) + xpNeeded(5) + 10);
    expect(r.level).toBe(6);
    expect(r.xp).toBe(10);
    expect(r.stars).toBe(3 + 1); // level 5 pays 3, level 6 pays 1
  });

  it("rewards daily towers more and Zen towers less", () => {
    const base = run({ floors: 20, perfects: 10, score: 400 });
    const classic = runXp(base, false);
    expect(runXp({ ...base, mode: "daily" }, false)).toBeGreaterThan(classic);
    expect(runXp({ ...base, mode: "zen" }, false)).toBeLessThan(classic);
    expect(runXp({ ...base, xpMultiplier: 2 }, false)).toBe(classic * 2);
    expect(runXp(base, true)).toBe(classic + 50);
  });
});

describe("daily gift streak", () => {
  const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

  it("continues the streak only from yesterday", () => {
    const now = noon(2026, 10, 5);
    expect(giftState({ last: dayKey(-1, now), streak: 3 }, now)).toEqual({ ready: true, streak: 4 });
    expect(giftState({ last: dayKey(-2, now), streak: 3 }, now)).toEqual({ ready: true, streak: 1 });
    expect(giftState({ last: dayKey(0, now), streak: 3 }, now)).toEqual({ ready: false, streak: 3 });
  });

  it("steps by calendar day even across daylight-saving changes", () => {
    // Just after midnight on the day after a 25-hour day, subtracting 24 hours would land
    // on the same date. Calendar steps never do.
    for (let d = 1; d <= 61; d++) { // October and November cover the EU and US changes
      const now = new Date(2026, 9, d, 0, 30).getTime();
      expect(dayKey(-1, now)).not.toBe(dayKey(0, now));
    }
  });

  it("pays more for longer streaks and repeats weekly", () => {
    expect(giftAmount(1)).toBe(1);
    expect(giftAmount(7)).toBe(5);
    expect(giftAmount(8)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { seeded } from "../src/core/rng";
import { awardStandingTrophies, dealMissions, isSkinUnlocked, islandLevel, recordRun, swapMission } from "../src/logic/progress";
import { dayKey } from "../src/logic/rules";
import { defaultSave } from "../src/logic/save";
import type { RunSummary } from "../src/logic/types";
import { SKINS } from "../src/data/skins";

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: "classic", score: 100, floors: 5, meters: 25, perfects: 2, bestStreak: 2, penthouses: 0,
  windFloors: 0, afterRewind: 0, rewindsUsed: 0, ...over,
});
const fresh = () => { const s = defaultSave(); dealMissions(s, seeded(1)); return s; };

describe("finishing a tower", () => {
  it("records bests, stats, XP and the first trophy", () => {
    const s = fresh();
    const out = recordRun(s, run({ score: 300, meters: 60, floors: 12 }), Date.now(), seeded(2));
    expect(out.newBest).toBe(true);
    expect(s.best).toBe(300);
    expect(s.bestMeters).toBe(60);
    expect(s.profile.towers).toBe(1);
    expect(s.profile.trophies).toContain("first");
    expect(out.xp.gained).toBeGreaterThan(0);
    expect(s.stars).toBeGreaterThanOrEqual(1);
    expect(s.stars).toBe(s.starsEarned);
  });

  it("unlocks height skins and island upgrades and says so once", () => {
    const s = fresh();
    const out = recordRun(s, run({ meters: 60, floors: 12 }), Date.now(), seeded(2));
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "brick")!)).toBe(true);
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "ocean")!)).toBe(true);
    expect(islandLevel(s)).toBe(2);
    expect(out.rewards.some(r => r.text.includes("Brick Block and Ocean Breeze"))).toBe(true);
    const again = recordRun(s, run({ meters: 60, floors: 12 }), Date.now(), seeded(2));
    expect(again.rewards.some(r => r.kind === "skin")).toBe(false);
  });

  it("never unlocks shop skins without buying them", () => {
    const s = fresh();
    s.stars = 999;
    recordRun(s, run({ meters: 900, floors: 180 }), Date.now(), seeded(2));
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "aurora")!)).toBe(false);
  });

  it("completes missions and pays stars", () => {
    const s = defaultSave();
    s.missions.day = dayKey(0);
    s.missions.slots = [{ t: "towers", n: 1, r: 2, p: 0 }, { t: "height", n: 50, r: 1, p: 0 }, { t: "streak", n: 10, r: 3, p: 0 }];
    const out = recordRun(s, run({ meters: 60, bestStreak: 4 }), Date.now(), seeded(4));
    expect(out.rewards.filter(r => r.text.startsWith("Mission complete"))).toHaveLength(2);
    expect(s.missions.done).toBe(2);
    // Finished missions stay on today's list, ticked off.
    expect(s.missions.slots).toHaveLength(3);
    expect(s.missions.slots.filter(m => m.d)).toHaveLength(2);
    expect(s.missions.slots.find(m => m.t === "streak")!.p).toBe(4); // best so far
  });

  it("keeps Zen towers out of bests, missions and history", () => {
    const s = fresh();
    const before = JSON.stringify(s.missions);
    const out = recordRun(s, run({ mode: "zen", score: 5000, meters: 400, floors: 80 }), Date.now(), seeded(2));
    expect(out.newBest).toBe(false);
    expect(s.best).toBe(0);
    expect(s.bestMeters).toBe(0);
    expect(JSON.stringify(s.missions)).toBe(before);
    expect(s.history).toHaveLength(0);
    expect(s.profile.towers).toBe(1);
  });

  it("pays a challenge only the first time", () => {
    const s = fresh();
    const won = run({ mode: "challenge", challengeId: "niagara", challengeWon: true, meters: 55 });
    const first = recordRun(s, won, Date.now(), seeded(2));
    expect(first.rewards[0].text).toContain("Challenge complete: First Splash");
    expect(s.challenges).toEqual(["niagara"]);
    const second = recordRun(s, won, Date.now(), seeded(2));
    expect(second.rewards.some(r => r.text.includes("Challenge complete"))).toBe(false);
  });

  it("keeps the 10 best towers, highest first", () => {
    const s = fresh();
    for (let i = 1; i <= 14; i++) recordRun(s, run({ score: i * 10 }), Date.now(), seeded(i));
    expect(s.history).toHaveLength(10);
    expect(s.history[0].score).toBe(140);
    expect(s.history[9].score).toBe(50);
  });

  it("tracks the daily tower per day", () => {
    const s = fresh();
    const now = Date.UTC(2026, 10, 3, 12);
    recordRun(s, run({ mode: "daily", score: 300 }), now, seeded(2));
    const out = recordRun(s, run({ mode: "daily", score: 200 }), now, seeded(2));
    expect(out.dailyBest).toBe(300);
    expect(s.daily.plays).toBe(2);
    recordRun(s, run({ mode: "daily", score: 50 }), now + 864e5, seeded(2));
    expect(s.daily.best).toBe(50);
    expect(s.profile.dailyDays).toHaveLength(2);
  });

  it("points out the goal you nearly reached", () => {
    const s = fresh();
    recordRun(s, run({ score: 1000 }), Date.now(), seeded(2));
    expect(recordRun(s, run({ score: 900 }), Date.now(), seeded(2)).near).toContain("101 people away from your best");
    expect(recordRun(s, run({ score: 10, meters: 45 }), Date.now(), seeded(2)).near).toContain("short of Niagara Falls");
  });
});

describe("missions and trophies outside a tower", () => {
  it("swaps a mission once a day", () => {
    const s = fresh();
    const now = Date.now();
    expect(swapMission(s, 0, now, seeded(5))).toBe(true);
    expect(s.missions.slots).toHaveLength(3);
    expect(s.profile.swapDay).toBe(dayKey(0, now));
    expect(swapMission(s, 0, now, seeded(5))).toBe(false);
  });

  it("awards gift-streak trophies without a tower", () => {
    const s = fresh();
    s.profile.gift.streak = 7;
    expect(awardStandingTrophies(s)).toEqual(["Dedicated"]);
    expect(awardStandingTrophies(s)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { seeded } from "../src/core/rng";
import { buyBuild, claimChest, claimLeagueReward, collectRent, daysBetween, leagueFor, pendingLeagueReward, refreshMissions, rentPerHour, rentWaiting, streakView, tickStreak } from "../src/logic/daily";
import { isSkinUnlocked, recordRun } from "../src/logic/progress";
import { defaultSave, normalize } from "../src/logic/save";
import type { RunSummary } from "../src/logic/types";
import { SKINS } from "../src/data/skins";

const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime(); // November 2026, local time
const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: "classic", score: 100, floors: 5, meters: 25, perfects: 2, bestStreak: 2, penthouses: 0,
  windFloors: 0, afterRewind: 0, rewindsUsed: 0, ...over,
});

describe("play streak", () => {
  it("counts days in a row and only once per day", () => {
    const s = defaultSave();
    tickStreak(s, day(2));
    tickStreak(s, day(2, 20));
    expect(s.streak.count).toBe(1);
    tickStreak(s, day(3));
    tickStreak(s, day(4));
    expect(s.streak.count).toBe(3);
    expect(streakView(s, day(4)).doneToday).toBe(true);
    expect(streakView(s, day(5)).atRisk).toBe(true);
  });

  it("uses a freeze for one missed day, and resets after two", () => {
    const s = defaultSave();
    tickStreak(s, day(2));
    tickStreak(s, day(3));
    expect(s.streak.freezes).toBe(1); // one a week
    tickStreak(s, day(5)); // missed the 4th
    expect(s.streak.count).toBe(3);
    expect(s.streak.freezes).toBe(0);
    tickStreak(s, day(8)); // missed two days, no freeze left this week
    expect(s.streak.count).toBe(1);
    expect(streakView(s, day(11)).count).toBe(0);
  });

  it("pays milestones once and unlocks the streak skin", () => {
    const s = defaultSave();
    const ember = SKINS.find(x => x.id === "ember")!;
    for (let d = 1; d <= 7; d++) tickStreak(s, day(d));
    expect(s.streak.claimed).toEqual([3, 7]);
    expect(s.stars).toBe(7);
    expect(s.coins).toBe(350);
    expect(isSkinUnlocked(s, ember)).toBe(true);
    // Losing the streak and building it back up pays nothing again.
    tickStreak(s, day(20));
    for (let d = 21; d <= 26; d++) tickStreak(s, day(d));
    expect(s.stars).toBe(7);
  });

  it("steps across month ends and clock changes", () => {
    expect(daysBetween("2026-10-31", "2026-11-1")).toBe(1);
    expect(daysBetween("2026-3-28", "2026-3-30")).toBe(2);
  });
});

describe("daily missions", () => {
  it("deals three new missions each day and keeps finished ones ticked", () => {
    const s = defaultSave();
    expect(refreshMissions(s, day(2), seeded(1))).toBe(true);
    expect(s.missions.slots).toHaveLength(3);
    expect(refreshMissions(s, day(2, 22), seeded(1))).toBe(false);
    s.missions.slots[0].d = true;
    refreshMissions(s, day(3), seeded(2));
    expect(s.missions.slots.every(m => !m.d)).toBe(true);
  });

  it("opens the chest once all three are done", () => {
    const s = defaultSave();
    refreshMissions(s, day(2), seeded(1));
    expect(claimChest(s, day(2))).toBeNull();
    s.missions.slots.forEach(m => { m.d = true; });
    expect(claimChest(s, day(2))).toEqual({ stars: 2, coins: 150 });
    expect(claimChest(s, day(2))).toBeNull();
  });

  it("completes missions from a tower", () => {
    const s = defaultSave();
    refreshMissions(s, day(2), seeded(3));
    s.missions.slots = [{ t: "towers", n: 1, r: 1, p: 0 }, { t: "floors", n: 5, r: 1, p: 0 }, { t: "perfects", n: 2, r: 1, p: 0 }];
    const out = recordRun(s, run(), day(2), seeded(1));
    expect(s.missions.slots.every(m => m.d)).toBe(true);
    expect(out.rewards.some(r => r.text.includes("Open your chest"))).toBe(true);
  });
});

describe("rent and the city", () => {
  it("earns rent from your best tower, saved up for 12 hours", () => {
    const s = defaultSave();
    expect(rentWaiting(s, day(2))).toBe(0); // starts with the first tower
    recordRun(s, run({ score: 1000 }), day(2, 8), seeded(1));
    expect(rentPerHour(s)).toBe(40);
    expect(rentWaiting(s, day(2, 10))).toBe(80);
    expect(rentWaiting(s, day(3, 20))).toBe(480); // capped
    expect(collectRent(s, day(2, 10))).toBe(80);
    expect(s.coins).toBe(80);
    expect(rentWaiting(s, day(2, 10))).toBe(0);
  });

  it("builds city buildings with coins, each raising rent", () => {
    const s = defaultSave();
    s.best = 1000;
    s.coins = 200;
    expect(buyBuild(s, "playground")).toBe("poor");
    expect(buyBuild(s, "cafe")).toBe("ok");
    expect(buyBuild(s, "cafe")).toBe("owned");
    expect(s.coins).toBe(50);
    expect(rentPerHour(s)).toBe(46);
  });
});

describe("weekly league", () => {
  it("climbs tiers within a week and rewards last week once", () => {
    const s = defaultSave();
    const mon = Date.UTC(2026, 10, 2, 12);
    recordRun(s, run({ mode: "daily", score: 2000, floors: 30 }), mon, seeded(1));
    expect(s.league.points).toBe(430);
    expect(leagueFor(s.league.points).name).toBe("Silver");
    const nextWeek = mon + 7 * 864e5;
    expect(pendingLeagueReward(s, nextWeek)).toEqual({ league: "Silver", stars: 2 });
    expect(claimLeagueReward(s, nextWeek)).toEqual({ league: "Silver", stars: 2 });
    expect(pendingLeagueReward(s, nextWeek)).toBeNull();
    expect(s.league.points).toBe(0);
  });

  it("doesn't count Zen towers", () => {
    const s = defaultSave();
    recordRun(s, run({ mode: "zen", score: 5000 }), Date.now(), seeded(1));
    expect(s.league.points).toBe(0);
  });
});

describe("saving the new progress", () => {
  it("validates streak, coins, city and nickname", () => {
    const s = normalize({ streak: { count: 4, claimed: [3, "x"] }, coins: -3, city: ["cafe", "moon"], nickname: "<b>Erl@n</b> the great builder!!" });
    expect(s.streak.count).toBe(4);
    expect(s.streak.claimed).toEqual([3]);
    expect(s.coins).toBe(0);
    expect(s.city).toEqual(["cafe"]);
    expect(s.nickname).toBe("bErlnb the great");
  });
});

import { CHALLENGES } from "../src/data/challenges";
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
    const out = recordRun(s, run({ meters: 100, floors: 20 }), Date.now(), seeded(2));
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "brick")!)).toBe(true);
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "ocean")!)).toBe(true);
    expect(islandLevel(s)).toBe(2); // 100 m clears Niagara Falls and the Statue of Liberty
    expect(out.rewards.some(r => r.text.includes("Brick Block and Ocean Breeze"))).toBe(true);
    const again = recordRun(s, run({ meters: 100, floors: 20 }), Date.now(), seeded(2));
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
    expect(first.rewards[0].text).toContain("Stage complete: First Splash");
    expect(s.challenges).toEqual(["niagara"]);
    const second = recordRun(s, won, Date.now(), seeded(2));
    expect(second.rewards.some(r => r.text.includes("Stage complete"))).toBe(false);
  });

  it("gives Journey map stars for perfect drops, and pays only for new ones", () => {
    const s = fresh();
    const ok = run({ mode: "challenge", challengeId: "niagara", challengeWon: true, meters: 55, floors: 10, perfects: 3 });
    recordRun(s, ok, Date.now(), seeded(2));
    expect(s.journey.niagara).toBe(1);
    const starsBefore = s.stars;
    const great = run({ mode: "challenge", challengeId: "niagara", challengeWon: true, meters: 55, floors: 10, perfects: 9 });
    const out = recordRun(s, great, Date.now(), seeded(2));
    expect(s.journey.niagara).toBe(3);
    expect(out.rewards.some(r => r.text.includes("★★★"))).toBe(true);
    expect(s.stars).toBeGreaterThanOrEqual(starsBefore + 2);
    // A worse run never lowers the stars.
    recordRun(s, ok, Date.now(), seeded(2));
    expect(s.journey.niagara).toBe(3);
  });

  it("opens a chapter chest once every stage in it is won", () => {
    const s = fresh();
    const crystals = s.crystals;
    for (const c of CHALLENGES.slice(0, 10)) recordRun(s, run({ mode: "challenge", challengeId: c.id, challengeWon: true, floors: 10, perfects: 5 }), Date.now(), seeded(3));
    expect(s.journey.chest1).toBe(1);
    expect(s.crystals).toBe(crystals + 25);
    recordRun(s, run({ mode: "challenge", challengeId: CHALLENGES[3].id, challengeWon: true, floors: 10, perfects: 5 }), Date.now(), seeded(3));
    expect(s.crystals).toBe(crystals + 25);
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
    s.profile.gift.streak = 14;
    expect(awardStandingTrophies(s)).toEqual(["Dedicated"]);
    expect(awardStandingTrophies(s)).toEqual([]);
  });
});

describe("island upgrades", () => {
  it("need taller towers now, but old saves keep what they had built", async () => {
    const { normalize } = await import("../src/logic/save");
    const old = normalize({ bestMeters: 250 }); // had all six under the old heights
    expect(old.islandKept).toBe(6);
    expect(islandLevel(old)).toBe(6);
    const fresh = normalize({ bestMeters: 250, islandKept: 0 });
    expect(islandLevel(fresh)).toBe(4); // fountain, pond, neighbors, street lights
    fresh.bestMeters = 1001;
    expect(islandLevel(fresh)).toBe(12);
  });
});

import { CHAPTERS, claimChapter, migrateChapters } from "../src/data/chapters";
import { FEATURE_LEVEL } from "../src/logic/features";
import { defaultSave as freshSave } from "../src/logic/save";
describe("Mayor Pip's chapters", () => {
  it("never asks for a city building before the City opens", () => {
    for (const [i, c] of CHAPTERS.entries()) {
      if (!c.goals.some(g => g.text.includes("city building"))) continue;
      const levelGoal = CHAPTERS.slice(0, i + 1).flatMap(x => x.goals).filter(g => g.text.includes("builder level")).map(g => g.need);
      expect(Math.max(0, ...levelGoal)).toBeGreaterThanOrEqual(FEATURE_LEVEL.city);
    }
  });
  it("pays a chapter once, only when every goal is met", () => {
    const s = freshSave();
    expect(claimChapter(s)).toBeNull();
    // (The city game asks for 5 builds and 90 levels for the first City Hall level.)
    s.profile.towers = 5; s.cafe.terrace = 2; s.tycoon.levels = { coffee: 90 };
    const coins = s.tycoon.coins, crystals = s.crystals;
    // (The city game pays the chapter's stars as cash: two currencies only.)
    const r = claimChapter(s)!;
    expect(r.crystals).toBe(CHAPTERS[0].reward.crystals);
    expect(r.cash).toBeGreaterThan(0);
    expect(s.tycoon.coins).toBe(coins + r.cash);
    expect(s.crystals).toBe(crystals + CHAPTERS[0].reward.crystals);
    expect(claimChapter(s)).toBeNull();
  });
  it("follow the town ranks: each chapter ends at the next rank", async () => {
    const { RANKS } = await import("../src/data/ranks");
    // (Every rank is a chapter's business-levels goal, in order; the districts' chapters come between.)
    const at = CHAPTERS.flatMap(c => c.goals.filter(g => g.kind === "levels").map(g => g.need));
    const { HAS_CITY } = await import("../src/edition");
    // (The tower game's chapters end exactly at each rank; the city game, whose rank follows
    // the City Hall, asks for more levels each time, so a City Hall level takes a while.)
    if (!HAS_CITY) expect(at).toEqual(RANKS.slice(1).map(r => r.at));
    else {
      expect(at).toEqual([90, 280, 550, 900, 1400, 2100]);
      at.forEach((n, i) => expect(n).toBeGreaterThan(RANKS[i + 1].at));
    }
  });
  it("moves old story progress over without paying again", () => {
    const s = freshSave();
    s.chapters = { done: 3, seen: 3 };
    s.profile.towers = 5; s.cafe.terrace = 2; s.tycoon.levels = { coffee: 95 };
    const stars = s.stars;
    expect(migrateChapters(s)).toBe(true);
    expect(s.chapters.done).toBe(1);
    expect(s.stars).toBe(stars);
    expect(migrateChapters(s)).toBe(false);
  });
});

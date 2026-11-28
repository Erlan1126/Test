// The City Hall's level-up: it leads the Next card once its goals are done, its cash is
// capped at a few minutes of earnings, and claiming it twice pays once.
import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterReady, claimChapter } from "../src/data/chapters";
import { BUSINESSES } from "../src/data/tycoon";
import { HAS_CITY } from "../src/edition";
import { hallUnlocks, hallUpgradeReady, nextStepLead } from "../src/logic/levelup";
import { defaultSave } from "../src/logic/save";
import { hallLevel, LEVELUP_FLOOR, LEVELUP_MINUTES, levelUpCash, rateView, starCash } from "../src/logic/tycoon";

const T0 = 1_800_000_000_000;

/** A city at City Hall level 3 with every goal of its chapter done, and other objectives
 *  waiting too (a block project not tried yet, an HQ ready to grow). */
function ready3() {
  const s = defaultSave();
  s.chapters.done = 2; s.chapters.seen = 2;
  s.tycoon.tips = 10;
  s.cafe.starter = { b: [], s: "classic", h: "rect", floors: 1 } as unknown as typeof s.cafe.starter;
  s.cafe.terrace = 2; s.cafe.moved = true;
  // Three businesses past their HQ, enough managers, and plenty of levels.
  s.tycoon.evolved = { coffee: 1, flowers: 1, bakery: 1 };
  s.tycoon.managers = BUSINESSES.slice(0, 7).map(b => b.id);
  s.tycoon.levels = Object.fromEntries(BUSINESSES.slice(0, 6).map(b => [b.id, 120]));
  return s;
}

describe.runIf(HAS_CITY)("the City Hall's level-up", () => {
  it("leads the Next card as soon as the chapter's goals are done, ahead of other objectives", () => {
    const s = ready3();
    expect(chapterReady(s)).toBe(true);
    // (A first-time objective is still waiting: it used to come first.)
    expect(s.seenFeatures.includes("try-contract")).toBe(false);
    expect(hallUpgradeReady(s)).toBe(true);
    expect(nextStepLead(s)).toBe("hall");
  });

  it("doesn't lead before the goals are done, during the first steps, or once claimed", () => {
    const s = ready3();
    s.tycoon.levels = { coffee: 5 };
    expect(nextStepLead(s)).toBeNull();
    const t = ready3();
    t.tycoon.tips = 2;
    expect(nextStepLead(t)).toBeNull();
    const u = ready3();
    expect(claimChapter(u)).not.toBeNull();
    expect(nextStepLead(u)).toBeNull();
  });

  it("caps the cash at about 12 minutes of base earnings", () => {
    const s = ready3();
    const base = rateView(s, T0).base;
    expect(base).toBeGreaterThan(0);
    const stars = CHAPTERS[2].reward.stars;
    const cash = levelUpCash(s, stars, T0);
    expect(cash).toBeLessThan(starCash(s, stars, T0));
    expect(cash).toBeCloseTo(base * 60 * LEVELUP_MINUTES, -1);
    expect(LEVELUP_MINUTES).toBeGreaterThanOrEqual(10);
    expect(LEVELUP_MINUTES).toBeLessThanOrEqual(15);
  });

  it("pays a small level-up in full, and never less than the floor", () => {
    const s = defaultSave();
    // No managers yet: no base earnings at all.
    expect(rateView(s, T0).base).toBe(0);
    expect(levelUpCash(s, 10, T0)).toBe(Math.min(starCash(s, 10, T0), LEVELUP_FLOOR));
    expect(levelUpCash(s, 0, T0)).toBe(0);
  });

  it("pays the capped cash and every crystal once: claiming again pays nothing", () => {
    const s = ready3();
    const coins = s.tycoon.coins, crystals = s.crystals, hall = hallLevel(s);
    const r = claimChapter(s)!;
    expect(r.cash).toBeLessThanOrEqual(Math.max(LEVELUP_FLOOR, rateView(s).base * 60 * LEVELUP_MINUTES) + 1);
    expect(s.tycoon.coins).toBeCloseTo(coins + r.cash, 5);
    expect(s.crystals).toBe(crystals + CHAPTERS[2].reward.crystals);
    expect(hallLevel(s)).toBe(hall + 1);
    expect(claimChapter(s)).toBeNull();
    expect(s.crystals).toBe(crystals + CHAPTERS[2].reward.crystals);
  });

  it("lists what a level opens", () => {
    const u = hallUnlocks(3);
    expect(u.businesses.map(b => b.id).sort()).toEqual(BUSINESSES.filter(b => !b.land).filter(b => ["cinema", "hotel"].includes(b.id)).map(b => b.id).sort());
    expect(u.gates).toContain("event");
    expect(u.rank).toBeGreaterThan(0);
    expect(hallUnlocks(2).gates).toEqual(expect.arrayContaining(["daily", "golden", "quests"]));
  });
});

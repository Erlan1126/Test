import { describe, expect, it } from "vitest";
import { RANK_BONUS, RANKS } from "../src/data/ranks";
import { defaultSave } from "../src/logic/save";
import { multiplier, rankHall, townRank } from "../src/logic/tycoon";

describe("town ranks", () => {
  it("climb with the City Hall in the city game, in order", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].at).toBeGreaterThan(RANKS[i - 1].at);
    const s = defaultSave();
    expect(townRank(s)).toBe(0);
    s.tycoon.levels = { coffee: 2000 }; // business levels alone don't rank the town up
    expect(townRank(s)).toBe(0);
    s.chapters.done = 1; // City Hall level 2: a Village
    expect(townRank(s)).toBe(1);
    for (let r = 1; r < RANKS.length; r++) { s.chapters.done = rankHall(r) - 1; expect(townRank(s)).toBe(r); }
    s.chapters.done = 10;
    expect(townRank(s)).toBe(RANKS.length - 1);
  });

  it("make every business earn more", () => {
    const s = defaultSave(), now = 1e12;
    s.tycoon.opening = 0;
    s.tycoon.levels = { coffee: 1 };
    const base = multiplier(s, now);
    s.chapters.done = rankHall(3) - 1;
    expect(multiplier(s, now) / base).toBeCloseTo(1 + 3 * RANK_BONUS);
  });
});

describe("town rank after a New Era", () => {
  it("keeps the City Hall's rank: the story isn't undone", async () => {
    const { newEra } = await import("../src/logic/tycoon");
    const s = defaultSave();
    s.tycoon.levels = { coffee: 60 };
    s.chapters.done = 1;
    s.tycoon.lifetime = 1e12;
    expect(townRank(s)).toBe(1);
    expect(newEra(s)).toBeGreaterThan(0);
    expect(s.tycoon.levels).toEqual({ coffee: 1 });
    expect(townRank(s)).toBe(1);
  });
});

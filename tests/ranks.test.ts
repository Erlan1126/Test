import { describe, expect, it } from "vitest";
import { RANK_BONUS, RANKS } from "../src/data/ranks";
import { defaultSave } from "../src/logic/save";
import { multiplier, townRank } from "../src/logic/tycoon";

describe("town ranks", () => {
  it("climb with all business levels together, in order", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].at).toBeGreaterThan(RANKS[i - 1].at);
    const s = defaultSave();
    expect(townRank(s)).toBe(0);
    s.tycoon.levels = { coffee: 30, flowers: 19 };
    expect(townRank(s)).toBe(0);
    s.tycoon.levels.flowers = 20;
    expect(townRank(s)).toBe(1);
    s.tycoon.levels = { coffee: 2000 };
    expect(townRank(s)).toBe(RANKS.length - 1);
  });

  it("make every business earn more", () => {
    const s = defaultSave(), now = 1e12;
    s.tycoon.opening = 0;
    s.tycoon.levels = { coffee: 1 };
    const base = multiplier(s, now);
    s.tycoon.levels = { coffee: RANKS[3].at };
    expect(multiplier(s, now) / base).toBeCloseTo(1 + 3 * RANK_BONUS);
  });
});

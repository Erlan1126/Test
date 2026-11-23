import { describe, expect, it } from "vitest";
import { ANNEX_BONUS, RANKS, ANNEX_RANK } from "../src/data/ranks";
import { annexOpen, annexPrice, buildAnnex } from "../src/logic/annex";
import { defaultSave, normalize } from "../src/logic/save";
import { multiplier, newEra } from "../src/logic/tycoon";

describe("the island next to the town", () => {
  it("opens at Big City, costs cash once, and starts over with a New Era", () => {
    const s = defaultSave(), now = 1e12;
    s.tycoon.opening = 0;
    s.tycoon.levels = { coffee: RANKS[ANNEX_RANK].at - 1 };
    expect(annexOpen(s)).toBe(false);
    expect(buildAnnex(s, "lookout", now)).toBe("locked");
    s.tycoon.levels = { coffee: RANKS[ANNEX_RANK].at };
    const price = annexPrice(s, now);
    s.tycoon.coins = price - 1;
    expect(buildAnnex(s, "lookout", now)).toBe("short");
    const before = multiplier(s, now);
    s.tycoon.coins = price + 5;
    expect(buildAnnex(s, "lookout", now)).toBe("ok");
    expect(s.tycoon.coins).toBe(5);
    expect(multiplier(s, now) / before).toBeCloseTo(1 + ANNEX_BONUS);
    expect(buildAnnex(s, "greenhouse", now)).toBe("built");
    s.tycoon.lifetime = 1e15;
    expect(normalize(JSON.parse(JSON.stringify(s))).annex.pick).toBe("lookout");
    newEra(s, now);
    expect(s.annex.pick).toBe("");
    expect(normalize({ ...JSON.parse(JSON.stringify(s)), annex: { pick: "castle" } }).annex.pick).toBe("");
  });
});

describe("the town scrapbook", () => {
  it("keeps reached-rank dates through a save round trip and drops junk", () => {
    const s = defaultSave();
    s.scrapbook = { 0: 1700000000000, 2: 1700000500000 };
    const back = normalize({ ...JSON.parse(JSON.stringify(s)), scrapbook: { 0: 1700000000000, 2: 1700000500000, x: 5, 3: "no" } });
    expect(back.scrapbook).toEqual({ 0: 1700000000000, 2: 1700000500000 });
  });
});

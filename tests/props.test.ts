import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { multiplier } from "../src/logic/tycoon";
import { lotsAllowed, propBlock, propLevel, propPrice, propUpgrades, upgradeProp } from "../src/logic/props";
import { BUSINESSES } from "../src/data/tycoon";
import { PROP_BONUS } from "../src/data/props";

const ready = () => { const s = defaultSave(); s.tycoon.levels = { [BUSINESSES[0].id]: 5 }; s.tycoon.tips = 3; s.tycoon.opening = 0; s.chapters.done = 4; return s; };

describe("town properties", () => {
  it("start at level 1 and grow one level per upgrade, up to 5", () => {
    const s = ready(), now = 1e12;
    expect(propLevel(s, "t:2,0")).toBe(1);
    s.tycoon.coins = 1e15;
    for (let k = 2; k <= 5; k++) { expect(upgradeProp(s, "t:2,0", now)).toBe("ok"); expect(propLevel(s, "t:2,0")).toBe(k); }
    expect(upgradeProp(s, "t:2,0", now)).toBe("max");
    expect(propUpgrades(s)).toBe(4);
  });
  it("cost cash, refuse when short, and raise every business's earnings", () => {
    const s = ready(), now = 1e12, price = propPrice(s, "t:0,2", now);
    s.tycoon.coins = price - 1;
    expect(upgradeProp(s, "t:0,2", now)).toBe("short");
    const before = multiplier(s, now, false);
    s.tycoon.coins = price;
    expect(upgradeProp(s, "t:0,2", now)).toBe("ok");
    expect(s.tycoon.coins).toBe(0);
    expect(multiplier(s, now, false) / before).toBeCloseTo(1 + PROP_BONUS, 6);
    expect(propPrice(s, "t:0,2", now)).toBeGreaterThan(price);
  });
  it("city lots start empty, are built for cash, and City Hall sets how many and how tall", () => {
    const s = ready(), now = 1e12;
    s.chapters.done = 0; s.tycoon.coins = 1e15;
    expect(propLevel(s, "g:3,3")).toBe(0);
    expect(propBlock(s, "g:3,3")).toBe("");
    for (let k = 0; k < lotsAllowed(s); k++) expect(upgradeProp(s, `g:${k},9`, now)).toBe("ok");
    expect(propBlock(s, "g:3,3")).toBe("hall");
    expect(upgradeProp(s, "g:3,3", now)).toBe("locked");
    // City Hall Lv 1: built lots can grow to Apartments, no further.
    expect(upgradeProp(s, "g:0,9", now)).toBe("ok");
    expect(propLevel(s, "g:0,9")).toBe(2);
    expect(propBlock(s, "g:0,9")).toBe("hall");
    s.chapters.done = 1;
    expect(propBlock(s, "g:3,3")).toBe("");
    expect(propBlock(s, "g:0,9")).toBe("");
  });
  it("are locked before the company is up and running", () => {
    const s = defaultSave();
    s.tycoon.coins = 1e9;
    expect(upgradeProp(s, "t:2,0")).toBe("locked");
  });
  it("survive a save round trip and drop bad entries", () => {
    const s = normalize({ ...defaultSave(), props: { "t:2,0": 3, "d1:1,2": 5, "bad key!": 2, "t:0,2": 9 } } as unknown as Record<string, unknown>);
    expect(s.props).toEqual({ "t:2,0": 3, "d1:1,2": 5 });
  });
});

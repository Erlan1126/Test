import { describe, expect, it } from "vitest";
import { buyLand, landHall, landOnSale, landPrice } from "../src/logic/land";
import { LAND, LAND_BONUS } from "../src/data/land";
import { defaultSave, normalize } from "../src/logic/save";
import { multiplier, newEra } from "../src/logic/tycoon";
import { BUSINESSES } from "../src/data/tycoon";

describe("land next to the island", () => {
  it("goes on sale once the company has two businesses, one piece at a time", () => {
    const s = defaultSave();
    expect(landOnSale(s)).toBeNull();
    s.tycoon.levels = { [BUSINESSES[0].id]: 3, [BUSINESSES[1].id]: 1 };
    s.tycoon.tips = 3;
    // (In the city game a district waits for its City Hall level: the Harbor at level 5.)
    expect(landOnSale(s)).toBeNull();
    s.chapters.done = 9;
    expect(landOnSale(s)?.id).toBe(LAND[0].id);
    s.tycoon.coins = 1e12;
    expect(buyLand(s, LAND[1].id)).toBe("locked");
    expect(buyLand(s, LAND[0].id)).toBe("ok");
    expect(buyLand(s, LAND[0].id)).toBe("bought");
    expect(landOnSale(s)?.id).toBe(LAND[1].id);
  });
  it("costs cash, refuses when short, and raises every business's earnings", () => {
    const s = defaultSave();
    s.tycoon.levels = { [BUSINESSES[0].id]: 3, [BUSINESSES[1].id]: 1 };
    s.tycoon.tips = 3;
    s.chapters.done = 9;
    const l = landOnSale(s)!, price = landPrice(s, l);
    expect(price).toBeGreaterThanOrEqual(l.min);
    s.tycoon.coins = price - 1;
    expect(buyLand(s, l.id)).toBe("short");
    const before = multiplier(s, Date.now(), false);
    s.tycoon.coins = price;
    expect(buyLand(s, l.id)).toBe("ok");
    expect(s.tycoon.coins).toBe(0);
    expect(multiplier(s, Date.now(), false) / before).toBeCloseTo(1 + LAND_BONUS, 6);
    // A New Era starts the city over: the land is for sale again.
    s.tycoon.lifetime = 1e15;
    newEra(s, Date.now());
    expect(s.land).toEqual([]);
  });
  it("sells the Beach Resort after Downtown and before the sky city, keeping old saves", () => {
    expect(LAND.map(l => l.id)).toEqual(["meadow", "lakeside", "hills", "resort", "cloud", "crystal", "orbit"]);
    // (Each district keeps the number its buildings are saved under: the resort takes a new one.)
    expect(LAND.map(l => l.slot)).toEqual([0, 1, 2, 6, 3, 4, 5]);
    expect(landHall("resort")).toBeGreaterThanOrEqual(landHall("hills"));
    expect(landHall("resort")).toBeLessThanOrEqual(landHall("cloud"));
    const resort = LAND.find(l => l.id === "resort")!;
    expect(resort.y).toBe(0);
    expect(BUSINESSES.filter(b => b.land === "resort")).toHaveLength(6);
    // A save from before the resort, with the Cloud Kingdom already bought, keeps it and is
    // offered the resort next.
    const s = normalize({ ...defaultSave(), land: ["meadow", "lakeside", "hills", "cloud"] } as unknown as Record<string, unknown>);
    expect(s.land).toEqual(["meadow", "lakeside", "hills", "cloud"]);
    s.tycoon.levels = { [BUSINESSES[0].id]: 3, [BUSINESSES[1].id]: 1 };
    s.tycoon.tips = 3;
    s.chapters.done = 9;
    expect(landOnSale(s)?.id).toBe("resort");
    s.tycoon.coins = 1e15;
    expect(buyLand(s, "resort")).toBe("ok");
    expect(landOnSale(s)?.id).toBe("crystal");
  });
  it("survives a save round trip and drops unknown or repeated ids", () => {
    const s = normalize({ ...defaultSave(), land: ["meadow", "meadow", "moon", 7] } as unknown as Record<string, unknown>);
    expect(s.land).toEqual(["meadow"]);
    expect(normalize({} as Record<string, unknown>).land).toEqual([]);
  });
});

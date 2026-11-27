import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { ADVENT_DECOR, ADVENT_DECOR_CRYSTALS, ADVENT_DOORS, adventDay, adventOn, adventReady, doorOpenable, doorPrize, nextDoorIn, normalizeAdvent, openDoor } from "../src/logic/advent";
import { buyPlace, placeItem, placedBonus } from "../src/logic/placedecor";
import { spinCash } from "../src/logic/spin";

/** Noon on a day of the player's own calendar (month 1-12). */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();
const DEC5 = at(2026, 12, 5);

describe("Advent calendar", () => {
  it("has 24 doors: cash and crystals, and the gingerbread house behind the last", () => {
    for (let d = 1; d < ADVENT_DOORS; d++) {
      const p = doorPrize(d);
      expect(["cash", "crystals"]).toContain(p.kind);
      if (p.kind === "cash") expect(p.minutes).toBeGreaterThan(0);
      else expect(p.crystals).toBeGreaterThan(0);
    }
    expect(doorPrize(24).kind).toBe("decor");
    expect(placeItem(ADVENT_DECOR)?.won).toBe(true);
  });

  it("only opens doors whose date has come", () => {
    const s = defaultSave();
    expect(adventDay(DEC5)).toBe(5);
    expect(doorOpenable(s, 5, DEC5)).toBe(true);
    expect(doorOpenable(s, 6, DEC5)).toBe(false);
    expect(openDoor(s, 6, DEC5)).toBeNull();
    expect(openDoor(s, 24, DEC5)).toBeNull();
    expect(openDoor(s, 0, DEC5)).toBeNull();
    // Just before midnight it's still the 5th; just after, door 6 opens.
    expect(doorOpenable(s, 6, at(2026, 12, 5, 23))).toBe(false);
    expect(doorOpenable(s, 6, at(2026, 12, 6, 0))).toBe(true);
    expect(nextDoorIn(at(2026, 12, 5, 23))).toBe(36e5);
  });

  it("opens each door once and pays its prize", () => {
    const s = defaultSave(), coins = s.tycoon.coins, gems = s.crystals;
    const r = openDoor(s, 1, DEC5)!;
    expect(r.kind).toBe("cash");
    expect(r.cash).toBe(spinCash(defaultSave(), doorPrize(1).minutes!, DEC5));
    expect(s.tycoon.coins).toBeGreaterThan(coins);
    expect(openDoor(s, 1, DEC5)).toBeNull();
    const c = openDoor(s, 3, DEC5)!;
    expect(c.kind).toBe("crystals");
    expect(s.crystals).toBe(gems + doorPrize(3).crystals!);
    expect(s.advent).toEqual({ year: 2026, opened: [1, 3] });
  });

  it("lets missed days be caught up later in December", () => {
    const s = defaultSave();
    openDoor(s, 1, at(2026, 12, 1));
    expect(adventReady(s, at(2026, 12, 1))).toBe(0);
    // Away for a week: doors 2 to 8 all wait.
    expect(adventReady(s, at(2026, 12, 8))).toBe(7);
    expect(openDoor(s, 2, at(2026, 12, 8))).not.toBeNull();
    expect(openDoor(s, 8, at(2026, 12, 8))).not.toBeNull();
    expect(adventReady(s, at(2026, 12, 8))).toBe(5);
    // After Christmas Eve every missed door can still be opened, until the month ends.
    expect(adventReady(s, at(2026, 12, 28))).toBe(ADVENT_DOORS - 3);
    expect(openDoor(s, 20, at(2026, 12, 31))).not.toBeNull();
  });

  it("is only out in December", () => {
    const s = defaultSave();
    for (const t of [at(2026, 11, 30), at(2027, 1, 1), at(2026, 6, 15), at(2026, 1, 5)]) {
      expect(adventOn(t)).toBe(false);
      expect(adventDay(t)).toBe(0);
      expect(adventReady(s, t)).toBe(0);
      expect(openDoor(s, 1, t)).toBeNull();
    }
    expect(adventOn(at(2026, 12, 1))).toBe(true);
    expect(adventOn(at(2026, 12, 31))).toBe(true);
    expect(s.advent.opened).toEqual([]);
  });

  it("starts over each December", () => {
    const s = defaultSave();
    openDoor(s, 1, DEC5); openDoor(s, 2, DEC5);
    expect(adventReady(s, DEC5)).toBe(3);
    // In January last year's doors are just history; next December they're all shut again.
    expect(adventReady(s, at(2027, 12, 2))).toBe(2);
    expect(openDoor(s, 1, at(2027, 12, 2))).not.toBeNull();
    expect(s.advent).toEqual({ year: 2027, opened: [1] });
  });

  it("gives the gingerbread house behind door 24 once, crystals after that", () => {
    const s = defaultSave(), xmas = at(2026, 12, 24);
    expect(ADVENT_DECOR in s.placed).toBe(false);
    // It can't be bought.
    expect(buyPlace(s, ADVENT_DECOR, "g:1,1")).toBe("unknown");
    const r = openDoor(s, 24, xmas)!;
    expect(r.decor).toBe(ADVENT_DECOR);
    expect(r.crystals).toBe(0);
    expect(s.placed[ADVENT_DECOR]).toBe("");
    expect(openDoor(s, 24, xmas)).toBeNull();
    // Owned, it's placed for free and adds to earnings.
    expect(buyPlace(s, ADVENT_DECOR, "g:1,1")).toBe("ok");
    expect(placedBonus(s)).toBeCloseTo(placeItem(ADVENT_DECOR)!.bonus);
    // Next year's door 24 pays crystals instead of a second house.
    const gems = s.crystals, again = openDoor(s, 24, at(2027, 12, 24))!;
    expect(again.decor).toBe("");
    expect(again.crystals).toBe(ADVENT_DECOR_CRYSTALS);
    expect(s.crystals).toBe(gems + ADVENT_DECOR_CRYSTALS);
    expect(s.placed[ADVENT_DECOR]).toBe("g:1,1");
  });

  it("saves and loads, and cleans up a bad save", () => {
    const s = defaultSave();
    expect(s.advent).toEqual({ year: 0, opened: [] });
    openDoor(s, 4, DEC5); openDoor(s, 2, DEC5);
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.advent).toEqual({ year: 2026, opened: [2, 4] });
    // (An old save without the field.)
    const old = JSON.parse(JSON.stringify(s));
    delete old.advent;
    expect(normalize(old).advent).toEqual({ year: 0, opened: [] });
    expect(normalizeAdvent({ year: 2026, opened: [3, 3, 0, 25, 1.5, "x", 1] })).toEqual({ year: 2026, opened: [1, 3] });
    expect(normalizeAdvent({ year: "2026", opened: [1] })).toEqual({ year: 0, opened: [] });
    expect(normalizeAdvent(null)).toEqual({ year: 0, opened: [] });
  });
});

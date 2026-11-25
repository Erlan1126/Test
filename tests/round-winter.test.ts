import { describe, expect, it } from "vitest";
import { citySeason, townWeather, winterDaysLeft, winterKey } from "../src/data/season";
import { addDesigns, bookReady, claimBook, normalizeCollection, BOOK_CRYSTALS, ROW_CRYSTALS } from "../src/logic/collection";
import { checkCityTrophies, normalizeCityTrophies } from "../src/logic/cityach";
import { eventPrize, eventTheme } from "../src/logic/cityevent";
import { defaultSave as newSave } from "../src/logic/save";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("Winter Lights", () => {
  it("runs from December 1 to January 6", () => {
    expect(citySeason(at(2026, 11, 30))).toBe("");
    expect(citySeason(at(2026, 12, 1))).toBe("winter");
    expect(citySeason(at(2027, 1, 6))).toBe("winter");
    expect(citySeason(at(2027, 1, 7))).toBe("");
    expect(winterDaysLeft(at(2027, 1, 6))).toBe(1);
    expect(winterDaysLeft(at(2026, 6, 1))).toBe(0);
    // One goal a year: December and the January after share a key.
    expect(winterKey(at(2026, 12, 20))).toBe(winterKey(at(2027, 1, 3)));
  });
  it("turns the weekly event into Winter Lights with the holiday tree", () => {
    expect(eventTheme(at(2026, 12, 10)).name).toBe("Winter Lights");
    expect(eventPrize(at(2026, 12, 10)).id).toBe("bigtree");
    expect(eventPrize(at(2026, 6, 10)).id).not.toBe("bigtree");
  });
  it("snows only in winter months, the same for everyone in a two-hour slot", () => {
    for (let h = 0; h < 400; h++) expect(townWeather(at(2026, 7, 1) + h * 36e5)).not.toBe("snow");
    let snow = 0;
    for (let h = 0; h < 400; h++) if (townWeather(at(2026, 12, 1) + h * 36e5) === "snow") snow++;
    expect(snow).toBeGreaterThan(80);
    const t0 = Math.floor(at(2026, 12, 5) / 72e5) * 72e5;
    expect(townWeather(t0 + 60e3)).toBe(townWeather(t0 + 70e5));
  });
});

describe("building collection", () => {
  it("adds new designs once, and pays for a finished row and the whole book", () => {
    const s = newSave();
    expect(addDesigns(s, ["1:0", "1:0", "9:9", "bad"])).toEqual(["1:0"]);
    expect(addDesigns(s, ["1:0"])).toEqual([]);
    addDesigns(s, Array.from({ length: 10 }, (_, i) => `1:${i}`));
    expect(bookReady(s)).toEqual([1]);
    const c0 = s.crystals;
    expect(claimBook(s, 1)).toBe(ROW_CRYSTALS);
    expect(claimBook(s, 1)).toBe(0);
    expect(s.crystals).toBe(c0 + ROW_CRYSTALS);
    for (let l = 2; l <= 5; l++) addDesigns(s, Array.from({ length: 10 }, (_, i) => `${l}:${i}`));
    expect(bookReady(s)).toContain(0);
    expect(claimBook(s, 0)).toBe(BOOK_CRYSTALS);
  });
  it("cleans a stored book", () => {
    expect(normalizeCollection({ seen: ["2:3", "2:3", "7:1", 4], paid: [1, 1, 9] })).toEqual({ seen: ["2:3"], paid: [1] });
  });
});

describe("city trophies", () => {
  it("are earned once each", () => {
    const s = newSave();
    s.tycoon.tips = 1;
    s.cityName = "Maple Bay";
    const ids = checkCityTrophies(s).map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(["first_sale", "named"]));
    expect(checkCityTrophies(s)).toEqual([]);
    expect(normalizeCityTrophies(["named", "nope"])).toEqual(["named"]);
  });
});

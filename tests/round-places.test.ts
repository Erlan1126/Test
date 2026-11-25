import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { buyPlace, lotFree, movePlace, normalizePlaced, placedBonus, placedMap, placedOn, storePlace } from "../src/logic/placedecor";
import { perSecond } from "../src/logic/tycoon";
import { citySeason, seasonDaysLeft, seasonInfo, SEASONS } from "../src/data/season";
import { eventPrize, eventTheme } from "../src/logic/cityevent";
import { DECOR } from "../src/data/decor";
import { pickTalk, TALK_ANY } from "../src/data/talk";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const rich = () => { const s = defaultSave(); s.tycoon.coins = 1e12; s.chapters.done = 9; s.tycoon.levels = { coffee: 50 }; s.tycoon.managers = ["coffee"]; return s; };

describe("decorations you place", () => {
  it("are bought once, placed on an empty lot, and add to every business's earnings", () => {
    const s = rich(), base = perSecond(s, 0, false);
    expect(buyPlace(s, "fountain", "g:1,2")).toBe("ok");
    expect(placedOn(s, "g:1,2")?.id).toBe("fountain");
    expect(placedBonus(s)).toBeCloseTo(0.015);
    expect(perSecond(s, 0, false)).toBeGreaterThan(base);
    // Not on a lot that's taken (a decoration or a home).
    expect(buyPlace(s, "statue", "g:1,2")).toBe("taken");
    s.props["g:3,3"] = 2;
    expect(lotFree(s, "g:3,3")).toBe(false);
    expect(buyPlace(s, "statue", "g:3,3")).toBe("taken");
  });
  it("move, go away (no bonus) and come back free", () => {
    const s = rich();
    buyPlace(s, "pocketpark", "g:0,0");
    const coins = s.tycoon.coins;
    expect(movePlace(s, "pocketpark", "g:2,0")).toBe(true);
    expect(placedMap(s)).toEqual({ "g:2,0": "pocketpark" });
    expect(storePlace(s, "pocketpark")).toBe(true);
    expect(placedBonus(s)).toBe(0);
    expect(buyPlace(s, "pocketpark", "g:5,5")).toBe("ok");
    expect(s.tycoon.coins).toBe(coins);
  });
  it("need the cash and the City Hall level", () => {
    const s = defaultSave();
    s.tycoon.coins = 10;
    expect(buyPlace(s, "pocketpark", "g:0,0")).toBe("hall");
    s.chapters.done = 5;
    expect(buyPlace(s, "pocketpark", "g:0,0")).toBe("short");
    expect(buyPlace(s, "nope", "g:0,0")).toBe("unknown");
  });
  it("clean a stored list (unknown ids, bad or doubled lots)", () => {
    expect(normalizePlaced({ fountain: "g:1,1", statue: "g:1,1", market: "x", bogus: "g:2,2" })).toEqual({ fountain: "g:1,1", statue: "", market: "" });
  });
});

describe("city seasons", () => {
  it("each has its dates, look, event and prize", () => {
    expect(citySeason(at(2027, 4, 1))).toBe("spring");
    expect(citySeason(at(2027, 7, 15))).toBe("summer");
    expect(citySeason(at(2027, 10, 31))).toBe("halloween");
    expect(citySeason(at(2027, 12, 24))).toBe("winter");
    expect(citySeason(at(2027, 9, 15))).toBe("");
    expect(seasonDaysLeft(at(2027, 11, 2))).toBe(1);
    for (const se of SEASONS) {
      expect(DECOR.some(d => d.id === se.prize && d.seasonal)).toBe(true);
      expect(se.bulbs.length).toBeGreaterThan(2);
    }
    expect(eventTheme(at(2027, 7, 15)).name).toBe("Summer Festival");
    expect(eventPrize(at(2027, 10, 20)).id).toBe("giantpumpkin");
    expect(seasonInfo("")).toBeUndefined();
  });
});

describe("talking residents", () => {
  it("say something about the city as it is", () => {
    expect(TALK_ANY).toContain(pickTalk({ season: "", weather: "clear", placed: [] }, 0).text);
    const lines = new Set(Array.from({ length: 200 }, (_, i) => pickTalk({ season: "winter", weather: "snow", placed: ["stadium"], newest: "Pizza Place" }, i / 200).text));
    expect(lines.has("Big game at the stadium tonight!")).toBe(true);
    expect(lines.has("My boots are full of snow!")).toBe(true);
    expect(lines.has("Have you tried the new {name} yet?")).toBe(true);
  });
});

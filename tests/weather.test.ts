import { afterEach, describe, expect, it } from "vitest";
import { rainbowNow, seasonDebug, townWeather, weatherSlot } from "../src/data/season";
import { BUSINESSES } from "../src/data/tycoon";
import { defaultSave, normalize } from "../src/logic/save";
import { bizMult } from "../src/logic/tycoon";
import { claimRainbowGold, COZY, greetRainbow, rainbowGoldOn, SNOW_DAY_MULT, snowDayMult, snowDayOn, startSnowDay } from "../src/logic/weather";

const SLOT = 72e5;
// (Mid-slot times, from a spring month with showers and a winter month with snow.)
const APRIL = Date.UTC(2027, 3, 1) + SLOT / 2, JAN = Date.UTC(2027, 0, 5) + SLOT / 2;

/** The first time from `from` (stepping whole slots) where `ok` holds. */
function find(from: number, ok: (now: number) => boolean, max = 2000): number {
  for (let i = 0; i < max; i++) { const now = from + i * SLOT; if (ok(now)) return now; }
  throw new Error("not found");
}

afterEach(() => { delete seasonDebug.weather; delete seasonDebug.rainbow; delete seasonDebug.season; });

describe("rainbow after rain", () => {
  it("comes in the first clear slot right after a rain slot, and only then", () => {
    let rainbows = 0;
    for (let i = 1; i < 600; i++) {
      const now = APRIL + i * SLOT, on = rainbowNow(now);
      expect(on).toBe(townWeather(now) === "clear" && townWeather(now - SLOT) === "rain");
      if (on) {
        rainbows++;
        // (The clear slot after it has no rainbow: the rain was two slots ago.)
        if (townWeather(now + SLOT) === "clear") expect(rainbowNow(now + SLOT)).toBe(false);
      }
    }
    expect(rainbows).toBeGreaterThan(5);
  });

  it("is the same every time for the same moment, all through its slot", () => {
    const now = find(APRIL, rainbowNow);
    const start = weatherSlot(now) * SLOT;
    for (const t of [start, start + 1, start + SLOT / 3, start + SLOT - 1]) expect(rainbowNow(t)).toBe(true);
    expect(rainbowNow(now)).toBe(rainbowNow(now));
    expect(townWeather(now)).toBe("clear");
  });

  it("can be forced for testing, and other forced weather has none", () => {
    seasonDebug.weather = "rain";
    expect(rainbowNow(APRIL)).toBe(false);
    seasonDebug.weather = "clear"; seasonDebug.rainbow = true;
    expect(rainbowNow(APRIL)).toBe(true);
  });

  it("is greeted once and its pot of gold pays once per rainbow, scaled to income", () => {
    const s = defaultSave(), now = find(APRIL, rainbowNow);
    expect(greetRainbow(s, now)).toBe(true);
    expect(greetRainbow(s, now + 60e3)).toBe(false);
    expect(rainbowGoldOn(s, now)).toBe(true);
    const small = claimRainbowGold(defaultSave(), 1, now), big = claimRainbowGold(defaultSave(), 1000, now);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(100);
    expect(claimRainbowGold(s, 1000, now)).toBe(big);
    expect(claimRainbowGold(s, 1000, now + 60e3)).toBe(0);
    expect(rainbowGoldOn(s, now)).toBe(false);
    // (The claim is kept in the save.)
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(claimRainbowGold(back, 1000, now)).toBe(0);
    // The next rainbow has its own pot of gold.
    const next = find(now + 2 * SLOT, rainbowNow);
    expect(claimRainbowGold(back, 1000, next)).toBe(big);
  });

  it("pays nothing without a rainbow", () => {
    const s = defaultSave(), now = find(APRIL, t => !rainbowNow(t));
    expect(claimRainbowGold(s, 1000, now)).toBe(0);
    expect(greetRainbow(s, now)).toBe(false);
  });
});

describe("snow day", () => {
  const coffee = BUSINESSES.find(b => b.id === "coffee")!, bakery = BUSINESSES.find(b => b.id === "bakery")!, pizza = BUSINESSES.find(b => b.id === "pizza")!;

  it("starts once while it snows, and only for that slot", () => {
    const s = defaultSave(), now = find(JAN, t => townWeather(t) === "snow");
    expect(snowDayOn(s, now)).toBe(false);
    expect(startSnowDay(s, now)).toBe(true);
    expect(startSnowDay(s, now + 1000)).toBe(false);
    expect(snowDayOn(s, now)).toBe(true);
    expect(snowDayOn(s, now + 2 * SLOT)).toBe(false);
    const dry = find(JAN, t => townWeather(t) !== "snow");
    expect(startSnowDay(defaultSave(), dry)).toBe(false);
  });

  it("makes only the cozy businesses earn more", () => {
    expect(COZY).toContain("coffee");
    expect(COZY).toContain("bakery");
    for (const id of COZY) expect(BUSINESSES.some(b => b.id === id)).toBe(true);
    const now = find(JAN, t => townWeather(t) === "snow");
    const s = defaultSave();
    const before = [coffee, bakery, pizza].map(b => bizMult(s, b, now));
    startSnowDay(s, now);
    expect(snowDayMult(s, "coffee", now)).toBe(SNOW_DAY_MULT);
    expect(snowDayMult(s, "pizza", now)).toBe(1);
    const after = [coffee, bakery, pizza].map(b => bizMult(s, b, now));
    expect(after[0] / before[0]).toBeCloseTo(SNOW_DAY_MULT);
    expect(after[1] / before[1]).toBeCloseTo(SNOW_DAY_MULT);
    expect(after[2]).toBeCloseTo(before[2]);
    // Over once the snow day's slot ends.
    expect(snowDayMult(s, "coffee", now + 2 * SLOT)).toBe(1);
  });

  it("survives a save round trip, and a bad save starts with none", () => {
    const s = defaultSave(), now = find(JAN, t => townWeather(t) === "snow");
    startSnowDay(s, now);
    expect(snowDayOn(normalize(JSON.parse(JSON.stringify(s))), now)).toBe(true);
    const bad = normalize({ weather: { seen: "x", gold: -5, snowDay: 1.5 } });
    expect(bad.weather).toEqual({ seen: -1, gold: -1, snowDay: -1 });
    expect(normalize({}).weather).toEqual({ seen: -1, gold: -1, snowDay: -1 });
  });
});

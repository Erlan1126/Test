import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { ASK_GAP_MIN, askDone, collectAsk, newAsk, saveGoal, secondsTo, skipPrice, skipWait } from "../src/logic/asks";
import { BUSINESSES } from "../src/data/tycoon";

const T0 = 1_800_000_000_000;
const town = () => { const s = defaultSave(); s.tycoon.levels = { coffee: 20 }; s.tycoon.tips = 3; s.tycoon.opening = 0; s.props["g:1,1"] = 1; s.props["t:2,0"] = 2; return s; };
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe("neighbour requests", () => {
  it("come from homes that are built, at most two at a time", () => {
    const s = town(), homes = ["g:1,1", "g:5,5", "t:2,0"];
    const a = newAsk(s, homes, T0, seq(0, 0))!;
    expect(a).not.toBeNull();
    expect(["g:1,1", "t:2,0"]).toContain(a.home); // the empty lot g:5,5 never asks
    expect(newAsk(s, homes, T0, seq(0.9, 0.5))).not.toBeNull();
    expect(newAsk(s, homes, T0)).toBeNull();
    expect(s.asks.list.length).toBe(2);
  });
  it("pay crystals and cash once done, then the next one waits a while", () => {
    const s = town();
    s.asks.list.push({ home: "g:1,1", kind: "more", biz: "coffee", target: 25, from: 0, crystals: 3, at: T0 });
    expect(askDone(s, s.asks.list[0])).toBe(false);
    expect(collectAsk(s, 0, T0)).toBeNull();
    s.tycoon.levels.coffee = 25;
    const c0 = s.crystals, r = collectAsk(s, 0, T0)!;
    expect(r.crystals).toBe(3);
    expect(s.crystals).toBe(c0 + 3);
    expect(s.tycoon.coins).toBeGreaterThan(0);
    expect(s.asks.list.length).toBe(0);
    expect(newAsk(s, ["g:1,1"], T0 + 60e3)).toBeNull();
    expect(newAsk(s, ["g:1,1"], T0 + ASK_GAP_MIN * 60e3 + 1)).not.toBeNull();
  });
  it("survive a save round trip and drop bad entries", () => {
    const s = normalize({ ...defaultSave(), asks: { list: [{ home: "g:1,1", kind: "shop", biz: "pizza", target: 1, from: 0, crystals: 9, at: 5 }, { home: "x", kind: "nope" }], next: 7, done: 2 } } as unknown as Record<string, unknown>);
    expect(s.asks.list).toEqual([{ home: "g:1,1", kind: "shop", biz: "pizza", target: 1, from: 0, crystals: 9, at: 5 }]);
    expect(s.asks.done).toBe(2);
  });
});

describe("the savings goal", () => {
  it("is the next business to open, with a wait and a crystal price to skip it", () => {
    const s = town();
    s.tycoon.managers = ["coffee"];
    const g = saveGoal(s, () => Infinity, () => 0)!;
    expect(g.kind).toBe("open");
    expect(g.biz).toBe(BUSINESSES[1].id);
    const sec = secondsTo(s, g.price, T0);
    expect(sec).toBeGreaterThan(0);
    s.crystals = 1000;
    const before = s.crystals;
    expect(skipWait(s, g.price, T0)).toBe(true);
    expect(s.tycoon.coins).toBeCloseTo(g.price, 6);
    expect(before - s.crystals).toBe(skipPrice(sec));
    expect(skipWait(s, g.price, T0)).toBe(false); // nothing left to wait for
  });
});

import { cleanCityName } from "../src/logic/save";
import { BUILD_GOALS, dealGoals, goalStep } from "../src/logic/tycoon";
import { HAS_CITY } from "../src/edition";

describe("the city's name and building goals", () => {
  it("keeps a city name to one clean line of up to 18 characters", () => {
    expect(cleanCityName("  Maple   Bay ")).toBe("Maple Bay");
    expect(cleanCityName("<b>Hi</b>\n")).toBe("bHi/b");
    expect(cleanCityName("A very long city name indeed")).toBe("A very long city n");
    expect(cleanCityName(42)).toBe("");
    const s = normalize({ ...defaultSave(), cityName: "Cloudport" } as unknown as Record<string, unknown>);
    expect(s.cityName).toBe("Cloudport");
  });
  it("deals a building goal every day in the city game, and counts it", () => {
    for (let d = 0; d < 20; d++) {
      const s = defaultSave();
      dealGoals(s, T0 + d * 86400e3);
      expect(s.tycoon.goals.list.some(g => BUILD_GOALS.includes(g.t))).toBe(HAS_CITY);
    }
    const s = defaultSave();
    s.tycoon.goals = { day: "", bonus: false, list: [] };
    dealGoals(s, T0);
    s.tycoon.goals.list[0] = { t: "build", n: 1, p: 0 };
    const r = goalStep(s, "build", 1, T0);
    expect(r.done.length).toBeGreaterThanOrEqual(1); // (another "build" goal of the day may finish too)
  });
});

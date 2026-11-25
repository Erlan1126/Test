import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { CITY_GOALS, dealGoals, goalStep } from "../src/logic/tycoon";
import { openGifts, GIFT_CRYSTALS } from "../src/logic/gifts";
import { checkMilestone, PEOPLE_MILESTONES } from "../src/logic/milestones";
import { bizColors, ownsPaint, setPaint } from "../src/logic/paint";
import { buySeasonPass, claimSP, seasonPass, seasonPoints, SP_PRICE, SP_TIERS, spReady } from "../src/logic/seasonpass";
import { isRushHour, isWeekendNight, seasonDebug } from "../src/data/season";
import { pickTalk, TALK_WEEKEND } from "../src/data/talk";

const started = () => { const s = defaultSave(); s.tycoon.levels = { coffee: 20 }; s.tycoon.managers = ["coffee"]; s.chapters.done = 3; return s; };

describe("daily city quests", () => {
  it("always deal one city quest and one building goal", () => {
    for (let k = 0; k < 40; k++) {
      const s = started(); let x = k * 7919;
      dealGoals(s, Date.now(), () => ((x = (x * 16807) % 2147483647) / 2147483647));
      const kinds = s.tycoon.goals.list.map(g => g.t);
      expect(kinds).toHaveLength(3);
      expect(new Set(kinds).size).toBe(3);
      expect(kinds.some(k2 => CITY_GOALS.includes(k2))).toBe(true);
      expect(kinds.some(k2 => ["build", "home", "ask"].includes(k2))).toBe(true);
    }
  });
  it("count chats, decorations and golden customers", () => {
    const s = started();
    s.tycoon.goals = { day: s.tycoon.goals.day, bonus: false, list: [{ t: "talk", n: 2, p: 0 }, { t: "decor", n: 1, p: 0 }, { t: "golden", n: 1, p: 0 }] };
    dealGoals(s);
    s.tycoon.goals.list = [{ t: "talk", n: 2, p: 0 }, { t: "decor", n: 1, p: 0 }, { t: "golden", n: 1, p: 0 }];
    goalStep(s, "talk"); expect(goalStep(s, "talk").done).toHaveLength(1);
    expect(goalStep(s, "decor").done).toHaveLength(1);
    const last = goalStep(s, "golden");
    expect(last.pick || last.crystals > 0).toBe(true);
  });
  it("keep their kinds through a save and load", () => {
    const s = started();
    s.tycoon.goals.list = [{ t: "talk", n: 2, p: 1 }];
    s.tycoon.goals.day = "x";
    expect(normalize(JSON.parse(JSON.stringify(s))).tycoon.goals.list[0].t).toBe("talk");
  });
});

describe("gifts and milestones", () => {
  it("gifts pay cash and a crystal each", () => {
    const s = started(), c = s.crystals;
    const r = openGifts(s, 3);
    expect(r.crystals).toBe(3 * GIFT_CRYSTALS);
    expect(s.crystals).toBe(c + 3 * GIFT_CRYSTALS);
    expect(r.cash).toBeGreaterThan(0);
  });
  it("an old city starts at the marks it has passed; new marks pay once each", () => {
    const s = started();
    s.props = { "g:0,0": 5, "g:1,0": 5 }; // 640 people
    expect(checkMilestone(s)).toBeNull();
    expect(s.peopleMilestone).toBe(1);
    s.props["g:2,0"] = 5; s.props["g:3,0"] = 4; // 1100
    const c = s.crystals, m = checkMilestone(s);
    expect(m?.at).toBe(PEOPLE_MILESTONES[1].at);
    expect(s.crystals).toBe(c + PEOPLE_MILESTONES[1].crystals);
    expect(checkMilestone(s)).toBeNull();
  });
});

describe("building paint", () => {
  it("free paints, crystal paints and Season Pass paints", () => {
    const s = started();
    expect(setPaint(s, "coffee", "mint")).toBe("ok");
    expect(bizColors(s, "coffee", ["#000000", "#111111"])).toEqual(["#4fe0b0", "#1f9f7a"]);
    s.crystals = 5;
    expect(setPaint(s, "coffee", "royal")).toBe("short");
    s.crystals = 100;
    expect(setPaint(s, "coffee", "royal")).toBe("ok");
    expect(s.crystals).toBe(70);
    expect(ownsPaint(s, "royal")).toBe(true);
    expect(setPaint(s, "coffee", "gold")).toBe("locked");
    expect(setPaint(s, "coffee", "")).toBe("ok");
    expect(bizColors(s, "coffee", ["#000000", "#111111"])).toEqual(["#000000", "#111111"]);
    const back = normalize(JSON.parse(JSON.stringify({ ...s, paint: { coffee: "royal", bad: "nope" }, paints: ["royal", "zzz"] })));
    expect(back.paint).toEqual({ coffee: "royal" });
    expect(back.paints).toEqual(["royal"]);
  });
});

describe("Season Pass", () => {
  it("is only on during a season; points unlock free rewards, premium adds the season's paint", () => {
    const s = started();
    seasonDebug.season = "";
    expect(seasonPass(s)).toBeNull();
    seasonDebug.season = "winter";
    try {
      expect(seasonPass(s)?.pts).toBe(0);
      seasonPoints(s, SP_TIERS[3]);
      expect(spReady(s)).toBe(4);
      expect(claimSP(s, "prem", 0)).toBeNull();
      const c = s.crystals;
      expect(claimSP(s, "free", 1)?.crystals).toBe(5);
      expect(s.crystals).toBe(c + 5);
      expect(claimSP(s, "free", 1)).toBeNull();
      s.crystals = SP_PRICE;
      expect(buySeasonPass(s)).toBe("ok");
      expect(buySeasonPass(s)).toBe("owned");
      expect(claimSP(s, "prem", 3)?.paint).toBe("frost");
      expect(ownsPaint(s, "frost")).toBe(true);
      expect(claimSP(s, "free", 9)).toBeNull();
    } finally { seasonDebug.season = undefined; }
  });
});

describe("day and night in town", () => {
  it("knows weekend nights and weekday rush hours", () => {
    expect(isWeekendNight(new Date(2026, 10, 27, 21))).toBe(true); // Friday 9 pm
    expect(isWeekendNight(new Date(2026, 10, 25, 21))).toBe(false); // Wednesday
    expect(isWeekendNight(new Date(2026, 10, 29, 1))).toBe(true); // Sunday 1 am
    expect(isRushHour(new Date(2026, 10, 25, 8, 15))).toBe(true);
    expect(isRushHour(new Date(2026, 10, 25, 12))).toBe(false);
    expect(isRushHour(new Date(2026, 10, 28, 8, 15))).toBe(false); // Saturday
  });
  it("residents talk about the weekend show", () => {
    const line = pickTalk({ season: "", weather: "clear", placed: [], weekend: true }, 0.999);
    expect(TALK_WEEKEND).toContain(line.text);
  });
});

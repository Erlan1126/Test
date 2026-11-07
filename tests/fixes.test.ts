import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { addPassXp, carriedOver, passTier, refreshPass } from "../src/logic/pass";
import { claimChest, lateChest, pendingLeagueReward, refreshMissions, rollLeague } from "../src/logic/daily";
import { eventFor, weekIndex } from "../src/data/events";
import { XP_PER_TIER } from "../src/data/pass";

const DAY = 864e5;

describe("rewards are never lost at rollover", () => {
  it("unclaimed Sky Pass tiers are given out when a new season starts", () => {
    const save = defaultSave(), nov = Date.UTC(2026, 10, 20), dec = Date.UTC(2026, 11, 2);
    refreshPass(save, nov);
    addPassXp(save, XP_PER_TIER * 3, nov);
    expect(passTier(save)).toBe(3);
    const coins = save.coins, stars = save.stars;
    carriedOver.length = 0;
    expect(refreshPass(save, dec)).toBe(true);
    expect(carriedOver.length).toBe(3);
    expect(save.coins + save.stars).toBeGreaterThan(coins + stars);
    expect(passTier(save)).toBe(0);
  });

  it("a finished chest that wasn't opened opens itself the next day", () => {
    const save = defaultSave(), day1 = Date.UTC(2026, 10, 5, 12), day2 = day1 + DAY;
    refreshMissions(save, day1, () => 0.3);
    save.missions.slots.forEach(m => { m.d = true; m.p = m.n; });
    const stars = save.stars;
    lateChest.opened = false;
    refreshMissions(save, day2, () => 0.3);
    expect(lateChest.opened).toBe(true);
    expect(save.stars).toBeGreaterThan(stars);
    // And never twice: today's chest is a new one.
    expect(claimChest(save, day2)).toBeNull();
  });

  it("launch week (week 0) league points still pay out", () => {
    const save = defaultSave();
    let t = 0;
    while (weekIndex(t) < 0) t += DAY;
    while (weekIndex(t) > 0) t -= DAY;
    rollLeague(save, t);
    expect(save.league.week).toBe(0);
    save.league.points = 5000;
    expect(pendingLeagueReward(save, t + 7 * DAY)).not.toBeNull();
  });

  it("no wind missions in a week without wind", () => {
    let t = Date.UTC(2026, 10, 1);
    while (!eventFor(t).noWind) t += DAY;
    for (let i = 0; i < 30; i++) {
      const save = defaultSave();
      let r = i / 30;
      refreshMissions(save, t, () => (r = (r * 7.31 + 0.17) % 1));
      expect(save.missions.slots.map(m => m.t)).not.toContain("wind");
    }
  });
});

import { addToSkyline } from "../src/logic/skyline";
import { normalize } from "../src/logic/save";

describe("skyline island", () => {
  it("keeps your nine tallest towers and survives a save round trip", () => {
    const save = defaultSave();
    expect(addToSkyline(save, { f: 5, s: "glass", h: "square" })).toBe(false); // too short
    for (let f = 10; f < 22; f++) addToSkyline(save, { f, s: "glass", h: "round" });
    expect(save.skyline.length).toBe(9);
    expect(save.skyline[8].f).toBe(13);
    expect(addToSkyline(save, { f: 12, s: "glass", h: "round" })).toBe(false);
    expect(addToSkyline(save, { f: 40, s: "neon", h: "twist" })).toBe(true);
    const back = normalize(JSON.parse(JSON.stringify(save)));
    expect(back.skyline[0]).toEqual({ f: 40, s: "neon", h: "twist" });
    expect(normalize({ skyline: [{ f: 9, s: "nope", h: "blob" }] }).skyline[0]).toEqual({ f: 9, s: "glass", h: "square" });
  });
});

import { ALBUM_CRYSTALS, ALL_POSTCARDS, collectPostcard, POSTCARD_COUNT } from "../src/logic/postcards";

describe("postcard album", () => {
  it("pays once per card, a bonus per set, and crystals for the full album", () => {
    const save = defaultSave();
    expect(collectPostcard(save, 0, "clear").fresh).toBe(false); // the house has no postcard
    expect(collectPostcard(save, 1, "clear")).toEqual({ fresh: true, set: false, album: false });
    expect(collectPostcard(save, 1, "clear").fresh).toBe(false);
    collectPostcard(save, 1, "rain");
    expect(collectPostcard(save, 1, "snow").set).toBe(true);
    for (const id of ALL_POSTCARDS) { const [i, w] = id.split(":"); collectPostcard(save, Number(i), w as "clear"); }
    expect(save.postcards.length).toBe(POSTCARD_COUNT);
    expect(save.crystals).toBe(ALBUM_CRYSTALS);
  });
});

import { buyDeal, dealsFor } from "../src/logic/deals";

describe("daily deals", () => {
  it("offers three discounted things you don't own, each bought once a day", () => {
    const save = defaultSave();
    save.stars = 500; save.crystals = 1000;
    const deals = dealsFor(save, 40);
    expect(deals.length).toBe(3);
    for (const d of deals) expect(d.price).toBeLessThan(d.was);
    expect(buyDeal(save, 40, deals[0])).toBe("ok");
    expect(buyDeal(save, 40, deals[0])).toBe("bought");
    expect(dealsFor(save, 40)).toEqual(dealsFor(save, 40));
    const poor = defaultSave();
    expect(buyDeal(poor, 40, dealsFor(poor, 40)[0])).toBe("short");
  });
});

import { holidayAt, holidayKey, HOLIDAYS } from "../src/data/holidays";
import { holidayTower } from "../src/logic/holidays";

describe("holiday events", () => {
  it("finds the event on now, including one that wraps over New Year", () => {
    expect(holidayAt(new Date(2026, 9, 31).getTime())?.id).toBe("halloween");
    expect(holidayAt(new Date(2027, 0, 3).getTime())?.id).toBe("winter");
    expect(holidayKey(HOLIDAYS[1], new Date(2027, 0, 3).getTime())).toBe("winter-2026");
    expect(holidayAt(new Date(2026, 10, 7).getTime())).toBeNull();
  });
  it("gives the holiday skin after enough towers, once", () => {
    const save = defaultSave(), now = new Date(2026, 11, 20).getTime();
    for (let i = 0; i < 9; i++) expect(holidayTower(save, now)).toBeNull();
    expect(holidayTower(save, now)?.skin).toBe("frost");
    expect(save.ownedSkins).toContain("frost");
    expect(holidayTower(save, now)).toBeNull();
  });
});

import { claimVip, setVip, vipActive } from "../src/logic/vip";
import { buyWithCrystals } from "../src/logic/premium";

describe("VIP and themed bundles", () => {
  it("VIP gives a daily gift once a day only while on", () => {
    const save = defaultSave(), now = Date.UTC(2026, 10, 10);
    expect(claimVip(save, 10, now)).toBe(false);
    setVip(save, true, now);
    expect(vipActive(save, now)).toBe(true);
    expect(claimVip(save, 10, now)).toBe(true);
    expect(save.crystals).toBe(50);
    expect(claimVip(save, 10, now)).toBe(false);
    expect(vipActive(save, now + 4 * 864e5)).toBe(false); // the store hasn't confirmed it in days
    setVip(save, false, now);
    expect(claimVip(save, 11, now)).toBe(false);
  });
  it("a themed bundle gives its shapes too", () => {
    const save = defaultSave();
    save.crystals = 600;
    expect(buyWithCrystals(save, "set_tokyo")).toBe("ok");
    expect(save.ownedShapes).toEqual(expect.arrayContaining(["spiral", "twist"]));
  });
});

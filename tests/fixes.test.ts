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

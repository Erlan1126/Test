import { describe, expect, it } from "vitest";
import { isNew, isOpen, markSeen, openedBetween } from "../src/logic/features";
import { isSkinUnlocked } from "../src/logic/progress";
import { defaultSave, normalize, migrateLegacy } from "../src/logic/save";
import { buyBoost, buySkin, takeBoosts } from "../src/logic/shop";
import { SKINS } from "../src/data/skins";
import { MAX_BOOSTS } from "../src/data/shop";

describe("star shop", () => {
  it("sells shop skins once and takes the stars", () => {
    const s = defaultSave();
    s.stars = 32;
    expect(buySkin(s, "starlight")).toBe("ok");
    expect(s.stars).toBe(2);
    expect(isSkinUnlocked(s, SKINS.find(x => x.id === "starlight")!)).toBe(true);
    expect(buySkin(s, "starlight")).toBe("owned");
    expect(buySkin(s, "rainbow")).toBe("poor");
    expect(s.stars).toBe(2);
  });

  it("won't sell skins that are earned by height", () => {
    const s = defaultSave();
    s.stars = 999;
    expect(buySkin(s, "brick")).toBe("unknown");
    expect(buySkin(s, "nope")).toBe("unknown");
  });

  it("caps boosts and uses one of each per tower", () => {
    const s = defaultSave();
    s.stars = 100;
    for (let i = 0; i < MAX_BOOSTS; i++) expect(buyBoost(s, "xp")).toBe("ok");
    expect(buyBoost(s, "xp")).toBe("full");
    expect(buyBoost(s, "gold")).toBe("ok");
    expect(takeBoosts(s)).toEqual({ rewind: false, xp: true, gold: true });
    expect(s.boosts).toEqual({ rewind: 0, xp: MAX_BOOSTS - 1, gold: 0 });
  });

  it("keeps old star totals spendable and the skins they had unlocked", () => {
    const store: Record<string, string> = { skyriseMissions: JSON.stringify({ stars: 30, done: 9, slots: [] }), skyriseBest: "500" };
    const s = migrateLegacy(k => store[k] ?? null)!;
    expect(s.stars).toBe(30);
    expect(s.ownedSkins.sort()).toEqual(["rainbow", "starlight"]);
    expect(s.best).toBe(500);
  });
});

describe("unlocking features gradually", () => {
  it("opens features by builder level", () => {
    const s = defaultSave();
    expect(isOpen(s, "missions")).toBe(false);
    expect(isOpen(s, "shop")).toBe(false);
    s.profile.level = 3;
    expect(isOpen(s, "shop")).toBe(true);
    expect(isOpen(s, "pass")).toBe(false);
    s.profile.level = 9;
    expect(isOpen(s, "ranks")).toBe(true);
  });

  it("badges new features until they're opened", () => {
    const s = defaultSave();
    s.profile.level = 3;
    expect(isNew(s, "shop")).toBe(true);
    markSeen(s, "shop");
    expect(isNew(s, "shop")).toBe(false);
    expect(isNew(s, "zen")).toBe(false); // not open yet
  });

  it("lists what a level just opened, a little at a time", () => {
    expect(openedBetween(1, 2)).toEqual(["missions"]);
    expect(openedBetween(3, 4)).toEqual(["daily"]);
    for (let n = 3; n < 12; n++) expect(openedBetween(n, n + 1).length).toBeLessThanOrEqual(1);
  });

  it("keeps features a player had from before levels", () => {
    const s = normalize({ v: 2, unlocksV: 2, profile: { towers: 12, level: 2 } });
    expect(isOpen(s, "pass")).toBe(true);
    expect(isOpen(s, "zen")).toBe(false);
  });
});

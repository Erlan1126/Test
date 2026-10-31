import { describe, expect, it } from "vitest";
import { isNew, isOpen, markSeen, openedBetween } from "../src/logic/features";
import { isSkinUnlocked } from "../src/logic/progress";
import { defaultSave, migrateLegacy } from "../src/logic/save";
import { buyBoost, buySkin, takeBoosts } from "../src/logic/shop";
import { SKINS } from "../src/data/skins";
import { MAX_BOOSTS } from "../src/data/shop";

describe("star shop", () => {
  it("sells shop skins once and takes the stars", () => {
    const s = defaultSave();
    s.stars = 12;
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
  it("starts with nothing but the play button", () => {
    const s = defaultSave();
    expect(isOpen(s, "skins")).toBe(false);
    expect(isOpen(s, "shop")).toBe(false);
    s.profile.towers = 1;
    expect(isOpen(s, "skins")).toBe(true);
    expect(isOpen(s, "zen")).toBe(false);
  });

  it("badges new features until they're opened", () => {
    const s = defaultSave();
    s.profile.towers = 3;
    expect(isNew(s, "shop")).toBe(true);
    markSeen(s, "shop");
    expect(isNew(s, "shop")).toBe(false);
    expect(isNew(s, "zen")).toBe(false); // not open yet
  });

  it("lists what a tower just opened", () => {
    expect(openedBetween(0, 1).sort()).toEqual(["missions", "profile", "skins"]);
    expect(openedBetween(2, 3).sort()).toEqual(["challenges", "shop"]);
    expect(openedBetween(5, 6)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buyWithCrystals, grantPack, grantPurchase, itemPrice, newPlayerId, ownsProduct, premiumGrants } from "../src/logic/premium";
import { currentTheme, isSkinUnlocked, themeUnlocked } from "../src/logic/progress";
import { defaultSave, exportCode, importCode, normalize } from "../src/logic/save";
import { SKINS } from "../src/data/skins";
import { ISLAND_THEMES } from "../src/data/islands";
import { CRYSTAL_PACKS, PASS_PRICE, PRODUCTS } from "../src/data/premium";
import { addPassXp, buyPremiumPass, claimAll, claimTier, passTier, refreshPass, unclaimed } from "../src/logic/pass";
import { freeReward, PASS_TIERS, premiumReward, SEASON_THEMES, XP_PER_TIER } from "../src/data/pass";

const skin = (id: string) => SKINS.find(s => s.id === id)!;
const theme = (id: string) => ISLAND_THEMES.find(t => t.id === id)!;

describe("premium purchases", () => {
  it("keeps premium skins and islands locked until bought", () => {
    const s = defaultSave();
    s.stars = 9999;
    s.profile.level = 99;
    s.bestMeters = 9999;
    expect(isSkinUnlocked(s, skin("crystal"))).toBe(false);
    expect(themeUnlocked(s, theme("volcano"))).toBe(false);
    s.island = "volcano";
    expect(currentTheme(s).id).toBe("meadow"); // falls back while locked
  });

  it("unlocks what a product grants", () => {
    const s = defaultSave();
    grantPurchase(s, "skin_cyber");
    expect(isSkinUnlocked(s, skin("cyber"))).toBe(true);
    expect(isSkinUnlocked(s, skin("crystal"))).toBe(false);
    grantPurchase(s, "island_candy");
    expect(themeUnlocked(s, theme("candy"))).toBe(true);
  });

  it("pays the bundle's stars once and counts its items as owned", () => {
    const s = defaultSave();
    grantPurchase(s, "founders");
    grantPurchase(s, "founders");
    expect(s.stars).toBe(50);
    expect(ownsProduct(s, "skin_royal")).toBe(true);
    expect(ownsProduct(s, "island_volcano")).toBe(true);
    const g = premiumGrants(s);
    expect([...g.skins].sort()).toEqual(["crystal", "cyber", "royal", "sakura"]);
  });

  it("buys items with crystals, never twice and never on credit", () => {
    const s = defaultSave();
    expect(buyWithCrystals(s, "skin_cyber")).toBe("short");
    s.crystals = 350;
    expect(buyWithCrystals(s, "skin_cyber")).toBe("ok");
    expect(s.crystals).toBe(50);
    expect(isSkinUnlocked(s, skin("cyber"))).toBe(true);
    expect(buyWithCrystals(s, "skin_cyber")).toBe("owned");
    expect(s.crystals).toBe(50);
  });

  it("makes the bundle cheaper by what you already own", () => {
    const s = defaultSave();
    const full = itemPrice(s, "founders");
    grantPurchase(s, "skin_crystal");
    expect(itemPrice(s, "founders")).toBe(full - 200);
  });

  it("adds each pack purchase exactly once", () => {
    const s = defaultSave();
    expect(grantPack(s, "crystals_650", "android:abc")).toBe(650);
    expect(grantPack(s, "crystals_650", "android:abc")).toBe(0); // the store resent it
    expect(grantPack(s, "crystals_200", "android:def")).toBe(200);
    expect(grantPack(s, "free_crystals", "x")).toBe(0);
    expect(s.crystals).toBe(850);
  });

  it("keeps purchases and the player id through saves and save codes", () => {
    const s = defaultSave();
    s.playerId = newPlayerId();
    grantPurchase(s, "skin_royal");
    const back = importCode(exportCode(s))!;
    expect(back.purchases).toEqual(["skin_royal"]);
    expect(back.playerId).toBe(s.playerId);
    expect(normalize({ purchases: ["skin_royal", "free_stuff"], playerId: "<script>" }).purchases).toEqual(["skin_royal"]);
    expect(normalize({ playerId: "<script>" }).playerId).toBe("");
  });

  it("prices every product and grants something real", () => {
    for (const p of PRODUCTS) {
      expect(p.crystals).toBeGreaterThan(0);
      for (const id of p.grants.skins ?? []) expect(SKINS.some(x => x.id === id)).toBe(true);
      for (const id of p.grants.themes ?? []) expect(ISLAND_THEMES.some(x => x.id === id)).toBe(true);
    }
  });
  it("sells packs with bigger bonuses for bigger packs", () => {
    let last = 0;
    for (const p of CRYSTAL_PACKS) {
      const perDollar = p.crystals / p.cents;
      expect(perDollar).toBeGreaterThanOrEqual(last);
      last = perDollar;
    }
    // The $5.99 pack covers the Sky Pass.
    expect(CRYSTAL_PACKS.find(p => p.cents === 599)!.crystals).toBeGreaterThanOrEqual(PASS_PRICE);
  });
});

describe("Sky Pass", () => {
  const NOV = Date.UTC(2026, 10, 10), DEC = Date.UTC(2026, 11, 2);

  it("earns tiers with pass XP and resets each month", () => {
    const s = defaultSave();
    expect(addPassXp(s, XP_PER_TIER * 3 + 10, NOV)).toBe(3);
    expect(passTier(s)).toBe(3);
    addPassXp(s, 1e9, NOV);
    expect(passTier(s)).toBe(PASS_TIERS);
    expect(refreshPass(s, DEC)).toBe(true);
    expect(passTier(s)).toBe(0);
    expect(s.pass.premium).toBe(false);
  });

  it("claims free rewards for everyone and premium ones only with the pass", () => {
    const s = defaultSave();
    addPassXp(s, XP_PER_TIER * 5, NOV);
    expect(claimTier(s, "prem", 1)).toBeNull();
    expect(claimTier(s, "free", 6)).toBeNull(); // not reached yet
    expect(claimTier(s, "free", 5)).toEqual({ crystals: 10 });
    expect(claimTier(s, "free", 5)).toBeNull(); // once only
    expect(buyPremiumPass(s, NOV)).toBe("short");
    s.crystals = PASS_PRICE;
    expect(buyPremiumPass(s, NOV)).toBe("ok");
    expect(s.crystals).toBe(0);
    const got = claimAll(s);
    expect(got.length).toBe(4 + 5);
    expect(unclaimed(s)).toBe(0);
    // Premium tier 1 is the season's first skin.
    expect(s.ownedSkins).toContain(SEASON_THEMES[0].skins.first);
    expect(isSkinUnlocked(s, skin(SEASON_THEMES[0].skins.first))).toBe(true);
  });

  it("gives every season's skins as real skins", () => {
    for (let season = 0; season < SEASON_THEMES.length; season++) {
      for (let t = 1; t <= PASS_TIERS; t++) {
        for (const r of [freeReward(season, t), premiumReward(season, t)]) {
          if (r.skin) expect(SKINS.some(x => x.id === r.skin)).toBe(true);
          expect(Object.keys(r).length).toBe(1);
        }
      }
    }
  });
});

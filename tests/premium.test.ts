import { describe, expect, it } from "vitest";
import { grantPurchase, newPlayerId, ownsProduct, premiumGrants, syncPurchases } from "../src/logic/premium";
import { currentTheme, isSkinUnlocked, themeUnlocked } from "../src/logic/progress";
import { defaultSave, exportCode, importCode, normalize } from "../src/logic/save";
import { SKINS } from "../src/data/skins";
import { ISLAND_THEMES } from "../src/data/islands";
import { PRODUCTS } from "../src/data/premium";

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

  it("pays the bundle's coins once and counts its items as owned", () => {
    const s = defaultSave();
    grantPurchase(s, "founders");
    grantPurchase(s, "founders");
    expect(s.coins).toBe(5000);
    expect(ownsProduct(s, "skin_royal")).toBe(true);
    expect(ownsProduct(s, "island_volcano")).toBe(true);
    const g = premiumGrants(s);
    expect([...g.skins].sort()).toEqual(["crystal", "cyber", "royal", "sakura"]);
  });

  it("trusts the payment server over the save", () => {
    const s = defaultSave();
    s.purchases = ["skin_crystal", "skin_sakura"]; // e.g. typed into a save code
    const added = syncPurchases(s, ["skin_sakura", "island_volcano", "not_a_product"]);
    expect(added).toEqual(["island_volcano"]);
    expect(s.purchases.sort()).toEqual(["island_volcano", "skin_sakura"]);
    expect(isSkinUnlocked(s, skin("crystal"))).toBe(false);
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
      expect(p.cents).toBeGreaterThan(0);
      for (const id of p.grants.skins ?? []) expect(SKINS.some(x => x.id === id)).toBe(true);
      for (const id of p.grants.themes ?? []) expect(ISLAND_THEMES.some(x => x.id === id)).toBe(true);
    }
  });
});

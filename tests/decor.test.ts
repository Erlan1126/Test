import { describe, expect, it } from "vitest";
import { DECOR, DECOR_BONUS, UPGRADES_CASH } from "../src/data/decor";
import { buyDecor, decorMult, normalizeDecor } from "../src/logic/decor";
import { defaultSave, normalize } from "../src/logic/save";

describe("island upgrades (cash)", () => {
  it("cost the company's cash, once each, and count like decorations", () => {
    const s = defaultSave();
    const u = UPGRADES_CASH[0];
    s.tycoon.coins = u.cash! - 1;
    expect(buyDecor(s, u.id)).toBe("short");
    s.tycoon.coins = u.cash! + 10;
    const gems = s.crystals;
    expect(buyDecor(s, u.id)).toBe("ok");
    expect(s.tycoon.coins).toBe(10);
    expect(s.crystals).toBe(gems);
    expect(buyDecor(s, u.id)).toBe("owned");
    expect(decorMult(s)).toBeCloseTo(1 + DECOR_BONUS);
    expect(normalizeDecor([u.id])).toEqual([u.id]);
  });
});

describe("island decorations", () => {
  it("costs crystals, once each", () => {
    const s = defaultSave();
    const d = DECOR[0], price = d.crystals!;
    s.crystals = price - 1;
    expect(buyDecor(s, d.id)).toBe("short");
    expect(s.decor).toEqual([]);
    s.crystals = price + 5;
    expect(buyDecor(s, d.id)).toBe("ok");
    expect(s.crystals).toBe(5);
    expect(buyDecor(s, d.id)).toBe("owned");
    expect(s.crystals).toBe(5);
    expect(buyDecor(s, "nope")).toBe("unknown");
  });

  it("each one adds to every business's earnings", () => {
    const s = defaultSave();
    expect(decorMult(s)).toBe(1);
    s.decor = [DECOR[0].id, DECOR[1].id];
    expect(decorMult(s)).toBeCloseTo(1 + 2 * DECOR_BONUS);
  });

  it("survives saving, and bad data is dropped", () => {
    expect(normalizeDecor(["yacht", "yacht", "bogus", 4])).toEqual(["yacht"]);
    expect(normalizeDecor("x")).toEqual([]);
    const s = defaultSave();
    s.decor = ["wheel", "statue"];
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.decor.sort()).toEqual(["statue", "wheel"]);
    expect(normalize({}).decor).toEqual([]);
  });
});

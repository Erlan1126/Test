import { describe, expect, it } from "vitest";
import { DECOR, DECOR_BONUS } from "../src/data/decor";
import { buyDecor, decorMult, normalizeDecor } from "../src/logic/decor";
import { defaultSave, normalize } from "../src/logic/save";

describe("island decorations", () => {
  it("costs crystals, once each", () => {
    const s = defaultSave();
    const d = DECOR[0];
    s.crystals = d.crystals - 1;
    expect(buyDecor(s, d.id)).toBe("short");
    expect(s.decor).toEqual([]);
    s.crystals = d.crystals + 5;
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

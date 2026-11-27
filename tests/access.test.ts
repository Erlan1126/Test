// Accessibility: the colorblind-friendly special floors really are easier to tell apart
// with the common kinds of colour blindness, and the switch reaches the floors' colors.
import { describe, expect, it } from "vitest";
import { COLORBLIND_COLORS, setColorblind, SPECIAL_COLORS, skinById } from "../src/data/skins";
import { floorColor } from "../src/render/buildings";
import { defaultSave, normalize } from "../src/logic/save";

// Machado et al. (2009) simulation matrices at full severity, applied to linear RGB.
const SIM = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
const seen = (hex: string, m: number[][]) => { const c = rgb(hex); return m.map(r => Math.cbrt(Math.max(0, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))); };
const closest = (colors: Record<string, string>, m: number[][]) => {
  const list = Object.values(colors).map(h => seen(h, m));
  let min = Infinity;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) min = Math.min(min, Math.hypot(...list[i].map((v, k) => v - list[j][k])));
  return min;
};

describe("colorblind-friendly colors", () => {
  it("keep every special floor apart with each kind of colour blindness", () => {
    setColorblind(false);
    const normal = { ...SPECIAL_COLORS };
    for (const [kind, m] of Object.entries(SIM)) expect(closest(COLORBLIND_COLORS, m), kind).toBeGreaterThan(0.2);
    // Red-green colour blindness (by far the most common) gets a lot better.
    for (const m of [SIM.protan, SIM.deutan]) expect(closest(COLORBLIND_COLORS, m)).toBeGreaterThan(closest(normal, m) * 2);
  });

  it("switch the floors' colors and back", () => {
    const skin = skinById("glass");
    const before = floorColor(skin, 3, "shrink");
    setColorblind(true);
    expect(floorColor(skin, 3, "shrink")).not.toEqual(before);
    setColorblind(false);
    expect(floorColor(skin, 3, "shrink")).toEqual(before);
  });

  it("are off by default and kept in the save", () => {
    const s = defaultSave();
    expect([s.settings.colorblind, s.settings.bigText, s.settings.oneHand]).toEqual([false, false, false]);
    s.settings.oneHand = true;
    expect(normalize(JSON.parse(JSON.stringify(s))).settings.oneHand).toBe(true);
  });
});

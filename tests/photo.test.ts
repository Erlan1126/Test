import { describe, expect, it } from "vitest";
import { applyMatrix, claimPhotoDay, cssFilter, filterMatrix, PHOTO_FILTERS, photoCaption, photoFileName, photoFilter, photoUnlocked } from "../src/ui/photo";

describe("photo mode", () => {
  it("offers a few filters, Normal first and untouched", () => {
    expect(PHOTO_FILTERS.map(f => f.id)).toEqual(["normal", "warm", "vintage", "night"]);
    const normal = photoFilter("normal");
    expect(cssFilter(normal)).toBe("none");
    expect(filterMatrix(normal)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(photoFilter("nope").id).toBe("normal");
    for (const f of PHOTO_FILTERS) expect(f.label().length).toBeGreaterThan(0);
  });

  it("writes the CSS preview in order", () => {
    expect(cssFilter(photoFilter("night"))).toBe("brightness(0.8) contrast(1.2) saturate(1.5) hue-rotate(-12deg)");
  });

  it("bakes the same filter into the picture's pixels", () => {
    const px = new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 128]);
    applyMatrix(px, filterMatrix(photoFilter("normal")));
    expect([...px]).toEqual([200, 100, 50, 255, 10, 20, 30, 128]);
    // Brightness then contrast compose like CSS: contrast(brightness(x)).
    const m = filterMatrix({ id: "warm", icon: "", label: () => "", ops: [{ fn: "brightness", v: 0.5 }, { fn: "contrast", v: 2 }] });
    const one = new Uint8ClampedArray([255, 128, 0, 255]);
    applyMatrix(one, m);
    expect([...one]).toEqual([128, 0, 0, 255]); // x - 127.5, rounded half to even
    // Warm pushes toward red/yellow and away from blue; alpha untouched.
    const grey = new Uint8ClampedArray([128, 128, 128, 77]);
    applyMatrix(grey, filterMatrix(photoFilter("warm")));
    expect(grey[0]).toBeGreaterThan(grey[2]);
    expect(grey[3]).toBe(77);
  });

  it("puts the city's name and the game's on the frame", () => {
    expect(photoCaption("Sunny Bay", "26 Nov 2026")).toEqual({ title: "Sunny Bay", sub: "Built in Buildaroo · 26 Nov 2026" });
    expect(photoCaption("  ", "")).toEqual({ title: "Buildaroo", sub: "Built in Buildaroo" });
    expect(photoCaption("A".repeat(40), "x").title).toHaveLength(28);
    expect(photoCaption("Bahía", "x", "Construida en Buildaroo").sub).toBe("Construida en Buildaroo · x");
  });

  it("names the file after the city and the day", () => {
    const at = new Date(2026, 10, 26, 12).getTime();
    expect(photoFileName("Sunny Bay!", at)).toBe("buildaroo-sunny-bay-2026-11-26.png");
    expect(photoFileName("Bahía Ñandú", at)).toBe("buildaroo-bahia-nandu-2026-11-26.png");
    expect(photoFileName("", at)).toBe("buildaroo-2026-11-26.png");
  });

  it("unlocks after the first chapter and rewards one photo a day", () => {
    expect(photoUnlocked({ chapters: { done: 0 } })).toBe(false);
    expect(photoUnlocked({ chapters: { done: 1 } })).toBe(true);
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    expect(claimPhotoDay("2026-11-26", store)).toBe(true);
    expect(claimPhotoDay("2026-11-26", store)).toBe(false);
    expect(claimPhotoDay("2026-11-27", store)).toBe(true);
    expect(claimPhotoDay("2026-11-28", null)).toBe(false);
  });
});

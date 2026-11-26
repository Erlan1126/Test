import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { perSecond } from "../src/logic/tycoon";
import { normalizeSpin, pickSlice, spin, spinAdLeft, spinCash, spinFree, spinOpen, SPIN_BUILD_CRYSTALS, SPIN_MIN_PER_MINUTE, SPIN_SLICES } from "../src/logic/spin";

const T0 = new Date(2026, 10, 26, 12, 0, 0).getTime();
/** A random function that lands on slice `i` (the middle of its share). */
const on = (i: number) => {
  const total = SPIN_SLICES.reduce((a, x) => a + x.weight, 0);
  const before = SPIN_SLICES.slice(0, i).reduce((a, x) => a + x.weight, 0);
  return () => (before + SPIN_SLICES[i].weight / 2) / total;
};
const idx = (pred: (k: (typeof SPIN_SLICES)[number]) => boolean) => SPIN_SLICES.findIndex(pred);

describe("daily spin wheel", () => {
  it("has about eight slices whose odds add up to 100, with a rare jackpot", () => {
    expect(SPIN_SLICES.length).toBe(8);
    expect(SPIN_SLICES.reduce((a, x) => a + x.weight, 0)).toBe(100);
    expect(SPIN_SLICES.every(x => x.weight > 0)).toBe(true);
    const jp = SPIN_SLICES.filter(x => x.kind === "jackpot");
    expect(jp.length).toBe(1);
    expect(jp[0].weight).toBeLessThanOrEqual(5);
    for (const x of SPIN_SLICES.filter(x => x.kind === "crystals")) expect([2, 5, 10, 25]).toContain(x.crystals);
  });

  it("picks slices by weight", () => {
    expect(pickSlice(() => 0)).toBe(0);
    expect(pickSlice(() => 0.99999)).toBe(SPIN_SLICES.length - 1);
    for (let i = 0; i < SPIN_SLICES.length; i++) expect(pickSlice(on(i))).toBe(i);
    // A seeded sweep lands on each slice in proportion to its weight.
    const counts = new Array(SPIN_SLICES.length).fill(0);
    for (let k = 0; k < 10000; k++) counts[pickSlice(() => k / 10000)]++;
    SPIN_SLICES.forEach((x, i) => expect(counts[i]).toBe(x.weight * 100));
  });

  it("gives one free spin per calendar day", () => {
    const s = defaultSave();
    expect(spinFree(s, T0)).toBe(true);
    expect(spin(s, T0, on(0))).not.toBeNull();
    expect(spinFree(s, T0)).toBe(false);
    expect(spin(s, T0 + 3600e3, on(0))).toBeNull();
    // The next morning it's back.
    const tomorrow = new Date(2026, 10, 27, 8, 0, 0).getTime();
    expect(spinFree(s, tomorrow)).toBe(true);
    expect(spin(s, tomorrow, on(0))).not.toBeNull();
    expect(s.spin.total).toBe(2);
  });

  it("allows one extra spin for an ad, only after the free one", () => {
    const s = defaultSave();
    expect(spinAdLeft(s, T0)).toBe(false);
    expect(spin(s, T0, on(0), true)).toBeNull();
    spin(s, T0, on(0));
    expect(spinAdLeft(s, T0)).toBe(true);
    expect(spin(s, T0, on(0), true)).not.toBeNull();
    expect(spinAdLeft(s, T0)).toBe(false);
    expect(spin(s, T0, on(0), true)).toBeNull();
  });

  it("pays cash scaled with income, with a floor for new cities", () => {
    const s = defaultSave();
    const i = idx(x => x.kind === "cash");
    const before = s.tycoon.coins;
    const r = spin(s, T0, on(i))!;
    const want = Math.round(Math.max(SPIN_MIN_PER_MINUTE * SPIN_SLICES[i].minutes!, perSecond(s, T0, false) * SPIN_SLICES[i].minutes! * 60));
    expect(r.kind).toBe("cash");
    expect(r.cash).toBe(want);
    expect(s.tycoon.coins).toBe(before + want);
    // A richer city gets more.
    const rich = defaultSave();
    rich.tycoon.levels.coffee = 200; rich.tycoon.managers = ["coffee"];
    expect(spinCash(rich, 10, T0)).toBeGreaterThan(spinCash(s, 10, T0));
  });

  it("pays crystals, the jackpot, a boom and a free build", () => {
    const s = defaultSave();
    const c = idx(x => x.kind === "crystals");
    spin(s, T0, on(c));
    expect(s.crystals).toBe(SPIN_SLICES[c].crystals);

    const j = defaultSave(), jp = idx(x => x.kind === "jackpot");
    const rj = spin(j, T0, on(jp))!;
    expect(rj.cash).toBeGreaterThan(0);
    expect(j.crystals).toBe(SPIN_SLICES[jp].crystals);

    const b = defaultSave();
    spin(b, T0, on(idx(x => x.kind === "boom")));
    expect(b.tycoon.boom).toBeGreaterThan(T0);

    const w = defaultSave(), bi = idx(x => x.kind === "build");
    w.tycoon.builds = [{ kind: "office", id: "", start: T0 - 1000, end: T0 + 3600e3 }];
    const rw = spin(w, T0, on(bi))!;
    expect(rw.built).toBe(true);
    expect(w.tycoon.builds[0].end).toBe(T0);
    // Nothing being built: crystals instead.
    const e = defaultSave();
    const re = spin(e, T0, on(bi))!;
    expect(re.built).toBe(false);
    expect(e.crystals).toBe(SPIN_BUILD_CRYSTALS);
  });

  it("opens in the city game after the first chapter", () => {
    const s = defaultSave();
    expect(spinOpen(s, true)).toBe(false);
    s.chapters.done = 1;
    expect(spinOpen(s, true)).toBe(true);
    expect(spinOpen(s, false)).toBe(false);
  });

  it("normalizes the saved state", () => {
    expect(defaultSave().spin).toEqual({ day: "", used: false, ads: 0, total: 0 });
    expect(normalizeSpin(null)).toEqual({ day: "", used: false, ads: 0, total: 0 });
    expect(normalizeSpin({ day: "2026-11-26", used: true, ads: 9, total: 4.7 })).toEqual({ day: "2026-11-26", used: true, ads: 1, total: 4 });
    expect(normalizeSpin({ day: "<script>", used: true, ads: -3, total: -1 })).toEqual({ day: "", used: false, ads: 0, total: 0 });
    const s = defaultSave();
    spin(s, T0, on(0));
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.spin).toEqual(s.spin);
    expect(spinFree(back, T0)).toBe(false);
    expect(normalize({}).spin.used).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeOrders, orderFor, orderMult, orderProgress, recordHq, ORDER_MAX, ORDER_MULT } from "../src/logic/orders";
import { defaultSave, normalize } from "../src/logic/save";
import { basePay } from "../src/logic/tycoon";
import { BUSINESSES } from "../src/data/tycoon";

const stack = (n: number) => [{ x0: -2, x1: 2, z0: -2, z1: 2, lobby: true }, ...Array.from({ length: n }, () => ({ x0: -1.8, x1: 1.8, z0: -1.8, z1: 1.8, lobby: false }))];
const hqRun = (o: { wide?: number; perfects?: number; bestStreak?: number }, floors = 15) =>
  ({ wide: 0, perfects: 0, bestStreak: 0, ...o, floors, stack: stack(floors), skin: "ocean", shape: "round" });

describe("building orders", () => {
  it("each business asks for its own kind of tower, harder at each stage", () => {
    const kinds = new Set(BUSINESSES.map((_, i) => orderFor(i, 1).kind));
    expect(kinds.size).toBe(3);
    for (let i = 0; i < BUSINESSES.length; i++) {
      for (let st = 1; st < 4; st++) {
        const a = orderFor(i, st), b = orderFor(i, st + 1);
        expect(a.n).toBeGreaterThan(0);
        // Same business, next stage: a different kind or a bigger ask.
        expect(a.kind !== b.kind || b.n > a.n).toBe(true);
      }
    }
    expect(orderFor(0, 1)).toEqual(orderFor(0, 1)); // the same order every time
  });

  it("the HQ tower is kept as built, and a filled order makes the business earn more for good", () => {
    const s = defaultSave(), o = orderFor(0, 1);
    const before = basePay(s, BUSINESSES[0]);
    const need = { [o.kind === "wide" ? "wide" : o.kind === "perfect" ? "perfects" : "bestStreak"]: o.n };
    expect(recordHq(s.orders, "coffee", o, hqRun(need))).toBe(true);
    expect(s.orders.towers.coffee).toMatchObject({ f: 15, s: "ocean", h: "round" });
    expect(s.orders.towers.coffee.b).toHaveLength(15);
    expect(basePay(s, BUSINESSES[0])).toBeCloseTo(before * ORDER_MULT);
    // Reload: the tower and the bonus stay.
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.orders).toEqual(s.orders);
    expect(basePay(back, BUSINESSES[0])).toBeCloseTo(before * ORDER_MULT);
  });

  it("a missed order still keeps the tower, without the bonus", () => {
    const s = defaultSave(), o = orderFor(1, 2);
    expect(recordHq(s.orders, "flowers", o, hqRun({}))).toBe(false);
    expect(s.orders.towers.flowers).toBeDefined();
    expect(orderMult(s.orders, "flowers")).toBe(1);
    expect(orderProgress(o, { wide: 99, perfects: 99, bestStreak: 99 })).toBe(o.n);
  });

  it("old or broken saves are made safe", () => {
    expect(normalize({ v: 2, profile: { towers: 3 } }).orders).toEqual({ towers: {}, filled: {} });
    const o = normalizeOrders({ towers: { coffee: { f: 3, b: [[0, 0, 1, 1], "x", [9, 9, 9, 9]] }, nope: { f: 3, b: [[0, 0, 1, 1]] } }, filled: { coffee: 99, nope: 2, flowers: -1 } }, BUSINESSES.map(b => b.id));
    expect(Object.keys(o.towers)).toEqual(["coffee"]);
    expect(o.towers.coffee.b).toEqual([[0, 0, 1, 1], [2, 2, 2, 2]]);
    expect(o.filled).toEqual({ coffee: ORDER_MAX });
  });
});

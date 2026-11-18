import { describe, expect, it } from "vitest";
import { cafeRun, claimTerrace, CONTRACT_WIDE, isWide, normalizeCafe, TERRACE_FLOORS, towerShape, type CafeRun } from "../src/logic/cafe";
import { defaultSave, normalize } from "../src/logic/save";
import { officeFloors, towerBonus, basePay } from "../src/logic/tycoon";
import { BUSINESSES } from "../src/data/tycoon";

/** A tower of `n` floors, each a little narrower (like real overhangs breaking off). */
function stack(n: number, shrink = 0.04) {
  const out = [{ x0: -2, x1: 2, z0: -2, z1: 2, lobby: true }];
  for (let i = 1; i <= n; i++) { const h = 2 * (1 - i * shrink); out.push({ x0: -h + 0.1, x1: h + 0.1, z0: -h, z1: h, lobby: false }); }
  return out;
}
const run = (floors: number, extra: Partial<CafeRun> = {}): CafeRun =>
  ({ mode: "classic", floors, stack: stack(floors), skin: "brick", shape: "round", wide: 0, contract: false, ...extra });

/** What finishing a tower does in the game: office floors, then the café. */
function finish(s: ReturnType<typeof defaultSave>, r: CafeRun) {
  if (r.mode !== "zen") towerBonus(s, r.floors);
  return cafeRun(s.cafe, r);
}

describe("the first two towers grow the café", () => {
  it("acceptance: 3 floors, miss, then 5 floors: starter stands, capacity 18, terrace opens once, all saved", () => {
    const s = defaultSave();
    expect(officeFloors(s)).toBe(10);
    const a = finish(s, run(3));
    expect(a.starter).toBe(true);
    expect(s.cafe.starter?.f).toBe(3);
    expect(s.cafe.starter?.b).toHaveLength(3);
    expect(s.cafe.terrace).toBe(0);
    expect(a.added).toBe(3);
    const b = finish(s, run(5));
    expect(b.starter).toBe(false); // the starter is the first tower, never replaced
    expect(s.cafe.starter?.f).toBe(3);
    expect(officeFloors(s)).toBe(18);
    expect(b.terraceReady).toBe(true);
    expect(s.cafe.terrace).toBe(1);
    expect(claimTerrace(s.cafe)).toBe(true);
    expect(claimTerrace(s.cafe)).toBe(false); // exactly once
    // Reload: everything persists.
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.cafe.starter).toEqual(s.cafe.starter);
    expect(back.cafe.terrace).toBe(2);
    expect(back.cafe.contract).toBe(1); // the café contract is offered next
    expect(officeFloors(back)).toBe(18);
    expect(claimTerrace(back.cafe)).toBe(false);
  });

  it("the open terrace makes the Coffee Cart earn more", () => {
    const s = defaultSave();
    const before = basePay(s, BUSINESSES[0]);
    finish(s, run(6));
    claimTerrace(s.cafe);
    expect(basePay(s, BUSINESSES[0])).toBeCloseTo(before * 1.2);
  });

  it("a zero-floor miss changes nothing", () => {
    const s = defaultSave();
    const r = finish(s, run(0));
    expect(r).toEqual({ starter: false, added: 0, terraceReady: false, contractDone: false });
    expect(s.cafe.starter).toBeNull();
    expect(s.cafe.floors).toBe(0);
    expect(officeFloors(s)).toBe(10);
  });

  it("a strong first run earns the starter and the terrace at once", () => {
    const s = defaultSave();
    const r = finish(s, run(TERRACE_FLOORS + 6));
    expect(r.starter).toBe(true);
    expect(r.terraceReady).toBe(true);
    expect(s.cafe.terrace).toBe(1);
  });

  it("Zen towers never count, and only a Classic tower becomes the starter", () => {
    const s = defaultSave();
    finish(s, run(9, { mode: "zen" }));
    expect(s.cafe.floors).toBe(0);
    finish(s, run(4, { mode: "daily" }));
    expect(s.cafe.starter).toBeNull();
    expect(s.cafe.floors).toBe(4);
    finish(s, run(2));
    expect(s.cafe.starter?.f).toBe(2);
    expect(s.cafe.terrace).toBe(1);
  });

  it("the starter keeps the tower's real floors, skin and shape", () => {
    const st = stack(4);
    const shape = towerShape(st);
    expect(shape[0]).toEqual([0.05, 0, 0.96, 0.96]);
    expect(shape[3][2]).toBeCloseTo(0.84, 2);
    const s = defaultSave();
    finish(s, { ...run(4), stack: st, skin: "ocean", shape: "hexagon" });
    expect(s.cafe.starter).toMatchObject({ f: 4, s: "ocean", h: "hexagon" });
  });

  it("an existing player reopening their city: no intro, and a grown company's terrace is ready", () => {
    const old = { v: 2, profile: { towers: 40, level: 12 }, tycoon: { floors: 300, levels: { coffee: 50 } } };
    const s = normalize(old);
    expect(s.cafe.framed).toBe(true);
    expect(s.cafe.starter).toBeNull();
    expect(s.cafe.terrace).toBe(1);
    expect(normalizeCafe(undefined, { floors: 3, towers: 2 }).terrace).toBe(0);
    // A brand-new save gets the intro.
    expect(defaultSave().cafe.framed).toBe(false);
  });
});

describe("the café contract", () => {
  it("counts wide floors and is done once at the goal", () => {
    const base = { x0: -2, x1: 2, z0: -2, z1: 2 };
    expect(isWide({ x0: -1.6, x1: 1.6, z0: -1.6, z1: 1.6 }, base)).toBe(true);
    expect(isWide({ x0: -1.5, x1: 1.5, z0: -2, z1: 2 }, base)).toBe(false);
    const s = defaultSave();
    finish(s, run(7));
    claimTerrace(s.cafe);
    expect(s.cafe.contract).toBe(1);
    expect(finish(s, run(8, { contract: true, wide: CONTRACT_WIDE - 1 })).contractDone).toBe(false);
    expect(s.cafe.wideBest).toBe(CONTRACT_WIDE - 1);
    expect(finish(s, run(8, { contract: true, wide: CONTRACT_WIDE })).contractDone).toBe(true);
    expect(s.cafe.contract).toBe(2);
    expect(finish(s, run(8, { contract: true, wide: 9 })).contractDone).toBe(false); // only once
  });
});

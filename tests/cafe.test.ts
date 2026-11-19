import { describe, expect, it } from "vitest";
import { cafeMult, cafeRun, claimTerrace, FLOWER_WIDE, isWide, normalizeCafe, PLAY_FLOORS, projectsOpen, seatingNeed, TERRACE_FLOORS, TERRACE_MULT, PROJECT_MULT, towerShape, type CafeRun } from "../src/logic/cafe";
import { defaultSave, normalize } from "../src/logic/save";
import { FREE_FLOORS, officeFloors, towerBonus, basePay } from "../src/logic/tycoon";
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
  it("acceptance: 3 floors, miss, then 5 floors: starter stands, 8 floors become 16 offices, terrace opens once, all saved", () => {
    const s = defaultSave();
    expect(officeFloors(s)).toBe(FREE_FLOORS);
    const a = finish(s, run(3));
    expect(a.starter).toBe(true);
    expect(s.cafe.starter?.f).toBe(3);
    expect(s.cafe.starter?.b).toHaveLength(3);
    expect(s.cafe.terrace).toBe(0);
    expect(a.added).toBe(3);
    const b = finish(s, run(5));
    expect(b.starter).toBe(false); // the starter is the first tower, never replaced
    expect(s.cafe.starter?.f).toBe(3);
    expect(officeFloors(s)).toBe(FREE_FLOORS + 2 * 8);
    expect(b.terraceReady).toBe(true);
    expect(s.cafe.terrace).toBe(1);
    expect(claimTerrace(s.cafe)).toBe(true);
    expect(claimTerrace(s.cafe)).toBe(false); // exactly once
    // Reload: everything persists.
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.cafe.starter).toEqual(s.cafe.starter);
    expect(back.cafe.terrace).toBe(2);
    expect(projectsOpen(back.cafe)).toBe(true); // the block's next project is offered
    expect(officeFloors(back)).toBe(FREE_FLOORS + 2 * 8);
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
    expect(r).toEqual({ starter: false, added: 0, terraceReady: false, projectDone: "", contractDone: false });
    expect(s.cafe.starter).toBeNull();
    expect(s.cafe.floors).toBe(0);
    expect(officeFloors(s)).toBe(FREE_FLOORS);
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
    // Their next tower is not announced as a "first tower" (it can still join the skyline).
    const r = cafeRun(s.cafe, run(9));
    expect(r.starter).toBe(false);
    expect(s.cafe.starter).toBeNull();
  });
});

describe("the café block", () => {
  it("the seating request counts down the floors still needed, from the real save", () => {
    const s = defaultSave();
    expect(seatingNeed(s.cafe)).toBe(TERRACE_FLOORS);
    finish(s, run(3));
    expect(seatingNeed(s.cafe)).toBe(3); // "Build 3 more floors for café seating"
    finish(s, run(2));
    expect(seatingNeed(s.cafe)).toBe(1);
    finish(s, run(5));
    expect(seatingNeed(s.cafe)).toBe(0);
    expect(s.cafe.terrace).toBe(1);
  });

  it("the neighbor's story is saved step by step and never replays", () => {
    const s = defaultSave();
    finish(s, run(3));
    expect(s.cafe).toMatchObject({ moved: false, asked: false, seated: false });
    s.cafe.moved = true; s.cafe.asked = true;
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.cafe).toMatchObject({ moved: true, asked: true, seated: false });
    // A save from before the neighbor: their story counts as told (nothing replays).
    const old = normalize({ v: 2, profile: { towers: 5 }, cafe: { starter: null, framed: true, floors: 9, terrace: 2, contract: 0, wideBest: 0 } });
    expect(old.cafe).toMatchObject({ moved: true, asked: true, seated: true });
  });

  it("tower three: two projects; only the chosen one counts, each opens once", () => {
    const s = defaultSave();
    finish(s, run(7));
    expect(projectsOpen(s.cafe)).toBe(false);
    claimTerrace(s.cafe);
    expect(projectsOpen(s.cafe)).toBe(true);
    // The playground counts floors; wide floors don't help it.
    expect(finish(s, run(PLAY_FLOORS - 1, { project: "play", wide: 9 })).projectDone).toBe("");
    expect(s.cafe.playBest).toBe(PLAY_FLOORS - 1);
    expect(s.cafe.wideBest).toBe(0);
    // The flower market counts wide floors.
    expect(finish(s, run(12, { project: "flowers", wide: FLOWER_WIDE - 1 })).projectDone).toBe("");
    expect(finish(s, run(6, { project: "flowers", wide: FLOWER_WIDE })).projectDone).toBe("flowers");
    expect(finish(s, run(6, { project: "flowers", wide: 9 })).projectDone).toBe(""); // once
    // An ordinary tower doesn't count toward either.
    expect(finish(s, run(20)).projectDone).toBe("");
    expect(projectsOpen(s.cafe)).toBe(true); // the playground is still there for later
    expect(finish(s, run(PLAY_FLOORS, { project: "play" })).projectDone).toBe("play");
    expect(projectsOpen(s.cafe)).toBe(false);
    expect(cafeMult(s.cafe)).toBeCloseTo(TERRACE_MULT * PROJECT_MULT * PROJECT_MULT);
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.cafe.done).toEqual(["flowers", "play"]);
  });

  it("older saves: a café contract still open becomes the choice; a finished one keeps its bonus", () => {
    const open = normalize({ v: 2, profile: { towers: 5 }, cafe: { framed: true, floors: 9, terrace: 2, contract: 1, wideBest: 3 } });
    expect(open.cafe.contract).toBe(0);
    expect(projectsOpen(open.cafe)).toBe(true);
    expect(open.cafe.wideBest).toBe(3);
    const done = normalize({ v: 2, profile: { towers: 5 }, cafe: { framed: true, floors: 9, terrace: 2, contract: 2, wideBest: 5 } });
    expect(cafeMult(done.cafe)).toBeCloseTo(TERRACE_MULT * TERRACE_MULT);
  });

  it("wide floors keep 80% of the first floor", () => {
    const base = { x0: -2, x1: 2, z0: -2, z1: 2 };
    expect(isWide({ x0: -1.6, x1: 1.6, z0: -1.6, z1: 1.6 }, base)).toBe(true);
    expect(isWide({ x0: -1.5, x1: 1.5, z0: -2, z1: 2 }, base)).toBe(false);
  });
});

describe("old café contract", () => {
  it("counts as the flower market, with its bonus paid once", () => {
    const c = normalizeCafe({ starter: null, framed: true, floors: 20, terrace: 2, contract: 2 }, { floors: 20, towers: 5 });
    expect(c.done).toContain("flowers");
    expect(cafeMult(c)).toBeCloseTo(TERRACE_MULT * TERRACE_MULT);
    expect(projectsOpen(c)).toBe(true); // the playground is still on offer
  });
});

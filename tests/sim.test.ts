import { describe, expect, it } from "vitest";
import { seeded } from "../src/core/rng";
import { CHALLENGES } from "../src/data/challenges";
import { TowerSim, type SimConfig } from "../src/logic/sim";

const sim = (over: Partial<SimConfig> = {}) => new TowerSim({ mode: "classic", rng: seeded(1), rewinds: 1, ...over });

/** Slides the floor to `offset` from perfectly lined up, then drops it. */
function dropAt(s: TowerSim, offset: number) {
  const m = s.mover!, top = s.top;
  const target = (m.axis === "x" ? top.x0 : top.z0) + offset;
  const shift = target - (m.axis === "x" ? m.x0 : m.z0);
  if (m.axis === "x") { m.x0 += shift; m.x1 += shift; } else { m.z0 += shift; m.z1 += shift; }
  return s.drop()!;
}

describe("tower simulation", () => {
  it("snaps perfect drops into place and builds a combo", () => {
    const s = sim();
    const a = dropAt(s, 0.1);
    expect(a.type === "land" && a.perfect).toBe(true);
    expect(s.top.x1 - s.top.x0).toBe(10);
    expect(a.type === "land" && a.points).toBe(30); // 20 people x 1.5 for a perfect
    dropAt(s, -0.1);
    expect(s.combo).toBe(2);
  });

  it("cuts off the overhang and shrinks the floor", () => {
    const s = sim();
    const out = dropAt(s, 3);
    expect(out.type).toBe("land");
    if (out.type !== "land") return;
    expect(out.perfect).toBe(false);
    const width = s.top.x1 - s.top.x0 + (s.top.z1 - s.top.z0);
    expect(width).toBeCloseTo(17);
    expect(out.piece).toBeDefined();
    expect(s.combo).toBe(0);
  });

  it("ends on a complete miss, but Zen keeps going", () => {
    const s = sim();
    expect(dropAt(s, 11).type).toBe("miss");
    expect(s.mover).toBeNull();
    const z = sim({ mode: "zen" });
    expect(dropAt(z, 11).type).toBe("miss");
    expect(z.mover).not.toBeNull();
  });

  it("allows one rewind, more with the boost, none in no-rewind challenges", () => {
    const s = sim();
    dropAt(s, 11);
    expect(s.canRewind()).toBe(true);
    s.rewind();
    expect(s.mover).not.toBeNull();
    dropAt(s, 11);
    expect(s.canRewind()).toBe(false);
    expect(sim({ rewinds: 2 }).rewindsLeft).toBe(2);
    expect(sim({ challenge: CHALLENGES.find(c => c.rules.noRewind) }).rewindsLeft).toBe(0);
  });

  it("is identical for the same seed whatever the player does", () => {
    const kinds = (offsets: number[]) => {
      const s = sim({ rng: seeded(77) });
      const out: string[] = [];
      for (let i = 0; i < 60; i++) { out.push(s.mover!.kind); dropAt(s, offsets[i % offsets.length]); }
      return out.join();
    };
    expect(kinds([0])).toBe(kinds([0, 0.2, -0.1]));
  });

  it("brings in special floors, and gardens widen the tower", () => {
    const s = sim({ rng: seeded(3) });
    const seen = new Set<string>();
    for (let i = 0; i < 400 && s.mover; i++) {
      seen.add(s.mover.kind);
      if (s.mover.kind === "garden") {
        dropAt(s, 1.5); // a sloppy drop on a garden still widens
        expect(s.top.x1 - s.top.x0 + s.top.z1 - s.top.z0).toBeGreaterThan(18);
        continue;
      }
      dropAt(s, 0);
    }
    expect([...seen].sort()).toEqual(["garden", "gold", "ice", "normal"]);
  });

  it("makes gold more common with the boost and in Gold Rush", () => {
    const count = (over: Partial<SimConfig>) => {
      const s = sim({ rng: seeded(9), ...over });
      let gold = 0;
      for (let i = 0; i < 300; i++) { if (s.mover!.kind === "gold") gold++; dropAt(s, 0); }
      return gold;
    };
    const base = count({});
    expect(count({ goldBoost: true })).toBeGreaterThan(base * 1.4);
  });

  it("knows when a challenge goal is reached", () => {
    const c = CHALLENGES.find(x => x.goal.type === "streak")!;
    const s = sim({ mode: "challenge", challenge: c, rng: seeded(c.seed) });
    for (let i = 0; i < c.goal.n; i++) { expect(s.goalReached()).toBe(false); dropAt(s, 0); }
    expect(s.goalReached()).toBe(true);
    expect(s.summary().challengeWon).toBe(true);
  });

  it("makes every third floor icy in Icebreaker", () => {
    const c = CHALLENGES.find(x => x.id === "icebreaker")!;
    const s = sim({ mode: "challenge", challenge: c, rng: seeded(c.seed) });
    for (let i = 0; i < 12; i++) {
      const n = s.mover!.y;
      if (n % 3 === 0 && s.mover!.kind !== "gold") expect(s.mover!.kind).toBe("ice");
      dropAt(s, 0);
    }
  });

  it("has no wind in Zen or during Calm Skies", () => {
    expect(sim({ mode: "zen" }).windFor(60)).toBe(0);
    expect(sim({ event: { id: "calm", name: "", text: "", noWind: true } }).windFor(60)).toBe(0);
    expect(sim().windFor(60)).toBeGreaterThan(0);
  });
});

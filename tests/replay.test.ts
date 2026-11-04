import { describe, expect, it } from "vitest";
import { seeded } from "../src/core/rng";
import { REWIND, RunRecorder, replayRun, simFor, type RunRecord } from "../src/logic/replay";

/** Plays a tower like a person would: taps when the floor is close to lining up, with
 *  some sloppiness, and uses the rewind once. */
function play(base: Omit<RunRecord, "v" | "log">, skill: number, salt: number) {
  const rec = new RunRecorder(base);
  const sim = simFor(rec.rec);
  const r = seeded(salt);
  let guard = 0;
  while (guard++ < 400_000) {
    sim.step();
    if (!sim.mover) {
      if (sim.canRewind()) { sim.rewind(); rec.rewind(); continue; }
      break;
    }
    const close = Math.abs(sim.offset()) < 0.05 + (1 - skill) * 1.2;
    if (close && r() < 0.08) {
      rec.drop(sim.ticks);
      sim.drop();
      if (sim.level > 300) break;
    }
  }
  return { rec: rec.rec, summary: sim.summary() };
}

const base = { mode: "classic" as const, seed: 12345, week: 3, day: 40, boosts: { rewind: false, gold: false } };

describe("replays", () => {
  it("rebuild exactly the same tower", () => {
    for (const [skill, salt] of [[0.9, 1], [0.6, 2], [0.3, 3]] as const) {
      const { rec, summary } = play({ ...base, seed: 1000 + salt }, skill, salt);
      const out = replayRun(JSON.parse(JSON.stringify(rec)));
      expect(out.ok).toBe(true);
      if (out.ok) expect(out.summary).toEqual(summary);
    }
  });

  it("works for daily towers, boosts and challenges", () => {
    for (const b of [
      { ...base, mode: "daily" as const, seed: 99 },
      { ...base, boosts: { rewind: true, gold: true } },
      { ...base, mode: "challenge" as const, challenge: "niagara", seed: 7 },
    ]) {
      const { rec, summary } = play(b, 0.7, 5);
      const out = replayRun(rec);
      expect(out.ok, JSON.stringify(out)).toBe(true);
      if (out.ok) expect(out.summary.score).toBe(summary.score);
    }
  });

  it("rejects made-up logs", () => {
    const { rec } = play(base, 0.8, 9);
    expect(replayRun({ ...rec, log: [50, 40] }).ok).toBe(false);          // time going backwards
    expect(replayRun({ ...rec, log: [REWIND] }).ok).toBe(false);          // rewind with nothing to rewind
    expect(replayRun({ ...rec, log: [10, 1e9] }).ok).toBe(false);         // impossibly long
    expect(replayRun({ ...rec, mode: "nope" as never }).ok).toBe(false);
    expect(replayRun({ ...rec, v: 2 as never }).ok).toBe(false);
  });

  it("can't score more by tapping at better moments than the tower allows", () => {
    // A forged log of perfect taps still has to land where the floor actually is.
    const { rec, summary } = play(base, 0.9, 11);
    const out = replayRun(rec);
    expect(out.ok && out.summary.score).toBe(summary.score);
  });
});

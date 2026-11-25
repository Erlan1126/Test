import { expect, it, describe } from "vitest";
import { defaultSave } from "../src/logic/save";
import { eraGems, newEra } from "../src/logic/tycoon";
import { eraNudge, nudgeGems, snoozeEraNudge, ERA_NUDGE_AFTER, ERA_NUDGE_SNOOZE, normalizeEraNudge } from "../src/logic/eranudge";
import { GEM_BONUS } from "../src/data/tycoon";

const T0 = 1_800_000_000_000;
const rich = () => { const s = defaultSave(); s.tycoon.lifetime = 5e9; s.tycoon.levels = { coffee: 40, flowers: 20 }; return s; };

describe("New Era nudge", () => {
  it("counts the same gems as the New Era itself", () => {
    const s = rich();
    expect(nudgeGems(s)).toBe(eraGems(s));
    s.tycoon.gems = 3;
    expect(nudgeGems(s)).toBe(eraGems(s));
  });
  it("shows only after about a day with nothing new, and says what the gems do", () => {
    const s = rich();
    expect(eraNudge(s, T0)).toBeNull();
    expect(eraNudge(s, T0 + ERA_NUDGE_AFTER - 60e3)).toBeNull();
    const n = eraNudge(s, T0 + ERA_NUDGE_AFTER + 60e3)!;
    expect(n.gems).toBe(eraGems(s));
    expect(n.before).toBe(1);
    expect(n.after).toBeCloseTo(1 + n.gems * GEM_BONUS);
    expect(n.pct).toBe(Math.round(n.gems * GEM_BONUS * 100));
  });
  it("starts the clock over when something new unlocks", () => {
    const s = rich();
    eraNudge(s, T0);
    s.tycoon.levels.bakery = 1; // a new business opened
    expect(eraNudge(s, T0 + ERA_NUDGE_AFTER + 60e3)).toBeNull();
    expect(eraNudge(s, T0 + 2 * ERA_NUDGE_AFTER + 120e3)).not.toBeNull();
  });
  it("never shows when a New Era would pay nothing, and 'Not now' hides it for a day", () => {
    const s = defaultSave();
    eraNudge(s, T0);
    expect(eraNudge(s, T0 + 3 * ERA_NUDGE_AFTER)).toBeNull();
    const r = rich();
    eraNudge(r, T0);
    const later = T0 + ERA_NUDGE_AFTER + 60e3;
    snoozeEraNudge(r, later);
    expect(eraNudge(r, later + 60e3)).toBeNull();
    expect(eraNudge(r, later + ERA_NUDGE_SNOOZE + 60e3)).not.toBeNull();
    // After a New Era there are no gems to collect, so it stays quiet.
    newEra(r, later);
    expect(eraNudge(r, later + 3 * ERA_NUDGE_AFTER)).toBeNull();
  });
  it("cleans a stored state", () => {
    expect(normalizeEraNudge({ sig: 5, at: -3, off: "x" })).toEqual({ sig: "", at: 0, off: 0 });
  });
});

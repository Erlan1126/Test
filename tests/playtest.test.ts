import { describe, expect, it } from "vitest";
import { botTower, SKILLS } from "../scripts/playtest";

// Bot players guard the practice towers' difficulty curve: a new player's perfect rate
// should fall gently floor by floor, never off a cliff.
describe("bot playtests", () => {
  const rate = (logs: ReturnType<typeof botTower>[], a: number, b: number) => {
    let p = 0, all = 0;
    for (const l of logs) for (let y = a; y <= b; y++) if (l.perfectAt[y] !== undefined) { all++; if (l.perfectAt[y]) p++; }
    return p / all;
  };

  it("practice towers have no cliff for new players", () => {
    const logs = Array.from({ length: 30 }, (_, i) => botTower(SKILLS[0], 1000 + i, true, 120));
    const bands = [[1, 10], [11, 15], [16, 20], [21, 30]].map(([a, b]) => rate(logs, a, b));
    for (let i = 1; i < bands.length; i++) expect(bands[i] / bands[i - 1], `band ${i}`).toBeGreaterThan(0.7);
    // Nobody falls off the first twenty floors of a practice tower.
    expect(logs.filter(l => l.floors <= 20).length).toBe(0);
  });

  it("is replayable: the same seed plays the same tower", () => {
    expect(botTower(SKILLS[1], 7, false, 80)).toEqual(botTower(SKILLS[1], 7, false, 80));
  });
});

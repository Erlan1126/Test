import { describe, expect, it } from "vitest";
import { claimTournament, prizeFor } from "../src/logic/tournament";
import { loadSave } from "../src/logic/save";

describe("weekly tournament", () => {
  it("pays by final rank, and something to everyone who took part", () => {
    expect(prizeFor(1, 500).crystals).toBe(150);
    expect(prizeFor(3, 500).crystals).toBe(80);
    expect(prizeFor(10, 500).crystals).toBe(40);
    expect(prizeFor(50, 500).crystals).toBe(20);   // top 10%
    expect(prizeFor(51, 500)).toMatchObject({ crystals: 0, stars: 15 });
    expect(prizeFor(12, 40).crystals).toBe(0);     // small board: top 10% is still the top 10
  });

  it("pays each week's prize only once", () => {
    const s = loadSave(null);
    const c = s.crystals;
    expect(claimTournament(s, 100, 2, 300)?.crystals).toBe(80);
    expect(s.crystals).toBe(c + 80);
    expect(claimTournament(s, 100, 1, 300)).toBeNull();
    expect(claimTournament(s, 99, 1, 300)).toBeNull();   // an older week can't be claimed after
    expect(s.crystals).toBe(c + 80);
  });
});

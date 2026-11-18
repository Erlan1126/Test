import { expect, it } from "vitest";
import { claimSpire, normalizeSpire, newSpire, spireAdd, spireReady, SPIRE_GOALS, SPIRE_PER_TOWER } from "../src/logic/spire";

it("one tower adds its perfect drops, up to a cap", () => {
  expect(spireAdd(12)).toBe(12);
  expect(spireAdd(500)).toBe(SPIRE_PER_TOWER);
  expect(spireAdd(-3)).toBe(0);
  expect(spireAdd(NaN)).toBe(0);
});

it("each height reached pays once, only to players who built that week", () => {
  const s = newSpire();
  const now = { week: 100, floors: SPIRE_GOALS[1].floors, builders: 50, mine: 0 };
  expect(spireReady(s, now)).toBe(0); // didn't build this week
  now.mine = 3;
  expect(spireReady(s, now)).toBe(2);
  expect(claimSpire(s, now)).toBe(SPIRE_GOALS[0].stars + SPIRE_GOALS[1].stars);
  expect(claimSpire(s, now)).toBe(0); // once
  now.floors = SPIRE_GOALS[2].floors;
  expect(claimSpire(s, now)).toBe(SPIRE_GOALS[2].stars);
  // A new week starts over.
  expect(spireReady(s, { week: 101, floors: SPIRE_GOALS[0].floors, builders: 1, mine: 1 })).toBe(1);
  expect(normalizeSpire(JSON.parse(JSON.stringify(s)))).toEqual(s);
  expect(normalizeSpire({ week: "x", claimed: 99 })).toEqual({ week: -1, claimed: SPIRE_GOALS.length });
});

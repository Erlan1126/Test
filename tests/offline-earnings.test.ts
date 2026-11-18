import { expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { BUSINESSES } from "../src/data/tycoon";
import { RUSH_SECONDS } from "../src/data/tycoon";
import { buyLevels, hireManager, startOpening, tick, OPENING_MINUTES } from "../src/logic/tycoon";

const T0 = 1_800_000_000_000;

/** A company with a managed Coffee Cart, its grand opening just started. */
function company() {
  const s = defaultSave();
  s.tycoon.last = T0;
  s.tycoon.floors = 100;
  s.tycoon.coins = 1e6;
  buyLevels(s, "coffee", 24, T0);
  hireManager(s, "coffee", T0);
  startOpening(s, T0);
  s.tycoon.coins = 0;
  s.tycoon.lifetime = 0;
  return s;
}

/** Earned over `minutes`, either ticking every second (playing) or settled once (coming back). */
function earned(minutes: number, live: boolean, setup?: (s: ReturnType<typeof company>) => void) {
  const s = company();
  setup?.(s);
  const end = T0 + minutes * 60e3;
  if (live) for (let t = T0 + 1000; t <= end; t += 1000) tick(s, t);
  else tick(s, end);
  return s.tycoon.coins;
}

it("21 minutes across the end of the grand opening pay the same played or settled", () => {
  // The opening (×5) ends after 20 minutes, in the middle of this stretch.
  expect(OPENING_MINUTES).toBe(20);
  const live = earned(21, true), settled = earned(21, false);
  expect(live).toBeGreaterThan(0);
  expect(Math.abs(live - settled)).toBeLessThan(BUSINESSES[0].income * 25 * 5 + 1e-6); // within one cycle
  expect(settled / live).toBeGreaterThan(0.99);
});

it("a stretch that starts and ends with the opening on pays the boosted rate either way", () => {
  expect(earned(10, false)).toBeCloseTo(earned(10, true), 6);
});

it("a construction boom ending halfway is paid only for the cycles before it ended", () => {
  const boom = (s: ReturnType<typeof company>) => { s.tycoon.opening = 1; s.tycoon.boom = T0 + 5 * 60e3; };
  const live = earned(10, true, boom), settled = earned(10, false, boom);
  expect(settled / live).toBeGreaterThan(0.99);
  expect(settled / live).toBeLessThan(1.01);
});

it("a rush hour still only boosts the cycles that finished during it", () => {
  const rush = (s: ReturnType<typeof company>) => { s.tycoon.opening = 1; s.tycoon.rush = { id: "coffee", until: T0 + 120e3 }; };
  const plain = earned(10, false, s => { s.tycoon.opening = 1; });
  const settled = earned(10, false, rush), live = earned(10, true, rush);
  expect(settled).toBeGreaterThan(plain);
  expect(settled / live).toBeGreaterThan(0.99);
  expect(settled / live).toBeLessThan(1.01);
  // No more than the rush window's worth of extra cycles.
  expect(settled - plain).toBeLessThanOrEqual((RUSH_SECONDS / 3 + 1) * 25 * 2 + 1e-6); // 3 s cycles at level 25
});

it("the vault cap still stops earnings after the offline limit", () => {
  const s = company();
  s.tycoon.opening = 1;
  tick(s, T0 + 8 * 3600e3);
  const at8 = s.tycoon.coins;
  const s2 = company();
  s2.tycoon.opening = 1;
  tick(s2, T0 + 30 * 3600e3);
  expect(s2.tycoon.coins).toBeCloseTo(at8, 6);
});

it("a part-done cycle carries over instead of being lost or paid early", () => {
  const s = company();
  tick(s, T0 + 6000 + 2500); // one 6 s cycle done, 2.5 s into the next
  expect(s.tycoon.runs.coffee).toBe(T0 + 6000);
});

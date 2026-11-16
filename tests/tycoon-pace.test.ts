import { expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { BUSINESSES, coins } from "../src/data/tycoon";
import { buyUpgrade, evolve, readyStage, upgradesOnOffer, buyLevels, costOf, cycleOf, hireManager, levelOf, perSecond, runOnce, tick, towerBonus, freeFloors, unlockedBusiness } from "../src/logic/tycoon";

// A normal player (three 10-minute sessions a day, two towers each, managers running while
// away) followed for two weeks: the company should grow steadily, not explode.
it("the Tycoon takes its time", () => {
  const s = defaultSave();
  let now = 1_800_000_000_000, towers = 0;
  const shop = () => {
    for (let guard = 0; guard < 2000; guard++) {
      // Cheap upgrades first (a player buys one as soon as it costs less than a few levels).
      const up = upgradesOnOffer(s).find(u => u.cost <= s.tycoon.coins);
      if (up && buyUpgrade(s, up.id)) continue;
      const m = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && s.tycoon.coins >= b.manager);
      if (m) { hireManager(s, m.id, now); continue; }
      let best: string | null = null, score = 0;
      for (const [i, b] of BUSINESSES.entries()) {
        const lv = levelOf(s, b.id), c = costOf(b, lv, 1);
        if (c > s.tycoon.coins || freeFloors(s) < 1 || !unlockedBusiness(s, i)) continue;
        const gain = (b.income / cycleOf(b, lv + 1)) / c;
        if (gain > score) { score = gain; best = b.id; }
      }
      if (!best || !buyLevels(s, best, 1, now)) break;
    }
  };
  const out: string[] = [];
  const at: Record<number, number> = {};
  for (let day = 1; day <= 14; day++) {
    for (const gap of [0, 4, 4]) {
      now += gap * 3600e3; tick(s, now); shop();
      // One of the session's towers builds a headquarters, if a business is ready to grow.
      const ready = BUSINESSES.find(b => readyStage(s, b.id));
      if (ready) evolve(s, ready.id, 999);
      for (let k = 0; k < 2; k++) { towers++; s.population = Math.min(500000, towers * 2500); towerBonus(s, 25, now); }
      for (let sec = 0; sec < 600; sec++) {
        now += 1000;
        for (const b of BUSINESSES) runOnce(s, b.id, now);
        tick(s, now);
        if (sec % 10 === 0) shop();
      }
    }
    now += 16 * 3600e3 - 20 * 60e3; tick(s, now); shop();
    at[day] = s.tycoon.lifetime;
    if ([1, 7, 14].includes(day))
      out.push(`day ${day}: lifetime ${coins(s.tycoon.lifetime)}, rate ${coins(perSecond(s, now))}/s, warp4h ${coins(perSecond(s, now) * 4 * 3600)}, levels ${JSON.stringify(s.tycoon.levels)}`);
  }
  console.log(out.join("\n"));
  expect(at[1]).toBeLessThan(3e6);       // no millions on the first day... at most one
  expect(at[7]).toBeLessThan(1e8);
  expect(at[14]).toBeGreaterThan(2e7);   // but it keeps growing
  expect(at[14]).toBeLessThan(5e8);
  expect(levelOf(s, "mall")).toBe(0);    // the big businesses are long-term goals
}, 120000);

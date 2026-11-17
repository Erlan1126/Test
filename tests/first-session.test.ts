import { expect, it } from "vitest";
import { defaultSave } from "../src/logic/save";
import { BUSINESSES } from "../src/data/tycoon";
import { startOpening, buyLevels, costOf, cycleOf, freeFloors, hireManager, levelOf, readyStage, runOnce, tick, towerBonus, unlockedBusiness } from "../src/logic/tycoon";

/** A brand-new player's first session: they tap whatever is idle, buy the best deal, hire a
 *  manager when they can, and build a tower (about 18 floors) every few minutes. */
export function firstSession(minutes = 15) {
  const s = defaultSave();
  let now = 1_800_000_000_000;
  s.tycoon.last = now;
  const at: Record<string, number> = {};
  const mark = (k: string, sec: number) => { if (at[k] === undefined) at[k] = Math.round(sec / 6) / 10; };
  towerBonus(s, 18, now); // the first tower, before the company opens
  startOpening(s, now);
  for (let sec = 0; sec < minutes * 60; sec++) {
    now += 1000;
    for (const b of BUSINESSES) runOnce(s, b.id, now);
    tick(s, now);
    // A tower every four minutes (the BUILD button).
    if (sec > 0 && sec % 240 === 0) towerBonus(s, 18, now);
    if (sec % 3 === 0) for (let g = 0; g < 50; g++) {
      const m = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && s.tycoon.coins >= b.manager);
      if (m) { hireManager(s, m.id, now); mark(`manager:${m.id}`, sec); continue; }
      // The Next step card asks for the coffee manager early: a guided player saves for it.
      if (!s.tycoon.managers.includes("coffee") && levelOf(s, "coffee") >= 3) break;
      let best: string | null = null, score = 0;
      for (const [i, b] of BUSINESSES.entries()) {
        const lv = levelOf(s, b.id), c = costOf(b, lv, 1);
        if (c > s.tycoon.coins || freeFloors(s) < 1 || !unlockedBusiness(s, i)) continue;
        const gain = lv === 0 ? 1e9 : (b.income / cycleOf(b, lv + 1)) / c;
        if (gain > score) { score = gain; best = b.id; }
      }
      if (!best) break;
      if (levelOf(s, best) === 0) mark(`open:${best}`, sec);
      buyLevels(s, best, 1, now);
    }
    for (const b of BUSINESSES) if (readyStage(s, b.id)) mark(`ready:${b.id}`, sec);
  }
  return at;
}

it("the first session reaches its big moments in time", () => {
  const at = firstSession();
  // First manager in a few minutes, a second business soon after, and the first building
  // ready to grow (the big moment) before ten minutes are up.
  expect(at["manager:coffee"]).toBeLessThan(4);
  expect(at["open:flowers"]).toBeLessThan(5);
  expect(at["ready:coffee"]).toBeLessThan(9);
});

import { expect, it } from "vitest";
import { defaultSave, type SaveData } from "../src/logic/save";
import { BUSINESSES } from "../src/data/tycoon";
import { CHAPTERS, chapterIndex, chapterReady, claimChapter } from "../src/data/chapters";
import { LAND } from "../src/data/land";
import { buyUpgrade, upgradesOnOffer, usedFloors, buyLevels, costOf, cycleOf, freeFloors, hallLevel, hireManager, levelOf, perSecond, readyStage, runOnce, startOpening, tick, unlockedBusiness } from "../src/logic/tycoon";
import { buildPrice, completeBuilds, freeBuilders, startBuild, type BuildKind } from "../src/logic/builds";
import { landOnSale } from "../src/logic/land";
import { PROJECTS, projectsOpen } from "../src/logic/cafe";
import { propBlock, propLevel } from "../src/logic/props";

/** A simulated Buildaroo player: follows Mayor Pip's goals the way the Next step card leads,
 *  taps what's idle (`tapEvery` seconds between taps), buys the best level, hires managers and
 *  keeps the builders busy. Plays `sessions` a day of `sessionMin` minutes, 4 h apart, with a
 *  night in between; managers earn while away. Returns when each big moment happened and the
 *  longest stretch of play with nothing new (no new business, manager, build or City Hall level). */
export function cityPlaytest(days = 3, opts: { sessions?: number; sessionMin?: number; tapEvery?: number } = {}) {
  const { sessions = 3, sessionMin = 10, tapEvery = 1.5 } = opts;
  const s: SaveData = defaultSave();
  let now = 1_800_000_000_000, played = 0, lastNew = 0, lastWhat = "start";
  s.tycoon.last = now;
  const events: string[] = [];
  const gaps: { at: number; len: number; waiting: string }[] = [];
  const mark = (what: string) => {
    const len = played - lastNew;
    if (len > 0) gaps.push({ at: lastNew, len, waiting: `${lastWhat} → ${what}` });
    lastNew = played; lastWhat = what;
    events.push(`${(played / 60).toFixed(1)}m ${what}`);
  };
  const keys = ["h:0", "h:1", "h:2", "h:3", "h:4", "h:5"], lots = Array.from({ length: 30 }, (_, i) => `g:${i},0`);
  const build = (kind: BuildKind, id = "") => {
    if (freeBuilders(s, now) < 1 || s.tycoon.coins < buildPrice(s, kind, id, now)) return false;
    if (startBuild(s, kind, id, now) !== "ok") return false;
    mark(`build ${kind}${id ? " " + id : ""}${kind === "land" ? ` (rate ${perSecond(s, now).toExponential(1)}/s, price ${buildPrice(s, kind, id, now).toExponential(1)})` : ""}`);
    return true;
  };
  const decide = () => {
    for (const d of completeBuilds(s, now)) if (d.kind === "terrace") s.cafe.terrace = 2;
    while (chapterReady(s)) { claimChapter(s); mark(`City Hall Lv ${hallLevel(s)}`); }
    const goal = CHAPTERS[chapterIndex(s)]?.goals.find(g => g.have(s) < g.need);
    // Builders first (what Pip's goals ask for most), then managers, then levels.
    if (s.cafe.terrace === 0) build("terrace");
    if (projectsOpen(s.cafe)) { const p = PROJECTS.find(x => !s.cafe.done.includes(x)); if (p) build("project", p); }
    for (const b of BUSINESSES) if (readyStage(s, b.id)) build("hq", b.id);
    // (Offices full: "Build more floors", as the card says.)
    if (freeFloors(s) < 10) build("office");
    const sale = landOnSale(s);
    if (sale && (goal?.kind === "land")) build("land", sale.id);
    // (Saving a builder for the district Pip asks for.)
    if (goal?.kind === "land" && sale) return levelsAndManagers(goal, sale);
    const lot = lots.find(k => propLevel(s, k) === 0 && !propBlock(s, k));
    if (lot && (goal?.kind === "builds" || s.tycoon.coins > buildPrice(s, "home", lot, now) * 3)) build("home", lot);
    const home = [...keys, ...lots].filter(k => !propBlock(s, k) && propLevel(s, k) >= 1).sort((a, b) => propLevel(s, a) - propLevel(s, b))[0];
    if (home && (goal?.kind === "builds" || s.tycoon.coins > buildPrice(s, "home", home, now) * 3)) build("home", home);
    levelsAndManagers(goal, sale);
  };
  const levelsAndManagers = (goal: ReturnType<typeof CHAPTERS[number]["goals"]["find"]>, sale: ReturnType<typeof landOnSale>) => {
    for (let g = 0; g < 400; g++) {
      // (Cheap upgrades first, from Company → Upgrades.)
      const up = upgradesOnOffer(s).find(u => u.cost <= s.tycoon.coins);
      if (up && buyUpgrade(s, up.id)) continue;
      const m = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && s.tycoon.coins >= b.manager);
      if (m) { hireManager(s, m.id, now); if (s.tycoon.tips < 3) s.tycoon.tips = 3; mark(`manager ${m.id}`); continue; }
      // (A player saving for a goal doesn't spend it all on levels.)
      if (goal?.kind === "managers") { const next = BUSINESSES.filter(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id)).sort((a, b) => a.manager - b.manager)[0]; if (next && s.tycoon.coins < next.manager && levelOf(s, next.id) >= 3) break; }
      // (Pip's card says "Save {n} for the district": a guided player saves for it.)
      if (goal?.kind === "land" && sale && s.tycoon.coins < buildPrice(s, "land", sale.id, now)) break;
      let best: string | null = null, score = 0;
      for (const [i, b] of BUSINESSES.entries()) {
        const lv = levelOf(s, b.id), c = costOf(b, lv, 1);
        if (c > s.tycoon.coins || freeFloors(s) < 1 || !unlockedBusiness(s, i)) continue;
        const gain = lv === 0 ? 1e12 : (b.income / cycleOf(b, lv + 1)) / c;
        if (gain > score) { score = gain; best = b.id; }
      }
      if (!best) break;
      const opened = levelOf(s, best) === 0;
      buyLevels(s, best, 1, now);
      if (opened) mark(`open ${best}`);
      if (readyStage(s, best) && !events.some(e => e.endsWith(`ready ${best}:${readyStage(s, best)}`))) mark(`ready ${best}:${readyStage(s, best)}`);
    }
  };
  // The first sale opens the doors (grand opening), as in the game.
  buyLevels(s, "coffee", 1, now); startOpening(s, now); s.tycoon.tips = 1;
  let nextTap = 0;
  for (let day = 0; day < days; day++) {
    for (let k = 0; k < sessions; k++) {
      if (k > 0) { now += 4 * 3600e3; tick(s, now); }
      for (let sec = 0; sec < sessionMin * 60; sec++) {
        now += 1000; played++;
        if (played >= nextTap) {
          const idle = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && !s.tycoon.runs[b.id]);
          if (idle) { runOnce(s, idle.id, now); nextTap = played + tapEvery; }
        }
        tick(s, now);
        if (sec % 3 === 0) decide();
      }
    }
    now += 12 * 3600e3; tick(s, now);
    events.push(`  -- day ${day + 1}: hall ${hallLevel(s)}, levels ${usedFloors(s)}, ${Math.round(perSecond(s, now))}/s`);
  }
  mark("end");
  gaps.sort((a, b) => b.len - a.len);
  return { s, events, gaps, rate: perSecond(s, now), hall: hallLevel(s), land: [...s.land], LAND: LAND.map(l => l.id) };
}

it("a simulated Buildaroo player always has something new coming", { timeout: 60000 }, () => {
  const r = cityPlaytest(+(process.env.CITY_DAYS || 3));
  if (process.env.CITY_SIM) {
    console.log(r.events.join("\n"));
    console.log("longest quiet stretches:", r.gaps.slice(0, 8).map(g => `${(g.len / 60).toFixed(1)} min at ${(g.at / 60).toFixed(1)}m (${g.waiting})`).join("\n  "));
    console.log("goals now:", CHAPTERS[chapterIndex(r.s)]?.goals.map(g => `${g.text.replace("{n}", String(g.need))}: ${g.have(r.s)}`).join(" | "), "levels", JSON.stringify(r.s.tycoon.levels), "coins", Math.round(r.s.tycoon.coins), "builds", JSON.stringify(r.s.tycoon.builds), "sale", landOnSale(r.s)?.id, "builders", r.s.tycoon.builders);
    console.log("hall", r.hall, "land", r.land.join(","), "rate", Math.round(r.rate));
  }
  // The first ten minutes: a manager, a second business, a build.
  const firstAt = (what: string) => { const e = r.events.find(x => x.includes(what)); return e ? parseFloat(e) : Infinity; };
  expect(firstAt("manager coffee")).toBeLessThan(5);
  expect(firstAt("open flowers")).toBeLessThan(6);
  expect(firstAt("City Hall Lv 2")).toBeLessThan(40);
  expect(r.hall).toBeGreaterThanOrEqual(3);
});

// The whole story, played the way most people play an idle game (three 10-minute visits a
// day): the City Hall climbs steadily to the top in about a month, with no dead ends (every
// chapter can be finished with what's open at the time) and never more than about an hour
// of play without something new.
it("the whole City Plan can be finished, at a steady pace", { timeout: 60000 }, () => {
  const r = cityPlaytest(35);
  const hallAt = (n: number) => { const e = r.events.find(x => x.endsWith(`City Hall Lv ${n}`)); return e ? parseFloat(e) : Infinity; };
  expect(hallAt(4)).toBeLessThan(90); // in the first three days
  expect(hallAt(6)).toBeLessThan(450); // about two weeks
  expect(hallAt(10)).toBeLessThan(900); // a month
  expect(r.land).toContain("orbit");
  // (The longest wait comes before the Orbit Station, the last district.)
  expect(r.gaps.filter(g => g.waiting !== "" && !g.waiting.endsWith("end"))[0].len / 60).toBeLessThan(75);
});

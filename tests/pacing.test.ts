import { describe, expect, it } from "vitest";
import { CHAPTERS, GOAL_HOW, GOLDEN_PER_HALL, goalDone, goalName, homeBuilds, migrateChapters, type ChapterGoal } from "../src/data/chapters";
import { defaultSave, normalize } from "../src/logic/save";
import { goldenTip, hallLevel, hireManager, perSecond } from "../src/logic/tycoon";
import { BUSINESSES } from "../src/data/tycoon";
import { longestGap, playedBy, simulate } from "../scripts/pacing-model";

/** The first City Hall goal of a kind (the city game's chapters). */
const goal = (kind: NonNullable<ChapterGoal["kind"]>, biz?: string): ChapterGoal => {
  const g = CHAPTERS.flatMap(c => c.goals).find(x => x.kind === kind && (!biz || x.biz === biz));
  if (!g) throw new Error(`no ${kind} goal`);
  return g;
};

describe("City Hall goal kinds", () => {
  it("count earnings a second from the managers, without short boosts", () => {
    const s = defaultSave(), now = 1_800_000_000_000, g = goal("income");
    expect(g.cash).toBe(true);
    s.tycoon.coins = 1e6; s.tycoon.levels = { coffee: 50, flowers: 30 }; s.tycoon.last = now;
    expect(g.have(s)).toBe(0);
    hireManager(s, "coffee", now); hireManager(s, "flowers", now);
    expect(g.have(s)).toBeCloseTo(perSecond(s, now, false), 6);
    // (A grand opening doubles earnings for a while: the goal doesn't count it.)
    s.tycoon.opening = now + 60e3;
    expect(g.have(s)).toBeCloseTo(perSecond(s, now, false), 6);
    expect(g.have(s)).toBeLessThan(perSecond(s, now, true));
  });

  it("count businesses at a speed milestone level", () => {
    const s = defaultSave(), g = goal("milestone");
    expect(g.lv).toBeGreaterThan(0);
    s.tycoon.levels = { coffee: g.lv!, flowers: g.lv! - 1, bakery: g.lv! + 40 };
    expect(g.have(s)).toBe(2);
  });

  it("know a business's own HQ, and whether it's open", () => {
    const s = defaultSave(), h = goal("hq"), o = goal("biz");
    expect(h.biz).toBeTruthy();
    expect(goalName(h)).not.toBe(h.biz);
    s.tycoon.evolved = { [h.biz!]: (h.stage ?? 1) - 1 };
    expect(h.have(s)).toBe(0);
    s.tycoon.evolved = { [h.biz!]: h.stage ?? 1 };
    expect(goalDone(s, h)).toBe(true);
    expect(goalName(o)).toBe(BUSINESSES.find(b => b.id === o.biz)!.name);
    expect(o.have(s)).toBe(0);
    s.tycoon.levels[o.biz!] = 1;
    expect(goalDone(s, o)).toBe(true);
  });

  it("count homes built on lots and homes made bigger", () => {
    const s = defaultSave(), g = goal("homes");
    // A lot built twice (0 → 2), a home grown once (1 → 2), an empty lot and a home as it came.
    s.props = { "g:0,0": 2, "t:1,1": 2, "g:1,0": 0, "t:2,2": 1 };
    expect(homeBuilds(s)).toBe(3);
    expect(g.have(s)).toBe(3);
  });

  it("count the decorations standing in the city, not the ones put away", () => {
    const s = defaultSave(), g = goal("decor");
    s.placed = { pocketpark: "g:0,0", fountain: "", garden: "g:1,0" };
    expect(g.have(s)).toBe(2);
  });

  it("count every golden customer served, kept in the save", () => {
    const s = defaultSave(), g = goal("golden");
    s.tycoon.levels = { coffee: 5 };
    expect(g.have(s)).toBe(0);
    goldenTip(s); goldenTip(s);
    expect(g.have(s)).toBe(2);
    expect(normalize(JSON.parse(JSON.stringify(s))).tycoon.goldenAll).toBe(2);
    expect(normalize({}).tycoon.goldenAll).toBe(0);
  });

  it("each say how to do them, and the city game asks for at most one level count a chapter", () => {
    for (const c of CHAPTERS) for (const g of c.goals) {
      expect(g.kind && GOAL_HOW[g.kind]).toBeTruthy();
      expect(g.need).toBeGreaterThan(0);
    }
    const kinds = new Set(CHAPTERS.flatMap(c => c.goals.map(g => g.kind)));
    for (const k of ["income", "milestone", "hq", "biz", "homes", "decor", "golden", "managers"] as const) expect(kinds.has(k)).toBe(true);
  });
});

describe("saves from before the new goals", () => {
  it("keep their City Hall level, and golden customers count from it", () => {
    const s = defaultSave();
    // A City Hall level 5 player from version 3, partway through the Big City.
    s.chapters = { done: 3, seen: 3, v: 3 };
    s.tycoon.levels = { coffee: 120 };
    expect(migrateChapters(s)).toBe(true);
    expect(s.chapters).toEqual({ done: 3, seen: 3, v: 4 });
    expect(hallLevel(s)).toBe(4);
    expect(s.tycoon.goldenAll).toBe(3 * GOLDEN_PER_HALL);
    // (Only once, and a count already kept is never lowered.)
    s.tycoon.goldenAll = 50;
    expect(migrateChapters(s)).toBe(false);
    expect(s.tycoon.goldenAll).toBe(50);
  });

  it("start a brand-new player at the beginning", () => {
    const s = defaultSave();
    migrateChapters(s);
    expect(s.chapters.done).toBe(0);
    expect(s.tycoon.goldenAll).toBe(0);
  });
});

describe("pacing (the model in scripts/pacing-model.ts)", () => {
  // A big step keeps it quick; the timings move by only a minute or two from a 1-second step.
  const r = simulate({ days: 3, dt: 3, quiet: true });
  const at = (n: number) => r.hall[n];

  it("raises the City Hall on time", () => {
    // Hall 2 in about 10 minutes, Hall 3 in about 35, Hall 4 in about two hours,
    // Hall 5 within the first day or two, and the next ones about a day apart.
    expect(at(2)).toBeGreaterThanOrEqual(6); expect(at(2)).toBeLessThanOrEqual(14);
    expect(at(3)).toBeGreaterThanOrEqual(28); expect(at(3)).toBeLessThanOrEqual(45);
    expect(at(4)).toBeGreaterThanOrEqual(90); expect(at(4)).toBeLessThanOrEqual(150);
    expect(at(5)).toBeGreaterThan(6 * 60); expect(at(5)).toBeLessThanOrEqual(2 * 1440);
    expect(at(6)).toBeGreaterThan(at(5) + 8 * 60);
    expect(at(6)).toBeLessThanOrEqual(3 * 1440);
  });

  it("opens something new every little while", () => {
    expect(longestGap(r.events, 0, 180).gap).toBeLessThanOrEqual(40);
    // (Later on, measured in minutes played: every session brings something.)
    expect(longestGap(r.events, 180, 3 * 1440).gap).toBeLessThanOrEqual(60);
    // Six town businesses in the first three hours, the Sky Mall included.
    expect(r.events.filter(e => e.kind === "open" && e.min <= 180).length).toBeGreaterThanOrEqual(6);
  });

  it("counts played time, not time away", () => {
    expect(playedBy(180)).toBe(180);
    expect(playedBy(240)).toBe(180);
    expect(playedBy(250)).toBe(190);
  });
}, 120000);

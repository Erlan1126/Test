// Skyrise (the tower game on its own) tells Mayor Pip's story with towers, not businesses:
// it has no café, no business levels and no districts to buy, so a goal about those could
// never be met and the story would stop at its first page.
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/edition", () => ({
  EDITION: "skyrise",
  HAS_CITY: false,
  playerStarted: (s: { profile: { towers: number } }) => s.profile.towers >= 1,
}));

const { CHAPTERS, CHAPTERS_V, chapterReady, claimChapter, migrateChapters } = await import("../src/data/chapters");
const { defaultSave } = await import("../src/logic/save");

describe("Skyrise's story", () => {
  it("asks only for things the tower game has", () => {
    const cityOnly = ["terrace", "levels", "projects", "managers", "grown", "open", "land", "landOpen", "builds", "offices"];
    for (const c of CHAPTERS) for (const g of c.goals) {
      expect(cityOnly).not.toContain(g.kind);
      expect(g.text).not.toMatch(/business|café|terrace|manager|District/i);
    }
    expect(CHAPTERS[0].title).toBe("A city in the sky");
  });

  it("can be played from the first page to the last, paying stars and crystals", () => {
    const s = defaultSave();
    expect(claimChapter(s)).toBeNull();
    // Everything a long-time tower builder has: towers, height, people, islands, city buildings.
    s.profile.towers = 200; s.bestMeters = 600; s.profile.level = 25; s.population = 600000;
    s.city = ["cafe", "playground", "statue", "a", "b", "c", "d", "e"];
    for (const d of ["snow", "desert", "blossom"]) for (let i = 0; i < 3; i++) s.skyline.push({ f: 20, s: "classic", h: "square", d });
    const stars = s.stars, crystals = s.crystals;
    let paidStars = 0, paidCrystals = 0;
    for (const c of CHAPTERS) {
      expect(chapterReady(s)).toBe(true);
      const r = claimChapter(s)!;
      expect(r.cash).toBe(0);
      paidStars += c.reward.stars; paidCrystals += c.reward.crystals;
    }
    expect(s.chapters.done).toBe(CHAPTERS.length);
    expect(claimChapter(s)).toBeNull();
    expect(s.stars).toBe(stars + paidStars);
    expect(s.crystals).toBe(crystals + paidCrystals);
  });

  it("waits for each goal: three short towers don't finish the first chapter", () => {
    const s = defaultSave();
    s.profile.towers = 3; s.bestMeters = 20; s.profile.level = 2;
    expect(chapterReady(s)).toBe(false);
    s.bestMeters = 30;
    expect(chapterReady(s)).toBe(true);
  });

  it("moves saves from the city goals over to the tower story once, without paying again", () => {
    const s = defaultSave();
    s.chapters = { done: 2, seen: 2, v: 3 };
    s.profile.towers = 5; s.bestMeters = 40; s.profile.level = 3;
    const stars = s.stars;
    expect(migrateChapters(s)).toBe(true);
    expect(s.chapters).toEqual({ done: 1, seen: 0, v: CHAPTERS_V });
    expect(s.stars).toBe(stars);
    expect(migrateChapters(s)).toBe(false);
  });
});

describe("Skyrise's daily calendar", () => {
  it("pays stars and crystals, never cash or an advisor it has no use for", async () => {
    const { dailyReward, claimDaily } = await import("../src/logic/tycoon");
    const { GIFTS } = await import("../src/logic/rules");
    const s = defaultSave();
    for (let day = 1; day <= 7; day++) {
      const r = dailyReward(s, day);
      expect(r.cash).toBe(0);
      expect(r.advisor).toBe(false);
      expect(r.stars).toBe(GIFTS[day - 1]);
    }
    expect(dailyReward(s, 7).gems).toBe(50);
    const coins = s.tycoon.coins, crystals = s.crystals;
    const got = claimDaily(s, 7);
    expect(got).toEqual({ cash: 0, gems: 50, pick: false });
    expect(s.tycoon.coins).toBe(coins);
    expect(s.crystals).toBe(crystals + 50);
  });
});

describe("Skyrise has no mayor", () => {
  // Mayor Pip belongs to Buildaroo. Skyrise's story card is the Sky City plan, its guide
  // talks about towers only, and every line of it is translated.
  const banned = /\bPip\b|mayor|business|café terrace|manager|cash|Coffee Cart|Skyhaven/i;

  it("tells its story and guide without Pip or the company", async () => {
    const { TOWER_GUIDE, PAGE_INTRO } = await import("../src/data/guide");
    const lines = [
      ...CHAPTERS.flatMap(c => [c.title, c.intro, c.outro, ...c.goals.map(g => g.text)]),
      ...TOWER_GUIDE.flatMap(s => [s.title, ...s.rows.flatMap(r => [r.title, r.text])]),
      PAGE_INTRO.goals, PAGE_INTRO.shop, PAGE_INTRO.me,
    ];
    expect(lines.filter(l => banned.test(l))).toEqual([]);
    expect(TOWER_GUIDE.flatMap(s => s.rows).length).toBeGreaterThan(10);
  });

  it("has every story and guide line in Spanish, Portuguese, French and German", async () => {
    const { TOWER_GUIDE, PAGE_INTRO } = await import("../src/data/guide");
    const { dictionary } = await import("../src/i18n");
    const lines = [
      ...CHAPTERS.flatMap(c => [c.title, c.intro, c.outro, ...c.goals.map(g => g.text)]),
      ...TOWER_GUIDE.flatMap(s => [s.title, ...s.rows.flatMap(r => [r.title, r.text])]),
      PAGE_INTRO.goals, "Zephyr", "Back to building!",
    ];
    for (const l of ["es", "pt", "fr", "de"] as const) {
      const d = dictionary(l);
      expect(lines.filter(k => !d[k]), l).toEqual([]);
    }
  });

  it("has its own city, Cloudreach, not Buildaroo's Skyhaven", async () => {
    const { CITY_NAME } = await import("../src/logic/city");
    expect(CITY_NAME).toBe("Cloudreach");
  });

  it("draws Zephyr, not Pip", async () => {
    const { MAYOR_SVG, zephyrSvg } = await import("../src/ui/mayor");
    expect(MAYOR_SVG).toBe("");
    const a = zephyrSvg(), b = zephyrSvg("happy");
    expect(a).toContain("<svg");
    expect(a).not.toMatch(/mp-hat|mp-skin/);
    expect(b).toContain("sp-sparkle");
    // Two copies on screen at once keep their own gradients.
    expect(a.match(/id="(zp\d+)-sky"/)![1]).not.toBe(b.match(/id="(zp\d+)-sky"/)![1]);
  });
});

describe("Skyrise's sky layers", () => {
  it("start where the sky changes colour, lowest first, and are all translated", async () => {
    const { SKY_LAYERS, layerAt, layerForMeters } = await import("../src/data/layers");
    const { SKY } = await import("../src/data/constants");
    const { dictionary } = await import("../src/i18n");
    expect(SKY_LAYERS.map(l => l.at)).toEqual(SKY.map(s => s.at));
    expect(layerAt(0)).toBe(0);
    expect(layerAt(21)).toBe(0);
    expect(layerAt(22)).toBe(1);
    expect(layerAt(500)).toBe(SKY_LAYERS.length - 1);
    expect(layerForMeters(110)).toBe(1);
    expect(layerForMeters(109)).toBe(0);
    for (const l of ["es", "pt", "fr", "de"] as const) {
      const d = dictionary(l);
      expect(SKY_LAYERS.flatMap(x => [x.name, x.zephyr]).filter(k => !d[k]), l).toEqual([]);
    }
  });

  it("each earn a tower of their own the first time a tower climbs into them", async () => {
    const { SKINS } = await import("../src/data/skins");
    const { isSkinUnlocked, skinUnlockText } = await import("../src/logic/progress");
    const { SKY_LAYERS } = await import("../src/data/layers");
    const { dictionary } = await import("../src/i18n");
    const layered = SKINS.filter(s => s.unlock && "layer" in s.unlock);
    expect(layered.map(s => (s.unlock as { layer: number }).layer)).toEqual([1, 2, 3, 4]);
    const save = defaultSave();
    save.bestMeters = SKY_LAYERS[2].at * 5 - 1;
    expect(layered.map(s => isSkinUnlocked(save, s))).toEqual([true, false, false, false]);
    save.bestMeters = SKY_LAYERS[2].at * 5;
    expect(layered.map(s => isSkinUnlocked(save, s))).toEqual([true, true, false, false]);
    expect(skinUnlockText(layered[3])).toBe("Climb into the ✨ Starfield (90 floors)");
    for (const l of ["es", "pt", "fr", "de"] as const) expect(layered.filter(s => !dictionary(l)[s.name]), l).toEqual([]);
  });
});

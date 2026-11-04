import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { deviceLang, dictionary, setLang, t, tn } from "../src/i18n";
import { ES } from "../src/i18n/es";
import { seeded } from "../src/core/rng";
import { CHALLENGES } from "../src/data/challenges";
import { MILESTONES } from "../src/data/constants";
import { CITY, LEAGUES } from "../src/data/daily";
import { EVENTS } from "../src/data/events";
import { ISLAND_THEMES, ISLAND_UPGRADES } from "../src/data/islands";
import { SEASON_THEMES } from "../src/data/pass";
import { PRODUCTS } from "../src/data/premium";
import { BOOSTS } from "../src/data/shop";
import { SKINS } from "../src/data/skins";
import { TROPHIES } from "../src/data/trophies";
import { FEATURE_NAMES } from "../src/logic/features";
import { dealMissions, recordRun } from "../src/logic/progress";
import { defaultSave, normalize } from "../src/logic/save";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

/** Every string literal passed to t() or tn() in the game's source. */
function sourceKeys(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== "i18n") walk(p); } else if (p.endsWith(".ts")) files.push(p);
    }
  };
  walk(join(__dirname, "../src"));
  const str = String.raw`"((?:[^"\\]|\\.)*)"`;
  const keys = new Set<string>();
  const unquote = (s: string) => JSON.parse(`"${s}"`) as string;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*` + str, "g"))) keys.add(unquote(m[1]));
    for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*` + str + String.raw`,\s*` + str, "g"))) { keys.add(unquote(m[1])); keys.add(unquote(m[2])); }
    // t(cond ? "a" : "b", ...)
    for (const m of src.matchAll(new RegExp(String.raw`\bt\([^"()]+\?\s*` + str + String.raw`\s*:\s*` + str, "g"))) { keys.add(unquote(m[1])); keys.add(unquote(m[2])); }
  }
  return [...keys];
}

describe("translations", () => {
  afterEach(() => { setLang("en"); });

  it("uses the English text as the key and fills placeholders", () => {
    setLang("en");
    expect(t("Builder level {n}", { n: 4 })).toBe("Builder level 4");
    setLang("es");
    expect(t("Builder level {n}", { n: 4 })).toBe("Nivel de constructor 4");
    expect(t("{n} of {total} complete", { n: 2, total: 6 })).toBe("2 de 6 completados");
  });

  it("falls back to English for anything without a translation", () => {
    setLang("es");
    expect(t("Not a real string {x}", { x: 1 })).toBe("Not a real string 1");
    expect(t("Skyrise")).toBe("Skyrise");
  });

  it("leaves unknown placeholders alone and picks plurals", () => {
    setLang("en");
    expect(t("Daily #{n}")).toBe("Daily #{n}");
    expect(tn(1, "{n} streak freeze", "{n} streak freezes")).toBe("1 streak freeze");
    expect(tn(2, "{n} streak freeze", "{n} streak freezes")).toBe("2 streak freezes");
    setLang("es");
    expect(tn(2, "{n} streak freeze", "{n} streak freezes")).toBe("2 protectores de racha");
  });

  it("keeps every placeholder of the English key in Spanish", () => {
    const bad = Object.entries(ES).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join() || !v.trim());
    expect(bad).toEqual([]);
  });

  it("keeps simple markup the same", () => {
    const tags = (s: string) => [...s.matchAll(/<\/?\w+>/g)].map(m => m[0]).sort().join();
    expect(Object.entries(ES).filter(([k, v]) => tags(k) !== tags(v))).toEqual([]);
  });

  it("has Spanish for every string the game translates", () => {
    const keys = sourceKeys();
    expect(keys.length).toBeGreaterThan(250);
    expect(keys.filter(k => !(k in ES))).toEqual([]);
  });

  it("has Spanish for every name and description players see", () => {
    const names = [
      ...SKINS.map(s => s.name), ...MILESTONES.map(m => m.name), ...LEAGUES.map(l => l.name), ...BOOSTS.flatMap(b => [b.name, b.text]),
      ...CHALLENGES.flatMap(c => [c.name, c.text]), ...CITY.flatMap(b => [b.name, b.text]), ...EVENTS.flatMap(e => [e.name, e.text]),
      ...ISLAND_THEMES.map(i => i.name), ...ISLAND_UPGRADES.map(u => u.name), ...SEASON_THEMES.flatMap(s => [s.name, s.text]),
      ...PRODUCTS.flatMap(p => [p.name, p.text]), ...TROPHIES.flatMap(tr => [tr.name, tr.text]), ...Object.values(FEATURE_NAMES),
    ];
    expect(names.filter(n => !(n in dictionary("es")))).toEqual([]);
  });

  it("picks Spanish for any Spanish locale and English otherwise", () => {
    expect(deviceLang(["es-MX"])).toBe("es");
    expect(deviceLang(["es-US", "en-US"])).toBe("es");
    expect(deviceLang(["es"])).toBe("es");
    expect(deviceLang(["en-US", "es-MX"])).toBe("en");
    expect(deviceLang(["fr-FR", "es-ES"])).toBe("es");
    expect(deviceLang(["de-DE"])).toBe("en");
    expect(deviceLang([])).toBe("en");
  });

  it("writes reward lines in the chosen language", () => {
    setLang("es");
    const s = defaultSave();
    dealMissions(s, seeded(1));
    const out = recordRun(s, { mode: "classic", score: 300, floors: 12, meters: 60, perfects: 2, bestStreak: 2, penthouses: 0, windFloors: 0, afterRewind: 0, rewindsUsed: 0 }, Date.now(), seeded(2));
    expect(out.rewards.some(r => r.text === "Trofeo: Primera Piedra (+1 ★)" && r.group === "trophy" && r.name === "Primera Piedra")).toBe(true);
    expect(out.rewards.some(r => r.text === "Nuevos aspectos desbloqueados: Bloque de Ladrillo y Brisa Marina")).toBe(true);
  });

  it("stores the language setting in the save", () => {
    expect(defaultSave().settings.lang).toBe("auto");
    expect(normalize({ settings: { lang: "es" } }).settings.lang).toBe("es");
    expect(normalize({ settings: { lang: "klingon" } }).settings.lang).toBe("auto");
  });
});

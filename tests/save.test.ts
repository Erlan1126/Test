import { describe, expect, it } from "vitest";
import { backupIsAhead, defaultSave, exportCode, importCode, loadSave, migrateLegacy, normalize, SAVE_KEY, writeSave } from "../src/logic/save";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};

describe("save data", () => {
  it("starts fresh with sensible defaults", () => {
    const s = loadSave(memory());
    expect(s).toEqual(defaultSave());
  });

  it("survives garbage and keeps what's valid", () => {
    const s = normalize({ best: "lots", bestMeters: 120, stars: -5, skin: "nope", missions: { slots: [{ t: "fake" }, { t: "towers", n: 3, r: 1, p: 1 }] }, history: "x" });
    expect(s.best).toBe(0);
    expect(s.bestMeters).toBe(120);
    expect(s.stars).toBe(0);
    expect(s.skin).toBe("glass");
    expect(s.missions.slots).toEqual([{ t: "towers", n: 3, r: 1, p: 1 }]);
    expect(s.history).toEqual([]);
  });

  it("round-trips through storage", () => {
    const store = memory();
    const s = defaultSave();
    s.best = 1234; s.ownedSkins = ["rainbow"]; s.profile.trophies = ["first"];
    writeSave(store, s);
    expect(loadSave(store)).toEqual(s);
    expect(store.data[SAVE_KEY]).toBeTruthy();
  });

  it("brings over progress from the first version", () => {
    const old = memory({
      skyriseBest: "2301",
      skyriseBestMeters: "370",
      skyriseSkin: "neon",
      skyriseMissions: JSON.stringify({ slots: [{ t: "streak", n: 6, r: 2, p: 4 }], done: 5, stars: 27, seen: 5 }),
      skyriseProfile: JSON.stringify({ xp: 40, level: 4, towers: 12, trophies: ["first", "s10"], gift: { last: "2026-10-30", streak: 3 }, island: "snow" }),
      skyriseMuted: "1",
      skyriseTutorial: "done",
    });
    const s = loadSave(old);
    expect(s.best).toBe(2301);
    expect(s.bestMeters).toBe(370);
    expect(s.skin).toBe("neon");
    expect(s.stars).toBe(27);
    // 27 stars had unlocked the 10 and 25 star skins under the old rules, and a 370 m
    // tower the height skins up to Neon Nights (kept although they need taller towers now).
    expect(s.ownedSkins.sort()).toEqual(["brick", "bridge", "candy", "desert", "neon", "ocean", "rainbow", "retro", "starlight"]);
    expect(s.profile.level).toBe(4);
    expect(s.profile.trophies).toEqual(["first", "s10"]);
    expect(s.island).toBe("snow");
    expect(s.settings.sound).toBe(false);
    expect(s.tutorialDone).toBe(true);
    expect(s.missions.slots[0].p).toBe(4);
  });

  it("ignores old data when there isn't any", () => {
    expect(migrateLegacy(() => null)).toBeNull();
  });

  it("moves progress with a transfer code and rejects broken ones", () => {
    const s = defaultSave();
    s.best = 999; s.stars = 42; s.profile.level = 7; s.history = [{ score: 999, meters: 200, floors: 40, mode: "classic", day: "2026-10-31" }];
    const code = exportCode(s);
    expect(code.startsWith("SKY2-")).toBe(true);
    expect(importCode(code)).toEqual(s);
    expect(importCode(`  ${code.slice(0, 20)}\n${code.slice(20)} `)).toEqual(s); // pasted with line breaks
    expect(importCode(code.slice(0, -3) + "abc")).toBeNull();
    expect(importCode(code.replace("SKY2-", "SKY2-A"))).toBeNull();
    expect(importCode("hello")).toBeNull();
  });
});

describe("the native backup", () => {
  it("comes back when the phone cleared the web copy, in the city game too (no towers)", () => {
    const cleared = defaultSave();
    const city = defaultSave();
    city.tycoon.lifetime = 50_000;
    expect(backupIsAhead(JSON.parse(JSON.stringify(city)), cleared)).toBe(true);
    const tower = defaultSave();
    tower.profile.towers = 5;
    expect(backupIsAhead(tower, cleared)).toBe(true);
  });

  it("never replaces a save that is as far along or further, or with junk", () => {
    const now = defaultSave();
    now.tycoon.lifetime = 50_000;
    const older = defaultSave();
    older.tycoon.lifetime = 40_000;
    expect(backupIsAhead(older, now)).toBe(false);
    expect(backupIsAhead(now, now)).toBe(false);
    expect(backupIsAhead(null, now)).toBe(false);
    expect(backupIsAhead("x", now)).toBe(false);
    expect(backupIsAhead({ tycoon: { lifetime: "9e9" } }, now)).toBe(false);
    // More towers here wins over a richer backup with fewer (the tower game's rule).
    now.profile.towers = 3;
    const fewer = defaultSave();
    fewer.tycoon.lifetime = 1e9;
    expect(backupIsAhead(fewer, now)).toBe(false);
  });
});

it("keeps the accessibility settings (off for a new player and for older saves)", () => {
  const s = defaultSave();
  expect([s.settings.bigText, s.settings.oneHand, s.settings.still]).toEqual([false, false, false]);
  const old = JSON.parse(JSON.stringify(s)); delete old.settings.bigText; delete old.settings.oneHand; delete old.settings.still;
  expect(normalize(old).settings.bigText).toBe(false);
  s.settings.bigText = true; s.settings.oneHand = true; s.settings.still = true;
  const back = normalize(JSON.parse(JSON.stringify(s))).settings;
  expect([back.bigText, back.oneHand, back.still]).toEqual([true, true, true]);
});

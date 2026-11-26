import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { builderCount, buildTime, completeBuilds, finishNow, finishPrice, freeBuilders, hireBuilder, startBuild, TERRACE_PRICE, BUILDER_PRICES } from "../src/logic/builds";
import { officeFloors, OFFICE_BLOCK_FLOORS } from "../src/logic/tycoon";
import { startingBuilding } from "../src/logic/cafe";

const T0 = 1_800_000_000_000;

describe("builders and build time", () => {
  it("a build takes a builder and real time, and pays its cash up front", () => {
    const s = defaultSave();
    s.tycoon.coins = 1e6;
    const before = officeFloors(s);
    expect(builderCount(s, T0)).toBe(1);
    expect(startBuild(s, "office", "", T0)).toBe("ok");
    expect(s.tycoon.coins).toBeLessThan(1e6);
    expect(freeBuilders(s, T0)).toBe(0);
    // Only one builder: a second build has to wait.
    s.cafe.starter = startingBuilding();
    expect(startBuild(s, "terrace", "", T0)).toBe("busy");
    expect(officeFloors(s)).toBe(before); // not done yet
    const t = buildTime(s, "office", "", T0);
    expect(completeBuilds(s, T0 + t - 1)).toEqual([]);
    expect(completeBuilds(s, T0 + t).length).toBe(1);
    expect(officeFloors(s)).toBe(before + OFFICE_BLOCK_FLOORS);
    expect(freeBuilders(s, T0 + t)).toBe(1);
  });

  it("crystals finish a build now, about one for every two minutes left", () => {
    const s = defaultSave();
    s.tycoon.coins = 100;
    s.cafe.starter = startingBuilding();
    expect(startBuild(s, "terrace", "", T0)).toBe("ok");
    expect(s.tycoon.coins).toBe(100 - TERRACE_PRICE);
    expect(finishPrice(10e3)).toBe(1);
    expect(finishPrice(60 * 60e3)).toBe(30);
    s.crystals = 0;
    expect(finishNow(s, "terrace", "", T0)).toBe("short");
    s.crystals = 5;
    expect(finishNow(s, "terrace", "", T0)).toBe("ok");
    expect(s.cafe.terrace).toBe(1); // ready to open
    expect(s.crystals).toBe(4);
  });

  it("more builders can be hired with crystals, and builds survive a save", () => {
    const s = defaultSave();
    s.crystals = 1000;
    expect(hireBuilder(s)).toBe("ok");
    expect(s.crystals).toBe(1000 - BUILDER_PRICES[0]);
    expect(builderCount(s, T0)).toBe(2);
    expect(hireBuilder(s)).toBe("ok");
    expect(hireBuilder(s)).toBe("max");
    s.tycoon.coins = 1e6;
    startBuild(s, "office", "", T0);
    const back = normalize(JSON.parse(JSON.stringify(s)));
    expect(back.tycoon.builders).toBe(2);
    expect(back.tycoon.builds.length).toBe(1);
  });
});

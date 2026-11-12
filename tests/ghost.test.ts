import { describe, expect, it } from "vitest";
import { cleanPace, ghostFloors } from "../src/logic/ghost";

describe("ghost racing", () => {
  it("counts the floors a ghost had built by a given tick", () => {
    const pace = [100, 220, 300, 450];
    expect(ghostFloors(pace, 0)).toBe(0);
    expect(ghostFloors(pace, 100)).toBe(1);
    expect(ghostFloors(pace, 299)).toBe(2);
    expect(ghostFloors(pace, 10_000)).toBe(4);
  });

  it("keeps only a sane pace from saved or downloaded data", () => {
    expect(cleanPace([1, 5, 5.7, 9])).toEqual([1, 5, 5, 9]);
    expect(cleanPace([10, 3, 20])).toEqual([10]);        // stops where it goes backwards
    expect(cleanPace(["x", 2])).toEqual([]);
    expect(cleanPace("nope")).toEqual([]);
    expect(cleanPace(Array.from({ length: 5000 }, (_, i) => i))).toHaveLength(1000);
  });
});

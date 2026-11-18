import { expect, it } from "vitest";
import { bestRun, dropGrid, MAX_ROWS, ROW, type Drop } from "../src/logic/dailycard";

it("the Daily result is a grid of squares: one per floor, ten to a row", () => {
  const drops: Drop[] = ["P", "P", "W", "T", "P", "P", "P", "W", "P", "P", "T", "P"];
  expect(dropGrid(drops)).toEqual(["🟩🟩🟨🟧🟩🟩🟩🟨🟩🟩", "🟧🟩"]);
  expect(bestRun(drops)).toBe(3);
  expect(dropGrid([])).toEqual([]);
});

it("a very tall tower stays short to share", () => {
  const drops: Drop[] = Array.from({ length: ROW * MAX_ROWS + 7 }, () => "P");
  const g = dropGrid(drops);
  expect(g).toHaveLength(MAX_ROWS);
  expect(g[MAX_ROWS - 1].endsWith(" +7")).toBe(true);
});

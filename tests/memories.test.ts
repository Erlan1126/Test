import { beforeEach, describe, expect, it } from "vitest";
import { loadMemories, saveMemory } from "../src/ui/memories";

// A tiny in-memory localStorage for the node test environment.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
});

describe("Skyhaven remembers", () => {
  it("keeps the first picture of each rank and never replaces it", () => {
    expect(saveMemory(0, "data:image/jpeg;base64,AAA")).toBe(true);
    expect(saveMemory(0, "data:image/jpeg;base64,BBB")).toBe(false);
    expect(saveMemory(2, null)).toBe(false);
    const m = loadMemories();
    expect(Object.keys(m)).toEqual(["0"]);
    expect(m[0].img).toBe("data:image/jpeg;base64,AAA");
  });

  it("ignores anything that isn't a picture for a real rank", () => {
    store.set("skyrise.memories.v1", JSON.stringify({ 0: { img: "javascript:alert(1)", at: 1 }, 99: { img: "data:image/png;base64,A", at: 1 }, 3: { img: "data:image/png;base64,A", at: 5 } }));
    expect(Object.keys(loadMemories())).toEqual(["3"]);
    store.set("skyrise.memories.v1", "not json");
    expect(loadMemories()).toEqual({});
  });
});

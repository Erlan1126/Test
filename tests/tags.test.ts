import { describe, expect, it } from "vitest";
import { pickTags, TAG_CAP, type TagIn, type TagKind, type TagOpts } from "../src/logic/tags";

const tag = (kind: TagKind, x: number, y: number, more: Partial<TagIn> = {}): TagIn => ({ kind, x, y, w: 40, h: 40, ...more });
const mid: TagOpts = { cx: 200, cy: 400, close: false };
const pick = (items: TagIn[], o: TagOpts) => pickTags(items, o).show;

describe("town bubbles", () => {
  it("hide the plain level bubbles unless the player looks closely", () => {
    const items = [tag("info", 100, 300), tag("grow", 300, 300)];
    expect(pick(items, mid)).toEqual([false, true]);
    expect(pick(items, { ...mid, close: true })).toEqual([true, true]);
  });

  it("show at most a handful, the most urgent first", () => {
    const items: TagIn[] = [];
    for (let i = 0; i < 12; i++) items.push(tag(i < 2 ? "event" : i < 6 ? "grow" : "sale", 30 + (i % 6) * 60, 200 + Math.floor(i / 6) * 120));
    const shown = pick(items, mid);
    expect(shown.filter(Boolean).length).toBe(TAG_CAP);
    expect(shown[0] && shown[1]).toBe(true); // both events
    expect(shown.slice(6).some(Boolean)).toBe(false); // no sale tag beats a growth one
  });

  it("break ties by distance to the middle of the screen", () => {
    const items = [tag("grow", 20, 100), tag("grow", 200, 420), tag("grow", 380, 800)];
    expect(pick(items, { ...mid, cap: 1 })).toEqual([false, true, false]);
  });

  it("never put two bubbles on top of each other: the less urgent one moves up, or goes", () => {
    const items = [tag("sale", 200, 400), tag("event", 210, 410), tag("ask", 400, 100)];
    const r = pickTags(items, mid);
    expect(r.show).toEqual([true, true, true]);
    expect(r.y[1]).toBe(410);
    expect(r.y[0]).toBeLessThanOrEqual(410 - 40 + 2);
    // (No room above, under the money bar: it goes.)
    expect(pick(items, { ...mid, top: 350 })).toEqual([false, true, true]);
  });

  it("always keep the selected building's bubble, and only it while its card is open", () => {
    const items = [tag("info", 200, 400, { pin: true }), tag("event", 300, 200)];
    expect(pick(items, { ...mid, focus: true })).toEqual([true, false]);
    expect(pick(items, mid)).toEqual([true, true]);
  });

  it("skip bubbles that are off screen without counting them", () => {
    const items = [tag("event", -100, 400, { out: true }), tag("grow", 200, 400)];
    expect(pick(items, { ...mid, cap: 1 })).toEqual([false, true]);
  });

  it("let a bubble already showing hold its place against a slightly closer one", () => {
    const items = [tag("grow", 200, 470, { was: true }), tag("grow", 200, 420)];
    expect(pick(items, { ...mid, cap: 1 })).toEqual([true, false]);
  });
});

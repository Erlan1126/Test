import { describe, expect, it } from "vitest";
import { defaultSave, normalize } from "../src/logic/save";
import { buyEventPass, cityEvent, claimEventStep, eventPoints, eventPrize, eventReady, EVENT_PASS_CRYSTALS, EVENT_STEPS } from "../src/logic/cityevent";

const T0 = 1_800_000_000_000;

describe("the weekly city event", () => {
  it("earns points for growing the city and pays its milestones once, the last with the week's decoration", () => {
    const s = defaultSave();
    expect(eventReady(s, T0)).toEqual([]);
    eventPoints(s, "build", 3, T0); // 45
    expect(eventReady(s, T0)).toEqual([0]);
    const c0 = s.crystals;
    expect(claimEventStep(s, 0, T0)?.crystals).toBe(EVENT_STEPS[0].crystals);
    expect(s.crystals).toBe(c0 + EVENT_STEPS[0].crystals);
    expect(claimEventStep(s, 0, T0)).toBeNull();
    eventPoints(s, "level", 1000, T0);
    const last = EVENT_STEPS.length - 1;
    const r = claimEventStep(s, last, T0)!;
    expect(r.decor).toBe(eventPrize(T0).id);
    expect(s.decor).toContain(eventPrize(T0).id);
    expect(normalize(JSON.parse(JSON.stringify(s))).cityEvent.claimed).toContain(last);
  });

  it("starts over each week, and the pass doubles points", () => {
    const s = defaultSave();
    eventPoints(s, "home", 1, T0);
    expect(cityEvent(s, T0).pts).toBe(8);
    expect(cityEvent(s, T0 + 8 * 864e5).pts).toBe(0);
    s.crystals = EVENT_PASS_CRYSTALS;
    expect(buyEventPass(s, T0 + 8 * 864e5)).toBe("ok");
    expect(eventPoints(s, "home", 1, T0 + 8 * 864e5)).toBe(16);
    expect(buyEventPass(s, T0 + 8 * 864e5)).toBe("owned");
  });
});

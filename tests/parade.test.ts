import { describe, expect, it } from "vitest";
import {
  PARADE_EVERY_MS, PARADE_FIRST_MS, PARADE_FLOATS, PARADE_MS, PARADE_TIP_MIN, PARADE_TIP_SECONDS,
  newParade, paradeDue, paradeRunning, paradeSeason, paradeTipValue, startParade, tipFloat,
} from "../src/logic/parade";

const DEC5 = new Date(2026, 11, 5, 18, 0).getTime();
const JAN3 = new Date(2027, 0, 3, 12, 0).getTime();
const JUL1 = new Date(2026, 6, 1, 12, 0).getTime();
const NOV30 = new Date(2026, 10, 30, 12, 0).getTime();
const JAN7 = new Date(2027, 0, 7, 12, 0).getTime();

describe("holiday parade: only in Winter Lights", () => {
  it("is on from Dec 1 to Jan 6 and off otherwise", () => {
    expect(paradeSeason(DEC5)).toBe(true);
    expect(paradeSeason(JAN3)).toBe(true);
    expect(paradeSeason(JUL1)).toBe(false);
    expect(paradeSeason(NOV30)).toBe(false);
    expect(paradeSeason(JAN7)).toBe(false);
  });
  it("never starts or comes due out of season", () => {
    const st = newParade();
    expect(startParade(st, JUL1)).toBe(false);
    expect(st.at).toBe(0);
    expect(paradeDue(st, JUL1)).toBe(false);
    expect(paradeDue(st, JUL1 + 10 * PARADE_EVERY_MS)).toBe(false);
    expect(st.next).toBe(0);
  });
  it("starts during Winter Lights (an Advent door's parade too)", () => {
    const st = newParade();
    expect(startParade(st, DEC5)).toBe(true);
    expect(paradeRunning(st, DEC5 + 1000)).toBe(true);
  });
});

describe("holiday parade: timing", () => {
  it("the first look schedules the first parade a little later", () => {
    const st = newParade();
    expect(paradeDue(st, DEC5)).toBe(false);
    expect(st.next).toBe(DEC5 + PARADE_FIRST_MS);
    expect(paradeDue(st, DEC5 + PARADE_FIRST_MS - 1)).toBe(false);
    expect(paradeDue(st, DEC5 + PARADE_FIRST_MS)).toBe(true);
  });
  it("runs for PARADE_MS, then the next one comes PARADE_EVERY_MS after the last start", () => {
    const st = newParade();
    startParade(st, DEC5);
    expect(paradeRunning(st, DEC5 + PARADE_MS - 1)).toBe(true);
    expect(paradeRunning(st, DEC5 + PARADE_MS)).toBe(false);
    expect(paradeDue(st, DEC5 + PARADE_MS + 1)).toBe(false);
    expect(paradeDue(st, DEC5 + PARADE_EVERY_MS - 1)).toBe(false);
    expect(paradeDue(st, DEC5 + PARADE_EVERY_MS)).toBe(true);
    expect(PARADE_EVERY_MS).toBeGreaterThan(PARADE_MS);
  });
  it("one at a time: no new parade while one is going", () => {
    const st = newParade();
    startParade(st, DEC5);
    expect(startParade(st, DEC5 + 5000)).toBe(false);
    expect(st.at).toBe(DEC5);
    expect(paradeDue(st, DEC5 + 5000)).toBe(false);
    // (Once it's over, an Advent door can start the next one early, and the timer resets.)
    expect(startParade(st, DEC5 + PARADE_MS + 10)).toBe(true);
    expect(st.next).toBe(DEC5 + PARADE_MS + 10 + PARADE_EVERY_MS);
  });
});

describe("holiday parade: tips", () => {
  it("each float tips once per parade", () => {
    const st = newParade();
    startParade(st, DEC5);
    const rate = 100;
    expect(tipFloat(st, 0, rate, DEC5 + 1000)).toBe(rate * PARADE_TIP_SECONDS);
    expect(tipFloat(st, 0, rate, DEC5 + 2000)).toBe(0);
    expect(tipFloat(st, 3, rate, DEC5 + 2000)).toBe(rate * PARADE_TIP_SECONDS);
    expect(st.tipped).toEqual([0, 3]);
    // A new parade: every float can tip again.
    startParade(st, DEC5 + PARADE_EVERY_MS);
    expect(st.tipped).toEqual([]);
    expect(tipFloat(st, 0, rate, DEC5 + PARADE_EVERY_MS + 1000)).toBe(rate * PARADE_TIP_SECONDS);
  });
  it("no tips with no parade on, or for a float that isn't one", () => {
    const st = newParade();
    expect(tipFloat(st, 0, 100, DEC5)).toBe(0);
    startParade(st, DEC5);
    expect(tipFloat(st, -1, 100, DEC5 + 1)).toBe(0);
    expect(tipFloat(st, PARADE_FLOATS.length, 100, DEC5 + 1)).toBe(0);
    expect(tipFloat(st, 1.5, 100, DEC5 + 1)).toBe(0);
    expect(tipFloat(st, 1, 100, DEC5 + PARADE_MS + 1)).toBe(0);
  });
});

describe("holiday parade: payout", () => {
  it("is a few seconds of income", () => {
    expect(PARADE_TIP_SECONDS).toBeGreaterThanOrEqual(3);
    expect(PARADE_TIP_SECONDS).toBeLessThanOrEqual(15);
    expect(paradeTipValue(250)).toBe(250 * PARADE_TIP_SECONDS);
    expect(paradeTipValue(12.4)).toBe(Math.round(12.4 * PARADE_TIP_SECONDS));
  });
  it("never less than the minimum, and safe with a bad rate", () => {
    expect(paradeTipValue(0)).toBe(PARADE_TIP_MIN);
    expect(paradeTipValue(NaN)).toBe(PARADE_TIP_MIN);
    expect(paradeTipValue(Infinity)).toBe(PARADE_TIP_MIN);
  });
  it("there are four floats: a present, a snowman, gingerbread and a sleigh", () => {
    expect([...PARADE_FLOATS]).toEqual(["present", "snowman", "gingerbread", "sleigh"]);
  });
});

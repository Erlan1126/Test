// A finished tower can be checked by replaying it: the seed decides every floor, and the
// log says at which fixed step each tap happened. The game server runs this same code to
// make sure a score posted to the online rankings was really built.
import { challengeById } from "../data/challenges";
import { EVENTS } from "../data/events";
import { seeded } from "../core/rng";
import { RULES, TowerSim } from "./sim";
import type { Mode, RunSummary } from "./types";

/** In the log: a drop is the step number it happened at; a rewind is -1. */
export const REWIND = -1;

export interface RunRecord {
  v: 1;
  mode: Mode;
  seed: number;
  /** The weekly event's week, for Classic and Daily towers. */
  week: number;
  /** Daily tower number (the seed of a Daily tower comes from it). */
  day: number;
  challenge?: string;
  boosts: { rewind: boolean; gold: boolean };
  /** Rules version it was played with (see RULES in sim.ts); 1 when missing. */
  rules?: number;
  log: number[];
}

/** One hour of play at most. */
const MAX_TICKS = 120 * 60 * 60;
const MAX_EVENTS = 5000;

export function simFor(rec: Pick<RunRecord, "mode" | "seed" | "week" | "challenge" | "boosts" | "rules">, xpMultiplier = 1): TowerSim {
  const event = rec.mode === "classic" || rec.mode === "daily"
    ? EVENTS[((rec.week % EVENTS.length) + EVENTS.length) % EVENTS.length] : null;
  const challenge = rec.mode === "challenge" ? challengeById(rec.challenge ?? "") ?? null : null;
  return new TowerSim({
    mode: rec.mode,
    rng: seeded(rec.seed),
    event,
    challenge,
    rewinds: 1 + (rec.boosts.rewind ? 1 : 0),
    goldBoost: rec.boosts.gold,
    xpMultiplier,
    rules: rec.rules ?? 1,
  });
}

export type ReplayResult = { ok: true; summary: RunSummary; ticks: number } | { ok: false; reason: string };

/** Rebuilds a tower from its record. Anything a real game couldn't produce is rejected. */
export function replayRun(rec: RunRecord): ReplayResult {
  if (rec?.v !== 1 || !Array.isArray(rec.log)) return { ok: false, reason: "bad record" };
  if (rec.rules !== undefined && (!Number.isInteger(rec.rules) || rec.rules < 1 || rec.rules > RULES)) return { ok: false, reason: "unknown rules" };
  if (!["classic", "daily", "challenge", "zen"].includes(rec.mode)) return { ok: false, reason: "bad mode" };
  if (!Number.isInteger(rec.seed) || !Number.isInteger(rec.week) || !Number.isInteger(rec.day)) return { ok: false, reason: "bad numbers" };
  if (rec.mode === "challenge" && !challengeById(rec.challenge ?? "")) return { ok: false, reason: "bad challenge" };
  if (rec.log.length > MAX_EVENTS) return { ok: false, reason: "too long" };
  const sim = simFor(rec);
  for (const e of rec.log) {
    if (e === REWIND) {
      if (sim.mover || !sim.canRewind()) return { ok: false, reason: "bad rewind" };
      sim.rewind();
      continue;
    }
    if (!Number.isInteger(e) || e < sim.ticks || e > MAX_TICKS) return { ok: false, reason: "bad step" };
    if (!sim.mover) return { ok: false, reason: "drop after the end" };
    while (sim.ticks < e) sim.step();
    sim.drop();
  }
  return { ok: true, summary: sim.summary(), ticks: sim.ticks };
}

/** Records taps while a tower is built. */
export class RunRecorder {
  readonly rec: RunRecord;
  constructor(base: Omit<RunRecord, "v" | "log">) {
    this.rec = { v: 1, rules: RULES, ...base, log: [] };
  }
  drop(ticks: number): void { this.rec.log.push(ticks); }
  rewind(): void { this.rec.log.push(REWIND); }
}

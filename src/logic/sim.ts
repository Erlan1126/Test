// The tower itself: the sliding floor, drops, scoring and special floors. No drawing or
// DOM here, so the rules can be tested directly.
import type { Rng } from "../core/rng";
import { clamp } from "../core/util";
import { BLOCK_SIZE, GROW, RANGE } from "../data/constants";
import type { Challenge } from "../data/challenges";
import type { WeekEvent } from "../data/events";
import { floorSpeed, floorSpeed4, landmarkIndex, metersFor, peopleIn, perfectWindow, windAt, type Box } from "./rules";
import type { Mode, RunSummary } from "./types";

/**
 * gold: a penthouse, faster, worth 5x on a perfect drop.
 * ice: slides faster, worth 50% more people.
 * garden: slides slowly, holds half the people, but widens the tower back out.
 */
export type FloorKind = "normal" | "gold" | "ice" | "garden" | "shrink" | "magnet" | "ghost";

/**
 * Power-ups ride on some floors and are yours when that floor lands (a miss loses it).
 * slow: the next floors slide slower. wide: the next floors are easier to land perfectly.
 * steady: no wind gusts for a while.
 */
export type PowerUp = "slow" | "wide" | "steady";
export const POWER_FLOORS: Record<PowerUp, number> = { slow: 4, wide: 4, steady: 6 };

/** Rules versions: 1 is the original game; 2 adds shrinking, magnet and foggy floors and
 *  power-ups. Every recorded tower says which rules it was played with.
 *  3 softens shrinking floors (they lose at most 25% of their width, not 45%) and lets a
 *  narrow tower win width back on both sides with perfect drops in a row.
 *  4 starts floors a little faster and speeds them up sooner (floorSpeed4).
 */
export const RULES = 4;

export interface Floor extends Box {
  y: number;
  kind: FloorKind;
  lobby?: boolean;
  /** A power-up riding on this floor (rules 2). */
  power?: PowerUp;
  /** The floor before its overhang broke off. Only used to draw shaped floors with a flat,
   *  sliced side; scoring never reads it. */
  frame?: Box;
}

export interface Mover extends Floor {
  axis: "x" | "z";
  dir: 1 | -1;
  /** Base speed for this floor. */
  speed: number;
  /** Current speed including gusts. */
  v: number;
  gustPhase: number;
  /** Seconds since it appeared (shrinking floors get narrower as it grows). */
  age: number;
  /** Its full width along the slide, before any shrinking. */
  width: number;
}

export interface SimConfig {
  mode: Mode;
  rng: Rng;
  event?: WeekEvent | null;
  challenge?: Challenge | null;
  /** Rewinds available (normally 1; boosts add more; some challenges allow none). */
  rewinds: number;
  /** Gold rush boost. */
  goldBoost?: boolean;
  xpMultiplier?: number;
  /** Rules version (see RULES); 1 when missing. */
  rules?: number;
  /** A new player's first tower: the first six floors slide at 70% speed. */
  easy?: boolean;
}

export type DropOutcome =
  | { type: "miss"; piece: Mover; side: -1 | 1 }
  | {
      type: "land";
      perfect: boolean;
      floor: Floor;
      points: number;
      combo: number;
      /** The overhang that broke off, on a non-perfect drop. */
      piece?: Floor & { axis: "x" | "z" };
      side?: -1 | 1;
      /** A landmark index this drop passed. */
      landmark?: number;
      /** First floor in the wind. */
      windStarts?: boolean;
      /** A narrow tower won some width back (rules 3). */
      recovered?: boolean;
      /** A power-up this floor carried. */
      power?: PowerUp;
    };

/** The sim always moves in fixed steps of this length, so a tower can be replayed exactly
 *  from its seed and the steps at which the player tapped (see replay.ts). */
export const TICK = 1 / 120;

const SPEED: Record<FloorKind, number> = { normal: 1, gold: 1.35, ice: 1.45, garden: 0.75, shrink: 0.95, magnet: 1.2, ghost: 1 };
const PEOPLE: Record<FloorKind, number> = { normal: 1, gold: 1, ice: 1.5, garden: 0.5, shrink: 1.3, magnet: 1, ghost: 1.4 };
/** A shrinking floor loses this share of its width over SHRINK_TIME seconds. */
const SHRINK_BY = 0.45, SHRINK_BY_3 = 0.25, SHRINK_TIME = 4;
/** Rules 3: a floor smaller than this share of a full one counts as narrow... */
const NARROW = 0.45;
/** ...and from its second perfect drop in a row grows back this much on each side. */
const RECOVER = 0.8;

export class TowerSim {
  readonly cfg: SimConfig;
  stack: Floor[] = [];
  mover: Mover | null = null;
  score = 0;
  combo = 0;
  perfects = 0;
  bestStreak = 0;
  penthouses = 0;
  windFloors = 0;
  rewindsLeft: number;
  rewindsUsed = 0;
  rewindLevel = 0;
  lastLandmark = -1;
  time = 0;
  /** Fixed steps taken so far. */
  ticks = 0;
  private windAnnounced = false;
  /** Floors left for each power-up in effect. */
  powers: Record<PowerUp, number> = { slow: 0, wide: 0, steady: 0 };
  /** Power-ups collected this tower. */
  powersCaught = 0;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.rewindsLeft = cfg.challenge?.rules.noRewind ? 0 : cfg.rewinds;
    const h = BLOCK_SIZE / 2;
    this.stack = [{ x0: -h, x1: h, z0: -h, z1: h, y: 0, kind: "normal", lobby: true }];
    this.newMover();
  }

  get top(): Floor { return this.stack[this.stack.length - 1]; }
  get level(): number { return this.stack.length - 1; }
  get meters(): number { return metersFor(this.level); }

  /** Wind strength at floor n, after mode, event and challenge rules. */
  windFor(n: number): number {
    if (this.cfg.mode === "zen" || this.cfg.event?.noWind) return 0;
    return windAt(n, this.cfg.challenge?.rules.windFrom);
  }

  /** Gust strength at time t: 1 is calm, up to about 1.55 or down to about 0.45. */
  gustAt(m: Mover, t: number): number {
    if (this.powers.steady > 0) return 1;
    return 1 + this.windFor(m.y) * 0.55 * Math.sin(t * 2.3 + m.gustPhase) * Math.sin(t * 0.9 + m.gustPhase * 2);
  }

  speedFor(n: number): number {
    const easy = this.cfg.easy && n <= 6 ? 0.7 : 1;
    if (this.cfg.mode === "zen") return floorSpeed(Math.min(n, 12)) * easy;
    // Rules 4 is faster, except a new player's practice towers keep the gentle curve.
    const fast = (this.cfg.rules ?? 1) >= 4 && !this.cfg.easy;
    return (fast ? floorSpeed4(n) : floorSpeed(n)) * easy;
  }

  /** Picks the kind of the next floor. Always draws the same number of random values so
   *  seeded towers (daily, challenges) stay identical whatever the player does. */
  private nextKind(n: number): { kind: FloorKind; power?: PowerUp } {
    const { rng, mode, event, challenge, goldBoost } = this.cfg;
    const rGold = rng(), rIce = rng(), rGarden = rng();
    // Rules 2 draws three more values, always, so seeded towers stay identical.
    const v2 = (this.cfg.rules ?? 1) >= 2;
    const [rNew, rPow, rPowKind] = v2 ? [rng(), rng(), rng()] : [1, 1, 0];
    const power: PowerUp | undefined = v2 && mode !== "zen" && n >= 4 && rPow < 0.09
      ? (["slow", "wide", "steady"] as const)[Math.floor(rPowKind * 3)] : undefined;
    const pick = (kind: FloorKind) => ({ kind, power });
    const prev = this.top.kind;
    if (mode === "zen") return { kind: n >= 6 && prev !== "gold" && rGold < 0.14 ? "gold" : "normal" };

    let gold = challenge?.rules.goldChance ?? 0.14;
    gold *= (event?.gold ?? 1) * (goldBoost ? 2 : 1);
    if (n >= 6 && prev !== "gold" && rGold < Math.min(0.5, gold)) return pick("gold");

    if (challenge?.rules.iceEvery) {
      if (n % challenge.rules.iceEvery === 0) return pick("ice");
    } else {
      const iceFrom = event?.ice ? 8 : 20;
      if (n >= iceFrom && prev !== "ice" && rIce < 0.08 * (event?.ice ?? 1)) return pick("ice");
    }

    // Garden terraces turn up more often when your floors have shrunk.
    const narrow = peopleIn(this.top) < 10;
    if (n >= 15 && prev !== "garden" && rGarden < (narrow ? 0.14 : 0.05) * (event?.garden ?? 1)) return pick("garden");

    // Rules 2: magnet floors (easy perfects) early on, shrinking floors (tap early) and
    // foggy floors (hard to see) higher up. One draw splits between them.
    if (v2 && prev === "normal") {
      if (n >= 5 && rNew < 0.06) return pick("magnet");
      if (n >= 10 && rNew >= 0.06 && rNew < 0.13) return pick("shrink");
      if (n >= 25 && rNew >= 0.13 && rNew < 0.19) return pick("ghost");
    }
    return pick("normal");
  }

  newMover(): void {
    const top = this.top, n = this.stack.length;
    const axis = n % 2 ? "x" : "z";
    const { kind, power } = this.nextKind(n);
    const speed = this.speedFor(n) * SPEED[kind] * (this.powers.slow > 0 ? 0.65 : 1);
    const m: Mover = {
      x0: top.x0, x1: top.x1, z0: top.z0, z1: top.z1, y: n, kind,
      axis, dir: 1, speed, v: speed, gustPhase: this.cfg.rng() * Math.PI * 2,
      age: 0, width: axis === "x" ? top.x1 - top.x0 : top.z1 - top.z0,
    };
    if (power) m.power = power;
    if (axis === "x") { m.x0 -= RANGE; m.x1 -= RANGE; } else { m.z0 -= RANGE; m.z1 -= RANGE; }
    this.mover = m;
  }

  /** One fixed step of TICK seconds. */
  step(): void {
    this.update(TICK);
    this.ticks++;
  }

  /** Moves the sliding floor back and forth, with gusts up high. */
  update(dt: number): void {
    this.time += dt;
    const m = this.mover;
    if (!m) return;
    m.v = m.speed * this.gustAt(m, this.time);
    const step = m.dir * m.v * dt;
    if (m.axis === "x") { m.x0 += step; m.x1 += step; } else { m.z0 += step; m.z1 += step; }
    m.age += dt;
    if (m.kind === "shrink") {
      // Its far edge creeps in: the sooner you drop it, the wider it lands.
      const w = m.width * (1 - ((this.cfg.rules ?? 1) >= 3 ? SHRINK_BY_3 : SHRINK_BY) * Math.min(1, m.age / SHRINK_TIME));
      if (m.axis === "x") m.x1 = m.x0 + w; else m.z1 = m.z0 + w;
    }
    const offset = (m.axis === "x" ? m.x0 : m.z0) - (m.axis === "x" ? this.top.x0 : this.top.z0);
    if (offset > RANGE) m.dir = -1;
    if (offset < -RANGE) m.dir = 1;
  }

  /** How far the sliding floor is from lining up perfectly, in world units. */
  offset(): number {
    const m = this.mover;
    if (!m) return Infinity;
    return m.axis === "x" ? m.x0 - this.top.x0 : m.z0 - this.top.z0;
  }

  /** Would a drop right now be perfect? */
  wouldBePerfect(): boolean {
    const m = this.mover;
    if (!m) return false;
    const k = (m.kind === "magnet" ? 2.5 : 1) * (this.powers.wide > 0 ? 2 : 1);
    return Math.abs(this.offset()) <= perfectWindow(m.v) * k;
  }

  drop(): DropOutcome | null {
    const m = this.mover, top = this.top;
    if (!m) return null;
    const lo = m.axis === "x" ? Math.max(m.x0, top.x0) : Math.max(m.z0, top.z0);
    const hi = m.axis === "x" ? Math.min(m.x1, top.x1) : Math.min(m.z1, top.z1);
    const side: -1 | 1 = this.offset() < 0 ? -1 : 1;

    if (hi <= lo) {
      this.combo = 0;
      if (this.cfg.mode === "zen") {
        // Zen never ends on a miss: the floor falls away and a new one slides in.
        this.newMover();
      } else {
        this.mover = null;
      }
      return { type: "miss", piece: m, side };
    }

    const placed: Floor = { x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1, y: m.y, kind: m.kind };
    const set = (a: number, b: number) => {
      if (m.axis === "x") { placed.x0 = a; placed.x1 = b; } else { placed.z0 = a; placed.z1 = b; }
    };
    const topLo = m.axis === "x" ? top.x0 : top.z0, topHi = m.axis === "x" ? top.x1 : top.z1;
    const perfect = this.wouldBePerfect();
    let recovered = false;
    let piece: (Floor & { axis: "x" | "z" }) | undefined;

    if (perfect) {
      this.combo++;
      this.perfects++;
      if (m.kind === "gold") this.penthouses++;
      this.bestStreak = Math.max(this.bestStreak, this.combo);
      set(topLo, topHi);
      const area = (placed.x1 - placed.x0) * (placed.z1 - placed.z0);
      if ((this.cfg.rules ?? 1) >= 3 && area < NARROW * BLOCK_SIZE * BLOCK_SIZE && this.combo >= 2) {
        // A narrow tower wins width back on both sides with perfect drops in a row, so a
        // skilled player can recover; the rest of the time narrow floors stay narrow.
        for (const [a, b] of [["x0", "x1"], ["z0", "z1"]] as const) {
          const grow = clamp(BLOCK_SIZE - (placed[b] - placed[a]), 0, RECOVER);
          placed[a] -= grow / 2;
          placed[b] += grow / 2;
        }
        recovered = true;
      } else if (this.combo >= 3) {
        const grow = Math.min(GROW, BLOCK_SIZE - (topHi - topLo));
        set(topLo - grow / 2, topHi + grow / 2);
      }
    } else {
      this.combo = 0;
      set(lo, hi);
      if (this.cfg.mode === "zen") {
        // Zen floors slowly grow back so a relaxed tower never dwindles away.
        const grow = Math.min(0.4, BLOCK_SIZE - (hi - lo));
        set(lo - grow / 2, hi + grow / 2);
      }
      // The part hanging over the edge breaks off.
      const frame: Box = { x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1 };
      piece = { ...placed, axis: m.axis, frame };
      if (m.axis === "x") {
        if (side < 0) { piece.x0 = m.x0; piece.x1 = topLo; } else { piece.x0 = topHi; piece.x1 = m.x1; }
      } else if (side < 0) { piece.z0 = m.z0; piece.z1 = topLo; } else { piece.z0 = topHi; piece.z1 = m.z1; }
      if (this.cfg.mode !== "zen" && m.kind !== "garden") placed.frame = frame;
    }

    // Garden terraces widen the tower back out on both sides.
    if (m.kind === "garden") {
      for (const [a, b] of [["x0", "x1"], ["z0", "z1"]] as const) {
        const grow = clamp(BLOCK_SIZE - (placed[b] - placed[a]), 0, 1);
        placed[a] -= grow / 2;
        placed[b] += grow / 2;
      }
    }

    const base = peopleIn(placed) * PEOPLE[m.kind];
    const points = Math.round(perfect ? base * (m.kind === "gold" ? 5 : 1.5) : base);
    this.stack.push(placed);
    this.score += points;
    if (this.windFor(placed.y) > 0) this.windFloors++;

    const outcome: DropOutcome = { type: "land", perfect, floor: placed, points, combo: this.combo, piece, side: piece ? side : undefined, recovered };
    // Power-ups in effect count down one floor; a power-up riding on this floor starts now.
    for (const k of ["slow", "wide", "steady"] as const) if (this.powers[k] > 0) this.powers[k]--;
    if (m.power) {
      this.powers[m.power] = POWER_FLOORS[m.power];
      this.powersCaught++;
      outcome.power = m.power;
    }
    const lm = landmarkIndex(this.meters);
    if (lm > this.lastLandmark) { this.lastLandmark = lm; outcome.landmark = lm; }
    this.newMover();
    if (!this.windAnnounced && this.mover && this.windFor(this.mover.y) > 0) {
      this.windAnnounced = true;
      outcome.windStarts = true;
    }
    return outcome;
  }

  canRewind(): boolean {
    return this.rewindsLeft > 0;
  }

  /** Try the missed floor again. */
  rewind(): void {
    if (!this.canRewind()) return;
    this.rewindsLeft--;
    this.rewindsUsed++;
    this.rewindLevel = this.level;
    this.newMover();
  }

  /** For challenges: whether the goal has been reached. */
  goalReached(): boolean {
    const g = this.cfg.challenge?.goal;
    if (!g) return false;
    if (g.type === "height") return this.meters > g.n;
    if (g.type === "streak") return this.bestStreak >= g.n;
    return this.penthouses >= g.n;
  }

  summary(): RunSummary {
    return {
      mode: this.cfg.mode,
      score: this.score,
      floors: this.level,
      meters: this.meters,
      perfects: this.perfects,
      bestStreak: this.bestStreak,
      penthouses: this.penthouses,
      windFloors: this.windFloors,
      afterRewind: this.rewindsUsed ? this.level - this.rewindLevel : 0,
      rewindsUsed: this.rewindsUsed,
      challengeId: this.cfg.challenge?.id,
      challengeWon: this.goalReached(),
      xpMultiplier: this.cfg.xpMultiplier,
    };
  }
}

// The tower itself: the sliding floor, drops, scoring and special floors. No drawing or
// DOM here, so the rules can be tested directly.
import type { Rng } from "../core/rng";
import { clamp } from "../core/util";
import { BLOCK_SIZE, GROW, RANGE } from "../data/constants";
import type { Challenge } from "../data/challenges";
import type { WeekEvent } from "../data/events";
import { floorSpeed, landmarkIndex, metersFor, peopleIn, perfectWindow, windAt, type Box } from "./rules";
import type { Mode, RunSummary } from "./types";

/**
 * gold: a penthouse, faster, worth 5x on a perfect drop.
 * ice: slides faster, worth 50% more people.
 * garden: slides slowly, holds half the people, but widens the tower back out.
 */
export type FloorKind = "normal" | "gold" | "ice" | "garden";

export interface Floor extends Box {
  y: number;
  kind: FloorKind;
  lobby?: boolean;
}

export interface Mover extends Floor {
  axis: "x" | "z";
  dir: 1 | -1;
  /** Base speed for this floor. */
  speed: number;
  /** Current speed including gusts. */
  v: number;
  gustPhase: number;
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
    };

const SPEED: Record<FloorKind, number> = { normal: 1, gold: 1.35, ice: 1.45, garden: 0.75 };
const PEOPLE: Record<FloorKind, number> = { normal: 1, gold: 1, ice: 1.5, garden: 0.5 };

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
  private windAnnounced = false;

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
    return 1 + this.windFor(m.y) * 0.55 * Math.sin(t * 2.3 + m.gustPhase) * Math.sin(t * 0.9 + m.gustPhase * 2);
  }

  speedFor(n: number): number {
    return this.cfg.mode === "zen" ? floorSpeed(Math.min(n, 12)) : floorSpeed(n);
  }

  /** Picks the kind of the next floor. Always draws the same number of random values so
   *  seeded towers (daily, challenges) stay identical whatever the player does. */
  private nextKind(n: number): FloorKind {
    const { rng, mode, event, challenge, goldBoost } = this.cfg;
    const rGold = rng(), rIce = rng(), rGarden = rng();
    const prev = this.top.kind;
    if (mode === "zen") return n >= 6 && prev !== "gold" && rGold < 0.14 ? "gold" : "normal";

    let gold = challenge?.rules.goldChance ?? 0.14;
    gold *= (event?.gold ?? 1) * (goldBoost ? 2 : 1);
    if (n >= 6 && prev !== "gold" && rGold < Math.min(0.5, gold)) return "gold";

    if (challenge?.rules.iceEvery) {
      if (n % challenge.rules.iceEvery === 0) return "ice";
    } else {
      const iceFrom = event?.ice ? 8 : 20;
      if (n >= iceFrom && prev !== "ice" && rIce < 0.08 * (event?.ice ?? 1)) return "ice";
    }

    // Garden terraces turn up more often when your floors have shrunk.
    const narrow = peopleIn(this.top) < 10;
    if (n >= 15 && prev !== "garden" && rGarden < (narrow ? 0.14 : 0.05) * (event?.garden ?? 1)) return "garden";
    return "normal";
  }

  newMover(): void {
    const top = this.top, n = this.stack.length;
    const axis = n % 2 ? "x" : "z";
    const kind = this.nextKind(n);
    const speed = this.speedFor(n) * SPEED[kind];
    const m: Mover = {
      x0: top.x0, x1: top.x1, z0: top.z0, z1: top.z1, y: n, kind,
      axis, dir: 1, speed, v: speed, gustPhase: this.cfg.rng() * Math.PI * 2,
    };
    if (axis === "x") { m.x0 -= RANGE; m.x1 -= RANGE; } else { m.z0 -= RANGE; m.z1 -= RANGE; }
    this.mover = m;
  }

  /** Moves the sliding floor back and forth, with gusts up high. */
  update(dt: number): void {
    this.time += dt;
    const m = this.mover;
    if (!m) return;
    m.v = m.speed * this.gustAt(m, this.time);
    const step = m.dir * m.v * dt;
    if (m.axis === "x") { m.x0 += step; m.x1 += step; } else { m.z0 += step; m.z1 += step; }
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
    return !!this.mover && Math.abs(this.offset()) <= perfectWindow(this.mover.v);
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
    let piece: (Floor & { axis: "x" | "z" }) | undefined;

    if (perfect) {
      this.combo++;
      this.perfects++;
      if (m.kind === "gold") this.penthouses++;
      this.bestStreak = Math.max(this.bestStreak, this.combo);
      set(topLo, topHi);
      if (this.combo >= 3) {
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
      piece = { ...placed, axis: m.axis };
      if (m.axis === "x") {
        if (side < 0) { piece.x0 = m.x0; piece.x1 = topLo; } else { piece.x0 = topHi; piece.x1 = m.x1; }
      } else if (side < 0) { piece.z0 = m.z0; piece.z1 = topLo; } else { piece.z0 = topHi; piece.z1 = m.z1; }
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

    const outcome: DropOutcome = { type: "land", perfect, floor: placed, points, combo: this.combo, piece, side: piece ? side : undefined };
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

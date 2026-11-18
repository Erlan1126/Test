// The café loop: a beginner's first towers visibly grow the town.
//
// - Tower one (the first Classic tower with at least one floor) is kept as a small
//   building next to the Coffee Cart, with its real floors, skin and shape.
// - Every floor of a Classic, Daily or challenge tower counts toward the Coffee Cart's
//   terrace; at six, the terrace is ready, and the player opens (claims) it once.
// - Then one café contract: land wide floors in a tower, and the terrace gets lights,
//   flowers and more tables.
import type { Box } from "./rules";

/** Floors (in Classic, Daily or challenge towers) that open the café terrace. */
export const TERRACE_FLOORS = 6;
/** The terrace makes the Coffee Cart earn this much more; the contract adds as much again. */
export const TERRACE_MULT = 1.2;
/** The café contract: land this many wide floors in one tower... */
export const CONTRACT_WIDE = 5;
/** ...where a wide floor keeps at least this share of the first floor's width and depth. */
export const WIDE_SHARE = 0.8;
/** The most floors of the starter tower kept (it's a small building in the town). */
export const STARTER_MAX_FLOORS = 60;

/** The first tower, as it stands in the town. Each floor is [x, z, width, depth] relative
 *  to the tower's lobby (its base), so -1..1 across. */
export interface StarterTower { f: number; s: string; h: string; b: [number, number, number, number][] }

export interface CafeState {
  starter: StarterTower | null;
  /** The first district visit's look at the starter tower has been shown. */
  framed: boolean;
  /** Floors counted toward the terrace. */
  floors: number;
  /** 0 not yet, 1 ready to open, 2 open. */
  terrace: 0 | 1 | 2;
  /** The café contract: 0 not offered yet, 1 offered, 2 done. */
  contract: 0 | 1 | 2;
  /** The most wide floors landed in one tower toward the contract. */
  wideBest: number;
}

export const newCafe = (): CafeState => ({ starter: null, framed: false, floors: 0, terrace: 0, contract: 0, wideBest: 0 });

/** A save's café state, made safe. Saves from before the café loop count the office floors
 *  they already built (so a grown company gets its terrace to open) and skip the intro. */
export function normalizeCafe(raw: unknown, before: { floors: number; towers: number }): CafeState {
  if (!raw || typeof raw !== "object") {
    const c = newCafe();
    if (before.towers > 0) {
      c.framed = true;
      c.floors = Math.max(0, Math.floor(before.floors));
      if (c.floors >= TERRACE_FLOORS) c.terrace = 1;
    }
    return c;
  }
  const o = raw as Record<string, unknown>;
  const n = (v: unknown, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  const st = o.starter as Record<string, unknown> | null;
  let starter: StarterTower | null = null;
  if (st && typeof st === "object" && n(st.f) > 0 && Array.isArray(st.b)) {
    const b = (st.b as unknown[]).filter((x): x is number[] => Array.isArray(x) && x.length === 4 && x.every(v => typeof v === "number" && Number.isFinite(v)))
      .slice(0, STARTER_MAX_FLOORS).map(x => x.map(v => Math.max(-2, Math.min(2, v))) as [number, number, number, number]);
    if (b.length) starter = { f: n(st.f, 9999), s: typeof st.s === "string" ? st.s : "glass", h: typeof st.h === "string" ? st.h : "square", b };
  }
  return {
    starter,
    framed: o.framed === true,
    floors: n(o.floors),
    terrace: Math.min(2, n(o.terrace)) as 0 | 1 | 2,
    contract: Math.min(2, n(o.contract)) as 0 | 1 | 2,
    wideBest: n(o.wideBest, 999),
  };
}

/** The tower's floors relative to its lobby, for the starter building. */
export function towerShape(stack: (Box & { lobby?: boolean })[]): [number, number, number, number][] {
  const base = stack[0], hw = (base.x1 - base.x0) / 2 || 1, hd = (base.z1 - base.z0) / 2 || 1;
  const cx = (base.x0 + base.x1) / 2, cz = (base.z0 + base.z1) / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return stack.slice(1, STARTER_MAX_FLOORS + 1).map(f => [r(((f.x0 + f.x1) / 2 - cx) / hw), r(((f.z0 + f.z1) / 2 - cz) / hd), r((f.x1 - f.x0) / 2 / hw), r((f.z1 - f.z0) / 2 / hd)]);
}

/** Whether a landed floor counts as wide for the café contract. */
export const isWide = (floor: Box, base: Box): boolean =>
  floor.x1 - floor.x0 >= WIDE_SHARE * (base.x1 - base.x0) - 1e-9 && floor.z1 - floor.z0 >= WIDE_SHARE * (base.z1 - base.z0) - 1e-9;

export interface CafeRun {
  mode: string;
  floors: number;
  stack: (Box & { lobby?: boolean })[];
  skin: string;
  shape: string;
  /** Wide floors landed (counted during the tower when the contract was on). */
  wide: number;
  /** The contract was taken for this tower. */
  contract: boolean;
}

export interface CafeResult {
  /** This tower became the starter building. */
  starter: boolean;
  /** Floors this tower added toward the terrace (0 once it's open). */
  added: number;
  /** The terrace just became ready to open. */
  terraceReady: boolean;
  /** The café contract was just completed. */
  contractDone: boolean;
}

/** Counts a finished tower toward the café. Zen towers never count. */
export function cafeRun(c: CafeState, run: CafeRun): CafeResult {
  const out: CafeResult = { starter: false, added: 0, terraceReady: false, contractDone: false };
  if (run.mode === "zen" || run.floors < 1) return out;
  if (!c.starter && run.mode === "classic") {
    c.starter = { f: run.floors, s: run.skin, h: run.shape, b: towerShape(run.stack) };
    out.starter = true;
  }
  if (c.terrace === 0) {
    out.added = run.floors;
    c.floors += run.floors;
    if (c.floors >= TERRACE_FLOORS) { c.terrace = 1; out.terraceReady = true; }
  } else c.floors += run.floors;
  if (run.contract && c.contract === 1) {
    c.wideBest = Math.max(c.wideBest, run.wide);
    if (run.wide >= CONTRACT_WIDE) { c.contract = 2; out.contractDone = true; }
  }
  return out;
}

/** Opens the terrace. True exactly once: when it was ready and wasn't open yet. */
export function claimTerrace(c: CafeState): boolean {
  if (c.terrace !== 1) return false;
  c.terrace = 2;
  if (c.contract === 0) c.contract = 1; // the café contract is offered next
  return true;
}

/** What the café adds to the Coffee Cart's earnings. */
export const cafeMult = (c: CafeState): number => (c.terrace === 2 ? TERRACE_MULT : 1) * (c.contract === 2 ? TERRACE_MULT : 1);

/** The contract is open to take on. */
export const contractOpen = (c: CafeState): boolean => c.terrace === 2 && c.contract === 1;

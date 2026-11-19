// The café block: a beginner's first towers visibly grow a little neighborhood.
//
// - Tower one (the first Classic tower with at least one floor) is kept as a small
//   building next to the Coffee Cart, with its real floors, skin and shape. A neighbor in
//   a yellow jacket moves in, then walks over to the cart for a coffee.
// - The cart has two folded chairs: the neighbor asks to sit somewhere. Every floor of a
//   Classic, Daily or challenge tower counts toward the café terrace; at six it's ready,
//   the player opens it (once), and the neighbor takes the first seat.
// - Then a choice for tower three: a flower market (land wide floors) or a playground
//   (build a tall tower). Each opens on its own spot in the block; the other stays for later.
import type { Box } from "./rules";

/** Floors (in Classic, Daily or challenge towers) that open the café terrace. */
export const TERRACE_FLOORS = 6;
/** The terrace makes the Coffee Cart earn this much more (an old café contract, as much again). */
export const TERRACE_MULT = 1.2;
/** Each neighborhood project brings more people to the block: the cart earns this much more. */
export const PROJECT_MULT = 1.1;
/** The flower market: land this many wide floors in one tower... */
export const FLOWER_WIDE = 5;
/** (kept for older code and saves: the café contract asked for the same) */
export const CONTRACT_WIDE = FLOWER_WIDE;
/** ...where a wide floor keeps at least this share of the first floor's width and depth. */
export const WIDE_SHARE = 0.8;
/** The playground: a tower of this many floors. */
export const PLAY_FLOORS = 8;
/** The most floors of the starter tower kept (it's a small building in the town). */
export const STARTER_MAX_FLOORS = 60;

/** The first tower, as it stands in the town. Each floor is [x, z, width, depth] relative
 *  to the tower's lobby (its base), so -1..1 across. */
export interface StarterTower { f: number; s: string; h: string; b: [number, number, number, number][] }

export type ProjectId = "flowers" | "play";
export const PROJECTS: ProjectId[] = ["flowers", "play"];

export interface CafeState {
  starter: StarterTower | null;
  /** The first district visit's look at the starter tower has been shown. */
  framed: boolean;
  /** Floors counted toward the terrace. */
  floors: number;
  /** 0 not yet, 1 ready to open, 2 open. */
  terrace: 0 | 1 | 2;
  /** An older save's café contract: 2 when it was done (its lights and bonus stay). */
  contract: 0 | 1 | 2;
  /** The most wide floors landed in one flower-market tower. */
  wideBest: number;
  /** The tallest playground tower so far. */
  playBest: number;
  /** Neighborhood projects done. */
  done: ProjectId[];
  /** The neighbor's story so far: moved in, asked to sit, took the first seat. */
  moved: boolean;
  asked: boolean;
  seated: boolean;
}

export const newCafe = (): CafeState => ({ starter: null, framed: false, floors: 0, terrace: 0, contract: 0, wideBest: 0, playBest: 0, done: [], moved: false, asked: false, seated: false });

/** A save's café state, made safe. Saves from before the café loop count the office floors
 *  they already built (so a grown company gets its terrace to open) and skip the intro. */
export function normalizeCafe(raw: unknown, before: { floors: number; towers: number }): CafeState {
  if (!raw || typeof raw !== "object") {
    const c = newCafe();
    if (before.towers > 0) {
      c.framed = c.moved = c.asked = true;
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
  const terrace = Math.min(2, n(o.terrace)) as 0 | 1 | 2;
  // The café contract became the flower market: one still open is simply the choice now.
  const contract = (n(o.contract) >= 2 ? 2 : 0) as 0 | 2;
  const framed = o.framed === true;
  // Saves from before the neighbor: their story is told already (nothing replays).
  const old = !("moved" in o);
  return {
    starter,
    framed,
    floors: n(o.floors),
    terrace,
    contract,
    wideBest: n(o.wideBest, 999),
    playBest: n(o.playBest, 999),
    done: Array.isArray(o.done) ? PROJECTS.filter(p => (o.done as unknown[]).includes(p)) : [],
    moved: old ? framed : o.moved === true,
    asked: old ? framed : o.asked === true,
    seated: old ? terrace === 2 : o.seated === true,
  };
}

/** The tower's floors relative to its lobby, for the starter building. */
export function towerShape(stack: (Box & { lobby?: boolean })[]): [number, number, number, number][] {
  const base = stack[0], hw = (base.x1 - base.x0) / 2 || 1, hd = (base.z1 - base.z0) / 2 || 1;
  const cx = (base.x0 + base.x1) / 2, cz = (base.z0 + base.z1) / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return stack.slice(1, STARTER_MAX_FLOORS + 1).map(f => [r(((f.x0 + f.x1) / 2 - cx) / hw), r(((f.z0 + f.z1) / 2 - cz) / hd), r((f.x1 - f.x0) / 2 / hw), r((f.z1 - f.z0) / 2 / hd)]);
}

/** Whether a landed floor counts as wide (for the flower market). */
export const isWide = (floor: Box, base: Box): boolean =>
  floor.x1 - floor.x0 >= WIDE_SHARE * (base.x1 - base.x0) - 1e-9 && floor.z1 - floor.z0 >= WIDE_SHARE * (base.z1 - base.z0) - 1e-9;

export interface CafeRun {
  mode: string;
  floors: number;
  stack: (Box & { lobby?: boolean })[];
  skin: string;
  shape: string;
  /** Wide floors landed (counted during the tower when the flower market was chosen). */
  wide: number;
  /** The neighborhood project this tower worked on, if any. */
  project?: ProjectId | "";
  /** (older callers: the café contract, which is the flower market now) */
  contract?: boolean;
}

export interface CafeResult {
  /** This tower became the starter building. */
  starter: boolean;
  /** Floors this tower added toward the terrace (0 once it's open). */
  added: number;
  /** The terrace just became ready to open. */
  terraceReady: boolean;
  /** A neighborhood project was just finished. */
  projectDone: ProjectId | "";
  /** (older callers) the flower market, the old café contract, was just finished */
  contractDone: boolean;
}

/** How far a tower got toward a project (0 to its goal). */
export const projectProgress = (p: ProjectId, run: { wide: number; floors: number }): number =>
  p === "flowers" ? Math.min(FLOWER_WIDE, run.wide) : Math.min(PLAY_FLOORS, run.floors);
export const projectGoal = (p: ProjectId): number => (p === "flowers" ? FLOWER_WIDE : PLAY_FLOORS);

/** Counts a finished tower toward the café block. Zen towers never count. */
export function cafeRun(c: CafeState, run: CafeRun): CafeResult {
  const out: CafeResult = { starter: false, added: 0, terraceReady: false, projectDone: "", contractDone: false };
  if (run.mode === "zen" || run.floors < 1) return out;
  // Only a new player's first tower (saves from before the café loop skip the intro).
  if (!c.starter && !c.framed && run.mode === "classic") {
    c.starter = { f: run.floors, s: run.skin, h: run.shape, b: towerShape(run.stack) };
    out.starter = true;
  }
  if (c.terrace === 0) {
    out.added = run.floors;
    c.floors += run.floors;
    if (c.floors >= TERRACE_FLOORS) { c.terrace = 1; out.terraceReady = true; }
  } else c.floors += run.floors;
  const p: ProjectId | "" = run.project || (run.contract ? "flowers" : "");
  if (p && projectsOpen(c) && !c.done.includes(p)) {
    if (p === "flowers") c.wideBest = Math.max(c.wideBest, run.wide);
    else c.playBest = Math.max(c.playBest, run.floors);
    if (projectProgress(p, run) >= projectGoal(p)) { c.done.push(p); out.projectDone = p; out.contractDone = p === "flowers"; }
  }
  return out;
}

/** Opens the terrace. True exactly once: when it was ready and wasn't open yet. */
export function claimTerrace(c: CafeState): boolean {
  if (c.terrace !== 1) return false;
  c.terrace = 2;
  return true;
}

/** Floors still needed for café seating (0 once the terrace is ready). */
export const seatingNeed = (c: CafeState): number => (c.terrace === 0 ? Math.max(1, TERRACE_FLOORS - c.floors) : 0);

/** The neighborhood projects are on offer (the terrace is open and one is left to do). */
export const projectsOpen = (c: CafeState): boolean => c.terrace === 2 && PROJECTS.some(p => !c.done.includes(p));
/** (older callers) */
export const contractOpen = projectsOpen;

/** What the café block adds to the Coffee Cart's earnings. */
export const cafeMult = (c: CafeState): number =>
  (c.terrace === 2 ? TERRACE_MULT : 1) * (c.contract === 2 ? TERRACE_MULT : 1) * Math.pow(PROJECT_MULT, c.done.length);

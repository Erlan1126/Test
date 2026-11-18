// Building orders: every headquarters a business asks for comes with an order for a kind
// of tower (wide floors, perfect drops, a perfect streak). The tower the player builds is
// kept, with its real floors, skin and shape, and stands as that business's HQ in town.
// Filling the order makes the business earn more, for good.
import { towerShape, type StarterTower } from "./cafe";
import type { Box } from "./rules";

export type OrderKind = "wide" | "perfect" | "streak";
export interface Order { kind: OrderKind; n: number }

/** A filled order makes its business earn this much more (each filled order stacks). */
export const ORDER_MULT = 1.25;
/** The most orders that count toward one business's bonus (one per HQ stage). */
export const ORDER_MAX = 4;
/** HQ towers keep at most this many floors (the town shows them small). */
export const HQ_TOWER_FLOORS = 90;

const KINDS: OrderKind[] = ["wide", "perfect", "streak"];

/** The order for business number `biz` (its place in the list) growing to `stage` (1-4). */
export function orderFor(biz: number, stage: number): Order {
  const st = Math.max(1, Math.min(4, Math.floor(stage)));
  const kind = KINDS[(Math.max(0, biz) + st) % KINDS.length];
  const n = kind === "wide" ? 4 + st * 2 : kind === "perfect" ? 3 + st * 2 : 3 + st;
  return { kind, n };
}

export interface OrdersState {
  /** Each business's HQ tower, as the player built it. */
  towers: Record<string, StarterTower>;
  /** Orders filled per business. */
  filled: Record<string, number>;
}

export const newOrders = (): OrdersState => ({ towers: {}, filled: {} });

/** A save's orders, made safe (unknown businesses dropped). */
export function normalizeOrders(raw: unknown, ids: string[]): OrdersState {
  const o = newOrders();
  if (!raw || typeof raw !== "object") return o;
  const r = raw as { towers?: unknown; filled?: unknown };
  if (r.towers && typeof r.towers === "object") {
    for (const [id, v] of Object.entries(r.towers as Record<string, unknown>)) {
      if (!ids.includes(id) || !v || typeof v !== "object") continue;
      const t = v as Record<string, unknown>;
      const b = Array.isArray(t.b) ? (t.b as unknown[]).filter((x): x is number[] => Array.isArray(x) && x.length === 4 && x.every(n => typeof n === "number" && Number.isFinite(n))).slice(0, HQ_TOWER_FLOORS).map(x => x.map(n => Math.max(-2, Math.min(2, n))) as [number, number, number, number]) : [];
      const f = typeof t.f === "number" && Number.isFinite(t.f) ? Math.max(1, Math.min(9999, Math.floor(t.f))) : 0;
      if (b.length && f) o.towers[id] = { f, s: typeof t.s === "string" ? t.s : "glass", h: typeof t.h === "string" ? t.h : "square", b };
    }
  }
  if (r.filled && typeof r.filled === "object") {
    for (const [id, v] of Object.entries(r.filled as Record<string, unknown>)) {
      if (ids.includes(id) && typeof v === "number" && Number.isFinite(v) && v > 0) o.filled[id] = Math.min(ORDER_MAX, Math.floor(v));
    }
  }
  return o;
}

/** What a tower did toward an order. */
export interface OrderRun { wide: number; perfects: number; bestStreak: number }

/** How far a tower got toward an order (0 to n). */
export const orderProgress = (o: Order, run: OrderRun): number =>
  Math.min(o.n, o.kind === "wide" ? run.wide : o.kind === "perfect" ? run.perfects : run.bestStreak);

/** A floor counts as wide for an order when it keeps this share of the first floor. */
export const ORDER_WIDE_SHARE = 0.8;

/** A headquarters tower was built (tall enough, the business grew): it stands in town, and
 *  a filled order adds to the business's bonus. Returns whether the order was filled. */
export function recordHq(s: OrdersState, id: string, order: Order, run: OrderRun & { floors: number; stack: (Box & { lobby?: boolean })[]; skin: string; shape: string }): boolean {
  s.towers[id] = { f: run.floors, s: run.skin, h: run.shape, b: towerShape(run.stack).slice(0, HQ_TOWER_FLOORS) };
  const met = orderProgress(order, run) >= order.n;
  if (met) s.filled[id] = Math.min(ORDER_MAX, (s.filled[id] ?? 0) + 1);
  return met;
}

/** What filled orders add to a business's earnings. */
export const orderMult = (s: OrdersState, id: string): number => Math.pow(ORDER_MULT, s.filled[id] ?? 0);

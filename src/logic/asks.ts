// Neighbour requests and the savings goal.
//
// Requests: the people living in the homes you've built ask for something now and then
// (grow our home, open a shop near us, more coffee, a home for our friends). Doing it pays
// crystals and a little cash. Up to two at a time; a new one comes a while after one is done.
//
// The savings goal: the next big thing to buy (a new business, a business's next
// headquarters), how close the cash is, how long until it's there, and what crystals cost
// to skip the wait (the same rate as finishing a build early).
import { BUSINESSES, PAY_K } from "../data/tycoon";
import type { SaveData } from "./save";
import { costOf, earn, levelOf, perSecond, unlockedBusiness } from "./tycoon";
import { isLot, lotsAllowed, lotsBuilt, propBlock, propLevel, propsOpen } from "./props";

export type AskKind = "grow" | "shop" | "more" | "home";
export interface Ask {
  /** Which home asks (a property key). */
  home: string;
  kind: AskKind;
  /** grow: the home's target level; shop/more: the business; more: its target level. */
  biz: string;
  target: number;
  /** For "home": how many lots were built when asked. */
  from: number;
  crystals: number;
  /** When it was asked (ms). */
  at: number;
}
export interface AskState { list: Ask[]; next: number; done: number }
export const newAsks = (): AskState => ({ list: [], next: 0, done: 0 });

export const ASKS_MAX = 2;
/** Minutes between one request being done and the next arriving. */
export const ASK_GAP_MIN = 12;

/** Is this request done? */
export function askDone(s: SaveData, a: Ask): boolean {
  if (a.kind === "grow") return propLevel(s, a.home) >= a.target;
  if (a.kind === "shop") return levelOf(s, a.biz) > 0;
  if (a.kind === "more") return levelOf(s, a.biz) >= a.target;
  return lotsBuilt(s) > a.from;
}
/** How far along it is (0-1). */
export function askProgress(s: SaveData, a: Ask): number {
  if (askDone(s, a)) return 1;
  if (a.kind === "more") { const lv = levelOf(s, a.biz); return Math.max(0, Math.min(0.99, lv / a.target)); }
  return 0;
}
/** The cash part of a request's reward: about two minutes of earnings. */
export const askCash = (s: SaveData, now = Date.now()): number => Math.max(200, Math.round(perSecond(s, now, false) * 120));

/** The homes that can ask (built and lived in). */
export const askingHomes = (s: SaveData, homes: string[]): string[] => homes.filter(k => propLevel(s, k) >= 1 && (!isLot(k) || (s.props[k] ?? 0) >= 1));

/** A new request, if one is due (or null). `homes` are the town's property keys. */
export function newAsk(s: SaveData, homes: string[], now = Date.now(), rnd = Math.random): Ask | null {
  const st = s.asks;
  if (!propsOpen(s) || st.list.length >= ASKS_MAX || now < st.next) return null;
  const who = askingHomes(s, homes).filter(k => !st.list.some(a => a.home === k));
  if (!who.length) return null;
  const home = who[Math.floor(rnd() * who.length) % who.length];
  const options: Omit<Ask, "home" | "at">[] = [];
  // Grow our home (if it can grow now).
  if (!propBlock(s, home)) options.push({ kind: "grow", biz: "", target: propLevel(s, home) + 1, from: 0, crystals: 4 + propLevel(s, home) });
  // A shop near us: a business City Hall allows but that isn't open yet.
  BUSINESSES.forEach((b, i) => { if (i < 10 && levelOf(s, b.id) === 0 && unlockedBusiness(s, i) && !st.list.some(a => a.biz === b.id)) options.push({ kind: "shop", biz: b.id, target: 1, from: 0, crystals: 6 + i }); });
  // More of a favourite: the next round number of levels at a business already open.
  const owned = BUSINESSES.filter((b, i) => i < 10 && levelOf(s, b.id) > 0 && !st.list.some(a => a.biz === b.id));
  if (owned.length) { const b = owned[Math.floor(rnd() * owned.length) % owned.length], lv = levelOf(s, b.id); options.push({ kind: "more", biz: b.id, target: (Math.floor(lv / 10) + 1) * 10 + 5, from: 0, crystals: 3 }); }
  // A home for our friends: an empty lot City Hall allows.
  if (lotsBuilt(s) < lotsAllowed(s) && !st.list.some(a => a.kind === "home")) options.push({ kind: "home", biz: "", target: 1, from: lotsBuilt(s), crystals: 5 });
  if (!options.length) return null;
  const o = options[Math.floor(rnd() * options.length) % options.length];
  const a: Ask = { ...o, home, at: now };
  st.list.push(a);
  return a;
}

/** Collects a finished request: its crystals and cash. Returns them, or null. */
export function collectAsk(s: SaveData, i: number, now = Date.now()): { crystals: number; cash: number } | null {
  const a = s.asks.list[i];
  if (!a || !askDone(s, a)) return null;
  const cash = askCash(s, now);
  s.crystals += a.crystals;
  earn(s, cash);
  s.asks.list.splice(i, 1);
  s.asks.done++;
  s.asks.next = now + ASK_GAP_MIN * 60e3;
  return { crystals: a.crystals, cash };
}

export function normalizeAsks(v: unknown): AskState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
  const kinds: AskKind[] = ["grow", "shop", "more", "home"];
  const list = (Array.isArray(o.list) ? o.list : []).slice(0, ASKS_MAX).flatMap(x => {
    const a = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof a.home !== "string" || a.home.length > 20 || !kinds.includes(a.kind as AskKind)) return [];
    const biz = typeof a.biz === "string" && (a.biz === "" || BUSINESSES.some(b => b.id === a.biz)) ? a.biz : "";
    return [{ home: a.home, kind: a.kind as AskKind, biz, target: Math.floor(num(a.target)), from: Math.floor(num(a.from)), crystals: Math.min(50, Math.floor(num(a.crystals))), at: num(a.at) }];
  });
  return { list, next: num(o.next), done: Math.floor(num(o.done)) };
}

// ---- The savings goal ----
export interface SaveGoal { kind: "open" | "hq"; biz: string; price: number }
/** The next big thing to buy: the next business to open, or else the cheapest headquarters
 *  ready to build. Null when there's nothing big to save for. */
export function saveGoal(s: SaveData, hqPrice: (id: string) => number, ready: (id: string) => number): SaveGoal | null {
  const i = BUSINESSES.findIndex((b, k) => k < 10 && levelOf(s, b.id) === 0 && unlockedBusiness(s, k));
  if (i >= 0) return { kind: "open", biz: BUSINESSES[i].id, price: costOf(BUSINESSES[i], 0, 1) };
  let best: SaveGoal | null = null;
  for (const b of BUSINESSES) if (ready(b.id)) { const p = hqPrice(b.id); if (!best || p < best.price) best = { kind: "hq", biz: b.id, price: p }; }
  return best;
}
/** Seconds until the cash is there at the current rate (Infinity if it never will be). */
export function secondsTo(s: SaveData, price: number, now = Date.now()): number {
  const missing = price - s.tycoon.coins;
  if (missing <= 0) return 0;
  const ps = perSecond(s, now, false);
  return ps > 0 ? missing / ps : Infinity;
}
/** Crystals to skip the wait: one for every two minutes of waiting (at least one). */
export const skipPrice = (seconds: number): number => (Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 120)) : Infinity);
/** Pays crystals to have the missing cash now. */
export function skipWait(s: SaveData, price: number, now = Date.now()): boolean {
  const sec = secondsTo(s, price, now), cost = skipPrice(sec);
  if (sec <= 0 || !Number.isFinite(cost) || s.crystals < cost) return false;
  s.crystals -= cost;
  earn(s, price - s.tycoon.coins);
  return true;
}
// (PAY_K is part of perSecond already; imported so a change of the dial is easy to find.)
void PAY_K;

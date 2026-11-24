// Builders and building time, like the big city builders: bigger projects (an office block,
// a district, a home upgrade, the café terrace) take real time to build, and each needs a
// free builder. The cash is paid when building starts; the building is done when the time is
// up. Crystals finish a build right away, and more builders can be hired (VIP brings one).
import { LAND, type LandId } from "../data/land";
import { PROP_MAX } from "../data/props";
import type { SaveData } from "./save";
import { propLevel, propPrice, propsOpen } from "./props";
import { landOnSale, landPrice } from "./land";
import { buildOffice, costOf, levelOf, officePrice, readyStage } from "./tycoon";
import { BUSINESSES } from "../data/tycoon";
import { projectsOpen, type ProjectId } from "./cafe";
import { vipActive } from "./vip";

/** "hq": a business's new headquarters (it grows a stage); "project": the block's flower
 *  market or playground. */
export type BuildKind = "office" | "terrace" | "land" | "home" | "hq" | "project";
/** How long a headquarters takes, by the stage it grows into. */
const HQ_TIME = [0, 2 * 60e3, 10 * 60e3, 30 * 60e3, 3600e3, 2 * 3600e3, 3 * 3600e3, 4 * 3600e3];
export interface BuildJob { kind: BuildKind; id: string; start: number; end: number }

/** Builders hired with crystals, at most. */
export const MAX_HIRED = 2;
/** What the 2nd and 3rd builder cost (crystals). */
export const BUILDER_PRICES = [250, 600];
/** VIP builds this much faster. */
export const VIP_SPEED = 0.75;
/** The café terrace's price (cash) and build time. */
export const TERRACE_PRICE = 15;
const MIN = 60e3, HOUR = 3600e3;

/** Builders: one to start, plus the hired ones, plus one while VIP is on. */
export const builderCount = (s: SaveData, now = Date.now()): number => 1 + Math.min(MAX_HIRED, s.tycoon.builders ?? 0) + (vipActive(s, now) ? 1 : 0);
export const busyBuilders = (s: SaveData, now = Date.now()): number => (s.tycoon.builds ?? []).filter(b => b.end > now).length;
export const freeBuilders = (s: SaveData, now = Date.now()): number => Math.max(0, builderCount(s, now) - busyBuilders(s, now));

/** How long a build takes (ms). Small things are quick; districts take hours. */
export function buildTime(s: SaveData, kind: BuildKind, id = "", now = Date.now()): number {
  let ms: number;
  if (kind === "terrace") ms = 20e3;
  else if (kind === "office") ms = Math.min(4 * HOUR, MIN * Math.pow(1.6, Math.max(0, s.tycoon.offices ?? 0)));
  else if (kind === "hq") ms = HQ_TIME[Math.min(HQ_TIME.length - 1, Math.max(1, readyStage(s, id)))];
  else if (kind === "project") ms = 3 * MIN;
  else if (kind === "land") ms = [10 * MIN, 30 * MIN, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR][Math.max(0, LAND.findIndex(l => l.id === id))] ?? 8 * HOUR;
  else ms = [30e3, 30e3, 2 * MIN, 10 * MIN, 30 * MIN, HOUR][propLevel(s, id)] ?? HOUR;
  return Math.round(ms * (vipActive(s, now) ? VIP_SPEED : 1));
}

/** A business's new headquarters: about ten of its next levels' worth of cash. */
export function hqPrice(s: SaveData, id: string): number {
  const b = BUSINESSES.find(x => x.id === id);
  return b ? Math.max(100, Math.round(costOf(b, levelOf(s, id), 1) * 10)) : Infinity;
}

/** Crystals to finish a build now: about one for every two minutes left (at least one). */
export const finishPrice = (msLeft: number): number => Math.max(1, Math.ceil(msLeft / (2 * MIN)));

/** A build of this thing already under way (or null). */
export const buildOf = (s: SaveData, kind: BuildKind, id = ""): BuildJob | null => (s.tycoon.builds ?? []).find(b => b.kind === kind && b.id === id) ?? null;

/** What starting a build costs in cash. */
export function buildPrice(s: SaveData, kind: BuildKind, id = "", now = Date.now()): number {
  if (kind === "terrace") return TERRACE_PRICE;
  if (kind === "office") return officePrice(s);
  if (kind === "hq") return hqPrice(s, id);
  if (kind === "project") return Math.max(200, Math.round(officePrice(s) * 1.5));
  if (kind === "land") { const l = LAND.find(x => x.id === id); return l ? landPrice(s, l, now) : Infinity; }
  return propPrice(s, id, now);
}

export type StartResult = "ok" | "short" | "busy" | "building" | "locked";

/** Starts a build: pays its cash and puts a builder on it. */
export function startBuild(s: SaveData, kind: BuildKind, id = "", now = Date.now()): StartResult {
  completeBuilds(s, now);
  if (buildOf(s, kind, id)) return "building";
  if (kind === "terrace" && s.cafe.terrace !== 0) return "locked";
  if (kind === "land" && (landOnSale(s)?.id !== id)) return "locked";
  if (kind === "hq" && !readyStage(s, id)) return "locked";
  if (kind === "project" && (!projectsOpen(s.cafe) || s.cafe.done.includes(id as ProjectId))) return "locked";
  if (kind === "home" && (!propsOpen(s) || propLevel(s, id) >= PROP_MAX)) return "locked";
  if (freeBuilders(s, now) < 1) return "busy";
  const price = buildPrice(s, kind, id, now);
  if (!(s.tycoon.coins >= price)) return "short";
  s.tycoon.coins -= price;
  s.tycoon.builds = [...(s.tycoon.builds ?? []), { kind, id, start: now, end: now + buildTime(s, kind, id, now) }];
  return "ok";
}

/** Finishes what's done: each finished build takes effect. Returns them. */
export function completeBuilds(s: SaveData, now = Date.now()): BuildJob[] {
  const list = s.tycoon.builds ?? [];
  const done = list.filter(b => b.end <= now);
  if (!done.length) return [];
  s.tycoon.builds = list.filter(b => b.end > now);
  s.tycoon.built = (s.tycoon.built ?? 0) + done.length;
  for (const b of done) {
    if (b.kind === "office") { s.tycoon.offices = (s.tycoon.offices ?? 0) + 1; }
    else if (b.kind === "terrace") { if (s.cafe.terrace === 0) s.cafe.terrace = 1; }
    else if (b.kind === "land") { if (!s.land.includes(b.id as LandId)) s.land.push(b.id as LandId); }
    else if (b.kind === "hq") { const st = readyStage(s, b.id); if (st) s.tycoon.evolved[b.id] = st; }
    else if (b.kind === "project") { if (!s.cafe.done.includes(b.id as ProjectId)) s.cafe.done.push(b.id as ProjectId); }
    else if (b.kind === "home") { s.props[b.id] = Math.min(PROP_MAX, propLevel(s, b.id) + 1); }
  }
  return done;
}

/** Finishes a build now for crystals. */
export function finishNow(s: SaveData, kind: BuildKind, id = "", now = Date.now()): "ok" | "short" | "none" {
  const b = buildOf(s, kind, id);
  if (!b) return "none";
  const price = finishPrice(b.end - now);
  if (s.crystals < price) return "short";
  s.crystals -= price;
  b.end = now;
  completeBuilds(s, now);
  return "ok";
}

/** Hires another builder for crystals. */
export function hireBuilder(s: SaveData): "ok" | "short" | "max" {
  const n = Math.min(MAX_HIRED, s.tycoon.builders ?? 0);
  if (n >= MAX_HIRED) return "max";
  const price = BUILDER_PRICES[n];
  if (s.crystals < price) return "short";
  s.crystals -= price;
  s.tycoon.builders = n + 1;
  return "ok";
}

// (Kept for callers that build an office block at once, e.g. tests and older code.)
export { buildOffice };

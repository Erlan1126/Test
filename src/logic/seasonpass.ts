// The Season Pass (Buildaroo): while a season is on (data/season.ts), growing the city earns
// season points; ten rewards along a free track, and ten more on the premium track for
// crystals, among them the season's own building paint and, last, Solid Gold paint.
import { citySeason, seasonKey, type CitySeason } from "../data/season";
import { payStars } from "./tycoon";
import type { SaveData } from "./save";

export interface SeasonPassState { key: string; pts: number; free: number[]; prem: number[]; premium: boolean }
export const newSeasonPass = (): SeasonPassState => ({ key: "", pts: 0, free: [], prem: [], premium: false });

/** A reward: crystals, cash (in "stars", about a minute of earnings each), or a paint. */
export interface SPReward { crystals?: number; stars?: number; paint?: string }

export const SP_TIERS = [60, 160, 300, 480, 700, 960, 1260, 1600, 2000, 2500];
export const SP_FREE: SPReward[] = [
  { stars: 5 }, { crystals: 5 }, { stars: 8 }, { crystals: 10 }, { stars: 12 },
  { crystals: 15 }, { stars: 16 }, { crystals: 20 }, { stars: 25 }, { crystals: 30 },
];
/** The season's paint comes at tier 4 of the premium track ("season" stands for it). */
export const SP_PREMIUM: SPReward[] = [
  { crystals: 20 }, { stars: 20 }, { crystals: 30 }, { paint: "season" }, { stars: 40 },
  { crystals: 40 }, { stars: 60 }, { crystals: 50 }, { crystals: 60 }, { paint: "gold" },
];
export const SP_PRICE = 250;
export const SEASON_PAINT: Record<Exclude<CitySeason, "">, string> = { spring: "blossom", summer: "beach", halloween: "pumpkin", winter: "frost" };

/** This season's pass (a new one each season), or null when no season is on. */
export function seasonPass(s: SaveData, now = Date.now()): SeasonPassState | null {
  if (!citySeason(now)) return null;
  const key = seasonKey(now);
  if (s.seasonPass.key !== key) s.seasonPass = { ...newSeasonPass(), key };
  return s.seasonPass;
}

/** Season points for growing the city (the same things as the weekly event). */
export function seasonPoints(s: SaveData, n: number, now = Date.now()): number {
  const p = seasonPass(s, now);
  if (!p || !(n > 0)) return 0;
  p.pts = Math.min(1e6, p.pts + n);
  return n;
}

export const spTier = (p: SeasonPassState): number => SP_TIERS.filter(t => p.pts >= t).length;

/** The reward as it stands this season (the season's paint named). */
export function spReward(r: SPReward, now = Date.now()): SPReward {
  const se = citySeason(now);
  return r.paint === "season" && se ? { paint: SEASON_PAINT[se] } : r;
}

/** Rewards reached but not collected, on both tracks. */
export function spReady(s: SaveData, now = Date.now()): number {
  const p = seasonPass(s, now);
  if (!p) return 0;
  const n = spTier(p);
  let c = 0;
  for (let i = 0; i < n; i++) { if (!p.free.includes(i)) c++; if (p.premium && !p.prem.includes(i)) c++; }
  return c;
}

/** Collects one reward. Returns what it gave (cash paid, crystals, paint), or null. */
export function claimSP(s: SaveData, track: "free" | "prem", i: number, now = Date.now()): { cash: number; crystals: number; paint?: string } | null {
  const p = seasonPass(s, now);
  if (!p || i < 0 || i >= SP_TIERS.length || spTier(p) <= i) return null;
  const got = track === "free" ? p.free : p.prem;
  if (got.includes(i) || (track === "prem" && !p.premium)) return null;
  got.push(i);
  const r = spReward((track === "free" ? SP_FREE : SP_PREMIUM)[i], now);
  const out = { cash: 0, crystals: 0, paint: undefined as string | undefined };
  if (r.stars) out.cash = payStars(s, r.stars, now);
  if (r.crystals) { s.crystals += r.crystals; out.crystals = r.crystals; }
  if (r.paint) {
    if (!s.paints.includes(r.paint)) { s.paints.push(r.paint); out.paint = r.paint; }
    else { s.crystals += 25; out.crystals += 25; }
  }
  return out;
}

export function buySeasonPass(s: SaveData, now = Date.now()): "ok" | "short" | "owned" | "none" {
  const p = seasonPass(s, now);
  if (!p) return "none";
  if (p.premium) return "owned";
  if (s.crystals < SP_PRICE) return "short";
  s.crystals -= SP_PRICE;
  p.premium = true;
  return "ok";
}

export function normalizeSeasonPass(v: unknown): SeasonPassState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const ids = (x: unknown) => Array.isArray(x) ? [...new Set(x.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < SP_TIERS.length))] : [];
  return {
    key: typeof o.key === "string" ? o.key.slice(0, 24) : "",
    pts: typeof o.pts === "number" && Number.isFinite(o.pts) ? Math.max(0, Math.min(1e6, Math.floor(o.pts))) : 0,
    free: ids(o.free), prem: ids(o.prem), premium: o.premium === true,
  };
}

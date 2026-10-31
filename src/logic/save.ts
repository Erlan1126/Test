// Player progress: one versioned object in local storage, with migration from the
// older per-key format and transfer codes for moving progress to another device.
import { MISSION_KEYS, type Mission } from "../data/missions";
import { SKINS } from "../data/skins";
import type { BoostId } from "../data/shop";
import { ISLAND_THEMES } from "../data/islands";
import { CITY } from "../data/daily";
import type { Mode } from "./types";

export interface Settings {
  sound: boolean;
  music: boolean;
  vibrate: boolean;
  quality: "auto" | "high" | "low";
  /** Auto mode measured this device as slow. */
  autoLow: boolean;
}

export interface RunRecord {
  score: number;
  meters: number;
  floors: number;
  mode: Mode;
  /** Local calendar day it was built. */
  day: string;
}

export interface SaveData {
  v: 2;
  best: number;
  bestMeters: number;
  /** Spendable stars. */
  stars: number;
  /** All stars ever earned. */
  starsEarned: number;
  skin: string;
  island: string;
  /** Skins bought in the shop. */
  ownedSkins: string[];
  boosts: Record<BoostId, number>;
  missions: { slots: Mission[]; done: number; seen: number; day: string; chest: string };
  profile: {
    xp: number;
    level: number;
    towers: number;
    floors: number;
    perfects: number;
    penthouses: number;
    bestStreak: number;
    dailyDays: number[];
    trophies: string[];
    gift: { last: string; streak: number };
    swapDay: string;
  };
  daily: { day: number; best: number; plays: number };
  /** Landmark challenges completed. */
  challenges: string[];
  /** Your best towers, highest score first. */
  history: RunRecord[];
  settings: Settings;
  tutorialDone: boolean;
  /** Features whose "New" badge has been seen. */
  seenFeatures: string[];
  /** Days in a row with at least one tower. */
  streak: { count: number; best: number; last: string; freezes: number; freezeWeek: number; claimed: number[] };
  /** Coins from island rent, spent on city buildings. */
  coins: number;
  rent: { last: number };
  city: string[];
  league: { week: number; points: number; lastWeek: number; lastPoints: number; rewarded: number };
  /** A name shown on the leaderboard, chosen by the player. */
  nickname: string;
}

export const SAVE_KEY = "skyrise.save.v2";
export const HISTORY_SIZE = 10;

export function defaultSave(): SaveData {
  return {
    v: 2,
    best: 0,
    bestMeters: 0,
    stars: 0,
    starsEarned: 0,
    skin: "glass",
    island: "meadow",
    ownedSkins: [],
    boosts: { rewind: 0, xp: 0, gold: 0 },
    missions: { slots: [], done: 0, seen: 0, day: "", chest: "" },
    profile: {
      xp: 0, level: 1, towers: 0, floors: 0, perfects: 0, penthouses: 0, bestStreak: 0,
      dailyDays: [], trophies: [], gift: { last: "", streak: 0 }, swapDay: "",
    },
    daily: { day: 0, best: 0, plays: 0 },
    challenges: [],
    history: [],
    settings: { sound: true, music: true, vibrate: true, quality: "auto", autoLow: false },
    tutorialDone: false,
    seenFeatures: [],
    streak: { count: 0, best: 0, last: "", freezes: 0, freezeWeek: -1, claimed: [] },
    coins: 0,
    rent: { last: 0 },
    city: [],
    league: { week: 0, points: 0, lastWeek: 0, lastPoints: 0, rewarded: 0 },
    nickname: "",
  };
}

// ---------- Validation ----------
// Saves come from storage or from a pasted transfer code, so every field is checked
// and anything missing or malformed falls back to its default.

const num = (v: unknown, d: number, min = 0, max = 1e9): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const int = (v: unknown, d: number, min = 0, max = 1e9): number => Math.floor(num(v, d, min, max));
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const str = (v: unknown, d: string, max = 64): string => (typeof v === "string" && v.length <= max ? v : d);
const strList = (v: unknown, allowed?: string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && (!allowed || allowed.includes(x))))] : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalize(raw: unknown): SaveData {
  const d = defaultSave();
  const r = obj(raw);
  const p = obj(r.profile), m = obj(r.missions), set = obj(r.settings), dl = obj(r.daily), b = obj(r.boosts), gift = obj(p.gift);
  const skinIds = SKINS.map(s => s.id), themeIds = ISLAND_THEMES.map(t => t.id);
  const st = obj(r.streak), lg = obj(r.league);
  const slots: Mission[] = Array.isArray(m.slots)
    ? m.slots.map(obj).filter(s => MISSION_KEYS.includes(s.t as never))
        .map(s => {
          const ms: Mission = { t: s.t as Mission["t"], n: int(s.n, 1, 1), r: int(s.r, 1, 1, 3), p: num(s.p, 0) };
          if (s.d === true) ms.d = true;
          return ms;
        })
        .slice(0, 3)
    : [];
  const history: RunRecord[] = Array.isArray(r.history)
    ? r.history.map(obj).map(h => ({
        score: int(h.score, 0), meters: int(h.meters, 0), floors: int(h.floors, 0),
        mode: (["classic", "daily", "zen", "challenge"].includes(h.mode as string) ? h.mode : "classic") as Mode,
        day: str(h.day, ""),
      })).slice(0, HISTORY_SIZE)
    : [];
  return {
    v: 2,
    best: int(r.best, 0),
    bestMeters: int(r.bestMeters, 0),
    stars: int(r.stars, 0),
    starsEarned: int(r.starsEarned, 0),
    skin: skinIds.includes(r.skin as string) ? (r.skin as string) : d.skin,
    island: themeIds.includes(r.island as string) ? (r.island as string) : d.island,
    ownedSkins: strList(r.ownedSkins, skinIds),
    boosts: { rewind: int(b.rewind, 0, 0, 99), xp: int(b.xp, 0, 0, 99), gold: int(b.gold, 0, 0, 99) },
    missions: { slots, done: int(m.done, 0), seen: int(m.seen, 0), day: str(m.day, ""), chest: str(m.chest, "") },
    profile: {
      xp: num(p.xp, 0), level: int(p.level, 1, 1, 999), towers: int(p.towers, 0), floors: int(p.floors, 0),
      perfects: int(p.perfects, 0), penthouses: int(p.penthouses, 0), bestStreak: int(p.bestStreak, 0),
      dailyDays: Array.isArray(p.dailyDays) ? [...new Set(p.dailyDays.filter((x): x is number => Number.isInteger(x)))] : [],
      trophies: strList(p.trophies),
      gift: { last: str(gift.last, ""), streak: int(gift.streak, 0) },
      swapDay: str(p.swapDay, ""),
    },
    daily: { day: int(dl.day, 0), best: int(dl.best, 0), plays: int(dl.plays, 0) },
    challenges: strList(r.challenges),
    history,
    settings: {
      sound: bool(set.sound, true), music: bool(set.music, true), vibrate: bool(set.vibrate, true),
      quality: (["auto", "high", "low"].includes(set.quality as string) ? set.quality : "auto") as Settings["quality"],
      autoLow: bool(set.autoLow, false),
    },
    tutorialDone: bool(r.tutorialDone, false),
    seenFeatures: strList(r.seenFeatures),
    streak: {
      count: int(st.count, 0), best: int(st.best, 0), last: str(st.last, ""),
      freezes: int(st.freezes, 0, 0, 9), freezeWeek: int(st.freezeWeek, -1, -1),
      claimed: Array.isArray(st.claimed) ? [...new Set(st.claimed.filter((x): x is number => Number.isInteger(x)))] : [],
    },
    coins: int(r.coins, 0),
    rent: { last: num(obj(r.rent).last, 0) },
    city: strList(r.city, CITY.map(c => c.id)),
    league: {
      week: int(lg.week, 0, -1e6), points: int(lg.points, 0), lastWeek: int(lg.lastWeek, 0, -1e6),
      lastPoints: int(lg.lastPoints, 0), rewarded: int(lg.rewarded, 0, -1e6),
    },
    // Letters, digits, spaces and a little punctuation, up to 16 characters.
    nickname: str(r.nickname, "", 64).replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16),
  };
}

// ---------- Migration from the first version ----------

/** Builds a save from the older one-key-per-setting format, or returns null if there is none. */
export function migrateLegacy(get: (key: string) => string | null): SaveData | null {
  const keys = ["skyriseBest", "skyriseBestMeters", "skyriseMissions", "skyriseProfile", "skyriseSkin", "skyriseStyle", "skyriseTutorial"];
  if (!keys.some(k => get(k) !== null)) return null;
  const json = (k: string): Record<string, unknown> => {
    try { return obj(JSON.parse(get(k) ?? "null")); } catch { return {}; }
  };
  const missions = json("skyriseMissions"), profile = json("skyriseProfile"), daily = json("skyriseDaily");
  const oldStars = int(missions.stars, 0);
  const skin = get("skyriseSkin") ?? ["glass", "brick", "candy", "neon"][Number(get("skyriseStyle")) || 0];
  const save = normalize({
    best: Number(get("skyriseBest")) || 0,
    bestMeters: Number(get("skyriseBestMeters")) || 0,
    // Stars used to be a running total that unlocked skins at thresholds. Players keep the
    // total as spendable stars, and keep every skin those stars had already unlocked.
    stars: oldStars,
    starsEarned: oldStars,
    skin,
    island: profile.island,
    ownedSkins: SKINS.filter(s => s.unlock && "price" in s.unlock && oldStars >= s.unlock.price).map(s => s.id),
    missions: { slots: missions.slots, done: missions.done, seen: missions.seen },
    profile,
    daily,
    settings: {
      sound: get("skyriseMuted") !== "1",
      music: get("skyriseMusic") !== "0",
      vibrate: get("skyriseVibrate") !== "0",
      quality: get("skyriseQuality") ?? "auto",
      autoLow: get("skyriseAutoLow") === "1",
    },
    tutorialDone: get("skyriseTutorial") === "done",
    // Returning players already know every feature.
    seenFeatures: ["skins", "profile", "missions", "daily", "zen", "shop", "challenges"],
  });
  return save;
}

export function loadSave(storage: Pick<Storage, "getItem"> | null): SaveData {
  if (!storage) return defaultSave();
  const get = (k: string) => { try { return storage.getItem(k); } catch { return null; } };
  const raw = get(SAVE_KEY);
  if (raw) {
    try { return normalize(JSON.parse(raw)); } catch { /* fall through */ }
  }
  return migrateLegacy(get) ?? defaultSave();
}

export function writeSave(storage: Pick<Storage, "setItem"> | null, save: SaveData): void {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or blocked */ }
}

// ---------- Transfer codes ----------
// A code is the save as base64 text with a short checksum, so a mistyped or cut-off
// code is rejected instead of loading broken progress.

const PREFIX = "SKY2-";

function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64 = (b64: string): string => {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export function exportCode(save: SaveData): string {
  const body = toBase64(JSON.stringify(save));
  return `${PREFIX}${body}.${checksum(body)}`;
}

/** The save in a transfer code, or null if the code is invalid. */
export function importCode(code: string): SaveData | null {
  const clean = code.replace(/\s+/g, "");
  if (!clean.startsWith(PREFIX)) return null;
  const [body, sum] = clean.slice(PREFIX.length).split(".");
  if (!body || !sum || checksum(body) !== sum) return null;
  try {
    const raw = JSON.parse(fromBase64(body));
    return raw && raw.v === 2 ? normalize(raw) : null;
  } catch {
    return null;
  }
}

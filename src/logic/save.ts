// Player progress: one versioned object in local storage, with migration from the
// older per-key format and transfer codes for moving progress to another device.
import { newAsks, normalizeAsks, type AskState } from "./asks";
import { LAND, type LandId } from "../data/land";
import { normalizeDecor } from "./decor";
import { newCollection, normalizeCollection, type CollectionState } from "./collection";
import { normalizeCityTrophies } from "./cityach";
import { newCityEvent, normalizeCityEvent, type CityEventState } from "./cityevent";
import { OLD_FEATURE_TOWERS } from "./features";
import { ECONOMY, newTycoon, stageOf, type CompanyGoal, type TycoonState } from "./tycoon";
import { ADVISORS, BUSINESSES, UPGRADES, VAULT_COST } from "../data/tycoon";
import { addXp, xpNeeded } from "./rules";
import { LANGS, type LangSetting } from "../i18n";
import { cleanPace } from "./ghost";
import { COINS_PER_STAR } from "../data/daily";
import { MISSION_KEYS, type Mission } from "../data/missions";
import { OLD_SKIN_HEIGHTS, SKINS } from "../data/skins";
import { SHAPES } from "../data/shapes";
import { SKYLINE_SIZE, type SkylineTower } from "./skyline";
import { newCafe, normalizeCafe, type CafeState } from "./cafe";
import { newOrders, normalizeOrders, type OrdersState } from "./orders";
import { newSpire, normalizeSpire, type SpireSave } from "./spire";
import { ALL_POSTCARDS, migratePostcard } from "./postcards";
import type { BoostId } from "../data/shop";
import { ISLAND_THEMES, OLD_DISTRICT_PEOPLE, OLD_UPGRADE_HEIGHTS } from "../data/islands";
import { CITY } from "../data/daily";
import { PRODUCTS } from "../data/premium";
import type { Mode } from "./types";

/** Graphics version: when the graphics change a lot, every device tests its speed again
 *  instead of keeping "smooth mode" picked for the old graphics. */
const GFX = 4;

export interface Settings {
  sound: boolean;
  music: boolean;
  vibrate: boolean;
  quality: "auto" | "high" | "low";
  /** Auto mode measured this device as slow. */
  autoLow: boolean;
  /** Version of the automatic graphics choice; older choices are redone once. */
  gfx: number;
  /** Auto mode found even smooth 3D too slow here: use the simpler flat graphics. */
  flat: boolean;
  /** Language: "auto" follows the device. */
  lang: LangSetting;
  /** Time of day in the town: "auto" follows the real clock, or always day / night. */
  sky: "auto" | "day" | "night";
  /** Battery saver: 30 frames a second in the town, simpler graphics, no weather. */
  saver: boolean;
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
  /** Island upgrades kept from before they needed taller towers (see islandLevel). */
  islandKept: number;
  /** Districts kept open from before they needed more people. */
  keptDistricts: string[];
  /** 2 once unlocks earned under the old, easier thresholds have been kept. */
  unlocksV: number;
  /** Spendable stars. */
  stars: number;
  /** All stars ever earned. */
  starsEarned: number;
  skin: string;
  island: string;
  /** Skins bought in the shop. */
  ownedSkins: string[];
  /** The building shape (see data/shapes.ts) and the shapes bought in the shop. */
  shape: string;
  ownedShapes: string[];
  /** Island decorations bought with Sky Crystals (see data/decor.ts). */
  decor: string[];
  /** This week's city event (see logic/cityevent.ts). */
  cityEvent: CityEventState;
  /** The city album: kinds of buildings and places found by tapping them (data/sights.ts). */
  album: string[];
  /** The floating island next to the town (opens at Big City): what was built there. */
  annex: { pick: "" | "greenhouse" | "lookout" };
  /** Land bought next to the island (data/land.ts), in the order it was bought. */
  land: LandId[];
  /** The town's properties (data/props.ts): their level, by key (missing means level 1). */
  props: Record<string, number>;
  /** Neighbour requests (logic/asks.ts). */
  asks: AskState;
  /** The name the player gave their city (empty: not named yet). */
  cityName: string;
  /** The building collection book (logic/collection.ts). */
  collection: CollectionState;
  /** The city's trophies earned (logic/cityach.ts). */
  cityTrophies: string[];
  /** The town scrapbook: when each town rank was first reached (ms, by rank). */
  scrapbook: Record<string, number>;
  /** Your tallest towers, standing on their district's island. */
  skyline: SkylineTower[];
  /** People living in your sky city (every tower's people, for good). */
  population: number;
  /** Postcards collected (see logic/postcards.ts). */
  postcards: string[];
  /** The one-time Starter Pack: when it was first offered, and whether it was bought. */
  starter: { offeredAt: number; bought: boolean };
  /** Today's deals already bought (see logic/deals.ts). */
  deals: { day: number; bought: string[] };
  /** Towers built during this year's holiday event. */
  holiday: { key: string; towers: number };
  /** VIP subscription: on until this time (refreshed by the store), and the day its gift was last claimed. */
  vip: { until: number; claimed: number; gift: number };
  /** Crystal packs bought at least once (each one's first purchase pays double). */
  packsFirst: string[];
  /** Skyhaven Tycoon: businesses, coins, managers and New Era gems (see logic/tycoon.ts). */
  tycoon: TycoonState;
  /** This player's friend code (from the server), and friends' codes they added. */
  friendCode: string;
  friends: string[];
  /** The story (see chapters.ts): chapters finished, and the last chapter Mayor Pip introduced. */
  chapters: { done: number; seen: number; v?: number };
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
    /** The builder's avatar icon, its color and the frame around it (see avatars.ts). */
    avatar: string;
    avatarColor: number;
    frame: string;
    gift: { last: string; streak: number };
    swapDay: string;
  };
  daily: { day: number; best: number; plays: number };
  /** Landmark challenges completed. */
  challenges: string[];
  /** Your most recent finished tower: floors, metres, residents it added, district. */
  lastTower: { f: number; m: number; p: number; d: string } | null;
  /** The café loop: the starter tower, the terrace and the café contract (logic/cafe.ts). */
  cafe: CafeState;
  /** Building orders and the HQ towers the player built (logic/orders.ts). */
  orders: OrdersState;
  /** The Community Spire rewards collected this week (logic/spire.ts). */
  spire: SpireSave;
  /** The last week whose tournament prize was collected (or checked with no prize). */
  tourney: number;
  /** Your best Classic tower's pace, to race as a ghost (see logic/ghost.ts), and its score. */
  ghost: number[];
  ghostScore: number;
  /** Skyline Journey: best map stars (1-3) per stage, and chapter chests opened ("chest1"...). */
  journey: Record<string, number>;
  /** Your best towers, highest score first. */
  history: RunRecord[];
  settings: Settings;
  tutorialDone: boolean;
  /** Features whose "New" badge has been seen. */
  seenFeatures: string[];
  /** Days in a row with at least one tower. */
  streak: { count: number; best: number; last: string; freezes: number; freezeWeek: number; claimed: number[] };
  /** When rent (stars) was last collected. */
  rent: { last: number };
  city: string[];
  /** Where the player moved city buildings: building id → spot id (see cityplace.ts). */
  cityPlace: Record<string, string>;
  league: { week: number; points: number; lastWeek: number; lastPoints: number; rewarded: number };
  /** A name shown on the leaderboard, chosen by the player. */
  nickname: string;
  /** Private key for posting to the worldwide rankings (from the server, on first use). */
  onlineToken: string;
  /** Code that restores this player (and their cloud backup) on another device. */
  recoveryCode: string;
  /** Ranked towers not sent yet (no connection), oldest first. */
  pendingRuns: unknown[];
  /** Leaderboard players this person reported or blocked; their names are hidden here. */
  blocked: string[];
  /** Premium items owned (bought with Sky Crystals). */
  purchases: string[];
  /** Sky Crystals, the paid currency. */
  crystals: number;
  /** Store or checkout transactions already turned into crystals, so none pays twice. */
  crystalTx: string[];
  /** This season's Sky Pass. */
  pass: { season: number; xp: number; premium: boolean; free: number[]; prem: number[] };
  /** Products whose one-off stars (once coins) have been paid. */
  coinsGranted: string[];
  /** Random id the payment server knows this player by. Made on first launch. */
  playerId: string;
}

export const SAVE_KEY = "skyrise.save.v2";
export const HISTORY_SIZE = 10;

export function defaultSave(): SaveData {
  return {
    v: 2,
    best: 0,
    bestMeters: 0,
    islandKept: 0,
    keptDistricts: [],
    unlocksV: 3,
    stars: 0,
    starsEarned: 0,
    skin: "glass",
    island: "meadow",
    ownedSkins: [],
    shape: "square",
    ownedShapes: [],
    decor: [],
    cityEvent: newCityEvent(),
    album: [],
    annex: { pick: "" },
    land: [],
    props: {},
    asks: newAsks(),
    cityName: "",
    collection: newCollection(),
    cityTrophies: [],
    scrapbook: {},
    skyline: [],
    population: 0,
    postcards: [],
    deals: { day: 0, bought: [] },
    starter: { offeredAt: 0, bought: false },
    holiday: { key: "", towers: 0 },
    vip: { until: 0, claimed: 0, gift: 0 },
    packsFirst: [],
    chapters: { done: 0, seen: -1, v: 2 },
    friendCode: "",
    friends: [],
    tycoon: newTycoon(),
    boosts: { rewind: 0, xp: 0, gold: 0 },
    missions: { slots: [], done: 0, seen: 0, day: "", chest: "" },
    profile: {
      xp: 0, level: 1, towers: 0, floors: 0, perfects: 0, penthouses: 0, bestStreak: 0,
      dailyDays: [], trophies: [], gift: { last: "", streak: 0 }, swapDay: "", avatar: "tower", avatarColor: 0, frame: "none",
    },
    daily: { day: 0, best: 0, plays: 0 },
    challenges: [],
    journey: {},
    ghost: [],
    ghostScore: 0,
    tourney: -1,
    lastTower: null,
    cafe: newCafe(),
    orders: newOrders(),
    spire: newSpire(),
    history: [],
    settings: { sound: true, music: true, vibrate: true, quality: "auto", autoLow: false, gfx: GFX, flat: false, lang: "auto", sky: "auto", saver: false },
    tutorialDone: false,
    seenFeatures: [],
    streak: { count: 0, best: 0, last: "", freezes: 0, freezeWeek: -1, claimed: [] },
    rent: { last: 0 },
    city: [],
    cityPlace: {},
    league: { week: -1, points: 0, lastWeek: -1, lastPoints: 0, rewarded: -1 },
    nickname: "",
    onlineToken: "",
    recoveryCode: "",
    pendingRuns: [],
    blocked: [],
    purchases: [],
    crystals: 0,
    crystalTx: [],
    pass: { season: -999, xp: 0, premium: false, free: [], prem: [] },
    coinsGranted: [],
    playerId: "",
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
const lastTower = (v: unknown): SaveData["lastTower"] => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>, n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
  return { f: n(o.f), m: n(o.m), p: n(o.p), d: typeof o.d === "string" ? o.d.slice(0, 24) : "" };
};
/** A { key: 1-3 } map, dropping anything else. */
const starMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === "number" && n >= 1 && n <= 3 && k.length < 24) out[k] = Math.floor(n);
    }
  }
  return out;
};
const strList = (v: unknown, allowed?: string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && (!allowed || allowed.includes(x))))] : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalize(raw: unknown): SaveData {
  const d = defaultSave();
  const r = obj(raw);
  const p = obj(r.profile), m = obj(r.missions), set = obj(r.settings), dl = obj(r.daily), b = obj(r.boosts), gift = obj(p.gift);
  const shapeIds = SHAPES.map(s => s.id);
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
  const save: SaveData = {
    v: 2,
    best: int(r.best, 0),
    bestMeters: int(r.bestMeters, 0),
    // Saves from before carry the upgrades their best tower had built under the old heights.
    keptDistricts: strList(r.keptDistricts, ISLAND_THEMES.map(t => t.id)),
    unlocksV: int(r.unlocksV, 1),
    islandKept: r.islandKept === undefined
      ? OLD_UPGRADE_HEIGHTS.filter(m => int(r.bestMeters, 0) > m).length
      : Math.min(OLD_UPGRADE_HEIGHTS.length, int(r.islandKept, 0)),
    // Coins were folded into stars: old saves get theirs converted once.
    stars: int(r.stars, 0) + Math.floor(int(r.coins, 0) / COINS_PER_STAR),
    starsEarned: int(r.starsEarned, 0),
    skin: skinIds.includes(r.skin as string) ? (r.skin as string) : d.skin,
    island: themeIds.includes(r.island as string) ? (r.island as string) : d.island,
    ownedSkins: strList(r.ownedSkins, skinIds),
    shape: shapeIds.includes(r.shape as string) ? (r.shape as string) : d.shape,
    ownedShapes: strList(r.ownedShapes, shapeIds),
    decor: normalizeDecor(r.decor),
    cityEvent: normalizeCityEvent(r.cityEvent),
    album: Array.isArray(r.album) ? [...new Set((r.album as unknown[]).filter((x): x is string => typeof x === "string" && x.length < 30))].slice(0, 200) : [],
    scrapbook: Object.fromEntries(Object.entries((r.scrapbook && typeof r.scrapbook === "object" ? r.scrapbook : {}) as Record<string, unknown>).filter(([k, v]) => /^[0-9]$/.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0)) as Record<string, number>,
    asks: normalizeAsks(r.asks),
    cityName: cleanCityName(r.cityName),
    collection: normalizeCollection(r.collection),
    cityTrophies: normalizeCityTrophies(r.cityTrophies),
    props: Object.fromEntries(Object.entries((r.props && typeof r.props === "object" ? r.props : {}) as Record<string, unknown>).filter(([k, v]) => /^[a-z0-9]{1,4}:-?\d{1,2},-?\d{1,2}$/.test(k) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5).slice(0, 400)) as Record<string, number>,
    land: (Array.isArray(r.land) ? r.land : []).filter((x, i, a): x is LandId => LAND.some(l => l.id === x) && a.indexOf(x) === i),
    annex: { pick: ((p: unknown) => (p === "greenhouse" || p === "lookout" ? p : ""))((r.annex as { pick?: unknown } | undefined)?.pick) },
    skyline: (Array.isArray(r.skyline) ? r.skyline : []).slice(0, SKYLINE_SIZE * 8).map(x => obj(x))
      .map(x => ({ f: int(x.f, 0, 0, 9999), s: skinIds.includes(x.s as string) ? (x.s as string) : "glass", h: shapeIds.includes(x.h as string) ? (x.h as string) : "square", d: themeIds.includes(x.d as string) ? (x.d as string) : "meadow" }))
      .filter(x => x.f > 0),
    postcards: strList(Array.isArray(r.postcards) ? r.postcards.map(x => (typeof x === "string" ? migratePostcard(x) : x)) : r.postcards, ALL_POSTCARDS),
    // Players from before the city get a head start from their best tower.
    population: r.population === undefined ? int(r.best, 0) * 3 : int(r.population, 0, 0, 1e12),
    deals: { day: int(obj(r.deals).day, 0), bought: strList(obj(r.deals).bought).slice(0, 10) },
    starter: { offeredAt: num(obj(r.starter).offeredAt, 0, 0, 1e15), bought: obj(r.starter).bought === true },
    holiday: { key: str(obj(r.holiday).key, "").slice(0, 40), towers: int(obj(r.holiday).towers, 0, 0, 9999) },
    vip: { until: num(obj(r.vip).until, 0, 0, 1e15), claimed: int(obj(r.vip).claimed, 0), gift: num(obj(r.vip).gift, 0, 0, 1e15) },
    packsFirst: strList(r.packsFirst),
    chapters: { done: int(obj(r.chapters).done, 0, 0, 99), seen: int(obj(r.chapters).seen, -1, -1, 99), v: int(obj(r.chapters).v, 0, 0, 99) },
    tycoon: normalizeTycoon(r.tycoon, Number(obj(r.profile).floors) || 0),
    friendCode: /^[A-Z2-9]{6}$/.test(String(r.friendCode ?? "")) ? String(r.friendCode) : "",
    friends: strList(r.friends).filter(c => /^[A-Z2-9]{6}$/.test(c)).slice(0, 30),
    boosts: { rewind: int(b.rewind, 0, 0, 99), xp: int(b.xp, 0, 0, 99), gold: int(b.gold, 0, 0, 99) },
    missions: { slots, done: int(m.done, 0), seen: int(m.seen, 0), day: str(m.day, ""), chest: str(m.chest, "") },
    profile: {
      xp: num(p.xp, 0), level: int(p.level, 1, 1, 999), towers: int(p.towers, 0), floors: int(p.floors, 0),
      perfects: int(p.perfects, 0), penthouses: int(p.penthouses, 0), bestStreak: int(p.bestStreak, 0),
      avatar: str(p.avatar, "tower").slice(0, 20), avatarColor: int(p.avatarColor, 0, 0, 7), frame: str(p.frame, "none").slice(0, 12),
      dailyDays: Array.isArray(p.dailyDays) ? [...new Set(p.dailyDays.filter((x): x is number => Number.isInteger(x)))] : [],
      trophies: strList(p.trophies),
      gift: { last: str(gift.last, ""), streak: int(gift.streak, 0) },
      swapDay: str(p.swapDay, ""),
    },
    daily: { day: int(dl.day, 0), best: int(dl.best, 0), plays: int(dl.plays, 0) },
    challenges: strList(r.challenges),
    journey: starMap(r.journey),
    ghost: cleanPace(r.ghost),
    ghostScore: typeof r.ghostScore === "number" && Number.isFinite(r.ghostScore) ? Math.max(0, Math.floor(r.ghostScore)) : 0,
    lastTower: lastTower(r.lastTower),
    cafe: normalizeCafe(r.cafe, { floors: typeof obj(r.tycoon).floors === "number" ? Number(obj(r.tycoon).floors) : int(obj(r.profile).floors, 0), towers: int(obj(r.profile).towers, 0) }),
    orders: normalizeOrders(r.orders, BUSINESSES.map(b => b.id)),
    spire: normalizeSpire(r.spire),
    tourney: typeof r.tourney === "number" && Number.isFinite(r.tourney) ? Math.floor(r.tourney) : -1,
    history,
    settings: {
      sound: bool(set.sound, true), music: bool(set.music, true), vibrate: bool(set.vibrate, true),
      quality: (["auto", "high", "low"].includes(set.quality as string) ? set.quality : "auto") as Settings["quality"],
      // Saves from before the sharper graphics re-measure the device once.
      autoLow: set.gfx === GFX ? bool(set.autoLow, false) : false,
      gfx: GFX,
      flat: set.gfx === GFX ? bool(set.flat, false) : false,
      lang: (["auto", ...LANGS].includes(set.lang as string) ? set.lang : "auto") as Settings["lang"],
      sky: (["auto", "day", "night"].includes(set.sky as string) ? set.sky : "auto") as Settings["sky"],
      saver: bool(set.saver, false),
    },
    tutorialDone: bool(r.tutorialDone, false),
    seenFeatures: strList(r.seenFeatures),
    streak: {
      count: int(st.count, 0), best: int(st.best, 0), last: str(st.last, ""),
      freezes: int(st.freezes, 0, 0, 9), freezeWeek: int(st.freezeWeek, -1, -1),
      claimed: Array.isArray(st.claimed) ? [...new Set(st.claimed.filter((x): x is number => Number.isInteger(x)))] : [],
    },
    rent: { last: num(obj(r.rent).last, 0, 0, 1e15) }, // a timestamp in ms, far above the default cap
    city: strList(r.city, CITY.map(c => c.id)),
    cityPlace: Object.fromEntries(Object.entries(obj(r.cityPlace))
      .filter((e): e is [string, string] => CITY.some(c => c.id === e[0]) && typeof e[1] === "string" && CITY.some(c => c.id === e[1]))),
    league: {
      week: int(lg.week, -1, -1e6), points: int(lg.points, 0), lastWeek: int(lg.lastWeek, -1, -1e6),
      lastPoints: int(lg.lastPoints, 0), rewarded: int(lg.rewarded, -1, -1e6),
    },
    // Letters, digits, spaces and a little punctuation, up to 16 characters.
    onlineToken: /^[a-f0-9]{48}$/.test(String(r.onlineToken ?? "")) ? String(r.onlineToken) : "",
    recoveryCode: /^[A-HJ-NP-Z2-9]{12}$/.test(String(r.recoveryCode ?? "")) ? String(r.recoveryCode) : "",
    // Checked properly by the server when sent; here just kept small.
    pendingRuns: Array.isArray(r.pendingRuns)
      ? r.pendingRuns.filter(x => obj(x).v === 1 && Array.isArray(obj(x).log) && (obj(x).log as unknown[]).length <= 5000).slice(-5)
      : [],
    blocked: strList(r.blocked).filter(x => /^[A-Za-z0-9-]{8,64}$/.test(x)).slice(-200),
    nickname: str(r.nickname, "", 64).replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16),
    purchases: strList(r.purchases, PRODUCTS.map(x => x.id)),
    crystals: int(r.crystals, 0, 0, 1e7),
    crystalTx: strList(r.crystalTx).filter(x => x.length <= 200).slice(-300),
    pass: (() => {
      const ps = obj(r.pass);
      const tiers = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 30))] : [];
      return { season: int(ps.season, -999, -999, 1e4), xp: int(ps.xp, 0), premium: bool(ps.premium, false), free: tiers(ps.free), prem: tiers(ps.prem) };
    })(),
    coinsGranted: strList(r.coinsGranted, PRODUCTS.map(x => x.id)),
    playerId: /^[A-Za-z0-9-]{8,64}$/.test(String(r.playerId ?? "")) ? String(r.playerId) : "",
  };
  // Unlocks got harder (towers 2026-11). Saves from before keep everything they had:
  // the height skins their best tower had already reached, and the districts open then.
  if (save.unlocksV < 2) {
    for (const [id, m] of Object.entries(OLD_SKIN_HEIGHTS)) if (save.bestMeters > m && !save.ownedSkins.includes(id)) save.ownedSkins.push(id);
    const oldLevel: Record<string, number> = { snow: 3, desert: 6 };
    for (const [id, people] of Object.entries(OLD_DISTRICT_PEOPLE)) {
      const open = save.population >= people || (oldLevel[id] !== undefined && save.profile.level >= oldLevel[id]);
      if (open && !save.keptDistricts.includes(id)) save.keptDistricts.push(id);
    }
    save.unlocksV = 2;
  }
  // XP past what the level needs (a hand-edited save, or progress from when levels needed
  // more XP) becomes levels, capped so an edited save can't jump dozens of levels.
  if (save.profile.xp >= xpNeeded(save.profile.level)) {
    const lv = addXp(save.profile.level, 0, Math.min(save.profile.xp, xpNeeded(save.profile.level) * 3));
    save.profile.level = lv.level;
    save.profile.xp = Math.min(lv.xp, xpNeeded(lv.level) - 1);
  }
  // Features opened by tower count before they moved to levels (2026-11): keep them.
  if (save.unlocksV < 3) {
    for (const [f, n] of Object.entries(OLD_FEATURE_TOWERS)) if (save.profile.towers >= (n ?? Infinity) && !save.seenFeatures.includes(f)) save.seenFeatures.push(f);
    save.unlocksV = 3;
  }
  return save;
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
    // The first version unlocked these at 10, 25 and 50 stars (prices are higher now).
    ownedSkins: Object.entries({ starlight: 10, rainbow: 25, aurora: 50 }).filter(([, n]) => oldStars >= n).map(([id]) => id),
    missions: { slots: missions.slots, done: missions.done, seen: missions.seen },
    profile,
    daily,
    settings: {
      sound: get("skyriseMuted") !== "1",
      music: get("skyriseMusic") !== "0",
      vibrate: get("skyriseVibrate") !== "0",
      quality: get("skyriseQuality") ?? "auto",
      autoLow: get("skyriseAutoLow") === "1",
      lang: "auto",
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

/** Writes the save and reads it back: true only if it's really there (for purchases, which
 *  must not be confirmed to the store before they're saved). */
export function writeSaveChecked(storage: Pick<Storage, "setItem" | "getItem"> | null, save: SaveData): boolean {
  if (!storage) return false;
  const json = JSON.stringify(save);
  try {
    storage.setItem(SAVE_KEY, json);
    return storage.getItem(SAVE_KEY) === json;
  } catch {
    return false;
  }
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

/** Tycoon numbers can be astronomically large, so they're checked as finite, not capped. */
function normalizeEvolved(v: unknown, levels: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (BUSINESSES.some(b => b.id === k) && Number.isInteger(x) && (x as number) > 0) out[k] = Math.min(7, x as number);
  } else {
    for (const [k, lv] of Object.entries(levels)) { const st = stageOf(lv); if (st > 0) out[k] = st; }
  }
  return out;
}

function normalizeGoals(v: unknown): TycoonState["goals"] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const kinds = ["vip", "buy", "taps", "rush", "build", "home", "ask"];
  const list = Array.isArray(o.list) ? o.list.filter((g): g is CompanyGoal => !!g && typeof g === "object" && kinds.includes((g as CompanyGoal).t)
    && Number.isInteger((g as CompanyGoal).n) && (g as CompanyGoal).n > 0 && typeof (g as CompanyGoal).p === "number").slice(0, 3)
    .map(g => ({ t: g.t, n: g.n, p: Math.max(0, Math.min(g.n, Math.floor(g.p))) })) : [];
  return { day: typeof o.day === "string" ? o.day.slice(0, 12) : "", list, bonus: o.bonus === true };
}

function normalizeBuilds(v: unknown): TycoonState["builds"] {
  if (!Array.isArray(v)) return [];
  const kinds = ["office", "terrace", "land", "home", "hq", "project"] as const;
  return v.filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .filter(b => kinds.includes(b.kind as (typeof kinds)[number]) && typeof b.id === "string" && Number.isFinite(b.start) && Number.isFinite(b.end))
    .slice(0, 6)
    .map(b => ({ kind: b.kind as (typeof kinds)[number], id: String(b.id).slice(0, 40), start: Number(b.start), end: Number(b.end) }));
}

function normalizeTycoon(v: unknown, floorsBefore = 0): TycoonState {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const big = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
  const ids = BUSINESSES.map(b => b.id);
  const levels: Record<string, number> = {};
  for (const [k, x] of Object.entries((o.levels && typeof o.levels === "object" ? o.levels : {}) as Record<string, unknown>)) {
    if (ids.includes(k) && Number.isInteger(x) && (x as number) > 0) levels[k] = Math.min(x as number, 100000);
  }
  if (!levels.coffee) levels.coffee = 1;
  const managers0 = Array.isArray(o.managers) ? o.managers : [];
  // A company from the first economy (when everything grew far too fast) starts over once.
  // It keeps its office floors and the crystal coin booster it paid for.
  if (v && typeof v === "object" && o.econ !== ECONOMY) {
    const fresh = newTycoon();
    fresh.fresh = true;
    fresh.floors = Math.floor(typeof o.floors === "number" ? big(o.floors) : big(floorsBefore));
    fresh.boost = o.boost === true;
    // Advisors can be bought with crystals: never take them away.
    fresh.advisors = Array.isArray(o.advisors) ? [...new Set(o.advisors.filter((x): x is string => typeof x === "string" && ADVISORS.some(a => a.id === x)))] : [];
    fresh.picks = Math.min(ADVISORS.length, Math.floor(big(o.picks)));
    return fresh;
  }
  const runs: Record<string, number> = {};
  for (const [k, x] of Object.entries((o.runs && typeof o.runs === "object" ? o.runs : {}) as Record<string, unknown>)) {
    if (ids.includes(k)) runs[k] = big(x);
  }
  return {
    coins: big(o.coins), lifetime: Math.max(big(o.lifetime), big(o.coins)), levels,
    managers: Array.isArray(o.managers) ? [...new Set(o.managers.filter((x): x is string => typeof x === "string" && ids.includes(x)))] : [],
    runs, gems: Math.floor(big(o.gems)), boost: o.boost === true, last: big(o.last), eras: Math.floor(big(o.eras)),
    rankBest: Math.min(10, Math.floor(big(o.rankBest))),
    // Saves from before office floors start with every floor they had built.
    floors: Math.floor(typeof o.floors === "number" ? big(o.floors) : big(floorsBefore)),
    speedups: { day: typeof (o.speedups as { day?: unknown })?.day === "string" ? String((o.speedups as { day: string }).day).slice(0, 12) : "", n: Math.floor(big((o.speedups as { n?: unknown })?.n)) },
    econ: ECONOMY,
    // Saves from before headquarters had to be built keep the stages they had reached.
    evolved: normalizeEvolved(o.evolved, levels),
    upgrades: Array.isArray(o.upgrades) ? [...new Set(o.upgrades.filter((x): x is string => typeof x === "string" && UPGRADES.some(u => u.id === x)))] : [],
    advisors: Array.isArray(o.advisors) ? [...new Set(o.advisors.filter((x): x is string => typeof x === "string" && ADVISORS.some(a => a.id === x)))] : [],
    picks: Math.min(ADVISORS.length, Math.floor(big(o.picks))),
    vault: Math.min(VAULT_COST.length, Math.floor(big(o.vault))),
    boom: big(o.boom),
    reviews: Object.fromEntries(Object.entries((o.reviews && typeof o.reviews === "object" ? o.reviews : {}) as Record<string, unknown>).filter(([k]) => ids.includes(k)).map(([k, x]) => [k, big(x)])),
    fresh: o.fresh === true,
    // Grown companies from before grand openings count as having had theirs.
    opening: typeof o.opening === "number" ? big(o.opening) : big(o.lifetime) > 2000 ? 1 : 0,
    offices: Math.min(100000, Math.floor(big(o.offices))),
    builds: normalizeBuilds(o.builds),
    builders: Math.min(2, Math.floor(big(o.builders))),
    built: Math.min(1e6, Math.floor(big(o.built))),
    golden: { day: typeof (o.golden as { day?: unknown })?.day === "string" ? String((o.golden as { day: string }).day).slice(0, 12) : "", n: Math.floor(big((o.golden as { n?: unknown })?.n)) },
    tips: managers0.length ? 3 : Math.min(3, Math.floor(big(o.tips))),
    goals: normalizeGoals(o.goals),
    rush: { id: typeof (o.rush as { id?: unknown })?.id === "string" && ids.includes((o.rush as { id: string }).id) ? (o.rush as { id: string }).id : "", until: big((o.rush as { until?: unknown })?.until) },
  };
}

/** A city name as the player typed it: plain text, one line, at most 18 characters. */
export function cleanCityName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

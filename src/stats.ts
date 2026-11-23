// Anonymous play statistics, so the game's difficulty and rewards can be tuned from how
// real players play rather than guesses: how tall towers get, how many towers people
// build, and whether they come back on later days.
//
// Nothing personal is sent. Each install makes up a random id that is never linked to the
// player's rankings id, name, save or device. Each item says only: which day since this
// install first played, how many towers this install has built, and the tower itself
// (mode, floors, meters, perfect drops, score, level, whether a rewind was used), or a
// named step of a new player's first session (first tower, first district visit, first
// sale, terrace unlocked, terrace opened, third tower started).
//
// What's waiting to be sent is kept on the device, so closing the app offline loses
// nothing; every item carries its own id, so sending it again after a lost reply is
// counted once (the server skips ids it already has).
import { SERVER_URL } from "./data/server";
import type { RunSummary } from "./logic/types";
import { EDITION } from "./edition";

const KEY = "skyrise.stats";
const QUEUE_KEY = "skyrise.stats.queue";
interface Local { id: string; first: number; lastOpen: number; n?: number; once?: string[] }

interface Item {
  kind: "open" | "tower" | "event";
  day: number;
  towers: number;
  /** This item's own id (per install), so a resend is never counted twice. */
  eid?: string;
  data?: Record<string, unknown>;
}

/** Items waiting to be sent (kept on the device). */
let queue: Item[] = [];
let queueLoaded = false;
let lastTowers = 0;
const MAX_QUEUE = 60;

function loadQueue(): void {
  if (queueLoaded) return;
  queueLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    if (Array.isArray(raw)) queue = [...raw.filter((x): x is Item => !!x && typeof x === "object" && typeof (x as Item).kind === "string").slice(-MAX_QUEUE), ...queue];
  } catch { /* nothing kept */ }
}
function saveQueue(): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))); } catch { /* private mode */ }
}
/** Adds an item with a fresh id, kept until it's sent. */
function enqueue(l: Local, item: Item): void {
  loadQueue();
  l.n = (l.n ?? 0) + 1;
  item.eid = `${l.n}`;
  save();
  queue.push(item);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  saveQueue();
}
let local: Local | null = null;
let version = "web";

const today = () => Math.floor(Date.now() / 864e5);

function load(): Local | null {
  if (local) return local;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Local> | null;
    if (raw && typeof raw.id === "string" && Number.isFinite(raw.first)) local = { id: raw.id, first: raw.first!, lastOpen: raw.lastOpen ?? -1, n: Number.isFinite(raw.n) ? raw.n : 0, once: Array.isArray(raw.once) ? raw.once.filter((x): x is string => typeof x === "string") : [] };
    else {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      local = { id, first: today(), lastOpen: -1 };
    }
    localStorage.setItem(KEY, JSON.stringify(local));
  } catch { local = null; }
  return local;
}

function save(): void {
  try { if (local) localStorage.setItem(KEY, JSON.stringify(local)); } catch { /* private mode */ }
}

export function setStatsVersion(v: string): void { version = v; }

/** Once a day, that this install opened the game (for "do players come back?"). */
export function statsOpen(towers: number): void {
  const l = SERVER_URL ? load() : null;
  lastTowers = towers;
  if (!l || l.lastOpen === today()) return;
  l.lastOpen = today();
  save();
  enqueue(l, { kind: "open", day: today() - l.first, towers });
}

/** A step of a new player's first session (or another named moment). Steps sent `once`
 *  (the default) are counted only the first time on this install. */
export function track(name: string, data: Record<string, unknown> = {}, once = true): void {
  const l = SERVER_URL ? load() : null;
  if (!l) return;
  if (once) {
    l.once ??= [];
    if (l.once.includes(name)) return;
    l.once.push(name);
  }
  enqueue(l, { kind: "event", day: today() - l.first, towers: lastTowers, data: { name, ...data } });
}

/** A finished tower. */
export function statsTower(run: RunSummary, towers: number, level: number): void {
  const l = SERVER_URL ? load() : null;
  if (!l) return;
  lastTowers = towers;
  enqueue(l, {
    kind: "tower", day: today() - l.first, towers,
    data: { mode: run.mode, floors: run.floors, meters: run.meters, perfects: run.perfects, streak: run.bestStreak, score: run.score, level, rewind: run.rewindsUsed > 0 },
  });
}

/** Sends what's waiting (keeps it for later if there's no connection). */
export async function flushStats(lang: string): Promise<void> {
  const l = load();
  loadQueue();
  if (!SERVER_URL || !l || !queue.length || sending) return;
  sending = true;
  const items = queue.slice(0, 20);
  try {
    const res = await fetch(`${SERVER_URL.replace(/\/$/, "")}/stats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: l.id, v: EDITION === "full" ? version : `${EDITION}-${version}`, lang, items }),
    });
    if (!res.ok) throw new Error(String(res.status));
    // Sent: forget them (only now, so closing the app mid-send loses nothing).
    queue = queue.filter(x => !items.includes(x));
    saveQueue();
  } catch {
    /* kept for next time; the server skips any it already got */
  } finally {
    sending = false;
  }
}
let sending = false;

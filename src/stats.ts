// Anonymous play statistics, so the game's difficulty and rewards can be tuned from how
// real players play rather than guesses: how tall towers get, how many towers people
// build, and whether they come back on later days.
//
// Nothing personal is sent. Each install makes up a random id that is never linked to the
// player's rankings id, name, save or device. Each item says only: which day since this
// install first played, how many towers this install has built, and the tower itself
// (mode, floors, meters, perfect drops, score, level, whether a rewind was used).
import { SERVER_URL } from "./data/server";
import type { RunSummary } from "./logic/types";

const KEY = "skyrise.stats";
interface Local { id: string; first: number; lastOpen: number }

interface Item {
  kind: "open" | "tower";
  day: number;
  towers: number;
  data?: Record<string, unknown>;
}

const queue: Item[] = [];
let local: Local | null = null;
let version = "web";

const today = () => Math.floor(Date.now() / 864e5);

function load(): Local | null {
  if (local) return local;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Local> | null;
    if (raw && typeof raw.id === "string" && Number.isFinite(raw.first)) local = { id: raw.id, first: raw.first!, lastOpen: raw.lastOpen ?? -1 };
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
  if (!l || l.lastOpen === today()) return;
  l.lastOpen = today();
  save();
  queue.push({ kind: "open", day: today() - l.first, towers });
}

/** A finished tower. */
export function statsTower(run: RunSummary, towers: number, level: number): void {
  const l = SERVER_URL ? load() : null;
  if (!l) return;
  queue.push({
    kind: "tower", day: today() - l.first, towers,
    data: { mode: run.mode, floors: run.floors, meters: run.meters, perfects: run.perfects, streak: run.bestStreak, score: run.score, level, rewind: run.rewindsUsed > 0 },
  });
  if (queue.length > 40) queue.shift();
}

/** Sends what's waiting (keeps it for later if there's no connection). */
export async function flushStats(lang: string): Promise<void> {
  const l = load();
  if (!SERVER_URL || !l || !queue.length) return;
  const items = queue.splice(0, 20);
  try {
    const res = await fetch(`${SERVER_URL.replace(/\/$/, "")}/stats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: l.id, v: version, lang, items }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    queue.unshift(...items);
  }
}

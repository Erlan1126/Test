// Anonymous crash and frame-rate reports, so problems on real phones can be found and
// fixed. Nothing personal is sent: no player id, name or save. Just the error message, the
// app version, the phone model and graphics chip, and how smoothly towers ran.
import { App as CapApp } from "@capacitor/app";
import { SENTRY_DSN, SERVER_URL } from "./data/server";
import { EDITION } from "./edition";
import { isNative } from "./native";
import { setStatsVersion } from "./stats";

interface Item { kind: "error" | "perf"; msg: string; data?: Record<string, unknown> }

const KEEP = "skyrise.diag";
const queue: Item[] = [];
const seen = new Map<string, number>();
let version = "web";
/** Which game sent a report: both share the server, so their reports must not mix. */
const GAME = EDITION === "skyrise" ? "skyrise" : "buildaroo";
/** What was on screen: the open sheet or dialog, or the game's state. */
function screen(): string {
  const open = [...document.querySelectorAll<HTMLElement>(".modal:not([hidden]), .mayor-dialog:not([hidden]), [role=dialog]:not([hidden])")].map(e => e.id).filter(Boolean);
  return [stateOf(), ...open].join(" ");
}
let stateOf: () => string = () => "";
/** The game tells reports what it's doing (playing, menu, over, in the city...). */
export function setDiagState(fn: () => string): void { stateOf = fn; }
let device = "";

/** The phone model and graphics chip, e.g. "SM-A536E · Mali-G68". */
function describeDevice(): string {
  const ua = navigator.userAgent;
  const model = /Android [\d.]+; ([^;)]+)/.exec(ua)?.[1]?.replace(/ Build.*$/, "") ?? (/iPhone|iPad/.exec(ua)?.[0] ?? "desktop");
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 60);
  } catch { /* no WebGL */ }
  return [model, gpu].filter(Boolean).join(" · ");
}

function add(item: Item): void {
  const n = seen.get(item.msg) ?? 0;
  if (item.kind === "error" && n >= 3) return; // the same error once is enough to know
  seen.set(item.msg, n + 1);
  if (item.kind === "error") {
    item.data = { ...item.data, screen: screen() };
    toSentry(item);
    recent.push({ at: new Date().toISOString(), msg: item.msg, where: String(item.data?.at ?? "") });
    if (recent.length > 20) recent.shift();
  }
  queue.push(item);
  if (queue.length > 30) queue.shift();
  keep();
}

/** Errors wait in storage until they're sent, so one that comes just before the app is
 *  closed (or crashes) is still sent the next time it opens. */
function keep(): void {
  try { localStorage.setItem(KEEP, JSON.stringify(queue.filter(i => i.kind === "error"))); } catch { /* storage full or blocked */ }
}

export function initDiag(): void {
  if (!SERVER_URL) return;
  device = describeDevice();
  try {
    const kept = JSON.parse(localStorage.getItem(KEEP) ?? "[]") as Item[];
    if (Array.isArray(kept)) queue.push(...kept.filter(i => i && typeof i.msg === "string").slice(-30));
  } catch { /* nothing kept */ }
  // Send what's waiting a little after launch, and whenever the app goes to the background
  // (not only after a tower: an error on a menu is worth knowing about too).
  setTimeout(() => void flushDiag(), 10000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushDiag(true); });
  if (isNative()) void CapApp.getInfo().then(i => { version = `${i.version} (${i.build})`; setStatsVersion(version); }).catch(() => {});
  window.addEventListener("error", e => {
    add({ kind: "error", msg: String(e.message).slice(0, 200), data: { at: `${(e.filename ?? "").split("/").pop()}:${e.lineno}:${e.colno}`, stack: String(e.error?.stack ?? "").slice(0, 900) } });
  });
  window.addEventListener("unhandledrejection", e => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    const msg = String(r?.message ?? r ?? "unhandled rejection").slice(0, 200);
    // Network hiccups (no connection) aren't bugs.
    if (/fetch|network|load failed/i.test(msg)) return;
    add({ kind: "error", msg, data: { stack: String(r?.stack ?? "").slice(0, 900) } });
  });
}

/** An error the game caught and survived (so the window "error" event never saw it). */
export function reportError(e: unknown): void {
  if (!SERVER_URL) return;
  const r = e as { message?: string; stack?: string } | undefined;
  add({ kind: "error", msg: String(r?.message ?? e).slice(0, 200), data: { caught: true, stack: String(r?.stack ?? "").slice(0, 900) } });
}

/** How a tower ran: frames per second, frames slower than 1/30 s, and the worst frame. */
export function reportPerf(data: { fps: number; slow: number; worst: number; floors: number; gfx: string }): void {
  if (SERVER_URL) add({ kind: "perf", msg: "tower", data });
}

/** Sends what's waiting (quietly keeps it if there's no connection). */
export async function flushDiag(leaving = false): Promise<void> {
  if (!SERVER_URL || !queue.length || sending) return;
  sending = true;
  const items = queue.splice(0, 10);
  try {
    const res = await fetch(`${SERVER_URL.replace(/\/$/, "")}/diag`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ v: `${GAME} ${version}`, dev: device, items }),
      // (Still sent if the app is closing.)
      keepalive: leaving,
    });
    if (!res.ok) throw new Error(String(res.status));
    keep();
  } catch {
    queue.unshift(...items);
  } finally {
    sending = false;
  }
}
let sending = false;

// ---------- Sentry (optional) ----------

/** The DSN's parts: where to send, and the public key. Null when it's not set or malformed. */
export function sentryTarget(dsn: string): { url: string; key: string } | null {
  const m = /^(https?):\/\/([^@/]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  return m ? { url: `${m[1]}://${m[3]}/api/${m[4]}/envelope/`, key: m[2] } : null;
}

/** A Sentry envelope for one error: no player id, name, save or IP address. */
export function sentryEnvelope(item: Item, ctx: { version: string; device: string; game: string; dsn: string }, now = new Date()): string {
  const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const stack = String(item.data?.stack ?? "");
  const event = {
    event_id: id,
    timestamp: now.toISOString(),
    platform: "javascript",
    level: "error",
    release: `${ctx.game}@${ctx.version}`,
    environment: ctx.version === "web" ? "web" : "app",
    tags: { game: ctx.game, platform: isNative() ? "app" : "web", caught: String(!!item.data?.caught), screen: String(item.data?.screen ?? "") },
    contexts: { device: { model: ctx.device } },
    exception: { values: [{ type: "Error", value: item.msg }] },
    extra: { at: item.data?.at ?? "", stack },
  };
  return [JSON.stringify({ event_id: id, sent_at: now.toISOString(), dsn: ctx.dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
}

function toSentry(item: Item): void {
  const dsn = SENTRY_DSN[GAME], target = sentryTarget(dsn);
  if (!target) return;
  void fetch(`${target.url}?sentry_version=7&sentry_key=${target.key}`, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: sentryEnvelope(item, { version, device, game: GAME, dsn }),
    keepalive: true,
  }).catch(() => { /* offline: our own server still gets it later */ });
}

// ---------- For testers ----------

const recent: { at: string; msg: string; where: string }[] = [];

/** The last errors on this device, as text a tester can paste into a message. */
export function errorReport(): string {
  const head = `${GAME === "skyrise" ? "Skyrise" : "Buildaroo"} ${version} · ${device || describeDevice()} · ${navigator.userAgent}`;
  return recent.length ? [head, ...recent.map(r => `${r.at}  ${r.msg}${r.where ? `  (${r.where})` : ""}`)].join("\n") : `${head}\nNo errors on this device so far.`;
}

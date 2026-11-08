// Anonymous crash and frame-rate reports, so problems on real phones can be found and
// fixed. Nothing personal is sent: no player id, name or save. Just the error message, the
// app version, the phone model and graphics chip, and how smoothly towers ran.
import { App as CapApp } from "@capacitor/app";
import { SERVER_URL } from "./data/server";
import { isNative } from "./native";

interface Item { kind: "error" | "perf"; msg: string; data?: Record<string, unknown> }

const queue: Item[] = [];
const seen = new Map<string, number>();
let version = "web";
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
  queue.push(item);
  if (queue.length > 30) queue.shift();
}

export function initDiag(): void {
  if (!SERVER_URL) return;
  device = describeDevice();
  if (isNative()) void CapApp.getInfo().then(i => { version = `${i.version} (${i.build})`; }).catch(() => {});
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

/** How a tower ran: frames per second, frames slower than 1/30 s, and the worst frame. */
export function reportPerf(data: { fps: number; slow: number; worst: number; floors: number; gfx: string }): void {
  if (SERVER_URL) add({ kind: "perf", msg: "tower", data });
}

/** Sends what's waiting (quietly keeps it if there's no connection). */
export async function flushDiag(): Promise<void> {
  if (!SERVER_URL || !queue.length) return;
  const items = queue.splice(0, 10);
  try {
    const res = await fetch(`${SERVER_URL.replace(/\/$/, "")}/diag`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ v: version, dev: device, items }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    queue.unshift(...items);
  }
}

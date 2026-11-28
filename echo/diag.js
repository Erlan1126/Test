// Lumen Rush: anonymous crash and error reports, so problems on real phones can be found and fixed.
// Nothing personal is sent: no player id, name, save or IP-derived data. Only the error message, where
// in the code it happened, the game version, the phone model, and what the game was doing (screen,
// mode, stage). Loaded first, so errors while the game starts are caught too.
//
// Where reports go:
//  - the studio's own report server, shared with Skyrise and Buildaroo (Cloudflare worker, /diag),
//    read with the "Diagnostics" GitHub workflow. Lumen Rush's reports start with "lumen " in v.
//  - Sentry too, once SENTRY_DSN is filled in (one Sentry project per game, tag game=lumen).
//  - and the last 20 stay on this device (up to 3 of each), for Settings > About > "Copy error report" (testers).
// Settings > About > "Send crash reports" turns sending off; nothing is sent while it's off.
const DIAG_URL = "https://skyrise.erlanstudios.workers.dev/diag";
const SENTRY_DSN = "";   // e.g. "https://<key>@o123456.ingest.sentry.io/7890" from Sentry > Project settings > Client keys

const diag = (() => {
  const LOG = "lumenDiagLog", QUEUE = "lumenDiagQueue", seen = new Map();
  let sent = 0, timer = 0;
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const version = () => (typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "?");
  const device = () => { const ua = navigator.userAgent; return ((/Android [\d.]+; ([^;)]+)/.exec(ua) || [])[1] || (/iPhone|iPad/.exec(ua) || [])[0] || (/Mac|Windows|Linux|CrOS/.exec(ua) || ["other"])[0]).replace(/ Build.*$/, "").slice(0, 60) + ` · ${innerWidth}×${innerHeight}@${Math.round((devicePixelRatio || 1) * 10) / 10}`; };
  // What the game was doing: the screen, and in a run the mode and stage.
  const where = () => { try { const r = typeof run !== "undefined" && run; return [typeof screen === "string" ? screen : "load", r ? (r.free ? "free" : r.rush ? `rush ${r.stage}` : r.stageInfo ? (r.stageInfo.daily ? "daily" : `stage ${r.stageInfo.n}`) : r.attract ? "title" : "night") : ""].filter(Boolean).join(" · "); } catch (e) { return "?"; } };
  const allowed = () => { try { return !(typeof save !== "undefined" && save.settings && save.settings.diag === false); } catch (e) { return true; } };

  function report(err, how) {
    const msg = String((err && err.message) || err || "error").slice(0, 200);
    if (/ResizeObserver loop|Script error\.?$/.test(msg)) return;   // browser noise, not our bug
    const n = seen.get(msg) || 0; seen.set(msg, n + 1); if (n >= 3) return;   // the same error a few times is enough
    const item = { kind: "error", msg, data: { game: "lumen", how: how || "error", where: where(), stack: String((err && err.stack) || "").split("\n").slice(0, 8).join("\n").slice(0, 900), t: Date.now() } };
    const log = read(LOG); log.push(item); write(LOG, log.slice(-20));
    if (!allowed() || n >= 1) return;   // each different error is sent once a session; repeats stay in the device log
    const q = read(QUEUE); q.push(item); write(QUEUE, q.slice(-30));
    clearTimeout(timer); timer = setTimeout(flush, 1500);
    if (SENTRY_DSN) toSentry(item);
  }
  // Sends what's waiting; if there's no connection it stays queued for next time.
  function flush() {
    const q = read(QUEUE); if (!q.length || !allowed() || sent >= 20 || !navigator.onLine) return;
    const items = q.slice(0, 10); sent += items.length;
    fetch(DIAG_URL, { method: "POST", mode: "cors", keepalive: true, headers: { "content-type": "text/plain" }, body: JSON.stringify({ v: `lumen ${version()}`, dev: device(), items }) })
      .then(res => { if (res.ok) { write(QUEUE, read(QUEUE).slice(items.length)); if (read(QUEUE).length) setTimeout(flush, 1500); } })
      .catch(() => {});
  }
  // Sentry's envelope endpoint, no SDK: https://develop.sentry.dev/sdk/envelopes/
  function toSentry(item) {
    try {
      const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN); if (!m) return;
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""), now = new Date().toISOString();
      const ev = { event_id: id, timestamp: now, platform: "javascript", level: "error", release: `lumen-rush@${version()}`, environment: location.hostname.endsWith("github.io") ? "production" : "dev",
        tags: { game: "lumen", version: version(), platform: "web", where: item.data.where }, exception: { values: [{ type: "Error", value: item.msg, mechanism: { type: item.data.how, handled: item.data.how === "caught" } }] }, extra: { stack: item.data.stack }, contexts: { device: { model: device() } } };
      fetch(`https://${m[2]}/api/${m[3]}/envelope/?sentry_key=${m[1]}&sentry_version=7`, { method: "POST", mode: "cors", keepalive: true, headers: { "content-type": "text/plain" },
        body: `${JSON.stringify({ event_id: id, sent_at: now })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(ev)}` }).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener("error", e => report(e.error || { message: e.message, stack: `${(e.filename || "").split("/").pop()}:${e.lineno}:${e.colno}` }, "error"));
  window.addEventListener("unhandledrejection", e => { const r = e.reason; if (/fetch|network|load failed/i.test(String((r && r.message) || r))) return; report(r, "promise"); });
  window.addEventListener("online", flush);
  setTimeout(flush, 4000);   // anything left from last time
  return { report, flush, log: () => read(LOG), clear: () => write(LOG, []) };
})();

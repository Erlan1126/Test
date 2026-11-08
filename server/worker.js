// Skyrise server: one Cloudflare Worker for the online rankings and for selling Sky Crystal
// packs on the website. See README.md in this folder to deploy it.
//
// Rankings (D1 database bound as DB, tables in schema.sql):
//   POST /players        { player } -> { token }. Registers a new player once; the token is
//                        their private key for posting scores.
//   POST /runs           { player, token, name, level, record } -> { score, ranks }. The
//                        server replays the tower from its seed and taps (the same game
//                        rules as the app) and ranks the score it computes itself.
//   GET  /board          ?board=daily|week|all&period=<n>&player=<id> -> top 100 and your rank
//   POST /save           { player, token, data } backs up the player's save
//   POST /recovery       { player, token, code } sets the player's recovery code
//   POST /restore        { code } -> { player, token, data } on a new device
//   POST /report         { player, token, target } reports a leaderboard name
//
// Payments (website only; the phone apps sell packs through the App Store and Google Play):
//   POST /checkout       { product, player, returnUrl } -> { url } of a Stripe checkout page
//   POST /webhook        Stripe calls this when a payment completes (signature verified)
//   GET  /entitlements   ?player=<id> -> { purchases: [{ pack, tx }] } for this player;
//                        the game adds each tx's crystals once
//
// Settings (wrangler secrets / vars):
//   STRIPE_SECRET_KEY       sk_live_... (or sk_test_... while testing)
//   STRIPE_WEBHOOK_SECRET   whsec_... from the webhook you create in Stripe
//   ALLOWED_ORIGINS         comma-separated sites allowed to start a checkout,
//                           e.g. "https://yourname.itch.io,https://html-classic.itch.zone"
//   PRICE_<pack id>         the Stripe price id for each pack, e.g. PRICE_crystals_650
// Storage: a KV namespace bound as ENTITLEMENTS.
import { replayRun } from "../src/logic/replay";
import { dailySeed, dayNumber } from "../src/logic/rules";
import { weekIndex } from "../src/data/events";

// Must match CRYSTAL_PACKS in src/data/premium.ts.
const PRODUCTS = ["crystals_200", "crystals_650", "crystals_1250", "crystals_2600", "crystals_8000", "crystals_14000"];
const PLAYER = /^[A-Za-z0-9-]{8,64}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    // Reading purchases is open to any copy of the game; starting a checkout isn't.
    const cors = url.pathname === "/entitlements" ? { "access-control-allow-origin": "*" } : allowed.includes(origin)
      ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
      : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

    // The rankings are open to any game copy (the apps, the website); posting needs the
    // player's token instead.
    const open = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };
    const ranked = ["/players", "/runs", "/board", "/save", "/recovery", "/restore", "/report", "/diag"].includes(url.pathname);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: ranked ? open : cors });

    try {
      if (ranked) {
        if (!env.DB) return Response.json({ error: "rankings not set up" }, { status: 503, headers: open });
        const res = await rankings(request, url, env, Date.now());
        for (const [k, v] of Object.entries(open)) res.headers.set(k, v);
        return res;
      }

      if (url.pathname === "/checkout" && request.method === "POST") {
        if (!cors["access-control-allow-origin"]) return json({ error: "origin not allowed" }, 403);
        const { product, player, returnUrl } = await request.json();
        const price = env[`PRICE_${product}`];
        if (!PRODUCTS.includes(product) || !price) return json({ error: "unknown product" }, 400);
        if (!PLAYER.test(player ?? "")) return json({ error: "bad player id" }, 400);
        const back = new URL(returnUrl);
        if (!allowed.includes(back.origin)) return json({ error: "return address not allowed" }, 400);
        const done = (state) => { const u = new URL(back); u.searchParams.set("purchase", state); return u.toString(); };

        const form = new URLSearchParams({
          mode: "payment",
          "line_items[0][price]": price,
          "line_items[0][quantity]": "1",
          success_url: done("success"),
          cancel_url: done("cancelled"),
          client_reference_id: player,
          "metadata[product]": product,
          "metadata[player]": player,
        });
        const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const session = await res.json();
        if (!res.ok) return json({ error: "stripe error" }, 502);
        return json({ url: session.url });
      }

      if (url.pathname === "/webhook" && request.method === "POST") {
        const body = await request.text();
        if (!(await verifyStripe(body, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET))) {
          return new Response("bad signature", { status: 400 });
        }
        const event = JSON.parse(body);
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
          const s = event.data.object;
          const { product, player } = s.metadata ?? {};
          if (s.payment_status === "paid" && PRODUCTS.includes(product) && PLAYER.test(player ?? "")) {
            const key = `player:${player}`;
            const list = JSON.parse((await env.ENTITLEMENTS.get(key)) ?? "[]");
            // Stripe can send the same event more than once; the session id keeps it single.
            if (!list.some(p => p.tx === `stripe:${s.id}`)) list.push({ pack: product, tx: `stripe:${s.id}` });
            await env.ENTITLEMENTS.put(key, JSON.stringify(list));
          }
        }
        return new Response("ok");
      }

      if (url.pathname === "/entitlements" && request.method === "GET") {
        const player = url.searchParams.get("player") ?? "";
        if (!PLAYER.test(player)) return json({ error: "bad player id" }, 400);
        if (!env.ENTITLEMENTS) return json({ purchases: [] });
        const list = JSON.parse((await env.ENTITLEMENTS.get(`player:${player}`)) ?? "[]");
        return json({ purchases: list.filter(p => p && typeof p.tx === "string") });
      }

      return json({ error: "not found" }, 404);
    } catch {
      return json({ error: "server error" }, 500);
    }
  },
};

/** Checks Stripe's webhook signature: HMAC-SHA256 of "<timestamp>.<body>", within 5 minutes. */
async function verifyStripe(body, header, secret) {
  if (!secret) return false;
  const parts = Object.fromEntries(header.split(",").map(kv => kv.split("=")));
  const t = Number(parts.t);
  const sigs = header.split(",").filter(kv => kv.startsWith("v1=")).map(kv => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.some(s => timingSafeEqual(s, hex));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Rankings ----------

const BOARDS = ["daily", "week", "all"];
/** Recovery codes: 12 letters and digits without look-alikes (no 0, O, 1, I). */
const RECOVERY = /^[A-HJ-NP-Z2-9]{12}$/;
/** Cloud saves at most every few seconds per player. */
const SAVE_GAP_MS = 5000;
/** Reports from this many players hide a name. */
const HIDE_AFTER = 3;
/** At most one tower every few seconds per player. */
const RUN_GAP_MS = 4000;

async function rankings(request, url, env, now) {
  const db = env.DB;
  const json = (body, status = 200) => Response.json(body, { status });

  if (url.pathname === "/players" && request.method === "POST") {
    const { player } = await request.json();
    if (!PLAYER.test(player ?? "")) return json({ error: "bad player id" }, 400);
    const token = randomToken();
    const r = await db.prepare("INSERT OR IGNORE INTO players (id, token_hash, created) VALUES (?, ?, ?)")
      .bind(player, await sha256(token), now).run();
    // Each id registers once, so nobody else can take over a player's scores.
    if (!r.meta?.changes) return json({ error: "already registered" }, 409);
    return json({ token });
  }

  /** The player a request is from, if its token matches. */
  const auth = async (body) => {
    const { player, token } = body ?? {};
    if (!PLAYER.test(player ?? "") || typeof token !== "string") return null;
    const row = await db.prepare("SELECT token_hash, last_run FROM players WHERE id = ?").bind(player).first();
    return row && timingSafeEqual(row.token_hash, await sha256(token)) ? { id: player, ...row } : null;
  };

  if (url.pathname === "/save" && request.method === "POST") {
    const body = await request.json();
    const me = await auth(body);
    if (!me) return json({ error: "not allowed" }, 403);
    if (typeof body.data !== "string" || body.data.length > 200_000) return json({ error: "bad save" }, 400);
    const last = await db.prepare("SELECT updated FROM saves WHERE player = ?").bind(me.id).first();
    if (last && now - last.updated < SAVE_GAP_MS) return json({ error: "too fast" }, 429);
    await db.prepare("INSERT INTO saves (player, data, updated) VALUES (?, ?, ?) ON CONFLICT (player) DO UPDATE SET data = excluded.data, updated = excluded.updated")
      .bind(me.id, body.data, now).run();
    return json({ ok: true });
  }

  if (url.pathname === "/recovery" && request.method === "POST") {
    const body = await request.json();
    const me = await auth(body);
    if (!me) return json({ error: "not allowed" }, 403);
    if (!RECOVERY.test(body.code ?? "")) return json({ error: "bad code" }, 400);
    await db.batch([
      db.prepare("DELETE FROM recovery WHERE player = ?").bind(me.id),
      db.prepare("INSERT OR REPLACE INTO recovery (code_hash, player) VALUES (?, ?)").bind(await sha256(body.code), me.id),
    ]);
    return json({ ok: true });
  }

  if (url.pathname === "/restore" && request.method === "POST") {
    const { code } = await request.json();
    const clean = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!RECOVERY.test(clean)) return json({ error: "bad code" }, 400);
    const r = await db.prepare("SELECT player FROM recovery WHERE code_hash = ?").bind(await sha256(clean)).first();
    if (!r) return json({ error: "no such code" }, 404);
    const save = await db.prepare("SELECT data FROM saves WHERE player = ?").bind(r.player).first();
    // The restoring device gets a fresh token; the old one stops posting.
    const token = randomToken();
    await db.prepare("UPDATE players SET token_hash = ? WHERE id = ?").bind(await sha256(token), r.player).run();
    return json({ player: r.player, token, data: save?.data ?? null });
  }

  if (url.pathname === "/report" && request.method === "POST") {
    const body = await request.json();
    const me = await auth(body);
    if (!me) return json({ error: "not allowed" }, 403);
    if (!PLAYER.test(body.target ?? "") || body.target === me.id) return json({ error: "bad target" }, 400);
    await db.prepare("INSERT OR IGNORE INTO reports (reporter, target, at) VALUES (?, ?, ?)").bind(me.id, body.target, now).run();
    return json({ ok: true });
  }

  // Anonymous crash and frame-rate reports. No player id, name or token is taken.
  if (url.pathname === "/diag" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items.slice(0, 10) : [];
    const v = String(body?.v ?? "").slice(0, 24), dev = String(body?.dev ?? "").slice(0, 160);
    const stmts = items.map(it => db.prepare("INSERT INTO diag (at, kind, v, dev, msg, data) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(now, it?.kind === "perf" ? "perf" : "error", v, dev, String(it?.msg ?? "").slice(0, 300), JSON.stringify(it?.data ?? {}).slice(0, 1500)));
    if (stmts.length) await db.batch(stmts);
    if (Math.random() < 0.02) await db.prepare("DELETE FROM diag WHERE id <= (SELECT MAX(id) - 20000 FROM diag)").run();
    return json({ ok: true });
  }

  if (url.pathname === "/runs" && request.method === "POST") {
    const body = await request.json();
    const { player, token, record } = body ?? {};
    if (!PLAYER.test(player ?? "") || typeof token !== "string") return json({ error: "bad player" }, 400);
    const row = await db.prepare("SELECT token_hash, last_run FROM players WHERE id = ?").bind(player).first();
    if (!row || !timingSafeEqual(row.token_hash, await sha256(token))) return json({ error: "not allowed" }, 403);
    if (now - row.last_run < RUN_GAP_MS) return json({ error: "too fast" }, 429);
    if (!record || (record.mode !== "classic" && record.mode !== "daily")) return json({ error: "this mode isn't ranked" }, 400);

    // Only current towers: this week (or last, for towers finished just after midnight
    // Monday), and today's or yesterday's Daily with its real seed.
    const week = weekIndex(now), day = dayNumber(now);
    // Last week is only accepted in the first two hours of a new week (a tower that was
    // still going at midnight), so nobody can pick an easier week's rules.
    const lastWeekOk = record.week === week - 1 && weekIndex(now - 2 * 3600e3) === week - 1;
    if (record.week !== week && !lastWeekOk) return json({ error: "old tower" }, 400);
    // A new player's slower first tower is practice, not ranked.
    if (record.easy) return json({ error: "practice tower" }, 400);
    if (record.mode === "daily" && record.boosts && (record.boosts.rewind || record.boosts.gold)) {
      return json({ error: "boosts aren't used on the Daily" }, 400);
    }
    if (record.mode === "daily" && ((record.day !== day && record.day !== day - 1) || record.seed !== dailySeed(record.day))) {
      return json({ error: "not today's Daily" }, 400);
    }
    if (JSON.stringify(record).length > 60000) return json({ error: "too long" }, 413);

    const out = replayRun(record);
    if (!out.ok) return json({ error: `rejected: ${out.reason}` }, 422);
    const { score, meters } = out.summary;

    const name = cleanName(body.name), level = Math.max(1, Math.min(999, Math.floor(Number(body.level) || 1)));
    const up = "INSERT INTO scores (board, period, player, score, meters, at) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (board, period, player) DO UPDATE SET score = excluded.score, meters = excluded.meters, at = excluded.at " +
      "WHERE excluded.score > scores.score";
    const boards = [["week", record.week], ["all", 0]];
    if (record.mode === "daily") boards.unshift(["daily", record.day]);
    await db.batch([
      db.prepare("UPDATE players SET name = ?, level = ?, last_run = ? WHERE id = ?").bind(name, level, now, player),
      ...boards.map(([b, period]) => db.prepare(up).bind(b, period, player, score, meters, now)),
    ]);
    const ranks = {};
    for (const [b, period] of boards) ranks[b] = await rankOf(db, b, period, player);
    return json({ score, meters, ranks });
  }

  if (url.pathname === "/board" && request.method === "GET") {
    const board = url.searchParams.get("board") ?? "";
    const period = Math.floor(Number(url.searchParams.get("period") ?? "0"));
    const player = url.searchParams.get("player") ?? "";
    if (!BOARDS.includes(board) || !Number.isFinite(period)) return json({ error: "bad board" }, 400);
    const { results } = await db.prepare(
      `SELECT s.player, s.score, s.meters, CASE WHEN (SELECT COUNT(*) FROM reports r WHERE r.target = s.player) >= ${HIDE_AFTER} THEN '' ELSE p.name END AS name, p.level FROM scores s JOIN players p ON p.id = s.player ` +
      "WHERE s.board = ? AND s.period = ? ORDER BY s.score DESC, s.at ASC LIMIT 100").bind(board, period).all();
    const total = (await db.prepare("SELECT COUNT(*) AS n FROM scores WHERE board = ? AND period = ?").bind(board, period).first())?.n ?? 0;
    const top = results.map((r, i) => ({ rank: i + 1, id: r.player, name: r.name || defaultName(r.player), level: r.level, score: r.score, meters: r.meters }));
    let me = null;
    if (PLAYER.test(player)) {
      const mine = await db.prepare("SELECT score, meters FROM scores WHERE board = ? AND period = ? AND player = ?").bind(board, period, player).first();
      if (mine) me = { rank: await rankOf(db, board, period, player), score: mine.score, meters: mine.meters };
    }
    return json({ board, period, total, top, me });
  }

  return json({ error: "not found" }, 404);
}

async function rankOf(db, board, period, player) {
  const r = await db.prepare(
    "SELECT 1 + (SELECT COUNT(*) FROM scores o WHERE o.board = s.board AND o.period = s.period AND o.score > s.score) AS rank " +
    "FROM scores s WHERE s.board = ? AND s.period = ? AND s.player = ?").bind(board, period, player).first();
  return r?.rank ?? null;
}

/** Letters, digits, spaces and a little punctuation, up to 16 characters. */
function cleanName(v) {
  const name = String(v ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  return BLOCKED.some(w => name.toLowerCase().replace(/[^a-z]/g, "").includes(w)) ? "" : name;
}

const defaultName = id => `Builder ${id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;

// A short list of words that never belong in a public name. Players can be renamed by hand
// in the D1 console if something else slips through.
const BLOCKED = ["fuck", "shit", "cunt", "nigg", "fagg", "rape", "nazi", "hitler", "whore", "slut"];

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

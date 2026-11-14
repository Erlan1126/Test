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
import { RULES } from "../src/logic/sim";
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
    const ranked = ["/players", "/runs", "/board", "/ghost", "/save", "/recovery", "/restore", "/report", "/diag", "/stats"].includes(url.pathname)
      || url.pathname === "/challenge" || url.pathname.startsWith("/challenge/") || url.pathname.startsWith("/c/");
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
/** Floors kept in a ghost. */
const MAX_GHOST = 1000;

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

  // ---------- "Beat my tower" challenges ----------
  if (url.pathname === "/challenge" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const score = Math.floor(Number(body?.score)), meters = Math.floor(Number(body?.meters)), floors = Math.floor(Number(body?.floors));
    if (![score, meters, floors].every(n => Number.isFinite(n) && n >= 0 && n < 1e8)) return json({ error: "bad tower" }, 400);
    const pace = cleanChallengePace(body?.pace);
    const id = randomId(8);
    await db.prepare("INSERT INTO challenges (id, at, name, score, meters, floors, pace) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, now, cleanName(body?.name), score, meters, floors, JSON.stringify(pace)).run();
    return json({ id });
  }
  if (url.pathname === "/challenge" && request.method === "GET") {
    const id = (url.searchParams.get("id") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
    const row = await db.prepare("SELECT name, score, meters, floors, pace FROM challenges WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "not found" }, 404);
    return json({ id, name: row.name, score: row.score, meters: row.meters, floors: row.floors, pace: JSON.parse(row.pace) });
  }
  if (url.pathname === "/challenge/try" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16), score = Math.floor(Number(body?.score));
    if (!id || !Number.isFinite(score) || score < 0 || score > 1e8) return json({ error: "bad try" }, 400);
    const ok = await db.prepare("SELECT 1 FROM challenges WHERE id = ?").bind(id).first();
    if (!ok) return json({ error: "not found" }, 404);
    await db.prepare("INSERT INTO challenge_tries (challenge, at, name, score) VALUES (?, ?, ?, ?)").bind(id, now, cleanName(body?.name), score).run();
    return json({ ok: true });
  }
  if (url.pathname === "/challenge/tries" && request.method === "GET") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map(x => x.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)).filter(Boolean).slice(0, 20);
    if (!ids.length) return json({ tries: [] });
    const since = Math.floor(Number(url.searchParams.get("since") ?? "0")) || 0;
    const { results } = await db.prepare(`SELECT t.challenge AS id, t.at, t.name, t.score, c.score AS target FROM challenge_tries t JOIN challenges c ON c.id = t.challenge WHERE t.challenge IN (${ids.map(() => "?").join(",")}) AND t.at > ? ORDER BY t.at LIMIT 50`)
      .bind(...ids, since).all();
    return json({ tries: results.map(r => ({ id: r.id, at: r.at, name: r.name, score: r.score, beat: r.score > r.target })) });
  }
  // The page a challenge link opens: who's challenging you, open the game or get it.
  const page = /^\/c\/([A-Za-z0-9]{4,16})$/.exec(url.pathname);
  if (page && request.method === "GET") {
    const row = await db.prepare("SELECT name, score, meters FROM challenges WHERE id = ?").bind(page[1]).first();
    return new Response(challengePage(page[1], row), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
  }

  // Anonymous play statistics (src/stats.ts). The install id is random and not a player id.
  if (url.pathname === "/stats" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const install = String(body?.id ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
    const items = Array.isArray(body?.items) ? body.items.slice(0, 20) : [];
    if (!install) return json({ error: "no id" }, 400);
    const v = String(body?.v ?? "").slice(0, 24), lang = String(body?.lang ?? "").slice(0, 5);
    const int = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
    const stmts = items.map(it => db.prepare("INSERT INTO stats (at, install, kind, day, towers, v, lang, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(now, install, it?.kind === "tower" ? "tower" : "open", int(it?.day, 100000), int(it?.towers, 10000000), v, lang, JSON.stringify(it?.data ?? {}).slice(0, 500)));
    if (stmts.length) await db.batch(stmts);
    if (Math.random() < 0.01) await db.prepare("DELETE FROM stats WHERE id <= (SELECT MAX(id) - 300000 FROM stats)").run();
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
    // Ranked towers use the current rules, or the previous ones (phones that haven't
    // updated yet), not any older set a player might find easier.
    if (!Number.isInteger(record.rules) || record.rules < RULES - 1) return json({ error: "old rules" }, 400);

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
    // Keep this tower's pace as the player's ghost on each board where it's now their best.
    const pace = JSON.stringify(out.pace.slice(0, MAX_GHOST));
    const ghostUp = "INSERT INTO ghosts (board, period, player, pace) SELECT ?, ?, ?, ? WHERE " +
      "(SELECT score FROM scores WHERE board = ? AND period = ? AND player = ?) = ? " +
      "ON CONFLICT (board, period, player) DO UPDATE SET pace = excluded.pace";
    await db.batch(boards.filter(([b]) => b !== "all").map(([b, period]) => db.prepare(ghostUp).bind(b, period, player, pace, b, period, player, score)));
    const ranks = {};
    for (const [b, period] of boards) ranks[b] = await rankOf(db, b, period, player);
    return json({ score, meters, ranks });
  }

  // A rival to race: the player just above you on the board (or the lowest-ranked score
  // you haven't got yet), with how fast their best tower grew.
  if (url.pathname === "/ghost" && request.method === "GET") {
    const board = url.searchParams.get("board") ?? "";
    const period = Math.floor(Number(url.searchParams.get("period") ?? "0"));
    const player = url.searchParams.get("player") ?? "";
    if (!["week", "daily"].includes(board) || !Number.isFinite(period) || !PLAYER.test(player)) return json({ error: "bad board" }, 400);
    const mine = await db.prepare("SELECT score FROM scores WHERE board = ? AND period = ? AND player = ?").bind(board, period, player).first();
    const row = await db.prepare(
      `SELECT g.player, g.pace, s.score, s.meters, CASE WHEN (SELECT COUNT(*) FROM reports r WHERE r.target = s.player) >= ${HIDE_AFTER} THEN '' ELSE p.name END AS name ` +
      "FROM ghosts g JOIN scores s ON s.board = g.board AND s.period = g.period AND s.player = g.player JOIN players p ON p.id = g.player " +
      "WHERE g.board = ? AND g.period = ? AND g.player != ? AND s.score > ? ORDER BY s.score ASC LIMIT 1")
      .bind(board, period, player, mine?.score ?? 0).first();
    if (!row) return json({ ghost: null });
    let pace = [];
    try { pace = JSON.parse(row.pace); } catch { /* keep empty */ }
    return json({ ghost: { id: row.player, name: row.name || defaultName(row.player), score: row.score, meters: row.meters, pace: Array.isArray(pace) ? pace.slice(0, MAX_GHOST) : [] } });
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


// ---------- Challenge helpers ----------

function randomId(n) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map(b => abc[b % abc.length]).join("");
}

/** A ghost pace from a phone: whole ticks that never go down, at most 1000 floors. */
function cleanChallengePace(v) {
  const out = [];
  if (!Array.isArray(v)) return out;
  for (const x of v.slice(0, 1000)) {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1e7 || (out.length && x < out[out.length - 1])) break;
    out.push(Math.floor(x));
  }
  return out;
}

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Store pages. The App Store link becomes the app's own page once it's live (set APP_STORE_URL).
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.erlanstudios.skyrise";
const APP_STORE_URL = "https://apps.apple.com/search?term=Skyrise%20Tower%20Stack";

function challengePage(id, row) {
  const who = row ? (row.name ? escHtml(row.name) : "A friend") : "";
  const title = row ? `${who} challenges you on Skyrise!` : "Skyrise: Tower Stack";
  const line = row ? `Their tower is ${Number(row.meters).toLocaleString("en-US")} m tall with ${Number(row.score).toLocaleString("en-US")} people living in it. Can you build a bigger one?` : "Stack floors, grow your sky city and race your friends.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta property="og:title" content="${title}"><meta property="og:description" content="${line}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:600 17px/1.4 system-ui,-apple-system,sans-serif;color:#1b1f4a;background:linear-gradient(180deg,#8fc6ff,#ffe1c6)}
main{width:min(420px,calc(100% - 32px));padding:28px 22px;border-radius:28px;background:rgba(255,255,255,.88);box-shadow:0 20px 50px rgba(20,24,70,.2);text-align:center}
h1{margin:0 0 10px;font-size:26px;letter-spacing:-.02em}p{margin:0 0 20px;color:#4a4f7a}
a{display:block;margin:10px 0;padding:15px;border-radius:18px;text-decoration:none;font-weight:800}
.open{background:#f63476;color:#fff;box-shadow:0 8px 20px rgba(246,52,118,.3)}.store{background:rgba(27,31,74,.07);color:#1b1f4a}</style></head>
<body><main><h1>🏙️ ${title}</h1><p>${line}</p>
<a class="open" href="skyrise://c/${escHtml(id)}">Open in Skyrise</a>
<a class="store" href="${APP_STORE_URL}">Get it on the App Store</a>
<a class="store" href="${PLAY_URL}">Get it on Google Play</a></main></body></html>`;
}

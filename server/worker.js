// Skyrise payment server: a Cloudflare Worker that sells premium cosmetics with Stripe
// Checkout and remembers what each player owns. See README.md in this folder to deploy it.
//
//   POST /checkout       { product, player, returnUrl } -> { url } of a Stripe checkout page
//   POST /webhook        Stripe calls this when a payment completes (signature verified)
//   GET  /entitlements   ?player=<id> -> { products: [...] } this player owns
//
// Settings (wrangler secrets / vars):
//   STRIPE_SECRET_KEY       sk_live_... (or sk_test_... while testing)
//   STRIPE_WEBHOOK_SECRET   whsec_... from the webhook you create in Stripe
//   ALLOWED_ORIGINS         comma-separated sites allowed to start a checkout,
//                           e.g. "https://yourname.itch.io,https://html-classic.itch.zone"
//   PRICE_<product id>      the Stripe price id for each product, e.g. PRICE_skin_crystal
// Storage: a KV namespace bound as ENTITLEMENTS.

// Must match src/data/premium.ts.
const PRODUCTS = ["skin_crystal", "skin_sakura", "skin_royal", "skin_cyber", "island_volcano", "island_candy", "founders"];
const PLAYER = /^[A-Za-z0-9-]{8,64}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
      : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
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
            const owned = JSON.parse((await env.ENTITLEMENTS.get(key)) ?? "[]");
            if (!owned.includes(product)) owned.push(product);
            await env.ENTITLEMENTS.put(key, JSON.stringify(owned));
          }
        }
        return new Response("ok");
      }

      if (url.pathname === "/entitlements" && request.method === "GET") {
        const player = url.searchParams.get("player") ?? "";
        if (!PLAYER.test(player)) return json({ error: "bad player id" }, 400);
        const owned = JSON.parse((await env.ENTITLEMENTS.get(`player:${player}`)) ?? "[]");
        return json({ products: owned });
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

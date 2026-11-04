import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../server/worker.js";

const SECRET = "whsec_test";
const ORIGIN = "https://skyrise.example";
const PLAYER = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

function makeEnv() {
  const kv = new Map();
  return {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: SECRET,
    ALLOWED_ORIGINS: ORIGIN,
    PRICE_crystals_550: "price_123",
    ENTITLEMENTS: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } },
  };
}

async function sign(body, t = Math.floor(Date.now() / 1000), secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  return `t=${t},v1=${[...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

const paid = (product = "crystals_550", player = PLAYER, id = "cs_1") => JSON.stringify({
  type: "checkout.session.completed",
  data: { object: { id, payment_status: "paid", metadata: { product, player } } },
});

const owned = async env => (await (await worker.fetch(new Request(`https://pay.example/entitlements?player=${PLAYER}`), env)).json()).purchases;

afterEach(() => vi.unstubAllGlobals());

describe("payment server", () => {
  it("creates a Stripe checkout for a known product from an allowed site", async () => {
    const env = makeEnv();
    const stripe = vi.fn(async () => new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/abc" })));
    vi.stubGlobal("fetch", stripe);
    const res = await worker.fetch(new Request("https://pay.example/checkout", {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ product: "crystals_550", player: PLAYER, returnUrl: `${ORIGIN}/game/` }),
    }), env);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("checkout.stripe.com");
    const sent = new URLSearchParams(stripe.mock.calls[0][1].body);
    expect(sent.get("line_items[0][price]")).toBe("price_123");
    expect(sent.get("metadata[player]")).toBe(PLAYER);
    expect(sent.get("success_url")).toBe(`${ORIGIN}/game/?purchase=success`);
  });

  it("refuses other sites, unknown products and bad player ids", async () => {
    const env = makeEnv();
    vi.stubGlobal("fetch", vi.fn());
    const post = (origin, body) => worker.fetch(new Request("https://pay.example/checkout", {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
    }), env);
    expect((await post("https://evil.example", { product: "crystals_550", player: PLAYER, returnUrl: `${ORIGIN}/` })).status).toBe(403);
    expect((await post(ORIGIN, { product: "free_gold", player: PLAYER, returnUrl: `${ORIGIN}/` })).status).toBe(400);
    expect((await post(ORIGIN, { product: "crystals_550", player: "x", returnUrl: `${ORIGIN}/` })).status).toBe(400);
    expect((await post(ORIGIN, { product: "crystals_550", player: PLAYER, returnUrl: "https://evil.example/" })).status).toBe(400);
  });

  it("records a purchase only from a correctly signed, paid webhook", async () => {
    const env = makeEnv();
    const hook = (body, sig) => worker.fetch(new Request("https://pay.example/webhook", { method: "POST", headers: { "stripe-signature": sig }, body }), env);
    expect((await hook(paid(), await sign(paid(), undefined, "wrong"))).status).toBe(400);
    expect((await hook(paid(), await sign(paid(), Math.floor(Date.now() / 1000) - 3600))).status).toBe(400); // too old
    expect(await owned(env)).toEqual([]);
    expect((await hook(paid(), await sign(paid()))).status).toBe(200);
    expect((await hook(paid(), await sign(paid()))).status).toBe(200); // Stripe can resend
    expect(await owned(env)).toEqual([{ pack: "crystals_550", tx: "stripe:cs_1" }]);
    // A second pack is a separate purchase.
    const again = paid("crystals_550", PLAYER, "cs_2");
    expect((await hook(again, await sign(again))).status).toBe(200);
    expect((await owned(env)).map(p => p.tx)).toEqual(["stripe:cs_1", "stripe:cs_2"]);
  });
});

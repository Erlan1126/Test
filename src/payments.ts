// How premium purchases are paid for. Real payments go through the small server in
// server/ (Stripe Checkout): the game asks it for a checkout page, Stripe takes the
// payment, and the server records what this player owns. The game never decides on its
// own that something was paid for; it asks the server.
//
// Until that server is deployed (PAYMENTS_API is empty), premium items show as "coming
// soon". For trying the flow, test mode (add ?testpay to the URL) grants items without
// charging anything, and says so on screen.
import { PAYMENTS_API, type Product } from "./data/premium";

export type BuyResult = "ok" | "redirect" | "cancelled" | "error";

export interface PaymentProvider {
  /** Real money changes hands. */
  readonly live: boolean;
  buy(product: Product, playerId: string): Promise<BuyResult>;
  /** Products the server says this player owns, or null if it can't be reached. */
  owned(playerId: string): Promise<string[] | null>;
}

/** Test mode: grants items instantly and charges nothing. */
class TestProvider implements PaymentProvider {
  readonly live = false;
  async buy(): Promise<BuyResult> { return "ok"; }
  async owned(): Promise<string[] | null> { return null; }
}

/** Stripe Checkout through the Skyrise payment server. */
class StripeProvider implements PaymentProvider {
  readonly live = true;
  constructor(private readonly api: string) {}

  async buy(product: Product, playerId: string): Promise<BuyResult> {
    try {
      const back = location.origin + location.pathname;
      const res = await fetch(`${this.api}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: product.id, player: playerId, returnUrl: back }),
      });
      if (!res.ok) return "error";
      const { url } = await res.json() as { url?: string };
      if (!url || !/^https:\/\/checkout\.stripe\.com\//.test(url)) return "error";
      // Stripe's checkout page takes over; it sends the player back with ?purchase=...
      location.href = url;
      return "redirect";
    } catch {
      return "error";
    }
  }

  async owned(playerId: string): Promise<string[] | null> {
    try {
      const res = await fetch(`${this.api}/entitlements?player=${encodeURIComponent(playerId)}`);
      if (!res.ok) return null;
      const body = await res.json() as { products?: unknown };
      return Array.isArray(body.products) ? body.products.filter((x): x is string => typeof x === "string") : null;
    } catch {
      return null;
    }
  }
}

/** The provider for this page, or null when purchases aren't available here. */
export function choosePayments(): PaymentProvider | null {
  const params = new URLSearchParams(location.search);
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  // Test mode never runs on a live site with real payments, or anyone could unlock items free.
  if (params.has("testpay") && (!PAYMENTS_API || local)) return new TestProvider();
  // Real checkout needs the deployed server and a normal website (not an embedded preview).
  const embedded = !!(window as unknown as { claude?: unknown }).claude || !/^https?:$/.test(location.protocol);
  if (PAYMENTS_API && !embedded) return new StripeProvider(PAYMENTS_API.replace(/\/$/, ""));
  return null;
}

/** Stripe sends players back with ?purchase=success or ?purchase=cancelled. */
export function purchaseReturn(): "success" | "cancelled" | null {
  const v = new URLSearchParams(location.search).get("purchase");
  return v === "success" || v === "cancelled" ? v : null;
}

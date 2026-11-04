// How premium purchases are paid for. Real payments go through the small server in
// server/ (Stripe Checkout): the game asks it for a checkout page, Stripe takes the
// payment, and the server records what this player owns. The game never decides on its
// own that something was paid for; it asks the server.
//
// The phone apps can't use Stripe: Apple and Google require their own in-app purchases for
// digital items, so there the store's billing is used instead (StoreProvider below).
//
// Until that server is deployed (PAYMENTS_API is empty), premium items show as "coming
// soon". For trying the flow, test mode (add ?testpay to the URL) grants items without
// charging anything, and says so on screen.
import { PAYMENTS_API, PRODUCTS, type Product } from "./data/premium";
import { isNative, platform } from "./native";

export type BuyResult = "ok" | "redirect" | "cancelled" | "error";

export interface PaymentProvider {
  /** Real money changes hands. */
  readonly live: boolean;
  buy(product: Product, playerId: string): Promise<BuyResult>;
  /** Products the server says this player owns, or null if it can't be reached. */
  owned(playerId: string): Promise<string[] | null>;
  /** The App Store and Google Play: ownership only ever grows (purchases are never taken
   *  back on a sync), and the shop shows a "Restore purchases" button. */
  readonly store?: boolean;
  /** The store's own price text in the player's currency, once it has loaded. */
  price?(product: Product): string | null;
  /** Asks the store again for everything this account has bought. */
  restore?(): Promise<string[] | null>;
  /** Called when a purchase completes outside a buy() call, such as a pending payment. */
  onOwned?: (ids: string[]) => void;
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

// ---------- App Store and Google Play ----------

// cordova-plugin-purchase adds `CdvPurchase` to the page inside the apps. Only the parts
// used here are typed.
interface CdvTransaction { products: { id: string }[]; finish(): Promise<void> }
interface CdvOffer { order(): Promise<{ code: number; message: string } | undefined> }
interface CdvProduct { owned: boolean; pricing?: { price: string }; getOffer(): CdvOffer | undefined }
interface CdvWhen {
  approved(cb: (t: CdvTransaction) => void): CdvWhen;
  finished(cb: (t: CdvTransaction) => void): CdvWhen;
  productUpdated(cb: () => void): CdvWhen;
}
interface CdvStore {
  register(p: { id: string; type: string; platform: string }[]): void;
  initialize(platforms: string[]): Promise<unknown[]>;
  get(id: string, platform?: string): CdvProduct | undefined;
  owned(id: string): boolean;
  when(): CdvWhen;
  restorePurchases(): Promise<unknown>;
  error(cb: (e: { code: number; message: string }) => void): void;
}
interface Cdv {
  store: CdvStore;
  Platform: { APPLE_APPSTORE: string; GOOGLE_PLAY: string };
  ProductType: { NON_CONSUMABLE: string };
  ErrorCode: { PAYMENT_CANCELLED: number };
}

/** Waits for the purchase plugin, which loads a moment after the page. */
function purchasePlugin(): Promise<Cdv | null> {
  return new Promise(resolve => {
    const get = () => (window as unknown as { CdvPurchase?: Cdv }).CdvPurchase;
    if (get()) { resolve(get()!); return; }
    let tries = 0;
    const t = setInterval(() => {
      if (get() || ++tries > 50) { clearInterval(t); resolve(get() ?? null); }
    }, 100);
  });
}

/** In-app purchases through the App Store or Google Play. Store product ids match ours. */
class StoreProvider implements PaymentProvider {
  readonly live = true;
  readonly store = true;
  onOwned?: (ids: string[]) => void;
  private readonly ready: Promise<Cdv | null>;
  private waiting: { id: string; done: (r: BuyResult) => void } | null = null;

  constructor(private readonly onPrices: () => void) {
    this.ready = this.init();
  }

  private async init(): Promise<Cdv | null> {
    const cdv = await purchasePlugin();
    if (!cdv) return null;
    const plat = platform() === "ios" ? cdv.Platform.APPLE_APPSTORE : cdv.Platform.GOOGLE_PLAY;
    cdv.store.register(PRODUCTS.map(p => ({ id: p.id, type: cdv.ProductType.NON_CONSUMABLE, platform: plat })));
    cdv.store.when()
      // Items are only cosmetic, so purchases are trusted as the store reports them.
      .approved(t => { void t.finish(); })
      .finished(t => {
        const ids = t.products.map(p => p.id).filter(id => PRODUCTS.some(p => p.id === id));
        if (!ids.length) return;
        if (this.waiting && ids.includes(this.waiting.id)) { this.waiting.done("ok"); this.waiting = null; }
        this.onOwned?.(ids);
      })
      .productUpdated(() => this.onPrices());
    cdv.store.error(() => { /* shown per purchase instead */ });
    try { await cdv.store.initialize([plat]); } catch { return null; }
    this.onPrices();
    return cdv;
  }

  price(product: Product): string | null {
    const cdv = (window as unknown as { CdvPurchase?: Cdv }).CdvPurchase;
    return cdv?.store.get(product.id)?.pricing?.price ?? null;
  }

  async buy(product: Product): Promise<BuyResult> {
    const cdv = await this.ready;
    const offer = cdv?.store.get(product.id)?.getOffer();
    if (!cdv || !offer) return "error";
    const done = new Promise<BuyResult>(resolve => { this.waiting = { id: product.id, done: resolve }; });
    const err = await offer.order();
    if (err) {
      this.waiting = null;
      return err.code === cdv.ErrorCode.PAYMENT_CANCELLED ? "cancelled" : "error";
    }
    // Some payments (cash, slow banks) finish later; onOwned unlocks them when they do.
    return Promise.race([done, new Promise<BuyResult>(r => setTimeout(() => r("redirect"), 120_000))]);
  }

  async owned(): Promise<string[] | null> {
    const cdv = await this.ready;
    return cdv ? PRODUCTS.filter(p => cdv.store.owned(p.id)).map(p => p.id) : null;
  }

  async restore(): Promise<string[] | null> {
    const cdv = await this.ready;
    if (!cdv) return null;
    try { await cdv.store.restorePurchases(); } catch { return null; }
    return this.owned();
  }
}

/** The provider for this page, or null when purchases aren't available here.
 *  `onPrices` is called when the store's prices load, so the shop can redraw. */
export function choosePayments(onPrices: () => void = () => {}): PaymentProvider | null {
  // The phone apps always use the store's own billing.
  if (isNative()) return new StoreProvider(onPrices);
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

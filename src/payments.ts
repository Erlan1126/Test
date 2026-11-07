// Buying Sky Crystal packs with real money.
//
// - In the phone apps, Apple and Google require their own in-app purchases, so packs are
//   consumable store products (StoreProvider).
// - On the website, packs go through Stripe Checkout via the small server in server/: the
//   game asks it for a checkout page, Stripe takes the payment, and the server records the
//   purchase. The game then asks the server which purchases it hasn't counted yet.
// - Until that server is deployed (PAYMENTS_API is empty), packs show as "coming soon". For
//   trying the flow, test mode (add ?testpay to the URL) adds crystals without charging.
//
// Every completed purchase has a transaction id; the save remembers those ids so a pack
// is never counted twice (see grantPack in logic/premium.ts).
import { VIP_ID } from "./logic/vip";
import { CRYSTAL_PACKS, PAYMENTS_API, type CrystalPack } from "./data/premium";
import { isNative, platform } from "./native";

export type BuyResult = "ok" | "redirect" | "cancelled" | "error";

/** A finished purchase: which pack, and the store's or checkout's transaction id. */
export interface PackPurchase { pack: string; tx: string }

export interface PaymentProvider {
  /** Real money changes hands. */
  readonly live: boolean;
  /** App Store or Google Play. */
  readonly store?: boolean;
  buy(pack: CrystalPack, playerId: string): Promise<BuyResult>;
  /** Purchases the server has recorded for this player (website only), or null if it
   *  can't be reached. */
  purchases?(playerId: string): Promise<PackPurchase[] | null>;
  /** The store's own price text in the player's currency, once it has loaded. */
  price?(pack: CrystalPack): string | null;
  /** Called whenever a purchase completes, including ones that finish later (a pending
   *  payment) or were interrupted last time. */
  onPurchase?: (p: PackPurchase) => void;
  /** Skyrise VIP (app stores and test mode only). */
  buyVip?(): Promise<BuyResult>;
  vipPrice?(): string | null;
  /** Called with whether VIP is on, whenever the store knows. */
  onVip?: (active: boolean) => void;
}

/** Test mode: adds crystals instantly and charges nothing. */
class TestProvider implements PaymentProvider {
  readonly live = false;
  onPurchase?: (p: PackPurchase) => void;
  onVip?: (active: boolean) => void;
  async buyVip(): Promise<BuyResult> {
    this.onVip?.(true);
    return "ok";
  }
  async buy(pack: CrystalPack): Promise<BuyResult> {
    this.onPurchase?.({ pack: pack.id, tx: `test-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    return "ok";
  }
}

/** Stripe Checkout through the Skyrise payment server. */
class StripeProvider implements PaymentProvider {
  readonly live = true;
  onPurchase?: (p: PackPurchase) => void;
  constructor(private readonly api: string) {}

  async buy(pack: CrystalPack, playerId: string): Promise<BuyResult> {
    try {
      const back = location.origin + location.pathname;
      const res = await fetch(`${this.api}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: pack.id, player: playerId, returnUrl: back }),
      });
      if (!res.ok) return "error";
      const { url } = await res.json() as { url?: string };
      if (!url || !/^https:\/\/checkout\.stripe\.com\//.test(url)) return "error";
      // Stripe's checkout page takes over; it sends the player back with ?purchase=...
      // Embedded copies (such as an itch.io frame) open it in the whole window.
      try { (window.top ?? window).location.href = url; } catch { location.href = url; }
      return "redirect";
    } catch {
      return "error";
    }
  }

  async purchases(playerId: string): Promise<PackPurchase[] | null> {
    try {
      const res = await fetch(`${this.api}/entitlements?player=${encodeURIComponent(playerId)}`);
      if (!res.ok) return null;
      const body = await res.json() as { purchases?: unknown };
      if (!Array.isArray(body.purchases)) return null;
      return body.purchases.filter((x): x is PackPurchase =>
        !!x && typeof (x as PackPurchase).pack === "string" && typeof (x as PackPurchase).tx === "string");
    } catch {
      return null;
    }
  }
}

// ---------- App Store and Google Play ----------

// cordova-plugin-purchase adds `CdvPurchase` to the page inside the apps. Only the parts
// used here are typed.
interface CdvTransaction { transactionId: string; products: { id: string }[]; finish(): Promise<void> }
interface CdvOffer { order(): Promise<{ code: number; message: string } | undefined> }
interface CdvProduct { pricing?: { price: string }; getOffer(): CdvOffer | undefined }
interface CdvWhen {
  approved(cb: (t: CdvTransaction) => void): CdvWhen;
  productUpdated(cb: () => void): CdvWhen;
  receiptsReady(cb: () => void): CdvWhen;
}
interface CdvStore {
  register(p: { id: string; type: string; platform: string }[]): void;
  initialize(platforms: string[]): Promise<unknown[]>;
  get(id: string, platform?: string): CdvProduct | undefined;
  when(): CdvWhen;
  owned(id: string): boolean;
  error(cb: (e: { code: number; message: string }) => void): void;
}
interface Cdv {
  store: CdvStore;
  Platform: { APPLE_APPSTORE: string; GOOGLE_PLAY: string };
  ProductType: { CONSUMABLE: string; PAID_SUBSCRIPTION: string };
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

/** Crystal packs through the App Store or Google Play. Store product ids match ours. */
class StoreProvider implements PaymentProvider {
  readonly live = true;
  readonly store = true;
  onPurchase?: (p: PackPurchase) => void;
  private readonly ready: Promise<Cdv | null>;
  private waiting: { id: string; done: (r: BuyResult) => void } | null = null;

  constructor(private readonly onPrices: () => void) {
    this.ready = this.init();
  }

  private async init(): Promise<Cdv | null> {
    const cdv = await purchasePlugin();
    if (!cdv) return null;
    const plat = platform() === "ios" ? cdv.Platform.APPLE_APPSTORE : cdv.Platform.GOOGLE_PLAY;
    cdv.store.register(CRYSTAL_PACKS.map(p => ({ id: p.id, type: cdv.ProductType.CONSUMABLE, platform: plat })));
    cdv.store.register([{ id: VIP_ID, type: cdv.ProductType.PAID_SUBSCRIPTION, platform: plat }]);
    cdv.store.when()
      // The crystals are added (and saved) first, then the store is told the purchase is
      // done. If the app closes in between, the store hands the purchase over again on the
      // next launch, and its transaction id stops it counting twice.
      .approved(t => {
        for (const p of t.products) {
          if (p.id === VIP_ID) {
            this.onVip?.(true);
            if (this.waiting?.id === VIP_ID) { this.waiting.done("ok"); this.waiting = null; }
            continue;
          }
          if (!CRYSTAL_PACKS.some(x => x.id === p.id)) continue;
          this.onPurchase?.({ pack: p.id, tx: `${plat}:${t.transactionId}` });
          if (this.waiting?.id === p.id) { this.waiting.done("ok"); this.waiting = null; }
        }
        void t.finish();
      })
      .productUpdated(() => this.onPrices())
      // Once the store has loaded the player's purchases, it knows whether VIP is still on
      // (renewed or cancelled).
      .receiptsReady(() => this.onVip?.(cdv.store.owned(VIP_ID)));
    cdv.store.error(() => { /* shown per purchase instead */ });
    try { await cdv.store.initialize([plat]); } catch { return null; }
    this.onPrices();
    return cdv;
  }

  onVip?: (active: boolean) => void;

  vipPrice(): string | null {
    const cdv = (window as unknown as { CdvPurchase?: Cdv }).CdvPurchase;
    return cdv?.store.get(VIP_ID)?.pricing?.price ?? null;
  }

  async buyVip(): Promise<BuyResult> {
    const cdv = await this.ready;
    const offer = cdv?.store.get(VIP_ID)?.getOffer();
    if (!cdv || !offer) return "error";
    const done = new Promise<BuyResult>(resolve => { this.waiting = { id: VIP_ID, done: resolve }; });
    const err = await offer.order();
    if (err) {
      this.waiting = null;
      return err.code === cdv.ErrorCode.PAYMENT_CANCELLED ? "cancelled" : "error";
    }
    return Promise.race([done, new Promise<BuyResult>(r => setTimeout(() => r("redirect"), 120_000))]);
  }

  price(pack: CrystalPack): string | null {
    const cdv = (window as unknown as { CdvPurchase?: Cdv }).CdvPurchase;
    return cdv?.store.get(pack.id)?.pricing?.price ?? null;
  }

  async buy(pack: CrystalPack): Promise<BuyResult> {
    const cdv = await this.ready;
    const offer = cdv?.store.get(pack.id)?.getOffer();
    if (!cdv || !offer) return "error";
    const done = new Promise<BuyResult>(resolve => { this.waiting = { id: pack.id, done: resolve }; });
    const err = await offer.order();
    if (err) {
      this.waiting = null;
      return err.code === cdv.ErrorCode.PAYMENT_CANCELLED ? "cancelled" : "error";
    }
    // Some payments (cash, slow banks) finish later; onPurchase adds them when they do.
    return Promise.race([done, new Promise<BuyResult>(r => setTimeout(() => r("redirect"), 120_000))]);
  }
}

/** The provider for this page, or null when purchases aren't available here.
 *  `onPrices` is called when the store's prices load, so the shop can redraw. */
export function choosePayments(onPrices: () => void = () => {}): PaymentProvider | null {
  // The phone apps always use the store's own billing.
  if (isNative()) return new StoreProvider(onPrices);
  const params = new URLSearchParams(location.search);
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  // Test mode never runs on a live site with real payments, or anyone could get crystals free.
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

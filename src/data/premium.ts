// Premium cosmetics, bought with real money. They change how things look and never help
// you score. Prices here are what the shop shows; the payment server charges the
// matching Stripe prices (see server/README.md).

export interface Product {
  id: string;
  name: string;
  text: string;
  kind: "skin" | "island" | "bundle";
  /** Price in US cents. */
  cents: number;
  grants: { skins?: string[]; themes?: string[]; coins?: number };
}

export const PRODUCTS: Product[] = [
  { id: "skin_crystal", name: "Crystal Palace", kind: "skin", cents: 199, text: "A sparkling tower of ice-blue glass", grants: { skins: ["crystal"] } },
  { id: "skin_sakura", name: "Sakura Spire", kind: "skin", cents: 199, text: "Blossom pink with warm paper lanterns", grants: { skins: ["sakura"] } },
  { id: "skin_royal", name: "Royal Amethyst", kind: "skin", cents: 199, text: "Deep purple stone trimmed in gold", grants: { skins: ["royal"] } },
  { id: "skin_cyber", name: "Cyber City", kind: "skin", cents: 299, text: "Black glass with glowing neon edges", grants: { skins: ["cyber"] } },
  { id: "island_volcano", name: "Volcano Island", kind: "island", cents: 299, text: "Black rock, palm trees and glowing lava", grants: { themes: ["volcano"] } },
  { id: "island_candy", name: "Candy Island", kind: "island", cents: 299, text: "Pastel lawns and cotton-candy trees", grants: { themes: ["candy"] } },
  {
    id: "founders", name: "Founder's Pack", kind: "bundle", cents: 799,
    text: "Every premium skin and island, plus 5,000 coins. Thank you for supporting Skyrise!",
    grants: { skins: ["crystal", "sakura", "royal", "cyber"], themes: ["volcano", "candy"], coins: 5000 },
  },
];

export const productById = (id: string): Product | undefined => PRODUCTS.find(p => p.id === id);

export const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * Where the payment server lives once it's deployed (see server/README.md), for example
 * "https://skyrise-pay.yourname.workers.dev". While it's empty, real purchases are off and
 * the shop says premium items are coming soon.
 */
export const PAYMENTS_API: string = "";

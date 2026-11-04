// Sky Crystals, the paid currency, and the premium cosmetics they buy. Crystals come in
// packs bought with real money (App Store, Google Play, or Stripe on the website) and in
// small amounts from levels and the Sky Pass. Everything here only changes how things
// look; nothing helps you score.

import { SERVER_URL, WEB_PAYMENTS } from "./server";

export interface Product {
  id: string;
  name: string;
  text: string;
  kind: "skin" | "island" | "bundle";
  /** Price in Sky Crystals. */
  crystals: number;
  grants: { skins?: string[]; themes?: string[]; coins?: number };
}

/** A pack of crystals sold for real money. Its id is the store product id. */
export interface CrystalPack {
  id: string;
  crystals: number;
  /** Price in US cents (the stores show local prices). */
  cents: number;
  /** "+20% bonus" style tag. */
  bonus?: string;
  /** Tagged "Most popular". */
  best?: boolean;
  /** Tagged "Best value". */
  value?: boolean;
}

export const CRYSTAL_PACKS: CrystalPack[] = [
  { id: "crystals_200", crystals: 200, cents: 199 },
  { id: "crystals_650", crystals: 650, cents: 599, bonus: "+8%" },
  { id: "crystals_1250", crystals: 1250, cents: 1099, bonus: "+14%", best: true },
  { id: "crystals_2600", crystals: 2600, cents: 2099, bonus: "+24%" },
  { id: "crystals_8000", crystals: 8000, cents: 5999, bonus: "+33%" },
  { id: "crystals_14000", crystals: 14000, cents: 9999, bonus: "+40%", value: true },
];

export const packById = (id: string): CrystalPack | undefined => CRYSTAL_PACKS.find(p => p.id === id);

/** The Sky Pass premium track, per season. */
export const PASS_PRICE = 500;

export const PRODUCTS: Product[] = [
  { id: "skin_crystal", name: "Crystal Palace", kind: "skin", crystals: 200, text: "A sparkling tower of ice-blue glass", grants: { skins: ["crystal"] } },
  { id: "skin_sakura", name: "Sakura Spire", kind: "skin", crystals: 200, text: "Blossom pink with warm paper lanterns", grants: { skins: ["sakura"] } },
  { id: "skin_royal", name: "Royal Amethyst", kind: "skin", crystals: 200, text: "Deep purple stone trimmed in gold", grants: { skins: ["royal"] } },
  { id: "skin_cyber", name: "Cyber City", kind: "skin", crystals: 300, text: "Black glass with glowing neon edges", grants: { skins: ["cyber"] } },
  { id: "island_volcano", name: "Volcano Island", kind: "island", crystals: 300, text: "Black rock, palm trees and glowing lava", grants: { themes: ["volcano"] } },
  { id: "island_candy", name: "Candy Island", kind: "island", crystals: 300, text: "Pastel lawns and cotton-candy trees", grants: { themes: ["candy"] } },
  {
    id: "founders", name: "Founder's Pack", kind: "bundle", crystals: 900,
    text: "Every premium skin and island, plus 5,000 coins. Thank you for supporting Skyrise!",
    grants: { skins: ["crystal", "sakura", "royal", "cyber"], themes: ["volcano", "candy"], coins: 5000 },
  },
];

export const productById = (id: string): Product | undefined => PRODUCTS.find(p => p.id === id);

export const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** The website's payment server: part of the Skyrise server, once Stripe is set up. */
export const PAYMENTS_API: string = WEB_PAYMENTS ? SERVER_URL : "";

// The weekly tournament: everyone's best Classic or Daily tower of the week on the
// worldwide board. When the week ends, prizes go by final rank, and every builder who
// took part gets something. The board is the server's (each tower checked by replay);
// the prize is collected the first time the game opens the next week.
import { t } from "../i18n";
import { addStars } from "./progress";
import type { SaveData } from "./save";

export interface Prize { crystals: number; stars: number; label: string }

/** Prize tiers, best first: [label, rank or share of the board, crystals, stars]. */
export const TIERS: { label: string; upTo: (total: number) => number; crystals: number; stars: number }[] = [
  { label: "#1", upTo: () => 1, crystals: 150, stars: 0 },
  { label: "Top 3", upTo: () => 3, crystals: 80, stars: 0 },
  { label: "Top 10", upTo: () => 10, crystals: 40, stars: 0 },
  { label: "Top 10%", upTo: n => Math.max(10, Math.ceil(n * 0.1)), crystals: 20, stars: 0 },
  { label: "Everyone", upTo: n => n, crystals: 0, stars: 15 },
];

/** What a final rank of `rank` out of `total` builders wins. */
export function prizeFor(rank: number, total: number): Prize {
  const tier = TIERS.find(x => rank <= x.upTo(total)) ?? TIERS[TIERS.length - 1];
  return { crystals: tier.crystals, stars: tier.stars, label: tier.label };
}

export const prizeText = (p: Prize): string => p.crystals ? `+${p.crystals} 💎` : `+${p.stars} ★`;

/** Pays last week's prize once. Returns the prize, or null if already paid. */
export function claimTournament(save: SaveData, week: number, rank: number, total: number): Prize | null {
  if (save.tourney >= week) return null;
  save.tourney = week;
  const p = prizeFor(rank, Math.max(rank, total));
  save.crystals += p.crystals;
  if (p.stars) addStars(save, p.stars);
  return p;
}

/** A tier's name for display. */
export const tierName = (label: string): string => label === "Everyone" ? t("Everyone who plays") : label.startsWith("Top") ? t("Top {n}", { n: label.slice(4) }) : label;

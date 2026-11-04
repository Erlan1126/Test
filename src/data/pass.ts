// The Sky Pass: a new season every calendar month (UTC) with 30 tiers. Everyone earns
// the free track by playing; the premium track is unlocked with Sky Crystals.
import type { BoostId } from "./shop";

export const PASS_TIERS = 30;
/** Pass XP needed for each tier. */
export const XP_PER_TIER = 250;

export interface PassReward {
  coins?: number;
  stars?: number;
  crystals?: number;
  boost?: BoostId;
  skin?: string;
}

export interface SeasonTheme {
  name: string;
  /** Short line under the title. */
  text: string;
  color: string;
  /** Premium tier 1, free tier 25 and premium tier 30. */
  skins: { first: string; free: string; last: string };
}

/** Seasons cycle through these themes, one per month. */
export const SEASON_THEMES: SeasonTheme[] = [
  { name: "Golden Hour", text: "Warm sunsets and polished copper", color: "#ffb347",
    skins: { first: "sunset", free: "copper", last: "goldenhour" } },
  { name: "Frostbite", text: "Ice, snow and northern lights", color: "#8fd8ff",
    skins: { first: "glacier", free: "snowdrift", last: "frostqueen" } },
  { name: "Neon Carnival", text: "Arcade lights and fairground glow", color: "#ff5fd2",
    skins: { first: "arcade", free: "carnival", last: "hyperdrive" } },
  { name: "Jungle Temple", text: "Jade stone and hidden treasure", color: "#5fd18b",
    skins: { first: "jade", free: "mossy", last: "idol" } },
  { name: "Spring Bloom", text: "Fresh petals and pastel glass", color: "#ff9fcf",
    skins: { first: "bloom", free: "tulip", last: "eden" } },
  { name: "Deep Sea", text: "Coral reefs and glowing depths", color: "#3fd6d0",
    skins: { first: "tide", free: "coral", last: "abyss" } },
  { name: "Desert Mirage", text: "Shimmering sand and golden oases", color: "#f2c46b",
    skins: { first: "oasis", free: "dune", last: "pharaoh" } },
  { name: "Cosmic Voyage", text: "Nebulas, comets and distant stars", color: "#b48cff",
    skins: { first: "nebula", free: "comet", last: "galaxy" } },
];

/** Season 1 is November 2026. */
const FIRST_YEAR = 2026, FIRST_MONTH = 10;

export function seasonIndex(now = Date.now()): number {
  const d = new Date(now);
  return (d.getUTCFullYear() - FIRST_YEAR) * 12 + d.getUTCMonth() - FIRST_MONTH;
}

export const seasonTheme = (season: number): SeasonTheme =>
  SEASON_THEMES[((season % SEASON_THEMES.length) + SEASON_THEMES.length) % SEASON_THEMES.length];

/** Milliseconds until the season ends (the end of the month, UTC). */
export function seasonEndsIn(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - now;
}

const BOOST_CYCLE: BoostId[] = ["rewind", "xp", "gold"];

/** What tier `t` (1 to 30) pays on the free track. */
export function freeReward(season: number, t: number): PassReward {
  if (t === 25) return { skin: seasonTheme(season).skins.free };
  if (t % 10 === 0) return { stars: 3 };
  if (t % 5 === 0) return { crystals: 10 };
  if (t % 3 === 0) return { boost: BOOST_CYCLE[(t / 3) % 3] };
  return { coins: 80 + t * 10 };
}

/** What tier `t` pays on the premium track. */
export function premiumReward(season: number, t: number): PassReward {
  const th = seasonTheme(season);
  if (t === 1) return { skin: th.skins.first };
  if (t === PASS_TIERS) return { skin: th.skins.last };
  if (t === 15) return { crystals: 100 };
  if (t % 5 === 0) return { crystals: 40 };
  if (t % 3 === 0) return { boost: BOOST_CYCLE[(t / 3 + 1) % 3] };
  if (t % 2 === 0) return { coins: 300 };
  return { stars: 2 };
}

/** Pass XP for a finished tower. */
export const towerPassXp = (floors: number, zen: boolean): number => Math.round(Math.min(60, 10 + floors) * (zen ? 0.5 : 1));
export const MISSION_PASS_XP = 40;
export const CHEST_PASS_XP = 100;

/** Extra rewards for reaching builder level `level` (on top of the usual stars). */
export function levelReward(level: number): { coins: number; crystals: number } {
  return {
    coins: Math.min(600, 100 + level * 20),
    crystals: level % 10 === 0 ? 30 : level % 5 === 0 ? 10 : 0,
  };
}

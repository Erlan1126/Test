// The Sky Pass: earning pass XP, claiming tier rewards and unlocking the premium track.
import { PASS_PRICE } from "../data/premium";
import { CHEST_PASS_XP, freeReward, PASS_TIERS, premiumReward, seasonIndex, XP_PER_TIER, type PassReward } from "../data/pass";
import { MAX_BOOSTS } from "../data/shop";
import { skinById } from "../data/skins";
import { t } from "../i18n";
import type { SaveData } from "./save";

/** Rewards from last season that were reached but never claimed, handed out at the switch.
 *  The menu shows them once and clears this. */
export const carriedOver: PassReward[] = [];

/** Starts a fresh pass when a new season begins. Anything reached but not claimed in the
 *  old season is given to the player first, so nothing earned is ever lost. */
export function refreshPass(save: SaveData, now = Date.now()): boolean {
  const season = seasonIndex(now);
  if (save.pass.season === season) return false;
  carriedOver.push(...claimAll(save));
  save.pass = { season, xp: 0, premium: false, free: [], prem: [] };
  return true;
}

export const passTier = (save: SaveData): number => Math.min(PASS_TIERS, Math.floor(save.pass.xp / XP_PER_TIER));

/** Adds pass XP. Returns how many tiers were reached. */
export function addPassXp(save: SaveData, xp: number, now = Date.now()): number {
  refreshPass(save, now);
  const before = passTier(save);
  save.pass.xp = Math.min(save.pass.xp + Math.max(0, Math.round(xp)), PASS_TIERS * XP_PER_TIER);
  return passTier(save) - before;
}

export const chestPassXp = (save: SaveData, now = Date.now()): number => addPassXp(save, CHEST_PASS_XP, now);

/** Gives one reward to the player. */
export function giveReward(save: SaveData, r: PassReward): void {
  if (r.stars) { save.stars += r.stars; save.starsEarned += r.stars; }
  if (r.crystals) save.crystals += r.crystals;
  if (r.boost) save.boosts[r.boost] = Math.min(MAX_BOOSTS, save.boosts[r.boost] + 1);
  if (r.skin && !save.ownedSkins.includes(r.skin)) save.ownedSkins.push(r.skin);
}

export function rewardText(r: PassReward): string {
  if (r.skin) return t("{name} skin", { name: t(skinById(r.skin).name) });
  if (r.crystals) return t("{n} Sky Crystals", { n: r.crystals });
  if (r.stars) return `${r.stars} ★`;
  if (r.boost) return { rewind: t("Extra rewind"), xp: t("Double XP"), gold: t("Gold rush") }[r.boost];
  return `${r.stars ?? 0} ★`;
}

export type Track = "free" | "prem";

export const claimable = (save: SaveData, track: Track, t: number): boolean =>
  t >= 1 && t <= passTier(save) && !save.pass[track].includes(t) && (track === "free" || save.pass.premium);

/** Claims one tier's reward. */
export function claimTier(save: SaveData, track: Track, t: number): PassReward | null {
  if (!claimable(save, track, t)) return null;
  const r = track === "free" ? freeReward(save.pass.season, t) : premiumReward(save.pass.season, t);
  save.pass[track].push(t);
  giveReward(save, r);
  return r;
}

/** Claims everything waiting. */
export function claimAll(save: SaveData): PassReward[] {
  const got: PassReward[] = [];
  for (let t = 1; t <= passTier(save); t++) {
    for (const track of ["free", "prem"] as Track[]) {
      const r = claimTier(save, track, t);
      if (r) got.push(r);
    }
  }
  return got;
}

export const unclaimed = (save: SaveData): number => {
  let n = 0;
  for (let t = 1; t <= passTier(save); t++) {
    if (claimable(save, "free", t)) n++;
    if (claimable(save, "prem", t)) n++;
  }
  return n;
};

/** Unlocks the premium track with crystals. */
export function buyPremiumPass(save: SaveData, now = Date.now()): "ok" | "owned" | "short" {
  refreshPass(save, now);
  if (save.pass.premium) return "owned";
  if (save.crystals < PASS_PRICE) return "short";
  save.crystals -= PASS_PRICE;
  save.pass.premium = true;
  return "ok";
}

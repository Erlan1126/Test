// What a finished tower changes in the save: bests, missions, trophies, XP and levels,
// stars, challenges, history and unlocks. Pure functions over SaveData, so they're tested.
import { fmt, listNames } from "../core/util";
import { challengeById, CHALLENGES } from "../data/challenges";
import { MILESTONES } from "../data/constants";
import { ISLAND_THEMES, ISLAND_UPGRADES, type IslandTheme } from "../data/islands";
import { MISSION_KEYS, MISSION_TYPES, missionText } from "../data/missions";
import { SKINS, type Skin } from "../data/skins";
import { TROPHIES, type TrophyContext } from "../data/trophies";
import { addXp, dayKey, dayNumber, landmarkIndex, runXp, xpNeeded } from "./rules";
import { HISTORY_SIZE, type SaveData } from "./save";
import type { Reward, RunSummary } from "./types";

// ---------- Unlock checks ----------

export function isSkinUnlocked(save: SaveData, skin: Skin): boolean {
  if (!skin.unlock) return true;
  if ("price" in skin.unlock) return save.ownedSkins.includes(skin.id);
  return save.bestMeters > MILESTONES[skin.unlock.at].m;
}

export const unlockedSkinCount = (save: SaveData): number => SKINS.filter(s => isSkinUnlocked(save, s)).length;

export function skinUnlockText(skin: Skin): string {
  if (!skin.unlock) return "";
  if ("price" in skin.unlock) return `Buy it in the shop for ${skin.unlock.price} ★`;
  const ms = MILESTONES[skin.unlock.at];
  return `Build taller than ${ms.name} (${ms.m} m)`;
}

export const islandLevel = (save: SaveData): number => ISLAND_UPGRADES.filter(u => save.bestMeters > MILESTONES[u.at].m).length;
export const themeUnlocked = (save: SaveData, t: IslandTheme): boolean => save.profile.level >= t.level;
export const currentTheme = (save: SaveData): IslandTheme =>
  ISLAND_THEMES.find(t => t.id === save.island && themeUnlocked(save, t)) ?? ISLAND_THEMES[0];

/** The next challenge to play: the first one not yet completed. */
export const nextChallenge = (save: SaveData) => CHALLENGES.find(c => !save.challenges.includes(c.id));
export const challengeOpen = (save: SaveData, id: string): boolean => {
  const i = CHALLENGES.findIndex(c => c.id === id);
  return i >= 0 && CHALLENGES.slice(0, i).every(c => save.challenges.includes(c.id));
};

// ---------- Stars ----------

export function addStars(save: SaveData, n: number): void {
  save.stars += n;
  save.starsEarned += n;
}

// ---------- Missions ----------

/** Fills empty mission slots. Missions get harder after every three finished. */
export function dealMissions(save: SaveData, rng: () => number = Math.random): void {
  while (save.missions.slots.length < 3) {
    const taken = save.missions.slots.map(m => m.t);
    const pool = MISSION_KEYS.filter(t => !taken.includes(t));
    const t = pool[Math.floor(rng() * pool.length)];
    const tier = Math.min(2, Math.floor(save.missions.done / 3));
    save.missions.slots.push({ t, n: MISSION_TYPES[t].tiers[tier], r: tier + 1, p: 0 });
  }
}

/** Swaps one mission for a new one, once per day. Returns false if already used today. */
export function swapMission(save: SaveData, index: number, now = Date.now(), rng: () => number = Math.random): boolean {
  if (save.profile.swapDay === dayKey(0, now) || !save.missions.slots[index]) return false;
  const old = save.missions.slots[index].t;
  save.missions.slots.splice(index, 1);
  // Deal until the replacement differs from the one swapped out (when possible).
  for (let tries = 0; tries < 8; tries++) {
    dealMissions(save, rng);
    if (save.missions.slots[2].t !== old) break;
    save.missions.slots.pop();
  }
  dealMissions(save, rng);
  save.profile.swapDay = dayKey(0, now);
  return true;
}

// ---------- Finishing a tower ----------

export interface RunOutcome {
  rewards: Reward[];
  newBest: boolean;
  xp: { gained: number; startPct: number; endPct: number; level: number };
  /** Today's best daily score, after this tower. */
  dailyBest: number;
  /** The closest goal just missed, to tempt one more tower. */
  near: string;
  /** Skin to switch to because it was just unlocked. */
  newSkin?: string;
}

export function recordRun(save: SaveData, run: RunSummary, now = Date.now(), rng: () => number = Math.random): RunOutcome {
  const rewards: Reward[] = [];
  const skinsBefore = new Set(SKINS.filter(s => isSkinUnlocked(save, s)).map(s => s.id));
  const islandBefore = islandLevel(save), levelBefore = save.profile.level;
  const zen = run.mode === "zen";
  let newBest = false;

  if (!zen) {
    if (run.score > save.best) { save.best = run.score; newBest = true; }
    save.bestMeters = Math.max(save.bestMeters, run.meters);
  }

  let dailyBest = 0;
  if (run.mode === "daily") {
    const day = dayNumber(now);
    if (save.daily.day !== day) save.daily = { day, best: 0, plays: 0 };
    save.daily.plays++;
    save.daily.best = Math.max(save.daily.best, run.score);
    dailyBest = save.daily.best;
    if (!save.profile.dailyDays.includes(day)) save.profile.dailyDays.push(day);
  }

  // Missions
  if (!zen) {
    const got: Record<string, number> = {
      perfects: run.perfects, streak: run.bestStreak, height: run.meters, people: run.score, wind: run.windFloors,
      penthouse: run.penthouses, towers: 1, floors: run.floors, daily: run.mode === "daily" ? 1 : 0,
    };
    const finished = save.missions.slots.filter(m => {
      m.p = MISSION_TYPES[m.t].game ? Math.max(m.p, got[m.t]) : m.p + got[m.t];
      return m.p >= m.n;
    });
    save.missions.slots = save.missions.slots.filter(m => !finished.includes(m));
    for (const m of finished) {
      save.missions.done++;
      addStars(save, m.r);
      rewards.push({ kind: "star", text: `Mission complete: ${missionText(m)} (+${m.r} ★)` });
    }
    dealMissions(save, rng);
  }

  // Challenge, paid the first time it's won
  if (run.mode === "challenge" && run.challengeWon && run.challengeId && !save.challenges.includes(run.challengeId)) {
    const c = challengeById(run.challengeId);
    if (c) {
      save.challenges.push(c.id);
      addStars(save, c.reward);
      rewards.unshift({ kind: "star", text: `Challenge complete: ${c.name} (+${c.reward} ★)` });
    }
  }

  // Lifetime stats
  const p = save.profile;
  p.towers++;
  p.floors += run.floors;
  p.perfects += run.perfects;
  p.penthouses += run.penthouses;
  p.bestStreak = Math.max(p.bestStreak, run.bestStreak);

  // Trophies
  const ctx = trophyContext(save);
  for (const t of TROPHIES) {
    if (p.trophies.includes(t.id) || (zen && !t.zen) || !t.test(run, ctx)) continue;
    p.trophies.push(t.id);
    addStars(save, 1);
    rewards.push({ kind: "star", text: `Trophy: ${t.name} (+1 ★)` });
  }

  // XP and levels
  const gained = runXp(run, newBest);
  const startPct = p.xp / xpNeeded(p.level);
  const lv = addXp(p.level, p.xp, gained);
  p.level = lv.level;
  p.xp = lv.xp;
  if (lv.ups) {
    addStars(save, lv.stars);
    rewards.unshift({ kind: "star", text: `Level up! You're now builder level ${p.level} (+${lv.stars} ★)` });
  }

  // Best towers
  if (!zen && run.floors > 0) {
    save.history.push({ score: run.score, meters: run.meters, floors: run.floors, mode: run.mode, day: dayKey(0, now) });
    save.history.sort((a, b) => b.score - a.score);
    save.history.length = Math.min(save.history.length, HISTORY_SIZE);
  }

  // Unlocks, one line each
  const newSkins = SKINS.filter(s => isSkinUnlocked(save, s) && !skinsBefore.has(s.id));
  if (newSkins.length) rewards.push({ kind: "skin", text: `New skin${newSkins.length > 1 ? "s" : ""} unlocked: ${listNames(newSkins.map(s => s.name))}` });
  const built = ISLAND_UPGRADES.slice(islandBefore, islandLevel(save)).map(u => u.name);
  if (built.length) rewards.push({ kind: "island", text: `Island upgrade${built.length > 1 ? "s" : ""}: ${listNames(built)}` });
  const themes = ISLAND_THEMES.filter(t => t.level > levelBefore && t.level <= p.level).map(t => t.name);
  if (themes.length) rewards.push({ kind: "island", text: `New island theme${themes.length > 1 ? "s" : ""}: ${listNames(themes)}` });

  return {
    rewards,
    newBest,
    xp: { gained, startPct: lv.ups ? 0 : startPct, endPct: p.xp / xpNeeded(p.level), level: p.level },
    dailyBest,
    near: zen ? "" : nearMiss(save, run, newBest),
    newSkin: newSkins.length ? newSkins[newSkins.length - 1].id : undefined,
  };
}

export function trophyContext(save: SaveData): TrophyContext {
  return {
    dailyDays: save.profile.dailyDays.length,
    giftStreak: save.profile.gift.streak,
    skinsUnlocked: unlockedSkinCount(save),
    challengesDone: save.challenges.length,
  };
}

/** Trophies that don't need a tower (gift streaks, collections) can be awarded any time. */
export function awardStandingTrophies(save: SaveData): string[] {
  const ctx = trophyContext(save), won: string[] = [];
  for (const t of TROPHIES) {
    if (save.profile.trophies.includes(t.id) || !t.test(null, ctx)) continue;
    save.profile.trophies.push(t.id);
    addStars(save, 1);
    won.push(t.name);
  }
  return won;
}

/** The closest goal you just missed: your best, the next landmark, or a mission. */
export function nearMiss(save: SaveData, run: RunSummary, newBest: boolean): string {
  if (!newBest && save.best > 0 && run.score > 0 && save.best - run.score <= Math.max(60, save.best * 0.25)) {
    return `Only ${fmt(save.best - run.score + 1)} people away from your best!`;
  }
  const next = MILESTONES[landmarkIndex(run.meters) + 1];
  if (next && next.m - run.meters < 30) return `Just ${next.m - run.meters + 1} m short of ${next.name}!`;
  const close = save.missions.slots.find(m => MISSION_TYPES[m.t].game && m.p / m.n >= 0.6 && m.p < m.n);
  if (close) return `Almost there: ${missionText(close)} (${fmt(close.p)} of ${fmt(close.n)})`;
  return "";
}

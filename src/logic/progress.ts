// What a finished tower changes in the save: bests, missions, trophies, XP and levels,
// stars, challenges, history and unlocks. Pure functions over SaveData, so they're tested.
import { HOLIDAYS } from "../data/holidays";
import { districtOpen } from "./city";
import { vipActive } from "./vip";
import { fmt, listNames } from "../core/util";
import { t, tn } from "../i18n";
import { type Challenge, challengeById, CHALLENGES, CHAPTER_CHEST, stageStars, STAGES_PER_CHAPTER } from "../data/challenges";
import { MILESTONES } from "../data/constants";
import { ISLAND_THEMES, ISLAND_UPGRADES, type IslandTheme } from "../data/islands";
import { MISSION_TYPES, missionText } from "../data/missions";
import { SKINS, type Skin } from "../data/skins";
import { TROPHIES, type TrophyContext } from "../data/trophies";
import { addXp, dayKey, dayNumber, landmarkIndex, runXp, xpNeeded } from "./rules";
import { addLeague, allMissionsDone, dealMissions, refreshMissions, startRent, tickStreak } from "./daily";
import { premiumGrants } from "./premium";
import { addPassXp } from "./pass";
import { levelReward, MISSION_PASS_XP, towerPassXp } from "../data/pass";
import { HISTORY_SIZE, type SaveData } from "./save";

export { dealMissions };
import type { Reward, RunSummary } from "./types";

// ---------- Unlock checks ----------

export function isSkinUnlocked(save: SaveData, skin: Skin): boolean {
  if (!skin.unlock) return true;
  if ("price" in skin.unlock) return save.ownedSkins.includes(skin.id);
  if ("streak" in skin.unlock) return save.streak.best >= skin.unlock.streak;
  if ("product" in skin.unlock) return premiumGrants(save).skins.has(skin.id);
  if ("pass" in skin.unlock || "event" in skin.unlock) return save.ownedSkins.includes(skin.id);
  if ("vip" in skin.unlock) return vipActive(save);
  return save.bestMeters > MILESTONES[skin.unlock.at].m;
}

export const unlockedSkinCount = (save: SaveData): number => SKINS.filter(s => isSkinUnlocked(save, s)).length;

export function skinUnlockText(skin: Skin): string {
  if (!skin.unlock) return "";
  if ("price" in skin.unlock) return t("Buy it in the shop for {n} ★", { n: skin.unlock.price });
  if ("streak" in skin.unlock) return t("Play {n} days in a row", { n: skin.unlock.streak });
  if ("product" in skin.unlock) return t("Get it with Sky Crystals in the shop");
  if ("pass" in skin.unlock) return t("A Sky Pass reward ({season} season)", { season: t(skin.unlock.pass) });
  if ("vip" in skin.unlock) return t("Included with Skyrise VIP");
  if ("event" in skin.unlock && skin.unlock.event === "starter") return t("Comes with the Starter Pack");
  if ("event" in skin.unlock) {
    const h = HOLIDAYS.find(x => x.id === (skin.unlock as { event: string }).event);
    return t("Earn it during the {event} event", { event: h ? `${h.emoji} ${t(h.name)}` : "" });
  }
  const ms = MILESTONES[skin.unlock.at];
  return t("Build taller than {name} ({m} m)", { name: t(ms.name), m: ms.m });
}

/** Island upgrades built: those your best tower has earned, and never fewer than you
 *  had before upgrades got harder. */
export const islandLevel = (save: SaveData): number =>
  Math.max(save.islandKept, ISLAND_UPGRADES.filter(u => save.bestMeters > MILESTONES[u.at].m).length);
export const themeUnlocked = (save: SaveData, t: IslandTheme): boolean => districtOpen(save, t);
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

/** Swaps one mission for a new one, once per day. Returns false if already used today. */
export function swapMission(save: SaveData, index: number, now = Date.now(), rng: () => number = Math.random): boolean {
  if (save.profile.swapDay === dayKey(0, now) || !save.missions.slots[index] || save.missions.slots[index].d) return false;
  const old = save.missions.slots[index].t;
  save.missions.slots.splice(index, 1);
  // Deal until the replacement differs from the one swapped out (when possible).
  for (let tries = 0; tries < 8; tries++) {
    dealMissions(save, rng, now);
    if (save.missions.slots[save.missions.slots.length - 1].t !== old) break;
    save.missions.slots.pop();
  }
  dealMissions(save, rng, now);
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
  /** Set when this tower leveled you up, for the celebration. */
  levelUp?: { from: number; to: number; stars: number; crystals: number };
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
    const day = run.day ?? dayNumber(now);
    if (save.daily.day !== day) save.daily = { day, best: 0, plays: 0 };
    save.daily.plays++;
    save.daily.best = Math.max(save.daily.best, run.score);
    dailyBest = save.daily.best;
    if (!save.profile.dailyDays.includes(day)) save.profile.dailyDays.push(day);
  }

  // Missions
  let finishedNow = 0;
  if (!zen) {
    const got: Record<string, number> = {
      perfects: run.perfects, streak: run.bestStreak, height: run.meters, people: run.score, wind: run.windFloors,
      penthouse: run.penthouses, towers: 1, floors: run.floors, daily: run.mode === "daily" ? 1 : 0,
    };
    refreshMissions(save, now, rng);
    finishedNow = 0;
    for (const m of save.missions.slots) {
      if (m.d) continue;
      m.p = MISSION_TYPES[m.t].game ? Math.max(m.p, got[m.t]) : m.p + got[m.t];
      if (m.p < m.n) continue;
      m.d = true;
      finishedNow++;
      save.missions.done++;
      addStars(save, m.r);
      rewards.push({ kind: "star", group: "mission", stars: m.r, text: t("Mission complete: {mission} (+{n} ★)", { mission: missionText(m), n: m.r }) });
    }
    // Only on the tower that finished the last one, not every tower after it.
    if (finishedNow && allMissionsDone(save) && save.missions.chest !== dayKey(0, now)) {
      rewards.push({ kind: "star", text: t("All of today's missions done! Open your chest on the main menu") });
    }
    const tier = addLeague(save, run, now);
    if (tier) rewards.push({ kind: "star", text: t("You moved up to the {league} league this week!", { league: t(tier) }) });
  }

  // Streak and rent: every tower counts, Zen too.
  rewards.unshift(...tickStreak(save, now));
  startRent(save, now);

  // Journey stage: paid the first time it's won, plus a star for each new map star.
  if (run.mode === "challenge" && run.challengeWon && run.challengeId) rewards.unshift(...journeyRewards(save, run));

  // Lifetime stats
  const p = save.profile;
  p.towers++;
  p.floors += run.floors;
  p.perfects += run.perfects;
  p.penthouses += run.penthouses;
  p.bestStreak = Math.max(p.bestStreak, run.bestStreak);

  // Trophies
  const ctx = trophyContext(save);
  for (const tr of TROPHIES) {
    if (p.trophies.includes(tr.id) || (zen && !tr.zen) || !tr.test(run, ctx)) continue;
    p.trophies.push(tr.id);
    addStars(save, 1);
    rewards.push({ kind: "star", group: "trophy", name: t(tr.name), text: t("Trophy: {name} (+1 ★)", { name: t(tr.name) }) });
  }

  // XP and levels
  const gained = runXp(run, newBest);
  const startPct = p.xp / xpNeeded(p.level);
  let levelUp: RunOutcome["levelUp"];
  const lv = addXp(p.level, p.xp, gained);
  p.level = lv.level;
  p.xp = lv.xp;
  if (lv.ups) {
    addStars(save, lv.stars);
    let stars = 0, crystals = 0;
    for (let l = levelBefore + 1; l <= p.level; l++) {
      const r = levelReward(l);
      stars += r.stars;
      crystals += r.crystals;
    }
    addStars(save, stars);
    save.crystals += crystals;
    const extra = [`+${lv.stars + stars} ★`, crystals ? `+${crystals} 💎` : ""].filter(Boolean).join(", ");
    levelUp = { from: levelBefore, to: p.level, stars: lv.stars + stars, crystals };
    rewards.unshift({ kind: "star", text: t("Level up! You're now builder level {n} ({extra})", { n: p.level, extra }) });
  }

  // Sky Pass
  const tiers = addPassXp(save, towerPassXp(run.floors, zen) + finishedNow * MISSION_PASS_XP, now);
  if (tiers) rewards.push({ kind: "pass", text: tn(tiers, "Sky Pass: a new tier reached! Claim your rewards", "Sky Pass: {n} tiers reached! Claim your rewards") });

  // Best towers
  if (!zen && run.floors > 0) {
    save.history.push({ score: run.score, meters: run.meters, floors: run.floors, mode: run.mode, day: dayKey(0, now) });
    save.history.sort((a, b) => b.score - a.score);
    save.history.length = Math.min(save.history.length, HISTORY_SIZE);
  }

  // Unlocks, one line each
  const newSkins = SKINS.filter(s => isSkinUnlocked(save, s) && !skinsBefore.has(s.id));
  if (newSkins.length) rewards.push({ kind: "skin", text: tn(newSkins.length, "New skin unlocked: {names}", "New skins unlocked: {names}", { names: listNames(newSkins.map(s => t(s.name))) }) });
  const built = ISLAND_UPGRADES.slice(islandBefore, islandLevel(save)).map(u => t(u.name));
  if (built.length) rewards.push({ kind: "island", text: tn(built.length, "Island upgrade: {names}", "Island upgrades: {names}", { names: listNames(built) }) });
  const themes = ISLAND_THEMES.filter(th => th.level > levelBefore && th.level <= p.level).map(th => t(th.name));
  if (themes.length) rewards.push({ kind: "island", text: tn(themes.length, "New island theme: {names}", "New island themes: {names}", { names: listNames(themes) }) });

  return {
    rewards,
    newBest,
    levelUp,
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
    towers: save.profile.towers,
    floors: save.profile.floors,
    perfects: save.profile.perfects,
    level: save.profile.level,
    population: save.population,
  };
}

/** Trophies that don't need a tower (gift streaks, collections) can be awarded any time. */
export function awardStandingTrophies(save: SaveData): string[] {
  const ctx = trophyContext(save), won: string[] = [];
  for (const tr of TROPHIES) {
    if (save.profile.trophies.includes(tr.id) || !tr.test(null, ctx)) continue;
    save.profile.trophies.push(tr.id);
    addStars(save, 1);
    won.push(t(tr.name));
  }
  return won;
}

/** The closest goal you just missed: your best, the next landmark, or a mission. */
export function nearMiss(save: SaveData, run: RunSummary, newBest: boolean): string {
  if (!newBest && save.best > 0 && run.score > 0 && save.best - run.score <= Math.max(60, save.best * 0.25)) {
    return t("Only {n} people away from your best!", { n: fmt(save.best - run.score + 1) });
  }
  const next = MILESTONES[landmarkIndex(run.meters) + 1];
  if (next && next.m - run.meters < 30) return t("Just {n} m short of {name}!", { n: next.m - run.meters + 1, name: t(next.name) });
  const close = save.missions.slots.find(m => !m.d && MISSION_TYPES[m.t].game && m.p / m.n >= 0.6 && m.p < m.n);
  if (close) return t("Almost there: {mission} ({p} of {n})", { mission: missionText(close), p: fmt(close.p), n: fmt(close.n) });
  return "";
}

/** A stage's display name: the hand-made ones have their own; the rest are numbered. */
export function stageName(id: string): string {
  const i = CHALLENGES.findIndex(c => c.id === id), c = CHALLENGES[i];
  if (!c) return "";
  return c.text ? t(c.name) : t("Stage {n}", { n: i + 1 });
}

/** Rewards for winning a Journey stage: first-win stars, new map stars, chapter chests. */
export function journeyRewards(save: SaveData, run: RunSummary): Reward[] {
  const out: Reward[] = [];
  const c = challengeById(run.challengeId ?? "");
  if (!c) return out;
  const name = stageName(c.id);
  if (!save.challenges.includes(c.id)) {
    save.challenges.push(c.id);
    addStars(save, c.reward);
    out.push({ kind: "star", text: t("Stage complete: {name} (+{n} ★)", { name, n: c.reward }) });
  }
  const stars = stageStars(true, run.floors, run.perfects), before = save.journey[c.id] ?? 0;
  if (stars > before) {
    save.journey[c.id] = stars;
    // The first map star comes with the first win; each one beyond it pays a star, so
    // three stars on the first try pays the same as working up to them.
    const extra = stars - Math.max(before, 1);
    if (extra > 0) addStars(save, extra);
    out.push({ kind: "star", text: extra > 0
      ? t("{stars} on {name} (+{n} ★)", { stars: "★".repeat(stars) + "☆".repeat(3 - stars), name, n: extra })
      : t("{stars} on {name}", { stars: "★".repeat(stars) + "☆".repeat(3 - stars), name }) });
  }
  // A chest for finishing every stage of a chapter.
  const chapter = Math.floor(CHALLENGES.indexOf(c) / STAGES_PER_CHAPTER), key = `chest${chapter + 1}`;
  const all = CHALLENGES.slice(chapter * STAGES_PER_CHAPTER, (chapter + 1) * STAGES_PER_CHAPTER);
  if (!save.journey[key] && all.length && all.every(x => save.challenges.includes(x.id))) {
    save.journey[key] = 1;
    save.crystals += CHAPTER_CHEST;
    out.push({ kind: "star", text: t("Chapter chest opened! +{n} 💎", { n: CHAPTER_CHEST }) });
  }
  return out;
}

/** Total map stars earned on the Journey. */
export const journeyStars = (save: SaveData): number =>
  CHALLENGES.reduce((n, c) => n + (save.journey[c.id] ?? 0), 0);

/** What a stage asks of you, in words. */
export function stageGoal(c: Challenge): string {
  if (c.text) return t(c.text);
  return c.goal.type === "height" ? t("Build taller than {n} m", { n: c.goal.n })
    : c.goal.type === "streak" ? t("Land {n} perfect drops in a row", { n: c.goal.n }) : t("Land {n} gold penthouses perfectly", { n: c.goal.n });
}

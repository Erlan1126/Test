// The pacing simulator: a reasonably active player, driven through the real economy
// (src/logic), from a new save until the City Hall's last level. It prints a timeline,
// minute by minute, of what opened, unlocked or was finished, so a change to the chapters
// or the prices can be checked against the pacing targets (tests/pacing.test.ts).
//
//   npx vite-node scripts/pacing-sim.ts [days=14] [dt=1]   (this file is the model it runs)
//
// The player: plays the first three hours straight, then a 15-minute session every two
// hours through the day (eight a day from day two on) and sleeps ten hours a night, so the
// 4-hour offline cap matters. While playing they tap businesses that have no manager yet,
// buy upgrades and managers as soon as they can, follow the City Hall goals (saving up for
// a goal's purchase when it's a few minutes away), build headquarters and homes, place
// decorations, buy districts and catch the golden customers that come by. Everything else
// goes into the business level with the best return. No crystals, rush hours, daily
// rewards, VIP tips or daily quests: those only make things faster.
import { CHAPTERS, chapterIndex, chapterReady, claimChapter, goalDone, goalName, type ChapterGoal } from "../src/data/chapters";
import { defaultSave, type SaveData } from "../src/logic/save";
import { BUSINESSES, UPGRADES, coins, STAGE_NAMES } from "../src/data/tycoon";
import { LAND } from "../src/data/land";
import { PLACE_ITEMS, buyPlace, lotFree } from "../src/logic/placedecor";
import { buildOf, buildPrice, completeBuilds, freeBuilders, hqPrice, startBuild, type BuildKind } from "../src/logic/builds";
import { isLot, propBlock, propLevel, propPrice } from "../src/logic/props";
import { landOnSale } from "../src/logic/land";
import { claimTerrace, projectsOpen } from "../src/logic/cafe";
import { PROP_TIERS } from "../src/data/props";
import { eraNudge } from "../src/logic/eranudge";
import { townHomes, newEra, payStars, buyLevels, buyUpgrade, costOf, cycleOf, goldenArrives, goldenTip, hallLevel, hireManager, levelOf, perSecond, readyStage, runOnce, startOpening, tick, unlockedBusiness, upgradesOnOffer, usedFloors } from "../src/logic/tycoon";

export interface PaceEvent {
  /** Minutes since the very first launch. */
  min: number;
  /** "hall", "open", "hq", "land", "decor", "upgrade", "home", "manager", "teaser". */
  kind: string;
  text: string;
}
export interface PaceResult {
  events: PaceEvent[];
  /** Minute each City Hall level was reached (index = level; 1 is 0). */
  hall: number[];
  save: SaveData;
}

const DAY = 1440;
/** Pays a chapter and moves on, met or not (calibration runs). */
function claimChapterForced(s: SaveData): void {
  const c = CHAPTERS[chapterIndex(s)];
  if (!c) return;
  s.chapters.done++;
  payStars(s, c.reward.stars);
  s.crystals += c.reward.crystals;
}
/** Play sessions [start, end] in minutes: three hours straight on day one, then 15 minutes
 *  every two hours until 14 h into the day, ten hours' sleep each night. */
export function sessions(days: number): [number, number][] {
  const out: [number, number][] = [[0, 180]];
  for (let m = 240; m <= 840; m += 120) out.push([m, m + 15]);
  for (let d = 1; d < days; d++) for (let k = 0; k < 8; k++) out.push([d * DAY + k * 120, d * DAY + k * 120 + 15]);
  return out;
}

/** Home keys: the neighbourhood's homes (start at level 1; the town has more of them as the
 *  businesses grow, as in the game) and the city's lots (start empty). */
const LOTS = Array.from({ length: 30 }, (_, i) => `g:${i % 6},${Math.floor(i / 6)}`);
const homeKeys = (s: SaveData): string[] => [...Array.from({ length: Math.min(80, townHomes(s)) }, (_, i) => `t:${i},0`), ...LOTS];
/** Lots kept for decorations (never built on). */
const DECOR_LOTS = Array.from({ length: 12 }, (_, i) => `g:9,${i}`);

/** `hallAt` (calibration only): move the City Hall up at these minutes whatever its goals
 *  (index = level), with the chapter's reward. `snap`: called every `snapEvery` minutes. */
export function simulate(opts: { days?: number; dt?: number; quiet?: boolean; hallAt?: number[]; snap?: (s: SaveData, min: number, now: number) => void; snapEvery?: number } = {}): PaceResult {
  const days = opts.days ?? 14, dt = Math.max(1, opts.dt ?? 1);
  const s = defaultSave();
  const t0 = 1_800_000_000_000;
  let now = t0;
  s.tycoon.last = now;
  startOpening(s, now);
  const events: PaceEvent[] = [];
  const hall: number[] = [0, 0];
  const min = () => (now - t0) / 60e3;
  const log = (kind: string, text: string) => events.push({ min: min(), kind, text });
  const seenTier = new Set<number>([0, 1]);
  let saleSeen = "";
  // Golden customers come a few minutes into a session, then every 15-30 minutes (22.5 here).
  let nextGolden = 0;

  const ownedHomes = () => homeKeys(s).filter(k => !buildOf(s, "home", k));
  const lotsBuilding = () => (s.tycoon.builds ?? []).filter(b => b.kind === "home" && isLot(b.id) && propLevel(s, b.id) === 0).length;
  const cheapestHome = () => ownedHomes().map(k => ({ k, p: propPrice(s, k, now) })).filter(h => !propBlock(s, h.k, isLot(h.k) && propLevel(s, h.k) === 0 ? lotsBuilding() : 0)).sort((a, b) => a.p - b.p)[0];
  const nextDecor = () => PLACE_ITEMS.filter(it => !it.won && !(it.id in s.placed) && hallLevel(s) >= it.hall).sort((a, b) => a.cash - b.cash)[0];
  const freeLot = () => DECOR_LOTS.find(l => lotFree(s, l));
  const nextOpen = (land?: string) => BUSINESSES.findIndex((b, i) => levelOf(s, b.id) === 0 && unlockedBusiness(s, i) && (land === undefined || b.land === land));

  /** A purchase the player wants: its price and how to make it. */
  type Want = { price: number; go: () => boolean; label: string };
  const build = (kind: BuildKind, id: string, label: string): Want | null => {
    // (Only with a builder free: nobody saves up for a build that would have to wait anyway.)
    if (buildOf(s, kind, id) || freeBuilders(s, now) < 1) return null;
    return { price: buildPrice(s, kind, id, now), label, go: () => startBuild(s, kind, id, now) === "ok" };
  };
  const openWant = (i: number): Want | null => (i < 0 ? null : { price: costOf(BUSINESSES[i], 0, 1), label: `open ${BUSINESSES[i].id}`, go: () => buyLevels(s, BUSINESSES[i].id, 1, now) > 0 });
  const hqWant = (id?: string): Want | null => {
    // (Without a goal's own business: the cheapest one ready to grow.)
    const b = id ? BUSINESSES.find(x => x.id === id && readyStage(s, x.id)) : BUSINESSES.filter(x => readyStage(s, x.id) && !buildOf(s, "hq", x.id)).sort((x, y) => hqPrice(s, x.id) - hqPrice(s, y.id))[0];
    return b ? build("hq", b.id, `hq ${b.id}`) : null;
  };
  const homeWant = (): Want | null => { const h = cheapestHome(); return h ? build("home", h.k, "home") : null; };
  const upgradeWant = (): Want | null => {
    const u = upgradesOnOffer(s).sort((a, b) => a.cost - b.cost)[0];
    return u ? { price: u.cost, label: `upgrade ${u.id}`, go: () => buyUpgrade(s, u.id) } : null;
  };
  const decorWant = (): Want | null => {
    const it = nextDecor(), lot = freeLot();
    return it && lot ? { price: it.cash, label: `decor ${it.id}`, go: () => buyPlace(s, it.id, lot) === "ok" } : null;
  };
  const landWant = (): Want | null => { const l = landOnSale(s); return l ? build("land", l.id, `land ${l.id}`) : null; };

  /** What the chapter's unfinished goals ask the player to buy. */
  const goalWants = (): Want[] => {
    const c = CHAPTERS[chapterIndex(s)];
    if (!c) return [];
    const out: (Want | null)[] = [];
    for (const g of c.goals as ChapterGoal[]) {
      if (goalDone(s, g)) continue;
      switch (g.kind) {
        case "projects": if (projectsOpen(s.cafe)) out.push(...(["flowers", "play"] as const).filter(p => !s.cafe.done.includes(p)).map(p => build("project", p, `project ${p}`))); break;
        case "grown": out.push(hqWant()); break;
        case "builds": out.push(hqWant() ?? homeWant()); break;
        case "land": out.push(landWant()); break;
        case "landOpen": out.push(openWant(nextOpen(g.land))); break;
        case "open": out.push(openWant(nextOpen())); break;
        default: {
          // (Goal kinds added later: the sim knows them by name.)
          const k = g.kind as string;
          if (k === "biz" && g.biz) out.push(openWant(BUSINESSES.findIndex((b, i) => b.id === g.biz && unlockedBusiness(s, i))));
          else if (k === "hq") out.push(hqWant(g.biz));
          else if (k === "homes") out.push(homeWant());
          else if (k === "decor") out.push(decorWant());
        }
      }
    }
    return out.filter((w): w is Want => !!w && Number.isFinite(w.price));
  };

  /** How long a goal's purchase is worth saving for (seconds of earnings): hours for a district
   *  (the Next step card says so), an hour for a business, a few minutes for the rest. */
  const horizon = (w: Want) => (w.label.startsWith("land ") ? 8 * 3600 : w.label.startsWith("open ") ? 3600 : 480);
  // Income estimate (managed plus by hand), for "is it worth saving for".
  let rate = 0, lastLife = 0, lastAt = now;

  const shop = () => {
    for (const j of completeBuilds(s, now)) {
      if (j.kind === "hq") log("hq", `${STAGE_NAMES[j.id][s.tycoon.evolved[j.id] ?? 0]} HQ built`);
      else if (j.kind === "land") log("land", `${LAND.find(l => l.id === j.id)?.name} bought`);
      else if (j.kind === "project") log("build", `${j.id === "play" ? "Playground" : "Flower market"} built`);
      else if (j.kind === "terrace") log("build", "café terrace built");
    }
    if (s.cafe.terrace === 1) claimTerrace(s.cafe);
    for (const k of homeKeys(s)) { const l = propLevel(s, k); if (!seenTier.has(l)) { seenTier.add(l); log("home", `first ${PROP_TIERS[l]} (home tier ${l})`); } }
    while (opts.hallAt && opts.hallAt[hallLevel(s) + 1] !== undefined && min() >= opts.hallAt[hallLevel(s) + 1]) {
      const c = CHAPTERS[chapterIndex(s)];
      s.tycoon.coins += 0; claimChapterForced(s); hall[hallLevel(s)] = min(); log("hall", `City Hall ${hallLevel(s)} (forced; ${c?.title})`);
    }
    while (!opts.hallAt && chapterReady(s)) {
      const c = CHAPTERS[chapterIndex(s)];
      claimChapter(s);
      hall[hallLevel(s)] = min();
      log("hall", `City Hall ${hallLevel(s)} at ${coins(perSecond(s, now, false))}/s (${c.title}: ${c.goals.map(g => g.text.replace("{n}", String(g.cash ? coins(g.need) : g.need)).replace("{lv}", String(g.lv ?? "")).replace("{name}", goalName(g))).join(" / ")})`);
    }
    const sale = landOnSale(s);
    if (sale && sale.id !== saleSeen) { saleSeen = sale.id; log("teaser", `${sale.name} on sale`); }
    if (s.cafe.terrace === 0 && !buildOf(s, "terrace", "") && s.tycoon.coins >= 15) startBuild(s, "terrace", "", now);
    for (let guard = 0; guard < 200; guard++) {
      // (While saving up for a goal, only small change goes on upgrades and managers.)
      const spare = () => { const g = goalWants().filter(w => w.price > s.tycoon.coins && w.price - s.tycoon.coins <= rate * horizon(w)).sort((x, y) => x.price - y.price)[0]; return g ? 0.05 * g.price : s.tycoon.coins; };
      for (const u of upgradesOnOffer(s)) if (u.cost <= Math.min(s.tycoon.coins, spare()) && buyUpgrade(s, u.id)) log("upgrade", `${u.name} (${u.biz})`);
      const m = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && s.tycoon.coins >= b.manager && b.manager <= spare());
      if (m) { hireManager(s, m.id, now); if (s.tycoon.tips < 3) s.tycoon.tips = 3; log("manager", `manager for ${m.name}`); continue; }
      // The chapter's goals first, then the things a player does anyway (a ready HQ, cheap homes,
      // a district on sale, the next decoration once it's cheap).
      // Each with how long it's worth saving for (seconds of earnings). (A home waits while a
      // business is ready to grow: the builder is for the headquarters first.)
      // A district the story asks for is worth hours of saving (the Next step card says so), and
      // while saving for a goal nothing else takes the cash or the builder.
      const hqReady = BUSINESSES.some(b => readyStage(s, b.id) && !buildOf(s, "hq", b.id));
      const goals = goalWants().sort((a, b) => a.price - b.price).map((w): [Want, number] => [w, horizon(w)]);
      const saving = goals.some(([w, wait]) => w.price > s.tycoon.coins && w.price - s.tycoon.coins <= rate * wait);
      const wants: [Want, number][] = [
        ...goals,
        ...(saving ? [] : ([[hqWant(), 180], [openWant(nextOpen()), 600], [landWant(), 300], [hqReady ? null : homeWant(), 60], [decorWant(), 600], [upgradeWant(), 300]] as [Want | null, number][]).filter((x): x is [Want, number] => !!x[0])),
      ];
      let did = false;
      for (const [w] of wants) {
        if (w.price > s.tycoon.coins) continue;
        const name = w.label;
        if (w.go()) {
          did = true;
          if (name.startsWith("open ")) log("open", `${BUSINESSES.find(b => b.id === name.slice(5))?.name} opened`);
          else if (name.startsWith("upgrade ")) { const u = UPGRADES.find(x => x.id === name.slice(8)); log("upgrade", `${u?.name} (${u?.biz})`); }
          else if (name.startsWith("decor ")) log("decor", `${PLACE_ITEMS.find(p => p.id === name.slice(6))?.name} placed`);
          break;
        }
      }
      if (did) continue;
      // Saving up: something wanted that's only a few minutes of earning away waits for the cash.
      if (wants.some(([w, wait]) => w.price > s.tycoon.coins && w.price - s.tycoon.coins <= rate * wait)) break;
      let best = -1, score = 0;
      for (const [i, b] of BUSINESSES.entries()) {
        const lv = levelOf(s, b.id), c = costOf(b, lv, 1);
        if (c > s.tycoon.coins || !unlockedBusiness(s, i)) continue;
        const r = (l: number) => (b.income * l) / cycleOf(b, l);
        const gain = lv === 0 ? 1e9 : (r(lv + 1) - r(lv)) / c;
        if (gain > score) { score = gain; best = i; }
      }
      if (best < 0) break;
      const b = BUSINESSES[best];
      if (levelOf(s, b.id) === 0) log("open", `${b.name} opened`);
      buyLevels(s, b.id, 1, now);
    }
  };

  for (const [a, z] of sessions(days)) {
    // Away until the session starts (managers earn, up to the offline cap).
    now = t0 + a * 60e3;
    tick(s, now);
    nextGolden = now + 225e3;
    // The New Era nudge (after about a day with nothing new): taken when it at least doubles
    // what everything earns.
    const nudge = eraNudge(s, now);
    if (nudge && nudge.after >= 2 * nudge.before) { const g = newEra(s, now); saleSeen = ""; log("era", `New Era ${s.tycoon.eras}: +${g} Sky Gems (×${(nudge.after / nudge.before).toFixed(1)} earnings)`); }
    lastLife = s.tycoon.lifetime; lastAt = now;
    for (let sec = 0; sec < (z - a) * 60; sec += dt) {
      now += dt * 1000;
      // A player taps about one idle business a second.
      const idle = BUSINESSES.filter(b => levelOf(s, b.id) > 0 && !s.tycoon.managers.includes(b.id) && !s.tycoon.runs[b.id]);
      for (let k = 0; k < Math.min(dt, idle.length); k++) runOnce(s, idle[(sec + k) % idle.length].id, now);
      tick(s, now);
      if (now >= nextGolden) {
        nextGolden = now + 1350e3;
        if (BUSINESSES.some(b => levelOf(s, b.id) > 0) && goldenArrives(s, now)) goldenTip(s, now);
      }
      if (now - lastAt >= 60e3) { rate = (s.tycoon.lifetime - lastLife) / ((now - lastAt) / 1000); lastLife = s.tycoon.lifetime; lastAt = now; }
      if (sec % Math.max(3, dt) < dt) shop();
      if (opts.snap && Math.floor(min() / (opts.snapEvery ?? 30)) !== Math.floor((min() - dt / 60) / (opts.snapEvery ?? 30))) opts.snap(s, min(), now);
    }
    if (!opts.quiet && a % DAY === 0) console.log(`[day ${Math.floor(a / DAY) + 1}] ${coins(perSecond(s, now, false))}/s · ${usedFloors(s)} levels · Hall ${hallLevel(s)} · ${BUSINESSES.filter(b => levelOf(s, b.id) > 0).length} businesses`);
  }
  return { events, hall, save: s };
}

/** "95m" or "1d 3h 20m". */
export const fmtMin = (m0: number): string => {
  const m = Math.round(m0), d = Math.floor(m / DAY), h = Math.floor((m % DAY) / 60), mm = Math.round(m % 60);
  return d ? `${d}d ${h}h ${String(mm).padStart(2, "0")}m` : h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
};

/** Minutes of play before a moment (time asleep or away doesn't feel long; something that
 *  happened while away is seen at the start of the next session). */
export function playedBy(m: number, days = Math.ceil(m / DAY) + 1): number {
  let n = 0;
  for (const [a, z] of sessions(days)) { if (m <= a) break; n += Math.min(m, z) - a; }
  return n;
}

/** The longest wait between two new things (a business, a City Hall level, an HQ, a district,
 *  a decoration, an upgrade, a home tier: not a manager) in minutes of play, between two
 *  moments. `at`: when that wait began. */
export function longestGap(events: PaceEvent[], from: number, to: number): { gap: number; at: number } {
  const marks = [from, ...events.filter(e => e.kind !== "manager" && e.min >= from && e.min <= to).map(e => e.min), to].sort((a, b) => a - b);
  let gap = 0, at = from;
  for (let i = 1; i < marks.length; i++) { const g = playedBy(marks[i]) - playedBy(marks[i - 1]); if (g > gap) { gap = g; at = marks[i - 1]; } }
  return { gap, at };
}

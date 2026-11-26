// The Tycoon screens: the business list (tap to run, buy levels, hire managers), boosts,
// the New Era, the live card on the home screen and the "while you were away" welcome.
import { CHAPTERS, chapterIndex, chapterReady, goalDone } from "../data/chapters";
import { decorMult } from "../logic/decor";
import { DECOR_BONUS, decorById } from "../data/decor";
import { RANK_BONUS, RANKS } from "../data/ranks";
import { cafeMult } from "../logic/cafe";
import { vipActive } from "../logic/vip";
import { GEM_BONUS } from "../data/tycoon";
import { bizThumb } from "../render3d/thumbs";
import { houseThumb } from "../render3d/housethumbs";
import { checkCityTrophies, CITY_TROPHIES } from "../logic/cityach";
import { claimTeam, TEAM_STEPS, teamHomes, teamTotal, teamWeek } from "../logic/team";
import { checkMilestone, nextMilestone as nextPeopleMs, PEOPLE_MILESTONES } from "../logic/milestones";
import { gameCenterCity } from "../gamecenter";
import { eraNudge, snoozeEraNudge } from "../logic/eranudge";
import { pickTalk } from "../data/talk";
import { earn } from "../logic/tycoon";
import { WeatherMoments } from "./weathermoments";
import { citySeason, isRushHour, isWeekendNight, seasonDaysLeft, seasonInfo } from "../data/season";
import { buySeasonPass, claimSP, SEASON_PAINT, seasonPass, seasonPoints, SP_FREE, SP_PREMIUM, SP_PRICE, SP_TIERS, spReady, spReward, spTier, type SPReward } from "../logic/seasonpass";
import { bizColors, PAINTS, paintById, ownsPaint, setPaint } from "../logic/paint";
import { buyPlace, lotFree, movePlace, PLACE_ITEMS, placeItem, placedOn, storePlace } from "../logic/placedecor";
import { addDesigns, bookCount, bookReady, BOOK_CRYSTALS, BOOK_SIZE, claimBook, DESIGN_LEVELS, DESIGNS_PER_LEVEL, hasDesign, LEVEL_NAMES, levelCount, ROW_CRYSTALS } from "../logic/collection";
import { ADVISORS, BOOM_MULT, CRATE_CRYSTALS, FESTIVAL_MULT, UPGRADES, VAULT_HOURS, type Advisor, BUSINESSES, coins, RUSH_MULT, STAGE_AT, STAGE_LABEL, COIN_BOOST_CRYSTALS, SPEEDUPS_PER_DAY } from "../data/tycoon";
import { getLang, t, tn } from "../i18n";
import { orderFor, ORDER_MULT } from "../logic/orders";
import { claimSpire, spireReady, SPIRE_GOALS, type SpireNow } from "../logic/spire";
import { orderText } from "./orders";
import { fmt } from "../core/util";
import type { SaveData } from "../logic/save";
import {
  affordable, buyBoost, buyLevels, officePrice, OFFICE_BLOCK_FLOORS, costOf, cycleOf, eraGems, freeFloors, hireManager, levelOf, multiplier, newEra, nextMilestone, officeFloors, usedFloors, townRank,
  payOf, perSecond, progressOf, goldenArrives, goldenTip, GOLDEN_SECONDS, startOpening, OPENING_MULT, OPENING_MINUTES, runOnce, rushOn, speedupsLeft, dealGoals, goalStep, offlineHours, GOAL_STARS, GOAL_TIERS, GOALS_BONUS_CRYSTALS, type GoalType, warpPrice, WELCOME_WARP_CRYSTALS, doublePrice, doubleAway, stageName, stageNow, readyStage, hqFloors, startRush, upgradesOnOffer, buyUpgrade, hireAdvisor, vaultCost, buyVault, festivalBiz, vipRate, review, tick, timeWarp, warpGain, unlockedBusiness, shownBusiness, prevBusiness, vipTip, cityGrow, adDoubleAway, payStars, starCash,
  bizMult, workerBonus, reactionTip, rankHall, hallLevel, hallLocked, hallNeed, hallOpens, FLOOR_LIMIT,
} from "../logic/tycoon";
import { MILESTONES_AT } from "../data/tycoon";
import type { Sound } from "../sound";
import { $, closeModal, displayName, esc, LOCK_ICON, openModal, openModalEl, toast, vibrate, wireModal } from "./dom";
import { burst, confetti, fireworks } from "./fx";
import { iconSvg } from "./icons";
import { cleanCityName } from "../logic/save";
import { askCash, askDone, askProgress, collectAsk, newAsk, saveGoal, secondsTo, skipPrice, skipWait } from "../logic/asks";
import { track } from "../stats";
import { adsReady, showRewarded } from "../ads";
import { ALBUM_CRYSTALS, ALBUM_DONE_CRYSTALS, ALBUM_KINDS, sightInfo, SIGHT_PEOPLE } from "../data/sights";
import { HAS_CITY, playerStarted } from "../edition";
import { buyEventPass, cityEvent, cityEventEndsAt, claimEventStep, eventPoints, eventPrize, eventReady, eventTheme, EVENT_PASS_CRYSTALS, EVENT_POINTS, EVENT_STEPS, type EventAction } from "../logic/cityevent";
import { buildOf, buildPrice, builderCount, BUILDER_PRICES, busyBuilders, completeBuilds, finishNow, finishPrice, hireBuilder, hqPrice, MAX_HIRED, startBuild, TERRACE_PRICE, buildTime, type BuildJob, type BuildKind } from "../logic/builds";
import { claimTerrace, FLOWER_WIDE, PLAY_FLOORS, projectsOpen, seatingNeed, WIDE_SHARE, type ProjectId } from "../logic/cafe";
import type { BizBlock } from "../render3d/block";
import { titleFor } from "../data/titles";
import { xpNeeded } from "../logic/rules";
import { missionText } from "../data/missions";
import { cityBanner, MAYOR_SVG, mayorAsk, mayorChoice, mayorList, mayorNote, mayorSvg, neighbourNote, setGoalTap } from "./mayor";
import { formatRecoveryCode, type TeamMate } from "../online";
import { annexBuilt, annexOpen, annexPrice, buildAnnex, type AnnexPick } from "../logic/annex";
import { landOnSale, landPrice, landWaiting, landHall } from "../logic/land";
import { townPeople, isLot, lotsAllowed, lotsBuilt, propBlock, propHallNeed, propLevel, propPrice, propRent, propsOpen } from "../logic/props";
import { PROP_BONUS, PROP_MAX, PROP_PEOPLE, PROP_TIERS } from "../data/props";
import { LAND, LAND_BONUS } from "../data/land";
import { ANNEX_BONUS, ANNEX_RANK } from "../data/ranks";
import { PAGE_INTRO, PAGE_INTRO_CITY } from "../data/guide";
import { loadMemories, saveMemory, thenNowCard } from "./memories";
import { PhotoMode } from "./photo";
import { nextSpinIn, SpinWheel } from "./spin";
import { spinAdLeft, spinFree, spinOpen } from "../logic/spin";

export interface TycoonHost {
  readonly save: SaveData;
  /** The cloud backup's recovery code: null when there's no server, "" until it's made. */
  cloudCode(): string | null;
  readonly sound: Sound;
  persist(): void;
  refresh(): void;
  openCrystalShop(): void;
  /** Plans the phone's reminders again (a build started or finished). */
  reschedule(): void;
  openShop(tab: "town" | "towers" | "crystals" | "boosts"): void;
  openStarter(): void;
  /** Starts a tower (to build more office floors). */
  buildFloors(): void;
  /** Starts a tower that's a business's new headquarters. */
  buildHQ(id: string): void;
  /** Starts a tower in a mode. */
  play(mode: "classic" | "daily" | "zen"): void;
  /** The home screen is showing (not a tower). */
  onMenu(): boolean;
  /** The 3D business district can be shown (the 3D renderer is on). */
  canCity(): boolean;
  /** Flies the camera over the business district (or back). */
  setBizFocus(on: boolean): void;
  /** Opens Mayor Pip's story (the City Hall). */
  openStory(): void;
  /** Where a lot's building is on screen (i = -1: the player's first tower). */
  bizScreen(i: number, height: number): { base: [number, number]; top: [number, number] } | null;
  bizHomes(): string[];
  bizSights(): { kind: string; key: string }[];
  /** Set when the results card sent the player here, to see their tower or the café. */
  townDest: "" | "tower" | "terrace" | "cafe" | "project";
  /** Starts a café-contract tower (the flower market now). */
  playContract(): void;
  /** Starts a tower for a neighborhood project. */
  playProject(p: ProjectId): void;
  /** Where the café block's neighbor stands on screen, or null. */
  bizResident(): [number, number] | null;
  visitLandmark(rank: number, ms: number): boolean;
  townPicture(): string | null;
  sharePicture(blob: Blob, text: string, name?: string): Promise<void>;
  /** The town as it looks right now, full size (for photo mode). */
  townShot(): HTMLCanvasElement | null;
  /** Which walker in the street is talking (their bubble follows them). */
  bizTalk(k: number): void;
  /** The weather over the town now. */
  weatherNow(): string;
  /** The building designs standing in the town now ("level:design"). */
  bizDesigns(): string[];
  bizPan(dx: number, dy: number): void;
  bizZoom(f: number): void;
  bizPanEnd(): void;
  bizHold(): void;
  /** This week's Community Spire (asks the server; null when it can't be reached). */
  fetchSpire(): Promise<SpireNow | null>;
  /** Buildaroo: friends' homes this week, for the friend team (undefined offline). */
  fetchTeam(): Promise<TeamMate[] | undefined>;
  /** Buildaroo: shares an invite link. */
  inviteFriend(): Promise<void>;
}

/** A gold coin with a star, for counters. */
/** Skyhaven Inc.'s cash: a green banknote. */
/** Time left, short: "45s", "3m 20s", "2h 05m". */
export function fmtLeft(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  if (h < 1) return `${m}m ${String(sec % 60).padStart(2, "0")}s`;
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

export const COIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="7" width="21" height="13" rx="2.5" fill="#1f8a4c" transform="rotate(-8 12 13.5)"/><rect x="1.5" y="5" width="21" height="13" rx="2.5" fill="url(#cg)" stroke="#167a42" stroke-width="1.1"/><rect x="4" y="7.5" width="16" height="8" rx="1.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.9"/><circle cx="12" cy="11.5" r="3.3" fill="#e9ffe9"/><text x="12" y="13.7" text-anchor="middle" font-size="6" font-weight="900" font-family="Arial,sans-serif" fill="#167a42">$</text></svg>`;

/** The building's picture at a stage (3D, the same model as in the town). */
/** What the first neighbor says when the town reaches each rank (Village first). */
/** The header title of each tab page: the same word as its button in the tab bar. */
const TAB_TITLE: Record<string, string> = { shop: "Shop", company: "Company", goals: "Goals", me: "Me" };
const NEIGHBOR_LINES = [
  "A market on our street! Fresh flowers for my table every day 🌷",
  "A tram! Now I can visit my sister across the island 🚋",
  "Look at those lights! Our little street is famous now ✨",
  "Airships! I waved at one this morning and it waved back 🎈",
  "Towers on the floating islands... I remember when this was a meadow.",
  "The capital of the sky. And it all started with one little coffee cart. Thank you! 💛",
];
/** What the neighbor says on an ordinary day. */
const DAILY_HELLO = [
  "Good to see you! The coffee's still warm ☕",
  "The town feels busier every day. I like it!",
  "I saved you a seat on the terrace 🌷",
  "Morning! The tram was full today: everybody wants to see our town.",
  "One more home and we'll have new neighbors!",
];
const thumbFor = (b: (typeof BUSINESSES)[number], stage: number): string => bizThumb(b.id, stage, b.color[0], b.color[1]);
/** A multiplier, short: 1.2, 3, 12.5, 1.2K. */
const fmtMult = (m: number): string => (m >= 1000 ? fmt(m) : m >= 10 ? String(Math.round(m * 10) / 10) : String(Math.round(m * 100) / 100));

/** The "→" letter drawn as an arrow (the display font has no good one). Takes escaped HTML. */
const arrows = (html: string): string => html.replace(/→/g, '<i class="arr" aria-hidden="true"></i>');

export class TycoonUI {
  private amount: number | "max" = 1;
  private tab = "company";
  private loop = 0;
  private lastTick = 0;
  private lastSave = 0;
  private lastSoft = 0;
  /** The coin counter rolls toward the real number instead of jumping. */
  private shownCoins = -1;
  private lastP = new Map<string, number>();
  private lastPop = new Map<string, number>();
  /** The building that last sold or grew, which bounces in the 3D street. */
  private pulse = { id: "", at: 0 };
  /** Each section's last HTML: a section is only rebuilt when it really changes, so
   *  animations keep running and a tap never lands on a button that just got replaced. */
  private html = new Map<HTMLElement, string>();
  /** A VIP customer waiting in a room to be tapped, and when the next ones come. */
  private vip = { id: "", until: 0 };
  /** A golden customer: rare, sparkling, and gone in a minute. */
  private golden = { id: "", until: 0 };
  /** The property whose card is open (data/props.ts), by key. */
  private selectedProp = "";
  /** A tapped sight (a city block, park, landmark): its key and what it is. */
  private selectedSight = "";
  private sightKind = "";
  /** When the player last tapped in town (big moments wait until they're not busy). */
  private lastTapAt = 0;
  private labelsDirty = false;
  /** The first visit's close look at the starter tower runs until this time. */
  private frameUntil = 0;
  private openingWas = false;
  private nextGolden = 0;
  private nextVip = 0;
  private nextRush = 0;
  private rushWas = "";
  private vipFresh = false;
  /** A food critic waiting to be served, and a power cut waiting to be fixed. */
  private critic = { id: "", until: 0 };
  private power = { id: "", until: 0, taps: 0 };
  private nextCritic = 0;
  private nextPower = 0;
  private eraArmed = false;

  constructor(private readonly host: TycoonHost) {
    $("block-skip").addEventListener("click", () => { this.host.sound.click(); this.skipArrival(); });
    // "Why?": a greyed-out button can't be pressed, so a tap on it falls through to its row;
    // find which button was under the finger and say what it needs.
    document.addEventListener("click", e => {
      const row = (e.target as Element | null)?.closest?.<HTMLElement>(".ty-biz, #tcy-card");
      if (!row) return;
      for (const btn of row.querySelectorAll<HTMLButtonElement>("button[data-act]:disabled, button[data-card]:disabled")) {
        const r = btn.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          const why = this.whyLocked(row.dataset.biz ?? this.selected, btn.dataset.act ?? btn.dataset.card ?? "");
          if (why) { this.host.sound.click(); toast(why); }
          return;
        }
      }
    });
    wireModal($("tycoon"));
    // The coin's gold gradient, defined once where it's always drawable (a gradient inside
    // a hidden element can't be used by the coins elsewhere on the page).
    document.body.insertAdjacentHTML("afterbegin", `<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9df5b8"/><stop offset="0.55" stop-color="#3fcf7a"/><stop offset="1" stop-color="#1f9a55"/></linearGradient></defs></svg>`);
    document.querySelectorAll<HTMLElement>(".tc-coin").forEach(el => { el.innerHTML = COIN_SVG; });
    $("tycoon-card").addEventListener("click", () => this.open());
    $("tycoon-btn").addEventListener("click", () => this.open());
    $("tycoon").querySelectorAll<HTMLButtonElement>(".ty-amount button").forEach(b => b.addEventListener("click", () => {
      this.amount = b.dataset.n === "max" ? "max" : Number(b.dataset.n);
      $("tycoon").querySelectorAll(".ty-amount button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      this.host.sound.click();
      this.render();
    }));
    $("tycoon").querySelectorAll<HTMLButtonElement>(".ty-tabs button").forEach(b => b.addEventListener("click", () => {
      this.host.sound.click();
      this.showTab(b.dataset.tab!);
    }));
    $("ty-build").addEventListener("click", () => { closeModal($("tycoon")); this.openBuild(); });
    this.wireTownCamera();
    $("tycity").addEventListener("click", e => this.onCityTap(e));
    $("tcy-card").addEventListener("click", e => this.onCardTap(e));
    wireModal($("land-buy"));
    $("land-buy-btn").addEventListener("click", () => this.buyLandNow());
    $("tcy-events").addEventListener("click", e => { if ((e.target as Element).closest("[data-golden]")) { e.stopPropagation(); this.catchGolden(); } });
    $("tcy-next").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); this.nextAct?.(); });
    // Hold a Buy button to keep buying (faster the longer you hold), as in the big idle games.
    let holdT = 0, holdN = 0, held: HTMLElement | null = null;
    const stopHold = () => { clearTimeout(holdT); holdT = 0; holdN = 0; if (this.holdingCard) { this.holdingCard = false; this.render(); } };
    // After a hold, the release's own click must not buy one more.
    document.addEventListener("click", e => { if (held && e.isTrusted && held.contains(e.target as Node)) { e.stopPropagation(); e.preventDefault(); } held = null; }, true);
    document.addEventListener("contextmenu", e => { if ((e.target as Element).closest?.(".ty-buy")) e.preventDefault(); });
    document.addEventListener("pointerdown", e => {
      held = null;
      const btn = (e.target as Element).closest<HTMLButtonElement>('.ty-buy:not(.need-floors), #tcy-card .card-main[data-card="buy"]');
      if (!btn || btn.disabled) return;
      stopHold();
      const step = () => {
        if (!btn.isConnected || btn.disabled) { stopHold(); return; }
        held = btn;
        // (The town card stays put while it's held, so the same button keeps buying.)
        if (btn.closest("#tcy-card")) this.holdingCard = true;
        btn.click();
        holdN++;
        holdT = window.setTimeout(step, Math.max(60, 180 - holdN * 12));
      };
      holdT = window.setTimeout(step, 420);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave", "blur"]) document.addEventListener(ev, stopHold, true);
    // Tapping your money opens what you earn, exactly.
    $("era-nudge").addEventListener("click", e => {
      const b = (e.target as Element).closest<HTMLElement>("[data-en]");
      if (!b) return;
      this.host.sound.click();
      $("era-nudge").hidden = true;
      if (b.dataset.en === "go") { track("era_nudge_open", {}, false); this.openSheet("boosts"); }
      else { snoozeEraNudge(this.save); this.host.persist(); }
    });
    this.photo = new PhotoMode(this.host, () => { this.closeTabs(); this.selected = ""; this.selectedProp = ""; this.selectedSight = ""; this.render(); });
    $("photo-go").addEventListener("click", () => { this.host.sound.click(); this.photoMode(); });
    document.getElementById("city-rename")?.addEventListener("click", () => { this.host.sound.click(); closeModal($("settings")); this.nameCity(); });
    this.syncCityNameRow();
    // Tapping one of Pip's goals goes straight to where it's done.
    setGoalTap(kind => {
      const s = this.save;
      if (kind === "managers" || kind === "levels") {
        // The business that most needs it (no manager yet / the cheapest level), selected in town.
        const b = kind === "managers" ? BUSINESSES.find(x => levelOf(s, x.id) > 0 && !s.tycoon.managers.includes(x.id)) : BUSINESSES.filter(x => levelOf(s, x.id) > 0).sort((a, b2) => costOf(a, levelOf(s, a.id), 1) - costOf(b2, levelOf(s, b2.id), 1))[0];
        if (b) { this.selected = b.id; this.selectedProp = ""; this.selectedSight = ""; this.render(); return; }
      }
      if (kind === "grown") { const b = BUSINESSES.find(x => readyStage(s, x.id)); if (b) { this.selected = b.id; this.selectedProp = ""; this.selectedSight = ""; this.render(); return; } }
      this.openBuild();
    });
    const wallet = $("tcy-top").querySelector<HTMLElement>(".tcy-wallet")!;
    wallet.addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); this.openEarnings(); });
    wallet.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); this.host.sound.click(); this.openEarnings(); } });
    wireModal($("earnings"));
    wireModal($("scrapbook"));
    wireModal($("collection"));
    $("tcy-goal").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); if (HAS_CITY) this.host.openStory(); else this.showPlan(); });
    $("tcy-help").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); $("help-btn").click(); });
    $("earnings").addEventListener("click", e => {
      const el = e.target as Element, hire = el.closest<HTMLElement>("[data-hire-mgr]"), more = el.closest<HTMLElement>("[data-more]");
      if (hire) {
        tick(this.save);
        if (hireManager(this.save, hire.dataset.hireMgr!, Date.now())) { if (this.save.tycoon.tips < 3) this.save.tycoon.tips = 3; this.host.sound.purchase(); vibrate(this.save.settings.vibrate, [15, 30, 15]); confetti(); toast(t("Manager hired! They sell even while you're away")); this.done(); this.renderEarnings(); }
        return;
      }
      if (!more) return;
      const k = more.dataset.more;
      if (k === "decor") { closeModal($("earnings")); $("shop-btn").click(); return; }
      // The cash booster and the time warp work just as in Boosts.
      const fake = document.createElement("button");
      fake.dataset.boost = k === "boost" ? "boost" : "warp1";
      this.onBoostClick({ target: fake } as unknown as Event);
      this.renderEarnings();
    });
    $("tcy-builds").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); this.openBuild(); });
    $("tcy-gems").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); if (this.currentTab() !== "shop") this.openTab("shop"); });
    $("tcy-bar").querySelectorAll<HTMLButtonElement>("button").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      this.host.sound.click();
      const k = b.dataset.open!;
      if (k === "build") { this.closeTabs(); this.openBuild(); }
      else if (k === "more") this.openMore();
      else this.openTab(k);
    }));
    this.wireTabs();
    wireModal($("tcy-buildsheet"));
    wireModal($("tcy-goalsheet"));
    $("tcy-goals").addEventListener("click", e => this.onGoalsTap(e));
    wireModal($("tcy-moresheet"));
    $("tcy-modes").addEventListener("click", e => this.onModeTap(e));
    $("tcy-more").addEventListener("click", e => this.onMoreTap(e));
    // One listener per section (sections are rebuilt, their containers never are).
    $("ty-list").addEventListener("click", e => this.onListClick(e));
    $("ty-upgrades").addEventListener("click", e => this.onUpgradeClick(e));
    $("ty-advisors").addEventListener("click", e => this.onAdvisorClick(e));
    $("ty-boosts").addEventListener("click", e => this.onBoostClick(e));
    $("ty-era-card").addEventListener("click", e => this.onEraClick(e));
    // The home screen's Tycoon button ticks along while the menu shows.
    setInterval(() => this.homeTick(), 1000);
  }

  private get save(): SaveData { return this.host.save; }

  /** Replaces a section's HTML only when it changed. Returns true if it did. */
  private put(el: HTMLElement, html: string): boolean {
    if (this.html.get(el) === html) return false;
    this.html.set(el, html);
    el.innerHTML = html;
    return true;
  }

  private showTab(tab: string): void {
    if (!this.tabOpen(tab)) tab = "company";
    this.tab = tab;
    $("tycoon").querySelectorAll<HTMLElement>(".ty-tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $("tycoon").querySelectorAll<HTMLElement>(".ty-panel").forEach(p => { p.hidden = p.dataset.panel !== tab; });
    $("tycoon").querySelector<HTMLElement>(".sheet")!.scrollTo({ top: 0 });
    this.render();
  }

  /** In the business district (the 3D city), rather than the home screen. */
  inCity = false;
  /** The rainbow after rain and the snow day (ui/weathermoments.ts). */
  private readonly weather = new WeatherMoments(() => ({ save: this.save, sound: this.host.sound, persist: () => this.host.persist() }));
  /** The building whose card is open in the city. */
  private selected = "";
  private photo: PhotoMode | null = null;
  get cardOpen(): boolean { return this.inCity && !!this.selected; }

  /** Opens Skyhaven Inc.: the 3D district when the phone draws it, else the sheet. */
  open(): void {
    if (this.host.canCity()) this.enterCity();
    else this.openSheet("company");
  }

  /** Opens the sheet on a tab (over the city, if it's showing). */
  openSheet(tab = this.tab, focus?: string): void {
    this.host.sound.click();
    tick(this.save);
    this.eraArmed = false;
    if (tab !== this.tab) this.showTab(tab);
    this.render();
    openModal($("tycoon"));
    // The slim header stays pinned; the tabs pin just under it.
    const hero = $("tycoon").querySelector<HTMLElement>(".ty-hero")!;
    $("tycoon").style.setProperty("--ty-hero-h", `${hero.offsetHeight}px`);
    // While learning, start at the coffee cart (it's at the foot of the tower).
    if (focus) requestAnimationFrame(() => $("ty-list").querySelector(`[data-biz="${focus}"]`)?.scrollIntoView({ block: "center" }));
    else if (this.save.tycoon.tips < 3 && this.tab === "company") requestAnimationFrame(() => $("ty-list").querySelector(".ty-coach")?.scrollIntoView({ block: "start" }));
    // Otherwise open at your newest business (not at the empty floors waiting at the top).
    else if (this.tab === "company" && document.body.classList.contains("city-home")) requestAnimationFrame(() => $("tycoon").querySelector<HTMLElement>(".sheet")!.scrollTo({ top: 0 }));
    else if (this.tab === "company") {
      // The rooms draw a moment after the sheet opens: wait for them, then scroll.
      let tries = 0;
      const go = (): void => {
        if ($("tycoon").hidden) return;
        const sheet = $("tycoon").querySelector<HTMLElement>(".sheet")!, room = $("ty-list").querySelector<HTMLElement>(".ty-biz:not(.locked)");
        if (!room) { if (++tries < 40) requestAnimationFrame(go); return; }
        // Just under the pinned header and tabs.
        const below = $("tycoon").querySelector<HTMLElement>(".ty-tabs")!.getBoundingClientRect().bottom;
        sheet.scrollTop += room.getBoundingClientRect().top - below - 8;
      };
      requestAnimationFrame(go);
    }
    this.startLoop();
  }

  /** The camera flies to the business district and its tags and buttons appear. */
  enterCity(): void {
    if (!this.host.onMenu() || this.inCity) return;
    tick(this.save);
    this.inCity = true;
    // A rank the town reached while away (or with this update) is celebrated on the way in.
    window.setTimeout(() => this.checkRank(), 2500);
    window.setTimeout(() => this.neighborNote(), 6000);
    // The very first picture of the town ("then"), once the first tower stands in it and the
    // camera has settled.
    window.setTimeout(() => {
      const s = this.save;
      // (Players who update mid-game get today's town as the picture of the rank they're at.)
      if (this.inCity && s.cafe.starter && !Object.keys(loadMemories()).length && !openModalEl() && !document.body.classList.contains("tabs-open")) saveMemory(townRank(s), this.host.townPicture());
    }, 5000);
    // A brand-new company opens with a bang: everything earns more for its first minutes.
    // (A brand-new company's grand opening starts with its first sale: see doAct.)
    if (this.save.tycoon.tips > 0 && startOpening(this.save)) { this.host.persist(); setTimeout(() => toast(t("🎉 Grand opening! Everything earns ×{n} for {m} minutes", { n: OPENING_MULT, m: OPENING_MINUTES })), 1500); }
    this.host.setBizFocus(true);
    document.body.classList.add("in-tycity");
    $("tycity").hidden = false;
    this.html.delete($("tcy-labels"));
    this.render();
    this.startLoop();
    track("first_district_visit");
    // The first visit (or "See my tower" from the results): a close look at the player's
    // first tower beside the Coffee Cart, then on to the first sale. Once seen, skipped.
    const dest = this.host.townDest, c = this.save.cafe;
    this.host.townDest = "";
    this.startStory(dest);
    if (c.starter && (!c.framed || dest === "tower")) {
      const intro = !c.framed;
      c.framed = true;
      this.host.persist();
      // The close-up (the tower, the street and the cart together) holds through the
      // neighbor's arrival and Mayor Pip's note, and until the neighbor reaches the cart; a
      // revisit just looks for a moment.
      this.frameUntil = Math.max(this.frameUntil, Date.now() + (intro ? 180000 : 4000));
      this.render();
      if (intro) {
        // Pip speaks once the neighbor is in (or the arrival was skipped).
        const note = () => this.welcomeNote(() => this.walkToCart());
        if (this.story.stage === "arrive") this.afterArrival = note;
        else setTimeout(note, 1600);
      } else this.later(4000, () => { if (this.save.tycoon.tips > 0) { this.frameUntil = 0; this.render(); } });
    } else if (!this.save.seenFeatures.includes("ty-city") && this.story.stage !== "arrive") setTimeout(() => this.welcomeNote(), 1200);
    // The first sale comes first: until then the terrace waits in the next-step card.
    if (dest === "terrace" && this.save.tycoon.tips > 0) this.later(900, () => this.openTerrace());
    if (dest === "cafe") this.glance("coffee");
    if (dest === "project") this.projectOpened();
  }

  // ---------- The café block's story (render3d/block.ts) ----------
  /** Where the neighbor in the yellow jacket is in the story, and when it started. */
  story: BizBlock = { stage: "none", at: 0, saleAt: 0, crowd: false, reduced: false };
  private storyTimers: number[] = [];
  private afterArrival: (() => void) | null = null;
  private saleSounded = false;
  private coffeeSold = 0;
  private reactAt = Date.now() + 8000;

  /** Now and then a happy customer's reaction pops up over a business: tap it for a tip. */
  private reactions(now: number): void {
    if (!this.inCity || now < this.reactAt || document.body.classList.contains("tabs-open") || openModalEl() || this.frameUntil > now) return;
    this.reactAt = now + 6000 + Math.random() * 7000;
    const tags = [...$("tcy-labels").querySelectorAll<HTMLElement>(".tag[data-i]:not(.lease):not(.proj)")].filter(tg => tg.style.visibility !== "hidden" && Number(tg.dataset.i) >= 0);
    if (!tags.length) return;
    const tag = tags[Math.floor(Math.random() * tags.length)], r = tag.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 200) return;
    let layer = document.getElementById("tcy-react");
    if (!layer) { layer = document.createElement("div"); layer.id = "tcy-react"; layer.className = "tcy-react"; $("tycity").appendChild(layer); }
    const faces = ["❤️", "😋", "⭐", "😍", "👍", "🎉", "😄"];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "react-bub";
    b.textContent = faces[Math.floor(Math.random() * faces.length)];
    b.setAttribute("aria-label", t("A happy customer: tap for a tip"));
    b.style.left = `${Math.round(r.left + r.width / 2 + (Math.random() - 0.5) * 30)}px`;
    b.style.top = `${Math.round(r.top - 6)}px`;
    b.addEventListener("click", e => {
      e.stopPropagation();
      const n = reactionTip(this.save, Date.now());
      if (n > 0) { this.host.sound.coins(); popCoin(layer!, coins(n)); this.host.persist(); }
      const pop = layer!.lastElementChild as HTMLElement | null;
      if (pop && pop !== b) { pop.style.left = b.style.left; pop.style.top = b.style.top; }
      b.remove();
    }, { once: true });
    layer.appendChild(b);
    setTimeout(() => b.remove(), 4200);
  }
  private earnAt = 0;
  private stage(stage: BizBlock["stage"], at = Date.now()): void { this.story = { ...this.story, stage, at }; }
  private later(ms: number, fn: () => void): void { this.storyTimers.push(window.setTimeout(() => { if (this.inCity) fn(); }, ms)); }
  private clearStory(): void { this.storyTimers.forEach(clearTimeout); this.storyTimers = []; this.afterArrival = null; $("block-skip").hidden = true; this.say(""); }

  /** Where the story stands on this visit, from the save (nothing is replayed that's done). */
  private startStory(dest: string): void {
    this.clearStory();
    const s = this.save, c = s.cafe, now = Date.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.story = { stage: "none", at: now, saleAt: 0, crowd: s.tycoon.tips >= 1, reduced };
    if (!c.starter || levelOf(s, "coffee") === 0) return;
    if (!c.moved) {
      // The moving truck pulls up (once the camera has arrived), and the neighbor moves in.
      if (reduced) { this.finishArrival(); return; }
      this.stage("arrive", now + 1300);
      $("block-skip").hidden = false;
      this.later(1300 + 8000, () => this.finishArrival());
    } else if (s.tycoon.tips === 0) { this.stage("queue"); this.frameUntil = now + 180000; }
    else if (c.terrace < 2) {
      this.stage("chairs");
      if (!c.asked) { this.frameUntil = now + 9000; this.later(1500, () => this.askToSit()); }
    } else if (!c.seated) this.takeSeat(now + 600);
    else if (dest === "terrace" || Math.random() < 0.65) {
      // Their usual seat (they're not always there: it's a real town).
      this.stage("seat");
      if (Math.random() < 0.35) this.later(2500, () => this.say(t("My usual seat ☕"), 3500));
    }
  }

  /** The neighbor is in (the arrival played out, or was skipped). */
  private finishArrival(): void {
    const c = this.save.cafe;
    $("block-skip").hidden = true;
    if (!c.moved) { c.moved = true; this.host.persist(); track("neighbor_moved_in"); }
    this.stage("home");
    const next = this.afterArrival;
    this.afterArrival = null;
    if (next) this.later(400, next);
    // (A replayed arrival, e.g. after the game was closed during it: Pip's welcome if it
    // wasn't seen, then the walk to the cart, as on the first visit.)
    else if (this.save.tycoon.tips === 0) this.later(1200, () => this.welcomeNote(() => this.walkToCart()));
  }
  skipArrival(): void {
    if (this.story.stage !== "arrive") return;
    this.storyTimers.forEach(clearTimeout); this.storyTimers = [];
    this.finishArrival();
  }

  /** A little later, the neighbor walks from their front door to the Coffee Cart. */
  private walkToCart(): void {
    const c = this.save.cafe;
    if (!c.moved || this.save.tycoon.tips > 0) { this.frameUntil = 0; this.render(); return; }
    this.stage("toCart");
    const ms = this.story.reduced ? 300 : 6500;
    // (The close-up stays on: next comes the first sale, then their request.)
    this.later(ms, () => { if (this.story.stage === "toCart") this.stage("queue"); });
  }

  /** After their first coffee: they look at the folded chairs and ask to sit somewhere. */
  private askToSit(): void {
    const c = this.save.cafe;
    if (c.terrace === 2) return;
    this.say(t("Could we sit somewhere?"), 6000);
    // The close-up lets go once they've asked (the next step card says what to build).
    this.frameUntil = Math.min(this.frameUntil || Infinity, Date.now() + 6000);
    if (!c.asked) { c.asked = true; this.host.persist(); track("seating_request"); }
    this.render();
  }

  /** The terrace is open: the chairs unfold, and the neighbor takes the first seat. */
  private takeSeat(at = Date.now()): void {
    const c = this.save.cafe;
    this.stage("toSeat", at);
    this.later(at - Date.now() + (this.story.reduced ? 300 : 3600), () => {
      this.stage("seat");
      if (!c.seated) this.say(t("Ahh, a seat at last ☕"), 4500);
      if (!c.seated) { c.seated = true; this.host.persist(); track("neighbor_seated"); }
    });
  }

  /** A project just opened in the block: its delivery (or the family) arrives, in view. */
  private projectOpened(): void {
    const c = this.save.cafe, id = c.done[c.done.length - 1];
    if (!id) return;
    // The camera glides over first (about 2 s), then the delivery or the family arrives.
    this.story = { ...this.story, opened: { id, at: Date.now() + 1800 } };
    this.frameUntil = Date.now() + 11000;
    this.render();
  }

  /** The first sale: the neighbor at the counter gets their cup at the moment it's
   *  credited (the same sale system, credited once); then they look at the folded chairs. */
  private firstSale(due: number): void {
    const st = this.story.stage;
    // Tapped before the neighbor reached the cart: they're at the counter now.
    if (st === "arrive" || st === "home" || st === "toCart") {
      const note = this.afterArrival;
      this.storyTimers.forEach(clearTimeout); this.storyTimers = [];
      this.afterArrival = null;
      $("block-skip").hidden = true;
      const c = this.save.cafe;
      if (!c.moved) { c.moved = true; this.host.persist(); track("neighbor_moved_in"); }
      this.stage("queue");
      // Pip's welcome still comes, once the sale and the request have played.
      if (note) this.later(due - Date.now() + 8000, () => this.welcomeNote());
    }
    this.story = { ...this.story, saleAt: due };
    this.saleSounded = false;
    if (!this.save.cafe.starter || !this.save.cafe.moved) { this.story = { ...this.story, crowd: true }; return; }
    this.frameUntil = Math.max(this.frameUntil, Date.now() + 12000);
    this.later(due - Date.now() + 500, () => this.stage("chairs"));
    this.later(due - Date.now() + 1900, () => this.askToSit());
    this.later(due - Date.now() + 3000, () => { this.story = { ...this.story, crowd: true }; });
  }

  /** The neighbor's speech bubble (empty text hides it). */
  private sayUntil = 0;
  private say(text: string, ms = 4000): void {
    const el = $("block-say");
    el.textContent = text;
    el.hidden = !text;
    this.sayUntil = text ? Date.now() + ms : 0;
    this.placeSay();
  }
  private placeSay(): void {
    const el = $("block-say");
    if (el.hidden) return;
    const at = this.inCity && Date.now() < this.sayUntil ? this.host.bizResident() : null;
    if (!at) { el.hidden = true; return; }
    // (Kept on screen, even while the camera is still gliding over.)
    const half = Math.min(105, el.offsetWidth / 2 || 105);
    el.style.left = `${Math.round(Math.max(half + 8, Math.min(window.innerWidth - half - 8, at[0])))}px`;
    // (Never over the money bar: it slides down under it on a small phone.)
    const minTop = this.hudBottom() + 8 + (el.offsetHeight || 40) + 7;
    el.style.top = `${Math.round(Math.max(minTop, at[1]))}px`;
  }

  /** A look at a building (the camera glides there), then its card closes by itself so the
   *  Next step guide is back in view, unless the player picked something else meanwhile. */
  private glance(id: string): void {
    this.selected = id;
    this.selectedProp = ""; this.selectedSight = "";
    this.render();
    setTimeout(() => { if (this.inCity && this.selected === id) { this.selected = ""; this.render(); } }, 4500);
  }

  /** The first visit: Mayor Pip says what this place is, and what to do first. */
  private welcomeNote(done: () => void = () => {}): void {
    if (!this.inCity || this.save.seenFeatures.includes("ty-city")) { done(); return; }
    // Wait for any other dialog (the welcome-back card) to close first.
    if (!$("mayor").hidden || !$("welcome").hidden || openModalEl()) { setTimeout(() => this.welcomeNote(done), 1500); return; }
    this.save.seenFeatures.push("ty-city");
    this.host.persist();
    const own = this.save.cafe.starter;
    mayorNote(t("Welcome to Skyhaven Inc.!"), own
      ? (HAS_CITY ? t("Welcome to Skyhaven, your own little town in the sky! Your first neighbor just moved into that apartment block. They'll head over to the Coffee Cart in a moment: sell them their first coffee.")
        : t("That's your first tower, standing in your town! Your first neighbor just moved in. They'll head over to the Coffee Cart in a moment: sell them their first coffee."))
      : HAS_CITY ? t("Welcome to Skyhaven, your own little town in the sky! Your first neighbor just moved into that apartment block. They'll head over to the Coffee Cart in a moment: sell them their first coffee.")
      : t("This is your business district. Every building is one of your businesses, and they grow as you do. The card at the bottom always tells you what to do next. And when you want to build a tower, tap BUILD!"), t("Let's go!"), done);
  }

  /** The café terrace is ready: open it (exactly once), with a celebration. */
  openTerrace(): void {
    const c = this.save.cafe;
    if (c.terrace !== 1 || !this.inCity) return;
    // No pop-up: it happens right there. The camera looks at the block, the folded chairs
    // unfold beside the new tables, and the neighbor carries their coffee to the first seat.
    if (!claimTerrace(c)) return;
    track("terrace_claimed");
    this.host.persist();
    this.host.sound.unlock();
    this.selected = "";
    // The close-up holds until they've sat down and had a moment there (about 5 s to walk).
    this.frameUntil = Date.now() + 10000;
    if (c.moved && c.starter) this.takeSeat(Date.now() + 700);
    else this.stage("seat");
    this.later(900, () => { this.pulse = { id: "coffee", at: Date.now() }; });
    // (The message waits until the camera lets go, so nothing covers the moment.)
    this.later(10200, () => toast(t("☕ The café terrace is open!")));
    this.render();
  }

  /** Back to the home screen. */
  exitCity(): void {
    if (!this.inCity) return;
    this.inCity = false;
    this.selected = "";
    this.frameUntil = 0;
    this.clearStory();
    const hand = document.getElementById("guide-hand");
    if (hand) hand.hidden = true;
    this.host.setBizFocus(false);
    document.body.classList.remove("in-tycity");
    $("tycity").hidden = true;
    // (No refresh here: the home screen re-opens the city, and a tower starting right
    // after this must not have the city pop back up on top of it.)
  }

  /** Closes the building card (the Android back button). Returns false if none was open. */
  closeCard(): boolean {
    if (!this.inCity || !this.selected) return false;
    this.selected = "";
    this.render();
    return true;
  }

  /** Leaves Skyhaven Inc. entirely (to build a tower). */
  private leave(): void {
    if (!$("tycoon").hidden) closeModal($("tycoon"));
    this.exitCity();
  }

  private startLoop(): void {
    const now = Date.now();
    this.nextVip = Math.max(this.nextVip, now + 20000);
    this.nextRush = Math.max(this.nextRush, now + 35000);
    this.nextCritic = Math.max(this.nextCritic, now + 70000);
    this.nextPower = Math.max(this.nextPower, now + 50000);
    cancelAnimationFrame(this.loop);
    const frame = () => {
      if ($("tycoon").hidden && !this.inCity) { this.host.persist(); return; }
      // The grand opening just ended: say so, so the lower prices don't feel like a loss.
      const opening = this.save.tycoon.opening > Date.now();
      if (this.openingWas && !opening) toast(t("Grand opening is over: sales are back to normal prices. Buy levels to earn more!"));
      this.openingWas = opening;
      this.checkBuilds();
      this.live();
      this.loop = requestAnimationFrame(frame);
    };
    this.loop = requestAnimationFrame(frame);
  }

  /** What's happening right now, for the 3D district. */
  /** When the next message in a bottle washes up at the beach (saved, so it can't be farmed by
   *  reopening the game). One comes every 4 to 7 minutes while you play. */
  private bottleNext(): number {
    try {
      const v = Number(localStorage.getItem("skyrise.bottle.v1"));
      if (v > 0) return v;
      const first = Date.now() + 3 * 60e3;
      localStorage.setItem("skyrise.bottle.v1", String(first));
      return first;
    } catch { return Number.MAX_SAFE_INTEGER; }
  }
  private bottleTold = false;
  /** A bottle is floating at the beach right now (only once the first steps are done). */
  private bottleOn(): boolean {
    const s = this.save;
    return this.inCity && !!s.cafe.starter && s.tycoon.tips >= 3 && Date.now() >= this.bottleNext();
  }
  /** Tapping the bottle: a note from someone out at sea, and a gift. */
  private collectBottle(): void {
    if (!this.bottleOn()) return;
    const s = this.save, ps = perSecond(s, Date.now());
    const cash = Math.max(50, Math.round(ps * 90)), gems = Math.random() < 0.2 ? 2 : 0;
    s.tycoon.coins += cash; s.tycoon.lifetime += cash;
    if (gems) s.crystals += gems;
    try { localStorage.setItem("skyrise.bottle.v1", String(Date.now() + (4 + Math.random() * 3) * 60e3)); } catch { /* private mode */ }
    this.host.persist();
    this.host.sound.unlock();
    confetti();
    const notes = ["Greetings from the Cloud Isles! Keep building!", "Whoever finds this: Skyhaven is the best town in the sky.", "Lost my hat at sea. If you find it, it's yours!", "A treasure for the mayor's town. Spend it well!"];
    toast(t("🍾 A message in a bottle: \"{note}\"", { note: t(notes[Math.floor(Math.random() * notes.length)]) }) + " " + (gems ? t("+{cash} and +{n} 💎", { cash: coins(cash), n: gems }) : t("+{cash}", { cash: coins(cash) })));
    this.labelsDirty = true;
    this.render();
  }

  liveState(): { bottle: boolean; frame: boolean; golden: string; rush: string; vip: string; critic: string; power: string; sel: string; selHome: string; selSight: string; building: { kind: string; id: string }[]; pulse: string; pulseAt: number; block: BizBlock } {
    const now = Date.now(), s = this.save;
    return {
      bottle: this.bottleOn(),
      pulse: this.pulse.id,
      pulseAt: this.pulse.at,
      sel: this.inCity ? this.selected : "",
      // (A home tapped before homes can be upgraded shows as a sight: "h:" and its key.)
      selHome: this.inCity ? this.selectedProp || (this.selectedSight.startsWith("h:") ? this.selectedSight.slice(2) : "") : "",
      selSight: this.inCity && !this.selectedSight.startsWith("h:") ? this.selectedSight : "",
      building: (s.tycoon.builds ?? []).filter(b => b.end > Date.now()).map(b => ({ kind: b.kind, id: b.id })),
      rush: rushOn(s, s.tycoon.rush.id, now) ? s.tycoon.rush.id : "",
      vip: this.vip.until > now ? this.vip.id : "",
      golden: this.golden.until > now ? this.golden.id : "",
      frame: this.frameUntil > now,
      critic: this.critic.until > now ? this.critic.id : "",
      power: this.power.until > now ? this.power.id : "",
      // Customers come once the cart has made its first sale (a saved fact, any visit).
      block: this.inCity ? { ...this.story, crowd: this.story.crowd || (s.tycoon.tips >= 1 && !this.story.saleAt), sold: this.coffeeSold } : { stage: "none", at: 0, saleAt: 0, crowd: false, reduced: false },
    };
  }

  /** Every frame while Skyhaven Inc. is open: earnings, the rolling counter, progress, and
   *  coins popping out of the rooms or buildings. */
  private live(): void {
    this.guideHand();
    this.placeSay();
    const now = Date.now(), s = this.save, sheet = !$("tycoon").hidden;
    if (now - this.lastTick > 120) {
      this.lastTick = now;
      tick(s, now);
      if (now - this.lastSave > 5000) { this.lastSave = now; this.host.persist(); }
    }
    // The counter rolls up smoothly.
    const real = s.tycoon.coins;
    this.shownCoins = this.shownCoins < 0 || real < this.shownCoins ? real : this.shownCoins + (real - this.shownCoins) * 0.18;
    if (real - this.shownCoins < Math.max(0.5, real * 1e-4)) this.shownCoins = real;
    // (Tags first: they read sizes, so they go before anything on the page changes this frame.)
    if (this.inCity) this.placeTags();
    const shown = coins(this.shownCoins);
    for (const id of ["ty-coins", "tcy-coins"]) { const el = $(id); if (el.textContent !== shown) el.textContent = shown; }
    if (!$("earnings").hidden && now - this.earnAt > 900) { this.earnAt = now; this.renderEarnings(); }
    this.reactions(now);
    if (HAS_CITY) this.weather.tick(now, this.inCity);
    for (const b of BUSINESSES) {
      if (levelOf(s, b.id) === 0) continue;
      const id = b.id, p = progressOf(s, id, now);
      // A finished cycle pops a coin out and sends one flying to the counter.
      const was = this.lastP.get(id) ?? 0, running = !!s.tycoon.runs[id];
      if ((p < was - 0.05 || (was > 0.6 && !running)) && now - (this.lastPop.get(id) ?? 0) > 450) {
        this.lastPop.set(id, now);
        const amount = coins(payOf(s, b, now) * Math.max(1, Math.round(450 / (cycleOf(b, levelOf(s, id)) * 1000))));
        // (A customer at the Coffee Cart gets their cup when a sale really completes.)
        if (id === "coffee") this.coffeeSold = now;
        // The first sale: a quiet counter sound with the cup and the coins.
        if (id === "coffee" && this.story.saleAt && !this.saleSounded && now >= this.story.saleAt - 150) { this.saleSounded = true; this.host.sound.counter(); }
        if (sheet) {
          const row = $("ty-list").querySelector<HTMLElement>(`.ty-biz[data-id="${id}"]`);
          if (row && this.tab === "company") { popCoin(row.querySelector(".room-pops")!, amount); flyCoin(row.querySelector(".room-scene")!, "ty-coins"); }
        } else if (this.inCity) {
          const tag = $("tcy-labels").querySelector<HTMLElement>(`[data-tag="${id}"]`);
          if (tag && !tag.hidden) { popCoin(tag.querySelector(".tag-pops")!, amount); if (Math.random() < 0.5) flyCoin(tag, "tcy-coins"); }
          // The building itself bounces as it sells (not too often, so the street stays calm).
          if (now - this.pulse.at > 900) this.pulse = { id, at: now };
        }
      }
      this.lastP.set(id, p);
      const bar = sheet ? $("ty-list").querySelector<HTMLElement>(`.ty-biz[data-id="${id}"] .ty-prog i`) : null;
      if (bar) bar.style.width = `${p * 100}%`;
      if (this.inCity) {
        const tb = $("tcy-labels").querySelector<HTMLElement>(`[data-tag="${id}"] .tag-ico`);
        const pv = p.toFixed(2);
        if (tb && tb.style.getPropertyValue("--p") !== pv) tb.style.setProperty("--p", pv);
        if (this.selected === id) { const cb = $("tcy-card").querySelector<HTMLElement>(".card-prog i"); if (cb) cb.style.width = `${p * 100}%`; }
      }
    }
    this.events(now);
    // Prices, labels and buttons follow the coins a few times a second.
    if (now - this.lastSoft > 300) { this.lastSoft = now; this.render(); }
  }

  // ---------- The 3D city: the game's home ----------

  /** What the "Next step" button does right now. */
  private nextAct: (() => void) | null = null;

  /** The one thing the player should do next, always on screen. */
  /** A rough wait, in words: "40s", "12m", "3h 20m", "2d". */
  private static wait(sec: number): string {
    if (sec < 60) return t("{n}s", { n: Math.max(1, Math.ceil(sec)) });
    if (sec < 3600) return t("{n}m", { n: Math.ceil(sec / 60) });
    if (sec < 86400) { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return m ? t("{h}h {m}m", { h, m }) : t("{h}h", { h }); }
    return t("{n}d", { n: Math.ceil(sec / 86400) });
  }

  /** Why a business's button is greyed out, in one plain line with the numbers. */
  private whyLocked(id: string, act: string): string {
    const s = this.save, ty = s.tycoon, i = BUSINESSES.findIndex(b => b.id === id), b = BUSINESSES[i];
    if (!b) return "";
    const ps = perSecond(s, Date.now());
    const wait = (need: number) => ps > 0 ? t("about {time} at {rate}/s", { time: TycoonUI.wait(need / ps), rate: coins(ps) }) : t("sell to earn it");
    if (act === "buy") {
      if (!unlockedBusiness(s, i)) {
        const b0 = BUSINESSES[i], land = b0.land ? LAND.find(l => l.id === b0.land) : null, p = prevBusiness(i);
        if (land && !s.land.includes(land.id)) return t("Why? It's in the {land}: buy the {land} first.", { land: t(land.name) });
        if (hallLocked(s, b0.id)) return t("Why? It opens when the City Hall reaches level {n}. Tap the City Hall to see what it needs.", { n: hallNeed(b0.id) });
        return t("Why? Open the {prev} first: businesses open one after another.", { prev: t(BUSINESSES[Math.max(0, p)].name) });
      }
      const lv = levelOf(s, id), room = Math.max(1, freeFloors(s));
      const n = lv === 0 ? 1 : Math.min(room, this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
      const price = costOf(b, lv, n);
      if (freeFloors(s) < 1) return t("Why? Every business level needs an office floor, and yours are full. Build a tower: each floor adds 2.");
      if (price > ty.coins) return t("Why? You need {n} more ({wait}).", { n: coins(price - ty.coins), wait: wait(price - ty.coins) });
    }
    if (act === "hire" && b.manager > ty.coins) return t("Why? A manager costs {price}: you need {n} more ({wait}).", { price: coins(b.manager), n: coins(b.manager - ty.coins), wait: wait(b.manager - ty.coins) });
    return "";
  }

  /** Once a day, the first neighbor says one line about what changed in town since your last
   *  visit (a new rank, a project, a decoration, the island), or just says hello. */
  private neighborNote(): void {
    const s = this.save, c = s.cafe;
    if (!this.inCity || !c.starter || !c.moved || c.terrace !== 2 || this.momentDone || openModalEl() || document.body.classList.contains("tabs-open")) return;
    const day = new Date().toDateString(), rk = townRank(s);
    const sig = { rank: rk, done: (c.done ?? []).length, decor: (s.decor ?? []).length, annex: annexBuilt(s) ? 1 : 0 };
    let last: { day?: string } & Partial<typeof sig> = {};
    try { last = JSON.parse(localStorage.getItem("skyrise.neighbor.v1") || "{}"); } catch { /* first time */ }
    if (last.day === day) return;
    const mark = () => { try { localStorage.setItem("skyrise.neighbor.v1", JSON.stringify({ day, ...sig })); } catch { /* private mode */ } };
    if (!last.day) { mark(); return; } // the very first day has its own story
    const line = sig.rank > (last.rank ?? rk) ? t(NEIGHBOR_LINES[rk - 1] ?? NEIGHBOR_LINES[0])
      : sig.annex > (last.annex ?? 0) ? t("Have you seen the island next door? I can see it from my table!")
      : sig.done > (last.done ?? 0) ? t("The new project on our block is wonderful. Everyone's talking about it!")
      : sig.decor > (last.decor ?? 0) ? t("Something new in town! I took the long way round just to see it.")
      : t(DAILY_HELLO[Math.floor(Date.now() / 86400000) % DAILY_HELLO.length]);
    if (this.story.stage === "none") this.stage("seat");
    this.frameUntil = Date.now() + 5200;
    this.render();
    // (Marked as seen only once it's actually said: leaving the town first keeps it for later.)
    this.later(700, () => {
      if (!this.inCity || openModalEl() || document.body.classList.contains("tabs-open")) return;
      mark();
      this.say(line, 4600);
    });
  }

  /** A new player's first loop, as a checklist on the Next step card (until all five are done
   *  or the town reaches Village): sell, buy a level, hire a manager, build a tower, open a
   *  second business. */
  private firstDay(): { steps: { label: string; ok: boolean }[]; done: number } | null {
    const s = this.save, ty = s.tycoon;
    if (townRank(s) > 0 || s.seenFeatures.includes("first-day-done")) return null;
    const steps = [
      { label: t("Sell a coffee"), ok: ty.tips >= 1 },
      { label: t("Buy a level"), ok: ty.tips >= 2 },
      { label: t("Hire a manager"), ok: ty.tips >= 3 || ty.managers.length > 0 },
      ...(HAS_CITY ? [] : [{ label: t("Build a tower"), ok: !!s.cafe.starter }]),
      { label: t("Open a second business"), ok: levelOf(s, BUSINESSES[1].id) > 0 },
    ];
    const done = steps.filter(f => f.ok).length;
    if (done === steps.length) {
      s.seenFeatures.push("first-day-done");
      this.host.persist();
      toast(t("First day done! Now grow Skyhaven to the Village."));
      return null;
    }
    return { steps, done };
  }

  /** What a City Hall level opens, in one line ("" if nothing new). */
  opensLine(level: number): string {
    const names = hallOpens(level).map(b => t(b.name));
    if (HAS_CITY) for (const land of LAND.filter(l => landHall(l.id) === level)) names.push(t(land.name));
    return names.length ? t("Opens: {list}", { list: names.join(", ") }) : "";
  }

  /** The Next step card's heading: the City Plan chapter it belongs to, with a dot per goal. */
  private planLabel(): string {
    const s = this.save, ci = chapterIndex(s), ch = CHAPTERS[ci];
    if (!ch) return esc(t("Next step"));
    return `${arrows(esc(t("City Hall Lv {n} → {next} · {title}", { n: ci + 1, next: ci + 2, title: t(ch.title) })))}<span class="first-dots">${ch.goals.map(g => `<i class="${goalDone(s, g) ? "ok" : ""}"></i>`).join("")}</span>`;
  }

  /** The step toward the current chapter's first unfinished goal, when there's one to take. */
  private planStep(select: (id: string) => () => void): { text: string; sub: string; pct?: number; tone: string; act: () => void } | null {
    const s = this.save, ty = s.tycoon, ch = CHAPTERS[chapterIndex(s)];
    if (!ch || chapterReady(s)) return null;
    const g = ch.goals.find(x => !goalDone(s, x));
    if (!g) return null;
    const play = () => { this.leave(); this.host.play("classic"); };
    switch (g.kind) {
      case "towers": return { text: t("Build a tower"), sub: t("{n} of {total} towers for this chapter", { n: fmt(g.have(s)), total: fmt(g.need) }), pct: g.have(s) / g.need, tone: "grow", act: play };
      case "builds": return { text: t("Build something in Skyhaven"), sub: t("{n} of {total} builds for this chapter", { n: fmt(g.have(s)), total: fmt(g.need) }), pct: g.have(s) / g.need, tone: "grow", act: () => this.openBuild() };
      case "offices": return { text: t("Build an office block"), sub: t("{n} of {total} office blocks for this chapter", { n: fmt(g.have(s)), total: fmt(g.need) }), pct: g.have(s) / g.need, tone: "grow", act: () => this.openBuild() };
      case "height": return { text: t("Build a tower {n} m tall", { n: fmt(g.need) }), sub: t("Your best so far: {n} m", { n: fmt(Math.floor(g.have(s))) }), pct: Math.min(1, g.have(s) / g.need), tone: "grow", act: play };
      case "land": {
        // (Districts go on sale in order: one before this goal's comes first, so a save from
        // before the Beach Resort is still led to it on the way to the Cloud Kingdom.)
        const want = LAND.find(x => x.id === g.land), sale = landOnSale(s);
        const l = sale && want && LAND.indexOf(sale) <= LAND.indexOf(want) ? sale : null;
        if (!l) return null;
        const lp = landPrice(s, l);
        return ty.coins >= lp
          ? { text: t("Buy the {name}!", { name: t(l.name) }), sub: t(l.what), pct: 1, tone: "gift", act: () => this.openLand() }
          : { text: t("Save {n} for the {name}", { n: coins(lp), name: t(l.name) }), sub: t(l.what), pct: Math.min(1, ty.coins / lp), tone: "save", act: () => this.openLand() };
      }
      case "landOpen": {
        if (!g.land || !s.land.includes(g.land)) return null;
        const i = BUSINESSES.findIndex((b, k) => b.land === g.land && levelOf(s, b.id) === 0 && unlockedBusiness(s, k));
        if (i < 0) return null;
        const b = BUSINESSES[i], price = costOf(b, 0, 1);
        return ty.coins >= price
          ? { text: t("Open the {name}!", { name: t(b.name) }), sub: t("{n} of {total} open in this district", { n: fmt(g.have(s)), total: fmt(g.need) }), tone: "go", act: select(b.id) }
          : { text: t("Save {n} to open the {name}", { n: coins(price), name: t(b.name) }), sub: t("{n} of {total} open in this district", { n: fmt(g.have(s)), total: fmt(g.need) }), pct: Math.min(1, ty.coins / price), tone: "save", act: select(b.id) };
      }
      case "projects": return projectsOpen(s.cafe) ? { text: t("Choose your block's next project"), sub: t(g.text, { n: fmt(g.need) }), tone: "grow", act: () => this.openBuild() } : null;
      case "grown": {
        const b = BUSINESSES.find(x => readyStage(s, x.id));
        if (!b) return null;
        const st = readyStage(s, b.id);
        return { text: t("Build the {name} HQ", { name: t(stageName(b.id, st)) }), sub: this.hqSub(b.id, st), tone: "grow", act: () => this.goHQ(b.id) };
      }
      case "managers": {
        const b = BUSINESSES.find(x => levelOf(s, x.id) > 0 && !ty.managers.includes(x.id));
        if (!b) return null;
        return { text: t("Hire a manager for {name}", { name: t(stageName(b.id, stageNow(s, b.id))) }), sub: t("{n} of {total} managers for this chapter", { n: fmt(g.have(s)), total: fmt(g.need) }), pct: Math.min(1, ty.coins / b.manager), tone: ty.coins >= b.manager ? "go" : "save", act: select(b.id) };
      }
      default: return null;
    }
  }

  private nextStep(): { text: string; sub: string; pct?: number; tone: string; act: () => void } {
    const s = this.save, ty = s.tycoon, live = this.liveState();
    const nameOf = (id: string) => t(stageName(id, stageNow(s, id)));
    const select = (id: string) => () => { this.selected = id; this.selectedProp = ""; this.selectedSight = ""; this.render(); };
    // First steps come before anything else: the first sale, then (if ready) the café
    // terrace, then a level, then a manager.
    const cart = BUSINESSES[0];
    if (ty.tips === 0) return { text: t("Tap the Coffee Cart to sell your first coffee!"), sub: t("Every sale earns cash for your company"), tone: "learn", act: () => { this.doAct("run", "coffee", $("tcy-next"), null, $("tcy-next"), $("tcy-next")); this.render(); } };
    // Right after the first sale: café seating for the neighbor (built with the next
    // tower), then opening it; the level and the manager come after.
    if (s.cafe.terrace === 0 && s.cafe.starter && s.cafe.moved) {
      // (City first: the terrace is the player's first build, with a builder and a timer.)
      const job = buildOf(s, "terrace", "");
      if (job) return { text: t("☕ Building the café terrace…"), sub: t("{t} left · tap to finish now for 💎{n}", { t: fmtLeft(job.end - Date.now()), n: finishPrice(job.end - Date.now()) }), pct: (Date.now() - job.start) / Math.max(1, job.end - job.start), tone: "grow", act: () => this.finishBuild("terrace") };
      // (Saving up for it: keep selling coffee, and the pill sells one each tap too.)
      if (HAS_CITY && s.tycoon.coins < TERRACE_PRICE) return { text: t("Sell coffee to save {n} for a café terrace", { n: coins(TERRACE_PRICE) }), sub: t("{have} of {n} · tap the Coffee Cart to sell", { have: coins(s.tycoon.coins), n: coins(TERRACE_PRICE) }), pct: Math.min(1, s.tycoon.coins / TERRACE_PRICE), tone: "save", act: () => { this.doAct("run", "coffee", $("tcy-next"), null, $("tcy-next"), $("tcy-next")); this.render(); } };
      if (HAS_CITY) return { text: t("Build a café terrace"), sub: t("Your neighbor would like to sit down · {n}", { n: coins(TERRACE_PRICE) }), pct: Math.min(1, s.tycoon.coins / TERRACE_PRICE), tone: "grow", act: () => { this.startCityBuild("terrace"); } };
      const n = seatingNeed(s.cafe);
      return { text: tn(n, "Build {n} more floor for café seating", "Build {n} more floors for café seating", { n }), sub: t("Your neighbor would like to sit down"), pct: s.cafe.floors / (s.cafe.floors + n), tone: "grow", act: () => { this.leave(); this.host.play("classic"); } };
    }
    if (s.cafe.terrace === 1) return { text: t("☕ Your café terrace is ready!"), sub: t("Open it: the Coffee Cart earns more"), tone: "gift", act: () => this.openTerrace() };
    // (Short of the price: keep selling, and the pill sells a coffee each tap too.)
    const sell = () => { this.doAct("run", "coffee", $("tcy-next"), null, $("tcy-next"), $("tcy-next")); this.render(); };
    const cartLevel = costOf(cart, levelOf(s, "coffee"), 1);
    if (HAS_CITY && ty.tips === 1 && ty.coins < cartLevel) return { text: t("Sell coffee to save {n} for a bigger Coffee Cart", { n: coins(cartLevel) }), sub: t("{have} of {n} · tap the Coffee Cart to sell", { have: coins(ty.coins), n: coins(cartLevel) }), pct: ty.coins / cartLevel, tone: "save", act: sell };
    if (HAS_CITY && ty.tips === 2 && ty.coins < cart.manager && !ty.managers.length) return { text: t("Sell coffee to save {n} for a manager", { n: coins(cart.manager) }), sub: t("{have} of {n} · tap the Coffee Cart to sell", { have: coins(ty.coins), n: coins(cart.manager) }), pct: ty.coins / cart.manager, tone: "save", act: sell };
    if (ty.tips === 1) return { text: t("Buy a level for the Coffee Cart"), sub: t("Each level makes every sale bigger"), tone: "learn", act: select("coffee") };
    if (ty.tips === 2) return { text: t("Hire a manager for the Coffee Cart"), sub: t("Managers sell for you, even while you're away"), pct: Math.min(1, ty.coins / cart.manager), tone: "learn", act: select("coffee") };
    // A first-time objective stays in view until it's tried: the block's next project, then a
    // business's first HQ (both cost nothing but a tower).
    if (projectsOpen(s.cafe) && !s.seenFeatures.includes("try-contract")) return { text: t("Choose your block's next project"), sub: t("A flower market or a playground: both are waiting on your block"), tone: "grow", act: () => this.openBuild() };
    const firstHq = !s.seenFeatures.includes("try-hq") ? BUSINESSES.find(b => readyStage(s, b.id)) : undefined;
    if (firstHq) {
      const st = readyStage(s, firstHq.id);
      return { text: t("Build the {name} HQ", { name: t(stageName(firstHq.id, st)) }), sub: this.hqSub(firstHq.id, st), tone: "grow", act: () => this.goHQ(firstHq.id) };
    }
    // Rewards waiting and a finished chapter.
    if (!$("collect-chip").hidden) return { text: $("collect-chip").textContent ?? "", sub: t("Tap to collect"), tone: "gift", act: () => $("collect-chip").click() };
    if ($("mayor-strip").classList.contains("ready") && !$("mayor-strip").hidden) return { text: t("Upgrade the City Hall to level {n}!", { n: hallLevel(s) + 1 }), sub: this.opensLine(hallLevel(s) + 1) || t("Tap to celebrate with Mayor Pip"), tone: "gift", act: () => $("mayor-strip").click() };
    // Live moments: a golden customer beats everything.
    if (live.golden) return { text: t("✨ A golden customer is at {name}!", { name: nameOf(live.golden) }), sub: t("Catch them before they leave: {n}s", { n: Math.max(0, Math.ceil((this.golden.until - Date.now()) / 1000)) }), tone: "gold", act: () => this.catchGolden() };
    if (live.vip) return { text: t("A VIP is at {name}!", { name: nameOf(live.vip) }), sub: t("Tap them for a big tip"), tone: "hot", act: select(live.vip) };
    if (live.critic) return { text: t("A food critic is at {name}!", { name: nameOf(live.critic) }), sub: t("Serve them for a five-star review"), tone: "hot", act: select(live.critic) };
    if (live.power) return { text: t("Power cut at {name}!", { name: nameOf(live.power) }), sub: t("Tap it to fix the lights"), tone: "hot", act: select(live.power) };
    // The City Plan: the chapter's next goal leads (the town's main path), when it's
    // something to go and do; business levels fall through to the steps below.
    const plan = this.planStep(select);
    if (plan) return plan;
    // Every other little while, the bigger goals get their turn before the HQ: the next
    // island (when it's affordable, or close), or a building to grow.
    if (Math.floor(Date.now() / 15000) % 2 === 1) {
      const l = landOnSale(s), lp = l ? landPrice(s, l) : 0;
      if (l && ty.coins >= lp * 0.3) return { text: ty.coins >= lp ? t("A new island is for sale!") : t("Save for {name}", { name: t(l.name) }), sub: t("{name}: {what} · {n}", { name: t(l.name), what: t(l.what), n: coins(lp) }), pct: Math.min(1, ty.coins / lp), tone: "gift", act: () => this.openLand() };
      const best = propsOpen(s) ? this.host.bizHomes().map(key => ({ key, lv: propLevel(s, key), price: propPrice(s, key) })).filter(h => !propBlock(s, h.key) && h.price <= ty.coins).sort((a, b) => a.price - b.price)[0] : undefined;
      if (best) return { text: t("Grow a building in town"), sub: t("{tier} → {next} · {n}", { tier: t(PROP_TIERS[best.lv]), next: t(PROP_TIERS[best.lv + 1]), n: coins(best.price) }), tone: "grow", act: () => this.selectProp(best.key) };
    }
    // Growing: a headquarters to build.
    const grow = BUSINESSES.find(b => readyStage(s, b.id));
    if (grow) {
      const st = readyStage(s, grow.id);
      return { text: t("Build the {name} HQ", { name: t(stageName(grow.id, st)) }), sub: this.hqSub(grow.id, st), tone: "grow", act: () => this.goHQ(grow.id) };
    }
    // The floating island next to the town (Big City): waiting for its landmark.
    if (annexOpen(s) && !annexBuilt(s)) {
      const price = annexPrice(s);
      return { text: t("A new island is waiting!"), sub: t("Build a greenhouse or a lookout across the sky · {n}", { n: coins(price) }), pct: Math.min(1, ty.coins / price), tone: "gift", act: () => this.openAnnex() };
    }
    // Land for sale next to the island, once the company can afford it.
    { const l = landOnSale(s), lp = l ? landPrice(s, l) : 0;
      if (l && ty.coins >= lp) return { text: t("A new island is for sale!"), sub: t("{name}: {what} · {n}", { name: t(l.name), what: t(l.what), n: coins(lp) }), pct: 1, tone: "gift", act: () => this.openLand() }; }
    // From here on every step says what it brings the town: the next rank and what it adds.
    const rk = townRank(s), nx = RANKS[rk + 1], left = nx ? Math.max(1, nx.at - usedFloors(s)) : 0;
    const toward = HAS_CITY ? "" : nx ? t("{n} business levels until {rank}: {unlock}", { n: fmt(left), rank: t(nx.name), unlock: t(nx.unlock) }) : "";
    const cheapest = () => BUSINESSES.filter(b => levelOf(s, b.id) > 0).sort((a, b) => costOf(a, levelOf(s, a.id), 1) - costOf(b, levelOf(s, b.id), 1))[0];
    // Close to the next rank: that's the step.
    if (!HAS_CITY && nx && left <= 10 && freeFloors(s) >= 1) {
      const c = cheapest();
      return { text: tn(left, "Just {n} business level until {rank}!", "Just {n} business levels until {rank}!", { n: fmt(left), rank: t(nx.name) }), sub: t(nx.unlock), pct: 1 - left / Math.max(1, nx.at - RANKS[rk].at), tone: "gift", act: select(c.id) };
    }
    // The next business to open.
    const ni = BUSINESSES.findIndex((b, i) => levelOf(s, b.id) === 0 && unlockedBusiness(s, i));
    if (ni >= 0) {
      const b = BUSINESSES[ni], price = costOf(b, 0, 1);
      if (ty.coins >= price) return { text: t("Open the {name}!", { name: t(b.name) }), sub: toward || t("A new business for your company"), tone: "go", act: select(b.id) };
    }
    // A manager to hire, an upgrade to buy.
    const mgr = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !ty.managers.includes(b.id) && ty.coins >= b.manager);
    if (mgr) return { text: t("Hire a manager for {name}", { name: nameOf(mgr.id) }), sub: t("It keeps earning while you're away"), tone: "go", act: select(mgr.id) };
    if (freeFloors(s) < 1) return { text: t("Your offices are full"), sub: nx ? t("Build an office block: more business levels, closer to {rank}", { rank: t(nx.name) }) : t("Build an office block for more office floors"), tone: "grow", act: () => this.openBuild() };
    const up = upgradesOnOffer(s).find(u => u.cost <= ty.coins);
    if (up) return { text: t("Buy the {name} upgrade", { name: t(up.name) }), sub: up.biz === "all" ? t("Every business earns ×{n}", { n: up.mult }) : t("{name} earns ×{n}", { name: nameOf(up.biz), n: up.mult }), tone: "go", act: () => this.openSheet("upgrades") };
    if (freeFloors(s) < 1) return { text: t("Your offices are full"), sub: t("Build an office block for more office floors"), tone: "grow", act: () => this.openBuild() };
    // A building the company can grow right now (the cheapest), now and then: every level
    // makes every business earn more. Shown once the company has a few businesses going.
    if (propsOpen(s) && BUSINESSES.filter(b => levelOf(s, b.id) > 0).length >= 2) {
      const best = this.host.bizHomes().map(key => ({ key, lv: propLevel(s, key), price: propPrice(s, key) }))
        .filter(h => !propBlock(s, h.key) && h.price <= ty.coins).sort((a, b) => a.price - b.price)[0];
      if (best) return { text: t("Grow a building in town"), sub: t("{tier} → {next} · {n}", { tier: t(PROP_TIERS[best.lv]), next: t(PROP_TIERS[best.lv + 1]), n: coins(best.price) }), tone: "grow", act: () => this.selectProp(best.key) };
    }
    // The next business waits for the City Hall: the story's next level is the step.
    const hi = BUSINESSES.findIndex(b => !b.land && hallLocked(s, b.id));
    if (ni < 0 && hi >= 0) {
      const hb = BUSINESSES[hi];
      return { text: t("City Hall level {n} opens the {name}", { n: hallNeed(hb.id), name: t(hb.name) }), sub: t("Finish Mayor Pip's goals to grow the City Hall"), tone: "grow", act: () => this.host.openStory() };
    }
    const lw = ni < 0 ? landWaiting(s) : null;
    if (lw) return { text: t("City Hall level {n} opens the {name}", { n: landHall(lw.id), name: t(lw.name) }), sub: t("Finish Mayor Pip's goals to grow the City Hall"), tone: "grow", act: () => this.host.openStory() };
    // Saving up: what for, and how far along.
    if (ni >= 0) {
      const b = BUSINESSES[ni], price = costOf(b, 0, 1);
      return { text: t("Save {n} to open the {name}", { n: coins(price), name: t(b.name) }), sub: toward || t("Keep growing your businesses"), pct: Math.min(1, ty.coins / price), tone: "save", act: select(b.id) };
    }
    const cheap = cheapest();
    return { text: t("Grow {name}", { name: nameOf(cheap.id) }), sub: toward || t("Buy levels to earn more"), pct: Math.min(1, ty.coins / costOf(cheap, levelOf(s, cheap.id), 1)), tone: "save", act: select(cheap.id) };
  }

  /** The tags over every lot, the next step, the card and the bar (rebuilt only when they change). */
  private renderCity(now: number): void {
    const s = this.save, ty = s.tycoon;
    $("tcy-era").textContent = t("Skyhaven Inc.");
    this.renderGoal();
    { const ps = perSecond(s, now); $("tcy-rate").textContent = ps > 0 ? t("+{n}/s", { n: coins(ps) }) : t("Tap a business to sell"); }
    // The savings goal: a thin bar along the bottom of the wallet.
    { const g = HAS_CITY ? saveGoal(s, id => hqPrice(s, id), id => readyStage(s, id)) : null, bar = $("tcy-save");
      bar.hidden = !g || ty.coins >= g.price || ty.tips < 3;
      if (g && !bar.hidden) (bar.firstElementChild as HTMLElement).style.width = `${Math.max(2, Math.min(100, (ty.coins / g.price) * 100)).toFixed(1)}%`; }
    $("tcy-gems-n").textContent = fmt(s.crystals);
    if (this.shownCoins < 0) $("tcy-coins").textContent = coins(ty.coins);
    const live = this.liveState();
    const gold = live.golden ? `<button type="button" class="ty-chip golden-chip" data-golden="1">✨ ${esc(t("Golden customer · {n}s", { n: Math.max(0, Math.ceil((this.golden.until - now) / 1000)) }))}</button>` : "";
    this.put($("tcy-events"), gold + ($("ty-events").querySelector(".boom")?.outerHTML ?? ""));
    // The player's first tower has its own bubble (a caption during the first look at it).
    const starterTag = s.cafe.starter ? `<button type="button" class="tag bub starter${live.frame ? " sel" : ""}" data-tag="starter" data-i="-1" data-h="-1"><span class="tag-ico">🏢</span>${live.frame ? `<b>${esc(HAS_CITY && s.profile.towers === 0 ? t("Your first building!") : t("Your first tower!"))}</b>` : ""}</button>` : "";
    // The block's project spots: a dashed preview while on offer (tap to choose), an icon once open.
    // (Once a project is open, the scene itself shows it: no bubble.)
    const projTag = (id: ProjectId, i: number, ico: string, name: string) => {
      if (s.cafe.done.includes(id) || !projectsOpen(s.cafe)) return "";
      return `<button type="button" class="tag bub proj offer" data-tag="proj-${id}" data-i="${i}" data-h="-1" aria-label="${esc(t(name))}"><span class="tag-ico">${iconSvg(ico)}</span></button>`;
    };
    const blockTags = s.cafe.terrace === 2 ? projTag("flowers", -2, "flower", "Flower market") + projTag("play", -3, "slide", "Playground") : "";
    // (During a story close-up only the Coffee Cart keeps its bubble: nothing covers the
    // neighbor and their moment.)
    const closeUp = live.frame;
    // Land for sale next to the island: a green "for sale" bubble over it, with its price.
    const sale = landOnSale(s), sk = sale ? LAND.indexOf(sale) : -1;
    const landJob = sale ? buildOf(s, "land", sale.id) : null;
    const landTag = sale && !closeUp ? `<button type="button" class="tag bub land-sale${landJob ? " building" : ""}" data-tag="land-${sale.id}" data-i="${-10 - sk}" data-h="-1"><span class="tag-ico">${landJob ? "🏗️" : "🏞️"}</span><b>${landJob ? esc(t("Building · {t}", { t: fmtLeft(landJob.end - now) })) : `${esc(t("For sale"))} · ${esc(coins(landPrice(s, sale)))}`}</b></button>` : "";
    // Properties: a little ↑ over the (up to three) cheapest ones the company can upgrade
    // now, and the selected one highlighted.
    const homes = this.host.bizHomes(), propTags = closeUp || !propsOpen(s) ? "" : homes
      .map((key, idx) => ({ key, idx, lv: propLevel(s, key), price: propPrice(s, key, now) }))
      .filter(h => h.key === this.selectedProp || (!propBlock(s, h.key) && h.price <= ty.coins))
      .sort((a, b) => (a.key === this.selectedProp ? -1 : b.key === this.selectedProp ? 1 : a.price - b.price)).slice(0, 3)
      .map(h => `<button type="button" class="tag bub prop-up${h.key === this.selectedProp ? " sel" : ""}" data-tag="prop-${h.key}" data-i="${-100 - h.idx}" data-h="-1" aria-label="${esc(t("Upgrade this building"))}"><span class="tag-ico">${h.key === this.selectedProp ? "🏠" : "⬆"}</span>${h.key === this.selectedProp ? `<b>${esc(t("Lv {n}", { n: h.lv }))}</b>` : ""}</button>`).join("");
    // Neighbour requests: a speech bubble over the home that asks (a green tick once done).
    // Once the city is worth keeping: its recovery code, so a new phone can bring it back.
    const cloud = HAS_CITY && hallLevel(s) >= 3 && !s.seenFeatures.includes("cloud-note") ? this.host.cloudCode() : null;
    if (cloud && $("mayor").hidden && !openModalEl() && !document.body.classList.contains("tabs-open") && !document.querySelector(".hall-banner")) this.cloudNote(cloud);
    if (HAS_CITY && !s.cityName && hallLevel(s) >= 2 && !s.seenFeatures.includes("name-city") && $("mayor").hidden && !openModalEl() && !document.body.classList.contains("tabs-open") && !document.querySelector(".hall-banner")) this.nameCity(true);
    this.collectDesigns(now);
    if (!closeUp && now - this.askAt > 3000) { this.askAt = now; if (newAsk(s, homes, now)) { this.host.persist(); toast(t("💬 A neighbour has a request! Tap the bubble over their home.")); } }
    const askTags = closeUp ? "" : s.asks.list.map((a, i) => {
      const idx = homes.indexOf(a.home);
      if (idx < 0) return "";
      const done = askDone(s, a);
      return `<button type="button" class="tag bub ask${done ? " done" : ""}" data-tag="ask-${i}" data-i="${-100 - idx}" data-h="-1" aria-label="${esc(t("A neighbour's request"))}"><span class="tag-ico">${done ? "✓" : "💬"}</span></button>`;
    }).join("");
    this.labelsDirty = true;
    // The City Hall: Mayor Pip's story, with what this chapter needs (a "!" when a chapter
    // is ready to finish).
    const ci = chapterIndex(s), ch = CHAPTERS[ci], ready = !!ch && chapterReady(s);
    const hallTag = ch && !closeUp ? `<button type="button" class="tag bub hall-bub${ready ? " ready" : ""}" data-tag="hall" data-i="-4" data-h="-1" aria-label="${esc(ready ? t("Upgrade ready!") : t("City Hall · Lv {n}", { n: hallLevel(s) }))}">${ready ? `<span class="badge grow">↑</span>` : ""}<span class="tag-ico">${iconSvg("building")}<i class="tag-lv">${esc(fmt(hallLevel(s)))}</i></span></button>` : "";
    // Only one business says "Open" in red at a time: the one to open next (the cheapest
    // waiting; the tapped one if the player picked another). The rest wait as small grey "+",
    // so a new player knows where to begin.
    let nextOpen = "", nextPrice = Infinity;
    BUSINESSES.forEach((b, i) => { if (levelOf(s, b.id) === 0 && unlockedBusiness(s, i) && costOf(b, 0, 1) < nextPrice) { nextPrice = costOf(b, 0, 1); nextOpen = b.id; } });
    if (this.selected && levelOf(s, this.selected) === 0) nextOpen = this.selected;
    if (this.bottleOn() && !this.bottleTold) { this.bottleTold = true; toast(t("🍾 Something washed up on the beach!")); }
    if (!this.bottleOn()) this.bottleTold = false;
    const bottleTag = !closeUp && this.bottleOn() ? `<button type="button" class="tag bub bottle" data-tag="bottle" data-i="-5" data-h="0.55" aria-label="${esc(t("A message in a bottle"))}"><span class="tag-ico"><svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><g transform="rotate(-35 16 16)"><rect x="13" y="2" width="6" height="5" rx="1.5" fill="#a0683a"/><path d="M13.5 7h5v3.5c3 1.4 4.5 3.6 4.5 6.5v10.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 9 27.5V17c0-2.9 1.5-5.1 4.5-6.5z" fill="#5fd0a0" stroke="#1f7a5a" stroke-width="1.4"/><rect x="11.5" y="16" width="9" height="9" rx="1" fill="#f6ecd0" stroke="#c8a870" stroke-width="0.8"/><path d="M13 19h6M13 21.5h5" stroke="#b08850" stroke-width="0.9"/><path d="M11.5 13.5c1-1.2 2-1.8 3-2" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/></g></svg></span></button>` : "";
    // A little timer over everything being built (the time counts down in placeTags).
    const buildTags = closeUp ? "" : (s.tycoon.builds ?? []).filter(j => j.end > now && j.kind !== "land").map(j => {
      const at = j.kind === "home" ? (homes.indexOf(j.id) >= 0 ? -100 - homes.indexOf(j.id) : null)
        : j.kind === "hq" ? BUSINESSES.findIndex(b => b.id === j.id)
        : j.kind === "project" ? (j.id === "flowers" ? -2 : -3) : -1;
      if (at === null || at === -1 && !s.cafe.starter && j.kind !== "terrace") return "";
      return `<button type="button" class="tag bub build-tm" data-tag="build-${esc(j.kind)}" data-i="${at}" data-h="-1" data-end="${j.end}" aria-label="${esc(t("Builders at work"))}"><span class="tag-ico">🔨</span><b class="tm-t">${esc(fmtLeft(j.end - now))}</b></button>`;
    }).join("");
    // A resident walking in the street, saying something (tap: a little tip).
    const talkTag = !closeUp && this.talk && this.talk.until > now ? `<button type="button" class="tag bub talk" data-tag="talk" data-i="-6" data-h="0.75"><b>${esc(this.talk.text)}</b></button>` : "";
    this.put($("tcy-labels"), bottleTag + hallTag + starterTag + landTag + buildTags + talkTag + propTags + askTags + (closeUp ? "" : blockTags) + BUSINESSES.map((b, i) => {
      if (closeUp && b.id !== "coffee") return "";
      const lv = levelOf(s, b.id), owned = lv > 0, open = unlockedBusiness(s, i);
      // (The next business waiting for the City Hall: a lock with the level it needs.)
      if (!owned && !open && !b.land && hallLocked(s, b.id) && shownBusiness(s, i)) return `<button type="button" class="tag bub lease hall-lock" data-tag="${b.id}" data-i="${i}" data-h="-1" aria-label="${esc(t("City Hall level {n}", { n: hallNeed(b.id) }))}"><span class="tag-ico">🔒<i class="tag-lv">${esc(t("Lv {n}", { n: hallNeed(b.id) }))}</i></span></button>`;
      if (!owned && !open) return "";
      if (!owned && b.id !== nextOpen) return `<button type="button" class="tag bub lease later" data-tag="${b.id}" data-i="${i}" data-h="-1" aria-label="${esc(t("For lease"))}"><span class="tag-ico">+</span></button>`;
      if (!owned) return `<button type="button" class="tag bub lease${this.selected === b.id ? " sel" : ""}" data-tag="${b.id}" data-i="${i}" data-h="-1"><span class="tag-ico">+<i class="tag-lv">${esc(coins(costOf(b, 0, 1)))}</i></span>${this.selected === b.id ? `<b>${esc(t("Open"))}</b>` : ""}</button>`;
      const st = stageNow(s, b.id), grow = readyStage(s, b.id), sel = this.selected === b.id;
      // At most one badge: what needs you most.
      const badge = live.golden === b.id ? `<span class="badge golden" data-act="golden">✨</span>`
        : live.vip === b.id ? `<span class="badge vip" data-act="vip">VIP</span>`
        : live.critic === b.id ? `<span class="badge critic" data-act="critic">★</span>`
        : live.power === b.id ? `<span class="badge power" data-act="power">!</span>`
        : grow ? `<span class="badge grow">↑</span>`
        : live.rush === b.id ? `<span class="badge rush">×${RUSH_MULT}</span>` : "";
      // A round icon bubble whose ring fills as the building works; its name shows once tapped.
      return `<button type="button" class="tag bub${sel ? " sel" : ""}${live.rush === b.id ? " rushing" : ""}" data-tag="${b.id}" data-i="${i}" data-h="-1" style="--b1:${b.color[0]};--b2:${b.color[1]}">
        ${badge}<span class="tag-ico">${iconSvg(b.icon)}<i class="tag-lv">${esc(fmt(lv))}</i></span>${sel ? `<b>${esc(t(stageName(b.id, st)))}</b>` : ""}<span class="tag-pops"></span>
      </button>`;
    }).join(""));
    // (Rebuilt bubbles go straight to their buildings, so none flashes in the corner.)
    if (this.labelsDirty) { this.labelsDirty = false; this.placeTags(); }
    // The next step.
    const n = this.nextStep();
    this.nextAct = n.act;
    const first = this.firstDay();
    this.put($("tcy-next"), `<span class="next-ico">${n.tone === "learn" ? COACH_FACE : n.tone === "gift" ? "🎁" : n.tone === "hot" ? "⚡" : n.tone === "grow" ? "🏗️" : n.tone === "save" ? "💰" : "✨"}</span>
      <span class="next-txt"><small>${first ? `${esc(t("First day in Skyhaven · {n} of {total}", { n: first.done, total: first.steps.length }))}<span class="first-dots">${first.steps.map(f => `<i class="${f.ok ? "ok" : ""}" title="${esc(f.label)}"></i>`).join("")}</span>` : this.planLabel()}</small><b>${esc(n.text)}</b><em>${esc(n.sub)}</em>${n.pct !== undefined ? `<i class="next-bar"><i style="width:${(n.pct * 100).toFixed(0)}%"></i></i>` : ""}</span><span class="next-go" aria-hidden="true"></span>`);
    $("tcy-next").className = `tcy-next tone-${n.tone}`;
    // (Hidden while the neighbor arrives: the Skip button sits there.)
    $("tcy-next").hidden = !!this.selected || !!this.selectedProp || !!this.selectedSight || this.story.stage === "arrive";
    this.renderCard(now);
    // Dots on the bar: only for something you can act on.
    const dot = (k: string, on: boolean) => { $("tcy-bar").querySelector<HTMLElement>(`[data-open="${k}"] .dot`)!.hidden = !on; };
    const lit = (id: string) => !!document.querySelector(`#${id}:not([hidden]) .dot:not([hidden])`);
    dot("shop", lit("shop-btn"));
    dot("company", !!$("tycoon").querySelector(".ty-tabs .dot:not([hidden])"));
    // Red dots mean "something to collect right now", never "you could buy something".
    dot("build", false);
    dot("goals", (HAS_CITY && (eventReady(s).length > 0 || spReady(s) > 0)) || (spinOpen(s, HAS_CITY) && spinFree(s)) || (!HAS_CITY && !!this.spire && spireReady(s.spire, this.spire) > 0) || (!HAS_CITY && lit("missions-btn")) || (!HAS_CITY && lit("pass-btn")) || ($("mayor-strip").classList.contains("ready") && !$("mayor-strip").hidden));
    dot("me", lit("ranks-btn") || lit("city-btn") || lit("level-btn") || (HAS_CITY && bookReady(s).length > 0));
    this.unlockTabs();
  }

  /** A new player's bar starts with BUILD alone; the rest appear as they're needed: Company
   *  after the first sale, Goals once the first steps are done, Shop and Me after the third
   *  tower. Each new tab pops in with a note (not on launch: then it's just there). */
  private barReady = false;
  private unlockTabs(): void {
    const s = this.save, tw = s.profile.towers, tips = s.tycoon.tips;
    // (The city game has no towers: Shop and Me open with the City Hall's first level-up.)
    const later = HAS_CITY ? (s.chapters?.done ?? 0) >= 1 : tw >= 3;
    const open: Record<string, boolean> = { company: tips >= 1 || tw >= 3, goals: tips >= 3 || tw >= 3, shop: later, me: later, build: true };
    const names: Record<string, string> = { company: "Company", goals: "Goals", shop: "Shop", me: "Me" };
    let n = 0;
    for (const btn of $("tcy-bar").querySelectorAll<HTMLElement>("[data-open]")) {
      const k = btn.dataset.open!, on = open[k] ?? true;
      if (on) n++;
      if (btn.hidden === !on) continue;
      btn.hidden = !on;
      const key = `tab-${k}`;
      if (on && k !== "build" && !s.seenFeatures.includes(key)) {
        s.seenFeatures.push(key);
        this.host.persist();
        if (this.barReady) {
          // Not over the first sale and the neighbor's request: it waits until their bubble is gone.
          const msg = t("New: {name} unlocked!", { name: t(names[k]) });
          const wait = this.story.saleAt ? Math.max(0, this.story.saleAt + 8200 - Date.now()) : 0;
          if (wait) window.setTimeout(() => { replayPop(btn); toast(msg); }, wait);
          else { replayPop(btn); toast(msg); }
        }
      }
    }
    $("tcy-bar").style.setProperty("--tabs", String(n));
    // (Always in view: the player should always see how many crystals they have.)
    $("tcy-gems").hidden = false;
    this.barReady = true;
  }

  /** The guide's pointing hand for a new player: on the Coffee Cart for the first sale, then
   *  on the Next step card, until the first steps are done. */
  private guideHand(): void {
    let hand = document.getElementById("guide-hand");
    const s = this.save, tw = s.profile.towers, tips = s.tycoon.tips;
    const busy = !this.inCity || !$("mayor").hidden || !$("welcome").hidden || !!openModalEl() || !!document.querySelector("#evolve:not([hidden])") || (this.frameUntil > Date.now() && tips > 0);
    let target: Element | null = null;
    const onTheirWay = ["arrive", "home", "toCart"].includes(this.story.stage);
    if (!busy && !onTheirWay && (tips < 3 || tw < 3)) {
      if (tips === 0) target = document.querySelector('.tag[data-tag="coffee"]');
      else if ($("tcy-card").hidden && !$("tcy-next").hidden) target = $("tcy-next");
    }
    if (!target) { if (hand) hand.hidden = true; return; }
    if (!hand) {
      hand = document.createElement("div");
      hand.id = "guide-hand";
      hand.setAttribute("aria-hidden", "true");
      hand.textContent = "👇";
      document.body.appendChild(hand);
    }
    const r = target.getBoundingClientRect();
    const x = target.id === "tcy-next" ? r.right - 44 : r.left + r.width / 2;
    hand.style.left = `${Math.round(x)}px`;
    // (The hand sits above its target, but never over the money bar.)
    hand.style.top = `${Math.round(Math.max(r.top - 6, this.hudBottom() + 44))}px`;
    hand.hidden = false;
  }

  /** The bottom edge of the money bar and whatever hangs under it (the City Hall badge),
   *  measured on screen: guide bubbles stay below it. */
  private hudBottom(): number {
    let y = 0;
    const top = $("tcy-top");
    for (const el of [top, ...top.children]) y = Math.max(y, el.getBoundingClientRect().bottom);
    return y;
  }

  /** Keeps each tag floating over its building as the camera moves. */
  private tagSize = new WeakMap<HTMLElement, { w: number; h: number }>();
  /** How far each bubble is lifted out of the way of the ones in front (eased). */
  private tagLift = new WeakMap<HTMLElement, number>();
  private placeTags(): void {
    // (All reads first, then all writes: reading a size after moving a tag would make the
    // browser lay the page out again for every tag, every frame, which is what made dragging
    // the town feel heavy.)
    const items: { tag: HTMLElement; x: number; y: number; base: number; w: number; h: number }[] = [], hide: HTMLElement[] = [];
    for (const tag of $("tcy-labels").querySelectorAll<HTMLElement>(".tag")) {
      const p = this.host.bizScreen(Number(tag.dataset.i), Number(tag.dataset.h));
      if (!p) { hide.push(tag); continue; }
      // (A bubble's size is measured once, when it's made or changes, not every frame.)
      let sz = this.tagSize.get(tag);
      // (New content means new bubble elements, so the cache can't go stale.)
      if (!sz || !sz.w) { sz = { w: tag.offsetWidth, h: tag.offsetHeight + 6 }; if (sz.w) this.tagSize.set(tag, sz); else sz = { w: 44, h: 46 }; }
      items.push({ tag, x: p.top[0], y: p.top[1], base: p.base[1], w: sz.w, h: sz.h });
    }
    for (const tag of hide) if (tag.style.visibility !== "hidden") tag.style.visibility = "hidden";
    // (The money bar's bottom edge, measured: on a small phone it reaches further down, and no
    // bubble may sit on it.)
    const hudBottom = Math.max(118, this.hudBottom() + 8);
    const nowMs = Date.now();
    for (const it of items) {
      const end = it.tag.dataset.end;
      if (!end) continue;
      const tx = it.tag.querySelector<HTMLElement>(".tm-t"), v = fmtLeft(Math.max(0, Number(end) - nowMs));
      if (tx && tx.textContent !== v) tx.textContent = v;
    }
    // With a building's card open, only its own bubble stays: the rest step aside, so
    // nothing piles up round the building the camera is looking at.
    const focus = !!(this.selected || this.selectedProp || this.selectedSight);
    for (const it of items) it.tag.classList.toggle("tag-off", focus && !it.tag.classList.contains("sel"));
    // Front buildings keep their spot; a bubble that would sit on another moves up a little.
    items.sort((a, b) => b.base - a.base);
    // (Spaced by each bubble's own height, so the small pins stack close, not in a tall column.)
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const it of items) {
      const w = it.w, h = it.h;
      // (Bubbles that stepped aside don't push the others around, but still follow their
      // building, so they come back in the right place.)
      const off = focus && it.tag.classList.contains("tag-off");
      const y0 = it.y;
      for (let guard = 0; guard < 6 && !off; guard++) {
        const hit = placed.find(o => Math.abs(o.x - it.x) < (o.w + w) / 2 - 2 && Math.abs(o.y - it.y) < (o.h + h) / 2 - 2);
        if (!hit) break;
        it.y = hit.y - (hit.h + h) / 2;
      }
      // (A bubble lifted out of another's way glides there instead of jumping, and doesn't
      // flick back and forth while the camera moves and the two only just touch.)
      const want = it.y - y0, had = this.tagLift.get(it.tag) ?? want;
      const lift = Math.abs(want - had) < 3 ? had : had + (want - had) * 0.25;
      this.tagLift.set(it.tag, lift);
      it.y = y0 + lift;
      if (!off) placed.push({ x: it.x, y: y0 + want, w, h });
      // (The land-for-sale bubble always stays on screen, so it can be found and tapped.)
      // (Every bubble stays on screen; the island-for-sale one also stays clear of the bars.)
      const keep = it.tag.classList.contains("land-sale") || it.tag.classList.contains("sel");
      const outside = it.x < -4 || it.x > window.innerWidth + 4 || it.y - it.h < hudBottom || it.y > window.innerHeight - 178;
      it.tag.classList.toggle("tag-out", !keep && outside);
      { const m = it.w / 2 + 6; it.x = Math.max(m, Math.min(window.innerWidth - m, it.x)); }
      // A bubble that stays (the first building's caption, the selected one) never covers the
      // money bar: it slides down under it, still right over its building.
      if (keep) it.y = Math.max(it.y, hudBottom + it.h);
      if (it.tag.classList.contains("land-sale")) { it.y = Math.max(150, Math.min(window.innerHeight - 230, it.y)); it.tag.style.opacity = this.selected || this.selectedProp || this.selectedSight ? "0" : ""; it.tag.style.pointerEvents = this.selected || this.selectedProp || this.selectedSight ? "none" : ""; }
      const tr = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px) translate(-50%, -100%)`;
      if (it.tag.style.visibility) it.tag.style.visibility = "";
      if (it.tag.style.transform !== tr) it.tag.style.transform = tr;
      // Buildings nearer the front draw their tags on top.
      const zi = it.tag.classList.contains("sel") ? "999" : String(Math.round(it.base));
      if (it.tag.style.zIndex !== zi) it.tag.style.zIndex = zi;
    }
  }

  /** A tap in the city: on a tag, or on a building (the nearest one under the finger). */
  /** Look around the town like in the big city builders: drag with one finger to move,
   *  pinch with two (or the mouse wheel) to zoom. A drag never counts as a tap. */
  private dragMoved = 0;
  private wireTownCamera(): void {
    const el = $("tycity"), pts = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number } | null = null, moved = false, pinch = 0, mid: { x: number; y: number } | null = null;
    const ui = (t: EventTarget | null) => !!(t as Element | null)?.closest?.(".tcy-top, .tcy-bar, .tcy-next, .tcy-card, .tcy-events, .tcy-builds, .block-skip, .tcy-coach, #block-say");
    el.addEventListener("pointerdown", e => {
      if (ui(e.target) || !this.inCity) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; moved = true; this.host.bizHold(); }
    });
    el.addEventListener("pointermove", e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size >= 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinch > 0 && d > 0) this.host.bizZoom(d / pinch);
        // (Two fingers also move the town, like a map.)
        if (mid) this.host.bizPan(m.x - mid.x, m.y - mid.y);
        pinch = d; mid = m;
        return;
      }
      if (!moved && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 9) return;
      if (!moved) { moved = true; document.body.classList.add("town-panning"); this.selected = ""; this.render(); }
      this.host.bizPan(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size < 2) { pinch = 0; mid = null; }
      // (One finger left after a pinch: carry on dragging from where it is.)
      if (pts.size === 1) { const [q] = [...pts.values()]; start = q; }
      if (pts.size === 0) { this.host.bizPanEnd(); document.body.classList.remove("town-panning"); if (moved) this.dragMoved = Date.now(); }
    };
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, e => end(e as PointerEvent));
    el.addEventListener("wheel", e => { if (!this.inCity || ui(e.target)) return; e.preventDefault(); this.host.bizZoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    // The tap that ends a drag isn't a tap.
    el.addEventListener("click", e => { if (Date.now() - this.dragMoved < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  private onCityTap(e: MouseEvent): void {
    this.lastTapAt = Date.now();
    // (Visiting a friend's town: just looking, nothing of ours to tap.)
    if (document.body.classList.contains("visiting-town")) return;
    const target = e.target as Element;
    if (target.closest(".tcy-top, .tcy-bar, .tcy-card, .tcy-next, .tcy-builds")) return;
    const act = target.closest<HTMLElement>("[data-act]"), tag = target.closest<HTMLElement>(".tag");
    let id = tag?.dataset.tag ?? "";
    if (id.startsWith("proj-")) {
      const pid = id.slice(5) as ProjectId;
      if (this.save.cafe.done.includes(pid)) toast(pid === "flowers" ? t("🌷 The flower market opens in your block!") : t("🛝 The playground opens in your block!"));
      else this.openBuild();
      return;
    }
    if (id.startsWith("land-")) { this.openLand(); return; }
    if (id === "talk") {
      const tip = Math.max(1, perSecond(this.save, Date.now(), false) * 3);
      earn(this.save, tip);
      this.talk = null;
      this.host.sound.coins(); vibrate(this.save.settings.vibrate, 6);
      toast(t("😊 They tipped you {n} for the lovely city!", { n: coins(tip) }));
      this.goal("talk");
      this.host.persist(); this.render();
      return;
    }
    if (id.startsWith("build-")) { this.host.sound.click(); $("tcy-builds").click(); return; }
    if (id === "hall") { this.selected = ""; this.selectedProp = ""; this.selectedSight = ""; this.render(); this.host.openStory(); return; }
    if (id === "bottle") { this.collectBottle(); return; }
    if (id.startsWith("prop-")) { this.selectProp(id.slice(5)); return; }
    if (id.startsWith("ask-")) { this.openAsk(Number(id.slice(4))); return; }
    if (id === "starter") {
      const st = this.save.cafe.starter;
      if (st) toast(HAS_CITY && this.save.profile.towers === 0 ? t("Your first apartment building: your neighbor lives here") : tn(st.f, "Your first tower: {n} floor", "Your first tower: {n} floors", { n: st.f }));
      return;
    }
    // Not on a bubble: the nearest building under the finger, whatever it is (a business,
    // a home or block, a park or a landmark), so no building is ever hard to tap.
    if (!id) {
      let best = 60, pick: (() => void) | null = null;
      const near = (i: number, bias: number, then: () => void) => {
        const p = this.host.bizScreen(i, -1);
        if (!p) return;
        const d = distToSeg(e.clientX, e.clientY, p.base, p.top) + bias;
        if (d < best) { best = d; pick = then; }
      };
      BUSINESSES.forEach((b, i) => {
        if (levelOf(this.save, b.id) === 0 && !unlockedBusiness(this.save, i)) return;
        near(i, -6, () => { id = b.id; });
      });
      const open = propsOpen(this.save);
      this.host.bizHomes().forEach((k, idx) => near(-100 - idx, 0, open ? () => this.selectProp(k) : () => this.selectSight("h:" + k, isLot(k) ? "lot" : "home")));
      this.host.bizSights().forEach((sg, k) => near(-1000 - k, 4, () => this.selectSight(sg.key, sg.kind)));
      const got = pick as (() => void) | null;
      if (got) { got(); if (!id) return; }
    }
    // Tapping empty sky or grass closes the card.
    if (!id) { if (this.selectedSight) { this.selectedSight = ""; this.render(); } if (this.selectedProp) { this.selectedProp = ""; this.selectedSight = ""; this.render(); } if (this.selected) { this.selected = ""; this.render(); } return; }
    const s = this.save, owned = levelOf(s, id) > 0, pop = tag?.querySelector(".tag-pops") ?? $("tcy-labels");
    // The very first sale: one tap on the cart sells (no card in the way of the guide).
    if (owned && !act && s.tycoon.tips === 0 && id === BUSINESSES[0].id) { this.doAct("run", id, tag ?? $("tcy-labels"), e, pop, tag ?? $("tcy-labels")); return; }
    if (act && owned) this.doAct(act.dataset.act!, id, act, e, pop, tag ?? $("tcy-labels"));
    // Tapping the selected building (with no manager yet) sells.
    else if (owned && this.selected === id && !s.tycoon.managers.includes(id)) this.doAct("run", id, tag ?? $("tcy-labels"), null, pop, tag ?? $("tcy-labels"));
    this.selectedProp = ""; this.selectedSight = "";
    if (this.selected !== id) { this.selected = id; this.host.sound.click(); vibrate(s.settings.vibrate, 6); }
    this.render();
  }

  /** The card for the selected building: one big main button, a few small ones. */
  private holdingCard = false;
  /** Opens a property's card (and closes any business card). */
  private selectProp(key: string): void {
    // Moving a decoration: the lot tapped next is where it goes.
    if (this.movingDecor) {
      const id = this.movingDecor, it = placeItem(id);
      if (lotFree(this.save, key) && movePlace(this.save, id, key)) {
        this.movingDecor = "";
        this.host.sound.purchase(); vibrate(this.save.settings.vibrate, 12);
        toast(t("{icon} {name} moved!", { icon: it?.icon ?? "", name: t(it?.name ?? "") }));
        this.goal("decor");
        this.host.persist();
      } else if (placedOn(this.save, key)?.id !== id) { toast(t("Pick an empty lot (no building on it)")); return; }
      else this.movingDecor = "";
    }
    this.selected = "";
    this.selectedProp = key;
    this.host.sound.click();
    this.render();
  }

  /** Opens a sight's card: what this building or place is. */
  private selectSight(key: string, kind: string): void {
    this.selected = "";
    this.selectedProp = "";
    this.selectedSight = key;
    this.sightKind = kind;
    this.host.sound.click();
    vibrate(this.save.settings.vibrate, 6);
    track("sight_tapped", { kind }, false);
    this.albumAdd(kind);
    this.render();
  }

  /** A sight's card, like the big city builders: a name, what it is, and a fact or two. */
  private renderSightCard(): void {
    const card = $("tcy-card"), info = sightInfo(this.sightKind);
    if (!info) { card.hidden = true; return; }
    const stat = (label: string, value: string) => `<span class="card-stat"><small>${esc(label)}</small><b>${esc(value)}</b></span>`;
    const lv = info.level ?? 0;
    const stars = lv ? `<span class="card-stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= lv ? "on" : ""}"></i>`).join("")}</span>` : "";
    const rank = t(RANKS[townRank(this.save)].name);
    const stats = lv
      ? stat(t("Level"), `${lv}/5`) + stat(t("People"), fmt(SIGHT_PEOPLE[lv]))
      : stat(t("City"), rank);
    const where = this.sightKind.startsWith("th-") ? t("A district sight") : this.sightKind.startsWith("rank") ? t("A landmark of Skyhaven") : t("Part of Skyhaven");
    card.hidden = false;
    this.put(card, `<div class="card-head" style="--b1:#9be7c4;--b2:#4fb38b">
        <span class="card-ico">${info.icon}</span>
        <span class="card-name"><b>${esc(t(info.name))}</b><small>${stars} ${esc(where)}</small></span>
        <button type="button" class="card-x" data-card="close" aria-label="${esc(t("Close"))}">×</button>
      </div>
      <div class="card-stats">${stats}</div>
      <p class="card-info">${esc(t(info.text))}</p>
      ${lv ? `<p class="card-perk">📈 ${esc(t("Buildings grow taller as Skyhaven's rank rises."))}</p>` : ""}`);
  }

  /** A decoration being moved: the next empty lot tapped is where it goes. */
  private movingDecor = "";
  /** Choose a decoration for an empty lot: the ones put away (free), then the shop. */
  private openDecorate(lot: string): void {
    const s = this.save, hall = hallLevel(s);
    const opts = PLACE_ITEMS.map(it => {
      const owned = it.id in s.placed, standing = owned && !!s.placed[it.id];
      const locked = !owned && hall < it.hall, short = !owned && s.tycoon.coins < it.cash;
      const sub = standing ? t("Already in your city: tap to move it here")
        : owned ? t("Yours: place it for free")
        : locked ? t("Opens at City Hall Lv {n}", { n: it.hall })
        : `${coins(it.cash)} · ${t("+{pct}% earnings", { pct: +(it.bonus * 100).toFixed(1) })}${short ? ` · ${t("not enough cash yet")}` : ""}`;
      return { label: `${it.icon} ${t(it.name)}`, sub, onPick: () => {
        const r = owned ? (movePlace(s, it.id, lot) ? "ok" : "taken") : buyPlace(s, it.id, lot);
        if (r === "ok") {
          this.host.sound.purchase(); confetti(); vibrate(s.settings.vibrate, [15, 30, 15]);
          toast(t("{icon} {name} placed! Every business earns +{pct}%", { icon: it.icon, name: t(it.name), pct: +(it.bonus * 100).toFixed(1) }));
          track("decor_placed", { id: it.id, bought: !owned }, false);
          this.goal("decor");
          this.selectedProp = ""; this.host.persist(); this.render();
        } else toast(r === "hall" ? t("Opens at City Hall Lv {n}", { n: it.hall }) : r === "short" ? t("Not enough cash yet") : t("Pick an empty lot (no building on it)"));
      } };
    });
    mayorChoice(t("Decorate this lot"), t("Place something people love to visit. Every decoration makes all your businesses earn more, and you can move it any time."), opts, t("Not now"));
  }

  /** A property's card: what it is, who lives there, what it pays, and the upgrade. */
  private renderPropCard(now: number): void {
    const card = $("tcy-card"), s = this.save, key = this.selectedProp, lv = propLevel(s, key), job = buildOf(s, "home", key);
    const max = lv >= PROP_MAX, why = job ? "" : propBlock(s, key), price = max ? 0 : propPrice(s, key, now), can = !why && s.tycoon.coins >= price;
    const rent = propRent(s, key, now), next = max ? 0 : propRent(s, key, now, lv + 1) - rent;
    const streets = ["Maple", "Oak", "Cedar", "Willow", "Harbor", "Sunset", "Cloud", "Rose", "Birch", "Lake"];
    let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const name = t("{street} Street {n}", { street: t(streets[h % streets.length]), n: 1 + (h % 40) });
    const stars = `<span class="card-stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= lv ? "on" : ""}"></i>`).join("")}</span>`;
    const stat = (label: string, value: string, tone = "") => `<span class="card-stat ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b></span>`;
    const lot = lv === 0, need = propHallNeed(s, key);
    // What it's for: every building has a job in the town.
    const purpose = lot
      ? t("Build Little homes here. {n} people move in: they shop at your businesses and pay you rent.", { n: fmt(PROP_PEOPLE[1]) })
      : t("{n} people live and work here. They are your customers: each level makes every business earn +{pct}%, and they pay rent.", { n: fmt(PROP_PEOPLE[lv]), pct: Math.round(PROP_BONUS * 100) });
    const info = max ? t("Fully grown! A glass skyscraper, and all of it yours.")
      : why === "hall" ? (lot ? t("City Hall Lv {n} lets you build on {m} lots. Level up City Hall to build here.", { n: need - 1, m: lotsAllowed(s) }) : t("{tier} opens at City Hall Lv {n}.", { tier: t(PROP_TIERS[lv + 1]), n: need }))
      : lot ? t("Lots built: {a} of {b}.", { a: lotsBuilt(s), b: lotsAllowed(s) })
      : t("Upgrade it into a bigger building: {tier}. More people move in and pay rent: +{n}/s.", { tier: t(PROP_TIERS[lv + 1]), n: coins(next) });
    const verb = lot ? t("Build") : t("Upgrade");
    const deco = lot ? placedOn(s, key) : undefined;
    if (deco) {
      card.hidden = false;
      this.put(card, `<div class="card-head" style="--b1:#ffd98a;--b2:#ff9a5c">
          <span class="card-ico">${deco.icon}</span>
          <span class="card-name"><b>${esc(t(deco.name))}</b><small>${esc(t("Your decoration"))}</small></span>
          <button type="button" class="card-x" data-card="close" aria-label="${esc(t("Close"))}">×</button>
        </div>
        <p class="card-perk">✨ ${esc(t("Every business earns +{pct}% while it stands in your city.", { pct: +(deco.bonus * 100).toFixed(1) }))}</p>
        <p class="card-info">${esc(t(deco.text))}</p>
        <div class="card-acts">
          <button type="button" class="card-main" data-card="dmove"><b>${esc(t("Move it"))}</b><small>${esc(t("Then tap any empty lot"))}</small></button>
          <button type="button" class="card-small" data-card="dstore">${esc(t("Put away"))}</button>
        </div>`);
      return;
    }
    card.hidden = false;
    this.put(card, `<div class="card-head" style="--b1:${lot ? "#bfe6a0" : "#7ad3ff"};--b2:${lot ? "#5fb36a" : "#4f8bff"}">
        <span class="card-ico">${lot ? "🏡" : "🏠"}</span>
        <span class="card-name"><b>${esc(name)}</b><small>${lot ? "" : stars} ${esc(t(PROP_TIERS[lv]))}</small></span>
        <button type="button" class="card-x" data-card="close" aria-label="${esc(t("Close"))}">×</button>
      </div>
      <div class="card-stats">
        ${stat(t("Pays rent"), lv > 1 ? t("{n}/s", { n: coins(rent) }) : "—", "money")}
        ${stat(t("Level"), `${lv}/${PROP_MAX}`)}
        ${stat(t("People"), fmt(PROP_PEOPLE[lv]))}
      </div>
      <p class="card-perk">🛍️ ${esc(purpose)}</p>
      <p class="card-info">${esc(info)}</p>
      <div class="card-acts">
        ${max ? "" : job ? `<button type="button" class="card-main building" data-card="pup"><b>🔨 ${esc(fmtLeft(job.end - now))}</b><small>${esc(t("Finish now"))} · 💎${finishPrice(job.end - now)}</small></button>`
          : why === "hall" ? `<button type="button" class="card-main short" data-card="hallgo"><b>🔒 ${esc(t("City Hall Lv {n}", { n: need }))}</b><small>${esc(t("See City Hall goals"))}</small></button>`
          : `<button type="button" class="card-main${can ? "" : " short"}" data-card="pup"><b>${esc(verb)} · ⏱ ${esc(fmtLeft(buildTime(s, "home", key, now)))}</b><small>${COIN_SVG}${esc(coins(price))}</small></button>`}
        ${lot && HAS_CITY && !job ? `<button type="button" class="card-small" data-card="decorate">🌳 ${esc(t("Decorate"))}</button>` : ""}
      </div>`);
  }

  /** When the card switches to another building, its content slides in afresh. */
  private cardFor(subject: string): void {
    const card = $("tcy-card");
    if (card.dataset.for === subject) return;
    card.dataset.for = subject;
    card.classList.remove("card-swap");
    void card.offsetWidth;
    card.classList.add("card-swap");
    // (Only once: the card's numbers redraw it every moment, and new content must not
    // replay the slide-in, or the card flickers.)
    clearTimeout(this.swapTimer);
    this.swapTimer = window.setTimeout(() => card.classList.remove("card-swap"), 320);
  }
  private swapTimer = 0;

  private renderCard(now: number): void {
    if (this.holdingCard) return;
    if (this.selectedSight && !this.selected) { this.renderSightCard(); this.cardFor("s:" + this.selectedSight); return; }
    if (this.selectedProp && !this.selected) { this.renderPropCard(now); this.cardFor("p:" + this.selectedProp); return; }
    if (this.selected) this.cardFor("b:" + this.selected); else $("tcy-card").dataset.for = "";
    const card = $("tcy-card"), s = this.save, ty = s.tycoon;
    const i = BUSINESSES.findIndex(b => b.id === this.selected);
    card.hidden = i < 0;
    if (i < 0) return;
    const b = BUSINESSES[i], lv = levelOf(s, b.id), owned = lv > 0;
    const st = owned ? stageNow(s, b.id) : 0, grow = owned ? readyStage(s, b.id) : 0, managed = ty.managers.includes(b.id);
    const room = Math.max(1, freeFloors(s)), noRoom = freeFloors(s) < 1;
    const n = !owned ? 1 : Math.min(room, this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
    const price = costOf(b, lv, n), canBuy = price <= ty.coins && !noRoom;
    const ns = owned ? STAGE_AT[st + 1] : undefined;
    const amountLabel = this.amount === "max" ? "MAX" : `×${this.amount}`;
    const perLv0 = owned ? payOf(s, b, now) / lv : 0;
    const pay = payOf(s, b, now), cyc = cycleOf(b, Math.max(1, lv));
    const secs = (x: number) => (x >= 60 ? t("{n} min", { n: fmt(Math.round(x / 6) / 10) }) : t("{n} s", { n: x >= 10 ? Math.round(x) : Math.round(x * 10) / 10 }));
    const nm = owned ? nextMilestone(lv) : undefined, prevM = owned ? [0, ...MILESTONES_AT].filter(m => m <= lv).pop() ?? 0 : 0;
    const stars = `<span class="card-stars" aria-label="${esc(t("Stage {n} of 8", { n: st + 1 }))}">${STAGE_AT.map((_, k) => `<i class="${k <= st ? "on" : ""}"></i>`).join("")}</span>`;
    const bar = (k: number) => `<i class="bc-bar"><i style="width:${Math.round(Math.max(0.03, Math.min(1, k)) * 100)}%"></i></i>`;
    // The one thing coming next: the nearer of a speed-up and the next stage.
    const toStage = !grow && ns ? ns - lv : Infinity, toSpeed = nm ? nm - lv : Infinity;
    const next = !owned ? "" : grow ? "" : toStage <= toSpeed && ns
      ? `<div class="bc-next"><span class="bc-next-ico">🏗️</span><span class="bc-next-txt"><b>${esc(t("Level {n}: it grows into {name}", { n: fmt(ns), name: t(stageName(b.id, st + 1)) }))}</b>${bar((lv - (STAGE_AT[st] ?? 0)) / Math.max(1, ns - (STAGE_AT[st] ?? 0)))}</span></div>`
      : nm ? `<div class="bc-next"><span class="bc-next-ico">⚡</span><span class="bc-next-txt"><b>${esc(t("Level {n}: it sells twice as fast", { n: fmt(nm) }))}</b>${bar((lv - prevM) / Math.max(1, nm - prevM))}</span></div>` : "";
    // Buying: how many (one tap each), and the big button with what it adds.
    const amts = ([1, 10, 100, "max"] as const).map(a => `<button type="button" data-card="amt" data-n="${a}" aria-pressed="${this.amount === a}">${a === "max" ? "MAX" : "×" + a}</button>`).join("");
    const lockedHall = !owned && hallLocked(s, b.id);
    const main = lockedHall ? `<button type="button" class="card-main hall-lock" data-card="hall"><b>🔒 ${esc(t("City Hall level {n}", { n: hallNeed(b.id) }))}</b><small>${esc(t("Grow the City Hall to open it"))}</small></button>`
      : noRoom ? `<button type="button" class="card-main floors" data-card="build"><b>${esc(t("Build more floors"))}</b><small>${esc(t("Your offices are full"))}</small></button>`
      : `<button type="button" class="card-main${canBuy ? "" : " short"}" data-card="buy"><b>${esc(owned ? t("Buy {n}", { n: amountLabel }) : t("Open it"))}</b><small>${COIN_SVG}${esc(coins(price))}${owned ? ` · ${esc(t("+{n} a sale", { n: coins(perLv0 * n) }))}` : ""}</small></button>`;
    // The big tiles: sell, the manager, growing, every business.
    const tile = (card: string, ico: string, title: string, sub: string, cls = "", extra = "") => `<button type="button" class="bc-tile ${cls}" data-card="${card}"><span class="bc-tile-ico">${ico}</span><b>${esc(title)}</b><small>${esc(sub)}</small>${extra}</button>`;
    const hqJob = HAS_CITY && grow ? buildOf(s, "hq", b.id) : null;
    const tiles = !owned ? "" : [
      managed ? tile("look", "👔", t("Managed"), t("Earns while you're away"), "done")
        : tile("hire", "👔", t("Manager"), coins(b.manager), ty.coins >= b.manager ? "go" : "", ty.coins >= b.manager ? "" : bar(ty.coins / b.manager)),
      !managed ? tile("run", "👆", t("Sell now"), t("+{n}", { n: coins(pay) }), "sell") : "",
      grow ? (hqJob ? tile("hq", "🔨", t("Building"), fmtLeft(hqJob.end - now), "grow")
        : tile("hq", "🏗️", t("Grow it!"), HAS_CITY ? coins(hqPrice(s, b.id)) : t("{n} floors", { n: hqFloors(grow) }), "grow", HAS_CITY ? `<small>⏱ ${esc(fmtLeft(buildTime(s, "hq", b.id, now)))}</small>` : "")) : "",
      HAS_CITY ? tile("look", "👀", t("Look inside"), t("See it at work"), "all") : tile("look", "📋", t("All"), t("businesses"), "all"),
    ].filter(Boolean).join("");
    const lease = !owned ? `<p class="bc-lease">${esc(t("A new business: it earns {n} a sale", { n: coins(b.income * multiplier(s, now)) }))}</p>` : "";
    const growNote = grow ? `<p class="bc-grow">✨ ${esc(t("Ready to grow into {name}!", { name: t(stageName(b.id, grow)) }))}</p>` : !ns && owned ? `<p class="bc-grow done">🏆 ${esc(t("Fully grown!"))}</p>` : "";
    const bc = bizColors(s, b.id, b.color as [string, string]);
    this.put(card, `<div class="bc-hero" style="--b1:${bc[0]};--b2:${bc[1]}">
        <span class="bc-ico">${iconSvg(b.icon)}</span>
        <span class="bc-title"><small>${owned ? esc(t(stageName(b.id, st)) === t(b.name) ? t("Stage {n} of 8", { n: st + 1 }) : t(b.name)) : esc(t("For lease"))}</small><b>${esc(t(owned ? stageName(b.id, st) : b.name))}</b>${owned ? stars : ""}</span>
        ${owned ? `<span class="bc-lv"><small>${esc(t("Level"))}</small><b>${esc(fmt(lv))}</b></span>` : ""}
        ${owned && HAS_CITY ? `<button type="button" class="bc-paint" data-card="paint" aria-label="${esc(t("Paint"))}">🎨</button>` : ""}
        <button type="button" class="card-x bc-x" data-card="close" aria-label="${esc(t("Close"))}">×</button>
      </div>
      ${owned ? `<div class="bc-earn">
        <span class="bc-money">${COIN_SVG}<b>${esc(managed ? coins(pay / cyc) : coins(pay))}</b><small>${esc(managed ? t("a second") : t("a sale"))}</small></span>
        <span class="bc-meta">⏱ ${esc(t("every {t}", { t: secs(cyc) }))}</span>
        <i class="card-prog"><i></i></i>
      </div>` : ""}
      ${lease}${growNote}${next}
      ${owned && !noRoom ? `<div class="bc-amt" role="group" aria-label="${esc(t("How many to buy"))}">${amts}</div>` : ""}
      <div class="card-acts">${main}</div>
      ${tiles ? `<div class="bc-tiles">${tiles}</div>` : ""}
      <span class="tag-pops card-pops"></span>`);
  }

  private onCardTap(e: MouseEvent): void {
    const el = (e.target as Element).closest<HTMLElement>("[data-card]");
    if (!el) return;
    e.stopPropagation();
    const id = this.selected, card = $("tcy-card"), what = el.dataset.card!;
    if (what === "close") { this.selected = ""; this.selectedProp = ""; this.selectedSight = ""; this.host.sound.click(); this.render(); return; }
    if (what === "hallgo") { this.selectedProp = ""; this.render(); this.host.openStory(); return; }
    if (what === "decorate") { this.openDecorate(this.selectedProp); return; }
    if (what === "dmove") {
      const d = placedOn(this.save, this.selectedProp);
      if (!d) return;
      this.movingDecor = d.id;
      this.selectedProp = "";
      this.host.sound.click();
      toast(t("Tap any empty lot to move the {name} there", { name: t(d.name) }));
      this.render();
      return;
    }
    if (what === "dstore") {
      const d = placedOn(this.save, this.selectedProp);
      if (!d || !storePlace(this.save, d.id)) return;
      this.selectedProp = "";
      this.host.sound.click(); this.host.persist();
      toast(t("{name} put away: place it again for free from any empty lot", { name: t(d.name) }));
      this.render();
      return;
    }
    if (what === "pup") {
      const key = this.selectedProp;
      tick(this.save);
      const job = buildOf(this.save, "home", key);
      if (job) { this.finishBuild("home", key); return; }
      this.startCityBuild("home", key);
      return;
    }
    if (what === "amt") {
      const v = el.dataset.n!;
      this.amount = v === "max" ? "max" : (Number(v) as 1 | 10 | 100);
      $("tycoon").querySelectorAll<HTMLElement>(".ty-amount button").forEach(x => x.setAttribute("aria-checked", String(x.dataset.n === String(this.amount))));
      this.host.sound.click();
      this.render();
      return;
    }
    if ((what === "hire" || what === "buy") && id) {
      // Short of cash: say how long until it's earned (and offer a time warp), not just nothing.
      tick(this.save);
      const b = BUSINESSES.find(x => x.id === id), ty = this.save.tycoon;
      if (b) {
        const lv = levelOf(this.save, id), n = lv === 0 ? 1 : Math.min(Math.max(1, freeFloors(this.save)), this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
        const need = what === "hire" ? b.manager : costOf(b, lv, n);
        if (ty.coins < need) { this.host.sound.click(); toast(t("You need {n} more", { n: coins(need - ty.coins) })); this.shortOffer(need - ty.coins); return; }
      }
    }
    if (what === "amount") {
      const order: (number | "max")[] = [1, 10, 100, "max"];
      this.amount = order[(order.indexOf(this.amount) + 1) % order.length];
      $("tycoon").querySelectorAll<HTMLElement>(".ty-amount button").forEach(x => x.setAttribute("aria-checked", String(x.dataset.n === String(this.amount))));
      this.host.sound.click();
      this.render();
      return;
    }
    if (what === "look") {
      this.openSheet("company", id);
      // (Its room glows for a moment, so it's easy to find.)
      if (HAS_CITY && id) requestAnimationFrame(() => { const r = $("ty-list").querySelector<HTMLElement>(`[data-biz="${id}"]`); if (r) { r.classList.remove("look-here"); void r.offsetWidth; r.classList.add("look-here"); } });
      return;
    }
    if (what === "paint" && id) { this.host.sound.click(); this.openPaint(id); return; }
    if (what === "hall") { this.host.sound.click(); this.selected = ""; this.host.openStory(); return; }
    if (what === "build") { this.host.sound.click(); toast(t("Every office floor is full. Build an office block for more!")); this.selected = ""; this.openBuild(); return; }
    const tag = $("tcy-labels").querySelector<HTMLElement>(`[data-tag="${id}"]`) ?? card;
    this.doAct(what === "buy" && freeFloors(this.save) < 1 ? "buy" : what, id, el, e, card.querySelector(".card-pops")!, tag);
    this.render();
  }

  // ---------- Build and More ----------

  /** Builds a business's next headquarters: in the city game the builders do it (cash and a
   *  timer); in the tower game it's a tower to stack. */
  private goHQ(id: string): void {
    if (!HAS_CITY) { this.leave(); this.host.buildHQ(id); return; }
    if (!this.save.seenFeatures.includes("try-hq")) this.save.seenFeatures.push("try-hq");
    this.startCityBuild("hq", id);
  }

  /** An HQ's ask: its height, and its building order (filled, the business earns more for good).
   *  In the city game: its price and how long it takes to build. */
  private hqSub(id: string, stage: number): string {
    if (HAS_CITY) {
      const job = buildOf(this.save, "hq", id);
      if (job) return t("Building · {t} left", { t: fmtLeft(job.end - Date.now()) });
      return t("{n} · ⏱ {t} · the business grows", { n: coins(hqPrice(this.save, id)), t: fmtLeft(buildTime(this.save, "hq", id)) });
    }
    const o = orderFor(BUSINESSES.findIndex(b => b.id === id), stage);
    return t("{n} floors · order: {order} for ×{m} earnings", { n: hqFloors(stage), order: orderText(o), m: ORDER_MULT });
  }

  // ---------- The weekly city event (logic/cityevent.ts) ----------
  /** Points for the week's event; a milestone reached says so (claimed in Goals). */
  private eventAdd(what: EventAction, n = 1): void {
    if (!HAS_CITY) return;
    const s = this.save, before = eventReady(s).length;
    const spBefore = spReady(s);
    eventPoints(s, what, n);
    seasonPoints(s, EVENT_POINTS[what] * n);
    if (spReady(s) > spBefore) toast(t("🎟️ Season Pass: a reward is ready in Goals!"));
    if (eventReady(s).length > before) { this.host.sound.unlock(); toast(t("{icon} {name}: a reward is ready in Goals!", { icon: eventTheme().icon, name: t(eventTheme().name) })); }
  }

  /** The event card in Goals: points, the milestones and their rewards, the pass. */
  private eventHtml(): string {
    if (!HAS_CITY) return "";
    const s = this.save, e = cityEvent(s), th = eventTheme(), prize = eventPrize(), top = EVENT_STEPS[EVENT_STEPS.length - 1].at;
    const ends = cityEventEndsAt(s);
    const left = ends ? fmtLeft(ends - Date.now()) : "";
    const steps = EVENT_STEPS.map((st, i) => {
      const got = e.claimed.includes(i), ready = e.pts >= st.at && !got;
      const what = st.prize ? `${prize.name ? t(prize.name) : ""}` : `💎${st.crystals + (e.pass ? st.passCrystals : 0)}`;
      return `<button type="button" class="ev-step${got ? " got" : ready ? " ready" : ""}" data-goal="event" data-step="${i}"${ready ? "" : " disabled"}><b>${st.prize ? "🎁" : got ? "✓" : fmt(st.at)}</b><small>${esc(what)}</small></button>`;
    }).join("");
    return `<section class="ev-card">
      <div class="ev-head"><span class="ev-ico">${th.icon}</span><span><b>${esc(t(th.name))}</b><small>${esc(left ? t("This week's city event · ends in {t}", { t: left }) : t("This week's city event · done!"))}</small></span></div>
      <p class="ev-how">${esc(t("Grow Skyhaven to earn points: business levels, new businesses, finished builds, home upgrades and golden customers. The top prize is free only this week: {name}.", { name: t(prize.name) }))}</p>
      <i class="ev-bar"><i style="width:${Math.min(100, (e.pts / top) * 100).toFixed(1)}%"></i></i>
      <p class="ev-pts">${esc(t("{n} points", { n: fmt(e.pts) }))}${e.pass ? ` · <em>${esc(t("Event pass: double points"))}</em>` : ""}</p>
      <div class="ev-steps">${steps}</div>
      ${e.pass ? "" : `<button type="button" class="ev-pass" data-goal="eventpass">${esc(t("Event pass: double points and more crystals · 💎{n}", { n: EVENT_PASS_CRYSTALS }))}</button>`}
    </section>`;
  }

  /** The Season Pass card in Goals (only while a season is on). */
  private seasonPassHtml(): string {
    const s = this.save, p = seasonPass(s), se = seasonInfo(citySeason());
    if (!p || !se) return "";
    const tier = spTier(p), top = SP_TIERS[SP_TIERS.length - 1];
    const what = (r: SPReward) => r.paint ? `🎨 ${t(paintById(r.paint)?.name ?? "")}` : r.crystals ? `💎${r.crystals}` : `${coins(starCash(s, r.stars ?? 0))}`;
    const cell = (track: "free" | "prem", i: number) => {
      const r = spReward((track === "free" ? SP_FREE : SP_PREMIUM)[i]), got = (track === "free" ? p.free : p.prem).includes(i);
      const open = track === "free" || p.premium, ready = open && tier > i && !got;
      const sw = r.paint ? `<i class="sp-sw" style="--p1:${paintById(r.paint)?.c[0]};--p2:${paintById(r.paint)?.c[1]}"></i>` : "";
      return `<button type="button" class="sp-cell${got ? " got" : ready ? " ready" : ""}${open ? "" : " lock"}" data-goal="sp" data-track="${track}" data-i="${i}"${ready ? "" : " disabled"}>${sw}<small>${esc(got ? "✓" : what(r))}</small></button>`;
    };
    const cols = SP_TIERS.map((at, i) => `<div class="sp-col${tier > i ? " on" : ""}"><b>${i + 1}</b>${cell("free", i)}${cell("prem", i)}<em>${fmt(at)}</em></div>`).join("");
    return `<section class="sp-card" style="--se:${se.bulbs[0]};--se2:${se.bulbs[1]}">
      <div class="sp-head"><span class="sp-ico">${se.icon}</span><span><b>${esc(t("{name} Season Pass", { name: t(se.name) }))}</b><small>${esc(tn(seasonDaysLeft(), "{n} season points · {d} day left", "{n} season points · {d} days left", { n: fmt(p.pts), d: seasonDaysLeft() }))}</small></span></div>
      <i class="ev-bar"><i style="width:${Math.min(100, (p.pts / top) * 100).toFixed(1)}%"></i></i>
      <p class="sp-legend"><span>${esc(t("Top: free"))}</span><span>⭐ ${esc(t("Bottom: Premium"))}</span></p><div class="sp-tracks"><div class="sp-row">${cols}</div></div>
      ${p.premium ? `<p class="sp-note">${esc(t("Premium is on: collect both rewards at every step!"))}</p>`
        : `<button type="button" class="ev-pass sp-buy" data-goal="spbuy">${esc(t("Unlock Premium: the {paint} paint, Solid Gold paint and more · 💎{n}", { paint: t(paintById(SEASON_PAINT[se.id])?.name ?? ""), n: SP_PRICE }))}</button>`}
    </section>`;
  }

  /** The next population milestone, in Goals. */
  private milestoneHtml(): string {
    const s = this.save, m = nextPeopleMs(s);
    if (!m) return "";
    const have = townPeople(s), prev = PEOPLE_MILESTONES[PEOPLE_MILESTONES.indexOf(m) - 1]?.at ?? 0;
    return `<div class="ms-card"><span class="ms-ico">🏙️</span><span><b>${esc(t("Next city milestone: {n} people", { n: fmt(m.at) }))}</b>
      <i class="ev-bar"><i style="width:${Math.max(0, Math.min(100, ((have - prev) / (m.at - prev)) * 100)).toFixed(1)}%"></i></i>
      <small>${esc(t("{n} people now · grow homes to get there · +{c} 💎", { n: fmt(have), c: m.crystals }))}</small></span></div>`;
  }

  /** A tap on the event card. Returns true when it was the event's. */
  private onEventTap(el: HTMLElement): boolean {
    const s = this.save;
    if (el.dataset.goal === "sp") {
      const r = claimSP(s, el.dataset.track === "prem" ? "prem" : "free", Number(el.dataset.i));
      if (!r) return true;
      this.host.sound.unlock(); burst(el, 18);
      if (r.paint) { fireworks(3, () => this.host.sound.firework()); toast(t("🎨 New paint: {name}! Paint any business from its card.", { name: t(paintById(r.paint)?.name ?? "") })); }
      else toast(r.crystals ? t("+{n} Sky Crystals", { n: r.crystals }) : t("+{n}", { n: coins(r.cash) }));
      track("sp_claim", { track: el.dataset.track ?? "", i: Number(el.dataset.i) }, false);
      this.host.persist(); this.host.refresh(); this.renderGoalsSheet(); this.render();
      return true;
    }
    if (el.dataset.goal === "team") {
      const n = claimTeam(s, Number(el.dataset.step), teamTotal(s, this.mates ?? []));
      if (!n) return true;
      this.host.sound.unlock(); burst(el, 18);
      toast(t("🤝 Team reward: +{n} Sky Crystals", { n }));
      track("team_claim", { step: Number(el.dataset.step) }, false);
      this.host.persist(); this.host.refresh(); this.renderGoalsSheet();
      return true;
    }
    if (el.dataset.goal === "invite") { void this.host.inviteFriend(); return true; }
    if (el.dataset.goal === "spbuy") {
      const r = buySeasonPass(s);
      if (r === "short") { toast(t("You need {n} more Sky Crystals", { n: SP_PRICE - s.crystals })); this.host.openShop("crystals"); return true; }
      if (r === "ok") { track("season_pass", {}, false); this.host.sound.purchase(); confetti(); toast(t("⭐ Season Pass Premium unlocked!")); this.host.persist(); this.renderGoalsSheet(); }
      return true;
    }
    if (el.dataset.goal === "event") {
      const r = claimEventStep(s, Number(el.dataset.step));
      if (!r) return true;
      track("event_step", { step: Number(el.dataset.step) }, false);
      this.host.sound.unlock(); burst(el, 20);
      if (r.decor) { fireworks(4, () => this.host.sound.firework()); toast(t("🎁 {name} is yours! It's in your town now.", { name: t(decorById(r.decor)?.name ?? "") })); }
      else toast(t("+{n} Sky Crystals", { n: r.crystals }));
      this.host.persist(); this.host.refresh(); this.renderGoalsSheet(); this.render();
      return true;
    }
    if (el.dataset.goal === "eventpass") {
      const r = buyEventPass(s);
      if (r === "short") { toast(t("You need {n} more Sky Crystals", { n: EVENT_PASS_CRYSTALS - s.crystals })); this.host.openShop("crystals"); return true; }
      if (r === "ok") { track("event_pass", {}, false); this.host.sound.purchase(); confetti(); toast(t("Event pass on: double points all week!")); this.host.persist(); this.renderGoalsSheet(); }
      return true;
    }
    return false;
  }

  // ---------- The city album (data/sights.ts) ----------
  /** The first time a kind of building or place is tapped, it goes in the album. */
  private albumAdd(kind: string): void {
    if (!HAS_CITY || !ALBUM_KINDS.includes(kind)) return;
    const s = this.save;
    if (s.album.includes(kind)) return;
    s.album.push(kind);
    const info = sightInfo(kind);
    s.crystals += ALBUM_CRYSTALS;
    let msg = t("📖 New in your album: {name}! +{n} 💎 ({have} of {all})", { name: t(info?.name ?? kind), n: ALBUM_CRYSTALS, have: s.album.length, all: ALBUM_KINDS.length });
    if (s.album.length === ALBUM_KINDS.length) { s.crystals += ALBUM_DONE_CRYSTALS; msg = t("📖 Album complete! You found every building in Skyhaven. +{n} 💎", { n: ALBUM_DONE_CRYSTALS + ALBUM_CRYSTALS }); fireworks(4); }
    this.host.sound.unlock();
    toast(msg);
    track("album_add", { kind, have: s.album.length }, false);
    this.host.persist();
  }

  /** The album page (in Goals): every kind, found or still a silhouette. */
  private albumHtml(): string {
    if (!HAS_CITY) return "";
    const s = this.save;
    const cells = ALBUM_KINDS.map(k => {
      const info = sightInfo(k), got = s.album.includes(k);
      return `<span class="alb-cell${got ? " got" : ""}" title="${esc(got && info ? t(info.name) : "?")}"><i>${got && info ? info.icon : "?"}</i><small>${esc(got && info ? t(info.name) : t("Not found yet"))}</small></span>`;
    }).join("");
    return `<section class="alb-card"><div class="ev-head"><span class="ev-ico">📖</span><span><b>${esc(t("City album"))}</b><small>${esc(t("{have} of {all} found · tap buildings in town to find more", { have: s.album.length, all: ALBUM_KINDS.length }))}</small></span></div><div class="alb-grid">${cells}</div></section>`;
  }

  // ---------- Builders and build time (logic/builds.ts) ----------
  /** Starts building something, or says why it can't start. */
  private startCityBuild(kind: BuildKind, id = ""): boolean {
    const s = this.save;
    tick(s);
    const r = startBuild(s, kind, id);
    if (r === "short") { this.host.sound.click(); this.shortOffer(buildPrice(s, kind, id) - s.tycoon.coins); return false; }
    if (r === "busy") { this.host.sound.click(); this.builderOffer(); return false; }
    if (r === "building") { this.finishBuild(kind, id); return false; }
    if (r !== "ok") return false;
    const job = buildOf(s, kind, id)!;
    track("build_started", { kind }, false);
    if (kind === "project" && !s.seenFeatures.includes("try-contract")) s.seenFeatures.push("try-contract");
    this.host.sound.unlock();
    vibrate(s.settings.vibrate, 12);
    toast(t("🏗️ Building started! Done in {t}", { t: fmtLeft(job.end - Date.now()) }));
    this.host.persist();
    this.host.reschedule();
    this.render();
    return true;
  }

  /** Finishes a build now for crystals (or opens the crystal shop). */
  private finishBuild(kind: BuildKind, id = ""): void {
    const s = this.save, job = buildOf(s, kind, id);
    if (!job) return;
    const price = finishPrice(job.end - Date.now());
    const r = finishNow(s, kind, id);
    if (r === "short") { toast(t("You need {n} more Sky Crystals", { n: price - s.crystals })); this.host.openShop("crystals"); return; }
    if (r !== "ok") return;
    track("build_finished_now", { kind, crystals: price }, false);
    this.host.sound.purchase(); vibrate(this.save.settings.vibrate, [15, 30, 15]);
    this.builtDone([job]);
    this.host.persist();
  }

  /** Every builder is busy: hire another, or finish one now. */
  private builderOffer(): void {
    const s = this.save, hired = s.tycoon.builders ?? 0;
    if (hired < MAX_HIRED) toast(t("All builders are busy! Hire another for 💎{n}, or finish a build now.", { n: BUILDER_PRICES[hired] }));
    else toast(t("All builders are busy. Finish a build now, or wait a little."));
    this.openBuild();
  }

  /** Not enough cash: how long until it's earned and, when a time warp would cover it, an
   *  offer right there (the moment it's wanted, not a shop page to find). */
  private lastOffer = 0;
  private shortOffer(missing: number): void {
    const s = this.save, now = Date.now(), rate = perSecond(s, now, false);
    const wait = rate > 0 ? missing / rate : Infinity;
    const hours: 1 | 8 | 0 = warpGain(s, 1, now) >= missing ? 1 : warpGain(s, 8, now) >= missing ? 8 : 0;
    // The first time cash runs short (and a wait of over a minute): a one-time welcome deal
    // from Pip, an hour's time warp at a quarter of its price.
    if (hours === 1 && wait > 60 && !s.seenFeatures.includes("welcome-warp") && speedupsLeft(s, now) > 0) {
      s.seenFeatures.push("welcome-warp"); this.host.persist();
      this.lastOffer = now;
      const price = WELCOME_WARP_CRYSTALS, full = warpPrice(1), gain = warpGain(s, 1, now);
      track("offer_shown", { kind: "welcome_warp" }, false);
      mayorNote(t("A welcome gift, just this once!"), t("Short {n}? Your businesses earn it in about {t}. Or take my welcome deal: an hour of earnings ({gain}) right now, for 💎{p} instead of 💎{full}.", { n: coins(missing), t: fmtLeft(wait * 1000), gain: coins(gain), p: price, full }),
        t("Time warp · 💎{n}", { n: price }), () => {
          if (s.crystals < price) { toast(t("You need {n} more Sky Crystals", { n: price - s.crystals })); this.host.openStarter(); return; }
          if (timeWarp(s, 1, Date.now(), price) > 0) { track("offer_taken", { kind: "welcome_warp" }, false); this.host.sound.purchase(); confetti(); toast(t("+{n}! Your businesses worked {h} in a blink.", { n: coins(gain), h: t("an hour") })); this.host.persist(); this.render(); }
        }, t("No thanks"));
      return;
    }
    // (At most one offer every 3 minutes, and only when waiting would take a while.)
    if (hours && wait > 90 && speedupsLeft(s, now) > 0 && now - this.lastOffer > 180e3) {
      this.lastOffer = now;
      const price = warpPrice(hours), gain = warpGain(s, hours, now);
      track("offer_shown", { kind: "warp", hours }, false);
      mayorNote(t("Short {n}?", { n: coins(missing) }), t("Your businesses earn it in about {t}. Or jump ahead: a time warp pays {gain} right now, {h} of earnings at once.", { t: fmtLeft(wait * 1000), gain: coins(gain), h: hours === 1 ? t("an hour") : t("8 hours") }),
        t("Time warp · 💎{n}", { n: price }), () => {
          if (s.crystals < price) { toast(t("You need {n} more Sky Crystals", { n: price - s.crystals })); this.host.openShop("crystals"); return; }
          if (timeWarp(s, hours) > 0) { track("offer_taken", { kind: "warp", hours }, false); this.host.sound.purchase(); toast(t("+{n}! Your businesses worked {h} in a blink.", { n: coins(gain), h: hours === 1 ? t("an hour") : t("8 hours") })); this.host.persist(); this.render(); }
        }, t("I'll wait"));
      return;
    }
    toast(wait < 3600 * 24 ? t("You need {n} more: about {t} of earnings.", { n: coins(missing), t: fmtLeft(wait * 1000) }) : t("You need {n} more cash. Your businesses are earning it!", { n: coins(missing) }));
  }

  private hireBuilderNow(): void {
    const s = this.save, hired = s.tycoon.builders ?? 0;
    const r = hireBuilder(s);
    if (r === "short") { toast(t("You need {n} more Sky Crystals", { n: BUILDER_PRICES[hired] - s.crystals })); this.host.openShop("crystals"); return; }
    if (r !== "ok") return;
    track("builder_hired", { n: s.tycoon.builders }, false);
    this.host.sound.purchase(); vibrate(this.save.settings.vibrate, [15, 30, 15]); confetti();
    toast(t("👷 A new builder joined! You have {n} builders now.", { n: builderCount(s) }));
    this.host.persist();
    if (!$("tcy-buildsheet").hidden) this.openBuild();
    this.render();
  }

  /** Builds that finished since the last look: each takes effect with its own moment. */
  private lastBuildCheck = 0;
  private checkBuilds(): void {
    const now = Date.now();
    if (now - this.lastBuildCheck < 500) return;
    this.lastBuildCheck = now;
    const s = this.save, before = (s.tycoon.builds ?? []).map(b => ({ ...b }));
    const done = completeBuilds(s, now);
    if (done.length) { this.host.sound.tada(); vibrate(s.settings.vibrate, [20, 40, 20]); this.builtDone(before.filter(b => b.end <= now)); this.host.persist(); }
    // While something is being built, a soft hammering now and then (only in the town view,
    // with no menu over it).
    if ((s.tycoon.builds ?? []).length && this.inCity && !openModalEl() && !document.body.classList.contains("tabs-open") && now - this.hammerAt > 2600) { this.hammerAt = now; this.host.sound.hammer(); }
    this.renderBuildChip(now);
  }
  private hammerAt = 0;
  /** How busy the town is (0-1): how many people live in the homes you've built. */
  townBusy(): number {
    const people = Object.values(this.save.props).reduce((a, l) => a + (PROP_PEOPLE[Math.max(0, Math.min(5, l))] ?? 0), 0);
    return Math.max(0, Math.min(1, people / 1500));
  }

  /** Celebrates finished builds. */
  private builtDone(jobs: BuildJob[]): void {
    const s = this.save;
    // Today's building goals.
    this.goal("build", jobs.length);
    const homes = jobs.filter(j => j.kind === "home").length;
    if (homes) { this.goal("home", homes); teamHomes(s, homes); }
    for (const j of jobs) {
      track("build_done", { kind: j.kind }, false);
      this.eventAdd(j.kind === "home" ? "home" : "build");
      if (j.kind === "office") { this.host.sound.unlock(); toast(t("🏢 Office block finished! +{n} office floors", { n: OFFICE_BLOCK_FLOORS })); }
      else if (j.kind === "terrace") { if (this.inCity) this.openTerrace(); }
      else if (j.kind === "land") this.landDone(j.id);
      else if (j.kind === "hq") {
        const to = s.tycoon.evolved[j.id] ?? 0;
        track("hq_built", { biz: j.id, stage: to }, false);
        if (to > 0) this.evolve(j.id, to - 1, to);
      }
      else if (j.kind === "project") {
        track("project_done", { project: j.id });
        this.host.sound.unlock();
        toast(j.id === "play" ? t("🛝 The playground opens in your block!") : t("🌷 The flower market opens in your block!"));
      }
      else if (j.kind === "home") {
        const lv = propLevel(s, j.id);
        track("prop_upgrade");
        this.host.sound.unlock();
        vibrate(s.settings.vibrate, [15, 30, 15]);
        if (lv === 1 && isLot(j.id)) toast(t("🏡 Built! New neighbours moved in: they shop at your businesses and pay rent."));
        else if (lv === PROP_MAX) { fireworks(2, () => this.host.sound.firework()); toast(t("🏙️ Fully grown: a glass skyscraper!")); }
        else if (!s.seenFeatures.includes("prop-first")) { s.seenFeatures.push("prop-first"); toast(t("🏠 It grew! Every building in town can grow like this, up to a skyscraper. Each level makes every business earn more.")); }
        else toast(t("🏠 Home upgrade finished: level {n}!", { n: lv }));
      }
    }
    if (!$("tcy-buildsheet").hidden) this.openBuild();
    this.host.reschedule();
    this.render();
  }

  /** The builders chip under the top bar: what's being built and how long it has left. */
  private renderBuildChip(now: number): void {
    const el = document.getElementById("tcy-builds");
    if (!el) return;
    const s = this.save, jobs = (s.tycoon.builds ?? []).filter(b => b.end > now).sort((a, b) => a.end - b.end);
    const show = this.inCity && (jobs.length > 0 || (s.tycoon.offices ?? 0) > 0 || s.cafe.terrace > 0);
    el.hidden = !show;
    if (!show) return;
    const html = jobs.length
      ? `<span class="bc-ico">${iconSvg("brick")}</span><b>${esc(fmtLeft(jobs[0].end - now))}</b><small>${busyBuilders(s, now)}/${builderCount(s, now)}</small>`
      : `<span class="bc-ico">${iconSvg("building")}</span><b>${builderCount(s, now)}</b><small>${esc(t("free"))}</small>`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  /** A build's line in the Build menu (under way: time left and the finish-now price). */
  private jobRow(j: BuildJob, now: number): string {
    const names: Record<BuildKind, string> = { office: t("Office block"), terrace: t("Café terrace"), land: t("New district"), home: t("Home upgrade"), hq: t("New headquarters"), project: j.id === "play" ? t("Playground") : t("Flower market") };
    const icons: Record<BuildKind, string> = { office: "🏢", terrace: "☕", land: "🏝️", home: "🏠", hq: "🏗️", project: j.id === "play" ? "🛝" : "🌷" };
    const left = j.end - now, pct = Math.min(100, Math.max(0, ((now - j.start) / Math.max(1, j.end - j.start)) * 100));
    return `<button type="button" class="tcy-mode city job" data-finish="${j.kind}" data-id="${esc(j.id)}"><span class="mode-ico">${icons[j.kind]}</span><span><b>${esc(names[j.kind])}</b><small>${esc(t("Building · {t} left", { t: fmtLeft(left) }))}</small><i class="job-bar"><i style="width:${pct.toFixed(0)}%"></i></i></span><span class="mode-price gem">${esc(t("Finish"))} 💎${finishPrice(left)}</span></button>`;
  }

  /** Build: what to build in the city (office blocks, new businesses, a district, homes),
   *  then the headquarters waiting to be built and the tower mini-game. */
  private openBuild(): void {
    const s = this.save, ty = s.tycoon, rows: string[] = [];
    // (A brand-new player's first tower comes before the city; the city game has no towers.)
    if (!HAS_CITY && !playerStarted(s)) { this.leave(); this.host.play("classic"); return; }
    tick(s);
    const head = (title: string) => rows.push(`<h3 class="tcy-build-head">${esc(title)}</h3>`);
    const item = (attrs: string, ico: string, title: string, sub: string, price: number | null, extra = "") => {
      const short = price !== null && ty.coins < price;
      rows.push(`<button type="button" class="tcy-mode city${short ? " short" : ""}" ${attrs}><span class="mode-ico">${ico}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${price !== null ? `<span class="mode-price">${COIN_SVG}${esc(coins(price))}</span>` : ""}${extra}</button>`);
    };
    const now = Date.now();
    // What's being built now, and the builders.
    const jobs = (ty.builds ?? []).filter(j => j.end > now);
    const hired = ty.builders ?? 0;
    if (jobs.length) { head(t("Builders: {busy} of {n} at work", { busy: jobs.length, n: builderCount(s, now) })); for (const j of jobs) rows.push(this.jobRow(j, now)); }
    const hireRow = hired < MAX_HIRED ? `<button type="button" class="tcy-mode city hire small" data-build="hire"><span class="mode-ico">${iconSvg("brick")}</span><span><b>${esc(t("Hire a builder"))}</b><small>${esc(t("Build two things at once. Yours for good."))}</small></span><span class="mode-price gem">💎${BUILDER_PRICES[hired]}</span></button>` : "";
    // (While every builder is busy, hiring one comes first.)
    if (hireRow && jobs.length >= builderCount(s, now)) rows.push(hireRow);
    head(t("Build"));
    const time = (kind: BuildKind, id = "") => " · ⏱ " + fmtLeft(buildTime(s, kind, id, now));
    // The café terrace: the first thing a new player builds.
    if (s.cafe.terrace === 0 && !buildOf(s, "terrace", "")) item(`data-build="terrace"`, "☕", t("Café terrace"), t("Tables and chairs by the Coffee Cart: your neighbor can sit, and the cart earns more") + time("terrace"), TERRACE_PRICE);
    // Office blocks: room for more business levels.
    const free = freeFloors(s), op = officePrice(s);
    if (FLOOR_LIMIT && !buildOf(s, "office", "")) item(`data-build="office"`, "🏢", t("Office block"), (free < 1
      ? t("Every office floor is full! +{n} office floors for business levels", { n: OFFICE_BLOCK_FLOORS })
      : t("+{n} office floors for business levels ({free} free now)", { n: OFFICE_BLOCK_FLOORS, free: fmt(free) })) + time("office"), op);
    // New businesses ready to open (the first two).
    let opened = 0;
    BUSINESSES.forEach((b, i) => {
      if (opened >= 2 || levelOf(s, b.id) > 0 || !unlockedBusiness(s, i)) return;
      opened++;
      item(`data-build="biz" data-id="${b.id}"`, iconSvg(b.icon), t("Open the {name}", { name: t(b.name) }), t("A new business: it earns {n} a sale", { n: coins(b.income * multiplier(s, Date.now())) }), costOf(b, 0, 1));
    });
    // The next district for sale.
    const sale = landOnSale(s);
    if (sale && !buildOf(s, "land", sale.id)) item(`data-build="land"`, "🏝️", t("New district: {name}", { name: t(sale.name) }), t(sale.what) + time("land", sale.id), landPrice(s, sale));
    // Homes: the cheapest upgrade.
    if (propsOpen(s)) {
      const best = this.host.bizHomes().filter(key => !buildOf(s, "home", key)).map(key => ({ key, lv: propLevel(s, key), price: propPrice(s, key) })).filter(h => !propBlock(s, h.key, s.tycoon.builds?.filter(b => b.kind === "home" && isLot(b.id) && propLevel(s, b.id) === 0).length ?? 0)).sort((a, b) => a.price - b.price)[0];
      if (best?.lv === 0) item(`data-build="home" data-id="${esc(best.key)}"`, "🏡", t("Build on an empty lot"), t("New neighbours move in: they shop at your businesses and pay rent") + time("home", best.key), best.price);
      else if (best) item(`data-build="home" data-id="${esc(best.key)}"`, "🏠", t("Upgrade a home"), t("A bigger building: more people, more rent, +{pct}% to every business", { pct: Math.round(PROP_BONUS * 100) }) + time("home", best.key), best.price);
    }
    // The city game: headquarters and the block's projects are built by builders, like the rest.
    if (HAS_CITY) {
      let n = 0;
      for (const b of BUSINESSES) {
        const st = readyStage(s, b.id);
        if (!st || n >= 2 || buildOf(s, "hq", b.id)) continue;
        n++;
        item(`data-build="hq" data-id="${b.id}"`, "🏗️", t("Build the {name} HQ", { name: t(stageName(b.id, st)) }), t("The business grows: bigger building, more cash a sale") + time("hq", b.id), hqPrice(s, b.id));
      }
      if (projectsOpen(s.cafe)) {
        if (!s.cafe.done.includes("flowers") && !buildOf(s, "project", "flowers")) item(`data-build="project" data-id="flowers"`, "🌷", t("Flower market"), t("A flower stall for your block: shoppers carry flowers home") + time("project", "flowers"), buildPrice(s, "project", "flowers"));
        if (!s.cafe.done.includes("play") && !buildOf(s, "project", "play")) item(`data-build="project" data-id="play"`, "🛝", t("Playground"), t("A slide and swings: families come to play on your block") + time("project", "play"), buildPrice(s, "project", "play"));
      }
    }
    if (hireRow && jobs.length < builderCount(s, now) && (ty.offices ?? 0) + s.land.length > 0) rows.push(hireRow);
    if (HAS_CITY) { $("tcy-modes").innerHTML = rows.join(""); openModal($("tcy-buildsheet")); return; }
    // Headquarters are built floor by floor in the tower mini-game.
    const hqs: string[] = [];
    let hqRows = 0;
    for (const b of BUSINESSES) {
      const st = readyStage(s, b.id);
      if (st && hqRows++ < 2) hqs.push(`<button type="button" class="tcy-mode hq" data-mode="hq" data-id="${b.id}"><span class="mode-ico">🏗️</span><span><b>${esc(t("Build the {name} HQ", { name: t(stageName(b.id, st)) }))}</b><small>${esc(this.hqSub(b.id, st))}</small></span></button>`);
    }
    if (projectsOpen(s.cafe)) {
      const c = s.cafe, pct = Math.round(WIDE_SHARE * 100);
      if (!c.done.includes("flowers")) hqs.push(`<button type="button" class="tcy-mode project" data-mode="flowers"><span class="mode-ico">🌷</span><span><b>${esc(t("Flower market: land {n} wide floors", { n: FLOWER_WIDE }))}</b><small>${esc(t("A wide floor keeps {pct}% of the first floor's width. A flower stall opens by your tower, and shoppers carry flowers home", { pct }))}</small></span></button>`);
      if (!c.done.includes("play")) hqs.push(`<button type="button" class="tcy-mode project" data-mode="play"><span class="mode-ico">🛝</span><span><b>${esc(t("Playground: build {n} floors in one tower", { n: PLAY_FLOORS }))}</b><small>${esc(t("Go tall. A slide opens by your tower, and a family from your tower comes to play"))}</small></span></button>`);
    }
    if (hqs.length) { head(t("Headquarters")); rows.push(...hqs); }
    // The tower mini-game: stack floors by hand for extra office floors and cash.
    head(t("Tower mini-game"));
    const mode = (k: string, ico: string, title: string, sub: string, src?: string) => {
      if (src && $(src).hidden) return;
      const dot = src && $(src).querySelector(".dot:not([hidden])") ? `<i class="dot"></i>` : "";
      rows.push(`<button type="button" class="tcy-mode small" data-mode="${k}"><span class="mode-ico">${ico}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${dot}</button>`);
    };
    mode("classic", "🏗️", t("Stack a tower"), t("Every floor adds two office floors, plus cash"));
    mode("daily", "📅", t("Daily tower"), t("The same tower for everyone today"), "daily-btn");
    mode("journey", "🗺️", t("Journey"), t("Landmark challenges, one by one"), "challenges-btn");
    mode("zen", "🍃", t("Zen"), t("Relax and build, no pressure"), "zen-btn");
    $("tcy-modes").innerHTML = rows.join("");
    openModal($("tcy-buildsheet"));
  }

  /** A tap on something to build in the city. */
  private onBuildTap(el: HTMLElement): void {
    const what = el.dataset.build!, id = el.dataset.id ?? "";
    if (what === "hire") { this.hireBuilderNow(); return; }
    if (what === "office" || what === "terrace" || what === "land" || what === "home" || what === "hq" || what === "project") {
      if (this.startCityBuild(what, what === "land" ? landOnSale(this.save)?.id ?? "" : id)) {
        if (what === "land" || what === "home") { closeModal($("tcy-buildsheet")); if (what === "home") this.selectProp(id); }
        else this.openBuild();
      }
      return;
    }
    this.host.sound.click();
    closeModal($("tcy-buildsheet"));
    if (what === "biz") { this.selected = id; this.selectedProp = ""; this.selectedSight = ""; this.render(); }
  }

  private onModeTap(e: Event): void {
    const fin = (e.target as Element).closest<HTMLElement>("[data-finish]");
    if (fin) { this.finishBuild(fin.dataset.finish as BuildKind, fin.dataset.id ?? ""); return; }
    const b = (e.target as Element).closest<HTMLElement>("[data-build]");
    if (b) { this.onBuildTap(b); return; }
    const el = (e.target as Element).closest<HTMLElement>("[data-mode]");
    if (!el) return;
    this.host.sound.click();
    closeModal($("tcy-buildsheet"));
    const m = el.dataset.mode!;
    if (m === "journey") { $("challenges-btn").click(); return; }
    this.leave();
    if (m === "contract" || m === "flowers") { this.host.playProject("flowers"); return; }
    if (m === "play") { this.host.playProject("play"); return; }
    if (m === "hq") this.host.buildHQ(el.dataset.id!);
    else this.host.play(m as "classic" | "daily" | "zen");
  }

  /** Goals: the story chapter, today's company goals and the daily missions, in one place. */
  private openGoals(): void {
    this.renderGoalsSheet();
    openModal($("tcy-goalsheet"));
    // The Community Spire arrives a moment later (it's asked from the server).
    if (HAS_CITY) void this.host.fetchTeam().then(m => {
      this.mates = m;
      if (!$("tcy-goalsheet").hidden) this.renderGoalsSheet();
    });
    if (!HAS_CITY) void this.host.fetchSpire().then(sp => {
      this.spire = sp;
      if (!$("tcy-goalsheet").hidden) this.renderGoalsSheet();
    });
  }
  /** Friends' weeks, as last heard from the server (undefined: not heard yet or offline). */
  mates: TeamMate[] | undefined;

  /** The friend team card: homes built together this week, steps that pay crystals. */
  private teamHtml(): string {
    const s = this.save, mates = this.mates;
    if (!mates) return "";
    const tm = teamWeek(s), total = teamTotal(s, mates), top = TEAM_STEPS[TEAM_STEPS.length - 1].at;
    const steps = TEAM_STEPS.map((st, i) => {
      const got = tm.claimed.includes(i), ready = total >= st.at && !got;
      return `<button type="button" class="ev-step${got ? " got" : ready ? " ready" : ""}" data-goal="team" data-step="${i}"${ready ? "" : " disabled"}><b>${got ? "✓" : fmt(st.at)}</b><small>💎${st.crystals}</small></button>`;
    }).join("");
    const week = mates.filter(m => m.week === tm.week && m.homes > 0).sort((a, b) => b.homes - a.homes);
    const who = [{ name: t("You"), homes: tm.homes }, ...week.map(m => ({ name: displayName(m.name), homes: m.homes }))].slice(0, 6)
      .map(m => `<span class="tm-mate"><b>${esc(m.name)}</b><small>${esc(fmt(m.homes))}</small></span>`).join("");
    return `<section class="ev-card tm-card">
      <div class="ev-head"><span class="ev-ico">🤝</span><span><b>${esc(t("Friend team"))}</b><small>${esc(mates.length ? tn(mates.length, "You and {n} friend, building together this week", "You and {n} friends, building together this week", { n: mates.length }) : t("Invite friends to build together"))}</small></span></div>
      <p class="ev-how">${esc(t("Every home you or your friends build or grow this week counts. Each step pays everyone on the team."))}</p>
      <i class="ev-bar"><i style="width:${Math.min(100, (total / top) * 100).toFixed(1)}%"></i></i>
      <p class="ev-pts">${esc(t("{n} homes together", { n: fmt(total) }))}</p>
      <div class="ev-steps">${steps}</div>
      ${mates.length ? `<div class="tm-mates">${who}</div>` : ""}
      <button type="button" class="ev-pass tm-invite" data-goal="invite">${esc(t("📨 Invite a friend"))}</button>
    </section>`;
  }

  /** This week's Community Spire, as last heard from the server. */
  spire: SpireNow | null = null;

  /** The Community Spire card: everyone's perfect floors this week, one shared tower. */
  private spireHtml(): string {
    const sp = this.spire;
    if (!sp) return "";
    const top = SPIRE_GOALS[SPIRE_GOALS.length - 1].floors, pct = Math.min(100, (sp.floors / top) * 100);
    const ready = spireReady(this.save.spire, sp), next = SPIRE_GOALS.find(g => sp.floors < g.floors);
    const ticks = SPIRE_GOALS.map(g => `<i class="spire-tick${sp.floors >= g.floors ? " on" : ""}" style="bottom:${(g.floors / top) * 100}%"><b>+${g.stars} ★</b></i>`).join("");
    const action = ready
      ? `<button type="button" class="card-main spire-claim" data-goal="spire">${esc(t("Collect +{n} ★", { n: SPIRE_GOALS.slice(this.save.spire.week === sp.week ? this.save.spire.claimed : 0).slice(0, ready).reduce((a, g) => a + g.stars, 0) }))}</button>`
      : `<small class="spire-hint">${esc(sp.mine ? t("You added {n} floors this week. Every height reached pays everyone who built.", { n: fmt(sp.mine) }) : t("Build a Classic or Daily tower: your perfect drops add floors, and every height reached pays everyone who built."))}</small>`;
    return `<h3 class="sheet-sub">${esc(t("Community Spire"))}</h3>
      <div class="spire-card"><div class="spire-art" aria-hidden="true"><i class="spire-fill" style="height:${pct}%"></i>${ticks}</div>
      <div class="spire-txt"><b>${esc(t("{n} perfect floors this week", { n: fmt(sp.floors) }))}</b>
      <small>${esc(t("{n} builders", { n: fmt(sp.builders) }))}${next ? ` · ${esc(t("next reward at {n}", { n: fmt(next.floors) }))}` : ` · ${esc(t("all rewards reached!"))}`}</small>${action}</div></div>`;
  }

  /** The daily spin wheel (made the first time it opens). */
  private spinWheel?: SpinWheel;
  openSpin(): void {
    this.spinWheel ??= new SpinWheel(this.host, () => { if (!$("tcy-goalsheet").hidden) this.renderGoalsSheet(); this.host.refresh(); });
    this.spinWheel.open();
  }
  /** The Goals sheet's way to the wheel: a red dot while today's free spin waits. */
  private spinEntryHtml(): string {
    const s = this.save, free = spinFree(s);
    const sub = free ? t("Your free spin is ready!") : spinAdLeft(s) && adsReady() ? t("Watch an ad for one more spin") : t("Next free spin in {time}", { time: nextSpinIn() });
    return `<button type="button" class="spin-entry${free ? " ready" : ""}" data-goal="spin"><span class="spin-entry-ico" aria-hidden="true">🎡</span><span><b>${esc(t("Daily spin"))}</b><small>${esc(sub)}</small></span>${free ? `<i class="dot"></i>` : ""}</button>`;
  }

  private renderGoalsSheet(): void {
    const s = this.save, parts: string[] = [];
    if (!$("mayor-strip").hidden) {
      parts.push(`<h3 class="sheet-sub">${esc(t("Story"))}</h3><button type="button" class="mayor-strip more-mayor${$("mayor-strip").classList.contains("ready") ? " ready" : ""}" data-goal="story">${$("mayor-strip").innerHTML}</button>`);
    }
    dealGoals(s);
    if (spinOpen(s, HAS_CITY)) parts.push(this.spinEntryHtml());
    // The week's city event first (it has the best rewards), then today's goals.
    if (HAS_CITY && s.tycoon.tips >= 3) parts.push(this.seasonPassHtml(), this.eventHtml(), this.teamHtml(), this.milestoneHtml());
    parts.push(`<h3 class="sheet-sub">${esc(HAS_CITY ? t("Today's city quests") : t("Today's company goals"))}</h3>${this.goalsHtml()}`);
    // The side activities wait until the story is well under way, so a new player's goals are
    // the town's: the chapter (the next rank) and today's company goals.
    const later = s.chapters.done >= 2;
    if (later && !HAS_CITY) parts.push(this.spireHtml());
    if (!HAS_CITY && later && !$("missions-btn").hidden && s.missions.slots.length) {
      const rows = s.missions.slots.map(m => {
        const done = !!m.d || m.p >= m.n;
        return `<div class="ty-goal${done ? " done" : ""}"><span class="ty-goal-check">${done ? "✓" : "★"}</span><span><b>${esc(missionText(m))}</b>
          <i class="ty-goal-bar"><i style="width:${Math.min(100, (m.p / m.n) * 100)}%"></i></i></span><em>${done ? esc(t("Done")) : `${Math.min(m.p, m.n)}/${m.n}`}<small>+${m.r} ★</small></em></div>`;
      }).join("");
      parts.push(`<h3 class="sheet-sub">${esc(t("Tower missions"))}</h3><div class="ty-goals">${rows}</div><button type="button" class="card-small goals-more" data-goal="missions">${esc(t("See missions and rewards"))} →</button>`);
    }
    if (HAS_CITY) parts.push(this.albumHtml());
    $("tcy-goals").innerHTML = parts.join("");
  }

  private onGoalsTap(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>("[data-goal]");
    if (!el) return;
    if (this.onEventTap(el)) return;
    if (el.dataset.goal === "spin") { this.host.sound.click(); this.openSpin(); return; }
    if (el.dataset.goal === "spire") {
      const s = this.save, stars = this.spire ? claimSpire(s.spire, this.spire) : 0;
      if (stars) {
        const cash = payStars(s, stars);
        this.host.persist(); this.host.sound.unlock();
        burst(el, 20);
        toast(cash ? t("🗼 Community Spire: +{n}", { n: coins(cash) }) : t("🗼 Community Spire: +{n} ★", { n: stars }));
        track("spire_claimed", { stars }, false);
        this.renderGoalsSheet();
        this.host.refresh();
      }
      return;
    }
    closeModal($("tcy-goalsheet"));
    if (el.dataset.goal === "story") $("mayor-strip").click();
    else $("missions-btn").click();
  }

  /** More: everything else, in one simple grid. */
  // ---------- The tab bar: Shop, Company, BUILD, Goals, Me ----------
  // Each tab is a full page between the top bar (cash, gems) and the tab bar, which both stay;
  // tapping another tab switches straight to it, tapping the open one closes it. Goals and Me
  // hold several pages, switched by the chips at their top.
  private tabDefs(): Record<string, { id: string; name: string; open: () => void; show?: () => boolean }[]> {
    return {
      shop: [{ id: "shop", name: "Shop", open: () => $("shop-btn").click() }],
      company: [{ id: "tycoon", name: "Company", open: () => this.openSheet("company") }],
      goals: [
        { id: "tcy-goalsheet", name: "Goals", open: () => this.openGoals() },
        { id: "pass", name: "Sky Pass", open: () => $("pass-btn").click(), show: () => !HAS_CITY && !$("pass-btn").hidden },
      ],
      me: [
        { id: "profile", name: "Profile", open: () => $("level-btn").click() },
        { id: "ranks", name: "Leaders", open: () => $("ranks-btn").click(), show: () => !$("ranks-btn").hidden },
        { id: "scrapbook", name: "Scrapbook", open: () => this.openScrapbook() },
        { id: "collection", name: "Buildings", open: () => this.openCollection(), show: () => HAS_CITY },
        { id: "city", name: "Sky City", open: () => $("city-btn").click(), show: () => !HAS_CITY && !$("city-btn").hidden },
        { id: "settings", name: "Settings", open: () => $("settings-btn").click() },
      ],
    };
  }
  private lastPage: Record<string, string> = {};
  currentTab(): string {
    for (const [k, pages] of Object.entries(this.tabDefs())) if (pages.some(p => !$(p.id).hidden)) return k;
    return "";
  }
  closeTabs(): void {
    for (const pages of Object.values(this.tabDefs())) for (const p of pages) if (!$(p.id).hidden) closeModal($(p.id));
  }
  openTab(k: string): void {
    const cur = this.currentTab();
    this.closeTabs();
    if (cur === k) return;
    const pages = this.tabDefs()[k].filter(p => !p.show || p.show());
    (pages.find(p => p.id === this.lastPage[k]) ?? pages[0])?.open();
  }
  /** Marks the open tab, adds the page chips to grouped tabs, and lays the pages out. */
  private wireTabs(): void {
    const defs = this.tabDefs();
    const sync = () => {
      const k = this.currentTab();
      document.body.classList.toggle("tabs-open", !!k && this.inCity);
      $("tcy-bar").querySelectorAll<HTMLElement>("[data-open]").forEach(b => b.classList.toggle("on", b.dataset.open === k));
      if (!k) return;
      const pages = defs[k].filter(p => !p.show || p.show()), open = pages.find(p => !$(p.id).hidden);
      if (!open) return;
      this.lastPage[k] = open.id;
      const sheet = $(open.id).querySelector<HTMLElement>(".sheet")!;
      // One header on every page: the tab's name on the left, × on the right, and the page
      // chips under them when the tab holds several pages. It stays pinned while the page scrolls.
      let head = sheet.querySelector<HTMLElement>(":scope > .tab-head");
      if (!head) {
        head = document.createElement("div");
        head.className = "tab-head";
        head.innerHTML = `<div class="th-row"><h2 class="th-title"></h2><button type="button" class="tab-x" aria-label="${esc(t("Close"))}">×</button></div>`;
        head.querySelector<HTMLElement>(".tab-x")!.onclick = () => { this.host.sound.click(); this.closeTabs(); };
        sheet.prepend(head);
      }
      head.querySelector(".th-title")!.textContent = t(TAB_TITLE[k] ?? k);
      // The page's own tabs (Shop's shelves, the Company's panels) pin right under the header.
      const sub = [...sheet.children].find(c => c.matches(".ty-tabs") || (c.matches(".sheet-top") && !!c.querySelector<HTMLElement>(":scope > .tabs")?.offsetParent));
      // What this page is for, in one line, until the player says "Got it" (then never again).
      const introKey = `intro-${k}`;
      let intro = sheet.querySelector<HTMLElement>(":scope > .page-intro");
      if (PAGE_INTRO[k] && !this.save.seenFeatures.includes(introKey)) {
        if (!intro) {
          intro = document.createElement("div");
          intro.className = "page-intro";
          intro.innerHTML = `<span class="pi-ico">?</span><p>${esc(t((HAS_CITY && PAGE_INTRO_CITY[k]) || PAGE_INTRO[k]))}</p><button type="button">${esc(t("Got it"))}</button>`;
          intro.querySelector("button")!.onclick = () => { this.save.seenFeatures.push(introKey); this.host.persist(); for (const p of pages) $(p.id).querySelector(".page-intro")?.remove(); };
        }
        (sub ?? head).after(intro);
      } else intro?.remove();
      let seg = head.querySelector<HTMLElement>(".tab-seg");
      if (pages.length < 2) seg?.remove();
      else {
        if (!seg) { seg = document.createElement("div"); seg.className = "tab-seg"; head.append(seg); }
        seg.innerHTML = pages.map(p => `<button type="button" data-page="${p.id}"${p.id === open.id ? ` class="on"` : ""}>${esc(t(p.name))}</button>`).join("");
      }
      const hd = head;
      requestAnimationFrame(() => sheet.style.setProperty("--tab-head", `${hd.offsetHeight}px`));
      if (!seg) return;
      seg.onclick = e => {
        const id = (e.target as Element).closest<HTMLElement>("[data-page]")?.dataset.page;
        const to = pages.find(p => p.id === id);
        if (!to || to.id === open.id) return;
        this.host.sound.click();
        closeModal($(open.id));
        to.open();
        // A page switched to starts at its top.
        requestAnimationFrame(() => { const sh = $(to.id).querySelector<HTMLElement>(".sheet"); if (sh && to.id !== "profile") sh.scrollTop = 0; });
      };
    };
    const watch = new MutationObserver(sync);
    for (const pages of Object.values(defs)) for (const p of pages) {
      $(p.id).classList.add("tab-page");
      watch.observe($(p.id), { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  private openMore(): void {
    const s = this.save, p = s.profile, title = titleFor(p.level), need = xpNeeded(p.level);
    const dotOf = (id: string) => !!$(id).querySelector(".dot:not([hidden]), .new-dot:not([hidden])");
    const shown = (id: string) => !$(id).hidden;
    // Who you are: name, title and level (tap for the profile), stars, and a gear for settings.
    const me = `<div class="more-me">
      <button type="button" class="more-me-main" data-src="level-btn"><span class="more-av" style="--tc:${title.color}">${title.icon}</span>
        <span class="more-me-txt"><b>${esc(s.nickname || t("Builder"))}</b><small>${esc(t(title.name))} · ${esc(t("Level {n}", { n: p.level }))}</small><i class="more-xp"><i style="width:${Math.min(100, (p.xp / need) * 100).toFixed(0)}%"></i></i></span></button>
      ${HAS_CITY ? "" : `<span class="more-stars">★ ${fmt(s.stars)}</span>`}
      <button type="button" class="more-gear" data-src="settings-btn" aria-label="${esc(t("Settings"))}"><svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.4 4.6l1.6 1.2-1.6 2.8-1.9-.7a7 7 0 01-1.6.9l-.3 2H12.8l-.3-2a7 7 0 01-1.6-.9l-1.9.7-1.6-2.8 1.6-1.2a7 7 0 010-1.8L7.4 10l1.6-2.8 1.9.7a7 7 0 011.6-.9l.3-2h3.2l.3 2c.6.2 1.1.5 1.6.9l1.9-.7 1.6 2.8-1.6 1.2a7 7 0 010 1.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
    </div>`;
    // What's inside each place, at a glance.
    const tile = (src: string, ico: string, name: string, sub: string, tone: string, show = true) => !show ? "" :
      `<button type="button" class="more-tile tone-${tone}" ${src === "company" ? `data-company="1"` : `data-src="${src}"`}><span class="more-ico">${ico}</span><span class="more-txt"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${src !== "company" && dotOf(src) ? `<i class="dot"></i>` : ""}</button>`;
    const owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0).length;
    $("tcy-more").innerHTML = me + `<div class="more-grid">
      ${tile("company", "🏢", t("My company"), t("{n} of {total} businesses", { n: owned, total: BUSINESSES.length }), "violet")}
      ${tile("shop-btn", "🛍️", t("Shop"), t("Town decorations, crystals, skins"), "pink", shown("shop-btn"))}
      ${tile("pass-btn", "🎟️", t("Sky Pass"), dotOf("pass-btn") ? t("Rewards to claim!") : t("This month's rewards"), "orange", shown("pass-btn"))}
      ${tile("ranks-btn", "🏆", t("Leaderboard"), t("Beat the best builders"), "gold", shown("ranks-btn"))}
      ${tile("city-btn", "🏙️", t("Sky City"), t("{n} people", { n: fmt(s.population) }), "blue", shown("city-btn"))}
    </div>`;
    openModal($("tcy-moresheet"));
  }

  private onMoreTap(e: Event): void {
    if ((e.target as Element).closest("[data-company]")) { closeModal($("tcy-moresheet")); this.openSheet("company"); return; }
    const el = (e.target as Element).closest<HTMLElement>("[data-src]");
    if (!el) return;
    closeModal($("tcy-moresheet"));
    $(el.dataset.src!).click();
  }

  /** Live moments while the tower is open: VIPs, critics, power cuts and rush hours. */
  private events(now: number): void {
    const s = this.save, owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0);
    // Golden customers: the first a few minutes in, then every 15-30 minutes, a few a day.
    if (owned.length && s.tycoon.tips >= 3 && this.inCity) {
      if (!this.nextGolden) this.nextGolden = now + 150000 + Math.random() * 150000;
      if (this.golden.id && this.golden.until < now) { this.golden.id = ""; this.render(); }
      if (!this.golden.id && now > this.nextGolden) {
        this.nextGolden = now + 900000 + Math.random() * 900000;
        if (goldenArrives(s, now)) {
          this.golden = { id: owned[Math.floor(Math.random() * owned.length)].id, until: now + GOLDEN_SECONDS * 1000 };
          this.host.sound.unlock();
          vibrate(s.settings.vibrate, [10, 40, 10]);
          this.host.persist();
          this.render();
        }
      }
    }
    // Nothing pops up while a new player learns, and never two things at once.
    if (!owned.length || s.tycoon.tips < 3 || owned.length < 2) return;
    const pick = () => owned[Math.floor(Math.random() * owned.length)];
    const busy = () => (this.vip.id && this.vip.until > now) || (this.critic.id && this.critic.until > now) || (this.power.id && this.power.until > now) || rushOn(s, s.tycoon.rush.id, now);
    if (this.vip.id && this.vip.until < now) { this.vip.id = ""; this.render(); }
    if (!this.vip.id && now > this.nextVip && !busy()) {
      this.vip = { id: pick().id, until: now + 9000 };
      this.vipFresh = true;
      this.nextVip = now + (45000 + Math.random() * 30000) / vipRate(s);
      this.render();
    }
    if (this.critic.id && this.critic.until < now) { this.critic.id = ""; this.render(); }
    if (!this.critic.id && now > this.nextCritic && !busy()) {
      this.critic = { id: pick().id, until: now + 12000 };
      this.nextCritic = now + 240000 + Math.random() * 120000;
      this.render();
    }
    if (this.power.id && this.power.until < now) { this.power.id = ""; this.render(); }
    // The weather plays a part: storms bring trouble more often (a roof to secure), and a
    // summer heatwave brings more rush hours.
    const weather = HAS_CITY ? this.host.weatherNow() : "clear", stormy = weather === "rain" || weather === "snow";
    const mo = new Date(now).getMonth() + 1, hot = HAS_CITY && weather === "clear" && (mo >= 6 && mo <= 8 || citySeason() === "summer");
    if (!this.power.id && now > this.nextPower && !busy()) {
      this.power = { id: pick().id, until: now + 15000, taps: 5 };
      this.nextPower = now + (180000 + Math.random() * 120000) * (stormy ? 0.5 : 1);
      this.render();
    }
    if (now > this.nextRush && !busy()) {
      this.nextRush = now + (180000 + Math.random() * 120000) * (hot ? 0.6 : 1);
      const id = startRush(s, now);
      if (id) {
        toast(hot ? t("☀️ Heatwave! Everyone's at {name}: ×{n} for a while", { name: t(stageName(id, stageNow(s, id))), n: RUSH_MULT })
          : t("Rush hour at {name}! ×{n} for a while", { name: t(stageName(id, stageNow(s, id))), n: RUSH_MULT }));
        this.host.sound.unlock();
        this.goal("rush");
        this.render();
        if (this.tab === "company") $("ty-list").querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    const rush = rushOn(s, s.tycoon.rush.id, now) ? s.tycoon.rush.id : "";
    if (rush !== this.rushWas) { this.rushWas = rush; this.render(); }
    if (rush) {
      const left = $("ty-list").querySelector(".rush-tag i");
      if (left) left.textContent = `${Math.ceil((s.tycoon.rush.until - now) / 1000)}s`;
    }
  }

  /** A business grew into its next stage: a big moment. */
  evolve(id: string, from: number, to: number): void {
    const b = BUSINESSES.find(x => x.id === id)!;
    const el = overlay();
    el.style.setProperty("--b1", b.color[0]);
    el.style.setProperty("--b2", b.color[1]);
    el.innerHTML = `<div class="evo-card"><span class="evo-rays" aria-hidden="true"></span>
      <small>${esc(t("Your business evolved!"))}</small>
      <div class="evo-from">${esc(t(stageName(id, from)))}</div>
      <div class="evo-arrow">▼</div>
      <div class="evo-icon">${iconSvg(b.icon)}</div>
      <b class="evo-to">${esc(t(stageName(id, to)))}</b>
      <span class="evo-stars">${"★".repeat(to + 1)}<em>${"★".repeat(4 - to)}</em></span>
      <span class="evo-label">${esc(t(STAGE_LABEL[to]))}</span>
      <button type="button" class="btn btn-primary">${esc(t("Amazing!"))}</button>
    </div>`;
    showOverlay(el, () => this.host.sound.click());
    this.host.sound.unlock();
    fireworks(4, () => this.host.sound.firework());
    confetti();
    vibrate(this.save.settings.vibrate, [20, 40, 20]);
    this.render();
  }

  render(): void {
    const s = this.save, ty = s.tycoon, now = Date.now();
    $("ty-era").textContent = t("Era {n}", { n: ty.eras + 1 });
    if (this.shownCoins < 0) $("ty-coins").textContent = coins(ty.coins);
    { const ps = perSecond(s, now); $("ty-rate").textContent = ps > 0 ? t("{n} a second", { n: coins(ps) }) : t("Tap a business to sell"); }
    $("ty-mult").textContent = t("×{n} earnings", { n: multiplier(s, now).toFixed(2) });
    this.renderOffice();
    this.renderEvents(now);
    this.announceTabs();
    this.renderTabs();
    if (this.inCity) this.renderCity(now);
    this.photo?.sync();
    if ($("tycoon").hidden) return;
    if (this.tab === "company") { this.renderRooms(now); this.renderGoals(); }
    else if (this.tab === "upgrades") this.renderUpgrades();
    else if (this.tab === "team") this.renderAdvisors();
    else { this.renderBoosts(); this.renderEra(); }
  }

  /** Dots on the tabs where something can be done. */
  /** When each part of the company opens up (so a new player isn't shown everything at once). */
  private tabOpen(tab: string): boolean {
    const ty = this.save.tycoon, owned = BUSINESSES.filter(b => levelOf(this.save, b.id) > 0).length;
    if (tab === "upgrades") return ty.tips >= 3;
    if (tab === "team") return owned >= 3 || ty.advisors.length > 0;
    if (tab === "boosts") return owned >= 4 || ty.boost || ty.gems > 0 || ty.eras > 0 || eraGems(this.save) > 0;
    return true;
  }

  /** A part of the company opening for the first time: a one-time "New!" moment. */
  private announceTabs(): void {
    const s = this.save, names: Record<string, string> = { upgrades: "Upgrades", team: "Team", boosts: "Boosts" };
    for (const tab of ["upgrades", "team", "boosts"]) {
      const key = `ty-${tab}`;
      if (!this.tabOpen(tab) || s.seenFeatures.includes(key)) continue;
      s.seenFeatures.push(key);
      this.host.persist();
      toast(t("New in your company: {name}!", { name: t(names[tab]) }));
      this.host.sound.unlock();
    }
  }

  private renderTabs(): void {
    for (const b of $("tycoon").querySelectorAll<HTMLElement>(".ty-tabs button")) b.hidden = !this.tabOpen(b.dataset.tab!);
    const open = [...$("tycoon").querySelectorAll<HTMLElement>(".ty-tabs button")].filter(b => !b.hidden).length;
    $("tycoon").querySelector<HTMLElement>(".ty-tabs")!.hidden = open < 2;
    const s = this.save, dot = (tab: string, on: boolean) => { $("tycoon").querySelector<HTMLElement>(`.ty-tabs [data-tab="${tab}"] .dot`)!.hidden = !on || this.tab === tab; };
    dot("upgrades", false);
    dot("team", s.tycoon.picks > 0 && ADVISORS.some(a => !s.tycoon.advisors.includes(a.id)));
    dot("boosts", eraGems(s) > 0);
  }

  /** The company as a cut-away skyscraper in the sky: a roof with the company sign, one
   *  room per business (newest at the top) and the lobby. The rooms' layout is rebuilt only
   *  when something in it changes; numbers are written in place. */
  private renderRooms(now: number): void {
    const s = this.save, ty = s.tycoon, list = $("ty-list");
    // Time of day outside the windows.
    const h = new Date(now).getHours();
    const sky = s.settings.sky;
    $("ty-sky").className = `ty-sky ${sky === "day" ? "tod-day" : sky === "night" ? "tod-night" : h >= 20 || h < 6 ? "tod-night" : h >= 17 || h < 8 ? "tod-dusk" : "tod-day"}`;
    const rows: string[] = [];
    BUSINESSES.forEach((b, i) => {
      if (!shownBusiness(s, i)) return;
      rows.push(this.roomHtml(b, i, now));
    });
    const step = ty.tips;
    let html = `<div class="tw-roof"><span class="tw-antenna"></span><b>${esc(t("Skyhaven Inc."))}</b><span class="tw-flag"></span></div><div class="tw-shaft" aria-hidden="true"><i class="tw-car"></i></div>`;
    for (const r of rows.reverse()) {
      if (step < 3 && r.includes('data-id="coffee"')) html += this.coach();
      html += r;
    }
    html += `<div class="tw-lobby"><span class="tw-plant"></span><span class="tw-door"></span><span class="tw-door"></span><span class="tw-plant"></span><b>${esc(t("Lobby"))}</b></div>`;
    if (this.put(list, html)) this.vipFresh = false;
    this.patchRooms(now);
  }

  private roomHtml(b: (typeof BUSINESSES)[number], i: number, now: number): string {
    const s = this.save, ty = s.tycoon;
    const lv = levelOf(s, b.id), owned = lv > 0, managed = ty.managers.includes(b.id);
    const stage = owned ? stageNow(s, b.id) : 0, rush = owned && rushOn(s, b.id, now), name = t(stageName(b.id, stage));
    const grow = owned ? readyStage(s, b.id) : 0, fest = festivalBiz(now) === b.id;
    const people = owned ? Math.min(3 + stage * 2, 1 + Math.floor(Math.log2(lv + 1))) : 0;
    const pr = PROPS[b.id] ?? [b.icon];
    const props = Array.from({ length: Math.min(5, 2 + stage) }, (_, k) => `<span class="rp rp${k}">${iconSvg(pr[k % pr.length])}</span>`).join("");
    const vip = owned && this.vip.id === b.id && this.vip.until > now;
    const walkers = Array.from({ length: people }, (_, k) => {
      const look = LOOKS[(k + i * 3) % LOOKS.length];
      return `<i class="walker" style="--d:${((k * 1.7) % 5).toFixed(1)}s;--t:${5 + ((k * 3) % 4)}s;--x:${12 + ((k * 37) % 60)}%;--shirt:${look[0]};--skin:${look[1]};--hair:${look[2]}">${PERSON}</i>`;
    }).join("");
    const coach = ty.tips < 3 && b.id === "coffee" ? ty.tips : -1;
    const noRoom = freeFloors(s) < 1;
    return `<div class="ty-biz room st${stage} biz-${b.id}${owned ? "" : " locked"}${managed ? " managed" : ""}${rush ? " rush" : ""}" ${owned ? `data-id="${b.id}"` : ""} data-biz="${b.id}" style="--b1:${b.color[0]};--b2:${b.color[1]}">
      <button type="button" class="room-scene${coach === 0 ? " coach-here" : ""}" data-act="run" aria-label="${esc(owned ? t("Run {name}", { name }) : name)}">
        <span class="room-wall"></span><span class="room-window"><i class="room-cloud"></i></span>
        <span class="room-lamp l1"></span><span class="room-lamp l2"></span>
        ${stage >= 1 ? `<span class="room-awning"></span>` : ""}${stage >= 2 ? `<span class="room-light"></span>` : ""}${stage >= 4 ? `<span class="room-chand"></span><span class="room-sparkle"></span>` : ""}
        <span class="room-sign">${iconSvg(b.icon)}<b>${esc(name)}</b></span>
        ${((u: string) => u ? `<img class="room-thumb${owned ? "" : " ghost"}" alt="" src="${u}">` : "")(thumbFor(b, stage))}
        ${owned ? `<span class="room-medal"><b></b><small>${esc(HAS_CITY ? t("Level") : t("floors"))}</small></span><span class="room-next"><small></small><i><i></i></i></span>` : ""}
        ${managed ? `<span class="room-mgr" aria-label="${esc(t("Manager"))}">${PERSON_BOSS}</span>` : ""}
        ${owned ? `<span class="room-path" aria-label="${esc(t(STAGE_LABEL[stage]))}">${STAGE_AT.map((_, k) => `<i class="${k < stage ? "done" : k === stage ? "now" : ""}"></i>`).join("")}</span>` : ""}
        ${owned && !grow ? `<span class="room-stars" aria-label="${esc(t(STAGE_LABEL[stage]))}">${"★".repeat(stage + 1)}</span>` : ""}
        ${grow ? `<span class="hq-tag">${esc(t("Ready to grow!"))}</span>` : ""}
        ${fest && owned ? `<span class="fest-tag">${esc(t("Festival ×2"))}</span>` : ""}
        ${owned && (ty.reviews[b.id] ?? 0) > now ? `<span class="review-tag">★★★★★</span>` : ""}
        ${rush ? `<span class="rush-tag">${esc(t("RUSH ×{n}", { n: RUSH_MULT }))} <i></i></span>` : ""}
        ${owned ? `<span class="room-shelf">${props}</span><span class="room-fx fx-${b.id}" aria-hidden="true"><i></i><i></i><i></i></span><span class="room-counter"><i class="register"></i></span>${walkers}` : `<span class="room-lease">${esc(t("For lease"))}</span>`}
        ${managed ? `<i class="walker boss" style="--x:74%;--skin:#f2c39a">${PERSON_BOSS}</i>` : ""}
        ${owned && this.critic.id === b.id && this.critic.until > now ? `<span class="critic" data-act="critic" role="button" aria-label="${esc(t("Food critic: tap to serve"))}"><i>${esc(t("Critic"))}</i>${PERSON_CRITIC}<em>${esc(t("Serve me!"))}</em></span>` : ""}
        ${vip ? `<span class="vip${this.vipFresh ? " fresh" : ""}" data-act="vip" role="button" aria-label="${esc(t("VIP customer: tap for a tip"))}"><i>VIP</i>${PERSON_VIP}<em>${esc(t("Tap!"))}</em></span>` : ""}
        ${owned && this.power.id === b.id && this.power.until > now ? `<span class="power-cut" data-act="power" role="button"><b>${esc(this.stormy() ? t("Storm!") : t("Power cut!"))}</b><small></small></span>` : ""}
        ${owned ? `<b class="room-level"></b>` : ""}
        ${owned && !managed ? `<span class="tap-me">${esc(t("Tap!"))}</span>` : ""}
        <span class="room-pops"></span>
        <div class="ty-prog"><i></i><span></span></div>
      </button>
      ${owned ? `<div class="room-stats"><span class="rs rs-ps"><small>${esc(t("Per second"))}</small><b></b></span><span class="rs rs-cyc"><small>${esc(t("Each sale"))}</small><b></b></span><span class="rs rs-mult"><small>${esc(t("Bonus"))}</small><b></b></span></div>` : ""}
      <div class="room-bar">
        ${grow ? `<button type="button" class="hq-btn" data-act="hq">${esc(t("Build the {name} HQ", { name: t(stageName(b.id, grow)) }))}<em>${esc(HAS_CITY ? coins(hqPrice(s, b.id)) : t("{n} floors", { n: hqFloors(grow) }))}</em></button>` : `<small class="room-info"></small>`}
        ${owned && !managed ? `<button type="button" class="ty-hire${coach === 2 ? " coach-here" : ""}" data-act="hire"></button>` : managed ? `<span class="ty-auto">${esc(t("Auto"))}</span>` : ""}
        <button type="button" class="buy ty-buy${noRoom ? " need-floors" : ""}${coach === 1 ? " coach-here" : ""}" data-act="buy"></button>
      </div>
    </div>`;
  }

  /** Writes the numbers into the rooms without rebuilding them. */
  private patchRooms(now: number): void {
    const s = this.save, ty = s.tycoon;
    const set = (el: Element | null, v: string, html = false) => {
      if (!el) return;
      if (html) { if ((el as HTMLElement).dataset.v !== v) { (el as HTMLElement).dataset.v = v; el.innerHTML = v; } } else if (el.textContent !== v) el.textContent = v;
    };
    for (const row of $("ty-list").querySelectorAll<HTMLElement>(".ty-biz")) {
      const b = BUSINESSES.find(x => x.id === row.dataset.biz)!, lv = levelOf(s, b.id), owned = lv > 0;
      const room = Math.max(1, freeFloors(s));
      const n = !owned ? 1 : Math.min(room, this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
      const price = costOf(b, lv, n), next = nextMilestone(lv), ns = owned ? STAGE_AT[stageNow(s, b.id) + 1] : undefined;
      // On the Company page the banner says it all in one line: floors, and what's next.
      const cards = document.body.classList.contains("city-home");
      const nextLine = !owned ? "" : ns && lv >= ns ? t("Ready to grow into {name}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)) }) : ns && ns <= (next ?? Infinity) ? t("Next: {name} at {n}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)), n: ns })
        : next ? t("×2 speed at {n}", { n: next }) : t("Top speed!");
      set(row.querySelector(".room-level"), (HAS_CITY ? t("Level {n}", { n: fmt(lv) }) : tn(lv, "{n} floor", "{n} floors", { n: fmt(lv) })) + (cards && nextLine ? ` · ${nextLine}` : ""));
      set(row.querySelector(".ty-prog span"), owned ? t("{n} a sale", { n: coins(payOf(s, b, now)) }) : t("Earns {n} a sale", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".room-info"), owned
        ? (ns && lv >= ns ? t("Ready to grow into {name}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)) }) : ns && ns <= (next ?? Infinity) ? t("Grows into {name} at {n}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)), n: ns })
          : next ? (HAS_CITY ? t("Level {n}: it sells twice as fast", { n: fmt(next) }) : t("{n} floors: twice as fast", { n: next })) : t("Top speed!")) + " · " + fmtSec(cycleOf(b, lv))
        : t("Open it to earn {n} a cycle", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".power-cut small"), t("Tap {n} times to fix", { n: this.power.taps }));
      if (owned) {
        // The floors badge, and a bar toward what's next (the next stage or speed boost).
        set(row.querySelector(".room-medal b"), fmt(lv));
        // Past the next stage's floors but its HQ isn't built yet: ready to grow.
        const hqReady = !!ns && lv >= ns;
        const stageNext = ns && (hqReady || ns <= (next ?? Infinity)), target = stageNext ? ns! : next;
        const prevAt = Math.max(0, ...[...STAGE_AT, ...MILESTONES_AT].filter(x => x <= lv));
        set(row.querySelector(".room-next small"), hqReady ? t("Ready: build the {name} HQ!", { name: t(stageName(b.id, stageNow(s, b.id) + 1)) })
          : target ? `${stageNext ? t(stageName(b.id, stageNow(s, b.id) + 1)) : t("×2 speed")} · ${fmt(lv)} / ${fmt(target)}`
          : t("Top speed!"));
        const nb = row.querySelector<HTMLElement>(".room-next i i");
        if (nb) nb.style.width = `${hqReady ? 100 : target ? Math.max(4, Math.min(100, ((lv - prevAt) / Math.max(1, target - prevAt)) * 100)).toFixed(1) : 100}%`;
        // What it makes a second (managers sell non-stop; without one, a sale when you tap),
        // how long a sale takes, and all its bonuses together.
        const cyc = cycleOf(b, lv), pay = payOf(s, b, now), auto = ty.managers.includes(b.id);
        set(row.querySelector(".rs-ps b"), auto ? coins(pay / cyc) : t("Tap to sell"));
        set(row.querySelector(".rs-cyc b"), fmtSec(cyc));
        set(row.querySelector(".rs-mult b"), `×${fmtMult(bizMult(s, b, now))}`);
      }
      const hire = row.querySelector<HTMLButtonElement>(".ty-hire");
      if (hire) { set(hire, cards ? `<small>${esc(t("Manager"))}</small>${esc(coins(b.manager))}` : `${esc(t("Hire manager"))} · ${esc(coins(b.manager))}`, true); hire.disabled = ty.coins < b.manager; }
      const buy = row.querySelector<HTMLButtonElement>(".ty-buy")!;
      if (buy.classList.contains("need-floors")) set(buy, `<small>${esc(t("No empty floors"))}</small>${esc(t("Build"))}`, true);
      else {
        // What buying adds: per second with a manager, else per sale.
        let gain = "";
        if (owned && cards) {
          const pay = payOf(s, b, now), after = (pay / lv) * (lv + n);
          gain = ty.managers.includes(b.id) ? `+${coins(after / cycleOf(b, lv + n) - pay / cycleOf(b, lv))}/s` : `+${coins(after - pay)} ${t("a sale")}`;
        }
        set(buy, `<small>${esc(owned ? t("Buy ×{n}", { n: fmt(n) }) : t("Open"))}${gain ? ` <em>${esc(gain)}</em>` : ""}</small>${COIN_SVG}${esc(coins(price))}`, true);
        buy.disabled = !(price <= ty.coins && (this.amount !== "max" || affordable(b, lv, ty.coins) > 0)) || !unlockedBusiness(s, BUSINESSES.indexOf(b));
      }
    }
  }

  /** Every tap in the tower lands here. */
  private onListClick(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>("[data-act]");
    const row = el?.closest<HTMLElement>(".ty-biz");
    if (!el || !row) return;
    if (el.dataset.act !== "run") e.stopPropagation();
    this.doAct(el.dataset.act!, row.dataset.biz!, el, e as MouseEvent, row.querySelector(".room-pops")!, row.querySelector(".room-scene")!);
  }

  /** Catching the golden customer: a big tip, gold everywhere. */
  private catchGolden(popBox?: Element, flyFrom?: Element): void {
    const s = this.save, id = this.golden.id;
    if (!id || this.golden.until < Date.now()) return;
    this.golden.id = "";
    const tip = goldenTip(s);
    this.eventAdd("golden");
    this.goal("golden");
    const tag = $("tcy-labels").querySelector<HTMLElement>(`[data-tag="${id}"]`);
    const box = popBox ?? tag?.querySelector(".tag-pops") ?? $("tcy-labels"), from = flyFrom ?? tag ?? $("tcy-next");
    for (let k = 0; k < 8; k++) setTimeout(() => popCoin(box, k === 0 ? coins(tip) : ""), k * 80);
    for (let k = 0; k < 8; k++) setTimeout(() => flyCoin(from, this.inCity && $("tycoon").hidden ? "tcy-coins" : "ty-coins"), k * 60);
    fireworks(2, () => this.host.sound.firework());
    this.host.sound.coins();
    vibrate(s.settings.vibrate, [20, 40, 20]);
    this.pulse = { id, at: Date.now() };
    toast(t("✨ The golden customer tipped {n}!", { n: coins(tip) }));
    this.host.persist();
    this.render();
  }

  /** What a tap does (from a room in the list, or a building in the city). */
  private doAct(act: string, id: string, el: HTMLElement, e: MouseEvent | null, popBox: Element, flyFrom: Element): void {
    const s = this.save, b = BUSINESSES.find(x => x.id === id)!;
    const name = t(stageName(b.id, stageNow(s, b.id)));
    switch (act) {
      case "run": {
        if (levelOf(s, b.id) === 0) return;
        if (e) ripple(el, e);
        if (runOnce(s, b.id)) {
          // The first coffee is served at once, so the player sees the cash arrive: the
          // cup is handed to the neighbor at the very moment the sale is credited.
          if (s.tycoon.tips === 0) {
            const due = Date.now() + FIRST_HANDOFF_MS;
            s.tycoon.runs[b.id] = due - cycleOf(b, levelOf(s, b.id)) * 1000;
            this.firstSale(due);
          }
          this.host.sound.click(); vibrate(s.settings.vibrate, 8);
          this.pulse = { id: b.id, at: Date.now() };
          this.goal("taps");
          if (s.tycoon.tips === 0) {
            s.tycoon.tips = 1; track("first_sale");
            // The first sale opens the doors: everything earns more for the first minutes.
            if (startOpening(s)) setTimeout(() => toast(t("🎉 Grand opening! Everything earns ×{n} for {m} minutes", { n: OPENING_MULT, m: OPENING_MINUTES })), 1200);
          }
          this.render();
        }
        return;
      }
      case "hq":
        this.host.sound.click();
        this.goHQ(b.id);
        return;
      case "golden": {
        this.catchGolden(popBox, flyFrom);
        return;
      }
      case "vip": {
        el.remove();
        if (this.vip.id !== b.id || this.vip.until < Date.now()) return;
        this.vip.id = "";
        const tip = vipTip(s, b.id);
        const box = popBox;
        for (let k = 0; k < 6; k++) setTimeout(() => popCoin(box, k === 0 ? coins(tip) : ""), k * 90);
        for (let k = 0; k < 4; k++) setTimeout(() => flyCoin(flyFrom, this.inCity && $("tycoon").hidden ? "tcy-coins" : "ty-coins"), k * 70);
        this.host.sound.coins();
        vibrate(s.settings.vibrate, 15);
        toast(t("A VIP tipped {n}!", { n: coins(tip) }));
        this.goal("vip");
        this.host.persist();
        this.render();
        return;
      }
      case "critic": {
        el.remove();
        if (this.critic.id !== b.id || this.critic.until < Date.now()) return;
        this.critic.id = "";
        review(s, b.id);
        this.host.sound.unlock();
        fireworks(1, () => this.host.sound.firework());
        toast(t("Five-star review! {name} earns ×2 for an hour", { name }));
        this.host.persist();
        this.render();
        return;
      }
      case "power": {
        if (this.power.id !== b.id || this.power.until < Date.now()) return;
        this.power.taps--;
        vibrate(s.settings.vibrate, 10);
        this.host.sound.click();
        el.classList.remove("zap"); void el.offsetWidth; el.classList.add("zap");
        if (this.power.taps > 0) { this.render(); return; }
        this.power.id = "";
        // (A storm's roof pays half again as much.)
        const storm = this.stormy(), got = vipTip(s, b.id) * (storm ? 1.5 : 1);
        if (storm) earn(s, got / 3);
        const box = popBox;
        for (let k = 0; k < 5; k++) setTimeout(() => popCoin(box, k === 0 ? coins(got) : ""), k * 90);
        this.host.sound.coins();
        toast(storm ? t("🌧️ Roof secured! The customers stayed dry: +{n}", { n: coins(got) }) : t("Lights back on! The customers stayed: +{n}", { n: coins(got) }));
        this.host.persist();
        this.render();
        return;
      }
      case "hire": {
        tick(s);
        if (!hireManager(s, b.id)) { this.host.sound.click(); return; }
        if (s.tycoon.tips < 3) s.tycoon.tips = 3;
        this.host.sound.unlock();
        burst(el, 16);
        toast(t("A manager now runs {name}, even while you're away", { name }));
        this.host.persist();
        this.render();
        return;
      }
      case "buy": {
        if (el.classList.contains("need-floors")) { toast(t("Every office floor is full. Build an office block for more!")); closeModal($("tycoon")); this.openBuild(); return; }
        tick(s);
        const lv = levelOf(s, b.id), owned = lv > 0, wasReady = !!readyStage(s, b.id);
        const got = buyLevels(s, b.id, owned ? this.amount : 1);
        if (!got) { this.host.sound.click(); if (freeFloors(s) >= 1) this.shortOffer(costOf(b, lv, 1) - s.tycoon.coins); return; }
        this.goal("buy", got);
        this.eventAdd(owned ? "level" : "business", owned ? got : 1);
        this.pulse = { id: b.id, at: Date.now() };
        if (s.tycoon.tips === 1) s.tycoon.tips = 2;
        const crossed = nextMilestone(lv) !== undefined && lv + got >= (nextMilestone(lv) ?? Infinity);
        this.host.sound.coins();
        burst(el, crossed ? 20 : 8);
        flyFrom.classList.remove("bump");
        void (flyFrom as HTMLElement).offsetWidth;
        flyFrom.classList.add("bump");
        if (owned && readyStage(s, b.id) && !wasReady) {
          toast(t("{name} is ready to grow! Build its new HQ", { name }));
          fireworks(1, () => this.host.sound.firework());
        }
        if (!owned) { toast(t("{name} is open!", { name: t(b.name) })); confetti(flyFrom as HTMLElement); }
        else if (crossed) { toast(t("{name} now runs twice as fast!", { name })); fireworks(2, () => this.host.sound.firework()); }
        this.checkRank();
        this.checkGrow();
        this.host.persist();
        this.render();
        return;
      }
    }
  }

  /** The hero's live chips: this week's festival, a construction boom. */
  private renderEvents(now: number): void {
    const s = this.save, f = BUSINESSES.find(b => b.id === festivalBiz(now))!;
    // This week's festival, only once the player owns that business (else it means nothing yet).
    const chips = levelOf(s, f.id) > 0 ? [`<span class="ty-chip fest">🎪 ${esc(t("Festival week: {name} ×{n}", { name: t(stageName(f.id, stageNow(s, f.id))), n: FESTIVAL_MULT }))}</span>`] : [];
    if (s.tycoon.boom > now) {
      const left = Math.ceil((s.tycoon.boom - now) / 1000);
      chips.unshift(`<span class="ty-chip boom">🏗️ ${esc(t("Construction boom ×{n} · {t}", { n: BOOM_MULT, t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }))}</span>`);
    }
    if (s.tycoon.opening > now) {
      const left = Math.ceil((s.tycoon.opening - now) / 1000);
      chips.unshift(`<span class="ty-chip boom opening">🎉 ${esc(t("Grand opening: everything ×{n} · {t}", { n: OPENING_MULT, t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }))}</span>`);
    }
    this.put($("ty-events"), chips.join(""));
  }

  /** Upgrades on offer: the next few, cheapest first. */
  private renderUpgrades(): void {
    const s = this.save, list = upgradesOnOffer(s).slice(0, 6);
    const el = $("ty-upgrades");
    if (!list.length) { this.put(el, `<p class="sheet-note">${esc(t("Every upgrade bought. What a company!"))}</p>`); return; }
    this.put(el, list.map(u => {
      const b = BUSINESSES.find(x => x.id === u.biz), can = s.tycoon.coins >= u.cost;
      const what = b ? t("{name} earns ×{n}", { name: t(stageName(b.id, stageNow(s, b.id))), n: u.mult }) : t("Every business earns ×{n}", { n: u.mult });
      const pct = Math.min(100, (s.tycoon.coins / u.cost) * 100);
      return `<div class="ty-up${can ? " ready" : ""}" style="--b1:${b?.color[0] ?? "#ffd23f"};--b2:${b?.color[1] ?? "#ff4f8b"}"><span class="ty-up-ico">${iconSvg(u.icon)}</span>
        <span><b>${esc(t(u.name))}</b><small>${esc(what)}</small><i class="ty-up-bar"><i style="width:${pct.toFixed(0)}%"></i></i></span>
        <button type="button" class="buy" data-up="${u.id}"${can ? "" : " disabled"}>${COIN_SVG}${esc(coins(u.cost))}</button></div>`;
    }).join(""));
  }

  private onUpgradeClick(e: Event): void {
    const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-up]");
    if (!btn) return;
    const s = this.save;
    tick(s);
    if (!buyUpgrade(s, btn.dataset.up!)) { this.host.sound.click(); return; }
    this.host.sound.purchase(); vibrate(this.save.settings.vibrate, [15, 30, 15]);
    burst(btn, 18);
    const u = UPGRADES.find(x => x.id === btn.dataset.up)!;
    toast(t("Upgrade bought: {name}!", { name: t(u.name) }));
    this.host.persist();
    this.render();
  }

  /** The advisor collection: every advisor's perk is shown, and any not on the team yet
   *  can be hired by choice for crystals (no random crates). */
  private renderAdvisors(): void {
    const s = this.save, have = s.tycoon.advisors;
    this.put($("ty-advisors"), `<div class="ty-adv-head"><b>${esc(t("{n} of {total} collected", { n: have.length, total: ADVISORS.length }))}</b><i class="ty-adv-meter"><i style="width:${(have.length / ADVISORS.length) * 100}%"></i></i></div>
      <div class="ty-adv-list">${ADVISORS.map(a => {
        const own = have.includes(a.id);
        return `<div class="ty-adv-row${own ? " own" : ""}" style="--o:${a.look.outfit}"><span class="ty-adv-face">${advisorSvg(a, true)}</span>
          <span class="ty-adv-txt"><b>${esc(t(a.name))} <small>${esc(t(a.title))}</small></b><em>${esc(perkText(a))}</em></span>
          ${own ? `<span class="ty-adv-on">${esc(t("On your team"))}</span>` : (s.tycoon.picks > 0 ? `<button type="button" class="ty-adv-hire free" data-hire="${a.id}">${esc(t("Pick"))}<small>${esc(t("Free"))}</small></button>` : `<button type="button" class="ty-adv-hire" data-hire="${a.id}"${s.crystals < CRATE_CRYSTALS ? " data-short=\"1\"" : ""}>${esc(t("Hire"))}<small>💎 ${CRATE_CRYSTALS}</small></button>`)}
        </div>`;
      }).join("")}</div>
      <p class="sheet-note">${esc(s.tycoon.picks > 0 ? t("Free advisor picks: {n}. Choose any advisor above.", { n: s.tycoon.picks }) : t("Finish all of today's goals, or reach day 7 of the daily calendar, for a free pick of the advisor you want."))}</p>`);
  }

  private onAdvisorClick(e: Event): void {
    const btn = (e.target as Element).closest<HTMLElement>("[data-hire]");
    if (!btn) return;
    const s = this.save;
    if (s.tycoon.picks < 1 && s.crystals < CRATE_CRYSTALS) { this.short(CRATE_CRYSTALS); return; }
    // Two taps: the first asks, so a stray tap while scrolling never spends anything.
    if (!btn.dataset.armed) {
      this.host.sound.click();
      const was = btn.innerHTML;
      btn.dataset.armed = "1";
      btn.innerHTML = `${esc(t("Tap again"))}<small>${esc(t("to hire"))}</small>`;
      setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.innerHTML = was; } }, 3000);
      return;
    }
    const a = hireAdvisor(s, btn.dataset.hire!);
    if (!a) return;
    this.host.persist();
    this.host.refresh();
    this.showAdvisor(a, t("Hired"));
    this.render();
  }

  /** A new advisor joins: a big card with their portrait and perk. */
  private showAdvisor(a: Advisor, from: string): void {
    const el = overlay();
    el.style.setProperty("--b1", a.look.outfit);
    el.style.setProperty("--b2", "#6a3cff");
    el.innerHTML = `<div class="evo-card"><span class="evo-rays" aria-hidden="true"></span>
      <small>${esc(from)}</small>
      <div class="evo-from plain">${esc(t("A new advisor joins Skyhaven Inc.!"))}</div>
      <div class="evo-icon adv">${advisorSvg(a, true)}</div>
      <b class="evo-to">${esc(t(a.name))}</b>
      <span class="evo-label">${esc(t(a.title))}</span>
      <p class="adv-perk">${esc(perkText(a))}</p>
      <button type="button" class="btn btn-primary">${esc(t("Welcome aboard!"))}</button>
    </div>`;
    showOverlay(el, () => this.host.sound.click());
    this.host.sound.unlock();
    confetti();
    fireworks(2, () => this.host.sound.firework());
  }

  /** Mayor Pip's tip for the next first step, until the first manager is hired. */
  private coach(): string {
    const ty = this.save.tycoon, b = BUSINESSES[0];
    if (ty.tips >= 3) return "";
    const text = ty.tips === 0 ? t("Tap the Coffee Cart to sell your first coffee!")
      : ty.tips === 1 ? t("Nice! Now buy a level: every level earns more each sale.")
      : t("Save {n} to hire a manager. Managers sell for you, even while you're away!", { n: coins(b.manager) });
    return `<div class="ty-coach"><span class="ty-coach-face">${COACH_FACE}</span><p><small>${esc(t("First steps · {n} of 3", { n: ty.tips + 1 }))}</small>${esc(text)}</p></div>`;
  }

  /** Counts toward today's goals and celebrates any that are done. */
  private goal(kind: GoalType, by = 1): void {
    const r = goalStep(this.save, kind, by);
    if (r.stars) { toast(r.cash ? t("Goal done! +{n}", { n: coins(r.cash) }) : t("Goal done! +{n} ★", { n: r.stars })); this.host.sound.unlock(); }
    if (r.crystals) { toast(t("All of today's goals done! +{n} Sky Crystals", { n: r.crystals })); fireworks(3, () => this.host.sound.firework()); }
    if (r.pick) toast(t("All of today's goals done! 🎁 Free advisor: choose who joins in Company → Team"));
    if (r.stars || r.crystals || r.pick) { this.host.persist(); this.host.refresh(); }
  }

  private renderGoals(): void {
    dealGoals(this.save);
    this.put($("ty-goals"), this.goalsHtml());
  }

  /** Today's three company goals (and the bonus for all three). */
  private goalsHtml(): string {
    const s = this.save, g = s.tycoon.goals;
    const text = (k: GoalType, n: number) => k === "vip" ? t("Serve {n} VIP customers", { n }) : k === "buy" ? t("Buy {n} business levels", { n })
      : k === "taps" ? t("Run a business by hand {n} times", { n }) : k === "rush" ? t("Catch {n} rush hours", { n })
      : k === "build" ? tn(n, "Finish {n} build", "Finish {n} builds", { n }) : k === "home" ? tn(n, "Build or grow {n} home", "Build or grow {n} homes", { n })
      : k === "decor" ? tn(n, "Place or move {n} decoration", "Place or move {n} decorations", { n })
      : k === "talk" ? tn(n, "Chat with {n} resident (tap their speech bubble)", "Chat with {n} residents (tap their speech bubbles)", { n })
      : k === "golden" ? tn(n, "Catch {n} golden customer", "Catch {n} golden customers", { n })
      : tn(n, "Help {n} neighbour", "Help {n} neighbours", { n });
    const icon: Record<GoalType, string> = { vip: "crown", buy: "building", taps: "sparkle", rush: "bolt", build: "building", home: "home", ask: "gift", decor: "sparkle", talk: "sparkle", golden: "crown" };
    return `<div class="ty-goals">` + g.list.map(x => {
      const done = x.p >= x.n, stars = GOAL_STARS[Math.max(0, GOAL_TIERS[x.t].indexOf(x.n))];
      return `<div class="ty-goal${done ? " done" : ""}"><span class="ty-goal-check">${done ? "✓" : iconSvg(icon[x.t])}</span><span><b>${esc(text(x.t, x.n))}</b>
        <i class="ty-goal-bar"><i style="width:${Math.min(100, (x.p / x.n) * 100)}%"></i></i></span><em>${done ? esc(t("Done")) : `${x.p}/${x.n}`}<small>${HAS_CITY ? `+${esc(coins(starCash(s, stars)))}` : `+${stars} ★`}</small></em></div>`;
    }).join("") + `<p class="ty-goal-bonus${g.bonus ? " done" : ""}">${esc(g.bonus ? t("Bonus collected! New goals tomorrow.") : (ADVISORS.some(a => !s.tycoon.advisors.includes(a.id)) ? t("Finish all three for a free advisor of your choice") : t("Finish all three for +{n} Sky Crystals", { n: GOALS_BONUS_CRYSTALS })))}</p></div>`;
  }

  /** After the company was started over for the slower economy, Pip explains it once. */
  freshStart(): void {
    const s = this.save;
    if (!s.tycoon.fresh || !this.host.onMenu()) return;
    if (!$("mayor").hidden || !$("welcome").hidden) { setTimeout(() => this.freshStart(), 1500); return; }
    s.tycoon.fresh = false;
    this.host.persist();
    mayorNote(t("Skyhaven Inc. starts fresh!"),
      t("We've rebuilt the company so every business grows step by step: from a little cart to a shop, a store, a flagship and an empire. You keep your {n} office floors. Let's build it up again!", { n: fmt(officeFloors(s)) }),
      t("Let's go!"), () => { if ($("tycoon").hidden && this.host.onMenu()) this.open(); });
  }

  /** Office floors in use, and the button to build more. */
  private renderOffice(): void {
    const s = this.save, total = officeFloors(s), used = usedFloors(s);
    // (The city game has no office floors: its City Hall level leads instead.)
    ($("ty-floors").closest(".ty-office") as HTMLElement).hidden = !FLOOR_LIMIT;
    if (!FLOOR_LIMIT) return;
    $("ty-floors").textContent = t("{used} of {total} used", { used: fmt(used), total: fmt(total) });
    $("ty-fbar").style.width = `${Math.min(100, (used / total) * 100)}%`;
    $("ty-build").classList.toggle("urgent", freeFloors(s) === 0);
  }

  private renderBoosts(): void {
    this.put($("ty-boosts"), this.boostsHtml());
  }

  /** What you earn, exactly: per second, minute, hour and day; each business's share;
   *  every bonus at work; and what managers bring in while you're away. */
  private askAt = 0;
  /** Pip asks for the city's name (or a new one). */
  /** Tells the player their city is saved online, with the code that brings it back. */
  private cloudNote(code: string): void {
    const s = this.save;
    s.seenFeatures.push("cloud-note");
    this.host.persist();
    mayorNote(t("Your city is saved online"), t("If you ever lose this phone or get a new one, this code brings {name} back. Take a screenshot of it, or find it later in Settings ▸ Cloud backup: {code}", { name: s.cityName || t("your city"), code: formatRecoveryCode(code) }), t("Copy code"), () => {
      void navigator.clipboard?.writeText(formatRecoveryCode(code)).then(() => toast(t("Recovery code copied")), () => {});
    }, t("Got it"));
  }

  nameCity(first = false): void {
    const s = this.save, ideas = ["Maple Bay", "Sunnyvale", "Cloudport", "Brightwater", "Harbor Hills", "Sky Meadow", "Pine Haven", "Coral Point"];
    const pick = s.cityName || ideas[Math.floor(Math.random() * ideas.length)];
    if (first && !s.seenFeatures.includes("name-city")) s.seenFeatures.push("name-city");
    mayorAsk(first ? t("Every great city needs a name!") : t("Rename your city"), first ? t("Your town is growing up. What should we call it? You can change it later in Settings.") : t("What should we call your city?"),
      pick, t("City name"), t("Name it!"), v => {
        const name = cleanCityName(v);
        if (!name) return;
        s.cityName = name;
        this.host.persist(); this.host.sound.purchase(); vibrate(this.save.settings.vibrate, [15, 30, 15]); confetti();
        toast(t("🏙️ Welcome to {name}!", { name }));
        track("city_named", {}, false);
        this.render(); this.renderGoal(); this.syncCityNameRow();
      }, t("Later"));
  }
  syncCityNameRow(): void {
    const row = document.getElementById("city-name-row");
    if (!row) return;
    row.hidden = !HAS_CITY;
    const b = document.getElementById("city-name-val");
    if (b) b.textContent = this.save.cityName || t("Not named yet");
  }
  /** A neighbour's request: who asks, what for, the reward, and a button to do it (or to
   *  collect, once it's done). */
  private openAsk(i: number): void {
    const s = this.save, a = s.asks.list[i];
    if (!a) return;
    this.host.sound.click();
    const names = ["Rosa", "Theo", "Mia", "Sam", "Nora", "Leo", "Ava", "Max", "Ivy", "Ben", "Lena", "Omar"];
    let h = 0; for (const c of a.home) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const who = names[h % names.length], b = BUSINESSES.find(x => x.id === a.biz), name = b ? t(b.name) : "";
    const text = a.kind === "grow" ? t("Our home is getting crowded! Could you grow it into {tier}?", { tier: t(PROP_TIERS[Math.min(PROP_MAX, a.target)]) })
      : a.kind === "shop" ? t("We'd love a {name} near us. Could you open one?", { name })
      : a.kind === "more" ? t("We can't get enough of the {name}! Could you grow it to level {n}?", { name, n: a.target })
      : t("Our friends want to move to Skyhaven. Could you build them a home on an empty lot?");
    const done = askDone(s, a), pct = Math.round(askProgress(s, a) * 100);
    const reward = `<span>+${a.crystals} 💎</span><span>+${esc(coins(askCash(s)))}</span>`;
    if (done) {
      neighbourNote(who, h, t("{name} is so happy!", { name: who }), `${text} ${t("Thank you!")}`, reward, t("Collect +{c} 💎", { c: a.crystals }), () => {
        const r = collectAsk(s, i);
        if (!r) return;
        this.host.sound.purchase(); confetti(); vibrate(s.settings.vibrate, [15, 30, 15]);
        toast(t("✨ {name} thanks you: +{c} 💎 and {cash}!", { name: who, c: r.crystals, cash: coins(r.cash) }));
        track("ask_done", { kind: a.kind }, false);
        this.goal("ask");
        this.host.persist(); this.render();
      });
      return;
    }
    neighbourNote(who, h, t("A neighbour's request"), `${text}${a.kind === "more" ? ` (${pct}%)` : ""}`, reward, t("Show me"), () => {
      if (a.kind === "grow") this.selectProp(a.home);
      else if (a.kind === "more" && b) { this.selected = b.id; this.selectedProp = ""; this.selectedSight = ""; this.render(); }
      else this.openBuild();
    }, t("Later"));
  }

  openEarnings(): void {
    this.renderEarnings();
    openModal($("earnings"));
  }

  private renderEarnings(): void {
    const s = this.save, ty = s.tycoon, now = Date.now(), ps = perSecond(s, now);
    $("earn-sub").textContent = t("Live · updates every second");
    // What you're saving for, how long it takes, and the crystals to skip the wait.
    { const g = HAS_CITY ? saveGoal(s, id => hqPrice(s, id), id => readyStage(s, id)) : null, box = $("earn-goal");
      box.hidden = !g || ty.coins >= g.price;
      if (g && !box.hidden) {
        const b = BUSINESSES.find(x => x.id === g.biz)!, sec = secondsTo(s, g.price, now), cost = skipPrice(sec), pct = Math.min(100, (ty.coins / g.price) * 100);
        const what = g.kind === "open" ? t("Open the {name}", { name: t(b.name) }) : t("The {name}'s new headquarters", { name: t(b.name) });
        this.put(box, `<span class="eg-ico">${iconSvg(b.icon)}</span><div class="eg-main"><small>${esc(t("Saving for"))}</small><b>${esc(what)}</b>
          <i class="eg-bar"><i style="width:${pct.toFixed(1)}%"></i></i><em>${esc(t("{have} of {need}", { have: coins(ty.coins), need: coins(g.price) }))} · ${esc(Number.isFinite(sec) ? t("about {t}", { t: fmtLeft(sec * 1000) }) : t("hire a manager to earn while you wait"))}</em></div>
          ${Number.isFinite(cost) ? `<button type="button" class="eg-skip" data-skip="1"${s.crystals < cost ? " disabled" : ""}><b>${esc(t("Skip the wait"))}</b><small>💎${cost}</small></button>` : ""}`);
        const btn = box.querySelector<HTMLButtonElement>("[data-skip]");
        if (btn) btn.onclick = e => { e.stopPropagation(); if (skipWait(s, g.price)) { this.host.sound.purchase(); confetti(); toast(t("✨ Done waiting! You have the cash for: {what}", { what })); track("skip_wait", { cost }, false); this.host.persist(); this.render(); this.renderEarnings(); } };
      } }
    $("earn-ps").textContent = coins(ps);
    $("earn-pm").textContent = coins(ps * 60);
    $("earn-ph").textContent = coins(ps * 3600);
    $("earn-pd").textContent = coins(ps * 86400);
    const rows = BUSINESSES.filter(b => levelOf(s, b.id) > 0).map(b => {
      const lv = levelOf(s, b.id), auto = ty.managers.includes(b.id), v = auto ? payOf(s, b, now) / cycleOf(b, lv) : 0;
      return { b, v, auto, lv };
    }).sort((a, z) => z.v - a.v);
    const top = Math.max(1e-9, ...rows.map(r => r.v));
    // One bar in the businesses' colors: who earns what.
    this.put($("earn-share"), ps > 0 ? rows.filter(r => r.v > 0).map(r => `<i style="flex:${(r.v / ps).toFixed(4)};background:linear-gradient(180deg,${r.b.color[0]},${r.b.color[1]})"></i>`).join("") : "");
    const best = rows[0];
    this.put($("earn-tiles"), `<span><small>${esc(t("Earned so far"))}</small><b>${esc(coins(ty.lifetime))}</b></span>`
      + (best && best.v > 0 ? `<span><small>${esc(t("Top business"))}</small><b>${esc(t(stageName(best.b.id, stageNow(s, best.b.id))))}</b></span>` : `<span><small>${esc(t("Managers"))}</small><b>${ty.managers.length}</b></span>`));
    this.put($("earn-list"), rows.map(r => `<div class="earn-biz" style="--b1:${r.b.color[0]};--b2:${r.b.color[1]}">
      <span class="eb-ico">${iconSvg(r.b.icon)}</span>
      <span class="eb-main"><b>${esc(t(stageName(r.b.id, stageNow(s, r.b.id))))}</b><i class="eb-bar"><i style="width:${(r.v > 0 ? Math.max(3, (r.v / top) * 100) : 0).toFixed(1)}%"></i></i></span>
      <span class="eb-val">${r.auto ? `<b>${esc(coins(r.v))}</b><small>${esc(t("a second"))}${ps > 0 ? ` · ${Math.round((r.v / ps) * 100)}%` : ""}</small>` : `<button type="button" class="buy eb-hire" data-hire-mgr="${r.b.id}"${ty.coins < r.b.manager ? " disabled" : ""}><small>${esc(t("Hire manager"))}</small>${esc(coins(r.b.manager))}</button>`}</span>
    </div>`).join("") || `<p class="sheet-note">${esc(t("Open your first business to start earning."))}</p>`);
    // Ways to earn more (one tap each).
    const more: string[] = [];
    if (!ty.boost) more.push(`<button type="button" class="em-card gold" data-more="boost"><span class="eb-cico">${iconSvg("bolt")}</span><span><b>${esc(t("Cash booster ×2"))}</b><small>${esc(t("Double every dollar, forever"))}</small></span><em>💎 ${fmt(COIN_BOOST_CRYSTALS)}</em></button>`);
    if (warpGain(s, 1, now) > 0 && speedupsLeft(s) > 0) more.push(`<button type="button" class="em-card" data-more="warp"><span class="eb-cico">${iconSvg("clock")}</span><span><b>${esc(t("Time warp: 1 hour"))}</b><small>${esc(t("Get {n} right now", { n: coins(warpGain(s, 1, now)) }))}</small></span><em>💎 ${warpPrice(1)}</em></button>`);
    more.push(`<button type="button" class="em-card" data-more="decor"><span class="eb-cico">${iconSvg("island")}</span><span><b>${esc(t("Island decorations"))}</b><small>${esc(t("Each one: +{pct}% to every business", { pct: Math.round(DECOR_BONUS * 100) }))}</small></span><span class="chev" aria-hidden="true"></span></button>`);
    this.put($("earn-more"), more.join(""));
    // The bonuses at work (only the ones you have).
    const bon: [string, string, string][] = [];
    const pct = (m: number) => `+${Math.round((m - 1) * 100)}%`;
    if (ty.boost) bon.push(["bolt", t("Cash booster"), "×2"]);
    if (ty.opening > now) bon.push(["party", t("Grand opening"), `×${OPENING_MULT}`]);
    if (vipActive(s, now)) bon.push(["crown", t("VIP"), "×1.25"]);
    const rk = townRank(s);
    if (rk > 0) bon.push([RANKS[rk].icon, t("Town rank: {name}", { name: t(RANKS[rk].name) }), pct(1 + rk * RANK_BONUS)]);
    if (ty.gems > 0) bon.push(["gem", t("Investors"), pct(1 + ty.gems * GEM_BONUS)]);
    if (workerBonus(s) > 1.001) bon.push(["city", t("Your sky city's workers"), pct(workerBonus(s))]);
    if (s.decor.length) bon.push(["island", t("Island decorations"), pct(decorMult(s))]);
    if (s.cafe.terrace === 2 || s.cafe.done.length) bon.push(["coffee", t("Café block (Coffee Cart)"), pct(cafeMult(s.cafe))]);
    const ups = ty.upgrades.length;
    if (ups) bon.push(["star", t("Upgrades bought"), String(ups)]);
    if (ty.advisors.length) bon.push(["medal", t("Advisors on your team"), String(ty.advisors.length)]);
    bon.push(["rocket", t("All businesses together"), `×${fmtMult(multiplier(s, now))}`]);
    // The town's rank, and what the next one brings.
    {
      const used = usedFloors(s), nx = RANKS[rk + 1], from = RANKS[rk].at;
      const k = nx ? Math.max(0, Math.min(1, (used - from) / (nx.at - from))) : 1;
      this.put($("earn-rank"), `<span class="er-ico">${iconSvg(RANKS[rk].icon)}</span><div class="er-main"><small>${esc(t("Town rank"))} · ${rk + 1}/${RANKS.length}</small><b>${esc(t(RANKS[rk].name))}</b>`
        + (nx ? `<i class="er-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></i><em>${esc(t("Next: {name} at {n} business levels ({have} now)", { name: t(nx.name), n: fmt(nx.at), have: fmt(used) }))}</em><em class="er-unlock">${esc(t(nx.unlock))} · ${esc(t("+{pct}% to every business", { pct: Math.round(RANK_BONUS * 100) }))}</em>`
          : `<em>${esc(t("The highest rank. Skyhaven is the capital of the sky!"))}</em>`) + `</div>`);
    }
    this.put($("earn-bonus"), bon.map(([ico, name, v]) => `<div class="eb-chip"><span class="eb-cico">${iconSvg(ico)}</span><span>${esc(name)}</span><b>${esc(v)}</b></div>`).join(""));
    const h = offlineHours(s);
    this.put($("earn-away"), `<div class="eb-away"><span class="eb-cico">${iconSvg("lock")}</span><span>${esc(ps > 0
      ? t("Managers keep selling while you're away: about {n} over {h} hours, then the vault is full.", { n: coins(ps * h * 3600), h })
      : t("Hire a manager and your businesses keep earning while you're away."))}</span></div>`);
  }

  /** After buying a decoration in the shop: back to the town to see it. */
  showDecor(_id: string): void {
    if (!this.inCity && this.host.onMenu()) this.open();
    this.render();
  }

  /** The business boosts, also shown in the shop's Town tab. */
  fillBoosts(el: HTMLElement, after: () => void): void {
    el.innerHTML = this.boostsHtml();
    el.onclick = e => { this.onBoostClick(e); after(); };
  }

  private boostsHtml(): string {
    const s = this.save, ty = s.tycoon, rate = perSecond(s, Date.now(), false);
    const card = (act: string, icon: string, title: string, text: string, price: string, disabled: boolean) =>
      `<div class="ty-boost"><span class="ty-bico">${iconSvg(icon)}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span><button type="button" class="buy" data-boost="${act}"${disabled ? " disabled" : ""}>${price}</button></div>`;
    const left = speedupsLeft(s);
    const warp = (act: string, icon: string, h: 1 | 8, title: string) => card(act, icon, title,
      rate <= 0 ? t("Hire a manager first") : left <= 0 ? t("No more speed-ups today. Come back tomorrow!") : t("Get {n} right now", { n: coins(warpGain(s, h)) }),
      `💎 ${warpPrice(h)}`, rate <= 0 || left <= 0);
    return (
      card("boost", "bolt", t("Cash booster ×2"), ty.boost ? t("Active forever. Every dollar counts twice") : t("Double all the cash you earn, forever"), ty.boost ? esc(t("✓ Owned")) : `💎 ${fmt(COIN_BOOST_CRYSTALS)}`, ty.boost)
      + (vaultCost(s) !== undefined ? card("vault", "lock", t("Bigger vault"), t("Managers earn {n} more hours while you're away (now {h}h)", { n: VAULT_HOURS, h: offlineHours(s) }), `${COIN_SVG}${esc(coins(vaultCost(s)!))}`, s.tycoon.coins < vaultCost(s)!) : "")
      + warp("warp1", "clock", 1, t("Time warp: 1 hour"))
      + warp("warp8", "rocket", 8, t("Time warp: 8 hours"))
      + `<p class="ty-speedups">${esc(t("Crystal speed-ups left today: {n} of {max}", { n: left, max: SPEEDUPS_PER_DAY }))}</p>`);
  }

  private onBoostClick(e: Event): void {
    const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-boost]");
    if (!btn) return;
    const s = this.save, act = btn.dataset.boost;
    if (act === "boost") {
      if (s.crystals < COIN_BOOST_CRYSTALS) { this.short(COIN_BOOST_CRYSTALS); return; }
      if (!buyBoost(s)) return;
      this.host.sound.purchase(); confetti(); toast(t("Cash booster on: every dollar counts twice!"));
    } else if (act === "vault") {
      tick(s);
      if (!buyVault(s)) return;
      this.host.sound.purchase(); confetti();
      toast(t("Vault upgraded: managers now earn {h} hours while you're away", { h: offlineHours(s) }));
    } else {
      const h = act === "warp1" ? 1 : 8, price = warpPrice(h);
      if (s.crystals < price) { this.short(price); return; }
      tick(s);
      const n = timeWarp(s, h);
      if (!n) return;
      this.host.sound.purchase(); fireworks(3, () => this.host.sound.firework());
      toast(t("Time warp! +{n}", { n: coins(n) }));
    }
    this.done();
  }

  private renderEra(): void {
    const s = this.save, g = eraGems(s);
    this.put($("ty-era-card"), `<span class="ty-gem">${iconSvg("sparkle")}</span>
      <span><b>${esc(t("{n} Sky Gems", { n: fmt(s.tycoon.gems) }))}</b><small>${esc(t("Each gem adds 2% to all earnings, for good. A New Era collects them and starts your whole city over, from a little hamlet."))}</small></span>
      <button type="button" class="buy era-go"${g > 0 ? "" : " disabled"}>${g > 0 ? esc(this.eraArmed ? t("Tap again to reset businesses") : t("New Era: +{n}", { n: fmt(g) })) : esc(t("Keep earning"))}</button>`);
  }

  private onEraClick(e: Event): void {
    if (!(e.target as Element).closest(".era-go")) return;
    if (!this.eraArmed) { this.eraArmed = true; this.render(); return; }
    this.eraArmed = false;
    const got = newEra(this.save);
    if (!got) return;
    this.host.sound.purchase(); confetti(); fireworks(5, () => this.host.sound.firework());
    toast(t("A New Era begins! +{n} Sky Gems", { n: fmt(got) }));
    this.shownCoins = -1;
    this.showTab("company");
    this.done();
  }

  /** The game's purpose, always on screen: grow Skyhaven to the Sky Capital, and what the
   *  next rank brings to the town. */
  private renderGoal(): void {
    const s = this.save, el = $("tcy-goal"), rk = townRank(s), nx = RANKS[rk + 1];
    el.hidden = !this.inCity || this.story.stage === "arrive" || (!s.cafe.starter && usedFloors(s) < 2);
    if (el.hidden) return;
    if (HAS_CITY) {
      // The city game: the City Hall badge, its level in the middle and a ring that fills
      // with the goals of the next level (the town's rank comes with the City Hall).
      const ci = chapterIndex(s), ch = CHAPTERS[ci], got = ch ? ch.goals.filter(g => goalDone(s, g)).length : 0, all = ch ? ch.goals.length : 1;
      const hv = `h${hallLevel(s)}|${got}|${rk}|${getLang()}|${s.cityName}`;
      if (el.dataset.v === hv) return;
      el.dataset.v = hv;
      el.innerHTML = `<span class="tg-ring" style="--k:${((ch ? got / all : 1) * 360).toFixed(1)}deg"><span class="tg-ico">${iconSvg("building")}</span><b class="tg-lv">${hallLevel(s)}</b></span>`
        + `<span class="tg-main"><b>${esc(s.cityName || t(RANKS[rk].name))}</b>`
        + `<em class="tg-next">${s.cityName ? `${esc(t(RANKS[rk].name))} · ` : ""}${ch ? esc(t("City Hall goals {n}/{total}", { n: got, total: all })) : `★ ${esc(t("Top rank"))}`}</em>` + `</span>`;
      el.setAttribute("aria-label", t("City Hall level {n}", { n: hallLevel(s) }));
      return;
    }
    const used = usedFloors(s), from = RANKS[rk].at;
    const k = nx ? Math.max(0, Math.min(1, (used - from) / (nx.at - from))) : 1;
    const v = `${rk}|${used}|${getLang()}`;
    if (el.dataset.v === v) return;
    el.dataset.v = v;
    // A round badge: the town level in the middle, a ring that fills toward the next rank,
    // and the rank's name with how far there is to go beside it.
    el.innerHTML = `<span class="tg-ring" style="--k:${(k * 360).toFixed(1)}deg"><span class="tg-ico">${iconSvg(RANKS[rk].icon)}</span><b class="tg-lv">${rk + 1}</b></span>`
      + `<span class="tg-main"><b>${esc(t(RANKS[rk].name))}</b>`
      + (nx ? `<em class="tg-next">${fmt(used)}/${fmt(nx.at)}</em>` : `<em class="tg-next">★ ${esc(t("Top rank"))}</em>`) + `</span>`;
    el.setAttribute("aria-label", nx ? t("Next rank: {name} at {n} business levels ({have} now)", { name: t(nx.name), n: fmt(nx.at), have: fmt(used) }) : t("Sky Capital reached!"));
  }

  /** The whole journey, in Mayor Pip's words: what each rank adds to the town. */
  private showPlan(): void {
    const s = this.save, rk = townRank(s), used = usedFloors(s);
    mayorList(t("Our plan for Skyhaven"),
      t("Every tower brings new neighbors, every business you grow brings the town to life, and step by step Skyhaven becomes the capital of the sky."),
      RANKS.slice(1).map((r, i) => ({ done: i + 1 <= rk, text: `${t(r.name)}: ${t(r.unlock)}`, note: i + 1 <= rk ? "" : `${fmt(Math.min(used, r.at))} / ${fmt(r.at)}` })),
      t("Let's grow!"));
  }

  /** The town scrapbook: one postcard per rank, with the day it was reached. */
  /** The building collection book: every design of every building level, the ones built in
   *  colour and the rest as dark silhouettes, with crystals for each finished row. */
  openCollection(): void {
    const s = this.save, ready = bookReady(s);
    $("coll-sub").textContent = t("{n} of {total} designs found · build and upgrade homes to find more", { n: bookCount(s), total: BOOK_SIZE });
    const rows: string[] = [];
    if (ready.includes(0)) rows.push(`<button type="button" class="btn primary wide coll-claim" data-claim="0">${esc(t("Whole book complete! Claim {n} 💎", { n: BOOK_CRYSTALS }))}</button>`);
    for (let l = 1; l <= DESIGN_LEVELS; l++) {
      const n = levelCount(s, l), paid = s.collection.paid.includes(l);
      const claim = ready.includes(l) ? `<button type="button" class="btn primary coll-claim" data-claim="${l}">${esc(t("Claim {n} 💎", { n: ROW_CRYSTALS }))}</button>` : paid ? `<span class="coll-done">✓</span>` : `<em>${esc(t("Finish the row: {n} 💎", { n: ROW_CRYSTALS }))}</em>`;
      rows.push(`<section class="coll-row"><header><b>${esc(t(LEVEL_NAMES[l - 1]))}</b><small>${esc(t("Level {n}", { n: l }))} · ${n}/${DESIGNS_PER_LEVEL}</small>${claim}</header>
        <div class="coll-grid">${Array.from({ length: DESIGNS_PER_LEVEL }, (_, i) => `<div class="coll-tile${hasDesign(s, l, i) ? "" : " locked"}" data-d="${l}:${i}"><span>${i + 1}</span></div>`).join("")}</div></section>`);
    }
    const got = s.cityTrophies.length;
    rows.push(`<section class="coll-row coll-trophies"><header><b>${esc(t("City trophies"))}</b><small>${got}/${CITY_TROPHIES.length}</small></header><ul>${CITY_TROPHIES.map(tr => {
      const on = s.cityTrophies.includes(tr.id);
      return `<li class="${on ? "on" : ""}"><span>${on ? "🏆" : LOCK_ICON}</span><div><b>${esc(t(tr.name))}</b><small>${esc(t(tr.text))}</small></div></li>`;
    }).join("")}</ul></section>`);
    $("coll-list").innerHTML = rows.join("");
    $("coll-list").querySelectorAll<HTMLButtonElement>("[data-claim]").forEach(b => b.onclick = () => {
      const n = claimBook(s, Number(b.dataset.claim));
      if (!n) return;
      this.host.sound.purchase(); confetti(); vibrate(s.settings.vibrate, [15, 30, 15]);
      toast(t("+{n} 💎 for your building collection!", { n }));
      track("collection_claim", { row: Number(b.dataset.claim) }, false);
      this.host.persist(); this.render(); this.openCollection();
    });
    if ($("collection").hidden) openModal($("collection"));
    // The pictures are drawn a few at a time, so the page opens at once.
    const tiles = [...$("coll-list").querySelectorAll<HTMLElement>(".coll-tile")];
    const step = () => {
      if ($("collection").hidden) return;
      for (let k = 0; k < 3 && tiles.length; k++) {
        const el = tiles.shift()!, [l, i] = el.dataset.d!.split(":").map(Number), url = houseThumb(l, i, el.classList.contains("locked"));
        if (url) { el.style.backgroundImage = `url('${url}')`; el.classList.add("pic"); }
      }
      if (tiles.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** Someone in the street says something now and then (not while a card or menu is open). */
  private talk: { text: string; until: number } | null = null;
  private talkNext = Date.now() + 15000;
  private maybeTalk(now: number): void {
    if (this.talk && this.talk.until <= now) { this.talk = null; this.render(); }
    if (now < this.talkNext || this.talk) return;
    this.talkNext = now + 25000 + Math.random() * 20000;
    if (!this.inCity || this.selected || this.selectedProp || this.selectedSight || openModalEl() || document.body.classList.contains("tabs-open") || !$("mayor").hidden) return;
    const s = this.save, opened = BUSINESSES.filter(b => levelOf(s, b.id) > 0);
    const newest = opened.length > 1 ? opened[opened.length - 1] : undefined;
    const line = pickTalk({ season: citySeason(), weather: this.host.weatherNow(), placed: Object.entries(s.placed).filter(([, at]) => at).map(([id]) => id), newest: newest ? t(stageName(newest.id, stageNow(s, newest.id))) : undefined,
      night: (() => { const h = new Date().getHours(); return h >= 19 || h < 5; })(), weekend: isWeekendNight(), rush: isRushHour() }, Math.random());
    this.host.bizTalk(Math.floor(Math.random() * 1000));
    this.talk = { text: t(line.text, { name: line.name ?? "" }), until: now + 7000 };
    this.render();
  }

  /** A friendly card when nothing new has opened for about a day and a New Era would pay:
   *  the gems it gives and what they do to earnings, a button to it, and "Not now". */
  private renderEraNudge(now = Date.now()): void {
    const el = $("era-nudge"), s = this.save, n = eraNudge(s, now);
    const busy = !this.inCity || !!(this.selected || this.selectedProp || this.selectedSight) || document.body.classList.contains("tabs-open") || !!openModalEl() || !$("mayor").hidden;
    if (!n || busy) { if (!el.hidden) el.hidden = true; return; }
    const mult = (x: number) => `×${x.toFixed(2).replace(/\.?0+$/, "")}`;
    this.put(el, `<span class="en-ico">${iconSvg("sparkle")}</span>
      <div class="en-text"><b>${esc(t("Ready for a New Era?"))}</b>
      <p>${esc(t("Nothing new has opened for a while. A New Era gives you {g} Sky Gems: everything earns {pct}% more, for good ({a} → {b}).", { g: fmt(n.gems), pct: fmt(n.pct), a: mult(n.before), b: mult(n.after) }))}</p>
      <small>${esc(t("Your city starts over from a hamlet, and grows back faster."))}</small>
      <div class="en-btns"><button type="button" class="btn btn-primary" data-en="go">${esc(t("See New Era"))}</button><button type="button" class="btn btn-secondary" data-en="later">${esc(t("Not now"))}</button></div></div>`);
    if (el.hidden) { el.hidden = false; track("era_nudge", { gems: n.gems }, false); }
  }

  /** Adds the designs standing in the town to the collection (a note for a new one). */
  private collectAt = 0;
  private collectSeeded = false;
  private collectDesigns(now: number): void {
    if (!HAS_CITY || now - this.collectAt < 4000 || document.body.classList.contains("visiting-town")) return;
    this.collectAt = now;
    this.renderEraNudge(now);
    this.maybeTalk(now);
    this.maybeMilestone();
    // Trophies (quietly the first time, when an existing city earns several at once).
    const won = checkCityTrophies(this.save);
    if (won.length) {
      this.host.persist();
      if (this.collectSeeded && won.length <= 2) for (const tr of won) { this.host.sound.tada(); vibrate(this.save.settings.vibrate, [20, 40, 20]); toast(t("🏆 Trophy: {name}! {text}", { name: t(tr.name), text: t(tr.text) })); track("trophy", { id: tr.id }, false); }
    }
    if (won.length || !this.collectSeeded) void gameCenterCity(this.save.cityTrophies);
    const fresh = addDesigns(this.save, this.host.bizDesigns());
    if (!fresh.length) { this.collectSeeded = true; return; }
    this.host.persist();
    // (Not on the first look, when a whole town of designs comes in at once.)
    if (this.collectSeeded && fresh.length <= 2) toast(t("📘 A new building design for your collection! ({n} of {total})", { n: bookCount(this.save), total: BOOK_SIZE }));
    this.collectSeeded = true;
    if (bookReady(this.save).length) this.render();
  }

  /** Paint a business's building: its own colours, a free paint, one for crystals, or a
   *  Season Pass paint once won. */
  private openPaint(id: string): void {
    const s = this.save, b = BUSINESSES.find(x => x.id === id);
    if (!b) return;
    const cur = s.paint[id] ?? "";
    const done = (name: string) => {
      this.host.sound.purchase(); vibrate(s.settings.vibrate, [10, 20, 10]); burst($("tcy-card"), 16);
      toast(t("🎨 {biz} painted {name}!", { biz: t(stageName(id, stageNow(s, id))), name }));
      track("paint", { id: s.paint[id] ?? "" }, false);
      this.host.persist(); this.host.refresh(); this.render();
    };
    const opts = [{ label: t("Original colours"), sub: cur ? t("Free") : t("Painted now"), swatch: b.color as [string, string], on: !cur, onPick: () => { setPaint(s, id, ""); done(t("its own colours")); } },
      ...PAINTS.map(p => {
        const own = ownsPaint(s, p.id);
        if (p.starter && !own) return null;
        const sub = cur === p.id ? t("Painted now") : own ? (p.crystals || p.pass || p.starter ? t("Yours") : t("Free")) : p.pass ? t("A Season Pass reward") : `💎${p.crystals}`;
        return { label: t(p.name), sub, swatch: p.c, on: cur === p.id, onPick: () => {
          const r = setPaint(s, id, p.id);
          if (r === "ok") done(t(p.name));
          else if (r === "short") { toast(t("You need {n} more Sky Crystals", { n: p.crystals - s.crystals })); this.host.openShop("crystals"); }
          else toast(t("Win it in the Season Pass (Goals), while a season is on"));
        } };
      }).filter((o): o is NonNullable<typeof o> => !!o)];
    mayorChoice(t("Paint this building"), t("Pick new colours for {name}. You can change them any time.", { name: t(stageName(id, stageNow(s, id))) }), opts, t("Not now"));
  }

  /** Rain or snow over the town right now (Buildaroo). */
  private stormy(): boolean { if (!HAS_CITY) return false; const w = this.host.weatherNow(); return w === "rain" || w === "snow"; }

  /** A population milestone passed: the camera flies over the town, fireworks, crystals. */
  private maybeMilestone(): void {
    // (Only on the plain town view: not over a card, a sheet or a pop-up.)
    if (!this.host.onMenu() || this.selected || this.selectedProp || this.selectedSight || document.querySelector(".modal:not([hidden]), .hall-banner") || !$("mayor").hidden) return;
    const m = checkMilestone(this.save);
    if (!m) return;
    this.host.persist(); this.host.refresh();
    const city = this.save.cityName || t("My city");
    this.host.visitLandmark(-5, 7000);
    this.host.sound.tada(); vibrate(this.save.settings.vibrate, [20, 40, 20, 40, 60]);
    window.setTimeout(() => fireworks(5, () => this.host.sound.firework()), 600);
    cityBanner(city, t("{n} people!", { n: fmt(m.at) }), t("A city milestone! +{n} 💎", { n: m.crystals }), 3200);
    track("people_milestone", { at: m.at }, false);
  }

  /** Photo mode (see ./photo.ts). */
  photoMode(): void { this.photo?.open(); }

  openScrapbook(): void {
    const s = this.save, rk = townRank(s), used = usedFloors(s);
    if (!s.scrapbook[0]) s.scrapbook[0] = Date.now();
    const day = (ms: number) => new Date(ms).toLocaleDateString(getLang(), { day: "numeric", month: "short", year: "numeric" });
    const tints = ["#7fd36a", "#ff9ac8", "#ffd23a", "#4f8bff", "#b48cff", "#3ac0c0", "#ffb13b"];
    $("scrap-sub").textContent = t("{n} of {total} postcards", { n: Math.min(RANKS.length, rk + 1), total: RANKS.length });
    const mem = loadMemories(), first = Object.keys(mem).map(Number).sort((a, b) => a - b)[0];
    const share = first !== undefined && rk > first
      ? `<button type="button" class="btn primary scrap-share" id="scrap-share">${arrows(esc(t("Then → Now: show a friend")))}</button>`
      : `<p class="scrap-hint">${esc(t("Skyhaven remembers: a picture is taken at each new rank. Reach the next one to make your Then → Now card."))}</p>`;
    $("scrap-grid").innerHTML = share + RANKS.map((r, i) => {
      const got = i <= rk, when = s.scrapbook[i];
      const text = i === 0 ? t("Where it all began: your first neighbor moved in.") : t(r.unlock);
      return `<div class="postcard${got ? "" : " locked"}" style="--pc:${tints[i % tints.length]}">
        <div class="pc-art${got && mem[i] ? " photo" : ""}"${got && mem[i] ? ` style="background-image:url('${mem[i].img}')"` : ""}><span class="pc-ico">${got ? iconSvg(r.icon) : LOCK_ICON}</span><b>${esc(t(r.name))}</b></div>
        <p>${esc(got ? text : t("Reach {n} business levels to unlock", { n: fmt(r.at) }))}</p>
        <em>${got ? esc(when ? t("Reached {date}", { date: day(when) }) : t("Reached")) : esc(`${fmt(Math.min(used, r.at))} / ${fmt(r.at)}`)}</em>
      </div>`;
    }).join("");
    this.host.persist();
    document.getElementById("scrap-share")?.addEventListener("click", async e => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn.disabled) return;
      btn.disabled = true;
      window.setTimeout(() => { btn.disabled = false; }, 2500);
      this.host.sound.click();
      const now = this.host.townPicture();
      if (first === undefined || !now) { toast(t("Open the town first, then try again")); return; }
      const blob = await thenNowCard(mem[first], now, first, rk);
      if (!blob) { toast(t("Couldn't make this card. Try again in a moment.")); return; }
      void this.host.sharePicture(blob, t("Skyhaven: from {a} to {b}. It started with one neighbor.", { a: t(RANKS[first].name), b: t(RANKS[rk].name) }));
    });
    openModal($("scrapbook"));
  }

  /** Land for sale next to the island: a card with what gets built there, what it brings,
   *  the price and how close the company is to it. Buying joins it to the island for good. */
  private openLand(): void {
    const s = this.save, l = landOnSale(s);
    if (!l) return;
    const el = $("land-buy"), price = landPrice(s, l), pct = Math.round(LAND_BONUS * 100), k = LAND.indexOf(l);
    const have = s.tycoon.coins, can = have >= price;
    el.dataset.land = l.id;
    $("land-hero").style.setProperty("--land", ["#3fa9e8", "#5ec26a", "#8a6cff", "#e8b020", "#b05aff", "#2a3f8a"][k] ?? "#5ec26a");
    // (The camera shows the island that's for sale while its card is open.)
    this.host.visitLandmark(100 + k, 6000);
    $("land-icon").textContent = l.icon;
    $("land-title").textContent = t(l.name);
    $("land-what").textContent = t(l.what);
    $("land-perks").innerHTML = [
      ["📈", t("Every business earns +{pct}%, for good", { pct })],
      ["🌉", t("A new island joins your town by a bridge")],
      ["🔒", t("Stays yours, even after a New Era")],
      ["🗺️", t("Piece {n} of {all}", { n: k + 1, all: LAND.length })],
    ].map(([i2, tx]) => `<li><span>${i2}</span>${esc(tx)}</li>`).join("");
    $("land-price").textContent = coins(price);
    ($("land-bar") as HTMLElement).style.width = `${Math.round(Math.min(1, have / price) * 100)}%`;
    $("land-have").textContent = can ? t("You can buy it now") : t("You have {a}: {b} to go", { a: coins(have), b: coins(price - have) });
    const btn = $("land-buy-btn") as HTMLButtonElement, job = buildOf(s, "land", l.id), now = Date.now();
    btn.textContent = job ? t("Finish now · 💎{n}", { n: finishPrice(job.end - now) }) : can ? t("Build it · {n} · ⏱ {t}", { n: coins(price), t: fmtLeft(buildTime(s, "land", l.id, now)) }) : t("Keep earning");
    btn.classList.toggle("short", !can && !job);
    $("land-step").textContent = job ? t("Your builders are on it: {t} left", { t: fmtLeft(job.end - now) }) : can ? "" : t("Your businesses are earning it. Come back soon!");
    openModal(el, btn);
  }

  /** The buy button on the land card. */
  private buyLandNow(): void {
    const s = this.save, l = landOnSale(s), el = $("land-buy");
    if (!l || el.dataset.land !== l.id) { closeModal(el); return; }
    tick(s);
    if (buildOf(s, "land", l.id)) { closeModal(el); this.finishBuild("land", l.id); return; }
    // (Not enough yet: the button just closes the card; the price and progress are on it.)
    if (s.tycoon.coins < landPrice(s, l)) { this.host.sound.click(); closeModal(el); return; }
    closeModal(el);
    this.startCityBuild("land", l.id);
  }

  /** A district finished building: it joins the island, with a celebration. */
  private landDone(id: string): void {
    const s = this.save, l = LAND.find(x => x.id === id);
    if (!l) return;
    const k = LAND.indexOf(l), pct = Math.round(LAND_BONUS * 100);
    track("land_bought");
    this.host.persist();
    this.host.sound.unlock();
    vibrate(s.settings.vibrate, [20, 40, 20]);
    fireworks(2, () => this.host.sound.firework());
    this.render();
    window.setTimeout(() => this.host.visitLandmark(100 + k, 4500), 500);
    window.setTimeout(() => toast(t("{icon} {name} is part of the island now! Every business earns +{pct}%", { icon: l.icon, name: t(l.name), pct })), 4800);
  }

  /** The floating island next to the town: Pip offers the two landmarks. */
  private openAnnex(): void {
    const s = this.save;
    if (!annexOpen(s) || annexBuilt(s)) return;
    const price = annexPrice(s), pct = Math.round(ANNEX_BONUS * 100);
    const pick = (p: AnnexPick) => () => {
      tick(s);
      const r = buildAnnex(s, p);
      if (r === "short") { toast(t("You need {n} more cash. Your businesses are earning it!", { n: coins(annexPrice(s) - s.tycoon.coins) })); return; }
      if (r !== "ok") return;
      track("annex_built");
      this.host.persist();
      this.host.sound.unlock();
      fireworks(3, () => this.host.sound.firework());
      this.render();
      // The camera flies over to it; then the neighbor has something to say.
      window.setTimeout(() => this.host.visitLandmark(7, 4500), 600);
      window.setTimeout(() => toast(p === "greenhouse" ? t("🌿 The Sky Greenhouse is open! Every business earns +{pct}%", { pct }) : t("🔭 The Sky Lookout is open! Every business earns +{pct}%", { pct })), 5400);
    };
    mayorChoice(t("A new island!"),
      t("The little island next to ours has floated up beside the town. Let's build something there for everyone. Pick one: it stays for good, and every business earns {pct}% more.", { pct }),
      [
        { label: t("🌿 Sky Greenhouse"), sub: t("A glass dome full of plants · {n}", { n: coins(price) }), onPick: pick("greenhouse") },
        { label: t("🔭 Sky Lookout"), sub: t("A tower to see the whole sky · {n}", { n: coins(price) }), onPick: pick("lookout") },
      ],
      t("Later"));
  }

  /** The city spread out (new blocks past the town): the camera glides over to watch them
   *  rise, with a building sound and a short note. Never on the first look (a fresh load). */
  private grewSeen = -1;
  private checkGrow(): void {
    const g = cityGrow(this.save);
    if (this.grewSeen < 0 || g < this.grewSeen) { this.grewSeen = g; return; }
    if (g === this.grewSeen) return;
    if (!this.inCity || openModalEl() || !$("mayor").hidden || this.selected || this.selectedProp || this.selectedSight || document.body.classList.contains("tabs-open")) return;
    this.grewSeen = g;
    // (The town rebuilds on the next frame; the new blocks start rising then.)
    window.setTimeout(() => {
      if (this.host.visitLandmark(50, 3200)) {
        this.host.sound.unlock();
        toast(t("Skyhaven is growing: new blocks are going up!"));
      }
    }, 350);
  }

  /** A new town rank: fireworks now, and Mayor Pip's note once nothing else is open. */
  private momentDone = false;
  private visitDone = false;
  private checkRank(): void {
    const s = this.save, rk = townRank(s), key = `rank-${rk}`;
    if (rk > (s.tycoon.rankBest ?? 0)) s.tycoon.rankBest = rk;
    // The scrapbook keeps the day each rank was first reached.
    for (let i = 0; i <= rk; i++) if (!s.scrapbook[i]) s.scrapbook[i] = Date.now();
    if (rk < 1 || s.seenFeatures.includes(key)) return;
    for (let i = 1; i <= rk; i++) if (!s.seenFeatures.includes(`rank-${i}`)) s.seenFeatures.push(`rank-${i}`);
    const r = RANKS[rk];
    this.host.persist();
    toast(t("Skyhaven is now a {name}!", { name: t(r.name) }));
    fireworks(4, () => this.host.sound.firework());
    const note = () => {
      if (openModalEl() || !$("mayor").hidden || !$("welcome").hidden || document.body.classList.contains("tabs-open") || this.selected || this.selectedProp || this.selectedSight || Date.now() - this.lastTapAt < 4000) { window.setTimeout(note, 1500); return; }
      // The neighbor's moment first: the camera visits their block and they react to what
      // the new rank brought. Pip's note follows.
      const c = this.save.cafe;
      if (!this.momentDone && this.inCity && c.starter && c.moved && c.terrace === 2) {
        this.momentDone = true;
        // (The daily note shouldn't repeat this line tomorrow.)
        try { const v = JSON.parse(localStorage.getItem("skyrise.neighbor.v1") || "{}"); v.rank = rk; localStorage.setItem("skyrise.neighbor.v1", JSON.stringify(v)); } catch { /* private mode */ }
        if (this.story.stage === "none") this.stage("seat");
        this.frameUntil = Date.now() + 6500;
        this.render();
        this.later(900, () => this.say(t(NEIGHBOR_LINES[rk - 1] ?? NEIGHBOR_LINES[0]), 5200));
        window.setTimeout(note, 6800);
        return;
      }
      // Then the camera flies to what the rank built (the market, the tram stop, the
      // billboards...) and Pip tells you about it.
      if (!this.visitDone && this.inCity) {
        this.visitDone = true;
        if (this.host.visitLandmark(rk, 4200)) {
          // Skyhaven remembers: a picture of the new landmark, half way through the visit.
          this.later(2300, () => { if (!openModalEl() && !document.body.classList.contains("tabs-open")) saveMemory(rk, this.host.townPicture()); });
          window.setTimeout(note, 4400);
          return;
        }
      }
      this.visitDone = false;
      this.momentDone = false;
      mayorNote(t("Skyhaven is now a {name}!", { name: t(r.name) }),
        t("{unlock}. And every business earns {pct}% more for good. Go take a look!", { unlock: t(r.unlock), pct: Math.round(RANK_BONUS * 100) })
        + (rk === ANNEX_RANK ? " " + t("And the little island next door has floated up: it's ready for you to build on!") : "")
        + (RANKS[rk + 1] ? " " + (HAS_CITY ? t("Next: a {name} when the City Hall reaches level {n}.", { name: t(RANKS[rk + 1].name), n: rankHall(rk + 1) }) : t("Next rank: {name} at {n} business levels.", { name: t(RANKS[rk + 1].name), n: fmt(RANKS[rk + 1].at) })) : ""),
        t("Let's see!"));
    };
    window.setTimeout(note, 2500);
  }

  private short(price: number): void {
    toast(t("You need {n} more Sky Crystals", { n: fmt(price - this.save.crystals) }));
    closeModal($("tycoon"));
    if (!$("earnings").hidden) closeModal($("earnings"));
    this.host.openCrystalShop();
  }

  private done(): void {
    this.host.persist();
    this.host.refresh();
    this.render();
  }

  /** The home screen's Tycoon button: a dot when something can be bought. */
  renderHome(show: boolean): void {
    // (The home screen stays clear: the Tycoon opens at launch and has its own button.)
    const tile = $("tycoon-btn");
    $("tycoon-card").hidden = true;
    tile.hidden = !show;
    if (!show) return;
    const any = BUSINESSES.some((b, i) => unlockedBusiness(this.save, i) && costOf(b, levelOf(this.save, b.id), 1) <= this.save.tycoon.coins)
      || BUSINESSES.some(b => readyStage(this.save, b.id) > 0);
    tile.querySelector<HTMLElement>(".dot")!.hidden = !any;
  }

  private homeTick(): void {
    if ($("tycoon-btn").hidden || !$("tycoon").hidden) return;
    tick(this.save);
    this.renderHome(true);
  }

  /** At launch: what the managers earned while the game was closed. */
  welcome(earned: number, awayMs: number): void {
    if (earned <= 0 || awayMs < 120e3 || !this.host.onMenu()) return;
    // One dialog at a time: wait for Mayor Pip to finish.
    if (!$("mayor").hidden) { setTimeout(() => this.welcome(earned, awayMs), 1200); return; }
    $("welcome-face").innerHTML = mayorSvg("happy");
    $("welcome-amount").textContent = coins(earned);
    $("welcome-text").textContent = t("Your managers kept Skyhaven busy for {time}.", { time: fmtAway(awayMs) });
    {
      // The town first: where Skyhaven stands, and what it's growing toward.
      const rk = townRank(this.save), nx = RANKS[rk + 1], used = usedFloors(this.save);
      $("welcome-town").textContent = nx && HAS_CITY ? t("Skyhaven is a {rank}. At City Hall level {n} it becomes a {next}: {unlock}.", { rank: t(RANKS[rk].name), n: rankHall(rk + 1), next: t(nx.name), unlock: t(nx.unlock) })
        : nx ? t("Skyhaven is a {rank}. {left} more business levels and it becomes a {next}: {unlock}.", { rank: t(RANKS[rk].name), left: fmt(Math.max(1, nx.at - used)), next: t(nx.name), unlock: t(nx.unlock) })
        : t("Skyhaven is the capital of the sky. Keep it growing!");
    }
    const cap = offlineHours(this.save), h = Math.min(cap, awayMs / 3600e3);
    $("welcome-vault-bar").style.width = `${(h / cap) * 100}%`;
    $("welcome-vault").classList.toggle("full", h >= cap);
    $("welcome-vault-text").textContent = h >= cap ? t("Vault full! Managers stop after {n} hours: come back sooner to earn more.", { n: cap })
      : t("Vault {h} of {n} hours full", { h: h.toFixed(1), n: cap });
    const x3 = $<HTMLButtonElement>("welcome-x3"), price = doublePrice(this.save, awayMs);
    x3.textContent = t("Double it · 💎 {n}", { n: price });
    x3.hidden = speedupsLeft(this.save) <= 0;
    let paid = false;
    // Or free, for a short optional ad (when ads are set up and today's limit isn't reached).
    const ad = $<HTMLButtonElement>("welcome-ad");
    ad.hidden = !adsReady();
    ad.disabled = false;
    ad.onclick = async () => {
      if (paid || ad.disabled) return;
      ad.disabled = true;
      this.host.sound.duck(true);
      const ok = await showRewarded("welcome");
      this.host.sound.duck(false);
      ad.disabled = false;
      if (!ok) { toast(t("No reward this time. Try again later.")); return; }
      if (paid || !adDoubleAway(this.save, earned)) return;
      paid = true;
      this.host.sound.purchase(); fireworks(3);
      toast(t("Doubled! +{n}", { n: coins(earned) }));
      this.close();
    };
    x3.onclick = () => {
      if (paid) return;
      if (this.save.crystals < price) { toast(t("You need {n} more Sky Crystals", { n: price - this.save.crystals })); return; }
      if (!doubleAway(this.save, earned, awayMs)) return;
      paid = true;
      this.host.sound.purchase(); fireworks(3);
      this.close();
    };
    $("welcome-ok").onclick = () => { this.host.sound.coins(); burst($("welcome-ok"), 14); this.close(); };
    $("welcome").hidden = false;
  }

  private close(): void {
    $("welcome").hidden = true;
    this.host.persist();
    this.host.refresh();
  }
}

/** The shared overlay for big moments (evolutions, new advisors). */
function overlay(): HTMLElement {
  let el = document.getElementById("evolve");
  if (!el) { el = document.createElement("div"); el.id = "evolve"; el.setAttribute("role", "alert"); document.body.appendChild(el); }
  return el;
}
function showOverlay(el: HTMLElement, click: () => void): void {
  el.hidden = false;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  const close = () => { el.hidden = true; el.classList.remove("show"); };
  el.querySelector("button")!.addEventListener("click", () => { click(); close(); });
  el.onclick = e => { if (e.target === el) close(); };
}

/** A coin flies from a room up to the coin counter. */
function flyCoin(from: Element, toId = "ty-coins"): void {
  const to = document.getElementById(toId);
  if (!to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (a.bottom < 0 || a.top > innerHeight) return;
  const el = document.createElement("span");
  el.className = "fly-coin";
  el.innerHTML = COIN_SVG;
  const x0 = a.left + a.width * (0.3 + Math.random() * 0.4), y0 = a.top + a.height * 0.5;
  el.style.left = `${x0}px`; el.style.top = `${y0}px`;
  el.style.setProperty("--dx", `${b.left + 10 - x0}px`);
  el.style.setProperty("--dy", `${b.top + b.height / 2 - y0}px`);
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); to.classList.remove("pulse"); void (to as HTMLElement).offsetWidth; to.classList.add("pulse"); }, 700);
}

/** A soft ring where the room was tapped. */
function ripple(el: Element, e: MouseEvent): void {
  const r = el.getBoundingClientRect(), d = document.createElement("i");
  d.className = "tap-ripple";
  d.style.left = `${(e.clientX || r.left + r.width / 2) - r.left}px`;
  d.style.top = `${(e.clientY || r.top + r.height / 2) - r.top}px`;
  el.appendChild(d);
  setTimeout(() => d.remove(), 600);
}

const fmtSec = (s: number): string => (s >= 3600 ? `${(s / 3600).toFixed(1)}h` : s >= 60 ? `${(s / 60).toFixed(1)}m` : s >= 10 ? `${s.toFixed(0)}s` : `${s.toFixed(2)}s`);
function fmtAway(ms: number): string {
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Props in each business's room. */
const PROPS: Record<string, string[]> = {
  coffee: ["coffee", "dish", "coffee"], flowers: ["leaf", "balloon", "leaf"], bakery: ["sun", "dish", "gift"],
  pizza: ["dish", "fire", "dish"], cinema: ["film", "star", "film"], hotel: ["home", "building", "star"],
  mall: ["gift", "star", "gift"], airport: ["airship", "cloud", "flag"], casino: ["star", "sparkle", "gem"], spaceport: ["rocket", "sparkle", "globe"],
};
/** Customers' looks: shirt, skin and hair. */
const LOOKS: [string, string, string][] = [
  ["#4f8bff", "#f6c49e", "#5a3a22"], ["#ff6fa0", "#e0a87c", "#1c1640"], ["#5ee0a0", "#8d5a3b", "#1c1640"], ["#ffb13b", "#f2c39a", "#c0504d"],
  ["#b48cff", "#c98b62", "#3a2a1a"], ["#ff8a5c", "#f6d0b0", "#ffd23f"], ["#3ac0c0", "#a86a48", "#2a1f3e"], ["#e8457a", "#f2c39a", "#9a9aa8"],
];
/** A little customer with arms that swing as they walk (colors from --shirt, --skin, --hair). */
const PERSON = `<svg viewBox="0 0 20 34"><path class="arm a1" d="M4 17q-2 5-1 9" stroke="var(--skin)" stroke-width="2.4" stroke-linecap="round" fill="none"/><path class="arm a2" d="M16 17q2 5 1 9" stroke="var(--skin)" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="10" cy="7" r="5" fill="var(--skin)"/><path d="M5 6.5q0-5.5 5-5.5t5 5.5q-2-2.6-5-2.6t-5 2.6z" fill="var(--hair)"/><circle cx="8.2" cy="7.6" r="0.7" fill="#2a1f3e"/><circle cx="11.8" cy="7.6" r="0.7" fill="#2a1f3e"/><path d="M3.5 31v-11q0-6 6.5-6t6.5 6v11z" fill="var(--shirt)"/><path d="M3.5 22h13" stroke="rgba(0,0,0,0.12)" stroke-width="1"/><rect x="5" y="30.5" width="4" height="3.5" rx="1.2" fill="#2a1f3e"/><rect x="11" y="30.5" width="4" height="3.5" rx="1.2" fill="#2a1f3e"/></svg>`;
/** Mayor Pip for the coach, with his own gradient ids (the dialog's copy is hidden, and a
 *  hidden gradient can't be drawn). */
const COACH_FACE = MAYOR_SVG.replace(/id="mp-/g, 'id="mpc-').replace(/url\(#mp-/g, "url(#mpc-");
/** A VIP customer: sunglasses, a gold jacket. */
const PERSON_VIP = `<svg viewBox="0 0 20 34"><circle cx="10" cy="7" r="5" fill="#e8b48a"/><path d="M5 5q5-5 10 0v-1q-5-4-10 0z" fill="#1c1640"/><rect x="5.5" y="6" width="9" height="2.6" rx="1.2" fill="#1c1640"/><path d="M3 32v-12q0-6 7-6t7 6v12z" fill="#ffc93c"/><path d="M10 14l-2 18h4z" fill="#fff3b0"/><rect x="5" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/><rect x="11" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/></svg>`;
/** The manager: a suit and a red tie. */
const PERSON_BOSS = `<svg viewBox="0 0 20 34"><circle cx="10" cy="7" r="5" fill="#f2c39a"/><path d="M5 6q5-6 10 0v-2q-5-4-10 0z" fill="#3a3a4a"/><path d="M3 32v-12q0-6 7-6t7 6v12z" fill="#2a3590"/><path d="M10 14l-2 3 2 9 2-9z" fill="#e8334f"/><path d="M8 14h4l-2 2z" fill="#fff"/></svg>`;

function popCoin(box: Element, text: string): void {
  const el = document.createElement("span");
  el.className = "coin-pop";
  el.innerHTML = text ? `${COIN_SVG}+${text}` : COIN_SVG;
  el.style.left = `${20 + Math.random() * 50}%`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/** What an advisor does, in a line. */
function perkText(a: Advisor): string {
  switch (a.perk) {
    case "biz": {
      const names = (a.biz ?? []).map(id => t(BUSINESSES.find(b => b.id === id)!.name));
      return names.length === 1 ? t("{name} earns ×{n}", { name: names[0], n: a.n }) : t("{names} earn ×{n}", { names: names.join(" & "), n: a.n });
    }
    case "all": return t("Every business earns ×{n}", { n: a.n });
    case "vip": return t("VIPs come {n}× as often", { n: a.n });
    case "tips": return t("VIP tips ×{n}", { n: a.n });
    case "rush": return t("Rush hours last {n}× longer", { n: a.n });
    case "away": return t("Managers earn {n} more hours while you're away", { n: a.n });
  }
}

/** An advisor's portrait: a friendly bust with their own skin, hair, outfit and hat. A
 *  silhouette until collected. */
function advisorSvg(a: Advisor, own: boolean): string {
  const L = a.look, sk = own ? L.skin : "#c9c3e6", hr = own ? L.hair : "#b1a9d9", out = own ? L.outfit : "#a59bd6";
  const extra = !own ? "" : L.extra === "chef" ? `<path d="M18 13q-6-8 3-10 3-6 9-2 6-4 9 2 9 2 3 10z" fill="#fff" stroke="#e2def5"/><rect x="19" y="11" width="22" height="5" fill="#fff"/>`
    : L.extra === "glasses" ? `<g fill="none" stroke="#1c1640" stroke-width="1.6"><circle cx="25" cy="26" r="3.6"/><circle cx="35" cy="26" r="3.6"/><path d="M28.6 26h2.8"/></g>`
    : L.extra === "cap" ? `<path d="M17 19q13-12 26 0z" fill="${out}"/><path d="M40 18h8q-1 3-8 3z" fill="${out}"/>`
    : L.extra === "bow" ? `<path d="M38 12l6-4v8zM38 12l-4-5 0 9z" fill="#ff4f8b"/>`
    : L.extra === "beret" ? `<ellipse cx="29" cy="15" rx="13" ry="5" fill="#e0433a"/><circle cx="29" cy="10" r="1.6" fill="#e0433a"/>`
    : L.extra === "headset" ? `<path d="M18 26q0-14 12-14t12 14" fill="none" stroke="#1c1640" stroke-width="2"/><rect x="15.5" y="24" width="4" height="7" rx="2" fill="#1c1640"/><path d="M19 31q2 5 8 5" stroke="#1c1640" stroke-width="1.4" fill="none"/>`
    : L.extra === "crown" ? `<path d="M19 15l4-7 4 5 3-7 3 7 4-5 4 7z" fill="#ffc93c" stroke="#d0901a" stroke-width="0.8"/>`
    : "";
  return `<svg viewBox="0 0 60 60" aria-hidden="true">
    <circle cx="30" cy="30" r="29" fill="${own ? "#fff6e0" : "#efeafc"}"/>
    <path d="M10 60q2-17 20-17t20 17z" fill="${out}"/>
    <path d="M26 43l4 6 4-6z" fill="${own ? "#fff" : "#c9c3e6"}"/>
    <circle cx="30" cy="27" r="12" fill="${sk}"/>
    <path d="M18 25q0-13 12-13t12 13q-4-6-12-6t-12 6z" fill="${hr}"/>
    ${own ? `<circle cx="25.5" cy="27" r="1.6" fill="#2a1f3e"/><circle cx="34.5" cy="27" r="1.6" fill="#2a1f3e"/><path d="M26 32q4 3.4 8 0" stroke="#8a3a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="22.5" cy="31" rx="2.4" ry="1.4" fill="#ff8a8a" opacity="0.4"/><ellipse cx="37.5" cy="31" rx="2.4" ry="1.4" fill="#ff8a8a" opacity="0.4"/>` : `<text x="30" y="33" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">?</text>`}
    ${extra}
  </svg>`;
}

/** A food critic: a beret, a notepad. */
const PERSON_CRITIC = `<svg viewBox="0 0 20 34"><circle cx="10" cy="7" r="5" fill="#f2c39a"/><ellipse cx="10" cy="3.4" rx="5.6" ry="2" fill="#1c1640"/><path d="M3 32v-12q0-6 7-6t7 6v12z" fill="#2a2a3a"/><rect x="12" y="17" width="5" height="6" rx="1" fill="#fff" stroke="#bbb" stroke-width="0.5"/><rect x="5" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/><rect x="11" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/></svg>`;

/** Distance from a point to a line segment (screen px). */
function distToSeg(x: number, y: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l));
  return Math.hypot(x - (a[0] + dx * k), y - (a[1] + dy * k));
}

/** The More grid: each tile presses the button it stands for (so locked ones stay hidden). */

/** From the tap to the cup in the neighbor's hand (and the cash), for the first sale. */
const FIRST_HANDOFF_MS = 900;

/** Plays a tab's "just unlocked" pop. */
function replayPop(el: HTMLElement): void {
  el.classList.remove("tab-new"); void el.offsetWidth; el.classList.add("tab-new");
  setTimeout(() => el.classList.remove("tab-new"), 2400);
}

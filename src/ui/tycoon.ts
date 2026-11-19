// The Tycoon screens: the business list (tap to run, buy levels, hire managers), boosts,
// the New Era, the live card on the home screen and the "while you were away" welcome.
import { decorMult } from "../logic/decor";
import { cafeMult } from "../logic/cafe";
import { vipActive } from "../logic/vip";
import { GEM_BONUS } from "../data/tycoon";
import { bizThumb } from "../render3d/thumbs";
import { ADVISORS, BOOM_MULT, CRATE_CRYSTALS, FESTIVAL_MULT, UPGRADES, VAULT_HOURS, type Advisor, BUSINESSES, coins, RUSH_MULT, STAGE_AT, STAGE_LABEL, COIN_BOOST_CRYSTALS, SPEEDUPS_PER_DAY } from "../data/tycoon";
import { t, tn } from "../i18n";
import { orderFor, ORDER_MULT } from "../logic/orders";
import { claimSpire, spireReady, SPIRE_GOALS, type SpireNow } from "../logic/spire";
import { orderText } from "./orders";
import { fmt } from "../core/util";
import type { SaveData } from "../logic/save";
import {
  affordable, buyBoost, buyLevels, costOf, cycleOf, eraGems, freeFloors, hireManager, levelOf, multiplier, newEra, nextMilestone, officeFloors, usedFloors,
  payOf, perSecond, progressOf, goldenArrives, goldenTip, GOLDEN_SECONDS, startOpening, OPENING_MULT, OPENING_MINUTES, runOnce, rushOn, speedupsLeft, dealGoals, goalStep, offlineHours, GOAL_STARS, GOAL_TIERS, GOALS_BONUS_CRYSTALS, type GoalType, warpPrice, doublePrice, doubleAway, stageName, stageNow, readyStage, hqFloors, nextStage, startRush, upgradesOnOffer, buyUpgrade, hireAdvisor, vaultCost, buyVault, festivalBiz, vipRate, review, tick, timeWarp, unlockedBusiness, vipTip,
  bizMult, workerBonus,
} from "../logic/tycoon";
import type { Sound } from "../sound";
import { $, closeModal, esc, openModal, openModalEl, toast, vibrate, wireModal } from "./dom";
import { burst, confetti, fireworks } from "./fx";
import { iconSvg } from "./icons";
import { track } from "../stats";
import { claimTerrace, FLOWER_WIDE, PLAY_FLOORS, projectsOpen, seatingNeed, WIDE_SHARE, type ProjectId } from "../logic/cafe";
import type { BizBlock } from "../render3d/block";
import { titleFor } from "../data/titles";
import { xpNeeded } from "../logic/rules";
import { missionText } from "../data/missions";
import { MAYOR_SVG, mayorNote, mayorSvg } from "./mayor";

export interface TycoonHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  refresh(): void;
  openCrystalShop(): void;
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
  /** Where a lot's building is on screen (i = -1: the player's first tower). */
  bizScreen(i: number, height: number): { base: [number, number]; top: [number, number] } | null;
  /** Set when the results card sent the player here, to see their tower or the café. */
  townDest: "" | "tower" | "terrace" | "cafe" | "project";
  /** Starts a café-contract tower (the flower market now). */
  playContract(): void;
  /** Starts a tower for a neighborhood project. */
  playProject(p: ProjectId): void;
  /** Where the café block's neighbor stands on screen, or null. */
  bizResident(): [number, number] | null;
  /** This week's Community Spire (asks the server; null when it can't be reached). */
  fetchSpire(): Promise<SpireNow | null>;
}

/** A gold coin with a star, for counters. */
/** Skyhaven Inc.'s cash: a green banknote. */
export const COIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="7" width="21" height="13" rx="2.5" fill="#1f8a4c" transform="rotate(-8 12 13.5)"/><rect x="1.5" y="5" width="21" height="13" rx="2.5" fill="url(#cg)" stroke="#167a42" stroke-width="1.1"/><rect x="4" y="7.5" width="16" height="8" rx="1.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.9"/><circle cx="12" cy="11.5" r="3.3" fill="#e9ffe9"/><text x="12" y="13.7" text-anchor="middle" font-size="6" font-weight="900" font-family="Arial,sans-serif" fill="#167a42">$</text></svg>`;

/** The building's picture at a stage (3D, the same model as in the town). */
const thumbFor = (b: (typeof BUSINESSES)[number], stage: number): string => bizThumb(b.id, stage, b.color[0], b.color[1]);
/** A multiplier, short: 1.2, 3, 12.5, 1.2K. */
const fmtMult = (m: number): string => (m >= 1000 ? fmt(m) : m >= 10 ? String(Math.round(m * 10) / 10) : String(Math.round(m * 100) / 100));

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
    $("ty-build").addEventListener("click", () => { closeModal($("tycoon")); this.host.buildFloors(); });
    $("tycity").addEventListener("click", e => this.onCityTap(e));
    $("tcy-card").addEventListener("click", e => this.onCardTap(e));
    $("tcy-events").addEventListener("click", e => { if ((e.target as Element).closest("[data-golden]")) { e.stopPropagation(); this.catchGolden(); } });
    $("tcy-next").addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); this.nextAct?.(); });
    // Tapping your money opens what you earn, exactly.
    $("tcy-top").querySelector(".tcy-wallet")?.addEventListener("click", e => { e.stopPropagation(); this.host.sound.click(); this.openEarnings(); });
    wireModal($("earnings"));
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
  /** The building whose card is open in the city. */
  private selected = "";
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
    el.style.top = `${Math.round(at[1])}px`;
  }

  /** A look at a building (the camera glides there), then its card closes by itself so the
   *  Next step guide is back in view, unless the player picked something else meanwhile. */
  private glance(id: string): void {
    this.selected = id;
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
      ? t("That's your first tower, standing in your town! Your first neighbor just moved in. They'll head over to the Coffee Cart in a moment: sell them their first coffee.")
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
      this.live();
      this.loop = requestAnimationFrame(frame);
    };
    this.loop = requestAnimationFrame(frame);
  }

  /** What's happening right now, for the 3D district. */
  liveState(): { frame: boolean; golden: string; rush: string; vip: string; critic: string; power: string; sel: string; pulse: string; pulseAt: number; block: BizBlock } {
    const now = Date.now(), s = this.save;
    return {
      pulse: this.pulse.id,
      pulseAt: this.pulse.at,
      sel: this.inCity ? this.selected : "",
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
    $("ty-coins").textContent = coins(this.shownCoins);
    $("tcy-coins").textContent = coins(this.shownCoins);
    if (!$("earnings").hidden && now - this.earnAt > 900) { this.earnAt = now; this.renderEarnings(); }
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
        if (tb) tb.style.setProperty("--p", p.toFixed(3));
        if (this.selected === id) { const cb = $("tcy-card").querySelector<HTMLElement>(".card-prog i"); if (cb) cb.style.width = `${p * 100}%`; }
      }
    }
    if (this.inCity) this.placeTags();
    this.events(now);
    // Prices, labels and buttons follow the coins a few times a second.
    if (now - this.lastSoft > 300) { this.lastSoft = now; this.render(); }
  }

  // ---------- The 3D city: the game's home ----------

  /** What the "Next step" button does right now. */
  private nextAct: (() => void) | null = null;

  /** The one thing the player should do next, always on screen. */
  private nextStep(): { text: string; sub: string; pct?: number; tone: string; act: () => void } {
    const s = this.save, ty = s.tycoon, live = this.liveState();
    const nameOf = (id: string) => t(stageName(id, stageNow(s, id)));
    const select = (id: string) => () => { this.selected = id; this.render(); };
    // First steps come before anything else: the first sale, then (if ready) the café
    // terrace, then a level, then a manager.
    const cart = BUSINESSES[0];
    if (ty.tips === 0) return { text: t("Tap the Coffee Cart to sell your first coffee!"), sub: t("First steps · {n} of 3", { n: 1 }), tone: "learn", act: () => { this.doAct("run", "coffee", $("tcy-next"), null, $("tcy-next"), $("tcy-next")); this.render(); } };
    // Right after the first sale: café seating for the neighbor (built with the next
    // tower), then opening it; the level and the manager come after.
    if (s.cafe.terrace === 0 && s.cafe.starter && s.cafe.moved) {
      const n = seatingNeed(s.cafe);
      return { text: tn(n, "Build {n} more floor for café seating", "Build {n} more floors for café seating", { n }), sub: t("Your neighbor would like to sit down"), pct: s.cafe.floors / (s.cafe.floors + n), tone: "grow", act: () => { this.leave(); this.host.play("classic"); } };
    }
    if (s.cafe.terrace === 1) return { text: t("☕ Your café terrace is ready!"), sub: t("Open it: the Coffee Cart earns more"), tone: "gift", act: () => this.openTerrace() };
    if (ty.tips === 1) return { text: t("Buy a level for the Coffee Cart"), sub: t("First steps · {n} of 3", { n: 2 }), tone: "learn", act: select("coffee") };
    if (ty.tips === 2) return { text: t("Hire a manager for the Coffee Cart"), sub: t("Managers sell for you, even while you're away"), pct: Math.min(1, ty.coins / cart.manager), tone: "learn", act: select("coffee") };
    // A first-time objective stays in view until it's tried: the block's next project, then a
    // business's first HQ (both cost nothing but a tower).
    if (projectsOpen(s.cafe) && !s.seenFeatures.includes("try-contract")) return { text: t("Choose your block's next project"), sub: t("A flower market or a playground: both are waiting on your block"), tone: "grow", act: () => this.openBuild() };
    const firstHq = !s.seenFeatures.includes("try-hq") ? BUSINESSES.find(b => readyStage(s, b.id)) : undefined;
    if (firstHq) {
      const st = readyStage(s, firstHq.id);
      return { text: t("Build the {name} HQ", { name: t(stageName(firstHq.id, st)) }), sub: this.hqSub(firstHq.id, st), tone: "grow", act: () => { this.leave(); this.host.buildHQ(firstHq.id); } };
    }
    // Rewards waiting and a finished chapter.
    if (!$("collect-chip").hidden) return { text: $("collect-chip").textContent ?? "", sub: t("Tap to collect"), tone: "gift", act: () => $("collect-chip").click() };
    if ($("mayor-strip").classList.contains("ready") && !$("mayor-strip").hidden) return { text: t("Chapter complete!"), sub: t("Tap to celebrate with Mayor Pip"), tone: "gift", act: () => $("mayor-strip").click() };
    // Live moments: a golden customer beats everything.
    if (live.golden) return { text: t("✨ A golden customer is at {name}!", { name: nameOf(live.golden) }), sub: t("Catch them before they leave: {n}s", { n: Math.max(0, Math.ceil((this.golden.until - Date.now()) / 1000)) }), tone: "gold", act: () => this.catchGolden() };
    if (live.vip) return { text: t("A VIP is at {name}!", { name: nameOf(live.vip) }), sub: t("Tap them for a big tip"), tone: "hot", act: select(live.vip) };
    if (live.critic) return { text: t("A food critic is at {name}!", { name: nameOf(live.critic) }), sub: t("Serve them for a five-star review"), tone: "hot", act: select(live.critic) };
    if (live.power) return { text: t("Power cut at {name}!", { name: nameOf(live.power) }), sub: t("Tap it to fix the lights"), tone: "hot", act: select(live.power) };
    // Growing: a headquarters to build.
    const grow = BUSINESSES.find(b => readyStage(s, b.id));
    if (grow) {
      const st = readyStage(s, grow.id);
      return { text: t("Build the {name} HQ", { name: t(stageName(grow.id, st)) }), sub: this.hqSub(grow.id, st), tone: "grow", act: () => { this.leave(); this.host.buildHQ(grow.id); } };
    }
    // The next business to open.
    const ni = BUSINESSES.findIndex((b, i) => levelOf(s, b.id) === 0 && unlockedBusiness(s, i));
    if (ni >= 0) {
      const b = BUSINESSES[ni], price = costOf(b, 0, 1);
      if (ty.coins >= price) return { text: t("Open the {name}!", { name: t(b.name) }), sub: t("A new business for your company"), tone: "go", act: select(b.id) };
    }
    // A manager to hire, an upgrade to buy.
    const mgr = BUSINESSES.find(b => levelOf(s, b.id) > 0 && !ty.managers.includes(b.id) && ty.coins >= b.manager);
    if (mgr) return { text: t("Hire a manager for {name}", { name: nameOf(mgr.id) }), sub: t("It keeps earning while you're away"), tone: "go", act: select(mgr.id) };
    const up = upgradesOnOffer(s).find(u => u.cost <= ty.coins);
    if (up) return { text: t("Buy the {name} upgrade", { name: t(up.name) }), sub: up.biz === "all" ? t("Every business earns ×{n}", { n: up.mult }) : t("{name} earns ×{n}", { name: nameOf(up.biz), n: up.mult }), tone: "go", act: () => this.openSheet("upgrades") };
    if (freeFloors(s) < 1) return { text: t("Your offices are full"), sub: t("Build a tower to add office floors"), tone: "grow", act: () => this.openBuild() };
    // Saving up: what for, and how far along.
    if (ni >= 0) {
      const b = BUSINESSES[ni], price = costOf(b, 0, 1);
      return { text: t("Save {n} to open the {name}", { n: coins(price), name: t(b.name) }), sub: t("Keep growing your businesses"), pct: Math.min(1, ty.coins / price), tone: "save", act: select(b.id) };
    }
    const cheap = BUSINESSES.filter(b => levelOf(s, b.id) > 0).sort((a, b) => costOf(a, levelOf(s, a.id), 1) - costOf(b, levelOf(s, b.id), 1))[0];
    return { text: t("Grow {name}", { name: nameOf(cheap.id) }), sub: t("Buy levels to earn more"), pct: Math.min(1, ty.coins / costOf(cheap, levelOf(s, cheap.id), 1)), tone: "save", act: select(cheap.id) };
  }

  /** The tags over every lot, the next step, the card and the bar (rebuilt only when they change). */
  private renderCity(now: number): void {
    const s = this.save, ty = s.tycoon;
    $("tcy-era").textContent = t("Skyhaven Inc.");
    { const ps = perSecond(s, now); $("tcy-rate").textContent = ps > 0 ? t("{n} a second", { n: coins(ps) }) : t("Tap a business to sell"); }
    $("tcy-gems-n").textContent = fmt(s.crystals);
    if (this.shownCoins < 0) $("tcy-coins").textContent = coins(ty.coins);
    const live = this.liveState();
    const gold = live.golden ? `<button type="button" class="ty-chip golden-chip" data-golden="1">✨ ${esc(t("Golden customer · {n}s", { n: Math.max(0, Math.ceil((this.golden.until - now) / 1000)) }))}</button>` : "";
    this.put($("tcy-events"), gold + ($("ty-events").querySelector(".boom")?.outerHTML ?? ""));
    // The player's first tower has its own bubble (a caption during the first look at it).
    const starterTag = s.cafe.starter ? `<button type="button" class="tag bub starter${live.frame ? " sel" : ""}" data-tag="starter" data-i="-1" data-h="-1"><span class="tag-ico">🏢</span>${live.frame ? `<b>${esc(t("Your first tower!"))}</b>` : ""}</button>` : "";
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
    this.put($("tcy-labels"), starterTag + (closeUp ? "" : blockTags) + BUSINESSES.map((b, i) => {
      if (closeUp && b.id !== "coffee") return "";
      const lv = levelOf(s, b.id), owned = lv > 0, open = unlockedBusiness(s, i);
      if (!owned && !open) return "";
      if (!owned) return `<button type="button" class="tag bub lease${this.selected === b.id ? " sel" : ""}" data-tag="${b.id}" data-i="${i}" data-h="-1"><span class="tag-ico">+</span><b>${esc(t("Open"))}</b></button>`;
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
        ${badge}<span class="tag-ico">${iconSvg(b.icon)}</span>${sel ? `<b>${esc(t(stageName(b.id, st)))}</b>` : ""}<span class="tag-pops"></span>
      </button>`;
    }).join(""));
    // The next step.
    const n = this.nextStep();
    this.nextAct = n.act;
    this.put($("tcy-next"), `<span class="next-ico">${n.tone === "learn" ? COACH_FACE : n.tone === "gift" ? "🎁" : n.tone === "hot" ? "⚡" : n.tone === "grow" ? "🏗️" : n.tone === "save" ? "💰" : "✨"}</span>
      <span class="next-txt"><small>${esc(t("Next step"))}</small><b>${esc(n.text)}</b><em>${esc(n.sub)}</em>${n.pct !== undefined ? `<i class="next-bar"><i style="width:${(n.pct * 100).toFixed(0)}%"></i></i>` : ""}</span><span class="next-go">›</span>`);
    $("tcy-next").className = `tcy-next tone-${n.tone}`;
    $("tcy-next").hidden = !!this.selected;
    this.renderCard(now);
    // Dots on the bar: only for something you can act on.
    const dot = (k: string, on: boolean) => { $("tcy-bar").querySelector<HTMLElement>(`[data-open="${k}"] .dot`)!.hidden = !on; };
    const lit = (id: string) => !!document.querySelector(`#${id}:not([hidden]) .dot:not([hidden])`);
    dot("shop", lit("shop-btn"));
    dot("company", !!$("tycoon").querySelector(".ty-tabs .dot:not([hidden])"));
    // Red dots mean "something to collect right now", never "you could buy something".
    dot("build", false);
    dot("goals", (!!this.spire && spireReady(s.spire, this.spire) > 0) || lit("missions-btn") || lit("pass-btn") || ($("mayor-strip").classList.contains("ready") && !$("mayor-strip").hidden));
    dot("me", lit("ranks-btn") || lit("city-btn") || lit("level-btn"));
    this.unlockTabs();
  }

  /** A new player's bar starts with BUILD alone; the rest appear as they're needed: Company
   *  after the first sale, Goals once the first steps are done, Shop and Me after the third
   *  tower. Each new tab pops in with a note (not on launch: then it's just there). */
  private barReady = false;
  private unlockTabs(): void {
    const s = this.save, tw = s.profile.towers, tips = s.tycoon.tips;
    const open: Record<string, boolean> = { company: tips >= 1 || tw >= 3, goals: tips >= 3 || tw >= 3, shop: tw >= 3, me: tw >= 3, build: true };
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
    $("tcy-gems").hidden = s.crystals <= 0 && tw < 3;
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
    hand.style.top = `${Math.round(r.top - 6)}px`;
    hand.hidden = false;
  }

  /** Keeps each tag floating over its building as the camera moves. */
  private placeTags(): void {
    const items: { tag: HTMLElement; x: number; y: number; base: number }[] = [];
    for (const tag of $("tcy-labels").querySelectorAll<HTMLElement>(".tag")) {
      const p = this.host.bizScreen(Number(tag.dataset.i), Number(tag.dataset.h));
      if (!p) { tag.style.visibility = "hidden"; continue; }
      tag.style.visibility = "";
      items.push({ tag, x: p.top[0], y: p.top[1], base: p.base[1] });
    }
    // Front buildings keep their spot; a bubble that would sit on another moves up a little.
    items.sort((a, b) => b.base - a.base);
    const placed: { x: number; y: number; w: number }[] = [];
    for (const it of items) {
      const w = it.tag.offsetWidth || 44;
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find(o => Math.abs(o.x - it.x) < (o.w + w) / 2 - 2 && Math.abs(o.y - it.y) < 42);
        if (!hit) break;
        it.y = hit.y - 44;
      }
      placed.push({ x: it.x, y: it.y, w });
      it.tag.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px) translate(-50%, -100%)`;
      // Buildings nearer the front draw their tags on top.
      it.tag.style.zIndex = it.tag.classList.contains("sel") ? "999" : String(Math.round(it.base));
    }
  }

  /** A tap in the city: on a tag, or on a building (the nearest one under the finger). */
  private onCityTap(e: MouseEvent): void {
    const target = e.target as Element;
    if (target.closest(".tcy-top, .tcy-bar, .tcy-card, .tcy-next")) return;
    const act = target.closest<HTMLElement>("[data-act]"), tag = target.closest<HTMLElement>(".tag");
    let id = tag?.dataset.tag ?? "";
    if (id.startsWith("proj-")) {
      const pid = id.slice(5) as ProjectId;
      if (this.save.cafe.done.includes(pid)) toast(pid === "flowers" ? t("🌷 The flower market opens in your block!") : t("🛝 The playground opens in your block!"));
      else this.openBuild();
      return;
    }
    if (id === "starter") {
      const st = this.save.cafe.starter;
      if (st) toast(tn(st.f, "Your first tower: {n} floor", "Your first tower: {n} floors", { n: st.f }));
      return;
    }
    if (!id) {
      let best = 56;
      BUSINESSES.forEach((b, i) => {
        if (levelOf(this.save, b.id) === 0 && !unlockedBusiness(this.save, i)) return;
        const h = -1;
        const p = this.host.bizScreen(i, h);
        if (!p) return;
        const d = distToSeg(e.clientX, e.clientY, p.base, p.top);
        if (d < best) { best = d; id = b.id; }
      });
    }
    // Tapping empty sky or grass closes the card.
    if (!id) { if (this.selected) { this.selected = ""; this.render(); } return; }
    const s = this.save, owned = levelOf(s, id) > 0, pop = tag?.querySelector(".tag-pops") ?? $("tcy-labels");
    // The very first sale: one tap on the cart sells (no card in the way of the guide).
    if (owned && !act && s.tycoon.tips === 0 && id === BUSINESSES[0].id) { this.doAct("run", id, tag ?? $("tcy-labels"), e, pop, tag ?? $("tcy-labels")); return; }
    if (act && owned) this.doAct(act.dataset.act!, id, act, e, pop, tag ?? $("tcy-labels"));
    // Tapping the selected building (with no manager yet) sells.
    else if (owned && this.selected === id && !s.tycoon.managers.includes(id)) this.doAct("run", id, tag ?? $("tcy-labels"), null, pop, tag ?? $("tcy-labels"));
    if (this.selected !== id) { this.selected = id; this.host.sound.click(); vibrate(s.settings.vibrate, 6); }
    this.render();
  }

  /** The card for the selected building: one big main button, a few small ones. */
  private renderCard(now: number): void {
    const card = $("tcy-card"), s = this.save, ty = s.tycoon;
    const i = BUSINESSES.findIndex(b => b.id === this.selected);
    card.hidden = i < 0;
    if (i < 0) return;
    const b = BUSINESSES[i], lv = levelOf(s, b.id), owned = lv > 0;
    const st = owned ? stageNow(s, b.id) : 0, grow = owned ? readyStage(s, b.id) : 0, managed = ty.managers.includes(b.id);
    const room = Math.max(1, freeFloors(s)), noRoom = freeFloors(s) < 1;
    const n = Math.min(room, this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
    const price = costOf(b, lv, n), canBuy = price <= ty.coins && !noRoom;
    const ns = owned ? nextStage(lv) : undefined;
    const goal = !owned ? t("A new business: it earns {n} a sale", { n: coins(b.income * multiplier(s, now)) })
      : grow ? t("Ready to grow! HQ order: {order} for ×{m} earnings", { order: orderText(orderFor(i, grow)), m: ORDER_MULT })
      : ns ? t("Grows into {name} at {n} floors", { name: t(stageName(b.id, st + 1)), n: ns }) : t("Fully grown!");
    const amountLabel = this.amount === "max" ? "MAX" : `×${this.amount}`;
    const main = grow
      ? `<button type="button" class="card-main grow" data-card="hq"><b>${esc(t("Build the HQ"))}</b><small>${esc(t("{n} floors", { n: hqFloors(grow) }))}</small></button>`
      : noRoom ? `<button type="button" class="card-main floors" data-card="buy"><b>${esc(t("Build more floors"))}</b><small>${esc(t("Your offices are full"))}</small></button>`
      : `<button type="button" class="card-main" data-card="buy"${canBuy ? "" : " disabled"}><b>${esc(owned ? t("Buy {n}", { n: amountLabel }) : t("Open it"))}</b><small>${COIN_SVG}${esc(coins(price))}</small></button>`;
    this.put(card, `<div class="card-head" style="--b1:${b.color[0]};--b2:${b.color[1]}">
        <span class="card-ico">${iconSvg(b.icon)}</span>
        <span class="card-name"><b>${esc(t(owned ? stageName(b.id, st) : b.name))}</b><small>${owned ? `${"★".repeat(st + 1)} · ${esc(tn(lv, "{n} floor", "{n} floors", { n: fmt(lv) }))} · ${esc(t("{n} a sale", { n: coins(payOf(s, b, now)) }))}` : esc(t("For lease"))}</small></span>
        <button type="button" class="card-x" data-card="close" aria-label="${esc(t("Close"))}">×</button>
      </div>
      ${owned ? `<i class="card-prog"><i></i></i>` : ""}
      <p class="card-info">${esc(goal)}</p>
      <div class="card-acts">
        ${main}
        ${owned && !grow && !noRoom ? `<button type="button" class="card-amount" data-card="amount" aria-label="${esc(t("How many to buy"))}">${amountLabel}</button>` : ""}
      </div>
      <div class="card-row">
        ${owned && !managed ? `<button type="button" class="card-small run" data-card="run">${esc(t("Sell now"))}</button>
          <button type="button" class="card-small" data-card="hire"${ty.coins < b.manager ? " disabled" : ""}>${esc(t("Hire manager"))} · ${esc(coins(b.manager))}</button>` : owned ? `<span class="card-auto">${esc(t("A manager runs it"))}</span>` : ""}
        ${owned ? `<button type="button" class="card-small" data-card="look">${esc(t("All businesses"))}</button>` : ""}
      </div>
      <span class="tag-pops card-pops"></span>`);
  }

  private onCardTap(e: MouseEvent): void {
    const el = (e.target as Element).closest<HTMLElement>("[data-card]");
    if (!el) return;
    e.stopPropagation();
    const id = this.selected, card = $("tcy-card"), what = el.dataset.card!;
    if (what === "close") { this.selected = ""; this.host.sound.click(); this.render(); return; }
    if (what === "amount") {
      const order: (number | "max")[] = [1, 10, 100, "max"];
      this.amount = order[(order.indexOf(this.amount) + 1) % order.length];
      $("tycoon").querySelectorAll<HTMLElement>(".ty-amount button").forEach(x => x.setAttribute("aria-checked", String(x.dataset.n === String(this.amount))));
      this.host.sound.click();
      this.render();
      return;
    }
    if (what === "look") { this.openSheet("company", id); return; }
    const tag = $("tcy-labels").querySelector<HTMLElement>(`[data-tag="${id}"]`) ?? card;
    this.doAct(what === "buy" && freeFloors(this.save) < 1 ? "buy" : what, id, el, e, card.querySelector(".card-pops")!, tag);
    this.render();
  }

  // ---------- Build and More ----------

  /** An HQ's ask: its height, and its building order (filled, the business earns more for good). */
  private hqSub(id: string, stage: number): string {
    const o = orderFor(BUSINESSES.findIndex(b => b.id === id), stage);
    return t("{n} floors · order: {order} for ×{m} earnings", { n: hqFloors(stage), order: orderText(o), m: ORDER_MULT });
  }

  /** Build: the tower modes in one place (and any headquarters waiting to be built). */
  private openBuild(): void {
    const s = this.save, rows: string[] = [];
    // No choice to make (no HQ waiting, no other modes yet): straight into a tower.
    const choice = projectsOpen(s.cafe) || BUSINESSES.some(b => readyStage(s, b.id)) || ["daily-btn", "challenges-btn", "zen-btn"].some(id => !$(id).hidden);
    if (!choice) { this.leave(); this.host.play("classic"); return; }
    // The block's next project: two choices, each previewed (what to build, what opens),
    // and each also waiting as a see-through preview on its spot in the block.
    if (projectsOpen(s.cafe)) {
      const c = s.cafe, pct = Math.round(WIDE_SHARE * 100);
      if (!c.done.includes("flowers")) rows.push(`<button type="button" class="tcy-mode project" data-mode="flowers"><span class="mode-ico">🌷</span><span><b>${esc(t("Flower market: land {n} wide floors", { n: FLOWER_WIDE }))}</b><small>${esc(t("A wide floor keeps {pct}% of the first floor's width. A flower stall opens by your tower, and shoppers carry flowers home", { pct }))}${c.wideBest ? esc(" · " + t("best: {n}", { n: c.wideBest })) : ""}</small></span></button>`);
      if (!c.done.includes("play")) rows.push(`<button type="button" class="tcy-mode project" data-mode="play"><span class="mode-ico">🛝</span><span><b>${esc(t("Playground: build {n} floors in one tower", { n: PLAY_FLOORS }))}</b><small>${esc(t("Go tall. A slide opens by your tower, and a family from your tower comes to play"))}${c.playBest ? esc(" · " + t("best: {n}", { n: c.playBest })) : ""}</small></span></button>`);
    }
    for (const b of BUSINESSES) {
      const st = readyStage(s, b.id);
      if (st) rows.push(`<button type="button" class="tcy-mode hq" data-mode="hq" data-id="${b.id}"><span class="mode-ico">🏗️</span><span><b>${esc(t("Build the {name} HQ", { name: t(stageName(b.id, st)) }))}</b><small>${esc(this.hqSub(b.id, st))}</small></span></button>`);
    }
    const mode = (k: string, ico: string, title: string, sub: string, src?: string) => {
      if (src && $(src).hidden) return;
      const dot = src && $(src).querySelector(".dot:not([hidden])") ? `<i class="dot"></i>` : "";
      rows.push(`<button type="button" class="tcy-mode" data-mode="${k}"><span class="mode-ico">${ico}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${dot}</button>`);
    };
    mode("classic", "🏢", t("Classic tower"), t("Earn office floors and cash for your company"));
    mode("daily", "📅", t("Daily tower"), t("The same tower for everyone today"), "daily-btn");
    mode("journey", "🗺️", t("Journey"), t("Landmark challenges, one by one"), "challenges-btn");
    mode("zen", "🍃", t("Zen"), t("Relax and build, no pressure"), "zen-btn");
    $("tcy-modes").innerHTML = rows.join("");
    openModal($("tcy-buildsheet"));
  }

  private onModeTap(e: Event): void {
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
    void this.host.fetchSpire().then(sp => {
      this.spire = sp;
      if (!$("tcy-goalsheet").hidden) this.renderGoalsSheet();
    });
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

  private renderGoalsSheet(): void {
    const s = this.save, parts: string[] = [];
    if (!$("mayor-strip").hidden) {
      parts.push(`<h3 class="sheet-sub">${esc(t("Story"))}</h3><button type="button" class="mayor-strip more-mayor${$("mayor-strip").classList.contains("ready") ? " ready" : ""}" data-goal="story">${$("mayor-strip").innerHTML}</button>`);
    }
    dealGoals(s);
    parts.push(`<h3 class="sheet-sub">${esc(t("Today's company goals"))}</h3>${this.goalsHtml()}`);
    parts.push(this.spireHtml());
    if (!$("missions-btn").hidden && s.missions.slots.length) {
      const rows = s.missions.slots.map(m => {
        const done = !!m.d || m.p >= m.n;
        return `<div class="ty-goal${done ? " done" : ""}"><span class="ty-goal-check">${done ? "✓" : "★"}</span><span><b>${esc(missionText(m))}</b>
          <i class="ty-goal-bar"><i style="width:${Math.min(100, (m.p / m.n) * 100)}%"></i></i></span><em>${done ? esc(t("Done")) : `${Math.min(m.p, m.n)}/${m.n}`}<small>+${m.r} ★</small></em></div>`;
      }).join("");
      parts.push(`<h3 class="sheet-sub">${esc(t("Tower missions"))}</h3><div class="ty-goals">${rows}</div><button type="button" class="card-small goals-more" data-goal="missions">${esc(t("See missions and rewards"))} →</button>`);
    }
    $("tcy-goals").innerHTML = parts.join("");
  }

  private onGoalsTap(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>("[data-goal]");
    if (!el) return;
    if (el.dataset.goal === "spire") {
      const s = this.save, stars = this.spire ? claimSpire(s.spire, this.spire) : 0;
      if (stars) {
        s.stars += stars; s.starsEarned += stars;
        this.host.persist(); this.host.sound.unlock();
        burst(el, 20);
        toast(t("🗼 Community Spire: +{n} ★", { n: stars }));
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
        { id: "pass", name: "Sky Pass", open: () => $("pass-btn").click(), show: () => !$("pass-btn").hidden },
      ],
      me: [
        { id: "profile", name: "Profile", open: () => $("level-btn").click() },
        { id: "ranks", name: "Ranks", open: () => $("ranks-btn").click(), show: () => !$("ranks-btn").hidden },
        { id: "city", name: "Sky City", open: () => $("city-btn").click(), show: () => !$("city-btn").hidden },
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
      let seg = sheet.querySelector<HTMLElement>(":scope > .tab-seg");
      if (pages.length < 2) { seg?.remove(); return; }
      if (!seg) { seg = document.createElement("div"); seg.className = "tab-seg"; sheet.prepend(seg); }
      seg.innerHTML = pages.map(p => `<button type="button" data-page="${p.id}"${p.id === open.id ? ` class="on"` : ""}>${esc(t(p.name))}</button>`).join("");
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
      <span class="more-stars">★ ${fmt(s.stars)}</span>
      <button type="button" class="more-gear" data-src="settings-btn" aria-label="${esc(t("Settings"))}"><svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.4 4.6l1.6 1.2-1.6 2.8-1.9-.7a7 7 0 01-1.6.9l-.3 2H12.8l-.3-2a7 7 0 01-1.6-.9l-1.9.7-1.6-2.8 1.6-1.2a7 7 0 010-1.8L7.4 10l1.6-2.8 1.9.7a7 7 0 011.6-.9l.3-2h3.2l.3 2c.6.2 1.1.5 1.6.9l1.9-.7 1.6 2.8-1.6 1.2a7 7 0 010 1.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
    </div>`;
    // What's inside each place, at a glance.
    const tile = (src: string, ico: string, name: string, sub: string, tone: string, show = true) => !show ? "" :
      `<button type="button" class="more-tile tone-${tone}" ${src === "company" ? `data-company="1"` : `data-src="${src}"`}><span class="more-ico">${ico}</span><span class="more-txt"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${src !== "company" && dotOf(src) ? `<i class="dot"></i>` : ""}</button>`;
    const owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0).length;
    $("tcy-more").innerHTML = me + `<div class="more-grid">
      ${tile("company", "🏢", t("My company"), t("{n} of {total} businesses", { n: owned, total: BUSINESSES.length }), "violet")}
      ${tile("shop-btn", "🛍️", t("Shop"), t("Skins, islands, gems"), "pink", shown("shop-btn"))}
      ${tile("pass-btn", "🎟️", t("Sky Pass"), dotOf("pass-btn") ? t("Rewards to claim!") : t("This month's rewards"), "orange", shown("pass-btn"))}
      ${tile("ranks-btn", "🏆", t("Ranks"), t("Beat the best builders"), "gold", shown("ranks-btn"))}
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
    if (!this.power.id && now > this.nextPower && !busy()) {
      this.power = { id: pick().id, until: now + 15000, taps: 5 };
      this.nextPower = now + 180000 + Math.random() * 120000;
      this.render();
    }
    if (now > this.nextRush && !busy()) {
      this.nextRush = now + 180000 + Math.random() * 120000;
      const id = startRush(s, now);
      if (id) {
        toast(t("Rush hour at {name}! ×{n} for a while", { name: t(stageName(id, stageNow(s, id))), n: RUSH_MULT }));
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
    $("ty-sky").className = `ty-sky ${h >= 20 || h < 6 ? "tod-night" : h >= 17 || h < 8 ? "tod-dusk" : "tod-day"}`;
    const rows: string[] = [];
    BUSINESSES.forEach((b, i) => {
      if (!unlockedBusiness(s, i) && (i === 0 || !unlockedBusiness(s, i - 1))) return;
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
        ${thumbFor(b, stage) ? `<img class="room-thumb${owned ? "" : " ghost"}" alt="" src="${thumbFor(b, stage)}">` : ""}
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
        ${owned && this.power.id === b.id && this.power.until > now ? `<span class="power-cut" data-act="power" role="button"><b>${esc(t("Power cut!"))}</b><small></small></span>` : ""}
        ${owned ? `<b class="room-level"></b>` : ""}
        ${owned && !managed ? `<span class="tap-me">${esc(t("Tap!"))}</span>` : ""}
        <span class="room-pops"></span>
        <div class="ty-prog"><i></i><span></span></div>
      </button>
      ${owned ? `<div class="room-stats"><span class="rs rs-ps"><small>${esc(t("Per second"))}</small><b></b></span><span class="rs rs-cyc"><small>${esc(t("Each sale"))}</small><b></b></span><span class="rs rs-mult"><small>${esc(t("Bonus"))}</small><b></b></span></div>` : ""}
      <div class="room-bar">
        ${grow ? `<button type="button" class="hq-btn" data-act="hq">${esc(t("Build the {name} HQ", { name: t(stageName(b.id, grow)) }))}<em>${esc(t("{n} floors", { n: hqFloors(grow) }))}</em></button>` : `<small class="room-info"></small>`}
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
      const n = Math.min(room, this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount);
      const price = costOf(b, lv, n), next = nextMilestone(lv), ns = owned ? nextStage(lv) : undefined;
      // On the Company page the banner says it all in one line: floors, and what's next.
      const cards = document.body.classList.contains("city-home");
      const nextLine = !owned ? "" : ns && ns <= (next ?? Infinity) ? t("Next: {name} at {n}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)), n: ns })
        : next ? t("×2 speed at {n}", { n: next }) : t("Top speed!");
      set(row.querySelector(".room-level"), tn(lv, "{n} floor", "{n} floors", { n: fmt(lv) }) + (cards && nextLine ? ` · ${nextLine}` : ""));
      set(row.querySelector(".ty-prog span"), owned ? t("{n} a sale", { n: coins(payOf(s, b, now)) }) : t("Earns {n} a sale", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".room-info"), owned
        ? (ns && ns <= (next ?? Infinity) ? t("Grows into {name} at {n}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)), n: ns })
          : next ? t("{n} floors: twice as fast", { n: next }) : t("Top speed!")) + " · " + fmtSec(cycleOf(b, lv))
        : t("Open it to earn {n} a cycle", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".power-cut small"), t("Tap {n} times to fix", { n: this.power.taps }));
      if (owned) {
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
        set(buy, `<small>${esc(owned ? t("Buy ×{n}", { n: fmt(n) }) : t("Open"))}</small>${COIN_SVG}${esc(coins(price))}`, true);
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
        this.leave();
        this.host.buildHQ(b.id);
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
        const got = vipTip(s, b.id);
        const box = popBox;
        for (let k = 0; k < 5; k++) setTimeout(() => popCoin(box, k === 0 ? coins(got) : ""), k * 90);
        this.host.sound.coins();
        toast(t("Lights back on! The customers stayed: +{n}", { n: coins(got) }));
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
        if (el.classList.contains("need-floors")) { toast(t("Every office floor is full. Build a tower to add more!")); this.leave(); this.host.buildFloors(); return; }
        tick(s);
        const lv = levelOf(s, b.id), owned = lv > 0, wasReady = !!readyStage(s, b.id);
        const got = buyLevels(s, b.id, this.amount);
        if (!got) { this.host.sound.click(); return; }
        this.goal("buy", got);
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
    this.host.sound.purchase();
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
    if (r.stars) { toast(t("Goal done! +{n} ★", { n: r.stars })); this.host.sound.unlock(); }
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
      : k === "taps" ? t("Run a business by hand {n} times", { n }) : t("Catch {n} rush hours", { n });
    const icon: Record<GoalType, string> = { vip: "crown", buy: "building", taps: "sparkle", rush: "bolt" };
    return `<div class="ty-goals">` + g.list.map(x => {
      const done = x.p >= x.n, stars = GOAL_STARS[Math.max(0, GOAL_TIERS[x.t].indexOf(x.n))];
      return `<div class="ty-goal${done ? " done" : ""}"><span class="ty-goal-check">${done ? "✓" : iconSvg(icon[x.t])}</span><span><b>${esc(text(x.t, x.n))}</b>
        <i class="ty-goal-bar"><i style="width:${Math.min(100, (x.p / x.n) * 100)}%"></i></i></span><em>${done ? esc(t("Done")) : `${x.p}/${x.n}`}<small>+${stars} ★</small></em></div>`;
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
    $("ty-floors").textContent = t("{used} of {total} used", { used: fmt(used), total: fmt(total) });
    $("ty-fbar").style.width = `${Math.min(100, (used / total) * 100)}%`;
    $("ty-build").classList.toggle("urgent", freeFloors(s) === 0);
  }

  private renderBoosts(): void {
    this.put($("ty-boosts"), this.boostsHtml());
  }

  /** What you earn, exactly: per second, minute, hour and day; each business's share;
   *  every bonus at work; and what managers bring in while you're away. */
  openEarnings(): void {
    this.renderEarnings();
    openModal($("earnings"));
  }

  private renderEarnings(): void {
    const s = this.save, ty = s.tycoon, now = Date.now(), ps = perSecond(s, now);
    $("earn-sub").textContent = t("Earned so far: {n}", { n: coins(ty.lifetime) });
    $("earn-ps").textContent = coins(ps);
    $("earn-pm").textContent = coins(ps * 60);
    $("earn-ph").textContent = coins(ps * 3600);
    $("earn-pd").textContent = coins(ps * 86400);
    const rows = BUSINESSES.filter(b => levelOf(s, b.id) > 0).map(b => {
      const lv = levelOf(s, b.id), auto = ty.managers.includes(b.id), v = auto ? payOf(s, b, now) / cycleOf(b, lv) : 0;
      return { b, v, auto, lv };
    }).sort((a, z) => z.v - a.v);
    const top = Math.max(1e-9, ...rows.map(r => r.v));
    this.put($("earn-list"), rows.map(r => `<div class="earn-biz" style="--b1:${r.b.color[0]};--b2:${r.b.color[1]}">
      <span class="eb-ico">${iconSvg(r.b.icon)}</span>
      <span class="eb-main"><b>${esc(t(stageName(r.b.id, stageNow(s, r.b.id))))}</b><i class="eb-bar"><i style="width:${Math.max(3, (r.v / top) * 100).toFixed(1)}%"></i></i></span>
      <span class="eb-val">${r.auto ? `<b>${esc(coins(r.v))}</b><small>${esc(t("a second"))}${ps > 0 ? ` · ${Math.round((r.v / ps) * 100)}%` : ""}</small>` : `<b class="eb-need">${esc(t("No manager"))}</b><small>${esc(t("Sells when you tap"))}</small>`}</span>
    </div>`).join("") || `<p class="sheet-note">${esc(t("Open your first business to start earning."))}</p>`);
    // The bonuses at work (only the ones you have).
    const bon: [string, string, string][] = [];
    const pct = (m: number) => `+${Math.round((m - 1) * 100)}%`;
    if (ty.boost) bon.push(["bolt", t("Cash booster"), "×2"]);
    if (ty.opening > now) bon.push(["party", t("Grand opening"), `×${OPENING_MULT}`]);
    if (vipActive(s, now)) bon.push(["crown", t("VIP"), "×1.25"]);
    if (ty.gems > 0) bon.push(["gem", t("Investors"), pct(1 + ty.gems * GEM_BONUS)]);
    if (workerBonus(s) > 1.001) bon.push(["city", t("Your sky city's workers"), pct(workerBonus(s))]);
    if (s.decor.length) bon.push(["island", t("Island decorations"), pct(decorMult(s))]);
    if (s.cafe.terrace === 2 || s.cafe.done.length) bon.push(["coffee", t("Café block (Coffee Cart)"), pct(cafeMult(s.cafe))]);
    const ups = ty.upgrades.length;
    if (ups) bon.push(["star", t("Upgrades bought"), String(ups)]);
    if (ty.advisors.length) bon.push(["medal", t("Advisors on your team"), String(ty.advisors.length)]);
    bon.push(["rocket", t("All businesses together"), `×${fmtMult(multiplier(s, now))}`]);
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
      rate <= 0 ? t("Hire a manager first") : left <= 0 ? t("No more speed-ups today. Come back tomorrow!") : t("Get {n} right now", { n: coins(rate * h * 3600) }),
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
    this.put($("ty-era-card"), `<span class="ty-gem">${iconSvg("gem")}</span>
      <span><b>${esc(t("{n} Sky Gems", { n: fmt(s.tycoon.gems) }))}</b><small>${esc(t("Each gem adds 2% to all earnings, for good. Start a New Era to collect the gems your cash has earned."))}</small></span>
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

  private short(price: number): void {
    toast(t("You need {n} more Sky Crystals", { n: fmt(price - this.save.crystals) }));
    closeModal($("tycoon"));
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
    const cap = offlineHours(this.save), h = Math.min(cap, awayMs / 3600e3);
    $("welcome-vault-bar").style.width = `${(h / cap) * 100}%`;
    $("welcome-vault").classList.toggle("full", h >= cap);
    $("welcome-vault-text").textContent = h >= cap ? t("Vault full! Managers stop after {n} hours: come back sooner to earn more.", { n: cap })
      : t("Vault {h} of {n} hours full", { h: h.toFixed(1), n: cap });
    const x3 = $<HTMLButtonElement>("welcome-x3"), price = doublePrice(this.save, awayMs);
    x3.textContent = t("Double it · 💎 {n}", { n: price });
    x3.hidden = speedupsLeft(this.save) <= 0;
    let paid = false;
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
    case "biz": return t("{names} earn ×{n}", { names: (a.biz ?? []).map(id => t(BUSINESSES.find(b => b.id === id)!.name)).join(" & "), n: a.n });
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

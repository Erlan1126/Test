// The game controller: screens, input, the frame loop, and turning drops into effects.
import { clamp, fmt, shortName } from "./core/util";
import { challengeById, type Challenge } from "./data/challenges";
import { GOLD, MILESTONES } from "./data/constants";
import { eventEndsIn, eventFor, weekIndex } from "./data/events";
import { BOOSTS, MAX_BOOSTS } from "./data/shop";
import { skinById, SKINS } from "./data/skins";
import { shapeById } from "./data/shapes";
import { currentShape } from "./logic/shapes";
import { addToSkyline, districtTowers } from "./logic/skyline";
import { addPopulation, CITY_NAME, DISTRICTS, peopleFrom } from "./logic/city";
import { titleFor, upcoming } from "./data/titles";
import { SHAPES } from "./data/shapes";
import { setVip } from "./logic/vip";
import { holidayProgress, holidayTower } from "./logic/holidays";
import { holidayAt, holidayDaysLeft } from "./data/holidays";
import { ALBUM_CRYSTALS, collectPostcard, POSTCARD_STARS, SET_STARS, type PostcardGain } from "./logic/postcards";
import { FEATURE_NAMES, isNew, isOpen, openedBetween, type Feature } from "./logic/features";
import { challengeOpen, currentTheme, isSkinUnlocked, islandLevel, nextChallenge, recordRun, type RunOutcome } from "./logic/progress";
import { dailySeed, dayNumber, duration, giftState, xpNeeded } from "./logic/rules";
import { loadSave, normalize, SAVE_KEY, writeSave, type SaveData } from "./logic/save";
import { boostCount, takeBoosts, type ActiveBoosts } from "./logic/shop";
import { POWER_FLOORS, TICK, TowerSim, type DropOutcome, type FloorKind, type PowerUp } from "./logic/sim";
import { RunRecorder, simFor } from "./logic/replay";
import type { Mode } from "./logic/types";
import { floorColor, lookFor } from "./render/buildings";
import type { Debris } from "./render/effects";
import { makeShareImage, preloadLogo } from "./render/previews";
import { Renderer, type Shot } from "./render/renderer";
import { Renderer3D, webglAvailable } from "./render3d/renderer3d";
import { nightAt } from "./render/scenery";
import { Sound } from "./sound";
import { $, closeModal, displayName, esc, openModal, openModalEl, replay, swatchHtml, toast, vibrate, wireModal, wireTabs } from "./ui/dom";
import { DailySheets, type DailyHost } from "./ui/daily";
import { Sheets } from "./ui/sheets";
import { Online } from "./online";
import { choosePayments, purchaseReturn } from "./payments";
import { buyWithCrystals, grantPack, newPlayerId } from "./logic/premium";
import { carriedOver, passTier, refreshPass, rewardText, unclaimed } from "./logic/pass";
import type { CrystalPack, Product } from "./data/premium";
import type { PackPurchase } from "./payments";
import { chestReady, claimChest, claimLeagueReward, collectRent, pendingLeagueReward, lateChest, refreshMissions, rentFullIn, rentPerHour, rentWaiting, streakView } from "./logic/daily";
import { CHEST } from "./data/daily";
import { resolveLang, setLang, t, tn, translateDom } from "./i18n";
import { askForReview, backupSave, isNative, nativeReady, nativeShare, onAppHidden, onBackButton, readBackup, scheduleReminders, type ReminderInfo } from "./native";

type State = "menu" | "playing" | "paused" | "rescue" | "over";

const RESCUE_TIME = 5;
const NO_BOOSTS: ActiveBoosts = { rewind: false, xp: false, gold: false };

const floorTag = (kind: Exclude<FloorKind, "normal">): string =>
  kind === "gold" ? t("Gold penthouse · a perfect drop pays 5x")
  : kind === "ice" ? t("Icy floor · slides fast, holds 50% more people")
  : kind === "shrink" ? t("Shrinking floor · drop it early, it gets narrower")
  : kind === "magnet" ? t("🧲 Magnet floor · snaps into a perfect drop")
  : kind === "ghost" ? t("Foggy floor · fades in and out, holds 40% more")
  : t("Garden terrace · slow, and widens your tower");

const POWER_TAG: Record<PowerUp, () => string> = {
  slow: () => t("⏳ Land it: the next 4 floors slide slower"),
  wide: () => t("🎯 Land it: perfect drops are easier for 4 floors"),
  steady: () => t("🍃 Land it: no wind for 6 floors"),
};
const POWER_NAME: Record<PowerUp, () => string> = {
  slow: () => t("SLOW-MO"),
  wide: () => t("EASY PERFECTS"),
  steady: () => t("NO WIND"),
};

function openStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem("skyrise-probe");
    return s;
  } catch {
    return null;
  }
}

/** Where share links point: this site, unless it's an embedded preview with no public address. */
function siteUrl(): string {
  const { protocol, hostname, origin, pathname } = location;
  // The phone apps run from a local address that means nothing to anyone else.
  if (isNative()) return "";
  if (!/^https?:$/.test(protocol) || /(^|\.)claude\.ai$|claudeusercontent|anthropic/.test(hostname)) return "";
  return origin + pathname;
}

/** How long the landmark slow-motion lasts, in seconds. */
const SLOWMO = 0.9;

export class App implements DailyHost {
  save: SaveData;
  readonly sound: Sound;
  readonly online = new Online();
  readonly payments = choosePayments(() => this.sheets?.refreshShop());
  private readonly daily: DailySheets;
  private readonly storage = openStorage();
  private readonly canvas = $<HTMLCanvasElement>("game");
  private readonly renderer: Renderer | Renderer3D;
  private readonly sheets: Sheets;
  private sim!: TowerSim;
  private state: State = "menu";
  private mode: Mode = "classic";
  private challenge: Challenge | null = null;
  private boosts: ActiveBoosts = NO_BOOSTS;
  private tutorial: boolean;
  private rescueLeft = 0;
  private overTimer = 0;
  private overReady = false;
  private shareTimer = -1;
  private captureShare = false;
  private shareBlob: Blob | null = null;
  private outcome: RunOutcome | null = null;
  private opened: Feature[] = [];
  private friendScore = 0;
  private readonly site = siteUrl();
  private last = performance.now();
  private perf = { frames: 0, time: 0 };
  /** Resolution multiplier, lowered step by step if the device can't keep up. */
  private renderScale = 1;
  private hudBottom = 0;
  private installPrompt: (Event & { prompt(): Promise<void> }) | null = null;
  private bannerTimer = 0;
  private hint = "";
  /** The results card is hidden so the whole tower shows. */
  private peek = false;
  private timing: "" | "early" | "late" = "";
  /** The skin the current tower was built in. */
  private builtSkin = "";
  private builtShape = "";
  private slowmo = 0;
  /** The level-up celebration was shown for this tower. */
  private levelShown = false;
  private holidayNow: ReturnType<typeof holidayProgress> = null;
  private postcardsThisRun: PostcardGain[] = [];
  /** The day the current tower started (a Daily belongs to that day even past midnight). */
  private runDay = 0;
  /** The app is in the background or lost focus. */
  private away = false;
  private readonly calmMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private tag = "";
  /** The current tower's taps, for the online rankings. */
  private recorder: RunRecorder | null = null;
  /** Time not yet turned into fixed sim steps. */
  private stepTime = 0;

  constructor(logoSvg: string) {
    if (this.phone) document.documentElement.classList.add("phone");
    this.save = loadSave(this.storage);
    setLang(resolveLang(this.save.settings.lang));
    translateDom();
    refreshMissions(this.save);
    if (!this.save.playerId) this.save.playerId = newPlayerId();
    if (!isSkinUnlocked(this.save, skinById(this.save.skin))) this.save.skin = "glass";
    this.persist();
    this.tutorial = !this.save.tutorialDone;
    this.sound = new Sound(() => this.save.settings);
    // Real 3D on the graphics chip when the device can; the old 2D drawing otherwise.
    this.renderer = webglAvailable() && !new URLSearchParams(location.search).has("2d")
      ? new Renderer3D(this.canvas, $<HTMLCanvasElement>("fx"))
      : new Renderer(this.canvas, $<HTMLCanvasElement>("fx"));
    this.sheets = new Sheets(this);
    wireTabs();
    this.daily = new DailySheets(this);
    if (this.payments) {
      const test = !this.payments.live;
      this.payments.onPurchase = p => this.packBought(p, test);
      this.payments.onVip = on => {
        if (!setVip(this.save, on)) { this.persist(); return; }
        this.persist();
        if (on) { this.sound.purchase(); toast(t("👑 Skyrise VIP is on! Collect your daily gift in the Shop.")); }
        this.refresh();
        this.sheets?.refreshShop();
      };
    }
    void this.syncPurchases(purchaseReturn());
    // Leaderboards light up only where shared storage is available (the claude.ai page).
    this.online.blocked = new Set(this.save.blocked);
    void this.online.init(this.save.playerId).then(() => {
      this.refresh();
      // Towers built offline last time, and a first backup.
      void this.online.flush(this.save, () => this.persist());
      this.scheduleBackup(3000);
    });

    preloadLogo(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`);
    try { this.friendScore = clamp(parseInt(new URLSearchParams(location.search).get("beat") ?? "", 10) || 0, 0, 999999); } catch { /* no query */ }

    this.wire();
    this.resize();
    this.reset();
    this.renderMenu();
    // Keep rent, countdowns and the day rollover fresh while the menu is open.
    setInterval(() => this.tickMenu(), 20000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.tickMenu(); });
    requestAnimationFrame(t => this.frame(t));
    requestAnimationFrame(() => requestAnimationFrame(() => nativeReady()));
    void this.restoreBackup();
    onBackButton(() => this.back());
    onAppHidden(() => {
      void scheduleReminders(this.reminderInfo());
      this.scheduleBackup(0);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.scheduleBackup(0);
      else void this.online.flush(this.save, () => this.persist());
    });

    // Offline support on the website. Embedded copies and file:// skip it.
    if ("serviceWorker" in navigator && this.site && !isNative() && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  // ---------- Host (used by the sheets) ----------

  persist(): void {
    writeSave(this.storage, this.save);
    this.scheduleBackup();
    // The phone apps keep a second copy in native storage (a moment later, so a burst of
    // saves only writes once).
    if (isNative()) {
      clearTimeout(this.backupTimer);
      this.backupTimer = window.setTimeout(() => backupSave(JSON.stringify(this.save)), 800);
    }
  }

  private backupTimer = 0;

  /** If the phone cleared the web copy of the save, bring back the native backup. */
  private async restoreBackup(): Promise<void> {
    const json = await readBackup();
    if (!json) { if (isNative()) this.persist(); return; }
    try {
      const backup = JSON.parse(json) as { profile?: { towers?: number } };
      if ((backup.profile?.towers ?? 0) > this.save.profile.towers) {
        this.storage?.setItem(SAVE_KEY, json);
        location.reload();
      }
    } catch { /* a broken backup is ignored */ }
  }

  reminderInfo(): ReminderInfo {
    const v = streakView(this.save);
    const city = isOpen(this.save, "city"), left = rentFullIn(this.save), hp = holidayProgress(this.save);
    return {
      doneToday: v.doneToday, streak: v.count, rentFull: city && left <= 0,
      rentFullAt: city && left > 0 && this.save.rent.last ? Date.now() + left * 36e5 : undefined,
      holidayEnds: hp && !hp.done ? { at: Date.now() + holidayDaysLeft(hp.h) * 864e5, name: t(hp.h.name), skin: t(skinById(hp.h.skin).name) } : undefined,
    };
  }

  /** The Android back button: closes what's open, pauses, or steps back to the menu.
   *  Returns false on the main menu, where the app goes to the background. */
  private back(): boolean {
    if (!$("levelup").hidden) { $("levelup").hidden = true; return true; }
    const modal = openModalEl();
    if (modal) { if (modal.id === "settings") $("settings").querySelector<HTMLElement>(".close-btn")!.click(); else closeModal(modal); return true; }
    if (!$("rewards").hidden) { $("rewards").hidden = true; this.renderMenu(); return true; }
    if (this.peek) { this.setPeek(false); return true; }
    switch (this.state) {
      case "rescue": this.endFromRescue(); return true;
      case "paused": this.resume(); return true;
      case "playing": this.pause(); return true;
      case "over": if (this.overReady) this.goToMenu(); return true;
      default: return false;
    }
  }

  refresh(): void {
    if (this.state === "menu") this.renderMenu();
    else if (this.state === "over") this.renderCorners();
  }

  /** The language setting changed: redraws the page's text in the new language. */
  applyLang(): void {
    if (!setLang(resolveLang(this.save.settings.lang))) return;
    translateDom();
    this.sheets.rerenderOpen();
    this.daily.rerenderOpen();
    this.tag = "";
    this.hint = "";
    if (this.state === "playing" || this.state === "paused" || this.state === "rescue") { this.updateHud(false); this.updateHint(); }
    if (this.state === "paused") this.pauseText();
    if (this.state === "over" && this.overReady && !this.peek) this.showOver();
    this.refresh();
  }

  /** Buys a crystal pack with real money. */
  async buyPack(pack: CrystalPack): Promise<void> {
    const pay = this.payments;
    if (!pay) return;
    this.sound.ensure();
    const r = await pay.buy(pack, this.save.playerId);
    if (r === "error") toast(t("Couldn't open the checkout. Check your connection and try again."));
  }

  async buyVip(): Promise<void> {
    const pay = this.payments;
    if (!pay?.buyVip) return;
    this.sound.ensure();
    const r = await pay.buyVip();
    if (r === "error") toast(t("Couldn't open the checkout. Check your connection and try again."));
  }

  /** A pack purchase finished: add its crystals (once per transaction). */
  private packBought(p: PackPurchase, test: boolean): boolean {
    const added = grantPack(this.save, p.pack, p.tx);
    if (!added) return false;
    this.persist();
    this.sound.purchase();
    toast(test ? t("Test purchase: +{n} 💎 Sky Crystals. Nothing was charged.", { n: fmt(added) }) : t("+{n} 💎 Sky Crystals. Thanks for supporting Skyrise!", { n: fmt(added) }));
    this.refresh();
    this.sheets?.refreshShop();
    this.daily?.refreshPass();
    return true;
  }

  openCrystalShop(): void {
    this.sheets.openShop("crystals");
  }

  /** Spends crystals on a premium item. */
  buyItem(product: Product): void {
    const r = buyWithCrystals(this.save, product.id);
    if (r === "short") { toast(t("Not enough Sky Crystals")); this.sheets.openShop("crystals"); return; }
    if (r !== "ok") return;
    this.persist();
    this.sound.purchase();
    toast(t("Unlocked: {name}", { name: t(product.name) }));
    this.refresh();
  }

  /** Website purchases: asks the payment server for packs not yet counted. After a
   *  checkout, Stripe's confirmation can take a few seconds to arrive, so it checks a few times. */
  private async syncPurchases(returned: "success" | "cancelled" | null): Promise<void> {
    if (returned) {
      // Tidy the address so a reload doesn't repeat this.
      const u = new URL(location.href);
      u.searchParams.delete("purchase");
      history.replaceState(null, "", u.toString());
      if (returned === "cancelled") toast(t("Purchase cancelled. You weren't charged."));
      else toast(t("Thanks for supporting Skyrise! Adding your crystals…"));
    }
    const pay = this.payments;
    if (!pay?.purchases) return;
    for (let attempt = 0; attempt < (returned === "success" ? 5 : 1); attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 3000));
      const list = await pay.purchases(this.save.playerId);
      if (!list) continue;
      let any = false;
      for (const p of list) any = this.packBought(p, false) || any;
      if (any) return;
    }
  }

  postScores(): void {
    this.online.post(this.save, dayNumber(), streakView(this.save).count);
  }

  /** Sends the finished tower to the worldwide rankings and shows where it placed. */
  private async submitRun(): Promise<void> {
    const rec = this.recorder?.rec;
    if (!rec || this.online.kind !== "global") return;
    await this.online.submit(this.save, rec, () => this.persist());
    const r = this.online.lastRanks;
    if (!r || this.state !== "over" || this.recorder?.rec !== rec) return;
    const line = rec.mode === "daily" && r.daily ? t("🌍 #{n} worldwide on today's Daily", { n: fmt(r.daily) })
      : r.week ? t("🌍 Your best this week is #{n} worldwide", { n: fmt(r.week) }) : "";
    if (line) $("over-world").textContent = line;
    $("over-world").hidden = !line;
  }

  /** A new day brings new missions; the menu's numbers move with the clock. */
  private tickMenu(): void {
    if (refreshMissions(this.save)) this.persist();
    if (this.state === "menu") this.renderMenu();
  }

  startChallenge(id: string): void {
    this.start("challenge", id);
  }

  cloudCode(): string | null {
    return this.online.kind === "global" ? this.save.recoveryCode : null;
  }

  async restoreCloud(code: string): Promise<"ok" | "bad" | "offline" | "empty"> {
    const r = await this.online.restore(code);
    if (typeof r === "string") return r;
    let restored: SaveData = this.save;
    if (r.data) { try { restored = normalize(JSON.parse(r.data)); } catch { /* keep this device's save */ } }
    restored.playerId = r.player;
    restored.onlineToken = r.token;
    restored.recoveryCode = code;
    restored.pendingRuns = [];
    this.online.me = r.player;
    this.replaceSave(restored);
    return r.data ? "ok" : "empty";
  }

  /** Backs the save up to the server a little after it changes. */
  private cloudTimer = 0;
  private scheduleBackup(delay = 20000): void {
    if (this.online.kind !== "global") return;
    clearTimeout(this.cloudTimer);
    this.cloudTimer = window.setTimeout(() => void this.online.backup(this.save, () => writeSave(this.storage, this.save)), delay);
  }

  replaceSave(save: SaveData): void {
    this.save = save;
    refreshMissions(this.save);
    if (!isSkinUnlocked(this.save, skinById(this.save.skin))) this.save.skin = "glass";
    this.tutorial = !this.save.tutorialDone;
    this.persist();
    this.sound.applySettings();
    this.applyQuality();
    this.refresh();
  }

  applyQuality(): void {
    this.resize();
  }

  replayTips(): void {
    this.tutorial = true;
    this.save.tutorialDone = false;
    this.persist();
  }

  // ---------- Setup ----------

  private get low(): boolean {
    const q = this.save.settings;
    return q.quality === "low" || (q.quality === "auto" && q.autoLow);
  }

  /** Phones (and the phone apps) skip the shader pass in Auto: copying every frame into
   *  WebGL costs more there than it adds, and the screen looks sharper without it. */
  private readonly phone = isNative() || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
  /** Shaders turned off this session because the device couldn't keep up. */
  private autoNoShaders = false;

  private get shaders(): boolean {
    const q = this.save.settings;
    if (q.quality === "high") return true;
    if (q.quality === "low") return false;
    return !this.phone && !q.autoLow && !this.autoNoShaders;
  }

  private resize(): void {
    this.renderer.resize(this.low, this.renderScale);
    this.measureHud();
  }

  /** Where the score display ends, so popups stay below it. Read only when it changes. */
  private measureHud(): void {
    this.hudBottom = $("hud").hidden ? 0 : $("hud").getBoundingClientRect().bottom;
  }

  /** A fresh island with just the lobby, for the title screen. */
  private reset(): void {
    this.sim = new TowerSim({ mode: "classic", rng: Math.random, rewinds: 1 });
    this.sim.mover = null;
    this.renderer.fx.clear();
  }

  private wire(): void {
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!e.isPrimary) return; // a second finger on the screen isn't a new tap
      if (this.state === "playing") this.drop();
      else if (this.peek) this.setPeek(false);
      // Impatient? A tap brings the results card (and its Build again button) right away.
      else if (this.state === "over" && !this.overReady) this.overTimer = Math.min(this.overTimer, 0.12);
    });
    $("play").addEventListener("click", () => this.start("classic"));
    $("daily-btn").addEventListener("click", () => this.start("daily"));
    $("zen-btn").addEventListener("click", () => this.start("zen"));
    $("challenges-btn").addEventListener("click", () => this.sheets.openChallenges());
    $("missions-btn").addEventListener("click", () => this.daily.openMissions());
    $("city-btn").addEventListener("click", () => this.daily.openCity());
    $("ranks-btn").addEventListener("click", () => this.daily.openRanks());
    $("lu-ok").addEventListener("click", () => { $("levelup").hidden = true; this.sound.click(); });
    $("goals-btn").addEventListener("click", () => { this.sound.ensure(); this.sound.click(); openModal($("goals")); });
    wireModal($("goals"));
    // A goal row closes the Goals sheet first, then its own sheet opens.
    $("goals").querySelector(".goal-list")!.addEventListener("click", () => closeModal($("goals")), true);
    $("city-line").addEventListener("click", () => this.daily.openCity());
    $("pass-btn").addEventListener("click", () => this.daily.openPass());
    $("streak-btn").addEventListener("click", () => this.daily.openStreak());
    $("status-line").addEventListener("click", () => this.statusTap());
    $("collect-chip").addEventListener("click", () => this.collectAll());
    $("rewards-ok").addEventListener("click", () => { $("rewards").hidden = true; this.renderMenu(); });
    $("shop-btn").addEventListener("click", () => this.sheets.openShop());
    $("level-btn").addEventListener("click", () => this.sheets.openProfile());
    $("stars-btn").addEventListener("click", () => {
      if (isOpen(this.save, "shop")) { this.sheets.openShop(); return; }
      this.sound.ensure();
      this.sound.click();
      toast(t("You have {n} ★. The star shop opens after your 3rd tower.", { n: this.save.stars }));
    });
    $("settings-btn").addEventListener("click", () => this.sheets.openSettings());
    $("restore-link").addEventListener("click", () => {
      this.sheets.openSettings();
      $<HTMLDetailsElement>("cloud").open = true;
      $("restore-box").focus();
    });
    $("again").addEventListener("click", () => this.start(this.mode, this.challenge?.id));
    $("next-challenge").addEventListener("click", () => {
      const next = nextChallenge(this.save);
      if (next) this.start("challenge", next.id);
    });
    $("to-menu").addEventListener("click", () => this.goToMenu());
    $("peek").addEventListener("click", () => this.setPeek(true));
    $("unpeek").addEventListener("click", () => this.setPeek(false));
    $("share").addEventListener("click", () => void this.share());

    $("pause").addEventListener("click", () => { this.sound.ensure(); this.sound.click(); this.pause(); });
    $("resume").addEventListener("click", () => this.resume());
    $("finish-zen").addEventListener("click", () => { $("pause-menu").hidden = true; this.sound.duck(false); this.gameOver(true); });
    $("pause-menu-btn").addEventListener("click", () => this.goToMenu());
    $("pause-settings").addEventListener("click", () => this.sheets.openSettings());
    $("rewind").addEventListener("click", () => this.rewind());
    $("give-up").addEventListener("click", () => this.endFromRescue());

    // Leaving the app mid-tower pauses it.
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pause(); });
    window.addEventListener("blur", () => { this.away = true; this.pause(); });
    window.addEventListener("focus", () => { this.away = false; });
    document.addEventListener("pointerdown", () => { this.away = false; }, true);
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.away = true; else if (document.hasFocus()) this.away = false; });
    window.addEventListener("keydown", e => this.key(e));
    window.addEventListener("skyrise:sheet", () => this.sound.whoosh());
    this.renderer.weather.onThunder = () => this.sound.thunder();
    window.addEventListener("skyrise:tab", () => this.sound.click());

    // Offer to install the game as an app (Chrome and Android). The chip appears once the
    // player has built a few towers.
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      this.installPrompt = e as Event & { prompt(): Promise<void> };
      this.refresh();
    });
    $("install-chip").addEventListener("click", async () => {
      const ev = this.installPrompt;
      this.installPrompt = null;
      $("install-chip").hidden = true;
      if (ev) await ev.prompt().catch(() => {});
    });
  }

  private setPeek(on: boolean): void {
    if (this.state !== "over" && on) return;
    this.peek = on;
    this.sound.click();
    $("over").hidden = on;
    $("unpeek").hidden = !on;
    for (const id of ["settings-btn", "level-btn", "stars-btn", "streak-btn"]) if (on) $(id).hidden = true;
    if (!on && this.state === "over") { this.renderCorners(); $("over").hidden = false; }
  }

  private key(e: KeyboardEvent): void {
    const modal = openModalEl();
    if (modal) {
      if (e.code === "Escape") { if (modal.id === "settings") $("settings").querySelector<HTMLElement>(".close-btn")!.click(); else closeModal(modal); }
      return;
    }
    if (!$("rewards").hidden) { if (e.code === "Escape" || e.code === "Enter") { e.preventDefault(); $("rewards").hidden = true; this.renderMenu(); } return; }
    const go = e.code === "Space" || e.code === "Enter";
    // Let focused buttons handle Space and Enter themselves.
    if (go && e.target instanceof HTMLButtonElement) return;
    if (this.peek) { if (go || e.code === "Escape") { e.preventDefault(); this.setPeek(false); } return; }
    if (this.state === "rescue") {
      if (go) { e.preventDefault(); if (!e.repeat) this.rewind(); }
      if (e.code === "Escape") this.endFromRescue();
      return;
    }
    if (this.state === "paused") {
      if (e.code === "Escape" || e.code === "KeyP") this.resume();
      return;
    }
    if (this.state === "playing" && (e.code === "Escape" || e.code === "KeyP")) { this.pause(); return; }
    if (go) {
      e.preventDefault();
      if (e.repeat) return;
      if (this.state === "playing") this.drop();
      else if (this.state === "menu") this.start("classic");
      else if (this.state === "over" && this.overReady) this.start(this.mode, this.challenge?.id);
    }
    if (e.code === "Escape" && this.state === "over" && this.overReady) this.goToMenu();
    if ((this.state === "menu" || this.state === "over") && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
      this.cycleSkin(e.code === "ArrowLeft" ? -1 : 1);
    }
  }

  private cycleSkin(d: number): void {
    const open = SKINS.filter(s => isSkinUnlocked(this.save, s));
    const at = open.findIndex(s => s.id === this.save.skin);
    this.save.skin = open[(at + d + open.length) % open.length].id;
    this.persist();
    this.sound.ensure();
    this.sound.click();
    toast(t(skinById(this.save.skin).name));
    this.refresh();
  }

  // ---------- Starting and ending towers ----------

  private start(mode: Mode, challengeId?: string): void {
    this.slowmo = 0;
    this.levelShown = false;
    this.postcardsThisRun = [];
    this.runDay = dayNumber();
    this.sound.ensure();
    const challenge = mode === "challenge" ? challengeById(challengeId ?? "") ?? null : null;
    if (mode === "challenge" && (!challenge || !challengeOpen(this.save, challenge.id))) return;
    this.mode = mode;
    this.challenge = challenge;
    const event = mode === "classic" || mode === "daily" ? eventFor() : null;
    this.boosts = mode === "classic" ? takeBoosts(this.save) : NO_BOOSTS;
    this.persist();
    // Every tower has a seed and a log of taps, so the rankings server can replay it.
    const day = dayNumber();
    const seed = mode === "daily" ? dailySeed(day) : challenge ? challenge.seed : (Math.random() * 2 ** 31) | 0;
    this.recorder = new RunRecorder({
      mode, seed, day, week: weekIndex(), challenge: challenge?.id,
      boosts: { rewind: this.boosts.rewind, gold: this.boosts.gold },
    });
    this.sim = simFor(this.recorder.rec, (this.boosts.xp ? 2 : 1) * (event?.xp ?? 1));
    this.stepTime = 0;
    this.renderer.fx.clear();
    // Weather for this tower: snow on the snowy island, sometimes rain or snow elsewhere.
    const r = Math.random(), snowy = currentTheme(this.save).id === "snow";
    const hol = holidayAt();
    this.renderer.weather.set(snowy || hol?.weather === "snow" ? (r < 0.55 ? "snow" : "clear") : r < 0.16 ? "rain" : r < 0.22 ? "snow" : "clear");
    this.peek = false;
    $("unpeek").hidden = true;
    this.builtSkin = this.save.skin;
    this.builtShape = currentShape(this.save).id;
    this.outcome = null;
    this.shareBlob = null;
    this.state = "playing";
    for (const id of ["menu", "over", "rewards", "pause-menu", "rescue", "settings-btn", "level-btn", "stars-btn", "streak-btn", "banner"]) $(id).hidden = true;
    $("hud").hidden = false;
    $("pause").hidden = false;
    this.sound.duck(false);
    this.updateHud(false);
    this.updateHint();
    const used = BOOSTS.filter(b => this.boosts[b.id]).map(b => t(b.name));
    if (challenge) this.banner(t("Challenge"), t(challenge.text));
    else if (used.length) this.banner(t("Boosts on"), used.join(" · "));
    else if (mode === "daily") this.banner(t("Daily tower #{n}", { n: dayNumber() }), t("Same tower for everyone"));
  }

  private goToMenu(): void {
    // Quitting a tower mid-way earns nothing, so the boosts it took go back.
    if (this.state === "playing" || this.state === "paused" || this.state === "rescue") {
      const b = this.save.boosts, B = this.boosts, cap = (n: number) => Math.min(n, MAX_BOOSTS);
      if (B.xp) b.xp = cap(b.xp + 1);
      if (B.gold) b.gold = cap(b.gold + 1);
      if (B.rewind && this.sim.rewindsUsed < 2) b.rewind = cap(b.rewind + 1);
      this.boosts = NO_BOOSTS;
      this.persist();
    }
    this.sound.ensure();
    this.sound.click();
    this.sound.duck(false);
    for (const id of ["over", "hud", "pause", "pause-menu", "rescue", "unpeek", "powers"]) $(id).hidden = true;
    this.renderer.weather.set("clear");
    this.peek = false;
    this.mode = "classic";
    this.challenge = null;
    this.reset();
    this.state = "menu";
    this.renderMenu();
    $("menu").hidden = false;
  }

  private pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.sound.duck(true);
    $("finish-zen").hidden = this.mode !== "zen";
    this.pauseText();
    $("pause-menu").hidden = false;
    $("resume").focus();
  }

  private pauseText(): void {
    $("pause-sub").textContent = this.mode === "zen" ? t("Take your time.") : t("{people} people · {m} m so far", { people: fmt(this.sim.score), m: this.sim.meters });
  }

  private resume(): void {
    if (this.state !== "paused") return;
    $("pause-menu").hidden = true;
    this.sound.duck(false);
    this.state = "playing";
  }

  private offerRescue(): void {
    this.state = "rescue";
    this.rescueLeft = RESCUE_TIME;
    this.sound.fail();
    vibrate(this.save.settings.vibrate, [40, 40, 90]);
    this.renderer.fx.shake = 0.4;
    $("pause").hidden = true;
    const left = this.sim.rewindsLeft;
    $("rescue-sub").textContent = left > 1 ? t("You have {n} rewinds left in this tower.", { n: left }) : t("You have one rewind left in this tower.");
    $("rescue").hidden = false;
    $("rewind").focus();
  }

  private rewind(): void {
    if (this.state !== "rescue" || !this.sim.canRewind()) return;
    this.sim.rewind();
    this.recorder?.rewind();
    this.renderer.fx.debris = [];
    $("rescue").hidden = true;
    $("pause").hidden = false;
    this.state = "playing";
    this.sound.rewind();
    this.renderer.fx.popup(t("REWIND"), t("Try that floor again"), this.sim.stack.length + 1, "#8ce99a", 1.2);
    this.updateHud(false);
  }

  private endFromRescue(): void {
    if (this.state !== "rescue") return;
    $("rescue").hidden = true;
    this.gameOver(true);
  }

  private gameOver(silent: boolean): void {
    this.state = "over";
    this.overTimer = 0.55;
    this.overReady = false;
    this.sim.combo = 0;
    this.sim.mover = null;
    this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.6);
    for (const id of ["hud", "pause", "banner", "powers"]) $(id).hidden = true;
    this.sound.intensity = 0;
    const run = this.sim.summary();
    if (this.mode === "daily") run.day = this.runDay;
    const towersBefore = this.save.profile.towers;
    this.outcome = recordRun(this.save, run);
    if (this.mode !== "zen" && run.floors >= 3) {
      const won = holidayTower(this.save);
      const hp = holidayProgress(this.save);
      if (won) this.outcome.rewards.push({ kind: "skin", text: t("{emoji} Holiday skin unlocked: {name}!", { emoji: won.emoji, name: t(skinById(won.skin).name) }) });
      else if (hp && !hp.done) this.outcome.rewards.push({ kind: "star", text: t("{emoji} {name}: {n} of {total} towers", { emoji: hp.h.emoji, name: t(hp.h.name), n: hp.towers, total: hp.h.towers }) });
    }
    for (const c of this.postcardsThisRun) {
      this.outcome.rewards.push({ kind: "star", text: c.album ? t("Postcard album complete! +{n} 💎", { n: ALBUM_CRYSTALS })
        : c.set ? t("Postcard set complete! +{n} ★", { n: SET_STARS + POSTCARD_STARS }) : t("New postcard (+{n} ★)", { n: POSTCARD_STARS }) });
    }
    this.postcardsThisRun = [];
    // The tower's people move into the sky city for good, which can open new districts.
    const district = currentTheme(this.save), people = peopleFrom(run.score, this.mode === "zen");
    if (people > 0) {
      const opened = addPopulation(this.save, people);
      this.outcome.rewards.unshift({ kind: "island", text: t("🏙️ {n} people moved into {city}", { n: fmt(people), city: t(district.name) }) });
      for (const d of opened) this.outcome.rewards.unshift({ kind: "island", text: t("🎉 New district open: {name}! Build there from your City", { name: t(d.name) }) });
    }
    // Tall towers stand in their district for good.
    if ((this.mode === "classic" || this.mode === "daily") && addToSkyline(this.save, { f: run.floors, s: this.builtSkin || this.save.skin, h: this.builtShape || "square", d: district.id })) {
      this.outcome.rewards.push({ kind: "island", text: t("Your tower now stands in {name}", { name: t(district.name) }) });
    }
    this.opened = openedBetween(towersBefore, this.save.profile.towers);
    if (this.tutorial && run.floors >= 6) { this.tutorial = false; this.save.tutorialDone = true; }
    this.persist();
    this.postScores();
    $("over-world").hidden = true;
    void this.submitRun();
    void scheduleReminders(this.reminderInfo());
    if (run.challengeWon) this.sound.win();
    else if (!silent) { this.sound.fail(); vibrate(this.save.settings.vibrate, [40, 40, 90]); }
  }

  // ---------- Dropping floors ----------

  private debrisFrom(piece: TowerSim["stack"][number] & { axis: "x" | "z" }, side: -1 | 1, speed: number, life: number): Debris {
    const skin = skinById(this.save.skin);
    return {
      ...piece, color: floorColor(skin, piece.y, piece.kind), look: lookFor(skin, piece.kind),
      vy: 0, vside: side * speed, life, back: side < 0,
    };
  }

  private drop(): void {
    // Was the tap early or late? The floor was still heading toward its spot if it moves
    // toward zero offset.
    const m = this.sim.mover, off = this.sim.offset();
    // A floor that's still sliding in and hasn't reached the tower yet can only miss, so a
    // quick double tap right after a landing is ignored instead of throwing it away.
    if (m && Math.abs(off) >= (m.axis === "x" ? m.x1 - m.x0 : m.z1 - m.z0) && Math.sign(off) !== m.dir) return;
    this.timing = m && Math.abs(off) > 0.05 ? (Math.sign(off) === m.dir ? "late" : "early") : "";
    if (this.sim.mover) this.recorder?.drop(this.sim.ticks);
    const out = this.sim.drop();
    if (!out) return;
    const fx = this.renderer.fx;
    if (out.type === "miss") {
      fx.debris.push(this.debrisFrom(out.piece, out.side, 3, 1.4));
      if (this.mode === "zen") {
        this.sound.cut();
        fx.shake = 0.3;
        this.updateHud(false);
        return;
      }
      if (this.sim.canRewind()) this.offerRescue();
      else this.gameOver(false);
      return;
    }
    this.landed(out);
  }

  private landed(out: Extract<DropOutcome, { type: "land" }>): void {
    const fx = this.renderer.fx, f = out.floor, s = this.sound, vib = this.save.settings.vibrate;
    if (out.perfect) {
      fx.punch = Math.max(fx.punch, out.combo >= 5 ? 1 : 0.45);
      fx.flash = 1;
      fx.flashGold = f.kind === "gold";
      const view = this.renderer.view, [rx, ry] = view.project((f.x0 + f.x1) / 2, f.y + 1, (f.z0 + f.z1) / 2);
      fx.startRipple(rx / view.W, ry / view.H, f.kind === "gold" ? 1 : out.combo >= 5 ? 0.75 : 0.45);
      const gold = f.kind === "gold";
      fx.sparkle(f, gold ? 46 : 22, gold ? GOLD : f.kind === "ice" ? "#d8f4ff" : f.kind === "garden" ? "#b8f5a0" : "#ffffff");
      fx.popup(gold ? t("PENTHOUSE +{n}", { n: out.points }) : out.combo > 1 ? t("PERFECT x{n}", { n: out.combo }) : t("PERFECT"), gold ? "" : `+${out.points}`, f.y + 1, gold ? GOLD : "#ffffff");
      if (gold) { s.golden(); fx.whiteFlash = 0.35; } else s.perfect(out.combo);
      if (out.combo === 5 || out.combo === 10 || out.combo === 20) {
        fx.popup(out.combo >= 10 ? t("UNSTOPPABLE!") : t("ON FIRE!"), "", f.y + 2.2, "#ffb13b", 1.4, true);
        s.streak();
      }
      vibrate(vib, gold ? [20, 30, 20] : 20);
    } else {
      // New builders get told which way they missed, to learn the timing.
      const coach = this.save.profile.towers < 8 && this.timing ? (this.timing === "early" ? t("A bit early") : t("A bit late")) : "";
      fx.popup(`+${out.points}`, coach, f.y + 1, "#ffffff", coach ? 1 : 0.8);
      if (out.piece && out.side) {
        const d = this.debrisFrom(out.piece, out.side, 2.5, 1.2);
        fx.debris.push(d);
        fx.shatter(d, lookFor(skinById(this.save.skin), out.piece.kind).glass);
      }
      fx.shake = Math.max(fx.shake, 0.25);
      s.cut();
      vibrate(vib, 8);
    }
    if (f.kind === "ice") s.ice();
    if (f.kind === "garden") { s.garden(); fx.popup(t("TERRACE"), t("Your tower grew wider"), f.y + 2.1, "#b8f5a0", 1.2); }
    fx.dust(f);
    fx.bounce = 1;
    fx.punch = Math.max(fx.punch, 0.25);
    this.updateHud(true);
    if (out.power) {
      // Caught a power-up: a big label, a sparkle and a little fanfare.
      fx.popup(POWER_NAME[out.power](), t("{n} floors", { n: POWER_FLOORS[out.power] }), f.y + 3.2, "#7cf5ff", 1.3, true);
      fx.sparkle(f, 30, "#7cf5ff");
      setTimeout(() => this.sound.unlock(), 80);
    }
    if (out.landmark !== undefined) {
      if (!this.calmMotion) this.slowmo = SLOWMO;
      const card = this.mode === "zen" ? null : collectPostcard(this.save, out.landmark, this.renderer.weather.kind);
      this.banner(card?.fresh ? t("📮 New postcard!") : t("Landmark passed"), t("Taller than {name}!", { name: t(MILESTONES[out.landmark].name) }));
      if (card?.fresh) {
        this.postcardsThisRun.push(card);
        this.persist();
      }
      setTimeout(() => s.milestone(), 120);
    }
    if (out.windStarts) {
      this.banner(t("Wind ahead"), t("Gusts speed floors up and slow them down"));
      s.wind();
    }
    if (this.mode === "challenge" && this.sim.goalReached()) {
      this.sim.mover = null;
      this.gameOver(true);
      return;
    }
    this.updateHint();
  }

  // ---------- HUD ----------

  private updateHud(bump: boolean): void {
    const sim = this.sim, people = $("people");
    people.textContent = fmt(sim.score);
    if (bump) replay(people, "bump");
    const m = sim.meters;
    $("height").textContent = `${m} m`;
    const i = MILESTONES.findIndex(ms => ms.m >= m);
    if (i >= 0) {
      const prev = i > 0 ? MILESTONES[i - 1].m : 0;
      $("next").textContent = `${shortName(t(MILESTONES[i].name))} · ${MILESTONES[i].m} m`;
      $("bar").style.width = `${clamp((m - prev) / (MILESTONES[i].m - prev), 0, 1) * 100}%`;
    } else {
      $("next").textContent = t("Taller than every landmark");
      $("bar").style.width = "100%";
    }
    $("wind").hidden = !sim.mover || sim.windFor(sim.mover.y) <= 0;

    const goal = $("goal"), c = this.challenge;
    goal.hidden = !c;
    if (c) {
      const g = c.goal;
      const have = g.type === "height" ? m : g.type === "streak" ? sim.bestStreak : sim.penthouses;
      const label = g.type === "height" ? t("Goal: taller than <b>{n} m</b>", { n: g.n }) : g.type === "streak" ? t("Goal: perfect streak of <b>{n}</b>", { n: g.n }) : t("Goal: <b>{n}</b> perfect penthouses", { n: g.n });
      goal.innerHTML = `${label} · ${Math.min(have, g.type === "height" ? g.n + 1 : g.n)}${g.type === "height" ? " m" : ""}`;
    }

    this.measureHud();
    // Power-ups in effect, with the floors each has left.
    const pw = $("powers"), active = (["slow", "wide", "steady"] as const).filter(k => sim.powers[k] > 0);
    pw.hidden = !active.length || this.state !== "playing";
    if (active.length) pw.textContent = active.map(k => `${({ slow: "⏳", wide: "🎯", steady: "🍃" })[k]} ${sim.powers[k]}`).join("  ");
    const kind = sim.mover?.kind ?? "normal", power = sim.mover?.power;
    // A power-up gets the hint when the floor is otherwise ordinary.
    const tag = kind !== "normal" ? kind : power ? `power-${power}` : "";
    if (tag !== this.tag) {
      this.tag = tag;
      const el = $("floor-tag");
      el.hidden = !tag;
      if (tag) {
        el.className = power && kind === "normal" ? "power" : tag;
        el.textContent = kind !== "normal" ? floorTag(kind as Exclude<FloorKind, "normal">) : POWER_TAG[power!]();
        replay(el, tag);
      }
    }
  }

  /** The first towers explain how to play. */
  private updateHint(): void {
    let text = "";
    if (this.tutorial && this.state === "playing" && this.mode !== "zen") {
      const n = this.sim.stack.length;
      if (n <= 2) text = t("Tap when the sliding floor lines up with the one below");
      else if (n <= 4) text = t("Overhangs break off. Wider floors fit more people!");
      else if (n <= 6) text = t("Perfect drops add bonus people and keep floors wide");
    }
    if (text === this.hint) return;
    this.hint = text;
    $("hint").hidden = !text;
    $("hint").textContent = text;
  }

  private banner(eyebrow: string, title: string): void {
    $("banner-eyebrow").textContent = eyebrow;
    $("banner-title").textContent = title;
    const b = $("banner");
    b.hidden = false;
    replay(b, "show");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => { b.hidden = true; }, 2600);
  }

  // ---------- Title screen ----------

  private renderCorners(): void {
    const save = this.save, p = save.profile;
    $("settings-btn").hidden = false;
    const lv = $("level-btn");
    lv.hidden = !isOpen(save, "profile");
    $("level-num").textContent = String(p.level);
    $("level-ico").textContent = titleFor(p.level).icon;
    $("level-bar").style.width = `${p.xp / xpNeeded(p.level) * 100}%`;
    lv.querySelector<HTMLElement>(".new-dot")!.hidden = !isNew(save, "profile");
    const v = streakView(save), sb = $("streak-btn");
    sb.hidden = p.towers < 1;
    sb.classList.toggle("cold", v.count === 0 || (!v.doneToday && v.atRisk));
    $("streak-num").textContent = String(v.count);
    sb.querySelector<HTMLElement>(".new-dot")!.hidden = !v.atRisk;
    const st = $("stars-btn");
    st.hidden = save.starsEarned <= 0 && !isOpen(save, "shop");
    $("stars-num").textContent = String(save.stars);
    $("crystals-num").textContent = fmt(save.crystals);
    st.querySelector<HTMLElement>(".new-dot")!.hidden = true;
  }

  private renderMenu(): void {
    const save = this.save, p = save.profile, now = Date.now();
    this.renderCorners();
    $("rules").hidden = p.towers >= 3;
    $("menu").classList.toggle("returning", p.towers >= 1);
    const friend = $("menu-challenge");
    friend.innerHTML = t("A friend housed <b>{n}</b> people. Can you beat them?", { n: fmt(this.friendScore) });
    $("install-chip").hidden = !this.installPrompt || p.towers < 3;
    $("restore-link").hidden = p.towers > 0 || this.online.kind !== "global";
    const n = boostCount(save), note = $("boost-note");
    note.hidden = !n;
    note.textContent = t("⚡ {boosts} on your next tower", { boosts: BOOSTS.filter(b => save.boosts[b.id]).map(b => t(b.name)).join(" · ") });

    // One button collects everything that's waiting.
    const waiting = this.waitingRewards(now), cc = $("collect-chip");
    cc.hidden = !waiting.length;
    cc.textContent = waiting.length === 1 ? waiting[0] : t("🎁 Collect {n} rewards", { n: waiting.length });
    // One message above the play button at a time: rewards first, then a friend's challenge,
    // then the news line (renderStatus), then the install offer.
    friend.hidden = !this.friendScore || !cc.hidden;
    $("install-chip").hidden ||= !cc.hidden || !friend.hidden;

    // Modes and the dock show just an icon and a name; a dot marks something new or waiting.
    const show = (id: string, visible: boolean, dot: boolean) => {
      const b = $(id);
      b.hidden = !visible;
      b.querySelector<HTMLElement>(".dot")!.hidden = !dot;
    };
    const fresh = (f: Feature) => isNew(save, f);
    show("daily-btn", isOpen(save, "daily"), fresh("daily") || !(save.daily.day === dayNumber(now) && save.daily.plays > 0));
    show("challenges-btn", isOpen(save, "challenges"), fresh("challenges"));
    show("zen-btn", isOpen(save, "zen"), fresh("zen"));
    show("missions-btn", isOpen(save, "missions"), fresh("missions") || chestReady(save, now));
    show("city-btn", isOpen(save, "city"), fresh("city") || rentWaiting(save, now) >= rentPerHour(save) * 3);
    // Skins and the shop are one place now; it opens with the first skins.
    show("shop-btn", isOpen(save, "skins"), fresh("skins") || (isOpen(save, "shop") && fresh("shop")));
    refreshPass(save, now);
    if (carriedOver.length) {
      toast(tn(carriedOver.length, "Last season's reward was added: {names}", "Last season's rewards were added: {names}", { names: carriedOver.map(rewardText).join(", ") }));
      carriedOver.length = 0;
      this.persist();
    }
    if (lateChest.opened) {
      lateChest.opened = false;
      toast(t("Yesterday's chest opened for you: +{stars} ★", { stars: CHEST.stars }));
      this.persist();
    }
    show("pass-btn", isOpen(save, "pass"), fresh("pass") || unclaimed(save) > 0);
    show("ranks-btn", this.online.ready && p.towers >= 1, false);
    // Goals gathers missions, the pass and rankings; its dot means one of them has news.
    const goalIds = ["missions-btn", "pass-btn", "ranks-btn"];
    show("goals-btn", goalIds.some(id => !$(id).hidden), goalIds.some(id => !$(id).hidden && !$(id).querySelector<HTMLElement>(".dot")!.hidden));
    const done = save.missions.slots.filter(m => m.d).length;
    $("goal-missions").textContent = chestReady(save, now) ? t("Your chest is ready to open!") : t("{n} of 3 done today", { n: done });
    $("goal-pass").textContent = unclaimed(save) > 0 ? tn(unclaimed(save), "{n} reward to claim", "{n} rewards to claim") : t("Tier {n} of 30", { n: passTier(save) });
    // The sky city: the reason every tower matters.
    const cl = $("city-line");
    cl.hidden = p.towers < 1;
    cl.innerHTML = t("🏙️ {city} · <b>{n}</b> people", { city: esc(t(CITY_NAME)), n: fmt(save.population) });
    $("daily-title").textContent = t("Daily #{n}", { n: dayNumber(now) });
    $("modes").hidden = [...$("modes").children].every(c => (c as HTMLElement).hidden);
    $("dock").hidden = [...$("dock").children].every(c => (c as HTMLElement).hidden);
    void this.renderStatus(now);
  }

  /** The level-up celebration: badge, new title, rewards, and what's next. */
  private showLevelUp(lu: { from: number; to: number; stars: number; crystals: number }): void {
    const ti = titleFor(lu.to), newTitle = ti.min > lu.from;
    const el = $("levelup");
    el.style.setProperty("--tier", ti.color);
    $("lu-badge").textContent = ti.icon;
    $("lu-level").textContent = String(lu.to);
    $("lu-title").textContent = t(ti.name);
    $("lu-new").hidden = !newTitle;
    $("lu-rewards").innerHTML = [`+${lu.stars} ★`, lu.crystals ? `+${lu.crystals} 💎` : ""].filter(Boolean).map(x => `<span>${x}</span>`).join("");
    const next = upcoming(lu.to, SHAPES.map(sh => ({ name: sh.name, level: sh.unlock && "level" in sh.unlock ? sh.unlock.level : undefined })));
    $("lu-next").innerHTML = next.length ? `<b>${esc(t("Coming up"))}</b>` + next.map(n => `<div><i>${esc(t("Lv {n}", { n: n.level }))}</i><span>${n.icon} ${esc(t(n.text))}</span></div>`).join("") : "";
    // Confetti in the title's color and friends.
    const box = $("lu-confetti"), colors = [ti.color, "#ff6f9c", "#ffe08a", "#7cf5ff", "#a98bff", "#8ce99a"];
    box.innerHTML = Array.from({ length: this.calmMotion ? 0 : 60 }, (_, i) =>
      `<span style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-duration:${2.2 + (i % 7) * 0.35}s;animation-delay:${(i % 10) * 0.08}s"></span>`).join("");
    el.hidden = false;
    this.sound.unlock();
    setTimeout(() => this.sound.purchase(), 250);
    vibrate(this.save.settings.vibrate, [30, 40, 60]);
    $("lu-ok").focus();
  }

  /** Labels for everything ready to collect: the daily gift, rent, the chest, the league reward. */
  private waitingRewards(now: number): string[] {
    const save = this.save, out: string[] = [];
    if (save.profile.towers >= 1 && giftState(save.profile.gift).ready) out.push(t("🎁 Open your daily gift"));
    const rent = isOpen(save, "city") ? rentWaiting(save, now) : 0;
    if (rent >= 1) out.push(t("🏦 Collect {n} ★ of rent", { n: fmt(rent) }));
    if (chestReady(save, now)) out.push(t("🧰 Open today's chest"));
    const lr = pendingLeagueReward(save, now);
    if (lr) out.push(t("🏆 Claim your {league} league reward", { league: t(lr.league) }));
    return out;
  }

  /** Collects everything at once and shows what came in. */
  private collectAll(): void {
    this.sound.ensure();
    const save = this.save, lines: string[] = [];
    const gift = this.sheets.claimGift();
    if (gift) {
      lines.push(t("🎁 Day {day} gift · +{n} ★", { day: gift.day, n: gift.stars }));
      for (const name of gift.trophies) lines.push(t("🏅 Trophy: {name} · +1 ★", { name }));
    }
    $("gift-track").hidden = !gift;
    if (isOpen(save, "city")) {
      const r = collectRent(save);
      if (r) lines.push(t("🏦 Rent · +{n} ★", { n: fmt(r) }));
    }
    const c = claimChest(save);
    if (c) lines.push(t("🧰 Mission chest · +{stars} ★ · +100 pass XP", { stars: c.stars }));
    const lr = claimLeagueReward(save);
    if (lr) lines.push(t("🏆 {league} league · +{n} ★", { league: t(lr.league), n: lr.stars }));
    this.persist();
    if (lines.length) {
      const list = $("reward-lines");
      list.replaceChildren(...lines.map((text, i) => {
        const el = document.createElement("div");
        el.className = "reward-line";
        el.style.animationDelay = `${0.08 * i}s`;
        el.textContent = text;
        return el;
      }));
      $("rewards").hidden = false;
      $("rewards-ok").focus();
      this.sound.unlock();
      this.sound.coins();
      vibrate(save.settings.vibrate, [15, 30, 15]);
    }
    this.renderMenu();
  }

  /** One line of news above the play button: a streak at risk, a rival, or the week's event. */
  private statusToken = 0;
  private async renderStatus(now: number): Promise<void> {
    const el = $("status-line"), save = this.save, token = ++this.statusToken;
    const sv = streakView(save, now);
    let text = "", kind = "";
    if (save.profile.towers >= 1 && sv.atRisk) {
      kind = "risk";
      text = sv.needsFreeze ? t("🧊 Build today: a freeze will save your {n}-day streak", { n: sv.count }) : t("🔥 Build today to keep your {n}-day streak", { n: sv.count });
    } else if (save.profile.towers >= 1 && (this.holidayNow = holidayProgress(save, now)) && !this.holidayNow.done) {
      const hp = this.holidayNow;
      kind = "holiday";
      text = t("{emoji} {name}: {left} towers to a holiday skin", { emoji: hp.h.emoji, name: t(hp.h.name), left: hp.h.towers - hp.towers });
    } else {
      const r = this.online.ready && save.profile.towers >= 1 ? this.online.rival(dayNumber(now), weekIndex(now)) : null;
      if (r) {
        const who = displayName(this.online.kind === "friends" ? (await this.online.names([r.id]))[r.id] : r.name);
        if (token !== this.statusToken) return;
        kind = "rival";
        text = r.rank === 0 ? t("🏁 {who} leads today's Daily. Your turn!", { who }) : t("⚔️ #{rank} of {of} today · {who} is {gap} ahead", { rank: r.rank, of: r.of, who, gap: fmt(r.gap) });
      } else if (isOpen(save, "daily")) {
        kind = "event";
        // Short enough for one line on small phones; tapping it explains the event.
        text = t("✨ This week: {name} · tap to see", { name: t(eventFor(now).name) });
      }
    }
    el.dataset.kind = kind;
    el.hidden = !text || !$("collect-chip").hidden || !$("menu-challenge").hidden;
    if (!el.hidden) $("install-chip").hidden = true;
    el.textContent = text;
  }

  private statusTap(): void {
    const kind = $("status-line").dataset.kind;
    if (kind === "risk") this.daily.openStreak();
    else if (kind === "rival") this.daily.openRanks();
    else if (kind === "holiday" && this.holidayNow) {
      const hp = this.holidayNow;
      toast(t("{emoji} {name} is on for {days} more days. Build {total} towers to keep the {skin} skin for good.", { emoji: hp.h.emoji, name: t(hp.h.name), days: holidayDaysLeft(hp.h), total: hp.h.towers, skin: t(skinById(hp.h.skin).name) }));
    }
    else if (kind === "event") {
      this.sound.ensure();
      this.sound.click();
      toast(t("{name}: {text}. {time} left, in Classic and Daily towers.", { name: t(eventFor().name), text: t(eventFor().text), time: duration(eventEndsIn()) }));
    }
  }

  /** " · #2 of 5 today" once the leaderboard has this tower. */
  private dailyRank(): string {
    const p = this.online.ready ? this.online.dailyPlace(this.runDay, this.save.daily.best) : null;
    return p && p.of > 1 ? t(" · #{rank} of {of} today", { rank: fmt(p.rank), of: fmt(p.of) }) : "";
  }

  // ---------- Game over ----------

  private showOver(): void {
    const save = this.save, sim = this.sim, o = this.outcome!;
    const c = this.challenge, mode = this.mode;
    const won = !!c && sim.goalReached();
    const eyebrow = $("over-eyebrow");
    eyebrow.textContent = c ? (won ? t("Challenge complete!") : t("Challenge failed"))
      : mode === "zen" ? t("Zen tower") : mode === "daily" ? t("Daily tower #{n}", { n: this.runDay }) : o.newBest ? t("New best!") : t("Tower complete");
    eyebrow.classList.toggle("best", (o.newBest && mode !== "zen") || won);
    if (o.levelUp && !this.peek && !this.levelShown) { this.levelShown = true; setTimeout(() => this.showLevelUp(o.levelUp!), 700); }
    // A new best is a happy moment: a good time to ask for a store rating.
    if (o.newBest && mode === "classic" && !this.peek) setTimeout(() => askForReview(save.profile.towers), 1800);
    $("over-people").textContent = fmt(sim.score);
    $("over-sub").textContent = t("people live in your {m} m tower", { m: sim.meters });
    $("over-landmark").textContent = c ? t(c.text)
      : mode === "daily" ? t("Today's best: {n} people", { n: fmt(o.dailyBest) }) + (o.newBest ? t(" · New all-time best!") : "") + this.dailyRank()
      : sim.lastLandmark >= 0 ? t("Taller than {name}", { name: t(MILESTONES[sim.lastLandmark].name) })
      : mode === "zen" ? t("Zen towers don't count toward bests") : t("Best: {n} people", { n: fmt(save.best) });
    $("stat-floors").textContent = String(sim.level);
    $("stat-perfect").textContent = String(sim.perfects);
    $("stat-streak").textContent = String(sim.bestStreak);

    const rewards = $("over-rewards");
    rewards.innerHTML = "";
    const lines = this.rewardLines(o);
    for (const l of lines) {
      const el = document.createElement("div");
      el.className = l.cls;
      el.textContent = l.text;
      rewards.appendChild(el);
    }
    // A new skin is offered, not forced: switching would repaint the tower you just built.
    const fresh = o.newSkin ? skinById(o.newSkin) : null;
    if (fresh && save.skin !== fresh.id) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-secondary try-skin";
      b.innerHTML = `<span class="swatch">${swatchHtml(fresh.swatch ?? fresh.floors)}</span> ${esc(t("Use {name} next time", { name: t(fresh.name) }))}`;
      b.addEventListener("click", () => {
        save.skin = fresh.id;
        this.persist();
        this.sound.click();
        b.disabled = true;
        b.textContent = t("{name} is on for your next tower", { name: t(fresh.name) });
      });
      rewards.appendChild(b);
    }
    rewards.hidden = !lines.length;

    const near = $("over-near");
    near.hidden = !o.near || !!c;
    near.textContent = o.near;
    $("xp-level").textContent = t("Builder level {n}", { n: o.xp.level });
    $("xp-gain").textContent = `+${o.xp.gained} XP${sim.cfg.xpMultiplier && sim.cfg.xpMultiplier > 1 ? ` (x${sim.cfg.xpMultiplier})` : ""}`;
    const bar = $("xp-bar");
    bar.style.transition = "none";
    bar.style.width = `${o.xp.startPct * 100}%`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = "";
      bar.style.width = `${o.xp.endPct * 100}%`;
    }));

    const versus = $("over-versus");
    versus.hidden = !this.friendScore || mode === "zen" || !!c;
    if (!versus.hidden) {
      const beat = sim.score > this.friendScore;
      versus.classList.toggle("won", beat);
      versus.textContent = beat
        ? t("You beat your friend's {n} people!", { n: fmt(this.friendScore) })
        : t("Your friend's tower: {n} people. {more} more to win.", { n: fmt(this.friendScore), more: fmt(this.friendScore - sim.score + 1) });
    }
    const next = won ? nextChallenge(save) : undefined;
    const again = $("again"), nb = $("next-challenge");
    again.textContent = c ? t("Try again") : t("Build again");
    // After a won challenge the next one is the main action.
    again.className = `btn ${next ? "btn-secondary" : "btn-primary"}`;
    nb.className = `btn ${next ? "btn-primary" : "btn-secondary"} wide`;
    nb.hidden = !next;
    if (next) nb.textContent = t("Next challenge: {name}", { name: t(next.name) });
    $("share").hidden = mode === "challenge";
    $("over-actions").classList.toggle("single", mode === "challenge");
    this.renderCorners();
    $("over").hidden = false;
  }

  /** Groups the outcome into a few short lines so the card stays compact on phones. */
  private rewardLines(o: RunOutcome): { cls: string; text: string }[] {
    const lines: { cls: string; text: string }[] = [];
    const missions = o.rewards.filter(r => r.group === "mission");
    const trophies = o.rewards.filter(r => r.group === "trophy");
    for (const r of o.rewards) {
      if (missions.includes(r) || trophies.includes(r)) continue;
      lines.push({ cls: r.kind === "star" ? "reward star" : r.kind === "pass" ? "reward new" : "reward", text: r.text });
    }
    if (missions.length === 1) lines.push({ cls: "reward star", text: missions[0].text });
    if (missions.length > 1) {
      lines.push({ cls: "reward star", text: t("{n} missions complete (+{stars} ★)", { n: missions.length, stars: missions.reduce((n, r) => n + (r.stars ?? 0), 0) }) });
    }
    if (trophies.length) {
      const names = trophies.map(r => r.name ?? "").join(", ");
      lines.push({ cls: "reward star", text: tn(trophies.length, "Trophy: {names} (+{n} ★)", "Trophies: {names} (+{n} ★)", { names }) });
    }
    if (this.opened.length) {
      lines.push({ cls: "reward new", text: t("Now on the main menu: {list}", { list: this.opened.map(f => t(FEATURE_NAMES[f])).join(", ") }) });
    }
    return lines;
  }

  private shareText(): string {
    const sim = this.sim;
    const ms = sim.lastLandmark >= 0 ? t(", taller than {name}", { name: t(MILESTONES[sim.lastLandmark].name) }) : "";
    if (this.mode === "daily") return t("Skyrise Daily #{day}: {n} people in a {m} m tower{landmark}. Can you beat it today?", { day: this.runDay, n: fmt(sim.score), m: sim.meters, landmark: ms });
    return t("My Skyrise tower is {m} m tall{landmark}, with {n} people living in it. Can you build a bigger one?", { m: sim.meters, landmark: ms, n: fmt(sim.score) });
  }

  private async share(): Promise<void> {
    const sim = this.sim;
    // Zen towers aren't a fair target, so their links carry no score to beat.
    const url = this.site ? (this.mode === "zen" ? this.site : `${this.site}?beat=${sim.score}`) : "";
    const text = this.shareText();
    const full = url ? `${text} ${url}` : text;
    if (await nativeShare(full, this.shareBlob)) return;
    try {
      if (this.shareBlob && navigator.canShare) {
        const file = new File([this.shareBlob], "skyrise.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: full });
          return;
        }
      }
      if (navigator.share) { await navigator.share(url ? { title: "Skyrise", text, url } : { title: "Skyrise", text }); return; }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // the share sheet was closed
    }
    try {
      await navigator.clipboard.writeText(full);
      toast(t("Copied! Paste it to a friend"));
    } catch {
      toast(full);
    }
  }

  // ---------- Frame loop ----------

  private frame(now: number): void {
    const raw = (now - this.last) / 1000;
    let dt = Math.min(0.05, Math.max(0, raw));
    this.last = now;
    // Passing a landmark slows the world for a moment, then eases back to full speed.
    if (this.slowmo > 0) {
      this.slowmo = Math.max(0, this.slowmo - dt);
      dt *= 0.3 + 0.7 * (1 - this.slowmo / SLOWMO) ** 2;
    }
    // Auto graphics: if a tower plays below about 50 fps, drop the costly extras one step
    // at a time: shaders, then smooth mode (fewer details), and only as a last resort a
    // slightly lower resolution, so the picture stays sharp.
    const st = this.save.settings;
    if (this.state === "playing" && st.quality === "auto" && raw < 0.5) {
      this.perf.frames++;
      this.perf.time += raw;
      if (this.perf.time > 3) {
        const fps = this.perf.frames / this.perf.time;
        if (fps < 50 && this.shaders) {
          this.autoNoShaders = true;
        } else if (fps < 50 && !st.autoLow) {
          st.autoLow = true;
          this.persist();
          this.resize();
        } else if (fps < 40 && this.renderScale > 0.8) {
          this.renderScale = 0.8;
          this.resize();
        }
        this.perf.frames = 0;
        this.perf.time = 0;
      }
    }
    this.update(dt);
    this.draw(dt);
    requestAnimationFrame(t => this.frame(t));
  }

  private update(dt: number): void {
    const sim = this.sim;
    if (this.state === "playing") {
      // Fixed steps, so the same taps always build the same tower.
      this.stepTime = Math.min(this.stepTime + dt, 0.25);
      while (this.stepTime >= TICK) { sim.step(); this.stepTime -= TICK; }
      const m = sim.mover;
      // The wind meter shows the gust half a second ahead, so you can see it coming.
      if (m && sim.windFor(m.y) > 0) {
        const ahead = sim.gustAt(m, sim.time + 0.5);
        $("gust").style.transform = `scaleX(${clamp((ahead - 0.45) / 1.1, 0.05, 1).toFixed(3)})`;
        const strong = ahead > 1.25;
        $("wind").classList.toggle("strong", strong);
        const label = strong ? t("Gust coming") : ahead < 0.75 ? t("Calm") : t("Wind");
        if ($("wind-label").textContent !== label) $("wind-label").textContent = label;
      }
    }
    // The "rewind?" countdown waits while you're away (notification shade, a call).
    if (this.state === "rescue" && !this.away) {
      this.rescueLeft -= dt;
      $("countdown").style.transform = `scaleX(${clamp(this.rescueLeft / RESCUE_TIME, 0, 1)})`;
      if (this.rescueLeft <= 0) this.endFromRescue();
    }
    const active = this.state === "playing" || this.state === "paused" || this.state === "rescue";
    this.sound.intensity = active ? 1 + (sim.level >= 12 ? 1 : 0) + (sim.combo >= 5 ? 1 : 0) : 0;
    // Ambience follows the camera: city and birds near the ground, wind higher up.
    const lvl = this.state === "over" || this.state === "menu" ? 0 : sim.level;
    this.sound.ambience(clamp(lvl / 60, 0, 1), nightAt(sim.stack.length), sim.mover ? sim.windFor(sim.mover.y) : 0, active);

    const shot: Shot = this.state === "menu" ? "menu" : this.state === "over" ? "over" : "play";
    this.renderer.camera(dt, shot, sim.level, this.peek);

    if (this.state === "over" && !this.overReady) {
      this.overTimer -= dt;
      if (this.overTimer <= 0) {
        this.overReady = true;
        this.renderer.fx.debris = []; // keep the fallen floor out of the share picture
        this.showOver();
        this.shareTimer = 1.2;
      }
    }
    if (this.shareTimer > 0) {
      this.shareTimer -= dt;
      // Captured right after the next frame is drawn, while the shader output is still there.
      if (this.shareTimer <= 0 && this.state === "over") this.captureShare = true;
    }
    this.renderer.fx.update(dt);
  }

  private draw(dt: number): void {
    const save = this.save;
    this.renderer.draw(dt, {
      sim: this.sim,
      shot: this.state === "menu" ? "menu" : this.state === "over" ? "over" : "play",
      showMover: this.state === "playing" || this.state === "paused",
      // A finished tower keeps the skin it was built in.
      skin: skinById(this.state === "over" && this.builtSkin ? this.builtSkin : save.skin),
      skyline: districtTowers(save, currentTheme(save).id),
      districts: DISTRICTS.filter(d => d.id !== currentTheme(save).id && districtTowers(save, d.id).length)
        .map(d => ({ theme: d, towers: districtTowers(save, d.id) })),
      tint: holidayAt()?.tint ?? null,
      shape: this.state === "over" && this.builtShape ? shapeById(this.builtShape) : currentShape(save),
      theme: currentTheme(save),
      islandLevel: islandLevel(save),
      guide: this.tutorial && this.mode !== "zen" && this.sim.stack.length <= 4,
      low: this.low,
      shaders: this.shaders,
      bestFloors: this.mode === "zen" ? 0 : Math.round(this.save.bestMeters / 5),
      city: save.city,
      hudBottom: this.state === "playing" || this.state === "paused" ? this.hudBottom : 0,
    });
    if (this.captureShare) {
      this.captureShare = false;
      const sim = this.sim, tag = this.mode === "daily" ? t("Daily #{n}", { n: this.runDay }) : "", forSim = sim;
      void makeShareImage(this.renderer.output, this.renderer.view, {
        score: sim.score, meters: sim.meters, floors: sim.level, landmark: sim.lastLandmark, tag,
      }).then(b => { if (this.sim === forSim) this.shareBlob = b; }); // not if a new tower started meanwhile
    }
  }
}

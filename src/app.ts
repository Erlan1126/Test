// The game controller: screens, input, the frame loop, and turning drops into effects.
import { seeded } from "./core/rng";
import { clamp, fmt, shortName } from "./core/util";
import { challengeById, type Challenge } from "./data/challenges";
import { GOLD, MILESTONES } from "./data/constants";
import { eventEndsIn, eventFor } from "./data/events";
import { ISLAND_UPGRADES } from "./data/islands";
import { BOOSTS } from "./data/shop";
import { skinById, SKINS } from "./data/skins";
import { FEATURE_NAMES, isNew, isOpen, openedBetween, type Feature } from "./logic/features";
import { challengeOpen, currentTheme, dealMissions, isSkinUnlocked, islandLevel, nextChallenge, recordRun, unlockedSkinCount, type RunOutcome } from "./logic/progress";
import { dailyEndsIn, dailySeed, dayNumber, duration, giftState, xpNeeded } from "./logic/rules";
import { loadSave, writeSave, type SaveData } from "./logic/save";
import { boostCount, takeBoosts, type ActiveBoosts } from "./logic/shop";
import { TowerSim, type DropOutcome, type FloorKind } from "./logic/sim";
import type { Mode } from "./logic/types";
import { floorColor, lookFor } from "./render/buildings";
import type { Debris } from "./render/effects";
import { makeShareImage, preloadLogo } from "./render/previews";
import { Renderer, type Shot } from "./render/renderer";
import { Sound } from "./sound";
import { $, closeModal, esc, openModalEl, replay, swatchHtml, toast, vibrate } from "./ui/dom";
import { Sheets, type Host } from "./ui/sheets";

type State = "menu" | "playing" | "paused" | "rescue" | "over";

const RESCUE_TIME = 5;
const NO_BOOSTS: ActiveBoosts = { rewind: false, xp: false, gold: false };

const FLOOR_TAGS: Record<Exclude<FloorKind, "normal">, string> = {
  gold: "Gold penthouse · a perfect drop pays 5x",
  ice: "Icy floor · slides fast, holds 50% more people",
  garden: "Garden terrace · slow, and widens your tower",
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
  if (!/^https?:$/.test(protocol) || /(^|\.)claude\.ai$|claudeusercontent|anthropic/.test(hostname)) return "";
  return origin + pathname;
}

export class App implements Host {
  save: SaveData;
  readonly sound: Sound;
  private readonly storage = openStorage();
  private readonly canvas = $<HTMLCanvasElement>("game");
  private readonly renderer: Renderer;
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
  private tag = "";

  constructor(logoSvg: string) {
    this.save = loadSave(this.storage);
    if (!this.save.missions.slots.length) dealMissions(this.save);
    if (!isSkinUnlocked(this.save, skinById(this.save.skin))) this.save.skin = "glass";
    this.persist();
    this.tutorial = !this.save.tutorialDone;
    this.sound = new Sound(() => this.save.settings);
    this.renderer = new Renderer(this.canvas, $<HTMLCanvasElement>("fx"));
    this.sheets = new Sheets(this);

    preloadLogo(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`);
    try { this.friendScore = clamp(parseInt(new URLSearchParams(location.search).get("beat") ?? "", 10) || 0, 0, 999999); } catch { /* no query */ }

    this.wire();
    this.resize();
    this.reset();
    this.renderMenu();
    setTimeout(() => { if (this.state === "menu") this.sheets.maybeOfferGift(); }, 600);
    requestAnimationFrame(t => this.frame(t));

    // Offline support on the website. Embedded copies and file:// skip it.
    if ("serviceWorker" in navigator && this.site && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  // ---------- Host (used by the sheets) ----------

  persist(): void {
    writeSave(this.storage, this.save);
  }

  refresh(): void {
    if (this.state === "menu") this.renderMenu();
    else if (this.state === "over") this.renderCorners();
  }

  startChallenge(id: string): void {
    this.start("challenge", id);
  }

  replaceSave(save: SaveData): void {
    this.save = save;
    if (!this.save.missions.slots.length) dealMissions(this.save);
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
      if (this.state === "playing") this.drop();
      else if (this.peek) this.setPeek(false);
    });
    $("play").addEventListener("click", () => this.start("classic"));
    $("daily-btn").addEventListener("click", () => this.start("daily"));
    $("zen-btn").addEventListener("click", () => this.start("zen"));
    $("challenges-btn").addEventListener("click", () => this.sheets.openChallenges());
    $("skins-btn").addEventListener("click", () => this.sheets.openSkins());
    $("missions-btn").addEventListener("click", () => this.sheets.openMissions());
    $("shop-btn").addEventListener("click", () => this.sheets.openShop());
    $("level-btn").addEventListener("click", () => this.sheets.openProfile());
    $("stars-btn").addEventListener("click", () => {
      if (isOpen(this.save, "shop")) { this.sheets.openShop(); return; }
      this.sound.ensure();
      this.sound.click();
      toast(`You have ${this.save.stars} ★. The star shop opens after your ${this.ordinal(3)} tower.`);
    });
    $("settings-btn").addEventListener("click", () => this.sheets.openSettings());
    $("gift-chip").addEventListener("click", () => { this.sound.ensure(); this.sound.click(); this.sheets.openGift(); });
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
    window.addEventListener("blur", () => this.pause());
    window.addEventListener("keydown", e => this.key(e));

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
    for (const id of ["settings-btn", "level-btn", "stars-btn"]) if (on) $(id).hidden = true;
    if (!on && this.state === "over") { this.renderCorners(); $("over").hidden = false; }
  }

  private ordinal(n: number): string {
    return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  }

  private key(e: KeyboardEvent): void {
    const modal = openModalEl();
    if (modal) {
      if (e.code === "Escape") { if (modal.id === "settings") $("settings").querySelector<HTMLElement>(".close-btn")!.click(); else closeModal(modal); }
      return;
    }
    if (!$("gift").hidden) { if (e.code === "Escape") { $("gift").hidden = true; this.renderMenu(); } return; }
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
    toast(skinById(this.save.skin).name);
    this.refresh();
  }

  // ---------- Starting and ending towers ----------

  private start(mode: Mode, challengeId?: string): void {
    this.sound.ensure();
    const challenge = mode === "challenge" ? challengeById(challengeId ?? "") ?? null : null;
    if (mode === "challenge" && (!challenge || !challengeOpen(this.save, challenge.id))) return;
    this.mode = mode;
    this.challenge = challenge;
    const event = mode === "classic" || mode === "daily" ? eventFor() : null;
    this.boosts = mode === "classic" ? takeBoosts(this.save) : NO_BOOSTS;
    this.persist();
    const rng = mode === "daily" ? seeded(dailySeed(dayNumber())) : challenge ? seeded(challenge.seed) : Math.random;
    this.sim = new TowerSim({
      mode, rng, event, challenge,
      rewinds: 1 + (this.boosts.rewind ? 1 : 0),
      goldBoost: this.boosts.gold,
      xpMultiplier: (this.boosts.xp ? 2 : 1) * (event?.xp ?? 1),
    });
    this.renderer.fx.clear();
    this.peek = false;
    $("unpeek").hidden = true;
    this.builtSkin = this.save.skin;
    this.outcome = null;
    this.shareBlob = null;
    this.state = "playing";
    for (const id of ["menu", "over", "gift", "pause-menu", "rescue", "settings-btn", "level-btn", "stars-btn", "banner"]) $(id).hidden = true;
    $("hud").hidden = false;
    $("pause").hidden = false;
    this.sound.duck(false);
    this.updateHud(false);
    this.updateHint();
    const used = BOOSTS.filter(b => this.boosts[b.id]).map(b => b.name);
    if (challenge) this.banner("Challenge", challenge.text);
    else if (used.length) this.banner("Boosts on", used.join(" · "));
    else if (mode === "daily") this.banner(`Daily tower #${dayNumber()}`, "Same tower for everyone");
  }

  private goToMenu(): void {
    this.sound.ensure();
    this.sound.click();
    this.sound.duck(false);
    for (const id of ["over", "hud", "pause", "pause-menu", "rescue", "unpeek"]) $(id).hidden = true;
    this.peek = false;
    this.mode = "classic";
    this.challenge = null;
    this.reset();
    this.state = "menu";
    this.renderMenu();
    $("menu").hidden = false;
    this.sheets.maybeOfferGift();
  }

  private pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.sound.duck(true);
    $("finish-zen").hidden = this.mode !== "zen";
    $("pause-sub").textContent = this.mode === "zen" ? "Take your time." : `${fmt(this.sim.score)} people · ${this.sim.meters} m so far`;
    $("pause-menu").hidden = false;
    $("resume").focus();
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
    $("rescue-sub").textContent = left > 1 ? `You have ${left} rewinds left in this tower.` : "You have one rewind left in this tower.";
    $("rescue").hidden = false;
    $("rewind").focus();
  }

  private rewind(): void {
    if (this.state !== "rescue") return;
    this.sim.rewind();
    this.renderer.fx.debris = [];
    $("rescue").hidden = true;
    $("pause").hidden = false;
    this.state = "playing";
    this.sound.rewind();
    this.renderer.fx.popup("REWIND", "Try that floor again", this.sim.stack.length + 1, "#8ce99a", 1.2);
    this.updateHud(false);
  }

  private endFromRescue(): void {
    if (this.state !== "rescue") return;
    $("rescue").hidden = true;
    this.gameOver(true);
  }

  private gameOver(silent: boolean): void {
    this.state = "over";
    this.overTimer = 0.8;
    this.overReady = false;
    this.sim.combo = 0;
    this.sim.mover = null;
    this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.6);
    for (const id of ["hud", "pause", "banner"]) $(id).hidden = true;
    this.sound.intensity = 0;
    const run = this.sim.summary();
    const towersBefore = this.save.profile.towers;
    this.outcome = recordRun(this.save, run);
    this.opened = openedBetween(towersBefore, this.save.profile.towers);
    if (this.tutorial && run.floors >= 6) { this.tutorial = false; this.save.tutorialDone = true; }
    this.persist();
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
    this.timing = m && Math.abs(off) > 0.05 ? (Math.sign(off) === m.dir ? "late" : "early") : "";
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
      fx.popup(gold ? `PENTHOUSE +${out.points}` : out.combo > 1 ? `PERFECT x${out.combo}` : "PERFECT", gold ? "" : `+${out.points}`, f.y + 1, gold ? GOLD : "#ffffff");
      if (gold) { s.golden(); fx.whiteFlash = 0.35; } else s.perfect(out.combo);
      if (out.combo === 5 || out.combo === 10 || out.combo === 20) {
        fx.popup(out.combo >= 10 ? "UNSTOPPABLE!" : "ON FIRE!", "", f.y + 2.2, "#ffb13b", 1.4, true);
        s.streak();
      }
      vibrate(vib, gold ? [20, 30, 20] : 20);
    } else {
      // New builders get told which way they missed, to learn the timing.
      const coach = this.save.profile.towers < 8 && this.timing ? (this.timing === "early" ? "A bit early" : "A bit late") : "";
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
    if (f.kind === "garden") { s.garden(); fx.popup("TERRACE", "Your tower grew wider", f.y + 2.1, "#b8f5a0", 1.2); }
    fx.dust(f);
    fx.bounce = 1;
    fx.punch = Math.max(fx.punch, 0.25);
    this.updateHud(true);
    if (out.landmark !== undefined) {
      this.banner("Landmark passed", `Taller than ${MILESTONES[out.landmark].name}!`);
      setTimeout(() => s.milestone(), 120);
    }
    if (out.windStarts) {
      this.banner("Wind ahead", "Gusts speed floors up and slow them down");
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
      $("next").textContent = `${shortName(MILESTONES[i].name)} · ${MILESTONES[i].m} m`;
      $("bar").style.width = `${clamp((m - prev) / (MILESTONES[i].m - prev), 0, 1) * 100}%`;
    } else {
      $("next").textContent = "Taller than every landmark";
      $("bar").style.width = "100%";
    }
    $("wind").hidden = !sim.mover || sim.windFor(sim.mover.y) <= 0;

    const goal = $("goal"), c = this.challenge;
    goal.hidden = !c;
    if (c) {
      const g = c.goal;
      const have = g.type === "height" ? m : g.type === "streak" ? sim.bestStreak : sim.penthouses;
      const label = g.type === "height" ? `Goal: taller than <b>${g.n} m</b>` : g.type === "streak" ? `Goal: perfect streak of <b>${g.n}</b>` : `Goal: <b>${g.n}</b> perfect penthouses`;
      goal.innerHTML = `${label} · ${Math.min(have, g.type === "height" ? g.n + 1 : g.n)}${g.type === "height" ? " m" : ""}`;
    }

    this.measureHud();
    const kind = sim.mover?.kind ?? "normal";
    const tag = kind === "normal" ? "" : kind;
    if (tag !== this.tag) {
      this.tag = tag;
      const el = $("floor-tag");
      el.hidden = !tag;
      if (tag) {
        el.className = tag;
        el.textContent = FLOOR_TAGS[kind as Exclude<FloorKind, "normal">];
        replay(el, tag);
      }
    }
  }

  /** The first towers explain how to play. */
  private updateHint(): void {
    let text = "";
    if (this.tutorial && this.state === "playing" && this.mode !== "zen") {
      const n = this.sim.stack.length;
      if (n <= 2) text = "Tap when the sliding floor lines up with the one below";
      else if (n <= 4) text = "Overhangs break off. Wider floors fit more people!";
      else if (n <= 6) text = "Perfect drops add bonus people and keep floors wide";
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
    $("level-bar").style.width = `${p.xp / xpNeeded(p.level) * 100}%`;
    lv.querySelector<HTMLElement>(".new-dot")!.hidden = !isNew(save, "profile");
    const st = $("stars-btn");
    st.hidden = save.starsEarned <= 0 && !isOpen(save, "shop");
    $("stars-num").textContent = String(save.stars);
    st.querySelector<HTMLElement>(".new-dot")!.hidden = true;
  }

  private renderMenu(): void {
    const save = this.save, p = save.profile, now = Date.now();
    this.renderCorners();
    $("rules").hidden = p.towers >= 3;
    const best = $("menu-best");
    best.hidden = !save.best;
    best.innerHTML = `Best tower: <b>${fmt(save.best)}</b> people`;
    const friend = $("menu-challenge");
    friend.hidden = !this.friendScore;
    friend.innerHTML = `A friend housed <b>${fmt(this.friendScore)}</b> people. Can you beat them?`;
    $("gift-chip").hidden = p.towers < 1 || !giftState(p.gift).ready;

    const ev = eventFor(now), evChip = $("event-chip");
    evChip.hidden = !isOpen(save, "daily");
    evChip.innerHTML = `<b>${esc(ev.name)}</b> · ${esc(ev.text)}`;
    evChip.title = `This week's event. ${duration(eventEndsIn(now))} left.`;

    $("install-chip").hidden = !this.installPrompt || p.towers < 3;
    const n = boostCount(save), note = $("boost-note");
    note.hidden = !n;
    note.textContent = `Boosts ready: ${BOOSTS.filter(b => save.boosts[b.id]).map(b => `${b.name}${save.boosts[b.id] > 1 ? ` x${save.boosts[b.id]}` : ""}`).join(", ")}`;

    for (const f of ["daily", "challenges", "zen", "skins", "missions", "shop"] as Feature[]) {
      const btn = $(`${f}-btn`);
      btn.hidden = !isOpen(save, f);
      const fresh = isNew(save, f);
      btn.classList.toggle("is-new", fresh);
      btn.querySelector<HTMLElement>(".badge")!.hidden = !fresh;
    }
    for (const id of ["mode-tiles", "meta-tiles"]) $(id).hidden = [...$(id).children].every(c => (c as HTMLElement).hidden);

    $("daily-title").textContent = `Daily #${dayNumber(now)}`;
    $("daily-sub").textContent = save.daily.day === dayNumber(now) && save.daily.plays ? `Best ${fmt(save.daily.best)}` : `New · ${duration(dailyEndsIn(now))} left`;
    const nc = nextChallenge(save);
    $("challenges-sub").textContent = nc ? `${save.challenges.length}/6 done` : "All done!";
    const skin = skinById(save.skin);
    $("skins-swatch").innerHTML = swatchHtml(skin.swatch ?? skin.floors);
    $("skins-sub").textContent = `${unlockedSkinCount(save)}/${SKINS.length}`;
    const unseen = save.missions.done - save.missions.seen;
    $("missions-sub").textContent = unseen > 0 ? `${unseen} done!` : `${save.missions.slots.length} active`;
    $("missions-dot").hidden = unseen <= 0 || isNew(save, "missions");
    $("shop-sub").textContent = `${save.stars} ★`;

    const lvl = islandLevel(save), chip = $("island-chip");
    chip.hidden = p.towers < 1;
    const next = ISLAND_UPGRADES[lvl];
    chip.innerHTML = next
      ? `Island level <b>${lvl + 1}</b> · Next: ${esc(next.name)} at ${MILESTONES[next.at].m + 1} m`
      : `Island level <b>${lvl + 1}</b> · Fully upgraded`;
  }

  // ---------- Game over ----------

  private showOver(): void {
    const save = this.save, sim = this.sim, o = this.outcome!;
    const c = this.challenge, mode = this.mode;
    const won = !!c && sim.goalReached();
    const eyebrow = $("over-eyebrow");
    eyebrow.textContent = c ? (won ? "Challenge complete!" : "Challenge failed")
      : mode === "zen" ? "Zen tower" : mode === "daily" ? `Daily tower #${dayNumber()}` : o.newBest ? "New best!" : "Tower complete";
    eyebrow.classList.toggle("best", (o.newBest && mode !== "zen") || won);
    $("over-people").textContent = fmt(sim.score);
    $("over-sub").textContent = `people live in your ${sim.meters} m tower`;
    $("over-landmark").textContent = c ? c.text
      : mode === "daily" ? `Today's best: ${fmt(o.dailyBest)} people${o.newBest ? " · New all-time best!" : ""}`
      : sim.lastLandmark >= 0 ? `Taller than ${MILESTONES[sim.lastLandmark].name}`
      : mode === "zen" ? "Zen towers don't count toward bests" : `Best: ${fmt(save.best)} people`;
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
      b.innerHTML = `<span class="swatch">${swatchHtml(fresh.swatch ?? fresh.floors)}</span> Use ${esc(fresh.name)} next time`;
      b.addEventListener("click", () => {
        save.skin = fresh.id;
        this.persist();
        this.sound.click();
        b.disabled = true;
        b.textContent = `${fresh.name} is on for your next tower`;
      });
      rewards.appendChild(b);
    }
    rewards.hidden = !lines.length;

    const near = $("over-near");
    near.hidden = !o.near || !!c;
    near.textContent = o.near;
    $("xp-level").textContent = `Builder level ${o.xp.level}`;
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
        ? `You beat your friend's ${fmt(this.friendScore)} people!`
        : `Your friend's tower: ${fmt(this.friendScore)} people. ${fmt(this.friendScore - sim.score + 1)} more to win.`;
    }
    const next = won ? nextChallenge(save) : undefined;
    const again = $("again"), nb = $("next-challenge");
    again.textContent = c ? "Try again" : "Build again";
    // After a won challenge the next one is the main action.
    again.className = `btn ${next ? "btn-secondary" : "btn-primary"}`;
    nb.className = `btn ${next ? "btn-primary" : "btn-secondary"} wide`;
    nb.hidden = !next;
    if (next) nb.textContent = `Next challenge: ${next.name}`;
    $("share").hidden = mode === "challenge";
    $("over-actions").classList.toggle("single", mode === "challenge");
    this.renderCorners();
    $("over").hidden = false;
  }

  /** Groups the outcome into a few short lines so the card stays compact on phones. */
  private rewardLines(o: RunOutcome): { cls: string; text: string }[] {
    const lines: { cls: string; text: string }[] = [];
    const stars = (text: string) => Number(/\(\+(\d+) ★\)/.exec(text)?.[1] ?? 0);
    const missions = o.rewards.filter(r => r.text.startsWith("Mission complete"));
    const trophies = o.rewards.filter(r => r.text.startsWith("Trophy: "));
    for (const r of o.rewards) {
      if (missions.includes(r) || trophies.includes(r)) continue;
      lines.push({ cls: r.kind === "star" ? "reward star" : "reward", text: r.text });
    }
    if (missions.length === 1) lines.push({ cls: "reward star", text: missions[0].text });
    if (missions.length > 1) {
      lines.push({ cls: "reward star", text: `${missions.length} missions complete (+${missions.reduce((n, r) => n + stars(r.text), 0)} ★)` });
    }
    if (trophies.length) {
      const names = trophies.map(r => r.text.replace(/^Trophy: /, "").replace(/ \(\+\d+ ★\)$/, ""));
      lines.push({ cls: "reward star", text: `Troph${names.length > 1 ? "ies" : "y"}: ${names.join(", ")} (+${trophies.length} ★)` });
    }
    if (this.opened.length) {
      lines.push({ cls: "reward new", text: `Now on the main menu: ${this.opened.map(f => FEATURE_NAMES[f]).join(", ")}` });
    }
    return lines;
  }

  private shareText(): string {
    const sim = this.sim;
    const ms = sim.lastLandmark >= 0 ? `, taller than ${MILESTONES[sim.lastLandmark].name}` : "";
    if (this.mode === "daily") return `Skyrise Daily #${dayNumber()}: ${fmt(sim.score)} people in a ${sim.meters} m tower${ms}. Can you beat it today?`;
    return `My Skyrise tower is ${sim.meters} m tall${ms}, with ${fmt(sim.score)} people living in it. Can you build a bigger one?`;
  }

  private async share(): Promise<void> {
    const sim = this.sim;
    // Zen towers aren't a fair target, so their links carry no score to beat.
    const url = this.site ? (this.mode === "zen" ? this.site : `${this.site}?beat=${sim.score}`) : "";
    const text = this.shareText();
    const full = url ? `${text} ${url}` : text;
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
      toast("Copied! Paste it to a friend");
    } catch {
      toast(full);
    }
  }

  // ---------- Frame loop ----------

  private frame(now: number): void {
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.last = now;
    // Auto graphics: if a tower plays below about 50 fps, first lower the resolution a
    // step at a time, and only then switch this device to smooth mode (no shaders).
    const st = this.save.settings;
    if (this.state === "playing" && st.quality === "auto" && !st.autoLow && raw < 0.5) {
      this.perf.frames++;
      this.perf.time += raw;
      if (this.perf.time > 3) {
        const fps = this.perf.frames / this.perf.time;
        if (fps < 50 && this.renderScale > 0.65) {
          this.renderScale = Math.max(0.6, this.renderScale - 0.15);
          this.resize();
        } else if (fps < 40) {
          st.autoLow = true;
          this.persist();
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
      sim.update(dt);
      const m = sim.mover;
      // The wind meter shows the gust half a second ahead, so you can see it coming.
      if (m && sim.windFor(m.y) > 0) {
        const ahead = sim.gustAt(m, sim.time + 0.5);
        $("gust").style.width = `${clamp((ahead - 0.45) / 1.1, 0.05, 1) * 100}%`;
        const strong = ahead > 1.25;
        $("wind").classList.toggle("strong", strong);
        const label = strong ? "Gust coming" : ahead < 0.75 ? "Calm" : "Wind";
        if ($("wind-label").textContent !== label) $("wind-label").textContent = label;
      }
    }
    if (this.state === "rescue") {
      this.rescueLeft -= dt;
      $("countdown").style.transform = `scaleX(${clamp(this.rescueLeft / RESCUE_TIME, 0, 1)})`;
      if (this.rescueLeft <= 0) this.endFromRescue();
    }
    const active = this.state === "playing" || this.state === "paused" || this.state === "rescue";
    this.sound.intensity = active ? 1 + (sim.level >= 12 ? 1 : 0) + (sim.combo >= 5 ? 1 : 0) : 0;

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
      theme: currentTheme(save),
      islandLevel: islandLevel(save),
      guide: this.tutorial && this.mode !== "zen" && this.sim.stack.length <= 4,
      low: this.low,
      bestFloors: this.mode === "zen" ? 0 : Math.round(this.save.bestMeters / 5),
      hudBottom: this.state === "playing" || this.state === "paused" ? this.hudBottom : 0,
    });
    if (this.captureShare) {
      this.captureShare = false;
      const sim = this.sim, tag = this.mode === "daily" ? `Daily #${dayNumber()}` : "";
      void makeShareImage(this.renderer.output, this.renderer.view, {
        score: sim.score, meters: sim.meters, floors: sim.level, landmark: sim.lastLandmark, tag,
      }).then(b => { this.shareBlob = b; });
    }
  }
}

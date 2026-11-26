// The holiday parade's side of the town screen (logic/parade.ts, render3d/parade.ts): it
// starts one every few minutes during Winter Lights (and right after an Advent door is opened),
// shows a small banner with a Watch button that lets the camera follow the lead float for a
// few seconds, and pays a float's tip when it's tapped.
import { t } from "../i18n";
import { coins } from "../data/tycoon";
import { gameNow } from "../data/season";
import { earn, perSecond } from "../logic/tycoon";
import { newParade, paradeDue, paradeRunning, startParade, tipFloat, PARADE_FLOATS, type ParadeFloat } from "../logic/parade";
import type { SaveData } from "../logic/save";
import type { Sound } from "../sound";
import { track } from "../stats";
import { $, openModalEl, toast, vibrate } from "./dom";
import { burst } from "./fx";

export interface ParadeHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  paradeStart(): void;
  paradeWatch(ms: number): void;
  paradeHit(x: number, y: number): number;
}

/** How long the Watch button follows the lead float. */
const WATCH_MS = 7000;
/** How long the banner stays. */
const BANNER_MS = 10000;

/** What a float's tip says. */
function tipText(f: ParadeFloat, n: string): string {
  if (f === "present") return t("🎁 The giant present float tips you +{n}!", { n });
  if (f === "snowman") return t("⛄ The snowman float tips you +{n}!", { n });
  if (f === "gingerbread") return t("🍪 The gingerbread float tips you +{n}!", { n });
  return t("🛷 Santa's sleigh tips you +{n}!", { n });
}

export class ParadeUI {
  readonly state = newParade();
  private next = 0;
  private advent = false;
  private banner: HTMLElement | null = null;
  private bannerTimer = 0;
  constructor(private readonly host: () => ParadeHost) {}

  /** Called every frame in the town (cheap: it looks once a second). */
  tick(now: number, inCity: boolean): void {
    if (now < this.next) return;
    this.next = now + 1000;
    // (Only while the town is on screen and nothing covers it: a parade nobody sees is wasted.)
    const calm = inCity && !openModalEl() && !document.body.classList.contains("tabs-open");
    if (!calm) return;
    const at = gameNow();
    if (this.advent) { this.advent = false; this.start(); return; }
    if (paradeDue(this.state, at)) this.start();
  }

  /** An Advent door was just opened: a parade goes by once the calendar closes. */
  afterAdvent(): void { this.advent = true; }

  /** Starts a parade now (the timer's, an Advent door's, or ?debug's). */
  start(): boolean {
    if (!startParade(this.state, gameNow())) return false;
    const h = this.host();
    h.paradeStart();
    h.sound.whoosh();
    track("parade", {}, false);
    this.showBanner();
    return true;
  }

  private showBanner(): void {
    if (!this.banner) {
      const el = document.createElement("div");
      el.className = "parade-banner";
      el.setAttribute("role", "status");
      el.innerHTML = `<span class="pb-text"></span><button type="button" class="pb-watch"></button>`;
      el.querySelector("button")!.addEventListener("click", e => {
        e.stopPropagation();
        const h = this.host();
        h.sound.click();
        h.paradeWatch(WATCH_MS);
        this.hideBanner();
      });
      $("tycity").appendChild(el);
      this.banner = el;
    }
    this.banner.querySelector(".pb-text")!.textContent = t("🎉 The holiday parade is coming!");
    this.banner.querySelector(".pb-watch")!.textContent = t("Watch");
    this.banner.hidden = false;
    this.banner.classList.remove("out");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.hideBanner(), BANNER_MS);
  }

  private hideBanner(): void {
    clearTimeout(this.bannerTimer);
    const el = this.banner;
    if (!el || el.hidden) return;
    el.classList.add("out");
    window.setTimeout(() => { if (el.classList.contains("out")) el.hidden = true; }, 300);
  }

  /** A tap in the town: on a float, it tips (once per float per parade). True when it was
   *  on a float. */
  tap(x: number, y: number): boolean {
    if (!paradeRunning(this.state, gameNow())) return false;
    const h = this.host(), k = h.paradeHit(x, y);
    if (k < 0) return false;
    const s = h.save, n = tipFloat(this.state, k, perSecond(s, Date.now(), false), gameNow());
    if (!n) { toast(t("🎄 You already got this float's tip. Try another one!")); return true; }
    earn(s, n);
    h.sound.coins();
    vibrate(s.settings.vibrate, [10, 20, 10]);
    toast(tipText(PARADE_FLOATS[k], coins(n)));
    // (Sparks right where the finger was.)
    const dot = document.createElement("i");
    dot.style.cssText = `position:fixed;left:${x - 10}px;top:${y - 10}px;width:20px;height:20px;pointer-events:none`;
    document.body.appendChild(dot);
    burst(dot, 16);
    window.setTimeout(() => dot.remove(), 900);
    track("parade_tip", { float: PARADE_FLOATS[k] }, false);
    h.persist();
    return true;
  }
}

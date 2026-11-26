// The weather's moments in the town (logic/weather.ts): the rainbow after rain (said once,
// with a pot of gold to tap once per rainbow) and the snow day (cozy businesses earn more,
// with a little badge while it lasts).
import { t } from "../i18n";
import { coins } from "../data/tycoon";
import { earn, perSecond } from "../logic/tycoon";
import { claimRainbowGold, greetRainbow, rainbowGoldOn, SNOW_DAY_MULT, snowDayOn, startSnowDay } from "../logic/weather";
import type { SaveData } from "../logic/save";
import type { Sound } from "../sound";
import { $, openModalEl, toast, vibrate } from "./dom";
import { confetti } from "./fx";

export interface WeatherHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
}

export class WeatherMoments {
  private next = 0;
  private box: HTMLElement | null = null;
  private gold: HTMLButtonElement | null = null;
  private badge: HTMLElement | null = null;
  constructor(private readonly host: () => WeatherHost) {}

  /** Called every frame in the town (cheap: it looks once a second). */
  tick(now: number, inCity: boolean): void {
    if (now < this.next) return;
    this.next = now + 1000;
    const h = this.host(), s = h.save;
    const calm = inCity && !openModalEl() && !document.body.classList.contains("tabs-open");
    if (calm && startSnowDay(s, now)) {
      h.persist();
      toast(t("❄️ Snow day! Cafés and bakeries earn ×{n} while it snows", { n: SNOW_DAY_MULT }));
    }
    if (calm && greetRainbow(s, now)) {
      h.persist();
      toast(t("🌈 A rainbow! Tap the pot of gold under it for a bonus"));
    }
    if (!inCity && !this.box) return;
    this.ensure();
    const goldOn = inCity && rainbowGoldOn(s, now), snowOn = inCity && snowDayOn(s, now);
    if (this.gold!.hidden === goldOn) this.gold!.hidden = !goldOn;
    if (this.badge!.hidden === snowOn) this.badge!.hidden = !snowOn;
  }

  private ensure(): void {
    if (this.box) return;
    const box = document.createElement("div");
    box.className = "tcy-weather";
    const gold = document.createElement("button");
    gold.type = "button";
    gold.className = "wx-gold";
    gold.hidden = true;
    gold.textContent = "💰";
    gold.setAttribute("aria-label", t("The rainbow's pot of gold: tap for a bonus"));
    gold.addEventListener("click", e => { e.stopPropagation(); this.claim(); });
    const badge = document.createElement("div");
    badge.className = "wx-snow";
    badge.hidden = true;
    badge.textContent = t("❄️ Snow day: cafés ×{n}", { n: SNOW_DAY_MULT });
    box.append(gold, badge);
    $("tycity").appendChild(box);
    this.box = box; this.gold = gold; this.badge = badge;
  }

  private claim(): void {
    const h = this.host(), s = h.save, now = Date.now();
    const n = claimRainbowGold(s, perSecond(s, now, false), now);
    if (n) confetti(this.gold!);
    this.gold!.hidden = true;
    if (!n) return;
    earn(s, n);
    h.sound.coins();
    vibrate(s.settings.vibrate, [15, 30, 15]);
    toast(t("🌈 The pot of gold: +{n}!", { n: coins(n) }));
    h.persist();
  }
}

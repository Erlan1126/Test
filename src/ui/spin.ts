// The daily spin wheel's sheet (Buildaroo): the wheel turns with an ease-out to the slice
// the logic picked (logic/spin.ts), then the reward pops up. One free spin a day, and one
// more for a rewarded ad when ads are set up.
import { BOOM_MINUTES, BOOM_MULT, coins } from "../data/tycoon";
import { t } from "../i18n";
import { duration } from "../logic/rules";
import type { SaveData } from "../logic/save";
import { spin, spinAdLeft, spinFree, SPIN_SLICES, type SpinResult, type SpinSlice } from "../logic/spin";
import type { Sound } from "../sound";
import { adsReady, showRewarded } from "../ads";
import { track } from "../stats";
import { $, closeModal, esc, openModal, stillMotion, toast, wireModal } from "./dom";
import { burst, confetti } from "./fx";

export interface SpinHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  refresh(): void;
  reschedule(): void;
}

const SEG = 360 / SPIN_SLICES.length;
const SPIN_MS = 4200;

/** Time until the next free spin (local midnight). */
export function nextSpinIn(now = Date.now()): string {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return duration(d.getTime() - now);
}

/** A slice's icon (from the game's icon set, else an emoji) and short label on the wheel. */
function sliceLabel(sl: SpinSlice): { icon?: string; ico?: string; text: string } {
  switch (sl.kind) {
    case "cash": return { ico: "💵", text: t("{n} min", { n: sl.minutes ?? 0 }) };
    case "crystals": return { icon: "gem", text: String(sl.crystals ?? 0) };
    case "boom": return { icon: "fire", text: `×${BOOM_MULT}` };
    case "build": return { icon: "tower", text: t("Build") };
    case "jackpot": return { ico: "🎰", text: t("JACKPOT") };
  }
}

/** The wheel, drawn once: slice i spans [i·SEG, (i+1)·SEG) clockwise from the top. Each
 *  slice has its icon near the rim and its label along the radius. */
function wheelSvg(): string {
  const p = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };
  const wedges = SPIN_SLICES.map((sl, i) =>
    `<path d="M0 0 L${p(i * SEG, 96)} A96 96 0 0 1 ${p((i + 1) * SEG, 96)} Z" fill="${sl.color}" stroke="#fff" stroke-width="2"/>`).join("");
  const labels = SPIN_SLICES.map((sl, i) => {
    const l = sliceLabel(sl);
    const icon = l.icon ? `<use href="#ic-${l.icon}" x="-10" y="-88" width="20" height="20"/>` : `<text y="-77" class="spin-ico">${l.ico}</text>`;
    // Long labels (and longer languages) are squeezed to fit between the hub and the icon.
    const fit = l.text.length > 6 ? ` textLength="40" lengthAdjust="spacingAndGlyphs"` : "";
    return `<g transform="rotate(${i * SEG + SEG / 2})">${icon}<text class="spin-txt" transform="translate(0 -45) rotate(-90)"${fit}>${esc(l.text)}</text></g>`;
  }).join("");
  return `<div class="spin-disc" id="spin-disc"><svg viewBox="-100 -100 200 200" aria-hidden="true">
    <circle r="99" fill="#fff"/>${wedges}${labels}<circle r="20" fill="#fff"/><circle r="15" fill="#ffc61a"/></svg></div>
    <i class="spin-pin" aria-hidden="true"></i>`;
}

/** What a spin paid, in words. */
export function spinRewardText(r: SpinResult): string {
  if (r.kind === "jackpot") return t("🎰 JACKPOT! +{cash} and +{n} Sky Crystals", { cash: coins(r.cash), n: r.crystals });
  if (r.kind === "boom") return t("🔥 Construction boom! Everything earns ×{n} for {m} minutes", { n: BOOM_MULT, m: BOOM_MINUTES });
  if (r.built) return t("🏗️ Builders' rush: your build is finished!");
  if (r.cash) return t("🎡 Spin reward: +{n}", { n: coins(r.cash) });
  return t("🎡 Spin reward: +{n} Sky Crystals", { n: r.crystals });
}

export class SpinWheel {
  private angle = 0;
  private busy = false;
  private timer = 0;

  constructor(private readonly host: SpinHost, private readonly onChange: () => void) {
    const el = $("spin-sheet");
    $("spin-wheel").innerHTML = wheelSvg();
    wireModal(el, () => this.close());
    $("spin-go").addEventListener("click", () => this.go(false));
    $("spin-ad").addEventListener("click", () => void this.watchAd());
  }

  open(): void {
    this.render();
    openModal($("spin-sheet"), $("spin-go"));
  }

  close(): void {
    // A spin under way still pays out (it's already in the save): show it now.
    if (this.busy) { clearTimeout(this.timer); this.reveal(); }
    closeModal($("spin-sheet"));
    this.onChange();
  }

  private render(): void {
    const s = this.host.save, free = spinFree(s), ad = spinAdLeft(s) && adsReady();
    $("spin-title").textContent = t("Daily spin");
    $("spin-sub").textContent = t("One free spin every day. Cash, Sky Crystals, boosts or the jackpot!");
    const go = $<HTMLButtonElement>("spin-go");
    go.textContent = free ? t("Spin!") : t("Come back tomorrow");
    go.disabled = !free || this.busy;
    go.hidden = !free && ad;
    const adBtn = $<HTMLButtonElement>("spin-ad");
    adBtn.hidden = !ad;
    adBtn.disabled = this.busy;
    adBtn.textContent = t("📺 Watch an ad for another spin");
    if (!this.busy) $("spin-note").textContent = free ? t("Your free spin is ready!") : t("Next free spin in {time}", { time: nextSpinIn() });
  }

  private async watchAd(): Promise<void> {
    if (this.busy || !spinAdLeft(this.host.save) || !adsReady()) return;
    this.host.sound.click();
    const ok = await showRewarded("spin");
    if (ok) this.go(true); else this.render();
  }

  private go(ad: boolean): void {
    if (this.busy) return;
    const s = this.host.save, r = spin(s, Date.now(), Math.random, ad);
    if (!r) { this.render(); return; }
    // Paid (and saved) straight away; the wheel only shows it.
    this.host.persist();
    track("spin", { kind: r.kind, ad }, false);
    this.busy = true;
    this.result = r;
    this.host.sound.whoosh();
    const disc = $("spin-disc");
    const still = stillMotion(), ms = still ? 600 : SPIN_MS;
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const target = -(r.slice * SEG + SEG / 2) + jitter;
    const turn = (((target - this.angle) % 360) + 360) % 360;
    this.angle += (still ? 0 : 360 * 5) + turn;
    disc.style.transition = `transform ${ms}ms cubic-bezier(0.12, 0.7, 0.1, 1)`;
    disc.style.transform = `rotate(${this.angle.toFixed(1)}deg)`;
    $("spin-note").textContent = t("Spinning…");
    this.render();
    this.timer = window.setTimeout(() => this.reveal(), ms + 120);
  }

  private result: SpinResult | null = null;

  private reveal(): void {
    const r = this.result;
    this.busy = false;
    this.result = null;
    if (!r) return;
    const msg = spinRewardText(r);
    $("spin-note").textContent = msg;
    toast(msg);
    if (r.kind === "jackpot") { this.host.sound.win(); confetti($("spin-wheel")); }
    else if (r.kind === "boom" || r.built) this.host.sound.tada();
    else if (r.cash) this.host.sound.coins();
    else this.host.sound.star();
    burst($("spin-wheel"), r.kind === "jackpot" ? 30 : 16);
    if (r.built) this.host.reschedule();
    this.host.refresh();
    this.render();
    // Keep the reward line showing rather than the countdown.
    $("spin-note").textContent = msg;
    this.onChange();
  }
}

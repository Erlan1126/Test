// The Advent calendar's sheet (Buildaroo): 24 little doors in a 4 × 6 grid. Today's door
// glows, a missed one waits in purple, the ones still to come are locked, and an opened door
// shows what was inside. Tapping a door swings it open, then the prize pops up
// (logic/advent.ts pays it).
import { coins } from "../data/tycoon";
import { gameNow } from "../data/season";
import { t } from "../i18n";
import { duration } from "../logic/rules";
import type { SaveData } from "../logic/save";
import { ADVENT_DOORS, adventDay, adventOpened, adventReady, doorPrize, nextDoorIn, openDoor, type AdventResult } from "../logic/advent";
import type { Sound } from "../sound";
import { track } from "../stats";
import { $, closeModal, esc, openModal, toast, wireModal } from "./dom";
import { burst, confetti } from "./fx";

export interface AdventHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  refresh(): void;
}

/** How long the door takes to swing open before the prize shows. */
const OPEN_MS = 650;

/** A door's prize, small: its icon and a short label. */
function prizeLabel(door: number): { ico: string; text: string } {
  const p = doorPrize(door);
  if (p.kind === "cash") return { ico: "💵", text: t("{n} min", { n: p.minutes ?? 0 }) };
  if (p.kind === "crystals") return { ico: "💎", text: `+${p.crystals ?? 0}` };
  return { ico: "🍪", text: t("Gingerbread house") };
}

/** What a door paid, in words. */
export function adventRewardText(r: AdventResult): string {
  if (r.decor) return t("🎄 Door 24: the gingerbread house is yours! Place it on any empty lot");
  if (r.cash) return t("🎁 Door {n}: +{cash}", { n: r.door, cash: coins(r.cash) });
  return t("🎁 Door {n}: +{c} Sky Crystals", { n: r.door, c: r.crystals });
}

export class AdventCalendar {
  private busy = false;

  constructor(private readonly host: AdventHost, private readonly onChange: () => void) {
    wireModal($("advent-sheet"), () => this.close());
    $("advent-grid").addEventListener("click", e => {
      const el = (e.target as Element).closest<HTMLElement>("[data-door]");
      if (el) this.tap(el, Number(el.dataset.door));
    });
  }

  open(): void {
    this.render();
    openModal($("advent-sheet"));
  }

  close(): void {
    closeModal($("advent-sheet"));
    this.onChange();
  }

  private render(): void {
    const s = this.host.save, now = gameNow(), day = adventDay(now), opened = adventOpened(s, now), ready = adventReady(s, now);
    $("advent-title").textContent = t("Advent calendar");
    $("advent-sub").textContent = t("A little gift every day until December 24. Missed a day? Its door waits for you.");
    $("advent-grid").innerHTML = Array.from({ length: ADVENT_DOORS }, (_, i) => {
      const d = i + 1, p = prizeLabel(d), got = opened.includes(d);
      const state = got ? "got" : d > day ? "locked" : d === day ? "today" : "ready";
      const inside = `<span class="adv-in"><i aria-hidden="true">${p.ico}</i><small>${esc(p.text)}</small></span>`;
      const leaf = got ? "" : `<span class="adv-leaf" aria-hidden="true"><b>${d}</b>${state === "locked" ? `<small>🔒</small>` : d === ADVENT_DOORS ? `<small>⭐</small>` : ""}</span>`;
      const label = got ? t("Door {n}: opened", { n: d }) : state === "locked" ? t("Door {n}: opens on December {n}", { n: d }) : t("Door {n}: open it!", { n: d });
      return `<button type="button" class="adv-door ${state}${d === ADVENT_DOORS ? " last" : ""}" data-door="${d}"${state === "locked" ? " disabled" : ""} aria-label="${esc(label)}">${inside}${leaf}</button>`;
    }).join("");
    const wait = nextDoorIn(now);
    $("advent-note").textContent = ready > 1 ? t("{n} doors are waiting for you!", { n: ready })
      : ready === 1 ? (!opened.includes(day) ? t("Today's door is ready to open!") : t("A door is waiting for you!"))
      : wait ? t("Next door opens in {time}", { time: duration(wait) })
      : t("All 24 doors are open. Merry Christmas!");
  }

  private tap(el: HTMLElement, door: number): void {
    if (this.busy || !el.matches(".today, .ready")) return;
    const s = this.host.save, r = openDoor(s, door, gameNow());
    if (!r) { this.render(); return; }
    // Paid (and saved) straight away; the door only shows it.
    this.host.persist();
    track("advent_door", { door, kind: r.kind }, false);
    this.busy = true;
    this.host.sound.whoosh();
    el.classList.add("opening");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => this.reveal(r), still ? 120 : OPEN_MS);
  }

  private reveal(r: AdventResult): void {
    this.busy = false;
    const msg = adventRewardText(r);
    toast(msg);
    const el = $("advent-grid").querySelector<HTMLElement>(`[data-door="${r.door}"]`) ?? $("advent-grid");
    if (r.decor) { this.host.sound.win(); confetti(el); track("decor_won", { id: r.decor, from: "advent" }, false); }
    else if (r.cash) this.host.sound.coins();
    else this.host.sound.star();
    burst(el, r.decor ? 30 : 16);
    this.host.refresh();
    this.render();
    $("advent-grid").querySelector(`[data-door="${r.door}"]`)?.classList.add("just");
    // (The house's line stays: where to find it is worth reading.)
    if (r.decor) $("advent-note").textContent = msg;
    this.onChange();
  }
}

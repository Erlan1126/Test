// The Tycoon screens: the business list (tap to run, buy levels, hire managers), boosts,
// the New Era, the live card on the home screen and the "while you were away" welcome.
import { BUSINESSES, coins, COIN_BOOST_CRYSTALS, WARP_24H_CRYSTALS, WARP_4H_CRYSTALS } from "../data/tycoon";
import { t } from "../i18n";
import { fmt } from "../core/util";
import type { SaveData } from "../logic/save";
import {
  affordable, buyBoost, buyLevels, costOf, cycleOf, eraGems, freeFloors, hireManager, levelOf, multiplier, newEra, nextMilestone, officeFloors, usedFloors,
  payOf, perSecond, progressOf, runOnce, tick, timeWarp, unlockedBusiness,
} from "../logic/tycoon";
import type { Sound } from "../sound";
import { $, closeModal, esc, openModal, toast, vibrate, wireModal } from "./dom";
import { burst, confetti, fireworks } from "./fx";
import { iconSvg } from "./icons";
import { mayorSvg } from "./mayor";

export interface TycoonHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  refresh(): void;
  openCrystalShop(): void;
  /** Starts a tower (to build more office floors). */
  buildFloors(): void;
}

/** A gold coin with a star, for counters. */
export const COIN_SVG = `<svg viewBox="0 0 24 24"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.5" stop-color="#ffc93c"/><stop offset="1" stop-color="#d8901a"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#cg)" stroke="#b8740c" stroke-width="1.2"/><circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/><path d="M12 7.2l1.4 2.9 3.2.4-2.3 2.2.6 3.2-2.9-1.6-2.9 1.6.6-3.2-2.3-2.2 3.2-.4z" fill="#fff8d6"/></svg>`;

export class TycoonUI {
  private amount: number | "max" = 1;
  private loop = 0;
  private lastTick = 0;
  private lastSave = 0;
  private pending = 0;
  private lastP = new Map<string, number>();
  private lastPop = new Map<string, number>();

  constructor(private readonly host: TycoonHost) {
    wireModal($("tycoon"));
    document.querySelectorAll<HTMLElement>(".tc-coin").forEach(el => { el.innerHTML = COIN_SVG; });
    $("tycoon-card").addEventListener("click", () => this.open());
    $("tycoon-btn").addEventListener("click", () => this.open());
    $("tycoon").querySelectorAll<HTMLButtonElement>(".ty-amount button").forEach(b => b.addEventListener("click", () => {
      this.amount = b.dataset.n === "max" ? "max" : Number(b.dataset.n);
      $("tycoon").querySelectorAll(".ty-amount button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      this.host.sound.click();
      this.render();
    }));
    $("ty-build").addEventListener("click", () => { closeModal($("tycoon")); this.host.buildFloors(); });
    // The home card ticks along while the menu shows.
    setInterval(() => this.homeTick(), 1000);
  }

  private get save(): SaveData { return this.host.save; }

  open(): void {
    this.host.sound.click();
    tick(this.save);
    this.render();
    openModal($("tycoon"));
    cancelAnimationFrame(this.loop);
    const frame = () => {
      if ($("tycoon").hidden) { this.host.persist(); return; }
      this.live();
      this.loop = requestAnimationFrame(frame);
    };
    this.loop = requestAnimationFrame(frame);
  }

  /** Earnings since the last check, a few times a second while the sheet is open. */
  private live(): void {
    const now = Date.now();
    if (now - this.lastTick > 120) {
      this.lastTick = now;
      const got = tick(this.save, now);
      if (got > 0) this.pending += got;
      if (now - this.lastSave > 5000) { this.lastSave = now; this.host.persist(); }
    }
    $("ty-coins").textContent = coins(this.save.tycoon.coins);
    for (const row of $("ty-list").querySelectorAll<HTMLElement>(".ty-biz[data-id]")) {
      const id = row.dataset.id!, p = progressOf(this.save, id, now);
      // A finished cycle pops a coin out of the room (no more than twice a second).
      const was = this.lastP.get(id) ?? 0, running = !!this.save.tycoon.runs[id];
      if ((p < was - 0.05 || (was > 0.6 && !running)) && now - (this.lastPop.get(id) ?? 0) > 450) {
        this.lastPop.set(id, now);
        const b = BUSINESSES.find(x => x.id === id)!;
        popCoin(row.querySelector(".room-pops")!, coins(payOf(this.save, b, now) * Math.max(1, Math.round(450 / (cycleOf(b, levelOf(this.save, id)) * 1000)))));
      }
      this.lastP.set(id, p);
      (row.querySelector(".ty-prog i") as HTMLElement).style.width = `${p * 100}%`;
      const b = BUSINESSES.find(x => x.id === id)!;
      const lv = levelOf(this.save, id), n = this.amount === "max" ? Math.max(1, affordable(b, lv, this.save.tycoon.coins)) : this.amount;
      const btn = row.querySelector<HTMLButtonElement>(".ty-buy")!;
      const can = costOf(b, lv, n) <= this.save.tycoon.coins && (this.amount !== "max" || affordable(b, lv, this.save.tycoon.coins) > 0);
      if (!btn.classList.contains("need-floors") && btn.disabled === can) btn.disabled = !can;
      const hire = row.querySelector<HTMLButtonElement>(".ty-hire");
      if (hire) hire.disabled = this.save.tycoon.coins < b.manager;
    }
    // Refresh the labels every half second or so (prices change as coins grow).
    if (this.pending && now % 500 < 20) { this.pending = 0; this.render(); }
  }

  render(): void {
    const s = this.save, ty = s.tycoon, now = Date.now();
    $("ty-era").textContent = t("Era {n}", { n: ty.eras + 1 });
    $("ty-coins").textContent = coins(ty.coins);
    $("ty-rate").textContent = t("{n} a second", { n: coins(perSecond(s, now)) });
    $("ty-mult").textContent = t("×{n} earnings", { n: multiplier(s, now).toFixed(2) });
    this.renderOffice();
    // The company as a cut-away skyscraper: a roof with the company sign, one room per
    // business (newest at the top), and the lobby at the bottom. Rooms are alive: people
    // walk around, the manager stands at the counter, coins pop out as it earns.
    const list = $("ty-list");
    list.innerHTML = `<div class="tw-roof"><span class="tw-antenna"></span><b>${esc(t("Skyhaven Inc."))}</b></div><div class="tw-shaft" aria-hidden="true"><i class="tw-car"></i></div>`;
    const rooms: HTMLElement[] = [];
    BUSINESSES.forEach((b, i) => {
      if (!unlockedBusiness(s, i)) {
        if (i === 0 || !unlockedBusiness(s, i - 1)) return;
      }
      const lv = levelOf(s, b.id), owned = lv > 0, managed = ty.managers.includes(b.id);
      const n = this.amount === "max" ? Math.max(1, affordable(b, lv, ty.coins)) : this.amount;
      const price = costOf(b, lv, n), next = nextMilestone(lv);
      const row = document.createElement("div");
      row.className = `ty-biz room${owned ? "" : " locked"}${managed ? " managed" : ""}`;
      if (owned) row.dataset.id = b.id;
      row.style.setProperty("--b1", b.color[0]);
      row.style.setProperty("--b2", b.color[1]);
      const people = owned ? Math.min(6, 1 + Math.floor(Math.log2(lv + 1))) : 0;
      const props = (PROPS[b.id] ?? [b.icon]).map((ic, k) => `<span class="rp rp${k}">${iconSvg(ic)}</span>`).join("");
      const walkers = Array.from({ length: people }, (_, k) =>
        `<i class="walker" style="--d:${(k * 1.7) % 5}s;--t:${5 + ((k * 3) % 4)}s;--x:${12 + ((k * 37) % 60)}%;--shirt:${SHIRTS[(k + i) % SHIRTS.length]}">${PERSON}</i>`).join("");
      row.innerHTML = `
        <button type="button" class="room-scene" aria-label="${esc(owned ? t("Run {name}", { name: t(b.name) }) : t(b.name))}">
          <span class="room-wall"></span><span class="room-window"></span>
          <span class="room-sign">${iconSvg(b.icon)}<b>${esc(t(b.name))}</b></span>
          ${owned ? `<span class="room-props">${props}</span>${walkers}` : `<span class="room-lease">${esc(t("For lease"))}</span>`}
          ${managed ? `<i class="walker boss" style="--x:78%">${PERSON_BOSS}</i>` : ""}
          ${owned ? `<b class="room-level">${esc(t("{n} floors", { n: fmt(lv) }))}</b>` : ""}
          ${owned && !managed ? `<span class="tap-me">${esc(t("Tap!"))}</span>` : ""}
          <span class="room-pops"></span>
          <div class="ty-prog"><i></i><span>${owned ? esc(coins(payOf(s, b, now))) : esc(t("Opens with {n}", { n: coins(b.income * multiplier(s, now)) }))}</span></div>
        </button>
        <div class="room-bar">
          <small>${owned ? esc(next ? t("{n} floors: twice as fast", { n: next }) : t("Top speed!")) + " · " + esc(fmtSec(cycleOf(b, lv))) : esc(t("Open it to earn {n} a cycle", { n: coins(b.income * multiplier(s, now)) }))}</small>
          ${owned && !managed ? `<button type="button" class="ty-hire">${esc(t("Hire manager"))} · ${esc(coins(b.manager))}</button>` : managed ? `<span class="ty-auto">${esc(t("Auto"))}</span>` : ""}
          <button type="button" class="buy ty-buy"><small>${esc(owned ? t("Buy ×{n}", { n: fmt(n) }) : t("Open"))}</small>${COIN_SVG}${esc(coins(price))}</button>
        </div>`;
      row.querySelector(".room-scene")!.addEventListener("click", e => {
        if (!owned) return;
        if (runOnce(s, b.id)) { this.host.sound.click(); burst(e.currentTarget as Element, 6); vibrate(s.settings.vibrate, 8); }
      });
      const noRoom = freeFloors(s) < (this.amount === "max" ? 1 : this.amount);
      if (noRoom) {
        const bb = row.querySelector<HTMLButtonElement>(".ty-buy")!;
        bb.classList.add("need-floors");
        bb.innerHTML = `<small>${esc(t("No empty floors"))}</small>${esc(t("Build"))}`;
      }
      row.querySelector(".ty-buy")!.addEventListener("click", e => {
        if (noRoom) { toast(t("Every office floor is full. Build a tower to add more!")); closeModal($("tycoon")); this.host.buildFloors(); return; }
        tick(s);
        const got = buyLevels(s, b.id, this.amount);
        if (!got) { this.host.sound.click(); return; }
        const crossed = nextMilestone(lv) !== undefined && lv + got >= (nextMilestone(lv) ?? Infinity);
        this.host.sound.coins();
        burst(e.currentTarget as Element, crossed ? 20 : 8);
        if (!owned) { toast(t("{name} is open!", { name: t(b.name) })); confetti(row); }
        else if (crossed) { toast(t("{name} now runs twice as fast!", { name: t(b.name) })); fireworks(2, () => this.host.sound.firework()); }
        this.host.persist();
        this.render();
      });
      row.querySelector(".ty-hire")?.addEventListener("click", e => {
        tick(s);
        if (!hireManager(s, b.id)) { this.host.sound.click(); return; }
        this.host.sound.unlock();
        burst(e.currentTarget as Element, 16);
        toast(t("A manager now runs {name}, even while you're away", { name: t(b.name) }));
        this.host.persist();
        this.render();
      });
      rooms.push(row);
    });
    // Newest business on top, like floors built up over time.
    for (const r of rooms.reverse()) list.appendChild(r);
    list.insertAdjacentHTML("beforeend", `<div class="tw-lobby"><span class="tw-door"></span><span class="tw-door"></span><b>${esc(t("Lobby"))}</b></div>`);
    this.renderBoosts();
    this.renderEra();
  }

  /** The company's office tower: each business's floors in its own color, empty floors as
   *  glass, and how many are free. */
  private renderOffice(): void {
    const s = this.save, total = officeFloors(s), used = usedFloors(s);
    $("ty-floors").textContent = `${fmt(used)} / ${fmt(total)}`;
    $("ty-fbar").style.width = `${Math.min(100, (used / total) * 100)}%`;
    $("ty-build").classList.toggle("urgent", freeFloors(s) === 0);
    const rows = 22, per = total / rows, segs: string[] = [];
    let acc = 0, bi = 0, inB = 0;
    const owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0);
    for (let r = 0; r < rows; r++) {
      const floorAt = (r + 0.5) * per;
      while (bi < owned.length && acc + levelOf(s, owned[bi].id) < floorAt) { acc += levelOf(s, owned[bi].id); bi++; inB = 0; }
      const b = floorAt <= used ? owned[bi] : undefined;
      inB++;
      segs.push(b ? `<i style="--f1:${b.color[0]};--f2:${b.color[1]}"></i>` : `<i class="empty"></i>`);
    }
    $("ty-tower").innerHTML = `<span class="tt-roof"></span>${segs.reverse().join("")}`;
  }

  private renderBoosts(): void {
    const s = this.save, ty = s.tycoon, rate = perSecond(s);
    const card = (cls: string, icon: string, title: string, text: string, price: string, disabled: boolean) =>
      `<div class="ty-boost ${cls}"><span class="ty-bico">${iconSvg(icon)}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span><button type="button" class="buy"${disabled ? " disabled" : ""}>${price}</button></div>`;
    $("ty-boosts").innerHTML =
      card("boost", "bolt", t("Coin booster ×2"), ty.boost ? t("Active forever. Every coin counts twice") : t("Double every coin you earn, forever"), ty.boost ? esc(t("✓ Owned")) : `💎 ${fmt(COIN_BOOST_CRYSTALS)}`, ty.boost)
      + card("warp4", "clock", t("Time warp: 4 hours"), rate > 0 ? t("Get {n} right now", { n: coins(rate * 4 * 3600) }) : t("Hire a manager first"), `💎 ${WARP_4H_CRYSTALS}`, rate <= 0)
      + card("warp24", "rocket", t("Time warp: 24 hours"), rate > 0 ? t("Get {n} right now", { n: coins(rate * 24 * 3600) }) : t("Hire a manager first"), `💎 ${WARP_24H_CRYSTALS}`, rate <= 0);
    const buys = $("ty-boosts").querySelectorAll<HTMLButtonElement>(".buy");
    buys[0].addEventListener("click", () => {
      if (s.crystals < COIN_BOOST_CRYSTALS) { this.short(COIN_BOOST_CRYSTALS); return; }
      if (!buyBoost(s)) return;
      this.host.sound.purchase(); confetti(); toast(t("Coin booster on: every coin counts twice!"));
      this.done();
    });
    for (const [i, h, price] of [[1, 4, WARP_4H_CRYSTALS], [2, 24, WARP_24H_CRYSTALS]] as const) {
      buys[i].addEventListener("click", () => {
        if (s.crystals < price) { this.short(price); return; }
        tick(s);
        const n = timeWarp(s, h);
        if (!n) return;
        this.host.sound.purchase(); fireworks(3, () => this.host.sound.firework());
        toast(t("Time warp! +{n} coins", { n: coins(n) }));
        this.done();
      });
    }
  }

  private renderEra(): void {
    const s = this.save, g = eraGems(s);
    $("ty-era-card").innerHTML = `<span class="ty-gem">${iconSvg("gem")}</span>
      <span><b>${esc(t("{n} Sky Gems", { n: fmt(s.tycoon.gems) }))}</b><small>${esc(t("Each gem adds 2% to all earnings, for good. Start a New Era to collect the gems your coins have earned."))}</small></span>
      <button type="button" class="buy era-go"${g > 0 ? "" : " disabled"}>${g > 0 ? esc(t("New Era: +{n}", { n: fmt(g) })) : esc(t("Keep earning"))}</button>`;
    $("ty-era-card").querySelector(".era-go")!.addEventListener("click", e => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = t("Tap again to reset businesses"); return; }
      const got = newEra(s);
      if (!got) return;
      this.host.sound.purchase(); confetti(); fireworks(5, () => this.host.sound.firework());
      toast(t("A New Era begins! +{n} Sky Gems", { n: fmt(got) }));
      this.done();
    });
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

  /** The home screen card: coins counting up, earnings a second. */
  renderHome(show: boolean): void {
    const card = $("tycoon-card"), tile = $("tycoon-btn");
    card.hidden = tile.hidden = !show;
    if (!show) return;
    $("tc-coins").textContent = coins(this.save.tycoon.coins);
    $("tc-floors").textContent = t("{used} of {total} office floors", { used: fmt(usedFloors(this.save)), total: fmt(officeFloors(this.save)) });
    const r = perSecond(this.save);
    $("tc-rate").textContent = r > 0 ? t("+{n} a second", { n: coins(r) }) : t("Tap to run your businesses");
    // A dot when something can be bought.
    const any = BUSINESSES.some((b, i) => unlockedBusiness(this.save, i) && costOf(b, levelOf(this.save, b.id), 1) <= this.save.tycoon.coins);
    tile.querySelector<HTMLElement>(".dot")!.hidden = !any;
    card.classList.toggle("can-buy", any);
  }

  private homeTick(): void {
    if ($("tycoon-card").hidden || !$("tycoon").hidden) return;
    tick(this.save);
    this.renderHome(true);
  }

  /** At launch: what the managers earned while the game was closed. */
  welcome(earned: number, awayMs: number): void {
    if (earned <= 0 || awayMs < 120e3) return;
    $("welcome-face").innerHTML = mayorSvg("happy");
    $("welcome-amount").textContent = coins(earned);
    $("welcome-text").textContent = t("Your managers kept Skyhaven busy for {time}.", { time: fmtAway(awayMs) });
    const x3 = $<HTMLButtonElement>("welcome-x3"), price = 30;
    x3.textContent = t("Triple it · 💎 {n}", { n: price });
    x3.onclick = () => {
      if (this.save.crystals < price) { toast(t("You need {n} more Sky Crystals", { n: price - this.save.crystals })); return; }
      this.save.crystals -= price;
      this.save.tycoon.coins += earned * 2;
      this.save.tycoon.lifetime += earned * 2;
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
const SHIRTS = ["#4f8bff", "#ff6fa0", "#5ee0a0", "#ffb13b", "#b48cff", "#ff8a5c"];
/** A little office worker (shirt color from --shirt). */
const PERSON = `<svg viewBox="0 0 20 34"><circle cx="10" cy="7" r="5" fill="#f6c49e"/><path d="M6 5q4-5 8 0" fill="#5a3a22"/><path d="M3 32v-12q0-6 7-6t7 6v12z" fill="var(--shirt)"/><rect x="5" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/><rect x="11" y="31" width="4" height="3" rx="1" fill="#2a1f3e"/></svg>`;
/** The manager: a suit and a red tie. */
const PERSON_BOSS = `<svg viewBox="0 0 20 34"><circle cx="10" cy="7" r="5" fill="#f2c39a"/><path d="M5 6q5-6 10 0v-2q-5-4-10 0z" fill="#3a3a4a"/><path d="M3 32v-12q0-6 7-6t7 6v12z" fill="#2a3590"/><path d="M10 14l-2 3 2 9 2-9z" fill="#e8334f"/><path d="M8 14h4l-2 2z" fill="#fff"/></svg>`;

function popCoin(box: Element, text: string): void {
  const el = document.createElement("span");
  el.className = "coin-pop";
  el.innerHTML = `${COIN_SVG}+${text}`;
  el.style.left = `${20 + Math.random() * 50}%`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

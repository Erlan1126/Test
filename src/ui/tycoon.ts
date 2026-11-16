// The Tycoon screens: the business list (tap to run, buy levels, hire managers), boosts,
// the New Era, the live card on the home screen and the "while you were away" welcome.
import { ADVISORS, BOOM_MULT, CRATE_CRYSTALS, FESTIVAL_MULT, UPGRADES, VAULT_HOURS, type Advisor, BUSINESSES, coins, RUSH_MULT, STAGE_LABEL, COIN_BOOST_CRYSTALS, SPEEDUPS_PER_DAY } from "../data/tycoon";
import { t, tn } from "../i18n";
import { fmt } from "../core/util";
import type { SaveData } from "../logic/save";
import {
  affordable, buyBoost, buyLevels, costOf, cycleOf, eraGems, freeFloors, hireManager, levelOf, multiplier, newEra, nextMilestone, officeFloors, usedFloors,
  payOf, perSecond, progressOf, runOnce, rushOn, speedupsLeft, dealGoals, goalStep, offlineHours, GOAL_STARS, GOAL_TIERS, GOALS_BONUS_CRYSTALS, type GoalType, warpPrice, doublePrice, doubleAway, stageName, stageNow, readyStage, hqFloors, nextStage, startRush, upgradesOnOffer, buyUpgrade, openCrate, vaultCost, buyVault, festivalBiz, vipRate, review, tick, timeWarp, unlockedBusiness, vipTip,
} from "../logic/tycoon";
import type { Sound } from "../sound";
import { $, closeModal, esc, openModal, toast, vibrate, wireModal } from "./dom";
import { burst, confetti, fireworks } from "./fx";
import { iconSvg } from "./icons";
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
  /** The home screen is showing (not a tower). */
  onMenu(): boolean;
}

/** A gold coin with a star, for counters. */
export const COIN_SVG = `<svg viewBox="0 0 24 24"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.5" stop-color="#ffc93c"/><stop offset="1" stop-color="#d8901a"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#cg)" stroke="#b8740c" stroke-width="1.2"/><circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/><path d="M12 7.2l1.4 2.9 3.2.4-2.3 2.2.6 3.2-2.9-1.6-2.9 1.6.6-3.2-2.3-2.2 3.2-.4z" fill="#fff8d6"/></svg>`;

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
  /** Each section's last HTML: a section is only rebuilt when it really changes, so
   *  animations keep running and a tap never lands on a button that just got replaced. */
  private html = new Map<HTMLElement, string>();
  /** A VIP customer waiting in a room to be tapped, and when the next ones come. */
  private vip = { id: "", until: 0 };
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
    wireModal($("tycoon"));
    // The coin's gold gradient, defined once where it's always drawable (a gradient inside
    // a hidden element can't be used by the coins elsewhere on the page).
    document.body.insertAdjacentHTML("afterbegin", `<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.5" stop-color="#ffc93c"/><stop offset="1" stop-color="#d8901a"/></linearGradient></defs></svg>`);
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
    this.tab = tab;
    $("tycoon").querySelectorAll<HTMLElement>(".ty-tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $("tycoon").querySelectorAll<HTMLElement>(".ty-panel").forEach(p => { p.hidden = p.dataset.panel !== tab; });
    $("tycoon").querySelector<HTMLElement>(".sheet")!.scrollTo({ top: 0 });
    this.render();
  }

  open(): void {
    this.host.sound.click();
    tick(this.save);
    this.eraArmed = false;
    this.render();
    openModal($("tycoon"));
    // While learning, start at the coffee cart (it's at the foot of the tower).
    if (this.save.tycoon.tips < 3 && this.tab === "company") requestAnimationFrame(() => $("ty-list").querySelector(".ty-coach")?.scrollIntoView({ block: "start" }));
    const now = Date.now();
    this.nextVip = Math.max(this.nextVip, now + 6000);
    this.nextRush = Math.max(this.nextRush, now + 35000);
    this.nextCritic = Math.max(this.nextCritic, now + 70000);
    this.nextPower = Math.max(this.nextPower, now + 50000);
    cancelAnimationFrame(this.loop);
    const frame = () => {
      if ($("tycoon").hidden) { this.host.persist(); return; }
      this.live();
      this.loop = requestAnimationFrame(frame);
    };
    this.loop = requestAnimationFrame(frame);
  }

  /** Every frame while the sheet is open: earnings, the rolling counter, progress bars and
   *  coins popping out of the rooms. */
  private live(): void {
    const now = Date.now(), s = this.save;
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
    for (const row of $("ty-list").querySelectorAll<HTMLElement>(".ty-biz[data-id]")) {
      const id = row.dataset.id!, p = progressOf(s, id, now);
      // A finished cycle pops a coin out of the room and sends one flying to the counter.
      const was = this.lastP.get(id) ?? 0, running = !!s.tycoon.runs[id];
      if ((p < was - 0.05 || (was > 0.6 && !running)) && now - (this.lastPop.get(id) ?? 0) > 450) {
        this.lastPop.set(id, now);
        const b = BUSINESSES.find(x => x.id === id)!;
        popCoin(row.querySelector(".room-pops")!, coins(payOf(s, b, now) * Math.max(1, Math.round(450 / (cycleOf(b, levelOf(s, id)) * 1000)))));
        if (this.tab === "company") flyCoin(row.querySelector(".room-scene")!);
      }
      this.lastP.set(id, p);
      (row.querySelector(".ty-prog i") as HTMLElement).style.width = `${p * 100}%`;
    }
    this.events(now);
    // Prices, labels and buttons follow the coins a few times a second.
    if (now - this.lastSoft > 300) { this.lastSoft = now; this.render(); }
  }

  /** Live moments while the tower is open: VIPs, critics, power cuts and rush hours. */
  private events(now: number): void {
    const s = this.save, owned = BUSINESSES.filter(b => levelOf(s, b.id) > 0);
    if (!owned.length) return;
    const pick = () => owned[Math.floor(Math.random() * owned.length)];
    if (this.vip.id && this.vip.until < now) { this.vip.id = ""; this.render(); }
    if (!this.vip.id && now > this.nextVip) {
      this.vip = { id: pick().id, until: now + 9000 };
      this.vipFresh = true;
      this.nextVip = now + (22000 + Math.random() * 20000) / vipRate(s);
      this.render();
    }
    if (this.critic.id && this.critic.until < now) { this.critic.id = ""; this.render(); }
    if (!this.critic.id && now > this.nextCritic) {
      this.critic = { id: pick().id, until: now + 12000 };
      this.nextCritic = now + 150000 + Math.random() * 110000;
      this.render();
    }
    if (this.power.id && this.power.until < now) { this.power.id = ""; this.render(); }
    if (!this.power.id && now > this.nextPower) {
      this.power = { id: pick().id, until: now + 15000, taps: 5 };
      this.nextPower = now + 120000 + Math.random() * 80000;
      this.render();
    }
    if (now > this.nextRush) {
      this.nextRush = now + 100000 + Math.random() * 60000;
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
    $("ty-rate").textContent = t("{n} a second", { n: coins(perSecond(s, now)) });
    $("ty-mult").textContent = t("×{n} earnings", { n: multiplier(s, now).toFixed(2) });
    this.renderOffice();
    this.renderEvents(now);
    this.renderTabs();
    if (this.tab === "company") { this.renderRooms(now); this.renderGoals(); }
    else if (this.tab === "upgrades") this.renderUpgrades();
    else if (this.tab === "team") this.renderAdvisors();
    else { this.renderBoosts(); this.renderEra(); }
  }

  /** Dots on the tabs where something can be done. */
  private renderTabs(): void {
    const s = this.save, dot = (tab: string, on: boolean) => { $("tycoon").querySelector<HTMLElement>(`.ty-tabs [data-tab="${tab}"] .dot`)!.hidden = !on || this.tab === tab; };
    dot("upgrades", upgradesOnOffer(s).some(u => u.cost <= s.tycoon.coins));
    dot("team", s.crystals >= CRATE_CRYSTALS && ADVISORS.some(a => !s.tycoon.advisors.includes(a.id)));
    dot("boosts", eraGems(s) > 0 || (vaultCost(s) !== undefined && s.tycoon.coins >= vaultCost(s)!));
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
      set(row.querySelector(".room-level"), tn(lv, "{n} floor", "{n} floors", { n: fmt(lv) }));
      set(row.querySelector(".ty-prog span"), owned ? coins(payOf(s, b, now)) : t("Opens with {n}", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".room-info"), owned
        ? (ns && ns <= (next ?? Infinity) ? t("Grows into {name} at {n}", { name: t(stageName(b.id, stageNow(s, b.id) + 1)), n: ns })
          : next ? t("{n} floors: twice as fast", { n: next }) : t("Top speed!")) + " · " + fmtSec(cycleOf(b, lv))
        : t("Open it to earn {n} a cycle", { n: coins(b.income * multiplier(s, now)) }));
      set(row.querySelector(".power-cut small"), t("Tap {n} times to fix", { n: this.power.taps }));
      const hire = row.querySelector<HTMLButtonElement>(".ty-hire");
      if (hire) { set(hire, `${esc(t("Hire manager"))} · ${esc(coins(b.manager))}`, true); hire.disabled = ty.coins < b.manager; }
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
    const s = this.save, b = BUSINESSES.find(x => x.id === row.dataset.biz)!, act = el.dataset.act;
    const name = t(stageName(b.id, stageNow(s, b.id)));
    if (act !== "run") e.stopPropagation();
    switch (act) {
      case "run": {
        if (levelOf(s, b.id) === 0) return;
        ripple(el, e as MouseEvent);
        if (runOnce(s, b.id)) {
          this.host.sound.click(); vibrate(s.settings.vibrate, 8);
          this.goal("taps");
          if (s.tycoon.tips === 0) s.tycoon.tips = 1;
          this.render();
        }
        return;
      }
      case "hq":
        this.host.sound.click();
        closeModal($("tycoon"));
        this.host.buildHQ(b.id);
        return;
      case "vip": {
        el.remove();
        if (this.vip.id !== b.id || this.vip.until < Date.now()) return;
        this.vip.id = "";
        const tip = vipTip(s, b.id);
        const box = row.querySelector(".room-pops")!;
        for (let k = 0; k < 6; k++) setTimeout(() => popCoin(box, k === 0 ? coins(tip) : ""), k * 90);
        for (let k = 0; k < 4; k++) setTimeout(() => flyCoin(row.querySelector(".room-scene")!), k * 70);
        this.host.sound.coins();
        vibrate(s.settings.vibrate, 15);
        toast(t("A VIP tipped {n} coins!", { n: coins(tip) }));
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
        const box = row.querySelector(".room-pops")!;
        for (let k = 0; k < 5; k++) setTimeout(() => popCoin(box, k === 0 ? coins(got) : ""), k * 90);
        this.host.sound.coins();
        toast(t("Lights back on! The customers stayed: +{n} coins", { n: coins(got) }));
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
        if (el.classList.contains("need-floors")) { toast(t("Every office floor is full. Build a tower to add more!")); closeModal($("tycoon")); this.host.buildFloors(); return; }
        tick(s);
        const lv = levelOf(s, b.id), owned = lv > 0, wasReady = !!readyStage(s, b.id);
        const got = buyLevels(s, b.id, this.amount);
        if (!got) { this.host.sound.click(); return; }
        this.goal("buy", got);
        if (s.tycoon.tips === 1) s.tycoon.tips = 2;
        const crossed = nextMilestone(lv) !== undefined && lv + got >= (nextMilestone(lv) ?? Infinity);
        this.host.sound.coins();
        burst(el, crossed ? 20 : 8);
        row.querySelector(".room-scene")?.classList.remove("bump");
        void (row.querySelector(".room-scene") as HTMLElement | null)?.offsetWidth;
        row.querySelector(".room-scene")?.classList.add("bump");
        if (owned && readyStage(s, b.id) && !wasReady) {
          toast(t("{name} is ready to grow! Build its new HQ", { name }));
          fireworks(1, () => this.host.sound.firework());
        }
        if (!owned) { toast(t("{name} is open!", { name: t(b.name) })); confetti(row); }
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
    const chips = [`<span class="ty-chip fest">🎪 ${esc(t("Festival week: {name} ×{n}", { name: t(stageName(f.id, stageNow(s, f.id))), n: FESTIVAL_MULT }))}</span>`];
    if (s.tycoon.boom > now) {
      const left = Math.ceil((s.tycoon.boom - now) / 1000);
      chips.unshift(`<span class="ty-chip boom">🏗️ ${esc(t("Construction boom ×{n} · {t}", { n: BOOM_MULT, t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }))}</span>`);
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

  /** The advisor collection, and a crate to open for crystals. */
  private renderAdvisors(): void {
    const s = this.save, have = s.tycoon.advisors, left = ADVISORS.length - have.length;
    this.put($("ty-advisors"), `<div class="ty-adv-head"><b>${esc(t("{n} of {total} collected", { n: have.length, total: ADVISORS.length }))}</b><i class="ty-adv-meter"><i style="width:${(have.length / ADVISORS.length) * 100}%"></i></i></div>
      <div class="ty-adv-grid">${ADVISORS.map(a => {
        const own = have.includes(a.id);
        return `<div class="ty-adv${own ? "" : " locked"}" style="--o:${a.look.outfit}"><span class="ty-adv-face">${advisorSvg(a, own)}</span><b>${esc(own ? t(a.name) : "?")}</b><small>${esc(own ? perkText(a) : t(a.title))}</small></div>`;
      }).join("")}</div>
      ${left ? `<button type="button" class="ty-crate"><span class="crate-art" aria-hidden="true"></span><span><b>${esc(t("Advisor crate"))}</b><small>${esc(t("A new advisor you don't have yet"))}</small></span><em>💎 ${CRATE_CRYSTALS}</em></button>` : ""}
      <p class="sheet-note">${esc(t("Finish all of today's goals to get a new advisor for free."))}</p>`);
  }

  private onAdvisorClick(e: Event): void {
    if (!(e.target as Element).closest(".ty-crate")) return;
    const s = this.save;
    if (s.crystals < CRATE_CRYSTALS) { this.short(CRATE_CRYSTALS); return; }
    const a = openCrate(s);
    if (!a) return;
    this.host.persist();
    this.host.refresh();
    this.showAdvisor(a, t("Advisor crate"));
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
      : t("Save {n} coins to hire a manager. Managers sell for you, even while you're away!", { n: coins(b.manager) });
    return `<div class="ty-coach"><span class="ty-coach-face">${COACH_FACE}</span><p><small>${esc(t("First steps · {n} of 3", { n: ty.tips + 1 }))}</small>${esc(text)}</p></div>`;
  }

  /** Counts toward today's goals and celebrates any that are done. */
  private goal(kind: GoalType, by = 1): void {
    const r = goalStep(this.save, kind, by);
    if (r.stars) { toast(t("Goal done! +{n} ★", { n: r.stars })); this.host.sound.unlock(); }
    if (r.crystals) { toast(t("All of today's goals done! +{n} Sky Crystals", { n: r.crystals })); fireworks(3, () => this.host.sound.firework()); }
    if (r.advisor) this.showAdvisor(r.advisor, t("All of today's goals done!"));
    if (r.stars || r.crystals || r.advisor) { this.host.persist(); this.host.refresh(); }
  }

  private renderGoals(): void {
    const s = this.save;
    dealGoals(s);
    const g = s.tycoon.goals;
    const text = (k: GoalType, n: number) => k === "vip" ? t("Serve {n} VIP customers", { n }) : k === "buy" ? t("Buy {n} business levels", { n })
      : k === "taps" ? t("Run a business by hand {n} times", { n }) : t("Catch {n} rush hours", { n });
    const icon: Record<GoalType, string> = { vip: "crown", buy: "building", taps: "sparkle", rush: "bolt" };
    this.put($("ty-goals"), g.list.map(x => {
      const done = x.p >= x.n, stars = GOAL_STARS[Math.max(0, GOAL_TIERS[x.t].indexOf(x.n))];
      return `<div class="ty-goal${done ? " done" : ""}"><span class="ty-goal-check">${done ? "✓" : iconSvg(icon[x.t])}</span><span><b>${esc(text(x.t, x.n))}</b>
        <i class="ty-goal-bar"><i style="width:${Math.min(100, (x.p / x.n) * 100)}%"></i></i></span><em>${done ? esc(t("Done")) : `${x.p}/${x.n}`}<small>+${stars} ★</small></em></div>`;
    }).join("") + `<p class="ty-goal-bonus${g.bonus ? " done" : ""}">${esc(g.bonus ? t("Bonus collected! New goals tomorrow.") : (ADVISORS.some(a => !s.tycoon.advisors.includes(a.id)) ? t("Finish all three for a new advisor") : t("Finish all three for +{n} Sky Crystals", { n: GOALS_BONUS_CRYSTALS })))}</p>`);
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
    $("ty-floors").textContent = `${fmt(used)} / ${fmt(total)}`;
    $("ty-fbar").style.width = `${Math.min(100, (used / total) * 100)}%`;
    $("ty-build").classList.toggle("urgent", freeFloors(s) === 0);
  }

  private renderBoosts(): void {
    const s = this.save, ty = s.tycoon, rate = perSecond(s, Date.now(), false);
    const card = (act: string, icon: string, title: string, text: string, price: string, disabled: boolean) =>
      `<div class="ty-boost"><span class="ty-bico">${iconSvg(icon)}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span><button type="button" class="buy" data-boost="${act}"${disabled ? " disabled" : ""}>${price}</button></div>`;
    const left = speedupsLeft(s);
    const warp = (act: string, icon: string, h: 1 | 8, title: string) => card(act, icon, title,
      rate <= 0 ? t("Hire a manager first") : left <= 0 ? t("No more speed-ups today. Come back tomorrow!") : t("Get {n} right now", { n: coins(rate * h * 3600) }),
      `💎 ${warpPrice(h)}`, rate <= 0 || left <= 0);
    this.put($("ty-boosts"),
      card("boost", "bolt", t("Coin booster ×2"), ty.boost ? t("Active forever. Every coin counts twice") : t("Double every coin you earn, forever"), ty.boost ? esc(t("✓ Owned")) : `💎 ${fmt(COIN_BOOST_CRYSTALS)}`, ty.boost)
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
      this.host.sound.purchase(); confetti(); toast(t("Coin booster on: every coin counts twice!"));
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
      toast(t("Time warp! +{n} coins", { n: coins(n) }));
    }
    this.done();
  }

  private renderEra(): void {
    const s = this.save, g = eraGems(s);
    this.put($("ty-era-card"), `<span class="ty-gem">${iconSvg("gem")}</span>
      <span><b>${esc(t("{n} Sky Gems", { n: fmt(s.tycoon.gems) }))}</b><small>${esc(t("Each gem adds 2% to all earnings, for good. Start a New Era to collect the gems your coins have earned."))}</small></span>
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
function flyCoin(from: Element): void {
  const to = document.getElementById("ty-coins");
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

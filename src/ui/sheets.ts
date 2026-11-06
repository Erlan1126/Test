// The pop-up sheets: skins, star shop, challenges, profile, settings and the daily gift.
import { formatRecoveryCode } from "../online";
import { fmt } from "../core/util";
import { getLang, t, tn } from "../i18n";
import { CHALLENGES } from "../data/challenges";
import { MILESTONES } from "../data/constants";
import { ISLAND_THEMES } from "../data/islands";
import { BOOSTS, MAX_BOOSTS } from "../data/shop";
import { SKINS, type Skin } from "../data/skins";
import { TROPHIES } from "../data/trophies";
import { isOpen, markSeen, type Feature } from "../logic/features";
import { addStars, awardStandingTrophies, challengeOpen, currentTheme, isSkinUnlocked, skinUnlockText, themeUnlocked, unlockedSkinCount } from "../logic/progress";
import { dayKey, giftAmount, giftState, GIFTS, xpNeeded } from "../logic/rules";
import { exportCode, importCode, type SaveData } from "../logic/save";
import { buyBoost, buySkin } from "../logic/shop";
import { itemPrice, ownsProduct } from "../logic/premium";
import { CRYSTAL_PACKS, formatPrice, PRODUCTS, type CrystalPack, type Product } from "../data/premium";
import type { PaymentProvider } from "../payments";
import { drawSkinPreview, drawThemePreview } from "../render/previews";
import type { Sound } from "../sound";
import { $, closeModal, esc, showTab, LOCK_ICON, openModal, replay, toast, TROPHY_ICON, vibrate, wireModal } from "./dom";

export interface Host {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  /** Redraws the menu or game-over screen after something changed. */
  refresh(): void;
  startChallenge(id: string): void;
  /** Swaps in progress loaded from a save code. */
  replaceSave(save: SaveData): void;
  /** The cloud backup's recovery code: null when there's no server, "" until it's made. */
  cloudCode(): string | null;
  /** Brings back a player from their recovery code. */
  restoreCloud(code: string): Promise<"ok" | "bad" | "offline" | "empty">;
  /** Graphics quality changed. */
  applyQuality(): void;
  /** The language setting changed. */
  applyLang(): void;
  replayTips(): void;
  /** How premium items are paid for here, or null when they can't be bought on this page. */
  readonly payments: PaymentProvider | null;
  /** Starts a premium purchase. */
  /** Buys a crystal pack with real money. */
  buyPack(pack: CrystalPack): Promise<void>;
  /** Spends crystals on a premium item. */
  buyItem(product: Product): void;
}

const isShopSkin = (s: Skin) => !!s.unlock && "price" in s.unlock;
const priceOf = (s: Skin) => (s.unlock && "price" in s.unlock ? s.unlock.price : 0);

export class Sheets {
  private loadArmed = false;

  constructor(private readonly host: Host) {
    for (const id of ["skins", "shop", "challenges", "profile"]) wireModal($(id));
    wireModal($("settings"), () => this.closeSettings());
    this.wireSettings();
  }

  /** Redraws the shop if it's open (the store's prices arrive a moment after start). */
  refreshShop(): void {
    if (!$("shop").hidden) this.renderShop();
  }

  private get save(): SaveData { return this.host.save; }

  /** Redraws whichever of these sheets is open (after the language changes). */
  rerenderOpen(): void {
    if (!$("skins").hidden) this.renderSkins();
    if (!$("shop").hidden) this.renderShop();
    if (!$("challenges").hidden) this.renderChallenges();
    if (!$("profile").hidden) this.renderProfile();
    if (!$("settings").hidden) { this.renderSettings(); this.resetLabels(); }
  }

  private seen(f: Feature): void {
    markSeen(this.save, f);
    this.host.persist();
  }

  private click(): void {
    this.host.sound.ensure();
    this.host.sound.click();
  }

  private nope(b: HTMLElement, msg: string): void {
    this.host.sound.click();
    toast(msg);
    replay(b, "nope");
  }

  // ---------- Skins ----------

  openSkins(): void {
    this.click();
    this.seen("skins");
    this.renderSkins();
    openModal($("skins"));
  }

  private renderSkins(): void {
    const save = this.save, count = unlockedSkinCount(save);
    $("skins-count").textContent = t("{n} of {total} tower skins unlocked", { n: count, total: SKINS.length });
    const grid = $("skin-grid");
    grid.innerHTML = "";
    for (const st of SKINS) {
      const open = isSkinUnlocked(save, st), on = save.skin === st.id;
      const premium = !!st.unlock && "product" in st.unlock;
      const pass = !!st.unlock && "pass" in st.unlock;
      const name = t(st.name);
      const b = this.skinCard(st, open, on, on ? esc(t("Equipped")) : open ? esc(t("Tap to use")) : isShopSkin(st) ? `<span class="price">${esc(t("{n} ★ in the shop", { n: priceOf(st) }))}</span>`
        : premium ? `<span class="premium-tag">💎 ${esc(t("Crystals"))}</span>`
        : pass ? `<span class="premium-tag">Sky Pass</span>`
        : st.unlock && "streak" in st.unlock ? esc(t("🔥 {n}-day streak", { n: st.unlock.streak })) : esc(t("Over {n} m", { n: MILESTONES[(st.unlock as { at: number }).at].m })));
      b.setAttribute("aria-label", open ? (on ? t("{name}, equipped", { name }) : name) : t("{name}, locked. {how}", { name, how: skinUnlockText(st) }));
      b.addEventListener("click", () => {
        if (!open) {
          if (premium) { closeModal($("skins")); this.openShop("crystals"); return; }
          if (isShopSkin(st) && isOpen(save, "shop")) { closeModal($("skins")); this.openShop("skins"); return; }
          this.nope(b, t("{how} to unlock {name}.", { how: skinUnlockText(st), name }));
          return;
        }
        save.skin = st.id;
        this.host.persist();
        this.click();
        closeModal($("skins"));
        this.host.refresh();
      });
      grid.appendChild(b);
    }
    const themes = $("theme-grid");
    themes.innerHTML = "";
    const theme = currentTheme(save);
    for (const th of ISLAND_THEMES) {
      const open = themeUnlocked(save, th), on = theme.id === th.id;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `skin${open ? "" : " locked"}${on ? " equipped" : ""}`;
      const name = t(th.name);
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="skin-name">${esc(name)}</span>
        <span class="skin-sub">${on ? esc(t("Equipped")) : open ? esc(t("Tap to use")) : th.product ? `<span class="premium-tag">💎 ${esc(t("Crystals"))}</span>` : esc(t("Builder level {n}", { n: th.level }))}</span>${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
      b.setAttribute("aria-label", open ? (on ? t("{name} island, equipped", { name }) : t("{name} island", { name })) : th.product ? t("{name} island, premium", { name }) : t("{name} island, locked. Reach builder level {n}", { name, n: th.level }));
      drawThemePreview(b.querySelector("canvas")!, th);
      b.addEventListener("click", () => {
        if (!open && th.product) { closeModal($("skins")); this.openShop("crystals"); return; }
        if (!open) { this.nope(b, t("Reach builder level {n} to unlock the {name} island.", { n: th.level, name })); return; }
        save.island = th.id;
        this.host.persist();
        this.click();
        closeModal($("skins"));
        this.host.refresh();
      });
      themes.appendChild(b);
    }
  }

  private skinCard(st: Skin, open: boolean, on: boolean, sub: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `skin${open ? "" : " locked"}${on ? " equipped" : ""}`;
    b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="skin-name">${esc(t(st.name))}</span><span class="skin-sub">${sub}</span>
      ${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
    drawSkinPreview(b.querySelector("canvas")!, st);
    return b;
  }

  // ---------- Star shop ----------

  openShop(tab?: "boosts" | "skins" | "crystals"): void {
    this.click();
    this.seen("shop");
    this.renderShop();
    if (tab) showTab($("shop"), tab);
    openModal($("shop"));
  }

  /** Sky Crystal packs (real money) and premium items (bought with crystals). */
  private renderCrystals(): void {
    const save = this.save, pay = this.host.payments;
    $("crystal-balance").textContent = fmt(save.crystals);
    const note = $("premium-note");
    note.textContent = !pay ? t("Crystal packs are coming soon. You can still earn crystals from levels and the Sky Pass.")
      : pay.live ? t("Everything here is cosmetic: it never helps you score.")
      : t("Test mode: packs are added instantly and nothing is charged.");
    note.classList.toggle("test", !!pay && !pay.live);

    const packs = $("pack-list");
    packs.innerHTML = "";
    for (const pk of CRYSTAL_PACKS) {
      const price = pay?.price?.(pk) ?? formatPrice(pk.cents);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `pack-card${pk.best || pk.value ? " best" : ""}`;
      card.disabled = !pay;
      card.innerHTML = `${pk.best ? `<span class="best-value">${esc(t("Most popular"))}</span>` : pk.value ? `<span class="best-value">${esc(t("Best value"))}</span>` : ""}
        <span class="pack-gems" aria-hidden="true">${"💎".repeat(Math.min(3, 1 + CRYSTAL_PACKS.indexOf(pk) / 2 | 0))}</span>
        <b>${fmt(pk.crystals)}</b>${pk.bonus ? `<small class="bonus">${esc(t("{n} bonus", { n: pk.bonus }))}</small>` : "<small>&nbsp;</small>"}
        <span class="buy">${pay ? esc(price) : esc(t("Soon"))}</span>`;
      card.setAttribute("aria-label", pay ? t("Buy {n} Sky Crystals for {price}", { n: pk.crystals, price }) : t("{n} Sky Crystals, coming soon", { n: pk.crystals }));
      card.addEventListener("click", async () => {
        card.disabled = true;
        await this.host.buyPack(pk);
        card.disabled = false;
      });
      packs.appendChild(card);
    }

    const list = $("premium-list");
    list.innerHTML = "";
    for (const p of PRODUCTS) {
      const owned = ownsProduct(save, p.id), price = itemPrice(save, p.id);
      const card = document.createElement("div");
      card.className = `premium-card${p.kind === "bundle" ? " bundle" : ""}${owned ? " owned" : ""}`;
      card.innerHTML = `<canvas aria-hidden="true"></canvas>
        ${p.kind === "bundle" ? `<span class="best-value">${esc(t("Best value"))}</span>` : ""}
        <b>${esc(t(p.name))}</b><small>${esc(t(p.text))}</small>
        <button type="button" class="buy">${owned ? esc(t("✓ Owned")) : `💎 ${fmt(price)}`}</button>`;
      const cv = card.querySelector("canvas")!;
      const skinId = p.grants.skins?.[0], themeId = p.grants.themes?.[0];
      if (p.kind === "island" && themeId) drawThemePreview(cv, ISLAND_THEMES.find(t => t.id === themeId)!);
      else if (skinId) drawSkinPreview(cv, SKINS.find(s => s.id === (p.kind === "bundle" ? "cyber" : skinId))!);
      const btn = card.querySelector<HTMLButtonElement>(".buy")!;
      btn.disabled = owned;
      btn.setAttribute("aria-label", owned ? t("{name}, owned", { name: t(p.name) }) : t("Buy {name} for {n} Sky Crystals", { name: t(p.name), n: price }));
      btn.addEventListener("click", () => {
        if (save.crystals < price) {
          this.nope(btn, t("You need {n} more 💎. Get a crystal pack above.", { n: fmt(price - save.crystals) }));
          return;
        }
        this.host.buyItem(p);
        this.renderShop();
      });
      list.appendChild(card);
    }
  }

  private renderShop(): void {
    const save = this.save;
    this.renderCrystals();
    $("shop-balance").textContent = t("You have {stars} ★ · {crystals} 💎", { stars: save.stars, crystals: fmt(save.crystals) });
    const list = $("boost-list");
    list.innerHTML = "";
    for (const bo of BOOSTS) {
      const have = save.boosts[bo.id];
      const row = document.createElement("div");
      row.className = "shop-item";
      const full = have >= MAX_BOOSTS, poor = save.stars < bo.price;
      row.innerHTML = `<b>${esc(t(bo.name))}</b>
        <button type="button" class="buy"${full ? " disabled" : ""}>${full ? esc(t("Full")) : `${bo.price} ★`}</button>
        <small>${esc(t(bo.text))}</small>${have ? `<span class="owned">${esc(t("You have {n}", { n: have }))}</span>` : ""}`;
      const btn = row.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", t("Buy {name} for {n} stars", { name: t(bo.name), n: bo.price }));
      btn.addEventListener("click", () => {
        if (poor) { this.nope(btn, t("You need {n} more ★. Finish missions and claim daily gifts to earn more.", { n: bo.price - save.stars })); return; }
        if (buyBoost(save, bo.id) === "ok") this.bought(t("{name} ready for your next Classic tower", { name: t(bo.name) }));
      });
      list.appendChild(row);
    }
    const grid = $("shop-skins");
    grid.innerHTML = "";
    for (const st of SKINS.filter(isShopSkin)) {
      const owned = isSkinUnlocked(save, st), price = priceOf(st), on = save.skin === st.id;
      const name = t(st.name);
      const b = this.skinCard(st, true, on, owned ? esc(on ? t("Equipped") : t("Owned · tap to use")) : `<span class="price">${price} ★</span>`);
      b.setAttribute("aria-label", owned ? t("{name}, owned", { name }) : t("Buy {name} for {n} stars", { name, n: price }));
      b.addEventListener("click", () => {
        if (owned) {
          save.skin = st.id;
          this.host.persist();
          this.click();
          this.renderShop();
          this.host.refresh();
          return;
        }
        if (save.stars < price) { this.nope(b, t("You need {n} more ★ for {name}.", { n: price - save.stars, name })); return; }
        if (buySkin(save, st.id) === "ok") {
          save.skin = st.id;
          const won = awardStandingTrophies(save);
          this.bought(t("{name} is yours!", { name }) + (won.length ? " " + tn(won.length, "Trophy: {names}", "Trophies: {names}", { names: won.join(", ") }) : ""));
        }
      });
      grid.appendChild(b);
    }
  }

  private bought(msg: string): void {
    this.host.persist();
    this.host.sound.coins();
    vibrate(this.save.settings.vibrate, 20);
    toast(msg);
    this.renderShop();
    $("shop").querySelector<HTMLElement>(".close-btn")?.focus();
    this.host.refresh();
  }

  // ---------- Challenges ----------

  openChallenges(): void {
    this.click();
    this.seen("challenges");
    this.renderChallenges();
    openModal($("challenges"));
  }

  private renderChallenges(): void {
    const save = this.save, done = save.challenges.length;
    $("challenges-count").textContent = t("{n} of {total} complete", { n: done, total: CHALLENGES.length });
    $("challenges-bar").style.width = `${done / CHALLENGES.length * 100}%`;
    const list = $("challenge-list");
    list.innerHTML = "";
    for (const c of CHALLENGES) {
      const won = save.challenges.includes(c.id), open = challengeOpen(save, c.id);
      const row = document.createElement("div");
      row.className = `challenge${won ? " done" : ""}${open ? "" : " locked"}`;
      const rules = [
        c.rules.iceEvery && (c.rules.iceEvery === 3 ? t("Every third floor is ice") : t("Every {n}th floor is ice", { n: c.rules.iceEvery })),
        c.rules.windFrom && t("Wind from the start"),
        c.rules.goldChance && t("Lots of penthouses"),
        c.rules.noRewind && t("No rewinds"),
      ].filter(Boolean).join(" · ");
      row.innerHTML = `<b>${esc(t(c.name))}</b>
        <button type="button" class="buy"${open ? "" : " disabled"}>${esc(won ? t("Replay") : open ? t("Play") : t("Locked"))}</button>
        <small>${esc(t(c.text))}</small>
        ${rules ? `<span class="rule">${esc(rules)}</span>` : ""}
        <small>${esc(won ? t("Complete") : t("Reward: {n} ★", { n: c.reward }))}</small>`;
      row.querySelector("button")!.addEventListener("click", () => {
        if (!open) return;
        closeModal($("challenges"));
        this.host.startChallenge(c.id);
      });
      list.appendChild(row);
    }
  }

  // ---------- Profile ----------

  openProfile(): void {
    this.click();
    this.seen("profile");
    this.renderProfile();
    openModal($("profile"));
  }

  private renderProfile(): void {
    const save = this.save, p = save.profile, need = xpNeeded(p.level);
    $("profile-title").textContent = t("Builder level {n}", { n: p.level });
    $("profile-xp").textContent = t("{xp} of {need} XP to level {n}", { xp: fmt(p.xp), need: fmt(need), n: p.level + 1 });
    $("profile-bar").style.width = `${p.xp / need * 100}%`;
    const nextTheme = ISLAND_THEMES.find(t => t.level > p.level);
    $("profile-next").textContent = nextTheme ? t("Level {n} unlocks the {name} island", { n: nextTheme.level, name: t(nextTheme.name) }) : t("Every island theme unlocked");
    const stats: [string | number, string][] = [
      [fmt(save.best), t("best people")], [`${fmt(save.bestMeters)} m`, t("tallest")], [fmt(p.towers), t("towers")],
      [p.bestStreak, t("best streak")], [fmt(p.perfects), t("perfects")], [`${save.challenges.length}/${CHALLENGES.length}`, t("landmarks")],
    ];
    $("profile-stats").innerHTML = stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
    const modeName = { classic: t("Classic"), daily: t("Daily"), challenge: t("Challenge"), zen: t("Zen") };
    $("history").innerHTML = save.history.length
      ? save.history.map((h, i) => `<div class="history-row"><span class="rank">${i + 1}</span>
          <span><b>${fmt(h.score)}</b> <small>${esc(t("people · {m} m", { m: h.meters }))}</small></span>
          <span class="when">${modeName[h.mode]}<br>${esc(this.when(h.day))}</span></div>`).join("")
      : `<p class="history-empty">${esc(t("Your best towers will show up here."))}</p>`;
    $("trophy-title").textContent = t("{n} of {total} won", { n: p.trophies.length, total: TROPHIES.length });
    $("trophy-grid").innerHTML = TROPHIES.map(tr => {
      const won = p.trophies.includes(tr.id);
      return `<div class="trophy${won ? " won" : ""}"><span class="t-ico">${won ? TROPHY_ICON : LOCK_ICON}</span><span><b>${esc(t(tr.name))}</b><small>${esc(t(tr.text))}</small></span></div>`;
    }).join("");
  }

  private when(day: string): string {
    if (day === dayKey(0)) return t("Today");
    if (day === dayKey(-1)) return t("Yesterday");
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d).toLocaleDateString(getLang() === "es" ? "es" : undefined, { month: "short", day: "numeric" });
  }

  // ---------- Settings ----------

  private renderSettings(): void {
    const st = this.save.settings;
    const code = this.host.cloudCode();
    $("cloud").hidden = code === null;
    $("recovery-code").textContent = code ? formatRecoveryCode(code) : t("Made after your first tower online");
    $<HTMLButtonElement>("copy-recovery").disabled = !code;
    $<HTMLInputElement>("set-sound").checked = st.sound;
    $<HTMLInputElement>("set-music").checked = st.music;
    $<HTMLInputElement>("set-vibrate").checked = st.vibrate;
    $("vibrate-row").hidden = !("vibrate" in navigator);
    document.querySelectorAll<HTMLButtonElement>("[data-q]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.q === st.quality)));
    $("quality-note").textContent = st.quality === "auto" && st.autoLow ? t("Smooth mode was picked for this device")
      : st.quality === "low" ? t("Simpler graphics, easier on the battery")
      : st.quality === "high" ? t("Glow and light effects always on (uses more battery)")
      : t("Sharp graphics that adapt to your device");
    document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.lang === st.lang)));
  }

  openSettings(): void {
    this.click();
    this.renderSettings();
    this.resetTransfer();
    openModal($("settings"));
  }

  private closeSettings(): void {
    this.resetTransfer();
    closeModal($("settings"));
  }

  private resetTransfer(): void {
    this.loadArmed = false;
    $<HTMLDetailsElement>("transfer").open = false;
    $<HTMLDetailsElement>("cloud").open = false;
    this.restoreArmed = false;
    this.restoreMsg("", "");
    $("load-code").classList.remove("danger");
    $("restore-btn").classList.remove("danger");
    this.resetLabels();
    $<HTMLTextAreaElement>("code-box").value = "";
    this.codeMsg("", "");
  }

  /** The settings buttons whose labels change while they ask for a second tap. */
  private resetLabels(): void {
    if (!this.loadArmed) $("load-code").textContent = t("Load save code");
    if (!this.restoreArmed) $("restore-btn").textContent = t("Restore my progress");
  }

  private restoreArmed = false;

  private restoreMsg(text: string, kind: "" | "ok" | "bad"): void {
    const el = $("restore-msg");
    el.textContent = text;
    el.className = `transfer-msg${kind ? ` ${kind}` : ""}`;
  }

  private codeMsg(text: string, kind: "" | "ok" | "bad"): void {
    const el = $("code-msg");
    el.textContent = text;
    el.className = `transfer-msg${kind ? ` ${kind}` : ""}`;
  }

  private wireSettings(): void {
    const st = () => this.save.settings;
    $<HTMLInputElement>("set-sound").addEventListener("change", e => {
      st().sound = (e.target as HTMLInputElement).checked;
      this.host.persist();
      this.host.sound.applySettings();
      this.host.sound.click();
    });
    $<HTMLInputElement>("set-music").addEventListener("change", e => {
      st().music = (e.target as HTMLInputElement).checked;
      this.host.persist();
      this.host.sound.ensure();
      this.host.sound.applySettings();
    });
    $<HTMLInputElement>("set-vibrate").addEventListener("change", e => {
      st().vibrate = (e.target as HTMLInputElement).checked;
      this.host.persist();
      vibrate(st().vibrate, 20);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-q]").forEach(b => b.addEventListener("click", () => {
      st().quality = b.dataset.q as "auto" | "high" | "low";
      if (st().quality !== "auto") st().autoLow = false;
      this.host.persist();
      this.renderSettings();
      this.host.applyQuality();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach(b => b.addEventListener("click", () => {
      st().lang = b.dataset.lang as "auto" | "en" | "es";
      this.host.persist();
      this.click();
      this.renderSettings();
      this.host.applyLang();
    }));
    $("replay-tips").addEventListener("click", () => {
      this.host.replayTips();
      toast(t("Tips will show on your next tower"));
    });

    $("copy-recovery").addEventListener("click", async () => {
      const code = this.host.cloudCode();
      if (!code) return;
      try {
        await navigator.clipboard.writeText(formatRecoveryCode(code));
        this.restoreMsg(t("Copied! Keep it somewhere safe, like your notes."), "ok");
      } catch {
        this.restoreMsg(t("Write the code down or take a screenshot."), "ok");
      }
    });
    $("restore-btn").addEventListener("click", async () => {
      const box = $<HTMLInputElement>("restore-box"), btn = $<HTMLButtonElement>("restore-btn");
      const code = box.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length !== 12) { this.restoreMsg(t("Recovery codes have 12 letters and numbers, like ABCD-EFGH-2345."), "bad"); return; }
      if (code === this.host.cloudCode()) { this.restoreMsg(t("That's this device's own code."), "bad"); return; }
      if (!this.restoreArmed) {
        this.restoreArmed = true;
        btn.textContent = t("Tap again to replace this device's progress");
        btn.classList.add("danger");
        return;
      }
      this.restoreArmed = false;
      btn.disabled = true;
      btn.textContent = t("Restoring…");
      const r = await this.host.restoreCloud(code);
      btn.disabled = false;
      btn.textContent = t("Restore my progress");
      btn.classList.remove("danger");
      if (r === "ok") { box.value = ""; this.restoreMsg(t("Welcome back! Your progress is restored."), "ok"); this.host.sound.star(); this.renderSettings(); }
      else if (r === "empty") this.restoreMsg(t("Found your player, but there was no backup yet. Your rankings are back."), "ok");
      else this.restoreMsg(r === "bad" ? t("That code wasn't found. Check it and try again.") : t("Can't reach the server. Check your connection."), "bad");
    });
    $("restore-box").addEventListener("input", () => {
      if (!this.restoreArmed) return;
      this.restoreArmed = false;
      $("restore-btn").textContent = t("Restore my progress");
      $("restore-btn").classList.remove("danger");
    });

    $("copy-code").addEventListener("click", async () => {
      const code = exportCode(this.save);
      const box = $<HTMLTextAreaElement>("code-box");
      box.value = code;
      this.loadArmed = false;
      try {
        await navigator.clipboard.writeText(code);
        this.codeMsg(t("Copied! Paste it into Settings on your other device."), "ok");
      } catch {
        // Clipboard blocked (some embedded pages): leave it selected to copy by hand.
        box.focus();
        box.select();
        this.codeMsg(t("Select the code above and copy it."), "ok");
      }
    });
    $("load-code").addEventListener("click", () => {
      const box = $<HTMLTextAreaElement>("code-box");
      const loaded = importCode(box.value);
      if (!loaded) {
        this.codeMsg(box.value.trim() ? t("That code doesn't look right. Check that you copied all of it.") : t("Paste a save code first."), "bad");
        return;
      }
      // Replacing progress can't be undone, so the button asks twice.
      if (!this.loadArmed) {
        this.loadArmed = true;
        $("load-code").textContent = t("Tap again to replace this device's progress");
        $("load-code").classList.add("danger");
        this.codeMsg(t("This code has a best of {n} people and builder level {level}.", { n: fmt(loaded.best), level: loaded.profile.level }), "");
        return;
      }
      this.host.replaceSave(loaded);
      this.resetTransfer();
      this.codeMsg(t("Progress loaded!"), "ok");
      this.host.sound.star();
      this.renderSettings();
    });
    $("code-box").addEventListener("input", () => {
      if (this.loadArmed) {
        this.loadArmed = false;
        $("load-code").textContent = t("Load save code");
        $("load-code").classList.remove("danger");
      }
    });
  }

  // ---------- Daily gift ----------

  /** Claims today's gift, if it's ready. The main menu's "collect" button shows it. */
  claimGift(): { stars: number; day: number; trophies: string[] } | null {
    const save = this.save, g = giftState(save.profile.gift);
    if (!g.ready || save.profile.towers < 1) return null;
    const n = giftAmount(g.streak);
    save.profile.gift = { last: dayKey(0), streak: g.streak };
    addStars(save, n);
    const trophies = awardStandingTrophies(save);
    // The week's gift track, with today highlighted.
    const slot = (g.streak - 1) % GIFTS.length;
    $("gift-track").innerHTML = GIFTS.map((x, i) => `
      <div class="gift-day${i < slot ? " done" : ""}${i === slot ? " today" : ""}"><b>${x}★</b>${esc(t("Day {n}", { n: i + 1 }))}</div>`).join("");
    return { stars: n, day: g.streak, trophies };
  }
}

// The pop-up sheets: skins, star shop, challenges, profile, settings and the daily gift.
import { fmt } from "../core/util";
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
import { ownsProduct } from "../logic/premium";
import { formatPrice, PRODUCTS, type Product } from "../data/premium";
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
  /** Graphics quality changed. */
  applyQuality(): void;
  replayTips(): void;
  /** How premium items are paid for here, or null when they can't be bought on this page. */
  readonly payments: PaymentProvider | null;
  /** Starts a premium purchase. */
  buyPremium(product: Product): Promise<void>;
  /** App Store and Google Play: asks the store again for everything already bought. */
  restorePurchases(): Promise<void>;
}

const isShopSkin = (s: Skin) => !!s.unlock && "price" in s.unlock;
const priceOf = (s: Skin) => (s.unlock && "price" in s.unlock ? s.unlock.price : 0);

export class Sheets {
  private loadArmed = false;

  constructor(private readonly host: Host) {
    for (const id of ["skins", "shop", "challenges", "profile"]) wireModal($(id));
    wireModal($("settings"), () => this.closeSettings());
    this.wireSettings();
    $("restore-purchases").addEventListener("click", async () => {
      const b = $<HTMLButtonElement>("restore-purchases");
      b.disabled = true;
      await this.host.restorePurchases();
      b.disabled = false;
      this.renderShop();
    });
  }

  /** Redraws the shop if it's open (the store's prices arrive a moment after start). */
  refreshShop(): void {
    if (!$("shop").hidden) this.renderShop();
  }

  private get save(): SaveData { return this.host.save; }

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
    const save = this.save, count = unlockedSkinCount(save);
    $("skins-count").textContent = `${count} of ${SKINS.length} tower skins unlocked`;
    const grid = $("skin-grid");
    grid.innerHTML = "";
    for (const st of SKINS) {
      const open = isSkinUnlocked(save, st), on = save.skin === st.id;
      const premium = !!st.unlock && "product" in st.unlock;
      const b = this.skinCard(st, open, on, on ? "Equipped" : open ? "Tap to use" : isShopSkin(st) ? `<span class="price">${priceOf(st)} ★ in the shop</span>`
        : premium ? `<span class="premium-tag">✦ Premium</span>`
        : st.unlock && "streak" in st.unlock ? `🔥 ${st.unlock.streak}-day streak` : `Over ${MILESTONES[(st.unlock as { at: number }).at].m} m`);
      b.setAttribute("aria-label", open ? `${st.name}${on ? ", equipped" : ""}` : `${st.name}, locked. ${skinUnlockText(st)}`);
      b.addEventListener("click", () => {
        if (!open) {
          if (premium) { closeModal($("skins")); this.openShop("premium"); return; }
          if (isShopSkin(st) && isOpen(save, "shop")) { closeModal($("skins")); this.openShop("skins"); return; }
          this.nope(b, `${skinUnlockText(st)} to unlock ${st.name}.`);
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
    for (const t of ISLAND_THEMES) {
      const open = themeUnlocked(save, t), on = theme.id === t.id;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `skin${open ? "" : " locked"}${on ? " equipped" : ""}`;
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="skin-name">${esc(t.name)}</span>
        <span class="skin-sub">${on ? "Equipped" : open ? "Tap to use" : t.product ? `<span class="premium-tag">✦ Premium</span>` : `Builder level ${t.level}`}</span>${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
      b.setAttribute("aria-label", open ? `${t.name} island${on ? ", equipped" : ""}` : t.product ? `${t.name} island, premium` : `${t.name} island, locked. Reach builder level ${t.level}`);
      drawThemePreview(b.querySelector("canvas")!, t);
      b.addEventListener("click", () => {
        if (!open && t.product) { closeModal($("skins")); this.openShop("premium"); return; }
        if (!open) { this.nope(b, `Reach builder level ${t.level} to unlock the ${t.name} island.`); return; }
        save.island = t.id;
        this.host.persist();
        this.click();
        closeModal($("skins"));
        this.host.refresh();
      });
      themes.appendChild(b);
    }
    openModal($("skins"));
  }

  private skinCard(st: Skin, open: boolean, on: boolean, sub: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `skin${open ? "" : " locked"}${on ? " equipped" : ""}`;
    b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="skin-name">${esc(st.name)}</span><span class="skin-sub">${sub}</span>
      ${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
    drawSkinPreview(b.querySelector("canvas")!, st);
    return b;
  }

  // ---------- Star shop ----------

  openShop(tab?: "boosts" | "skins" | "premium"): void {
    this.click();
    this.seen("shop");
    this.renderShop();
    if (tab) showTab($("shop"), tab);
    openModal($("shop"));
  }

  /** Premium cosmetics for real money. */
  private renderPremium(): void {
    const save = this.save, pay = this.host.payments;
    const note = $("premium-note");
    note.textContent = !pay ? "Premium items are coming soon. Everything here is cosmetic: it never helps you score."
      : pay.store ? "Cosmetic only: never helps you score."
      : pay.live ? "Cosmetic only: never helps you score. Payments are handled securely by Stripe."
      : "Test mode: purchases unlock instantly and nothing is charged.";
    note.classList.toggle("test", !!pay && !pay.live);
    $("restore-purchases").hidden = !pay?.store;
    const list = $("premium-list");
    list.innerHTML = "";
    for (const p of PRODUCTS) {
      const owned = ownsProduct(save, p.id);
      const price = pay?.price?.(p) ?? formatPrice(p.cents);
      const card = document.createElement("div");
      card.className = `premium-card${p.kind === "bundle" ? " bundle" : ""}${owned ? " owned" : ""}`;
      card.innerHTML = `<canvas aria-hidden="true"></canvas>
        ${p.kind === "bundle" ? '<span class="best-value">Best value</span>' : ""}
        <b>${esc(p.name)}</b><small>${esc(p.text)}</small>
        <button type="button" class="buy">${owned ? "✓ Owned" : pay ? esc(price) : "Coming soon"}</button>`;
      const cv = card.querySelector("canvas")!;
      const skinId = p.grants.skins?.[0], themeId = p.grants.themes?.[0];
      if (p.kind === "island" && themeId) drawThemePreview(cv, ISLAND_THEMES.find(t => t.id === themeId)!);
      else if (skinId) drawSkinPreview(cv, SKINS.find(s => s.id === (p.kind === "bundle" ? "cyber" : skinId))!);
      const btn = card.querySelector<HTMLButtonElement>(".buy")!;
      btn.disabled = owned || !pay;
      btn.setAttribute("aria-label", owned ? `${p.name}, owned` : pay ? `Buy ${p.name} for ${price}` : `${p.name}, coming soon`);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "…";
        await this.host.buyPremium(p);
        this.renderShop();
      });
      list.appendChild(card);
    }
  }

  private renderShop(): void {
    const save = this.save;
    this.renderPremium();
    $("shop-balance").textContent = `You have ${save.stars} ★`;
    const list = $("boost-list");
    list.innerHTML = "";
    for (const bo of BOOSTS) {
      const have = save.boosts[bo.id];
      const row = document.createElement("div");
      row.className = "shop-item";
      const full = have >= MAX_BOOSTS, poor = save.stars < bo.price;
      row.innerHTML = `<b>${esc(bo.name)}</b>
        <button type="button" class="buy"${full ? " disabled" : ""}>${full ? "Full" : `${bo.price} ★`}</button>
        <small>${esc(bo.text)}</small>${have ? `<span class="owned">You have ${have}</span>` : ""}`;
      const btn = row.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", `Buy ${bo.name} for ${bo.price} stars`);
      btn.addEventListener("click", () => {
        if (poor) { this.nope(btn, `You need ${bo.price - save.stars} more ★. Finish missions and claim daily gifts to earn more.`); return; }
        if (buyBoost(save, bo.id) === "ok") this.bought(`${bo.name} ready for your next Classic tower`);
      });
      list.appendChild(row);
    }
    const grid = $("shop-skins");
    grid.innerHTML = "";
    for (const st of SKINS.filter(isShopSkin)) {
      const owned = isSkinUnlocked(save, st), price = priceOf(st), on = save.skin === st.id;
      const b = this.skinCard(st, true, on, owned ? (on ? "Equipped" : "Owned · tap to use") : `<span class="price">${price} ★</span>`);
      b.setAttribute("aria-label", owned ? `${st.name}, owned` : `Buy ${st.name} for ${price} stars`);
      b.addEventListener("click", () => {
        if (owned) {
          save.skin = st.id;
          this.host.persist();
          this.click();
          this.renderShop();
          this.host.refresh();
          return;
        }
        if (save.stars < price) { this.nope(b, `You need ${price - save.stars} more ★ for ${st.name}.`); return; }
        if (buySkin(save, st.id) === "ok") {
          save.skin = st.id;
          const won = awardStandingTrophies(save);
          this.bought(`${st.name} is yours!${won.length ? ` Trophy: ${won.join(", ")}` : ""}`);
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
    const save = this.save, done = save.challenges.length;
    $("challenges-count").textContent = `${done} of ${CHALLENGES.length} complete`;
    $("challenges-bar").style.width = `${done / CHALLENGES.length * 100}%`;
    const list = $("challenge-list");
    list.innerHTML = "";
    for (const c of CHALLENGES) {
      const won = save.challenges.includes(c.id), open = challengeOpen(save, c.id);
      const row = document.createElement("div");
      row.className = `challenge${won ? " done" : ""}${open ? "" : " locked"}`;
      const rules = [
        c.rules.iceEvery && `Every ${c.rules.iceEvery === 3 ? "third" : `${c.rules.iceEvery}th`} floor is ice`,
        c.rules.windFrom && "Wind from the start",
        c.rules.goldChance && "Lots of penthouses",
        c.rules.noRewind && "No rewinds",
      ].filter(Boolean).join(" · ");
      row.innerHTML = `<b>${esc(c.name)}</b>
        <button type="button" class="buy"${open ? "" : " disabled"}>${won ? "Replay" : open ? "Play" : "Locked"}</button>
        <small>${esc(c.text)}</small>
        ${rules ? `<span class="rule">${esc(rules)}</span>` : ""}
        <small>${won ? "Complete" : `Reward: ${c.reward} ★`}</small>`;
      row.querySelector("button")!.addEventListener("click", () => {
        if (!open) return;
        closeModal($("challenges"));
        this.host.startChallenge(c.id);
      });
      list.appendChild(row);
    }
    openModal($("challenges"));
  }

  // ---------- Profile ----------

  openProfile(): void {
    this.click();
    this.seen("profile");
    const save = this.save, p = save.profile, need = xpNeeded(p.level);
    $("profile-title").textContent = `Builder level ${p.level}`;
    $("profile-xp").textContent = `${fmt(p.xp)} of ${fmt(need)} XP to level ${p.level + 1}`;
    $("profile-bar").style.width = `${p.xp / need * 100}%`;
    const nextTheme = ISLAND_THEMES.find(t => t.level > p.level);
    $("profile-next").textContent = nextTheme ? `Level ${nextTheme.level} unlocks the ${nextTheme.name} island` : "Every island theme unlocked";
    const stats: [string | number, string][] = [
      [fmt(save.best), "best people"], [`${fmt(save.bestMeters)} m`, "tallest"], [fmt(p.towers), "towers"],
      [p.bestStreak, "best streak"], [fmt(p.perfects), "perfects"], [`${save.challenges.length}/${CHALLENGES.length}`, "landmarks"],
    ];
    $("profile-stats").innerHTML = stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
    const modeName = { classic: "Classic", daily: "Daily", challenge: "Challenge", zen: "Zen" } as const;
    $("history").innerHTML = save.history.length
      ? save.history.map((h, i) => `<div class="history-row"><span class="rank">${i + 1}</span>
          <span><b>${fmt(h.score)}</b> <small>people · ${h.meters} m</small></span>
          <span class="when">${modeName[h.mode]}<br>${esc(this.when(h.day))}</span></div>`).join("")
      : `<p class="history-empty">Your best towers will show up here.</p>`;
    $("trophy-title").textContent = `${p.trophies.length} of ${TROPHIES.length} won`;
    $("trophy-grid").innerHTML = TROPHIES.map(t => {
      const won = p.trophies.includes(t.id);
      return `<div class="trophy${won ? " won" : ""}"><span class="t-ico">${won ? TROPHY_ICON : LOCK_ICON}</span><span><b>${esc(t.name)}</b><small>${esc(t.text)}</small></span></div>`;
    }).join("");
    openModal($("profile"));
  }

  private when(day: string): string {
    if (day === dayKey(0)) return "Today";
    if (day === dayKey(-1)) return "Yesterday";
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---------- Settings ----------

  private renderSettings(): void {
    const st = this.save.settings;
    $<HTMLInputElement>("set-sound").checked = st.sound;
    $<HTMLInputElement>("set-music").checked = st.music;
    $<HTMLInputElement>("set-vibrate").checked = st.vibrate;
    $("vibrate-row").hidden = !("vibrate" in navigator);
    document.querySelectorAll<HTMLButtonElement>("[data-q]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.q === st.quality)));
    $("quality-note").textContent = st.quality === "auto" && st.autoLow ? "Smooth mode was picked for this device"
      : st.quality === "low" ? "Simpler graphics, easier on the battery"
      : st.quality === "high" ? "Glow, depth and light effects always on"
      : "Full effects, switching to smooth on slower phones";
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
    $("load-code").textContent = "Load save code";
    $("load-code").classList.remove("danger");
    $<HTMLTextAreaElement>("code-box").value = "";
    this.codeMsg("", "");
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
    $("replay-tips").addEventListener("click", () => {
      this.host.replayTips();
      toast("Tips will show on your next tower");
    });

    $("copy-code").addEventListener("click", async () => {
      const code = exportCode(this.save);
      const box = $<HTMLTextAreaElement>("code-box");
      box.value = code;
      this.loadArmed = false;
      try {
        await navigator.clipboard.writeText(code);
        this.codeMsg("Copied! Paste it into Settings on your other device.", "ok");
      } catch {
        // Clipboard blocked (some embedded pages): leave it selected to copy by hand.
        box.focus();
        box.select();
        this.codeMsg("Select the code above and copy it.", "ok");
      }
    });
    $("load-code").addEventListener("click", () => {
      const box = $<HTMLTextAreaElement>("code-box");
      const loaded = importCode(box.value);
      if (!loaded) {
        this.codeMsg(box.value.trim() ? "That code doesn't look right. Check that you copied all of it." : "Paste a save code first.", "bad");
        return;
      }
      // Replacing progress can't be undone, so the button asks twice.
      if (!this.loadArmed) {
        this.loadArmed = true;
        $("load-code").textContent = "Tap again to replace this device's progress";
        $("load-code").classList.add("danger");
        this.codeMsg(`This code has a best of ${fmt(loaded.best)} people and builder level ${loaded.profile.level}.`, "");
        return;
      }
      this.host.replaceSave(loaded);
      this.resetTransfer();
      this.codeMsg("Progress loaded!", "ok");
      this.host.sound.star();
      this.renderSettings();
    });
    $("code-box").addEventListener("input", () => {
      if (this.loadArmed) {
        this.loadArmed = false;
        $("load-code").textContent = "Load save code";
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
      <div class="gift-day${i < slot ? " done" : ""}${i === slot ? " today" : ""}"><b>${x}★</b>Day ${i + 1}</div>`).join("");
    return { stars: n, day: g.streak, trophies };
  }
}

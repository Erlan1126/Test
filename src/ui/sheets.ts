// The pop-up sheets: skins, star shop, challenges, profile, settings and the daily gift.
import { track } from "../stats";
import { GUIDE } from "../data/guide";
import { DECOR, DECOR_BONUS, UPGRADES_CASH, type Decor } from "../data/decor";
import { coins } from "../data/tycoon";
import { COIN_SVG } from "./tycoon";
import { buyDecor } from "../logic/decor";
import { formatRecoveryCode } from "../online";
import { fmt } from "../core/util";
import { getLang, t, tn, type LangSetting } from "../i18n";
import { CHALLENGES, CHAPTER_CHEST, CHAPTERS, STAGES_PER_CHAPTER } from "../data/challenges";
import { MILESTONES } from "../data/constants";
import { ISLAND_THEMES } from "../data/islands";
import { BOOSTS, MAX_BOOSTS } from "../data/shop";
import { skinById, SKINS, type Skin } from "../data/skins";
import { TROPHIES } from "../data/trophies";
import { markSeen, type Feature } from "../logic/features";
import { addStars, awardStandingTrophies, challengeOpen, journeyStars, stageGoal, stageName, currentTheme, isSkinUnlocked, skinUnlockText, themeUnlocked, unlockedSkinCount } from "../logic/progress";
import { dayKey, giftAmount, giftState, GIFTS, xpNeeded } from "../logic/rules";
import { exportCode, importCode, type SaveData } from "../logic/save";
import { buyBoost, buySkin } from "../logic/shop";
import { itemPrice, ownsProduct } from "../logic/premium";
import { buyShape, currentShape, shapeUnlocked } from "../logic/shapes";
import { SHAPES } from "../data/shapes";
import { nextTitle, titleFor } from "../data/titles";
import { buyDeal, dealBought, dealsFor } from "../logic/deals";
import { starterLeft } from "../logic/starter";
import { claimVip, VIP_CENTS, VIP_DAILY_CRYSTALS, vipActive, vipClaimReady } from "../logic/vip";
import { dayNumber, duration } from "../logic/rules";
import { CRYSTAL_PACKS, formatPrice, PRODUCTS, type CrystalPack, type Product } from "../data/premium";
import type { PaymentProvider } from "../payments";
import { drawPostcard, drawShapePreview, drawSkinPreview, drawThemePreview } from "../render/previews";
import { ALBUM_CRYSTALS, POSTCARD_COUNT, POSTCARD_LANDMARKS, postcardId, SET_STARS, WEATHERS } from "../logic/postcards";
import type { Sound } from "../sound";
import { confetti } from "./fx";
import { FEATURE_ICON, FEATURE_NAMES, FEATURE_TEXT, levelStep } from "../data/levels";
import { iconSvg } from "./icons";
import { towerName } from "../data/towernames";
import { AVATAR_COLORS, AVATARS, avatarBadge, FRAMES } from "../data/avatars";
import type { FriendCity, Online } from "../online";
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
  buyVip(): Promise<void>;
  /** Fills the business boosts (cash booster, vault, time warps) into the shop. */
  townBoosts(el: HTMLElement, after: () => void): void;
  /** A decoration was bought: show it in the town. */
  showDecor(id: string): void;
  openStarter(): void;
  /** Spends crystals on a premium item. */
  buyItem(product: Product): void;
  /** Lets the player pick where a city building stands on the island. */
  startMove(id: string): void;
  /** Whether buildings can be moved here (needs the 3D graphics). */
  canMove(): boolean;
  /** On the main menu (not in the middle of a tower)? */
  onMenu(): boolean;
  readonly online: Online;
  /** Shares this player's city; resolves to their friend code ("" offline). */
  shareCity(): Promise<string>;
  /** Shows a friend's city on the home screen. */
  visit(city: FriendCity, code: string): void;
}

const isShopSkin = (s: Skin) => !!s.unlock && "price" in s.unlock;
const priceOf = (s: Skin) => (s.unlock && "price" in s.unlock ? s.unlock.price : 0);

export class Sheets {
  private loadArmed = false;

  constructor(private readonly host: Host) {
    for (const id of ["shop", "challenges", "profile", "help"]) wireModal($(id));
    $("my-avatar").addEventListener("click", () => { $("avatar-picker").hidden = !$("avatar-picker").hidden; this.click(); });
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

  /** Skins live in the Shop now, on its Towers tab. */
  openSkins(): void {
    this.openShop("towers");
  }

  private renderSkins(): void {
    const save = this.save, count = unlockedSkinCount(save);
    $("skins-count").textContent = t("{n} of {total} tower skins unlocked", { n: count, total: SKINS.length });
    const grid = $("skin-grid");
    grid.innerHTML = "";
    // What you can use comes first, then what you can buy, then what you earn by playing.
    const rank = (st: Skin) => isSkinUnlocked(save, st) ? (save.skin === st.id ? 0 : 1)
      : isShopSkin(st) ? 2 : st.unlock && ("product" in st.unlock || "pass" in st.unlock) ? 3 : 4;
    for (const st of [...SKINS].sort((a, b) => rank(a) - rank(b))) {
      const open = isSkinUnlocked(save, st), on = save.skin === st.id;
      const premium = !!st.unlock && "product" in st.unlock;
      const pass = !!st.unlock && "pass" in st.unlock;
      const name = t(st.name);
      // Skins for sale show in full color; ones earned by playing stay greyed out.
      const b = this.skinCard(st, open || isShopSkin(st) || premium || pass, on, on ? esc(t("Equipped")) : open ? esc(t("Tap to use")) : isShopSkin(st) ? `<span class="price">${priceOf(st)} ★</span>`
        : premium ? `<span class="premium-tag">💎 ${esc(t("Crystals"))}</span>`
        : pass ? `<span class="premium-tag">Sky Pass</span>`
        : st.unlock && "streak" in st.unlock ? esc(t("🔥 {n}-day streak", { n: st.unlock.streak }))
        : st.unlock && "vip" in st.unlock ? `<span class="premium-tag">VIP</span>`
        : st.unlock && "event" in st.unlock ? `<span class="premium-tag">${esc(st.unlock.event === "starter" ? t("Starter Pack") : t("Holiday event"))}</span>` : esc(t("Over {n} m", { n: MILESTONES[(st.unlock as { at: number }).at].m })));
      b.setAttribute("aria-label", open ? (on ? t("{name}, equipped", { name }) : name) : t("{name}, locked. {how}", { name, how: skinUnlockText(st) }));
      b.addEventListener("click", () => {
        if (!open) {
          if (premium) { showTab($("shop"), "crystals"); this.click(); return; }
          if (isShopSkin(st)) {
            const price = priceOf(st);
            if (save.stars < price) { this.nope(b, t("You need {n} more ★ for {name}.", { n: price - save.stars, name })); return; }
            if (buySkin(save, st.id) === "ok") {
              save.skin = st.id;
              const won = awardStandingTrophies(save);
              this.bought(t("{name} is yours!", { name }) + (won.length ? " " + tn(won.length, "Trophy: {names}", "Trophies: {names}", { names: won.join(", ") }) : ""));
            }
            return;
          }
          this.nope(b, t("{how} to unlock {name}.", { how: skinUnlockText(st), name }));
          return;
        }
        save.skin = st.id;
        this.host.persist();
        this.click();
        closeModal($("shop"));
        this.host.refresh();
      });
      grid.appendChild(b);
    }
    this.renderShapes();
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
        <span class="skin-sub">${on ? esc(t("Equipped")) : open ? esc(t("Tap to use")) : th.product ? `<span class="premium-tag">💎 ${esc(t("Crystals"))}</span>` : esc(t("{n} people", { n: fmt(th.people) }))}</span>${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
      b.setAttribute("aria-label", open ? (on ? t("{name} island, equipped", { name }) : t("{name} island", { name })) : th.product ? t("{name} island, premium", { name }) : t("{name} island, locked. Opens at {n} people", { name, n: fmt(th.people) }));
      drawThemePreview(b.querySelector("canvas")!, th);
      b.addEventListener("click", () => {
        if (!open && th.product) { showTab($("shop"), "crystals"); this.click(); return; }
        if (!open) { this.nope(b, t("Your city opens the {name} district at {n} people. Every tower adds its people.", { n: fmt(th.people), name })); return; }
        save.island = th.id;
        this.host.persist();
        this.click();
        closeModal($("shop"));
        this.host.refresh();
      });
      themes.appendChild(b);
    }
  }

  private renderPostcards(): void {
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
    const save = this.save, grid = $("postcard-grid");
    $("postcard-title").textContent = t("{n} of {total} postcards. Pass a landmark in clear skies, rain or snow to collect it. A full set of three pays {stars} ★, and the whole album {crystals} 💎.",
      { n: save.postcards.length, total: POSTCARD_COUNT, stars: SET_STARS, crystals: ALBUM_CRYSTALS });
    grid.innerHTML = "";
    const label = { clear: t("Clear skies"), rain: t("Rain"), snow: t("Snow") };
    for (const i of POSTCARD_LANDMARKS) for (const w of WEATHERS) {
      const got = save.postcards.includes(postcardId(i, w));
      const card = document.createElement("figure");
      card.className = `postcard${got ? " got" : ""}`;
      card.innerHTML = `<canvas aria-hidden="true"></canvas><figcaption>${esc(got ? cap(t(MILESTONES[i].name)) : "???")}<br>${esc(label[w])}</figcaption>`;
      drawPostcard(card.querySelector("canvas")!, i, w, got);
      grid.appendChild(card);
    }
  }

  private renderShapes(): void {
    const save = this.save, grid = $("shape-grid"), skin = skinById(save.skin), shape = currentShape(save);
    grid.innerHTML = "";
    for (const sh of SHAPES) {
      const open = shapeUnlocked(save, sh), on = shape.id === sh.id, u = sh.unlock, name = t(sh.name);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `skin${open || (u && !("level" in u)) ? "" : " locked"}${on ? " equipped" : ""}`;
      const how = !u ? "" : "level" in u ? esc(t("Builder level {n}", { n: u.level }))
        : "stars" in u ? `<span class="price">${u.stars} ★</span>` : `<span class="premium-tag">💎 ${fmt(u.crystals)}</span>`;
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="skin-name">${esc(name)}</span>
        <span class="skin-sub">${on ? esc(t("Equipped")) : open ? esc(t("Tap to use")) : how}</span>${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
      b.setAttribute("aria-label", open ? (on ? t("{name}, equipped", { name }) : name) : t("{name}, locked", { name }));
      drawShapePreview(b.querySelector("canvas")!, sh, skin);
      b.addEventListener("click", () => {
        if (!open && u) {
          if ("level" in u) { this.nope(b, t("Reach builder level {n} to unlock {name}.", { n: u.level, name })); return; }
          const stars = "stars" in u, price = stars ? u.stars : u.crystals, have = stars ? save.stars : save.crystals;
          if (have < price) {
            if (stars) this.nope(b, t("You need {n} more ★ for {name}.", { n: price - have, name }));
            else { this.nope(b, t("You need {n} more 💎. Get a crystal pack above.", { n: fmt(price - have) })); showTab($("shop"), "crystals"); }
            return;
          }
          if (buyShape(save, sh.id) !== "ok") return;
          save.shape = sh.id;
          this.bought(t("{name} is yours!", { name }));
          return;
        }
        save.shape = sh.id;
        this.host.persist();
        this.click();
        this.renderShop();
        this.host.refresh();
      });
      grid.appendChild(b);
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

  /** The shop opens on the town (decorations and business boosts) unless asked otherwise. */
  openShop(tab: "town" | "towers" | "crystals" | "boosts" = "town"): void {
    this.click();
    this.seen("shop");
    this.seen("skins");
    this.renderShop();
    track("shop_opened", { tab });
    track("shop_visit", { tab }, false);
    showTab($("shop"), tab);
    openModal($("shop"));
    // (Always from the top, so the first card is in view.)
    const sh = $("shop").querySelector<HTMLElement>(".sheet");
    if (sh) sh.scrollTop = 0;
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

    this.renderVip();
    // The Starter Pack, while its offer lasts.
    const sc = $("starter-card"), left = starterLeft(save);
    sc.hidden = !left || !pay;
    if (!sc.hidden) {
      sc.innerHTML = `<span style="font-size:30px" aria-hidden="true">☀️</span><span><b>${esc(t("Starter Pack"))}</b><small>${esc(t("300 💎, the Sunrise skin and boosts · ends in {time}", { time: duration(left) }))}</small></span><button type="button" class="buy">${esc(t("See offer"))}</button>`;
      sc.querySelector("button")!.addEventListener("click", () => this.host.openStarter());
    }
    const packs = $("pack-list");
    packs.innerHTML = "";
    const shown = CRYSTAL_PACKS.filter(pk => !pk.retired);
    for (const pk of shown) {
      const price = pay?.price?.(pk) ?? formatPrice(pk.cents);
      const first = !save.packsFirst.includes(pk.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `pack-card${pk.value ? " best" : ""}${pk.extras ? " hero" : ""}`;
      card.disabled = !pay;
      const extras = [
        ...(pk.extras?.skins ?? []).map(id => t("{name} skin (only here)", { name: t(skinById(id).name) })),
        pk.extras?.vipDays ? t("{n} days of VIP", { n: pk.extras.vipDays }) : "",
      ].filter(Boolean);
      card.innerHTML = `${pk.value ? `<span class="best-value">${esc(t("Best value"))}</span>` : ""}
        ${first ? `<span class="first-x2">${esc(t("2× first time"))}</span>` : ""}
        ${pk.extras?.skins?.length ? `<canvas class="pack-skin" aria-hidden="true"></canvas>` : ""}
        <span class="pack-gems" aria-hidden="true">${"💎".repeat(Math.min(3, 1 + shown.indexOf(pk) / 2 | 0))}</span>
        <b>${fmt(first ? pk.crystals * 2 : pk.crystals)}</b>${first ? `<s class="was">${fmt(pk.crystals)}</s>` : ""}${pk.bonus ? `<small class="bonus">${esc(t("{n} bonus", { n: pk.bonus }))}</small>` : "<small>&nbsp;</small>"}
        ${extras.length ? `<span class="pack-extras">+ ${esc(extras.join(" · "))}</span>` : ""}
        <span class="buy">${pay ? esc(price) : esc(t("Soon"))}</span>`;
      const ps = card.querySelector<HTMLCanvasElement>(".pack-skin");
      if (ps && pk.extras?.skins?.[0]) drawSkinPreview(ps, skinById(pk.extras.skins[0]));
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
    // Legendary items lead the list; pack-only items aren't sold here.
    const order = [...PRODUCTS.filter(p => p.legendary && !p.exclusive), ...PRODUCTS.filter(p => !p.legendary)];
    for (const p of order) {
      const owned = ownsProduct(save, p.id), price = itemPrice(save, p.id);
      const card = document.createElement("div");
      card.className = `premium-card${p.kind === "bundle" ? " bundle" : ""}${p.legendary ? " legendary" : ""}${owned ? " owned" : ""}`;
      card.innerHTML = `<canvas aria-hidden="true"></canvas>
        ${p.legendary ? `<span class="legend-tag">${esc(t("Legendary"))}</span>` : p.kind === "bundle" ? `<span class="best-value">${esc(t("Best value"))}</span>` : ""}
        <b>${esc(t(p.name))}</b><small>${esc(t(p.text))}</small>
        <button type="button" class="buy">${owned ? esc(t("✓ Owned")) : `💎 ${fmt(price)}`}</button>`;
      const cv = card.querySelector("canvas")!;
      const skinId = p.grants.skins?.[0], themeId = p.grants.themes?.[0];
      if (p.kind === "island" && themeId) drawThemePreview(cv, ISLAND_THEMES.find(t => t.id === themeId)!);
      else if (p.id === "founders") drawSkinPreview(cv, SKINS.find(s => s.id === "cyber")!);
      else if (p.id === "set_legendary") drawSkinPreview(cv, skinById("gold"));
      else if (p.grants.shapes?.length && skinId) drawShapePreview(cv, SHAPES.find(x => x.id === p.grants.shapes![0])!, skinById(skinId));
      else if (skinId) drawSkinPreview(cv, skinById(skinId));
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

  /** The VIP card: what it gives, its price, and today's gift once it's on. */
  private renderVip(): void {
    const save = this.save, pay = this.host.payments, box = $("vip-card"), day = dayNumber();
    const on = vipActive(save), canBuy = !!pay?.buyVip;
    box.hidden = !on && !canBuy;
    if (box.hidden) return;
    const price = pay?.vipPrice?.() ?? formatPrice(VIP_CENTS);
    const ready = vipClaimReady(save, day);
    box.innerHTML = `<div class="vip-head"><b>👑 Skyrise VIP</b>${on ? `<span class="vip-on">${esc(t("Active"))}</span>` : ""}</div>
      <ul><li>${esc(t("{n} 💎 every day", { n: VIP_DAILY_CRYSTALS }))}</li><li>${esc(t("A free Extra rewind every day"))}</li><li>${esc(t("The Platinum tower skin"))}</li></ul>
      <button type="button" class="btn btn-primary wide" id="vip-btn"${on && !ready ? " disabled" : ""}>${on ? (ready ? esc(t("Collect today's VIP gift")) : esc(t("✓ Collected today"))) : esc(t("Join for {price} a month", { price }))}</button>
      <small>${on ? esc(t("Manage or cancel it any time in your store's subscriptions.")) : esc(t("Renews every month until you cancel. Cancel any time in your store's subscriptions."))}</small>`;
    $("vip-btn").addEventListener("click", () => {
      if (on) {
        if (claimVip(save, day)) this.bought(t("+{n} 💎 and an Extra rewind. See you tomorrow!", { n: VIP_DAILY_CRYSTALS }));
        return;
      }
      this.click();
      void this.host.buyVip();
    });
  }

  private renderDeals(): void {
    const save = this.save, day = dayNumber(), list = $("deal-list");
    const hours = Math.max(1, Math.ceil((86400e3 - (Date.now() % 86400e3)) / 3600e3));
    $("deals-note").textContent = t("New deals in {n} h", { n: hours });
    list.innerHTML = "";
    for (const d of dealsFor(save, day)) {
      const done = dealBought(save, day, d), cur = d.currency === "stars" ? "★" : "💎";
      const pct = Math.round((1 - d.price / d.was) * 100);
      const card = document.createElement("div");
      card.className = `deal${done ? " done" : ""}`;
      const name = d.kind === "boosts" ? t("Boost pack") : t(d.name);
      card.innerHTML = `<span class="off">-${pct}%</span>${d.kind === "boosts" ? `<span class="boost-pic" aria-hidden="true">⏪⚡🏆</span>` : `<canvas aria-hidden="true"></canvas>`}
        <b>${esc(name)}</b><s>${fmt(d.was)} ${cur}</s>
        <button type="button" class="buy"${done ? " disabled" : ""}>${done ? esc(t("✓ Owned")) : `${fmt(d.price)} ${cur}`}</button>`;
      const cv = card.querySelector("canvas");
      if (cv) {
        if (d.kind === "skin") drawSkinPreview(cv, skinById(d.ref));
        else if (d.kind === "shape") drawShapePreview(cv, SHAPES.find(x => x.id === d.ref)!, skinById(save.skin));
        else {
          const p = PRODUCTS.find(x => x.id === d.ref)!;
          if (p.kind === "island" && p.grants.themes?.[0]) drawThemePreview(cv, ISLAND_THEMES.find(x => x.id === p.grants.themes![0])!);
          else drawSkinPreview(cv, skinById(p.grants.skins?.[0] ?? "glass"));
        }
      }
      const btn = card.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", t("Buy {name} for {n}", { name, n: `${d.price} ${cur}` }));
      btn.addEventListener("click", () => {
        const r = buyDeal(save, day, d);
        if (r === "short") {
          if (d.currency === "stars") this.nope(btn, t("You need {n} more ★ for {name}.", { n: d.price - save.stars, name }));
          else { this.nope(btn, t("You need {n} more 💎. Get a crystal pack above.", { n: fmt(d.price - save.crystals) })); showTab($("shop"), "crystals"); }
          return;
        }
        if (r === "full") { this.nope(btn, t("Your boosts are full. Use some first.")); return; }
        if (r === "ok") this.bought(t("{name} is yours!", { name }));
      });
      list.appendChild(card);
    }
  }

  /** The Town tab: decorations for the island (crystals) and the business boosts. */
  private renderTown(): void {
    const save = this.save;
    $("town-hero-ico").innerHTML = iconSvg("island");
    $("town-hero-text").textContent = t("Every decoration shows up in your town and brings more visitors: +{pct}% to every business.", { pct: Math.round(DECOR_BONUS * 100) });
    const card = (d: Decor, list: HTMLElement) => {
      const own = save.decor.includes(d.id), cash = d.cash !== undefined;
      const price = cash ? `${COIN_SVG}${esc(coins(d.cash!))}` : `💎 ${d.crystals}`;
      const el = document.createElement("div");
      el.className = "decor-card" + (own ? " own" : "") + (cash ? " cash" : "");
      el.innerHTML = `<span class="decor-ico">${iconSvg(d.icon)}</span><b>${esc(t(d.name))}</b><small>${esc(t(d.text))}</small>`
        + `<button type="button" class="buy${own ? " owned" : ""}">${own ? `✓ ${esc(t("See it"))}` : price}</button>`;
      const btn = el.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", own ? t("{name}, owned", { name: t(d.name) }) : cash ? t("Buy {name} for {n}", { name: t(d.name), n: coins(d.cash!) }) : t("Buy {name} for {n} Sky Crystals", { name: t(d.name), n: d.crystals ?? 0 }));
      btn.addEventListener("click", () => {
        if (own) { closeModal($("shop")); this.host.showDecor(d.id); return; }
        if (cash ? save.tycoon.coins < d.cash! : save.crystals < (d.crystals ?? Infinity)) {
          if (cash) this.nope(btn, t("You need {n} more cash. Your businesses are earning it!", { n: coins(d.cash! - save.tycoon.coins) }));
          else { this.nope(btn, t("You need {n} more Sky Crystals", { n: (d.crystals ?? 0) - save.crystals })); showTab($("shop"), "crystals"); }
          return;
        }
        if (buyDecor(save, d.id) !== "ok") return;
        this.bought(t("{name} added to Skyhaven!", { name: t(d.name) }));
        closeModal($("shop"));
        this.host.showDecor(d.id);
      });
      list.appendChild(el);
    };
    const ul = $("upg-list"), dl = $("decor-list");
    ul.innerHTML = ""; dl.innerHTML = "";
    for (const d of UPGRADES_CASH) card(d, ul);
    for (const d of DECOR) card(d, dl);
    this.host.townBoosts($("shop-boosts"), () => this.renderShop());
  }

  private renderShop(): void {
    const save = this.save;
    this.renderTown();
    this.renderCrystals();
    this.renderDeals();
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
    this.renderSkins();
  }

  private bought(msg: string): void {
    this.host.persist();
    this.host.sound.coins();
    vibrate(this.save.settings.vibrate, 20);
    toast(msg);
    confetti();
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

  /** The Skyline Journey: stages on a winding path that climbs up the screen, grouped in
   *  chapters, with the chosen stage's goal and a Play button underneath. */
  private stagePick = "";

  private renderChallenges(): void {
    const save = this.save, done = save.challenges.length, total = CHALLENGES.length;
    $("challenges-count").textContent = t("{n} of {total} stages · {s} ★", { n: done, total, s: journeyStars(save) });
    $("challenges-bar").style.width = `${done / total * 100}%`;
    const list = $("challenge-list");
    list.innerHTML = "";
    const current = CHALLENGES.find(c => !save.challenges.includes(c.id)) ?? CHALLENGES[total - 1];
    if (!this.stagePick || !challengeOpen(save, this.stagePick)) this.stagePick = current.id;
    // Stage 1 at the bottom: build the rows top-down from the last chapter.
    const STEP = 78, HEAD = 64;
    const rows: { y: number; x: number; i: number }[] = [];
    let y = 24;
    const html: string[] = [];
    for (let ch = CHAPTERS.length - 1; ch >= 0; ch--) {
      const first = ch * STAGES_PER_CHAPTER, stages = CHALLENGES.slice(first, first + STAGES_PER_CHAPTER);
      const chStars = stages.reduce((n, c) => n + (save.journey[c.id] ?? 0), 0);
      const chest = save.journey[`chest${ch + 1}`] ? "✅" : "🎁";
      for (let k = stages.length - 1; k >= 0; k--) {
        const i = first + k, c = stages[k];
        const x = 50 + Math.sin(i * 0.85) * 28;
        rows.push({ y: y + 28, x, i });
        const won = save.challenges.includes(c.id), open = challengeOpen(save, c.id), stars = save.journey[c.id] ?? (won ? 1 : 0);
        const cls = `stage-node${won ? " done" : ""}${open ? "" : " locked"}${c.id === current.id && !won ? " current" : ""}${c.id === this.stagePick ? " picked" : ""}`;
        html.push(`<button type="button" class="${cls}" data-id="${c.id}" style="top:${y}px;left:calc(${x.toFixed(1)}% - 28px)" aria-label="${esc(stageName(c.id))}">
          <span>${open ? i + 1 : "🔒"}</span><i>${"★".repeat(stars)}${"☆".repeat(3 - stars)}</i></button>`);
        y += STEP;
      }
      // The chapter's name sits at its start (the bottom, since the path climbs up).
      html.push(`<div class="chapter-head" style="top:${y}px"><b>${esc(t(CHAPTERS[ch]))}</b><span>${chStars}/${stages.length * 3} ★ · ${chest} ${CHAPTER_CHEST} 💎</span></div>`);
      y += HEAD;
    }
    const H = y + 10;
    // The dotted path joining the stages.
    const pts = rows.map(r => `${r.x.toFixed(1)},${r.y}`).join(" ");
    list.innerHTML = `<div class="journey-map" style="height:${H}px">
      <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" /></svg>
      ${html.join("")}</div>`;
    list.querySelectorAll<HTMLButtonElement>(".stage-node").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id!;
      if (!challengeOpen(save, id)) { toast(t("Finish the stage before it to open this one")); return; }
      this.click();
      this.stagePick = id;
      this.renderChallenges();
    }));
    this.renderStageCard();
    // Show the chosen stage in the middle of the map.
    requestAnimationFrame(() => list.querySelector<HTMLElement>(".stage-node.picked")?.scrollIntoView({ block: "center" }));
  }

  private renderStageCard(): void {
    const save = this.save, c = CHALLENGES.find(x => x.id === this.stagePick);
    const card = $("stage-card");
    if (!c) { card.hidden = true; return; }
    card.hidden = false;
    const i = CHALLENGES.indexOf(c), won = save.challenges.includes(c.id), stars = save.journey[c.id] ?? (won ? 1 : 0);
    const rules = [
      c.rules.iceEvery && (c.rules.iceEvery === 3 ? t("Every third floor is ice") : t("Every {n}th floor is ice", { n: c.rules.iceEvery })),
      c.rules.windFrom && (c.rules.windFrom <= 1 ? t("Wind from the start") : t("Wind from floor {n}", { n: c.rules.windFrom })),
      c.rules.goldChance && t("Lots of penthouses"),
      c.rules.noRewind && t("No rewinds"),
    ].filter(Boolean).join(" · ");
    const goal = stageGoal(c);
    const chapter = CHAPTERS[Math.floor(i / STAGES_PER_CHAPTER)];
    card.innerHTML = `<div class="stage-top"><b>${esc(t("Stage {n}", { n: i + 1 }))}${c.text ? ` · ${esc(t(c.name))}` : ""}</b><span>${esc(t(chapter))}</span></div>
      <p>${esc(goal)}</p>
      ${rules ? `<span class="rule">${esc(rules)}</span>` : ""}
      <div class="stage-foot"><span class="stage-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>
        <small>${esc(won ? t("More perfect drops, more stars") : t("Reward: {n} ★", { n: c.reward }))}</small>
        <button type="button" class="buy">${esc(won ? t("Replay") : t("Play"))}</button></div>`;
    card.querySelector("button")!.addEventListener("click", () => {
      closeModal($("challenges"));
      this.host.startChallenge(c.id);
    });
  }

  // ---------- How to play ----------

  openHelp(): void {
    this.click();
    // Everything in the game, by topic: the goal, money, crystals and gems, towers.
    $("help-list").innerHTML = GUIDE.map(sec => `<h3 class="sheet-sub help-sec">${esc(t(sec.title))}</h3>`
      + sec.rows.map(r => `<div class="help-row"><span class="help-ico">${iconSvg(r.icon)}</span><span><b>${esc(t(r.title))}</b><small>${esc(t(r.text))}</small></span></div>`).join("")).join("");
    closeModal($("settings"));
    openModal($("help"));
  }

  // ---------- Profile ----------

  openProfile(tab = "journey"): void {
    this.click();
    this.seen("profile");
    this.renderProfile();
    showTab($("profile"), tab);
    openModal($("profile"));
    // Start the path at where the player is now.
    const here = $("journey-path").querySelector<HTMLElement>(".lv-step.here");
    // (Only the path scrolls, never the profile card above it off the top.)
    if (here) requestAnimationFrame(() => {
      const sheet = here.closest<HTMLElement>(".sheet");
      if (!sheet) return;
      const top = here.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop;
      const room = sheet.clientHeight - here.offsetHeight - 24;
      if (top > room) sheet.scrollTop = Math.max(0, top - room);
    });
  }

  /** The level journey: every level with what it brings, and where the player is. */
  private renderJourney(): void {
    const p = this.save.profile, last = Math.max(20, p.level + 8);
    const rows: string[] = [];
    // (It starts just before where the player is: the profile card stays in view, no scrolling.)
    for (let l = Math.max(1, p.level - 1); l <= last; l++) {
      const st = levelStep(l);
      const state = l < p.level ? "done" : l === p.level ? "here" : "ahead";
      const big = st.features.map(f => `<div class="lv-feature"><span class="lv-ico">${iconSvg(FEATURE_ICON[f])}</span><span><b>${esc(t(FEATURE_NAMES[f]))}</b><small>${esc(t(FEATURE_TEXT[f]))}</small></span></div>`).join("");
      const small = [
        st.title ? `<span class="lv-chip title">${esc(st.title.icon)} ${esc(t(st.title.name))}</span>` : "",
        ...st.shapes.map(n => `<span class="lv-chip shape">${iconSvg("tower")} ${esc(t(n))}</span>`),
        st.stars ? `<span class="lv-chip">+${st.stars} ★</span>` : "",
        st.crystals ? `<span class="lv-chip gem">+${st.crystals} 💎</span>` : "",
      ].filter(Boolean).join("");
      rows.push(`<li class="lv-step ${state}${st.features.length ? " has-feature" : ""}" style="--i:${l}">
        <span class="lv-node">${state === "done" ? "✓" : l}</span>
        <div class="lv-body">${state === "here" ? `<em class="lv-here">${esc(t("You are here"))}</em>` : ""}
          <b class="lv-name">${esc(t("Level {n}", { n: l }))}</b>${big}${small ? `<div class="lv-chips">${small}</div>` : ""}</div>
      </li>`);
    }
    $("journey-path").innerHTML = rows.join("");
  }

  /** The avatar picker in the profile: icon, color and the frames earned so far. */
  private renderAvatar(): void {
    const save = this.save, p = save.profile;
    $("my-avatar").innerHTML = avatarBadge(save, "big");
    $("pick-icons").innerHTML = AVATARS.map(a => `<button type="button" class="pick${p.avatar === a ? " on" : ""}" data-a="${a}" aria-label="${esc(a)}">${iconSvg(a)}</button>`).join("");
    $("pick-colors").innerHTML = AVATAR_COLORS.map(([c1, c2], i) => `<button type="button" class="pick swatch-pick${p.avatarColor === i ? " on" : ""}" data-c="${i}" style="background:linear-gradient(150deg,${c1},${c2})" aria-label="${esc(t("Color {n}", { n: i + 1 }))}"></button>`).join("");
    $("pick-frames").innerHTML = FRAMES.map(f => `<button type="button" class="pick frame-pick frame-${f.id}${p.frame === f.id ? " on" : ""}${f.open(save) ? "" : " locked"}" data-f="${f.id}" aria-label="${esc(t(f.name))}">${f.open(save) ? "" : LOCK_ICON}</button>`).join("");
    const pick = (sel: string, fn: (b: HTMLElement) => void) => $("avatar-picker").querySelectorAll<HTMLElement>(sel).forEach(b => b.addEventListener("click", () => fn(b)));
    pick("[data-a]", b => { p.avatar = b.dataset.a!; this.avatarChanged(); });
    pick("[data-c]", b => { p.avatarColor = Number(b.dataset.c); this.avatarChanged(); });
    pick("[data-f]", b => {
      const f = FRAMES.find(x => x.id === b.dataset.f)!;
      if (!f.open(save)) { this.nope(b, t(f.how)); return; }
      p.frame = f.id; this.avatarChanged();
    });
  }

  private avatarChanged(): void {
    this.host.persist();
    this.click();
    this.renderAvatar();
    this.host.refresh();
  }

  private renderProfile(): void {
    this.renderJourney();
    this.renderAvatar();
    const save = this.save, p = save.profile, need = xpNeeded(p.level);
    const ti = titleFor(p.level), nt = nextTitle(p.level);
    $("profile-title").textContent = `${ti.icon} ${t(ti.name)} · ${t("Lv {n}", { n: p.level })}`;
    $("profile-xp").textContent = t("{xp} of {need} XP to level {n}", { xp: fmt(p.xp), need: fmt(need), n: p.level + 1 });
    $("profile-bar").style.width = `${p.xp / need * 100}%`;
    $("profile-next").textContent = nt ? t("Level {n}: you become {icon} {name}", { n: nt.min, icon: nt.icon, name: t(nt.name) }) : t("You hold the highest title!");
    const stats: [string | number, string][] = [
      [fmt(save.best), t("best people")], [`${fmt(save.bestMeters)} m`, t("tallest")], [fmt(p.towers), t("towers")],
      [p.bestStreak, t("best streak")], [fmt(p.perfects), t("perfects")], [`${save.challenges.length}/${CHALLENGES.length}`, t("landmarks")],
    ];
    $("profile-stats").innerHTML = stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
    const modeName = { classic: t("Classic"), daily: t("Daily"), challenge: t("Challenge"), zen: t("Zen") };
    $("history").innerHTML = save.history.length
      ? save.history.map((h, i) => `<div class="history-row"><span class="rank">${i + 1}</span>
          <span><em class="hist-name">${esc(towerName(h.score, h.floors, h.day))}</em><b>${fmt(h.score)}</b> <small>${esc(t("people · {m} m", { m: h.meters }))}</small></span>
          <span class="when">${modeName[h.mode]}<br>${esc(this.when(h.day))}</span></div>`).join("")
      : `<p class="history-empty">${esc(t("Your best towers will show up here."))}</p>`;
    $("trophy-title").textContent = t("{n} of {total} won", { n: p.trophies.length, total: TROPHIES.length });
    this.renderPostcards();
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
    return new Date(y, m - 1, d).toLocaleDateString(getLang() === "en" ? undefined : getLang(), { month: "short", day: "numeric" });
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
      st().lang = b.dataset.lang as LangSetting;
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
      if (!this.host.onMenu()) { this.restoreMsg(t("Finish this tower first, then restore from the main menu."), "bad"); return; }
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

    $("copy-save-code").addEventListener("click", async () => {
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
      if (!this.host.onMenu()) { this.codeMsg(t("Finish this tower first, then load the code from the main menu."), "bad"); return; }
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
      // This device keeps its own player id (so purchases are never credited twice).
      loaded.playerId = this.host.save.playerId || loaded.playerId;
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

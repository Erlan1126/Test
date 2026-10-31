// The pop-up sheets: skins, star shop, challenges, profile, missions, settings and the daily gift.
import { fmt } from "../core/util";
import { CHALLENGES } from "../data/challenges";
import { MILESTONES } from "../data/constants";
import { ISLAND_THEMES, ISLAND_UPGRADES } from "../data/islands";
import { MISSION_TYPES, missionText } from "../data/missions";
import { BOOSTS, MAX_BOOSTS } from "../data/shop";
import { SKINS, type Skin } from "../data/skins";
import { TROPHIES } from "../data/trophies";
import { isOpen, markSeen, type Feature } from "../logic/features";
import { addStars, awardStandingTrophies, challengeOpen, currentTheme, isSkinUnlocked, islandLevel, skinUnlockText, swapMission, themeUnlocked, unlockedSkinCount } from "../logic/progress";
import { dayKey, giftAmount, giftState, GIFTS, xpNeeded } from "../logic/rules";
import { exportCode, importCode, type SaveData } from "../logic/save";
import { buyBoost, buySkin } from "../logic/shop";
import { drawSkinPreview, drawThemePreview } from "../render/previews";
import type { Sound } from "../sound";
import { $, closeModal, esc, LOCK_ICON, openModal, replay, toast, TROPHY_ICON, vibrate, wireModal } from "./dom";

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
}

const isShopSkin = (s: Skin) => !!s.unlock && "price" in s.unlock;
const priceOf = (s: Skin) => (s.unlock && "price" in s.unlock ? s.unlock.price : 0);

export class Sheets {
  private giftOffered = false;
  private loadArmed = false;

  constructor(private readonly host: Host) {
    for (const id of ["skins", "shop", "challenges", "profile", "missions"]) wireModal($(id));
    wireModal($("settings"), () => this.closeSettings());
    $("gift-claim").addEventListener("click", () => this.claimGift());
    $("gift-later").addEventListener("click", () => { $("gift").hidden = true; this.host.refresh(); });
    this.wireSettings();
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
    $("skins-count").textContent = `${count} of ${SKINS.length} unlocked. Build taller to unlock more, or buy them in the shop.`;
    $("skins-bar").style.width = `${count / SKINS.length * 100}%`;
    const grid = $("skin-grid");
    grid.innerHTML = "";
    for (const st of SKINS) {
      const open = isSkinUnlocked(save, st), on = save.skin === st.id;
      const b = this.skinCard(st, open, on, on ? "Equipped" : open ? "Tap to use" : isShopSkin(st) ? `<span class="price">${priceOf(st)} ★ in the shop</span>` : `Over ${MILESTONES[(st.unlock as { at: number }).at].m} m`);
      b.setAttribute("aria-label", open ? `${st.name}${on ? ", equipped" : ""}` : `${st.name}, locked. ${skinUnlockText(st)}`);
      b.addEventListener("click", () => {
        if (!open) {
          if (isShopSkin(st) && isOpen(save, "shop")) { closeModal($("skins")); this.openShop(); return; }
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
        <span class="skin-sub">${on ? "Equipped" : open ? "Tap to use" : `Builder level ${t.level}`}</span>${open ? "" : `<span class="lock" aria-hidden="true">${LOCK_ICON}</span>`}`;
      b.setAttribute("aria-label", open ? `${t.name} island${on ? ", equipped" : ""}` : `${t.name} island, locked. Reach builder level ${t.level}`);
      drawThemePreview(b.querySelector("canvas")!, t);
      b.addEventListener("click", () => {
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

  openShop(): void {
    this.click();
    this.seen("shop");
    this.renderShop();
    openModal($("shop"));
  }

  private renderShop(): void {
    const save = this.save;
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
    $("profile-next").textContent = `Every level gives a star (3 at levels 5, 10, 15...). ${nextTheme ? `Level ${nextTheme.level} unlocks the ${nextTheme.name} island.` : "Every island theme is unlocked."}`;
    const stats: [string | number, string][] = [
      [fmt(p.towers), "towers"], [fmt(p.floors), "floors"], [fmt(p.perfects), "perfect drops"],
      [fmt(save.best), "best people"], [`${fmt(save.bestMeters)} m`, "tallest"], [p.bestStreak, "best streak"],
      [fmt(save.starsEarned), "stars earned"], [p.penthouses, "penthouses"], [`${save.challenges.length}/${CHALLENGES.length}`, "challenges"],
    ];
    $("profile-stats").innerHTML = stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
    const modeName = { classic: "Classic", daily: "Daily", challenge: "Challenge", zen: "Zen" } as const;
    $("history").innerHTML = save.history.length
      ? save.history.map((h, i) => `<div class="history-row"><span class="rank">${i + 1}</span>
          <span><b>${fmt(h.score)}</b> <small>people · ${h.meters} m</small></span>
          <span class="when">${modeName[h.mode]}<br>${esc(this.when(h.day))}</span></div>`).join("")
      : `<p class="history-empty">Your best towers will show up here.</p>`;
    $("trophy-title").textContent = `Trophies · ${p.trophies.length} of ${TROPHIES.length}`;
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

  // ---------- Missions ----------

  openMissions(): void {
    this.click();
    this.seen("missions");
    const save = this.save, refresh = !$("missions").hidden;
    save.missions.seen = save.missions.done;
    this.host.persist();
    $("missions-count").textContent = `${save.missions.done} done · ${save.stars} ★ to spend`;
    const canSwap = save.profile.swapDay !== dayKey(0);
    const list = $("mission-list");
    list.innerHTML = save.missions.slots.map((m, i) => `
      <div class="mission">
        <b>${esc(missionText(m))}</b>
        <span class="reward-tag">+${m.r} ★</span>
        <div class="m-bar"><i style="width:${Math.min(100, m.p / m.n * 100)}%"></i></div>
        <small>${MISSION_TYPES[m.t].game ? `Best so far: ${fmt(Math.min(m.p, m.n))} of ${fmt(m.n)}` : `${fmt(Math.min(m.p, m.n))} of ${fmt(m.n)}`}</small>
        ${canSwap ? `<button type="button" class="swap" data-i="${i}">Swap for a new mission (1 a day)</button>` : ""}
      </div>`).join("");
    list.querySelectorAll<HTMLButtonElement>(".swap").forEach(b => b.addEventListener("click", () => {
      if (swapMission(save, Number(b.dataset.i))) this.host.persist();
      this.openMissions();
    }));
    const lvl = islandLevel(save);
    $("island-list").innerHTML = ISLAND_UPGRADES.map((u, i) => `
      <div class="row-item${i < lvl ? " done" : ""}">
        <span><b>${esc(u.name)}</b><small>Build taller than ${esc(MILESTONES[u.at].name)}</small></span>
        <span class="state">${i < lvl ? "Built" : `${MILESTONES[u.at].m + 1} m`}</span>
      </div>`).join("");
    this.host.refresh();
    if (refresh) $("missions").querySelector<HTMLElement>(".close-btn")!.focus(); else openModal($("missions"));
  }

  // ---------- Settings ----------

  private renderSettings(): void {
    const st = this.save.settings;
    $<HTMLInputElement>("set-sound").checked = st.sound;
    $<HTMLInputElement>("set-music").checked = st.music;
    $<HTMLInputElement>("set-vibrate").checked = st.vibrate;
    $("vibrate-row").hidden = !("vibrate" in navigator);
    document.querySelectorAll<HTMLButtonElement>(".seg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.q === st.quality)));
    $("quality-note").textContent = st.quality === "auto" && st.autoLow
      ? "Auto switched to smooth mode on this device"
      : "High adds glow and depth effects. Auto turns them off on slower phones";
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
    document.querySelectorAll<HTMLButtonElement>(".seg button").forEach(b => b.addEventListener("click", () => {
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

  /** Offers the gift once per visit, after the first tower. */
  maybeOfferGift(): void {
    if (this.giftOffered || this.save.profile.towers < 1 || !giftState(this.save.profile.gift).ready) return;
    this.giftOffered = true;
    this.openGift();
  }

  openGift(): void {
    const g = giftState(this.save.profile.gift);
    const slot = (g.streak - 1) % GIFTS.length;
    $("gift-streak").textContent = g.streak > 1 ? `Day ${g.streak} streak` : "Day 1";
    $("gift-sub").textContent = g.streak > 1 ? "You came back! Keep the streak going for bigger gifts." : "Come back every day for bigger gifts.";
    $("gift-track").innerHTML = GIFTS.map((n, i) => `
      <div class="gift-day${i < slot ? " done" : ""}${i === slot ? " today" : ""}"><b>${n}★</b>Day ${i + 1}</div>`).join("");
    $("gift-claim").textContent = `Claim ${giftAmount(g.streak)} ★`;
    $("gift").hidden = false;
    $("gift-claim").focus();
  }

  private claimGift(): void {
    const save = this.save;
    this.host.sound.ensure();
    const g = giftState(save.profile.gift);
    $("gift").hidden = true;
    if (!g.ready) return;
    const n = giftAmount(g.streak);
    save.profile.gift = { last: dayKey(0), streak: g.streak };
    addStars(save, n);
    const won = awardStandingTrophies(save);
    this.host.persist();
    this.host.sound.star();
    toast(`+${n} ★${won.length ? ` · Trophy: ${won.join(", ")}` : ""} · Tomorrow: ${giftAmount(g.streak + 1)} ★`);
    this.host.refresh();
  }
}

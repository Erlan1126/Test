// Sheets for the daily features: the streak, today's missions with their chest and the weekly
// league, the city (rent and buildings), and the leaderboard.
import { fmt } from "../core/util";
import { t, tn } from "../i18n";
import { MILESTONES } from "../data/constants";
import { CHEST, CITY, LEAGUES, RENT_BONUS_PER_BUILD, RENT_CAP_HOURS, STREAK_REWARDS } from "../data/daily";
import { eventEndsIn, weekIndex } from "../data/events";
import { ISLAND_UPGRADES } from "../data/islands";
import { MISSION_TYPES, missionText } from "../data/missions";
import { skinById } from "../data/skins";
import { buyBuild, chestReady, claimChest, collectRent, leagueFor, rentFullIn, rentPerHour, rentWaiting, streakView } from "../logic/daily";
import { markSeen } from "../logic/features";
import { buyPremiumPass, claimable, claimAll, claimTier, passTier, refreshPass, rewardText, unclaimed, type Track } from "../logic/pass";
import { freeReward, PASS_TIERS, premiumReward, seasonEndsIn, seasonTheme, XP_PER_TIER, type PassReward } from "../data/pass";
import { PASS_PRICE } from "../data/premium";
import { currentTheme, islandLevel, swapMission } from "../logic/progress";
import { CITY_NAME, DISTRICTS, districtOpen, nextDistrict } from "../logic/city";
import { districtTowers } from "../logic/skyline";
import { drawThemePreview } from "../render/previews";
import { titleFor } from "../data/titles";
import { dayKey, dayNumber, duration } from "../logic/rules";
import { isNative, reminderTime, setReminder, type ReminderInfo } from "../native";
import type { Online, Row } from "../online";
import { $, closeModal, displayName, esc, LOCK_ICON, openModal, replay, showTab, toast, vibrate, wireModal } from "./dom";
import type { Host } from "./sheets";

export interface DailyHost extends Host {
  readonly online: Online;
  /** Posts this player's numbers to the leaderboard. */
  postScores(): void;
  /** What the phone apps' reminder notifications should say. */
  reminderInfo(): ReminderInfo;
  /** Opens the shop on the Sky Crystals tab. */
  openCrystalShop(): void;
}

/** Time until local midnight, when missions and the streak day roll over. */
function untilMidnight(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now;
}

export class DailySheets {
  private tab: "daily" | "week" | "best" = "daily";

  constructor(private readonly host: DailyHost) {
    for (const id of ["streak", "missions", "city", "ranks", "pass"]) wireModal($(id));
    $("pass-claim-all").addEventListener("click", () => {
      const got = claimAll(this.save);
      if (!got.length) return;
      this.celebrate(tn(got.length, "Claimed {n} reward: {list}", "Claimed {n} rewards: {list}", { list: got.map(rewardText).join(", ") }));
      this.renderPass();
    });
    document.querySelectorAll<HTMLButtonElement>("#ranks .tabs button").forEach(b => b.addEventListener("click", () => {
      this.tab = b.dataset.tab as typeof this.tab;
      this.host.sound.click();
      void this.renderRanks();
    }));
    $("nick-save").addEventListener("click", () => this.saveNick());
    $("nick").addEventListener("keydown", e => { if (e.key === "Enter") this.saveNick(); });
    $("reminder-btn").addEventListener("click", () => this.addReminder());
    // In the apps, changing the time moves a reminder that's already on.
    $("reminder-time").addEventListener("change", e => {
      const t = (e.target as HTMLInputElement).value;
      if (isNative() && reminderTime() && t) void setReminder(t, this.host.reminderInfo());
    });
    host.online.onChange = () => { if (!$("ranks").hidden) void this.renderRanks(); };
  }

  private get save() { return this.host.save; }

  /** Redraws whichever of these sheets is open (after the language changes). */
  rerenderOpen(): void {
    if (!$("streak").hidden) this.renderStreak();
    if (!$("missions").hidden) this.renderMissions();
    if (!$("city").hidden) this.renderCity();
    if (!$("ranks").hidden) void this.renderRanks();
    if (!$("pass").hidden) this.renderPass();
  }

  private click(): void {
    this.host.sound.ensure();
    this.host.sound.click();
  }

  private celebrate(msg: string): void {
    this.host.persist();
    this.host.sound.coins();
    vibrate(this.save.settings.vibrate, [15, 30, 15]);
    toast(msg);
    this.host.refresh();
  }

  // ---------- Quick claims from the main menu ----------

  collectRent(): void {
    this.host.sound.ensure();
    const n = collectRent(this.save);
    if (n > 0) this.celebrate(t("+{n} ★ from your tower's rent", { n: fmt(n) }));
    if (!$("city").hidden) this.renderCity();
  }

  openChest(): void {
    this.host.sound.ensure();
    const r = claimChest(this.save);
    if (!r) return;
    this.host.sound.unlock();
    this.celebrate(t("Chest opened: +{stars} ★ and +100 pass XP! New missions tomorrow", { stars: r.stars }));
    if (!$("missions").hidden) this.renderMissions();
  }

  // ---------- Streak ----------

  openStreak(): void {
    this.click();
    this.renderStreak();
    openModal($("streak"));
  }

  private renderStreak(): void {
    const v = streakView(this.save), s = this.save.streak;
    $("streak-big").textContent = String(v.count);
    $("streak-sub").textContent = t("Best ever: {best} days", { best: s.best }) + " · " + tn(v.freezes, "{n} streak freeze", "{n} streak freezes");
    $("streak-note").textContent = v.doneToday
      ? t("Done for today! Come back tomorrow to make it {n}. New day in {time}.", { n: v.count + 1, time: duration(untilMidnight()) })
      : v.needsFreeze ? t("You missed yesterday, but a streak freeze will save your streak if you build a tower today.")
      : v.atRisk ? t("Build any tower today to keep your streak. {time} left.", { time: duration(untilMidnight()) })
      : t("Build a tower every day to grow your streak. Miss a day and a streak freeze (one free each week) keeps it alive.");
    $("streak-track").innerHTML = STREAK_REWARDS.map(r => {
      const got = s.claimed.includes(r.day), skin = r.skin ? t(skinById(r.skin).name) : "";
      return `<div class="streak-step${got ? " done" : ""}${!got && v.next === r ? " next" : ""}">
        <b>${r.day}</b><span>${esc(t("days"))}</span>
        <small>+${r.stars} ★${skin ? `<br>${esc(t("{name} skin", { name: skin }))}` : ""}</small>
      </div>`;
    }).join("");
    // Calendar files download on a normal website; the claude.ai page can't save them.
    // The phone apps use real notifications instead.
    $("reminder").hidden = !isNative() && !!(window as unknown as { claude?: unknown }).claude;
    this.renderReminder();
  }

  private renderReminder(): void {
    if (!isNative()) return;
    const on = reminderTime();
    if (on) $<HTMLInputElement>("reminder-time").value = on;
    $("reminder-btn").textContent = on ? t("Turn off the reminder") : t("Remind me every day");
  }

  private addReminder(): void {
    if (isNative()) { void this.toggleNativeReminder(); return; }
    const [hh, mm] = ($<HTMLInputElement>("reminder-time").value || "19:00").split(":").map(Number);
    const start = new Date();
    start.setHours(hh || 19, mm || 0, 0, 0);
    if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
    const p = (n: number) => String(n).padStart(2, "0");
    const local = (d: Date) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
    const url = location.origin + location.pathname;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Skyrise//Daily reminder//EN", "BEGIN:VEVENT",
      `UID:skyrise-daily-${Date.now()}@skyrise`, `DTSTAMP:${local(new Date())}`, `DTSTART:${local(start)}`, "DURATION:PT10M",
      "RRULE:FREQ=DAILY", `SUMMARY:${t("🔥 Skyrise: keep your streak going")}`, `DESCRIPTION:${t("Today's tower is ready.")} ${url}`, `URL:${url}`,
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${t("Skyrise: today's tower is ready")}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "skyrise-reminder.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(t("Open the downloaded file to add the reminder to your calendar"));
  }

  private async toggleNativeReminder(): Promise<void> {
    this.click();
    const time = reminderTime() ? "" : ($<HTMLInputElement>("reminder-time").value || "19:00");
    const r = await setReminder(time, this.host.reminderInfo());
    toast(r === "denied" ? t("Notifications are off for Skyrise. Turn them on in your phone's settings.")
      : r === "on" ? t("We'll remind you at {time} on days you haven't played yet", { time }) : t("Daily reminder turned off"));
    this.renderReminder();
  }

  // ---------- Sky Pass ----------

  openPass(): void {
    this.click();
    markSeen(this.save, "pass");
    refreshPass(this.save);
    this.host.persist();
    this.renderPass();
    openModal($("pass"));
    // Show the next tier to earn rather than tier 1.
    const next = $("pass-tiers").querySelector<HTMLElement>(".pass-row.next");
    if (next) next.scrollIntoView({ block: "center" });
  }

  /** Redraws the pass if it's open. */
  refreshPass(): void {
    if (!$("pass").hidden) this.renderPass();
  }

  private renderPass(): void {
    const save = this.save, season = save.pass.season, theme = seasonTheme(season);
    const tier = passTier(save), days = Math.max(1, Math.ceil(seasonEndsIn() / 864e5));
    $("pass-season").innerHTML = `<b style="color:${theme.color}">${esc(t(theme.name))}</b> · ${esc(tn(days, "ends in {n} day", "ends in {n} days"))}`;
    $("pass-tier").textContent = String(tier);
    const into = tier >= PASS_TIERS ? XP_PER_TIER : save.pass.xp - tier * XP_PER_TIER;
    $("pass-bar").style.width = `${(into / XP_PER_TIER) * 100}%`;
    $("pass-next").textContent = tier >= PASS_TIERS ? t("Every tier reached. Amazing!") : t("{xp} / {need} XP to tier {n}", { xp: into, need: XP_PER_TIER, n: tier + 1 });

    const prem = $("pass-premium");
    if (save.pass.premium) {
      prem.innerHTML = `<b>${esc(t("✦ Premium pass active"))}</b><small>${esc(t("{theme}. Every premium reward is yours to claim.", { theme: t(theme.text) }))}</small>`;
      prem.classList.add("on");
    } else {
      prem.classList.remove("on");
      prem.innerHTML = `<div><b>${esc(t("✦ Unlock the premium track"))}</b><small>${esc(t("{first} skin now, {last} at tier 30, and {n} 💎 back along the way.", { first: t(skinById(theme.skins.first).name), last: t(skinById(theme.skins.last).name), n: fmt(seasonCrystals(season)) }))}</small></div>
        <button type="button" class="buy" id="pass-buy">💎 ${PASS_PRICE}</button>`;
      prem.querySelector("#pass-buy")!.addEventListener("click", () => {
        const r = buyPremiumPass(save);
        if (r === "short") {
          toast(t("You need {n} more Sky Crystals", { n: PASS_PRICE - save.crystals }));
          closeModal($("pass"));
          this.host.openCrystalShop();
          return;
        }
        if (r !== "ok") return;
        this.host.sound.purchase();
        this.celebrate(t("Premium Sky Pass unlocked! Claim your rewards"));
        this.renderPass();
      });
    }

    const waiting = unclaimed(save);
    const all = $<HTMLButtonElement>("pass-claim-all");
    all.hidden = waiting === 0;
    all.textContent = t("Claim all rewards ({n})", { n: waiting });

    const list = $("pass-tiers");
    list.innerHTML = "";
    for (let tr = 1; tr <= PASS_TIERS; tr++) {
      const row = document.createElement("div");
      row.className = `pass-row${tr <= tier ? " reached" : ""}${tr === tier + 1 ? " next" : ""}`;
      row.innerHTML = `<span class="pass-num">${tr}</span>`;
      for (const track of ["free", "prem"] as Track[]) {
        const r = track === "free" ? freeReward(season, tr) : premiumReward(season, tr);
        const done = save.pass[track].includes(tr), can = claimable(save, track, tr);
        const locked = track === "prem" && !save.pass.premium;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `pass-cell ${track}${done ? " done" : ""}${can ? " ready" : ""}${locked ? " locked" : ""}${r.skin ? " skin" : ""}`;
        cell.disabled = !can;
        cell.innerHTML = `<span class="pass-ico" aria-hidden="true">${rewardIcon(r)}</span><span>${esc(rewardText(r))}</span>${done ? '<i aria-hidden="true">✓</i>' : locked ? `<i aria-hidden="true">${LOCK_ICON}</i>` : ""}`;
        cell.setAttribute("aria-label", t(track === "free" ? "Tier {n} free reward: {reward}" : "Tier {n} premium reward: {reward}", { n: tr, reward: rewardText(r) }) + (done ? t(", claimed") : can ? t(", tap to claim") : ""));
        cell.addEventListener("click", () => {
          const got = claimTier(save, track, tr);
          if (!got) return;
          this.celebrate(t("Claimed: {reward}", { reward: rewardText(got) }));
          this.renderPass();
        });
        row.appendChild(cell);
      }
      list.appendChild(row);
    }
  }

  // ---------- Missions, chest and league ----------

  openMissions(): void {
    this.click();
    markSeen(this.save, "missions");
    this.save.missions.seen = this.save.missions.done;
    this.host.persist();
    this.renderMissions();
    this.host.refresh();
    showTab($("missions"), "today");
    openModal($("missions"));
  }

  private renderMissions(): void {
    const save = this.save, m = save.missions;
    const done = m.slots.filter(x => x.d).length;
    $("missions-count").textContent = t("{n} of 3 done · new in {time}", { n: done, time: duration(untilMidnight()) });
    const canSwap = save.profile.swapDay !== dayKey(0);
    const list = $("mission-list");
    list.innerHTML = m.slots.map((x, i) => `
      <div class="mission${x.d ? " done" : ""}">
        <b>${x.d ? "✓ " : ""}${esc(missionText(x))}</b>
        <span class="reward-tag">+${x.r} ★</span>
        <div class="m-bar"><i style="width:${Math.min(100, x.p / x.n * 100)}%"></i></div>
        <small>${esc(x.d ? t("Done!") : t(MISSION_TYPES[x.t].game ? "Best so far: {p} of {n}" : "{p} of {n}", { p: fmt(Math.min(x.p, x.n)), n: fmt(x.n) }))}</small>
        ${canSwap && !x.d ? `<button type="button" class="swap" data-i="${i}">${esc(t("Swap for a new mission (1 a day)"))}</button>` : ""}
      </div>`).join("");
    list.querySelectorAll<HTMLButtonElement>(".swap").forEach(b => b.addEventListener("click", () => {
      if (swapMission(save, Number(b.dataset.i))) { this.host.persist(); this.click(); }
      this.renderMissions();
    }));

    const ready = chestReady(save), opened = m.chest === dayKey(0);
    const chest = $("chest-card");
    chest.className = `chest-card${ready ? " ready" : ""}${opened ? " opened" : ""}`;
    chest.innerHTML = `<span class="chest-ico" aria-hidden="true">${opened ? "📭" : "🧰"}</span>
      <span><b>${esc(opened ? t("Chest opened") : t("Daily chest"))}</b><small>${esc(opened ? t("A new one tomorrow") : t("All 3 done: +{stars} ★", { stars: CHEST.stars }))}</small></span>
      ${ready ? `<button type="button" class="buy" id="chest-open">${esc(t("Open"))}</button>` : `<span class="chest-dots">${[0, 1, 2].map(i => `<i class="${i < done ? "on" : ""}"></i>`).join("")}</span>`}`;
    chest.querySelector("#chest-open")?.addEventListener("click", () => this.openChest());

    const L = save.league, tier = leagueFor(L.points), next = LEAGUES[LEAGUES.indexOf(tier) + 1];
    const pct = next ? (L.points - tier.min) / (next.min - tier.min) : 1;
    $("league-card").innerHTML = `
      <div class="league-head"><span class="league-badge" style="--tier:${tier.color}">${esc(t(tier.name))}</span>
        <span><b>${esc(t("{n} points", { n: fmt(L.points) }))}</b><small>${esc(t("Week ends in {time}", { time: duration(eventEndsIn()) }))}</small></span></div>
      <div class="bar"><i style="width:${pct * 100}%"></i></div>
      <small class="league-next">${esc(next ? t("{n} more for {league} · +{stars} ★", { n: fmt(next.min - L.points), league: t(next.name), stars: next.stars }) : t("Top league!"))}</small>
      <div class="league-ladder">${LEAGUES.map(l => `<span class="${l === tier ? "on" : l.min <= L.points ? "past" : ""}" style="--tier:${l.color}">${esc(t(l.name))}</span>`).join("")}</div>
      <small class="league-how">${esc(t("Every tower earns points. Daily towers count double."))}</small>`;
  }

  // ---------- City ----------

  openCity(): void {
    this.click();
    markSeen(this.save, "city");
    this.host.persist();
    this.renderCity();
    this.host.refresh();
    showTab($("city"), "districts");
    openModal($("city"));
  }

  /** Population, the next district, and each district with "Build here". */
  private renderDistricts(): void {
    const save = this.save, next = nextDistrict(save), here = currentTheme(save);
    const prev = next ? [...DISTRICTS].reverse().find(d => d.people < next.people)?.people ?? 0 : 0;
    const pct = next ? Math.min(1, (save.population - prev) / Math.max(1, next.people - prev)) : 1;
    $("pop-card").innerHTML = `<span class="pop-ico" aria-hidden="true">🏙️</span>
      <span><small>${esc(t(CITY_NAME))}</small><b>${esc(t("{n} people", { n: fmt(save.population) }))}</b>
      <small>${esc(next ? t("{n} more opens {name}", { n: fmt(next.people - save.population), name: t(next.name) }) : t("Every district is open!"))}</small>
      <span class="bar"><i style="width:${pct * 100}%"></i></span></span>`;
    const list = $("district-list");
    list.innerHTML = "";
    for (const d of DISTRICTS) {
      const open = districtOpen(save, d), on = d.id === here.id, towers = districtTowers(save, d.id).length;
      const card = document.createElement("div");
      card.className = `district${open ? "" : " locked"}${on ? " on" : ""}`;
      const name = t(d.name);
      card.innerHTML = `<canvas aria-hidden="true"></canvas><span class="d-text"><b>${esc(name)}</b>
        <small>${esc(open ? tn(towers, "{n} tower stands here", "{n} towers stand here") : d.product ? t("{n} people, or get it in the Shop", { n: fmt(d.people) }) : t("Opens at {n} people", { n: fmt(d.people) }))}</small></span>
        <button type="button" class="buy"${open && !on ? "" : " disabled"}>${on ? esc(t("Building here")) : open ? esc(t("Build here")) : LOCK_ICON}</button>`;
      drawThemePreview(card.querySelector("canvas")!, d);
      card.querySelector("button")!.addEventListener("click", () => {
        save.island = d.id;
        this.host.persist();
        this.host.sound.click();
        this.renderCity();
        this.host.refresh();
        toast(t("Your next towers go up in {name}", { name }));
      });
      list.appendChild(card);
    }
  }

  private renderCity(): void {
    this.renderDistricts();
    const save = this.save, waiting = rentWaiting(save), rate = rentPerHour(save);
    $("city-balance").textContent = t("You have {n} ★", { n: fmt(save.stars) });
    const full = rentFullIn(save);
    $("rent-card").innerHTML = `<span class="rent-ico" aria-hidden="true">🏦</span>
      <span><b>${esc(t("{n} ★ of rent", { n: fmt(waiting) }))}</b>
      <small>${esc(t("{n} ★ an hour", { n: rate < 10 ? rate.toFixed(1) : fmt(Math.round(rate)) }))} · ${esc(full > 0 ? t("full in {time}", { time: duration(full * 36e5) }) : t("full (holds {n} hours)", { n: RENT_CAP_HOURS }))}</small></span>
      <button type="button" class="buy" id="rent-collect"${waiting > 0 ? "" : " disabled"}>${esc(t("Collect"))}</button>`;
    $("rent-collect").addEventListener("click", () => this.collectRent());

    const list = $("build-list");
    list.innerHTML = "";
    for (const b of CITY) {
      const owned = save.city.includes(b.id), poor = save.stars < b.price;
      const row = document.createElement("div");
      row.className = `build-card${owned ? " owned" : ""}`;
      const name = t(b.name);
      row.innerHTML = `<span class="build-ico" aria-hidden="true">${b.icon}</span><b>${esc(name)}</b>
        <small>${esc(t(b.text))}</small>
        <button type="button" class="buy"${owned ? " disabled" : ""}>${owned ? esc(t("✓ Built")) : `${fmt(b.price)} ★`}</button>`;
      const btn = row.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", owned ? t("{name}, built", { name }) : t("Build {name} for {n} stars, adds {pct}% rent", { name, n: b.price, pct: Math.round(RENT_BONUS_PER_BUILD * 100) }));
      btn.addEventListener("click", () => {
        if (poor) {
          this.host.sound.click();
          toast(t("You need {n} more ★. Collect rent and open daily chests to earn more.", { n: fmt(b.price - save.stars) }));
          replay(btn, "nope");
          return;
        }
        if (buyBuild(save, b.id) === "ok") {
          this.host.sound.unlock();
          this.celebrate(t("{name} built on your island!", { name }));
          this.renderCity();
        }
      });
      list.appendChild(row);
    }
    const lvl = islandLevel(save);
    $("island-list").innerHTML = ISLAND_UPGRADES.map((u, i) => `
      <div class="row-item${i < lvl ? " done" : ""}">
        <span><b>${esc(t(u.name))}</b><small>${esc(t("Build taller than {name}", { name: t(MILESTONES[u.at].name) }))}</small></span>
        <span class="state">${i < lvl ? esc(t("Built")) : `${MILESTONES[u.at].m + 1} m`}</span>
      </div>`).join("");
  }

  // ---------- Leaderboard ----------

  openRanks(): void {
    this.click();
    $<HTMLInputElement>("nick").value = this.save.nickname;
    void this.renderRanks();
    openModal($("ranks"));
  }

  private async renderRanks(): Promise<void> {
    const on = this.host.online, today = dayNumber(), week = weekIndex(), tab = this.tab;
    document.querySelectorAll<HTMLButtonElement>("#ranks .tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    const global = on.kind === "global";
    $("ranks-sub2").textContent = global ? t("Builders all over the world") : t("Friends you share Skyrise with");
    const el = $("rank-list");
    if (global && !el.children.length) el.innerHTML = `<p class="history-empty">${esc(t("Loading…"))}</p>`;
    const board = await on.board(tab, today, week);
    if (tab !== this.tab) return; // switched tabs while loading
    el.innerHTML = "";
    if (!board.rows.length) {
      el.innerHTML = `<p class="history-empty">${esc(tab === "daily" ? t("Nobody has built today's Daily yet. Be the first!") : t("No scores yet."))}</p>`;
    }
    const unit = (r: Row) => esc(r.unit === "pts" ? t("pts") : t("people"));
    const titleChip = (r: Row) => {
      if (!r.level) return "";
      const ti = titleFor(r.level);
      return `<span class="title-chip${ti.glow ? " glow" : ""}" style="--tier:${ti.color}">${ti.icon} ${esc(t("Lv {n}", { n: r.level }))}</span>`;
    };
    const line = (r: Row) => {
      const row = document.createElement("div");
      const canReport = global && !r.me && !this.save.blocked.includes(r.id);
      row.className = `rank-row${r.me ? " me" : ""}${canReport ? " has-report" : ""}`;
      row.innerHTML = `<span class="rank">${fmt(r.rank)}</span>${avatarHtml(r.id)}<span class="who"><span class="nm"></span>${titleChip(r)}${r.streak && r.streak > 1 ? `<span class="fire">🔥${r.streak}</span>` : ""}</span><b>${fmt(r.value)} <small>${unit(r)}</small></b>`;
      row.querySelector(".nm")!.textContent = displayName(r.name) + (r.me ? t(" (you)") : "");
      if (canReport) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "report";
        btn.textContent = "⚑";
        btn.setAttribute("aria-label", t("Report or hide {name}", { name: displayName(r.name) }));
        btn.addEventListener("click", () => void this.report(r));
        row.appendChild(btn);
      }
      return row;
    };
    // The top three stand on a podium: second, first (with a crown), third.
    const podium = $("rank-podium"), top3 = board.rows.slice(0, 3);
    podium.hidden = !top3.length;
    podium.innerHTML = [top3[1], top3[0], top3[2]].map((r, i) => {
      if (!r) return `<div class="pod empty"></div>`;
      const place = [2, 1, 3][i];
      return `<div class="pod p${place}${r.me ? " me" : ""}">
        ${place === 1 ? `<span class="crown" aria-hidden="true">👑</span>` : ""}
        ${avatarHtml(r.id, true)}
        <span class="pod-name"></span>${titleChip(r)}
        <b>${fmt(r.value)}</b>
        <span class="step">${["🥇", "🥈", "🥉"][place - 1]}</span>
      </div>`;
    }).join("");
    podium.querySelectorAll<HTMLElement>(".pod-name").forEach((el, i) => {
      const r = [top3[1], top3[0], top3[2]].filter(Boolean)[i];
      if (r) el.textContent = displayName(r.name) + (r.me ? t(" (you)") : "");
    });
    // Who to beat next.
    const me = board.me ?? board.rows.find(r => r.me) ?? null, ahead = me && me.rank > 1 ? board.rows.find(r => r.rank === me.rank - 1) : null;
    const chase = $("rank-chase");
    chase.hidden = !me;
    if (me) chase.textContent = me.rank === 1 ? t("👑 You're #1! Keep building to stay on top.")
      : ahead ? t("⚔️ You're #{rank}. {gap} more {unit} to pass {name}!", { rank: fmt(me.rank), gap: fmt(Math.max(1, ahead.value - me.value + 1)), unit: me.unit === "pts" ? t("pts") : t("people"), name: displayName(ahead.name) })
      : t("You're #{rank}. Keep climbing!", { rank: fmt(me.rank) });
    board.rows.slice(3, 100).forEach(r => el.appendChild(line(r)));
    // Outside the top 100: your own row at the bottom.
    if (board.me && !board.rows.some(r => r.me)) {
      const gap = document.createElement("p");
      gap.className = "rank-gap";
      gap.textContent = "⋯";
      el.append(gap, line(board.me));
    }
    $("ranks-note").textContent = on.stale ? t("Can't reach the leaderboard right now. It may be out of date.")
      : global ? (tab === "week" ? t("Your best Classic or Daily tower this week. Every tower is checked by replaying it.")
        : tn(board.total, "{count} builder ranked. Every tower is checked by replaying it.", "{count} builders ranked. Every tower is checked by replaying it.", { count: fmt(board.total) }))
      : !on.canPost ? t("Your scores aren't posted yet: ask whoever shared Skyrise to make you a Contributor.")
      : t("Share this page with friends as Contributors to compete.");
  }

  /** Reports a rude name and hides it for this player. */
  private async report(r: Row): Promise<void> {
    if (!window.confirm(t("Report \"{name}\" as an offensive name? It will be hidden for you, and names reported by several players are removed.", { name: r.name }))) return;
    const save = this.save;
    if (!save.blocked.includes(r.id)) save.blocked.push(r.id);
    this.host.online.blocked.add(r.id);
    this.host.persist();
    const sent = await this.host.online.report(save, r.id, () => this.host.persist());
    toast(sent ? t("Thanks. That name is hidden for you and was reported.") : t("That name is hidden for you. The report will need a connection."));
    void this.renderRanks();
  }

  private saveNick(): void {
    const v = $<HTMLInputElement>("nick").value.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16);
    this.save.nickname = v;
    $<HTMLInputElement>("nick").value = v;
    this.host.persist();
    this.host.postScores();
    this.host.sound.click();
    toast(v ? t(this.host.online.kind === "global" ? "You're \"{name}\" on the leaderboard from your next tower" : "You're \"{name}\" on the leaderboard", { name: v }) : t("Using your default name on the leaderboard"));
    void this.renderRanks();
  }

  /** For the main menu. */
  closeAll(): void {
    for (const id of ["streak", "missions", "city", "ranks"]) if (!$(id).hidden) closeModal($(id));
  }
}

function rewardIcon(r: PassReward): string {
  if (r.skin) return "🏙️";
  if (r.crystals) return "💎";
  if (r.stars) return "★";
  if (r.boost) return "⚡";
  return "★";
}

/** Crystals the premium track pays back over a season. */
function seasonCrystals(season: number): number {
  let n = 0;
  for (let t = 1; t <= PASS_TIERS; t++) n += premiumReward(season, t).crystals ?? 0;
  return n;
}

/** A little avatar for a player, made from their id: a color and a building. */
function avatarHtml(id: string, big = false): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const icons = ["🏙️", "🏢", "🏰", "🗼", "🏯", "🌆", "🏗️", "🌇", "🏛️", "🕌", "⛩️", "🎡"];
  const hue = h % 360;
  return `<span class="avatar${big ? " avatar-lg" : ""}" style="background:linear-gradient(135deg,hsl(${hue} 70% 62%),hsl(${(hue + 50) % 360} 70% 45%))" aria-hidden="true">${icons[(h >>> 8) % icons.length]}</span>`;
}

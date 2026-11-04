// Sheets for the daily features: the streak, today's missions with their chest and the weekly
// league, the city (rent and buildings), and the leaderboard.
import { fmt } from "../core/util";
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
import { islandLevel, swapMission } from "../logic/progress";
import { dayKey, dayNumber, duration } from "../logic/rules";
import { isNative, reminderTime, setReminder, type ReminderInfo } from "../native";
import type { Online, Row } from "../online";
import { $, closeModal, esc, LOCK_ICON, openModal, replay, showTab, toast, vibrate, wireModal } from "./dom";
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
      this.celebrate(`Claimed ${got.length} reward${got.length > 1 ? "s" : ""}: ${got.map(rewardText).join(", ")}`);
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
    if (n > 0) this.celebrate(`+${fmt(n)} coins from your tower's rent`);
    if (!$("city").hidden) this.renderCity();
  }

  openChest(): void {
    this.host.sound.ensure();
    const r = claimChest(this.save);
    if (!r) return;
    this.host.sound.unlock();
    this.celebrate(`Chest opened: +${r.stars} ★, +${r.coins} coins and +100 pass XP! New missions tomorrow`);
    if (!$("missions").hidden) this.renderMissions();
  }

  // ---------- Streak ----------

  openStreak(): void {
    this.click();
    const v = streakView(this.save), s = this.save.streak;
    $("streak-big").textContent = String(v.count);
    $("streak-sub").textContent = `Best ever: ${s.best} days · ${v.freezes} streak freeze${v.freezes === 1 ? "" : "s"}`;
    $("streak-note").textContent = v.doneToday
      ? `Done for today! Come back tomorrow to make it ${v.count + 1}. New day in ${duration(untilMidnight())}.`
      : v.needsFreeze ? "You missed yesterday, but a streak freeze will save your streak if you build a tower today."
      : v.atRisk ? `Build any tower today to keep your streak. ${duration(untilMidnight())} left.`
      : "Build a tower every day to grow your streak. Miss a day and a streak freeze (one free each week) keeps it alive.";
    $("streak-track").innerHTML = STREAK_REWARDS.map(r => {
      const got = s.claimed.includes(r.day), skin = r.skin ? skinById(r.skin).name : "";
      return `<div class="streak-step${got ? " done" : ""}${!got && v.next === r ? " next" : ""}">
        <b>${r.day}</b><span>days</span>
        <small>+${r.stars} ★ · +${fmt(r.coins)} coins${skin ? `<br>${esc(skin)} skin` : ""}</small>
      </div>`;
    }).join("");
    // Calendar files download on a normal website; the claude.ai page can't save them.
    // The phone apps use real notifications instead.
    $("reminder").hidden = !isNative() && !!(window as unknown as { claude?: unknown }).claude;
    this.renderReminder();
    openModal($("streak"));
  }

  private renderReminder(): void {
    if (!isNative()) return;
    const on = reminderTime();
    if (on) $<HTMLInputElement>("reminder-time").value = on;
    $("reminder-btn").textContent = on ? "Turn off the reminder" : "Remind me every day";
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
      "RRULE:FREQ=DAILY", "SUMMARY:🔥 Skyrise: keep your streak going", `DESCRIPTION:Today's tower is ready. ${url}`, `URL:${url}`,
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Skyrise: today's tower is ready", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "skyrise-reminder.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Open the downloaded file to add the reminder to your calendar");
  }

  private async toggleNativeReminder(): Promise<void> {
    this.click();
    const time = reminderTime() ? "" : ($<HTMLInputElement>("reminder-time").value || "19:00");
    const r = await setReminder(time, this.host.reminderInfo());
    toast(r === "denied" ? "Notifications are off for Skyrise. Turn them on in your phone's settings."
      : r === "on" ? `We'll remind you at ${time} on days you haven't played yet` : "Daily reminder turned off");
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
    $("pass-season").innerHTML = `<b style="color:${theme.color}">${esc(theme.name)}</b> · ends in ${days} day${days === 1 ? "" : "s"}`;
    $("pass-tier").textContent = String(tier);
    const into = tier >= PASS_TIERS ? XP_PER_TIER : save.pass.xp - tier * XP_PER_TIER;
    $("pass-bar").style.width = `${(into / XP_PER_TIER) * 100}%`;
    $("pass-next").textContent = tier >= PASS_TIERS ? "Every tier reached. Amazing!" : `${into} / ${XP_PER_TIER} XP to tier ${tier + 1}`;

    const prem = $("pass-premium");
    if (save.pass.premium) {
      prem.innerHTML = `<b>✦ Premium pass active</b><small>${esc(theme.text)}. Every premium reward is yours to claim.</small>`;
      prem.classList.add("on");
    } else {
      prem.classList.remove("on");
      prem.innerHTML = `<div><b>✦ Unlock the premium track</b><small>${esc(skinById(theme.skins.first).name)} skin now, ${esc(skinById(theme.skins.last).name)} at tier 30, and ${fmt(seasonCrystals(season))} 💎 back along the way.</small></div>
        <button type="button" class="buy" id="pass-buy">💎 ${PASS_PRICE}</button>`;
      prem.querySelector("#pass-buy")!.addEventListener("click", () => {
        const r = buyPremiumPass(save);
        if (r === "short") {
          toast(`You need ${PASS_PRICE - save.crystals} more Sky Crystals`);
          closeModal($("pass"));
          this.host.openCrystalShop();
          return;
        }
        if (r !== "ok") return;
        this.host.sound.purchase();
        this.celebrate("Premium Sky Pass unlocked! Claim your rewards");
        this.renderPass();
      });
    }

    const waiting = unclaimed(save);
    const all = $<HTMLButtonElement>("pass-claim-all");
    all.hidden = waiting === 0;
    all.textContent = `Claim all rewards (${waiting})`;

    const list = $("pass-tiers");
    list.innerHTML = "";
    for (let t = 1; t <= PASS_TIERS; t++) {
      const row = document.createElement("div");
      row.className = `pass-row${t <= tier ? " reached" : ""}${t === tier + 1 ? " next" : ""}`;
      row.innerHTML = `<span class="pass-num">${t}</span>`;
      for (const track of ["free", "prem"] as Track[]) {
        const r = track === "free" ? freeReward(season, t) : premiumReward(season, t);
        const done = save.pass[track].includes(t), can = claimable(save, track, t);
        const locked = track === "prem" && !save.pass.premium;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `pass-cell ${track}${done ? " done" : ""}${can ? " ready" : ""}${locked ? " locked" : ""}${r.skin ? " skin" : ""}`;
        cell.disabled = !can;
        cell.innerHTML = `<span class="pass-ico" aria-hidden="true">${rewardIcon(r)}</span><span>${esc(rewardText(r))}</span>${done ? '<i aria-hidden="true">✓</i>' : locked ? `<i aria-hidden="true">${LOCK_ICON}</i>` : ""}`;
        cell.setAttribute("aria-label", `Tier ${t} ${track === "free" ? "free" : "premium"} reward: ${rewardText(r)}${done ? ", claimed" : can ? ", tap to claim" : ""}`);
        cell.addEventListener("click", () => {
          const got = claimTier(save, track, t);
          if (!got) return;
          this.celebrate(`Claimed: ${rewardText(got)}`);
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
    $("missions-count").textContent = `${done} of 3 done · new in ${duration(untilMidnight())}`;
    const canSwap = save.profile.swapDay !== dayKey(0);
    const list = $("mission-list");
    list.innerHTML = m.slots.map((x, i) => `
      <div class="mission${x.d ? " done" : ""}">
        <b>${x.d ? "✓ " : ""}${esc(missionText(x))}</b>
        <span class="reward-tag">+${x.r} ★</span>
        <div class="m-bar"><i style="width:${Math.min(100, x.p / x.n * 100)}%"></i></div>
        <small>${x.d ? "Done!" : MISSION_TYPES[x.t].game ? `Best so far: ${fmt(Math.min(x.p, x.n))} of ${fmt(x.n)}` : `${fmt(Math.min(x.p, x.n))} of ${fmt(x.n)}`}</small>
        ${canSwap && !x.d ? `<button type="button" class="swap" data-i="${i}">Swap for a new mission (1 a day)</button>` : ""}
      </div>`).join("");
    list.querySelectorAll<HTMLButtonElement>(".swap").forEach(b => b.addEventListener("click", () => {
      if (swapMission(save, Number(b.dataset.i))) { this.host.persist(); this.click(); }
      this.renderMissions();
    }));

    const ready = chestReady(save), opened = m.chest === dayKey(0);
    const chest = $("chest-card");
    chest.className = `chest-card${ready ? " ready" : ""}${opened ? " opened" : ""}`;
    chest.innerHTML = `<span class="chest-ico" aria-hidden="true">${opened ? "📭" : "🧰"}</span>
      <span><b>${opened ? "Chest opened" : "Daily chest"}</b><small>${opened ? "A new one tomorrow" : `All 3 done: +${CHEST.stars} ★ · +${CHEST.coins} coins`}</small></span>
      ${ready ? '<button type="button" class="buy" id="chest-open">Open</button>' : `<span class="chest-dots">${[0, 1, 2].map(i => `<i class="${i < done ? "on" : ""}"></i>`).join("")}</span>`}`;
    chest.querySelector("#chest-open")?.addEventListener("click", () => this.openChest());

    const L = save.league, tier = leagueFor(L.points), next = LEAGUES[LEAGUES.indexOf(tier) + 1];
    const pct = next ? (L.points - tier.min) / (next.min - tier.min) : 1;
    $("league-card").innerHTML = `
      <div class="league-head"><span class="league-badge" style="--tier:${tier.color}">${esc(tier.name)}</span>
        <span><b>${fmt(L.points)} points</b><small>Week ends in ${duration(eventEndsIn())}</small></span></div>
      <div class="bar"><i style="width:${pct * 100}%"></i></div>
      <small class="league-next">${next ? `${fmt(next.min - L.points)} more for ${esc(next.name)} · +${next.stars} ★` : "Top league!"}</small>
      <div class="league-ladder">${LEAGUES.map(l => `<span class="${l === tier ? "on" : l.min <= L.points ? "past" : ""}" style="--tier:${l.color}">${esc(l.name)}</span>`).join("")}</div>
      <small class="league-how">Every tower earns points. Daily towers count double.</small>`;
  }

  // ---------- City ----------

  openCity(): void {
    this.click();
    markSeen(this.save, "city");
    this.host.persist();
    this.renderCity();
    this.host.refresh();
    showTab($("city"), "build");
    openModal($("city"));
  }

  private renderCity(): void {
    const save = this.save, waiting = rentWaiting(save), rate = rentPerHour(save);
    $("city-balance").textContent = `${fmt(save.coins)} coins`;
    const full = rentFullIn(save);
    $("rent-card").innerHTML = `<span class="rent-ico" aria-hidden="true">🏦</span>
      <span><b>${fmt(waiting)} coins of rent</b>
      <small>${fmt(rate)} an hour · ${full > 0 ? `full in ${duration(full * 36e5)}` : `full (holds ${RENT_CAP_HOURS} hours)`}</small></span>
      <button type="button" class="buy" id="rent-collect"${waiting > 0 ? "" : " disabled"}>Collect</button>`;
    $("rent-collect").addEventListener("click", () => this.collectRent());

    const list = $("build-list");
    list.innerHTML = "";
    for (const b of CITY) {
      const owned = save.city.includes(b.id), poor = save.coins < b.price;
      const row = document.createElement("div");
      row.className = `build-card${owned ? " owned" : ""}`;
      row.innerHTML = `<span class="build-ico" aria-hidden="true">${b.icon}</span><b>${esc(b.name)}</b>
        <small>${esc(b.text)}</small>
        <button type="button" class="buy"${owned ? " disabled" : ""}>${owned ? "✓ Built" : `🪙 ${fmt(b.price)}`}</button>`;
      const btn = row.querySelector<HTMLButtonElement>(".buy")!;
      btn.setAttribute("aria-label", owned ? `${b.name}, built` : `Build ${b.name} for ${b.price} coins, adds ${Math.round(RENT_BONUS_PER_BUILD * 100)}% rent`);
      btn.addEventListener("click", () => {
        if (poor) {
          this.host.sound.click();
          toast(`You need ${fmt(b.price - save.coins)} more coins. Collect rent and open daily chests to earn more.`);
          replay(btn, "nope");
          return;
        }
        if (buyBuild(save, b.id) === "ok") {
          this.host.sound.unlock();
          this.celebrate(`${b.name} built on your island!`);
          this.renderCity();
        }
      });
      list.appendChild(row);
    }
    const lvl = islandLevel(save);
    $("island-list").innerHTML = ISLAND_UPGRADES.map((u, i) => `
      <div class="row-item${i < lvl ? " done" : ""}">
        <span><b>${esc(u.name)}</b><small>Build taller than ${esc(MILESTONES[u.at].name)}</small></span>
        <span class="state">${i < lvl ? "Built" : `${MILESTONES[u.at].m + 1} m`}</span>
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
    $("ranks-sub2").textContent = global ? "Builders all over the world" : "Friends you share Skyrise with";
    const el = $("rank-list");
    if (global && !el.children.length) el.innerHTML = `<p class="history-empty">Loading…</p>`;
    const board = await on.board(tab, today, week);
    if (tab !== this.tab) return; // switched tabs while loading
    el.innerHTML = "";
    if (!board.rows.length) {
      el.innerHTML = `<p class="history-empty">${tab === "daily" ? "Nobody has built today's Daily yet. Be the first!" : "No scores yet."}</p>`;
    }
    const line = (r: Row) => {
      const row = document.createElement("div");
      const canReport = global && !r.me && !this.save.blocked.includes(r.id);
      row.className = `rank-row${r.me ? " me" : ""}${canReport ? " has-report" : ""}`;
      const medal = ["🥇", "🥈", "🥉"][r.rank - 1] ?? fmt(r.rank);
      row.innerHTML = `<span class="rank">${medal}</span><span class="who"></span><span class="fire">${r.streak && r.streak > 1 ? `🔥${r.streak}` : r.level ? `Lv ${r.level}` : ""}</span><b>${fmt(r.value)} ${r.unit}</b>`;
      row.querySelector(".who")!.textContent = r.name + (r.me ? " (you)" : "");
      if (canReport) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "report";
        btn.textContent = "⚑";
        btn.setAttribute("aria-label", `Report or hide ${r.name}`);
        btn.addEventListener("click", () => void this.report(r));
        row.appendChild(btn);
      }
      return row;
    };
    board.rows.slice(0, 100).forEach(r => el.appendChild(line(r)));
    // Outside the top 100: your own row at the bottom.
    if (board.me && !board.rows.some(r => r.me)) {
      const gap = document.createElement("p");
      gap.className = "rank-gap";
      gap.textContent = "⋯";
      el.append(gap, line(board.me));
    }
    $("ranks-note").textContent = on.stale ? "Can't reach the leaderboard right now. It may be out of date."
      : global ? (tab === "week" ? "Your best Classic or Daily tower this week. Every tower is checked by replaying it."
        : `${fmt(board.total)} builder${board.total === 1 ? "" : "s"} ranked. Every tower is checked by replaying it.`)
      : !on.canPost ? "Your scores aren't posted yet: ask whoever shared Skyrise to make you a Contributor."
      : "Share this page with friends as Contributors to compete.";
  }

  /** Reports a rude name and hides it for this player. */
  private async report(r: Row): Promise<void> {
    if (!window.confirm(`Report "${r.name}" as an offensive name? It will be hidden for you, and names reported by several players are removed.`)) return;
    const save = this.save;
    if (!save.blocked.includes(r.id)) save.blocked.push(r.id);
    this.host.online.blocked.add(r.id);
    this.host.persist();
    const sent = await this.host.online.report(save, r.id, () => this.host.persist());
    toast(sent ? "Thanks. That name is hidden for you and was reported." : "That name is hidden for you. The report will need a connection.");
    void this.renderRanks();
  }

  private saveNick(): void {
    const v = $<HTMLInputElement>("nick").value.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16);
    this.save.nickname = v;
    $<HTMLInputElement>("nick").value = v;
    this.host.persist();
    this.host.postScores();
    this.host.sound.click();
    toast(v ? `You're "${v}" on the leaderboard${this.host.online.kind === "global" ? " from your next tower" : ""}` : "Using your default name on the leaderboard");
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
  return "🪙";
}

/** Crystals the premium track pays back over a season. */
function seasonCrystals(season: number): number {
  let n = 0;
  for (let t = 1; t <= PASS_TIERS; t++) n += premiumReward(season, t).crystals ?? 0;
  return n;
}

// Mayor Pip: the friendly face of Skyhaven. A strip on the home screen shows the current
// chapter's next goal; Pip pops up to start each chapter and to celebrate finishing one.
import { playerStarted } from "../edition";
import { CHAPTERS, GOAL_HOW, chapterIndex, chapterReady, claimChapter, goalDone, type Chapter, type ChapterGoal } from "../data/chapters";
import { CITY_NAME } from "../logic/city";
import { fmt } from "../core/util";
import { coins } from "../data/tycoon";
import { HAS_CITY } from "../edition";
import { hallOpens } from "../logic/tycoon";
import { landHall } from "../logic/land";
import { LAND } from "../data/land";
import { t } from "../i18n";
import type { SaveData } from "../logic/save";
import { $, esc, vibrate } from "./dom";
import { confetti, fireworks } from "./fx";

/** Mayor Pip, drawn: a round, kind face with shading, grey sideburns and a curled
 *  moustache, a navy suit with a gold mayor's sash and a red bow tie, and a glossy top hat.
 *  The eyes blink; on happy moments they become smiling arcs. */
export function mayorSvg(mood: "talk" | "happy" = "talk"): string {
  const eyes = mood === "happy"
    ? `<path d="M44 58q6-6 12 0M64 58q6-6 12 0" stroke="#2a1f3e" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<g class="mp-eyes">
        <ellipse cx="50" cy="58" rx="4.6" ry="5.4" fill="#fff"/><ellipse cx="70" cy="58" rx="4.6" ry="5.4" fill="#fff"/>
        <circle cx="50.8" cy="59" r="3.2" fill="#3a2a1a"/><circle cx="70.8" cy="59" r="3.2" fill="#3a2a1a"/>
        <circle cx="52" cy="57.6" r="1.2" fill="#fff"/><circle cx="72" cy="57.6" r="1.2" fill="#fff"/>
      </g>`;
  const mouth = mood === "happy"
    ? `<path d="M50 75q10 10 20 0z" fill="#8a2a2a"/><path d="M53 78q7 4 14 0" fill="#ff8a8a"/>`
    : `<path d="M52 76q8 6 16 0" stroke="#8a3a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="mp-skin" cx="0.42" cy="0.38" r="0.7"><stop offset="0" stop-color="#ffe6cf"/><stop offset="0.7" stop-color="#f6c49e"/><stop offset="1" stop-color="#e3a57d"/></radialGradient>
    <linearGradient id="mp-suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4cc0"/><stop offset="1" stop-color="#1f2a78"/></linearGradient>
    <linearGradient id="mp-hat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c1640"/><stop offset="0.35" stop-color="#3a2f80"/><stop offset="0.55" stop-color="#5a4ab0"/><stop offset="1" stop-color="#1c1640"/></linearGradient>
    <linearGradient id="mp-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset="0.5" stop-color="#ffc93c"/><stop offset="1" stop-color="#d0901a"/></linearGradient>
  </defs>
  <ellipse cx="60" cy="114" rx="36" ry="5" fill="rgba(20,20,60,0.18)"/>
  <path d="M22 116c2-22 18-33 38-33s36 11 38 33z" fill="url(#mp-suit)"/>
  <path d="M52 84l8 18 8-18z" fill="#fff"/>
  <path d="M44 86l12 22-6 4zM76 86l-12 22 6 4z" fill="#2a3590"/>
  <path d="M30 96l52 18-4 4-50-16z" fill="url(#mp-gold)"/>
  <path d="M53 88l7 4 7-4-2 7-5-2-5 2z" fill="#e8334f"/><circle cx="60" cy="92" r="2" fill="#b81f38"/>
  <circle cx="33" cy="62" r="6" fill="#efb48b"/><circle cx="87" cy="62" r="6" fill="#efb48b"/>
  <circle cx="60" cy="61" r="27" fill="url(#mp-skin)"/>
  <path d="M34 52q-2 10 3 17l4-12zM86 52q2 10-3 17l-4-12z" fill="#c9c9d6"/>
  <ellipse cx="44" cy="68" rx="5.5" ry="3.5" fill="#ff8a8a" opacity="0.45"/><ellipse cx="76" cy="68" rx="5.5" ry="3.5" fill="#ff8a8a" opacity="0.45"/>
  <path d="M44 50q6-4 11-1M65 49q5-3 11 1" stroke="#7a7a8a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  ${eyes}
  <ellipse cx="60" cy="66" rx="4" ry="3.2" fill="#e8a07a"/>
  <path d="M60 70c-5-1-10 0-14 3-3 2-5 1-6-1 1 4 5 6 9 4 4-2 8-3 11-2 3-1 7 0 11 2 4 2 8 0 9-4-1 2-3 3-6 1-4-3-9-4-14-3z" fill="#9a9aa8"/>
  ${mouth}
  <ellipse cx="60" cy="37" rx="33" ry="6.5" fill="#1c1640"/>
  <path d="M39 9q21-6 42 0v27q-21 4-42 0z" fill="url(#mp-hat)"/>
  <path d="M39 27q21 4 42 0v6q-21 4-42 0z" fill="url(#mp-gold)"/>
  <path d="M44 12q5-2 8-1v16q-4 0-8-1z" fill="rgba(255,255,255,0.18)"/>
</svg>`;
}
export const MAYOR_SVG = mayorSvg();

const goalText = (text: string, need: number) => t(text, { n: need >= 1e6 ? coins(need) : fmt(need) });
const say = (line: string) => t(line, { city: t(CITY_NAME) });

/** The home screen strip: the next goal of the current chapter, or "complete!". */
export function renderMayorStrip(save: SaveData, onTap: () => void): void {
  const el = $("mayor-strip"), i = chapterIndex(save), c = CHAPTERS[i];
  // New players meet the mayor after their first tower; after the last chapter Pip retires.
  el.hidden = !playerStarted(save) || !c;
  if (el.hidden) return;
  const ready = chapterReady(save);
  const next = c.goals.find(g => !goalDone(save, g)) ?? c.goals[0];
  const pct = ready ? 100 : Math.min(100, (next.have(save) / next.need) * 100);
  el.classList.toggle("ready", ready);
  el.innerHTML = `<span class="mayor-mini">${MAYOR_SVG}</span>
    <span class="mayor-goal"><small>${esc(head(i, c.title))}</small>
    <b>${esc(ready ? (HAS_CITY ? t("Upgrade the City Hall! Tap here") : t("Chapter complete! Tap to celebrate")) : goalText(next.text, next.need))}</b>
    <i class="mayor-bar"><i style="width:${pct}%"></i></i></span>`;
  el.onclick = onTap;
}

/** In the city game the story is the City Hall's levels: chapter i takes it to level i + 2. */
const head = (i: number, title: string) => HAS_CITY
  ? t("City Hall level {n} · {title}", { n: i + 1, title: t(title) })
  : t("Chapter {n}: {title}", { n: i + 1, title: t(title) });
/** What the City Hall's next level opens, as a line for the goal list ("" if nothing). */
function opensHtml(level: number): string {
  if (!HAS_CITY) return "";
  const names = hallOpens(level).map(b => t(b.name));
  const land = LAND.find(l => landHall(l.id) === level);
  if (land) names.push(t(land.name));
  return names.length ? `<li class="plan-opens"><span>🔓</span>${esc(t("Level {n} opens: {list}", { n: level, list: names.join(", ") }))}</li>` : "";
}

const num = (n: number) => (n >= 1e6 ? coins(n) : fmt(n));

/** The City Plan road: one step per chapter (done, this one, still ahead), and what's next. */
function planRoad(save: SaveData): string {
  const i = chapterIndex(save), next = CHAPTERS[i + 1];
  return `<li class="plan-road"><div>${CHAPTERS.map((c, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}" title="${esc(t(c.title))}"></i>`).join("")}</div>
    <small>${esc(next ? (HAS_CITY ? t("City Hall level {n} of {total} · next: {title}", { n: i + 1, total: CHAPTERS.length + 1, title: t(next.title) }) : t("City Plan: chapter {n} of {total} · next: {title}", { n: i + 1, total: CHAPTERS.length, title: t(next.title) })) : t("City Plan: the last chapter!"))}</small></li>`;
}

function goalsHtml(save: SaveData, c: Chapter): string {
  return planRoad(save) + (HAS_CITY ? `<li class="plan-to"><b>${esc(t("To reach City Hall level {n}:", { n: chapterIndex(save) + 2 }))}</b></li>` : "") + opensHtml(chapterIndex(save) + 2) + c.goals.map(g => {
    const done = goalDone(save, g), how = !done && g.kind ? GOAL_HOW[g.kind] : "";
    return `<li class="${done ? "done" : "todo"}"${!done && g.kind ? ` data-goal="${g.kind}" role="button" tabindex="0"` : ""}><span>${done ? "✓" : ""}</span><div class="g-txt">${esc(goalText(g.text, g.need))}${how ? `<small class="g-how">${esc(t(how))}</small>` : ""}</div>
      <em>${done ? "" : `${num(Math.min(g.have(save), g.need))} / ${num(g.need)}`}${!done && g.kind ? `<i class="g-go" aria-hidden="true"></i>` : ""}</em></li>`;
  }).join("");
}

function show(chapter: string, text: string, goals: string, reward: string, button: string, onOk: () => void, cancel = ""): void {
  const no = $<HTMLButtonElement>("mayor-no");
  no.hidden = !cancel;
  no.textContent = cancel;
  no.onclick = () => { $("mayor").hidden = true; };
  $("mayor-face").innerHTML = mayorSvg(reward ? "happy" : "talk");
  // (Pip's name back, after a neighbour spoke.)
  const nm = $("mayor-name");
  if (nm.dataset.pip === undefined) nm.dataset.pip = nm.textContent ?? "";
  nm.textContent = nm.dataset.pip;
  $("mayor").classList.remove("neighbour");
  $("mayor-chapter").textContent = chapter;
  $("mayor-text").textContent = text;
  $("mayor-goals").innerHTML = goals;
  $("mayor-goals").hidden = !goals;
  $("mayor-reward").innerHTML = reward;
  $("mayor-reward").hidden = !reward;
  const ok = $<HTMLButtonElement>("mayor-ok");
  ok.textContent = button;
  ok.onclick = () => { $("mayor").hidden = true; onOk(); };
  $("mayor").hidden = false;
  ok.focus();
  // A goal not done yet: tapping it closes the card and takes you where you do it.
  $("mayor-goals").querySelectorAll<HTMLElement>("[data-goal]").forEach(li => {
    li.onclick = () => { $("mayor").hidden = true; goalTap(li.dataset.goal as NonNullable<ChapterGoal["kind"]>); };
  });
}

/** Opens Pip for the current chapter: a celebration if it's done, else its goals. */
export function openMayor(save: SaveData, persist: () => void, celebrate: () => void, after: () => void): void {
  const i = chapterIndex(save), c = CHAPTERS[i];
  if (!c) return;
  if (chapterReady(save)) {
    const r = claimChapter(save)!;
    persist();
    celebrate();
    confetti();
    fireworks(4);
    const next = CHAPTERS[i + 1];
    // The city game: a big banner over the City Hall first (the camera flies to it), then
    // Pip with the reward and what the new level opens.
    if (HAS_CITY) { hallBanner(i + 2, save.cityName); vibrate(save.settings.vibrate, [20, 40, 20]); }
    window.setTimeout(() => show(HAS_CITY ? t("City Hall level {n}!", { n: i + 2 }) : t("Chapter {n} complete!", { n: i + 1 }), say(c.outro), opensHtml(i + 2),
      `<span>${r.cash ? `+${esc(coins(r.cash))}` : `+${r.stars} ★`}</span><span>+${r.crystals} 💎</span>`,
      next ? (HAS_CITY ? t("Let's build!") : t("On to chapter {n}!", { n: i + 2 })) : t("Thanks, Mayor!"),
      () => { if (next) { introduce(save, persist); } after(); }), HAS_CITY ? 2600 : 0);
    return;
  }
  show(head(i, c.title), say(c.intro), goalsHtml(save, c), "", t("Let's build!"), after);
}

/** Pip introduces the current chapter once (the first time the player reaches it). */
export function introduce(save: SaveData, persist: () => void): boolean {
  const i = chapterIndex(save), c = CHAPTERS[i];
  if (!c || save.chapters.seen >= i) return false;
  save.chapters.seen = i;
  persist();
  // Its goals are already done: no introduction, the strip says "Chapter complete!" instead.
  if (chapterReady(save)) return false;
  show(head(i, c.title), say(c.intro), goalsHtml(save, c), "", t("Let's build!"), () => {});
  return true;
}

/** Pip says something outside the chapters (one button to close). */
/** Pip offers a choice: each option is a button in the list; the main button closes. */
export function mayorChoice(title: string, text: string, options: { label: string; sub: string; onPick: () => void }[], button: string): void {
  show(title, text, options.map((o, i) => `<li class="mayor-pick"><button type="button" data-pick="${i}"><b>${esc(o.label)}</b><small>${esc(o.sub)}</small></button></li>`).join(""), "", button, () => {});
  $("mayor-goals").querySelectorAll<HTMLButtonElement>("[data-pick]").forEach(b => { b.onclick = () => { $("mayor").hidden = true; options[Number(b.dataset.pick)].onPick(); }; });
}

/** Pip with a checklist (the same list as a chapter's goals). */
export function mayorList(title: string, text: string, items: { done: boolean; text: string; note: string }[], button: string, onOk: () => void = () => {}): void {
  show(title, text, items.map(x => `<li class="${x.done ? "done" : ""}"><span>${x.done ? "✓" : ""}</span>${esc(x.text)}<em>${esc(x.note)}</em></li>`).join(""), "", button, onOk);
}

export function mayorNote(title: string, text: string, button: string, onOk: () => void = () => {}, cancel = ""): void {
  show(title, text, "", "", button, onOk, cancel);
}

/** The City Hall's level-up banner: a burst of light, "CITY HALL" and the new level, gone
 *  after a couple of seconds. */
export function hallBanner(level: number, city = ""): void {
  document.querySelector(".hall-banner")?.remove();
  const el = document.createElement("div");
  el.className = "hall-banner";
  el.setAttribute("role", "status");
  el.innerHTML = `<i class="hb-rays"></i><div class="hb-card"><small>${esc(city ? `${city} · ${t("City Hall")}` : t("City Hall"))}</small><b>${esc(t("Level {n}", { n: level }))}</b><em>${esc(t("Your town grows!"))}</em></div>`;
  document.body.appendChild(el);
  window.setTimeout(() => el.classList.add("out"), 2200);
  window.setTimeout(() => el.remove(), 2700);
}

/** A neighbour's face: a round, smiling face with their own skin, hair and shirt colours. */
export function neighbourFace(seed: number): string {
  const skins = ["#f6d0b0", "#e8b48a", "#c98a5e", "#8d5a3a", "#f2c39a", "#5a3a26"];
  const hairs = ["#3a2a1a", "#c0504d", "#f2c94c", "#1f1a17", "#8a5a3a", "#6a6f99", "#e8457a"];
  const shirts = ["#4f8bff", "#19a87a", "#ff8a3b", "#b48cff", "#ff4f8b", "#ffd23f"];
  const sk = skins[seed % skins.length], hr = hairs[(seed >> 3) % hairs.length], sh = shirts[(seed >> 5) % shirts.length], long = (seed >> 7) % 2 === 0;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#e9f4ff"/>
    <path d="M18 100c2-20 15-30 32-30s30 10 32 30z" fill="${sh}"/>
    ${long ? `<path d="M24 58c-4-26 6-42 26-42s30 16 26 42l-6-2c0-14-8-24-20-24s-20 10-20 24z" fill="${hr}"/>` : ""}
    <circle cx="50" cy="50" r="22" fill="${sk}"/>
    <path d="M28 46c0-15 10-24 22-24s22 9 22 24c-6-8-14-11-22-11s-16 3-22 11z" fill="${hr}"/>
    <circle cx="42" cy="51" r="2.8" fill="#2a1f3e"/><circle cx="58" cy="51" r="2.8" fill="#2a1f3e"/>
    <circle cx="37" cy="58" r="3.5" fill="#ff8aa8" opacity=".55"/><circle cx="63" cy="58" r="3.5" fill="#ff8aa8" opacity=".55"/>
    <path d="M43 60c4 4 10 4 14 0" fill="none" stroke="#2a1f3e" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

/** A neighbour talks (a request, a thank-you): their own face and name in Pip's card. */
export function neighbourNote(name: string, seed: number, eyebrow: string, text: string, reward: string, button: string, onOk: () => void, cancel = ""): void {
  show(eyebrow, text, "", reward, button, onOk, cancel);
  $("mayor-face").innerHTML = neighbourFace(seed);
  $("mayor-name").textContent = name;
  $("mayor").classList.add("neighbour");
}

/** Pip asks for a name: a text box in his card (with a suggestion filled in). */
export function mayorAsk(title: string, text: string, value: string, label: string, button: string, onOk: (v: string) => void, cancel = ""): void {
  show(title, text, `<li class="mayor-input"><input type="text" id="mayor-input" maxlength="18" autocomplete="off" spellcheck="false" aria-label="${esc(label)}" value="${esc(value)}"></li>`, "", button, () => onOk(($("mayor-input") as HTMLInputElement).value), cancel);
  const inp = $("mayor-input") as HTMLInputElement;
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("mayor-ok").click(); } };
  window.setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

let goalTap: (kind: NonNullable<ChapterGoal["kind"]>) => void = () => {};
/** What tapping a goal does (set by the town: open Build, a business, the company...). */
export function setGoalTap(f: (kind: NonNullable<ChapterGoal["kind"]>) => void): void { goalTap = f; }

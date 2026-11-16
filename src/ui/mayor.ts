// Mayor Pip: the friendly face of Skyhaven. A strip on the home screen shows the current
// chapter's next goal; Pip pops up to start each chapter and to celebrate finishing one.
import { CHAPTERS, chapterIndex, chapterReady, claimChapter, goalDone, type Chapter } from "../data/chapters";
import { CITY_NAME } from "../logic/city";
import { fmt } from "../core/util";
import { t } from "../i18n";
import type { SaveData } from "../logic/save";
import { $, esc } from "./dom";
import { confetti, fireworks } from "./fx";

/** Mayor Pip, drawn: a round face, rosy cheeks, a moustache and a tall hat with a gold band. */
export const MAYOR_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="mp-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0c2"/><stop offset="1" stop-color="#f7c49c"/></linearGradient>
    <linearGradient id="mp-hat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3aa8"/><stop offset="1" stop-color="#2a1f6e"/></linearGradient>
  </defs>
  <ellipse cx="60" cy="112" rx="34" ry="6" fill="rgba(20,20,60,0.18)"/>
  <path d="M26 112c2-20 16-30 34-30s32 10 34 30z" fill="#ff5f8f"/>
  <path d="M52 84l8 10 8-10" fill="#fff"/>
  <circle cx="60" cy="62" r="27" fill="url(#mp-face)"/>
  <circle cx="44" cy="68" r="5" fill="#ff9a9a" opacity="0.6"/><circle cx="76" cy="68" r="5" fill="#ff9a9a" opacity="0.6"/>
  <circle cx="50" cy="59" r="3.4" fill="#2a1f3e"/><circle cx="70" cy="59" r="3.4" fill="#2a1f3e"/>
  <circle cx="51.2" cy="57.8" r="1.1" fill="#fff"/><circle cx="71.2" cy="57.8" r="1.1" fill="#fff"/>
  <path d="M46 71c5-4 9-4 14-1 5-3 9-3 14 1-4 4-9 4-14 1-5 3-10 3-14-1z" fill="#8a5a3a"/>
  <path d="M54 77c3 2 9 2 12 0" stroke="#b5533a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="60" cy="38" rx="32" ry="6" fill="#2a1f6e"/>
  <rect x="40" y="6" width="40" height="32" rx="5" fill="url(#mp-hat)"/>
  <rect x="40" y="28" width="40" height="7" fill="#ffc93c"/>
</svg>`;

const goalText = (text: string, need: number) => t(text, { n: fmt(need) });
const say = (line: string) => t(line, { city: t(CITY_NAME) });

/** The home screen strip: the next goal of the current chapter, or "complete!". */
export function renderMayorStrip(save: SaveData, onTap: () => void): void {
  const el = $("mayor-strip"), i = chapterIndex(save), c = CHAPTERS[i];
  // New players meet the mayor after their first tower; after the last chapter Pip retires.
  el.hidden = save.profile.towers < 1 || !c;
  if (el.hidden) return;
  const ready = chapterReady(save);
  const next = c.goals.find(g => !goalDone(save, g)) ?? c.goals[0];
  const pct = ready ? 100 : Math.min(100, (next.have(save) / next.need) * 100);
  el.classList.toggle("ready", ready);
  el.innerHTML = `<span class="mayor-mini">${MAYOR_SVG}</span>
    <span class="mayor-goal"><small>${esc(t("Chapter {n}: {title}", { n: i + 1, title: t(c.title) }))}</small>
    <b>${esc(ready ? t("Chapter complete! Tap to celebrate") : goalText(next.text, next.need))}</b>
    <i class="mayor-bar"><i style="width:${pct}%"></i></i></span>`;
  el.onclick = onTap;
}

function goalsHtml(save: SaveData, c: Chapter): string {
  return c.goals.map(g => {
    const done = goalDone(save, g);
    return `<li class="${done ? "done" : ""}"><span>${done ? "✓" : ""}</span>${esc(goalText(g.text, g.need))}
      <em>${done ? "" : `${fmt(Math.min(g.have(save), g.need))} / ${fmt(g.need)}`}</em></li>`;
  }).join("");
}

function show(chapter: string, text: string, goals: string, reward: string, button: string, onOk: () => void): void {
  $("mayor-face").innerHTML = MAYOR_SVG;
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
    show(t("Chapter {n} complete!", { n: i + 1 }), say(c.outro), "",
      `<span>+${r.stars} ★</span><span>+${r.crystals} 💎</span>`,
      next ? t("On to chapter {n}!", { n: i + 2 }) : t("Thanks, Mayor!"),
      () => { if (next) { introduce(save, persist); } after(); });
    return;
  }
  show(t("Chapter {n}: {title}", { n: i + 1, title: t(c.title) }), say(c.intro), goalsHtml(save, c), "", t("Let's build!"), after);
}

/** Pip introduces the current chapter once (the first time the player reaches it). */
export function introduce(save: SaveData, persist: () => void): boolean {
  const i = chapterIndex(save), c = CHAPTERS[i];
  if (!c || save.chapters.seen >= i) return false;
  save.chapters.seen = i;
  persist();
  show(t("Chapter {n}: {title}", { n: i + 1, title: t(c.title) }), say(c.intro), goalsHtml(save, c), "", t("Let's build!"), () => {});
  return true;
}

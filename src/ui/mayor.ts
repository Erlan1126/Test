// Mayor Pip: the friendly face of Skyhaven. A strip on the home screen shows the current
// chapter's next goal; Pip pops up to start each chapter and to celebrate finishing one.
import { CHAPTERS, chapterIndex, chapterReady, claimChapter, goalDone, type Chapter } from "../data/chapters";
import { CITY_NAME } from "../logic/city";
import { fmt } from "../core/util";
import { coins } from "../data/tycoon";
import { t } from "../i18n";
import type { SaveData } from "../logic/save";
import { $, esc } from "./dom";
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

const num = (n: number) => (n >= 1e6 ? coins(n) : fmt(n));

function goalsHtml(save: SaveData, c: Chapter): string {
  return c.goals.map(g => {
    const done = goalDone(save, g);
    return `<li class="${done ? "done" : ""}"><span>${done ? "✓" : ""}</span>${esc(goalText(g.text, g.need))}
      <em>${done ? "" : `${num(Math.min(g.have(save), g.need))} / ${num(g.need)}`}</em></li>`;
  }).join("");
}

function show(chapter: string, text: string, goals: string, reward: string, button: string, onOk: () => void): void {
  $("mayor-face").innerHTML = mayorSvg(reward ? "happy" : "talk");
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

/** Pip says something outside the chapters (one button to close). */
export function mayorNote(title: string, text: string, button: string, onOk: () => void = () => {}): void {
  show(title, text, "", "", button, onOk);
}

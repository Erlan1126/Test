// Small DOM helpers shared by the screens.
import { haptic } from "../native";
import { t } from "../i18n";

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

/** Escapes text for use inside innerHTML templates. */
export const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const swatchHtml = (colors: string[]): string => colors.slice(0, 3).map(c => `<i style="background:${esc(c)}"></i>`).join("");

/** Restarts a CSS animation by toggling its class. */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Default names from the rankings ("Builder", "Builder 7QX2", "You", "Hidden player") in
 *  this language. Names players chose are left alone. */
export function displayName(name: string): string {
  if (name === "You" || name === "Hidden player" || name === "Builder") return t(name);
  const m = /^Builder ([A-Z0-9]{4})$/.exec(name);
  return m ? `${t("Builder")} ${m[1]}` : name;
}

let toastTimer = 0;
const TOAST_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const toastEsc = (s: string) => s.replace(/[&<>"']/g, c => TOAST_ESC[c]);
/** What kind of moment a message is, from its words: it sets the pop-up's colour and icon. */
function toastKind(msg: string): { kind: string; ico: string } {
  const m = msg.toLowerCase();
  if (/golden|tipped|vip|jackpot|crown|trophy|legend|record/.test(m)) return { kind: "gold", ico: "★" };
  if (/couldn|can't|cannot|not enough|no room|failed|error|offline|busy/.test(m)) return { kind: "warn", ico: "!" };
  if (/built|finished|opens|opened|done|grew|ready|unlocked|complete|moved in|level \d|lv \d/.test(m)) return { kind: "good", ico: "✓" };
  if (/[$€£]|\+\d|earn|cash|paid|sale|rent/.test(m)) return { kind: "money", ico: "$" };
  return { kind: "info", ico: "✦" };
}
/** A message pop-up: a coloured card with an icon, the amounts picked out in gold, a short
 *  slide-in with a bounce, and a bar showing how long it stays. Tap it to dismiss. */
/** Shrinks a one-line title until it fits its box (never below `min` px), instead of
 *  cutting it off with "...". */
export function fitText(el: HTMLElement | null, min = 11): void {
  if (!el) return;
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize) || 16;
  while (el.scrollWidth > el.clientWidth + 1 && size > min) { size -= 1; el.style.fontSize = `${size}px`; }
}

export function toast(msg: string): void {
  const el = $("toast");
  // A leading emoji or symbol becomes the icon; otherwise one is picked for the kind.
  const lead = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|[✨★☆✓!])\s*/u.exec(msg);
  const text = lead ? msg.slice(lead[0].length) : msg, k = toastKind(msg);
  const ico = lead && lead[1] !== "✨" ? lead[1] : k.ico;
  const body = toastEsc(text).replace(/([+\-]?[$€£]\s?[\d.,]+\s?[KMBTkmbt]?[a-zA-Z]{0,2}|[+\-]\d[\d.,]*%?|×\d[\d.,]*)/g, "<b>$1</b>");
  el.className = `toast-${k.kind}`;
  el.innerHTML = `<span class="t-ico">${toastEsc(ico)}</span><span class="t-msg">${body}</span><i class="t-time"></i>`;
  el.hidden = false;
  // (Restart the entrance even when one message follows another.)
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  el.onclick = () => { el.hidden = true; clearTimeout(toastTimer); };
  clearTimeout(toastTimer);
  const ms = Math.min(5000, 2600 + text.length * 25);
  el.style.setProperty("--t-ms", `${ms}ms`);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, ms);
}

// Modal sheets remember what opened them so focus goes back there on close.
const openers = new Map<HTMLElement, Element | null>();

// Menus come and go smoothly: a closing sheet slides away (a copy of it, so the game sees it
// closed at once), and going from one menu straight to another crossfades instead of
// dropping one and sliding the other up.
let lastClose = 0, ghost: HTMLElement | null = null;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function ghostOut(el: HTMLElement): void {
  if (reduced() || typeof document === "undefined") return;
  ghost?.remove();
  const g = el.cloneNode(true) as HTMLElement;
  // (The copy keeps the menu's own id, so it keeps the menu's look while it slides away: the
  // real menu comes first in the page, so looking the id up still finds the real one. Only the
  // ids inside it are dropped.)
  g.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
  g.classList.add("modal-ghost");
  g.setAttribute("aria-hidden", "true");
  const sheet = el.querySelector<HTMLElement>(".sheet"), gs = g.querySelector<HTMLElement>(".sheet");
  if (sheet && gs) gs.scrollTop = sheet.scrollTop;
  el.parentElement?.appendChild(g);
  if (gs && sheet) gs.scrollTop = sheet.scrollTop;
  ghost = g;
  // A tab page (Shop, Company, Goals, Me) is styled while a tab is open: that look stays on
  // until its copy has slid away, or the page flashes its old design on the way out.
  const tabs = typeof document !== "undefined" && document.body.classList.contains("tabs-open");
  if (tabs) document.body.classList.add("tabs-closing");
  window.setTimeout(() => {
    g.remove();
    if (ghost === g) ghost = null;
    if (tabs && !document.querySelector(".modal-ghost")) document.body.classList.remove("tabs-closing");
  }, 260);
}

export function openModal(el: HTMLElement, focusEl?: HTMLElement | null): void {
  if (el.hidden) {
    openers.set(el, document.activeElement);
    window.dispatchEvent(new Event("skyrise:sheet"));
    // (Straight from another menu: swap in place, no second slide.)
    const swap = performance.now() - lastClose < 80;
    el.classList.toggle("modal-swap", swap);
    if (swap) { ghost?.remove(); ghost = null; }
  }
  el.hidden = false;
  (focusEl ?? el.querySelector<HTMLElement>(".close-btn"))?.focus();
}

export function closeModal(el: HTMLElement): void {
  if (!el.hidden) { ghostOut(el); lastClose = performance.now(); }
  el.hidden = true;
  const opener = openers.get(el);
  openers.delete(el);
  if (opener instanceof HTMLElement && !opener.closest("[hidden]")) opener.focus();
}

/** Wires a modal's close button and backdrop. */
export function wireModal(el: HTMLElement, onClose: () => void = () => closeModal(el)): void {
  el.addEventListener("click", e => { if (e.target === el) onClose(); });
  el.querySelector(".close-btn")?.addEventListener("click", onClose);
}

export const MODAL_IDS = ["spin-sheet", "advent-sheet", "shop", "challenges", "profile", "missions", "settings", "streak", "city", "ranks", "pass", "goals", "modes", "starter", "help", "tycoon", "daily-rewards", "tcy-buildsheet", "tcy-goalsheet", "tcy-moresheet", "earnings", "scrapbook", "collection", "land-buy"] as const;
export const openModalEl = (): HTMLElement | undefined =>
  MODAL_IDS.map(id => $(id)).find(el => !el.hidden);

export const LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="5" y="10" width="14" height="11" rx="3" fill="currentColor"/></svg>';
export const TROPHY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/></svg>';

export function vibrate(on: boolean, pattern: number | number[]): void {
  if (!on) return;
  // The phone apps use real haptics; the pattern picks the closest feel.
  const total = typeof pattern === "number" ? pattern : pattern.reduce((a, b) => a + b, 0);
  if (haptic(total <= 10 ? "tap" : total <= 20 ? "land" : total >= 150 ? "fail" : total === 70 ? "perfect" : "success")) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/** Tabbed sheets: a `[data-tabs]` bar of `[data-tab]` buttons shows the sheet's matching
 *  `[data-panel]` and hides the rest. */
export function wireTabs(): void {
  document.querySelectorAll<HTMLElement>("[data-tabs]").forEach(bar => {
    const first = bar.querySelector<HTMLButtonElement>("[data-tab]")!.dataset.tab!;
    bar.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.addEventListener("click", () => {
      showTab(bar, b.dataset.tab!);
      window.dispatchEvent(new Event("skyrise:tab"));
    }));
    showTab(bar, first);
  });
}

export function showTab(barOrSheet: HTMLElement, name: string): void {
  const sheet = barOrSheet.closest(".sheet") ?? barOrSheet;
  sheet.querySelectorAll<HTMLButtonElement>("[data-tabs] [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  sheet.querySelectorAll<HTMLElement>("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== name; });
}

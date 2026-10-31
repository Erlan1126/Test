// Small DOM helpers shared by the screens.

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

let toastTimer = 0;
export function toast(msg: string): void {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 2800);
}

// Modal sheets remember what opened them so focus goes back there on close.
const openers = new Map<HTMLElement, Element | null>();

export function openModal(el: HTMLElement, focusEl?: HTMLElement | null): void {
  if (el.hidden) openers.set(el, document.activeElement);
  el.hidden = false;
  (focusEl ?? el.querySelector<HTMLElement>(".close-btn"))?.focus();
}

export function closeModal(el: HTMLElement): void {
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

export const MODAL_IDS = ["skins", "shop", "challenges", "profile", "missions", "settings", "streak", "city", "ranks"] as const;
export const openModalEl = (): HTMLElement | undefined =>
  MODAL_IDS.map(id => $(id)).find(el => !el.hidden);

export const LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="5" y="10" width="14" height="11" rx="3" fill="currentColor"/></svg>';
export const TROPHY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/></svg>';

export function vibrate(on: boolean, pattern: number | number[]): void {
  if (!on) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

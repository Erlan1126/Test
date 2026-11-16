// The five places in the dock (City, Shop, Missions, Sky Pass, Ranks) work like tabs: while
// one is open the dock stays on top of it, so the player hops straight from one to another
// (the new sheet slides in from that side) instead of closing and reopening. Any sheet can
// also be pulled down by its header to close it, like on iPhone.
import { closeModal } from "./dom";

const TABS = [["city", "city-btn"], ["shop", "shop-btn"], ["missions", "missions-btn"], ["pass", "pass-btn"], ["ranks", "ranks-btn"]] as const;
const SHEETS = ["shop", "challenges", "profile", "missions", "settings", "streak", "city", "ranks", "pass", "goals", "modes", "starter", "help"];

const byId = (id: string): HTMLElement | null => document.getElementById(id);
const openTab = (): number => TABS.findIndex(([m]) => byId(m) && !byId(m)!.hidden);

export function startTabNav(): void {
  const dock = byId("dock");
  if (!dock) return;
  const home = { parent: dock.parentElement!, next: dock.nextSibling };
  let lifted = false;

  /** Lifts the dock above the open sheet (or puts it back in the home screen). */
  const sync = (): void => {
    const at = openTab();
    // Only from the home screen (Ranks can also open from a finished tower's card).
    const want = at >= 0 && !byId("menu")?.hidden;
    if (want !== lifted) {
      lifted = want;
      if (want) document.body.appendChild(dock);
      else home.parent.insertBefore(dock, home.next && home.next.parentNode === home.parent ? home.next : null);
      document.body.classList.toggle("dock-tabs", want);
    }
    TABS.forEach(([, btn], i) => {
      const b = byId(btn);
      if (!b) return;
      if (i === at) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };

  // Switching tabs: close the open one first; the tile's own handler then opens its sheet.
  dock.addEventListener("click", e => {
    const tile = (e.target as Element).closest("button");
    const to = TABS.findIndex(([, btn]) => btn === tile?.id);
    const from = openTab();
    if (to < 0 || from < 0) return;
    const now = byId(TABS[from][0])!;
    if (from === to) {
      // Tapping the open tab closes it.
      e.stopImmediatePropagation();
      now.querySelector<HTMLElement>(".close-btn")?.click();
      return;
    }
    now.hidden = true;
    closeModal(now);
    const next = byId(TABS[to][0]);
    const sheet = next?.querySelector<HTMLElement>(".sheet");
    if (sheet) {
      sheet.classList.remove("tab-in-left", "tab-in-right");
      void sheet.offsetWidth;
      sheet.classList.add(to > from ? "tab-in-right" : "tab-in-left");
      setTimeout(() => sheet.classList.remove("tab-in-left", "tab-in-right"), 400);
    }
  }, true);

  const watch = new MutationObserver(sync);
  for (const [m] of TABS) { const el = byId(m); if (el) watch.observe(el, { attributes: true, attributeFilter: ["hidden"] }); }
  sync();

  for (const id of SHEETS) pullToClose(byId(id));
}

/** Drag a sheet down by its top to close it. */
function pullToClose(modal: HTMLElement | null): void {
  const sheet = modal?.querySelector<HTMLElement>(".sheet");
  if (!modal || !sheet) return;
  let y0 = 0, dy = 0, dragging = false;
  sheet.addEventListener("touchstart", e => {
    const target = e.target as Element;
    // Only from the header area (or anywhere while the sheet is scrolled to the top and the
    // touch isn't on something that scrolls sideways).
    if (sheet.scrollTop > 0 || target.closest("input, textarea, select, .pass-tiers, .tabs")) return;
    const top = sheet.getBoundingClientRect().top;
    if (e.touches[0].clientY - top > 140) return;
    y0 = e.touches[0].clientY; dy = 0; dragging = true;
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sheet.style.transform = dy ? `translateY(${dy}px)` : "";
  }, { passive: true });
  const end = (): void => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)";
    if (dy > 110) {
      sheet.style.transform = "translateY(100%)";
      setTimeout(() => {
        const close = modal.querySelector<HTMLElement>(".close-btn");
        if (close) close.click(); else closeModal(modal);
        sheet.style.transition = ""; sheet.style.transform = "";
      }, 200);
    } else {
      sheet.style.transform = "";
      setTimeout(() => { sheet.style.transition = ""; }, 260);
    }
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
}

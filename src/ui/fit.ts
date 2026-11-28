// Buttons whose words don't fit (a long translation, a small phone, larger text) shrink
// their text a little, then wrap to two lines, instead of being cut off at both edges.
const SELECTOR = ".btn, [role=tab], .seg button";
const MIN = 0.72;
let queued = false;

/** Makes one button's text fit its width. */
export function fitText(el: HTMLElement): void {
  if (el.dataset.fit) { el.style.fontSize = ""; el.style.whiteSpace = ""; el.style.lineHeight = ""; delete el.dataset.fit; }
  const over = el.scrollWidth - el.clientWidth;
  if (over <= 1 || !el.clientWidth) return;
  const size = parseFloat(getComputedStyle(el).fontSize);
  // The text is roughly the part of the button that isn't padding.
  const cs = getComputedStyle(el), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const room = el.clientWidth - pad, need = el.scrollWidth - pad;
  const k = Math.max(MIN, Math.min(1, (room / need) * 0.98));
  el.dataset.fit = "1";
  el.style.fontSize = `${(size * k).toFixed(1)}px`;
  if (el.scrollWidth - el.clientWidth > 1) { el.style.whiteSpace = "normal"; el.style.lineHeight = "1.05"; }
}

function fitAll(): void {
  queued = false;
  for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) if (el.offsetParent !== null || el.dataset.fit) fitText(el);
}

/** Keeps every visible button's text fitting as screens open and words change. */
export function startFit(): void {
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(fitAll); } };
  new MutationObserver(later).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
  addEventListener("resize", later);
  void document.fonts?.ready.then(later);
  later();
}

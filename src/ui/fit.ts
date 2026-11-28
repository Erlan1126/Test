// Buttons whose words don't fit (a long translation, a small phone, larger text) shrink
// their text a little, then wrap to two lines, instead of being cut off at both edges.
const SELECTOR = ".btn, .buy, [role=tab], .seg button";
const MIN = 0.72;
let queued = false;

const range = typeof document !== "undefined" ? document.createRange() : null;

/** How much wider the button's words are than the room for them. (Measured on the words
 *  themselves: scrollWidth also counts the shine that sweeps across a button.) */
function overflow(el: HTMLElement): number {
  if (!range) return 0;
  range.selectNodeContents(el);
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const room = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  return range.getBoundingClientRect().width - room;
}

/** Makes one button's text fit its width. */
export function fitText(el: HTMLElement): void {
  if (el.dataset.fit) { el.style.fontSize = ""; el.style.whiteSpace = ""; el.style.lineHeight = ""; delete el.dataset.fit; }
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const over = overflow(el);
  if (over <= 1) return;
  const size = parseFloat(getComputedStyle(el).fontSize);
  const words = over + (r.width - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight));
  const k = Math.max(MIN, Math.min(1, ((words - over) / words) * 0.98));
  el.dataset.fit = "1";
  el.style.fontSize = `${(size * k).toFixed(1)}px`;
  if (overflow(el) > 1) { el.style.whiteSpace = "normal"; el.style.lineHeight = "1.05"; }
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

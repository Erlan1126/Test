import { stillMotion } from "./dom";
// Little bits of joy for the menus: sparks when a reward is claimed, confetti for big
// moments and numbers that count up. All of it is plain DOM + CSS so it costs nothing while
// idle, and it all stays still for players who ask for reduced motion.

const still = stillMotion;

const COLORS = ["#ffd23f", "#ff7a5c", "#ff5fa2", "#7b6cff", "#3fc5ff", "#5ee08a"];

function layer(): HTMLElement {
  let l = document.getElementById("fx-layer");
  if (!l) {
    l = document.createElement("div");
    l.id = "fx-layer";
    l.setAttribute("aria-hidden", "true");
    document.body.appendChild(l);
  }
  return l;
}

function spawn(x: number, y: number, n: number, spread: number, rise: number, size: number, life: number, shapes: string[]): void {
  const l = layer();
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = `fx-p ${shapes[i % shapes.length]}`;
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const d = spread * (0.55 + Math.random() * 0.6);
    const s = size * (0.6 + Math.random() * 0.8);
    p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${COLORS[i % COLORS.length]};`
      + `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - rise}px;--r:${Math.round(Math.random() * 720 - 360)}deg;animation-duration:${life * (0.8 + Math.random() * 0.4)}ms`;
    l.appendChild(p);
    setTimeout(() => p.remove(), life * 1.3);
  }
}

/** Sparks flying out of an element (a claimed reward, a bought item). */
export function burst(el: Element, n = 14): void {
  el.classList.remove("pop");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("pop");
  if (still()) return;
  const r = el.getBoundingClientRect();
  spawn(r.left + r.width / 2, r.top + r.height / 2, n, 70, 20, 9, 700, ["dot", "star"]);
}

/** A shower of confetti from an element, for the big moments. */
export function confetti(el?: Element): void {
  if (still()) return;
  const r = el?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 3 : innerHeight / 3;
  spawn(x, y, 46, Math.min(innerWidth * 0.6, 240), 90, 10, 1300, ["conf", "conf wide", "dot"]);
}

/** Counts a number up inside an element. `format` turns the number into text. */
const counting = new WeakMap<HTMLElement, number>();
/** Stops a count-up, e.g. before setting the number directly. */
export const stopCount = (el: HTMLElement): void => { cancelAnimationFrame(counting.get(el) ?? 0); counting.delete(el); };

export function countUp(el: HTMLElement, to: number, ms = 700, format: (n: number) => string = n => String(n)): void {
  stopCount(el);
  const from = Number(el.dataset.n ?? 0);
  el.dataset.n = String(to);
  if (still() || from === to) { el.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(Math.round(from + (to - from) * e));
    if (k < 1) counting.set(el, requestAnimationFrame(step));
    else counting.delete(el);
  };
  counting.set(el, requestAnimationFrame(step));
}

/** Fireworks over the city: a few bursts high in the sky, one after another. */
export function fireworks(bursts = 4, onPop?: () => void): void {
  if (still()) return;
  const l = layer();
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const x = innerWidth * (0.18 + Math.random() * 0.64), y = innerHeight * (0.12 + Math.random() * 0.3);
      const hue = Math.floor(Math.random() * 360), n = 26;
      // The rocket's trail rising to the burst.
      const trail = document.createElement("i");
      trail.className = "fx-trail";
      trail.style.cssText = `left:${x}px;top:${y}px;--rise:${innerHeight * 0.35}px`;
      l.appendChild(trail);
      setTimeout(() => trail.remove(), 500);
      setTimeout(() => {
        onPop?.();
        const flash = document.createElement("i");
        flash.className = "fx-flash";
        flash.style.cssText = `left:${x}px;top:${y}px;background:radial-gradient(circle, hsla(${hue},100%,85%,0.9), hsla(${hue},100%,60%,0) 70%)`;
        l.appendChild(flash);
        setTimeout(() => flash.remove(), 600);
        for (let i = 0; i < n; i++) {
          const p = document.createElement("i");
          const a = (i / n) * Math.PI * 2, d = 70 + Math.random() * 40;
          p.className = "fx-p spark";
          p.style.cssText = `left:${x}px;top:${y}px;width:6px;height:6px;background:hsl(${(hue + (i % 3) * 25) % 360},100%,${65 + (i % 2) * 15}%);`
            + `box-shadow:0 0 8px hsl(${hue},100%,70%);--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 30}px;--r:0deg;animation-duration:1100ms`;
          l.appendChild(p);
          setTimeout(() => p.remove(), 1300);
        }
      }, 420);
    }, b * 380 + Math.random() * 150);
  }
}

/** Is a count-up running on this element? */
export const isCounting = (el: HTMLElement): boolean => counting.has(el);

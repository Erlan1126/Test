// City photo mode: every button steps aside, the player frames the city (drag, pinch and
// rotate as usual), picks a filter and presses the shutter. The picture gets a small white
// frame with the city's name and the game's, and goes to the share sheet (or is saved).
// The first photo of the day gives a Sky Crystal.
import { HAS_CITY } from "../edition";
import { getLang, t } from "../i18n";
import { dayKey } from "../logic/rules";
import type { SaveData } from "../logic/save";
import type { Sound } from "../sound";
import { track } from "../stats";
import { $, closeModal, MODAL_IDS, toast, vibrate } from "./dom";

// ---------- Filters (pure) ----------

/** One CSS filter function, with its amount (sepia/saturate/brightness/contrast as factors, hue-rotate in degrees). */
export interface FilterOp { fn: "sepia" | "saturate" | "brightness" | "contrast" | "hue-rotate"; v: number }

export interface PhotoFilter {
  id: "normal" | "warm" | "vintage" | "night";
  icon: string;
  label: () => string;
  ops: FilterOp[];
  /** Darker corners: how strong (0..1), and their color. */
  vignette?: { a: number; rgb: [number, number, number] };
}

export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  { id: "normal", icon: "☀️", label: () => t("Normal"), ops: [] },
  { id: "warm", icon: "🌅", label: () => t("Warm"), ops: [{ fn: "sepia", v: 0.2 }, { fn: "saturate", v: 1.25 }, { fn: "brightness", v: 1.04 }] },
  { id: "vintage", icon: "🎞️", label: () => t("Vintage"), ops: [{ fn: "sepia", v: 0.55 }, { fn: "contrast", v: 0.9 }, { fn: "brightness", v: 1.06 }, { fn: "saturate", v: 0.85 }], vignette: { a: 0.45, rgb: [60, 35, 10] } },
  { id: "night", icon: "🌙", label: () => t("Night glow"), ops: [{ fn: "brightness", v: 0.8 }, { fn: "contrast", v: 1.2 }, { fn: "saturate", v: 1.5 }, { fn: "hue-rotate", v: -12 }], vignette: { a: 0.6, rgb: [20, 10, 60] } },
];

export const photoFilter = (id: string): PhotoFilter => PHOTO_FILTERS.find(f => f.id === id) ?? PHOTO_FILTERS[0];

/** The live preview: the same filter as a CSS `filter` value. */
export function cssFilter(f: PhotoFilter): string {
  if (!f.ops.length) return "none";
  return f.ops.map(o => o.fn === "hue-rotate" ? `hue-rotate(${o.v}deg)` : `${o.fn}(${o.v})`).join(" ");
}

/** A color transform: three rows of [r, g, b, offset] (colors 0..1). */
export type ColorMatrix = number[];
const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

/** One filter function as a matrix (the Filter Effects spec's formulas, the same ones the browser uses). */
function opMatrix(o: FilterOp): ColorMatrix {
  const v = o.v;
  switch (o.fn) {
    case "brightness": return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
    case "contrast": { const b = 0.5 - 0.5 * v; return [v, 0, 0, b, 0, v, 0, b, 0, 0, v, b]; }
    case "sepia": {
      const a = 1 - Math.min(1, Math.max(0, v));
      return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0];
    }
    case "saturate": return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0];
    case "hue-rotate": {
      const r = (v * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0];
    }
  }
}

/** `next` applied after `cur`, as one matrix. */
function compose(next: ColorMatrix, cur: ColorMatrix): ColorMatrix {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let v = c === 3 ? next[r * 4 + 3] : 0;
      for (let k = 0; k < 3; k++) v += next[r * 4 + k] * cur[k * 4 + c];
      out.push(v);
    }
  }
  return out;
}

/** The whole filter as one matrix (functions apply left to right, as in CSS). */
export function filterMatrix(f: PhotoFilter): ColorMatrix {
  return f.ops.reduce((m, o) => compose(opMatrix(o), m), IDENTITY);
}

/** Applies a matrix to RGBA pixels in place (alpha untouched). */
export function applyMatrix(px: Uint8ClampedArray, m: ColorMatrix): void {
  const o0 = m[3] * 255, o1 = m[7] * 255, o2 = m[11] * 255;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    px[i] = m[0] * r + m[1] * g + m[2] * b + o0;
    px[i + 1] = m[4] * r + m[5] * g + m[6] * b + o1;
    px[i + 2] = m[8] * r + m[9] * g + m[10] * b + o2;
  }
}

// ---------- The frame's words (pure) ----------

/** The frame's two lines: the city's name, and "Built in Buildaroo · date". */
export function photoCaption(cityName: string, date: string, builtIn = "Built in Buildaroo"): { title: string; sub: string } {
  const name = cityName.trim().replace(/\s+/g, " ") || "Buildaroo";
  return { title: name.length > 28 ? `${name.slice(0, 27)}…` : name, sub: date ? `${builtIn} · ${date}` : builtIn };
}

/** "buildaroo-sunny-bay-2026-11-26.png" */
export function photoFileName(cityName: string, now = Date.now()): string {
  const slug = cityName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  const d = new Date(now), p = (n: number) => String(n).padStart(2, "0");
  return `buildaroo-${slug ? `${slug}-` : ""}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`;
}

/** The 📷 button shows once Mayor Pip's first chapter is done. */
export const photoUnlocked = (s: { chapters: { done: number } }): boolean => s.chapters.done >= 1;

// ---------- The first photo of the day ----------

export const PHOTO_CRYSTALS = 1;
const DAY_KEY = "buildaroo.photoDay";

/** True (and remembered) the first time this is asked on a given day. */
export function claimPhotoDay(today: string, store: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  try {
    if (!store || store.getItem(DAY_KEY) === today) return false;
    store.setItem(DAY_KEY, today);
    return true;
  } catch { return false; }
}

// ---------- Photo mode itself ----------

export interface PhotoHost {
  readonly save: SaveData;
  readonly sound: Sound;
  persist(): void;
  /** The town as it looks right now, full size (rendered just now). */
  townShot(): HTMLCanvasElement | null;
  sharePicture(blob: Blob, text: string, name?: string): Promise<void>;
}

/** The longest side of the saved picture (a phone screenshot at 3x is far bigger than needed). */
const MAX_SIDE = 1600;

export class PhotoMode {
  private filter: PhotoFilter = PHOTO_FILTERS[0];
  private busy = false;
  private btn: HTMLButtonElement | null = null;

  constructor(private readonly host: PhotoHost, private readonly beforeOpen: () => void) {
    // The 📷 button, in the town's corner.
    const city = document.getElementById("tycity");
    if (city) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "photo-btn"; b.className = "photo-btn"; b.hidden = true;
      b.setAttribute("aria-label", t("Photo mode"));
      b.innerHTML = `<span aria-hidden="true">📷</span>`;
      b.addEventListener("click", () => { this.host.sound.click(); this.open(); });
      city.append(b);
      this.btn = b;
    }
    // The filter chips, above the shutter.
    const bar = $("photo-bar"), row = bar.querySelector(".pb-row");
    const chips = document.createElement("div");
    chips.className = "pb-filters"; chips.id = "photo-filters"; chips.setAttribute("role", "radiogroup");
    chips.setAttribute("aria-label", t("Filter"));
    chips.innerHTML = PHOTO_FILTERS.map(f => `<button type="button" role="radio" data-pf="${f.id}"><span aria-hidden="true">${f.icon}</span>${f.label()}</button>`).join("");
    chips.addEventListener("click", e => {
      const b = (e.target as Element).closest<HTMLElement>("[data-pf]");
      if (!b) return;
      this.host.sound.click();
      this.setFilter(b.dataset.pf!);
    });
    bar.insertBefore(chips, row);
    const vig = document.createElement("div");
    vig.id = "photo-vig"; vig.hidden = true;
    document.body.append(vig);
    $("photo-x").addEventListener("click", () => { this.host.sound.click(); this.close(); });
    $("photo-snap").addEventListener("click", () => { void this.snap(); });
    // Esc leaves photo mode (before the game's own keys see it).
    window.addEventListener("keydown", e => {
      if (!this.isOpen) return;
      if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (e.code === "Space" || e.code === "Enter") { if (!(e.target instanceof HTMLButtonElement)) { e.preventDefault(); e.stopImmediatePropagation(); void this.snap(); } }
    }, true);
    this.setFilter("normal");
  }

  get isOpen(): boolean { return document.body.classList.contains("photo-mode"); }

  /** Shows the 📷 button when it's unlocked (called as the town redraws). */
  sync(): void {
    if (this.btn) this.btn.hidden = !HAS_CITY || !photoUnlocked(this.host.save);
  }

  open(): void {
    if (this.isOpen) return;
    this.beforeOpen();
    // (A window still open, or one that popped up by itself like the daily rewards, would sit
    // over the town and catch every drag: it's put away first.)
    for (const id of MODAL_IDS) { const el = document.getElementById(id); if (el && !el.hidden) closeModal(el); }
    document.body.classList.add("photo-mode");
    $("photo-bar").hidden = false;
    this.setFilter(this.filter.id);
    track("photo_mode", {}, false);
  }

  close(): void {
    document.body.classList.remove("photo-mode");
    $("photo-bar").hidden = true;
    $("photo-vig").hidden = true;
    for (const id of ["fx", "game"]) $(id).style.filter = "";
  }

  private setFilter(id: string): void {
    this.filter = photoFilter(id);
    for (const b of $("photo-filters").querySelectorAll<HTMLElement>("[data-pf]")) {
      const on = b.dataset.pf === this.filter.id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    }
    if (!this.isOpen) return;
    const css = cssFilter(this.filter);
    for (const cid of ["fx", "game"]) $(cid).style.filter = css === "none" ? "" : css;
    const v = this.filter.vignette, vig = $("photo-vig");
    vig.hidden = !v;
    if (v) vig.style.background = vignetteCss(v);
  }

  async snap(): Promise<void> {
    if (this.busy || !this.isOpen) return;
    // Rendered and copied in the same moment, so the drawing buffer is still there.
    const src = this.host.townShot();
    if (!src || !src.width || !src.height) { toast(t("Photos can't be taken on this device")); return; }
    this.busy = true;
    try {
      this.host.sound.click(); vibrate(this.host.save.settings.vibrate, 12);
      const fl = $("photo-flash"); fl.hidden = false; fl.style.animation = "none"; void fl.offsetWidth; fl.style.animation = ""; window.setTimeout(() => { fl.hidden = true; }, 480);
      const name = this.host.save.cityName || t("My city");
      let date = "";
      try { date = new Intl.DateTimeFormat(getLang(), { day: "numeric", month: "short", year: "numeric" }).format(new Date()); } catch { /* no Intl */ }
      const pic = framePhoto(src, this.filter, photoCaption(name, date, t("Built in Buildaroo")));
      const blob = await new Promise<Blob | null>(r => pic.toBlob(r, "image/png"));
      if (!blob) { toast(t("Photos can't be taken on this device")); return; }
      track("photo_snap", { filter: this.filter.id }, false);
      let store: Storage | null = null;
      try { store = localStorage; } catch { /* storage off */ }
      const reward = claimPhotoDay(dayKey(0), store);
      if (reward) { this.host.save.crystals += PHOTO_CRYSTALS; this.host.persist(); }
      await this.host.sharePicture(blob, t("Look at the city I built: {name}!", { name }), photoFileName(name));
      // (After the share sheet, so the two messages don't cover each other.)
      if (reward) toast(t("📷 First photo today! +{n} 💎", { n: PHOTO_CRYSTALS }));
    } finally {
      this.busy = false;
    }
  }
}

function vignetteCss(v: NonNullable<PhotoFilter["vignette"]>): string {
  const [r, g, b] = v.rgb;
  return `radial-gradient(ellipse at center, rgba(${r},${g},${b},0) 55%, rgba(${r},${g},${b},${v.a}) 100%)`;
}

/** The picture: the city (filtered), a thin white frame, and a band with the city's name. */
function framePhoto(src: HTMLCanvasElement, f: PhotoFilter, cap: { title: string; sub: string }): HTMLCanvasElement {
  const k = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const w = Math.round(src.width * k), h = Math.round(src.height * k);
  const pad = Math.round(Math.min(w, h) * 0.035), band = Math.round(Math.min(w, h) * 0.17);
  const c = document.createElement("canvas");
  c.width = w + pad * 2; c.height = h + pad + band;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fffdf8";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, pad, pad, w, h);
  if (f.ops.length) {
    const img = g.getImageData(pad, pad, w, h);
    applyMatrix(img.data, filterMatrix(f));
    g.putImageData(img, pad, pad);
  }
  if (f.vignette) {
    const [r, gr, b] = f.vignette.rgb, cx = pad + w / 2, cy = pad + h / 2, rad = Math.hypot(w, h) / 2;
    const v = g.createRadialGradient(cx, cy, rad * 0.55, cx, cy, rad);
    v.addColorStop(0, `rgba(${r},${gr},${b},0)`); v.addColorStop(1, `rgba(${r},${gr},${b},${f.vignette.a})`);
    g.fillStyle = v; g.fillRect(pad, pad, w, h);
  }
  // The words, on the white band.
  const fs = Math.round(band * 0.34), x = pad + Math.round(pad * 0.2), max = w - pad * 0.4;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#2a1f5c";
  g.font = `400 ${fs}px Bungee, Impact, sans-serif`;
  g.fillText(cap.title.toUpperCase(), x, h + pad + band * 0.48, max);
  g.fillStyle = "#6a5aa8";
  g.font = `700 ${Math.round(fs * 0.52)}px Figtree, system-ui, sans-serif`;
  g.fillText(cap.sub, x, h + pad + band * 0.78, max);
  return c;
}

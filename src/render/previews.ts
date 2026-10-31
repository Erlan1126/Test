// Small pictures for the skins gallery and the shop, and the share card.
import { clamp, fmt, hexRgb, rgb } from "../core/util";
import { DISPLAY_FONT, GOLD, ISLAND, MILESTONES, NUM_FONT, UI_FONT } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import type { Skin } from "../data/skins";
import type { View } from "./paint";
import { drawTreeShape } from "./scenery";

type P = [number, number];

function prep(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

const filler = (g: CanvasRenderingContext2D) => (pts: P[], c: string) => {
  g.fillStyle = c;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};

/** A small tower in the given skin. */
export function drawSkinPreview(cv: HTMLCanvasElement, st: Skin): void {
  const w = 120, h = 132, g = prep(cv, w, h), fill = filler(g);
  const night = !!st.neon || !!st.alwaysLit || st.id === "deco";
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, night ? "#1c1650" : "#4f8fe0");
  sky.addColorStop(1, night ? "#5a2f86" : "#ffd9b5");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const cx = 60, hw = 30, hh = 15, fh = 14, floors = 5, base = 92;
  fill([[cx - 52, base], [cx, base + 26], [cx, base + 34], [cx - 52, base + 8]], "#9c7650");
  fill([[cx, base + 26], [cx + 52, base], [cx + 52, base + 8], [cx, base + 34]], "#7d5d3c");
  fill([[cx - 52, base], [cx, base - 26], [cx + 52, base], [cx, base + 26]], "#7fc76a");
  fill([[cx - 38, base], [cx, base - 19], [cx + 38, base], [cx, base + 19]], "#e3e7ec");
  for (let k = 0; k < floors; k++) {
    const c = hexRgb(st.floors[k % st.floors.length]);
    const yb = base - k * fh, yt = yb - fh;
    const L = (u: number, v: number): P => [cx - hw + u * hw, yt + u * hh + v * fh];
    const R = (u: number, v: number): P => [cx + u * hw, yt + hh - u * hh + v * fh];
    fill([L(0, 0), L(1, 0), L(1, 1), L(0, 1)], rgb(c, 1));
    fill([R(0, 0), R(1, 0), R(1, 1), R(0, 1)], rgb(c, 0.74));
    for (const [F, sh] of [[L, 1], [R, 0.82]] as const) {
      if (st.neon) fill([F(0, 0.9), F(1, 0.9), F(1, 1), F(0, 1)], st.lit[k % st.lit.length]);
      else fill([F(0, 0.88), F(1, 0.88), F(1, 1), F(0, 1)], rgb(hexRgb(st.slab), sh));
      const pane = (i: number) => (night ? st.lit[(k + i) % st.lit.length] : rgb(hexRgb(st.glass), sh));
      if (st.kind === "ribbon") {
        fill([F(0.1, 0.25), F(0.9, 0.25), F(0.9, 0.72), F(0.1, 0.72)], pane(0));
      } else {
        for (const [a, b] of [[0.14, 0.42], [0.58, 0.86]]) {
          fill([F(a - 0.05, 0.2), F(b + 0.05, 0.2), F(b + 0.05, 0.78), F(a - 0.05, 0.78)], rgb(hexRgb(st.frame), sh));
          fill([F(a, 0.27), F(b, 0.27), F(b, 0.72), F(a, 0.72)], pane(a > 0.5 ? 1 : 0));
        }
      }
    }
    if (k === floors - 1) fill([[cx - hw, yt], [cx, yt - hh], [cx + hw, yt], [cx, yt + hh]], rgb(c, 1.15));
  }
}

/** A small island in the given theme. */
export function drawThemePreview(cv: HTMLCanvasElement, t: IslandTheme): void {
  const w = 120, h = 132, g = prep(cv, w, h), fill = filler(g);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, t.sky[0]);
  sky.addColorStop(1, t.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const cx = 60, cy = 74, hw = 50, hh = 25;
  fill([[cx, cy + hh], [cx, cy + hh + 30], [cx - hw, cy + 18], [cx - hw, cy]], t.rockL);
  fill([[cx, cy + hh], [cx + hw, cy], [cx + hw, cy + 18], [cx, cy + hh + 30]], t.rockR);
  fill([[cx - hw, cy], [cx, cy + hh], [cx, cy + hh + 9], [cx - hw, cy + 9]], t.dirtL);
  fill([[cx, cy + hh], [cx + hw, cy], [cx + hw, cy + 9], [cx, cy + hh + 9]], t.dirtR);
  fill([[cx - hw, cy], [cx, cy - hh], [cx + hw, cy], [cx, cy + hh]], t.lawn);
  fill([[cx - 18, cy], [cx, cy - 9], [cx + 18, cy], [cx, cy + 9]], t.plaza2);
  for (const [x, y] of [[cx - 30, cy - 2], [cx + 28, cy - 4], [cx - 6, cy + 14], [cx + 12, cy - 14]]) drawTreeShape(g, t, x, y, 8, 0.5, 1);
}

export interface ShareInfo {
  score: number;
  meters: number;
  floors: number;
  landmark: number;
  /** Line under the score, e.g. "Daily #12". */
  tag: string;
}

let logo: HTMLImageElement | null = null;
/** Loads the app icon once, for the share card. */
export function preloadLogo(src: string): void {
  if (logo) return;
  logo = new Image();
  logo.src = src;
}

/** A portrait share card: the finished tower with the score laid over it. */
export function makeShareImage(canvas: HTMLCanvasElement, view: View, info: ShareInfo): Promise<Blob | null> {
  const out = document.createElement("canvas");
  out.width = 1080; out.height = 1350;
  const o = out.getContext("2d")!;
  const sc = Math.max(1080 / canvas.width, 1350 / canvas.height);
  const dw = canvas.width * sc, dh = canvas.height * sc;
  // Crop around the tower, wherever the current layout put it on screen.
  const px = canvas.width / view.W * sc;
  const topY = view.project(0, info.floors + 4.8, 0)[1], botY = view.project(ISLAND, 0, ISLAND)[1];
  const dx = clamp(540 - view.cx * px, 1080 - dw, 0);
  const dy = clamp(1350 * 0.4 - (topY + botY) / 2 * px, 1350 - dh, 0);
  o.drawImage(canvas, dx, dy, dw, dh);
  const g = o.createLinearGradient(0, 760, 0, 1350);
  g.addColorStop(0, "rgba(8,10,30,0)");
  g.addColorStop(1, "rgba(8,10,30,0.92)");
  o.fillStyle = g;
  o.fillRect(0, 760, 1080, 590);
  const top = o.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, "rgba(8,10,30,0.6)");
  top.addColorStop(1, "rgba(8,10,30,0)");
  o.fillStyle = top;
  o.fillRect(0, 0, 1080, 220);
  o.fillStyle = "#ffffff";
  o.shadowColor = "rgba(0,0,0,0.35)";
  o.shadowBlur = 16;
  o.font = `56px ${DISPLAY_FONT}`;
  const nameW = o.measureText("SKYRISE").width, size = 84, left = 540 - (size + 18 + nameW) / 2;
  if (logo?.complete && logo.naturalWidth) o.drawImage(logo, left, 44, size, size);
  o.textAlign = "left";
  o.fillText("SKYRISE", left + size + 18, 108);
  o.textAlign = "center";
  if (info.tag) {
    o.font = `800 40px ${UI_FONT}`;
    o.fillText(info.tag, 540, 990);
  }
  o.font = `190px ${NUM_FONT}`;
  o.fillText(fmt(info.score), 540, 1150);
  o.font = `800 46px ${UI_FONT}`;
  o.fillText(`people live in my ${info.meters} m tower`, 540, 1215);
  if (info.landmark >= 0) {
    o.fillStyle = GOLD;
    o.font = `800 40px ${UI_FONT}`;
    o.fillText(`Taller than ${MILESTONES[info.landmark].name}`, 540, 1280);
  }
  return new Promise(res => out.toBlob(b => res(b)));
}

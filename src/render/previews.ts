// Small pictures for the skins gallery and the shop, and the share card.
import { clamp, fmt, hexRgb, mixRgb, rgb } from "../core/util";
import { DISPLAY_FONT, GOLD, ISLAND, MILESTONES, NUM_FONT, UI_FONT } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import type { Skin } from "../data/skins";
import { View, type Env, type Paint } from "./paint";
import type { Shape } from "../data/shapes";
import { drawBlock, floorColor, lookFor } from "./buildings";
import { footprint } from "./footprint";
import { drawTreeShape, skyAt } from "./scenery";
import { drawLandmarkShape } from "./atmosphere";
import { t } from "../i18n";

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
      if (night) { g.shadowColor = st.lit[0]; g.shadowBlur = 6; }
      if (st.kind === "ribbon") {
        fill([F(0.1, 0.25), F(0.9, 0.25), F(0.9, 0.72), F(0.1, 0.72)], pane(0));
      } else {
        for (const [a, b] of [[0.14, 0.42], [0.58, 0.86]]) {
          // Arched windows lose their top corners; round ones are octagons at this size.
          const top = st.win === "arch" || st.win === "round" ? 0.08 : 0;
          const bot = st.win === "round" ? 0.08 : 0;
          const frame = [F(a - 0.05, 0.2 + top * 2), F(a + (b - a) / 2, 0.16), F(b + 0.05, 0.2 + top * 2), F(b + 0.05, 0.78 - bot * 2), F(a + (b - a) / 2, 0.82), F(a - 0.05, 0.78 - bot * 2)];
          fill(top || bot ? frame : [F(a - 0.05, 0.2), F(b + 0.05, 0.2), F(b + 0.05, 0.78), F(a - 0.05, 0.78)], rgb(hexRgb(st.frame), sh));
          fill(top || bot
            ? [F(a, 0.27 + top), F(a + (b - a) / 2, 0.24), F(b, 0.27 + top), F(b, 0.72 - bot), F(a + (b - a) / 2, 0.75), F(a, 0.72 - bot)]
            : [F(a, 0.27), F(b, 0.27), F(b, 0.72), F(a, 0.72)], pane(a > 0.5 ? 1 : 0));
          if (st.win === "split") fill([F(a + (b - a) / 2 - 0.015, 0.27), F(a + (b - a) / 2 + 0.015, 0.27), F(a + (b - a) / 2 + 0.015, 0.72), F(a + (b - a) / 2 - 0.015, 0.72)], rgb(hexRgb(st.frame), sh));
        }
      }
      g.shadowBlur = 0;
      // Signature details: balcony rails, pilasters and steel bracing.
      if (st.balcony) {
        fill([F(0.02, 0.7), F(0.98, 0.7), F(0.98, 0.75), F(0.02, 0.75)], rgb(hexRgb(st.balcony), sh));
        for (let u = 0.06; u < 1; u += 0.12) fill([F(u, 0.6), F(u + 0.025, 0.6), F(u + 0.025, 0.72), F(u, 0.72)], rgb(hexRgb(st.balcony), sh));
      }
      if (st.pilaster) for (const u of [0, 0.47, 0.94]) fill([F(u, 0), F(u + 0.06, 0), F(u + 0.06, 1), F(u, 1)], rgb(hexRgb(st.pilaster), sh));
      if (st.brace) {
        g.strokeStyle = rgb(hexRgb(st.brace), sh); g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(...F(0, 0.05)); g.lineTo(...F(1, 0.9)); g.moveTo(...F(1, 0.05)); g.lineTo(...F(0, 0.9));
        g.stroke();
      }
    }
    if (k === floors - 1) fill([[cx - hw, yt], [cx, yt - hh], [cx + hw, yt], [cx, yt + hh]], rgb(c, 1.15));
  }
  // Legendary skins shine in their preview too.
  if (st.fx) {
    const top = base - floors * fh - hh, bottom = base + hh;
    g.save();
    g.globalCompositeOperation = "lighter";
    const grad = g.createLinearGradient(cx - hw, top, cx + hw, bottom);
    if (st.fx === "aurora") { grad.addColorStop(0, "rgba(94,240,200,0.45)"); grad.addColorStop(0.5, "rgba(123,108,255,0.35)"); grad.addColorStop(1, "rgba(255,122,217,0.45)"); }
    else if (st.fx === "gold") { grad.addColorStop(0, "rgba(255,240,170,0)"); grad.addColorStop(0.5, "rgba(255,230,140,0.55)"); grad.addColorStop(0.6, "rgba(255,240,170,0)"); }
    else if (st.fx === "lava") { grad.addColorStop(0, "rgba(255,90,20,0.1)"); grad.addColorStop(1, "rgba(255,120,30,0.5)"); }
    else { grad.addColorStop(0, "rgba(255,255,255,0.25)"); grad.addColorStop(1, "rgba(200,170,255,0.3)"); }
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(cx - hw, top + hh); g.lineTo(cx, top); g.lineTo(cx + hw, top + hh); g.lineTo(cx + hw, base); g.lineTo(cx, bottom); g.lineTo(cx - hw, base); g.closePath(); g.fill();
    if (st.fx === "diamond" || st.fx === "gold") {
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 9; i++) {
        const x = cx - hw + 6 + ((i * 37) % (hw * 2 - 12)), y = top + 18 + ((i * 53) % (base - top - 20)), r = 1.4 + (i % 3) * 0.8;
        g.beginPath(); g.moveTo(x, y - r * 3); g.lineTo(x + r, y); g.lineTo(x, y + r * 3); g.lineTo(x - r, y); g.closePath(); g.fill();
      }
    }
    g.restore();
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
  // Each island's signature landmark, so the islands look like places, not recolors.
  const sig = t.id;
  if (sig === "snow") {
    fill([[cx - 34, cy - 4], [cx - 18, cy - 40], [cx - 2, cy - 4]], "#8a9ab8");
    fill([[cx - 24, cy - 29], [cx - 18, cy - 40], [cx - 12, cy - 29], [cx - 18, cy - 25]], "#ffffff");
    fill([[cx - 8, cy - 2], [cx + 8, cy - 30], [cx + 24, cy - 2]], "#7a8aa8");
    fill([[cx + 3, cy - 21], [cx + 8, cy - 30], [cx + 13, cy - 21], [cx + 8, cy - 18]], "#ffffff");
  } else if (sig === "desert") {
    fill([[cx - 22, cy + 2], [cx, cy - 30], [cx + 22, cy + 2]], "#e2b47c");
    fill([[cx, cy - 30], [cx + 22, cy + 2], [cx + 4, cy + 8]], "#c99a5c");
    g.fillStyle = "#3aa7d8"; g.beginPath(); g.ellipse(cx + 26, cy + 8, 9, 4, 0, 0, Math.PI * 2); g.fill();
  } else if (sig === "blossom") {
    for (const [i, w] of [[0, 26], [1, 20], [2, 14]] as const) {
      const y = cy - 6 - i * 12;
      fill([[cx - w / 2, y], [cx + w / 2, y], [cx + w / 2 - 4, y - 7], [cx - w / 2 + 4, y - 7]], "#c0392b");
      fill([[cx - w / 2 + 3, y + 5], [cx + w / 2 - 3, y + 5], [cx + w / 2 - 3, y], [cx - w / 2 + 3, y]], "#fff1e0");
    }
    g.fillStyle = "#ffb7d5";
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(cx - 40 + ((i * 29) % 80), cy - 20 + ((i * 17) % 40), 1.8, 0, Math.PI * 2); g.fill(); }
  } else if (sig === "volcano") {
    fill([[cx - 26, cy + 4], [cx - 6, cy - 34], [cx + 6, cy - 34], [cx + 26, cy + 4]], "#3a2a26");
    g.save(); g.shadowColor = "#ff6a1a"; g.shadowBlur = 12;
    fill([[cx - 6, cy - 34], [cx + 6, cy - 34], [cx + 3, cy - 30], [cx - 3, cy - 30]], "#ff8a2a");
    fill([[cx - 2, cy - 31], [cx + 2, cy - 31], [cx + 6, cy - 6], [cx + 1, cy - 8]], "#ff5a1a");
    g.restore();
    g.fillStyle = "rgba(90,80,90,0.55)"; g.beginPath(); g.arc(cx + 4, cy - 44, 7, 0, Math.PI * 2); g.arc(cx + 12, cy - 52, 5, 0, Math.PI * 2); g.fill();
  } else if (sig === "candy") {
    for (const [x, y, c] of [[cx - 22, cy - 6, "#ff7ab8"], [cx + 18, cy - 10, "#7ad8ff"], [cx - 2, cy + 8, "#ffd23f"]] as const) {
      g.fillStyle = "#ffffff"; g.fillRect(x - 1, y - 18, 2, 18);
      g.fillStyle = c; g.beginPath(); g.arc(x, y - 22, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - 22, 3.5, 0, Math.PI * 1.5); g.stroke();
    }
  }
  for (const [x, y] of [[cx - 30, cy - 2], [cx + 28, cy - 4], [cx - 6, cy + 14], [cx + 12, cy - 14]]) {
    if (sig === "desert" && x === cx + 12) continue;
    drawTreeShape(g, t, x, y, 8, 0.5, 1);
  }
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
  o.fillText(t("people live in my {m} m tower", { m: info.meters }), 540, 1215, 1000);
  if (info.landmark >= 0) {
    o.fillStyle = GOLD;
    o.font = `800 40px ${UI_FONT}`;
    o.fillText(t("Taller than {name}", { name: t(MILESTONES[info.landmark].name) }), 540, 1280, 1000);
  }
  return new Promise(res => out.toBlob(b => res(b)));
}

/** A small tower built in the given shape, drawn with the game's own building code. */
export function drawShapePreview(cv: HTMLCanvasElement, shape: Shape, skin: Skin): void {
  const w = 120, h = 132, g = prep(cv, w, h);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#4f8fe0");
  sky.addColorStop(1, "#ffd9b5");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const view = new View();
  Object.assign(view, { W: w, H: h, s: 5.2, th: 11, zoom: 1, level: 0, originY: 96, cx: w / 2 });
  const env: Env = { nf: 0, skyTop: [79, 143, 224], skyBot: [255, 217, 181], climb: 0, time: 0, low: true, post: false };
  const p: Paint = { ctx: g, view, env };
  const fill = filler(g), [lx, ly] = view.project(5.5, 0, 5.5), [rx] = view.project(5.5, 0, -5.5), [, ty] = view.project(-5.5, 0, -5.5);
  fill([[w - rx, (ly + ty) / 2], [lx, ly], [rx, (ly + ty) / 2], [lx, ty]], "#7fc76a");
  const box = { x0: -4, x1: 4, z0: -4, z1: 4 };
  for (let y = 0; y < 6; y++) {
    const foot = shape.id === "square" ? undefined : footprint(shape, box, y);
    drawBlock(p, box, y, y + 1, floorColor(skin, y * 3, "normal"), lookFor(skin, "normal"), { foot, lobby: y === 0, still: true });
  }
}

/** A postcard: the landmark against its sky at that height, in clear skies, rain or snow.
 *  Ones not collected yet show as a dim outline. */
export function drawPostcard(cv: HTMLCanvasElement, landmark: number, weather: "clear" | "rain" | "snow", owned: boolean): void {
  const w = 132, h = 92, g = prep(cv, w, h);
  const floors = MILESTONES[landmark].m / 5, [top, bot] = skyAt(floors);
  const sky = g.createLinearGradient(0, 0, 0, h);
  const grey = (c: [number, number, number]) => [c[0] * 0.25 + 40, c[1] * 0.25 + 44, c[2] * 0.25 + 70] as [number, number, number];
  sky.addColorStop(0, rgb(owned ? (weather === "clear" ? top : mixRgb(top, [90, 100, 120], 0.5)) : grey(top)));
  sky.addColorStop(1, rgb(owned ? (weather === "clear" ? bot : mixRgb(bot, [150, 160, 175], 0.5)) : grey(bot)));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = owned ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.08)";
  g.fillRect(0, h - 14, w, 14);
  drawLandmarkShape(g, landmark, w / 2, h - 12, w * 0.8, h * 0.74, owned ? "rgba(24,28,64,0.82)" : "rgba(255,255,255,0.12)");
  if (owned && weather !== "clear") {
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = (i * 37) % w, y = (i * 53) % (h - 14);
      if (weather === "rain") { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 7); g.stroke(); }
      else { g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill(); }
    }
  }
  if (!owned) {
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.font = `800 26px ${DISPLAY_FONT}`;
    g.textAlign = "center";
    g.fillText("?", w / 2, h / 2 + 4);
  }
}

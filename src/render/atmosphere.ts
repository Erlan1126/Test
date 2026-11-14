// Weather (rain with lightning, snow), the next landmark's silhouette beside the tower, and
// the aurora high up at night.
import { clamp, mixRgb, rand, rgb, shortName } from "../core/util";
import { t } from "../i18n";
import { MILESTONES, NUM_FONT, UI_FONT } from "../data/constants";
import type { Paint } from "./paint";

export type WeatherKind = "clear" | "rain" | "snow";

interface Drop { x: number; y: number; v: number; s: number; ph: number }

export class Weather {
  kind: WeatherKind = "clear";
  /** Called when lightning strikes, for the thunder. */
  onThunder: () => void = () => {};
  private drops: Drop[] = [];
  private flash = 0;
  private nextBolt = 6;
  private bolt: [number, number][] | null = null;

  set(kind: WeatherKind): void {
    this.kind = kind;
    const n = kind === "rain" ? 170 : kind === "snow" ? 130 : 0;
    this.drops = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.8, 1.2), s: rand(0.6, 1.4), ph: rand(0, 6) }));
    this.flash = 0;
    this.nextBolt = rand(5, 12);
  }

  /** Drawn over the scene, under the score. */
  draw(p: Paint, dt: number, wind: number): void {
    if (this.kind === "clear") return;
    const { ctx, view, env } = p, { W, H } = view;
    const count = env.low ? Math.floor(this.drops.length / 2) : this.drops.length;
    if (this.kind === "rain") {
      // A slightly darker, wetter sky
      ctx.fillStyle = `rgba(20,30,55,${0.12 + env.nf * 0.1})`;
      ctx.fillRect(0, 0, W, H);
      const slant = 0.18 + wind * 0.35;
      ctx.strokeStyle = `rgba(200,220,255,${0.35 + env.nf * 0.15})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const d = this.drops[i];
        d.y += dt * 1.6 * d.v;
        d.x += dt * 1.6 * d.v * slant * (H / W);
        if (d.y > 1.05) { d.y = -0.05; d.x = Math.random() * 1.2 - 0.1; }
        if (d.x > 1.05) d.x -= 1.1;
        const x = d.x * W, y = d.y * H, len = 16 * d.s;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * slant, y - len);
      }
      ctx.stroke();
      // Storms at night: lightning now and then
      if (env.nf > 0.5) {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = rand(7, 16);
          this.flash = 1;
          const x0 = rand(0.1, 0.9) * W;
          this.bolt = [[x0, 0]];
          for (let y = 0, x = x0; y < H * 0.45;) { y += rand(20, 45); x += rand(-30, 30); this.bolt.push([x, y]); }
          setTimeout(() => this.onThunder(), rand(250, 900));
        }
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < count; i++) {
        const d = this.drops[i];
        d.y += dt * 0.09 * d.v;
        d.x += dt * (0.02 * Math.sin(env.time * 0.8 + d.ph) + wind * 0.05);
        if (d.y > 1.03) { d.y = -0.03; d.x = Math.random(); }
        if (d.x > 1.03) d.x -= 1.06;
        if (d.x < -0.03) d.x += 1.06;
        ctx.globalAlpha = 0.5 + d.s * 0.35;
        ctx.beginPath(); ctx.arc(d.x * W, d.y * H, 1.2 + d.s * 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(220,230,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
      if (this.bolt && this.flash > 0.5) {
        ctx.strokeStyle = `rgba(255,255,255,${this.flash})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        this.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      this.flash = Math.max(0, this.flash - dt * 3);
    }
  }
}

type Shape = { aspect: number; draw: (g: CanvasRenderingContext2D) => void };
const poly = (g: CanvasRenderingContext2D, pts: number[]) => {
  g.moveTo(pts[0], pts[1]);
  for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
  g.closePath();
};
/** An ellipse as its own closed piece of the path (without the moveTo, canvas joins it to
 *  the previous point with a stray line). */
const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  g.moveTo(x + rx, y);
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
};

/** Silhouettes of the landmarks in real proportions, drawn in a unit box: x from -0.5 to
 *  0.5, y from 0 (ground) to 1 (top); `aspect` is width over height. */
const SHAPES: Record<string, Shape> = {
  house: { aspect: 1.1, draw: g => { g.rect(-0.4, 0, 0.8, 0.6); poly(g, [-0.5, 0.6, 0, 1, 0.5, 0.6]); } },
  niagara: { aspect: 2.6, draw: g => {
    // The Horseshoe Falls in one outline: rocky banks either side, the curved lip of the
    // falls dipping between them, and the wide gorge below.
    g.moveTo(-0.5, 0); g.lineTo(-0.5, 0.95); g.lineTo(-0.36, 1); g.lineTo(-0.3, 0.9);
    g.quadraticCurveTo(0, 0.68, 0.3, 0.88); g.lineTo(0.38, 0.97); g.lineTo(0.5, 0.92); g.lineTo(0.5, 0);
    g.closePath();
  } },
  pisa: { aspect: 0.46, draw: g => { // eight tiers, leaning
    const lean = (y: number) => y * 0.24 - 0.12;
    for (let k = 0; k < 7; k++) {
      const y0 = k * 0.124, y1 = y0 + 0.116, hw = k === 0 ? 0.3 : 0.28;
      poly(g, [lean(y0) - hw, y0, lean(y0) + hw, y0, lean(y1) + hw, y1, lean(y1) - hw, y1]);
      poly(g, [lean(y1) - hw - 0.02, y1 - 0.012, lean(y1) + hw + 0.02, y1 - 0.012, lean(y1) + hw + 0.02, y1 + 0.008, lean(y1) - hw - 0.02, y1 + 0.008]);
    }
    const b0 = 0.87, b1 = 0.98;
    poly(g, [lean(b0) - 0.19, b0, lean(b0) + 0.19, b0, lean(b1) + 0.17, b1, lean(b1) - 0.17, b1]);
  } },
  taj: { aspect: 1.35, draw: g => {
    g.rect(-0.5, 0, 1, 0.06);                    // plinth
    g.rect(-0.29, 0.06, 0.58, 0.36);             // the hall
    g.rect(-0.1, 0.42, 0.2, 0.1);                // drum
    g.moveTo(-0.15, 0.52); g.bezierCurveTo(-0.2, 0.68, -0.05, 0.76, 0, 0.86);
    g.bezierCurveTo(0.05, 0.76, 0.2, 0.68, 0.15, 0.52); g.closePath(); // onion dome
    g.rect(-0.006, 0.86, 0.012, 0.08);           // finial
    for (const x of [-0.21, 0.21]) { g.moveTo(x - 0.06, 0.42); g.quadraticCurveTo(x, 0.56, x + 0.06, 0.42); g.closePath(); }
    for (const x of [-0.45, 0.45]) { g.rect(x - 0.022, 0.06, 0.044, 0.5); g.moveTo(x - 0.035, 0.56); g.quadraticCurveTo(x, 0.66, x + 0.035, 0.56); g.closePath(); }
  } },
  liberty: { aspect: 0.32, draw: g => {
    g.rect(-0.5, 0, 1, 0.05);
    poly(g, [-0.38, 0.05, 0.38, 0.05, 0.32, 0.4, -0.32, 0.4]);  // pedestal
    g.rect(-0.38, 0.38, 0.76, 0.035);
    poly(g, [-0.2, 0.415, 0.2, 0.415, 0.12, 0.78, -0.13, 0.78]); // robe
    ell(g, 0, 0.805, 0.07, 0.03);            // head
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) poly(g, [Math.sin(a) * 0.05 - 0.012, 0.82, Math.sin(a) * 0.16, 0.82 + Math.cos(a) * 0.045, Math.sin(a) * 0.05 + 0.012, 0.82]);
    poly(g, [0.06, 0.72, 0.13, 0.73, 0.24, 0.93, 0.18, 0.94]);   // raised arm
    g.rect(0.15, 0.93, 0.12, 0.025);                              // torch
    ell(g, 0.21, 0.975, 0.045, 0.022);       // flame
    g.rect(-0.24, 0.58, 0.09, 0.12);                              // tablet
  } },
  bigben: { aspect: 0.22, draw: g => {
    g.rect(-0.38, 0, 0.76, 0.62);
    g.rect(-0.46, 0.62, 0.92, 0.13);   // clock faces
    g.rect(-0.4, 0.75, 0.8, 0.06);     // belfry
    poly(g, [-0.42, 0.81, 0.42, 0.81, 0.18, 0.9, 0, 1, -0.18, 0.9]);
    for (const x of [-0.46, 0.46]) poly(g, [x - 0.04, 0.75, x + 0.04, 0.75, x, 0.85]);
  } },
  pyramid: { aspect: 1.55, draw: g => { poly(g, [-0.5, 0, 0, 1, 0.5, 0]); } },
  needle: { aspect: 0.3, draw: g => {
    poly(g, [-0.3, 0, -0.06, 0.62, 0.06, 0.62, 0.3, 0, 0.18, 0, 0, 0.5, -0.18, 0]);
    poly(g, [-0.5, 0.66, 0.5, 0.66, 0.32, 0.76, -0.32, 0.76]);
    g.rect(-0.08, 0.62, 0.16, 0.04); g.rect(-0.02, 0.76, 0.04, 0.24);
  } },
  goldengate: { aspect: 0.22, draw: g => {
    g.rect(-0.5, 0, 0.25, 1); g.rect(0.25, 0, 0.25, 1); g.rect(-0.25, 0.3, 0.5, 0.06); g.rect(-0.25, 0.6, 0.5, 0.06); g.rect(-0.25, 0.86, 0.5, 0.08);
  } },
  eiffel: { aspect: 0.5, draw: g => {
    g.moveTo(-0.5, 0); g.quadraticCurveTo(-0.2, 0.25, -0.08, 0.7); g.lineTo(-0.02, 0.92); g.lineTo(0, 1); g.lineTo(0.02, 0.92); g.lineTo(0.08, 0.7);
    g.quadraticCurveTo(0.2, 0.25, 0.5, 0); g.lineTo(0.32, 0); g.quadraticCurveTo(0, 0.18, -0.32, 0); g.closePath();
    g.rect(-0.31, 0.27, 0.62, 0.035); g.rect(-0.14, 0.5, 0.28, 0.025); g.rect(-0.05, 0.88, 0.1, 0.02);
  } },
  empire: { aspect: 0.27, draw: g => {
    g.rect(-0.5, 0, 1, 0.1);               // lower block
    g.rect(-0.42, 0.1, 0.84, 0.06);
    g.rect(-0.32, 0.16, 0.64, 0.56);       // the tall shaft
    g.rect(-0.24, 0.72, 0.48, 0.05);       // art deco setbacks
    g.rect(-0.17, 0.77, 0.34, 0.04);
    g.rect(-0.11, 0.81, 0.22, 0.04);
    poly(g, [-0.07, 0.85, 0.07, 0.85, 0.04, 0.92, -0.04, 0.92]); // mooring mast
    g.rect(-0.022, 0.92, 0.044, 0.03); g.rect(-0.008, 0.95, 0.016, 0.05);
  } },
  taipei: { aspect: 0.2, draw: g => {
    poly(g, [-0.42, 0, 0.42, 0, 0.36, 0.2, -0.36, 0.2]);
    for (let k = 0; k < 8; k++) { const y0 = 0.2 + k * 0.08, y1 = y0 + 0.076; poly(g, [-0.29, y0, 0.29, y0, 0.37, y1, -0.37, y1]); }
    g.rect(-0.2, 0.84, 0.4, 0.04); g.rect(-0.12, 0.88, 0.24, 0.03); g.rect(-0.015, 0.91, 0.03, 0.09);
  } },
  cntower: { aspect: 0.13, draw: g => {
    poly(g, [-0.24, 0, -0.08, 0.66, 0.08, 0.66, 0.24, 0]);
    ell(g, 0, 0.675, 0.48, 0.022);
    ell(g, 0, 0.66, 0.36, 0.018);
    g.rect(-0.05, 0.68, 0.1, 0.11);
    ell(g, 0, 0.79, 0.16, 0.01);
    poly(g, [-0.045, 0.8, 0.045, 0.8, 0.01, 1, -0.01, 1]);
  } },
  skytree: { aspect: 0.13, draw: g => {
    poly(g, [-0.5, 0, -0.14, 0.55, 0.14, 0.55, 0.5, 0]);
    g.rect(-0.3, 0.53, 0.6, 0.05);
    g.rect(-0.12, 0.58, 0.24, 0.13);
    g.rect(-0.22, 0.71, 0.44, 0.03);
    poly(g, [-0.09, 0.74, 0.09, 0.74, 0.015, 1, -0.015, 1]);
  } },
  merdeka: { aspect: 0.16, draw: g => {
    poly(g, [-0.5, 0, -0.46, 0.25, -0.36, 0.27, -0.3, 0.5, -0.2, 0.52, -0.12, 0.74, -0.03, 0.76, 0, 1,
      0.03, 0.74, 0.14, 0.72, 0.22, 0.49, 0.32, 0.47, 0.38, 0.24, 0.48, 0.22, 0.5, 0]);
  } },
  burj: { aspect: 0.17, draw: g => {
    // Setbacks spiral up the three wings (the right side steps half a beat later), then
    // the long needle.
    const steps = [0.5, 0.42, 0.35, 0.29, 0.23, 0.18, 0.14, 0.1, 0.07];
    const left: number[] = [], right: number[] = [];
    steps.forEach((w, k) => {
      const y0 = k * 0.088, y1 = y0 + 0.088, yr = y0 + 0.044;
      left.push(-w, y0, -w, y1);
      right.push(w * 0.96, yr, w * 0.96, yr + 0.088);
    });
    const top = steps.length * 0.088;
    const pts = [...left, -0.035, top, -0.008, 1, 0.008, 1, 0.035, top];
    for (let k = right.length - 2; k >= 0; k -= 2) pts.push(right[k], Math.min(right[k + 1], top));
    pts.push(0.5, 0);
    poly(g, pts);
  } },
  jeddah: { aspect: 0.15, draw: g => {
    g.moveTo(-0.5, 0); g.quadraticCurveTo(-0.32, 0.55, -0.05, 0.93); g.lineTo(0, 1); g.lineTo(0.05, 0.93);
    g.quadraticCurveTo(0.32, 0.55, 0.5, 0); g.closePath();
  } },
};
const shapeAt = (index: number): Shape | undefined => SHAPES[MILESTONES[index]?.id ?? ""];

/** Width over height of a landmark's silhouette. */
export const landmarkAspect = (index: number): number => shapeAt(index)?.aspect ?? 0.5;

/** The next landmark to beat, as a hazy silhouette beside the tower at its real height. */
export function drawLandmark(p: Paint, index: number, alpha: number): void {
  const ms = MILESTONES[index], shape = shapeAt(index);
  if (!ms || !shape || alpha <= 0) return;
  const { ctx, view, env } = p;
  const floors = ms.m / 5;
  const [, groundY] = view.project(0, 0, 0), [, topY] = view.project(0, floors + 1, 0);
  const h = groundY - topY;
  if (topY > view.H + 20 || groundY < -20) return;
  const w = Math.min(h * shape.aspect, view.W * 0.42), cx = view.cx - view.W * 0.34;
  // A darker version of the sky with a soft glowing edge, so it reads clearly from day
  // to night without hiding the tower in front of it.
  const col = mixRgb(env.skyBot, env.skyTop, 0.35);
  const g = ctx.createLinearGradient(0, topY, 0, groundY);
  g.addColorStop(0, rgb(mixRgb(col, [16, 20, 52], 0.62)));
  g.addColorStop(0.7, rgb(mixRgb(col, [16, 20, 52], 0.5)));
  g.addColorStop(1, rgb(col, 1, 0));
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.translate(cx, groundY);
  ctx.scale(w, -h);
  ctx.beginPath();
  shape.draw(ctx);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = g;
  // The soft glow is a blurred shadow, which is costly to draw every frame; phones (no
  // shader pass) skip it.
  if (!env.low && env.post) {
    ctx.shadowColor = `rgba(255, 236, 200, ${0.35 + env.nf * 0.25})`;
    ctx.shadowBlur = 14;
  }
  ctx.fill();
  ctx.restore();
}

/** The landmark's height and name, drawn over the scene so the island never hides it. */
export function drawLandmarkLabel(p: Paint, index: number, alpha: number, minY = 0): void {
  const ms = MILESTONES[index], shape = SHAPES[index];
  if (!ms || !shape || alpha <= 0) return;
  const { ctx, view } = p;
  const floors = ms.m / 5;
  const [, topY] = view.project(0, floors + 1, 0);
  const cx = view.cx - view.W * 0.34;
  if (topY < minY + 30) return;
  if (topY > 0 && topY < view.H - 40) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = `16px ${NUM_FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 6;
    // Keep the label on screen even when the silhouette sits near the edge.
    const name = shortName(t(ms.name));
    ctx.font = `800 12px ${UI_FONT}`;
    const half = Math.max(ctx.measureText(name).width / 2 + 8, 30);
    const lx = clamp(cx, half, view.W - half);
    ctx.fillText(name, lx, topY - 8);
    ctx.font = `16px ${NUM_FONT}`;
    ctx.fillText(`${ms.m} m`, lx, topY - 24);
    ctx.restore();
  }
}

/** Curtains of green and violet light high up on clear nights. */
export function drawAurora(p: Paint, height: number): void {
  const { ctx, view, env } = p;
  const a = env.nf * clamp((height - 100) / 50, 0, 1);
  if (a <= 0.02 || env.low) return;
  const { W, H } = view;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let band = 0; band < 3; band++) {
    const base = H * (0.12 + band * 0.1), amp = H * 0.05, hue = band === 1 ? [160, 90, 255] : [70, 255, 170];
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * W, y = base + Math.sin(i * 0.5 + env.time * 0.3 + band * 2) * amp + Math.sin(i * 0.17 + env.time * 0.17) * amp;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let i = 24; i >= 0; i--) {
      const x = (i / 24) * W, y = base + H * 0.16 + Math.sin(i * 0.5 + env.time * 0.3 + band * 2) * amp * 0.6;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - amp, 0, base + H * 0.18);
    g.addColorStop(0, `rgba(${hue.join(",")},0)`);
    g.addColorStop(0.3, `rgba(${hue.join(",")},${0.22 * a})`);
    g.addColorStop(1, `rgba(${hue.join(",")},0)`);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

/** A landmark's silhouette in a box (for postcards and the 3D view): bottom center at
 *  (cx, bottom). With `shade`, the sunlit right side is lighter and the edges softer, so
 *  it reads as a real building in the haze rather than a flat cut-out. */
export function drawLandmarkShape(g: CanvasRenderingContext2D, index: number, cx: number, bottom: number, maxW: number, h: number, fill: string | CanvasGradient, shade = false): void {
  const shape = shapeAt(index);
  if (!shape) return;
  const w = Math.min(h * shape.aspect, maxW);
  g.save();
  g.translate(cx, bottom);
  g.scale(w, -h);
  g.beginPath();
  shape.draw(g);
  g.fillStyle = fill;
  g.fill("nonzero");
  if (shade) {
    g.clip("nonzero");
    const lit = g.createLinearGradient(-0.5, 0, 0.5, 0);
    lit.addColorStop(0, "rgba(40,50,80,0.22)");
    lit.addColorStop(0.45, "rgba(255,255,255,0)");
    lit.addColorStop(0.6, "rgba(255,255,255,0.35)");
    lit.addColorStop(1, "rgba(255,255,255,0.15)");
    g.fillStyle = lit;
    g.fillRect(-0.5, 0, 1, 1);
    const fade = g.createLinearGradient(0, 0, 0, 0.35);
    fade.addColorStop(0, "rgba(255,255,255,0.35)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(-0.5, 0, 1, 0.35);
  }
  g.restore();
}

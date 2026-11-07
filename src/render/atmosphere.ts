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

/** Silhouettes of the landmarks, drawn in a unit box: x from -0.5 to 0.5, y from 0 (ground) to 1 (top). */
const SHAPES: { aspect: number; draw: (g: CanvasRenderingContext2D) => void }[] = [
  { aspect: 1.1, draw: g => { g.rect(-0.4, 0, 0.8, 0.6); g.moveTo(-0.5, 0.6); g.lineTo(0, 1); g.lineTo(0.5, 0.6); } }, // a house
  { aspect: 2.2, draw: g => { g.moveTo(-0.5, 0); g.lineTo(-0.5, 0.92); g.lineTo(-0.1, 1); g.lineTo(0.2, 0.95); g.lineTo(0.5, 1); g.lineTo(0.5, 0); } }, // Niagara's cliffs
  { aspect: 0.32, draw: g => { // Statue of Liberty
    g.rect(-0.3, 0, 0.6, 0.42); g.moveTo(-0.16, 0.42); g.lineTo(-0.12, 0.82); g.lineTo(0.12, 0.82); g.lineTo(0.16, 0.42);
    g.rect(-0.07, 0.82, 0.14, 0.08); g.rect(0.08, 0.78, 0.07, 0.17); g.rect(0.06, 0.95, 0.11, 0.05);
  } },
  { aspect: 1.55, draw: g => { g.moveTo(-0.5, 0); g.lineTo(0, 1); g.lineTo(0.5, 0); } }, // the Great Pyramid
  { aspect: 0.3, draw: g => { // Space Needle
    g.moveTo(-0.3, 0); g.lineTo(-0.06, 0.62); g.lineTo(0.06, 0.62); g.lineTo(0.3, 0); g.lineTo(0.18, 0); g.lineTo(0, 0.5); g.lineTo(-0.18, 0);
    g.moveTo(-0.5, 0.66); g.lineTo(0.5, 0.66); g.lineTo(0.32, 0.76); g.lineTo(-0.32, 0.76); g.rect(-0.02, 0.76, 0.04, 0.24);
  } },
  { aspect: 0.22, draw: g => { // a Golden Gate tower
    g.rect(-0.5, 0, 0.25, 1); g.rect(0.25, 0, 0.25, 1); g.rect(-0.25, 0.3, 0.5, 0.06); g.rect(-0.25, 0.6, 0.5, 0.06); g.rect(-0.25, 0.86, 0.5, 0.08);
  } },
  { aspect: 0.5, draw: g => { // Eiffel Tower
    g.moveTo(-0.5, 0); g.quadraticCurveTo(-0.2, 0.25, -0.08, 0.7); g.lineTo(-0.02, 0.92); g.lineTo(0, 1); g.lineTo(0.02, 0.92); g.lineTo(0.08, 0.7);
    g.quadraticCurveTo(0.2, 0.25, 0.5, 0); g.lineTo(0.32, 0); g.quadraticCurveTo(0, 0.18, -0.32, 0); g.rect(-0.3, 0.3, 0.6, 0.03);
  } },
  { aspect: 0.3, draw: g => { // Empire State Building
    g.rect(-0.5, 0, 1, 0.18); g.rect(-0.38, 0.18, 0.76, 0.5); g.rect(-0.26, 0.68, 0.52, 0.1); g.rect(-0.14, 0.78, 0.28, 0.06); g.rect(-0.06, 0.84, 0.12, 0.06); g.rect(-0.015, 0.9, 0.03, 0.1);
  } },
  { aspect: 0.16, draw: g => { // Burj Khalifa
    g.moveTo(-0.5, 0); g.lineTo(-0.42, 0.25); g.lineTo(-0.3, 0.27); g.lineTo(-0.24, 0.5); g.lineTo(-0.14, 0.52); g.lineTo(-0.08, 0.75); g.lineTo(-0.02, 0.8); g.lineTo(0, 1);
    g.lineTo(0.02, 0.8); g.lineTo(0.08, 0.72); g.lineTo(0.16, 0.48); g.lineTo(0.26, 0.45); g.lineTo(0.34, 0.22); g.lineTo(0.44, 0.2); g.lineTo(0.5, 0);
  } },
];

/** The next landmark to beat, as a hazy silhouette beside the tower at its real height. */
export function drawLandmark(p: Paint, index: number, alpha: number): void {
  const ms = MILESTONES[index], shape = SHAPES[index];
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

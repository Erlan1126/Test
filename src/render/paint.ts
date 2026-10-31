// The isometric camera and the low-level drawing helpers everything else uses.
import { rgb, type RGB } from "../core/util";

const ISO_X = Math.cos(Math.PI / 6), ISO_Y = 0.5;
export { ISO_X, ISO_Y };

/** Screen size and the isometric camera. World units are converted with project(). */
export class View {
  W = 0;
  H = 0;
  /** Pixels per world unit (horizontal). */
  s = 1;
  /** Pixels per floor (vertical). */
  th = 1;
  zoom = 0.72;
  /** Floor at the camera's anchor point. */
  level = 0;
  originY = 0;
  cx = 0;

  project(x: number, y: number, z: number): [number, number] {
    return [
      this.cx + (x - z) * ISO_X * this.s * this.zoom,
      this.originY + ((x + z) * ISO_Y * this.s - (y - this.level) * this.th) * this.zoom,
    ];
  }

  /** Wide screens put the game-over card beside the tower. */
  get wide(): boolean {
    return this.W / this.H >= 1.25 && this.W >= 760;
  }
}

/** Per-frame lighting: how dark it is (nf, 0 day to 1 night), sky colors, and time. */
export interface Env {
  nf: number;
  skyTop: RGB;
  skyBot: RGB;
  /** How far the camera has climbed, in pixels, for parallax. */
  climb: number;
  time: number;
  /** Smooth mode: skip the most expensive effects. */
  low: boolean;
}

export interface Paint {
  ctx: CanvasRenderingContext2D;
  view: View;
  env: Env;
}

export type Pt = [number, number];

export function poly(p: Paint, pts: Pt[], fill: string | CanvasGradient): void {
  const ctx = p.ctx;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** A face shaded from top to bottom. Points are [top-left, top-right, bottom-right, bottom-left]. */
export function face(p: Paint, pts: Pt[], c: RGB, fTop: number, fBot: number): void {
  const g = p.ctx.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
  g.addColorStop(0, rgb(c, fTop));
  g.addColorStop(1, rgb(c, fBot));
  poly(p, pts, g);
}

/** Additive glow for lit windows and neon, skipped in smooth mode. */
export function glow(p: Paint, pts: Pt[], color: string): void {
  if (p.env.low) return;
  const ctx = p.ctx;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha *= 0.22;
  poly(p, pts, color);
  ctx.globalAlpha /= 0.22;
  ctx.globalCompositeOperation = "source-over";
}

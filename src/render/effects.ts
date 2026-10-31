// Short-lived visual effects: sparkles, glass shards, dust, falling pieces and score popups.
import { clamp, hexRgb, lerp, mixRgb, rand, rgb, type RGB } from "../core/util";
import { NUM_FONT, UI_FONT } from "../data/constants";
import type { Look } from "../data/skins";
import type { Box } from "../logic/rules";
import type { Floor } from "../logic/sim";
import { drawBlock } from "./buildings";
import { poly, type Paint } from "./paint";

interface Particle {
  kind: "spark" | "shard" | "dust";
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  color: string;
  rot: number;
}

export interface Debris extends Floor {
  axis: "x" | "z";
  color: RGB;
  look: Look;
  vy: number;
  vside: number;
  life: number;
  /** Behind the tower (drawn before it) or in front. */
  back: boolean;
}

interface Popup {
  text: string;
  sub: string;
  y: number;
  life: number;
  color: string;
  big?: boolean;
}

export class Effects {
  particles: Particle[] = [];
  debris: Debris[] = [];
  popups: Popup[] = [];
  /** Landing squash on the top floor, 1 to 0. */
  bounce = 0;
  /** Outline flash on a perfect drop, 1 to 0. */
  flash = 0;
  flashGold = false;
  shake = 0;
  /** A small camera push-in on good drops. */
  punch = 0;
  whiteFlash = 0;

  clear(): void {
    this.particles = [];
    this.debris = [];
    this.popups = [];
    this.bounce = this.flash = this.shake = this.punch = this.whiteFlash = 0;
  }

  sparkle(b: Floor, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const edge = Math.random(), onX = Math.random() < 0.5;
      const x = onX ? lerp(b.x0, b.x1, edge) : (Math.random() < 0.5 ? b.x0 : b.x1);
      const z = onX ? (Math.random() < 0.5 ? b.z0 : b.z1) : lerp(b.z0, b.z1, edge);
      this.particles.push({
        kind: "spark", x, z, y: b.y + 1,
        vx: (x - (b.x0 + b.x1) / 2) * 0.45, vz: (z - (b.z0 + b.z1) / 2) * 0.45,
        vy: rand(1, 3.2), life: rand(0.5, 1), max: 1, color, size: rand(2, 4.5), rot: 0,
      });
    }
  }

  shatter(p: Debris, glass: string): void {
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        kind: "shard", x: rand(p.x0, p.x1), z: rand(p.z0, p.z1), y: p.y + rand(0.2, 0.9),
        vx: rand(-3, 3) + (p.axis === "x" ? p.vside : 0), vz: rand(-3, 3) + (p.axis === "z" ? p.vside : 0),
        vy: rand(0, 3), life: rand(0.6, 1.1), max: 1.1, color: glass, size: rand(3, 6), rot: rand(0, 6),
      });
    }
  }

  dust(b: Floor): void {
    const corners = [[b.x0, b.z1], [b.x1, b.z1], [b.x1, b.z0], [(b.x0 + b.x1) / 2, b.z1], [b.x1, (b.z0 + b.z1) / 2]];
    for (const [x, z] of corners) {
      this.particles.push({ kind: "dust", x, z, y: b.y + 0.05, vx: rand(-0.6, 0.6), vz: rand(-0.6, 0.6), vy: 0.3, life: 0.5, max: 0.5, size: rand(4, 7), color: "#ffffff", rot: 0 });
    }
  }

  popup(text: string, sub: string, y: number, color = "#ffffff", life = 1.1, big = false): void {
    this.popups.push({ text, sub, y, life, color, big });
  }

  update(dt: number): void {
    this.bounce = Math.max(0, this.bounce - dt * 6);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.punch = Math.max(0, this.punch - dt * 2.5);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2);
    for (const d of this.debris) {
      d.vy += 26 * dt;
      d.y -= d.vy * dt;
      const side = d.vside * dt;
      if (d.axis === "x") { d.x0 += side; d.x1 += side; } else { d.z0 += side; d.z1 += side; }
      d.life -= dt * 0.7;
    }
    this.debris = this.debris.filter(d => d.life > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      p.vy -= (p.kind === "shard" ? 9 : p.kind === "dust" ? 0 : 3) * dt;
      p.life -= dt;
      if (p.kind === "shard") p.rot += dt * 8;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.popups) { p.life -= dt; p.y += dt * 1.3; }
    this.popups = this.popups.filter(p => p.life > 0);
  }

  drawDebris(p: Paint, back: boolean): void {
    for (const d of this.debris) {
      if (d.back === back) drawBlock(p, d, d.y, d.y + 1, d.color, d.look, { alpha: clamp(d.life, 0, 1), kind: d.kind });
    }
  }

  drawParticles(p: Paint): void {
    const { ctx, view } = p;
    for (const q of this.particles) {
      const [x, y] = view.project(q.x, q.y, q.z);
      const a = clamp(q.life / q.max * 1.6, 0, 1);
      const r = q.size * view.zoom;
      if (q.kind === "spark") {
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x, y + r * 1.6); ctx.lineTo(x - r * 0.5, y);
        ctx.closePath(); ctx.fill();
      } else if (q.kind === "shard") {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot);
        ctx.fillStyle = rgb(mixRgb(hexRgb(q.color), [255, 255, 255], 0.4));
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.4); ctx.lineTo(r, -r * 0.7); ctx.lineTo(0, r); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        const grow = 1 + (1 - q.life / q.max) * 2;
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, r * grow, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** A bright outline that expands from a perfect floor. */
  drawFlash(p: Paint, t: Floor): void {
    if (this.flash <= 0) return;
    const { ctx, view } = p;
    const g = (1 - this.flash) * 2;
    const pts = [[t.x0 - g, t.z0 - g], [t.x1 + g, t.z0 - g], [t.x1 + g, t.z1 + g], [t.x0 - g, t.z1 + g]]
      .map(([x, z]) => view.project(x, t.y + 1, z));
    ctx.strokeStyle = this.flashGold ? `rgba(255,210,63,${this.flash})` : `rgba(255,255,255,${this.flash})`;
    ctx.lineWidth = 4 * this.flash + 1;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  }

  /** `minY` keeps popups below the score display at the top of the screen. */
  drawPopups(p: Paint, top: Box, minY = 0): void {
    const { ctx, view } = p;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const q of this.popups) {
      const y = Math.max(view.project((top.x0 + top.x1) / 2, q.y, (top.z0 + top.z1) / 2)[1], minY + (q.big ? 40 : 30));
      const pop = 1 + Math.max(0, q.life - 0.9) * 2;
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.font = `${Math.round((q.big ? 40 : 28) * pop)}px ${NUM_FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(10,14,40,0.55)";
      ctx.strokeText(q.text, view.W / 2, y - 34);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, view.W / 2, y - 34);
      if (q.sub) {
        ctx.font = `800 18px ${UI_FONT}`;
        ctx.strokeText(q.sub, view.W / 2, y - 10);
        ctx.fillText(q.sub, view.W / 2, y - 10);
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Shows where the sliding floor will land, to help aim. */
export function drawLandingShadow(p: Paint, mover: Box, top: Floor, bounce: number): void {
  const x0 = Math.max(mover.x0, top.x0), x1 = Math.min(mover.x1, top.x1);
  const z0 = Math.max(mover.z0, top.z0), z1 = Math.min(mover.z1, top.z1);
  if (x1 <= x0 || z1 <= z0) return;
  const y = top.y + 1 - bounce * 0.3, v = p.view;
  poly(p, [v.project(x0, y, z0), v.project(x1, y, z0), v.project(x1, y, z1), v.project(x0, y, z1)], "rgba(10,20,50,0.22)");
}

/** Beginner guide: a dashed outline where the sliding floor should land. It turns green
 *  when tapping now would be a perfect drop. */
export function drawGuide(p: Paint, top: Floor, moverY: number, ready: boolean): void {
  const { ctx, view, env } = p;
  const y0 = moverY, y1 = moverY + 1;
  const P = (x: number, y: number, z: number) => view.project(x, y, z);
  const pts = [P(top.x0, y1, top.z0), P(top.x1, y1, top.z0), P(top.x1, y1, top.z1), P(top.x0, y1, top.z1)];
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ready ? "#8ce99a" : `rgba(255,255,255,${0.55 + Math.sin(env.time * 6) * 0.25})`;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  for (const [x, z] of [[top.x0, top.z1], [top.x1, top.z1], [top.x1, top.z0]]) {
    const [ax, ay] = P(x, y1, z), [bx, by] = P(x, y0, z);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  }
  ctx.stroke();
  if (ready) {
    ctx.globalAlpha = 0.25;
    poly(p, pts, "#8ce99a");
  }
  ctx.restore();
}

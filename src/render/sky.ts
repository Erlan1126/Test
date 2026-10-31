// Things flying past as the tower climbs. Each kind lives at its own altitude: birds low
// down, then helicopters, small planes, an airship, jets with contrails up high, and at
// night satellites and the odd UFO. Flyers sit at a fixed floor, so you climb past them.
import { clamp, rand } from "../core/util";
import type { Paint } from "./paint";

type Kind = "birds" | "heli" | "plane" | "blimp" | "jet" | "sat" | "ufo";

interface Flyer {
  kind: Kind;
  /** Altitude in floors. */
  level: number;
  /** Screen position as a fraction of the width. */
  x: number;
  dir: 1 | -1;
  /** Screen widths per second. */
  speed: number;
  /** Size multiplier (smaller is farther away). */
  scale: number;
  phase: number;
  color: string;
  livery: string;
}

const KINDS: { kind: Kind; min: number; max: number; weight: number; speed: number; night?: "only" | "never" }[] = [
  { kind: "birds", min: 2, max: 45, weight: 3, speed: 0.05, night: "never" },
  { kind: "heli", min: 12, max: 70, weight: 2, speed: 0.07 },
  { kind: "plane", min: 25, max: 120, weight: 3, speed: 0.09 },
  { kind: "blimp", min: 35, max: 110, weight: 1.2, speed: 0.025 },
  { kind: "jet", min: 70, max: 9999, weight: 3, speed: 0.14 },
  { kind: "sat", min: 100, max: 9999, weight: 1.5, speed: 0.035, night: "only" },
  { kind: "ufo", min: 140, max: 9999, weight: 0.25, speed: 0.22, night: "only" },
];
const LIVERY = ["#ffffff", "#e9f1ff", "#fff4e6", "#f1f3f5"];
const ACCENT = ["#ff4f8b", "#339af0", "#ff922b", "#845ef7", "#20c997"];

export class SkyTraffic {
  private flyers: Flyer[] = [];
  private timer = 1.5;

  clear(): void {
    this.flyers = [];
    this.timer = 1.5;
  }

  /** Floors visible at the top and bottom of the screen. */
  private range(p: Paint): [number, number] {
    const v = p.view, per = v.th * v.zoom;
    return [v.level + (v.originY - v.H) / per, v.level + v.originY / per];
  }

  update(p: Paint, dt: number): void {
    const [lo, hi] = this.range(p), nf = p.env.nf;
    for (const f of this.flyers) { f.x += f.dir * f.speed * dt; f.phase += dt; }
    this.flyers = this.flyers.filter(f => f.x > -0.5 && f.x < 1.5 && f.level > lo - 15);
    this.timer -= dt;
    if (this.timer > 0 || this.flyers.length >= 4) return;
    this.timer = rand(2.5, 6);
    // Mostly spawn ahead of the climb, so you rise up past them.
    const level = rand(lo + (hi - lo) * 0.35, hi + 6);
    const options = KINDS.filter(k => level >= k.min && level <= k.max
      && !(k.night === "only" && nf < 0.6) && !(k.night === "never" && nf > 0.5));
    const total = options.reduce((s, k) => s + k.weight, 0);
    if (!total) return;
    let r = Math.random() * total;
    const pick = options.find(k => (r -= k.weight) <= 0) ?? options[0];
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const scale = rand(0.7, 1.15);
    this.flyers.push({
      kind: pick.kind, level, dir, scale, phase: rand(0, 10),
      x: dir > 0 ? -0.3 : 1.3,
      speed: pick.speed * rand(0.8, 1.2) * (pick.kind === "jet" ? 1 / scale : 1),
      color: ACCENT[Math.floor(Math.random() * ACCENT.length)],
      livery: LIVERY[Math.floor(Math.random() * LIVERY.length)],
    });
  }

  draw(p: Paint): void {
    const { ctx, view } = p;
    for (const f of this.flyers) {
      const [, y] = view.project(0, f.level, 0);
      if (y < -80 || y > view.H + 80) continue;
      const size = view.s * view.zoom * f.scale;
      ctx.save();
      ctx.translate(f.x * view.W, y);
      if (f.dir < 0) ctx.scale(-1, 1);
      switch (f.kind) {
        case "birds": this.birds(p, f, size); break;
        case "heli": this.heli(p, f, size); break;
        case "plane": this.plane(p, f, size); break;
        case "blimp": this.blimp(p, f, size); break;
        case "jet": this.jet(p, f, size * 0.55); break;
        case "sat": this.sat(p, f); break;
        case "ufo": this.ufo(p, f, size); break;
      }
      ctx.restore();
    }
  }

  private blink(p: Paint, x: number, y: number, color: string, on: boolean, r: number): void {
    if (!on) return;
    const ctx = p.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  /** Body shading that darkens at night. */
  private tone(p: Paint): number {
    return 1 - p.env.nf * 0.65;
  }

  private birds(p: Paint, f: Flyer, s: number): void {
    const ctx = p.ctx;
    ctx.strokeStyle = `rgba(35,40,65,${0.8 * this.tone(p)})`;
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      // A loose V formation, each bird flapping on its own beat
      const bx = -i * s * 0.9, by = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * s * 0.55;
      const w = s * 0.45, flap = Math.sin(f.phase * 8 + i * 1.3) * 0.7;
      ctx.moveTo(bx - w, by - w * flap); ctx.quadraticCurveTo(bx - w * 0.4, by - w * 0.2, bx, by);
      ctx.quadraticCurveTo(bx + w * 0.4, by - w * 0.2, bx + w, by - w * flap);
    }
    ctx.stroke();
  }

  private heli(p: Paint, f: Flyer, s: number): void {
    const ctx = p.ctx, t = this.tone(p);
    ctx.globalAlpha = t;
    // Tail boom and fin
    ctx.fillStyle = "#3b4a6b";
    ctx.fillRect(-s * 2.4, -s * 0.12, s * 1.8, s * 0.22);
    ctx.fillRect(-s * 2.5, -s * 0.5, s * 0.22, s * 0.5);
    // Cabin
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.85, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(190,230,255,0.9)";
    ctx.beginPath(); ctx.ellipse(s * 0.35, -s * 0.08, s * 0.38, s * 0.28, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
    // Skids
    ctx.strokeStyle = "#2b3550";
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.72); ctx.lineTo(s * 0.7, s * 0.72); ctx.stroke();
    // Spinning rotor (drawn as a blade that sweeps across)
    const span = s * 1.9 * Math.abs(Math.cos(f.phase * 30));
    ctx.strokeStyle = "rgba(40,45,70,0.75)";
    ctx.beginPath(); ctx.moveTo(-span, -s * 0.62); ctx.lineTo(span, -s * 0.62); ctx.stroke();
    ctx.fillStyle = "rgba(40,45,70,0.12)";
    ctx.beginPath(); ctx.ellipse(0, -s * 0.62, s * 1.9, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    this.blink(p, -s * 2.45, -s * 0.5, "rgba(255,60,60,0.8)", Math.floor(f.phase * 1.5) % 2 === 0, Math.max(1.5, s * 0.12));
  }

  private plane(p: Paint, f: Flyer, s: number): void {
    const ctx = p.ctx, t = this.tone(p);
    ctx.globalAlpha = 0.35 + 0.65 * t;
    // Far wing
    ctx.fillStyle = "#9aa6bd";
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.05); ctx.lineTo(-s * 0.9, -s * 0.75); ctx.lineTo(-s * 0.55, -s * 0.75); ctx.lineTo(s * 0.35, -s * 0.05); ctx.fill();
    // Fuselage
    ctx.fillStyle = f.livery;
    ctx.beginPath();
    ctx.moveTo(s * 2, 0);
    ctx.quadraticCurveTo(s * 1.9, -s * 0.3, s * 1.3, -s * 0.3);
    ctx.lineTo(-s * 1.7, -s * 0.25);
    ctx.lineTo(-s * 2.1, -s * 0.05);
    ctx.lineTo(-s * 1.7, s * 0.2);
    ctx.lineTo(s * 1.3, s * 0.25);
    ctx.quadraticCurveTo(s * 1.95, s * 0.25, s * 2, 0);
    ctx.fill();
    // Tail fin and stripe in the airline color
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(-s * 1.4, -s * 0.24); ctx.lineTo(-s * 2.05, -s * 0.95); ctx.lineTo(-s * 1.75, -s * 0.95); ctx.lineTo(-s * 1.0, -s * 0.25); ctx.fill();
    ctx.fillRect(-s * 1.6, s * 0.02, s * 3.2, s * 0.08);
    // Windows
    ctx.fillStyle = p.env.nf > 0.4 ? "#ffe9a8" : "#5c7cb0";
    for (let i = 0; i < 9; i++) ctx.fillRect(s * (1.1 - i * 0.28), -s * 0.15, s * 0.11, s * 0.1);
    ctx.fillStyle = "#2b3a5c";
    ctx.beginPath(); ctx.moveTo(s * 1.65, -s * 0.24); ctx.lineTo(s * 1.9, -s * 0.12); ctx.lineTo(s * 1.65, -s * 0.12); ctx.fill();
    // Near wing
    ctx.fillStyle = "#c6cfdf";
    ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.12); ctx.lineTo(-s * 0.7, s * 0.95); ctx.lineTo(-s * 0.35, s * 0.95); ctx.lineTo(s * 0.9, s * 0.12); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.env.nf > 0.2) {
      this.blink(p, -s * 0.6, s * 0.95, "rgba(60,255,120,0.8)", true, Math.max(1.4, s * 0.1));
      this.blink(p, -s * 2.0, -s * 0.9, "rgba(255,255,255,0.9)", Math.floor(f.phase * 1.2) % 2 === 0, Math.max(1.4, s * 0.1));
    }
  }

  private jet(p: Paint, f: Flyer, s: number): void {
    const { ctx, env, view } = p;
    // Contrail stretching back across the sky, fading and spreading out
    const len = view.W * 0.6;
    const g = ctx.createLinearGradient(-s * 1.6, 0, -s * 1.6 - len, 0);
    g.addColorStop(0, `rgba(255,255,255,${0.7 - env.nf * 0.4})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 1.6, -s * 0.12); ctx.lineTo(-s * 1.6 - len, -s * 0.6); ctx.lineTo(-s * 1.6 - len, s * 0.6); ctx.lineTo(-s * 1.6, s * 0.12); ctx.fill();
    ctx.fillStyle = env.nf > 0.5 ? "#8090b0" : "#f4f6fa";
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.8, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.lineTo(-s * 0.6, s * 0.9); ctx.lineTo(-s * 0.2, s * 0.9); ctx.lineTo(s * 0.8, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 1.2, 0); ctx.lineTo(-s * 1.8, -s * 0.7); ctx.lineTo(-s * 1.55, -s * 0.7); ctx.lineTo(-s * 0.9, 0); ctx.fill();
    if (env.nf > 0.2) this.blink(p, 0, s * 0.2, "rgba(255,70,70,0.8)", Math.floor(f.phase * 1.3) % 2 === 0, Math.max(1.3, s * 0.15));
  }

  private blimp(p: Paint, f: Flyer, s: number): void {
    const ctx = p.ctx, t = this.tone(p), w = s * 4.2, h = s * 1.3;
    ctx.globalAlpha = 0.4 + 0.6 * t;
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#c9d3e6");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(-w * 0.8, -h * 0.3); ctx.lineTo(-w * 1.05, -h * 1.05); ctx.lineTo(-w * 0.95, -h * 0.1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w * 0.8, h * 0.3); ctx.lineTo(-w * 1.05, h * 1.05); ctx.lineTo(-w * 0.95, h * 0.1); ctx.fill();
    ctx.fillRect(-w * 0.62, -h * 0.28, w * 1.2, h * 0.56);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.max(7, h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Text runs the right way whichever direction the airship flies.
    ctx.save();
    ctx.scale(f.dir, 1);
    ctx.fillText("SKYRISE", f.dir * -w * 0.02, h * 0.02);
    ctx.restore();
    ctx.fillStyle = "#4a5675";
    ctx.fillRect(-w * 0.18, h * 0.9, w * 0.36, h * 0.35);
    ctx.globalAlpha = 1;
    if (p.env.nf > 0.2) this.blink(p, w * 0.9, 0, "rgba(255,80,80,0.7)", Math.floor(f.phase) % 2 === 0, Math.max(1.5, s * 0.15));
  }

  private sat(p: Paint, f: Flyer): void {
    const ctx = p.ctx;
    const a = clamp(0.6 + Math.sin(f.phase * 3) * 0.4, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.fillStyle = `rgba(160,200,255,${a * 0.8})`;
    ctx.fillRect(-6, -0.75, 3.5, 1.5);
    ctx.fillRect(2.5, -0.75, 3.5, 1.5);
  }

  private ufo(p: Paint, f: Flyer, s: number): void {
    const ctx = p.ctx;
    ctx.translate(0, Math.sin(f.phase * 4) * s * 0.4);
    // Tractor beam glow below
    const g = ctx.createLinearGradient(0, 0, 0, s * 4);
    g.addColorStop(0, "rgba(140,255,200,0.35)");
    g.addColorStop(1, "rgba(140,255,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.2); ctx.lineTo(s * 0.5, s * 0.2); ctx.lineTo(s * 1.5, s * 4); ctx.lineTo(-s * 1.5, s * 4); ctx.fill();
    ctx.fillStyle = "rgba(170,255,230,0.85)";
    ctx.beginPath(); ctx.ellipse(0, -s * 0.25, s * 0.6, s * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#9aa3b8";
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    const colors = ["#ff4f8b", "#ffd43b", "#3bf0ff", "#8ce99a"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[(i + Math.floor(f.phase * 6)) % colors.length];
      ctx.beginPath(); ctx.arc((i - 2) * s * 0.6, s * 0.08, Math.max(1.2, s * 0.12), 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Little life on the island: people strolling around the plaza, benches, flower beds, a
// food cart, a flag, birds circling, floating rocks and (with the pond) a waterfall.
import { hash, hexRgb, rgb, type RGB } from "../core/util";
import { ISLAND } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import { drawBlock } from "./buildings";
import { NEIGHBOR_LOOK } from "../data/skins";
import { ISO_X, ISO_Y, poly, type Paint } from "./paint";
import { drawTreeShape } from "./scenery";

const SHIRTS = ["#ff6b6b", "#4dabf7", "#ffd43b", "#51cf66", "#f783ac", "#ffffff", "#845ef7", "#ff922b"];
const SKIN = ["#f1c27d", "#c68642", "#8d5524", "#ffdbac"];

/** People walk laps around the plaza (a square of half-size 7) or up and down the sidewalks. */
const WALKERS = Array.from({ length: 14 }, (_, i) => ({
  lane: i < 9 ? "plaza" : "walk",
  t: hash(i, 4, 2) * 56,
  speed: (0.45 + hash(i, 7, 3) * 0.4) * (hash(i, 1, 9) > 0.5 ? 1 : -1),
  shirt: SHIRTS[i % SHIRTS.length],
  skin: SKIN[Math.floor(hash(i, 2, 5) * SKIN.length)],
  side: hash(i, 3, 3) > 0.5 ? 1.95 : -1.95,
}));
const BENCHES = [[3.6, 7.95, "x"], [-3.6, 7.95, "x"], [7.95, 3.8, "z"], [7.95, -3.8, "z"], [-3.6, -7.95, "x"]] as const;
const BEDS = [[-8.3, -4.2, 0], [4.3, -8.3, 1], [-4.6, 8.4, 2], [9.4, 5.6, 3], [-9, 4, 4]] as const;
const ROCKS = [
  { x: -23, z: 5, y: -4, r: 2.6, tree: true },
  { x: 7, z: 24, y: -7, r: 2, tree: false },
  { x: 24, z: -6, y: -3, r: 2.2, tree: true },
  { x: -5, z: -24, y: -8, r: 1.8, tree: false },
  { x: 19, z: 18, y: -12, r: 1.4, tree: false },
];
const BIRDS = Array.from({ length: 7 }, (_, i) => ({ a: i * 0.35 + hash(i, 5, 5) * 0.4, r: 19 + hash(i, 8, 1) * 3, y: 5 + hash(i, 6, 6) * 2.5, flap: hash(i, 2, 8) * 6 }));

/** Position on a walker's path, in world units. */
function walkerPos(w: (typeof WALKERS)[number]): [number, number, number] {
  if (w.lane === "plaza") {
    const t = ((w.t % 56) + 56) % 56, side = Math.floor(t / 14), u = (t % 14) - 7, R = 7.05;
    const [x, z] = side === 0 ? [u, -R] : side === 1 ? [R, u] : side === 2 ? [-u, R] : [-R, -u];
    return [x, z, 1];
  }
  // Sidewalks along the road that runs off to the right (+x).
  const t = ((w.t % 18) + 18) % 18, x = 7.6 + (t < 9 ? t : 18 - t);
  return [x, w.side, t < 9 ? 1 : -1];
}

/** Where each city building stands (world units) and how much room it clears of trees. */
export const BUILD_SPOTS: Record<string, { x: number; z: number; r: number }> = {
  cafe: { x: 5.6, z: -10.6, r: 2 },
  playground: { x: -11.5, z: -4.6, r: 2 },
  statue: { x: 4, z: 11, r: 1.6 },
  windmill: { x: 2.5, z: -13.2, r: 1.8 },
  observatory: { x: -3, z: -12.6, r: 2 },
  lighthouse: { x: -15.3, z: -15.3, r: 1.6 },
  rocket: { x: 14.6, z: 5.6, r: 2 },
};

export class IslandLife {
  /** City buildings the player has built. */
  city: string[] = [];
  /** Which island upgrades are built (index into ISLAND_UPGRADES). */
  has: (i: number) => boolean = () => false;
  theme!: IslandTheme;

  update(dt: number): void {
    for (const w of WALKERS) w.t += w.speed * dt;
    for (const b of BIRDS) { b.a += dt * 0.12; b.flap += dt * 9; }
  }

  /** Floating chunks of island; the ones behind are drawn before the island itself. */
  drawRocks(p: Paint, back: boolean): void {
    const { view, env } = p, d = 1 - env.nf * 0.6, t = this.theme;
    for (const [i, k] of ROCKS.entries()) {
      if ((k.x + k.z < 0) !== back) continue;
      const y = k.y + Math.sin(env.time * 0.5 + i * 1.7) * 0.35;
      const P = (x: number, yy: number, z: number) => view.project(k.x + x, y + yy, k.z + z);
      const r = k.r;
      poly(p, [P(-r, 0, r), P(r, 0, r), P(0, -r * 2.2, 0)], rgb(hexRgb(t.rockL), d));
      poly(p, [P(r, 0, -r), P(r, 0, r), P(0, -r * 2.2, 0)], rgb(hexRgb(t.rockR), d));
      poly(p, [P(-r, 0, r), P(r, 0, r), P(r, -0.5, r), P(-r, -0.5, r)], rgb(hexRgb(t.dirtL), d));
      poly(p, [P(r, 0, -r), P(r, 0, r), P(r, -0.5, r), P(r, -0.5, -r)], rgb(hexRgb(t.dirtR), d));
      poly(p, [P(-r, 0, -r), P(r, 0, -r), P(r, 0, r), P(-r, 0, r)], rgb(hexRgb(t.lawn), d));
      if (k.tree) {
        const [sx, sy] = P(0, 0, 0);
        drawTreeShape(p.ctx, t, sx, sy, 0.7 * view.s * view.zoom, hash(i, 1, 1), d);
      }
    }
  }

  /** Ground details and anything behind the tower. */
  /** City buildings behind (or in front of) the tower. */
  private drawCity(p: Paint, back: boolean): void {
    for (const id of this.city) {
      const s = BUILD_SPOTS[id];
      if (!s || (s.x + s.z < 0) !== back) continue;
      switch (id) {
        case "cafe": this.cafe(p, s.x, s.z); break;
        case "playground": this.playground(p, s.x, s.z); break;
        case "statue": this.statue(p, s.x, s.z); break;
        case "windmill": this.windmill(p, s.x, s.z); break;
        case "observatory": this.observatory(p, s.x, s.z); break;
        case "lighthouse": this.lighthouse(p, s.x, s.z); break;
        case "rocket": this.rocket(p, s.x, s.z); break;
      }
    }
  }

  private shade(p: Paint): number {
    return 1 - p.env.nf * 0.55;
  }

  private cafe(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p);
    drawBlock(p, { x0: x - 1.1, x1: x + 1.1, z0: z - 0.8, z1: z + 0.8 }, 0, 0.75, [246, 226, 200], NEIGHBOR_LOOK);
    // Striped awning along the front
    for (let k = 0; k < 6; k++) {
      const u0 = x - 1.1 + k * (2.2 / 6), u1 = u0 + 2.2 / 6;
      const pts = [view.project(u0, 0.62, z + 0.8), view.project(u1, 0.62, z + 0.8), view.project(u1, 0.45, z + 1.25), view.project(u0, 0.45, z + 1.25)];
      poly(p, pts, rgb(k % 2 ? [255, 255, 255] : [255, 90, 120], d));
    }
    // Little tables with parasols
    for (const dx of [-0.6, 0.6]) {
      const [tx, ty] = view.project(x + dx, 0.05, z + 1.9), r = 0.35 * view.s * view.zoom;
      ctx.fillStyle = rgb([120, 90, 60], d);
      ctx.fillRect(tx - 0.6, ty - r * 1.6, 1.2, r * 1.6);
      ctx.fillStyle = rgb(dx < 0 ? [77, 171, 247] : [255, 212, 59], d);
      ctx.beginPath(); ctx.ellipse(tx, ty - r * 1.6, r, r * 0.45, 0, Math.PI, 0); ctx.fill();
    }
    if (env.nf > 0.3) {
      const [gx, gy] = view.project(x, 0.3, z + 1);
      ctx.fillStyle = `rgba(255,214,140,${0.35 * env.nf})`;
      ctx.beginPath(); ctx.arc(gx, gy, 1.4 * view.s * view.zoom, 0, Math.PI * 2); ctx.fill();
    }
  }

  private playground(p: Paint, x: number, z: number): void {
    const { ctx, view } = p, d = this.shade(p), P = (a: number, y: number, b: number) => view.project(a, y, b);
    const [cx, cy] = P(x, 0.03, z);
    const rx = 1.7 * Math.SQRT2 * ISO_X * view.s * view.zoom, ry = 1.7 * Math.SQRT2 * ISO_Y * view.s * view.zoom;
    ctx.fillStyle = rgb([236, 210, 150], d);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, 1.6 * view.zoom);
    ctx.lineCap = "round";
    // Swing frame with a swinging seat
    ctx.strokeStyle = rgb([77, 171, 247], d);
    const [a0x, a0y] = P(x - 0.9, 0, z - 0.5), [a1x, a1y] = P(x - 0.9, 0, z + 0.5), [t0x, t0y] = P(x - 0.9, 0.9, z), [b0x, b0y] = P(x + 0.4, 0, z - 0.5), [b1x, b1y] = P(x + 0.4, 0, z + 0.5), [t1x, t1y] = P(x + 0.4, 0.9, z);
    ctx.beginPath();
    ctx.moveTo(a0x, a0y); ctx.lineTo(t0x, t0y); ctx.lineTo(a1x, a1y);
    ctx.moveTo(b0x, b0y); ctx.lineTo(t1x, t1y); ctx.lineTo(b1x, b1y);
    ctx.moveTo(t0x, t0y); ctx.lineTo(t1x, t1y);
    ctx.stroke();
    const sw = Math.sin(p.env.time * 2.2) * 0.25;
    const [hx, hy] = P(x - 0.25, 0.9, z), [sx, sy] = P(x - 0.25, 0.3, z + sw);
    ctx.strokeStyle = rgb([80, 80, 90], d);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.fillStyle = rgb([255, 107, 107], d);
    ctx.fillRect(sx - 3 * view.zoom, sy - 1, 6 * view.zoom, 2.5 * view.zoom);
    // Slide
    const [l0x, l0y] = P(x + 0.9, 0, z + 0.9), [l1x, l1y] = P(x + 0.9, 0.7, z + 0.9), [s1x, s1y] = P(x + 0.9, 0, z - 0.6);
    ctx.strokeStyle = rgb([255, 212, 59], d);
    ctx.lineWidth = Math.max(1.5, 2.6 * view.zoom);
    ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(s1x, s1y); ctx.stroke();
    ctx.strokeStyle = rgb([120, 130, 150], d);
    ctx.lineWidth = Math.max(1, 1.4 * view.zoom);
    ctx.beginPath(); ctx.moveTo(l0x, l0y); ctx.lineTo(l1x, l1y); ctx.stroke();
  }

  private statue(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p);
    drawBlock(p, { x0: x - 0.55, x1: x + 0.55, z0: z - 0.55, z1: z + 0.55 }, 0, 0.45, [200, 205, 215], NEIGHBOR_LOOK, { plain: true });
    const [bx, by] = view.project(x, 0.45, z), h = 1.1 * view.th * view.zoom, w = h * 0.22;
    const g = ctx.createLinearGradient(bx - w, by - h, bx + w, by);
    g.addColorStop(0, rgb([255, 240, 170], d));
    g.addColorStop(0.5, rgb([255, 200, 60], d));
    g.addColorStop(1, rgb([190, 130, 20], d));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - w, by); ctx.lineTo(bx - w * 0.8, by - h * 0.7); ctx.lineTo(bx + w * 0.8, by - h * 0.7); ctx.lineTo(bx + w, by);
    ctx.closePath(); ctx.fill();
    // A raised arm holding a little golden floor
    ctx.strokeStyle = rgb([230, 170, 40], d);
    ctx.lineWidth = Math.max(1.2, w * 0.45);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx + w * 0.6, by - h * 0.62); ctx.lineTo(bx + w * 1.3, by - h * 1.02); ctx.stroke();
    ctx.fillRect(bx + w * 0.7, by - h * 1.12, w * 1.3, w * 0.5);
    ctx.beginPath(); ctx.arc(bx, by - h * 0.82, w * 0.6, 0, Math.PI * 2); ctx.fill();
    if (env.nf > 0.3) {
      ctx.fillStyle = `rgba(255,220,120,${0.25 * env.nf})`;
      ctx.beginPath(); ctx.arc(bx, by - h * 0.5, h * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  private windmill(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p);
    drawBlock(p, { x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }, 0, 2, [236, 230, 220], NEIGHBOR_LOOK, { plain: true });
    poly(p, [view.project(x - 0.55, 2, z + 0.55), view.project(x + 0.55, 2, z + 0.55), view.project(x + 0.55, 2, z - 0.55), view.project(x, 2.8, z)], rgb([180, 70, 60], d));
    const [hx, hy] = view.project(x + 0.2, 1.9, z + 0.6), L = 1.5 * view.s * view.zoom, a0 = env.time * 1.1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = rgb([110, 80, 60], d);
      ctx.lineWidth = Math.max(1, 1.4 * view.zoom);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + c * L, hy + s * L); ctx.stroke();
      ctx.fillStyle = rgb([250, 248, 240], d * 0.95);
      const px = -s, py = c, w = L * 0.22;
      ctx.beginPath();
      ctx.moveTo(hx + c * L * 0.3, hy + s * L * 0.3);
      ctx.lineTo(hx + c * L, hy + s * L);
      ctx.lineTo(hx + c * L + px * w, hy + s * L + py * w);
      ctx.lineTo(hx + c * L * 0.3 + px * w, hy + s * L * 0.3 + py * w);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = rgb([90, 70, 55], d);
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, 2.5 * view.zoom), 0, Math.PI * 2); ctx.fill();
  }

  private observatory(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p);
    drawBlock(p, { x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 }, 0, 0.8, [210, 214, 224], NEIGHBOR_LOOK, { plain: true });
    const [cx, cy] = view.project(x, 0.8, z), r = 1.15 * Math.SQRT2 * ISO_X * view.s * view.zoom;
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy);
    g.addColorStop(0, rgb([255, 255, 255], d));
    g.addColorStop(1, rgb([160, 170, 190], d));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.95, 0, Math.PI, 0); ctx.fill();
    // The slit, with the telescope peeking out
    ctx.fillStyle = rgb([40, 50, 80], d);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.12, cy - r * 0.2); ctx.lineTo(cx - r * 0.05, cy - r * 0.93); ctx.lineTo(cx + r * 0.12, cy - r * 0.93); ctx.lineTo(cx + r * 0.12, cy - r * 0.2); ctx.fill();
    ctx.strokeStyle = rgb([60, 70, 100], d);
    ctx.lineWidth = Math.max(1.5, 3 * view.zoom);
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx + r * 0.45, cy - r * 1.15); ctx.stroke();
    if (env.nf > 0.4) {
      ctx.fillStyle = `rgba(160,190,255,${0.5 * env.nf})`;
      ctx.beginPath(); ctx.arc(cx + r * 0.45, cy - r * 1.15, 2.5 * view.zoom + 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  private lighthouse(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p), H = 3.4;
    const [bx, by] = view.project(x, 0, z), [tx, ty] = view.project(x, H, z), w0 = 0.65 * view.s * view.zoom, w1 = 0.42 * view.s * view.zoom;
    for (let k = 0; k < 5; k++) {
      const a = k / 5, b = (k + 1) / 5;
      const ya = by + (ty - by) * a, yb = by + (ty - by) * b, wa = w0 + (w1 - w0) * a, wb = w0 + (w1 - w0) * b;
      ctx.fillStyle = rgb(k % 2 ? [255, 255, 255] : [230, 60, 70], d);
      ctx.beginPath(); ctx.moveTo(bx - wa, ya); ctx.lineTo(bx + wa, ya); ctx.lineTo(bx + wb, yb); ctx.lineTo(bx - wb, yb); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = rgb([60, 70, 90], d);
    ctx.fillRect(tx - w1 * 1.2, ty - w1 * 0.25, w1 * 2.4, w1 * 0.3);
    ctx.fillStyle = env.nf > 0.2 ? "#fff3b0" : rgb([200, 230, 255], d);
    ctx.fillRect(tx - w1 * 0.7, ty - w1 * 1.2, w1 * 1.4, w1 * 0.95);
    ctx.fillStyle = rgb([230, 60, 70], d);
    ctx.beginPath(); ctx.moveTo(tx - w1, ty - w1 * 1.2); ctx.lineTo(tx, ty - w1 * 2); ctx.lineTo(tx + w1, ty - w1 * 1.2); ctx.fill();
    if (env.nf > 0.2) {
      // The sweeping beam
      const a = env.time * 0.8, len = view.W * 0.6, sw = 0.12;
      const g = ctx.createRadialGradient(tx, ty - w1 * 0.7, 0, tx, ty - w1 * 0.7, len);
      g.addColorStop(0, `rgba(255,243,176,${0.5 * env.nf})`);
      g.addColorStop(1, "rgba(255,243,176,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, ty - w1 * 0.7);
      ctx.lineTo(tx + Math.cos(a - sw) * len, ty - w1 * 0.7 + Math.sin(a - sw) * len * 0.35);
      ctx.lineTo(tx + Math.cos(a + sw) * len, ty - w1 * 0.7 + Math.sin(a + sw) * len * 0.35);
      ctx.closePath(); ctx.fill();
    }
  }

  private rocket(p: Paint, x: number, z: number): void {
    const { ctx, view, env } = p, d = this.shade(p);
    const [cx, cy] = view.project(x, 0.03, z), rx = 1.5 * Math.SQRT2 * ISO_X * view.s * view.zoom, ry = rx * 0.5;
    ctx.fillStyle = rgb([150, 158, 172], d);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgb([255, 212, 59], d);
    ctx.lineWidth = Math.max(1, 1.4 * view.zoom);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
    // Every 45 seconds the rocket launches, climbs out of sight, and a new one is rolled out.
    const t = env.time % 45, flight = t > 36 ? t - 36 : 0;
    const lift = flight * flight * 0.9;
    const h = 1.9 * view.th * view.zoom, w = h * 0.2, by = cy - lift * view.th * view.zoom;
    if (flight > 0) {
      for (let k = 0; k < 6; k++) {
        const ph = (env.time * 3 + k / 6) % 1;
        ctx.fillStyle = `rgba(235,235,240,${0.5 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(cx + (k - 2.5) * w * 0.5 * ph * 2, cy - ph * w, w * (0.6 + ph * 1.4), 0, Math.PI * 2); ctx.fill();
      }
      const fl = ctx.createLinearGradient(cx, by, cx, by + w * 3);
      fl.addColorStop(0, "rgba(255,240,150,0.95)");
      fl.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = fl;
      ctx.beginPath(); ctx.moveTo(cx - w * 0.5, by); ctx.lineTo(cx, by + w * (3 + Math.sin(env.time * 40) * 0.4)); ctx.lineTo(cx + w * 0.5, by); ctx.fill();
    }
    if (by < -h) return;
    ctx.fillStyle = rgb([220, 60, 70], d);
    ctx.beginPath(); ctx.moveTo(cx - w, by); ctx.lineTo(cx - w * 1.6, by + w * 0.2); ctx.lineTo(cx - w, by - h * 0.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + w, by); ctx.lineTo(cx + w * 1.6, by + w * 0.2); ctx.lineTo(cx + w, by - h * 0.3); ctx.fill();
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, rgb([255, 255, 255], d));
    g.addColorStop(1, rgb([190, 196, 210], d));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w, by - h * 0.8, w * 2, h * 0.8);
    ctx.fillStyle = rgb([220, 60, 70], d);
    ctx.beginPath(); ctx.moveTo(cx - w, by - h * 0.8); ctx.quadraticCurveTo(cx, by - h * 1.25, cx + w, by - h * 0.8); ctx.fill();
    ctx.fillStyle = rgb([77, 171, 247], d);
    ctx.beginPath(); ctx.arc(cx, by - h * 0.55, w * 0.45, 0, Math.PI * 2); ctx.fill();
  }

  drawBack(p: Paint): void {
    if (this.has(1)) this.drawWaterfall(p);
    for (const [x, z, i] of BEDS) this.drawBed(p, x, z, i);
    for (const b of BENCHES) if (b[0] + b[1] < 0) this.drawBench(p, b[0], b[1], b[2]);
    this.drawFlag(p);
    this.drawCity(p, true);
    this.drawWalkers(p, true);
    this.drawBirds(p, true);
  }

  drawFront(p: Paint): void {
    for (const b of BENCHES) if (b[0] + b[1] >= 0) this.drawBench(p, b[0], b[1], b[2]);
    this.drawCart(p);
    this.drawCity(p, false);
    this.drawWalkers(p, false);
    this.drawBirds(p, false);
  }

  private drawBed(p: Paint, x: number, z: number, i: number): void {
    const { ctx, view, env } = p, d = 1 - env.nf * 0.6;
    const [cx, cy] = view.project(x, 0.03, z);
    const rx = 1.3 * Math.SQRT2 * ISO_X * view.s * view.zoom, ry = 1.3 * Math.SQRT2 * ISO_Y * view.s * view.zoom;
    ctx.fillStyle = rgb([120, 86, 58], d);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb([84, 150, 70], d);
    ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.15, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    const colors: RGB[] = [[255, 107, 129], [255, 212, 59], [255, 255, 255], [190, 120, 255], [255, 146, 43]];
    const dot = Math.max(1.2, 2.3 * view.zoom);
    for (let k = 0; k < 14; k++) {
      const a = hash(i, k, 1) * Math.PI * 2, rr = Math.sqrt(hash(k, i, 2)) * 0.8;
      ctx.fillStyle = rgb(colors[(i + k) % colors.length], d);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * rr, cy - ry * 0.15 + Math.sin(a) * ry * rr - dot, dot, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawBench(p: Paint, x: number, z: number, axis: "x" | "z"): void {
    const hw = 0.7, hd = 0.22;
    const b = axis === "x" ? { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd } : { x0: x - hd, x1: x + hd, z0: z - hw, z1: z + hw };
    drawBlock(p, b, 0.06, 0.12, [150, 100, 60], NEIGHBOR_LOOK, { plain: true });
  }

  private drawCart(p: Paint): void {
    const { ctx, view, env } = p, d = 1 - env.nf * 0.4;
    const x = -3.4, z = 9.6;
    drawBlock(p, { x0: x - 0.6, x1: x + 0.6, z0: z - 0.4, z1: z + 0.4 }, 0, 0.22, [235, 80, 90], NEIGHBOR_LOOK, { plain: true });
    const [bx, by] = view.project(x, 0.22, z), [tx, ty] = view.project(x, 0.62, z);
    ctx.strokeStyle = rgb([80, 80, 90], d);
    ctx.lineWidth = Math.max(1, 1.2 * view.zoom);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    // Striped umbrella
    const rx = 1.1 * Math.SQRT2 * ISO_X * view.s * view.zoom, ry = rx * 0.5;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = rgb(k % 2 ? [255, 255, 255] : [255, 90, 120], d);
      ctx.beginPath(); ctx.moveTo(tx, ty - ry * 0.5);
      ctx.ellipse(tx, ty, rx, ry, 0, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
    if (env.nf > 0.3) {
      ctx.fillStyle = `rgba(255,220,150,${env.nf * 0.5})`;
      ctx.beginPath(); ctx.arc(bx, by, rx * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawFlag(p: Paint): void {
    const { ctx, view, env } = p, d = 1 - env.nf * 0.4;
    const [bx, by] = view.project(6.9, 0, -6.9), [tx, ty] = view.project(6.9, 2.6, -6.9);
    ctx.strokeStyle = rgb([220, 224, 230], d);
    ctx.lineWidth = Math.max(1, 1.4 * view.zoom);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    const w = 1.6 * view.s * view.zoom, h = w * 0.6;
    const g = ctx.createLinearGradient(tx, ty, tx + w, ty);
    g.addColorStop(0, rgb([255, 154, 90], d));
    g.addColorStop(0.5, rgb([255, 79, 139], d));
    g.addColorStop(1, rgb([139, 92, 255], d));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    for (let k = 0; k <= 8; k++) ctx.lineTo(tx + (w * k) / 8, ty + Math.sin(env.time * 5 - k * 0.8) * h * 0.12 * (k / 8));
    for (let k = 8; k >= 0; k--) ctx.lineTo(tx + (w * k) / 8, ty + h + Math.sin(env.time * 5 - k * 0.8) * h * 0.12 * (k / 8));
    ctx.closePath();
    ctx.fill();
  }

  private drawWalkers(p: Paint, back: boolean): void {
    const { ctx, view, env } = p, d = 1 - env.nf * 0.55;
    const h = 0.5 * view.th * view.zoom; // a person is about half a storey in this stylized scale
    if (h < 3) return;
    for (const w of WALKERS) {
      const [x, z, dir] = walkerPos(w);
      if ((x + z < 0) !== back) continue;
      const [sx, sy] = view.project(x, 0.03, z);
      const step = Math.sin(w.t * 9) * h * 0.14 * dir;
      ctx.strokeStyle = rgb([50, 55, 75], d);
      ctx.lineWidth = Math.max(1, h * 0.12);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy - h * 0.42); ctx.lineTo(sx + step, sy);
      ctx.moveTo(sx, sy - h * 0.42); ctx.lineTo(sx - step, sy);
      ctx.stroke();
      ctx.fillStyle = rgb(hexRgb(w.shirt), d);
      ctx.fillRect(sx - h * 0.14, sy - h * 0.8, h * 0.28, h * 0.42);
      ctx.fillStyle = rgb(hexRgb(w.skin), d);
      ctx.beginPath(); ctx.arc(sx, sy - h * 0.92, h * 0.13, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawBirds(p: Paint, back: boolean): void {
    if (p.env.nf > 0.6) return; // they roost at night
    const { ctx, view, env } = p;
    ctx.strokeStyle = `rgba(40,45,70,${0.85 * (1 - env.nf)})`;
    ctx.lineWidth = Math.max(1, 1.5 * view.zoom);
    ctx.lineCap = "round";
    for (const b of BIRDS) {
      const x = Math.cos(b.a) * b.r, z = Math.sin(b.a) * b.r;
      if ((x + z < 0) !== back) continue;
      const [sx, sy] = view.project(x, b.y, z);
      const s = 0.55 * view.s * view.zoom, f = Math.sin(b.flap) * 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - s, sy - s * f); ctx.quadraticCurveTo(sx - s * 0.4, sy - s * 0.2, sx, sy);
      ctx.quadraticCurveTo(sx + s * 0.4, sy - s * 0.2, sx + s, sy - s * f);
      ctx.stroke();
    }
  }

  /** The pond spills over the island's edge as a waterfall into the sky. */
  private drawWaterfall(p: Paint): void {
    const { ctx, view, env } = p, d = 1 - env.nf * 0.5, I = ISLAND, z0 = 11.4, z1 = 12.6;
    const P = (x: number, y: number, z: number) => view.project(x, y, z);
    // Stream from the pond to the edge
    poly(p, [P(14.8, 0.035, z0), P(I, 0.035, z0), P(I, 0.035, z1), P(14.8, 0.035, z1)], rgb([80, 170, 230], d));
    // The falling sheet of water down the cliff face and beyond
    const top = P(I, 0, (z0 + z1) / 2), bot = P(I, -14, (z0 + z1) / 2);
    const g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
    g.addColorStop(0, `rgba(150,215,255,${0.95 * d})`);
    g.addColorStop(0.6, `rgba(190,230,255,${0.55 * d})`);
    g.addColorStop(1, "rgba(220,240,255,0)");
    poly(p, [P(I + 0.05, 0, z0), P(I + 0.05, 0, z1), P(I + 0.4, -14, z1 + 0.3), P(I + 0.4, -14, z0 - 0.3)], g);
    // Streaks rushing down
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * d})`;
    ctx.lineWidth = Math.max(1, 1.2 * view.zoom);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const zz = z0 + 0.15 + (k / 5) * (z1 - z0 - 0.3);
      const y = -(((env.time * 6 + k * 2.3) % 10));
      const [ax, ay] = P(I + 0.1 - y * 0.02, y, zz), [bx, by] = P(I + 0.1 - y * 0.02, y - 1.2, zz);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke();
    // Spray where it leaves the edge
    ctx.fillStyle = `rgba(255,255,255,${0.5 * d})`;
    for (let k = 0; k < 5; k++) {
      const ph = (env.time * 0.8 + k / 5) % 1;
      const [sx, sy] = P(I + 0.2 + ph * 0.6, -ph * 0.8, z0 + (k / 4) * (z1 - z0));
      ctx.beginPath(); ctx.arc(sx, sy, (1 - ph) * 3 * view.zoom + 1, 0, Math.PI * 2); ctx.fill();
    }
  }
}

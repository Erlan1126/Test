// Scenery: the sky, clouds, wind, the floating island and its upgrades.
import { clamp, hash, hexRgb, lerp, mixRgb, rand, rgb, type RGB } from "../core/util";
import { BLOCK_SIZE, ISLAND, SKY } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import { NEIGHBOR_LOOK } from "../data/skins";
import type { Box } from "../logic/rules";
import { drawBlock } from "./buildings";
import { IslandLife } from "./details";
import { face, ISO_X, ISO_Y, poly, type Paint } from "./paint";

/** A soft cloud sprite, drawn once and reused. */
const cloudSprite = (() => {
  const c = document.createElement("canvas");
  c.width = 380; c.height = 230;
  const g = c.getContext("2d")!;
  const puffs = [[105, 130, 58], [170, 102, 74], [242, 118, 62], [295, 138, 42], [72, 142, 40], [188, 142, 66]];
  for (const [x, y, r] of puffs) {
    const rg = g.createRadialGradient(x - r * 0.2, y - r * 0.35, r * 0.1, x, y, r);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.65, "rgba(250,252,255,0.92)");
    rg.addColorStop(1, "rgba(235,242,255,0)");
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
})();

export function skyAt(n: number): [RGB, RGB] {
  let i = 0;
  while (i < SKY.length - 2 && n > SKY[i + 1].at) i++;
  const a = SKY[i], b = SKY[i + 1];
  const t = clamp((n - a.at) / (b.at - a.at), 0, 1);
  return [mixRgb(hexRgb(a.top), hexRgb(b.top), t), mixRgb(hexRgb(a.bottom), hexRgb(b.bottom), t)];
}
export const nightAt = (n: number): number => clamp((n - 45) / 35, 0, 1);

/** Where the sun sits on screen: it sinks toward the horizon as the tower climbs. */
export function sunAt(n: number, W: number, H: number): { x: number; y: number; t: number } {
  const t = clamp(n / 50, 0, 1);
  return { x: W * 0.8, y: lerp(H * 0.16, H * 1.05, t * t), t };
}

type Neighbor = Box & { h: number; color: RGB };
const NEIGHBORS: Neighbor[] = [
  { x0: -15.5, x1: -10, z0: 9, z1: 14.5, h: 4, color: hexRgb("#e8dcc8") },
  { x0: 9.5, x1: 15, z0: -15, z1: -9.5, h: 6, color: hexRgb("#c9d6e6") },
  { x0: -15, x1: -11, z0: 2.2, z1: 6.6, h: 2, color: hexRgb("#f0c9a8") },
];
const EXTRA_NEIGHBORS: Neighbor[] = [
  { x0: -8.5, x1: -5, z0: 12, z1: 15.5, h: 2, color: hexRgb("#f2d0a4") },
  { x0: 10, x1: 14, z0: -6.5, z1: -3, h: 3, color: hexRgb("#d7e3c9") },
];
const TREES = [
  [-8, 9], [-6.5, 12.5], [-3, 14.5], [8.5, 8.5], [12, 4], [14.5, 1], [4, 12], [-13, -5.5], [-11, -8.5],
  [2.5, -13], [-1, -15], [12.5, 11.5], [15.5, 7], [-14.5, -2.6],
].map(([x, z], i) => ({ x, z, size: 0.8 + hash(i, 3, 7) * 0.5, hue: hash(i, 9, 1) }));
type Tree = (typeof TREES)[number];

const FOUNTAIN = { x: -6.2, z: 6.2 }, POND = { x: 12, z: 12, r: 3.2 }, WHEEL = { x: -12, z: -12 };
const LAMPS: [number, number][] = [];
for (const u of [9, 12.5, 16]) for (const side of [-1.9, 1.9]) LAMPS.push([u, side], [side, u], [-u, side]);
const CARS = [
  { road: "x", lane: -0.65, speed: 2.6, off: 0, color: hexRgb("#ff6b6b") },
  { road: "x", lane: 0.65, speed: -2.1, off: 4, color: hexRgb("#f1f3f5") },
  { road: "z", lane: 0.65, speed: 2.3, off: 2, color: hexRgb("#4dabf7") },
  { road: "z", lane: -0.65, speed: -2.8, off: 7, color: hexRgb("#51cf66") },
];
const BALLOONS = [
  { x: -14, z: 7, level: 7, color: "#ff6b6b", trim: "#ffe3e3", phase: 0 },
  { x: 13, z: -9, level: 10.5, color: "#4dabf7", trim: "#e7f5ff", phase: 2 },
  { x: 7, z: 15, level: 14, color: "#845ef7", trim: "#f3f0ff", phase: 4 },
];
type Balloon = (typeof BALLOONS)[number];

/** One tree at screen point (x, y) in the island theme's style: round, pine or palm. */
export function drawTreeShape(g: CanvasRenderingContext2D, th: IslandTheme, x: number, y: number, r: number, hue: number, d: number): void {
  g.fillStyle = `rgba(20,40,20,${0.22 * d})`;
  g.beginPath(); g.ellipse(x, y, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); g.fill();
  const leaf = mixRgb(hexRgb(th.leaf[0]), hexRgb(th.leaf[1]), hue);
  g.fillStyle = rgb(hexRgb(th.trunk), d);
  if (th.tree === "pine") {
    g.fillRect(x - r * 0.1, y - r * 0.6, r * 0.2, r * 0.6);
    for (let k = 0; k < 3; k++) {
      const top = y - r * (1.2 + k * 0.62), half = r * (0.85 - k * 0.2);
      g.fillStyle = rgb(leaf, (0.85 + k * 0.1) * d);
      g.beginPath(); g.moveTo(x, top - r * 0.75); g.lineTo(x + half, top + r * 0.25); g.lineTo(x - half, top + r * 0.25); g.closePath(); g.fill();
      g.fillStyle = rgb([248, 252, 255], d);
      g.beginPath(); g.moveTo(x, top - r * 0.75); g.lineTo(x + half * 0.4, top - r * 0.35); g.lineTo(x - half * 0.4, top - r * 0.35); g.closePath(); g.fill();
    }
  } else if (th.tree === "palm") {
    g.strokeStyle = rgb(hexRgb(th.trunk), d);
    g.lineWidth = Math.max(1.5, r * 0.22);
    g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r * 0.5, y - r * 1.2, x + r * 0.2, y - r * 2.2); g.stroke();
    g.fillStyle = rgb(leaf, d);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.7;
      g.beginPath();
      g.ellipse(x + r * 0.2 + Math.cos(a) * r * 0.55, y - r * 2.2 + Math.sin(a) * r * 0.35 + r * 0.2, r * 0.7, r * 0.2, a, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillRect(x - r * 0.12, y - r * 1.1, r * 0.24, r * 1.1);
    g.fillStyle = rgb(leaf, 0.82 * d);
    g.beginPath(); g.arc(x, y - r * 1.55, r * 0.85, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgb(leaf, 1.12 * d);
    g.beginPath(); g.arc(x - r * 0.22, y - r * 1.75, r * 0.5, 0, Math.PI * 2); g.fill();
  }
}

/** Animated scenery state: drifting clouds, twinkling stars, wind streaks. */
export class Scenery {
  private stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.4, 1.8), p: rand(0, 6) }));
  private bgClouds = Array.from({ length: 7 }, () => ({ x: Math.random(), y: Math.random() * 1.6, size: rand(0.5, 1.1), v: rand(0.004, 0.012) }));
  private bandClouds = Array.from({ length: 12 }, () => ({ level: rand(16, 46), x: rand(-1.1, 1.1), size: rand(0.9, 1.8), front: Math.random() < 0.4, v: rand(0.01, 0.03) }));
  private streaks = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), len: rand(0.08, 0.22), v: rand(0.6, 1.4) }));
  private shootingStar: { x: number; y: number; life: number } | null = null;
  // Full-screen gradients are expensive, so the sky and vignette are painted into small
  // offscreen canvases and scaled up. The sky only repaints when the tower height changes.
  private skyCache = document.createElement("canvas");
  private vignette = document.createElement("canvas");
  private skyKey = "";
  private vigKey = "";
  /** Island level (how many upgrades are built), set each frame. */
  islandNow = 0;
  /** People, benches, birds and other small details. */
  readonly life = new IslandLife();
  theme!: IslandTheme;

  private has(i: number): boolean { return this.islandNow > i; }

  private paintSky(p: Paint, n: number): void {
    const { W, H } = p.view;
    const c = this.skyCache;
    c.width = Math.max(1, Math.ceil(W / 4));
    c.height = Math.max(1, Math.ceil(H / 4));
    const g = c.getContext("2d")!;
    g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgb(p.env.skyTop));
    grad.addColorStop(1, rgb(p.env.skyBot));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // The sun sinks toward the horizon as the tower climbs.
    const sunT = clamp(n / 50, 0, 1);
    if (sunT < 1) {
      const sx = W * 0.8, sy = lerp(H * 0.16, H * 1.05, sunT * sunT);
      const sunCol = mixRgb([255, 247, 214], [255, 150, 90], sunT);
      const gl = g.createRadialGradient(sx, sy, 0, sx, sy, Math.min(W, H) * 0.45);
      gl.addColorStop(0, rgb(sunCol, 1, 0.55));
      gl.addColorStop(1, rgb(sunCol, 1, 0));
      g.fillStyle = gl;
      g.fillRect(0, 0, W, H);
    }
  }

  drawSky(p: Paint, n: number, dt: number): void {
    const { ctx, view, env } = p;
    const { W, H } = view;
    const key = `${n}:${W}:${H}:${p.env.skyTop.join()}:${p.env.skyBot.join()}`;
    if (key !== this.skyKey) { this.skyKey = key; this.paintSky(p, n); }
    ctx.drawImage(this.skyCache, 0, 0, W, H);

    const sunT = clamp(n / 50, 0, 1);
    if (sunT < 1) {
      const sx = W * 0.8, sy = lerp(H * 0.16, H * 1.05, sunT * sunT);
      ctx.fillStyle = rgb(mixRgb([255, 247, 214], [255, 150, 90], sunT));
      ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    if (env.nf > 0) {
      ctx.fillStyle = "#ffffff";
      for (const st of this.stars) {
        ctx.globalAlpha = Math.max(0, env.nf * (0.45 + 0.55 * Math.sin(env.time * 1.6 + st.p)));
        ctx.fillRect(st.x * W, st.y * H * 0.85, st.r, st.r);
      }
      const ma = clamp((n - 60) / 20, 0, 1);
      if (ma > 0) {
        const mx = W * 0.2, my = H * 0.17, mr = Math.min(W, H) * 0.045;
        ctx.globalAlpha = ma;
        const mg = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5);
        mg.addColorStop(0, "rgba(200,210,255,0.35)");
        mg.addColorStop(1, "rgba(200,210,255,0)");
        ctx.fillStyle = mg;
        ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        ctx.fillStyle = "#f4f2ff";
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(170,170,210,0.45)";
        ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.15, 0, Math.PI * 2); ctx.fill();
      }
      if (!this.shootingStar && Math.random() < dt * 0.15 * env.nf) this.shootingStar = { x: rand(0.2, 0.9), y: rand(0.05, 0.35), life: 0.8 };
      const ss = this.shootingStar;
      if (ss) {
        const t = 1 - ss.life / 0.8;
        const x = (ss.x - t * 0.25) * W, y = (ss.y + t * 0.12) * H;
        const sg = ctx.createLinearGradient(x, y, x + 70, y - 34);
        sg.addColorStop(0, "rgba(255,255,255,0.9)");
        sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = Math.sin(Math.PI * t);
        ctx.strokeStyle = sg;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 70, y - 34); ctx.stroke();
        ss.life -= dt;
        if (ss.life <= 0) this.shootingStar = null;
      }
      ctx.globalAlpha = 1;
    }

    // Distant clouds drift by, and slide down the screen as you climb.
    const tint = 1 - env.nf * 0.55;
    for (const c of this.bgClouds) {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.4;
      const span = H * 1.6;
      const y = ((c.y * H + env.climb * 0.3) % span + span) % span - H * 0.3;
      const w = Math.min(W, 520) * 0.55 * c.size;
      ctx.globalAlpha = 0.5 * tint;
      ctx.drawImage(cloudSprite, c.x * W - w / 2, y - w * 0.3, w, w * 0.605);
    }
    ctx.globalAlpha = 1;
  }

  /** Streaks across the screen while the wind blows. */
  drawWind(p: Paint, wind: number, dt: number): void {
    if (wind <= 0) return;
    const { ctx, view } = p;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const st of this.streaks) {
      st.x += st.v * dt * (0.6 + wind);
      if (st.x > 1.2) { st.x = -0.3; st.y = Math.random(); }
      ctx.globalAlpha = wind * 0.28;
      ctx.beginPath();
      ctx.moveTo(st.x * view.W, st.y * view.H);
      ctx.lineTo((st.x + st.len) * view.W, st.y * view.H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Big soft clouds at a fixed altitude, so the tower climbs through them. Clouds in
   *  front stay see-through near `topLevel` so they never hide your aim. */
  drawBandClouds(p: Paint, front: boolean, topLevel: number | null, dt: number): void {
    const { ctx, view, env } = p;
    if (front && env.low) return;
    const tint = 1 - env.nf * 0.6;
    for (const c of this.bandClouds) {
      if (c.front !== front) continue;
      if (front) c.x += c.v * dt; else c.x -= c.v * dt * 0.5;
      if (c.x > 1.3) c.x = -1.3;
      if (c.x < -1.3) c.x = 1.3;
      const [, y] = view.project(0, c.level, 0);
      const w = BLOCK_SIZE * 2.4 * view.s * view.zoom * c.size;
      if (y < -w || y > view.H + w) continue;
      const nearTop = topLevel !== null && Math.abs(c.level - topLevel) < 5;
      ctx.globalAlpha = (front ? (nearTop ? 0.22 : 0.6) : 0.85) * tint;
      ctx.drawImage(cloudSprite, view.cx + c.x * view.W * 0.6 - w / 2, y - w * 0.3, w, w * 0.605);
    }
    ctx.globalAlpha = 1;
  }

  drawVignette(p: Paint): void {
    const { ctx, view } = p;
    const { W, H } = view;
    const key = `${W}:${H}`;
    if (key !== this.vigKey) {
      this.vigKey = key;
      const c = this.vignette;
      c.width = Math.max(1, Math.ceil(W / 4));
      c.height = Math.max(1, Math.ceil(H / 4));
      const g = c.getContext("2d")!;
      g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
      v.addColorStop(0, "rgba(5,8,30,0)");
      v.addColorStop(1, "rgba(5,8,30,0.35)");
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vignette, 0, 0, W, H);
  }

  islandVisible(p: Paint): boolean {
    return p.view.project(0, 0, 0)[1] - ISLAND * p.view.s * p.view.zoom < p.view.H + 40;
  }

  /** Everything on the island that sits behind the tower. `base` is the tower's first
   *  floor and `floors` its height, for the shadow it casts. */
  drawBack(p: Paint, base: Box, floors: number): void {
    this.life.has = i => this.has(i);
    this.life.theme = this.theme;
    if (this.islandVisible(p)) {
      this.life.drawRocks(p, true);
      this.drawIsland(p);
      if (this.has(1)) this.drawPond(p);
      if (this.has(0)) this.drawFountain(p);
      this.drawShadows(p, base, floors);
      this.life.drawBack(p);
      for (const t of TREES) if (t.x + t.z < 0 && this.treeVisible(t)) this.drawTree(p, t);
      if (this.has(4)) this.drawFerrisWheel(p);
      for (const nb of NEIGHBORS) drawBlock(p, nb, 0, nb.h, nb.color, NEIGHBOR_LOOK);
      if (this.has(2)) for (const nb of EXTRA_NEIGHBORS) drawBlock(p, nb, 0, nb.h, nb.color, NEIGHBOR_LOOK);
    }
    if (this.has(5)) for (const b of BALLOONS) if (b.x + b.z < 0) this.drawBalloon(p, b);
  }

  /** Everything on the island in front of the tower. */
  drawFront(p: Paint): void {
    if (this.islandVisible(p)) {
      this.life.drawFront(p);
      for (const t of TREES) if (t.x + t.z >= 0 && this.treeVisible(t)) this.drawTree(p, t);
      if (this.has(3)) this.drawLampsAndCars(p);
      this.life.drawRocks(p, false);
    }
    if (this.has(5)) for (const b of BALLOONS) if (b.x + b.z >= 0) this.drawBalloon(p, b);
  }

  private drawIsland(p: Paint): void {
    const I = ISLAND, d = 1 - p.env.nf * 0.6, t = this.theme;
    const P = (x: number, y: number, z: number) => p.view.project(x, y, z);
    // Rocky underside tapering to a point
    const apex = P(0, -17, 0);
    poly(p, [P(I, -3, -I), P(I, -3, I), apex], rgb(hexRgb(t.rockR), d));
    poly(p, [P(-I, -3, I), P(I, -3, I), apex], rgb(hexRgb(t.rockL), d));
    // Dirt sides with a grassy (or snowy, or sandy) lip
    face(p, [P(-I, 0, I), P(I, 0, I), P(I, -3, I), P(-I, -3, I)], hexRgb(t.dirtL), d, 0.75 * d);
    face(p, [P(I, 0, -I), P(I, 0, I), P(I, -3, I), P(I, -3, -I)], hexRgb(t.dirtR), d, 0.7 * d);
    poly(p, [P(-I, 0, I), P(I, 0, I), P(I, -0.45, I), P(-I, -0.45, I)], rgb(hexRgb(t.lip), d));
    poly(p, [P(I, 0, -I), P(I, 0, I), P(I, -0.45, I), P(I, -0.45, -I)], rgb(hexRgb(t.lipR), d));
    poly(p, [P(-I, 0, -I), P(I, 0, -I), P(I, 0, I), P(-I, 0, I)], rgb(hexRgb(t.lawn), d));
    // Roads leading off the island
    const road = rgb(hexRgb(t.road), d), line = rgb(hexRgb("#f1f3f5"), d);
    poly(p, [P(7, 0.01, -1.4), P(I, 0.01, -1.4), P(I, 0.01, 1.4), P(7, 0.01, 1.4)], road);
    poly(p, [P(-1.4, 0.01, 7), P(1.4, 0.01, 7), P(1.4, 0.01, I), P(-1.4, 0.01, I)], road);
    poly(p, [P(-I, 0.01, -1.4), P(-7, 0.01, -1.4), P(-7, 0.01, 1.4), P(-I, 0.01, 1.4)], road);
    for (let u = 8; u < I; u += 2.2) {
      poly(p, [P(u, 0.02, -0.12), P(u + 1.1, 0.02, -0.12), P(u + 1.1, 0.02, 0.12), P(u, 0.02, 0.12)], line);
      poly(p, [P(-0.12, 0.02, u), P(0.12, 0.02, u), P(0.12, 0.02, u + 1.1), P(-0.12, 0.02, u + 1.1)], line);
    }
    // Plaza around the tower
    poly(p, [P(-7.4, 0.02, -7.4), P(7.4, 0.02, -7.4), P(7.4, 0.02, 7.4), P(-7.4, 0.02, 7.4)], rgb(hexRgb(t.plaza), d));
    poly(p, [P(-6.8, 0.03, -6.8), P(6.8, 0.03, -6.8), P(6.8, 0.03, 6.8), P(-6.8, 0.03, 6.8)], rgb(hexRgb(t.plaza2), d));
  }

  /** Soft shadows cast away from the sun (top right of the screen, so toward +z) by the
   *  tower and the neighbors, clipped to the island. */
  private drawShadows(p: Paint, base: Box, floors: number): void {
    const { ctx, view, env } = p;
    const I = ISLAND, P = (x: number, z: number) => view.project(x, 0.04, z);
    const strength = 0.24 * (1 - env.nf * 0.75);
    if (strength <= 0.01) return;
    ctx.save();
    ctx.beginPath();
    for (const [x, z] of [[-I, -I], [I, -I], [I, I], [-I, I]]) { const [sx, sy] = P(x, z); ctx.lineTo(sx, sy); }
    ctx.closePath();
    ctx.clip();
    const cast = (b: Box, h: number) => {
      const len = Math.min(18, 1.5 + h * 0.75), dx = -len * 0.35, dz = len;
      const pts = [P(b.x0, b.z0), P(b.x1, b.z0), P(b.x1, b.z1), P(b.x1 + dx, b.z1 + dz), P(b.x0 + dx, b.z1 + dz), P(b.x0 + dx, b.z0 + dz)];
      const [ax, ay] = P((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), [bx, by] = P((b.x0 + b.x1) / 2 + dx, (b.z0 + b.z1) / 2 + dz);
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, `rgba(12,18,48,${strength})`);
      g.addColorStop(1, "rgba(12,18,48,0)");
      poly(p, pts, g);
    };
    cast(base, floors);
    for (const nb of NEIGHBORS) cast(nb, nb.h);
    if (this.has(2)) for (const nb of EXTRA_NEIGHBORS) cast(nb, nb.h);
    ctx.restore();
  }

  /** Trees make room for the upgrades that are built. */
  private treeVisible(t: Tree): boolean {
    const near = (x: number, z: number, r: number) => Math.hypot(t.x - x, t.z - z) < r;
    if (this.has(0) && near(FOUNTAIN.x, FOUNTAIN.z, 2)) return false;
    if (this.has(1) && near(POND.x, POND.z, POND.r + 1)) return false;
    if (this.has(4) && near(WHEEL.x, WHEEL.z, 3)) return false;
    if (this.has(2) && EXTRA_NEIGHBORS.some(b => t.x > b.x0 - 1 && t.x < b.x1 + 1 && t.z > b.z0 - 1 && t.z < b.z1 + 1)) return false;
    return true;
  }

  private drawTree(p: Paint, t: Tree): void {
    const [x, y] = p.view.project(t.x, 0, t.z);
    drawTreeShape(p.ctx, this.theme, x, y, 0.75 * p.view.s * p.view.zoom * t.size, t.hue, 1 - p.env.nf * 0.6);
  }

  /** An ellipse on the ground: a circle of radius r (world units) seen in isometric view. */
  private groundEllipse(p: Paint, x: number, y: number, z: number, r: number, fill: string): void {
    const { ctx, view } = p;
    const [cx, cy] = view.project(x, y, z);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * Math.SQRT2 * ISO_X * view.s * view.zoom, r * Math.SQRT2 * ISO_Y * view.s * view.zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPond(p: Paint): void {
    const { ctx, view, env } = p;
    const d = 1 - env.nf * 0.6;
    this.groundEllipse(p, POND.x, 0.02, POND.z, POND.r + 0.45, rgb(hexRgb("#d9c79a"), d));
    this.groundEllipse(p, POND.x, 0.03, POND.z, POND.r, rgb(hexRgb("#3f9fd8"), d));
    this.groundEllipse(p, POND.x - 0.6, 0.04, POND.z - 0.6, POND.r * 0.55, rgb(hexRgb("#6cc3f0"), d));
    ctx.fillStyle = rgb(hexRgb("#ffe066"), d);
    for (let i = 0; i < 2; i++) {
      const a = env.time * 0.35 + i * Math.PI;
      const [x, y] = view.project(POND.x + Math.cos(a) * 1.8, 0.1, POND.z + Math.sin(a) * 1.8);
      const r = 0.3 * view.s * view.zoom;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.6 * Math.sign(Math.cos(a + Math.PI / 2)), y - r * 0.6, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawFountain(p: Paint): void {
    const { ctx, view, env } = p;
    const d = 1 - env.nf * 0.5, f = FOUNTAIN;
    this.groundEllipse(p, f.x, 0.03, f.z, 1.25, rgb(hexRgb("#aab3bf"), d));
    this.groundEllipse(p, f.x, 0.22, f.z, 1.2, rgb(hexRgb("#cfd6df"), d));
    this.groundEllipse(p, f.x, 0.24, f.z, 0.9, rgb(hexRgb("#5ab4ea"), d));
    ctx.fillStyle = `rgba(200,235,255,${0.9 * d})`;
    for (let k = 0; k < 14; k++) {
      const ph = (env.time * 0.9 + k / 14) % 1, a = k * 2.4;
      const [x, y] = view.project(f.x + Math.cos(a) * ph * 0.75, 0.25 + 4 * ph * (1 - ph) * 1.1, f.z + Math.sin(a) * ph * 0.75);
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, 2.2 * view.zoom), 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawFerrisWheel(p: Paint): void {
    const { ctx, view, env } = p;
    const d = 1 - env.nf * 0.4;
    const [gx, gy] = view.project(WHEEL.x, 0, WHEEL.z), [hx, hy] = view.project(WHEEL.x, 3.6, WHEEL.z);
    const r = 2.5 * view.s * view.zoom;
    ctx.lineCap = "round";
    ctx.strokeStyle = rgb(hexRgb("#dee2e6"), d);
    ctx.lineWidth = Math.max(1.5, 3 * view.zoom);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(gx - r * 0.6, gy); ctx.moveTo(hx, hy); ctx.lineTo(gx + r * 0.6, gy); ctx.stroke();
    const spin = env.time * 0.25;
    ctx.lineWidth = Math.max(1, 1.5 * view.zoom);
    ctx.strokeStyle = rgb(hexRgb("#ffffff"), d, 0.85);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = spin + i * Math.PI / 4; ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r); }
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, 3 * view.zoom);
    ctx.strokeStyle = rgb(hexRgb("#ff8fab"), d);
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.stroke();
    const cabin = ["#ffd43b", "#4dabf7", "#ff6b6b", "#51cf66"];
    for (let i = 0; i < 8; i++) {
      const a = spin + i * Math.PI / 4, cx = hx + Math.cos(a) * r, cy = hy + Math.sin(a) * r, c = r * 0.16;
      ctx.fillStyle = env.nf > 0.4 ? "#ffe7a1" : rgb(hexRgb(cabin[i % 4]), d);
      ctx.fillRect(cx - c, cy, c * 2, c * 1.4);
    }
  }

  private drawBalloon(p: Paint, b: Balloon): void {
    const { ctx, view, env } = p;
    const d = 1 - env.nf * 0.4;
    const x = b.x + Math.sin(env.time * 0.15 + b.phase) * 2, lvl = b.level + Math.sin(env.time * 0.6 + b.phase) * 0.4;
    const [px, py] = view.project(x, lvl, b.z);
    const r = 1.1 * view.s * view.zoom;
    if (py < -r * 3 || py > view.H + r * 3) return;
    ctx.strokeStyle = `rgba(80,60,40,${0.8 * d})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px - r * 0.5, py + r * 0.7); ctx.lineTo(px - r * 0.25, py + r * 1.5); ctx.moveTo(px + r * 0.5, py + r * 0.7); ctx.lineTo(px + r * 0.25, py + r * 1.5); ctx.stroke();
    ctx.fillStyle = rgb(hexRgb("#a0703c"), d);
    ctx.fillRect(px - r * 0.3, py + r * 1.45, r * 0.6, r * 0.4);
    ctx.fillStyle = rgb(hexRgb(b.color), d);
    ctx.beginPath(); ctx.ellipse(px, py, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb(hexRgb(b.trim), d);
    ctx.beginPath(); ctx.ellipse(px, py, r * 0.35, r * 1.08, 0, 0, Math.PI * 2); ctx.fill();
  }

  private drawLampsAndCars(p: Paint): void {
    const { ctx, view, env } = p;
    const d = 1 - env.nf * 0.5;
    for (const c of CARS) {
      const u = 7.8 + (((c.off + env.time * c.speed) % 8.8) + 8.8) % 8.8;
      const body = c.road === "x"
        ? { x0: u - 0.8, x1: u + 0.8, z0: c.lane - 0.38, z1: c.lane + 0.38 }
        : { x0: c.lane - 0.38, x1: c.lane + 0.38, z0: u - 0.8, z1: u + 0.8 };
      drawBlock(p, body, 0, 0.42, c.color, NEIGHBOR_LOOK, { plain: true });
      const cab = c.road === "x"
        ? { x0: u - 0.45, x1: u + 0.35, z0: c.lane - 0.3, z1: c.lane + 0.3 }
        : { x0: c.lane - 0.3, x1: c.lane + 0.3, z0: u - 0.45, z1: u + 0.35 };
      drawBlock(p, cab, 0.42, 0.7, [190, 220, 245], NEIGHBOR_LOOK, { plain: true });
    }
    const lit = env.nf > 0.25;
    for (const [x, z] of LAMPS) {
      const [bx, by] = view.project(x, 0, z), [tx, ty] = view.project(x, 1.5, z);
      ctx.strokeStyle = rgb(hexRgb("#495057"), d);
      ctx.lineWidth = Math.max(1, 1.6 * view.zoom);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      if (lit && !env.low) {
        const r = 26 * view.zoom;
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
        g.addColorStop(0, `rgba(255,220,140,${0.6 * env.nf})`);
        g.addColorStop(1, "rgba(255,220,140,0)");
        ctx.fillStyle = g;
        ctx.fillRect(tx - r, ty - r, r * 2, r * 2);
      }
      ctx.fillStyle = lit ? "#ffe7a1" : rgb(hexRgb("#f1f3f5"), d);
      ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.5, 2.6 * view.zoom), 0, Math.PI * 2); ctx.fill();
    }
  }
}

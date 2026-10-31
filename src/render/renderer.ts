// Puts a frame together: camera, sky, island, tower, effects.
import { lerp, rand } from "../core/util";
import { BLOCK_SIZE, ISLAND } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import type { Skin } from "../data/skins";
import type { TowerSim } from "../logic/sim";
import { drawBlock, drawRoof, floorColor, lookFor } from "./buildings";
import { drawGuide, drawLandingShadow, Effects } from "./effects";
import { ISO_X, View, type Env, type Paint } from "./paint";
import { nightAt, Scenery, skyAt } from "./scenery";

/** What the screen is showing, which decides where the camera goes. */
export type Shot = "menu" | "play" | "over";

export interface Frame {
  sim: TowerSim;
  shot: Shot;
  /** The sliding floor is on screen (playing or paused). */
  showMover: boolean;
  skin: Skin;
  theme: IslandTheme;
  islandLevel: number;
  /** Beginner guide outline. */
  guide: boolean;
  /** Smooth mode. */
  low: boolean;
  /** Bottom edge of the score display, in pixels. */
  hudBottom: number;
}

export class Renderer {
  readonly view = new View();
  readonly fx = new Effects();
  readonly scenery = new Scenery();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly env: Env = { nf: 0, skyTop: [0, 0, 0], skyBot: [0, 0, 0], climb: 0, time: 0, low: false };
  private readonly paint: Paint;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.paint = { ctx: this.ctx, view: this.view, env: this.env };
  }

  resize(low: boolean): void {
    const v = this.view;
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2);
    v.W = this.canvas.clientWidth || window.innerWidth;
    v.H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(v.W * dpr);
    this.canvas.height = Math.round(v.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A full floor is about 17.3 units wide on screen; size it to the smaller screen dimension.
    v.s = Math.min(v.W * 0.56, v.H * 0.36) / (BLOCK_SIZE * 2 * ISO_X);
    v.th = v.s * 1.3;
    if (!v.originY) v.originY = v.H * 0.56;
    if (!v.cx) v.cx = v.W / 2;
  }

  /** Eases the camera toward the framing for the current shot. */
  camera(dt: number, shot: Shot, level: number): void {
    const v = this.view, { W, H, s, th } = v;
    let tZoom = 1, tLevel = Math.max(0, level - Math.floor(H * 0.2 / th)), tOrigin = H * 0.6, tCx = W / 2;
    if (shot === "menu") { tZoom = 0.72; tOrigin = H * 0.56; tLevel = 0; }
    if (shot === "over") {
      // Frame whichever reaches higher, the antenna or the island's back corner, down to the island's front.
      const above = Math.max((level + 4.8) * th, ISLAND * s);
      const room = v.wide ? H * 0.84 : H * 0.44;
      tZoom = Math.min(1, room / (above + ISLAND * s + 3 * th));
      tLevel = 0;
      tOrigin = H * 0.08 + above * tZoom;
      if (v.wide) tCx = W * 0.27;
    }
    tZoom *= 1 + this.fx.punch * 0.035;
    const k = Math.min(1, dt * (shot === "over" ? 3 : 6));
    v.zoom = lerp(v.zoom, tZoom, k);
    v.level = lerp(v.level, tLevel, k);
    v.originY = lerp(v.originY, tOrigin, k);
    v.cx = lerp(v.cx, tCx, k);
  }

  /** Jumps the camera straight to its target (for the share picture). */
  snap(shot: Shot, level: number): void {
    for (let i = 0; i < 60; i++) this.camera(1, shot, level);
  }

  draw(dt: number, f: Frame): void {
    const { ctx, view, env, paint: p, fx, scenery } = this;
    const sim = f.sim, stack = sim.stack, n = stack.length, top = sim.top;
    env.time += dt;
    env.low = f.low;
    [env.skyTop, env.skyBot] = skyAt(n);
    env.nf = nightAt(n);
    env.climb = view.level * view.th * view.zoom;
    scenery.theme = f.theme;
    scenery.islandNow = f.islandLevel;

    scenery.drawSky(p, n, dt);

    ctx.save();
    if (fx.shake > 0) ctx.translate(rand(-1, 1) * 10 * fx.shake, rand(-1, 1) * 10 * fx.shake);

    scenery.drawBack(p);
    scenery.drawBandClouds(p, false, null, dt);
    // A warm glow around the top of the tower during a perfect streak.
    if (sim.combo >= 5 && f.showMover) {
      const [gx, gy] = view.project((top.x0 + top.x1) / 2, top.y + 0.5, (top.z0 + top.z1) / 2);
      const gr = BLOCK_SIZE * 0.9 * view.s * view.zoom * (1 + Math.sin(env.time * 6) * 0.06);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(255,190,80,${sim.combo >= 10 ? 0.5 : 0.35})`);
      g.addColorStop(1, "rgba(255,190,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }

    fx.drawDebris(p, true);
    const reach = (BLOCK_SIZE * view.s + view.th * 2) * view.zoom;
    stack.forEach((b, i) => {
      const [, y] = view.project(0, b.y, 0);
      if (y - reach > view.H || y + reach < 0) return; // off screen
      const isTop = i === n - 1 && i > 0;
      drawBlock(p, b, b.y, b.y + 1 - (isTop ? fx.bounce * 0.3 : 0), floorColor(f.skin, b.y, b.kind), lookFor(f.skin, b.kind), { lobby: b.lobby, kind: b.kind });
    });
    const m = sim.mover;
    if (m && f.showMover) drawLandingShadow(p, m, top, fx.bounce);
    if (f.shot === "over" && n > 1) drawRoof(p, top, f.skin);
    scenery.drawFront(p);
    if (m && f.showMover) {
      drawBlock(p, m, m.y, m.y + 1, floorColor(f.skin, m.y, m.kind), lookFor(f.skin, m.kind), { kind: m.kind });
      if (f.guide) drawGuide(p, top, m.y, sim.wouldBePerfect());
    }
    fx.drawDebris(p, false);
    fx.drawFlash(p, top);
    scenery.drawBandClouds(p, true, f.showMover ? n : null, dt);
    fx.drawParticles(p);
    ctx.restore();

    scenery.drawWind(p, f.showMover && m ? sim.windFor(m.y) : 0, dt);
    fx.drawPopups(p, top, f.hudBottom);
    scenery.drawVignette(p);
    if (fx.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${fx.whiteFlash * 0.5})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }
}

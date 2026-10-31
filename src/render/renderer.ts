// Puts a frame together: camera, sky, island, tower, effects.
import { clamp, lerp, mixRgb, rand } from "../core/util";
import { BLOCK_SIZE, ISLAND, UI_FONT } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import type { Skin } from "../data/skins";
import type { TowerSim } from "../logic/sim";
import { drawBlock, drawRoof, floorColor, lookFor } from "./buildings";
import { drawGuide, drawLandingShadow, Effects } from "./effects";
import { ISO_X, View, type Env, type Paint } from "./paint";
import { PostFX } from "./post";
import { nightAt, Scenery, skyAt, sunAt } from "./scenery";
import { SkyTraffic } from "./sky";

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
  /** Smooth mode: no shaders, fewer effects. */
  low: boolean;
  /** Bottom edge of the score display, in pixels. */
  hudBottom: number;
  /** Your tallest tower, in floors, marked on screen while you play (0 for none). */
  bestFloors: number;
  /** City buildings on the island. */
  city: string[];
}

export class Renderer {
  readonly view = new View();
  readonly fx = new Effects();
  readonly scenery = new Scenery();
  readonly traffic = new SkyTraffic();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly env: Env = { nf: 0, skyTop: [0, 0, 0], skyBot: [0, 0, 0], climb: 0, time: 0, low: false, post: false };
  /** The finished floors, drawn once per landing instead of every frame. */
  private readonly towerCache = document.createElement("canvas");
  private readonly cacheCtx = this.towerCache.getContext("2d")!;
  private cacheKey = "";
  private cacheStack: unknown = null;
  private cacheRef: [number, number] = [0, 0];
  private cacheMargin = 0;
  private dpr = 1;
  private lastZoom = 0;
  /** Respect the system "reduce motion" setting: no shaking or ripples. */
  private readonly calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private readonly paint: Paint;
  private readonly post: PostFX;
  private postOn = false;
  /** Eased center of the sharp tilt-shift band. */
  private focus = 0.55;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly fxCanvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.paint = { ctx: this.ctx, view: this.view, env: this.env };
    this.post = new PostFX(fxCanvas);
  }

  /** The canvas that shows the finished frame (for the share picture). */
  get output(): HTMLCanvasElement {
    return this.postOn ? this.fxCanvas : this.canvas;
  }

  /** Shaders run in High and Auto graphics; Smooth mode and devices without WebGL skip them. */
  private setPost(on: boolean): void {
    on = on && this.post.ok;
    if (on === this.postOn) return;
    this.postOn = on;
    // The 2D canvas stays on top (invisible) so it keeps receiving taps.
    this.canvas.style.opacity = on ? "0" : "1";
    this.fxCanvas.hidden = !on;
  }

  /** `scale` lowers the resolution on devices that can't keep up. */
  resize(low: boolean, scale = 1): void {
    const v = this.view;
    // Past about 1.75x pixels the extra sharpness is hard to see but costs a lot.
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75) * scale);
    this.dpr = dpr;
    this.cacheKey = "";
    v.W = this.canvas.clientWidth || window.innerWidth;
    v.H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(v.W * dpr);
    this.canvas.height = Math.round(v.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.post.resize(this.canvas.width, this.canvas.height);
    // A full floor is about 17.3 units wide on screen; size it to the smaller screen dimension.
    v.s = Math.min(v.W * 0.56, v.H * 0.36) / (BLOCK_SIZE * 2 * ISO_X);
    v.th = v.s * 1.3;
    if (!v.originY) v.originY = v.H * 0.56;
    if (!v.cx) v.cx = v.W / 2;
  }

  /** Eases the camera toward the framing for the current shot. */
  /** `full` frames the finished tower on the whole screen (results card hidden). */
  camera(dt: number, shot: Shot, level: number, full = false): void {
    const v = this.view, { W, H, s, th } = v;
    let tZoom = 1, tLevel = Math.max(0, level - Math.floor(H * 0.2 / th)), tOrigin = H * 0.6, tCx = W / 2;
    if (shot === "menu") { tZoom = 0.72; tOrigin = H * 0.56; tLevel = 0; }
    if (shot === "over") {
      // Frame whichever reaches higher, the antenna or the island's back corner, down to the island's front.
      const above = Math.max((level + 4.8) * th, ISLAND * s);
      const room = v.wide || full ? H * 0.84 : H * 0.44;
      tZoom = Math.min(1, room / (above + ISLAND * s + 3 * th));
      tLevel = 0;
      tOrigin = H * 0.08 + above * tZoom;
      if (v.wide && !full) tCx = W * 0.27;
    }
    const k = Math.min(1, dt * (shot === "over" ? 3 : 6));
    v.zoom = lerp(v.zoom, tZoom, k);
    // Settle exactly, so the cached tower can be reused.
    if (Math.abs(v.zoom - tZoom) < 0.0006) v.zoom = tZoom;
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
    // The finished tower is seen from far away, from the ground up, so the lower sky keeps
    // its daytime color instead of the sunset at the top.
    if (f.shot === "over") env.skyBot = mixRgb(env.skyBot, skyAt(0)[1], 0.6);
    env.post = this.postOn;
    env.nf = nightAt(n);
    env.climb = view.level * view.th * view.zoom;
    scenery.theme = f.theme;
    scenery.islandNow = f.islandLevel;
    scenery.life.city = f.city;

    scenery.drawSky(p, n, dt);

    ctx.save();
    if (fx.shake > 0 && !this.calm) ctx.translate(rand(-1, 1) * 10 * fx.shake, rand(-1, 1) * 10 * fx.shake);

    scenery.drawBack(p, n > 1 ? stack[1] : stack[0], n);
    scenery.drawBandClouds(p, false, null, dt);
    scenery.life.update(dt);
    this.traffic.update(p, dt);
    this.traffic.draw(p);
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
    this.drawTower(f);
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
    if (f.shot === "play" && f.bestFloors > 2) this.drawBestLine(f);
    fx.drawPopups(p, top, f.hudBottom);
    this.setPost(!f.low);
    if (!this.postOn) scenery.drawVignette(p); // the shader has its own
    if (fx.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${fx.whiteFlash * 0.5})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
    if (this.postOn) this.finish(f, dt);
  }

  /** Floors below the top come from a cache that's redrawn only when the tower or the
   *  zoom changes. The top floor is always drawn live (it bounces when it lands). */
  private drawTower(f: Frame): void {
    const { view, env, paint: p, fx } = this, stack = f.sim.stack, n = stack.length;
    const settled = view.zoom === this.lastZoom;
    this.lastZoom = view.zoom;
    const drawFloor = (q: Paint, i: number, still: boolean) => {
      const b = stack[i], isTop = i === n - 1 && i > 0;
      drawBlock(q, b, b.y, b.y + 1 - (isTop ? fx.bounce * 0.3 : 0), floorColor(f.skin, b.y, b.kind), lookFor(f.skin, b.kind), { lobby: b.lobby, kind: b.kind, still });
    };
    const reach = (BLOCK_SIZE * view.s + view.th * 2) * view.zoom;
    const visible = (i: number, margin: number) => {
      const [, y] = view.project(0, stack[i].y, 0);
      return y - reach <= view.H + margin && y + reach >= -margin;
    };
    if (!settled || n < 3) {
      // While zooming, draw directly.
      for (let i = 0; i < n; i++) if (visible(i, 0)) drawFloor(p, i, false);
      return;
    }
    const key = [n, f.skin.id, view.zoom, view.W, view.H, this.dpr, env.low, env.post, f.shot].join("|");
    if (key !== this.cacheKey || this.cacheStack !== stack) {
      this.cacheKey = key;
      this.cacheStack = stack;
      const m = this.cacheMargin = Math.ceil(view.th * view.zoom * 4);
      const c = this.towerCache, g = this.cacheCtx;
      c.width = Math.round(view.W * this.dpr);
      c.height = Math.round((view.H + m * 2) * this.dpr);
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, m * this.dpr);
      const q: Paint = { ctx: g, view, env };
      for (let i = 0; i < n - 1; i++) if (visible(i, m)) drawFloor(q, i, true);
      this.cacheRef = view.project(0, 0, 0);
    }
    const [x0, y0] = view.project(0, 0, 0);
    p.ctx.drawImage(this.towerCache, x0 - this.cacheRef[0], y0 - this.cacheRef[1] - this.cacheMargin, view.W, view.H + this.cacheMargin * 2);
    drawFloor(p, n - 1, false);
  }

  /** A dashed line at the height of your best tower, so you can see the record coming. */
  private drawBestLine(f: Frame): void {
    const { ctx, view } = this, level = f.sim.level;
    const ahead = f.bestFloors - level;
    if (ahead < -3 || ahead > 40) return;
    const [, y] = view.project(0, f.bestFloors + 1, 0);
    if (y < f.hudBottom + 10 || y > view.H - 10) return;
    const a = ahead >= 0 ? 0.9 : Math.max(0, 0.9 + ahead * 0.3); // fades once you pass it
    ctx.save();
    ctx.globalAlpha = a;
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff6f9c";
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(view.W, y); ctx.stroke();
    ctx.setLineDash([]);
    const label = ahead >= 0 ? `BEST ${f.bestFloors * 5} m` : "NEW BEST!";
    ctx.font = `800 12px ${UI_FONT}`;
    const w = ctx.measureText(label).width + 18, x = view.W - w - 10;
    ctx.fillStyle = "#ff4f8b";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - 11, w, 22, 11) : ctx.rect(x, y - 11, w, 22); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + 1);
    ctx.restore();
  }

  /** Runs the shader pass. The sharp band follows what matters in each shot. */
  private finish(f: Frame, dt: number): void {
    const { view, env } = this, n = f.sim.stack.length, H = view.H || 1;
    let target: number, tilt: number, span: number;
    if (f.shot === "menu") {
      target = view.project(0, 0.5, 0)[1] / H; tilt = 0.85; span = 0.13;
    } else if (f.shot === "over") {
      target = view.project(0, f.sim.level / 2, 0)[1] / H; tilt = 0.6; span = 0.24;
    } else {
      target = view.project(0, f.sim.top.y + 1, 0)[1] / H; tilt = 0.4; span = 0.2;
    }
    this.focus = lerp(this.focus, clamp(target, 0.1, 0.9), Math.min(1, dt * 4));
    const skin = f.skin;
    this.post.render(this.canvas, {
      time: env.time,
      night: env.nf,
      warm: clamp((n - 14) / 24, 0, 1) * (1 - env.nf * 0.8) * (f.shot === "play" ? 1 : 0.3),
      sun: (() => { const s = sunAt(n, view.W, H); return { x: s.x / view.W, y: s.y / H, amount: (1 - s.t) * (1 - env.nf) * 0.55 }; })(),
      fog: env.skyBot,
      // Haze below you grows as the tower climbs, which sells the height.
      fogAmount: f.shot === "play" ? clamp(f.sim.level / 60, 0, 1) * 0.22 : 0.05,
      ripple: this.calm ? { ...this.fx.ripple, strength: 0 } : this.fx.ripple,
      aspect: view.W / H,
      bloom: 0.4 + env.nf * 0.35 + (skin.neon || skin.alwaysLit ? 0.2 : 0),
      tilt,
      focus: this.focus,
      span,
    });
  }
}

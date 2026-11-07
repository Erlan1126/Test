// Your skyline: a floating island behind the main one where your tallest towers stay
// standing, each in the skin and shape it was built in. It grows as you play.
import { clamp, hexRgb, rgb } from "../core/util";
import { shapeById } from "../data/shapes";
import { skinById } from "../data/skins";
import type { IslandTheme } from "../data/islands";
import type { SkylineTower } from "../logic/skyline";
import { drawBlock, floorColor, lookFor } from "./buildings";
import { footprint } from "./footprint";
import { poly, type Paint } from "./paint";

/** Where the skyline island floats, its half-size, and how high. */
const CX = -31, CZ = -31, R = 7.2, Y = -6;
/** Nine spots on the island, back (far) ones first so taller towers go there. */
const SPOTS = [-4.4, 0, 4.4].flatMap(a => [-4.4, 0, 4.4].map(b => [CX + a, CZ + b] as const))
  .sort((p, q) => p[0] + p[1] - (q[0] + q[1]));

/** Mini tower height in floor units for a tower of `floors` floors. */
const heightFor = (floors: number) => clamp(floors * 0.2, 1.6, 16);

export class Skyline {
  private readonly cache = document.createElement("canvas");
  private readonly g = this.cache.getContext("2d")!;
  private key = "";
  private ref: [number, number] = [0, 0];
  private box = { x: 0, y: 0, w: 0, h: 0 };

  draw(p: Paint, towers: SkylineTower[], theme: IslandTheme, dpr: number): void {
    if (!towers.length) return;
    const { view, env } = p;
    const key = [JSON.stringify(towers), theme.id, view.zoom, view.W, view.H, dpr, Math.round(env.nf * 10), env.low].join("|");
    const [ox, oy] = view.project(0, 0, 0);
    if (key !== this.key) {
      this.key = key;
      // The screen area the island and its tallest tower can cover.
      const tall = Math.max(...towers.map(t => heightFor(t.f))) + 1;
      const pts = [view.project(CX - R, Y, CZ + R), view.project(CX + R, Y, CZ - R), view.project(CX - R, Y + tall, CZ - R), view.project(CX + R, Y - 6, CZ + R)];
      const x0 = Math.min(...pts.map(q => q[0])) - 8, x1 = Math.max(...pts.map(q => q[0])) + 8;
      const y0 = Math.min(...pts.map(q => q[1])) - 8, y1 = Math.max(...pts.map(q => q[1])) + 8;
      this.box = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
      this.cache.width = Math.ceil(this.box.w * dpr);
      this.cache.height = Math.ceil(this.box.h * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
      this.paint({ ctx: this.g, view, env }, towers, theme);
      this.ref = [ox, oy];
    }
    // The cache is tied to the world, so it just slides as the camera climbs.
    const dx = ox - this.ref[0], dy = oy - this.ref[1];
    const bob = Math.sin(env.time * 0.4) * 0.25 * view.th * view.zoom;
    p.ctx.drawImage(this.cache, this.box.x + dx, this.box.y + dy - bob, this.box.w, this.box.h);
  }

  private paint(p: Paint, towers: SkylineTower[], t: IslandTheme): void {
    const { view, env } = p, d = 1 - env.nf * 0.6;
    const P = (x: number, y: number, z: number) => view.project(CX + x, Y + y, CZ + z);
    // A floating slab of rock with a lawn on top, like the main island.
    poly(p, [P(-R, 0, R), P(R, 0, R), P(0, -R * 0.9, 0)], rgb(hexRgb(t.rockL), d));
    poly(p, [P(R, 0, -R), P(R, 0, R), P(0, -R * 0.9, 0)], rgb(hexRgb(t.rockR), d));
    poly(p, [P(-R, 0, R), P(R, 0, R), P(R, -0.7, R), P(-R, -0.7, R)], rgb(hexRgb(t.dirtL), d));
    poly(p, [P(R, 0, -R), P(R, 0, R), P(R, -0.7, R), P(R, -0.7, -R)], rgb(hexRgb(t.dirtR), d));
    poly(p, [P(-R, 0, -R), P(R, 0, -R), P(R, 0, R), P(-R, 0, R)], rgb(hexRgb(t.lawn), d));
    const pr = R - 0.8;
    poly(p, [P(-pr, 0.01, -pr), P(pr, 0.01, -pr), P(pr, 0.01, pr), P(-pr, 0.01, pr)], rgb(hexRgb(t.plaza), d));

    // Tallest towers take the back spots so they never hide the shorter ones.
    const order = [...towers].sort((a, b) => b.f - a.f);
    const placed = order.map((tw, i) => ({ tw, spot: SPOTS[i] })).filter(x => x.spot)
      .sort((a, b) => a.spot[0] + a.spot[1] - (b.spot[0] + b.spot[1]));
    for (const { tw, spot: [x, z] } of placed) {
      const skin = skinById(tw.s), shape = shapeById(tw.h), h = heightFor(tw.f), half = 1.35;
      const box = { x0: x - half, x1: x + half, z0: z - half, z1: z + half };
      // In bands of two floors, so the skin's color changes show up the tower.
      for (let y = 0; y < h; y += 2) {
        const y1 = Math.min(h, y + 2), band = Math.floor(y / 2);
        const foot = shape.id === "square" ? undefined : footprint(shape, box, band * 4);
        drawBlock(p, box, Y + y, Y + y1, floorColor(skin, band * 8, "normal"), lookFor(skin, "normal"), { foot, still: true });
      }
    }
  }
}

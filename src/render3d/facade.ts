// Facade textures for each skin's look: walls, floor slabs and windows, with a second map
// for windows that light up at night and a third that makes glass shiny and walls matte.
// One tile covers 8 world units across and 4 floors up, so lit windows don't repeat
// floor after floor.
import * as THREE from "three";
import { hash } from "../core/util";
import type { Look } from "../data/skins";

const PX = 48;             // pixels per world unit across
const TILE_W = 8, TILE_F = 4;
const W = PX * TILE_W, FLOOR_PX = 64, H = FLOOR_PX * TILE_F;
const RES = 2;

export interface Facade {
  map: THREE.Texture;
  lit: THREE.Texture;
  /** Green = roughness, blue = metalness (three's packing). */
  orm: THREE.Texture;
}

const cache = new WeakMap<Look, Facade>();

/** Window rectangles in tile pixels for a look: [x, y, w, h, lit?]. */
function windows(look: Look): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = [];
  for (let f = 0; f < TILE_F; f++) {
    const top = f * FLOOR_PX, y0 = top + FLOOR_PX * 0.18, h = FLOOR_PX * 0.56;
    if (look.kind === "ribbon") {
      // A continuous glass band with mullions every 1.3 units.
      const step = 1.3 * PX;
      for (let k = 0; k * step < W; k++) {
        const x = k * step + 3, w = Math.min(step, W - k * step) - 6;
        out.push([x, y0, w, h, hash(f, k, 11)]);
      }
    } else {
      const step = 1.6 * PX, ww = 0.84 * PX;
      for (let k = 0; k * step < W; k++) {
        out.push([k * step + (step - ww) / 2, y0, ww, h, hash(f, k, 13)]);
      }
    }
  }
  return out;
}

export function facadeFor(look: Look): Facade {
  const hit = cache.get(look);
  if (hit) return hit;
  // Drawn at twice the size (same layout), so windows stay crisp up close and on sharp screens.
  const mk = () => { const c = document.createElement("canvas"); c.width = W * RES; c.height = H * RES; return c; };
  const base = mk(), lit = mk(), orm = mk();
  const b = base.getContext("2d")!, l = lit.getContext("2d")!, o = orm.getContext("2d")!;
  for (const g of [b, l, o]) g.setTransform(RES, 0, 0, RES, 0, 0);
  // Walls are white (the floor's color tints them); glass is the look's glass color.
  b.fillStyle = "#ffffff"; b.fillRect(0, 0, W, H);
  l.fillStyle = "#000000"; l.fillRect(0, 0, W, H);
  o.fillStyle = "rgb(0,170,0)"; o.fillRect(0, 0, W, H);   // satin walls, not metal
  for (let f = 0; f < TILE_F; f++) {
    // Floor slab at the bottom of each floor, and a darker line where floors meet.
    const yb = (f + 1) * FLOOR_PX;
    b.fillStyle = look.slab; b.fillRect(0, yb - FLOOR_PX * look.slabH * 1.2, W, FLOOR_PX * look.slabH * 1.2);
    b.fillStyle = "rgba(0,0,0,0.18)"; b.fillRect(0, yb - 2, W, 2);
    if (look.neon) {
      l.fillStyle = look.lit[f % look.lit.length];
      l.fillRect(0, yb - FLOOR_PX * 0.08, W, FLOOR_PX * 0.06);
    }
  }
  const litColors = look.lit;
  // Pilasters: a raised band of trim between each pair of windows, with a lit edge.
  if (look.pilaster && look.kind === "punched") {
    const step = 1.6 * PX;
    for (let k = 0; k * step <= W; k++) {
      const x = k * step - 7;
      b.fillStyle = look.pilaster; b.fillRect(x, 0, 14, H);
      b.fillStyle = "rgba(255,255,255,0.35)"; b.fillRect(x, 0, 3, H);
      b.fillStyle = "rgba(0,0,0,0.18)"; b.fillRect(x + 11, 0, 3, H);
    }
  }
  // Each window's outline: plain, arched, round, or split by a cross of mullions.
  const shapeOf = (x: number, y: number, w: number, h: number, grow = 0): Path2D => {
    const p = new Path2D(), X = x - grow, Y = y - grow, Wd = w + grow * 2, Ht = h + grow * 2;
    if (look.win === "arch" && look.kind === "punched") {
      const r = Wd / 2;
      p.moveTo(X, Y + Ht); p.lineTo(X, Y + r); p.arc(X + r, Y + r, r, Math.PI, 0); p.lineTo(X + Wd, Y + Ht); p.closePath();
    } else if (look.win === "round" && look.kind === "punched") {
      p.ellipse(X + Wd / 2, Y + Ht / 2, Wd / 2, Ht / 2, 0, 0, Math.PI * 2);
    } else p.rect(X, Y, Wd, Ht);
    return p;
  };
  for (const [x, y, w, h, r] of windows(look)) {
    if (look.kind === "punched") { b.fillStyle = look.frame; b.fill(shapeOf(x, y, w, h, 4)); }
    const shape = shapeOf(x, y, w, h);
    b.save(); b.clip(shape);
    // Glass: lighter at the top, like it's catching the sky.
    const g = b.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(look.glass, 1.35));
    g.addColorStop(1, shade(look.glass, 0.8));
    b.fillStyle = g; b.fillRect(x, y, w, h);
    b.fillStyle = "rgba(255,255,255,0.18)"; b.fillRect(x, y, w * 0.3, h); // a reflection streak
    if (look.win === "split") { b.fillStyle = look.frame; b.fillRect(x + w / 2 - 2, y, 4, h); b.fillRect(x, y + h * 0.42, w, 4); }
    b.restore();
    if (look.kind === "ribbon") { b.fillStyle = look.frame; b.fillRect(x - 3, y, 3, h); }
    // A balcony rail along the bottom of the window, with posts.
    if (look.balcony) {
      b.fillStyle = look.balcony;
      b.fillRect(x - 4, y + h - 2, w + 8, 4);
      b.fillRect(x - 4, y + h - 14, w + 8, 2);
      for (let px = x - 4; px <= x + w + 4; px += 8) b.fillRect(px, y + h - 14, 2, 14);
    }
    o.fillStyle = "rgb(0,14,235)"; o.fill(shape);          // mirror-like glass
    // Some windows glow at night (all of them for always-lit skins): a soft, warm lamp-lit
    // room, brighter low in the window and dimmer at the edges, not a flat white panel.
    if (look.alwaysLit || r < 0.38) {
      const c = litColors[Math.floor(r * 97) % litColors.length];
      l.save(); l.clip(shape);
      l.fillStyle = c; l.fillRect(x, y, w, h);
      const room = l.createRadialGradient(x + w / 2, y + h * 0.75, 0, x + w / 2, y + h * 0.75, Math.max(w, h) * 0.85);
      room.addColorStop(0, "rgba(0,0,0,0)");
      room.addColorStop(1, "rgba(30,12,0,0.55)");
      l.fillStyle = room; l.fillRect(x, y, w, h);
      l.fillStyle = "rgba(0,0,0,0.35)"; l.fillRect(x, y, w, h * 0.22); // a darker ceiling band
      l.restore();
    }
  }
  // Steel cross-bracing: an X across every few windows of each floor, over the glass.
  if (look.brace) {
    b.strokeStyle = look.brace; b.lineWidth = 6; b.lineCap = "square";
    const span = 2.6 * PX;
    for (let f = 0; f < TILE_F; f++) {
      const y0 = f * FLOOR_PX + 4, y1 = (f + 1) * FLOOR_PX - 6;
      for (let x = 0; x < W; x += span) {
        b.beginPath(); b.moveTo(x, y0); b.lineTo(x + span, y1); b.moveTo(x + span, y0); b.lineTo(x, y1); b.stroke();
      }
    }
    b.fillStyle = look.brace;
    for (let x = 0; x <= W; x += span) b.fillRect(x - 5, 0, 10, H);
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / TILE_W * 2, 1 / TILE_F); // geometry u is in 2-unit steps, v in floors
    t.anisotropy = 16;  // three caps this at what the phone supports
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const out = { map: tex(base, true), lit: tex(lit, true), orm: tex(orm, false) };
  cache.set(look, out);
  return out;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

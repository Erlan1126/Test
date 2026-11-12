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
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const base = mk(), lit = mk(), orm = mk();
  const b = base.getContext("2d")!, l = lit.getContext("2d")!, o = orm.getContext("2d")!;
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
  for (const [x, y, w, h, r] of windows(look)) {
    if (look.kind === "punched") { b.fillStyle = look.frame; b.fillRect(x - 4, y - 4, w + 8, h + 8); }
    // Glass: lighter at the top, like it's catching the sky.
    const g = b.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(look.glass, 1.35));
    g.addColorStop(1, shade(look.glass, 0.8));
    b.fillStyle = g; b.fillRect(x, y, w, h);
    b.fillStyle = "rgba(255,255,255,0.18)"; b.fillRect(x, y, w * 0.3, h); // a reflection streak
    if (look.kind === "ribbon") { b.fillStyle = look.frame; b.fillRect(x - 3, y, 3, h); }
    o.fillStyle = "rgb(0,14,235)"; o.fillRect(x, y, w, h);          // mirror-like glass
    // About half the windows glow at night (all of them for always-lit skins).
    if (look.alwaysLit || r < 0.5) {
      const c = litColors[Math.floor(r * 97) % litColors.length];
      l.fillStyle = c; l.fillRect(x, y, w, h);
      l.fillStyle = "rgba(0,0,0,0.35)"; l.fillRect(x, y, w, h * 0.22); // a darker ceiling band
    }
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / TILE_W * 2, 1 / TILE_F); // geometry u is in 2-unit steps, v in floors
    t.anisotropy = 4;
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

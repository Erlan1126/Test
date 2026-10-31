// Buildings: tower floors, the lobby, neighbors, cars and the rooftop.
import { hash, hexRgb, lerp, mixRgb, rgb, type RGB } from "../core/util";
import { GOLD } from "../data/constants";
import { SPECIAL_COLORS, type Look, type Skin } from "../data/skins";
import type { Box } from "../logic/rules";
import type { FloorKind } from "../logic/sim";
import { face, glow, poly, type Paint, type Pt } from "./paint";

/** Icy floors: pale, frosted glass. */
const ICE_LOOK: Look = { kind: "ribbon", glass: "#e6f8ff", frame: "#ffffff", slab: "#ffffff", slabH: 0.1, lit: ["#e6f8ff", "#ffffff"] };
/** Garden terraces: planters and green-framed windows. */
const GARDEN_LOOK: Look = { kind: "punched", glass: "#2f5d3a", frame: "#d8f5c8", slab: "#8a6a4a", slabH: 0.16, lit: ["#fff1b0"] };

/** The color of a floor at height y in a skin, or its special color. */
export function floorColor(skin: Skin, y: number, kind: FloorKind): RGB {
  if (kind === "gold") return hexRgb(GOLD);
  if (kind === "ice") return hexRgb(SPECIAL_COLORS.ice);
  if (kind === "garden") return hexRgb(SPECIAL_COLORS.garden);
  const f = skin.floors, i = Math.floor(y / 5), t = (y % 5) / 5;
  return mixRgb(hexRgb(f[i % f.length]), hexRgb(f[(i + 1) % f.length]), t);
}

export const lookFor = (skin: Skin, kind: FloorKind): Look => (kind === "ice" ? ICE_LOOK : kind === "garden" ? GARDEN_LOOK : skin);

interface Wall {
  axis: "x" | "z";
  at: number;
  lo: number;
  hi: number;
  sh: number;
  id: number;
}

/** Four corners of a rectangle on a wall. The wall runs along `axis` at the fixed coordinate `at`. */
function wallQuad(p: Paint, f: Wall, u0: number, u1: number, ya: number, yb: number): Pt[] {
  const v = p.view;
  const q = f.axis === "x" ? (u: number, y: number) => v.project(u, y, f.at) : (u: number, y: number) => v.project(f.at, y, u);
  return [q(u0, yb), q(u1, yb), q(u1, ya), q(u0, ya)];
}

function glassColor(p: Paint, look: Look, sh: number): string {
  const day = mixRgb(hexRgb(look.glass), p.env.skyBot, look.kind === "ribbon" ? 0.22 : 0.12);
  return rgb(mixRgb(day, [14, 20, 42], p.env.nf * 0.88), sh);
}

/** One storey of facade on one wall: floor slab, windows, lights and reflections. */
function drawStorey(p: Paint, fy: number, top: number, look: Look, f: Wall, alpha: number): void {
  const { ctx, view, env } = p;
  const nf = env.nf;
  if (look.neon) {
    const nc = look.lit[Math.abs(Math.round(fy)) % look.lit.length];
    poly(p, wallQuad(p, f, f.lo, f.hi, fy, fy + 0.07), nc);
    if (view.zoom > 0.35) glow(p, wallQuad(p, f, f.lo, f.hi, fy - 0.12, fy + 0.2), nc);
  } else {
    poly(p, wallQuad(p, f, f.lo, f.hi, fy, fy + look.slabH), rgb(hexRgb(look.slab), f.sh * (1 - nf * 0.55)));
  }
  const ya = fy + 0.26, yb = Math.min(fy + 0.84, top - 0.07);
  if (yb <= ya + 0.08) return;
  const lit = (r: number) => look.alwaysLit || r < nf * 0.72;
  const glows = view.zoom > 0.4 && (nf > 0.25 || !!look.alwaysLit);

  if (look.kind === "ribbon") {
    const u0 = f.lo + 0.22, u1 = f.hi - 0.22;
    if (u1 <= u0) return;
    poly(p, wallQuad(p, f, u0, u1, ya, yb), glassColor(p, look, f.sh));
    const step = 1.3;
    for (let k = Math.floor(u0 / step); k * step < u1; k++) {
      const p0 = Math.max(u0, k * step) + 0.05, p1 = Math.min(u1, (k + 1) * step) - 0.05;
      if (p1 <= p0) continue;
      const r = hash(Math.round(fy), f.id, k);
      if (lit(r)) {
        const c = look.lit[Math.floor(r * 97) % look.lit.length];
        poly(p, wallQuad(p, f, p0, p1, ya, yb), c);
        if (glows) glow(p, wallQuad(p, f, p0 - 0.25, p1 + 0.25, ya - 0.2, yb + 0.2), c);
      } else if (((k + Math.round(fy)) % 5 + 5) % 5 === 0 && nf < 0.9) {
        // Diagonal sky reflections running across the glass
        ctx.globalAlpha = alpha * 0.28 * (1 - nf);
        poly(p, wallQuad(p, f, p0, p1, ya, yb), "#ffffff");
        ctx.globalAlpha = alpha;
      }
    }
    if (view.zoom > 0.3) {
      ctx.strokeStyle = rgb(hexRgb(look.frame), f.sh * (1 - nf * 0.6), 0.8);
      ctx.lineWidth = Math.max(0.8, 1.4 * view.zoom);
      ctx.beginPath();
      for (let k = Math.ceil(u0 / step); k * step < u1; k++) {
        const [q0, , , q3] = wallQuad(p, f, k * step, k * step, ya, yb);
        ctx.moveTo(q0[0], q0[1]);
        ctx.lineTo(q3[0], q3[1]);
      }
      ctx.stroke();
    }
  } else {
    const step = 1.6, half = 0.42;
    const frameC = rgb(hexRgb(look.frame), f.sh * (1 - nf * 0.6));
    for (let i = Math.ceil((f.lo + half + 0.2) / step - 0.5); (i + 0.5) * step + half + 0.2 <= f.hi; i++) {
      const c = (i + 0.5) * step;
      poly(p, wallQuad(p, f, c - half - 0.1, c + half + 0.1, ya - 0.1, yb + 0.05), frameC);
      const r = hash(Math.round(fy), f.id, i);
      const q = wallQuad(p, f, c - half, c + half, ya, yb);
      if (lit(r)) {
        const lc = look.lit[Math.floor(r * 97) % look.lit.length];
        poly(p, q, lc);
        if (glows) glow(p, wallQuad(p, f, c - half - 0.3, c + half + 0.3, ya - 0.25, yb + 0.25), lc);
      } else {
        poly(p, q, glassColor(p, look, f.sh));
        if (((i + Math.round(fy)) % 4 + 4) % 4 === 0 && nf < 0.9) {
          ctx.globalAlpha = alpha * 0.3 * (1 - nf);
          poly(p, wallQuad(p, f, c - half, c, ya, yb), "#ffffff");
          ctx.globalAlpha = alpha;
        }
      }
    }
  }
}

/** The lobby: tall glass with a front door and canopy. */
function drawLobby(p: Paint, look: Look, f: Wall): void {
  const { ctx, view, env } = p;
  const u0 = f.lo + 0.3, u1 = f.hi - 0.3;
  poly(p, wallQuad(p, f, u0, u1, 0.1, 0.86), glassColor(p, { ...look, kind: "ribbon" }, f.sh));
  if (env.nf > 0.2) {
    ctx.globalAlpha = env.nf * 0.7;
    poly(p, wallQuad(p, f, u0, u1, 0.1, 0.86), "#ffe7a1");
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = rgb(hexRgb(look.frame), f.sh, 0.85);
  ctx.lineWidth = Math.max(0.8, 1.4 * view.zoom);
  ctx.beginPath();
  for (let u = Math.ceil(u0 / 1.3) * 1.3; u < u1; u += 1.3) {
    const [q0, , , q3] = wallQuad(p, f, u, u, 0.1, 0.86);
    ctx.moveTo(q0[0], q0[1]);
    ctx.lineTo(q3[0], q3[1]);
  }
  ctx.stroke();
  if (f.id === 1) {
    poly(p, wallQuad(p, f, -0.9, 0.9, 0.04, 0.62), rgb([30, 36, 52]));
    poly(p, wallQuad(p, f, -0.04, 0.04, 0.04, 0.62), rgb([120, 130, 150]));
    poly(p, wallQuad(p, f, -1.5, 1.5, 0.62, 0.7), rgb(hexRgb(look.frame), 0.9));
  }
}

export interface BlockOpts {
  alpha?: number;
  /** Walls without windows (cars, rooftop housing). */
  plain?: boolean;
  lobby?: boolean;
  kind?: FloorKind;
}

/** A building block: two visible walls with facade detail, a roof, and crisp edges. */
export function drawBlock(p: Paint, b: Box, y0: number, y1: number, c: RGB, look: Look, opts: BlockOpts = {}): void {
  const { ctx, view, env } = p;
  const alpha = opts.alpha ?? 1;
  const d = 1 - env.nf * (look.neon ? 0.15 : 0.55);
  const P = (x: number, y: number, z: number) => view.project(x, y, z);
  const A = P(b.x0, y1, b.z0), B = P(b.x1, y1, b.z0), C = P(b.x1, y1, b.z1), D = P(b.x0, y1, b.z1);
  const Bb = P(b.x1, y0, b.z0), Cb = P(b.x1, y0, b.z1), Db = P(b.x0, y0, b.z1);
  ctx.globalAlpha = alpha;
  face(p, [D, C, Cb, Db], c, 1.0 * d, 0.88 * d);
  face(p, [B, C, Cb, Bb], c, 0.78 * d, 0.66 * d);

  if (!opts.plain) {
    const walls: Wall[] = [
      { axis: "x", at: b.z1, lo: b.x0, hi: b.x1, sh: 1, id: 1 },
      { axis: "z", at: b.x1, lo: b.z0, hi: b.z1, sh: 0.8, id: 2 },
    ];
    if (opts.lobby) walls.forEach(f => drawLobby(p, look, f));
    else for (let fy = y0; fy < y1 - 0.3; fy++) walls.forEach(f => drawStorey(p, fy, y1, look, f, alpha));
  }
  // Contact shading where this block sits on the one below, so floors read as separate pieces.
  if (!opts.plain && !opts.lobby && y1 - y0 <= 1.2) {
    for (const f of [[D, C, Cb, Db], [B, C, Cb, Bb]] as Pt[][]) {
      const [t0, t1, b1, b0] = f, k = 0.16;
      const m0: Pt = [lerp(b0[0], t0[0], k), lerp(b0[1], t0[1], k)], m1: Pt = [lerp(b1[0], t1[0], k), lerp(b1[1], t1[1], k)];
      ctx.globalAlpha = alpha * 0.28 * (1 - env.nf * 0.5);
      poly(p, [m0, m1, b1, b0], "#0a1030");
      ctx.globalAlpha = alpha;
    }
  }

  // Roof with a parapet rim
  poly(p, [A, B, C, D], rgb(c, 1.14 * d));
  const ins = Math.min(0.45, (b.x1 - b.x0) / 6, (b.z1 - b.z0) / 6);
  poly(p, [P(b.x0 + ins, y1, b.z0 + ins), P(b.x1 - ins, y1, b.z0 + ins), P(b.x1 - ins, y1, b.z1 - ins), P(b.x0 + ins, y1, b.z1 - ins)], rgb(c, 0.98 * d));

  if (opts.kind === "gold" || opts.kind === "ice") {
    // A shine that sweeps across penthouse and icy floors
    const t = (env.time / (opts.kind === "ice" ? 0.6 : 0.9)) % 1.6 - 0.3;
    if (t > 0 && t < 1) {
      const x = lerp(b.x0, b.x1, t), x2 = Math.min(b.x1, x + 1.2);
      ctx.globalAlpha = alpha * 0.5;
      poly(p, [P(x, y1, b.z0), P(x2, y1, b.z0), P(x2, y1, b.z1), P(x, y1, b.z1)], "#ffffff");
      ctx.globalAlpha = alpha;
    }
  }
  if (opts.kind === "garden" && view.zoom > 0.3) drawPlanters(p, b, y1, d);

  // Light catching the top edges and the front corner
  ctx.lineWidth = Math.max(0.8, 1.2 * view.zoom);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 * d})`;
  ctx.beginPath(); ctx.moveTo(D[0], D[1]); ctx.lineTo(C[0], C[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.18 * d})`;
  ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(Cb[0], Cb[1]); ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Little bushes along the front edges of a garden terrace's roof. */
function drawPlanters(p: Paint, b: Box, y: number, d: number): void {
  const { ctx, view } = p;
  const r = 0.38 * view.s * view.zoom;
  const spots: [number, number][] = [];
  for (let x = b.x0 + 0.7; x < b.x1 - 0.3; x += 1.4) spots.push([x, b.z1 - 0.5]);
  for (let z = b.z0 + 0.7; z < b.z1 - 0.9; z += 1.4) spots.push([b.x1 - 0.5, z]);
  for (const [x, z] of spots) {
    const [sx, sy] = view.project(x, y, z);
    const leaf: RGB = hash(x, z, 4) > 0.5 ? [78, 160, 70] : [104, 186, 84];
    ctx.fillStyle = rgb(leaf, d);
    ctx.beginPath(); ctx.arc(sx, sy - r * 0.6, r, 0, Math.PI * 2); ctx.fill();
    if (hash(z, x, 7) > 0.6) {
      ctx.fillStyle = rgb([255, 140, 170], d);
      ctx.beginPath(); ctx.arc(sx + r * 0.3, sy - r * 0.9, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** A rooftop and blinking antenna, so the finished tower looks like a real skyscraper. */
export function drawRoof(p: Paint, t: Box & { y: number }, look: Look): void {
  const { ctx, view, env } = p;
  const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
  const hw = Math.min(1.8, (t.x1 - t.x0) / 3), hd = Math.min(1.8, (t.z1 - t.z0) / 3);
  drawBlock(p, { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd }, t.y + 1, t.y + 1.7, [190, 198, 210], look, { plain: true });
  const [bx, by] = view.project(cx, t.y + 1.7, cz), [tx, ty] = view.project(cx, t.y + 4.6, cz);
  ctx.strokeStyle = "#e9ecef";
  ctx.lineWidth = Math.max(1.5, 3 * view.zoom);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  const on = Math.floor(env.time / 0.6) % 2 === 0;
  const r = Math.max(2.5, 5 * view.zoom);
  if (on) {
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r * 5);
    g.addColorStop(0, "rgba(255,70,70,0.7)");
    g.addColorStop(1, "rgba(255,70,70,0)");
    ctx.fillStyle = g;
    ctx.fillRect(tx - r * 5, ty - r * 5, r * 10, r * 10);
  }
  ctx.fillStyle = on ? "#ff4646" : "#7a1f1f";
  ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
}

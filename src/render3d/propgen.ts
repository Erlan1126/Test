// Every property in town gets a design of its own: a seeded generator picks its shape,
// colors, roof, windows, balconies, ground floor, rooftop and garden for each size it can
// grow to (little homes, apartments, an apartment block, a city tower, a skyscraper). The
// choices multiply into hundreds of different buildings per size, and the same property
// always looks the same.

import * as THREE from "three";
import type { ModelMats } from "./bizmodels";

export interface GenKit {
  mats: ModelMats;
  /** The ground pieces under the building. */
  lawn: THREE.Material;
  pave: THREE.Material;
  metal: THREE.Material;
  slab: (w: number, d: number, r: number, h: number) => THREE.BufferGeometry;
}

const WALLS = ["#fff1e0", "#e9f3ff", "#ffe8ef", "#eefbe8", "#fff7d6", "#f1ebff", "#ffe2c8", "#dff4f0", "#f7e6ff", "#e6eef8", "#fbe3d2", "#e8f7dc", "#fdf6ec", "#e4ecf7"];
const BRICKS = ["#c9775a", "#b5655a", "#d89a6a", "#a85a48", "#8a6a5a", "#c48a6a", "#9a5a4a", "#d4a07a"];
const ROOFS = ["#d9534a", "#5a6fd0", "#e07a9a", "#4f9a5a", "#b8683a", "#7a5ad0", "#3a4a6a", "#c84a2a", "#2f8a8a", "#8a4a2a", "#e0a030", "#4a4a5a"];
const ACCENTS = ["#ffffff", "#2a3a5a", "#d4af37", "#3a2f5a", "#ff8a5c", "#2f9bff", "#5ec26a", "#e8457a"];
const CONCRETE = ["#e9e4f5", "#dcdce4", "#f0ece4", "#d8e0ea", "#ece2d6", "#cfd6e2"];
const TINTS = ["#9fd4ff", "#7ab8e8", "#a8e0d8", "#b8c8f0", "#8fb0d8", "#c0e8ff", "#6a9ac8", "#d0c0f0", "#a0c8b8", "#e0d0b0"];

/** A small seeded random generator (the same seed always gives the same building). */
function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Builds property design `seed` at `level` (1-5) into G; returns its height. */
export function genBuilding(G: THREE.Group, seed: number, level: number, k: GenKit): number {
  const R = rng(seed * 7919 + level * 104729), pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)];
  const m = k.mats, c = (col: string, r = 0.7, mt = 0) => m.c(col, r, mt);
  const K = (geo: THREE.BufferGeometry, mat: THREE.Material) => { G.add(new THREE.Mesh(geo, mat)); };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => K(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), mat);
  const win = m.win, white = c("#ffffff", 0.6);
  // Ground: a lawn and a paved front.
  K(k.slab(4.2, 4.2, 1.6, 0.06), k.lawn);
  K(new THREE.BoxGeometry(4.0, 0.03, 0.9).translate(0, 0.07, 1.55), k.pave);
  const Y = 0.06;

  /** A row of windows on the front (+z) and both sides of a box. */
  const windows = (w: number, d: number, y0: number, floors: number, fh: number, cx: number, cz: number, style: number, frame: THREE.Material) => {
    const per = Math.max(1, Math.round(w / (style === 2 ? 0.5 : 0.75))), perS = Math.max(1, Math.round(d / 0.75));
    for (let f = 0; f < floors; f++) {
      const y = y0 + f * fh + fh * 0.28, wh = style === 1 ? fh * 0.6 : fh * 0.45;
      for (let i = 0; i < per; i++) {
        const ox = cx - w / 2 + (i + 0.5) * (w / per), ww = Math.min(style === 2 ? 0.26 : 0.36, (w / per) * 0.6);
        box(ww, wh, 0.04, ox, y, cz + d / 2 + 0.01, win);
        if (style !== 1) box(ww + 0.08, 0.04, 0.08, ox, y - 0.03, cz + d / 2 + 0.03, frame);
        if (style === 3) box(ww + 0.1, 0.05, 0.1, ox, y + wh + 0.02, cz + d / 2 + 0.04, frame);
      }
      for (let i = 0; i < perS; i++) {
        const oz = cz - d / 2 + (i + 0.5) * (d / perS), ww = Math.min(0.34, (d / perS) * 0.55);
        for (const sd of [-1, 1]) box(0.04, wh, ww, cx + sd * (w / 2 + 0.01), y, oz, win);
      }
    }
  };
  const tree = (x: number, z: number, s = 1) => { K(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.5 * s, 6).translate(x, Y + 0.25 * s, z), m.trunk); K(new THREE.IcosahedronGeometry(0.34 * s, 0).translate(x, Y + 0.75 * s, z), m.leaf); };
  const garden = () => {
    const g = Math.floor(R() * 4);
    if (g === 0) for (let i = 0; i < 12; i++) box(0.05, 0.28, 0.04, -1.85 + i * 0.335, Y, 1.05, white);
    else if (g === 1) box(3.6, 0.3, 0.25, 0, Y, 1.05, m.leaf);
    else if (g === 2) for (let i = 0; i < 7; i++) K(new THREE.SphereGeometry(0.08, 6, 4).translate(-1.5 + i * 0.5, Y + 0.12, 1.1), c(pick(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"]), 0.8));
    if (R() < 0.7) tree(pick([-1.7, 1.7]), -1.6 + R() * 0.6, 0.8 + R() * 0.4);
  };
  /** Roofs for houses. */
  const roof = (type: number, w: number, d: number, y: number, x: number, z: number, col: THREE.Material) => {
    if (type === 0) { // gable
      const s = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.08, 0), new THREE.Vector2(d / 2 + 0.08, 0), new THREE.Vector2(0, d * 0.42)]);
      K(new THREE.ExtrudeGeometry(s, { depth: w + 0.12, bevelEnabled: false }).translate(0, 0, -(w + 0.12) / 2).rotateY(Math.PI / 2).translate(x, y, z), col);
    } else if (type === 1) K(new THREE.ConeGeometry(Math.max(w, d) * 0.74, Math.max(w, d) * 0.42, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(x, y + Math.max(w, d) * 0.21, z), col);
    else if (type === 2) { box(w + 0.08, 0.1, d + 0.08, x, y, z, white); box(w + 0.08, 0.16, 0.06, x, y + 0.1, z + d / 2, white); }
    else if (type === 3) { // gambrel: a steep lower slope and a flat top
      box(w + 0.1, 0.28, d + 0.1, x, y, z, col);
      K(new THREE.ConeGeometry(Math.max(w, d) * 0.6, 0.3, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(x, y + 0.43, z), col);
    } else { // shed roof (one slope)
      K(new THREE.BoxGeometry(w + 0.12, 0.08, d + 0.2).rotateX(-0.28).translate(x, y + 0.2, z), col);
      box(w, 0.25, 0.04, x, y, z + d / 2, c("#ffffff", 0.7));
    }
  };

  if (level <= 1) {
    // Little homes: one villa, or two or three town houses in a row.
    const n = pick([1, 2, 2, 3, 3]), gw = n === 1 ? 2.6 : 3.6 / n;
    const sameRoof = R() < 0.5, rtype = Math.floor(R() * 5);
    let top = 0;
    for (let i = 0; i < n; i++) {
      const w = gw * (n === 1 ? 1 : 0.95), d = n === 1 ? 2.2 : 1.8, floors = R() < 0.6 ? 2 : 1, fh = 0.55, h = floors * fh;
      const x = n === 1 ? 0 : -1.8 + gw * (i + 0.5), z = -0.3;
      const wall = c(pick(WALLS), 0.85), rc = c(pick(ROOFS), 0.75), acc = c(pick(ACCENTS), 0.6);
      box(w, h, d, x, Y, z, wall);
      windows(w, d, Y, floors, fh, x, z, Math.floor(R() * 4), white);
      const dx = x + (R() < 0.5 ? -1 : 1) * w * 0.22;
      box(0.3, 0.46, 0.05, dx, Y, z + d / 2 + 0.02, acc);
      // The way in: a step, a little canopy over the door, a path to the street, a mailbox.
      box(0.42, 0.05, 0.16, dx, Y, z + d / 2 + 0.08, k.pave);
      box(0.44, 0.04, 0.22, dx, Y + 0.52, z + d / 2 + 0.11, c(pick(ROOFS), 0.6));
      box(0.28, 0.02, 1.2 - d / 2 + 0.3, dx, Y, (z + d / 2 + 1.5) / 2 + 0.05, k.pave);
      if (R() < 0.6) { box(0.04, 0.3, 0.04, dx + 0.3, Y, 1.35, k.metal); box(0.12, 0.1, 0.18, dx + 0.3, Y + 0.3, 1.35, c(pick(["#3a6fe0", "#e2453c", "#2a3a5a", "#5ec26a"]), 0.5)); }
      if (floors > 1 && R() < 0.5) for (const sx of [-1, 1]) { box(0.36, 0.08, 0.12, x + sx * w * 0.25, Y + fh + 0.12, z + d / 2 + 0.06, c("#8a5a3a", 0.8)); K(new THREE.SphereGeometry(0.06, 5, 4).translate(x + sx * w * 0.25, Y + fh + 0.24, z + d / 2 + 0.08), c(pick(["#ff6fa0", "#ffe27a", "#ff8a5c"]), 0.8)); }
      const rt = sameRoof ? rtype : Math.floor(R() * 5);
      roof(rt, w, d, Y + h, x, z, rc);
      if (R() < 0.5 && rt !== 2) box(0.14, 0.4, 0.14, x + w * 0.25, Y + h + 0.2, z - d * 0.2, c(pick(BRICKS), 0.8));
      if (R() < 0.35) { box(w * 0.6, 0.05, 0.45, x, Y + 0.55, z + d / 2 + 0.22, rc); for (const sx of [-1, 1]) box(0.05, 0.55, 0.05, x + sx * w * 0.28, Y, z + d / 2 + 0.42, white); }
      if (R() < 0.3) for (const sx of [-1, 1]) box(0.06, fh * 0.45, 0.05, x + sx * w * 0.42, Y + fh * 0.25, z + d / 2 + 0.03, acc);
      top = Math.max(top, h + 0.9);
    }
    garden();
    return top;
  }

  if (level === 2 || level === 3) {
    // Apartments (3-4 floors) and apartment blocks (5-7): plaster or brick, a footprint that
    // may be an L or two wings, balconies, a ground-floor shop or a lobby, and a roof with
    // a garden, tanks or a pitched top.
    const floors = level === 2 ? 3 + Math.floor(R() * 2) : 5 + Math.floor(R() * 3), fh = 0.55;
    const brick = R() < 0.45, wallC = brick ? pick(BRICKS) : pick(WALLS), wall = c(wallC, 0.85), trim = c(pick(["#ffffff", "#f4f2fa", "#2a3a5a", "#e8e0d0"]), 0.6);
    const shape = Math.floor(R() * 3), shop = R() < 0.55, gh = shop ? 0.7 : 0;
    const w = 3.0 + R() * 0.3, d = 2.3 + R() * 0.3, cz = -0.35, h = gh + floors * fh;
    const parts: [number, number, number, number][] = shape === 0 ? [[0, cz, w, d]] : shape === 1 ? [[-0.55, cz - 0.15, w - 1.1, d + 0.3], [0.95, cz + 0.35, 1.1, d - 0.7]] : [[-0.8, cz, 1.4, d], [0.8, cz, 1.4, d]];
    for (const [px, pz, pw, pd] of parts) {
      if (shop) { box(pw, gh, pd, px, Y, pz, c(pick(ROOFS), 0.6)); box(pw * 0.8, gh - 0.2, 0.04, px, Y + 0.08, pz + pd / 2 + 0.01, win); }
      box(pw, floors * fh, pd, px, Y + gh, pz, wall);
      windows(pw, pd, Y + gh, floors, fh, px, pz, Math.floor(R() * 4), trim);
      for (let f = 1; f < floors; f++) if (R() < 0.35 || brick) box(pw + 0.06, 0.05, pd + 0.06, px, Y + gh + f * fh, pz, trim);
      box(pw + 0.1, 0.12, pd + 0.1, px, Y + h, pz, trim);
    }
    if (shape === 2) box(0.4, floors * fh * 0.6, d * 0.6, 0, Y + gh, cz, wall);
    // The entrance (a glass door under a canopy, with house numbers), air-conditioning boxes
    // on the side walls, and vents and an aerial on the roof.
    if (!shop) { box(0.6, 0.55, 0.04, 0, Y, cz + d / 2 + 0.02, win); box(0.9, 0.05, 0.4, 0, Y + 0.62, cz + d / 2 + 0.2, trim); box(0.2, 0.1, 0.02, 0.45, Y + 0.45, cz + d / 2 + 0.03, c("#2a3a5a", 0.5)); }
    for (let f = 1; f < floors; f += 2) if (R() < 0.6) box(0.12, 0.18, 0.24, (R() < 0.5 ? -1 : 1) * (w / 2 + 0.06), Y + gh + f * fh + 0.1, cz + (R() - 0.5) * d * 0.6, c("#d8dce8", 0.4, 0.4));
    for (let v = 0; v < 2 + Math.floor(R() * 3); v++) box(0.12, 0.2, 0.12, -w / 2 + 0.3 + R() * (w - 0.6), Y + h + 0.12, cz - d / 2 + 0.3 + R() * 0.5, c("#b8bcc8", 0.5, 0.4));
    if (R() < 0.5) { K(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4).translate(-w / 2 + 0.3, Y + h + 0.47, cz + 0.4), k.metal); box(0.4, 0.02, 0.02, -w / 2 + 0.3, Y + h + 0.7, cz + 0.4, k.metal); }
    if (shop) { const aw = pick(ROOFS); for (let i = 0; i < 8; i++) K(new THREE.BoxGeometry(w / 8, 0.05, 0.5).rotateX(0.35).translate(-w / 2 + (i + 0.5) * (w / 8), Y + gh, cz + d / 2 + 0.22), c(i % 2 ? "#ffffff" : aw, 0.6)); }
    const bal = Math.floor(R() * 3);
    if (bal > 0) for (let f = 1; f < floors; f++) for (const bx of [-0.8, 0.8]) {
      box(0.62, 0.05, 0.3, bx, Y + gh + f * fh, cz + d / 2 + 0.15, trim);
      box(0.62, 0.18, 0.03, bx, Y + gh + f * fh, cz + d / 2 + 0.29, bal === 1 ? c("#3a3f6a", 0.5, 0.3) : c("#bfe6ff", 0.1, 0.1));
    }
    const rt = Math.floor(R() * 4);
    if (rt === 0) { box(w * 0.7, 0.08, d * 0.6, 0, Y + h + 0.12, cz, m.leaf); tree(0.6, cz, 0.5); }
    else if (rt === 1) { K(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10).translate(0.8, Y + h + 0.35, cz - 0.5), c("#8a6a4a", 0.8)); K(new THREE.ConeGeometry(0.32, 0.18, 10).translate(0.8, Y + h + 0.67, cz - 0.5), c("#6a4a3a", 0.8)); box(0.5, 0.3, 0.4, -0.7, Y + h + 0.12, cz + 0.2, c("#c8cce0", 0.5, 0.4)); }
    else if (rt === 2) roof(0, w, d, Y + h + 0.12, 0, cz, c(pick(ROOFS), 0.75));
    else { box(w * 0.5, 0.4, d * 0.5, 0, Y + h + 0.12, cz, trim); for (let i = 0; i < 4; i++) box(0.05, 0.6, 0.05, -0.7 + i * 0.46, Y + h + 0.12, cz + d * 0.3, c("#b07a4a", 0.8)); }
    if (R() < 0.6) tree(pick([-1.75, 1.75]), 1.2, 0.7);
    return h + 1.0;
  }

  // City towers (8-11 floors) and skyscrapers (12-18): glass or banded concrete, a shape of
  // their own (box, cylinder, octagon, hexagon, setbacks, tapering, twisting, twin towers),
  // a podium and a crown on top.
  const floors = level === 4 ? 8 + Math.floor(R() * 4) : 12 + Math.floor(R() * 7), fh = 0.5;
  const glass = R() < 0.65, tint = glass ? c(pick(TINTS), 0.12, 0.55) : c(pick(CONCRETE), 0.6), band = c(pick(["#ffffff", "#f4f2fa", "#2a3a5a", "#c8cce0", "#d4af37"]), 0.4, 0.3);
  const shape = level === 4 ? Math.floor(R() * 5) : Math.floor(R() * 7), cz = -0.3, pod = 0.6, H = floors * fh;
  box(3.4, pod, 2.8, 0, Y, cz, c(pick(CONCRETE), 0.6));
  box(2.6, pod - 0.15, 0.04, 0, Y + 0.08, cz + 1.41, win);
  box(1.4, 0.06, 0.5, 0, Y + pod, cz + 1.6, c(pick(ROOFS), 0.5));
  const y0 = Y + pod;
  // The podium's front: a lit sign with the company's colour, planters by the doors, and a
  // revolving door under the canopy.
  box(1.0, 0.18, 0.05, 0, Y + pod - 0.25, cz + 1.43, m.sign(pick(ACCENTS.slice(4))));
  for (const sx of [-1.25, 1.25]) { box(0.4, 0.22, 0.3, sx, Y, cz + 1.7, c("#d9d2e6", 0.6)); K(new THREE.IcosahedronGeometry(0.2, 0).translate(sx, Y + 0.38, cz + 1.7), m.leaf); }
  K(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 10).translate(0, Y + 0.21, cz + 1.42), win);
  const shaft = (geo: THREE.BufferGeometry, y: number, h: number) => K(geo.translate(0, y + h / 2, 0).translate(0, 0, cz), glass ? tint : tint);
  const bands = (r: number, y: number, h: number, sides: number, rot = 0) => { for (let f = 0; f <= Math.round(h / fh); f++) K(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.05, sides).rotateY(rot).translate(0, y + f * fh, cz), band); };
  let top = y0 + H;
  if (shape === 0) { // box
    const w = 2.2 + R() * 0.4, d = 2.0 + R() * 0.3;
    shaft(new THREE.BoxGeometry(w, H, d), y0, H);
    for (let f = 0; f <= floors; f++) box(w + 0.05, 0.05, d + 0.05, 0, y0 + f * fh, cz, band);
    if (!glass) windows(w, d, y0, floors, fh, 0, cz, 1, band);
    for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) box(0.05, H, 0.07, -w / 2 + (i + 0.5) * (w / 5), y0, cz + sd * (d / 2 + 0.02), band);
  } else if (shape === 1 || shape === 2 || shape === 3) { // cylinder, octagon, hexagon
    const sides = shape === 1 ? 24 : shape === 2 ? 8 : 6, r = 1.15 + R() * 0.2;
    shaft(new THREE.CylinderGeometry(r, r, H, sides), y0, H);
    bands(r, y0, H, sides);
    for (let f2 = 0; f2 < Math.min(sides, 12); f2++) { const a = (f2 / Math.min(sides, 12)) * Math.PI * 2; box(0.05, H, 0.07, Math.cos(a) * (r + 0.02), y0, cz + Math.sin(a) * (r + 0.02), band); }
  } else if (shape === 4) { // setbacks (a wedding cake)
    const tiers = 3; let y = y0, w = 2.6;
    for (let t = 0; t < tiers; t++) { const h = H * [0.45, 0.33, 0.22][t]; shaft(new THREE.BoxGeometry(w, h, w * 0.85), y, h); for (let f = 0; f <= Math.round(h / fh); f++) box(w + 0.05, 0.05, w * 0.85 + 0.05, 0, y + f * fh, cz, band); y += h; w *= 0.74; }
    top = y;
  } else if (shape === 5) { // twisting: stacked slabs each turned a little
    const tw = (R() < 0.5 ? 1 : -1) * (0.05 + R() * 0.04);
    for (let f = 0; f < floors; f++) K(new THREE.BoxGeometry(2.0, fh * 0.92, 2.0).rotateY(f * tw).translate(0, y0 + f * fh + fh / 2, cz), f % 2 ? tint : tint), K(new THREE.BoxGeometry(2.06, 0.05, 2.06).rotateY(f * tw).translate(0, y0 + f * fh, cz), band);
  } else { // twin towers with a skybridge
    for (const sx of [-0.8, 0.8]) { K(new THREE.BoxGeometry(1.3, H, 1.6).translate(sx, y0 + H / 2, cz), tint); for (let f = 0; f <= floors; f++) box(1.35, 0.05, 1.65, sx, y0 + f * fh, cz, band); }
    box(0.4, 0.4, 0.6, 0, y0 + H * 0.62, cz, band);
  }
  // Machinery on the roof (behind the crown).
  for (let v = 0; v < 2 + Math.floor(R() * 2); v++) box(0.3, 0.22, 0.25, -0.5 + v * 0.45, top, cz - 0.55, c("#c8cce0", 0.4, 0.4));
  // The crown.
  const crown = Math.floor(R() * 6), gold = R() < 0.3 ? m.gold : band;
  if (crown === 0) { K(new THREE.ConeGeometry(0.15, 2.2, 8).translate(0, top + 1.1, cz), gold); top += 2.2; }
  else if (crown === 1) { K(new THREE.ConeGeometry(1.0, 1.2, 4).rotateY(Math.PI / 4).translate(0, top + 0.6, cz), gold); top += 1.2; }
  else if (crown === 2) { K(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24).translate(0, top + 0.04, cz), c("#3a3f5a", 0.6)); K(new THREE.TorusGeometry(0.55, 0.04, 4, 20).rotateX(Math.PI / 2).translate(0, top + 0.1, cz), c("#ffd23a", 0.5)); top += 0.3; }
  else if (crown === 3) { K(new THREE.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, top, cz), gold); top += 0.9; }
  else if (crown === 4) { for (const [ax, az, ah] of [[0.3, 0.2, 1.6], [-0.4, -0.2, 1.0], [0.1, -0.4, 1.3]]) K(new THREE.CylinderGeometry(0.03, 0.03, ah, 5).translate(ax, top + ah / 2, cz + az), k.metal); top += 1.6; }
  else { box(1.3, 0.6, 1.3, 0, top, cz, band); box(1.0, 0.04, 1.0, 0, top + 0.6, cz, m.leaf); top += 0.7; }
  return top + 0.4;
}

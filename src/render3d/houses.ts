// The town's homes and buildings, drawn in code with real architecture (like the City Hall):
// framed windows with sills, glazing bars and shutters, panelled doors under porches, tiled
// roofs with ridges, eaves and chimneys, shopfronts with awnings, apartment blocks with
// balconies, glass offices with mullions, and skyscrapers with setbacks and a crown. Every
// seed gives its own colours and design, so no two streets look the same.
import * as THREE from "three";

export interface HouseKit {
  /** A shared material of this colour (roughness, metalness). */
  c: (color: string, rough?: number, metal?: number) => THREE.Material;
  /** Window glass (it lights up at night). */
  win: THREE.Material;
}

const WALLS = ["#f4ead8", "#ffffff", "#cfe0ee", "#f3d9b8", "#d6e6c8", "#f2cfc4", "#e4d8f0", "#f6e2a0", "#c8d8d0", "#e8e0d0", "#bcd4e6", "#f0c8a8"];
const BRICKS = ["#b4613f", "#a8553a", "#c47a54", "#9a5a44"];
const ROOFS = ["#4a5468", "#6a3a2e", "#3a3f4a", "#8a4a32", "#56606e", "#7a5a48", "#2f4a5a", "#5a4a6a", "#3a5a4a", "#9a5a3a"];
const SHUTTERS = ["#2f4a6a", "#3a6a4a", "#2a2a30", "#7a3030", "#4a6a8a"];
const AWNINGS = [["#e8424f", "#ffffff"], ["#2f6fd8", "#ffffff"], ["#2a8a5a", "#f4ead8"], ["#f2a62a", "#ffffff"], ["#6a3a8a", "#f4ead8"]];

/** A small, steady random. */
function rng(seed: number): () => number {
  let a = ((Math.imul(Math.floor(seed) | 0, 2654435761) ^ 0x9e3779b9) >>> 0) || 7;
  const next = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return (a % 100000) / 100000; };
  for (let i = 0; i < 4; i++) next();
  return next;
}
/** Which design a lot gets, spread evenly over `n` designs. */
const designOf = (seed: number, level: number, n: number) => (Math.imul((Math.floor(seed) | 0) ^ (level * 7919), 2246822519) >>> 16) % n;

/** Builds a building for a lot into `G` (front facing +z, standing on y = y0). Levels: 1 houses,
 *  2 shops and terraces, 3 apartment blocks, 4 offices, 5 skyscrapers. Returns its height. */
export function buildHouse(G: THREE.Group, seed: number, level: number, k: HouseKit, y0 = 0.06, at?: [number, number]): number {
  // (Lots on a grid pick their design from where they stand, so the buildings next door,
  // in front and behind are never the same design: one step along a row moves one design
  // on, one step across moves two.)
  const design = (sd: number, lvl: number, n: number) => (at ? (((at[0] + 2 * at[1] + lvl * 5) % n) + n) % n : designOf(sd, lvl, n));
  const r = rng(seed + level * 101), pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const T = (geo: THREE.BufferGeometry, m: THREE.Material) => { G.add(new THREE.Mesh(geo, m)); };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => T(new THREE.BoxGeometry(w, h, d).translate(x, y0 + y + h / 2, z), m);
  const trim = k.c("#faf7f0", 0.6), dark = k.c("#2a2e38", 0.6), metal = k.c("#8a909a", 0.4, 0.6);

  /** A window on the front (dir +1) or back (-1) wall at z, or on a side wall at x (axis "x"). */
  const windowAt = (x: number, y: number, z: number, w: number, h: number, axis: "z" | "x", dir: number, opts: { shutters?: THREE.Material; bars?: boolean; sill?: boolean; head?: boolean } = {}) => {
    const put = (geo: THREE.BufferGeometry, m: THREE.Material, dx: number, dy: number, dz: number) => {
      if (axis === "x") geo.rotateY(Math.PI / 2);
      T(geo.translate(axis === "z" ? x + dx : x + dz * dir, y0 + y + dy, axis === "z" ? z + dz * dir : z + dx), m);
    };
    put(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), trim, 0, h / 2, 0.012);
    put(new THREE.BoxGeometry(w, h, 0.03), k.win, 0, h / 2, 0.022);
    if (opts.bars !== false) {
      put(new THREE.BoxGeometry(0.016, h, 0.012), trim, 0, h / 2, 0.04);
      put(new THREE.BoxGeometry(w, 0.016, 0.012), trim, 0, h * 0.55, 0.04);
    }
    if (opts.sill !== false) put(new THREE.BoxGeometry(w + 0.12, 0.03, 0.07), trim, 0, -0.02, 0.04);
    if (opts.head) put(new THREE.BoxGeometry(w + 0.12, 0.04, 0.05), trim, 0, h + 0.05, 0.03);
    if (opts.shutters) for (const s of [-1, 1]) put(new THREE.BoxGeometry(w * 0.48, h + 0.02, 0.02), opts.shutters, s * (w * 0.74 + 0.03), h / 2, 0.02);
  };
  /** A panelled front door with a step, a frame and a little light. */
  const door = (x: number, z: number, w: number, h: number, col: THREE.Material, y = 0) => {
    box(w + 0.08, h + 0.05, 0.03, x, y, z + 0.005, trim);
    box(w, h, 0.03, x, y, z + 0.015, col);
    for (const py of [0.25, 0.62]) box(w * 0.7, h * 0.22, 0.012, x, y + h * py - h * 0.11, z + 0.033, col);
    box(w + 0.2, 0.05, 0.16, x, y - 0.05, z + 0.08, k.c("#d6cdbd", 0.85));
    T(new THREE.SphereGeometry(0.025, 8, 6).translate(x + w * 0.35, y0 + y + h * 0.5, z + 0.04), k.c("#d8b060", 0.3, 0.8));
  };
  /** A gable roof over a w×d block, ridge along x: tiles (ridged courses), eaves, a ridge cap. */
  const gable = (w: number, d: number, y: number, rise: number, m: THREE.Material, cx = 0, cz = 0, gableWall?: THREE.Material) => {
    const s = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.14, -0.02), new THREE.Vector2(d / 2 + 0.14, -0.02), new THREE.Vector2(0, rise)]);
    T(new THREE.ExtrudeGeometry(s, { depth: w + 0.18, bevelEnabled: false }).translate(0, 0, -(w + 0.18) / 2).rotateY(Math.PI / 2).translate(cx, y0 + y, cz), m);
    // Tile courses: thin ledges across each slope.
    const slope = Math.hypot(d / 2 + 0.14, rise), ang = Math.atan2(rise, d / 2 + 0.14);
    for (let i = 1; i < 6; i++) for (const sd of [-1, 1]) {
      const t = i / 6, zz = cz + sd * (d / 2 + 0.14) * (1 - t), yy = y + rise * t;
      const g = new THREE.BoxGeometry(w + 0.18, 0.012, slope / 6 * 0.25).rotateX(sd * ang).translate(cx, y0 + yy - 0.002, zz + sd * 0.01);
      T(g, m);
    }
    box(w + 0.22, 0.05, 0.07, cx, y + rise - 0.03, cz, k.c("#2e323c", 0.7));
    // The gable ends: wall-coloured triangles, so the roof doesn't look hollow.
    if (gableWall) for (const sx of [-1, 1]) {
      const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise - 0.04)]);
      T(new THREE.ShapeGeometry(tri).rotateY(Math.PI / 2 * sx).translate(cx + sx * (w / 2 + 0.002), y0 + y, cz), gableWall);
    }
  };
  /** A hipped roof (four slopes) over a w×d block. */
  const hip = (w: number, d: number, y: number, rise: number, m: THREE.Material, cx = 0, cz = 0) => {
    const geo = new THREE.CylinderGeometry(0.001, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
    geo.scale(w + 0.24, rise, d + 0.24).translate(cx, y0 + y + rise / 2, cz);
    const p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++) if (p.getY(i) > y0 + y + rise * 0.99) p.setX(i, cx + (i % 2 ? 1 : -1) * Math.max(0, (w - d) / 2));
    geo.computeVertexNormals();
    T(geo, m);
  };
  const chimney = (x: number, z: number, yb: number, h: number, m: THREE.Material) => {
    box(0.2, h, 0.2, x, yb, z, m);
    box(0.26, 0.05, 0.26, x, yb + h, z, trim);
    for (const dx of [-0.04, 0.04]) T(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8).translate(x + dx, y0 + yb + h + 0.1, z), k.c("#8a4a3a", 0.8));
  };
  /** A flat roof edge: a parapet with a coping, rooftop plant (AC units, a vent), and a hatch. */
  const flatTop = (w: number, d: number, y: number, cx = 0, cz = 0, plant = true) => {
    box(w + 0.06, 0.12, d + 0.06, cx, y, cz, k.c("#d8d4cc", 0.85));
    box(w - 0.12, 0.02, d - 0.12, cx, y + 0.11, cz, k.c("#8a8f98", 0.9));
    box(w + 0.1, 0.03, d + 0.1, cx, y + 0.12, cz, trim);
    if (plant) {
      for (let i = 0; i < 2; i++) { const ax = cx + (r() - 0.5) * (w - 0.8), az = cz + (r() - 0.5) * (d - 0.8); box(0.32, 0.18, 0.26, ax, y + 0.12, az, k.c("#c8ccd2", 0.6, 0.3)); T(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12).translate(ax, y0 + y + 0.31, az), dark); }
      T(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8).translate(cx + w * 0.3, y0 + y + 0.23, cz - d * 0.3), metal);
    }
  };
  /** A balcony on the front at height y: a slab and a glass (or iron) railing. */
  const balcony = (x: number, y: number, z: number, w: number, glassy: boolean) => {
    box(w, 0.05, 0.36, x, y, z + 0.18, k.c("#e2ddd4", 0.8));
    if (glassy) box(w, 0.22, 0.02, x, y + 0.05, z + 0.35, k.c("#bfe0f0", 0.1, 0.3));
    else { box(w, 0.025, 0.03, x, y + 0.26, z + 0.35, dark); for (let i = 0; i <= Math.round(w / 0.08); i++) box(0.012, 0.22, 0.012, x - w / 2 + i * (w / Math.round(w / 0.08)), y + 0.04, z + 0.35, dark); }
  };

  const wallC = r() < 0.22 ? pick(BRICKS) : pick(WALLS), wall = k.c(wallC, 0.88), roof = k.c(pick(ROOFS), 0.78), shut = k.c(pick(SHUTTERS), 0.6), doorC = k.c(pick(["#6a2a2a", "#2f4a6a", "#3a5a3a", "#4a3020", "#20262e"]), 0.55);
  const lv = Math.max(1, Math.min(5, level));

  if (lv === 1) {
    const style = design(seed, 1, 10), cz = -0.25;
    if (style === 9) {
      // A seaside bungalow: one storey on a raised deck, board siding, a low hip roof, a
      // porch swing and big windows all round.
      const W = 2.4, D = 1.6, H = 0.95, board = k.c(pick(["#cfe6ee", "#f2ead8", "#d8e8d0", "#f6dcd0"]), 0.85);
      box(W + 0.5, 0.18, D + 0.6, 0, 0, cz + 0.1, k.c("#b08a5a", 0.85));
      for (let i = 0; i < 8; i++) box(W + 0.5, 0.004, 0.02, 0, 0.18, cz + 0.1 - (D + 0.6) / 2 + i * ((D + 0.6) / 8), k.c("#8a6a40", 0.85));
      box(W, H, D, 0, 0.18, cz, board);
      for (let i = 0; i < 7; i++) box(W + 0.01, 0.01, D + 0.01, 0, 0.3 + i * 0.12, cz, k.c("#ffffff", 0.9));
      for (const wx of [-0.75, 0.75]) windowAt(wx, 0.4, cz + D / 2, 0.5, 0.45, "z", 1, { bars: true });
      door(0, cz + D / 2, 0.3, 0.62, doorC, 0.18);
      for (const sx of [-1, 1]) for (const wz of [-0.35, 0.35]) windowAt(sx * W / 2, 0.4, cz + wz, 0.36, 0.42, "x", sx, {});
      for (const wx of [-0.7, 0.7]) windowAt(wx, 0.4, cz - D / 2, 0.4, 0.42, "z", -1, {});
      for (const px of [-W / 2 - 0.15, W / 2 + 0.15]) box(0.05, 0.7, 0.05, px, 0.18, cz + D / 2 + 0.35, trim);
      for (let i = 0; i <= 16; i++) box(0.015, 0.22, 0.015, -W / 2 - 0.15 + i * ((W + 0.3) / 16), 0.18, cz + D / 2 + 0.38, trim);
      box(W + 0.3, 0.03, 0.03, 0, 0.4, cz + D / 2 + 0.38, trim);
      box(0.5, 0.04, 0.18, -0.75, 0.42, cz + D / 2 + 0.2, k.c("#8a5a3a", 0.8));
      hip(W + 0.4, D + 0.6, 0.18 + H, 0.42, roof, 0, cz + 0.1);
      return 0.18 + H + 0.45 + y0;
    }
    if (style === 4) {
      // A Victorian house: a round corner turret with a pointed roof, a wrap-round porch,
      // a steep gable with decorative trim, bright painted walls.
      const W = 2.2, D = 1.7, H = 1.5, vic = k.c(pick(["#b8d4e8", "#f2c8d0", "#d8e8c0", "#f6e0a0", "#e0d0f0"]), 0.85);
      box(W + 0.1, 0.16, D + 0.1, 0, 0, cz, k.c("#a8a092", 0.95));
      box(W, H, D, 0, 0.14, cz, vic);
      for (let i = 0; i < 9; i++) box(W + 0.01, 0.012, D + 0.01, 0, 0.2 + i * 0.16, cz, k.c("#ffffff", 0.9));
      gable(W, D, 0.14 + H, 0.95, roof, 0, cz, vic);
      // The turret.
      const tx = W / 2 - 0.05, tz = cz + D / 2 - 0.05;
      T(new THREE.CylinderGeometry(0.42, 0.42, H + 0.5, 16).translate(tx, y0 + 0.14 + (H + 0.5) / 2, tz), vic);
      T(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 16).translate(tx, y0 + 0.14 + H + 0.5, tz), trim);
      T(new THREE.ConeGeometry(0.5, 0.9, 16).translate(tx, y0 + 0.14 + H + 0.53 + 0.45, tz), roof);
      T(new THREE.SphereGeometry(0.04, 8, 6).translate(tx, y0 + 0.14 + H + 1.45, tz), k.c("#c8a04a", 0.3, 0.8));
      for (const f of [0.3, 0.9]) for (const a of [0.6, 1.2]) { const wx = tx + Math.sin(a) * 0.42, wz = tz + Math.cos(a) * 0.42, g = new THREE.BoxGeometry(0.16, 0.34, 0.03).rotateY(a); T(g.translate(wx, y0 + 0.14 + f + 0.17, wz), k.win); }
      // The porch across the front.
      box(W - 0.5, 0.06, 0.5, -0.25, 0.12, cz + D / 2 + 0.25, k.c("#d6cdbd", 0.85));
      for (let i = 0; i < 4; i++) T(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8).translate(-W / 2 + 0.1 + i * 0.5, y0 + 0.47, cz + D / 2 + 0.46), trim);
      box(W - 0.4, 0.05, 0.56, -0.25, 0.78, cz + D / 2 + 0.25, roof);
      box(W - 0.5, 0.03, 0.03, -0.25, 0.36, cz + D / 2 + 0.47, trim);
      windowAt(-0.6, 0.35, cz + D / 2, 0.28, 0.42, "z", 1, { head: true });
      windowAt(-0.6, 0.14 + H * 0.55, cz + D / 2, 0.28, 0.4, "z", 1, { head: true });
      windowAt(0.1, 0.14 + H * 0.55, cz + D / 2, 0.28, 0.4, "z", 1, { head: true });
      door(0.05, cz + D / 2, 0.3, 0.6, doorC, 0.14);
      windowAt(0, 0.14 + H + 0.25, cz + D / 2 + 0.02, 0.2, 0.24, "z", 1, { sill: false });
      for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.4, cz - 0.2, 0.3, 0.42, "x", sx, {});
      return 0.14 + H + 1.5 + y0;
    }
    if (style === 5) {
      // A Mediterranean villa: white stucco, a low terracotta hip roof, an arched loggia, a
      // flat-roofed wing with a terrace and a palm-green door.
      const W = 2.0, D = 1.6, H = 1.4, stucco = k.c(pick(["#fbf6ee", "#f6eadc", "#fff4e0"]), 0.9), terra = k.c("#c0653a", 0.8);
      box(W, H, D, -0.3, 0.06, cz, stucco);
      hip(W, D, 0.06 + H, 0.42, terra, -0.3, cz);
      box(1.0, 0.85, 1.3, 1.0, 0.06, cz + 0.1, stucco);
      box(1.08, 0.08, 1.38, 1.0, 0.91, cz + 0.1, k.c("#e8dccb", 0.85));
      for (let i = 0; i < 5; i++) box(0.04, 0.16, 0.04, 0.55 + i * 0.22, 0.99, cz + 0.78, stucco);
      box(1.0, 0.04, 0.05, 1.0, 1.15, cz + 0.78, stucco);
      // The loggia: three arches on the front.
      for (let i = 0; i < 3; i++) {
        const ax = -0.95 + i * 0.42;
        box(0.32, 0.5, 0.03, ax, 0.16, cz + D / 2 + 0.005, k.c("#3a3530", 0.7));
        T(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(ax, y0 + 0.66, cz + D / 2 + 0.005), k.c("#3a3530", 0.7));
      }
      for (const wx of [-0.75, 0.15]) windowAt(wx, 0.06 + H * 0.58, cz + D / 2, 0.26, 0.38, "z", 1, { shutters: k.c("#3a7a5a", 0.6), bars: false });
      door(1.0, cz + 0.75, 0.32, 0.62, k.c("#3a7a5a", 0.5), 0.06);
      for (const sx of [-1, 1]) windowAt(-0.3 + sx * W / 2, 0.06 + H * 0.58, cz, 0.26, 0.38, "x", sx, { shutters: k.c("#3a7a5a", 0.6), bars: false });
      return 0.06 + H + 0.42 + y0;
    }
    if (style === 6) {
      // A Tudor house: white render with dark oak beams, an overhanging upper floor, a steep
      // roof and tall brick chimneys.
      const W = 2.2, D = 1.6, h1 = 0.75, h2 = 0.7, render = k.c("#f6f0e2", 0.9), oak = k.c("#3a2a20", 0.7);
      box(W, h1, D, 0, 0.06, cz, k.c(pick(BRICKS), 0.9));
      box(W + 0.16, h2, D + 0.16, 0, 0.06 + h1, cz, render);
      for (let i = 0; i <= 6; i++) box(0.05, h2, 0.02, -W / 2 - 0.08 + i * ((W + 0.16) / 6), 0.06 + h1, cz + D / 2 + 0.085, oak);
      box(W + 0.18, 0.05, 0.03, 0, 0.06 + h1, cz + D / 2 + 0.09, oak);
      box(W + 0.18, 0.05, 0.03, 0, 0.06 + h1 + h2 - 0.05, cz + D / 2 + 0.09, oak);
      for (let i = 0; i < 6; i += 2) { const x0 = -W / 2 - 0.08 + i * ((W + 0.16) / 6), w = (W + 0.16) / 6; const g = new THREE.BoxGeometry(0.04, Math.hypot(w, h2) - 0.05, 0.02).rotateZ(Math.atan2(w, h2)); T(g.translate(x0 + w / 2, y0 + 0.06 + h1 + h2 / 2, cz + D / 2 + 0.085), oak); }
      gable(W + 0.16, D + 0.16, 0.06 + h1 + h2, 1.05, roof, 0, cz, render);
      for (const wx of [-0.62, 0.62]) { windowAt(wx, 0.25, cz + D / 2, 0.36, 0.34, "z", 1, {}); windowAt(wx * 0.8, 0.06 + h1 + 0.18, cz + D / 2 + 0.08, 0.3, 0.3, "z", 1, { sill: false }); }
      door(0, cz + D / 2, 0.3, 0.58, k.c("#4a2a1a", 0.6), 0.06);
      chimney(-W * 0.4, cz, 0.06 + h1 + h2 + 0.3, 1.0, k.c(pick(BRICKS), 0.9));
      chimney(W * 0.4, cz, 0.06 + h1 + h2 + 0.3, 1.0, k.c(pick(BRICKS), 0.9));
      return 0.06 + h1 + h2 + 1.05 + y0;
    }
    if (style === 7) {
      // A farmhouse: white weatherboard, a barn-style (gambrel) red roof, a wrap-round porch.
      const W = 2.3, D = 1.7, H = 0.95, board = k.c(pick(["#ffffff", "#f2ecde", "#e8eef0"]), 0.85), red = k.c(pick(["#9a2a2a", "#2a3a4a", "#5a2a2a"]), 0.75);
      box(W, H, D, 0, 0.08, cz, board);
      for (let i = 0; i < 8; i++) box(W + 0.01, 0.01, D + 0.01, 0, 0.12 + i * 0.11, cz, k.c("#d8d2c4", 0.9));
      const sh = new THREE.Shape([new THREE.Vector2(-D / 2 - 0.1, 0), new THREE.Vector2(D / 2 + 0.1, 0), new THREE.Vector2(D / 2 - 0.05, 0.55), new THREE.Vector2(D * 0.22, 0.9), new THREE.Vector2(-D * 0.22, 0.9), new THREE.Vector2(-D / 2 + 0.05, 0.55)]);
      T(new THREE.ExtrudeGeometry(sh, { depth: W + 0.14, bevelEnabled: false }).translate(0, 0, -(W + 0.14) / 2).rotateY(Math.PI / 2).translate(0, y0 + 0.08 + H, cz), red);
      for (const dx of [-0.55, 0.55]) { box(0.3, 0.3, 0.3, dx, 0.08 + H + 0.4, cz + D / 2 - 0.08, board); windowAt(dx, 0.08 + H + 0.45, cz + D / 2 + 0.07, 0.18, 0.2, "z", 1, { sill: false }); }
      box(W + 0.5, 0.06, 0.55, 0, 0.06, cz + D / 2 + 0.28, k.c("#c8b49a", 0.85));
      box(W + 0.55, 0.05, 0.6, 0, 0.72, cz + D / 2 + 0.28, red);
      for (let i = 0; i < 6; i++) box(0.05, 0.62, 0.05, -W / 2 - 0.2 + i * ((W + 0.4) / 5), 0.1, cz + D / 2 + 0.52, k.c("#ffffff", 0.7));
      box(W + 0.45, 0.03, 0.03, 0, 0.36, cz + D / 2 + 0.53, k.c("#ffffff", 0.7));
      for (const wx of [-0.75, 0.75]) windowAt(wx, 0.28, cz + D / 2, 0.3, 0.4, "z", 1, { shutters: shut });
      door(0, cz + D / 2, 0.3, 0.58, red, 0.08);
      for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.28, cz, 0.3, 0.4, "x", sx, { shutters: shut });
      return 0.08 + H + 0.9 + y0;
    }
    if (style === 8) {
      // An A-frame cabin: a very steep roof down to the ground, a big glass gable, a deck.
      const D = 2.0, rise = 2.0, wood2 = k.c(pick(["#9a6a42", "#7a5236", "#b08050"]), 0.8);
      const sh = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, rise)]);
      T(new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false }).translate(0, 0, -D / 2).translate(0, y0 + 0.1, cz), roof);
      const front = new THREE.Shape([new THREE.Vector2(-0.95, 0), new THREE.Vector2(0.95, 0), new THREE.Vector2(0, rise - 0.15)]);
      T(new THREE.ShapeGeometry(front).translate(0, y0 + 0.1, cz + D / 2 + 0.005), wood2);
      const gl = new THREE.Shape([new THREE.Vector2(-0.65, 0.05), new THREE.Vector2(0.65, 0.05), new THREE.Vector2(0, rise - 0.5)]);
      T(new THREE.ShapeGeometry(gl).translate(0, y0 + 0.1, cz + D / 2 + 0.015), k.win);
      for (const yy of [0.5, 1.0]) box(1.4 * (1 - yy / (rise - 0.5)), 0.03, 0.02, 0, 0.1 + yy, cz + D / 2 + 0.025, wood2);
      box(0.03, rise - 0.6, 0.02, 0, 0.12, cz + D / 2 + 0.025, wood2);
      box(2.2, 0.08, 0.7, 0, 0.0, cz + D / 2 + 0.35, wood2);
      for (const sx of [-1, 1]) box(0.04, 0.3, 0.7, sx * 1.08, 0.08, cz + D / 2 + 0.35, wood2);
      chimney(0.5, cz - 0.3, 1.2, 0.9, k.c("#8a8278", 0.9));
      return 0.1 + rise + y0;
    }
    if (style === 0) {
      // A two-storey family house: gable roof, shuttered windows, a porch with columns.
      const W = 2.3, D = 1.7, H = 1.45;
      box(W + 0.1, 0.14, D + 0.1, 0, 0, cz, k.c("#cfc6b6", 0.9));
      box(W, H, D, 0, 0.12, cz, wall);
      box(W + 0.04, 0.05, D + 0.04, 0, 0.12 + H * 0.5, cz, trim);
      gable(W, D, 0.12 + H, 0.8, roof, 0, cz, wall);
      for (const wx of [-0.7, 0.7]) { windowAt(wx, 0.3, cz + D / 2, 0.3, 0.42, "z", 1, { shutters: shut }); windowAt(wx, 0.12 + H * 0.5 + 0.18, cz + D / 2, 0.3, 0.38, "z", 1, { shutters: shut }); }
      windowAt(0, 0.12 + H * 0.5 + 0.18, cz + D / 2, 0.26, 0.36, "z", 1, {});
      for (const sx of [-1, 1]) { windowAt(sx * W / 2, 0.32, cz, 0.3, 0.4, "x", sx, {}); windowAt(sx * W / 2, 0.12 + H * 0.5 + 0.18, cz, 0.3, 0.36, "x", sx, {}); }
      door(0, cz + D / 2, 0.32, 0.6, doorC, 0.12);
      // The porch.
      box(1.0, 0.08, 0.5, 0, 0.04, cz + D / 2 + 0.25, k.c("#d6cdbd", 0.85));
      for (const sx of [-1, 1]) T(new THREE.CylinderGeometry(0.03, 0.035, 0.66, 10).translate(sx * 0.44, y0 + 0.45, cz + D / 2 + 0.45), trim);
      gable(1.05, 0.62, 0.78, 0.26, roof, 0, cz + D / 2 + 0.3);
      chimney(W * 0.32, cz - 0.2, 0.12 + H + 0.2, 0.75, k.c(pick(BRICKS), 0.9));
      return 0.12 + H + 0.8 + y0;
    }
    if (style === 1) {
      // A cottage: a stone base, a steep roof with two dormers, a bay window.
      const W = 2.4, D = 1.6, H = 0.9;
      box(W, 0.22, D, 0, 0, cz, k.c("#a8a092", 0.95));
      box(W, H, D, 0, 0.22, cz, wall);
      gable(W, D, 0.22 + H, 1.05, roof, 0, cz, wall);
      for (const dx of [-0.6, 0.6]) {
        box(0.42, 0.36, 0.5, dx, 0.22 + H + 0.12, cz + D / 2 - 0.2, wall);
        gable(0.42, 0.56, 0.22 + H + 0.48, 0.2, roof, dx, cz + D / 2 - 0.2);
        windowAt(dx, 0.22 + H + 0.17, cz + D / 2 + 0.05, 0.22, 0.24, "z", 1, { sill: false });
      }
      // The bay window.
      box(0.8, 0.62, 0.22, -0.55, 0.22, cz + D / 2 + 0.1, wall);
      windowAt(-0.55, 0.32, cz + D / 2 + 0.21, 0.62, 0.42, "z", 1, {});
      box(0.86, 0.05, 0.28, -0.55, 0.86, cz + D / 2 + 0.1, roof);
      windowAt(0.75, 0.35, cz + D / 2, 0.3, 0.4, "z", 1, { shutters: shut });
      door(0.25, cz + D / 2, 0.3, 0.62, doorC, 0.22);
      for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.38, cz, 0.3, 0.38, "x", sx, { shutters: shut });
      chimney(-W * 0.36, cz, 0.22 + H + 0.4, 0.8, k.c("#9a948a", 0.95));
      return 0.22 + H + 1.05 + y0;
    }
    if (style === 2) {
      // A modern house: two offset boxes with flat roofs, timber cladding, big glass.
      const wood = k.c(pick(["#a8744a", "#8a5a38", "#c08a5a"]), 0.75);
      box(1.6, 0.95, 1.6, -0.35, 0.06, cz, k.c("#f6f6f2", 0.8));
      box(1.5, 0.9, 1.3, 0.3, 1.01, cz - 0.05, wood);
      for (let i = 0; i < 9; i++) box(0.012, 0.9, 0.012, -0.42 + i * 0.18, 1.01, cz - 0.05 + 0.656, k.c("#6a4a30", 0.8));
      box(1.2, 0.7, 0.03, -0.45, 0.14, cz + 0.81, k.win);
      for (let i = 0; i < 3; i++) box(0.02, 0.7, 0.04, -1.05 + i * 0.4, 0.14, cz + 0.82, dark);
      box(1.1, 0.5, 0.03, 0.35, 1.22, cz + 0.61, k.win);
      flatTop(1.6, 1.6, 1.01, -0.35, cz, false);
      flatTop(1.5, 1.3, 1.91, 0.3, cz - 0.05, false);
      box(0.9, 0.05, 0.6, 0.65, 1.0, cz + 0.75, k.c("#e8e8e4", 0.8));
      box(0.9, 0.24, 0.02, 0.65, 1.05, cz + 1.04, k.c("#bfe0f0", 0.1, 0.3));
      door(0.62, cz + 0.8, 0.3, 0.7, k.c("#2a2e38", 0.5), 0.06);
      return 2.1 + y0;
    }
    // A bungalow with a hipped roof and a garage.
    const W = 2.0, D = 1.5, H = 0.95;
    box(W, H, D, -0.35, 0.08, cz, wall);
    hip(W, D, 0.08 + H, 0.62, roof, -0.35, cz);
    box(0.95, 0.78, 1.3, 1.1, 0.08, cz + 0.05, wall);
    hip(0.95, 1.3, 0.86, 0.38, roof, 1.1, cz + 0.05);
    box(0.72, 0.6, 0.03, 1.1, 0.08, cz + 0.72, k.c("#e8e4dc", 0.6));
    for (let i = 0; i < 5; i++) box(0.72, 0.012, 0.01, 1.1, 0.16 + i * 0.12, cz + 0.735, k.c("#c8c2b8", 0.7));
    box(0.72, 0.03, 0.8, 1.1, 0.04, cz + 1.1, k.c("#b8b4ac", 0.9));
    for (const wx of [-1.0, -0.15]) windowAt(wx, 0.32, cz + D / 2, 0.42, 0.42, "z", 1, { shutters: shut });
    door(-0.58, cz + D / 2, 0.3, 0.62, doorC, 0.08);
    chimney(-0.9, cz - 0.3, 0.08 + H + 0.25, 0.6, k.c(pick(BRICKS), 0.9));
    return 0.08 + H + 0.62 + y0;
  }

  if (lv === 2) {
    const v2 = design(seed, 2, 10);
    if (v2 === 8) {
      // A corner pub: a dark green wooden front with gold letters, a hanging sign, two floors
      // of flats above and a slate mansard.
      const W = 2.4, D = 2.0, fh = 0.6, gh = 0.75, cz = -0.2, body = k.c(pick(WALLS.concat(BRICKS)), 0.88), pub = k.c(pick(["#1f4a3a", "#3a1f24", "#1f2f4a"]), 0.5);
      box(W, gh + fh, D, 0, 0, cz, body);
      box(W + 0.04, gh, D + 0.04, 0, 0, cz, pub);
      box(W - 0.2, 0.14, 0.03, 0, gh - 0.2, cz + D / 2 + 0.03, k.c("#d8b060", 0.4, 0.6));
      for (const wx of [-0.75, 0.75]) box(0.7, gh - 0.38, 0.03, wx, 0.12, cz + D / 2 + 0.03, k.win);
      door(0, cz + D / 2 + 0.02, 0.32, 0.55, k.c("#2a1a14", 0.5));
      for (const sx of [-1, 1]) box(0.03, gh - 0.38, D - 0.5, sx * (W / 2 + 0.025), 0.12, cz, k.win);
      box(0.04, 0.04, 0.4, W / 2 - 0.1, gh + 0.25, cz + D / 2 + 0.2, dark);
      box(0.03, 0.32, 0.28, W / 2 - 0.1, gh - 0.1, cz + D / 2 + 0.34, k.c("#d8b060", 0.4, 0.6));
      for (const wx of [-0.75, 0, 0.75]) windowAt(wx, gh + 0.12, cz + D / 2, 0.26, 0.38, "z", 1, { head: true });
      for (const sx of [-1, 1]) for (const wz of [-0.45, 0.35]) windowAt(sx * W / 2, gh + 0.12, cz + wz, 0.26, 0.38, "x", sx, { head: true });
      box(W + 0.14, 0.08, D + 0.14, 0, gh + fh, cz, trim);
      const slate = k.c("#4a4f5a", 0.7);
      hip(W - 0.1, D - 0.1, gh + fh + 0.08, 0.6, slate, 0, cz);
      for (const dx of [-0.6, 0.6]) { box(0.3, 0.26, 0.3, dx, gh + fh + 0.1, cz + D / 2 - 0.3, body); windowAt(dx, gh + fh + 0.14, cz + D / 2 - 0.15, 0.18, 0.18, "z", 1, { sill: false }); hip(0.3, 0.3, gh + fh + 0.36, 0.12, slate, dx, cz + D / 2 - 0.3); }
      return gh + fh + 0.7 + y0;
    }
    if (v2 === 9) {
      // A neighbourhood clinic: white with a blue band, ribbon windows, a glass entrance
      // under a canopy, a little garden.
      const W = 2.6, D = 2.0, cz = -0.2, white = k.c("#f4f4f0", 0.8), blue = k.c(pick(["#3a7ad8", "#2aa89a", "#5a6ad8"]), 0.6);
      box(W, 1.45, D, 0, 0, cz, white);
      box(W + 0.02, 0.16, D + 0.02, 0, 1.3, cz, blue);
      for (const y of [0.2, 0.8]) { box(W - 0.3, 0.36, 0.03, 0, y, cz + D / 2 + 0.005, k.win); box(W - 0.3, 0.36, 0.03, 0, y, cz - D / 2 - 0.005, k.win); for (const sx of [-1, 1]) box(0.03, 0.36, D - 0.3, sx * (W / 2 + 0.005), y, cz, k.win); }
      box(0.8, 0.62, 0.2, 0.7, 0, cz + D / 2 + 0.1, k.win);
      box(1.0, 0.05, 0.6, 0.7, 0.66, cz + D / 2 + 0.3, blue);
      for (const sx of [-1, 1]) box(0.04, 0.66, 0.04, 0.7 + sx * 0.45, 0, cz + D / 2 + 0.56, metal);
      box(0.3, 0.3, 0.04, -0.9, 1.0, cz + D / 2 + 0.04, k.c("#e84a4a", 0.6)); box(0.08, 0.2, 0.05, -0.9, 1.05, cz + D / 2 + 0.05, k.c("#ffffff", 0.6)); box(0.2, 0.08, 0.05, -0.9, 1.11, cz + D / 2 + 0.05, k.c("#ffffff", 0.6));
      flatTop(W, D, 1.45, 0, cz);
      return 1.8 + y0;
    }
    if (v2 === 4) {
      // A Victorian town house: its gable faces the street, a two-storey bay window, a porch.
      const W = 1.9, D = 2.2, H = 1.5, cz = -0.2, body = k.c(pick(WALLS), 0.88);
      box(W, 0.12, D, 0, 0, cz, k.c("#cfc6b6", 0.9));
      box(W, H, D, 0, 0.12, cz, body);
      // (The roof runs front to back, its gable over the street.)
      const g = new THREE.Group(); const gg = (geo: THREE.BufferGeometry, m: THREE.Material) => g.add(new THREE.Mesh(geo, m));
      const sh = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.14, -0.02), new THREE.Vector2(W / 2 + 0.14, -0.02), new THREE.Vector2(0, 0.85)]);
      gg(new THREE.ExtrudeGeometry(sh, { depth: D + 0.2, bevelEnabled: false }).translate(0, 0, -(D + 0.2) / 2), roof);
      gg(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, 0.78)])).translate(0, 0, D / 2 + 0.002), body);
      g.position.set(0, y0 + 0.12 + H, cz); G.add(g);
      windowAt(0, 0.12 + H + 0.12, cz + D / 2 + 0.003, 0.22, 0.3, "z", 1, { head: true });
      // The bay: a box out front with windows on three sides, on both floors.
      box(0.8, H - 0.05, 0.36, -0.42, 0.12, cz + D / 2 + 0.17, body);
      for (let f = 0; f < 2; f++) { const y = 0.3 + f * 0.7; windowAt(-0.42, y, cz + D / 2 + 0.35, 0.4, 0.4, "z", 1, { sill: true }); for (const sx of [-1, 1]) windowAt(-0.42 + sx * 0.4, y, cz + D / 2 + 0.17, 0.2, 0.4, "x", sx, { bars: false }); }
      box(0.9, 0.08, 0.44, -0.42, 0.12 + H - 0.05, cz + D / 2 + 0.17, trim);
      door(0.45, cz + D / 2, 0.26, 0.56, doorC, 0.12);
      windowAt(0.45, 0.12 + 0.82, cz + D / 2, 0.28, 0.38, "z", 1, { shutters: shut });
      box(0.7, 0.05, 0.5, 0.45, 0.12 + 0.68, cz + D / 2 + 0.25, trim);
      for (const px of [0.15, 0.75]) box(0.04, 0.68, 0.04, px, 0.12, cz + D / 2 + 0.46, trim);
      for (const sx of [-1, 1]) for (const wz of [-0.5, 0.4]) for (let f = 0; f < 2; f++) windowAt(sx * W / 2, 0.3 + f * 0.7, cz + wz, 0.26, 0.38, "x", sx, { shutters: shut });
      chimney(-0.5, cz - 0.6, 0.12 + H + 0.3, 0.6, k.c(pick(BRICKS), 0.9));
      return 0.12 + H + 0.85 + y0;
    }
    if (v2 === 5) {
      // A modern duplex: white render and timber, flat roofs at two heights, a glass balcony.
      const cz = -0.2, white = k.c("#f2f0ea", 0.85), timber = k.c(pick(["#b07a4a", "#9a6a40", "#c08a5a"]), 0.8);
      box(1.5, 1.5, 2.0, -0.6, 0, cz, white);
      box(1.3, 1.05, 1.9, 0.8, 0, cz - 0.05, timber);
      for (let i = 0; i < 9; i++) box(0.02, 1.05, 0.02, 0.2 + i * 0.15, 0, cz + 0.91, k.c("#7a5030", 0.8));
      box(1.1, 0.7, 0.03, -0.6, 0.12, cz + 1.01, k.win);
      box(1.1, 0.45, 0.03, -0.6, 0.95, cz + 1.01, k.win);
      box(1.3, 0.05, 0.4, -0.6, 0.85, cz + 1.2, white);
      box(1.3, 0.24, 0.02, -0.6, 0.9, cz + 1.39, k.c("#bfe0f0", 0.1, 0.3));
      box(0.6, 0.55, 0.03, 1.0, 0.25, cz + 0.91, k.win);
      door(0.45, cz + 0.91, 0.26, 0.56, k.c("#2a2e38", 0.5));
      for (const sx of [-1, 1]) { windowAt(sx < 0 ? -1.35 : 1.45, 0.3, cz + 0.2, 0.5, 0.5, "x", sx, { bars: false, sill: false }); }
      windowAt(-1.35, 1.0, cz - 0.4, 0.4, 0.3, "x", -1, { bars: false, sill: false });
      box(1.56, 0.06, 2.06, -0.6, 1.5, cz, k.c("#d8d4cc", 0.8));
      box(1.36, 0.06, 1.96, 0.8, 1.05, cz - 0.05, k.c("#d8d4cc", 0.8));
      box(1.0, 0.05, 1.2, 0.8, 1.11, cz - 0.2, k.c("#6aa84a", 0.95));
      return 1.6 + y0;
    }
    if (v2 === 6) {
      // A brick walk-up: three floors, tall windows, an iron fire escape zig-zagging down the
      // front, a cornice.
      const W = 2.4, D = 2.0, fh = 0.6, floors = 3, cz = -0.2, brk = k.c(pick(BRICKS), 0.9);
      box(W, 0.2 + floors * fh, D, 0, 0, cz, brk);
      box(W + 0.02, 0.2, D + 0.02, 0, 0, cz, k.c("#cfc6b4", 0.85));
      door(0, cz + D / 2, 0.36, 0.5, doorC, 0.2);
      box(0.6, 0.2, 0.3, 0, 0, cz + D / 2 + 0.15, k.c("#cfc6b4", 0.85));
      for (let f = 0; f < floors; f++) {
        const y = 0.3 + f * fh;
        for (const wx of [-0.85, -0.45, 0.45, 0.85]) if (f > 0 || Math.abs(wx) > 0.5) windowAt(wx, y, cz + D / 2, 0.24, 0.4, "z", 1, { head: true });
        for (const sx of [-1, 1]) for (const wz of [-0.5, 0.3]) windowAt(sx * W / 2, y, cz + wz, 0.24, 0.4, "x", sx, { head: true });
        if (f > 0) {
          box(1.1, 0.03, 0.4, -0.65, y - 0.06, cz + D / 2 + 0.2, dark);
          box(1.1, 0.03, 0.02, -0.65, y + 0.28, cz + D / 2 + 0.4, dark);
          for (let i = 0; i <= 8; i++) box(0.012, 0.32, 0.012, -1.2 + i * 0.137, y - 0.04, cz + D / 2 + 0.4, dark);
          T(new THREE.BoxGeometry(0.06, 0.02, 0.7).rotateX(-0.75).translate(-0.4, y0 + y - 0.3, cz + D / 2 + 0.2), dark);
        }
      }
      const top = 0.2 + floors * fh;
      box(W + 0.16, 0.1, D + 0.16, 0, top, cz, trim);
      for (let i = 0; i < 20; i++) box(0.04, 0.05, 0.04, -W / 2 + (i + 0.5) * (W / 20), top - 0.05, cz + D / 2 + 0.06, trim);
      flatTop(W, D, top + 0.1, 0, cz);
      return top + 0.45 + y0;
    }
    if (v2 === 7) {
      // A Mediterranean villa block: warm stucco, a terracotta hip roof, arched windows,
      // balconies with flower boxes.
      const W = 2.4, D = 2.0, fh = 0.62, cz = -0.2, stucco = k.c(pick(["#f2dcb8", "#f0d0a8", "#f6e4c8", "#ecc8a0"]), 0.9), terra = k.c("#c8603a", 0.8);
      box(W, 0.12 + 2 * fh, D, 0, 0, cz, stucco);
      for (let f = 0; f < 2; f++) for (const wx of [-0.75, 0, 0.75]) {
        const y = 0.22 + f * fh;
        if (f === 0 && wx === 0) { door(0, cz + D / 2, 0.32, 0.5, k.c("#5a3a24", 0.6), 0.12); T(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, y0 + 0.62, cz + D / 2 + 0.02), trim); continue; }
        windowAt(wx, y, cz + D / 2, 0.26, 0.36, "z", 1, { shutters: k.c(pick(["#3a7a6a", "#2f6a9a", "#7a9a4a"]), 0.6) });
        T(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(wx, y0 + y + 0.4, cz + D / 2 + 0.03), trim);
        if (f === 1) { box(0.5, 0.04, 0.24, wx, y - 0.06, cz + D / 2 + 0.12, stucco); box(0.48, 0.1, 0.08, wx, y - 0.02, cz + D / 2 + 0.22, k.c("#8a5a3a", 0.8)); for (let i = 0; i < 4; i++) T(new THREE.SphereGeometry(0.05, 6, 4).translate(wx - 0.18 + i * 0.12, y0 + y + 0.1, cz + D / 2 + 0.22), k.c(pick(["#e84a6a", "#f2c230", "#e86a3a", "#c84ad8"]), 0.8)); }
      }
      for (const sx of [-1, 1]) for (let f = 0; f < 2; f++) for (const wz of [-0.45, 0.35]) windowAt(sx * W / 2, 0.22 + f * fh, cz + wz, 0.24, 0.36, "x", sx, { shutters: shut });
      hip(W, D, 0.12 + 2 * fh, 0.55, terra, 0, cz);
      return 0.12 + 2 * fh + 0.55 + y0;
    }
    if (v2 === 2) {
      // A row of three little shops, each its own colour, sign and awning, with flats above.
      const n = 3, w = 0.95, D = 1.9, gh = 0.75, fh = 0.6, cz = -0.2;
      for (let i = 0; i < n; i++) {
        const x = -w + i * w, wm = k.c(pick(WALLS.concat(BRICKS)), 0.88), fl = 1 + (i === 1 ? 1 : 0), [a1, a2] = pick(AWNINGS);
        box(w, gh + fl * fh, D, x, 0, cz, wm);
        box(w - 0.12, gh - 0.3, 0.03, x, 0.06, cz + D / 2 + 0.01, k.win);
        box(w - 0.04, 0.16, 0.04, x, gh - 0.2, cz + D / 2 + 0.02, k.c(a1, 0.6));
        for (let j = 0; j < 4; j++) T(new THREE.BoxGeometry((w - 0.08) / 4, 0.02, 0.4).rotateX(0.45).translate(x - w / 2 + 0.04 + (j + 0.5) * ((w - 0.08) / 4), y0 + gh - 0.26, cz + D / 2 + 0.2), k.c(j % 2 ? a1 : a2, 0.7));
        for (let f = 0; f < fl; f++) { windowAt(x - 0.2, gh + f * fh + 0.12, cz + D / 2, 0.24, 0.36, "z", 1, { head: true }); windowAt(x + 0.2, gh + f * fh + 0.12, cz + D / 2, 0.24, 0.36, "z", 1, { head: true }); }
        box(w + 0.02, 0.07, D + 0.04, x, gh + fl * fh, cz, trim);
      }
      return gh + 2 * fh + 0.1 + y0;
    }
    if (v2 === 3) {
      // A corner café: a rounded corner tower with a dome, café windows, tables outside.
      const W = 2.4, D = 1.9, gh = 0.8, fh = 0.62, cz = -0.2, body = k.c(pick(WALLS), 0.88), [a1] = pick(AWNINGS);
      box(W, gh + 2 * fh, D, -0.1, 0, cz, body);
      const tx = W / 2 - 0.15, tz = cz + D / 2 - 0.1;
      T(new THREE.CylinderGeometry(0.5, 0.5, gh + 2 * fh + 0.3, 18).translate(tx, y0 + (gh + 2 * fh + 0.3) / 2, tz), body);
      T(new THREE.SphereGeometry(0.52, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(tx, y0 + gh + 2 * fh + 0.3, tz), k.c("#6fae9c", 0.45, 0.35));
      T(new THREE.CylinderGeometry(0.505, 0.505, gh - 0.2, 18, 1, true, -0.2, 2.2).translate(tx, y0 + 0.08 + (gh - 0.2) / 2, tz), k.win);
      box(W - 0.6, gh - 0.25, 0.03, -0.35, 0.06, cz + D / 2 + 0.01, k.win);
      box(W - 0.5, 0.18, 0.04, -0.35, gh - 0.2, cz + D / 2 + 0.02, k.c(a1, 0.6));
      for (let f = 0; f < 2; f++) for (const wx of [-0.95, -0.35, 0.25]) windowAt(wx, gh + f * fh + 0.12, cz + D / 2, 0.26, 0.38, "z", 1, { head: true });
      for (let f = 0; f < 2; f++) for (const a of [0.4, 1.1]) { const g = new THREE.BoxGeometry(0.2, 0.36, 0.03).rotateY(a); T(g.translate(tx + Math.sin(a) * 0.5, y0 + gh + f * fh + 0.3, tz + Math.cos(a) * 0.5), k.win); }
      for (const [cx, czz] of [[-0.9, 0.55], [-0.2, 0.6]]) { T(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 12).translate(cx, y0 + 0.3, cz + D / 2 + czz), trim); T(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).translate(cx, y0 + 0.15, cz + D / 2 + czz), dark); for (const s2 of [-1, 1]) box(0.1, 0.18, 0.1, cx + s2 * 0.2, 0, cz + D / 2 + czz, k.c(a1, 0.6)); T(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4).translate(cx, y0 + 0.55, cz + D / 2 + czz), trim); T(new THREE.ConeGeometry(0.28, 0.12, 8, 1, true).translate(cx, y0 + 0.82, cz + D / 2 + czz), k.c(a1, 0.7)); }
      box(W + 0.1, 0.07, D + 0.1, -0.1, gh + 2 * fh, cz, trim);
      flatTop(W - 0.5, D, gh + 2 * fh + 0.07, -0.35, cz);
      return gh + 2 * fh + 0.85 + y0;
    }
    if (v2 === 0) {
      // A corner shop with flats above: a shopfront (big glass, a sign band, a striped awning),
      // two storeys of windows, a cornice and a parapet.
      const W = 2.6, D = 2.0, floors = 2 + (r() < 0.5 ? 1 : 0), fh = 0.62, gh = 0.8, cz = -0.2;
      const body = r() < 0.4 ? k.c(pick(BRICKS), 0.9) : wall;
      box(W, gh + floors * fh, D, 0, 0, cz, body);
      box(W + 0.02, gh, D + 0.02, 0, 0, cz, k.c("#3a3f4a", 0.5));
      box(W - 0.3, gh - 0.28, 0.03, -0.15, 0.06, cz + D / 2 + 0.01, k.win);
      for (let i = 0; i < 4; i++) box(0.025, gh - 0.28, 0.04, -1.1 + i * 0.6, 0.06, cz + D / 2 + 0.02, dark);
      door(1.02, cz + D / 2 + 0.01, 0.28, 0.56, k.c("#3a3f4a", 0.4), 0.0);
      const [a1, a2] = pick(AWNINGS);
      box(W - 0.1, 0.2, 0.05, 0, gh - 0.22, cz + D / 2 + 0.02, k.c(a1, 0.6));
      for (let i = 0; i < 10; i++) T(new THREE.BoxGeometry((W - 0.2) / 10, 0.02, 0.5).rotateX(0.45).translate(-W / 2 + 0.1 + (i + 0.5) * ((W - 0.2) / 10), y0 + gh - 0.3, cz + D / 2 + 0.24), k.c(i % 2 ? a1 : a2, 0.7));
      for (let f = 0; f < floors; f++) for (const wx of [-0.85, -0.28, 0.28, 0.85]) windowAt(wx, gh + f * fh + 0.12, cz + D / 2, 0.3, 0.4, "z", 1, { head: true });
      for (const sx of [-1, 1]) for (let f = 0; f < floors; f++) for (const wz of [-0.45, 0.35]) windowAt(sx * W / 2, gh + f * fh + 0.12, cz + wz, 0.28, 0.4, "x", sx, {});
      const top = gh + floors * fh;
      box(W + 0.16, 0.08, D + 0.16, 0, top, cz, trim);
      flatTop(W, D, top + 0.08, 0, cz);
      return top + 0.35 + y0;
    }
    // A row of three terraced houses in different colours, each with a stoop and a bay.
    const n = 3, w = 0.9, D = 1.7, H = 1.35, cz = -0.25;
    for (let i = 0; i < n; i++) {
      const x = -w + i * w, wm = k.c(i === 1 ? pick(BRICKS) : pick(WALLS), 0.88);
      box(w, H, D, x, 0.1, cz, wm);
      box(w + 0.02, 0.1, D + 0.02, x, 0, cz, k.c("#cfc6b6", 0.9));
      windowAt(x - 0.18, 0.12 + H * 0.55, cz + D / 2, 0.24, 0.36, "z", 1, { head: true });
      windowAt(x + 0.18, 0.12 + H * 0.55, cz + D / 2, 0.24, 0.36, "z", 1, { head: true });
      box(0.38, 0.5, 0.16, x - 0.18, 0.18, cz + D / 2 + 0.07, wm);
      windowAt(x - 0.18, 0.24, cz + D / 2 + 0.15, 0.3, 0.36, "z", 1, { sill: false });
      door(x + 0.22, cz + D / 2, 0.22, 0.52, k.c(pick(["#6a2a2a", "#2f4a6a", "#3a5a3a", "#d8a030", "#20262e"]), 0.5), 0.1);
      box(0.32, 0.05, 0.22, x + 0.22, 0.05, cz + D / 2 + 0.12, k.c("#d6cdbd", 0.85));
    }
    gable(n * w, D, 0.1 + H, 0.7, roof, 0, cz, wall);
    for (let i = 0; i < n - 1; i++) chimney(-w / 2 + i * w, cz, 0.1 + H + 0.35, 0.55, k.c(pick(BRICKS), 0.9));
    return 0.1 + H + 0.7 + y0;
  }

  // Glass buildings: a stone podium, curtain walls with mullions and floor bands, a crown.
  const glassC = pick(["#6f9ec4", "#5a8aa8", "#7fb0c8", "#4f7a9a", "#8aa8c0"]), glass = k.c(glassC, 0.12, 0.55);
  const tower = (w: number, d: number, yb: number, floors: number, fh: number, cx = 0, cz = 0) => {
    box(w, floors * fh, d, cx, yb, cz, glass);
    // Floor bands (lit windows behind at night) and mullions.
    for (let f = 0; f < floors; f++) {
      const y = yb + f * fh;
      box(w + 0.05, 0.05, d + 0.05, cx, y, cz, k.c("#d8dce2", 0.5, 0.3));
      box(w + 0.03, fh * 0.55, d + 0.03, cx, y + fh * 0.25, cz, k.win);
    }
    const n = Math.max(3, Math.round(w / 0.32)), m = Math.max(3, Math.round(d / 0.32));
    for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) box(0.025, floors * fh, 0.03, cx - w / 2 + (i / n) * w, yb, cz + sz * (d / 2 + 0.01), k.c("#c8ccd2", 0.4, 0.5));
    for (let i = 0; i <= m; i++) for (const sx of [-1, 1]) box(0.03, floors * fh, 0.025, cx + sx * (w / 2 + 0.01), yb, cz - d / 2 + (i / m) * d, k.c("#c8ccd2", 0.4, 0.5));
    return yb + floors * fh;
  };
  /** A many-sided glass column (sides 3 = triangle, 6 hexagon, 8 octagon, 24 round), maybe
   *  tapering, with a band of windows and a slab at every floor. */
  const prism = (R: number, sides: number, yb: number, floors: number, fh: number, taper = 1, rot = 0, cx = 0, cz = 0) => {
    const h = floors * fh, rAt = (y: number) => R * (1 - (1 - taper) * (y / h));
    T(new THREE.CylinderGeometry(rAt(h), R, h, sides).rotateY(rot).translate(cx, y0 + yb + h / 2, cz), glass);
    for (let f = 0; f < floors; f++) {
      const y = f * fh, ra = rAt(y), rb = rAt(y + fh);
      T(new THREE.CylinderGeometry(ra + 0.035, ra + 0.035, 0.05, sides).rotateY(rot).translate(cx, y0 + yb + y, cz), k.c("#d8dce2", 0.5, 0.3));
      T(new THREE.CylinderGeometry((ra + rb) / 2 + 0.015, (ra + rb) / 2 + 0.015, fh * 0.5, sides, 1, true).rotateY(rot).translate(cx, y0 + yb + y + fh * 0.48, cz), k.win);
    }
    return yb + h;
  };
  /** A stone podium (lobby) with glass doors on the front. */
  const podium = (W: number, D: number, h: number, c = "#d6d0c4") => { box(W, h, D, 0, 0, 0, k.c(c, 0.8)); box(W - 0.4, h - 0.15, 0.03, 0, 0.06, D / 2 + 0.01, k.win); for (const sx of [-1, 1]) box(0.03, h - 0.15, D - 0.4, sx * (W / 2 + 0.01), 0.06, 0, k.win); };

  if (lv === 3) {
    const v3 = design(seed, 3, 10);
    if (v3 === 4) {
      // An art-deco block: stone piers running up the front, a stepped top, sunburst crown.
      const W = 2.8, D = 2.3, floors = 6, fh = 0.5, stone = k.c(pick(["#efe4cc", "#e8d8b8", "#f2e8d8"]), 0.85);
      podium(W, D, 0.6, "#cfc2a8");
      box(W, floors * fh, D, 0, 0.6, 0, stone);
      for (let f = 0; f < floors; f++) for (const wx of [-1.0, -0.5, 0, 0.5, 1.0]) { windowAt(wx, 0.6 + f * fh + 0.08, D / 2, 0.26, 0.36, "z", 1, { bars: false, sill: false }); if (Math.abs(wx) > 0.2) for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.6 + f * fh + 0.08, wx * 0.8, 0.26, 0.36, "x", sx, { bars: false, sill: false }); }
      for (const px of [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25]) box(0.08, floors * fh + 0.3, 0.06, px, 0.6, D / 2 + 0.03, stone);
      const top = 0.6 + floors * fh;
      box(W - 0.6, 0.5, D - 0.5, 0, top, 0, stone);
      box(W - 1.4, 0.4, D - 1.0, 0, top + 0.5, 0, stone);
      for (let i = 0; i < 5; i++) T(new THREE.BoxGeometry(0.05, 0.4, 0.03).rotateZ((i - 2) * 0.35).translate(0, y0 + top + 1.05, D / 2 - 0.48), k.c("#d8b060", 0.4, 0.6));
      return top + 1.3 + y0;
    }
    if (v3 === 5) {
      // A warehouse loft: brick, big steel-framed factory windows, a loading door, a roof deck
      // with parasols and a water tower.
      const W = 3.0, D = 2.4, floors = 4, fh = 0.62, brk = k.c(pick(BRICKS), 0.92), steel = k.c("#3a3f48", 0.5, 0.4);
      box(W, 0.2 + floors * fh, D, 0, 0, 0, brk);
      for (let f = 0; f < floors; f++) for (const wx of [-1.0, 0, 1.0]) {
        const y = 0.3 + f * fh;
        for (const [ax, sx, xx, zz] of [["z", 1, wx, D / 2], ["z", -1, wx, -D / 2]] as const) { windowAt(xx, y, zz, 0.62, 0.44, ax, sx, { bars: false, head: true }); for (let i = 1; i < 4; i++) box(0.015, 0.44, 0.015, xx - 0.31 + i * 0.155, y, zz + sx * 0.045, steel); }
        for (const sx of [-1, 1]) if (wx !== 0) windowAt(sx * W / 2, y, wx * 0.7, 0.55, 0.44, "x", sx, { bars: false, head: true });
      }
      box(0.7, 0.55, 0.04, 0, 0.0, D / 2 + 0.02, steel);
      const top = 0.2 + floors * fh;
      box(W + 0.06, 0.12, D + 0.06, 0, top, 0, k.c("#b8b0a0", 0.85));
      box(W - 0.4, 0.03, D - 0.6, 0, top + 0.12, 0, k.c("#a07a50", 0.8));
      for (const [ux, uz] of [[-0.6, 0.3], [0.5, -0.2]]) { T(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6).translate(ux, y0 + top + 0.38, uz), dark); T(new THREE.ConeGeometry(0.32, 0.12, 10).translate(ux, y0 + top + 0.66, uz), k.c(pick(["#ff5f6d", "#ffd23f", "#2f9bff"]), 0.7)); }
      const tx = W / 2 - 0.5; for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) box(0.03, 0.35, 0.03, tx + lx, top + 0.12, -0.7 + lz, metal); T(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 14).translate(tx, y0 + top + 0.66, -0.7), k.c("#8a6a4a", 0.8)); T(new THREE.ConeGeometry(0.24, 0.14, 14).translate(tx, y0 + top + 0.92, -0.7), k.c("#6a4a3a", 0.8));
      return top + 1.0 + y0;
    }
    if (v3 === 6) {
      // A courtyard block: two wings in an L round a garden with a tree.
      const fh = 0.5, floors = 5, body = k.c(pick(WALLS), 0.88), H = 0.3 + floors * fh;
      box(3.0, 0.3, 1.1, 0, 0, -0.75, k.c("#cfc6b6", 0.85)); box(3.0, floors * fh, 1.1, 0, 0.3, -0.75, body);
      box(1.1, 0.3, 1.9, 0.95, 0, 0.75, k.c("#cfc6b6", 0.85)); box(1.1, floors * fh, 1.9, 0.95, 0.3, 0.75, body);
      for (let f = 0; f < floors; f++) {
        const y = 0.4 + f * fh;
        for (const wx of [-1.2, -0.6, 0]) { windowAt(wx, y, -0.2, 0.26, 0.32, "z", 1, {}); windowAt(wx, y, -1.3, 0.26, 0.32, "z", -1, {}); }
        for (const wz of [0.1, 0.7, 1.3]) { windowAt(0.4, y, wz, 0.26, 0.32, "x", -1, {}); windowAt(1.5, y, wz, 0.26, 0.32, "x", 1, {}); }
        windowAt(0.95, y, 1.7, 0.3, 0.32, "z", 1, {}); windowAt(-1.5, y, -0.75, 0.3, 0.32, "x", -1, {});
        if (f > 0) balcony(-0.6, y - 0.06, -0.2, 0.5, true);
      }
      box(1.8, 0.05, 1.5, -0.55, 0, 0.75, k.c("#6aa84a", 0.95));
      box(0.6, 0.06, 0.6, -0.55, 0.05, 0.75, k.c("#d6cdbd", 0.85));
      T(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6).translate(-0.55, y0 + 0.35, 0.75), k.c("#6a4a30", 0.9));
      T(new THREE.SphereGeometry(0.4, 10, 8).translate(-0.55, y0 + 0.85, 0.75), k.c("#3a8a3a", 0.9));
      flatTop(3.0, 1.1, H, 0, -0.75); flatTop(1.1, 1.9, H, 0.95, 0.75, false);
      return H + 0.35 + y0;
    }
    if (v3 === 7) {
      // A modern block with round-cornered balconies wrapping two corners on every floor.
      const W = 2.6, D = 2.2, floors = 6, fh = 0.48, body = k.c(pick(["#f2f0ea", "#e8eef2", "#f2ece4"]), 0.85), rail = k.c("#bfe0f0", 0.1, 0.3);
      podium(W, D, 0.55, "#3a3f4a");
      box(W, floors * fh, D, 0, 0.55, 0, body);
      for (let f = 0; f < floors; f++) {
        const y = 0.55 + f * fh;
        box(W - 0.3, 0.3, 0.03, 0, y + 0.1, D / 2 + 0.005, k.win); box(W - 0.3, 0.3, 0.03, 0, y + 0.1, -D / 2 - 0.005, k.win);
        for (const sx of [-1, 1]) box(0.03, 0.3, D - 0.3, sx * (W / 2 + 0.005), y + 0.1, 0, k.win);
        if (f > 0) for (const sx of [-1, 1]) {
          T(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16, 1, false, sx > 0 ? 0 : -Math.PI / 2, Math.PI / 2).translate(sx * (W / 2 - 0.25), y0 + y, D / 2 - 0.25), body);
          T(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 16, 1, true, sx > 0 ? 0 : -Math.PI / 2, Math.PI / 2).translate(sx * (W / 2 - 0.25), y0 + y + 0.13, D / 2 - 0.25), rail);
        }
      }
      const top = 0.55 + floors * fh;
      flatTop(W, D, top);
      return top + 0.4 + y0;
    }
    if (v3 === 8) {
      // Stacked homes: boxy flats in bright colours piled up and shifted, like building blocks.
      const cols = ["#f2a62a", "#4a9ad8", "#e86a4a", "#5ab87a", "#f2f0ea", "#d85a8a"].map(c => k.c(c, 0.75));
      const blocks: [number, number, number, number][] = [[-0.6, 0, -0.3, 0], [0.7, 0, 0.2, 1], [-0.3, 1, 0.4, 2], [0.8, 1, -0.5, 3], [0.0, 2, -0.1, 4], [-0.8, 2, 0.6, 5], [0.5, 3, 0.3, 0]];
      box(2.9, 0.12, 2.4, 0, 0, 0, k.c("#cfc6b6", 0.85));
      // (A concrete stair core through the middle holds the homes up.)
      box(0.8, 4 * 0.6 + 0.1, 0.8, 0.1, 0.12, 0.05, k.c("#d8d4cc", 0.85));
      for (let f = 0; f < 4; f++) box(0.12, 0.4, 0.03, 0.1, 0.25 + f * 0.6, 0.465, k.win);
      for (const [px, pz] of [[-1.15, -0.75], [1.25, 0.65], [-1.35, 0.95], [1.3, -0.95]]) box(0.08, 0.62, 0.08, px, 0.12, pz, k.c("#b8b4ac", 0.7));
      let top = 0;
      for (const [bx, lvl, bz, c] of blocks) {
        const y = 0.12 + lvl * 0.6, w = 1.3, d = 1.1;
        box(w, 0.58, d, bx, y, bz, cols[c]);
        box(w - 0.3, 0.32, 0.03, bx, y + 0.12, bz + d / 2 + 0.005, k.win);
        for (const sx of [-1, 1]) box(0.03, 0.32, d - 0.4, bx + sx * (w / 2 + 0.005), y + 0.12, bz, k.win);
        box(w - 0.4, 0.3, 0.03, bx, y + 0.13, bz - d / 2 - 0.005, k.win);
        top = Math.max(top, y + 0.58);
      }
      return top + 0.1 + y0;
    }
    if (v3 === 9) {
      // A green tower: dark timber and glass, every balcony full of plants and little trees.
      const W = 2.6, D = 2.2, floors = 6, fh = 0.5, timber = k.c("#5a4a3a", 0.8), leaf = k.c("#3a8a3a", 0.9), leaf2 = k.c("#5aa84a", 0.9);
      podium(W, D, 0.5, "#4a4038");
      box(W - 0.2, floors * fh, D - 0.2, 0, 0.5, 0, timber);
      for (let f = 0; f < floors; f++) {
        const y = 0.5 + f * fh;
        box(W - 0.4, 0.32, 0.03, 0, y + 0.08, D / 2 - 0.095, k.win); box(W - 0.4, 0.32, 0.03, 0, y + 0.08, -D / 2 + 0.095, k.win);
        for (const sx of [-1, 1]) box(0.03, 0.32, D - 0.4, sx * (W / 2 - 0.095), y + 0.08, 0, k.win);
        box(W + 0.3, 0.05, D + 0.3, 0, y, 0, k.c("#e8e4da", 0.8));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + f; T(new THREE.SphereGeometry(0.13 + (i % 2) * 0.05, 7, 5).translate(Math.cos(a) * 1.35, y0 + y + 0.15, Math.sin(a) * 1.15), i % 2 ? leaf : leaf2); }
      }
      const top = 0.5 + floors * fh;
      box(W + 0.3, 0.08, D + 0.3, 0, top, 0, k.c("#e8e4da", 0.8));
      for (let i = 0; i < 3; i++) T(new THREE.SphereGeometry(0.3, 8, 6).translate(-0.7 + i * 0.7, y0 + top + 0.35, (i % 2) * 0.4 - 0.2), leaf);
      return top + 0.6 + y0;
    }
    if (v3 === 3) {
      // A colourful block: a facade of coloured panels round deep loggias, a glazed corner.
      const W = 2.9, D = 2.3, floors = 5 + Math.floor(r() * 2), fh = 0.5, gh = 0.55;
      const cols = [pick(["#e86a4a", "#f2a62a", "#4a9ad8", "#5ab87a", "#d85a8a", "#8a6ad8"]), pick(["#f6e2a0", "#cfe0ee", "#f2cfc4", "#d6e6c8"])].map(c => k.c(c, 0.75));
      box(W, gh, D, 0, 0, 0, k.c("#2e333c", 0.5));
      box(W - 0.4, gh - 0.1, 0.03, 0, 0.04, D / 2 + 0.01, k.win);
      box(W, floors * fh, D, 0, gh, 0, k.c("#f2f0ea", 0.85));
      for (let f = 0; f < floors; f++) for (let b = 0; b < 4; b++) {
        const x = -W / 2 + (b + 0.5) * (W / 4), y = gh + f * fh;
        if ((b + f) % 2 === 0) { box(W / 4 - 0.04, fh - 0.06, 0.04, x, y + 0.03, D / 2 + 0.02, cols[(b + f) % 4 === 0 ? 0 : 1]); windowAt(x, y + 0.12, D / 2 + 0.04, 0.3, 0.28, "z", 1, { bars: false, sill: false }); }
        else { box(W / 4 - 0.1, fh - 0.12, 0.2, x, y + 0.06, D / 2 - 0.1, k.win); box(W / 4 - 0.06, 0.18, 0.02, x, y + 0.03, D / 2 + 0.01, k.c("#bfe0f0", 0.1, 0.3)); }
      }
      for (let f = 0; f < floors; f++) { box(0.04, fh - 0.1, D - 0.5, W / 2 + 0.012, gh + f * fh + 0.05, 0, k.win); box(0.04, fh - 0.1, D - 0.5, -W / 2 - 0.012, gh + f * fh + 0.05, 0, k.win); }
      const top = gh + floors * fh;
      box(W + 0.1, 0.1, D + 0.1, 0, top, 0, cols[0]);
      flatTop(W, D, top + 0.1);
      return top + 0.45 + y0;
    }
    if (v3 === 1) {
      // A modern block: white bands of floor slabs, ribbon windows, wrap-round glass balconies
      // on one corner, a coloured feature strip and a roof garden.
      const W = 2.9, D = 2.3, floors = 5 + Math.floor(r() * 3), fh = 0.5, gh = 0.55, accent = k.c(pick(["#e8a03a", "#3a8ad8", "#d85a4a", "#4aa87a", "#8a6ad8"]), 0.6);
      box(W - 0.2, gh, D - 0.2, 0, 0, 0, k.c("#3a3f4a", 0.5));
      box(W - 0.6, gh - 0.1, 0.03, 0, 0.04, D / 2 - 0.09, k.win);
      for (let f = 0; f < floors; f++) {
        const y = gh + f * fh;
        box(W + 0.08, 0.08, D + 0.08, 0, y, 0, k.c("#f6f6f2", 0.7));
        box(W - 0.05, fh - 0.08, D - 0.05, 0, y + 0.08, 0, k.c("#e9e6e0", 0.85));
        box(W - 0.5, 0.26, 0.03, -0.15, y + 0.18, D / 2 + 0.005, k.win);
        box(0.03, 0.26, D - 0.5, -W / 2 - 0.005, y + 0.18, 0, k.win);
        box(0.03, 0.26, D - 0.5, W / 2 + 0.005, y + 0.18, 0, k.win);
        if (f > 0) { box(0.9, 0.04, 0.5, W / 2 - 0.4, y, D / 2 + 0.25, k.c("#f6f6f2", 0.7)); box(0.9, 0.2, 0.02, W / 2 - 0.4, y + 0.04, D / 2 + 0.49, k.c("#bfe0f0", 0.1, 0.3)); box(0.02, 0.2, 0.5, W / 2 + 0.04, y + 0.04, D / 2 + 0.25, k.c("#bfe0f0", 0.1, 0.3)); }
      }
      const top = gh + floors * fh;
      box(0.3, top - gh, 0.04, -W / 2 + 0.35, gh, D / 2 + 0.05, accent);
      box(W + 0.08, 0.08, D + 0.08, 0, top, 0, k.c("#f6f6f2", 0.7));
      box(W - 0.6, 0.08, D - 0.8, -0.2, top + 0.08, 0, k.c("#6aa84a", 0.95));
      for (let i = 0; i < 4; i++) T(new THREE.SphereGeometry(0.13, 8, 6).scale(1, 0.8, 1).translate(-0.9 + i * 0.5, y0 + top + 0.22, -0.3 + (i % 2) * 0.5), k.c("#3a8a3a", 0.9));
      box(0.6, 0.35, 0.5, W / 2 - 0.5, top + 0.08, -D / 2 + 0.4, k.c("#d8d4cc", 0.8));
      return top + 0.45 + y0;
    }
    if (v3 === 2) {
      // A classic apartment house: stone, tall windows with heads, little iron balconies, a
      // deep cornice and a slate mansard roof with dormers.
      const W = 3.0, D = 2.2, floors = 4 + Math.floor(r() * 2), fh = 0.55, stone = k.c(pick(["#ece2cc", "#e8dcc8", "#f0e8d8", "#e2d6c0"]), 0.85);
      box(W, 0.5, D, 0, 0, 0, k.c("#cfc4b0", 0.9));
      for (let i = 0; i < 3; i++) box(W + 0.01, 0.015, D + 0.01, 0, 0.12 + i * 0.13, 0, k.c("#b8ad98", 0.9));
      door(0, D / 2, 0.4, 0.42, doorC, 0.0);
      for (const wx of [-1.0, -0.5, 0.5, 1.0]) windowAt(wx, 0.1, D / 2, 0.26, 0.3, "z", 1, { bars: false });
      box(W, floors * fh, D, 0, 0.5, 0, stone);
      for (let f = 0; f < floors; f++) {
        const y = 0.5 + f * fh;
        for (const wx of [-1.08, -0.54, 0, 0.54, 1.08]) { windowAt(wx, y + 0.08, D / 2, 0.26, 0.38, "z", 1, { head: true }); if (f % 2 === 0 && Math.abs(wx) < 0.6) balcony(wx, y + 0.04, D / 2, 0.34, false); }
        for (const sx of [-1, 1]) for (const wz of [-0.55, 0.55]) windowAt(sx * W / 2, y + 0.08, wz, 0.26, 0.38, "x", sx, { head: true });
      }
      const top = 0.5 + floors * fh;
      box(W + 0.2, 0.1, D + 0.2, 0, top, 0, trim);
      for (let i = 0; i < 30; i++) box(0.035, 0.04, 0.035, -W / 2 + (i + 0.5) * (W / 30), top - 0.04, D / 2 + 0.06, trim);
      hip(W - 0.1, D - 0.1, top + 0.1, 0.55, roof);
      for (const dx of [-0.9, 0, 0.9]) { box(0.3, 0.28, 0.3, dx, top + 0.12, D / 2 - 0.25, k.c(wallC, 0.85)); windowAt(dx, top + 0.16, D / 2 - 0.1, 0.18, 0.2, "z", 1, { sill: false }); hip(0.3, 0.3, top + 0.4, 0.14, roof, dx, D / 2 - 0.25); }
      chimney(-W * 0.3, -0.3, top + 0.4, 0.5, k.c(pick(BRICKS), 0.9));
      return top + 0.7 + y0;
    }
    // An apartment block: a glazed lobby, a grid of windows with balconies, a cornice, roof plant.
    const W = 3.0, D = 2.4, floors = 4 + Math.floor(r() * 3), fh = 0.5, gh = 0.6;
    const brick = r() < 0.5, body = brick ? k.c(pick(BRICKS), 0.9) : wall, glassy = r() < 0.5;
    box(W, gh, D, 0, 0, 0, k.c("#d8d2c6", 0.8));
    box(1.2, gh - 0.1, 0.03, 0, 0.04, D / 2 + 0.01, k.win);
    box(1.4, 0.06, 0.6, 0, gh - 0.06, D / 2 + 0.3, k.c("#3a3f4a", 0.5));
    for (const sx of [-1, 1]) box(0.04, gh - 0.06, 0.04, sx * 0.66, 0, D / 2 + 0.56, metal);
    for (const wx of [-1.15, 1.15]) windowAt(wx, 0.12, D / 2, 0.4, 0.36, "z", 1, { bars: false });
    box(W, floors * fh, D, 0, gh, 0, body);
    for (let f = 0; f < floors; f++) {
      const y = gh + f * fh;
      box(W + 0.03, 0.03, D + 0.03, 0, y, 0, trim);
      for (const wx of [-1.08, -0.36, 0.36, 1.08]) windowAt(wx, y + 0.1, D / 2, 0.32, 0.32, "z", 1, { bars: false });
      for (const wx of [-1.08, 1.08]) windowAt(wx, y + 0.1, -D / 2, 0.32, 0.32, "z", -1, { bars: false });
      for (const sx of [-1, 1]) for (const wz of [-0.6, 0.6]) windowAt(sx * W / 2, y + 0.1, wz, 0.3, 0.32, "x", sx, { bars: false });
      if (f > 0) for (const wx of [-0.72, 0.72]) balcony(wx, y, D / 2, 0.62, glassy);
    }
    const top = gh + floors * fh;
    box(W + 0.12, 0.08, D + 0.12, 0, top, 0, trim);
    flatTop(W, D, top + 0.08);
    // A water tank on legs.
    if (r() < 0.6) { const tx = -W * 0.25; for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) box(0.03, 0.3, 0.03, tx + lx, top + 0.2, lz, metal); T(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 14).translate(tx, y0 + top + 0.66, 0), k.c("#8a6a4a", 0.8)); T(new THREE.ConeGeometry(0.22, 0.12, 14).translate(tx, y0 + top + 0.88, 0), k.c("#6a4a3a", 0.8)); }
    return top + 0.5 + y0;
  }

  if (lv === 4) {
    const v4 = design(seed, 4, 10);
    if (v4 === 4) {
      // Twin office towers joined by a glass sky bridge.
      const fh = 0.42, fa = 8 + Math.floor(r() * 2), fb = fa + 2;
      podium(2.9, 2.5, 0.6);
      const ta = tower(1.1, 1.5, 0.6, fa, fh, -0.8, 0), tb = tower(1.1, 1.5, 0.6, fb, fh, 0.8, 0);
      box(0.6, 0.36, 0.6, 0, 0.6 + (fa - 3) * fh, 0, glass); box(0.62, 0.05, 0.62, 0, 0.6 + (fa - 3) * fh, 0, k.c("#d8dce2", 0.5, 0.3));
      flatTop(1.1, 1.5, ta, -0.8, 0, false); flatTop(1.1, 1.5, tb, 0.8, 0, true);
      return tb + 0.4 + y0;
    }
    if (v4 === 5) {
      // An octagonal glass tower on a round plinth.
      const floors = 9 + Math.floor(r() * 3), fh = 0.42;
      T(new THREE.CylinderGeometry(1.45, 1.5, 0.6, 24).translate(0, y0 + 0.3, 0), k.c("#d6d0c4", 0.8));
      box(1.6, 0.45, 0.03, 0, 0.08, 1.46, k.win);
      const top = prism(1.15, 8, 0.6, floors, fh, 1, Math.PI / 8);
      T(new THREE.CylinderGeometry(0.9, 1.2, 0.3, 8).rotateY(Math.PI / 8).translate(0, y0 + top + 0.15, 0), k.c("#e8e4da", 0.5, 0.3));
      return top + 0.4 + y0;
    }
    if (v4 === 6) {
      // A diagrid office: glass walls crossed by big white diagonal braces.
      const W = 2.5, D = 2.3, floors = 10, fh = 0.42, H = floors * fh, white = k.c("#f0f0ec", 0.5);
      podium(W + 0.3, D + 0.3, 0.6);
      const top = tower(W, D, 0.6, floors, fh);
      const seg = H / 3;
      for (let j = 0; j < 3; j++) for (const sgn of [-1, 1]) {
        const len = Math.hypot(W, seg), ang = Math.atan2(seg, W) * sgn;
        for (const sz of [-1, 1]) T(new THREE.BoxGeometry(len, 0.07, 0.05).rotateZ(ang).translate(0, y0 + 0.6 + j * seg + seg / 2, sz * (D / 2 + 0.05)), white);
        const lenD = Math.hypot(D, seg), angD = Math.atan2(seg, D) * sgn;
        for (const sx of [-1, 1]) T(new THREE.BoxGeometry(0.05, 0.07, lenD).rotateX(-angD).translate(sx * (W / 2 + 0.05), y0 + 0.6 + j * seg + seg / 2, 0), white);
      }
      flatTop(W, D, top);
      return top + 0.4 + y0;
    }
    if (v4 === 7) {
      // Shifted boxes: three glass blocks stacked, each sliding out over the one below.
      const fh = 0.42;
      podium(2.6, 2.4, 0.6);
      let top = tower(2.2, 2.0, 0.6, 4, fh, -0.2, 0);
      box(2.3, 0.08, 2.1, -0.2, top, 0, k.c("#e8e4da", 0.6));
      top = tower(2.2, 2.0, top + 0.08, 4, fh, 0.3, 0.15);
      box(2.3, 0.08, 2.1, 0.3, top, 0.15, k.c("#e8e4da", 0.6));
      top = tower(2.0, 1.8, top + 0.08, 3, fh, -0.1, -0.15);
      flatTop(2.0, 1.8, top, -0.1, -0.15);
      return top + 0.4 + y0;
    }
    if (v4 === 8) {
      // A grand hotel: stone, rows of arched windows, a canopy over the door, flags, and a
      // lit sign on the roof.
      const W = 2.8, D = 2.4, floors = 8, fh = 0.46, stone = k.c(pick(["#efe6d4", "#e8dcc8", "#f2eee4"]), 0.85);
      box(W + 0.1, 0.7, D + 0.1, 0, 0, 0, k.c("#cfc4b0", 0.85));
      box(1.0, 0.55, 0.03, 0, 0.06, D / 2 + 0.06, k.win);
      box(1.3, 0.06, 0.8, 0, 0.62, D / 2 + 0.4, k.c("#8a2a2a", 0.6));
      for (const sx of [-1, 1]) { box(0.03, 0.62, 0.03, sx * 0.6, 0, D / 2 + 0.78, k.c("#d8b060", 0.4, 0.6)); box(0.02, 0.7, 0.02, sx * 1.2, 0.7, D / 2 + 0.1, metal); box(0.25, 0.16, 0.01, sx * 1.2 + 0.13, 1.22, D / 2 + 0.1, k.c(sx > 0 ? "#2f6fff" : "#e84a4a", 0.6)); }
      box(W, floors * fh, D, 0, 0.7, 0, stone);
      for (let f = 0; f < floors; f++) for (const wx of [-1.05, -0.35, 0.35, 1.05]) {
        windowAt(wx, 0.7 + f * fh + 0.06, D / 2, 0.24, 0.3, "z", 1, { head: true });
        windowAt(wx, 0.7 + f * fh + 0.06, -D / 2, 0.24, 0.3, "z", -1, { head: true });
        for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.7 + f * fh + 0.06, wx * 0.8, 0.24, 0.3, "x", sx, { head: true });
      }
      const top = 0.7 + floors * fh;
      box(W + 0.2, 0.12, D + 0.2, 0, top, 0, trim);
      flatTop(W, D, top + 0.12, 0, 0, false);
      box(1.6, 0.3, 0.06, 0, top + 0.3, D / 2 - 0.3, k.c("#ff4f8b", 0.4));
      for (const sx of [-1, 1]) box(0.04, 0.3, 0.04, sx * 0.7, top + 0.12, D / 2 - 0.32, metal);
      return top + 0.7 + y0;
    }
    if (v4 === 9) {
      // A curved office: a half-round glass front on a square back block.
      const floors = 9, fh = 0.42;
      podium(2.8, 2.5, 0.6);
      const top = tower(2.4, 1.0, 0.6, floors, fh, 0, -0.65);
      T(new THREE.CylinderGeometry(1.2, 1.2, floors * fh, 24, 1, false, -Math.PI / 2, Math.PI).translate(0, y0 + 0.6 + (floors * fh) / 2, -0.15), glass);
      for (let f = 0; f < floors; f++) {
        T(new THREE.CylinderGeometry(1.24, 1.24, 0.05, 24, 1, false, -Math.PI / 2, Math.PI).translate(0, y0 + 0.6 + f * fh, -0.15), k.c("#d8dce2", 0.5, 0.3));
        T(new THREE.CylinderGeometry(1.215, 1.215, fh * 0.5, 24, 1, true, -Math.PI / 2, Math.PI).translate(0, y0 + 0.6 + f * fh + fh * 0.48, -0.15), k.win);
      }
      T(new THREE.CylinderGeometry(1.26, 1.26, 0.12, 24, 1, false, -Math.PI / 2, Math.PI).translate(0, y0 + top + 0.06, -0.15), k.c("#e8e4da", 0.5, 0.3));
      flatTop(2.4, 1.0, top, 0, -0.65);
      return top + 0.4 + y0;
    }
    if (v4 === 3) {
      // A terraced office: two glass volumes, the upper one set back, with green roof terraces.
      const W = 2.8, D = 2.6, f1 = 4 + Math.floor(r() * 2), f2 = 4 + Math.floor(r() * 3), fh = 0.44;
      box(W + 0.1, 0.6, D + 0.1, 0, 0, 0, k.c("#cfc8bc", 0.75));
      box(W - 0.3, 0.45, 0.03, 0, 0.08, D / 2 + 0.06, k.win);
      let top = tower(W, D, 0.6, f1, fh);
      box(W + 0.06, 0.08, D + 0.06, 0, top, 0, k.c("#e8e4da", 0.6));
      box(W - 0.2, 0.06, D * 0.4, 0, top + 0.08, D * 0.28, k.c("#6aa84a", 0.95));
      for (let i = 0; i < 5; i++) T(new THREE.SphereGeometry(0.12, 8, 6).scale(1, 0.8, 1).translate(-1.0 + i * 0.5, y0 + top + 0.2, D * 0.33), k.c("#3a8a3a", 0.9));
      box(W - 0.1, 0.25, 0.02, 0, top + 0.08, D / 2 + 0.02, k.c("#bfe0f0", 0.1, 0.3));
      const t2 = tower(W * 0.72, D * 0.55, top + 0.08, f2, fh);
      box(W * 0.72 + 0.06, 0.1, D * 0.55 + 0.06, 0, t2, 0, k.c("#e8e4da", 0.6));
      flatTop(W * 0.72, D * 0.55, t2 + 0.1, 0, 0, true);
      return t2 + 0.5 + y0;
    }
    if (v4 === 1) {
      // A concrete office with deep vertical fins and a grid of windows, on a dark glass base.
      const W = 2.7, D = 2.5, floors = 7 + Math.floor(r() * 4), fh = 0.42, con = k.c(pick(["#e4e0d8", "#d8d4cc", "#ece8e0"]), 0.8);
      box(W, 0.7, D, 0, 0, 0, k.c("#2e333c", 0.4, 0.3));
      box(W - 0.2, 0.6, 0.03, 0, 0.05, D / 2 + 0.01, k.win);
      box(W, floors * fh, D, 0, 0.7, 0, con);
      for (let f = 0; f < floors; f++) {
        const y = 0.7 + f * fh;
        box(W - 0.1, fh * 0.6, 0.03, 0, y + fh * 0.2, D / 2 + 0.005, k.win);
        box(W - 0.1, fh * 0.6, 0.03, 0, y + fh * 0.2, -D / 2 - 0.005, k.win);
        box(0.03, fh * 0.6, D - 0.1, W / 2 + 0.005, y + fh * 0.2, 0, k.win);
        box(0.03, fh * 0.6, D - 0.1, -W / 2 - 0.005, y + fh * 0.2, 0, k.win);
      }
      const nf = 8;
      for (let i = 0; i <= nf; i++) for (const sz of [-1, 1]) { box(0.06, floors * fh, 0.16, -W / 2 + (i / nf) * W, 0.7, sz * (D / 2 + 0.07), con); box(0.16, floors * fh, 0.06, sz * (W / 2 + 0.07), 0.7, -D / 2 + (i / nf) * D, con); }
      const top = 0.7 + floors * fh;
      flatTop(W + 0.2, D + 0.2, top);
      return top + 0.45 + y0;
    }
    if (v4 === 2) {
      // A brick office: a stone base, big framed windows in a regular grid, a stone cornice.
      const W = 2.8, D = 2.5, floors = 6 + Math.floor(r() * 3), fh = 0.48, brk = k.c(pick(BRICKS), 0.9);
      box(W + 0.06, 0.65, D + 0.06, 0, 0, 0, k.c("#cfc6b4", 0.85));
      box(W - 0.4, 0.5, 0.03, 0, 0.08, D / 2 + 0.04, k.win);
      box(W, floors * fh, D, 0, 0.65, 0, brk);
      for (let f = 0; f < floors; f++) for (const wx of [-1.05, -0.35, 0.35, 1.05]) {
        windowAt(wx, 0.65 + f * fh + 0.08, D / 2, 0.44, 0.34, "z", 1, {});
        windowAt(wx, 0.65 + f * fh + 0.08, -D / 2, 0.44, 0.34, "z", -1, {});
        for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.65 + f * fh + 0.08, wx * 0.72, 0.36, 0.34, "x", sx, {});
      }
      const top = 0.65 + floors * fh;
      box(W + 0.18, 0.14, D + 0.18, 0, top, 0, k.c("#e4dccb", 0.8));
      flatTop(W, D, top + 0.14);
      return top + 0.5 + y0;
    }
    const W = 2.8, D = 2.6, floors = 6 + Math.floor(r() * 4), fh = 0.42;
    box(W + 0.2, 0.75, D + 0.2, 0, 0, 0, k.c("#d6d0c4", 0.8));
    box(W - 0.4, 0.55, 0.03, 0, 0.06, D / 2 + 0.11, k.win);
    box(1.2, 0.05, 0.5, 0, 0.62, D / 2 + 0.35, k.c("#3a3f4a", 0.5));
    const top = tower(W, D, 0.75, floors, fh);
    box(W + 0.08, 0.1, D + 0.08, 0, top, 0, k.c("#d8dce2", 0.5, 0.3));
    box(W * 0.5, 0.35, D * 0.5, 0, top + 0.1, 0, k.c("#c8ccd2", 0.6, 0.3));
    flatTop(W, D, top + 0.1, 0, 0, true);
    return top + 0.5 + y0;
  }
  const v5 = design(seed, 5, 10);
  if (v5 === 4) {
    // A tapering glass obelisk: four sides narrowing all the way up to a sharp tip.
    const floors = 24, fh = 0.4;
    podium(2.9, 2.9, 0.8);
    const top = prism(1.75, 4, 0.8, floors, fh, 0.45, Math.PI / 4);
    T(new THREE.CylinderGeometry(0.01, 0.8, 1.4, 4).rotateY(Math.PI / 4).translate(0, y0 + top + 0.7, 0), glass);
    T(new THREE.SphereGeometry(0.06, 8, 6).translate(0, y0 + top + 1.45, 0), k.c("#ff3a3a", 0.4));
    return top + 1.5 + y0;
  }
  if (v5 === 5) {
    // A tiered spire: round tiers, each smaller, rings of gold between, a needle on top.
    const fh = 0.4, gold = k.c("#e8b020", 0.3, 0.8);
    podium(2.9, 2.9, 0.8);
    let top = prism(1.3, 24, 0.8, 9, fh);
    T(new THREE.CylinderGeometry(1.3, 1.36, 0.14, 24).translate(0, y0 + top + 0.07, 0), gold);
    top = prism(1.0, 24, top + 0.14, 7, fh);
    T(new THREE.CylinderGeometry(1.0, 1.06, 0.14, 24).translate(0, y0 + top + 0.07, 0), gold);
    top = prism(0.7, 24, top + 0.14, 6, fh);
    T(new THREE.CylinderGeometry(0.2, 0.72, 0.8, 24).translate(0, y0 + top + 0.4, 0), gold);
    T(new THREE.ConeGeometry(0.06, 1.6, 8).translate(0, y0 + top + 1.6, 0), gold);
    return top + 2.4 + y0;
  }
  if (v5 === 6) {
    // Twin skyscrapers joined high up by a two-storey sky bridge.
    const fh = 0.4, f = 22;
    podium(2.9, 2.6, 0.8);
    const ta = tower(1.1, 1.4, 0.8, f, fh, -0.85, 0), tb = tower(1.1, 1.4, 0.8, f - 2, fh, 0.85, 0);
    const by = 0.8 + (f - 8) * fh;
    box(0.62, 0.7, 0.7, 0, by, 0, glass); box(0.64, 0.06, 0.72, 0, by, 0, k.c("#d8dce2", 0.5, 0.3)); box(0.64, 0.06, 0.72, 0, by + 0.7, 0, k.c("#d8dce2", 0.5, 0.3));
    for (const [tx, tt] of [[-0.85, ta], [0.85, tb]] as const) { T(new THREE.CylinderGeometry(0.01, 0.6, 0.8, 4).rotateY(Math.PI / 4).translate(tx, y0 + tt + 0.4, 0), glass); T(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 6).translate(tx, y0 + tt + 1.1, 0), metal); }
    return ta + 1.6 + y0;
  }
  if (v5 === 7) {
    // A sail tower: a tall curved glass sail against a white spine.
    const floors = 24, fh = 0.4, H = floors * fh, white = k.c("#f0f0ec", 0.5);
    podium(2.9, 2.9, 0.8);
    // The spine: a slim white wall with a column of windows down each face.
    box(0.4, H + 1.0, 2.2, -1.0, 0.8, 0, white);
    for (let f = 0; f < floors; f++) for (const sx of [-1, 1]) for (const wz of [-0.6, 0, 0.6]) box(0.03, fh * 0.5, 0.36, -1.0 + sx * 0.205, 0.8 + f * fh + fh * 0.25, wz, k.win);
    for (let f = 0; f < floors; f++) for (const sz of [-1, 1]) box(0.26, fh * 0.5, 0.03, -1.0, 0.8 + f * fh + fh * 0.25, sz * 1.105, k.win);
    for (let f = 0; f < floors; f++) {
      const y = 0.8 + f * fh, sc = 1 - (f / floors) * 0.35;
      T(new THREE.CylinderGeometry(1.5 * sc, 1.5 * sc, fh - 0.04, 20, 1, false, 0, Math.PI).scale(0.9, 1, 1).translate(-0.8, y0 + y + fh / 2, 0), glass);
      T(new THREE.CylinderGeometry(1.5 * sc + 0.02, 1.5 * sc + 0.02, fh * 0.5, 20, 1, true, 0, Math.PI).scale(0.9, 1, 1).translate(-0.8, y0 + y + fh * 0.48, 0), k.win);
      T(new THREE.CylinderGeometry(1.5 * sc + 0.04, 1.5 * sc + 0.04, 0.04, 20, 1, false, 0, Math.PI).scale(0.9, 1, 1).translate(-0.8, y0 + y, 0), white);
    }
    T(new THREE.CylinderGeometry(0.02, 0.04, 1.4, 6).translate(-1.0, y0 + 0.8 + H + 1.7, 0), metal);
    return 0.8 + H + 2.4 + y0;
  }
  if (v5 === 8) {
    // A triangle tower: three glass faces, the corners cut, a sloped top.
    const floors = 23, fh = 0.4;
    podium(2.9, 2.9, 0.8);
    const top = prism(1.65, 3, 0.8, floors, fh, 0.9, Math.PI / 6);
    T(new THREE.CylinderGeometry(0.3, 1.5, 1.0, 3).rotateY(Math.PI / 6).translate(0, y0 + top + 0.5, 0), glass);
    T(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 6).translate(0, y0 + top + 1.6, 0), metal);
    return top + 2.2 + y0;
  }
  if (v5 === 9) {
    // A bundled tower: four square glass tubes of different heights, side by side.
    const fh = 0.4, hs = [24, 19, 15, 21];
    podium(2.9, 2.9, 0.8);
    let top = 0;
    [[-0.62, -0.62], [0.62, -0.62], [0.62, 0.62], [-0.62, 0.62]].forEach(([cx, cz], i) => {
      const t = tower(1.2, 1.2, 0.8, hs[i], fh, cx, cz);
      box(1.24, 0.12, 1.24, cx, t, cz, k.c("#e8e4da", 0.4, 0.4));
      top = Math.max(top, t);
    });
    T(new THREE.CylinderGeometry(0.02, 0.04, 1.6, 6).translate(-0.62, y0 + top + 0.9, -0.62), metal);
    T(new THREE.SphereGeometry(0.05, 8, 6).translate(-0.62, y0 + top + 1.72, -0.62), k.c("#ff3a3a", 0.4));
    return top + 1.8 + y0;
  }
  if (v5 === 3) {
    // A twisting tower: stacked floor plates, each turned a little more, with a golden crown.
    const floors = 22 + Math.floor(r() * 6), fh = 0.4, gold = k.c("#e8b020", 0.3, 0.8);
    box(2.9, 0.8, 2.9, 0, 0, 0, k.c("#d8d2c6", 0.75));
    box(2.4, 0.6, 0.03, 0, 0.06, 1.46, k.win);
    for (let f = 0; f < floors; f++) {
      const y = 0.8 + f * fh, a = f * 0.035;
      const slab = new THREE.BoxGeometry(2.2, 0.06, 2.2).rotateY(a).translate(0, y0 + y, 0);
      T(slab, k.c("#e8ecf0", 0.4, 0.3));
      T(new THREE.BoxGeometry(2.12, fh - 0.06, 2.12).rotateY(a).translate(0, y0 + y + fh / 2 + 0.01, 0), glass);
      T(new THREE.BoxGeometry(2.13, fh * 0.45, 2.13).rotateY(a).translate(0, y0 + y + fh * 0.55, 0), k.win);
    }
    const top = 0.8 + floors * fh;
    T(new THREE.CylinderGeometry(0.6, 1.0, 0.6, 8).rotateY(floors * 0.035).translate(0, y0 + top + 0.3, 0), gold);
    T(new THREE.ConeGeometry(0.1, 1.6, 8).translate(0, y0 + top + 1.4, 0), gold);
    return top + 2.2 + y0;
  }
  if (v5 === 1) {
    // A round glass tower: rings of floor bands, a crown ring and a spire.
    const R = 1.25, floors = 18 + Math.floor(r() * 8), fh = 0.4;
    box(2.9, 0.8, 2.9, 0, 0, 0, k.c("#cfc8bc", 0.7));
    box(2.4, 0.6, 0.03, 0, 0.06, 1.46, k.win);
    T(new THREE.CylinderGeometry(R, R * 1.04, floors * fh, 28).translate(0, y0 + 0.8 + (floors * fh) / 2, 0), glass);
    for (let f = 0; f < floors; f++) {
      const y = 0.8 + f * fh;
      T(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.05, 28).translate(0, y0 + y, 0), k.c("#d8dce2", 0.5, 0.3));
      T(new THREE.CylinderGeometry(R + 0.008, R + 0.008, fh * 0.5, 28, 1, true).translate(0, y0 + y + fh * 0.45, 0), k.win);
    }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; T(new THREE.BoxGeometry(0.03, floors * fh, 0.03).translate(Math.cos(a) * (R + 0.02), y0 + 0.8 + (floors * fh) / 2, Math.sin(a) * (R + 0.02)), k.c("#c8ccd2", 0.4, 0.5)); }
    const top = 0.8 + floors * fh;
    T(new THREE.CylinderGeometry(R * 0.85, R + 0.05, 0.4, 28).translate(0, y0 + top + 0.2, 0), k.c("#e8e4da", 0.4, 0.4));
    T(new THREE.ConeGeometry(0.12, 2.0, 10).translate(0, y0 + top + 1.4, 0), metal);
    T(new THREE.SphereGeometry(0.05, 8, 6).translate(0, y0 + top + 2.45, 0), k.c("#ff3a3a", 0.4));
    return top + 2.5 + y0;
  }
  if (v5 === 2) {
    // A slim slab tower: dark glass with white frames, an offset side block, a helipad on top.
    const W = 2.6, D = 1.7, floors = 20 + Math.floor(r() * 6), fh = 0.4, darkGlass = k.c(pick(["#2f4a62", "#3a4a5a", "#24384a"]), 0.1, 0.6);
    box(W + 0.3, 0.8, D + 0.8, 0, 0, 0, k.c("#d8d2c6", 0.75));
    box(W, 0.6, 0.03, 0, 0.06, (D + 0.8) / 2 + 0.01, k.win);
    box(W, floors * fh, D, 0, 0.8, 0, darkGlass);
    for (let f = 0; f < floors; f++) { box(W + 0.03, 0.04, D + 0.03, 0, 0.8 + f * fh, 0, k.c("#f0f0ec", 0.5)); box(W - 0.06, fh * 0.45, D + 0.03, 0, 0.8 + f * fh + fh * 0.3, 0, k.win); box(W + 0.03, fh * 0.45, D - 0.06, 0, 0.8 + f * fh + fh * 0.3, 0, k.win); }
    // (White corner posts, so every side shows its windows.)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, floors * fh, 0.1, sx * W / 2, 0.8, sz * D / 2, k.c("#f0f0ec", 0.5));
    const sideH = Math.floor(floors * 0.55) * fh;
    box(0.7, sideH, D * 0.8, W / 2 + 0.3, 0.8, 0.1, k.c("#e8e4da", 0.7));
    for (let f = 0; f * fh < sideH - 0.2; f++) box(0.5, 0.18, 0.03, W / 2 + 0.3, 0.9 + f * fh, 0.1 + D * 0.4 + 0.01, k.win);
    const top = 0.8 + floors * fh;
    box(W + 0.1, 0.12, D + 0.1, 0, top, 0, k.c("#f0f0ec", 0.5));
    T(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 24).translate(0, y0 + top + 0.15, 0), k.c("#4a4f5a", 0.7));
    T(new THREE.RingGeometry(0.42, 0.5, 24).rotateX(-Math.PI / 2).translate(0, y0 + top + 0.19, 0), k.c("#f2c230", 0.6));
    box(0.06, 0.005, 0.4, -0.12, top + 0.185, 0, k.c("#ffffff", 0.6)); box(0.06, 0.005, 0.4, 0.12, top + 0.185, 0, k.c("#ffffff", 0.6)); box(0.24, 0.005, 0.06, 0, top + 0.185, 0, k.c("#ffffff", 0.6));
    return top + 0.4 + y0;
  }
  // A skyscraper: three sections stepping back as they rise, then a crown and a mast.
  const W = 2.6, D = 2.6, fh = 0.4, f1 = 8 + Math.floor(r() * 4), f2 = 6 + Math.floor(r() * 3), f3 = 4 + Math.floor(r() * 3);
  box(W + 0.3, 0.85, D + 0.3, 0, 0, 0, k.c("#cfc8bc", 0.7));
  box(W - 0.3, 0.65, 0.03, 0, 0.06, D / 2 + 0.16, k.win);
  let top = tower(W, D, 0.85, f1, fh);
  box(W + 0.06, 0.08, D + 0.06, 0, top, 0, trim);
  top = tower(W * 0.8, D * 0.8, top + 0.08, f2, fh);
  box(W * 0.8 + 0.06, 0.08, D * 0.8 + 0.06, 0, top, 0, trim);
  top = tower(W * 0.6, D * 0.6, top + 0.08, f3, fh);
  // The crown: a lit band, a pyramid cap and a mast with a red light.
  box(W * 0.6 + 0.08, 0.2, D * 0.6 + 0.08, 0, top, 0, k.c("#e8e4da", 0.4, 0.4));
  T(new THREE.CylinderGeometry(0.01, W * 0.42, 0.7, 4).rotateY(Math.PI / 4).translate(0, y0 + top + 0.55, 0), glass);
  T(new THREE.CylinderGeometry(0.025, 0.04, 1.1, 8).translate(0, y0 + top + 1.45, 0), metal);
  T(new THREE.SphereGeometry(0.05, 8, 6).translate(0, y0 + top + 2.02, 0), k.c("#ff3a3a", 0.4));
  return top + 2.1 + y0;
}

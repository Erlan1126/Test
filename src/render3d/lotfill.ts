// What stands on a town lot nobody has built on yet, so the town always looks finished and
// alive: a lot you can build on now is a fresh, mown lot with a big "for sale" board and its
// plot pegged out; the next lots to open are fenced building sites with a crane; and every
// lot further off is something the town uses in the meantime: a little park, a car park, a
// market or food trucks, a community garden or a sports court. All drawn in code from a few
// shared materials (world.ts mergeStatic merges them by surface, so they cost no extra draws).
import * as THREE from "three";

export type FillKind = "sale" | "site" | "park" | "parking" | "market" | "garden" | "court";
/** The things a lot can be while it waits (not "sale" or "site"). */
export const FILLERS: FillKind[] = ["park", "parking", "market", "garden", "court"];

/** Which filler a lot of the street grid gets: never the same as the lots beside it (one step
 *  along a row moves two kinds on, one step across four, a diagonal one or three). */
export const fillerAt = (gx: number, gz: number): FillKind => FILLERS[(((gx * 2 + gz * 4) % 5) + 5) % 5];

export interface FillKit {
  /** A shared material of this colour (roughness, metalness). */
  c: (color: string, rough?: number, metal?: number) => THREE.Material;
  /** The lot's ground: its rounded lawn slab. */
  slab: () => THREE.BufferGeometry;
  grass: THREE.Material; pave: THREE.Material; earth: THREE.Material; water: THREE.Material;
  wood: THREE.Material; metal: THREE.Material; stone: THREE.Material;
  /** A tree's geometry (trees.ts) and the material every tree shares. */
  tree: (x: number, z: number, s: number, seed: number) => THREE.BufferGeometry;
  natureM: THREE.Material;
  /** The glow under a lot for sale (one shared material that pulses). */
  saleGlow: THREE.Material;
}

const CARS = ["#e8424f", "#2f6fd8", "#f2c230", "#ffffff", "#3aa060", "#ff8a3b", "#7a5ad0", "#3a3f4a", "#5fc2ff"];
const AWN = [["#e8424f", "#ffffff"], ["#2f9bff", "#ffffff"], ["#3aa060", "#fff3d0"], ["#ff8a3b", "#ffffff"], ["#b48cff", "#ffffff"]];

/** Builds what stands on an empty lot into a lot's group (front toward +z, the lot 4.4 across
 *  standing on y = 0). `seed` varies its details. Returns how tall it stands. */
export function fillLot(put: (geo: THREE.BufferGeometry, m: THREE.Material) => void, kind: FillKind, seed: number, k: FillKit): number {
  const sd = Math.abs(Math.floor(seed)) >>> 0;
  let rs = (Math.imul(sd ^ 0x2c1b3c6d, 2654435761) >>> 0) || 7;
  const r = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return (rs % 10000) / 10000; };
  const Y = 0.06;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0) => put(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, Y + y + h / 2, z), m);
  const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 10) => put(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, Y + y + h / 2, z), m);
  const tree = (x: number, z: number, s: number) => put(k.tree(x, z, s, sd * 7 + Math.round(x * 13 + z * 29)), k.natureM);
  // (Every piece in one surface, matte, so a lot merges into as few draws as it can.)
  const C = (c: string, _r?: number, _m?: number): THREE.Material => k.c(c, 0.75, 0);
  const white = C("#ffffff", 0.75), dark = C("#2a2e38", 0.75), leafM = C("#4caf50", 1), tire = C("#24262e", 0.75);
  const flowers = (x: number, z: number, n: number, along: "x" | "z" = "x") => {
    for (let i = 0; i < n; i++) put(new THREE.SphereGeometry(0.08, 6, 4).translate(x + (along === "x" ? i * 0.2 : 0), Y + 0.08, z + (along === "z" ? i * 0.2 : 0)), C(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"][(i + sd) % 4], 0.75));
  };
  const bench = (x: number, z: number, ry: number) => {
    box(0.62, 0.05, 0.2, x, 0.24, z, k.wood, ry);
    put(new THREE.BoxGeometry(0.62, 0.18, 0.04).translate(0, 0, -0.1).rotateY(ry).translate(x, Y + 0.4, z), k.wood);
    for (const s of [-0.24, 0.24]) put(new THREE.BoxGeometry(0.05, 0.24, 0.18).translate(s, 0, 0).rotateY(ry).translate(x, Y + 0.12, z), k.metal);
  };
  /** A little car, nose toward +z (turned by ry). */
  const car = (x: number, z: number, ry: number, c: string) => {
    const body = C(c, 0.5), q = (w: number, h: number, d: number, ox: number, oy: number, oz: number, m: THREE.Material) => put(new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz).rotateY(ry).translate(x, Y, z), m);
    q(0.5, 0.17, 0.98, 0, 0.15, 0, body);
    q(0.44, 0.15, 0.5, 0, 0.3, -0.06, body);
    q(0.45, 0.11, 0.46, 0, 0.3, -0.06, dark);
    for (const [wx, wz] of [[-0.24, 0.3], [0.24, 0.3], [-0.24, -0.3], [0.24, -0.3]]) q(0.06, 0.15, 0.17, wx, 0.08, wz, tire);
  };

  if (kind === "sale") {
    // A fresh, mown lot, its building's plot pegged out with bright tape round a glowing
    // footprint, and a big board on two posts: build here!
    put(k.slab(), k.grass);
    put(new THREE.BoxGeometry(3.0, 0.015, 2.6).translate(0, Y + 0.01, -0.3), k.saleGlow);
    const tape = C("#ff4f8b", 0.75);
    for (const [px, pz] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 1.0], [1.5, 1.0]]) {
      box(0.06, 0.4, 0.06, px, 0, pz, k.wood);
      box(0.16, 0.1, 0.02, px + 0.08, 0.3, pz, tape);
    }
    for (const [w, d, x, z] of [[3.0, 0.02, 0, -1.6], [3.0, 0.02, 0, 1.0], [0.02, 2.6, -1.5, -0.3], [0.02, 2.6, 1.5, -0.3]] as const) box(w, 0.03, d, x, 0.28, z, tape);
    // The board: green frame, a white panel with a little house on it, a pink "sale" strip.
    const bx = -0.85, bz = 1.55;
    for (const px of [-0.55, 0.55]) box(0.07, 1.25, 0.07, bx + px, 0, bz, k.wood);
    box(1.36, 0.82, 0.06, bx, 0.62, bz, C("#2fbf71", 0.75));
    box(1.2, 0.5, 0.07, bx, 0.82, bz, white);
    box(0.32, 0.2, 0.08, bx - 0.25, 0.86, bz, C("#5a6fd0", 0.75));
    put(new THREE.ConeGeometry(0.26, 0.18, 4).rotateY(Math.PI / 4).translate(bx - 0.25, Y + 1.15, bz), C("#e8424f", 0.75));
    box(0.46, 0.07, 0.08, bx + 0.25, 1.06, bz, C("#3a3f4a", 0.75));
    box(0.36, 0.05, 0.08, bx + 0.22, 0.94, bz, C("#9aa0aa", 0.75));
    box(1.2, 0.16, 0.08, bx, 0.66, bz, C("#ff4f8b", 0.75));
    // A shovel in the ground, ready, and flowers along the front.
    box(0.04, 0.7, 0.04, 1.05, 0.15, 1.45, k.wood, 0.2);
    box(0.2, 0.24, 0.03, 1.05, 0.0, 1.45, C("#9aa0aa", 0.5, 0.5), 0.2);
    flowers(0.3, 1.85, 6);
    tree(1.6, -1.7, 0.5);
    return 1.5;
  }
  if (kind === "site") {
    // A building site, opening soon: hoardings all round (a gate in front), dug-out ground,
    // a foundation going in, a site cabin, a pile of steel, and a tower crane over it.
    put(k.slab(), k.grass);
    box(4.0, 0.02, 3.9, 0, 0, -0.1, k.earth);
    box(2.4, 0.1, 2.1, 0.15, 0, -0.45, C("#bfc3c8", 1));
    for (let i = 0; i < 9; i++) box(0.04, 0.42, 0.04, -0.9 + (i % 3) * 1.05, 0.1, -1.35 + Math.floor(i / 3) * 0.9, C("#c86a3a", 0.75, 0.3));
    const hoard = C("#f4f1ea", 0.75), stripe = C(sd % 2 ? "#ff8a3b" : "#2f9bff", 0.75);
    const E = 2.0;
    for (const [w, d, x, z] of [[2 * E, 0.05, 0, -E], [0.05, 2 * E, -E, 0], [0.05, 2 * E, E, 0], [1.3, 0.05, -E + 0.65, E], [1.3, 0.05, E - 0.65, E]] as const) {
      box(w, 0.5, d, x, 0, z, hoard);
      box(w + 0.01, 0.1, d + 0.01, x, 0.32, z, stripe);
    }
    // The site cabin and a pallet of steel beams.
    box(1.0, 0.45, 0.5, -1.35, 0, 1.3, C("#2f9bff", 0.5));
    box(1.04, 0.05, 0.54, -1.35, 0.45, 1.3, white);
    box(0.24, 0.16, 0.02, -1.2, 0.2, 1.56, dark);
    for (let i = 0; i < 3; i++) box(0.9, 0.08, 0.1, 1.2, 0.04 + i * 0.08, 1.2 + (i % 2) * 0.05, C("#c84a3a", 0.75, 0.3));
    for (const [cx, cz] of [[0.3, 1.75], [-0.2, 1.8]]) { cyl(0.01, 0.1, 0.24, cx, 0, cz, C("#ff8a3b", 0.75)); box(0.14, 0.02, 0.14, cx, 0, cz, C("#ff8a3b", 0.75)); }
    // The tower crane: a lattice mast, a cab, the long jib and the counter-jib with its weight,
    // a peak with its ties, and a hook hanging on its cable.
    const yel = C("#ffc23a", 0.5, 0.3), mx = -1.35, mz = -1.35, H = 4.6, ry = (sd % 4) * (Math.PI / 2) + Math.PI / 4;
    box(0.5, 0.12, 0.5, mx, 0.02, mz, C("#9aa0aa", 1));
    for (const [ox, oz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) box(0.04, H, 0.04, mx + ox, 0.1, mz + oz, yel);
    for (let i = 1; i < 10; i++) { const yy = 0.1 + (i * H) / 10; box(0.24, 0.03, 0.24, mx, yy, mz, yel); box(0.03, 0.03, 0.3, mx, yy - H / 20, mz, yel, (i % 2 ? 1 : -1) * 0.6); }
    const J = (w: number, h: number, d: number, ox: number, oy: number, oz: number, m: THREE.Material, rz = 0) => put(new THREE.BoxGeometry(w, h, d).rotateZ(rz).translate(ox, oy, oz).rotateY(ry).translate(mx, Y, mz), m);
    J(0.3, 0.28, 0.3, 0, H + 0.24, 0, C("#ffffff", 0.5));
    J(0.2, 0.2, 0.18, 0.05, H + 0.25, 0.17, dark);
    J(3.4, 0.12, 0.14, 1.7, H + 0.45, 0, yel);
    J(3.4, 0.03, 0.03, 1.7, H + 0.58, 0, yel);
    J(1.2, 0.1, 0.16, -0.6, H + 0.45, 0, yel);
    J(0.36, 0.34, 0.26, -1.0, H + 0.28, 0, C("#9aa0aa", 1));
    J(0.08, 0.7, 0.08, 0, H + 0.85, 0, yel);
    J(1.9, 0.02, 0.02, 0.9, H + 0.85, 0, metalT(k), -0.36);
    J(1.0, 0.02, 0.02, -0.48, H + 0.85, 0, metalT(k), 0.42);
    const hx = 2.2 + (sd % 3) * 0.3;
    J(0.02, 1.9, 0.02, hx, H + 0.45 - 0.95, 0, metalT(k));
    J(0.16, 0.12, 0.12, hx, H - 1.45, 0, C("#ff4f4f", 0.5));
    J(0.7, 0.06, 0.12, hx, H - 1.6, 0, C("#c84a3a", 0.75, 0.3));
    return H + 1.2;
  }
  if (kind === "park") {
    // A pocket park: lawn, a paved circle with a fountain or a pond, paths, trees, benches.
    put(k.slab(), k.grass);
    const v = sd % 3;
    box(0.55, 0.02, 2.0, 0, 0.0, 1.15, k.pave);
    put(new THREE.CylinderGeometry(1.05, 1.05, 0.03, 24).translate(0, Y + 0.01, -0.15), k.pave);
    if (v === 0) {
      cyl(0.62, 0.66, 0.16, 0, 0, -0.15, k.stone, 20);
      cyl(0.56, 0.56, 0.05, 0, 0.12, -0.15, k.water, 20);
      cyl(0.08, 0.1, 0.5, 0, 0.1, -0.15, k.stone);
      cyl(0.24, 0.2, 0.05, 0, 0.5, -0.15, k.stone, 14);
    } else if (v === 1) {
      cyl(0.5, 0.5, 0.06, 0, 0.0, -0.15, k.water, 20);
      put(new THREE.TorusGeometry(0.52, 0.05, 6, 20).rotateX(Math.PI / 2).translate(0, Y + 0.06, -0.15), k.stone);
      box(0.18, 0.08, 0.1, 0.1, 0.04, -0.2, white);
    } else {
      // A bandstand: a round deck, posts and a cone roof.
      cyl(0.62, 0.64, 0.12, 0, 0, -0.15, k.stone, 8);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; box(0.04, 0.6, 0.04, Math.cos(a) * 0.5, 0.12, -0.15 + Math.sin(a) * 0.5, white); }
      put(new THREE.ConeGeometry(0.75, 0.38, 8).translate(0, Y + 0.9, -0.15), C(["#ff8a5c", "#5fc2ff", "#3aa060"][sd % 3], 0.75));
    }
    bench(-1.25, 0.05, Math.PI / 2); bench(1.25, -0.35, -Math.PI / 2);
    for (const [x, z, s] of [[-1.5, -1.5, 0.82], [1.5, -1.55, 0.74], [-1.55, 1.45, 0.66], [1.55, 1.35, 0.7]]) tree(x, z, s * (0.85 + r() * 0.3));
    flowers(-1.0, -0.95, 4); flowers(0.6, 0.95, 4);
    return 1.4;
  }
  if (kind === "parking") {
    // A car park: asphalt, painted bays both sides of a lane, a few cars, a pay machine,
    // a blue "P" sign and a hedge along the back.
    put(k.slab(), C("#646878", 1));
    const paint = C("#f4f1ea", 1);
    for (const zr of [-1.3, 1.2]) for (let i = 0; i <= 5; i++) box(0.04, 0.008, 1.0, -1.8 + i * 0.72, 0.0, zr, paint);
    box(3.7, 0.008, 0.05, 0, 0.0, -0.05, C("#ffd23a", 1));
    for (let i = 0; i < 5; i++) {
      if ((sd >> i) % 3 === 0) continue;
      car(-1.44 + i * 0.72, i % 2 ? -1.3 : 1.2, i % 2 ? Math.PI : 0, CARS[(sd + i * 3) % CARS.length]);
      if (r() < 0.55) car(-1.44 + i * 0.72, i % 2 ? 1.2 : -1.3, i % 2 ? 0 : Math.PI, CARS[(sd + i * 5 + 2) % CARS.length]);
    }
    box(4.0, 0.3, 0.22, 0, 0.0, -2.0, C("#3f8f4a", 1));
    box(0.06, 1.1, 0.06, 1.95, 0, 1.95, k.metal);
    box(0.4, 0.4, 0.05, 1.95, 0.95, 1.97, C("#2f6fd8", 0.5));
    box(0.07, 0.28, 0.06, 1.88, 1.01, 2.0, white); box(0.16, 0.06, 0.06, 1.96, 1.25, 2.0, white); box(0.16, 0.06, 0.06, 1.96, 1.12, 2.0, white); box(0.06, 0.12, 0.06, 2.02, 1.13, 2.0, white);
    box(0.18, 0.5, 0.14, -1.9, 0, 1.9, C("#e8e4da", 0.5, 0.3));
    box(0.12, 0.08, 0.02, -1.9, 0.36, 1.98, dark);
    return 1.3;
  }
  if (kind === "market") {
    put(k.slab(), k.pave);
    if (sd % 2) {
      // Food trucks with their hatches up, and tables with sunshades in between.
      for (const [x, z, ry, i] of [[-0.95, -1.15, 0, 0], [1.05, -0.95, -0.2, 1]] as const) {
        const cc = C(CARS[(sd + i * 4 + 1) % CARS.length], 0.5), q = (w: number, h: number, d: number, ox: number, oy: number, oz: number, m: THREE.Material, rx = 0) => put(new THREE.BoxGeometry(w, h, d).rotateX(rx).translate(ox, oy, oz).rotateY(ry).translate(x, Y, z), m);
        q(1.5, 0.7, 0.72, 0, 0.47, 0, cc);
        q(0.42, 0.48, 0.7, 0.92, 0.36, 0, cc);
        q(0.05, 0.22, 0.6, 1.14, 0.48, 0, dark);
        q(0.9, 0.3, 0.02, -0.15, 0.55, 0.37, dark);
        q(1.0, 0.03, 0.34, -0.15, 0.86, 0.5, C(AWN[(sd + i) % AWN.length][1], 0.75), -0.5);
        q(1.0, 0.05, 0.14, -0.15, 0.42, 0.42, white);
        q(0.6, 0.2, 0.04, -0.15, 0.94, 0.37, C(AWN[(sd + i) % AWN.length][0], 0.75));
        for (const [wx, wz] of [[-0.5, 0.36], [0.6, 0.36], [-0.5, -0.36], [0.6, -0.36]]) q(0.24, 0.24, 0.06, wx, 0.12, wz, tire);
      }
      for (const [x, z, i] of [[-1.1, 1.0, 0], [0.4, 0.9, 1], [1.5, 1.4, 2]] as const) {
        cyl(0.26, 0.26, 0.04, x, 0.4, z, white, 12);
        cyl(0.03, 0.03, 0.4, x, 0, z, k.metal, 6);
        cyl(0.015, 0.015, 0.55, x, 0.42, z, k.metal, 6);
        put(new THREE.ConeGeometry(0.48, 0.2, 8).translate(x, Y + 1.06, z), C(AWN[(sd + i + 2) % AWN.length][0], 0.75));
        for (const s of [-1, 1]) cyl(0.09, 0.09, 0.25, x + s * 0.4, 0, z, C("#e8e4da", 0.75), 8);
      }
    } else {
      // Market stalls: counters of fruit, veg and flowers under striped awnings.
      const goods = ["#e8424f", "#ff8a3b", "#ffd23a", "#7ac04a", "#b48cff", "#ff8ab0"];
      for (const [x, z, ry, i] of [[-1.15, -1.1, 0, 0], [0.35, -1.25, 0, 1], [1.5, 0.2, -Math.PI / 2, 2], [-1.35, 0.75, Math.PI / 2, 3]] as const) {
        const q = (w: number, h: number, d: number, ox: number, oy: number, oz: number, m: THREE.Material) => put(new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz).rotateY(ry).translate(x, Y, z), m);
        q(1.1, 0.4, 0.5, 0, 0.2, 0, k.wood);
        for (let g = 0; g < 4; g++) q(0.22, 0.08, 0.36, -0.39 + g * 0.26, 0.44, 0, C(goods[(sd + i * 2 + g) % goods.length], 0.75));
        for (const [px, pz] of [[-0.52, -0.24], [0.52, -0.24], [-0.52, 0.24], [0.52, 0.24]]) q(0.04, 0.95, 0.04, px, 0.47, pz, k.wood);
        const cs = AWN[(sd + i) % AWN.length];
        for (let s = 0; s < 4; s++) put(new THREE.BoxGeometry(0.3, 0.04, 0.68).rotateX(0.25).translate(-0.45 + s * 0.3, 1.0, 0.02).rotateY(ry).translate(x, Y, z), C(cs[s % 2], 0.75));
      }
      // Crates and a cart in the middle, and string lights between two poles.
      box(0.3, 0.22, 0.3, 0.1, 0, 0.3, k.wood); box(0.26, 0.18, 0.26, 0.42, 0, 0.45, k.wood);
      for (const px of [-1.9, 1.9]) box(0.05, 1.3, 0.05, px, 0, 1.9, k.metal);
      box(3.8, 0.015, 0.015, 0, 1.24, 1.9, dark);
      for (let i = 0; i < 9; i++) put(new THREE.SphereGeometry(0.045, 6, 4).translate(-1.7 + i * 0.425, Y + 1.19 - Math.sin((i / 8) * Math.PI) * 0.12, 1.9), C(["#ffd23a", "#ff6fa0", "#7fd8ff"][i % 3], 0.5));
    }
    tree(1.65, -1.7, 0.55);
    return 1.4;
  }
  if (kind === "garden") {
    // A community garden: raised beds of vegetables, sunflowers, a shed, a water butt and a
    // picket fence along the front.
    put(k.slab(), k.grass);
    box(3.9, 0.02, 0.5, 0, 0, 0.1, C("#d9c39a", 1));
    for (let i = 0; i < 6; i++) {
      const x = -1.35 + (i % 3) * 1.15, z = i < 3 ? -0.75 : 0.95;
      box(0.95, 0.16, 0.62, x, 0, z, k.wood);
      box(0.85, 0.02, 0.52, x, 0.15, z, k.earth);
      const leafC = C(["#3a8a3a", "#6ab04a", "#4f9a5a"][(i + sd) % 3], 1);
      for (let j = 0; j < 3; j++) put(new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.75, 1).translate(x - 0.28 + j * 0.28, Y + 0.24, z), leafC);
      if ((i + sd) % 3 === 0) for (let j = 0; j < 3; j++) put(new THREE.SphereGeometry(0.05, 6, 4).translate(x - 0.24 + j * 0.28, Y + 0.32, z + 0.08), C(["#e8424f", "#ff8a3b", "#b48cff"][(i + j) % 3], 0.75));
    }
    // The shed, its door and a sloping roof.
    box(0.8, 0.6, 0.6, 1.45, 0, -1.6, C(["#5a8aa8", "#c86a4a", "#4f9a5a"][sd % 3], 0.75));
    box(0.24, 0.42, 0.02, 1.45, 0, -1.29, white);
    box(0.92, 0.05, 0.74, 1.45, 0.64, -1.6, C("#3a3f4a", 0.75));
    cyl(0.14, 0.14, 0.34, 0.85, 0, -1.65, C("#2f6fd8", 0.5), 10);
    for (let i = 0; i < 4; i++) {
      const x = -1.75 + i * 0.22;
      box(0.025, 0.7 + (i % 2) * 0.15, 0.025, x, 0, -1.75, leafM);
      put(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10).rotateX(Math.PI / 2.6).translate(x, Y + 0.72 + (i % 2) * 0.15, -1.71), C("#ffd23a", 0.75));
    }
    for (let i = 0; i < 18; i++) if (i < 7 || i > 10) box(0.05, 0.28, 0.03, -1.95 + i * 0.23, 0, 1.95, white);
    for (const yy of [0.1, 0.2]) { box(1.6, 0.03, 0.02, -1.2, yy, 1.95, white); box(1.6, 0.03, 0.02, 1.2, yy, 1.95, white); }
    tree(-1.65, 1.55, 0.5);
    return 1.2;
  }
  // A sports court: a basketball court or a tennis court, fenced, with a bench.
  put(k.slab(), k.grass);
  const tennis = sd % 2 === 1;
  const floorC = tennis ? ["#3aa060", "#d0703a", "#3a7ad0"][sd % 3] : ["#3a7ad0", "#e07a3a", "#7a5ad0"][sd % 3];
  box(3.9, 0.02, 3.5, 0, 0, -0.15, C("#e8e4da", 1));
  box(3.6, 0.03, 3.2, 0, 0, -0.15, C(floorC, 1));
  const line = C("#ffffff", 1);
  for (const [w, d, x, z] of [[3.3, 0.04, 0, -1.6], [3.3, 0.04, 0, 1.3], [0.04, 2.9, -1.65, -0.15], [0.04, 2.9, 1.65, -0.15]] as const) box(w, 0.01, d, x, 0.03, z, line);
  if (tennis) {
    box(3.3, 0.01, 0.04, 0, 0.03, -0.15, line);
    box(0.04, 0.01, 1.6, 0, 0.03, -0.15, line);
    for (const s of [-1, 1]) box(0.05, 0.36, 0.05, s * 1.75, 0, -0.15, k.metal);
    box(3.5, 0.22, 0.015, 0, 0.12, -0.15, C("#f4f1ea", 0.75));
    box(3.5, 0.04, 0.03, 0, 0.34, -0.15, white);
  } else {
    box(0.04, 0.01, 2.9, 0, 0.03, -0.15, line);
    put(new THREE.TorusGeometry(0.5, 0.02, 4, 24).rotateX(Math.PI / 2).translate(0, Y + 0.04, -0.15), line);
    for (const s of [-1, 1]) {
      box(0.06, 1.0, 0.06, s * 1.8, 0, -0.15, k.metal);
      box(0.04, 0.4, 0.6, s * 1.68, 0.95, -0.15, white);
      box(0.045, 0.16, 0.24, s * 1.67, 1.02, -0.15, C("#e8424f", 0.75));
      put(new THREE.TorusGeometry(0.12, 0.015, 4, 12).rotateX(Math.PI / 2).translate(s * 1.52, Y + 0.98, -0.15), C("#ff8a3b", 0.5));
    }
  }
  // A fence round the back and the sides: posts and two rails.
  const fm = C("#5a8a6a", 0.5, 0.3);
  for (let i = 0; i <= 8; i++) { box(0.04, 0.9, 0.04, -1.95 + i * 0.4875, 0, -1.95, fm); }
  for (let i = 1; i <= 7; i++) for (const s of [-1, 1]) box(0.04, 0.9, 0.04, s * 1.95, 0, -1.95 + i * 0.4875, fm);
  for (const yy of [0.45, 0.88]) { box(3.9, 0.03, 0.03, 0, yy, -1.95, fm); for (const s of [-1, 1]) box(0.03, 0.03, 3.4, s * 1.95, yy, -0.25, fm); }
  bench(0.6, 1.62, Math.PI);
  for (let i = 0; i < 2; i++) put(new THREE.SphereGeometry(0.09, 8, 6).translate(-0.6 + i * 0.3, Y + 0.09, 1.65), C(tennis ? "#d8f04a" : "#ff8a3b", 0.75));
  return 1.1;
}

/** The cables' material (the crane's ties and its hook's line). */
const metalT = (k: FillKit): THREE.Material => k.c("#3a3f4a", 0.75, 0);

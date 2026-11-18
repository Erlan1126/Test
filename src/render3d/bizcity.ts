// Skyhaven Inc.'s business district: a floating island of its own where every business
// stands as a real building on its lot, growing with each stage (a cart, a shop, a store,
// a flagship, then a gold-crowned tower), around a plaza with a fountain and a ring road.
// It's alive: customers stroll the sidewalks and walk into the busiest stores, delivery
// vans drive round, a limousine brings each VIP, a rush hour draws a crowd and a glow, and
// at night the windows, signs and an empire's searchlight come on.
import * as THREE from "three";
import { mergeStatic } from "./world";
import { buildModel, buildTerrace, type ModelMats } from "./bizmodels";

/** One lot: its business, colors, stage and whether it's open, for lease or still locked. */
export interface BizLot {
  id: string;
  c: string;
  c2: string;
  /** Stage 0-4 (only for open businesses). */
  s: number;
  state: "open" | "lease" | "locked";
  /** Ready to grow to its next stage (scaffolding goes up). */
  ready?: boolean;
}

/** The look of the district: your island's ground and trees, your skin's glass. */
export interface BizStyle {
  lawn: string; rock: string; dirt: string; plaza: string; road: string;
  leaf: string; trunk: string; tree: "round" | "pine" | "palm";
  glass: string; lit: string;
}
export const DEFAULT_STYLE: BizStyle = { lawn: "#7fd36a", rock: "#8a7fb0", dirt: "#a8784a", plaza: "#f4efe6", road: "#5a5f7a", leaf: "#3fbf6a", trunk: "#8a5a3a", tree: "round", glass: "#bfe6ff", lit: "#ffd99a" };

/** What changes from moment to moment (no rebuild needed). */
export interface BizLive {
  /** The building whose card is open. */
  sel?: string;
  /** A building that just sold or grew (it bounces), and when. */
  pulse?: string;
  pulseAt?: number;
  rush: string;
  /** A golden customer waiting outside this business. */
  golden?: string;
  /** The first visit's close look at the starter tower and the Coffee Cart. */
  frame?: boolean;
  vip: string;
  critic: string;
  power: string;
}

/** The district is a little town of city blocks on a grid (streets along the world axes, so
 *  the camera sees two faces of every building). The blocks run in a band toward you: the
 *  first business at the far end, the next ones fanning out, a plaza at the entrance. The
 *  oldest (tallest) buildings stand at the back, so they never hide the newer ones. */
const C = 6.5;
const CELLS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
const PARKS: [number, number][] = [[4, 3], [3, 4]];
const PLAZA: [number, number] = [4, 4];
/** The plot beside the Coffee Cart where the player's first tower stands. */
const PLOT: [number, number] = [-1, 0];
const ALL = [...CELLS, ...PARKS, PLAZA, PLOT];
/** The starter tower's spot (local to the district), for the camera and its bubble. */
export function plotPos(): { x: number; z: number } { return cellXZ(PLOT); }
const OFF = 2 * C;
const cellXZ = ([gx, gz]: [number, number]) => ({ x: gx * C - OFF, z: gz * C - OFF });
const U = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);

/** Where each lot stands (local to the district) and which way its front faces. */
export function lotPos(i: number): { x: number; z: number; a: number } {
  const cell = CELLS[Math.min(i, CELLS.length - 1)], { x, z } = cellXZ(cell);
  const [gx, gz] = cell;
  // Lots left of center face +x, the rest +z: toward the middle of the screen.
  const a = gx < gz || (gx === gz && gx % 2 === 1) ? Math.PI / 2 : 0;
  return { x, z, a };
}
/** How far the island reaches on screen: across (t, screen x) and into the screen (s), local units. */
let bounds: { tMin: number; tMax: number; sMin: number; sMax: number } | null = null;
export function townBounds(): { tMin: number; tMax: number; sMin: number; sMax: number } {
  if (!bounds) {
    const pts = islandOutline(), ts = pts.map(([x, z]) => (x - z) * Math.SQRT1_2), ss = pts.map(([x, z]) => (x + z) * Math.SQRT1_2);
    bounds = { tMin: Math.min(...ts), tMax: Math.max(...ts), sMin: Math.min(...ss), sMax: Math.max(...ss) };
  }
  return bounds;
}
/** Where the camera should look: the blocks you've built so far (and the next to open). */
export function streetFocus(lots: BizLot[]): { x: number; z: number; zoom: number } {
  let last = 0;
  lots.forEach((l, i) => { if (l.state !== "locked") last = i; });
  const a = lotPos(0), b = lotPos(last), d = CELLS[last][0] + CELLS[last][1];
  const k = 0.5;
  const o = d >= 5 ? -0.5 : 1.5;
  return { x: a.x + (b.x - a.x) * k + o, z: a.z + (b.z - a.z) * k + o, zoom: d <= 1 ? 1.35 : d <= 2 ? 1.2 : d <= 4 ? 1.0 : 0.88 };
}

const col = (c: string) => new THREE.Color(c);
const std = (c: string | number | THREE.Color, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c instanceof THREE.Color ? c : typeof c === "number" ? c : col(c), roughness: 0.7, ...o });

/** The café loop, as the town shows it (see logic/cafe.ts). */
export interface BizCafe {
  /** The first tower: its floors (x, z, width, depth relative to its base), skin colors and shape. */
  starter: { b: [number, number, number, number][]; floors: string[]; glass: string; slab: string; lit: string; pts: (f: number) => [number, number][] } | null;
  terrace: 0 | 1 | 2;
  contract: 0 | 1 | 2;
}

export interface BizCity {
  group: THREE.Group;
  update(t: number, night: number, live: BizLive, lots: BizLot[]): void;
  /** How tall lot i's building stands (for its bubble). */
  top(i: number): number;
}

export function buildBizCity(lots: BizLot[], st: BizStyle = DEFAULT_STYLE, grown: string[] = [], cafe: BizCafe = { starter: null, terrace: 0, contract: 0 }): BizCity {
  const g = new THREE.Group();
  const own = <T extends THREE.Material>(m: T): T => { m.userData.own = true; return m; };
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const signs: THREE.MeshStandardMaterial[] = [];
  const winMat = own(std(st.glass, { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color(st.lit), emissiveIntensity: 0.05 }));
  winMat.userData.dynamic = true;
  const bulb = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.6 }));
  bulb.userData.dynamic = true;
  const leaf = own(std(st.leaf, { roughness: 0.9, flatShading: true }));
  const trunk = own(std(st.trunk));
  const mats: ModelMats = {
    c(c, rough = 0.7, metal = 0) {
      const color = c instanceof THREE.Color ? c : col(c), key = `${color.getHexString()}|${rough}|${metal}`;
      let m = cache.get(key);
      if (!m) { m = own(std(color, { roughness: rough, metalness: metal })); cache.set(key, m); }
      return m;
    },
    win: winMat,
    sign(c) { const m = own(std(c, { emissive: c instanceof THREE.Color ? c : col(c), emissiveIntensity: 0.15 })); m.userData.dynamic = true; signs.push(m); return m; },
    gold: own(std("#ffc93c", { roughness: 0.25, metalness: 0.85, emissive: 0x6a4a00, emissiveIntensity: 0.25 })),
    leaf, trunk, bulb,
  };

  // ---- The island: city blocks with streets between, on a rock that floats ----
  // The town keeps proper city colors (asphalt, pale sidewalks, green parks) on every island;
  // the island's own ground, trees and rock show round the edge.
  const rock = own(std(st.rock, { roughness: 1, flatShading: true }));
  const rockDark = own(std(new THREE.Color(st.rock).lerp(new THREE.Color("#2a2340"), 0.3), { roughness: 1, flatShading: true }));
  const earth = own(std(st.dirt, { roughness: 1 }));
  const road = own(std("#4b4f66", { roughness: 0.85 }));
  const walk = own(std("#dedbe6", { roughness: 0.8 }));
  const curb = own(std("#b9b5c8", { roughness: 0.7 }));
  const verge = own(std(st.lawn, { roughness: 0.95 }));
  const grass = own(std(new THREE.Color("#7ccf6a").lerp(new THREE.Color(st.lawn), 0.15), { roughness: 0.95 }));
  const grass2 = own(std(new THREE.Color("#6cbf5c").lerp(new THREE.Color(st.lawn), 0.15), { roughness: 0.95 }));
  const pave = own(std("#efe9df", { roughness: 0.7 }));
  const lane = own(new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  const zebra = own(new THREE.MeshBasicMaterial({ color: 0xf4f2fa }));
  const water = own(std("#5fc2ff", { roughness: 0.1, metalness: 0.2, emissive: 0x2a6fbf, emissiveIntensity: 0.25 }));
  const stone = own(std("#d9d2e6", { roughness: 0.6 }));
  const wood = own(std("#b07a4a", { roughness: 0.8 }));
  const metal = own(std("#4a4f7a", { metalness: 0.4, roughness: 0.5 }));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(geo, m); g.add(mesh); return mesh; };
  // One island under the whole town: a verge round the streets, layered rock below.
  const hull = islandOutline();
  const slab = (pts: [number, number][], depth: number, top: number, m: THREE.Material) => {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, top - depth, 0), m);
  };
  slab(hull, 0.12, 0, verge);
  slab(grow(hull, -0.05), 0.5, -0.12, earth);
  slab(grow(hull, -0.2), 1.0, -0.62, rock);
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cz = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  const shrink = (k: number) => hull.map(([x, z]): [number, number] => [cx + (x - cx) * k, cz + (z - cz) * k]);
  slab(shrink(0.9), 1.6, -1.6, rockDark);
  slab(shrink(0.72), 2.2, -3.2, rock);
  slab(shrink(0.5), 2.6, -5.4, rockDark);
  slab(shrink(0.26), 3.0, -8.0, rock);
  // Stalactite rocks hanging under the island.
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, r = 0.35 + (k % 3) * 0.12, h = 2 + (k * 37 % 5);
    const p = shrink(r)[Math.floor((k / 14) * hull.length) % hull.length];
    add(new THREE.ConeGeometry(0.9 + (k % 2) * 0.5, h, 5).rotateX(Math.PI).translate(p[0] + Math.cos(a), -3 - h / 2 - (k % 4), p[1] + Math.sin(a)), k % 2 ? rock : rockDark);
  }
  // Streets: asphalt, a curb round every block, a sidewalk, lane dashes and crosswalks.
  const q = C / 2;
  for (const cell of ALL) {
    const { x, z } = cellXZ(cell);
    add(new THREE.BoxGeometry(C, 0.1, C).translate(x, 0.0, z), road);
    add(new THREE.BoxGeometry(C - 1.6, 0.18, C - 1.6).translate(x, 0.09, z), curb);
    add(new THREE.BoxGeometry(C - 1.75, 0.2, C - 1.75).translate(x, 0.1, z), walk);
    for (const [dx, dz, along] of [[q, 0, "z"], [0, q, "x"]] as const) {
      for (let k = -1; k <= 1; k++) add(along === "z" ? new THREE.BoxGeometry(0.08, 0.02, 0.6).translate(x + dx, 0.06, z + k * 1.3) : new THREE.BoxGeometry(0.6, 0.02, 0.08).translate(x + k * 1.3, 0.06, z + dz), lane);
      // Zebra crossings near both ends of this street.
      for (const end of [-1, 1]) for (let b = -2; b <= 2; b++) {
        const o = end * (q - 1.25);
        add(along === "z" ? new THREE.BoxGeometry(0.22, 0.02, 0.5).translate(x + dx + b * 0.3, 0.06, z + o) : new THREE.BoxGeometry(0.5, 0.02, 0.22).translate(x + o, 0.06, z + dz + b * 0.3), zebra);
      }
    }
  }
  // Trees in the island's style.
  const tree = (x: number, z: number, s = 1, y = 0.2) => {
    add(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 0.6 * s, 6).translate(x, y + 0.3 * s, z), trunk);
    if (st.tree === "palm") for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.8 * s, 0.05, 0.2 * s).translate(0.35 * s, 0, 0).rotateZ(-0.35).rotateY((k / 5) * Math.PI * 2).translate(x, y + 0.65 * s, z), leaf);
    else add(st.tree === "pine" ? new THREE.ConeGeometry(0.5 * s, 1.3 * s, 7).translate(x, y + 0.6 * s + 0.65 * s, z) : new THREE.IcosahedronGeometry(0.5 * s, 0).translate(x, y + 0.6 * s + 0.4 * s, z), leaf);
  };
  const bench = (x: number, z: number, ry: number) => {
    add(new THREE.BoxGeometry(0.7, 0.06, 0.22).rotateY(ry).translate(x, 0.42, z), wood);
    add(new THREE.BoxGeometry(0.7, 0.2, 0.05).translate(0, 0, -0.1).rotateY(ry).translate(x, 0.55, z), wood);
    for (const s of [-0.28, 0.28]) add(new THREE.BoxGeometry(0.05, 0.22, 0.2).translate(s, 0, 0).rotateY(ry).translate(x, 0.3, z), metal);
  };
  const planter = (x: number, z: number, c: string) => {
    add(new THREE.BoxGeometry(0.5, 0.25, 0.5).translate(x, 0.32, z), stone);
    add(new THREE.IcosahedronGeometry(0.24, 0).translate(x, 0.55, z), leaf);
    for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.07, 6, 4).translate(x - 0.12 + k * 0.12, 0.72, z + 0.08), mats.c(c, 0.8));
  };
  const flowersOn = ["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"];
  // The two parks by the entrance: lawns, a path, a pond, benches.
  for (const [n, cell] of PARKS.entries()) {
    const { x, z } = cellXZ(cell);
    add(new THREE.BoxGeometry(C - 2.2, 0.06, C - 2.2).translate(x, 0.23, z), grass);
    add(new THREE.BoxGeometry(0.7, 0.07, C - 2.2).translate(x, 0.24, z), pave);
    add(new THREE.BoxGeometry(C - 2.2, 0.07, 0.7).translate(x, 0.24, z), pave);
    add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20).translate(x + (n ? -1.15 : 1.15), 0.25, z - 1.15), water);
    add(new THREE.TorusGeometry(0.78, 0.06, 6, 20).rotateX(Math.PI / 2).translate(x + (n ? -1.15 : 1.15), 0.28, z - 1.15), stone);
    for (const [a, b] of [[-1.3, 1.2], [1.3, 1.3], [n ? 1.3 : -1.3, -1.2]]) tree(x + a, z + b, 0.95);
    bench(x + 0.7, z + 0.55, 0); bench(x - 0.55, z - 0.7, Math.PI / 2);
    for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.09, 6, 4).translate(x - 1.8 + k * 0.22, 0.32, z + 1.95), mats.c(flowersOn[k % 4], 0.8));
  }
  // Street furniture round the business blocks: planters at the corners, benches and bins.
  for (const [n, cell] of CELLS.entries()) {
    const { x, z } = cellXZ(cell), e = q - 1.1;
    planter(x - e, z + e, flowersOn[n % 4]);
    planter(x + e, z - e, flowersOn[(n + 1) % 4]);
    if (n % 2 === 0) bench(x - 0.9, z + e + 0.05, 0); else bench(x + e + 0.05, z - 0.9, -Math.PI / 2);
    add(new THREE.CylinderGeometry(0.11, 0.1, 0.32, 8).translate(x + e - 0.05, 0.36, z + e - 0.9), mats.c("#3fae6a", 0.6));
  }
  // The verge: the island's own trees, bushes, flowers and boulders round the town.
  {
    const inCell = (x: number, z: number) => ALL.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 + 0.35 && Math.abs(z - p.z) < C / 2 + 0.35; });
    const inside = (x: number, z: number, m = 0.45) => { for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < m * Math.hypot(b[0] - a[0], b[1] - a[1])) return false; } return true; };
    let k = 0;
    for (let x = -OFF - C; x <= OFF + 3 * C; x += 1.2) for (let z = -OFF - C; z <= OFF + 3 * C; z += 1.2) {
      const jx = x + Math.sin(k * 12.9898) * 0.4, jz = z + Math.cos(k * 78.233) * 0.4, r = Math.abs(Math.sin(k * 3.7));
      k++;
      if (inCell(jx, jz) || !inside(jx, jz)) continue;
      if (r < 0.4) tree(jx, jz, 0.7 + r, 0);
      else if (r < 0.6) add(new THREE.IcosahedronGeometry(0.28, 0).translate(jx, 0.15, jz), leaf);
      else if (r < 0.72) add(new THREE.DodecahedronGeometry(0.22 + r * 0.2, 0).translate(jx, 0.1, jz), stone);
      else add(new THREE.SphereGeometry(0.1, 6, 4).translate(jx, 0.12, jz), mats.c(flowersOn[k % 4], 0.8));
    }
    // A low railing of posts and a rail along the island's edge.
    const rail = grow(hull, -0.3);
    for (let i = 0; i < rail.length; i++) {
      const a = rail[i], b = rail[(i + 1) % rail.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add(new THREE.BoxGeometry(0.06, 0.06, len).rotateY(ang).translate((a[0] + b[0]) / 2, 0.45, (a[1] + b[1]) / 2), stone);
      for (let d = 0; d < len; d += 1.4) add(new THREE.BoxGeometry(0.12, 0.45, 0.12).translate(a[0] + ((b[0] - a[0]) * d) / len, 0.22, a[1] + ((b[1] - a[1]) * d) / len), stone);
    }
  }
  // A waterfall pouring off the island's left edge from a little pond.
  const fallAt = (() => { let best = hull[0]; for (const p of hull) if (p[0] - p[1] < best[0] - best[1]) best = p; return best; })();
  const fx0 = fallAt[0] * 0.8 + cx * 0.2 + 1.2, fz0 = fallAt[1] * 0.8 + cz * 0.2 - 1.2;
  add(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 20).translate(fx0, 0.06, fz0), water);
  const fallM = own(new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x3a8fdf, emissiveIntensity: 0.3 }));
  fallM.userData.dynamic = true;
  const fallDir = new THREE.Vector2(fallAt[0] - cx, fallAt[1] - cz).normalize();
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.12).translate(0, -4.4, 0), fallM);
  fall.position.set(fallAt[0] - fallDir.x * 0.1, 0.05, fallAt[1] - fallDir.y * 0.1);
  fall.rotation.y = Math.atan2(fallDir.x, fallDir.y);
  fall.userData.dynamic = true;
  g.add(fall);
  add(new THREE.BoxGeometry(0.9, 0.06, Math.hypot(fallAt[0] - fx0, fallAt[1] - fz0)).rotateY(Math.atan2(fallAt[0] - fx0, fallAt[1] - fz0)).translate((fallAt[0] + fx0) / 2, 0.07, (fallAt[1] + fz0) / 2), water);
  // The plaza with its fountain.
  const pz = cellXZ(PLAZA);
  add(new THREE.CylinderGeometry(2.4, 2.4, 0.06, 32).translate(pz.x, 0.23, pz.z), pave);
  add(new THREE.TorusGeometry(2.4, 0.08, 6, 40).rotateX(Math.PI / 2).translate(pz.x, 0.26, pz.z), stone);
  add(new THREE.CylinderGeometry(1.2, 1.3, 0.4, 24).translate(pz.x, 0.4, pz.z), stone);
  add(new THREE.CylinderGeometry(1.05, 1.05, 0.42, 24).translate(pz.x, 0.41, pz.z), water);
  add(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 10).translate(pz.x, 0.9, pz.z), stone);
  add(new THREE.CylinderGeometry(0.5, 0.35, 0.12, 14).translate(pz.x, 1.45, pz.z), stone);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 14).translate(pz.x, 2.0, pz.z), own(new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.65, roughness: 0.1 })));
  jet.userData.dynamic = true;
  g.add(jet);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; planter(pz.x + Math.cos(a) * 2.0, pz.z + Math.sin(a) * 2.0, flowersOn[k % 4]); }
  // Street lamps on the block corners.
  const pole = metal;
  const lampMat = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
  lampMat.userData.dynamic = true;
  for (const cell of CELLS) {
    const { x, z } = cellXZ(cell), e = q - 1.0;
    for (const [a, b] of [[e, e], [-e, -e]]) {
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(x + a, 0.9, z + b), pole);
      add(new THREE.SphereGeometry(0.12, 8, 6).translate(x + a, 1.65, z + b), lampMat);
    }
  }

  // ---- The player's first tower, on its own plot beside the Coffee Cart ----
  let plotTop = 1.2;
  let starterGlass: THREE.MeshStandardMaterial | null = null;
  {
    const { x, z } = cellXZ(PLOT);
    add(new THREE.BoxGeometry(C - 2.2, 0.06, C - 2.2).translate(x, 0.23, z), grass);
    add(new THREE.BoxGeometry(2.9, 0.08, 2.9).translate(x, 0.25, z), pave);
    const sc = cafe.starter;
    if (sc) {
      // Its real floors, stacked: every floor's footprint (narrower where overhangs broke
      // off), in the skin's colors, with a band of windows and a slab between floors.
      const n = sc.b.length, fh = Math.min(0.55, 11 / Math.max(1, n)), S = 1.15;
      const glassM = own(std(sc.glass, { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color(sc.lit), emissiveIntensity: 0.05 }));
      glassM.userData.dynamic = true;
      starterGlass = glassM;
      const slabM = mats.c(sc.slab, 0.6);
      const floorGeo = (pts: [number, number][], [cx, cz, w, d]: [number, number, number, number], grow: number, h: number, y: number) => {
        const shape = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2((cx + px * w * grow) * S, -(cz + pz * d * grow) * S)));
        return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(x, y, z);
      };
      // The lobby.
      add(floorGeo(sc.pts(0), [0, 0, 1, 1], 1.02, 0.3, 0.3), mats.c("#e9e4f5", 0.6));
      let y = 0.6;
      sc.b.forEach((box, i) => {
        const pts = sc.pts(i + 1);
        add(floorGeo(pts, box, 1, fh * 0.86, y), mats.c(sc.floors[i % sc.floors.length], 0.55));
        add(floorGeo(pts, box, 1.025, fh * 0.42, y + fh * 0.22), glassM);
        add(floorGeo(pts, box, 1.04, fh * 0.12, y + fh * 0.86), slabM);
        y += fh;
      });
      plotTop = y;
      // A flag on the roof and a plaque and flowers at its foot.
      const top = sc.b[n - 1];
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(x + top[0] * S, y + 0.45, z + top[1] * S), metal);
      add(new THREE.BoxGeometry(0.5, 0.3, 0.03).translate(x + top[0] * S + 0.25, y + 0.72, z + top[1] * S), mats.sign("#ff4f8b"));
      add(new THREE.BoxGeometry(0.9, 0.5, 0.1).translate(x + 1.1, 0.55, z + 1.55), mats.c("#c8a070", 0.6));
      add(new THREE.BoxGeometry(0.7, 0.32, 0.12).translate(x + 1.1, 0.58, z + 1.56), mats.gold);
      for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.1, 6, 4).translate(x - 1.3 + k * 0.28, 0.36, z + 1.55), mats.c(flowersOn[k % 4], 0.8));
    } else {
      // No first tower yet: a little garden waiting for one.
      tree(x - 0.9, z - 0.8, 0.9); tree(x + 0.9, z + 0.7, 0.8);
      bench(x, z + 1.0, 0);
      plotTop = 1.4;
    }
  }

  // ---- The lots: each business's own building for its stage ----
  const beacons: THREE.Mesh[] = [];
  const arrows: THREE.Group[] = [];
  const rising: { lg: THREE.Group; puff: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial; puffMesh: THREE.Mesh; at: number }[] = [];
  const doors = new Map<string, THREE.Vector3>();
  const lotGroups = new Map<string, THREE.Group>();
  const tops: number[] = [];
  lots.forEach((lot, i) => {
    if (i >= CELLS.length) return;
    const { x, z, a } = lotPos(i);
    const lotG = new THREE.Group();
    lotG.position.set(x, 0.2, z);
    lotG.rotation.y = a;
    g.add(lotG);
    const fx = Math.sin(a), fz = Math.cos(a);
    doors.set(lot.id, new THREE.Vector3(x + fx * 2.35, 0.2, z + fz * 2.35));
    if (lot.state !== "open") {
      // Locked: a little park. For lease: a cleared plot with a sale sign.
      const K = (geo: THREE.BufferGeometry, m: THREE.Material) => lotG.add(new THREE.Mesh(geo, m));
      if (lot.state === "lease") {
        K(new THREE.BoxGeometry(4.2, 0.06, 4.2).translate(0, 0.03, 0), grass2);
        K(new THREE.BoxGeometry(3.2, 0.07, 3.2).translate(0, 0.04, -0.2), earth);
        for (const [sx, sz] of [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.4], [1.6, 1.4]]) K(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(sx, 0.25, sz), wood);
        for (const [sx, sz, w, d] of [[0, -1.8, 3.2, 0.03], [0, 1.4, 3.2, 0.03], [-1.6, -0.2, 0.03, 3.2], [1.6, -0.2, 0.03, 3.2]] as const) K(new THREE.BoxGeometry(w, 0.05, d).translate(sx, 0.42, sz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.08, 1.3, 0.08).translate(0, 0.65, 1.4), pole);
        K(new THREE.BoxGeometry(1.5, 0.8, 0.08).translate(0, 1.4, 1.4), mats.sign("#ff4f6d"));
        K(new THREE.BoxGeometry(1.1, 0.12, 0.09).translate(0, 1.4, 1.42), mats.c("#ffffff"));
        for (const [bx, bz] of [[-1.2, -0.8], [1.1, -1.1]]) K(new THREE.ConeGeometry(0.18, 0.45, 10).translate(bx, 0.25, bz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.9, 0.3, 0.5).translate(0.9, 0.15, 0.4), mats.c("#c86a4a"));
        tops[i] = 1.9;
      } else {
        // A little park until the business comes: lawn, a winding path, trees, a bench.
        K(new THREE.BoxGeometry(4.2, 0.06, 4.2).translate(0, 0.03, 0), i % 2 ? grass : grass2);
        K(new THREE.BoxGeometry(0.6, 0.07, 2.4).rotateY(0.5).translate(-0.3, 0.04, 0.9), pave);
        K(new THREE.BoxGeometry(0.6, 0.07, 2.2).rotateY(-0.6).translate(0.4, 0.04, -0.9), pave);
        for (const [tx, tz, ts] of [[-1.3, -1.2, 1], [1.3, 0.8, 0.9], [-1.4, 1.5, 0.75], [1.4, -1.5, 0.8]]) {
          K(new THREE.CylinderGeometry(0.06 * ts, 0.1 * ts, 0.6 * ts, 6).translate(tx, 0.3 * ts, tz), trunk);
          K(new THREE.IcosahedronGeometry(0.5 * ts, 0).translate(tx, 0.95 * ts, tz), leaf);
        }
        for (let k = 0; k < 5; k++) K(new THREE.SphereGeometry(0.09, 6, 4).translate(0.6 + k * 0.2, 0.12, 1.6), mats.c(flowersOn[(k + i) % 4], 0.8));
        K(new THREE.BoxGeometry(0.7, 0.06, 0.22).translate(0.9, 0.42, -0.1), wood);
        K(new THREE.BoxGeometry(0.7, 0.2, 0.05).translate(0.9, 0.55, -0.2), wood);
        tops[i] = 1.5;
      }
      mergeStatic(lotG);
      return;
    }
    // The lot: a paved forecourt with a strip of lawn round the back.
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 4.3).translate(0, 0.025, 0), grass));
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.06, 2.6).translate(0, 0.03, 0.85), pave));
    buildModel(lotG, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
    // The Coffee Cart's café terrace (see logic/cafe.ts).
    if (lot.id === "coffee" && cafe.terrace > 0) buildTerrace(lotG, cafe.terrace as 1 | 2, cafe.contract === 2, mats);
    lotG.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(lotG);
    tops[i] = Math.max(1.4, box.max.y - 0.2);
    if (lot.s >= 4) {
      const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 16, 16, 1, true).translate(0, 8, 0), beamMat);
      beam.position.set(x, tops[i], z);
      beam.userData.dynamic = true;
      beacons.push(beam);
      g.add(beam);
    }
    if (lot.ready) {
      // Ready to grow: scaffolding round the building and a glowing arrow above it.
      const sc = mats.c("#ff9a3b", 0.5, 0.3), plank = mats.c("#c8a070");
      const h = Math.max(1.6, tops[i] * 0.85), w = 2.25;
      for (const [px, pz] of [[-w, -w], [w, -w], [-w, w], [w, w]]) lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 5).translate(px, h / 2, pz), sc));
      for (let y = 0.9; y < h; y += 0.9) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.05, 0.05).translate(0, y, w), sc));
        for (const sd of [-1, 1]) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, w * 2).translate(sd * w, y, 0), sc));
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.04, 0.35).translate(0, y - 0.04, w - 0.2), plank));
      }
      const arrow = new THREE.Group();
      const am = mats.sign("#b48cff");
      arrow.add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 4).translate(0, 0.6, 0), am));
      arrow.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3).translate(0, 0.08, 0), am));
      arrow.position.set(x, tops[i] + 1.2, z);
      arrow.userData.dynamic = true;
      arrows.push(arrow);
      g.add(arrow);
    }
    mergeStatic(lotG);
    lotG.userData.dynamic = true;
    lotGroups.set(lot.id, lotG);
    if (grown.includes(lot.id)) {
      // Just grew: it rises out of the ground in a puff of dust.
      const m = own(new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0, depthWrite: false }));
      const puff = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.4, 32).rotateX(-Math.PI / 2).translate(x, 0.35, z), m);
      puff.userData.dynamic = true;
      g.add(puff);
      const glowM = own(new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, 14, 20, 1, true).translate(x, 7, z), glowM);
      glow.userData.dynamic = true;
      g.add(glow);
      rising.push({ lg: lotG, puff: m, glow: glowM, puffMesh: puff, at: -1 });
    }
  });

  // ---- Life: cars round the edge of town, people on the sidewalks, a limo, rush crowds ----
  const life = new THREE.Group();
  life.userData.dynamic = true;
  g.add(life);
  const loop = (inset: number) => outline(ALL, inset).map(p => new THREE.Vector3(p[0], 0, p[1]));
  const carPath = new Path(loop(0.45)), walkPath = new Path(loop(1.15));
  const shirts = ["#4f8bff", "#ff6fa0", "#5ee0a0", "#ffb13b", "#b48cff", "#ff8a5c", "#3ac0c0", "#e8457a"];
  const skinM = own(std("#f2c39a"));
  const makePerson = (c: string) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 3, 6).translate(0, 0.28, 0), mats.c(c)));
    p.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0.56, 0), skinM));
    return p;
  };
  const walkers = Array.from({ length: 22 }, (_, k) => { const p = makePerson(shirts[k % shirts.length]); life.add(p); return { p, u: k / 22, v: (k % 2 ? 1 : -1) * (0.012 + (k % 5) * 0.003) }; });
  const crowd = Array.from({ length: 10 }, (_, k) => { const p = makePerson(shirts[(k + 3) % shirts.length]); p.visible = false; life.add(p); return p; });
  const makeCar = (c: string, van: boolean) => {
    const v = new THREE.Group();
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, van ? 0.5 : 0.32, van ? 0.95 : 0.85).translate(0, van ? 0.38 : 0.28, 0), mats.c(c, 0.4, 0.3)));
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.22, van ? 0.25 : 0.45).translate(0, van ? 0.42 : 0.52, van ? 0.5 : -0.02), winMat));
    for (const wx of [-0.22, 0.22]) for (const wz of [-0.3, 0.3]) v.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateZ(Math.PI / 2).translate(wx, 0.1, wz), mats.c("#2a2f5a")));
    life.add(v);
    return v;
  };
  const cars = [["#ffffff", true], ["#ffc93c", false], ["#4f8bff", true], ["#ff4f8b", false], ["#5ee0a0", false]].map(([c, van], k) => ({ v: makeCar(c as string, van as boolean), u: k / 5, sp: 0.018 + (k % 3) * 0.004 }));
  const limo = new THREE.Group();
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 1.6).translate(0, 0.3, 0), own(std("#1c1640", { metalness: 0.6, roughness: 0.25 }))));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 1.1).translate(0, 0.6, -0.05), winMat));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 1.62).translate(0, 0.32, 0), mats.gold));
  limo.visible = false;
  life.add(limo);
  let limoFor = "", limoU = 0, limoEnd = 0;
  const ring = (color: number, r0: number, r1: number) => {
    const m = own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2).translate(0, 0.32, 0), m);
    mesh.visible = false;
    life.add(mesh);
    return { mesh, m };
  };
  // The golden customer: a shining figure at the door, a gold ring and a column of sparkle.
  const goldFig = new THREE.Group();
  const goldM = own(std("#ffd23f", { metalness: 0.9, roughness: 0.2, emissive: 0xb07a00, emissiveIntensity: 0.6 }));
  goldM.userData.dynamic = true;
  goldFig.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 4, 8).translate(0, 0.4, 0), goldM));
  goldFig.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8).translate(0, 0.8, 0), goldM));
  goldFig.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.18, 10).translate(0, 1.0, 0), goldM));
  goldFig.visible = false;
  life.add(goldFig);
  const goldBeamM = own(new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const goldBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 6, 16, 1, true).translate(0, 3, 0), goldBeamM);
  goldBeam.visible = false;
  life.add(goldBeam);
  // The open café terrace sells: a coin rises over it every couple of seconds.
  const saleCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16).rotateX(Math.PI / 2), mats.gold);
  saleCoin.visible = false;
  life.add(saleCoin);
  const rush = ring(0xff4f8b, 2.5, 2.9), critic = ring(0x9a6cff, 2.3, 2.55), sel = ring(0xffe27a, 2.6, 2.95), gold = ring(0xffc93c, 2.2, 2.7);

  mergeStatic(g);

  const idx = (id: string) => lots.findIndex(l => l.id === id);
  const lotRing = (r: { mesh: THREE.Mesh; m: THREE.MeshBasicMaterial }, id: string) => {
    const i = idx(id);
    r.mesh.visible = i >= 0 && i < CELLS.length;
    if (r.mesh.visible) { const p = lotPos(i); r.mesh.position.set(p.x, 0, p.z); }
    return r.mesh.visible;
  };
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
  let last = 0;
  return {
    group: g,
    top: i => (i < 0 ? plotTop : tops[i] ?? 2),
    update(t, night, live) {
      const dt = Math.min(0.1, last ? t - last : 0.016);
      last = t;
      winMat.emissiveIntensity = 0.05 + night * 0.9;
      if (starterGlass) starterGlass.emissiveIntensity = 0.05 + night * 0.9;
      lampMat.emissiveIntensity = 0.2 + night * 2.2;
      bulb.emissiveIntensity = 0.5 + night * 1.5 + Math.sin(t * 8) * 0.25;
      for (const m of signs) m.emissiveIntensity = 0.15 + night * 0.9;
      for (const b of beacons) {
        (b.material as THREE.MeshBasicMaterial).opacity = Math.max(0, night - 0.3) * 0.1;
        b.rotation.z = Math.sin(t * 0.5) * 0.35;
        b.rotation.x = Math.cos(t * 0.4) * 0.25;
      }
      jet.scale.y = 1 + Math.sin(t * 4) * 0.08;
      const cd = cafe.terrace === 2 ? doors.get("coffee") : undefined;
      saleCoin.visible = !!cd;
      if (cd) {
        const k = (t % 2.6) / 2.6;
        saleCoin.position.set(cd.x, 1.0 + k * 1.4, cd.z);
        saleCoin.rotation.y = t * 5;
        saleCoin.scale.setScalar(k < 0.75 ? 1 : Math.max(0.01, (1 - k) * 4));
      }
      fallM.opacity = 0.65 + Math.sin(t * 10) * 0.1;
      fall.scale.x = 1 + Math.sin(t * 7) * 0.04;
      g.traverse(o => { if (o.userData.spin) o.rotation.y = t * 0.6; });
      for (const a of arrows) { a.rotation.y = t * 2; a.position.y += (Math.sin(t * 3) * 0.004); }
      // A building that just grew rises from the ground, with dust and a burst of light.
      const risingNow = new Set<THREE.Group>();
      for (const r of rising) {
        if (r.at < 0) r.at = t;
        const k = (t - r.at) / 1.3;
        if (k >= 1.6) { r.puff.opacity = 0; r.glow.opacity = 0; continue; }
        const e = k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
        if (k < 1) { r.lg.scale.set(1, Math.max(0.02, e), 1); risingNow.add(r.lg); }
        r.puff.opacity = Math.max(0, 0.7 * (1 - k / 1.6));
        r.puffMesh.scale.setScalar(1 + k * 0.8);
        r.glow.opacity = Math.max(0, Math.sin(Math.min(1, k / 1.4) * Math.PI) * 0.35);
      }
      // A building that just sold bounces.
      const now = Date.now();
      for (const [id, lg] of lotGroups) {
        if (risingNow.has(lg)) continue;
        const k = id === live.pulse ? (now - (live.pulseAt ?? 0)) / 450 : 1;
        if (k >= 0 && k < 1) { const b = Math.sin(k * Math.PI) * (1 - k); lg.scale.set(1 - b * 0.06, 1 + b * 0.14, 1 - b * 0.06); }
        else lg.scale.set(1, 1, 1);
      }
      // People stroll round the town; cars drive the outer street.
      for (const w of walkers) {
        w.u = (w.u + w.v * dt + 1) % 1;
        walkPath.at(w.u, tmp, dir);
        w.p.position.set(tmp.x, 0.2 + Math.abs(Math.sin(t * 9 + w.u * 50)) * 0.04, tmp.z);
        w.p.rotation.y = Math.atan2(dir.x, dir.z) + (w.v < 0 ? Math.PI : 0);
      }
      for (const c of cars) {
        c.u = (c.u + c.sp * dt) % 1;
        carPath.at(c.u, tmp, dir);
        c.v.position.set(tmp.x, 0.04, tmp.z);
        c.v.rotation.y = Math.atan2(dir.x, dir.z);
      }
      // A crowd outside the rush-hour business.
      const ri = idx(live.rush);
      crowd.forEach((p, k) => {
        p.visible = ri >= 0 && ri < CELLS.length;
        if (!p.visible) return;
        const d = doors.get(live.rush)!, lp = lotPos(ri), side = (k - 4.5) * 0.3;
        p.position.set(d.x + Math.cos(lp.a) * side + Math.sin(lp.a) * (k % 3) * 0.25, 0.2 + Math.abs(Math.sin(t * 12 + k)) * 0.12, d.z - Math.sin(lp.a) * side + Math.cos(lp.a) * (k % 3) * 0.25);
        p.rotation.y = lp.a + Math.PI;
      });
      if (lotRing(rush, live.rush)) { rush.m.opacity = 0.45 + Math.sin(t * 6) * 0.2; rush.mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.05); }
      if (lotRing(critic, live.critic)) critic.mesh.rotation.y = t;
      const gd = live.golden ? doors.get(live.golden) : undefined;
      goldFig.visible = goldBeam.visible = !!gd;
      if (lotRing(gold, live.golden ?? "")) { gold.m.opacity = 0.6 + Math.sin(t * 8) * 0.3; gold.mesh.scale.setScalar(1 + Math.sin(t * 5) * 0.08); }
      if (gd) {
        goldFig.position.set(gd.x, 0.2 + Math.abs(Math.sin(t * 5)) * 0.25, gd.z);
        goldFig.rotation.y = t * 2;
        goldBeam.position.set(gd.x, 0.2, gd.z);
        goldBeamM.opacity = 0.25 + Math.sin(t * 6) * 0.12;
        goldM.emissiveIntensity = 0.5 + Math.sin(t * 9) * 0.3;
      }
      if (lotRing(sel, live.sel ?? "")) { sel.m.opacity = 0.55 + Math.sin(t * 4) * 0.25; sel.mesh.scale.setScalar(1 + Math.sin(t * 4) * 0.03); }
      // The VIP's limousine drives round to the nearest corner of their block and parks.
      const vi = idx(live.vip);
      if (vi >= 0 && vi < CELLS.length && limoFor !== live.vip) { limoFor = live.vip; limoEnd = carPath.nearest(doors.get(live.vip)!); limoU = limoEnd - 0.12; }
      if (vi < 0) limoFor = "";
      limo.visible = !!limoFor;
      if (limoFor) {
        limoU = Math.min(limoEnd, limoU + dt * 0.03);
        carPath.at((limoU + 1) % 1, tmp, dir);
        limo.position.set(tmp.x, 0.04, tmp.z);
        limo.rotation.y = Math.atan2(dir.x, dir.z);
      }
    },
  };
}

/** The outline of a set of grid cells (a loop round the town), pulled in by `inset`. */
function outline(cells: [number, number][], inset: number): [number, number][] {
  const has = new Set(cells.map(([x, z]) => `${x},${z}`));
  // Directed edges, counter-clockwise round each cell; shared edges cancel out.
  const edges = new Map<string, [number, number]>();
  for (const [cx, cz] of cells) {
    const corners: [number, number][] = [[cx, cz], [cx + 1, cz], [cx + 1, cz + 1], [cx, cz + 1]];
    const nb: [number, number][] = [[cx, cz - 1], [cx + 1, cz], [cx, cz + 1], [cx - 1, cz]];
    for (let k = 0; k < 4; k++) if (!has.has(`${nb[k][0]},${nb[k][1]}`)) edges.set(`${corners[k][0]},${corners[k][1]}`, corners[(k + 1) % 4]);
  }
  const start = edges.keys().next().value as string;
  const pts: [number, number][] = [];
  let cur = start;
  do { const [x, z] = cur.split(",").map(Number); pts.push([x, z]); const nx = edges.get(cur)!; cur = `${nx[0]},${nx[1]}`; } while (cur !== start && pts.length < 400);
  // Drop straight-through points, then pull every corner inward.
  const corners = pts.filter((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
  const n = corners.length, out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[(i - 1 + n) % n], p = corners[i], b = corners[(i + 1) % n];
    // Inward normal of a counter-clockwise edge (in x/z, z pointing "down") is (-dz, dx) flipped.
    const n1 = [Math.sign(p[1] - a[1]), -Math.sign(p[0] - a[0])], n2 = [Math.sign(b[1] - p[1]), -Math.sign(b[0] - p[0])];
    const wx = (p[0] - 0.5) * C - OFF, wz = (p[1] - 0.5) * C - OFF;
    out.push([wx - (n1[0] + n2[0]) * inset, wz - (n1[1] + n2[1]) * inset]);
  }
  return out;
}

/** A closed path walked by a fraction 0-1 of its length. */
class Path {
  private len: number[] = [];
  private total = 0;
  constructor(private pts: THREE.Vector3[]) {
    for (let i = 0; i < pts.length; i++) { this.len.push(this.total); this.total += pts[i].distanceTo(pts[(i + 1) % pts.length]); }
  }
  at(u: number, out: THREE.Vector3, dir: THREE.Vector3): void {
    const d = (((u % 1) + 1) % 1) * this.total;
    let i = this.len.length - 1;
    while (i > 0 && this.len[i] > d) i--;
    const a = this.pts[i], b = this.pts[(i + 1) % this.pts.length], seg = b.distanceTo(a) || 1;
    out.copy(a).lerp(b, (d - this.len[i]) / seg);
    dir.copy(b).sub(a).normalize();
  }
  nearest(p: THREE.Vector3): number {
    let best = 0, bd = Infinity;
    const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
    for (let k = 0; k < 200; k++) { this.at(k / 200, tmp, dir); const d = tmp.distanceToSquared(p); if (d < bd) { bd = d; best = k / 200; } }
    return best;
  }
}
void U;

/** A big friendly prop for each kind of business. */
function roofProp(id: string, c1: THREE.Color, c2: THREE.Color): THREE.Group {
  const p = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.4 }), m2 = new THREE.MeshStandardMaterial({ color: c2, roughness: 0.4 });
  const w = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  m1.userData.own = m2.userData.own = w.userData.own = true;
  switch (id) {
    case "coffee":
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 14).translate(0, 0.25, 0), w));
      p.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 12).translate(0.32, 0.27, 0), w));
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 14).translate(0, 0.49, 0), new THREE.MeshStandardMaterial({ color: 0x6a3a1a })));
      break;
    case "flowers":
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6).translate(Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22), m1)); }
      p.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 0.42, 0), new THREE.MeshStandardMaterial({ color: 0xffe27a })));
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x3fbf6a })));
      break;
    case "bakery":
      p.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xe0a85a, roughness: 0.6 })));
      break;
    case "pizza":
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 20).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0xffc95a })));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).translate(Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25), new THREE.MeshStandardMaterial({ color: 0xd0402a }))); }
      p.rotation.x = 0.5;
      break;
    case "cinema":
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 16).rotateX(Math.PI / 2).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: 0x2a2f5a, metalness: 0.5 })));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.22, 0.45 + Math.sin(a) * 0.22, 0), w)); }
      break;
    case "hotel":
      p.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.08).translate(-0.2, 0.3, 0), m2));
      p.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.08).translate(0.2, 0.3, 0), m2));
      p.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.08).translate(0, 0.3, 0), m2));
      break;
    case "mall":
      p.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 })));
      break;
    case "airport":
      p.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 4, 10).rotateZ(Math.PI / 2).translate(0, 0.7, 0), m1));
      p.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05).translate(-0.4, 0.82, 0), m2));
      break;
    case "casino":
      p.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.7, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.4 })));
      break;
    case "spaceport":
      p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 12).translate(0, 0.55, 0), w));
      p.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 12).translate(0, 1.17, 0), m2));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; p.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.18).translate(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2).rotateY(-a), m2)); }
      break;
  }
  return p;
}

/** The island's edge: the town's blocks wrapped in one smooth, convex outline with a verge. */
function islandOutline(): [number, number][] {
  const pts: [number, number][] = [];
  for (const c of ALL) { const { x, z } = cellXZ(c); for (const dx of [-1, 1]) for (const dz of [-1, 1]) pts.push([x + dx * C / 2, z + dz * C / 2]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return grow(hull, 1.2);
}

/** Pushes a convex, counter-clockwise outline out (or in, when negative) by d. */
function grow(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    const n1 = [e1[1] / l1, -e1[0] / l1], n2 = [e2[1] / l2, -e2[0] / l2];
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [p[0] + ((n1[0] + n2[0]) / k) * d, p[1] + ((n1[1] + n2[1]) / k) * d];
  });
}

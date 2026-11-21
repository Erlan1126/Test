// Skyhaven Inc.'s business district: a floating island of its own where every business
// stands as a real building on its lot, growing with each stage (a cart, a shop, a store,
// a flagship, then a gold-crowned tower), around a plaza with a fountain and a ring road.
// It's alive: customers stroll the sidewalks and walk into the busiest stores, delivery
// vans drive round, a limousine brings each VIP, a rush hour draws a crowd and a glow, and
// at night the windows, signs and an empire's searchlight come on.
import * as THREE from "three";
import { mergeStatic } from "./world";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildBlock, type BizBlock } from "./block";
import { townFx, type TownLook } from "./shaders";
import { buildModel, buildStreetFront, buildTerrace, type ModelMats } from "./bizmodels";

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
  /** The café block's story (block.ts), timed by the town UI. */
  block?: BizBlock;
  vip: string;
  critic: string;
  power: string;
}

/** The district is a little town of city blocks on a grid (streets along the world axes, so
 *  the camera sees two faces of every building). The blocks run in a band toward you: the
 *  first business at the far end, the next ones fanning out, a plaza at the entrance. The
 *  oldest (tallest) buildings stand at the back, so they never hide the newer ones. */
const C = 6.5;

/** A flat slab with rounded corners, w by d, h thick, lying on y = 0..h (centered). */
function roundSlab(w: number, d: number, r: number, h: number): THREE.BufferGeometry {
  const x = w / 2, z = d / 2, rr = Math.min(r, x, z);
  const sh = new THREE.Shape();
  sh.moveTo(-x + rr, -z);
  sh.lineTo(x - rr, -z); sh.absarc(x - rr, -z + rr, rr, -Math.PI / 2, 0, false);
  sh.lineTo(x, z - rr); sh.absarc(x - rr, z - rr, rr, 0, Math.PI / 2, false);
  sh.lineTo(-x + rr, z); sh.absarc(-x + rr, z - rr, rr, Math.PI / 2, Math.PI, false);
  sh.lineTo(-x, -z + rr); sh.absarc(-x + rr, -z + rr, rr, Math.PI, Math.PI * 1.5, false);
  return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, h, 0);
}

/** A curving path (a flat ribbon) through points, w wide, at height y. */
function ribbon(pts: [number, number][], w: number, y: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const n = 28, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPoint(t), tan = curve.getTangent(t);
    const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
    pos.push(p.x + (nx / l) * w / 2, y, p.z + (nz / l) * w / 2, p.x - (nx / l) * w / 2, y, p.z - (nz / l) * w / 2);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (Facing up whichever way the points wind.)
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

/** A gentle S through a square of half-size h (a park path). */
const sPath = (h: number, flip = false): [number, number][] => {
  const f = flip ? -1 : 1;
  return [[-h * f, -h], [-h * 0.2 * f, -h * 0.45], [h * 0.25 * f, h * 0.05], [-h * 0.05 * f, h * 0.55], [h * 0.6 * f, h]];
};
const CELLS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
const PARKS: [number, number][] = [[4, 3], [3, 4]];
const PLAZA: [number, number] = [4, 4];
/** The plot beside the Coffee Cart where the player's first tower stands. */
const PLOT: [number, number] = [-1, 0];
const ALL = [...CELLS, ...PARKS, PLAZA, PLOT];
/** A piece of a merged model, painted one color (vertex colors; no uv, so pieces merge). */
function paintGeo(geo: THREE.BufferGeometry, c: string): THREE.BufferGeometry {
  const g2 = geo.index ? geo.toNonIndexed() : geo, n = g2.attributes.position.count, cc = new THREE.Color(c), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
  g2.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  if (g2.attributes.uv) g2.deleteAttribute("uv");
  return g2;
}
/** A soft round shadow (made once, shared by every town build). */
let blobTexture: THREE.Texture | null = null;
function softBlob(): THREE.Texture {
  if (blobTexture) return blobTexture;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!, gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (blobTexture = new THREE.CanvasTexture(c));
}
/** How much the island next to the town grows once something is built on it. */
const ANNEX_S = 2.0;
/** Cottage walls and roofs on the island's outskirts. */
const COTTAGE: [string, string][] = [["#fff4e0", "#e2453c"], ["#e8f4ff", "#3f6fd0"], ["#fff0f5", "#ff7aa8"], ["#f4fff0", "#3fae5a"], ["#fffbe0", "#b8583a"]];
/** The back of the island: a beach and a stretch of sea (no streets). */
const BEACH: [number, number][] = [[-1, -1], [0, -1], [-1, -2]];
/** The starter tower's spot (local to the district), for the camera and its bubble. */
export function plotPos(): { x: number; z: number } { const c = cellXZ(PLOT); return { x: c.x + TOWER_AT.x, z: c.z + TOWER_AT.z }; }
/** The starter tower's spot in its plot (the back corner: the front is for the neighborhood),
 *  and how far its front door is from the plot's center. */
const TOWER_AT = { x: -0.55, z: -0.55 }, TOWER_S = 1.15;
const doorZ = TOWER_AT.z + TOWER_S * 1.02 + 0.02;
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
/** How far the island reaches on screen: across (t, screen x) and into the screen (s), local
 *  units. `core`: just the town and its verge (what the camera frames), not the countryside. */
const boundsCache = new Map<boolean, { tMin: number; tMax: number; sMin: number; sMax: number }>();
export function townBounds(core = false): { tMin: number; tMax: number; sMin: number; sMax: number } {
  let b = boundsCache.get(core);
  if (!b) {
    const pts = islandOutline(core ? 1.0 : ISLAND_PAD), ts = pts.map(([x, z]) => (x - z) * Math.SQRT1_2), ss = pts.map(([x, z]) => (x + z) * Math.SQRT1_2);
    b = { tMin: Math.min(...ts), tMax: Math.max(...ts), sMin: Math.min(...ss), sMax: Math.max(...ss) };
    boundsCache.set(core, b);
  }
  return b;
}
/** Where the camera should look: the blocks you've built so far (and the next to open). */
export function streetFocus(lots: BizLot[]): { x: number; z: number; zoom: number } {
  let last = 0;
  lots.forEach((l, i) => { if (l.state !== "locked") last = i; });
  const a = lotPos(0), b = lotPos(last), d = CELLS[last][0] + CELLS[last][1];
  const k = 0.5;
  const o = d >= 5 ? -0.5 : 1.5;
  return { x: a.x + (b.x - a.x) * k + o, z: a.z + (b.z - a.z) * k + o, zoom: d <= 1 ? 1.5 : d <= 2 ? 1.35 : d <= 4 ? 1.2 : 1.12 };
}

const col = (c: string) => new THREE.Color(c);
const std = (c: string | number | THREE.Color, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c instanceof THREE.Color ? c : typeof c === "number" ? c : col(c), roughness: 0.7, ...o });

/** The café loop, as the town shows it (see logic/cafe.ts). */
export interface BizCafe {
  /** The first tower: its floors (x, z, width, depth relative to its base), skin colors and shape. */
  starter: { b: [number, number, number, number][]; floors: string[]; glass: string; slab: string; lit: string; pts: (f: number) => [number, number][] } | null;
  terrace: 0 | 1 | 2;
  contract: 0 | 1 | 2;
  /** Each business's HQ tower, as the player built it (logic/orders.ts). */
  hq?: Record<string, BizTower>;
  /** Neighborhood projects done, whether they're on offer, and whether the terrace
   *  should show as a preview (once the neighbor has asked to sit somewhere). */
  done?: string[];
  offered?: boolean;
  ghostTerrace?: boolean;
  /** Island decorations the player bought (data/decor.ts). */
  decor?: string[];
  /** The town's rank (data/ranks.ts): each one adds something new to the town. */
  rank?: number;
  /** The floating island next to the town: "ghost" (waiting to be built), or what's built. */
  annex?: "" | "ghost" | "greenhouse" | "lookout";
}
/** A tower the player built, as the town draws it. */
export type BizTower = NonNullable<BizCafe["starter"]>;

export interface BizCity {
  group: THREE.Group;
  update(t: number, night: number, live: BizLive, lots: BizLot[]): void;
  /** The light and weather the town's shaders follow (sky colors, sunset, rain). */
  look(l: Partial<TownLook>): void;
  /** The middle of the beach (for the heat shimmer), or null. */
  beach(): { x: number; z: number } | null;
  /** How tall lot i's building stands (for its bubble). -1 is the starter tower, -2 the
   *  flower market's spot, -3 the playground's. */
  top(i: number): number;
  /** The neighbor in the yellow jacket, when they're out (for their speech bubble). */
  resident(): THREE.Vector3 | null;
  /** Where a town rank's landmark is (the camera visits it when the rank is reached). */
  landmark(rank: number): { x: number; z: number } | null;
  /** The flower market's and the playground's spots. */
  spot(id: "flowers" | "play"): { x: number; z: number };
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
  // Ripples on the water, patchy lawns with cloud shadows, leaves in the breeze.
  const fx = townFx(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const leaf = own(std(st.leaf, { roughness: 0.9, flatShading: true }));
  fx.sway(leaf, 0.5, 0.05);
  fx.glass(winMat);
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
  fx.ground(verge); fx.ground(grass); fx.ground(grass2); fx.ground(earth, 0.6); fx.water(water);
  fx.street(road); fx.street(walk); fx.street(pave); fx.street(curb);
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
  // Little islands floating beside the big one: a grassy top, a tree or two, rock hanging below.
  const islets: { o: THREE.Group; y: number; k: number }[] = [];
  {
    const xs = hull.map(q => q[0]), zs0 = hull.map(q => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs0), maxZ = Math.max(...zs0);
    const spots: [number, number, number, number][] = [[minX - 2.6, cz - (maxZ - minZ) * 0.15, 1.1, -1.2], [maxX + 2.4, cz + (maxZ - minZ) * 0.2, 0.85, -2.0], [minX - 1.4, minZ - 1.6, 0.6, -2.6]];
    spots.forEach(([x, z, r, y], k) => {
      const o = new THREE.Group();
      const top = new THREE.CylinderGeometry(r, r * 0.92, 0.18, 9).translate(0, -0.09, 0);
      o.add(new THREE.Mesh(top, verge));
      o.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 2.2, 7).rotateX(Math.PI).translate(0, -0.18 - r * 1.1, 0), k % 2 ? rock : rockDark));
      const tr = (tx: number, tz: number, ts: number) => {
        o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * ts, 0.07 * ts, 0.5 * ts, 6).translate(tx, 0.25 * ts, tz), trunk));
        o.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 * ts, 0).translate(tx, 0.62 * ts, tz), leaf));
      };
      // (Once the skyline rises there (Metropolis), the towers take the trees' place; the
      // island next to the town (the annex) is cleared for what the player builds.)
      const annexHere = k === 1 && !!cafe.annex;
      if ((cafe.rank ?? 0) < 5 && !annexHere) { tr(-r * 0.25, 0.1, 1); if (r > 0.8) tr(r * 0.35, -0.2, 0.75); }
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4).scale(1, 0.6, 1).translate(r * 0.2, 0.04, r * 0.35), rockDark));
      // The annex island floats up level with the town, and grows to make room.
      const yy = k === 1 && cafe.annex ? -0.2 : y;
      if (k === 1 && cafe.annex && cafe.annex !== "ghost") o.scale.set(ANNEX_S, 1, ANNEX_S);
      o.position.set(x, yy, z);
      o.userData.dynamic = true;
      g.add(o);
      islets.push({ o, y: yy, k });
    });
  }
  // A flock of small birds in a V, crossing the whole island now and then.
  const flockM = own(new THREE.MeshLambertMaterial({ color: 0x3a3550 }));
  const flock = new THREE.Group();
  const flockW: THREE.Mesh[][] = [];
  for (let k = 0; k < 7; k++) {
    const b = new THREE.Group(), side = k === 0 ? 0 : (k % 2 ? 1 : -1), row = Math.ceil(k / 2);
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.06).translate(-0.1, 0, 0), flockM);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.06).translate(0.1, 0, 0), flockM);
    b.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.14), flockM), lw, rw);
    b.position.set(side * row * 0.35, Math.sin(k) * 0.08, -row * 0.32);
    flock.add(b);
    flockW.push([lw, rw]);
  }
  flock.userData.dynamic = true;
  flock.visible = false;
  g.add(flock);
  const fl = (() => { const xs = hull.map(q => q[0]), zz = hull.map(q => q[1]); return { x0: Math.min(...xs) - 4, x1: Math.max(...xs) + 4, z0: Math.min(...zz) - 4, z1: Math.max(...zz) + 4 }; })();
  const flockLive = (t: number) => {
    const per = 38, k = (t % per) / 22; // 22 s across, then 16 s of open sky
    flock.visible = k < 1;
    if (!flock.visible) return;
    const lap = Math.floor(t / per), dir = lap % 2 ? 1 : -1;
    const ax = dir > 0 ? fl.x0 : fl.x1, bx = dir > 0 ? fl.x1 : fl.x0;
    const az = fl.z1 - (lap % 3) * 2, bz = fl.z0 + (lap % 3) * 1.5;
    flock.position.set(ax + (bx - ax) * k, 4.2 + Math.sin(t * 0.4) * 0.3, az + (bz - az) * k);
    flock.rotation.y = Math.atan2(bx - ax, bz - az);
    flockW.forEach(([l, r], i) => { const f = Math.sin(t * 9 + i * 0.7) * 0.45; l.rotation.z = -f; r.rotation.z = f; });
  };
  // Streets: asphalt, a curb round every block, a sidewalk, lane dashes and crosswalks.
  const q = C / 2;
  for (const cell of ALL) {
    const { x, z } = cellXZ(cell);
    add(new THREE.BoxGeometry(C, 0.1, C).translate(x, 0.0, z), road);
    // (Rounded corners: the streets curve round each block like a real town's.)
    add(roundSlab(C - 1.6, C - 1.6, 1.15, 0.18).translate(x, 0, z), curb);
    add(roundSlab(C - 1.75, C - 1.75, 1.05, 0.2).translate(x, 0, z), walk);
    for (const [dx, dz, along] of [[q, 0, "z"], [0, q, "x"]] as const) {
      for (let k = -1; k <= 1; k++) add(along === "z" ? new THREE.BoxGeometry(0.08, 0.02, 0.6).translate(x + dx, 0.06, z + k * 1.3) : new THREE.BoxGeometry(0.6, 0.02, 0.08).translate(x + k * 1.3, 0.06, z + dz), lane);
      // Zebra crossings near both ends of this street.
      for (const end of [-1, 1]) for (let b = -2; b <= 2; b++) {
        const o = end * (q - 1.25);
        add(along === "z" ? new THREE.BoxGeometry(0.22, 0.02, 0.5).translate(x + dx + b * 0.3, 0.06, z + o) : new THREE.BoxGeometry(0.5, 0.02, 0.22).translate(x + o, 0.06, z + dz + b * 0.3), zebra);
      }
    }
  }
  // Little roundabouts where four blocks meet (inside the town; the outer street where the
  // cars and the tram run stays a plain loop): a stone curb, a round lawn with flowers and a
  // lamp-post tree in the middle, and a painted ring on the road round it.
  const roundabouts: [number, number][] = [];
  {
    const has = (gx: number, gz: number) => ALL.some(c => c[0] === gx && c[1] === gz);
    const seen = new Set<string>();
    for (const [gx, gz] of ALL) {
      for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const ax = gx + ox, az = gz + oz, key = `${ax},${az}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!(has(ax, az) && has(ax + 1, az) && has(ax, az + 1) && has(ax + 1, az + 1))) continue;
        const { x, z } = cellXZ([ax, az]);
        roundabouts.push([x + q, z + q]);
      }
    }
  }
  const ringPaint = own(new THREE.MeshBasicMaterial({ color: 0xf4f2fa }));
  for (const [x, z] of roundabouts) {
    add(new THREE.RingGeometry(0.74, 0.8, 28).rotateX(-Math.PI / 2).translate(x, 0.056, z), ringPaint);
    add(new THREE.CylinderGeometry(0.52, 0.55, 0.16, 20).translate(x, 0.1, z), curb);
    add(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 20).translate(x, 0.2, z), grass);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add(new THREE.SphereGeometry(0.06, 6, 4).translate(x + Math.cos(a) * 0.34, 0.25, z + Math.sin(a) * 0.34), mats.c(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"][k % 4], 0.8)); }
  }
  // Trees in the island's style.
  // Soft contact shadows: a blurred dark patch under trees and houses grounds them (one
  // merged draw for all of them: much cheaper than real shadows on a phone).
  const blobTex = softBlob();
  const blobM = own(new THREE.MeshBasicMaterial({ map: blobTex, color: 0x1a2a3a, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  // (All of them go into one mesh at the end of the build: one draw instead of dozens.)
  const blobGeos: THREE.BufferGeometry[] = [];
  const blob = (x: number, z: number, r: number, y = 0.2) => { blobGeos.push(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2).translate(x + r * 0.18, y + 0.012, z + r * 0.12)); };
  const tree = (x: number, z: number, s = 1, y = 0.2) => {
    blob(x, z, 0.62 * s, y);
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
  for (const [x, z] of roundabouts) tree(x, z, 0.6, 0.22);
  // The two parks by the entrance: lawns, a path, a pond, benches.
  for (const [n, cell] of PARKS.entries()) {
    const { x, z } = cellXZ(cell);
    add(roundSlab(C - 2.2, C - 2.2, 0.8, 0.06).translate(x, 0.2, z), grass);
    // A winding path and a loop instead of a straight cross.
    add(ribbon(sPath((C - 2.4) / 2, n === 1).map(([a, b]): [number, number] => [x + a, z + b]), 0.6, 0.275), pave);
    add(new THREE.RingGeometry(0.9, 1.25, 32).rotateX(-Math.PI / 2).translate(x + (n ? 0.5 : -0.5), 0.272, z + 0.6), pave);
    add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20).translate(x + (n ? -1.15 : 1.15), 0.25, z - 1.15), water);
    add(new THREE.TorusGeometry(0.78, 0.06, 6, 20).rotateX(Math.PI / 2).translate(x + (n ? -1.15 : 1.15), 0.28, z - 1.15), stone);
    for (const [a, b] of [[-1.3, 1.2], [1.3, 1.3], [n ? 1.3 : -1.3, -1.2]]) tree(x + a, z + b, 0.95);
    bench(x + 0.7, z + 0.55, 0); bench(x - 0.55, z - 0.7, Math.PI / 2);
    for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.09, 6, 4).translate(x - 1.8 + k * 0.22, 0.32, z + 1.95), mats.c(flowersOn[k % 4], 0.8));
    // One park has a playground (slide and swings), the other a gazebo.
    const px = x + (n ? 1.15 : -1.15), pz = z - 1.15;
    if (n === 0) {
      add(new THREE.BoxGeometry(1.3, 0.04, 1.1).translate(px, 0.27, pz), mats.c("#e8c48a", 0.9));
      add(new THREE.BoxGeometry(0.4, 0.06, 0.4).translate(px - 0.3, 0.75, pz), mats.c("#ff5f6d", 0.6));
      for (const [dx, dz] of [[-0.48, -0.18], [-0.12, -0.18], [-0.48, 0.18], [-0.12, 0.18]]) add(new THREE.BoxGeometry(0.04, 0.5, 0.04).translate(px + dx, 0.5, pz + dz), metal);
      add(new THREE.BoxGeometry(0.7, 0.04, 0.26).rotateZ(-0.55).translate(px + 0.18, 0.55, pz), mats.c("#ffd23f", 0.5));
      for (const dx of [0.0, 0.5]) add(new THREE.BoxGeometry(0.04, 0.7, 0.04).translate(px + dx, 0.6, pz + 0.45), mats.c("#4fc3ff", 0.6));
      add(new THREE.BoxGeometry(0.58, 0.04, 0.04).translate(px + 0.25, 0.95, pz + 0.45), mats.c("#4fc3ff", 0.6));
      add(new THREE.BoxGeometry(0.16, 0.03, 0.1).translate(px + 0.25, 0.5, pz + 0.45), mats.c("#ff5f6d", 0.6));
    } else {
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 8).translate(px, 0.29, pz), stone);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).translate(px + Math.cos(a) * 0.5, 0.65, pz + Math.sin(a) * 0.5), mats.c("#ffffff", 0.6)); }
      add(new THREE.ConeGeometry(0.75, 0.4, 8).translate(px, 1.2, pz), mats.c("#ff8a5c", 0.6));
    }
  }
  // Fire hydrants and mailboxes on the street corners.
  for (const [n, cell] of CELLS.entries()) {
    const { x, z } = cellXZ(cell), e = q - 0.95;
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8).translate(x - e, 0.33, z - e + 0.4), mats.c("#ff4f4f", 0.5));
    add(new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x - e, 0.46, z - e + 0.4), mats.c("#ff4f4f", 0.5));
    if (n % 3 === 0) { add(new THREE.BoxGeometry(0.22, 0.28, 0.18).translate(x + e - 0.4, 0.48, z - e), mats.c("#3a6fe0", 0.5)); add(new THREE.BoxGeometry(0.06, 0.26, 0.06).translate(x + e - 0.4, 0.22, z - e), metal); }
  }
  // Street furniture round the business blocks: planters at the corners, benches and bins.
  for (const [n, cell] of CELLS.entries()) {
    const { x, z } = cellXZ(cell), e = q - 1.1;
    planter(x - e, z + e, flowersOn[n % 4]);
    planter(x + e, z - e, flowersOn[(n + 1) % 4]);
    if (n % 2 === 0) bench(x - 0.9, z + e + 0.05, 0); else bench(x + e + 0.05, z - 0.9, -Math.PI / 2);
    add(new THREE.CylinderGeometry(0.11, 0.1, 0.32, 8).translate(x + e - 0.05, 0.36, z + e - 0.9), mats.c("#3fae6a", 0.6));
  }
  /** Where the beach starts: just behind the back row of streets. */
  const beachZ = cellXZ([0, 0]).z - C / 2;
  // Where the waterfall's pond sits (on the verge by the left edge; built further down).
  const fallAt = (() => { let best = hull[0]; for (const p of hull) if (p[0] - p[1] < best[0] - best[1]) best = p; return best; })();
  // (A fixed step in from the edge, on the grass verge: never out on the ring road.)
  const inX = cx - fallAt[0], inZ = cz - fallAt[1], inL = Math.hypot(inX, inZ) || 1;
  const fx0 = fallAt[0] + (inX / inL) * 1.35, fz0 = fallAt[1] + (inZ / inL) * 1.35;
  // ---- The countryside ring past the town: a winding lane, farm fields, a windmill ----
  const townTicksEarly: ((t: number) => void)[] = [];
  const coreHull = islandOutline(1.0);
  // The lane: a sandy cobbled road that wanders round the town, half way out to the edge
  // (not across the beach), with a low hedge of posts here and there.
  const laneAll = islandOutline((1.0 + ISLAND_PAD) / 2 + 0.15).filter(p => p[1] > beachZ + 0.6);
  const laneM = own(std("#e6d3a8", { roughness: 0.95 }));
  const laneEdgeM = own(std("#cbb488", { roughness: 0.95 }));
  fx.street(laneM); fx.ground(laneEdgeM, 0.4);
  const nearLane = (x: number, z: number, d: number) => { for (const [lx, lz] of laneAll) if ((lx - x) ** 2 + (lz - z) ** 2 < d * d) return true; return false; };
  {
    // (The ring is open where it meets the beach: draw only the joined-up stretches.)
    const strip = (pts: [number, number][], w: number, y: number, m: THREE.Material) => {
      const pos: number[] = [], idx: number[] = [];
      pts.forEach((pnt, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
        pos.push(pnt[0] + nx * w / 2, y, pnt[1] + nz * w / 2, pnt[0] - nx * w / 2, y, pnt[1] - nz * w / 2);
        if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      const mesh = add(geo, m);
      (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      return mesh;
    };
    const runs: [number, number][][] = [];
    let cur: [number, number][] = [];
    const ring = islandOutline((1.0 + ISLAND_PAD) / 2 + 0.15);
    // Start the walk on the beach side so each joined stretch comes out in one piece.
    let s0 = ring.findIndex(p => p[1] <= beachZ + 0.6);
    if (s0 < 0) s0 = 0;
    for (let i = 0; i <= ring.length; i++) {
      const pnt = ring[(s0 + i) % ring.length];
      if (pnt[1] > beachZ + 0.6 && insidePoly(hull, pnt[0], pnt[1], 0.95)) cur.push(pnt); else { if (cur.length > 2) runs.push(cur); cur = []; }
    }
    if (cur.length > 2) runs.push(cur);
    for (const r of runs) { strip(r, 1.05, 0.015, laneEdgeM); strip(r, 0.8, 0.03, laneM); }
  }
  // The windmill: on the countryside at the front right, its sails turning in the breeze.
  {
    let best = hull[0];
    for (const p of hull) if (p[0] - p[1] * 0.2 > best[0] - best[1] * 0.2) best = p;
    let [wx, wz] = best;
    // (Walk in from the coast until it stands well inside, clear of the railing and the lane.)
    for (let k = 0; k < 40 && (!insidePoly(hull, wx, wz, 1.6) || nearLane(wx, wz, 1.1)); k++) { wx += (cx - wx) * 0.04; wz += (cz - wz) * 0.04; }
    const wm = new THREE.Group();
    wm.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.9, 8).translate(0, 0.95, 0), mats.c("#fff6e6", 0.8)));
    wm.add(new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.62, 8).translate(0, 2.2, 0), mats.c("#c8463a", 0.7)));
    wm.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.04).translate(0, 0.21, 0.6), mats.c("#6a4a3a", 0.8)));
    wm.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.03).translate(0, 1.2, 0.5), winMat));
    blob(wx, wz, 0.95, 0.02);
    wm.position.set(wx, 0, wz);
    wm.rotation.y = Math.PI / 4; // the sails face the camera
    g.add(wm);
    const sails = new THREE.Group();
    const sailM = mats.c("#f4efe6", 0.9);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.03).translate(0, 0.6, 0), wood));
      arm.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.015).translate(0.13, 0.72, 0), sailM));
      arm.rotation.z = (k / 4) * Math.PI * 2;
      sails.add(arm);
    }
    sails.position.set(0, 1.75, 0.56);
    sails.userData.dynamic = true;
    wm.add(sails);
    townTicksEarly.push(t => { sails.rotation.z = -t * 0.7; });
  }
  // The verge: the island's own trees, bushes, flowers and boulders round the town.
  {
    const inCell = (x: number, z: number) => ALL.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 + 0.35 && Math.abs(z - p.z) < C / 2 + 0.35; });
    const inside = (x: number, z: number, m = 0.45) => insidePoly(hull, x, z, m);
    let k = 0;
    const FIELD = [["#e8c45a", "#d4a83a"], ["#7cc85a", "#5aa848"], ["#b48cdc", "#9a6ec8"], ["#c8945a", "#a8743a"]];
    for (let x = -OFF - C - ISLAND_PAD; x <= OFF + 3 * C + ISLAND_PAD; x += 1.2) for (let z = -OFF - C - ISLAND_PAD; z <= OFF + 3 * C + ISLAND_PAD; z += 1.2) {
      const jx = x + Math.sin(k * 12.9898) * 0.4, jz = z + Math.cos(k * 78.233) * 0.4, r = Math.abs(Math.sin(k * 3.7));
      k++;
      if (inCell(jx, jz) || !inside(jx, jz) || jz < beachZ + 0.3) continue;
      if (Math.hypot(jx - fx0, jz - fz0) < 1.6 || Math.hypot(jx - (fx0 + fallAt[0]) / 2, jz - (fz0 + fallAt[1]) / 2) < 1.0) continue;
      if (nearLane(jx, jz, 0.75)) continue;
      // Out in the countryside: farm fields in rows (wheat, greens, lavender, ploughed earth)
      // and the odd sheep, between the trees.
      if (!insidePoly(coreHull, jx, jz)) {
        const fh = Math.abs(Math.sin(Math.floor(jx / 2.4) * 12.1 + Math.floor(jz / 2.4) * 7.7)) % 1;
        if (fh < 0.42 && inside(jx, jz, 0.7) && !nearLane(jx, jz, 1.0)) {
          const fc = FIELD[Math.floor(fh * 100) % FIELD.length], ang = Math.floor(jx / 2.4 + jz / 2.4) % 2 ? 0 : Math.PI / 2;
          add(new THREE.BoxGeometry(1.2, 0.04, 1.2).rotateY(ang).translate(jx, 0.03, jz), mats.c(fc[1], 0.95));
          for (let row = -2; row <= 2; row++) add(new THREE.BoxGeometry(1.1, 0.07, 0.13).translate(0, 0, row * 0.22).rotateY(ang).translate(jx, 0.07, jz), mats.c(fc[0], 0.9));
          continue;
        }
        if (fh > 0.9 && inside(jx, jz, 0.8)) {
          // A sheep: a woolly body, a dark face.
          const a = k * 1.7;
          add(new THREE.SphereGeometry(0.16, 7, 5).scale(1.3, 0.9, 1).rotateY(a).translate(jx, 0.17, jz), mats.c("#fbfaf6", 0.95));
          add(new THREE.SphereGeometry(0.075, 6, 5).translate(jx + Math.cos(a) * 0.2, 0.22, jz - Math.sin(a) * 0.2), mats.c("#3a3550", 0.8));
          blob(jx, jz, 0.25, 0.0);
          continue;
        }
      }
      // Now and then, away from the very edge: a cottage, or a little vegetable garden, so the
      // outskirts look lived in rather than empty.
      const h = Math.abs(Math.sin(k * 45.1 + 7.3)) % 1;
      if (h < 0.13 && inside(jx, jz, 1.1) && !inCell(jx + 0.6, jz) && !inCell(jx - 0.6, jz) && !inCell(jx, jz + 0.6) && !inCell(jx, jz - 0.6)) {
        const face = Math.atan2(cx - jx, cz - jz), col = COTTAGE[k % COTTAGE.length];
        const ch = new THREE.Group();
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.52).translate(0, 0.21, 0), mats.c(col[0], 0.75)));
        ch.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.36, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.88).translate(0, 0.6, 0), mats.c(col[1], 0.7)));
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.02).translate(0, 0.11, 0.265), mats.c("#6a4a3a", 0.8)));
        for (const wx of [-0.19, 0.19]) ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.02).translate(wx, 0.27, 0.265), winMat));
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08).translate(0.16, 0.74, -0.08), mats.c("#b8583a", 0.8)));
        if (h < 0.06) for (let f = 0; f < 5; f++) ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03).translate(-0.4 + f * 0.2, 0.06, 0.48), mats.c("#ffffff", 0.7)));
        blob(jx, jz, 0.62, 0.13);
        ch.position.set(jx, 0.13, jz); ch.rotation.y = face;
        ch.updateMatrixWorld(true);
        ch.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) add(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material as THREE.Material); });
        continue;
      }
      if (h < 0.19 && inside(jx, jz, 0.9)) {
        // Garden rows: brown beds with green tops.
        const ga = Math.atan2(cx - jx, cz - jz);
        for (let row = 0; row < 3; row++) {
          const ox = Math.cos(ga) * (row - 1) * 0.22, oz = -Math.sin(ga) * (row - 1) * 0.22;
          add(new THREE.BoxGeometry(0.16, 0.06, 0.6).rotateY(ga).translate(jx + ox, 0.14, jz + oz), earth);
          for (let q = 0; q < 3; q++) add(new THREE.SphereGeometry(0.06, 5, 4).translate(jx + ox + Math.sin(ga) * (q - 1) * 0.18, 0.2, jz + oz + Math.cos(ga) * (q - 1) * 0.18), mats.c(q % 2 ? "#5ec26a" : "#8ad06a", 0.8));
        }
        continue;
      }
      if (r < 0.4) tree(jx, jz, 0.7 + r, 0);
      else if (r < 0.6) add(new THREE.IcosahedronGeometry(0.28, 0).translate(jx, 0.15, jz), leaf);
      else if (r < 0.72) add(new THREE.DodecahedronGeometry(0.22 + r * 0.2, 0).translate(jx, 0.1, jz), stone);
      else add(new THREE.SphereGeometry(0.1, 6, 4).translate(jx, 0.12, jz), mats.c(flowersOn[k % 4], 0.8));
    }
    // A low railing of posts and a rail along the island's edge.
    const rail = grow(hull, -0.3);
    let railRun = 0;
    for (let i = 0; i < rail.length; i++) {
      const a = rail[i], b = rail[(i + 1) % rail.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((a[1] + b[1]) / 2 < beachZ - 0.5) continue; // the beach is open to the sea
      const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add(new THREE.BoxGeometry(0.06, 0.06, len).rotateY(ang).translate((a[0] + b[0]) / 2, 0.45, (a[1] + b[1]) / 2), stone);
      // A post every 1.4 along the edge (the curved coastline has many short pieces).
      for (let d = (1.4 - (railRun % 1.4)) % 1.4; d < len; d += 1.4) add(new THREE.BoxGeometry(0.12, 0.45, 0.12).translate(a[0] + ((b[0] - a[0]) * d) / len, 0.22, a[1] + ((b[1] - a[1]) * d) / len), stone);
      railRun += len;
    }
  }
  // A waterfall pouring off the island's left edge from a little pond.
  add(new THREE.CylinderGeometry(0.8, 0.85, 0.08, 20).translate(fx0, 0.06, fz0), water);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; add(new THREE.DodecahedronGeometry(0.11 + (k % 3) * 0.03, 0).translate(fx0 + Math.cos(a) * 0.88, 0.08, fz0 + Math.sin(a) * 0.88), stone); }
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
  const decor = new Set(cafe.decor ?? []);
  // The golden founder statue (a decoration): on top of the fountain, arm raised.
  if (decor.has("statue")) {
    const gold = mats.gold, sx = pz.x, sz = pz.z, y0 = 1.51;
    add(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 12).translate(sx, y0 + 0.11, sz), stone);
    add(new THREE.CapsuleGeometry(0.13, 0.36, 4, 10).translate(sx, y0 + 0.52, sz), gold);
    add(new THREE.SphereGeometry(0.12, 12, 10).translate(sx, y0 + 0.9, sz), gold);
    add(new THREE.CapsuleGeometry(0.04, 0.32, 3, 6).rotateZ(-0.5).translate(sx + 0.2, y0 + 0.86, sz), gold);
    add(new THREE.CapsuleGeometry(0.04, 0.28, 3, 6).rotateZ(0.3).translate(sx - 0.17, y0 + 0.48, sz), gold);
    add(new THREE.BoxGeometry(0.16, 0.05, 0.1).translate(sx + 0.36, y0 + 1.06, sz), gold);
    jet.visible = false;
  }
  // Island upgrades bought with cash (data/decor.ts): each appears in the town for good.
  const townTicks: ((t: number, night: number) => void)[] = [];
  townTicks.push(t => { for (const f of townTicksEarly) f(t); });
  const glowDecor = own(std("#fff2b0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
  glowDecor.userData.dynamic = true;
  townTicks.push((_t, night) => { glowDecor.emissiveIntensity = 0.2 + night * 2.2; });
  if (decor.has("foodtrucks")) {
    // Three trucks on the plaza, between the planters, each with its awning open.
    const cols = [["#ff6b5a", "#ffd23a"], ["#4f8bff", "#ffffff"], ["#5ee0a0", "#ff8a5c"]];
    [0.39, 2.75, 5.11].forEach((a, k) => {
      const tg = new THREE.Group();
      tg.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.38).translate(0, 0.28, 0), mats.c(cols[k][0], 0.5)));
      tg.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.36).translate(0.44, 0.23, 0), mats.c(cols[k][0], 0.5)));
      tg.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.37).translate(0.46, 0.3, 0), mats.c("#9fd8ff", 0.1, 0.3)));
      tg.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.2).rotateX(-0.5).translate(-0.05, 0.5, 0.26), mats.c(cols[k][1], 0.6)));
      tg.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.02).translate(-0.05, 0.32, 0.195), glowDecor));
      for (const x of [-0.22, 0.38]) tg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateX(Math.PI / 2).translate(x, 0.08, 0.2), mats.c("#2a2f4a", 0.6)));
      const r = 1.82;
      tg.position.set(pz.x + Math.cos(a) * r, 0.26, pz.z + Math.sin(a) * r);
      tg.rotation.y = -a - Math.PI / 2;
      tg.scale.setScalar(0.85);
      g.add(tg);
    });
  }
  if (decor.has("garden")) {
    // A glass dome by the pond: plants inside, a warm glow after dark.
    const gx = fx0 - (inZ / inL) * 2.2, gz = fz0 + (inX / inL) * 2.2;
    add(new THREE.CylinderGeometry(1.0, 1.05, 0.12, 24).translate(gx, 0.12, gz), stone);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(gx, 0.18, gz),
      own(new THREE.MeshStandardMaterial({ color: 0xd9f4ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, depthWrite: false })));
    dome.userData.dynamic = true;
    g.add(dome);
    for (let k = 0; k < 6; k++) add(new THREE.TorusGeometry(0.95, 0.015, 4, 24, Math.PI).rotateY((k / 6) * Math.PI).translate(gx, 0.18, gz), metal);
    for (let k = 0; k < 5; k++) { const a = k * 1.3; add(new THREE.IcosahedronGeometry(0.22 + (k % 2) * 0.08, 0).translate(gx + Math.cos(a) * 0.45, 0.4, gz + Math.sin(a) * 0.45), leaf); }
    add(new THREE.SphereGeometry(0.12, 8, 6).translate(gx, 0.95, gz), glowDecor);
  }
  if (decor.has("skytram") && islets[0]) {
    // A cable car from a little station on the edge out to the first floating island.
    const it = islets[0], st = new THREE.Vector3(it.o.position.x + 3.4, 0.9, it.o.position.z);
    add(new THREE.BoxGeometry(0.5, 0.8, 0.5).translate(st.x, 0.4, st.z), mats.c("#e9e4f5", 0.6));
    add(new THREE.BoxGeometry(0.6, 0.08, 0.6).translate(st.x, 0.84, st.z), mats.c("#ff5f8b", 0.5));
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), own(new THREE.LineBasicMaterial({ color: 0x3a3f5a })));
    cable.frustumCulled = false; cable.userData.dynamic = true; g.add(cable);
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.2).translate(0, -0.22, 0), mats.c("#ff5f8b", 0.4)));
    car.add(new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.21).translate(0, -0.19, 0), mats.c("#9fd8ff", 0.1, 0.3)));
    car.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4).translate(0, -0.06, 0), metal));
    car.userData.dynamic = true; g.add(car);
    const end = new THREE.Vector3();
    townTicks.push(t => {
      end.set(it.o.position.x, it.o.position.y + 0.6, it.o.position.z);
      const pos = cable.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, st.x, st.y, st.z); pos.setXYZ(1, end.x, end.y, end.z); pos.needsUpdate = true;
      const ph = (t * 0.06) % 2, k = ph < 1 ? ph : 2 - ph, e2 = k * k * (3 - 2 * k);
      car.position.lerpVectors(st, end, e2);
      car.position.y -= Math.sin(e2 * Math.PI) * 0.15;
    });
  }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; planter(pz.x + Math.cos(a) * 2.0, pz.z + Math.sin(a) * 2.0, flowersOn[k % 4]); }
  // Street lamps on the block corners (their light falls on the ground at night).
  const lampAt: THREE.Vector3[] = [];
  const pole = metal;
  const lampMat = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
  lampMat.userData.dynamic = true;
  for (const cell of CELLS) {
    // (On the sidewalk's rounded corner: further in than the lot's square corner would be.)
    const { x, z } = cellXZ(cell), e = q - 1.55;
    for (const [a, b] of [[e, e], [-e, -e]]) {
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(x + a, 0.9, z + b), pole);
      add(new THREE.SphereGeometry(0.12, 8, 6).translate(x + a, 1.65, z + b), lampMat);
      lampAt.push(new THREE.Vector3(x + a, 1.65, z + b));
    }
  }  // ---- The beach and the sea, along the back of the island ----
  // Sand just behind the back streets, then shallow turquoise water and the sea out to the
  // island's edge: palms, umbrellas and loungers, a beach hut, a lifeguard chair, a pier
  // with a bobbing sailboat, buoys, waves washing in, and a lighthouse on the corner.
  const clipZ = (poly: [number, number][], z0: number, keepBelow: boolean): [number, number][] => {
    const out: [number, number][] = [], inn = (p: [number, number]) => (keepBelow ? p[1] <= z0 : p[1] >= z0);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (inn(a)) out.push(a);
      if (inn(a) !== inn(b)) { const k = (z0 - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * k, z0]); }
    }
    return out;
  };
  const zShore = beachZ - 2.3;
  const shoreIn = grow(hull, -0.22);
  const sandPoly = clipZ(clipZ(shoreIn, beachZ - 0.05, true), zShore - 0.4, false);
  const seaPoly = clipZ(shoreIn, zShore, true);
  const sandM = own(std("#f3dca4", { roughness: 1 }));
  const wetSandM = own(std("#dcc28a", { roughness: 0.9 }));
  const seaM = own(std("#2aa6e6", { roughness: 0.08, metalness: 0.15, emissive: 0x0a4a8a, emissiveIntensity: 0.15 }));
  seaM.userData.dynamic = true;
  const shallowM = own(std("#7fe0e6", { roughness: 0.1, metalness: 0.1, emissive: 0x1a6a7a, emissiveIntensity: 0.1 }));
  shallowM.userData.dynamic = true;
  fx.water(seaM, true); fx.water(shallowM, true); fx.ground(sandM, 0.5); fx.ground(wetSandM, 0.4);
  let beachLive = (_t: number, _night: number) => {};
  let beachSpot: { x: number; z: number } | null = null;
  if (sandPoly.length >= 3 && seaPoly.length >= 3) {
    slab(sandPoly, 0.08, 0.06, sandM);
    slab(clipZ(sandPoly, zShore + 0.35, true), 0.02, 0.065, wetSandM);
    slab(seaPoly, 0.08, 0.035, seaM);
    slab(clipZ(seaPoly, zShore - 0.9, false), 0.02, 0.045, shallowM);
    // Deeper water further out, and glints of light on the waves.
    const deepM = own(std("#1a7fd0", { roughness: 0.06, metalness: 0.2, emissive: 0x062a5a, emissiveIntensity: 0.15 }));
    fx.water(deepM, true);
    slab(clipZ(grow(seaPoly, -0.6), zShore - 3.2, true), 0.02, 0.042, deepM);
    const glintM = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    glintM.userData.dynamic = true;
    const glints = new THREE.Group();
    glints.userData.dynamic = true;
    {
      let k = 0;
      const sx = seaPoly.map(q => q[0]), sz = seaPoly.map(q => q[1]);
      const inSea = (x: number, z: number) => insidePoly(seaPoly, x, z, 0.3);
      for (let x = Math.min(...sx); x < Math.max(...sx); x += 1.1) for (let z = Math.min(...sz); z < zShore - 0.8; z += 0.9) {
        const jx = x + Math.sin(k * 12.9898) * 0.45, jz = z + Math.cos(k * 78.233) * 0.35;
        k++;
        if (!inSea(jx, jz) || Math.abs(Math.sin(k * 3.1)) < 0.35) continue;
        glints.add(new THREE.Mesh(new THREE.BoxGeometry(0.32 + Math.abs(Math.sin(k)) * 0.3, 0.01, 0.04).translate(jx, 0.07, jz), glintM));
      }
    }
    // (The water shader makes its own glitter now.)
    glints.visible = false;
    g.add(glints);
    const xs = sandPoly.map(p => p[0]), x0 = Math.min(...xs) + 0.9, x1 = Math.max(...xs) - 0.9;
    const seaXs = (z: number) => { const c = clipZ(clipZ(seaPoly, z + 0.05, true), z - 0.05, false).map(p => p[0]); return c.length ? [Math.min(...c), Math.max(...c)] : [x0, x1]; };
    const zs = (beachZ + zShore) / 2;
    // Palms: a leaning, ringed trunk, drooping fronds and coconuts.
    const palmLeaf = own(std("#3fae5a", { roughness: 0.9, flatShading: true }));
    fx.sway(palmLeaf, 0.9, 0.06);
    const palm = (x: number, z: number, h: number, lean: number) => {
      const top = new THREE.Vector3(x + lean, 0.1 + h, z);
      for (let k = 0; k < 4; k++) {
        const f0 = k / 4, f1 = (k + 1) / 4, y0 = 0.1 + h * f0, y1 = 0.1 + h * f1;
        const seg = new THREE.CylinderGeometry(0.07 - k * 0.008, 0.09 - k * 0.008, h / 4 + 0.02, 6);
        const m = new THREE.Mesh(seg, trunk);
        m.position.set(x + lean * (f0 + f1) / 2 * ((f0 + f1) / 2), (y0 + y1) / 2, z);
        m.rotation.z = -lean * 0.35 * (k + 1) / 4;
        g.add(m);
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const fr = new THREE.BoxGeometry(0.9, 0.04, 0.22).translate(0.42, 0, 0).rotateZ(-0.45).rotateY(a);
        add(fr.translate(top.x, top.y, top.z), palmLeaf);
      }
      for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.06, 6, 4).translate(top.x + Math.cos(k * 2.1) * 0.1, top.y - 0.08, top.z + Math.sin(k * 2.1) * 0.1), mats.c("#7a5230", 0.8));
    };
    // Umbrellas with towels and loungers under them.
    const stripes = ["#ff5f6d", "#ffd23f", "#4fc3ff", "#b48cff", "#3fd18a"];
    const umbrella = (x: number, z: number, n: number) => {
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6).translate(x, 0.6, z), mats.c("#ffffff", 0.5));
      const c1 = stripes[n % stripes.length], c2 = "#ffffff";
      for (let k = 0; k < 8; k++) {
        const cone = new THREE.ConeGeometry(0.6, 0.3, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4).translate(x, 1.15, z);
        add(cone, mats.c(k % 2 ? c1 : c2, 0.7));
      }
      add(new THREE.BoxGeometry(0.42, 0.02, 0.8).translate(x + 0.25, 0.12, z + 0.15), mats.c(stripes[(n + 2) % stripes.length], 0.8));
      const lx = x - 0.45;
      add(new THREE.BoxGeometry(0.34, 0.06, 0.6).translate(lx, 0.22, z + 0.1), mats.c("#ffffff", 0.6));
      add(new THREE.BoxGeometry(0.34, 0.06, 0.3).rotateX(-0.6).translate(lx, 0.33, z - 0.27), mats.c("#ffffff", 0.6));
      for (const [dx, dz] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.15], [0.14, -0.15]]) add(new THREE.BoxGeometry(0.03, 0.12, 0.03).translate(lx + dx, 0.14, z + dz), metal);
    };
    const span = x1 - x0;
    palm(x0 + 0.2, zs + 0.5, 1.7, 0.25);
    palm(x0 + span * 0.36, zs - 0.4, 2.0, -0.2);
    palm(x0 + span * 0.7, zs + 0.6, 1.8, 0.2);
    palm(x1 - 0.1, zs - 0.2, 2.1, -0.25);
    umbrella(x0 + span * 0.16, zs - 0.15, 0);
    umbrella(x0 + span * 0.5, zs + 0.2, 1);
    umbrella(x0 + span * 0.84, zs - 0.1, 2);
    // A beach hut with a striped awning, a lifeguard chair, a sandcastle and a beach ball.
    {
      const hx = x0 + span * 0.28, hz = beachZ - 0.55;
      add(new THREE.BoxGeometry(1.0, 0.7, 0.7).translate(hx, 0.45, hz), mats.c("#fff6e0", 0.7));
      add(new THREE.CylinderGeometry(0.01, 0.72, 0.4, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.75).translate(hx, 1.0, hz), mats.c("#4fc3ff", 0.6));
      add(new THREE.BoxGeometry(0.4, 0.45, 0.03).translate(hx, 0.33, hz - 0.36), mats.c("#c86a4a", 0.7));
      for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.2, 0.03, 0.3).rotateX(0.4).translate(hx - 0.4 + k * 0.2, 0.72, hz - 0.45), mats.c(k % 2 ? "#ffffff" : "#ff5f6d", 0.7));
      const gx = x0 + span * 0.62, gz = zs - 0.1;
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(new THREE.BoxGeometry(0.05, 1.0, 0.05).translate(gx + dx, 0.55, gz + dz), mats.c("#ffffff", 0.6));
      add(new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(gx, 1.05, gz), mats.c("#ff4f4f", 0.6));
      add(new THREE.BoxGeometry(0.4, 0.35, 0.05).translate(gx, 1.25, gz + 0.22), mats.c("#ff4f4f", 0.6));
      const cxs = x0 + span * 0.42, czs = zShore + 0.55;
      add(new THREE.BoxGeometry(0.4, 0.18, 0.4).translate(cxs, 0.16, czs), sandM);
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 6).translate(cxs + dx, 0.22, czs + dz), sandM);
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.38, 6).translate(cxs, 0.37, czs), sandM);
      add(new THREE.SphereGeometry(0.13, 10, 8).translate(x0 + span * 0.92, 0.2, zs + 0.5), mats.c("#ff6fa0", 0.5));
    }
    // The pier out into the sea, on posts, with a lamp at the end.
    const px = x0 + span * 0.55, pz0 = zShore + 0.3, pz1 = Math.max(zShore - 3.2, Math.min(...seaPoly.map(q => q[1])) + 0.7);
    add(new THREE.BoxGeometry(0.7, 0.07, pz0 - pz1).translate(px, 0.32, (pz0 + pz1) / 2), wood);
    for (let z = pz0 - 0.3; z > pz1; z -= 0.7) for (const dx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).translate(px + dx, 0.12, z), wood);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6).translate(px + 0.3, 0.75, pz1 + 0.1), metal);
    add(new THREE.SphereGeometry(0.08, 8, 6).translate(px + 0.3, 1.18, pz1 + 0.1), lampMat);
    // A sailboat tied up by the pier, bobbing.
    const boat = new THREE.Group();
    {
      const hullShape = new THREE.Shape([new THREE.Vector2(-0.55, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.75, 0.22), new THREE.Vector2(-0.7, 0.22)]);
      boat.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.36, bevelEnabled: false }).translate(0, 0, -0.18), mats.c("#ffffff", 0.5)));
      boat.add(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.38).translate(0, 0.22, 0), mats.c("#c8a070", 0.8)));
      boat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6).translate(0, 0.85, 0), metal));
      const sail = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0, 1.05)]);
      boat.add(new THREE.Mesh(new THREE.ShapeGeometry(sail).translate(0.02, 0.32, 0), own(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }))));
      boat.add(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 0.37).translate(0, 0.08, 0), mats.c("#ff5f6d", 0.6)));
    }
    boat.position.set(px + 1.2, 0.02, (pz0 + pz1) / 2 - 0.4);
    boat.rotation.y = Math.PI / 2 + 0.3;
    boat.userData.dynamic = true;
    g.add(boat);
    // Buoys out at sea.
    const buoys: THREE.Mesh[] = [];
    const [sx0, sx1] = seaXs(zShore - 2.4);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mats.c(k % 2 ? "#ffffff" : "#ff4f4f", 0.5));
      b.position.set(sx0 + 0.8 + ((sx1 - sx0 - 1.6) * k) / 3, 0.1, zShore - 2.4 - (k % 2) * 0.3);
      b.userData.dynamic = true;
      buoys.push(b); g.add(b);
    }
    // Waves washing in: soft white foam lines that roll up the sand and fade.
    const foams: { m: THREE.Mesh; z: number; k: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const z = zShore - 0.25 - k * 0.55, [fx0, fx1] = seaXs(z);
      const fm = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.5, fx1 - fx0 - 0.5), 0.015, 0.09).translate((fx0 + fx1) / 2, 0.085, 0), fm);
      m.position.z = z;
      m.userData.dynamic = true;
      foams.push({ m, z, k }); g.add(m);
    }
    // Out at sea: a second sailboat and a little rocky islet with a palm.
    const boat2 = boat.clone();
    boat2.scale.setScalar(0.8);
    const [ox0, ox1] = seaXs(zShore - 3.6);
    boat2.position.set(ox0 + (ox1 - ox0) * 0.3, 0.02, zShore - 3.6);
    boat2.rotation.y = -0.4;
    boat2.userData.dynamic = true;
    g.add(boat2);
    // More boats: a speedboat crossing with a white wake, a sailboat tacking slowly out at sea,
    // and a little rowboat by the islet.
    const motor = new THREE.Group();
    motor.add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.3).translate(0, 0.07, 0), mats.c("#ffffff", 0.4)));
    motor.add(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.47, 1).translate(0.52, 0.07, 0), mats.c("#ffffff", 0.4)));
    motor.add(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.31).translate(0, 0.03, 0), mats.c("#2f6fff", 0.5)));
    motor.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.24).translate(-0.05, 0.2, 0), mats.c("#ffd23a", 0.5)));
    motor.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22).translate(0.1, 0.22, 0), mats.c("#9fd8ff", 0.1, 0.3)));
    const wakeM = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34).rotateX(-Math.PI / 2).translate(-1.05, 0.01, 0), wakeM);
    motor.add(wake);
    motor.userData.dynamic = true;
    g.add(motor);
    const mz = zShore - 2.2, [mx0, mx1] = seaXs(mz);
    const sail3 = boat.clone();
    sail3.scale.setScalar(0.7);
    sail3.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide) m.material = own(new THREE.MeshStandardMaterial({ color: 0xffb3c8, side: THREE.DoubleSide, roughness: 0.6 })); });
    sail3.userData.dynamic = true;
    g.add(sail3);
    const sz3 = zShore - 4.2, [sx3a, sx3b] = seaXs(sz3);
    const row = new THREE.Group();
    row.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.18).translate(0, 0.04, 0), mats.c("#c8783a", 0.8)));
    row.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.2).translate(0, 0.09, 0), mats.c("#8a4a22", 0.8)));
    const rower = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 3, 6).translate(0, 0.18, 0), mats.c("#ff6b5a", 0.7));
    row.add(rower);
    row.userData.dynamic = true;
    g.add(row);
    const islet = { x: ox0 + (ox1 - ox0) * 0.72, z: zShore - 4.6 };
    row.position.set(islet.x - 1.6, 0.03, islet.z + 0.6);
    {
      const { x: ix, z: iz } = islet;
      add(new THREE.DodecahedronGeometry(1.2, 0).scale(1.3, 0.35, 1).translate(ix, 0.05, iz), rock);
      add(new THREE.CylinderGeometry(1.15, 1.35, 0.12, 12).translate(ix, 0.16, iz), sandM);
      palm(ix + 0.55, iz + 0.45, 1.3, 0.2);
    }
    // A lighthouse on the back corner, its lamp glowing at night.
    // (It stands on the islet, where it's always in view.)
    const lx = islet.x - 0.35, lz = islet.z - 0.2;
    add(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 10).translate(lx, 0.3, lz), rockDark);
    for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.42 - k * 0.04, 0.46 - k * 0.04, 0.5, 14).translate(lx, 0.7 + k * 0.5, lz), mats.c(k % 2 ? "#ff4f4f" : "#ffffff", 0.5));
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14).translate(lx, 3.2, lz), metal);
    const lhLamp = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.3 }));
    lhLamp.userData.dynamic = true;
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10).translate(lx, 3.42, lz), lhLamp);
    add(new THREE.ConeGeometry(0.32, 0.35, 10).translate(lx, 3.75, lz), mats.c("#ff4f4f", 0.5));
    // Seagulls circling over the water, wings flapping now and then, and a kite on the beach.
    const gullM = own(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const gullTip = own(new THREE.MeshLambertMaterial({ color: 0x3a3f5a }));
    const scx = seaPoly.reduce((a, q) => a + q[0], 0) / seaPoly.length, scz = seaPoly.reduce((a, q) => a + q[1], 0) / seaPoly.length;
    const gulls = [0, 1, 2, 3, 4, 5].map(k => {
      const bird = new THREE.Group();
      bird.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.18), gullM));
      const wing = (side: number) => {
        const w = new THREE.Group();
        w.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.09).translate(side * 0.13, 0, 0), gullM));
        w.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.08).translate(side * 0.27, 0, 0), gullTip));
        bird.add(w);
        return w;
      };
      const l = wing(-1), r = wing(1);
      bird.userData.dynamic = true;
      g.add(bird);
      return { bird, l, r, k, rad: 1.4 + (k % 3) * 0.8, h: 2.0 + k * 0.32, sp: (0.34 - (k % 3) * 0.06) * (k > 2 ? -1 : 1) };
    });
    const kite = new THREE.Group();
    kite.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.01).rotateZ(Math.PI / 4), own(std("#ff4f8b", { roughness: 0.6, side: THREE.DoubleSide }))));
    kite.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.005).translate(0, -0.35, 0), own(std("#ffd23a"))));
    kite.userData.dynamic = true;
    g.add(kite);
    // (Flown from the middle of the beach, out over the water: the string crosses nothing.)
    const kx = x0 + span * 0.46, kz = zs - 0.3;
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), own(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })));
    string.userData.dynamic = true;
    string.frustumCulled = false;
    g.add(string);
    // (Sun rays are drawn by the renderer's final pass, from the sun's corner of the screen.)
    beachSpot = { x: x0 + span * 0.5, z: zs };
    const kiteAt = new THREE.Vector3();
    const seaLife = (t: number) => {
      for (const q of gulls) {
        const a = t * q.sp + q.k * 2.1;
        q.bird.position.set(scx + Math.cos(a) * q.rad, q.h + Math.sin(t * 0.7 + q.k) * 0.15, scz + Math.sin(a) * q.rad * 0.6);
        q.bird.rotation.y = q.sp > 0 ? -a + Math.PI : -a;
        q.bird.rotation.z = 0.25;
        // Flap for a moment, then glide.
        const flap = Math.sin(t * 0.5 + q.k * 1.7) > 0.3 ? Math.sin(t * 11 + q.k) * 0.5 : 0.08;
        q.l.rotation.z = flap; q.r.rotation.z = -flap;
      }
      const kp = kiteAt.set(kx + 0.6 + Math.sin(t * 0.6) * 0.25, 2.4 + Math.sin(t * 0.9) * 0.2, kz - 1.2);
      kite.position.copy(kp);
      kite.rotation.z = Math.sin(t * 1.3) * 0.25;
      const pos = string.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, kx, 0.4, kz); pos.setXYZ(1, kp.x, kp.y - 0.15, kp.z); pos.needsUpdate = true;
    };
    // ---- Decorations bought with Sky Crystals ----
    let decorLive = (_t: number, _night: number) => {};
    {
      const parts: ((t: number, night: number) => void)[] = [];
      const white = mats.c("#ffffff", 0.35), navy = mats.c("#1f2a5a", 0.4), wood2 = mats.c("#b07a4a", 0.7);
      const glow = own(std("#fff2b0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
      glow.userData.dynamic = true;
      parts.push((_t, night) => { glow.emissiveIntensity = 0.2 + night * 2.2; });
      if (decor.has("yacht")) {
        const y = new THREE.Group();
        const hs = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(0.9, 0), new THREE.Vector2(1.35, 0.16), new THREE.Vector2(0.9, 0.3), new THREE.Vector2(-1.1, 0.3)]);
        y.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.6, bevelEnabled: false }).translate(0, 0, -0.3), white));
        y.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.62).translate(0.05, 0.07, 0), navy));
        y.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 0.48).translate(-0.15, 0.42, 0), white));
        y.add(new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.07, 0.5).translate(-0.15, 0.42, 0), navy));
        y.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.38).translate(-0.3, 0.63, 0), white));
        y.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.4).translate(-0.3, 0.64, 0), glow));
        y.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5).translate(-0.4, 0.95, 0), metal));
        for (let k = 0; k < 5; k++) y.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4).translate(-0.85 + k * 0.4, 0.33, 0.31), glow));
        const yz = zShore - 3.0, [ya, yb] = seaXs(yz);
        y.position.set(ya + (yb - ya) * 0.55, 0.03, yz);
        y.rotation.y = 0.35;
        y.scale.setScalar(0.85);
        y.userData.dynamic = true;
        g.add(y);
        parts.push(t => { y.position.y = 0.03 + Math.sin(t * 0.9) * 0.03; y.rotation.z = Math.sin(t * 0.7) * 0.025; });
      }
      if (decor.has("wheel")) {
        // On the sand at the far end of the beach.
        const w = new THREE.Group(), R = 1.05, hub = new THREE.Group();
        const rimM = mats.c("#ff5f8b", 0.4), legM = mats.c("#e8e4f4", 0.5);
        for (const side of [-0.18, 0.18]) {
          for (const lean of [-0.42, 0.42]) w.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.45, 0.06).rotateZ(lean).translate(lean * -0.75, 0.68, side), legM));
          hub.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 6, 32).translate(0, 0, side), rimM));
        }
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          hub.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, R, 0.03).translate(0, R / 2, 0).rotateZ(a), legM));
          hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4).translate(Math.sin(-a) * R, Math.cos(a) * R, 0.2), glow));
        }
        hub.position.y = 1.38;
        w.add(hub);
        const gondolas = Array.from({ length: 8 }, (_, k) => {
          const gm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), mats.c(["#ffd23a", "#4f8bff", "#5ee0a0", "#ff8a5c"][k % 4], 0.5));
          w.add(gm);
          return { gm, a: (k / 8) * Math.PI * 2 };
        });
        w.position.set(x1 - span * 0.12, 0.08, zs + 0.2);
        w.rotation.y = Math.PI / 2.4;
        w.userData.dynamic = true;
        g.add(w);
        parts.push((t, night) => {
          const r = t * 0.25;
          hub.rotation.z = r;
          for (const q of gondolas) q.gm.position.set(Math.sin(-(q.a + r)) * R, 1.38 + Math.cos(q.a + r) * R - 0.12, 0);
          rimM.emissive.setRGB(0.6, 0.1, 0.3).multiplyScalar(night * 0.8);
        });
      }
      if (decor.has("balloon")) {
        const b = new THREE.Group();
        const cols = ["#ff5f6d", "#ffd23a", "#4f8bff", "#ffffff", "#5ee0a0", "#ff8a5c"];
        for (let k = 0; k < 6; k++) b.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 4, 12, (k / 6) * Math.PI * 2, Math.PI / 3).scale(1, 1.18, 1), mats.c(cols[k], 0.6)));
        b.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 12, 1, true).rotateX(Math.PI).translate(0, -0.78, 0), mats.c("#ff5f6d", 0.6)));
        b.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2).translate(0, -1.18, 0), wood2));
        b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4).translate(0.08, -1.0, 0.08), metal));
        b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4).translate(-0.08, -1.0, -0.08), metal));
        b.userData.dynamic = true;
        g.add(b);
        const cx2 = (fl.x0 + fl.x1) / 2, cz2 = (fl.z0 + fl.z1) / 2;
        parts.push(t => { const a = t * 0.03; b.position.set(cx2 + Math.cos(a) * 4, 8.2 + Math.sin(t * 0.3) * 0.3, cz2 + Math.sin(a) * 5.5); b.rotation.y = t * 0.1; });
      }
      if (decor.has("seaplane")) {
        const pl = new THREE.Group(), prop = new THREE.Group();
        pl.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8).rotateZ(Math.PI / 2), white));
        pl.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 1.2).translate(0.05, 0.08, 0), mats.c("#ff5f6d", 0.5)));
        pl.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.4).translate(-0.38, 0.06, 0), mats.c("#ff5f6d", 0.5)));
        pl.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02).translate(-0.4, 0.13, 0), mats.c("#ff5f6d", 0.5)));
        for (const z of [-0.25, 0.25]) pl.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.45, 3, 6).rotateZ(Math.PI / 2).translate(0.05, -0.2, z), white));
        prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.3, 0.04), navy));
        prop.position.x = 0.42;
        pl.add(prop);
        pl.userData.dynamic = true;
        g.add(pl);
        const cx2 = (fl.x0 + fl.x1) / 2, cz2 = (fl.z0 + fl.z1) / 2, rx = (fl.x1 - fl.x0) / 2, rz = (fl.z1 - fl.z0) / 2;
        parts.push(t => {
          const a = t * 0.12;
          pl.position.set(cx2 + Math.cos(a) * rx, 3.6 + Math.sin(t * 0.5) * 0.2, cz2 + Math.sin(a) * rz);
          pl.rotation.set(0.25, -a - Math.PI / 2 + Math.PI, 0);
          pl.rotation.y = Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz) - Math.PI / 2;
          prop.rotation.x = t * 40;
        });
      }
      if (decor.has("fireworks")) {
        // Bursts over the sea after dark.
        const N = 48, bursts = [0, 1, 2].map(k => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
          const m = own(new THREE.PointsMaterial({ color: ["#ff5f8b", "#ffd23a", "#7fd8ff"][k], size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
          const pts = new THREE.Points(geo, m);
          pts.frustumCulled = false;
          pts.userData.dynamic = true;
          g.add(pts);
          const dirs = Array.from({ length: N }, (_, i) => { const u = (i + 0.5) / N, th = Math.acos(1 - 2 * u), ph = i * 2.39996; return new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); });
          return { pts, m, geo, dirs, k };
        });
        const fz = zShore - 3.5, [fa, fb] = seaXs(fz);
        parts.push((t, night) => {
          for (const q of bursts) {
            const per = 3.2, ph = ((t + q.k * 1.1) % per) / per, lap = Math.floor((t + q.k * 1.1) / per);
            q.pts.visible = night > 0.5 && ph < 0.75;
            if (!q.pts.visible) continue;
            const cx3 = fa + (fb - fa) * (0.25 + ((lap * 37 + q.k * 13) % 50) / 100), cy = 4 + (lap % 3) * 0.6, r = 1.4 * Math.sqrt(ph / 0.75);
            const pos = q.geo.getAttribute("position") as THREE.BufferAttribute;
            q.dirs.forEach((d, i) => pos.setXYZ(i, cx3 + d.x * r, cy + d.y * r - ph * ph * 1.2, fz + d.z * r));
            pos.needsUpdate = true;
            q.m.opacity = 1 - ph / 0.75;
          }
        });
      }
      if (decor.has("beachclub")) {
        // A thatched cabana bar with stools, loungers in a row and lanterns on poles.
        const bx = x0 + span * 0.6, bz = zs + 0.35;
        const thatch = mats.c("#d8a85a", 0.9), wood3 = mats.c("#a0683a", 0.8);
        add(new THREE.BoxGeometry(1.1, 0.42, 0.5).translate(bx, 0.27, bz), wood3);
        add(new THREE.BoxGeometry(1.2, 0.05, 0.6).translate(bx, 0.5, bz), mats.c("#f4efe6", 0.6));
        for (const [x, z] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5).translate(bx + x, 0.5, bz + z), wood3);
        add(new THREE.ConeGeometry(0.95, 0.45, 4).rotateY(Math.PI / 4).translate(bx, 1.15, bz), thatch);
        for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.07, 0.06, 0.25, 8).translate(bx - 0.4 + k * 0.4, 0.17, bz + 0.45), mats.c("#ff5f8b", 0.5));
        for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.22, 0.05, 0.55).rotateX(-0.25).translate(bx + 1.0 + k * 0.32, 0.14, bz - 0.1), mats.c(["#4f8bff", "#ffd23a", "#5ee0a0", "#ff8a5c"][k], 0.6));
        for (const x of [-0.9, 0.9]) { add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5).translate(bx + x, 0.5, bz + 0.6), wood3); add(new THREE.SphereGeometry(0.07, 8, 6).translate(bx + x, 0.97, bz + 0.6), glow); }
      }
      if (decor.has("marina")) {
        // A second pier with three little motorboats moored along it.
        const mx = x0 + span * 0.82, m0 = zShore + 0.3, m1 = zShore - 2.4;
        add(new THREE.BoxGeometry(0.45, 0.06, m0 - m1).translate(mx, 0.12, (m0 + m1) / 2), wood);
        for (let z = m1; z < m0; z += 0.6) for (const x of [-0.2, 0.2]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5).translate(mx + x, 0.02, z), wood);
        add(new THREE.BoxGeometry(1.2, 0.06, 0.4).translate(mx, 0.12, m1 + 0.2), wood);
        const moored: THREE.Group[] = [];
        ([[-0.55, m1 + 0.6], [0.55, m1 + 1.1], [-0.55, m1 + 1.7]] as const).forEach(([dx, z], k) => {
          const mb = new THREE.Group();
          mb.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.5).translate(0, 0.05, 0), white));
          mb.add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.45, 1).translate(0, 0.05, 0.34), white));
          mb.add(new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.03, 0.51).translate(0, 0.02, 0), mats.c(["#ff5f6d", "#2f6fff", "#ffd23a"][k], 0.5)));
          mb.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14).translate(0, 0.15, -0.05), mats.c("#9fd8ff", 0.1, 0.3)));
          mb.position.set(mx + dx, 0.03, z);
          mb.userData.dynamic = true;
          g.add(mb);
          moored.push(mb);
        });
        parts.push(t => moored.forEach((mb, k) => { mb.position.y = 0.03 + Math.sin(t * 1.5 + k * 2) * 0.025; mb.rotation.z = Math.sin(t * 1.1 + k) * 0.05; }));
      }
      decorLive = (t, night) => { for (const f of parts) f(t, night); };
    }
    beachLive = (t, night) => {
      decorLive(t, night);
      seaLife(t);
      boat.position.y = 0.02 + Math.sin(t * 1.4) * 0.06;
      boat.rotation.z = Math.sin(t * 1.1) * 0.08;
      boat.rotation.x = Math.sin(t * 0.8) * 0.03;
      boat2.position.y = 0.02 + Math.sin(t * 1.2 + 1) * 0.07;
      boat2.rotation.z = Math.sin(t * 0.9 + 1) * 0.09;
      {
        // The speedboat runs back and forth, turning at each end; its wake flickers.
        const span2 = Math.max(0.5, mx1 - mx0 - 1.2), ph = (t * 0.09) % 2, fwd = ph < 1;
        const k = fwd ? ph : 2 - ph, e = k * k * (3 - 2 * k);
        motor.position.set(mx0 + 0.6 + span2 * e, 0.03 + Math.sin(t * 6) * 0.015, mz + Math.sin(t * 0.5) * 0.3);
        motor.rotation.y = fwd ? 0 : Math.PI;
        motor.rotation.z = Math.sin(t * 5) * 0.03;
        wakeM.opacity = (0.35 + Math.sin(t * 9) * 0.1) * Math.min(1, Math.sin(k * Math.PI) * 3);
        // The sailboat drifts slowly across, leaning in the wind.
        const sp = (t * 0.025) % 2, sf = sp < 1, sk = sf ? sp : 2 - sp;
        sail3.position.set(sx3a + 0.8 + Math.max(0, sx3b - sx3a - 1.6) * sk, 0.02 + Math.sin(t * 1.1 + 2) * 0.05, sz3);
        sail3.rotation.set(0, sf ? Math.PI / 2 - 0.2 : -Math.PI / 2 + 0.2, 0.12 + Math.sin(t * 0.8) * 0.05);
        row.position.y = 0.03 + Math.sin(t * 1.6) * 0.03;
        row.rotation.y = Math.sin(t * 0.3) * 0.4;
        rower.rotation.z = Math.sin(t * 2.4) * 0.2;
      }
      buoys.forEach((b, k) => { b.position.y = 0.1 + Math.sin(t * 1.7 + k) * 0.05; });
      for (const f of foams) {
        const ph = (t * 0.45 + f.k / 3) % 1;
        f.m.position.z = f.z + ph * 0.7;
        (f.m.material as THREE.MeshBasicMaterial).opacity = Math.sin(ph * Math.PI) * 0.85;
      }
      seaM.emissiveIntensity = 0.15 + Math.sin(t * 0.8) * 0.04 + night * 0.1;
      glintM.opacity = 0.2 + Math.abs(Math.sin(t * 0.9)) * 0.3;
      glints.position.x = Math.sin(t * 0.3) * 0.25;
      lhLamp.emissiveIntensity = 0.3 + night * 2.5 * (0.6 + 0.4 * Math.sin(t * 2.5));
    };
  }


  // ---- Towers the player built (the first one, and HQs): their real floors, stacked ----
  // Every floor's footprint (narrower where overhangs broke off), in the skin's colors, with
  // a band of windows and a slab between floors. Returns the height of the roof.
  const towerGlass: THREE.MeshStandardMaterial[] = [];
  const playerTower = (parent: THREE.Object3D, sc: BizTower, x: number, z: number, S: number, fh: number, y0: number): number => {
    const put = (geo: THREE.BufferGeometry, m: THREE.Material) => parent.add(new THREE.Mesh(geo, m));
    const glassM = own(std(sc.glass, { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color(sc.lit), emissiveIntensity: 0.05 }));
    fx.glass(glassM);
    glassM.userData.dynamic = true;
    towerGlass.push(glassM);
    const slabM = mats.c(sc.slab, 0.6);
    const floorGeo = (pts: [number, number][], [cx, cz, w, d]: [number, number, number, number], grow: number, h: number, y: number) => {
      const shape = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2((cx + px * w * grow) * S, -(cz + pz * d * grow) * S)));
      return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(x, y, z);
    };
    // The lobby.
    put(floorGeo(sc.pts(0), [0, 0, 1, 1], 1.02, 0.3, y0), mats.c("#e9e4f5", 0.6));
    let y = y0 + 0.3;
    sc.b.forEach((box, i) => {
      const pts = sc.pts(i + 1);
      put(floorGeo(pts, box, 1, fh * 0.86, y), mats.c(sc.floors[i % sc.floors.length], 0.55));
      put(floorGeo(pts, box, 1.025, fh * 0.42, y + fh * 0.22), glassM);
      put(floorGeo(pts, box, 1.04, fh * 0.12, y + fh * 0.86), slabM);
      y += fh;
    });
    return y;
  };

  // ---- The player's first tower, on its own plot beside the Coffee Cart ----
  let plotTop = 1.2;
  {
    const { x, z } = cellXZ(PLOT);
    add(roundSlab(C - 2.2, C - 2.2, 0.8, 0.06).translate(x, 0.2, z), grass);
    const tx = x + TOWER_AT.x, tz = z + TOWER_AT.z;
    add(new THREE.BoxGeometry(2.6, 0.08, 2.6).translate(tx, 0.25, tz), pave);
    const sc = cafe.starter;
    if (sc) {
      const n = sc.b.length, S = TOWER_S;
      const y = playerTower(g, sc, tx, tz, S, Math.min(0.55, 11 / Math.max(1, n)), 0.3);
      plotTop = y;
      // A flag on the roof, a front door with a path to the street, a plaque and flowers.
      const top = sc.b[n - 1];
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(tx + top[0] * S, y + 0.45, tz + top[1] * S), metal);
      add(new THREE.BoxGeometry(0.5, 0.3, 0.03).translate(tx + top[0] * S + 0.25, y + 0.72, tz + top[1] * S), mats.sign("#ff4f8b"));
      add(new THREE.BoxGeometry(0.42, 0.5, 0.05).translate(tx, 0.6, tz + doorZ - TOWER_AT.z - 0.01), mats.c("#5a3a2a", 0.6));
      add(new THREE.BoxGeometry(0.5, 0.06, 0.12).translate(tx, 0.88, tz + doorZ - TOWER_AT.z + 0.02), mats.c("#ffc21a", 0.5));
      add(new THREE.BoxGeometry(0.5, 0.07, 2.4 - doorZ).translate(tx, 0.26, z + (doorZ + 2.4) / 2), pave);
      add(new THREE.BoxGeometry(0.55, 0.42, 0.08).translate(tx + 0.65, 0.5, z + 1.2), mats.c("#c8a070", 0.6));
      add(new THREE.BoxGeometry(0.45, 0.26, 0.1).translate(tx + 0.65, 0.53, z + 1.21), mats.gold);
      for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(0.09, 6, 4).translate(tx + 0.4 + k * 0.2, 0.34, z + 1.5), mats.c(flowersOn[k % 4], 0.8));
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
  // ---- Cars: each one a single mesh with painted colors (one draw per car) ----
  const carM = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
  const BODY = ["#ffffff", "#ffc93c", "#4f8bff", "#ff4f8b", "#5ee0a0", "#e8e4f0", "#ff7a3b", "#2a3a6a", "#c8323a", "#7a5ad0"];
  const carGeos = new Map<string, THREE.BufferGeometry>();
  const carGeo = (c: string, van: boolean): THREE.BufferGeometry => {
    const key = `${c}|${van}`;
    let geo = carGeos.get(key);
    if (geo) return geo;
    const glass = "#2f4a7a", tire = "#23263a";
    const parts = van ? [
      paintGeo(new THREE.BoxGeometry(0.46, 0.46, 0.98).translate(0, 0.36, 0), c),
      paintGeo(new THREE.BoxGeometry(0.47, 0.2, 0.22).translate(0, 0.45, 0.39), glass),
      paintGeo(new THREE.BoxGeometry(0.47, 0.14, 0.5).translate(0, 0.48, -0.15), glass),
    ] : [
      paintGeo(new THREE.BoxGeometry(0.46, 0.2, 0.92).translate(0, 0.22, 0), c),
      paintGeo(new THREE.BoxGeometry(0.4, 0.18, 0.5).translate(0, 0.41, -0.05), c),
      paintGeo(new THREE.BoxGeometry(0.41, 0.13, 0.42).translate(0, 0.42, -0.05), glass),
    ];
    for (const wx of [-0.22, 0.22]) for (const wz of [-0.3, 0.3]) parts.push(paintGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8).rotateZ(Math.PI / 2).translate(wx, 0.1, wz), tire));
    for (const hx of [-0.15, 0.15]) {
      parts.push(paintGeo(new THREE.BoxGeometry(0.1, 0.06, 0.02).translate(hx, 0.25, van ? 0.5 : 0.47), "#fff6c8"));
      parts.push(paintGeo(new THREE.BoxGeometry(0.1, 0.05, 0.02).translate(hx, 0.25, van ? -0.5 : -0.47), "#ff3a4a"));
    }
    geo = mergeGeometries(parts)!;
    carGeos.set(key, geo);
    return geo;
  };

  // ---- Neighbors: the homes and corner shops on the lots no business has yet ----
  const HOUSE = ["#fff1e0", "#e9f3ff", "#ffe8ef", "#eefbe8", "#fff7d6", "#f1ebff"];
  const ROOF = ["#d9534a", "#5a6fd0", "#e07a9a", "#4f9a5a", "#b8683a", "#7a5ad0"];
  const BRICK = ["#c9775a", "#d89a6a", "#b5655a", "#e0b48a", "#9a7ad0", "#6a9ad0"];
  const neighborhood = (G: THREE.Group, i: number): number => {
    const K = (geo: THREE.BufferGeometry, m: THREE.Material) => G.add(new THREE.Mesh(geo, m));
    const r = (k: number) => ((i * 7 + k * 13) % 6);
    // Ground: a small front lawn and a paved yard.
    K(roundSlab(4.2, 4.2, 0.7, 0.06), grass2);
    K(new THREE.BoxGeometry(4.0, 0.03, 1.1).translate(0, 0.07, 1.45), pave);
    const windows = (w: number, d: number, y0: number, floors: number, fh: number, cx: number, cz: number, per: number) => {
      for (let f = 0; f < floors; f++) {
        const y = y0 + f * fh + fh * 0.55;
        for (let k = 0; k < per; k++) {
          const ox = -w / 2 + (k + 0.5) * (w / per);
          K(new THREE.BoxGeometry(Math.min(0.3, w / per * 0.55), fh * 0.42, 0.04).translate(cx + ox, y, cz + d / 2 + 0.01), winMat);
          K(new THREE.BoxGeometry(Math.min(0.36, w / per * 0.62), 0.04, 0.07).translate(cx + ox, y - fh * 0.24, cz + d / 2 + 0.02), mats.c("#ffffff", 0.6));
        }
        const perS = Math.max(1, Math.round(per * d / w));
        for (let k = 0; k < perS; k++) {
          const oz = -d / 2 + (k + 0.5) * (d / perS);
          for (const sx of [-1, 1]) K(new THREE.BoxGeometry(0.04, fh * 0.42, Math.min(0.3, d / perS * 0.55)).translate(cx + sx * (w / 2 + 0.01), y, cz + oz), winMat);
        }
        if (f < floors - 1) K(new THREE.BoxGeometry(w + 0.06, 0.05, d + 0.06).translate(cx, y0 + (f + 1) * fh, cz), mats.c("#ffffff", 0.7));
      }
    };
    const gable = (w: number, d: number, y: number, cx: number, cz: number, c: string) => {
      // A pitched roof: a three-sided prism along x, its ridge up.
      const geo = new THREE.CylinderGeometry(1, 1, w + 0.16, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
      geo.scale(1, 0.55 * (d + 0.2) / Math.sqrt(3), (d + 0.2) / Math.sqrt(3));
      K(geo.translate(cx, y + 0.275 * (d + 0.2) / Math.sqrt(3), cz), mats.c(c, 0.75));
    };
    const kind = i % 3;
    let top = 0;
    if (kind === 0) {
      // Three town houses in a row, each its own color, with a door and a little chimney.
      for (let k = 0; k < 3; k++) {
        const w = 1.15, d = 1.9, h = 1.05 + ((i + k) % 3) * 0.28, cx = -1.25 + k * 1.25, cz = -0.25;
        K(new THREE.BoxGeometry(w, h, d).translate(cx, h / 2 + 0.06, cz), mats.c(HOUSE[r(k)], 0.8));
        windows(w, d, 0.06, 2, h / 2, cx, cz, 2);
        K(new THREE.BoxGeometry(0.28, 0.44, 0.05).translate(cx + 0.28, 0.28, cz + d / 2 + 0.02), mats.c(ROOF[r(k + 2)], 0.6));
        gable(w, d, h + 0.06, cx, cz, ROOF[r(k)]);
        K(new THREE.BoxGeometry(0.14, 0.35, 0.14).translate(cx - 0.3, h + 0.45, cz - 0.4), mats.c("#a0705a", 0.8));
        top = Math.max(top, h + 0.9);
      }
      // Picket fence and a hedge along the front.
      K(new THREE.BoxGeometry(3.8, 0.05, 0.04).translate(0, 0.3, 1.0), mats.c("#ffffff", 0.6));
      for (let k = 0; k < 13; k++) K(new THREE.BoxGeometry(0.05, 0.3, 0.04).translate(-1.85 + k * 0.31, 0.22, 1.0), mats.c("#ffffff", 0.6));
    } else if (kind === 1) {
      // A block of flats: brick, balconies on the front, a water tank on the roof.
      const w = 3.1, d = 2.5, floors = 4 + (i % 2), fh = 0.55, cz = -0.35, h = floors * fh;
      K(new THREE.BoxGeometry(w, h, d).translate(0, h / 2 + 0.06, cz), mats.c(BRICK[r(1)], 0.85));
      windows(w, d, 0.06, floors, fh, 0, cz, 4);
      for (let f = 1; f < floors; f++) for (const bx of [-0.78, 0.78]) {
        K(new THREE.BoxGeometry(0.62, 0.05, 0.3).translate(bx, 0.06 + f * fh + 0.02, cz + d / 2 + 0.15), mats.c("#f4f2fa", 0.6));
        K(new THREE.BoxGeometry(0.62, 0.16, 0.03).translate(bx, 0.06 + f * fh + 0.1, cz + d / 2 + 0.29), mats.c("#3a3f6a", 0.5, 0.3));
      }
      K(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1).translate(0, h + 0.12, cz), mats.c("#f4f2fa", 0.7));
      K(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10).translate(0.8, h + 0.5, cz - 0.5), mats.c("#8a6a4a", 0.8));
      K(new THREE.ConeGeometry(0.32, 0.18, 10).translate(0.8, h + 0.82, cz - 0.5), mats.c("#6a4a3a", 0.8));
      K(new THREE.BoxGeometry(0.5, 0.3, 0.4).translate(-0.7, h + 0.33, cz + 0.2), mats.c("#c8cce0", 0.5, 0.4));
      K(new THREE.BoxGeometry(0.5, 0.62, 0.06).translate(0, 0.37, cz + d / 2 + 0.02), winMat);
      top = h + 1.0;
    } else {
      // A corner shop with flats above: a glass shop front and a striped awning.
      const w = 3.0, d = 2.4, cz = -0.3, gh = 0.75, floors = 2 + (i % 2), fh = 0.55, h = gh + floors * fh;
      K(new THREE.BoxGeometry(w, gh, d).translate(0, gh / 2 + 0.06, cz), mats.c(ROOF[r(3)], 0.6));
      K(new THREE.BoxGeometry(w - 0.4, gh - 0.22, 0.04).translate(0, gh / 2 + 0.04, cz + d / 2 + 0.01), winMat);
      for (let k = 0; k < 8; k++) K(new THREE.BoxGeometry(w / 8, 0.05, 0.55).rotateX(0.35).translate(-w / 2 + (k + 0.5) * (w / 8), gh + 0.02, cz + d / 2 + 0.22), mats.c(k % 2 ? "#ffffff" : ROOF[r(3)], 0.6));
      K(new THREE.BoxGeometry(w, floors * fh, d).translate(0, gh + 0.06 + floors * fh / 2, cz), mats.c(HOUSE[r(4)], 0.8));
      windows(w, d, gh + 0.06, floors, fh, 0, cz, 4);
      K(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08).translate(0, h + 0.1, cz), mats.c("#ffffff", 0.7));
      // Crates of fruit outside.
      for (let k = 0; k < 3; k++) {
        K(new THREE.BoxGeometry(0.34, 0.16, 0.26).translate(-1.0 + k * 0.4, 0.15, 1.25), mats.c("#b07a4a", 0.8));
        for (let j = 0; j < 3; j++) K(new THREE.SphereGeometry(0.055, 6, 4).translate(-1.1 + k * 0.4 + j * 0.1, 0.26, 1.25), mats.c(["#ff4f4f", "#ffd23a", "#7ad35a"][(k + j) % 3], 0.6));
      }
      top = h + 0.6;
    }
    // A tree in the yard, and the neighbors' car parked out front on odd lots.
    K(new THREE.CylinderGeometry(0.06, 0.09, 0.55, 6).translate(1.65, 0.33, -1.55), trunk);
    K(new THREE.IcosahedronGeometry(0.45, 0).translate(1.65, 0.95, -1.55), leaf);
    if (i % 2) { const car = carGeo(BODY[(i * 3) % BODY.length], false).clone().rotateY(Math.PI / 2).translate(-1.1, 0.04, 1.5); K(car, carM); }
    return top;
  };

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
        K(roundSlab(4.2, 4.2, 0.7, 0.06), grass2);
        K(new THREE.BoxGeometry(3.2, 0.07, 3.2).translate(0, 0.04, -0.2), earth);
        for (const [sx, sz] of [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.4], [1.6, 1.4]]) K(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(sx, 0.25, sz), wood);
        for (const [sx, sz, w, d] of [[0, -1.8, 3.2, 0.03], [0, 1.4, 3.2, 0.03], [-1.6, -0.2, 0.03, 3.2], [1.6, -0.2, 0.03, 3.2]] as const) K(new THREE.BoxGeometry(w, 0.05, d).translate(sx, 0.42, sz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.08, 1.3, 0.08).translate(0, 0.65, 1.4), pole);
        K(new THREE.BoxGeometry(1.5, 0.8, 0.08).translate(0, 1.4, 1.4), mats.sign("#ff4f6d"));
        K(new THREE.BoxGeometry(1.1, 0.12, 0.09).translate(0, 1.4, 1.42), mats.c("#ffffff"));
        for (const [bx, bz] of [[-1.2, -0.8], [1.1, -1.1]]) K(new THREE.ConeGeometry(0.18, 0.45, 10).translate(bx, 0.25, bz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.9, 0.3, 0.5).translate(0.9, 0.15, 0.4), mats.c("#c86a4a"));
        tops[i] = 1.9;
      } else if (i % 4 !== 3) {
        // Until the business comes, ordinary neighbors live here: town houses, a block of
        // flats or a corner shop with flats above, so the town looks lived in, like a real city.
        tops[i] = neighborhood(lotG, i);
        mergeStatic(lotG);
        return;
      } else {
        // A little park until the business comes: lawn, a winding path, trees, a bench.
        K(roundSlab(4.2, 4.2, 0.7, 0.06), i % 2 ? grass : grass2);
        K(ribbon(sPath(1.9, i % 2 === 1), 0.55, 0.075), pave);
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
    lotG.add(new THREE.Mesh(roundSlab(4.3, 4.3, 0.7, 0.05), grass));
    lotG.add(new THREE.Mesh(roundSlab(4.3, 2.6, 0.6, 0.06).translate(0, 0, 0.85), pave));
    const hqT = cafe.hq?.[lot.id];
    // Once the café terrace is there (or its preview), the Coffee Cart's building, at any
    // stage, keeps clear of it: it moves back (and slims if it must) so its front stops
    // behind the terrace. Nothing stands over the neighbor's table.
    const keepClear = lot.id === "coffee" && (cafe.terrace > 0 || !!cafe.ghostTerrace);
    const fitBehind = (body: THREE.Group, back: number) => {
      const FRONT = 1.32;
      body.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(body);
      if (bb.isEmpty() || bb.max.z <= FRONT) return;
      const depth = bb.max.z - bb.min.z, room = FRONT - back;
      const k = depth > room ? room / depth : 1;
      // Scale about the box's back edge, then slide so the front lands on FRONT.
      body.scale.z *= k;
      body.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(body);
      body.position.z += FRONT - b2.max.z;
    };
    if (hqT) {
      // The HQ the player built stands at the back of the lot; the business's own storefront
      // (smaller) stays at the front, so every lot keeps its look.
      const shop = new THREE.Group();
      shop.scale.setScalar(0.62);
      shop.position.set(0, 0, 1.05);
      buildModel(shop, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
      if (keepClear) fitBehind(shop, -0.3);
      lotG.add(shop);
      const n = hqT.b.length, roof = playerTower(lotG, hqT, 0, -1.25, 0.82, Math.min(0.34, 9 / Math.max(1, n)), 0.05);
      // A banner in the business's colors on the roof: this tower is its HQ.
      lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6).translate(0, roof + 0.4, -1.25), metal));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.03).translate(0.24, roof + 0.66, -1.25), mats.sign(lot.c2)));
    } else if (keepClear) {
      const body = new THREE.Group();
      buildModel(body, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
      fitBehind(body, -2.1);
      lotG.add(body);
    } else buildModel(lotG, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
    // The street front (planters, a sign, bikes); the café keeps its front for the terrace.
    if (lot.id !== "coffee") buildStreetFront(lotG, lot.c, lot.c2, lot.s, mats);
    // The Coffee Cart's café terrace (see logic/cafe.ts); before it's ready, once the
    // neighbor has asked to sit somewhere, a see-through preview of it on the lot.
    if (lot.id === "coffee" && cafe.terrace > 0) buildTerrace(lotG, cafe.terrace as 1 | 2, cafe.contract === 2, mats);
    else if (lot.id === "coffee" && cafe.ghostTerrace) {
      const ghostG = new THREE.Group();
      buildTerrace(ghostG, 2, false, mats);
      const gm = own(new THREE.MeshStandardMaterial({ color: 0xffe7c2, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.6 }));
      ghostG.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = gm; });
      lotG.add(ghostG);
    }
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
  // People: legs, a shirt with arms, a face and hair (sometimes a cap or a sun hat), all in
  // one mesh with painted colors, so each person is a single draw however detailed.
  const personM = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  const personGeo = new Map<string, THREE.BufferGeometry>();
  const SKIN = ["#f2c39a", "#d9a074", "#a86b45", "#7a4a2e", "#ffd9b8"], HAIR = ["#3a2a20", "#7a4a20", "#e8c070", "#1e1a22", "#b8442a", "#d8d4e0"];
  const PANTS = ["#2f3a5a", "#4a4f6a", "#6a5a4a", "#2a5a7a", "#e8e0d0"];
  let personN = 0;
  const paint = (geo: THREE.BufferGeometry, c: string) => {
    const g2 = geo.index ? geo.toNonIndexed() : geo, n = g2.attributes.position.count, cc = new THREE.Color(c), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
    g2.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    if (g2.attributes.uv) g2.deleteAttribute("uv");
    return g2;
  };
  const makePerson = (c: string) => {
    const v = personN++ % 6, key = `${c}|${v}`;
    let geo = personGeo.get(key);
    if (!geo) {
      const skin = SKIN[v % SKIN.length], hair = HAIR[(v * 7) % HAIR.length], pants = PANTS[(v * 3) % PANTS.length];
      const parts: THREE.BufferGeometry[] = [
        paint(new THREE.CapsuleGeometry(0.04, 0.12, 2, 5).translate(-0.05, 0.1, 0), pants),
        paint(new THREE.CapsuleGeometry(0.04, 0.12, 2, 5).translate(0.05, 0.1, 0), pants),
        paint(new THREE.CapsuleGeometry(0.095, 0.13, 2, 6).translate(0, 0.3, 0), c),
        paint(new THREE.CapsuleGeometry(0.03, 0.15, 2, 5).rotateZ(0.12).translate(-0.12, 0.3, 0), c),
        paint(new THREE.CapsuleGeometry(0.03, 0.15, 2, 5).rotateZ(-0.12).translate(0.12, 0.3, 0), c),
        paint(new THREE.SphereGeometry(0.085, 7, 5).translate(0, 0.53, 0), skin),
        paint(new THREE.SphereGeometry(0.09, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.9, 1).translate(0, 0.545, -0.008), hair),
      ];
      if (v % 5 === 1) parts.push(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 10).translate(0, 0.6, 0.03), c), paint(new THREE.BoxGeometry(0.1, 0.012, 0.08).translate(0, 0.585, 0.11), c));
      else if (v % 7 === 3) parts.push(paint(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 12).translate(0, 0.6, 0), "#f4e2b0"), paint(new THREE.CylinderGeometry(0.075, 0.085, 0.07, 10).translate(0, 0.64, 0), "#f4e2b0"));
      else if (v % 4 === 2) parts.push(paint(new THREE.SphereGeometry(0.05, 6, 5).translate(0, 0.52, -0.09), hair));
      geo = mergeGeometries(parts)!;
      personGeo.set(key, geo);
    }
    const p = new THREE.Group();
    p.add(new THREE.Mesh(geo, personM));
    return p;
  };
  const walkers = Array.from({ length: 14 }, (_, k) => { const p = makePerson(shirts[k % shirts.length]); life.add(p); return { p, u: k / 14, v: (k % 2 ? 1 : -1) * (0.012 + (k % 5) * 0.003) }; });
  const crowd = Array.from({ length: 10 }, (_, k) => { const p = makePerson(shirts[(k + 3) % shirts.length]); p.visible = false; life.add(p); return p; });
  // Shoppers at every open business (the café has its own, in block.ts): they walk in from the
  // sidewalk, spend a moment inside, and come out with a bag in the shop's colors. Bigger
  // businesses get more of them.
  const shopLots = lots.map((l, i) => ({ l, i })).filter(({ l, i }) => l.state === "open" && l.id !== "coffee" && i < CELLS.length);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const lotPoint = (i: number, lx: number, lz: number, out: THREE.Vector3) => {
    const { x, z, a } = lotPos(i);
    return out.set(lx, 0, lz).applyAxisAngle(yAxis, a).add(tmpP.set(x, 0.2, z));
  };
  const tmpP = new THREE.Vector3();
  type Shopper = { p: THREE.Group; bag: THREE.Mesh; items: Map<string, THREE.Object3D>; item: THREE.Object3D | null; lot: number; st: 0 | 1 | 2 | 3; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3 };
  const bagGeo = new THREE.BoxGeometry(0.12, 0.14, 0.06).translate(0.14, 0.24, 0);
  // What each shop's customers carry out, so every business reads differently: a bouquet,
  // a baguette, a pizza box, popcorn, a suitcase. Anything else leaves with a shopping bag.
  const itemGeo = {
    stem: new THREE.ConeGeometry(0.035, 0.16, 6).rotateX(Math.PI).translate(0.14, 0.26, 0.02),
    bloom: [0, 1, 2].map(k => new THREE.SphereGeometry(0.035, 6, 5).translate(0.14 + (k - 1) * 0.03, 0.36 + (k % 2) * 0.02, 0.02)),
    loaf: new THREE.CapsuleGeometry(0.025, 0.24, 3, 6).rotateZ(0.5).translate(0.13, 0.3, 0.02),
    sleeve: new THREE.CylinderGeometry(0.032, 0.032, 0.1, 6).rotateZ(0.5).translate(0.11, 0.26, 0.02),
    box: new THREE.BoxGeometry(0.22, 0.04, 0.22).translate(0, 0.42, 0.12),
    tub: new THREE.CylinderGeometry(0.05, 0.035, 0.11, 8).translate(0.14, 0.29, 0.03),
    pop: new THREE.SphereGeometry(0.05, 7, 5).scale(1, 0.55, 1).translate(0.14, 0.35, 0.03),
    case: new THREE.BoxGeometry(0.1, 0.17, 0.2).translate(0.17, 0.1, -0.05),
    handle: new THREE.BoxGeometry(0.015, 0.12, 0.015).translate(0.17, 0.24, -0.12),
  };
  const makeItems = (): Map<string, THREE.Object3D> => {
    const m = new Map<string, THREE.Object3D>(), grp = (id: string, parts: [THREE.BufferGeometry, THREE.Material][]) => {
      const g2 = new THREE.Group();
      for (const [geo, mat] of parts) g2.add(new THREE.Mesh(geo, mat));
      g2.visible = false; m.set(id, g2);
    };
    grp("flowers", [[itemGeo.stem, mats.c("#3fae5a", 0.8)], ...itemGeo.bloom.map((b, k) => [b, mats.c(["#ff5f8b", "#ffd23a", "#b48cff"][k], 0.6)] as [THREE.BufferGeometry, THREE.Material])]);
    grp("bakery", [[itemGeo.loaf, mats.c("#d99a4e", 0.8)], [itemGeo.sleeve, mats.c("#f4efe6", 0.7)]]);
    grp("pizza", [[itemGeo.box, mats.c("#f4efe6", 0.7)], [new THREE.BoxGeometry(0.1, 0.005, 0.1).translate(0, 0.443, 0.12), mats.c("#e2453c", 0.6)]]);
    grp("cinema", [[itemGeo.tub, mats.c("#e2453c", 0.6)], [itemGeo.pop, mats.c("#fff2b0", 0.8)]]);
    grp("hotel", [[itemGeo.case, mats.c("#4f6bff", 0.5)], [itemGeo.handle, mats.c("#2a2f4a", 0.5)]]);
    return m;
  };
  const shoppers: Shopper[] = Array.from({ length: Math.min(18, shopLots.length * 4) }, (_, k) => {
    const p = makePerson(shirts[(k + 5) % shirts.length]);
    const bag = new THREE.Mesh(bagGeo, mats.c("#ffffff"));
    bag.visible = false;
    p.add(bag);
    const items = makeItems();
    items.forEach(o => p.add(o));
    p.visible = false;
    life.add(p);
    return { p, bag, items, item: null, lot: -1, st: 0, t: -k * 0.9, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3() };
  });
  /** Picks a business for a shopper: busier (bigger) businesses more often. */
  const pickLot = (): { l: BizLot; i: number } | null => {
    if (!shopLots.length) return null;
    const w = shopLots.map(({ l }) => 1 + l.s * 1.5), sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let k = 0; k < shopLots.length; k++) { r -= w[k]; if (r <= 0) return shopLots[k]; }
    return shopLots[0];
  };
  const shopperLive = (dt: number) => {
    for (const sh of shoppers) {
      sh.t += dt;
      if (sh.st === 0) {
        // Waiting to start: pick a shop, walk in from the sidewalk.
        if (sh.t < 0) continue;
        const pick = pickLot();
        if (!pick) continue;
        sh.lot = pick.i;
        const side = Math.random() < 0.5 ? -1 : 1;
        lotPoint(pick.i, side * (1.2 + Math.random() * 0.8), 2.55, sh.from);
        lotPoint(pick.i, (Math.random() - 0.5) * 0.6, 1.15, sh.to);
        (sh.bag.material as THREE.MeshStandardMaterial) = mats.c(pick.l.c2, 0.6);
        if (sh.item) sh.item.visible = false;
        sh.item = sh.items.get(pick.l.id) ?? sh.bag;
        sh.bag.visible = false;
        sh.st = 1; sh.t = 0; sh.dur = sh.from.distanceTo(sh.to) / 0.9;
        sh.p.visible = true;
      }
      const k = Math.min(1, sh.t / sh.dur);
      if (sh.st === 1 || sh.st === 3) {
        sh.p.position.lerpVectors(sh.from, sh.to, k);
        sh.p.position.y += Math.abs(Math.sin(sh.t * 9)) * 0.04;
        sh.p.rotation.y = Math.atan2(sh.to.x - sh.from.x, sh.to.z - sh.from.z);
        // Fade in at the start of the trip in, out at the end of the trip away.
        const sc = sh.st === 1 ? Math.min(1, k * 5) : Math.min(1, (1 - k) * 5);
        sh.p.scale.setScalar(Math.max(0.05, sc));
        if (k >= 1) {
          if (sh.st === 1) { sh.st = 2; sh.t = 0; sh.dur = 1.2 + Math.random() * 2.5; sh.p.visible = false; }
          else { sh.st = 0; sh.t = -(0.5 + Math.random() * 3); sh.p.visible = false; }
        }
      } else if (sh.st === 2 && k >= 1) {
        // Out again, with a bag, off along the sidewalk.
        sh.from.copy(sh.to);
        lotPoint(sh.lot, (Math.random() < 0.5 ? -1 : 1) * (2.0 + Math.random() * 0.8), 2.6, sh.to);
        sh.st = 3; sh.t = 0; sh.dur = sh.from.distanceTo(sh.to) / 0.9;
        if (sh.item) sh.item.visible = true;
        sh.p.visible = true;
      }
    }
  };
  // The café block: the neighbor, the cart's customers, the projects (block.ts).
  const ci = lots.findIndex(l => l.id === "coffee");
  const block = buildBlock({
    parent: life, makePerson, mat: (c, r, m) => mats.c(c, r, m), own,
    coffee: ci >= 0 && ci < CELLS.length && lots[ci].state === "open" ? lotPos(ci) : null,
    plot: cellXZ(PLOT), tower: { x: TOWER_AT.x, z: TOWER_AT.z, door: doorZ + 0.1 }, hasStarter: !!cafe.starter,
    terrace: cafe.terrace, done: cafe.done ?? [], offered: !!cafe.offered,
  });
  let coffeeSale = 0;
  const makeCar = (c: string, van: boolean) => {
    const v = new THREE.Group();
    v.add(new THREE.Mesh(carGeo(c, van), carM));
    life.add(v);
    return v;
  };
  const cars = [["#ffffff", true], ["#ffc93c", false], ["#4f8bff", true], ["#ff4f8b", false], ["#5ee0a0", false]].map(([c, van], k) => ({ v: makeCar(c as string, van as boolean), u: k / 5, sp: 0.018 + (k % 3) * 0.004 }));
  // ---- Traffic: cars driving the town's own streets (on the right), turning at the
  // crossings, going round the roundabouts and waiting for the car in front ----
  type Seg = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; len: number };
  const inTown = new Set(ALL.filter(c => c !== PLOT).map(([x, z]) => `${x},${z}`));
  const cellIn = (x: number, z: number) => inTown.has(`${x},${z}`);
  const nodeXZ = (i: number, j: number) => new THREE.Vector3((i - 0.5) * C - OFF, 0.04, (j - 0.5) * C - OFF);
  // The streets out of a crossing (i, j): a street runs between two town blocks.
  const exits = (i: number, j: number): [number, number][] => {
    const out: [number, number][] = [];
    if (cellIn(i, j - 1) && cellIn(i, j)) out.push([1, 0]);
    if (cellIn(i - 1, j - 1) && cellIn(i - 1, j)) out.push([-1, 0]);
    if (cellIn(i - 1, j) && cellIn(i, j)) out.push([0, 1]);
    if (cellIn(i - 1, j - 1) && cellIn(i, j - 1)) out.push([0, -1]);
    return out;
  };
  const isRound = (i: number, j: number) => cellIn(i - 1, j - 1) && cellIn(i, j - 1) && cellIn(i - 1, j) && cellIn(i, j);
  const LANE = 0.38, END = 1.0;
  const rightOf = (d: [number, number]) => new THREE.Vector3(-d[1], 0, d[0]);
  const dv = (d: [number, number]) => new THREE.Vector3(d[0], 0, d[1]);
  const bez = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3): Seg => ({ a, b, c, len: a.distanceTo(c) + c.distanceTo(b) * 0.98 });
  const street = (i: number, j: number, d: [number, number], lane = LANE): Seg => {
    const A = nodeXZ(i, j), B = nodeXZ(i + d[0], j + d[1]), r = rightOf(d).multiplyScalar(lane), D = dv(d).multiplyScalar(lane > 0.6 ? lane : END);
    const a = A.clone().add(D).add(r), b = B.clone().sub(D).add(r);
    return bez(a, a.clone().lerp(b, 0.5), b);
  };
  const nodes: [number, number][] = [];
  for (const [x, z] of ALL) for (const [i, j] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] as [number, number][]) if (exits(i, j).length && !nodes.some(n => n[0] === i && n[1] === j)) nodes.push([i, j]);
  const starts: { i: number; j: number; d: [number, number] }[] = [];
  for (const [i, j] of nodes) for (const d of exits(i, j)) starts.push({ i, j, d });
  const traffic = starts.length ? Array.from({ length: Math.min(9, starts.length) }, (_, k) => {
    const st0 = starts[Math.floor((k * starts.length) / Math.min(9, starts.length))];
    const v = makeCar(BODY[(k + 5) % BODY.length], k % 4 === 1);
    return { v, i: st0.i, j: st0.j, d: st0.d, seg: street(st0.i, st0.j, st0.d), turn: false, u: (k % 3) * 0.3, sp: 1.15 + (k % 4) * 0.15, wait: 0, ahead: new THREE.Vector3(), lane: LANE };
  }) : [];
  const segAt = (sg: Seg, u: number, out: THREE.Vector3, dir: THREE.Vector3) => {
    const m = 1 - u;
    out.set(m * m * sg.a.x + 2 * m * u * sg.c.x + u * u * sg.b.x, 0.04, m * m * sg.a.z + 2 * m * u * sg.c.z + u * u * sg.b.z);
    dir.set(2 * m * (sg.c.x - sg.a.x) + 2 * u * (sg.b.x - sg.c.x), 0, 2 * m * (sg.c.z - sg.a.z) + 2 * u * (sg.b.z - sg.c.z)).normalize();
  };
  /** At the end of a street: pick the next one (never back the way it came unless it must,
   *  and only right or straight on at a roundabout), and the curve through the crossing. */
  const nextLeg = (c: (typeof traffic)[number]) => {
    const L = c.lane, E = L > 0.6 ? L : END, foot = L > 0.6;
    const i = c.i + c.d[0], j = c.j + c.d[1], back: [number, number] = [-c.d[0], -c.d[1]];
    const r = rightOf(c.d);
    let opts = exits(i, j).filter(e => !(e[0] === back[0] && e[1] === back[1]));
    if (!foot && isRound(i, j)) opts = opts.filter(e => !(e[0] === -r.x && e[1] === -r.z));
    const d2 = opts.length ? opts[Math.floor(Math.random() * opts.length)] : back;
    const B = nodeXZ(i, j), r2 = rightOf(d2);
    const a = B.clone().sub(dv(c.d).multiplyScalar(E)).add(r.clone().multiplyScalar(L));
    const b = B.clone().add(dv(d2).multiplyScalar(E)).add(r2.clone().multiplyScalar(L));
    let ctl: THREE.Vector3;
    if (d2[0] === c.d[0] && d2[1] === c.d[1]) ctl = foot ? a.clone().lerp(b, 0.5) : B.clone().add(r.clone().multiplyScalar(isRound(i, j) ? 1.6 : L));
    else if (d2 === back) ctl = B.clone().add(dv(c.d).multiplyScalar(foot ? 0 : 0.7));
    else ctl = B.clone().add(r.clone().multiplyScalar(L)).add(r2.clone().multiplyScalar(L));
    c.i = i; c.j = j; c.d = d2;
    return bez(a, ctl, b);
  };
  // People out for a walk on the town's inner sidewalks (crossing at the zebras).
  const FOOT = 0.95;
  const strollers = starts.length ? Array.from({ length: 12 }, (_, k) => {
    const st0 = starts[Math.floor((k * 7 + 3) % starts.length)], p = makePerson(shirts[(k + 2) % shirts.length]);
    life.add(p);
    return { p, i: st0.i, j: st0.j, d: st0.d, seg: street(st0.i, st0.j, st0.d, FOOT), turn: false, u: (k % 5) * 0.2, sp: 0.32 + (k % 4) * 0.05, lane: FOOT, ph: k * 1.7 };
  }) : [];
  const tPos = new THREE.Vector3(), tDir = new THREE.Vector3(), tGap = new THREE.Vector3();
  const trafficLive = (dt: number) => {
    for (const c of traffic) {
      // Wait for the car in front (but never forever, so two cars can't block each other).
      let blocked = false;
      for (const o of traffic) {
        if (o === c) continue;
        tGap.copy(o.v.position).sub(c.v.position);
        const ahead = tGap.x * c.ahead.x + tGap.z * c.ahead.z, side = Math.abs(tGap.x * c.ahead.z - tGap.z * c.ahead.x);
        if (ahead > 0.05 && ahead < 0.95 && side < 0.32) { blocked = true; break; }
      }
      if (blocked && c.wait < 1.6) { c.wait += dt; continue; }
      c.wait = 0;
      c.u += (c.sp * dt) / Math.max(0.3, c.seg.len);
      while (c.u >= 1) {
        c.u -= 1;
        if (c.turn) { c.seg = street(c.i, c.j, c.d, c.lane); c.turn = false; }
        else { c.seg = nextLeg(c); c.turn = true; }
      }
      segAt(c.seg, c.u, tPos, tDir);
      c.v.position.copy(tPos);
      c.v.rotation.y = Math.atan2(tDir.x, tDir.z);
      c.ahead.copy(tDir);
    }
    const t = performance.now() / 1000;
    for (const w of strollers) {
      w.u += (w.sp * dt) / Math.max(0.3, w.seg.len);
      while (w.u >= 1) {
        w.u -= 1;
        if (w.turn) { w.seg = street(w.i, w.j, w.d, FOOT); w.turn = false; }
        else { w.seg = nextLeg(w as unknown as (typeof traffic)[number]); w.turn = true; }
      }
      segAt(w.seg, w.u, tPos, tDir);
      const sw = Math.sin(t * 9 + w.ph);
      w.p.position.set(tPos.x, 0.2 + Math.abs(sw) * 0.04, tPos.z);
      w.p.rotation.y = Math.atan2(tDir.x, tDir.z);
      w.p.rotation.z = sw * 0.08;
    }
  };
  // ---- Town ranks (data/ranks.ts): as the company grows, the town itself changes for good ----
  const rank = cafe.rank ?? 0;
  const landmarks: Record<number, () => { x: number; z: number }> = {};
  const outward = (u: number, out: THREE.Vector3, d: THREE.Vector3) => {
    carPath.at(u, out, d);
    const nx = d.z, nz = -d.x, sgn = (out.x - cx) * nx + (out.z - cz) * nz > 0 ? 1 : -1;
    return { nx: nx * sgn, nz: nz * sgn };
  };
  if (rank >= 1) {
    // Village: a street market round the plaza, striped stalls with fruit and flowers.
    const stripes = [["#ff5f6d", "#ffffff"], ["#2f9bff", "#ffffff"], ["#5ec26a", "#fff4c2"], ["#ffb13b", "#ffffff"]];
    [1.25, 3.55, 4.35, 0.95 + Math.PI].slice(0, 4).forEach((a, k) => {
      const sx = pz.x + Math.cos(a) * 2.55, sz = pz.z + Math.sin(a) * 2.55, rot = -a + Math.PI / 2;
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.28).translate(0, 0.13, 0), mats.c("#b07a4a", 0.8)));
      for (let j = 0; j < 4; j++) sg.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5).translate(-0.21 + j * 0.14, 0.3, 0.02), mats.c(["#ff4f4f", "#ffd23a", "#7ad35a", "#ff8ac0"][(j + k) % 4], 0.6)));
      for (const x of [-0.29, 0.29]) for (const z of [-0.12, 0.12]) sg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 4).translate(x, 0.31, z), metal));
      for (let j = 0; j < 6; j++) sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.42).rotateX(0.32).translate(-0.275 + j * 0.11, 0.64, 0.03), mats.c(stripes[k][j % 2], 0.6)));
      sg.position.set(sx, 0.2, sz);
      sg.rotation.y = rot;
      sg.scale.setScalar(1.3);
      sg.updateMatrixWorld(true);
      sg.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) add(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material as THREE.Material); });
    });
    landmarks[1] = () => ({ x: pz.x, z: pz.z });
    // Bunting over the plaza.
    const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.13, 3).rotateX(Math.PI), own(new THREE.MeshStandardMaterial({ roughness: 0.7 })), 24);
    flags.userData.dynamic = true;
    const fc = ["#ff5f6d", "#ffd23a", "#2f9bff", "#5ee0a0", "#ff8ac0"], fm = new THREE.Matrix4(), fcol = new THREE.Color();
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, sag = 0.12 * Math.abs(Math.sin((k % 6) / 6 * Math.PI));
      fm.makeTranslation(pz.x + Math.cos(a) * 2.2, 1.55 - sag, pz.z + Math.sin(a) * 2.2);
      flags.setMatrixAt(k, fm); flags.setColorAt(k, fcol.set(fc[k % fc.length]));
    }
    g.add(flags);
    // ...hung on a line between four poles, not floating.
    add(new THREE.TorusGeometry(2.2, 0.012, 4, 48).rotateX(Math.PI / 2).translate(pz.x, 1.62, pz.z), mats.c("#ffffff", 0.6));
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k / 4) * Math.PI * 2; add(new THREE.CylinderGeometry(0.03, 0.035, 1.45, 6).translate(pz.x + Math.cos(a) * 2.2, 0.95, pz.z + Math.sin(a) * 2.2), metal); }
  }
  if (rank >= 2) {
    // Town: a little two-car tram running round the outer street.
    const tram = new THREE.Group();
    for (const z of [-0.5, 0.5]) {
      tram.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.92).translate(0, 0.36, z), mats.c("#ffcf3a", 0.45)));
      tram.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.86).translate(0, 0.46, z), winMat));
      tram.add(new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.06, 0.93).translate(0, 0.19, z), mats.c("#e2453c", 0.5)));
      tram.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.86).translate(0, 0.59, z), mats.c("#f4efe6", 0.5)));
    }
    tram.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03).rotateX(-0.5).translate(0, 0.76, 0.1), metal));
    life.add(tram);
    // Two stops with shelters: the tram slows in, waits while people get on and off, and
    // goes on. People wait at the stop again until it comes back round.
    const STOPS = [0.12, 0.62], DWELL = 5, HALF = 0.5 / 0.011, LOOP = 2 * (HALF + DWELL);
    const tp = new THREE.Vector3(), td = new THREE.Vector3();
    const stops = STOPS.map(u => {
      const { nx, nz } = outward(u, tp, td), x = tp.x - nx * 0.75, z = tp.z - nz * 0.75, ry = Math.atan2(nx, nz);
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4).translate(0, 0.72, 0), mats.c("#2f6fff", 0.4)));
      sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.03).translate(0, 0.42, -0.18), mats.c("#bfe6ff", 0.1, 0.3)));
      for (const px of [-0.42, 0.42]) sg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 5).translate(px, 0.36, -0.16), metal));
      sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.14).translate(0, 0.2, -0.1), mats.c("#a0683a", 0.8)));
      sg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4).translate(0.58, 0.45, 0.1), metal));
      sg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12).rotateX(Math.PI / 2).translate(0.58, 0.9, 0.1), mats.c("#ffcf3a", 0.4)));
      sg.position.set(x, 0.2, z); sg.rotation.y = ry;
      sg.userData.dynamic = true;
      g.add(sg);
      // Who's waiting, and who gets off.
      const wait = [0, 1, 2].map(k => { const w = makePerson(shirts[(k * 3 + (u > 0.5 ? 1 : 0)) % shirts.length]); w.scale.setScalar(1.3); w.position.set(x + Math.cos(ry) * (k - 1) * 0.25, 0.2, z - Math.sin(ry) * (k - 1) * 0.25); w.rotation.y = ry + Math.PI; life.add(w); return w; });
      const off = [0, 1].map(k => { const w = makePerson(shirts[(k * 5 + 2) % shirts.length]); w.scale.setScalar(1.3); w.visible = false; life.add(w); return w; });
      return { u, x, z, nx, nz, wait, off };
    });
    landmarks[2] = () => ({ x: stops[0].x, z: stops[0].z });
    const tramAt = (t: number): { u: number; at: number } => {
      // at = which stop it's waiting at (-1 while moving)
      const L = ((t % LOOP) + LOOP) % LOOP;
      for (let k = 0; k < 2; k++) {
        const s0 = k * (HALF + DWELL);
        if (L < s0 + DWELL) return { u: STOPS[k], at: k };
        if (L < s0 + DWELL + HALF) { const f = (L - s0 - DWELL) / HALF, e = f * f * (3 - 2 * f); return { u: (STOPS[k] + e * 0.5) % 1, at: -1 }; }
      }
      return { u: STOPS[0], at: 0 };
    };
    townTicks.push(t => {
      const { u, at } = tramAt(t), L = ((t % LOOP) + LOOP) % LOOP;
      carPath.at(u, tp, td);
      tram.position.set(tp.x, 0.04, tp.z);
      tram.rotation.y = Math.atan2(td.x, td.z);
      stops.forEach((st, k) => {
        const since = at === k ? L - k * (HALF + DWELL) : -1;
        // Waiting people board one by one; after it leaves the stop fills up again slowly.
        const sinceLeft = ((L - (k * (HALF + DWELL) + DWELL)) % LOOP + LOOP) % LOOP;
        st.wait.forEach((w, j) => { w.visible = since >= 0 ? since < 1 + j * 0.9 : sinceLeft > 8 + j * 9; w.position.y = 0.2 + (w.visible && since < 0 ? 0 : 0); });
        // Two passengers get off and walk away from the stop into town.
        st.off.forEach((w, j) => {
          const k2 = since >= 0 ? since - 0.6 - j * 0.7 : -1;
          w.visible = k2 > 0 && k2 < 3.6;
          if (!w.visible) return;
          const dx = -st.nx, dz = -st.nz, side = j ? 0.35 : -0.35;
          w.position.set(st.x + dx * k2 * 0.45 + st.nz * side, 0.2 + Math.abs(Math.sin(t * 9 + j)) * 0.04, st.z + dz * k2 * 0.45 - st.nx * side);
          w.rotation.y = Math.atan2(dx, dz);
          w.scale.setScalar(1.3 * Math.min(1, (3.6 - k2) * 2));
        });
      });
    });
  }
  if (rank >= 3) {
    // City: glowing billboards just outside the street, brighter after dark.
    const ads = ["#ff4f8b", "#2f9bff", "#ffb13b", "#5ee0a0"], bp = new THREE.Vector3(), bd = new THREE.Vector3();
    const glows: THREE.MeshStandardMaterial[] = [];
    [0.08, 0.33, 0.58, 0.83].forEach((u, k) => {
      const { nx, nz } = outward(u, bp, bd);
      const x = bp.x + nx * 0.85, z = bp.z + nz * 0.85, ry = Math.atan2(-nx, -nz);
      const m = own(std(ads[k], { emissive: new THREE.Color(ads[k]), emissiveIntensity: 0.4, roughness: 0.4 }));
      m.userData.dynamic = true; glows.push(m);
      const bg = new THREE.Group();
      for (const px of [-0.4, 0.4]) bg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6).translate(px, 0.65, 0), metal));
      bg.add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 0.06).translate(0, 1.45, 0), mats.c("#2a2f4a", 0.5)));
      for (const side of [0.035, -0.035]) bg.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.02).translate(0, 1.45, side), m));
      bg.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02).translate(-0.25, 1.52, 0.05), mats.c("#ffffff", 0.4)));
      bg.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8).translate(0.32, 1.45, 0.05), mats.c("#fff2b0", 0.3)));
      bg.position.set(x, 0.2, z); bg.rotation.y = ry;
      bg.userData.dynamic = true;
      g.add(bg);
    });
    { const { nx, nz } = outward(0.08, bp, bd); const lx = bp.x + nx * 0.85, lz = bp.z + nz * 0.85; landmarks[3] = () => ({ x: lx, z: lz }); }
    townTicks.push((t, night) => glows.forEach((m, k) => { m.emissiveIntensity = 0.35 + night * 1.6 + Math.max(0, Math.sin(t * 2.2 + k * 1.7)) * 0.25; }));
  }
  if (rank >= 4) {
    // Big City: airships drifting in wide circles over the island.
    const ships = [0, 1].map(k => {
      const a = new THREE.Group();
      a.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10).scale(2.1, 0.75, 0.75), mats.c(k ? "#ffffff" : "#ffd6e4", 0.5)));
      a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16, 1, true).rotateZ(Math.PI / 2).translate(0.15, 0, 0), mats.c(k ? "#2f6fff" : "#ff5f8b", 0.5)));
      a.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.2).translate(0, -0.47, 0), mats.c("#3a3f5a", 0.5)));
      for (const r of [0, Math.PI / 2]) a.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.03).rotateX(r).translate(-1.0, 0, 0), mats.c(k ? "#2f6fff" : "#ff5f8b", 0.5)));
      a.userData.dynamic = true;
      g.add(a);
      return a;
    });
    landmarks[4] = () => ({ x: ships[0].position.x, z: ships[0].position.z });
    townTicks.push(t => ships.forEach((a, k) => {
      const ang = t * (k ? -0.035 : 0.045) + k * 2.6, r = 6.5 + k * 2.5;
      a.position.set(cx + Math.cos(ang) * r, 6.2 + k * 1.4 + Math.sin(t * 0.4 + k) * 0.25, cz + Math.sin(ang) * r);
      a.rotation.y = -ang + (k ? Math.PI / 2 : -Math.PI / 2);
    }));
  }
  if (rank >= 5) {
    // Metropolis: slim glass towers rise on the floating islands.
    const tones = ["#bfe6ff", "#d9ccff", "#ffd9c2"];
    { const it = islets[1] ?? islets[0]; if (it) landmarks[5] = () => ({ x: it.o.position.x, z: it.o.position.z }); }
    islets.forEach((it, k) => {
      if (k === 1 && cafe.annex) return;
      const n = k === 0 ? 3 : 2;
      for (let j = 0; j < n; j++) {
        const h = 1.2 + ((j + k) % 3) * 0.55, w = 0.26 + (j % 2) * 0.06, x = (j - (n - 1) / 2) * 0.42, z = k === 0 ? 0.35 : 0;
        it.o.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(x, h / 2, z), mats.c(tones[(j + k) % 3], 0.15, 0.4)));
        it.o.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.05, w + 0.03).translate(x, h * 0.5, z), mats.c("#ffffff", 0.5)));
        it.o.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.12, w * 0.6).translate(x, h + 0.06, z), mats.c("#e9e4f5", 0.5)));
      }
    });
  }
  if (rank >= 6 && islets[0]) {
    // Sky Capital: the golden Skyhaven Tower on the big floating island, a beacon on top.
    const o = islets[0].o, gw = own(std("#fff2b0", { emissive: 0xffd27a, emissiveIntensity: 0.6 }));
    landmarks[6] = () => ({ x: o.position.x, z: o.position.z });
    gw.userData.dynamic = true;
    o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8).translate(0, 0.15, -0.3), stone));
    o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 3.2, 8).translate(0, 1.9, -0.3), mats.gold));
    for (const y of [1.0, 1.9, 2.8]) o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3 - y * 0.03, 0.3 - y * 0.03, 0.07, 8).translate(0, y, -0.3), mats.c("#ffffff", 0.4)));
    o.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 8).translate(0, 3.95, -0.3), mats.gold));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8).translate(0, 4.45, -0.3), gw);
    o.add(beacon);
    townTicks.push((t, night) => { gw.emissiveIntensity = 0.6 + night * 2 + Math.sin(t * 3) * 0.3; });
  }
  // ---- The annex: the floating island next to the town (opens at Big City) ----
  if (cafe.annex && islets[1]) {
    const it = islets[1], o = it.o, built = cafe.annex !== "ghost";
    landmarks[7] = () => ({ x: o.position.x, z: o.position.z });
    // A rope bridge from the island's edge out to it.
    let edge = hull[0];
    for (const p of hull) if (Math.hypot(p[0] - o.position.x, p[1] - o.position.z) < Math.hypot(edge[0] - o.position.x, edge[1] - o.position.z)) edge = p;
    const n = 16, ex = edge[0], ez = edge[1], bx = o.position.x - (o.position.x - ex) * 0.12, bz = o.position.z - (o.position.z - ez) * 0.12;
    const len = Math.hypot(bx - ex, bz - ez), ang = Math.atan2(bx - ex, bz - ez);
    for (let i = 0; i <= n; i++) {
      const f = i / n, y = 0.12 + (it.y + 0.05 - 0.12) * f - Math.sin(f * Math.PI) * 0.3;
      add(new THREE.BoxGeometry(0.62, 0.04, (len / n) * 0.8).rotateY(ang).translate(ex + (bx - ex) * f, y, ez + (bz - ez) * f), wood);
      if (i % 4 === 0) for (const s2 of [-1, 1]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 5).translate(ex + (bx - ex) * f + Math.cos(ang) * 0.32 * s2, y + 0.2, ez + (bz - ez) * f - Math.sin(ang) * 0.32 * s2), wood);
    }
    if (!built) {
      // Waiting: a glowing ring where the landmark will stand.
      const rm = own(new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, depthWrite: false }));
      rm.userData.dynamic = true;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32).rotateX(-Math.PI / 2).translate(0, 0.02, 0), rm);
      o.add(ring);
      townTicks.push(t => { rm.opacity = 0.35 + Math.sin(t * 3) * 0.25; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08); });
    } else if (cafe.annex === "greenhouse") {
      const sx = 1 / ANNEX_S;
      const gh = new THREE.Group();
      gh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 24).translate(0, 0.05, 0), stone));
      const glassM = own(new THREE.MeshStandardMaterial({ color: 0xd9f4ff, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.2, depthWrite: false }));
      glassM.userData.dynamic = true;
      gh.add(new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.1, 0), glassM));
      for (let q = 0; q < 6; q++) gh.add(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.012, 4, 24, Math.PI).rotateY((q / 6) * Math.PI).translate(0, 0.1, 0), metal));
      for (let q = 0; q < 6; q++) { const a = q * 1.05; gh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + (q % 2) * 0.05, 0).translate(Math.cos(a) * 0.3, 0.24, Math.sin(a) * 0.3), q % 3 ? leaf : mats.c("#ff7aa8", 0.7))); }
      gh.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6).translate(0, 0.35, 0), leaf));
      gh.scale.set(sx * 1.3, 1.3, sx * 1.3);
      o.add(gh);
    } else {
      const sx = 1 / ANNEX_S, lk = new THREE.Group(), w2 = mats.c("#a0683a", 0.8);
      for (const [x2, z2] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) lk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.4, 6).translate(x2, 0.7, z2), w2));
      lk.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7).translate(0, 1.4, 0), w2));
      lk.add(new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 4).rotateY(Math.PI / 4).translate(0, 1.85, 0), mats.c("#e2453c", 0.6)));
      for (const y2 of [1.5, 1.6]) lk.add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.72).translate(0, y2, 0), w2));
      lk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 8).rotateZ(1.1).translate(0.2, 1.55, 0.1), metal));
      lk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4).translate(0, 2.25, 0), metal));
      lk.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.01).translate(0.11, 2.42, 0), mats.c("#ffd23a", 0.5)));
      lk.scale.set(sx, 1, sx);
      o.add(lk);
    }
    if (built) {
      // Visitors from the town strolling round it.
      const walkers = [0, 1].map(k2 => { const p = makePerson(shirts[(k2 * 3 + 2) % shirts.length]); p.scale.set(1.2 / ANNEX_S, 1.2, 1.2 / ANNEX_S); o.add(p); return p; });
      townTicks.push(t => walkers.forEach((p, k2) => { const a = t * 0.35 + k2 * Math.PI; p.position.set(Math.cos(a) * 0.78, 0.0, Math.sin(a) * 0.78); p.rotation.y = -a; }));
    }
  }
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

  if (blobGeos.length) { const bg = mergeGeometries(blobGeos); blobGeos.forEach(q => q.dispose()); if (bg) add(bg, blobM); }
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
  const look: Partial<TownLook> = {};
  const tmpV = new THREE.Vector3();
  const lampW = lampAt.map(() => new THREE.Vector3());
  return {
    group: g,
    top: i => (i === -1 ? plotTop : i < -1 ? 1.4 : tops[i] ?? 2),
    resident: () => block.resident(),
    landmark: r => (landmarks[r] ? landmarks[r]() : null),
    spot: id => block.spot(id),
    look(l) { fx.look(l); Object.assign(look, l); },
    beach: () => beachSpot,
    update(t, night, live) {
      const dt = Math.min(0.1, last ? t - last : 0.016);
      last = t;
      fx.time.value = t;
      // Lamps and the shoreline in world space (the town moves as the camera changes islands).
      g.updateWorldMatrix(true, false);
      lampAt.forEach((v, k) => lampW[k].copy(v).applyMatrix4(g.matrixWorld));
      fx.lamps(lampW);
      fx.shore(tmpV.set(0, 0, zShore).applyMatrix4(g.matrixWorld).z);
      flockLive(t);
      for (const f of townTicks) f(t, night);
      for (const it of islets) { it.o.position.y = it.y + Math.sin(t * 0.5 + it.k * 2) * 0.12; it.o.rotation.y = Math.sin(t * 0.2 + it.k) * 0.08; }
      winMat.emissiveIntensity = 0.05 + night * 0.9;
      for (const m of towerGlass) m.emissiveIntensity = 0.05 + night * 0.9;
      lampMat.emissiveIntensity = 0.2 + night * 2.2;
      bulb.emissiveIntensity = 0.5 + night * 1.5 + Math.sin(t * 8) * 0.25;
      for (const m of signs) m.emissiveIntensity = 0.15 + night * 0.9;
      for (const b of beacons) {
        (b.material as THREE.MeshBasicMaterial).opacity = Math.max(0, night - 0.3) * 0.1;
        b.rotation.z = Math.sin(t * 0.5) * 0.35;
        b.rotation.x = Math.cos(t * 0.4) * 0.25;
      }
      jet.scale.y = 1 + Math.sin(t * 4) * 0.08;
      beachLive(t, night);
      coffeeSale = Math.max(coffeeSale, live.block?.sold ?? 0);
      block.update(Date.now(), dt, t, live.block, coffeeSale);
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
      g.userData.moving = false;
      for (const r of rising) {
        if (r.at < 0) r.at = t;
        const k = (t - r.at) / 1.3;
        if (k >= 1.6) { r.puff.opacity = 0; r.glow.opacity = 0; continue; }
        const e = k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
        if (k < 1) { r.lg.scale.set(1, Math.max(0.02, e), 1); risingNow.add(r.lg); g.userData.moving = true; }
        r.puff.opacity = Math.max(0, 0.7 * (1 - k / 1.6));
        r.puffMesh.scale.setScalar(1 + k * 0.8);
        r.glow.opacity = Math.max(0, Math.sin(Math.min(1, k / 1.4) * Math.PI) * 0.35);
      }
      // A building that just sold bounces.
      const now = Date.now();
      for (const [id, lg] of lotGroups) {
        if (risingNow.has(lg)) continue;
        const k = id === live.pulse ? (now - (live.pulseAt ?? 0)) / 450 : 1;
        if (k >= 0 && k < 1) { g.userData.moving = true; const b = Math.sin(k * Math.PI) * (1 - k); lg.scale.set(1 - b * 0.06, 1 + b * 0.14, 1 - b * 0.06); }
        else lg.scale.set(1, 1, 1);
      }
      shopperLive(dt);
      // People stroll round the town; cars drive the outer street.
      for (const w of walkers) {
        w.u = (w.u + w.v * dt + 1) % 1;
        walkPath.at(w.u, tmp, dir);
        w.p.position.set(tmp.x, 0.2 + Math.abs(Math.sin(t * 9 + w.u * 50)) * 0.04, tmp.z);
        w.p.rotation.y = Math.atan2(dir.x, dir.z) + (w.v < 0 ? Math.PI : 0);
        w.p.rotation.z = Math.sin(t * 9 + w.u * 50) * 0.08;
      }
      trafficLive(Math.min(0.1, dt));
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
export function roofProp(id: string, c1: THREE.Color, c2: THREE.Color): THREE.Group {
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
/** How far the island reaches past the town's streets: a countryside ring of farms, cottages,
 *  a windmill and a winding lane (more to explore now that you can drag the town around). */
const ISLAND_PAD = 3.4;
const outlineCache = new Map<number, [number, number][]>();
function islandOutline(pad = ISLAND_PAD): [number, number][] {
  const hit = outlineCache.get(pad);
  if (hit) return hit;
  const r = makeOutline(pad);
  outlineCache.set(pad, r);
  return r;
}
function makeOutline(pad: number): [number, number][] {
  const pts: [number, number][] = [];
  for (const c of [...ALL, ...BEACH]) { const { x, z } = cellXZ(c); for (const dx of [-1, 1]) for (const dz of [-1, 1]) pts.push([x + dx * C / 2, z + dz * C / 2]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = grow([...lower.slice(0, -1), ...upper.slice(0, -1)], pad);
  // A natural coastline instead of a cut shape: walk round the outline and push each point
  // out by a smooth, uneven amount (bays and headlands), then round it off. It never comes
  // in past the streets.
  const pts2: [number, number][] = [];
  let dist = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    const steps = Math.max(1, Math.ceil(len / 0.8));
    for (let j = 0; j < steps; j++) {
      const f = j / steps, d = dist + f * len;
      const out = 0.6 + 0.8 * Math.sin(d * 0.21 + 0.6) + 0.7 * Math.sin(d * 0.47 + 2.1) + 0.25 * Math.sin(d * 1.31 + 0.3);
      const o = Math.max(0.12, out);
      pts2.push([a[0] + (b[0] - a[0]) * f + nx * o, a[1] + (b[1] - a[1]) * f + nz * o]);
    }
    dist += len;
  }
  // Two rounds of corner-cutting: soft curves, no sharp points.
  let ring = pts2;
  for (let r = 0; r < 2; r++) {
    const next: [number, number][] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    ring = next;
  }
  return ring;
}

/** Whether a point is inside an outline (any shape), at least `m` from its edge. */
function insidePoly(poly: [number, number][], x: number, z: number, m = 0): boolean {
  let inn = false, near = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inn = !inn;
    if (m > 0) {
      const ex = xj - xi, ez = zj - zi, L = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / L));
      near = Math.min(near, Math.hypot(x - (xi + ex * t), z - (zi + ez * t)));
    }
  }
  return inn && (m <= 0 || near >= m);
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

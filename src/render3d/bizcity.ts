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
import { LAND, type LandId } from "../data/land";
import { genBuilding, type GenKit } from "./propgen";

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
  /** The property whose card is open (the camera glides to it). */
  selHome?: string;
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
const C = 7.6;
/** Half a street's width (each block's own side of it): streets are 2.4 wide. */
const ROAD = 1.2;

/** A flat slab with rounded corners, w by d, h thick, lying on y = 0..h (centered). */
function roundSlab(w: number, d: number, r: number, h: number): THREE.BufferGeometry {
  const x = w / 2, z = d / 2, rr = Math.min(r, x, z);
  const sh = new THREE.Shape();
  sh.moveTo(-x + rr, -z);
  sh.lineTo(x - rr, -z); sh.absarc(x - rr, -z + rr, rr, -Math.PI / 2, 0, false);
  sh.lineTo(x, z - rr); sh.absarc(x - rr, z - rr, rr, 0, Math.PI / 2, false);
  sh.lineTo(-x + rr, z); sh.absarc(-x + rr, z - rr, rr, Math.PI / 2, Math.PI, false);
  sh.lineTo(-x, -z + rr); sh.absarc(-x + rr, -z + rr, rr, Math.PI, Math.PI * 1.5, false);
  return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 12 }).rotateX(Math.PI / 2).translate(0, h, 0);
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
/** The neighborhoods round the business district: blocks of homes, flats and corner shops
 *  (and a park or two), so the town is a real city with downtown in the middle. */
const NEIGH: [number, number][] = [[2, 0], [0, 2], [3, 1], [1, 3], [4, 2], [2, 4], [5, 3], [3, 5], [5, 4], [4, 5], [3, 0], [0, 3], [-1, 1], [5, 2]];
/** Which of those are little parks instead of homes. */
const NEIGH_PARK = new Set(["3,0", "0,3", "5,4"]);
const ALL = [...CELLS, ...PARKS, PLAZA, PLOT, ...NEIGH];
/** Neighbouring blocks joined into one longer block (no street between them, a walking
 *  street with trees and benches instead), so the town isn't a plain checkerboard: the two
 *  parks and the plaza make one big central park, and some homes share a block with a park. */
const JOINED: [[number, number], [number, number]][] = [
  [[4, 3], [4, 4]], [[3, 4], [4, 4]], [[2, 0], [3, 0]], [[0, 2], [0, 3]], [[5, 3], [5, 4]], [[3, 5], [4, 5]], [[4, 2], [5, 2]],
];
const JOINED_SET = new Set(JOINED.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
/** Whether there's no street between two neighbouring blocks. */
const joined = (ax: number, az: number, bx: number, bz: number) => JOINED_SET.has(`${ax},${az}|${bx},${bz}`);
/** Each block's corner roundness (blocks of one joined pair share it), so blocks differ. */
const blockRound = (gx: number, gz: number): number => {
  for (const [a, b] of JOINED) if ((a[0] === gx && a[1] === gz) || (b[0] === gx && b[1] === gz)) { gx = a[0]; gz = a[1]; break; }
  return [1.7, 0.7, 1.2, 1.7, 0.45][Math.abs(gx * 7 + gz * 13) % 5];
};
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
/** Lays a street texture flat on the ground in world units (so it never stretches along a
 *  long road and lines up across neighbouring pieces): `scale` texture tiles per unit. */
function planarUV(root: THREE.Object3D, scales: Map<THREE.Material, number>): void {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3(), done = new Set<THREE.BufferGeometry>();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const sc = scales.get(m.material as THREE.Material);
    if (sc === undefined || done.has(m.geometry)) return;
    done.add(m.geometry);
    const pos = m.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); uv[i * 2] = v.x * sc; uv[i * 2 + 1] = v.z * sc; }
    m.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  });
}
/** Real street surfaces, drawn once and shared: asphalt with grain, worn patches and a few
 *  cracks, and sidewalk paving slabs with grout lines. */
let asphaltTexture: THREE.CanvasTexture | null = null, paverTexture: THREE.CanvasTexture | null = null;
function asphaltTex(): THREE.CanvasTexture {
  if (asphaltTexture) return asphaltTexture;
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  x.fillStyle = "#5c5f68"; x.fillRect(0, 0, N, N);
  let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // Worn, patched areas a shade lighter or darker.
  for (let i = 0; i < 9; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)"; const r = 20 + rnd() * 50, ex = rnd() * N, ey = rnd() * N, rr = r * (0.4 + rnd() * 0.6), ra = rnd() * 3; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.ellipse(ex + ox, ey + oy, r, rr, ra, 0, Math.PI * 2); x.fill(); } }
  // Aggregate grain.
  for (let i = 0; i < 5000; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.07})` : `rgba(255,255,255,${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
  // A few thin cracks and a tar-sealed seam.
  x.strokeStyle = "rgba(20,20,26,0.28)"; x.lineWidth = 1;
  for (let i = 0; i < 2; i++) { x.beginPath(); let px = N * 0.3 + rnd() * N * 0.4, py = N * 0.3 + rnd() * N * 0.4; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 24; py += (rnd() - 0.5) * 24; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (asphaltTexture = t);
}
function paverTex(): THREE.CanvasTexture {
  if (paverTexture) return paverTexture;
  const N = 128, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  x.fillStyle = "#b8b2a8"; x.fillRect(0, 0, N, N);
  let sd = 11;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const S = N / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 226 + Math.floor(rnd() * 16);
    x.fillStyle = `rgb(${v},${v - 4},${v - 12})`; x.fillRect(i * S + 2, j * S + 2, S - 4, S - 4);
    for (let k = 0; k < 220; k++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; x.fillRect(i * S + 2 + rnd() * (S - 4), j * S + 2 + rnd() * (S - 4), 1.5, 1.5); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (paverTexture = t);
}
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
/** Which bought land the town has already shown (so a fresh purchase animates once), and
 *  whether a town has been built yet this session (nothing animates on the first load). */
const landSeen = new Set<string>();
/** Each property's level as last built (so an upgrade animates once). */
const propsSeen: Record<string, number> = {};
let landBuiltOnce = false;
/** Land next to the island (data/land.ts): its middle and size, on sale (floating a little way
 *  off the edge) or bought (joined to the island, overlapping its edge). */
const DIST_N = 4, DIST_H = (DIST_N / 2) * C + 3.2, DIST_GAP = 6;
/** How far a district's (rounded-square) coast is from its middle in direction (dx, dz). */
const distEdge = (dx: number, dz: number) => DIST_H / Math.pow(Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dz), 4), 0.25);
const LAND_R = DIST_H;
const landCache = new Map<string, { x: number; z: number; r: number; y: number }>();
export function landSpot(k: number, bought: boolean): { x: number; z: number; r: number; y: number } {
  const key = `${k}|${bought}`;
  let v = landCache.get(key);
  if (!v && k > 0) {
    // The next islands follow round the town, each a step further round, further out and
    // higher than the one before.
    const hull = islandOutline(ISLAND_PAD, true), cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cz = hull.reduce((a, p) => a + p[1], 0) / hull.length;
    const first = landSpot(0, bought), a0 = Math.atan2(first.z - cz, first.x - cx), d0 = Math.hypot(first.x - cx, first.z - cz);
    void d0;
    // Measured from the coast in that direction (the island is not round), so no island ever
    // sits over the town or its countryside, and pushed further out if it would crowd one of
    // the islands before it.
    const a = a0 + k * 0.95, dx = Math.cos(a), dz = Math.sin(a);
    let t = 0;
    while (t < 300 && insidePoly(hull, cx + dx * t, cz + dz * t)) t += 0.25;
    let out = t + distEdge(dx, dz) + DIST_GAP + 10 + k * 2;
    const clear = (x: number, z: number) => {
      for (let m = 0; m < k; m++) { const o = landSpot(m, bought); if (Math.hypot(o.x - x, o.z - z) < DIST_H * 2.9 + DIST_GAP) return false; }
      return true;
    };
    while (out < 400 && !clear(cx + dx * out, cz + dz * out)) out += 1;
    v = { x: cx + dx * out, z: cz + dz * out, r: LAND_R, y: LAND[k].y };
    landCache.set(key, v);
  }
  if (!v) {
    const hull = islandOutline(ISLAND_PAD, true), cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cz = hull.reduce((a, p) => a + p[1], 0) / hull.length;
    const [dx0, dz0] = LAND[k].dir, l = Math.hypot(dx0, dz0), dx = dx0 / l, dz = dz0 / l;
    // Where a line out from the middle of the island in that direction meets the coast.
    let t = 0;
    while (t < 200 && insidePoly(hull, cx + dx * t, cz + dz * t)) t += 0.25;
    const best: [number, number] = [cx + dx * t, cz + dz * t];
    // A whole district: its own island, a bridge's length off the coast.
    void bought;
    const out = distEdge(dx, dz) + DIST_GAP;
    v = { x: best[0] + dx * out, z: best[1] + dz * out, r: LAND_R, y: LAND[k].y };
    landCache.set(key, v);
  }
  return v;
}
/** How far the island reaches on screen: across (t, screen x) and into the screen (s), local
 *  units. `core`: just the town and its verge (what the camera frames), not the countryside. */
const boundsCache = new Map<boolean, { tMin: number; tMax: number; sMin: number; sMax: number }>();
export function townBounds(core = false): { tMin: number; tMax: number; sMin: number; sMax: number } {
  let b = boundsCache.get(core);
  if (!b) {
    const pts = islandOutline(core ? 1.0 : ISLAND_PAD, true).slice();
    // (Looking around reaches the land next to the island too.)
    // (A higher island shows further up the screen: the same as one further back.)
    if (!core) LAND.forEach((_, k) => { const a = landSpot(k, false), x = a.x - a.y, z = a.z - a.y; pts.push([x - a.r, z - a.r], [x + a.r, z + a.r], [x - a.r, z + a.r], [x + a.r, z - a.r]); });
    const ts = pts.map(([x, z]) => (x - z) * Math.SQRT1_2), ss = pts.map(([x, z]) => (x + z) * Math.SQRT1_2);
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
  /** Land next to the island (data/land.ts): bought (part of the island) or on sale now. */
  land?: { id: LandId; bought: boolean; sale: boolean }[];
  /** The town's properties' levels (data/props.ts), by key. */
  props?: Record<string, number>;
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
  landmark(rank: number): { x: number; z: number; zoom?: number } | null;
  /** The flower market's and the playground's spots. */
  spot(id: "flowers" | "play"): { x: number; z: number };
  /** Where piece of land k stands now (for its "for sale" bubble), or null if it isn't shown. */
  landAt(k: number): { x: number; z: number; y: number } | null;
  /** The town's properties (and the districts'): where each stands, how tall, its key. */
  homes(): { x: number; z: number; top: number; key: string; y: number }[];
}

export function buildBizCity(lots: BizLot[], st: BizStyle = DEFAULT_STYLE, grown: string[] = [], cafe: BizCafe = { starter: null, terrace: 0, contract: 0 }): BizCity {
  setLand((cafe.land ?? []).filter(l => l.bought).map(l => LAND.findIndex(x => x.id === l.id)).filter(k => k >= 0));
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
  // (Real asphalt: one texture tile every 2.5 units of street.)
  const roadTex = asphaltTex().clone(); roadTex.needsUpdate = true; roadTex.repeat.set(1, 1);
  const road = own(std("#ffffff", { roughness: 0.92, map: roadTex }));
  const plazaM = own(std("#f7efe2", { roughness: 0.8 }));
  // (Paving slabs half a unit across; the sidewalk shapes are measured in world units.)
  const walkTex = paverTex().clone(); walkTex.needsUpdate = true; walkTex.repeat.set(1, 1);
  const walk = own(std("#ffffff", { roughness: 0.85, map: walkTex }));
  const streetUV = new Map<THREE.Material, number>([[road, 1 / 3], [walk, 1.4]]);
  const curb = own(std("#d6c9b5", { roughness: 0.75 }));
  const verge = own(std(st.lawn, { roughness: 0.95 }));
  const grass = own(std(new THREE.Color("#7ccf6a").lerp(new THREE.Color(st.lawn), 0.15), { roughness: 0.95 }));
  const grass2 = own(std(new THREE.Color("#6cbf5c").lerp(new THREE.Color(st.lawn), 0.15), { roughness: 0.95 }));
  const pave = own(std("#efe9df", { roughness: 0.7 }));
  const water = own(std("#5fc2ff", { roughness: 0.14, metalness: 0.0, emissive: 0x2a6fbf, emissiveIntensity: 0.06 }));
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
  // The edge, in layers like a real cliff: a lip of grass that hangs a little over the edge,
  // dark topsoil, warm earth, then two tones of rock.
  slab(hull, 0.12, 0, verge);
  slab(grow(hull, 0.07), 0.06, -0.02, own(std(new THREE.Color(st.lawn).multiplyScalar(0.8), { roughness: 0.95 })));
  slab(grow(hull, -0.04), 0.12, -0.12, own(std("#5a3f2a", { roughness: 1 })));
  slab(grow(hull, -0.07), 0.4, -0.24, earth);
  slab(grow(hull, -0.2), 0.45, -0.64, rock);
  slab(grow(hull, -0.28), 0.55, -1.09, rockDark);
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
    const rr = blockRound(cell[0], cell[1]);
    add(roundSlab(C - ROAD * 2, C - ROAD * 2, rr, 0.18).translate(x, 0, z), curb);
    add(roundSlab(C - ROAD * 2 - 0.16, C - ROAD * 2 - 0.16, rr - 0.1, 0.2).translate(x, 0, z), walk);
  }
  // Joined blocks: the street between them is paved over as one long block.
  const promenades: { x: number; z: number; alongX: boolean }[] = [];
  for (const [a, b] of JOINED) {
    const A = cellXZ(a), B = cellXZ(b), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, alongX = a[1] === b[1];
    const W = C - ROAD * 2;
    add(new THREE.BoxGeometry(alongX ? C : W, 0.18, alongX ? W : C).translate(mx, 0.09, mz), curb);
    add(new THREE.BoxGeometry(alongX ? C : W - 0.16, 0.2, alongX ? W - 0.16 : C).translate(mx, 0.1, mz), walk);
    promenades.push({ x: mx, z: mz, alongX });
  }
  // Road markings like a real city's, on the streets between blocks (the edge street round
  // the town stays plain): a white zebra crossing and a stop line before every crossing,
  // and a dashed line down the middle.
  const medianTrees: [number, number][] = [];
  const paintM = own(new THREE.MeshBasicMaterial({ color: 0xefeee8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  /** The markings on one street: centred at (cx, cz), running along x or z, `run` long. */
  const markStreet = (par: (geo: THREE.BufferGeometry, m: THREE.Material) => unknown, cx: number, cz: number, along: "x" | "z", run: number, y = 0.062) => {
    // (All of one street's paint is one mesh: a few hundred streets, not thousands of bars.)
    const parts: THREE.BufferGeometry[] = [];
    const P = (w: number, d: number, ox: number, oz: number) => { const geo = new THREE.PlaneGeometry(along === "z" ? w : d, along === "z" ? d : w).rotateX(-Math.PI / 2); parts.push(geo.translate(cx + (along === "z" ? ox : oz), y, cz + (along === "z" ? oz : ox))); };
    const cross = run / 2 - 0.45;
    for (const end of [-1, 1]) {
      for (let b = -3; b <= 3; b++) P(0.2, 0.62, b * 0.32, end * cross);
      P(ROAD - 0.1, 0.1, end * (ROAD / 2), end * (cross - 0.5));
    }
    const dashFrom = -cross + 0.75, dashTo = cross - 0.75;
    for (let d = dashFrom; d + 0.45 <= dashTo; d += 0.85) P(0.1, 0.45, 0, d + 0.225);
    const merged = mergeGeometries(parts); parts.forEach(q => q.dispose());
    if (merged) par(merged, paintM);
  };
  {
    const inAll = (gx: number, gz: number) => ALL.some(c => c[0] === gx && c[1] === gz);
    for (const cell of ALL) {
      const { x, z } = cellXZ(cell);
      if (inAll(cell[0] + 1, cell[1]) && !joined(cell[0], cell[1], cell[0] + 1, cell[1])) markStreet(add, x + q, z, "z", C - 2 * 0.3);
      if (inAll(cell[0], cell[1] + 1) && !joined(cell[0], cell[1], cell[0], cell[1] + 1)) markStreet(add, x, z + q, "x", C - 2 * 0.3);
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
        // (Not where a joined block makes it a T-junction or a corner.)
        if (joined(ax, az, ax + 1, az) || joined(ax, az + 1, ax + 1, az + 1) || joined(ax, az, ax, az + 1) || joined(ax + 1, az, ax + 1, az + 1)) continue;
        const { x, z } = cellXZ([ax, az]);
        roundabouts.push([x + q, z + q]);
      }
    }
  }
  const ringPaint = own(new THREE.MeshBasicMaterial({ color: 0xb3a189 }));
  for (const [x, z] of roundabouts) {
    add(new THREE.RingGeometry(0.98, 1.05, 32).rotateX(-Math.PI / 2).translate(x, 0.056, z), ringPaint);
    add(new THREE.CylinderGeometry(0.7, 0.74, 0.16, 24).translate(x, 0.1, z), curb);
    add(new THREE.CylinderGeometry(0.63, 0.63, 0.04, 24).translate(x, 0.2, z), grass);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; add(new THREE.SphereGeometry(0.065, 6, 4).translate(x + Math.cos(a) * 0.48, 0.25, z + Math.sin(a) * 0.48), mats.c(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"][k % 4], 0.8)); }
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
  for (const [x, z] of roundabouts) tree(x, z, 0.7, 0.22);
  for (const [x, z] of medianTrees) tree(x, z, 0.42, 0.26);
  // The walking streets on joined blocks: a row of trees in planting beds down the middle,
  // benches between them and lamps either side.
  for (const pr of promenades) {
    const ux = pr.alongX ? 0 : 1, uz = pr.alongX ? 1 : 0;
    for (const t of [-1.05, 1.05]) {
      const px = pr.x + ux * t, pz = pr.z + uz * t;
      add(new THREE.BoxGeometry(0.7, 0.08, 0.7).translate(px, 0.24, pz), stone);
      add(new THREE.BoxGeometry(0.58, 0.04, 0.58).translate(px, 0.27, pz), grass);
      tree(px, pz, 0.62, 0.28);
    }
    bench(pr.x - (pr.alongX ? 0 : 0) + (pr.alongX ? 0.55 : 0), pr.z + (pr.alongX ? 0 : 0.55), pr.alongX ? Math.PI / 2 : 0);
    bench(pr.x - (pr.alongX ? 0.55 : 0), pr.z - (pr.alongX ? 0 : 0.55), pr.alongX ? -Math.PI / 2 : Math.PI);
    for (const t of [-2.1, 2.1]) {
      const px = pr.x + ux * t, pz = pr.z + uz * t;
      add(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 6).translate(px, 0.8, pz), metal);
      add(new THREE.SphereGeometry(0.1, 8, 6).translate(px, 1.42, pz), mats.c("#fff3c4", 0.3));
    }
  }
  // The two parks by the entrance: lawns, a path, a pond, benches.
  for (const [n, cell] of PARKS.entries()) {
    const { x, z } = cellXZ(cell);
    add(roundSlab(C - ROAD * 2 - 0.6, C - ROAD * 2 - 0.6, 0.8, 0.06).translate(x, 0.2, z), grass);
    // A winding path and a loop instead of a straight cross.
    add(ribbon(sPath(2.0, n === 1).map(([a, b]): [number, number] => [x + a, z + b]), 0.6, 0.275), pave);
    add(new THREE.RingGeometry(0.9, 1.25, 32).rotateX(-Math.PI / 2).translate(x + (n ? 0.5 : -0.5), 0.272, z + 0.6), pave);
    add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20).translate(x + (n ? -1.15 : 1.15), 0.25, z - 1.15), water);
    add(new THREE.TorusGeometry(0.78, 0.06, 6, 20).rotateX(Math.PI / 2).translate(x + (n ? -1.15 : 1.15), 0.28, z - 1.15), stone);
    for (const [a, b, sc] of [[-1.3, 1.2, 0.95], [1.3, 1.3, 0.95], [0, -1.9, 0.8]]) tree(x + a, z + b, sc);
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
  // Street furniture on the sidewalks and the corner plazas: a hydrant and a mailbox along the
  // sidewalk, a flower pot on one plaza and a bench with a bin on another (the street lamps
  // stand on the other two). Nothing sits on the curb or in the road.
  for (const [n, cell] of CELLS.entries()) {
    const { x, z } = cellXZ(cell), side = C / 2 - ROAD - 0.22, pc = C / 2 - ROAD - 0.73;
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8).translate(x - side, 0.33, z - 1.0), mats.c("#ff4f4f", 0.5));
    add(new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x - side, 0.46, z - 1.0), mats.c("#ff4f4f", 0.5));
    if (n % 3 === 0) { add(new THREE.BoxGeometry(0.2, 0.26, 0.16).translate(x + 1.0, 0.48, z - side), mats.c("#3a6fe0", 0.5)); add(new THREE.BoxGeometry(0.06, 0.26, 0.06).translate(x + 1.0, 0.22, z - side), metal); }
    // A round flower pot on the (-, +) plaza.
    add(new THREE.CylinderGeometry(0.24, 0.19, 0.28, 12).translate(x - pc, 0.42, z + pc), mats.c("#d98a5a", 0.8));
    add(new THREE.IcosahedronGeometry(0.22, 0).translate(x - pc, 0.64, z + pc), leaf);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + n; add(new THREE.SphereGeometry(0.06, 6, 4).translate(x - pc + Math.cos(a) * 0.14, 0.78, z + pc + Math.sin(a) * 0.14), mats.c(flowersOn[(n + k) % 4], 0.8)); }
    // A bench facing out from the (+, -) plaza, and a bin beside it.
    bench(x + pc - 0.08, z - pc + 0.08, Math.PI * 0.75);
    add(new THREE.CylinderGeometry(0.1, 0.09, 0.3, 8).translate(x + pc + 0.3, 0.42, z - pc + 0.42), mats.c("#3fae6a", 0.6));
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
  // (Nothing of the countryside's goes on the land the player bought: that's for its own build.)
  const landBuilt = (cafe.land ?? []).filter(l => l.bought).map(l => landSpot(LAND.findIndex(x => x.id === l.id), true));
  const onLand = (x: number, z: number) => landBuilt.some(sp => Math.hypot(x - sp.x, z - sp.z) < sp.r * 1.05) || nearLink(x, z);
  // The road from the town's streets out to the first island's bridge (once it's for sale or
  // bought): where it runs, so the countryside keeps clear of it.
  const link = (() => {
    const l0 = (cafe.land ?? []).find(l => l.id === LAND[0].id && (l.bought || l.sale));
    if (!l0) return null;
    const sp0 = landSpot(0, true), h = islandOutline(ISLAND_PAD, true);
    const tcx = h.reduce((a, p) => a + p[0], 0) / h.length, tcz = h.reduce((a, p) => a + p[1], 0) / h.length;
    const dl0 = Math.hypot(sp0.x - tcx, sp0.z - tcz), ux0 = (sp0.x - tcx) / dl0, uz0 = (sp0.z - tcz) / dl0;
    const sx = sp0.x - ux0 * distEdge(ux0, uz0) * 0.97, sz = sp0.z - uz0 * distEdge(ux0, uz0) * 0.97;
    let t2 = 0;
    while (t2 < 60 && !insidePoly(h, sx - ux0 * t2, sz - uz0 * t2, 0.6)) t2 += 0.25;
    const ex = sx - ux0 * (t2 + 0.6), ez = sz - uz0 * (t2 + 0.6);
    const inStreets = (x: number, z: number) => ALL.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 - 0.2 && Math.abs(z - p.z) < C / 2 - 0.2; });
    let t3 = 0;
    while (t3 < 60 && !inStreets(ex - ux0 * t3, ez - uz0 * t3)) t3 += 0.25;
    return { ax: ex + ux0 * 0.4, az: ez + uz0 * 0.4, bx: ex - ux0 * (t3 + 0.6), bz: ez - uz0 * (t3 + 0.6) };
  })();
  const nearLink = (x: number, z: number) => {
    if (!link) return false;
    const vx = link.bx - link.ax, vz = link.bz - link.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - link.ax) * vx + (z - link.az) * vz) / L2));
    return Math.hypot(x - (link.ax + vx * t), z - (link.az + vz * t)) < 2.2;
  };
  /** A street from a to b: asphalt with curbs and sidewalks either side, as the town's. */
  const streetStrip = (par: THREE.Object3D, ax: number, az: number, bx: number, bz: number, y: number, rM: THREE.Material, wM: THREE.Material, cM: THREE.Material) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) return;
    const rot = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const S = (w: number, h: number, ox: number, m: THREE.Material) => par.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, len).translate(ox, h / 2, 0).rotateY(rot).translate(mx, y, mz), m));
    S(ROAD * 2, 0.1, 0, rM);
    for (const sd of [-1, 1]) { S(0.12, 0.18, sd * (ROAD + 0.06), cM); S(0.55, 0.2, sd * (ROAD + 0.39), wM); }
  };
  // The verge: the island's own trees, bushes, flowers and boulders round the town.
  {
    const inCell = (x: number, z: number) => ALL.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 + 0.35 && Math.abs(z - p.z) < C / 2 + 0.35; });
    const inside = (x: number, z: number, m = 0.45) => insidePoly(hull, x, z, m);
    const tufts: [number, number][] = [];
    let k = 0;
    const FIELD = [["#e8c45a", "#d4a83a"], ["#7cc85a", "#5aa848"], ["#b48cdc", "#9a6ec8"], ["#c8945a", "#a8743a"]];
    for (let x = -OFF - C - ISLAND_PAD; x <= OFF + 3 * C + ISLAND_PAD; x += 1.2) for (let z = -OFF - C - ISLAND_PAD; z <= OFF + 3 * C + ISLAND_PAD; z += 1.2) {
      const jx = x + Math.sin(k * 12.9898) * 0.4, jz = z + Math.cos(k * 78.233) * 0.4, r = Math.abs(Math.sin(k * 3.7));
      k++;
      if (inCell(jx, jz) || !inside(jx, jz) || jz < beachZ + 0.3 || onLand(jx, jz)) continue;
      if (Math.hypot(jx - fx0, jz - fz0) < 1.6 || Math.hypot(jx - (fx0 + fallAt[0]) / 2, jz - (fz0 + fallAt[1]) / 2) < 1.0) continue;
      if (nearLane(jx, jz, 0.75)) continue;
      // Out in the countryside: farm fields in rows (wheat, greens, lavender, ploughed earth)
      // and the odd sheep, between the trees.
      if (!insidePoly(coreHull, jx, jz)) {
        const fh = Math.abs(Math.sin(Math.floor(jx / 2.4) * 12.1 + Math.floor(jz / 2.4) * 7.7)) % 1;
        if (fh < 0.26 && inside(jx, jz, 0.7) && !nearLane(jx, jz, 1.2)) {
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
      if (h < 0.13 && inside(jx, jz, 1.1) && !nearLane(jx, jz, 1.05) && !inCell(jx + 0.6, jz) && !inCell(jx - 0.6, jz) && !inCell(jx, jz + 0.6) && !inCell(jx, jz - 0.6)) {
        const face = Math.atan2(cx - jx, cz - jz), col = COTTAGE[k % COTTAGE.length];
        const ch = new THREE.Group();
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.52).translate(0, 0.21, 0), mats.c(col[0], 0.75)));
        ch.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.36, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.88).translate(0, 0.6, 0), mats.c(col[1], 0.7)));
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.02).translate(0, 0.11, 0.265), mats.c("#6a4a3a", 0.8)));
        for (const wx of [-0.19, 0.19]) ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.02).translate(wx, 0.27, 0.265), winMat));
        ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08).translate(0.16, 0.74, -0.08), mats.c("#b8583a", 0.8)));
        if (h < 0.06) for (let f = 0; f < 5; f++) ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03).translate(-0.4 + f * 0.2, 0.06, 0.48), mats.c("#ffffff", 0.7)));
        blob(jx, jz, 0.62, 0.0);
        ch.position.set(jx, 0.0, jz); ch.rotation.y = face;
        ch.updateMatrixWorld(true);
        ch.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) add(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material as THREE.Material); });
        continue;
      }
      if (h < 0.19 && inside(jx, jz, 0.9)) {
        // Garden rows: brown beds with green tops.
        const ga = Math.atan2(cx - jx, cz - jz);
        for (let row = 0; row < 3; row++) {
          const ox = Math.cos(ga) * (row - 1) * 0.22, oz = -Math.sin(ga) * (row - 1) * 0.22;
          add(new THREE.BoxGeometry(0.16, 0.06, 0.6).rotateY(ga).translate(jx + ox, 0.03, jz + oz), earth);
          for (let q = 0; q < 3; q++) add(new THREE.SphereGeometry(0.06, 5, 4).translate(jx + ox + Math.sin(ga) * (q - 1) * 0.18, 0.09, jz + oz + Math.cos(ga) * (q - 1) * 0.18), mats.c(q % 2 ? "#5ec26a" : "#8ad06a", 0.8));
        }
        continue;
      }
      if (r < 0.4) tree(jx, jz, 0.7 + r, 0);
      else if (r < 0.6) add(new THREE.IcosahedronGeometry(0.28, 0).translate(jx, 0.15, jz), leaf);
      else if (r < 0.72) add(new THREE.DodecahedronGeometry(0.22 + r * 0.2, 0).translate(jx, 0.1, jz), stone);
      else if (r < 0.8) {
        // A small clump of wild flowers (a few heads close together, not lone dots).
        for (let f = 0; f < 4; f++) add(new THREE.SphereGeometry(0.05, 5, 4).translate(jx + Math.cos(f * 1.7 + k) * 0.09, 0.15 + (f % 2) * 0.03, jz + Math.sin(f * 1.7 + k) * 0.09), mats.c(flowersOn[k % 4], 0.8));
        tufts.push([jx, jz]);
      } else tufts.push([jx, jz]);
      // Grass tufts all over the open countryside.
      if (!insidePoly(coreHull, jx, jz)) for (let f = 0; f < 3; f++) { const tx = jx + Math.sin(k * 3.1 + f * 2.3) * 0.5, tz = jz + Math.cos(k * 1.7 + f * 4.1) * 0.5; if (!nearLane(tx, tz, 0.6) && inside(tx, tz, 0.5)) tufts.push([tx, tz]); }
    }
    // The tufts: little three-blade clumps of grass, all in one draw, each a slightly
    // different green.
    if (tufts.length) {
      const blade = (a: number) => new THREE.ConeGeometry(0.03, 0.2, 3).translate(0, 0.1, 0).rotateZ(0.35).rotateY(a);
      const tg = mergeGeometries([blade(0), blade(2.1), blade(4.2)].map(gg => gg.toNonIndexed()))!;
      const tm = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
      const n = Math.min(2500, tufts.length), im = new THREE.InstancedMesh(tg, tm, n), mm = new THREE.Matrix4(), tc = new THREE.Color(), base = new THREE.Color(st.lawn);
      for (let i = 0; i < n; i++) {
        const [tx, tz] = tufts[i], sc = 0.7 + Math.abs(Math.sin(i * 7.7)) * 0.7;
        mm.compose(new THREE.Vector3(tx, 0.1, tz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.4), new THREE.Vector3(sc, sc, sc));
        im.setMatrixAt(i, mm);
        im.setColorAt(i, tc.copy(base).offsetHSL(((i * 37) % 10) / 300 - 0.015, 0.05, -0.08 - ((i * 13) % 7) / 70));
      }
      im.userData.dynamic = true;
      g.add(im);
    }
    // Vines and roots hanging down the cliff here and there.
    { const vineM = own(std(new THREE.Color(st.leaf).multiplyScalar(0.85), { roughness: 0.9 }));
      for (let i = 0; i < hull.length; i += 7) { const [vx, vz] = hull[i], len = 0.35 + Math.abs(Math.sin(i * 3.3)) * 0.7; add(new THREE.BoxGeometry(0.07, len, 0.07).translate(vx, -len / 2 - 0.02, vz), vineM); add(new THREE.SphereGeometry(0.08, 5, 4).translate(vx, -len - 0.02, vz), vineM); } }
    // A low railing of posts and a rail along the island's edge.
    const rail = grow(hull, -0.3);
    let railRun = 0;
    for (let i = 0; i < rail.length; i++) {
      const a = rail[i], b = rail[(i + 1) % rail.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((a[1] + b[1]) / 2 < beachZ - 0.5) continue; // the beach is open to the sea
      if (link && Math.hypot((a[0] + b[0]) / 2 - link.ax, (a[1] + b[1]) / 2 - link.az) < 2.4) continue; // the road out to the bridge
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
    const { x, z } = cellXZ(cell), e = C / 2 - ROAD - 0.73;
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
  const seaM = own(std("#2aa6e6", { roughness: 0.12, metalness: 0.05, emissive: 0x0a4a8a, emissiveIntensity: 0.05 }));
  seaM.userData.dynamic = true;
  const shallowM = own(std("#8fd6f5", { roughness: 0.12, metalness: 0.05, emissive: 0x1a5a9a, emissiveIntensity: 0.05 }));
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
    const deepM = own(std("#1a7fd0", { roughness: 0.1, metalness: 0.05, emissive: 0x062a5a, emissiveIntensity: 0.05 }));
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
    add(roundSlab(C - ROAD * 2 - 0.6, C - ROAD * 2 - 0.6, 0.8, 0.06).translate(x, 0.2, z), grass);
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

  /** Every home, block of flats and office in town (and in the districts): where it stands
   *  and how tall it is, for the rent bubbles over them. */
  const homeSpots: { x: number; z: number; top: number; key: string; y: number }[] = [];
  const homeAt = (x: number, z: number, top: number, key = "", y = 0) => { homeSpots.push({ x, z, top: top + 0.2, key, y }); };
  const genKit: GenKit = { mats, lawn: grass2, pave, metal, slab: roundSlab };
  const propLv = (key: string) => Math.max(1, Math.min(5, cafe.props?.[key] ?? 1));
  /** A property at its level: little homes or a corner shop, then flats getting taller, then
   *  glass towers. One that was just upgraded grows up out of the ground. */
  const propBuilding = (lg: THREE.Group, seed: number, level: number, key: string): number => {
    // (Every property has a design of its own for every size: see propgen.ts.)
    let hsh = 0; for (const ch of key) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const top = genBuilding(lg, hsh + seed, level, genKit);
    if (landBuiltOnce && (propsSeen[key] ?? 1) < level) {
      lg.userData.dynamic = true;
      const t0 = performance.now() + 250;
      lg.scale.y = 0.05;
      townTicks.push(() => {
        const k2 = Math.min(1, Math.max(0, (performance.now() - t0) / 900));
        if (k2 >= 1 && lg.scale.y === 1) return;
        lg.scale.y = k2 < 1 ? Math.max(0.05, 1 - Math.pow(1 - k2, 3) + Math.sin(k2 * Math.PI) * 0.12) : 1;
        g.userData.moving = k2 < 1;
      });
      mergeStatic(lg, 0.05);
    }
    propsSeen[key] = level;
    return top;
  };

  // ---- Neighbors: the homes and corner shops on the lots no business has yet ----
  const HOUSE = ["#fff1e0", "#e9f3ff", "#ffe8ef", "#eefbe8", "#fff7d6", "#f1ebff"];
  const ROOF = ["#d9534a", "#5a6fd0", "#e07a9a", "#4f9a5a", "#b8683a", "#7a5ad0"];
  const BRICK = ["#c9775a", "#d89a6a", "#b5655a", "#e0b48a", "#9a7ad0", "#6a9ad0"];
  const neighborhood = (G: THREE.Group, i: number, tall = 0): number => {
    const K = (geo: THREE.BufferGeometry, m: THREE.Material) => G.add(new THREE.Mesh(geo, m));
    const r = (k: number) => ((i * 7 + k * 13) % 6);
    // Ground: a small front lawn and a paved yard.
    K(roundSlab(4.2, 4.2, 1.6, 0.06), grass2);
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
    const kind = tall < 0 ? 3 : tall ? 1 : i % 3;
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
      const w = 3.1, d = 2.5, floors = tall || 4 + (i % 2), fh = 0.55, cz = -0.35, h = floors * fh;
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
    } else if (kind === 3) {
      // A glass office tower: a curtain wall with a white band at every floor and slim fins,
      // a lobby with a canopy, and a crown on the roof.
      const floors = -tall, fh = 0.6, w = 2.8, d = 2.4, cz = -0.3, h = 0.8 + floors * fh;
      K(new THREE.BoxGeometry(w + 0.2, 0.8, d + 0.2).translate(0, 0.46, cz), mats.c("#e9e4f5", 0.6));
      K(new THREE.BoxGeometry(w - 0.6, 0.6, 0.05).translate(0, 0.42, cz + d / 2 + 0.11), winMat);
      K(new THREE.BoxGeometry(1.6, 0.06, 0.6).translate(0, 0.86, cz + d / 2 + 0.35), mats.c(ROOF[r(5)], 0.5));
      K(new THREE.BoxGeometry(w, floors * fh, d).translate(0, 0.86 + (floors * fh) / 2, cz), winMat);
      for (let f = 0; f <= floors; f++) K(new THREE.BoxGeometry(w + 0.06, 0.07, d + 0.06).translate(0, 0.86 + f * fh, cz), mats.c("#f4f2fa", 0.5));
      for (let fx2 = 0; fx2 < 5; fx2++) for (const sd of [-1, 1]) {
        const ox = -w / 2 + (fx2 + 0.5) * (w / 5);
        K(new THREE.BoxGeometry(0.05, floors * fh, 0.08).translate(ox, 0.86 + (floors * fh) / 2, cz + sd * (d / 2 + 0.02)), mats.c("#c8cce0", 0.4, 0.4));
      }
      K(new THREE.BoxGeometry(w * 0.6, 0.5, d * 0.6).translate(0, 0.86 + floors * fh + 0.25, cz), mats.c("#d6d2e6", 0.5));
      K(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(0.3, 0.86 + floors * fh + 0.95, cz), metal);
      top = h + 1.4;
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
    K(new THREE.CylinderGeometry(0.04, 0.06, 0.36, 6).translate(1.85, 0.25, -1.0), trunk);
    K(new THREE.IcosahedronGeometry(0.27, 0).translate(1.85, 0.6, -1.0), leaf);
    if (i % 2) { const car = carGeo(BODY[(i * 3) % BODY.length], false).clone().rotateY(Math.PI / 2).translate(-1.1, 0.085, 1.65); K(car, carM); }
    return top;
  };

  // The neighborhood blocks round downtown: all of them in one group, merged into a few
  // meshes (cheap however many there are).
  {
    const ng = new THREE.Group();
    g.add(ng);
    NEIGH.forEach((cell, k) => {
      const { x, z } = cellXZ(cell), lg = new THREE.Group();
      lg.position.set(x, 0.2, z);
      // Face the nearer street toward the middle of the screen, like the business lots.
      lg.rotation.y = cell[0] < cell[1] ? Math.PI / 2 : 0;
      ng.add(lg);
      if (NEIGH_PARK.has(`${cell[0]},${cell[1]}`)) {
        const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
        P(roundSlab(4.2, 4.2, 1.6, 0.06), k % 2 ? grass : grass2);
        P(ribbon(sPath(1.9, k % 2 === 1), 0.55, 0.075), pave);
        P(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20).translate(0.9, 0.08, -0.9), water);
        P(new THREE.TorusGeometry(0.72, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0.9, 0.1, -0.9), stone);
        for (const [tx, tz, ts] of [[-1.3, -1.2, 1], [1.3, 1.0, 0.9], [-1.4, 1.4, 0.8], [0.2, -1.6, 0.7]]) {
          P(new THREE.CylinderGeometry(0.06 * ts, 0.1 * ts, 0.6 * ts, 6).translate(tx, 0.3 * ts, tz), trunk);
          P(new THREE.IcosahedronGeometry(0.5 * ts, 0).translate(tx, 0.95 * ts, tz), leaf);
        }
        P(new THREE.BoxGeometry(0.7, 0.06, 0.22).translate(-0.4, 0.42, 0.4), wood);
        P(new THREE.BoxGeometry(0.7, 0.2, 0.05).translate(-0.4, 0.55, 0.3), wood);
        for (let f = 0; f < 6; f++) P(new THREE.SphereGeometry(0.08, 6, 4).translate(0.4 + f * 0.2, 0.12, 1.6), mats.c(flowersOn[(f + k) % 4], 0.8));
      } else {
        // A property (data/props.ts): it grows with its level.
        const key = `t:${cell[0]},${cell[1]}`;
        homeAt(x, z, propBuilding(lg, 20 + k, propLv(key), key), key);
      }
      // Street furniture on the corners: traffic lights, a street sign, now and then a bus
      // stop, and a manhole cover in the street.
      {
        const e = C / 2 - ROAD - 0.73, red = own(std("#ff3a3a", { emissive: 0xff2020, emissiveIntensity: 0.6 })), amber = own(std("#ffb020", { emissive: 0xff9000, emissiveIntensity: 0.25 })), green = own(std("#3aff7a", { emissive: 0x20ff60, emissiveIntensity: 0.6 }));
        for (const [sx, sz] of [[1, -1], [-1, 1]]) {
          const px = x + sx * e, pz = z + sz * e;
          ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.6, 6).translate(px, 1.0, pz), metal));
          ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5).translate(px, 1.75, pz + sz * 0.25), metal));
          ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.12).translate(px, 1.6, pz + sz * 0.48), mats.c("#2a2f45", 0.5)));
          [red, amber, green].forEach((lm, li) => ng.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4).translate(px + sx * 0.07, 1.71 - li * 0.1, pz + sz * 0.48), (k + li) % 3 === 1 ? lm : mats.c("#3a3f55", 0.5))));
        }
        // A street-name sign on its post.
        ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5).translate(x - e, 0.85, z - e), metal));
        ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02).translate(x - e + 0.2, 1.45, z - e), mats.c("#2f8a5a", 0.5)));
        ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.5).translate(x - e, 1.3, z - e + 0.2), mats.c("#2f8a5a", 0.5)));
        if (k % 3 === 0) {
          // A bus stop: a glass shelter with a bench and a sign.
          const bx = x + 2.3, bz = z + 0.6;
          ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.9).translate(bx + 0.12, 0.6, bz), own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, roughness: 0.05 }))));
          ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.95).translate(bx, 1.0, bz), mats.c("#2f9bff", 0.5)));
          ng.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.6).translate(bx + 0.02, 0.42, bz), wood));
          ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4).translate(bx - 0.12, 0.7, bz + 0.55), metal));
          ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10).rotateZ(Math.PI / 2).translate(bx - 0.12, 1.2, bz + 0.55), mats.c("#2f9bff", 0.5)));
        }
        ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 12).translate(x + C / 2, 0.056, z + 1.1), mats.c("#3a3a44", 0.6, 0.4)));
      }
      // Street trees along the sidewalks, two per side.
      for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const o of [-1.1, 1.1]) {
        const tx = x + sx * 2.33 + (sz ? o : 0), tz = z + sz * 2.33 + (sx ? o : 0);
        ng.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6).translate(tx, 0.45, tz), trunk));
        ng.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0).translate(tx, 0.85, tz), leaf));
      }
    });
    mergeStatic(ng, 0.2);
  }

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
        K(roundSlab(4.2, 4.2, 1.6, 0.06), grass2);
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
        mergeStatic(lotG, 0.05);
        return;
      } else {
        // A little park until the business comes: lawn, a winding path, trees, a bench.
        K(roundSlab(4.2, 4.2, 1.6, 0.06), i % 2 ? grass : grass2);
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
      mergeStatic(lotG, 0.05);
      return;
    }
    // The lot: a paved forecourt with a strip of lawn round the back.
    lotG.add(new THREE.Mesh(roundSlab(4.3, 4.3, 1.6, 0.05), grass));
    lotG.add(new THREE.Mesh(roundSlab(4.3, 2.6, 1.25, 0.06).translate(0, 0, 0.85), pave));
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
    // (The building's own size, before the street front goes in front of it: the
    // scaffolding hugs this.)
    lotG.updateMatrixWorld(true);
    const bodyBox = new THREE.Box3();
    { const inv0 = new THREE.Matrix4().copy(lotG.matrixWorld).invert(); for (const ch of lotG.children) { const b2 = new THREE.Box3().setFromObject(ch).applyMatrix4(inv0); if (!b2.isEmpty() && b2.max.y > 0.5) bodyBox.union(b2); } }
    // (On a big flagship's podium the street front stands on the podium, not inside it.)
    if (lot.id !== "coffee") { const sf = new THREE.Group(); if (lot.s >= 4) sf.position.y = 0.25; buildStreetFront(sf, lot.c, lot.c2, lot.s, mats); lotG.add(sf); }
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
      // (It hugs the building itself, so it never reaches out over the street.)
      const sc = mats.c("#ff9a3b", 0.5, 0.3), plank = mats.c("#c8a070");
      const bb = bodyBox;
      const wx = bb.isEmpty() ? 1.2 : Math.min(2.05, Math.max(0.8, Math.max(-bb.min.x, bb.max.x) + 0.15));
      const wz = bb.isEmpty() ? 1.2 : Math.min(2.05, Math.max(0.8, Math.max(-bb.min.z, bb.max.z) + 0.15));
      const h = Math.min(Math.max(1.2, (bb.isEmpty() ? 1.6 : bb.max.y) + 0.15), 4);
      // A light frame: four corner poles, a rail round the top and one half way up, and a
      // plank to stand on (so it reads as building work, not a cage).
      for (const [px, pz] of [[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz]]) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06).translate(px, h / 2, pz), sc));
      for (const y of [h * 0.5, h]) for (const sd of [-1, 1]) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(wx * 2, 0.05, 0.05).translate(0, y, sd * wz), sc));
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, wz * 2).translate(sd * wx, y, 0), sc));
      }
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(wx * 2, 0.04, 0.3).translate(0, h * 0.5 - 0.03, -wz + 0.15), plank));
      const arrow = new THREE.Group();
      const am = mats.sign("#b48cff");
      arrow.add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 4).translate(0, 0.6, 0), am));
      arrow.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3).translate(0, 0.08, 0), am));
      arrow.position.set(x, tops[i] + 1.2, z);
      arrow.userData.dynamic = true;
      arrows.push(arrow);
      g.add(arrow);
    }
    mergeStatic(lotG, 0.05);
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
  const carPath = new Path(loop(0.6)), walkPath = new Path(loop(ROAD + 0.35));
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
    if (cellIn(i, j - 1) && cellIn(i, j) && !joined(i, j - 1, i, j)) out.push([1, 0]);
    if (cellIn(i - 1, j - 1) && cellIn(i - 1, j) && !joined(i - 1, j - 1, i - 1, j)) out.push([-1, 0]);
    if (cellIn(i - 1, j) && cellIn(i, j) && !joined(i - 1, j, i, j)) out.push([0, 1]);
    if (cellIn(i - 1, j - 1) && cellIn(i, j - 1) && !joined(i - 1, j - 1, i, j - 1)) out.push([0, -1]);
    return out;
  };
  const isRound = (i: number, j: number) => cellIn(i - 1, j - 1) && cellIn(i, j - 1) && cellIn(i - 1, j) && cellIn(i, j) && exits(i, j).length === 4;
  const LANE = 0.6, END = ROAD + 0.25;
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
  const FOOT = ROAD + 0.32;
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
  const landmarks: Record<number, () => { x: number; z: number; zoom?: number }> = {};
  const outward = (u: number, out: THREE.Vector3, d: THREE.Vector3) => {
    carPath.at(u, out, d);
    const nx = d.z, nz = -d.x, sgn = (out.x - cx) * nx + (out.z - cz) * nz > 0 ? 1 : -1;
    return { nx: nx * sgn, nz: nz * sgn };
  };
  if (rank >= 1) {
    // Village: a street market round the plaza, striped stalls with fruit and flowers.
    const stripes = [["#ff5f6d", "#ffffff"], ["#2f9bff", "#ffffff"], ["#5ec26a", "#fff4c2"], ["#ffb13b", "#ffffff"]];
    [1.25, 3.55, 4.95, 0.95 + Math.PI].slice(0, 4).forEach((a, k) => {
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
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + Math.PI / 8 + (k / 4) * Math.PI * 2; add(new THREE.CylinderGeometry(0.03, 0.035, 1.45, 6).translate(pz.x + Math.cos(a) * 2.2, 0.95, pz.z + Math.sin(a) * 2.2), metal); }
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

  // ---- Districts (data/land.ts): whole islands of their own, as big as the town's core ----
  // On sale: the district's island floats beside the town, its streets laid out and its lots
  // empty, a glowing outline and a ghost of the bridge. Bought: a bridge joins it to the town
  // and the whole district is built: its own houses, shops and a landmark of its own.
  const landShown: ({ x: number; z: number; y: number } | null)[] = LAND.map(() => null);
  const townC = (() => { const h = islandOutline(ISLAND_PAD, true); return { x: h.reduce((a, p) => a + p[0], 0) / h.length, z: h.reduce((a, p) => a + p[1], 0) / h.length }; })();
  (cafe.land ?? []).forEach(({ id, bought, sale }) => {
    const k = LAND.findIndex(l => l.id === id);
    if (k < 0 || (!bought && !sale)) return;
    const sp = landSpot(k, bought), theme = LAND[k].theme;
    landShown[k] = { x: sp.x, z: sp.z, y: sp.y };
    // The way back: toward the island before it (the first one, toward the town).
    const prev = k > 0 ? landSpot(k - 1, true) : { x: townC.x, z: townC.z, y: 0, r: 0 };
    const dl = Math.hypot(sp.x - prev.x, sp.z - prev.z) || 1, ux = (sp.x - prev.x) / dl, uz = (sp.z - prev.z) / dl;
    const G = new THREE.Group();
    G.position.set(sp.x, sp.y + (bought ? 0 : -0.6), sp.z);
    g.add(G);
    const L = (geo: THREE.BufferGeometry, m: THREE.Material) => { const me = new THREE.Mesh(geo, m); G.add(me); return me; };
    // The island: a rounded, slightly uneven square, in the same layers as the town's cliffs.
    const outlineD: [number, number][] = [];
    for (let a = 0; a < 64; a++) {
      const an = (a / 64) * Math.PI * 2, c2 = Math.cos(an), s2 = Math.sin(an);
      const sq = DIST_H / Math.pow(Math.pow(Math.abs(c2), 4) + Math.pow(Math.abs(s2), 4), 0.25);
      const rr = sq * (1 + 0.035 * Math.sin(an * 5 + k * 1.7) + 0.02 * Math.sin(an * 11 + k));
      outlineD.push([c2 * rr, s2 * rr]);
    }
    const layer = (scale: number, depth: number, top: number, m: THREE.Material) => {
      const sh = new THREE.Shape(outlineD.map(([x, z]) => new THREE.Vector2(x * scale, -z * scale)));
      L(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, top - depth, 0), m);
    };
    // Each level up has its own ground: grass, then white marble above the clouds, lilac
    // crystal ground, and a metal deck at the edge of space.
    const TH = {
      cloud: { top: "#f6f2fb", lip: "#e2dcef", l1: "#fff6dc", l2: "#e8e2f4", l3: "#d8d0ea", road: "#e6d7ae", walk: "#fffaf0", curbC: "#ffd86a" },
      crystal: { top: "#c9b6f2", lip: "#a58ee0", l1: "#7a5ec8", l2: "#5a3fa8", l3: "#3f2a80", road: "#3a2f66", walk: "#e8e0ff", curbC: "#8af0ff" },
      orbit: { top: "#9aa3bc", lip: "#6a7290", l1: "#4a5070", l2: "#3a3f5a", l3: "#2a2f45", road: "#262a3a", walk: "#c8d0e4", curbC: "#5ae0ff" },
    } as const;
    const m2 = (c: string, r: number, m: number) => mats.c(c, r, m);
    const tc = theme === "cloud" || theme === "crystal" || theme === "orbit" ? TH[theme] : null;
    const topM = tc ? own(std(tc.top, { roughness: theme === "orbit" ? 0.5 : 0.85, metalness: theme === "orbit" ? 0.4 : 0 })) : verge;
    const roadD = tc ? own(std(tc.road, { roughness: 0.7, metalness: theme === "orbit" ? 0.3 : 0 })) : road;
    const walkD = tc ? own(std(tc.walk, { roughness: 0.7 })) : walk;
    const curbD = tc ? own(std(tc.curbC, { roughness: 0.5, metalness: theme === "cloud" ? 0.6 : 0.2, emissive: new THREE.Color(theme === "cloud" ? "#000000" : tc.curbC), emissiveIntensity: theme === "cloud" ? 0 : 0.35 })) : curb;
    layer(1, 0.12, 0, topM);
    layer(1.006, 0.06, -0.02, tc ? own(std(tc.lip, { roughness: 0.8 })) : own(std(new THREE.Color(st.lawn).multiplyScalar(0.8), { roughness: 0.95 })));
    layer(0.995, 0.12, -0.12, tc ? own(std(tc.l1, { roughness: 0.8 })) : own(std("#5a3f2a", { roughness: 1 })));
    layer(0.99, 0.5, -0.24, tc ? own(std(tc.l1, { roughness: 0.8 })) : earth);
    layer(0.95, 1.2, -0.74, tc ? own(std(tc.l2, { roughness: 0.9, flatShading: true })) : rock);
    layer(0.82, 2.0, -1.94, tc ? own(std(tc.l3, { roughness: 0.9, flatShading: true })) : rockDark);
    layer(0.6, 2.6, -3.94, tc ? own(std(tc.l2, { roughness: 0.9, flatShading: true })) : rock);
    L(new THREE.ConeGeometry(DIST_H * 0.45, DIST_H * 0.9, 9).rotateX(Math.PI).translate(0, -6.5 - DIST_H * 0.45, 0), tc ? own(std(tc.l3, { roughness: 0.9, flatShading: true })) : rockDark);
    if (theme === "cloud") {
      // A bank of soft clouds the island floats on.
      const cloudM = own(std("#ffffff", { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.15 }));
      for (let c5 = 0; c5 < 26; c5++) { const an = (c5 / 26) * Math.PI * 2, rr = DIST_H * (0.75 + (c5 % 3) * 0.12); L(new THREE.SphereGeometry(2.2 + (c5 % 4) * 0.7, 10, 8).scale(1.4, 0.6, 1.4).translate(Math.cos(an) * rr, -1.6 - (c5 % 2), Math.sin(an) * rr), cloudM); }
    } else if (theme === "crystal") {
      // Crystals growing out of the underside.
      const glowC = own(std("#9a7aff", { roughness: 0.2, metalness: 0.1, emissive: 0x7a5aff, emissiveIntensity: 0.6, flatShading: true }));
      for (let c5 = 0; c5 < 18; c5++) { const an = (c5 / 18) * Math.PI * 2, rr = DIST_H * (0.35 + (c5 % 3) * 0.18), hh = 2.5 + (c5 % 4) * 1.5; L(new THREE.OctahedronGeometry(0.8, 0).scale(0.6, hh, 0.6).translate(Math.cos(an) * rr, -2 - hh * 0.7, Math.sin(an) * rr), glowC); }
    } else if (theme === "orbit") {
      // A glowing ring round the station, and engines underneath.
      const ringM = own(std("#5ae0ff", { roughness: 0.3, emissive: 0x5ae0ff, emissiveIntensity: 0.9 }));
      L(new THREE.TorusGeometry(DIST_H * 1.18, 0.25, 6, 64).rotateX(Math.PI / 2).translate(0, -0.5, 0), ringM);
      for (let c5 = 0; c5 < 4; c5++) { const an = (c5 / 4) * Math.PI * 2 + 0.4; L(new THREE.CylinderGeometry(1.2, 0.8, 3, 12).translate(Math.cos(an) * DIST_H * 0.45, -5.5, Math.sin(an) * DIST_H * 0.45), ringM); }
    }
    // Its streets: a grid of blocks with the town's own cozy streets, corner plazas and
    // cobbled crossings.
    const cellC = (i: number, j: number) => ({ x: (i - (DIST_N - 1) / 2) * C, z: (j - (DIST_N - 1) / 2) * C });
    const qd = C / 2;
    for (let i = 0; i < DIST_N; i++) for (let j = 0; j < DIST_N; j++) {
      const { x, z } = cellC(i, j);
      L(new THREE.BoxGeometry(C, 0.1, C).translate(x, 0, z), roadD);
      L(roundSlab(C - ROAD * 2, C - ROAD * 2, 1.7, 0.18).translate(x, 0, z), curbD);
      L(roundSlab(C - ROAD * 2 - 0.16, C - ROAD * 2 - 0.16, 1.6, 0.2).translate(x, 0, z), walkD);
      // Lamps on two corners.
      for (const [a2, b2] of [[1, 1], [-1, -1]]) {
        const e = C / 2 - ROAD - 0.73;
        L(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(x + a2 * e, 0.9, z + b2 * e), metal);
        L(new THREE.SphereGeometry(0.12, 8, 6).translate(x + a2 * e, 1.65, z + b2 * e), lampMat);
      }
      // The same road markings on the streets between blocks.
      if (i + 1 < DIST_N) markStreet(L, x + qd, z, "z", C - 0.6);
      if (j + 1 < DIST_N) markStreet(L, x, z + qd, "x", C - 0.6);
    }
    // A low railing round the edge.
    for (let a = 0; a < outlineD.length; a += 2) {
      const [px, pz] = outlineD[a], kk = 0.96;
      L(new THREE.BoxGeometry(0.12, 0.42, 0.12).translate(px * kk, 0.21, pz * kk), stone);
    }
    // The bridge: from this island's coast back to the island before it (or the town's
    // coast), sloping up as the islands climb. Wood on stone piers down low; marble and gold,
    // glowing crystal or a lit metal tube higher up (a see-through ghost while for sale).
    {
      const sx0 = sp.x - ux * distEdge(ux, uz) * 0.97, sz0 = sp.z - uz * distEdge(ux, uz) * 0.97;
      let ex: number, ez: number;
      if (k > 0) { ex = prev.x + ux * distEdge(ux, uz) * 0.97; ez = prev.z + uz * distEdge(ux, uz) * 0.97; }
      else {
        const th2 = islandOutline(ISLAND_PAD, true);
        let t2 = 0;
        while (t2 < 60 && !insidePoly(th2, sx0 - ux * t2, sz0 - uz * t2, 0.6)) t2 += 0.25;
        ex = sx0 - ux * (t2 + 0.6); ez = sz0 - uz * (t2 + 0.6);
      }
      const y0 = sp.y + (bought ? 0 : -0.6), y1 = prev.y, run = Math.hypot(sx0 - ex, sz0 - ez), rise = y0 - y1, len = Math.hypot(run, rise);
      const bridge = new THREE.Group();
      const B = (geo: THREE.BufferGeometry, mat: THREE.Material) => { bridge.add(new THREE.Mesh(geo, mat)); };
      if (!bought) {
        // For sale: a see-through ghost of the bridge to come.
        B(new THREE.BoxGeometry(2.6, 0.16, len).translate(0, 0.06, 0), own(new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.35, depthWrite: false })));
      } else {
        // A suspension bridge in the island's style: a deck with a paved road and walkways,
        // side girders, two towers with lights on top, main cables sagging between them and
        // down to the ends, and hangers holding up the deck.
        const style = {
          harbor: { deck: "#b07a4a", girder: "#f4f2fa", tower: "#ffffff", cable: "#e2453c" },
          garden: { deck: "#c8b08a", girder: "#4f9a5a", tower: "#f4fff0", cable: "#3fae5a" },
          downtown: { deck: "#6e6761", girder: "#c8463a", tower: "#c8463a", cable: "#c8463a" },
          cloud: { deck: "#fffaf0", girder: "#ffd86a", tower: "#fbf8ff", cable: "#e8b020" },
          crystal: { deck: "#3a2f66", girder: "#8af0ff", tower: "#b9a0ff", cable: "#8af0ff" },
          orbit: { deck: "#4a5070", girder: "#5ae0ff", tower: "#c8d0e4", cable: "#5ae0ff" },
        }[theme];
        const glow = theme === "crystal" || theme === "orbit";
        const deckM = mats.c(style.deck, 0.8, theme === "orbit" ? 0.4 : 0), girderM = glow ? own(std(style.girder, { roughness: 0.3, emissive: new THREE.Color(style.girder), emissiveIntensity: 0.5 })) : mats.c(style.girder, 0.5, 0.2);
        const towerM = mats.c(style.tower, 0.5, theme === "orbit" ? 0.5 : 0.1), cableM = glow ? girderM : mats.c(style.cable, 0.4, 0.3);
        const W = 2.8, roadM = theme === "harbor" || theme === "garden" ? deckM : mats.c(theme === "downtown" ? "#4a4f66" : style.deck, 0.8);
        B(new THREE.BoxGeometry(W, 0.22, len).translate(0, 0, 0), deckM);
        B(new THREE.BoxGeometry(1.7, 0.03, len).translate(0, 0.125, 0), roadM);
        if (theme === "harbor" || theme === "garden") for (let p2 = 0; p2 < Math.floor(len / 0.5); p2++) B(new THREE.BoxGeometry(W - 0.1, 0.02, 0.06).translate(0, 0.12, -len / 2 + 0.25 + p2 * 0.5), mats.c("#8a5a3a", 0.9));
        for (const sx of [-1, 1]) {
          B(new THREE.BoxGeometry(0.16, 0.42, len).translate(sx * (W / 2 + 0.05), -0.08, 0), girderM);
          B(new THREE.BoxGeometry(0.06, 0.06, len).translate(sx * (W / 2 - 0.05), 0.55, 0), girderM);
          const posts = Math.max(6, Math.round(len / 0.8));
          for (let b = 0; b <= posts; b++) B(new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(sx * (W / 2 - 0.05), 0.33, -len / 2 + (b * len) / posts), girderM);
        }
        // The two towers, a fifth of the way in from each end.
        const TH = 3.4, tz = [-len * 0.3, len * 0.3];
        for (const z of tz) {
          for (const sx of [-1, 1]) B(new THREE.BoxGeometry(0.28, TH, 0.36).translate(sx * (W / 2 + 0.12), TH / 2 - 0.1, z), towerM);
          B(new THREE.BoxGeometry(W + 0.5, 0.26, 0.3).translate(0, TH - 0.4, z), towerM);
          B(new THREE.BoxGeometry(W + 0.5, 0.18, 0.3).translate(0, TH * 0.55, z), towerM);
          for (const sx of [-1, 1]) B(new THREE.SphereGeometry(0.13, 8, 6).translate(sx * (W / 2 + 0.12), TH, z), lampMat);
        }
        // Main cables: a sag between the towers and down to each end; hangers to the deck.
        const cable = (z0: number, z1: number, y0c: number, y1c: number, sag: number, sx: number) => {
          const n = 12;
          for (let q2 = 0; q2 < n; q2++) {
            const ta = q2 / n, tb = (q2 + 1) / n;
            const ya = y0c + (y1c - y0c) * ta - sag * 4 * ta * (1 - ta), yb = y0c + (y1c - y0c) * tb - sag * 4 * tb * (1 - tb);
            const za = z0 + (z1 - z0) * ta, zb = z0 + (z1 - z0) * tb, sl = Math.hypot(zb - za, yb - ya);
            B(new THREE.CylinderGeometry(0.04, 0.04, sl, 5).rotateX(Math.PI / 2 - Math.atan2(yb - ya, zb - za)).translate(sx * (W / 2 + 0.12), (ya + yb) / 2, (za + zb) / 2), cableM);
            if (q2 > 0) B(new THREE.CylinderGeometry(0.015, 0.015, Math.max(0.05, ya - 0.5), 4).translate(sx * (W / 2 + 0.12), (ya + 0.5) / 2, za), cableM);
          }
        };
        for (const sx of [-1, 1]) {
          cable(tz[0], tz[1], TH, TH, TH - 1.0, sx);
          cable(-len / 2, tz[0], 0.6, TH, -0.3, sx);
          cable(tz[1], len / 2, TH, 0.6, -0.3, sx);
        }
        if (theme === "orbit") B(new THREE.CylinderGeometry(1.7, 1.7, len, 16, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.15, 0), own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })));
        // Down low the bridge also stands on two stone piers.
        if (k === 0) for (const z of tz) B(new THREE.CylinderGeometry(0.6, 0.9, 5, 8).translate(0, -2.6, z), rock);
        // Lights along the underside of the sky bridges.
        if (k > 0) for (let q2 = 0; q2 < 8; q2++) B(new THREE.SphereGeometry(0.09, 6, 4).translate(0, -0.15, -len / 2 + (q2 + 0.5) * (len / 8)), lampMat);
      }
      // Streets at both ends: the bridge leads road to road. On this island the street runs
      // in from the coast to its street grid (below, with the arch); at the other end it runs
      // in to the island before's grid, or through the countryside to the town's streets.
      if (bought) {
        if (k === 0 && link) streetStrip(g, link.ax, link.az, link.bx, link.bz, 0.0, road, walk, curb);
        else if (k > 0) {
          const pt = LAND[k - 1].theme, pc2 = pt === "cloud" ? ["#e6d7ae", "#fffaf0", "#ffd86a"] : pt === "crystal" ? ["#3a2f66", "#e8e0ff", "#8af0ff"] : pt === "orbit" ? ["#262a3a", "#c8d0e4", "#5ae0ff"] : null;
          const inner = distEdge(ux, uz) - 2 * C + 0.2;
          streetStrip(g, ex - ux * 0.3, ez - uz * 0.3, ex - ux * inner, ez - uz * inner, prev.y, pc2 ? mats.c(pc2[0], 0.7) : road, pc2 ? mats.c(pc2[1], 0.7) : walk, pc2 ? mats.c(pc2[2], 0.5, 0.2) : curb);
        }
      }
      bridge.position.set((sx0 + ex) / 2, (y0 + y1) / 2, (sz0 + ez) / 2);
      bridge.rotation.order = "YXZ";
      bridge.rotation.y = Math.atan2(ux, uz);
      bridge.rotation.x = -Math.atan2(rise, run);
      g.add(bridge);
    }
    // What's built on each block: the district's own theme.
    const blocks = new THREE.Group();
    G.add(blocks);
    const themeOf = (i: number, j: number): string => {
      const key = `${i},${j}`;
      if (id === "meadow") return key === "1,1" ? "marina" : key === "2,2" ? "market" : key === "0,0" ? "lighthouse" : key === "2,1" ? "park" : "home";
      if (id === "lakeside") return key === "1,1" ? "lake" : key === "2,1" ? "wheel" : key === "1,2" || key === "2,2" ? "park" : "home";
      if (id === "hills") return key === "1,1" ? "fountain" : key === "2,2" ? "park" : key === "2,1" ? "plaza" : "tower";
      if (id === "cloud") return key === "1,1" ? "palace" : key === "2,2" ? "skygarden" : "villa";
      if (id === "crystal") return key === "1,1" ? "spire" : "crystal";
      return key === "1,1" ? "rocket" : key === "2,2" ? "dish" : "dome";
    };
    /** A sky island's property at its level, in the island's own style. */
    const skyProp = (G2: THREE.Group, style: string, seed: number, lv: number): number => {
      const Q = (geo: THREE.BufferGeometry, m: THREE.Material) => G2.add(new THREE.Mesh(geo, m));
      Q(roundSlab(4.2, 4.2, 1.6, 0.06), topM);
      if (style === "villa") {
        // White marble with golden domes: a villa, then grander, up to a palace tower.
        const marble = m2("#fbf8ff", 0.5, 0), gold = mats.gold, h = [0, 1.0, 1.8, 2.8, 4.2, 6.5][lv], w = lv >= 4 ? 2.0 : 2.6;
        Q(new THREE.BoxGeometry(w + 0.4, 0.2, w + 0.4).translate(0, 0.1, -0.2), m2("#e8e0d0", 0.6, 0));
        Q(new THREE.BoxGeometry(w, h, w).translate(0, 0.2 + h / 2, -0.2), marble);
        for (const [cx2, cz2] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) Q(new THREE.CylinderGeometry(0.1, 0.12, h, 10).translate(cx2 * (w / 2 + 0.05), 0.2 + h / 2, -0.2 + cz2 * (w / 2 + 0.05)), marble);
        for (let f = 1; f <= Math.max(1, Math.round(h / 0.9)); f++) for (const ox of [-w / 4, w / 4]) Q(new THREE.BoxGeometry(0.32, 0.45, 0.04).translate(ox, 0.2 + f * (h / (Math.round(h / 0.9) + 1)), -0.2 + w / 2 + 0.02), winMat);
        Q(new THREE.SphereGeometry(w * 0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.2 + h, -0.2), gold);
        Q(new THREE.ConeGeometry(0.08, 0.5, 8).translate(0, 0.2 + h + w * 0.42 + 0.2, -0.2), gold);
        Q(new THREE.BoxGeometry(0.5, 0.8, 0.05).translate(0, 0.6, -0.2 + w / 2 + 0.02), gold);
        return 0.2 + h + w * 0.42 + 0.5;
      }
      if (style === "crystal") {
        // A glowing crystal tower, taller with every level, with smaller shards round it.
        const h = [0, 1.6, 3.0, 4.6, 6.6, 9.5][lv], hue = ["#9a7aff", "#7ad0ff", "#ff8ae0", "#8affd0"][seed % 4];
        const cm = own(std(hue, { roughness: 0.15, metalness: 0.2, emissive: new THREE.Color(hue), emissiveIntensity: 0.45, flatShading: true }));
        Q(new THREE.CylinderGeometry(0.75, 0.95, h, 6).translate(0, h / 2 + 0.06, 0), cm);
        Q(new THREE.ConeGeometry(0.75, 1.4, 6).translate(0, h + 0.76, 0), cm);
        for (let c6 = 0; c6 < Math.min(5, lv + 1); c6++) { const an = c6 * 1.3 + seed, hh = 0.6 + (c6 % 3) * 0.5 + lv * 0.25; Q(new THREE.OctahedronGeometry(0.35, 0).scale(1, hh * 1.6, 1).translate(Math.cos(an) * 1.35, hh * 0.55, Math.sin(an) * 1.35), cm); }
        return h + 1.6;
      }
      // A space habitat: glass domes on a metal base, then stacked modules, then a tall
      // tower with a ring and an antenna.
      const metalP = m2("#c8d0e4", 0.35, 0.6), glass = own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 }));
      Q(new THREE.CylinderGeometry(1.6, 1.7, 0.3, 20).translate(0, 0.2, 0), metalP);
      const mods = [0, 0, 1, 2, 4, 7][lv];
      for (let m3 = 0; m3 < mods; m3++) Q(new THREE.CylinderGeometry(1.0 - m3 * 0.05, 1.0 - m3 * 0.05, 0.7, 16).translate(0, 0.7 + m3 * 0.75, 0), m3 % 2 ? metalP : m2("#5ae0ff", 0.3, 0.4));
      const topY = 0.35 + mods * 0.75;
      Q(new THREE.SphereGeometry(lv <= 1 ? 1.3 : 1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, topY, 0), glass);
      Q(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8).translate(0, topY + 0.25, 0), m2("#8af08a", 0.8, 0));
      if (lv >= 4) { Q(new THREE.TorusGeometry(1.4, 0.06, 6, 28).rotateX(Math.PI / 2).translate(0, topY - 0.5, 0), m2("#5ae0ff", 0.3, 0.4)); Q(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6).translate(0, topY + 1.4, 0), metal); }
      return topY + 1.5;
    };
    for (let i = 0; i < DIST_N; i++) for (let j = 0; j < DIST_N; j++) {
      const { x, z } = cellC(i, j), lg = new THREE.Group(), n = 40 + k * 20 + i * DIST_N + j;
      lg.position.set(x, 0.2, z);
      lg.rotation.y = i < j ? Math.PI / 2 : 0;
      blocks.add(lg);
      const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
      const th = themeOf(i, j);
      if (!bought) {
        // For sale: open ground with a tree or two, waiting to be built on.
        P(roundSlab(4.2, 4.2, 1.6, 0.06), tc ? topM : n % 2 ? grass : grass2);
        if (tc) continue;
        if (n % 3 === 0) { P(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6).translate(-1, 0.3, 0.8), trunk); P(new THREE.IcosahedronGeometry(0.5, 0).translate(-1, 0.95, 0.8), leaf); }
        continue;
      }
      if (th === "home" || th === "tower") { const key = `d${k}:${i},${j}`; homeAt(sp.x + x, sp.z + z, propBuilding(lg, n, Math.min(5, propLv(key) + (th === "tower" ? 2 : 0)), key), key, sp.y); continue; }
      if (th === "villa" || th === "crystal" || th === "dome") {
        const key = `d${k}:${i},${j}`, lv = propLv(key);
        const top2 = skyProp(lg, th, n, lv);
        if (landBuiltOnce && (propsSeen[key] ?? 1) < lv) {
          lg.userData.dynamic = true;
          const t0 = performance.now() + 250;
          lg.scale.y = 0.05;
          townTicks.push(() => { const k2 = Math.min(1, Math.max(0, (performance.now() - t0) / 900)); if (k2 >= 1 && lg.scale.y === 1) return; lg.scale.y = k2 < 1 ? Math.max(0.05, 1 - Math.pow(1 - k2, 3) + Math.sin(k2 * Math.PI) * 0.12) : 1; g.userData.moving = k2 < 1; });
        }
        propsSeen[key] = lv;
        homeAt(sp.x + x, sp.z + z, top2, key, sp.y);
        continue;
      }
      if (tc) {
        // The sky islands' centerpieces.
        const Q = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
        Q(roundSlab(4.2, 4.2, 1.6, 0.06), topM);
        if (th === "palace") {
          const marble = m2("#fbf8ff", 0.5, 0);
          Q(new THREE.BoxGeometry(3.4, 0.3, 3.4).translate(0, 0.15, 0), m2("#e8e0d0", 0.6, 0));
          Q(new THREE.BoxGeometry(2.8, 2.6, 2.8).translate(0, 1.6, 0), marble);
          for (const [cx2, cz2] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { Q(new THREE.CylinderGeometry(0.35, 0.38, 4.2, 12).translate(cx2 * 1.4, 2.4, cz2 * 1.4), marble); Q(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx2 * 1.4, 4.5, cz2 * 1.4), mats.gold); }
          Q(new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 2.9, 0), mats.gold);
          Q(new THREE.ConeGeometry(0.15, 1.2, 8).translate(0, 4.7, 0), mats.gold);
          for (let f = 0; f < 3; f++) Q(new THREE.BoxGeometry(0.4, 0.8, 0.04).translate(-0.8 + f * 0.8, 1.6, 1.42), winMat);
        } else if (th === "skygarden") {
          P(ribbon(sPath(1.9, true), 0.55, 0.075), m2("#ffd86a", 0.5, 0.4));
          for (const [tx, tz] of [[-1.3, -1.2], [1.3, 1.0], [-1.4, 1.4], [1.2, -1.5]]) { Q(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6).translate(tx, 0.3, tz), trunk); Q(new THREE.IcosahedronGeometry(0.5, 0).translate(tx, 0.95, tz), m2("#ffb8e0", 0.8, 0)); }
          Q(new THREE.CylinderGeometry(0.8, 0.85, 0.3, 20).translate(0, 0.2, 0), m2("#fbf8ff", 0.5, 0));
          Q(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20).translate(0, 0.36, 0), water);
        } else if (th === "spire") {
          const cm = own(std("#c8a8ff", { roughness: 0.1, metalness: 0.2, emissive: 0xa07aff, emissiveIntensity: 0.8, flatShading: true }));
          cm.userData.dynamic = true;
          Q(new THREE.CylinderGeometry(1.2, 1.6, 9, 6).translate(0, 4.5, 0), cm);
          Q(new THREE.ConeGeometry(1.2, 3, 6).translate(0, 10.5, 0), cm);
          for (let c6 = 0; c6 < 6; c6++) { const an = c6 * (Math.PI / 3); Q(new THREE.OctahedronGeometry(0.5, 0).scale(1, 3, 1).translate(Math.cos(an) * 1.8, 1.4, Math.sin(an) * 1.8), cm); }
          townTicks.push(t => { cm.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.3; });
        } else if (th === "rocket") {
          const metalP = m2("#c8d0e4", 0.35, 0.6);
          Q(new THREE.CylinderGeometry(1.8, 1.9, 0.3, 24).translate(0, 0.2, 0), m2("#3a3f5a", 0.5, 0.5));
          for (const [tx, tz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) Q(new THREE.BoxGeometry(0.15, 5, 0.15).translate(tx, 2.7, tz), metalP);
          Q(new THREE.CylinderGeometry(0.55, 0.55, 4.5, 16).translate(0, 2.8, 0), m2("#ffffff", 0.3, 0.2));
          Q(new THREE.ConeGeometry(0.55, 1.4, 16).translate(0, 5.75, 0), m2("#ff5f6d", 0.4, 0.2));
          for (let f = 0; f < 4; f++) Q(new THREE.BoxGeometry(0.06, 1.0, 0.6).translate(0, 0, 0.55).rotateY((f / 4) * Math.PI * 2).translate(0, 1.0, 0), m2("#ff5f6d", 0.4, 0.2));
          Q(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 12).rotateX(Math.PI / 2).translate(0, 4.2, 0.56), winMat);
        } else if (th === "dish") {
          const metalP = m2("#e8ecf4", 0.3, 0.5);
          Q(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 10).translate(0, 0.9, 0), metalP);
          Q(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI * 0.75).translate(0, 2.1, 0), metalP);
          Q(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6).rotateX(-Math.PI / 4).translate(0, 2.6, 0.4), metal);
          for (const [tx, tz] of [[-1.4, 1.2], [1.4, 1.2]]) Q(new THREE.BoxGeometry(1.0, 0.04, 0.6).rotateX(-0.5).translate(tx, 0.6, tz), m2("#2a3f8a", 0.2, 0.6));
        }
        continue;
      }
      P(roundSlab(4.2, 4.2, 1.6, 0.06), n % 2 ? grass : grass2);
      const tr2 = (tx: number, tz: number, ts = 1) => { P(new THREE.CylinderGeometry(0.06 * ts, 0.1 * ts, 0.6 * ts, 6).translate(tx, 0.3 * ts, tz), trunk); P(new THREE.IcosahedronGeometry(0.5 * ts, 0).translate(tx, 0.95 * ts, tz), leaf); };
      if (th === "park") {
        P(ribbon(sPath(1.9, n % 2 === 1), 0.55, 0.075), pave);
        tr2(-1.3, -1.2); tr2(1.3, 1.0, 0.9); tr2(-1.4, 1.4, 0.8); tr2(1.2, -1.5, 0.7);
        for (let f = 0; f < 6; f++) P(new THREE.SphereGeometry(0.08, 6, 4).translate(0.3 + f * 0.2, 0.12, 1.65), mats.c(flowersOn[(f + n) % 4], 0.8));
      } else if (th === "marina" || th === "lake") {
        // Water in a stone basin, a pier, boats.
        P(roundSlab(3.8, 3.8, 1.2, 0.05).translate(0, 0.02, 0), water);
        P(new THREE.TorusGeometry(1.95, 0.08, 4, 40).rotateX(Math.PI / 2).scale(1, 1, 1).translate(0, 0.1, 0), stone);
        P(new THREE.BoxGeometry(0.45, 0.06, 1.8).translate(0, 0.12, 1.0), wood);
        for (let b = 0; b < (th === "marina" ? 3 : 2); b++) {
          const bx = -1.1 + b * 1.1, bz = -0.7 + (b % 2) * 0.4;
          P(new THREE.BoxGeometry(0.32, 0.12, 0.7).translate(bx, 0.12, bz), mats.c(["#ffffff", "#ff8a5c", "#4f8bff"][b], 0.6));
          if (th === "marina") { P(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).translate(bx, 0.55, bz), metal); P(new THREE.ConeGeometry(0.22, 0.6, 3).translate(bx + 0.08, 0.6, bz), mats.c("#ffffff", 0.7)); }
        }
        if (th === "lake") tr2(1.6, 1.6, 0.8);
      } else if (th === "market") {
        // The fish market: striped stalls with the day's catch.
        for (let b = 0; b < 3; b++) {
          const bx = -1.2 + b * 1.2;
          P(new THREE.BoxGeometry(0.8, 0.35, 0.5).translate(bx, 0.17, 0.6), mats.c("#b07a4a", 0.8));
          for (let f = 0; f < 3; f++) P(new THREE.SphereGeometry(0.08, 6, 4).scale(1.6, 0.6, 0.8).translate(bx - 0.22 + f * 0.22, 0.4, 0.6), mats.c(["#a8c4d8", "#ff8a7a", "#c8d4e0"][f], 0.4, 0.3));
          for (const px of [-0.38, 0.38]) P(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).translate(bx + px, 0.45, 0.4), metal);
          for (let w2 = 0; w2 < 5; w2++) P(new THREE.BoxGeometry(0.17, 0.03, 0.6).rotateX(0.3).translate(bx - 0.34 + w2 * 0.17, 0.92, 0.5), mats.c(w2 % 2 ? "#ffffff" : "#2f9bff", 0.6));
        }
        for (let c3 = 0; c3 < 4; c3++) P(new THREE.BoxGeometry(0.3, 0.2, 0.3).translate(-1.4 + c3 * 0.4, 0.1, -0.8), mats.c("#c89a5a", 0.8));
        tr2(1.5, -1.4, 0.7);
      } else if (th === "lighthouse") {
        for (let r = 0; r < 6; r++) P(new THREE.CylinderGeometry(0.5 - r * 0.04, 0.54 - r * 0.04, 0.6, 14).translate(0, 0.3 + r * 0.6, -0.3), mats.c(r % 2 ? "#ffffff" : "#e2453c", 0.6));
        P(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 12).translate(0, 3.85, -0.3), lampMat);
        P(new THREE.ConeGeometry(0.42, 0.45, 12).translate(0, 4.3, -0.3), mats.c("#e2453c", 0.6));
        P(new THREE.BoxGeometry(1.0, 0.6, 0.8).translate(1.1, 0.3, 0.6), mats.c("#fff4e0", 0.8));
        P(new THREE.ConeGeometry(0.72, 0.4, 4).rotateY(Math.PI / 4).translate(1.1, 0.8, 0.6), mats.c("#3f6fd0", 0.7));
      } else if (th === "wheel") {
        const wheel = new THREE.Group();
        wheel.position.set(0, 1.85, -0.3);
        const rim2 = mats.c("#ffffff", 0.5, 0.2);
        wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 36), rim2));
        const cabs: THREE.Mesh[] = [];
        for (let sp2 = 0; sp2 < 10; sp2++) {
          const a = (sp2 / 10) * Math.PI * 2;
          wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.04).translate(0, 0.75, 0).rotateZ(a), rim2));
          const cab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.24), mats.c(["#ff4f6d", "#ffd23a", "#4f8bff", "#5ee0a0"][sp2 % 4], 0.5));
          cab.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
          wheel.add(cab); cabs.push(cab);
        }
        const face = Math.PI / 4 - lg.rotation.y;
        const holder = new THREE.Group(); holder.rotation.y = face; holder.add(wheel); lg.add(holder);
        for (const sx of [-0.5, 0.5]) for (const sz of [-0.18, 0.18]) holder.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.07).rotateZ(sx * 0.5).translate(sx * 0.5, 0.95, sz - 0.3), metal));
        holder.userData.dynamic = true; wheel.userData.dynamic = true;
        townTicks.push(t => { wheel.rotation.z = t * 0.22; for (const c4 of cabs) c4.rotation.z = -t * 0.22; });
      } else if (th === "fountain") {
        P(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 28).translate(0, 0.06, 0), pave);
        P(new THREE.CylinderGeometry(1.0, 1.05, 0.3, 24).translate(0, 0.2, 0), stone);
        P(new THREE.CylinderGeometry(0.92, 0.92, 0.05, 24).translate(0, 0.33, 0), water);
        P(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 10).translate(0, 0.6, 0), stone);
        P(new THREE.SphereGeometry(0.22, 10, 6).translate(0, 1.1, 0), water);
        for (const [tx, tz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) tr2(tx, tz, 0.7);
      }
    }
    // The rim between the streets and the coast, in the district's own style, and the way in
    // from the bridge: a paved path under a welcome arch with the district's name.
    {
      const rim = new THREE.Group();
      const R0 = 2 * C + 0.35, inD = (x: number, z: number, m: number) => insidePoly(outlineD, x, z, m);
      const landing = new THREE.Vector2(-ux, -uz), along = (x: number, z: number) => Math.abs(x * landing.y - z * landing.x);
      const nearPath = (x: number, z: number) => x * landing.x + z * landing.y > 0 && along(x, z) < 2.1;
      const R = (geo: THREE.BufferGeometry, m: THREE.Material) => rim.add(new THREE.Mesh(geo, m));
      let n2 = 0;
      for (let x = -DIST_H; x <= DIST_H; x += 0.9) for (let z = -DIST_H; z <= DIST_H; z += 0.9) {
        const jx = x + Math.sin(n2 * 12.99 + k) * 0.35, jz = z + Math.cos(n2 * 78.2 + k) * 0.35, r = Math.abs(Math.sin(n2 * 3.7 + k));
        n2++;
        if (Math.max(Math.abs(jx), Math.abs(jz)) < R0 || !inD(jx, jz, 0.7) || nearPath(jx, jz)) continue;
        if (id === "meadow") {
          // Harbor: a sandy shore with palms, beach umbrellas and boats pulled up on the sand.
          if (r < 0.12) { R(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 6).translate(jx, 0.6, jz), trunk); for (let f = 0; f < 5; f++) R(new THREE.BoxGeometry(0.7, 0.04, 0.16).translate(0.3, 0, 0).rotateZ(-0.35).rotateY((f / 5) * Math.PI * 2).translate(jx, 1.2, jz), leaf); }
          else if (r < 0.18) { R(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).translate(jx, 0.45, jz), metal); R(new THREE.ConeGeometry(0.45, 0.22, 8).translate(jx, 0.95, jz), mats.c(["#ff5f6d", "#ffd23a", "#2f9bff"][n2 % 3], 0.6)); }
          else if (r < 0.22) R(new THREE.BoxGeometry(0.3, 0.12, 0.7).rotateY(n2).translate(jx, 0.08, jz), mats.c(["#ffffff", "#ff8a5c", "#4f8bff"][n2 % 3], 0.6));
          else if (r < 0.26) R(new THREE.DodecahedronGeometry(0.2, 0).translate(jx, 0.1, jz), stone);
        } else if (id === "lakeside") {
          // Garden Hills: lawns with hedges, flower beds and trees.
          if (r < 0.2) { R(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6).translate(jx, 0.3, jz), trunk); R(new THREE.IcosahedronGeometry(0.5, 0).translate(jx, 0.95, jz), leaf); }
          else if (r < 0.32) R(new THREE.BoxGeometry(0.8, 0.35, 0.3).rotateY(Math.round(n2 % 2) * Math.PI / 2).translate(jx, 0.18, jz), leaf);
          else if (r < 0.42) for (let f = 0; f < 5; f++) R(new THREE.SphereGeometry(0.07, 5, 4).translate(jx + Math.cos(f * 1.3) * 0.18, 0.1, jz + Math.sin(f * 1.3) * 0.18), mats.c(flowersOn[(n2 + f) % 4], 0.8));
        } else if (theme === "cloud") {
          // Cloud Kingdom: puffs of cloud drifting on the marble, golden lamps.
          if (r < 0.1) R(new THREE.SphereGeometry(0.5 + r * 2, 10, 8).scale(1.3, 0.6, 1.3).translate(jx, 0.2, jz), m2("#ffffff", 1, 0));
          else if (r < 0.14) { R(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(jx, 0.7, jz), mats.gold); R(new THREE.SphereGeometry(0.13, 8, 6).translate(jx, 1.45, jz), lampMat); }
        } else if (theme === "crystal") {
          // Crystal Spire: little crystals growing out of the ground.
          if (r < 0.16) R(new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.8 + r * 4, 1).translate(jx, 0.3, jz), own(std(["#9a7aff", "#7ad0ff", "#ff8ae0"][n2 % 3], { roughness: 0.15, emissive: new THREE.Color(["#9a7aff", "#7ad0ff", "#ff8ae0"][n2 % 3]), emissiveIntensity: 0.5, flatShading: true })));
        } else if (theme === "orbit") {
          // Orbit Station: solar panels and antennas.
          if (r < 0.08) R(new THREE.BoxGeometry(0.9, 0.04, 0.6).rotateX(-0.5).translate(jx, 0.35, jz), m2("#2a3f8a", 0.2, 0.6));
          else if (r < 0.11) { R(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5).translate(jx, 0.6, jz), metal); R(new THREE.SphereGeometry(0.08, 6, 4).translate(jx, 1.25, jz), own(new THREE.MeshBasicMaterial({ color: 0xff3a4a }))); }
        } else {
          // Downtown: a paved promenade with planters, benches and lamps.
          if (r < 0.08) { R(new THREE.BoxGeometry(0.45, 0.28, 0.45).translate(jx, 0.18, jz), stone); R(new THREE.IcosahedronGeometry(0.24, 0).translate(jx, 0.45, jz), leaf); }
          else if (r < 0.12) { R(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(jx, 0.7, jz), metal); R(new THREE.SphereGeometry(0.12, 8, 6).translate(jx, 1.45, jz), lampMat); }
        }
      }
      // One continuous ground ring under the rim: sand for the harbor, paving for downtown.
      if (id === "meadow" || id === "hills") {
        const sh = new THREE.Shape(outlineD.map(([x, z]) => new THREE.Vector2(x * 0.965, -z * 0.965)));
        const h0 = R0 - 0.2, hole = new THREE.Path([new THREE.Vector2(-h0, -h0), new THREE.Vector2(-h0, h0), new THREE.Vector2(h0, h0), new THREE.Vector2(h0, -h0)]);
        sh.holes.push(hole);
        R(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, 0.0, 0), id === "meadow" ? sandM : plazaM);
      }
      // The path in from the bridge, and the arch over it.
      const rot = Math.atan2(landing.x, landing.y), coast = distEdge(landing.x, landing.y) * 0.97;
      streetStrip(rim, landing.x * (2 * C - 0.2), landing.y * (2 * C - 0.2), landing.x * coast, landing.y * coast, 0, roadD, walkD, curbD);
      const arch = new THREE.Group();
      const ac = ["#2f9bff", "#ff8a5c", "#8a6cff", "#e8b020", "#b05aff", "#2a8fd0"][k];
      for (const sx of [-1.85, 1.85]) { arch.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3).translate(sx, 1.2, 0), stone)); arch.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42).translate(sx, 2.45, 0), mats.c(ac, 0.5))); }
      arch.add(new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.5, 0.2).translate(0, 2.3, 0), mats.c(ac, 0.5)));
      const sc = document.createElement("canvas"); sc.width = 512; sc.height = 80;
      const cx3 = sc.getContext("2d");
      if (cx3) { cx3.fillStyle = ac; cx3.fillRect(0, 0, 512, 80); cx3.fillStyle = "#ffffff"; cx3.font = "bold 46px Arial Black, sans-serif"; cx3.textAlign = "center"; cx3.textBaseline = "middle"; cx3.fillText(LAND[k].name.toUpperCase(), 256, 42, 490); }
      const tex = new THREE.CanvasTexture(sc); tex.colorSpace = THREE.SRGBColorSpace;
      const signM2 = own(new THREE.MeshBasicMaterial({ map: tex })); signM2.userData.dynamic = true;
      for (const fz of [0.11, -0.11]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.44).translate(0, 2.3, 0), signM2); pl.position.z = fz; if (fz < 0) pl.rotation.y = Math.PI; arch.add(pl); }
      const ad = coast - 1.4;
      arch.position.set(landing.x * ad, 0.02, landing.y * ad);
      arch.rotation.y = rot;
      arch.userData.dynamic = true;
      if (bought) G.add(arch);
      if (bought) G.add(rim);
      if (bought) mergeStatic(rim, 0.0);
    }
    planarUV(blocks, streetUV);
    mergeStatic(blocks, 0.2);
    if (!bought) {
      // For sale: a glowing outline round the island and a gentle bob.
      const glowM = own(new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.85 }));
      glowM.userData.dynamic = true;
      for (let a = 0; a < outlineD.length; a++) { const [px, pz] = outlineD[a], [qx, qz] = outlineD[(a + 1) % outlineD.length]; if (a % 2) continue; L(new THREE.BoxGeometry(0.16, 0.06, Math.hypot(qx - px, qz - pz) * 0.9).rotateY(Math.atan2(qx - px, qz - pz)).translate((px + qx) / 2 * 0.985, 0.16, (pz + qz) / 2 * 0.985), glowM); }
      townTicks.push(t => { glowM.opacity = 0.55 + Math.sin(t * 3 + k) * 0.35; G.position.y = -0.6 + Math.sin(t * 0.4 + k * 2) * 0.05; });
      G.userData.dynamic = true;
    } else if (!landSeen.has(id) && landBuiltOnce) {
      // Just bought: the whole district rises out of its streets, a beat after the camera arrives.
      const t0 = performance.now() + 900;
      blocks.scale.set(1, 0.001, 1);
      blocks.userData.dynamic = true;
      townTicks.push(() => {
        const k2 = Math.min(1, Math.max(0, (performance.now() - t0) / 1600));
        if (k2 >= 1 && blocks.scale.y === 1) return;
        blocks.scale.y = k2 < 1 ? Math.max(0.001, 1 - Math.pow(1 - k2, 3) + Math.sin(k2 * Math.PI) * 0.1) : 1;
        g.userData.moving = k2 < 1;
      });
    }
    // Little floating rocks either side of the bridge.
    for (let r2 = 0; r2 < 3; r2++) {
      const side = r2 % 2 ? 1 : -1, along = distEdge(ux, uz) + DIST_GAP * (0.3 + r2 * 0.25), off = side * (3 + r2 * 1.3);
      const rx = -ux * along + uz * off, rz = -uz * along - ux * off, rr = 0.7 + (r2 % 2) * 0.4, ry = -1.2 - r2 * 0.7;
      const isle = new THREE.Group();
      isle.add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.92, 0.18, 9).translate(0, -0.09, 0), verge));
      isle.add(new THREE.Mesh(new THREE.ConeGeometry(rr * 0.9, rr * 2.2, 7).rotateX(Math.PI).translate(0, -0.18 - rr * 1.1, 0), r2 % 2 ? rock : rockDark));
      if (r2 !== 1) { isle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6).translate(0, 0.25, 0), trunk)); isle.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0).translate(0, 0.62, 0), leaf)); }
      isle.position.set(rx, ry, rz);
      isle.userData.dynamic = true;
      G.add(isle);
      townTicks.push(t => { isle.position.y = ry + Math.sin(t * 0.5 + r2 * 2 + k) * 0.12; });
    }
    if (bought) {
      // Life in the district: cars round its streets (both ways), people on its sidewalks.
      const ring = (r: number) => new Path([new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 0, -r), new THREE.Vector3(r, 0, r), new THREE.Vector3(-r, 0, r)]);
      const roads = [ring(C - LANE), ring(C + LANE), ring(2 * C - LANE)];
      const walks = [ring(C - ROAD - 0.32), ring(C + ROAD + 0.32), ring(2 * C - ROAD - 0.32)];
      const dCars = Array.from({ length: 9 }, (_, n) => {
        const m = new THREE.Mesh(carGeo(BODY[(n * 3 + k) % BODY.length], n % 4 === 2), carM);
        G.add(m);
        return { m, path: roads[n % 3], u: n / 9, sp: (n % 3 === 1 ? -1 : 1) * (0.012 + (n % 4) * 0.002) };
      });
      const dWalk = Array.from({ length: 14 }, (_, n) => {
        const pp = makePerson(shirts[(n + k) % shirts.length]);
        G.add(pp);
        return { p: pp, path: walks[n % 3], u: n / 14, sp: (n % 2 ? 1 : -1) * (0.004 + (n % 4) * 0.001), ph: n * 1.3 };
      });
      const cp = new THREE.Vector3(), cd = new THREE.Vector3();
      let lastT = 0;
      townTicks.push(t => {
        const dt = Math.min(0.1, lastT ? t - lastT : 0.016);
        lastT = t;
        for (const c of dCars) {
          c.u = (c.u + c.sp * dt + 1) % 1;
          c.path.at(c.u, cp, cd);
          // (Cars going the other way round keep to their own side of the street.)
          c.m.position.set(cp.x, 0.04, cp.z);
          c.m.rotation.y = Math.atan2(cd.x, cd.z) + (c.sp < 0 ? Math.PI : 0);
        }
        for (const w of dWalk) {
          w.u = (w.u + w.sp * dt + 1) % 1;
          w.path.at(w.u, cp, cd);
          const sw = Math.sin(t * 9 + w.ph);
          w.p.position.set(cp.x, 0.2 + Math.abs(sw) * 0.04, cp.z);
          w.p.rotation.y = Math.atan2(cd.x, cd.z) + (w.sp < 0 ? Math.PI : 0);
          w.p.rotation.z = sw * 0.08;
        }
      });
    }
    if (bought) {
      // Each district's signature, seen from anywhere: a hot-air balloon drifting over Garden
      // Hills, a supertall with a blinking spire in Downtown, a sailboat round the Harbor.
      if (id === "lakeside") {
        const bal = new THREE.Group();
        const stripes = ["#ff5f6d", "#ffd23a", "#2f9bff", "#5ee0a0"];
        for (let b2 = 0; b2 < 8; b2++) bal.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 10, (b2 / 8) * Math.PI * 2, Math.PI / 4).scale(1, 1.2, 1), mats.c(stripes[b2 % 4], 0.6)));
        bal.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.35, 8).translate(0, -1.75, 0), wood));
        for (const [ox, oz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) bal.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.02).translate(ox * 0.9, -1.35, oz * 0.9), metal));
        bal.userData.dynamic = true;
        G.add(bal);
        townTicks.push(t => { bal.position.set(Math.sin(t * 0.07) * 9, 9 + Math.sin(t * 0.4) * 0.6, Math.cos(t * 0.05) * 7); bal.rotation.y = t * 0.1; });
      } else if (id === "hills") {
        const st2 = new THREE.Group(), hgt = 9.5;
        st2.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6).translate(0, 0.4, 0), mats.c("#e9e4f5", 0.6)));
        st2.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, hgt, 2.0).translate(0, 0.8 + hgt / 2, 0), winMat));
        for (let f = 0; f <= 14; f++) st2.add(new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.06, 2.06).translate(0, 0.8 + (f * hgt) / 14, 0), mats.c("#f4f2fa", 0.5)));
        st2.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4).translate(0, 0.8 + hgt + 0.6, 0), winMat));
        st2.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4).rotateY(Math.PI / 4).translate(0, 0.8 + hgt + 1.9, 0), mats.c("#d6d2e6", 0.4, 0.5)));
        st2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).translate(0, 0.8 + hgt + 3.4, 0), metal));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6).translate(0, 0.8 + hgt + 4.2, 0), own(new THREE.MeshBasicMaterial({ color: 0xff3a4a })));
        tip.userData.dynamic = true; tip.material.userData.dynamic = true;
        st2.add(tip);
        const { x: cx4, z: cz4 } = cellC(2, 1);
        st2.position.set(cx4, 0.2, cz4);
        G.add(st2);
        townTicks.push(t => { tip.visible = Math.sin(t * 3) > 0; });
      } else if (theme === "orbit") {
        // Stars all round, and a satellite on its orbit.
        const starG = new THREE.BufferGeometry(), pts: number[] = [];
        for (let st3 = 0; st3 < 400; st3++) { const a = st3 * 2.399, rr = DIST_H * (1.4 + (st3 % 7) * 0.25), yy = -6 + ((st3 * 37) % 30); pts.push(Math.cos(a) * rr, yy, Math.sin(a) * rr); }
        starG.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const stars = new THREE.Points(starG, own(new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 })));
        stars.userData.dynamic = true;
        G.add(stars);
        const sat = new THREE.Group();
        sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), m2("#e8ecf4", 0.3, 0.6)));
        for (const sd of [-1, 1]) sat.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.7).translate(sd * 1.15, 0, 0), m2("#2a3f8a", 0.2, 0.6)));
        sat.userData.dynamic = true;
        G.add(sat);
        townTicks.push(t => { const a = t * 0.12; sat.position.set(Math.cos(a) * DIST_H * 0.9, 9 + Math.sin(a * 2) * 1.5, Math.sin(a) * DIST_H * 0.9); sat.rotation.y = -a; });
      } else if (theme === "crystal") {
        // Crystals floating in a slow circle over the island.
        const fl: THREE.Mesh[] = [];
        for (let c6 = 0; c6 < 8; c6++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0).scale(1, 1.8, 1), own(std(["#9a7aff", "#7ad0ff", "#ff8ae0"][c6 % 3], { roughness: 0.1, emissive: new THREE.Color(["#9a7aff", "#7ad0ff", "#ff8ae0"][c6 % 3]), emissiveIntensity: 0.7, flatShading: true }))); cr.userData.dynamic = true; G.add(cr); fl.push(cr); }
        townTicks.push(t => fl.forEach((cr, c6) => { const a = t * 0.15 + (c6 / 8) * Math.PI * 2; cr.position.set(Math.cos(a) * DIST_H * 0.75, 7 + Math.sin(t + c6) * 0.6, Math.sin(a) * DIST_H * 0.75); cr.rotation.y = t + c6; }));
      } else {
        // A little airship with the harbor's colors, cruising round the island.
        const ship = new THREE.Group();
        ship.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10).scale(0.55, 0.55, 1.6), mats.c("#ffffff", 0.5)));
        for (const z2 of [-0.6, 0, 0.6]) ship.add(new THREE.Mesh(new THREE.TorusGeometry(0.56 * Math.sqrt(1 - (z2 / 1.6) ** 2), 0.025, 4, 20).translate(0, 0, z2), mats.c("#2f9bff", 0.5)));
        ship.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.6).translate(0, -0.65, 0.1), mats.c("#2f9bff", 0.5)));
        for (const sd of [-1, 1]) ship.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.4).translate(sd * 0.3, 0.05, -1.45), mats.c("#ff5f6d", 0.6)));
        ship.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.4).translate(0, 0.05, -1.45), mats.c("#ff5f6d", 0.6)));
        ship.userData.dynamic = true;
        G.add(ship);
        const R2 = DIST_H * 0.7;
        townTicks.push(t => { const a = t * 0.05; ship.position.set(Math.cos(a) * R2, 8 + Math.sin(t * 0.5) * 0.4, Math.sin(a) * R2); ship.rotation.y = -a; });
      }
      // Vines hanging down the district's cliff.
      for (let a = 0; a < outlineD.length; a += 5) { const [vx, vz] = outlineD[a], len = 0.4 + Math.abs(Math.sin(a * 2.7 + k)) * 0.9; L(new THREE.BoxGeometry(0.08, len, 0.08).translate(vx * 0.99, -len / 2 - 0.02, vz * 0.99), leaf); }
    }
    landSeen.add(id);
    // (The camera looks a little further back for a higher island: that's where it shows.)
    landmarks[100 + k] = () => ({ x: sp.x - sp.y, z: sp.z - sp.y, zoom: 0.8 });
  });

  // (From now on, newly bought land animates in.)
  for (const l of cafe.land ?? []) if (l.bought) landSeen.add(l.id);
  landBuiltOnce = true;
  if (blobGeos.length) { const bg = mergeGeometries(blobGeos); blobGeos.forEach(q => q.dispose()); if (bg) add(bg, blobM); }
  planarUV(g, streetUV);
  mergeStatic(g, 0.0);

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
    top: i => (i === -1 ? plotTop : i <= -10 ? 1.3 : i < -1 ? 1.4 : tops[i] ?? 2),
    resident: () => block.resident(),
    landmark: r => (landmarks[r] ? landmarks[r]() : null),
    spot: id => block.spot(id),
    landAt: k => landShown[k] ?? null,
    homes: () => homeSpots,
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
const outlineCache = new Map<string, [number, number][]>();
/** The island's coast takes in the land the player has bought (set by each town build). */
let landKey = "";
let landPts: [number, number][] = [];
function setLand(bought: number[]): void {
  landKey = bought.join(",");
  landPts = [];
  // (Districts are islands of their own now: the town's coast stays as it is.)
  void bought;
}
/** The outline at `pad` from the town (the coast at ISLAND_PAD takes in bought land unless
 *  `base`). */
function islandOutline(pad = ISLAND_PAD, base = false): [number, number][] {
  const withLand = !base && pad === ISLAND_PAD && landPts.length > 0, key = withLand ? `${pad}|${landKey}` : `${pad}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const r = makeOutline(pad, withLand ? landPts : []);
  outlineCache.set(key, r);
  return r;
}
function makeOutline(pad: number, extra: [number, number][]): [number, number][] {
  const pts: [number, number][] = [...extra];
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

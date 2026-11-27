// Skyhaven Inc.'s business district: a floating island of its own where every business
// stands as a real building on its lot, growing with each stage (a cart, a shop, a store,
// a flagship, then a gold-crowned tower), around a plaza with a fountain and a ring road.
// It's alive: customers stroll the sidewalks and walk into the busiest stores, delivery
// vans drive round, a limousine brings each VIP, a rush hour draws a crowd and a glow, and
// at night the windows, signs and an empire's searchlight come on.
import { BUSINESSES } from "../data/tycoon";
import { districtShop } from "./districtbiz";
import { kitInstancer, kitPlace, kitPlaceH, kitVersion } from "./kitmodels";
import * as THREE from "three";
import { castShadows, lawnTexture, mergeStatic } from "./world";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildBlock, type BizBlock } from "./block";
import { townFx, type TownLook } from "./shaders";
import { buildModelStaged, buildStreetFront, buildTerrace, type ModelMats } from "./bizmodels";
import { LAND, type LandId } from "../data/land";
import { genBuilding, type GenKit } from "./propgen";
import { HAS_CITY } from "../edition";
import { PROP_PEOPLE } from "../data/props";
import { hydrant, mailbox, plazaPiece, roundCenter, seatPiece, type DecoKit } from "./streetdecor";
import { NatureBatch, gardenGeometry, natureMaterial, treeGeo, type TreeKind } from "./trees";
import { buildCityHall } from "./cityhall";
import { buildHouse, houseDesign, type HouseKit } from "./houses";
import { isRushHour, isWeekendNight } from "../data/season";
import { bandstand, blossomArch, blossomTree, festivalUmbrellas, holidayTree, lampLights, nightMarket, pumpkins, snowmen } from "./winter";
import { seasonInfo } from "../data/season";
import { buildPlaced, type PlaceKit } from "./placemodels";

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
  /** A tapped sight's key (a city block, park or landmark): the camera visits it. */
  selSight?: string;
  /** What's being built (a crane stands over each): homes by key, districts by id. */
  building?: { kind: string; id: string }[];
  /** A building that just sold or grew (it bounces), and when. */
  pulse?: string;
  pulseAt?: number;
  /** A business just levelled up (sparkles rise round it), and when; big for a milestone. */
  boost?: string;
  boostAt?: number;
  boostBig?: boolean;
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
  /** A message in a bottle is floating in at the beach (tap it for a gift). */
  bottle?: boolean;
}

/** The district is a little town of city blocks on a grid (streets along the world axes, so
 *  the camera sees two faces of every building). The blocks run in a band toward you: the
 *  first business at the far end, the next ones fanning out, a plaza at the entrance. The
 *  oldest (tallest) buildings stand at the back, so they never hide the newer ones. */
const C = 7.6;
/** Half a street's width (each block's own side of it): streets are 2.4 wide. */
const ROAD = 1.2;
/** Every block's curb corner radius; the sidewalk's is 0.1 less, and a lot's lawn sits an even
 *  band inside that, with its corners rounded to match. */
const BLOCK_R = 0.75;
/** A building lot's ground (lawn or plaza): 4.4 across, rounded to sit evenly inside the sidewalk. */
const LOT_W = 4.4;
const lotSlab = (): THREE.BufferGeometry => roundSlab(LOT_W, LOT_W, BLOCK_R - 0.1 - (C - ROAD * 2 - 0.16 - LOT_W) / 2, 0.06);

/** A flat slab with rounded corners, w by d, h thick, lying on y = 0..h (centered). */
function roundSlab(w: number, d: number, r: number, h: number): THREE.BufferGeometry {
  const x = w / 2, z = d / 2, rr = Math.min(r, x, z);
  const sh = new THREE.Shape();
  // (The straight sides have points along them too, so a slab can be bent to follow a
  // curving street.)
  const line = (ax: number, az: number, bx: number, bz: number) => { for (let i = 1; i <= 8; i++) sh.lineTo(ax + ((bx - ax) * i) / 8, az + ((bz - az) * i) / 8); };
  sh.moveTo(-x + rr, -z);
  line(-x + rr, -z, x - rr, -z); sh.absarc(x - rr, -z + rr, rr, -Math.PI / 2, 0, false);
  line(x, -z + rr, x, z - rr); sh.absarc(x - rr, z - rr, rr, 0, Math.PI / 2, false);
  line(x - rr, z, -x + rr, z); sh.absarc(-x + rr, z - rr, rr, Math.PI / 2, Math.PI, false);
  line(-x, z - rr, -x, -z + rr); sh.absarc(-x + rr, -z + rr, rr, Math.PI, Math.PI * 1.5, false);
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
/** How many businesses stand in the town itself (the rest are the districts'). */
export const CITY_LOTS = CELLS.length;
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
  // (Tight city corners: a block with a curb, not a rounded pill.)
  // (One roundness everywhere, so each lot's lawn sits evenly inside its sidewalk.)
  return BLOCK_R;
};
/** Curving avenues (off): streets could swing in S-curves between crossings, but bent
 *  crosswalks and pinched blocks looked wobbly, so every street is straight. List street
 *  lines here to bring the curves back. */
const CURVE_A = 0.85, CURVE_LINES: number[] = [];
/** Which four-way crossings get a little roundabout (a few, like a real town; the rest are
 *  plain crossroads with traffic lights). The crossing between blocks (ax..ax+1, az..az+1). */
const roundKeep = (ax: number, az: number): boolean => (((ax + 2 * az) % 3) + 3) % 3 === 0;
const ALL_KEYS = new Set(ALL.map(c => `${c[0]},${c[1]}`));
/** How far the middle of one stretch of street bows out (signed; 0 = straight). `vertical`:
 *  the street between columns `line` and `line + 1`, beside block row `seg`. */
function streetBend(vertical: boolean, line: number, seg: number): number {
  if (!CURVE_LINES.includes(line)) return 0;
  const [ax, az, bx, bz] = vertical ? [line, seg, line + 1, seg] : [seg, line, seg, line + 1];
  if (!ALL_KEYS.has(`${ax},${az}`) || !ALL_KEYS.has(`${bx},${bz}`) || joined(ax, az, bx, bz)) return 0;
  return CURVE_A * ((seg + line + (vertical ? 0 : 1)) % 2 ? 1 : -1);
}
/** How far the ground at (x, z) moves to follow the curving streets: all the way on the
 *  street and its sidewalks, fading out toward the middle of the blocks (which stay put). */
function bendD(x: number, z: number): [number, number] {
  const fx = (x + 2 * C) / C, fz = (z + 2 * C) / C;
  const w = (d: number) => (d <= ROAD + 0.4 ? 1 : d >= ROAD + 1.5 ? 0 : 1 - (d - ROAD - 0.4) / 1.1);
  let dx = 0, dz = 0;
  for (const L of CURVE_LINES) {
    const dv = Math.abs(fx - (L + 0.5)) * C;
    if (dv < ROAD + 1.5) { const seg = Math.round(fz), t = fz - seg + 0.5, a = streetBend(true, L, seg); if (a) dx += a * Math.sin(Math.PI * t) * w(dv); }
    const dh = Math.abs(fz - (L + 0.5)) * C;
    if (dh < ROAD + 1.5) { const seg = Math.round(fx), t = fx - seg + 0.5, a = streetBend(false, L, seg); if (a) dz += a * Math.sin(Math.PI * t) * w(dh); }
  }
  return [dx, dz];
}
/** Bends the town to follow the curving streets: curbs, sidewalks and road paint point by
 *  point, everything else (lamps, trees, signs, buildings) moved whole by where it stands. */
function bendTown(root: THREE.Object3D, perVertex: Set<THREE.Material>): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), c = new THREE.Vector3(), c2 = new THREE.Vector3(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
  const meshes: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.dynamic || o.userData.bent)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh) meshes.push(m);
    for (const ch of o.children) visit(ch);
  };
  visit(root);
  const done = new Set<THREE.BufferGeometry>();
  for (const m of meshes) {
    if (!Array.isArray(m.material) && perVertex.has(m.material)) {
      if (done.has(m.geometry)) continue;
      done.add(m.geometry);
      const pos = m.geometry.attributes.position;
      inv.copy(m.matrixWorld).invert();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const [dx, dz] = bendD(v.x, v.z);
        if (!dx && !dz) continue;
        v.x += dx; v.z += dz; v.applyMatrix4(inv);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true; m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox();
      continue;
    }
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld).getCenter(c);
    const [dx, dz] = bendD(c.x, c.z);
    if (!dx && !dz) continue;
    c2.set(c.x + dx, c.y, c.z + dz);
    const par = m.parent!;
    par.worldToLocal(c); par.worldToLocal(c2);
    m.position.add(c2.sub(c));
  }
  root.userData.bent = true;
}
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
  x.fillStyle = "#4f525a"; x.fillRect(0, 0, N, N);
  let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // Worn, patched areas a shade lighter or darker.
  for (let i = 0; i < 9; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)"; const r = 20 + rnd() * 50, ex = rnd() * N, ey = rnd() * N, rr = r * (0.4 + rnd() * 0.6), ra = rnd() * 3; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.ellipse(ex + ox, ey + oy, r, rr, ra, 0, Math.PI * 2); x.fill(); } }
  // Aggregate grain.
  for (let i = 0; i < 5000; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.07})` : `rgba(255,255,255,${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
  // A few thin cracks and a tar-sealed seam.
  x.strokeStyle = "rgba(20,20,26,0.28)"; x.lineWidth = 1;
  for (let i = 0; i < 2; i++) { x.beginPath(); let px = N * 0.3 + rnd() * N * 0.4, py = N * 0.3 + rnd() * N * 0.4; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 24; py += (rnd() - 0.5) * 24; x.lineTo(px, py); } x.stroke(); }
  // Tar-sealed cracks: glossy black squiggles, the way real roads are repaired.
  x.strokeStyle = "rgba(18,18,22,0.22)"; x.lineWidth = 1.6; x.lineCap = "round";
  for (let i = 0; i < 2; i++) { x.beginPath(); let px = 30 + rnd() * (N - 60), py = 30 + rnd() * (N - 60); x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (rnd() - 0.5) * 18; py += 4 + rnd() * 8; x.lineTo(px, py); } x.stroke(); }
  // Patched rectangles where the road was dug up and resurfaced (a fresher, darker square).
  for (let i = 0; i < 2; i++) { const w = 26 + rnd() * 30, h = 18 + rnd() * 22, px = 20 + rnd() * (N - w - 40), py = 20 + rnd() * (N - h - 40); x.fillStyle = "rgba(0,0,0,0.13)"; x.fillRect(px, py, w, h); x.strokeStyle = "rgba(15,15,20,0.35)"; x.lineWidth = 1.4; x.strokeRect(px, py, w, h); }
  // Oil drips and tyre-darkened grain.
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(10,10,14,${0.05 + rnd() * 0.06})`; x.beginPath(); x.ellipse(rnd() * N, rnd() * N, 2 + rnd() * 5, 1.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (asphaltTexture = t);
}
function paverTex(): THREE.CanvasTexture {
  if (paverTexture) return paverTexture;
  // Sidewalk paving: warm stone bricks laid in a herringbone, each brick a slightly
  // different shade with a soft bevel and a speckled face, in sandy grout.
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  x.fillStyle = "#b9ad9c"; x.fillRect(0, 0, N, N);
  let sd = 11;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const TONES = [[226, 218, 204], [214, 204, 188], [232, 225, 212], [205, 194, 178], [220, 208, 190], [238, 231, 219]];
  const u = N / 8, g = 2.2;
  const brick = (bx: number, by: number, w: number, h: number) => {
    const [r0, g0, b0] = TONES[Math.floor(rnd() * TONES.length)], d = Math.floor(rnd() * 10) - 5;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const X = bx + ox + g / 2, Y = by + oy + g / 2, W = w - g, H = h - g;
      if (X > N || Y > N || X + W < 0 || Y + H < 0) continue;
      x.fillStyle = `rgb(${r0 + d},${g0 + d},${b0 + d})`; x.fillRect(X, Y, W, H);
      x.fillStyle = "rgba(255,255,255,0.18)"; x.fillRect(X, Y, W, 1.2); x.fillRect(X, Y, 1.2, H);
      x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(X, Y + H - 1.2, W, 1.2); x.fillRect(X + W - 1.2, Y, 1.2, H);
      for (let k = 0; k < (W * H) / 30; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},${0.04 + rnd() * 0.05})`; x.fillRect(X + rnd() * W, Y + rnd() * H, 1.2, 1.2); }
    }
  };
  // Herringbone: pairs of 2:1 bricks, one lying and one standing, stepping diagonally.
  for (let i = -8; i < 16; i++) for (let j = -8; j < 16; j++) {
    const ox = (i - j) * u, oy = (i + j) * u;
    if (ox > N + 2 * u || oy > N + 2 * u || ox < -3 * u || oy < -3 * u) continue;
    brick(ox, oy, 2 * u, u);
    brick(ox + u, oy + u, u, 2 * u);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (paverTexture = t);
}
/** Squares and lot paving: big granite slabs in staggered rows, each a slightly different
 *  warm grey, with darker joints, a soft bevel, speckles and the odd weathered stain. */
let plazaTexture: THREE.CanvasTexture | null = null;
function plazaTex(): THREE.CanvasTexture {
  if (plazaTexture) return plazaTexture;
  const N = 512, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  x.fillStyle = "#8f8a82"; x.fillRect(0, 0, N, N);
  let sd = 29;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const TONES = [[214, 208, 198], [204, 198, 188], [222, 216, 206], [196, 190, 181], [210, 203, 191], [226, 221, 212]];
  const rows = 4, h = N / rows, g = 3;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? h * 0.75 : 0;
    for (let k = -1; k < 4; k++) {
      const w = N / 3, X = k * w + off, Y = r * h;
      const [r0, g0, b0] = TONES[Math.floor(rnd() * TONES.length)], d = Math.floor(rnd() * 8) - 4;
      for (const ox of [-N, 0, N]) {
        const X0 = X + ox + g / 2, Y0 = Y + g / 2, W = w - g, H = h - g;
        if (X0 > N || X0 + W < 0) continue;
        x.fillStyle = `rgb(${r0 + d},${g0 + d},${b0 + d})`; x.fillRect(X0, Y0, W, H);
        x.fillStyle = "rgba(255,255,255,0.14)"; x.fillRect(X0, Y0, W, 2); x.fillRect(X0, Y0, 2, H);
        x.fillStyle = "rgba(0,0,0,0.10)"; x.fillRect(X0, Y0 + H - 2, W, 2); x.fillRect(X0 + W - 2, Y0, 2, H);
        for (let q = 0; q < (W * H) / 26; q++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "40,36,30" : "255,255,255"},${0.05 + rnd() * 0.07})`; x.fillRect(X0 + rnd() * W, Y0 + rnd() * H, 1.5, 1.5); }
        if (rnd() < 0.25) { const sx = X0 + rnd() * W, sy = Y0 + rnd() * H, rr = 10 + rnd() * 26, gr = x.createRadialGradient(sx, sy, 0, sx, sy, rr); gr.addColorStop(0, "rgba(90,80,64,0.10)"); gr.addColorStop(1, "rgba(90,80,64,0)"); x.fillStyle = gr; x.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (plazaTexture = t);
}
/** Sidewalks: poured concrete in square slabs with sawn joints, a light broom texture and
 *  the odd darker patch, like a real city pavement. */
let concreteTexture: THREE.CanvasTexture | null = null;
function concreteTex(): THREE.CanvasTexture {
  if (concreteTexture) return concreteTexture;
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d")!;
  let sd = 5;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const n = 2, w = N / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 196 + Math.floor(rnd() * 14) - 7;
    x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(i * w, j * w, w, w);
    // Broom marks across each slab.
    for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "60,56,50" : "255,255,255"},${0.03 + rnd() * 0.04})`; x.fillRect(i * w + 2, j * w + rnd() * w, w - 4, 1); }
    for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "50,46,40" : "255,255,255"},${0.05 + rnd() * 0.06})`; x.fillRect(i * w + rnd() * w, j * w + rnd() * w, 1.3, 1.3); }
    if (rnd() < 0.5) { const sx = i * w + rnd() * w, sy = j * w + rnd() * w, rr = 12 + rnd() * 30, gr = x.createRadialGradient(sx, sy, 0, sx, sy, rr); gr.addColorStop(0, "rgba(70,64,56,0.12)"); gr.addColorStop(1, "rgba(70,64,56,0)"); x.fillStyle = gr; x.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
  }
  // Sawn joints between the slabs.
  x.fillStyle = "rgba(70,66,60,0.55)";
  for (let i = 0; i <= n; i++) { x.fillRect(i * w - 1, 0, 2, N); x.fillRect(0, i * w - 1, N, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (concreteTexture = t);
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
/** The sky city's first island (the first district above the ground), in LAND's order. */
const SKY0 = LAND.findIndex(l => l.y > 0);
/** What a district joins (-1: the town): the sky city's later islands join its first. */
export const landPrev = (k: number) => (k <= SKY0 || LAND[k]?.y === 0 ? -1 : SKY0);
export function landSpot(k: number, bought: boolean): { x: number; z: number; r: number; y: number } {
  const key = `${k}|${bought}`;
  let v = landCache.get(key);
  if (!v) {
    // One city: the Harbor District, Garden Hills, Downtown and the Beach Resort join the
    // town's own land on its sides and its front corner (overlapping its edge, no gap and no
    // bridge); the sky districts
    // float together as one sky city above and behind the town, side by side, the first
    // straight behind it (reached by a sky lift), the next two beside it.
    void bought;
    const hull = islandOutline(ISLAND_PAD, true), cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cz = hull.reduce((a, p) => a + p[1], 0) / hull.length;
    const exit = (dx: number, dz: number) => { let t = 0; while (t < 300 && insidePoly(hull, cx + dx * t, cz + dz * t)) t += 0.25; return t; };
    if (LAND[k].y === 0) {
      // (On the town's own street grid: its blocks line up with the town's, so the streets run
      // straight on from one to the other; pushed out a block at a time until it's clear of
      // the town's blocks. A corner district, set off diagonally, goes out by its corner.)
      const [dx0, dz0] = LAND[k].dir, dl = Math.hypot(dx0, dz0) || 1, dx = dx0 / dl, dz = dz0 / dl, out = exit(dx, dz) + distEdge(dx, dz) - 4.5;
      const snap = (q: number) => (Math.round((q + OFF) / C - 0.5) + 0.5) * C - OFF;
      let x = snap(cx + dx * out), z = snap(cz + dz * out);
      // (Clear of the town's blocks and of the ground districts before it, a street apart.)
      const hits = () => [...ALL, ...BEACH].some(c => { const p = cellXZ(c); return Math.abs(p.x - x) < 2 * C - 0.1 && Math.abs(p.z - z) < 2 * C - 0.1; })
        || LAND.some((l2, k2) => k2 < k && l2.y === 0 && (() => { const o = landSpot(k2, true); return Math.abs(o.x - x) < 5 * C - 0.1 && Math.abs(o.z - z) < 5 * C - 0.1; })());
      for (let q = 0; q < 12 && hits(); q++) { x += Math.sign(dx) * C; z += Math.sign(dz) * C; }
      v = { x, z, r: LAND_R, y: LAND[k].y };
    } else {
      const bx = -Math.SQRT1_2, bz = -Math.SQRT1_2, out = exit(bx, bz) + DIST_H * 1.35 + 6;
      const sx = cx + bx * out, sz = cz + bz * out, step = 2 * DIST_H * 0.97;
      const [dx, dz] = k === SKY0 ? [0, 0] : LAND[k].dir;
      v = { x: sx + dx * step, z: sz + dz * step, r: LAND_R, y: LAND[k].y };
    }
    landCache.set(key, v);
  }
  return v;
}
/** How a district joins the city: "ground" (on the town's land), "lift" (the sky city's
 *  first island, a sky lift up from the town) or "sky" (beside the sky city's first island). */
export const landJoin = (k: number): "ground" | "lift" | "sky" => (LAND[k]?.y === 0 ? "ground" : k === SKY0 ? "lift" : "sky");
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
  lots.forEach((l, i) => { if (l.state !== "locked" && i < CELLS.length) last = i; });
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
  /** The player's own decorations: lot key → decoration id (logic/placedecor.ts). */
  placed?: Record<string, string>;
  /** The season's look (data/season.ts): "winter" adds snow, lights and a holiday tree. */
  season?: "" | "spring" | "summer" | "halloween" | "winter";
  /** The town's rank (data/ranks.ts): each one adds something new to the town. */
  rank?: number;
  /** The City Hall's level (logic/tycoon.ts hallLevel): the hall grows with it. */
  hall?: number;
  /** How many of the city grid's blocks are built so far (the city spreads as it grows). */
  grow?: number;
  /** How many of the town's own home blocks are built so far (nearest the middle first). */
  homes?: number;
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
  spot(id: "flowers" | "play" | "hall" | "bottle"): { x: number; z: number };
  /** Where piece of land k stands now (for its "for sale" bubble), or null if it isn't shown. */
  landAt(k: number): { x: number; z: number; y: number } | null;
  /** The town's properties (and the districts'): where each stands, how tall, its key. */
  homes(): { x: number; z: number; top: number; key: string; y: number }[];
  /** Where a district business stands (its building or its lot for lease), or null. */
  bizAt(i: number): { x: number; z: number; y: number; top: number } | null;
  /** Everything else worth a tap: city blocks, parks, landmarks, district sights. */
  sights(): Sight[];
  /** The building designs standing in the town ("level:design"). */
  designs(): string[];
  /** Where walker k is now (for a resident's speech bubble), or null. */
  walker(k: number): THREE.Vector3 | null;
  /** The holiday parade's route along the streets (points about 0.3 apart, town space), up
   *  to `want` long; empty when the town has no streets yet. */
  paradeRoute(want: number): THREE.Vector3[];
  /** Closes the streets to traffic (the parade is on) or opens them again. */
  paradeQuiet(on: boolean): void;
}

/** A building or place in the city the player can tap to see what it is. `kind` says what
 *  it is (see data/sights.ts); `key` tells it apart from the others. */
export interface Sight { x: number; z: number; y: number; top: number; kind: string; key: string }

export function buildBizCity(lots: BizLot[], st: BizStyle = DEFAULT_STYLE, grown: string[] = [], cafe: BizCafe = { starter: null, terrace: 0, contract: 0 }): BizCity {
  setLand((cafe.land ?? []).filter(l => l.bought).map(l => LAND.findIndex(x => x.id === l.id)).filter(k => k >= 0), cafe.grow ?? 0,
    (cafe.land ?? []).filter(l => l.sale && !l.bought).map(l => LAND.findIndex(x => x.id === l.id)).filter(k => k >= 0));
  const g = new THREE.Group();
  const sightSpots: Sight[] = [];
  const sightAt = (x: number, z: number, top: number, kind: string, key: string, y = 0) => { sightSpots.push({ x, z, y, top, kind, key }); };
  const own = <T extends THREE.Material>(m: T): T => { m.userData.own = true; return m; };
  const kitReady = kitVersion() > 0;
  let yachtAt: { x: number; z: number } | null = null;
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const signs: THREE.MeshStandardMaterial[] = [];
  const winMat = own(std(st.glass, { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color(st.lit), emissiveIntensity: 0.05 }));
  winMat.userData.dynamic = true;
  // (Pulled a hair toward the camera so panes never flicker against the wall behind them.)
  winMat.polygonOffset = true; winMat.polygonOffsetFactor = -1; winMat.polygonOffsetUnits = -4;
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
  // Squares and lot paving: granite slabs (tiles laid out in world units, see planarUV).
  const plazaM = own(std("#ffffff", { roughness: 0.82, map: plazaTex() }));
  plazaM.userData.planar = 1 / 3.2;
  // Sidewalks: concrete slabs about 0.6 across.
  const walkTex = concreteTex();
  const walk = own(std("#ffffff", { roughness: 0.88, map: walkTex }));
  const cobbleTex = paverTex().clone(); cobbleTex.needsUpdate = true;
  const cobbleM = own(std("#d9b48c", { roughness: 0.9, map: cobbleTex }));
  const streetUV = new Map<THREE.Material, number>([[road, 1 / 3], [walk, 1 / 1.2], [cobbleM, 1.5], [plazaM, 1 / 3.2]]);
  // (Grey concrete curbs, like a real street's.)
  const curb = own(std("#cfccc6", { roughness: 0.8 }));
  // The gutter along every curb: a darker band of road where the water and grit collect.
  const gutterM = own(std("#3e4148", { roughness: 0.95 }));
  // (What bends point by point to follow the curving streets; the road paint joins it below.)
  const bendPts = new Set<THREE.Material>([curb, walk]);
  // The same real lawn as the tower's island: sunny and lush patches, mowing stripes and
  // thousands of blades, laid flat in world units so it never stretches.
  const lawnTex = lawnTexture({ id: "meadow", lawn: st.lawn } as unknown as Parameters<typeof lawnTexture>[0]);
  lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping; lawnTex.userData.own = true;
  const verge = own(std("#ffffff", { roughness: 0.95, map: lawnTex }));
  // (A touch deeper and less saturated than the lawn's own colour: a real, kept lawn.)
  const grass = own(std("#c2d4b4", { roughness: 0.95, map: lawnTex }));
  const grass2 = own(std("#b6c9a8", { roughness: 0.95, map: lawnTex }));
  streetUV.set(verge, 1 / 14).set(grass, 1 / 14).set(grass2, 1 / 14);
  // Garden paths and yards: the same stone, a little warmer.
  const pave = own(std("#f4ece0", { roughness: 0.78, map: plazaTex() }));
  pave.userData.planar = 1 / 2.4;
  streetUV.set(pave, 1 / 2.4);
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
      // (Pushed out from the middle until all of it is clear of the coast: the island grows as
      // land is bought, and an islet must never sit on it.)
      // (Well clear: tall things on them must never stand over the city's edge blocks.)
      const rr = r * (k === 1 && cafe.annex && cafe.annex !== "ghost" ? ANNEX_S : 1) + (gridOut.length ? 4.5 : 1.4);
      let px = x, pz = z;
      const dl = Math.hypot(x - cx, z - cz) || 1, ox = (x - cx) / dl, oz = (z - cz) / dl;
      const touches = (qx: number, qz: number) => { for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2; if (insidePoly(hull, qx + Math.cos(an) * rr, qz + Math.sin(an) * rr)) return true; } return insidePoly(hull, qx, qz); };
      for (let s5 = 0; s5 < 200 && touches(px, pz); s5++) { px += ox * 0.5; pz += oz * 0.5; }
      o.position.set(px, yy, pz);
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
    add(roundSlab(C - ROAD * 2 + 0.24, C - ROAD * 2 + 0.24, rr + 0.12, 0.056).translate(x, 0, z), gutterM);
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
  // the town stays plain): a zebra crossing half way along and a dashed centre line,
  const medianTrees: [number, number][] = [];
  const paintM = own(new THREE.MeshBasicMaterial({ color: 0xe9e8e2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const yellowM = own(new THREE.MeshBasicMaterial({ color: 0xf2c230, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  bendPts.add(paintM); bendPts.add(yellowM);
  const paintAll: THREE.BufferGeometry[] = [], yellowAll: THREE.BufferGeometry[] = [];
  /** The markings on one street: centred at (cx, cz), running along x or z, `run` long. */
  const markStreet = (par: (geo: THREE.BufferGeometry, m: THREE.Material) => unknown, cx: number, cz: number, along: "x" | "z", run: number, y = 0.062) => {
    // (All of one street's paint is one mesh: a few hundred streets, not thousands of bars.)
    const parts: THREE.BufferGeometry[] = [], yparts: THREE.BufferGeometry[] = [];
    const P = (w: number, d: number, ox: number, oz: number, to = parts) => { const geo = new THREE.PlaneGeometry(along === "z" ? w : d, along === "z" ? d : w).rotateX(-Math.PI / 2); to.push(geo.translate(cx + (along === "z" ? ox : oz), y, cz + (along === "z" ? oz : ox))); };
    // A zebra crossing at each end of the street, where it meets the crossroads (like a real
    // city's), a white stop line before it on the side cars come in on, and a double yellow
    // centre line between them.
    const cw = Math.min(run / 2 - 1.3, C / 2 - ROAD - 0.45);
    for (const end of [-1, 1]) for (let b = -3; b <= 3; b++) P(0.2, 0.6, b * 0.32, end * cw);
    // (Cars keep right: coming into the +x end they're on the +z side, into the +z end on -x.)
    for (const end of [-1, 1]) { const side = along === "z" ? -end : end; P(0.98, 0.08, side * 0.55, end * (cw - 0.45)); }
    const len = 2 * (cw - 0.5);
    if (len > 0) for (const o of [-0.05, 0.05]) P(0.035, len, o, 0, yparts);
    // (Gathered for the whole town and drawn as two meshes at the end: white and yellow.)
    if (par === add) { paintAll.push(...parts); yellowAll.push(...yparts); return; }
    const merged = mergeGeometries(parts); parts.forEach(q => q.dispose());
    if (merged) par(merged, paintM);
    const ym = yparts.length ? mergeGeometries(yparts) : null; yparts.forEach(q => q.dispose());
    if (ym) par(ym, yellowM);
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
        if (!roundKeep(ax, az)) continue;
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
  /** Places a kit model (bush, rock, stump, log...) at a spot; false until the kit is loaded. */
  const kitAt = (name: string, w: number, x: number, y: number, z: number, ry = 0): boolean => {
    const kp = kitPlace(name, w);
    if (!kp) return false;
    kp.obj.position.set(x, y, z); kp.obj.rotation.y = ry;
    g.add(kp.obj);
    return true;
  };
  // The town's trees: drawn in code (trees.ts), all of them one mesh at the end of the build.
  const nature = new NatureBatch();
  const natureM = own(natureMaterial());
  /** A park or street tree's geometry (drawn in code), its kind picked from where it stands. */
  const parkTree = (x: number, z: number, s: number, seed: number, y = 0.06): THREE.BufferGeometry => {
    const kinds: TreeKind[] = st.tree === "palm" ? ["palm", "palm", "oak"] : st.tree === "pine" ? ["pine", "birch", "pine", "cypress"] : ["oak", "maple", "birch", "cherry", "oak", "apple"];
    const sd = Math.abs(Math.round(seed));
    const kind = kinds[sd % kinds.length];
    return treeGeo(kind, x, y, z, s * (kind === "palm" ? 0.92 : 1), sd);
  };
  const tree = (x: number, z: number, s = 1, y = 0.2) => {
    blob(x, z, 0.62 * s, y);
    const tk = Math.abs(Math.round(x * 7 + z * 13));
    const kinds: TreeKind[] = st.tree === "palm" ? ["palm"] : st.tree === "pine" ? ["pine", "pine", "cypress", "birch"] : ["oak", "oak", "maple", "apple", "cherry", "birch", "oak", "pine"];
    const kind = kinds[tk % kinds.length];
    nature.tree(kind, x, y, z, (kind === "palm" ? 0.56 : kind === "cypress" ? 0.62 : 0.6) * s, tk);
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
  // The decorations' kit (streetdecor.ts), and what stands in each roundabout.
  const deco: DecoKit = { put: add, c: (c, r = 0.7, m = 0) => mats.c(c, r, m), leaf, wood, stone, metal, tree, flowers: flowersOn };
  roundabouts.forEach(([x, z], i) => roundCenter(deco, x, z, 0.22, i));
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
  // Lawns with room for a snowman on a snow day (winter.ts snowmen): the parks', then empty lots.
  const snowSpots: [number, number, number][] = [];
  // The two parks by the entrance: lawns, a path, a pond, benches.
  for (const [n, cell] of PARKS.entries()) {
    const { x, z } = cellXZ(cell);
    snowSpots.push([x - 1.7, 0.26, z + 0.15], [x + 1.7, 0.26, z + 0.15]);
    add(roundSlab(C - ROAD * 2 - 0.6, C - ROAD * 2 - 0.6, BLOCK_R - 0.1 - 0.22, 0.06).translate(x, 0.2, z), grass);
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
    // (Each block gets its own mix of designs: see streetdecor.ts.)
    const v = Math.abs(cell[0] * 5 + cell[1] * 3 + n);
    hydrant(deco, x - side, z - 1.0, 0.2, v);
    if (n % 3 === 0) mailbox(deco, x + 1.0, z - side, 0.2);
    // A piece on the (-, +) plaza: a flower pot, a topiary box, an urn, bikes, a café table or a flower cart.
    plazaPiece(deco, x - pc, z + pc, 0.28, v);
    // Seating facing out from the (+, -) plaza: a bench and bin, a modern bench and recycling, a tree and bench, or a picnic table.
    seatPiece(deco, x + pc - 0.08, z - pc + 0.08, 0.2, Math.PI * 0.75, v + 1);
  }
  /** Where the beach starts: just behind the back row of streets. */
  const beachZ = cellXZ([0, 0]).z - C / 2;
  // Where the waterfall's pond sits (on the verge by the left edge; built further down).
  const fallAt = (() => { let best = hull[0]; for (const p of hull) if (p[0] - p[1] < best[0] - best[1]) best = p; return best; })();
  // (A fixed step in from the edge, on the grass verge: never out on the ring road.)
  const inX = cx - fallAt[0], inZ = cz - fallAt[1], inL = Math.hypot(inX, inZ) || 1;
  const fx0 = fallAt[0] + (inX / inL) * 1.35, fz0 = fallAt[1] + (inZ / inL) * 1.35;
  // ---- The countryside ring past the town: a winding lane, farm fields, a windmill ----
  const townTicksEarly: ((t: number, night: number) => void)[] = [];
  const coreHull = islandOutline(1.0);
  // The lane: a sandy cobbled road that wanders round the town, half way out to the edge
  // (not across the beach), with a low hedge of posts here and there.
  // ---- The city grid: every square of the island between the town and its districts is one
  // block of the same street grid (a road all round it, then a building, a park or the Town
  // Hall on it), so streets always join up and nothing stands on anything else. What's left
  // between the grid and the coast is countryside. ----
  // (A ground district on sale keeps its spot: the grid and the countryside go round it.)
  const groundDist = (cafe.land ?? []).filter(l => (l.bought || l.sale) && landJoin(LAND.findIndex(x => x.id === l.id)) === "ground").map(l => landSpot(LAND.findIndex(x => x.id === l.id), true));
  const inDist = (x: number, z: number, m = 0) => groundDist.some(sp => Math.abs(x - sp.x) < 2 * C + m && Math.abs(z - sp.z) < 2 * C + m);
  const outer = gridOut;
  const outerSet = new Set(outer.map(c => `${c[0]},${c[1]}`));
  /** Whether a point is on the city grid's blocks or a district (not countryside). */
  const inGrid = (x: number, z: number, m = 0.4) => inDist(x, z, m) || outer.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 + m && Math.abs(z - p.z) < C / 2 + m; });
  // The grid's streets: the same asphalt, curb and sidewalk as the town's, with markings on
  // every street between two blocks.
  {
    const inAllO = (gx: number, gz: number) => ALL.some(c => c[0] === gx && c[1] === gz);
    for (const cell of outer) {
      const { x, z } = cellXZ(cell);
      add(new THREE.BoxGeometry(C, 0.1, C).translate(x, 0.0, z), road);
      add(roundSlab(C - ROAD * 2, C - ROAD * 2, BLOCK_R, 0.18).translate(x, 0, z), curb);
      add(roundSlab(C - ROAD * 2 - 0.16, C - ROAD * 2 - 0.16, BLOCK_R - 0.1, 0.2).translate(x, 0, z), walk);
      const distAt = (gx: number, gz: number) => { const p = cellXZ([gx, gz]); return inDist(p.x, p.z, -0.1); };
      for (const [a, b, along] of [[1, 0, "z"], [0, 1, "x"]] as const) {
        const n = `${cell[0] + a},${cell[1] + b}`;
        if (outerSet.has(n) || inAllO(cell[0] + a, cell[1] + b) || distAt(cell[0] + a, cell[1] + b)) markStreet(add, x + a * q, z + b * q, along, C - 0.6);
      }
      for (const [a, b, along] of [[-1, 0, "z"], [0, -1, "x"]] as const) if (inAllO(cell[0] + a, cell[1] + b) || distAt(cell[0] + a, cell[1] + b)) markStreet(add, x + a * q, z + b * q, along, C - 0.6);
      // Where the city ends (no street beyond): the last half street is a sidewalk with a curb,
      // not asphalt running out onto the grass.
      const beachSet = BEACH.some(c => c[0] === cell[0] && c[1] === cell[1] - 1);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx2 = cell[0] + a, nz2 = cell[1] + b;
        if (outerSet.has(`${nx2},${nz2}`) || inAllO(nx2, nz2) || distAt(nx2, nz2) || (b === -1 && beachSet)) continue;
        // (The sidewalk stops at the curb, and the curb stands a hair proud of the asphalt: no
        // two faces share a plane, so the city's edge never flickers as the view moves.)
        const W2 = ROAD - 0.14, ex = x + a * (C / 2 - 0.14 - W2 / 2), ez = z + b * (C / 2 - 0.14 - W2 / 2), w = a ? W2 : C, d = a ? C : W2;
        add(new THREE.BoxGeometry(w, 0.2, d).translate(ex, 0.1, ez), walk);
        add(new THREE.BoxGeometry(a ? 0.15 : C + 0.02, 0.22, a ? C + 0.02 : 0.15).translate(x + a * (C / 2 - 0.065), 0.11, z + b * (C / 2 - 0.065)), curb);
      }
    }
  }
  // (No dirt lane round the island any more: every road is part of the street grid.)
  const laneAll: [number, number][] = [];
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
      if (pnt[1] > beachZ + 0.6 && insidePoly(hull, pnt[0], pnt[1], 0.95) && !inGrid(pnt[0], pnt[1], 1)) cur.push(pnt); else { if (cur.length > 2) runs.push(cur); cur = []; }
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
    // (Out of the way of the city grid: along the coast to the countryside.)
    for (let k = 0; k < hull.length && inGrid(wx, wz, 1.2); k++) { const hp = hull[(k * 7) % hull.length], l = Math.hypot(cx - hp[0], cz - hp[1]) || 1; wx = hp[0] + ((cx - hp[0]) / l) * 2.2; wz = hp[1] + ((cz - hp[1]) / l) * 2.2; }
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
  const landBuilt = (cafe.land ?? []).filter(l => l.bought || (l.sale && landJoin(LAND.findIndex(x => x.id === l.id)) === "ground")).map(l => landSpot(LAND.findIndex(x => x.id === l.id), true));
  const landBuilt0 = (cafe.land ?? []).filter(l => (l.bought || l.sale) && landJoin(LAND.findIndex(x => x.id === l.id)) === "ground").map(l => landSpot(LAND.findIndex(x => x.id === l.id), true));
  // Parks with a lake on the big open stretches of the island (between the town and the
  // districts): found by looking for the spots furthest from any street, district or shore.
  const parks: { x: number; z: number; r: number }[] = [];
  let hallAt: { x: number; z: number } | null = null, hallTop = 3;
  {
    const clear = (x: number, z: number) => {
      let d = Infinity;
      for (const c of ALL) { const p = cellXZ(c); d = Math.min(d, Math.hypot(Math.max(0, Math.abs(x - p.x) - C / 2), Math.max(0, Math.abs(z - p.z) - C / 2))); }
      for (const sp of landBuilt0) d = Math.min(d, Math.hypot(Math.max(0, Math.abs(x - sp.x) - DIST_H), Math.max(0, Math.abs(z - sp.z) - DIST_H)));
      d = Math.min(d, z - beachZ);
      for (let m = 1; m < d && m < 14; m += 1) if (!insidePoly(hull, x, z, m)) { d = Math.min(d, m - 1); break; }
      return d;
    };
    // The City Hall's square: on the grid, the block nearest the middle of town; otherwise
    // the open spot nearest the middle of town with room round it.
    if (outer.length) {
      const tcx = ALL.reduce((a, c) => a + cellXZ(c).x, 0) / ALL.length, tcz = ALL.reduce((a, c) => a + cellXZ(c).z, 0) / ALL.length;
      let bestD = Infinity;
      for (const c of outer) { const p = cellXZ(c), d = Math.hypot(p.x - tcx, p.z - tcz); if (d < bestD) { bestD = d; hallAt = { x: p.x, z: p.z }; } }
    } else {
      const tcx = ALL.reduce((a, c) => a + cellXZ(c).x, 0) / ALL.length, tcz = ALL.reduce((a, c) => a + cellXZ(c).z, 0) / ALL.length;
      const hx0 = Math.min(...hull.map(p => p[0])), hx1 = Math.max(...hull.map(p => p[0])), hz0 = Math.min(...hull.map(p => p[1])), hz1 = Math.max(...hull.map(p => p[1]));
      let bestD = Infinity;
      for (let x = hx0; x <= hx1; x += 1) for (let z = hz0; z <= hz1; z += 1) {
        if (!insidePoly(hull, x, z) || clear(x, z) < 3.4) continue;
        const d = Math.hypot(x - tcx, z - tcz);
        if (d < bestD) { bestD = d; hallAt = { x, z }; }
      }
    }
    if (false as boolean) {
      const hx0 = Math.min(...hull.map(p => p[0])), hx1 = Math.max(...hull.map(p => p[0])), hz0 = Math.min(...hull.map(p => p[1])), hz1 = Math.max(...hull.map(p => p[1]));
      const cand: { x: number; z: number; r: number }[] = [];
      for (let x = hx0; x <= hx1; x += 2) for (let z = hz0; z <= hz1; z += 2) { if (!insidePoly(hull, x, z)) continue; const r = clear(x, z); if (r >= 5.5) cand.push({ x, z, r }); }
      cand.sort((a, b) => b.r - a.r);
      for (const c of cand) { if (parks.length >= 3) break; if (hallAt && Math.hypot(hallAt.x - c.x, hallAt.z - c.z) < c.r + 4) continue; if (parks.every(p => Math.hypot(p.x - c.x, p.z - c.z) > p.r + c.r + 2)) parks.push({ ...c, r: Math.min(c.r, 11) }); }
    }
  }
  const inPark = (x: number, z: number) => parks.some(p => Math.hypot(x - p.x, z - p.z) < p.r) || (!!hallAt && Math.hypot(x - hallAt.x, z - hallAt.z) < 3.4);
  // (Nothing of the countryside's goes on the land the player bought: that's for its own build.)
  const onLand = (x: number, z: number) => landBuilt.some(sp => Math.abs(x - sp.x) < DIST_H + 0.6 && Math.abs(z - sp.z) < DIST_H + 0.6) || nearLink(x, z) || inPark(x, z);
  // The road from the town's streets out to the first island's bridge (once it's for sale or
  // bought): where it runs, so the countryside keeps clear of it.
  const linkFor = (k: number) => {
    const l0 = (cafe.land ?? []).find(l => l.id === LAND[k].id && (l.bought || l.sale));
    if (!l0 || landJoin(k) !== "ground" || true) return null;
    const sp0 = landSpot(k, true), h = islandOutline(ISLAND_PAD, true);
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
  };
  const linkOf = LAND.map((_, k) => linkFor(k));
  const links = linkOf.filter((l): l is NonNullable<typeof l> => !!l);
  const nearLink = (x: number, z: number) => links.some(link => {
    const vx = link.bx - link.ax, vz = link.bz - link.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - link.ax) * vx + (z - link.az) * vz) / L2));
    return Math.hypot(x - (link.ax + vx * t), z - (link.az + vz * t)) < 2.2;
  });
  /** A street from a to b: asphalt with curbs and sidewalks either side, as the town's. */
  const streetStrip = (par: THREE.Object3D, ax: number, az: number, bx: number, bz: number, y: number, rM: THREE.Material, wM: THREE.Material, cM: THREE.Material) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) return;
    const rot = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const S = (w: number, h: number, ox: number, m: THREE.Material) => par.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, len).translate(ox, h / 2, 0).rotateY(rot).translate(mx, y, mz), m));
    S(ROAD * 2, 0.1, 0, rM);
    for (const sd of [-1, 1]) { S(0.12, 0.18, sd * (ROAD + 0.06), cM); S(0.55, 0.2, sd * (ROAD + 0.39), wM); }
  };
  // The ring boulevard: a curving avenue all round the town (once the city spreads past it),
  // between the town and its neighbourhoods; it stops at the shore, the districts, the
  // parks and the City Hall's square, and everything else keeps clear of it.
  if (false as boolean) {
    let ringR = grow(coreHull, 5.2);
    for (let r6 = 0; r6 < 2; r6++) { const nx: [number, number][] = []; for (let i = 0; i < ringR.length; i++) { const a = ringR[i], b = ringR[(i + 1) % ringR.length]; nx.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } ringR = nx; }
    // (Even steps, about 1.1 apart, so the curve reads as one smooth road.)
    const even: [number, number][] = [];
    for (let i = 0; i < ringR.length; i++) { const a = ringR[i], b = ringR[(i + 1) % ringR.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d < L; d += 1.1) even.push([a[0] + ((b[0] - a[0]) * d) / L, a[1] + ((b[1] - a[1]) * d) / L]); }
    const okAt = (x: number, z: number) => insidePoly(hull, x, z, 1.6) && z > beachZ + 1.2 && !landBuilt.some(sp => Math.abs(x - sp.x) < DIST_H + 0.8 && Math.abs(z - sp.z) < DIST_H + 0.8) && !parks.some(p => Math.hypot(x - p.x, z - p.z) < p.r) && !(hallAt && Math.hypot(x - hallAt.x, z - hallAt.z) < 3.6) && !ALL.some(c => { const q = cellXZ(c); return Math.abs(x - q.x) < C / 2 + 1.4 && Math.abs(z - q.z) < C / 2 + 1.4; });
    for (let i = 0; i < even.length; i++) {
      const a = even[i], b = even[(i + 1) % even.length];
      if (!okAt(a[0], a[1]) || !okAt(b[0], b[1])) continue;
      // (A little past each end, so the pieces overlap round the bends: no gaps.)
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, ex = (dx / L) * 0.12, ez = (dz / L) * 0.12;
      streetStrip(g, a[0] - ex, a[1] - ez, b[0] + ex, b[1] + ez, 0, road, walk, curb);
      laneAll.push(a);
      if (i % 9 === 0) { add(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(a[0] - (dz / L) * 1.75, 0.7, a[1] + (dx / L) * 1.75), metal); add(new THREE.SphereGeometry(0.12, 8, 6).translate(a[0] - (dz / L) * 1.75, 1.45, a[1] + (dx / L) * 1.75), bulb); }
    }
  }
  // The City Hall: the city's main building on its own square, growing with its own level
  // (a wooden hall, then a clock tower, a stone hall with columns, wings, a dome, a golden
  // dome and statue, and at last a grand capitol with a beacon). Tap it for Mayor Pip's story.
  if (hallAt) {
    const { x: hx, z: hz } = hallAt, rk = cafe.hall ? Math.min(6, Math.round((cafe.hall - 1) * 0.6)) : cafe.rank ?? 0, H = new THREE.Group();
    const T = (geo: THREE.BufferGeometry, m: THREE.Material) => H.add(new THREE.Mesh(geo, m));
    const goldM = mats.gold;
    // The square: paving, steps and planters.
    T(new THREE.CylinderGeometry(3.3, 3.35, 0.08, 32).translate(0, 0.04, 0), plazaM);
    T(new THREE.RingGeometry(3.0, 3.25, 32).rotateX(-Math.PI / 2).translate(0, 0.085, 0), mats.c("#d9cfbd", 0.8));
    // The building itself: real architecture, growing with the hall's level (cityhall.ts).
    const built = buildCityHall(H, rk, {
      c: (c, r = 0.7, m = 0) => mats.c(c, r, m), win: winMat, gold: goldM,
      beacon: () => { const bm = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 1.2 })); bm.userData.dynamic = true; townTicksEarly.push(t => { bm.emissiveIntensity = 0.8 + Math.sin(t * 2.5) * 0.5; }); return bm; },
    });
    const top = built.top, D = built.D;
    // Winter Lights: a holiday tree in the square, beside the steps.
    // Each season has its own piece in the square, beside the steps.
    const sqx = 1.75, sqz = Math.min(D / 2 + 1.45, 2.3);
    if (cafe.season === "winter") townTicksEarly.push(holidayTree(H, sqx, 0.08, sqz, 2.1, own));
    else if (cafe.season === "spring") blossomTree(H, sqx, 0.08, sqz, 2.0, own);
    else if (cafe.season === "summer") festivalUmbrellas(H, sqx, 0.08, sqz, 1.6, own);
    else if (cafe.season === "halloween") { const tk = pumpkins(H, sqx, 0.08, sqz, 1.4, own); townTicksEarly.push(tk); }
    // The night market opens on the other side of the steps after dark.
    if (HAS_CITY && (cafe.hall ?? 0) >= 2) townTicksEarly.push(nightMarket(H, -sqx - 0.1, 0.08, sqz, 1.5, own));
    // Clipped trees in stone planters at the square's corners.
    for (const [px, pz] of [[-2.5, D / 2 + 0.9], [2.5, D / 2 + 0.9], [-2.6, -1.4], [2.6, -1.4]]) H.add(new THREE.Mesh(gardenGeometry("topiary", 3).scale(1.5, 1.5, 1.5).translate(px, 0.08, pz), natureM));
    // Facing the town's middle.
    const tcx = ALL.reduce((a, c) => a + cellXZ(c).x, 0) / ALL.length, tcz = ALL.reduce((a, c) => a + cellXZ(c).z, 0) / ALL.length;
    H.rotation.y = Math.atan2(tcx - hx, tcz - hz);
    // (On the city grid it stands square to the streets and fits inside its block.)
    const hs = outer.length ? 0.72 : 1;
    if (outer.length) { H.rotation.y = Math.round(H.rotation.y / (Math.PI / 2)) * (Math.PI / 2); H.scale.setScalar(hs); }
    H.position.set(hx, outer.length ? 0.2 : 0, hz);
    g.add(H);
    hallTop = (top + 0.3) * hs;
  }
  // The parks: a lake with a sandy shore, a path all round it with benches facing the water,
  // a wooden jetty with a rowboat, a white gazebo, flower beds, and trees in a ring.
  parks.forEach((pk, pi) => {
    const lr = pk.r * 0.46, ring: [number, number][] = [];
    for (let a = 0; a < 28; a++) { const an = (a / 28) * Math.PI * 2, rr = lr * (1 + 0.14 * Math.sin(an * 3 + pi * 2) + 0.07 * Math.sin(an * 5 + pi)); ring.push([Math.cos(an) * rr, Math.sin(an) * rr]); }
    const shape = (k2: number) => new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x * k2, -z * k2)));
    add(new THREE.ShapeGeometry(shape(1.12), 2).rotateX(-Math.PI / 2).translate(pk.x, 0.03, pk.z), mats.c("#e9d6a6", 0.95));
    add(new THREE.ShapeGeometry(shape(1), 2).rotateX(-Math.PI / 2).translate(pk.x, 0.05, pk.z), water);
    add(new THREE.ShapeGeometry(shape(0.55), 2).rotateX(-Math.PI / 2).translate(pk.x, 0.055, pk.z), mats.c("#3a9ee0", 0.15));
    // The path round the lake.
    const pr = lr * 1.12 + 1.1;
    add(new THREE.RingGeometry(pr - 0.38, pr + 0.38, 48).rotateX(-Math.PI / 2).translate(pk.x, 0.04, pk.z), pave);
    // Benches facing the water, lamps between them.
    for (let b = 0; b < 6; b++) {
      const an = (b / 6) * Math.PI * 2 + 0.3, bx = pk.x + Math.cos(an) * (pr + 0.7), bz = pk.z + Math.sin(an) * (pr + 0.7);
      bench(bx, bz, -an - Math.PI / 2);
      const la = an + Math.PI / 6, lx = pk.x + Math.cos(la) * (pr + 0.6), lz = pk.z + Math.sin(la) * (pr + 0.6);
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(lx, 0.7, lz), metal);
      add(new THREE.SphereGeometry(0.12, 8, 6).translate(lx, 1.45, lz), bulb);
    }
    // Trees in a loose ring outside the path, with flower beds between.
    for (let t2 = 0; t2 < 14; t2++) {
      const an = (t2 / 14) * Math.PI * 2 + pi, rr = pr + 1.7 + (t2 % 3) * 0.7;
      if (rr > pk.r - 0.4) continue;
      tree(pk.x + Math.cos(an) * rr, pk.z + Math.sin(an) * rr, 0.85 + (t2 % 3) * 0.2, 0);
      if (t2 % 2) { const fa = an + 0.22, fx = pk.x + Math.cos(fa) * (pr + 1.3), fz = pk.z + Math.sin(fa) * (pr + 1.3); add(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 12).translate(fx, 0.07, fz), stone); for (let f = 0; f < 6; f++) add(new THREE.SphereGeometry(0.08, 6, 4).translate(fx + Math.cos(f) * 0.24, 0.2, fz + Math.sin(f) * 0.24), mats.c(flowersOn[(f + t2) % 4], 0.8)); }
    }
    // A jetty out over the water with a rowboat, and a gazebo on the far side.
    const ja = pi * 1.7 + 0.8, jx = Math.cos(ja), jz = Math.sin(ja);
    for (let q = 0; q < 6; q++) add(new THREE.BoxGeometry(0.7, 0.05, 0.3).rotateY(-ja + Math.PI / 2).translate(pk.x + jx * (pr - 0.6 - q * 0.32), 0.1, pk.z + jz * (pr - 0.6 - q * 0.32)), wood);
    add(new THREE.BoxGeometry(0.34, 0.12, 0.8).rotateY(-ja).translate(pk.x + jx * (pr - 2.6) - jz * 0.6, 0.1, pk.z + jz * (pr - 2.6) + jx * 0.6), mats.c("#ff8a5c", 0.6));
    const ga = ja + Math.PI, gx = pk.x + Math.cos(ga) * (pr + 1.5), gz = pk.z + Math.sin(ga) * (pr + 1.5);
    if (pr + 2.4 < pk.r) {
      add(new THREE.CylinderGeometry(0.9, 0.95, 0.15, 8).translate(gx, 0.08, gz), mats.c("#f4f0e8", 0.6));
      for (let c2 = 0; c2 < 6; c2++) { const ca = (c2 / 6) * Math.PI * 2; add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6).translate(gx + Math.cos(ca) * 0.75, 0.6, gz + Math.sin(ca) * 0.75), mats.c("#ffffff", 0.5)); }
      add(new THREE.ConeGeometry(1.05, 0.55, 8).translate(gx, 1.33, gz), mats.c("#5fae8a", 0.6));
    }
    // Ducks on the water.
    for (let d2 = 0; d2 < 3; d2++) { const da = pi + d2 * 1.9, dx2 = pk.x + Math.cos(da) * lr * 0.5, dz2 = pk.z + Math.sin(da) * lr * 0.5; add(new THREE.SphereGeometry(0.09, 6, 5).scale(1.4, 0.8, 1).translate(dx2, 0.1, dz2), mats.c("#ffffff", 0.6)); add(new THREE.SphereGeometry(0.05, 6, 5).translate(dx2 + 0.1, 0.17, dz2), mats.c("#2f8a4a", 0.6)); }
  });
  // Out past the town, the island is lived in: little neighbourhoods of houses with gardens
  // and picket fences (from the model kit), a few to a cluster, round the open land.
  // (Homes stand on the city's own blocks now, never loose on the grass.)
  const homesOut: [number, number][] = [];
  const nearHomeOut = (x: number, z: number) => homesOut.some(([hx, hz]) => Math.abs(x - hx) < 2.2 && Math.abs(z - hz) < 2.2);
  // The verge: the island's own trees, bushes, flowers and boulders round the town.
  {
    const inCell = (x: number, z: number) => ALL.some(c => { const p = cellXZ(c); return Math.abs(x - p.x) < C / 2 + 0.35 && Math.abs(z - p.z) < C / 2 + 0.35; });
    const inside = (x: number, z: number, m = 0.45) => insidePoly(hull, x, z, m);
    const tufts: [number, number][] = [];
    let k = 0;
    const FIELD = [["#e8c45a", "#d4a83a"], ["#7cc85a", "#5aa848"], ["#b48cdc", "#9a6ec8"], ["#c8945a", "#a8743a"]];
    const hx0 = Math.min(...hull.map(p => p[0])), hx1 = Math.max(...hull.map(p => p[0])), hz0 = Math.min(...hull.map(p => p[1])), hz1 = Math.max(...hull.map(p => p[1]));
    for (let x = hx0; x <= hx1; x += 1.2) for (let z = hz0; z <= hz1; z += 1.2) {
      const jx = x + Math.sin(k * 12.9898) * 0.4, jz = z + Math.cos(k * 78.233) * 0.4, r = Math.abs(Math.sin(k * 3.7));
      k++;
      if (inCell(jx, jz) || !inside(jx, jz) || jz < beachZ + 0.3 || onLand(jx, jz) || inGrid(jx, jz, 0.35)) continue;
      if (Math.hypot(jx - fx0, jz - fz0) < 1.6 || Math.hypot(jx - (fx0 + fallAt[0]) / 2, jz - (fz0 + fallAt[1]) / 2) < 1.0) continue;
      if (nearLane(jx, jz, 0.75) || nearHomeOut(jx, jz)) continue;
      // Out in the countryside: farm fields in rows (wheat, greens, lavender, ploughed earth)
      // and the odd sheep, between the trees.
      if (!insidePoly(coreHull, jx, jz)) {
        const fh = Math.abs(Math.sin(Math.floor(jx / 2.4) * 12.1 + Math.floor(jz / 2.4) * 7.7)) % 1;
        if (fh < 0 && inside(jx, jz, 0.7) && !nearLane(jx, jz, 1.2)) { // (farm fields: retired)
          const fc = FIELD[Math.floor(fh * 100) % FIELD.length], ang = Math.floor(jx / 2.4 + jz / 2.4) % 2 ? 0 : Math.PI / 2;
          add(new THREE.BoxGeometry(1.2, 0.04, 1.2).rotateY(ang).translate(jx, 0.03, jz), mats.c(fc[1], 0.95));
          for (let row = -2; row <= 2; row++) add(new THREE.BoxGeometry(1.1, 0.07, 0.13).translate(0, 0, row * 0.22).rotateY(ang).translate(jx, 0.07, jz), mats.c(fc[0], 0.9));
          continue;
        }
        if (fh > 2 && inside(jx, jz, 0.8)) { // (sheep: retired with the fields)
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
      // (Once the model kit is loaded the neighbourhoods of real houses do this job: the
      // little toy cottages would look out of scale next to them.)
      if (!kitReady && h < 0.13 && inside(jx, jz, 1.1) && !nearLane(jx, jz, 1.05) && !inCell(jx + 0.6, jz) && !inCell(jx - 0.6, jz) && !inCell(jx, jz + 0.6) && !inCell(jx, jz - 0.6)) {
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
      if (h < 0 && inside(jx, jz, 0.9)) { // (garden beds: retired, they read as dirt patches)
        // Garden rows: brown beds with green tops.
        const ga = Math.atan2(cx - jx, cz - jz);
        for (let row = 0; row < 3; row++) {
          const ox = Math.cos(ga) * (row - 1) * 0.22, oz = -Math.sin(ga) * (row - 1) * 0.22;
          add(new THREE.BoxGeometry(0.16, 0.06, 0.6).rotateY(ga).translate(jx + ox, 0.03, jz + oz), earth);
          for (let q = 0; q < 3; q++) add(new THREE.SphereGeometry(0.06, 5, 4).translate(jx + ox + Math.sin(ga) * (q - 1) * 0.18, 0.09, jz + oz + Math.cos(ga) * (q - 1) * 0.18), mats.c(q % 2 ? "#5ec26a" : "#8ad06a", 0.8));
        }
        continue;
      }
      if (r < 0.4) tree(jx, jz, 0.5 + r * 0.6, 0); // (In scale with the city's street trees.)
      else if (r < 0.6 && kitAt(r < 0.5 ? "bush" : "bush_large", 0.5 + r * 0.4, jx, 0, jz, k)) { /* a kit bush */ }
      else if (r < 0.6) add(new THREE.IcosahedronGeometry(0.28, 0).translate(jx, 0.15, jz), leaf);
      else if (r < 0.72 && kitAt(["rock_small", "rock_large", "rock_tall", "stump", "log", "rock_small"][k % 6], [0.5, 0.8, 0.5, 0.4, 0.8, 0.35][k % 6] * (0.8 + r * 0.6), jx, 0, jz, k * 1.7)) { /* a kit rock, stump or log */ }
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
    // Vines and roots hanging down the cliff here and there (few, short and leafy-dark: long
    // thin ones read as spikes from far away).
    if (false) { const vineM = own(std(new THREE.Color(st.leaf).multiplyScalar(0.85), { roughness: 0.9 }));
      for (let i = 0; i < hull.length; i += 7) { const [vx, vz] = hull[i], len = 0.35 + Math.abs(Math.sin(i * 3.3)) * 0.7; add(new THREE.BoxGeometry(0.07, len, 0.07).translate(vx, -len / 2 - 0.02, vz), vineM); add(new THREE.SphereGeometry(0.08, 5, 4).translate(vx, -len - 0.02, vz), vineM); } }
    // A low railing of posts and a rail along the island's edge.
    const rail = grow(hull, -0.3);
    let railRun = 0;
    for (let i = 0; i < rail.length; i++) {
      const a = rail[i], b = rail[(i + 1) % rail.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((a[1] + b[1]) / 2 < beachZ - 0.5) continue; // the beach is open to the sea
      if (links.some(link => Math.hypot((a[0] + b[0]) / 2 - link.ax, (a[1] + b[1]) / 2 - link.az) < 2.4)) continue; // the road out to the bridge
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
  // The giant holiday tree (Winter Lights' prize): in the fountain each winter.
  // The season's prize (won in its weekly event) stands in the fountain while it's on.
  const prizeOn = (cafe.season === "winter" && decor.has("bigtree")) || (cafe.season === "spring" && decor.has("blossomarch"))
    || (cafe.season === "summer" && decor.has("bandstand")) || (cafe.season === "halloween" && decor.has("giantpumpkin"));
  const bigTree = prizeOn;
  if (prizeOn) {
    jet.visible = false;
    if (cafe.season === "winter") townTicksEarly.push(holidayTree(g, pz.x, 0.62, pz.z, 3.4, own));
    else if (cafe.season === "spring") blossomArch(g, pz.x, 0.62, pz.z, 2.6, own);
    else if (cafe.season === "summer") { const tk = bandstand(g, pz.x, 0.62, pz.z, 2.4, own); townTicksEarly.push(t => tk(t)); }
    else { const tk = pumpkins(g, pz.x, 0.62, pz.z, 2.0, own, 1); townTicksEarly.push(tk); }
  }
  // The golden founder statue (a decoration): on top of the fountain, arm raised.
  if (decor.has("statue") && !bigTree) {
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
  townTicks.push((t, night) => { for (const f of townTicksEarly) f(t, night); });
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
  if (decor.has("skytram") && islets[0] && !outer.length) {
    // A cable car from a little station on the edge out to the first floating island.
    // (The station stands on the coast nearest the islet, a little way in.)
    const it = islets[0];
    let ce = hull[0];
    for (const p of hull) if (Math.hypot(p[0] - it.o.position.x, p[1] - it.o.position.z) < Math.hypot(ce[0] - it.o.position.x, ce[1] - it.o.position.z)) ce = p;
    const cdl = Math.hypot(ce[0] - it.o.position.x, ce[1] - it.o.position.z) || 1;
    const st = new THREE.Vector3(ce[0] + ((ce[0] - it.o.position.x) / cdl) * 1.2, 0.9, ce[1] + ((ce[1] - it.o.position.z) / cdl) * 1.2);
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
  let beachLive = (_t: number, _night: number, _live?: BizLive) => {};
  let beachSpot: { x: number; z: number } | null = null;
  let bottleSpot: { x: number; z: number } | null = null;
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
      // (Hidden: the water shader makes its own glitter now, so none are made.)
      for (let x = Math.min(...sx); x < Math.max(...sx) && false; x += 1.1) for (let z = Math.min(...sz); z < zShore - 0.8; z += 0.9) {
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
    // The seaside promenade between the beach road and the sand: a curb, a paved walk with a
    // white railing on the beach side, lamps and benches facing the sea, and a dashed line
    // down the beach road, so the street along the beach is finished like the others.
    {
      const pz0 = beachZ - 0.05, pz1 = beachZ - 0.78, pzm = (pz0 + pz1) / 2;
      const sx = clipZ(clipZ(sandPoly, pz0, true), pz1, false).map(p2 => p2[0]);
      if (sx.length) {
        const ax = Math.min(...sx) + 0.15, bx = Math.max(...sx) - 0.15, L = bx - ax, mx = (ax + bx) / 2;
        add(new THREE.BoxGeometry(L, 0.18, 0.12).translate(mx, 0.09, pz0 - 0.06), curb);
        add(new THREE.BoxGeometry(L, 0.16, pz0 - pz1 - 0.12).translate(mx, 0.08, pzm - 0.06), walk);
        add(new THREE.BoxGeometry(L, 0.06, 0.05).translate(mx, 0.52, pz1 + 0.04), mats.c("#ffffff", 0.5));
        add(new THREE.BoxGeometry(L, 0.03, 0.03).translate(mx, 0.34, pz1 + 0.04), mats.c("#ffffff", 0.5));
        for (let x = ax + 0.2; x < bx; x += 0.55) add(new THREE.BoxGeometry(0.04, 0.38, 0.04).translate(x, 0.33, pz1 + 0.04), mats.c("#ffffff", 0.5));
        for (let x = ax + 1.6, n = 0; x < bx - 0.8; x += 3.2, n++) {
          add(new THREE.CylinderGeometry(0.035, 0.05, 1.3, 8).translate(x, 0.81, pzm), metal);
          add(new THREE.SphereGeometry(0.1, 10, 8).translate(x, 1.5, pzm), lampMat);
          lampAt.push(new THREE.Vector3(x, 1.5, pzm));
          if (n % 2 === 0) bench(x + 1.6, pzm + 0.05, Math.PI);
        }
        // The beach road's dashes.
        const dz = beachZ + ROAD * 0.5, dashes: THREE.BufferGeometry[] = [];
        for (let x = ax + 0.4; x < bx - 0.4; x += 0.9) dashes.push(new THREE.PlaneGeometry(0.45, 0.06).rotateX(-Math.PI / 2).translate(x, 0.062, dz));
        if (dashes.length) { const dm = mergeGeometries(dashes); dashes.forEach(q => q.dispose()); if (dm) add(dm, paintM); }
      }
    }
    // Palms: a leaning, ringed trunk, drooping fronds and coconuts.
    const palmLeaf = own(std("#3fae5a", { roughness: 0.9, flatShading: true }));
    fx.sway(palmLeaf, 0.9, 0.06);
    // Palms: the hand-drawn palm (trees.ts), a little taller or shorter each.
    const palm = (x: number, z: number, h: number, lean: number) => { blob(x, z, 0.5, 0.08); nature.tree("palm", x, 0.08, z, h / 2.1, Math.round(x * 13 + z * 7 + lean * 10)); };
    void palmLeaf;
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
      const hx = x0 + span * 0.28, hz = beachZ - 1.2;
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
    // The superyacht: once the town is a Metropolis, a big white yacht anchors in the bay:
    // a long sleek hull, three decks with dark glass, a sun deck with a pool, a helipad at
    // the stern, a radar mast, and a tender boat alongside.
    if ((cafe.rank ?? 0) >= 5) {
      const zy = zShore - 2.9, [yx0, yx1] = seaXs(zy), yl = Math.min(7, (yx1 - yx0) * 0.45);
      const yacht = new THREE.Group(), Y = (geo: THREE.BufferGeometry, mat: THREE.Material) => { yacht.add(new THREE.Mesh(geo, mat)); };
      const white = mats.c("#fbfbff", 0.35, 0.1), navy = mats.c("#1e2a4a", 0.3, 0.3), tint = own(std("#26344f", { roughness: 0.08, metalness: 0.6, emissive: new THREE.Color("#2a4a7a"), emissiveIntensity: 0.15 })), teak = mats.c("#c89a62", 0.7);
      // Hull: a long box tapering to a pointed bow, navy below the waterline stripe.
      const hs = new THREE.Shape([new THREE.Vector2(-yl / 2, -0.55), new THREE.Vector2(yl * 0.28, -0.55), new THREE.Vector2(yl / 2, 0), new THREE.Vector2(yl * 0.28, 0.55), new THREE.Vector2(-yl / 2, 0.55)]);
      Y(new THREE.ExtrudeGeometry(hs, { depth: 0.45, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, -0.15, 0), white);
      Y(new THREE.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: false }).rotateX(-Math.PI / 2).scale(1.01, 1, 1.02).translate(0, -0.2, 0), navy);
      Y(new THREE.ExtrudeGeometry(hs, { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2).scale(0.96, 1, 0.92).translate(0, 0.36, 0), teak);
      // Decks, each shorter, set back from the bow, with a band of dark glass.
      [[yl * 0.62, 0.92, 0.38, -yl * 0.08], [yl * 0.44, 0.82, 0.34, -yl * 0.12], [yl * 0.26, 0.7, 0.3, -yl * 0.14]].forEach(([w, d, h, x], i) => {
        const yb = 0.38 + i * 0.36;
        Y(new THREE.BoxGeometry(w, h, d).translate(x, yb + h / 2, 0), white);
        Y(new THREE.BoxGeometry(w * 0.92, h * 0.5, d + 0.02).translate(x + w * 0.02, yb + h * 0.55, 0), tint);
        Y(new THREE.BoxGeometry(w + 0.08, 0.04, d + 0.1).translate(x, yb + h + 0.02, 0), white);
      });
      // Sun deck: a pool with loungers, and a helipad at the stern.
      Y(new THREE.BoxGeometry(0.7, 0.03, 0.5).translate(yl * 0.18, 0.39, 0), water);
      for (const zz of [-0.32, 0.32]) Y(new THREE.BoxGeometry(0.3, 0.05, 0.12).translate(yl * 0.32, 0.41, zz), white);
      Y(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20).translate(-yl * 0.42, 0.4, 0), mats.c("#3a4560", 0.6));
      Y(new THREE.TorusGeometry(0.3, 0.025, 4, 20).rotateX(Math.PI / 2).translate(-yl * 0.42, 0.43, 0), mats.c("#ffd23a", 0.5));
      // Radar mast with a light, and a tender boat tied alongside.
      Y(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6).translate(-yl * 0.12, 1.8, 0), white);
      Y(new THREE.BoxGeometry(0.5, 0.04, 0.06).translate(-yl * 0.12, 2.05, 0), white);
      Y(new THREE.SphereGeometry(0.06, 8, 6).translate(-yl * 0.12, 2.24, 0), lampMat);
      Y(new THREE.BoxGeometry(0.9, 0.18, 0.34).translate(-yl * 0.05, -0.05, 0.9), mats.c("#ffffff", 0.4));
      Y(new THREE.BoxGeometry(0.3, 0.12, 0.24).translate(-yl * 0.1, 0.1, 0.9), navy);
      yacht.position.set(yx0 + (yx1 - yx0) * 0.38, 0.08, zy);
      yacht.userData.dynamic = true;
      g.add(yacht);
      townTicks.push(t => { yacht.position.y = 0.08 + Math.sin(t * 0.6) * 0.04; yacht.rotation.z = Math.sin(t * 0.45) * 0.015; });
      yachtAt = { x: yacht.position.x, z: zy };
    }
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
    sightAt(lx, lz, 3.2, "lighthouse", "town-lighthouse");
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
      // Fireworks: every night with the Fireworks decoration, and on Friday and Saturday
      // nights for everyone (the weekend show).
      if (HAS_CITY || decor.has("fireworks")) {
        const always = decor.has("fireworks");
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
            q.pts.visible = night > 0.5 && ph < 0.75 && (always || isWeekendNight());
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
    // ---- Beach life: swimmers, sunbathers, a volleyball game, dolphins and a bottle ----
    const skinC = ["#f2c7a0", "#c98d5e", "#8a5a3a", "#f5d6b8", "#a86e48"], suitC = ["#ff5f6d", "#2f6fff", "#ffd23f", "#3fd18a", "#b48cff", "#ff8a3d"];
    const lifeG = new THREE.Group(); lifeG.userData.dynamic = true; g.add(lifeG);
    /** A little person standing (the town's crowd scale): legs, a swimsuit body, arms, a head. */
    // (Each person is one mesh with painted colours, plus two arms when they move: a handful
    // of draws for the whole beach.)
    const pplM = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    const person = (n: number, arms = true): THREE.Group => {
      const pg = new THREE.Group(), skC = skinC[n % skinC.length], suC = suitC[n % suitC.length], hairC = ["#3a2418", "#d8b060", "#1a1410", "#8a4a20"][n % 4];
      const parts = [
        paintGeo(new THREE.CylinderGeometry(0.025, 0.022, 0.2, 5).translate(-0.035, 0.1, 0), skC),
        paintGeo(new THREE.CylinderGeometry(0.025, 0.022, 0.2, 5).translate(0.035, 0.1, 0), skC),
        paintGeo(new THREE.CapsuleGeometry(0.06, 0.12, 2, 6).translate(0, 0.28, 0), suC),
        paintGeo(new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.47, 0), skC),
        paintGeo(new THREE.SphereGeometry(0.062, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.48, -0.005), hairC),
      ];
      if (!arms) for (const dx of [-1, 1]) parts.push(paintGeo(new THREE.CylinderGeometry(0.018, 0.016, 0.17, 5).translate(dx * 0.08, 0.275, 0), skC));
      const body = mergeGeometries(parts.map(q => (q.index ? q.toNonIndexed() : q)));
      parts.forEach(q => q.dispose());
      if (body) pg.add(new THREE.Mesh(body, pplM));
      if (arms) for (const dx of [-1, 1]) { const arm = new THREE.Mesh(paintGeo(new THREE.CylinderGeometry(0.018, 0.016, 0.17, 5).translate(0, -0.085, 0), skC), pplM); arm.position.set(dx * 0.08, 0.36, 0); arm.name = dx < 0 ? "armL" : "armR"; pg.add(arm); }
      return pg;
    };

    // Swimmers in the shallows: heads and shoulders above the water, arms paddling; one on a ring.
    const swimmers: { o: THREE.Group; x: number; z: number; k: number }[] = [];
    for (let k = 0; k < 5; k++) {
      const z = zShore - 0.55 - (k % 3) * 0.45, [sa, sb] = seaXs(z), x = sa + 0.8 + ((k * 0.37 + 0.15) % 1) * Math.max(0.5, sb - sa - 1.6);
      const o = person(k + 2);
      if (k === 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16).rotateX(Math.PI / 2).translate(0, 0.3, 0), mats.c("#ff6fa0", 0.4)); o.add(ring); }
      o.position.set(x, -0.26, z); o.rotation.y = k;
      lifeG.add(o); swimmers.push({ o, x, z, k });
    }
    // Sunbathers lying on towels.
    for (let k = 0; k < 3; k++) {
      const tx = x0 + span * (0.12 + k * 0.33) + 0.55, tz = zs + 0.35;
      add(new THREE.BoxGeometry(0.3, 0.012, 0.62).translate(tx, 0.085, tz), mats.c(stripes[(k + 3) % stripes.length], 0.85));
      const o = person(k, false);
      o.rotation.x = -Math.PI / 2; o.position.set(tx, 0.13, tz + 0.22);
      lifeG.add(o);
    }
    // Beach volleyball: a net, two players and a ball flying back and forth.
    const vx = x0 + span * 0.78, vz = zs + 0.05;
    for (const dz of [-0.75, 0.75]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6).translate(vx, 0.5, vz + dz), mats.c("#f4f4f4", 0.5));
    { const netM = own(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.8 })); const net = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28).rotateY(Math.PI / 2).translate(vx, 0.76, vz), netM); net.userData.dynamic = true; lifeG.add(net); }
    const vp1 = person(1), vp2 = person(4);
    vp1.position.set(vx - 0.9, 0.08, vz + 0.1); vp1.rotation.y = Math.PI / 2;
    vp2.position.set(vx + 0.9, 0.08, vz - 0.15); vp2.rotation.y = -Math.PI / 2;
    lifeG.add(vp1, vp2);
    const vball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mats.c("#fff6d0", 0.5));
    lifeG.add(vball);
    // Dolphins leaping out at sea, now and then.
    const dolphinM = mats.c("#7d93b2", 0.35, 0.1), dolphins: THREE.Group[] = [];
    for (let k = 0; k < 2; k++) {
      const d = new THREE.Group();
      d.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8).scale(2.4, 0.8, 0.8), dolphinM));
      d.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6).translate(0.02, 0.17, 0), dolphinM));
      d.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6).rotateZ(Math.PI / 2).translate(0.46, 0, 0), dolphinM));
      d.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.26).translate(-0.4, 0, 0), dolphinM));
      d.visible = false; lifeG.add(d); dolphins.push(d);
    }
    const dz0 = zShore - 3.0, [dx0, dx1] = seaXs(dz0);
    const splashM = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    const splash = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 20).rotateX(-Math.PI / 2), splashM);
    splash.position.y = 0.06; lifeG.add(splash);
    // The message in a bottle: it floats in to the waterline and bobs there until it's tapped.
    const bottle = new THREE.Group();
    bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 12).rotateZ(Math.PI / 2), own(new THREE.MeshStandardMaterial({ color: 0x7fe0b0, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.2 }))));
    bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.1, 10).rotateZ(Math.PI / 2).translate(0.17, 0, 0), own(new THREE.MeshStandardMaterial({ color: 0x7fe0b0, transparent: true, opacity: 0.7, roughness: 0.1 }))));
    bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8).rotateZ(Math.PI / 2).translate(0.24, 0, 0), mats.c("#a06a3a", 0.8)));
    bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8).rotateZ(Math.PI / 2), mats.c("#f6ecd0", 0.9)));
    const bgx = x0 + span * 0.35, bgz = zShore - 0.15;
    bottleSpot = { x: bgx, z: bgz };
    bottle.position.set(bgx, 0.05, bgz); bottle.visible = false; bottle.userData.dynamic = true;
    lifeG.add(bottle);
    let bottleIn = 0;
    const beachLife = (t: number, live?: BizLive) => {
      for (const sw of swimmers) {
        sw.o.position.set(sw.x + Math.sin(t * 0.15 + sw.k) * 0.5, -0.26 + Math.sin(t * 1.6 + sw.k * 1.3) * 0.03, sw.z + Math.cos(t * 0.12 + sw.k) * 0.2);
        sw.o.rotation.y = sw.k + Math.sin(t * 0.15 + sw.k) * 0.6;
        const aL = sw.o.getObjectByName("armL"), aR = sw.o.getObjectByName("armR");
        if (aL && aR) { aL.rotation.x = Math.sin(t * 3 + sw.k) * 1.2 - 1.2; aR.rotation.x = Math.sin(t * 3 + sw.k + Math.PI) * 1.2 - 1.2; }
      }
      // Volleyball: the ball arcs over the net; the hitter's arms go up as it comes.
      const vp = (t * 0.55) % 2, fwd = vp < 1, k = fwd ? vp : 2 - vp;
      vball.position.set(vx - 0.85 + 1.7 * k, 0.62 + Math.sin(k * Math.PI) * 0.85, vz - 0.02 + Math.sin(k * Math.PI) * 0.05);
      for (const [pp, near] of [[vp1, !fwd && k < 0.25], [vp2, fwd && k > 0.75]] as [THREE.Group, boolean][]) {
        const aL = pp.getObjectByName("armL"), aR = pp.getObjectByName("armR");
        if (aL && aR) { const up = near ? Math.PI * 0.9 : 0.2; aL.rotation.z = up * -1; aR.rotation.z = up; }
        pp.position.y = 0.08 + (near ? Math.abs(Math.sin(t * 8)) * 0.06 : 0);
      }
      // Dolphins: a pair leaps in an arc every 11 seconds, a splash where they land.
      const cyc = t % 11, jumping = cyc < 1.6;
      dolphins.forEach((d, i) => {
        const p2 = (cyc - i * 0.25) / 1.3;
        d.visible = jumping && p2 > 0 && p2 < 1;
        if (!d.visible) return;
        const seed = Math.floor(t / 11), bx = dx0 + 0.8 + ((seed * 0.618) % 1) * Math.max(0.5, dx1 - dx0 - 2.4);
        d.position.set(bx + p2 * 1.4 + i * 0.3, -0.1 + Math.sin(p2 * Math.PI) * 0.7, dz0 + i * 0.35);
        d.rotation.z = Math.cos(p2 * Math.PI) * 0.9;
        if (i === 0) { splash.position.x = bx + 1.4; splash.position.z = dz0; }
      });
      const sp2 = Math.max(0, Math.min(1, (cyc - 1.3) / 0.8));
      splashM.opacity = cyc > 1.3 && cyc < 2.1 ? (1 - sp2) * 0.7 : 0;
      splash.scale.setScalar(0.6 + sp2 * 1.6);
      // The bottle floats in from further out, then bobs at the waterline.
      if (live?.bottle) {
        bottleIn = Math.min(1, bottleIn + 0.006);
        const e = 1 - Math.pow(1 - bottleIn, 3);
        bottle.visible = true;
        bottle.position.set(bgx + Math.sin(t * 0.7) * 0.06, 0.06 + Math.sin(t * 2.2) * 0.03, bgz - (1 - e) * 2.2);
        bottle.rotation.set(Math.sin(t * 1.7) * 0.25, 0.6 + Math.sin(t * 0.5) * 0.3, Math.sin(t * 2.1) * 0.15);
      } else { bottle.visible = false; bottleIn = 0; }
    };
    beachLive = (t, night, live) => {
      beachLife(t, live);
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
  let plotTop = 1.2, cityStarter: { x: number; z: number } | null = null;
  {
    const { x, z } = cellXZ(PLOT);
    add(roundSlab(C - ROAD * 2 - 0.6, C - ROAD * 2 - 0.6, BLOCK_R - 0.1 - 0.22, 0.06).translate(x, 0.2, z), grass);
    const tx = x + TOWER_AT.x, tz = z + TOWER_AT.z;
    add(new THREE.BoxGeometry(2.6, 0.08, 2.6).translate(tx, 0.25, tz), pave);
    const sc = cafe.starter;
    // (The city game has no stacked towers: the first building is a real apartment house,
    // drawn below once the building kit is ready.)
    if (sc && HAS_CITY) cityStarter = { x: tx, z: tz };
    else if (sc) {
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
  // (The level-up sparkles: shared shapes, one short-lived group per level-up.)
  const boostRingGeo = new THREE.RingGeometry(0.95, 1.2, 40).rotateX(-Math.PI / 2);
  const sparkGeo = new THREE.OctahedronGeometry(0.12, 0);
  const boostFx: { o: THREE.Group; rings: THREE.Mesh[]; sparks: THREE.Mesh[]; mats: THREE.MeshBasicMaterial[]; at: number; big: boolean; par: THREE.Group }[] = [];
  let boostSeen = 0;
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
  /** A building from the model kit on a lot (once the kit is loaded), sized by level: a
   *  house at first, then an office block, then a skyscraper. Its height, or null. */
  /** Every building design standing in the town ("level:design"), for the collection book. */
  const designsSeen = new Set<string>();
  /** What the player's own decorations are built from (placemodels.ts). */
  const placeKit: PlaceKit = {
    c: (c, r = 0.7, m = 0) => mats.c(c, r, m), slab: lotSlab, grass: grass2, pave, stone, wood, water,
    tree: (x, z, s, seed) => new THREE.Mesh(parkTree(x, z, s, seed), natureM),
    // (Kept whole, not merged with the town: the Blender model's baked shading is in its
    // vertex colours, which a merge would drop.)
    kit: (name, w) => { const m = kitPlace(name, w); if (m) m.obj.userData.dynamic = true; return m; },
    tick: f => { townTicks.push(f); },
  };
  const houseKit: HouseKit = { c: (c, r = 0.7, m = 0) => mats.c(c, r, m), win: winMat };
  /** A building on a lot, drawn in code (houses.ts), sized by level: a house at first, then a
   *  shop or terrace, flats, an office block, then a skyscraper. Its height. */
  const kitBuilding = (lg: THREE.Group, seed: number, level: number, at?: [number, number]): number | null => {
    const sv = Math.abs(seed) >>> 0;
    const K = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
    K(lotSlab(), level <= 2 ? grass2 : plazaM);
    K(new THREE.BoxGeometry(4.0, 0.03, 0.8).translate(0, 0.07, 1.6), pave);
    const nb = new NatureBatch();
    if (level <= 2) {
      // A garden: a tree at the back, bushes and a flower bed (drawn in code, one mesh).
      const tk = (["oak", "maple", "cherry", "apple"] as TreeKind[])[sv % 4];
      nb.tree(tk, sv % 2 ? -1.55 : 1.55, 0.06, -1.5, 0.66, sv, false);
      nb.garden(sv % 3 ? "bush" : "flowerbush", sv % 2 ? 1.6 : -1.6, 0.06, -1.25, 1.3, sv);
      nb.garden("bush", sv % 2 ? 1.6 : -1.6, 0.06, 0.95, 1.4, sv + 1);
      nb.garden("hedge", 0, 0.06, 1.85, 1.0, sv, 0);
    } else for (const tx of [-1.75, 1.75]) nb.garden("topiary", tx, 0.06, 1.75, 1.3, sv);
    const nm = nb.mesh(); if (nm) lg.add(nm);
    const hg = new THREE.Group();
    const h = buildHouse(hg, sv, level, houseKit, 0.06, at);
    if (level >= 1 && level <= 5) designsSeen.add(`${level}:${houseDesign(sv, level, at)}`);
    hg.rotation.y = level <= 2 ? 0 : ((sv >> 3) % 4) * (Math.PI / 2);
    lg.add(hg);
    return h + 0.1;
  };
  const propBuilding = (lg: THREE.Group, seed: number, level: number, key: string): number => {
    // (Every property has a design of its own for every size: see propgen.ts.)
    let hsh = 0; for (const ch of key) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const m = /(-?\d+),(-?\d+)$/.exec(key), at: [number, number] | undefined = m ? [Number(m[1]), Number(m[2])] : undefined;
    const top = kitBuilding(lg, hsh + seed, level, at) ?? genBuilding(lg, hsh + seed, level, genKit);
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

  // The city game's first building: an apartment house on the plot, with a flag on the roof.
  if (cityStarter) {
    const lg = new THREE.Group();
    lg.position.set(cityStarter.x, 0.29, cityStarter.z); lg.scale.setScalar(0.72);
    g.add(lg);
    const top = propBuilding(lg, 5, 3, "starter") * 0.72 + 0.29;
    plotTop = top;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(cityStarter.x, top + 0.45, cityStarter.z), metal);
    add(new THREE.BoxGeometry(0.5, 0.3, 0.03).translate(cityStarter.x + 0.25, top + 0.72, cityStarter.z), mats.sign("#ff4f8b"));
  }

  // ---- Neighbors: the homes and corner shops on the lots no business has yet ----
  const HOUSE = ["#fff1e0", "#e9f3ff", "#ffe8ef", "#eefbe8", "#fff7d6", "#f1ebff"];
  const ROOF = ["#d9534a", "#5a6fd0", "#e07a9a", "#4f9a5a", "#b8683a", "#7a5ad0"];
  const BRICK = ["#c9775a", "#d89a6a", "#b5655a", "#e0b48a", "#9a7ad0", "#6a9ad0"];
  const neighborhood = (G: THREE.Group, i: number, tall = 0): number => {
    const kb = kitBuilding(G, i * 31 + 7, tall ? 3 : 1 + (i % 3 === 2 ? 2 : 0), [i, 0]);
    if (kb !== null) return kb;
    const K = (geo: THREE.BufferGeometry, m: THREE.Material) => G.add(new THREE.Mesh(geo, m));
    const r = (k: number) => ((i * 7 + k * 13) % 6);
    // Ground: a small front lawn and a paved yard.
    K(lotSlab(), grass2);
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
    // (The town fills in from its middle: the nearest blocks are built first.)
    const homeOrder = new Map<number, number>();
    {
      const mid = cellXZ(PLAZA);
      NEIGH.map((c, k) => ({ k, d: Math.hypot(cellXZ(c).x - mid.x, cellXZ(c).z - mid.z) })).filter(o => !NEIGH_PARK.has(`${NEIGH[o.k][0]},${NEIGH[o.k][1]}`)).sort((a, b) => a.d - b.d).forEach((o, i) => homeOrder.set(o.k, i));
    }
    NEIGH.forEach((cell, k) => {
      const { x, z } = cellXZ(cell), lg = new THREE.Group();
      lg.position.set(x, 0.2, z);
      // Face the nearer street toward the middle of the screen, like the business lots.
      lg.rotation.y = cell[0] < cell[1] ? Math.PI / 2 : 0;
      ng.add(lg);
      if (NEIGH_PARK.has(`${cell[0]},${cell[1]}`)) {
        const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
        P(lotSlab(), k % 2 ? grass : grass2);
        P(ribbon(sPath(1.9, k % 2 === 1), 0.55, 0.075), pave);
        P(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20).translate(0.9, 0.08, -0.9), water);
        P(new THREE.TorusGeometry(0.72, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0.9, 0.1, -0.9), stone);
        for (const [tx, tz, ts] of [[-1.3, -1.2, 1], [1.3, 1.0, 0.9], [-1.4, 1.4, 0.8], [0.2, -1.6, 0.7]]) {
          P(parkTree(tx, tz, 0.78 * ts, tx * 7 + tz * 13 + k), natureM);
        }
        P(new THREE.BoxGeometry(0.7, 0.06, 0.22).translate(-0.4, 0.42, 0.4), wood);
        P(new THREE.BoxGeometry(0.7, 0.2, 0.05).translate(-0.4, 0.55, 0.3), wood);
        for (let f = 0; f < 6; f++) P(new THREE.SphereGeometry(0.08, 6, 4).translate(0.4 + f * 0.2, 0.12, 1.6), mats.c(flowersOn[(f + k) % 4], 0.8));
      } else if (homeOrder.get(k)! < (cafe.homes ?? 999) || cafe.props?.[`t:${cell[0]},${cell[1]}`]) {
        // A property (data/props.ts): it grows with its level.
        const key = `t:${cell[0]},${cell[1]}`;
        homeAt(x, z, propBuilding(lg, 20 + k, propLv(key), key), key);
      } else {
        // Not built yet: an empty lot of grass with a couple of young trees, waiting for the
        // town to grow out to it.
        const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
        P(lotSlab(), grass2);
        snowSpots.push([x + 0.2, 0.26, z - 0.2]);
        for (const [tx, tz] of [[-1.3, -1.1], [1.2, 1.3]]) {
          P(parkTree(tx, tz, 0.45, tx * 5 + tz * 11 + k), natureM);
        }
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
      for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const o of [sx + sz > 0 ? 1.1 : -1.1]) {
        const tx = x + sx * 2.33 + (sz ? o : 0), tz = z + sz * 2.33 + (sx ? o : 0);
        ng.add(new THREE.Mesh(parkTree(tx, tz, 0.55, tx * 3 + tz * 7, 0.2), natureM));
      }
    });
    bendTown(ng, bendPts);
    mergeStatic(ng, 0.2);
  }
  let growSpot: { x: number; z: number; zoom: number } | null = null;
  // The city grid's blocks: a building on each (rising with the city's rank, tallest nearest
  // the middle), a little park now and then, and the City Hall's square.
  if (outer.length) {
    const og = new THREE.Group();
    g.add(og);
    const fresh = gridShown > 0 && outer.length > gridShown ? gridShown : outer.length, t0g = performance.now();
    outer.forEach((cell, k) => {
      const { x, z } = cellXZ(cell), lg = new THREE.Group();
      lg.position.set(x, 0.2, z);
      lg.rotation.y = cell[0] < cell[1] ? Math.PI / 2 : 0;
      og.add(lg);
      if (k >= fresh) {
        // Just built (the city grew): it rises up out of the ground with a little bounce.
        lg.userData.dynamic = true;
        lg.scale.y = 0.001;
        const delay = (k - fresh) * 180;
        townTicks.push(() => {
          const e = (performance.now() - t0g - delay) / 900;
          if (e < 0) return;
          if (e >= 1) { if (lg.scale.y !== 1) lg.scale.y = 1; return; }
          lg.scale.y = Math.max(0.001, 1 - Math.pow(1 - e, 3) + Math.sin(e * Math.PI) * 0.12);
        });
      }
      if (hallAt && Math.abs(hallAt.x - x) < 0.1 && Math.abs(hallAt.z - z) < 0.1) return;
      const h = Math.abs(cell[0] * 73856093 ^ cell[1] * 19349663);
      const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
      if (h % 6 === 0) {
        P(lotSlab(), k % 2 ? grass : grass2);
        P(ribbon(sPath(1.9, k % 2 === 1), 0.55, 0.075), pave);
        P(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20).translate(0.9, 0.08, -0.9), water);
        P(new THREE.TorusGeometry(0.72, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0.9, 0.1, -0.9), stone);
        for (const [tx, tz, ts] of [[-1.3, -1.2, 1], [1.3, 1.0, 0.9], [-1.4, 1.4, 0.8], [0.2, -1.6, 0.7]]) {
          P(parkTree(tx, tz, 0.78 * ts, tx * 7 + tz * 13 + k), natureM);
        }
        P(new THREE.BoxGeometry(0.7, 0.06, 0.22).translate(-0.4, 0.42, 0.4), wood);
        for (let f = 0; f < 6; f++) P(new THREE.SphereGeometry(0.08, 6, 4).translate(0.4 + f * 0.2, 0.12, 1.6), mats.c(flowersOn[(f + k) % 4], 0.8));
        sightAt(x, z, 1.4, "park", `g${cell[0]},${cell[1]}`);
        return;
      }
      // Every block is a lot you build on: an empty, mown lot with a sold sign at first, then
      // whatever you've built there (little homes up to a glass skyscraper).
      const gkey = `g:${cell[0]},${cell[1]}`;
      const level = Math.max(0, Math.min(5, cafe.props?.[gkey] ?? 0));
      // A decoration the player placed here (logic/placedecor.ts).
      const deco = level === 0 ? cafe.placed?.[gkey] : undefined;
      if (deco) {
        homeAt(x, z, buildPlaced(lg, deco, placeKit, h), gkey);
      } else if (level === 0) {
        P(lotSlab(), grass2);
        P(new THREE.BoxGeometry(1.6, 0.03, 1.6).translate(0, 0.07, 0), mats.c("#c9b48e", 0.95));
        P(new THREE.BoxGeometry(0.05, 0.55, 0.05).translate(-0.9, 0.33, 0.9), wood);
        P(new THREE.BoxGeometry(0.42, 0.26, 0.03).translate(-0.9, 0.62, 0.92), mats.c("#ffffff", 0.7));
        P(new THREE.BoxGeometry(0.36, 0.06, 0.035).translate(-0.9, 0.66, 0.925), mats.c("#3fae6a", 0.7));
        P(parkTree(1.3, -1.2, 0.45, h), natureM);
        homeAt(x, z, 0.5, gkey);
      }
      const btop = level ? kitBuilding(lg, h, level, [cell[0], cell[1]]) : null;
      if (level) homeAt(x, z, btop ?? 1.6 + level * 0.8, gkey);
      if (btop !== null || !level) { /* built above */ }
      else { P(lotSlab(), grass2); P(new THREE.BoxGeometry(2.6, 1.6 + level * 0.8, 2.6).translate(0, 0.8 + level * 0.4, 0), mats.c(["#f2e6d0", "#e8d8f0", "#d8ecf6", "#f6dcd0"][h % 4], 0.7)); }
      // Street life on its sidewalks: trees along the curb, lamps on two corners, a bench
      // and a bin, and now and then a bus stop or a phone box.
      for (const [sx, sz] of [[1, 1], [-1, -1]]) {
        const tx = sx * 2.33, tz = sz * 1.2;
        P(parkTree(tx, tz, 0.55, sx * 3 + sz * 5 + h, 0.05), natureM);
      }
      for (const [sx, sz] of [[1, 1], [-1, -1]]) {
        P(new THREE.CylinderGeometry(0.035, 0.045, 1.4, 6).translate(sx * 2.3, 0.7, sz * 2.3), metal);
        P(new THREE.BoxGeometry(0.06, 0.05, 0.36).translate(sx * 2.3, 1.4, sz * 2.3 - sz * 0.15), metal);
        P(new THREE.SphereGeometry(0.1, 8, 6).translate(sx * 2.3, 1.36, sz * 2.3 - sz * 0.3), lampMat);
      }
      // (The bench faces the street, on the front sidewalk.)
      P(new THREE.BoxGeometry(0.6, 0.05, 0.2).translate(0.7, 0.3, 2.35), wood);
      P(new THREE.BoxGeometry(0.6, 0.18, 0.04).translate(0.7, 0.42, 2.27), wood);
      P(new THREE.CylinderGeometry(0.08, 0.07, 0.26, 8).translate(-0.4, 0.13, 2.4), mats.c("#3f6e58", 0.6));
      if (h % 5 === 1) {
        P(new THREE.BoxGeometry(0.9, 0.05, 0.32).translate(-1.2, 0.85, 2.38), mats.c("#2f9bff", 0.5));
        P(new THREE.BoxGeometry(0.9, 0.6, 0.03).translate(-1.2, 0.5, 2.22), own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, roughness: 0.05 })));
        P(new THREE.BoxGeometry(0.7, 0.05, 0.16).translate(-1.2, 0.3, 2.3), wood);
      } else if (h % 5 === 3) {
        P(new THREE.BoxGeometry(0.26, 0.75, 0.26).translate(-1.2, 0.38, 2.35), mats.c("#d8333f", 0.5));
        P(new THREE.BoxGeometry(0.2, 0.3, 0.02).translate(-1.2, 0.5, 2.49), mats.c("#bfe6ff", 0.2));
      }
    });
    bendTown(og, bendPts);
    mergeStatic(og, 0.2);
    // Where the newest blocks went up (the camera glides there when the city grows).
    if (fresh < outer.length) {
      const nw = outer.slice(fresh).map(c => cellXZ(c)), mx = nw.reduce((a, p) => a + p.x, 0) / nw.length, mz = nw.reduce((a, p) => a + p.z, 0) / nw.length;
      growSpot = { x: mx, z: mz, zoom: 1.1 };
    }
  }
  gridShown = outer.length;

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
        K(lotSlab(), grass2);
        K(new THREE.BoxGeometry(3.2, 0.07, 3.2).translate(0, 0.04, -0.2), earth);
        for (const [sx, sz] of [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.4], [1.6, 1.4]]) K(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(sx, 0.25, sz), wood);
        for (const [sx, sz, w, d] of [[0, -1.8, 3.2, 0.03], [0, 1.4, 3.2, 0.03], [-1.6, -0.2, 0.03, 3.2], [1.6, -0.2, 0.03, 3.2]] as const) K(new THREE.BoxGeometry(w, 0.05, d).translate(sx, 0.42, sz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.08, 1.3, 0.08).translate(0, 0.65, 1.4), pole);
        K(new THREE.BoxGeometry(1.5, 0.8, 0.08).translate(0, 1.4, 1.4), mats.sign("#ff4f6d"));
        K(new THREE.BoxGeometry(1.1, 0.12, 0.09).translate(0, 1.4, 1.42), mats.c("#ffffff"));
        for (const [bx, bz] of [[-1.2, -0.8], [1.1, -1.1]]) K(new THREE.ConeGeometry(0.18, 0.45, 10).translate(bx, 0.25, bz), mats.c("#ff8a3b"));
        K(new THREE.BoxGeometry(0.9, 0.3, 0.5).translate(0.9, 0.15, 0.4), mats.c("#c86a4a"));
        tops[i] = 1.9;
      } else if (HAS_CITY) {
        // Buildaroo: the city starts from almost nothing. A business's lot waits as a mown,
        // empty lot with a little sign until City Hall opens that business.
        K(lotSlab(), grass2);
        K(new THREE.BoxGeometry(2.2, 0.03, 2.2).translate(0, 0.07, -0.2), mats.c("#c9b48e", 0.95));
        K(new THREE.BoxGeometry(0.06, 0.7, 0.06).translate(-1.2, 0.4, 1.3), wood);
        K(new THREE.BoxGeometry(0.6, 0.34, 0.04).translate(-1.2, 0.78, 1.32), mats.c("#ffffff", 0.7));
        K(new THREE.BoxGeometry(0.5, 0.08, 0.045).translate(-1.2, 0.82, 1.33), mats.c("#ff8a3b", 0.7));
        for (const [tx, tz] of [[1.3, -1.3], [1.4, 1.2]]) K(parkTree(tx, tz, 0.45, tx * 5 + tz * 11 + i), natureM);
        tops[i] = 0.9;
      } else if (i % 4 !== 3) {
        // Until the business comes, ordinary neighbors live here: town houses, a block of
        // flats or a corner shop with flats above, so the town looks lived in, like a real city.
        tops[i] = neighborhood(lotG, i);
        bendTown(lotG, bendPts);
        mergeStatic(lotG, 0.05);
        return;
      } else {
        // A little park until the business comes: lawn, a winding path, trees, a bench.
        K(lotSlab(), i % 2 ? grass : grass2);
        K(ribbon(sPath(1.9, i % 2 === 1), 0.55, 0.075), pave);
        for (const [tx, tz, ts] of [[-1.3, -1.2, 1], [1.3, 0.8, 0.9], [-1.4, 1.5, 0.75], [1.4, -1.5, 0.8]]) {
          K(parkTree(tx, tz, 0.78 * ts, tx * 7 + tz * 13 + i), natureM);
        }
        for (let k = 0; k < 5; k++) K(new THREE.SphereGeometry(0.09, 6, 4).translate(0.6 + k * 0.2, 0.12, 1.6), mats.c(flowersOn[(k + i) % 4], 0.8));
        K(new THREE.BoxGeometry(0.7, 0.06, 0.22).translate(0.9, 0.42, -0.1), wood);
        K(new THREE.BoxGeometry(0.7, 0.2, 0.05).translate(0.9, 0.55, -0.2), wood);
        tops[i] = 1.5;
      }
      bendTown(lotG, bendPts);
      mergeStatic(lotG, 0.05);
      return;
    }
    // The lot: a paved forecourt with a strip of lawn round the back.
    lotG.add(new THREE.Mesh(lotSlab(), grass));
    lotG.add(new THREE.Mesh(roundSlab(LOT_W, 2.6, 0.33, 0.07).translate(0, 0, (LOT_W - 2.6) / 2), pave));
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
    if (hqT && !HAS_CITY) {
      // The HQ the player built stands at the back of the lot; the business's own storefront
      // (smaller) stays at the front, so every lot keeps its look.
      const shop = new THREE.Group();
      shop.scale.setScalar(0.62);
      shop.position.set(0, 0, 1.05);
      buildModelStaged(shop, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
      if (keepClear) fitBehind(shop, -0.3);
      lotG.add(shop);
      const n = hqT.b.length, roof = playerTower(lotG, hqT, 0, -1.25, 0.82, Math.min(0.34, 9 / Math.max(1, n)), 0.05);
      // A banner in the business's colors on the roof: this tower is its HQ.
      lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6).translate(0, roof + 0.4, -1.25), metal));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.03).translate(0.24, roof + 0.66, -1.25), mats.sign(lot.c2)));
    } else if (keepClear) {
      const body = new THREE.Group();
      buildModelStaged(body, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
      fitBehind(body, -2.1);
      lotG.add(body);
    } else buildModelStaged(lotG, lot.id, lot.s, lot.c, lot.c2, mats, () => roofProp(lot.id, col(lot.c), col(lot.c2)));
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
    bendTown(lotG, bendPts);
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
  // (People and cars from the model kit: drawn in batches, one per kind.)
  const crowdKit = kitInstancer(life);
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
  const KIT_PEOPLE = ["mini_male_a", "mini_female_a", "mini_male_b", "mini_female_b", "mini_male_c", "mini_female_c", "mini_male_d", "mini_female_d", "mini_male_e", "mini_female_e", "mini_male_f", "mini_female_f"];
  let kitPersonN = 0;
  const makePerson = (c: string) => {
    // (From the model kit once it's loaded: twelve different people, men and women.)
    const pn = KIT_PEOPLE[kitPersonN++ % KIT_PEOPLE.length], kp = crowdKit.proxy(pn, 0.66, true) ?? kitPlaceH(pn, 0.66)?.obj;
    if (kp) { const p = new THREE.Group(); p.add(kp); p.userData.person = true; return p; }
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
  // How busy the streets are follows how many people live in town (each home you build
  // and grow brings more): 0 in an empty town, 1 once a couple of thousand live here.
  const townPeople = Object.values(cafe?.props ?? {}).reduce((a, l) => a + (PROP_PEOPLE[Math.max(0, Math.min(5, l))] ?? 0), 0);
  const busy = Math.max(0, Math.min(1, townPeople / 1500));
  const walkers = Array.from({ length: Math.round(8 + busy * 22) }, (_, k) => { const p = makePerson(shirts[k % shirts.length]); life.add(p); return { p, u: (k * 0.618) % 1, v: (k % 2 ? 1 : -1) * (0.012 + (k % 5) * 0.003) }; });
  const crowd = Array.from({ length: 10 }, (_, k) => { const p = makePerson(shirts[(k + 3) % shirts.length]); p.visible = false; life.add(p); return p; });
  // A queue at the door of the busiest businesses: longer the bigger the business and the
  // more people live in town.
  const queues: { id: string; i: number; ps: THREE.Object3D[] }[] = [];
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
  for (const { l, i } of [...shopLots].sort((a, b) => b.l.s - a.l.s).slice(0, 4)) {
    const n = Math.min(5, Math.round((1 + l.s) * (0.35 + busy * 0.75)));
    if (n < 1) continue;
    queues.push({ id: l.id, i, ps: Array.from({ length: n }, (_, k) => { const p = makePerson(shirts[(k * 2 + i) % shirts.length]); life.add(p); return p; }) });
  }
  const shoppers: Shopper[] = Array.from({ length: Math.min(Math.round(12 + busy * 16), shopLots.length * 5) }, (_, k) => {
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
  // The town's traffic: everyday cars mostly, with taxis, vans, delivery trucks, a bin lorry,
  // and now and then an ambulance or a fire engine (Kenney Car Kit, see kit/NOTICE.md).
  const KIT_CARS = ["sedan", "taxi", "suv", "van", "sedan_sports", "delivery_flat", "hatchback_sports", "police_car", "suv_luxury", "garbage_truck",
    "sedan", "taxi", "delivery_van", "truck", "suv", "ambulance", "sedan_sports", "truck_flat", "taxi", "firetruck"];
  const BIG_CARS = new Set(["truck", "truck_flat", "garbage_truck", "firetruck", "delivery_flat", "ambulance"]);
  let carN = 0;
  const makeCar = (c: string, van: boolean) => {
    const v = new THREE.Group();
    const kn = KIT_CARS[carN++ % KIT_CARS.length];
    const kc = crowdKit.proxy(kn, BIG_CARS.has(kn) ? 1.12 : van ? 1.0 : 0.92, false);
    if (kc) { v.add(kc); life.add(v); return v; }
    v.add(new THREE.Mesh(carGeo(c, van), carM));
    life.add(v);
    return v;
  };
  /** A city bus: long and bright, windows all along, a lit route sign, and a roof unit. */
  const signMat = own(std("#ffb13b", { emissive: 0xffa020, emissiveIntensity: 0.9 }));
  signMat.userData.dynamic = true;
  const makeBus = (k: number) => {
    const v = new THREE.Group(), col = ["#e8423c", "#2f7fd8", "#f2a62a"][k % 3];
    // (One mesh per material, so a bus is a handful of draws, not a dozen.)
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const put = (geo: THREE.BufferGeometry, m: THREE.Material) => { const a = parts.get(m) ?? []; a.push(geo.index ? geo.toNonIndexed() : geo); parts.set(m, a); };
    const B = (w: number, h: number, d: number, y: number, z: number, m: THREE.Material) => put(new THREE.BoxGeometry(w, h, d).translate(0, y, z), m);
    const dark = mats.c("#2a2f3a", 0.6);
    B(0.46, 0.4, 1.5, 0.32, 0, mats.c(col, 0.45));
    B(0.47, 0.16, 1.42, 0.4, 0, winMat);
    B(0.47, 0.1, 1.51, 0.16, 0, dark);
    B(0.44, 0.03, 1.46, 0.535, 0, mats.c("#f4efe6", 0.5));
    B(0.3, 0.07, 0.5, 0.58, -0.2, mats.c("#d8dde6", 0.5, 0.3));
    B(0.4, 0.2, 0.02, 0.39, 0.755, winMat);
    B(0.3, 0.06, 0.02, 0.5, 0.765, signMat);
    for (const z of [-0.48, 0.48]) for (const x of [-0.23, 0.23]) put(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10).rotateZ(Math.PI / 2).translate(x, 0.1, z), dark);
    for (const [m, geos] of parts) { const g = mergeGeometries(geos); geos.forEach(q => q.dispose()); if (g) v.add(new THREE.Mesh(g, m)); }
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
  const isRound = (i: number, j: number) => roundKeep(i - 1, j - 1) && cellIn(i - 1, j - 1) && cellIn(i, j - 1) && cellIn(i - 1, j) && cellIn(i, j) && exits(i, j).length === 4;
  const LANE = 0.6, END = ROAD + 0.25;
  const rightOf = (d: [number, number]) => new THREE.Vector3(-d[1], 0, d[0]);
  const dv = (d: [number, number]) => new THREE.Vector3(d[0], 0, d[1]);
  /** Moves a point on the streets along with the curving avenues. */
  const bendV = (v: THREE.Vector3) => { const [dx, dz] = bendD(v.x, v.z); v.x += dx; v.z += dz; return v; };
  const bez = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3): Seg => ({ a, b, c, len: a.distanceTo(c) + c.distanceTo(b) * 0.98 });
  const street = (i: number, j: number, d: [number, number], lane = LANE): Seg => {
    const A = nodeXZ(i, j), B = nodeXZ(i + d[0], j + d[1]), r = rightOf(d).multiplyScalar(lane), D = dv(d).multiplyScalar(lane > 0.6 ? lane : END);
    const a = A.clone().add(D).add(r), b = B.clone().sub(D).add(r);
    // (Along a curving avenue the lane bows with it: the curve's middle sits where the
    // street's middle has moved to.)
    const mid = a.clone().lerp(b, 0.5), [mx, mz] = bendD(mid.x, mid.z);
    mid.x += mx; mid.z += mz;
    bendV(a); bendV(b);
    return bez(a, mid.multiplyScalar(2).sub(a.clone().add(b).multiplyScalar(0.25)).sub(a.clone().add(b).multiplyScalar(0.25)), b);
  };
  const nodes: [number, number][] = [];
  for (const [x, z] of ALL) for (const [i, j] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] as [number, number][]) if (exits(i, j).length && !nodes.some(n => n[0] === i && n[1] === j)) nodes.push([i, j]);
  const starts: { i: number; j: number; d: [number, number] }[] = [];
  for (const [i, j] of nodes) for (const d of exits(i, j)) starts.push({ i, j, d });
  const nCars = Math.min(Math.round(5 + busy * 11), starts.length);
  // (At rush hour a few more cars join in: they wait, hidden, the rest of the day.)
  const nRush = HAS_CITY ? Math.min(Math.round(3 + busy * 5), Math.max(0, starts.length - nCars)) : 0;
  const traffic = starts.length ? Array.from({ length: nCars + nRush }, (_, k) => {
    const rush = k >= nCars, st0 = starts[rush ? Math.floor(((k - nCars + 0.5) * starts.length) / Math.max(1, nRush) + 1) % starts.length : Math.floor((k * starts.length) / nCars)];
    const v = makeCar(BODY[(k + 5) % BODY.length], k % 4 === 1);
    return { v, i: st0.i, j: st0.j, d: st0.d, seg: street(st0.i, st0.j, st0.d), turn: false, u: (k % 3) * 0.3, sp: 1.15 + (k % 4) * 0.15, wait: 0, ahead: new THREE.Vector3(), lane: LANE, big: false, rush };
  }) : [];
  // City buses: the first once the town has a few hundred people, more as it fills up. They
  // go slower than the cars, and the cars keep a longer gap behind them.
  const nBus = !starts.length || !HAS_CITY ? 0 : busy > 0.9 ? 3 : busy > 0.6 ? 2 : busy > 0.25 ? 1 : 0;
  for (let k = 0; k < nBus; k++) {
    const st0 = starts[Math.floor(((k + 0.5) * starts.length) / nBus + 3) % starts.length];
    traffic.push({ v: makeBus(k), i: st0.i, j: st0.j, d: st0.d, seg: street(st0.i, st0.j, st0.d), turn: false, u: 0.5, sp: 0.85, wait: 0, ahead: new THREE.Vector3(), lane: LANE, big: true, rush: false });
  }
  const segAt = (sg: Seg, u: number, out: THREE.Vector3, dir: THREE.Vector3) => {
    const m = 1 - u;
    out.set(m * m * sg.a.x + 2 * m * u * sg.c.x + u * u * sg.b.x, 0.04, m * m * sg.a.z + 2 * m * u * sg.c.z + u * u * sg.b.z);
    dir.set(2 * m * (sg.c.x - sg.a.x) + 2 * u * (sg.b.x - sg.c.x), 0, 2 * m * (sg.c.z - sg.a.z) + 2 * u * (sg.b.z - sg.c.z)).normalize();
  };
  /** At the end of a street: pick the next one (never back the way it came unless it must,
   *  and only right or straight on at a roundabout), and the curve through the crossing. */
  const nextLeg = (c: { i: number; j: number; d: [number, number]; lane: number }, choose?: (opts: [number, number][], i: number, j: number) => [number, number] | undefined) => {
    const L = c.lane, E = L > 0.6 ? L : END, foot = L > 0.6;
    const i = c.i + c.d[0], j = c.j + c.d[1], back: [number, number] = [-c.d[0], -c.d[1]];
    const r = rightOf(c.d);
    let opts = exits(i, j).filter(e => !(e[0] === back[0] && e[1] === back[1]));
    if (!foot && isRound(i, j)) opts = opts.filter(e => !(e[0] === -r.x && e[1] === -r.z));
    const d2 = (choose ? choose(opts, i, j) : undefined) ?? (opts.length ? opts[Math.floor(Math.random() * opts.length)] : back);
    const B = nodeXZ(i, j), r2 = rightOf(d2);
    const a = B.clone().sub(dv(c.d).multiplyScalar(E)).add(r.clone().multiplyScalar(L));
    const b = B.clone().add(dv(d2).multiplyScalar(E)).add(r2.clone().multiplyScalar(L));
    let ctl: THREE.Vector3;
    if (d2[0] === c.d[0] && d2[1] === c.d[1]) ctl = foot ? a.clone().lerp(b, 0.5) : B.clone().add(r.clone().multiplyScalar(isRound(i, j) ? 1.6 : L));
    else if (d2 === back) ctl = B.clone().add(dv(c.d).multiplyScalar(foot ? 0 : 0.7));
    else ctl = B.clone().add(r.clone().multiplyScalar(L)).add(r2.clone().multiplyScalar(L));
    c.i = i; c.j = j; c.d = d2;
    const [ax, az] = bendD(a.x, a.z), [bx, bz] = bendD(b.x, b.z);
    a.x += ax; a.z += az; b.x += bx; b.z += bz; ctl.x += (ax + bx) / 2; ctl.z += (az + bz) / 2;
    return bez(a, ctl, b);
  };
  // People out for a walk on the town's inner sidewalks (crossing at the zebras).
  const FOOT = ROAD + 0.32;
  const strollers = starts.length ? Array.from({ length: 12 }, (_, k) => {
    const st0 = starts[Math.floor((k * 7 + 3) % starts.length)], p = makePerson(shirts[(k + 2) % shirts.length]);
    life.add(p);
    return { p, i: st0.i, j: st0.j, d: st0.d, seg: street(st0.i, st0.j, st0.d, FOOT), turn: false, u: (k % 5) * 0.2, sp: 0.32 + (k % 4) * 0.05, lane: FOOT, ph: k * 1.7 };
  }) : [];
  // The holiday parade's route (render3d/parade.ts): a long walk through the town's streets,
  // near the middle of the road, straight on where it can, never down the same street twice.
  // Tried from every street end: of the walks long enough, the one that keeps nearest the
  // middle of town wins (where the player looks), else the longest.
  const PARADE_LANE = 0.32;
  const paradeRoute = (want: number): THREE.Vector3[] => {
    let best: THREE.Vector3[] = [], bestLen = 0, bestFar = Infinity;
    let mx = 0, mz = 0;
    for (const [i, j] of nodes) { const v = nodeXZ(i, j); mx += v.x / nodes.length; mz += v.z / nodes.length; }
    const sample = (sg: Seg, out: THREE.Vector3[]) => {
      const n = Math.max(3, Math.ceil(sg.len / 0.3)), p = new THREE.Vector3(), d = new THREE.Vector3();
      for (let k = out.length ? 1 : 0; k <= n; k++) { segAt(sg, k / n, p, d); out.push(p.clone()); }
    };
    for (const st0 of starts) {
      const c = { i: st0.i, j: st0.j, d: st0.d, lane: PARADE_LANE }, used = new Set<string>(), pts: THREE.Vector3[] = [];
      const key = (i: number, j: number, d: [number, number]) => { const i2 = i + d[0], j2 = j + d[1]; return i < i2 || (i === i2 && j < j2) ? `${i},${j},${i2},${j2}` : `${i2},${j2},${i},${j}`; };
      let len = 0, ok = true;
      while (ok && len < want) {
        used.add(key(c.i, c.j, c.d));
        const sg = street(c.i, c.j, c.d, PARADE_LANE);
        sample(sg, pts); len += sg.len;
        if (len >= want) break;
        // (Straight on first, then right, then left: only onto streets not walked yet.)
        const d0 = c.d;
        const pick = (opts: [number, number][], i: number, j: number) => {
          const free = opts.filter(e => !used.has(key(i, j, e)));
          const rank = (e: [number, number]) => (e[0] === d0[0] && e[1] === d0[1] ? 0 : e[0] === -d0[1] && e[1] === d0[0] ? 1 : 2);
          free.sort((a, b) => rank(a) - rank(b));
          if (!free.length) ok = false;
          return free[0] ?? opts[0];
        };
        const ni = c.i + d0[0], nj = c.j + d0[1], round = isRound(ni, nj);
        const turn = nextLeg(c, pick);
        if (!ok) break;
        if (!round) { sample(turn, pts); len += turn.len; continue; }
        // (A roundabout: the floats are wide, so they go right round its island on a circle
        // instead of cutting across it.)
        const B = nodeXZ(ni, nj), R = 1.4, d2 = c.d;
        const a = B.clone().sub(dv(d0).multiplyScalar(END)).add(rightOf(d0).multiplyScalar(PARADE_LANE));
        const b = B.clone().add(dv(d2).multiplyScalar(END)).add(rightOf(d2).multiplyScalar(PARADE_LANE));
        const ta = Math.atan2(a.z - B.z, a.x - B.x);
        let tb = Math.atan2(b.z - B.z, b.x - B.x);
        // (Round the way the traffic goes: the circle's direction at the entry matches the street's.)
        const ccw = -Math.sin(ta) * d0[0] + Math.cos(ta) * d0[1] > 0;
        if (ccw) { while (tb <= ta) tb += Math.PI * 2; } else { while (tb >= ta) tb -= Math.PI * 2; }
        const steps = Math.max(4, Math.ceil((Math.abs(tb - ta) * R) / 0.3));
        let prev = pts[pts.length - 1];
        for (let k = 0; k <= steps; k++) {
          const th = ta + ((tb - ta) * k) / steps, q = new THREE.Vector3(B.x + Math.cos(th) * R, 0.04, B.z + Math.sin(th) * R);
          bendV(q);
          len += prev ? prev.distanceTo(q) : 0;
          pts.push(q); prev = q;
        }
      }
      const enough = len >= want * 0.8;
      let far = 0;
      for (const q of pts) far += Math.hypot(q.x - mx, q.z - mz) / pts.length;
      if (enough ? bestLen < want * 0.8 || far < bestFar : len > bestLen && bestLen < want * 0.8) { bestLen = len; best = pts; bestFar = enough ? far : Infinity; }
    }
    return best;
  };
  let paradeQuiet = false;
  const tPos = new THREE.Vector3(), tDir = new THREE.Vector3(), tGap = new THREE.Vector3();
  let rushNow = isRushHour(), rushAt = 0;
  const trafficLive = (dt: number) => {
    const now = performance.now();
    if (now - rushAt > 30e3) { rushAt = now; rushNow = isRushHour(); }
    for (const c of traffic) {
      // (The streets are closed to traffic while the holiday parade goes by.)
      if (paradeQuiet) { c.v.visible = false; continue; }
      if (c.rush) { c.v.visible = rushNow; if (!rushNow) continue; }
      if (!c.v.visible) c.v.visible = true;
      // Wait for the car in front (but never forever, so two cars can't block each other).
      let blocked = false;
      for (const o of traffic) {
        if (o === c || (o.rush && !rushNow)) continue;
        tGap.copy(o.v.position).sub(c.v.position);
        const ahead = tGap.x * c.ahead.x + tGap.z * c.ahead.z, side = Math.abs(tGap.x * c.ahead.z - tGap.z * c.ahead.x);
        if (ahead > 0.05 && ahead < 0.95 + (o.big ? 0.45 : 0) + (c.big ? 0.45 : 0) && side < 0.32) { blocked = true; break; }
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
        else { w.seg = nextLeg(w); w.turn = true; }
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
  if (growSpot) { const gs = growSpot; landmarks[50] = () => gs; }
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
      // (Well above the tallest towers: never brushing a rooftop.)
      const ang = t * (k ? -0.035 : 0.045) + k * 2.6, r = 10 + k * 4;
      a.position.set(cx + Math.cos(ang) * r, 15 + k * 1.6 + Math.sin(t * 0.4 + k) * 0.25, cz + Math.sin(ang) * r);
      a.rotation.y = -ang + (k ? Math.PI / 2 : -Math.PI / 2);
    }));
  }
  if (rank >= 5) {
    // Metropolis: slim glass towers rise on the floating islands.
    const tones = ["#bfe6ff", "#d9ccff", "#ffd9c2"];
    { const it = islets[1] ?? islets[0], ya = yachtAt; if (ya) landmarks[5] = () => ({ x: ya.x, z: ya.z, zoom: 2 }); else if (it) landmarks[5] = () => ({ x: it.o.position.x, z: it.o.position.z }); }
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
  /** A district business's building on its block: a shop that grows with its stage (from the
   *  model kit, in the business's colors: an awning and a sign), or a lot for lease. Its top. */
  const bizSpots: Record<number, { x: number; z: number; y: number; top: number }> = {};
  const districtBiz = (lg: THREE.Group, lot: BizLot, bid: string, c1: string, n: number): number => {
    const K = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
    const col = mats.c(c1, 0.55);
    if (lot.state === "lease") {
      K(lotSlab(), plazaM);
      // For lease: an empty lot (paved in the district's own stone, not a patch of lawn that
      // looked out of place on the clouds and in orbit), a little fence and a board in the
      // business's color.
      K(new THREE.BoxGeometry(3.4, 0.03, 3.4).translate(0, 0.08, 0), stone);
      for (const [fx, fz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) K(new THREE.BoxGeometry(0.1, 0.4, 0.1).translate(fx, 0.25, fz), wood);
      K(new THREE.BoxGeometry(0.08, 1.2, 0.08).translate(0, 0.6, 1.2), metal);
      K(new THREE.BoxGeometry(1.4, 0.7, 0.08).translate(0, 1.3, 1.2), col);
      K(new THREE.BoxGeometry(1.0, 0.14, 0.09).translate(0, 1.32, 1.21), mats.c("#ffffff", 0.5));
      return 1.8;
    }
    // Open: a shop at first, a bigger building as it grows, with its emblem.
    const bz = BUSINESSES.find(b => b.id === bid);
    const top = districtShop(lg, bid, lot.s, c1, bz?.color[1] ?? c1, mats, lotSlab(), plazaM, stone, leaf, metal, true);
    void n;
    return top;
  };
  const townC = (() => { const h = islandOutline(ISLAND_PAD, true); return { x: h.reduce((a, p) => a + p[0], 0) / h.length, z: h.reduce((a, p) => a + p[1], 0) / h.length }; })();
  let resortSea: THREE.Material | null = null, canalWater: THREE.Material | null = null;
  (cafe.land ?? []).forEach(({ id, bought, sale }) => {
    const k = LAND.findIndex(l => l.id === id);
    if (k < 0 || (!bought && !sale)) return;
    // (Its fixed number: its buildings' saved keys and its look, whatever its place in LAND.)
    const ks = LAND[k].slot;
    const sp = landSpot(k, bought), theme = LAND[k].theme;
    landShown[k] = { x: sp.x, z: sp.z, y: sp.y };
    // The way back: toward the island before it (the first one, toward the town).
    const prev = landPrev(k) >= 0 ? landSpot(landPrev(k), true) : { x: townC.x, z: townC.z, y: 0, r: 0 };
    const dl = Math.hypot(sp.x - prev.x, sp.z - prev.z) || 1, ux = (sp.x - prev.x) / dl, uz = (sp.z - prev.z) / dl;
    const G = new THREE.Group();
    // (A ground district on sale that the city has already grown round lies on the town's own
    // land, level with it, waiting to be built on; otherwise it floats just off the coast.)
    const embedded = !bought && landJoin(k) === "ground" && insidePoly(islandOutline(), sp.x, sp.z);
    G.position.set(sp.x, sp.y + (bought || embedded ? 0 : -0.6), sp.z);
    g.add(G);
    const L = (geo: THREE.BufferGeometry, m: THREE.Material) => { const me = new THREE.Mesh(geo, m); G.add(me); return me; };
    // The island: a rounded, slightly uneven square, in the same layers as the town's cliffs.
    const outlineD: [number, number][] = [];
    for (let a = 0; a < 64; a++) {
      const an = (a / 64) * Math.PI * 2, c2 = Math.cos(an), s2 = Math.sin(an);
      const sq = DIST_H / Math.pow(Math.pow(Math.abs(c2), 4) + Math.pow(Math.abs(s2), 4), 0.25);
      const rr = sq * (1 + 0.035 * Math.sin(an * 5 + ks * 1.7) + 0.02 * Math.sin(an * 11 + ks));
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
      orbit: { top: "#9aa3bc", lip: "#6a7290", l1: "#4a5070", l2: "#3a3f5a", l3: "#2a2f45", road: "#3a4160", walk: "#c8d0e4", curbC: "#5ae0ff" },
    } as const;
    const m2 = (c: string, r: number, m: number) => mats.c(c, r, m);
    const tc = theme === "cloud" || theme === "crystal" || theme === "orbit" ? TH[theme] : null;
    const topM = tc ? own(std(tc.top, { roughness: theme === "orbit" ? 0.5 : 0.85, metalness: theme === "orbit" ? 0.4 : 0 })) : verge;
    // (Garden Hills is a village: warm cobbled lanes instead of asphalt.)
    // (Ground districts share the town's asphalt: one city, no seam where the paving changes.)
    const roadD = tc ? own(std(tc.road, { roughness: 0.7, metalness: theme === "orbit" ? 0.3 : 0 })) : road;
    // (Each ground district has its own paving: sandy harbor stone, soft garden stone,
    // downtown granite.)
    const groundWalk: Record<string, string> = { meadow: "#f3dfb6", lakeside: "#e2ecd2", hills: "#cfd2dc", resort: "#f8e8cc", canal: "#e6c2a0" };
    const walkD = tc ? own(std(tc.walk, { roughness: 0.7 })) : groundWalk[id] ? own(std(groundWalk[id], { roughness: 0.85, map: walk.map })) : walk;
    if (!tc && groundWalk[id]) streetUV.set(walkD, 1.0);
    const curbD = tc ? own(std(tc.curbC, { roughness: 0.5, metalness: theme === "cloud" ? 0.6 : 0.2, emissive: new THREE.Color(theme === "cloud" ? "#000000" : tc.curbC), emissiveIntensity: theme === "cloud" ? 0 : 0.35 })) : curb;
    // (A ground district stands on the town's own land: no cliff, underside or railing of its own.)
    const ground = landJoin(k) === "ground" && (bought || embedded);
    if (!ground) {
    layer(1, 0.12, 0, topM);
    layer(1.006, 0.06, -0.02, tc ? own(std(tc.lip, { roughness: 0.8 })) : own(std(new THREE.Color(st.lawn).multiplyScalar(0.8), { roughness: 0.95 })));
    layer(0.995, 0.12, -0.12, tc ? own(std(tc.l1, { roughness: 0.8 })) : own(std("#5a3f2a", { roughness: 1 })));
    layer(0.99, 0.5, -0.24, tc ? own(std(tc.l1, { roughness: 0.8 })) : earth);
    layer(0.95, 1.2, -0.74, tc ? own(std(tc.l2, { roughness: 0.9, flatShading: true })) : rock);
    layer(0.82, 2.0, -1.94, tc ? own(std(tc.l3, { roughness: 0.9, flatShading: true })) : rockDark);
    layer(0.6, 2.6, -3.94, tc ? own(std(tc.l2, { roughness: 0.9, flatShading: true })) : rock);
    // The underside: not one spike but a cluster of rough rock (or crystal, or cloud-stone)
    // points of different lengths, like the bottom of a real torn-off piece of ground.
    {
      const um = tc ? own(std(tc.l3, { roughness: 0.9, flatShading: true })) : rockDark, um2 = tc ? own(std(tc.l2, { roughness: 0.9, flatShading: true })) : rock;
      const spikes: [number, number, number, number][] = [[0, 0, DIST_H * 0.42, DIST_H * 0.85]];
      for (let s5 = 0; s5 < 7; s5++) { const an = (s5 / 7) * Math.PI * 2 + ks * 0.7, rr = DIST_H * (0.3 + (s5 % 3) * 0.08); spikes.push([Math.cos(an) * rr, Math.sin(an) * rr, DIST_H * (0.17 + (s5 % 2) * 0.06), DIST_H * (0.3 + ((s5 * 5 + ks) % 4) * 0.09)]); }
      spikes.forEach(([sx5, sz5, r5, h5], i5) => {
        const geo = new THREE.ConeGeometry(r5, h5, 8, 3);
        const pa = geo.attributes.position;
        for (let v5 = 0; v5 < pa.count; v5++) { const y5 = pa.getY(v5); if (y5 > h5 / 2 - 0.01 || y5 < -h5 / 2 + 0.01) continue; const j5 = 1 + 0.22 * Math.sin(v5 * 12.9 + i5 * 3.1 + ks); pa.setX(v5, pa.getX(v5) * j5); pa.setZ(v5, pa.getZ(v5) * j5); }
        geo.computeVertexNormals();
        L(geo.rotateX(Math.PI).translate(sx5, -5.5 - h5 / 2, sz5), i5 % 2 ? um2 : um);
      });
    }
    }
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
      L(roundSlab(C - ROAD * 2, C - ROAD * 2, BLOCK_R, 0.18).translate(x, 0, z), curbD);
      L(roundSlab(C - ROAD * 2 - 0.16, C - ROAD * 2 - 0.16, BLOCK_R - 0.1, 0.2).translate(x, 0, z), walkD);
      // Lamps on two corners.
      for (const [a2, b2] of [[1, 1], [-1, -1]]) {
        const e = C / 2 - ROAD - 0.73;
        L(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(x + a2 * e, 0.9, z + b2 * e), metal);
        L(new THREE.SphereGeometry(0.12, 8, 6).translate(x + a2 * e, 1.65, z + b2 * e), lampMat);
      }
      // The district's own touch on the other two corners: mooring bollards and a coil of
      // rope by the harbor, flower tubs in Garden Hills, lit steel bollards downtown.
      for (const [a2, b2] of [[1, -1], [-1, 1]]) {
        const e = C / 2 - ROAD - 0.6, cx2 = x + a2 * e, cz2 = z + b2 * e;
        if (id === "meadow") {
          for (const o2 of [-0.22, 0.22]) { L(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8).translate(cx2 + o2, 0.34, cz2), mats.c("#2f3a4a", 0.5)); L(new THREE.SphereGeometry(0.08, 8, 5).translate(cx2 + o2, 0.48, cz2), mats.c("#2f3a4a", 0.5)); }
          L(new THREE.TorusGeometry(0.12, 0.04, 5, 12).rotateX(Math.PI / 2).translate(cx2, 0.24, cz2 - b2 * 0.3), mats.c("#c8a46a", 0.9));
        } else if (id === "lakeside") {
          L(new THREE.CylinderGeometry(0.26, 0.22, 0.26, 10).translate(cx2, 0.33, cz2), mats.c("#b8704a", 0.8));
          L(new THREE.IcosahedronGeometry(0.22, 0).translate(cx2, 0.55, cz2), leaf);
          for (let f = 0; f < 4; f++) L(new THREE.SphereGeometry(0.06, 6, 4).translate(cx2 + Math.cos(f * 1.6) * 0.15, 0.66, cz2 + Math.sin(f * 1.6) * 0.15), mats.c(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"][f], 0.8));
        } else if (id === "canal") {
          // (Iron lanterns with a hanging basket of flowers on the canal's corners.)
          L(new THREE.CylinderGeometry(0.035, 0.05, 1.15, 6).translate(cx2, 0.78, cz2), mats.c("#2a2f45", 0.5, 0.4));
          L(new THREE.BoxGeometry(0.16, 0.2, 0.16).translate(cx2, 1.42, cz2), lampMat);
          L(new THREE.ConeGeometry(0.14, 0.12, 4).rotateY(Math.PI / 4).translate(cx2, 1.58, cz2), mats.c("#2a2f45", 0.5, 0.4));
          L(new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(cx2 + a2 * 0.2, 1.08, cz2), mats.c("#8a5a30", 0.8));
          for (let f = 0; f < 4; f++) L(new THREE.SphereGeometry(0.055, 6, 4).translate(cx2 + a2 * 0.2 + Math.cos(f * 1.6) * 0.09, 1.12, cz2 + Math.sin(f * 1.6) * 0.09), mats.c(["#ff6fa0", "#ffe27a", "#ff8a5c", "#ffffff"][f], 0.8));
        } else if (id === "resort") {
          // (Striped beach posts with a life ring on the resort's corners.)
          L(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8).translate(cx2, 0.55, cz2), mats.c("#ffffff", 0.5));
          for (const yb of [0.4, 0.68]) L(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 8).translate(cx2, yb, cz2), mats.c("#ff5f6d", 0.5));
          L(new THREE.TorusGeometry(0.15, 0.045, 6, 14).translate(cx2, 0.62, cz2 + b2 * 0.08), mats.c("#ff7a59", 0.5));
        } else if (id === "hills") {
          for (const o2 of [-0.25, 0.25]) { L(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8).translate(cx2 + o2, 0.41, cz2), mats.c("#8a92a8", 0.3, 0.6)); L(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8).translate(cx2 + o2, 0.58, cz2), lampMat); }
        }
      }
      // The same road markings on the streets between blocks.
      if (i + 1 < DIST_N) markStreet(L, x + qd, z, "z", C - 0.6);
      if (j + 1 < DIST_N) markStreet(L, x, z + qd, "x", C - 0.6);
    }
    // A low railing round the edge.
    for (let a = 0; a < (ground ? 0 : outlineD.length); a += 2) {
      const [px, pz] = outlineD[a], kk = 0.96;
      L(new THREE.BoxGeometry(0.12, 0.42, 0.12).translate(px * kk, 0.21, pz * kk), stone);
    }
    // How it joins the city: the ground districts' streets run straight on into the town's;
    // the sky city's first island has a sky lift up from the town's edge; the others join it.
    {
      const sx0 = sp.x - ux * distEdge(ux, uz) * 0.97, sz0 = sp.z - uz * distEdge(ux, uz) * 0.97;
      let ex: number, ez: number;
      if (landPrev(k) >= 0) { ex = prev.x + ux * distEdge(ux, uz) * 0.97; ez = prev.z + uz * distEdge(ux, uz) * 0.97; }
      else {
        const th2 = islandOutline(ISLAND_PAD, true);
        let t2 = 0;
        while (t2 < 60 && !insidePoly(th2, sx0 - ux * t2, sz0 - uz * t2, 0.6)) t2 += 0.25;
        ex = sx0 - ux * (t2 + 0.6); ez = sz0 - uz * (t2 + 0.6);
      }
      const y0 = sp.y + (bought ? 0 : -0.6);
      const join = landJoin(k);
      // (The sky city floats free above the town: nothing ties it down across the view.)
      void join; void y0;
      // Streets at both ends: the bridge leads road to road. On this island the street runs
      // in from the coast to its street grid (below, with the arch); at the other end it runs
      // in to the island before's grid, or through the countryside to the town's streets.
      if (bought) {
        const link = linkOf[k];
        if (link) streetStrip(g, link.ax, link.az, link.bx, link.bz, 0.0, road, walk, curb);
        else if (landPrev(k) >= 0) {
          const pt = LAND[landPrev(k)].theme, pc2 = pt === "cloud" ? ["#e6d7ae", "#fffaf0", "#ffd86a"] : pt === "crystal" ? ["#3a2f66", "#e8e0ff", "#8af0ff"] : pt === "orbit" ? ["#262a3a", "#c8d0e4", "#5ae0ff"] : null;
          const inner = distEdge(ux, uz) - 2 * C + 0.2;
          streetStrip(g, ex - ux * 0.3, ez - uz * 0.3, ex - ux * inner, ez - uz * inner, prev.y, pc2 ? mats.c(pc2[0], 0.7) : road, pc2 ? mats.c(pc2[1], 0.7) : walk, pc2 ? mats.c(pc2[2], 0.5, 0.2) : curb);
        }
      }
    }
    // What's built on each block: the district's own theme.
    const blocks = new THREE.Group();
    G.add(blocks);
    const themeOf = (i: number, j: number): string => {
      const key = `${i},${j}`;
      if (id === "meadow") return key === "1,1" ? "marina" : key === "2,2" ? "market" : key === "0,0" ? "lighthouse" : key === "2,1" ? "park" : "home";
      if (id === "lakeside") return key === "1,1" ? "lake" : key === "2,1" ? "wheel" : key === "1,2" || key === "2,2" ? "park" : "home";
      if (id === "hills") return key === "1,1" ? "fountain" : key === "2,2" ? "park" : key === "2,1" ? "plaza" : "tower";
      // (The resort: two curved hotel towers in the middle, the pool and the cabanas beside
      // them, a palm garden toward the town and the beach on the far side, with the lagoon
      // and its pier at the far corner.)
      if (id === "resort") return key === "1,1" || key === "2,1" ? "hotel" : key === "2,2" ? "pool" : key === "1,2" ? "cabanas" : key === "0,0" ? "palms" : key === "3,3" ? "lagoon" : key === "3,2" || key === "2,3" ? "beach" : "home";
      // (The Canal Quarter: the clock tower's piazza in the middle, canals with bridges and
      // gondolas round it, the old gate on the corner toward the town (it lies off the town's
      // front-left), painted townhouses everywhere else.)
      if (id === "canal") return key === "1,1" ? "clocktower" : key === "2,1" || key === "1,2" || key === "2,2" ? "canal" : key === "3,0" ? "gate" : "home";
      if (id === "cloud") return key === "1,1" ? "palace" : key === "2,2" ? "skygarden" : "villa";
      if (id === "crystal") return key === "1,1" ? "spire" : "crystal";
      return key === "1,1" ? "rocket" : key === "2,2" ? "dish" : "dome";
    };
    /** A sky island's property at its level, in the island's own style. */
    const skyProp = (G2: THREE.Group, style: string, seed: number, lv: number): number => {
      const Q = (geo: THREE.BufferGeometry, m: THREE.Material) => G2.add(new THREE.Mesh(geo, m));
      Q(lotSlab(), topM);
      if (style === "villa" && seed % 3 !== 0) {
        // Two more kinds of cloud villa, so the island isn't one design repeated: a round
        // tower with a pointed roof and a balcony, or a long hall with twin domes and an arch.
        const marble = m2(["#fbf8ff", "#fff3f6", "#f4f8ff"][seed % 3], 0.5, 0), roofC = [mats.gold, m2("#ff9fbf", 0.4, 0.3), m2("#8fd0ff", 0.4, 0.3)][(seed >> 1) % 3];
        const h = [0, 1.2, 2.0, 3.0, 4.4, 6.8][lv];
        Q(new THREE.CylinderGeometry(1.9, 2.0, 0.2, 20).translate(0, 0.1, 0), m2("#e8e0d0", 0.6, 0));
        if (seed % 3 === 1) {
          Q(new THREE.CylinderGeometry(1.0, 1.15, h, 16).translate(0, 0.2 + h / 2, 0), marble);
          Q(new THREE.TorusGeometry(1.2, 0.06, 6, 24).rotateX(Math.PI / 2).translate(0, 0.2 + h * 0.62, 0), mats.gold);
          Q(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 20).translate(0, 0.17 + h * 0.62, 0), marble);
          for (let f = 0; f < Math.max(1, Math.round(h / 1.1)); f++) for (let a5 = 0; a5 < 4; a5++) { const an = (a5 / 4) * Math.PI * 2 + 0.4; Q(new THREE.BoxGeometry(0.28, 0.42, 0.04).rotateY(-an + Math.PI / 2).translate(Math.cos(an) * 1.04, 0.55 + f * 1.1, Math.sin(an) * 1.04), winMat); }
          Q(new THREE.ConeGeometry(1.2, 1.6, 16).translate(0, 0.2 + h + 0.8, 0), roofC);
          Q(new THREE.SphereGeometry(0.12, 8, 6).translate(0, 0.2 + h + 1.7, 0), mats.gold);
          return 0.2 + h + 1.9;
        }
        const hh = Math.max(1, h * 0.7);
        Q(new THREE.BoxGeometry(3.2, hh, 1.7).translate(0, 0.2 + hh / 2, 0), marble);
        for (const ox of [-1.0, 1.0]) { Q(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14).translate(ox, 0.35 + hh, 0), marble); Q(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(ox, 0.5 + hh, 0), roofC); }
        Q(new THREE.TorusGeometry(0.42, 0.1, 6, 14, Math.PI).translate(0, 0.2 + Math.min(hh, 1.1) * 0.55, 0.86), mats.gold);
        for (let f = 0; f < 4; f++) Q(new THREE.BoxGeometry(0.3, 0.5, 0.04).translate(-1.35 + f * 0.9 + (f > 1 ? 0 : 0), 0.2 + hh * 0.55, 0.86), winMat);
        if (lv >= 3) { Q(new THREE.CylinderGeometry(0.4, 0.45, h, 12).translate(0, 0.2 + h / 2, -0.4), marble); Q(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.2 + h, -0.4), mats.gold); }
        return 0.2 + Math.max(hh + 1.1, lv >= 3 ? h + 0.6 : 0);
      }
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
        if (seed % 3 === 1) {
          // Another kind: a stack of turning crystal blocks, each a little smaller.
          const n5 = 2 + lv;
          for (let b5 = 0; b5 < n5; b5++) { const sz = 1.25 - b5 * (0.7 / n5), hb = h / n5; Q(new THREE.BoxGeometry(sz, hb * 0.92, sz).rotateY(b5 * 0.35).translate(0, 0.06 + hb * (b5 + 0.5), 0), cm); }
          Q(new THREE.OctahedronGeometry(0.4, 0).scale(1, 1.8, 1).translate(0, h + 0.7, 0), cm);
          return h + 1.5;
        }
        if (seed % 3 === 2) {
          // Another kind: three leaning crystal spires growing from one base.
          for (let c7 = 0; c7 < 3; c7++) { const an = (c7 / 3) * Math.PI * 2 + seed, hh = h * (c7 ? 0.7 : 1); Q(new THREE.CylinderGeometry(0.35, 0.55, hh, 6).translate(0, hh / 2, 0).rotateZ(c7 ? 0.22 : 0).rotateY(an).translate(Math.cos(an) * (c7 ? 0.45 : 0), 0.06, Math.sin(an) * (c7 ? 0.45 : 0)), cm); }
          Q(new THREE.ConeGeometry(0.35, 1.0, 6).translate(0, h + 0.55, 0), cm);
          return h + 1.2;
        }
        Q(new THREE.CylinderGeometry(0.75, 0.95, h, 6).translate(0, h / 2 + 0.06, 0), cm);
        Q(new THREE.ConeGeometry(0.75, 1.4, 6).translate(0, h + 0.76, 0), cm);
        for (let c6 = 0; c6 < Math.min(5, lv + 1); c6++) { const an = c6 * 1.3 + seed, hh = 0.6 + (c6 % 3) * 0.5 + lv * 0.25; Q(new THREE.OctahedronGeometry(0.35, 0).scale(1, hh * 1.6, 1).translate(Math.cos(an) * 1.35, hh * 0.55, Math.sin(an) * 1.35), cm); }
        return h + 1.6;
      }
      // A space habitat: glass domes on a metal base, then stacked modules, then a tall
      // tower with a ring and an antenna.
      const metalP = m2("#c8d0e4", 0.35, 0.6), glass = own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 }));
      // (Six kinds, so no two neighbouring blocks look alike, each growing as it levels up.)
      const ov = seed % 6;
      if (ov === 1) {
        // Another kind: a cluster of small domes joined by tubes, with a radar dish.
        Q(new THREE.CylinderGeometry(1.8, 1.9, 0.25, 20).translate(0, 0.17, 0), metalP);
        const pods: [number, number, number][] = [[0, 0, 0.9 + lv * 0.08], [-1.05, 0.7, 0.55], [1.05, 0.6, 0.6], [0.2, -1.1, 0.5]];
        pods.forEach(([px, pz, r], i5) => {
          Q(new THREE.CylinderGeometry(r, r, 0.25 + (i5 ? 0 : lv * 0.35), 16).translate(px, 0.42 + (i5 ? 0 : lv * 0.17), pz), metalP);
          Q(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(px, 0.55 + (i5 ? 0 : lv * 0.35), pz), glass);
          if (i5) Q(new THREE.CylinderGeometry(0.12, 0.12, Math.hypot(px, pz), 8).rotateZ(Math.PI / 2).rotateY(-Math.atan2(pz, px)).translate(px / 2, 0.45, pz / 2), m2("#5ae0ff", 0.3, 0.4));
        });
        Q(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6).translate(1.3, 1.0, -0.9), metal);
        Q(new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2.6).translate(1.3, 1.7, -0.9), metalP);
        return 1.2 + lv * 0.35 + 0.9;
      }
      if (ov === 2) {
        // Another kind: a tall station tower with docking rings and a landing pad beside it.
        const hT = 1.2 + lv * 1.3;
        Q(new THREE.CylinderGeometry(1.7, 1.8, 0.25, 20).translate(0, 0.17, 0), metalP);
        Q(new THREE.CylinderGeometry(0.55, 0.7, hT, 12).translate(-0.4, 0.3 + hT / 2, -0.3), metalP);
        for (let r5 = 1; r5 <= Math.min(3, lv); r5++) Q(new THREE.TorusGeometry(0.95, 0.08, 6, 24).rotateX(Math.PI / 2).translate(-0.4, 0.3 + (hT * r5) / (Math.min(3, lv) + 1), -0.3), m2("#5ae0ff", 0.3, 0.4));
        Q(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(-0.4, 0.3 + hT, -0.3), glass);
        Q(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16).translate(0.9, 0.36, 0.9), m2("#2a2f45", 0.6, 0.3));
        Q(new THREE.TorusGeometry(0.55, 0.04, 4, 20).rotateX(Math.PI / 2).translate(0.9, 0.41, 0.9), m2("#ffd86a", 0.4, 0.2));
        return 0.3 + hT + 0.8;
      }
      const blue = m2("#5ae0ff", 0.3, 0.4), panel = m2("#2a3f8a", 0.2, 0.6);
      if (ov === 3) {
        // A greenhouse: long glass vaults full of plants, with solar wings.
        Q(new THREE.BoxGeometry(3.4, 0.25, 2.6).translate(0, 0.17, 0), metalP);
        const vaults = lv >= 3 ? 2 : 1, len = 2.2 + lv * 0.22;
        for (let v5 = 0; v5 < vaults; v5++) {
          const vz = vaults === 1 ? 0 : (v5 ? 0.62 : -0.62), r = vaults === 1 ? 0.95 : 0.58;
          Q(new THREE.CylinderGeometry(r, r, len, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0.3, vz), glass);
          for (let p5 = 0; p5 < 4; p5++) Q(new THREE.IcosahedronGeometry(r * 0.36, 0).translate(-len / 2 + 0.35 + p5 * ((len - 0.7) / 3), 0.3 + r * 0.3, vz), m2(p5 % 2 ? "#5ec46a" : "#8af08a", 0.8, 0));
          for (const ex of [-len / 2, len / 2]) Q(new THREE.TorusGeometry(r, 0.05, 4, 16, Math.PI).rotateY(Math.PI / 2).translate(ex, 0.3, vz), metalP);
        }
        for (const sx of [-1, 1]) for (let w5 = 0; w5 < Math.min(3, lv); w5++) Q(new THREE.BoxGeometry(0.5, 0.04, 0.9).rotateZ(sx * 0.3).translate(sx * (1.95 + w5 * 0.0), 0.9 + w5 * 0.45, -0.9 + w5 * 0.0), panel);
        Q(new THREE.CylinderGeometry(0.05, 0.05, 0.6 + lv * 0.4, 6).translate(1.5, 0.6 + lv * 0.2, -1.0), metal);
        return 1.4 + lv * 0.25;
      }
      if (ov === 4) {
        // A ring habitat: a wheel on a pillar round a glass hub, more rings as it grows.
        Q(new THREE.CylinderGeometry(1.3, 1.5, 0.3, 20).translate(0, 0.2, 0), metalP);
        const hP = 0.9 + lv * 0.55;
        Q(new THREE.CylinderGeometry(0.22, 0.3, hP, 10).translate(0, 0.35 + hP / 2, 0), metalP);
        const rings = lv >= 4 ? 2 : 1;
        for (let r5 = 0; r5 < rings; r5++) {
          const ry = 0.35 + hP - r5 * 0.9, rr = 1.5 - r5 * 0.35;
          Q(new THREE.TorusGeometry(rr, 0.2, 8, 32).rotateX(Math.PI / 2).translate(0, ry, 0), r5 ? blue : metalP);
          for (let sp5 = 0; sp5 < 4; sp5++) Q(new THREE.BoxGeometry(rr * 2, 0.06, 0.08).rotateY((sp5 * Math.PI) / 4).translate(0, ry, 0), metal);
          for (let w5 = 0; w5 < 10; w5++) { const an = (w5 / 10) * Math.PI * 2; Q(new THREE.BoxGeometry(0.12, 0.08, 0.02).rotateY(-an + Math.PI / 2).translate(Math.cos(an) * (rr + 0.2), ry, Math.sin(an) * (rr + 0.2)), winMat); }
        }
        Q(new THREE.SphereGeometry(0.5, 14, 10).translate(0, 0.35 + hP, 0), glass);
        return 0.35 + hP + 0.8;
      }
      if (ov === 5) {
        // An observatory: a round hall, a telescope dome with its slot open, a tilted telescope.
        const hB = 0.6 + lv * 0.4;
        Q(new THREE.CylinderGeometry(1.5, 1.6, 0.25, 20).translate(0, 0.17, 0), metalP);
        Q(new THREE.CylinderGeometry(1.05, 1.1, hB, 18).translate(0, 0.3 + hB / 2, 0), m2("#e8ecf4", 0.4, 0.3));
        for (let f = 0; f < 8; f++) { const an = (f / 8) * Math.PI * 2; Q(new THREE.BoxGeometry(0.2, 0.16, 0.02).rotateY(-an + Math.PI / 2).translate(Math.cos(an) * 1.11, 0.3 + hB * 0.6, Math.sin(an) * 1.11), winMat); }
        Q(new THREE.SphereGeometry(1.0, 18, 10, 0.5, Math.PI * 2 - 1.0, 0, Math.PI / 2).translate(0, 0.3 + hB, 0), m2("#f4f6fb", 0.45, 0.15));
        Q(new THREE.CylinderGeometry(0.2, 0.26, 1.6, 10).rotateZ(-0.7).translate(0.5, 0.3 + hB + 0.6, 0.05), m2("#ffffff", 0.3, 0.2));
        Q(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(-1.2, 0.75, -0.7), metal);
        Q(new THREE.SphereGeometry(0.07, 6, 4).translate(-1.2, 1.22, -0.7), m2("#ff3a4a", 0.5, 0));
        return 0.3 + hB + 1.4;
      }
      Q(new THREE.CylinderGeometry(1.6, 1.7, 0.3, 20).translate(0, 0.2, 0), metalP);
      const mods = [0, 0, 1, 2, 4, 7][lv];
      for (let m3 = 0; m3 < mods; m3++) Q(new THREE.CylinderGeometry(1.0 - m3 * 0.05, 1.0 - m3 * 0.05, 0.7, 16).translate(0, 0.7 + m3 * 0.75, 0), m3 % 2 ? metalP : m2("#5ae0ff", 0.3, 0.4));
      const topY = 0.35 + mods * 0.75;
      Q(new THREE.SphereGeometry(lv <= 1 ? 1.3 : 1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, topY, 0), glass);
      Q(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8).translate(0, topY + 0.25, 0), m2("#8af08a", 0.8, 0));
      if (lv >= 4) { Q(new THREE.TorusGeometry(1.4, 0.06, 6, 28).rotateX(Math.PI / 2).translate(0, topY - 0.5, 0), m2("#5ae0ff", 0.3, 0.4)); Q(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6).translate(0, topY + 1.4, 0), metal); }
      return topY + 1.5;
    };
    const shardM: Record<string, THREE.Material> = {};
    // The district's own businesses: each on its own block (the plain ones, in a set order),
    // a business building once it's open, a lot "for lease" once it can be.
    const SPECIAL = new Set(["1,1", "2,2", "0,0", "2,1", "1,2"]);
    const slotOrder = [[0, 1], [1, 0], [0, 2], [2, 0], [3, 1], [1, 3], [3, 2], [2, 3], [0, 3], [3, 0], [3, 3]].filter(([a, b]) => !SPECIAL.has(`${a},${b}`) || (id === "crystal" && `${a},${b}` !== "1,1"));
    const myBiz = BUSINESSES.map((b, bi) => (b.land === id ? bi : -1)).filter(bi => bi >= 0);
    const slotBiz = new Map<string, number>();
    myBiz.forEach((bi, q) => { const c = slotOrder[q]; if (c) slotBiz.set(`${c[0]},${c[1]}`, bi); });
    for (let i = 0; i < DIST_N; i++) for (let j = 0; j < DIST_N; j++) {
      const { x, z } = cellC(i, j), lg = new THREE.Group(), n = 40 + ks * 20 + i * DIST_N + j;
      lg.position.set(x, 0.2, z);
      lg.rotation.y = i < j ? Math.PI / 2 : 0;
      blocks.add(lg);
      const P = (geo: THREE.BufferGeometry, m: THREE.Material) => lg.add(new THREE.Mesh(geo, m));
      const th = themeOf(i, j);
      const bi = slotBiz.get(`${i},${j}`), blot = bi !== undefined ? lots[bi] : undefined;
      if (bought && blot && blot.state !== "locked") {
        const bz = BUSINESSES[bi!], c1 = bz.color[0], top = districtBiz(lg, blot, bz.id, c1, n);
        bizSpots[bi!] = { x: sp.x + x, z: sp.z + z, y: sp.y, top };
        continue;
      }
      if (!bought) {
        // For sale: open ground with a tree or two, waiting to be built on.
        P(lotSlab(), tc ? topM : n % 2 ? grass : grass2);
        if (tc) continue;
        if (n % 3 === 0) { P(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6).translate(-1, 0.3, 0.8), trunk); P(new THREE.IcosahedronGeometry(0.5, 0).translate(-1, 0.95, 0.8), leaf); }
        continue;
      }
      if (th !== "home" && th !== "tower" && th !== "villa" && th !== "crystal" && th !== "dome") sightAt(sp.x + x, sp.z + z, tc ? 3 : 1.8, `th-${th}`, `d${ks}:${i},${j}`, sp.y);
      if (th === "tower") {
        // Downtown in artist-made models (once they're loaded): an office block or a
        // skyscraper from the city kit on a paved plaza with a strip of lawn.
        const key = `d${ks}:${i},${j}`, lv = Math.min(5, propLv(key) + 2);
        const sky = lv >= 4 || n % 3 === 0;
        const kp = kitPlace(sky ? ["skyscraper_a", "skyscraper_b", "skyscraper_c", "tt_office", "tt_tower_block"][n % 5] : [`building_${"abcdefgh"[(n * 5) % 8]}`, "tt_hotel", "tt_bank", "tt_apartment_2"][n % 4 === 3 ? 1 + (n >> 2) % 3 : 0], sky ? 2.9 : 3.3, 1 + (lv - 3) * 0.18);
        if (kp) {
          P(lotSlab(), plazaM);
          P(new THREE.BoxGeometry(3.9, 0.05, 0.5).translate(0, 0.07, 1.75), grass);
          for (const tx of [-1.6, 1.6]) { P(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10).translate(tx, 0.1, 1.75), stone); P(new THREE.IcosahedronGeometry(0.24, 0).translate(tx, 0.38, 1.75), leaf); }
          kp.obj.rotation.y = ((n >> 1) % 4) * (Math.PI / 2);
          kp.obj.position.y = 0.06;
          lg.add(kp.obj);
          if (landBuiltOnce && (propsSeen[key] ?? 1) < lv) {
            lg.userData.dynamic = true;
            const t0 = performance.now() + 250;
            lg.scale.y = 0.05;
            townTicks.push(() => { const k2 = Math.min(1, Math.max(0, (performance.now() - t0) / 900)); if (k2 >= 1 && lg.scale.y === 1) return; lg.scale.y = k2 < 1 ? Math.max(0.05, 1 - Math.pow(1 - k2, 3) + Math.sin(k2 * Math.PI) * 0.12) : 1; g.userData.moving = k2 < 1; });
          }
          propsSeen[key] = lv;
          homeAt(sp.x + x, sp.z + z, kp.h + 0.1, key, sp.y);
          continue;
        }
      }
      if (th === "home" || th === "tower") { const key = `d${ks}:${i},${j}`; homeAt(sp.x + x, sp.z + z, propBuilding(lg, n, Math.min(5, propLv(key) + (th === "tower" ? 2 : 0)), key), key, sp.y); continue; }
      if (th === "villa" || th === "crystal" || th === "dome") {
        const key = `d${ks}:${i},${j}`, lv = propLv(key);
        const top2 = skyProp(lg, th, n, lv);
        // The lot's corners: gold-potted topiary in the clouds, glowing shards on the crystal.
        if (th !== "dome") for (const [cx5, cz5] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) {
          if (th === "villa") { P(new THREE.CylinderGeometry(0.14, 0.1, 0.18, 8).translate(cx5, 0.09, cz5), mats.gold); P(new THREE.SphereGeometry(0.17, 8, 6).translate(cx5, 0.33, cz5), mats.c("#7fcf8a", 0.8)); P(new THREE.SphereGeometry(0.11, 8, 6).translate(cx5, 0.56, cz5), mats.c("#7fcf8a", 0.8)); }
          else { const cc5 = ["#9a7aff", "#7ad0ff", "#ff8ae0"][(n + Math.round(cx5 + cz5 * 2)) & 1 ? 1 : (n % 3)]; P(new THREE.OctahedronGeometry(0.12, 0).scale(1, 2.4, 1).rotateZ(cx5 * 0.12).translate(cx5, 0.28, cz5), shardM[cc5] ??= own(std(cc5, { roughness: 0.15, emissive: new THREE.Color(cc5), emissiveIntensity: 0.6, flatShading: true }))); }
        }
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
        Q(lotSlab(), topM);
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
          // (The dish is a thin shell: both sides drawn, or from this side it vanishes and
          // only its shadow shows.)
          const dishM = own(std("#e8ecf4", { roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide }));
          Q(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 10).translate(0, 0.9, 0), metalP);
          Q(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI * 0.75).translate(0, 2.1, 0), dishM);
          Q(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6).rotateX(-Math.PI / 4).translate(0, 2.6, 0.4), metal);
          for (const [tx, tz] of [[-1.4, 1.2], [1.4, 1.2]]) Q(new THREE.BoxGeometry(1.0, 0.04, 0.6).rotateX(-0.5).translate(tx, 0.6, tz), m2("#2a3f8a", 0.2, 0.6));
        }
        continue;
      }
      if (id === "canal") {
        // The Canal Quarter's blocks: brick paving, canals, painted townhouses.
        const water = canalWater ??= own(std("#2f9fc0", { roughness: 0.15, metalness: 0.1, emissive: 0x0d4a60, emissiveIntensity: 0.12 }));
        const stone = mats.c("#d9c8b0", 0.85), brick = mats.c("#c8704a", 0.85), iron = mats.c("#2a2f45", 0.5, 0.4), white = mats.c("#ffffff", 0.5);
        const paint = ["#f2b84a", "#e8735a", "#f4d6a0", "#7fb0c8", "#d9876a", "#f0e2c0", "#b8c87a"];
        type Put = (geo: THREE.BufferGeometry, m: THREE.Material) => unknown;
        // (A tall narrow townhouse: painted front, white windows, a red-tiled roof.)
        const townhouse = (Q: Put, hx: number, hz: number, w5: number, h5: number, c: string, face: number) => {
          Q(new THREE.BoxGeometry(w5, h5, 0.9).translate(hx, h5 / 2 + 0.06, hz), mats.c(c, 0.8));
          Q(new THREE.ConeGeometry(w5 * 0.75, 0.5, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9 / w5).translate(hx, h5 + 0.31, hz), mats.c("#b8503a", 0.8));
          for (let f = 0; f < Math.floor(h5 / 0.6); f++) for (const wx of w5 > 0.8 ? [-0.2, 0.2] : [0]) Q(new THREE.BoxGeometry(0.18, 0.28, 0.04).translate(hx + wx, 0.55 + f * 0.6, hz + face * 0.46), f === 0 && wx <= 0 ? mats.c("#6a3a20", 0.7) : winMat);
        };
        // (A gondola: black, curled at both ends, with a gondolier in a striped shirt.)
        const gondolaAt = (Q2: THREE.Object3D) => {
          const gd = new THREE.Group(), dark = mats.c("#1c1a28", 0.4);
          gd.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.3).translate(0, 0.1, 0), dark));
          for (const sx of [-1, 1]) gd.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 10, Math.PI).rotateZ(sx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(sx * 0.65, 0.2, 0), dark));
          gd.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.26).translate(0.1, 0.2, 0), mats.c("#c8303a", 0.7)));
          gd.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 8).translate(-0.4, 0.38, 0), mats.c("#ffffff", 0.6)));
          gd.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8).translate(-0.4, 0.4, 0), mats.c("#c8303a", 0.6)));
          gd.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).translate(-0.4, 0.6, 0), mats.c("#f2c39a", 0.7)));
          gd.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10).translate(-0.4, 0.67, 0), mats.c("#f4d6a0", 0.7)));
          gd.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5).rotateZ(0.5).translate(-0.6, 0.45, 0), mats.c("#8a5a30", 0.7)));
          gd.userData.dynamic = true;
          Q2.add(gd);
          return gd;
        };
        if (th === "canal") {
          // A canal across the block between stone edges, an arched brick bridge over it,
          // painted townhouses on both banks and a gondola gliding up and down.
          P(lotSlab(), pave);
          P(new THREE.BoxGeometry(LOT_W, 0.03, 1.5).translate(0, 0.075, 0), water);
          for (const sz of [-1, 1]) P(new THREE.BoxGeometry(LOT_W, 0.12, 0.16).translate(0, 0.12, sz * 0.83), stone);
          P(new THREE.TorusGeometry(0.85, 0.13, 6, 14, Math.PI).scale(1, 0.7, 1).rotateY(Math.PI / 2).translate(0.6, 0.08, 0), brick);
          for (const sx of [-0.12, 0.12]) P(new THREE.BoxGeometry(0.03, 0.18, 1.9).translate(0.6 + sx, 0.74, 0), iron);
          const right = (i + j) % 2;
          for (let q = 0; q < 4; q++) {
            const hx = -1.65 + q * 1.1, w5 = q % 2 ? 0.95 : 0.8;
            townhouse(P, hx, 1.7, w5, 1.6 + ((n + q) % 3) * 0.45, paint[(n + q) % paint.length], -1);
            if (q !== 1 || right) townhouse(P, hx, -1.7, w5, 1.5 + ((n + q * 2) % 3) * 0.5, paint[(n + q + 3) % paint.length], 1);
          }
          // (Striped mooring poles.)
          for (const px of [-1.7, -1.35]) { P(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6).translate(px, 0.45, -0.6), white); for (let k5 = 0; k5 < 3; k5++) P(new THREE.CylinderGeometry(0.042, 0.042, 0.1, 6).translate(px, 0.25 + k5 * 0.25, -0.6), mats.c("#3a8dff", 0.5)); }
          const gd = gondolaAt(lg), ph5 = n * 1.7;
          townTicks.push(t => { const u = Math.sin(t * 0.12 + ph5); gd.position.set(u * 1.7, 0.02 + Math.sin(t * 1.3 + ph5) * 0.015, 0.1); gd.rotation.y = Math.cos(t * 0.12 + ph5) >= 0 ? 0 : Math.PI; });
          continue;
        }
        if (th === "clocktower") {
          // The piazza: a tall brick clock tower with a clock on two sides (its hands keep
          // the real time), a green copper roof, café tables and a well.
          P(lotSlab(), plazaM);
          const tx = -0.95, tz = -0.95, hh = 5.6;
          P(new THREE.BoxGeometry(1.35, hh, 1.35).translate(tx, hh / 2 + 0.06, tz), brick);
          for (const y5 of [1.2, 3.0, hh - 0.2]) P(new THREE.BoxGeometry(1.45, 0.12, 1.45).translate(tx, y5, tz), stone);
          // (The belfry: open arches, a bell inside.)
          P(new THREE.BoxGeometry(1.2, 1.0, 1.2).translate(tx, hh + 0.56, tz), stone);
          for (const [ox, oz, ry] of [[0, 0.61, 0], [0.61, 0, Math.PI / 2], [0, -0.61, 0], [-0.61, 0, Math.PI / 2]]) P(new THREE.BoxGeometry(0.5, 0.7, 0.04).rotateY(ry).translate(tx + ox, hh + 0.5, tz + oz), mats.c("#2a2030", 0.8));
          P(new THREE.ConeGeometry(0.22, 0.3, 10).translate(tx, hh + 0.55, tz), mats.c("#e8b020", 0.3, 0.7));
          P(new THREE.ConeGeometry(0.98, 1.5, 4).rotateY(Math.PI / 4).translate(tx, hh + 1.8, tz), mats.c("#5fa890", 0.6, 0.3));
          P(new THREE.SphereGeometry(0.1, 8, 6).translate(tx, hh + 2.62, tz), mats.c("#e8b020", 0.3, 0.7));
          // (Clock faces toward the street on two sides.)
          const hands: THREE.Object3D[][] = [];
          for (const [fx, fz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2]] as const) {
            const face = new THREE.Group();
            face.position.set(tx + fx * 0.69, hh - 1.0, tz + fz * 0.69); face.rotation.y = ry;
            face.add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24).rotateX(Math.PI / 2), white));
            face.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 24), mats.c("#e8b020", 0.3, 0.7)));
            for (let k5 = 0; k5 < 12; k5++) face.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.02).translate(0, 0.37, 0.03).rotateZ((k5 / 12) * Math.PI * 2), iron));
            const hr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.02).translate(0, 0.1, 0.05), iron), mn = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.02).translate(0, 0.16, 0.06), iron);
            hr.userData.dynamic = true; mn.userData.dynamic = true;
            face.add(hr, mn); hands.push([hr, mn]);
            lg.add(face);
          }
          townTicks.push(() => { const d = new Date(), m5 = d.getMinutes() + d.getSeconds() / 60, h5 = (d.getHours() % 12) + m5 / 60; for (const [hr, mn] of hands) { hr.rotation.z = -(h5 / 12) * Math.PI * 2; mn.rotation.z = -(m5 / 60) * Math.PI * 2; } });
          // Café tables under umbrellas, and a stone well.
          for (const [cx5, cz5, c5] of [[0.9, -1.2, "#e8735a"], [1.3, 0.2, "#3a8dff"], [0.2, 1.3, "#f2b84a"]] as const) {
            P(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 12).translate(cx5, 0.46, cz5), white);
            P(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6).translate(cx5, 0.25, cz5), iron);
            for (let k5 = 0; k5 < 2; k5++) P(new THREE.BoxGeometry(0.18, 0.3, 0.18).translate(cx5 + (k5 ? 0.38 : -0.38), 0.2, cz5), iron);
            P(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5).translate(cx5, 0.66, cz5), white);
            P(new THREE.ConeGeometry(0.55, 0.25, 8).translate(cx5, 1.3, cz5), mats.c(c5, 0.6));
          }
          P(new THREE.CylinderGeometry(0.42, 0.46, 0.4, 14).translate(-1.2, 0.26, 1.2), stone);
          P(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 14).translate(-1.2, 0.45, 1.2), water);
          for (const sx of [-0.36, 0.36]) P(new THREE.BoxGeometry(0.05, 0.7, 0.05).translate(-1.2 + sx, 0.75, 1.2), wood);
          P(new THREE.BoxGeometry(0.8, 0.06, 0.12).translate(-1.2, 1.1, 1.2), wood);
          continue;
        }
        if (th === "gate") {
          // The old town gate (turned to face the street the camera looks down): a brick arch with a clock-face crest, its name
          // on a banner, flower boxes and benches.
          P(lotSlab(), pave);
          const Q = (() => { const h = new THREE.Group(); h.rotation.y = Math.atan2(1, 1) - lg.rotation.y; lg.add(h); return (geo: THREE.BufferGeometry, m: THREE.Material) => h.add(new THREE.Mesh(geo, m)); })();
          for (const sx of [-1, 1]) { Q(new THREE.BoxGeometry(0.6, 2.4, 0.7).translate(sx * 1.05, 1.26, 0), brick); Q(new THREE.BoxGeometry(0.7, 0.12, 0.8).translate(sx * 1.05, 2.5, 0), stone); }
          Q(new THREE.TorusGeometry(0.75, 0.16, 6, 14, Math.PI).translate(0, 1.85, 0), brick);
          Q(new THREE.BoxGeometry(2.7, 0.55, 0.7).translate(0, 2.85, 0), brick);
          Q(new THREE.BoxGeometry(2.85, 0.12, 0.8).translate(0, 3.18, 0), stone);
          Q(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 18).rotateX(Math.PI / 2).translate(0, 2.85, 0.37), white);
          Q(new THREE.TorusGeometry(0.28, 0.035, 6, 18).translate(0, 2.85, 0.39), mats.c("#e8b020", 0.3, 0.7));
          const bc = document.createElement("canvas"); bc.width = 512; bc.height = 80;
          const bx = bc.getContext("2d");
          if (bx) { bx.fillStyle = "#2f6fb0"; bx.fillRect(0, 0, 512, 80); bx.fillStyle = "#ffe8b0"; bx.font = "bold 44px Arial Black, sans-serif"; bx.textAlign = "center"; bx.textBaseline = "middle"; bx.fillText(LAND[k].name.toUpperCase(), 256, 42); }
          const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
          Q(new THREE.PlaneGeometry(1.9, 0.3).translate(0, 2.4, 0.36), own(new THREE.MeshBasicMaterial({ map: btex })));
          for (const sx of [-1, 1]) {
            Q(new THREE.BoxGeometry(0.7, 0.3, 0.35).translate(sx * 1.7, 0.21, 0.9), mats.c("#8a5a30", 0.8));
            for (let f = 0; f < 5; f++) Q(new THREE.SphereGeometry(0.08, 6, 4).translate(sx * 1.7 - 0.26 + f * 0.13, 0.42, 0.9), mats.c(["#ff6fa0", "#ffe27a", "#ff8a5c", "#ffffff", "#b48cff"][f], 0.8));
            Q(new THREE.BoxGeometry(0.9, 0.06, 0.3).translate(sx * 1.6, 0.38, -1.3), wood);
            for (const ox of [-0.35, 0.35]) Q(new THREE.BoxGeometry(0.05, 0.32, 0.25).translate(sx * 1.6 + ox, 0.2, -1.3), iron);
          }
          continue;
        }
      }
      if (id === "resort") {
        // The Beach Resort's blocks, each on warm sand (or a pool deck).
        const white = mats.c("#ffffff", 0.45), shade = ["#ff5f6d", "#ffd23a", "#2fb8e8", "#ff8ac0", "#5ee0a0"];
        const turn = lg.rotation.y;
        // (A group facing world direction (wx, wz), whatever way the block is turned.)
        const facing = (wx: number, wz: number) => { const h = new THREE.Group(); h.rotation.y = Math.atan2(wx, wz) - turn; lg.add(h); return (geo: THREE.BufferGeometry, m: THREE.Material) => h.add(new THREE.Mesh(geo, m)); };
        type Put = (geo: THREE.BufferGeometry, m: THREE.Material) => unknown;
        const palm = (Q: Put, px: number, pz: number, s5 = 1, seed = 0) => {
          const lean = 0.16 * Math.sin(seed * 2.3), hh = 1.5 * s5;
          Q(new THREE.CylinderGeometry(0.05 * s5, 0.09 * s5, hh, 6).translate(0, hh / 2, 0).rotateZ(lean).translate(px, 0.05, pz), trunk);
          const tx = px - Math.sin(lean) * hh, ty = 0.05 + Math.cos(lean) * hh;
          for (let f = 0; f < 6; f++) Q(new THREE.BoxGeometry(0.8 * s5, 0.04, 0.2 * s5).translate(0.36 * s5, 0, 0).rotateZ(-0.45).rotateY((f / 6) * Math.PI * 2 + seed).translate(tx, ty, pz), leaf);
          Q(new THREE.SphereGeometry(0.09 * s5, 6, 4).translate(tx, ty - 0.05, pz), mats.c("#7a5a2a", 0.8));
        };
        const lounger = (Q: Put, px: number, pz: number, rot: number, c: string) => {
          Q(new THREE.BoxGeometry(0.3, 0.06, 0.62).translate(0, 0.16, 0.05).rotateY(rot).translate(px, 0, pz), white);
          Q(new THREE.BoxGeometry(0.3, 0.05, 0.3).rotateX(-0.9).translate(0, 0.28, -0.3).rotateY(rot).translate(px, 0, pz), white);
          Q(new THREE.BoxGeometry(0.26, 0.03, 0.5).translate(0, 0.205, 0.1).rotateY(rot).translate(px, 0, pz), mats.c(c, 0.7));
        };
        const umbrella = (Q: Put, px: number, pz: number, c: string, r = 0.55) => {
          Q(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 5).translate(px, 0.6, pz), white);
          Q(new THREE.ConeGeometry(r, 0.28, 8).translate(px, 1.2, pz), mats.c(c, 0.6));
          for (const a of [0, Math.PI]) Q(new THREE.ConeGeometry(r * 1.01, 0.285, 8, 1, true, a, Math.PI / 4).translate(px, 1.2, pz), white);
        };
        const sea = resortSea ??= own(std("#3fd0e0", { roughness: 0.12, emissive: 0x1a8fb0, emissiveIntensity: 0.08 }));
        if (th === "hotel") {
          // A big curved hotel tower: a crescent of glass with white balconies round every
          // floor, its open side to the sea, on a podium with a canopy over the way in.
          const big = i === 1, tall = big ? 9.2 : 6.4, ro = big ? 2.5 : 2.3, ri = ro - 0.85, cxh = 0.7, czh = 0.7;
          const a0 = Math.PI * 0.82, a1 = Math.PI * 1.68, accent = mats.c(big ? "#2ec4a0" : "#ff7a59", 0.5);
          const crescent = (r0: number, r1: number, b0: number, b1: number) => {
            const pts: THREE.Vector2[] = [];
            for (let q = 0; q <= 18; q++) { const a = b0 + ((b1 - b0) * q) / 18; pts.push(new THREE.Vector2(cxh + Math.cos(a) * r0, -(czh + Math.sin(a) * r0))); }
            for (let q = 18; q >= 0; q--) { const a = b0 + ((b1 - b0) * q) / 18; pts.push(new THREE.Vector2(cxh + Math.cos(a) * r1, -(czh + Math.sin(a) * r1))); }
            return new THREE.Shape(pts);
          };
          const slab = (r0: number, r1: number, y0: number, h: number, m: THREE.Material, b0 = a0, b1 = a1) => P(new THREE.ExtrudeGeometry(crescent(r0, r1, b0, b1), { depth: h, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, y0, 0), m);
          P(lotSlab(), plazaM);
          slab(ro + 0.3, ri - 0.3, 0.05, 0.75, white, a0 - 0.06, a1 + 0.06);
          slab(ro, ri, 0.8, tall, winMat);
          const floors = Math.round(tall / 0.55);
          for (let f = 1; f <= floors; f++) slab(ro + 0.16, ri - 0.05, 0.8 + (f * tall) / floors - 0.04, 0.07, f === floors ? accent : white);
          // (Fins at both ends of the curve, a little taller than the roof, in its accent colour.)
          for (const a of [a0, a1]) P(new THREE.BoxGeometry(ro - ri + 0.3, tall + 1.0, 0.22).rotateY(-a).translate(cxh + (Math.cos(a) * (ro + ri)) / 2, 0.8 + (tall + 1.0) / 2, czh + (Math.sin(a) * (ro + ri)) / 2), accent);
          slab(ro - 0.05, ri + 0.05, 0.8 + tall, 0.45, white);
          // On the roof: a pool on the taller tower, a helipad on the other.
          const am = (a0 + a1) / 2, rx = cxh + (Math.cos(am) * (ro + ri)) / 2, rz = czh + (Math.sin(am) * (ro + ri)) / 2;
          if (big) slab(ro - 0.22, ri + 0.22, 0.8 + tall + 0.45, 0.04, sea, a0 + 0.3, a1 - 0.3);
          else { P(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 18).translate(rx, 0.8 + tall + 0.48, rz), mats.c("#3a4160", 0.6)); P(new THREE.TorusGeometry(0.3, 0.03, 4, 18).rotateX(Math.PI / 2).translate(rx, 0.8 + tall + 0.52, rz), mats.c("#ffd23a", 0.5)); }
          // The way in, on the open side: a canopy on posts, and palms.
          P(new THREE.BoxGeometry(1.2, 0.08, 0.8).rotateY(Math.PI / 4).translate(1.35, 1.3, 1.35), accent);
          for (const [qx, qz] of [[1.75, 1.15], [1.15, 1.75]]) P(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6).translate(qx, 0.67, qz), white);
          palm(P, -1.85, 1.85, 0.85, n); palm(P, 1.85, -1.85, 0.8, n + 1);
          continue;
        }
        if (th === "pool") {
          // The pool: blue water in a white rim on a sunny deck, loungers and umbrellas round
          // it, a slide and a little bar.
          P(lotSlab(), pave);
          P(roundSlab(3.3, 2.2, 0.7, 0.1).translate(-0.1, 0.06, -0.35), white);
          P(roundSlab(3.05, 1.95, 0.6, 0.06).translate(-0.1, 0.1, -0.35), sea);
          for (let q = 0; q < 4; q++) lounger(P, -1.4 + q * 0.8, 1.55, 0, shade[(q + n) % shade.length]);
          for (let q = 0; q < 2; q++) umbrella(P, -1.0 + q * 1.6, 1.25, shade[(q * 2 + n + 1) % shade.length], 0.5);
          // (A curly slide into the deep end.)
          P(new THREE.TorusGeometry(0.42, 0.07, 6, 16, Math.PI * 1.3).rotateX(Math.PI / 2).translate(1.45, 0.75, -1.55), mats.c("#ffd23a", 0.5));
          P(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6).translate(1.85, 0.6, -1.9), white);
          P(new THREE.BoxGeometry(0.4, 0.45, 0.7).translate(-1.85, 0.3, -1.6), wood);
          umbrella(P, -1.85, -1.6, "#ff7a59", 0.55);
          continue;
        }
        if (th === "cabanas") {
          // Colourful cabanas in a row on the sand, curtains tied back, and palms.
          P(lotSlab(), sandM);
          for (let q = 0; q < 4; q++) {
            const qx = -1.5 + q * 1.0, qz = -0.35, c = shade[(q + n) % shade.length];
            for (const [ox, oz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) P(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5).translate(qx + ox, 0.55, qz + oz), white);
            P(new THREE.ConeGeometry(0.62, 0.42, 4).rotateY(Math.PI / 4).translate(qx, 1.27, qz), mats.c(c, 0.6));
            P(new THREE.BoxGeometry(0.84, 0.06, 0.84).translate(qx, 1.05, qz), white);
            P(new THREE.BoxGeometry(0.72, 0.6, 0.04).translate(qx, 0.7, qz - 0.38), mats.c(c, 0.7));
            for (const ox of [-0.36, 0.36]) P(new THREE.BoxGeometry(0.1, 0.85, 0.06).translate(qx + ox, 0.6, qz + 0.38), mats.c(c, 0.7));
            P(new THREE.BoxGeometry(0.6, 0.14, 0.55).translate(qx, 0.2, qz), white);
          }
          palm(P, -1.65, 1.55, 1, n); palm(P, 1.6, 1.6, 0.85, n + 2);
          lounger(P, -0.4, 1.35, 0, "#2fb8e8"); lounger(P, 0.4, 1.35, 0, "#ff8ac0");
          continue;
        }
        if (th === "palms") {
          // A palm garden on the way in from town, round a shell fountain.
          P(lotSlab(), sandM);
          P(roundSlab(3.6, 3.6, 1.2, 0.04).translate(0, 0.06, 0), grass);
          P(new THREE.CylinderGeometry(0.75, 0.8, 0.24, 20).translate(0, 0.18, 0), white);
          P(new THREE.CylinderGeometry(0.66, 0.66, 0.04, 20).translate(0, 0.29, 0), sea);
          P(new THREE.SphereGeometry(0.26, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.29, 0), mats.c("#ffb8a0", 0.5));
          for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2 + 0.3; palm(P, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.8 + (q % 3) * 0.15, n + q); }
          continue;
        }
        if (th === "lagoon") {
          // The lagoon at the far corner: clear water inside a sandy shore, a wooden pier out
          // over it with a boat moored at its end, and a lifeguard's tower.
          P(lotSlab(), sandM);
          P(roundSlab(3.6, 3.6, 1.4, 0.05).translate(0.15, 0.07, 0.15), sea);
          const Q = facing(1, 1);
          Q(new THREE.BoxGeometry(0.5, 0.06, 3.6).translate(0, 0.24, 0.1), wood);
          for (let q = 0; q < 5; q++) for (const ox of [-0.24, 0.24]) Q(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 5).translate(ox, 0.14, -1.4 + q * 0.8), wood);
          Q(new THREE.BoxGeometry(1.3, 0.06, 0.5).translate(0, 0.24, 1.65), wood);
          Q(new THREE.BoxGeometry(0.34, 0.14, 0.8).translate(0.6, 0.15, 1.0), white);
          Q(new THREE.BoxGeometry(0.22, 0.12, 0.3).translate(0.6, 0.27, 0.85), mats.c("#2fb8e8", 0.5));
          Q(new THREE.BoxGeometry(0.3, 0.12, 0.7).translate(-0.6, 0.15, 0.9), mats.c("#ff5f6d", 0.5));
          const W = facing(1, -1);
          for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) W(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5).translate(1.75 + ox, 0.6, oz), white);
          W(new THREE.BoxGeometry(0.6, 0.35, 0.6).translate(1.75, 1.35, 0), mats.c("#ff5f6d", 0.6));
          W(new THREE.ConeGeometry(0.5, 0.3, 4).rotateY(Math.PI / 4).translate(1.75, 1.68, 0), white);
          palm(P, -1.75, -1.7, 1, n);
          continue;
        }
        if (th === "beach") {
          // The beach: sand down to the water's edge, loungers under umbrellas in rows, a
          // volleyball net and a ball.
          P(lotSlab(), sandM);
          const Q = facing(i === 3 ? 1 : 0, i === 3 ? 0 : 1);
          Q(new THREE.BoxGeometry(4.2, 0.05, 1.1).translate(0, 0.1, 1.5), sea);
          Q(new THREE.BoxGeometry(4.2, 0.05, 0.2).translate(0, 0.105, 0.9), own(std("#e6fbfc", { roughness: 0.4 })));
          for (let q = 0; q < 4; q++) { const qx = -1.5 + q * 1.0; lounger(Q, qx - 0.18, 0.2, Math.PI, shade[(q + n) % shade.length]); lounger(Q, qx + 0.18, 0.2, Math.PI, shade[(q + n + 2) % shade.length]); umbrella(Q, qx, -0.2, shade[(q + n + 1) % shade.length]); }
          for (const ox of [-0.9, 0.9]) Q(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5).translate(ox, 0.5, -1.45), white);
          Q(new THREE.BoxGeometry(1.8, 0.3, 0.02).translate(0, 0.8, -1.45), white);
          Q(new THREE.SphereGeometry(0.1, 8, 6).translate(0.4, 0.2, -1.05), mats.c("#ffd23a", 0.4));
          continue;
        }
      }
      P(lotSlab(), n % 2 ? grass : grass2);
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
    // Along the sidewalks round every block, two to a side: trees in the district's own style
    // (palms by the harbor, golden lamps and topiary in the clouds, crystals, landing lights).
    if (bought) {
      const sideG = new THREE.Group(), S2 = (geo: THREE.BufferGeometry, m: THREE.Material) => sideG.add(new THREE.Mesh(geo, m));
      const glowS = theme === "crystal" || theme === "orbit" ? own(std(theme === "orbit" ? "#5ae0ff" : "#b9a0ff", { roughness: 0.2, emissive: new THREE.Color(theme === "orbit" ? "#5ae0ff" : "#9a7aff"), emissiveIntensity: 0.7, flatShading: true })) : null;
      const pine = mats.c("#2f7a45", 0.8);
      // (Downtown's street trees from the model kit, when it's loaded.)
      const sideN = new NatureBatch();
      const kitTree = (tx: number, y: number, tz: number, v: number, name = v % 2 ? "tree_fat" : "tree_oak"): boolean => {
        // (Palms and park trees: drawn in code; downtown keeps its kit street trees.)
        if (name === "tree_palm") { sideN.tree("palm", tx, y, tz, 0.5, v + Math.round(tx * 3 + tz * 5)); return true; }
        if (id === "lakeside") { sideN.tree(name === "tree_pine" ? "pine" : name === "tree_fat" ? "maple" : "oak", tx, y, tz, 0.45, v + Math.round(tx * 3 + tz * 5)); return true; }
        const kt = kitPlace(name, name === "tree_palm" ? 0.9 : 0.75, name === "tree_palm" ? 1.2 : 1);
        if (!kt) return false;
        kt.obj.position.set(tx, y, tz); kt.obj.rotation.y = v;
        sideG.add(kt.obj);
        return true;
      };
      for (let i = 0; i < DIST_N; i++) for (let j = 0; j < DIST_N; j++) {
        const { x, z } = cellC(i, j), w = 2.36;
        for (const [ox, oz] of [[-w, -1.25], [-w, 1.25], [w, -1.25], [w, 1.25], [-1.25, -w], [1.25, -w], [-1.25, w], [1.25, w]]) {
          const tx = x + ox, tz = z + oz, v = (i * 7 + j * 3 + Math.round(ox * 5 + oz * 3)) & 3, Y0 = 0.18;
          if ((id === "meadow" || id === "resort") && kitTree(tx, Y0, tz, v, "tree_palm")) {
            // (a kit palm)
          } else if (id === "lakeside" && kitTree(tx, Y0, tz, v, v === 3 ? "tree_pine" : v % 2 ? "tree_fat" : "tree_oak")) {
            // (a kit tree)
          } else if (id === "meadow" || id === "resort") {
            S2(new THREE.CylinderGeometry(0.04, 0.06, 1.0, 5).translate(tx, Y0 + 0.5, tz), trunk);
            for (let f = 0; f < 5; f++) S2(new THREE.BoxGeometry(0.55, 0.03, 0.13).translate(0.24, 0, 0).rotateZ(-0.4).rotateY((f / 5) * Math.PI * 2 + v).translate(tx, Y0 + 1.0, tz), leaf);
          } else if (id === "lakeside") {
            S2(new THREE.CylinderGeometry(0.04, 0.06, 0.45, 5).translate(tx, Y0 + 0.22, tz), trunk);
            S2(v === 3 ? new THREE.ConeGeometry(0.3, 0.8, 7).translate(tx, Y0 + 0.75, tz) : new THREE.IcosahedronGeometry(0.33, 0).translate(tx, Y0 + 0.65, tz), v === 3 ? pine : leaf);
          } else if (id === "hills" && kitTree(tx, Y0, tz, v)) {
            S2(new THREE.BoxGeometry(0.34, 0.02, 0.34).translate(tx, Y0 + 0.01, tz), metal);
          } else if (id === "hills") {
            S2(new THREE.BoxGeometry(0.34, 0.02, 0.34).translate(tx, Y0 + 0.01, tz), metal);
            S2(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5).translate(tx, Y0 + 0.27, tz), trunk);
            S2(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 1.2, 1).translate(tx, Y0 + 0.75, tz), leaf);
          } else if (theme === "cloud") {
            if (v % 2) { S2(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 8).translate(tx, Y0 + 0.09, tz), mats.gold); S2(new THREE.SphereGeometry(0.2, 8, 6).translate(tx, Y0 + 0.38, tz), mats.c("#7fcf8a", 0.8)); S2(new THREE.SphereGeometry(0.13, 8, 6).translate(tx, Y0 + 0.66, tz), mats.c("#7fcf8a", 0.8)); }
            else { S2(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 6).translate(tx, Y0 + 0.45, tz), mats.gold); S2(new THREE.SphereGeometry(0.09, 8, 6).translate(tx, Y0 + 0.95, tz), lampMat); }
          } else if (glowS) {
            if (theme === "crystal") S2(new THREE.OctahedronGeometry(0.18, 0).scale(1, 2.8 + v * 0.6, 1).translate(tx, Y0 + 0.5, tz), glowS);
            else { S2(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6).translate(tx, Y0 + 0.45, tz), metal); S2(new THREE.BoxGeometry(0.3, 0.08, 0.12).translate(tx, Y0 + 0.92, tz), glowS); }
          }
        }
      }
      G.add(sideG);
      mergeStatic(sideG, 0.0);
      { const nm = sideN.mesh(); if (nm) sideG.add(nm); }
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
      const crystM: THREE.Material[] = [];
      const orbGlass = own(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 }));
      const orbLight = own(std("#5ae0ff", { roughness: 0.3, emissive: 0x5ae0ff, emissiveIntensity: 1.2 }));
      for (let x = -DIST_H; x <= DIST_H; x += 0.9) for (let z = -DIST_H; z <= DIST_H; z += 0.9) {
        const jx = x + Math.sin(n2 * 12.99 + ks) * 0.35, jz = z + Math.cos(n2 * 78.2 + ks) * 0.35, r = Math.abs(Math.sin(n2 * 3.7 + ks));
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
          else if (r < 0.26) { R(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6).translate(jx, 0.45, jz), trunk); R(new THREE.ConeGeometry(0.42, 1.2, 7).translate(jx, 1.3, jz), mats.c("#2f7a45", 0.8)); }
          else if (r < 0.29) { R(new THREE.BoxGeometry(0.6, 0.05, 0.2).rotateY(n2).translate(jx, 0.25, jz), wood); R(new THREE.BoxGeometry(0.6, 0.2, 0.04).translate(0, 0, -0.1).rotateY(n2).translate(jx, 0.38, jz), wood); }
          else if (r < 0.32) R(new THREE.BoxGeometry(0.8, 0.35, 0.3).rotateY(Math.round(n2 % 2) * Math.PI / 2).translate(jx, 0.18, jz), leaf);
          else if (r < 0.42) for (let f = 0; f < 5; f++) R(new THREE.SphereGeometry(0.07, 5, 4).translate(jx + Math.cos(f * 1.3) * 0.18, 0.1, jz + Math.sin(f * 1.3) * 0.18), mats.c(flowersOn[(n2 + f) % 4], 0.8));
        } else if (theme === "cloud") {
          // Cloud Kingdom: puffs of cloud drifting on the marble, golden lamps.
          if (r < 0.14) R(new THREE.SphereGeometry(0.45 + r * 2, 10, 8).scale(1.3, 0.6, 1.3).translate(jx, 0.2, jz), m2("#ffffff", 1, 0));
          else if (r < 0.19) { R(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(jx, 0.7, jz), mats.gold); R(new THREE.SphereGeometry(0.13, 8, 6).translate(jx, 1.45, jz), lampMat); }
          else if (r < 0.25) { R(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 10).translate(jx, 0.13, jz), mats.gold); R(new THREE.ConeGeometry(0.22, 0.75, 10).translate(jx, 0.62, jz), mats.c("#7fcf8a", 0.8)); }
          else if (r < 0.27) { R(new THREE.CylinderGeometry(0.4, 0.45, 0.16, 16).translate(jx, 0.08, jz), m2("#fbf8ff", 0.5, 0)); R(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16).translate(jx, 0.17, jz), water); R(new THREE.SphereGeometry(0.1, 8, 6).translate(jx, 0.32, jz), mats.gold); }
        } else if (theme === "crystal") {
          // Crystal Spire: little crystals growing out of the ground.
          const cc = ["#9a7aff", "#7ad0ff", "#ff8ae0"][n2 % 3], cm2 = crystM[n2 % 3] ??= own(std(cc, { roughness: 0.15, emissive: new THREE.Color(cc), emissiveIntensity: 0.5, flatShading: true }));
          if (r < 0.16) R(new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.8 + r * 4, 1).translate(jx, 0.3, jz), cm2);
          else if (r < 0.24) for (let f = 0; f < 3; f++) R(new THREE.OctahedronGeometry(0.16, 0).scale(1, 2.2 + f, 1).rotateZ((f - 1) * 0.35).translate(jx + (f - 1) * 0.18, 0.35 + f * 0.1, jz), cm2);
          else if (r < 0.27) R(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 14).translate(jx, 0.03, jz), cm2);
        } else if (theme === "orbit") {
          // Orbit Station: solar panels and antennas.
          if (r < 0.12) { R(new THREE.BoxGeometry(0.9, 0.04, 0.6).rotateX(-0.5).translate(jx, 0.35, jz), m2("#2a3f8a", 0.2, 0.6)); R(new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(jx, 0.15, jz), metal); }
          else if (r < 0.17) { R(new THREE.CylinderGeometry(0.42, 0.45, 0.12, 14).translate(jx, 0.06, jz), metal); R(new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(jx, 0.12, jz), orbGlass); }
          else if (r < 0.22) R(new THREE.BoxGeometry(0.14, 0.05, 0.14).translate(jx, 0.03, jz), orbLight);
          else if (r < 0.25) { R(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5).translate(jx, 0.6, jz), metal); R(new THREE.SphereGeometry(0.08, 6, 4).translate(jx, 1.25, jz), own(new THREE.MeshBasicMaterial({ color: 0xff3a4a }))); }
        } else {
          // Downtown: a paved promenade with planters, benches and lamps.
          if (r < 0.1) { R(new THREE.BoxGeometry(0.45, 0.28, 0.45).translate(jx, 0.18, jz), stone); R(new THREE.IcosahedronGeometry(0.24, 0).translate(jx, 0.45, jz), leaf); }
          else if (r < 0.2) { R(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10).translate(jx, 0.07, jz), stone); R(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 6).translate(jx, 0.5, jz), trunk); R(new THREE.IcosahedronGeometry(0.45, 0).translate(jx, 1.1, jz), leaf); }
          else if (r < 0.24) { R(new THREE.BoxGeometry(0.6, 0.05, 0.2).rotateY(n2).translate(jx, 0.25, jz), wood); R(new THREE.BoxGeometry(0.6, 0.2, 0.04).translate(0, 0, -0.1).rotateY(n2).translate(jx, 0.38, jz), wood); }
          else if (r < 0.25) { R(new THREE.BoxGeometry(0.5, 0.5, 0.4).translate(jx, 0.25, jz), mats.c(["#ff5f6d", "#2f9bff", "#ffd23a"][n2 % 3], 0.6)); R(new THREE.BoxGeometry(0.62, 0.06, 0.52).translate(jx, 0.53, jz), mats.c("#ffffff", 0.6)); }
          else if (r < 0.29) { R(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6).translate(jx, 0.7, jz), metal); R(new THREE.SphereGeometry(0.12, 8, 6).translate(jx, 1.45, jz), lampMat); }
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
      const ac = ["#2f9bff", "#ff8a5c", "#8a6cff", "#e8b020", "#b05aff", "#2a8fd0", "#ff7a59"][ks] ?? "#2f9bff";
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
      // (On the city grid the district's streets join the grid's: no gate or ring round it.)
      const onGrid = landJoin(k) === "ground";
      if (bought && !onGrid) G.add(arch);
      if (bought && !onGrid) G.add(rim);
      if (bought && !onGrid) mergeStatic(rim, 0.0);
    }
    planarUV(blocks, streetUV);
    mergeStatic(blocks, 0.2);
    if (!bought) {
      // For sale: a glowing outline round the island and a gentle bob.
      const glowM = own(new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.85 }));
      glowM.userData.dynamic = true;
      for (let a = 0; a < outlineD.length; a++) { const [px, pz] = outlineD[a], [qx, qz] = outlineD[(a + 1) % outlineD.length]; if (a % 2) continue; L(new THREE.BoxGeometry(0.16, 0.06, Math.hypot(qx - px, qz - pz) * 0.9).rotateY(Math.atan2(qx - px, qz - pz)).translate((px + qx) / 2 * 0.985, 0.16, (pz + qz) / 2 * 0.985), glowM); }
      townTicks.push(t => { glowM.opacity = 0.55 + Math.sin(t * 3 + ks) * 0.35; if (!embedded) G.position.y = -0.6 + Math.sin(t * 0.4 + ks * 2) * 0.05; });
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
    // Little floating rocks round the sky lift's walkway.
    for (let r2 = 0; r2 < (landJoin(k) === "lift" ? 3 : 0); r2++) {
      const side = r2 % 2 ? 1 : -1, along = distEdge(ux, uz) + DIST_GAP * (0.3 + r2 * 0.25), off = side * (3 + r2 * 1.3);
      const rx = -ux * along + uz * off, rz = -uz * along - ux * off, rr = 0.7 + (r2 % 2) * 0.4, ry = -1.2 - r2 * 0.7;
      const isle = new THREE.Group();
      isle.add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.92, 0.18, 9).translate(0, -0.09, 0), verge));
      isle.add(new THREE.Mesh(new THREE.ConeGeometry(rr * 0.9, rr * 2.2, 7).rotateX(Math.PI).translate(0, -0.18 - rr * 1.1, 0), r2 % 2 ? rock : rockDark));
      if (r2 !== 1) { isle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6).translate(0, 0.25, 0), trunk)); isle.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0).translate(0, 0.62, 0), leaf)); }
      isle.position.set(rx, ry, rz);
      isle.userData.dynamic = true;
      G.add(isle);
      townTicks.push(t => { isle.position.y = ry + Math.sin(t * 0.5 + r2 * 2 + ks) * 0.12; });
    }
    if (bought) {
      // Life in the district: cars round its streets (both ways), people on its sidewalks.
      const ring = (r: number) => new Path([new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 0, -r), new THREE.Vector3(r, 0, r), new THREE.Vector3(-r, 0, r)]);
      const roads = [ring(C - LANE), ring(C + LANE), ring(2 * C - LANE)];
      const walks = [ring(C - ROAD - 0.32), ring(C + ROAD + 0.32), ring(2 * C - ROAD - 0.32)];
      const dCars = Array.from({ length: 9 }, (_, n) => {
        const m = new THREE.Mesh(carGeo(BODY[(n * 3 + ks) % BODY.length], n % 4 === 2), carM);
        G.add(m);
        return { m, path: roads[n % 3], u: n / 9, sp: (n % 3 === 1 ? -1 : 1) * (0.012 + (n % 4) * 0.002) };
      });
      const dWalk = Array.from({ length: 14 }, (_, n) => {
        const pp = makePerson(shirts[(n + ks) % shirts.length]);
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
      } else if (id === "canal") {
        // A striped hot-air balloon drifting slowly over the rooftops.
        const bal = new THREE.Group(), cols5 = ["#ff5f6d", "#ffd23a", "#3a8dff", "#ffffff"];
        for (let q = 0; q < 8; q++) bal.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 12, (q / 8) * Math.PI * 2, Math.PI / 4).scale(1, 1.15, 1), mats.c(cols5[q % cols5.length], 0.6)));
        bal.add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.7, 12, 1, true).rotateX(Math.PI).translate(0, -1.2, 0), mats.c("#ff5f6d", 0.6)));
        for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) bal.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4).translate(ox, -1.75, oz), metal));
        bal.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42).translate(0, -2.15, 0), mats.c("#8a5a30", 0.8)));
        bal.userData.dynamic = true;
        G.add(bal);
        townTicks.push(t => { const a = t * 0.035; bal.position.set(Math.cos(a) * DIST_H * 0.55, 14 + Math.sin(t * 0.3) * 0.8, Math.sin(a) * DIST_H * 0.55); bal.rotation.y = t * 0.1; });
      } else if (id === "resort") {
        // A little seaplane round the resort, towing a banner with its name.
        const plane = new THREE.Group(), red = mats.c("#ff5f6d", 0.5), wht = mats.c("#ffffff", 0.45);
        plane.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 1.3, 10).rotateX(Math.PI / 2), wht));
        plane.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.34).translate(0, 0.14, 0.12), red));
        plane.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.2).translate(0, 0.05, -0.58), red));
        plane.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.2).translate(0, 0.18, -0.58), red));
        for (const sd of [-0.45, 0.45]) { plane.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.9).translate(sd, -0.32, 0.05), wht)); plane.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(sd, -0.15, 0.1), metal)); }
        const prop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.02).translate(0, 0, 0.67), metal);
        prop.userData.dynamic = true; plane.add(prop);
        const bc = document.createElement("canvas"); bc.width = 512; bc.height = 64;
        const bx = bc.getContext("2d");
        if (bx) { bx.fillStyle = "#fff6e0"; bx.fillRect(0, 0, 512, 64); bx.fillStyle = "#ff5f6d"; bx.font = "bold 40px Arial Black, sans-serif"; bx.textAlign = "center"; bx.textBaseline = "middle"; bx.fillText("☀ " + LAND[k].name.toUpperCase() + " ☀", 256, 34, 500); }
        const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
        const bannerM = own(new THREE.MeshBasicMaterial({ map: btex, side: THREE.DoubleSide })); bannerM.userData.dynamic = true;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4).rotateY(Math.PI / 2).translate(0, 0, -2.6), bannerM);
        banner.userData.dynamic = true; plane.add(banner);
        plane.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.95).translate(0, 0, -0.95), metal));
        plane.userData.dynamic = true;
        G.add(plane);
        const R2 = DIST_H * 0.75;
        townTicks.push(t => { const a = t * 0.09; plane.position.set(Math.cos(a) * R2, 12 + Math.sin(t * 0.5) * 0.4, Math.sin(a) * R2); plane.rotation.y = -a; plane.rotation.z = -0.15; prop.rotation.z = t * 30; });
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
        townTicks.push(t => { const a = t * 0.05; ship.position.set(Math.cos(a) * R2, 14 + Math.sin(t * 0.5) * 0.4, Math.sin(a) * R2); ship.rotation.y = -a; });
      }
      // More life in the air: seagulls over the harbor, a helicopter over Downtown, a rainbow
      // over Cloud Kingdom, a shuttle coming and going at Orbit Station.
      if (id === "meadow" || id === "resort") {
        const gullM = mats.c("#ffffff", 0.6), gulls: THREE.Group[] = [];
        for (let g5 = 0; g5 < 5; g5++) {
          const gl = new THREE.Group(), wings: THREE.Mesh[] = [];
          gl.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.32), gullM));
          for (const sd of [-1, 1]) { const w5 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14).translate(sd * 0.21, 0, 0), gullM); gl.add(w5); wings.push(w5); }
          gl.userData.dynamic = true; gl.userData.wings = wings; G.add(gl); gulls.push(gl);
        }
        townTicks.push(t => gulls.forEach((gl, g5) => { const a = t * (0.25 + g5 * 0.03) + g5 * 1.3, r5 = 5 + g5 * 1.6; gl.position.set(Math.cos(a) * r5, 4.5 + g5 * 0.5 + Math.sin(t * 0.8 + g5) * 0.3, Math.sin(a) * r5); gl.rotation.y = -a; const fl5 = Math.sin(t * 7 + g5) * 0.5; (gl.userData.wings as THREE.Mesh[]).forEach((w5, s5) => { w5.rotation.z = s5 ? fl5 : -fl5; }); }));
      } else if (id === "hills") {
        const heli = new THREE.Group();
        heli.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8).scale(1, 0.8, 1.4), mats.c("#e2453c", 0.4, 0.2)));
        heli.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6).scale(1, 0.8, 1).translate(0, 0.05, 0.35), winMat));
        heli.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1).translate(0, 0.1, -0.9), mats.c("#e2453c", 0.4, 0.2)));
        heli.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.18).translate(0.05, 0.2, -1.42), metal));
        for (const sd of [-1, 1]) heli.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.9).translate(sd * 0.3, -0.42, 0), metal));
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.1), metal);
        rotor.position.y = 0.42; rotor.userData.dynamic = true; heli.add(rotor);
        heli.userData.dynamic = true; G.add(heli);
        townTicks.push(t => { const a = -t * 0.18; heli.position.set(Math.cos(a) * DIST_H * 0.6, 13 + Math.sin(t * 0.6) * 0.5, Math.sin(a) * DIST_H * 0.6); heli.rotation.y = -a + Math.PI; heli.rotation.z = 0.12; rotor.rotation.y = t * 25; });
      } else if (theme === "cloud") {
        const rainbow = new THREE.Group(), cols = ["#ff5f6d", "#ff9a4a", "#ffd23a", "#5ee0a0", "#4f8bff", "#9a6cff"];
        cols.forEach((c5, i5) => rainbow.add(new THREE.Mesh(new THREE.TorusGeometry(DIST_H * 0.95 - i5 * 0.45, 0.24, 6, 48, Math.PI), own(new THREE.MeshBasicMaterial({ color: c5, transparent: true, opacity: 0.55, depthWrite: false })))));
        // (Turned to face the town's camera, so it reads as an arch over the island and never
        // edge-on as a thin line.)
        rainbow.rotation.y = Math.PI / 4;
        rainbow.position.y = -1.5;
        for (const sd of [-1, 1]) rainbow.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8).scale(1.5, 0.7, 1.5).translate(sd * (DIST_H * 0.95 - 1.1), 0.3, 0), m2("#ffffff", 1, 0)));
        G.add(rainbow);
      } else if (theme === "orbit") {
        const sh5 = new THREE.Group();
        sh5.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.42, 1.4, 10).rotateX(Math.PI / 2), m2("#ffffff", 0.3, 0.3)));
        sh5.add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 10).rotateX(Math.PI / 2).translate(0, 0, 0.95), m2("#ffffff", 0.3, 0.3)));
        sh5.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5).translate(0, -0.1, -0.3), m2("#3a4160", 0.4, 0.4)));
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8).rotateX(-Math.PI / 2).translate(0, 0, -1.05), own(new THREE.MeshBasicMaterial({ color: 0x8af0ff, transparent: true, opacity: 0.8 })));
        flame.userData.dynamic = true; sh5.add(flame);
        sh5.userData.dynamic = true; G.add(sh5);
        townTicks.push(t => { const a = t * 0.3; sh5.position.set(Math.cos(a) * DIST_H * 1.25, 4 + Math.sin(a * 0.5) * 3, Math.sin(a) * DIST_H * 1.25); sh5.rotation.y = -a; flame.scale.z = 0.8 + Math.sin(t * 20) * 0.2; });
      }
      // A waterfall: Garden Hills' lake and the Harbor's sea spill over the island's front edge,
      // falling away into the sky in a veil that fades out, with a cloud of spray.
      if (!ground && (id === "lakeside" || id === "meadow")) {
        const an0 = Math.PI / 4, cands = [an0 - 0.5, an0 + 0.5];
        const an = cands.reduce((b, a) => (Math.cos(a) * -ux + Math.sin(a) * -uz < Math.cos(b) * -ux + Math.sin(b) * -uz ? a : b));
        const dx5 = Math.cos(an), dz5 = Math.sin(an), edge = distEdge(dx5, dz5) * 0.985, H5 = 14, W5 = 1.6;
        const fc = document.createElement("canvas"); fc.width = 32; fc.height = 128;
        const fx = fc.getContext("2d");
        if (fx) { fx.fillStyle = "#bfe9ff"; fx.fillRect(0, 0, 32, 128); for (let q = 0; q < 40; q++) { fx.fillStyle = q % 3 ? "rgba(255,255,255,0.7)" : "rgba(90,170,230,0.6)"; fx.fillRect((q * 7) % 32, (q * 37) % 128, 2 + (q % 3), 10 + (q % 5) * 6); } }
        const ftex = new THREE.CanvasTexture(fc); ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(1, 3); ftex.colorSpace = THREE.SRGBColorSpace;
        const ac = document.createElement("canvas"); ac.width = 4; ac.height = 64;
        const ax = ac.getContext("2d");
        if (ax) { const gr = ax.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, "#bbbbbb"); gr.addColorStop(1, "#000000"); ax.fillStyle = gr; ax.fillRect(0, 0, 4, 64); }
        const fallM = own(new THREE.MeshBasicMaterial({ map: ftex, alphaMap: new THREE.CanvasTexture(ac), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        fallM.userData.dynamic = true;
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(W5, H5).translate(0, -H5 / 2 + 0.1, 0), fallM);
        fall.position.set(dx5 * edge, 0.05, dz5 * edge); fall.rotation.y = Math.atan2(dx5, dz5);
        fall.userData.dynamic = true; G.add(fall);
        // The stream across the edge to the fall.
        L(new THREE.BoxGeometry(W5, 0.04, 3.2).translate(0, 0.06, -1.5).rotateY(Math.atan2(dx5, dz5)).translate(dx5 * edge, 0, dz5 * edge), water);
        const mist: THREE.Mesh[] = [];
        for (let m5 = 0; m5 < 4; m5++) { const ms = new THREE.Mesh(new THREE.SphereGeometry(0.9 + m5 * 0.2, 10, 8), own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }))); ms.userData.dynamic = true; G.add(ms); mist.push(ms); }
        townTicks.push(t => { ftex.offset.y = t * 1.6; mist.forEach((ms, m5) => { const ph = (t * 0.35 + m5 / 4) % 1; ms.position.set(dx5 * (edge + 0.6) + Math.sin(m5 * 2) * 0.5, -H5 * 0.55 - ph * 2, dz5 * (edge + 0.6) + Math.cos(m5 * 2) * 0.5); ms.scale.setScalar(0.6 + ph); (ms.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - ph); }); });
      }
      // Vines hanging down the district's cliff.
      for (let a = 0; a < (ground ? 0 : outlineD.length); a += 15) { const [vx, vz] = outlineD[a], len = 0.4 + Math.abs(Math.sin(a * 2.7 + ks)) * 0.9; L(new THREE.BoxGeometry(0.08, len, 0.08).translate(vx * 0.99, -len / 2 - 0.02, vz * 0.99), leaf); }
    }
    landSeen.add(id);
    // (The camera looks a little further back for a higher island: that's where it shows.)
    landmarks[100 + k] = () => ({ x: sp.x - sp.y, z: sp.z - sp.y, zoom: 0.8 });
  });

  // (From now on, newly bought land animates in.)
  for (const l of cafe.land ?? []) if (l.bought) landSeen.add(l.id);
  landBuiltOnce = true;
  { const nm = nature.mesh(); if (nm) g.add(nm); }
  for (const [list, m] of [[paintAll, paintM], [yellowAll, yellowM]] as [THREE.BufferGeometry[], THREE.Material][]) {
    if (!list.length) continue;
    const mg = mergeGeometries(list.map(q => (q.index ? q.toNonIndexed() : q))); list.forEach(q => q.dispose());
    if (mg) { mg.deleteAttribute("uv"); add(mg, m); }
  }
  if (blobGeos.length) { const bg = mergeGeometries(blobGeos); blobGeos.forEach(q => q.dispose()); if (bg) add(bg, blobM); }
  bendTown(g, bendPts);
  planarUV(g, streetUV);
  mergeStatic(g, 0.0);
  // (Buildings, walls, lamps and trees cast real shadows on the streets and lawns.)
  castShadows(g);
  crowdKit.build();
  townTicks.push(() => crowdKit.update());

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
  // Winter Lights: strings of bulbs on the street lamps.
  // The season's string lights on the street lamps (bunting colours in summer).
  const se = cafe.season ? seasonInfo(cafe.season) : undefined;
  if (se && lampAt.length) townTicks.push(lampLights(g, lampAt, se.bulbs));
  // A snow day: snowmen on a few lawns once the snow has settled.
  {
    const melt = snowmen(g, snowSpots.slice(0, 6), own);
    let t0 = 0;
    townTicks.push(t => { melt(look.snow ?? 0, t0 ? Math.min(0.1, t - t0) : 0); t0 = t; });
  }
  return {
    group: g,
    top: i => (i === -1 ? plotTop : i === -4 ? hallTop : i <= -10 ? 1.3 : i < -1 ? 1.4 : tops[i] ?? 2),
    resident: () => block.resident(),
    landmark: r => (landmarks[r] ? landmarks[r]() : null),
    spot: id => (id === "hall" ? hallAt ?? { x: 0, z: 0 } : id === "bottle" ? bottleSpot ?? { x: 0, z: 0 } : block.spot(id)),
    landAt: k => landShown[k] ?? null,
    homes: () => homeSpots,
    designs: () => [...designsSeen],
    walker: k => (walkers.length ? walkers[((k % walkers.length) + walkers.length) % walkers.length].p.position : null),
    sights: () => {
      // (The rank landmarks that stay put: the market, the tram stop, the billboards, the
      // yacht, the golden tower and the floating island.)
      const out = [...sightSpots];
      const iy = (n: number) => islets[n]?.o.position.y ?? 0;
      for (const r of [1, 2, 3, 5, 6, 7]) {
        const lm = landmarks[r]?.();
        if (!lm) continue;
        const y = r === 6 ? iy(0) : r === 7 ? iy(1) : r === 5 && !yachtAt ? iy(1) : 0;
        out.push({ x: lm.x, z: lm.z, y, top: r === 6 ? 6 : 2, kind: `rank${r}`, key: `rank${r}` });
      }
      return out;
    },
    bizAt: i => bizSpots[i] ?? null,
    paradeRoute: want => paradeRoute(want),
    paradeQuiet: on => { paradeQuiet = on; },
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
      beachLive(t, night, live);
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
      // A business that just levelled up: a ring of light spreads round it and sparkles spiral
      // up (gold; a milestone or a new business gets two rings and twice the sparkles).
      if (live.boostAt && live.boostAt !== boostSeen) {
        boostSeen = live.boostAt;
        const lg = lotGroups.get(live.boost ?? "");
        if (lg && Date.now() - live.boostAt < 1000) {
          const big = !!live.boostBig, o = new THREE.Group(), mats: THREE.MeshBasicMaterial[] = [];
          const mk = (c: number) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); mats.push(m); return m; };
          const rings = (big ? [0xffd23f, 0xb48cff] : [0xffd23f]).map((c, i) => { const r = new THREE.Mesh(boostRingGeo, mk(c)); r.position.y = 0.28 + i * 0.02; o.add(r); return r; });
          const sm = mk(big ? 0xfff0a0 : 0xffe27a), sm2 = big ? mk(0xd8c0ff) : sm;
          const sparks = Array.from({ length: big ? 16 : 8 }, (_, i) => { const sp = new THREE.Mesh(sparkGeo, i % 2 ? sm2 : sm); o.add(sp); return sp; });
          lg.add(o);
          boostFx.push({ o, rings, sparks, mats, at: t, big, par: lg });
        }
      }
      for (let i = boostFx.length - 1; i >= 0; i--) {
        const f = boostFx[i], k = (t - f.at) / (f.big ? 1.3 : 0.9);
        if (k >= 1) { f.par.remove(f.o); f.mats.forEach(m => m.dispose()); boostFx.splice(i, 1); continue; }
        g.userData.moving = true;
        f.rings.forEach((r, j) => { const kk = Math.max(0, k * 1.25 - j * 0.25); r.scale.setScalar(0.6 + kk * 2.6); (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - kk)); });
        // (The parent squashes as it bounces; undo it so the sparkles keep their shape.)
        const sy = 1 / (f.par.scale.y || 1);
        f.sparks.forEach((sp, j) => {
          const n = f.sparks.length, a = (j / n) * Math.PI * 2 + k * 3.2, rad = 1.1 + (j % 3) * 0.35 + k * 0.6, h = 0.4 + k * (2.2 + (j % 4) * 0.45);
          sp.position.set(Math.cos(a) * rad, h * sy, Math.sin(a) * rad);
          sp.rotation.y = t * 6 + j;
          sp.scale.setScalar(Math.max(0.01, (1 - k) * (1 + Math.sin(k * 9 + j) * 0.3)));
        });
        f.mats.forEach(m => { if (!f.rings.some(r => r.material === m)) m.opacity = Math.min(1, (1 - k) * 1.6); });
      }
      // A building that just sold bounces.
      const now = Date.now();
      for (const [id, lg] of lotGroups) {
        if (risingNow.has(lg)) continue;
        // (A springy squash and stretch: up tall, a little squash on the way down, settle.)
        const k = id === live.pulse ? (now - (live.pulseAt ?? 0)) / 560 : 1;
        if (k >= 0 && k < 1) { g.userData.moving = true; const b = Math.sin(k * Math.PI * 2.2) * Math.pow(1 - k, 1.6); lg.scale.set(1 - b * 0.08, 1 + b * 0.2, 1 - b * 0.08); }
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
      // The queues: people waiting in a line along the sidewalk, shuffling a little.
      for (const q of queues) {
        const d = doors.get(q.id);
        if (!d) continue;
        const lp = lotPos(q.i);
        q.ps.forEach((p, k) => {
          const along = 0.45 + k * 0.32, sway = Math.sin(t * 1.3 + k * 1.7) * 0.03;
          p.position.set(d.x + Math.sin(lp.a) * along + Math.cos(lp.a) * (0.5 + sway), 0.2 + Math.abs(Math.sin(t * 2 + k)) * 0.015, d.z + Math.cos(lp.a) * along - Math.sin(lp.a) * (0.5 + sway));
          p.rotation.y = lp.a + Math.PI * 1.5;
        });
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
function setLand(bought: number[], grow = 0, sale: number[] = []): void {
  landKey = bought.join(",") + "|" + grow + "|" + sale.join(",");
  landPts = [];
  // The ground districts are part of the town's own land: its coast takes in their corners,
  // so the city is one island with one coastline, one cliff and one railing all round.
  for (const k of bought) {
    if (landJoin(k) !== "ground") continue;
    const sp = landSpot(k, true);
    for (let a = 0; a < 24; a++) { const an = (a / 24) * Math.PI * 2, c = Math.cos(an), s2 = Math.sin(an), r = distEdge(c, s2) - 2.2; landPts.push([sp.x + c * r, sp.z + s2 * r]); }
  }
  // (Then round the whole thing off: a soft rounded square round everything, so the island
  // is a full, rounded shape, never a long point or a wedge.)
  if (landPts.length) {
    const all = [...landPts, ...makeOutline(ISLAND_PAD, [])];
    const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), z0 = Math.min(...all.map(p => p[1])), z1 = Math.max(...all.map(p => p[1]));
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2;
    for (let a = 0; a < 64; a++) { const an = (a / 64) * Math.PI * 2, c = Math.cos(an), s2 = Math.sin(an), k = Math.pow(Math.pow(Math.abs(c), 3) + Math.pow(Math.abs(s2), 3), -1 / 3); landPts.push([mx + c * rx * k * 0.97, mz + s2 * rz * k * 0.97]); }
  }
  // The city grid: the island's land past the town and its districts is laid out in whole
  // blocks of the town's own street grid, grown street by street out from the town (so every
  // street joins up), and the coast is drawn round those blocks (never through one).
  gridOut = [];
  if (grow > 0) {
    // Where the city can spread: the land round the town and its districts and a few blocks
    // further out; the island grows with it.
    const shape = makeOutline(ISLAND_PAD + 2.5 * C, landPts);
    // (Ground districts on sale too: the grid leaves their spot for them.)
    const dists = [...bought, ...sale].filter(k => landJoin(k) === "ground").map(k => landSpot(k, true));
    const inDist = (x: number, z: number) => dists.some(sp => Math.abs(x - sp.x) < 2 * C - 0.1 && Math.abs(z - sp.z) < 2 * C - 0.1);
    const taken = new Set([...ALL, ...BEACH].map(c => `${c[0]},${c[1]}`));
    const back = cellXZ([0, 0]).z - C / 2;
    const fits = (gx: number, gz: number) => {
      if (taken.has(`${gx},${gz}`)) return false;
      const { x, z } = cellXZ([gx, gz]);
      return !inDist(x, z) && z - C / 2 >= back - 0.01 && insidePoly(shape, x, z, C * 0.3);
    };
    const road = (gx: number, gz: number) => taken.has(`${gx},${gz}`) || (() => { const { x, z } = cellXZ([gx, gz]); return inDist(x, z); })();
    const xs = shape.map(p => p[0]), zs = shape.map(p => p[1]);
    const gx0 = Math.floor((Math.min(...xs) + OFF) / C) - 1, gx1 = Math.ceil((Math.max(...xs) + OFF) / C) + 1, gz0 = Math.floor((Math.min(...zs) + OFF) / C) - 1, gz1 = Math.ceil((Math.max(...zs) + OFF) / C) + 1;
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // (The city spreads out from the middle of town, block by block, nearest first: every new
    // block joins a street that's already there.)
    const tc = ALL.reduce((a, c) => { const p = cellXZ(c); return [a[0] + p.x / ALL.length, a[1] + p.z / ALL.length]; }, [0, 0]);
    const dist = (gx: number, gz: number) => { const p = cellXZ([gx, gz]); return Math.hypot(p.x - tc[0], (p.z - tc[1]) * 1.1) + ((gx * 7 + gz * 13) % 5) * 0.35; };
    const frontier = new Map<string, [number, number]>(), seen = new Set<string>();
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) if (fits(gx, gz) && N4.some(([a, b]) => road(gx + a, gz + b))) { frontier.set(`${gx},${gz}`, [gx, gz]); seen.add(`${gx},${gz}`); }
    while (frontier.size && gridOut.length < grow) {
      let best: [number, number] | null = null, bk = "", bd = Infinity;
      for (const [k, c] of frontier) { const d = dist(c[0], c[1]); if (d < bd) { bd = d; best = c; bk = k; } }
      frontier.delete(bk);
      gridOut.push(best!);
      for (const [a, b] of N4) { const n: [number, number] = [best![0] + a, best![1] + b], key = `${n[0]},${n[1]}`; if (!seen.has(key) && fits(n[0], n[1])) { seen.add(key); frontier.set(key, n); } }
    }
    for (const c of gridOut) { const { x, z } = cellXZ(c); for (const dx of [-1, 1]) for (const dz of [-1, 1]) landPts.push([x + dx * C / 2, z + dz * C / 2]); }
  }
}
/** How many grid blocks the last build showed (newer ones rise up when the city grows). */
let gridShown = 0;
/** The city grid's blocks past the town and its districts (set with the land). */
let gridOut: [number, number][] = [];
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

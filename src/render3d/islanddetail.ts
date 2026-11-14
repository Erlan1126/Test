// The small things that make the island feel lived in: sidewalks and crosswalks, street
// lamps and benches, planters on the plaza, bushes, grass tufts and wild flowers on the
// lawn, picket fences and chimneys on the houses, gear on the neighbors' roofs, a pier on
// the lake and rocks along the island's edge.
//
// Still things share a few colors, so mergeStatic() folds them into a handful of meshes;
// the scattered ones (bushes, tufts, flowers, rocks) are instanced. Either way they cost
// only a few draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash } from "../core/util";
import { ISLAND } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import { HOUSES, LAKE } from "../render/details";
import { EXTRA_NEIGHBORS, NEIGHBORS } from "../render/scenery";
import { FH } from "./geom";
import { addThemeProps } from "./islandtheme";

const I = ISLAND;
const col = (c: string) => new THREE.Color(c);
const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.85, ...o });
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);

export interface DetailOptions {
  theme: IslandTheme;
  has: (i: number) => boolean;
  /** True where something already stands (trees, buildings, ponds...) within r of x, z. */
  blocked: (x: number, z: number, r: number) => boolean;
  anims: ((time: number, night: number) => void)[];
}

/** Whether x, z is on a road, its sidewalks or the plaza. */
function onPaving(x: number, z: number, pad = 0): boolean {
  const p = 2.1 + pad;
  if (Math.abs(x) < 7.8 + pad && Math.abs(z) < 7.8 + pad) return true;           // plaza
  if (x > 6 && Math.abs(z) < p) return true;                                     // road to +x
  if (x < -6 && Math.abs(z) < p) return true;                                    // road to -x
  if (z > 6 && Math.abs(x) < p) return true;                                     // road to +z
  return false;
}

export function addIslandDetail(g: THREE.Group, o: DetailOptions): void {
  const t = o.theme;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // ---- Sidewalks: a raised curb along both sides of each road ----
  const curb = std(t.plaza2, { roughness: 0.75 });
  const edge = std(t.plaza, { roughness: 0.8 });
  const walk = (x0: number, x1: number, z0: number, z1: number) => {
    add(box(x1 - x0, 0.14, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2), curb, false);
  };
  for (const s of [-1, 1]) {
    walk(7.4, I - 0.1, s * 1.75 - 0.35, s * 1.75 + 0.35);    // road to +x
    walk(-I + 0.1, -7.4, s * 1.75 - 0.35, s * 1.75 + 0.35);  // road to -x
    walk(s * 1.75 - 0.35, s * 1.75 + 0.35, 7.4, I - 0.1);    // road to +z
    // Kerb stones: a thin darker line where the sidewalk meets the road.
    add(box(I - 7.5, 0.16, 0.08, (7.4 + I - 0.1) / 2, 0, s * 1.42), edge, false);
    add(box(I - 7.5, 0.16, 0.08, -(7.4 + I - 0.1) / 2, 0, s * 1.42), edge, false);
    add(box(0.08, 0.16, I - 7.5, s * 1.42, 0, (7.4 + I - 0.1) / 2), edge, false);
  }

  // ---- Crosswalks where each road meets the plaza ----
  const paint = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.6 });
  for (let k = -2; k <= 2; k++) {
    const u = k * 0.52;
    add(box(1.1, 0.02, 0.3, 8.4, 0.06, u), paint, false);
    add(box(1.1, 0.02, 0.3, -8.4, 0.06, u), paint, false);
    add(box(0.3, 0.02, 1.1, u, 0.06, 8.4), paint, false);
  }

  // ---- Planters at the plaza's corners and benches along its sides ----
  const stone = std(t.plaza, { roughness: 0.7 });
  const wood = std("#9c6b43", { roughness: 0.75 });
  const iron = std("#59606e", { roughness: 0.5, metalness: 0.3 });
  const hedge = std(t.leaf[0], { roughness: 0.95, flatShading: true });
  for (const [x, z] of [[6.4, 6.4], [-6.4, 6.4], [6.4, -6.4], [-6.4, -6.4]]) {
    add(box(1.3, 0.5, 1.3, x, 0.22, z), stone);
    add(new THREE.IcosahedronGeometry(0.62, 1).scale(1, 0.8, 1).translate(x, 1.15, z), hedge);
  }
  const bench = (x: number, z: number, alongX: boolean) => {
    const [w, d] = alongX ? [1.5, 0.45] : [0.45, 1.5];
    add(box(w, 0.08, d, x, 0.62, z), wood);
    add(box(alongX ? w : 0.08, 0.4, alongX ? 0.08 : d, x + (alongX ? 0 : 0.22), 0.7, z + (alongX ? 0.22 : 0)), wood);
    for (const s of [-1, 1]) add(box(alongX ? 0.08 : d, 0.4, alongX ? d : 0.08, x + (alongX ? s * w * 0.42 : 0), 0.22, z + (alongX ? 0 : s * d * 0.42)), iron);
  };
  for (const s of [-1, 1]) {
    bench(s * 3.4, -6.5, true);
    bench(s * 3.4, 6.5, true);
    bench(-6.5, s * 3.4, false);
    bench(6.5, s * 3.4, false);
  }

  // ---- Street lamps along the sidewalks (the "street lights" upgrade) ----
  if (o.has(3)) {
    const glow = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffd27a, emissiveIntensity: 0.1, roughness: 0.4 });
    glow.userData.dynamic = true; // kept apart from the merge: it brightens at night
    const heads: THREE.BufferGeometry[] = [];
    const lamp = (x: number, z: number) => {
      add(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 6).translate(x, 1.3, z), iron);
      add(new THREE.CylinderGeometry(0.2, 0.14, 0.12, 8).translate(x, 2.66, z), iron);
      heads.push(new THREE.SphereGeometry(0.2, 10, 8).translate(x, 2.5, z));
    };
    for (let u = 10; u < I - 1; u += 5) {
      lamp(u, (u / 5) % 2 ? 1.9 : -1.9);
      lamp(-u, (u / 5) % 2 ? -1.9 : 1.9);
      lamp((u / 5) % 2 ? -1.9 : 1.9, u);
    }
    // All the lamp heads are one mesh (kept out of the static merge: they light up at night).
    const lit = add(mergeGeometries(heads)!, glow, false);
    lit.userData.dynamic = true;
    heads.forEach(h => h.dispose());
    o.anims.push((_t, night) => { glow.emissiveIntensity = 0.1 + night * 2.6; });
  }

  // ---- Houses: picket fences, a garden path and a chimney ----
  const picket = std("#fbfbf7", { roughness: 0.7 });
  const brick = std("#a8553c");
  const path = std("#d8cdb8", { roughness: 0.9 });
  for (const [x, z] of HOUSES) {
    const fx0 = x - 1.8, fx1 = x + 1.8, fz0 = z - 1.6, fz1 = z + 2.2;
    // Rails all round, with a gate gap in front of the door.
    const rail = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      add(box(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, (ax + bx) / 2, 0.42, (az + bz) / 2), picket, false);
      for (let k = 0; k <= Math.round(len / 0.45); k++) {
        const f = k / Math.round(len / 0.45);
        add(box(0.08, 0.55, 0.08, ax + (bx - ax) * f, 0, az + (bz - az) * f), picket);
      }
    };
    if (fx0 > -I + 0.3) rail(fx0, fz0, fx0, fz1);
    if (fx1 < I - 0.3) rail(fx1, fz0, fx1, fz1);
    if (fz0 > -I + 0.3) rail(fx0, fz0, fx1, fz0);
    if (fz1 < I - 0.3) { rail(fx0, fz1, x - 0.45, fz1); rail(x + 0.45, fz1, fx1, fz1); }
    // Stepping stones from the door to the gate.
    for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.26, 0.28, 0.05, 8).translate(x + (k % 2 ? 0.08 : -0.08), 0.025, z + 1.4 + k * 0.35), path, false);
    add(box(0.32, 0.9, 0.32, x + 0.55, 2.0, z - 0.3), brick);
  }

  // ---- Neighbors' roofs: air conditioners, a water tank and an antenna ----
  const metal = std("#c3c9d2", { roughness: 0.45, metalness: 0.5 });
  const tankMat = std("#8d6e63");
  const neighbors = [...NEIGHBORS, ...(o.has(2) ? EXTRA_NEIGHBORS : [])];
  neighbors.forEach((nb, i) => {
    const y = nb.h * FH + 0.2, cx = (nb.x0 + nb.x1) / 2, cz = (nb.z0 + nb.z1) / 2;
    const w = nb.x1 - nb.x0, d = nb.z1 - nb.z0;
    add(box(0.9, 0.5, 0.7, cx - w * 0.22, y, cz + d * 0.2), metal);
    add(box(0.9, 0.5, 0.7, cx - w * 0.22, y, cz - d * 0.05), metal);
    if (i % 2 === 0) {
      add(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 10).translate(cx + w * 0.2, y + 0.75, cz - d * 0.2), tankMat);
      add(new THREE.ConeGeometry(0.62, 0.35, 10).translate(cx + w * 0.2, y + 1.37, cz - d * 0.2), tankMat);
      for (const [a, b] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) add(box(0.06, 0.3, 0.06, cx + w * 0.2 + a, y, cz - d * 0.2 + b), iron);
    } else {
      add(new THREE.CylinderGeometry(0.03, 0.05, 2.2, 4).translate(cx + w * 0.25, y + 1.1, cz + d * 0.25), iron);
    }
  });

  // ---- The lake: a little wooden pier and lily pads ----
  const plank = std("#a47148", { roughness: 0.8 });
  const px = LAKE.x + LAKE.r * 0.4, pz = LAKE.z - LAKE.r - 0.5;
  add(box(0.8, 0.08, 2.0, px, 0.34, pz + 1.0), plank);
  for (const s of [-1, 1]) for (const k of [0, 1.8]) add(box(0.1, 0.42, 0.1, px + s * 0.32, 0, pz + 0.1 + k), plank);
  const pad = new THREE.MeshStandardMaterial({ color: col("#5aa84a"), roughness: 0.8 });
  for (let k = 0; k < 6; k++) {
    const a = k * 1.9 + 0.4, r = LAKE.r * (0.35 + hash(k, 2, 3) * 0.45);
    add(new THREE.CircleGeometry(0.22 + hash(k, 5, 1) * 0.12, 10, 0.4, Math.PI * 1.8).rotateX(-Math.PI / 2).translate(LAKE.x + Math.cos(a) * r, 0.29, LAKE.z + Math.sin(a) * r), pad, false);
  }

  // ---- Scattered: bushes, grass tufts, wild flowers and edge rocks ----
  // Spots already used by bigger scattered things, so nothing lands on top of them.
  const taken: [number, number, number][] = [];
  const pick = (n: number, seed: number, r: number, ok: (x: number, z: number) => boolean) => {
    const out: [number, number, number][] = [];
    for (let i = 0; out.length < n && i < n * 30; i++) {
      const x = (hash(i, seed, 1) * 2 - 1) * (I - 0.8), z = (hash(i, seed, 2) * 2 - 1) * (I - 0.8);
      if (!ok(x, z) || onPaving(x, z, r) || o.blocked(x, z, r)) continue;
      if (out.some(([a, b]) => Math.hypot(a - x, b - z) < r * 2)) continue;
      if (taken.some(([a, b, tr]) => Math.hypot(a - x, b - z) < r + tr)) continue;
      out.push([x, z, hash(i, seed, 3)]);
    }
    if (r >= 0.4) for (const [x, z] of out) taken.push([x, z, r]);
    return out;
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const scatter = (geo: THREE.BufferGeometry, mat: THREE.Material, spots: [number, number, number][], size: (k: number) => [number, number], tint?: (k: number, i: number) => string, cast = true) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    im.count = spots.length;
    spots.forEach(([x, z, k], i) => {
      const [s, sy] = size(k);
      q.setFromAxisAngle(up, k * 6.28);
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, sy, s));
      im.setMatrixAt(i, m4);
      if (tint) im.setColorAt(i, c.set(tint(k, i)));
    });
    im.castShadow = cast; im.receiveShadow = true;
    g.add(im);
    return im;
  };

  // What makes each island its own: candy on Candy Island, lava on the volcano...
  addThemeProps({ g, t, add, pick, scatter, anims: o.anims });

  // Bushes: low round shrubs, more of them toward the island's rim.
  const bushes = pick(46, 11, 0.7, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 9);
  scatter(new THREE.IcosahedronGeometry(0.6, 1).scale(1, 0.75, 1).translate(0, 0.38, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), bushes,
    k => [0.7 + k * 0.6, 0.7 + k * 0.5], (_k, i) => (i % 3 === 0 ? t.leaf[1] : t.leaf[0]));

  // Grass tufts: three thin blades each.
  const blade = new THREE.ConeGeometry(0.05, 0.42, 3).translate(0, 0.21, 0);
  const tuft = mergeTuft(blade);
  const tufts = pick(160, 23, 0.25, () => true);
  scatter(tuft, new THREE.MeshStandardMaterial({ color: col(t.lip), roughness: 1 }), tufts, k => [0.8 + k * 0.6, 0.8 + k * 0.7], undefined, false);

  // Wild flowers in small clusters.
  const flowerSpots: [number, number, number][] = [];
  for (const [x, z, k] of pick(16, 37, 0.9, (fx, fz) => Math.max(Math.abs(fx), Math.abs(fz)) > 8.5)) {
    for (let j = 0; j < 6; j++) flowerSpots.push([x + Math.cos(j * 2.4 + k * 6) * (0.2 + j * 0.09), z + Math.sin(j * 2.4 + k * 6) * (0.2 + j * 0.09), hash(j, k * 100, 4)]);
  }
  const petals = ["#ff6b6b", "#ffd43b", "#f783ac", "#ffffff", "#b197fc", "#74c0fc"];
  scatter(new THREE.SphereGeometry(0.11, 6, 4).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), flowerSpots,
    () => [1, 1], (k) => petals[Math.floor(k * petals.length)], false);

  // Rocks half sunk into the grass along the rim.
  const rimRocks = pick(22, 51, 0.6, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > I - 2.2);
  scatter(new THREE.DodecahedronGeometry(0.45, 0).translate(0, 0.12, 0), new THREE.MeshStandardMaterial({ color: col(t.rockL), roughness: 1, flatShading: true }),
    rimRocks, s => [0.6 + s * 0.9, 0.5 + s * 0.5]);
}

/** Three blades leaning out from one spot, as one geometry. */
function mergeTuft(blade: THREE.BufferGeometry): THREE.BufferGeometry {
  const parts = [0, 2.1, 4.2].map((a, i) => blade.clone().rotateZ(0.28).rotateY(a).scale(1, 0.8 + i * 0.15, 1));
  const pos: number[] = [], nor: number[] = [];
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p;
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

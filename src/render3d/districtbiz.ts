// The districts' businesses: an emblem for each (a fish for the Fish Market, a cone for the
// Ice Cream Parlor...) that stands on its sign and in its picture, and its building: a shop
// from the model kit that grows with its stage, with an awning and a sign in its colors.
import * as THREE from "three";
import type { ModelMats } from "./bizmodels";
import { kitPlace } from "./kitmodels";

type Mats = Pick<ModelMats, "c" | "gold">;

/** The emblem of business `id`, about one unit tall, standing on y = 0. */
export function bizEmblem(id: string, c1: string, c2: string, m: Mats, stage = -1): THREE.Group {
  const root = new THREE.Group(), g = new THREE.Group();
  root.add(g);
  const A = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const me = new THREE.Mesh(geo, mat); g.add(me); return me; };
  // (Glossy, toy-like finishes: they catch the light like the town's signs.)
  const p = m.c(c1, 0.28, 0.08), q = m.c(c2, 0.3, 0.08), w = m.c("#ffffff", 0.35), dk = m.c("#2a2f45", 0.35), gold = m.gold;
  const ph = (r: number, x = 0, y = 0, z = 0, mat = p, sx = 1, sy = 1, sz = 1) => A(new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz).translate(x, y, z), mat);
  const box = (x: number, y: number, z: number, px: number, py: number, pz: number, mat = p) => A(new THREE.BoxGeometry(x, y, z).translate(px, py, pz), mat);
  const cyl = (rt: number, rb: number, h: number, px: number, py: number, pz: number, mat = p, seg = 16) => A(new THREE.CylinderGeometry(rt, rb, h, seg).translate(px, py, pz), mat);
  switch (id) {
    // ---- Harbor District ----
    case "fishmarket": ph(0.32, 0, 0.5, 0, p, 1.5, 0.8, 0.6); A(new THREE.ConeGeometry(0.22, 0.32, 4).rotateZ(Math.PI / 2).translate(-0.6, 0.5, 0), q); ph(0.05, 0.32, 0.56, 0.17, dk); break;
    case "surfshop": A(new THREE.CapsuleGeometry(0.18, 0.75, 4, 12).scale(1, 1, 0.22).translate(0, 0.55, 0), p); box(0.05, 0.9, 0.06, 0, 0.55, 0.03, q); break;
    case "boattours": A(new THREE.CylinderGeometry(0.45, 0.32, 0.22, 4, 1).rotateY(Math.PI / 4).scale(1.4, 1, 0.6).translate(0, 0.15, 0), p); cyl(0.025, 0.025, 0.8, 0, 0.62, 0, w); A(new THREE.ConeGeometry(0.28, 0.6, 3).scale(1, 1, 0.1).translate(0.12, 0.6, 0), w); break;
    case "seafood": A(new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).translate(0, 0.62, 0), dk); for (const x of [-0.22, 0.22]) cyl(0.03, 0.03, 0.5, x, 0.25, 0, dk, 6); ph(0.12, 0, 0.74, 0, p, 1.6, 0.4, 0.8); A(new THREE.ConeGeometry(0.1, 0.25, 8).translate(0.15, 0.95, 0), m.c("#ff8a3b", 0.5)); break;
    case "marina": cyl(0.05, 0.05, 0.85, 0, 0.5, 0, q); A(new THREE.TorusGeometry(0.3, 0.05, 8, 20, Math.PI).rotateZ(Math.PI).translate(0, 0.32, 0), q); box(0.4, 0.06, 0.06, 0, 0.82, 0, q); A(new THREE.TorusGeometry(0.09, 0.03, 6, 14).translate(0, 0.99, 0), q); break;
    case "cruise": box(0.95, 0.28, 0.36, 0, 0.18, 0, w); box(0.8, 0.06, 0.37, 0, 0.06, 0, q); box(0.6, 0.18, 0.3, -0.05, 0.41, 0, w); for (let k = 0; k < 4; k++) box(0.09, 0.07, 0.31, -0.28 + k * 0.15, 0.42, 0, dk); cyl(0.08, 0.1, 0.3, 0.12, 0.65, 0, p); break;
    // ---- Garden Hills ----
    case "icecream": A(new THREE.ConeGeometry(0.2, 0.55, 14).rotateX(Math.PI).translate(0, 0.28, 0), m.c("#e0b070", 0.7)); ph(0.21, 0, 0.6, 0, p); ph(0.18, 0, 0.86, 0, q); ph(0.05, 0.05, 1.05, 0.02, m.c("#ff3a4a", 0.4)); break;
    case "toystore": ph(0.3, 0, 0.32, 0, p); ph(0.22, 0, 0.75, 0, p); for (const x of [-0.17, 0.17]) ph(0.08, x, 0.93, 0, q); ph(0.07, 0, 0.72, 0.2, w); for (const x of [-0.07, 0.07]) ph(0.03, x, 0.8, 0.19, dk); break;
    case "gardencenter": cyl(0.24, 0.17, 0.32, 0, 0.16, 0, m.c("#c86a4a", 0.7)); cyl(0.025, 0.025, 0.45, 0, 0.55, 0, m.c("#3fae5a", 0.6), 6); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ph(0.09, Math.cos(a) * 0.14, 0.82, Math.sin(a) * 0.14, p); } ph(0.08, 0, 0.82, 0, m.c("#ffd23a", 0.5)); break;
    case "pettingzoo": ph(0.3, 0, 0.42, 0, w, 1.3, 0.9, 1); ph(0.14, 0.38, 0.55, 0, dk, 1.1, 1, 0.9); for (const [x, z] of [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.12], [0.2, 0.12]]) cyl(0.04, 0.04, 0.22, x, 0.11, z, dk, 6); break;
    case "themepark": A(new THREE.TorusGeometry(0.38, 0.03, 6, 28).translate(0, 0.55, 0), p); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; A(new THREE.BoxGeometry(0.02, 0.38, 0.02).translate(0, 0.19, 0).rotateZ(a).translate(0, 0.55, 0), w); box(0.1, 0.09, 0.09, Math.cos(a) * 0.38, 0.55 + Math.sin(a) * 0.38, 0, k % 2 ? q : m.c("#ffd23a", 0.5)); } for (const x of [-0.2, 0.2]) A(new THREE.BoxGeometry(0.04, 0.6, 0.04).rotateZ(x > 0 ? -0.35 : 0.35).translate(x, 0.27, 0), w); break;
    case "golfclub": { cyl(0.02, 0.02, 0.95, 0, 0.48, 0, w, 6); const fl = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.38, -0.11), new THREE.Vector2(0, -0.22)]); A(new THREE.ExtrudeGeometry(fl, { depth: 0.02, bevelEnabled: false }).translate(0, 0.95, -0.01), p); ph(0.08, 0.25, 0.08, 0.1, w); cyl(0.3, 0.3, 0.03, 0, 0.015, 0, m.c("#5fae4a", 0.8), 20); break; }
    // ---- Downtown ----
    case "boutique": cyl(0.02, 0.02, 0.15, 0, 0.98, 0, gold, 6); A(new THREE.ConeGeometry(0.34, 0.7, 16, 1, true).translate(0, 0.42, 0), p); ph(0.12, 0, 0.84, 0, p, 1.3, 0.7, 0.9); A(new THREE.TorusGeometry(0.3, 0.025, 6, 20).rotateX(Math.PI / 2).translate(0, 0.1, 0), q); break;
    case "gym": { const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8).rotateZ(Math.PI / 2), dk)); for (const x of [-0.35, 0.35]) d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16).rotateZ(Math.PI / 2).translate(x, 0, 0), p)); d.position.y = 0.4; g.add(d); break; }
    case "startup": box(0.7, 0.04, 0.48, 0, 0.04, 0.05, dk); A(new THREE.BoxGeometry(0.7, 0.46, 0.03).translate(0, 0.23, 0).rotateX(-0.25).translate(0, 0.06, -0.2), dk); A(new THREE.BoxGeometry(0.62, 0.38, 0.01).translate(0, 0.23, 0.02).rotateX(-0.25).translate(0, 0.06, -0.2), m.c(c1, 0.2)); ph(0.08, 0, 0.75, -0.25, q); break;
    case "bank": box(0.8, 0.08, 0.5, 0, 0.04, 0, w); for (let k = 0; k < 4; k++) cyl(0.04, 0.045, 0.45, -0.3 + k * 0.2, 0.32, 0, w, 10); box(0.84, 0.07, 0.52, 0, 0.58, 0, w); A(new THREE.ConeGeometry(0.5, 0.25, 3).rotateY(Math.PI / 2).scale(1, 1, 0.5).translate(0, 0.74, 0), gold); break;
    case "exchange": for (let k = 0; k < 4; k++) box(0.14, 0.15 + k * 0.18, 0.14, -0.3 + k * 0.2, (0.15 + k * 0.18) / 2, 0, k % 2 ? q : p); A(new THREE.ConeGeometry(0.12, 0.2, 3).rotateZ(-Math.PI / 4).translate(0.42, 0.95, 0), m.c("#3fbf6a", 0.4)); break;
    case "tvstudio": box(0.5, 0.36, 0.32, 0, 0.55, 0, dk); cyl(0.12, 0.14, 0.2, 0, 0.55, 0.25, p).rotation.x = Math.PI / 2; for (const x of [-0.1, 0.12]) A(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14).rotateZ(Math.PI / 2).translate(x, 0.86, -0.02), q); for (const [x, z] of [[-0.2, 0.15], [0.2, 0.15], [0, -0.2]]) cyl(0.02, 0.02, 0.4, x, 0.18, z, dk, 6); break;
    // ---- Cloud Kingdom ----
    case "cloudspa": ph(0.26, 0, 0.45, 0, w); ph(0.2, -0.3, 0.38, 0, w); ph(0.2, 0.3, 0.38, 0, w); ph(0.18, 0.12, 0.66, 0, w); cyl(0.3, 0.3, 0.06, 0, 0.2, 0, p); break;
    case "royalbakery": A(new THREE.TorusGeometry(0.28, 0.13, 10, 18, Math.PI * 1.25).rotateZ(-Math.PI * 0.12).translate(0, 0.4, 0), m.c("#e8b060", 0.6)); A(new THREE.ConeGeometry(0.16, 0.18, 5).translate(0, 0.9, 0), gold); break;
    case "skyopera": ph(0.16, -0.15, 0.25, 0, p, 1.3, 1, 1); cyl(0.035, 0.035, 0.75, 0.04, 0.6, 0, p, 8); A(new THREE.BoxGeometry(0.28, 0.12, 0.05).rotateZ(-0.35).translate(0.16, 0.92, 0), p); break;
    case "palacehotel": cyl(0.36, 0.36, 0.26, 0, 0.25, 0, gold, 20); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; A(new THREE.ConeGeometry(0.08, 0.32, 6).translate(Math.cos(a) * 0.3, 0.52, Math.sin(a) * 0.3), gold); ph(0.05, Math.cos(a) * 0.3, 0.71, Math.sin(a) * 0.3, p); } break;
    case "goldexchange": for (const [x, y, z] of [[-0.2, 0.1, 0], [0.2, 0.1, 0], [0, 0.1, 0.28], [0, 0.32, 0.1]]) A(new THREE.CylinderGeometry(0.12, 0.17, 0.2, 4, 1).rotateY(Math.PI / 4).scale(1.6, 1, 0.8).translate(x, y, z), gold); break;
    case "royalball": ph(0.36, 0, 0.6, 0, m.c("#e8ecf4", 0.1, 0.9)); cyl(0.015, 0.015, 0.2, 0, 1.05, 0, dk, 6); for (let k = 0; k < 10; k++) { const a = k * 2.4, y = 0.4 + (k % 4) * 0.12; box(0.08, 0.08, 0.02, Math.cos(a) * 0.35, y, Math.sin(a) * 0.35, k % 2 ? p : q); } break;
    // ---- Crystal Spire ----
    case "gemshop": A(new THREE.OctahedronGeometry(0.36, 0).scale(1, 1.25, 1).translate(0, 0.48, 0), p); break;
    case "crystalcafe": cyl(0.22, 0.17, 0.38, 0, 0.27, 0, m.c(c1, 0.15)); A(new THREE.TorusGeometry(0.11, 0.03, 6, 14).translate(0.24, 0.3, 0), m.c(c1, 0.15)); cyl(0.3, 0.3, 0.04, 0, 0.06, 0, w, 20); for (let k = 0; k < 3; k++) cyl(0.02, 0.02, 0.22, -0.08 + k * 0.08, 0.6 + (k % 2) * 0.05, 0, w, 5); break;
    case "lightshow": cyl(0.18, 0.18, 0.2, 0, 0.1, 0, dk); A(new THREE.CylinderGeometry(0.12, 0.17, 0.3, 14).rotateX(-0.6).translate(0, 0.3, 0.05), dk); A(new THREE.ConeGeometry(0.3, 0.8, 16, 1, true).rotateX(Math.PI - 0.6).translate(0, 0.68, -0.32), new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); break;
    case "jewelry": A(new THREE.TorusGeometry(0.3, 0.06, 10, 28).translate(0, 0.38, 0), gold); A(new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.76, 0), p); break;
    case "crystallab": A(new THREE.ConeGeometry(0.3, 0.45, 16).translate(0, 0.23, 0), m.c(c1, 0.15)); cyl(0.08, 0.08, 0.35, 0, 0.62, 0, m.c(c1, 0.15)); for (const [x, y] of [[0.05, 0.9], [-0.06, 1.02]]) ph(0.05, x, y, 0, q); break;
    case "prismtower": A(new THREE.ConeGeometry(0.34, 0.95, 3).translate(0, 0.48, 0), m.c(c1, 0.12)); for (let k = 0; k < 3; k++) box(0.5, 0.025, 0.04, 0.45, 0.3 + k * 0.08, 0, [m.c("#ff5f6d", 0.5), m.c("#ffd23a", 0.5), m.c("#4f8bff", 0.5)][k]); break;
    // ---- Orbit Station ----
    case "spacediner": ph(0.26, 0, 0.52, 0, m.c("#e8b060", 0.6), 1, 0.45, 1); cyl(0.26, 0.26, 0.08, 0, 0.38, 0, m.c("#6a3a20", 0.7)); cyl(0.28, 0.28, 0.03, 0, 0.43, 0, m.c("#3fbf6a", 0.6)); ph(0.26, 0, 0.26, 0, m.c("#e8b060", 0.6), 1, 0.3, 1); break;
    case "zerogym": { const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8).rotateZ(Math.PI / 2), dk)); for (const x of [-0.35, 0.35]) d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16).rotateZ(Math.PI / 2).translate(x, 0, 0), p)); d.rotation.z = 0.4; d.position.y = 0.6; g.add(d); A(new THREE.TorusGeometry(0.42, 0.02, 6, 24).rotateX(Math.PI / 2).translate(0, 0.15, 0), q); break; }
    case "satellite": box(0.22, 0.22, 0.3, 0, 0.5, 0, w); for (const x of [-0.42, 0.42]) box(0.5, 0.02, 0.24, x, 0.5, 0, m.c("#2a3f8a", 0.2, 0.6)); A(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI * 0.6).translate(0, 0.62, 0.2), new THREE.MeshStandardMaterial({ color: 0xe8ecf4, side: THREE.DoubleSide })); break;
    case "moontours": ph(0.36, 0, 0.5, 0, m.c("#e8e4d8", 0.9)); for (const [x, y, z, r] of [[0.15, 0.62, 0.28, 0.07], [-0.12, 0.42, 0.31, 0.06], [0.05, 0.35, 0.33, 0.04]]) ph(r, x, y, z, m.c("#bdb8aa", 0.9)); break;
    case "rocketworks": cyl(0.14, 0.16, 0.6, 0, 0.42, 0, w); A(new THREE.ConeGeometry(0.14, 0.28, 14).translate(0, 0.86, 0), p); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; box(0.03, 0.22, 0.14, Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15, p).rotation.y = -a; } A(new THREE.ConeGeometry(0.1, 0.22, 10).rotateX(Math.PI).translate(0, 0.02, 0), m.c("#ffb13b", 0.4)); break;
    case "starport": { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.17 : 0.42; if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } A(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }).translate(0, 0.5, -0.05), gold); break; }
    default: ph(0.3, 0, 0.4, 0, p);
  }
  if (stage < 0) return root;
  // Its stand grows grander with each stage: a plinth (Stand), a taller one with a gold band
  // (Shop), a ring of lights (Store), a golden laurel behind it (Flagship), and a crown with
  // a starburst on top (Empire).
  const R = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const me = new THREE.Mesh(geo, mat); root.add(me); return me; };
  const ph0 = 0.12 + Math.min(stage, 2) * 0.08;
  R(new THREE.CylinderGeometry(0.42, 0.48, ph0, 24).translate(0, ph0 / 2, 0), q);
  R(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 24).translate(0, ph0 + 0.015, 0), w);
  g.position.y = ph0 + 0.03;
  if (stage >= 1) R(new THREE.CylinderGeometry(0.485, 0.485, 0.05, 24).translate(0, ph0 * 0.55, 0), gold);
  if (stage >= 2) for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; R(new THREE.SphereGeometry(0.035, 8, 6).translate(Math.cos(a) * 0.47, ph0 * 0.85, Math.sin(a) * 0.47), m.c(k % 2 ? "#fff3c0" : c1, 0.2, 0.1)); }
  if (stage >= 3) { const lr = R(new THREE.TorusGeometry(0.55, 0.035, 8, 32, Math.PI * 1.4).rotateZ(-Math.PI * 0.2).translate(0, ph0 + 0.62, -0.25), gold); lr.scale.z = 0.4; for (let k = 0; k < 8; k++) { const a = -Math.PI * 0.2 + (k / 7) * Math.PI * 1.4; R(new THREE.SphereGeometry(0.05, 6, 4).scale(1.6, 0.8, 0.6).translate(Math.cos(a) * 0.55, ph0 + 0.62 + Math.sin(a) * 0.55, -0.25), m.c("#3fae5a", 0.4)); } }
  if (stage >= 4) {
    const cy = ph0 + 1.25;
    R(new THREE.CylinderGeometry(0.2, 0.17, 0.12, 12, 1, true).translate(0, cy, 0), gold);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; R(new THREE.ConeGeometry(0.045, 0.14, 6).translate(Math.cos(a) * 0.18, cy + 0.12, Math.sin(a) * 0.18), gold); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; R(new THREE.BoxGeometry(0.03, 0.22, 0.01).translate(0, 0.32, 0).rotateZ(a).translate(0, cy + 0.05, -0.3), m.c("#ffe27a", 0.3, 0.3)); }
  }
  return root;
}

/** A district business's building on its block, from the model kit by stage (null if the kit
 *  isn't loaded yet), in the business's colors, with its emblem: on its sign out front and
 *  turning slowly over the roof. Adds to `lg`; returns its top. */
export function districtShop(lg: THREE.Object3D, id: string, stage: number, c1: string, c2: string, m: Mats, slab: THREE.BufferGeometry, slabM: THREE.Material, stone: THREE.Material, leaf: THREE.Material, metal: THREE.Material, roof = false): number {
  const K = (geo: THREE.BufferGeometry, mat: THREE.Material) => lg.add(new THREE.Mesh(geo, mat));
  const col = m.c(c1, 0.55), dark = m.c(new THREE.Color(c1).multiplyScalar(0.7), 0.6);
  K(slab, slabM);
  const st5 = Math.max(0, Math.min(4, stage));
  const POOLS = [["tt_shop", "tt_shop_2", "tt_shop_3", "tt_cafe", "tt_pub", "tt_pharmacy"], ["tt_supermarket", "tt_shop_2", "tt_bank", "tt_library"], ["tt_hotel", "building_a", "building_c", "tt_apartment_2"], ["building_e", "building_g", "tt_office", "building_b"], ["skyscraper_a", "skyscraper_b", "skyscraper_c", "tt_tower_block"]];
  let hsh = 0; for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = POOLS[st5], kp = kitPlace(pool[hsh % pool.length], st5 >= 3 ? 2.8 : 3.0, st5 >= 4 ? 1.2 : 1, hsh % 8);
  let top = 1.6 + st5 * 0.8;
  if (kp) { kp.obj.position.y = 0.06; lg.add(kp.obj); top = kp.h + 0.1; }
  else K(new THREE.BoxGeometry(2.6, top, 2.2).translate(0, top / 2, -0.2), col);
  // An awning in its colors, a sign on a post with the emblem on it, planters.
  K(new THREE.BoxGeometry(2.4, 0.06, 0.6).rotateX(0.25).translate(0, 0.95, 1.45), col);
  for (let w = 0; w < 6; w++) K(new THREE.BoxGeometry(0.4, 0.065, 0.62).rotateX(0.25).translate(-1.0 + w * 0.4, 0.955, 1.45), w % 2 ? m.c("#ffffff", 0.6) : dark);
  K(new THREE.BoxGeometry(0.07, 1.4, 0.07).translate(1.75, 0.7, 1.75), metal);
  K(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20).rotateX(Math.PI / 2).translate(1.75, 1.55, 1.75), col);
  const em = bizEmblem(id, c1, c2, m);
  em.scale.setScalar(0.62); em.position.set(1.75, 1.32, 1.8);
  lg.add(em);
  for (const px of [-1.75, -1.2]) { K(new THREE.CylinderGeometry(0.2, 0.17, 0.25, 10).translate(px, 0.13, 1.8), stone); K(new THREE.IcosahedronGeometry(0.22, 0).translate(px, 0.42, 1.8), leaf); }
  // As it grows: flags (Store), outdoor tables under umbrellas (Flagship), and a red carpet
  // with spotlights (Empire).
  if (st5 >= 2) for (const fx of [-1.9, 1.9]) { K(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6).translate(fx, 0.9, -1.7), metal); K(new THREE.BoxGeometry(0.02, 0.32, 0.5).translate(fx, 1.62, -1.45), col); }
  if (st5 >= 3) for (const tx of [-0.7, 0.4]) { K(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12).translate(tx, 0.42, 2.0), m.c("#ffffff", 0.5)); K(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6).translate(tx, 0.2, 2.0), metal); K(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).translate(tx, 0.85, 2.0), metal); K(new THREE.ConeGeometry(0.45, 0.22, 8).translate(tx, 1.3, 2.0), tx < 0 ? col : dark); }
  if (st5 >= 4) { K(new THREE.BoxGeometry(0.7, 0.02, 1.4).translate(0, 0.08, 1.6), m.c("#d9314a", 0.7)); for (const sx of [-0.55, 0.55]) { K(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6).translate(sx, 0.32, 2.15), m.gold); K(new THREE.CylinderGeometry(0.1, 0.14, 0.18, 10).rotateX(-0.6).translate(sx, 0.6, 2.15), metal); } }
  // (In town, its emblem also stands on the roof, big enough to read from afar.)
  if (roof) { const big = bizEmblem(id, c1, c2, m, st5); big.scale.setScalar(1.3); big.position.set(0, top - 0.05, -0.2); lg.add(big); top += 1.3 + (st5 >= 4 ? 1.9 : 1.3); }
  return top;
}

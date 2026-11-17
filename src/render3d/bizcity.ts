// Skyhaven Inc.'s business district: a floating island of its own where every business
// stands as a real building on its lot, growing with each stage (a cart, a shop, a store,
// a flagship, then a gold-crowned tower), around a plaza with a fountain and a ring road.
// It's alive: customers stroll the sidewalks and walk into the busiest stores, delivery
// vans drive round, a limousine brings each VIP, a rush hour draws a crowd and a glow, and
// at night the windows, signs and an empire's searchlight come on.
import * as THREE from "three";
import { FH } from "./geom";
import { mergeStatic } from "./world";

/** One lot: its business, colors, stage and whether it's open, for lease or still locked. */
export interface BizLot {
  id: string;
  c: string;
  c2: string;
  /** Stage 0-4 (only for open businesses). */
  s: number;
  state: "open" | "lease" | "locked";
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
  vip: string;
  critic: string;
  power: string;
}

/** Main Street: a boulevard running into the screen, the businesses lined up along both
 *  sides in the order they open. The first ones (which grow tallest) stand at the far end,
 *  like a downtown, so they never hide the newer, smaller ones in front. */
const U = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);   // along the street, toward you
const V = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);  // across it, to the right
const at = (s: number, t: number, y = 0) => new THREE.Vector3(U.x * s + V.x * t, y, U.z * s + V.z * t);
const STREET_ANGLE = Math.atan2(U.x, U.z);
/** The street runs from s = BACK (far end) to s = FRONT (the plaza at the entrance). */
const BACK = -13, FRONT = 15;

/** Where each lot stands (local to the district) and which way it faces. */
export function lotPos(i: number): { x: number; z: number; a: number; side: number; s: number } {
  const row = Math.floor(i / 2), side = i % 2 === 0 ? -1 : 1, s = -9.5 + row * 4.6;
  const p = at(s, side * 3.7), f = V.clone().multiplyScalar(-side);
  return { x: p.x, z: p.z, a: Math.atan2(f.x, f.z), side, s };
}
/** Where the camera should look: the part of the street you've built so far (with the next
 *  lot to open), so a young company isn't a tiny cart at the end of an empty road. */
export function streetFocus(lots: BizLot[]): { x: number; z: number; zoom: number } {
  let last = 0;
  lots.forEach((l, i) => { if (l.state !== "locked") last = i; });
  const front = lotPos(last).s, back = lotPos(0).s;
  const p = at(Math.min(1, (back + front) / 2 + 0.5), 0), rows = Math.floor(last / 2) + 1;
  // Closer while the street is short.
  return { x: p.x, z: p.z, zoom: rows <= 1 ? 1.35 : rows === 2 ? 1.25 : rows === 3 ? 1.12 : 1 };
}
/** How tall each stage's building is (world units), for labels and taps. */
export const STAGE_H = [1.6, 2.4, 4.2, 7.2, 11.5];
export const STAGE_W = [0.8, 1.05, 1.25, 1.4, 1.5];

const col = (c: string) => new THREE.Color(c);
const std = (c: string | number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: typeof c === "number" ? c : col(c), roughness: 0.7, ...o });

export interface BizCity {
  group: THREE.Group;
  update(t: number, night: number, live: BizLive, lots: BizLot[]): void;
}

export function buildBizCity(lots: BizLot[], st: BizStyle = DEFAULT_STYLE): BizCity {
  const g = new THREE.Group();
  const own = <T extends THREE.Material>(m: T): T => { m.userData.own = true; return m; };
  const along = (geo: THREE.BufferGeometry, s: number, t: number, y = 0) => { const p = at(s, t, y); return geo.rotateY(STREET_ANGLE).translate(p.x, p.y, p.z); };
  const mid = (BACK + FRONT) / 2, len = FRONT - BACK + 2, W = 15;

  // ---- The island: a long, rounded block of land on layered rock ----
  const rock = own(std(st.rock, { roughness: 1, flatShading: true }));
  g.add(new THREE.Mesh(along(new THREE.ConeGeometry(1, 1, 8).rotateX(Math.PI).scale(W * 0.5, 9, len * 0.5), mid, 0, -5.4), rock));
  const earth = own(std(st.dirt, { roughness: 1 }));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(W, 1.2, len), mid, 0, -0.65), earth));
  const lawn = own(std(st.lawn, { roughness: 0.95 }));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(W, 0.12, len), mid, 0, -0.05), lawn));
  // The street, its sidewalks and lane markings.
  const road = own(std(st.road, { roughness: 0.9 }));
  const walk = own(std("#e6e1f2", { roughness: 0.8 }));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(5.0, 0.1, FRONT - BACK), mid - 1, 0, 0.03), walk));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(2.8, 0.11, FRONT - BACK), mid - 1, 0, 0.05), road));
  const lane = own(new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  for (let s = BACK + 1; s < FRONT - 3; s += 1.6) g.add(new THREE.Mesh(along(new THREE.BoxGeometry(0.08, 0.02, 0.7), s, 0, 0.11), lane));
  // The plaza at the entrance: paving, a fountain and a gate with the company's colors.
  const pave = own(std(st.plaza, { roughness: 0.7 }));
  g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 36), FRONT - 1.5, 0, 0.06), pave));
  const stone = own(std("#d9d2e6", { roughness: 0.6 }));
  g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(1.4, 1.55, 0.45, 28), FRONT - 1.5, 0, 0.25), stone));
  const water = own(std("#6fc6ff", { roughness: 0.1, metalness: 0.2, emissive: 0x2a6fbf, emissiveIntensity: 0.25 }));
  g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(1.2, 1.2, 0.46, 28), FRONT - 1.5, 0, 0.26), water));
  g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 10), FRONT - 1.5, 0, 0.85), stone));
  const jetMat = own(new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.65, roughness: 0.1 }));
  const jet = new THREE.Mesh(along(new THREE.ConeGeometry(0.5, 1.2, 14), FRONT - 1.5, 0, 2.0), jetMat);
  jet.userData.dynamic = true;
  g.add(jet);
  const gateA = own(std("#6a3cff", { roughness: 0.4, metalness: 0.3 })), gateB = own(std("#ffc93c", { roughness: 0.3, metalness: 0.6, emissive: 0x6a4a00, emissiveIntensity: 0.3 }));
  for (const t of [-2.3, 2.3]) g.add(new THREE.Mesh(along(new THREE.BoxGeometry(0.35, 3.2, 0.35), FRONT - 4.2, t, 1.6), gateA));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(5.0, 0.55, 0.4), FRONT - 4.2, 0, 3.3), gateA));
  g.add(new THREE.Mesh(along(new THREE.BoxGeometry(4.2, 0.18, 0.44), FRONT - 4.2, 0, 3.05), gateB));
  // Trees, like your island's: round, pine or palm.
  const leaf = own(std(st.leaf, { roughness: 0.9, flatShading: true }));
  const trunk = own(std(st.trunk));
  const treeTop = (h: number, r: number) => st.tree === "pine" ? new THREE.ConeGeometry(r * 0.9, r * 2.4, 7).translate(0, h + r, 0)
    : st.tree === "palm" ? new THREE.ConeGeometry(r * 1.3, r * 0.5, 6).translate(0, h + r * 0.6, 0) : new THREE.IcosahedronGeometry(r, 0).translate(0, h + r * 0.6, 0);
  const tree = (s: number, t: number, r: number) => {
    const th = st.tree === "palm" ? 1.0 : 0.55;
    g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(0.06, 0.1, th, 6).translate(0, th / 2, 0), s, t), trunk));
    g.add(new THREE.Mesh(along(treeTop(th, r), s, t), leaf));
  };
  for (let s = BACK + 0.5; s <= FRONT - 5; s += 2.3) { tree(s, -6.6, 0.5); tree(s + 1.1, 6.6, 0.5); }
  for (const t of [-5.5, -3, 3, 5.5]) tree(FRONT - 0.5, t, 0.45);
  for (const t of [-4, -1.3, 1.3, 4]) tree(BACK - 0.3, t, 0.55);
  // Street lamps between the lots.
  const pole = own(std("#4a4f7a", { metalness: 0.4, roughness: 0.5 }));
  const lampMat = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
  lampMat.userData.dynamic = true;
  for (let s = -11.8; s < FRONT - 4; s += 4.6) for (const t of [-2.6, 2.6]) {
    g.add(new THREE.Mesh(along(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6).translate(0, 0.75, 0), s, t), pole));
    g.add(new THREE.Mesh(along(new THREE.SphereGeometry(0.13, 8, 6).translate(0, 1.55, 0), s, t), lampMat));
  }

  // ---- The lots and their buildings ----
  const winMat = own(std(st.glass, { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color(st.lit), emissiveIntensity: 0.05 }));
  winMat.userData.dynamic = true;
  const gold = own(std("#ffc93c", { roughness: 0.25, metalness: 0.85, emissive: 0x6a4a00, emissiveIntensity: 0.25 }));
  const white = own(std("#ffffff", { roughness: 0.6 }));
  const dark = own(std("#2a2f5a", { roughness: 0.5 }));
  const signs: THREE.MeshStandardMaterial[] = [];
  const beacons: THREE.Mesh[] = [];
  const doors = new Map<string, THREE.Vector3>();
  const lotGroups = new Map<string, THREE.Group>();
  lots.forEach((lot, i) => {
    const { x, z, a, side, s: ls } = lotPos(i);
    const lotG = new THREE.Group();
    lotG.position.set(x, 0, z);
    lotG.rotation.y = a; // facing the street
    g.add(lotG);
    doors.set(lot.id, at(ls, side * 2.05));
    const open = lot.state === "open";
    const ground = own(std(open ? new THREE.Color(lot.c).lerp(new THREE.Color("#ffffff"), 0.65).getStyle() : lot.state === "lease" ? "#e8dcc0" : "#8fd47e", { roughness: 0.9 }));
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 3.2).translate(0, 0.05, 0), ground));
    if (!open) {
      // A see-through preview of the business that will open here.
      const ghost = own(new THREE.MeshStandardMaterial({ color: col(lot.c), transparent: true, opacity: lot.state === "lease" ? 0.42 : 0.2, depthWrite: false, roughness: 0.5 }));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.4, 2.1).translate(0, 1.25, -0.2), ghost));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 2.3).translate(0, 2.5, -0.2), ghost));
      const fence = own(std(lot.state === "lease" ? "#ffffff" : "#e6e1f2"));
      for (const [fx, fz, w, d] of [[0, -1.55, 3.1, 0.06], [-1.55, 0, 0.06, 3.1], [1.55, 0, 0.06, 3.1], [-1.05, 1.55, 1.1, 0.06], [1.05, 1.55, 1.1, 0.06]] as const)
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d).translate(fx, 0.2, fz), fence));
      if (lot.state === "lease") {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07).translate(0.9, 0.55, 1.2), dark));
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.06).translate(0.9, 1.2, 1.2), own(std("#e8334f", { emissive: 0xe8334f, emissiveIntensity: 0.2 }))));
      }
      mergeStatic(lotG);
      return;
    }
    // A path from the door to the sidewalk.
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.11, 0.9).translate(0, 0.06, 1.65), walk));
    const s = lot.s, w = STAGE_W[s], h = STAGE_H[s];
    const c1 = col(lot.c), c2 = col(lot.c2);
    const body = own(std(c1.clone().lerp(new THREE.Color("#ffffff"), s >= 3 ? 0.55 : 0.35).getStyle(), { roughness: s >= 3 ? 0.35 : 0.65, metalness: s >= 3 ? 0.15 : 0 }));
    const trim = own(std(lot.c2, { roughness: 0.4 }));
    const sign = own(std(lot.c2, { emissive: c2, emissiveIntensity: 0.1 }));
    sign.userData.dynamic = true;
    signs.push(sign);
    if (s === 0) {
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7).translate(0, 0.55, 0.4), body));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.75).translate(0, 0.94, 0.4), trim));
      for (const wx of [-0.45, 0.45]) lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12).rotateX(Math.PI / 2).translate(wx, 0.18, 0.78), dark));
      lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6).translate(0, 1.4, 0.4), dark));
      for (let k = 0; k < 8; k++) lotG.add(new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.45, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4).translate(0, 2.0, 0.4), k % 2 ? white : sign));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05).translate(0, 1.15, 0.78), sign));
    } else {
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2, h, w * 2).translate(0, h / 2, 0), body));
      const floors = Math.max(1, Math.round(h / FH));
      for (let f = 0; f < floors; f++) {
        const y = f * FH + (f === 0 ? 0.55 : 0.7);
        if (f === 0) {
          lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, 0.8, 0.04).translate(-w * 0.15, y, w + 0.01), winMat));
          lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.05).translate(w * 0.7, 0.38, w + 0.02), dark));
        } else {
          for (let k = -1; k <= 1; k++) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.55, 0.04).translate(k * w * 0.62, y, w + 0.01), winMat));
          for (const sd of [-1, 1]) for (let k = -1; k <= 1; k += 2) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, w * 0.5).translate(sd * (w + 0.01), y, k * w * 0.45), winMat));
        }
      }
      if (s >= 3) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h - 1.2, 0.05).translate(0, (h + 1.2) / 2, w + 0.03), winMat));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2.1, 0.08, 0.55).rotateX(0.3).translate(0, 1.15, w + 0.25), trim));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.6, 0.32, 0.06).translate(0, Math.min(h - 0.25, 1.55), w + 0.05), sign));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2.08, 0.16, w * 2.08).translate(0, h + 0.08, 0), trim));
      if (s >= 2) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, 0.45, 0.06).translate(0, h + 0.45, w * 0.7), sign));
        lotG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0).translate(-w * 0.7, h + 0.3, -w * 0.6), leaf));
        lotG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0).translate(w * 0.7, h + 0.3, -w * 0.6), leaf));
      }
      if (s >= 3) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, h * 0.18, w * 1.2).translate(0, h + h * 0.09, 0), body));
        lotG.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.6, 6).translate(0, h * 1.18 + 0.8, 0), trim));
      }
      if (s >= 4) {
        lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.6, w * 0.8, 0.35, 10).translate(0, h * 1.18 + 0.18, 0), gold));
        for (let k = 0; k < 6; k++) {
          const ka = (k / 6) * Math.PI * 2;
          lotG.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 5).translate(Math.cos(ka) * w * 0.6, h * 1.18 + 0.55, Math.sin(ka) * w * 0.6), gold));
        }
        lotG.add(new THREE.Mesh(new THREE.ConeGeometry(0.15, 2.4, 8).translate(0, h * 1.18 + 1.5, 0), gold));
        const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 16, 16, 1, true).translate(0, 8, 0), beamMat);
        beam.position.set(x, h * 1.18 + 0.4, z);
        beam.userData.dynamic = true;
        beacons.push(beam);
        g.add(beam);
      }
      for (const px of [-w - 0.25, w + 0.25]) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3).translate(px, 0.13, w + 0.3), trim));
        lotG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0).translate(px, 0.42, w + 0.3), leaf));
      }
    }
    const prop = roofProp(lot.id, c1, c2);
    prop.position.y = s === 0 ? 2.5 : h + (s >= 3 ? h * 0.18 : 0) + (s >= 2 ? 0.55 : 0.35);
    if (s >= 4) prop.position.set(w * 0.9, h + 0.4, -w * 0.4);
    prop.userData.dynamic = true;
    prop.userData.spin = true;
    lotG.add(prop);
    // Each open building is its own few meshes, so it can bounce when it sells.
    mergeStatic(lotG);
    lotG.userData.dynamic = true;
    lotGroups.set(lot.id, lotG);
  });

  // ---- Life: people on the sidewalks, cars on the street, a limousine, rush crowds ----
  const life = new THREE.Group();
  life.userData.dynamic = true;
  g.add(life);
  const shirts = ["#4f8bff", "#ff6fa0", "#5ee0a0", "#ffb13b", "#b48cff", "#ff8a5c", "#3ac0c0", "#e8457a"];
  const skinM = own(std("#f2c39a"));
  const makePerson = (c: string) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 3, 6).translate(0, 0.28, 0), own(std(c))));
    p.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0.56, 0), skinM));
    return p;
  };
  const walkers = Array.from({ length: 20 }, (_, k) => {
    const p = makePerson(shirts[k % shirts.length]);
    life.add(p);
    return { p, s: BACK + ((k * 7.3) % (FRONT - BACK)), t: (k % 2 ? 1 : -1) * (2.0 + (k % 3) * 0.12), v: (k % 4 < 2 ? 1 : -1) * (0.5 + (k % 5) * 0.12), visit: -1, k: 0 };
  });
  const crowd = Array.from({ length: 10 }, (_, k) => { const p = makePerson(shirts[(k + 3) % shirts.length]); p.visible = false; life.add(p); return p; });
  const makeCar = (c: string, van: boolean) => {
    const v = new THREE.Group();
    const m = own(std(c, { metalness: 0.3, roughness: 0.4 }));
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, van ? 0.5 : 0.32, van ? 0.95 : 0.85).translate(0, van ? 0.38 : 0.28, 0), m));
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.22, van ? 0.25 : 0.45).translate(0, van ? 0.42 : 0.52, van ? 0.5 : -0.02), winMat));
    for (const wx of [-0.22, 0.22]) for (const wz of [-0.3, 0.3]) v.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateZ(Math.PI / 2).translate(wx, 0.1, wz), dark));
    life.add(v);
    return v;
  };
  const cars = [
    { v: makeCar("#ffffff", true), s: BACK + 2, dir: 1, sp: 1.6 }, { v: makeCar("#ffc93c", false), s: 4, dir: 1, sp: 2.2 },
    { v: makeCar("#4f8bff", true), s: 8, dir: -1, sp: 1.8 }, { v: makeCar("#ff4f8b", false), s: -4, dir: -1, sp: 2.4 },
  ];
  const limo = new THREE.Group();
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 1.6).translate(0, 0.3, 0), own(std("#1c1640", { metalness: 0.6, roughness: 0.25 }))));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 1.1).translate(0, 0.6, -0.05), winMat));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 1.62).translate(0, 0.32, 0), gold));
  for (const wx of [-0.25, 0.25]) for (const wz of [-0.55, 0.55]) limo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateZ(Math.PI / 2).translate(wx, 0.1, wz), dark));
  limo.visible = false;
  life.add(limo);
  let limoFor = "", limoT = 0;
  const ring = (color: number, r0: number, r1: number) => {
    const m = own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2).translate(0, 0.14, 0), m);
    mesh.visible = false;
    life.add(mesh);
    return { mesh, m };
  };
  const rush = ring(0xff4f8b, 1.8, 2.3), critic = ring(0x9a6cff, 1.7, 2.0), sel = ring(0xffe27a, 1.95, 2.35);

  mergeStatic(g);

  const idx = (id: string) => lots.findIndex(l => l.id === id);
  const lotRing = (r: { mesh: THREE.Mesh; m: THREE.MeshBasicMaterial }, id: string) => {
    const i = idx(id);
    r.mesh.visible = i >= 0;
    if (i >= 0) { const p = lotPos(i); r.mesh.position.set(p.x, 0, p.z); }
    return i >= 0;
  };
  let last = 0;
  return {
    group: g,
    update(t, night, live) {
      const dt = Math.min(0.1, last ? t - last : 0.016);
      last = t;
      winMat.emissiveIntensity = 0.05 + night * 0.9;
      lampMat.emissiveIntensity = 0.2 + night * 2.2;
      for (const m of signs) m.emissiveIntensity = 0.1 + night * 0.9;
      for (const b of beacons) {
        (b.material as THREE.MeshBasicMaterial).opacity = Math.max(0, night - 0.25) * 0.28;
        b.rotation.z = Math.sin(t * 0.5) * 0.35;
        b.rotation.x = Math.cos(t * 0.4) * 0.25;
      }
      jet.scale.y = 1 + Math.sin(t * 4) * 0.08;
      g.traverse(o => { if (o.userData.spin) o.rotation.y = t * 0.6; });
      // A building that just sold (or grew) bounces.
      const now = Date.now();
      for (const [id, lg] of lotGroups) {
        const k = id === live.pulse ? (now - (live.pulseAt ?? 0)) / 450 : 1;
        if (k >= 0 && k < 1) {
          const b = Math.sin(k * Math.PI) * (1 - k);
          lg.scale.set(1 - b * 0.06, 1 + b * 0.16, 1 - b * 0.06);
        } else lg.scale.set(1, 1, 1);
      }
      // People stroll the sidewalks and pop into the stores (busier ones more).
      for (const w of walkers) {
        if (w.visit >= 0) {
          w.k += dt / 2;
          const d = doors.get(lots[w.visit].id)!, inn = Math.min(1, w.k), e = inn < 0.5 ? inn * 2 : (1 - inn) * 2;
          const from = at(w.s, w.t);
          w.p.position.set(from.x + (d.x - from.x) * e + (V.x * Math.sign(w.t)) * e * 0.8, 0, from.z + (d.z - from.z) * e + (V.z * Math.sign(w.t)) * e * 0.8);
          w.p.visible = e < 0.9;
          if (w.k >= 1) { w.visit = -1; w.p.visible = true; }
          continue;
        }
        w.s += w.v * dt;
        if (w.s > FRONT - 3.5) w.s = BACK + 0.5; else if (w.s < BACK + 0.5) w.s = FRONT - 3.5;
        const p = at(w.s, w.t);
        w.p.position.set(p.x, Math.abs(Math.sin(t * 9 + w.s * 3)) * 0.04, p.z);
        w.p.rotation.y = STREET_ANGLE + (w.v > 0 ? 0 : Math.PI);
        const near = lots.findIndex((l, i) => l.state === "open" && Math.sign(w.t) === lotPos(i).side && Math.abs(lotPos(i).s - w.s) < 0.08);
        if (near >= 0 && Math.random() < 0.25 + (live.rush === lots[near].id ? 0.6 : 0)) { w.visit = near; w.k = 0; }
      }
      // A crowd outside the rush-hour business.
      const ri = idx(live.rush);
      crowd.forEach((p, k) => {
        p.visible = ri >= 0;
        if (ri < 0) return;
        const lp = lotPos(ri), q = at(lp.s + (k - 4.5) * 0.28, lp.side * (2.1 + (k % 3) * 0.2));
        p.position.set(q.x, Math.abs(Math.sin(t * 12 + k)) * 0.12, q.z);
        p.rotation.y = lp.a + Math.PI;
      });
      if (lotRing(rush, live.rush)) { rush.m.opacity = 0.45 + Math.sin(t * 6) * 0.2; rush.mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.05); }
      if (lotRing(critic, live.critic)) critic.mesh.rotation.y = t;
      if (lotRing(sel, live.sel ?? "")) { sel.m.opacity = 0.55 + Math.sin(t * 4) * 0.25; sel.mesh.scale.setScalar(1 + Math.sin(t * 4) * 0.03); }
      // Cars drive up and down the street.
      for (const c of cars) {
        c.s += c.dir * c.sp * dt;
        if (c.s > FRONT - 4) c.s = BACK; else if (c.s < BACK) c.s = FRONT - 4;
        const p = at(c.s, c.dir > 0 ? 0.65 : -0.65);
        c.v.position.set(p.x, 0, p.z);
        c.v.rotation.y = STREET_ANGLE + (c.dir > 0 ? 0 : Math.PI);
      }
      // The VIP's limousine drives up from the far end and parks outside.
      const vi = idx(live.vip);
      if (vi >= 0 && limoFor !== live.vip) { limoFor = live.vip; limoT = 0; }
      if (vi < 0) limoFor = "";
      limo.visible = vi >= 0;
      if (vi >= 0) {
        limoT = Math.min(1, limoT + dt / 2.5);
        const lp = lotPos(vi), e = 1 - Math.pow(1 - limoT, 3), q = at(FRONT - 4 + (lp.s - FRONT + 4) * e, lp.side * 1.0);
        limo.position.set(q.x, 0, q.z);
        limo.rotation.y = STREET_ANGLE + Math.PI;
      }
    },
  };
}


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

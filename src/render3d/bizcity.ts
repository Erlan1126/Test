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

/** What changes from moment to moment (no rebuild needed). */
export interface BizLive {
  /** The building whose card is open. */
  sel?: string;
  rush: string;
  vip: string;
  critic: string;
  power: string;
}

export const BIZ_R = 13;
/** Where each lot stands (local to the district), by business order. */
export function lotPos(i: number): { x: number; z: number; a: number } {
  // Ten lots around the plaza, the first one at the front.
  const a = Math.PI / 4 + (i / 10) * Math.PI * 2;
  return { x: Math.cos(a) * 7.2, z: Math.sin(a) * 7.2, a };
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

export function buildBizCity(lots: BizLot[]): BizCity {
  const g = new THREE.Group(), R = BIZ_R;
  const own = <T extends THREE.Material>(m: T): T => { m.userData.own = true; return m; };
  // ---- The island: a round plaza on layered rock ----
  const rock = own(std("#8a7fb0", { roughness: 1, flatShading: true }));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(R * 1.02, R * 1.4, 9).rotateX(Math.PI).translate(0, -R * 0.7 - 1, 0), rock));
  const earth = own(std("#a8784a", { roughness: 1 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 1.2, 40).translate(0, -0.65, 0), earth));
  const lawn = own(std("#7fd36a", { roughness: 0.95 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.12, 40).translate(0, -0.05, 0), lawn));
  // Ring road with sidewalks.
  const road = own(std("#5a5f7a", { roughness: 0.9 }));
  const walk = own(std("#e6e1f2", { roughness: 0.8 }));
  g.add(new THREE.Mesh(new THREE.RingGeometry(10.1, 11.1, 48).rotateX(-Math.PI / 2).translate(0, 0.03, 0), walk));
  g.add(new THREE.Mesh(new THREE.RingGeometry(10.3, 10.9, 48).rotateX(-Math.PI / 2).translate(0, 0.05, 0), road));
  const lane = own(new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06).rotateX(-Math.PI / 2), lane);
    m.position.set(Math.cos(a) * 10.6, 0.07, Math.sin(a) * 10.6);
    m.rotation.y = -a + Math.PI / 2;
    g.add(m);
  }
  // Inner sidewalk ring where people stroll, and paths from each lot.
  g.add(new THREE.Mesh(new THREE.RingGeometry(9.1, 9.9, 48).rotateX(-Math.PI / 2).translate(0, 0.04, 0), walk));
  // Central plaza: paving, a fountain, trees and benches.
  const pave = own(std("#f4efe6", { roughness: 0.7 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.1, 36).translate(0, 0.05, 0), pave));
  const stone = own(std("#d9d2e6", { roughness: 0.6 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.45, 28).translate(0, 0.25, 0), stone));
  const water = own(std("#6fc6ff", { roughness: 0.1, metalness: 0.2, emissive: 0x2a6fbf, emissiveIntensity: 0.25 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.46, 28).translate(0, 0.26, 0), water));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.3, 10).translate(0, 0.9, 0), stone));
  const jetMat = own(new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.65, roughness: 0.1 }));
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 14).translate(0, 2.1, 0), jetMat);
  jet.userData.dynamic = true;
  g.add(jet);
  const leaf = own(std("#3fbf6a", { roughness: 0.9, flatShading: true }));
  const trunk = own(std("#8a5a3a"));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2, r = 3.4;
    const t = new THREE.Group();
    t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6).translate(0, 0.3, 0), trunk));
    t.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).translate(0, 0.95, 0), leaf));
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(t);
  }
  // Trees round the rim between the lots.
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2 + 0.16, r = 12.2;
    const t = new THREE.Group();
    t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6).translate(0, 0.25, 0), trunk));
    t.add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 7).translate(0, 1, 0), leaf));
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(t);
  }
  // Street lamps on the ring.
  const pole = own(std("#4a4f7a", { metalness: 0.4, roughness: 0.5 }));
  const lampMat = own(std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.2 }));
  lampMat.userData.dynamic = true;
  for (let k = 0; k < 10; k++) {
    const a = ((k + 0.5) / 10) * Math.PI * 2 + Math.PI / 4, r = 9.55;
    const l = new THREE.Group();
    l.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6).translate(0, 0.75, 0), pole));
    l.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6).translate(0, 1.55, 0), lampMat));
    l.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(l);
  }

  // ---- The lots and their buildings ----
  const winMat = own(std("#bfe6ff", { roughness: 0.15, metalness: 0.3, emissive: 0xffd99a, emissiveIntensity: 0.05 }));
  winMat.userData.dynamic = true;
  const gold = own(std("#ffc93c", { roughness: 0.25, metalness: 0.85, emissive: 0x6a4a00, emissiveIntensity: 0.25 }));
  const white = own(std("#ffffff", { roughness: 0.6 }));
  const dark = own(std("#2a2f5a", { roughness: 0.5 }));
  const signs: THREE.MeshStandardMaterial[] = [];
  const beacons: THREE.Mesh[] = [];
  const doors = new Map<string, THREE.Vector3>();
  lots.forEach((lot, i) => {
    const { x, z, a } = lotPos(i);
    const lotG = new THREE.Group();
    lotG.position.set(x, 0, z);
    // Face out toward the ring road.
    lotG.rotation.y = -a + Math.PI / 2;
    g.add(lotG);
    doors.set(lot.id, new THREE.Vector3(Math.cos(a) * 8.7, 0, Math.sin(a) * 8.7));
    // The lot: paving in the business's color for open ones, grass and a fence otherwise.
    const ground = own(std(lot.state === "open" ? new THREE.Color(lot.c).lerp(new THREE.Color("#ffffff"), 0.65).getStyle() : lot.state === "lease" ? "#c9b48a" : "#6fc35e", { roughness: 0.9 }));
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 3.2).translate(0, 0.05, 0), ground));
    // A path from the door to the sidewalk.
    lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.11, 1.4).translate(0, 0.06, 1.9), walk));
    if (lot.state !== "open") {
      const fence = own(std(lot.state === "lease" ? "#ffffff" : "#d9d2e6"));
      for (const [fx, fz, w, d] of [[0, -1.55, 3.1, 0.06], [-1.55, 0, 0.06, 3.1], [1.55, 0, 0.06, 3.1], [-1.05, 1.55, 1.1, 0.06], [1.05, 1.55, 1.1, 0.06]] as const)
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d).translate(fx, 0.25, fz), fence));
      if (lot.state === "lease") {
        // A "for lease" board on a post.
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07).translate(0.6, 0.55, 0.9), dark));
        const board = own(std("#e8334f", { emissive: 0xe8334f, emissiveIntensity: 0.15 }));
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.06).translate(0.6, 1.2, 0.9), board));
        // A little pile of building material.
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5).translate(-0.6, 0.18, -0.4), own(std("#c9862a"))));
      }
      return;
    }
    const s = lot.s, w = STAGE_W[s], h = STAGE_H[s];
    const c1 = col(lot.c), c2 = col(lot.c2);
    const body = own(std(c1.clone().lerp(new THREE.Color("#ffffff"), s >= 3 ? 0.55 : 0.35).getStyle(), { roughness: s >= 3 ? 0.35 : 0.65, metalness: s >= 3 ? 0.15 : 0 }));
    const trim = own(std(lot.c2, { roughness: 0.4 }));
    const sign = own(std(lot.c2, { emissive: c2, emissiveIntensity: 0.1 }));
    sign.userData.dynamic = true;
    signs.push(sign);
    if (s === 0) {
      // A cart: a counter on wheels under a striped umbrella.
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7).translate(0, 0.55, 0.4), body));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.75).translate(0, 0.94, 0.4), trim));
      for (const wx of [-0.45, 0.45]) lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12).rotateX(Math.PI / 2).translate(wx, 0.18, 0.78), dark));
      lotG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6).translate(0, 1.4, 0.4), dark));
      for (let k = 0; k < 8; k++) {
        const seg = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.45, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4).translate(0, 2.0, 0.4), k % 2 ? white : sign);
        lotG.add(seg);
      }
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05).translate(0, 1.15, 0.78), sign));
    } else {
      // The building: walls, then glass, setbacks and trim by stage.
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2, h, w * 2).translate(0, h / 2, 0), body));
      // Windows: rows of glass on the front and sides (they light up at night).
      const floors = Math.max(1, Math.round(h / FH));
      for (let f = 0; f < floors; f++) {
        const y = f * FH + (f === 0 ? 0.55 : 0.7);
        if (f === 0) {
          // The shop front: one big display window and a door.
          lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, 0.8, 0.04).translate(-w * 0.15, y, w + 0.01), winMat));
          lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.05).translate(w * 0.7, 0.38, w + 0.02), dark));
        } else {
          for (let k = -1; k <= 1; k++) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.55, 0.04).translate(k * w * 0.62, y, w + 0.01), winMat));
          for (const side of [-1, 1]) for (let k = -1; k <= 1; k += 2) lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, w * 0.5).translate(side * (w + 0.01), y, k * w * 0.45), winMat));
        }
      }
      if (s >= 3) {
        // A glass curtain wall up the middle.
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h - 1.2, 0.05).translate(0, (h + 1.2) / 2, w + 0.03), winMat));
      }
      // An awning over the shop front and the sign band.
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2.1, 0.08, 0.55).rotateX(0.3).translate(0, 1.15, w + 0.25), trim));
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.6, 0.32, 0.06).translate(0, Math.min(h - 0.25, 1.55), w + 0.05), sign));
      // Roof: a parapet, then a setback, a spire, a crown.
      lotG.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2.08, 0.16, w * 2.08).translate(0, h + 0.08, 0), trim));
      if (s >= 2) {
        // Rooftop terrace with plants and a rooftop sign.
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
        // A searchlight sweeping the night sky.
        const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 16, 16, 1, true).translate(0, 8, 0), beamMat);
        beam.position.set(x, h * 1.18 + 0.4, z);
        beam.userData.dynamic = true;
        beacons.push(beam);
        g.add(beam);
      }
      // Planters by the door.
      for (const px of [-w - 0.25, w + 0.25]) {
        lotG.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3).translate(px, 0.13, w + 0.3), trim));
        lotG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0).translate(px, 0.42, w + 0.3), leaf));
      }
    }
    // What the business is, on the roof (or the cart): a big friendly prop.
    const prop = roofProp(lot.id, c1, c2);
    prop.position.y = s === 0 ? 2.5 : h + (s >= 3 ? h * 0.18 : 0) + (s >= 2 ? 0.55 : 0.35);
    if (s >= 4) prop.position.set(w * 0.9, h + 0.4, -w * 0.4);
    prop.userData.dynamic = true;
    prop.userData.spin = true;
    lotG.add(prop);
  });

  // ---- Life: walkers, vans, a limousine, a crowd at rush hour ----
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
  const walkers = Array.from({ length: 22 }, (_, k) => {
    const p = makePerson(shirts[k % shirts.length]);
    life.add(p);
    return { p, a: (k / 22) * Math.PI * 2, v: (k % 2 ? 1 : -1) * (0.05 + (k % 5) * 0.012), r: 9.3 + (k % 3) * 0.2, visit: -1, t: 0 };
  });
  const crowd = Array.from({ length: 10 }, (_, k) => { const p = makePerson(shirts[(k + 3) % shirts.length]); p.visible = false; life.add(p); return p; });
  const makeVan = (c: string) => {
    const v = new THREE.Group();
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.45).translate(0, 0.38, 0), own(std(c))));
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.43).translate(0.52, 0.3, 0), own(std(c))));
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.4).translate(0.66, 0.38, 0), winMat));
    for (const wx of [-0.28, 0.4]) for (const wz of [-0.22, 0.22]) v.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2).translate(wx, 0.12, wz), dark));
    life.add(v);
    return v;
  };
  const vans = [{ v: makeVan("#ffffff"), a: 0, sp: 0.16 }, { v: makeVan("#ffc93c"), a: Math.PI, sp: 0.12 }, { v: makeVan("#4f8bff"), a: Math.PI / 2, sp: -0.14 }];
  // The limousine: long, black, with a gold stripe.
  const limo = new THREE.Group();
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 0.5).translate(0, 0.3, 0), own(std("#1c1640", { metalness: 0.6, roughness: 0.25 }))));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.46).translate(-0.05, 0.6, 0), winMat));
  limo.add(new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 0.52).translate(0, 0.32, 0), gold));
  for (const wx of [-0.55, 0.55]) for (const wz of [-0.25, 0.25]) limo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2).translate(wx, 0.1, wz), dark));
  limo.visible = false;
  life.add(limo);
  let limoFor = "", limoA = 0, limoT = 0;
  // A glowing ring and a power-cut shadow, placed on whichever lot needs them.
  const ringMat = own(new THREE.MeshBasicMaterial({ color: 0xff4f8b, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.3, 32).rotateX(-Math.PI / 2).translate(0, 0.12, 0), ringMat);
  ring.visible = false;
  life.add(ring);
  const criticMat = own(new THREE.MeshBasicMaterial({ color: 0x9a6cff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  const criticRing = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 32).rotateX(-Math.PI / 2).translate(0, 0.13, 0), criticMat);
  criticRing.visible = false;
  life.add(criticRing);

  // A soft golden ring under the building you've tapped.
  const selMat = own(new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1.95, 2.35, 40).rotateX(-Math.PI / 2).translate(0, 0.14, 0), selMat);
  selRing.visible = false;
  life.add(selRing);

  // Everything still is merged into a few meshes (the moving parts stay separate).
  mergeStatic(g);

  const idx = (id: string) => lots.findIndex(l => l.id === id);
  return {
    group: g,
    update(t, night, live) {
      // Windows, signs and lamps light up at night.
      winMat.emissiveIntensity = 0.05 + night * 0.9;
      lampMat.emissiveIntensity = 0.2 + night * 2.2;
      for (const m of signs) m.emissiveIntensity = 0.1 + night * 0.9 + (Math.sin(t * 3) > 0.96 ? -0.3 * night : 0);
      for (const b of beacons) {
        (b.material as THREE.MeshBasicMaterial).opacity = Math.max(0, night - 0.25) * 0.28;
        b.rotation.z = Math.sin(t * 0.5) * 0.35;
        b.rotation.x = Math.cos(t * 0.4) * 0.25;
      }
      jet.scale.y = 1 + Math.sin(t * 4) * 0.08;
      g.traverse(o => { if (o.userData.spin) o.rotation.y = t * 0.6; });
      // Walkers stroll the sidewalk; now and then one walks into a store (busier ones more).
      for (const w of walkers) {
        if (w.visit >= 0) {
          w.t += 0.016;
          const d = doors.get(lots[w.visit].id)!, out = Math.min(1, w.t), k = out < 0.5 ? out * 2 : (1 - out) * 2;
          const sx = Math.cos(w.a) * w.r, sz = Math.sin(w.a) * w.r;
          w.p.position.set(sx + (d.x - sx) * k, 0, sz + (d.z - sz) * k);
          w.p.visible = k < 0.95;
          if (w.t >= 1) { w.visit = -1; w.p.visible = true; }
          continue;
        }
        w.a += w.v * 0.016;
        w.p.position.set(Math.cos(w.a) * w.r, Math.abs(Math.sin(t * 9 + w.a * 20)) * 0.04, Math.sin(w.a) * w.r);
        w.p.rotation.y = -w.a + (w.v > 0 ? Math.PI : 0);
        // Passing an open store's door: maybe pop in.
        const near = lots.findIndex((l, i) => l.state === "open" && Math.abs(angDiff(w.a, lotPos(i).a)) < 0.02);
        if (near >= 0 && Math.random() < 0.08 + (live.rush === lots[near].id ? 0.5 : 0)) { w.visit = near; w.t = 0; }
      }
      // A crowd gathers in front of the rush-hour business.
      const ri = idx(live.rush);
      crowd.forEach((p, k) => {
        p.visible = ri >= 0;
        if (ri < 0) return;
        const { a } = lotPos(ri), ca = a + (k - 4.5) * 0.045, cr = 9.0 + (k % 3) * 0.3;
        p.position.set(Math.cos(ca) * cr, Math.abs(Math.sin(t * 12 + k)) * 0.12, Math.sin(ca) * cr);
        p.rotation.y = -a - Math.PI / 2;
      });
      ring.visible = ri >= 0;
      if (ri >= 0) {
        const { x, z } = lotPos(ri);
        ring.position.set(x, 0, z);
        ringMat.opacity = 0.45 + Math.sin(t * 6) * 0.2;
        ring.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
      }
      const si = idx(live.sel ?? "");
      selRing.visible = si >= 0;
      if (si >= 0) {
        const { x, z } = lotPos(si);
        selRing.position.set(x, 0, z);
        selMat.opacity = 0.55 + Math.sin(t * 4) * 0.25;
        selRing.scale.setScalar(1 + Math.sin(t * 4) * 0.03);
      }
      const ci = idx(live.critic);
      criticRing.visible = ci >= 0;
      if (ci >= 0) { const { x, z } = lotPos(ci); criticRing.position.set(x, 0, z); criticRing.rotation.y = t; }
      // Vans drive round the ring road.
      for (const v of vans) {
        v.a += v.sp * 0.016;
        v.v.position.set(Math.cos(v.a) * 10.6, 0, Math.sin(v.a) * 10.6);
        v.v.rotation.y = -v.a + (v.sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      // The VIP's limousine drives up to their business and waits outside.
      const vi = idx(live.vip);
      if (vi >= 0 && limoFor !== live.vip) { limoFor = live.vip; limoA = lotPos(vi).a - 1.2; limoT = 0; }
      if (vi < 0) limoFor = "";
      limo.visible = vi >= 0;
      if (vi >= 0) {
        limoT = Math.min(1, limoT + 0.016 / 2.2);
        const e = 1 - Math.pow(1 - limoT, 3), a = limoA + 1.2 * e;
        limo.position.set(Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5);
        limo.rotation.y = -a - Math.PI / 2;
      }
      void live.power;
    },
  };
}

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

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

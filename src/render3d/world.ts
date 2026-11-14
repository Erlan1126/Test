// The floating island in 3D: lawn, dirt and rock underneath, roads and plaza, trees,
// houses, the neighbors' buildings, island upgrades and the city buildings you've bought.
// Everything sits at the same positions as the old 2D island.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash } from "../core/util";
import { ISLAND } from "../data/constants";
import type { IslandTheme } from "../data/islands";
import { NEIGHBOR_LOOK } from "../data/skins";
import { BALLOONS, CARS, EXTRA_NEIGHBORS, FOUNTAIN, NEIGHBORS, POND, TREES, WHEEL } from "../render/scenery";
import { BEDS, BUILD_SPOTS, HOUSE_ROOFS, HOUSE_WALLS, HOUSES, LAKE, ROCKS } from "../render/details";
import { facadeFor } from "./facade";
import { boxFoot, FH, prism } from "./geom";
import { addCityLife } from "./citylife";
import { addIslandDetail } from "./islanddetail";

const I = ISLAND;
const col = (c: string | number[]) => (typeof c === "string" ? new THREE.Color(c) : new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255));
const std = (c: string | number[], o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.85, ...o });

function shadowed<T extends THREE.Object3D>(o: T, cast = true): T {
  o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = cast; c.receiveShadow = true; } });
  return o;
}

/** Things on the island that move each frame. */
export interface IslandAnim {
  update(t: number, night: number): void;
}

export interface IslandOptions {
  theme: IslandTheme;
  /** How many island upgrades are built (fountain, pond, neighbors, traffic, wheel, balloons). */
  level: number;
  city: string[];
}

export function buildIsland(o: IslandOptions): { group: THREE.Group; anim: IslandAnim } {
  const t = o.theme, g = new THREE.Group(), has = (i: number) => o.level > i;
  const anims: ((time: number, night: number) => void)[] = [];

  // ---- Ground: lawn on a slab of dirt with a grassy lip, rock tapering below ----
  const lawn = new THREE.MeshStandardMaterial({ map: lawnTexture(t), roughness: 0.95 });
  lawn.userData.snowable = true;   // turns white when it snows
  g.add(shadowed(new THREE.Mesh(new THREE.PlaneGeometry(I * 2, I * 2).rotateX(-Math.PI / 2), lawn), false));
  const dirt = new THREE.Mesh(new THREE.BoxGeometry(I * 2, 3 * FH, I * 2).translate(0, -1.5 * FH - 0.08, 0), [
    std(t.dirtR), std(t.dirtL), std(t.lawn), std(t.dirtL), std(t.dirtL), std(t.dirtR),
  ]);
  g.add(dirt);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(I * 2 + 0.06, 0.45 * FH, I * 2 + 0.06).translate(0, -0.225 * FH - 0.005, 0), std(t.lip));
  g.add(lip);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(I * Math.SQRT2, (I - 3) * FH, 4, 3).rotateY(Math.PI / 4).rotateX(Math.PI).translate(0, -3 * FH - (I - 3) * FH / 2, 0),
    new THREE.MeshStandardMaterial({ color: col(t.rockL), roughness: 1, flatShading: true }));
  jitter(rock.geometry as THREE.BufferGeometry, 0.9, 3);
  g.add(rock);

  // ---- Roads, plaza and flower beds ----
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(t.road), roughness: 0.9 });
  const road = (x0: number, x1: number, z0: number, z1: number, along: "x" | "z") => {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const len = along === "x" ? x1 - x0 : z1 - z0;
    for (let i = 0; i < uv.count; i++) {
      const [u, v] = [uv.getX(i), uv.getY(i)];
      uv.setXY(i, along === "x" ? u * len / 2.2 : v * len / 2.2, along === "x" ? v : u);
    }
    const m = new THREE.Mesh(geo, roadMat); m.receiveShadow = true; g.add(m);
  };
  road(7, I, -1.4, 1.4, "x"); road(-1.4, 1.4, 7, I, "z"); road(-I, -7, -1.4, 1.4, "x");
  const slab = (r: number, top: number, c: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2, top, r * 2).translate(0, top / 2, 0), std(c, { roughness: 0.7 })); m.receiveShadow = true; g.add(m); };
  slab(7.4, 0.12, t.plaza); slab(6.8, 0.22, t.plaza2);
  const flowerColors = ["#ff6b6b", "#ffd43b", "#f783ac", "#ffffff", "#b197fc"];
  for (const [x, z, k] of BEDS) {
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.35, 16).translate(x, 0.17, z), std("#8a6a4a"));
    g.add(shadowed(bed, false));
    const soil = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16).rotateX(-Math.PI / 2).translate(x, 0.42, z), std(t.leaf[0]));
    g.add(soil);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 + k, r = 0.25 + (i % 3) * 0.28;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4).translate(x + Math.cos(a) * r, 0.48, z + Math.sin(a) * r), std(flowerColors[(i + k) % 5]));
      g.add(f);
    }
  }

  // ---- Lake (always), fountain and duck pond (upgrades) ----
  // Water: a clear, rippling surface over a basin that is pale at the edges and deep blue
  // in the middle, with a stone coping and a thin line of foam where it meets the stone.
  const ripples = waterNormals();
  const water = new THREE.MeshStandardMaterial({
    color: col("#3aa7d8"), roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.8,
    normalMap: ripples, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6,
  });
  water.userData.dynamic = true;
  anims.push(time => { ripples.offset.set(time * 0.018, time * 0.011); });
  const basin = new THREE.MeshStandardMaterial({ map: basinTexture(), roughness: 0.9 });
  const foam = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const pool = (x: number, z: number, r: number, rim: string) => {
    const stone = std(rim, { roughness: 0.75 });
    // Coping: an outer wall, a flat ring on top and the inner wall down to the basin.
    g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.45, r + 0.5, 0.34, 40, 1, true).translate(x, 0.17, z), stone), false));
    g.add(shadowed(new THREE.Mesh(new THREE.RingGeometry(r, r + 0.45, 40).rotateX(-Math.PI / 2).translate(x, 0.34, z), stone), false));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.34, 40, 1, true).translate(x, 0.17, z), std(rim, { roughness: 0.8, side: THREE.BackSide }));
    g.add(shadowed(inner, false));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2).translate(x, 0.02, z), basin);
    floor.receiveShadow = true;
    g.add(floor);
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2).translate(x, 0.27, z), water);
    w.receiveShadow = true;
    w.userData.dynamic = true;
    g.add(w);
    const f = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 40).rotateX(-Math.PI / 2).translate(x, 0.28, z), foam);
    f.userData.dynamic = true;
    g.add(f);
  };
  pool(LAKE.x, LAKE.z, LAKE.r, "#d9cfc0");
  if (has(0)) {
    pool(FOUNTAIN.x, FOUNTAIN.z, 1.3, "#e9ecef");
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 8).translate(FOUNTAIN.x, 0.9, FOUNTAIN.z), std("#dee2e6"));
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 12).translate(FOUNTAIN.x, 2, FOUNTAIN.z), new THREE.MeshStandardMaterial({ color: col("#bfeaff"), transparent: true, opacity: 0.6, roughness: 0.1 }));
    g.add(spout, jet);
    jet.userData.dynamic = true;
    anims.push(time => { jet.scale.y = 1 + Math.sin(time * 5) * 0.08; });
  }
  if (has(1)) pool(POND.x, POND.z, POND.r, "#8a7a5a");

  // ---- Houses and the neighbors' buildings ----
  // Little houses: clapboard walls on a stone footing, a gabled roof with eaves, framed
  // windows with sills and shutters, and a front door with a step and a porch light.
  const siding = sidingTexture();
  const winLit = std("#9fc8e8", { roughness: 0.1, metalness: 0.4, emissive: col("#ffcf7a"), emissiveIntensity: 0 });
  winLit.userData.dynamic = true;
  const frameMat = std("#fbfaf6", { roughness: 0.6 });
  const footing = std("#9a948a", { roughness: 0.95 });
  anims.push((_t, night) => { winLit.emissiveIntensity = night * 1.5; });
  for (const [x, z, i] of HOUSES) {
    const h = new THREE.Group();
    const W = 2.6, D = 2.2, H = 1.6, wall = new THREE.MeshStandardMaterial({ color: col(HOUSE_WALLS[i % 6]), map: siding, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: col(HOUSE_ROOFS[i % 6]), roughness: 0.7, flatShading: true });
    h.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.2, D + 0.12).translate(0, 0.1, 0), footing));
    h.add(new THREE.Mesh(new THREE.BoxGeometry(W, H - 0.2, D).translate(0, 0.2 + (H - 0.2) / 2, 0), wall));
    // Gable ends: triangles of wall under the roof.
    const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, 0.95)]);
    const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: W, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-W / 2, H, 0);
    h.add(new THREE.Mesh(gableGeo, wall));
    // Roof: two slabs with an overhang, meeting at a ridge.
    const slope = Math.atan2(0.95, D / 2), len = Math.hypot(0.95, D / 2) + 0.35;
    for (const sd of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.12, len), roofMat);
      slab.rotation.x = sd * slope;
      slab.position.set(0, H + 0.95 / 2 - 0.02, sd * (D / 4 + 0.06));
      h.add(slab);
    }
    h.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.55, 0.1, 0.16).translate(0, H + 0.97, 0), roofMat));
    // Front door with a frame, a step and a little light.
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.0, 0.06).translate(0, 0.2 + 0.5, D / 2 + 0.01), frameMat));
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.06).translate(0, 0.2 + 0.45, D / 2 + 0.03), std(["#5a3e2b", "#2f5d8a", "#8a2f3b", "#2f6b4f"][i % 4], { roughness: 0.5 })));
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.35).translate(0, 0.06, D / 2 + 0.2), footing));
    const porch = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4).translate(0.42, 1.2, D / 2 + 0.06), winLit);
    h.add(porch);
    // Windows: front pair and one on each side, framed, with sills and shutters.
    const shutter = std(HOUSE_ROOFS[i % 6], { roughness: 0.7 });
    const windowAt = (wx: number, wz: number, rotY: number) => {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.05), frameMat));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.06), winLit));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.07), frameMat), new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.07), frameMat));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.14).translate(0, -0.3, 0.04), frameMat));
      for (const sd of [-1, 1]) w.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.04).translate(sd * 0.39, 0, 0), shutter));
      w.position.set(wx, 1.05, wz); w.rotation.y = rotY;
      h.add(w);
    };
    windowAt(-0.85, D / 2 + 0.01, 0); windowAt(0.85, D / 2 + 0.01, 0);
    windowAt(W / 2 + 0.01, 0, Math.PI / 2); windowAt(-W / 2 - 0.01, 0, -Math.PI / 2);
    h.position.set(x, 0, z);
    g.add(shadowed(h));
  }
  const facade = facadeFor(NEIGHBOR_LOOK);
  const shopGlass = std("#3d5470", { roughness: 0.15, metalness: 0.6 });
  const corniceMat = std("#eae6dd", { roughness: 0.7 });
  const balcony = std("#e3e0d8", { roughness: 0.7 });
  const railing = std("#5f6b7a", { roughness: 0.4, metalness: 0.5 });
  const AWNINGS = ["#d9534f", "#2f7d6d", "#e8a33d", "#3b6fb6", "#8e5aa8"];
  const nbMat = (c: number[]) => [new THREE.MeshStandardMaterial({ color: col(c), map: facade.map, emissiveMap: facade.lit, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: facade.orm, metalnessMap: facade.orm, roughness: 1, metalness: 1 }), std(c.map(v => Math.min(255, v * 1.1)))];
  const neighbors = [...NEIGHBORS, ...(has(2) ? EXTRA_NEIGHBORS : [])];
  for (const nb of neighbors) {
    const mats = nbMat(nb.color);
    const m = new THREE.Mesh(prism(boxFoot(nb), 0, nb.h * FH, false, 1), mats);
    anims.push((_t, night) => { (mats[0] as THREE.MeshStandardMaterial).emissiveIntensity = night * 1.3; });
    g.add(shadowed(m));
    // Rooftop parapet
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(nb.x1 - nb.x0 - 0.6, 0.2, nb.z1 - nb.z0 - 0.6).translate((nb.x0 + nb.x1) / 2, nb.h * FH + 0.1, (nb.z0 + nb.z1) / 2), std("#c9ced6"))));
    // A shopfront ground floor (dark glass, a colored awning over each street side), a
    // cornice at the roofline and balconies up the two faces you see.
    const cx = (nb.x0 + nb.x1) / 2, cz = (nb.z0 + nb.z1) / 2, w = nb.x1 - nb.x0, d = nb.z1 - nb.z0, top = nb.h * FH;
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, FH * 0.78, d + 0.06).translate(cx, FH * 0.39, cz), shopGlass), false));
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.16, d + 0.3).translate(cx, top - 0.08, cz), corniceMat)));
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.12, d + 0.16).translate(cx, FH * 0.84, cz), corniceMat)));
    const awnMat = std(AWNINGS[neighbors.indexOf(nb) % AWNINGS.length], { roughness: 0.7 });
    const awnZ = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.06, 0.7).translate(0, 0, 0.35), awnMat);
    awnZ.rotation.x = 0.35; awnZ.position.set(cx, FH * 0.95, nb.z1 + 0.02);
    const awnX = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, d * 0.8).translate(0.35, 0, 0), awnMat);
    awnX.rotation.z = -0.35; awnX.position.set(nb.x1 + 0.02, FH * 0.95, cz);
    g.add(shadowed(awnZ), shadowed(awnX));
    for (let f = 1; f < nb.h; f++) {
      const y = f * FH + 0.05;
      for (const k of [-0.25, 0.25]) {
        // On the +z face...
        g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.5).translate(cx + k * w, y, nb.z1 + 0.25), balcony)));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 0.04).translate(cx + k * w, y + 0.22, nb.z1 + 0.48), railing));
        // ...and on the +x face.
        g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.1).translate(nb.x1 + 0.25, y, cz + k * d), balcony)));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 1.1).translate(nb.x1 + 0.48, y + 0.22, cz + k * d), railing));
      }
    }
  }

  // ---- Trees: instanced, styled by the island theme ----
  const near = (tx: number, tz: number, x: number, z: number, r: number) => Math.hypot(tx - x, tz - z) < r;
  const trees = TREES.filter(tr =>
    !(has(0) && near(tr.x, tr.z, FOUNTAIN.x, FOUNTAIN.z, 2)) && !(has(1) && near(tr.x, tr.z, POND.x, POND.z, POND.r + 1))
    && !(has(4) && near(tr.x, tr.z, WHEEL.x, WHEEL.z, 3))
    && !(has(6) && near(tr.x, tr.z, 20.5, 4.5, 1.8)) && !(has(7) && Math.abs(tr.x - POND.x) < 1.8 && tr.z > POND.z) && !(has(11) && near(tr.x, tr.z, -16, -9.5, 2))
    && !o.city.some(id => { const s = BUILD_SPOTS[id]; return s && near(tr.x, tr.z, s.x, s.z, s.r + 0.6); })
    && !(has(2) && EXTRA_NEIGHBORS.some(b => tr.x > b.x0 - 1 && tr.x < b.x1 + 1 && tr.z > b.z0 - 1 && tr.z < b.z1 + 1)));
  g.add(treeInstances(trees, t));

  // ---- Small details: sidewalks, lamps, benches, fences, bushes, flowers... ----
  const inBox = (x: number, z: number, b: { x0: number; x1: number; z0: number; z1: number }, pad: number) =>
    x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
  const blocked = (x: number, z: number, r: number) =>
    trees.some(tr => near(x, z, tr.x, tr.z, r + 0.9))
    || BEDS.some(([bx, bz]) => near(x, z, bx, bz, r + 1.4))
    || near(x, z, LAKE.x, LAKE.z, LAKE.r + r + 0.7) || near(x, z, LAKE.x + LAKE.r * 0.4, LAKE.z - LAKE.r, r + 1.2)
    || (has(0) && near(x, z, FOUNTAIN.x, FOUNTAIN.z, r + 2))
    || (has(1) && near(x, z, POND.x, POND.z, POND.r + r + 0.8))
    || (has(4) && near(x, z, WHEEL.x, WHEEL.z, r + 3.2))
    || HOUSES.some(([hx, hz]) => x > hx - 2.2 - r && x < hx + 2.2 + r && z > hz - 2 - r && z < hz + 2.6 + r)
    || [...NEIGHBORS, ...(has(2) ? EXTRA_NEIGHBORS : [])].some(b => inBox(x, z, b, r + 0.6))
    || o.city.some(id => { const sp = BUILD_SPOTS[id]; return !!sp && near(x, z, sp.x, sp.z, sp.r + r + 0.5); })
    || (has(6) && near(x, z, 20.5, 4.5, r + 1.6))
    || (has(7) && Math.abs(x - POND.x) < 1.6 + r && z > POND.z)
    || (has(11) && near(x, z, -16, -9.5, r + 1.8));
  addIslandDetail(g, { theme: t, has, blocked, anims });

  // ---- Floating rocks around the island ----
  for (const [i, k] of ROCKS.entries()) {
    const r = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(k.r * 1.3, k.r * 2.4, 5, 2).rotateX(Math.PI).translate(0, -k.r * 1.2, 0), new THREE.MeshStandardMaterial({ color: col(t.rockR), roughness: 1, flatShading: true }));
    jitter(cone.geometry as THREE.BufferGeometry, 0.25, i + 9);
    r.add(cone, new THREE.Mesh(new THREE.CylinderGeometry(k.r * 1.3, k.r * 1.3, 0.35, 5).translate(0, 0.17, 0), std(t.lawn)));
    if (k.tree) r.add(treeInstances([{ x: 0, z: 0, size: 1, hue: hash(i, 1, 1) }], t));
    r.position.set(k.x, k.y * FH, k.z);
    r.userData.dynamic = true;
    r.userData.floater = true; // hidden on the home screen (see Renderer3D)
    g.add(shadowed(r));
    anims.push(time => { r.position.y = k.y * FH + Math.sin(time * 0.5 + i * 1.7) * 0.45; });
  }

  // ---- Upgrades: street lights and cars, Ferris wheel, balloons ----
  {
    // A couple of cars from the start; the traffic upgrade fills the streets.
    const cars = CARS.slice(0, has(3) ? CARS.length : 2).map(c => {
      const car = new THREE.Group();
      car.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.8).translate(0, 0.35, 0), std(c.color as unknown as number[], { roughness: 0.4, metalness: 0.3 })));
      car.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.7).translate(-0.1, 0.72, 0), std("#bfe3ff", { roughness: 0.1 })));
      if (c.road === "z") car.rotation.y = Math.PI / 2;
      car.userData.dynamic = true;
      g.add(shadowed(car));
      return { c, car };
    });
    anims.push(time => {
      for (const { c, car } of cars) {
        const span = I - 7.5, u = 7.5 + (((time * c.speed + c.off) % span) + span) % span;
        if (c.road === "x") car.position.set(u, 0, c.lane); else car.position.set(c.lane, 0, u);
      }
    });
  }
  if (has(4)) {
    const wheel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 6, 32), std("#ff6b6b", { roughness: 0.5 }));
    wheel.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 4).translate(0, 1.6, 0).rotateZ(a), std("#f1f3f5"));
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(Math.sin(-a) * 3.2, Math.cos(a) * 3.2, 0), std(["#ffd43b", "#4dabf7", "#51cf66", "#f783ac"][i % 4]));
      wheel.add(spoke, cab);
    }
    wheel.position.set(WHEEL.x, 4, WHEEL.z);
    wheel.userData.dynamic = true;
    wheel.rotation.y = Math.PI / 4;
    const legs = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 4, 1, true).translate(WHEEL.x, 2, WHEEL.z), std("#868e96"));
    g.add(shadowed(legs), shadowed(wheel));
    anims.push(time => { wheel.rotation.z = time * 0.25; });
  }
  if (has(5)) {
    for (const b of BALLOONS) {
      const bl = new THREE.Group();
      bl.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12).scale(1, 1.2, 1), std(b.color, { roughness: 0.6 })));
      bl.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5).translate(0, -1.7, 0), std("#8a6a4a")));
      bl.userData.dynamic = true;
      g.add(shadowed(bl));
      anims.push(time => bl.position.set(b.x, b.level * FH + Math.sin(time * 0.6 + b.phase) * 0.8, b.z));
    }
  }

  if (has(6)) {
    // A cable car from a station on the island's edge out to the floating rock beside it.
    const [ax, ay, az] = [20.5, 5.2, 4.5], rk = ROCKS[2], [bx, by, bz] = [rk.x, rk.y + 4.2, rk.z];
    const station = (x: number, y0: number, z: number, h: number) => {
      g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4).translate(x, y0 + h / 2, z), std("#e9ecef"))));
      g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.8).translate(x, y0 + h + 0.12, z), std("#ff6b6b"))));
    };
    station(ax, 0, az, ay - 0.3);
    station(bx, rk.y + 0.2, bz, by - rk.y - 0.5);
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 4), std("#343a40"));
    cable.position.set((ax + bx) / 2, (ay + by) / 2 + 0.3, (az + bz) / 2);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx - ax, by - ay, bz - az).normalize());
    g.add(cable);
    const cab = new THREE.Group();
    cab.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.7).translate(0, -0.7, 0), std("#ffd43b", { roughness: 0.4 })));
    cab.add(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.3, 0.72).translate(0, -0.55, 0), std("#bfe3ff", { roughness: 0.1 })));
    cab.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4).translate(0, -0.1, 0), std("#343a40")));
    cab.userData.dynamic = true;
    g.add(shadowed(cab));
    anims.push(time => {
      const k = (1 - Math.cos(time * 0.25)) / 2; // eases to a stop at each station
      cab.position.set(ax + (bx - ax) * k, ay + (by - ay) * k + 0.3, az + (bz - az) * k);
    });
  }
  if (has(7)) {
    // A stream from the duck pond running off the front edge of the island as a waterfall.
    const wx = POND.x, edge = I + 0.02;
    const tex = waterTexture();
    const fall = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    fall.userData.dynamic = true;
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(2, edge - POND.z - POND.r + 0.4).rotateX(-Math.PI / 2).translate(wx, 0.28, (edge + POND.z + POND.r - 0.4) / 2), water));
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 12).translate(wx, -6 + 0.28, edge + 0.08), fall);
    g.add(sheet);
    const mist = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8).scale(1.2, 0.6, 0.7).translate(wx, -11.6, edge + 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    g.add(mist);
    anims.push(time => { tex.offset.y = time * 0.9; });
  }
  if (has(8)) {
    // Three little islands of garden floating around the big one.
    const spots: [number, number, number, string][] = [[-31, 2, -14, "#ff8fab"], [-12, -2, -33, "#ffd43b"], [33, 1, 12, "#b197fc"]];
    spots.forEach(([x, y, z, flower], i) => {
      const isl = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.ConeGeometry(3, 4.5, 7).rotateX(Math.PI).translate(0, -2.25, 0), new THREE.MeshStandardMaterial({ color: col(t.rockL), roughness: 1, flatShading: true }));
      isl.add(rock);
      isl.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 14).translate(0, 0.2, 0), std(t.lawn)));
      isl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6).translate(-0.8, 1.1, 0), std(t.trunk)));
      isl.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1).translate(-0.8, 2.3, 0), std(t.leaf[0], { flatShading: true })));
      for (let k = 0; k < 6; k++) isl.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4).translate(0.9 + Math.cos(k) * 0.9, 0.5, Math.sin(k) * 0.9), std(k % 2 ? flower : "#ffffff")));
      isl.userData.dynamic = true;
      g.add(shadowed(isl));
      anims.push(time => { isl.position.set(x, y + Math.sin(time * 0.4 + i * 2) * 0.7, z); });
    });
  }
  if (has(9)) {
    // Fireworks over the island at night: a few bursts of glowing sparks, one after another.
    const N = 3, SP = 28;
    const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), N * SP);
    sparks.frustumCulled = false;
    sparks.userData.dynamic = true;
    const hues = [0xff5d8f, 0xffd43b, 0x63e6be, 0x74c0fc, 0xb197fc];
    const m4 = new THREE.Matrix4(), c = new THREE.Color(), dirs = Array.from({ length: SP }, (_, i) => {
      const yv = 1 - (2 * (i + 0.5)) / SP, r = Math.sqrt(1 - yv * yv), a = i * 2.4;
      return new THREE.Vector3(Math.cos(a) * r, yv, Math.sin(a) * r);
    });
    g.add(sparks);
    anims.push((time, night) => {
      const mat = sparks.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, night - 0.3) * 1.4;
      sparks.visible = mat.opacity > 0.01;
      if (!sparks.visible) return;
      for (let b = 0; b < N; b++) {
        const cyc = time / 3.2 + b / N, n = Math.floor(cyc), k = cyc - n;
        const cx = (hash(n, b, 1) - 0.5) * 30, cz = (hash(n, b, 2) - 0.5) * 30, cy = 24 + hash(n, b, 3) * 10;
        const rad = 5 * Math.sqrt(k), sz = k < 0.85 ? 1 : (1 - k) / 0.15;
        c.setHex(hues[Math.floor(hash(n, b, 4) * hues.length)]);
        for (let i = 0; i < SP; i++) {
          const d = dirs[i];
          m4.makeScale(sz, sz, sz).setPosition(cx + d.x * rad, cy + d.y * rad - k * k * 3, cz + d.z * rad);
          sparks.setMatrixAt(b * SP + i, m4);
          sparks.setColorAt(b * SP + i, c);
        }
      }
      sparks.instanceMatrix.needsUpdate = true;
      if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
    });
  }
  if (has(10)) {
    // A soft rainbow arching behind the island.
    const colors = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa];
    const bow = new THREE.Group();
    colors.forEach((cl, i) => {
      bow.add(new THREE.Mesh(new THREE.TorusGeometry(34 - i * 1.1, 0.55, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.3, depthWrite: false })));
    });
    bow.rotation.y = Math.PI / 4;
    bow.position.set(-30, -14, -30);
    bow.userData.dynamic = true;
    g.add(bow);
    anims.push((_t, night) => bow.children.forEach(m => { ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - night * 0.8); }));
  }
  if (has(11)) {
    // A golden obelisk whose beam of light reaches up into the night sky.
    const [x, z] = [-16, -9.5];
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2).translate(x, 0.25, z), std("#e9ecef"))));
    g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 5.5, 4).rotateY(Math.PI / 4).translate(x, 3.25, z), std("#ffc94a", { metalness: 0.9, roughness: 0.25 }))));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4).rotateY(Math.PI / 4).translate(x, 6.45, z), std("#fff3bf", { emissive: col("#ffd23f"), emissiveIntensity: 0.6 }));
    tip.userData.dynamic = true;
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.35, 90, 12, 1, true).translate(x, 6.9 + 45, z), beamMat);
    beam.userData.dynamic = true;
    g.add(tip, beam);
    anims.push((time, night) => {
      (tip.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + night * 2.5;
      beamMat.opacity = night * (0.22 + Math.sin(time * 1.5) * 0.04);
      beam.visible = night > 0.05;
    });
  }

  // ---- City buildings ----
  for (const id of o.city) {
    const s = BUILD_SPOTS[id];
    if (!s) continue;
    const b = cityBuilding(id, anims);
    b.position.set(s.x, 0, s.z);
    g.add(shadowed(b));
  }

  // ---- People, a boat and birds ----
  anims.push(addCityLife(g));

  // Things that move as one (the Ferris wheel, balloons, cars, floating rocks...) are
  // merged inside themselves first, then everything still is merged into the island.
  const movers: THREE.Object3D[] = [];
  g.traverse(o => { if (o !== g && o.userData.dynamic && !(o as THREE.Mesh).isMesh) movers.push(o); });
  for (const mv of movers) mergeStatic(mv);
  mergeStatic(g);
  return { group: g, anim: { update: (time, night) => anims.forEach(a => a(time, night)) } };
}

/** Merges every still mesh into as few meshes as possible, so the phone draws the island in
 *  a handful of steps instead of hundreds. Each piece's color is baked into its vertices,
 *  so pieces of every color share one mesh as long as they're the same kind of surface
 *  (roughness, metalness, texture, glow). Pieces whose material animates (lit windows,
 *  lamps) merge only with others using that same material. Moving things stay separate. */
function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const toLocal = root.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const groups = new Map<string, { mat: THREE.MeshStandardMaterial; geos: THREE.BufferGeometry[]; cast: boolean; tint: boolean; rough: number; metal: number }>();
  const remove: THREE.Mesh[] = [];
  const c = new THREE.Color();
  const visit = (o: THREE.Object3D) => {
    if (o !== root && o.userData.dynamic) return;
    for (const ch of o.children) visit(ch);
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial || mat.transparent || mat.vertexColors) return;
    // Materials that animate keep their identity; the rest group by surface, not color.
    const tint = !mat.userData.dynamic;
    // Near-identical surfaces count as one (roughness in quarters, metal or not), so more
    // pieces share a mesh; nobody can tell 0.7 from 0.75 roughness on a phone screen.
    const rough = Math.round(mat.roughness * 4) / 4, metal = mat.metalness >= 0.5 ? 1 : mat.metalness > 0.15 ? 0.3 : 0;
    const key = tint
      ? ["t", rough, metal, mat.flatShading, mat.map?.uuid, mat.emissive?.getHexString(), mat.emissiveIntensity, mat.side, mat.envMapIntensity, m.castShadow].join("|")
      : `d|${mat.uuid}|${m.castShadow}`;
    let gr = groups.get(key);
    if (!gr) { gr = { mat, geos: [], cast: m.castShadow, tint, rough, metal }; groups.set(key, gr); }
    let geo = m.geometry.clone().applyMatrix4(rel.multiplyMatrices(toLocal, m.matrixWorld));
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    const n = geo.attributes.position.count;
    if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (tint) {
      c.copy(mat.color);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    }
    gr.geos.push(geo);
    remove.push(m);
  };
  visit(root);
  for (const m of remove) { m.removeFromParent(); m.geometry.dispose(); }
  for (const { mat, geos, cast, tint, rough, metal } of groups.values()) {
    const merged = mergeGeometries(geos);
    geos.forEach(x => x.dispose());
    if (!merged) continue;
    let use: THREE.Material = mat;
    if (tint) {
      const v = mat.clone();
      v.vertexColors = true;
      v.color.set(0xffffff);
      v.roughness = rough; v.metalness = metal;
      use = v;
    }
    const mesh = new THREE.Mesh(merged, use);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

/** Falling-water streaks that scroll down the waterfall. */
function waterTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#7fd3f7"; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(255,255,255,${0.25 + hash(i, 1, 2) * 0.5})`;
    x.fillRect(hash(i, 3, 4) * 62, hash(i, 5, 6) * 128, 1.5 + hash(i, 7, 8) * 2, 18 + hash(i, 9, 1) * 40);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.userData.own = true; // freed with the island
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cityBuilding(id: string, anims: ((t: number, n: number) => void)[]): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, c: string, o: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.Mesh(geo, std(c, o)); g.add(m); return m; };
  switch (id) {
    case "cafe":
      add(new THREE.BoxGeometry(2.6, 1.5, 2).translate(0, 0.75, 0), "#fff1e6");
      add(new THREE.BoxGeometry(2.8, 0.15, 0.9).rotateX(-0.35).translate(0, 1.5, 1.2), "#ff6b6b");
      for (const x of [-0.8, 0.8]) {
        add(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10).translate(x, 0.7, 2), "#ffffff");
        add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4).translate(x, 0.35, 2), "#495057");
      }
      break;
    case "playground":
      add(new THREE.BoxGeometry(0.15, 1.6, 0.15).translate(-1, 0.8, 0), "#4dabf7");
      add(new THREE.BoxGeometry(0.15, 1.6, 0.15).translate(1, 0.8, 0), "#4dabf7");
      add(new THREE.BoxGeometry(2.2, 0.15, 0.15).translate(0, 1.6, 0), "#ffd43b");
      add(new THREE.BoxGeometry(0.6, 0.1, 2.2).rotateX(0.5).translate(1.6, 0.6, 0.3), "#ff6b6b");
      add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16).translate(-1.2, 0.05, 1.3), "#f3d9a4");
      break;
    case "statue":
      add(new THREE.BoxGeometry(1.2, 1, 1.2).translate(0, 0.5, 0), "#ced4da");
      add(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8).translate(0, 1.75, 0), "#ffd23f", { metalness: 0.8, roughness: 0.3 });
      add(new THREE.SphereGeometry(0.25, 10, 8).translate(0, 2.55, 0), "#ffd23f", { metalness: 0.8, roughness: 0.3 });
      break;
    case "windmill": {
      add(new THREE.CylinderGeometry(0.7, 1.1, 3.4, 8).translate(0, 1.7, 0), "#f8f0e3");
      add(new THREE.ConeGeometry(0.9, 1, 8).translate(0, 3.9, 0), "#b5523b");
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.06).translate(0, 1.1, 0), std("#ffffff"));
        bl.rotation.z = (i * Math.PI) / 2;
        blades.add(bl);
      }
      blades.position.set(0.0, 3.2, 0.95);
      blades.userData.dynamic = true;
      g.add(blades);
      anims.push(t => { blades.rotation.z = t * 0.9; });
      break;
    }
    case "observatory":
      add(new THREE.CylinderGeometry(1.2, 1.3, 1.6, 16).translate(0, 0.8, 0), "#e9ecef");
      add(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.6, 0), "#adb5bd", { metalness: 0.6, roughness: 0.3 });
      add(new THREE.CylinderGeometry(0.18, 0.25, 1.4, 8).rotateZ(-0.8).translate(0.6, 2.4, 0), "#495057");
      break;
    case "lighthouse": {
      for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.7 - i * 0.06, 0.76 - i * 0.06, 0.9, 12).translate(0, 0.45 + i * 0.9, 0), i % 2 ? "#ff6b6b" : "#ffffff");
      const lamp = add(new THREE.SphereGeometry(0.45, 12, 8).translate(0, 4.9, 0), "#fff3bf", { emissive: col("#ffe066"), emissiveIntensity: 0 });
      add(new THREE.ConeGeometry(0.6, 0.6, 12).translate(0, 5.5, 0), "#343a40");
      lamp.userData.dynamic = true;
      anims.push((_t, night) => { (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + night * 2; });
      break;
    }
    case "rocket": {
      add(new THREE.CylinderGeometry(1.6, 1.7, 0.3, 16).translate(0, 0.15, 0), "#868e96");
      const rocket = new THREE.Group();
      rocket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 2.6, 12).translate(0, 1.6, 0), std("#f8f9fa", { metalness: 0.3, roughness: 0.4 })));
      rocket.add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 12).translate(0, 3.35, 0), std("#ff6b6b")));
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.6).translate(0, 0.6, 0.5), std("#ff6b6b"));
        fin.rotation.y = (i * Math.PI * 2) / 3;
        rocket.add(fin);
      }
      rocket.userData.dynamic = true;
      g.add(rocket);
      // Every so often it launches, then a new one stands ready.
      anims.push(t => { const c = t % 40; rocket.position.y = c > 34 ? (c - 34) ** 2.2 * 2 : 0; });
      break;
    }
    case "carousel": {
      // A striped canopy on a pole over a turning ring of horses.
      add(new THREE.CylinderGeometry(1.9, 2, 0.3, 20).translate(0, 0.15, 0), "#f1e3c8");
      add(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8).translate(0, 1.6, 0), "#ffd23f", { metalness: 0.7, roughness: 0.3 });
      const top = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const seg = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 8, 1, true, (i * Math.PI) / 4, Math.PI / 4).translate(0, 3.1, 0), std(i % 2 ? "#ff6b6b" : "#ffffff", { side: THREE.DoubleSide }));
        top.add(seg);
      }
      top.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6).translate(0, 3.6, 0), std("#ffd23f", { metalness: 0.7, roughness: 0.3 })));
      const ring = new THREE.Group();
      const horse = ["#ffffff", "#ffd8a8", "#a5d8ff", "#fcc2d7", "#d8f5a2", "#e5dbff"];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35;
        ring.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 4).translate(x, 1.45, z), std("#ffd23f", { metalness: 0.7, roughness: 0.3 })));
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.7), std(horse[i]));
        h.position.set(x, 1.05, z); h.rotation.y = -a;
        ring.add(h);
      }
      top.userData.dynamic = ring.userData.dynamic = true;
      g.add(top, ring);
      anims.push(t => { ring.rotation.y = top.rotation.y = t * 0.6; });
      break;
    }
    case "clock": {
      // A brick tower with a clock face on each side, a green copper roof and a spire.
      add(new THREE.BoxGeometry(1.8, 0.5, 1.8).translate(0, 0.25, 0), "#c9b79c");
      add(new THREE.BoxGeometry(1.4, 4.2, 1.4).translate(0, 2.6, 0), "#b8735a");
      add(new THREE.BoxGeometry(1.6, 1.4, 1.6).translate(0, 5.4, 0), "#e8dcc8");
      const face = std("#fffaf0", { emissive: col("#ffe8a3"), emissiveIntensity: 0 });
      face.userData.dynamic = true;
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20).rotateX(Math.PI / 2).translate(0, 5.4, 0.82), face);
        f.rotation.y = (i * Math.PI) / 2;
        g.add(f);
      }
      const hands = new THREE.Group();
      hands.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.03).translate(0, 0.18, 0), std("#212529")));
      hands.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.03).translate(0, 0.12, 0), std("#212529")));
      hands.position.set(0, 5.4, 0.87);
      hands.userData.dynamic = true;
      for (const hand of hands.children) hand.userData.dynamic = true; // each turns on its own
      g.add(hands);
      add(new THREE.ConeGeometry(1.25, 1.6, 4).rotateY(Math.PI / 4).translate(0, 6.9, 0), "#5fae96", { flatShading: true });
      add(new THREE.CylinderGeometry(0.02, 0.05, 0.9, 4).translate(0, 8.1, 0), "#ffd23f", { metalness: 0.8, roughness: 0.3 });
      anims.push((t, night) => {
        face.emissiveIntensity = night * 1.6;
        hands.children[0].rotation.z = -t * 0.5; hands.children[1].rotation.z = -t * 0.04;
      });
      break;
    }
    case "dish": {
      // A radio telescope: a white dish on a turning mount, slowly sweeping the sky.
      add(new THREE.CylinderGeometry(1.3, 1.5, 0.4, 16).translate(0, 0.2, 0), "#ced4da");
      const mount = new THREE.Group();
      mount.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5).translate(0, 1.3, 0), std("#e9ecef")));
      const tilt = new THREE.Group();
      tilt.add(new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38).rotateX(Math.PI).translate(0, 1.4, 0), std("#f8f9fa", { side: THREE.DoubleSide, roughness: 0.4 })));
      tilt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4).translate(0, 0.75, 0), std("#868e96")));
      tilt.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.5, 0), std("#ff6b6b")));
      tilt.position.y = 2.2; tilt.rotation.x = -0.7;
      mount.add(tilt);
      mount.userData.dynamic = true;
      g.add(mount);
      anims.push(t => { mount.rotation.y = Math.sin(t * 0.15) * 1.4; tilt.rotation.x = -0.6 - Math.sin(t * 0.23) * 0.25; });
      break;
    }
    case "balloon": {
      // A launch field with a basket on the ground and a striped balloon bobbing on its rope.
      add(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 20).translate(0, 0.03, 0), "#e3c27a");
      const b = new THREE.Group();
      const colors = ["#ff6b6b", "#ffd43b", "#4dabf7", "#ffffff"];
      for (let i = 0; i < 8; i++) {
        b.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 4, 12, (i * Math.PI) / 4, Math.PI / 4).scale(1, 1.2, 1).translate(0, 4.6, 0), std(colors[i % 4], { roughness: 0.55 })));
      }
      b.add(new THREE.Mesh(new THREE.ConeGeometry(0.75, 1, 12, 1, true).rotateX(Math.PI).translate(0, 3.25, 0), std("#ff6b6b", { side: THREE.DoubleSide })));
      b.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55).translate(0, 2.5, 0), std("#8a6a4a")));
      b.userData.dynamic = true;
      g.add(b);
      anims.push(t => { b.position.y = 1.5 + Math.sin(t * 0.35) * 1.4; b.rotation.y = t * 0.1; });
      break;
    }
    case "pagoda": {
      // Five shrinking tiers with upturned red roofs and lanterns that glow at night.
      add(new THREE.BoxGeometry(2.8, 0.4, 2.8).translate(0, 0.2, 0), "#d8cbb3");
      const lantern = std("#ffe8a3", { emissive: col("#ffb347"), emissiveIntensity: 0.2 });
      lantern.userData.dynamic = true;
      let y = 0.4;
      for (let i = 0; i < 5; i++) {
        const w = 1.7 - i * 0.24, h = 0.75 - i * 0.05;
        add(new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0), "#f4e9d8");
        y += h;
        add(new THREE.CylinderGeometry(w * 0.45, w * 0.95, 0.35, 4, 1).rotateY(Math.PI / 4).translate(0, y + 0.17, 0), "#c0392b", { flatShading: true });
        for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4).translate(lx * w * 0.62, y - 0.05, lz * w * 0.62), lantern));
        y += 0.35;
      }
      add(new THREE.CylinderGeometry(0.03, 0.08, 1.2, 6).translate(0, y + 0.6, 0), "#ffd23f", { metalness: 0.8, roughness: 0.25 });
      anims.push((_t, night) => { lantern.emissiveIntensity = 0.2 + night * 2.2; });
      break;
    }
    case "stadium": {
      // An oval bowl of stands around a green pitch, with four floodlight masts.
      add(new THREE.CylinderGeometry(3, 3.1, 0.9, 28, 1, true).scale(1, 1, 0.75).translate(0, 0.45, 0), "#dee2e6", { side: THREE.DoubleSide });
      add(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 28).scale(1, 1, 0.75).translate(0, 0.15, 0), "#62b866");
      add(new THREE.BoxGeometry(2.6, 0.02, 0.06).translate(0, 0.32, 0), "#ffffff");
      add(new THREE.TorusGeometry(3, 0.12, 6, 28).rotateX(Math.PI / 2).scale(1, 1, 0.75).translate(0, 0.9, 0), "#4dabf7");
      const flood = std("#ffffff", { emissive: col("#fff6d5"), emissiveIntensity: 0 });
      flood.userData.dynamic = true;
      for (const [x, z] of [[2.6, 1.9], [-2.6, 1.9], [2.6, -1.9], [-2.6, -1.9]]) {
        add(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 5).translate(x, 1.6, z), "#adb5bd");
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.15).translate(x, 3.3, z), flood));
      }
      anims.push((_t, night) => { flood.emissiveIntensity = night * 2.5; });
      break;
    }
    case "airship": {
      // A mooring mast, and a silver airship cruising in a wide circle above the island.
      add(new THREE.CylinderGeometry(0.12, 0.3, 4.5, 6).translate(0, 2.25, 0), "#adb5bd", { metalness: 0.6, roughness: 0.35 });
      add(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10).translate(0, 4.6, 0), "#ff6b6b");
      const ship = new THREE.Group();
      ship.add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12).scale(3.2, 1, 1), std("#dfe4ea", { metalness: 0.55, roughness: 0.3 })));
      ship.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.5).translate(0, -1.05, 0), std("#495057")));
      for (const r of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06).translate(-2.9, 0.5, 0), std("#ff6b6b"));
        fin.rotation.x = r;
        ship.add(fin);
      }
      ship.userData.dynamic = true;
      // It flies around the whole island, so it hangs off the scene rather than the mast.
      const pivot = new THREE.Group();
      pivot.add(ship);
      pivot.userData.dynamic = true;
      g.add(pivot);
      anims.push(t => {
        const a = t * 0.05, R = 24;
        // The building group sits at the mast; move the ship relative to the island centre.
        ship.position.set(Math.cos(a) * R - BUILD_SPOTS.airship.x, 16 + Math.sin(t * 0.4) * 0.6, Math.sin(a) * R - BUILD_SPOTS.airship.z);
        ship.rotation.y = -a - Math.PI / 2;
      });
      break;
    }
  }
  return g;
}

/** Round, pine or palm trees as two instanced meshes (trunks and crowns). */
function treeInstances(list: { x: number; z: number; size: number; hue: number }[], t: IslandTheme): THREE.Group {
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0);
  const crownGeo = t.tree === "pine" ? new THREE.ConeGeometry(0.9, 2.2, 7).translate(0, 2, 0)
    : t.tree === "palm" ? new THREE.ConeGeometry(1.2, 0.6, 7).translate(0, 2.1, 0)
    : new THREE.IcosahedronGeometry(0.95, 1).translate(0, 1.75, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, std(t.trunk), list.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const leaf = col(t.leaf[0]), leaf2 = col(t.leaf[1]);
  list.forEach((tr, i) => {
    const s = 0.9 + tr.size * 0.5, h = t.tree === "palm" ? 2.1 : 1.2;
    m.compose(new THREE.Vector3(tr.x, 0, tr.z), q, new THREE.Vector3(s, s * h, s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(tr.x, 0, tr.z), q.setFromEuler(new THREE.Euler(0, tr.hue * 6, 0)), new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, c.copy(leaf).lerp(leaf2, tr.hue));
  });
  g.add(trunks, crowns);
  return shadowed(g);
}

/** Mown stripes and a little noise on the lawn. */
function lawnTexture(t: IslandTheme): THREE.Texture {
  // 1024 px over the whole island (about 23 px a unit), so blades stay crisp up close.
  const N = 1024, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(t.lawn), hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const tone = (dl: number, ds = 0, dh = 0, a = 1) => `hsla(${Math.round((hsl.h + dh) * 360)},${Math.round(Math.min(1, Math.max(0, hsl.s + ds)) * 100)}%,${Math.round(Math.min(0.97, Math.max(0.03, hsl.l + dl)) * 100)}%,${a})`;
  g.fillStyle = t.lawn; g.fillRect(0, 0, N, N);
  // Soft patches: some sunnier and yellower, some lusher and darker, like a real lawn.
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 3, 1) * N, y = hash(i, 3, 2) * N, r = 40 + hash(i, 3, 3) * 150, light = hash(i, 3, 4) > 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, light ? tone(0.06, -0.05, -0.025, 0.35) : tone(-0.07, 0.05, 0.01, 0.35));
    gr.addColorStop(1, tone(0, 0, 0, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Faint mowing stripes.
  for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.025)"; g.fillRect(0, i * N / 22, N, N / 22); }
  const grassy = t.id === "meadow" || t.id === "blossom" || t.id === "candy";
  if (grassy) {
    // Thousands of short blades, each a thin stroke leaning a little, in many greens. They're
    // drawn in a few batches (one path per shade), which is many times faster than one
    // stroke each.
    g.lineCap = "round";
    const shades = [tone(-0.14, 0.05), tone(-0.08, 0.05), tone(0.02, -0.01, -0.01), tone(0.07, -0.02, -0.015), tone(0.14, -0.1, -0.03)];
    shades.forEach((shade, si) => {
      for (const [alpha, width] of [[0.45, 1], [0.7, 1.4]]) {
        g.strokeStyle = shade; g.globalAlpha = alpha; g.lineWidth = width;
        g.beginPath();
        for (let i = 0; i < 2600; i++) {
          const j = i * 10 + si * 2 + (width > 1 ? 1 : 0);
          const x = hash(j, 7, 1) * N, y = hash(j, 7, 2) * N, len = 3 + hash(j, 7, 3) * 6, lean = (hash(j, 7, 4) - 0.5) * 3;
          g.moveTo(x, y); g.lineTo(x + lean, y - len);
        }
        g.stroke();
      }
    });
    g.globalAlpha = 1;
    // Tiny clover leaves and specks of soil.
    for (let i = 0; i < 900; i++) {
      g.fillStyle = i % 3 ? tone(-0.12, 0.08, 0.02, 0.5) : "rgba(90,60,30,0.18)";
      g.beginPath(); g.arc(hash(i, 9, 1) * N, hash(i, 9, 2) * N, 1 + hash(i, 9, 3) * 1.6, 0, Math.PI * 2); g.fill();
    }
  } else {
    // Snow, sand and ash: fine grains with a sparkle here and there.
    for (let i = 0; i < 30000; i++) {
      const k = hash(i, 11, 3);
      g.fillStyle = k < 0.5 ? tone(-0.06 - k * 0.08, 0, 0, 0.5) : k < 0.95 ? tone(0.05, -0.05, 0, 0.45) : "rgba(255,255,255,0.8)";
      g.fillRect(hash(i, 11, 1) * N, hash(i, 11, 2) * N, 1.5, 1.5);
    }
    // Wind ripples across sand and snow.
    g.strokeStyle = tone(-0.05, 0, 0, 0.25); g.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const y = hash(i, 13, 1) * N, x = hash(i, 13, 2) * N, w = 60 + hash(i, 13, 3) * 140;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 8, x + w, y); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.userData.own = true; // freed with the island
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Clapboard siding: soft horizontal boards with a shadow line under each. */
function sidingTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    const gr = g.createLinearGradient(0, y, 0, y + 8);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.8, "rgba(0,0,0,0.06)"); gr.addColorStop(1, "rgba(0,0,0,0.2)");
    g.fillStyle = gr; g.fillRect(0, y, 64, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.own = true;
  return tex;
}

/** A tiling ripple normal map, made once and shared by every pool. */
let rippleCache: THREE.Texture | null = null;
function waterNormals(): THREE.Texture {
  if (rippleCache) return rippleCache;
  const N = 256, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!, img = g.createImageData(N, N);
  // Height: a few sine waves with whole-number frequencies, so the tile repeats seamlessly.
  const waves = [[3, 1, 0.5], [-2, 4, 1.7], [5, -3, 2.9], [1, 6, 4.1], [7, 2, 5.3], [-6, 5, 0.9]];
  const h = (x: number, y: number) => waves.reduce((a, [fx, fy, ph], i) => a + Math.sin(((fx * x + fy * y) / N) * Math.PI * 2 + ph) / (1 + i * 0.6), 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const nx = -dx * 3, ny = -dy * 3, nz = 1, l = Math.hypot(nx, ny, nz), o = (y * N + x) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  rippleCache = tex;
  return tex;
}

/** A pool's floor: pale sand at the edge sinking to deep blue in the middle. */
function basinTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!, gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "#0f5f8f"); gr.addColorStop(0.6, "#2a8fbf"); gr.addColorStop(0.9, "#9fd6df"); gr.addColorStop(1, "#d9e8d0");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.own = true;
  return tex;
}

function roadTexture(color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#f1f3f5"; g.fillRect(0, 30, 32, 4);
  g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(0, 2, 64, 2); g.fillRect(0, 60, 64, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.userData.own = true; // freed with the island
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Roughens a geometry's vertices a little, for natural-looking rock. */
function jitter(geo: THREE.BufferGeometry, amount: number, seed: number): void {
  const p = geo.attributes.position as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    let d = seen.get(key);
    if (!d) { d = [(hash(i, seed, 1) - 0.5) * amount, (hash(i, seed, 2) - 0.5) * amount, (hash(i, seed, 3) - 0.5) * amount]; seen.set(key, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
}

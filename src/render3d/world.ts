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
  g.add(shadowed(new THREE.Mesh(new THREE.PlaneGeometry(I * 2, I * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lawnTexture(t), roughness: 0.95 })), false));
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
  const water = new THREE.MeshStandardMaterial({ color: col("#5ec8f2"), roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.92 });
  const pool = (x: number, z: number, r: number, rim: string) => {
    g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.45, 0.2, 28).translate(x, 0.1, z), std(rim)), false));
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2).translate(x, 0.27, z), water);
    w.receiveShadow = true;
    g.add(w);
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
  for (const [x, z, i] of HOUSES) {
    const h = new THREE.Group();
    h.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.2).translate(0, 0.8, 0), std(HOUSE_WALLS[i % 6])));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.2, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.9).translate(0, 2.2, 0), new THREE.MeshStandardMaterial({ color: col(HOUSE_ROOFS[i % 6]), roughness: 0.8, flatShading: true }));
    h.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.05).translate(0, 0.45, 1.12), std("#5a3e2b"));
    const win = std("#9fd3ff", { emissive: col("#ffd27a"), emissiveIntensity: 0 });
    win.userData.dynamic = true;
    h.add(door, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05).translate(0.8, 1, 1.12), win), new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05).translate(-0.8, 1, 1.12), win));
    anims.push((_t, night) => { win.emissiveIntensity = night * 1.4; });
    h.position.set(x, 0, z);
    g.add(shadowed(h));
  }
  const facade = facadeFor(NEIGHBOR_LOOK);
  const nbMat = (c: number[]) => [new THREE.MeshStandardMaterial({ color: col(c), map: facade.map, emissiveMap: facade.lit, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: facade.orm, metalnessMap: facade.orm, roughness: 1, metalness: 1 }), std(c.map(v => Math.min(255, v * 1.1)))];
  const neighbors = [...NEIGHBORS, ...(has(2) ? EXTRA_NEIGHBORS : [])];
  for (const nb of neighbors) {
    const mats = nbMat(nb.color);
    const m = new THREE.Mesh(prism(boxFoot(nb), 0, nb.h * FH, false, 1), mats);
    anims.push((_t, night) => { (mats[0] as THREE.MeshStandardMaterial).emissiveIntensity = night * 1.3; });
    g.add(shadowed(m));
    // Rooftop parapet
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(nb.x1 - nb.x0 - 0.6, 0.2, nb.z1 - nb.z0 - 0.6).translate((nb.x0 + nb.x1) / 2, nb.h * FH + 0.1, (nb.z0 + nb.z1) / 2), std("#c9ced6"))));
  }

  // ---- Trees: instanced, styled by the island theme ----
  const near = (tx: number, tz: number, x: number, z: number, r: number) => Math.hypot(tx - x, tz - z) < r;
  const trees = TREES.filter(tr =>
    !(has(0) && near(tr.x, tr.z, FOUNTAIN.x, FOUNTAIN.z, 2)) && !(has(1) && near(tr.x, tr.z, POND.x, POND.z, POND.r + 1))
    && !(has(4) && near(tr.x, tr.z, WHEEL.x, WHEEL.z, 3))
    && !o.city.some(id => { const s = BUILD_SPOTS[id]; return s && near(tr.x, tr.z, s.x, s.z, s.r + 0.6); })
    && !(has(2) && EXTRA_NEIGHBORS.some(b => tr.x > b.x0 - 1 && tr.x < b.x1 + 1 && tr.z > b.z0 - 1 && tr.z < b.z1 + 1)));
  g.add(treeInstances(trees, t));

  // ---- Floating rocks around the island ----
  for (const [i, k] of ROCKS.entries()) {
    const r = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(k.r * 1.3, k.r * 2.4, 5, 2).rotateX(Math.PI).translate(0, -k.r * 1.2, 0), new THREE.MeshStandardMaterial({ color: col(t.rockR), roughness: 1, flatShading: true }));
    jitter(cone.geometry as THREE.BufferGeometry, 0.25, i + 9);
    r.add(cone, new THREE.Mesh(new THREE.CylinderGeometry(k.r * 1.3, k.r * 1.3, 0.35, 5).translate(0, 0.17, 0), std(t.lawn)));
    if (k.tree) r.add(treeInstances([{ x: 0, z: 0, size: 1, hue: hash(i, 1, 1) }], t));
    r.position.set(k.x, k.y * FH, k.z);
    r.userData.dynamic = true;
    g.add(shadowed(r));
    anims.push(time => { r.position.y = k.y * FH + Math.sin(time * 0.5 + i * 1.7) * 0.45; });
  }

  // ---- Upgrades: street lights and cars, Ferris wheel, balloons ----
  if (has(3)) {
    const cars = CARS.map(c => {
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

  // ---- City buildings ----
  for (const id of o.city) {
    const s = BUILD_SPOTS[id];
    if (!s) continue;
    const b = cityBuilding(id, anims);
    b.position.set(s.x, 0, s.z);
    g.add(shadowed(b));
  }

  mergeStatic(g);
  return { group: g, anim: { update: (time, night) => anims.forEach(a => a(time, night)) } };
}

/** Merges every still mesh that shares a look into one, so the phone draws the island in
 *  a few dozen steps instead of hundreds. Moving things and lit windows stay separate. */
function mergeStatic(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }>();
  const remove: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    for (const c of o.children) visit(c);
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.userData.dynamic || mat.transparent) return;
    const key = [mat.color?.getHexString(), mat.roughness, mat.metalness, mat.flatShading, mat.map?.uuid, mat.emissive?.getHexString(), m.castShadow].join("|");
    let gr = groups.get(key);
    if (!gr) { gr = { mat, geos: [], cast: m.castShadow }; groups.set(key, gr); }
    let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    gr.geos.push(geo);
    remove.push(m);
  };
  visit(root);
  for (const m of remove) { m.removeFromParent(); m.geometry.dispose(); }
  for (const { mat, geos, cast } of groups.values()) {
    const merged = mergeGeometries(geos);
    geos.forEach(x => x.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
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
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = t.lawn; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"; g.fillRect(0, i * 256 / 11, 256, 256 / 11); }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(${i % 2 ? "255,255,255" : "0,40,0"},${0.04 + hash(i, 2, 3) * 0.05})`;
    g.fillRect(hash(i, 5, 1) * 256, hash(i, 1, 7) * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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

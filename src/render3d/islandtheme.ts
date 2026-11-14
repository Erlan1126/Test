// Each island style gets its own things scattered across it:
//   Green Meadow   sunflowers, toadstools and hay bales
//   Snowy Peaks    snowmen, snow drifts and ice crystals
//   Desert Oasis   saguaro and barrel cacti, sand dunes and clay pots
//   Cherry Blossom stone lanterns, a torii gate and fallen petals
//   Volcano Island glowing lava pools and cracks, obsidian spikes and smoking vents
//   Candy Island   lollipops, candy canes, gumdrops and donuts
import * as THREE from "three";
import { hash } from "../core/util";
import { ISLAND } from "../data/constants";
import type { IslandTheme } from "../data/islands";

type Spot = [number, number, number];

export interface ThemeKit {
  g: THREE.Group;
  t: IslandTheme;
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, cast?: boolean) => THREE.Mesh;
  /** n free spots (x, z, a random 0..1) at least r apart, where ok(x, z) holds. */
  pick: (n: number, seed: number, r: number, ok: (x: number, z: number) => boolean) => Spot[];
  /** One instanced mesh with geo at every spot, scaled by size(k), optionally tinted. */
  scatter: (geo: THREE.BufferGeometry, mat: THREE.Material, spots: Spot[], size: (k: number) => [number, number], tint?: (k: number, i: number) => string, cast?: boolean) => THREE.InstancedMesh;
  anims: ((time: number, night: number) => void)[];
}

const I = ISLAND;
const mat = (color: string | number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const any = () => true;
const rim = (d: number) => (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) > d;

/** Several geometries placed at each spot, merged into one per material (as instances). */
function prop(k: ThemeKit, spots: Spot[], parts: [THREE.BufferGeometry, THREE.Material][], size: (r: number) => [number, number] = () => [1, 1]): void {
  for (const [geo, m] of parts) k.scatter(geo, m, spots, size);
}

/** A small canvas texture the island frees when it's rebuilt. */
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.userData.own = true;
  return tex;
}

export function addThemeProps(k: ThemeKit): void {
  switch (k.t.id) {
    case "meadow": return meadow(k);
    case "snow": return snow(k);
    case "desert": return desert(k);
    case "blossom": return blossom(k);
    case "volcano": return volcano(k);
    case "candy": return candy(k);
  }
}

function meadow(k: ThemeKit): void {
  // Sunflowers in little groups.
  const groups = k.pick(6, 101, 1.1, rim(9));
  const flowers: Spot[] = [];
  for (const [x, z, r] of groups) for (let j = 0; j < 4; j++) flowers.push([x + Math.cos(j * 1.7 + r * 6) * 0.55, z + Math.sin(j * 1.7 + r * 6) * 0.55, hash(j, r * 99, 2)]);
  prop(k, flowers, [
    [new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5).translate(0, 0.65, 0), mat("#4c8a35")],
    [new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12).rotateX(1.2).translate(0, 1.35, 0.06), mat("#ffc61a", { roughness: 0.6 })],
    [new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10).rotateX(1.2).translate(0, 1.37, 0.1), mat("#6b3f1d")],
  ], r => [0.8 + r * 0.4, 0.8 + r * 0.5]);
  // Red toadstools.
  const shrooms = k.pick(12, 103, 0.35, any);
  prop(k, shrooms, [
    [new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6).translate(0, 0.15, 0), mat("#f4eee0")],
    [new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.28, 0), mat("#e8402f", { roughness: 0.5 })],
  ], r => [0.8 + r * 0.6, 0.8 + r * 0.6]);
  // Hay bales near the edge.
  const hay = k.pick(4, 107, 0.8, rim(14));
  k.scatter(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 14).rotateZ(Math.PI / 2).translate(0, 0.55, 0), mat("#e2b85a", { roughness: 1 }), hay, () => [1, 1]);
}

function snow(k: ThemeKit): void {
  const men = k.pick(5, 201, 0.8, any);
  prop(k, men, [
    [new THREE.SphereGeometry(0.6, 14, 10).translate(0, 0.55, 0), mat("#ffffff", { roughness: 0.9 })],
    [new THREE.SphereGeometry(0.42, 14, 10).translate(0, 1.32, 0), mat("#ffffff", { roughness: 0.9 })],
    [new THREE.SphereGeometry(0.3, 12, 8).translate(0, 1.9, 0), mat("#ffffff", { roughness: 0.9 })],
    [new THREE.ConeGeometry(0.06, 0.35, 6).rotateX(Math.PI / 2).translate(0, 1.9, 0.42), mat("#ff8a1f")],
    [new THREE.CylinderGeometry(0.22, 0.24, 0.32, 10).translate(0, 2.26, 0), mat("#2b2f3a", { roughness: 0.6 })],
    [new THREE.TorusGeometry(0.33, 0.07, 6, 14).rotateX(Math.PI / 2).translate(0, 1.66, 0), mat("#e63946")],
  ]);
  // Soft drifts of snow.
  k.scatter(new THREE.SphereGeometry(1, 12, 8).scale(1, 0.32, 0.8).translate(0, 0, 0), mat("#f7fbff", { roughness: 0.95 }), k.pick(14, 203, 0.9, any), r => [0.8 + r * 0.9, 0.8 + r * 0.6]);
  // Ice crystals poking out of the snow.
  const ice = k.pick(10, 207, 0.45, rim(8));
  k.scatter(new THREE.OctahedronGeometry(0.35, 0).scale(0.6, 1.6, 0.6).translate(0, 0.4, 0),
    new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.08, metalness: 0.3, emissive: 0x2a6f9a, emissiveIntensity: 0.25 }), ice, r => [0.8 + r * 0.8, 0.8 + r]);
}

function desert(k: ThemeKit): void {
  const cactus = mat("#4f9a4a", { roughness: 0.75 });
  // Saguaros: a trunk and two arms.
  const tall = k.pick(10, 301, 0.7, any);
  prop(k, tall, [
    [new THREE.CapsuleGeometry(0.22, 2, 4, 8).translate(0, 1.2, 0), cactus],
    [new THREE.CapsuleGeometry(0.15, 0.7, 4, 8).translate(0.42, 1.55, 0), cactus],
    [new THREE.CapsuleGeometry(0.14, 0.35, 4, 8).rotateZ(Math.PI / 2).translate(0.25, 1.15, 0), cactus],
    [new THREE.CapsuleGeometry(0.14, 0.6, 4, 8).translate(-0.4, 1.3, 0), cactus],
    [new THREE.CapsuleGeometry(0.13, 0.3, 4, 8).rotateZ(Math.PI / 2).translate(-0.24, 0.95, 0), cactus],
  ], r => [0.8 + r * 0.5, 0.8 + r * 0.6]);
  // Round barrel cacti with a pink flower.
  const barrels = k.pick(10, 303, 0.4, any);
  prop(k, barrels, [
    [new THREE.SphereGeometry(0.32, 10, 8).scale(1, 1.15, 1).translate(0, 0.3, 0), cactus],
    [new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0.66, 0), mat("#ff6fae")],
  ], r => [0.8 + r * 0.6, 0.8 + r * 0.6]);
  // Low dunes of sand.
  k.scatter(new THREE.SphereGeometry(1, 14, 8).scale(1.6, 0.35, 1).translate(0, 0, 0), mat(k.t.lip, { roughness: 1 }), k.pick(6, 307, 1.6, rim(10)), r => [1 + r * 0.6, 1 + r * 0.4]);
  // Clay pots.
  const pots = k.pick(6, 311, 0.4, rim(9));
  prop(k, pots, [
    [new THREE.SphereGeometry(0.32, 12, 8).scale(1, 1.2, 1).translate(0, 0.36, 0), mat("#c8693c", { roughness: 0.7 })],
    [new THREE.CylinderGeometry(0.15, 0.2, 0.18, 12).translate(0, 0.78, 0), mat("#c8693c", { roughness: 0.7 })],
  ]);
}

function blossom(k: ThemeKit): void {
  const stone = mat("#b9b3aa", { roughness: 0.9 });
  // Stone lanterns whose windows glow at night.
  const lanterns = k.pick(7, 401, 0.6, any);
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffb347, emissiveIntensity: 0.15 });
  prop(k, lanterns, [
    [new THREE.CylinderGeometry(0.3, 0.38, 0.2, 6).translate(0, 0.1, 0), stone],
    [new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6).translate(0, 0.6, 0), stone],
    [new THREE.BoxGeometry(0.42, 0.36, 0.42).translate(0, 1.18, 0), glow],
    [new THREE.ConeGeometry(0.46, 0.3, 6).translate(0, 1.5, 0), stone],
    [new THREE.SphereGeometry(0.07, 6, 4).translate(0, 1.7, 0), stone],
  ]);
  k.anims.push((_t, night) => { glow.emissiveIntensity = 0.15 + night * 2.2; });
  // A red torii gate.
  const [gate] = k.pick(1, 403, 1.6, rim(10));
  if (gate) {
    const red = mat("#d9382c", { roughness: 0.5 }), dark = mat("#2b2025");
    const [x, z] = gate, rot = Math.abs(x) > Math.abs(z) ? Math.PI / 2 : 0;
    const geo = (g: THREE.BufferGeometry) => g.rotateY(rot).translate(x, 0, z);
    for (const s of [-1, 1]) k.add(geo(new THREE.CylinderGeometry(0.13, 0.15, 2.6, 8).translate(s * 0.95, 1.3, 0)), red);
    k.add(geo(new THREE.BoxGeometry(2.7, 0.18, 0.3).translate(0, 2.6, 0)), dark);
    k.add(geo(new THREE.BoxGeometry(2.3, 0.14, 0.22).translate(0, 2.15, 0)), red);
  }
  // Fallen petals all over the grass.
  const petals: Spot[] = [];
  for (let i = 0; i < 220; i++) petals.push([(hash(i, 41, 1) * 2 - 1) * (I - 0.6), (hash(i, 41, 2) * 2 - 1) * (I - 0.6), hash(i, 41, 3)]);
  k.scatter(new THREE.CircleGeometry(0.09, 5).rotateX(-Math.PI / 2).translate(0, 0.03, 0), new THREE.MeshStandardMaterial({ color: 0xffb7d2, roughness: 0.8 }),
    petals, r => [0.7 + r * 0.8, 1], (r) => (r > 0.5 ? "#ffc8dd" : "#ff9ec4"), false);
}

function volcano(k: ThemeKit): void {
  // Pools of lava that pulse, with a dark rocky rim.
  // Unlit, so it glows the same orange by day and by night.
  const lava = new THREE.MeshBasicMaterial({ color: 0xff5a0a });
  const pools = k.pick(6, 501, 1.1, any);
  k.scatter(new THREE.CylinderGeometry(1, 1.15, 0.24, 14).translate(0, 0.05, 0), mat("#1d1616", { roughness: 1, flatShading: true }), pools, r => [0.8 + r * 0.5, 1]);
  k.scatter(new THREE.CircleGeometry(0.82, 14).rotateX(-Math.PI / 2).translate(0, 0.18, 0), lava, pools, r => [0.8 + r * 0.5, 1], undefined, false);
  // Glowing cracks zig-zagging across the ground.
  const cracks = k.pick(8, 503, 0.9, any);
  const crack = new THREE.BufferGeometry();
  const pts = [[-1.2, 0.1], [-0.6, -0.15], [-0.1, 0.12], [0.5, -0.1], [1.1, 0.14]];
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], w = 0.07;
    pos.push(ax, 0.04, az - w, bx, 0.04, bz - w, bx, 0.04, bz + w, ax, 0.04, az - w, bx, 0.04, bz + w, ax, 0.04, az + w);
  }
  crack.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  crack.computeVertexNormals();
  k.scatter(crack, new THREE.MeshBasicMaterial({ color: 0xff7a2a, side: THREE.DoubleSide }), cracks, r => [0.9 + r * 0.8, 1], undefined, false);
  // Shiny black obsidian spikes.
  k.scatter(new THREE.ConeGeometry(0.28, 1.1, 5).translate(0, 0.5, 0), mat("#141018", { roughness: 0.15, metalness: 0.6, flatShading: true }),
    k.pick(14, 507, 0.4, any), r => [0.7 + r * 0.8, 0.6 + r * 1.1]);
  // The volcano itself, a smoking peak just behind the island's far corner.
  const V = { x: -27, z: -27, y: -6, r: 8, h: 13 };
  const peak = new THREE.CylinderGeometry(V.r * 0.22, V.r, V.h, 9, 3, true).translate(V.x, V.y + V.h / 2, V.z);
  k.add(peak, mat("#33272a", { roughness: 1, flatShading: true }));
  k.add(new THREE.CircleGeometry(V.r * 0.22, 9).rotateX(-Math.PI / 2).translate(V.x, V.y + V.h - 0.3, V.z), lava, false);
  // Steaming vents: a little cone with smoke puffs rising out of it (the volcano smokes too).
  const vents = k.pick(3, 511, 0.9, rim(8));
  k.scatter(new THREE.ConeGeometry(0.7, 0.8, 7, 1, true).translate(0, 0.4, 0), mat("#2c2224", { roughness: 1, flatShading: true }), vents, () => [1, 1]);
  k.scatter(new THREE.CircleGeometry(0.28, 10).rotateX(-Math.PI / 2).translate(0, 0.62, 0), lava, vents, () => [1, 1], undefined, false);
  const smokers: [number, number, number, number][] = [...vents.map(([x, z, r]) => [x, z, r, 0.9] as [number, number, number, number]), [V.x, V.z, 0.3, V.y + V.h]];
  const P = 5, smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a8590, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }), smokers.length * P);
  smoke.userData.dynamic = true;
  smoke.frustumCulled = false;
  k.g.add(smoke);
  const m4 = new THREE.Matrix4();
  k.anims.push(time => {
    const pulse = 0.85 + Math.sin(time * 2) * 0.15;
    lava.color.setRGB(1, 0.36 * pulse + 0.05, 0.04);
    smokers.forEach(([x, z, r, y0], v) => {
      const big = y0 > 2 ? 4 : 1; // the volcano's plume is much bigger
      for (let i = 0; i < P; i++) {
        const u = (time * 0.35 + i / P + r) % 1, s = (0.5 + u * 1.4) * big;
        m4.makeScale(s, s, s).setPosition(x + Math.sin(u * 5 + v) * 0.3 * u * big, y0 + u * 4.5 * big, z + u * 0.6 * big);
        smoke.setMatrixAt(v * P + i, m4);
      }
    });
    smoke.instanceMatrix.needsUpdate = true;
  });
}

function candy(k: ThemeKit): void {
  const glossy = (c: string) => mat(c, { roughness: 0.25, metalness: 0.05 });
  // Lollipops: a white stick and a swirl.
  const swirl = canvasTex(128, 128, c => {
    // Three colored ribbons winding out from the middle, on white.
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, 128, 128);
    c.lineWidth = 9; c.lineCap = "round";
    ["#ff5d8f", "#ffd43b", "#63e6be"].forEach((color, i) => {
      c.strokeStyle = color; c.beginPath();
      for (let a = 0; a < 3.2 * Math.PI; a += 0.08) {
        const r = 4 + a * 6, ang = a + (i * Math.PI * 2) / 3;
        const x = 64 + Math.cos(ang) * r, y = 64 + Math.sin(ang) * r;
        if (a === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    });
  });
  const pops = k.pick(9, 601, 0.6, any);
  prop(k, pops, [
    [new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6).translate(0, 0.9, 0), mat("#fffaf0")],
    [new THREE.CylinderGeometry(0.6, 0.6, 0.16, 24).rotateX(Math.PI / 2).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.3 })],
  ], r => [1.3 + r * 0.6, 1.3 + r * 0.6]);
  // Candy canes: a striped stick with a hook.
  const stripes = canvasTex(64, 64, c => {
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#e63946";
    for (let i = -64; i < 128; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 11, 0); c.lineTo(i + 11 - 64, 64); c.lineTo(i - 64, 64); c.closePath(); c.fill(); }
  }, true);
  stripes.repeat.set(2, 4);
  const cane = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.3 });
  prop(k, k.pick(8, 603, 0.6, any), [
    [new THREE.CylinderGeometry(0.11, 0.11, 2, 10).translate(0, 1, 0), cane],
    [new THREE.TorusGeometry(0.32, 0.11, 8, 14, Math.PI).translate(0.32, 2, 0), cane],
  ], r => [1.2 + r * 0.5, 1.2 + r * 0.5]);
  // Gumdrops in bright colors.
  const gum = ["#ff5d8f", "#ffd43b", "#63e6be", "#74c0fc", "#b197fc", "#ff922b"];
  k.scatter(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1), glossy("#ffffff"),
    k.pick(18, 607, 0.4, any), r => [0.8 + r * 0.6, 0.8 + r * 0.6], (r) => gum[Math.floor(r * gum.length)]);
  // Donuts lying on the grass, frosted pink.
  const donuts = k.pick(4, 611, 0.8, rim(9));
  prop(k, donuts, [
    [new THREE.TorusGeometry(0.5, 0.24, 10, 18).rotateX(Math.PI / 2).translate(0, 0.24, 0), mat("#d99a5b", { roughness: 0.7 })],
    [new THREE.TorusGeometry(0.5, 0.2, 10, 18, Math.PI * 2).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.38, 0), glossy("#ff8fc1")],
  ]);
}

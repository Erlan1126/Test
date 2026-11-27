// The holiday parade in the town (logic/parade.ts): a marching band, four floats on wheeled
// platforms (a giant present, a snowman, gingerbread and Santa's sleigh with reindeer) and
// three balloon characters held on strings, driving along the town's streets (the route comes
// from bizcity.ts, the same street-and-crossing curves the traffic drives). Every figure and
// float is one merged, vertex-colored mesh, the bulbs on the floats twinkle like the Winter
// Lights strings (winter.ts), and a little confetti flutters down over the floats. The whole
// procession is one group, built when a parade starts and thrown away when it ends.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Bulbs } from "./winter";

/** One merged mesh's parts: geometry painted per part, then joined. */
class Kit {
  readonly parts: THREE.BufferGeometry[] = [];
  readonly glow: THREE.BufferGeometry[] = [];
  private readonly c = new THREE.Color();
  add(geo: THREE.BufferGeometry, color: string, glow = false): void {
    const g2 = geo.index ? geo.toNonIndexed() : geo;
    if (g2 !== geo) geo.dispose();
    if (g2.attributes.uv) g2.deleteAttribute("uv");
    const n = g2.attributes.position.count, arr = new Float32Array(n * 3), c = this.c.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g2.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    (glow ? this.glow : this.parts).push(g2);
  }
  /** A figure that turns on its own turntable (so it always shows the crowd its
   *  face): its parts, made round (0, 0), and where it stands. */
  private turn: { kit: Kit; x: number; z: number } | null = null;
  spin(parts: [THREE.BufferGeometry, string][], x: number, z: number): void {
    const kit = new Kit();
    for (const [geo, c] of parts) kit.add(geo, c);
    this.turn = { kit, x, z };
  }
  /** The merged meshes, added to `to`. Returns the turntable's group, if there is one. */
  build(to: THREE.Object3D, body: THREE.Material, glowM: THREE.Material): THREE.Object3D | null {
    let spinner: THREE.Object3D | null = null;
    if (this.turn) {
      spinner = new THREE.Group();
      spinner.position.set(this.turn.x, 0, this.turn.z);
      this.turn.kit.build(spinner, body, glowM);
      to.add(spinner);
    }
    for (const [list, m] of [[this.parts, body], [this.glow, glowM]] as [THREE.BufferGeometry[], THREE.Material][]) {
      if (!list.length) continue;
      const geo = mergeGeometries(list);
      list.forEach(q => q.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.dynamic = true;
      to.add(mesh);
    }
    return spinner;
  }
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const ball = (r: number, x: number, y: number, z: number, seg = 10) => new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.7))).translate(x, y, z);
const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);

const GOLD = "#ffcf3a", SNOW = "#f4f7ff", WHITE = "#ffffff", COAL = "#26232e", SKIN = "#f1c9a0", RED = "#e2323f";
/** The floats are drawn a little bigger than the town's cars (they're the show). */
const FLOAT_SCALE = 1.3;
/** The deck's top (where things stand on a float). */
const DECK = 0.29;

/** A float's wheeled platform `len` long: a skirt, a gold trim, a snowy deck, four wheels,
 *  and a string of bulbs right round the deck's edge. */
function platform(k: Kit, b: Bulbs, len: number, skirt: string, trim = GOLD, top = SNOW): void {
  k.add(box(0.62, 0.15, len - 0.06, 0, 0.13, 0), skirt);
  k.add(box(0.68, 0.04, len + 0.02, 0, 0.215, 0), trim);
  k.add(box(0.66, 0.06, len, 0, 0.26, 0), top);
  // (Scallops of the trim's colour hanging down the skirt, like bunting.)
  for (const s of [-1, 1]) for (let z = -len / 2 + 0.1; z < len / 2 - 0.05; z += 0.16) k.add(new THREE.ConeGeometry(0.045, 0.07, 4).rotateX(Math.PI).translate(s * 0.315, 0.165, z), trim);
  // Four wheels, turned to roll along z, with gold hubs.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.add(new THREE.CylinderGeometry(0.078, 0.078, 0.05, 12).rotateZ(Math.PI / 2).translate(sx * 0.3, 0.08, sz * (len / 2 - 0.16)), COAL);
    k.add(new THREE.CylinderGeometry(0.035, 0.035, 0.055, 8).rotateZ(Math.PI / 2).translate(sx * 0.3, 0.08, sz * (len / 2 - 0.16)), GOLD);
  }
  // Bulbs round the edge.
  let n = 0;
  const y = DECK + 0.005;
  for (let z = -len / 2 + 0.06; z <= len / 2 - 0.05; z += 0.11) { b.add(new THREE.Vector3(0.34, y, z), n++); b.add(new THREE.Vector3(-0.34, y, z), n++); }
  for (let x = -0.26; x <= 0.27; x += 0.11) { b.add(new THREE.Vector3(x, y, len / 2 + 0.01), n++); b.add(new THREE.Vector3(x, y, -len / 2 - 0.01), n++); }
}

/** A string of bulbs from a to b, sagging a little. */
function bulbString(b: Bulbs, a: THREE.Vector3, c: THREE.Vector3, n: number, sag: number, k0 = 0): void {
  for (let i = 0; i <= n; i++) { const f = i / n; b.add(new THREE.Vector3(a.x + (c.x - a.x) * f, a.y + (c.y - a.y) * f - Math.sin(Math.PI * f) * sag, a.z + (c.z - a.z) * f), k0 + i); }
}

/** A little pine tree with a gold star on top. */
function pine(k: Kit, x: number, y: number, z: number, h: number): void {
  k.add(cyl(h * 0.06, h * 0.07, h * 0.18, x, y + h * 0.09, z, 6), "#6b4528");
  k.add(new THREE.ConeGeometry(h * 0.3, h * 0.5, 8).translate(x, y + h * 0.4, z), "#1f7a44");
  k.add(new THREE.ConeGeometry(h * 0.22, h * 0.4, 8).translate(x, y + h * 0.68, z), "#24894c");
  k.add(new THREE.OctahedronGeometry(h * 0.08, 0).translate(x, y + h * 0.92, z), GOLD, true);
}

/** A candy cane standing up, `h` tall, its hook toward `dir` (+1: +x). */
function candyCane(k: Kit, x: number, y: number, z: number, h: number, dir = 1, r = 0.03): void {
  const n = 6;
  for (let i = 0; i < n; i++) k.add(cyl(r, r, h / n, x, y + (i + 0.5) * (h / n), z, 8), i % 2 ? WHITE : RED);
  k.add(new THREE.TorusGeometry(h * 0.16, r, 6, 10, Math.PI).rotateY(dir > 0 ? 0 : Math.PI).translate(x + dir * h * 0.16, y + h, z), RED);
}

// ---- The floats (local space: +z is the way they drive, the deck's top at DECK) ----

function presentFloat(k: Kit, b: Bulbs): number {
  const L = 1.0;
  platform(k, b, L, "#2f9a55");
  const y = DECK, s = 0.5, cy = y + s / 2;
  // The giant present: red with a gold ribbon both ways and a big bow on top.
  k.add(box(s, s, s, 0, cy, -0.05), "#e8344a");
  k.add(box(s + 0.02, s + 0.02, 0.09, 0, cy, -0.05), GOLD);
  k.add(box(0.09, s + 0.02, s + 0.02, 0, cy, -0.05), GOLD);
  // A tag hanging off the ribbon.
  k.add(box(0.1, 0.07, 0.01, 0.12, cy + 0.08, s / 2 - 0.04), WHITE);
  const top = y + s + 0.01;
  for (const sx of [-1, 1]) {
    k.add(new THREE.TorusGeometry(0.1, 0.035, 8, 16).scale(1, 0.75, 1).rotateY(Math.PI / 2 + sx * 0.5).rotateZ(sx * -0.5).translate(sx * 0.1, top + 0.07, -0.05), GOLD);
    k.add(new THREE.BoxGeometry(0.05, 0.16, 0.015).rotateZ(sx * 0.35).translate(sx * 0.06, top - 0.04, s / 2 - 0.05 + 0.0), GOLD);
  }
  k.add(ball(0.05, 0, top + 0.03, -0.05), "#ffb700");
  // Two little presents at the front corners.
  ([[0.18, 0.36, 0.17, "#4f8bff", WHITE], [-0.19, 0.38, 0.13, "#ffd23a", RED]] as [number, number, number, string, string][]).forEach(([x, z, w, c, r]) => {
    k.add(box(w, w, w, x, y + w / 2, z), c);
    k.add(box(w + 0.01, w + 0.01, 0.03, x, y + w / 2, z), r);
    k.add(box(0.03, w + 0.01, w + 0.01, x, y + w / 2, z), r);
    k.add(ball(0.03, x, y + w + 0.02, z, 6), r);
  });
  // Bulbs in an arch over the present.
  for (const z of [-0.42]) bulbString(b, new THREE.Vector3(-0.3, y, z), new THREE.Vector3(0.3, y, z), 10, -0.75);
  return L;
}

function snowmanFloat(k: Kit, b: Bulbs): number {
  const L = 1.0;
  platform(k, b, L, "#3b7be0", WHITE);
  const y = DECK;
  // A big snowman, facing out to the crowd.
  const g: [THREE.BufferGeometry, string][] = [];
  g.push([ball(0.2, 0, y + 0.18, 0, 14), SNOW], [ball(0.15, 0, y + 0.47, 0, 14), SNOW], [ball(0.11, 0, y + 0.68, 0, 14), SNOW]);
  g.push([ball(0.017, -0.04, y + 0.71, 0.095, 6), COAL], [ball(0.017, 0.04, y + 0.71, 0.095, 6), COAL]);
  for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; g.push([ball(0.011, Math.sin(a) * 0.06, y + 0.645 - Math.cos(a) * 0.012 - (2 - Math.abs(i - 2)) * 0.008, 0.1, 5), COAL]); }
  g.push([new THREE.ConeGeometry(0.025, 0.13, 8).rotateX(Math.PI / 2).translate(0, y + 0.68, 0.16), "#ff8a2a"]);
  g.push([ball(0.02, 0, y + 0.5, 0.148, 6), COAL], [ball(0.02, 0, y + 0.41, 0.143, 6), COAL], [ball(0.022, 0, y + 0.3, 0.19, 6), COAL]);
  g.push([new THREE.TorusGeometry(0.11, 0.032, 6, 16).rotateX(Math.PI / 2).translate(0, y + 0.585, 0), RED], [box(0.06, 0.16, 0.025, 0.06, y + 0.5, 0.11).rotateZ(0), RED]);
  g.push([cyl(0.13, 0.13, 0.02, 0, y + 0.77, 0, 14), COAL], [cyl(0.085, 0.085, 0.14, 0, y + 0.85, 0, 14), COAL], [cyl(0.087, 0.087, 0.03, 0, y + 0.8, 0, 14), RED]);
  // Stick arms, one waving.
  g.push([cyl(0.012, 0.012, 0.26, 0, 0, 0, 5).rotateZ(1.0).translate(-0.24, y + 0.53, 0), "#6b4528"]);
  g.push([cyl(0.012, 0.012, 0.26, 0, 0, 0, 5).rotateZ(-0.5).translate(0.22, y + 0.6, 0), "#6b4528"]);
  g.push([cyl(0.25, 0.25, 0.025, 0, y + 0.0125, 0, 18), "#cfe4ff"]);
  k.spin(g, 0, 0.05);
  // Little pines at the back, strung with lights, and snowballs round his feet.
  pine(k, -0.2, y, -0.36, 0.5);
  pine(k, 0.2, y, -0.36, 0.42);
  for (let i = 0; i < 4; i++) k.add(ball(0.05, -0.24 + i * 0.16, y + 0.03, 0.38 - (i % 2) * 0.05, 8), WHITE);
  bulbString(b, new THREE.Vector3(-0.32, y + 0.42, -0.36), new THREE.Vector3(0.32, y + 0.38, -0.36), 9, 0.08, 1);
  return L;
}

function gingerFloat(k: Kit, b: Bulbs): number {
  const L = 1.05;
  platform(k, b, L, "#ff8fb8", WHITE);
  const y = DECK, G = "#b8662c", I = WHITE;
  // A gingerbread man, waving.
  const g: [THREE.BufferGeometry, string][] = [];
  const f = 0.7; // (how deep he is: a thick cookie)
  g.push([ball(0.14, 0, y + 0.66, 0, 14).scale(1, 1, f), G]);
  g.push([new THREE.CapsuleGeometry(0.12, 0.14, 4, 12).scale(1, 1, f).translate(0, y + 0.4, 0), G]);
  g.push([new THREE.CapsuleGeometry(0.055, 0.17, 3, 8).scale(1, 1, f).rotateZ(-0.25).translate(-0.07, y + 0.15, 0), G]);
  g.push([new THREE.CapsuleGeometry(0.055, 0.17, 3, 8).scale(1, 1, f).rotateZ(0.25).translate(0.07, y + 0.15, 0), G]);
  g.push([new THREE.CapsuleGeometry(0.05, 0.16, 3, 8).scale(1, 1, f).rotateZ(1.25).translate(-0.2, y + 0.47, 0), G]);
  g.push([new THREE.CapsuleGeometry(0.05, 0.16, 3, 8).scale(1, 1, f).rotateZ(-2.3).translate(0.19, y + 0.58, 0), G]);
  // Icing: eyes, a smile, squiggles at wrists and ankles, and three gumdrop buttons.
  const fz = 0.14 * f;
  g.push([ball(0.022, -0.045, y + 0.69, fz, 6), I], [ball(0.022, 0.045, y + 0.69, fz, 6), I]);
  g.push([new THREE.TorusGeometry(0.05, 0.011, 5, 12, Math.PI).rotateZ(Math.PI).translate(0, y + 0.64, fz - 0.01), I]);
  (["#ff4d6a", "#5ee07a", "#ffd23a"] as string[]).forEach((c, i) => g.push([ball(0.026, 0, y + 0.47 - i * 0.075, 0.12 * f + 0.005, 8), c]));
  for (const [x, yy, rz] of [[-0.29, y + 0.5, 1.25], [0.25, y + 0.68, -2.3], [-0.1, y + 0.07, -0.25], [0.1, y + 0.07, 0.25]] as [number, number, number][]) {
    g.push([new THREE.TorusGeometry(0.045, 0.01, 4, 10).rotateX(Math.PI / 2).rotateZ(rz).scale(1, 1, f).translate(x, yy, 0), I]);
  }
  // (On a turntable, a white iced disc under his feet.)
  g.push([cyl(0.2, 0.2, 0.025, 0, y + 0.0125, 0, 18), I]);
  k.spin(g, 0.02, 0.12);
  // A little gingerbread house behind him, snow on the roof and a warm window.
  const hz = -0.3;
  k.add(box(0.36, 0.26, 0.3, -0.08, y + 0.13, hz), G);
  const roof = new THREE.Shape([new THREE.Vector2(-0.22, 0), new THREE.Vector2(0.22, 0), new THREE.Vector2(0, 0.17)]);
  k.add(new THREE.ExtrudeGeometry(roof, { depth: 0.36, bevelEnabled: false }).translate(-0.08, y + 0.26, hz - 0.18), I);
  k.add(box(0.12, 0.1, 0.01, -0.08, y + 0.15, hz + 0.155), "#ffd77a", true);
  k.add(box(0.36, 0.03, 0.01, -0.08, y + 0.25, hz + 0.155), I);
  for (let i = 0; i < 3; i++) k.add(new THREE.SphereGeometry(0.03, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(-0.08, y + 0.42, hz - 0.12 + i * 0.12), ["#ff4d6a", "#5ee07a", "#4fb4ff"][i]);
  // Candy canes at the four corners, lights strung between the back two.
  candyCane(k, 0.28, y, 0.46, 0.4, -1);
  candyCane(k, -0.28, y, 0.46, 0.4, 1);
  candyCane(k, 0.28, y, -0.46, 0.5, -1);
  candyCane(k, -0.28, y, -0.46, 0.5, 1);
  bulbString(b, new THREE.Vector3(-0.28, y + 0.5, -0.46), new THREE.Vector3(0.28, y + 0.5, -0.46), 8, 0.08, 1);
  bulbString(b, new THREE.Vector3(-0.28, y + 0.4, 0.46), new THREE.Vector3(0.28, y + 0.4, 0.46), 8, 0.08, 0);
  return L;
}

function sleighFloat(k: Kit, b: Bulbs): number {
  const L = 1.6;
  platform(k, b, L, "#b3202c");
  const y = DECK, BR = "#8a5a36", AN = "#e2c48a";
  // Two reindeer in front, the first with a glowing red nose.
  for (const [x, z, lead] of [[0.12, 0.5, true], [-0.12, 0.5, false]] as [number, number, boolean][]) {
    const zz = z + (lead ? 0.06 : -0.06);
    k.add(new THREE.CapsuleGeometry(0.075, 0.2, 4, 10).rotateX(Math.PI / 2).translate(x, y + 0.27, zz), BR);
    for (const lx of [-0.04, 0.04]) for (const lz of [-0.1, 0.1]) k.add(cyl(0.018, 0.015, 0.22, x + lx, y + 0.11, zz + lz, 6), BR);
    k.add(cyl(0.035, 0.045, 0.16, 0, 0, 0, 8).rotateX(0.6).translate(x, y + 0.38, zz + 0.15), BR);
    k.add(ball(0.065, x, y + 0.46, zz + 0.2, 10), BR);
    k.add(new THREE.CapsuleGeometry(0.035, 0.05, 3, 8).rotateX(Math.PI / 2).translate(x, y + 0.44, zz + 0.27), "#a8774f");
    k.add(ball(0.026, x, y + 0.445, zz + 0.32, 8), lead ? "#ff2a3a" : COAL, lead);
    k.add(ball(0.012, x - 0.03, y + 0.49, zz + 0.25, 5), COAL);
    k.add(ball(0.012, x + 0.03, y + 0.49, zz + 0.25, 5), COAL);
    k.add(ball(0.04, x, y + 0.29, zz - 0.15, 6), WHITE);
    // Antlers.
    for (const s of [-1, 1]) {
      k.add(cyl(0.01, 0.012, 0.14, 0, 0, 0, 5).rotateZ(s * -0.5).translate(x + s * 0.04, y + 0.56, zz + 0.19), AN);
      k.add(cyl(0.008, 0.01, 0.07, 0, 0, 0, 5).rotateZ(s * 0.4).rotateX(0.5).translate(x + s * 0.065, y + 0.6, zz + 0.21), AN);
      k.add(cyl(0.008, 0.01, 0.06, 0, 0, 0, 5).rotateZ(s * -1.1).translate(x + s * 0.09, y + 0.58, zz + 0.19), AN);
    }
    // A red collar with a gold bell.
    k.add(new THREE.TorusGeometry(0.045, 0.012, 5, 12).rotateX(Math.PI / 2 - 0.6).translate(x, y + 0.36, zz + 0.12), RED);
    k.add(ball(0.018, x, y + 0.33, zz + 0.16, 6), GOLD);
  }
  // The harness: gold straps back to the sleigh.
  for (const x of [-0.12, 0.12]) k.add(box(0.012, 0.012, 0.5, x, y + 0.27, 0.12), GOLD);
  k.add(box(0.3, 0.015, 0.015, 0, y + 0.27, -0.12), GOLD);
  // The sleigh: a red body with a curled front, gold trim and runners.
  const sz = -0.38;
  k.add(box(0.44, 0.2, 0.56, 0, y + 0.16, sz), "#d8283c");
  k.add(box(0.44, 0.22, 0.08, 0, y + 0.36, sz - 0.25), "#d8283c");
  k.add(new THREE.TorusGeometry(0.1, 0.05, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(0, y + 0.18, sz + 0.28), "#d8283c");
  k.add(box(0.46, 0.03, 0.58, 0, y + 0.27, sz), GOLD);
  k.add(box(0.46, 0.03, 0.1, 0, y + 0.47, sz - 0.25), GOLD);
  for (const x of [-0.2, 0.2]) {
    k.add(box(0.03, 0.025, 0.66, x, y + 0.025, sz), GOLD);
    k.add(new THREE.TorusGeometry(0.06, 0.014, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(x, y + 0.085, sz + 0.33), GOLD);
    k.add(cyl(0.01, 0.01, 0.06, x, y + 0.05, sz - 0.15, 5), GOLD);
  }
  // Lanterns on the front corners.
  for (const x of [-0.23, 0.23]) { k.add(cyl(0.008, 0.008, 0.12, x, y + 0.32, sz + 0.27, 5), GOLD); k.add(ball(0.03, x, y + 0.4, sz + 0.27, 8), "#ffd77a", true); }
  // Santa: red suit, white trim, a big white beard and a red hat with a bobble.
  const sy = y + 0.26;
  k.add(new THREE.CapsuleGeometry(0.1, 0.1, 4, 10).translate(0, sy + 0.12, sz - 0.08), "#d8283c");
  k.add(cyl(0.105, 0.105, 0.03, 0, sy + 0.06, sz - 0.08, 12), WHITE);
  k.add(cyl(0.106, 0.106, 0.025, 0, sy + 0.12, sz - 0.08, 12), COAL);
  k.add(box(0.03, 0.03, 0.01, 0, sy + 0.12, sz + 0.03), GOLD);
  k.add(ball(0.075, 0, sy + 0.31, sz - 0.08, 12), SKIN);
  k.add(ball(0.07, 0, sy + 0.26, sz - 0.04, 10).scale(1, 1.1, 0.8).translate(0, -0.02 * 1.1 + 0.03, 0), WHITE);
  k.add(ball(0.015, 0, sy + 0.31, sz - 0.005, 6), "#f29a8a");
  k.add(cyl(0.08, 0.08, 0.03, 0, sy + 0.36, sz - 0.08, 12), WHITE);
  k.add(new THREE.ConeGeometry(0.075, 0.16, 10).rotateX(-0.35).translate(0, sy + 0.44, sz - 0.11), "#d8283c");
  k.add(ball(0.028, 0, sy + 0.51, sz - 0.15, 6), WHITE);
  // (An arm waving.)
  k.add(new THREE.CapsuleGeometry(0.03, 0.12, 3, 6).rotateZ(-2.4).translate(0.13, sy + 0.28, sz - 0.06), "#d8283c");
  k.add(ball(0.035, 0.18, sy + 0.36, sz - 0.06, 6), WHITE);
  // The sack of toys behind him.
  k.add(ball(0.13, 0.08, y + 0.4, sz - 0.24, 10).scale(1, 1.15, 1).translate(0, -0.06, 0), "#9a6a3a");
  k.add(box(0.06, 0.06, 0.06, 0.02, y + 0.53, sz - 0.25), "#4f8bff");
  k.add(box(0.05, 0.07, 0.05, 0.12, y + 0.53, sz - 0.22), "#5ee07a");
  return L;
}

// ---- The band and the balloons' handlers: toy figures like the town's people ----

/** A bandsman: red jacket, white trousers, a tall shako with a plume, and an instrument. */
function bandsman(k: Kit, kind: "major" | "drum" | "horn" | "tuba", x: number, z: number): void {
  const jacket = kind === "major" ? WHITE : "#d8283c", hat = kind === "major" ? "#d8283c" : COAL;
  k.add(new THREE.CapsuleGeometry(0.04, 0.12, 2, 6).translate(x - 0.05, 0.1, z), kind === "major" ? COAL : WHITE);
  k.add(new THREE.CapsuleGeometry(0.04, 0.12, 2, 6).translate(x + 0.05, 0.1, z), kind === "major" ? COAL : WHITE);
  k.add(new THREE.CapsuleGeometry(0.095, 0.13, 3, 8).translate(x, 0.3, z), jacket);
  // Gold buttons and a white cross-belt.
  for (let i = 0; i < 3; i++) k.add(ball(0.012, x, 0.36 - i * 0.05, z + 0.093, 5), GOLD);
  k.add(box(0.03, 0.24, 0.02, 0, 0, 0).rotateZ(0.6).translate(x, 0.32, z + 0.08), kind === "major" ? GOLD : WHITE);
  k.add(box(0.21, 0.04, 0.03, x, 0.42, z), GOLD);
  k.add(ball(0.085, x, 0.53, z, 9), SKIN);
  k.add(cyl(0.075, 0.07, 0.16, x, 0.66, z, 10), hat);
  k.add(cyl(0.077, 0.077, 0.02, x, 0.6, z, 10), GOLD);
  k.add(ball(0.02, x, 0.66, z + 0.075, 6), GOLD);
  k.add(new THREE.ConeGeometry(0.03, 0.12, 6).translate(x, 0.8, z), kind === "major" ? GOLD : WHITE);
  if (kind === "drum") {
    k.add(cyl(0.12, 0.12, 0.13, x, 0.27, z + 0.17, 14), WHITE);
    k.add(cyl(0.125, 0.125, 0.025, x, 0.345, z + 0.17, 14), "#d8283c");
    k.add(cyl(0.125, 0.125, 0.025, x, 0.2, z + 0.17, 14), "#d8283c");
    k.add(cyl(0.006, 0.006, 0.16, 0, 0, 0, 4).rotateZ(0.9).translate(x - 0.05, 0.4, z + 0.14), "#8a5a36");
    k.add(cyl(0.006, 0.006, 0.16, 0, 0, 0, 4).rotateZ(-0.9).translate(x + 0.05, 0.4, z + 0.14), "#8a5a36");
  } else if (kind === "horn") {
    k.add(cyl(0.016, 0.016, 0.2, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(x, 0.47, z + 0.17), GOLD);
    k.add(new THREE.ConeGeometry(0.05, 0.09, 12, 1, true).rotateX(-Math.PI / 2).translate(x, 0.47, z + 0.3), GOLD);
    k.add(box(0.04, 0.04, 0.06, x, 0.45, z + 0.14), GOLD);
    k.add(new THREE.CapsuleGeometry(0.025, 0.1, 2, 5).rotateX(Math.PI / 2 - 0.3).translate(x + 0.08, 0.4, z + 0.08), "#d8283c");
  } else if (kind === "tuba") {
    k.add(new THREE.TorusGeometry(0.12, 0.028, 8, 18).rotateY(Math.PI / 2).translate(x, 0.33, z + 0.05), GOLD);
    k.add(new THREE.ConeGeometry(0.1, 0.12, 14, 1, true).rotateZ(0).translate(x + 0.02, 0.5, z - 0.02), GOLD);
  } else {
    // The drum major's baton, up high.
    k.add(new THREE.CapsuleGeometry(0.025, 0.12, 2, 5).rotateZ(-2.6).translate(x + 0.12, 0.44, z), WHITE);
    k.add(cyl(0.008, 0.008, 0.34, x + 0.16, 0.65, z, 5), GOLD);
    k.add(ball(0.025, x + 0.16, 0.83, z, 6), WHITE);
  }
}

/** A balloon handler in a green coat and a bobble hat, an arm up holding the string. */
function handler(k: Kit, x: number, z: number, coat: string): void {
  k.add(new THREE.CapsuleGeometry(0.04, 0.12, 2, 6).translate(x - 0.05, 0.1, z), "#3a4256");
  k.add(new THREE.CapsuleGeometry(0.04, 0.12, 2, 6).translate(x + 0.05, 0.1, z), "#3a4256");
  k.add(new THREE.CapsuleGeometry(0.095, 0.13, 3, 8).translate(x, 0.3, z), coat);
  k.add(new THREE.CapsuleGeometry(0.03, 0.15, 2, 5).rotateZ(Math.sign(x) * -0.5 + Math.PI).translate(x + Math.sign(x) * 0.06, 0.46, z), coat);
  k.add(ball(0.085, x, 0.53, z, 9), SKIN);
  k.add(new THREE.SphereGeometry(0.09, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(x, 0.55, z), RED);
  k.add(ball(0.03, x, 0.64, z, 6), WHITE);
}

/** The balloon characters (local: the balloon's middle at the origin, about 0.7 across). */
function penguinBalloon(k: Kit): void {
  k.add(ball(0.3, 0, 0, 0, 16).scale(1, 1.25, 0.95), "#2a2f3d");
  k.add(ball(0.24, 0, -0.04, 0.09, 14).scale(1, 1.2, 0.9), WHITE);
  for (const s of [-1, 1]) {
    k.add(ball(0.05, s * 0.1, 0.2, 0.25, 8), WHITE);
    k.add(ball(0.026, s * 0.1, 0.2, 0.29, 6), COAL);
    k.add(ball(0.1, s * 0.3, -0.04, 0, 8).scale(0.45, 1.3, 0.8).applyMatrix4(new THREE.Matrix4().makeRotationZ(s * -0.5)), "#2a2f3d");
    k.add(ball(0.08, s * 0.1, -0.38, 0.12, 8).scale(1, 0.4, 1.4), "#ff9a2a");
  }
  k.add(new THREE.ConeGeometry(0.05, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0.12, 0.33), "#ff9a2a");
  k.add(new THREE.TorusGeometry(0.21, 0.05, 6, 16).rotateX(Math.PI / 2).translate(0, 0.02, 0), RED);
  k.add(box(0.08, 0.2, 0.04, 0.12, -0.06, 0.2), RED);
  // A Santa hat.
  k.add(cyl(0.2, 0.2, 0.06, 0, 0.36, 0, 14), WHITE);
  k.add(new THREE.ConeGeometry(0.18, 0.3, 12).rotateZ(-0.35).translate(-0.05, 0.52, 0), RED);
  k.add(ball(0.05, -0.15, 0.64, 0, 8), WHITE);
}

function starBalloon(k: Kit): void {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.17 : 0.4; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  k.add(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }).translate(0, 0, -0.07), "#ffd23a");
  for (const s of [-1, 1]) { k.add(ball(0.04, s * 0.08, 0.04, 0.13, 8), WHITE); k.add(ball(0.022, s * 0.08, 0.04, 0.16, 6), COAL); k.add(ball(0.035, s * 0.15, -0.04, 0.12, 6).scale(1, 0.6, 0.5), "#ff8a8a"); }
  k.add(new THREE.TorusGeometry(0.06, 0.012, 5, 12, Math.PI).rotateZ(Math.PI).translate(0, -0.04, 0.135), COAL);
}

function bearBalloon(k: Kit): void {
  const B = "#b07a4a", M = "#e8c79a";
  k.add(ball(0.26, 0, -0.18, 0, 14).scale(1, 1.1, 0.95), B);
  k.add(ball(0.16, 0, -0.2, 0.17, 10).scale(1, 1.2, 0.5), M);
  k.add(ball(0.22, 0, 0.22, 0.02, 14), B);
  for (const s of [-1, 1]) {
    k.add(ball(0.08, s * 0.17, 0.4, 0, 8), B);
    k.add(ball(0.045, s * 0.17, 0.4, 0.05, 6), M);
    k.add(ball(0.028, s * 0.075, 0.27, 0.2, 6), COAL);
    k.add(new THREE.CapsuleGeometry(0.07, 0.14, 3, 8).rotateZ(s * (0.9 + (s > 0 ? 0.7 : 0))).translate(s * 0.27, -0.06 + (s > 0 ? 0.08 : 0), 0.04), B);
    k.add(ball(0.09, s * 0.13, -0.42, 0.1, 8).scale(1, 0.8, 1.2), B);
  }
  k.add(ball(0.09, 0, 0.16, 0.18, 10).scale(1, 0.8, 0.7), M);
  k.add(ball(0.035, 0, 0.19, 0.25, 6), COAL);
  // A red bow tie and a green scarf end.
  k.add(new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(Math.PI / 2).translate(-0.05, 0.0, 0.2), RED);
  k.add(new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(-Math.PI / 2).translate(0.05, 0.0, 0.2), RED);
  k.add(ball(0.03, 0, 0.0, 0.22, 6), "#a3121f");
}

/** One part of the procession, `back` behind the lead along the route. */
interface Unit { o: THREE.Group; back: number; half: number; kind: "band" | "float" | "balloon"; ph: number; sway?: THREE.Object3D; face?: THREE.Object3D; spin?: THREE.Object3D | null; float: number }

export interface Parade {
  readonly group: THREE.Group;
  /** Moves everything along; false once the last of it has gone by. `t` in seconds. */
  update(t: number, dt: number, night: number, hold?: number): boolean;
  /** Float k's middle (town space) while it's out on the street, else false. */
  floatAt(k: number, out: THREE.Vector3): boolean;
  /** The lead float's middle (the camera follows it), else false. */
  lead(out: THREE.Vector3): boolean;
  dispose(): void;
}

/** The procession, following `route` (points along the streets, town space). */
export function buildParade(route: THREE.Vector3[]): Parade {
  const group = new THREE.Group();
  group.userData.dynamic = true;
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const glowM = new THREE.MeshBasicMaterial({ vertexColors: true });
  const bulbs: Bulbs[] = [];
  const units: Unit[] = [];
  const unit = (kind: Unit["kind"], back: number, half: number, float = -1) => {
    const o = new THREE.Group();
    o.visible = false;
    group.add(o);
    const u: Unit = { o, back, half, kind, ph: units.length * 1.7, float };
    units.push(u);
    return u;
  };

  // The marching band: the drum major, then two rows of two, then a tuba.
  {
    const rows: [number, ["major" | "drum" | "horn" | "tuba", number][]][] = [
      [0, [["major", 0]]],
      [0.55, [["horn", -0.17], ["horn", 0.17]]],
      [1.0, [["drum", -0.17], ["drum", 0.17]]],
      [1.45, [["tuba", 0]]],
    ];
    for (const [back, list] of rows) {
      const u = unit("band", back, 0.15), k = new Kit();
      for (const [kind, x] of list) bandsman(k, kind, x, 0);
      k.build(u.o, body, glowM);
      u.o.scale.setScalar(1.15);
    }
  }
  // The floats.
  const makers = [presentFloat, snowmanFloat, gingerFloat, sleighFloat];
  const at = [2.7, 4.45, 6.25, 8.35];
  makers.forEach((mk, i) => {
    const k = new Kit(), b = new Bulbs();
    const u = unit("float", at[i], 0.5, i);
    const len = mk(k, b);
    u.half = (len / 2) * FLOAT_SCALE;
    u.spin = k.build(u.o, body, glowM);
    b.build(u.o, 0.024);
    bulbs.push(b);
  });
  // The balloons, each held by two handlers on strings.
  const balloons = [penguinBalloon, starBalloon, bearBalloon], coats = ["#2f9a55", "#4f8bff", "#7b5cff"];
  const strM = new THREE.LineBasicMaterial({ color: 0xf4f4f4 });
  balloons.forEach((mk, i) => {
    const u = unit("balloon", 10.2 + i * 1.3, 0.2);
    const k = new Kit();
    handler(k, -0.2, 0, coats[i]); handler(k, 0.2, 0, coats[i]);
    k.build(u.o, body, glowM);
    // (The balloon and its strings sway together from the handlers' hands.)
    const sway = new THREE.Group();
    sway.position.y = 0.62;
    u.o.add(sway);
    const bk = new Kit();
    mk(bk);
    const bg = new THREE.Group();
    bg.position.y = 1.15;
    bg.rotation.y = Math.PI / 4;
    bk.build(bg, body, glowM);
    sway.add(bg);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute([-0.27, 0, 0, -0.08, 0.82, 0, 0.27, 0, 0, 0.08, 0.82, 0], 3));
    const lines = new THREE.LineSegments(sg, strM);
    sway.add(lines);
    u.sway = sway;
    u.face = bg;
    u.o.scale.setScalar(1.15);
  });

  // Confetti fluttering down over the floats: one small cloud of points, recycled.
  const NC = 64, cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3), cLife = new Float32Array(NC), cVel = new Float32Array(NC * 2);
  const confCol = ["#ff4d6a", "#ffd23a", "#4fd1ff", "#5ee07a", "#ff8ad8", "#ffffff"].map(c => new THREE.Color(c));
  for (let i = 0; i < NC; i++) { const c = confCol[i % confCol.length]; cCol[i * 3] = c.r; cCol[i * 3 + 1] = c.g; cCol[i * 3 + 2] = c.b; cLife[i] = -((i * 0.37) % 2.4); cPos[i * 3 + 1] = -50; }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3));
  const conf = new THREE.Points(cGeo, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true }));
  conf.frustumCulled = false;
  group.add(conf);

  // The route, measured: cumulative distance at each point.
  const n = route.length, cum = new Float32Array(Math.max(1, n));
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + route[i].distanceTo(route[i - 1]);
  const total = n > 1 ? cum[n - 1] : 0;
  const tail = units[units.length - 1].back + 0.6;
  const SPEED = 1.0;
  /** The point `s` along the route (clamped to it). */
  const along = (s: number, out: THREE.Vector3) => {
    if (n < 2) return out.set(0, -50, 0);
    s = Math.max(0, Math.min(total, s));
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo], f = seg > 1e-6 ? (s - cum[lo]) / seg : 0;
    return out.lerpVectors(route[lo], route[hi], f);
  };
  const front = new THREE.Vector3(), rear = new THREE.Vector3();
  let t0 = -1, done = false, headS = -1;
  const floatS = (k: number) => headS - at[k];

  return {
    group,
    update(t, dt, night, hold) {
      if (done) return false;
      if (t0 < 0) t0 = t;
      // (Testing: hold the lead this far along the route.)
      if (hold !== undefined) t0 = t - hold / SPEED;
      headS = (t - t0) * SPEED;
      if (headS - tail > total || n < 2) { done = true; group.visible = false; return false; }
      for (const u of units) {
        const s = headS - u.back;
        const on = s > 0 && s < total;
        u.o.visible = on;
        if (!on) continue;
        along(s + u.half, front);
        along(s - u.half, rear);
        u.o.position.addVectors(front, rear).multiplyScalar(0.5);
        u.o.rotation.y = Math.atan2(front.x - rear.x, front.z - rear.z);
        // (They pop up as they join the route and shrink away at its end, like toys.)
        const e = Math.min(1, s / 0.7, (total - s) / 0.7), pop = e * e * (3 - 2 * e) * (1 + Math.sin(e * Math.PI) * 0.12);
        const base = u.kind === "float" ? FLOAT_SCALE : 1.15;
        u.o.scale.setScalar(base * Math.max(0.01, pop));
        if (u.kind === "band") {
          const step = Math.sin(t * 9 + u.ph);
          u.o.position.y += Math.abs(step) * 0.035;
          u.o.rotation.z = step * 0.05;
        } else if (u.kind === "float") {
          u.o.position.y += Math.sin(t * 3 + u.ph) * 0.006;
          // (The figure on the float turns to the crowd, the town camera looking from +x +z,
          // and sways round a little either way as if waving.)
          if (u.spin) u.spin.rotation.y = Math.PI / 4 - u.o.rotation.y + Math.sin(t * 0.8 + u.ph) * 0.55;
        } else {
          u.o.position.y += Math.abs(Math.sin(t * 7 + u.ph)) * 0.02;
          if (u.sway) { u.sway.rotation.z = Math.sin(t * 0.9 + u.ph) * 0.08; u.sway.rotation.x = Math.sin(t * 0.7 + u.ph * 2) * 0.06; }
          // (The balloon turns to face the town's camera, which looks from +x +z, twisting a
          // little in the wind.)
          if (u.face) u.face.rotation.y = Math.PI / 4 - u.o.rotation.y + Math.sin(t * 0.6 + u.ph) * 0.35;
        }
      }
      for (const b of bulbs) b.tick(t, night);
      // Confetti: each bit rises off a float that's out, then flutters down and starts over.
      let live = 0;
      for (let k = 0; k < at.length; k++) { const s = floatS(k); if (s > 0.5 && s < total - 0.5) live++; }
      for (let i = 0; i < NC; i++) {
        cLife[i] -= dt;
        if (cLife[i] <= 0) {
          const k = i % 4, s = floatS(k);
          if (!live || s <= 0.5 || s >= total - 0.5) { cPos[i * 3 + 1] = -50; cLife[i] = 0.3; continue; }
          along(s, front);
          cPos[i * 3] = front.x + (Math.random() - 0.5) * 0.6; cPos[i * 3 + 1] = 1.0 + Math.random() * 0.5; cPos[i * 3 + 2] = front.z + (Math.random() - 0.5) * 0.6;
          cVel[i * 2] = (Math.random() - 0.5) * 0.5; cVel[i * 2 + 1] = (Math.random() - 0.5) * 0.5;
          cLife[i] = 1.6 + Math.random() * 0.8;
          continue;
        }
        if (cPos[i * 3 + 1] < -10) continue;
        cPos[i * 3] += cVel[i * 2] * dt + Math.sin(t * 6 + i) * 0.004;
        cPos[i * 3 + 1] = Math.max(0.06, cPos[i * 3 + 1] - dt * 0.55);
        cPos[i * 3 + 2] += cVel[i * 2 + 1] * dt + Math.cos(t * 5 + i) * 0.004;
      }
      cGeo.attributes.position.needsUpdate = true;
      glowM.color.setScalar(0.85 + night * 0.6);
      return true;
    },
    floatAt(k, out) {
      const u = units.find(x => x.float === k);
      if (!u || !u.o.visible || u.o.scale.x < 0.5) return false;
      out.copy(u.o.position);
      out.y += 0.5;
      return true;
    },
    lead(out) {
      if (n < 2) return false;
      const s = Math.max(0.01, Math.min(total, floatS(0)));
      along(s, out);
      return true;
    },
    dispose() {
      group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      body.dispose(); glowM.dispose(); strM.dispose();
      (conf.material as THREE.Material).dispose();
      for (const b of bulbs) b.mats.forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}

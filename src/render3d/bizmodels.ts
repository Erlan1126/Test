// Every business has its own building for each of its five stages, so the district reads
// like a real town: a coffee cart grows into a café, a coffee house and finally a tower
// with a giant cup on top; a flower kiosk becomes a greenhouse, a glass botanical dome and
// a terraced garden tower; a launch pad becomes a space center and a galaxy gate.
// Buildings face local +z, stand on y = 0 and fit a lot of about 4.4 × 4.4.
import * as THREE from "three";

export interface ModelMats {
  /** A plain colored surface (cached per color). */
  c(color: string | THREE.Color, rough?: number, metal?: number): THREE.MeshStandardMaterial;
  /** Windows and glass (they light up at night). */
  win: THREE.MeshStandardMaterial;
  /** A sign in this color that glows at night. */
  sign(color: string | THREE.Color): THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  /** Little light bulbs (marquees, casinos). */
  bulb: THREE.MeshStandardMaterial;
}

type G = THREE.Group;
const PI = Math.PI;

/** The building kit: simple shapes placed by their bottom center. */
function kit(m: ModelMats) {
  const add = (g: G, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const K = {
    box: (g: G, mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0) => add(g, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat, x, y, z, ry),
    cyl: (g: G, mat: THREE.Material, rt: number, rb: number, h: number, x = 0, y = 0, z = 0, seg = 16) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), mat, x, y, z),
    cone: (g: G, mat: THREE.Material, r: number, h: number, x = 0, y = 0, z = 0, seg = 12, ry = 0) => add(g, new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), mat, x, y, z, ry),
    sph: (g: G, mat: THREE.Material, r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => add(g, new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz), mat, x, y, z),
    dome: (g: G, mat: THREE.Material, r: number, x = 0, y = 0, z = 0, sy = 1) => add(g, new THREE.SphereGeometry(r, 20, 10, 0, PI * 2, 0, PI / 2).scale(1, sy, 1), mat, x, y, z),
    /** A pitched roof running along x. */
    gable: (g: G, mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0) => {
      const s = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
      const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(PI / 2);
      return add(g, geo, mat, x, y, z, ry);
    },
    /** A half-cylinder roof (hangars, sound stages) running along z. */
    arch: (g: G, mat: THREE.Material, r: number, len: number, x = 0, y = 0, z = 0, ry = 0) =>
      add(g, new THREE.CylinderGeometry(r, r, len, 16, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2).rotateX(0), mat, x, y, z, ry + PI / 2),
    torus: (g: G, mat: THREE.Material, r: number, tube: number, x = 0, y = 0, z = 0, arc = PI * 2, rx = 0, ry = 0) => {
      const mesh = add(g, new THREE.TorusGeometry(r, tube, 8, 28, arc), mat, x, y, z, ry);
      mesh.rotation.x = rx;
      return mesh;
    },
    /** A block with windows on the front and both sides (floors about 1.1 apart). */
    tower: (g: G, mat: THREE.Material, w: number, h: number, d: number, x = 0, z = 0, y0 = 0, opts: { ground?: boolean; cols?: number; fh?: number } = {}) => {
      K.box(g, mat, w, h, d, x, y0, z);
      const fh = opts.fh ?? 1.1, cols = opts.cols ?? Math.max(1, Math.round(w / 0.75)), sc = Math.max(1, Math.round(d / 0.75));
      for (let y = y0 + (opts.ground === false ? 0.45 : 1.15); y + 0.6 < y0 + h; y += fh) {
        for (let k = 0; k < cols; k++) K.box(g, m.win, (w / cols) * 0.55, 0.55, 0.04, x - w / 2 + (k + 0.5) * (w / cols), y, z + d / 2 + 0.01);
        for (const sd of [-1, 1]) for (let k = 0; k < sc; k++) K.box(g, m.win, 0.04, 0.55, (d / sc) * 0.55, x + sd * (w / 2 + 0.01), y, z - d / 2 + (k + 0.5) * (d / sc));
      }
    },
    /** A shop front: big window and a door. */
    front: (g: G, w: number, x = 0, z = 0, y = 0) => {
      K.box(g, m.win, w * 0.62, 0.95, 0.05, x - w * 0.12, y + 0.2, z);
      K.box(g, m.c("#3a2f5a"), 0.42, 0.95, 0.06, x + w * 0.33, y, z);
    },
    /** A striped awning over a shop front. */
    awning: (g: G, w: number, x: number, y: number, z: number, c1: string | THREE.Color, c2: string | THREE.Color = "#ffffff", depth = 0.7) => {
      const n = Math.max(3, Math.round(w / 0.3)) | 1;
      for (let k = 0; k < n; k++) {
        const b = K.box(g, m.c(k % 2 ? c2 : c1, 0.8), w / n, 0.06, depth, x - w / 2 + (k + 0.5) * (w / n), y, z + depth / 2 - 0.05);
        b.rotation.x = 0.35;
      }
      for (let k = 0; k < n; k++) K.cone(g, m.c(k % 2 ? c2 : c1, 0.8), w / n / 2, 0.16, x - w / 2 + (k + 0.5) * (w / n), y - 0.36, z + depth * 0.95, 3, PI);
    },
    umbrella: (g: G, x: number, z: number, c: string | THREE.Color, h = 1.25, r = 0.6) => {
      K.cyl(g, m.c("#e6e1f2"), 0.025, 0.025, h, x, 0, z, 6);
      for (let k = 0; k < 8; k++) {
        const seg = add(g, new THREE.ConeGeometry(r, r * 0.45, 8, 1, true, (k / 8) * PI * 2, PI / 4).translate(0, r * 0.22, 0), m.c(k % 2 ? "#ffffff" : c, 0.8), x, h - 0.05, z);
        (seg.material as THREE.Material).side = THREE.DoubleSide;
      }
    },
    table: (g: G, x: number, z: number, c: string | THREE.Color = "#ffffff") => {
      K.cyl(g, m.c(c), 0.28, 0.28, 0.05, x, 0.42, z, 12);
      K.cyl(g, m.c("#4a4f7a"), 0.03, 0.05, 0.42, x, 0, z, 6);
      for (const s of [-1, 1]) K.box(g, m.c(c), 0.18, 0.28, 0.18, x + s * 0.42, 0, z);
    },
    tree: (g: G, x: number, z: number, s = 1) => {
      K.cyl(g, m.trunk, 0.06 * s, 0.09 * s, 0.6 * s, x, 0, z, 6);
      add(g, new THREE.IcosahedronGeometry(0.45 * s, 0), m.leaf, x, 0.85 * s, z);
    },
    palm: (g: G, x: number, z: number, s = 1) => {
      K.cyl(g, m.trunk, 0.05 * s, 0.09 * s, 1.5 * s, x, 0, z, 6);
      for (let k = 0; k < 5; k++) { const l = K.box(g, m.leaf, 0.9 * s, 0.05, 0.22 * s, x, 1.5 * s, z, (k / 5) * PI * 2); l.geometry.translate(0.4 * s, 0, 0); l.rotation.z = -0.35; }
    },
    bush: (g: G, x: number, z: number, s = 1, c?: string) => add(g, new THREE.IcosahedronGeometry(0.28 * s, 0), c ? m.c(c, 0.9) : m.leaf, x, 0.2 * s, z),
    flowers: (g: G, x: number, z: number, w: number, colors = ["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"], y = 0) => {
      K.box(g, m.c("#8a5a3a"), w, 0.22, 0.32, x, y, z);
      const n = Math.max(2, Math.round(w / 0.22));
      for (let k = 0; k < n; k++) K.sph(g, m.c(colors[k % colors.length], 0.8), 0.1, x - w / 2 + (k + 0.5) * (w / n), y + 0.28, z);
    },
    /** A glowing sign board. */
    board: (g: G, c: string | THREE.Color, w: number, h: number, x: number, y: number, z: number) => K.box(g, m.sign(c), w, h, 0.08, x, y, z),
    /** A row of little bulbs (marquees). */
    bulbs: (g: G, w: number, x: number, y: number, z: number) => { const n = Math.round(w / 0.22); for (let k = 0; k < n; k++) K.sph(g, m.bulb, 0.055, x - w / 2 + (k + 0.5) * (w / n), y, z); },
    flag: (g: G, x: number, y: number, z: number, c: string | THREE.Color) => { K.cyl(g, m.c("#e6e1f2"), 0.025, 0.025, 1.0, x, y, z, 6); K.box(g, m.c(c, 0.8), 0.5, 0.3, 0.03, x + 0.27, y + 0.65, z); },
    rocket: (g: G, x: number, z: number, h: number, c: string | THREE.Color, y = 0) => {
      const r = h * 0.11;
      K.cyl(g, m.c("#ffffff", 0.4), r, r, h * 0.7, x, y + h * 0.08, z);
      K.cone(g, m.c(c, 0.4), r, h * 0.22, x, y + h * 0.78, z, 16);
      K.cyl(g, m.c(c, 0.4), r * 1.02, r * 1.02, h * 0.08, x, y + h * 0.45, z);
      for (let k = 0; k < 4; k++) { const f = K.box(g, m.c(c, 0.4), 0.04, h * 0.2, r * 1.4, x, y, z); f.geometry.translate(0, 0, r * 1.1); f.rotation.y = (k / 4) * PI * 2 + PI / 4; }
      K.cone(g, m.c("#3a3f6a"), r * 0.8, h * 0.08, x, y, z, 12);
    },
    blimp: (g: G, x: number, y: number, z: number, len: number, c: string | THREE.Color) => {
      K.sph(g, m.c(c, 0.5), len / 2, x, y, z, 1, 0.38, 0.38);
      K.box(g, m.c("#4a4f7a"), len * 0.25, len * 0.1, len * 0.12, x, y - len * 0.25, z);
      for (const s of [-1, 1]) K.box(g, m.c(c, 0.5), len * 0.14, len * 0.22, 0.04, x - len * 0.44, y - len * 0.05 + s * 0.02, z, s > 0 ? 0 : PI / 2);
    },
    /** A podium the bigger buildings stand on. */
    podium: (g: G, w: number, d: number, h = 0.25) => K.box(g, m.c("#e9e4f5", 0.6), w, h, d),
  };
  return K;
}

/** Builds business `id` at stage `s` (0-4) into `g`. Returns parts that spin (giant props). */
export function buildModel(g: G, id: string, s: number, c1: string, c2: string, m: ModelMats, prop: () => THREE.Group): void {
  const K = kit(m);
  const light = (c: string, k: number) => new THREE.Color(c).lerp(new THREE.Color("#ffffff"), k);
  const dark = (c: string, k: number) => new THREE.Color(c).lerp(new THREE.Color("#2a1f4a"), k);
  const wall = m.c(light(c1, 0.55)), wall2 = m.c(light(c1, 0.25)), trim = m.c(c2, 0.5), cream = m.c("#fff6e8");
  const crown = (y: number, scale: number, x = 0, z = 0) => { const p = prop(); p.position.set(x, y, z); p.scale.setScalar(scale); p.userData.dynamic = true; p.userData.spin = true; g.add(p); };
  const cart = (z = 0.3) => {
    K.box(g, wall, 1.3, 0.65, 0.75, 0, 0.22, z);
    K.box(g, trim, 1.36, 0.08, 0.8, 0, 0.87, z);
    for (const x of [-0.45, 0.45]) { const w = K.cyl(g, m.c("#3a2f5a"), 0.2, 0.2, 0.08, x, 0.2, z + 0.4, 12); w.rotation.x = PI / 2; }
  };
  switch (id) {
    case "coffee":
      // (No stools in front: customers queue there, and two folded chairs lean on the cart.)
      if (s === 0) { cart(); K.umbrella(g, 0, 0.3, c2, 1.9, 0.9); crown(0.95, 0.6, -0.3, 0.3); }
      else if (s === 1) {
        K.box(g, cream, 3, 2.2, 2.4, 0, 0, -0.5); K.box(g, trim, 3.1, 0.2, 2.5, 0, 2.2, -0.5);
        K.front(g, 3, 0, 0.71); K.awning(g, 3, 0, 1.45, 0.72, c2);
        K.table(g, -0.9, 1.6); K.table(g, 0.9, 1.6); crown(2.4, 1.1, 0.6, -0.5); K.board(g, c2, 1.4, 0.35, -0.4, 1.7, 0.72);
      } else if (s === 2) {
        K.tower(g, wall2, 3.4, 3.4, 2.6, -0.2, -0.6, 0); K.cyl(g, wall2, 0.9, 0.9, 3.4, 1.4, 0, 0.5, 16); K.dome(g, trim, 0.95, 1.4, 3.4, 0.5, 0.6);
        K.front(g, 2.4, -0.6, 0.71); K.awning(g, 2.4, -0.6, 1.45, 0.72, c2);
        K.box(g, m.c("#ffffff"), 3.0, 0.08, 0.5, -0.4, 2.1, 0.9); for (let k = 0; k < 7; k++) K.box(g, m.c("#ffffff"), 0.04, 0.35, 0.04, -1.8 + k * 0.45, 2.15, 1.12);
        K.umbrella(g, -1.2, 1.7, c2); K.umbrella(g, 0.6, 1.8, c2); crown(4.1, 1.3, 1.4, 0.5);
      } else if (s === 3) {
        K.tower(g, m.c(dark(c2, 0.35)), 4, 4.4, 2.8, 0, -0.5, 0); K.gable(g, m.c("#4a3a5a"), 4.1, 1.1, 2.9, 0, 4.4, -0.5);
        K.box(g, m.c("#8a4a3a"), 0.5, 1.6, 0.5, -1.3, 4.4, -1.0);
        for (const [y, sc] of [[6.2, 0.35], [6.6, 0.45], [7.1, 0.3]] as const) K.sph(g, m.c("#ffffff", 1), sc, -1.3 + (y - 6) * 0.3, y, -1.0);
        K.front(g, 3.2, 0, 0.91); K.awning(g, 3.6, 0, 1.45, 0.92, c2, "#fff6e8");
        K.table(g, -1.3, 1.8); K.table(g, 0, 1.9); K.table(g, 1.3, 1.8); crown(5.6, 1.7, 0.9, -0.5); K.board(g, c2, 2.2, 0.5, 0, 2.3, 0.92);
      } else {
        K.podium(g, 4.4, 4.2); K.tower(g, m.win, 4.0, 1.8, 3.4, 0, 0, 0.25, { ground: false });
        K.tower(g, wall2, 2.6, 7.2, 2.6, 0, -0.3, 2.05); for (const y of [2.05, 5.6, 9.2]) K.box(g, m.gold, 2.72, 0.14, 2.72, 0, y, -0.3);
        K.cyl(g, m.gold, 1.1, 1.3, 0.35, 0, 9.25, -0.3, 16); crown(9.6, 2.6, 0, -0.3); K.awning(g, 4, 0, 1.6, 1.45, c2);
        K.umbrella(g, -1.5, 1.9, c2, 1.1, 0.5); K.umbrella(g, 1.5, 1.9, c2, 1.1, 0.5);
      }
      break;
    case "flowers":
      if (s === 0) {
        K.box(g, wall, 1.2, 1.3, 1, 0, 0, -0.2); K.cone(g, m.c("#3fbf6a"), 1.0, 0.7, 0, 1.3, -0.2, 4, PI / 4);
        for (let k = 0; k < 4; k++) { K.cyl(g, m.c("#c0c4dd"), 0.16, 0.13, 0.3, -0.75 + k * 0.5, 0, 0.75); K.sph(g, m.c(["#ff6fa0", "#ffe27a", "#b48cff", "#ff8a5c"][k]), 0.2, -0.75 + k * 0.5, 0.45, 0.75); }
      } else if (s === 1) {
        K.box(g, m.c("#ffffff"), 3, 2.3, 2.4, 0, 0, -0.5); K.box(g, trim, 3.1, 0.2, 2.5, 0, 2.3, -0.5);
        K.front(g, 3, 0, 0.71); K.awning(g, 3, 0, 1.45, 0.72, c2, "#ffffff"); K.flowers(g, 0, 1.0, 2.6);
        for (const x of [-1.2, 1.2]) { K.cyl(g, m.c("#c0c4dd"), 0.22, 0.17, 0.35, x, 0, 1.6); K.bush(g, x, 1.6, 1.1, "#ff6fa0"); }
        crown(2.5, 1.0, 0, -0.6);
      } else if (s === 2) {
        const glass = m.c("#d9f4ff", 0.1, 0.2);
        K.box(g, glass, 3.6, 1.7, 2.6, 0, 0, -0.5); K.gable(g, glass, 3.6, 1.1, 2.6, 0, 1.7, -0.5);
        for (let k = -2; k <= 2; k++) K.box(g, m.c("#ffffff"), 0.06, 1.7, 2.62, k * 0.88, 0, -0.5);
        for (let k = -1; k <= 1; k++) K.bush(g, k * 1.0, -0.5, 1.4);
        K.flowers(g, -1, 1.3, 1.6); K.flowers(g, 1.1, 1.3, 1.4, ["#ffffff", "#ff6fa0"]); K.tree(g, 1.7, 1.8, 0.8); crown(3.0, 1.0, 0, -0.5);
      } else if (s === 3) {
        K.cyl(g, m.c("#efe7d8"), 2.0, 2.1, 1.0, 0, 0, -0.3, 24); K.dome(g, m.c("#cfeeff", 0.08, 0.3), 1.95, 0, 1.0, -0.3, 1.1);
        for (let k = 0; k < 6; k++) { const r = K.torus(g, m.c("#ffffff"), 1.97, 0.04, 0, 1.0, -0.3, PI, 0, (k / 6) * PI); r.rotation.order = "YXZ"; }
        K.tree(g, -0.6, -0.5, 1.4); K.palm(g, 0.6, -0.1, 1.2);
        K.box(g, m.c("#ffffff"), 1.2, 1.4, 0.4, 0, 0, 1.75); K.box(g, m.win, 0.6, 1.0, 0.05, 0, 0, 1.96);
        K.flowers(g, -1.5, 1.9, 1.0); K.flowers(g, 1.5, 1.9, 1.0); crown(3.3, 1.4, 0, -0.3);
      } else {
        const tiers = [[4.2, 1.6], [3.4, 1.8], [2.6, 1.8], [1.8, 1.6]];
        let y = 0;
        tiers.forEach(([w, h], k) => {
          K.tower(g, k % 2 ? wall2 : m.c("#ffffff"), w, h, w, 0, -0.2, y, { ground: k > 0 });
          K.box(g, m.leaf, w + 0.2, 0.3, w + 0.2, 0, y + h, -0.2);
          for (let j = 0; j < 4; j++) K.bush(g, -w / 2 + 0.3 + j * (w - 0.6) / 3, w / 2 - 0.1, 0.8, ["#ff6fa0", "#ffe27a", "#b48cff", "#ffffff"][(j + k) % 4]);
          y += h + 0.3;
        });
        crown(y + 0.1, 2.4, 0, -0.2);
      }
      break;
    case "bakery":
      if (s === 0) { cart(); K.awning(g, 1.5, 0, 1.6, -0.1, c2, "#ffffff", 0.9); K.cyl(g, m.c("#e6e1f2"), 0.03, 0.03, 1.5, -0.7, 0, 0.6, 6); K.cyl(g, m.c("#e6e1f2"), 0.03, 0.03, 1.5, 0.7, 0, 0.6, 6); crown(0.95, 0.7); }
      else if (s === 1) {
        K.box(g, cream, 2.8, 1.8, 2.2, 0, 0, -0.5); K.gable(g, m.c(dark(c2, 0.15)), 3.0, 1.1, 2.5, 0, 1.8, -0.5);
        K.box(g, m.c("#a86a4a"), 0.4, 1.2, 0.4, 0.9, 2.1, -0.9); K.front(g, 2.8, 0, 0.61); K.flowers(g, -0.4, 0.85, 1.5);
        K.cyl(g, m.sign(c2), 0.4, 0.4, 0.08, 0, 1.6, 0.68).rotation.x = PI / 2; crown(1.4, 0.6, 0, 1.0);
      } else if (s === 2) {
        K.tower(g, m.c(light("#ff9ac8", 0.5)), 3.2, 2.8, 2.6, 0, -0.5, 0); K.cone(g, m.c("#4a3a6a"), 2.3, 1.1, 0, 2.8, -0.5, 4, PI / 4);
        K.front(g, 3.0, 0, 0.81); K.awning(g, 3.2, 0, 1.45, 0.82, "#ff9ac8", "#ffffff");
        for (let k = 0; k < 3; k++) { K.cyl(g, m.c("#ffffff"), 0.15, 0.15, 0.2, -0.9 + k * 0.4, 0.5, 0.6); K.cyl(g, m.c(["#ff9ac8", "#ffe27a", "#b48cff"][k]), 0.13, 0.13, 0.12, -0.9 + k * 0.4, 0.7, 0.6); }
        K.table(g, 1.0, 1.7, "#ff9ac8"); crown(4.0, 1.1, 0, -0.5);
      } else if (s === 3) {
        K.tower(g, m.c("#c86a4a"), 3.2, 3.0, 2.8, -0.5, -0.4, 0);
        for (let k = 0; k < 3; k++) K.gable(g, m.c("#e6e1f2"), 0.9, 0.6, 2.8, -1.6 + k * 1.05, 3.0, -0.4, PI / 2);
        for (const x of [1.4, 2.0]) { K.cyl(g, m.c("#e6e1f2", 0.4, 0.4), 0.32, 0.32, 3.6, x, 0, -0.9); K.cone(g, m.c(c2), 0.36, 0.5, x, 3.6, -0.9); }
        K.cyl(g, m.c("#8a4a3a"), 0.22, 0.3, 2.2, -1.7, 3.0, -1.3); K.sph(g, m.c("#e6e1f2", 1), 0.35, -1.6, 5.5, -1.3); K.sph(g, m.c("#e6e1f2", 1), 0.45, -1.3, 6.0, -1.3);
        K.front(g, 2.6, -0.5, 1.01); K.awning(g, 2.6, -0.5, 1.45, 1.02, c2);
        K.box(g, m.c("#ffffff"), 0.6, 0.6, 1.1, 1.6, 0, 1.4); K.box(g, m.c(c2), 0.6, 0.45, 0.4, 1.6, 0, 2.0); crown(3.7, 1.3, -0.4, -0.4);
      } else {
        K.podium(g, 4.4, 4.2); K.tower(g, cream, 3.0, 6.0, 3.0, 0, -0.2, 0.25); K.awning(g, 3.0, 0, 1.6, 1.32, c2);
        const layers: [number, number, string][] = [[1.7, 0.9, "#ff9ac8"], [1.3, 0.8, "#ffffff"], [0.9, 0.7, "#ffe27a"]];
        let y = 6.25;
        for (const [r, h, c] of layers) { K.cyl(g, m.c(c, 0.6), r, r, h, 0, y, -0.2, 24); K.torus(g, m.c("#ffffff"), r, 0.08, 0, y + h, -0.2, PI * 2, PI / 2); y += h; }
        K.sph(g, m.c("#e8334f", 0.3), 0.3, 0, y + 0.25, -0.2); K.cyl(g, m.gold, 0.05, 0.05, 0.6, 0.6, y, -0.2, 6);
      }
      break;
    case "pizza":
      if (s === 0) { cart(); K.dome(g, m.c("#c8603a"), 0.45, 0.2, 0.87, 0.3); K.cyl(g, m.c("#4a4f7a"), 0.08, 0.08, 0.8, 0.5, 1.1, 0.2, 8); K.umbrella(g, -0.9, 0.9, c2, 1.5, 0.6); crown(1.05, 0.5, -0.45, 0.3); }
      else if (s === 1) {
        K.box(g, m.c("#fff6e8"), 3, 2.2, 2.4, 0, 0, -0.5); K.box(g, m.c("#3fbf6a", 0.6), 3.1, 0.2, 2.5, 0, 2.2, -0.5);
        K.front(g, 3, 0, 0.71); K.awning(g, 3, 0, 1.45, 0.72, c2, "#ffffff");
        K.box(g, m.c("#b8583a"), 0.6, 1.4, 0.6, -1.0, 2.2, -1.1); K.table(g, 0.8, 1.6, "#e8334f"); crown(2.5, 1.0, 0.5, -0.5);
      } else if (s === 2) {
        K.tower(g, m.c("#f2b38a"), 3.4, 2.8, 2.6, 0, -0.6, 0); K.gable(g, m.c("#c8503a"), 3.6, 1.0, 2.9, 0, 2.8, -0.6);
        K.front(g, 3.0, 0, 0.71);
        for (const x of [-1.5, 0, 1.5]) K.box(g, m.c("#8a5a3a"), 0.1, 1.5, 0.1, x, 0, 2.0);
        K.box(g, m.c("#8a5a3a"), 3.2, 0.08, 1.4, 0, 1.5, 1.35); for (let k = 0; k < 5; k++) K.bush(g, -1.4 + k * 0.7, 1.35, 0.8).position.y = 1.62;
        K.table(g, -0.8, 1.4, "#e8334f"); K.table(g, 0.8, 1.4, "#e8334f"); crown(4.0, 1.1, 0, -0.6);
      } else if (s === 3) {
        K.tower(g, m.c("#fff1e0"), 4.2, 2.8, 2.6, 0, -0.6, 0); K.box(g, trim, 4.3, 0.25, 2.7, 0, 2.8, -0.6);
        for (let k = 0; k < 6; k++) K.cyl(g, m.c("#ffffff"), 0.13, 0.15, 2.8, -1.8 + k * 0.72, 0, 0.9, 10);
        K.box(g, m.c("#ffffff"), 4.3, 0.25, 0.5, 0, 2.8, 0.85); K.cyl(g, wall2, 1.1, 1.1, 0.6, 0, 3.05, -0.6, 20); K.dome(g, trim, 1.15, 0, 3.65, -0.6);
        K.flag(g, -1.8, 3.05, -1.5, "#3fbf6a"); K.flag(g, 1.8, 3.05, -1.5, "#e8334f"); crown(4.95, 1.4, 0, -0.6);
      } else {
        K.podium(g, 4.4, 4.2); K.box(g, m.c("#fff1e0"), 4.0, 1.6, 3.2, 0, 0.25, -0.2); K.awning(g, 4.0, 0, 1.6, 1.42, c2, "#3fbf6a");
        K.cyl(g, wall2, 1.5, 1.5, 7.0, 0, 1.85, -0.3, 20);
        for (let y = 2.5; y < 8.6; y += 1.0) K.cyl(g, m.win, 1.53, 1.53, 0.45, 0, y, -0.3, 20);
        K.cyl(g, m.gold, 1.6, 1.6, 0.2, 0, 8.85, -0.3, 20); crown(9.2, 2.6, 0, -0.3);
      }
      break;
    case "cinema":
      if (s === 0) {
        // A drive-in: a big glowing screen on a frame, rows of red seats, a projector booth and a popcorn stand.
        K.box(g, m.c("#3a2f5a"), 3.2, 0.25, 0.25, 0, 2.55, -1.55);
        for (const x of [-1.5, 1.5]) K.box(g, m.c("#3a2f5a"), 0.18, 2.8, 0.18, x, 0, -1.55);
        K.box(g, m.sign("#cfe6ff"), 2.8, 1.6, 0.06, 0, 0.9, -1.5);
        K.box(g, m.c("#3a2f5a"), 2.9, 0.1, 0.08, 0, 0.85, -1.5);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) {
          const x = -1.1 + k * 0.55, z = -0.2 + r * 0.7;
          K.box(g, m.c("#e8334f", 0.6), 0.38, 0.2, 0.34, x, 0.1, z);
          K.box(g, m.c("#e8334f", 0.6), 0.38, 0.35, 0.08, x, 0.25, z + 0.15);
        }
        K.box(g, m.c("#ffffff"), 0.7, 0.8, 0.6, 1.4, 0, 1.4); K.box(g, m.c(c2), 0.75, 0.12, 0.65, 1.4, 0.8, 1.4);
        K.cyl(g, m.c("#4a4f7a"), 0.12, 0.12, 0.25, 1.4, 0.92, 1.25, 10).rotation.x = Math.PI / 2;
        K.box(g, m.c("#ffffff"), 0.6, 0.6, 0.4, -1.3, 0, 1.5); K.awning(g, 0.7, -1.3, 0.85, 1.55, "#e8334f", "#ffffff", 0.35);
        K.cyl(g, m.c("#ffe27a"), 0.18, 0.14, 0.3, -1.3, 0.6, 1.5, 10);
      } else if (s === 1) {
        K.box(g, m.c(dark(c2, 0.3)), 3.2, 2.8, 2.6, 0, 0, -0.5); K.box(g, m.c("#ffffff"), 3.0, 0.5, 0.6, 0, 1.6, 1.0); K.bulbs(g, 3.0, 0, 2.15, 1.31);
        K.board(g, "#ffe27a", 2.6, 0.32, 0, 1.68, 1.31); K.board(g, c1, 0.4, 1.6, 1.2, 2.2, 0.85); K.front(g, 2.6, 0, 0.81); crown(3.0, 1.0, -0.6, -0.5);
      } else if (s === 2) {
        K.tower(g, m.c(dark(c2, 0.4)), 4.2, 3.4, 3.0, 0, -0.5, 0, { ground: false, cols: 3 });
        for (let k = 0; k < 3; k++) K.board(g, ["#ff4f8b", "#4f8bff", "#ffc93c"][k], 1.0, 1.4, -1.3 + k * 1.3, 1.6, 1.02);
        K.box(g, m.c("#ffffff"), 4.0, 0.4, 0.6, 0, 1.0, 1.3); K.bulbs(g, 4.0, 0, 1.42, 1.61); K.front(g, 3.2, 0, 1.01); crown(3.6, 1.2, 0, -0.5);
      } else if (s === 3) {
        K.box(g, m.c(dark(c2, 0.3)), 4.2, 3.6, 2.2, 0, 0, -1.0); K.cyl(g, m.c(c1), 2.0, 2.0, 3.6, 0, 0, 0.0, 24); K.cyl(g, m.win, 2.03, 2.03, 0.5, 0, 2.2, 0.0, 24);
        K.bulbs(g, 3.6, 0, 3.5, 2.0); K.box(g, m.c("#e8334f"), 0.9, 0.02, 2.4, 0, 0, 2.0);
        K.board(g, "#ffe27a", 0.5, 2.6, 0, 3.6, 0.8); K.cyl(g, m.gold, 0.3, 0.3, 0.1, 0, 6.3, 0.8);
        for (const x of [-1.8, 1.8]) { K.cyl(g, m.c("#4a4f7a"), 0.2, 0.25, 0.4, x, 0, 1.9); }
        crown(3.8, 1.3, 0, -1.0);
      } else {
        for (const [x, z, l] of [[-1.2, -0.6, 2.8], [1.2, -0.2, 2.2]] as const) { K.box(g, m.c("#efe7d8"), 1.9, 1.6, l, x, 0, z); K.arch(g, m.c("#efe7d8"), 0.95, l, x, 1.6, z); }
        K.cyl(g, m.c("#c8a070"), 0.5, 0.5, 0.9, 1.4, 3.0, -1.5); for (const dx of [-0.35, 0.35]) K.box(g, m.c("#4a4f7a"), 0.06, 3.0, 0.06, 1.4 + dx, 0, -1.5);
        K.tower(g, m.c(dark(c2, 0.35)), 1.6, 7.0, 1.6, -1.4, 1.4, 0); crown(7.4, 1.6, -1.4, 1.4); K.board(g, c1, 1.4, 0.4, 1.2, 1.0, 0.92);
      }
      break;
    case "hotel":
      if (s === 0) { K.tower(g, cream, 2.6, 2.2, 2.0, 0, -0.5, 0, { cols: 3 }); K.gable(g, trim, 2.8, 1.0, 2.3, 0, 2.2, -0.5); K.front(g, 2.2, 0, 0.51); K.board(g, c2, 1.2, 0.3, 0, 1.3, 0.52); K.tree(g, 1.6, 1.2, 0.8); }
      else if (s === 1) {
        K.tower(g, cream, 3.0, 3.6, 2.4, 0, -0.5, 0, { cols: 3 });
        for (const y of [1.25, 2.35]) { K.box(g, m.c("#ffffff"), 3.0, 0.08, 0.5, 0, y, 0.95); K.flowers(g, 0, 0.98, 2.6, undefined, y + 0.08); }
        K.box(g, trim, 3.1, 0.2, 2.5, 0, 3.6, -0.5); K.front(g, 2.6, 0, 0.71); K.board(g, c2, 1.6, 0.3, 0, 1.0, 0.73); K.flag(g, 1.2, 3.8, -0.5, c2);
      } else if (s === 2) {
        K.tower(g, wall, 3.6, 6.0, 2.8, 0, -0.5, 0, { cols: 4 }); K.box(g, trim, 3.7, 0.3, 2.9, 0, 6.0, -0.5);
        K.box(g, m.c(c2), 1.6, 0.12, 1.2, 0, 1.25, 1.4); for (const x of [-0.7, 0.7]) K.cyl(g, m.gold, 0.04, 0.04, 1.25, x, 0, 1.9, 6);
        K.front(g, 2.8, 0, 0.91); K.board(g, "#ffe27a", 2.0, 0.4, 0, 5.5, 0.92); for (const x of [-1.3, 0, 1.3]) K.flag(g, x, 6.3, -0.5, c2);
      } else if (s === 3) {
        K.tower(g, wall, 2.4, 6.6, 2.4, -0.9, -0.8, 0, { cols: 3 }); K.tower(g, cream, 3.6, 2.4, 1.6, 0.2, -1.2, 0);
        K.box(g, m.c("#cfe9ff"), 2.2, 0.15, 1.3, 0.9, 0, 1.2); K.box(g, m.c("#4fc3ff", 0.1, 0.2), 2.0, 0.17, 1.1, 0.9, 0, 1.2);
        K.umbrella(g, -0.9, 1.6, c2, 1.1, 0.5); K.palm(g, 2.0, 0.4, 0.9); K.palm(g, -1.9, 1.8, 0.8); K.board(g, c2, 1.6, 0.4, -0.9, 6.0, 0.42);
      } else {
        K.podium(g, 4.4, 4.2); K.box(g, m.c("#4fc3ff", 0.1, 0.2), 1.6, 0.3, 1.6, 1.3, 0.25, 1.3);
        K.tower(g, wall, 2.6, 9.6, 2.6, -0.4, -0.4, 0.25, { cols: 3 }); K.dome(g, m.win, 1.3, -0.4, 9.85, -0.4, 0.6);
        K.cyl(g, m.c("#4a4f7a"), 1.1, 1.1, 0.1, -0.4, 10.6, -0.4, 20); K.box(g, m.c("#ffffff"), 0.5, 0.02, 0.12, -0.4, 10.71, -0.4);
        K.board(g, "#ffe27a", 1.8, 0.4, -0.4, 8.9, 0.92); crown(1.3, 0.8, 1.3, 1.3);
      }
      break;
    case "mall":
      if (s === 0) { for (const [x, c] of [[-1.1, "#ff6fa0"], [0, "#ffe27a"], [1.1, "#4f8bff"]] as const) { K.box(g, m.c("#ffffff"), 0.9, 0.7, 0.6, x, 0, 0); K.awning(g, 1.0, x, 1.25, -0.2, c, "#ffffff", 0.8); for (const dx of [-0.42, 0.42]) K.box(g, m.c("#e6e1f2"), 0.05, 1.3, 0.05, x + dx, 0, 0.5); } }
      else if (s === 1) {
        K.box(g, m.c("#ffffff"), 4.2, 2.0, 2.4, 0, 0, -0.8); K.box(g, m.win, 4.0, 0.9, 0.05, 0, 0.3, 0.41); K.box(g, trim, 4.3, 0.4, 2.5, 0, 2.0, -0.8);
        K.board(g, c2, 2.0, 0.5, 0, 1.4, 0.43);
        for (const [x, c] of [[-1.2, "#ff4f8b"], [0.2, "#4f8bff"], [1.4, "#ffc93c"]] as const) { K.box(g, m.c(c, 0.4), 0.5, 0.3, 0.9, x, 0.1, 1.6); }
      } else if (s === 2) {
        K.tower(g, wall, 4.4, 3.0, 3.0, 0, -0.5, 0, { cols: 4 }); K.box(g, m.win, 1.6, 4.2, 1.6, 0, 0, 0.3); K.cone(g, m.win, 1.15, 0.9, 0, 4.2, 0.3, 4, PI / 4);
        K.board(g, c2, 1.4, 0.4, -1.4, 2.4, 1.02); crown(3.1, 1.2, 1.4, -0.6);
      } else if (s === 3) {
        K.tower(g, wall, 1.8, 4.5, 3.4, -1.3, -0.4, 0, { cols: 2 }); K.tower(g, wall2, 1.8, 3.6, 3.4, 1.3, -0.4, 0, { cols: 2 });
        K.box(g, m.win, 1.0, 0.7, 0.9, 0, 2.6, 0.4); K.box(g, m.c("#ffffff"), 1.0, 0.1, 0.9, 0, 2.5, 0.4);
        K.cyl(g, m.c("#e6e1f2"), 0.7, 0.75, 0.3, 0, 0, 1.6, 20); K.cyl(g, m.c("#6fc6ff", 0.1, 0.2), 0.6, 0.6, 0.32, 0, 0, 1.6, 20);
        K.board(g, c2, 1.4, 0.4, -1.3, 3.8, 1.32); crown(3.7, 1.0, 1.3, -0.4);
      } else {
        const blocks: [number, number, number, number, number, string][] = [[4.0, 2.0, 3.2, 0, 0, "#ffffff"], [3.0, 2.2, 2.6, 0.4, -0.4, c1], [3.2, 2.0, 2.4, -0.3, -0.2, "#ffffff"], [2.4, 2.2, 2.2, 0.3, -0.5, c1]];
        let y = 0;
        for (const [w, h, d, x, z, c] of blocks) { K.tower(g, m.c(light(c, 0.3)), w, h, d, x, z, y, { ground: y === 0 }); y += h; }
        K.cyl(g, m.gold, 0.6, 0.6, 0.2, 0.3, y, -0.5); crown(y + 0.25, 1.8, 0.3, -0.5);
      }
      break;
    case "airport":
      if (s === 0) { K.cyl(g, m.c("#c0c4dd", 0.4, 0.5), 0.08, 0.12, 2.6, -0.8, 0, -0.5, 8); K.torus(g, m.c(c2), 0.25, 0.05, -0.8, 2.6, -0.5, PI * 2, PI / 2); K.blimp(g, 0.4, 2.4, -0.5, 1.8, c1); K.box(g, m.c("#e6e1f2"), 1.2, 0.5, 0.8, 0.8, 0, 1.0); }
      else if (s === 1) {
        K.box(g, m.c("#e6e1f2"), 2.6, 0.9, 3.0, -0.6, 0, -0.5); K.arch(g, m.c("#c0c4dd", 0.4, 0.4), 1.3, 3.0, -0.6, 0.9, -0.5);
        K.box(g, m.c("#3a3f6a"), 1.6, 1.5, 0.04, -0.6, 0, 1.01); K.cyl(g, m.c("#c0c4dd"), 0.05, 0.05, 1.8, 1.6, 0, 1.4, 6); K.cone(g, m.c("#ff8a3b"), 0.18, 0.6, 1.85, 1.6, 1.4, 8).rotation.z = PI / 2;
        K.blimp(g, 1.3, 3.0, -0.8, 1.6, c1);
      } else if (s === 2) {
        K.box(g, m.win, 4.0, 1.4, 2.0, 0, 0, -0.2); K.box(g, m.c("#ffffff"), 4.2, 0.2, 2.4, 0, 1.4, -0.2);
        K.cyl(g, m.c("#ffffff"), 0.35, 0.45, 3.6, 1.5, 0, -1.4, 12); K.cyl(g, m.win, 0.75, 0.6, 0.6, 1.5, 3.6, -1.4, 12); K.cyl(g, m.c(c2), 0.8, 0.8, 0.12, 1.5, 4.2, -1.4, 12);
        K.board(g, c2, 1.6, 0.35, -0.8, 1.0, 0.82); crown(1.6, 0.9, -1.2, -0.6);
      } else if (s === 3) {
        K.box(g, m.win, 4.2, 1.6, 1.8, 0, 0, 0.2); K.arch(g, m.c("#ffffff"), 0.9, 4.2, 0, 1.6, 0.2, PI / 2);
        for (const x of [-1.6, 1.6]) { K.cyl(g, m.c("#c0c4dd", 0.4, 0.5), 0.08, 0.12, 4.2, x, 0, -1.5, 8); K.blimp(g, x + (x < 0 ? 0.9 : -0.9), 4.0, -1.5, 1.9, x < 0 ? c1 : c2); }
        K.board(g, c2, 1.8, 0.35, 0, 1.1, 1.12);
      } else {
        K.podium(g, 4.4, 4.2); K.torus(g, m.c("#ffffff", 0.4), 2.0, 0.22, 0, 0.25, 0.4, PI, 0, 0); K.box(g, m.win, 3.6, 1.6, 1.4, 0, 0.25, 0.4);
        K.cyl(g, m.c("#ffffff"), 0.4, 0.55, 7.5, -1.3, 0.25, -1.3, 12); K.cyl(g, m.win, 0.85, 0.7, 0.7, -1.3, 7.75, -1.3, 12); K.cyl(g, m.c(c2), 0.9, 0.9, 0.15, -1.3, 8.45, -1.3, 12);
        K.cyl(g, m.c("#c0c4dd", 0.4, 0.5), 0.08, 0.12, 5.6, 1.4, 0.25, -1.2, 8); K.blimp(g, 0.6, 5.6, -1.2, 2.8, c1); crown(8.6, 1.2, -1.3, -1.3);
      }
      break;
    case "casino":
      if (s === 0) { K.box(g, m.c(dark(c2, 0.2)), 1.6, 1.6, 1.2, 0, 0, -0.2); K.board(g, c1, 1.6, 0.4, 0, 1.6, 0.41); K.bulbs(g, 1.6, 0, 2.05, 0.42); K.bulbs(g, 1.6, 0, 1.55, 0.42); crown(2.1, 0.7, 0, -0.2); }
      else if (s === 1) {
        K.box(g, m.c("#2a1f4a"), 3.2, 2.4, 2.4, 0, 0, -0.5);
        for (const y of [0.05, 2.35]) K.box(g, m.sign(c2), 3.24, 0.08, 0.06, 0, y, 0.72); for (const x of [-1.6, 1.6]) K.box(g, m.sign(c2), 0.06, 2.4, 0.06, x, 0, 0.72);
        K.board(g, c1, 2.4, 0.5, 0, 1.6, 0.73); K.front(g, 2.6, 0, 0.71); crown(2.6, 1.0, 0, -0.5);
      } else if (s === 2) {
        K.tower(g, m.c("#fff1d0"), 4.2, 2.8, 2.8, 0, -0.5, 0); for (let k = 0; k < 6; k++) K.cyl(g, m.gold, 0.12, 0.14, 2.8, -1.8 + k * 0.72, 0, 1.1, 10);
        K.box(g, m.gold, 4.3, 0.25, 0.4, 0, 2.8, 1.05); K.cyl(g, m.c("#fff1d0"), 1.1, 1.1, 0.6, 0, 2.8, -0.5, 20); K.dome(g, m.gold, 1.15, 0, 3.4, -0.5);
        K.bulbs(g, 4.0, 0, 3.15, 1.3); crown(4.6, 1.2, 0, -0.5);
      } else if (s === 3) {
        K.box(g, m.c("#fff1d0"), 4.2, 1.8, 3.4, 0, 0, -0.2); K.bulbs(g, 4.2, 0, 1.85, 1.5);
        K.cyl(g, m.win, 1.3, 1.3, 7.0, 0, 1.8, -0.6, 20); for (let y = 2.6; y < 8.8; y += 1.2) K.cyl(g, m.gold, 1.33, 1.33, 0.1, 0, y, -0.6, 20);
        K.dome(g, m.gold, 1.3, 0, 8.8, -0.6, 0.5); K.cyl(g, m.c("#e6e1f2"), 0.6, 0.65, 0.3, 1.4, 0, 1.8, 16); crown(9.4, 1.3, 0, -0.6);
      } else {
        K.podium(g, 4.4, 4.2); K.box(g, m.c("#fff1d0"), 4.0, 1.8, 3.2, 0, 0.25, -0.2); K.bulbs(g, 4.0, 0, 2.1, 1.42);
        const goldGlass = m.c("#ffd23f", 0.15, 0.85);
        K.box(g, goldGlass, 2.6, 8.5, 2.6, 0, 2.05, -0.4); for (let y = 2.8; y < 10.5; y += 0.9) K.box(g, m.win, 2.64, 0.35, 2.64, 0, y, -0.4);
        K.cone(g, m.gold, 1.4, 1.6, 0, 10.55, -0.4, 4, PI / 4); crown(12.0, 2.2, 0, -0.4);
      }
      break;
    default: // spaceport
      if (s === 0) { K.cyl(g, m.c("#c0c4dd", 0.5), 1.2, 1.3, 0.2, 0, 0, -0.2, 20); K.rocket(g, 0, -0.2, 2.2, c2, 0.2); K.box(g, m.c("#ffffff"), 0.8, 0.6, 0.6, 1.4, 0, 1.2); }
      else if (s === 1) {
        K.cyl(g, m.c("#c0c4dd", 0.5), 1.5, 1.6, 0.25, 0, 0, -0.3, 20); K.rocket(g, -0.3, -0.3, 3.4, c2, 0.25);
        for (const dx of [0, 0.5]) for (const dz of [0, 0.5]) K.box(g, m.c("#ff8a3b"), 0.06, 3.6, 0.06, 0.8 + dx, 0, -0.9 + dz);
        for (let y = 0.6; y < 3.6; y += 0.6) K.box(g, m.c("#ff8a3b"), 0.56, 0.05, 0.56, 1.05, y, -0.65);
      } else if (s === 2) {
        K.tower(g, m.c("#ffffff"), 3.0, 2.2, 2.4, -0.5, 0.2, 0); K.cyl(g, m.c("#c0c4dd"), 0.1, 0.1, 1.0, -0.5, 2.2, 0.2, 8);
        const dish = K.dome(g, m.c("#ffffff", 0.4), 0.9, -0.5, 3.2, 0.2, 0.4); dish.rotation.x = PI * 0.75;
        K.cyl(g, m.c("#c0c4dd", 0.5), 0.8, 0.9, 0.2, 1.4, 0, -1.3, 16); K.rocket(g, 1.4, -1.3, 4.2, c2, 0.2);
      } else if (s === 3) {
        K.cyl(g, m.c("#e6e1f2"), 1.6, 1.7, 1.0, -0.6, 0, 0.3, 24); K.dome(g, m.win, 1.55, -0.6, 1.0, 0.3, 0.7);
        for (const [x, z, h] of [[1.4, -1.3, 5.0], [1.8, 0.8, 3.6]] as const) { K.cyl(g, m.c("#c0c4dd", 0.5), 0.6, 0.7, 0.2, x, 0, z, 16); K.rocket(g, x, z, h, c2, 0.2); }
        crown(2.2, 1.0, -0.6, 0.3);
      } else {
        K.podium(g, 4.4, 4.2); K.torus(g, m.c("#c0c4dd", 0.3, 0.6), 2.0, 0.28, -0.4, 2.6, 0.2, PI * 2, 0, 0);
        const ring = K.torus(g, m.sign(c1), 1.72, 0.08, -0.4, 2.6, 0.2, PI * 2, 0, 0); ring.userData.glow = true;
        for (const x of [-2.1, 1.3]) K.box(g, m.c("#c0c4dd", 0.4, 0.5), 0.4, 0.8, 0.6, x, 0.25, 0.2);
        K.cyl(g, m.c("#c0c4dd", 0.5), 0.8, 0.9, 0.2, 1.4, 0.25, -1.4, 16); K.rocket(g, 1.4, -1.4, 9.0, c2, 0.45);
      }
  }
}

/** The Coffee Cart's café terrace, in front of whatever stage it's at (local +z is the
 *  street). `state` 1: ready to open (wrapped up, chairs stacked, a sign); 2: open (a
 *  wooden deck under an awning, tables with umbrellas, customers). `lights`: the café
 *  contract is done (string lights, flower boxes, a gold star sign). */
export function buildTerrace(g: G, state: 1 | 2, lights: boolean, m: ModelMats): void {
  const K = kit(m);
  const wood = m.c("#c8925a", 0.75), dark = m.c("#3a2f5a"), red = "#e0743a";
  const z0 = 1.5;
  K.box(g, wood, 4.1, 0.08, 1.05, 0, 0.02, z0 + 0.1);
  if (state === 1) {
    // Wrapped up, waiting to open: stacked chairs, a ribbon across, an "opening" sign.
    for (const x of [-1.2, 1.2]) for (let k = 0; k < 3; k++) K.box(g, m.c("#ffffff", 0.6), 0.34, 0.08, 0.34, x, 0.12 + k * 0.1, z0);
    for (const x of [-2.0, 2.0]) K.box(g, dark, 0.06, 0.7, 0.06, x, 0, z0 + 0.5);
    K.box(g, m.sign("#ff4f8b"), 4.0, 0.08, 0.03, 0, 0.55, z0 + 0.5);
    K.box(g, dark, 0.06, 1.0, 0.06, 0, 0, z0 + 0.45);
    K.board(g, "#ffc93c", 1.0, 0.45, 0, 1.0, z0 + 0.5);
    return;
  }
  // Open: an awning on posts across the front, three tables with umbrellas and customers.
  // (The awning covers the two tables on the right; the first table, the neighbor's, stays
  // open to the sky so the camera sees them sit down.)
  for (const x of [-0.6, 1.95]) K.box(g, dark, 0.07, 1.25, 0.07, x, 0, z0 + 0.6);
  K.awning(g, 2.65, 0.67, 1.3, z0 + 0.05, red, "#ffffff", 0.6);
  // Three tables. The first one's seats are the two chairs that stood folded by the cart
  // (they're placed, and unfold, with the people: see block.ts); customers sit on the rest.
  [-1.35, 0, 1.35].forEach((x, i) => {
    if (i === 0) { K.cyl(g, m.c("#ffffff"), 0.28, 0.28, 0.05, x, 0.42, z0 + 0.15, 12); K.cyl(g, m.c("#4a4f7a"), 0.03, 0.05, 0.42, x, 0, z0 + 0.15, 6); }
    else K.table(g, x, z0 + 0.15, "#ffffff");
    if (i === 2) K.umbrella(g, x, z0 + 0.15, "#ff4f8b", 1.15, 0.45);
  });
  if (lights) {
    // The contract's reward: string lights, flower boxes and a gold star over the café.
    for (let k = 0; k < 11; k++) {
      const x = -1.95 + k * 0.39, sag = Math.sin((k / 10) * Math.PI) * 0.12;
      K.sph(g, m.bulb, 0.05, x, 1.42 - sag, z0 + 0.62);
    }
    K.flowers(g, -1.3, z0 + 0.62, 1.1, undefined, 0.02);
    K.flowers(g, 1.3, z0 + 0.62, 1.1, undefined, 0.02);
    K.cone(g, m.gold, 0.22, 0.12, 0, 1.6, z0 + 0.6, 5, Math.PI / 2);
    K.board(g, "#ffc93c", 0.9, 0.3, 0, 1.36, z0 + 0.66);
  }
}

/** The street front of a business's lot, so it looks lived in: flower planters at the front
 *  corners, an A-frame sign in its colors on the sidewalk, a bike rack, little bollards; a
 *  bigger business adds a lantern either side of the door. */
export function buildStreetFront(g: G, c1: string, c2: string, stage: number, m: ModelMats): void {
  const K = kit(m);
  const stone = m.c("#d9d2e6", 0.6), metal = m.c("#4a4f7a", 0.5, 0.4);
  for (const x of [-1.85, 1.85]) {
    K.box(g, stone, 0.42, 0.24, 0.42, x, 0, 1.85);
    K.bush(g, x, 1.85, 0.9);
    K.sph(g, m.c(x < 0 ? "#ff6fa0" : "#ffe27a", 0.8), 0.07, x - 0.1, 0.42, 1.95);
    K.sph(g, m.c("#b48cff", 0.8), 0.06, x + 0.1, 0.44, 1.9);
  }
  // The A-frame sign (two leaning boards in the business's colors).
  const sign = m.sign(c2);
  K.box(g, sign, 0.34, 0.42, 0.03, -1.2, 0.02, 2.0).rotation.x = 0.22;
  K.box(g, m.c(c1, 0.6), 0.34, 0.42, 0.03, -1.2, 0.02, 1.86).rotation.x = -0.22;
  // A bike rack with one bike, and bollards along the curb.
  K.box(g, metal, 0.6, 0.04, 0.04, 1.15, 0.28, 2.0);
  for (const x of [0.88, 1.42]) K.box(g, metal, 0.04, 0.3, 0.04, x, 0, 2.0);
  const bike = m.c(c2, 0.5);
  K.torus(g, m.c("#2a2f4a", 0.6), 0.11, 0.02, 0.98, 0.13, 2.08);
  K.torus(g, m.c("#2a2f4a", 0.6), 0.11, 0.02, 1.3, 0.13, 2.08);
  K.box(g, bike, 0.34, 0.03, 0.03, 1.14, 0.22, 2.08);
  for (const x of [-0.6, 0, 0.6]) K.cyl(g, stone, 0.05, 0.06, 0.26, x, 0, 2.08, 8);
  if (stage >= 2) for (const x of [-0.75, 0.75]) { K.cyl(g, metal, 0.025, 0.03, 0.9, x, 0, 1.55, 6); K.sph(g, m.bulb, 0.08, x, 0.95, 1.55); }
}

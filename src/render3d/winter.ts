// Winter Lights in the town (data/season.ts): a holiday tree with colored bulbs and a star,
// and strings of bulbs on the street lamps. The bulbs twinkle, brighter after dark.
import * as THREE from "three";

const BULBS = ["#ff4d4d", "#ffd23a", "#4fd1ff", "#5ee07a", "#ff8ad8", "#ffffff"];

/** Bulbs in two sets that take turns twinkling. */
class Bulbs {
  readonly mats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff }));
  private pts: [THREE.Vector3, string][][] = [[], []];
  constructor(private colors = BULBS) {}
  add(p: THREE.Vector3, k: number): void { this.pts[k % 2].push([p.clone(), this.colors[k % this.colors.length]]); }
  build(g: THREE.Object3D, r: number): void {
    const geo = new THREE.SphereGeometry(r, 6, 4), m4 = new THREE.Matrix4(), c = new THREE.Color();
    this.pts.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, this.mats[k], list.length);
      list.forEach(([p, col], i) => { im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); im.setColorAt(i, c.set(col)); });
      im.userData.dynamic = true;
      im.frustumCulled = false;
      g.add(im);
    });
  }
  tick(t: number, night: number): void {
    // By day the bulbs are just colored beads; at night they glow and take turns.
    this.mats.forEach((m, k) => m.color.setScalar(0.7 + night * (0.5 + 0.5 * Math.max(0, Math.sin(t * 2.2 + k * Math.PI)))));
  }
}

/** A holiday tree `h` tall standing at (x, z), its bottom at y. Returns its twinkle. */
export function holidayTree(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: <T extends THREE.Material>(m: T) => T): (t: number, night: number) => void {
  const leaf = own(new THREE.MeshStandardMaterial({ color: "#1d6b3c", roughness: 0.85, flatShading: true }));
  const trunk = own(new THREE.MeshStandardMaterial({ color: "#6b4528", roughness: 0.9 }));
  const star = own(new THREE.MeshStandardMaterial({ color: "#ffd75a", emissive: 0xffc23a, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 }));
  star.userData.dynamic = true;
  const tg = new THREE.Group();
  tg.position.set(x, y, z);
  tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.05, h * 0.06, h * 0.16, 8).translate(0, h * 0.08, 0), trunk));
  // A pot of red under it, like a skirt of presents.
  const red = own(new THREE.MeshStandardMaterial({ color: "#c8323a", roughness: 0.6 }));
  tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.13, h * 0.15, h * 0.08, 10).translate(0, h * 0.04, 0), red));
  const tiers = [[0.36, 0.42, 0.12], [0.29, 0.36, 0.36], [0.21, 0.3, 0.58], [0.12, 0.24, 0.78]];
  for (const [r, th, y0] of tiers) tg.add(new THREE.Mesh(new THREE.ConeGeometry(h * r, h * th, 9).translate(0, h * (y0 + th / 2), 0), leaf));
  const st = new THREE.Mesh(new THREE.OctahedronGeometry(h * 0.06, 0).translate(0, h * 1.05, 0), star);
  tg.add(st);
  // Bulbs in a spiral down the tree.
  const b = new Bulbs(), n = 46;
  for (let i = 0; i < n; i++) {
    const f = i / n, yy = h * (0.15 + f * 0.82), r = h * 0.36 * (1 - f * 0.92) + h * 0.02, a = f * Math.PI * 9;
    b.add(new THREE.Vector3(Math.cos(a) * r, yy, Math.sin(a) * r), i);
  }
  b.build(tg, h * 0.022);
  // A few presents round the foot.
  const wrap = ["#4f8bff", "#ffd23a", "#5ee07a", "#ff6b9a"].map(c => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })));
  [[0.3, 0.1], [-0.26, 0.18], [0.12, -0.3], [-0.2, -0.22]].forEach(([px, pz], k) => {
    const s = h * (0.07 + (k % 2) * 0.03);
    tg.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s).rotateY(k).translate(px * h, s / 2, pz * h), wrap[k]));
  });
  g.add(tg);
  return (t, night) => { b.tick(t, night); st.rotation.y = t * 0.6; star.emissiveIntensity = 0.6 + night * 1.6; };
}

/** Strings of bulbs: a ring round the top of each street lamp, and a sagging string from one
 *  lamp to the next where two stand close in a row. Returns their twinkle. */
export function lampLights(g: THREE.Object3D, lamps: THREE.Vector3[], colors = BULBS): (t: number, night: number) => void {
  const b = new Bulbs(colors);
  let k = 0;
  for (const p of lamps) {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.add(new THREE.Vector3(p.x + Math.cos(a) * 0.16, p.y - 0.18, p.z + Math.sin(a) * 0.16), k++); }
  }
  // (Each lamp joins its nearest neighbor in a row, if it's close enough to string.)
  const done = new Set<string>();
  lamps.forEach((p, i) => {
    let best = -1, bd = 1e9;
    lamps.forEach((q, j) => { if (j === i) return; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd && Math.abs(p.y - q.y) < 0.3) { bd = d; best = j; } });
    if (best < 0 || bd > 3.6 || bd < 0.8) return;
    const key = i < best ? `${i}-${best}` : `${best}-${i}`;
    if (done.has(key)) return;
    done.add(key);
    const q = lamps[best], steps = Math.max(5, Math.round(bd / 0.28));
    for (let s = 1; s < steps; s++) {
      const f = s / steps, sag = Math.sin(Math.PI * f) * 0.32;
      b.add(new THREE.Vector3(p.x + (q.x - p.x) * f, p.y - 0.1 - sag, p.z + (q.z - p.z) * f), k++);
    }
  });
  b.build(g, 0.035);
  return (t, night) => b.tick(t, night);
}

type Own = <T extends THREE.Material>(m: T) => T;
const std = (own: Own, c: string, o: THREE.MeshStandardMaterialParameters = {}) => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }));

/** Spring: a blossom tree, a round pink crown on a dark trunk, with flower pots round it. */
export function blossomTree(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: Own): void {
  const tg = new THREE.Group(); tg.position.set(x, y, z);
  tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.05, h * 0.07, h * 0.5, 8).translate(0, h * 0.25, 0), std(own, "#6b4528", { roughness: 0.9 })));
  const pink = [std(own, "#ffb3d1", { flatShading: true }), std(own, "#ff8fbf", { flatShading: true }), std(own, "#ffd6e8", { flatShading: true })];
  [[0, 0.62, 0, 0.32], [-0.2, 0.55, 0.12, 0.22], [0.22, 0.58, -0.08, 0.24], [0.05, 0.8, 0.1, 0.2]].forEach(([px, py, pz, r], i) =>
    tg.add(new THREE.Mesh(new THREE.IcosahedronGeometry(h * r, 1).translate(px * h, py * h, pz * h), pink[i % 3])));
  const pot = std(own, "#c8643a"), fl = ["#ffd23a", "#ff5f8f", "#b48cff", "#ffffff"].map(c => std(own, c));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.6, px = Math.cos(a) * h * 0.42, pz = Math.sin(a) * h * 0.42;
    tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.07, h * 0.055, h * 0.09, 8).translate(px, h * 0.045, pz), pot));
    tg.add(new THREE.Mesh(new THREE.SphereGeometry(h * 0.06, 6, 4).translate(px, h * 0.11, pz), fl[i]));
  }
  g.add(tg);
}

/** Spring's prize: an arch of blossom. */
export function blossomArch(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: Own): void {
  const tg = new THREE.Group(); tg.position.set(x, y, z);
  const white = std(own, "#ffffff", { roughness: 0.5 }), pink = [std(own, "#ffb3d1", { flatShading: true }), std(own, "#ff8fbf", { flatShading: true })];
  for (const sx of [-1, 1]) tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.04, h * 0.05, h * 0.7, 8).translate(sx * h * 0.35, h * 0.35, 0), white));
  tg.add(new THREE.Mesh(new THREE.TorusGeometry(h * 0.35, h * 0.04, 6, 16, Math.PI).translate(0, h * 0.7, 0), white));
  for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10, r = h * 0.35; tg.add(new THREE.Mesh(new THREE.IcosahedronGeometry(h * (0.08 + (i % 3) * 0.02), 0).translate(Math.cos(a) * r, h * 0.7 + Math.sin(a) * r, 0), pink[i % 2])); }
  g.add(tg);
}

/** Summer: a striped bandstand with a little band (the prize), or festival umbrellas. */
export function bandstand(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: Own): (t: number) => void {
  const tg = new THREE.Group(); tg.position.set(x, y, z);
  const white = std(own, "#ffffff", { roughness: 0.5 }), red = std(own, "#ff4d5a"), blue = std(own, "#4f8bff");
  tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.48, h * 0.5, h * 0.12, 8).translate(0, h * 0.06, 0), white));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; tg.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.02, h * 0.02, h * 0.5, 6).translate(Math.cos(a) * h * 0.44, h * 0.37, Math.sin(a) * h * 0.44), white)); }
  for (let i = 0; i < 8; i++) { const cone = new THREE.ConeGeometry(h * 0.56, h * 0.3, 8, 1, true, i * Math.PI / 4, Math.PI / 4).translate(0, h * 0.77, 0); tg.add(new THREE.Mesh(cone, i % 2 ? red : white)); }
  const players: THREE.Mesh[] = [];
  const shirt = [red, blue, std(own, "#ffd23a")];
  for (let i = 0; i < 3; i++) { const a = i * 2.1; const p = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.04, h * 0.1, 3, 6).translate(0, h * 0.2, 0), shirt[i]); p.position.set(Math.cos(a) * h * 0.2, 0, Math.sin(a) * h * 0.2); tg.add(p); players.push(p); }
  g.add(tg);
  return t => players.forEach((p, i) => { p.position.y = Math.abs(Math.sin(t * 4 + i)) * h * 0.03; });
}
export function festivalUmbrellas(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: Own): void {
  const cols = ["#ff4d5a", "#ffd23a", "#4fd1ff"].map(c => std(own, c)), pole = std(own, "#ffffff");
  [[-0.5, -0.3], [0.45, -0.35], [0, 0.45]].forEach(([px, pz], i) => {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.02, h * 0.02, h * 0.6, 6).translate(x + px * h, y + h * 0.3, z + pz * h), pole));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h * 0.16, 10).translate(x + px * h, y + h * 0.64, z + pz * h), cols[i]));
  });
}

/** Halloween: pumpkins with glowing faces (the prize is one giant one). */
export function pumpkins(g: THREE.Object3D, x: number, y: number, z: number, h: number, own: Own, n = 5): (t: number, night: number) => void {
  const orange = std(own, "#ff8a1f", { roughness: 0.6 }), stem = std(own, "#3a6b2a");
  const glow = own(new THREE.MeshStandardMaterial({ color: "#ffd27a", emissive: 0xffa020, emissiveIntensity: 1 }));
  glow.userData.dynamic = true;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = n === 1 ? 0 : h * 0.35 * (0.5 + (i % 3) * 0.25), s = n === 1 ? h * 0.5 : h * (0.13 + (i % 3) * 0.04);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8).scale(1.2, 0.85, 1.2).translate(px, y + s * 0.85, pz), orange));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.08, s * 0.12, s * 0.35, 5).translate(px, y + s * 1.8, pz), stem));
    // A carved face, glowing (faces outward toward the street).
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.18, s * 0.05).translate(px, y + s * 0.65, pz + s * 1.15), glow));
    for (const ex of [-0.25, 0.25]) g.add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.2, 3).translate(px + ex * s, y + s * 1.0, pz + s * 1.12), glow));
  }
  return (t, night) => { glow.emissiveIntensity = 0.3 + night * (1.4 + 0.3 * Math.sin(t * 6)); };
}

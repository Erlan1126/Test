// Winter Lights in the town (data/season.ts): a holiday tree with colored bulbs and a star,
// and strings of bulbs on the street lamps. The bulbs twinkle, brighter after dark.
import * as THREE from "three";

const BULBS = ["#ff4d4d", "#ffd23a", "#4fd1ff", "#5ee07a", "#ff8ad8", "#ffffff"];

/** Bulbs in two sets that take turns twinkling. */
class Bulbs {
  readonly mats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff }));
  private pts: [THREE.Vector3, string][][] = [[], []];
  add(p: THREE.Vector3, k: number): void { this.pts[k % 2].push([p.clone(), BULBS[k % BULBS.length]]); }
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
export function lampLights(g: THREE.Object3D, lamps: THREE.Vector3[]): (t: number, night: number) => void {
  const b = new Bulbs();
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

// The decorations the player places on lots (logic/placedecor.ts), drawn in code on a lot
// (4 × 4, front facing +z). The Grand Stadium is a model made in Blender (kit "bl_stadium").
import * as THREE from "three";

export interface PlaceKit {
  c: (color: string, rough?: number, metal?: number) => THREE.Material;
  slab: () => THREE.BufferGeometry;
  grass: THREE.Material;
  pave: THREE.Material;
  stone: THREE.Material;
  wood: THREE.Material;
  water: THREE.Material;
  /** A tree mesh at (x, z), `s` tall-ish. */
  tree: (x: number, z: number, s: number, seed: number) => THREE.Object3D;
  /** A kit model scaled to `w` across, or null if the kit isn't loaded. */
  kit: (name: string, w: number) => { obj: THREE.Object3D; h: number } | null;
  /** Runs `f` every frame (a ferris wheel turning, a lamp blinking). */
  tick: (f: (t: number, night: number) => void) => void;
}

const FLOWERS = ["#ff5f8f", "#ffd23a", "#ff8a3c", "#b48cff", "#ffffff", "#ff4d4d"];

/** Builds decoration `id` into G. Returns how tall it stands (for its bubble). */
export function buildPlaced(G: THREE.Group, id: string, k: PlaceKit, seed: number): number {
  const T = (geo: THREE.BufferGeometry, m: THREE.Material) => { G.add(new THREE.Mesh(geo, m)); };
  const flowerBed = (x: number, z: number, w: number, d: number, n: number) => {
    T(new THREE.BoxGeometry(w, 0.12, d).translate(x, 0.12, z), k.c("#7a5a3a", 0.95));
    for (let i = 0; i < n; i++) {
      const fx = x - w / 2 + 0.12 + ((i * 0.37) % (w - 0.24)), fz = z - d / 2 + 0.1 + ((i * 0.61) % (d - 0.2));
      T(new THREE.SphereGeometry(0.075, 6, 4).translate(fx, 0.24, fz), k.c(FLOWERS[(i + seed) % FLOWERS.length], 0.7));
    }
  };
  switch (id) {
    case "pocketpark": {
      T(k.slab(), k.grass);
      T(new THREE.BoxGeometry(0.7, 0.04, 4.0).translate(0, 0.08, 0), k.pave);
      G.add(k.tree(-1.2, -1.1, 1.0, seed), k.tree(1.3, -1.3, 0.85, seed + 3), k.tree(1.2, 1.2, 0.9, seed + 5));
      T(new THREE.BoxGeometry(0.9, 0.08, 0.28).translate(-1.1, 0.36, 0.9), k.wood);
      for (const x of [-1.5, -0.7]) T(new THREE.BoxGeometry(0.06, 0.32, 0.24).translate(x, 0.2, 0.9), k.c("#3a3f4a", 0.5, 0.5));
      flowerBed(-1.2, 1.6, 1.4, 0.5, 10);
      return 2.0;
    }
    case "fountain": {
      T(k.slab(), k.grass);
      T(new THREE.CylinderGeometry(1.8, 1.8, 0.06, 32).translate(0, 0.09, 0), k.pave);
      T(new THREE.CylinderGeometry(1.0, 1.08, 0.36, 28).translate(0, 0.24, 0), k.stone);
      T(new THREE.CylinderGeometry(0.88, 0.88, 0.38, 28).translate(0, 0.26, 0), k.water);
      T(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 10).translate(0, 0.75, 0), k.stone);
      T(new THREE.CylinderGeometry(0.46, 0.3, 0.12, 18).translate(0, 1.2, 0), k.stone);
      T(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 18).translate(0, 1.27, 0), k.water);
      T(new THREE.ConeGeometry(0.16, 0.5, 10).translate(0, 1.55, 0), k.c("#cff0ff", 0.1));
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; G.add(k.tree(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.6, seed + i)); }
      return 1.9;
    }
    case "garden": {
      T(k.slab(), k.grass);
      for (let r = 0; r < 4; r++) flowerBed(-0.55, -1.35 + r * 0.9, 2.4, 0.42, 14);
      // A little glasshouse at the side.
      T(new THREE.BoxGeometry(1.0, 0.7, 1.4).translate(1.4, 0.43, 0), k.c("#cfeeff", 0.1, 0.1));
      const roof = new THREE.CylinderGeometry(0.72, 0.72, 1.42, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.5, 1).translate(1.4, 0.95, 0);
      T(roof, k.c("#e6f6ff", 0.1, 0.1));
      T(new THREE.BoxGeometry(1.04, 0.05, 1.44).translate(1.4, 0.79, 0), k.c("#ffffff", 0.5));
      return 1.4;
    }
    case "statue": {
      T(k.slab(), k.grass);
      T(new THREE.BoxGeometry(2.6, 0.06, 2.6).translate(0, 0.09, 0), k.pave);
      T(new THREE.BoxGeometry(1.0, 0.7, 1.0).translate(0, 0.47, 0), k.stone);
      T(new THREE.BoxGeometry(1.15, 0.1, 1.15).translate(0, 0.86, 0), k.stone);
      const bronze = k.c("#a8743a", 0.35, 0.8);
      T(new THREE.CapsuleGeometry(0.2, 0.62, 4, 10).translate(0, 1.42, 0), bronze);
      T(new THREE.SphereGeometry(0.17, 12, 10).translate(0, 2.0, 0), bronze);
      T(new THREE.CapsuleGeometry(0.06, 0.5, 3, 6).rotateZ(-0.6).translate(0.32, 1.92, 0), bronze);
      T(new THREE.CapsuleGeometry(0.06, 0.42, 3, 6).rotateZ(0.25).translate(-0.27, 1.38, 0), bronze);
      T(new THREE.ConeGeometry(0.1, 0.22, 8).translate(0.5, 2.3, 0), k.c("#ffcf3a", 0.3, 0.8));
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) G.add(k.tree(x, z, 0.55, seed + x * 3 + z));
      return 2.6;
    }
    case "market": {
      T(k.slab(), k.pave);
      const cols = [["#ff6b5a", "#ffffff"], ["#4f8bff", "#ffffff"], ["#5ee0a0", "#fff3c0"], ["#ffd23a", "#ff8a3c"]];
      [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]].forEach(([x, z], i) => {
        T(new THREE.BoxGeometry(1.2, 0.5, 0.7).translate(x, 0.31, z), k.wood);
        for (const px of [-0.55, 0.55]) for (const pz of [-0.32, 0.32]) T(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5).translate(x + px, 0.56, z + pz), k.c("#ffffff", 0.6));
        // A striped awning.
        for (let st = 0; st < 4; st++) T(new THREE.BoxGeometry(0.31, 0.05, 0.86).translate(x - 0.47 + st * 0.31, 1.08, z), k.c(cols[i][st % 2], 0.6));
        for (let f = 0; f < 5; f++) T(new THREE.SphereGeometry(0.08, 6, 4).translate(x - 0.4 + f * 0.2, 0.62, z + 0.18), k.c(FLOWERS[(f + i) % FLOWERS.length], 0.7));
      });
      return 1.4;
    }
    case "clocktower": {
      T(k.slab(), k.grass);
      const m = k.kit("bl_clocktower", 4.0);
      if (m) { m.obj.position.y = 0.06; G.add(m.obj); return m.h + 0.2; }
      T(new THREE.BoxGeometry(1.2, 4.0, 1.2).translate(0, 2.06, 0), k.stone);
      T(new THREE.ConeGeometry(1.0, 1.4, 4).rotateY(Math.PI / 4).translate(0, 4.76, 0), k.c("#4a5570", 0.6));
      return 5.6;
    }
    case "lighthouse": {
      T(k.slab(), k.grass);
      const m = k.kit("bl_lighthouse", 4.2);
      if (m) { m.obj.position.y = 0.06; G.add(m.obj); return m.h + 0.2; }
      T(new THREE.CylinderGeometry(0.45, 0.7, 3.2, 16).translate(0, 1.66, 0), k.c("#ffffff", 0.6));
      T(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16).translate(0, 3.5, 0), k.c("#e2463a", 0.6));
      return 4.0;
    }
    case "ferris": {
      T(k.slab(), k.grass);
      const base = k.kit("bl_ferris_base", 4.2), wheel = k.kit("bl_ferris_wheel", 4.2 * 0.8856);
      if (base && wheel) {
        base.obj.position.y = 0.06; G.add(base.obj);
        // (The wheel turns round its hub: its own origin is the hub.)
        const inner = wheel.obj.children[0];
        inner.position.y -= wheel.h / 2;
        wheel.obj.position.set(0, 0.06 + 0.519 * 4.2, 0);
        G.add(wheel.obj);
        k.tick(t => { wheel.obj.rotation.z = t * 0.12; });
        return 0.06 + 0.519 * 4.2 + wheel.h / 2 + 0.2;
      }
      const ring = new THREE.TorusGeometry(1.6, 0.08, 8, 32).translate(0, 2.0, 0);
      T(ring, k.c("#4f8bff", 0.5, 0.3));
      return 3.8;
    }
    case "gingerbread": {
      // The Advent calendar's prize: a gingerbread house in the snow, icing on its roof,
      // gumdrops on the ridge, candy canes by the door and a snowman out front.
      const snow = k.c("#f6f9ff", 0.85), icing = k.c("#ffffff", 0.5), ginger = k.c("#b8662c", 0.8), dark = k.c("#7a3d16", 0.85);
      const red = k.c("#e8344a", 0.5), glow = k.c("#ffd77a", 0.4);
      T(k.slab(), snow);
      // (Gingerbread biscuit stepping stones up to the door.)
      for (let i = 0; i < 3; i++) T(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12).translate(((i % 2) - 0.5) * 0.12, 0.09, 1.05 + i * 0.38), ginger);
      const W = 2.0, D = 1.6, H = 1.2, base = 0.06, top = base + H, a = 0.62, L = 0.68;
      T(new THREE.BoxGeometry(W, H, D).translate(0, base + H / 2, 0), ginger);
      // The gable faces the street; the roof is two slabs of gingerbread under thick snow,
      // its ridge running front to back.
      const gh = Math.tan(a) * W / 2, ridge = top + gh + 0.05, RD = D + 0.36;
      const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, gh)]);
      T(new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false }).translate(0, top, -D / 2), ginger);
      for (const s of [-1, 1]) {
        const cx = s * Math.cos(a) * L, cy = ridge - Math.sin(a) * L;
        T(new THREE.BoxGeometry(L * 2, 0.1, RD).rotateZ(-s * a).translate(cx, cy, 0), dark);
        // (The snow stops short of the eave, so a brown edge of gingerbread shows under the icing.)
        const sl = L - 0.14;
        T(new THREE.BoxGeometry(sl * 2, 0.09, RD - 0.12).rotateZ(-s * a).translate(s * Math.cos(a) * sl - s * 0.05, ridge - Math.sin(a) * sl + 0.08, 0), snow);
        // Icing drips along the eave, and along the front edge of the roof.
        const ex = s * (Math.cos(a) * L * 2 - 0.02), ey = ridge - Math.sin(a) * L * 2 + 0.03;
        for (let i = 0; i < 8; i++) T(new THREE.SphereGeometry(0.075, 8, 6).scale(1, 1.4, 1).translate(ex, ey, -RD / 2 + 0.06 + i * ((RD - 0.12) / 7)), icing);
        for (let i = 1; i < 6; i++) { const f = i / 6; T(new THREE.SphereGeometry(0.07, 8, 6).translate(s * Math.cos(a) * L * 2 * f, ridge + 0.02 - Math.sin(a) * L * 2 * f, RD / 2 + 0.02), icing); }
      }
      // Gumdrops along the ridge.
      const drops = ["#ff4d6a", "#5ee07a", "#ffd23a", "#4fb4ff", "#ff8ad8"];
      for (let i = 0; i < 5; i++) T(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, ridge + 0.1, -0.76 + i * 0.38), k.c(drops[(i + seed) % drops.length], 0.35));
      // A round window in the gable, iced, and a chimney with a snow cap.
      const gz = D / 2 + 0.02;
      T(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16).rotateX(Math.PI / 2).translate(0, top + gh * 0.42, gz), k.c("#ffd77a", 0.4));
      T(new THREE.TorusGeometry(0.18, 0.04, 6, 18).translate(0, top + gh * 0.42, gz + 0.01), k.c("#ffffff", 0.5));
      T(new THREE.BoxGeometry(0.3, 0.75, 0.3).translate(0.55, ridge - 0.1, -0.35), ginger);
      T(new THREE.BoxGeometry(0.38, 0.09, 0.38).translate(0.55, ridge + 0.3, -0.35), snow);
      // Icing lines round the walls, the front door and two warm windows with icing crosses.
      for (const z of [-D / 2 - 0.01, D / 2 + 0.01]) T(new THREE.BoxGeometry(W + 0.04, 0.06, 0.04).translate(0, top - 0.03, z), icing);
      for (const z of [-D / 2 - 0.01, D / 2 + 0.01]) T(new THREE.BoxGeometry(W + 0.04, 0.06, 0.04).translate(0, base + 0.2, z), icing);
      const fz = D / 2 + 0.02;
      T(new THREE.BoxGeometry(0.44, 0.7, 0.04).translate(0, base + 0.35, fz), dark);
      T(new THREE.TorusGeometry(0.22, 0.035, 6, 14, Math.PI).translate(0, base + 0.7, fz + 0.01), icing);
      for (const x of [-0.22, 0.22]) T(new THREE.BoxGeometry(0.05, 0.7, 0.05).translate(x, base + 0.35, fz + 0.01), icing);
      T(new THREE.SphereGeometry(0.035, 6, 4).translate(0.12, base + 0.36, fz + 0.03), k.c("#ffd23a", 0.3, 0.6));
      for (const x of [-0.65, 0.65]) {
        T(new THREE.BoxGeometry(0.38, 0.38, 0.04).translate(x, base + 0.72, fz), glow);
        T(new THREE.BoxGeometry(0.44, 0.05, 0.05).translate(x, base + 0.72, fz + 0.01), icing);
        T(new THREE.BoxGeometry(0.05, 0.44, 0.05).translate(x, base + 0.72, fz + 0.01), icing);
        T(new THREE.BoxGeometry(0.5, 0.07, 0.12).translate(x, base + 0.5, fz + 0.04), icing);
      }
      // Candy-cane corners: red and white bands up each front corner.
      for (const x of [-W / 2, W / 2]) for (let b = 0; b < 6; b++) T(new THREE.CylinderGeometry(0.07, 0.07, H / 6, 8).translate(x, base + H / 12 + (b * H) / 6, fz - 0.02), b % 2 ? icing : red);
      // Two candy canes either side of the path.
      for (const s of [-1, 1]) {
        const cx = s * 0.5, cz = 1.35;
        for (let b = 0; b < 5; b++) T(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8).translate(cx, base + 0.06 + b * 0.12, cz), b % 2 ? icing : red);
        T(new THREE.TorusGeometry(0.1, 0.045, 6, 10, Math.PI).rotateY(s > 0 ? 0 : Math.PI).translate(cx - s * 0.1, base + 0.6, cz), red);
      }
      // A snowman by the front corner.
      T(new THREE.SphereGeometry(0.26, 14, 10).translate(1.4, base + 0.24, 1.25), snow);
      T(new THREE.SphereGeometry(0.18, 14, 10).translate(1.4, base + 0.6, 1.25), snow);
      T(new THREE.ConeGeometry(0.035, 0.16, 6).rotateX(Math.PI / 2).translate(1.4, base + 0.62, 1.47), k.c("#ff8a2b", 0.5));
      T(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10).translate(1.4, base + 0.76, 1.25), dark);
      T(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10).translate(1.4, base + 0.86, 1.25), dark);
      // Snowy firs behind.
      G.add(k.tree(-1.5, -1.45, 0.7, seed), k.tree(1.55, -1.4, 0.6, seed + 2));
      for (const [x, z, r] of [[-1.5, 1.3, 0.22], [-1.7, 0.6, 0.15], [1.7, 0.4, 0.17]]) T(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, base, z), snow);
      return ridge + 0.5;
    }
    case "airport": {
      T(k.slab(), k.pave);
      const m = k.kit("bl_airport", 4.3);
      if (m) { m.obj.position.y = 0.06; G.add(m.obj); return m.h + 0.2; }
      T(new THREE.BoxGeometry(2.6, 0.8, 1.2).translate(0, 0.46, -0.8), k.c("#e8eef5", 0.5));
      T(new THREE.BoxGeometry(4.0, 0.03, 0.8).translate(0, 0.08, 1.2), k.c("#3a3f4a", 0.9));
      return 1.4;
    }
    case "stadium": {
      T(k.slab(), k.grass);
      const m = k.kit("bl_stadium", 4.3);
      if (m) { m.obj.position.y = 0.06; G.add(m.obj); return m.h + 0.2; }
      // (Before the model kit has loaded: a simple oval bowl.)
      T(new THREE.CylinderGeometry(1.9, 1.9, 0.7, 32).scale(1, 1, 0.72).translate(0, 0.41, 0), k.c("#f4f2ee", 0.6));
      T(new THREE.CylinderGeometry(1.3, 1.3, 0.72, 32).scale(1, 1, 0.68).translate(0, 0.43, 0), k.c("#4caf50", 0.9));
      return 1.2;
    }
  }
  return 0.5;
}

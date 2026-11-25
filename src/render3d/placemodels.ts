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

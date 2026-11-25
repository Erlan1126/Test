// Little pictures of each building design for the collection book: drawn once each with
// their own small renderer, then kept as images.
import * as THREE from "three";
import { buildHouse, type HouseKit } from "./houses";

let gl: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();
const SIZE = 192;

function renderer(): THREE.WebGLRenderer | null {
  if (gl) return gl;
  try {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.setSize(SIZE, SIZE, false);
    gl.setPixelRatio(1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
  } catch { gl = null; }
  return gl;
}

/** A picture of design `i` of building level `level` (a data URL), or "" if it can't draw. */
export function houseThumb(level: number, i: number, dark = false): string {
  if (dark) {
    // A design not found yet: its silhouette only, a teaser of what's to come.
    const dk = `${level}:${i}:dark`, dh = cache.get(dk);
    if (dh) return dh;
    cache.delete(`${level}:${i}`);
    const src = houseThumb(level, i), r0 = renderer();
    if (!src || !r0) return "";
    const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
    const g = c.getContext("2d")!;
    g.drawImage(r0.domElement, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "rgba(60, 48, 120, 0.42)";
    g.fillRect(0, 0, SIZE, SIZE);
    const url = c.toDataURL("image/png");
    cache.set(dk, url);
    return url;
  }
  const key = `${level}:${i}`, hit = cache.get(key);
  if (hit) return hit;
  const r = renderer();
  if (!r) return "";
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab0, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const mats = new Map<string, THREE.Material>();
  const kit: HouseKit = {
    c: (c, rough = 0.7, metal = 0) => { const k = `${c}|${rough}|${metal}`; let m = mats.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); mats.set(k, m); } return m; },
    win: new THREE.MeshStandardMaterial({ color: "#9cc8ec", roughness: 0.15, metalness: 0.3, emissive: "#2a4a6a", emissiveIntensity: 0.3 }),
  };
  // (Standing at [x, 0] on the grid picks design (x + level * 5) mod 10: see houses.ts.)
  const g = new THREE.Group(), at: [number, number] = [(((i - level * 5) % 10) + 10) % 10, 0];
  buildHouse(g, 7 + i * 131 + level * 17, level, kit, 0, at);
  scene.add(g);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  // An isometric view like the town's, the building filling the picture.
  const span = Math.max(sz.x, sz.z) * 0.95 + sz.y * 0.75, cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 200);
  cam.position.set(c.x + 20, c.y + 16, c.z + 20);
  cam.lookAt(c);
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  for (const m of mats.values()) m.dispose();
  (kit.win as THREE.Material).dispose();
  cache.set(key, url);
  return url;
}

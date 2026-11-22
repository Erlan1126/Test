import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { KIT_GLB } from "./kitdata";

/** Artist-made 3D models (free CC0 packs, see kit/NOTICE.md), unpacked once at startup.
 *  Until they're ready (or if they can't load) the town builds its own shapes as before;
 *  once they are, `kitVersion()` changes and the town rebuilds with them. */
const models = new Map<string, { obj: THREE.Object3D; size: THREE.Vector3; min: THREE.Vector3 }>();
let version = 0, started = false;

/** Plain float vertices (the files are compressed), and lit materials throughout, so the
 *  models merge into the town's batched meshes and take its sun and shadows. */
function prep(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry;
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name] as THREE.BufferAttribute;
      if (a.array instanceof Float32Array && !a.normalized) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
      geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
    // (Some files carry no normals: give them crisp, flat-shaded ones.)
    if (!m.geometry.attributes.normal) { const flat = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; flat.computeVertexNormals(); m.geometry = flat; }
    const src = m.material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null };
    // (Colours painted per vertex become the material's own colour, their average: the town's
    // batching keeps one colour per material.)
    const col = (src.color ?? new THREE.Color(0xffffff)).clone(), vc = geo.attributes.color;
    if (vc && !src.map) {
      const avg = new THREE.Color(0, 0, 0);
      for (let i = 0; i < vc.count; i++) { avg.r += vc.getX(i); avg.g += vc.getY(i); avg.b += vc.getZ(i); }
      col.multiply(avg.multiplyScalar(1 / Math.max(1, vc.count)));
    }
    // (Unlit materials hold screen colours; lit, they'd wash out. Leaves take the town's green.)
    if ((src as THREE.MeshBasicMaterial).isMeshBasicMaterial) col.convertSRGBToLinear();
    if (/leaf/i.test(src.name)) col.set("#4fa04a");
    const mat = new THREE.MeshStandardMaterial({ color: col, map: src.map ?? null, roughness: 0.75, metalness: 0 });
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    m.material = mat;
    m.castShadow = true; m.receiveShadow = true;
  });
}

function start(): void {
  started = true;
  if (typeof atob !== "function" || typeof WebAssembly === "undefined") return;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const jobs = Object.entries(KIT_GLB).map(([name, b64]) => new Promise<void>(res => {
    try {
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, "", gl => {
        prep(gl.scene);
        gl.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gl.scene);
        models.set(name, { obj: gl.scene, size: box.getSize(new THREE.Vector3()), min: box.min.clone() });
        res();
      }, () => res());
    } catch { res(); }
  }));
  void Promise.all(jobs).then(() => { if (models.size) version = 1; });
}

/** Changes once the models are ready (part of the town's rebuild key). */
export function kitVersion(): number {
  if (!started) start();
  return version;
}

/** A copy of a model scaled so its footprint is `width` across, standing on y = 0 and centred,
 *  stretched `tall` times in height; with its height. Null until the models are ready. */
export function kitPlace(name: string, width: number, tall = 1): { obj: THREE.Object3D; h: number } | null {
  if (!version) return null;
  const m = models.get(name);
  if (!m) return null;
  const s = width / Math.max(m.size.x, m.size.z, 1e-3);
  const inner = m.obj.clone(true);
  inner.position.set(-(m.min.x + m.size.x / 2) * s, -m.min.y * s * tall, -(m.min.z + m.size.z / 2) * s);
  inner.scale.set(s, s * tall, s);
  const g = new THREE.Group();
  g.add(inner);
  return { obj: g, h: m.size.y * s * tall };
}

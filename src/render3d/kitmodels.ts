import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
    // (The nature kit's mint greens and orange "dirt" become the town's own greens and stone.)
    const TONE: Record<string, string> = { leafsGreen: "#4fa04a", leafsDark: "#3c8650", grass: "#5fae4a", dirt: "#a39d94", leafsFall: "#f08a3c" };
    if (TONE[src.name]) col.set(TONE[src.name]);
    // Windows read as glass (a sheen and a faint glow of the sky), the rest a soft matte.
    const glassy = /window|glass/i.test(src.name);
    const mat = new THREE.MeshStandardMaterial({ color: glassy ? new THREE.Color("#7fb6e8") : col, map: src.map ?? null, roughness: glassy ? 0.12 : 0.8, metalness: glassy ? 0.35 : 0, emissive: glassy ? new THREE.Color("#3a6fa8") : new THREE.Color(0), emissiveIntensity: glassy ? 0.12 : 0 });
    mat.name = src.name;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    m.material = mat;
    m.castShadow = true; m.receiveShadow = true;
  });
}

/** Rigged characters, posed once (their standing pose) and frozen into one plain mesh: a
 *  person then costs the town one draw and no animation work, however many walk about. */
function bakePose(root: THREE.Object3D, clips: THREE.AnimationClip[]): void {
  const skinned: THREE.SkinnedMesh[] = [];
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh); });
  if (!skinned.length) return;
  const clip = clips.find(c => c.name === "idle") ?? clips[0];
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.update(0.25);
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [], v = new THREE.Vector3();
  let mat: THREE.Material | null = null;
  for (const sm of skinned) {
    sm.skeleton.update();
    const src = sm.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
    let ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (src.attributes.uv) ng.setAttribute("uv", src.attributes.uv.clone());
    if (src.index) ng.setIndex(src.index.clone());
    ng = ng.toNonIndexed();
    ng.computeVertexNormals();
    geos.push(ng);
    mat = mat ?? (sm.material as THREE.Material);
  }
  mixer.stopAllAction();
  const merged = mergeGeometries(geos);
  if (!merged || !mat) return;
  for (const c of [...root.children]) root.remove(c);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true;
  root.add(mesh);
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
        if (gl.animations.length) bakePose(gl.scene, gl.animations);
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
/** Wall and roof colours to vary the kit's houses and shops, so a street isn't one colour. */
const WALLS = ["#f4e9d8", "#e9d3c0", "#f6e3a8", "#cfe0ea", "#e6c9c2", "#dfe8d0", "#f2f0ea", "#efd6b8"];
const ROOFS = ["#d9644a", "#4f5f8f", "#7a4a3a", "#3f6f5a", "#b8553f", "#5a5a68"];
const recol = new Map<string, THREE.Material>();
function recolor(root: THREE.Object3D, v: number): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const pal = /^wall/i.test(mat.name) ? WALLS : /^roof/i.test(mat.name) ? ROOFS : null;
    if (!pal) return;
    const c = pal[(v + (pal === ROOFS ? 3 : 0)) % pal.length], key = `${mat.uuid}|${c}`;
    let nm = recol.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!nm) { nm = mat.clone(); nm.color.set(c); recol.set(key, nm); }
    m.material = nm;
  });
}

export function kitPlace(name: string, width: number, tall = 1, variant = -1): { obj: THREE.Object3D; h: number } | null {
  if (!version) return null;
  const m = models.get(name);
  if (!m) return null;
  const s = width / Math.max(m.size.x, m.size.z, 1e-3);
  const inner = m.obj.clone(true);
  if (variant >= 0) recolor(inner, variant);
  inner.position.set(-(m.min.x + m.size.x / 2) * s, -m.min.y * s * tall, -(m.min.z + m.size.z / 2) * s);
  inner.scale.set(s, s * tall, s);
  const g = new THREE.Group();
  g.add(inner);
  return { obj: g, h: m.size.y * s * tall };
}

/** A copy of a model scaled to `height` tall (people), standing on y = 0 and centred. */
export function kitPlaceH(name: string, height: number): { obj: THREE.Object3D; h: number } | null {
  if (!version) return null;
  const m = models.get(name);
  if (!m) return null;
  const s = height / Math.max(m.size.y, 1e-3);
  const inner = m.obj.clone(true);
  inner.position.set(-(m.min.x + m.size.x / 2) * s, -m.min.y * s, -(m.min.z + m.size.z / 2) * s);
  inner.scale.setScalar(s);
  const g = new THREE.Group();
  g.add(inner);
  return { obj: g, h: height };
}

// (Test hook for the debug build: lets a check look at a single model.)
if (typeof location !== "undefined" && location.search.includes("debug")) (globalThis as unknown as { __kit: unknown }).__kit = { kitPlaceH, kitPlace };

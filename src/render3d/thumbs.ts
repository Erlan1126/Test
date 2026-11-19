// Little pictures of each business's building, at its stage, for the Company cards: the same
// 3D models as the town, rendered once on a small canvas of their own and kept as images.
import * as THREE from "three";
import { buildModel, type ModelMats } from "./bizmodels";
import { roofProp } from "./bizcity";

let gl: THREE.WebGLRenderer | null = null;
let failed = false;
const cache = new Map<string, string>();
const W = 220, H = 180;

function materials(): ModelMats {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const std = (c: string | THREE.Color, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  return {
    c(color, rough = 0.7, metal = 0) {
      const k = `${color instanceof THREE.Color ? color.getHexString() : color}|${rough}|${metal}`;
      let m = cache.get(k);
      if (!m) { m = std(color, { roughness: rough, metalness: metal }); cache.set(k, m); }
      return m;
    },
    win: std("#bfe6ff", { roughness: 0.15, metalness: 0.3, emissive: new THREE.Color("#ffd99a"), emissiveIntensity: 0.08 }),
    sign: c => std(c, { emissive: c instanceof THREE.Color ? c : new THREE.Color(c), emissiveIntensity: 0.2 }),
    gold: std("#ffc93c", { roughness: 0.25, metalness: 0.85, emissive: 0x6a4a00, emissiveIntensity: 0.25 }),
    leaf: std("#3fbf6a", { roughness: 0.9, flatShading: true }),
    trunk: std("#8a5a3a"),
    bulb: std("#fff3c0", { emissive: 0xffd27a, emissiveIntensity: 0.6 }),
  };
}

/** A picture (data URL) of a business's building at a stage, or "" if it can't be drawn. */
export function bizThumb(id: string, stage: number, c1: string, c2: string): string {
  const key = `${id}|${stage}|${c1}|${c2}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (failed) return "";
  try {
    if (!gl) {
      gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      gl.setSize(W, H, false);
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping = THREE.NeutralToneMapping;
    }
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fb0, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    const g = new THREE.Group();
    const mats = materials();
    buildModel(g, id, stage, c1, c2, mats, () => roofProp(id, new THREE.Color(c1), new THREE.Color(c2)));
    // A little round plot of grass and paving under it.
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.18, 40).translate(0, -0.09, 0), mats.c("#7fd36a", 0.95)));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.03, 40).translate(0, 0.01, 0.2), mats.c("#efe9df", 0.8)));
    scene.add(g);
    // The town's angle, framed to fit the building.
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const half = Math.max(size.x, size.z) * 0.62 + 0.4, tall = size.y * 0.75 + 0.6, sx = Math.max(half, tall * (W / H)) ;
    const cam = new THREE.OrthographicCamera(-sx, sx, sx * (H / W), -sx * (H / W), 0.1, 100);
    cam.position.set(mid.x + 10, mid.y + 7.5, mid.z + 10);
    cam.lookAt(mid);
    gl.render(scene, cam);
    const lost = gl.getContext().isContextLost();
    const data = lost ? "" : gl.domElement.toDataURL("image/png");
    const mtl = new Set<THREE.Material>();
    scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => mtl.add(x)); } });
    mtl.forEach(m => m.dispose());
    // A lost context draws nothing: don't keep a blank picture, try again next time.
    if (!data) return "";
    // A short blob: URL instead of a long data: URL keeps the cards' HTML small.
    const bin = atob(data.slice(data.indexOf(",") + 1)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    cache.set(key, url);
    return url;
  } catch {
    failed = true;
    return "";
  }
}

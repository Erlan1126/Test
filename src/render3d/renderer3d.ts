// The game drawn in real 3D on the graphics chip (WebGL, through three.js): lit and
// shadowed buildings, glass that reflects, windows that glow at night. The camera matches
// the old isometric view exactly, so anything drawn in 2D on the overlay canvas on top
// (score popups, sparks, rain, labels) lines up with the 3D scene underneath.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { clamp, lerp, mixRgb, rand, rgb, type RGB } from "../core/util";
import { BLOCK_SIZE, ISLAND, MILESTONES, UI_FONT } from "../data/constants";
import type { Look } from "../data/skins";
import { shapeById, type Shape } from "../data/shapes";
import { skinById } from "../data/skins";
import type { Floor, FloorKind, PowerUp } from "../logic/sim";
import { landmarkIndex, type Box } from "../logic/rules";
import type { SkylineTower } from "../logic/skyline";
import { drawLandmarkLabel, drawLandmarkShape, Weather } from "../render/atmosphere";
import { floorColor, lookFor } from "../render/buildings";
import { drawGuide, Effects, type Debris } from "../render/effects";
import { clipConvex, footprint, type XZ } from "../render/footprint";
import { ISO_X, View, type Env, type Paint } from "../render/paint";
import type { Frame, Shot } from "../render/renderer";
import { nightAt, skyAt, sunAt } from "../render/scenery";
import { t } from "../i18n";
import { facadeFor } from "./facade";
import { boxFoot, FH, prism } from "./geom";
import { buildIsland, type IslandAnim } from "./world";
import { buildRoof, roofFor, type RoofKind } from "./rooftops";

/** Most triangles the landing shadow can need (round floors have many sides). */
const SHADOW_MAX = 128;
const POWER_ICON: Record<PowerUp, string> = { slow: "⏳", wide: "🎯", steady: "🍃" };
/** The camera sits this far from what it looks at, along (1, 1, 1). */
const CAM_DIST = 160;
/** Pixels per world unit, relative to the 2D view's scale (true isometric). */
const ISO_SCALE = ISO_X / Math.SQRT1_2;

const toColor = (c: RGB) => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
/** Where district islands float around the home island (world units, height in floors). */
const DISTRICT_SLOTS = [
  { x: -38, z: -38, y: 3 }, { x: -46, z: -22, y: 1 }, { x: -22, z: -46, y: -3 },
  { x: -54, z: -44, y: -16 }, { x: -44, z: -56, y: 2 }, { x: -62, z: -60, y: -7 },
];
/** Floors merged per block. */
const CHUNK = 16;

/** Bakes a floor's color into its vertices: walls in the color, the roof a little lighter. */
function paintGeo(geo: THREE.BufferGeometry, c: RGB): void {
  const wall = toColor(c), roof = toColor(c.map(v => Math.min(255, v * 1.12)) as RGB);
  const nor = geo.attributes.normal as THREE.BufferAttribute, n = nor.count;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = nor.getY(i) > 0.9 ? roof : wall;
    out[i * 3] = k.r; out[i * 3 + 1] = k.g; out[i * 3 + 2] = k.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
}

/** Merges floors into one geometry with all walls first (material 0) and all roofs after
 *  (material 1), so a whole block draws in two steps. */
function mergeWithGroups(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const part = (g: THREE.BufferGeometry, k: number) => {
    const gr = g.groups[k], p = g.clone();
    p.setIndex(Array.from(g.index!.array.slice(gr.start, gr.start + gr.count)));
    p.clearGroups();
    return p;
  };
  const walls = mergeGeometries(geos.map(g => part(g, 0)), false);
  const roofs = mergeGeometries(geos.map(g => part(g, 1)), false);
  if (!walls || !roofs) return null;
  const merged = mergeGeometries([walls, roofs], true);
  walls.dispose(); roofs.dispose();
  return merged;
}

/** Can this device draw WebGL? (Very old phones and some browsers can't.) */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

interface FloorMats { wall: THREE.MeshStandardMaterial; roof: THREE.MeshStandardMaterial }

export class Renderer3D {
  readonly view = new View();
  readonly fx = new Effects();
  readonly weather = new Weather();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  // A tight near/far range keeps depth precise on phones (some have 16-bit depth
  // buffers), so flat things like roads and water don't flicker against the lawn.
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 20, CAM_DIST + 260);
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x6a5a4a, 1.2);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envScene = new THREE.Scene();
  private readonly envSky: THREE.Mesh;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = "";
  /** The island whose sky colors are showing (each island has its own sky). */
  private skyTheme = "";
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly env: Env = { nf: 0, skyTop: [0, 0, 0], skyBot: [0, 0, 0], climb: 0, time: 0, low: false, post: false };
  private readonly paint: Paint;
  // Scratch objects reused every frame (making new ones each frame makes the phone pause
  // now and then to clean up).
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Color();
  private readonly calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private dpr = 1;
  private low = false;

  // Sky
  private readonly skyCanvas = document.createElement("canvas");
  private readonly skyTex: THREE.CanvasTexture;
  private skyKey = "";

  // Island
  private island: THREE.Group | null = null;
  private islandAnim: IslandAnim | null = null;
  private islandKey = "";

  // Tower
  private readonly tower = new THREE.Group();
  private chunks: { floors: Floor[]; obj: THREE.Group }[] = [];
  private tail: { floor: Floor; mesh: THREE.Mesh }[] = [];
  private firstBuilt: Floor | null = null;
  private warmMats: THREE.Material[] = [];
  private topMesh: THREE.Mesh | null = null;
  private topOf: Floor | null = null;
  private towerKey = "";
  private readonly mats = new Map<string, FloorMats>();
  private readonly wallMats = new Set<THREE.MeshStandardMaterial>();
  private moverMesh: THREE.Mesh | null = null;
  private moverOf: unknown = null;
  private readonly landShadow: THREE.Mesh;
  private readonly roofGear = new THREE.Group();
  private roofKey = "";
  /** Shared shader inputs: the glass ripple after a perfect drop, rain and snow. */
  private readonly fxU = {
    uTime: { value: 0 }, uRipY: { value: -999 }, uRipAmp: { value: 0 }, uWet: { value: 0 }, uSnow: { value: 0 },
  };
  /** Materials (the lawn) that turn white when it snows. */
  private snowable: THREE.MeshStandardMaterial[] = [];
  /** Home screen camera: a slow sunrise intro, then a gentle sway around the island. */
  private menuTime = 0;
  private introDone = false;
  private azimuth = 0;

  // Falling pieces
  private readonly debrisMeshes = new Map<Debris, THREE.Mesh>();

  // Landmark silhouette and clouds
  private readonly landmark: THREE.Mesh;
  private landmarkIndex = -1;
  private readonly clouds: THREE.Sprite[] = [];

  // Skyline island
  private skyline: THREE.Group | null = null;
  private skylineKey = "";
  private skylineIn: unknown = null;
  private districtsIn: unknown = null;

  constructor(private readonly canvas: HTMLCanvasElement, glCanvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.paint = { ctx: this.ctx, view: this.view, env: this.env };
    glCanvas.hidden = false;
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps colors rich instead of washing them out.
    this.gl.toneMapping = THREE.NeutralToneMapping;
    this.gl.toneMappingExposure = 1;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    // Reflections start from a soft studio light; once the sky is known, the glass
    // reflects the real sky instead (see updateEnvironment).
    this.pmrem = new THREE.PMREMGenerator(this.gl);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sun: { value: new THREE.Vector3(0.3, 0.6, -0.7) }, sunCol: { value: new THREE.Color(1, 0.95, 0.85) } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunCol; varying vec3 vDir;" +
        "void main() { float h = vDir.y; vec3 c = mix(bot, top, smoothstep(-0.1, 0.7, h));" +
        "c = mix(c, bot * 0.55, smoothstep(0.0, -0.4, h));" +
        "float s = max(dot(normalize(vDir), normalize(sun)), 0.0); c += sunCol * (pow(s, 400.0) * 18.0 + pow(s, 12.0) * 0.5);" +
        "gl_FragColor = vec4(c, 1.0); }",
    }));
    this.envScene.add(this.envSky);
    // A soft glow on the brightest things (sun glints on glass, lit windows at night).
    // The glow pass draws the scene off screen first; give that image edge smoothing
    // (multisampling) too, or edges turn jagged whenever the glow is on.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.gl, target);
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.45, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.skyCanvas.width = 64; this.skyCanvas.height = 256;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    // Only far things (the skyline island, distant rocks) fade into the sky.
    this.scene.fog = new THREE.Fog(0xbfe8fb, CAM_DIST + 45, CAM_DIST + 190);

    this.scene.add(this.hemi, this.sun, this.sun.target, this.tower);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;

    // The landing shadow takes the exact shape of the overlap, so it is rebuilt in place.
    const shadowGeo = new THREE.BufferGeometry();
    shadowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SHADOW_MAX * 9), 3).setUsage(THREE.DynamicDrawUsage));
    this.landShadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x0a1432, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.landShadow.frustumCulled = false;
    this.landShadow.renderOrder = 2;
    this.scene.add(this.landShadow);

    // The finished tower's rooftop (antenna, garden, helipad, spire or crown).
    this.roofGear.visible = false;
    this.scene.add(this.roofGear);

    this.landmark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }));
    this.landmark.renderOrder = -1;
    this.scene.add(this.landmark);

    const cloudTex = makeCloudTexture();
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
      const size = rand(12, 26);
      s.scale.set(size, size * 0.55, 1);
      // Spread from the island up past the clouds band, behind and around the tower.
      s.userData = { x: rand(-60, 40), z: rand(-70, -25), y: rand(-6, 90) * FH, v: rand(0.3, 0.9) };
      this.clouds.push(s);
      this.scene.add(s);
    }
  }

  /** The finished frame (3D scene plus overlay) as one canvas, for the share picture. */
  get output(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext("2d")!;
    this.gl.render(this.scene, this.cam);
    g.drawImage(this.gl.domElement, 0, 0, c.width, c.height);
    g.drawImage(this.canvas, 0, 0);
    return c;
  }

  resize(low: boolean, scale = 1): void {
    const v = this.view;
    this.low = low;
    // Up to 2x: on a phone it looks the same as 3x for less than half the pixels. The game
    // lowers `scale` by itself if the phone can't keep a smooth frame rate.
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2) * scale);
    v.W = this.canvas.clientWidth || window.innerWidth;
    v.H = this.canvas.clientHeight || window.innerHeight;
    const overlayDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(v.W * overlayDpr);
    this.canvas.height = Math.round(v.H * overlayDpr);
    this.ctx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(v.W, v.H, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(v.W, v.H);
    // Bloom at a quarter of the pixels: it's blurry anyway, and much cheaper.
    this.bloom.resolution.set(Math.round(v.W * this.dpr / 2), Math.round(v.H * this.dpr / 2));
    this.gl.shadowMap.enabled = !low;
    this.sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    v.s = Math.min(v.W * 0.56, v.H * 0.36) / (BLOCK_SIZE * 2 * ISO_X);
    v.th = v.s * 1.3;
    if (!v.originY) v.originY = v.H * 0.56;
    if (!v.cx) v.cx = v.W / 2;
  }

  /** Eases the camera toward the framing for the current shot (same framing as before). */
  camera(dt: number, shot: Shot, level: number, full = false): void {
    const v = this.view, { W, H, s, th } = v;
    let tZoom = 1, tLevel = Math.max(0, level - Math.floor(H * 0.2 / th)), tOrigin = H * 0.6, tCx = W / 2;
    if (shot === "menu") { tZoom = 0.64; tOrigin = H * 0.56; tLevel = 0; }
    if (shot === "over") {
      const above = Math.max((level + 4.8) * th, ISLAND * s);
      const room = v.wide || full ? H * 0.84 : H * 0.44;
      const width = v.wide && !full ? W * 0.52 : W * 0.96;
      const content = above + ISLAND * s + 3 * th;
      tZoom = Math.min(1, room / content, width / (4 * ISLAND * ISO_X * s));
      tLevel = 0;
      tOrigin = H * 0.08 + Math.max(0, (room - content * tZoom) / 2) + above * tZoom;
      if (v.wide && !full) tCx = W * 0.27;
    }
    const k = Math.min(1, dt * (shot === "over" ? 3 : 6));
    v.zoom = lerp(v.zoom, tZoom, k);
    if (Math.abs(v.zoom - tZoom) < 0.0006) v.zoom = tZoom;
    v.level = lerp(v.level, tLevel, k);
    v.originY = lerp(v.originY, tOrigin, k);
    v.cx = lerp(v.cx, tCx, k);
  }

  /** The video clip's camera, t from 0 to 1: rise up the tower from the street to the
   *  roof, then pull back to show the whole tower and the city around it. */
  cinematic(t: number, level: number): void {
    const v = this.view, ease = (x: number) => x * x * (3 - 2 * x);
    if (t < 0.65) {
      const k = ease(t / 0.65);
      v.zoom = lerp(1.15, 0.95, k);
      v.level = lerp(-2, Math.max(0, level - 3), k);
      v.originY = v.H * 0.62;
      v.cx = v.W / 2;
    } else {
      // Ease from the roof into the finished-tower framing.
      for (let i = 0; i < 60; i++) this.camera(1, "over", level, true);
      const to = { zoom: v.zoom, level: v.level, originY: v.originY }, k = ease((t - 0.65) / 0.35);
      v.zoom = lerp(0.95, to.zoom, k);
      v.level = lerp(Math.max(0, level - 3), to.level, k);
      v.originY = lerp(v.H * 0.62, to.originY, k);
      v.cx = v.W / 2;
    }
  }

  /** The 3D canvas (for recording the video clip). */
  get glCanvas(): HTMLCanvasElement { return this.gl.domElement; }

  snap(shot: Shot, level: number): void {
    for (let i = 0; i < 60; i++) this.camera(1, shot, level);
  }

  /** The home screen camera: opens swung round to one side and glides into place as the
   *  sun comes up, then sways slowly so the city feels alive. Straight while playing. */
  private updateMenuCamera(dt: number, f: Frame): void {
    if (f.shot === "menu" && !this.calm) {
      this.menuTime += dt;
      const t = this.menuTime, k = clamp(t / 4.5, 0, 1), ease = 1 - (1 - k) ** 3;
      const sway = Math.sin(t * 0.13) * 0.22 * ease;
      this.azimuth = this.introDone ? lerp(this.azimuth, Math.sin(t * 0.13) * 0.22, Math.min(1, dt * 1.5)) : lerp(-0.75, 0, ease) + sway;
      if (k >= 1 && !this.introDone) this.introDone = true;
    } else {
      if (f.shot !== "menu") this.introDone = true;
      this.azimuth = Math.abs(this.azimuth) < 0.002 ? 0 : lerp(this.azimuth, 0, Math.min(1, dt * 7));
    }
  }

  /** The finished tower's rooftop: grander the taller the tower. */
  private updateRoof(f: Frame): void {
    const top = f.sim.top, n = f.sim.stack.length;
    const show = f.shot === "over" && n > 1;
    this.roofGear.visible = show;
    if (!show) return;
    const kind: RoofKind = roofFor(n - 1);
    const square = f.shape.id === "square";
    const half = Math.min(top.x1 - top.x0, top.z1 - top.z0) / 2 * (square ? 0.95 : 0.7);
    const key = `${kind}|${half.toFixed(1)}`;
    if (key !== this.roofKey) {
      this.roofKey = key;
      for (const c of [...this.roofGear.children]) { this.roofGear.remove(c); disposeTree(c); }
      this.roofGear.add(buildRoof(kind, half));
    }
    this.roofGear.position.set((top.x0 + top.x1) / 2, (top.y + 1) * FH, (top.z0 + top.z1) / 2);
    const t = this.env.time;
    this.roofGear.traverse(o => {
      const m = o as THREE.Mesh;
      if (o.userData.blink) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.floor(t / 0.6) % 2 ? 0.2 : 3;
      if (o.userData.spin) o.rotation.y = t * 0.8;
    });
  }

  /** Drives the shared shader inputs: a shimmer that runs down the glass after a perfect
   *  drop, rain streaks and a wet sheen in the rain, and snow settling on roofs and lawn. */
  private updateShaderFx(dt: number, f: Frame): void {
    const u = this.fxU, r = this.fx.ripple, kind = this.weather.kind;
    u.uTime.value = this.env.time;
    const top = f.sim.top;
    const life = 1.1;
    if (r.age < life && !this.calm) {
      u.uRipY.value = (top.y + 1) * FH - r.age * 30;
      u.uRipAmp.value = r.strength * 1.6 * (1 - r.age / life);
    } else u.uRipAmp.value = 0;
    const ease = Math.min(1, dt * 0.6);
    u.uWet.value = lerp(u.uWet.value, kind === "rain" ? 1 : 0, ease);
    u.uSnow.value = lerp(u.uSnow.value, kind === "snow" ? 1 : 0, ease);
    const snow = u.uSnow.value;
    for (const m of this.snowable) {
      m.color.setScalar(1 - 0.5 * snow);
      m.emissive.setScalar(0.62 * snow);
    }
  }

  /** Adds the ripple, rain and snow effects to a building material's shader. */
  private addFx(m: THREE.Material, part: "wall" | "roof"): void {
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.fxU);
      const decl = "uniform float uTime; uniform float uRipY; uniform float uRipAmp; uniform float uWet; uniform float uSnow; varying vec3 vFxW;\n";
      shader.vertexShader = "varying vec3 vFxW;\n" + shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nvFxW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = decl + (part === "wall"
        ? shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          // A bright band sweeping down the glass after a perfect drop.
          totalEmissiveRadiance += vec3(0.55, 0.85, 1.0) * uRipAmp * exp(-pow((vFxW.y - uRipY) / 1.3, 2.0));
          // Raindrops running down the glass.
          if (uWet > 0.01) {
            float u = (vFxW.x - vFxW.z) * 2.2;
            float h = fract(sin(floor(u) * 12.9898) * 43758.5453);
            float run = fract((vFxW.y + uTime * (2.0 + h * 3.0)) * 0.09 + h * 7.0);
            float line = 1.0 - smoothstep(0.0, 0.07, abs(fract(u) - 0.5));
            totalEmissiveRadiance += vec3(0.8, 0.9, 1.0) * smoothstep(0.75, 1.0, run) * line * step(0.4, h) * uWet * 0.45;
          }`)
        : shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.97, 1.0), uSnow * 0.9);")
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor *= 1.0 - 0.65 * uWet;"));
    };
    m.customProgramCacheKey = () => `skyfx-${part}`;
  }

  /** Points the 3D camera so world points land exactly where View.project puts them. */
  private placeCamera(shake: number): void {
    const v = this.view, S = ISO_SCALE * v.s * v.zoom;
    const target = this.tmpA.set(0, v.level * FH, 0);
    // Straight isometric while playing; on the home screen the camera can swing around the
    // island (nothing on the overlay needs to line up there).
    const d = CAM_DIST / Math.sqrt(3), a = this.azimuth;
    this.cam.position.copy(target).add(this.tmpB.set(d * (Math.cos(a) + Math.sin(a)), d, d * (Math.cos(a) - Math.sin(a))));
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(target);
    const sx = shake ? rand(-1, 1) * 10 * shake : 0, sy = shake ? rand(-1, 1) * 10 * shake : 0;
    const cx = v.cx + sx, cy = v.originY + sy;
    this.cam.left = -cx / S; this.cam.right = (v.W - cx) / S;
    this.cam.top = cy / S; this.cam.bottom = -(v.H - cy) / S;
    this.cam.updateProjectionMatrix();
    // The sun follows what the camera looks at, so shadows stay sharp where you are.
    const focus = this.tmpA.set(0, Math.max(0, v.level) * FH, 0);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).add(this.tmpB.set(35, 120, -100));
    const span = Math.max(34, (v.H / S) * 0.75);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.top - span) > 2) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix(); }
  }

  draw(dt: number, f: Frame): void {
    const { view, env, fx } = this;
    const sim = f.sim, stack = sim.stack, n = stack.length;
    env.time += dt;
    env.low = f.low;
    [env.skyTop, env.skyBot] = skyAt(n);
    if (f.tint) { env.skyTop = mixRgb(env.skyTop, f.tint, 0.22); env.skyBot = mixRgb(env.skyBot, f.tint, 0.18); }
    if (f.shot === "over") env.skyBot = mixRgb(env.skyBot, skyAt(0)[1], 0.6);
    // The first home screen opens on a sunrise that warms into the day.
    const dawn = this.introDone || f.shot !== "menu" ? 0 : clamp(1 - this.menuTime / 4.5, 0, 1);
    if (dawn > 0) {
      const k = dawn * dawn * (3 - 2 * dawn);
      env.skyTop = mixRgb(env.skyTop, [255, 170, 120], 0.55 * k);
      env.skyBot = mixRgb(env.skyBot, [255, 214, 150], 0.7 * k);
    }
    env.nf = nightAt(n);
    env.climb = view.level * view.th * view.zoom;
    if (f.low !== this.low) this.resize(f.low);

    this.updateSky(n);
    this.updateLights(n);
    this.updateIsland(f);
    this.updateSkyline(f);
    // Your skyline island is for looking at between towers, not while you build.
    if (this.skyline) this.skyline.visible = f.shot !== "play";
    this.updateTower(f);
    this.updateMover(f);
    this.updateDebris(f.shape);
    this.updateLandmark(f);
    this.updateClouds(dt);
    this.islandAnim?.update(env.time, env.nf);
    const wallGlow = (m: THREE.MeshStandardMaterial) => (m.userData.alwaysLit ? Math.max(0.9, env.nf * 1.4) : env.nf * 1.4);
    for (const m of this.wallMats) m.emissiveIntensity = wallGlow(m);

    // Top floor squash when it lands
    if (this.topMesh) this.topMesh.scale.y = n > 1 ? 1 - fx.bounce * 0.3 : 1;

    this.updateRoof(f);
    this.updateShaderFx(dt, f);
    this.updateMenuCamera(dt, f);

    this.placeCamera(fx.shake > 0 && !this.calm ? fx.shake : 0);
    this.updateEnvironment(n);
    // By day the glow barely shows, so it's skipped there: a cheaper frame.
    if (this.low || env.nf < 0.12) this.gl.render(this.scene, this.cam);
    else {
      // Subtle by day (only sun glints), stronger at night when windows glow.
      this.bloom.strength = 0.15 + env.nf * 0.3;
      this.bloom.threshold = lerp(0.95, 0.82, env.nf);
      this.composer.render();
    }
    this.drawOverlay(dt, f);
  }

  /** The glass reflects the real sky: rebuilt as the sky changes color with height. */
  private updateEnvironment(n: number): void {
    const { env } = this;
    // Rebuilt only when the sky moves to a new stage (a handful of times in a tall tower):
    // rebuilding is a heavy job, and doing it every few floors made the game stutter.
    const sunset = clamp((n - 18) / 30, 0, 1);
    const key = `${Math.round(sunset * 3)}|${Math.round(env.nf * 4)}|${this.skyTheme}`;
    if (key === this.envKey) return;
    this.envKey = key;
    const u = (this.envSky.material as THREE.ShaderMaterial).uniforms;
    u.top.value.copy(toColor(env.skyTop)).convertSRGBToLinear();
    u.bot.value.copy(toColor(env.skyBot)).convertSRGBToLinear();
    u.sun.value.set(0.35, lerp(0.6, 0.12, sunset), -1).normalize();
    u.sunCol.value.setRGB(1, lerp(0.95, 0.6, sunset), lerp(0.85, 0.4, sunset)).multiplyScalar(1 - env.nf * 0.85);
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0, 0.1, 100, { size: 64 });
    this.scene.environment = this.envTarget.texture;
    old?.dispose();
  }

  // ---------- Sky and light ----------

  private updateSky(n: number): void {
    const { env, view } = this;
    const key = `${env.skyTop.join()}|${env.skyBot.join()}|${Math.round(env.nf * 20)}|${view.W}x${view.H}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const c = this.skyCanvas, g = c.getContext("2d")!, W = c.width, H = c.height;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgb(env.skyTop));
    grad.addColorStop(1, rgb(env.skyBot));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // The sun sinks toward the horizon as the tower climbs.
    const sun = sunAt(n, W, H);
    if (sun.t < 1) {
      const r = H * 0.5, col = mixRgb([255, 247, 214], [255, 150, 90], sun.t);
      const gl = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, r);
      gl.addColorStop(0, rgb(col, 1, 0.6));
      gl.addColorStop(1, rgb(col, 1, 0));
      g.fillStyle = gl;
      g.fillRect(0, 0, W, H);
    }
    if (env.nf > 0) {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${env.nf * (0.3 + (i % 5) * 0.12)})`;
        g.fillRect((i * 37.7) % W, ((i * 91.3) % (H * 0.8)), 0.6, 0.35);
      }
    }
    this.skyTex.needsUpdate = true;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(toColor(mixRgb(env.skyBot, env.skyTop, 0.3)));
  }

  private updateLights(n: number): void {
    const nf = this.env.nf, sunset = clamp((n - 18) / 30, 0, 1) * (1 - nf);
    this.sun.color.setRGB(1, 0.97, 0.9).lerp(this.tmpC.setRGB(1, 0.62, 0.38), sunset).lerp(this.tmpC.setRGB(0.55, 0.65, 1), nf);
    this.sun.intensity = lerp(2.4, 0.45, nf);
    const top = this.env.skyTop;
    this.hemi.color.setRGB(top[0] / 255, top[1] / 255, top[2] / 255).lerp(this.tmpC.setRGB(1, 1, 1), 0.5);
    this.hemi.groundColor.set(0x6a5a4a).lerp(this.tmpC.set(0x101830), nf);
    this.hemi.intensity = lerp(0.85, 0.35, nf);
    this.gl.toneMappingExposure = lerp(0.95, 0.85, nf);
  }

  private updateClouds(dt: number): void {
    for (const s of this.clouds) {
      const u = s.userData as { x: number; z: number; y: number; v: number };
      u.x += u.v * dt;
      if (u.x > 50) u.x = -60;
      s.position.set(u.x, u.y, u.z);
      (s.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - this.env.nf * 0.7);
    }
  }

  // ---------- Island and skyline ----------

  private updateIsland(f: Frame): void {
    const key = `${f.theme.id}|${f.islandLevel}|${f.city.join()}`;
    if (key === this.islandKey) return;
    this.islandKey = key;
    if (this.island) { this.scene.remove(this.island); disposeTree(this.island); }
    const { group, anim } = buildIsland({ theme: f.theme, level: f.islandLevel, city: f.city });
    this.island = group;
    this.islandAnim = anim;
    this.snowable = [];
    group.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && !Array.isArray(m) && m.userData?.snowable && !this.snowable.includes(m)) this.snowable.push(m);
    });
    this.scene.add(group);
  }

  /** The city: the current district's best towers on the island just behind, and every
   *  other district you've built in floating around it with its own towers. */
  private updateSkyline(f: Frame): void {
    if (f.skyline === this.skylineIn && f.districts === this.districtsIn) return;
    this.skylineIn = f.skyline;
    this.districtsIn = f.districts;
    const list = [{ theme: f.theme, towers: f.skyline }, ...f.districts].filter(d => d.towers.length).slice(0, DISTRICT_SLOTS.length);
    const key = JSON.stringify(list.map(d => [d.theme.id, d.towers]));
    if (key === this.skylineKey) return;
    this.skylineKey = key;
    if (this.skyline) { this.scene.remove(this.skyline); disposeTree(this.skyline, false); }
    this.skyline = null;
    if (!list.length) return;
    const city = new THREE.Group();
    list.forEach((d, i) => city.add(this.districtIsland(d.theme, d.towers, DISTRICT_SLOTS[i])));
    this.skyline = city;
    this.scene.add(city);
  }

  private districtIsland(theme: Frame["theme"], towers: SkylineTower[], slot: { x: number; z: number; y: number }): THREE.Group {
    const { x: CX, z: CZ } = slot, R = 7.2, Y = slot.y * FH, g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rockL), roughness: 1, flatShading: true });
    g.add(new THREE.Mesh(new THREE.ConeGeometry(R * 1.35, R * 1.6, 4).rotateY(Math.PI / 4).rotateX(Math.PI).translate(CX, Y - R * 0.8, CZ), rockMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.8, R * 2).translate(CX, Y - 0.4, CZ), new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.lawn), roughness: 0.9 })));
    const spots = [-4.4, 0, 4.4].flatMap(a => [-4.4, 0, 4.4].map(b => [CX + a, CZ + b] as const)).sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    [...towers].sort((a, b) => b.f - a.f).forEach((tw, i) => {
      const spot = spots[i];
      if (!spot) return;
      const skin = skinById(tw.s), shape = shapeById(tw.h), h = clamp(tw.f * 0.2, 1.6, 16) * FH, half = 1.35;
      const box = { x0: spot[0] - half, x1: spot[0] + half, z0: spot[1] - half, z1: spot[1] + half };
      const foot = shape.id === "square" ? boxFoot(box) : footprint(shape, box, 0);
      const mats = this.floorMats(lookFor(skin, "normal"));
      const geo = prism(foot, Y, Y + h, shape.id === "round" || shape.id === "pill");
      paintGeo(geo, floorColor(skin, 8, "normal"));
      const m = new THREE.Mesh(geo, [mats.wall, mats.roof]);
      m.castShadow = true;
      g.add(m);
    });
    return g;
  }

  // ---------- The tower ----------

  /** Wall and roof materials for a look, shared by every floor in it: each floor's own
   *  color is baked into its vertices, so floors can be merged into a few big meshes. */
  private floorMats(look: Look, kind?: string): FloorMats {
    const key = `${look.glass}|${look.frame}|${look.kind}|${look.slab}|${look.lit.join()}|${look.neon ? 1 : 0}|${kind === "gold" ? "gold" : ""}`;
    let m = this.mats.get(key);
    if (m) return m;
    const fa = facadeFor(look);
    const gold = kind === "gold";
    // Glossy facades: glass is mirror-like (it reflects the sky), walls get a clear coat.
    // Glossy facades: the glass is mirror-like and reflects the sky. (A clear coat on top
    // looked a little richer but cost every wall a second lighting pass on phones.)
    const wall = new THREE.MeshStandardMaterial({
      vertexColors: true, map: fa.map, emissiveMap: fa.lit, emissive: 0xffffff, emissiveIntensity: 0,
      roughnessMap: fa.orm, metalnessMap: fa.orm, roughness: gold ? 0.5 : 1, metalness: 1, envMapIntensity: 1.45,
    });
    wall.userData.alwaysLit = !!look.alwaysLit || !!look.neon;
    this.addFx(wall, "wall");
    this.wallMats.add(wall);
    const roof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gold ? 0.35 : 0.8, metalness: gold ? 0.7 : 0 });
    this.addFx(roof, "roof");
    m = { wall, roof };
    this.mats.set(key, m);
    return m;
  }

  /** A floor's geometry (with its color in the vertices), around its own center if asked. */
  private floorGeo(b: Floor, f: Frame, center: boolean): { geo: THREE.BufferGeometry; mats: FloorMats; cx: number; cz: number } {
    const cx = center ? (b.x0 + b.x1) / 2 : 0, cz = center ? (b.z0 + b.z1) / 2 : 0;
    const local = (q: Box) => ({ x0: q.x0 - cx, x1: q.x1 - cx, z0: q.z0 - cz, z1: q.z1 - cz });
    const shape = f.shape;
    let foot: XZ[] = shape.id === "square" ? boxFoot(local(b)) : footprint(shape, local(b) as Box, b.y, b.frame ? local(b.frame) as Box : undefined);
    if (foot.length < 3) foot = boxFoot(local(b));
    const smooth = shape.id === "round" || shape.id === "pill" || shape.id === "wave";
    const geo = prism(foot, center ? 0 : b.y * FH, (center ? 0 : b.y * FH) + FH, smooth, b.y);
    paintGeo(geo, floorColor(f.skin, b.y, b.kind));
    return { geo, mats: this.floorMats(lookFor(f.skin, b.kind), b.kind), cx, cz };
  }

  /** One floor as its own mesh (the top floor, which bounces, and the sliding floor). */
  private floorMesh(b: Floor, f: Frame, center: boolean): THREE.Mesh {
    const { geo, mats, cx, cz } = this.floorGeo(b, f, center);
    if (!center) geo.translate(0, -b.y * FH, 0);
    const mesh = new THREE.Mesh(geo, [mats.wall, mats.roof]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(cx, b.y * FH, cz);
    return mesh;
  }

  /** Finished floors are merged in blocks of CHUNK, one mesh per look in each block. A new
   *  landing only rebuilds the last block, so it never causes a hitch. */
  private buildChunk(floors: Floor[], f: Frame): THREE.Group {
    const g = new THREE.Group(), byMats = new Map<FloorMats, THREE.BufferGeometry[]>();
    for (const fl of floors) {
      const { geo, mats } = this.floorGeo(fl, f, false);
      const list = byMats.get(mats) ?? [];
      list.push(geo);
      byMats.set(mats, list);
    }
    for (const [mats, geos] of byMats) {
      const merged = geos.length === 1 ? geos[0] : mergeWithGroups(geos);
      if (geos.length > 1) geos.forEach(x => x.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, [mats.wall, mats.roof]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /** Finished floors: full blocks of CHUNK merged into a few meshes, plus the newest
   *  floors (fewer than CHUNK) as single meshes. A landing adds one small mesh; only every
   *  CHUNK floors are the newest ones merged into a block. */
  private updateTower(f: Frame): void {
    const stack = f.sim.stack, n = stack.length, settled = Math.max(0, n - 1);
    const key = `${f.skin.id}|${f.shape.id}`;
    if (key !== this.towerKey) {
      this.towerKey = key;
      this.clearTower();
      this.warmUp(f);
    }
    const covered = this.chunks.length * CHUNK + this.tail.length;
    const lastBuilt = this.tail.length ? this.tail[this.tail.length - 1].floor : this.chunks.length ? this.chunks[this.chunks.length - 1].floors[CHUNK - 1] : null;
    // Nothing changed (the usual case): no work at all.
    const same = covered === settled && (settled === 0 || stack[settled - 1] === lastBuilt) && (covered === 0 || this.firstBuilt === stack[0]);
    if (!same) {
      // Find the first floor that differs (a new tower, a rewind, or new floors on top).
      let first = 0;
      const at = (i: number) => (i < this.chunks.length * CHUNK ? this.chunks[Math.floor(i / CHUNK)].floors[i % CHUNK] : this.tail[i - this.chunks.length * CHUNK].floor);
      while (first < covered && first < settled && at(first) === stack[first]) first++;
      if (first < this.chunks.length * CHUNK) {
        for (const c of this.chunks.splice(Math.floor(first / CHUNK))) { this.tower.remove(c.obj); disposeTree(c.obj, false); }
        this.dropTail(0);
      } else this.dropTail(first - this.chunks.length * CHUNK);
      let idx = this.chunks.length * CHUNK + this.tail.length;
      while (idx < settled) {
        if (!this.tail.length && idx + CHUNK <= settled) {
          const floors = stack.slice(idx, idx + CHUNK), obj = this.buildChunk(floors, f);
          this.chunks.push({ floors, obj });
          this.tower.add(obj);
          idx += CHUNK;
          continue;
        }
        const mesh = this.floorMesh(stack[idx], f, false);
        this.tower.add(mesh);
        this.tail.push({ floor: stack[idx], mesh });
        idx++;
        if (this.tail.length === CHUNK) {
          const floors = this.tail.map(x => x.floor), obj = this.buildChunk(floors, f);
          this.dropTail(0);
          this.chunks.push({ floors, obj });
          this.tower.add(obj);
        }
      }
      this.firstBuilt = settled ? stack[0] : null;
    }
    const top = stack[n - 1];
    if (top !== this.topOf) {
      if (this.topMesh) { this.tower.remove(this.topMesh); this.topMesh.geometry.dispose(); }
      this.topMesh = top ? this.floorMesh(top, f, false) : null;
      this.topOf = top ?? null;
      if (this.topMesh) this.tower.add(this.topMesh);
    }
  }

  private dropTail(from: number): void {
    for (const t of this.tail.splice(from)) { this.tower.remove(t.mesh); t.mesh.geometry.dispose(); }
  }

  private clearTower(): void {
    for (const c of this.chunks) { this.tower.remove(c.obj); disposeTree(c.obj, false); }
    this.chunks = [];
    this.dropTail(0);
    this.firstBuilt = null;
    if (this.topMesh) { this.tower.remove(this.topMesh); this.topMesh.geometry.dispose(); this.topMesh = null; this.topOf = null; }
  }

  /** Prepares everything a tower in this skin can show (every floor kind's look, the
   *  see-through foggy floor, falling pieces) before play, so the first gold or icy floor
   *  doesn't freeze the game for a moment while the phone gets its shaders ready. */
  private warmUp(f: Frame): void {
    const g = new THREE.Group(), box = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    box.addGroup(0, box.index!.count, 0);
    const kinds: FloorKind[] = ["normal", "gold", "ice", "garden", "shrink", "magnet", "ghost"];
    for (const kind of kinds) {
      const look = lookFor(f.skin, kind), mats = this.floorMats(look, kind);
      g.add(new THREE.Mesh(box, [mats.wall, mats.roof]));
      const see = [mats.wall.clone(), mats.roof.clone()];
      see.forEach((m, i) => { m.transparent = true; this.addFx(m, i === 0 ? "wall" : "roof"); });
      g.add(new THREE.Mesh(box, see));
      const piece = new THREE.MeshStandardMaterial({ color: 0xffffff, map: facadeFor(look).map, roughness: 0.8, transparent: true });
      g.add(new THREE.Mesh(box, piece));
    }
    g.position.set(0, -500, 0);
    this.scene.add(g);
    try { this.gl.compile(this.scene, this.cam); } catch { /* best effort */ }
    this.scene.remove(g);
    // The extra materials are kept (not thrown away) until the next skin: throwing one away
    // would also throw away the ready shader it was made for.
    const extra: THREE.Material[] = [];
    g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) for (const x of [m.material].flat()) if (!this.isShared(x)) extra.push(x); });
    this.warmMats.forEach(m => m.dispose());
    this.warmMats = extra;
    box.dispose();
  }

  private isShared(m: THREE.Material): boolean {
    for (const v of this.mats.values()) if (v.wall === m || v.roof === m) return true;
    return false;
  }

  private updateMover(f: Frame): void {
    const m = f.showMover ? f.sim.mover : null;
    if (!m) {
      if (this.moverMesh) this.moverMesh.visible = false;
      this.landShadow.visible = false;
      return;
    }
    if (this.moverOf !== m || !this.moverMesh) {
      if (this.moverMesh) {
        this.scene.remove(this.moverMesh);
        this.moverMesh.geometry.dispose();
        for (const x of this.moverMesh.material as THREE.MeshStandardMaterial[]) { this.wallMats.delete(x); x.dispose(); }
      }
      this.moverMesh = this.floorMesh(m, f, true);
      // Its own copy of the materials, so a foggy floor can fade without fading the tower.
      const mats = this.moverMesh.material as THREE.MeshStandardMaterial[];
      this.moverMesh.material = mats.map((x, i) => { const c = x.clone(); c.transparent = m.kind === "ghost"; this.addFx(c, i === 0 ? "wall" : "roof"); if (i === 0) this.wallMats.add(c); return c; });
      this.moverOf = m;
      this.moverMesh.userData.width = m.width;
      this.scene.add(this.moverMesh);
    }
    const mesh = this.moverMesh;
    mesh.visible = true;
    // Shrinking floors get narrower along the way they slide.
    const w = m.axis === "x" ? m.x1 - m.x0 : m.z1 - m.z0, k = w / (mesh.userData.width || w);
    mesh.scale.set(m.axis === "x" ? k : 1, 1, m.axis === "z" ? k : 1);
    mesh.position.set((m.x0 + m.x1) / 2, m.y * FH, (m.z0 + m.z1) / 2);
    if (m.kind === "ghost") {
      const a = 0.1 + 0.9 * Math.max(0, Math.sin(this.env.time * 4.2)) ** 0.6;
      for (const mat of mesh.material as THREE.MeshStandardMaterial[]) mat.opacity = a;
    }
    // Where it would land, shaded on the top floor.
    const top = f.sim.top;
    const foot = (b: Floor): XZ[] => {
      const p = f.shape.id === "square" ? boxFoot(b) : footprint(f.shape, b, b.y, b.frame);
      return p.length >= 3 ? p : boxFoot(b);
    };
    const over = clipConvex(foot(m), foot(top));
    const tris = Math.min(SHADOW_MAX, over.length - 2);
    this.landShadow.visible = tris > 0;
    if (tris > 0) {
      const attr = this.landShadow.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      for (let i = 0; i < tris; i++) {
        const t = [over[0], over[i + 1], over[i + 2]];
        for (let k = 0; k < 3; k++) a.set([t[k][0], 0, t[k][1]], (i * 3 + k) * 3);
      }
      attr.needsUpdate = true;
      this.landShadow.geometry.setDrawRange(0, tris * 3);
      this.landShadow.position.set(0, (top.y + 1) * FH + 0.06 - this.fx.bounce * 0.3 * FH, 0);
    }
  }

  private updateDebris(shape: Shape): void {
    const live = new Set(this.fx.debris);
    for (const [d, m] of this.debrisMeshes) {
      if (!live.has(d)) { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material[]).forEach(x => x.dispose()); this.debrisMeshes.delete(d); }
    }
    for (const d of this.fx.debris) {
      let m = this.debrisMeshes.get(d);
      if (!m) {
        const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
        const local = (q: Box) => ({ x0: q.x0 - cx, x1: q.x1 - cx, z0: q.z0 - cz, z1: q.z1 - cz });
        const foot = shape.id === "square" ? boxFoot(local(d)) : footprint(shape, local(d) as Box, d.y, d.frame ? local(d.frame) as Box : undefined);
        const wall = new THREE.MeshStandardMaterial({ color: toColor(d.color), map: facadeFor(d.look).map, roughness: 0.8, transparent: true });
        const roof = new THREE.MeshStandardMaterial({ color: toColor(d.color), roughness: 0.8, transparent: true });
        m = new THREE.Mesh(prism(foot.length >= 3 ? foot : boxFoot(local(d)), -FH / 2, FH / 2, false, d.y), [wall, roof]);
        m.castShadow = true;
        m.userData.spin = (d.vside > 0 ? -1 : 1) * rand(0.6, 1.4);
        this.debrisMeshes.set(d, m);
        this.scene.add(m);
      }
      m.position.set((d.x0 + d.x1) / 2, d.y * FH + FH / 2, (d.z0 + d.z1) / 2);
      // Tumbles as it falls.
      const fall = clamp((1.4 - d.life) / 1.4, 0, 1);
      if (d.axis === "x") m.rotation.z = m.userData.spin * fall * 1.6; else m.rotation.x = -m.userData.spin * fall * 1.6;
      for (const mat of m.material as THREE.MeshStandardMaterial[]) mat.opacity = clamp(d.life, 0, 1);
    }
  }

  // ---------- Landmark silhouette ----------

  private updateLandmark(f: Frame): void {
    const index = f.shot === "play" ? landmarkIndex(f.sim.meters) + 1 : -1;
    const ms = MILESTONES[index];
    this.landmark.visible = !!ms;
    if (!ms) return;
    const mat = this.landmark.material as THREE.MeshBasicMaterial;
    if (index !== this.landmarkIndex) {
      this.landmarkIndex = index;
      const c = document.createElement("canvas");
      c.width = 256; c.height = 512;
      const g = c.getContext("2d")!;
      drawLandmarkShape(g, index, 128, 512, 256, 500, "#ffffff");
      mat.map?.dispose();
      mat.map = new THREE.CanvasTexture(c);
      mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.needsUpdate = true;
    }
    const col = mixRgb(this.env.skyBot, this.env.skyTop, 0.35);
    mat.color.copy(toColor(mixRgb(col, [16, 20, 52], 0.55)));
    mat.opacity = 0.75;
    // Placed far behind the tower, at the same spot on screen as before.
    const v = this.view, S = ISO_SCALE * v.s * v.zoom;
    const floors = ms.m / 5, hW = floors * FH * Math.sqrt(2 / 3);
    const sx = -v.W * 0.34;              // screen offset from the tower, in pixels
    const u = sx / (v.s * v.zoom * ISO_X); // x - z for that offset
    const back = 70;
    this.landmark.position.set(u / 2 - back, -back, -u / 2 - back);
    this.landmark.quaternion.copy(this.cam.quaternion);
    // The plane is 2:1 (width:height of the texture) and anchored at its bottom.
    const pxH = floors * v.th * v.zoom, wPx = Math.min(pxH * 0.5, v.W * 0.42);
    this.landmark.scale.set(wPx / S, hW, 1);
  }

  // ---------- 2D overlay ----------

  private drawOverlay(dt: number, f: Frame): void {
    const { ctx, view, fx, paint: p, env } = this;
    const sim = f.sim, top = sim.top, m = sim.mover;
    ctx.clearRect(0, 0, view.W, view.H);
    // A warm glow around the top of the tower during a perfect streak.
    if (sim.combo >= 5 && f.showMover) {
      const [gx, gy] = view.project((top.x0 + top.x1) / 2, top.y + 0.5, (top.z0 + top.z1) / 2);
      const gr = BLOCK_SIZE * 0.9 * view.s * view.zoom * (1 + Math.sin(env.time * 6) * 0.06);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(255,190,80,${sim.combo >= 10 ? 0.35 : 0.22})`);
      g.addColorStop(1, "rgba(255,190,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    if (m && f.showMover) {
      if (m.power || m.kind === "magnet") this.drawBadge(m, m.power ? POWER_ICON[m.power] : "🧲");
      if (f.guide) drawGuide(p, top, m.y, sim.wouldBePerfect(), f.shape);
    }
    fx.drawFlash(p, top, f.shape);
    fx.drawParticles(p);
    this.weather.draw(p, dt, f.showMover && m ? sim.windFor(m.y) : 0);
    if (f.shot === "play" && f.bestFloors > 2) this.drawBestLine(f);
    if (f.shot === "play" && f.ghost) this.drawGhost(f, f.ghost);
    if (f.shot === "play") drawLandmarkLabel(p, landmarkIndex(sim.meters) + 1, 1, f.hudBottom);
    fx.drawPopups(p, top, f.hudBottom);
    // A soft vignette, so the eye goes to the middle.
    if (fx.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${fx.whiteFlash * 0.5})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }

  private drawBadge(m: Box & { y: number }, icon: string): void {
    const { ctx, view, env } = this;
    const [x, y] = view.project((m.x0 + m.x1) / 2, m.y + 1.9 + Math.sin(env.time * 3) * 0.15, (m.z0 + m.z1) / 2);
    const r = Math.max(14, 20 * view.zoom);
    ctx.fillStyle = "rgba(14,18,48,0.85)";
    ctx.strokeStyle = "#7cf5ff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.round(r * 1.1)}px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(icon, x, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  /** The ghost you're racing: a see-through floor outline at the height its tower had
   *  reached by now, with the racer's name. Ahead of you it glows; behind, it fades. */
  private drawGhost(f: Frame, g: NonNullable<Frame["ghost"]>): void {
    const { ctx, view, env } = this, sim = f.sim, base = sim.stack[0];
    if (!base) return;
    const level = sim.level, ahead = g.floors > level;
    const y1 = g.floors + 1, P = (x: number, z: number, y = y1) => view.project(x, y, z);
    const pts = [P(base.x0, base.z0), P(base.x1, base.z0), P(base.x1, base.z1), P(base.x0, base.z1)];
    const top = Math.min(...pts.map(p => p[1]));
    ctx.save();
    const pulse = 0.75 + Math.sin(env.time * 4) * 0.25;
    if (top > f.hudBottom + 30) {
      if (ahead) {
        // A floating see-through floor: its top outline and the front edges down one floor.
        ctx.globalAlpha = 0.22 * pulse;
        ctx.fillStyle = "#c7b8ff";
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.8 * pulse;
        ctx.strokeStyle = "#c7b8ff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.beginPath();
        for (const [x, z] of [[base.x0, base.z1], [base.x1, base.z1], [base.x1, base.z0]]) {
          const [ax, ay] = P(x, z), [bx, by] = P(x, z, y1 - 1);
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // The racer's name beside it.
      // (On the right: the landmark's name is on the left.)
      const [rx, ry] = P(base.x1, base.z0, y1 - 0.5);
      this.ghostTag(`👻 ${g.name} · ${g.floors}`, Math.min(view.W - 8, rx + 8), ry, ahead ? 1 : 0.55, "left");
    } else if (ahead) {
      // Out of sight above: a tag at the top saying how far ahead it is.
      this.ghostTag(`👻 ${g.name} ↑ ${g.floors - level}`, view.W - 10, f.hudBottom + 22, 1, "right");
    }
    ctx.restore();
  }

  private ghostTag(label: string, x: number, y: number, alpha: number, align: "left" | "right"): void {
    const { ctx } = this;
    ctx.font = `800 12px ${UI_FONT}`;
    const w = ctx.measureText(label).width + 18, left = align === "right" ? Math.max(6, x - w) : Math.min(x, this.view.W - w - 6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(76, 58, 160, 0.88)";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left, y - 11, w, 22, 11) : ctx.rect(left, y - 11, w, 22); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, left + w / 2, y + 1);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  private drawBestLine(f: Frame): void {
    const { ctx, view } = this, level = f.sim.level;
    const ahead = f.bestFloors - level;
    if (ahead < -3 || ahead > 40) return;
    const [, y] = view.project(0, f.bestFloors + 1, 0);
    if (y < f.hudBottom + 10 || y > view.H - 10) return;
    ctx.save();
    ctx.globalAlpha = ahead >= 0 ? 0.9 : Math.max(0, 0.9 + ahead * 0.3);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff6f9c";
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(view.W, y); ctx.stroke();
    ctx.setLineDash([]);
    const label = ahead >= 0 ? t("BEST {n} m", { n: f.bestFloors * 5 }) : t("NEW BEST!");
    ctx.font = `800 12px ${UI_FONT}`;
    const w = ctx.measureText(label).width + 18, x = view.W - w - 10;
    ctx.fillStyle = "#ff4f8b";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - 11, w, 22, 11) : ctx.rect(x, y - 11, w, 22); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + 1);
    ctx.restore();
  }
}

function makeCloudTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  for (const [x, y, r] of [[70, 80, 46], [125, 62, 58], [180, 80, 44], [105, 90, 40], [155, 92, 40]]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.7, "rgba(255,255,255,0.6)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeTree(o: THREE.Object3D, materials = true): void {
  o.traverse(c => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    if (materials) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose());
  });
}


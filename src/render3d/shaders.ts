// Shader touches for the business town, added to its standard materials (so lights, shadows
// and fog still work). Each is a little math per pixel or vertex, no extra textures:
// - water: rolling waves that bend the light (real sun glints and sky reflections), deep blue
//   out at sea fading to turquoise over the sand, a hint of foam on the biggest crests;
// - glass: windows reflect the sky (more at a glancing angle) with a slow shine sweeping by;
// - ground and streets: patchy lawns, drifting cloud shadows, warm pools of light under the
//   street lamps at night, and in the rain dark wet asphalt with puddles that reflect the
//   sky and ripple with drops;
// - sway: leaves and palm fronds in the breeze.
// One set of uniforms drives them all. `motion` is 0 with reduced motion (everything holds still).
import * as THREE from "three";

export const MAX_LAMPS = 32;

export interface TownLook {
  /** 0 by day, 1 at night. */
  night: number;
  /** 0 to 1 around sunset (warm, low light). */
  dusk: number;
  /** 0 dry, 1 raining. */
  wet: number;
  skyTop: THREE.Color;
  skyBot: THREE.Color;
  /** Toward the sun, in world space. */
  sun: THREE.Vector3;
}

export interface TownFx {
  time: { value: number };
  motion: { value: number };
  look(l: Partial<TownLook>): void;
  /** Street lamp positions (world space). */
  lamps(p: THREE.Vector3[]): void;
  /** Where the shoreline is (world z): the sea gets deeper away from it. */
  shore(z: number): void;
  ground(m: THREE.MeshStandardMaterial, strength?: number): void;
  street(m: THREE.MeshStandardMaterial): void;
  water(m: THREE.MeshStandardMaterial, sea?: boolean): void;
  glass(m: THREE.MeshStandardMaterial): void;
  sway(m: THREE.MeshStandardMaterial, base?: number, amp?: number): void;
}

const NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// The view direction and a normal, in world space (the town camera is orthographic).
vec3 fxView() { return normalize((vec4(isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition), 0.0) * viewMatrix).xyz); }
vec3 fxWorldN(vec3 n) { return normalize((vec4(n, 0.0) * viewMatrix).xyz); }
vec3 fxSky(vec3 r) { return mix(uFxSkyBot, uFxSkyTop, smoothstep(-0.05, 0.7, r.y)); }
float fxLamps(vec3 w) {
  float s = 0.0;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uFxLampN) break;
    vec2 d = uFxLamps[i].xz - w.xz;
    s += exp(-dot(d, d) * 1.6);
  }
  return s;
}`;

const HEAD = /* glsl */ `uniform float uFxT; uniform float uFxM; uniform float uFxNight; uniform float uFxDusk; uniform float uFxWet;
uniform vec3 uFxSkyTop; uniform vec3 uFxSkyBot; uniform vec3 uFxSun; uniform vec3 uFxLamps[${MAX_LAMPS}]; uniform int uFxLampN; uniform float uFxShore;
varying vec3 vFxW;`;

const LAMP = "vec3(1.0, 0.72, 0.38)";

export function townFx(calm: boolean): TownFx {
  const time = { value: 0 }, motion = { value: calm ? 0 : 1 };
  const U = {
    uFxT: time, uFxM: motion,
    uFxNight: { value: 0 }, uFxDusk: { value: 0 }, uFxWet: { value: 0 },
    uFxSkyTop: { value: new THREE.Color(0.35, 0.6, 0.95) }, uFxSkyBot: { value: new THREE.Color(0.85, 0.9, 1) },
    uFxSun: { value: new THREE.Vector3(0.35, 0.6, -1).normalize() },
    uFxLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) }, uFxLampN: { value: 0 },
    uFxShore: { value: 0 },
  };
  /** Adds the shared uniforms and the world position, then this material's own changes. */
  const hook = (m: THREE.Material, key: string, fn: (s: THREE.WebGLProgramParametersWithUniforms) => void, k?: Record<string, { value: unknown }>) => {
    // Keep this material as it is when the town merges its static meshes (a merged copy
    // would lose the shader step).
    m.userData.dynamic = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => {
      prev.call(m, s, r);
      Object.assign(s.uniforms, U, k ?? {});
      s.vertexShader = "varying vec3 vFxW;\n" + s.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vFxW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      s.fragmentShader = s.fragmentShader.replace("void main() {", `${HEAD}\n${NOISE}\nvoid main() {`);
      fn(s);
    };
    const pk = m.customProgramCacheKey;
    m.customProgramCacheKey = () => pk.call(m) + "|" + key;
  };
  const frag = (s: THREE.WebGLProgramParametersWithUniforms, at: string, code: string) => {
    s.fragmentShader = s.fragmentShader.replace(at, `${at}\n  {\n${code}\n  }`);
  };
  const beforeMain = (s: THREE.WebGLProgramParametersWithUniforms, code: string) => {
    s.fragmentShader = s.fragmentShader.replace("void main() {", `${code}\nvoid main() {`);
  };

  return {
    time, motion,
    look(l) {
      if (l.night !== undefined) U.uFxNight.value = l.night;
      if (l.dusk !== undefined) U.uFxDusk.value = l.dusk;
      if (l.wet !== undefined) U.uFxWet.value = l.wet;
      if (l.skyTop) U.uFxSkyTop.value.copy(l.skyTop);
      if (l.skyBot) U.uFxSkyBot.value.copy(l.skyBot);
      if (l.sun) U.uFxSun.value.copy(l.sun).normalize();
    },
    lamps(p) {
      const n = Math.min(MAX_LAMPS, p.length);
      for (let i = 0; i < n; i++) U.uFxLamps.value[i].copy(p[i]);
      U.uFxLampN.value = n;
    },
    shore(z) { U.uFxShore.value = z; },

    ground(m, strength = 1) {
      hook(m, "fxground" + strength, s => {
        beforeMain(s, "uniform float uFxK;");
        frag(s, "#include <color_fragment>", `
    // Patches of lighter and darker grass, cloud shadows drifting slowly across, a little
    // darker when wet.
    float v = fxNoise(vFxW.xz * 0.9) * 0.6 + fxNoise(vFxW.xz * 3.1) * 0.4;
    diffuseColor.rgb *= 1.0 + (v - 0.5) * 0.16 * uFxK;
    float c = fxNoise(vFxW.xz * 0.11 + vec2(uFxT * 0.018, uFxT * 0.007));
    diffuseColor.rgb *= 1.0 - smoothstep(0.55, 0.8, c) * 0.13 * uFxK * (1.0 - uFxNight);
    diffuseColor.rgb *= 1.0 - uFxWet * 0.15;`);
        frag(s, "#include <emissivemap_fragment>", `
    // Warm pools of light under the street lamps after dark.
    totalEmissiveRadiance += ${LAMP} * fxLamps(vFxW) * uFxNight * 0.35 * diffuseColor.rgb;`);
      }, { uFxK: { value: strength } });
    },

    street(m) {
      hook(m, "fxstreet", s => {
        beforeMain(s, "float fxPud = 0.0;");
        frag(s, "#include <color_fragment>", `
    // Rain: darker asphalt, and puddles in the low spots.
    float pud = smoothstep(0.58, 0.72, fxNoise(vFxW.xz * 1.1) * 0.7 + fxNoise(vFxW.xz * 4.0) * 0.3) * uFxWet;
    diffuseColor.rgb *= 1.0 - uFxWet * 0.3 - pud * 0.25;
    fxPud = pud;`);
        frag(s, "#include <roughnessmap_fragment>", `
    roughnessFactor = mix(roughnessFactor, 0.06, max(fxPud, uFxWet * 0.35));`);
        frag(s, "#include <emissivemap_fragment>", `
    vec3 V = fxView();
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    // The puddles reflect the sky, and drops make rings in them.
    vec2 cell = floor(vFxW.xz * 3.0), lc = fract(vFxW.xz * 3.0) - 0.5;
    float ph = fract(uFxT * uFxM * 1.3 + fxHash(cell) * 7.0);
    float ring = smoothstep(0.035, 0.0, abs(length(lc) - ph * 0.42)) * (1.0 - ph);
    totalEmissiveRadiance += fxSky(R) * fxPud * (0.45 - uFxNight * 0.25) + vec3(0.8, 0.9, 1.0) * ring * fxPud * 0.35;
    // Lamp light on the street, and its reflection in the wet road.
    float L = fxLamps(vFxW);
    totalEmissiveRadiance += ${LAMP} * L * uFxNight * (0.28 * diffuseColor.rgb + (uFxWet * 0.25 + fxPud * 0.5));`);
      });
    },

    water(m, sea = false) {
      hook(m, sea ? "fxsea" : "fxpool", s => {
        beforeMain(s, `uniform float uFxSea;
float fxH = 0.0;
// The water's height: three swells from different directions, plus small choppy waves.
float fxWave(vec2 p, float t) {
  float h = sin(dot(p, vec2(0.25, 0.97)) * 2.6 + t * 1.5) * 0.45;
  h += sin(dot(p, vec2(-0.6, 0.8)) * 3.7 + t * 1.9) * 0.3;
  h += sin(dot(p, vec2(0.9, 0.42)) * 5.3 - t * 2.3) * 0.18;
  h += (fxNoise(p * 3.0 + vec2(t * 0.6, t * 0.3)) - 0.5) * 0.5;
  h += (fxNoise(p * 7.0 - vec2(t * 0.9, -t * 0.5)) - 0.5) * 0.22;
  return h;
}`);
        frag(s, "#include <normal_fragment_maps>", `
    // Bend the surface with the waves, so the sun and the sky catch them like real water.
    float tt = uFxT * uFxM;
    vec2 p = vFxW.xz;
    float e = 0.04;
    float h0 = fxWave(p, tt), hx = fxWave(p + vec2(e, 0.0), tt), hz = fxWave(p + vec2(0.0, e), tt);
    float bump = mix(0.07, 0.11, uFxSea) * (1.0 + uFxWet * 0.5);
    vec3 nW = normalize(vec3(-(hx - h0) / e * bump, 1.0, -(hz - h0) / e * bump));
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
    fxH = h0;`);
        frag(s, "#include <emissivemap_fragment>", `
    vec3 V = fxView();
    vec3 N = fxWorldN(normal);
    float depth = uFxSea > 0.5 ? clamp((uFxShore - vFxW.z) / 4.5, 0.0, 1.0) : 0.35;
    // Deep blue out at sea, clear turquoise over the sand near the beach.
    vec3 shallow = vec3(0.10, 0.62, 0.66), deep = vec3(0.012, 0.13, 0.36);
    diffuseColor.rgb = mix(shallow, deep, pow(depth, 0.7));
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    float day = 1.0 - uFxNight * 0.75;
    // The sky in the water (more at a glancing angle), the sun's glitter on the waves,
    // light through the top of a wave, and foam only on the biggest crests.
    totalEmissiveRadiance += fxSky(R) * (0.12 + fr * 0.85) * day;
    float glit = pow(max(dot(R, uFxSun), 0.0), 220.0);
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.82) * glit * 2.6 * day * (1.0 - uFxWet * 0.8);
    totalEmissiveRadiance += vec3(0.08, 0.42, 0.36) * smoothstep(0.35, 0.9, fxH) * 0.22 * (1.0 - depth * 0.5) * day;
    float cap = smoothstep(0.95, 1.15, fxH) * (0.5 + 0.5 * fxNoise(vFxW.xz * 9.0 + uFxT * uFxM)) * uFxSea;
    totalEmissiveRadiance += vec3(0.9) * cap * 0.35 * day;
    totalEmissiveRadiance += ${LAMP} * fxLamps(vFxW) * uFxNight * 0.5;`);
      }, { uFxSea: { value: sea ? 1 : 0 } });
    },

    glass(m) {
      hook(m, "fxglass", s => {
        frag(s, "#include <emissivemap_fragment>", `
    // Windows mirror the sky (strongest at a glancing angle) and catch a slow sweeping shine.
    vec3 V = fxView();
    vec3 N = fxWorldN(normal);
    vec3 R = reflect(-V, N);
    float fr = 0.08 + 0.92 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    float day = 1.0 - uFxNight * 0.8;
    totalEmissiveRadiance += fxSky(R) * fr * 0.55 * day;
    float band = fract(dot(vFxW, vec3(0.11, 0.05, 0.11)) - uFxT * uFxM * 0.035);
    float shine = smoothstep(0.0, 0.025, band) * smoothstep(0.07, 0.03, band);
    totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * shine * 0.3 * day;
    totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * pow(max(dot(R, uFxSun), 0.0), 60.0) * 0.8 * day;
    // At sunset the glass glows orange.
    totalEmissiveRadiance += vec3(1.0, 0.5, 0.2) * uFxDusk * fr * 0.35;`);
      });
    },

    sway(m, base = 0.45, amp = 0.06) {
      const prev = m.onBeforeCompile;
      m.userData.dynamic = true;
      m.onBeforeCompile = (s, r) => {
        prev.call(m, s, r);
        s.uniforms.uFxT = time; s.uniforms.uFxM = motion; s.uniforms.uFxWet = U.uFxWet;
        s.vertexShader = s.vertexShader
          .replace("void main() {", "uniform float uFxT; uniform float uFxM; uniform float uFxWet;\nvoid main() {")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
  {
    // The higher a leaf, the more it moves; neighbors move together, like a gust passing
    // (and harder in the rain).
    vec3 w = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float h = max(0.0, transformed.y - ${base.toFixed(3)});
    float ph = uFxT * (1.7 + uFxWet) + w.x * 0.45 + w.z * 0.3;
    float a = ${amp.toFixed(3)} * (1.0 + uFxWet * 0.8) * uFxM;
    transformed.x += sin(ph) * h * a;
    transformed.z += cos(ph * 0.8) * h * a * 0.6;
  }`);
      };
      const pk = m.customProgramCacheKey;
      m.customProgramCacheKey = () => pk.call(m) + "|fxsway";
    },
  };
}

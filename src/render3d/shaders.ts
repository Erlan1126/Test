// Small shader touches for the business town, added to its standard materials (so lights,
// shadows and fog still work). Each is a few lines of math per pixel or vertex:
// - ground: soft color variation across the lawns and slow cloud shadows drifting over;
// - water: moving ripples, a sparkle where the sun catches the waves;
// - sway: leaves and palm fronds moving in the breeze.
// One `time` uniform drives them all; `motion` is 0 with reduced motion (everything holds still).
import * as THREE from "three";

export interface TownFx {
  time: { value: number };
  motion: { value: number };
  ground(m: THREE.MeshStandardMaterial, strength?: number): void;
  water(m: THREE.MeshStandardMaterial, strength?: number): void;
  sway(m: THREE.MeshStandardMaterial, base?: number, amp?: number): void;
}

const NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

/** Passes the world position to the fragment shader. */
const withWorldPos = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
  shader.vertexShader = "varying vec3 vFxW;\n" + shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vFxW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  shader.fragmentShader = "varying vec3 vFxW;\n" + shader.fragmentShader;
};

/** Adds an onBeforeCompile step without losing one already there. */
const chain = (m: THREE.Material, key: string, fn: (s: THREE.WebGLProgramParametersWithUniforms) => void): void => {
  // Keep this material as it is when the town merges its static meshes (a merged copy
  // would lose the shader step).
  m.userData.dynamic = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => { prev.call(m, s, r); fn(s); };
  const pk = m.customProgramCacheKey;
  m.customProgramCacheKey = () => pk.call(m) + "|" + key;
};

export function townFx(calm: boolean): TownFx {
  const time = { value: 0 }, motion = { value: calm ? 0 : 1 };
  return {
    time, motion,
    ground(m, strength = 1) {
      chain(m, "fxground", s => {
        s.uniforms.uFxT = time; s.uniforms.uFxK = { value: strength };
        withWorldPos(s);
        s.fragmentShader = s.fragmentShader
          .replace("void main() {", `uniform float uFxT; uniform float uFxK;\n${NOISE}\nvoid main() {`)
          .replace("#include <color_fragment>", `#include <color_fragment>
  {
    // Patches of lighter and darker grass, and cloud shadows drifting slowly across.
    float v = fxNoise(vFxW.xz * 0.9) * 0.6 + fxNoise(vFxW.xz * 3.1) * 0.4;
    diffuseColor.rgb *= 1.0 + (v - 0.5) * 0.16 * uFxK;
    float c = fxNoise(vFxW.xz * 0.11 + vec2(uFxT * 0.018, uFxT * 0.007));
    diffuseColor.rgb *= 1.0 - smoothstep(0.55, 0.8, c) * 0.13 * uFxK;
  }`);
      });
    },
    water(m, strength = 1) {
      chain(m, "fxwater", s => {
        s.uniforms.uFxT = time; s.uniforms.uFxK = { value: strength }; s.uniforms.uFxM = motion;
        withWorldPos(s);
        s.fragmentShader = s.fragmentShader
          .replace("void main() {", `uniform float uFxT; uniform float uFxK; uniform float uFxM;\n${NOISE}\nvoid main() {`)
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  {
    // Two layers of ripples moving across each other, a lighter crest where they meet,
    // and tiny sparkles that come and go.
    float tt = uFxT * uFxM;
    vec2 p = vFxW.xz;
    float a = fxNoise(p * 1.6 + vec2(tt * 0.35, tt * 0.12));
    float b = fxNoise(p * 2.3 - vec2(tt * 0.18, tt * 0.31));
    float crest = smoothstep(0.62, 0.9, (a + b) * 0.5);
    float spark = step(0.985, fxHash(floor(p * 9.0) + floor(tt * 2.0))) * smoothstep(0.55, 0.8, a);
    totalEmissiveRadiance += (vec3(0.55, 0.8, 1.0) * crest * 0.32 + vec3(1.0) * spark * 0.9) * uFxK;
    diffuseColor.rgb *= 0.92 + (a - 0.5) * 0.16;
  }`);
      });
    },
    sway(m, base = 0.45, amp = 0.06) {
      chain(m, "fxsway", s => {
        s.uniforms.uFxT = time; s.uniforms.uFxM = motion;
        s.vertexShader = s.vertexShader
          .replace("void main() {", "uniform float uFxT; uniform float uFxM;\nvoid main() {")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
  {
    // The higher a leaf, the more it moves; neighbors move together, like a gust passing.
    vec3 w = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float h = max(0.0, transformed.y - ${base.toFixed(3)});
    float ph = uFxT * 1.7 + w.x * 0.45 + w.z * 0.3;
    transformed.x += sin(ph) * h * ${amp.toFixed(3)} * uFxM;
    transformed.z += cos(ph * 0.8) * h * ${(amp * 0.6).toFixed(3)} * uFxM;
  }`);
      });
    },
  };
}

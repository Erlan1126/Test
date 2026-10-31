// Shader post-processing: the 2D scene is uploaded to WebGL each frame and finished with
// bloom, tilt-shift depth of field, color grading, a vignette and fine grain. If WebGL is
// unavailable (or the context is lost) the game simply shows the plain 2D canvas.

const VERT = `
attribute vec2 aPos;
varying vec2 v;
void main() {
  v = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `precision mediump float;
varying vec2 v;
`;

/** Shrinks the scene to quarter size with a 4-tap average. With uThresh > 0 it keeps only
 *  bright parts (the light that should glow). */
const DOWN = HEAD + `
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThresh;
void main() {
  vec3 c = texture2D(uTex, v + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(uTex, v + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(uTex, v + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(uTex, v + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  if (uThresh > 0.0) {
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThresh, uThresh + 0.22, l);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/** 9-tap Gaussian blur along one direction. */
const BLUR = HEAD + `
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uTex, v).rgb * 0.227;
  c += (texture2D(uTex, v + uDir * 1.385).rgb + texture2D(uTex, v - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(uTex, v + uDir * 3.231).rgb + texture2D(uTex, v - uDir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;

const FINAL = HEAD + `
uniform sampler2D uScene;
uniform sampler2D uSoft;
uniform sampler2D uGlow;
uniform vec2 uRes;
uniform float uTime;
uniform float uNight;
uniform float uWarm;
uniform float uBloom;
uniform float uTilt;
uniform float uFocus;
uniform float uSpan;
uniform vec2 uSun;
uniform float uSunAmt;
uniform vec3 uFog;
uniform float uFogAmt;
uniform vec4 uRipple;
uniform float uAspect;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  // Shockwave from a perfect drop: the image ripples outward from where the floor landed.
  vec2 uv = v;
  if (uRipple.w > 0.0 && uRipple.z < 1.2) {
    vec2 dv = (v - uRipple.xy) * vec2(uAspect, 1.0);
    float dist = length(dv), front = uRipple.z * 0.9;
    float ring = exp(-pow((dist - front) * 18.0, 2.0)) * (1.0 - uRipple.z / 1.2);
    uv -= normalize(dv + 1e-5) / vec2(uAspect, 1.0) * ring * 0.012 * uRipple.w;
  }

  // Subtle lens fringing toward the edges.
  vec2 off = (uv - 0.5) * 0.0028;
  vec3 c = vec3(texture2D(uScene, uv + off).r, texture2D(uScene, uv).g, texture2D(uScene, uv - off).b);
  vec3 soft = texture2D(uSoft, uv).rgb;

  // Tilt-shift: away from the band in focus, fade into the blurred copy. It makes the
  // island read as a tiny model city. Inside the band, extra local contrast keeps it crisp.
  float blurAmt = smoothstep(uSpan, uSpan + 0.32, abs(uv.y - uFocus)) * uTilt;
  c += (c - soft) * 0.28 * (1.0 - blurAmt);
  c = mix(c, soft, blurAmt);

  // Bloom: lit windows, neon trim and the sun spill soft light.
  vec3 glow = texture2D(uGlow, uv).rgb;
  c += glow * uBloom;

  // Sun rays: march from each pixel toward the sun through the bright layer.
  if (uSunAmt > 0.01) {
    vec2 stp = (uSun - uv) / 12.0;
    vec2 p = uv;
    float decay = 1.0, rays = 0.0;
    for (int i = 0; i < 12; i++) {
      p += stp;
      vec3 s = texture2D(uGlow, p).rgb;
      rays += dot(s, vec3(0.333)) * decay;
      decay *= 0.88;
    }
    c += vec3(1.0, 0.85, 0.62) * rays * 0.06 * uSunAmt;
  }

  // Altitude haze: the far-below part of the picture fades into the sky.
  c = mix(c, uFog, smoothstep(0.32, 0.0, uv.y) * uFogAmt);

  // Color grading: warm and golden toward sunset, cool and deep at night.
  c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), uWarm);
  c *= mix(vec3(1.0), vec3(0.9, 0.96, 1.1), uNight);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.12);            // a little more color
  c = (c - 0.5) * 1.06 + 0.5;           // and contrast
  c = c / (1.0 + max(c - 1.0, 0.0));    // soft roll-off instead of hard clipping

  // Vignette to focus the eye on the tower.
  vec2 q = (v - 0.5) * vec2(0.95, 1.15);
  c *= 1.0 - dot(q, q) * mix(0.32, 0.7, uNight);

  // Fine grain, which also hides banding in the sky gradient.
  c += (hash(v * uRes + fract(uTime) * 61.0) - 0.5) * 0.022;
  gl_FragColor = vec4(c, 1.0);
}`;

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface PostParams {
  time: number;
  /** 0 day to 1 night. */
  night: number;
  /** 0 to 1: how golden the light is (sunset). */
  warm: number;
  /** How strongly lit things glow. */
  bloom: number;
  /** Tilt-shift strength (0 off). */
  tilt: number;
  /** Center of the sharp band, 0 top to 1 bottom of the screen. */
  focus: number;
  /** Half-height of the sharp band. */
  span: number;
  /** Sun position (0-1 screen, y down) and how strongly it casts rays. */
  sun: { x: number; y: number; amount: number };
  /** Haze color (0-255) and amount, for the depth below the tower. */
  fog: [number, number, number];
  fogAmount: number;
  ripple: { x: number; y: number; age: number; strength: number };
  /** Screen width / height. */
  aspect: number;
}

export class PostFX {
  private gl: WebGLRenderingContext | null = null;
  private progs: Record<"down" | "blur" | "final", WebGLProgram> | null = null;
  private scene: WebGLTexture | null = null;
  private targets: Target[] = [];
  private lost = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    try {
      this.gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "low-power" })
        ?? null;
      if (this.gl) this.init(this.gl);
    } catch {
      this.gl = null;
    }
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.lost = true; });
  }

  /** Whether shaders can run on this device right now. */
  get ok(): boolean {
    return !!this.gl && !!this.progs && !this.lost;
  }

  private compile(gl: WebGLRenderingContext, frag: string): WebGLProgram {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  }

  private init(gl: WebGLRenderingContext): void {
    try {
      this.progs = { down: this.compile(gl, DOWN), blur: this.compile(gl, BLUR), final: this.compile(gl, FINAL) };
    } catch (e) {
      // Keep playing without effects, but leave a note for debugging.
      console.warn("Skyrise: shader effects are off.", e);
      this.progs = null;
      return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.scene = this.texture(gl);
  }

  private texture(gl: WebGLRenderingContext): WebGLTexture {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Matches the source canvas size. Blur targets run at quarter resolution. */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    if (!gl || !this.progs) return;
    for (const t of this.targets) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    const tw = Math.max(1, Math.round(w / 4)), th = Math.max(1, Math.round(h / 4));
    // 0-1: soft copy for depth of field, 2-3: bloom.
    this.targets = [0, 1, 2, 3].map(() => {
      const tex = this.texture(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb, w: tw, h: th };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private pass(prog: WebGLProgram, target: Target | null, input: WebGLTexture, set: (u: (n: string) => WebGLUniformLocation | null) => void): void {
    const gl = this.gl!;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fb ?? null);
    gl.viewport(0, 0, target?.w ?? this.canvas.width, target?.h ?? this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform1i(u("uTex"), 0);
    set(u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private blur(a: Target, b: Target, spread: number): void {
    const p = this.progs!.blur;
    this.pass(p, b, a.tex, u => this.gl!.uniform2f(u("uDir"), spread / a.w, 0));
    this.pass(p, a, b.tex, u => this.gl!.uniform2f(u("uDir"), 0, spread / a.h));
  }

  render(source: HTMLCanvasElement, p: PostParams): void {
    const gl = this.gl, progs = this.progs;
    if (!gl || !progs || this.lost || !this.targets.length) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const [s0, s1, g0, g1] = this.targets;
    const texel = (t: Target) => [1 / source.width, 1 / source.height, t] as const;

    // Soft copy for depth of field.
    this.pass(progs.down, s0, this.scene!, u => { const [x, y] = texel(s0); gl.uniform2f(u("uTexel"), x, y); gl.uniform1f(u("uThresh"), 0); });
    this.blur(s0, s1, 1);
    // Bright parts only, blurred twice and wider for the glow. Daylight needs a higher
    // threshold or the pale sky would glow too.
    const thresh = 0.9 - p.night * 0.16;
    this.pass(progs.down, g0, this.scene!, u => { const [x, y] = texel(g0); gl.uniform2f(u("uTexel"), x, y); gl.uniform1f(u("uThresh"), thresh); });
    this.blur(g0, g1, 1);
    this.blur(g0, g1, 2.2);

    const f = progs.final;
    gl.useProgram(f);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const u = (n: string) => gl.getUniformLocation(f, n);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene); gl.uniform1i(u("uScene"), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s0.tex); gl.uniform1i(u("uSoft"), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g0.tex); gl.uniform1i(u("uGlow"), 2);
    gl.uniform2f(u("uRes"), this.canvas.width, this.canvas.height);
    gl.uniform1f(u("uTime"), p.time);
    gl.uniform1f(u("uNight"), p.night);
    gl.uniform1f(u("uWarm"), p.warm);
    gl.uniform1f(u("uBloom"), p.bloom);
    gl.uniform1f(u("uTilt"), p.tilt);
    gl.uniform1f(u("uFocus"), 1 - p.focus); // GL's y runs bottom to top
    gl.uniform1f(u("uSpan"), p.span);
    gl.uniform2f(u("uSun"), p.sun.x, 1 - p.sun.y);
    gl.uniform1f(u("uSunAmt"), p.sun.amount);
    gl.uniform3f(u("uFog"), p.fog[0] / 255, p.fog[1] / 255, p.fog[2] / 255);
    gl.uniform1f(u("uFogAmt"), p.fogAmount);
    gl.uniform4f(u("uRipple"), p.ripple.x, 1 - p.ripple.y, p.ripple.age, p.ripple.strength);
    gl.uniform1f(u("uAspect"), p.aspect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }
}

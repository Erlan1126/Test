// The town's little celebrations in 3D: a building that squashes and stretches when it's
// bought, a ring and sparkles for a speed milestone, dust and confetti when a business grows,
// and the manager popping in beside the door when one is hired.
// Everything is made once and reused: one particle cloud (fixed buffers, updated in place),
// one ring, one manager figure. Nothing is allocated per frame.

import * as THREE from "three";

const N = 96;
const still = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const CONFETTI = [0xffd23f, 0xff7a5c, 0xff5fa2, 0x7b6cff, 0x3fc5ff, 0x5ee08a];

export type BurstKind = "sparkle" | "confetti" | "dust";

export class BizJuice {
  readonly group = new THREE.Group();
  // The particles: position, velocity, colour, size and life, in flat arrays.
  private readonly pos = new Float32Array(N * 3);
  private readonly col = new Float32Array(N * 3);
  private readonly size = new Float32Array(N);
  private readonly vel = new Float32Array(N * 3);
  private readonly life = new Float32Array(N);
  private readonly age = new Float32Array(N);
  private readonly base = new Float32Array(N);
  private readonly drag = new Float32Array(N);
  private readonly grav = new Float32Array(N);
  private next = 0;
  private alive = 0;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private readonly points: THREE.Points;
  // The milestone ring: flat on the ground, it grows and fades.
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private ringAt = -1;
  // The manager: a little figure in a suit with a tie.
  private readonly mgr = new THREE.Group();
  private mgrAt = -1;
  private mgrY = 0;
  // The building that bounces: which one, when, for how long and how hard.
  private kick = { id: "", at: 0, ms: 0, amp: 0 };
  private readonly tmp = new THREE.Color();

  constructor(pixelRatio: number) {
    this.group.userData.dynamic = true;
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: pixelRatio } },
      vertexShader: `attribute float aSize; attribute vec3 color; varying vec3 vCol; uniform float uPx;
        void main() { vCol = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx; }`,
      fragmentShader: `varying vec3 vCol;
        void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
          gl_FragColor = vec4(vCol * (1.15 - r * 0.6), smoothstep(0.5, 0.32, r)); }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
    this.group.add(this.points);

    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 6;
    this.ring.visible = false;
    this.group.add(this.ring);

    const suit = new THREE.MeshStandardMaterial({ color: 0x2f3a68, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c79d, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const tie = new THREE.MeshStandardMaterial({ color: 0xe8457a, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 });
    const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); o.castShadow = true; this.mgr.add(o); };
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8).translate(-0.09, 0.18, 0), suit);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8).translate(0.09, 0.18, 0), suit);
    add(new THREE.CylinderGeometry(0.2, 0.22, 0.46, 12).translate(0, 0.58, 0), suit);
    add(new THREE.BoxGeometry(0.12, 0.3, 0.04).translate(0, 0.66, 0.19), shirt);
    add(new THREE.BoxGeometry(0.06, 0.24, 0.03).translate(0, 0.64, 0.215), tie);
    add(new THREE.SphereGeometry(0.17, 14, 10).translate(0, 0.99, 0), skin);
    add(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45).translate(0, 1.01, -0.01), hair);
    // An arm raised in a wave.
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 8).rotateZ(-2.5).translate(0.3, 0.88, 0), suit);
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 8).rotateZ(0.25).translate(-0.25, 0.55, 0), suit);
    this.mgr.visible = false;
    this.group.add(this.mgr);
  }

  /** The screen's pixel ratio (the particles' size is in CSS pixels). */
  px(ratio: number): void { this.mat.uniforms.uPx.value = ratio; }

  /** The bought building bounces: a squash, a stretch and a settle (`big` for a milestone). */
  pulse(id: string, big = false): void {
    if (still()) return;
    this.kick = { id, at: performance.now(), ms: big ? 620 : 300, amp: big ? 0.24 : 0.16 };
  }

  /** Particles from a point in the town (world space). */
  burst(kind: BurstKind, x: number, y: number, z: number, n: number, spread = 1): void {
    if (still()) return;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      let vx: number, vy: number, vz: number;
      if (kind === "sparkle") {
        vx = Math.cos(a) * (1.2 + r * 1.6) * spread; vz = Math.sin(a) * (1.2 + r * 1.6) * spread; vy = 2.5 + Math.random() * 3;
        this.tmp.setHex(k % 3 === 0 ? 0xffffff : 0xffd23f);
        this.base[i] = 10 + Math.random() * 8; this.life[i] = 0.8 + Math.random() * 0.5; this.drag[i] = 2.2; this.grav[i] = 2;
      } else if (kind === "confetti") {
        vx = Math.cos(a) * (1.5 + r * 2.5) * spread; vz = Math.sin(a) * (1.5 + r * 2.5) * spread; vy = 4 + Math.random() * 4;
        this.tmp.setHex(CONFETTI[k % CONFETTI.length]);
        this.base[i] = 6 + Math.random() * 5; this.life[i] = 1.3 + Math.random() * 0.6; this.drag[i] = 1.2; this.grav[i] = 7;
      } else {
        vx = Math.cos(a) * (1.6 + r * 1.4) * spread; vz = Math.sin(a) * (1.6 + r * 1.4) * spread; vy = 0.3 + Math.random() * 0.8;
        this.tmp.setRGB(0.94, 0.88, 0.76);
        this.base[i] = 16 + Math.random() * 14; this.life[i] = 0.9 + Math.random() * 0.5; this.drag[i] = 2.6; this.grav[i] = -0.6;
      }
      this.pos[i * 3] = x + Math.cos(a) * 0.3 * spread; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + Math.sin(a) * 0.3 * spread;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
      this.age[i] = 0;
    }
    this.alive = N;
    this.points.visible = true;
  }

  /** A golden ring that sweeps out over the ground round a building. */
  ringAt3(x: number, y: number, z: number): void {
    if (still()) return;
    this.ring.position.set(x, y, z);
    this.ringAt = performance.now();
    this.ring.visible = true;
  }

  /** The new manager pops up beside the building, waves for a few seconds and steps inside. */
  manager(x: number, y: number, z: number): void {
    this.mgr.position.set(x, y, z);
    this.mgrY = y;
    this.mgr.rotation.y = Math.PI / 4;
    this.mgrAt = performance.now();
    this.mgr.visible = true;
    this.mgr.scale.setScalar(still() ? 1.6 : 0.01);
  }

  /** Every frame (cheap when nothing is going on). Returns true while something moves. */
  update(dt: number, town: { lotGroup(id: string): THREE.Group | undefined }): boolean {
    const now = performance.now();
    let moving = false;
    // The bounce.
    const kk = this.kick;
    if (kk.id) {
      const lg = town.lotGroup(kk.id), k = (now - kk.at) / kk.ms;
      if (lg) {
        if (k >= 1) { lg.scale.set(1, 1, 1); kk.id = ""; }
        else {
          // Squash first (the weight lands), then stretch up, then settle.
          const w = Math.sin(k * Math.PI * 2.5) * Math.pow(1 - k, 1.6) * kk.amp;
          lg.scale.set(1 + w * 0.55, 1 - w, 1 + w * 0.55);
          moving = true;
        }
      } else kk.id = "";
    }
    // The ring.
    if (this.ring.visible) {
      const k = (now - this.ringAt) / 900;
      if (k >= 1) this.ring.visible = false;
      else { this.ring.scale.setScalar(1.2 + 4.3 * (1 - Math.pow(1 - k, 3))); this.ringMat.opacity = 0.9 * (1 - k); }
    }
    // The manager: pops in with an overshoot, bobs and waves, then pops out after 3.5 s.
    if (this.mgr.visible && this.mgrAt >= 0) {
      const s = (now - this.mgrAt) / 1000;
      if (s > 3.9) { this.mgr.visible = false; this.mgrAt = -1; }
      else if (!still()) {
        const inK = Math.min(1, s / 0.35), outK = Math.max(0, (s - 3.5) / 0.4);
        const pop = inK < 1 ? 1 + Math.sin(inK * Math.PI) * 0.35 - (1 - inK) : 1;
        this.mgr.scale.setScalar(Math.max(0.01, pop * (1 - outK)) * 1.6);
        this.mgr.position.y = this.mgrY + Math.abs(Math.sin(s * 6)) * 0.06;
        this.mgr.rotation.y = Math.PI / 4 + Math.sin(s * 3) * 0.25;
      }
    }
    // The particles.
    if (this.alive > 0) {
      let any = false;
      for (let i = 0; i < N; i++) {
        if (this.age[i] >= this.life[i]) { this.size[i] = 0; continue; }
        any = true;
        this.age[i] += dt;
        const f = Math.exp(-this.drag[i] * dt);
        this.vel[i * 3] *= f; this.vel[i * 3 + 2] *= f;
        this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * f - this.grav[i] * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        const k = this.age[i] / this.life[i];
        this.size[i] = this.base[i] * (k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2));
      }
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      if (!any) { this.alive = 0; this.points.visible = false; }
    }
    return moving;
  }
}

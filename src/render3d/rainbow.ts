// The rainbow after rain (data/season.ts rainbowNow): one big soft arc in the sky over the
// town, behind its buildings. A single flat mesh with its colours (and soft edges) in the
// vertices: one draw, no texture, and nothing made per frame.
import * as THREE from "three";

const BANDS = ["#ff4d5e", "#ff9a3c", "#ffe14d", "#5fe07a", "#4fa8ff", "#8a6cff"];

export class TownRainbow {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private k = 0;

  constructor() {
    // A half ring 1 across (radius 1 outside); its bands run from red outside to violet inside,
    // with a clear rim either side, and the feet fade out.
    const inner = 0.82, rings = BANDS.length + 2;
    const geo = new THREE.RingGeometry(inner, 1, 64, rings - 1, 0, Math.PI);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 4), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
      // Which ring this vertex is on, outside (0) to inside (rings - 1).
      const ring = Math.round(((1 - r) / (1 - inner)) * (rings - 1));
      const band = Math.min(BANDS.length - 1, Math.max(0, ring - 1));
      c.set(BANDS[band]);
      const rim = ring === 0 || ring === rings - 1 ? 0 : 1;
      const feet = Math.min(1, Math.max(0, y / r / 0.45));
      col.set([c.r, c.g, c.b, rim * feet * feet], i * 4);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.name = "rainbow";
  }

  /** Fades toward `on`; stands `r` wide-radius at (x, y, z), its face turned `yaw`. */
  update(dt: number, on: boolean, x: number, y: number, z: number, r: number, yaw: number): void {
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 0.6);
    if (!on && this.k < 0.003) this.k = 0;
    const show = this.k > 0;
    this.mesh.visible = show;
    if (!show) return;
    this.mat.opacity = this.k * 0.65;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(r);
    this.mesh.rotation.set(0, yaw, 0);
  }

  dispose(): void { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

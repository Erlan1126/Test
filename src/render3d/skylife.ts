// Life in the sky around a growing tower: now and then something passes behind the top
// floors. Low down it's a flock of birds, higher up a hot-air balloon, and above the clouds
// a little plane with blinking lights. It keeps the sky from feeling empty on a tall tower,
// stays behind the tower (never between you and the sliding floor) and costs a few meshes.
import * as THREE from "three";
import { FH } from "./geom";

export type SkyKind = "birds" | "balloon" | "plane";

/** What passes by at this height (in floors); r is a random number from 0 to 1. */
export function skyKind(level: number, r: number): SkyKind {
  if (level < 22) return "birds";
  if (level < 55) return r < 0.6 ? "balloon" : "birds";
  return r < 0.65 ? "plane" : "balloon";
}

/** Seconds between two passers-by (the first one comes a little sooner). */
export const SKY_GAP: [number, number] = [8, 15];
/** How far behind the tower they pass, in world units (along the view's depth). */
const BEHIND = 5;
/** How far to either side they start and end, in world units along the screen's width. */
const SPAN = 46;
const SPEED: Record<SkyKind, number> = { birds: 6.5, balloon: 2.6, plane: 13 };
const FLOCK = 7;

// The screen's horizontal direction in the straight isometric view.
const HX = Math.SQRT1_2, HZ = -Math.SQRT1_2;

interface Passer { kind: SkyKind; u: number; dir: 1 | -1; y: number; age: number }

export class SkyLife {
  readonly group = new THREE.Group();
  private wait = 5;
  private now: Passer | null = null;
  private readonly birds: THREE.InstancedMesh;
  private readonly balloon = new THREE.Group();
  private readonly balloonMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  private readonly plane = new THREE.Group();
  private readonly lights: { m: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(private readonly random: () => number = Math.random) {
    // Birds: two wings in a shallow V, flapped by squashing them up and down.
    const wing = new THREE.BufferGeometry();
    wing.setAttribute("position", new THREE.Float32BufferAttribute([-0.9, 0.2, -0.25, 0, 0, 0.18, 0, 0, -0.18, 0.9, 0.2, -0.25, 0, 0, -0.18, 0, 0, 0.18], 3));
    wing.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(wing, new THREE.MeshStandardMaterial({ color: 0x2b2f3a, side: THREE.DoubleSide, roughness: 1 }), FLOCK);
    this.birds.frustumCulled = false;

    // A striped hot-air balloon with its basket.
    const env = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12).scale(1, 1.18, 1), this.balloonMat);
    const band = new THREE.Mesh(new THREE.SphereGeometry(2.13, 16, 4, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16).scale(1, 1.18, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8).translate(0, -3.4, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }));
    const ropes = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.2, 4, 1, true).translate(0, -2.6, 0), new THREE.MeshStandardMaterial({ color: 0x5c4a3a, wireframe: true }));
    this.balloon.add(env, band, basket, ropes);

    // A small propeller plane, built along +x, with a red and a green light on its wings.
    const white = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4, metalness: 0.2 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x4dabf7, roughness: 0.4 });
    this.plane.add(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 3.2, 4, 10).rotateZ(Math.PI / 2), white),
      new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 5.2).translate(0.3, 0, 0), trim),
      new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.9).translate(-1.9, 0.1, 0), trim),
      new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.1).translate(-1.95, 0.5, 0), trim),
    );
    for (const [z, color] of [[2.6, 0xff4d4d], [-2.6, 0x51ff7a]] as const) {
      const m = new THREE.MeshBasicMaterial({ color });
      this.lights.push({ m, base: new THREE.Color(color) });
      this.plane.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4).translate(0.3, 0, z), m));
    }

    for (const o of [this.birds, this.balloon, this.plane]) { o.visible = false; this.group.add(o); }
  }

  /** The current passer-by, if any (for tests and the debug panel). */
  get passing(): SkyKind | null { return this.now?.kind ?? null; }

  /** Something passes soon: a landmark was just passed and the sky celebrates. */
  soon(): void { if (!this.now) this.wait = Math.min(this.wait, 0.4); }

  /** Moves things along. `level` is the tower's height in floors; nothing new comes while
   *  `active` is false (not building, or the smooth graphics mode). */
  update(dt: number, time: number, level: number, active: boolean, night: number): void {
    if (!this.now) {
      this.birds.visible = this.balloon.visible = this.plane.visible = false;
      if (!active || level < 3) return;
      this.wait -= dt;
      if (this.wait > 0) return;
      this.wait = SKY_GAP[0] + this.random() * (SKY_GAP[1] - SKY_GAP[0]);
      const dir = this.random() < 0.5 ? 1 : -1;
      // Just above the top floor; being behind the tower lifts it a few more floors on screen.
      this.now = { kind: skyKind(level, this.random()), u: -dir * SPAN, dir, y: (level + 1.5 + this.random() * 2) * FH, age: 0 };
    }
    const n = this.now;
    n.age += dt;
    n.u += n.dir * SPEED[n.kind] * dt;
    // Once it's off the other side (or you stopped building and it's had its moment), it's gone.
    if (Math.abs(n.u) > SPAN || (!active && n.age > 30)) { this.now = null; this.update(0, time, level, false, night); return; }
    // Behind the tower along the view's depth (which also lifts it a few floors on screen,
    // clear of the sliding floor). Not lowered to match: low down that would sink it into
    // the island behind the tower.
    const x = n.u * HX - BEHIND, z = n.u * HZ - BEHIND, y = n.y;
    const face = n.dir > 0 ? Math.PI / 4 : Math.PI / 4 + Math.PI;
    this.birds.visible = n.kind === "birds";
    this.plane.visible = n.kind === "plane";
    if (n.kind !== "balloon") this.balloon.visible = false;
    if (n.kind === "birds") {
      for (let i = 0; i < FLOCK; i++) {
        // A loose V on screen: the leader in front, the others trailing above and below.
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const back = -row * 1.5 * n.dir, out = row * 1.2 * side;
        const flap = Math.sin(time * 11 + i * 0.9);
        this.q.setFromAxisAngle(this.p.set(0, 1, 0), face - Math.PI / 2);
        this.m4.compose(
          this.p.set(x + back * HX, y + out * 0.55 + Math.sin(time * 1.3 + i) * 0.3 + flap * 0.08, z + back * HZ),
          this.q, this.sc.set(1, flap, 1),
        );
        this.birds.setMatrixAt(i, this.m4);
      }
      this.birds.instanceMatrix.needsUpdate = true;
    } else if (n.kind === "balloon") {
      if (!this.balloon.visible) this.balloonMat.color.setHSL(this.random(), 0.75, 0.6);
      this.balloon.visible = true;
      this.balloon.position.set(x, y + Math.sin(time * 0.7) * 0.6, z);
    } else {
      this.plane.position.set(x, y + Math.sin(time * 1.1) * 0.25, z);
      this.plane.rotation.set(Math.sin(time * 0.9) * 0.08, face, 0);
      // The wing lights blink, brighter in the dark.
      const on = Math.sin(time * 6) > 0.4 ? 1 : 0.2 + night * 0.15;
      for (const l of this.lights) l.m.color.copy(l.base).multiplyScalar(on);
    }
  }
}

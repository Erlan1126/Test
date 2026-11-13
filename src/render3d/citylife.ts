// Life on the island: people strolling the sidewalks and around the plaza, a little boat
// on the lake and birds circling overhead. Everything is a few instanced meshes, so the
// whole crowd costs only a handful of draw calls.
import * as THREE from "three";
import { hash } from "../core/util";
import { ISLAND } from "../data/constants";
import { LAKE } from "../render/details";

const I = ISLAND;
const SHIRTS = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x51cf66, 0xf783ac, 0x845ef7, 0xffa94d, 0xffffff];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

/** A walker's route: a straight sidewalk (back and forth) or a loop around the plaza. */
interface Walker { kind: "line" | "loop"; a: [number, number]; b: [number, number]; r: number; speed: number; phase: number }

function walkers(): Walker[] {
  const out: Walker[] = [];
  // Sidewalks along the three roads.
  const lines: [[number, number], [number, number]][] = [
    [[7.6, 1.85], [I - 1, 1.85]], [[7.6, -1.85], [I - 1, -1.85]],
    [[1.85, 7.6], [1.85, I - 1]], [[-1.85, 7.6], [-1.85, I - 1]],
    [[-I + 1, 1.85], [-7.6, 1.85]], [[-I + 1, -1.85], [-7.6, -1.85]],
  ];
  lines.forEach(([a, b], i) => {
    for (let k = 0; k < 2; k++) out.push({ kind: "line", a, b, r: 0, speed: 0.05 + hash(i, k, 3) * 0.04, phase: hash(i, k, 9) });
  });
  // A few people strolling around the plaza.
  for (let k = 0; k < 6; k++) out.push({ kind: "loop", a: [0, 0], b: [0, 0], r: 7.15, speed: (k % 2 ? 1 : -1) * (0.035 + hash(k, 2, 5) * 0.02), phase: k / 6 });
  return out;
}

/** Adds the crowd, the boat and the birds to the island. Returns the per-frame update. */
export function addCityLife(g: THREE.Group): (time: number, night: number) => void {
  const list = walkers(), n = list.length;
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.42, 3, 8).translate(0, 0.38, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6).translate(0, 0.86, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    body.setColorAt(i, c.setHex(SHIRTS[i % SHIRTS.length]));
    head.setColorAt(i, c.setHex(SKIN[Math.floor(hash(i, 4, 4) * SKIN.length)]));
  }
  for (const m of [body, head]) { m.castShadow = true; m.userData.dynamic = true; m.frustumCulled = false; g.add(m); }

  // A small sailboat on the lake.
  const boat = new THREE.Group();
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.38).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })));
  boat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).translate(0, 0.78, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })));
  boat.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 3).translate(0.12, 0.8, 0), new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.6 })));
  boat.userData.dynamic = true;
  boat.traverse(o => { o.castShadow = true; });
  g.add(boat);

  // Two small flocks of birds gliding in wide circles above the city.
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0.12, -0.15, 0, 0, 0.1, 0, 0, -0.1, 0.5, 0.12, -0.15, 0, 0, -0.1, 0, 0, 0.1], 3));
  birdGeo.computeVertexNormals();
  const flock = 10;
  const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f3a, side: THREE.DoubleSide, roughness: 1 }), flock);
  birds.userData.dynamic = true;
  birds.frustumCulled = false;
  g.add(birds);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  return (time, night) => {
    // Fewer people out late at night: the rest are tucked away under the island.
    const out = Math.round(n * (1 - night * 0.6));
    for (let i = 0; i < n; i++) {
      const w = list[i];
      let x: number, z: number, dir: number;
      if (w.kind === "line") {
        const t = (time * w.speed + w.phase) % 2, k = t < 1 ? t : 2 - t;
        x = w.a[0] + (w.b[0] - w.a[0]) * k; z = w.a[1] + (w.b[1] - w.a[1]) * k;
        dir = Math.atan2(w.b[0] - w.a[0], w.b[1] - w.a[1]) + (t < 1 ? 0 : Math.PI);
      } else {
        const a = (time * w.speed + w.phase) * Math.PI * 2;
        x = Math.cos(a) * w.r; z = Math.sin(a) * w.r;
        dir = Math.atan2(-Math.sin(a), Math.cos(a)) + (w.speed < 0 ? Math.PI : 0);
      }
      const bobY = Math.abs(Math.sin(time * 7 + i)) * 0.05 + (i < out ? 0.22 : -40);
      q.setFromAxisAngle(up, dir);
      m4.compose(pos.set(x, bobY, z), q, scl);
      body.setMatrixAt(i, m4);
      head.setMatrixAt(i, m4);
    }
    // Only the people still out are drawn (the rest aren't just moved out of sight).
    body.count = head.count = out;
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;

    const a = time * 0.12;
    boat.position.set(LAKE.x + Math.cos(a) * LAKE.r * 0.5, Math.sin(time * 1.6) * 0.03, LAKE.z + Math.sin(a) * LAKE.r * 0.5);
    boat.rotation.y = -a;

    for (let i = 0; i < flock; i++) {
      const f = i < 5 ? 0 : 1, k = i % 5;
      const ang = time * (f ? -0.07 : 0.09) + f * 2.4 - k * 0.035 * (f ? -1 : 1);
      const r = (f ? 26 : 20) + (k % 2) * 0.9;
      pos.set(Math.cos(ang) * r, (f ? 22 : 16) + Math.sin(time * 0.5 + i) * 0.4 + (k % 2) * 0.4, Math.sin(ang) * r - 8);
      q.setFromAxisAngle(up, -ang + (f ? 0 : Math.PI));
      const flap = 0.55 + Math.abs(Math.sin(time * 6 + i * 1.3)) * 0.6;
      m4.compose(pos, q, scl.set(1.3, flap * 1.3, 1.3));
      birds.setMatrixAt(i, m4);
    }
    scl.set(1, 1, 1);
    birds.instanceMatrix.needsUpdate = true;
  };
}

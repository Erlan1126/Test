// Geometry for buildings: any convex footprint raised into a prism, with texture
// coordinates in world units so window textures line up the same on every floor.
import * as THREE from "three";
import type { XZ } from "../render/footprint";

/** Height of one floor in world units (the 2D view drew a floor 1.3x a ground unit). */
export const FH = 1.3;

/**
 * A prism over a counter-clockwise footprint from y0 to y1 (world units). Group 0 is the
 * walls (u runs along the wall in units of 2 world units, v one floor per unit), group 1
 * the roof. Normals are flat, so angled shapes keep crisp edges; a round footprint's many
 * facets read as a smooth curve once lit.
 */
export function prism(pts: XZ[], y0: number, y1: number, smooth = false, vOff = 0): THREE.BufferGeometry {
  const n = pts.length;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const idx: number[] = [];
  let u = 0;
  const vTop = (y1 - y0) / FH;
  // Vertex normals for smooth (round) footprints: average of the two faces at each corner.
  const edgeN = pts.map((a, i) => {
    const b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  });
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-4) continue;
    let na = edgeN[i], nb = edgeN[i];
    if (smooth) {
      const p = edgeN[(i + n - 1) % n], q = edgeN[(i + 1) % n];
      na = norm2(edgeN[i][0] + p[0], edgeN[i][1] + p[1]);
      nb = norm2(edgeN[i][0] + q[0], edgeN[i][1] + q[1]);
    }
    const base = pos.length / 3;
    pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]);
    nor.push(na[0], 0, na[1], nb[0], 0, nb[1], nb[0], 0, nb[1], na[0], 0, na[1]);
    uv.push(u / 2, vOff, (u + len) / 2, vOff, (u + len) / 2, vOff + vTop, u / 2, vOff + vTop);
    // Wound so the outside is the front face.
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    u += len;
  }
  const wallCount = idx.length;
  // Roof: a fan from the first corner (the footprint is convex).
  const roof = pos.length / 3;
  for (const p of pts) { pos.push(p[0], y1, p[1]); nor.push(0, 1, 0); uv.push(p[0] / 8, p[1] / 8); }
  for (let i = 1; i < n - 1; i++) idx.push(roof, roof + i + 1, roof + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(0, wallCount, 0);
  g.addGroup(wallCount, idx.length - wallCount, 1);
  return g;
}

function norm2(x: number, z: number): number[] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/** A box footprint, counter-clockwise. */
export const boxFoot = (b: { x0: number; x1: number; z0: number; z1: number }): XZ[] =>
  [[b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1], [b.x0, b.z0]];

// Footprints for shaped floors: the shape fitted to a floor's frame, then cut by the floor's
// own rectangle (so a floor that lost its overhang shows a flat, sliced side).
import type { Shape } from "../data/shapes";
import type { Box } from "../logic/rules";

export type XZ = [number, number];

/** The shape fitted to `frame` (the floor before it was cut), clipped to `box`. */
export function footprint(shape: Shape, box: Box, floor: number, frame: Box = box): XZ[] {
  const cx = (frame.x0 + frame.x1) / 2, cz = (frame.z0 + frame.z1) / 2;
  const hx = (frame.x1 - frame.x0) / 2, hz = (frame.z1 - frame.z0) / 2;
  let pts: XZ[] = shape.pts(floor).map(([u, v]) => [cx + u * hx, cz + v * hz]);
  if (frame !== box) pts = clipToBox(pts, box);
  return pts;
}

/** Sutherland–Hodgman clipping of a convex polygon by an axis-aligned rectangle. */
export function clipToBox(pts: XZ[], b: Box): XZ[] {
  const edges: [number, number, number][] = [[0, 1, b.x0], [0, -1, b.x1], [1, 1, b.z0], [1, -1, b.z1]];
  let out = pts;
  for (const [axis, sign, at] of edges) {
    const inside = (p: XZ) => (p[axis] - at) * sign >= -1e-9;
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], c = src[(i + 1) % src.length];
      const ia = inside(a), ic = inside(c);
      if (ia) out.push(a);
      if (ia !== ic) {
        const t = (at - a[axis]) / (c[axis] - a[axis]);
        out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

/** Shrinks a footprint toward its middle by `k` (0.8 keeps 80% of its size). */
export function shrink(pts: XZ[], k: number): XZ[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
}

/** Is the point inside the convex footprint (points going counter-clockwise)? */
export function inside(pts: XZ[], x: number, z: number): boolean {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
  }
  return true;
}

/** The overlap of two convex polygons (either winding), by Sutherland–Hodgman. */
export function clipConvex(subject: XZ[], clip: XZ[]): XZ[] {
  if (subject.length < 3 || clip.length < 3) return [];
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const s = area >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const p = clip[i], q = clip[(i + 1) % clip.length];
    const side = (v: XZ) => s * ((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]));
    const src = out;
    out = [];
    for (let j = 0; j < src.length; j++) {
      const a = src[j], c = src[(j + 1) % src.length];
      const da = side(a), dc = side(c);
      if (da >= -1e-9) out.push(a);
      if ((da >= -1e-9) !== (dc >= -1e-9)) {
        const t = da / (da - dc);
        out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
  }
  return out.length >= 3 ? out : [];
}

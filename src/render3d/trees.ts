// Hand-shaped trees and garden pieces for the town, drawn in code: each one is a single
// geometry with its colours painted on the vertices (soft gradients, darker underneath,
// sunlit on top), so a whole street of them shares one material and merges into one draw.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TreeKind = "oak" | "pine" | "cypress" | "birch" | "cherry" | "maple" | "palm" | "apple";
export type GardenKind = "bush" | "flowerbush" | "hedge" | "bed" | "topiary" | "lamp" | "bench" | "pot";

/** A small, steady random (the same tree always looks the same). */
function rng(seed: number): () => number {
  let a = (Math.floor(seed * 9301 + 49297) >>> 0) || 1;
  return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; };
}

const col = new THREE.Color();
/** One piece, coloured by height: `low` at the bottom of the piece to `high` at the top,
 *  with a little noise so no two leaves are the same shade. */
function paint(geo: THREE.BufferGeometry, low: string, high: string, r: () => number, noise = 0.06): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  g.computeBoundingBox();
  const bb = g.boundingBox!, h = Math.max(1e-4, bb.max.y - bb.min.y);
  const p = g.getAttribute("position"), n = p.count, c = new Float32Array(n * 3);
  const a = new THREE.Color(low), b = new THREE.Color(high);
  // (One shade per face, so the low-poly facets read clearly.)
  for (let i = 0; i < n; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, k = (y - bb.min.y) / h;
    col.copy(a).lerp(b, Math.min(1, Math.max(0, k))).offsetHSL(0, 0, (r() - 0.5) * noise);
    for (let j = 0; j < 3; j++) c.set([col.r, col.g, col.b], (i + j) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}

/** A lumpy ball of leaves: an icosahedron with its points pushed in and out. */
function blob(rad: number, r: () => number, detail = 1, squash = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(rad, detail);
  const p = g.getAttribute("position");
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = seen.get(key);
    if (f === undefined) { f = 0.86 + r() * 0.26; seen.set(key, f); }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * squash, p.getZ(i) * f);
  }
  return g;
}

/** A trunk that tapers and leans a little, with an optional fork. */
function trunk(h: number, r0: number, r: () => number, c1: string, c2: string, lean = 0.08): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const t = new THREE.CylinderGeometry(r0 * 0.6, r0, h, 7, 3).translate(0, h / 2, 0);
  const p = t.getAttribute("position");
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) + Math.sin(y * 2.4) * lean * y); }
  out.push(paint(t, c1, c2, r, 0.04));
  // Roots flaring at the foot.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    out.push(paint(new THREE.ConeGeometry(r0 * 0.45, r0 * 1.6, 4).rotateZ(Math.PI / 2.4).rotateY(a).translate(Math.cos(a) * r0 * 0.7, r0 * 0.25, -Math.sin(a) * r0 * 0.7), c1, c1, r, 0.03));
  }
  return out;
}

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const m = mergeGeometries(parts, false)!;
  parts.forEach(q => q.dispose());
  return m;
};

/** A tree of the given kind, about `s` units tall at s = 1 (a town tree is ~2), standing at
 *  the origin. `seed` picks its shape. */
export function treeGeometry(kind: TreeKind, seed = 1, s = 1): THREE.BufferGeometry {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const bark = "#6b4428", bark2 = "#8a5d3a";
  const crown = (n: number, cy: number, spread: number, rad: number, lo: string, hi: string, squash = 0.85) => {
    // A main mass, then smaller clumps round and above it.
    parts.push(paint(blob(rad, r, 1, squash).translate(0, cy, 0), lo, hi, r));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.8, d = spread * (0.55 + r() * 0.45), rr = rad * (0.55 + r() * 0.3);
      parts.push(paint(blob(rr, r, 1, squash).translate(Math.cos(a) * d, cy + (r() - 0.35) * rad * 0.7, Math.sin(a) * d), lo, hi, r));
    }
    parts.push(paint(blob(rad * 0.62, r, 1, squash).translate((r() - 0.5) * 0.15, cy + rad * 0.62, (r() - 0.5) * 0.15), lo, hi, r));
  };
  switch (kind) {
    case "oak":
      parts.push(...trunk(0.85, 0.11, r, bark, bark2));
      // Two branches into the crown.
      for (const a of [0.7, 2.6]) parts.push(paint(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 5).translate(0, 0.25, 0).rotateZ(0.7).rotateY(a + r()).translate(0, 0.65, 0), bark, bark2, r));
      crown(6, 1.35, 0.42, 0.52, "#2f8a3a", "#8fd45a");
      break;
    case "apple":
      parts.push(...trunk(0.7, 0.1, r, bark, bark2));
      crown(5, 1.15, 0.36, 0.48, "#3a9a40", "#9ee06a", 0.8);
      // Red apples dotted over the crown.
      for (let k = 0; k < 11; k++) {
        const a = r() * Math.PI * 2, e = (r() - 0.3) * 1.2, R = 0.6;
        parts.push(paint(new THREE.IcosahedronGeometry(0.055, 0).translate(Math.cos(a) * Math.cos(e) * R, 1.15 + Math.sin(e) * R * 0.75, Math.sin(a) * Math.cos(e) * R), "#c8202a", "#ff4a3a", r, 0.02));
      }
      break;
    case "cherry":
      parts.push(...trunk(0.75, 0.09, r, "#5a3324", "#7a4a34", 0.14));
      crown(6, 1.2, 0.46, 0.44, "#e86a9a", "#ffd4e6", 0.75);
      // Petals fallen round the foot.
      for (let k = 0; k < 9; k++) { const a = r() * Math.PI * 2, d = 0.3 + r() * 0.45; parts.push(paint(new THREE.CircleGeometry(0.05, 5).rotateX(-Math.PI / 2).translate(Math.cos(a) * d, 0.012, Math.sin(a) * d), "#ffb6d2", "#ffb6d2", r, 0.05)); }
      break;
    case "maple":
      parts.push(...trunk(0.8, 0.1, r, bark, bark2));
      crown(6, 1.3, 0.42, 0.5, "#c8401e", "#ffb53a");
      break;
    case "birch": {
      // A slim white trunk with dark marks, and a light, airy crown.
      const t = paint(new THREE.CylinderGeometry(0.05, 0.075, 1.3, 6, 6).translate(0, 0.65, 0), "#e9e4da", "#fbf8f2", r, 0.02);
      parts.push(t);
      for (let k = 0; k < 7; k++) { const y = 0.15 + r() * 1.05, a = r() * Math.PI * 2; parts.push(paint(new THREE.BoxGeometry(0.05, 0.025, 0.012).translate(0, 0, 0.068).rotateY(a).translate(0, y, 0), "#2a2a2a", "#2a2a2a", r, 0.02)); }
      for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = 0.15 + r() * 0.2; parts.push(paint(blob(0.26 + r() * 0.08, r, 1, 1.1).translate(Math.cos(a) * d, 1.25 + r() * 0.45, Math.sin(a) * d), "#6aa83a", "#d8ef7a", r)); }
      parts.push(paint(blob(0.24, r, 1, 1.2).translate(0, 1.75, 0), "#7ab83e", "#e0f28a", r));
      break;
    }
    case "pine":
      parts.push(paint(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 6).translate(0, 0.25, 0), bark, bark2, r));
      // Four tiers of needles, each a little twisted, with drooping tips.
      for (let k = 0; k < 4; k++) {
        const w = 0.62 - k * 0.13, h = 0.62 - k * 0.07, y = 0.35 + k * 0.36;
        const cone = new THREE.ConeGeometry(w, h, 8, 1).rotateY(r() * 1.5).translate(0, y + h / 2, 0);
        const p = cone.getAttribute("position");
        for (let i = 0; i < p.count; i++) if (p.getY(i) < y + 0.02) p.setY(i, p.getY(i) - 0.06 * (i % 2));
        parts.push(paint(cone, "#1d5a3a", "#5fa86a", r));
      }
      break;
    case "cypress":
      parts.push(paint(new THREE.CylinderGeometry(0.04, 0.07, 0.35, 6).translate(0, 0.17, 0), bark, bark2, r));
      parts.push(paint(blob(0.3, r, 1, 3.0).translate(0, 1.15, 0), "#1f5a34", "#6cb05a", r));
      parts.push(paint(blob(0.2, r, 1, 2.2).translate(0.06, 1.85, 0.03), "#2a6a3c", "#7ec26a", r));
      break;
    case "palm": {
      // A curving, ringed trunk made of segments.
      const segs = 8; let x = 0, y = 0;
      for (let k = 0; k < segs; k++) {
        const h = 0.2, rad = 0.075 - k * 0.004;
        parts.push(paint(new THREE.CylinderGeometry(rad * 0.92, rad, h, 7).translate(x, y + h / 2, 0), k % 2 ? "#a07a4a" : "#8a6238", "#b8925a", r, 0.03));
        x += 0.025 + k * 0.006; y += h * 0.97;
      }
      // Drooping fronds: long leaves bent down at the tips, with a fold down the middle.
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r() * 0.3, L = 0.8 + r() * 0.2;
        const leaf = new THREE.PlaneGeometry(L, 0.34, 8, 2);
        const p = leaf.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          const u = (p.getX(i) + L / 2) / L, v = p.getY(i);
          p.setXYZ(i, u * L, -u * u * 0.45 + Math.abs(v) * 0.25, v * (1 - u * 0.75));
        }
        leaf.rotateY(a).translate(x, y + 0.02, 0);
        const g = paint(leaf, "#2f8a3a", "#9ee06a", r);
        parts.push(g);
        // (Both faces: the leaves are seen from above and below.)
        const back = g.clone(); const bp = back.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < bp.count; i += 3) { const ax = bp.getX(i), ay = bp.getY(i), az = bp.getZ(i); bp.setXYZ(i, bp.getX(i + 1), bp.getY(i + 1), bp.getZ(i + 1)); bp.setXYZ(i + 1, ax, ay, az); }
        back.computeVertexNormals(); parts.push(back);
      }
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; parts.push(paint(new THREE.IcosahedronGeometry(0.06, 0).translate(x + Math.cos(a) * 0.07, y - 0.06, Math.sin(a) * 0.07), "#5a3a1a", "#7a5428", r)); }
      break;
    }
  }
  const m = merge(parts);
  m.scale(s, s, s);
  return m;
}

/** Bushes, hedges, flower beds and street furniture in the same hand-painted style. */
export function gardenGeometry(kind: GardenKind, seed = 1, s = 1): THREE.BufferGeometry {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const flowerCols = [["#ff4f8b", "#ffb0cc"], ["#ffd23f", "#fff2a8"], ["#9a6cff", "#d6c4ff"], ["#ff7a3a", "#ffc08a"], ["#ffffff", "#ffffff"]];
  const flowers = (n: number, R: number, y: number, rise: number, long = 1) => {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = R * Math.sqrt(r()), fc = flowerCols[Math.floor(r() * flowerCols.length)];
      parts.push(paint(new THREE.IcosahedronGeometry(0.045, 0).translate(Math.cos(a) * d * long, y + r() * rise, Math.sin(a) * d), fc[0], fc[1], r, 0.03));
    }
  };
  switch (kind) {
    case "bush":
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + r(), d = 0.12; parts.push(paint(blob(0.2 + r() * 0.06, r, 1, 0.8).translate(Math.cos(a) * d, 0.16, Math.sin(a) * d), "#2f7a36", "#86cc56", r)); }
      parts.push(paint(blob(0.2, r, 1, 0.8).translate(0, 0.28, 0), "#3a8a3a", "#9ad860", r));
      break;
    case "flowerbush":
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + r(), d = 0.12; parts.push(paint(blob(0.2 + r() * 0.06, r, 1, 0.8).translate(Math.cos(a) * d, 0.16, Math.sin(a) * d), "#2f7a36", "#7cc452", r)); }
      parts.push(paint(blob(0.2, r, 1, 0.8).translate(0, 0.28, 0), "#3a8a3a", "#8ed05a", r));
      { const fc = flowerCols[seed % 4]; for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2, e = r() * 1.2, R = 0.3; parts.push(paint(new THREE.IcosahedronGeometry(0.04, 0).translate(Math.cos(a) * Math.cos(e) * R, 0.2 + Math.sin(e) * R * 0.7, Math.sin(a) * Math.cos(e) * R), fc[0], fc[1], r, 0.03)); } }
      break;
    case "hedge": {
      // A clipped hedge with a rounded top and a soft bevel.
      const box = new THREE.BoxGeometry(1.2, 0.42, 0.34, 6, 3, 2);
      const p = box.getAttribute("position");
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.1) { p.setX(i, p.getX(i) * 0.97); p.setZ(i, p.getZ(i) * 0.82); } p.setY(i, y + (r() - 0.5) * 0.015); }
      parts.push(paint(box.translate(0, 0.21, 0), "#2a6e32", "#7cc452", r, 0.08));
      break;
    }
    case "bed":
      // A raised wooden bed of soil, packed with flowers and leaves.
      parts.push(paint(new THREE.BoxGeometry(1.0, 0.16, 0.5).translate(0, 0.08, 0), "#7a5232", "#a07040", r, 0.04));
      parts.push(paint(new THREE.BoxGeometry(0.92, 0.04, 0.42).translate(0, 0.17, 0), "#4a3020", "#5a3a26", r, 0.04));
      for (let k = 0; k < 8; k++) parts.push(paint(blob(0.08, r, 0, 0.7).translate(-0.4 + k * 0.115, 0.22, (r() - 0.5) * 0.25), "#3a8a3a", "#7cc452", r));
      // (The bed is long: the flowers spread along it.)
      flowers(24, 0.2, 0.24, 0.1, 2.1);
      break;
    case "topiary":
      parts.push(paint(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 10).translate(0, 0.15, 0), "#b8623a", "#e08a5a", r, 0.04));
      parts.push(paint(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 10).translate(0, 0.3, 0), "#c87048", "#c87048", r, 0.02));
      parts.push(paint(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 5).translate(0, 0.42, 0), "#6b4428", "#6b4428", r, 0.02));
      parts.push(paint(new THREE.IcosahedronGeometry(0.22, 2).translate(0, 0.68, 0), "#2f7a36", "#8ed05a", r, 0.05));
      break;
    case "pot":
      parts.push(paint(new THREE.CylinderGeometry(0.16, 0.11, 0.24, 9).translate(0, 0.12, 0), "#9a5a3a", "#d0845a", r, 0.04));
      parts.push(paint(blob(0.15, r, 1, 0.8).translate(0, 0.3, 0), "#3a8a3a", "#8ed05a", r));
      flowers(7, 0.12, 0.33, 0.08);
      break;
    case "lamp":
      // A classic black street lamp with a warm glass lantern.
      parts.push(paint(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8).translate(0, 0.06, 0), "#1e2430", "#2e3646", r, 0.02));
      parts.push(paint(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 8).translate(0, 0.86, 0), "#1e2430", "#3a4458", r, 0.02));
      parts.push(paint(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 8).translate(0, 1.64, 0), "#1e2430", "#2e3646", r, 0.02));
      parts.push(paint(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 6).translate(0, 1.77, 0), "#ffe7a0", "#fff6d8", r, 0.02));
      parts.push(paint(new THREE.ConeGeometry(0.13, 0.12, 6).translate(0, 1.93, 0), "#1e2430", "#2e3646", r, 0.02));
      break;
    case "bench": {
      // A park bench: curved iron ends, wooden slats.
      for (let k = 0; k < 4; k++) parts.push(paint(new THREE.BoxGeometry(0.8, 0.03, 0.07).translate(0, 0.32, -0.12 + k * 0.08), "#9a6238", "#c88a52", r, 0.05));
      for (let k = 0; k < 2; k++) parts.push(paint(new THREE.BoxGeometry(0.8, 0.06, 0.025).rotateX(-0.2).translate(0, 0.46 + k * 0.08, -0.18), "#9a6238", "#c88a52", r, 0.05));
      for (const x of [-0.36, 0.36]) {
        parts.push(paint(new THREE.TorusGeometry(0.12, 0.018, 4, 10, Math.PI).rotateY(Math.PI / 2).translate(x, 0.2, 0), "#1e2430", "#2e3646", r, 0.02));
        parts.push(paint(new THREE.BoxGeometry(0.03, 0.4, 0.03).translate(x, 0.4, -0.18), "#1e2430", "#2e3646", r, 0.02));
      }
      break;
    }
  }
  const m = merge(parts);
  m.scale(s, s, s);
  return m;
}

/** The one material every tree and garden piece shares (colours come from the vertices). */
export function natureMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: true, side: THREE.DoubleSide });
}

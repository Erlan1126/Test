// Trees and garden pieces for the town, drawn in code to look natural: a trunk that splits
// into branches, leaf clusters made of many leaf "cards" (a painted texture of real leaf
// shapes, cut out with alpha), lit softly as if light passes through the crown, and darker
// deep inside it. Every piece is one geometry with its colours on the vertices and its
// texture from one shared atlas, so a street of trees is one material and merges into one draw.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TreeKind = "oak" | "pine" | "cypress" | "birch" | "cherry" | "maple" | "palm" | "apple";
export type GardenKind = "bush" | "flowerbush" | "hedge" | "bed" | "topiary" | "lamp" | "bench" | "pot";

/** A small, steady random (the same tree always looks the same). */
function rng(seed: number): () => number {
  let a = (Math.floor(seed * 9301 + 49297) >>> 0) || 1;
  return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; };
}

// ---- The atlas: leaves, needles, a palm frond, bark and plain white, on one texture ----
type Region = [number, number, number, number]; // u0, v0, u1, v1
const R_LEAF: Region = [0, 0.5, 0.5, 1];
const R_NEEDLE: Region = [0.5, 0.5, 1, 1];
const R_FROND: Region = [0, 0.25, 1, 0.5];
const R_BARK: Region = [0, 0, 0.5, 0.25];
const R_PLAIN: Region = [0.75, 0.0, 1, 0.25];

let atlas: THREE.Texture | null = null;
function atlasTexture(): THREE.Texture {
  if (atlas) return atlas;
  const S = 1024, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!, r = rng(7);
  // (Canvas y runs down; texture v runs up: a region [u0,v0,u1,v1] sits at y = (1-v1)..(1-v0).)
  const box = (rg: Region) => ({ x: rg[0] * S, y: (1 - rg[3]) * S, w: (rg[2] - rg[0]) * S, h: (rg[3] - rg[1]) * S });
  const shade = (l: number) => { const v = Math.round(255 * l); return `rgb(${v},${v},${v})`; };
  // Leaves: dozens of leaf shapes packed into a round clump, sparser at the edge.
  {
    const b = box(R_LEAF), cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = b.w * 0.46;
    for (let i = 0; i < 170; i++) {
      const a = r() * Math.PI * 2, d = R * Math.pow(r(), 0.75), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const L = 30 + r() * 24, W = L * (0.45 + r() * 0.15), rot = a + (r() - 0.5) * 1.6;
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = shade(0.72 + r() * 0.28);
      g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
      g.strokeStyle = shade(0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      g.restore();
    }
  }
  // Needles: short strokes fanning out from twigs.
  {
    const b = box(R_NEEDLE), cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = b.w * 0.46;
    g.lineCap = "round";
    for (let t = 0; t < 26; t++) {
      const a = r() * Math.PI * 2, d = R * Math.pow(r(), 0.7), x = cx + Math.cos(a) * d * 0.7, y = cy + Math.sin(a) * d * 0.7;
      const dir = a + (r() - 0.5) * 0.6, len = 40 + r() * 50;
      for (let k = 0; k < 22; k++) {
        const f = k / 22, px = x + Math.cos(dir) * len * f, py = y + Math.sin(dir) * len * f;
        for (const side of [-1, 1]) {
          const na = dir + side * (0.7 + r() * 0.3), nl = 10 + r() * 8;
          g.strokeStyle = shade(0.55 + r() * 0.45); g.lineWidth = 2;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); g.stroke();
        }
      }
    }
  }
  // A palm frond: a stem along the strip with leaflets either side, tapering to the tip.
  {
    const b = box(R_FROND), y0 = b.y + b.h / 2;
    g.strokeStyle = shade(0.7); g.lineWidth = 5; g.beginPath(); g.moveTo(b.x + 6, y0); g.lineTo(b.x + b.w - 6, y0); g.stroke();
    for (let k = 0; k < 64; k++) {
      const f = k / 64, x = b.x + 10 + f * (b.w - 20), len = (b.h * 0.47) * Math.sin(Math.PI * Math.min(1, f * 1.15 + 0.08));
      for (const side of [-1, 1]) {
        g.fillStyle = shade(0.6 + r() * 0.4);
        g.beginPath(); g.moveTo(x - 2, y0); g.quadraticCurveTo(x + 6, y0 + side * len * 0.55, x + 26, y0 + side * len); g.lineTo(x + 30, y0 + side * len * 0.8); g.quadraticCurveTo(x + 16, y0 + side * len * 0.4, x + 12, y0); g.closePath(); g.fill();
      }
    }
  }
  // Bark: long vertical streaks and knots.
  {
    const b = box(R_BARK);
    g.fillStyle = shade(0.8); g.fillRect(b.x, b.y, b.w, b.h);
    for (let k = 0; k < 140; k++) { g.fillStyle = shade(0.45 + r() * 0.45); g.fillRect(b.x + r() * b.w, b.y + r() * b.h, 2 + r() * 5, 20 + r() * 70); }
    for (let k = 0; k < 12; k++) { g.fillStyle = shade(0.35); g.beginPath(); g.ellipse(b.x + r() * b.w, b.y + r() * b.h, 4, 7, 0, 0, Math.PI * 2); g.fill(); }
  }
  // Plain white (painted, stone, metal: the colour comes from the vertices).
  { const b = box(R_PLAIN); g.fillStyle = "#fff"; g.fillRect(b.x, b.y, b.w, b.h); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  atlas = tex;
  return tex;
}

// ---- Building pieces ----
const tmpC = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);

/** Fits a piece's 0..1 UVs into an atlas region (or the middle of the plain one) and paints it
 *  from `low` (bottom) to `high` (top) with a little noise. Returns a non-indexed geometry with
 *  position, normal, uv and color, so every piece merges with every other. */
function finish(geo: THREE.BufferGeometry, region: Region, low: string, high: string, r: () => number, noise = 0.05): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  let uv = g.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const n = g.getAttribute("position").count;
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(n * 2), 2); g.setAttribute("uv", uv); }
  const [u0, v0, u1, v1] = region;
  for (let i = 0; i < n; i++) {
    const u = region === R_PLAIN ? 0.5 : uv.getX(i), v = region === R_PLAIN ? 0.5 : uv.getY(i);
    uv.setXY(i, u0 + (u1 - u0) * u, v0 + (v1 - v0) * v);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox!, h = Math.max(1e-4, bb.max.y - bb.min.y), p = g.getAttribute("position");
  const c = new Float32Array(n * 3), a = new THREE.Color(low), b = new THREE.Color(high);
  for (let i = 0; i < n; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, k = (y - bb.min.y) / h;
    tmpC.copy(a).lerp(b, Math.min(1, Math.max(0, k))).offsetHSL((r() - 0.5) * noise * 0.3, 0, (r() - 0.5) * noise);
    for (let j = 0; j < 3; j++) c.set([tmpC.r, tmpC.g, tmpC.b], (i + j) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** A tapering limb from `a` to `b`, bark-textured. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, col: [string, string], r: () => number): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, 7, 1, true).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize())).translate(a.x, a.y, a.z);
  return finish(g, R_BARK, col[0], col[1], r, 0.04);
}

/** A clump of leaf cards round `at`: each card faces a random way, but its normal points out
 *  from the crown's centre, so the crown lights like one soft mass. Inner cards are darker. */
function clump(out: THREE.BufferGeometry[], at: THREE.Vector3, crown: THREE.Vector3, rad: number, cards: number, size: number,
  region: Region, dark: string, light: string, r: () => number, crownR: number) {
  const cd = new THREE.Color(dark), cl = new THREE.Color(light);
  for (let i = 0; i < cards; i++) {
    const p = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2).normalize().multiplyScalar(rad * Math.pow(r(), 0.5)).add(at);
    const s = size * (0.75 + r() * 0.5);
    const q = new THREE.PlaneGeometry(s, s);
    q.rotateZ(r() * Math.PI * 2).rotateX((r() - 0.5) * 2.2).rotateY(r() * Math.PI * 2).translate(p.x, p.y, p.z);
    const g = q.toNonIndexed();
    // Normals: out from the crown's centre, a little upward (soft, rounded light).
    const nrm = g.getAttribute("normal"), pos = g.getAttribute("position");
    for (let k = 0; k < nrm.count; k++) {
      const v = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(crown).normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize();
      nrm.setXYZ(k, v.x, v.y, v.z);
    }
    // Colour: darker deep inside and underneath, sunlit at the top and the outside.
    const out01 = Math.min(1, p.distanceTo(crown) / Math.max(0.01, crownR)), top = Math.min(1, Math.max(0, (p.y - crown.y) / crownR * 0.5 + 0.5));
    const k = Math.min(1, out01 * 0.55 + top * 0.55);
    tmpC.copy(cd).lerp(cl, k).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08);
    const uv = g.getAttribute("uv"), c = new Float32Array(nrm.count * 3);
    for (let k2 = 0; k2 < nrm.count; k2++) {
      uv.setXY(k2, region[0] + (region[2] - region[0]) * uv.getX(k2), region[1] + (region[3] - region[1]) * uv.getY(k2));
      c.set([tmpC.r, tmpC.g, tmpC.b], k2 * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    out.push(g);
  }
}

/** Branches: from the top of the trunk, `n` limbs reach up and out, each splitting once; the
 *  tips are where the leaf clumps go. */
function branches(out: THREE.BufferGeometry[], base: THREE.Vector3, n: number, len: number, rad: number, spread: number, r: () => number, bark: [string, string]): THREE.Vector3[] {
  const tips: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.9, tilt = spread * (0.7 + r() * 0.5);
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
    const end = base.clone().addScaledVector(dir, len * (0.8 + r() * 0.4));
    out.push(limb(base, end, rad, rad * 0.6, bark, r));
    for (let j = 0; j < 2; j++) {
      const a2 = a + (j ? 0.7 : -0.7) + (r() - 0.5) * 0.5, t2 = tilt * (0.6 + r() * 0.6);
      const d2 = new THREE.Vector3(Math.cos(a2) * Math.sin(t2), Math.cos(t2), Math.sin(a2) * Math.sin(t2));
      const e2 = end.clone().addScaledVector(d2, len * (0.45 + r() * 0.3));
      out.push(limb(end, e2, rad * 0.6, rad * 0.3, bark, r));
      tips.push(e2);
    }
    tips.push(end.clone().addScaledVector(dir, len * 0.25));
  }
  return tips;
}

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const m = mergeGeometries(parts, false)!;
  parts.forEach(q => q.dispose());
  return m;
};

/** A tree of the given kind, about 2 units tall at s = 1, standing at the origin. `seed`
 *  picks its shape, so no two trees in a row are the same. */
export function treeGeometry(kind: TreeKind, seed = 1, s = 1): THREE.BufferGeometry {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const bark: [string, string] = ["#5a3a24", "#8a6448"];
  /** A broadleaf tree: trunk, branches, a leafy crown of clumps on the branch tips. */
  const broadleaf = (trunkH: number, trunkR: number, nb: number, blen: number, spread: number, crownR: number, clumpR: number, cards: number, leafSize: number, dark: string, light: string, barkC = bark) => {
    const top = new THREE.Vector3((r() - 0.5) * 0.08, trunkH, (r() - 0.5) * 0.08);
    parts.push(limb(new THREE.Vector3(0, 0, 0), top, trunkR, trunkR * 0.7, barkC, r));
    // Root flare.
    parts.push(finish(new THREE.CylinderGeometry(trunkR * 1.05, trunkR * 1.6, trunkR * 1.2, 7, 1, true).translate(0, trunkR * 0.6, 0), R_BARK, barkC[0], barkC[1], r));
    const tips = branches(parts, top, nb, blen, trunkR * 0.7, spread, r, barkC);
    const crown = new THREE.Vector3(0, top.y + blen * 0.8, 0);
    // A solid core inside each clump, so the crown is full and never see-through.
    const lo = new THREE.Color(dark).lerp(new THREE.Color(light), 0.15).getStyle(), hi = new THREE.Color(dark).lerp(new THREE.Color(light), 0.5).getStyle();
    for (const tp of tips) {
      parts.push(finish(new THREE.SphereGeometry(clumpR * 0.58, 10, 8).translate(tp.x, tp.y, tp.z), R_PLAIN, lo, hi, r, 0.02));
      clump(parts, tp, crown, clumpR, cards + 6, leafSize * 1.15, R_LEAF, dark, light, r, crownR);
    }
    // A few clumps filling the middle, so the crown reads as full.
    for (let k = 0; k < 3; k++) clump(parts, crown.clone().add(new THREE.Vector3((r() - 0.5) * crownR * 0.6, (r() - 0.3) * crownR * 0.5, (r() - 0.5) * crownR * 0.6)), crown, clumpR * 1.1, cards, leafSize, R_LEAF, dark, light, r, crownR);
    return crown;
  };
  switch (kind) {
    case "oak": broadleaf(0.75, 0.1, 4, 0.5, 0.75, 0.85, 0.36, 16, 0.42, "#24521f", "#8fc456"); break;
    case "maple": broadleaf(0.8, 0.09, 4, 0.48, 0.7, 0.8, 0.34, 16, 0.4, "#8a2a12", "#ffa236"); break;
    case "cherry": {
      broadleaf(0.6, 0.08, 4, 0.55, 0.95, 0.85, 0.32, 15, 0.38, "#e0709c", "#ffd8e8", ["#3a2420", "#6a443a"]);
      // Petals on the grass round it.
      for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = 0.25 + r() * 0.7; parts.push(finish(new THREE.CircleGeometry(0.035, 5).rotateX(-Math.PI / 2).translate(Math.cos(a) * d, 0.01, Math.sin(a) * d), R_PLAIN, "#ffc4da", "#ffc4da", r, 0.05)); }
      break;
    }
    case "apple": {
      const crown = broadleaf(0.6, 0.09, 4, 0.45, 0.85, 0.75, 0.32, 15, 0.38, "#2a6024", "#a2d462");
      for (let k = 0; k < 14; k++) {
        const a = r() * Math.PI * 2, e = (r() - 0.25) * 1.3, R = 0.78;
        parts.push(finish(new THREE.SphereGeometry(0.05, 8, 6).translate(crown.x + Math.cos(a) * Math.cos(e) * R, crown.y - 0.1 + Math.sin(e) * R * 0.7, crown.z + Math.sin(a) * Math.cos(e) * R), R_PLAIN, "#a8141e", "#ff4a3a", r, 0.03));
      }
      break;
    }
    case "birch": {
      // Slim, white and tall, with a light and airy crown hanging from thin branches.
      const top = new THREE.Vector3(0.04, 1.2, 0);
      parts.push(limb(new THREE.Vector3(0, 0, 0), top, 0.06, 0.04, ["#dcd6cc", "#f6f2ea"], r));
      for (let k = 0; k < 9; k++) { const y = 0.15 + r() * 1.0, a = r() * Math.PI * 2; parts.push(finish(new THREE.BoxGeometry(0.05, 0.02, 0.01).translate(0, 0, 0.058).rotateY(a).translate(0.03 * y, y, 0), R_PLAIN, "#2a2622", "#2a2622", r, 0.02)); }
      const crown = new THREE.Vector3(0.04, 1.45, 0);
      const tips = branches(parts, new THREE.Vector3(0.03, 0.85, 0), 5, 0.42, 0.03, 0.5, r, ["#cfc8bc", "#eee8de"]);
      for (const tp of tips) clump(parts, tp, crown, 0.22, 10, 0.3, R_LEAF, "#5a8a2a", "#e2f08a", r, 0.6);
      break;
    }
    case "pine": {
      parts.push(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.1, 0), 0.08, 0.02, bark, r));
      // Tiers of needles: a dark solid cone, fringed with needle sprays round its edge that
      // droop outward, so the outline is soft and shaggy like a real pine.
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const w = 0.7 * (1 - t / (tiers + 0.4)), h = 0.62 - t * 0.06, y = 0.32 + t * 0.33;
        parts.push(finish(new THREE.ConeGeometry(w * 0.88, h, 10, 1, true).rotateY(r() * 2).translate(0, y + h / 2, 0), R_PLAIN, "#12301e", "#2e6a3a", r, 0.05));
        const n = 9 + Math.round(w * 10);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + r() * 0.4, sz = 0.26 + w * 0.3;
          const q = new THREE.PlaneGeometry(sz, sz * 0.9);
          q.rotateX(-0.9 - r() * 0.3).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * w * 0.78, y + 0.08 + r() * 0.1, Math.sin(a) * w * 0.78);
          const g = q.toNonIndexed(), nrm = g.getAttribute("normal"), pos = g.getAttribute("position"), uv = g.getAttribute("uv");
          const c = new Float32Array(nrm.count * 3), cd = new THREE.Color("#17402a"), cl = new THREE.Color("#6eaa62");
          tmpC.copy(cd).lerp(cl, 0.35 + (t / tiers) * 0.35 + r() * 0.2);
          for (let k2 = 0; k2 < nrm.count; k2++) {
            const v = new THREE.Vector3(pos.getX(k2), 0.5, pos.getZ(k2)).normalize(); nrm.setXYZ(k2, v.x, v.y, v.z);
            uv.setXY(k2, R_NEEDLE[0] + 0.5 * uv.getX(k2), R_NEEDLE[1] + 0.5 * uv.getY(k2));
            c.set([tmpC.r, tmpC.g, tmpC.b], k2 * 3);
          }
          g.setAttribute("color", new THREE.BufferAttribute(c, 3));
          parts.push(g);
        }
      }
      clump(parts, new THREE.Vector3(0, 2.05, 0), new THREE.Vector3(0, 1.4, 0), 0.1, 6, 0.24, R_NEEDLE, "#1c4a2c", "#6aa864", r, 0.6);
      break;
    }
    case "cypress": {
      parts.push(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.5, 0), 0.06, 0.05, bark, r));
      // A tall flame of dense foliage round a solid dark core.
      const core = new THREE.SphereGeometry(0.2, 12, 10).scale(1, 3.6, 1).translate(0, 1.35, 0);
      parts.push(finish(core, R_PLAIN, "#123420", "#2a5e34", r, 0.04));
      const crown = new THREE.Vector3(0, 1.35, 0);
      for (let k = 0; k < 10; k++) {
        const y = 0.5 + k * 0.19, w = 0.3 * Math.sin(Math.PI * Math.min(1, (k + 1.0) / 10.5));
        clump(parts, new THREE.Vector3(0, y, 0), crown, w, 24, 0.36, R_NEEDLE, "#1a4428", "#6aa85c", r, 0.9);
      }
      break;
    }
    case "palm": {
      // A ringed trunk that curves gently, thicker at the foot.
      const segs = 11; let x = 0, y = 0;
      for (let k = 0; k < segs; k++) {
        const h = 0.17, rad = 0.085 - k * 0.0035, nx = x + 0.012 + k * 0.005;
        parts.push(limb(new THREE.Vector3(x, y, 0), new THREE.Vector3(nx, y + h, 0), rad, rad * 0.86, k % 2 ? ["#8a6a48", "#b39672"] : ["#6e5236", "#9a7c58"], r));
        // A ring where each old frond fell.
        parts.push(finish(new THREE.TorusGeometry(rad * 0.98, 0.012, 4, 10).rotateX(Math.PI / 2).translate(nx, y + h, 0), R_PLAIN, "#5a4028", "#6a4e30", r, 0.03));
        x = nx; y += h * 0.98;
      }
      // The crown shaft: a green swelling where the fronds grow from.
      parts.push(finish(new THREE.SphereGeometry(0.09, 10, 8).scale(1, 1.4, 1).translate(x, y + 0.03, 0), R_PLAIN, "#4a6a2a", "#7a9a3a", r, 0.03));
      // Fronds all the way round: each rises from the crown, arches and droops, its leaflets
      // folded down either side of the stem (a V, like a real palm's).
      const fronds = 12;
      for (let k = 0; k < fronds; k++) {
        const upper = k % 2 === 0, a = (k / fronds) * Math.PI * 2 + r() * 0.25;
        const L = (upper ? 0.85 : 1.05) + r() * 0.15, rise = upper ? 0.55 : 0.32, drop = upper ? 0.85 : 1.05;
        const q = new THREE.PlaneGeometry(L, 0.46, 14, 2), p = q.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          const u = (p.getX(i) + L / 2) / L, v = p.getY(i) / 0.23; // u: 0 at the crown → 1 at the tip; v: -1..1 across
          const arc = u * L * rise - u * u * L * drop;
          const halfW = 0.23 * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.95)); // narrow at both ends
          p.setXYZ(i, u * L, arc - Math.abs(v) * halfW * 0.55, v * halfW);
        }
        q.rotateY(a).translate(x, y + 0.06, 0);
        parts.push(finish(q, R_FROND, "#2c6a24", "#9ccc58", r, 0.06));
        // The stem along the frond's middle.
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(new THREE.Vector3(u * L, u * L * rise - u * u * L * drop + 0.004, 0).applyAxisAngle(up, a).add(new THREE.Vector3(x, y + 0.06, 0))); }
        parts.push(finish(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.008, 4, false), R_PLAIN, "#6a7a2a", "#9aa64a", r, 0.03));
      }
      // Coconuts under the crown.
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; parts.push(finish(new THREE.SphereGeometry(0.05, 10, 8).translate(x + Math.cos(a) * 0.075, y - 0.05, Math.sin(a) * 0.075), R_PLAIN, "#3a2410", "#6a4a22", r, 0.03)); }
      break;
    }
  }
  const m = merge(parts);
  m.scale(s, s, s);
  return m;
}

/** Bushes, hedges, flower beds and street furniture, in the same natural style. */
export function gardenGeometry(kind: GardenKind, seed = 1, s = 1): THREE.BufferGeometry {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  const plain = (g: THREE.BufferGeometry, lo: string, hi: string, n = 0.04) => parts.push(finish(g, R_PLAIN, lo, hi, r, n));
  const flowerCols = [["#e8336f", "#ff9ec0"], ["#f2b800", "#fff0a0"], ["#7a4ae8", "#c8b4ff"], ["#ff6a2a", "#ffc08a"], ["#f4f4f4", "#ffffff"]];
  const blooms = (n: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, pick = -1) => {
    for (let k = 0; k < n; k++) {
      const fc = flowerCols[pick >= 0 ? pick : Math.floor(r() * flowerCols.length)];
      const a = r() * Math.PI * 2, e = r() * 1.3;
      plain(new THREE.IcosahedronGeometry(0.03, 0).translate(cx + Math.cos(a) * Math.cos(e) * rx, cy + Math.sin(e) * ry, cz + Math.sin(a) * Math.cos(e) * rz), fc[0], fc[1], 0.02);
    }
  };
  const leafy = (at: THREE.Vector3, rad: number, cards: number, size: number, dark = "#24521f", light = "#8fc456") =>
    clump(parts, at, at.clone().add(new THREE.Vector3(0, -rad * 0.3, 0)), rad, cards, size, R_LEAF, dark, light, r, rad * 1.2);
  switch (kind) {
    case "bush":
      leafy(new THREE.Vector3(0, 0.2, 0), 0.22, 22, 0.26);
      leafy(new THREE.Vector3(0.15, 0.15, 0.05), 0.16, 12, 0.22);
      break;
    case "flowerbush":
      leafy(new THREE.Vector3(0, 0.2, 0), 0.22, 22, 0.26, "#24521f", "#7ab84a");
      blooms(26, 0, 0.2, 0, 0.24, 0.2, 0.24, seed % 4);
      break;
    case "hedge":
      // A clipped hedge: a green core with leaf cards over every side.
      plain(new THREE.BoxGeometry(1.15, 0.38, 0.3).translate(0, 0.19, 0), "#1e4a1c", "#3a7a2e");
      for (let k = 0; k < 10; k++) leafy(new THREE.Vector3(-0.5 + k * 0.11, 0.24 + (r() - 0.5) * 0.06, (r() - 0.5) * 0.06), 0.17, 9, 0.2, "#24521f", "#86c04e");
      break;
    case "bed":
      plain(new THREE.BoxGeometry(1.0, 0.14, 0.5).translate(0, 0.07, 0), "#6a4428", "#9a6a40");
      plain(new THREE.BoxGeometry(0.92, 0.03, 0.42).translate(0, 0.15, 0), "#3a2618", "#4a3020");
      for (let k = 0; k < 6; k++) leafy(new THREE.Vector3(-0.38 + k * 0.15, 0.22, (r() - 0.5) * 0.15), 0.1, 6, 0.14, "#2a5a22", "#7ab84a");
      for (let k = 0; k < 30; k++) { const fc = flowerCols[Math.floor(r() * flowerCols.length)]; plain(new THREE.IcosahedronGeometry(0.035, 0).translate(-0.42 + r() * 0.84, 0.25 + r() * 0.08, (r() - 0.5) * 0.34), fc[0], fc[1], 0.02); }
      break;
    case "topiary":
      plain(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14).translate(0, 0.15, 0), "#a05030", "#d8805a");
      plain(new THREE.TorusGeometry(0.2, 0.02, 6, 16).rotateX(Math.PI / 2).translate(0, 0.3, 0), "#b86440", "#c87048");
      parts.push(limb(new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0, 0.55, 0), 0.02, 0.018, ["#5a3a24", "#7a5a3a"], r));
      leafy(new THREE.Vector3(0, 0.7, 0), 0.2, 30, 0.2, "#1e4a1c", "#7ab84a");
      break;
    case "pot":
      plain(new THREE.CylinderGeometry(0.16, 0.11, 0.24, 14).translate(0, 0.12, 0), "#8a4a2a", "#d0845a");
      leafy(new THREE.Vector3(0, 0.3, 0), 0.14, 14, 0.18, "#2a5a22", "#7ab84a");
      blooms(12, 0, 0.32, 0, 0.14, 0.1, 0.14);
      break;
    case "lamp":
      plain(new THREE.CylinderGeometry(0.09, 0.12, 0.14, 12).translate(0, 0.07, 0), "#161b24", "#2e3646");
      plain(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 10).translate(0, 0.86, 0), "#161b24", "#3a4458");
      plain(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 10).translate(0, 1.64, 0), "#161b24", "#2e3646");
      plain(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 6).translate(0, 1.77, 0), "#ffe7a0", "#fff6d8", 0.01);
      plain(new THREE.ConeGeometry(0.13, 0.12, 6).translate(0, 1.93, 0), "#161b24", "#2e3646");
      break;
    case "bench":
      for (let k = 0; k < 4; k++) parts.push(finish(new THREE.BoxGeometry(0.8, 0.03, 0.07).translate(0, 0.32, -0.12 + k * 0.08), R_BARK, "#8a5430", "#c88a52", r, 0.04));
      for (let k = 0; k < 2; k++) parts.push(finish(new THREE.BoxGeometry(0.8, 0.06, 0.025).rotateX(-0.2).translate(0, 0.46 + k * 0.08, -0.18), R_BARK, "#8a5430", "#c88a52", r, 0.04));
      for (const x of [-0.36, 0.36]) {
        plain(new THREE.TorusGeometry(0.12, 0.018, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(x, 0.2, 0), "#161b24", "#2e3646");
        plain(new THREE.BoxGeometry(0.03, 0.4, 0.03).translate(x, 0.4, -0.18), "#161b24", "#2e3646");
      }
      break;
  }
  const m = merge(parts);
  m.scale(s, s, s);
  return m;
}

/** The one material every tree and garden piece shares: the atlas, cut out where the leaves
 *  end, tinted by the vertex colours. */
export function natureMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: atlasTexture(), vertexColors: true, alphaTest: 0.38, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  // (world.ts mergeStatic merges every piece that uses it into one mesh.)
  m.userData.nature = true;
  return m;
}

const shapeCache = new Map<string, THREE.BufferGeometry>();

/** One tree's geometry, placed (for code that adds meshes its own way). */
export function treeGeo(kind: TreeKind, x: number, y: number, z: number, s: number, seed: number): THREE.BufferGeometry {
  const v = Math.abs(Math.round(seed)) % 4, key = `t|${kind}|${v}`;
  let base = shapeCache.get(key);
  if (!base) { base = treeGeometry(kind, 3 + v * 11); shapeCache.set(key, base); }
  const k = s * (0.92 + (Math.abs(seed * 0.37) % 0.16));
  return base.clone().rotateY(seed * 1.7).scale(k, k, k).translate(x, y, z);
}

/** One tree as its own mesh (with the given shared material): for groups that mergeStatic
 *  later merges, so a whole block of them still draws once. */
export function treeMesh(kind: TreeKind, x: number, y: number, z: number, s: number, seed: number, mat: THREE.Material): THREE.Mesh {
  const v = Math.abs(Math.round(seed)) % 4, key = `t|${kind}|${v}`;
  let base = shapeCache.get(key);
  if (!base) { base = treeGeometry(kind, 3 + v * 11); shapeCache.set(key, base); }
  const k = s * (0.92 + (Math.abs(seed * 0.37) % 0.16));
  const m = new THREE.Mesh(base.clone().rotateY(seed * 1.7).scale(k, k, k).translate(x, y, z), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Collects trees and garden pieces for one part of the town and hands them back as a single
 *  mesh (one draw). Each kind comes in four shapes, built once and reused. */
export class NatureBatch {
  private geos: THREE.BufferGeometry[] = [];
  private place(base: THREE.BufferGeometry, x: number, y: number, z: number, s: number, ry: number): void {
    this.geos.push(base.clone().rotateY(ry).scale(s, s, s).translate(x, y, z));
  }
  tree(kind: TreeKind, x: number, y: number, z: number, s: number, seed: number): void {
    const v = Math.abs(Math.round(seed)) % 4, key = `t|${kind}|${v}`;
    let base = shapeCache.get(key);
    if (!base) { base = treeGeometry(kind, 3 + v * 11); shapeCache.set(key, base); }
    this.place(base, x, y, z, s * (0.92 + (Math.abs(seed * 0.37) % 0.16)), seed * 1.7);
  }
  garden(kind: GardenKind, x: number, y: number, z: number, s: number, seed: number, ry = seed * 1.7): void {
    const v = Math.abs(Math.round(seed)) % 4, key = `g|${kind}|${v}`;
    let base = shapeCache.get(key);
    if (!base) { base = gardenGeometry(kind, 2 + v * 7); shapeCache.set(key, base); }
    this.place(base, x, y, z, s, ry);
  }
  get size(): number { return this.geos.length; }
  /** The merged mesh (null when empty). Its material is its own; the leaf atlas is shared. */
  mesh(): THREE.Mesh | null {
    if (!this.geos.length) return null;
    const m = mergeGeometries(this.geos, false);
    this.geos.forEach(q => q.dispose());
    this.geos = [];
    if (!m) return null;
    const mat = natureMaterial();
    mat.userData.own = true;
    const mesh = new THREE.Mesh(m, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}

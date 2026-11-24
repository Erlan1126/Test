// Street decorations for the town's corner plazas and roundabouts, drawn with more care and
// in several designs, so neighbouring blocks don't all look the same: flower pots, planter
// boxes with topiary, stone urns with ivy, bike racks, café tables and flower carts; benches,
// picnic tables and trees in grates; hydrants and mailboxes; and roundabout centres (a tree
// bed, a fountain, a statue or a clock). Everything is plain geometry, merged with the town.
import * as THREE from "three";

export interface DecoKit {
  /** Adds a piece to the town (merged later). */
  put(geo: THREE.BufferGeometry, m: THREE.Material): unknown;
  /** A plain material in a color (cached). */
  c(color: string, rough?: number, metal?: number): THREE.Material;
  leaf: THREE.Material;
  wood: THREE.Material;
  stone: THREE.Material;
  metal: THREE.Material;
  /** A tree (from the town's own kit) standing at x, z on ground at y. */
  tree(x: number, z: number, s: number, y: number): void;
  flowers: string[];
}

/** Small shape helpers that place things standing on y (their base). */
function shapes(k: DecoKit) {
  const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 12) => k.put(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z), m);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0, cx = 0, cz = 0) => k.put(new THREE.BoxGeometry(w, h, d).translate(cx, h / 2, cz).rotateY(ry).translate(x, y, z), m);
  const ball = (r: number, x: number, y: number, z: number, m: THREE.Material, detail = 1) => k.put(new THREE.IcosahedronGeometry(r, detail).translate(x, y, z), m);
  const dot = (r: number, x: number, y: number, z: number, m: THREE.Material) => k.put(new THREE.SphereGeometry(r, 6, 4).translate(x, y, z), m);
  return { cyl, box, ball, dot };
}

/** A pseudo-random number in 0..1 from a seed (the same every time for one spot). */
const rand = (seed: number) => { const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** A bunch of flowers on a bush: little blooms on its top half in two colors. */
function blooms(k: DecoKit, x: number, y: number, z: number, r: number, seed: number, n = 7): void {
  const { dot } = shapes(k);
  const c1 = k.c(k.flowers[seed % k.flowers.length], 0.8), c2 = k.c(k.flowers[(seed + 2) % k.flowers.length], 0.8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed, rr = r * (0.55 + rand(seed + i) * 0.4), up = 0.35 + rand(seed * 3 + i) * 0.5;
    dot(0.045 + rand(seed + i * 7) * 0.02, x + Math.cos(a) * rr, y + r * up, z + Math.sin(a) * rr, i % 2 ? c1 : c2);
  }
}

/** The corner plaza's piece: one of six designs. */
export function plazaPiece(k: DecoKit, x: number, z: number, y: number, n: number): void {
  const { cyl, box, ball, dot } = shapes(k);
  const v = ((n % 6) + 6) % 6;
  if (v === 0) {
    // A terracotta pot: a foot, a tapered body with a rolled rim, soil, a leafy mound, flowers.
    const clay = k.c(["#d98a5a", "#c8704a", "#e3a06a"][n % 3], 0.85), dark = k.c("#a8573a", 0.9);
    cyl(0.17, 0.18, 0.04, x, y, z, dark);
    cyl(0.24, 0.17, 0.28, x, y + 0.04, z, clay, 14);
    k.put(new THREE.TorusGeometry(0.235, 0.03, 6, 16).rotateX(Math.PI / 2).translate(x, y + 0.32, z), clay);
    cyl(0.22, 0.22, 0.02, x, y + 0.3, z, k.c("#5a3a24", 1));
    ball(0.15, x - 0.07, y + 0.42, z, k.leaf); ball(0.14, x + 0.08, y + 0.44, z + 0.04, k.leaf); ball(0.12, x, y + 0.5, z - 0.07, k.leaf);
    blooms(k, x, y + 0.36, z, 0.17, n, 9);
  } else if (v === 1) {
    // A wooden planter box with a clipped topiary tree.
    const plank = k.c("#9a6a3c", 0.85), trim = k.c("#c79a62", 0.8), topi = k.c("#3f8f4a", 0.9);
    box(0.5, 0.3, 0.5, x, y, z, plank);
    for (const [dx, dz, w, d] of [[0, 0.24, 0.54, 0.05], [0, -0.24, 0.54, 0.05], [0.24, 0, 0.05, 0.54], [-0.24, 0, 0.05, 0.54]] as const) box(w, 0.05, d, x + dx, y + 0.3, z + dz, trim);
    for (const dx of [-0.25, 0.25]) for (const dz of [-0.25, 0.25]) box(0.06, 0.34, 0.06, x + dx, y, z + dz, trim);
    cyl(0.22, 0.22, 0.02, x, y + 0.28, z, k.c("#5a3a24", 1));
    cyl(0.025, 0.03, 0.3, x, y + 0.3, z, k.c("#6a4a2a", 0.9), 6);
    ball(0.2, x, y + 0.72, z, topi, 2); ball(0.13, x, y + 0.98, z, topi, 2);
  } else if (v === 2) {
    // A stone urn on a plinth, spilling ivy and white flowers.
    const urn = k.c("#e8e2d6", 0.6), ivy = k.c("#4f9a4a", 0.9);
    box(0.36, 0.12, 0.36, x, y, z, k.stone);
    cyl(0.07, 0.11, 0.14, x, y + 0.12, z, urn, 10);
    cyl(0.27, 0.11, 0.2, x, y + 0.26, z, urn, 14);
    k.put(new THREE.TorusGeometry(0.265, 0.025, 6, 16).rotateX(Math.PI / 2).translate(x, y + 0.46, z), urn);
    ball(0.17, x, y + 0.52, z, ivy); ball(0.11, x + 0.15, y + 0.5, z + 0.05, ivy);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; k.put(new THREE.ConeGeometry(0.05, 0.22, 5).rotateX(Math.PI).translate(x + Math.cos(a) * 0.26, y + 0.38, z + Math.sin(a) * 0.26), ivy); }
    const white = k.c("#ffffff", 0.7);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; dot(0.045, x + Math.cos(a) * 0.12, y + 0.62, z + Math.sin(a) * 0.12, white); }
  } else if (v === 3) {
    // A bike rack: two steel hoops, one bike parked in it.
    const steel = k.c("#9aa3b8", 0.35, 0.6), tyre = k.c("#23263a", 0.8), frame = k.c(["#ff4f8b", "#3fae6a", "#4f8bff", "#ffb21e"][n % 4], 0.5);
    for (const dx of [-0.2, 0.2]) k.put(new THREE.TorusGeometry(0.17, 0.022, 6, 12, Math.PI).translate(x + dx, y + 0.06, z), steel);
    for (const dx of [-0.2, 0.2]) k.put(new THREE.TorusGeometry(0.13, 0.018, 6, 16).translate(x + dx, y + 0.14, z + 0.12), tyre);
    box(0.4, 0.025, 0.025, x, y + 0.24, z + 0.12, frame);
    k.put(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 5).rotateZ(0.5).translate(x - 0.08, y + 0.2, z + 0.12), frame);
    k.put(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 5).rotateZ(-0.35).translate(x + 0.16, y + 0.22, z + 0.12), frame);
    box(0.1, 0.03, 0.05, x - 0.12, y + 0.33, z + 0.12, tyre);
    box(0.03, 0.03, 0.16, x + 0.19, y + 0.33, z + 0.12, tyre);
  } else if (v === 4) {
    // A café table under a little striped parasol, with two chairs.
    const top = k.c("#ffffff", 0.5), chair = k.c(["#3fae6a", "#ff7a3b", "#4f8bff"][n % 3], 0.6), shade = k.c(["#ff4f8b", "#ffb21e", "#4fb8ff"][n % 3], 0.6);
    cyl(0.12, 0.14, 0.02, x, y, z, k.metal);
    cyl(0.02, 0.02, 0.3, x, y, z, k.metal, 6);
    cyl(0.2, 0.2, 0.025, x, y + 0.3, z, top, 16);
    cyl(0.015, 0.015, 0.55, x, y + 0.32, z, top, 6);
    k.put(new THREE.ConeGeometry(0.42, 0.16, 8).translate(x, y + 0.92, z), shade);
    k.put(new THREE.ConeGeometry(0.43, 0.04, 8, 1, true).translate(x, y + 0.83, z), top);
    for (const s of [-1, 1]) {
      box(0.16, 0.025, 0.16, x + s * 0.3, y + 0.17, z, chair);
      box(0.02, 0.2, 0.16, x + s * 0.38, y + 0.17, z, chair);
      for (const dz of [-0.06, 0.06]) box(0.02, 0.17, 0.02, x + s * 0.3, y, z + dz, k.metal);
    }
  } else {
    // A wooden flower cart on two wheels, full of buckets of flowers, under a striped awning.
    const cart = k.c("#b07a4a", 0.8), wheel = k.c("#5a3a24", 0.8), stripe = k.c(["#ff4f8b", "#ffb21e", "#3fae6a"][n % 3], 0.6), white = k.c("#ffffff", 0.6);
    for (const dz of [-0.17, 0.17]) k.put(new THREE.TorusGeometry(0.1, 0.02, 6, 12).translate(x - 0.12, y + 0.1, z + dz), wheel);
    box(0.52, 0.16, 0.32, x, y + 0.14, z, cart);
    box(0.04, 0.04, 0.3, x + 0.32, y + 0.2, z, cart);
    for (let i = 0; i < 3; i++) {
      const bx = x - 0.16 + i * 0.16;
      cyl(0.055, 0.045, 0.08, bx, y + 0.3, z, k.c("#8a95a8", 0.4, 0.5), 8);
      blooms(k, bx, y + 0.34, z, 0.06, n + i, 5);
      ball(0.05, bx, y + 0.4, z, k.leaf, 0);
    }
    for (const dx of [-0.24, 0.24]) box(0.025, 0.42, 0.025, x + dx, y + 0.3, z - 0.14, wheel);
    for (let i = 0; i < 5; i++) box(0.11, 0.025, 0.36, x - 0.22 + i * 0.11, y + 0.72, z - 0.04, i % 2 ? white : stripe);
  }
}

/** The seating corner: one of four designs, facing `ry`. */
export function seatPiece(k: DecoKit, x: number, z: number, y: number, ry: number, n: number): void {
  const { cyl, box } = shapes(k);
  const v = ((n % 4) + 4) % 4;
  const slat = k.c(["#b07a4a", "#9a6a3c", "#c48a52"][n % 3], 0.8), iron = k.c("#2f3550", 0.5, 0.4);
  const bench = (bx: number, bz: number, r: number, modern = false) => {
    if (modern) {
      for (const s of [-0.28, 0.28]) box(0.12, 0.26, 0.26, bx, y, bz, k.c("#cfccc6", 0.7), r, s, 0);
      box(0.72, 0.05, 0.28, bx, y + 0.26, bz, slat, r);
      return;
    }
    // Three seat slats, two back slats, cast-iron legs with armrests.
    for (const dz of [-0.07, 0, 0.07]) box(0.72, 0.03, 0.06, bx, y + 0.24, bz, slat, r, 0, dz);
    for (const dy of [0.36, 0.46]) box(0.72, 0.06, 0.025, bx, y + dy - 0.03, bz, slat, r, 0, -0.12);
    for (const s of [-0.34, 0.34]) {
      box(0.04, 0.24, 0.2, bx, y, bz, iron, r, s, 0);
      box(0.04, 0.03, 0.2, bx, y + 0.34, bz, iron, r, s, 0);
      box(0.04, 0.5, 0.03, bx, y, bz, iron, r, s, -0.12);
    }
  };
  const bin = (bx: number, bz: number) => {
    const c = k.c(["#3fae6a", "#3a4a7a", "#7a8aa0"][n % 3], 0.5, 0.2);
    cyl(0.1, 0.09, 0.3, bx, y, bz, c, 10);
    cyl(0.11, 0.11, 0.03, bx, y + 0.3, bz, k.c("#2a2f45", 0.5), 10);
  };
  const ox = Math.sin(ry), oz = Math.cos(ry);
  if (v === 0) { bench(x, z, ry); bin(x + Math.cos(ry) * 0.5, z - Math.sin(ry) * 0.5); }
  else if (v === 1) {
    bench(x, z, ry, true);
    // A three-color recycling station beside it.
    ["#3fae6a", "#4f8bff", "#ffb21e"].forEach((c, i) => box(0.13, 0.32, 0.15, x + Math.cos(ry) * (0.5 + i * 0.14), y, z - Math.sin(ry) * (0.5 + i * 0.14), k.c(c, 0.5), ry));
  } else if (v === 2) {
    // A tree in an iron grate, with a bench beside it.
    box(0.5, 0.03, 0.5, x - ox * 0.25, y, z - oz * 0.25, k.c("#3a3f55", 0.5, 0.4));
    k.tree(x - ox * 0.25, z - oz * 0.25, 0.55, y + 0.02);
    bench(x + Math.cos(ry) * 0.45 + ox * 0.15, z - Math.sin(ry) * 0.45 + oz * 0.15, ry);
  } else {
    // A picnic table with two benches.
    box(0.66, 0.04, 0.34, x, y + 0.34, z, slat, ry);
    for (const s of [-0.3, 0.3]) box(0.66, 0.03, 0.12, x, y + 0.2, z, slat, ry, 0, s);
    for (const s of [-0.24, 0.24]) {
      k.put(new THREE.BoxGeometry(0.035, 0.42, 0.035).rotateX(0.5).translate(s, 0.19, 0).rotateY(ry).translate(x, y, z), slat);
      k.put(new THREE.BoxGeometry(0.035, 0.42, 0.035).rotateX(-0.5).translate(s, 0.19, 0).rotateY(ry).translate(x, y, z), slat);
    }
  }
}

/** A fire hydrant (red, yellow or silver) with its side nozzles and cap. */
export function hydrant(k: DecoKit, x: number, z: number, y: number, n: number): void {
  const { cyl } = shapes(k);
  const c = k.c(["#e8413a", "#ffc21a", "#e8413a", "#c9ced8"][n % 4], 0.45, 0.2), cap = k.c("#c9ced8", 0.35, 0.5);
  cyl(0.1, 0.11, 0.04, x, y, z, c);
  cyl(0.07, 0.08, 0.24, x, y + 0.04, z, c);
  cyl(0.09, 0.09, 0.03, x, y + 0.27, z, c);
  k.put(new THREE.SphereGeometry(0.07, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 0.3, z), c);
  cyl(0.02, 0.02, 0.04, x, y + 0.36, z, cap, 6);
  for (const s of [-1, 1]) k.put(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateZ(Math.PI / 2).translate(x + s * 0.09, y + 0.2, z), cap);
}

/** A mailbox on a post: a blue box with a rounded top and a slot. */
export function mailbox(k: DecoKit, x: number, z: number, y: number): void {
  const { box } = shapes(k);
  const blue = k.c("#2f63d8", 0.45, 0.2);
  box(0.06, 0.26, 0.06, x, y, z, k.metal);
  box(0.22, 0.2, 0.18, x, y + 0.26, z, blue);
  k.put(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(x, y + 0.46, z), blue);
  box(0.12, 0.015, 0.01, x, y + 0.42, z + 0.095, k.c("#1a2a5a", 0.5));
}

/** What stands in the middle of a roundabout (on its lawn at y): one of four designs. */
export function roundCenter(k: DecoKit, x: number, z: number, y: number, n: number): void {
  const { cyl, box, ball, dot } = shapes(k);
  const v = ((n % 4) + 4) % 4;
  if (v === 0) { k.tree(x, z, 0.7, y); return; }
  if (v === 1) {
    // A fountain: a stone basin of water, a column with a bowl, and the spray.
    const water = k.c("#6fc8ff", 0.15), spray = k.c("#e8f6ff", 0.2);
    cyl(0.5, 0.52, 0.12, x, y, z, k.stone, 20);
    cyl(0.44, 0.44, 0.02, x, y + 0.1, z, water, 20);
    cyl(0.06, 0.09, 0.4, x, y + 0.1, z, k.stone, 10);
    cyl(0.2, 0.08, 0.08, x, y + 0.48, z, k.stone, 14);
    cyl(0.17, 0.17, 0.015, x, y + 0.55, z, water, 14);
    k.put(new THREE.ConeGeometry(0.06, 0.28, 8).translate(x, y + 0.7, z), spray);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; dot(0.025, x + Math.cos(a) * 0.24, y + 0.45, z + Math.sin(a) * 0.24, spray); }
  } else if (v === 2) {
    // A bronze statue of the town's founder on a stone plinth, flowers round it.
    const bronze = k.c("#a8784a", 0.35, 0.7);
    box(0.36, 0.3, 0.36, x, y, z, k.stone);
    box(0.42, 0.05, 0.42, x, y + 0.3, z, k.stone);
    cyl(0.07, 0.09, 0.32, x, y + 0.35, z, bronze, 8);
    ball(0.06, x, y + 0.73, z, bronze, 1);
    k.put(new THREE.BoxGeometry(0.04, 0.2, 0.04).rotateZ(-0.9).translate(x + 0.1, y + 0.66, z), bronze);
    cyl(0.07, 0.07, 0.015, x, y + 0.78, z, bronze, 10);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ball(0.07, x + Math.cos(a) * 0.36, y + 0.05, z + Math.sin(a) * 0.36, k.leaf, 0); }
    blooms(k, x, y, z, 0.42, n, 10);
  } else {
    // A street clock on a fluted green post, with flower beds.
    const green = k.c("#2f6a4a", 0.4, 0.4), face = k.c("#fffdf2", 0.4), gold = k.c("#ffc93c", 0.3, 0.8), hand = k.c("#1a1f30", 0.5);
    cyl(0.12, 0.14, 0.1, x, y, z, green, 10);
    cyl(0.04, 0.05, 0.9, x, y + 0.1, z, green, 10);
    box(0.26, 0.26, 0.12, x, y + 1.0, z, green);
    for (const s of [-1, 1]) {
      k.put(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16).rotateX(Math.PI / 2).translate(x, y + 1.13, z + s * 0.065), face);
      k.put(new THREE.TorusGeometry(0.1, 0.012, 5, 16).translate(x, y + 1.13, z + s * 0.066), gold);
      box(0.012, 0.07, 0.005, x, y + 1.13, z + s * 0.072, hand);
      k.put(new THREE.BoxGeometry(0.05, 0.012, 0.005).translate(x + 0.025, y + 1.13, z + s * 0.072), hand);
    }
    k.put(new THREE.ConeGeometry(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(x, y + 1.32, z), green);
    dot(0.03, x, y + 1.4, z, gold);
    blooms(k, x, y, z, 0.4, n, 12);
  }
}

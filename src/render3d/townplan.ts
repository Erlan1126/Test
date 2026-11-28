import { LAND } from "../data/land";

/** The town's ground plan: the street grid's blocks, the island's outline round them and the
 *  City Hall's square. Plain numbers (no three.js), so the layout can be tested. */

/** One block of the street grid, street included (half a street on each side). */
export const C = 7.6;

export const CELLS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
/** How many businesses stand in the town itself (the rest are the districts'). */
export const CITY_LOTS = CELLS.length;
export const PARKS: [number, number][] = [[4, 3], [3, 4]];
export const PLAZA: [number, number] = [4, 4];
/** The plot beside the Coffee Cart where the player's first tower stands. */
export const PLOT: [number, number] = [-1, 0];
/** The neighborhoods round the business district: blocks of homes, flats and corner shops
 *  (and a park or two), so the town is a real city with downtown in the middle. */
export const NEIGH: [number, number][] = [[2, 0], [0, 2], [3, 1], [1, 3], [4, 2], [2, 4], [5, 3], [3, 5], [5, 4], [4, 5], [3, 0], [0, 3], [-1, 1], [5, 2]];
/** Which of those are little parks instead of homes. */
export const NEIGH_PARK = new Set(["3,0", "0,3", "5,4"]);
export const ALL = [...CELLS, ...PARKS, PLAZA, PLOT, ...NEIGH];

/** The back of the island: a beach and a stretch of sea (no streets). */
export const BEACH: [number, number][] = [[-1, -1], [0, -1], [-1, -2]];

export const OFF = 2 * C;
export const cellXZ = ([gx, gz]: [number, number]) => ({ x: gx * C - OFF, z: gz * C - OFF });

/** How far the island reaches past the town's streets. */
export const ISLAND_PAD = 3.4;

/** The City Hall's square: how far its paving reaches from the middle, and how much bigger
 *  than its first design the hall stands (its square grows with it). */
export const HALL_SCALE = 1.06;
export const HALL_R = 3.35 * HALL_SCALE;
let hallCache: { x: number; z: number; rot: number } | null = null;
/** Where the City Hall stands: one fixed spot for the whole game, in every save. The open
 *  corner of the base island nearest the middle of town with room round it (off the town's
 *  blocks and the beach), turned to face the middle of town. Nothing else may be built on it:
 *  the city grid, the districts and the countryside all keep clear (see `hallClaims`). */
export function hallSpot(): { x: number; z: number; rot: number } {
  if (hallCache) return hallCache;
  const hull = baseOutline(), beachZ = cellXZ([0, 0]).z - C / 2;
  const clear = (x: number, z: number) => {
    let d = Infinity;
    for (const c of ALL) { const p = cellXZ(c); d = Math.min(d, Math.hypot(Math.max(0, Math.abs(x - p.x) - C / 2), Math.max(0, Math.abs(z - p.z) - C / 2))); }
    d = Math.min(d, z - beachZ);
    for (let m = 1; m < d && m < 14; m += 1) if (!insidePoly(hull, x, z, m)) { d = Math.min(d, m - 1); break; }
    return d;
  };
  const { x: tcx, z: tcz } = townMiddle();
  const hx0 = Math.min(...hull.map(p => p[0])), hx1 = Math.max(...hull.map(p => p[0])), hz0 = Math.min(...hull.map(p => p[1])), hz1 = Math.max(...hull.map(p => p[1]));
  let bestD = Infinity, at = { x: tcx, z: tcz };
  for (let x = hx0; x <= hx1; x += 1) for (let z = hz0; z <= hz1; z += 1) {
    if (!insidePoly(hull, x, z) || clear(x, z) < 3.4) continue;
    const d = Math.hypot(x - tcx, z - tcz);
    if (d < bestD) { bestD = d; at = { x, z }; }
  }
  return (hallCache = { ...at, rot: Math.atan2(tcx - at.x, tcz - at.z) });
}
/** The middle of the town's own blocks. */
export function townMiddle(): { x: number; z: number } {
  return { x: ALL.reduce((a, c) => a + cellXZ(c).x, 0) / ALL.length, z: ALL.reduce((a, c) => a + cellXZ(c).z, 0) / ALL.length };
}
/** Whether a square of half-size `h` round (x, z) reaches onto the City Hall's square (with `m` to spare). */
export function onHall(x: number, z: number, h = 0, m = 0): boolean {
  const s = hallSpot();
  return Math.hypot(Math.max(0, Math.abs(x - s.x) - h), Math.max(0, Math.abs(z - s.z) - h)) < HALL_R + m;
}
/** Whether a block of the city grid (street included) would reach onto the City Hall's square. */
export const hallClaims = (gx: number, gz: number): boolean => { const p = cellXZ([gx, gz]); return onHall(p.x, p.z, C / 2, 0.3); };

export function makeOutline(pad: number, extra: [number, number][]): [number, number][] {
  const pts: [number, number][] = [...extra];
  for (const c of [...ALL, ...BEACH]) { const { x, z } = cellXZ(c); for (const dx of [-1, 1]) for (const dz of [-1, 1]) pts.push([x + dx * C / 2, z + dz * C / 2]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = grow([...lower.slice(0, -1), ...upper.slice(0, -1)], pad);
  // A natural coastline instead of a cut shape: walk round the outline and push each point
  // out by a smooth, uneven amount (bays and headlands), then round it off. It never comes
  // in past the streets.
  const pts2: [number, number][] = [];
  let dist = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    const steps = Math.max(1, Math.ceil(len / 0.8));
    for (let j = 0; j < steps; j++) {
      const f = j / steps, d = dist + f * len;
      const out = 0.6 + 0.8 * Math.sin(d * 0.21 + 0.6) + 0.7 * Math.sin(d * 0.47 + 2.1) + 0.25 * Math.sin(d * 1.31 + 0.3);
      const o = Math.max(0.12, out);
      pts2.push([a[0] + (b[0] - a[0]) * f + nx * o, a[1] + (b[1] - a[1]) * f + nz * o]);
    }
    dist += len;
  }
  // Two rounds of corner-cutting: soft curves, no sharp points.
  let ring = pts2;
  for (let r = 0; r < 2; r++) {
    const next: [number, number][] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    ring = next;
  }
  return ring;
}

/** Whether a point is inside an outline (any shape), at least `m` from its edge. */
export function insidePoly(poly: [number, number][], x: number, z: number, m = 0): boolean {
  let inn = false, near = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inn = !inn;
    if (m > 0) {
      const ex = xj - xi, ez = zj - zi, L = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / L));
      near = Math.min(near, Math.hypot(x - (xi + ex * t), z - (zi + ez * t)));
    }
  }
  return inn && (m <= 0 || near >= m);
}

/** Pushes a convex, counter-clockwise outline out (or in, when negative) by d. */
export function grow(pts: [number, number][], d: number): [number, number][] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    const n1 = [e1[1] / l1, -e1[0] / l1], n2 = [e2[1] / l2, -e2[0] / l2];
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [p[0] + ((n1[0] + n2[0]) / k) * d, p[1] + ((n1[1] + n2[1]) / k) * d];
  });
}

let baseHull: [number, number][] | null = null;
/** The island's outline round the town alone (no bought land, no city grid). */
export function baseOutline(): [number, number][] { return (baseHull ??= makeOutline(ISLAND_PAD, [])); }

/** Land next to the island (data/land.ts): its middle and size, on sale (floating a little way
 *  off the edge) or bought (joined to the island, overlapping its edge). */
export const DIST_N = 4, DIST_H = (DIST_N / 2) * C + 3.2, DIST_GAP = 6;
/** How far a district's (rounded-square) coast is from its middle in direction (dx, dz). */
export const distEdge = (dx: number, dz: number) => DIST_H / Math.pow(Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dz), 4), 0.25);
export const LAND_R = DIST_H;
const landCache = new Map<string, { x: number; z: number; r: number; y: number }>();
/** The sky city's first island (the first district above the ground), in LAND's order. */
export const SKY0 = LAND.findIndex(l => l.y > 0);
/** What a district joins (-1: the town): the sky city's later islands join its first. */
export const landPrev = (k: number) => (k <= SKY0 || LAND[k]?.y === 0 ? -1 : SKY0);
export function landSpot(k: number, bought: boolean): { x: number; z: number; r: number; y: number } {
  const key = `${k}|${bought}`;
  let v = landCache.get(key);
  if (!v) {
    // One city: the Harbor District, Garden Hills, Downtown and the Beach Resort join the
    // town's own land on its sides and its front corner (overlapping its edge, no gap and no
    // bridge); the sky districts
    // float together as one sky city above and behind the town, side by side, the first
    // straight behind it (reached by a sky lift), the next two beside it.
    void bought;
    const hull = baseOutline(), cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cz = hull.reduce((a, p) => a + p[1], 0) / hull.length;
    const exit = (dx: number, dz: number) => { let t = 0; while (t < 300 && insidePoly(hull, cx + dx * t, cz + dz * t)) t += 0.25; return t; };
    if (LAND[k].y === 0) {
      // (On the town's own street grid: its blocks line up with the town's, so the streets run
      // straight on from one to the other; pushed out a block at a time until it's clear of
      // the town's blocks. A corner district, set off diagonally, goes out by its corner.)
      const [dx0, dz0] = LAND[k].dir, dl = Math.hypot(dx0, dz0) || 1, dx = dx0 / dl, dz = dz0 / dl, out = exit(dx, dz) + distEdge(dx, dz) - 4.5;
      const snap = (q: number) => (Math.round((q + OFF) / C - 0.5) + 0.5) * C - OFF;
      let x = snap(cx + dx * out), z = snap(cz + dz * out);
      // (Clear of the town's blocks and of the ground districts before it, a street apart.)
      const hits = () => [...ALL, ...BEACH].some(c => { const p = cellXZ(c); return Math.abs(p.x - x) < 2 * C - 0.1 && Math.abs(p.z - z) < 2 * C - 0.1; })
        || LAND.some((l2, k2) => k2 < k && l2.y === 0 && (() => { const o = landSpot(k2, true); return Math.abs(o.x - x) < 5 * C - 0.1 && Math.abs(o.z - z) < 5 * C - 0.1; })());
      for (let q = 0; q < 12 && hits(); q++) { x += Math.sign(dx) * C; z += Math.sign(dz) * C; }
      v = { x, z, r: LAND_R, y: LAND[k].y };
    } else {
      const bx = -Math.SQRT1_2, bz = -Math.SQRT1_2, out = exit(bx, bz) + DIST_H * 1.35 + 6;
      const sx = cx + bx * out, sz = cz + bz * out, step = 2 * DIST_H * 0.97;
      const [dx, dz] = k === SKY0 ? [0, 0] : LAND[k].dir;
      v = { x: sx + dx * step, z: sz + dz * step, r: LAND_R, y: LAND[k].y };
    }
    landCache.set(key, v);
  }
  return v;
}
/** How a district joins the city: "ground" (on the town's land), "lift" (the sky city's
 *  first island, a sky lift up from the town) or "sky" (beside the sky city's first island). */
export const landJoin = (k: number): "ground" | "lift" | "sky" => (LAND[k]?.y === 0 ? "ground" : k === SKY0 ? "lift" : "sky");

/** The city grid's blocks past the town (up to `grow` of them): the island's land round the
 *  town, its land `landPts` and its ground districts `land` (bought or on sale, by index in
 *  LAND) laid out in whole blocks of the town's street grid, grown street by street out from
 *  the town (so every street joins up), never on a district's spot or the City Hall's square. */
export function growGrid(landPts: [number, number][], land: number[], grow: number): [number, number][] {
  const out: [number, number][] = [];
  if (grow <= 0) return out;
  // Where the city can spread: the land round the town and its districts and a few blocks
  // further out; the island grows with it.
  const shape = makeOutline(ISLAND_PAD + 2.5 * C, landPts);
  // (Ground districts on sale too: the grid leaves their spot for them.)
  const dists = land.filter(k => landJoin(k) === "ground").map(k => landSpot(k, true));
  const inDist = (x: number, z: number) => dists.some(sp => Math.abs(x - sp.x) < 2 * C - 0.1 && Math.abs(z - sp.z) < 2 * C - 0.1);
  const taken = new Set([...ALL, ...BEACH].map(c => `${c[0]},${c[1]}`));
  const back = cellXZ([0, 0]).z - C / 2;
  const fits = (gx: number, gz: number) => {
    if (taken.has(`${gx},${gz}`)) return false;
    const { x, z } = cellXZ([gx, gz]);
    // (Never on the City Hall's square: the grid goes round it.)
    return !inDist(x, z) && !hallClaims(gx, gz) && z - C / 2 >= back - 0.01 && insidePoly(shape, x, z, C * 0.3);
  };
  const road = (gx: number, gz: number) => taken.has(`${gx},${gz}`) || (() => { const { x, z } = cellXZ([gx, gz]); return inDist(x, z); })();
  const xs = shape.map(p => p[0]), zs = shape.map(p => p[1]);
  const gx0 = Math.floor((Math.min(...xs) + OFF) / C) - 1, gx1 = Math.ceil((Math.max(...xs) + OFF) / C) + 1, gz0 = Math.floor((Math.min(...zs) + OFF) / C) - 1, gz1 = Math.ceil((Math.max(...zs) + OFF) / C) + 1;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // (The city spreads out from the middle of town, block by block, nearest first: every new
  // block joins a street that's already there.)
  const tc = ALL.reduce((a, c) => { const p = cellXZ(c); return [a[0] + p.x / ALL.length, a[1] + p.z / ALL.length]; }, [0, 0]);
  const dist = (gx: number, gz: number) => { const p = cellXZ([gx, gz]); return Math.hypot(p.x - tc[0], (p.z - tc[1]) * 1.1) + ((gx * 7 + gz * 13) % 5) * 0.35; };
  const frontier = new Map<string, [number, number]>(), seen = new Set<string>();
  for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) if (fits(gx, gz) && N4.some(([a, b]) => road(gx + a, gz + b))) { frontier.set(`${gx},${gz}`, [gx, gz]); seen.add(`${gx},${gz}`); }
  while (frontier.size && out.length < grow) {
    let best: [number, number] | null = null, bk = "", bd = Infinity;
    for (const [k, c] of frontier) { const d = dist(c[0], c[1]); if (d < bd) { bd = d; best = c; bk = k; } }
    frontier.delete(bk);
    out.push(best!);
    for (const [a, b] of N4) { const n: [number, number] = [best![0] + a, best![1] + b], key = `${n[0]},${n[1]}`; if (!seen.has(key) && fits(n[0], n[1])) { seen.add(key); frontier.set(key, n); } }
  }
  return out;
}

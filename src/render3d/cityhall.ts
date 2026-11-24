// The City Hall, drawn in code with real architecture: it grows with the hall's level from a
// brick village hall (pitched slate roof, bell cupola, porch) to a stone civic hall (a
// rusticated ground floor, framed windows with sills and pediments, a cornice and balustrade,
// a portico of fluted columns under a pediment, a clock tower), then wings, a copper dome on a
// colonnaded drum, a golden dome with a statue, and at last a beacon spire.
import * as THREE from "three";

export interface HallKit {
  /** A shared material of this colour (roughness, metalness). */
  c: (color: string, rough?: number, metal?: number) => THREE.Material;
  /** The windows' glass (glows at night). */
  win: THREE.Material;
  gold: THREE.Material;
  /** The Sky Capital's beacon: a material to animate. */
  beacon: () => THREE.Material;
}

/** Builds the hall for a stage (0..6) into `H`, front facing +z. Returns its height and depth. */
export function buildCityHall(H: THREE.Group, rk: number, k: HallKit): { top: number; D: number } {
  const T = (geo: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(geo, m); H.add(mesh); return mesh; };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => T(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), m);
  const stone = k.c("#ece4d4", 0.85), stoneDark = k.c("#d6ccb8", 0.9), trim = k.c("#faf7f0", 0.6), slate = k.c("#55607a", 0.75);
  const brick = k.c("#b4613f", 0.9), mortar = k.c("#d9c7b0", 0.9), wood = k.c("#6b4228", 0.7), doorC = k.c("#3f2a1c", 0.6), iron = k.c("#2a2f3a", 0.5, 0.5);

  /** A window on a wall facing `n` (+1 front/-1 back on z; or on x with `side`): frame, glass
   *  set back, a sill, and (optionally) a little pediment or an arch on top. */
  const windowAt = (x: number, y: number, z: number, w: number, h: number, axis: "z" | "x", dir: number, cap: "none" | "ped" | "arch" | "flat" = "none") => {
    const fr = 0.04, off = 0.015 * dir;
    const place = (geo: THREE.BufferGeometry, m: THREE.Material, dx: number, dy: number, dz: number) => {
      if (axis === "x") geo.rotateY(Math.PI / 2);
      T(geo.translate(axis === "z" ? x + dx : x + dz * dir, y + dy, axis === "z" ? z + dz * dir : z + dx), m);
    };
    place(new THREE.BoxGeometry(w + fr * 2, h + fr * 2, 0.03), trim, 0, h / 2, off);
    place(new THREE.BoxGeometry(w, h, 0.03), k.win, 0, h / 2, off + 0.012 * dir);
    // Glazing bars: a cross.
    place(new THREE.BoxGeometry(0.018, h, 0.012), trim, 0, h / 2, off + 0.03 * dir);
    place(new THREE.BoxGeometry(w, 0.018, 0.012), trim, 0, h * 0.62, off + 0.03 * dir);
    place(new THREE.BoxGeometry(w + 0.12, 0.035, 0.08), trim, 0, -0.02, 0.04 * dir);
    if (cap === "ped") {
      const s = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.07, 0), new THREE.Vector2(w / 2 + 0.07, 0), new THREE.Vector2(0, 0.12)]);
      place(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), trim, 0, h + fr + 0.01, 0.0);
    } else if (cap === "arch") {
      place(new THREE.CylinderGeometry(w / 2 + fr, w / 2 + fr, 0.03, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), trim, 0, h, off);
      place(new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), k.win, 0, h, off + 0.012 * dir);
    } else if (cap === "flat") place(new THREE.BoxGeometry(w + 0.14, 0.05, 0.07), trim, 0, h + fr + 0.02, 0.03 * dir);
  };
  /** A classical column: a square base, a slightly tapered shaft, a capital. */
  const column = (x: number, y: number, z: number, h: number, r: number) => {
    box(r * 2.6, 0.06, r * 2.6, x, y, z, trim);
    T(new THREE.CylinderGeometry(r * 0.9, r, h - 0.14, 16).translate(x, y + 0.06 + (h - 0.14) / 2, z), trim);
    T(new THREE.TorusGeometry(r * 0.95, r * 0.16, 6, 16).rotateX(Math.PI / 2).translate(x, y + h - 0.08, z), trim);
    box(r * 2.5, 0.06, r * 2.5, x, y + h - 0.06, z, trim);
  };
  /** A balustrade along x (or z) between two points at height y. */
  const balustrade = (x0: number, x1: number, y: number, z: number, axis: "x" | "z" = "x") => {
    const L = Math.abs(x1 - x0), mid = (x0 + x1) / 2, n = Math.max(2, Math.round(L / 0.13));
    const g = (w: number, h: number, d: number) => (axis === "x" ? new THREE.BoxGeometry(w, h, d) : new THREE.BoxGeometry(d, h, w));
    const at = (geo: THREE.BufferGeometry, a: number, yy: number) => T(axis === "x" ? geo.translate(a, yy, z) : geo.translate(z, yy, a), trim);
    at(g(L, 0.04, 0.12), mid, y + 0.02);
    at(g(L + 0.04, 0.05, 0.14), mid, y + 0.25);
    for (let i = 0; i <= n; i++) { const a = x0 + (i / n) * (x1 - x0); T((axis === "x" ? new THREE.CylinderGeometry(0.022, 0.03, 0.2, 6).translate(a, y + 0.13, z) : new THREE.CylinderGeometry(0.022, 0.03, 0.2, 6).translate(z, y + 0.13, a)), trim); }
  };
  /** A pitched (gable) roof over a block, ridge along x: slates, overhanging eaves, a ridge cap. */
  const gableRoof = (w: number, d: number, y: number, rise: number, m: THREE.Material, cx = 0, cz = 0) => {
    const s = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.12, 0), new THREE.Vector2(d / 2 + 0.12, 0), new THREE.Vector2(0, rise)]);
    T(new THREE.ExtrudeGeometry(s, { depth: w + 0.2, bevelEnabled: false }).translate(0, 0, -(w + 0.2) / 2).rotateY(Math.PI / 2).translate(cx, y, cz), m);
    box(w + 0.24, 0.05, 0.08, cx, y + rise - 0.02, cz, k.c("#3e4658", 0.7));
  };
  /** A hipped roof (slopes on all four sides). */
  const hipRoof = (w: number, d: number, y: number, rise: number, m: THREE.Material, cx = 0, cz = 0) => {
    const geo = new THREE.CylinderGeometry(0.0001, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
    geo.scale(w + 0.2, rise, d + 0.2).translate(cx, y + rise / 2, cz);
    // (Stretch the apex into a ridge along x.)
    const p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++) if (p.getY(i) > y + rise * 0.99) p.setX(i, cx + Math.sign(p.getX(i) - cx || (i % 2 ? 1 : -1)) * Math.max(0, (w - d) / 2));
    geo.computeVertexNormals();
    T(geo, m);
  };

  let top = 0, D = 0;
  if (rk <= 1) {
    // ---- The village hall: brick, a slate roof, a porch and a bell cupola ----
    const W = 3.0 + rk * 0.3, Dd = 2.0, h = 1.25;
    D = Dd;
    box(W + 0.3, 0.22, Dd + 0.3, 0, 0, 0, stoneDark);           // stone plinth
    box(W, h, Dd, 0, 0.22, 0, brick);                         // brick walls
    // Mortar courses: thin pale lines every few rows, so the brick reads as brick.
    for (let r = 0; r < 7; r++) { const y = 0.3 + r * 0.17; box(W + 0.004, 0.012, Dd + 0.004, 0, y, 0, mortar); }
    // Stone quoins at the corners.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let q = 0; q < 4; q++) box(0.14, 0.13, 0.14, sx * (W / 2 - 0.05), 0.26 + q * 0.3 + (q % 2) * 0.02, sz * (Dd / 2 - 0.05), stone);
    box(W + 0.12, 0.08, Dd + 0.12, 0, 0.22 + h, 0, trim);       // eaves board
    gableRoof(W, Dd, 0.3 + h, 0.95, slate);
    // Windows: tall ones along the front and back, one each side.
    for (const wx of [-W * 0.34, -W * 0.17, W * 0.17, W * 0.34]) { windowAt(wx, 0.55, Dd / 2, 0.24, 0.6, "z", 1, "arch"); windowAt(wx, 0.55, -Dd / 2, 0.24, 0.6, "z", -1, "arch"); }
    for (const sx of [-1, 1]) windowAt(sx * W / 2, 0.55, 0, 0.26, 0.6, "x", sx, "arch");
    // The porch: steps, two posts, a little gable over the double door.
    for (let s = 0; s < 3; s++) box(1.1 - s * 0.12, 0.08, 0.3, 0, s * 0.08, Dd / 2 + 0.55 - s * 0.14, stone);
    box(0.56, 0.78, 0.04, 0, 0.22, Dd / 2 + 0.01, doorC);
    box(0.02, 0.78, 0.05, 0, 0.22, Dd / 2 + 0.03, wood);
    for (const sx of [-1, 1]) T(new THREE.CylinderGeometry(0.04, 0.045, 1.0, 10).translate(sx * 0.42, 0.72, Dd / 2 + 0.5), trim);
    gableRoof(0.95, 0.75, 1.22, 0.32, slate, 0, Dd / 2 + 0.32);
    // A bell cupola on the ridge, a weathervane on top; a chimney at the back.
    const ry = 0.3 + h + 0.95;
    box(0.42, 0.16, 0.42, 0, ry - 0.2, 0, trim);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.34, 0.05, sx * 0.16, ry - 0.04, sz * 0.16, trim);
    T(new THREE.SphereGeometry(0.08, 10, 8).translate(0, ry + 0.1, 0), k.c("#c08a3a", 0.4, 0.6));
    T(new THREE.ConeGeometry(0.3, 0.32, 4).rotateY(Math.PI / 4).translate(0, ry + 0.46, 0), slate);
    T(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4).translate(0, ry + 0.75, 0), iron);
    box(0.16, 0.04, 0.01, 0.05, ry + 0.82, 0, iron);
    box(0.22, 0.5, 0.22, W * 0.3, 0.3 + h + 0.3, -Dd * 0.2, brick);
    // Village level: a clock on the front gable.
    if (rk >= 1) {
      T(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24).rotateX(Math.PI / 2).translate(0, 0.3 + h + 0.38, Dd / 2 + 0.1), trim);
      T(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24).rotateX(Math.PI / 2).translate(0, 0.3 + h + 0.38, Dd / 2 + 0.125), k.c("#fffaf0", 0.4));
      box(0.015, 0.12, 0.01, 0, 0.3 + h + 0.38, Dd / 2 + 0.14, iron);
      box(0.09, 0.015, 0.01, 0.04, 0.3 + h + 0.38, Dd / 2 + 0.14, iron);
    }
    top = ry + 0.85;
  } else {
    // ---- The stone civic hall ----
    const W = 3.6 + (rk - 2) * 0.25, Dd = 2.4, g1 = 0.95, g2 = 0.95, base = 0.34;
    D = Dd;
    // A podium with wide steps across the front.
    box(W + 0.5, base, Dd + 0.5, 0, 0, 0, stoneDark);
    for (let s = 0; s < 4; s++) box(W * 0.5 - s * 0.05, 0.085, 0.24, 0, s * 0.085, Dd / 2 + 0.25 + 0.66 - s * 0.2, stone);
    // A rusticated ground floor (stone bands), a smooth upper floor, a cornice.
    box(W, g1, Dd, 0, base, 0, stoneDark);
    for (let r = 0; r < 4; r++) box(W + 0.01, 0.018, Dd + 0.01, 0, base + 0.2 + r * 0.22, 0, k.c("#c5b9a2", 0.9));
    box(W + 0.06, 0.07, Dd + 0.06, 0, base + g1, 0, trim);       // string course
    box(W, g2, Dd, 0, base + g1 + 0.07, 0, stone);
    // Pilasters between the upper windows.
    const bays = 7, bw = W / bays;
    for (let b = 0; b <= bays; b++) for (const sz of [-1, 1]) box(0.09, g2, 0.04, -W / 2 + b * bw, base + g1 + 0.07, sz * (Dd / 2 + 0.01), trim);
    // Windows: arched below, with pediments above (alternating triangle and flat caps).
    for (let b = 0; b < bays; b++) {
      const wx = -W / 2 + (b + 0.5) * bw, centre = b === Math.floor(bays / 2);
      for (const sz of [-1, 1]) {
        if (!(centre && sz > 0)) windowAt(wx, base + 0.2, sz * Dd / 2, bw * 0.42, 0.5, "z", sz, "arch");
        windowAt(wx, base + g1 + 0.22, sz * Dd / 2, bw * 0.42, 0.52, "z", sz, b % 2 ? "flat" : "ped");
      }
    }
    for (const sx of [-1, 1]) for (const wz of [-0.55, 0.55]) { windowAt(sx * W / 2, base + 0.2, wz, 0.24, 0.5, "x", sx, "arch"); windowAt(sx * W / 2, base + g1 + 0.22, wz, 0.24, 0.52, "x", sx, "ped"); }
    const eave = base + g1 + 0.07 + g2;
    // The cornice: a deep moulded ledge with dentils, then a balustrade along the roof's edge.
    box(W + 0.22, 0.1, Dd + 0.22, 0, eave, 0, trim);
    box(W + 0.14, 0.05, Dd + 0.14, 0, eave - 0.05, 0, stone);
    for (let i = 0; i < 34; i++) { const x = -W / 2 + (i + 0.5) * (W / 34); box(0.035, 0.035, 0.035, x, eave - 0.035, Dd / 2 + 0.085, trim); }
    hipRoof(W - 0.3, Dd - 0.3, eave + 0.1, 0.45, slate);
    balustrade(-W / 2 - 0.05, W / 2 + 0.05, eave + 0.1, Dd / 2 + 0.05);
    balustrade(-W / 2 - 0.05, W / 2 + 0.05, eave + 0.1, -Dd / 2 - 0.05);
    for (const sx of [-1, 1]) balustrade(-Dd / 2, Dd / 2, eave + 0.1, sx * (W / 2 + 0.05), "z");
    // The portico: six columns, an entablature and a pediment with a round emblem.
    const pw = W * 0.5, pz = Dd / 2 + 0.42, ch = g1 + g2 + 0.07;
    box(pw + 0.2, 0.06, 0.9, 0, base, Dd / 2 + 0.4, stone);
    for (let c = 0; c < 6; c++) column(-pw / 2 + (c / 5) * pw, base + 0.06, pz + 0.2, ch - 0.06, 0.075);
    box(pw + 0.3, 0.14, 0.95, 0, base + ch, Dd / 2 + 0.38, trim);
    box(pw + 0.36, 0.05, 1.0, 0, base + ch + 0.14, Dd / 2 + 0.38, stone);
    const ped = new THREE.Shape([new THREE.Vector2(-pw / 2 - 0.18, 0), new THREE.Vector2(pw / 2 + 0.18, 0), new THREE.Vector2(0, 0.55)]);
    T(new THREE.ExtrudeGeometry(ped, { depth: 0.95, bevelEnabled: false }).translate(0, base + ch + 0.19, Dd / 2 - 0.09), stone);
    const pedT = new THREE.Shape([new THREE.Vector2(-pw / 2 - 0.26, 0), new THREE.Vector2(pw / 2 + 0.26, 0), new THREE.Vector2(0, 0.62)]);
    T(new THREE.ExtrudeGeometry(pedT, { depth: 0.06, bevelEnabled: false }).translate(0, base + ch + 0.17, Dd / 2 + 0.86), trim);
    T(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24).rotateX(Math.PI / 2).translate(0, base + ch + 0.42, Dd / 2 + 0.94), k.gold);
    // The great door under the portico, with a fanlight.
    box(0.62, 0.92, 0.04, 0, base, Dd / 2 + 0.005, doorC);
    T(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, base + 0.92, Dd / 2 + 0.01), k.win);
    for (const sx of [-1, 1]) box(0.04, 0.84, 0.05, sx * 0.17, base + 0.04, Dd / 2 + 0.03, wood);
    top = eave + 0.6;
    // Wings either side (City): lower blocks with their own pediments.
    if (rk >= 3) for (const sd of [-1, 1]) {
      const ww = W * 0.38, wx = sd * (W / 2 + ww / 2 - 0.02), wh = g1 + g2 * 0.75;
      box(ww, wh, Dd * 0.82, wx, base, -0.1, stone);
      box(ww + 0.12, 0.08, Dd * 0.82 + 0.12, wx, base + wh, -0.1, trim);
      hipRoof(ww - 0.2, Dd * 0.82 - 0.2, base + wh + 0.08, 0.32, slate, wx, -0.1);
      for (const off of [-0.32, 0.32]) { windowAt(wx + off * ww, base + 0.2, Dd * 0.41 - 0.1, 0.2, 0.48, "z", 1, "arch"); windowAt(wx + off * ww, base + g1 + 0.12, Dd * 0.41 - 0.1, 0.2, 0.42, "z", 1, "flat"); }
    }
    // A clock tower (Town, City), then a dome on a colonnaded drum (Big City on).
    const rz = -0.15;
    if (rk < 4) {
      const tw = 0.9, th = 1.0 + (rk - 2) * 0.35, ty = eave + 0.1;
      box(tw, th, tw, 0, ty, rz, stone);
      box(tw + 0.1, 0.07, tw + 0.1, 0, ty + th, rz, trim);
      for (const [nx, nz, ax] of [[0, 1, "z"], [0, -1, "z"], [1, 0, "x"], [-1, 0, "x"]] as [number, number, "z" | "x"][]) {
        const cx = nx * (tw / 2 + 0.02), cz = rz + nz * (tw / 2 + 0.02), cy = ty + th * 0.62;
        const face = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 28).rotateX(Math.PI / 2), dial = new THREE.CylinderGeometry(0.23, 0.23, 0.02, 28).rotateX(Math.PI / 2);
        if (ax === "x") { face.rotateY(Math.PI / 2); dial.rotateY(Math.PI / 2); }
        T(face.translate(cx, cy, cz), trim);
        T(dial.translate(cx + nx * 0.02, cy, cz + nz * 0.02), k.c("#fffaf0", 0.35));
        const hand = (len: number, ang: number) => { const hg = new THREE.BoxGeometry(0.018, len, 0.01).translate(0, len / 2, 0).rotateZ(ang); if (ax === "x") hg.rotateY(Math.PI / 2); T(hg.translate(cx + nx * 0.035, cy, cz + nz * 0.035), iron); };
        hand(0.15, -0.6); hand(0.2, 1.9);
      }
      // A belfry with arches, then a spire.
      const by = ty + th + 0.07;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(sx * 0.3, by, rz + sz * 0.3, 0.5, 0.045);
      box(tw, 0.08, tw, 0, by + 0.5, rz, trim);
      T(new THREE.ConeGeometry(0.55, 0.95, 8).rotateY(Math.PI / 8).translate(0, by + 0.58 + 0.47, rz), slate);
      T(new THREE.SphereGeometry(0.06, 10, 8).translate(0, by + 1.08 + 0.03, rz), k.gold);
      top = by + 1.2;
    } else {
      const dr = 0.95 + (rk - 4) * 0.08, dy = eave + 0.1;
      // The drum: a ring of columns round a wall, then a cornice.
      T(new THREE.CylinderGeometry(dr * 0.86, dr * 0.86, 0.8, 32).translate(0, dy + 0.4, rz), stone);
      for (let c = 0; c < 16; c++) { const a = (c / 16) * Math.PI * 2; column(Math.cos(a) * dr, dy, rz + Math.sin(a) * dr, 0.8, 0.045); }
      for (let c = 0; c < 8; c++) { const a = (c / 8) * Math.PI * 2 + Math.PI / 16; const wg = new THREE.BoxGeometry(0.16, 0.36, 0.03).translate(0, 0, dr * 0.87).rotateY(-a + Math.PI / 2); T(wg.translate(0, dy + 0.46, rz), k.win); }
      T(new THREE.CylinderGeometry(dr + 0.1, dr + 0.1, 0.1, 32).translate(0, dy + 0.85, rz), trim);
      // The dome: copper gone green (Big City, Metropolis), gold (Sky Capital), with ribs.
      const domeM = rk >= 5 ? k.gold : k.c("#6fae9c", 0.45, 0.35);
      T(new THREE.SphereGeometry(dr, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(0, dy + 0.9, rz), domeM);
      for (let r = 0; r < 12; r++) {
        const a = (r / 12) * Math.PI * 2, pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 10; i++) { const t = (i / 10) * (Math.PI / 2); pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(t) * (dr + 0.01), dy + 0.9 + Math.sin(t) * dr * 1.15, rz + Math.sin(a) * Math.cos(t) * (dr + 0.01))); }
        T(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 4, false), rk >= 5 ? k.c("#fff0b0", 0.3, 0.8) : k.c("#9ad0c0", 0.5, 0.3));
      }
      // The lantern on top.
      const ly = dy + 0.9 + dr * 1.15;
      for (let c = 0; c < 6; c++) { const a = (c / 6) * Math.PI * 2; T(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6).translate(Math.cos(a) * 0.17, ly + 0.18, rz + Math.sin(a) * 0.17), trim); }
      T(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 16).translate(0, ly + 0.38, rz), trim);
      T(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, ly + 0.4, rz), domeM);
      top = ly + 0.62;
      if (rk >= 6) {
        // The Sky Capital's beacon spire.
        T(new THREE.ConeGeometry(0.08, 1.3, 8).translate(0, top + 0.65, rz), k.gold);
        T(new THREE.SphereGeometry(0.13, 12, 10).translate(0, top + 1.35, rz), k.beacon());
        top += 1.5;
      }
    }
  }
  // The square in front: flagpoles, lamps, clipped trees in planters; a statue (Metropolis).
  const fz = D / 2 + 1.5;
  for (const sd of [-1, 1]) {
    T(new THREE.CylinderGeometry(0.025, 0.035, 2.4, 8).translate(sd * 1.7, 1.2, fz), k.c("#e8ecf4", 0.3, 0.7));
    T(new THREE.SphereGeometry(0.05, 8, 6).translate(sd * 1.7, 2.42, fz), k.gold);
    T(new THREE.BoxGeometry(0.015, 0.36, 0.58).translate(sd * 1.7, 2.12, fz + 0.3), k.c(sd < 0 ? "#2f6fd8" : "#e8424f", 0.7));
    // A classic lamp post either side of the steps.
    T(new THREE.CylinderGeometry(0.035, 0.05, 1.2, 8).translate(sd * 0.95, 0.6, D / 2 + 1.0), iron);
    T(new THREE.SphereGeometry(0.1, 12, 8).translate(sd * 0.95, 1.28, D / 2 + 1.0), k.c("#fff4d0", 0.3));
  }
  if (rk >= 5) {
    box(0.55, 0.45, 0.55, 0, 0, D / 2 + 2.3, stone);
    box(0.62, 0.06, 0.62, 0, 0.45, D / 2 + 2.3, trim);
    T(new THREE.CapsuleGeometry(0.12, 0.42, 4, 10).translate(0, 0.84, D / 2 + 2.3), k.gold);
    T(new THREE.SphereGeometry(0.09, 10, 8).translate(0, 1.18, D / 2 + 2.3), k.gold);
  }
  return { top, D };
}

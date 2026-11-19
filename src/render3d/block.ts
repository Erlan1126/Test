// The café block, alive: the yellow-jacket neighbor who moved into the player's first
// tower, the Coffee Cart's queue (customers line up, step forward, get a cup, take it away
// or sit on the terrace), the moving truck, the folded chairs, and the two neighborhood
// projects (a flower market and a playground) with their shoppers and family.
//
// Everything the story needs is timed by the town UI (BizBlock below), so a scene stays in
// step with the real sale and survives the town being rebuilt mid-way. The crowd is small
// and reuses the same few people; every spot they stand on is reserved, so nobody queues
// through someone else or takes a taken seat.
import * as THREE from "three";

/** The story as the town UI tells it (all times are Date.now() milliseconds). */
export interface BizBlock {
  /** Where the neighbor is in the story. */
  stage: "none" | "arrive" | "home" | "toCart" | "queue" | "chairs" | "toSeat" | "seat";
  at: number;
  /** The moment the neighbor's (first) coffee is handed over, 0 when none is due. */
  saleAt: number;
  /** Customers come to the cart (after the first sale). */
  crowd: boolean;
  /** A project that just opened: a delivery or a family arriving. */
  opened?: { id: "flowers" | "play"; at: number };
  /** Reduced motion: every walk jumps to its end. */
  reduced: boolean;
}

export interface BlockSetup {
  parent: THREE.Group;
  makePerson: (shirt: string) => THREE.Group;
  mat: (c: string, rough?: number, metal?: number) => THREE.MeshStandardMaterial;
  own: <T extends THREE.Material>(m: T) => T;
  /** The Coffee Cart lot (world position and facing), or null when it isn't in town. */
  coffee: { x: number; z: number; a: number } | null;
  /** The starter tower's plot (cell center) and the tower's spot inside it. */
  plot: { x: number; z: number };
  tower: { x: number; z: number; door: number };
  hasStarter: boolean;
  terrace: 0 | 1 | 2;
  done: string[];
  offered: boolean;
}

export interface Block {
  update(now: number, dt: number, t: number, block: BizBlock | undefined, sale: number): void;
  /** Where the neighbor is (for their speech bubble), or null. */
  resident(): THREE.Vector3 | null;
  /** The flower stall's and the playground's spots (district coordinates). */
  spot(id: "flowers" | "play"): { x: number; z: number };
}

type V2 = [number, number];
const YELLOW = "#ffc21a";

/** The walking speed of people (district units per second). */
const SPEED = 1.35;

/** A point along a path, with its heading (for walking people). */
function along(path: V2[], d: number): { x: number; z: number; h: number; done: boolean } {
  let left = Math.max(0, d);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len || i === path.length - 2) {
      const k = len ? Math.min(1, left / len) : 1;
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, h: Math.atan2(b[0] - a[0], b[1] - a[1]), done: left >= len && i === path.length - 2 };
    }
    left -= len;
  }
  const p = path[path.length - 1];
  return { x: p[0], z: p[1], h: 0, done: true };
}
const pathLen = (path: V2[]) => path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);

export function buildBlock(S: BlockSetup): Block {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  S.parent.add(g);
  const cz = S.coffee ?? { x: 0, z: 0, a: 0 };
  // Coffee lot local (x across the front, z toward the street) to district coordinates.
  const ca = Math.cos(cz.a), sa = Math.sin(cz.a);
  const C = (lx: number, lz: number): V2 => [cz.x + lx * ca + lz * sa, cz.z - lx * sa + lz * ca];
  const P = (lx: number, lz: number): V2 => [S.plot.x + lx, S.plot.z + lz];
  const faceC = cz.a; // facing the street, from the cart

  // ---- Spots ----
  const SERVE = C(0, 0.98);
  const QUEUE = [0, 1, 2, 3].map(k => C(0.52 + k * 0.42, 1.0));
  const ENTRY: V2[] = [C(2.35, 2.5), C(2.35, 1.0)];
  const EXIT: V2[] = [C(-0.5, 1.25), C(-2.35, 1.25), C(-2.35, 2.5), C(-3.6, 2.5)];
  const CHAIRS_AT = C(-1.35, 0.78);
  const SEATS: { x: number; z: number; face: number }[] = [-1.35, 0, 1.35].flatMap(tx => [
    { p: C(tx - 0.42, 1.65), f: faceC + Math.PI / 2 },
    { p: C(tx + 0.42, 1.65), f: faceC - Math.PI / 2 },
  ]).map(s => ({ x: s.p[0], z: s.p[1], face: s.f }));
  const doorAt = P(S.tower.x, S.tower.door);
  const doorOut = P(S.tower.x, 2.4);
  // From the tower's door, along the sidewalk, over the crossing, into the café lot.
  const crossZ = S.plot.z + 2.0;
  const TO_CART: V2[] = [doorAt, doorOut, [doorOut[0] + 0.6, crossZ], [cz.x - 2.35, crossZ], C(-2.35, 1.25), C(-0.5, 1.25), SERVE];
  const FIRST_SEAT = SEATS[0];
  const TO_SEAT: V2[] = [CHAIRS_AT, [FIRST_SEAT.x, CHAIRS_AT[1] + 0.35], [FIRST_SEAT.x, FIRST_SEAT.z]];
  const STALL = P(1.35, -1.05), STALL_FRONT = P(1.35, -0.35);
  const PLAY = P(-1.45, 1.4);

  const person = (shirt: string, scale = 1) => { const p = S.makePerson(shirt); p.scale.setScalar(scale); g.add(p); return p; };
  const cupMesh = () => new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 8).translate(0.13, 0.34, 0.05), S.mat("#ffffff", 0.4));
  const bouquet = () => {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6).rotateX(Math.PI).translate(0.13, 0.33, 0.06), S.mat("#7fd37a", 0.7)));
    for (const [c, dx] of [["#ff6fa0", -0.03], ["#ffd23f", 0.03], ["#b48cff", 0]] as const) b.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4).translate(0.13 + dx, 0.44, 0.06), S.mat(c, 0.7)));
    return b;
  };

  // ---- The neighbor in the yellow jacket ----
  const RS = 1.75; // the neighbor stands out: bigger than the crowd, with a ring at their feet
  const res = person(YELLOW, RS);
  {
    // Dark hair and a collar, so the jacket reads from far away.
    res.add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.58, -0.01), S.mat("#3a2a20", 0.8)));
    res.add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 4, 10).rotateX(Math.PI / 2).translate(0, 0.46, 0), S.mat("#e0a000", 0.6)));
  }
  const resCup = cupMesh();
  res.add(resCup);
  res.visible = false;
  // A soft marker at their feet makes them easy to follow.
  const ringM = S.own(new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, depthWrite: false }));
  const resRing = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.25, 24).rotateX(-Math.PI / 2).translate(0, 0.02, 0), ringM);
  res.add(resRing);

  // ---- The moving truck (and later, deliveries) ----
  const truck = new THREE.Group();
  truck.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 1.05).translate(0, 0.46, -0.2), S.mat("#f4f2fa", 0.5)));
  truck.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.0).translate(0, 0.6, -0.2), S.mat(YELLOW, 0.5)));
  truck.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.4).translate(0, 0.36, 0.52), S.mat("#4f8bff", 0.4, 0.3)));
  truck.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.05).translate(0, 0.48, 0.73), S.mat("#a8d8ff", 0.1, 0.3)));
  for (const wx of [-0.3, 0.3]) for (const wz of [-0.45, 0.5]) truck.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 10).rotateZ(Math.PI / 2).translate(wx, 0.12, wz), S.mat("#2a2f5a")));
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.2), S.mat("#c8925a", 0.8));
  truck.visible = box.visible = false;
  g.add(truck, box);
  // The street in front of the plot: the truck comes along it and stops by the tower.
  const streetZ = S.plot.z + 3.25, stopX = S.plot.x + S.tower.x;
  const placeTruck = (k: number, leaving: boolean) => {
    // k: 0..1 driving in (eases to a stop), or 0..1 driving away.
    const x = leaving ? stopX - k * 4.5 : stopX + (1 - (1 - k) * (1 - k)) * 0 + (1 - k) * (1 - k) * 9;
    truck.position.set(x, 0.04, streetZ);
    truck.rotation.y = -Math.PI / 2; // heading toward -x
    truck.scale.setScalar(leaving ? Math.max(0.01, 1 - Math.max(0, k - 0.6) * 2.5) : Math.min(1, k * 4));
    truck.visible = true;
  };

  // ---- Customers ----
  type Cust = {
    p: THREE.Group; cup: THREE.Mesh; st: "off" | "enter" | "queue" | "serve" | "leave" | "toSeat" | "sit" | "fromSeat";
    path: V2[]; d: number; slot: number; seat: number; until: number; wait: number;
  };
  const shirts = ["#4f8bff", "#ff6fa0", "#5ee0a0", "#b48cff", "#ff8a5c"];
  const custs: Cust[] = shirts.map(c => {
    const p = person(c, 1.4); const cup = cupMesh(); cup.visible = false; p.add(cup); p.visible = false;
    return { p, cup, st: "off", path: [], d: 0, slot: -1, seat: -1, until: 0, wait: 0 };
  });
  const slotTaken = (k: number) => custs.some(c => c.slot === k);
  const serveTaken = () => custs.some(c => c.st === "serve" || (c.st === "queue" && c.slot === -2));
  // Seat 0 is the neighbor's while they're sitting there.
  const seatTaken = (k: number, neighborSits: boolean) => (k === 0 && neighborSits) || custs.some(c => c.seat === k);
  let nextSpawn = 0, lastSale = 0;

  // ---- Flower stall and playground (ghosts until opened) ----
  const ghostM = S.own(new THREE.MeshStandardMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.6 }));
  const stall = new THREE.Group(), slide = new THREE.Group();
  {
    const b = (grp: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, c: string) =>
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), S.mat(c, 0.6)));
    b(stall, 0.9, 0.45, 0.5, 0, 0, 0, "#c8925a");
    for (const x of [-0.42, 0.42]) b(stall, 0.05, 0.95, 0.05, x, 0, 0.22, "#ffffff");
    for (let k = 0; k < 5; k++) b(stall, 0.19, 0.04, 0.6, -0.38 + k * 0.19, 0.95, 0.1, k % 2 ? "#ffffff" : "#ff6fa0");
    const fl = ["#ff6fa0", "#ffd23f", "#b48cff", "#ff8a5c", "#5ee0a0"];
    for (let k = 0; k < 5; k++) {
      stall.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.12, 8).translate(-0.34 + k * 0.17, 0.51, 0.05), S.mat("#4a6fa5", 0.6)));
      stall.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0).translate(-0.34 + k * 0.17, 0.64, 0.05), S.mat(fl[k], 0.8)));
    }
    b(slide, 1.3, 0.04, 1.2, 0, 0, 0, "#e8c48a");
    for (const [x, z] of [[-0.45, -0.2], [-0.15, -0.2], [-0.45, 0.1], [-0.15, 0.1]]) b(slide, 0.05, 0.62, 0.05, x, 0, z, "#4a4f7a");
    b(slide, 0.36, 0.05, 0.36, -0.3, 0.6, -0.05, "#ff5f6d");
    slide.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.26).rotateZ(-0.62).translate(0.22, 0.38, -0.05), S.mat("#ffd23f", 0.5)));
    for (let k = 0; k < 4; k++) b(slide, 0.3, 0.03, 0.04, -0.3, 0.12 + k * 0.14, 0.14, "#4fc3ff");
  }
  stall.position.set(STALL[0], 0.22, STALL[1]); stall.rotation.y = 0;
  slide.position.set(PLAY[0], 0.22, PLAY[1]);
  g.add(stall, slide);
  const ghost = (grp: THREE.Group, on: boolean) => { grp.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.userData.real ??= m.material; m.material = on ? ghostM : m.userData.real; }); };
  const flowersOpen = S.done.includes("flowers"), playOpen = S.done.includes("play");
  stall.visible = flowersOpen || S.offered;
  slide.visible = playOpen || S.offered;
  if (!flowersOpen) ghost(stall, true);
  if (!playOpen) ghost(slide, true);

  // Shoppers (flower market) and a family (playground).
  const shoppers = ["#3ac0c0", "#e8457a"].map(c => { const p = person(c, 1.4); const bq = bouquet(); bq.visible = false; p.add(bq); p.visible = false; return { p, bq, k: 0 }; });
  const parent1 = person("#5ee0a0", 1.4), parent2 = person("#4f8bff", 1.4), child = person("#ff8a5c", 1.0);
  parent1.visible = parent2.visible = child.visible = false;

  // ---- Folded chairs by the cart, and the terrace's two chairs unfolding ----
  const chairM = S.mat("#ffffff", 0.6);
  const mkChair = () => {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3).translate(0, 0.26, 0), chairM));
    c.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.04).translate(0, 0.42, -0.14), chairM));
    for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) c.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.03).translate(x, 0.13, z), S.mat("#4a4f7a", 0.5)));
    g.add(c);
    return c;
  };
  const chairs = [mkChair(), mkChair()];
  const FOLD: V2[] = [C(-0.82, 0.25), C(-0.82, 0.48)];
  const UNFOLD = [SEATS[0], SEATS[1]];
  const placeChairs = (k: number) => {
    // k = 0 folded against the cart's side, 1 open at the first table.
    chairs.forEach((c, i) => {
      const f = FOLD[i], u = UNFOLD[i], e = k * k * (3 - 2 * k);
      c.visible = S.coffee !== null && (S.terrace < 2 || k < 1);
      c.position.set(f[0] + (u.x - f[0]) * e, 0.2 + Math.sin(e * Math.PI) * 0.25, f[1] + (u.z - f[1]) * e);
      // Folded: flat and leaning against the cart; open: standing, facing the table.
      c.rotation.set((1 - e) * -1.25, faceC + (1 - e) * Math.PI / 2 + e * (u.face - faceC), 0);
      c.scale.set(1, 1 - (1 - e) * 0.35, 1);
    });
  };
  placeChairs(S.terrace === 2 ? 1 : 0);

  let resPos: THREE.Vector3 | null = null;
  const put = (p: THREE.Object3D, x: number, z: number, h: number, t: number, walking: boolean, y = 0.2) => {
    p.position.set(x, y + (walking ? Math.abs(Math.sin(t * 9 + x)) * 0.04 : 0), z);
    p.rotation.y = h;
  };

  return {
    resident: () => resPos,
    spot: id => (id === "flowers" ? { x: STALL[0], z: STALL[1] } : { x: PLAY[0], z: PLAY[1] }),
    update(now, dt, t, B, sale) {
      const stage = B?.stage ?? "none", since = Math.max(0, now - (B?.at ?? 0)) / 1000, fast = !!B?.reduced;
      resPos = null;
      res.visible = false;
      truck.visible = box.visible = false;
      resCup.visible = false;
      ringM.opacity = 0.35 + Math.sin(t * 4) * 0.15;
      const neighborSits = stage === "seat";

      // -- The neighbor's story --
      if (S.coffee && S.hasStarter && stage !== "none") {
        let x = doorAt[0], z = doorAt[1], h = faceC, walking = false, y = 0.2, show = true, sit = false;
        if (stage === "arrive") {
          // 0-2.4 s the truck pulls up; 2.4-2.9 the door opens; then they walk to the
          // tower's door and go in; 5.6 s on the truck drives off.
          const T = fast ? 99 : since;
          if (T < 2.4) placeTruck(T / 2.4, false);
          else if (T < 5.6) placeTruck(1, false);
          else if (T < 8) placeTruck((T - 5.6) / 2.4, true);
          const rear: V2 = [stopX + 0.7, streetZ - 0.15];
          const walk: V2[] = [rear, [rear[0], doorOut[1]], doorOut, doorAt];
          if (T < 2.9) show = false;
          else {
            const a = along(walk, (T - 2.9) * SPEED);
            x = a.x; z = a.z; h = a.h; walking = !a.done;
            // Into the building: they shrink through the door.
            if (a.done) { const k = Math.min(1, (T - 2.9 - pathLen(walk) / SPEED) / 0.4); show = k < 1; res.scale.setScalar(RS * (1 - k * 0.7)); }
            else res.scale.setScalar(RS);
            // Carrying a box from the truck.
            box.visible = !a.done;
            box.position.set(x, 0.62, z);
          }
        } else if (stage === "home") show = false;
        else if (stage === "toCart") {
          res.scale.setScalar(RS);
          const a = along(TO_CART, fast ? 999 : since * SPEED);
          x = a.x; z = a.z; h = a.done ? faceC + Math.PI : a.h; walking = !a.done;
        } else if (stage === "queue") { [x, z] = SERVE; h = faceC + Math.PI; res.scale.setScalar(RS); }
        else if (stage === "chairs") {
          res.scale.setScalar(RS);
          // Turn from the counter, step over to the folded chairs, and look at them.
          const a = along([SERVE, C(-0.5, 1.05), CHAIRS_AT], fast ? 999 : Math.max(0, since - 0.5) * SPEED * 0.8);
          x = a.x; z = a.z; walking = !a.done && since > 0.5;
          h = since < 0.5 ? faceC + Math.PI : a.done ? Math.atan2(FOLD[0][0] - x, FOLD[0][1] - z) + Math.sin(t * 0.8) * 0.15 : a.h;
          resCup.visible = true;
        } else if (stage === "toSeat" || stage === "seat") {
          res.scale.setScalar(RS);
          resCup.visible = true;
          const T = stage === "seat" || fast ? 99 : since;
          // The chairs unfold first (0-1 s), then they walk to the first seat and sit.
          placeChairs(Math.min(1, T / 1.0));
          const a = along(TO_SEAT, Math.max(0, T - 0.8) * SPEED);
          x = a.x; z = a.z; h = a.done ? FIRST_SEAT.face : a.h; walking = !a.done && T > 0.8;
          if (a.done) { sit = true; y = 0.36; }
        }
        // Their first coffee: the cup appears in their hand at the moment of the sale.
        if (stage === "queue" && B && B.saleAt && now >= B.saleAt) resCup.visible = true;
        if (show) {
          res.visible = true;
          put(res, x, z, h, t, walking, y);
          res.scale.y = res.scale.x * (sit ? 0.82 : 1);
          resRing.visible = !sit;
          resPos = new THREE.Vector3(x, y, z);
        }
      }
      if (stage !== "toSeat") placeChairs(S.terrace === 2 ? 1 : 0);

      // -- Customers: the queue, the counter, take-away or the terrace --
      const crowd = !!B?.crowd && !!S.coffee;
      const firstDue = !!B && B.saleAt > 0 && now < B.saleAt + 1500;
      if (sale > lastSale) {
        // A sale: whoever is at the counter gets their cup (the neighbor's own first one
        // is timed separately).
        lastSale = sale;
        const c = custs.find(q => q.st === "serve");
        if (c && !firstDue) { c.cup.visible = true; c.until = now + 450; }
      }
      if (crowd && now > nextSpawn && stage !== "queue" && stage !== "toCart") {
        nextSpawn = now + 3200 + Math.random() * 2600;
        const free = [0, 1, 2, 3].find(k => !slotTaken(k));
        const c = custs.find(q => q.st === "off");
        if (c && free !== undefined) { c.st = "enter"; c.slot = free; c.path = [...ENTRY, QUEUE[free]]; c.d = 0; c.p.visible = true; c.cup.visible = false; c.seat = -1; c.wait = 0; }
      }
      for (const c of custs) {
        if (c.st === "off") { c.p.visible = false; continue; }
        if (!crowd && (c.st === "enter" || c.st === "queue")) { c.st = "off"; c.slot = -1; c.p.visible = false; continue; }
        let walking = false, x = c.p.position.x, z = c.p.position.z, h = c.p.rotation.y, y = 0.2;
        if (c.st === "enter" || c.st === "leave" || c.st === "toSeat" || c.st === "fromSeat") {
          c.d += dt * SPEED * (fast ? 20 : 1);
          const a = along(c.path, c.d);
          x = a.x; z = a.z; h = a.h; walking = !a.done;
          if (a.done) {
            if (c.st === "enter") { c.st = "queue"; }
            else if (c.st === "toSeat") { c.st = "sit"; c.until = now + 9000 + Math.random() * 6000; }
            else { c.st = "off"; c.p.visible = false; c.seat = -1; c.cup.visible = false; continue; }
          }
        }
        if (c.st === "queue") {
          // Step forward when the place ahead is free; the front of the line goes to the counter.
          if (c.slot === 0 && !serveTaken() && stage !== "queue") { c.st = "serve"; c.slot = -1; c.path = [QUEUE[0], SERVE]; c.d = 0; c.wait = now; }
          else if (c.slot > 0 && !slotTaken(c.slot - 1)) { c.slot--; }
          const q = c.slot >= 0 ? QUEUE[c.slot] : SERVE;
          const dx = q[0] - x, dz = q[1] - z, dist = Math.hypot(dx, dz);
          if (dist > 0.02) { const st = Math.min(dist, dt * SPEED); x += (dx / dist) * st; z += (dz / dist) * st; walking = true; }
          // Waiting: facing the front of the line.
          h = walking ? Math.atan2(dx, dz) : Math.atan2(SERVE[0] - x, SERVE[1] - z);
        } else if (c.st === "serve") {
          const dx = SERVE[0] - x, dz = SERVE[1] - z, dist = Math.hypot(dx, dz);
          if (dist > 0.02) { const st = Math.min(dist, dt * SPEED); x += (dx / dist) * st; z += (dz / dist) * st; walking = true; h = Math.atan2(dx, dz); }
          else h = faceC + Math.PI;
          // Cup in hand: off they go, to a free seat on the terrace or away down the street.
          if (c.cup.visible && now > c.until) {
            const seat = S.terrace === 2 && Math.random() < 0.55 ? [1, 2, 3, 4, 5].find(k => !seatTaken(k, neighborSits)) : undefined;
            if (seat !== undefined) { c.seat = seat; const s = SEATS[seat]; c.st = "toSeat"; c.path = [SERVE, [SERVE[0] + (s.x - SERVE[0]) * 0.5, C(0, 1.25)[1]], [s.x, C(0, 1.25)[1]], [s.x, s.z]]; }
            else { c.st = "leave"; c.path = [SERVE, ...EXIT]; }
            c.d = 0;
          } else if (!c.cup.visible && now - c.wait > 30000) { c.st = "leave"; c.path = [SERVE, ...EXIT]; c.d = 0; }
        } else if (c.st === "sit") {
          const s = SEATS[c.seat]; x = s.x; z = s.z; h = s.face; y = 0.36;
          if (now > c.until) { c.st = "fromSeat"; c.path = [[s.x, s.z], [s.x, C(0, 2.5)[1]], C(-3.6, 2.5)]; c.d = 0; }
        }
        if (c.st === "leave" && c.d > pathLen(c.path) - 0.6) c.p.scale.setScalar(1.4 * Math.max(0.05, (pathLen(c.path) - c.d) / 0.6));
        else c.p.scale.setScalar(1.4);
        put(c.p, x, z, h, t, walking, y);
        c.p.scale.y = c.p.scale.x * (c.st === "sit" ? 0.82 : 1);
      }

      // -- The flower market: a delivery when it opens, then shoppers leaving with flowers --
      const op = B?.opened, opSince = op ? (now - op.at) / 1000 : 99;
      if (flowersOpen) {
        if (op?.id === "flowers" && opSince < 7) {
          if (opSince < 2.4) placeTruck(opSince / 2.4, false);
          else if (opSince < 4.6) placeTruck(1, false);
          else placeTruck((opSince - 4.6) / 2.4, true);
          if (opSince > 2.4 && opSince < 4.6) {
            const a = along([[stopX + 0.7, streetZ - 0.15], [STALL_FRONT[0], streetZ - 0.9], STALL_FRONT], (opSince - 2.4) * SPEED * 1.6);
            box.visible = !a.done; box.position.set(a.x, 0.62, a.z);
          }
        }
        shoppers.forEach((s, i) => {
          // Each shopper loops: walk in from the street, pick up flowers, walk out with them.
          const loopT = ((t + i * 6) % 12) / 12, inPath: V2[] = [[STALL_FRONT[0] + 0.25 * (i ? 1 : -1), S.plot.z + 2.6], STALL_FRONT];
          s.p.visible = true;
          if (loopT < 0.4) { const a = along(inPath, (loopT / 0.4) * pathLen(inPath)); put(s.p, a.x, a.z, a.h, t, true); s.bq.visible = false; }
          else if (loopT < 0.55) { put(s.p, STALL_FRONT[0], STALL_FRONT[1], Math.atan2(STALL[0] - STALL_FRONT[0], STALL[1] - STALL_FRONT[1]), t, false); s.bq.visible = loopT > 0.5; }
          else { const a = along([...inPath].reverse(), ((loopT - 0.55) / 0.45) * pathLen(inPath)); put(s.p, a.x, a.z, a.h, t, true); s.bq.visible = true; }
        });
      } else shoppers.forEach(s => { s.p.visible = false; });

      // -- The playground: a family walks over from the tower; the child plays on the slide --
      if (playOpen) {
        const arriving = op?.id === "play" && opSince < 6;
        const toPlay: V2[] = [doorAt, P(S.tower.x - 0.35, 1.0), [PLAY[0] + 0.45, PLAY[1] - 0.15]];
        const fam: [THREE.Group, number][] = [[parent1, -0.25], [parent2, 0.25], [child, 0]];
        fam.forEach(([p, off], k) => {
          p.visible = true;
          if (arriving) {
            const a = along(toPlay, Math.max(0, opSince - k * 0.4) * SPEED * 0.9);
            put(p, a.x + off, a.z, a.h, t, !a.done);
          } else if (p === child) {
            // Up the ladder, down the slide, round again.
            const k2 = (t % 4) / 4;
            if (k2 < 0.45) put(p, PLAY[0] - 0.3, PLAY[1] + 0.14 - k2 * 0.2, Math.PI, t, false, 0.22 + (k2 / 0.45) * 0.6);
            else if (k2 < 0.7) { const s = (k2 - 0.45) / 0.25; put(p, PLAY[0] - 0.3 + s * 0.65, PLAY[1] - 0.05, Math.PI / 2, t, false, 0.82 - s * 0.6); }
            else put(p, PLAY[0] + 0.45 - (k2 - 0.7) * 2.5, PLAY[1] + 0.2, -Math.PI / 2, t, true);
          } else put(p, PLAY[0] + 0.9 + off, PLAY[1] + 0.6, -Math.PI / 2 - 0.4, t, false);
        });
      } else { parent1.visible = parent2.visible = child.visible = false; }
    },
  };
}

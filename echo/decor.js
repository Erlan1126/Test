// Echo: world decorations. Each world has its own things set into its caves (pools, crystals,
// lava, coral, mine timbers, stars), more of them the deeper you go; moss, snow and the like are
// painted into the rock itself (SURFACES in render.js). Items are placed once per level, painted
// into the cave art (so light reveals them), and the glowing ones also give off light.
"use strict";

function planDecor() {
  const t = themeIndex(levelIndex), r = seeded((levelIndex + 7) * 613 + 29), items = [], emit = [];
  const depth = levelIndex < 0 ? 200 : levelIndex;
  const dens = Math.min(1, 0.4 + depth / 200);
  const { cols, rows } = L;
  const rock = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || L.tile[y * cols + x] === "#";
  const chance = p => r() < p * dens;
  const glowAt = (x, y, color, rad, a) => {
    if (L.dark) return;
    const e = { x, y, color, r: rad, a, ph: r() * 6 };
    emit.push(e);
    if (items.length) items[items.length - 1].em = e;
  };
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
    if (L.tile[y * cols + x] !== ".") continue;
    const ceil = rock(x, y - 1), floor = rock(x, y + 1), left = rock(x - 1, y), right = rock(x + 1, y);
    const fx = x + 0.2 + r() * 0.6;
    // The lost city, in every world: windows and doors cut into the walls (a few still glow, as
    // if someone left a lamp burning), stone pillars along the streets, old lamp posts, banners.
    if ((left || right) && chance(0.13)) {
      const wx = left ? x - 0.3 : x + 1.3, wy = y + 0.38 + r() * 0.15;
      items.push({ k: "window", x: wx, y: wy, s: 0.26 + r() * 0.08, arch: r() < 0.6 });
      if (r() < 0.35) glowAt(wx + (left ? 0.3 : -0.3), wy, "gold", 0.55, 0.12);
    } else if ((left || right) && floor && chance(0.07)) items.push({ k: "door", x: left ? x - 0.24 : x + 1.24, y: y + 1, s: 0.3, seed: r() });
    if (ceil && floor && (left !== right) && chance(0.16)) items.push({ k: "pillar", x: left ? x + 0.18 : x + 0.82, y });
    else if (floor && !ceil && chance(0.06)) { const lit = r() < 0.3; items.push({ k: "lamp", x: fx, y: y + 1, s: 0.7, lit }); if (lit) glowAt(fx, y + 0.35, "gold", 0.6, 0.16); }
    if (ceil && chance(0.05)) items.push({ k: "banner", x: fx, y, s: 0.45 + r() * 0.2, seed: r() });
    if (t === 0) {
      if (floor && chance(0.22)) { items.push({ k: "pool", x: fx, y: y + 1, s: 0.5 + r() * 0.3 }); glowAt(fx, y + 0.9, "cyan", 0.8, 0.22); }
      if ((left || right) && chance(0.3)) items.push({ k: "flecks", x: left ? x : x + 1, y: y + r(), side: left ? -1 : 1, seed: r(), color: "#bfe8ff" });
    } else if (t === 1) {
      // Mossy Hollow's moss is painted into the rock (SURFACES); mushrooms do the rest.
    } else if (t === 2) {
      if (floor && chance(0.35)) { items.push({ k: "crystals", x: fx, y: y + 1, dir: -1, s: 0.3 + r() * 0.25, seed: r() }); glowAt(fx, y + 0.75, "violet", 0.8, 0.28); }
      if (ceil && chance(0.25)) { items.push({ k: "crystals", x: fx, y, dir: 1, s: 0.25 + r() * 0.2, seed: r() }); glowAt(fx, y + 0.25, "violet", 0.7, 0.22); }
    } else if (t === 3) {
      if ((left || right || ceil || floor) && chance(0.4)) {
        const side = left ? [-1, 0] : right ? [1, 0] : ceil ? [0, -1] : [0, 1];
        const ex = x + 0.5 + side[0] * 0.8, ey = y + 0.5 + side[1] * 0.8;
        items.push({ k: "lava", x: ex, y: ey, side, s: 0.35 + r() * 0.3, seed: r() });
        glowAt(ex - side[0] * 0.2, ey - side[1] * 0.2, "ember", 0.75, 0.3);
      }
      if (floor && chance(0.12)) { items.push({ k: "vent", x: fx, y: y + 1, s: 0.22 }); glowAt(fx, y + 0.8, "ember", 0.6, 0.3); }
    } else if (t === 4) {
      // Frost Tunnels' snow and frost are painted into the rock (SURFACES).
    } else if (t === 5) {
      if (floor && chance(0.35)) items.push({ k: "coral", x: fx, y: y + 1, s: 0.3 + r() * 0.2, seed: r(), hue: r() < 0.5 ? "#ff8fb1" : "#ffb070" });
      if (floor && chance(0.12)) items.push({ k: "shell", x: x + 0.2 + r() * 0.6, y: y + 1, s: 0.09 });
    } else if (t === 6) {
      if (ceil && floor && !left && !right && chance(0.35)) items.push({ k: "beam", x: x + 0.5, y });
      if (ceil && chance(0.14)) { items.push({ k: "lantern", x: fx, y, s: 0.3 + r() * 0.2 }); glowAt(fx, y + 0.45, "gold", 1, 0.42); }
      if ((left || right) && chance(0.3)) items.push({ k: "flecks", x: left ? x : x + 1, y: y + r(), side: left ? -1 : 1, seed: r(), color: "#ffd36e" });
    } else {
      if (!ceil && !floor && chance(0.1)) { const sy = y + 0.25 + r() * 0.5; items.push({ k: "star", x: fx, y: sy, s: 0.12 + r() * 0.08 }); glowAt(fx, sy, "pink", 0.6, 0.3); }
      if ((left || right) && chance(0.25)) items.push({ k: "stars", x: left ? x : x + 1, y: y + r(), side: left ? -1 : 1, seed: r() });
    }
  }
  // Sit everything on the rock you actually see: the painted edge wanders a little from the
  // tile edge, so floor things are moved down (or up) onto it and hanging things up to it.
  const shape = levelShape();
  const FLOOR = ["pool", "vent", "coral", "shell", "lamp"], CEIL = ["lantern", "banner"];
  // Something wide needs rock under (or over) both ends too, or it's left out: nothing hangs
  // off the end of a ledge into thin air.
  const rest = (x, y, dir) => {
    const ys = [-0.18, 0, 0.18].map(o => shape.surface(x + o, y, dir));
    if (ys.some(v => v === null) || Math.max(...ys) - Math.min(...ys) > 0.35) return null;
    return dir > 0 ? Math.max(...ys) : Math.min(...ys);
  };
  const gone = new Set();
  for (const d of items) {
    const before = d.y;
    if (d.k === "pillar") {
      // A stone column standing on the street and holding up the ceiling.
      d.top = shape.surface(d.x, d.y, -1); d.bot = shape.surface(d.x, d.y + 1, 1);
      if (d.top === null || d.bot === null) gone.add(d);
      continue;
    }
    if (d.k === "beam") {
      // Mine supports stand on the floor and hold up the ceiling, wherever the rock really is.
      d.posts = [-0.32, 0.32].map(o => [d.x + o, shape.surface(d.x + o, d.y, -1), shape.surface(d.x + o, d.y + 1, 1)]);
      if (d.posts.some(p => p[1] === null || p[2] === null)) gone.add(d);
      continue;
    }
    const dir = FLOOR.includes(d.k) || (d.k === "crystals" && d.dir < 0) ? 1 : CEIL.includes(d.k) || (d.k === "crystals" && d.dir > 0) ? -1 : 0;
    if (!dir) continue;
    const y = rest(d.x, d.y, dir);
    if (y === null) { gone.add(d); if (d.em) gone.add(d.em); continue; }
    d.y = y + dir * 0.03;
    if (d.em) d.em.y += d.y - before;
  }
  L.shrooms = L.shrooms.filter(m => {
    const y = shape.surface(m.x, m.y - 0.06, 1);
    if (y === null) return false;
    m.y = y + 0.03;
    return true;
  });
  L.decor = items.filter(d => !gone.has(d));
  L.emitters = emit.filter(e => !gone.has(e));
}

// Draws the decorations into a cave art canvas; sc is art pixels per screen pixel.
// Things set into the rock (lava veins, mineral flecks, star crystals) are painted on a side
// layer and trimmed to the rock, using the bump map's rock mask, so none of them spill into the air.
const IN_ROCK = new Set(["lava", "flecks", "stars", "window", "door"]);
function paintDecor(c, sc, mask) {
  if (!L.decor) return;
  let side = null;
  if (mask) {
    side = document.createElement("canvas");
    side.width = c.canvas.width; side.height = c.canvas.height;
    paintDecorItems(side.getContext("2d"), sc, d => IN_ROCK.has(d.k));
    const sctx = side.getContext("2d");
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(mask, 0, 0, side.width, side.height);
    c.drawImage(side, 0, 0);
  }
  paintDecorItems(c, sc, d => !mask || !IN_ROCK.has(d.k));
}

function paintDecorItems(c, sc, which) {
  const u = TS * sc, X = x => (x + LM.mx) * u, Y = y => (y + LM.my) * u, th = themeOf(levelIndex);
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const d of L.decor) {
    if (!which(d)) continue;
    const rr = seeded(Math.floor((d.seed || 0.5) * 1e6) + 1);
    if (d.k === "pool") {
      const g = c.createRadialGradient(X(d.x), Y(d.y) - u * 0.04, 0, X(d.x), Y(d.y) - u * 0.04, u * d.s * 0.6);
      g.addColorStop(0, "rgba(200,245,255,0.85)"); g.addColorStop(0.6, "rgba(110,200,240,0.5)"); g.addColorStop(1, "rgba(110,200,240,0)");
      c.fillStyle = g;
      c.beginPath(); c.ellipse(X(d.x), Y(d.y) - u * 0.04, u * d.s * 0.6, u * 0.08, 0, 0, Math.PI * 2); c.fill();
    } else if (d.k === "flecks" || d.k === "stars") {
      const n = d.k === "stars" ? 4 : 5, pts = [];
      for (let q = 0; q < n; q++) pts.push([X(d.x + d.side * (0.08 + rr() * 0.35)), Y(d.y - 0.3 + rr() * 0.6)]);
      if (d.k === "stars") {
        c.strokeStyle = "rgba(255,190,235,0.35)"; c.lineWidth = Math.max(1, u * 0.012);
        c.beginPath(); pts.forEach(([px, py], q) => (q ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
      }
      c.fillStyle = d.k === "stars" ? "rgba(255,225,245,0.95)" : d.color;
      for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, u * (0.012 + rr() * 0.018), 0, Math.PI * 2); c.fill(); }
    } else if (d.k === "crystals") {
      for (let q = 0; q < 4; q++) {
        const a = Math.PI / 2 * d.dir + (q - 1.5) * 0.35 + (rr() - 0.5) * 0.2, len = u * d.s * (0.6 + rr() * 0.6), wd = u * 0.06;
        const bx = X(d.x + (q - 1.5) * 0.08), by = Y(d.y), tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
        const nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd, px = tx + Math.cos(a) * wd * 1.4, py = ty + Math.sin(a) * wd * 1.4;
        // Each shard has a lit face and a shadowed face meeting at a ridge, darker at the root.
        for (const [s, top, bot] of [[1, "rgba(206,176,255,0.95)", "rgba(70,40,120,0.95)"], [-1, "rgba(120,86,190,0.95)", "rgba(40,22,74,0.95)"]]) {
          const g = c.createLinearGradient(bx, by, tx, ty);
          g.addColorStop(0, bot); g.addColorStop(1, top);
          c.fillStyle = g;
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + nx * s, by + ny * s); c.lineTo(tx + nx * 0.6 * s, ty + ny * 0.6 * s); c.lineTo(px, py); c.closePath(); c.fill();
        }
        c.strokeStyle = "rgba(240,228,255,0.55)"; c.lineWidth = Math.max(1, u * 0.01);
        c.beginPath(); c.moveTo(bx + (tx - bx) * 0.25, by + (ty - by) * 0.25); c.lineTo(px, py); c.stroke();
      }
    } else if (d.k === "lava") {
      // A crack in the rock with molten stone inside: a dark crust, a glowing core and a
      // white-hot thread, with a short branch.
      const [sxd, syd] = d.side, along = [syd, -sxd], pts = [];
      for (let q = 0; q <= 6; q++) {
        const k = (q / 6 - 0.5) * d.s * 2, jit = (rr() - 0.5) * 0.14;
        pts.push([X(d.x + along[0] * k + sxd * jit), Y(d.y + along[1] * k + syd * jit)]);
      }
      const b = pts[2 + Math.floor(rr() * 3)], bl = u * d.s * 0.45, bs = rr() < 0.5 ? 1 : -1;
      const branch = [b, [b[0] + (sxd * 0.8 + along[0] * 0.5 * bs) * bl, b[1] + (syd * 0.8 + along[1] * 0.5 * bs) * bl]];
      const vein = (pp, w, col, blur) => {
        c.strokeStyle = col; c.lineWidth = w; c.shadowBlur = blur; c.shadowColor = "rgba(255,110,40,0.9)";
        c.beginPath(); pp.forEach(([px, py], q) => (q ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
      };
      for (const [pp, k] of [[pts, 1], [branch, 0.6]]) {
        vein(pp, Math.max(2, u * 0.07 * k), "rgba(30,10,6,0.85)", 0);
        vein(pp, Math.max(1.2, u * 0.035 * k), "rgba(230,90,30,0.95)", u * 0.12);
        vein(pp, Math.max(0.6, u * 0.012 * k), "rgba(255,220,150,0.95)", 0);
      }
      c.shadowBlur = 0;
    } else if (d.k === "vent") {
      c.fillStyle = "#2a1410";
      c.beginPath(); c.moveTo(X(d.x - d.s), Y(d.y)); c.lineTo(X(d.x - 0.05), Y(d.y - d.s * 0.9)); c.lineTo(X(d.x + 0.05), Y(d.y - d.s * 0.9)); c.lineTo(X(d.x + d.s), Y(d.y)); c.fill();
      c.fillStyle = "rgba(255,150,70,0.95)"; c.beginPath(); c.ellipse(X(d.x), Y(d.y - d.s * 0.9), u * 0.06, u * 0.025, 0, 0, Math.PI * 2); c.fill();
    } else if (d.k === "coral") {
      c.strokeStyle = d.hue; c.lineWidth = Math.max(1.2, u * 0.045);
      const branch = (x0, y0, a, len, depth) => {
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        if (depth > 0) { branch(x1, y1, a - 0.45 - rr() * 0.2, len * 0.7, depth - 1); branch(x1, y1, a + 0.45 + rr() * 0.2, len * 0.7, depth - 1); }
        else { c.fillStyle = "rgba(255,230,240,0.9)"; c.beginPath(); c.arc(x1, y1, u * 0.025, 0, Math.PI * 2); c.fill(); }
      };
      branch(X(d.x), Y(d.y), -Math.PI / 2, u * d.s * 0.45, 2);
    } else if (d.k === "shell") {
      c.fillStyle = "rgba(255,225,205,0.95)";
      c.beginPath(); c.arc(X(d.x), Y(d.y), u * d.s, Math.PI, 0); c.fill();
      c.strokeStyle = "rgba(200,140,120,0.8)"; c.lineWidth = Math.max(1, u * 0.01);
      for (let q = -2; q <= 2; q++) { c.beginPath(); c.moveTo(X(d.x), Y(d.y)); c.lineTo(X(d.x) + q * u * d.s * 0.45, Y(d.y) - u * d.s * 0.85); c.stroke(); }
    } else if (d.k === "beam") {
      // Timber posts from floor to ceiling with a crossbeam, rounded with light and shade.
      if (!d.posts) continue;
      const post = u * 0.1, wood = (x0, y0, w, h, vertical) => {
        const g = vertical ? c.createLinearGradient(x0, 0, x0 + w, 0) : c.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, "#8a6238"); g.addColorStop(0.45, "#5c3d22"); g.addColorStop(1, "#24170c");
        c.fillStyle = g; c.fillRect(x0, y0, w, h);
        c.strokeStyle = "rgba(30,18,8,0.6)"; c.lineWidth = Math.max(1, u * 0.008);
        for (let q = 1; q < 3; q++) {
          c.beginPath();
          if (vertical) { c.moveTo(x0 + w * q / 3, y0); c.lineTo(x0 + w * q / 3 + (rr() - 0.5) * 2, y0 + h); }
          else { c.moveTo(x0, y0 + h * q / 3); c.lineTo(x0 + w, y0 + h * q / 3 + (rr() - 0.5) * 2); }
          c.stroke();
        }
      };
      for (const [px, top, bot] of d.posts) wood(X(px) - post / 2, Y(top) - u * 0.04, post, Y(bot) - Y(top) + u * 0.08, true);
      const top = Math.max(d.posts[0][1], d.posts[1][1]);
      wood(X(d.posts[0][0]) - post, Y(top), X(d.posts[1][0]) - X(d.posts[0][0]) + post * 2, post * 0.9, false);
    } else if (d.k === "lantern") {
      c.strokeStyle = "rgba(120,100,80,0.9)"; c.lineWidth = Math.max(1, u * 0.015);
      c.beginPath(); c.moveTo(X(d.x), Y(d.y)); c.lineTo(X(d.x), Y(d.y) + u * d.s); c.stroke();
      c.fillStyle = "#3a2a1a"; c.fillRect(X(d.x) - u * 0.07, Y(d.y) + u * d.s, u * 0.14, u * 0.03);
      c.fillStyle = "rgba(255,210,120,0.95)"; c.fillRect(X(d.x) - u * 0.055, Y(d.y) + u * d.s + u * 0.03, u * 0.11, u * 0.13);
      c.fillStyle = "#3a2a1a"; c.fillRect(X(d.x) - u * 0.07, Y(d.y) + u * d.s + u * 0.16, u * 0.14, u * 0.03);
    } else if (d.k === "window") {
      // A window cut into the wall: a stone frame, a dark room behind, sometimes a warm lamp.
      const w = u * d.s, h = u * d.s * 1.35, cx = X(d.x), cy = Y(d.y), lit = !!d.em;
      const frame = (grow, fill) => {
        c.fillStyle = fill; c.beginPath();
        c.moveTo(cx - w / 2 - grow, cy + h / 2 + grow);
        c.lineTo(cx - w / 2 - grow, cy - h / 2 + (d.arch ? w / 2 : 0));
        if (d.arch) c.arc(cx, cy - h / 2 + w / 2, w / 2 + grow, Math.PI, 0); else c.lineTo(cx + w / 2 + grow, cy - h / 2 - grow);
        c.lineTo(cx + w / 2 + grow, cy + h / 2 + grow); c.closePath(); c.fill();
      };
      frame(u * 0.045, `rgba(${th.rim.map(v => Math.round(v * 0.45 + 60)).join(",")},0.85)`);
      frame(0, "#05060c");
      if (lit) {
        const gw = c.createRadialGradient(cx, cy + h * 0.15, 0, cx, cy, h * 0.7);
        gw.addColorStop(0, "rgba(255,205,120,0.85)"); gw.addColorStop(1, "rgba(255,170,80,0.08)");
        frame(-u * 0.01, gw);
      }
      c.strokeStyle = "rgba(20,16,24,0.9)"; c.lineWidth = Math.max(1, u * 0.018);
      c.beginPath(); c.moveTo(cx, cy - h / 2 + (d.arch ? 0 : u * 0.01)); c.lineTo(cx, cy + h / 2); c.moveTo(cx - w / 2, cy + h * 0.05); c.lineTo(cx + w / 2, cy + h * 0.05); c.stroke();
      c.fillStyle = `rgba(${th.rim.map(v => Math.round(v * 0.4 + 70)).join(",")},0.9)`;
      c.fillRect(cx - w / 2 - u * 0.06, cy + h / 2, w + u * 0.12, u * 0.045);
    } else if (d.k === "door") {
      // A round-topped wooden door at street level, long shut.
      const w = u * d.s, h = u * 0.62, cx = X(d.x), by = Y(d.y);
      c.fillStyle = `rgba(${th.rim.map(v => Math.round(v * 0.45 + 60)).join(",")},0.85)`;
      c.beginPath(); c.moveTo(cx - w / 2 - u * 0.05, by); c.lineTo(cx - w / 2 - u * 0.05, by - h + w / 2); c.arc(cx, by - h + w / 2, w / 2 + u * 0.05, Math.PI, 0); c.lineTo(cx + w / 2 + u * 0.05, by); c.fill();
      c.fillStyle = "#3b2414";
      c.beginPath(); c.moveTo(cx - w / 2, by); c.lineTo(cx - w / 2, by - h + w / 2); c.arc(cx, by - h + w / 2, w / 2, Math.PI, 0); c.lineTo(cx + w / 2, by); c.fill();
      c.strokeStyle = "rgba(15,8,4,0.8)"; c.lineWidth = Math.max(1, u * 0.012);
      for (let q = 1; q < 4; q++) { const lx = cx - w / 2 + w * q / 4; c.beginPath(); c.moveTo(lx, by); c.lineTo(lx, by - h + w * 0.3); c.stroke(); }
      c.fillStyle = "#c9a46a"; c.beginPath(); c.arc(cx + w * 0.28, by - h * 0.42, u * 0.022, 0, Math.PI * 2); c.fill();
    } else if (d.k === "pillar") {
      // A carved column: base, fluted shaft, capital.
      if (d.top == null) continue;
      const cx = X(d.x), y0 = Y(d.top) - u * 0.04, y1 = Y(d.bot) + u * 0.04, w = u * 0.15;
      const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      const st = th.rim.map(v => Math.round(v * 0.35 + 55));
      g.addColorStop(0, `rgb(${st.map(v => v + 30).join(",")})`); g.addColorStop(0.55, `rgb(${st.join(",")})`); g.addColorStop(1, `rgb(${st.map(v => v - 30).join(",")})`);
      c.fillStyle = g;
      c.fillRect(cx - w / 2, y0, w, y1 - y0);
      c.fillRect(cx - w * 0.8, y0, w * 1.6, u * 0.07);
      c.fillRect(cx - w * 0.8, y1 - u * 0.07, w * 1.6, u * 0.07);
      c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = Math.max(1, u * 0.01);
      for (const o of [-0.22, 0, 0.22]) { c.beginPath(); c.moveTo(cx + w * o, y0 + u * 0.08); c.lineTo(cx + w * o, y1 - u * 0.08); c.stroke(); }
      if (rr() < 0.4) { c.strokeStyle = "rgba(0,0,0,0.5)"; c.beginPath(); c.moveTo(cx - w * 0.4, (y0 + y1) / 2); c.lineTo(cx + w * 0.1, (y0 + y1) / 2 + u * 0.08); c.lineTo(cx - w * 0.1, (y0 + y1) / 2 + u * 0.18); c.stroke(); }
    } else if (d.k === "lamp") {
      // An old street lamp, iron and glass; a few still flicker.
      const cx = X(d.x), by = Y(d.y), h = u * d.s;
      c.strokeStyle = "#1c2026"; c.lineWidth = Math.max(1.5, u * 0.03);
      c.beginPath(); c.moveTo(cx, by); c.lineTo(cx, by - h); c.quadraticCurveTo(cx, by - h - u * 0.08, cx + u * 0.1, by - h - u * 0.06); c.stroke();
      c.fillStyle = "#1c2026"; c.fillRect(cx - u * 0.06, by - u * 0.04, u * 0.12, u * 0.04);
      c.fillStyle = d.lit ? "rgba(255,214,140,0.95)" : "rgba(120,140,160,0.35)";
      c.beginPath(); c.moveTo(cx + u * 0.04, by - h - u * 0.04); c.lineTo(cx + u * 0.16, by - h - u * 0.04); c.lineTo(cx + u * 0.14, by - h + u * 0.1); c.lineTo(cx + u * 0.06, by - h + u * 0.1); c.closePath(); c.fill();
    } else if (d.k === "banner") {
      // A torn banner in the world's colour, with the city's mark: a little sung note.
      const cx = X(d.x), ty = Y(d.y), w = u * 0.22, h = u * d.s;
      c.strokeStyle = "#2a2f3a"; c.lineWidth = Math.max(1, u * 0.02);
      c.beginPath(); c.moveTo(cx - w * 0.7, ty + u * 0.02); c.lineTo(cx + w * 0.7, ty + u * 0.02); c.stroke();
      c.fillStyle = `rgba(${th.rim.map(v => Math.round(v * 0.55)).join(",")},0.85)`;
      c.beginPath(); c.moveTo(cx - w / 2, ty + u * 0.02); c.lineTo(cx + w / 2, ty + u * 0.02); c.lineTo(cx + w / 2, ty + h * (0.8 + rr() * 0.2));
      c.lineTo(cx + w * 0.1, ty + h * (0.7 + rr() * 0.15)); c.lineTo(cx - w * 0.15, ty + h); c.lineTo(cx - w / 2, ty + h * (0.75 + rr() * 0.2)); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,240,200,0.55)"; c.lineWidth = Math.max(1, u * 0.012);
      c.beginPath(); c.arc(cx - w * 0.06, ty + h * 0.45, u * 0.03, 0, Math.PI * 2); c.moveTo(cx - w * 0.06 + u * 0.03, ty + h * 0.45); c.lineTo(cx - w * 0.06 + u * 0.03, ty + h * 0.2); c.stroke();
    } else if (d.k === "star") {
      c.fillStyle = "rgba(255,225,245,0.95)";
      c.beginPath();
      for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4, rad = q % 2 ? u * d.s * 0.35 : u * d.s; c.lineTo(X(d.x) + Math.cos(a) * rad, Y(d.y) + Math.sin(a) * rad); }
      c.closePath(); c.fill();
    }
  }
  c.restore();
}

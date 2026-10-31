// Echo: world decorations. Each world has its own things growing, hanging and glowing in its
// caves, and there are more of them the deeper you go. Items are placed once per level, painted
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
    if (t === 0) {
      if (floor && chance(0.22)) { items.push({ k: "pool", x: fx, y: y + 1, s: 0.5 + r() * 0.3 }); glowAt(fx, y + 0.9, "cyan", 0.8, 0.22); }
      if (ceil && chance(0.35)) items.push({ k: "roots", x: fx, y, s: 0.3 + r() * 0.35, n: 2 + Math.floor(r() * 3), seed: r() });
      if ((left || right) && chance(0.3)) items.push({ k: "flecks", x: left ? x : x + 1, y: y + r(), side: left ? -1 : 1, seed: r(), color: "#bfe8ff" });
    } else if (t === 1) {
      if (ceil && chance(0.55)) items.push({ k: "moss", x: fx, y, s: 0.3 + r() * 0.5, n: 3 + Math.floor(r() * 4), seed: r() });
      if (floor && chance(0.35)) items.push({ k: "fern", x: fx, y: y + 1, s: 0.32 + r() * 0.2, seed: r() });
      else if (floor && chance(0.45)) items.push({ k: "grass", x: fx, y: y + 1, s: 0.18 + r() * 0.12, seed: r() });
    } else if (t === 2) {
      if (floor && chance(0.35)) { items.push({ k: "crystals", x: fx, y: y + 1, dir: -1, s: 0.3 + r() * 0.25, seed: r() }); glowAt(fx, y + 0.75, "violet", 0.8, 0.28); }
      if (ceil && chance(0.25)) { items.push({ k: "crystals", x: fx, y, dir: 1, s: 0.25 + r() * 0.2, seed: r() }); glowAt(fx, y + 0.25, "violet", 0.7, 0.22); }
    } else if (t === 3) {
      if ((left || right || ceil || floor) && chance(0.4)) {
        const side = left ? [-1, 0] : right ? [1, 0] : ceil ? [0, -1] : [0, 1];
        const ex = x + 0.5 + side[0] * 0.62, ey = y + 0.5 + side[1] * 0.62;
        items.push({ k: "lava", x: ex, y: ey, side, s: 0.35 + r() * 0.3, seed: r() });
        glowAt(ex - side[0] * 0.2, ey - side[1] * 0.2, "ember", 0.75, 0.3);
      }
      if (floor && chance(0.12)) { items.push({ k: "vent", x: fx, y: y + 1, s: 0.22 }); glowAt(fx, y + 0.8, "ember", 0.6, 0.3); }
    } else if (t === 4) {
      if (ceil && chance(0.6)) items.push({ k: "icicles", x: fx, y, s: 0.25 + r() * 0.25, n: 2 + Math.floor(r() * 3), seed: r() });
      if (floor && chance(0.55)) items.push({ k: "snow", x: x + 0.5, y: y + 1, s: 0.45 + r() * 0.3 });
    } else if (t === 5) {
      if (floor && chance(0.35)) items.push({ k: "coral", x: fx, y: y + 1, s: 0.3 + r() * 0.2, seed: r(), hue: r() < 0.5 ? "#ff8fb1" : "#ffb070" });
      else if (floor && chance(0.4)) items.push({ k: "weed", x: fx, y: y + 1, s: 0.45 + r() * 0.35, seed: r() });
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
  const FLOOR = ["pool", "fern", "grass", "vent", "snow", "coral", "weed", "shell"], CEIL = ["roots", "moss", "icicles", "lantern"];
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
function paintDecor(c, sc) {
  if (!L.decor) return;
  const u = TS * sc, X = x => (x + LM.mx) * u, Y = y => (y + LM.my) * u;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const d of L.decor) {
    const rr = seeded(Math.floor((d.seed || 0.5) * 1e6) + 1);
    if (d.k === "pool") {
      const g = c.createRadialGradient(X(d.x), Y(d.y) - u * 0.04, 0, X(d.x), Y(d.y) - u * 0.04, u * d.s * 0.6);
      g.addColorStop(0, "rgba(200,245,255,0.85)"); g.addColorStop(0.6, "rgba(110,200,240,0.5)"); g.addColorStop(1, "rgba(110,200,240,0)");
      c.fillStyle = g;
      c.beginPath(); c.ellipse(X(d.x), Y(d.y) - u * 0.04, u * d.s * 0.6, u * 0.08, 0, 0, Math.PI * 2); c.fill();
    } else if (d.k === "roots" || d.k === "moss") {
      const moss = d.k === "moss";
      for (let q = 0; q < d.n; q++) {
        const x0 = X(d.x + (q - d.n / 2) * 0.09), len = u * d.s * (0.6 + rr() * 0.6), sway = (rr() - 0.5) * u * 0.15;
        c.strokeStyle = moss ? `rgba(${90 + rr() * 40},${170 + rr() * 50},${90 + rr() * 30},0.9)` : "rgba(70,96,130,0.95)";
        c.lineWidth = Math.max(1, u * (moss ? 0.035 : 0.025));
        c.beginPath(); c.moveTo(x0, Y(d.y) - u * 0.05);
        c.bezierCurveTo(x0 + sway, Y(d.y) + len * 0.4, x0 - sway, Y(d.y) + len * 0.7, x0 + sway * 0.5, Y(d.y) + len);
        c.stroke();
        if (moss) { c.fillStyle = "rgba(170,240,150,0.9)"; c.beginPath(); c.arc(x0 + sway * 0.5, Y(d.y) + len, u * 0.025, 0, Math.PI * 2); c.fill(); }
      }
    } else if (d.k === "flecks" || d.k === "stars") {
      const n = d.k === "stars" ? 4 : 5, pts = [];
      for (let q = 0; q < n; q++) pts.push([X(d.x + d.side * (0.08 + rr() * 0.35)), Y(d.y - 0.3 + rr() * 0.6)]);
      if (d.k === "stars") {
        c.strokeStyle = "rgba(255,190,235,0.35)"; c.lineWidth = Math.max(1, u * 0.012);
        c.beginPath(); pts.forEach(([px, py], q) => (q ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
      }
      c.fillStyle = d.k === "stars" ? "rgba(255,225,245,0.95)" : d.color;
      for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, u * (0.012 + rr() * 0.018), 0, Math.PI * 2); c.fill(); }
    } else if (d.k === "fern") {
      c.strokeStyle = "rgba(110,200,120,0.95)"; c.lineWidth = Math.max(1, u * 0.03);
      for (let q = 0; q < 5; q++) {
        const a = -Math.PI / 2 + (q - 2) * 0.42, len = u * d.s * (0.75 + rr() * 0.4);
        const ex = X(d.x) + Math.cos(a) * len, ey = Y(d.y) + Math.sin(a) * len;
        c.beginPath(); c.moveTo(X(d.x), Y(d.y)); c.quadraticCurveTo(X(d.x) + Math.cos(a) * len * 0.3, ey, ex + Math.cos(a) * len * 0.2, ey + len * 0.15); c.stroke();
        c.fillStyle = "rgba(140,225,140,0.8)";
        for (let s2 = 0.35; s2 < 0.95; s2 += 0.2) { c.beginPath(); c.ellipse(X(d.x) + (ex - X(d.x)) * s2, Y(d.y) + (ey - Y(d.y)) * s2, u * 0.035, u * 0.016, a, 0, Math.PI * 2); c.fill(); }
      }
    } else if (d.k === "grass") {
      c.strokeStyle = "rgba(120,210,130,0.9)"; c.lineWidth = Math.max(1, u * 0.02);
      for (let q = 0; q < 5; q++) { const bx = X(d.x + (q - 2) * 0.05); c.beginPath(); c.moveTo(bx, Y(d.y)); c.quadraticCurveTo(bx + (rr() - 0.5) * u * 0.1, Y(d.y) - u * d.s * 0.6, bx + (rr() - 0.5) * u * 0.15, Y(d.y) - u * d.s * (0.7 + rr() * 0.5)); c.stroke(); }
    } else if (d.k === "crystals") {
      for (let q = 0; q < 4; q++) {
        const a = Math.PI / 2 * d.dir + (q - 1.5) * 0.35 + (rr() - 0.5) * 0.2, len = u * d.s * (0.6 + rr() * 0.6), wd = u * 0.06;
        const bx = X(d.x + (q - 1.5) * 0.08), by = Y(d.y), tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
        const nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
        const g = c.createLinearGradient(bx, by, tx, ty);
        g.addColorStop(0, "rgba(120,80,200,0.95)"); g.addColorStop(1, "rgba(235,215,255,0.95)");
        c.fillStyle = g;
        c.beginPath(); c.moveTo(bx + nx, by + ny); c.lineTo(tx + nx * 0.6, ty + ny * 0.6); c.lineTo(tx + Math.cos(a) * wd * 1.4, ty + Math.sin(a) * wd * 1.4); c.lineTo(tx - nx * 0.6, ty - ny * 0.6); c.lineTo(bx - nx, by - ny); c.closePath(); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = Math.max(1, u * 0.012);
        c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
      }
    } else if (d.k === "lava") {
      const [sxd, syd] = d.side, along = [syd, -sxd];
      c.strokeStyle = "rgba(255,120,50,0.9)"; c.lineWidth = Math.max(1.2, u * 0.035);
      c.shadowColor = "rgba(255,140,60,0.9)"; c.shadowBlur = u * 0.15;
      c.beginPath();
      for (let q = 0; q <= 5; q++) {
        const k = (q / 5 - 0.5) * d.s * 2, jit = (rr() - 0.5) * 0.12;
        const px = X(d.x + along[0] * k + sxd * jit), py = Y(d.y + along[1] * k + syd * jit);
        q ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
      c.shadowBlur = 0;
    } else if (d.k === "vent") {
      c.fillStyle = "#2a1410";
      c.beginPath(); c.moveTo(X(d.x - d.s), Y(d.y)); c.lineTo(X(d.x - 0.05), Y(d.y - d.s * 0.9)); c.lineTo(X(d.x + 0.05), Y(d.y - d.s * 0.9)); c.lineTo(X(d.x + d.s), Y(d.y)); c.fill();
      c.fillStyle = "rgba(255,150,70,0.95)"; c.beginPath(); c.ellipse(X(d.x), Y(d.y - d.s * 0.9), u * 0.06, u * 0.025, 0, 0, Math.PI * 2); c.fill();
    } else if (d.k === "icicles") {
      for (let q = 0; q < d.n; q++) {
        const bx = X(d.x + (q - d.n / 2) * 0.12), len = u * d.s * (0.5 + rr() * 0.8), wd = u * (0.04 + rr() * 0.03);
        const g = c.createLinearGradient(bx, Y(d.y), bx, Y(d.y) + len);
        g.addColorStop(0, "rgba(220,240,255,0.95)"); g.addColorStop(1, "rgba(160,215,255,0.5)");
        c.fillStyle = g;
        c.beginPath(); c.moveTo(bx - wd, Y(d.y) - u * 0.03); c.lineTo(bx + wd, Y(d.y) - u * 0.03); c.lineTo(bx, Y(d.y) + len); c.closePath(); c.fill();
      }
    } else if (d.k === "snow") {
      const g = c.createLinearGradient(0, Y(d.y) - u * 0.14, 0, Y(d.y) + u * 0.04);
      g.addColorStop(0, "rgba(245,250,255,0.95)"); g.addColorStop(1, "rgba(190,215,240,0.8)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(X(d.x - d.s), Y(d.y) + u * 0.04);
      c.bezierCurveTo(X(d.x - d.s * 0.5), Y(d.y) - u * 0.16, X(d.x + d.s * 0.5), Y(d.y) - u * 0.12, X(d.x + d.s), Y(d.y) + u * 0.04);
      c.closePath(); c.fill();
    } else if (d.k === "coral") {
      c.strokeStyle = d.hue; c.lineWidth = Math.max(1.2, u * 0.045);
      const branch = (x0, y0, a, len, depth) => {
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        if (depth > 0) { branch(x1, y1, a - 0.45 - rr() * 0.2, len * 0.7, depth - 1); branch(x1, y1, a + 0.45 + rr() * 0.2, len * 0.7, depth - 1); }
        else { c.fillStyle = "rgba(255,230,240,0.9)"; c.beginPath(); c.arc(x1, y1, u * 0.025, 0, Math.PI * 2); c.fill(); }
      };
      branch(X(d.x), Y(d.y), -Math.PI / 2, u * d.s * 0.45, 2);
    } else if (d.k === "weed") {
      c.strokeStyle = "rgba(70,190,160,0.9)"; c.lineWidth = Math.max(1.2, u * 0.035);
      for (let q = 0; q < 3; q++) {
        const bx = X(d.x + (q - 1) * 0.06), top = Y(d.y) - u * d.s * (0.6 + rr() * 0.5), w2 = u * 0.07;
        c.beginPath(); c.moveTo(bx, Y(d.y));
        c.bezierCurveTo(bx + w2, Y(d.y) - u * d.s * 0.3, bx - w2, Y(d.y) - u * d.s * 0.6, bx + w2 * 0.5, top);
        c.stroke();
      }
    } else if (d.k === "shell") {
      c.fillStyle = "rgba(255,225,205,0.95)";
      c.beginPath(); c.arc(X(d.x), Y(d.y), u * d.s, Math.PI, 0); c.fill();
      c.strokeStyle = "rgba(200,140,120,0.8)"; c.lineWidth = Math.max(1, u * 0.01);
      for (let q = -2; q <= 2; q++) { c.beginPath(); c.moveTo(X(d.x), Y(d.y)); c.lineTo(X(d.x) + q * u * d.s * 0.45, Y(d.y) - u * d.s * 0.85); c.stroke(); }
    } else if (d.k === "beam") {
      c.fillStyle = "#5c3d22"; c.strokeStyle = "#2e1e10"; c.lineWidth = Math.max(1, u * 0.02);
      const post = u * 0.09;
      c.fillRect(X(d.x - 0.5), Y(d.y), post, u); c.strokeRect(X(d.x - 0.5), Y(d.y), post, u);
      c.fillRect(X(d.x + 0.5) - post, Y(d.y), post, u); c.strokeRect(X(d.x + 0.5) - post, Y(d.y), post, u);
      c.fillRect(X(d.x - 0.55), Y(d.y), u * 1.1, post); c.strokeRect(X(d.x - 0.55), Y(d.y), u * 1.1, post);
    } else if (d.k === "lantern") {
      c.strokeStyle = "rgba(120,100,80,0.9)"; c.lineWidth = Math.max(1, u * 0.015);
      c.beginPath(); c.moveTo(X(d.x), Y(d.y)); c.lineTo(X(d.x), Y(d.y) + u * d.s); c.stroke();
      c.fillStyle = "#3a2a1a"; c.fillRect(X(d.x) - u * 0.07, Y(d.y) + u * d.s, u * 0.14, u * 0.03);
      c.fillStyle = "rgba(255,210,120,0.95)"; c.fillRect(X(d.x) - u * 0.055, Y(d.y) + u * d.s + u * 0.03, u * 0.11, u * 0.13);
      c.fillStyle = "#3a2a1a"; c.fillRect(X(d.x) - u * 0.07, Y(d.y) + u * d.s + u * 0.16, u * 0.14, u * 0.03);
    } else if (d.k === "star") {
      c.fillStyle = "rgba(255,225,245,0.95)";
      c.beginPath();
      for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4, rad = q % 2 ? u * d.s * 0.35 : u * d.s; c.lineTo(X(d.x) + Math.cos(a) * rad, Y(d.y) + Math.sin(a) * rad); }
      c.closePath(); c.fill();
    }
  }
  c.restore();
}

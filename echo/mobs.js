// Echo: each world's own creatures. Thornlings live in game.js; these are the rest:
//   n  Snapvine     (Mossy Hollow)   a wall plant that winds up and lunges when Lumi comes close
//   a  Shardbat     (Amethyst Deep)  roosts on the ceiling, swoops at Lumi when a song wakes it
//   k  Cinder Crab  (Ember Caverns)  scuttles fast along a floor, pausing at each end
//   w  Frostwisp    (Frost Tunnels)  drifts toward Lumi when it can see it; a touch freezes Lumi
//   j  Jellyglow    (Coral Depths)   bobs up and down a shaft and stings
"use strict";

const MOB_KINDS = "nakwj";
const MOB_INFO = {
  n: { name: "Snapvine", cost: 11 },
  a: { name: "Shardbat", cost: 9 },
  k: { name: "Cinder Crab", cost: 11 },
  w: { name: "Frostwisp", cost: 7 },
  j: { name: "Jellyglow", cost: 10 },
};

function makeMob(kind, x, y, i) {
  return { kind, x, y, hx: x, hy: y, i, ph: Math.random() * 6, state: "idle", t: 0, cd: 0 };
}

// Once the tiles are known: which wall a Snapvine grows from, and the lane a crab or jelly uses.
function initMobs() {
  const open = (x, y) => x >= 0 && y >= 0 && x < L.cols && y < L.rows && L.tile[y * L.cols + x] === ".";
  for (const m of L.mobs) {
    const tx = Math.floor(m.hx), ty = Math.floor(m.hy);
    if (m.kind === "n") {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => !open(tx + dx, ty + dy));
      const [dx, dy] = dirs[0] || [0, 1];
      m.wall = [dx, dy];
      m.bx = tx + 0.5 + dx * 0.45; m.by = ty + 0.5 + dy * 0.45;  // where the stem roots
      m.x = tx + 0.5 - dx * 0.05; m.y = ty + 0.5 - dy * 0.05;
      m.hx = m.x; m.hy = m.y;
    } else if (m.kind === "k" || m.kind === "j") {
      let a = m.kind === "k" ? tx : ty, b = a;
      if (m.kind === "k") { while (open(a - 1, ty)) a--; while (open(b + 1, ty)) b++; m.a = [a + 0.5, ty + 0.62]; m.b = [b + 0.5, ty + 0.62]; }
      else { while (open(tx, a - 1)) a--; while (open(tx, b + 1)) b++; m.a = [tx + 0.5, a + 0.5]; m.b = [tx + 0.5, b + 0.5]; }
      m.len = Math.max(0.01, Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]));
      m.k = Math.random(); m.dir = 1;
    } else if (m.kind === "a") {
      m.hy = ty + 0.28; m.y = m.hy;
    }
  }
}

function lineOfSight(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  for (let q = 1; q < n; q++) {
    const x = x0 + (x1 - x0) * q / n, y = y0 + (y1 - y0) * q / n;
    if (solidAt(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}

// A song reaching a Shardbat's roost wakes it.
function wakeMobsAt(i) {
  for (const m of L.mobs) {
    if (m.kind !== "a" || m.state !== "idle" || m.cd > 0 || m.i !== i) continue;
    if (Math.hypot(m.x - L.lumi.x, m.y - L.lumi.y) > 6.5 || !lineOfSight(m.x, m.y, L.lumi.x, L.lumi.y)) continue;
    m.state = "wake"; m.t = 0.35;
    sfx.mob("a", m.x - L.lumi.x);
  }
}

function updateMobs(dt, ctl) {
  const lumi = L.lumi, depth = depthOf(levelIndex);
  L.slow = Math.max(0, (L.slow || 0) - dt);
  for (const m of L.mobs) {
    m.ph += dt;
    m.cd = Math.max(0, m.cd - dt);
    const dl = Math.hypot(m.x - lumi.x, m.y - lumi.y);
    if (m.kind === "n") {
      // Idle sway; when Lumi comes close it winds up (shaking), then lunges at where Lumi was.
      if (m.state === "idle" && m.cd <= 0 && ctl && dl < 1.55 && lineOfSight(m.hx, m.hy, lumi.x, lumi.y)) {
        m.state = "wind"; m.t = 0.55; m.tx = lumi.x; m.ty = lumi.y; sfx.mob("n0", m.x - lumi.x);
      } else if (m.state === "wind") {
        m.t -= dt; m.tx += (lumi.x - m.tx) * Math.min(1, dt * 3); m.ty += (lumi.y - m.ty) * Math.min(1, dt * 3);
        if (m.t <= 0) { m.state = "snap"; m.t = 0.2; sfx.mob("n", m.x - lumi.x); }
      } else if (m.state === "snap") {
        m.t -= dt;
        const reach = Math.min(1.1, Math.hypot(m.tx - m.hx, m.ty - m.hy));
        const ang = Math.atan2(m.ty - m.hy, m.tx - m.hx), k = 1 - Math.max(0, m.t) / 0.2;
        m.x = m.hx + Math.cos(ang) * reach * k; m.y = m.hy + Math.sin(ang) * reach * k;
        if (m.t <= 0) { m.state = "back"; m.t = 0.6; }
      } else if (m.state === "back") {
        m.t -= dt;
        m.x += (m.hx - m.x) * Math.min(1, dt * 6); m.y += (m.hy - m.y) * Math.min(1, dt * 6);
        if (m.t <= 0) { m.state = "idle"; m.cd = 1.8; m.x = m.hx; m.y = m.hy; }
      }
    } else if (m.kind === "a") {
      // Roosting, then a short shiver, then a swoop to where Lumi was, then home again.
      if (m.state === "wake") { m.t -= dt; if (m.t <= 0) { m.state = "swoop"; m.tx = lumi.x; m.ty = lumi.y; } }
      else if (m.state === "swoop") {
        const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), sp = 4 + depth * 1.2;
        const nx = m.x + dx / (d || 1) * Math.min(d, sp * dt), ny = m.y + dy / (d || 1) * Math.min(d, sp * dt);
        if (d < 0.15 || solidAt(Math.floor(nx), Math.floor(ny))) { m.state = "home"; }
        else { m.x = nx; m.y = ny; }
      } else if (m.state === "home") {
        const dx = m.hx - m.x, dy = m.hy - m.y, d = Math.hypot(dx, dy);
        if (d < 0.05) { m.state = "idle"; m.cd = 6; m.x = m.hx; m.y = m.hy; }
        else { m.x += dx / d * Math.min(d, 2.2 * dt); m.y += dy / d * Math.min(d, 2.2 * dt); }
      }
    } else if (m.kind === "k" || m.kind === "j") {
      // Back and forth along a lane; crabs dash and pause at each end, jellies glide smoothly.
      if (m.kind === "k") {
        if (m.cd > 0) { /* pausing */ }
        else {
          m.k += m.dir * dt * (2.2 + depth) / m.len;
          if (m.k >= 1 || m.k <= 0) { m.k = Math.max(0, Math.min(1, m.k)); m.dir *= -1; m.cd = 0.55; }
        }
        m.x = m.a[0] + (m.b[0] - m.a[0]) * m.k; m.y = m.a[1] + (m.b[1] - m.a[1]) * m.k;
        if (!L.demo && dl < 4 && Math.random() < dt * 3) sfx.mob("k", m.x - lumi.x);
      } else {
        m.k = (1 - Math.cos(m.ph * (0.9 + depth * 0.5) * Math.PI / m.len)) / 2;
        m.x = m.a[0] + (m.b[0] - m.a[0]) * m.k; m.y = m.a[1] + (m.b[1] - m.a[1]) * m.k;
      }
    } else if (m.kind === "w") {
      // Drifts toward Lumi when it can see it, otherwise floats back home.
      if (m.cd > 0) continue;
      const sees = ctl && dl < 4.5 && lineOfSight(m.x, m.y, lumi.x, lumi.y);
      const tx = sees ? lumi.x : m.hx + Math.sin(m.ph) * 0.2, ty = sees ? lumi.y : m.hy + Math.cos(m.ph * 0.8) * 0.2;
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), sp = sees ? 1 + depth * 0.4 : 0.6;
      if (d > 0.02) {
        const nx = m.x + dx / d * Math.min(d, sp * dt), ny = m.y + dy / d * Math.min(d, sp * dt);
        if (!solidAt(Math.floor(nx), Math.floor(ny))) { m.x = nx; m.y = ny; }
      }
    }
    // Touching any of them costs light; a Frostwisp also freezes Lumi for a moment.
    const reach = m.kind === "n" ? 0.42 : m.kind === "a" ? 0.4 : 0.38;
    if (ctl && L.invuln <= 0) {
      if (Math.hypot(m.x - lumi.x, m.y - lumi.y) < LUMI_R + reach - 0.12 && (m.kind !== "n" || m.state === "snap")) {
        hurtLumi(MOB_INFO[m.kind].cost, m.x, m.y);
        if (m.kind === "w") { L.slow = 2.5; m.cd = 6; m.x = m.hx; m.y = m.hy; sfx.mob("w", 0); }
        if (m.kind === "a") m.state = "home";
      }
    }
  }
}

function hurtLumi(cost, fromX, fromY) {
  const lumi = L.lumi, dx = lumi.x - fromX, dy = lumi.y - fromY, d = Math.hypot(dx, dy) || 1;
  lumi.vx = dx / d * 5; lumi.vy = dy / d * 5;
  lumi.squash = 1;
  L.invuln = 1.6;
  L.hits++;
  if (L.useEnergy) L.energy = Math.max(0, L.energy - cost);
  sfx.hurt();
  buzz([30, 30, 30]);
  for (let q = 0; q < 12; q++) { const a = Math.random() * 6.28; spark(lumi.x, lumi.y, Math.cos(a) * 2, Math.sin(a) * 2, 0.5, "ember", 0.08); }
}

// ---------- Drawing ----------
function drawMobs() {
  for (const m of L.mobs) {
    const ti = Math.floor(m.y) * L.cols + Math.floor(m.x);
    const lit = ti >= 0 && ti < L.n ? Math.max(L.lit[ti], L.glow[ti]) : 0;
    const a = Math.min(1, Math.max(lit * 1.2, save.settings.contrast ? 0.75 : m.kind === "w" ? 0.5 : 0.1));
    const X = sx(m.x), Y = sy(m.y), u = TS;
    if (X < -u * 2 || Y < -u * 2 || X > W + u * 2 || Y > H + u * 2) continue;
    ctx.save();
    ctx.globalAlpha = a;
    if (m.kind === "n") drawSnapvine(m, X, Y, u);
    else if (m.kind === "a") drawShardbat(m, X, Y, u);
    else if (m.kind === "k") drawCrab(m, X, Y, u);
    else if (m.kind === "w") { if (m.cd <= 0) drawWisp(m, X, Y, u); }
    else if (m.kind === "j") drawJelly(m, X, Y, u);
    ctx.restore();
  }
}
function eyes(X, Y, r, look = 0, color = "#1b1030") {
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(X - r * 1.1, Y, r, r * 1.15, 0, 0, Math.PI * 2); ctx.ellipse(X + r * 1.1, Y, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(X - r * 1.1 + look * r * 0.35, Y + r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.arc(X + r * 1.1 + look * r * 0.35, Y + r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(X - r * 1.25 + look * r * 0.35, Y - r * 0.1, r * 0.2, 0, Math.PI * 2); ctx.arc(X + r * 0.95 + look * r * 0.35, Y - r * 0.1, r * 0.2, 0, Math.PI * 2); ctx.fill();
}
function drawSnapvine(m, X, Y, u) {
  const bx = sx(m.bx), by = sy(m.by), shake = m.state === "wind" ? Math.sin(m.ph * 60) * u * 0.03 : Math.sin(m.ph * 2) * u * 0.02;
  // Stem from the wall, with two leaves.
  ctx.strokeStyle = "#3f8f4f"; ctx.lineWidth = Math.max(2, u * 0.07); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + X) / 2 + shake * 3, (by + Y) / 2 - shake * 3, X + shake, Y); ctx.stroke();
  ctx.fillStyle = "#5fbf6a";
  ctx.beginPath(); ctx.ellipse((bx * 2 + X) / 3 + u * 0.08, (by * 2 + Y) / 3, u * 0.1, u * 0.045, 0.6, 0, Math.PI * 2); ctx.fill();
  // Head: two leafy jaws that open as it winds up.
  const open = m.state === "wind" ? 0.55 + 0.15 * Math.sin(m.ph * 40) : m.state === "snap" ? 0.15 : 0.25 + 0.08 * Math.sin(m.ph * 2.5);
  const ang = m.state === "idle" ? Math.atan2(L.lumi.y - m.y, L.lumi.x - m.x) : Math.atan2((m.ty || m.y) - m.hy, (m.tx || m.x) - m.hx);
  const hx = X + shake, hy = Y, r = u * 0.34;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
  ctx.fillStyle = "#ff6f9a";
  ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.75, r * 0.5 * (0.3 + open), 0, 0, Math.PI * 2); ctx.fill();
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#4caf5c";
    ctx.beginPath();
    ctx.ellipse(r * 0.35, s * r * open * 0.6, r * 0.85, r * 0.42, s * open * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(r * (0.2 + q * 0.32), s * r * (open * 0.35)); ctx.lineTo(r * (0.32 + q * 0.32), s * r * (open * 0.35 - 0.18)); ctx.lineTo(r * (0.44 + q * 0.32), s * r * (open * 0.35)); ctx.fill(); }
  }
  ctx.restore();
  eyes(hx - Math.cos(ang) * r * 0.1, hy - r * 0.55, r * 0.17, Math.cos(ang));
}
function drawShardbat(m, X, Y, u) {
  const flying = m.state === "swoop" || m.state === "home", r = u * 0.26;
  const flap = flying ? Math.sin(m.ph * 22) : m.state === "wake" ? Math.sin(m.ph * 50) * 0.3 : -0.9;
  ctx.globalCompositeOperation = "lighter";
  glow(GLOW.violet, X, Y, u * 0.6, flying ? 0.4 : 0.15);
  ctx.globalCompositeOperation = "source-over";
  for (const s of [-1, 1]) {
    // Crystal wings: three shards each.
    for (let q = 0; q < 3; q++) {
      const a = s * (0.3 + q * 0.35) + (s * flap * 0.5), len = r * (2.2 - q * 0.45);
      ctx.fillStyle = q === 0 ? "#c6a2ff" : q === 1 ? "#a77bff" : "#8a5cf0";
      ctx.beginPath();
      ctx.moveTo(X + s * r * 0.6, Y);
      ctx.lineTo(X + s * Math.cos(a - s * 0.15) * len, Y + Math.sin(-Math.abs(a) + 0.3) * len * (flying ? 1 : 0.4) - r * 0.2);
      ctx.lineTo(X + s * Math.cos(a + s * 0.15) * len * 0.8, Y + r * 0.4);
      ctx.closePath(); ctx.fill();
    }
  }
  const g = ctx.createRadialGradient(X - r * 0.3, Y - r * 0.3, r * 0.1, X, Y, r);
  g.addColorStop(0, "#6b4aa8"); g.addColorStop(1, "#2e1f52");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2e1f52";
  ctx.beginPath(); ctx.moveTo(X - r * 0.7, Y - r * 0.5); ctx.lineTo(X - r * 0.5, Y - r * 1.2); ctx.lineTo(X - r * 0.2, Y - r * 0.7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X + r * 0.7, Y - r * 0.5); ctx.lineTo(X + r * 0.5, Y - r * 1.2); ctx.lineTo(X + r * 0.2, Y - r * 0.7); ctx.fill();
  if (m.state === "idle") {
    ctx.strokeStyle = "#e9dcff"; ctx.lineWidth = Math.max(1, u * 0.025);
    ctx.beginPath(); ctx.arc(X - r * 0.35, Y, r * 0.17, 0.2, Math.PI - 0.2); ctx.moveTo(X + r * 0.52, Y); ctx.arc(X + r * 0.35, Y, r * 0.17, 0.2, Math.PI - 0.2); ctx.stroke();
  } else eyes(X, Y - r * 0.05, r * 0.24, 0, "#ff4fa0");
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(X - r * 0.2, Y + r * 0.45); ctx.lineTo(X - r * 0.12, Y + r * 0.7); ctx.lineTo(X - r * 0.04, Y + r * 0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X + r * 0.04, Y + r * 0.45); ctx.lineTo(X + r * 0.12, Y + r * 0.7); ctx.lineTo(X + r * 0.2, Y + r * 0.45); ctx.fill();
}
function drawCrab(m, X, Y, u) {
  const r = u * 0.28, step = Math.sin(m.ph * 26) * (m.cd > 0 ? 0 : 1);
  ctx.globalCompositeOperation = "lighter";
  glow(GLOW.ember, X, Y, u * 0.55, 0.3);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#b9442c"; ctx.lineWidth = Math.max(1.5, u * 0.04); ctx.lineCap = "round";
  for (const s of [-1, 1]) for (let q = 0; q < 3; q++) {
    const lx = X + s * r * (0.5 + q * 0.25);
    ctx.beginPath(); ctx.moveTo(lx, Y + r * 0.2); ctx.lineTo(lx + s * r * 0.35, Y + r * 0.55 + (q % 2 ? step : -step) * r * 0.15); ctx.stroke();
  }
  // Claws.
  ctx.fillStyle = "#ff6a3d";
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(X + s * r * 1.35, Y - r * 0.45, r * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a120c"; ctx.beginPath(); ctx.moveTo(X + s * r * 1.35, Y - r * 0.45); ctx.lineTo(X + s * r * 1.75, Y - r * 0.75); ctx.lineTo(X + s * r * 1.75, Y - r * 0.3); ctx.fill();
    ctx.fillStyle = "#ff6a3d";
  }
  const g = ctx.createRadialGradient(X - r * 0.3, Y - r * 0.4, r * 0.1, X, Y, r * 1.1);
  g.addColorStop(0, "#ff8a55"); g.addColorStop(1, "#c2391f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, Y, r * 1.05, r * 0.72, 0, Math.PI, 0); ctx.ellipse(X, Y, r * 1.05, r * 0.3, 0, 0, Math.PI); ctx.fill();
  // Glowing cracks on its shell.
  ctx.strokeStyle = "rgba(255,210,120,0.9)"; ctx.lineWidth = Math.max(1, u * 0.018);
  ctx.beginPath(); ctx.moveTo(X - r * 0.5, Y - r * 0.2); ctx.lineTo(X - r * 0.1, Y - r * 0.45); ctx.lineTo(X + r * 0.3, Y - r * 0.15); ctx.stroke();
  // Eyes on stalks.
  ctx.strokeStyle = "#c2391f"; ctx.lineWidth = Math.max(1.5, u * 0.03);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X + s * r * 0.3, Y - r * 0.6); ctx.lineTo(X + s * r * 0.35, Y - r * 1.05); ctx.stroke(); }
  eyes(X, Y - r * 1.1, r * 0.2, m.dir);
}
function drawWisp(m, X, Y, u) {
  const r = u * 0.26, bob = Math.sin(m.ph * 3) * u * 0.04;
  ctx.globalCompositeOperation = "lighter";
  glow(GLOW.cyan, X, Y + bob, u * 0.8, 0.45);
  glow(GLOW.white, X, Y + bob, u * 0.3, 0.5);
  ctx.globalCompositeOperation = "source-over";
  // A teardrop flame of ice, tip flickering upward.
  const g = ctx.createLinearGradient(X, Y + bob - r * 2, X, Y + bob + r);
  g.addColorStop(0, "rgba(220,245,255,0.2)"); g.addColorStop(0.5, "rgba(190,235,255,0.9)"); g.addColorStop(1, "rgba(140,210,255,0.95)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(X + Math.sin(m.ph * 8) * r * 0.3, Y + bob - r * 2.1);
  ctx.bezierCurveTo(X + r * 1.1, Y + bob - r * 0.8, X + r * 1.1, Y + bob + r, X, Y + bob + r);
  ctx.bezierCurveTo(X - r * 1.1, Y + bob + r, X - r * 1.1, Y + bob - r * 0.8, X + Math.sin(m.ph * 8) * r * 0.3, Y + bob - r * 2.1);
  ctx.fill();
  // Snowflake eyes.
  ctx.strokeStyle = "#1d4a7a"; ctx.lineWidth = Math.max(1, u * 0.02);
  for (const s of [-1, 1]) for (let q = 0; q < 3; q++) {
    const a = q * Math.PI / 3, ex = X + s * r * 0.38, ey = Y + bob;
    ctx.beginPath(); ctx.moveTo(ex - Math.cos(a) * r * 0.16, ey - Math.sin(a) * r * 0.16); ctx.lineTo(ex + Math.cos(a) * r * 0.16, ey + Math.sin(a) * r * 0.16); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(X, Y + bob + r * 0.4, r * 0.12, 0, Math.PI); ctx.stroke();
}
function drawJelly(m, X, Y, u) {
  const r = u * 0.3, pulse = 1 + Math.sin(m.ph * 4) * 0.08;
  ctx.globalCompositeOperation = "lighter";
  glow(GLOW.pink, X, Y, u * 0.7, 0.35);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,170,215,0.8)"; ctx.lineWidth = Math.max(1, u * 0.025);
  for (let q = 0; q < 5; q++) {
    const tx = X + (q - 2) * r * 0.32;
    ctx.beginPath(); ctx.moveTo(tx, Y + r * 0.2);
    for (let s = 1; s <= 4; s++) ctx.lineTo(tx + Math.sin(m.ph * 5 + q + s) * r * 0.15, Y + r * 0.2 + s * r * 0.28);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(X - r * 0.3, Y - r * 0.4, r * 0.1, X, Y - r * 0.1, r * 1.1);
  g.addColorStop(0, "rgba(255,230,245,0.95)"); g.addColorStop(1, "rgba(255,120,190,0.75)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(X, Y, r * pulse, r * 0.85 / pulse, 0, Math.PI, 0); ctx.quadraticCurveTo(X, Y + r * 0.45, X - r * pulse, Y); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(X + (q - 1.5) * r * 0.4, Y - r * 0.5 + (q % 2) * r * 0.15, r * 0.06, 0, Math.PI * 2); ctx.fill(); }
  eyes(X, Y - r * 0.2, r * 0.17, 0, "#7a1d4a");
}

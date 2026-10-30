// Echo: drawing the cave and everything in it each frame, and the main loop.
"use strict";

// ---------- Draw ----------
const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, v: 0.004 + Math.random() * 0.01, ph: Math.random() * 6 }));
let clock = 0;
const titleRipples = [];

function drawBackground(dt) {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#9fd8ff";
  for (const m of motes) {
    m.y -= m.v * dt;
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    ctx.globalAlpha = 0.12 + Math.sin(clock * 0.8 + m.ph) * 0.07;
    ctx.beginPath();
    ctx.arc(m.x * W + Math.sin(clock * 0.3 + m.ph) * 8, m.y * H, m.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const vis = i => Math.max(L.lit[i], L.glow[i], L.seen[i] * MEMORY);
const sx = x => OX + x * TS, sy = y => OY + y * TS;

function drawCave() {
  const { cols } = L, P = LPT, mx = LM.mx, my = LM.my;

  // Light map: a soft blob per tile, plus smooth lights that follow moving things.
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = "source-over";
  lctx.globalAlpha = 1;
  lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
  lctx.globalCompositeOperation = "lighter";
  const blob = (x, y, r, a) => {
    if (a <= 0.004) return;
    lctx.globalAlpha = Math.min(1, a);
    lctx.drawImage(LIGHT, (x + mx - r) * P, (y + my - r) * P, r * 2 * P, r * 2 * P);
  };
  for (let i = 0; i < L.n; i++) blob((i % cols) + 0.5, ((i / cols) | 0) + 0.5, 0.95, vis(i));
  const shrink = L.ending ? Math.max(0, 1 - L.ending / 0.9) : 1;
  blob(L.lumi.x, L.lumi.y, 1.15, 0.85 * shrink + L.lumi.sing * 0.5);
  for (const c of L.crystals) if (c.on) blob(c.x, c.y, 1.3, c.on * 0.6);
  for (const o of L.lights) if (!o.got && (!L.dark || L.seen[o.i])) blob(o.x, o.y, 0.7, 0.3);
  for (const r of L.runes) if (r.on) blob(r.x, r.y, 1.1, r.on * 0.5);
  if (L.baby) blob(L.baby.x, L.baby.y, 0.7, 0.4);
  for (const m of L.moths) blob(m.x, m.y, 0.8, 0.4);
  if (!L.dark || L.seen[L.exit.i]) blob(L.exit.x, L.exit.y, 0.9, 0.3);
  lctx.globalAlpha = 1;

  // Scene: the painted cave, kept only where light falls.
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.clearRect(0, 0, scene.width, scene.height);
  const ax = Math.round((OX - mx * TS) * SDPR), ay = Math.round((OY - my * TS) * SDPR);
  const aw = (L.cols + mx * 2) * TS * SDPR, ah = (L.rows + my * 2) * TS * SDPR;
  sctx.drawImage(art, ax, ay, aw, ah);
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(lightCanvas, ax, ay, aw, ah);
  sctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scene, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.globalCompositeOperation = "lighter";
  // Currents: slow ribbons of mist drifting downstream.
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, TS * 0.05);
  for (let i = 0; i < L.n; i++) {
    const f = L.flow[i];
    if (!f) continue;
    const a = 0.06 + Math.max(L.lit[i], L.glow[i]) * 0.35;
    const x = i % cols, y = (i / cols) | 0;
    for (let k = 0; k < 2; k++) {
      const t = (clock * 0.55 + k / 2 + (x * 0.37 + y * 0.61)) % 1;
      const off = (k - 0.5) * 0.4 + Math.sin(clock * 1.3 + x + y + k) * 0.06;
      const cx = x + 0.5 + f[0] * (t - 0.5) + f[1] * off;
      const cy = y + 0.5 + f[1] * (t - 0.5) + f[0] * off;
      ctx.strokeStyle = `rgba(140,225,255,${a * Math.sin(t * Math.PI)})`;
      ctx.beginPath();
      ctx.moveTo(sx(cx - f[0] * 0.3), sy(cy - f[1] * 0.3));
      ctx.lineTo(sx(cx + f[0] * 0.3), sy(cy + f[1] * 0.3));
      ctx.stroke();
    }
  }

  // Glowing mushrooms, seen only when light reaches them.
  for (const m of L.shrooms) {
    const a = vis(m.i);
    if (a < 0.03) continue;
    const X = sx(m.x), Y = sy(m.y), r = m.s * TS;
    glow(m.pink ? GLOW.pink : GLOW.green, X, Y - r * 1.7, r * 4.5, a * (0.35 + Math.sin(clock * 1.5 + m.ph) * 0.1));
  }
  ctx.globalCompositeOperation = "source-over";
  for (const m of L.shrooms) {
    const a = vis(m.i);
    if (a < 0.03) continue;
    const X = sx(m.x), Y = sy(m.y), r = m.s * TS;
    const sway = Math.sin(clock * 0.9 + m.ph) * r * 0.08;
    ctx.fillStyle = `rgba(200,222,240,${a * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(X - r * 0.3, Y);
    ctx.quadraticCurveTo(X - r * 0.12, Y - r * 0.8, X - r * 0.18 + sway, Y - r * 1.3);
    ctx.lineTo(X + r * 0.18 + sway, Y - r * 1.3);
    ctx.quadraticCurveTo(X + r * 0.12, Y - r * 0.8, X + r * 0.3, Y);
    ctx.fill();
    ctx.fillStyle = m.pink ? `rgba(255,140,200,${a})` : `rgba(110,240,210,${a})`;
    ctx.beginPath();
    ctx.moveTo(X - r + sway, Y - r * 1.2);
    ctx.bezierCurveTo(X - r * 0.95 + sway, Y - r * 2.4, X + r * 0.95 + sway, Y - r * 2.4, X + r + sway, Y - r * 1.2);
    ctx.quadraticCurveTo(X + sway, Y - r * 1.45, X - r + sway, Y - r * 1.2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${a * 0.55})`;
    ctx.beginPath();
    ctx.arc(X - r * 0.35 + sway, Y - r * 1.75, r * 0.14, 0, Math.PI * 2);
    ctx.arc(X + r * 0.25 + sway, Y - r * 1.9, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sound curtains: shimmering strands across the passage that part when the song arrives.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < L.n; i++) {
    if (L.tile[i] !== "D") continue;
    const x = i % cols, y = (i / cols) | 0, o = L.doorAnim[i];
    const a = Math.max(vis(i), save.settings.contrast ? 0.6 : 0.1 + Math.sin(clock * 2 + i) * 0.04) * (1 - o * 0.85);
    const across = !solidAt(x, y - 1) || !solidAt(x, y + 1);  // passage runs up-down, so strands run left-right
    const cx = sx(x + 0.5), cy = sy(y + 0.5);
    glow(GLOW.violet, cx, cy, TS * 0.9, a * 0.45);
    ctx.lineWidth = Math.max(1.2, TS * 0.04);
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * 0.14;
      ctx.strokeStyle = `rgba(205,170,255,${a * (0.9 - Math.abs(k - 1.5) * 0.2)})`;
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const len = 0.5 * (1 - o);
        for (let q = 0; q <= 8; q++) {
          const u = side * (0.5 - len * (q / 8));
          const wav = Math.sin(clock * 4 + q * 1.1 + k * 1.7) * 0.04;
          const px = across ? cx + u * TS : cx + (off + wav) * TS;
          const py = across ? cy + (off + wav) * TS : cy + u * TS;
          if (q === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
    if (L.door[i] > 0) {
      ctx.strokeStyle = `rgba(205,170,255,${0.4 * o})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, TS * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (L.door[i] / DOOR_TIME));
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawThings() {
  const T = TS;
  ctx.globalCompositeOperation = "lighter";
  // Crystals.
  for (const c of L.crystals) {
    const a = Math.max(c.on, vis(c.i) * 0.8, 0.05);
    const X = sx(c.x), Y = sy(c.y);
    if (c.on) glow(GLOW.violet, X, Y, T * 2.2, 0.35 * c.on + Math.sin(clock * 2 + c.x) * 0.05);
    ctx.fillStyle = `rgba(210,180,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(X, Y - T * 0.34); ctx.lineTo(X + T * 0.18, Y); ctx.lineTo(X, Y + T * 0.3); ctx.lineTo(X - T * 0.18, Y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(X, Y - T * 0.2); ctx.lineTo(X + T * 0.07, Y); ctx.lineTo(X, Y + T * 0.12); ctx.lineTo(X - T * 0.07, Y);
    ctx.closePath(); ctx.fill();
  }

  // Portal: a slow vortex, always faintly visible so there's a goal.
  {
    const e = L.exit, X = sx(e.x), Y = sy(e.y);
    const asleep = L.goal === "rescue" && L.baby && !L.baby.following;
    const a = (L.dark ? vis(e.i) : Math.max(0.35, vis(e.i))) * (asleep ? 0.45 : 1);
    glow(GLOW.violet, X, Y, T * 1.5, a * 0.5);
    glow(GLOW.white, X, Y, T * 0.35, a * 0.6);
    for (let k = 0; k < 18; k++) {
      const p = (k / 18 + clock * 0.3) % 1;
      const ang = k * 2.4 - p * 5;
      const rad = T * 0.5 * (1 - p);
      glow(k % 3 ? GLOW.violet : GLOW.cyan, X + Math.cos(ang) * rad, Y + Math.sin(ang) * rad * 0.85, T * 0.14, a * Math.sin(p * Math.PI));
    }
  }

  // Lost lights: a faint twinkle always, bright when lit.
  for (const o of L.lights) {
    if (o.got) continue;
    const X = sx(o.x), Y = sy(o.y + Math.sin(clock * 2 + o.ph) * 0.06);
    const hc = save.settings.contrast;
    const a = L.dark && !L.seen[o.i] ? vis(o.i) : Math.max(hc ? 0.7 : 0.22 + Math.sin(clock * 3 + o.ph) * 0.1, vis(o.i));
    glow(GLOW.gold, X, Y, T * (hc ? 1.4 : 1.1), a * 0.8);
    glow(GLOW.white, X, Y, T * 0.28, a);
    if (hc) {
      // High contrast: a crisp star shape so lights read without relying on colour.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? T * 0.1 : T * 0.3, ang = k * Math.PI / 4 + clock;
        ctx.lineTo(X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // Glow-moths.
  for (const m of L.moths) {
    const X = sx(m.x), Y = sy(m.y), a = m.following ? 0.9 : 0.55;
    const flap = Math.abs(Math.sin(m.ph * 14));
    glow(GLOW.green, X, Y, T * 0.8, a * 0.6);
    ctx.fillStyle = `rgba(200,255,220,${a})`;
    ctx.beginPath();
    ctx.ellipse(X - T * 0.1, Y, T * 0.12 * (0.3 + flap * 0.7), T * 0.14, -0.4, 0, Math.PI * 2);
    ctx.ellipse(X + T * 0.1, Y, T * 0.12 * (0.3 + flap * 0.7), T * 0.14, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Snoozles.
  for (const c of L.critters) {
    const a = Math.max(vis(c.i), 0.12);
    const X = sx(c.x), Y = sy(c.y), r = CRITTER_R * T;
    const breathe = 1 + Math.sin(c.ph * (c.awake ? 8 : 1.6)) * 0.05;
    const angry = Math.min(1, c.awake);
    ctx.fillStyle = `rgba(${150 + angry * 90},${110 - angry * 40},${220 - angry * 120},${a * 0.9})`;
    ctx.beginPath();
    ctx.ellipse(X, Y + r * 0.1, r * breathe * 1.1, r * 0.9 / breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    if (save.settings.contrast) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.strokeStyle = `rgba(20,10,40,${a})`;
    ctx.lineWidth = Math.max(1.5, T * 0.05);
    ctx.beginPath();
    if (angry > 0.05) {
      ctx.moveTo(X - r * 0.55, Y - r * 0.2); ctx.lineTo(X - r * 0.2, Y);
      ctx.moveTo(X + r * 0.55, Y - r * 0.2); ctx.lineTo(X + r * 0.2, Y);
    } else {
      ctx.arc(X - r * 0.35, Y, r * 0.16, 0.2, Math.PI - 0.2);
      ctx.moveTo(X + r * 0.51, Y);
      ctx.arc(X + r * 0.35, Y, r * 0.16, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();
    if (!c.awake) {
      ctx.fillStyle = `rgba(200,180,255,${Math.max(a, 0.25) * 0.8})`;
      ctx.font = `600 ${Math.round(T * 0.28)}px Fredoka, sans-serif`;
      const zt = (c.ph * 0.5) % 1;
      ctx.globalAlpha = Math.sin(zt * Math.PI);
      ctx.fillText("z", X + r * 0.7 + zt * T * 0.2, Y - r - zt * T * 0.35);
      ctx.globalAlpha = 1;
    }
  }

  // Rune stones: a carved ring that lights up green once it hears a song from close by.
  for (const r of L.runes) {
    const X = sx(r.x), Y = sy(r.y), a = Math.max(vis(r.i), r.on, 0.12 + r.far * 0.5), rr = TS * 0.3;
    ctx.globalCompositeOperation = "lighter";
    if (r.on) glow(GLOW.green, X, Y, TS * 1.4, 0.45 * r.on);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(40,58,70,${Math.min(1, a + 0.2)})`;
    ctx.beginPath(); ctx.arc(X, Y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = r.on ? `rgba(150,255,190,${0.6 + 0.4 * r.on})` : `rgba(170,200,220,${a})`;
    ctx.lineWidth = Math.max(1.5, TS * 0.05);
    // A listening mark: a dot with sound waves on both sides.
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(X, Y, rr * 0.16, 0, Math.PI * 2); ctx.fill();
    for (const k of [0.42, 0.72]) for (const side of [0, Math.PI]) {
      ctx.beginPath(); ctx.arc(X, Y, rr * k, side - 0.75, side + 0.75); ctx.stroke();
    }
    if (!r.on && (r.far > 0 || save.settings.contrast)) {
      // A dotted ring shows how close you need to be when singing.
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = `rgba(150,255,190,${save.settings.contrast ? 0.5 : r.far * 0.6})`;
      ctx.beginPath(); ctx.arc(X, Y, RUNE_RANGE * TS, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Stone gate: a carved slab that sinks into the ground when every rune is awake.
  if (L.gate) {
    const gt = L.gate, X = sx(gt.x - 0.5), Y = sy(gt.y - 0.5), sink = Math.min(1, gt.open);
    const a = Math.max(vis(gt.i), save.settings.contrast ? 0.7 : 0.1) * (1 - sink);
    if (a > 0.01) {
      ctx.fillStyle = `rgba(58,70,86,${a})`;
      ctx.fillRect(X + TS * 0.06, Y + TS * (0.04 + sink * 0.9), TS * 0.88, TS * 0.92 * (1 - sink));
      ctx.strokeStyle = `rgba(150,255,190,${a * 0.8})`;
      ctx.lineWidth = Math.max(1.2, TS * 0.04);
      ctx.strokeRect(X + TS * 0.14, Y + TS * (0.12 + sink * 0.9), TS * 0.72, TS * 0.76 * (1 - sink));
      ctx.beginPath();
      const on = L.runes.filter(q => q.on).length;
      for (let k = 0; k < L.runes.length; k++) {
        ctx.fillStyle = k < on ? "rgba(150,255,190,0.95)" : `rgba(150,170,190,${a * 0.6})`;
        ctx.beginPath();
        ctx.arc(X + TS * (0.5 + (k - (L.runes.length - 1) / 2) * 0.24), Y + TS * 0.5, TS * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // The lost baby moth: small, pale pink, and visible from afar so you know it's there.
  if (L.baby) {
    const b = L.baby, X = sx(b.x), Y = sy(b.y), flap = Math.abs(Math.sin(b.ph * 16)), T2 = TS * 0.8;
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.pink, X, Y, TS * 0.9, b.following ? 0.6 : 0.4 + Math.sin(b.ph * 3) * 0.15);
    ctx.fillStyle = "rgba(255,225,240,0.95)";
    ctx.beginPath();
    ctx.ellipse(X - T2 * 0.1, Y, T2 * 0.12 * (0.3 + flap * 0.7), T2 * 0.14, -0.4, 0, Math.PI * 2);
    ctx.ellipse(X + T2 * 0.1, Y, T2 * 0.12 * (0.3 + flap * 0.7), T2 * 0.14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Gloomlings.
  for (const g of L.gloom) {
    if (g.gone > 0) continue;
    const X = sx(g.x), Y = sy(g.y), r = TS * 0.3, hunting = g.hunt > 0;
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.violet, X, Y, r * 2.6, hunting ? 0.35 : 0.18);
    ctx.globalCompositeOperation = "source-over";
    for (let k = 0; k < 5; k++) {
      const a = g.ph * 1.7 + k * 1.26;
      ctx.fillStyle = `rgba(${hunting ? 40 : 22},${hunting ? 10 : 12},${hunting ? 50 : 38},0.55)`;
      ctx.beginPath();
      ctx.arc(X + Math.cos(a) * r * 0.35, Y + Math.sin(a) * r * 0.3, r * (0.7 + 0.15 * Math.sin(g.ph * 3 + k)), 0, Math.PI * 2);
      ctx.fill();
    }
    if (save.settings.contrast) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X, Y, r * 1.05, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    const eye = hunting ? GLOW.pink : GLOW.violet, ea = hunting ? 0.95 : 0.55;
    glow(eye, X - r * 0.32, Y - r * 0.1, r * 0.5, ea);
    glow(eye, X + r * 0.32, Y - r * 0.1, r * 0.5, ea);
    glow(GLOW.white, X - r * 0.32, Y - r * 0.1, r * 0.14, ea);
    glow(GLOW.white, X + r * 0.32, Y - r * 0.1, r * 0.14, ea);
    ctx.globalCompositeOperation = "source-over";
  }

  // Song wavefronts.
  ctx.globalCompositeOperation = "lighter";
  for (const w of L.waves) {
    const fade = Math.max(0, 1 - w.r / (WAVE_RANGE + 1.5));
    for (let i = 0; i < L.n; i++) {
      const d = w.dist[i];
      if (d > WAVE_RANGE + 0.5) continue;
      const k = 1 - Math.abs(d - w.r) / 1.1;
      if (k <= 0) continue;
      glow(GLOW.cyan, sx((i % L.cols) + 0.5), sy(((i / L.cols) | 0) + 0.5), TS * 1.15, k * k * fade * 0.32);
    }
  }

  // Particles.
  for (const q of L.particles) {
    const t = q.life / q.max;
    glow(q.color === "skin" ? lumiLook().glow : GLOW[q.color], sx(q.x), sy(q.y), TS * q.size * 3, t * 0.9);
  }

  // Lumi.
  const lumi = L.lumi;
  const shrink = L.ending ? Math.max(0, 1 - L.ending / 0.9) : 1;
  const X = sx(lumi.x), Y = sy(lumi.y), R = LUMI_R * TS * shrink;
  const followers = L.moths.filter(m => m.following).length;
  const look = lumiLook();
  const bright = L.failing ? Math.max(0, 1 - L.failing / 1.2) * (0.5 + 0.5 * Math.sin(L.failing * 30)) : L.useEnergy ? 0.45 + 0.55 * Math.min(1, L.energy / 40) : 1;
  glow(look.glow, X, Y, TS * (1.3 + followers * 0.4) * Math.max(shrink, 0.2), (0.5 + lumi.sing) * bright);
  ctx.globalCompositeOperation = "source-over";
  if (R > 0.5) {
    ctx.globalAlpha = 0.35 + 0.65 * bright;
    const sq = lumi.squash * 0.18;
    ctx.save();
    ctx.translate(X, Y);
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, look.body[0]);
    g.addColorStop(0.6, look.body[1]);
    g.addColorStop(1, look.body[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * (1 + sq), R * (1 - sq), 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes look where Lumi swims.
    const lx = Math.cos(lumi.look) * R * 0.22, ly = Math.sin(lumi.look) * R * 0.18;
    ctx.fillStyle = "#123049";
    const eh = lumi.blink < 0 ? R * 0.04 : R * 0.17;
    ctx.beginPath();
    ctx.ellipse(-R * 0.32 + lx, -R * 0.08 + ly, R * 0.12, eh, 0, 0, Math.PI * 2);
    ctx.ellipse(R * 0.32 + lx, -R * 0.08 + ly, R * 0.12, eh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lumi.sing > 0) {
      ctx.beginPath();
      ctx.ellipse(lx * 0.8, R * 0.35 + ly, R * 0.12, R * 0.15 * Math.min(1, lumi.sing * 4), 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#123049";
      ctx.lineWidth = Math.max(1, R * 0.08);
      ctx.beginPath();
      ctx.arc(lx * 0.8, R * 0.22 + ly, R * 0.16, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,150,190,0.45)";
    ctx.beginPath();
    ctx.arc(-R * 0.58 + lx, R * 0.18 + ly, R * 0.12, 0, Math.PI * 2);
    ctx.arc(R * 0.58 + lx, R * 0.18 + ly, R * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

let energyShown = -1;
function drawEnergy() {
  const on = !!(L && L.useEnergy && !L.demo && (screen === "play" || screen === "pause"));
  const box = $("energy");
  box.classList.toggle("on", on);
  if (!on) return;
  const v = Math.round(L.energy);
  if (v === energyShown) return;
  energyShown = v;
  box.firstElementChild.style.width = v + "%";
  box.classList.toggle("low", v < 25);
}

function drawStick() {
  const p = steer != null ? pointers.get(steer) : null;
  if (!p || !p.moved || screen !== "play") return;
  const dx = p.x - p.ax, dy = p.y - p.ay, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
  ctx.strokeStyle = "rgba(200,240,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.ax, p.ay, STICK_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(200,240,255,0.06)";
  ctx.fill();
  ctx.fillStyle = "rgba(220,248,255,0.35)";
  ctx.beginPath();
  ctx.arc(p.ax + dx * k, p.ay + dy * k, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawTitle(dt) {
  if (Math.random() < dt * 0.9 || titleRipples.length === 0) {
    titleRipples.push({ x: W * (0.2 + Math.random() * 0.6), y: H * (0.15 + Math.random() * 0.7), r: 0 });
  }
  ctx.globalCompositeOperation = "lighter";
  for (let k = titleRipples.length - 1; k >= 0; k--) {
    const rp = titleRipples[k];
    rp.r += dt * 90;
    const a = Math.max(0, 1 - rp.r / 260);
    if (a <= 0) { titleRipples.splice(k, 1); continue; }
    ctx.strokeStyle = `rgba(126,232,255,${a * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
    ctx.stroke();
    glow(GLOW.cyan, rp.x, rp.y, 40, a * 0.3);
  }
  ctx.globalCompositeOperation = "source-over";
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.max(0, Math.min(1 / 30, raw));
  last = now;
  if (screen === "play" && raw < 0.25) {
    if (raw > 0.024) slowFrames++;
    if (++frameCount >= 120) {
      if (slowFrames > 70 && qualityCap > 1) { qualityCap = Math.max(1, qualityCap - 0.5); resize(); }
      frameCount = slowFrames = 0;
    }
  }
  clock += dt;
  if (L && (screen === "play" || (screen === "title" && L.demo))) update(dt);
  drawBackground(dt);
  if (L) { drawCave(); drawThings(); }
  else drawTitle(dt);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  if (L && L.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${L.flash * 0.45})`; ctx.fillRect(0, 0, W, H); }
  drawStick();
  drawEnergy();
  requestAnimationFrame(frame);
}

// Echo: drawing the cave and everything in it each frame, and the main loop.
"use strict";

// ---------- Draw ----------
const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, v: 0.004 + Math.random() * 0.01, ph: Math.random() * 6 }));
let clock = 0;
const titleRipples = [];

function drawBackground(dt) {
  if (L && backdrop.width > 1) {
    const drift = L.scroll ? Math.max(-H * 0.3, Math.min(H * 0.3, (OY - VIEW.top) * 0.25)) : 0;
    ctx.drawImage(backdrop, 0, -H * 0.3 + drift, W, H * 1.6);
  } else {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }
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
// Nothing shows until Lumi's light or a song reaches it (Guiding glow turns this off).
// sightAt: things that move, seen only while light is on them. knownAt: things that stay put,
// which stay known once a song has found them.
const tileAt = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); return ix < 0 || iy < 0 || ix >= L.cols || iy >= L.rows ? -1 : iy * L.cols + ix; };
const sightAt = (x, y) => { if (!L.hideLights) return 1; const i = tileAt(x, y); return i < 0 ? 0 : Math.min(1, Math.max(L.lit[i], L.glow[i]) * 2.2); };
const knownAt = (x, y) => { const i = tileAt(x, y); return !L.hideLights ? 1 : i < 0 ? 0 : L.seen[i] ? 1 : sightAt(x, y); };
const hidden = min => (L.hideLights && !save.settings.contrast ? 0 : min);
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
  for (const o of L.lights) if (!o.got && (!L.hideLights || L.seen[o.i])) blob(o.x, o.y, 0.7, 0.3);
  for (const r of L.runes) if (r.on) blob(r.x, r.y, 1.1, r.on * 0.5);
  if (L.baby) blob(L.baby.x, L.baby.y, 0.7, 0.4 * (L.baby.following ? 1 : knownAt(L.baby.hx, L.baby.hy)));
  for (const m of L.moths) blob(m.x, m.y, 0.8, 0.4 * sightAt(m.x, m.y));
  if (!L.hideLights || L.seen[L.exit.i]) blob(L.exit.x, L.exit.y, 0.9, 0.3);
  for (const e of L.emitters || []) blob(e.x, e.y, e.r, e.a * (0.85 + 0.15 * Math.sin(clock * 2.3 + e.ph)) * knownAt(e.x, e.y));
  for (const m of L.mobs) if (m.kind === "w" && m.cd <= 0) blob(m.x, m.y, 0.8, 0.35 * sightAt(m.x, m.y));  // Frostwisps glow
  lctx.globalAlpha = 1;

  // Scene: the painted cave, lit by nearby lights on the graphics chip where possible.
  if (GLR && GLR.ok && save.settings.lighting !== false) {
    const sdpr = Math.min(DPR, qualityCap >= 2 ? 2 : 1.25);
    const ax = (OX - mx * TS) * sdpr, ay = (OY - my * TS) * sdpr;
    const aw = (L.cols + mx * 2) * TS * sdpr, ah = (L.rows + my * 2) * TS * sdpr;
    if (GLR.render(Math.round(W * sdpr), Math.round(H * sdpr), [ax, ay, aw, ah], [L.cols + mx * 2, L.rows + my * 2], sceneLights(mx, my), 0.62)) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(GLR.canvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      drawCaveDetails();
      return;
    }
  }
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
  drawCaveDetails();
}

// The lights that shade the cave this frame, nearest Lumi first: Lumi itself, then glowing
// decorations, crystals, lights, the portal and glowing creatures. Positions are in art tiles.
const LIGHT_RGB = { cyan: [0.55, 0.9, 1], gold: [1, 0.82, 0.5], violet: [0.75, 0.55, 1], pink: [1, 0.6, 0.85], green: [0.6, 1, 0.75], white: [1, 1, 1], ember: [1, 0.55, 0.3] };
function sceneLights(mx, my) {
  const out = [], lumi = L.lumi;
  const look = SKINS[save.skin] && SKINS[save.skin].c ? SKINS[save.skin].c.map(v => v / 255) : [0.6, 0.92, 1];
  const shrink = L.ending ? Math.max(0, 1 - L.ending / 0.9) : 1;
  const bright = L.useEnergy ? 0.5 + 0.5 * Math.min(1, L.energy / 40) : 1;
  out.push({ x: lumi.x + mx, y: lumi.y + my, r: (3.2 + L.moths.filter(m => m.following).length * 0.8) * bright * Math.max(shrink, 0.2), i: (1.25 + lumi.sing) * bright, c: look });
  const add = (x, y, r, i, c) => { if (Math.abs(x - lumi.x) < 9 && Math.abs(y - lumi.y) < 12) out.push({ x: x + mx, y: y + my, r, i, c, d: Math.hypot(x - lumi.x, y - lumi.y) }); };
  for (const e of L.emitters || []) { const k = knownAt(e.x, e.y); if (k > 0) add(e.x, e.y, e.r * 2.6, e.a * 2.4 * k, LIGHT_RGB[e.color]); }
  for (const c of L.crystals) if (c.on) add(c.x, c.y, 2.8, c.on * 0.9, LIGHT_RGB.violet);
  for (const o of L.lights) if (!o.got && (!L.hideLights || L.seen[o.i])) add(o.x, o.y, 1.8, 0.6, LIGHT_RGB.gold);
  if (!L.hideLights || L.seen[L.exit.i]) add(L.exit.x, L.exit.y, 2.2, 0.7, LIGHT_RGB.violet);
  for (const m of L.mobs) if (m.kind === "w" && m.cd <= 0 && sightAt(m.x, m.y) > 0) add(m.x, m.y, 2, 0.6 * sightAt(m.x, m.y), LIGHT_RGB.cyan);
  for (const m of L.moths) if (sightAt(m.x, m.y) > 0) add(m.x, m.y, 1.6, 0.5 * sightAt(m.x, m.y), LIGHT_RGB.green);
  out.sort((a, b) => (a.d || 0) - (b.d || 0));
  return out;
}

function drawCaveDetails() {
  const { cols } = L;

  ctx.globalCompositeOperation = "lighter";
  // Currents: slow ribbons of mist drifting downstream.
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, TS * 0.05);
  for (let i = 0; i < L.n; i++) {
    const f = L.flow[i];
    if (!f) continue;
    const a = hidden(0.06) + Math.max(L.lit[i], L.glow[i]) * 0.35;
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
    glow(m.pink ? GLOW.pink : GLOW.green, X, Y - r * 1.7, r * 3.5, a * (0.22 + Math.sin(clock * 1.5 + m.ph) * 0.06));
  }
  ctx.globalCompositeOperation = "source-over";
  for (const m of L.shrooms) {
    const a = vis(m.i);
    if (a < 0.03) continue;
    const X = sx(m.x), Y = sy(m.y), r = m.s * TS;
    const sway = Math.sin(clock * 0.9 + m.ph) * r * 0.08, lean = (m.ph % 1 - 0.5) * r * 0.3;
    // A soft dark spot where the stem meets the rock.
    ctx.fillStyle = `rgba(0,0,0,${a * 0.35})`;
    ctx.beginPath(); ctx.ellipse(X, Y + r * 0.05, r * 0.7, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    drawLit(X, Y - r * 1.2, r * 2.6, Math.min(1, a * 1.2), a, () => {
      const tx = X + lean + sway, ty = Y - r * 1.3;
      // Stem: pale, slightly curved and fibrous, darker at the base.
      const sg = ctx.createLinearGradient(X, Y, tx, ty);
      sg.addColorStop(0, "#5d5a52"); sg.addColorStop(1, "#d7d0bd");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(X - r * 0.26, Y + r * 0.04);
      ctx.quadraticCurveTo(X - r * 0.1 + lean * 0.3, Y - r * 0.7, tx - r * 0.15, ty);
      ctx.lineTo(tx + r * 0.15, ty);
      ctx.quadraticCurveTo(X + r * 0.14 + lean * 0.3, Y - r * 0.7, X + r * 0.26, Y + r * 0.04);
      ctx.fill();
      // Gills under the cap.
      ctx.fillStyle = m.pink ? "#4a2236" : "#1f3b36";
      ctx.beginPath(); ctx.ellipse(tx, ty + r * 0.05, r * 0.92, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // Cap: a dome shaded from a lit crown to a dark rim.
      const cg = ctx.createRadialGradient(tx - r * 0.3, ty - r * 0.75, r * 0.1, tx, ty - r * 0.3, r * 1.1);
      if (m.pink) { cg.addColorStop(0, "#e7a1c2"); cg.addColorStop(0.55, "#a8507a"); cg.addColorStop(1, "#4d1e36"); }
      else { cg.addColorStop(0, "#9fd8c4"); cg.addColorStop(0.55, "#3f8f7d"); cg.addColorStop(1, "#173d36"); }
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(tx - r, ty);
      ctx.bezierCurveTo(tx - r * 0.95, ty - r * 1.2, tx + r * 0.95, ty - r * 1.2, tx + r, ty);
      ctx.quadraticCurveTo(tx, ty - r * 0.18, tx - r, ty);
      ctx.fill();
      // Glowing freckles.
      ctx.fillStyle = m.pink ? "rgba(255,200,230,0.9)" : "rgba(200,255,235,0.9)";
      for (const [ox, oy, s] of [[-0.42, -0.42, 0.09], [0.12, -0.7, 0.07], [0.5, -0.35, 0.06], [-0.1, -0.3, 0.05]]) {
        ctx.beginPath(); ctx.arc(tx + ox * r, ty + oy * r, r * s, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  // Sound curtains: shimmering strands across the passage that part when the song arrives.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < L.n; i++) {
    if (L.tile[i] !== "D") continue;
    const x = i % cols, y = (i / cols) | 0, o = L.doorAnim[i];
    const a = Math.max(vis(i), save.settings.contrast ? 0.6 : hidden(0.1 + Math.sin(clock * 2 + i) * 0.04)) * (1 - o * 0.85);
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
    const a = Math.max(c.on, vis(c.i) * 0.8, hidden(0.05));
    if (a < 0.02) continue;
    const X = sx(c.x), Y = sy(c.y);
    if (c.on) glow(GLOW.violet, X, Y, T * 2.2, 0.35 * c.on + Math.sin(clock * 2 + c.x) * 0.05);
    // A cut gem hovering and slowly turning: facets catch the light as it spins.
    ctx.globalCompositeOperation = "source-over";
    const bob = Math.sin(clock * 1.6 + c.x * 3) * T * 0.04, spin = Math.cos(clock * 0.9 + c.y * 2);
    const top = Y - T * 0.34 + bob, mid = Y - T * 0.06 + bob, bot = Y + T * 0.3 + bob, w = T * 0.2;
    const xs = [-1, -0.35, 0.35, 1].map(k => X + w * Math.sin(Math.asin(k) + spin * 0.6));
    const faces = [[0, 1, "#4a2a86", "#2a1550"], [1, 2, "#d8c2ff", "#7a52c8"], [2, 3, "#8e68d8", "#3b2170"]];
    for (const [i0, i1, cTop, cBot] of faces) {
      if (xs[i1] <= xs[i0]) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = cTop; ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(xs[i0], mid); ctx.lineTo(xs[i1], mid); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cBot; ctx.beginPath(); ctx.moveTo(xs[i0], mid); ctx.lineTo(X, bot); ctx.lineTo(xs[i1], mid); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(245,235,255,0.7)"; ctx.lineWidth = Math.max(1, T * 0.012);
    ctx.beginPath(); ctx.moveTo(xs[0], mid); ctx.lineTo(xs[3], mid); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.white, xs[2] - w * 0.2, mid - T * 0.08, T * 0.12, a * (0.4 + 0.3 * Math.max(0, spin)));
  }

  // Portal: a slow vortex, always faintly visible so there's a goal.
  {
    const e = L.exit, X = sx(e.x), Y = sy(e.y);
    const asleep = L.goal === "rescue" && L.baby && !L.baby.following;
    const a = (L.hideLights && !L.seen[e.i] ? vis(e.i) : Math.max(0.35, vis(e.i))) * (asleep ? 0.45 : 1);
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
    const a = L.hideLights && !L.seen[o.i] ? vis(o.i) : Math.max(hc ? 0.7 : 0.22 + Math.sin(clock * 3 + o.ph) * 0.1, vis(o.i));
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
    const X = sx(m.x), Y = sy(m.y), a = (m.following ? 0.9 : 0.55) * sightAt(m.x, m.y);
    if (a < 0.02) continue;
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
    const a = Math.max(vis(c.i), hidden(0.12));
    if (a < 0.02) continue;
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

  // Glowing decorations (crystals, lava, lanterns...) shimmer a little.
  ctx.globalCompositeOperation = "lighter";
  for (const e of L.emitters || []) {
    if (sx(e.x) < -TS * 2 || sx(e.x) > W + TS * 2 || sy(e.y) < -TS * 2 || sy(e.y) > H + TS * 2 || knownAt(e.x, e.y) <= 0) continue;
    const fl = e.color === "gold" ? 0.75 + 0.25 * Math.sin(clock * 9 + e.ph) * Math.sin(clock * 3.1 + e.ph) : 0.8 + 0.2 * Math.sin(clock * 1.7 + e.ph);
    glow(GLOW[e.color], sx(e.x), sy(e.y), TS * e.r * 0.9, e.a * 0.55 * fl * knownAt(e.x, e.y));
  }
  ctx.globalCompositeOperation = "source-over";

  // Rune stones: a carved ring that lights up green once it hears a song from close by.
  for (const r of L.runes) {
    const X = sx(r.x), Y = sy(r.y), a = Math.max(vis(r.i), r.on, hidden(0.12) + r.far * 0.5), rr = TS * 0.3;
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
    const a = Math.max(vis(gt.i), save.settings.contrast ? 0.7 : hidden(0.1)) * (1 - sink);
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
  // The lost baby moth: small and pale pink, hidden until a song or Lumi's light finds it.
  if (L.baby && (L.baby.following || knownAt(L.baby.hx, L.baby.hy) > 0.02)) {
    const b = L.baby, X = sx(b.x), Y = sy(b.y), flap = Math.abs(Math.sin(b.ph * 16)), T2 = TS * 0.8, k = b.following ? 1 : knownAt(b.hx, b.hy);
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.pink, X, Y, TS * 0.9, (b.following ? 0.6 : 0.4 + Math.sin(b.ph * 3) * 0.15) * k);
    ctx.fillStyle = `rgba(255,225,240,${0.95 * k})`;
    ctx.beginPath();
    ctx.ellipse(X - T2 * 0.1, Y, T2 * 0.12 * (0.3 + flap * 0.7), T2 * 0.14, -0.4, 0, Math.PI * 2);
    ctx.ellipse(X + T2 * 0.1, Y, T2 * 0.12 * (0.3 + flap * 0.7), T2 * 0.14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Thornlings: dark spiky urchins. Barely visible unless light reaches them.
  for (const t of L.thorns) {
    if (sx(t.x) < -TS * 2 || sx(t.x) > W + TS * 2 || sy(t.y) < -TS * 2 || sy(t.y) > H + TS * 2) continue;
    const ti = Math.floor(t.y) * L.cols + Math.floor(t.x);
    const a = Math.max(ti >= 0 && ti < L.n ? Math.max(L.lit[ti], L.glow[ti]) : 0, save.settings.contrast ? 0.7 : hidden(0.07));
    if (a < 0.02) continue;
    const X = sx(t.x), Y = sy(t.y), r = TS * 0.2, spin = t.ph * 0.6;
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.ember, X, Y, TS * 0.7, a * 0.35);
    ctx.globalCompositeOperation = "source-over";
    drawLit(X, Y, TS * 0.7, Math.min(1, a * 1.4 + 0.15), Math.min(1, a * 1.3), () => {
    ctx.strokeStyle = "#ff7a6a";
    ctx.lineWidth = Math.max(1.5, TS * 0.045);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = spin + k * Math.PI / 5;
      ctx.moveTo(X + Math.cos(ang) * r, Y + Math.sin(ang) * r);
      ctx.lineTo(X + Math.cos(ang) * r * 1.9, Y + Math.sin(ang) * r * 1.9);
    }
    ctx.stroke();
    ctx.fillStyle = "#5a1d2a";
    ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb3a8";
    ctx.beginPath(); ctx.arc(X - r * 0.35, Y - r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.arc(X + r * 0.35, Y - r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
    });
  }

  drawMobs();

  // One of Lumi's little lights: a tiny pink Lumi, bobbing and peeking out of the dark.
  if (L.family && !L.family.got) {
    const f = L.family, X = sx(f.x), Y = sy(f.y + Math.sin(f.ph * 2) * 0.06), r = TS * 0.17;
    const a = L.hideLights && !L.seen[f.i] ? vis(f.i) : Math.max(0.4, vis(f.i));
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.pink, X, Y, TS * 0.9, a * 0.6);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = Math.min(1, a + 0.2);
    ctx.fillStyle = "#ffe3f1";
    ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#123049";
    ctx.beginPath(); ctx.arc(X - r * 0.35, Y - r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.arc(X + r * 0.35, Y - r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Hushlings: hooded shadows with a smoky tail, ear tufts and almond eyes that follow Lumi.
  // Hunting, their eyes narrow and burn pink and a jagged grin opens. The Great Hush is bigger,
  // wears a crown of shadow spikes and has a second, smaller pair of eyes.
  for (const g of L.gloom) {
    if (g.gone > 0) continue;
    const X = sx(g.x), Y = sy(g.y), r = TS * (g.big ? 0.62 : 0.3), hunting = g.hunt > 0, t = g.ph;
    if (X < -r * 4 || Y < -r * 4 || X > W + r * 4 || Y > H + r * 4) continue;
    // Shadows in the dark: only seen where light falls on them.
    const seenA = Math.max(sightAt(g.x, g.y), save.settings.contrast ? 0.75 : 0);
    if (seenA < 0.02) continue;
    drawLit(X, Y, r * 2.8, 1, seenA, () => {
      ctx.globalCompositeOperation = "lighter";
      glow(GLOW.violet, X, Y, r * 2.6, hunting ? 0.35 : 0.16);
      ctx.globalCompositeOperation = "source-over";
      // Smoky tail: wisps trailing down and away, each fading out.
      for (let k = 0; k < 4; k++) {
        const sway = Math.sin(t * 2.2 + k * 1.7) * r * 0.35, len = r * (1.1 + k * 0.18);
        ctx.fillStyle = `rgba(14,8,24,${0.5 - k * 0.09})`;
        ctx.beginPath();
        ctx.moveTo(X - r * (0.7 - k * 0.12), Y + r * 0.2);
        ctx.quadraticCurveTo(X + sway - r * 0.2, Y + len * 0.8, X + sway * 1.6 + (k - 1.5) * r * 0.3, Y + len + r * 0.3);
        ctx.quadraticCurveTo(X + sway + r * 0.2, Y + len * 0.7, X + r * (0.7 - k * 0.12), Y + r * 0.2);
        ctx.fill();
      }
      // Hooded body with two ear tufts, darkest at the rim.
      const body = ctx.createRadialGradient(X - r * 0.2, Y - r * 0.35, r * 0.1, X, Y, r * 1.1);
      body.addColorStop(0, hunting ? "#3a1a4e" : "#2a1840"); body.addColorStop(0.7, "#140a22"); body.addColorStop(1, "#08040e");
      ctx.fillStyle = body;
      const ear = Math.sin(t * 1.5) * r * 0.06;
      ctx.beginPath();
      ctx.moveTo(X - r * 0.95, Y + r * 0.35);
      ctx.bezierCurveTo(X - r * 1.05, Y - r * 0.4, X - r * 0.75, Y - r * 0.8, X - r * 0.55, Y - r * 0.85);
      ctx.lineTo(X - r * 0.75, Y - r * 1.35 + ear);
      ctx.lineTo(X - r * 0.25, Y - r * 0.98);
      ctx.quadraticCurveTo(X, Y - r * 1.06, X + r * 0.25, Y - r * 0.98);
      ctx.lineTo(X + r * 0.75, Y - r * 1.35 - ear);
      ctx.lineTo(X + r * 0.55, Y - r * 0.85);
      ctx.bezierCurveTo(X + r * 0.75, Y - r * 0.8, X + r * 1.05, Y - r * 0.4, X + r * 0.95, Y + r * 0.35);
      ctx.quadraticCurveTo(X, Y + r * 0.75, X - r * 0.95, Y + r * 0.35);
      ctx.fill();
      if (g.big) {
        // A crown of shadow spikes.
        ctx.fillStyle = "#0c0616";
        for (const [ox, h] of [[-0.3, 0.55], [0, 0.75], [0.3, 0.55]]) {
          ctx.beginPath(); ctx.moveTo(X + (ox - 0.12) * r, Y - r * 0.95); ctx.lineTo(X + ox * r, Y - r * (0.95 + h)); ctx.lineTo(X + (ox + 0.12) * r, Y - r * 0.95); ctx.fill();
        }
      }
      if (save.settings.contrast) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X, Y - r * 0.2, r * 1.15, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Eyes: almond shapes looking toward Lumi; narrowed and slanted when hunting.
      const look = Math.atan2(L.lumi.y - g.y, L.lumi.x - g.x), lx = Math.cos(look) * r * 0.07, ly = Math.sin(look) * r * 0.05;
      const blink = (t * 0.37) % 4 < 0.08 ? 0.15 : 1, eh = r * (hunting ? 0.1 : 0.17) * blink;
      const eyes = [[-0.36, -0.25, 1], [0.36, -0.25, -1]];
      if (g.big) eyes.push([-0.18, 0.08, 0.6], [0.18, 0.08, -0.6]);
      ctx.globalCompositeOperation = "lighter";
      for (const [ox, oy] of eyes) glow(hunting ? GLOW.pink : GLOW.violet, X + ox * r, Y + oy * r, r * 0.55, hunting ? 0.7 : 0.4);
      ctx.globalCompositeOperation = "source-over";
      for (const [ox, oy, s] of eyes) {
        const small = Math.abs(s) < 1 ? 0.65 : 1, ex = X + ox * r, ey = Y + oy * r, ew = r * 0.2 * small;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(hunting ? s * 0.35 : 0);
        ctx.fillStyle = hunting ? "#ff9ad0" : "#c9a8ff";
        ctx.beginPath(); ctx.ellipse(0, 0, ew, eh * small, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(lx, ly, ew * 0.32, eh * 0.55 * small, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (hunting) {
        // A jagged glowing grin.
        ctx.strokeStyle = "rgba(255,150,210,0.9)"; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineJoin = "miter";
        ctx.beginPath();
        for (let q = 0; q <= 6; q++) ctx.lineTo(X + (q / 6 - 0.5) * r * 0.7, Y + r * (0.18 + (q % 2) * 0.1 + Math.abs(q / 6 - 0.5) * -0.14));
        ctx.stroke();
      }
    });
  }

  // Echo crystals: violet facets in the rock that flash when a song bounces off them.
  for (const j of L.echoWalls) {
    const a = Math.max(vis(j), save.settings.contrast ? 0.6 : 0);
    const fl = L.echoFlash ? L.echoFlash.get(j) || 0 : 0;
    if (a < 0.03 && fl <= 0) continue;
    const X = sx((j % L.cols) + 0.5), Y = sy(((j / L.cols) | 0) + 0.5);
    ctx.globalCompositeOperation = "lighter";
    glow(GLOW.violet, X, Y, TS * (0.8 + fl), a * 0.35 + fl * 0.8);
    ctx.globalCompositeOperation = "source-over";
    // A cluster of shards growing out of a dark socket in the rock, each with a lit face, a
    // shadowed face and a bright ridge.
    drawLit(X, Y, TS * 0.6, Math.min(1, a + fl), Math.min(1, a * 1.1 + fl), () => {
      ctx.fillStyle = "rgba(14,8,26,0.75)";
      ctx.beginPath(); ctx.ellipse(X, Y + TS * 0.2, TS * 0.36, TS * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      for (const [ox, ang, len, wd] of [[-0.17, -0.45, 0.42, 0.09], [0.15, 0.4, 0.36, 0.08], [0, -0.05, 0.55, 0.11], [0.26, 0.85, 0.22, 0.06], [-0.28, -0.95, 0.24, 0.06]]) {
        const bx = X + ox * TS, by = Y + TS * 0.2, dx = Math.sin(ang), dy = -Math.cos(ang);
        const tx = bx + dx * len * TS, ty = by + dy * len * TS, nx = -dy * wd * TS, ny = dx * wd * TS;
        const px = tx + dx * wd * 1.3 * TS, py = ty + dy * wd * 1.3 * TS;
        for (const [s, c0, c1] of [[1, "#2c1650", "#cdb2ff"], [-1, "#160a2c", "#7a55c4"]]) {
          const g = ctx.createLinearGradient(bx, by, px, py);
          g.addColorStop(0, c0); g.addColorStop(1, c1);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + nx * s, by + ny * s); ctx.lineTo(tx + nx * s * 0.8, ty + ny * s * 0.8); ctx.lineTo(px, py); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = `rgba(245,235,255,${0.5 + fl * 0.5})`; ctx.lineWidth = Math.max(1, TS * 0.012);
        ctx.beginPath(); ctx.moveTo(bx + (tx - bx) * 0.3, by + (ty - by) * 0.3); ctx.lineTo(px, py); ctx.stroke();
      }
    });
    if (fl > 0) L.echoFlash.set(j, Math.max(0, fl - 1 / 40));
  }

  // Song wavefronts.
  ctx.globalCompositeOperation = "lighter";
  for (const w of L.waves) {
    const fade = Math.max(0, 1 - w.r / (w.range + 1.5));
    for (let i = 0; i < L.n; i++) {
      const d = w.dist[i];
      if (d > w.range + 0.5) continue;
      const k = 1 - Math.abs(d - w.r) / 1.1;
      if (k <= 0) continue;
      const cx = sx((i % L.cols) + 0.5), cy = sy(((i / L.cols) | 0) + 0.5);
      glow(w.echo ? GLOW.violet : GLOW.cyan, cx, cy, TS * (w.long ? 1.4 : 1.15), k * k * fade * 0.32);
      if (k > 0.55) {
        // Bright sparkles ride the front of the wave, scattered a little within each tile.
        const h = (i * 7919 + Math.floor(w.r * 3)) % 97 / 97, h2 = (i * 104729) % 89 / 89;
        glow(GLOW.white, cx + (h - 0.5) * TS * 0.7, cy + (h2 - 0.5) * TS * 0.7, TS * 0.16, (k - 0.55) * 2 * fade);
      }
    }
  }

  // Particles.
  for (const q of L.particles) {
    const t = q.life / q.max;
    glow(q.color === "skin" ? lumiLook().glow : GLOW[q.color], sx(q.x), sy(q.y), TS * q.size * 3, t * 0.9);
  }

  // Spores drifting up through the light, and Lumi's soft trail.
  ctx.globalCompositeOperation = "lighter";
  const pt = PARTICLES[themeIndex(levelIndex)];
  for (const s of L.spores) {
    const ti = Math.floor(s.y) * L.cols + Math.floor(s.x);
    let a = (ti >= 0 && ti < L.n ? Math.max(L.lit[ti], L.glow[ti]) : 0) * Math.sin(Math.PI * s.life / s.max);
    if (pt.twinkle) a *= 0.5 + 0.5 * Math.sin(s.life * 7 + s.ph);
    if (pt.bubble) {
      ctx.strokeStyle = `rgba(190,240,255,${a * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), TS * 0.06, 0, Math.PI * 2); ctx.stroke();
    } else glow(GLOW[pt.glow], sx(s.x), sy(s.y), TS * 0.09, a * 0.7);
  }
  {
    const look0 = lumiLook(), tr = L.trail;
    for (let k = 0; k < tr.length; k++) {
      const q = (k + 1) / tr.length;
      glow(look0.glow, sx(tr[k][0]), sy(tr[k][1]), TS * 0.32 * q, 0.22 * q * (L.useEnergy ? 0.5 + 0.5 * Math.min(1, L.energy / 40) : 1));
    }
  }

  // Where the player tapped, in tap-to-move mode.
  if (L.tapMark && L.tapMark.t > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = `rgba(200,240,255,${L.tapMark.t * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx(L.tapMark.x), sy(L.tapMark.y), TS * (0.45 - L.tapMark.t * 0.15), 0, Math.PI * 2); ctx.stroke();
  }

  // Charging a long song: a ring that fills around Lumi.
  if (L.charge > 0) {
    const cx = sx(L.lumi.x), cy = sy(L.lumi.y), rr = TS * 0.62;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = Math.max(2, TS * 0.07);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = L.charge >= 1 ? "rgba(255,230,160,0.95)" : "rgba(200,240,255,0.85)";
    ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * L.charge); ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    if (L.charge >= 1) glow(GLOW.gold, cx, cy, rr * 1.6, 0.25 + Math.sin(clock * 10) * 0.1);
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
    ctx.globalAlpha = (0.35 + 0.65 * bright) * (L.invuln > 0 ? 0.55 + 0.45 * Math.sin(L.invuln * 40) : 1);
    const sq = lumi.squash * 0.18;
    const speed = Math.hypot(lumi.vx, lumi.vy), st = Math.min(0.12, speed * 0.028);
    ctx.save();
    ctx.translate(X, Y);
    // Antenna with a glowing tip that sways and trails behind when swimming.
    const sway = Math.sin(clock * 3.1) * R * 0.22 - lumi.vx * R * 0.12;
    const tipX = sway, tipY = -R * 1.72 + Math.abs(lumi.vy) * R * 0.05;
    ctx.strokeStyle = look.body[2];
    ctx.lineWidth = Math.max(1.2, R * 0.13);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.8);
    ctx.quadraticCurveTo(sway * 0.2, -R * 1.35, tipX, tipY);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    glow(look.glow, tipX, tipY, R * 1.1, 0.7 * bright + lumi.sing);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = look.body[0];
    ctx.beginPath(); ctx.arc(tipX, tipY, R * 0.2, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, look.body[0]);
    g.addColorStop(0.6, look.body[1]);
    g.addColorStop(1, look.body[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * (1 + sq + st), R * (1 - sq - st * 0.7), speed > 0.3 ? lumi.look : 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes look where Lumi swims, and show its mood.
    const lx = Math.cos(lumi.look) * R * 0.22, ly = Math.sin(lumi.look) * R * 0.18;
    const mood = L.mood || "";
    ctx.fillStyle = "#123049";
    ctx.strokeStyle = "#123049";
    ctx.lineWidth = Math.max(1, R * 0.09);
    ctx.lineCap = "round";
    if (mood === "happy") {
      // Happy: eyes closed in little upside-down smiles.
      ctx.beginPath();
      ctx.arc(-R * 0.32 + lx, -R * 0.02 + ly, R * 0.12, Math.PI + 0.3, -0.3);
      ctx.moveTo(R * 0.32 + lx + R * 0.115, -R * 0.06 + ly);
      ctx.arc(R * 0.32 + lx, -R * 0.02 + ly, R * 0.12, Math.PI + 0.3, -0.3);
      ctx.stroke();
    } else {
      const ew = mood === "scared" ? R * 0.15 : R * 0.12;
      const eh = lumi.blink < 0 ? R * 0.04 : mood === "sleepy" ? R * 0.06 : mood === "scared" ? R * 0.2 : R * 0.17;
      ctx.beginPath();
      ctx.ellipse(-R * 0.32 + lx, -R * 0.08 + ly, ew, eh, 0, 0, Math.PI * 2);
      ctx.ellipse(R * 0.32 + lx, -R * 0.08 + ly, ew, eh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (lumi.blink >= 0 && mood !== "happy" && mood !== "sleepy") {
      // A tiny sparkle in each eye.
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-R * 0.29 + lx, -R * 0.15 + ly, R * 0.045, 0, Math.PI * 2);
      ctx.arc(R * 0.35 + lx, -R * 0.15 + ly, R * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#123049";
    }
    if (lumi.sing > 0 || mood === "scared") {
      ctx.beginPath();
      ctx.ellipse(lx * 0.8, R * 0.35 + ly, R * 0.12, R * 0.15 * (mood === "scared" ? 0.8 : Math.min(1, lumi.sing * 4)), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === "happy") {
      ctx.beginPath();
      ctx.arc(lx * 0.8, R * 0.18 + ly, R * 0.22, 0.2, Math.PI - 0.2);
      ctx.stroke();
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
    drawHat(save.hat || 0, R);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// Creatures are drawn into a small side canvas first, then lit like the rock: the side facing
// Lumi catches a warm highlight, the far side falls into shadow, and they dim where it's dark.
const litBuf = document.createElement("canvas"), litCtx = litBuf.getContext("2d");
function drawLit(X, Y, size, light, alpha, draw) {
  const d = Math.min(DPR, 2), px = Math.ceil(size * 2 * d);
  if (litBuf.width < px || litBuf.height < px) litBuf.width = litBuf.height = Math.max(px, 64);
  litCtx.setTransform(1, 0, 0, 1, 0, 0);
  litCtx.globalCompositeOperation = "source-over";
  litCtx.globalAlpha = 1;
  litCtx.clearRect(0, 0, px, px);
  litCtx.setTransform(d, 0, 0, d, (size - X) * d, (size - Y) * d);
  ctx = litCtx;
  try { draw(); } finally { ctx = mainCtx; }
  litCtx.setTransform(d, 0, 0, d, (size - X) * d, (size - Y) * d);
  litCtx.globalAlpha = 1;
  litCtx.globalCompositeOperation = "source-atop";
  const ang = Math.atan2(sy(L.lumi.y) - Y, sx(L.lumi.x) - X), gx = Math.cos(ang) * size * 0.8, gy = Math.sin(ang) * size * 0.8;
  const g = litCtx.createLinearGradient(X + gx, Y + gy, X - gx, Y - gy);
  g.addColorStop(0, "rgba(255,244,226,0.28)");
  g.addColorStop(0.42, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(4,5,16,0.68)");
  litCtx.fillStyle = g;
  litCtx.fillRect(X - size, Y - size, size * 2, size * 2);
  litCtx.fillStyle = `rgba(4,5,14,${Math.max(0, 1 - light) * 0.6})`;
  litCtx.fillRect(X - size, Y - size, size * 2, size * 2);
  litCtx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(litBuf, 0, 0, px, px, X - size, Y - size, size * 2, size * 2);
  ctx.restore();
}

// The map on the results screen: rock you've seen, Lumi's route, and the lights.
function drawResultMap() {
  const c = $("resultMap"), th = themeOf(levelIndex);
  const scale = Math.min(240 / L.cols, 120 / L.rows), w = L.cols * scale, h = L.rows * scale, d = Math.min(DPR, 2);
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  c.style.width = w + "px"; c.style.height = h + "px";
  const m = c.getContext("2d");
  m.setTransform(d, 0, 0, d, 0, 0);
  m.clearRect(0, 0, w, h);
  for (let i = 0; i < L.n; i++) {
    if (!L.seen[i]) continue;
    const x = (i % L.cols) * scale, y = ((i / L.cols) | 0) * scale;
    m.fillStyle = L.tile[i] === "#" ? `rgba(${th.rim.join(",")},0.35)` : "rgba(255,255,255,0.05)";
    m.fillRect(x, y, scale + 0.5, scale + 0.5);
  }
  m.strokeStyle = "rgba(200,240,255,0.9)";
  m.lineWidth = 2;
  m.lineJoin = m.lineCap = "round";
  m.beginPath();
  L.path.forEach(([x, y], k) => (k ? m.lineTo(x * scale, y * scale) : m.moveTo(x * scale, y * scale)));
  m.lineTo(L.exit.x * scale, L.exit.y * scale);
  m.stroke();
  for (const o of L.lights) {
    m.fillStyle = o.got ? "#ffd36e" : "rgba(255,211,110,0.35)";
    m.beginPath(); m.arc(o.x * scale, o.y * scale, Math.max(2.5, scale * 0.25), 0, Math.PI * 2); m.fill();
  }
  m.strokeStyle = "#b48cff";
  m.beginPath(); m.arc(L.exit.x * scale, L.exit.y * scale, Math.max(3, scale * 0.3), 0, Math.PI * 2); m.stroke();
  if (L.path.length) { m.fillStyle = "#ffffff"; m.beginPath(); m.arc(L.path[0][0] * scale, L.path[0][1] * scale, 2.5, 0, Math.PI * 2); m.fill(); }
  // Shown as a picture so it can be pressed and held to save on phones.
  const img = $("resultMapImg");
  img.src = c.toDataURL("image/png");
  img.style.width = w + "px"; img.style.height = h + "px";
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
  if (L) stepArtJob(screen === "play" ? 5 : 10);
  drawBackground(dt);
  if (L) { drawCave(); drawThings(); }
  else drawTitle(dt);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  if (L && L.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${L.flash * 0.45})`; ctx.fillRect(0, 0, W, H); }
  if (L && L.fade > 0) {
    // Each cave fades in from black.
    ctx.fillStyle = `rgba(3,4,11,${L.fade})`;
    ctx.fillRect(0, 0, W, H);
    L.fade = Math.max(0, L.fade - dt * 1.8);
  }
  drawStick();
  drawEnergy();
  requestAnimationFrame(frame);
}

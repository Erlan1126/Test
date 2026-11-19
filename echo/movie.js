// Echo: the films. The story is told as short animated films instead of pages of text: a
// minute-long opening (the city of light, the Singer, the flood, the tears that became
// Hushlings, Lumi waking alone, and what you're here to do), a short one before act two, and
// one at the end of each act. Each scene is painted on a canvas with a single line of text
// under it. Tap to go to the next scene, or Skip.
"use strict";

// ---------- Painting helpers ----------
const mv = {
  glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = "source-over";
  },
  sky(ctx, W, H, a, b, c) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(0.6, b); g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  roof(ctx, W, H, color, seed, depth = 0.14) {
    const r = seeded(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
    for (let x = W; x >= -20; x -= W / 26) ctx.lineTo(x, H * depth * (0.4 + r() * 0.6) + (r() < 0.3 ? H * 0.08 * r() : 0));
    ctx.fill();
  },
  // A row of buildings; lit (0..1) lights that share of the windows, warmest first.
  skyline(ctx, W, H, base, height, color, seed, lit, t, shift = 0) {
    const r = seeded(seed); let x = -20 + shift;
    ctx.fillStyle = color;
    const wins = [];
    while (x < W + 20) {
      const w = W * (0.07 + r() * 0.09), h = height * (0.45 + r() * 0.55), top = base - h;
      ctx.fillRect(x, top, w, h + H);
      if (r() < 0.45) { ctx.beginPath(); ctx.moveTo(x - 2, top); ctx.lineTo(x + w / 2, top - w * 0.45); ctx.lineTo(x + w + 2, top); ctx.fill(); }
      for (let wy = top + h * 0.12; wy < base - 8; wy += height * 0.13) for (let wx = x + w * 0.18; wx < x + w - 6; wx += w * 0.3) wins.push([wx, wy, r()]);
      x += w + W * 0.006;
    }
    for (const [wx, wy, q] of wins) {
      const on = q < lit, fl = 0.8 + 0.2 * Math.sin(t * 2 + q * 40);
      ctx.fillStyle = on ? `rgba(255,${200 + q * 30 | 0},${120 + q * 40 | 0},${fl})` : "rgba(30,36,66,0.6)";
      ctx.fillRect(wx, wy, W * 0.012, H * 0.012);
      if (on) mv.glow(ctx, wx + W * 0.006, wy + H * 0.006, W * 0.03, "255,190,110", 0.25);
    }
  },
  // The Singer: a vast hooded shape. warm 1 is golden and glowing; 0 is the Hush, a shadow.
  singer(ctx, x, y, s, warm, t, eyesShut = 0) {
    const sway = Math.sin(t * 0.7) * s * 0.01;
    if (warm > 0) mv.glow(ctx, x, y - s * 0.5, s * 1.3, "255,200,120", 0.55 * warm);
    else mv.glow(ctx, x, y - s * 0.5, s * 1.1, "120,70,200", 0.18);
    const body = ctx.createLinearGradient(x, y - s, x, y + s * 0.3);
    const top = warm > 0 ? `rgb(${40 + 180 * warm | 0},${26 + 130 * warm | 0},${50 + 40 * warm | 0})` : "#160c28";
    body.addColorStop(0, top); body.addColorStop(1, warm > 0 ? `rgba(80,50,30,${0.6 + 0.4 * warm})` : "#05030a");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.62 + sway, y + s * 0.4);
    ctx.bezierCurveTo(x - s * 0.7, y - s * 0.3, x - s * 0.5, y - s * 0.86, x - s * 0.3, y - s * 0.92);
    // A tall, soft hood that rises to a gentle point, like a cloak drawn up.
    ctx.bezierCurveTo(x - s * 0.22, y - s * 1.18, x - s * 0.06, y - s * 1.32, x, y - s * 1.34);
    ctx.bezierCurveTo(x + s * 0.06, y - s * 1.32, x + s * 0.22, y - s * 1.18, x + s * 0.3, y - s * 0.92);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.86, x + s * 0.7, y - s * 0.3, x + s * 0.62 + sway, y + s * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = warm > 0 ? `rgba(255,220,160,${0.5 * warm})` : "rgba(150,100,255,0.35)"; ctx.lineWidth = Math.max(1, s * 0.008); ctx.stroke();
    // Eyes: warm and closed in a smile when singing; violet, wide and sad as the Hush.
    const eye = warm > 0.5 ? "#fff1c8" : "#c9a8ff";
    for (const sd of [-1, 1]) {
      const ex = x + sd * s * 0.17, ey = y - s * 0.62;
      if (eyesShut > 0.5 || warm > 0.5) { ctx.strokeStyle = eye; ctx.lineWidth = s * 0.018; ctx.beginPath(); ctx.arc(ex, ey + s * 0.02, s * 0.06, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      else { mv.glow(ctx, ex, ey, s * 0.16, "190,150,255", 0.6); ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.07, s * 0.045, sd * -0.25, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  lumi(ctx, x, y, r, { open = 1, look = 0, glow = 1 } = {}) {
    mv.glow(ctx, x, y, r * 5, "140,230,255", 0.5 * glow);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#d6f6ff"); g.addColorStop(1, "#7fd8f5");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#123049";
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.34 + look * r * 0.12, y - r * 0.02, r * 0.11, r * 0.16 * Math.max(0.08, open), 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(255,150,190,0.4)"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.58, y + r * 0.25, r * 0.15, r * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
  },
  eyes(ctx, x, y, s, t, ph, col = "255,154,208") {
    const blink = (t * 0.5 + ph) % 3.5 < 0.12 ? 0.1 : 1;
    for (const sd of [-1, 1]) { mv.glow(ctx, x + sd * s, y, s * 2.2, col, 0.35); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.ellipse(x + sd * s, y, s * 0.75, s * 0.4 * blink, sd * -0.3, 0, Math.PI * 2); ctx.fill(); }
  },
  notes(ctx, x, y, W, t, n, a) {
    for (let k = 0; k < n; k++) {
      const p = (t * 0.18 + k / n) % 1, nx = x + Math.sin(k * 2.3 + t * 0.6) * W * 0.18, ny = y - p * W * 0.6;
      ctx.globalAlpha = a * Math.sin(Math.PI * p); ctx.fillStyle = "#fff4d6"; ctx.font = `${W * 0.05}px Georgia, serif`; ctx.fillText(k % 2 ? "♪" : "♫", nx, ny);
    }
    ctx.globalAlpha = 1;
  },
  motes(ctx, W, H, t, n, rgb, seed) {
    const r = seeded(seed);
    for (let k = 0; k < n; k++) { const x = (r() * W + t * W * 0.01 * (r() - 0.5) * 4 + W) % W, y = (r() * H - t * H * 0.02 * r() + H * 2) % H, a = 0.3 + 0.5 * Math.abs(Math.sin(t + k)); ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(x, y, 2, 2); }
  },
  water(ctx, W, H, level, t) {
    for (let layer = 0; layer < 3; layer++) {
      const y0 = level + layer * H * 0.04, c = ["#0c2a52", "#0a2244", "#071833"][layer];
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, y0 + Math.sin(x * 0.02 + t * (3 + layer) + layer) * H * 0.018 + Math.sin(x * 0.007 - t * 2) * H * 0.012);
      ctx.lineTo(W, H); ctx.fill();
      if (layer === 0) { ctx.strokeStyle = "rgba(170,220,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, y0 + Math.sin(x * 0.02 + t * 3) * H * 0.018 + Math.sin(x * 0.007 - t * 2) * H * 0.012); ctx.stroke(); }
    }
  },
};

// ---------- Scenes ----------
// Each: how long, its line of text, a sound cue when it starts, and how to paint it at time t.
const SC = {
  city: (line, { warm = 0, lit = 0.9, sky = false } = {}) => ({ dur: 7, line, cue: () => {}, draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, sky ? "#0b1640" : "#060814", warm ? "#2a1c30" : "#141838", "#07070f");
    if (sky) { const r = seeded(9); for (let q = 0; q < 120; q++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(t + q))})`; ctx.fillRect(r() * W, r() * H * 0.5, 1.6, 1.6); } }
    else mv.roof(ctx, W, H, "#020309", 31);
    const zoom = 1 + k * 0.06; ctx.save(); ctx.translate(W / 2, H * 0.62); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.62);
    mv.glow(ctx, W / 2, H * 0.42, W * (0.6 + warm * 0.3), "255,200,120", 0.35 + warm * 0.3);
    mv.skyline(ctx, W, H, H * 0.66, H * 0.2, "#0d1028", 5, lit * 0.8, t, -k * W * 0.03);
    // The Singer's tower.
    ctx.fillStyle = "#0a0c1e"; ctx.beginPath(); ctx.moveTo(W * 0.46, H * 0.8); ctx.lineTo(W * 0.475, H * 0.36); ctx.lineTo(W * 0.5, H * 0.27); ctx.lineTo(W * 0.525, H * 0.36); ctx.lineTo(W * 0.54, H * 0.8); ctx.fill();
    mv.glow(ctx, W * 0.5, H * 0.38, W * 0.12, "255,220,150", 0.8 * lit); ctx.fillStyle = `rgba(255,236,190,${lit})`; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.38, W * 0.016, 0, Math.PI * 2); ctx.fill();
    mv.skyline(ctx, W, H, H * 0.82, H * 0.24, "#070915", 11, lit, t, k * W * 0.05);
    ctx.restore();
    // Little lights drifting over the city.
    const r = seeded(3); for (let q = 0; q < 26 * lit; q++) { const x = (r() * W + Math.sin(t * 0.5 + q) * 20), y = H * (0.3 + r() * 0.45) + Math.sin(t + q * 2) * 8; mv.glow(ctx, x, y, W * 0.025, "170,235,255", 0.6); ctx.fillStyle = "#eaffff"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    ctx.fillStyle = "#04050c"; ctx.fillRect(0, H * 0.82, W, H);
  } }),
  singer: (line, { warm = 1, lumi = true } = {}) => ({ dur: 7, line, cue: () => playLullaby(), draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#07060f", "#1c1428", "#0a0810");
    mv.skyline(ctx, W, H, H * 0.86, H * 0.16, "#0c0d1e", 21, 0.6, t);
    mv.singer(ctx, W * 0.5, H * 0.72, W * (0.62 + k * 0.05), warm, t, 1);
    mv.notes(ctx, W * 0.5, H * 0.4, W, t, 7, 0.8);
    if (lumi) mv.lumi(ctx, W * 0.5, H * 0.6 + Math.sin(t * 1.5) * 4, W * 0.035, { open: 0.15, glow: 0.8 });
  } }),
  held: (line) => ({ dur: 6, line, cue: () => {}, draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#120c14", "#2a1a1c", "#100a0c");
    mv.glow(ctx, W * 0.5, H * 0.45, W * 0.9, "255,190,110", 0.5);
    mv.singer(ctx, W * 0.5, H * 1.05, W * 1.25, 1, t, 1);
    const blink = (t % 3.2) < 0.15 ? 0.1 : 1;
    mv.lumi(ctx, W * 0.5, H * 0.56 + Math.sin(t * 1.4) * 5, W * (0.085 + k * 0.01), { open: blink, look: Math.sin(t * 0.6) });
    mv.notes(ctx, W * 0.5, H * 0.5, W, t, 4, 0.6);
  } }),
  flood: (line) => ({ dur: 7.5, line, cue: () => { sfx.rumble(0); setTimeout(() => sfx.rumble(-2), 1800); setTimeout(() => sfx.rumble(2), 3600); buzz([40, 60, 40]); }, draw(ctx, W, H, t, k) {
    const shake = (k < 0.7 ? 1 : 0) * W * 0.006; ctx.save(); ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    mv.sky(ctx, W, H, "#04050c", "#0b1024", "#04050c");
    mv.roof(ctx, W, H, "#020309", 31);
    mv.skyline(ctx, W, H, H * 0.7, H * 0.22, "#0b0e22", 5, Math.max(0, 0.8 - k * 1.4), t);
    // Water roaring in; the lights scatter; the littlest is swept away and down.
    const level = H * (1.05 - Math.min(1, k * 1.25) * 0.62);
    const r = seeded(17); for (let q = 0; q < 22; q++) { const p = Math.min(1, k * 1.6 + r() * 0.2), x = r() * W + p * W * (r() - 0.5) * 0.6, y = H * (0.4 + r() * 0.3) - p * H * 0.35; mv.glow(ctx, x, y, W * 0.02, "170,235,255", 0.6 * (1 - p)); }
    for (let q = 0; q < 70; q++) { const x = (q * 53 + t * 900) % (W + 200) - 100, y = (q * 97 + t * 1300) % H; ctx.strokeStyle = "rgba(160,200,255,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 26); ctx.stroke(); }
    mv.water(ctx, W, H, level, t);
    // Lumi, tumbling on the flood, then pulled under and away.
    const lx = W * (0.3 + k * 0.5) + Math.sin(t * 5) * W * 0.02, sink = Math.max(0, (k - 0.7) / 0.3), ly = Math.min(level - W * 0.02, H * 0.5) + sink * H * 0.25 + Math.sin(t * 4) * 6;
    ctx.globalAlpha = 1 - sink * 0.85;
    mv.lumi(ctx, lx, ly, W * 0.035, { open: 0.5, look: -1, glow: 1 });
    ctx.globalAlpha = 1;
    ctx.restore();
  } }),
  grief: (line) => ({ dur: 8, line, cue: () => note(110, { dur: 4, vol: 0.08, type: "sawtooth", lowpass: 300, attack: 1, glide: 82, echo: 0.8 }), draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#040309", "#0c0818", "#030207");
    mv.singer(ctx, W * 0.5, H * 0.78, W * 0.72, Math.max(0, 1 - k * 1.4), t, k < 0.6 ? 1 : 0);
    // Tears.
    if (k > 0.45) for (let q = 0; q < 6; q++) { const p = (t * 0.6 + q / 6) % 1, x = W * 0.5 + (q % 2 ? 1 : -1) * W * 0.12, y = H * 0.35 + p * H * 0.5; ctx.fillStyle = `rgba(200,170,255,${0.8 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(x, y, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  } }),
  tears: (line) => ({ dur: 7, line, cue: () => { sfx.gloomWake(-2); setTimeout(() => sfx.gloomWake(2), 1500); setTimeout(() => sfx.breath(0, 0.6), 3000); }, draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#020207", "#07051a", "#020207");
    const r = seeded(41), n = Math.floor(3 + k * 22);
    for (let q = 0; q < n; q++) mv.eyes(ctx, W * (0.08 + r() * 0.84), H * (0.15 + r() * 0.75), W * 0.016, t, q * 0.7);
    for (let q = 0; q < 4; q++) { const p = (t * 0.5 + q / 4) % 1; ctx.fillStyle = `rgba(200,170,255,${1 - p})`; ctx.beginPath(); ctx.ellipse(W * (0.3 + q * 0.13), p * H * 0.8, 3, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  } }),
  wake: (line) => ({ dur: 8, line, cue: () => setTimeout(() => sfx.ping(0), 5200), draw(ctx, W, H, t, k) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const open = k < 0.35 ? 0.05 : k < 0.42 ? 1 : k < 0.45 ? 0.1 : 1;
    if (k > 0.65) {
      // The first song: an echo rolls out and shows the cave around Lumi for a moment.
      const p = (k - 0.65) / 0.35, R = p * W * 0.9;
      ctx.strokeStyle = `rgba(150,235,255,${0.7 * (1 - p)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H * 0.55, R, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H * 0.55, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = `rgba(30,60,90,${0.6 * (1 - p)})`; const r = seeded(5);
      for (let q = 0; q < 14; q++) { const a = q / 14 * Math.PI * 2, d = W * (0.28 + r() * 0.15); ctx.beginPath(); ctx.ellipse(W / 2 + Math.cos(a) * d, H * 0.55 + Math.sin(a) * d, W * 0.12, W * 0.08, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    mv.lumi(ctx, W / 2, H * 0.55, W * 0.07 * Math.min(1, 0.4 + k), { open, look: k > 0.5 ? Math.sin(t * 2) : 0, glow: Math.min(1, k * 1.5) });
  } }),
  goal: (line, { warm = false } = {}) => ({ dur: 6, line, cue: () => {}, draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#05060f", "#020308", "#000");
    mv.glow(ctx, W / 2, H * 0.08, W * 0.6, "255,200,120", 0.35 + (warm ? 0.3 : 0) + 0.1 * Math.sin(t * 2));
    mv.motes(ctx, W, H, t, 50, "200,230,255", 8);
    mv.lumi(ctx, W / 2, H * (0.72 - k * 0.08), W * 0.04, { look: 0 });
    for (let q = 0; q < 5; q++) { const x = W * (0.2 + q * 0.15), y = H * (0.35 + Math.sin(q * 2) * 0.1); mv.glow(ctx, x, y, W * 0.03, "255,220,140", 0.6 + 0.3 * Math.sin(t * 2 + q)); }
  } }),
  lurker: (line) => ({ dur: 6.5, line, cue: () => setTimeout(() => sfx.lurk(0), 2500), draw(ctx, W, H, t, k) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const open = Math.max(0, Math.min(1, (k - 0.3) * 3)), x = W / 2, y = H * 0.45, r = W * 0.16;
    mv.glow(ctx, x, y, r * 3, "255,190,80", 0.5 * open);
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r, r * open * 0.85 + 0.5, 0, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, "#fff6c8"); g.addColorStop(0.3, "#ffd36e"); g.addColorStop(1, "#7a4a08"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "#120a02"; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 0.8) * r * 0.2, y, r * 0.12, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } }),
  rise: (line) => ({ dur: 7, line, cue: () => playLullaby(), draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#0b1640", "#141030", "#05040a");
    const r = seeded(77);
    for (let q = 0; q < 24; q++) { const ph = r(), x = W * (0.1 + r() * 0.8), p = Math.min(1, Math.max(0, k * 1.6 - ph * 0.6)), y = H * (0.85 - p * 0.75);
      if (p <= 0) mv.eyes(ctx, x, H * 0.85, W * 0.014, t, q); else { mv.glow(ctx, x, y, W * 0.04, "255,220,140", 0.8); ctx.fillStyle = "#fff6d6"; ctx.fillRect(x - 2, y - 2, 4, 4); } }
  } }),
  together: (line) => ({ dur: 7, line, cue: () => {}, draw(ctx, W, H, t, k) {
    mv.sky(ctx, W, H, "#0b1640", "#2a1c30", "#0a0810");
    const r = seeded(9); for (let q = 0; q < 100; q++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(t + q))})`; ctx.fillRect(r() * W, r() * H * 0.45, 1.6, 1.6); }
    mv.singer(ctx, W * 0.5, H * 0.92, W * 0.9, 1, t, 1);
    mv.lumi(ctx, W * 0.5, H * 0.62 + Math.sin(t * 1.4) * 5, W * 0.06, { open: 1 });
    mv.notes(ctx, W * 0.5, H * 0.5, W, t, 6, 0.7);
  } }),
};

const MOVIES = {
  intro: () => [
    SC.city("Long ago, deep beneath the world, there was a city made of light."),
    SC.singer("Every night, the great Singer sang all its little lights to sleep."),
    SC.held("Its littlest light was called Lumi."),
    SC.flood("Then one night, the flood came."),
    SC.grief("The Singer searched and sang until its voice broke, and its own light went out."),
    SC.tears("Every tear it cried became a Hushling, hunting every sound for one lost voice."),
    SC.wake("Far below, Lumi wakes up. Alone. In the dark."),
    SC.goal("Find the lost lights. Find your way home."),
  ],
  act2: () => [
    SC.city("The Singer remembered its song, and the city began to glow again.", { warm: 1, lit: 0.5 }),
    SC.tears("But some Hushlings were still lost in the dark, crying for a voice they couldn't find."),
    SC.lurker("And deeper down, something else had woken. Something that hunts light."),
    SC.goal("Bring every last light home.", { warm: true }),
  ],
  end1: () => [
    SC.singer("Lumi sang the old lullaby, right into the dark.", { warm: 0 }),
    SC.singer("And the Singer remembered.", { warm: 1 }),
    SC.city("The Hush was over, and the city began to wake.", { warm: 1, lit: 0.5 }),
    SC.tears("But not every light had come home…"),
  ],
  end2: () => [
    SC.rise("One by one, the lost lights followed Lumi's song home."),
    SC.city("Every window lit. Every voice home.", { warm: 1, lit: 1, sky: true }),
    SC.together("Somebody's always listening."),
    SC.goal("The End", { warm: true }),
  ],
};

// ---------- Playing a film ----------
let movie = null;
function playMovie(name, done) {
  audio();
  movie = { scenes: MOVIES[name](), k: 0, t: 0, done, last: 0, shown: -1 };
  musicStop();
  show("movie");
  requestAnimationFrame(movieLoop);
}
function movieNext() {
  if (!movie) return;
  movie.k++; movie.t = 0;
  if (movie.k >= movie.scenes.length) movieEnd();
}
function movieEnd() {
  if (!movie) return;
  const done = movie.done; movie = null;
  $("movieCap").classList.remove("on");
  done();
}
function movieLoop(now) {
  if (!movie || screen !== "movie") return;
  const c = $("movieCanvas"), d = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const dt = Math.min(0.05, (now - (movie.last || now)) / 1000); movie.last = now;
  movie.t += dt;
  const sc = movie.scenes[movie.k];
  if (movie.shown !== movie.k) { movie.shown = movie.k; try { sc.cue(); } catch (e) {} $("movieCap").textContent = sc.line; $("movieCap").classList.remove("on"); }
  if (movie.t > 0.5 && movie.t < sc.dur - 0.7) $("movieCap").classList.add("on"); else $("movieCap").classList.remove("on");
  const ctx = c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  sc.draw(ctx, W, H, movie.t, Math.min(1, movie.t / sc.dur));
  // Fade in and out of black between scenes.
  const fade = Math.max(0, 1 - movie.t / 0.6, 1 - (sc.dur - movie.t) / 0.6);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
  $("movieDots").innerHTML = movie.scenes.map((_, q) => `<i class="${q === movie.k ? "on" : ""}"></i>`).join("");
  if (movie.t >= sc.dur) { movieNext(); if (!movie) return; }
  requestAnimationFrame(movieLoop);
}
document.getElementById("movieScreen").addEventListener("click", () => { audio(); if (movie && movie.t > 0.8) movieNext(); });
document.getElementById("movieSkip").addEventListener("click", e => { e.stopPropagation(); movieEnd(); });

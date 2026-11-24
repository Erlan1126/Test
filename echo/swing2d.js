// The swing drawn in fast 2D on the run canvas, no WebGL at all. Everything that would be
// expensive is drawn once into small images (buildings, glows, smoke) and then only copied each
// frame, so phones keep a steady 60 fps. It reads the game state (swing.js) and gives the
// overlay in run.js the screen positions it needs.
"use strict";

const SW2D = (() => {
  const mk = (w, h, paint) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); paint(c.getContext("2d"), c.width, c.height); return c; };
  const cssCache = new Map(); const css = a => { const k = a[0] * 65536 + a[1] * 256 + a[2]; let v = cssCache.get(k); if (!v) { v = `rgb(${a[0]},${a[1]},${a[2]})`; cssCache.set(k, v); } return v; };
  const hex = c => "#" + (c >>> 0).toString(16).padStart(6, "0");
  const rgbOf = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  // Soft round glows, one per colour.
  const glows = new Map();
  const glow = col => {
    const key = typeof col === "number" ? col : String(col);
    let g = glows.get(key); if (g) return g;
    const [r, gg, b] = typeof col === "number" ? rgbOf(col) : col;
    g = mk(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
    glows.set(key, g); return g;
  };
  const smoke = mk(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(6,2,16,0.95)"); gr.addColorStop(0.6, "rgba(16,6,36,0.55)"); gr.addColorStop(1, "rgba(16,6,36,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
  // Buildings: one image per building (dark and lit), drawn at a fixed scale and copied each frame.
  const PX = 14;  // pixels per metre in the cached images (sharp on phone screens)
  const STYLE = [
    { base: "#232b38", day: "#9fb2c6", win: "#3a4a5c", lit: "#ffd9a0", cols: 4, rows: 1 },
    { base: "#3a2622", day: "#a2614a", win: "#2c3846", lit: "#ffcf8a", cols: 3, rows: 1 },
    { base: "#262a33", day: "#d8dbe0", win: "#273140", lit: "#ffe2b0", cols: 6, rows: 0.6 },
    { base: "#161a22", day: "#5d6e82", win: "#2a3646", lit: "#c9e6ff", cols: 5, rows: 1.2 },
    { base: "#2c2a28", day: "#b8b2a6", win: "#2b3541", lit: "#ffd59a", cols: 2, rows: 0.8 },
    { base: "#33282c", day: "#d9b8a8", win: "#35414f", lit: "#ffd0b0", cols: 4, rows: 1 },
  ];
  // Which district you're in: 0 Downtown, 1 Markets, 2 Harbour, 3 Arcade, 4 Park, 5 Tower (Endless: by theme).
  const district = R => R.stageInfo && !R.stageInfo.daily ? Math.min(5, Math.floor((R.stageInfo.n - 1) / 10)) : Math.max(0, RUNNER_THEMES.indexOf(runnerTheme(R.px)));
  // Each district builds differently: offices, shophouses, warehouses, neon blocks, pavilions, glass towers.
  const KIND = ["office", "shop", "warehouse", "neon", "shop", "glass"];
  const SHOP_COL = ["#7a3b2e", "#2f6b5e", "#8a6a2a", "#5a3b6e", "#2e4f7a", "#7a5a3b"], WARE_COL = ["#4a3a30", "#2f4250", "#503a2a", "#3a4448"];
  function paintKind(x, w, h, kind, lit, day, seed) {
    const r = seeded(Math.floor(seed * 1e6) + 7);
    if (kind === "shop") {
      // Shophouses: warm plaster, tall shuttered windows, a balcony rail on each floor.
      const base = SHOP_COL[Math.floor(r() * SHOP_COL.length)]; x.fillStyle = base; x.fillRect(0, 0, w, h);
      const sh = x.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, "rgba(255,255,255,0.08)"); sh.addColorStop(1, "rgba(0,0,0,0.4)"); x.fillStyle = sh; x.fillRect(0, 0, w, h);
      const fl = 3.6 * PX, cols = Math.max(2, Math.round(w / (3.4 * PX))), cw = w / cols;
      for (let y = 10; y + fl * 0.7 < h - 4.4 * PX; y += fl) for (let c = 0; c < cols; c++) {
        const wx = c * cw + cw * 0.22, ww = cw * 0.56, hh = fl * 0.62, on = lit && r() < 0.6;
        x.fillStyle = on ? (r() < 0.5 ? "#ffcf7a" : "#ffe2a8") : "#1a1f2a"; x.fillRect(wx, y, ww, hh);
        x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(wx - 3, y, 3, hh); x.fillRect(wx + ww, y, 3, hh);   // shutters
        x.fillStyle = "rgba(255,255,255,0.18)"; x.fillRect(wx - 4, y + hh, ww + 8, 2); for (let q = wx - 2; q < wx + ww + 2; q += 5) x.fillRect(q, y + hh, 1.5, 6);   // balcony rail
      }
    } else if (kind === "warehouse") {
      // Warehouses: corrugated walls, a strip of high windows, a big loading door.
      const base = WARE_COL[Math.floor(r() * WARE_COL.length)]; x.fillStyle = base; x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(255,255,255,0.06)"; for (let q = 0; q < w; q += 7) x.fillRect(q, 0, 2, h); x.fillStyle = "rgba(0,0,0,0.18)"; for (let q = 4; q < w; q += 7) x.fillRect(q, 0, 2, h);
      for (let y = 10; y < h - 6 * PX; y += 5.5 * PX) for (let q = 8; q < w - 14; q += 22) { x.fillStyle = lit && r() < 0.55 ? "#ffd38a" : "#141a22"; x.fillRect(q, y, 14, 8); }
      const dw = Math.min(w * 0.5, 7 * PX), dx = (w - dw) / 2, dh = Math.min(h * 0.35, 4.5 * PX); x.fillStyle = "#22282f"; x.fillRect(dx, h - dh, dw, dh); x.fillStyle = "rgba(255,255,255,0.08)"; for (let q = h - dh; q < h; q += 6) x.fillRect(dx, q, dw, 2);
      x.fillStyle = "#f0c040"; x.fillRect(dx - 4, h - dh - 6, dw + 8, 3); x.fillStyle = "#222"; for (let q = dx - 4; q < dx + dw + 4; q += 10) x.fillRect(q, h - dh - 6, 5, 3);   // hazard stripe
    } else if (kind === "neon") {
      // Neon blocks: dark glass, bands of coloured light, glowing edges.
      x.fillStyle = "#0e0c1a"; x.fillRect(0, 0, w, h); const c1 = r() < 0.5 ? "90,220,255" : "255,90,210", c2 = r() < 0.5 ? "255,210,90" : "140,255,140";
      for (let y = 12; y < h - 8; y += 2.6 * PX) { x.fillStyle = lit ? `rgba(${r() < 0.5 ? c1 : c2},${0.25 + r() * 0.5})` : "rgba(60,60,90,0.35)"; x.fillRect(8, y, w - 16, 1.1 * PX); }
      x.fillStyle = `rgba(${c1},${lit ? 0.95 : 0.4})`; x.fillRect(0, 0, 3, h); x.fillRect(w - 3, 0, 3, h); x.fillRect(0, 0, w, 3);
    } else if (kind === "glass") {
      // Glass towers: a curtain wall of tall panes with the sky in them.
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#2a3a55"); g.addColorStop(0.5, "#16203a"); g.addColorStop(1, "#0c1222"); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const pw = 2.2 * PX, ph = 3.4 * PX; for (let y = 6; y < h; y += ph) for (let q = 4; q < w; q += pw) { if (lit && r() < 0.3) { x.fillStyle = "rgba(255,214,150,0.8)"; x.fillRect(q + 1, y + 1, pw - 3, ph - 3); } x.fillStyle = "rgba(160,200,255,0.18)"; x.fillRect(q, y, 1.5, ph); x.fillRect(q, y, pw, 1.5); }
      x.fillStyle = "rgba(255,255,255,0.12)"; x.beginPath(); x.moveTo(w * 0.1, 0); x.lineTo(w * 0.35, 0); x.lineTo(w * 0.05, h * 0.5); x.lineTo(0, h * 0.5); x.closePath(); x.fill();   // a sheen of sky
    }
  }
  // A facade with real detail: corner pilasters, a ledge every few floors, framed windows (some with
  // curtains or someone inside), a lit shopfront at street level, and a darker base. Drawn once.
  function paintFacade(x, w, h, st, lit, day, seed) {
    const r = seeded(Math.floor(seed * 1e6)), base = day ? st.day : st.base;
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    const sh = x.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, "rgba(255,255,255,0.06)"); sh.addColorStop(0.6, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.35)"); x.fillStyle = sh; x.fillRect(0, 0, w, h);
    // Pilasters at the corners.
    const pil = Math.max(4, w * 0.05); x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(0, 0, pil, h); x.fillStyle = "rgba(0,0,0,0.22)"; x.fillRect(w - pil, 0, pil, h);
    const fl = 3.4 * PX, shop = Math.min(h * 0.3, 4.2 * PX), cols = st.cols, mx = pil + 3, cw = (w - mx * 2) / cols;
    let floor = 0;
    for (let y = 8; y + fl * 0.6 < h - shop; y += fl, floor++) {
      if (floor % 4 === 3) { x.fillStyle = "rgba(255,255,255,0.07)"; x.fillRect(0, y - 4, w, 2); x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(0, y - 2, w, 2); }
      for (let c = 0; c < cols; c++) {
        const ww = cw * 0.64, hh = Math.min(fl * 0.52 * st.rows, fl * 0.64), wx = mx + c * cw + (cw - ww) / 2, on = lit && r() < 0.6, roll = r();
        x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(wx - 1.5, y - 1.5, ww + 3, hh + 3);                       // the frame's shadow
        if (on) {
          const g = x.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, st.lit); g.addColorStop(1, roll < 0.5 ? "#ffb066" : "#ffe4b8"); x.fillStyle = g; x.fillRect(wx, y, ww, hh);
          if (roll < 0.25) { x.fillStyle = "rgba(120,50,40,0.45)"; x.fillRect(wx, y, ww * 0.28, hh); x.fillRect(wx + ww * 0.72, y, ww * 0.28, hh); }   // curtains
          else if (roll < 0.36) { x.fillStyle = "rgba(40,25,20,0.75)"; x.beginPath(); x.arc(wx + ww * 0.5, y + hh * 0.48, hh * 0.16, 0, Math.PI * 2); x.fill(); x.fillRect(wx + ww * 0.38, y + hh * 0.62, ww * 0.24, hh * 0.38); }   // someone home
        } else {
          x.fillStyle = day ? "rgba(40,55,75,0.85)" : st.win; x.fillRect(wx, y, ww, hh);
          x.fillStyle = "rgba(170,200,255,0.07)"; x.beginPath(); x.moveTo(wx, y + hh); x.lineTo(wx + ww * 0.55, y); x.lineTo(wx + ww * 0.8, y); x.lineTo(wx + ww * 0.25, y + hh); x.fill();   // sky in the glass
        }
        x.fillStyle = "rgba(0,0,0,0.3)"; x.fillRect(wx + ww / 2 - 0.75, y, 1.5, hh); x.fillStyle = "rgba(255,255,255,0.1)"; x.fillRect(wx - 1, y + hh, ww + 2, 1.5);   // mullion and sill
      }
    }
    // Street level: a shopfront, lit when the building is.
    const sy = h - shop; x.fillStyle = "rgba(0,0,0,0.4)"; x.fillRect(0, sy, w, shop);
    const aw = ["#b8463a", "#2f7d6d", "#3b5fa8", "#a8783b", "#7a3ba8"][Math.floor(r() * 5)];
    x.fillStyle = aw; x.fillRect(pil, sy + 2, w - pil * 2, shop * 0.14); x.fillStyle = "rgba(255,255,255,0.18)"; for (let q = pil; q < w - pil; q += 10) x.fillRect(q, sy + 2, 5, shop * 0.14);
    const gx = pil + 4, gw = w - pil * 2 - 8, gy = sy + shop * 0.24, gh = shop * 0.62;
    if (lit) { const g = x.createLinearGradient(0, gy, 0, gy + gh); g.addColorStop(0, "#ffe7b8"); g.addColorStop(1, "#ffb874"); x.fillStyle = g; } else x.fillStyle = "#10141c";
    x.fillRect(gx, gy, gw, gh); x.fillStyle = "rgba(0,0,0,0.35)"; for (let q = 1; q < 4; q++) x.fillRect(gx + gw * q / 4 - 1, gy, 2, gh);
    x.fillStyle = "rgba(255,255,255,0.1)"; x.fillRect(0, 0, w, 3);
  }
  const bldImg = new Map();
  function imgFor(b, lit, day) {
    const key = b.n + (lit ? "L" : "D") + (day ? "d" : "n") + b.x0.toFixed(1) + (b.kind || "");
    let c = bldImg.get(key); if (c) return c;
    const w = (b.x1 - b.x0) * PX, h = b.h * PX, st = STYLE[b.style % STYLE.length];
    c = mk(w, h, (x) => (b.kind && b.kind !== "office" ? paintKind(x, w, h, b.kind, lit, day, b.seed || 0.5) : paintFacade(x, w, h, st, lit, day, b.seed || 0.5)));
    bldImg.set(key, c); if (bldImg.size > 90) bldImg.delete(bldImg.keys().next().value);
    return c;
  }
  // Background skyline: silhouettes with sparse warm windows, three layers of parallax.
  const LAYERS = [{ par: 0.22, sp: 22, h: [38, 100], haze: 0.55 }, { par: 0.5, sp: 14, h: [20, 55], haze: 0.26 }];
  const bgImg = new Map();
  // District silhouettes on the far skylines: pagoda roofs, harbour cranes, neon edges, a Ferris wheel, spires.
  function bgExtra(x, w, h, dist, li, r, lit) {
    const roll = r(), ink = "#0d1018";
    if (dist === 1 && roll < 0.7) { const eh = Math.min(34, h * 0.25); x.clearRect(0, 0, w, eh); x.fillStyle = ink; x.beginPath(); x.moveTo(-4, eh); x.quadraticCurveTo(w * 0.25, eh * 0.75, w / 2, 0); x.quadraticCurveTo(w * 0.75, eh * 0.75, w + 4, eh); x.closePath(); x.fill(); if (lit) { x.fillStyle = "rgba(255,150,70,0.9)"; x.fillRect(w / 2 - 3, eh + 6, 6, 8); } }
    else if (dist === 2 && roll < 0.4) { const top = h * 0.45; x.clearRect(0, 0, w, top); x.strokeStyle = ink; x.lineWidth = 6; x.beginPath(); x.moveTo(w * 0.15, top); x.lineTo(w * 0.35, 8); x.lineTo(w * 0.55, top); x.moveTo(0, 12); x.lineTo(w, 12); x.moveTo(w * 0.8, 12); x.lineTo(w * 0.8, top * 0.6); x.stroke(); if (lit) { x.fillStyle = "rgba(255,80,60,0.95)"; x.fillRect(w * 0.35 - 4, 2, 8, 8); } }
    else if (dist === 3) { x.fillStyle = roll < 0.5 ? "rgba(90,220,255,0.6)" : "rgba(255,90,210,0.6)"; x.fillRect(0, 0, 4, h); x.fillRect(w - 4, 0, 4, h); x.fillRect(0, 0, w, 4); }
    else if (dist === 4 && li === 1 && roll < 0.25) { const top = h * 0.7, cx = w / 2, rr = Math.min(w * 0.48, top * 0.48), cy = rr + 4; x.clearRect(0, 0, w, top); x.strokeStyle = ink; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); for (let q = 0; q < 8; q++) { x.moveTo(cx, cy); x.lineTo(cx + Math.cos(q * Math.PI / 4) * rr, cy + Math.sin(q * Math.PI / 4) * rr); } x.moveTo(cx, cy); x.lineTo(cx - rr * 0.5, top); x.moveTo(cx, cy); x.lineTo(cx + rr * 0.5, top); x.stroke(); if (lit) for (let q = 0; q < 12; q++) { x.fillStyle = "rgba(255,210,120,0.95)"; x.fillRect(cx + Math.cos(q * Math.PI / 6) * rr - 3, cy + Math.sin(q * Math.PI / 6) * rr - 3, 6, 6); } }
    else if (dist === 4 && roll < 0.5) { const top = h * 0.4; x.clearRect(0, 0, w, top); x.fillStyle = ink; x.beginPath(); x.ellipse(w / 2, top, w * 0.55, top * 0.9, 0, Math.PI, 0); x.fill(); }
    else if (dist === 5 && roll < 0.6) { const top = Math.min(60, h * 0.2); x.clearRect(0, 0, w, top); x.fillStyle = ink; x.fillRect(w * 0.25, top * 0.4, w * 0.5, top * 0.6); x.fillRect(w / 2 - 2, 0, 4, top * 0.4); if (lit) { x.fillStyle = "rgba(255,60,60,0.95)"; x.fillRect(w / 2 - 3, 0, 6, 6); } }
  }
  function bgFor(li, i, lit, dist = 0) {
    const key = li + ":" + i + (lit ? "L" : "D") + dist;
    let c = bgImg.get(key); if (c) return c;
    const r = seeded(i * 977 + li * 31), L = LAYERS[li], k = 10, w = L.sp * (0.6 + r() * 0.5) * k, h = (L.h[0] + r() * (L.h[1] - L.h[0])) * k * (dist === 5 ? 1.35 : dist === 1 || dist === 4 ? 0.7 : 1);
    c = mk(w, h, (x) => { x.fillStyle = "#0d1018"; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(0, 0, w, 2); const q = seeded(i * 13 + li); for (let y = 10; y < h; y += 11) for (let xx = 5; xx < w - 5; xx += 8) if (q() < (lit ? 0.32 : 0.05)) { x.fillStyle = lit ? `rgba(255,${200 + q() * 40},${130 + q() * 60},0.9)` : "rgba(255,210,150,0.3)"; x.fillRect(xx, y, 2, 3); }  bgExtra(x, w, h, dist, li, r, lit); });
    c.wM = w / k; c.hM = h / k; bgImg.set(key, c); if (bgImg.size > 300) bgImg.delete(bgImg.keys().next().value);
    return c;
  }
  const stars = Array.from({ length: 90 }, (_, q) => { const r = seeded(q * 7 + 3); return [r(), r() * 0.6, 0.5 + r() * 1.2, r() * 6]; });
  const hist = [];
  let cam = null, sCur = 24, skyC = null;
  // A searchlight beam, drawn once per colour: a narrow cone fading upward.
  const beams = [];
  const beam = q => beams[q] || (beams[q] = mk(64, 256, (x) => { const c = q ? "255,90,210" : "90,220,255"; const g = x.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, `rgba(${c},0.24)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.beginPath(); x.moveTo(30, 256); x.lineTo(34, 256); x.lineTo(64, 0); x.lineTo(0, 0); x.closePath(); x.fill(); }));
  const strips = [null, null];

  function draw(ctx, W, H, P) {
    const R = run, t = R.t, night = P.night, day = 1 - night, dayImg = night < 0.45;
    const beat = typeof beatPulse === "function" && !(save.settings && save.settings.calm) ? beatPulse() : 0;   // the music's kick, for things that pulse on the beat
    // A new run: forget the last run's scarf trail and camera.
    if (draw.lastR !== R) { hist.length = 0; cam = null; draw.lastR = R; draw.lt = null; }
    // ---------- Camera: frames you and your next anchor, zooms out a little with speed ----------
    const spd = R.v || 10, punch = save.settings && save.settings.calm ? 1 : 1 + 0.07 * Math.min(1, (R.ringT || 0) / 0.35) + 0.06 * Math.min(1, (R.perfT || 0) / 0.45), sTarget = H / (33 + Math.min(4, Math.max(0, spd - 18) * 0.25)) * punch;
    // Smoothing by time, not by frame, so it feels the same at 30 or 60 frames per second.
    const fdt = Math.min(0.1, Math.max(0, t - (draw.lt ?? t))); draw.lt = t; const ease = k => 1 - Math.exp(-k * fdt);
    sCur += (sTarget - sCur) * ease(punch > 1.01 ? 7 : 2.5); const s = sCur;
    const aim = R.teth || R.aim, halfW = W / 2 / s, halfH = H / 2 / s;
    // The figure sits a steady third from the left, a little ahead with speed; up and down follows
    // you, leaning gently toward the anchor you're heading for.
    let tx = R.px + halfW * 0.3 + Math.max(0, Math.min(25, R.vx)) * 0.08, ty = R.py + 3;
    if (aim) ty = ty * 0.8 + (aim.y - 3) * 0.2;
    // Arrived: the camera drifts over to their window.
    if (R.cleared && R.stageLen) { const k = Math.min(1, (t - (R.clearAt ?? t)) * 0.9); tx = tx + (R.stageLen + 9 - tx) * k; ty = ty + (17 - halfH * 0.4 - ty) * k; /* their roof (you) near the top, their window below it */ }
    if (!R.cleared) ty = Math.max(9, Math.min(60, ty));
    if (!cam || Math.abs(cam.x - tx) > 80) cam = { x: tx, y: ty };
    cam.x += (tx - cam.x) * ease(4); cam.y += (ty - cam.y) * ease(2.6);
    if (!R.cleared) { cam.x = Math.max(R.px + halfW * 0.1, Math.min(R.px + halfW * 0.6, cam.x)); cam.y = Math.max(R.py - halfH * 0.5, Math.min(R.py + halfH * 0.55, cam.y)); }
    const calm = !!(save.settings && save.settings.calm), sh = R.shake > 0 && !calm ? R.shake * 6 : 0, ox = W / 2 + (Math.random() - 0.5) * sh, oy = H / 2 + (Math.random() - 0.5) * sh + (calm ? 0 : (R.kick || 0) * 8);
    const X = x => ox + (x - cam.x) * s, Y = y => oy - (y - cam.y) * s;
    // ---------- Sky (baked into the far skyline strip below) ----------
    let sk = null; const skyCss = () => sk || (sk = P.sky.map(c => `rgb(${c.map(v => Math.round(v)).join(",")})`));
    // ---------- Skyline layers, hazier with distance; they wake as you pass ----------
    // Each layer is pre-drawn into a wide strip (with its haze) and only re-drawn when the view
    // moves past it, the zoom changes, the time of day changes or buildings light up.
    const distNow = district(R);
    let palKey = Math.round(night * 8) + (P.blackout ? 100 : 0) + distNow * 1000; for (const c of P.sky) palKey = palKey * 977 + ((c[0] >> 3) * 1089 + (c[1] >> 3) * 33 + (c[2] >> 3));
    const splitX = ox + (R.px - cam.x) * s;     // left of the figure: lit; right: still dark
    // The sky: one cached gradient, stretched to the screen; then the moon, so the skyline stands in front of it.
    if (!skyC || skyC.key !== palKey || skyC.height !== Math.ceil(H)) { const k3 = skyCss(); skyC = mk(1, H, (x) => { const gs = x.createLinearGradient(0, 0, 0, H); gs.addColorStop(0, k3[0]); gs.addColorStop(0.55, k3[1]); gs.addColorStop(1, k3[2]); x.fillStyle = gs; x.fillRect(0, 0, 1, H); }); skyC.key = palKey; }
    ctx.drawImage(skyC, 0, 0, W, H);
    if (night > 0.3) { ctx.globalAlpha = (night - 0.3) / 0.7; ctx.drawImage(glow(0xf6f3e6), W * 0.12, H * 0.06, W * 0.22, W * 0.22); ctx.fillStyle = "#f6f3e6"; ctx.beginPath(); ctx.arc(W * 0.23, H * 0.06 + W * 0.11, W * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(180,175,160,0.5)"; ctx.beginPath(); ctx.arc(W * 0.215, H * 0.06 + W * 0.1, W * 0.008, 0, Math.PI * 2); ctx.arc(W * 0.24, H * 0.06 + W * 0.12, W * 0.006, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    if (day > 0.3) { ctx.globalAlpha = day; ctx.drawImage(glow(0xfff2d8), W * 0.55, H * 0.02, W * 0.5, W * 0.5); ctx.globalAlpha = 1; }
    LAYERS.forEach((L, li) => {
      const camL = cam.x * L.par, sL = s * (0.45 + li * 0.18);
      let S = strips[li];
      const stale = !S || Math.abs(sL - S.sL) / S.sL > 0.1 || camL - S.x0 < (W * 0.2) / sL || S.x0 + S.wM - camL < (W * 1.2) / sL || S.key !== palKey;
      if (stale) {
        const sw = Math.ceil(W * 2.4), shh = Math.ceil(H * 1.5), x0 = camL - (W * 0.7) / sL;
        if (!S || S.c.width !== sw || S.c.height !== shh) S = strips[li] = { c: mk(sw, shh, () => {}), cl: mk(sw, shh, () => {}) };
        Object.assign(S, { sL, x0, wM: sw / sL, key: palKey });
        for (const lit of [false, true]) {
          const x = (lit ? S.cl : S.c).getContext("2d"); x.clearRect(0, 0, sw, shh);
          const base = shh - H * (0.12 - li * 0.04), start = Math.floor(x0 / L.sp) - 1, end = Math.ceil((x0 + sw / sL) / L.sp) + 1;
          for (let i = start; i <= end; i++) { const im = bgFor(li, i, lit && !P.blackout, distNow), w = im.wM * sL, h = im.hM * sL, sx = (i * L.sp - x0) * sL; x.drawImage(im, sx, base - h, w, h); }
          // The ground this layer stands on, all the way down: no building ever floats.
          x.fillStyle = "#0d1018"; x.fillRect(0, base - 1, sw, shh - base + 1);
          x.globalCompositeOperation = "source-atop"; x.globalAlpha = L.haze * (0.6 + day * 0.4); x.fillStyle = skyCss()[2]; x.fillRect(0, 0, sw, shh);
          // Ground fog: the bottoms of distant buildings melt into the haze.
          const fg = x.createLinearGradient(0, base - H * 0.3, 0, base + 2); fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, skyCss()[2]); x.globalAlpha = 0.55 + li * 0.1; x.fillStyle = fg; x.fillRect(0, base - H * 0.3, sw, shh - base + H * 0.3);
          x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
          if (li === 0) {
            // The sky and its stars go behind the far skyline: one solid image, no blending each frame.
            x.globalCompositeOperation = "destination-over";
            if (night > 0.35) { x.fillStyle = "#fff"; const rs = seeded(li * 17 + 5); for (let q = 0; q < 140; q++) { x.globalAlpha = (night - 0.35) * (0.4 + rs() * 0.6); x.fillRect(rs() * sw, rs() * shh * 0.55, 1 + rs(), 1 + rs()); } x.globalAlpha = 1; }
            x.globalCompositeOperation = "source-over";
          }
        }
      }
      // Copy only what's on screen: the lit part left of the figure, the dark part right of it.
      // Each layer's ground line sits where the world's ground would be at its depth (true parallax).
      const baseIn = S.c.height - H * (0.12 - li * 0.04), dx0 = (S.x0 - camL) * sL + W / 2, dy0 = Math.min(H * 0.25, oy + Math.min(cam.y, 45) * sL * 0.9 - baseIn), srcY = Math.max(0, -dy0), hh = Math.min(S.c.height - srcY, H - Math.max(0, dy0));
      if (dy0 + S.c.height < H) { ctx.fillStyle = skyCss()[2]; ctx.globalAlpha = 0.25; ctx.fillRect(0, dy0 + S.c.height - 1, W, H); ctx.globalAlpha = 1; ctx.fillStyle = "#0d1018"; ctx.globalAlpha = 0.8; ctx.fillRect(0, dy0 + S.c.height - 1, W, H); ctx.globalAlpha = 1; }
      if (hh <= 0) return;
      const seg = (img, xa, xb) => { xa = Math.max(0, xa); xb = Math.min(W, xb); if (xb - xa < 1) return; ctx.drawImage(img, xa - dx0, srcY, xb - xa, hh, xa, Math.max(0, dy0), xb - xa, hh); };
      seg(S.cl, 0, splitX); seg(S.c, splitX, W);
    });
    // ---------- District atmosphere (behind the play line) ----------
    // (Atmosphere is an extra: it switches off by itself as soon as the phone needs to drop quality.)
    const atmo = typeof pace === "undefined" || pace.d2 > 1.3;
    if (atmo) { const th = runnerTheme(R.px), tower = R.stageInfo && R.stageInfo.tower, calm = save.settings && save.settings.calm;
      if (th.neon > 0.8 && !calm) {
        // The Arcade: two searchlights sweeping the sky from below.
        ctx.globalCompositeOperation = "lighter";
        for (let q = 0; q < 2; q++) { const bx = W * (0.25 + q * 0.5), a = Math.sin(t * 0.5 + q * 2.2) * 0.55, len = H * 0.75, im = beam(q);
          ctx.save(); ctx.translate(bx, H); ctx.rotate(a); ctx.drawImage(im, -len * 0.07, -len, len * 0.14, len); ctx.restore(); }
        ctx.globalCompositeOperation = "source-over";
      }
      if (tower) {
        // The Tower: cloud wisps rushing past at height.
        ctx.globalAlpha = 0.2; for (let q = 0; q < 3; q++) { const r = seeded(q * 53 + 11), w = W * (0.5 + r() * 0.4), y = H * (0.1 + r() * 0.5), x = ((r() * W * 3 - (cam.x * s * (0.6 + r() * 0.3)) % (W * 3)) + W * 3) % (W * 3) - W; ctx.drawImage(glow([210, 220, 255]), x, y, w, H * 0.05); } ctx.globalAlpha = 1;
      }
    }
    // ---------- The street (and the harbour) ----------
    const gy = Y(0); if (gy < H + 6 * s) { const th = runnerTheme(R.px);
      if (th.water) { ctx.fillStyle = "#0f2d45"; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = "rgba(160,210,255,0.14)"; for (let q = 0; q < 7; q++) { const off = ((t * 18 + q * 37) % W); ctx.fillRect(off - W, gy + 5 + q * 8, W * 0.6, 1); ctx.fillRect(off, gy + 5 + q * 8, W * 0.4, 1); } }
      else {
        // Sidewalk and curb, then the wet road with the lamps' reflections.
        ctx.fillStyle = "#262a33"; ctx.fillRect(0, gy, W, 0.7 * s); ctx.fillStyle = "#3a404c"; ctx.fillRect(0, gy, W, 2);
        ctx.fillStyle = "#12151b"; ctx.fillRect(0, gy + 0.7 * s, W, H - gy); ctx.fillStyle = "rgba(255,255,255,0.18)"; const dash = 3 * s, off = -((cam.x * s) % (dash * 2)); for (let q = off; q < W; q += dash * 2) ctx.fillRect(q, gy + 2.2 * s, dash, 2);
      }
      // Street lamps every 16 m, with a pool of light (skipped where a building stands).
      const lx0 = Math.floor((cam.x - W / 2 / s) / 16) * 16;
      for (let lx = lx0; lx < cam.x + W / 2 / s + 16; lx += 16) { if (swingBldAt(R, lx)) continue; const px3 = X(lx), top3 = Y(6.5);
        ctx.strokeStyle = "#2c313b"; ctx.lineWidth = Math.max(2, 0.18 * s); ctx.beginPath(); ctx.moveTo(px3, gy); ctx.lineTo(px3, top3); ctx.lineTo(px3 + 1.2 * s, top3); ctx.stroke();
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.45 + night * 0.45; ctx.drawImage(glow([255, 214, 150]), px3 + 1.2 * s - 1.6 * s, top3 - 1.2 * s, 3.2 * s, 3.2 * s); ctx.globalAlpha = 0.18 + night * 0.2; ctx.drawImage(glow([255, 200, 130]), px3 - 3 * s, gy - 2 * s, 8 * s, 3.5 * s);
        if (!th.water) { ctx.globalAlpha = 0.12 + night * 0.12; ctx.drawImage(glow([255, 200, 130]), px3 + 0.4 * s, gy + 0.8 * s, 1.6 * s, 5 * s); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; } }
    // ---------- Play-line buildings ----------
    const glowHex = runnerGlow(), glowRGB = rgbOf(glowHex), glowCss = hex(glowHex);
    for (const b of R.blds) {
      const x0 = X(b.x0), x1 = X(b.x1); if (x1 < -20 || x0 > W + 20) continue;
      const top = Y(b.h), bot = Y(0), k = b.litT < 0 ? 0 : Math.min(1, b.litT / 0.9);
      if (b.tree) {
        ctx.fillStyle = "#4a3828"; ctx.fillRect((x0 + x1) / 2 - 0.5 * s, top + 1.5 * s, s, bot - top);
        ctx.fillStyle = dayImg ? "#4f8a3c" : "#20361d"; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, top + 1.5 * s, (x1 - x0) / 2, 2.6 * s, 0, 0, Math.PI * 2); ctx.fill();
        if (k > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = k * (0.4 + night * 0.6); const r = seeded(b.n); for (let q = 0; q < 10; q++) ctx.drawImage(glow([255, 220, 140]), x0 + r() * (x1 - x0) - 4, top + r() * 3 * s - 4, 8, 8); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
        continue;
      }
      ctx.drawImage(imgFor(b, false, dayImg), x0, top, x1 - x0, bot - top + 2);
      if (k > 0) { ctx.globalAlpha = k >= 1 ? 1 : Math.floor(k * 6) / 6; ctx.drawImage(imgFor(b, true, dayImg), x0, top, x1 - x0, bot - top + 2); ctx.globalAlpha = 1; }
      // Roof, rim of light, LED corners, the sweep.
      ctx.fillStyle = dayImg ? "#7d828c" : "#3a3f4a"; ctx.fillRect(x0 - 2, top - 3, x1 - x0 + 4, 4);
      if (k > 0) {
        ctx.fillStyle = glowCss; ctx.globalAlpha = k; ctx.fillRect(x0 - 2, top - 3, x1 - x0 + 4, 2); ctx.globalAlpha = k * 0.6; ctx.fillRect(x0, top, 2, bot - top); ctx.fillRect(x1 - 2, top, 2, bot - top); ctx.globalAlpha = 1;
        if (k < 1) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6; const yy = bot - (bot - top) * k; ctx.drawImage(glow([255, 236, 200]), x0, yy - 12, x1 - x0, 24); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
      }
      if (b.pad) { const hit = Math.max(0, 1 - (t - (b.padHit ?? -9)) * 3), pw2 = (x1 - x0) * 0.7, px5 = (x0 + x1) / 2; ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6 + b.n) + hit * 0.5; ctx.drawImage(glow([255, 90, 210]), px5 - pw2 / 2 - s, top - 3 - 1.6 * s, pw2 + 2 * s, 2.6 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ff7ad9"; ctx.fillRect(px5 - pw2 / 2, top - 3 - 0.35 * s - hit * 0.4 * s, pw2, 0.3 * s); ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(0.6 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("▲ ▲ ▲", px5, top - 3 - 0.8 * s); }
      // District rooftops.
      if (b.kind === "shop") { ctx.fillStyle = "#7a2f22"; ctx.fillRect(x0 - 0.3 * s, top - 3 - 0.45 * s, x1 - x0 + 0.6 * s, 0.6 * s); ctx.fillStyle = "#5a2018"; for (let q = x0 - 0.3 * s; q < x1 + 0.3 * s; q += 0.8 * s) { ctx.beginPath(); ctx.arc(q + 0.4 * s, top - 3 + 0.15 * s, 0.4 * s, 0, Math.PI); ctx.fill(); }
        const nb = R.blds[R.blds.indexOf(b) + 1]; if (nb && !nb.tree && nb.x0 - b.x1 < 16 && Math.abs(nb.h - b.h) < 8) { const ax2 = X(b.x1), ay2 = Y(b.h + 2.2), bx2 = X(nb.x0), by2 = Y(nb.h + 2.2), sag = 1.6 * s; ctx.strokeStyle = "rgba(60,40,30,0.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax2, ay2); ctx.quadraticCurveTo((ax2 + bx2) / 2, (ay2 + by2) / 2 + sag * 2, bx2, by2); ctx.stroke();
          ctx.globalCompositeOperation = "lighter"; for (let q = 1; q < 7; q++) { const u = q / 7, px6 = ax2 + (bx2 - ax2) * u, py6 = ay2 + (by2 - ay2) * u + sag * 4 * u * (1 - u); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + q + b.n); ctx.drawImage(glow(q % 2 ? [255, 170, 80] : [255, 90, 70]), px6 - 0.45 * s, py6 - 0.3 * s, 0.9 * s, 0.9 * s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; } }
      else if (b.kind === "warehouse") { ctx.fillStyle = dayImg ? "#6a707a" : "#252a33"; for (let q = 0; q < 3; q++) { const sx = X(b.x0 + (b.x1 - b.x0) * (0.15 + q * 0.28)); ctx.beginPath(); ctx.moveTo(sx, top - 3); ctx.lineTo(sx + 1.4 * s, top - 3 - 0.9 * s); ctx.lineTo(sx + 1.4 * s, top - 3); ctx.fill(); }
        if (b.n % 3 === 0) { const cx4 = X(b.x0 + (b.x1 - b.x0) * 0.7), ch = 7 * s; ctx.strokeStyle = "#c98a2a"; ctx.lineWidth = Math.max(2, 0.22 * s); ctx.beginPath(); ctx.moveTo(cx4, top - 3); ctx.lineTo(cx4, top - 3 - ch); ctx.lineTo(cx4 - 5 * s, top - 3 - ch); ctx.moveTo(cx4, top - 3 - ch); ctx.lineTo(cx4 + 1.5 * s, top - 3 - ch); ctx.moveTo(cx4 - 4 * s, top - 3 - ch); ctx.lineTo(cx4 - 4 * s, top - 3 - ch + 2.2 * s + Math.sin(t + b.n) * 0.3 * s); ctx.stroke(); ctx.fillStyle = "#ff4a3a"; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + b.n); ctx.fillRect(cx4 - 2, top - 3 - ch - 4, 4, 4); ctx.globalAlpha = 1; } }
      else if (b.kind === "neon" && b.h > 10 && b.n % 2 === 0) { const bw = Math.min(x1 - x0, 7 * s), bx3 = (x0 + x1) / 2 - bw / 2, by3 = top - 3 - 3.2 * s, col = b.n % 4 ? [255, 90, 210] : [90, 220, 255]; ctx.strokeStyle = "#2a2540"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx3 + bw * 0.25, top - 3); ctx.lineTo(bx3 + bw * 0.25, by3 + 2 * s); ctx.moveTo(bx3 + bw * 0.75, top - 3); ctx.lineTo(bx3 + bw * 0.75, by3 + 2 * s); ctx.stroke(); ctx.fillStyle = "#15122a"; ctx.fillRect(bx3, by3, bw, 2 * s);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 4 + b.n); ctx.drawImage(glow(col), bx3 - s, by3 - s, bw + 2 * s, 4 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2; ctx.strokeRect(bx3 + 2, by3 + 2, bw - 4, 2 * s - 4); ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(1.1 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(["PLAY", "WIN", "★ ★ ★", "HI-SCORE", "LUMEN"][b.n % 5], (x0 + x1) / 2, by3 + 1.4 * s); }
      else if (b.kind === "glass") { ctx.fillStyle = dayImg ? "#7d8696" : "#1a2236"; const cw2 = (x1 - x0) * 0.6; ctx.fillRect((x0 + x1) / 2 - cw2 / 2, top - 3 - 1.2 * s, cw2, 1.2 * s); ctx.fillRect((x0 + x1) / 2 - 1, top - 3 - 1.2 * s - 5 * s, 2, 5 * s); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + b.n); ctx.drawImage(glow([255, 70, 70]), (x0 + x1) / 2 - 0.6 * s, top - 3 - 6.8 * s, 1.2 * s, 1.2 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
      // Rooftop life: a water tank, an antenna or vents, a railing; a neon sign in livelier districts.
      if (!b.kind || b.kind === "office") { const r = seeded(b.n * 7919 + 3), kind = r(), wM = b.x1 - b.x0, dark = dayImg ? "#5b616c" : "#20242d", rim = dayImg ? "#9aa1ad" : "#3d4452";
        ctx.fillStyle = dark; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 0.12 * s);
        if (kind < 0.35 && wM > 8) { const tx = X(b.x0 + wM * (0.2 + r() * 0.5)), tw = 2.2 * s, th2 = 2.4 * s; ctx.fillRect(tx - tw / 2, top - 3 - th2 - 1.2 * s, tw, th2); ctx.fillStyle = rim; ctx.fillRect(tx - tw / 2, top - 3 - th2 - 1.2 * s, tw, 0.25 * s); ctx.beginPath(); ctx.moveTo(tx - tw / 2, top - 3 - th2 - 1.2 * s); ctx.lineTo(tx, top - 3 - th2 - 2 * s); ctx.lineTo(tx + tw / 2, top - 3 - th2 - 1.2 * s); ctx.fillStyle = dark; ctx.fill(); ctx.beginPath(); ctx.moveTo(tx - tw * 0.4, top - 3 - 1.2 * s); ctx.lineTo(tx - tw * 0.4, top - 3); ctx.moveTo(tx + tw * 0.4, top - 3 - 1.2 * s); ctx.lineTo(tx + tw * 0.4, top - 3); ctx.stroke(); }
        else if (kind < 0.6) { const ax = X(b.x0 + wM * (0.3 + r() * 0.5)), ah = (3 + r() * 4) * s; ctx.beginPath(); ctx.moveTo(ax, top - 3); ctx.lineTo(ax, top - 3 - ah); ctx.moveTo(ax - 0.5 * s, top - 3 - ah * 0.6); ctx.lineTo(ax + 0.5 * s, top - 3 - ah * 0.6); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + b.n); ctx.drawImage(glow([255, 60, 60]), ax - 0.6 * s, top - 3 - ah - 0.6 * s, 1.2 * s, 1.2 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
        else { for (let q = 0; q < 2; q++) { const vx = X(b.x0 + wM * (0.15 + q * 0.4 + r() * 0.2)); ctx.fillRect(vx, top - 3 - 0.9 * s, 1.4 * s, 0.9 * s); } }
        ctx.strokeStyle = rim; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, top - 3 - 0.7 * s); ctx.lineTo(x1, top - 3 - 0.7 * s); for (let q = x0; q <= x1; q += 0.9 * s) { ctx.moveTo(q, top - 3); ctx.lineTo(q, top - 3 - 0.7 * s); } ctx.stroke(); ctx.globalAlpha = 1;
        const th3 = runnerTheme(R.px); if (k > 0 && r() < th3.neon && b.h > 12) { const words = ["OPEN", "NOODLES", "HOTEL", "BAR", "24H", "ARCADE", "LUMEN", "CAFE"], word = words[Math.floor(r() * words.length)], nc = [[255, 80, 160], [80, 220, 255], [255, 210, 90], [140, 255, 120]][Math.floor(r() * 4)], ny = Y(b.h * (0.45 + r() * 0.35)), nx = X(b.x0) - 0.2 * s;
          ctx.save(); ctx.translate(nx, ny); ctx.rotate(-Math.PI / 2); ctx.font = `800 ${Math.round(0.95 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; const fl2 = Math.sin(t * 13 + b.n * 3) > -0.92 ? k : 0.3; ctx.globalAlpha = fl2 * 0.5; ctx.globalCompositeOperation = "lighter"; const tw2 = word.length * 0.7 * s; ctx.drawImage(glow(nc), -tw2 / 2 - s, -1.6 * s, tw2 + 2 * s, 2.4 * s); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = fl2; ctx.fillStyle = `rgb(${nc.map(v => Math.min(255, v + 60))})`; ctx.fillText(word, 0, 0); ctx.restore(); }
      }
    }
    // ---------- Hazards: live wires, drones ----------
    for (const z of R.haz) {
      if (z.kind === "wire") { const a = X(z.x0), b2 = X(z.x1), y = Y(z.y); if (b2 < 0 || a > W) continue; ctx.strokeStyle = "#20242e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b2, y); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; for (let q = 0; q < 3; q++) { const f = seeded(Math.floor(t * 14) + q)(); ctx.drawImage(glow([127, 216, 255]), a + f * (b2 - a) - 9, y - 9, 18, 18); } ctx.globalCompositeOperation = "source-over"; }
      else if (!z.dead) { const x = X(z.x), y = Y((z.y ?? z.y0) + 0.9); if (x < -30 || x > W + 30) continue; ctx.fillStyle = "#1f2430"; ctx.beginPath(); ctx.ellipse(x, y, 0.75 * s, 0.35 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#9aa2b0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 1.1 * s, y - 0.4 * s); ctx.lineTo(x + 1.1 * s, y - 0.4 * s); ctx.stroke(); ctx.drawImage(glow([255, 43, 74]), x - 0.8 * s, y - 0.8 * s, 1.6 * s, 1.6 * s); ctx.fillStyle = "#ff2b4a"; ctx.beginPath(); ctx.arc(x, y, 0.15 * s, 0, Math.PI * 2); ctx.fill();
        if (z.warn > 0.05) { ctx.globalAlpha = z.warn * (0.6 + 0.4 * Math.sin(t * 24)); ctx.strokeStyle = "#ff4d6a"; ctx.lineWidth = Math.max(2, 0.18 * s); ctx.beginPath(); ctx.arc(x, y, (1.6 + 0.3 * Math.sin(t * 24)) * s, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#ff8da0"; ctx.font = `800 ${Math.round(1.1 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("!", x, y - 1.9 * s); ctx.globalAlpha = 1; } }
    }
    // ---------- Updrafts: columns of rising air between the towers ----------
    for (const u of R.updrafts) { const ux0 = X(u.x0), ux1 = X(u.x1); if (ux1 < 0 || ux0 > W) continue; const g = ctx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, "rgba(160,220,255,0.10)"); g.addColorStop(1, "rgba(160,220,255,0)"); ctx.fillStyle = g; ctx.fillRect(ux0, 0, ux1 - ux0, H); ctx.strokeStyle = "rgba(200,235,255,0.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let q = 0; q < 10; q++) { const r = seeded(q * 97 + Math.floor(u.x0)), xx = ux0 + r() * (ux1 - ux0), yy = H - ((t * 260 + r() * H) % (H + 40)); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 22); } ctx.stroke(); }
    // ---------- Anchors ----------
    const best = !R.teth && R.aimOk ? R.aim : null;
    for (const a of R.anchors) {
      const x = X(a.x), y = Y(a.y + (a.broken ? -(a.fallY = (a.fallY || 0) + 0.3) : 0)); if (x < -40 || x > W + 40) continue;
      const col = a.tree ? [150, 255, 150] : a.type === "gold" ? [255, 210, 90] : a.type === "crumble" ? [255, 122, 61] : a.type === "drift" ? [127, 240, 255] : a.type === "spring" ? [141, 255, 106] : glowRGB, hot = a === best || a === R.teth;
      if (a.broken) { ctx.globalAlpha = 0.5; }
      if (a.off) { ctx.globalAlpha = 0.25; ctx.strokeStyle = "#8aa0c0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 0.6 * s, 0, Math.PI * 2); ctx.stroke(); if (Math.sin(t * 40 + a.id) > 0.85) { ctx.globalAlpha = 0.9; ctx.drawImage(glow([200, 230, 255]), x - 0.8 * s, y - 0.8 * s, 1.6 * s, 1.6 * s); } ctx.globalAlpha = 1; continue; }
      // A mast to the roof below, if there is one.
      if (a.sway) { const pvx = X(a.bx), pvy = Y(a.by + 4); ctx.strokeStyle = "rgba(200,170,120,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pvx, 0); ctx.lineTo(pvx, pvy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = "#c9a46a"; ctx.fillRect(pvx - 2, pvy - 2, 4, 4); ctx.fillStyle = "rgba(255,120,60,0.85)"; ctx.beginPath(); ctx.ellipse(x, y + 0.9 * s, 0.55 * s, 0.75 * s, 0, 0, Math.PI * 2); ctx.fill(); }
      const below = a.sway || a.tree ? null : R.blds.find(q => !q.tree && a.x >= q.x0 && a.x <= q.x1); if (below && a.y - below.h < 22) { ctx.strokeStyle = "#2b2f38"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Y(below.h)); ctx.stroke(); }
      if (a.kind === "balloon" && !below) { ctx.fillStyle = ["#ff5a6e", "#ffbe3c", "#5ac8ff", "#aa78ff"][a.id % 4]; ctx.beginPath(); ctx.ellipse(x, y - 2.8 * s, 1.3 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 1.2 * s); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.globalCompositeOperation = "lighter"; const gsz = (hot ? 3.4 : 2.4) * s * (1 + beat * 0.22); ctx.drawImage(glow(col), x - gsz / 2, y - gsz / 2, gsz, gsz); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 0.38 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = css(col); ctx.globalAlpha = (a.broken ? 0.5 : 1) * (hot ? 0.95 : 0.45); ctx.lineWidth = hot ? 2.5 : 1.5; ctx.beginPath(); ctx.arc(x, y, (hot ? 1 + 0.12 * Math.sin(t * 8) : 0.85) * s, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = a.broken ? 0.5 : 1;
      if (a.type === "crumble" && a === R.teth) { ctx.strokeStyle = "#3a1408"; ctx.lineWidth = 2; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(q * 2.1) * 0.4 * s, y + Math.sin(q * 2.1) * 0.4 * s); ctx.stroke(); } }
      if (a.type === "spring") { ctx.strokeStyle = "#8dff6a"; ctx.lineWidth = 2; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.ellipse(x, y + (0.7 + q * 0.3) * s, 0.35 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.globalAlpha = 1;
    }
    // ---------- The aim line: exactly the anchor a press will grab ----------
    if (R.aim && !R.attract) {
      const a = R.aim, ax = X(a.x), ay = Y(a.y), fx = X(R.px), fy = Y(R.py + 1.2);
      if (!R.teth) {
        ctx.save(); ctx.lineCap = "round";
        if (R.aimOk) { ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1.5, 0.12 * s); ctx.setLineDash([0.5 * s, 0.45 * s]); ctx.lineDashOffset = -t * 2.2 * s; }
        else { ctx.strokeStyle = "rgba(170,180,200,0.3)"; ctx.lineWidth = Math.max(1, 0.08 * s); ctx.setLineDash([0.2 * s, 0.6 * s]); }
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(ax, ay); ctx.stroke(); ctx.restore();
      }
      // The target's ring: bright and pulsing when a press will grab it, a thin grey ring when it's out of reach.
      ctx.strokeStyle = R.teth ? "rgba(255,255,255,0.35)" : R.aimOk ? "#ffffff" : "rgba(170,180,200,0.55)"; ctx.lineWidth = R.aimOk && !R.teth ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(ax, ay, (R.aimOk && !R.teth ? 1.7 + 0.15 * Math.sin(t * 9) : 1.45) * s, 0, Math.PI * 2); ctx.stroke();
      if (R.fizzle > 0) { ctx.globalAlpha = Math.min(1, R.fizzle * 3); ctx.strokeStyle = "#ff5a6e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, (2.4 - R.fizzle) * s, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#ff8a9a"; ctx.textAlign = "center"; ctx.font = `800 ${Math.round(0.9 * s)}px Inter, system-ui, sans-serif`; ctx.fillText(R.aimWhy === "below" ? "Below you" : "Too far", ax, ay - 2.3 * s); ctx.globalAlpha = 1; }
    }
    // ---------- Lights, shards, power-ups, letters ----------
    ctx.globalCompositeOperation = "lighter";
    for (const c of R.motes) { const x = X(c.x), y = Y(c.y); if (x < -20 || x > W + 20) continue; const k = c.got ? 1 - c.t / 0.35 : 1, sz = 1.3 * s * k * (1 + beat * 0.25); ctx.drawImage(glow([255, 194, 61]), x - sz, y - sz, sz * 2, sz * 2); }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffe08a"; for (const c of R.motes) { if (c.got) continue; const x = X(c.x), y = Y(c.y + Math.sin(t * 3 + c.x) * 0.1); if (x < -20 || x > W + 20) continue; const r2 = 0.28 * s; ctx.beginPath(); ctx.moveTo(x, y - r2); ctx.lineTo(x + r2 * 0.7, y); ctx.lineTo(x, y + r2); ctx.lineTo(x - r2 * 0.7, y); ctx.fill(); }
    for (const u of R.ups) {
      const x = X(u.x), y = Y(u.y + Math.sin(t * 3) * 0.2); if (x < -40 || x > W + 40) continue;
      const col = u.kind === "shard" ? [176, 140, 255] : u.kind === "letter" ? [255, 210, 90] : RUNNER_POWERS[u.kind].rgb.split(",").map(Number);
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glow(col), x - 2.2 * s, y - 2.2 * s, 4.4 * s, 4.4 * s); ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = css(col); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 0.9 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `800 ${Math.round(0.95 * s)}px Inter, system-ui, sans-serif`;
      ctx.fillText(u.kind === "letter" ? u.ch : u.kind === "shard" ? "◆" : { magnet: "✧", shield: "◯", comet: "☄" }[u.kind] || "✦", x, y + 1);
    }
    ctx.textBaseline = "alphabetic";
    if (!R.teth) R.pNow = false;
    // A splash in the harbour: a crown of spray and spreading rings.
    if (R.splash) { const k = R.splash.t / 0.9, sx2 = X(R.splash.x), sy2 = Y(0); ctx.strokeStyle = `rgba(170,225,255,${0.7 * (1 - k)})`; ctx.lineWidth = 2; for (let q = 0; q < 2; q++) { ctx.beginPath(); ctx.ellipse(sx2, sy2 + 3, (1 + k * 6 + q * 2) * s, (0.25 + k * 0.6) * s, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = `rgba(200,235,255,${0.8 * (1 - k)})`; for (let q = 0; q < 9; q++) { const a = Math.PI * (0.15 + 0.7 * q / 8), v = 9 + (q % 3) * 3, tt = R.splash.t; const px4 = sx2 + Math.cos(a) * v * tt * s * 0.5, py4 = sy2 - (Math.sin(a) * v * tt - 14 * tt * tt) * s * 0.5; if (py4 <= sy2 + 2) { ctx.beginPath(); ctx.arc(px4, py4, 0.22 * s, 0, Math.PI * 2); ctx.fill(); } } }
    // Landing dust on a rooftop.
    if (R.dust) { const k = R.dust.t / 0.5, dx2 = X(R.dust.x), dy2 = Y(R.dust.y); ctx.fillStyle = `rgba(200,210,230,${0.35 * (1 - k) * R.dust.k})`; for (let q = -1; q <= 1; q += 2) { ctx.beginPath(); ctx.ellipse(dx2 + q * (0.6 + k * 2.2) * s, dy2 - 0.3 * s, (0.5 + k * 0.8) * s, (0.3 + k * 0.3) * s, 0, 0, Math.PI * 2); ctx.fill(); } }
    // ---------- The trajectory: where you'd fly if you let go now (gold when it's a Perfect) ----------
    if (R.teth && !R.attract) {
      const ang = Math.atan2(R.vy, R.vx) * 180 / Math.PI, sp2 = Math.hypot(R.vx, R.vy), pw = perfectWindow(R), perfect = R.vx > 2.5 && ang > pw[0] && ang < pw[1] && sp2 > pw[2]; R.pNow = perfect;
      let px = R.px, py = R.py + 1, vx = R.vx * (perfect ? 1.1 : 1), vy = R.vy * (perfect ? 1.1 : 1);
      ctx.fillStyle = perfect ? "#ffd25a" : "rgba(255,255,255,0.75)";
      for (let q = 1; q <= 14; q++) { for (let k2 = 0; k2 < 4; k2++) { vy -= SWING.G * 0.02; px += vx * 0.02; py += vy * 0.02; } if (py < 0) break; ctx.globalAlpha = (1 - q / 15) * 0.8; ctx.beginPath(); ctx.arc(X(px), Y(py), Math.max(1.5, 0.13 * s * (1 - q / 20)), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // ---------- Boost rings and wind ----------
    for (const b of R.boosts) {
      const x = X(b.x), y = Y(b.y); if (x < -60 || x > W + 60) continue;
      const k = b.got ? 1 - b.t / 0.6 : 1, rr = b.r * s * (b.got ? 1 + b.t * 2 : 1 + Math.sin(t * 5 + b.x) * 0.04);
      ctx.globalAlpha = k; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glow([127, 240, 255]), x - rr * 1.4, y - rr * 1.4, rr * 2.8, rr * 2.8); ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#bff6ff"; ctx.lineWidth = Math.max(2, 0.2 * s); ctx.beginPath(); ctx.ellipse(x, y, rr * 0.45, rr, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#7ff0ff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, rr * 0.3, rr * 0.82, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const w of R.winds) {
      const a = X(w.x0), b2 = X(w.x1); if (b2 < 0 || a > W) continue;
      ctx.strokeStyle = "rgba(220,235,255,0.22)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let q = 0; q < 16; q++) { const r2 = seeded(q * 13 + Math.floor(w.x0)), yy = r2() * H, sp = w.f > 0 ? 1 : -1, len = 26 + r2() * 30, xx = a + (((r2() * (b2 - a) + t * 260 * sp) % (b2 - a)) + (b2 - a)) % (b2 - a); ctx.moveTo(xx, yy); ctx.lineTo(xx + len * sp, yy); }
      ctx.stroke();
    }
    // ---------- Bursts ----------
    for (const bu of R.bursts) { const q = bu.t / 0.8, col = bu.c != null ? rgbOf(bu.c) : glowRGB; ctx.strokeStyle = `rgba(${col.join(",")},${0.9 * (1 - q)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(bu.x), Y(bu.y), ((bu.big ? 1 : 0.5) + q * (bu.big ? 5 : 2.5)) * s, 0, Math.PI * 2); ctx.stroke(); }
    for (const b of R.blds) if (b.litT >= 0 && b.litT < 0.8 && !b.tree) { const q = b.litT / 0.8; ctx.strokeStyle = `rgba(${glowRGB.join(",")},${0.7 * (1 - q)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc((X(b.x0) + X(b.x1)) / 2, Y(b.h * 0.6), (1 + q * (b.x1 - b.x0) * 0.9) * s, 0, Math.PI * 2); ctx.stroke(); }
    // ---------- The tether ----------
    const hx = X(R.px), hy = Y(R.py + 2.1);
    if (R.teth) {
      // The rope shoots out to the anchor (a quick 80 ms), glows brighter and pulses inward while you reel in.
      const bc = (RUNNER_BOARDS[runnerLook().board] || RUNNER_BOARDS[0]).c, tc = bc === "prism" ? `hsl(${(t * 140) % 360},90%,65%)` : hex(bc), fo = Math.min(1, (R.tethT || 0) / 0.08), ax = hx + (X(R.teth.x) - hx) * fo, ay = hy + (Y(R.teth.y) - hy) * fo;
      const reeling = R.hold && R.tethT > 0.12 && R.L > SWING.LMIN + 0.05;
      ctx.strokeStyle = tc; ctx.globalAlpha = reeling ? 0.55 : 0.3; ctx.lineWidth = (reeling ? 0.7 : 0.45) * s; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, 0.12 * s); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.globalCompositeOperation = "lighter"; for (let q = 0; q < 4; q++) { const f = reeling ? 1 - (t * 3.2 + q / 4) % 1 : (t * 1.8 + q / 4) % 1; ctx.globalAlpha = Math.sin(f * Math.PI); ctx.drawImage(glow(rgbOf(bc === "prism" ? 0xffffff : bc)), hx + (ax - hx) * f - 0.5 * s, hy + (ay - hy) * f - 0.5 * s, s, s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    // A rope you let go of whips back to your hand.
    if (R.snap && !R.teth) { const k = R.snap.t / 0.14; if (k < 1) { const ax = X(R.snap.x), ay = Y(R.snap.y), ex = ax + (hx - ax) * k, ey = ay + (hy - ay) * k; ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.5, 0.1 * s); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = 1; } }
    // ---------- The scarf: a ribbon of light from the shoulders ----------
    const scf = RUNNER_SHOES[runnerLook().shoe] || RUNNER_SHOES[0], N = Math.min(40, scf.len);
    { const e = hist.length >= 48 ? hist.pop() : [0, 0]; e[0] = R.px; e[1] = R.py + 1.75; hist.unshift(e); }
    // On a Perfect chain of 3 or more, the scarf burns gold.
    const zone = (R.pChain || 0) >= 3 && !R.cleared, scCol = zone ? [255, 205, 90] : R.od > 0 || scf.c === "prism" ? null : rgbOf(scf.c ?? glowHex);
    ctx.globalCompositeOperation = "lighter";
    for (let q = 0; q < Math.min(N, hist.length) - 1; q++) {
      const a = hist[q], b = hist[q + 1], k = q / N, w = scf.w * s * (1 - k) * (0.6 + 0.4 * Math.sin(t * 9 - q * 0.5)), yo = Math.sin(t * 7 - q * 0.45) * 0.12 * k * s;
      const col = scCol || (() => { const h = (t * 100 + q * 10) % 360; return [Math.round(128 + 127 * Math.cos(h * Math.PI / 180)), Math.round(128 + 127 * Math.cos((h - 120) * Math.PI / 180)), Math.round(128 + 127 * Math.cos((h + 120) * Math.PI / 180))]; })();
      ctx.fillStyle = css(col); ctx.globalAlpha = (1 - k) * 0.85;
      ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1]) + yo - w / 2); ctx.lineTo(X(b[0]), Y(b[1]) + yo - w / 2); ctx.lineTo(X(b[0]), Y(b[1]) + yo + w / 2); ctx.lineTo(X(a[0]), Y(a[1]) + yo + w / 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // Afterimages on a dash, a Perfect or a ring.
    if (R.dashT > 0 || R.perfT > 0.2 || R.ringT > 0) { ctx.globalCompositeOperation = "lighter"; for (let q = 3; q < 13 && q < hist.length; q += 3) { const e = hist[q]; ctx.globalAlpha = 0.35 * (1 - q / 13); const z = 2.4 * s; ctx.drawImage(glow(glowRGB), X(e[0]) - z / 2, Y(e[1] - 0.6) - z / 2, z, z); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
    // ---------- The being of light ----------
    const blink = R.inv > 0.3 && Math.floor(R.inv * 12) % 2;
    if (R.shatter) { ctx.globalCompositeOperation = "lighter"; for (const q of R.shatter) { const z = 0.9 * s; ctx.drawImage(glow(glowRGB), X(q.x) - z / 2, Y(q.y) - z / 2, z, z); } ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#fff"; for (const q of R.shatter) ctx.fillRect(X(q.x) - 1.5, Y(q.y) - 1.5, 3, 3); }
    if (!blink && !R.shatter) {
      const auraC = R.pNow ? [255, 214, 90] : R.od > 0 ? [255, 194, 61] : R.power ? RUNNER_POWERS[R.power.kind].rgb.split(",").map(Number) : glowRGB, asz = (R.pNow ? 6.5 + Math.sin(t * 20) * 0.4 : R.od > 0 ? 6 : R.dashT > 0 ? 5.5 : 4.5) * s;
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 + night * 0.3; ctx.drawImage(glow(auraC), hx - asz / 2, Y(R.py + 1.2) - asz / 2, asz, asz); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const ch = RUNNER_CHARS[runnerLook().char] || RUNNER_CHARS[0], core = hex(ch.look.core), u = 1.55 * s, p = R.phase, sn = Math.sin(p);
      // Pose: hips, chest, head, hands, feet (metres around the figure's centre), then rotated.
      let rot = 0, armA = [-0.5, -0.3], armB = [0.5, -0.3], legA = [-0.25, -0.95], legB = [0.25, -0.95];
      if (R.teth) { const ang = Math.atan2(R.teth.y - R.py - 1.4, R.teth.x - R.px); rot = (ang - Math.PI / 2) * 0.6; armB = [0.1, 1.15]; armA = [-0.45, 0.1]; legA = [-0.35, -0.95]; legB = [0.05, -1]; }
      else if (R.roof && R.roof.home) { const w = Math.sin(t * 6) * 0.15; armA = [-0.55, 0.75 + w]; armB = [0.55, 0.75 - w]; legA = [-0.25, -0.95]; legB = [0.25, -0.95]; rot = 0; }
      else if (R.roof) { armA = [-0.4 * sn - 0.1, -0.2]; armB = [0.4 * sn + 0.1, -0.2]; legA = [-0.45 * sn, -0.95 + Math.max(0, sn) * 0.2]; legB = [0.45 * sn, -0.95 + Math.max(0, -sn) * 0.2]; rot = -0.2; }
      // In the air: lean into the flight; a Perfect is one clean front flip, not a tumble.
      else { const fk = R.flipT > 0 ? 1 - R.flipT / 0.5 : 1, flip = R.flipT > 0 ? Math.PI * 2 * (fk * fk * (3 - 2 * fk)) : 0; rot = -0.55 * Math.max(-0.4, Math.min(1, R.vx / 24)) + 0.25 * Math.max(-1, Math.min(1, R.vy / 20)) - flip; const tk = R.flipT > 0 ? Math.sin(fk * Math.PI) : 0; armA = [-0.55, 0.35 * (1 - tk)]; armB = [0.55, 0.35 * (1 - tk)]; legA = [-0.3, -0.95 + tk * 0.45]; legB = [0.3, -0.95 + tk * 0.45]; }
      if (R.over) rot += t * 6;
      const cx = hx, cy = Y(R.py + 1.1), cr = Math.cos(rot), sr = Math.sin(rot), P2 = (dx, dy) => [cx + (dx * cr - dy * sr) * u, cy - (dx * sr + dy * cr) * u];
      const hip = P2(0, -0.15), chest = P2(0, 0.45), head = P2(0, 0.85), sh = P2(0, 0.38);
      // A body of light, in three passes: a soft coloured halo, the bright body, a white-hot inner line.
      const limbs = (k) => {
        ctx.lineWidth = 0.2 * u * k; for (const [ex, ey] of [legA, legB]) { const k2 = P2(ex * 0.6, (ey - 0.15) * 0.5 - 0.1), f = P2(ex, ey - 0.15); ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(k2[0], k2[1]); ctx.lineTo(f[0], f[1]); ctx.stroke(); }
        ctx.lineWidth = 0.32 * u * k; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(chest[0], chest[1]); ctx.stroke();
        ctx.lineWidth = 0.15 * u * k; for (const [ex, ey] of [armA, armB]) { const e = P2(ex * 0.5, 0.38 + ey * 0.45), hnd = P2(ex, 0.38 + ey); ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hnd[0], hnd[1]); ctx.stroke(); }
      };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(${auraC.join(",")},0.28)`; limbs(2.6); ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = core; limbs(1);
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; limbs(0.35);
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, 0, Math.PI * 2); ctx.fill();
      // A small heart of light in the chest, beating.
      { const hb = P2(0, 0.22), beat = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 7)), 6), hz = (0.35 + beat * 0.25) * u; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glow(auraC), hb[0] - hz, hb[1] - hz, hz * 2, hz * 2); ctx.globalCompositeOperation = "source-over"; }
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glow(0xffffff), head[0] - 0.5 * u, head[1] - 0.5 * u, u, u); ctx.globalCompositeOperation = "source-over";
      if (R.power && R.power.kind === "shield") { ctx.strokeStyle = "rgba(90,210,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 1.5 * u, 0, Math.PI * 2); ctx.stroke(); }
    }
    // The finish: a soft column of gold light where their street begins (no sign, no line).
    if (R.stageLen) { const fx = X(R.stageLen); if (fx > -60 && fx < W + 60 && !R.cleared) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.08; ctx.drawImage(glow([255, 210, 90]), fx - 2 * s, -H * 0.2, 4 * s, H * 1.4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
      // Their home, just past the finish: a dark window with someone waiting, which lights up warm when you arrive.
      const hx0 = X(R.stageLen + 3), hx1 = X(R.stageLen + 15);
      if (hx1 > -20 && hx0 < W + 20) {
        const lit = R.cleared ? Math.max(0, Math.min(1, (t - (R.clearAt ?? t) - 0.65) * 2.5)) : 0, top = Y(17), base = Y(0);
        ctx.fillStyle = "#151925"; ctx.fillRect(hx0, top, hx1 - hx0, base - top); ctx.fillStyle = "#1e2433"; ctx.fillRect(hx0 - 0.4 * s, top - 0.5 * s, hx1 - hx0 + 0.8 * s, 0.5 * s);
        const wx0 = X(R.stageLen + 6.5), wx1 = X(R.stageLen + 11.5), wy0 = Y(13.5), wy1 = Y(9);
        if (lit > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = lit; ctx.drawImage(glow([255, 200, 120]), wx0 - 4 * s, wy0 - 4 * s, wx1 - wx0 + 8 * s, wy1 - wy0 + 8 * s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
        ctx.fillStyle = lit > 0 ? `rgba(255,${190 + 30 * lit},${110 + 40 * lit},${0.35 + 0.65 * lit})` : "#0a0c12"; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
        ctx.strokeStyle = "#2a3040"; ctx.lineWidth = Math.max(1.5, 0.15 * s); ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0); ctx.beginPath(); ctx.moveTo((wx0 + wx1) / 2, wy0); ctx.lineTo((wx0 + wx1) / 2, wy1); ctx.stroke();
        // Your light flies into their window: a comet along an arc, then a burst as it lands.
        if (R.cleared && R.clearFrom) { const k = Math.min(1, (t - R.clearAt) / 0.65), e = k * k * (3 - 2 * k), tx2 = R.stageLen + 9, ty2 = 11.25, cx3 = R.clearFrom.x + (tx2 - R.clearFrom.x) * e, cy3 = R.clearFrom.y + (ty2 - R.clearFrom.y) * e + Math.sin(e * Math.PI) * 5;
          ctx.globalCompositeOperation = "lighter";
          if (k < 1) { for (let q = 0; q < 8; q++) { const kk = Math.max(0, e - q * 0.035), qx = R.clearFrom.x + (tx2 - R.clearFrom.x) * kk, qy = R.clearFrom.y + (ty2 - R.clearFrom.y) * kk + Math.sin(kk * Math.PI) * 5, z = (2.4 - q * 0.25) * s; ctx.globalAlpha = 1 - q / 8; ctx.drawImage(glow([255, 220, 150]), X(qx) - z / 2, Y(qy) - z / 2, z, z); } }
          else { const bk = Math.min(1, (t - R.clearAt - 0.65) / 0.5); if (bk < 1) { ctx.globalAlpha = 1 - bk; const z = (3 + bk * 10) * s; ctx.drawImage(glow([255, 230, 170]), X(tx2) - z / 2, Y(ty2) - z / 2, z, z); } }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
        // The person at the window (waving once the light is back).
        const px2 = X(R.stageLen + 8.2), py2 = wy1; ctx.fillStyle = lit > 0 ? "#3a2a1c" : "rgba(120,130,160,0.35)";
        ctx.beginPath(); ctx.arc(px2, py2 - 2.6 * s, 0.55 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(px2 - 0.6 * s, py2 - 2 * s, 1.2 * s, 2 * s);
        if (lit > 0) { const wv = Math.sin(t * 9) * 0.5; ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 0.28 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(px2 + 0.5 * s, py2 - 1.8 * s); ctx.lineTo(px2 + (1.2 + wv * 0.3) * s, py2 - (3 + wv) * s); ctx.stroke(); }
        { ctx.font = `700 ${Math.round(0.75 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = lit > 0 ? "#ffd98a" : "rgba(200,210,235,0.7)"; ctx.fillText(stagePerson(R.stageInfo.n)[0], (wx0 + wx1) / 2, wy0 - 1.1 * s); }
      }
    }
    // A ghost: your best run (or a friend's) on this stage, see-through.
    const gp = R.ghostTrace && !R.attract ? stageGhostAt(R.ghostTrace, R.stageT || 0) : null;
    if (gp) { const gx = X(gp[0]), gyy = Y(gp[1] + 1.1); ctx.globalAlpha = 0.5; ctx.drawImage(glow([159, 232, 255]), gx - 1.6 * s, gyy - 1.6 * s, 3.2 * s, 3.2 * s); ctx.strokeStyle = "rgba(200,240,255,0.8)"; ctx.lineWidth = 0.18 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(gx, gyy - 0.9 * s); ctx.lineTo(gx, gyy + 0.6 * s); ctx.stroke(); ctx.beginPath(); ctx.arc(gx, gyy - 1.25 * s, 0.3 * s, 0, Math.PI * 2); ctx.fillStyle = "rgba(220,245,255,0.85)"; ctx.fill(); ctx.font = `700 ${Math.round(0.6 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(R.ghostLabel || "GHOST", gx, gyy - 2 * s); ctx.globalAlpha = 1; }
    // Ghost of today's best daily run.
    const gv = R.ghost && !R.attract ? R.ghost[Math.floor(Math.max(0, R.px)) + 6] : null;
    if (gv != null) { ctx.globalAlpha = 0.45; ctx.drawImage(glow([159, 232, 255]), X(R.px + 6) - s, Y(gv + 1) - s, 2 * s, 2 * s); ctx.globalAlpha = 1; }
    // ---------- The darkness: a wall of shadow with smoke and violet lightning ----------
    const dx = X(R.darkX);
    if (dx > -W * 0.2) {
      const gr = ctx.createLinearGradient(dx - 3 * s, 0, dx + 2 * s, 0); gr.addColorStop(0, "rgba(6,2,16,0.97)"); gr.addColorStop(1, "rgba(16,6,36,0)");
      ctx.fillStyle = "rgba(6,2,16,0.97)"; ctx.fillRect(0, 0, Math.max(0, dx - 3 * s), H); ctx.fillStyle = gr; ctx.fillRect(Math.max(0, dx - 3 * s), 0, 5 * s, H);
      for (let q = 0; q < 7; q++) { const a = t * (0.4 + q * 0.05) + q, sz = (6 + Math.sin(a * 2) * 2) * s; ctx.drawImage(smoke, dx + Math.sin(a) * 2 * s - sz / 2, (q / 7) * H + Math.cos(a * 1.3) * 2 * s - sz / 2, sz, sz); }
      if (Math.random() < 0.04) { ctx.strokeStyle = "rgba(201,168,255,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); let bx = dx, by = 0; ctx.moveTo(bx, by); for (let q = 0; q < 8; q++) { bx += (Math.random() - 0.3) * 30; by += H / 8; ctx.lineTo(bx, by); } ctx.stroke(); }
      if (R.ev && R.ev.kind === "heart") { const hx2 = dx + 2 * s, hy2 = Y(R.py + 2 + Math.sin(t * 1.3) * 1.5), r2 = (4.5 * (1 - R.ev.hits * 0.18)) * s * 0.6; ctx.drawImage(glow([138, 61, 255]), hx2 - r2 * 2, hy2 - r2 * 2, r2 * 4, r2 * 4); ctx.fillStyle = "#07030f"; ctx.beginPath(); ctx.arc(hx2, hy2, r2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d9b8ff"; ctx.beginPath(); ctx.arc(hx2 + r2 * 0.4, hy2 - r2 * 0.1, r2 * 0.2, 0, Math.PI * 2); ctx.fill(); }
    }
    // ---------- District atmosphere (in front) ----------
    if (atmo) { const th = runnerTheme(R.px), view0 = cam.x - W / 2 / s;
      if (th.park) {
        // The Park: fireflies drifting and blinking.
        ctx.globalCompositeOperation = "lighter";
        for (let q = 0; q < 16; q++) { const r = seeded(q * 31 + 7), wx = view0 + ((r() * 120 + q * 9) % (W / s + 10)), wy = 3 + r() * 22 + Math.sin(t * (0.6 + r()) + q) * 1.5, k = Math.max(0, Math.sin(t * (1.5 + r() * 2) + q * 1.7)); if (k < 0.1) continue; const sz = (0.6 + k * 0.6) * s; ctx.globalAlpha = k; ctx.drawImage(glow([200, 255, 120]), X(wx + Math.sin(t * 0.7 + q) * 1.2) - sz / 2, Y(wy) - sz / 2, sz, sz); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      } else if (th.anchor === "lantern") {
        // The Markets: warm embers rising from the stalls.
        ctx.globalCompositeOperation = "lighter";
        for (let q = 0; q < 22; q++) { const r = seeded(q * 17 + 3), life = 4 + r() * 3, ph = ((t + r() * life) % life) / life, wx = view0 + r() * (W / s), wy = ph * 30, sz = (0.35 + r() * 0.25) * s * (1 - ph * 0.6); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8; ctx.drawImage(glow([255, 160, 70]), X(wx + Math.sin(t * 1.3 + q) * 0.8) - sz / 2, Y(wy) - sz / 2, sz, sz); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      } else if (th.water) {
        // The Harbour: low sea fog rolling over the water.
        const gy2 = Y(0); if (gy2 < H + 4 * s) { ctx.globalAlpha = 0.28; for (let q = 0; q < 2; q++) { const r = seeded(q * 71 + 5), w = W * (0.8 + r() * 0.4), x = ((r() * W * 2 + t * (12 + r() * 10)) % (W * 2)) - W * 0.5; ctx.drawImage(glow([190, 210, 235]), x, gy2 - 2.5 * s, w, 3.5 * s); } ctx.globalAlpha = 1; }
      } else if (!R.stageInfo || !R.stageInfo.tower) {
        // Downtown: steam curling up from rooftop vents.
        for (const b of R.blds) { if (b.tree || (b.n % 3)) continue; const x0 = X(b.x0), x1 = X(b.x1); if (x1 < -20 || x0 > W + 20) continue; const vx = b.x0 + (b.x1 - b.x0) * 0.7;
          for (let q = 0; q < 4; q++) { const ph = ((t * 0.35 + q / 4 + b.n * 0.13) % 1), sz = (1 + ph * 3) * s; ctx.globalAlpha = 0.16 * (1 - ph); ctx.drawImage(glow([220, 225, 235]), X(vx + Math.sin(t + q) * 0.6 * ph) - sz / 2, Y(b.h + 1 + ph * 7) - sz / 2, sz, sz); } }
        ctx.globalAlpha = 1;
      }
    }
    // ---------- Weather and celebrations ----------
    if (P.rain) { ctx.strokeStyle = "rgba(200,225,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 0; q < 70; q++) { const r = seeded(q * 31), x = (r() * W + t * 40) % W, y = (r() * H + t * 700) % H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); } ctx.stroke(); }
    for (const f of R.fireworks) { const r = seeded(Math.floor(f.seed * 1e6)); for (let b2 = 0; b2 < 3; b2++) { const bx = W * (0.2 + r() * 0.6), by = H * (0.15 + r() * 0.25), col = [255, Math.floor(120 + r() * 135), Math.floor(r() * 255)], tt = Math.max(0, f.t - b2 * 0.35), k = Math.max(0, 1 - tt / 2.2); if (!k) continue; ctx.fillStyle = `rgba(${col.join(",")},${k})`; for (let q = 0; q < 28; q++) { const a = q / 28 * Math.PI * 2, d = Math.min(tt, 1.4) * 70; ctx.fillRect(bx + Math.cos(a) * d, by + Math.sin(a) * d + tt * tt * 10, 3, 3); } } }
    // Screen positions for the overlay.
    // Danger: a red glow rising from the bottom when the street is coming and nothing is in reach.
    if (R.danger > 0.01 && !R.attract) { const g = ctx.createLinearGradient(0, H, 0, H * 0.7); g.addColorStop(0, `rgba(255,60,80,${0.45 * R.danger * (0.75 + 0.25 * Math.sin(t * 18))})`); g.addColorStop(1, "rgba(255,60,80,0)"); ctx.fillStyle = g; ctx.fillRect(0, H * 0.7, W, H * 0.3); }
    // The chain count floats by you (x3, x4...), and from x5 the edges of the screen glow gold: in the zone.
    if ((R.pChain || 0) >= 3 && !R.attract && !R.over && !R.cleared) { const n = R.pChain, fx = X(R.px) + 1.6 * s, fy = Y(R.py + 3.2), pop = 1 + Math.max(0, (R.perfT || 0) - 0.2) * 1.2; ctx.font = `900 ${Math.round(1.05 * s * pop)}px Inter, system-ui, sans-serif`; ctx.textAlign = "left"; ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText(`×${n}`, fx + 1.5, fy + 1.5); ctx.fillStyle = "#ffd25a"; ctx.fillText(`×${n}`, fx, fy);
      if (n >= 5 && !(save.settings && save.settings.calm)) { const k = Math.min(1, (n - 4) / 4) * (0.75 + 0.25 * Math.sin(t * 5)); for (const [x0, x1] of [[0, W * 0.12], [W, W * 0.88]]) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, `rgba(255,200,80,${0.28 * k})`); g.addColorStop(1, "rgba(255,200,80,0)"); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, W * 0.12, H); } } }
    R.scrAim = aim ? [X(aim.x), Y(aim.y)] : null; R.scrDark = dx;
    return (x, at) => [hx, Y(R.py + 2.6)];
  }
  return { draw, get pxU() { return 1; } };
})();

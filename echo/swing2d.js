// Smooth mode: the swing drawn in fast 2D on the run canvas, no WebGL at all. Everything that
// would be expensive is drawn once into small images (buildings, glows, smoke) and then only
// copied each frame, so phones keep a steady 60 fps. It reads the same game state as the 3D view
// (swing.js) and gives the overlay the same screen positions. Default on phones; Settings can
// switch to the full 3D view.
"use strict";

const swingSmooth = () => {
  const st = save.settings || {};
  if (st.smooth != null) return !!st.smooth;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (typeof modestPhone !== "undefined" && modestPhone);
};

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
  const PX = 8;  // pixels per metre in the cached images
  const STYLE = [
    { base: "#232b38", day: "#9fb2c6", win: "#3a4a5c", lit: "#ffd9a0", cols: 4, rows: 1 },
    { base: "#3a2622", day: "#a2614a", win: "#2c3846", lit: "#ffcf8a", cols: 3, rows: 1 },
    { base: "#262a33", day: "#d8dbe0", win: "#273140", lit: "#ffe2b0", cols: 6, rows: 0.6 },
    { base: "#161a22", day: "#5d6e82", win: "#2a3646", lit: "#c9e6ff", cols: 5, rows: 1.2 },
    { base: "#2c2a28", day: "#b8b2a6", win: "#2b3541", lit: "#ffd59a", cols: 2, rows: 0.8 },
    { base: "#33282c", day: "#d9b8a8", win: "#35414f", lit: "#ffd0b0", cols: 4, rows: 1 },
  ];
  function paintFacade(x, w, h, st, lit, day, seed) {
    const r = seeded(Math.floor(seed * 1e6));
    x.fillStyle = day ? st.day : st.base; x.fillRect(0, 0, w, h);
    const fl = 3.4 * PX, cw = w / st.cols;
    for (let y = 6; y + fl * 0.55 < h - 4; y += fl) for (let c = 0; c < st.cols; c++) {
      const on = lit && r() < 0.62, ww = cw * 0.62, hh = fl * 0.5 * st.rows;
      x.fillStyle = on ? st.lit : day ? "rgba(40,55,75,0.85)" : st.win; x.fillRect(c * cw + (cw - ww) / 2, y, ww, Math.min(hh, fl * 0.62));
    }
    x.fillStyle = "rgba(255,255,255,0.08)"; x.fillRect(0, 0, w, 3);
  }
  const bldImg = new Map();
  function imgFor(b, lit, day) {
    const key = b.n + (lit ? "L" : "D") + (day ? "d" : "n") + b.x0.toFixed(1);
    let c = bldImg.get(key); if (c) return c;
    const w = (b.x1 - b.x0) * PX, h = b.h * PX, st = STYLE[b.style % STYLE.length];
    c = mk(w, h, (x) => paintFacade(x, w, h, st, lit, day, b.seed || 0.5));
    bldImg.set(key, c); if (bldImg.size > 240) bldImg.delete(bldImg.keys().next().value);
    return c;
  }
  // Background skyline: silhouettes with sparse warm windows, three layers of parallax.
  const LAYERS = [{ par: 0.22, sp: 22, h: [38, 100], haze: 0.55 }, { par: 0.5, sp: 14, h: [20, 55], haze: 0.26 }];
  const bgImg = new Map();
  function bgFor(li, i, lit) {
    const key = li + ":" + i + (lit ? "L" : "D");
    let c = bgImg.get(key); if (c) return c;
    const r = seeded(i * 977 + li * 31), L = LAYERS[li], k = 10, w = L.sp * (0.6 + r() * 0.5) * k, h = (L.h[0] + r() * (L.h[1] - L.h[0])) * k;
    c = mk(w, h, (x) => { x.fillStyle = "#0d1018"; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(0, 0, w, 2); const q = seeded(i * 13 + li); for (let y = 10; y < h; y += 11) for (let xx = 5; xx < w - 5; xx += 8) if (q() < (lit ? 0.32 : 0.05)) { x.fillStyle = lit ? `rgba(255,${200 + q() * 40},${130 + q() * 60},0.9)` : "rgba(255,210,150,0.3)"; x.fillRect(xx, y, 2, 3); } });
    c.wM = w / k; c.hM = h / k; bgImg.set(key, c); if (bgImg.size > 300) bgImg.delete(bgImg.keys().next().value);
    return c;
  }
  const stars = Array.from({ length: 90 }, (_, q) => { const r = seeded(q * 7 + 3); return [r(), r() * 0.6, 0.5 + r() * 1.2, r() * 6]; });
  const hist = [];
  let cam = null, sCur = 24;
  const strips = [null, null];

  function draw(ctx, W, H, P) {
    const R = run, t = R.t, night = P.night, day = 1 - night, dayImg = night < 0.45;
    // ---------- Camera: frames you and your next anchor, zooms out a little with speed ----------
    const spd = R.v || 10, sTarget = H / (30 + Math.min(12, Math.max(0, spd - 10) * 0.45));
    sCur += (sTarget - sCur) * 0.08; const s = sCur;
    const aim = R.teth || swingFindAnchor(R), halfW = W / 2 / s, halfH = H / 2 / s;
    let tx = R.px + 5 + Math.max(0, R.vx) * 0.12, ty = R.py + 4;
    if (aim) { tx = tx * 0.6 + (aim.x + 2) * 0.4; ty = ty * 0.55 + (aim.y - 2) * 0.45; }
    tx = Math.max(R.px + halfW * 0.15, Math.min(R.px + halfW * 0.55, tx)); ty = Math.max(9, Math.min(60, Math.max(R.py - halfH * 0.35, Math.min(R.py + halfH * 0.45, ty))));
    if (!cam || Math.abs(cam.x - tx) > 80) cam = { x: tx, y: ty };
    cam.x += (tx - cam.x) * 0.1; cam.y += (ty - cam.y) * 0.07;
    cam.x = Math.max(R.px + halfW * 0.05, Math.min(R.px + halfW * 0.7, cam.x)); cam.y = Math.max(R.py - halfH * 0.55, Math.min(R.py + halfH * 0.6, cam.y));
    const sh = R.shake > 0 ? R.shake * 6 : 0, ox = W / 2 + (Math.random() - 0.5) * sh, oy = H / 2 + (Math.random() - 0.5) * sh + (R.kick || 0) * 8;
    const X = x => ox + (x - cam.x) * s, Y = y => oy - (y - cam.y) * s;
    // ---------- Sky (baked into the far skyline strip below) ----------
    let sk = null; const skyCss = () => sk || (sk = P.sky.map(c => `rgb(${c.map(v => Math.round(v)).join(",")})`));
    // ---------- Skyline layers, hazier with distance; they wake as you pass ----------
    // Each layer is pre-drawn into a wide strip (with its haze) and only re-drawn when the view
    // moves past it, the zoom changes, the time of day changes or buildings light up.
    let palKey = Math.round(night * 8) + (P.blackout ? 100 : 0); for (const c of P.sky) palKey = palKey * 977 + ((c[0] >> 3) * 1089 + (c[1] >> 3) * 33 + (c[2] >> 3));
    const splitX = ox + (R.px - cam.x) * s;     // left of the figure: lit; right: still dark
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
          for (let i = start; i <= end; i++) { const im = bgFor(li, i, lit && !P.blackout), w = im.wM * sL, h = im.hM * sL, sx = (i * L.sp - x0) * sL; x.drawImage(im, sx, base - h, w, h); x.fillStyle = "#0d1018"; x.fillRect(sx, base - 1, w, shh); }
          x.globalCompositeOperation = "source-atop"; x.globalAlpha = L.haze * (0.6 + day * 0.4); x.fillStyle = skyCss()[2]; x.fillRect(0, 0, sw, shh); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
          if (li === 0) {
            // The sky and its stars go behind the far skyline: one solid image, no blending each frame.
            x.globalCompositeOperation = "destination-over";
            if (night > 0.35) { x.fillStyle = "#fff"; const rs = seeded(li * 17 + 5); for (let q = 0; q < 140; q++) { x.globalAlpha = (night - 0.35) * (0.4 + rs() * 0.6); x.fillRect(rs() * sw, rs() * shh * 0.55, 1 + rs(), 1 + rs()); } x.globalAlpha = 1; }
            const gs = x.createLinearGradient(0, shh - H * 1.15, 0, shh); const k3 = skyCss(); gs.addColorStop(0, k3[0]); gs.addColorStop(0.55, k3[1]); gs.addColorStop(1, k3[2]); x.fillStyle = k3[0]; x.fillRect(0, 0, sw, shh); x.fillStyle = gs; x.fillRect(0, shh - H * 1.15, sw, H * 1.15);
            x.globalCompositeOperation = "source-over";
          }
        }
      }
      // Copy only what's on screen: the lit part left of the figure, the dark part right of it.
      const dx0 = (S.x0 - camL) * sL + W / 2, dy0 = H - S.c.height - (cam.y - 20) * sL * 0.15, srcY = Math.max(0, -dy0), hh = Math.min(S.c.height - srcY, H - Math.max(0, dy0));
      if (li === 0 && dy0 + S.c.height < H) { ctx.fillStyle = "#0d1018"; ctx.fillRect(0, dy0 + S.c.height - 1, W, H); }
      if (hh <= 0) return;
      const seg = (img, xa, xb) => { xa = Math.max(0, xa); xb = Math.min(W, xb); if (xb - xa < 1) return; ctx.drawImage(img, xa - dx0, srcY, xb - xa, hh, xa, Math.max(0, dy0), xb - xa, hh); };
      seg(S.cl, 0, splitX); seg(S.c, splitX, W);
      if (li === 0) {
        // Moon by night, sun by day, in front of the far skyline.
        if (night > 0.3) { ctx.globalAlpha = (night - 0.3) / 0.7; ctx.drawImage(glow(0xf6f3e6), W * 0.12, H * 0.06, W * 0.22, W * 0.22); ctx.fillStyle = "#f6f3e6"; ctx.beginPath(); ctx.arc(W * 0.23, H * 0.06 + W * 0.11, W * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        if (day > 0.3) { ctx.globalAlpha = day; ctx.drawImage(glow(0xfff2d8), W * 0.55, H * 0.02, W * 0.5, W * 0.5); ctx.globalAlpha = 1; }
      }
    });
    // ---------- The street (and the harbour) ----------
    const gy = Y(0); if (gy < H) { const th = runnerTheme(R.px); ctx.fillStyle = th.water ? "#123a57" : "#1c1f26"; ctx.fillRect(0, gy, W, H - gy); if (th.water) { ctx.fillStyle = "rgba(160,210,255,0.12)"; for (let q = 0; q < 6; q++) ctx.fillRect(0, gy + 6 + q * 9, W, 1); } }
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
    }
    // ---------- Hazards: live wires, drones ----------
    for (const z of R.haz) {
      if (z.kind === "wire") { const a = X(z.x0), b2 = X(z.x1), y = Y(z.y); if (b2 < 0 || a > W) continue; ctx.strokeStyle = "#20242e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b2, y); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; for (let q = 0; q < 3; q++) { const f = seeded(Math.floor(t * 14) + q)(); ctx.drawImage(glow([127, 216, 255]), a + f * (b2 - a) - 9, y - 9, 18, 18); } ctx.globalCompositeOperation = "source-over"; }
      else { const x = X(z.x), y = Y((z.y ?? z.y0) + 0.9); if (x < -30 || x > W + 30) continue; ctx.fillStyle = "#1f2430"; ctx.beginPath(); ctx.ellipse(x, y, 0.75 * s, 0.35 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#9aa2b0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 1.1 * s, y - 0.4 * s); ctx.lineTo(x + 1.1 * s, y - 0.4 * s); ctx.stroke(); ctx.drawImage(glow([255, 43, 74]), x - 0.8 * s, y - 0.8 * s, 1.6 * s, 1.6 * s); ctx.fillStyle = "#ff2b4a"; ctx.beginPath(); ctx.arc(x, y, 0.15 * s, 0, Math.PI * 2); ctx.fill(); }
    }
    // ---------- Anchors ----------
    const best = !R.teth ? aim : null;
    for (const a of R.anchors) {
      const x = X(a.x), y = Y(a.y + (a.broken ? -(a.fallY = (a.fallY || 0) + 0.3) : 0)); if (x < -40 || x > W + 40) continue;
      const col = a.type === "gold" ? [255, 210, 90] : a.type === "crumble" ? [255, 122, 61] : a.type === "drift" ? [127, 240, 255] : a.type === "spring" ? [141, 255, 106] : glowRGB, hot = a === best || a === R.teth;
      if (a.broken) { ctx.globalAlpha = 0.5; }
      // A mast to the roof below, if there is one.
      const below = R.blds.find(q => !q.tree && a.x >= q.x0 && a.x <= q.x1); if (below && a.y - below.h < 22) { ctx.strokeStyle = "#2b2f38"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Y(below.h)); ctx.stroke(); }
      if (a.kind === "balloon" && !below) { ctx.fillStyle = ["#ff5a6e", "#ffbe3c", "#5ac8ff", "#aa78ff"][a.id % 4]; ctx.beginPath(); ctx.ellipse(x, y - 2.8 * s, 1.3 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 1.2 * s); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.globalCompositeOperation = "lighter"; const gsz = (hot ? 3.4 : 2.4) * s; ctx.drawImage(glow(col), x - gsz / 2, y - gsz / 2, gsz, gsz); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 0.38 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = css(col); ctx.globalAlpha = (a.broken ? 0.5 : 1) * (hot ? 0.95 : 0.45); ctx.lineWidth = hot ? 2.5 : 1.5; ctx.beginPath(); ctx.arc(x, y, (hot ? 1 + 0.12 * Math.sin(t * 8) : 0.85) * s, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = a.broken ? 0.5 : 1;
      if (a.type === "crumble" && a === R.teth) { ctx.strokeStyle = "#3a1408"; ctx.lineWidth = 2; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(q * 2.1) * 0.4 * s, y + Math.sin(q * 2.1) * 0.4 * s); ctx.stroke(); } }
      if (a.type === "spring") { ctx.strokeStyle = "#8dff6a"; ctx.lineWidth = 2; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.ellipse(x, y + (0.7 + q * 0.3) * s, 0.35 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.globalAlpha = 1;
    }
    // ---------- Lights, shards, power-ups, letters ----------
    ctx.globalCompositeOperation = "lighter";
    for (const c of R.motes) { const x = X(c.x), y = Y(c.y); if (x < -20 || x > W + 20) continue; const k = c.got ? 1 - c.t / 0.35 : 1, sz = 1.3 * s * k; ctx.drawImage(glow([255, 194, 61]), x - sz, y - sz, sz * 2, sz * 2); }
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
    // ---------- The trajectory: where you'd fly if you let go now (gold when it's a Perfect) ----------
    if (R.teth && !R.attract) {
      const ang = Math.atan2(R.vy, R.vx) * 180 / Math.PI, sp2 = Math.hypot(R.vx, R.vy), pw = perfectWindow(R), perfect = R.vx + 1.5 > 4 && ang > pw[0] && ang < pw[1] && sp2 > pw[2];
      let px = R.px, py = R.py + 1, vx = (R.vx + 1.5) * (perfect ? 1.1 : 1), vy = R.vy * (perfect ? 1.1 : 1);
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
      const bc = (RUNNER_BOARDS[runnerLook().board] || RUNNER_BOARDS[0]).c, tc = bc === "prism" ? `hsl(${(t * 140) % 360},90%,65%)` : hex(bc), ax = X(R.teth.x), ay = Y(R.teth.y);
      ctx.strokeStyle = tc; ctx.globalAlpha = 0.3; ctx.lineWidth = 0.45 * s; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, 0.12 * s); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.globalCompositeOperation = "lighter"; for (let q = 0; q < 4; q++) { const f = (t * 1.8 + q / 4) % 1; ctx.globalAlpha = Math.sin(f * Math.PI); ctx.drawImage(glow(rgbOf(bc === "prism" ? 0xffffff : bc)), hx + (ax - hx) * f - 0.5 * s, hy + (ay - hy) * f - 0.5 * s, s, s); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    // ---------- The scarf: a ribbon of light from the shoulders ----------
    const scf = RUNNER_SHOES[runnerLook().shoe] || RUNNER_SHOES[0], N = Math.min(40, scf.len);
    { const e = hist.length >= 48 ? hist.pop() : [0, 0]; e[0] = R.px; e[1] = R.py + 1.75; hist.unshift(e); }
    const scCol = R.od > 0 || scf.c === "prism" ? null : rgbOf(scf.c ?? glowHex);
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
    if (!blink) {
      const auraC = R.od > 0 ? [255, 194, 61] : R.power ? RUNNER_POWERS[R.power.kind].rgb.split(",").map(Number) : glowRGB, asz = (R.od > 0 ? 6 : R.dashT > 0 ? 5.5 : 4.5) * s;
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 + night * 0.3; ctx.drawImage(glow(auraC), hx - asz / 2, Y(R.py + 1.2) - asz / 2, asz, asz); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const ch = RUNNER_CHARS[runnerLook().char] || RUNNER_CHARS[0], core = hex(ch.look.core), u = 1.55 * s, p = R.phase, sn = Math.sin(p);
      // Pose: hips, chest, head, hands, feet (metres around the figure's centre), then rotated.
      let rot = 0, armA = [-0.5, -0.3], armB = [0.5, -0.3], legA = [-0.25, -0.95], legB = [0.25, -0.95];
      if (R.teth) { const ang = Math.atan2(R.teth.y - R.py - 1.4, R.teth.x - R.px); rot = (ang - Math.PI / 2) * 0.6; armB = [0.1, 1.15]; armA = [-0.45, 0.1]; legA = [-0.35, -0.95]; legB = [0.05, -1]; }
      else if (R.roof) { armA = [-0.4 * sn - 0.1, -0.2]; armB = [0.4 * sn + 0.1, -0.2]; legA = [-0.45 * sn, -0.95 + Math.max(0, sn) * 0.2]; legB = [0.45 * sn, -0.95 + Math.max(0, -sn) * 0.2]; rot = -0.2; }
      else { rot = -R.spin; const tk = Math.min(1, Math.abs(R.spinV) / 4); armA = [-0.55, 0.35 * (1 - tk)]; armB = [0.55, 0.35 * (1 - tk)]; legA = [-0.3, -0.95 + tk * 0.45]; legB = [0.3, -0.95 + tk * 0.45]; }
      if (R.over) rot += t * 6;
      const cx = hx, cy = Y(R.py + 1.1), cr = Math.cos(rot), sr = Math.sin(rot), P2 = (dx, dy) => [cx + (dx * cr - dy * sr) * u, cy - (dx * sr + dy * cr) * u];
      const hip = P2(0, -0.15), chest = P2(0, 0.45), head = P2(0, 0.85), sh = P2(0, 0.38);
      ctx.strokeStyle = core; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 0.2 * u; for (const [ex, ey] of [legA, legB]) { const k2 = P2(ex * 0.6, (ey - 0.15) * 0.5 - 0.1), f = P2(ex, ey - 0.15); ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(k2[0], k2[1]); ctx.lineTo(f[0], f[1]); ctx.stroke(); }
      ctx.lineWidth = 0.32 * u; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(chest[0], chest[1]); ctx.stroke();
      ctx.lineWidth = 0.15 * u; for (const [ex, ey] of [armA, armB]) { const e = P2(ex * 0.5, 0.38 + ey * 0.45), hnd = P2(ex, 0.38 + ey); ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hnd[0], hnd[1]); ctx.stroke(); }
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "lighter"; ctx.drawImage(glow(0xffffff), head[0] - 0.5 * u, head[1] - 0.5 * u, u, u); ctx.globalCompositeOperation = "source-over";
      if (R.power && R.power.kind === "shield") { ctx.strokeStyle = "rgba(90,210,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 1.5 * u, 0, Math.PI * 2); ctx.stroke(); }
    }
    // The finish gate: a pillar of gold light.
    if (R.stageLen) { const fx = X(R.stageLen); if (fx > -60 && fx < W + 60) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1; ctx.drawImage(glow([255, 210, 90]), fx - 2.5 * s, -H * 0.2, 5 * s, H * 1.4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#fff"; ctx.fillRect(fx - 1.5, 0, 3, H); ctx.font = `800 ${Math.round(0.9 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "#ffd98a"; ctx.fillText("FINISH", fx, Y(R.py + 8)); } }
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
    // ---------- Weather and celebrations ----------
    if (P.rain) { ctx.strokeStyle = "rgba(200,225,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 0; q < 70; q++) { const r = seeded(q * 31), x = (r() * W + t * 40) % W, y = (r() * H + t * 700) % H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); } ctx.stroke(); }
    for (const f of R.fireworks) { const r = seeded(Math.floor(f.seed * 1e6)); for (let b2 = 0; b2 < 3; b2++) { const bx = W * (0.2 + r() * 0.6), by = H * (0.15 + r() * 0.25), col = [255, Math.floor(120 + r() * 135), Math.floor(r() * 255)], tt = Math.max(0, f.t - b2 * 0.35), k = Math.max(0, 1 - tt / 2.2); if (!k) continue; ctx.fillStyle = `rgba(${col.join(",")},${k})`; for (let q = 0; q < 28; q++) { const a = q / 28 * Math.PI * 2, d = Math.min(tt, 1.4) * 70; ctx.fillRect(bx + Math.cos(a) * d, by + Math.sin(a) * d + tt * tt * 10, 3, 3); } } }
    // Screen positions for the overlay.
    R.scrAim = aim ? [X(aim.x), Y(aim.y)] : null; R.scrDark = dx;
    return (x, at) => [hx, Y(R.py + 2.6)];
  }
  return { draw, get pxU() { return 1; } };
})();

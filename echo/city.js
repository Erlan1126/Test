// Echo: the Singer's city. Between caves, Lumi comes home to the old city in the dark. Every
// light rescued in a cave comes home too and lights a window or a street lamp, and the light
// you saved in each cave moves in as a little neighbour with a name and something to say. The
// Singer's tower lights when act one ends; the sky opens when act two does. Glow earned in the
// caves buys better songs here.
"use strict";

// One neighbour for each cave: they move in once that cave is cleared.
const RESIDENTS = [
  { name: "Pip", says: "You found me! I thought the dark would never end." },
  { name: "Moss", says: "I hum when I'm nervous. I'm humming a lot." },
  { name: "Tilly", says: "Three of us were lost in there. Now we're all home." },
  { name: "Bram", says: "That shadow listened to me breathe. I held my breath for a week." },
  { name: "Chime", says: "The ring stones still know my name." },
  { name: "Feather", says: "We tiptoed past four of them. Well. You did." },
  { name: "Ember", says: "Did you see it come out of the dark? I'm still shaking." },
  { name: "Wick", says: "The baby moth won't stop following me. I don't mind." },
  { name: "Maze", says: "Left, left, right, up… I'm never going back in there." },
  { name: "The Singer", says: "Every night, from my tower, I'll sing for all of you.", big: true },
  { name: "Pebble", says: "I taught Lumi the pebble trick. Well. I watched." },
  { name: "Twin", says: "Two guards, and only little me. Thank you." },
  { name: "Wink", says: "That big golden eye looked right through me." },
  { name: "Dusk", says: "Quiet and small. That's how you get home." },
  { name: "Lantern", says: "The mines still remember my grandad's lantern." },
  { name: "Cinder", says: "The ceiling came down. You didn't stop." },
  { name: "Echo", says: "They used to sing together, you know. All of them." },
  { name: "Glint", says: "Every crossing was watched. Every single one." },
  { name: "Vesper", says: "All the way up! I can almost see the sky." },
  { name: "Little Hush", says: "I was lost for so long. Thank you for singing to me.", hush: true },
];

// How many lights are home: the most found in each cave, added up.
const lightsHome = () => Math.min(lightsInAll(), CORE_LEVELS.reduce((a, _, i) => a + ((save.got || {})[i] || 0), 0) + Math.floor(((save.run || {}).lights || 0) / 15));
const lightsInAll = () => CORE_LEVELS.reduce((a, lv) => a + (lv.map.join("").match(/o/g) || []).length, 0);
const residentsHome = () => RESIDENTS.filter((_, i) => save.stars[i]);

// ---------- Songs Lumi learns, and upgrades bought with glow ----------
const UPGRADES = [
  { id: "dash", name: "Dash", from: 3, tiers: [10, 20, 32], tip: lv => `Recharges in ${(DASH_CD - lv * 0.8).toFixed(1)} s` },
  { id: "pebble", name: "Pebble pouch", from: 5, tiers: [14, 28], tip: lv => `${3 + lv} pebbles each cave` },
  { id: "hum", name: "Hum", from: 7, tiers: [12, 24], tip: lv => `Shows ${(HUM_RANGE + lv * 0.8).toFixed(1)} tiles around you` },
  { id: "shield", name: "Shield", from: 10, tiers: [30], tip: lv => `${1 + lv} free touch${lv ? "es" : ""} each cave` },
];
const upg = id => ((save.upg || {})[id] || 0);
const learned = u => (save.stars[u.from - 1] || 0) > 0 || nextUnplayed() >= u.from;

// ---------- The picture ----------
// Everything is laid out in a 400 x 720 picture, scaled to fit the screen.
let cityT = 0, cityRaf = 0, cityArrive = 0, cityFrom = 0, citySay = null, cityFloat = [];
const CW = 400, CH = 720;
function citySlots() {
  // Each slot is a window or a lamp; lights fill them in this order (lamps first, then the
  // houses nearest the street, then the far city, then the tower's crown).
  const out = [], r = seeded(4242);
  // Street lamps along the bottom.
  for (let k = 0; k < 7; k++) out.push({ x: 26 + k * 58, y: 560, lamp: true });
  // Near houses.
  for (const h of CITY_HOUSES) for (let wy = 0; wy < h.floors; wy++) for (let wx = 0; wx < h.w; wx++) out.push({ x: h.x + 10 + wx * 16, y: h.y + 14 + wy * 22, w: 8, h: 11 });
  // Far city windows.
  for (let k = 0; k < 18; k++) out.push({ x: 20 + r() * 360, y: 330 + r() * 70, w: 3, h: 4, far: true });
  return out;
}
const CITY_HOUSES = [
  { x: 6, y: 438, w: 3, floors: 4, roof: "gable" }, { x: 72, y: 470, w: 2, floors: 3, roof: "flat" },
  { x: 260, y: 455, w: 3, floors: 3, roof: "gable" }, { x: 326, y: 420, w: 4, floors: 5, roof: "dome" },
];
let SLOTS = null;

function drawCity(ctx, W, H) {
  if (!SLOTS) SLOTS = citySlots();
  // The street sits just above Play and the buttons, so the neighbours are never hidden.
  const k = Math.min(W / CW, (H - 120) / 690), ox = (W - CW * k) / 2, oy = H - 190 - 690 * k;
  const t = cityT, home = lightsHome(), act1 = !!save.ended, act2 = !!save.act2Done;
  // Sky: deep cave dark; warmer once the Singer sings again; open and starry at the very end.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, act2 ? "#0b1640" : "#03040b"); sky.addColorStop(0.55, act1 ? "#1a1430" : "#070a18"); sky.addColorStop(1, "#05060e");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
  const r = seeded(77);
  if (act2) {
    for (let q = 0; q < 90; q++) { const x = r() * CW, y = r() * 300; ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + q)); ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 1.6, 1.6); }
    ctx.globalAlpha = 0.18; const au = ctx.createLinearGradient(0, 60, 0, 260); au.addColorStop(0, "rgba(120,255,200,0)"); au.addColorStop(0.5, "rgba(120,255,200,1)"); au.addColorStop(1, "rgba(120,160,255,0)");
    ctx.fillStyle = au; ctx.beginPath(); ctx.moveTo(0, 160); for (let x = 0; x <= CW; x += 20) ctx.lineTo(x, 140 + Math.sin(x * 0.02 + t * 0.4) * 40); ctx.lineTo(CW, 260); ctx.lineTo(0, 260); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // The cave roof: hanging rock, darkest at the top.
    ctx.fillStyle = "#020309"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(CW, 0);
    for (let x = CW; x >= 0; x -= 12) ctx.lineTo(x, 60 + Math.sin(x * 0.07) * 18 + (r() < 0.25 ? 50 * r() : 0));
    ctx.fill();
  }
  // The Singer's tower, in the middle of everything.
  const glowT = act1 ? 1 : 0;
  if (glowT) { const g = ctx.createRadialGradient(200, 250, 10, 200, 250, 230); g.addColorStop(0, "rgba(255,210,130,0.55)"); g.addColorStop(1, "rgba(255,180,90,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH); }
  ctx.fillStyle = "#0b0d1c";
  ctx.beginPath(); ctx.moveTo(176, 600); ctx.lineTo(182, 290); ctx.lineTo(172, 286); ctx.lineTo(200, 200); ctx.lineTo(228, 286); ctx.lineTo(218, 290); ctx.lineTo(224, 600); ctx.fill();
  ctx.beginPath(); ctx.arc(200, 262, 13, 0, Math.PI * 2); ctx.fillStyle = glowT ? "#ffd98a" : "#141830"; ctx.fill();
  if (glowT) { ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(200, 262, 2, 200, 262, 50); g.addColorStop(0, "rgba(255,230,160,0.9)"); g.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = g; ctx.fillRect(140, 200, 120, 120); ctx.globalCompositeOperation = "source-over"; }
  // Far city: low silhouettes in the haze.
  ctx.fillStyle = "#0a0d1e";
  ctx.beginPath(); ctx.moveTo(0, 420);
  for (let x = 0; x <= CW; x += 22) { const h = 330 + seeded(x)() * 60; ctx.lineTo(x, h); ctx.lineTo(x + 22, h); }
  ctx.lineTo(CW, 600); ctx.lineTo(0, 600); ctx.fill();
  // A stone bridge on the right, lit once act two is done.
  ctx.strokeStyle = "#0e1124"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(330, 470, 70, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  // Near houses.
  for (const h of CITY_HOUSES) {
    const w = h.w * 16 + 12, top = h.y, bot = 600;
    ctx.fillStyle = "#0d1020"; ctx.fillRect(h.x, top, w, bot - top);
    ctx.beginPath();
    if (h.roof === "gable") { ctx.moveTo(h.x - 4, top); ctx.lineTo(h.x + w / 2, top - 22); ctx.lineTo(h.x + w + 4, top); }
    else if (h.roof === "dome") { ctx.arc(h.x + w / 2, top, w / 2, Math.PI, 0); }
    else { ctx.rect(h.x - 3, top - 6, w + 6, 6); }
    ctx.fill();
  }
  // The street.
  ctx.fillStyle = "#080a16"; ctx.fillRect(0, 590, CW, 130);
  ctx.fillStyle = "#11152a"; for (let x = 0; x < CW; x += 26) ctx.fillRect(x + ((x / 26) % 2) * 6, 604 + ((x / 26) % 3) * 9, 18, 3);
  // Windows and lamps: dark until a light comes home to them; the newest ones bloom in.
  SLOTS.forEach((s, q) => {
    const on = q < home, fresh = on && q >= cityFrom && cityArrive > 0;
    const a = !on ? 0 : fresh ? Math.min(1, Math.max(0, (cityT - (q - cityFrom) * 0.6))) : 1;
    if (s.lamp) {
      ctx.fillStyle = "#151a30"; ctx.fillRect(s.x - 1.5, s.y - 40, 3, 40); ctx.fillRect(s.x - 6, s.y - 44, 12, 4);
      if (a > 0) { ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(s.x, s.y - 46, 1, s.x, s.y - 46, 40); g.addColorStop(0, `rgba(255,214,140,${0.9 * a})`); g.addColorStop(1, "rgba(255,190,110,0)"); ctx.fillStyle = g; ctx.fillRect(s.x - 40, s.y - 86, 80, 80); ctx.globalCompositeOperation = "source-over"; }
      ctx.fillStyle = a > 0 ? `rgba(255,236,190,${a})` : "#1b2038"; ctx.beginPath(); ctx.arc(s.x, s.y - 46, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      const flick = 0.85 + 0.15 * Math.sin(t * 2 + q * 1.7);
      ctx.fillStyle = a > 0 ? `rgba(255,${s.far ? 200 : 205},${s.far ? 150 : 130},${a * flick})` : s.far ? "#0f1328" : "#141a30";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      if (a > 0 && !s.far) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,190,110,${0.18 * a})`; ctx.fillRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10); ctx.globalCompositeOperation = "source-over"; }
    }
  });
  // Neighbours: the lights Lumi saved, bobbing along the street. Tap one to hear it.
  const res = residentsHome();
  cityFloat = [];
  res.forEach((p, q) => {
    const i = RESIDENTS.indexOf(p), x = p.big ? 200 : 20 + ((i * 53) % 360), y = p.big ? 230 : 640 + Math.sin(t * 1.3 + i) * 6 - (i % 3) * 14, rad = p.big ? 0 : 7;
    if (p.big) return;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 1, x, y, 22); g.addColorStop(0, p.hush ? "rgba(200,170,255,0.6)" : "rgba(160,230,255,0.6)"); g.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44); ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = p.hush ? "#2a1840" : "#e6f8ff"; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hush ? "#ffd36e" : "#123049"; ctx.beginPath(); ctx.arc(x - 2.4, y - 1, 1.3, 0, Math.PI * 2); ctx.arc(x + 2.4, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
    cityFloat.push({ x: ox + x * k, y: oy + y * k, p });
  });
  // Lumi, home.
  const lx = 200, ly = 650 + Math.sin(t * 2) * 5;
  ctx.globalCompositeOperation = "lighter"; const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60); lg.addColorStop(0, "rgba(160,235,255,0.7)"); lg.addColorStop(1, "rgba(120,220,255,0)"); ctx.fillStyle = lg; ctx.fillRect(lx - 60, ly - 60, 120, 120); ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#eefaff"; ctx.beginPath(); ctx.arc(lx, ly, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#123049"; ctx.beginPath(); ctx.ellipse(lx - 4.5, ly, 2, 2.8, 0, 0, Math.PI * 2); ctx.ellipse(lx + 4.5, ly, 2, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  // Fireflies once the city is waking.
  if (home > 6) for (let q = 0; q < Math.min(40, home); q++) { const x = (q * 97 + t * 12 * (1 + q % 3)) % CW, y = 380 + ((q * 53) % 200) + Math.sin(t + q) * 10; ctx.fillStyle = `rgba(255,236,160,${0.4 + 0.4 * Math.sin(t * 3 + q)})`; ctx.fillRect(x, y, 2, 2); }
  // A neighbour talking.
  if (citySay && citySay.t > 0) {
    const s = citySay, bx = Math.min(CW - 150, Math.max(10, (s.x - ox) / k - 70)), by = (s.y - oy) / k - 70;
    ctx.globalAlpha = Math.min(1, s.t * 2);
    ctx.fillStyle = "rgba(14,20,44,0.92)"; ctx.strokeStyle = "rgba(160,230,255,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, 150, 56, 10); else ctx.rect(bx, by, 150, 56); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#9fe8ff"; ctx.font = "600 11px system-ui, sans-serif"; ctx.fillText(s.p.name, bx + 10, by + 16);
    ctx.fillStyle = "#e2eaf8"; ctx.font = "italic 11px Georgia, serif";
    const words = s.p.says.split(" "); let line = "", ly2 = by + 31;
    for (const w of words) { if (ctx.measureText(line + w).width > 132) { ctx.fillText(line, bx + 10, ly2); line = ""; ly2 += 13; } line += w + " "; }
    ctx.fillText(line, bx + 10, ly2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function cityLoop(now) {
  if (screen !== "city") { cityRaf = 0; return; }
  const c = $("cityCanvas"), d = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const dt = Math.min(0.05, (now - (cityLoop.last || now)) / 1000); cityLoop.last = now;
  cityT += dt;
  if (citySay) citySay.t -= dt;
  if (cityArrive > 0) {
    cityArrive -= dt;
    const lit = Math.floor(cityT / 0.6) + cityFrom;
    if (lit !== cityLoop.lit && lit < lightsHome() && cityT > 0.3) { cityLoop.lit = lit; note(pitch(lit % 7, 1), { dur: 1, vol: 0.06, fm: 3.5, fmDepth: 0.7, echo: 1 }); buzz(6); }
  }
  const ctx = c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0);
  drawCity(ctx, W, H);
  cityRaf = requestAnimationFrame(cityLoop);
}

// Open the city; arriving from a cave, the lights you just saved come home one by one.
function showCity(fromCave = false) {
  save.cityLast = save.cityLast || 0;
  const home = lightsHome();
  cityFrom = fromCave ? Math.min(save.cityLast, home) : home;
  cityArrive = fromCave && home > save.cityLast ? 1.2 + (home - save.cityLast) * 0.6 : 0;
  save.cityLast = home; persist();
  cityT = 0; cityLoop.lit = -1; citySay = null;
  if (L && !L.demo) musicStop();
  renderCity();
  show("city");
  if (!cityRaf) cityRaf = requestAnimationFrame(cityLoop);
  const n = home - cityFrom;
  if (fromCave && n > 0) $("citySub").textContent = `${n} light${n > 1 ? "s" : ""} came home`;
}
function renderCity() {
  const n = nextUnplayed(), lv = CORE_LEVELS[n];
  $("cityCount").textContent = `${lightsHome()} / ${lightsInAll()}`;
  $("cityGlow").textContent = save.glow || 0;
  $("citySub").textContent = residentsHome().length ? `${residentsHome().length} neighbours home · tap one to say hello` : "The Singer's city, waiting in the dark";
  $("cityGoName").textContent = `${n + 1}. ${lv.name}`;
  renderShop();
}
function renderShop() {
  const list = UPGRADES.filter(learned);
  $("shopList").innerHTML = list.length ? list.map(u => {
    const lv = upg(u.id), next = u.tiers[lv], afford = next != null && (save.glow || 0) >= next;
    return `<li><span><b>${u.name}</b> ${"◆".repeat(lv)}${"◇".repeat(u.tiers.length - lv)}<small>${u.tip(lv)}</small></span>` +
      (next == null ? `<em>Best</em>` : `<button data-up="${u.id}" ${afford ? "" : "disabled"}>✦ ${next}</button>`) + "</li>";
  }).join("") : `<li><span>Lumi learns new songs in the caves. Come back after cave 3.</span></li>`;
}
document.getElementById("shopList").addEventListener("click", e => {
  const b = e.target.closest("button[data-up]");
  if (!b) return;
  const u = UPGRADES.find(q => q.id === b.dataset.up), lv = upg(u.id), cost = u.tiers[lv];
  if (cost == null || (save.glow || 0) < cost) return;
  save.glow -= cost; save.upg = save.upg || {}; save.upg[u.id] = lv + 1; persist();
  sfx.unlock(); buzz(20); renderCity();
});
document.getElementById("cityCanvas").addEventListener("click", e => {
  const near = cityFloat.map(f => ({ f, d: Math.hypot(f.x - e.clientX, f.y - e.clientY) })).sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > 40) return;
  audio(); citySay = { p: near.f.p, x: near.f.x, y: near.f.y, t: 4 };
  note(pitch(RESIDENTS.indexOf(near.f.p) % 7, 2), { dur: 0.6, vol: 0.05, fm: 2, echo: 0.8 });
});

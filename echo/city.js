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
const residentsHome = () => [...RESIDENTS.filter((_, i) => save.stars[i]), ...RUN_FRIENDS.filter((_, i) => (save.runFriends || {})[i])];

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
  const glowT = act1 || built("tower") ? 1 : 0;
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
  if (built("bridge")) for (let q = 0; q < 6; q++) { const a = Math.PI * (1.12 + q * 0.14), bx = 330 + Math.cos(a) * 70, by = 470 + Math.sin(a) * 70; ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(bx, by - 6, 0, bx, by - 6, 18); g.addColorStop(0, "rgba(255,210,130,0.8)"); g.addColorStop(1, "rgba(255,190,110,0)"); ctx.fillStyle = g; ctx.fillRect(bx - 18, by - 24, 36, 36); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#ffe6b0"; ctx.fillRect(bx - 1.5, by - 9, 3, 4); }
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
  // The music hall's dome sings once it's rebuilt.
  if (built("hall")) { const h = CITY_HOUSES[3], cx = h.x + (h.w * 16 + 12) / 2; ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(cx, h.y, 4, cx, h.y, 70); g.addColorStop(0, "rgba(200,170,255,0.7)"); g.addColorStop(1, "rgba(180,140,255,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 70, h.y - 70, 140, 140); ctx.globalCompositeOperation = "source-over"; for (let q = 0; q < 3; q++) { const p = (t * 0.3 + q / 3) % 1; ctx.globalAlpha = Math.sin(Math.PI * p); ctx.fillStyle = "#efe6ff"; ctx.font = "14px Georgia"; ctx.fillText("♪", cx - 10 + q * 10, h.y - 30 - p * 60); } ctx.globalAlpha = 1; }
  // The bakery's warm awning.
  if (built("bakery")) { const h = CITY_HOUSES[1]; for (let q = 0; q < 5; q++) { ctx.fillStyle = q % 2 ? "#f2c48a" : "#b0573a"; ctx.fillRect(h.x - 4 + q * 9, 560, 9, 8); } ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(h.x + 22, 580, 2, h.x + 22, 580, 40); g.addColorStop(0, "rgba(255,190,110,0.6)"); g.addColorStop(1, "rgba(255,170,90,0)"); ctx.fillStyle = g; ctx.fillRect(h.x - 18, 540, 80, 80); ctx.globalCompositeOperation = "source-over"; }
  // The street.
  ctx.fillStyle = "#080a16"; ctx.fillRect(0, 590, CW, 130);
  if (built("fountain")) { ctx.fillStyle = "#1a2040"; ctx.beginPath(); ctx.ellipse(200, 600, 34, 8, 0, 0, Math.PI * 2); ctx.fill(); for (let q = 0; q < 16; q++) { const p = (t * 0.8 + q / 16) % 1, sd = q % 2 ? 1 : -1, x = 200 + sd * p * 26, y = 598 - Math.sin(Math.PI * p) * 34; ctx.fillStyle = `rgba(170,230,255,${0.8 - p * 0.5})`; ctx.fillRect(x - 1, y - 1, 2.4, 2.4); } }
  if (built("garden")) for (let q = 0; q < 18; q++) { const x = 8 + q * 22 + (q % 2) * 6, y = 596 + (q % 3) * 3; ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, q % 3 ? "rgba(150,255,190,0.8)" : "rgba(255,160,220,0.8)"); g.addColorStop(1, "rgba(150,255,190,0)"); ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18); ctx.globalCompositeOperation = "source-over"; }
  ctx.fillStyle = "#11152a"; for (let x = 0; x < CW; x += 26) ctx.fillRect(x + ((x / 26) % 2) * 6, 604 + ((x / 26) % 3) * 9, 18, 3);
  // Windows and lamps: dark until a light comes home to them; the newest ones bloom in.
  SLOTS.forEach((s, q) => {
    const on = q < home || (s.lamp && built("lamps")) || (!s.lamp && !s.far && built("houses")), fresh = on && q >= cityFrom && q < home && cityArrive > 0;
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
    const i = q, x = p.big ? 200 : 20 + ((i * 53) % 360), y = p.big ? 230 : 640 + Math.sin(t * 1.3 + i) * 6 - (i % 3) * 14, rad = p.big ? 0 : 7;
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
  $("citySub").textContent = residentsHome().length ? `${residentsHome().length} friends home · tap one to say hello` : "Find lost friends in your runs. They'll live here";
  $("cityGoName").textContent = (save.run || {}).best ? `Best ${(save.run.best).toLocaleString()}` : "Glide home through the dark";
  renderShop();
}
let cityPanel = "upgrades";
function openSheet(kind) { cityPanel = kind; renderShop(); $("todayPanel").hidden = true; $("sheet").hidden = false; }
function renderShop() {
  const glow = save.glow || 0;
  const head = { upgrades: ["Shop", `Upgrades for every run. You have ${glow.toLocaleString()} lights.`], build: ["Rebuild the city", `Bring the Singer's city back to life, one place at a time. You have ✦ ${glow}.`],
    friends: ["Friends", "Friends you've found can come with you. Each brings a gift."], stages: ["The city", "Every window is a home. Tap one to see who lives there."], locker: ["Locker", `Forms of light, glows, scarves and tethers. You have ✦ ${glow.toLocaleString()}.`], ranks: ["Ranks", "Your records on this phone"], awards: ["Awards", `${Object.keys(save.runAch || {}).length} of ${RUN_ACHS.length} earned`] }[cityPanel];
  $("shopTitle").textContent = head[0]; $("shopSub").textContent = head[1];
  if (cityPanel === "upgrades") $("shopList").innerHTML = runShopHtml();
  if (cityPanel === "build") $("shopList").innerHTML = CITY_BUILDS.map(b => `<li class="${built(b.id) ? "won" : ""}"><span><b>${b.name}</b><small>${b.text}</small></span>` + (built(b.id) ? "<em>Rebuilt</em>" : `<button data-build="${b.id}" ${glow >= b.cost ? "" : "disabled"}>✦ ${b.cost}</button>`) + "</li>").join("");
  if (cityPanel === "friends") {
    const met = save.runFriends || {}, as = playingAs();
    $("shopList").innerHTML = `<li><span><b>Bip</b><small>A little city robot</small></span>${as < 0 ? "<em>Playing</em>" : `<button data-char="-1">Play</button>`}</li>` +
      RUN_FRIENDS.map((f, i) => met[i] ? `<li><span><b>${f.name}</b><small>${FRIEND_PERKS[i]}</small></span>${as === i ? "<em>Playing</em>" : `<button data-char="${i}">Play</button>`}</li>` : `<li class="locked"><span><b>???</b><small>Still lost somewhere in the caves</small></span></li>`).join("");
  }
  if (cityPanel === "stages") $("shopList").innerHTML = stagesHtml();
  if (cityPanel === "locker") { $("shopList").innerHTML = lockerHtml(); drawLockerPreview(); }
  if (cityPanel === "ranks") $("shopList").innerHTML = ranksHtml();
  if (cityPanel === "awards") $("shopList").innerHTML = RUN_ACHS.map(a => `<li class="${(save.runAch || {})[a.id] ? "won" : "locked"}"><span><b>${a.name}</b><small>${a.text}</small></span><em>+${a.r} ✦</em></li>`).join("");
}
document.getElementById("shopList").addEventListener("click", e => {
  const rb = e.target.closest("button[data-run]");
  if (rb) { if (runBuy(rb.dataset.run)) renderCity(); return; }
  const bb = e.target.closest("button[data-build]");
  if (bb) { if (buildIt(bb.dataset.build)) { cityT = 0; renderCity(); } return; }
  const cb = e.target.closest("button[data-char]");
  if (cb) { runSave().char = +cb.dataset.char; persist(); sfx.tick(); renderShop(); return; }
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
  note(pitch(cityFloat.indexOf(near.f) % 7, 2), { dur: 0.6, vol: 0.05, fm: 2, echo: 0.8 });
});

// ---------- The locker: characters, hoodies, sneakers, boards ----------
const hex = c => "#" + (c >>> 0).toString(16).padStart(6, "0");
function lockerHtml() {
  const L = runnerLook(), glow = save.glow || 0, tile = (key, i, it, swatch, sub, cur) => {
    const own = L.own[key + i], tag = cur ? "Wearing" : own ? "Owned · tap to wear" : `✦ ${it.cost.toLocaleString()}`;
    return `<button class="lk-tile${cur ? " on" : ""}${own ? "" : " buy"}" data-lk="${key}:${i}" ${!own && glow < it.cost ? "disabled" : ""}><i style="--c:${swatch}"></i><b>${it.name}</b>${sub ? `<small>${sub}</small>` : ""}<em>${tag}</em></button>`;
  };
  const caps = save.capsules || 0, ch = runnerChar(), prism = "linear-gradient(90deg,#ff3d7f,#ffc23d,#3dffa8,#3d9eff,#b03dff)";
  const grid = (title, html) => `<li class="sec">${title}</li><li class="lk-grid">${html}</li>`;
  return `<li class="lk-prev"><canvas id="lkCanvas" width="360" height="260" aria-hidden="true"></canvas><div><small>You are</small><b>${ch.name}</b><span>${ch.perk}</span></div></li>` +
    `<li class="${caps ? "won" : "locked"}"><span><b>✦ ${caps} light capsule${caps === 1 ? "" : "s"}</b><small>Earn one by swinging 600 m or making 10 Perfects in a run</small></span>${caps ? `<button data-cap="1">Open</button>` : ""}</li>` +
    grid("Forms of light", RUNNER_CHARS.map((c, i) => tile("c", i, c, hex(c.look.glow), c.perk, L.char === i)).join("")) +
    grid("Glow", RUNNER_TOPS.map((c, i) => tile("t", i, c, hex(c.c ?? ch.look.glow), "", L.top === i)).join("")) +
    grid("Scarves", RUNNER_SHOES.map((c, i) => tile("s", i, c, c.c === "prism" ? prism : hex(c.c ?? runnerGlow()), c.twin ? "Two ribbons" : c.len > 30 ? "A long trail" : "", L.shoe === i)).join("")) +
    grid("Tethers", RUNNER_BOARDS.map((c, i) => tile("b", i, c, c.c === "prism" ? prism : hex(c.c), "", L.board === i)).join(""));
}
// The locker's preview: your figure of light swinging on its tether, in what you're wearing.
function drawLockerPreview() {
  const c = document.getElementById("lkCanvas"); if (!c) return;
  const x = c.getContext("2d"), W = c.width, H = c.height, L = runnerLook(), rgb = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const gc = rgb(runnerGlow()), sc = RUNNER_SHOES[L.shoe] || RUNNER_SHOES[0], bc = RUNNER_BOARDS[L.board] || RUNNER_BOARDS[0];
  const col = (v, a = 1) => v === "prism" ? `hsla(${(performance.now() / 8) % 360},90%,65%,${a})` : `rgba(${rgb(v ?? runnerGlow()).join(",")},${a})`;
  let t0 = performance.now();
  const frame = now => {
    if (c !== document.getElementById("lkCanvas") || document.getElementById("sheet").hidden) return;   // a newer preview took over
    const t = (now - t0) / 1000, ang = Math.sin(t * 1.6) * 0.55, ax = W / 2, ay = 18, len = 150, px = ax + Math.sin(ang) * len, py = ay + Math.cos(ang) * len;
    x.clearRect(0, 0, W, H);
    const g = x.createRadialGradient(px, py, 0, px, py, 90); g.addColorStop(0, `rgba(${gc.join(",")},0.45)`); g.addColorStop(1, `rgba(${gc.join(",")},0)`); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = col(bc.c); x.lineWidth = 3; x.beginPath(); x.moveTo(ax, ay); x.lineTo(px, py - 22); x.stroke();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(ax, ay, 6, 0, Math.PI * 2); x.fill();
    // Scarf: a ribbon trailing behind the swing.
    const n = Math.min(14, 6 + Math.round((sc.len || 20) / 4)), dir = -Math.cos(t * 1.6);
    for (const off of sc.twin ? [-4, 4] : [0]) { x.beginPath(); for (let q = 0; q <= n; q++) { const k = q / n, sx = px + dir * k * 70 + off, sy = py - 14 + k * 18 + Math.sin(t * 6 + k * 5) * 5 * k; q ? x.lineTo(sx, sy) : x.moveTo(sx, sy); } x.strokeStyle = col(sc.c, 0.85); x.lineWidth = 6; x.lineCap = "round"; x.stroke(); }
    // The figure.
    x.save(); x.translate(px, py); x.rotate(-ang); x.strokeStyle = "#fff"; x.lineWidth = 7; x.lineCap = "round";
    x.shadowColor = `rgb(${gc.join(",")})`; x.shadowBlur = 18;
    x.beginPath(); x.moveTo(0, -18); x.lineTo(0, 10); x.moveTo(0, -14); x.lineTo(-2, -24); x.moveTo(0, -12); x.lineTo(-12, -2); x.moveTo(0, 10); x.lineTo(-8, 30); x.moveTo(0, 10); x.lineTo(8, 28); x.stroke();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(0, -30, 9, 0, Math.PI * 2); x.fill(); x.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
// ---------- Ranks: your best runs ----------
function ranksHtml() {
  const r = runSave(), h = huntState(), today = dayNumber(), S = typeof stageSave === "function" ? stageSave() : { best: {} };
  const best = S.best || {}, lit = Object.values(best).filter(b => b && b.stars).length, stars = Object.values(best).reduce((a, b) => a + ((b && b.stars) || 0), 0), three = Object.values(best).filter(b => b && b.stars === 3).length;
  const ns = r.night && r.night.week === weekNumber() ? r.night.best : 0, ds = save.dailyStage && save.dailyStage.day === today ? save.dailyStage : null;
  const card = (big, label, sub) => `<div class="rk-card"><b>${big}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  let html = `<li class="rk-grid">${card(`${lit}<i>/60</i>`, "homes relit", lit >= 60 ? "Dawn is back" : `${60 - lit} waiting`)}${card(`${stars}<i>/180</i>`, "stars", `${three} perfect stages`)}${card(ns, "windows this week", "Night shift")}${card(ds ? ds.time.toFixed(1) + "s" : "–", "today's daily", ds ? "★".repeat(ds.stars || 1) : "Not played yet")}</li>`;
  html += `<li class="sec">Fastest in each district</li>`;
  for (let c = 0; c < STAGE_CHAPTERS.length; c++) {
    let f = null; for (let n = c * 10 + 1; n <= c * 10 + 10; n++) { const b = best[n]; if (b && b.time && (!f || b.time / stageInfo(n).par < f.k)) f = { n, t: b.time, k: b.time / stageInfo(n).par, s: b.stars }; }
    html += f ? `<li><span><b>${STAGE_CHAPTERS[c]}</b><small>Stage ${f.n} · ${stagePerson(f.n)[0]} · ${"★".repeat(f.s)}</small></span><em>${f.t.toFixed(1)} s${f.k <= 1 ? " · under par" : ""}</em></li>` : `<li class="locked"><span><b>${STAGE_CHAPTERS[c]}</b><small>No home reached here yet</small></span></li>`;
  }
  html += `<li class="sec">Hunts</li><li><span><b>Letter hunt</b><small>Find L·U·M·E·N in the sky today for ✦ 250</small></span><em>${HUNT.split("").map((ch, i) => (i < h.got.length ? ch : "·")).join(" ")}</em></li>`;
  return html;
}
document.getElementById("shopList").addEventListener("click", e => {
  const cb = e.target.closest("button[data-cap]");
  if (cb) { const got = openCapsule(); if (got) { sfx.unlock(); buzz(20); toast(`<b>Light capsule</b> ${got}`); } renderShop(); return; }
  const b = e.target.closest("button[data-lk]"); if (!b) return;
  const [k, i0] = b.dataset.lk.split(":"), i = +i0, L = runnerLook(), list = { c: RUNNER_CHARS, t: RUNNER_TOPS, s: RUNNER_SHOES, b: RUNNER_BOARDS }[k], it = list[i];
  if (!L.own[k + i]) { if ((save.glow || 0) < it.cost) return; save.glow -= it.cost; L.own[k + i] = 1; sfx.unlock(); buzz(20); } else sfx.tick();
  ({ c: () => (L.char = i), t: () => (L.top = i), s: () => (L.shoe = i), b: () => (L.board = i) })[k]();
  persist(); renderShop(); if (typeof renderTitle === "function") renderTitle();
});

// Lumen Rush: the sheets that slide up over the home screen. The city map (stages.js draws it),
// the locker (forms of light, glows, scarves and tethers, with a live preview), the upgrades
// shop, your ranks and the awards.
"use strict";

let cityPanel = "upgrades";
function openSheet(kind) { cityPanel = kind; renderShop(); $("todayPanel").hidden = true; $("sheet").hidden = false; }
function renderShop() {
  const glow = save.glow || 0;
  const head = { upgrades: ["Shop", `Upgrades for every run. You have ${glow.toLocaleString()} lights.`], stages: ["The city", "Every window is a home. Tap one to see who lives there."], locker: ["Locker", `Forms of light, glows, scarves and tethers. You have ✦ ${glow.toLocaleString()}.`], ranks: ["Ranks", "Your records on this phone"], awards: ["Awards", `${Object.keys(save.runAch || {}).length} of ${RUN_ACHS.length} earned`] }[cityPanel];
  $("shopTitle").textContent = head[0]; $("shopSub").textContent = head[1];
  if (cityPanel === "upgrades") $("shopList").innerHTML = runShopHtml();
  if (cityPanel === "stages") $("shopList").innerHTML = stagesHtml();
  if (cityPanel === "locker") { $("shopList").innerHTML = lockerHtml(); drawLockerPreview(); }
  if (cityPanel === "ranks") $("shopList").innerHTML = ranksHtml();
  if (cityPanel === "awards") $("shopList").innerHTML = RUN_ACHS.map(a => `<li class="${(save.runAch || {})[a.id] ? "won" : "locked"}"><span><b>${a.name}</b><small>${a.text}</small></span><em>+${a.r} ✦</em></li>`).join("");
}
document.getElementById("shopList").addEventListener("click", e => {
  const rb = e.target.closest("button[data-run]");
  if (rb && runBuy(rb.dataset.run)) renderShop();
  // Free swing: no dark, no hearts, no score. Try a look, practise Perfects, or just swing.
  if (e.target.closest("button[data-free]")) { $("sheet").hidden = true; playNow({ free: true }); }
});
// ---------- The locker: forms of light, glows, scarves and tethers ----------
const hex = c => "#" + (c >>> 0).toString(16).padStart(6, "0");
function lockerHtml() {
  const L = runnerLook(), glow = save.glow || 0, tile = (key, i, it, swatch, sub, cur) => {
    const own = L.own[key + i], earn = it.reward != null && !own, tag = cur ? "Wearing" : own ? "Owned · tap to wear" : earn ? `🔒 Relight ${STAGE_CHAPTERS[it.reward]}` : `✦ ${it.cost.toLocaleString()}`;
    return `<button class="lk-tile${cur ? " on" : ""}${own ? "" : " buy"}" data-lk="${key}:${i}" ${earn || (!own && glow < it.cost) ? "disabled" : ""}><i style="--c:${swatch}"></i><b>${it.name}</b>${sub ? `<small>${sub}</small>` : ""}<em>${tag}</em></button>`;
  };
  const caps = save.capsules || 0, ch = runnerChar(), prism = "linear-gradient(90deg,#ff3d7f,#ffc23d,#3dffa8,#3d9eff,#b03dff)";
  const grid = (title, html) => `<li class="sec">${title}</li><li class="lk-grid">${html}</li>`;
  return `<li class="lk-prev"><canvas id="lkCanvas" width="360" height="260" aria-hidden="true"></canvas><div><small>You are</small><b>${ch.name}</b><span>${ch.perk}</span><button class="lk-try" data-free="1">Try it in Free swing</button></div></li>` +
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
  const r = runSave(), h = huntState(), today = dayNumber(), S = stageSave();
  const best = S.best || {}, lit = Object.values(best).filter(b => b && b.stars).length, stars = Object.values(best).reduce((a, b) => a + ((b && b.stars) || 0), 0), three = Object.values(best).filter(b => b && b.stars === 3).length;
  const ns = r.night && r.night.week === weekNumber() ? r.night.best : 0, ds = save.dailyStage && save.dailyStage.day === today ? save.dailyStage : null;
  const card = (big, label, sub) => `<div class="rk-card"><b>${big}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  let html = `<li class="rk-grid">${card(`${lit}<i>/60</i>`, "homes relit", lit >= 60 ? "Dawn is back" : `${60 - lit} waiting`)}${card(`${stars}<i>/180</i>`, "stars", `${three} perfect stages`)}${card(ns, "windows this week", "Night shift")}${card(ds ? ds.time.toFixed(1) + "s" : "–", "today's daily", ds ? "★".repeat(ds.stars || 1) : "Not played yet")}</li>`;
  html += `<li class="sec">Fastest in each district</li>`;
  for (let c = 0; c < STAGE_CHAPTERS.length; c++) {
    let f = null; for (let n = c * 10 + 1; n <= c * 10 + 10; n++) { const b = best[n]; if (b && b.time && (!f || b.time / stageInfo(n).par < f.k)) f = { n, t: b.time, k: b.time / stageInfo(n).par, s: b.stars }; }
    html += f ? `<li><span><b>${STAGE_CHAPTERS[c]}</b><small>Stage ${f.n} · ${stagePerson(f.n)[0]} · ${"★".repeat(f.s)}</small></span><em>${f.t.toFixed(1)} s${f.k <= 1 ? " · under par" : ""}</em></li>` : `<li class="locked"><span><b>${STAGE_CHAPTERS[c]}</b><small>No home reached here yet</small></span></li>`;
  }
  { const rb = (save.rush || {}).best || {}, ks = Object.keys(rb).map(Number).sort((a, b) => b - a);
    if (ks.length) { html += `<li class="sec">Boss rush</li>`; for (const k of ks) html += `<li><span><b>${k} bosses in a row</b><small>One set of hearts</small></span><em>${rb[k].toFixed(1)} s</em></li>`; } }
  html += `<li class="sec">Hunts</li><li><span><b>Letter hunt</b><small>Find L·U·M·E·N in the sky today for ✦ 250</small></span><em>${HUNT.split("").map((ch, i) => (i < h.got.length ? ch : "·")).join(" ")}</em></li>`;
  return html;
}
document.getElementById("shopList").addEventListener("click", e => {
  const cb = e.target.closest("button[data-cap]");
  if (cb) { const got = openCapsule(); if (got) { sfx.unlock(); buzz(20); toast(`<b>Light capsule</b> ${got}`); } renderShop(); return; }
  const b = e.target.closest("button[data-lk]"); if (!b) return;
  const [k, i0] = b.dataset.lk.split(":"), i = +i0, L = runnerLook(), list = { c: RUNNER_CHARS, t: RUNNER_TOPS, s: RUNNER_SHOES, b: RUNNER_BOARDS }[k], it = list[i];
  if (!L.own[k + i]) { if (it.reward != null || (save.glow || 0) < it.cost) return; save.glow -= it.cost; L.own[k + i] = 1; sfx.unlock(); buzz(20); } else sfx.tick();
  ({ c: () => (L.char = i), t: () => (L.top = i), s: () => (L.shoe = i), b: () => (L.board = i) })[k]();
  persist(); renderShop(); renderTitle();
});

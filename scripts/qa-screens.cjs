// Opens every Skyrise screen and sheet tab at one phone size and language, saves a screenshot
// of each, and lists cut-off text, sideways scrolling, overlapping buttons, small touch
// targets and script errors. Serve a Skyrise build on :8811 first (npm run build:skyrise,
// then python3 -m http.server 8811 in dist/). Usage:
//   NODE_PATH=$(npm root -g) node scripts/qa-screens.cjs 375 667 en out/se-en
// Usage: node qa.js <width> <height> <lang> <outdir>
const { chromium } = require('playwright');
const [W, H, LANG, OUT] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], process.argv[5]];
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await p.goto('http://localhost:8811/?debug');
  await p.waitForFunction(() => window.__app, null, { timeout: 90000 });
  await p.evaluate((lang) => { const a = window.__app; Object.assign(a.save.profile, { towers: 12 }); a.save.tutorialDone = true; a.save.bestMeters = 240; a.save.best = 3200; a.save.stars = 40; a.save.settings.lang = lang; a.save.settings.flat = true; a.save.settings.quality = 'low'; a.persist(); }, LANG);
  await p.reload(); await p.waitForFunction(() => window.__app, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  const check = (name) => p.evaluate((name) => {
    const vw = innerWidth, out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    const vis = el => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const scrollParent = el => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    for (const el of document.querySelectorAll('body *')) {
      if (['CANVAS','svg','path','SCRIPT','STYLE'].includes(el.tagName) || el.closest('svg')) continue;
      if (!vis(el)) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const label = (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + ` "${el.textContent.trim().slice(0, 40)}"`;
      if (hasText && (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis')) { const rg = document.createRange(); rg.selectNodeContents(el); const room = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth); if (rg.getBoundingClientRect().width > room + 1.5) out.push('text cut: ' + label); }
      if (hasText && (cs.overflowY === 'hidden' || cs.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2 && cs.webkitLineClamp === 'none') out.push('text cut (height): ' + label);
      if (hasText && !scrollParent(el) && (r.right > vw + 1 || r.left < -1) && cs.position !== 'fixed') out.push(`off screen (${Math.round(r.left)}..${Math.round(r.right)}): ` + label);
    }
    // Buttons overlapping each other.
    const top = e => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && (h === e || e.contains(h) || h.contains(e)); };
    const btns = [...document.querySelectorAll('button, a.btn, [role=tab]')].filter(vis).filter(top).map(e => [e, e.getBoundingClientRect()]);
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const [a, ra] = btns[i], [c, rc] = btns[j];
      if (a.contains(c) || c.contains(a)) continue;
      const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
      if (ox > 4 && oy > 4) out.push(`buttons overlap: ${a.id || a.textContent.trim().slice(0, 20)} / ${c.id || c.textContent.trim().slice(0, 20)}`);
    }
    // Small touch targets.
    for (const [e, r] of btns) if ((r.width < 30 || r.height < 30) && e.textContent.trim().length < 3 && !e.closest('.seg')) out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ${e.id || e.getAttribute('aria-label') || e.className}`);
    return [...new Set(out)];
  }, name);
  const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${name}.png` }); const issues = await check(name); console.log(`== ${name}: ${issues.length ? '\n  ' + issues.join('\n  ') : 'ok'}`); };
  const closeAll = () => p.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => { const c = m.querySelector('.close-btn'); if (c) c.click(); else m.hidden = true; }); for (const id of ['welcome','mayor','levelup','starter','rewards']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  await shot('01-menu-popups');
  await closeAll(); await p.waitForTimeout(600);
  await shot('02-menu');
  const A = 'window.__app';
  const screens = [
    ['10-settings', `${A}.sheets.openSettings()`],
    ['11-help', `${A}.sheets.openHelp()`],
    ['12-skins', `${A}.sheets.openSkins()`],
    ['13-shop-towers', `${A}.sheets.openShop('towers')`],
    ['14-shop-crystals', `${A}.sheets.openShop('crystals')`],
    ['15-shop-boosts', `${A}.sheets.openShop('boosts')`],
    ['16-challenges', `${A}.sheets.openChallenges()`],
    ['17-profile', `${A}.sheets.openProfile()`],
    ['18-daily-gift', `${A}.showDaily()`],
    ['19-streak', `${A}.daily.openStreak()`],
    ['20-pass', `${A}.daily.openPass()`],
    ['21-missions', `${A}.daily.openMissions()`],
    ['22-city', `${A}.daily.openCity()`],
    ['23-ranks', `${A}.daily.openRanks()`],
    ['24-story', `${A}.openStory()`],
    ['25-starter', `${A}.openStarter()`],
  ];
  for (const [name, js] of screens) {
    try { await p.evaluate(js); } catch (e) { console.log(`== ${name}: could not open (${e.message.slice(0, 80)})`); continue; }
    await shot(name);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.modal:not([hidden]) [role=tab]')].length);
    for (let i = 1; i < tabs; i++) { await p.evaluate(i => [...document.querySelectorAll('.modal:not([hidden]) [role=tab]')][i].click(), i); await shot(`${name}-tab${i}`); }
    await closeAll(); await p.waitForTimeout(400);
  }
  // A tower: HUD, pause, results.
  await p.evaluate(() => window.__app.play('classic'));
  await p.waitForTimeout(4500);
  for (let k = 0; k < 3; k++) await p.evaluate(() => new Promise(res => { const a = window.__app; const t0 = performance.now(); const tick = () => { if (a.state !== 'playing' || performance.now() - t0 > 20000) return res(); if (a.countIn <= 0 && a.sim.mover && a.sim.wouldBePerfect()) { a.drop(); return res(); } requestAnimationFrame(tick); }; tick(); }));
  await shot('30-hud');
  await p.evaluate(() => document.getElementById('pause').click()); await shot('31-pause');
  await p.evaluate(() => { const b = [...document.querySelectorAll('#pause-menu button')].find(b => /resume|continue/i.test(b.id + b.textContent)); b?.click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__app.gameOver(true));
  await p.waitForTimeout(5000);
  await shot('32-results');
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();

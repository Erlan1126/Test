// Launch QA for Buildaroo: opens every screen at several phone sizes, saves a screenshot of
// each and audits the layout (cut-off text, things past the screen edge, buttons on top of each
// other, tap targets under 28 px, "undefined"/"NaN"/{placeholder} text) plus page errors.
// Needs Playwright with Chromium, and a build served on port 8765:
//   npm run build:city && (cd dist && python3 -m http.server 8765) &
//   SAVE=path/to/save.json SIZES=320x568,375x667,430x932 node scripts/qa-screens.cjs
// SAVE is optional (a skyrise.save.v2 JSON to start from); results go to OUT (default qa-out/).

const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'qa-out';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.SIZES || '320x568,375x667,430x932').split(',').map(s => s.split('x').map(Number));
const LANG = process.env.LANG2 || '';
const SCREENS = [
  ['home', ''],
  ['company', 'a.tycoon.openSheet("company")'],
  ['upgrades', 'a.tycoon.openSheet("upgrades")'],
  ['team', 'a.tycoon.openSheet("team")'],
  ['boosts', 'a.tycoon.openSheet("boosts")'],
  ['build', 'a.tycoon.openBuild()'],
  ['goals', 'a.tycoon.openGoals()'],
  ['more', 'a.tycoon.openMore()'],
  ['earnings', 'a.tycoon.openEarnings()'],
  ['collection', 'a.tycoon.openCollection()'],
  ['scrapbook', 'a.tycoon.openScrapbook()'],
  ['land', 'a.tycoon.openLand()'],
  ['spin', 'a.tycoon.openSpin()'],
  ['advent', 'a.tycoon.openAdvent()'],
  ['shop-town', 'a.openShop("town")'],
  ['shop-crystals', 'a.openShop("crystals")'],
  ['shop-boosts', 'a.openShop("boosts")'],
  ['starter', 'a.openStarter()'],
  ['help', 'a.sheets.openHelp()'],
  ['profile', 'a.sheets.openProfile("journey")'],
  ['profile-stats', 'a.sheets.openProfile("stats")'],
  ['profile-trophies', 'a.sheets.openProfile("trophies")'],
  ['settings', 'a.sheets.openSettings()'],
  ['story', 'a.openStory()'],
  ['tab-company', 'a.tycoon.openTab("company")'],
  ['tab-goals', 'a.tycoon.openTab("goals")'],
  ['tab-me', 'a.tycoon.openTab("me")'],
  ['tab-shop', 'a.tycoon.openTab("shop")'],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const audit = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const vis = e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return false; } return true; };
  const open = [...document.querySelectorAll('.modal:not([hidden]), .overlay:not([hidden])')].filter(vis);
  const roots = open.length ? open : [document.body];
  const name = e => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName;
  const txt = e => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  for (const root of roots) for (const e of root.querySelectorAll('*')) {
    if (!vis(e) || e.closest('canvas, svg')) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const t = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    // Cut-off text: an element clips its own text.
    if (t && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2) out.push(['CLIP', name(e), txt(e)]);
    if (t && cs.webkitLineClamp !== 'none' && cs.webkitLineClamp && e.scrollHeight > e.clientHeight + 2) out.push(['CLAMP', name(e), txt(e)]);
    // Past the screen's sides (not inside a sideways scroller).
    let sc = false; for (let x = e.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { sc = true; break; } }
    if (!sc && (r.right > vw + 1 || r.left < -1) && r.width < vw * 1.5) out.push(['OFFSCREEN', name(e), `${Math.round(r.left)}..${Math.round(r.right)} ${txt(e)}`]);
    if ((e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && (r.width < 28 || r.height < 28)) out.push(['TINY', name(e), `${Math.round(r.width)}x${Math.round(r.height)} ${txt(e)}`]);
    if (t && /undefined|NaN|\{[a-z]+\}|null\b|\[object/.test(e.textContent)) out.push(['BADTEXT', name(e), txt(e)]);
  }
  // Buttons on top of one another.
  for (const root of roots) {
    const bs = [...root.querySelectorAll('button')].filter(vis).map(b => [b, b.getBoundingClientRect()]);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const [a, ra] = bs[i], [b, rb] = bs[j];
      if (a.contains(b) || b.contains(a)) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4 && w * h > 0.15 * Math.min(ra.width * ra.height, rb.width * rb.height)) out.push(['OVERLAP', name(a) + ' / ' + name(b), txt(a) + ' / ' + txt(b)]);
    }
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|net::/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    if (process.env.SAVE) {
      const save = JSON.parse(fs.readFileSync(process.env.SAVE, 'utf8'));
      if (LANG) save.settings.lang = LANG;
      await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('skyrise.save.v2', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(save));
    }
    await p.goto('http://localhost:8765/?debug'); await p.waitForTimeout(12000);
    // Close the welcome-back and anything else that opened on its own.
    for (let k = 0; k < 4; k++) await p.evaluate(() => { const b = [...document.querySelectorAll('.modal:not([hidden]) button, .overlay:not([hidden]) button')].find(b => b.offsetParent && /^(collect|ok|got it|close|×|later|not now|continue|let.s go!?|claim|see you tomorrow!?)$/i.test(b.textContent.trim())); if (b) b.click(); }), await p.waitForTimeout(1200);
    for (const [id, js] of SCREENS) {
      if (only && !only.includes(id)) continue;
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => { document.querySelectorAll('.modal:not([hidden])').forEach(m => { const x = m.querySelector('.close-btn, .tab-x'); if (x) x.click(); }); });
      await p.waitForTimeout(700);
      if (js) { const r = await p.evaluate(code => { try { const a = window.__app; eval(code); return 'ok'; } catch (e) { return 'ERR ' + e.message; } }, js); if (r !== 'ok') { (report[id] ??= {})[`${w}x${h}`] = [['OPENFAIL', '', r]]; continue; } }
      await p.waitForTimeout(+(process.env.WAIT || 2200));
      const issues = await p.evaluate(audit);
      (report[id] ??= {})[`${w}x${h}`] = issues;
      await p.screenshot({ path: `${OUT}/${id}-${w}.png`, timeout: 90000 }).catch(e => console.log('SHOTFAIL', id, w));
      fs.writeFileSync(`${OUT}/report-${w}.json`, JSON.stringify(report, null, 1));
    }
    report._errors = (report._errors || []).concat(errs.map(e => `${w}: ${e}`));
    await p.close();
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const [id, by] of Object.entries(report)) {
    if (id === '_errors') continue;
    const seen = new Set();
    for (const [sz, list] of Object.entries(by)) for (const it of list) { const k = it.join(' | '); if (seen.has(k)) continue; seen.add(k); console.log(`${id} @${sz}: ${k}`); }
  }
  console.log('ERRORS:', [...new Set(report._errors)].join('\n'));
  await b.close();
})();

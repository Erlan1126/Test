// A brand-new player's first session: launch, first tap, the tutorial floors, a miss and the
// rewind offer, the first results card and the trip home. Same setup as qa-screens.cjs.
//   NODE_PATH=$(npm root -g) node scripts/qa-first-session.cjs 375 667 out/first
const { chromium } = require('playwright');
const [W, H, OUT] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|AudioContext/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', ...a);
  await p.goto('http://localhost:8811/?debug');
  await p.waitForFunction(() => window.__app, null, { timeout: 90000 });
  await p.evaluate(() => { const a = window.__app; a.save.settings.flat = true; a.save.settings.quality = 'low'; a.persist(); });
  await p.reload(); await p.waitForFunction(() => window.__app, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  const shot = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); log(n, '| state', await p.evaluate(() => window.__app.state), '| hint:', await p.evaluate(() => document.getElementById('hint').hidden ? '' : document.getElementById('hint').textContent), '| visible:', await p.evaluate(() => ['mayor','welcome','levelup','starter','rewards','rescue','over','banner','daily-rewards'].filter(id => { const e = document.getElementById(id); return e && !e.hidden; }).join(','))); };
  await shot('f01-launch');
  await p.mouse.click(W / 2, H * 0.62);
  await p.waitForTimeout(1200);
  await shot('f02-first-tap');
  const drop = (mode) => p.evaluate((mode) => new Promise(res => { const a = window.__app; const t = performance.now(); const tick = () => { if (a.state !== 'playing' || performance.now() - t > 30000) return res(a.state); const s = a.sim, m = s.mover; if (a.countIn <= 0 && m) { const top = s.stack[s.stack.length - 1], ax = m.axis; const ok = mode === 'perfect' ? s.wouldBePerfect() : mode === 'miss' ? (m[ax + '1'] < top[ax + '0'] || m[ax + '0'] > top[ax + '1']) : Math.abs((m[ax + '0'] + m[ax + '1']) / 2 - (top[ax + '0'] + top[ax + '1']) / 2) > (top[ax + '1'] - top[ax + '0']) * 0.25; if (ok) { a.drop(); return res('dropped'); } } requestAnimationFrame(tick); }; tick(); }), mode);
  for (let i = 1; i <= 7; i++) { await drop(i === 2 || i === 5 ? 'off' : 'perfect'); await p.waitForTimeout(500); await shot(`f03-floor${i}`); }
  // Miss: the rescue offer.
  for (let k = 0; k < 6 && (await p.evaluate(() => window.__app.state)) === 'playing'; k++) { await drop('miss'); await p.waitForTimeout(1500); }
  await shot('f04-after-miss');
  if ((await p.evaluate(() => window.__app.state)) === 'rescue') {
    await p.evaluate(() => { const b = [...document.querySelectorAll('#rescue button')].find(b => /end/i.test(b.textContent) || /no|end|decline/i.test(b.id)); b?.click(); });
  }
  await p.waitForTimeout(6000);
  await shot('f05-results');
  await p.waitForTimeout(3000);
  await shot('f06-results-later');
  await p.evaluate(() => { const b = [...document.querySelectorAll('#over button')].find(b => b.offsetParent && /home|menu/i.test(b.id + (b.getAttribute('aria-label') || ''))); b?.click(); });
  await p.waitForTimeout(3500);
  await shot('f07-back-home');
  await p.evaluate(() => { const ok = document.querySelector('#mayor:not([hidden]) #mayor-ok, #levelup:not([hidden]) button, #rewards:not([hidden]) button'); ok?.click(); });
  await p.waitForTimeout(2500);
  await shot('f08-home-after-popup');
  log('ERRORS', JSON.stringify(errs));
  await b.close();
})();

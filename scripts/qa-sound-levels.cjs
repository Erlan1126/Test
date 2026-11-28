// Renders every game sound offline and prints its peak and loudest 300 ms (dB), to keep
// levels consistent. Same setup as qa-screens.cjs.
//   NODE_PATH=$(npm root -g) node scripts/qa-sound-levels.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8811/?debug');
  await p.waitForFunction(() => window.__app, null, { timeout: 90000 });
  const names = ['click','counter','whoosh','land','cut','perfect:1','perfect:5','perfect:10','widen','ice','garden','fever','firework','cheer','streak','golden','milestone','layer:1','layer:4','unlock','star','coins','purchase','wind','rewind','win','fail','tada','hammer'];
  const res = await p.evaluate(async (names) => {
    const Sound = window.__app.sound.constructor;
    class Off extends OfflineAudioContext { constructor() { super(2, 48000 * 3, 48000); } resume() { return Promise.resolve(); } get state() { return 'running'; } }
    window.AudioContext = Off;
    const out = [];
    for (const n of names) {
      const [fn, arg] = n.split(':');
      const s = new Sound(() => ({ sound: true, music: false, vibrate: false }));
      s.ensure();
      if (typeof s[fn] !== 'function') { out.push([n, 'missing']); continue; }
      try { s[fn](arg !== undefined ? Number(arg) : undefined); } catch (e) { out.push([n, 'error ' + e.message]); continue; }
      const buf = await s.ac.startRendering();
      const d = buf.getChannelData(0), e2 = buf.getChannelData(1);
      let peak = 0, sum = 0, cnt = 0, last = 0;
      for (let i = 0; i < d.length; i++) { const v = Math.max(Math.abs(d[i]), Math.abs(e2[i])); if (v > peak) peak = v; if (v > 0.001) last = i; }
      // RMS over the loudest 300 ms window.
      const w = 14400; let best = 0, acc = 0;
      for (let i = 0; i < d.length; i++) { acc += d[i] * d[i]; if (i >= w) acc -= d[i - w] * d[i - w]; if (i >= w - 1) best = Math.max(best, acc / w); }
      out.push([n, (20 * Math.log10(peak + 1e-9)).toFixed(1), (20 * Math.log10(Math.sqrt(best) + 1e-9)).toFixed(1), (last / 48000).toFixed(2)]);
    }
    return out;
  }, names);
  console.log('sound          peak dB   loudest-300ms RMS dB   length s');
  for (const r of res) console.log(r[0].padEnd(14), String(r[1]).padStart(7), String(r[2] ?? '').padStart(10), String(r[3] ?? '').padStart(10));
  await b.close();
})();

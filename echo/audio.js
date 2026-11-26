// Lumen Rush: sound effects and the generated background music.
"use strict";

// ---------- Audio ----------
let AC = null, master = null, sfxBus = null, musicBus = null, echoBus = null, muted = false;   // (an old mute flag from the cave game is ignored: the volume sliders control sound)
// The key and scale the sound effects play in.
const mood = { root: 220.0, scale: [0, 3, 5, 7, 10] };
const pitch = (deg, oct = 0) => {
  const n = mood.scale.length, d = ((deg % n) + n) % n;
  return mood.root * Math.pow(2, (mood.scale[d] + 12 * (oct + Math.floor(deg / n))) / 12);
};
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.connect(AC.destination);
      sfxBus = AC.createGain();
      musicBus = AC.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      // A feedback delay gives every sound an echo.
      echoBus = AC.createGain();
      const delay = AC.createDelay(1);
      delay.delayTime.value = 0.27;
      const fb = AC.createGain();
      fb.gain.value = 0.4;
      const lp = AC.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2000;
      echoBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master);
      fb.gain.value = 0.28;
      // A reverb: a long, darkening tail made from decaying noise.
      const verb = AC.createConvolver(), len = Math.floor(AC.sampleRate * 2.8);
      const ir = AC.createBuffer(2, len, AC.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lpState = 0;
        for (let k = 0; k < len; k++) {
          const p = k / len;
          lpState += (Math.random() * 2 - 1 - lpState) * (0.55 - p * 0.45);  // darker as it fades
          d[k] = lpState * Math.pow(1 - p, 2.6);
        }
      }
      verb.buffer = ir;
      const verbGain = AC.createGain();
      verbGain.gain.value = 0.55;
      echoBus.connect(verb); verb.connect(verbGain); verbGain.connect(master);
      applyVolumes();
      setInterval(musicTick, 60);
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === "suspended") AC.resume();
}
function applyVolumes() {
  if (!AC) return;
  master.gain.value = muted ? 0 : 1;
  sfxBus.gain.value = save.settings.sfx * 0.75;
  musicBus.gain.value = save.settings.music * 0.6;
}
function note(freq, o = {}) {
  if (!AC) return;
  const t = Math.max(AC.currentTime, o.time || AC.currentTime + (o.at || 0));
  const dur = o.dur || 0.5, vol = o.vol || 0.15;
  const osc = AC.createOscillator(), g = AC.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  // Bell tone: a second oscillator bends the first one's pitch, brightly at first, then fades.
  if (o.fm) {
    const mod = AC.createOscillator(), mg = AC.createGain();
    mod.frequency.value = freq * o.fm;
    mg.gain.setValueAtTime(freq * (o.fmDepth || 1.2), t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.7);
    mod.connect(mg); mg.connect(osc.frequency);
    mod.start(t); mod.stop(t + dur + 0.05);
  }
  // Chorus: a slightly detuned twin makes pads warm and wide.
  if (o.chorus) {
    const twin = AC.createOscillator();
    twin.type = osc.type;
    twin.frequency.value = freq;
    twin.detune.value = o.chorus;
    osc.detune.value = -o.chorus;
    twin.connect(g);
    twin.start(t); twin.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = g;
  if (o.lowpass) {
    const f = AC.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = o.lowpass;
    g.connect(f); out = f;
  }
  osc.connect(g);
  const bus = o.music ? musicBus : sfxBus;
  // Sounds from things to your left or right come from that side (best with headphones).
  if (o.pan && AC.createStereoPanner) {
    const p = AC.createStereoPanner();
    p.pan.value = Math.max(-0.9, Math.min(0.9, o.pan));
    out.connect(p);
    out = p;
  }
  out.connect(bus);
  if (o.echo !== 0) {
    const s = AC.createGain();
    s.gain.value = (o.echo == null ? 0.6 : o.echo) * (o.music ? save.settings.music * 0.6 : save.settings.sfx * 0.75);
    out.connect(s); s.connect(echoBus);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Background music: an electronic groove (below) whose key, chords and tempo come from the
// district you're in.
const music = { kicks: [], root: 0, on: false, layers: 0, step: 0, next: 0, intensity: 0, district: null };
function musicStart(seed, layers) {
  music.layers = layers; music.intensity = 0;
  if (!music.on && AC) { music.step = 0; music.next = AC.currentTime + 0.15; }
  music.on = true;
}
function musicStop() { music.on = false; }
function musicTick() {
  if (!AC || !music.on || muted || AC.state !== "running") { if (AC) music.next = AC.currentTime + 0.1; return; }
  beatTick();
}

// The swing's music: an upbeat electronic groove (in A minor unless the district says otherwise). Kick on every beat, claps on two and
// four, shuffling hats, a pumping bass and syncopated chord stabs; a lead joins on long combos.
// It gets a little faster and fuller the faster you run.
const BEAT_SCALE = [0, 2, 3, 5, 7, 8, 10], BEAT_PROG = [0, 5, 2, 6];
const beatHz = (deg, oct) => ((music.district && music.district.base) || 110) * Math.pow(2, (BEAT_SCALE[((deg % 7) + 7) % 7] + 12 * (oct + Math.floor(deg / 7))) / 12);
// How hard the beat is hitting right now: 1 on a kick, fading over about a tenth of a second.
function beatPulse() { if (!AC || !music.on || !music.kicks.length) return 0; const now = AC.currentTime; let last = -1; for (const k of music.kicks) if (k <= now) last = k; return last < 0 ? 0 : Math.exp(-(now - last) * 9); }
function beatTick() {
  const D = music.district || {}, bpm = (D.bpm || 116) + (music.intensity || 0) * 14, step = 60 / bpm / 4, PROG = D.prog || BEAT_PROG;
  while (music.next < AC.currentTime + 0.3) {
    const k = music.step, t = music.next, bar = Math.floor(k / 16), root = PROG[bar % 4], s = k % 16, full = music.layers >= 2;
    if (s % 4 === 0) { note(150, { time: t, dur: 0.28, vol: 0.32, glide: 42, echo: 0, attack: 0.003, music: true }); music.kicks.push(t); if (music.kicks.length > 8) music.kicks.shift(); }
    music.root = root;
    // Each district's own sounds under the music.
    const A = D.amb, rnd = Math.random();
    if (A === 0 && s === 0 && bar % 2 === 0) noise({ time: t, filter: "lowpass", freq: 160, q: 0.5, dur: step * 30, attack: 1.2, vol: 0.02, music: true });
    else if (A === 1 && s === 10 && rnd < 0.5) note(beatHz(root + [4, 7, 9, 11][Math.floor(rnd * 8) % 4], 3), { time: t, dur: 1.2, vol: 0.012, type: "triangle", echo: 1, music: true });
    else if (A === 2 && s === 0 && bar % 2 === 0) noise({ time: t, filter: "lowpass", freq: 300, glide: 900, q: 0.7, dur: step * 28, attack: 1.4, vol: 0.035, music: true });
    else if (A === 3 && s % 2 === 1 && rnd < 0.12) note(beatHz(root + [0, 2, 4, 7][Math.floor(rnd * 32) % 4], 3), { time: t, dur: 0.06, vol: 0.01, type: "square", lowpass: 3500, music: true });
    else if (A === 4 && s % 4 === 2) for (let q = 0; q < 2; q++) noise({ time: t + q * 0.05, filter: "bandpass", freq: 4800, q: 8, dur: 0.035, attack: 0.002, vol: 0.012, music: true });
    else if (A === 5 && s === 0 && bar % 2 === 0) noise({ time: t, filter: "bandpass", freq: 500, glide: 1100, q: 1.2, dur: step * 30, attack: 1.6, vol: 0.022, music: true });
    if (s === 4 || s === 12) noise({ time: t, filter: "bandpass", freq: 1700, q: 0.7, dur: 0.16, attack: 0.002, vol: 0.16, music: true });
    if (full && s % 2 === 0) noise({ time: t, filter: "highpass", freq: 8500, q: 0.5, dur: s % 4 === 2 ? 0.12 : 0.04, attack: 0.001, vol: s % 4 === 2 ? 0.05 : 0.03, music: true });
    if (s % 2 === 0) note(beatHz(root, -1) * (s % 8 === 6 ? 2 : 1), { time: t, dur: step * 1.7, vol: 0.09, type: "sawtooth", lowpass: 380 + (music.intensity || 0) * 500, attack: 0.004, echo: 0, music: true });
    if (full && (s === 0 || s === 6 || s === 10)) [0, 2, 4].forEach(d => note(beatHz(root + d, 1), { time: t, dur: step * 2.2, vol: 0.022, type: "sawtooth", chorus: 8, lowpass: 1800, attack: 0.005, echo: 0.25, music: true }));
    // A lead melody joins on long Perfect chains: a little phrase in the district's key.
    if (music.layers >= 4 && (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14)) { const mel = [4, 2, 4, 7, 6, 4][[0, 3, 6, 8, 11, 14].indexOf(s)] + (bar % 2 ? 2 : 0); note(beatHz(root + mel, 2), { time: t, dur: step * 2.6, vol: 0.026, type: "triangle", lowpass: 3200, attack: 0.01, echo: 0.5, music: true }); }
    if (music.layers >= 3 && s % 2 === 0) { const arp = [0, 2, 4, 7, 4, 2, 7, 9][(s / 2) % 8]; note(beatHz(root + arp, 2), { time: t, dur: step * 1.6, vol: 0.02, type: "square", lowpass: 2600, attack: 0.003, echo: 0.4, music: true }); }
    music.step++; music.next += step;
  }
}

const sfx = {
  coin(n = 0) { const p = [0, 2, 4, 7, 9][n % 5] + 12 * Math.min(2, Math.floor(n / 5) % 3); note(988 * Math.pow(2, p / 12), { dur: 0.13, vol: 0.07, type: "square", lowpass: 4200, attack: 0.002, echo: 0.15 }); note(1976 * Math.pow(2, p / 12), { at: 0.04, dur: 0.1, vol: 0.03, type: "triangle", echo: 0 }); },
  jump() { noise({ filter: "highpass", freq: 900, glide: 3200, dur: 0.22, attack: 0.01, vol: 0.07 }); note(330, { dur: 0.16, vol: 0.06, type: "square", lowpass: 1600, glide: 660, attack: 0.003, echo: 0 }); },
  land() { note(110, { dur: 0.1, vol: 0.12, glide: 60, echo: 0, attack: 0.002 }); },
  crash() { noise({ filter: "lowpass", freq: 1800, glide: 120, dur: 0.6, attack: 0.002, vol: 0.3 }); note(90, { dur: 0.45, vol: 0.3, glide: 35, echo: 0.2, attack: 0.002 }); note(220, { at: 0.02, dur: 0.25, vol: 0.08, type: "square", lowpass: 900, glide: 80, echo: 0 }); },
  power() { [0, 4, 7, 12, 16].forEach((d, i) => note(523 * Math.pow(2, d / 12), { at: i * 0.05, dur: 0.3, vol: 0.06, type: "square", lowpass: 3000, echo: 0.3 })); },
  close() { noise({ filter: "bandpass", freq: 600, glide: 2400, q: 1.2, dur: 0.3, attack: 0.02, vol: 0.12 }); },
  // A star landing on the end card: each one a step higher; the third rings longer.
  star(i = 0) { const d = [0, 4, 7][i] || 0; note(659.25 * Math.pow(2, d / 12), { dur: i === 2 ? 0.9 : 0.35, vol: 0.07, type: "triangle", echo: 0.6 }); note(1318.5 * Math.pow(2, d / 12), { at: 0.02, dur: 0.25, vol: 0.03, fm: 3, fmDepth: 0.5, echo: 0.6 }); if (i === 2) [12, 16, 19].forEach((x, k) => note(659.25 * Math.pow(2, x / 12), { at: 0.18 + k * 0.07, dur: 0.8, vol: 0.04, type: "triangle", echo: 0.8 })); },
  clear() { note(784, { dur: 0.12, vol: 0.05, type: "triangle", echo: 0.2 }); note(1175, { at: 0.06, dur: 0.16, vol: 0.05, type: "triangle", echo: 0.2 }); },
  // Letting go: a soft whoosh (the number moves it a little to one side).
  whoosh: (dx = 0) => noise({ freq: 400, glide: 1200, q: 1.2, dur: 0.5, attack: 0.15, vol: 0.06, pan: dx / 3, echo: 0.5 }),
  // A Perfect rings the current chord of the music, a step higher with each one in a chain.
  perfect(n = 1) { if (music.on) { const up = Math.min(6, n - 1); [0, 2, 4].forEach((d, i) => note(beatHz(music.root + d + up, 2), { at: i * 0.045, dur: 0.26, vol: 0.06, type: "triangle", echo: 0.4 })); return; } const p = Math.min(14, (n - 1) * 2); [0, 4, 7].forEach((d, i) => note(784 * Math.pow(2, (d + p) / 12), { at: i * 0.045, dur: 0.22, vol: 0.06, type: "triangle", echo: 0.35 })); },
  flip() { [0, 7, 12].forEach((d, i) => note(659 * Math.pow(2, d / 12), { at: i * 0.06, dur: 0.18, vol: 0.06, type: "square", lowpass: 3200, echo: 0.3 })); },
  bump() { note(140, { dur: 0.16, vol: 0.12, glide: 70, echo: 0.2 }); },
  light() { [0, 2, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.07, dur: 0.9, vol: 0.09, fm: 3.5, fmDepth: 0.8, echo: 0.8 })); },
  fail() { [4, 3, 2, 0].forEach((d, i) => note(pitch(d, 0), { at: i * 0.18, dur: 0.7, vol: 0.09, type: "triangle" })); },
  win() {
    [0, 2, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.11, dur: 1.4, vol: 0.09 }));
    note(pitch(0, -1), { dur: 1.8, vol: 0.08, type: "triangle" });
  },
  gate() { note(pitch(0, -2), { dur: 1.6, vol: 0.14, type: "sawtooth", lowpass: 500, attack: 0.2, echo: 0.6 }); [0, 4, 7, 12].forEach((d, i) => note(pitch(d, 0), { at: 0.2 + i * 0.09, dur: 1.2, vol: 0.06 })); },
  tick() { note(1400, { dur: 0.05, vol: 0.05, type: "square", lowpass: 2500, echo: 0 }); },
  unlock() { [0, 4, 7, 9, 14].forEach((d, i) => note(pitch(d, 0), { at: i * 0.08, dur: 0.8, vol: 0.07 })); },
};
// Filtered noise: hats, claps and whooshes.
let noiseBuf = null;
function noise(o = {}) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; }
  const t = o.time ? Math.max(AC.currentTime, o.time) : AC.currentTime + (o.at || 0), dur = o.dur || 0.5;
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = o.filter || "bandpass"; f.frequency.setValueAtTime(o.freq || 800, t); f.Q.value = o.q || 1;
  if (o.glide) f.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g);
  let out = g;
  if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-0.95, Math.min(0.95, o.pan)); g.connect(p); out = p; }
  out.connect(o.music ? musicBus : sfxBus);
  if (o.echo) { const s = AC.createGain(); s.gain.value = o.echo * save.settings.sfx * 0.75; out.connect(s); s.connect(echoBus); }
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
// Reeling in: a soft tick that climbs as the rope gets shorter.
sfx.reel = (k = 0) => note(520 + k * 520, { dur: 0.045, vol: 0.022, type: "triangle", attack: 0.004 });
// A window lights up: a warm rising chord with a bell on top.
sfx.home = () => { [0, 4, 7, 12, 16].forEach((d, i) => note(261.63 * Math.pow(2, d / 12), { at: i * 0.07, dur: 1.4, vol: 0.05, type: "triangle", attack: 0.01, echo: 0.9 })); note(1046.5, { at: 0.38, dur: 2, vol: 0.035, fm: 3.5, fmDepth: 0.6, echo: 1 }); };
function buzz(ms) { try { if (save.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

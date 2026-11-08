// Echo: sound effects and the generated background music.
"use strict";

// ---------- Audio ----------
let AC = null, master = null, sfxBus = null, musicBus = null, echoBus = null, muted = !!save.muted;
// Each world has its own key, scale and background sound.
const MOODS = [
  { root: 220.0,  scale: [0, 3, 5, 7, 10], ambient: "drip" },
  { root: 196.0,  scale: [0, 2, 4, 7, 9],  ambient: "bubble" },
  { root: 174.61, scale: [0, 2, 3, 7, 8],  ambient: "chime" },
  { root: 146.83, scale: [0, 3, 5, 7, 10], ambient: "crackle" },
  { root: 246.94, scale: [0, 2, 4, 7, 11], ambient: "chime" },
  { root: 164.81, scale: [0, 2, 4, 7, 9],  ambient: "bubble" },
  { root: 207.65, scale: [0, 2, 4, 7, 9],  ambient: "drip" },
  { root: 185.0,  scale: [0, 3, 5, 7, 10], ambient: "chime" },
];
let mood = MOODS[0];
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
      // A feedback delay gives every sound a cave echo.
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
      // A cave reverb: a long, darkening tail made from decaying noise.
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
  // Sounds from things to Lumi's left or right come from that side (best with headphones).
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

// Background music: a soft pad, a slow bass and a quiet arpeggio, then a melody that
// joins in once you find a light. Patterns come from the level's seed, so each cave has its own tune.
const music = { on: false, layers: 0, step: 0, next: 0, arp: [], mel: [], bass: [], tension: 0 };
function musicStart(seed, layers) {
  const r = seeded(seed * 31 + 7);
  music.arp = Array.from({ length: 16 }, (_, k) => (k % 2 && r() < 0.35 ? -1 : Math.floor(r() * 7)));
  music.mel = Array.from({ length: 32 }, () => (r() < 0.45 ? -1 : 2 + Math.floor(r() * 6)));
  music.bass = Array.from({ length: 4 }, (_, k) => (k ? [0, 3, 4, 2, 5][Math.floor(r() * 5)] : 0));
  music.layers = layers;
  music.tension = 0;
  if (!music.on && AC) { music.step = 0; music.next = AC.currentTime + 0.15; }
  music.on = true;
}
function musicStop() { music.on = false; music.tension = 0; }
function musicTick() {
  if (!AC || !music.on || muted || AC.state !== "running") { if (AC) music.next = AC.currentTime + 0.1; return; }
  const beat = 60 / 84 / 2;
  while (music.next < AC.currentTime + 0.3) {
    const k = music.step, t = music.next;
    // Warm pad chords swell in slowly; a soft bass; bell-like arpeggio and melody on top.
    if (k % 16 === 0) [0, 2, 4].forEach((d, q) => note(pitch(d + music.bass[(k / 16) % 4], -1), { time: t + q * 0.07, dur: beat * 18, vol: 0.03, attack: 2, type: "sawtooth", chorus: 9, lowpass: 650, echo: 0.5, music: true }));
    if (music.layers >= 1 && k % 4 === 0) note(pitch(music.bass[Math.floor(k / 16) % 4], -2), { time: t, dur: beat * 3.5, vol: 0.08, type: "triangle", lowpass: 400, attack: 0.03, echo: 0.1, music: true });
    const ten = music.tension, calm = 1 - ten * 0.8;
    if (ten > 0.15 && k % 2 === 0) note(mood.root / 4, { time: t, dur: beat * 1.2, vol: 0.09 * ten, type: "triangle", lowpass: 220, attack: 0.01, echo: 0.1, music: true });
    if (ten > 0.3 && k % 16 === 0) { note(mood.root / 2, { time: t, dur: beat * 16, vol: 0.03 * ten, type: "sawtooth", lowpass: 380, attack: 1, chorus: 14, echo: 0.4, music: true }); note(mood.root / 2 * Math.SQRT2, { time: t, dur: beat * 16, vol: 0.022 * ten, type: "sawtooth", lowpass: 380, attack: 1.4, chorus: 14, echo: 0.4, music: true }); }
    if (music.layers >= 2 && music.arp[k % 16] >= 0) note(pitch(music.arp[k % 16], 0), { time: t, dur: beat * 2.4, vol: (music.layers >= 3 ? 0.028 : 0.018) * calm, fm: 2.01, fmDepth: 0.9, echo: 0.8, music: true });
    if (music.layers >= 3 && k % 2 === 0 && music.mel[(k / 2) % 32] >= 0) note(pitch(music.mel[(k / 2) % 32], 1), { time: t, dur: beat * 4, vol: 0.024 * calm, fm: 3.5, fmDepth: 0.6, echo: 1, music: true });
    music.step++;
    music.next += beat;
  }
}

const sfx = {
  ping(n) {
    const f = pitch(n % 7, 1);
    note(f, { dur: 1.2, vol: 0.15, fm: 2.01, fmDepth: 1.4, echo: 0.9 });
    note(f * 2, { dur: 0.6, vol: 0.03, type: "triangle", echo: 0.6 });
  },
  longSong(n) {
    const f = pitch(n % 5, 0);
    note(f, { dur: 1.8, vol: 0.18, attack: 0.05, echo: 0.9 });
    note(f * 1.5, { dur: 1.4, vol: 0.06, type: "triangle", attack: 0.08, echo: 0.8 });
    note(f / 2, { dur: 1.6, vol: 0.07, attack: 0.1, echo: 0.5 });
  },
  echo(dx = 0) { note(pitch(4, 2), { dur: 0.8, vol: 0.04, type: "triangle", echo: 1, pan: dx / 6 }); },
  charged() { note(pitch(7, 1), { dur: 0.25, vol: 0.05, echo: 0.3 }); },
  bump() { note(140, { dur: 0.16, vol: 0.12, glide: 70, echo: 0.2 }); },
  crystal() { note(pitch(4, 2), { dur: 1.2, vol: 0.06, echo: 0.9 }); note(pitch(6, 2), { at: 0.06, dur: 0.9, vol: 0.03, echo: 0.9 }); },
  light() { [0, 2, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.07, dur: 0.9, vol: 0.09, fm: 3.5, fmDepth: 0.8, echo: 0.8 })); },
  door() { note(196, { dur: 0.7, vol: 0.12, type: "sawtooth", lowpass: 600, attack: 0.08, glide: 294 }); },
  doorClose() { note(220, { dur: 0.4, vol: 0.06, type: "sawtooth", lowpass: 400, glide: 140, echo: 0.2 }); },
  moth() { note(1318.5, { dur: 0.25, vol: 0.06 }); note(1760, { at: 0.08, dur: 0.35, vol: 0.06 }); },
  grumble() { note(210, { dur: 0.45, vol: 0.13, type: "sawtooth", lowpass: 700, glide: 85, echo: 0.3 }); },
  rattle(dx = 0, near = 0.5) {
    for (let k = 0; k < 3; k++) note(900 + Math.random() * 500, { at: k * 0.045, dur: 0.035, vol: 0.02 + near * 0.05, type: "square", lowpass: 3000, echo: 0.1, pan: dx / 4 });
  },
  mob(kind, dx = 0) {
    const pan = dx / 5;
    if (kind === "n0") note(300, { dur: 0.35, vol: 0.05, type: "sawtooth", lowpass: 900, glide: 520, echo: 0.2, pan });
    else if (kind === "n") note(180, { dur: 0.12, vol: 0.12, type: "square", lowpass: 1400, glide: 90, echo: 0.3, pan });
    else if (kind === "a") { note(2400, { dur: 0.12, vol: 0.05, glide: 3400, echo: 0.6, pan }); note(2800, { at: 0.1, dur: 0.1, vol: 0.04, glide: 3800, echo: 0.6, pan }); }
    else if (kind === "k") note(1200 + Math.random() * 400, { dur: 0.03, vol: 0.025, type: "square", lowpass: 2500, echo: 0.1, pan });
    else if (kind === "w") [0, 4, 7].forEach((d, q) => note(pitch(d, 2), { at: q * 0.04, dur: 0.8, vol: 0.04, fm: 3.5, echo: 1, pan }));
  },
  snore(dx = 0) { note(150, { dur: 0.7, vol: 0.035, type: "triangle", lowpass: 500, attack: 0.25, glide: 110, echo: 0.3, pan: dx / 6 }); },
  gloomWake(dx = 0, big = false) { if (big) { note(70, { dur: 1.6, vol: 0.14, type: "sawtooth", lowpass: 260, attack: 0.4, glide: 52, echo: 0.8, pan: dx / 6 }); return; } note(110, { dur: 0.9, vol: 0.09, type: "sawtooth", lowpass: 380, attack: 0.25, glide: 82, echo: 0.6 }); },
  flare() { [0, 4, 7, 12].forEach((d, i) => note(pitch(d, 1), { at: i * 0.03, dur: 0.7, vol: 0.07, type: "triangle", echo: 0.7 })); note(220, { dur: 0.5, vol: 0.08, glide: 880, echo: 0.4 }); },
  hurt() { note(330, { dur: 0.35, vol: 0.12, type: "square", lowpass: 900, glide: 120, echo: 0.3 }); },
  lowEnergy() { note(98, { dur: 0.18, vol: 0.12, echo: 0 }); note(98, { at: 0.22, dur: 0.18, vol: 0.09, echo: 0 }); },
  fail() { [4, 3, 2, 0].forEach((d, i) => note(pitch(d, 0), { at: i * 0.18, dur: 0.7, vol: 0.09, type: "triangle" })); },
  win() {
    [0, 2, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.11, dur: 1.4, vol: 0.09 }));
    note(pitch(0, -1), { dur: 1.8, vol: 0.08, type: "triangle" });
  },
  star(i) { note(pitch([7, 9, 11][i], 0), { dur: 0.5, vol: 0.08 }); },
  rune() { [0, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.05, dur: 1.2, vol: 0.06, type: "triangle", echo: 0.9 })); },
  gate() { note(pitch(0, -2), { dur: 1.6, vol: 0.14, type: "sawtooth", lowpass: 500, attack: 0.2, echo: 0.6 }); [0, 4, 7, 12].forEach((d, i) => note(pitch(d, 0), { at: 0.2 + i * 0.09, dur: 1.2, vol: 0.06 })); },
  tick() { note(1400, { dur: 0.05, vol: 0.05, type: "square", lowpass: 2500, echo: 0 }); },
  unlock() { [0, 4, 7, 9, 14].forEach((d, i) => note(pitch(d, 0), { at: i * 0.08, dur: 0.8, vol: 0.07 })); },
  ambient() {
    const a = mood.ambient, r = Math.random();
    if (a === "drip") note(1500 + r * 900, { dur: 0.14, vol: 0.035, glide: 700 + r * 300, echo: 1 });
    else if (a === "bubble") { note(500 + r * 300, { dur: 0.1, vol: 0.03, glide: 900 + r * 400, echo: 0.6 }); note(650 + r * 300, { at: 0.12, dur: 0.08, vol: 0.02, glide: 1100, echo: 0.6 }); }
    else if (a === "chime") note(pitch(Math.floor(r * 5), 3), { dur: 1.4, vol: 0.018, echo: 1 });
    else for (let k = 0; k < 3; k++) note(90 + Math.random() * 60, { at: k * 0.05 + Math.random() * 0.04, dur: 0.04, vol: 0.03, type: "square", lowpass: 1200, echo: 0.2 });
  },
};
// Filtered noise: breath, rumbles and falling stone.
let noiseBuf = null;
function noise(o = {}) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; }
  const t = AC.currentTime + (o.at || 0), dur = o.dur || 0.5;
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
  out.connect(sfxBus);
  if (o.echo) { const s = AC.createGain(); s.gain.value = o.echo * save.settings.sfx * 0.75; out.connect(s); s.connect(echoBus); }
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
// A Hushling breathing in the dark, from its side of the screen (best with headphones):
// a slow breath in, then out. Closer is louder and less muffled.
sfx.breath = (dx = 0, near = 0.5, big = false) => {
  const v = 0.012 + near * near * 0.07, lo = big ? 0.6 : 1;
  noise({ freq: (500 + near * 700) * lo, glide: (800 + near * 900) * lo, q: 0.8, dur: 0.9, attack: 0.5, vol: v, pan: dx / 4, echo: 0.4 });
  noise({ at: 1.0, freq: (900 + near * 600) * lo, glide: (350 + near * 300) * lo, q: 0.7, dur: 1.1, attack: 0.08, vol: v * 1.2, pan: dx / 4, echo: 0.4 });
};
// Your heart pounding while something hunts you.
sfx.heart = (k = 0.5) => {
  note(62, { dur: 0.16, vol: 0.06 + k * 0.12, glide: 40, echo: 0, attack: 0.005 });
  note(58, { at: 0.2, dur: 0.14, vol: 0.04 + k * 0.08, glide: 38, echo: 0, attack: 0.005 });
};
// The cave giving way: a deep rumble and a crack of stone.
sfx.rumble = (dx = 0) => {
  noise({ filter: "lowpass", freq: 260, glide: 90, q: 0.5, dur: 1.4, attack: 0.05, vol: 0.18, pan: dx / 5, echo: 0.6 });
  noise({ at: 0.55, filter: "highpass", freq: 1800, q: 0.5, dur: 0.12, attack: 0.003, vol: 0.06, pan: dx / 5, echo: 0.5 });
};
// An old ring stone: a deep, ringing bell, heard from its side.
sfx.stone = (dx = 0) => {
  note(pitch(0, 0), { dur: 2.2, vol: 0.14, fm: 2.76, fmDepth: 1.8, echo: 1, pan: dx / 5 });
  note(pitch(4, 1), { at: 0.02, dur: 1.6, vol: 0.05, fm: 3.5, fmDepth: 0.9, echo: 1, pan: dx / 5 });
};
// Caught: a cold, falling hiss and a thud.
sfx.caught = () => {
  noise({ freq: 1400, glide: 200, q: 0.8, dur: 0.6, attack: 0.01, vol: 0.12, echo: 0.6 });
  note(80, { dur: 0.5, vol: 0.18, glide: 40, echo: 0.3, attack: 0.005 });
};
// A pebble: a soft toss, then a bright clatter where it lands.
sfx.toss = () => noise({ freq: 1800, glide: 900, q: 1, dur: 0.18, attack: 0.02, vol: 0.03 });
sfx.clatter = (dx = 0) => { for (let k = 0; k < 4; k++) note(1700 + Math.random() * 900, { at: k * 0.06 + Math.random() * 0.03, dur: 0.06, vol: 0.06 - k * 0.012, type: "square", lowpass: 4200, echo: 0.8, pan: dx / 4 }); };
// A Lurker's eye opening on you: a low, wet creak.
sfx.lurk = (dx = 0) => { note(95, { dur: 0.7, vol: 0.12, type: "sawtooth", lowpass: 300, glide: 140, attack: 0.15, echo: 0.6, pan: dx / 5 }); noise({ freq: 300, glide: 900, q: 3, dur: 0.5, attack: 0.2, vol: 0.05, pan: dx / 5 }); };
// A memory: a soft, high music-box phrase.
sfx.memory = () => [0, 4, 7, 11, 14].forEach((d, i) => note(pitch(d, 2), { at: i * 0.12, dur: 1.6, vol: 0.05, fm: 3.5, fmDepth: 0.7, echo: 1 }));
// A Hushling sweeping past in the dark.
sfx.whoosh = (dx = 0) => noise({ freq: 400, glide: 1200, q: 1.2, dur: 0.5, attack: 0.15, vol: 0.06, pan: dx / 3, echo: 0.5 });
// The Great Hush's long, slow breath.
sfx.deepBreath = (dx = 0) => {
  noise({ freq: 260, glide: 420, q: 0.6, dur: 1.8, attack: 1.0, vol: 0.09, pan: dx / 5, echo: 0.8 });
  noise({ at: 1.9, freq: 420, glide: 180, q: 0.6, dur: 2.2, attack: 0.1, vol: 0.11, pan: dx / 5, echo: 0.8 });
};
function buzz(ms) { try { if (save.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

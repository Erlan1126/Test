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
const music = { on: false, layers: 0, step: 0, next: 0, arp: [], mel: [], bass: [] };
function musicStart(seed, layers) {
  const r = seeded(seed * 31 + 7);
  music.arp = Array.from({ length: 16 }, (_, k) => (k % 2 && r() < 0.35 ? -1 : Math.floor(r() * 7)));
  music.mel = Array.from({ length: 32 }, () => (r() < 0.45 ? -1 : 2 + Math.floor(r() * 6)));
  music.bass = Array.from({ length: 4 }, (_, k) => (k ? [0, 3, 4, 2, 5][Math.floor(r() * 5)] : 0));
  music.layers = layers;
  if (!music.on && AC) { music.step = 0; music.next = AC.currentTime + 0.15; }
  music.on = true;
}
function musicStop() { music.on = false; }
function musicTick() {
  if (!AC || !music.on || muted || AC.state !== "running") { if (AC) music.next = AC.currentTime + 0.1; return; }
  const beat = 60 / 84 / 2;
  while (music.next < AC.currentTime + 0.3) {
    const k = music.step, t = music.next;
    if (k % 16 === 0) [0, 2, 4].forEach((d, q) => note(pitch(d + music.bass[(k / 16) % 4], -1), { time: t + q * 0.05, dur: beat * 17, vol: 0.045, attack: 1.2, echo: 0.2, music: true }));
    if (music.layers >= 1 && k % 4 === 0) note(pitch(music.bass[Math.floor(k / 16) % 4], -2), { time: t, dur: beat * 3, vol: 0.07, type: "triangle", echo: 0, music: true });
    if (music.layers >= 2 && music.arp[k % 16] >= 0) note(pitch(music.arp[k % 16], 0), { time: t, dur: beat * 1.6, vol: music.layers >= 3 ? 0.03 : 0.02, echo: 0.6, music: true });
    if (music.layers >= 3 && k % 2 === 0 && music.mel[(k / 2) % 32] >= 0) note(pitch(music.mel[(k / 2) % 32], 1), { time: t, dur: beat * 3, vol: 0.026, echo: 0.9, music: true });
    music.step++;
    music.next += beat;
  }
}

const sfx = {
  ping(n) {
    const f = pitch(n % 7, 1);
    note(f, { dur: 0.9, vol: 0.17, echo: 0.8 });
    note(f * 2, { dur: 0.5, vol: 0.035, type: "triangle", echo: 0.5 });
  },
  bump() { note(140, { dur: 0.16, vol: 0.12, glide: 70, echo: 0.2 }); },
  crystal() { note(pitch(4, 2), { dur: 1.2, vol: 0.06, echo: 0.9 }); note(pitch(6, 2), { at: 0.06, dur: 0.9, vol: 0.03, echo: 0.9 }); },
  light() { [0, 2, 4, 7].forEach((d, i) => note(pitch(d, 1), { at: i * 0.07, dur: 0.6, vol: 0.1 })); },
  door() { note(196, { dur: 0.7, vol: 0.12, type: "sawtooth", lowpass: 600, attack: 0.08, glide: 294 }); },
  doorClose() { note(220, { dur: 0.4, vol: 0.06, type: "sawtooth", lowpass: 400, glide: 140, echo: 0.2 }); },
  moth() { note(1318.5, { dur: 0.25, vol: 0.06 }); note(1760, { at: 0.08, dur: 0.35, vol: 0.06 }); },
  grumble() { note(210, { dur: 0.45, vol: 0.13, type: "sawtooth", lowpass: 700, glide: 85, echo: 0.3 }); },
  gloomWake() { note(110, { dur: 0.9, vol: 0.09, type: "sawtooth", lowpass: 380, attack: 0.25, glide: 82, echo: 0.6 }); },
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
function buzz(ms) { try { if (save.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

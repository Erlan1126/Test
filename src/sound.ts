// Sound effects, ambience and music, synthesized with the Web Audio API so the game ships
// no audio files. Browsers only allow audio after the player interacts, so call ensure()
// from a tap.
//
// Routing: effects, music and ambience each have their own level, all pass through a
// shared reverb "room" and a compressor that keeps loud moments from distorting.
import type { Settings } from "./logic/save";

const SCALE = [0, 2, 4, 7, 9];
/** Bright daytime chords (C, G, Am, F) and softer night ones (Am, F, C, Em), as semitones from C. */
const DAY = [[0, 4, 7, 11], [7, 11, 14, 17], [9, 12, 16, 19], [5, 9, 12, 16]];
const NIGHT = [[9, 12, 16, 19], [5, 9, 12, 14], [0, 4, 7, 14], [4, 7, 11, 14]];

export class Sound {
  /** 0 to 3: how much of the music plays (pad, bass, melody, drums and sparkles). */
  intensity = 0;
  private ac: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private mus: GainNode | null = null;
  private amb: GainNode | null = null;
  private reverb: GainNode | null = null;
  private echo: DelayNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private windBed: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  private city: GainNode | null = null;
  private ducked = false;
  private next = 0;
  private step = 0;
  private night = 0;
  private altitude = 0;
  private chirpAt = 0;
  private cricketAt = 0;

  /** Reads the settings fresh each time, so loading a save code takes effect at once. */
  constructor(private readonly getSettings: () => Settings) {
    // Pause audio while the page is in the background.
    document.addEventListener("visibilitychange", () => {
      if (!this.ac) return;
      if (document.hidden) void this.ac.suspend(); else void this.ac.resume();
    });
  }

  private get settings(): Settings { return this.getSettings(); }

  ensure(): void {
    if (!this.ac) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try { this.ac = new Ctx(); } catch { return; }
      this.build(this.ac);
      setInterval(() => this.tick(), 60);
    }
    if (this.ac.state === "suspended") void this.ac.resume();
  }

  private build(ac: AudioContext): void {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ac.destination);

    // A soft room: a generated impulse response, two seconds of decaying stereo noise.
    const len = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.32;
    conv.connect(wet).connect(comp);
    this.reverb = ac.createGain();
    this.reverb.connect(conv);

    // A gentle echo for the melody.
    const echo = ac.createDelay(1);
    echo.delayTime.value = (60 / 84) * 0.75;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    echo.connect(tone).connect(fb).connect(echo);
    tone.connect(comp);
    this.echo = echo;

    this.sfx = ac.createGain();
    this.sfx.connect(comp);
    this.sfx.connect(this.reverb);
    this.mus = ac.createGain();
    this.mus.gain.value = 0;
    this.mus.connect(comp);
    this.mus.connect(this.reverb);
    this.amb = ac.createGain();
    this.amb.connect(comp);

    this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Ambient beds that loop forever; their levels follow the tower.
    const loop = () => { const s = ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); return s; };
    const wf = ac.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 500;
    wf.Q.value = 0.6;
    const wg = ac.createGain();
    wg.gain.value = 0;
    loop().connect(wf).connect(wg).connect(this.amb);
    this.windBed = { filter: wf, gain: wg };
    const cf = ac.createBiquadFilter();
    cf.type = "lowpass";
    cf.frequency.value = 260;
    this.city = ac.createGain();
    this.city.gain.value = 0;
    loop().connect(cf).connect(this.city).connect(this.amb);

    this.next = ac.currentTime + 0.1;
    this.applySettings();
  }

  applySettings(): void {
    const ac = this.ac;
    if (!ac || !this.sfx || !this.amb) return;
    this.sfx.gain.setTargetAtTime(this.settings.sound ? 1 : 0, ac.currentTime, 0.02);
    this.amb.gain.setTargetAtTime(this.settings.sound ? 1 : 0, ac.currentTime, 0.3);
    this.applyMusic();
  }

  /** Lowers the music, for the pause menu. */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyMusic();
  }

  private applyMusic(): void {
    if (!this.mus || !this.ac) return;
    const target = this.settings.music ? (this.ducked ? 0.15 : 0.5) : 0;
    this.mus.gain.setTargetAtTime(target, this.ac.currentTime, 0.4);
  }

  /**
   * Called every frame with where the camera is: `altitude` 0 on the ground to 1 high up,
   * `night` 0 to 1, `wind` 0 to 1, and whether a tower is being built.
   */
  ambience(altitude: number, night: number, wind: number, active: boolean): void {
    const ac = this.ac;
    this.altitude = altitude;
    this.night = night;
    if (!ac || !this.windBed || !this.city) return;
    const t = ac.currentTime;
    const gust = 0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
    // Quieter on the menus, fuller while building.
    this.windBed.gain.gain.setTargetAtTime((0.015 + altitude * 0.09 + wind * 0.08) * (0.6 + gust * 0.6) * (active ? 1 : 0.6), t, 0.4);
    this.windBed.filter.frequency.setTargetAtTime(380 + altitude * 500 + wind * 500 + gust * 200, t, 0.4);
    this.city.gain.setTargetAtTime(Math.max(0, 1 - altitude * 3) * (1 - night * 0.6) * 0.08, t, 0.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0, slideTo = 0, out: AudioNode | null = this.sfx, pan = 0): void {
    const ac = this.ac;
    if (!ac || !out) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o.connect(g);
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A bell: a sine carrier with a decaying FM sparkle. Sounds like glass or a chime. */
  private bell(freq: number, dur: number, vol: number, delay = 0, pan = 0, out: AudioNode | null = this.sfx): void {
    const ac = this.ac;
    if (!ac || !out) return;
    const t = ac.currentTime + delay;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    mg.gain.setValueAtTime(freq * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = car.connect(g);
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(out);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }

  /** Filtered noise: thuds, glass, wind, whooshes and crowd cheers. */
  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass", q = 1, delay = 0, attack = 0.005, sweepTo = 0): void {
    const ac = this.ac;
    if (!ac || !this.sfx || !this.noiseBuf) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf;
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** Notes climb a pentatonic scale, so a perfect streak plays a rising tune. */
  private note(i: number): number {
    return 261.63 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);
  }

  /** A heavy floor landing: a low thud, a body knock and a short clunk, slightly different each time. */
  private thud(weight = 1): void {
    const v = 0.94 + Math.random() * 0.12;
    this.noise(0.16, 0.38 * weight, 170 * v);
    this.tone(92 * v, 0.2, "sine", 0.32 * weight, 0, 48);
    this.tone(210 * v, 0.07, "triangle", 0.06 * weight, 0.003, 120);
    this.noise(0.05, 0.08 * weight, 2600 * v, "bandpass", 2, 0.004);
  }

  // ---------- Ambience: birds by day, crickets at night, near the ground ----------

  private ambientEvents(): void {
    const ac = this.ac;
    if (!ac || !this.amb || !this.settings.sound) return;
    const t = ac.currentTime, low = 1 - Math.min(1, this.altitude * 4);
    if (low <= 0) return;
    if (this.night < 0.5 && t > this.chirpAt) {
      this.chirpAt = t + 1.5 + Math.random() * 4;
      const base = 2400 + Math.random() * 1600, pan = Math.random() * 1.6 - 0.8;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone(base, 0.08, "sine", 0.025 * low, i * 0.11, base * 1.35, this.amb, pan);
    }
    if (this.night > 0.5 && t > this.cricketAt) {
      this.cricketAt = t + 0.8 + Math.random() * 1.5;
      const pan = Math.random() * 1.6 - 0.8;
      for (let i = 0; i < 4; i++) this.tone(4400, 0.03, "square", 0.006 * low, i * 0.045, 0, this.amb, pan);
    }
  }

  // ---------- Music ----------
  // Gentle generative music. A pad always plays; bass, a plucked melody with an echo, soft
  // drums and high sparkles join as `intensity` rises. Night swaps to softer chords.

  private tick(): void {
    const ac = this.ac;
    if (!ac || ac.state !== "running") { if (ac) this.next = ac.currentTime + 0.1; return; }
    this.ambientEvents();
    const eighth = 60 / 84 / 2;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.3) {
      if (this.settings.music) this.playStep(this.step, this.next - ac.currentTime, eighth);
      this.next += eighth;
      this.step++;
    }
  }

  private playStep(step: number, delay: number, e: number): void {
    const prog = this.night > 0.5 ? NIGHT : DAY;
    const chord = prog[Math.floor(step / 16) % 4], beat = step % 8;
    const f = (semi: number) => 130.81 * Math.pow(2, semi / 12);
    if (step % 16 === 0) chord.forEach((n, i) => this.pad(f(n + 12), e * 16, delay, i % 2 ? 0.3 : -0.3));
    if (this.intensity >= 1 && beat % 4 === 0) this.tone(f(chord[0] - 12), e * 3.5, "sine", 0.18, delay, 0, this.mus);
    if (this.intensity >= 2) {
      const n = chord[[0, 1, 2, 3, 2, 1, 0, 2][beat]] + 24;
      this.pluck(f(n), e * 1.6, delay);
      if (beat % 4 === 0) this.kick(delay);
      if (beat % 2 === 1) this.hat(delay);
    }
    if (this.intensity >= 3 && beat % 2 === 1 && Math.random() < 0.6) {
      this.bell(f(chord[Math.floor(Math.random() * 4)] + 36), e * 3, 0.025, delay, Math.random() * 1.4 - 0.7, this.mus);
    }
  }

  private pad(freq: number, dur: number, delay: number, pan: number): void {
    const ac = this.ac;
    if (!ac || !this.mus) return;
    const t = ac.currentTime + delay;
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(this.night > 0.5 ? 700 : 1300, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 1.4);
    g.gain.setValueAtTime(0.03, t + dur - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    let out: AudioNode = lp.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; out = out.connect(p); }
    out.connect(this.mus);
    for (const [fr, type] of [[freq, "sawtooth"], [freq * 1.005, "sawtooth"], [freq / 2, "triangle"]] as const) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = fr;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.9);
    }
  }

  /** A plucked note sent through the echo. */
  private pluck(freq: number, dur: number, delay: number): void {
    const ac = this.ac;
    if (!ac || !this.mus || !this.echo) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g);
    g.connect(this.mus);
    g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(delay: number): void {
    this.tone(120, 0.22, "sine", 0.14, delay, 42, this.mus);
  }

  private hat(delay: number): void {
    const ac = this.ac;
    if (!ac || !this.mus || !this.noiseBuf) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf;
    f.type = "highpass";
    f.frequency.value = 7500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.mus);
    src.start(t, Math.random());
    src.stop(t + 0.08);
  }

  // ---------- Effects ----------
  click(): void { this.tone(1100, 0.04, "triangle", 0.06); this.tone(1650, 0.03, "sine", 0.03, 0.005); }
  /** A soft swish for sheets sliding up. */
  whoosh(): void { this.noise(0.22, 0.05, 500, "bandpass", 1.2, 0, 0.04, 2400); }
  land(): void { this.thud(0.8); }
  cut(): void {
    this.thud(0.8);
    this.noise(0.35, 0.1, 3800, "highpass", 0.7, 0.01);
    for (let i = 0; i < 4; i++) this.bell(2400 + Math.random() * 1800, 0.12, 0.012, 0.02 + i * 0.03, Math.random() * 1.2 - 0.6);
  }
  perfect(combo: number): void {
    this.thud(0.55);
    const f = this.note(Math.min(combo - 1, 11) + 3);
    this.bell(f, 0.9, 0.12);
    this.bell(f * 2, 0.5, 0.03, 0.02, 0.4);
    if (combo >= 5) this.bell(f * 1.5, 0.7, 0.04, 0.05, -0.4);
  }
  ice(): void { this.bell(1760, 0.5, 0.05, 0, -0.3); this.bell(2637, 0.4, 0.035, 0.06, 0.3); this.noise(0.25, 0.03, 6000, "highpass", 0.5); }
  garden(): void { [0, 5, 9].forEach((n, i) => this.bell(523 * Math.pow(2, n / 12), 0.4, 0.05, i * 0.06, i - 1)); }
  streak(): void { [0, 4, 7, 12, 16, 19].forEach((n, i) => this.bell(523 * Math.pow(2, n / 12), 0.5, 0.06, i * 0.045, (i / 5) * 1.2 - 0.6)); }
  golden(): void {
    this.thud(0.7);
    [0, 4, 7, 12, 16].forEach((n, i) => this.bell(784 * Math.pow(2, n / 12), 0.6, 0.07, i * 0.05, (i / 4) * 1.2 - 0.6));
    this.noise(0.8, 0.025, 7000, "highpass", 0.5, 0.05, 0.1);
  }
  milestone(): void {
    this.noise(1.8, 0.07, 1400, "bandpass", 0.5, 0.05, 0.45); // crowd cheer swell
    [0, 4, 7, 12].forEach((n, i) => this.bell(523 * Math.pow(2, n / 12), 0.7, 0.08, i * 0.09));
    this.tone(130.81, 1.2, "triangle", 0.08, 0, 0);
  }
  unlock(): void { [0, 7, 12, 16, 19].forEach((n, i) => this.bell(392 * Math.pow(2, n / 12), 0.8, 0.06, 0.4 + i * 0.07, (i / 4) * 1.2 - 0.6)); }
  star(): void { [0, 7, 12].forEach((n, i) => this.bell(1046 * Math.pow(2, n / 12), 0.6, 0.05, 0.2 + i * 0.08)); }
  coins(): void { [0, 4, 7, 12].forEach((n, i) => this.bell(1318 * Math.pow(2, n / 12), 0.25, 0.035, i * 0.055, Math.random() * 1.2 - 0.6)); }
  /** A little fanfare for a premium purchase. */
  purchase(): void {
    [0, 4, 7, 12].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.5, "triangle", 0.06, i * 0.09));
    [12, 16, 19, 24].forEach((n, i) => this.bell(392 * Math.pow(2, n / 12), 1.2, 0.05, 0.4 + i * 0.07, (i / 3) * 1.2 - 0.6));
    this.noise(1, 0.02, 8000, "highpass", 0.5, 0.4, 0.2);
  }
  /** Distant thunder: a low rumble that rolls in. */
  thunder(): void {
    this.noise(2.6, 0.22, 140, "lowpass", 0.8, 0, 0.08, 60);
    this.noise(1.2, 0.08, 900, "lowpass", 0.6, 0.05, 0.02, 200);
  }
  wind(): void { this.noise(1.8, 0.08, 500, "lowpass", 1, 0, 0.6); }
  rewind(): void { this.tone(160, 0.5, "sawtooth", 0.04, 0, 900); this.bell(640, 0.6, 0.06, 0.1); this.noise(0.5, 0.04, 400, "bandpass", 1, 0, 0.1, 3000); }
  win(): void { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.bell(523 * Math.pow(2, n / 12), 0.8, 0.07, i * 0.07, (i / 6) * 1.2 - 0.6)); }
  fail(): void { this.tone(260, 0.6, "sawtooth", 0.05, 0, 60); this.tone(130, 0.5, "triangle", 0.2, 0.05, 50); this.noise(0.6, 0.05, 300, "lowpass", 1, 0.05); }
}

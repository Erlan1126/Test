// Sound effects and music, synthesized with the Web Audio API so the game ships no audio
// files. Browsers only allow audio after the player interacts, so call ensure() from a tap.
import type { Settings } from "./logic/save";

const SCALE = [0, 2, 4, 7, 9];
const CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]; // C, G, Am, F

export class Sound {
  /** 0 to 3: how many music layers play (pad, bass, arpeggio, sparkles). */
  intensity = 0;
  private ac: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private mus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ducked = false;
  private next = 0;
  private step = 0;

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
      const ac = this.ac;
      this.sfx = ac.createGain();
      this.sfx.gain.value = this.settings.sound ? 1 : 0;
      this.sfx.connect(ac.destination);
      this.mus = ac.createGain();
      this.mus.gain.value = 0;
      this.mus.connect(ac.destination);
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.next = ac.currentTime + 0.1;
      setInterval(() => this.tick(), 60);
      this.applyMusic();
    }
    if (this.ac.state === "suspended") void this.ac.resume();
  }

  applySettings(): void {
    if (this.sfx && this.ac) this.sfx.gain.setTargetAtTime(this.settings.sound ? 1 : 0, this.ac.currentTime, 0.02);
    this.applyMusic();
  }

  /** Lowers the music, for the pause menu. */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyMusic();
  }

  private applyMusic(): void {
    if (!this.mus || !this.ac) return;
    const target = this.settings.music ? (this.ducked ? 0.15 : 0.55) : 0;
    this.mus.gain.setTargetAtTime(target, this.ac.currentTime, 0.4);
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0, slideTo = 0, out = this.sfx): void {
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
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Filtered noise: thuds, glass, wind and crowd cheers. */
  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass", q = 1, delay = 0, attack = 0.005): void {
    const ac = this.ac;
    if (!ac || !this.sfx || !this.noiseBuf) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Notes climb a pentatonic scale, so a perfect streak plays a rising tune. */
  private note(i: number): number {
    return 261.63 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);
  }

  /** A heavy floor landing: a low thud plus a short metallic clunk. */
  private thud(weight = 1): void {
    this.noise(0.14, 0.35 * weight, 180);
    this.tone(95, 0.16, "sine", 0.3 * weight, 0, 55);
    this.tone(620, 0.06, "square", 0.025 * weight, 0.004);
    this.tone(930, 0.05, "square", 0.018 * weight, 0.008);
  }

  // ---------- Music ----------
  // Gentle generative music. A pad always plays; bass, an arpeggio and high sparkles join
  // as `intensity` rises with the tower and perfect streaks.

  private tick(): void {
    const ac = this.ac;
    if (!ac || ac.state !== "running") { if (ac) this.next = ac.currentTime + 0.1; return; }
    const eighth = 60 / 84 / 2;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.3) {
      if (this.settings.music) this.playStep(this.step, this.next - ac.currentTime, eighth);
      this.next += eighth;
      this.step++;
    }
  }

  private playStep(step: number, delay: number, e: number): void {
    const chord = CHORDS[Math.floor(step / 16) % 4], beat = step % 8;
    const f = (semi: number) => 130.81 * Math.pow(2, semi / 12);
    if (step % 16 === 0) chord.forEach(n => this.pad(f(n + 12), e * 16, delay));
    if (this.intensity >= 1 && beat % 4 === 0) this.tone(f(chord[0] - 12), e * 3.5, "sine", 0.2, delay, 0, this.mus);
    if (this.intensity >= 2) this.tone(f(chord[[0, 1, 2, 1][beat % 4]] + 24), e * 1.5, "triangle", 0.045, delay, 0, this.mus);
    if (this.intensity >= 3 && beat % 2 === 1 && Math.random() < 0.7) {
      this.tone(f(chord[Math.floor(Math.random() * 3)] + 36), e * 2.5, "sine", 0.035, delay, 0, this.mus);
    }
  }

  private pad(freq: number, dur: number, delay: number): void {
    const ac = this.ac;
    if (!ac || !this.mus) return;
    const t = ac.currentTime + delay;
    for (const fr of [freq, freq * 1.006]) {
      const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = "triangle";
      o.frequency.value = fr;
      lp.type = "lowpass";
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 1.2);
      g.gain.setValueAtTime(0.035, t + dur - 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(lp).connect(g).connect(this.mus);
      o.start(t);
      o.stop(t + dur + 0.7);
    }
  }

  // ---------- Effects ----------
  click(): void { this.tone(900, 0.05, "triangle", 0.08); }
  land(): void { this.thud(0.8); }
  cut(): void { this.thud(0.8); this.noise(0.3, 0.1, 3500, "highpass", 0.7, 0.01); this.tone(2100, 0.1, "square", 0.015, 0.02, 1200); }
  perfect(combo: number): void {
    this.thud(0.6);
    const f = this.note(Math.min(combo - 1, 11) + 3);
    this.tone(f, 0.3, "triangle", 0.22);
    this.tone(f * 2, 0.2, "sine", 0.06, 0.02);
  }
  ice(): void { this.tone(1600, 0.25, "sine", 0.06, 0, 2400); this.tone(2400, 0.18, "sine", 0.04, 0.05); }
  garden(): void { [0, 5, 9].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.22, "sine", 0.07, i * 0.05)); }
  streak(): void { [0, 4, 7, 12, 16, 19].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.25, "triangle", 0.1, i * 0.04)); }
  golden(): void { this.thud(0.7); [0, 4, 7, 12, 16].forEach((n, i) => this.tone(784 * Math.pow(2, n / 12), 0.2, "triangle", 0.12, i * 0.045)); }
  milestone(): void {
    this.noise(1.6, 0.07, 1400, "bandpass", 0.5, 0.05, 0.45); // crowd cheer swell
    [0, 4, 7, 12].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.35, "triangle", 0.14, i * 0.09));
  }
  unlock(): void { [0, 7, 12, 16, 19].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.4, "triangle", 0.12, 0.4 + i * 0.07)); }
  star(): void { [0, 7, 12].forEach((n, i) => this.tone(1046 * Math.pow(2, n / 12), 0.3, "sine", 0.1, 0.2 + i * 0.08)); }
  coins(): void { [0, 4, 7].forEach((n, i) => this.tone(1318 * Math.pow(2, n / 12), 0.12, "square", 0.04, i * 0.06)); }
  wind(): void { this.noise(1.8, 0.08, 500, "lowpass", 1, 0, 0.6); }
  rewind(): void { this.tone(160, 0.5, "sawtooth", 0.05, 0, 900); this.tone(320, 0.5, "triangle", 0.08, 0.05, 1400); }
  win(): void { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.4, "triangle", 0.12, i * 0.07)); }
  fail(): void { this.tone(260, 0.6, "sawtooth", 0.06, 0, 60); this.tone(130, 0.5, "triangle", 0.2, 0.05, 50); }
}

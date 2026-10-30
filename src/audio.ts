// Sound effects synthesized with the Web Audio API, so the game ships no audio files.
// Browsers only allow audio after the player interacts, so call unlock() from a tap.
export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor(public enabled: boolean) {}

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo = 0): void {
    if (!this.enabled || !this.ctx || !this.out) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, vol: number, freq: number, type: BiquadFilterType): void {
    if (!this.enabled || !this.ctx || !this.out || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = this.noise;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  click(): void { this.tone(880, 0.06, "triangle", 0.08); }
  launch(): void { this.hiss(0.25, 0.12, 1600, "bandpass"); this.tone(300, 0.2, "sine", 0.08, 0, 700); }
  /** Higher notes for longer perfect combos. */
  capture(combo: number): void {
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const f = 392 * Math.pow(2, steps[Math.min(combo, steps.length - 1)] / 12);
    this.tone(f, 0.28, "triangle", 0.18);
    this.tone(f * 2, 0.18, "sine", 0.05, 0.02);
  }
  perfect(): void { [0, 4, 7, 12].forEach((s, i) => this.tone(784 * Math.pow(2, s / 12), 0.16, "triangle", 0.1, i * 0.04)); }
  star(): void { this.tone(1320, 0.09, "sine", 0.09); this.tone(1760, 0.08, "sine", 0.06, 0.03); }
  fail(): void { this.tone(330, 0.6, "sawtooth", 0.06, 0, 80); this.hiss(0.5, 0.15, 400, "lowpass"); }
}

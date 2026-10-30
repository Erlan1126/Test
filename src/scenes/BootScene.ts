import Phaser from "phaser";
import { PLANET_LOOKS, WORLD_H } from "../logic/world";

// Planet colors: [highlight, body, shadow]. One entry per planet look.
export const PLANET_COLORS: [string, string, string][] = [
  ["#ffb48a", "#ec5a6a", "#6e1f4f"],
  ["#8ff0ff", "#3f86ff", "#26227a"],
  ["#c4ff9e", "#36c27a", "#14505a"],
  ["#ffe08a", "#ff9a3d", "#7a3416"],
  ["#e2b4ff", "#9466ff", "#33236e"],
  ["#ffb0e6", "#e0609f", "#5e1a58"],
];
/** The ring color for each planet look, as a Phaser number. */
export const RING_COLORS = PLANET_COLORS.map(([hi]) => Phaser.Display.Color.HexStringToColor(hi).color);

/** Draws every texture in code, so the game ships without image files. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    for (let i = 0; i < PLANET_LOOKS; i++) this.makePlanet(i);
    this.makeGlow("glow", 128, "255,255,255");
    this.makeGlow("glow-gold", 128, "255,214,110");
    this.makeComet();
    this.makeGlow("spark", 24, "200,240,255");
    this.makeStar();
    this.makeRock();
    this.makeGradient("bg-low", ["#120b3a", "#0b1c4d", "#0a2a5e"]);
    this.makeGradient("bg-high", ["#05030f", "#1d0b3d", "#3a1050"]);
    this.makeStarfield("stars-far", 220, 0.4, 1.1);
    this.makeStarfield("stars-near", 70, 0.9, 2.1);
    this.scene.start("Menu");
  }

  private canvas(key: string, w: number, h: number): CanvasRenderingContext2D {
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) throw new Error(`Could not create texture ${key}`);
    return tex.getContext();
  }

  private refresh(key: string): void {
    (this.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
  }

  private makePlanet(i: number): void {
    const key = `planet-${i}`, size = 256, c = size / 2, r = 120;
    const g = this.canvas(key, size, size);
    const [hi, mid, lo] = PLANET_COLORS[i];
    const body = g.createRadialGradient(c - 40, c - 46, 10, c, c, r);
    body.addColorStop(0, hi);
    body.addColorStop(0.55, mid);
    body.addColorStop(1, lo);
    g.fillStyle = body;
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    // Surface detail clipped to the planet: soft bands and a few craters.
    g.save();
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.clip();
    g.globalAlpha = 0.16;
    g.fillStyle = "#ffffff";
    for (let b = 0; b < 3; b++) {
      g.beginPath();
      g.ellipse(c, c - 50 + b * 52, r * 1.2, 12 + b * 4, -0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.18;
    g.fillStyle = "#000000";
    for (const [x, y, cr] of [[c + 34, c + 30, 16], [c - 30, c + 52, 10], [c + 60, c - 26, 8]]) {
      g.beginPath(); g.arc(x, y, cr, 0, Math.PI * 2); g.fill();
    }
    // Night side shadow
    g.globalAlpha = 1;
    const shade = g.createRadialGradient(c + 70, c + 80, 20, c + 40, c + 50, r * 1.4);
    shade.addColorStop(0, "rgba(0,0,0,0.45)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = shade;
    g.fillRect(0, 0, size, size);
    g.restore();
    // Thin bright rim on the lit edge
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, r - 2, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
    this.refresh(key);
  }

  private makeGlow(key: string, size: number, rgb: string): void {
    const g = this.canvas(key, size, size), c = size / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.35, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.refresh(key);
  }

  private makeComet(): void {
    const size = 64, c = 32;
    const g = this.canvas("comet", size, size);
    const halo = g.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, "rgba(160,235,255,0.9)");
    halo.addColorStop(0.5, "rgba(90,170,255,0.3)");
    halo.addColorStop(1, "rgba(90,170,255,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(c, c, 9, 0, Math.PI * 2); g.fill();
    this.refresh("comet");
  }

  private makeStar(): void {
    const size = 56, c = 28;
    const g = this.canvas("star", size, size);
    const glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, "rgba(255,220,120,0.6)");
    glow.addColorStop(1, "rgba(255,220,120,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 6 : 15;
      g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = "#ffd75e";
    g.fill();
    g.strokeStyle = "#fff6c8";
    g.lineWidth = 2;
    g.stroke();
    this.refresh("star");
  }

  private makeRock(): void {
    const size = 64, c = 32;
    const g = this.canvas("rock", size, size);
    g.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, rr = 24 + ((k * 7) % 5) * 1.6;
      g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    g.closePath();
    const grad = g.createLinearGradient(8, 8, 56, 56);
    grad.addColorStop(0, "#b9a7c9");
    grad.addColorStop(1, "#4a3d5e");
    g.fillStyle = grad;
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath(); g.arc(c + 6, c + 4, 6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(c - 8, c - 6, 4, 0, Math.PI * 2); g.fill();
    this.refresh("rock");
  }

  private makeGradient(key: string, stops: string[]): void {
    const g = this.canvas(key, 4, WORLD_H);
    const grad = g.createLinearGradient(0, 0, 0, WORLD_H);
    stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, WORLD_H);
    this.refresh(key);
  }

  private makeStarfield(key: string, count: number, alpha: number, maxR: number): void {
    const size = 512;
    const g = this.canvas(key, size, size);
    const rnd = new Phaser.Math.RandomDataGenerator([key]);
    for (let k = 0; k < count; k++) {
      g.globalAlpha = alpha * rnd.realInRange(0.3, 1);
      g.fillStyle = rnd.pick(["#ffffff", "#cfe3ff", "#ffe9c4"]);
      g.beginPath();
      g.arc(rnd.realInRange(0, size), rnd.realInRange(0, size), rnd.realInRange(0.4, maxR), 0, Math.PI * 2);
      g.fill();
    }
    this.refresh(key);
  }
}

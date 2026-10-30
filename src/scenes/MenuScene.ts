import Phaser from "phaser";
import { addBackdrop } from "./backdrop";
import { RING_COLORS } from "./BootScene";
import { addButton, FONT } from "./ui";
import type { GameServices } from "../main";

/** Title screen: a comet circling a planet, best score, and tap to play. */
export class MenuScene extends Phaser.Scene {
  private comet!: Phaser.GameObjects.Image;
  private angle = 0;
  private center = { x: 0, y: 0 };

  constructor() {
    super("Menu");
  }

  create(): void {
    const services = this.registry.get("services") as GameServices;
    addBackdrop(this)(0);
    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2, cy = H * 0.52, orbitR = 150;
    this.center = { x: cx, y: cy };

    this.add.image(cx, cy, "glow").setScale(4).setAlpha(0.14).setTint(RING_COLORS[1]).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.graphics();
    ring.lineStyle(4, RING_COLORS[1], 0.35);
    ring.strokeCircle(cx, cy, orbitR);
    const planet = this.add.image(cx, cy, "planet-1").setScale(0.75);
    this.tweens.add({ targets: planet, rotation: Math.PI * 2, duration: 40000, repeat: -1 });

    const trail = this.add.particles(0, 0, "spark", {
      lifespan: 500, scale: { start: 1, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: [0x9fe8ff, 0xffffff], frequency: 14, blendMode: Phaser.BlendModes.ADD,
    });
    this.comet = this.add.image(cx + orbitR, cy, "comet").setBlendMode(Phaser.BlendModes.ADD);
    trail.startFollow(this.comet);

    const title = this.add.text(cx, H * 0.17, "ORBIT\nHOP", {
      fontFamily: FONT, fontSize: "124px", fontStyle: "900", color: "#ffffff", align: "center", lineSpacing: -26,
    }).setOrigin(0.5).setShadow(0, 0, "#7fd8ff", 30, true, true);
    this.tweens.add({ targets: title, y: title.y - 10, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.text(cx, H * 0.31, "Swing around planets. Tap to launch.", {
      fontFamily: FONT, fontSize: "30px", fontStyle: "700", color: "#cfe3ff",
    }).setOrigin(0.5);

    const save = services.save;
    const info = save.games ? `Best ${save.best}   ·   ★ ${save.stars}` : "One tap is all it takes";
    this.add.text(cx, H * 0.74, info, { fontFamily: FONT, fontSize: "32px", fontStyle: "800", color: "#ffe28a" }).setOrigin(0.5);

    addButton(this, cx, H * 0.83, 420, 104, "PLAY", () => this.play(), true);
    const sound = addButton(this, W - 80, 70, 96, 72, save.sound ? "♪" : "×", () => {
      services.setSound(!services.save.sound);
      sound.setLabel(services.save.sound ? "♪" : "×");
    });

    this.input.keyboard?.once("keydown-SPACE", () => this.play());
  }

  private play(): void {
    const services = this.registry.get("services") as GameServices;
    services.sfx.unlock();
    services.sfx.click();
    this.scene.start("Game");
  }

  update(_t: number, deltaMs: number): void {
    this.angle += deltaMs / 1000 * 1.6;
    this.comet.setPosition(this.center.x + Math.cos(this.angle) * 150, this.center.y + Math.sin(this.angle) * 150);
  }
}

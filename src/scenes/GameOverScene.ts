import Phaser from "phaser";
import { addButton, FONT } from "./ui";
import type { RunResult } from "./GameScene";
import type { GameServices } from "../main";

/** Results shown over the frozen game: score, best, stars, and the way back in. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(result: RunResult): void {
    const services = this.registry.get("services") as GameServices;
    const save = services.save;
    const isBest = services.lastRunWasBest;
    const W = this.scale.width, H = this.scale.height, cx = W / 2, cy = H * 0.47;

    this.add.rectangle(0, 0, W, H, 0x070418, 0.6).setOrigin(0);
    const panel = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x161040, 0.94).fillRoundedRect(-300, -330, 600, 700, 36);
    bg.lineStyle(2, 0xffffff, 0.15).strokeRoundedRect(-300, -330, 600, 700, 36);
    const t = (y: number, s: string, size: number, color: string, weight = "800") =>
      this.add.text(0, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color, align: "center" }).setOrigin(0.5);
    panel.add([
      bg,
      t(-270, result.reason.toUpperCase(), 26, "#9fb4ff"),
      t(-180, String(result.hops), 150, "#ffffff", "900"),
      t(-80, "hops", 30, "#cfe3ff"),
      t(-10, isBest ? "NEW BEST!" : `Best ${save.best}`, 40, "#ffe28a", "900"),
      t(60, `★ +${result.stars}   ·   Best combo x${result.bestCombo}`, 30, "#ffe28a"),
    ]);
    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });

    const again = addButton(this, cx, cy + 180, 440, 100, "PLAY AGAIN", () => this.restart(), true);
    const menu = addButton(this, cx, cy + 290, 260, 70, "Menu", () => this.toMenu());
    for (const b of [again, menu]) { b.setAlpha(0); this.tweens.add({ targets: b, alpha: 1, delay: 250, duration: 250 }); }

    this.input.keyboard?.once("keydown-SPACE", () => this.restart());
  }

  private restart(): void {
    const services = this.registry.get("services") as GameServices;
    services.sfx.click();
    this.scene.stop();
    this.scene.stop("Game");
    this.scene.start("Game");
  }

  private toMenu(): void {
    const services = this.registry.get("services") as GameServices;
    services.sfx.click();
    this.scene.stop("Game");
    this.scene.start("Menu");
  }
}

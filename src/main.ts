import Phaser from "phaser";
import { Sfx } from "./audio";
import { loadSave, writeSave, type SaveData } from "./logic/save";
import { WORLD_H, WORLD_W } from "./logic/world";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene, type RunResult } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";

/** Shared across scenes through the game registry. */
export interface GameServices {
  save: SaveData;
  sfx: Sfx;
  lastRunWasBest: boolean;
  recordRun(result: RunResult): void;
  setSound(on: boolean): void;
}

const save = loadSave();
const services: GameServices = {
  save,
  sfx: new Sfx(save.sound),
  lastRunWasBest: false,
  recordRun(result) {
    this.lastRunWasBest = result.hops > save.best;
    save.best = Math.max(save.best, result.hops);
    save.stars += result.stars;
    save.games++;
    writeSave(save);
  },
  setSound(on) {
    save.sound = on;
    this.sfx.setEnabled(on);
    writeSave(save);
  },
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b0820",
  // The 720x1280 world always fits; taller or wider screens show extra sky around it.
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD_W, height: WORLD_H },
  render: { antialias: true },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});
game.registry.set("services", services);

import Phaser from "phaser";

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface Button extends Phaser.GameObjects.Container {
  setLabel(text: string): void;
}

/** A rounded button that presses down when tapped. */
export function addButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  label: string, onTap: () => void, primary = false,
): Button {
  const g = scene.add.graphics();
  const draw = (pressed: boolean) => {
    g.clear();
    const lift = pressed ? 2 : 8;
    if (primary) {
      g.fillStyle(0xb06a12, 1).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 26);
      g.fillStyle(0xffc23d, 1).fillRoundedRect(-w / 2, -h / 2 + 8 - lift, w, h, 26);
    } else {
      g.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
      g.lineStyle(2, 0xffffff, 0.3).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    }
  };
  draw(false);
  const text = scene.add.text(0, primary ? 0 : 0, label, {
    fontFamily: FONT, fontSize: primary ? "48px" : "34px", fontStyle: "900", color: primary ? "#3a2400" : "#ffffff",
  }).setOrigin(0.5);
  const box = scene.add.container(x, y, [g, text]) as Button;
  box.setSize(w, h).setInteractive({ useHandCursor: true });
  box.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
    e.stopPropagation();
    draw(true);
    text.y = primary ? 4 : 0;
  });
  box.on("pointerout", () => { draw(false); text.y = 0; });
  box.on("pointerup", () => { draw(false); text.y = 0; onTap(); });
  box.setLabel = (t: string) => { text.setText(t); };
  return box;
}

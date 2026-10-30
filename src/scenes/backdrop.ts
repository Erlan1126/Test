import Phaser from "phaser";

/**
 * Space background shared by every scene: a gradient that drifts from deep blue to
 * violet as you climb, and two star layers that scroll at different speeds.
 * Returns a function to call each frame with the camera's scroll position.
 */
export function addBackdrop(scene: Phaser.Scene): (scrollY: number) => void {
  // Sized to the whole screen, which can be larger than the world on tall or wide displays.
  const { width: w, height: h } = scene.scale;
  const low = scene.add.image(0, 0, "bg-low").setOrigin(0).setDisplaySize(w, h).setScrollFactor(0);
  const high = scene.add.image(0, 0, "bg-high").setOrigin(0).setDisplaySize(w, h).setScrollFactor(0).setAlpha(0);
  const far = scene.add.tileSprite(0, 0, w, h, "stars-far").setOrigin(0).setScrollFactor(0);
  const near = scene.add.tileSprite(0, 0, w, h, "stars-near").setOrigin(0).setScrollFactor(0);
  for (const o of [low, high, far, near]) o.setDepth(-100);
  return (scrollY: number) => {
    far.tilePositionY = scrollY * 0.15;
    near.tilePositionY = scrollY * 0.35;
    // Fully violet about 60 planets up.
    high.setAlpha(Phaser.Math.Clamp(-scrollY / 18000, 0, 1));
  };
}

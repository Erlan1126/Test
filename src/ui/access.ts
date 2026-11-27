// Accessibility settings that change how the whole game looks: colorblind-friendly special
// floors, larger text, and one-handed play (the pause button down by your thumb).
import { setColorblind } from "../data/skins";
import type { Settings } from "../logic/save";

export function applyAccess(s: Pick<Settings, "colorblind" | "bigText" | "oneHand">): void {
  setColorblind(s.colorblind);
  const b = document.body.classList;
  b.toggle("colorblind", s.colorblind);
  b.toggle("big-text", s.bigText);
  b.toggle("one-hand", s.oneHand);
}

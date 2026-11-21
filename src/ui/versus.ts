// The friend challenge card: after racing a friend's tower, your tower and theirs side by
// side against the same sky, with how many people each houses (and meters and floors when
// known). The winner gets a little crown. Never made up: without the friend's numbers there's
// no card.

import { t } from "../i18n";
import { fmt } from "../core/util";

export interface Side { name: string; people: number; floors?: number; meters?: number }

export async function versusCard(me: Side, friend: Side): Promise<Blob | null> {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#4a2ad0"); sky.addColorStop(0.6, "#b04ad8"); sky.addColorStop(1, "#ffb07a");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // Soft clouds.
  g.fillStyle = "rgba(255,255,255,0.12)";
  for (const [x, y, r] of [[160, 260, 90], [260, 240, 70], [860, 340, 100], [760, 360, 70], [540, 520, 60]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const font = (px: number) => `${px}px Bungee, "Arial Black", sans-serif`;
  const meWon = me.people > friend.people;
  g.textAlign = "center"; g.fillStyle = "#fff";
  g.font = font(58);
  g.fillText(meWon ? t("I beat your tower!") : t("Your tower still wins... for now"), W / 2, 120, W - 80);
  // Ground: one floating island under both towers.
  const groundY = 930;
  g.fillStyle = "#7fd36a"; g.beginPath(); g.ellipse(W / 2, groundY, 470, 46, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#8a6a4a"; g.beginPath(); g.moveTo(W / 2 - 440, groundY + 10); g.lineTo(W / 2 + 440, groundY + 10); g.lineTo(W / 2 + 120, groundY + 120); g.lineTo(W / 2 - 120, groundY + 120); g.closePath(); g.fill();
  const top = Math.max(me.people, friend.people, 1), maxH = 640;
  const tower = (x: number, s: Side, c1: string, c2: string, won: boolean) => {
    const h = Math.max(60, (s.people / top) * maxH), w = 230, floors = Math.max(2, Math.min(40, s.floors ?? Math.round(h / 38))), fh = h / floors;
    for (let i = 0; i < floors; i++) {
      const y = groundY - (i + 1) * fh, ww = w - (i % 3 === 2 ? 6 : 0);
      g.fillStyle = i % 2 ? c1 : c2;
      g.fillRect(x - ww / 2, y + 1, ww, fh - 2);
      if (fh > 14) { g.fillStyle = "rgba(255,240,180,0.75)"; for (let k = 0; k < 4; k++) g.fillRect(x - ww / 2 + 22 + k * ((ww - 44) / 4), y + fh * 0.3, (ww - 44) / 4 - 14, fh * 0.4); }
    }
    const topY = groundY - h;
    if (won) {
      g.fillStyle = "#ffd23a"; g.beginPath();
      g.moveTo(x - 60, topY - 20); g.lineTo(x - 60, topY - 80); g.lineTo(x - 30, topY - 50); g.lineTo(x, topY - 95); g.lineTo(x + 30, topY - 50); g.lineTo(x + 60, topY - 80); g.lineTo(x + 60, topY - 20); g.closePath(); g.fill();
    }
    g.fillStyle = "#fff"; g.font = font(40); g.fillText(s.name, x, groundY + 190, 420);
    g.font = font(54); g.fillText(fmt(s.people), x, groundY + 260, 420);
    const bits = [s.meters ? `${fmt(Math.round(s.meters))} m` : "", s.floors ? t("{n} floors", { n: s.floors }) : ""].filter(Boolean).join(" · ");
    g.font = "700 28px sans-serif"; g.globalAlpha = 0.9; g.fillText(bits ? `${t("people")} · ${bits}` : t("people"), x, groundY + 300, 440); g.globalAlpha = 1;
  };
  tower(W / 2 - 230, me, "#ff7aa8", "#ff4f8b", meWon);
  tower(W / 2 + 230, friend, "#6ec8ff", "#3a8fe8", !meWon);
  g.font = font(30); g.globalAlpha = 0.85; g.fillText(t("Rematch? Tap the link · SKYRISE"), W / 2, H - 36, W - 60); g.globalAlpha = 1;
  return new Promise(ok => c.toBlob(b => ok(b), "image/jpeg", 0.88));
}

// "Skyhaven remembers": a real picture of the town at each rank (taken the moment it's reached,
// or the first time you see your town), kept on this device. The scrapbook shows them, and a
// "Then → Now" card puts your town's first picture next to how it looks today, to share.
// (Pictures stay out of the save itself: it's backed up to the cloud and should stay small.)

import { t } from "../i18n";
import { RANKS } from "../data/ranks";

const KEY = "skyrise.memories.v1";
export interface Memory { img: string; at: number }
export type Memories = Record<number, Memory>;

export function loadMemories(): Memories {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Memories;
    const out: Memories = {};
    for (const k of Object.keys(raw)) {
      const i = Number(k), m = raw[i];
      if (Number.isInteger(i) && i >= 0 && i < RANKS.length && m && typeof m.img === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.img) && typeof m.at === "number") out[i] = m;
    }
    return out;
  } catch { return {}; }
}

export function saveMemory(rank: number, img: string | null): boolean {
  if (!img) return false;
  const all = loadMemories();
  if (all[rank]) return false;
  all[rank] = { img, at: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });

/** The share card: THEN (the town's first picture) beside NOW, with the ranks and a caption. */
export async function thenNowCard(then: Memory, nowImg: string, fromRank: number, toRank: number): Promise<Blob | null> {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#5a3ae0"); bg.addColorStop(0.55, "#b04ad8"); bg.addColorStop(1, "#ff8a5c");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  let a: HTMLImageElement, b: HTMLImageElement;
  try { [a, b] = await Promise.all([loadImg(then.img), loadImg(nowImg)]); } catch { return null; }
  const font = (px: number) => `${px}px Bungee, "Arial Black", sans-serif`;
  g.textAlign = "center"; g.fillStyle = "#fff";
  g.font = font(64); g.fillText(t("It started with one neighbor"), W / 2, 130, W - 80);
  // Two polaroids, a little tilted.
  const card = (im: HTMLImageElement, x: number, y: number, rot: number, label: string, sub: string) => {
    const w = 470, h = 588;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.shadowColor = "rgba(20,10,60,0.45)"; g.shadowBlur = 40; g.shadowOffsetY = 16;
    g.fillStyle = "#fff"; g.fillRect(-w / 2 - 18, -h / 2 - 18, w + 36, h + 130);
    g.shadowColor = "transparent";
    const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip();
    g.drawImage(im, -iw / 2, -ih / 2, iw, ih); g.restore();
    g.fillStyle = "#2a1f5c"; g.font = font(44); g.fillText(label, 0, h / 2 + 62);
    g.fillStyle = "#7a70a8"; g.font = "700 30px sans-serif"; g.fillText(sub, 0, h / 2 + 100);
    g.restore();
  };
  card(a, 290, 560, -0.05, t("THEN"), t(RANKS[fromRank].name));
  card(b, 790, 600, 0.04, t("NOW"), t(RANKS[toRank].name));
  g.fillStyle = "#fff"; g.font = font(46);
  g.fillText(`${t(RANKS[fromRank].name)} → ${t(RANKS[toRank].name)}`, W / 2, H - 150, W - 80);
  g.font = font(34); g.globalAlpha = 0.85; g.fillText("SKYRISE", W / 2, H - 80); g.globalAlpha = 1;
  return new Promise(ok => c.toBlob(bl => ok(bl), "image/jpeg", 0.88));
}

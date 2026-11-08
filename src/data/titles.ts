// Builder titles: every few levels you earn a new title and badge, shown on your profile,
// the level button and next to your name in the rankings.

export interface Title {
  /** First level with this title. */
  min: number;
  name: string;
  icon: string;
  color: string;
  /** The rarest titles shimmer. */
  glow?: boolean;
}

export const TITLES: Title[] = [
  { min: 1, name: "Apprentice", icon: "🧱", color: "#a8b0bf" },
  { min: 5, name: "Builder", icon: "🔨", color: "#d08b5b" },
  { min: 10, name: "Foreman", icon: "👷", color: "#c9d3e6" },
  { min: 15, name: "Architect", icon: "📐", color: "#ffd23f" },
  { min: 25, name: "Engineer", icon: "🏗️", color: "#7cf5ff" },
  { min: 40, name: "Sky Master", icon: "🌤️", color: "#b48cff" },
  { min: 60, name: "Skyrise Legend", icon: "👑", color: "#ff6f9c" },
  { min: 80, name: "Cloud Emperor", icon: "💎", color: "#9ee8ff", glow: true },
  { min: 100, name: "Skyrise Immortal", icon: "🌟", color: "#fff3a8", glow: true },
];

/** Total XP earned to reach `level` (the XP curve is in logic/rules.ts: 150 + 75 per level). */
const xpTo = (level: number) => 150 * (level - 1) + 75 * ((level - 1) * (level - 2)) / 2;

/** How far you are from your title to the next one, 0 to 1. */
export function titleProgress(level: number, xp: number): number {
  const cur = titleFor(level), next = nextTitle(level);
  if (!next) return 1;
  return Math.min(1, (xpTo(level) + xp - xpTo(cur.min)) / (xpTo(next.min) - xpTo(cur.min)));
}

export const titleFor = (level: number): Title => [...TITLES].reverse().find(t => level >= t.min) ?? TITLES[0];
export const nextTitle = (level: number): Title | undefined => TITLES.find(t => t.min > level);

/** What the next few levels bring: new titles, shapes and crystal rewards. */
export function upcoming(level: number, shapes: { name: string; level?: number }[], count = 3): { level: number; icon: string; text: string }[] {
  const out: { level: number; icon: string; text: string }[] = [];
  for (let l = level + 1; l <= level + 30 && out.length < count; l++) {
    const tt = TITLES.find(x => x.min === l);
    if (tt) out.push({ level: l, icon: tt.icon, text: tt.name });
    for (const s of shapes) if (s.level === l) out.push({ level: l, icon: "🔷", text: s.name });
    if (l % 10 === 0) out.push({ level: l, icon: "💎", text: "30 Sky Crystals" });
    else if (l % 5 === 0) out.push({ level: l, icon: "💎", text: "10 Sky Crystals" });
  }
  return out.slice(0, count);
}

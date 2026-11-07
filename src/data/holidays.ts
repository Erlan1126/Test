// Holiday events: a few weeks each year with their own sky, weather and a skin you can only
// earn while the event is on. Dates are month/day in the player's own time.

export interface Holiday {
  id: string;
  name: string;
  emoji: string;
  /** [month 1-12, day] the event starts and ends (inclusive). May wrap over New Year. */
  from: [number, number];
  to: [number, number];
  /** The skin earned by building `towers` towers during the event. */
  skin: string;
  towers: number;
  /** Mixed into the sky. */
  tint: [number, number, number];
  weather?: "snow";
}

export const HOLIDAYS: Holiday[] = [
  { id: "halloween", name: "Spooky Skies", emoji: "🎃", from: [10, 20], to: [11, 2], skin: "pumpkin", towers: 10, tint: [120, 50, 160] },
  { id: "winter", name: "Winter Lights", emoji: "❄️", from: [12, 15], to: [1, 6], skin: "frost", towers: 10, tint: [170, 200, 255], weather: "snow" },
  { id: "valentine", name: "Sweet Skies", emoji: "💗", from: [2, 7], to: [2, 15], skin: "sweetheart", towers: 8, tint: [255, 140, 180] },
  { id: "summer", name: "Summer Splash", emoji: "☀️", from: [6, 20], to: [7, 10], skin: "beach", towers: 10, tint: [255, 210, 120] },
];

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();

/** The holiday on now, if any. */
export function holidayAt(now = Date.now()): Holiday | null {
  const x = md(new Date(now));
  for (const h of HOLIDAYS) {
    const a = h.from[0] * 100 + h.from[1], b = h.to[0] * 100 + h.to[1];
    if (a <= b ? x >= a && x <= b : x >= a || x <= b) return h;
  }
  return null;
}

/** Whole days left in the holiday on now (1 on its last day). */
export function holidayDaysLeft(h: Holiday, now = Date.now()): number {
  const d = new Date(now), end = new Date(d.getFullYear(), h.to[0] - 1, h.to[1], 23, 59, 59);
  if (end.getTime() < now) end.setFullYear(end.getFullYear() + 1);
  return Math.max(1, Math.ceil((end.getTime() - now) / 864e5));
}

/** A key for this year's run of the event (so progress resets each year). */
export function holidayKey(h: Holiday, now = Date.now()): string {
  const d = new Date(now);
  // A winter event that started in December belongs to that December's year.
  const year = h.from[0] > h.to[0] && d.getMonth() + 1 <= h.to[0] ? d.getFullYear() - 1 : d.getFullYear();
  return `${h.id}-${year}`;
}

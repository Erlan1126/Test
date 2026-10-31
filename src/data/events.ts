// A different twist every week, the same for everyone. It applies to Classic and Daily towers.

export interface WeekEvent {
  id: string;
  name: string;
  text: string;
  /** Multiplier on how often gold penthouses appear. */
  gold?: number;
  /** Multiplier on how often icy floors appear (they also start earlier). */
  ice?: number;
  /** Multiplier on how often garden terraces appear. */
  garden?: number;
  noWind?: boolean;
  /** XP multiplier. */
  xp?: number;
}

export const EVENTS: WeekEvent[] = [
  { id: "gold", name: "Golden Week", text: "Gold penthouses show up twice as often", gold: 2 },
  { id: "ice", name: "Ice Age", text: "Icy floors appear from floor 8, three times as often", ice: 3 },
  { id: "calm", name: "Calm Skies", text: "No wind at any height", noWind: true },
  { id: "xp", name: "Builder's Week", text: "Every tower earns 50% more XP", xp: 1.5 },
  { id: "garden", name: "Garden Week", text: "Garden terraces appear twice as often", garden: 2 },
];

/** Weeks start on Monday (UTC). */
const WEEK_ZERO = Date.UTC(2026, 9, 26);
const WEEK = 7 * 864e5;

export const weekIndex = (now = Date.now()): number => Math.floor((now - WEEK_ZERO) / WEEK);

export function eventFor(now = Date.now()): WeekEvent {
  const i = weekIndex(now);
  return EVENTS[((i % EVENTS.length) + EVENTS.length) % EVENTS.length];
}

/** Milliseconds until the next event starts. */
export const eventEndsIn = (now = Date.now()): number => WEEK_ZERO + (weekIndex(now) + 1) * WEEK - now;

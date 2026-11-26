// Skyrise's signature: a tower climbs through named layers of sky. Each starts where the sky
// itself changes colour (see SKY in constants.ts), so the name, the new sky, a banner, a
// rising chime and a word from Zephyr all arrive together. Your highest layer shows on your
// profile. Presentation only: it never changes how a tower plays or scores.
import { METERS_PER_FLOOR, SKY } from "./constants";

export interface SkyLayer { id: string; icon: string; name: string; zephyr: string; at: number }

const LINES: Omit<SkyLayer, "at">[] = [
  { id: "meadow", icon: "🌿", name: "Meadow Air", zephyr: "Every great tower starts down here!" },
  { id: "clouds", icon: "☁️", name: "Cloud Sea", zephyr: "Above the clouds! My favourite view." },
  { id: "jet", icon: "💨", name: "Jet Stream", zephyr: "Hold tight, the wind is fast up here!" },
  { id: "twilight", icon: "🌇", name: "Twilight", zephyr: "The sun is setting below us. Keep going!" },
  { id: "stars", icon: "✨", name: "Starfield", zephyr: "We're up among the stars! Nobody has flown this high." },
];

/** The layers, lowest first, each starting at a floor where the sky changes. */
export const SKY_LAYERS: SkyLayer[] = LINES.map((l, i) => ({ ...l, at: SKY[i].at }));

/** The layer a tower of this many floors has reached. */
export function layerAt(floors: number): number {
  let k = 0;
  SKY_LAYERS.forEach((l, i) => { if (floors >= l.at) k = i; });
  return k;
}

/** The layer reached by a tower this many meters tall. */
export const layerForMeters = (m: number): number => layerAt(Math.floor(m / METERS_PER_FLOOR));

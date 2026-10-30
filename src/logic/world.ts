// Procedural level: a column of planets climbing upward, with stars to collect
// between them and drifting asteroids later on. Pure data, no Phaser.
import type { Planet } from "./orbit";
import { range, type Rng } from "./rng";

export const WORLD_W = 720;
export const WORLD_H = 1280;
export const PLANET_LOOKS = 6;

export interface Star {
  id: number;
  x: number;
  y: number;
}

export interface Asteroid {
  id: number;
  x: number;
  y: number;
  r: number;
  /** Horizontal speed in px/s; it bounces between minX and maxX. */
  vx: number;
  minX: number;
  maxX: number;
}

export interface Segment {
  planet: Planet;
  stars: Star[];
  asteroids: Asteroid[];
}

/** Tuning for the planet at a given hop number. Everything eases in over the first ~40 hops. */
export function difficulty(hop: number) {
  const h = Math.min(hop, 40);
  return {
    gapMin: 240 + h * 4,
    gapMax: 320 + h * 5,
    sizeScale: Math.max(0.68, 1 - hop * 0.008),
    swayChance: hop >= 8 ? Math.min(0.55, (hop - 8) * 0.045) : 0,
    asteroidChance: hop >= 14 ? Math.min(0.5, (hop - 14) * 0.035) : 0,
    /** Player speed around a planet, px/s. */
    orbitSpeed: 230 + Math.min(hop, 50) * 4,
    /** Player speed after launching, px/s. */
    launchSpeed: 660 + Math.min(hop, 50) * 3,
  };
}

export class WorldGen {
  private nextId = 1;

  constructor(private readonly rng: Rng) {}

  /** The planet the player starts on, near the bottom of the screen. */
  first(): Planet {
    return this.makePlanet(WORLD_W / 2, WORLD_H * 0.72, 46, 0, 0);
  }

  /** The next planet above `prev`, plus the stars and asteroids in the gap. */
  next(prev: Planet, hop: number): Segment {
    const d = difficulty(hop);
    const r = Math.round(range(this.rng, 30, 54) * d.sizeScale);
    const orbitR = r + range(this.rng, 46, 66);
    // Keep orbits apart so they never overlap.
    const gap = Math.max(range(this.rng, d.gapMin, d.gapMax), prev.orbitR + orbitR + 80);
    const margin = orbitR + 24;
    let x = prev.baseX;
    for (let tries = 0; tries < 12; tries++) {
      x = range(this.rng, margin, WORLD_W - margin);
      const dx = Math.abs(x - prev.baseX);
      if (dx >= 60 && dx <= 320) break;
    }
    let sway = this.rng() < d.swayChance ? range(this.rng, 50, 120) : 0;
    sway = Math.max(0, Math.min(sway, x - margin, WORLD_W - margin - x));
    const planet = this.makePlanet(x, prev.y - gap, r, sway, orbitR);

    // A short trail of stars across the gap, curving a little to reward good aim.
    const stars: Star[] = [];
    const bend = range(this.rng, -40, 40);
    for (const t of [0.35, 0.5, 0.65]) {
      stars.push({
        id: this.nextId++,
        x: prev.baseX + (x - prev.baseX) * t + Math.sin(t * Math.PI) * bend,
        y: prev.y + (planet.y - prev.y) * t,
      });
    }

    const asteroids: Asteroid[] = [];
    if (this.rng() < d.asteroidChance) {
      const ar = range(this.rng, 16, 26);
      asteroids.push({
        id: this.nextId++,
        x: range(this.rng, ar, WORLD_W - ar),
        y: prev.y - gap * range(this.rng, 0.4, 0.6),
        r: ar,
        vx: (this.rng() < 0.5 ? -1 : 1) * range(this.rng, 70, 150),
        minX: ar,
        maxX: WORLD_W - ar,
      });
    }
    return { planet, stars, asteroids };
  }

  private makePlanet(x: number, y: number, r: number, sway: number, orbitR: number): Planet {
    return {
      id: this.nextId++,
      x, y, r,
      orbitR: orbitR || r + 56,
      baseX: x,
      sway,
      swaySpeed: range(this.rng, 0.7, 1.2),
      swayPhase: range(this.rng, 0, Math.PI * 2),
      look: Math.floor(this.rng() * PLANET_LOOKS),
    };
  }
}

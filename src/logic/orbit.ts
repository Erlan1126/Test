// Orbit math, kept free of Phaser so it can be unit tested.
// Screen coordinates: x grows right, y grows down.

export interface Vec {
  x: number;
  y: number;
}

/** Which way the player circles a planet: +1 means the orbit angle increases. */
export type Spin = 1 | -1;

export interface Planet {
  id: number;
  x: number;
  y: number;
  /** Body radius. */
  r: number;
  /** Radius the player circles at. */
  orbitR: number;
  /** Horizontal sway: x = baseX + sin(t * swaySpeed + swayPhase) * sway. */
  baseX: number;
  sway: number;
  swaySpeed: number;
  swayPhase: number;
  /** Index into the planet palette. */
  look: number;
}

export function orbitPoint(center: Vec, radius: number, angle: number): Vec {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/** Unit direction of travel at an orbit angle. */
export function tangent(angle: number, spin: Spin): Vec {
  return { x: -Math.sin(angle) * spin, y: Math.cos(angle) * spin };
}

/**
 * The spin that keeps the player moving the way it arrived: rel is the player's
 * position relative to the planet, vel its velocity.
 */
export function spinFromApproach(rel: Vec, vel: Vec): Spin {
  return rel.x * vel.y - rel.y * vel.x >= 0 ? 1 : -1;
}

/** The nearest planet whose capture zone contains pos, ignoring skipId. */
export function findCapture(pos: Vec, planets: readonly Planet[], skipId: number, margin: number): Planet | null {
  let best: Planet | null = null;
  let bestDist = Infinity;
  for (const p of planets) {
    if (p.id === skipId) continue;
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if (d <= p.orbitR + margin && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** Angle in radians (0 to PI) between a velocity and the direction from `from` to `target`. */
export function aimError(from: Vec, vel: Vec, target: Vec): number {
  let a = Math.atan2(target.y - from.y, target.x - from.x) - Math.atan2(vel.y, vel.x);
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.abs(a);
}

/** Smallest distance between a point and a moving point's straight path (ray, forward only). */
export function rayDistance(origin: Vec, dir: Vec, point: Vec): number {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len, uy = dir.y / len;
  const t = Math.max(0, (point.x - origin.x) * ux + (point.y - origin.y) * uy);
  return Math.hypot(origin.x + ux * t - point.x, origin.y + uy * t - point.y);
}

// Small math, color and formatting helpers shared across the game.

export type RGB = [number, number, number];

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export const hexRgb = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** CSS color from an RGB triple, scaled by f (shading) with alpha a. */
export const rgb = (c: RGB, f = 1, a = 1): string =>
  `rgba(${clamp(Math.round(c[0] * f), 0, 255)},${clamp(Math.round(c[1] * f), 0, 255)},${clamp(Math.round(c[2] * f), 0, 255)},${a})`;

/** Stable pseudo-random value in [0, 1) for a set of inputs (window lights, tree sizes). */
export const hash = (a: number, b: number, c: number): number => {
  const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

export const fmt = (n: number): string => n.toLocaleString("en-US");

/** "the Eiffel Tower" -> "Eiffel Tower", "a house" -> "House". */
export const shortName = (n: string): string => {
  const t = n.replace(/^(the|a) /, "");
  return t[0].toUpperCase() + t.slice(1);
};

/** Joins names for one line of text: "A", "A and B", "A, B and 3 more". */
export const listNames = (names: string[]): string =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

// Every finished tower gets a name, like "Aurora Heights" or "Maple Spire", made from its
// numbers so the same tower always has the same name (no need to store it).
const FIRST = ["Aurora", "Maple", "Sapphire", "Golden", "Cloud", "Harbor", "Willow", "Crystal", "Sunset", "Ember",
  "Coral", "Starlight", "Juniper", "Velvet", "Summit", "Lumen", "Cedar", "Azure", "Marigold", "Nova",
  "Orchid", "Silver", "Meadow", "Skylark", "Amber", "Halo", "Indigo", "Breeze", "Pearl", "Comet"];
const LAST = ["Heights", "Spire", "Tower", "Plaza", "Point", "Pinnacle", "Residences", "Peak", "Court", "House", "Terrace", "Gardens"];

export function towerName(score: number, floors: number, day: string): string {
  let h = 2166136261;
  for (const c of `${score}|${floors}|${day}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  // Taller towers get the grander endings.
  const last = floors >= 60 ? LAST[[0, 1, 5, 7][h % 4]] : LAST[(h >>> 8) % LAST.length];
  return `${FIRST[(h >>> 3) % FIRST.length]} ${last}`;
}

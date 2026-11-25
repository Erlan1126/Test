// Population milestones (Buildaroo): when the town's people pass each mark, the camera flies
// over the whole town, fireworks go up, and the city gets Sky Crystals.
import { townPeople } from "./props";
import type { SaveData } from "./save";

export const PEOPLE_MILESTONES: { at: number; crystals: number }[] = [
  { at: 250, crystals: 5 },
  { at: 1000, crystals: 10 },
  { at: 2500, crystals: 15 },
  { at: 5000, crystals: 20 },
  { at: 10000, crystals: 30 },
  { at: 20000, crystals: 40 },
  { at: 35000, crystals: 50 },
  { at: 50000, crystals: 75 },
  { at: 75000, crystals: 100 },
  { at: 100000, crystals: 150 },
];

/** Marks passed so far. */
export const milestonesPassed = (s: SaveData): number => PEOPLE_MILESTONES.filter(m => townPeople(s) >= m.at).length;

/** The next milestone not yet reached, if any. */
export const nextMilestone = (s: SaveData) => PEOPLE_MILESTONES.find(m => townPeople(s) < m.at);

/** A milestone just passed (paid; one at a time), or null. A save from before milestones
 *  starts at the marks it has already passed, without paying them. */
export function checkMilestone(s: SaveData): { at: number; crystals: number } | null {
  const n = milestonesPassed(s);
  if (s.peopleMilestone < 0) { s.peopleMilestone = n; return null; }
  if (n <= s.peopleMilestone) return null;
  const m = PEOPLE_MILESTONES[s.peopleMilestone];
  s.peopleMilestone++;
  s.crystals += m.crystals;
  return m;
}

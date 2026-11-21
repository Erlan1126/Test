// Land for sale next to the island: three pieces of ground floating just off the town's edge.
// Each one is bought with the company's cash, then it joins the island for good with
// something built on it, and every business earns a little more. They go on sale one at a
// time, the first once the company has two businesses.

export type LandId = "meadow" | "lakeside" | "hills";

export interface LandPlot {
  id: LandId;
  name: string;
  icon: string;
  /** What gets built on it. */
  what: string;
  /** Its price: this many minutes of what the company earns, and never less than `min`. */
  minutes: number;
  min: number;
  /** Which way from the middle of the island it lies (x, z). */
  dir: [number, number];
}

export const LAND: LandPlot[] = [
  { id: "meadow", name: "Meadow Fields", icon: "⚽", what: "A sports field with stands and floodlights", minutes: 8, min: 15000, dir: [0.2, 1] },
  { id: "lakeside", name: "Lakeside", icon: "🎡", what: "A lake with a Ferris wheel and a pier", minutes: 20, min: 400000, dir: [-0.75, 1] },
  { id: "hills", name: "Hillside Homes", icon: "🏡", what: "A new neighborhood of family homes", minutes: 35, min: 8000000, dir: [1, 0.85] },
];

/** How much more every business earns for each piece of land bought. */
export const LAND_BONUS = 0.05;

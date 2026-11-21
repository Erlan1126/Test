// Districts for sale: three whole islands beside the town, each about as big as its core.
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
  { id: "meadow", name: "Harbor District", icon: "⚓", what: "A whole new island: a marina with boats, a fish market, a lighthouse and seaside homes", minutes: 15, min: 50000, dir: [0, 1] },
  { id: "lakeside", name: "Garden Hills", icon: "🎡", what: "A whole new island: big family homes, parks, a lake and a Ferris wheel", minutes: 40, min: 5000000, dir: [-1, 0] },
  { id: "hills", name: "Downtown", icon: "🏙️", what: "A whole new island: tall towers round a fountain square", minutes: 90, min: 200000000, dir: [1, 0] },
];

/** How much more every business earns for each piece of land bought. */
export const LAND_BONUS = 0.15;

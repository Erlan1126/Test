// Districts for sale: seven whole islands beside the town, each about as big as its core, each
// one floating higher and grander than the last, all the way up to space.
// Each one is bought with the company's cash, then it joins the island for good with
// something built on it, and every business earns a little more. They go on sale one at a
// time, the first once the company has two businesses.

export type LandId = "meadow" | "lakeside" | "hills" | "resort" | "cloud" | "crystal" | "orbit";
export type LandTheme = "harbor" | "garden" | "downtown" | "resort" | "cloud" | "crystal" | "orbit";

export interface LandPlot {
  id: LandId;
  name: string;
  icon: string;
  /** What gets built on it. */
  what: string;
  /** Its price: this many minutes of what the company earns, and never less than `min`. */
  minutes: number;
  min: number;
  /** Which way from the middle of the town the first island lies (x, z); the others follow
   *  round the town, each one further out. */
  dir: [number, number];
  /** How high it floats: every island is higher (and grander) than the one before. */
  y: number;
  theme: LandTheme;
  /** Its fixed number: what its buildings are saved under (the props' "d{slot}:i,j" keys) and
   *  what seeds its look. Never changes, even when a district is added in the middle of the
   *  list (LAND's order is only the order they go on sale in). */
  slot: number;
}

export const LAND: LandPlot[] = [
  { id: "meadow", name: "Harbor District", icon: "⚓", what: "New land for the city: a marina with boats, a fish market, a lighthouse and seaside homes", minutes: 15, min: 50000, dir: [-1, 0], y: 0, theme: "harbor", slot: 0 },
  { id: "lakeside", name: "Garden Hills", icon: "🎡", what: "A new neighbourhood joined to the city: big family homes, parks, a lake and a Ferris wheel", minutes: 40, min: 5000000, dir: [1, 0], y: 0, theme: "garden", slot: 1 },
  { id: "hills", name: "Downtown", icon: "🏙️", what: "The city's business quarter: tall towers round a fountain square", minutes: 90, min: 200000000, dir: [0, 1], y: 0, theme: "downtown", slot: 2 },
  { id: "resort", name: "Beach Resort", icon: "🏖️", what: "A seaside resort joined to the city: curved hotel towers, a pool with loungers, colourful cabanas and a beach with a pier", minutes: 130, min: 3e9, dir: [1, 1], y: 0, theme: "resort", slot: 6 },
  { id: "cloud", name: "Cloud Kingdom", icon: "👑", what: "The sky city, floating above: white marble villas with golden domes and a golden palace, reached by a sky lift", minutes: 180, min: 5e10, dir: [-1, -1], y: 30, theme: "cloud", slot: 3 },
  { id: "crystal", name: "Crystal Spire", icon: "💎", what: "The sky city grows: glowing crystal towers round a giant crystal spire", minutes: 300, min: 2e13, dir: [-1, 0], y: 30.06, theme: "crystal", slot: 4 },
  { id: "orbit", name: "Orbit Station", icon: "🚀", what: "The top of the sky city: glass domes, a launch pad and a rocket ready to go", minutes: 500, min: 1e16, dir: [0, -1], y: 30.12, theme: "orbit", slot: 5 },
];

/** How much more every business earns for each piece of land bought. */
export const LAND_BONUS = 0.15;

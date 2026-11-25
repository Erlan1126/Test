// Island decorations: things you add to Skyhaven with Sky Crystals. Each one appears in the
// town for good and brings in more visitors (every business earns a little more).

export interface Decor {
  id: string;
  name: string;
  text: string;
  /** Price in Sky Crystals (premium decorations)... */
  crystals?: number;
  /** ...or in cash (island upgrades anyone can grow into). */
  cash?: number;
  /** A drawn icon (see ui/icons). */
  icon: string;
  /** Only won in a seasonal event (never sold, never a weekly prize). */
  seasonal?: boolean;
}

/** Each decoration makes every business earn this much more (they stack). */
export const DECOR_BONUS = 0.03;

export const DECOR: Decor[] = [
  { id: "yacht", name: "Luxury yacht", text: "A white yacht moored off the beach, lights on at night", crystals: 60, icon: "boat" },
  { id: "balloon", name: "Hot-air balloon", text: "A striped balloon drifting over the town", crystals: 80, icon: "balloon" },
  { id: "seaplane", name: "Seaplane tours", text: "A little seaplane circling the island", crystals: 100, icon: "plane" },
  { id: "wheel", name: "Ferris wheel", text: "A big wheel turning on the beach, glowing after dark", crystals: 120, icon: "wheel" },
  { id: "fireworks", name: "Nightly fireworks", text: "A fireworks show over the sea every night", crystals: 90, icon: "party" },
  { id: "statue", name: "Golden founder statue", text: "Your golden statue in the plaza fountain", crystals: 150, icon: "statue" },
  { id: "beachclub", name: "Beach club", text: "A cabana bar with loungers and lanterns on the sand", crystals: 70, icon: "sun" },
  { id: "marina", name: "Marina", text: "A second pier with little boats bobbing at their moorings", crystals: 110, icon: "boat" },
  { id: "garden", name: "Glass garden", text: "A greenhouse dome full of plants, glowing at night", crystals: 140, icon: "leaf" },
  { id: "skytram", name: "Sky tram", text: "A cable car gliding out to a little floating island", crystals: 200, icon: "airship" },
  { id: "bigtree", name: "Giant holiday tree", text: "A giant tree in the plaza fountain every winter, lit with colored bulbs", crystals: 150, icon: "tree", seasonal: true },
  { id: "blossomarch", name: "Blossom arch", text: "An arch of pink blossom over the plaza fountain every spring", crystals: 150, icon: "leaf", seasonal: true },
  { id: "bandstand", name: "Summer bandstand", text: "A striped bandstand with a band playing in the plaza every summer", crystals: 150, icon: "party", seasonal: true },
  { id: "giantpumpkin", name: "Giant pumpkin", text: "A glowing giant pumpkin in the plaza fountain every Halloween", crystals: 150, icon: "party", seasonal: true },
];

/** The decorations the weekly city event gives away in turn. */
export const WEEKLY_DECOR = DECOR.filter(d => !d.seasonal);

/** The one island upgrade bought with the company's cash (most are Sky Crystals). */
export const UPGRADES_CASH: Decor[] = [
  { id: "foodtrucks", name: "Food trucks", text: "Three food trucks round the plaza, with a line at lunch", cash: 25e3, icon: "dish" },
];

export const decorById = (id: string): Decor | undefined => DECOR.find(d => d.id === id) ?? UPGRADES_CASH.find(d => d.id === id);

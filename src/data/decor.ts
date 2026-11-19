// Island decorations: things you add to Skyhaven with Sky Crystals. Each one appears in the
// town for good and brings in more visitors (every business earns a little more).

export interface Decor {
  id: string;
  name: string;
  text: string;
  /** Price in Sky Crystals. */
  crystals: number;
  /** A drawn icon (see ui/icons). */
  icon: string;
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
];

export const decorById = (id: string): Decor | undefined => DECOR.find(d => d.id === id);

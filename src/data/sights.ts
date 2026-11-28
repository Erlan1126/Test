// What every building and place in the city is, for the card that opens when it's tapped
// (like in the big city builders): a name, an icon and a line or two about it.
// The kinds come from the city's builder (render3d/bizcity.ts, `sights()`).

export interface SightInfo { icon: string; name: string; text: string; level?: number }

const BLOCKS: Record<number, [string, string, string]> = {
  1: ["🏘️", "Townhouses", "Three families live here, with window boxes and a shared garden at the back."],
  2: ["🏠", "Apartment house", "Small flats over a corner shop. Its people work in your businesses."],
  3: ["🏢", "Apartment block", "Dozens of flats and a lobby with a doorman. The city is filling up!"],
  4: ["🏬", "Office building", "Offices on every floor: Skyhaven's workers come here every morning."],
  5: ["🏙️", "Skyscraper", "A glass tower near the middle of town. Buildings grow taller as the city's rank rises."],
};

const PLACES: Record<string, [string, string, string]> = {
  park: ["🌳", "Pocket park", "A little park with a pond, a bench and flower beds, where the neighbors take a break."],
  lighthouse: ["🗼", "Lighthouse", "Its lamp sweeps over the sea at night and guides the boats home."],
  "th-marina": ["⛵", "Harbor marina", "Sailboats moored along the pier. The Harbor's heart."],
  "th-market": ["🧺", "Harbor market", "Fresh fish and fruit under striped awnings."],
  "th-lighthouse": ["🗼", "Harbor lighthouse", "Red and white, on the Harbor's corner, lit every night."],
  "th-park": ["🌳", "District park", "Lawns, trees and a winding path."],
  "th-lake": ["🦢", "Garden lake", "Rowing boats and swans. Garden Hills is built around it."],
  "th-wheel": ["🎡", "Big wheel", "Turns slowly all day: the best view of Garden Hills."],
  "th-fountain": ["⛲", "Fountain square", "Downtown's meeting place, ringed by towers."],
  "th-plaza": ["🏛️", "Downtown plaza", "Granite paving, lit bollards and lunch-time crowds."],
  "th-palace": ["🏰", "Cloud palace", "The Cloud Kingdom's palace, floating high above the town."],
  "th-skygarden": ["🌿", "Sky garden", "Terraces of flowers on the clouds."],
  "th-spire": ["💎", "Crystal spire", "A tower of living crystal that glows at night."],
  "th-rocket": ["🚀", "Rocket pad", "Every so often, a rocket launches from here."],
  "th-dish": ["📡", "Radio telescope", "A giant dish listening to the stars."],
  "th-hotel": ["🏨", "Resort hotel", "A curved tower of sea-view rooms, with a balcony on every floor."],
  "th-pool": ["🏊", "Resort pool", "Loungers, umbrellas and a curly slide into the deep end."],
  "th-cabanas": ["⛱️", "Beach cabanas", "Striped cabanas on the sand, their curtains open to the breeze."],
  "th-palms": ["🌴", "Palm garden", "Palms round a shell fountain: the way into the Beach Resort."],
  "th-lagoon": ["🛶", "Lagoon pier", "A wooden pier over clear water, with boats tied up at the end."],
  "th-beach": ["🏖️", "Resort beach", "Rows of loungers down to the water, and a volleyball net."],
  rank1: ["🛍️", "Street market", "Striped stalls and shoppers on the plaza. Opened when Skyhaven became a Village."],
  rank2: ["🚋", "Tram stop", "The little tram runs round the streets. Opened when Skyhaven became a Town."],
  rank3: ["📺", "Billboards", "Glowing billboards light up the corners. Arrived when Skyhaven became a City."],
  rank5: ["🛥️", "Superyacht", "Anchored in the bay since Skyhaven became a Metropolis."],
  rank6: ["👑", "Skyhaven Tower", "The golden tower over everything: Skyhaven is a Sky Capital."],
  rank7: ["🏝️", "Floating island", "The island beside the town, joined by a rope bridge."],
  lot: ["🏡", "Empty lot", "Room for new homes. Sell a few coffees first, then you can build here."],
  home: ["🏠", "Family home", "A neighbor's home. Soon you can upgrade homes for rent."],
};

/** The card text for a tapped place (or null if it isn't one we know). */
export function sightInfo(kind: string): SightInfo | null {
  const m = /^block(\d)$/.exec(kind);
  if (m) {
    const lv = Math.max(1, Math.min(5, Number(m[1]))), [icon, name, text] = BLOCKS[lv];
    return { icon, name, text, level: lv };
  }
  const p = PLACES[kind];
  return p ? { icon: p[0], name: p[1], text: p[2] } : null;
}

/** About how many people live or work in a city block of each level. */
export const SIGHT_PEOPLE = [0, 12, 30, 90, 240, 600];

/** The city album: every kind of building and place there is to find (by tapping it). */
export const ALBUM_KINDS: string[] = ["block1", "block2", "block3", "block4", "block5", "park", "lighthouse", "home",
  "rank1", "rank2", "rank3", "rank5", "rank6", "rank7",
  "th-marina", "th-market", "th-lighthouse", "th-park", "th-lake", "th-wheel", "th-fountain", "th-plaza",
  "th-hotel", "th-pool", "th-cabanas", "th-palms", "th-lagoon", "th-beach",
  "th-palace", "th-skygarden", "th-spire", "th-rocket", "th-dish"];
/** Crystals for each new find, and for the whole album. */
export const ALBUM_CRYSTALS = 2;
export const ALBUM_DONE_CRYSTALS = 50;

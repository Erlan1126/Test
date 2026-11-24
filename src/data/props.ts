// Properties: every home, block of flats and office round town (and in the districts) is
// yours. Each starts small (level 1) and grows as you upgrade it, up to a glass tower at
// level 5. Every level above the first makes every business earn a little more (the rent the
// town's people pay), for good.

export const PROP_MAX = 5;
/** How much more every business earns for each property level above 1. */
export const PROP_BONUS = 0.02;
/** What each level looks like (the building grows). */
export const PROP_TIERS = ["Empty lot", "Little homes", "Apartments", "Apartment block", "City tower", "Glass skyscraper"];
/** How many people live in a property at each level. */
export const PROP_PEOPLE = [0, 8, 24, 60, 140, 320];


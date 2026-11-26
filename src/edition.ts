// Which app this build is. One codebase makes two games (see docs/TWO_GAMES_PLAN.md):
//  - "full": both together, as the game has shipped so far (the default build);
//  - "skyrise": the tower-stacking arcade game alone (no business city);
//  - "city": the city tycoon (for now the same as "full"; it gets its own front door later).
// Chosen at build time: `npm run build:skyrise` sets VITE_EDITION=skyrise.
export type Edition = "full" | "skyrise" | "city";

const raw = (import.meta.env?.VITE_EDITION ?? "") as string;
export const EDITION: Edition = raw === "skyrise" || raw === "city" ? raw : "full";

/** The game's name in this build: the tower game alone is Skyrise, the city game is Buildaroo. */
export const GAME_NAME = EDITION === "skyrise" ? "Skyrise" : "Buildaroo";

/** This build has the business city (the tycoon, its town and Mayor Pip's City Plan). */
export const HAS_CITY = EDITION !== "skyrise";

/** The player has started: built a first tower (the tower game), or, in the city game, has
 *  a first building in town (every new player gets one: the city comes first). */
export const playerStarted = (s: { profile: { towers: number }; cafe: { starter: unknown } }): boolean =>
  s.profile.towers >= 1 || (HAS_CITY && !!s.cafe.starter);

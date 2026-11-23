# Review brief: Skyrise city (second opinion)

Branch: `claude/skyrise-living-block` (same code as `claude/new-session-klw8t6`, which Codemagic builds).

## What the game is right now
Two games in one:
1. **Skyrise (the original):** tap to drop floors and stack a tower (`src/logic/sim.ts`, `src/render3d/renderer3d.ts`).
2. **The city tycoon:** 46 businesses (10 in town, 6 in each of 6 districts), 8 building stages each,
   a City Plan of 10 chapters (`src/data/chapters.ts`), Town Hall, districts you buy with cash
   (`src/data/land.ts`), a city that grows block by block (`src/render3d/bizcity.ts`).
   The two connect through "office floors": every tower floor you build adds office space for business levels.

## What changed recently (please check these first)
- One city grid: every block past the town is on the town's street grid (`gridOut` in `setLand`, bizcity.ts).
- The city starts small and spreads: `townHomes()` and `cityGrow()` in `src/logic/tycoon.ts`.
- New Era now resets the whole city (rank, buildings, districts, annex, HQs, cash upgrades): `newEra()`.
- City Plan chapters drive the Next step card (`planStep()` in `src/ui/tycoon.ts`).
- Menus slide away and crossfade (`src/ui/dom.ts`, end of `src/styles.css`).
- Tight block corners, crosswalks at crossroads, new blocks rise when the city grows.

## Please review, as a player and as a developer
1. **Look:** what still looks wrong or cheap in the city (streets, corners, edges, buildings, districts, sky city)?
2. **Feel:** does growing the city feel rewarding? What's missing between taps?
3. **Direction:** is the City Plan clear enough? Does a new player know what to do next?
4. **Bugs:** anything broken, overlapping, flickering, or slow (phones matter most).
5. **Product question:** should Skyrise (tower stacking) and the city tycoon stay one game or become two?

## How to work
- Run: `npm ci && npm test && npm run build`. Tests must stay green (237 now).
- Keep changes on your own branch and describe them, so they can be merged and compared.
- Never push to `main`.

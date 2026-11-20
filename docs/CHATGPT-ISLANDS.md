# Skyrise — Islands, genre differentiation and mobile town review
Date: 2026-11-20. Base: `claude/skyrise-living-block`. Review only: no gameplay changes.

## Executive decision
**Choose A: permanent adjacent floating islands, not relocating the town.** Skyhaven's core promise is growing one home from a neighbor into the Capital of the Sky. Moving/replacing the original neighborhood undermines attachment to the neighbor, café, flower market and tram. Adjacent islands create a visible skyline and long-term anticipation. Build a *single small annex* first, not multiple full city simulations. Do not introduce another prestige/reset, currency, or rank track.

## Q1 — What comparable games teach
- **AdVenture Capitalist:** multiple themed investment locations and a prestige-style income loop provide long-term new goals; useful lesson is fresh destinations, not copying resets or independent currencies.
- **Egg, Inc.:** a ladder of distinct egg/farm types gives the next aspirational unlock, while prestige resets much of the farm in exchange for lasting bonuses. This is effective for numbers-first idle progression but a poor fit for a beloved persistent neighborhood. Source: https://egg-inc.fandom.com/wiki/Prestige
- **Idle Miner Tycoon:** multiple mines/continents with different currencies and unlock gates extend play, and managers automate production. Its official FAQ describes seven continents and prestige-star requirements. Copy clear destination previews and automation, *not* the proliferation of currencies. Sources: https://kolibri-games.helpshift.com/hc/en/3-idle-miner-tycoon/faq/75-what-are-the-different-continents-in-the-idle-miner-tycoon-world/ and https://kolibri-games.helpshift.com/hc/en/3-idle-miner-tycoon/faq/205-how-can-i-unlock-continents-with-prestige/
- **SimCity BuildIt:** themed regions are separate satellite cities unlocked after capital progress; its official guide says regions begin at capital level 25 and have unique buildings and materials. This is the closest structural analogy to A, but Skyrise should avoid the extra regional economies. Source: https://help.ea.com/en/articles/simcity/simcity-buildit/beginner-guide/
- **Pocket City / Pocket City 2:** creative town-building rewards ownership, layout and visible neighborhood changes; expansion should be legible and playful, not another spreadsheet.
- **Township:** persistent home-town expansion, production and residents' requests make long-running growth feel personal. Prefer one place the player cares about.
- **Cozy builders (Animal Crossing, Stardew Valley):** attachment comes from familiar places, recognizable characters, small changes and anticipation. The old neighborhood should remain visible and relevant.

### Evidence in Skyrise
- `docs/PURPOSE-PLAN.md`: explicitly defines one Skyhaven, seven ranks, and recurring neighbor moments.
- `src/data/ranks.ts`: Hamlet 0, Village 50, Town 150, City 300, Big City 500, Metropolis 800, Sky Capital 1200 business levels. Metropolis already promises a skyline on floating islands. Avoid a competing island-level ladder.
- `src/render3d/bizcity.ts`: `buildBizCity` already draws three decorative small islets next to the main hull (the `islets` block); they are **not buildable plots**. `CELLS` defines ten business lots; `lotPos` clamps indices, so adding businesses without new lot positions would overlap the last lot. Do not simply add a new lot to the existing array.
- `src/data/islands.ts`: `ISLAND_THEMES` are existing themes/skins (Meadow, Snow, Desert, Blossom, premium Volcano/Candy), with builder-level and population fields; `ISLAND_UPGRADES` are landmark-based cosmetics. These are **not** a new physical multi-island building system. Keep theme cosmetics separate from expansion ownership.
- `src/ui/tycoon.ts` `renderGoal()` and `showPlan()` already communicate rank progress. Use those surfaces to preview an annex unlock.

### Small-team MVP (one annex, no new economy)
1. Pick **one existing decorative islet**, ideally the visually clearest side islet. On **Big City (500 business levels)**, show a ghost outline and Pip's invitation: “Our neighbors need a garden across the sky.” Unlock the island by completing **one existing-money construction project** (or make it a rank reward); no extra currency.
2. Replace its decorative tree arrangement with **one fixed 3D build pad** and one choice from two lightweight landmarks (e.g. greenhouse or lookout). A bridge/sky tram connection can be decorative; no pathfinding across islands in v1.
3. One familiar neighbor visits via a short scripted arrival/departure beat; add a persistent visible object (bench/flowers/lantern) after completion. Reuse current shaders, materials, props, and rank event system.
4. Store a minimal save state, e.g. `annex: { unlocked: boolean, project: "garden" | "lookout" | null }`, with migration/default for old saves. Do not change existing `ISLAND_THEMES` semantics or reset annex on New Era.
5. Make it visible from the existing town camera; tapping its label opens a tiny project card. Ensure the camera frames both original town and annex without shrinking the first neighborhood to unreadability. If that fails on phones, provide a tap-to-focus camera animation instead.
6. Acceptance: existing saves work; rank never decreases; annex persists after New Era; no extra currencies or timers; first neighbor's café remains; 390×844 labels/taps work; performance remains acceptable on a midrange phone.

**Later, only if players love the first annex:** a second island at Metropolis with a new visual identity, using the same data/renderer pattern. Sky Capital's golden tower remains on the original island. Optional cosmetic theme selection is not a town relocation mechanic.

## Q2 — Five highest-value gaps (simplest first)
These are **incremental gaps**, not claims that the game has none of these systems. Prioritize clarity and payoff before content volume.

1. **Next action tied to a visible change.** Current `nextStep()` in `src/ui/tycoon.ts` has many possible prompts, while `docs/PURPOSE-PLAN.md` still lists a rank-aware City Plan as next. Change priority: urgent tutorial → unclaimed story → nearest visible rank/project change → generic upgrade. Show “Grow 12 business levels → tram stop” rather than an abstract upgrade. No new screen.
2. **Camera celebrates each permanent unlock.** Rank fireworks and neighbor dialogue exist in `checkRank()`, but a guaranteed camera visit to the *new landmark* is still listed as unbuilt. On rank up, briefly focus the landmark, label it, then return to player camera; provide Skip and reduced-motion behavior.
3. **A simple collection of meaningful before/after moments.** The town has visible unlocks but lacks a clearly presented scrapbook of its growth. Reuse the existing rank list/Mayor plan: seven before/after postcards (or static thumbnails) that unlock with ranks. Start with text + icon and only later capture images. Tap to revisit the location.
4. **More resident agency, not just more pedestrians.** Neighbor moments already exist, but the player's choice is limited. Offer one low-cost neighborhood request per rank (flowers vs benches; choose one) and persist the visible result. No branching story tree, complex NPC AI, or new economy.
5. **A durable long-game destination beyond Sky Capital without erasing it.** Use the one-annex MVP above, with its own tiny 2–3-step build project after the core rank unlock. Keep the single “Capital of the Sky” goal primary and make the annex an epilogue/expansion, not rank eight.

Why these five: leading idle games have a clear next milestone, strong celebration and a fresh unlock; leading city/cozy games also reward place attachment, customization and persistent evidence of growth. Skyrise already has income loops, ranks, character scenes, tram stops and decorations. More menus, currencies, passes or reset loops would add friction before improving the core experience.

## Q3 — 390×844 phone: static code/CSS audit
**Limit:** this is a source audit, **not a browser screenshot or instrumented 390×844 playtest**. Below are concrete risks and checks; do not treat them as confirmed pixel overlaps.

**P1 — Goal bar and event chips overlap risk.** `src/styles.css` puts `.tcy-goal` at `safe-area + 84px` (near line 3779) while `.tcy-events` starts at `safe-area + 90px` (near line 3057). They occupy almost the same vertical band when both visible, both at high z-index. Fix by placing events below the goal (e.g. CSS variable measuring the goal height or one flex column for top UI), with adequate gap. Verify simultaneous goal + golden customer/boom event at 390×844.

**P1 — Selected business card / next-step card may obscure lower town.** `.tcy-card` bottom is `safe-area + 104px` (near line 3091) and `.tcy-next` bottom is also `safe-area + 104px` (near line 3060); code hides `tcy-next` when a business is selected, so *the two should not overlap each other*, but a tall selected card can cover buildings and tags. Limit card height with internal scrolling or compact it on small screens; test longest business names, manager text, and large currencies.

**P2 — Top wallet can crowd gems.** `.tcy-top` spans 12px left/right with a wallet and a gem button. `.tcy-coins` is 24px and gem button adds a plus circle; on 390px, long amounts/rate may squeeze. Give wallet `min-width:0`, truncate or abbreviate currency/rate, and prevent gem button shrink. Test very large balances and localization.

**P2 — Bottom tab bar has conflicting historical rules.** `.tcy-bar` is set to five columns at ~3038, overridden to three at ~3118, then back to five with `!important` at ~3309. This is fragile even if the last rule wins. Consolidate to one canonical five-column definition. Check the raised Build icon and all five labels at 390px and 200% text zoom.

**P2 — Goals and other tabs may hide their own close controls.** `body.tabs-open .modal.tab-page .close-btn { display:none!important; }` (~3325) assumes the fixed tab bar is the exit. Confirm every tab-page can return to the town with one tap and keyboard/back behavior works. Add a clearly named “Town” action if testers miss it.

**P2 — Duplicate progress language.** `index.html` exposes a town goal, Goals, Company, builder level, City and rank-related screens. `docs/PURPOSE-PLAN.md` itself flags competing systems. On mobile, use one always-visible town goal; put builder XP, passes and missions behind secondary pages. `src/ui/tycoon.ts` `renderGoal()` uses “Goal: grow Skyhaven to the Sky Capital” plus rank fractions; test whether the tiny 9px line and 14px rank line truncate. Consider “Sky Capital” + “Village → Town · 120/150” with an accessible full label.

**P3 — Fixed modal page viewport math.** `body.tabs-open .modal.tab-page` reserves safe-top + 84px and safe-bottom + 100px; combined with `.sheet` height 100%, this can leave a short inner scroll region on an 844px phone, especially with browser bars or keyboard. Test `100dvh`, safe-area insets, long sheets, scrolling to final button, and focus with keyboard open.

### Exact manual regression states to capture (390×844)
Fresh first tower; goal unlocked with golden event chip; long currency + gem count; selected business with long action text; Goals and Company pages at bottom of scroll; rank-up celebration with Mayor/neighbor dialogue; landscape or 200% text scaling. Check no horizontal scrolling, no hidden primary actions, readable labels, and minimum ~44px tap targets.

## Order of work
1. Fix goal/events vertical collision and verify 390×844 screenshots.
2. Make Next Step rank/landmark-aware.
3. Camera-focus rank landmarks.
4. Prototype one non-simulated annex with one project and neighbor beat.
5. Only after testing, decide whether to build a second island.

## Sources and scope
Repository: `docs/PURPOSE-PLAN.md`, `src/render3d/bizcity.ts`, `src/data/ranks.ts`, `src/data/islands.ts`, `src/ui/tycoon.ts`, `index.html`, `src/styles.css` on `claude/skyrise-living-block`. External references linked above. This is a read-only review of gameplay and CSS; the only proposed repository change is this documentation file on a separate PR branch.

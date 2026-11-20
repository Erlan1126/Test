# Skyrise — Purpose Review

Repository: Erlan1126/Test  
Reviewed branch: `claude/skyrise-living-block`  
Review method: static code-path walkthrough, not a real device playtest. No game code changes proposed in this PR.

## Verdict

Skyrise has the mechanics for a long-term game but not one consistently communicated reason to care. The strongest asset is the **living neighborhood**: the first tower remains beside the coffee cart; a yellow-jacket neighbor moves in, buys coffee, asks for seating; the terrace, flower market and playground bring visible activity. This makes a better emotional center than coin totals. Meanwhile Hamlet → Sky Capital already provides a clear finish line. Connect those two, instead of adding another progression system.

## One main purpose (player-facing)

**Build Skyhaven from one tiny neighborhood into a thriving capital in the clouds, one tower and one happy neighborhood at a time.**

The *capital* is the destination; *people and neighborhoods* make it matter; *tower stacking* is how the player helps. Coins, managers, floors, ranks and New Eras are means, not the goal. Avoid promising a numerical happiness simulation: the game does not currently have one.

## Predicted player feelings (code-based, not observed playtest)

| When | What works | What is missing |
| --- | --- | --- |
| Minute 1 | Simple, tactile drop-and-stack skill loop, gentle first five towers, first perfect-drop praise. | A one-line explanation of why the tower matters to the town; the first-session tutorial focuses on mechanics. |
| Minute 10 | First tower persists by coffee cart; neighbor arrival, seating request and terrace are unusually concrete rewards. Company first steps (first sale → level → manager) and a 20-minute opening bonus help momentum. | City-building, company management and other reward paths fight to be *the* main goal. Player sees tasks but not a unified promise. |
| Day 2 | Managed businesses earn offline; welcome shows earnings; daily calendar, three company goals and streak rewards provide a return reason. | Collecting and reinvesting money can dominate; the town's next visible change is less prominent than earnings. |
| Day 7 | Weekly festival business, league, Community Spire, pass, chapters and rank growth provide variety. | Several parallel clocks and reward tracks; the player may remember a larger wallet, not the neighborhood they helped. Actual progression by day 7 varies greatly with playtime and skill. |

## What I traced

- `src/app.ts`: save load, tutorial flag, startup to Tycoon after first tower, `tickTycoon` and offline welcome, tower start and easy-first-five handling, result settlement, `cafeRun`, first-tower placement, terrace/project rewards, office floors, HQ evolution and home/menu refresh.
- `src/ui/tycoon.ts`: Tycoon front door, wallet, build sheet, first-step guidance, `nextAct` priority, town interaction, tabs, goals, business upgrades and New Era.
- `src/logic/tycoon.ts`, `src/data/tycoon.ts`, `src/data/ranks.ts`: business cycles/managers, offline income, first-20-minute opening boost, 25 starter office slots + 2 per tower floor, used business levels as town-rank thresholds (0/50/150/300/500/800/1200), rankBest preservation and New Era resets.
- `src/logic/cafe.ts` and `src/render3d/block.ts`: starter tower, yellow-jacket neighbor, terrace, flower market/playground, visible visitors and activity.
- `src/data/chapters.ts`: existing Mayor Pip narrative, chapter goals from towers, height, population, city buildings, businesses, managers, eras; final chapter already named “Capital of the sky.”
- `src/logic/save.ts`, `src/logic/daily.ts`, `src/data/daily.ts`, `src/logic/pass.ts`: persistent state, streak/rent/league, daily and pass rewards.

This is a static review of source behavior, not a timed interactive playthrough; I did not verify animations, pacing or actual day-seven completion on hardware.

## The everyday loop (small-team scope)

1. **Return:** “While you were away, Skyhaven earned X; your neighborhood is ready for Y.” Keep the offline money, but put the place first.
2. **Choose one next need:** “The neighbor needs a terrace,” “Open the flower market,” “Build an HQ,” or “Only N business floors until Village's street market.” One main objective, not five equal cards.
3. **Play a tower / spend earnings:** Towers create office capacity, residents and project progress; managers automate the money that pays for business growth.
4. **Watch a visible change:** a neighbor sits, shoppers appear, a business evolves, the tram arrives, or a new district opens. Briefly show the result in the 3D town.
5. **Leave with anticipation:** “Next: Village — 34/50 business floors; street market opens.” Returning tomorrow is attractive because the player has a specific unfinished transformation.

Use the existing daily company goals as optional bonus tasks that naturally feed this main loop. No new energy meter, mandatory daily grind or new resource.

## Five changes, simplest first

### 1. Put the purpose and next *visible* unlock on the front door (small)

**Files:** `src/ui/tycoon.ts`, possibly the existing home-screen markup/styles in `index.html` and CSS.

Replace vague company-growth messaging with one permanent city headline: “Grow Skyhaven into the Sky Capital.” Below it, show current rank, progress toward the *next* rank threshold and the exact town change that unlocks (already defined in `src/data/ranks.ts`). Example: “Hamlet → Village: 12/50 business floors · Next: street market.” Keep the existing next-action button, but label it as a step toward this outcome. No new save fields.

**Acceptance:** Within five seconds of opening the town, a new player can say what they are building, what comes next, and why the suggested action helps.

### 2. Make each tower result say what it did *for Skyhaven* (small)

**Files:** `src/app.ts`, `src/ui/tycoon.ts` (and existing result UI markup if needed).

Promote the already-computed city gain, people, office floors, terrace and HQ/project completion above score/coin breakdowns. Example: “+18 residents · +16 office spaces · 8 spaces until Village.” For the first tower, foreground “Your first neighbors have moved in!” and point to the visible neighbor/café. Preserve the detailed score for interested players.

**Acceptance:** Every successful Classic tower yields one understandable city-impact line and, where relevant, a preview of the next visible change.

### 3. Make the existing next-action selector a *city plan* (small-medium)

**Files:** `src/ui/tycoon.ts`, `src/data/ranks.ts`, `src/data/chapters.ts` or `src/ui/mayor.ts` only if chapter copy needs aligning.

The current `nextAct` already prioritizes first sale, terrace, manager, project, HQ, rewards, business and upgrades. Keep this logic; reword/group it as a **single City Plan**: one primary action, one sentence connecting it to the current neighborhood or rank. Priority should be (a) complete visible neighborhood transformation, (b) unlock rank transformation, (c) unblock with tower/office space or money, (d) collect a reward. Don't surface an affordable generic upgrade above a ready visible town change. Make Mayor Pip's chapter prompt complement rather than compete with this plan.

**Acceptance:** At any point, the player sees one main recommended action; its explanation names the resulting change to Skyhaven.

### 4. Turn the day-two return into a neighborhood update (medium)

**Files:** `src/ui/tycoon.ts`, `src/app.ts`, `src/logic/daily.ts` or `src/logic/tycoon.ts` only if a small selector is needed.

Reuse the existing offline welcome and daily calendar, but lead with “Welcome back to Skyhaven.” Show (1) offline earnings, (2) one current town need/next landmark, (3) today's optional bonus. If there is no offline income, do not fabricate town events: show the current city goal. Avoid introducing random resident needs that would require a new simulation. Show the same next unlock before exit so tomorrow has a promise.

**Acceptance:** A returning player can understand today's purpose without visiting the Shop, Pass or separate mission pages.

### 5. Make the capital journey feel like one continuous story (medium)

**Files:** `src/data/chapters.ts`, `src/data/ranks.ts`, `src/ui/mayor.ts`, `src/ui/tycoon.ts`, and only if needed `src/render3d/block.ts`.

Keep the six existing Mayor Pip chapters and seven rank thresholds. Present chapters as *why* the city grows and rank changes as *what visibly happens*. At each new rank, briefly focus the camera on the already-implemented market/tram/billboards/airships/skyline/capital landmark; add a short Pip line linking the transformation to residents. Do **not** create a second rank ladder or a resident happiness stat. If a rank effect is not actually implemented, verify and implement that specific promised effect before advertising it.

**Acceptance:** After reaching Village, Town, City, etc., the player can point to something newly visible in the town and knows the next named destination.

## What to hide, demote or remove

- **Demote the Sky Pass, VIP/shop, boosters and crystals** from the first-session city story. Retain them in their existing menus; do not make purchase prompts the answer to “what do I do next?”
- **Hide New Era from primary guidance until it is actionable and understandable.** Explain it as a way to build the *same* Skyhaven faster, not abandon the town. `rankBest` already preserves rank; avoid language implying residents/city are wiped.
- **Demote league, tournaments, Community Spire, postcards, holiday events and multiple daily checklists** to optional side activities. They can be valuable later, but must not share equal visual priority with the City Plan.
- **Don't remove the neighbor, café, terrace, flower market or playground.** They are the best demonstration of the purpose; give them more attention.
- **Don't remove the stacking skill game or the idle economy.** They are complementary: towers provide people and office capacity; businesses fund further growth. Make that relationship explicit.
- **Avoid adding “happiness,” traffic management, dozens of resident requests, another currency or another quest system.** The current code has enough systems. Better framing and feedback will deliver more value per engineering hour.

## Practical shipping order and validation

Ship changes 1 and 2 first, then test the opening 10 minutes with people who have not seen the game. Ask: “What is the main goal? What did your tower change? What are you looking forward to?” Do not explain the answers. If they cannot answer, improve the home/result wording before building features 3–5.

For a week-long retention test, track: first tower completed → neighbor/terrace viewed → next City Plan action used → next-day return → rank transformation viewed. A streak or coin claim alone is not proof that players care about the city.

**Bottom line:** The city should be the reward, not the backdrop to a spreadsheet. Skyhaven already has a beginning (one neighbor), a middle (growing neighborhoods) and an end (Sky Capital). Put that story in front of the player every day.

# Skyrise — Round 5: First-time player confusion audit

**Target:** `claude/skyrise-living-block` · **Review:** source inspection, November 20, 2026 · **Scope:** `index.html`, `src/ui/tycoon.ts`, `src/ui/sheets.ts`, `src/ui/daily.ts`, `src/app.ts`, `src/styles.css`, and relevant `src/data/*.ts`.

**Method:** Read-only audit of the requested base branch. These are proposed explanations, not claims that the UI currently lacks every explanation. CSS issues below are source-based risks, **not confirmed screenshots** of a rendered 390×844 device. The parallel camera/help/menu redesign may change these findings.

## 1. Terms, numbers, icons, and controls needing plain-language explanations

Each explanation is **one sentence, at most 14 words**. Show it on first encounter or beside a question-mark button; do not show all simultaneously.

| Term / icon / button | One-sentence explanation |
|---|---|
| Skyrise | Build tall towers, fill them with people, and grow your sky town. |
| Tap anywhere to build | Tap when the moving floor lines up with the tower below. |
| Classic | Build a tower until you miss, then try to beat your best. |
| Daily | Everyone gets the same special tower to try today. |
| Journey | Finish special tower challenges to unlock the next stage. |
| Zen | Build without worrying about losing your tower. |
| Perfect drop | Land a floor exactly on the floor below it. |
| Perfect streak | Make several perfect drops in a row for a bonus. |
| Wider floors | Wider floors give more people room to live. |
| People / population | This shows how many people your tower can hold. |
| Height / m | This is how tall your tower is in meters. |
| Next landmark | Reach this height to pass a famous real-world landmark. |
| Gold penthouse | A golden floor gives five times the usual reward. |
| 5× | This means five times as much as normal. |
| Wind / gust meter | Wind pushes floors sideways and makes landing harder. |
| Icy floor | This slippery floor makes the next drop trickier. |
| Garden terrace | This special green floor adds a garden to your tower. |
| Rewind | Get another chance after a floor falls. |
| Extra rewind | Save one extra chance for your next Classic tower. |
| Double XP | Earn twice the points toward your builder level. |
| Gold rush | Find golden penthouses more often in your next Classic tower. |
| Boost | A one-time helper that makes your next tower easier or more rewarding. |
| Boost inventory | These are the helpers you have saved for later. |
| Builder level / Lv | Build towers to level up and unlock new things. |
| XP | These points help you reach your next builder level. |
| Level progress bar | Fill this bar to reach your next builder level. |
| Builder title | Your title changes as you reach higher builder levels. |
| Trophy | A trophy remembers something special you achieved. |
| Stars / ★ | Earn stars by playing and spend them on town items or boosts. |
| Sky Crystals / 💎 | Special gems buy extra looks and some town upgrades. |
| Sky Gems | Earn these by starting a New Era to boost future business income. |
| Business cash / $ | Your businesses earn this money for more business upgrades. |
| K / M / B / T | These mean thousand, million, billion, and trillion. |
| Qa / Qi / Sx | These are names for even bigger amounts of money. |
| Skyhaven Inc. | This is the company that runs your town's businesses. |
| Tycoon | Run businesses to earn cash and grow your company. |
| Company | See your businesses, earnings, and ways to improve them. |
| Business | A shop or service that earns money for your company. |
| Business level | Buy levels to make a business earn more money. |
| Office floors | Each tower floor you build adds two office floors to your company. |
| Total office floors | These count your building progress across your towers. |
| Business cycle | This is how long a business takes to earn its next payment. |
| Earnings per second | This estimates how much cash your businesses make each second. |
| Earnings per minute/hour/day | These estimate how much cash your businesses make over time. |
| Collect | Take the reward you have earned. |
| Manager | Hire a manager to run a business automatically. |
| Offline earnings | Managers keep earning cash while you are away. |
| Offline earnings cap | Cash stops building up after the maximum time away. |
| Business milestone | Reaching certain levels makes a business work twice as fast. |
| Stand / Shop / Store | These show how your business changes as it grows. |
| Flagship | Your business has become a much bigger, fancier store. |
| Empire | Your business has grown into its biggest form. |
| Upgrade | Spend cash or another currency to make something better. |
| Buy 1 / Buy 10 / Max | Choose how many business levels to buy at once. |
| HQ / headquarters | Your company headquarters helps you manage your growing town. |
| HQ order | Complete this company task to earn its reward. |
| Town rank | Raise business levels to unlock a bigger, busier town. |
| Hamlet / Village / Town | These are the first sizes your growing town can reach. |
| City / Big City / Metropolis | These are bigger town ranks with new sights to discover. |
| Sky Capital | This is the highest town rank. |
| Town rank progress | Add more business levels to reach the next town rank. |
| Annex / floating island | Unlock this extra island to make all businesses earn more. |
| Town decorations | Add fun sights that also help your businesses earn more. |
| New Era | Start businesses again to earn Sky Gems for permanent income boosts. |
| Era | This is one round of growing your company before starting again. |
| Era reset | Your business progress restarts, but your Sky Gems help future growth. |
| New Era preview | Check what resets and how many Sky Gems you will earn. |
| Construction boom | Make ten perfect drops in a row to start a building bonus. |
| Rush hour | Your businesses earn extra cash for a short time. |
| Festival | A town celebration gives your businesses a temporary bonus. |
| Cash boost | Spend crystals to make businesses earn more for a while. |
| Time warp | Skip waiting and receive some business earnings right away. |
| Speed-up limit | You can only use a few crystal speed-ups each day. |
| Vault | Keep some of your business earnings safe for later. |
| Advisors | Special helpers give your company extra bonuses. |
| VIP | VIP gives extra benefits, including more time to earn while away. |
| Shop | Spend stars or crystals on helpers and new looks. |
| Skin | Change how your tower looks without changing how it plays. |
| Building shape | Choose a different shape for the floors you drop. |
| Island theme | Change the colors and scenery of your floating island. |
| Bundle | Get several matching items together in one purchase. |
| Legendary | This is a rare, special-looking item. |
| Exclusive | This item only comes from a special offer. |
| Premium | This is an optional reward or item bought with Sky Crystals. |
| Best value | This pack gives more crystals for each dollar spent. |
| Starter pack | This is a one-time welcome offer for new players. |
| Restore purchases | Get back paid items you already bought on your account. |
| Restore progress | Bring back your saved game using your recovery method. |
| Daily rewards | Come back on different days to collect more gifts. |
| Claim | Tap here to take a reward you have unlocked. |
| Streak / 🔥 | Play on consecutive days to grow your streak. |
| Streak freeze | This saves your streak if you miss a day. |
| Missions | Finish these small goals to earn stars and other rewards. |
| Daily chest | Finish today's missions to open a bonus reward. |
| Weekly league | Build towers this week to climb into a higher league. |
| Bronze / Silver / Gold league | These are steps on the weekly league ladder. |
| Diamond / Legend league | These are the highest weekly league groups. |
| Leaderboard | Compare your scores with other builders. |
| Rank / # | This number shows your place on a leaderboard. |
| Sky Pass | Play to earn rewards along a monthly prize track. |
| Pass XP | Earn these points to unlock more Sky Pass rewards. |
| Pass tier | Each step on the Sky Pass gives a new reward. |
| Free track | Everyone can earn these Sky Pass rewards by playing. |
| Premium track | Spend Sky Crystals to unlock extra rewards this month. |
| Season | This month's Sky Pass has its own theme and prizes. |
| Season ends in | This timer shows when the current rewards change. |
| Weekly event | A different special rule changes tower-building each week. |
| Golden Week | Golden penthouses appear twice as often this week. |
| Ice Age | Slippery ice floors appear earlier and more often this week. |
| Calm Skies | Wind will not bother your towers this week. |
| Builder's Week | Towers give you extra builder XP this week. |
| Garden Week | Garden terraces appear more often this week. |
| City / town view | Explore the floating town that grows as you play. |
| Build | Start a new tower to add floors and grow your company. |
| Goals | See what to do next and which rewards you can earn. |
| Me | See your builder profile, levels, and personal rewards. |
| Scrapbook | Look back at the special things your town has unlocked. |
| Drag the town | Slide one finger to look around your town. |
| Pinch to zoom | Move two fingers apart or together to change your view. |
| Back home | Return to your own town after visiting another. |
| Place / Done | Choose where to put something, then tap Done to finish. |
| Skip | Skip this explanation and continue playing. |
| Pause / ‖ | Stop the current tower until you are ready again. |
| Settings / ⚙ | Change game options and find help. |
| New dot / red dot | There is something new to check in this menu. |
| Locked item | Keep playing to meet the requirement and open this item. |
| 25 m / 50 m requirement | Build a tower this tall to unlock the item. |
| 10 / 25 / 50 business levels | Reach this many levels to earn a faster business. |
| 8-hour offline limit | Your businesses save at most eight hours of earnings without VIP. |
| 24-hour VIP offline limit | VIP lets managers save up to twenty-four hours of earnings. |
| 250 XP per pass tier | Earn 250 Pass XP to reach the next prize step. |
| 30 pass tiers | There are thirty prize steps in each month's Sky Pass. |
| 500-crystal premium pass | Spend 500 Sky Crystals to unlock this month's extra prizes. |
| 3 speed-ups per day | You can use three crystal time helpers each day. |
| 10-drop boom | Ten perfect drops in a row start a construction boom. |
| +10% town rank bonus | Each new town rank makes your businesses earn ten percent more. |
| +2% per Sky Gem | Every Sky Gem makes all future business earnings two percent higher. |
| +3% decoration bonus | Each town decoration makes all businesses earn three percent more. |
| +15% city building rent | Each new city building raises your star rent by fifteen percent. |
| 12-hour rent cap | Collect your stars before twelve hours of rent piles up. |

**Important accuracy caveat:** Terms such as *HQ*, *vault*, *advisors*, *rush hour*, *scrapbook*, and town gestures must be checked against the evolving UI before attaching exact trigger locations; the underlying features or labels may be changing in Claude's parallel work. Do not imply Sky Gems and Sky Crystals are interchangeable. The data source describes premium cosmetics as visual-only, while town decorations also boost business income; the shop should distinguish those effects.

## 2. Ten first-encounter tips, in player order

1. **First launch / play button:** “Tap when the moving floor is above your tower.”
2. **First successful floor:** “A wider landing leaves room for more people.”
3. **First near-perfect landing:** “Line floors up exactly to start a perfect streak.”
4. **First special floor:** “Gold floors give bigger rewards; watch for their color.”
5. **First missed floor:** “Missing makes your tower narrower; try timing the next drop.”
6. **First finished tower:** “Every tower helps you level up and grow your town.”
7. **First home reward:** “Stars buy building extras; Sky Crystals are a different currency.”
8. **First town visit:** “Drag to explore your town; pinch with two fingers to zoom.”
9. **First business/company visit:** “Your towers add office floors; businesses earn cash for upgrades.”
10. **First manager or New Era unlock:** “Managers earn while you're away; New Eras restart businesses for lasting Sky Gems.”

**Delivery rules:** Anchor each tip to the relevant control or event, allow one-tap dismissal, never cover the moving floor, show each tip once per save, and offer replay from Help. Delay tip 10 until its actual unlock rather than showing both systems at once.

## 3. 390×844 mobile layout audit (source-based, not screenshot-verified)

| Priority | Evidence / area | Risk at 390×844 | Suggested fix or verification |
|---|---|---|---|
| High | `index.html` viewport sets `maximum-scale=1, user-scalable=no` | Blocks normal browser pinch-zoom for text; game-camera zoom may not replace accessibility zoom. | Remove viewport zoom restrictions where possible; constrain game gestures to the town canvas. |
| High | `#tycity` top wallet, gems, optional goal and events | Two-row header plus event and coaching overlays may crowd the upper ~150px. | Test all three states together, including long translated labels and a notched phone. |
| High | `.tcy-next` and `.tcy-card` both anchored `bottom: safe-area + 104px` | Action prompt and selected-business card can occupy the same vertical band. | Give these states mutually exclusive visibility or use one shared bottom slot. |
| High | `.block-skip` anchored `bottom: safe-area + 196px` | Tutorial Skip may overlap the card, floating action, or scene hotspot. | Position Skip within its tutorial overlay rather than by fixed screen offset. |
| High | `.tcy-bar` has repeated 3-column, 5-column, and variable `--tabs` grid rules with `!important` | Later rules can silently override intended navigation width and spacing. | Consolidate into one current navigation rule and verify all unlocked tab counts. |
| Medium | `body.tabs-open .modal.tab-page` has fixed top and bottom padding | On 844px height, tab-page content gets substantially less vertical room. | Keep the tab content scrollable and check that final buttons remain reachable. |
| Medium | `.tcy-wallet em`, `.tcy-goal b`, `.tab-seg button` use ellipsis | Essential income, objective, and tab names can be cut off without explanation. | Keep numbers readable; show full label on tap and test larger text. |
| Medium | `.tcy-goal small` uses 9px display font; other labels use 10–11px | Small decorative text is difficult to read on a phone. | Target ~12–14px for informative labels and larger touch targets. |
| Medium | `body.tabs-open #tycoon .room-sign b` uses `max-width: calc(100vw - 260px)` | At 390px, names get only ~130px before truncation. | Use flexible layout and a second line for the full business name. |
| Medium | Home `.menu-bottom` width min(400px,100%) with several optional chips | Rewards, modes, play CTA, restore/install and dock can compete vertically. | Test maximum-unlocked home, short viewport, keyboard, and long locale. |
| Medium | `#tcy-bar` fixed icon and label sizing | Five bottom actions at 390px may crowd touch areas and text. | Verify each tap area is at least 44×44px and labels are not clipped. |
| Medium | Multiple `[hidden]` states and `!important` display overrides | Newly unlocked or hidden controls may leave odd gaps or appear unexpectedly. | Test first install, each feature unlock, and returning-player states. |

**Specific manual test matrix:** 390×844 CSS pixels; safe-area top/bottom; browser address bar expanded/collapsed; fresh save; first business; all five tabs; active tutorial; selected business; goal and event active together; long numbers (`$1.23Qa`); large text; keyboard open; landscape. These are checks to run, **not tests claimed completed**.

## 4. Top five improvements, simplest first

1. **One consistent currency legend.** A tiny tappable legend for ★ Stars, 💎 Sky Crystals, $ cash, and Sky Gems prevents the most expensive misunderstanding.
2. **Replace ambiguous numbers with units.** Show `$ / sec`, `business levels`, `office floors`, `m`, and `XP` beside the values; never rely on icon color alone.
3. **Put a “Why?” beside locked or costly actions.** Explain the requirement, exact reward, and whether a purchase resets anything before the player commits.
4. **One guided first town loop.** Lead the player through build tower → earn office floors → open business → upgrade → collect income → return to town, with an obvious Next action.
5. **A persistent “What changed?” scrapbook.** Record town-rank changes, new businesses, unlocked scenery, and completed landmarks with before/after pictures and a Replay Help link.

## 5. Implementation priorities and handoff

**P0:** Currency distinction, office-floors versus business-levels, New Era reset preview, manager/offline income explanation, and overlapping fixed-position town controls.

**P1:** First-encounter tips, units on all numbers, unlocked-item explanations, larger small text, and full labels for truncated objectives.

**P2:** Contextual glossary, scrapbook history, and consolidated CSS.

**Source grounding:** `src/data/tycoon.ts` defines business cycles, levels, managers, gem bonuses, speed-up limits, and number suffixes; `src/data/ranks.ts` defines town-rank thresholds and earnings bonuses; `src/data/daily.ts` defines rent and leagues; `src/data/pass.ts` defines monthly 30-tier rewards; `src/data/premium.ts` defines crystals and VIP pack extras; `src/data/decor.ts` defines decoration income bonuses; `src/data/challenges.ts` defines Journey stages; `src/data/shop.ts` defines Classic boosts. The UI paths and stylesheet were reviewed for exposed terminology and positioning. This is a static source audit, not an instrumented gameplay session.

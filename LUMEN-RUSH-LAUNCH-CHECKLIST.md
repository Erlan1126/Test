# Lumen Rush launch quality bar

Lumen Rush ships only when every line below is **PASS**. Feature freeze is on: until launch, changes are fixes and polish only, with no new modes, stages or content.

Status as of 0.13.0 (2026-11-28). **PASS** = checked and good. **FAIL** = must be fixed before launch. **TODO** = not checked yet, and someone has to do it (the owner is named).

## 1. It doesn't break

| # | Check | How it's checked | Status |
|---|---|---|---|
| 1.1 | Automated suite is green | `npm test`: 175 checks covering the swing, all stages, every screen and crash reporting | PASS |
| 1.2 | No errors in the console on any screen | Strict QA walk of 47 screens at 360×640 and 430×932 (first launch, opening, tutorial, clear and fail cards, chapter card, pause, every sheet, Today, Settings, boss, Night shift, Keep going, run over, Free swing, Boss rush, daily, stage 60, Dawn, privacy page) | PASS |
| 1.3 | Random input doesn't break it | Fuzz run: random taps, holds, swipes, pause, quit, restart and leaving the app, on every mode | PASS (0 errors) |
| 1.4 | Leaving mid-run (call, home button, tab switch) | Pauses and keeps hold of the light; sound sleeps in the background and wakes on return | PASS |
| 1.5 | Quick restart or quit right after a stage ends | Old end cards can't appear over a new run (guarded timeouts) | PASS |
| 1.6 | A stage is beatable by an average player | Simulated players on all 60 stages: first-try clears 84% (average reactions), 45% (slow reactions) | PASS |
| 1.7 | 60 fps on a real mid-range phone | Headless: 60 fps unthrottled, game logic under 1 ms a frame. A real phone has not been checked | TODO: human testers, one older Android and one iPhone, with Settings > Show FPS on |
| 1.8 | Works offline after the first visit | The service worker caches every game file (`sw.js` CORE list includes `echo/diag.js`) | PASS |
| 1.9 | Old saves load | Tests load saves from earlier versions | PASS |

## 2. When something does break, we find out

| # | Check | Status |
|---|---|---|
| 2.1 | Errors are reported automatically: `echo/diag.js` sends to the studio's own report server (the `/diag` endpoint Skyrise and Buildaroo use). No new account is needed. Lumen Rush's reports have `v` = `lumen <version>` | PASS |
| 2.2 | A crash in a frame doesn't freeze the game: it is reported and the next frame carries on (tested) | PASS |
| 2.3 | Each different error is sent once a session (at most 20 a session). Nothing is sent when nothing goes wrong, or when Settings > Send crash reports is off (tested) | PASS |
| 2.4 | Testers can tap Settings > About > **Copy error report** and paste the errors into a message | PASS |
| 2.5 | Someone reads the reports: run the **Diagnostics** GitHub workflow daily in launch week, filtered to `lumen` | TODO: studio |
| 2.6 | Optional: Sentry. Paste a DSN into `SENTRY_DSN` in `echo/diag.js` to also get alerts and grouping. This takes one free Sentry account. Reports already work without it | Optional |

## 3. It looks and sounds like one game

| # | Check | Status |
|---|---|---|
| 3.1 | One typeface: Inter, self-hosted, everywhere including canvas text and the Night shift share card (the share card used to mix in system fonts and Georgia) | PASS |
| 3.2 | One icon style: line icons with a 1.7 stroke. Emoji are gone from menus: the shop's upgrade icons and the lock on locked tiles used to look different on every phone. In-game glyphs (✦ ★) are drawn in Inter | PASS |
| 3.3 | Corners, glass panels, buttons and the tab bar use the shared tokens (`--glass`, `--edge`, the radii of `.primary` and `.card2`) | PASS |
| 3.4 | Animation timing is consistent: screens 0.35 s, sheets 0.32 s, cards 0.38 s on the same ease-out curve, presses 0.12 s. Reduce motion turns off shakes, flashes and pulses | PASS |
| 3.5 | Sound levels are measured, not guessed: every sound was rendered offline and its loudness measured. The hit sound was 8 dB louder than everything else and is now 3.5 dB quieter. Perfect was quieter than a coin and is now +2.5 dB. The let-go whoosh used to sit hard in the right ear on every release (it took the speed as a pan value); it is now centred and fuller the faster you fly | PASS |
| 3.6 | No sound before the first touch (browsers block it, and the warning showed in the console) | PASS |
| 3.7 | Writing style: British spelling throughout (harbour, neighbour, metres, colour), sentence case, no stray capitals, non-breaking spaces so numbers never split from their units ("43.2 s") | PASS |
| 3.8 | Text fits at 360 px wide: no clipped tile text, no orphaned units, and the name label stays on screen | PASS |

## 4. Store and legal

| # | Check | Status |
|---|---|---|
| 4.1 | Privacy policy (`lumen-rush-privacy.html`) describes crash reports. Effective date 2026-11-28 | PASS |
| 4.2 | In-game About text matches the policy | PASS |
| 4.3 | Store privacy answers (`store/RATINGS-AND-PRIVACY.md`, PR #33): Lumen Rush's rows still say "Data Not Collected". Change them to Apple: **Diagnostics > Crash Data**, not linked to the user, not used for tracking. Google: **App info and performance > Crash logs and Diagnostics**, collected, not shared, optional (can be turned off), not linked | FAIL: update PR #33 before submitting |
| 4.4 | Age rating answers in PR #33 unchanged by crash reports (no ads, no purchases, no chat) | PASS |
| 4.5 | Support email works: support@bigbrucestudios.com | TODO: studio, send a test email |

## 5. Real people

| # | Check | Status |
|---|---|---|
| 5.1 | 5 or more human testers play the first 10 stages cold, with no help. Watch for where they get stuck or quit | TODO: owner (in progress) |
| 5.2 | Testers send "Copy error report" output if anything looks wrong | TODO: owner |
| 5.3 | Every tester issue is logged, fixed or consciously accepted, and this list is re-run | TODO |

## Release steps (each release)

1. Bump `GAME_VERSION` in `echo/core.js` and `CACHE` in `sw.js`. Add any new `echo/*.js` file to `sw.js` CORE.
2. Run `npm test` and confirm it is green.
3. Do the QA walk at 360×640 and 430×932 and look at every screen.
4. Re-check this list; everything is PASS.
5. Merge. GitHub Pages publishes it.
6. In launch week, run the Diagnostics workflow daily and fix anything new first.

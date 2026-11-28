# Buildaroo launch quality bar

Buildaroo ships only when every line below passes. It follows the same sections as Skyrise's
bar (`docs/LAUNCH-QUALITY-BAR.md`), with the city game's own checks. Each line says how it
is checked: **Auto** lines run from the repo (`npm test`, `npm run typecheck` or a script),
**Manual** lines need a person or a real phone. The scorecard at the bottom is the latest
result.

Until launch Buildaroo is in a **feature freeze**: no new districts, modes or content. Only
fixes, polish and the items on this list.

## 1. Stability
- [ ] **No script errors** opening every screen and sheet, and in a full first session.
      (Auto: `scripts/qa-city-screens.cjs` and the first-session walk record every page
      error. Manual: TestFlight and the Play pre-launch report show no crashes.)
- [ ] **Errors are reported** from players' phones, tagged as Buildaroo, with the screen that
      was open: our own server (`/diag`) and, once a DSN is set, Sentry. (Shared code with
      Skyrise: `src/diag.ts`.)
- [ ] **Saves survive** an app kill, an update and a reinstall with the recovery code.
      (Auto: save tests. Manual: kill the app while a build is running.)
- [ ] Offline play works; online features (friends' cities, gifts, leaderboard) fail quietly.

## 2. Performance
- [ ] Smooth town (no visible stutter) on an iPhone 11 / Galaxy A53 class phone with every
      district bought. (Manual on a phone.)
- [ ] Cold start to the town in under 3 s on those phones. (Manual.)
- [ ] Battery saver and Smooth graphics keep older phones usable. (Manual.)

## 3. Screens and text
- [ ] **Every screen at 320, 375 and 430 px wide**: nothing cut off, nothing past the edge of
      the screen, no buttons on top of each other, no "undefined", "NaN" or `{placeholders}`.
      (Auto: `scripts/qa-city-screens.cjs`, which also saves a screenshot of every screen to
      look through.)
- [ ] The same in the longest language (German). (Auto: the same script with `GAME_LANG=de`.)
- [ ] Every line translated (es, pt, fr, de). (Auto: `tests/i18n.test.ts`.)
- [ ] No typos; one spelling (US English: neighbor, color); one name for each thing.
      (Auto: `codespell src index.html`. Manual: read through the screenshots.)
- [ ] Hints never contradict the game (for example, never "save for" something already paid).
      (Auto: city playtest tests. Manual: long-session walk.)
- [ ] Safe areas respected (notch, Dynamic Island, home bar). (Manual on a phone.)

## 4. Look, feel and sound
- [ ] One display font for titles and buttons, one body font; every primary button uses the
      shared button style.
- [ ] Animations use a few matching lengths (0.2 to 0.5 s for sheets and pop-ups); nothing
      flies over an open sheet or flickers.
- [ ] Sounds at matching levels, loudest for the biggest moments; nothing too quiet to hear.
      (Auto: render every sound offline and compare levels.)
- [ ] Every button has a pressed state, a sound and, when on, a light haptic.

## 5. Fairness and first session
- [ ] First five minutes: first sale, café terrace, first upgrade, first manager, second
      business, with no crystal shop popping up and no waiting with nothing to do.
      (Auto: `tests/first-session.test.ts`. Manual: a new player plays it.)
- [ ] No dead ends or long quiet stretches: City Hall climbs steadily over 35 days of
      simulated play. (Auto: `tests/city-playtest.test.ts`.)
- [ ] Nothing asks for crystals the player can't have earned by then.

## 6. Accessibility
- [ ] Bigger text, one-handed mode and still motion work. (Auto: save tests. Manual.)
- [ ] Reduced motion respected (the phone's setting and the game's own).
- [ ] Tap targets: buttons at least 44 pt where possible, never under 32 px.
      (Auto: the screen script flags anything under 28 px.)

## 7. Store and legal
- [ ] Store listing, screenshots, privacy answers and age rating match the build.
- [ ] Privacy policy (English and Spanish) says what error reports and statistics contain,
      and is linked from Settings.
- [ ] Publisher is Big Bruce Studios everywhere; app id `com.bigbrucestudios.buildaroo`.

## How to check
- `npm test` and `npm run typecheck`.
- `npm run build:city`, serve `dist/` on port 8765, then
  `SAVE=<a save JSON> SIZES=320x568,375x667,430x932 node scripts/qa-city-screens.cjs`
  (add `GAME_LANG=de` for German). Screenshots and `report-<width>.json` go to `qa-out/`.
- `codespell src index.html --skip="src/i18n/*"`.
- `CITY_SIM=1 CITY_DAYS=35 npx vitest run tests/city-playtest.test.ts` prints the 35-day
  timeline.

## Scorecard: Buildaroo, 28 November 2026 (PR #30)
Checked in headless Chromium at 320×568 (iPhone SE 1st gen), 375×667 (iPhone SE) and 430×932
(iPhone Pro Max): 28 screens, sheets and tabs each, three full passes, plus German at 320 and
375, a brand-new player's first 7 minutes at 320, and 4 minutes of a late-game save.
19 problems found and fixed in this pass (PR #30, "Launch QA" commits).

| Line | Result | Notes |
|---|---|---|
| No script errors | **Pass** (in browser) | None in any sweep or walk (only Chrome's "vibrate blocked" notice). Needs the same on TestFlight. |
| Errors reported, tagged Buildaroo | **Pass once PR #29 merges** | Shared `src/diag.ts` from Skyrise's PR #29: game tag, open screen, kept until sent. Sentry once a DSN is set. |
| Saves survive kill, update, reinstall | **Pass** (tests) | Save and recovery tests pass; killing the app mid-build still to try on a phone. |
| Offline play | **Not yet checked** | Try in airplane mode on a phone. |
| Smooth town, cold start, battery saver | **Not yet checked** | Needs a real phone. |
| Every screen at 3 sizes | **Pass** | Fixed: Build sheet prices cut off, Company buy buttons, big crystal packs, district Build button, savings card, card title "COFF / EE…". |
| German | **Pass** | Fixed: Boosts New Era, Earnings Hire, Team Hire, Upgrades buttons at 320 px. |
| Every line translated | **Pass** | `tests/i18n.test.ts`. |
| Typos, one spelling | **Pass** | codespell clean; switched to US spelling (neighbor, color, colorful, grayed). |
| Hints never contradict the game | **Pass** | Fixed: the goal said "Save $567B" right after paying for a district. |
| Safe areas | **Not yet checked** | Needs a phone with a notch / Dynamic Island. |
| One display font, shared button style | **Pass** | Fixed: the district Build button used the body font. |
| Animations, nothing over open sheets | **Pass** | Sheets and pop-ups 0.2 to 0.5 s. Fixed: coins flew out from behind open menus. Advent footer no longer says "All 24 doors are open" before December. |
| Sound levels | **Pass** | Rendered offline: UI clicks about −50 dB, buys and coins −38, rewards −27 to −30, big moments −24 to −26. The hurry tap was −58 (too quiet), now louder. |
| Pressed state, sound, haptic on every button | **Partly** | Main buttons yes; not every small chip has a sound. |
| First five minutes | **Pass** | Test and 320 px walk: first sale, terrace (free finish), level, manager, next project; no crystal shop. |
| No dead ends | **Pass** | 35-day sim: City Hall 10 around day 19, longest quiet stretch about 20 minutes. |
| No crystal asks the player can't afford | **Pass** | Welcome back: without the crystals, Collect is the main button and Double it a quiet extra. |
| Bigger text, one-handed, still motion | **Pass** | Tests and earlier screenshots. |
| Tap targets | **Partly** | Chips now at least 32 px. The labels floating over the town (For sale, Upgrade) are 25 px tall; they work as taps but are small. |
| Store listing matches the build | **Not yet checked** | Retake screenshots from the final build. |
| Privacy policy | **Pass** | English and Spanish describe error reports and Sentry; linked from Settings. |
| Publisher and app id | **Pass** | `com.bigbrucestudios.buildaroo` in Capacitor and Codemagic. |

**Still needed before launch:** the "Not yet checked" lines need a real phone or TestFlight
(human testers), and PR #29 must merge for error reporting.

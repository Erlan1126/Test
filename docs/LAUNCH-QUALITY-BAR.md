# Launch quality bar

Skyrise (then Buildaroo) ships only when every line below passes. Each line says how it is
checked. "Auto" lines are checked by `npm test`, `npm run typecheck` or a script in the repo;
"Manual" lines need a person or a device. The latest scorecard is at the bottom.

## 1. Stability
- [ ] **Zero crashes and zero script errors** in a full session: launch, tutorial, 10 towers,
      every sheet and tab, settings, shop, share, back to menu. (Auto: headless sweep with an
      error listener. Manual: TestFlight / Play pre-launch report shows no crashes.)
- [ ] **Errors are reported** from players' phones: our own server (`/diag`, read with the
      "Diagnostics" workflow) and, once a DSN is set, Sentry. (Auto: `tests/diag.test.ts`.)
- [ ] **Saves survive** an app kill mid-tower, an update, and a reinstall with the recovery
      code. (Auto: save tests. Manual: kill the app during a tower on a phone.)
- [ ] Offline play works; online features fail quietly with a clear message.

## 2. Performance
- [ ] **Steady 60 fps** while building on a mid-range phone (iPhone 11 / Galaxy A53 class);
      no frame over 50 ms after the first tower. (Manual on device; the game reports its own
      fps per tower to `/diag`.)
- [ ] Cold start to the home screen in under 3 s on those phones.
- [ ] No hitch when a landmark, sky layer or banner appears.

## 3. Screens and text
- [ ] **Every screen reviewed** at iPhone SE (375×667) and iPhone Pro Max (430×932), in every
      language: no cut-off, overlapping or overflowing text, no sideways scrolling.
- [ ] No leftover words from the other game (Skyhaven, Pip, business, café, coins in Skyrise).
      (Auto: `tests/skyrise-story.test.ts` and the headless sweep.)
- [ ] Every line translated (es, pt, fr, de). (Auto: i18n test.)
- [ ] No typos, consistent capitalisation and punctuation, one name for each thing.
- [ ] Safe areas respected (notch, Dynamic Island, home bar).

## 4. Look, feel and sound
- [ ] One display font and one body font; icons from one set; one corner radius and spacing
      scale for cards, buttons and chips.
- [ ] Animations use the same few durations and easings; nothing flickers or pops.
- [ ] Sounds at matching levels; none clips; music ducks under big moments.
- [ ] Every button has a pressed state, a sound and (when on) a light haptic.

## 5. Fairness and onboarding
- [ ] First tower: a new player is taught to drop, sees a perfect drop, and has a goal.
- [ ] No difficulty cliffs for new players. (Auto: `tests/playtest.test.ts`, `npm run playtest`.)
- [ ] No dead ends: something to do after every screen.

## 6. Accessibility
- [ ] Colorblind-friendly special floors, larger text and one-handed play work.
      (Auto: `tests/access.test.ts`.)
- [ ] Buttons have labels for screen readers; touch targets at least 44 pt.
- [ ] Reduced motion respected.

## 7. Store and legal
- [ ] Store listing, screenshots, privacy answers and age rating match the build.
- [ ] Privacy policy and terms reachable from Settings; what is collected is stated.
- [ ] Publisher is Big Bruce Studios everywhere; app ids `com.bigbrucestudios.*`.

## How to check
- `npm test` (330 tests) and `npm run typecheck`.
- `scripts/qa-screens.cjs`: every screen and sheet tab at one size and language, with
  screenshots and a list of cut-off text, sideways scrolling, overlapping buttons, small touch
  targets and script errors.
- `scripts/qa-first-session.cjs`: a brand-new player's launch, tutorial, miss, rewind offer,
  first results and trip home.
- `scripts/qa-sound-levels.cjs`: renders every sound offline and prints its levels.
- `npm run playtest`: bot players of four skills, for difficulty.

## Scorecard: Skyrise, 28 November 2026 (PR #29)
Checked in headless Chromium at iPhone SE (375×667) and iPhone Pro Max (430×932) sizes, in
English, Spanish, French, German and Portuguese: 42 screens and tabs each, plus the first
session. 13 problems found and fixed in this pass (see PR #29, section 18).

| Line | Result | Notes |
|---|---|---|
| Zero crashes and script errors | **Pass** (in browser) | No errors in 8 full sweeps and the first-session run. Needs the same on TestFlight builds. |
| Errors reported | **Pass** | Own server always; Sentry once a DSN is pasted in `src/data/server.ts`. |
| Saves survive kill, update, reinstall | **Pass** (tests) | Save and recovery tests pass; kill-during-tower still to try on a phone. |
| Offline play | **Pass** | Online features hide or say they can't connect. |
| Steady 60 fps on mid-range phones | **Not yet checked** | Needs a real phone. Each tower reports its fps to `/diag`; read it with the Diagnostics workflow after TestFlight play. |
| Cold start under 3 s | **Not yet checked** | Needs a real phone. |
| No hitch on landmark, layer, banner | **Not yet checked** | Needs a real phone. |
| Every screen reviewed, no cut-off text | **Pass** | Last sweeps: nothing cut off in any of the 5 languages at either size. |
| No leftover words from the other game | **Pass** | Tests and sweep. |
| Every line translated | **Pass** | i18n test. |
| No typos, consistent naming | **Pass** (reviewed) | Read through every English screen in the sweep screenshots. |
| Safe areas | **Not yet checked** | Needs a notched iPhone or the simulator. |
| One font set, one icon set | **Pass** | Bungee, Lilita One and the UI font; every emoji now drawn as the game's own icon. |
| Animations consistent | **Partly** | No flicker found in the sweeps. Durations vary from screen to screen; left as they are, since changing them now risks new glitches. |
| Sound levels matched, no clipping | **Pass** | Every sound peaks below -13 dB; celebrations near -29 dB RMS, landings near -35 dB, interface clicks lower. |
| Buttons: pressed state, sound, haptic | **Pass** | Shared button styles and handler. |
| First tower teaches, shows a perfect, gives a goal | **Pass** | First-session run. |
| No difficulty cliffs | **Pass** | `tests/playtest.test.ts`. |
| No dead ends | **Pass** | Every screen in the sweep has a way back. |
| Accessibility settings | **Pass** | `tests/access.test.ts`. |
| Labels and 44 pt touch targets | **Partly** | Sweep found no small icon buttons; a screen-reader pass (VoiceOver) still needs a phone. |
| Reduced motion | **Pass** | The game reads the phone's setting. |
| Store listing matches build | **Not yet checked** | Screenshots should be retaken after this pass. |
| Privacy and terms reachable | **Not yet** | Not on this branch: the Settings legal group (privacy, terms, support, restore purchases) comes with Buildaroo's PR #30. The privacy policy should also mention the anonymous error reports (and Sentry, if turned on). |
| Big Bruce Studios everywhere | **Partly** | App ids done. Challenge links still use the `erlanstudios.workers.dev` server address until a Big Bruce Studios address is added in Cloudflare. |

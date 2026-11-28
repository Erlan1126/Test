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

## Scorecard
(Filled in at each QA pass.)

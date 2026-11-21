# ChatGPT Round 4 — Store positioning

## Built
Selected option 3 (store text), deliberately isolated from Claude's simultaneous UI and annex work.

- Updated the English App Store description, subtitle and promotional text in `launch/stores/app-store.md`.
- Updated the Google Play short description and kept its full description linked to the App Store English description in `launch/stores/google-play.md`.
- Added five coordinated English screenshot captions to both store guides. Existing screenshot PNG assets were **not** modified; artwork must be regenerated separately before submission.
- Preserved purchase IDs, prices, privacy disclosures, platform instructions and existing Spanish store localization. The Spanish store copy remains older positioning and should be refreshed before a Spanish-language release.
- No runtime strings, `src/i18n` files, save data, game logic or UI were changed. No new in-app translations are required.

## Top five next improvements (simplest first)
1. **Unify store screenshots with the new promise.** Regenerate the first five screenshot overlays with these captions, showing real in-game states; verify the images match the current build.
2. **Show one specific next town unlock.** The goal bar should say what the next rank adds (e.g. a tram stop) rather than only showing a level count.
3. **Celebrate permanent changes on camera.** Briefly focus on the new building or annex when it unlocks, with Skip and reduced-motion support.
4. **Add a town scrapbook.** Seven simple rank postcards, unlocked once per rank, with a first-reached date and safe defaults for older saves.
5. **Offer one small resident choice per rank.** Save a benches-or-flowers decision and show a tiny persistent prop; no branching narrative or new currency.

## Validation
Documentation-only change: TypeScript, runtime i18n and unit tests should be unaffected. Full `npx tsc --noEmit -p .` and `npx vitest run` were not executable through the GitHub connector in this session; run CI before merging.

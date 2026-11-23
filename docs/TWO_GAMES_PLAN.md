# Plan: two games from one codebase

Today one app holds two games: **Skyrise** (tap to drop floors and stack a tower) and the
**city tycoon** (46 businesses, districts, a City Plan story). They pull new players in two
directions. The plan: two apps that share one codebase.

## The two apps
| | Skyrise | City (working name: Skyhaven City) |
|---|---|---|
| Kind | Arcade, one-thumb, 1–3 minute runs | Idle tycoon / city builder, long-term goals |
| Core loop | Stack floors, chase height and perfect streaks | Open businesses, grow the city block by block, buy districts |
| Progress | Skins, shapes, landmarks, Sky Pass, rankings | City Plan chapters, ranks, districts, New Era |
| Money | Skins/crystal packs, Starter Pack, VIP, rewarded ads | Crystal packs, boosts, VIP, rewarded ads |
| Tower stacking | The whole game | A mini-game: building a business's HQ floors |

## How (one repo, two builds)
1. **Shared core** stays where it is: renderer, kit models, sound, i18n, save tools, store/IAP layer.
2. **Two entry points:** `src/main-skyrise.ts` and `src/main-city.ts`, picked by a build flag
   (`vite build --mode skyrise|city`). Each app's home screen and menus show only its own features.
3. **Two app IDs** in the Capacitor configs, two Codemagic workflows, two store listings, two icon sets.
4. **Saves:** each app keeps its own save key. Existing players keep both halves: on first launch,
   each app reads the old shared save once and takes its own part.
5. **Purchases:** split the product IDs per app. Things already bought stay in the app they belong to
   (skins in Skyrise; city boosts and city crystal packs in the city game).

## Order
1. Finish the city polish now in progress (look, feel, first five minutes).
2. Release **Skyrise** first: it is the closer of the two to finished. Hide the city behind the build flag.
3. Turn the city into its own app: a new home screen, tutorial, icon, store page, and the
   tower mini-game for HQs.
4. Cross-promote: each app shows a card for the other.

## Decisions needed from the studio
- The city game's name and icon.
- Whether existing players' crystals carry into both apps or stay in one.
- Which app keeps the current store listing (the other is new).

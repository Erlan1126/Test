# Store listings: Buildaroo, Skyrise and Lumen Rush

Everything the App Store and Google Play ask for, per game, ready to paste and upload. Made
2026-11-26 from the code (Buildaroo and Skyrise on `claude/skyrise-living-block` with PRs
#29 and #30; Lumen Rush on `main` with PR #28).

| | Buildaroo | Skyrise | Lumen Rush |
|---|---|---|---|
| Listing (name, subtitle, descriptions, keywords, what's new, review notes, products) | [buildaroo/LISTING.md](buildaroo/LISTING.md) | [skyrise/LISTING.md](skyrise/LISTING.md) | [lumen-rush/LISTING.md](lumen-rush/LISTING.md) |
| Languages | en, es-MX, pt-BR, fr, de | en, es-MX, pt-BR, fr, de | en |
| iPhone 6.9" screenshots | 6 × 1290 × 2796 | 6 × 1320 × 2868 | 6 × 1320 × 2868 |
| iPhone 6.3" screenshots | 6 × 1206 × 2622 | 6 × 1206 × 2622 | 6 × 1206 × 2622 |
| Google Play phone screenshots | 6 × 1080 × 1920 | 6 × 1080 × 1920 | 6 × 1080 × 1920 |
| Feature graphic 1024 × 500, icon 512 × 512 | yes | yes (Nov 14 art) | yes |
| Preview video | `preview-886x1920.mp4` | `app-preview-886x1920.mp4` (Nov 27, 23.8 s) | none |
| Expected age rating | 4+ / Everyone / PEGI 3 | 4+ / Everyone / PEGI 3 | 4+ / Everyone / PEGI 3 |
| Privacy label | 4 linked + 4 not-linked types, no tracking | same | 2 not-linked types (crash and diagnostics), no tracking |
| Store name | Buildaroo: City Tycoon | Skyrise: Tower Stack | Lumen Rush (name not final) |

- **Age rating, App Privacy, IARC, Data safety and target audience answers** for all three,
  with the reason for each: [RATINGS-AND-PRIVACY.md](RATINGS-AND-PRIVACY.md).
- **Privacy, support and studio pages** for bigbrucestudios.com, ready to upload to
  Cloudflare Pages: [site/](site/README.md).

## What's still needed before submitting

Things only you can do, or decide:

1. **Put the site online** (10 minutes, steps in [site/README.md](site/README.md)). Both
   stores open the privacy URL during review.
2. **Lumen Rush's store name.** Lumen Rush or Echo? Everything here uses Lumen Rush.
3. **Developer accounts** (Apple $99/year, Google $25), enrolled as Big Bruce Studios LLC.
   See `STORES.md`.

Code work this package found:

4. **Skyrise app ids are settled** (iPhone `com.erlanstudios.skyrise`, the existing App Store
   app; Android `com.bigbrucestudios.skyrise`), and the Skyrise build now asks the App Store for
   its own `skyrise.`-prefixed product ids (`src/data/storeids.ts`, in this PR).
5. **Lumen Rush's phone app** is PR #34 (Capacitor, `com.bigbrucestudios.lumenrush`).
6. **Skyrise preview video** was re-recorded on November 27 from the current build (Zephyr,
   Cloudreach and all five sky layers).

## Changes from the earlier drafts in `launch/stores/`

- Buildaroo's App Privacy answers now mark data stored under the player id as **linked**
  (Apple counts a game-assigned id as identifying), and add Gameplay Content and Purchase
  History, which the cloud backup stores. The old "not linked" answers would have been an
  under-declaration.
- The Skyrise listing no longer describes the old businesses, advisors or cash boosts,
  which PR #29 removed from Skyrise. Its old files (`app-store.md`, `google-play.md`,
  `google-play-es.md` and the screenshot folders) are replaced by `store/skyrise/`.
- The age rating answers follow Apple's current questionnaire (In-App Controls,
  Capabilities, Chance-Based Activities and the 2026 Social Media question).
- Buildaroo's files moved from `launch/stores/buildaroo/` to `store/buildaroo/`.

# Skyrise: Google Play Console

Copy each part into the matching field in the Play Console (play.google.com/console).

## Create app

| Field | Value |
|---|---|
| App name | Skyrise: Tower Stack (30 max) |
| Default language | English (United States) |
| App or game | **Game** |
| Free or paid | **Free** |

The package name is set by the first upload: **com.erlanstudios.skyrise**. It can never be
changed after that.

## Store listing (Grow → Store presence → Main store listing)

**Short description** (80 max):

> Stack floors, nail perfect drops and build past real landmarks. One tap to play.

**Full description:** use the description in `app-store.md` (the same text works here).

**Graphics:**

- App icon (512 × 512): `../../assets/icon-only.png`, resized. Or use
  `public/icon-512.png` from the game.
- Feature graphic (1024 × 500): `feature-graphic.png`
- Phone screenshots: the five files in `google-play-screenshots/` (1080 × 2160), in order.

**Category:** Game → **Casual**. Tags: Stacking, Building, Arcade, Offline.

**Contact details:** your email (required), plus your itch.io page as the website.

## App content (Policy → App content)

- **Privacy policy:** the public link to your privacy page (see STORES.md, step 0).
- **Ads:** "No, my app does not contain ads."
- **App access:** "All functionality is available without special access."
- **Content rating:** start the questionnaire. Category: **Game**. Answer **No** to
  violence, fear, sexuality, gambling, language, controlled substances, crude humour and
  user interaction. Answer **Yes** to "digital purchases". Expected rating: **Everyone / PEGI 3**.
- **Target audience:** **13–15, 16–17 and 18+**. Picking under-13 groups puts the app
  under the Families policy, which needs extra review. You can add younger ages later.
- **Data safety:** "Does your app collect or share any of the required user data types?"
  → **No**. (Google Play handles purchases. Progress stays on the phone. No analytics.)
  Is all data encrypted in transit? → **Yes**. Account deletion → not applicable (no accounts).
- **Government app:** No. **Financial features:** None. **Health:** None.
- **News app:** No.

## In-app products (Monetize → Products → In-app products)

You can only create these after the first build has been uploaded to a testing track
(Google needs to see the billing permission first). Make each one **active**.

| Product ID | Name | Description | Price |
|---|---|---|---|
| skin_crystal | Crystal Palace | A sparkling tower of ice-blue glass | $1.99 |
| skin_sakura | Sakura Spire | Blossom pink with warm paper lanterns | $1.99 |
| skin_royal | Royal Amethyst | Deep purple stone trimmed in gold | $1.99 |
| skin_cyber | Cyber City | Black glass with glowing neon edges | $2.99 |
| island_volcano | Volcano Island | Black rock, palm trees and glowing lava | $2.99 |
| island_candy | Candy Island | Pastel lawns and cotton-candy trees | $2.99 |
| founders | Founder's Pack | Every premium skin and island, plus 5,000 coins | $7.99 |

Product IDs must match exactly. Set up a **payments profile** (Monetize → Monetization
setup) before you can sell anything.

## Testing before release

New personal developer accounts must run a **closed test with at least 12 testers for
14 days in a row** before they can apply for production. Plan for it:

1. Testing → Closed testing → create a track, upload `skyrise-release.aab`.
2. Add testers by email (a Google Group is easiest) and send them the opt-in link.
3. Ask them to keep the app installed and open it a few times over the two weeks.
4. Then apply for production access (Dashboard), answering the short questionnaire.

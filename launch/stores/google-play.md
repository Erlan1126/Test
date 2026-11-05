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

> Stack floors, nail perfect drops and race the world up the leaderboards.

**Full description:** use the description in `app-store.md` (the same text works here).

**Graphics:**

- App icon (512 × 512): `play-icon-512.png`
- Feature graphic (1024 × 500): `feature-graphic.png`
- Phone screenshots: the six files in `google-play-screenshots/` (1080 × 2160), in order 1 to 6.

**Category:** Game → **Casual**. Tags: Stacking, Building, Arcade, Offline.

**Contact details:** your email (required), plus your itch.io page as the website.

## App content (Policy → App content)

- **Privacy policy:** https://gist.github.com/Erlan1126/264df0444c9e353f3af95cccba90a61d
- **Ads:** "No, my app does not contain ads."
- **App access:** "All functionality is available without special access."
- **Content rating:** start the questionnaire. Category: **Game**. Answer **No** to
  violence, fear, sexuality, gambling, language, controlled substances, crude humour and
  user interaction. Answer **Yes** to "digital purchases". Expected rating: **Everyone / PEGI 3**.
- **Target audience:** **13–15, 16–17 and 18+**. Picking under-13 groups puts the app
  under the Families policy, which needs extra review. You can add younger ages later.
- **Data safety:** "Does your app collect or share any of the required user data types?"
  → **Yes** (only for the worldwide leaderboard). Not shared with anyone. Declare:
  - **Personal info → User IDs** (a random player id the game makes)
  - **Personal info → Name** (the optional leaderboard nickname)
  - **App activity → Other actions** (scores and the taps of ranked towers, to check them)
  For each: collected **Yes**, shared **No**, processed ephemerally **No**, collection
  **Required** (Classic and Daily towers are posted automatically), purpose **App functionality**. Encrypted in transit → **Yes**. Users can request deletion →
  **Yes** (by emailing erlanstudios1@gmail.com). Google Play handles purchases. No ads or analytics.
- **Government app:** No. **Financial features:** None. **Health:** None.
- **News app:** No.

## In-app products (Monetize → Products → In-app products)

You can only create these after the first build has been uploaded to a testing track
(Google needs to see the billing permission first). Make each one **active**.

These are **consumable** crystal packs (in the current Play Console they're "one-time
products"; leave them as consumable, which is the default for this game's purchase code).

| Product ID | Name | Description | Price |
|---|---|---|---|
| crystals_200 | 200 Sky Crystals | A pouch of Sky Crystals | $1.99 |
| crystals_650 | 650 Sky Crystals | 600 Sky Crystals + 8% bonus | $5.99 |
| crystals_1250 | 1,250 Sky Crystals | 1,100 Sky Crystals + 14% bonus | $10.99 |
| crystals_2600 | 2,600 Sky Crystals | 2,100 Sky Crystals + 24% bonus | $20.99 |
| crystals_8000 | 8,000 Sky Crystals | 6,000 Sky Crystals + 33% bonus | $59.99 |
| crystals_14000 | 14,000 Sky Crystals | 10,000 Sky Crystals + 40% bonus | $99.99 |

Premium skins, islands and the Sky Pass premium track are bought with Sky Crystals inside
the game, so they don't need their own products.

Product IDs must match exactly. Set up a **payments profile** (Monetize → Monetization
setup) before you can sell anything.

## Testing before release

New personal developer accounts must run a **closed test with at least 12 testers for
14 days in a row** before they can apply for production. Plan for it:

1. Testing → Closed testing → create a track, upload `skyrise-release.aab`.
2. Add testers by email (a Google Group is easiest) and send them the opt-in link.
3. Ask them to keep the app installed and open it a few times over the two weeks.
4. Then apply for production access (Dashboard), answering the short questionnaire.

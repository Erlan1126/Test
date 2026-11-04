# Skyrise: App Store Connect

Copy each part into the matching field in App Store Connect (appstoreconnect.apple.com).

## New app

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Skyrise: Tower Stack (30 characters max. If it's taken, try "Skyrise: Build the Sky") |
| Primary language | English (U.S.) |
| Bundle ID | com.erlanstudios.skyrise (register it first under Certificates, Identifiers & Profiles → Identifiers) |
| SKU | skyrise-ios-1 |
| User access | Full access |

## App information

- **Subtitle** (30 max): `Stack floors. Touch the sky.`
- **Category:** Games. Subcategories: **Casual** and **Puzzle**.
- **Content rights:** "No, it does not contain, show, or access third-party content."
- **Age rating:** answer **None / No** to every question (no violence, no gambling, no
  user-generated content, no web browsing, no chat). The result should be **4+**.

## Pricing and availability

- Price: **Free**.
- Availability: all countries.

## App privacy

- Privacy policy URL: https://gist.github.com/Erlan1126/264df0444c9e353f3af95cccba90a61d
- Data collection: **"Yes, we collect data from this app"**, only for the worldwide
  leaderboard. Declare these three, each **Linked to the user: No**, **Used for tracking:
  No**, purpose **App Functionality**:
  - **Identifiers → User ID** (a random player id the game makes; not an Apple or device id)
  - **User Content → Other User Content** (the leaderboard nickname the player types)
  - **Usage Data → Product Interaction** (scores and the taps of ranked towers, to check them)
  Progress stays on the phone. Apple handles purchases. There are no ads or analytics.
  (If the leaderboard server isn't switched on yet, nothing is sent; you can still declare
  it now so you don't have to change the answers later.)

## Version 1.0 page

**Promotional text** (170 max, can change any time):

> New: daily missions, a play streak and weekly leagues. How tall can you build?

**Description:**

> Build the tallest skyscraper in the world, one tap at a time.
>
> A floor slides back and forth above your tower. Tap to drop it. Whatever hangs over the
> edge breaks off, so every miss makes your tower narrower. Line it up perfectly and the
> floor keeps its full width, and wider floors fit more people.
>
> CLIMB PAST REAL LANDMARKS
> Niagara Falls, the Statue of Liberty, the Great Pyramid, the Eiffel Tower, the Empire
> State Building and the Burj Khalifa. The next one appears beside your tower as you climb.
>
> SPECIAL FLOORS
> Gold penthouses pay 5x on a perfect drop. Icy floors slide fast but hold more people.
> Garden terraces slow down and widen your tower again.
>
> SOMETHING NEW EVERY DAY
> A daily tower that's the same for everyone, three missions and a reward chest, a play
> streak with freezes for days off, rent from your tower, and a weekly league from Bronze
> to Legend. Turn on the daily reminder so you never lose your streak.
>
> YOUR OWN FLOATING ISLAND
> Houses, a farm, a lake and a waterfall, and a city you build with coins: a café, a
> windmill, a lighthouse, a rocket pad and more.
>
> A SKY THAT CHANGES AS YOU CLIMB
> Day turns to sunset and night, with lit windows, fireflies, aurora, rain, snow and
> lightning. Planes, airships and satellites pass by at their own heights.
>
> PLAY YOUR WAY
> Classic, Daily, a relaxing Zen mode with no way to fail, and six landmark challenges.
> 19 tower skins, island themes, trophies and builder levels.
>
> Free to play with no ads. Optional premium skins and islands are cosmetic only and
> never help you score.

**Keywords** (100 max, commas, no spaces):

`tower,stack,building,skyscraper,tap,one tap,city,builder,block,casual,relaxing,arcade,timing,island`

(That's 99 characters. Don't repeat words already in the app name.)

- **Support URL:** your itch.io page, or any page with your contact email.
- **Marketing URL:** your itch.io page (optional).
- **Copyright:** `2026 Erlan Studios`

**Screenshots:** upload the five files in `app-store-screenshots/` (1290 × 2796) to the
**6.9" / 6.7" iPhone** slot, in order 01 to 05. Apple scales them for smaller iPhones.
The app is iPhone only, so no iPad screenshots are needed.

**App icon:** taken from the build automatically.

## In-app purchases

Features → **In-App Purchases** → +. Make each one **Consumable** (players can buy
packs again and again). The Product ID must match exactly, because the game looks for these ids.

| Reference name | Product ID | Price | Display name | Description (55 max) |
|---|---|---|---|---|
| 100 Sky Crystals | crystals_100 | $0.99 | 100 Sky Crystals | A handful of Sky Crystals |
| 550 Sky Crystals | crystals_550 | $4.99 | 550 Sky Crystals | 500 Sky Crystals + 10% bonus |
| 1,200 Sky Crystals | crystals_1200 | $9.99 | 1,200 Sky Crystals | 1,000 Sky Crystals + 20% bonus |
| 2,600 Sky Crystals | crystals_2600 | $19.99 | 2,600 Sky Crystals | 2,000 Sky Crystals + 30% bonus |
| 7,000 Sky Crystals | crystals_7000 | $49.99 | 7,000 Sky Crystals | 5,000 Sky Crystals + 40% bonus |

Everything else (premium skins and islands, the Sky Pass premium track) is bought **with
Sky Crystals inside the game**, so it doesn't need its own store product.

For each pack, also add a **review screenshot**: take one of Shop → 💎 Crystals on your
iPhone (TestFlight build) and reuse it for all five. Then, on the version page, select
all five under **In-App Purchases and Subscriptions** so they're reviewed with the app.

Before any of this works you must accept the **Paid Apps Agreement** and add your bank
and tax details (Business → Agreements). Without it, purchases won't load.

## App Review information

- Sign-in required: **No**.
- Notes:

> Skyrise is a one-tap tower stacking game. Tap anywhere to drop the sliding floor.
> In-app purchases are packs of Sky Crystals (consumable), in Shop → 💎 Crystals. The
> shop appears after the first 3 towers (one tower takes under a minute); then tap the
> bag icon at the bottom of the home screen. Crystals buy cosmetic skins and islands and
> the monthly Sky Pass premium track (Pass button). Everything is cosmetic and nothing is
> random: players always see exactly what they get. No account is needed. The worldwide
> leaderboard (Ranks button) shows a nickname the player chooses.

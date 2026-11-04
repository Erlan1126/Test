# Skyrise: App Store Connect

Copy each part into the matching field in App Store Connect (appstoreconnect.apple.com).

## New app

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Skyrise: Tower Stack (30 characters max. If it's taken, try "Skyrise: Build the Sky") |
| Primary language | English (U.S.) |
| Bundle ID | com.erlan1126.skyrise (register it first under Certificates, Identifiers & Profiles → Identifiers) |
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

- Privacy policy URL: the public link to your privacy page (see STORES.md, step 0).
- Data collection: **"No, we do not collect data from this app."**
  (Progress stays on the phone. Apple handles purchases. There are no ads or analytics.)

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
- **Copyright:** `2026 [your name]`

**Screenshots:** upload the five files in `app-store-screenshots/` (1290 × 2796) to the
**6.9" / 6.7" iPhone** slot, in order 01 to 05. Apple scales them for smaller iPhones.
The app is iPhone only, so no iPad screenshots are needed.

**App icon:** taken from the build automatically.

## In-app purchases

Features → **In-App Purchases** → +. Make each one **Non-Consumable**. The Product ID
must match exactly, because the game looks for these ids.

| Reference name | Product ID | Price | Display name | Description (55 max) |
|---|---|---|---|---|
| Crystal Palace skin | skin_crystal | $1.99 | Crystal Palace | A sparkling tower of ice-blue glass |
| Sakura Spire skin | skin_sakura | $1.99 | Sakura Spire | Blossom pink with warm paper lanterns |
| Royal Amethyst skin | skin_royal | $1.99 | Royal Amethyst | Deep purple stone trimmed in gold |
| Cyber City skin | skin_cyber | $2.99 | Cyber City | Black glass with glowing neon edges |
| Volcano Island | island_volcano | $2.99 | Volcano Island | Black rock, palm trees and glowing lava |
| Candy Island | island_candy | $2.99 | Candy Island | Pastel lawns and cotton-candy trees |
| Founder's Pack | founders | $7.99 | Founder's Pack | Every premium skin and island + 5,000 coins |

For each one, also add a **review screenshot**: take one of the shop's Premium tab on your
iPhone (TestFlight build) and reuse it for all seven. Then, on the version page, select
all seven under **In-App Purchases and Subscriptions** so they're reviewed with the app.

Before any of this works you must accept the **Paid Apps Agreement** and add your bank
and tax details (Business → Agreements). Without it, purchases won't load.

## App Review information

- Sign-in required: **No**.
- Notes:

> Skyrise is a one-tap tower stacking game. Tap anywhere to drop the sliding floor.
> Premium items are in Shop → Premium. The shop appears after the first 3 towers (one
> tower takes under a minute); then tap the bag icon at the bottom of the home screen. All in-app purchases are non-consumable
> cosmetics, and "Restore purchases" is at the bottom of that tab. No account is needed.

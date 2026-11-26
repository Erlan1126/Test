# Lumen Rush: App Store and Google Play package

Store text, screenshots, ratings and privacy answers for Lumen Rush, the light-swing runner
(`echo.html` + `echo/` on `main`). Matches the game after PR #28 (version 0.9.0, 60 stages,
six bosses).

**Two open points before this can be submitted:**

1. **The store name.** The game is called Lumen Rush in code and on the web, and "Echo" has
   also been discussed. Everything here says Lumen Rush. If the name changes, change the
   name, subtitle, keywords, the captions on the screenshots (they don't show the name, so
   only the files' text needs redoing if you want) and the icon wordmark.
2. **A phone app.** Lumen Rush is web-only today (a PWA on GitHub Pages). The stores need a
   native wrapper first, for example Capacitor like Buildaroo, with its own id
   (`com.bigbrucestudios.lumenrush` suggested), a portrait lock, and the in-game Back button
   wired to Android's Back. That's a separate piece of work; the listing below is ready for it.

It has no purchases, ads, accounts or server, so the money and privacy parts are simple.

---

## 1. New app

| Field | Value |
|---|---|
| Name (30 max) | `Lumen Rush` (10). If taken: `Lumen Rush: Swing of Light` |
| Primary language | English (U.S.) (the game is English only) |
| Bundle ID / package | `com.bigbrucestudios.lumenrush` (suggested) |
| SKU | `lumenrush-ios-1` |
| Platform | iPhone only, portrait |
| Price | Free, all countries. No in-app purchases. |

## 2. App information

- **Subtitle** (30 max): `Swing through a city of light` (29)
- **Category:** Games → primary **Action**, secondary **Arcade**.
- **Content rights:** "No, it does not contain, show, or access third-party content."
  (The Inter font is bundled under the SIL Open Font License, which allows this.)
- **Age rating:** `../RATINGS-AND-PRIVACY.md` → Lumen Rush. Expected **4+**.
- **App privacy:** "Data Not Collected" (see `../RATINGS-AND-PRIVACY.md`).
- **Privacy policy URL:** `https://www.bigbrucestudios.com/privacy/` (has a Lumen Rush
  section; the game's own page `lumen-rush-privacy.html` says the same).
- **Support URL:** `https://www.bigbrucestudios.com/support/`
- **Marketing URL:** `https://www.bigbrucestudios.com/`
- **Copyright:** `2027 Big Bruce Studios LLC`

## 3. App Review notes (paste)

> Lumen Rush is a one-touch swinging game. Hold anywhere to grab the ringed light, keep
> holding to reel in, let go to fly. The first stage teaches it with slow motion. No account,
> no sign-in, no purchases, no ads, and the game makes no network requests: progress is saved
> on the device. Stage 1 starts from the Play button on the home screen.

## 4. Store text (English)

- **Promotional text (170 max):** The city has gone dark and 60 people are waiting. Hold to swing, let go to fly, and light their windows one by one until dawn.
- **Google Play short description (80 max):** The city has gone dark. Swing on a tether of light and bring it back home.
- **Keywords (100 max):** `swing,rope,runner,light,neon,night,city,arcade,parkour,grapple,hook,endless,stages,rooftop,offline`
- **Description:**

> The city has blacked out. You are made of light.
>
> HOLD TO SWING, LET GO TO FLY
> One touch is all it takes. Hold to grab the ringed light, keep holding to reel in and spin faster, and let go at the top of the arc for a Perfect. Honest rope physics: no hidden pushes, just you, gravity and timing.
>
> SOMEONE IS WAITING
> At the end of every stage, a home with a dark window. Mara, Old Tomas, the night nurses: 60 people across the city, each waiting for their light to come back. Reach them and watch their window glow.
>
> SIX DISTRICTS, SIX NIGHTS
> Midnight-gold Downtown, lantern-strung Markets, a rainy Harbour, the neon Arcade, a starlit Park and the Tower where the sky turns pink before dawn. Each plays differently and has its own music.
>
> BREAK THE HEART OF THE DARK
> A wave of darkness follows you. At the end of each district, the Heart of the Dark rides it after you. Grab its three shards to break it and light the whole district.
>
> MASTER EVERY STAGE
> Earn up to three stars on each of 60 handmade stages, race your own ghost, and send a friend a link to race yours. Then take on Night shift, the endless mode, and a new daily stage every day.
>
> BECOME A NEW LIGHT
> Unlock forms with their own perks, glows, scarves and tethers, all by playing.
>
> Free, with no ads and no purchases. Works offline. No account, and nothing about you leaves your phone.

## 5. What's new

- **Google Play 1.0 release notes:** `The city has gone dark. Swing through 60 stages and six districts, break the Heart of the Dark, and bring back the dawn. Thanks for playing!`

## 6. Screenshots and graphics

| Store slot | Size | Files |
|---|---|---|
| App Store iPhone 6.9" | 1320 × 2868 | `app-store-6.9/1-swing.png` … `6-locker.png` |
| App Store iPhone 6.3" | 1206 × 2622 | `app-store-6.3/` |
| Google Play phone | 1080 × 1920 | `google-play/` |
| Google Play feature graphic | 1024 × 500 | `feature-graphic.png` |
| Google Play icon | 512 × 512 | `play-icon-512.png` (the game's own icon) |

Captions, in order:

| # | Caption | Subline |
|---|---|---|
| 1 | Hold to swing. Let go to fly. | One touch. Real rope physics. |
| 2 | Someone is waiting in the dark | 60 people. Bring each one their light. |
| 3 | Bring the light home | Watch their window glow again |
| 4 | Six districts. Six nights. | Lantern markets, rain, neon rooftops |
| 5 | Relight the whole city | Light every home and bring back the dawn |
| 6 | Become a new light | Forms, glows, scarves and tethers |

All six are real captures of the game (PR #28 build), at phone size, with a scripted player
for the in-run shots.

## 7. Google Play setup

- **Create app:** `Lumen Rush`, English (United States), Game, Free.
- **Category:** Game → **Action** (or Arcade). Tags: Runner, Arcade, Offline, Casual.
- **Contact:** `support@bigbrucestudios.com`, website `https://www.bigbrucestudios.com/`.
- **Ads:** No. **App access:** everything available without special access.
- **Content rating, target audience, data safety:** `../RATINGS-AND-PRIVACY.md` → Lumen Rush.
  Data safety is a single "No".

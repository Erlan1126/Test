# Skyrise

Build the tallest skyscraper in the world, one tap at a time. Drop each floor so it lines up with the one below; overhangs break off, wider floors fit more people, and your tower climbs past real landmarks from Niagara Falls to the Burj Khalifa.

## What's in the game

- **Modes:** Classic, a Daily tower that's the same for everyone, relaxing Zen, and six Landmark challenges with their own rules.
- **Special floors:** gold penthouses (5x on a perfect drop), icy floors (fast, +50% people) and garden terraces (slow, widen your tower again).
- **Weekly events:** a different twist each week, such as Golden Week, Ice Age or Calm Skies.
- **Progress:** builder levels with rewards on every level (coins, and Sky Crystals every 5th), missions, trophies, a growing island, island themes, 43 tower skins and a daily gift streak.
- **Sky Pass:** a monthly season with 30 tiers. Everyone earns the free track by playing (pass XP from towers, missions and the daily chest); the premium track (500 Sky Crystals) adds season skins and crystals back.
- **Star shop:** spend stars on shop skins and one-tower boosts (extra rewind, double XP, gold rush). Stars are only earned by playing; there are no real-money purchases.
- **Every day:** a 🔥 play streak with weekly freezes and milestone rewards (including two streak-only skins), three new missions each day with a chest for finishing them all, rent from your tower that fills up over 12 hours, coins to build your city (café, windmill, lighthouse, rocket pad and more), and a weekly league from Bronze to Legend.
- **Leaderboards:** worldwide Daily, weekly and all-time boards through the Skyrise server (`server/`), which replays every tower from its seed and taps before ranking it. On the shared claude.ai page, the boards are for friends the game is shared with. A rival to chase shows on the main menu.
- **Sky Crystals (real money):** the paid currency, sold in packs through the App Store and Google Play in the apps (and Stripe on a website, via `server/`). Crystals buy premium skins and islands, a Founder's Pack and the Sky Pass. Everything is cosmetic and nothing is random. Add `?testpay` to try purchases without charging anything (disabled on a live site once real payments are on).
- **World:** a large floating island that grows with your best tower, with houses, a farm, a lake, forests, waterfalls and crystals underneath; weather (rain with lightning, snow); planes, airships and satellites at their own altitudes; the next landmark's silhouette to race; and shader effects (bloom, light streaks, sun rays, tilt-shift, filmic color).
- **Sound:** synthesized music that changes from day to night, ambience that follows your height (city and birds, crickets, wind), and a reverb room. No audio files.
- **Gentle start:** new players see only the Start button. Skins, missions, the daily tower, challenges, the shop and Zen open over the first few towers, each with a "New" badge.
- **Your progress:** saved on the device. Settings → *Move your progress* gives a save code to load on another phone or browser. Your profile lists your 10 best towers.

## Develop

```sh
npm install
npm run dev        # local server with hot reload
npm test           # unit tests for the rules, saves, shop and progression
npm run build      # type-check, then build to dist/
```

`npm run build` produces `dist/index.html`, a single self-contained file (the script and styles are inlined), plus icons, the web-app manifest, a link-preview image and an offline service worker.

## Project layout

```
src/
  core/      small helpers and the seeded random generator
  data/      tuning: skins, landmarks, missions, trophies, events, challenges, shop
  logic/     game rules with no DOM: the tower sim, saves, progression, shop, unlocks
  render/    canvas drawing: camera, sky and island, buildings, effects, previews
  ui/        DOM helpers and the pop-up sheets
  native.ts  phone-app extras: haptics, back button, reminders, share, save backup
  payments.ts  premium purchases (Stripe on the web, App Store / Google Play in the apps)
  online.ts  leaderboards: worldwide (Skyrise server) or friends (claude.ai page)
  app.ts     the controller: screens, input and the frame loop
  sound.ts   synthesized sound effects and music (no audio files)
tests/       Vitest tests for everything in logic/ and the server
server/      Cloudflare Worker: worldwide rankings (D1) and website crystal packs
public/      icons, fonts, manifest, link preview image, service worker
android/ ios/  the phone apps (Capacitor), built by .github/workflows/
assets/      source images for the app icons and launch screen
```

The logic layer is separate from drawing so it can be tested directly. Add `?debug` to the URL to expose the game as `window.__app` for automated tests.

## Publishing

`dist/` is a static site. Upload it to any static host (GitHub Pages, Netlify, Cloudflare Pages), or zip its contents for game portals such as itch.io (an HTML game with `index.html` at the top level) or CrazyGames and Poki (which review submissions and have their own SDK requirements).

The App Store and Google Play apps are built on GitHub from the same code; see
[STORES.md](STORES.md). After changing the game, `npm run build && npx cap sync` copies
it into the native projects.

Not included yet: cloud saves tied to an account, and friend lists.

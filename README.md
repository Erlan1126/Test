# Skyrise

**Play it: https://erlan1126.github.io/Test/**

A one-tap skyscraper building game made for phones. Your tower starts on a small floating island, next to a few houses and trees. Tap (or press Space) to drop each floor. Any part that hangs over the edge shatters and falls.

- **People are your score.** Wider floors fit more people, and perfect drops attract extra residents. Sloppy drops shrink every floor after them.
- **Gold penthouse floors** slide faster, but a perfect drop on one is worth 5x the people.
- **Landmarks:** each floor adds 5 m. A progress bar shows the next landmark to beat, from a house up to the Burj Khalifa.
- **Day to night:** the sun sets as you climb, you pass through a cloud layer, and at night the moon and stars come out while the windows light up.
- **Wind:** above about 125 m, gusts make floors speed up and slow down.
- **Three ways to play:** Classic; a **Daily tower** where everyone gets the same gold floors and gusts each day; and **Zen mode**, a relaxed build with no failing that you finish from the pause menu.
- **One rewind per tower:** miss a floor and you can rewind it once before the tower ends.
- **Missions:** three goals at a time, like "Get a perfect streak of 6". Finishing one earns stars.
- **A growing island:** your best tower upgrades your island for good, adding a fountain, a duck pond, new neighbors, street lights and traffic, a Ferris wheel, and hot-air balloons.
- **Builder levels:** every tower earns XP, even a short one. Each level gives a star (3 at levels 5, 10, 15 and so on) and unlocks island themes.
- **Daily gift:** open the game each day for a gift that grows over a 7-day streak (1 to 5 stars). Miss a day and the streak starts over.
- **Trophies:** 16 to collect, like "Laser Focus" for a perfect streak of 25. Each one gives a star.
- **Island themes:** Green Meadow, Snowy Peaks (level 3), Desert Oasis (level 6) and Cherry Blossom (level 10), each with its own trees and ground.
- **So close!** After a tower, the game points out the goal you nearly reached: your best, the next landmark, or a mission.
- **Mission swap:** trade one mission a day for a new one.
- **13 tower skins:** Glass Tower to start, one more for every landmark you pass (Brick Block, Ocean Breeze, Candy Tower, Desert Sandstone, Retro Future, Bridge Red, Neon Nights, Art Deco, Diamond Spire), plus Starlight, Rainbow Rise and Aurora for collecting stars. Pick one from the **Tower skins** gallery.
- **Fair at every speed:** the window for a perfect drop is measured in time, so it stays fair as floors speed up. Floors barely speed up for the first 15 floors, then ramp up to top speed around floor 50.
- **Wind warning:** above about 125 m, a wind meter shows each gust half a second before it hits.
- **Music and sound:** calm generated music that adds layers as you climb and during perfect streaks, plus landing thuds, breaking glass and crowd cheers. Sound, music, vibration and graphics quality are in Settings.
- **Beginner tips:** the first tower shows where to tap and explains the people score.
- **Pause** any time; the game also pauses itself when you switch apps.
- **Challenge a friend:** shares a picture of your finished tower and a link with your score in it. When a friend opens the link, their game shows your score as the one to beat.

Sound and music are generated in the browser. Fonts load from Google Fonts, with system fonts as a fallback when offline.

## The website

The site is hosted for free on GitHub Pages, straight from the `main` branch. Everything is plain HTML, CSS and JavaScript, with no build step.

| File | What it is |
| --- | --- |
| `index.html` | The Skyrise game (the site's home page) |
| `star-defender.html` | Star Defender, an earlier arcade space shooter |
| `manifest.webmanifest` | Lets phones install the game to the home screen, full screen like an app |
| `sw.js` | Saves the game for offline play after the first visit |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App and browser icons |
| `og.jpg` | The preview picture shown when the link is pasted into a chat or social app |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

If you rename the repository, update the site address in the `og:url`, `og:image` and `twitter:image` tags at the top of `index.html`.

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

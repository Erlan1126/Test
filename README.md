# Skyrise

**Play it: https://erlan1126.github.io/Test/**

A one-tap skyscraper building game made for phones. Your tower starts on a small floating island, next to a few houses and trees. Tap (or press Space) to drop each floor. Any part that hangs over the edge shatters and falls.

- **People are your score.** Wider floors fit more people, and perfect drops attract extra residents. Sloppy drops shrink every floor after them.
- **Gold penthouse floors** slide faster, but a perfect drop on one is worth 5x the people.
- **Landmarks:** each floor adds 5 m. A progress bar shows the next landmark to beat, from a house up to the Burj Khalifa.
- **Day to night:** the sun sets as you climb, you pass through a cloud layer, and at night the moon and stars come out while the windows light up.
- **Wind:** above about 125 m, gusts make floors speed up and slow down.
- **Building styles:** Glass Tower, Brick Block, Candy Tower and Neon Nights. Unlock them by building past landmarks, and switch styles with the arrows on the title and game-over screens (or the arrow keys).
- **Challenge a friend:** shares a picture of your finished tower and a link with your score in it. When a friend opens the link, their game shows your score as the one to beat.

Sound effects are generated in the browser (there's a mute button). Fonts load from Google Fonts, with system fonts as a fallback when offline.

## The website

The site is hosted for free on GitHub Pages, straight from the `main` branch. Everything is plain HTML, CSS and JavaScript, with no build step.

| File | What it is |
| --- | --- |
| `index.html` | The Skyrise game (the site's home page) |
| `echo.html` | Echo, a cave-exploring game where you see with sound |
| `echo.webmanifest`, `echo-icon*.png`, `echo-icon.svg`, `echo-apple-touch-icon.png` | Lets phones install Echo as its own app, with its own icon |
| `star-defender.html` | Star Defender, an earlier arcade space shooter |
| `manifest.webmanifest` | Lets phones install the game to the home screen, full screen like an app |
| `sw.js` | Saves the game for offline play after the first visit |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App and browser icons |
| `og.jpg` | The preview picture shown when the link is pasted into a chat or social app |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

If you rename the repository, update the site address in the `og:url`, `og:image` and `twitter:image` tags at the top of `index.html`.

## Echo

A little light, lost in the dark. Play it at https://erlan1126.github.io/Test/echo.html.

You're Lumi, a glowing creature in a pitch-black cave. You can't see, but you can sing: each song spreads through the cave like a wave, flowing around corners, and softly lights up the rock for a moment before it fades back into darkness.

- **Tap** anywhere to sing (or press Space). **Put your thumb down anywhere and slide it** to swim: a joystick appears under your thumb, and the further you slide, the faster Lumi goes (or use the arrow keys / WASD). Lumi eases into tunnel openings so corners don't catch.
- **Goal:** find the golden lost lights, then swim into the portal.
- **Stars:** one for reaching the portal, one for finding every light, and one for using no more songs than the cave's par.
- **Things you meet:** crystals that keep glowing once your song touches them, purple sound doors that open for a few seconds when your song reaches them, underground currents that carry you along, glow-moths that follow you and make your light bigger, and sleepy Snoozles that push you away if you bump into them.
- The cave keeps a faint memory of every wall you've seen, so the map slowly fills in.

There are 1,000 levels in 50 worlds of 20, shown on a winding level map. The first 10 levels are handmade and teach each idea one at a time. The rest are built by a level generator from the level number, so a given level is the same cave for every player, and each one is checked to make sure every light and the portal can be reached. Later levels bring more lights, doors, currents and Snoozles. Worlds rotate through eight cave styles: Moonlit Grotto, Mossy Hollow, Amethyst Deep, Ember Caverns, Frost Tunnels, Coral Depths, Golden Mines and Starlight Abyss. Each level unlocks when you finish the one before. Stars and best scores are saved in the browser. Sounds are generated in the browser, with an echo effect (there's a mute button), and phones that support it give a small vibration when you bump a wall.

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

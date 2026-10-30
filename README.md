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

**Controls**

- **Tap** anywhere to sing (or press Space).
- **Put your thumb down anywhere and slide it** to swim: a joystick appears under your thumb, and the further you slide, the faster Lumi goes (or use the arrow keys / WASD). Lumi eases into tunnel openings so corners don't catch.

**Goal and stars:** find the golden lost lights, then swim into the portal. You get one star for reaching the portal, one for finding every light, and one for singing no more times than the level's par.

**Levels**

- 1,000 levels in 50 worlds of 20, shown on a winding level map. Each level unlocks when you finish the one before.
- The first 10 levels are handmade and teach one idea at a time. The rest come from a level generator seeded by the level number, so a given level is the same cave for every player. Every generated level is checked so all lights and the portal can be reached.
- Generated caves come in four shapes: mazes, open caverns, chambers joined by tunnels, and long winding tunnels.
- Every few levels there's an easier breather level, and the last level of each world is a bigger finale with an extra light.
- Worlds rotate through eight cave styles, each with its own colours, music key and background sounds: Moonlit Grotto, Mossy Hollow, Amethyst Deep, Ember Caverns, Frost Tunnels, Coral Depths, Golden Mines and Starlight Abyss.

**What's in the caves**

- **Crystals** keep glowing once your song touches them, and recharge Lumi's light when you stay close.
- **Sound curtains** part for a few seconds when your song reaches them.
- **Currents** carry you along.
- **Glow-moths** follow you and make your light bigger.
- **Snoozles** push you away if you bump into them.
- **Light energy** (from level 11): Lumi's light slowly fades, and singing uses a little. Lost lights, crystals and glow-moths refill it. If it runs out, you try the level again.
- **Gloomlings** (from level 41): shadow creatures that drift through rock. When your song reaches them they chase you for a few seconds, and touching one costs light.

**Rewards**

- **Daily cave:** a new cave each day, the same for everyone, with a streak counter.
- **Lumi's looks:** eight colours, unlocked by collecting stars.
- **Awards:** twelve achievements, such as finishing a cave without bumping a wall or singing only twice.

**Settings:** music and sound volume, vibration, joystick size, a high-contrast mode (star-shaped lights and outlined creatures), and erasing progress. Background music builds as you find lights.

Progress is saved in the browser. Sounds and music are generated in the browser (there's a mute button).

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

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
| `echo.html` | Echo, a cave-exploring game where you see with sound: the page, its styles and screens |
| `echo/` | Echo's code, loaded in order by `echo.html`: `levels.js` (handmade caves, worlds and the level generator), `save.js`, `audio.js` (sounds and music), `render.js` (canvas, camera and cave art), `decor.js` (each world's decorations), `gl.js` (lights and shadows on the rock, using the phone's graphics chip), `game.js` (gameplay), `mobs.js` (each world's creatures), `draw.js` (drawing and the main loop) and `ui.js` (menus, rewards and settings) |
| `tests/run.js`, `package.json` | Automated tests for Echo (see below) |
| `tools/bundle-echo.js` | Builds a single-file copy of Echo with all its code inlined |
| `PLAYTEST.md` | A checklist for testing Echo on real phones with friends |
| `echo.webmanifest`, `echo-icon*.png`, `echo-icon.svg`, `echo-apple-touch-icon.png` | Lets phones install Echo as its own app, with its own icon |
| `star-defender.html` | Star Defender, an earlier arcade space shooter |
| `manifest.webmanifest` | Lets phones install the game to the home screen, full screen like an app |
| `sw.js` | Saves both games for offline play after the first visit |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App and browser icons |
| `og.jpg` | The preview picture shown when the link is pasted into a chat or social app |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

If you rename the repository, update the site address in the `og:url`, `og:image` and `twitter:image` tags at the top of `index.html`.

## Echo

A little light, lost in the dark. Play it at https://erlan1126.github.io/Test/echo.html.

You're Lumi, a glowing creature in a pitch-black cave. You can't see, but you can sing: each song spreads through the cave like a wave, flowing around corners, and softly lights up the rock for a moment before it fades back into darkness.

**Controls**

- **Swim** with one thumb: put it down anywhere and slide. **Sing** with the Sing button under the other thumb (or tap anywhere); **hold** the button to charge a **long song** that travels much further but uses more light (Space and Shift+Space on a keyboard).
- Settings also offer **Slide** (no button; tap to sing, hold still for a long song) and **Tap to move** (tap where Lumi should go and it finds the way). The Sing button can sit on the left or right.
- The camera stays close, about 8 tiles across, and follows Lumi with a little look-ahead, so every cave has to be explored. It keeps to the cave and never shows past its edges.
- **Put your thumb down anywhere and slide it** to swim: a joystick appears under your thumb, and the further you slide, the faster Lumi goes (or use the arrow keys / WASD). Lumi eases into tunnel openings so corners don't catch.

**Goal and stars:** find the golden lost lights, then swim into the portal. You get one star for reaching the portal, one for finding every light, and one for singing no more than the number of times the level suggests. Each new world opens with a short story card.

**Levels**

- 1,000 levels in 50 worlds of 20, shown on a winding level map. Each level unlocks when you finish the one before.
- The first 19 levels are handmade, with only a two-level tutorial. After that something new arrives every level or two. New ideas get a picture card; new creatures are never announced (see below): light energy (level 3), Thornlings (5), Hushlings (7), long songs (9), lost baby moths (9), quiet caves (11), rune stones (13), dark caves (15), big caves (17) and races (19). Echo crystals appear from level 25.
- The rest come from a level generator seeded by the level number, so a given level is the same cave for every player. Each one has its own name in its world's style, like "Whispering Fernway" or "Glimmering Geode", and each world ends with a "Heart of …" finale. A level only uses ideas that have already been introduced, and never more than three big ones at once.
- Each world leans on its own ideas: Moonlit Grotto on Thornlings and Hushlings, Mossy Hollow on rescues, Amethyst Deep on rune gates, Ember Caverns on Hushlings and quiet caves, Frost Tunnels on dark caves and long climbs, Coral Depths on races and currents, Golden Mines on gates, curtains and climbs, and Starlight Abyss on Hushlings, darkness and races.
- Generated caves come in four shapes: mazes, open caverns, chambers joined by tunnels, and long winding tunnels. **Big caves** are taller or (from level 101) wider than the screen, and the camera follows Lumi. In **dark caves** lights and the portal don't glow until your song finds them, and from World 3 lights stop glowing through the dark in every cave (Guiding glow brings that back).
- Some levels have a special goal: **Quiet caves** give you a limited number of songs, **Rescue caves** hide a lost baby moth you must bring to the portal, and **Races** have a timer.
- Every few levels there's an easier breather level, and the last level of each world is a bigger finale with an extra light.
- Worlds rotate through eight cave styles, each with its own colours, music key and background sounds: Moonlit Grotto, Mossy Hollow, Amethyst Deep, Ember Caverns, Frost Tunnels, Coral Depths, Golden Mines and Starlight Abyss.

**What's in the caves**

- **Crystals** keep glowing once your song touches them, and recharge Lumi's light when you stay close.
- **Sound curtains** part for a few seconds when your song reaches them.
- **Currents** carry you along.
- **Glow-moths** follow you and make your light bigger.
- **Snoozles** push you away if you bump into them. While asleep they snore little pulses of sound that light up the walls around them.
- **Echo crystals** (from level 25): violet crystals in the rock that catch a song and sing it onward, around corners.
- **The Great Hush**: king of the Hushlings, crowned in shadow spikes with a second pair of eyes, guarding world finales from World 4.
- **Lumi's family**: one of Lumi's little lights hides in one level of every world.
- **Every world has its own creature**, and every level after the handmade ones has creatures, more the deeper you go (up to five, or six in big caves):
  - **Snapvines** (Mossy Hollow): wall plants that shiver, then lunge when Lumi swims close.
  - **Shardbats** (Amethyst Deep): crystal bats that roost on ceilings and swoop at songs they hear.
  - **Cinder Crabs** (Ember Caverns): fiery crabs that dash along floors and pause at each end.
  - **Frostwisps** (Frost Tunnels): ice ghosts that drift toward Lumi when they can see it; a touch freezes Lumi for a moment.
  - **Jellyglows** (Coral Depths): glowing jellies that bob up and down shafts.
  Later worlds mix them. Creatures are a surprise: there's no card beforehand. The first time Lumi comes face to face with one, its name and a one-line tip flash up mid-cave with a growl and a buzz, and it joins the journal.
- **Thornlings** (from level 5): spiky creatures that patrol tunnels back and forth. They're nearly invisible in the dark, so sing to see them or listen for their rattle; touching one costs light. Their patrols never cross the start.
- **Light energy** (from level 3): Lumi's light slowly fades, and singing uses a little. Lost lights, crystals and glow-moths refill it. If it runs out, you try the level again. The fade rate is matched to each cave's length, so a careful player always has enough.
- **Rune stones and gates** (from level 13): a stone gate blocks the way until every rune stone has heard a song sung close by. A dotted ring shows how close you need to be.
- **Hushlings** (from level 7): shadow creatures that drift through rock. When a song reaches one nearby it chases you for a few seconds, and touching one costs light. Afterwards they rest for a while before they can be woken again. They're the caves' main villains, the shadows of the Hush, which wants the caves silent: once they've appeared, every cave has at least one (at most three, one beside the Great Hush). They have hooded shadow bodies, ear tufts, a smoky tail and almond eyes that follow Lumi; hunting, the eyes narrow and burn pink and a jagged grin opens.

**Rewards**

- **Daily and weekly caves:** a new cave each day with a streak counter, and a harder one each week, the same for everyone.
- **Results:** a map of the route Lumi swam, with a Share map button, and your best songs and time.
- **Journal:** Lumi's family and everything you've discovered.
- **Accessories:** a leaf, bow, crown, star and flower for Lumi, unlocked by awards.
- **Lumi's looks:** eight colours, unlocked by collecting stars.
- **Awards:** fourteen achievements, such as finishing a cave without bumping a wall, rescuing baby moths or opening rune gates.

**Settings:** music and sound volume, vibration, controls (slide or tap to move, Sing button side), joystick size, large text, **Relaxed mode** (no light energy, Hushlings or race timers, for young players), **Guiding glow** (lights and the portal always glow a little, even in dark caves), a high-contrast mode (star-shaped lights and outlined creatures), a **save code** to back up progress or move it to another phone, and erasing progress. Tapping the Settings title five times shows a testing switch that unlocks every level. Background music builds as you find lights.

The daily cave changes at midnight UTC, so it's the same cave for everyone in the world. If a phone struggles to keep up, the game lowers its drawing resolution automatically.

Progress is saved in the browser. Sounds and music are generated in the browser, with a cave reverb, bell-like songs and warm pads (there's a mute button). The pause menu shows the current cave's goal. On phones, the Back button pauses a level, then goes to the map, then to the title, instead of leaving the game.

The cave art is painted twice: a quick soft pass so a level starts at once, then a sharp pass at full screen resolution a few milliseconds per frame, swapped in when done. Rock has layers, cracks and grain. Each world has its own decorations, more of them deeper in: moon pools and roots, moss and ferns, crystal clusters, glowing lava veins and vents, icicles and snowdrifts, coral and seaweed, mine supports and lanterns, star crystals and constellations; the glowing ones light the cave around them. Each world has its own floating particles: snow in Frost Tunnels, embers in Ember Caverns, bubbles in Coral Depths and so on. Lumi's face shows its mood: scared near hunting Hushlings, happy after a find, sleepy when its light is low. Sounds from the left or right come from that side. Each cave fades in with its name. Lumi has a swaying antenna, a soft light trail and a little squash and stretch when swimming; spores drift through the light, a faint far-away cave layer drifts behind the rock, and songs sparkle along their leading edge.

**Testing Echo**

`npm install` once (it installs [Playwright](https://playwright.dev)), then:

- `npm test` checks every level's layout, the gameplay, each mechanic and mode, every screen at several phone sizes, a robot play-through of about 100 levels, and random "chaos" input, then reports speed. It takes about a minute.
- `npm test -- --all` has the robot play all 1,000 levels and the daily cave (about four minutes). The robot is a simple player, so the check passes if it finishes at least 99% and lists the caves it lost as the hardest ones.
- `npm run test:quick` skips the robot and chaos sections.

For testing on real phones with people, see [PLAYTEST.md](PLAYTEST.md).

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

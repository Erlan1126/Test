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

## Echo, back to its core

Echo has been cut back to its core: **twenty handmade caves in two acts** (`CORE_LEVELS` in `echo/levels.js`), each built around one idea, played with a few simple rules.

- **Echoes fade.** A song lights the walls it reaches, then Lumi's memory of them fades over about ten seconds. Sing again, or remember the way.
- **Hushlings are blind.** They hunt by sound. A tap-song is heard about 4 tiles away, a long (held) song about 8, through rock. Every Hushling that hears goes to *where the sound was*, listens there for a moment, then drifts home. Only right up close (about a tile) can one sense Lumi.
- **Slow is silent.** Swimming fast, or bumping a wall, makes noise nearby Hushlings hear (a faint pink ring shows how far). Push the stick only a little, or hold Shift on a keyboard, to sneak.
- **Ring stones** (`R` in a map): when a song reaches one, it rings out three times, loud, and every Hushling that hears goes to it. Use them to call Hushlings away.
- **Two gears.** A short push on the stick sneaks (half speed, silent; Lumi's eyes narrow and its light dims), a long push swims. The phone ticks when you change gear.
- **You can read them.** A "?" floats over a Hushling that heard something and is going to look; a "!" means it senses Lumi. A pink ring rolls out to show how far each song was heard. A hunting Hushling sweeping close past without finding you whooshes by; being caught slows time for a moment with a flash.
- **Stay unheard.** In caves with Hushlings, the third star is for never being heard (results say how many times you were).
- **The echo sweep.** In 3D, walls glow cyan for a moment just as the song reaches them, so you see the echo travel.
- **Pebbles.** From cave 6 (and in the daily cave) Lumi carries three. Tap the pebble button, then tap where it should land (a ring shows the six-tile reach); E on a keyboard throws the way Lumi faces. It flies until it hits rock, it clatters where it lands and every Hushling within about six tiles goes to look.
- **Light is health.** Songs are free and nothing drains; a Hushling's touch costs a third of Lumi's light, so three touches end the try.

**Act two, The Long Echo** (caves 11 to 20) adds **Lurkers** (`u`): deaf, with one great golden eye, they see Lumi's light. Lumi's light reaches about 3 tiles, only 1.6 when sneaking, and much further for a moment after a song, so singing where a Lurker can see you is the mistake. Hushlings hear you, Lurkers see you. The caves: 11 Pebble Path, 12 Two Guards, 13 Something Watching (the first Lurker), 14 Light and Sound, 15 Moth in the Mines, 16 Cave-in (a long Run!), 17 The Choir (five Hushlings), 18 Sightlines, 19 Everything Below, 20 Sing Them Home: a long song close to a lost Hushling sings it home, and the portal opens when they all are. Act two has its own opening chapter and ending.

- **Hidden memories** (`M`): one in every cave, a pink glimmer off the main path. Finding it shows a line of Lumi's past; the map counts them (✧ 3/20).
- **Ghost runs:** your best run of each cave (more stars, then faster) is kept, and the next time you play, a pale ghost Lumi swims it beside you.

Act one's caves: 1 First Song (singing), 2 Fading Echoes (memory), 3 Three Lights (exploring), 4 Something Listening (the first Hushling), 5 The Ring Stone (luring), 6 Tiptoe (sneaking between four), 7 The Hunter (Run!, the cave collapses), 8 The Lost Moth (rescue past a guard), 9 The Deep Maze (everything together), 10 The Great Hush (sing to it; the ending). A short new story opens the game and closes it.

**The rock** is textured from all three sides (no streaks down the walls), darker toward the walls' feet, with damp, shiny floors that catch Lumi's light and deeper shadow where floor meets wall. The play camera sits a little lower for a more filmic view.

**The title** is a slow film shot: the camera drifts low around Lumi in the cave, the name glows above, and Play sits at the bottom with Map, Looks and Settings. Tap the dark and Lumi sings. **The story** is told the same way: the cave is the picture, with warm light, glowing eyes, echo rings, fireflies or stars drawn over it; the words fade in one by one under Lumi; tap anywhere to see the rest, tap again to go on, or Skip.

There is no Flare in the core: pebbles, ring stones and sneaking are how you deal with the dark.

**Daily and weekly caves** come back on the title once the story is finished. They're built from seven handmade rooms (`ROOMS` in `echo/levels.js`: a guard to pebble away, a guard and a stone, a watched crossing, two Hushlings to thread between, a crooked watched corridor, a guard to go round, a light between two), four a day and five a week, stacked between the start and the portal, some mirrored, with the day's twist on top. Everyone gets the same cave.

The old 160-level generator and its handmade intro levels are gone. Home, quests and awards are hidden; the old chimes, lamps, creatures and story chapters still sit in the code behind `CORE`, unused. Phones with few cores or little memory start with the lighter 3D (no bloom or shadows, lower resolution). The sections below describe the bigger game this grew out of.

## Every cave has a job

There are 160 caves now: eight worlds of twenty, the first nineteen handmade. Fewer than before, but no two in a row play alike, because each cave's place in its world decides what it asks of you (`SLOT_GOALS` in `levels.js`): explore and solve the chimes, **Relight the city**, **Run!**, rescue a lost moth, sneak through a quiet cave, race the clock, and a finale with the Great Hush. A cave with a job gets one other big idea fewer.

- **Relight the city** (from World 2): three to five dark street lamps stand along the streets. Sing close to each to light it again (it gives Lumi a little light back and lights its street for good). When all burn, the district wakes (its windows glow brighter) and the portal opens.
- **Run!** (from World 2): a Hunter, a piece of the Hush, rises behind you three seconds after you arrive. It never gives up and passes through rock, but it's a little slower than Lumi; flare it back if it gets close, and reach the portal. A touch costs light and sends it back to where it rose.

## A look at 3D

`echo3d.html` is a separate test scene, not part of the game: one street of the lost city in real 3D (Three.js with bloom and filmic tone mapping), with irregular cobbles and brick walls that catch the light (bump maps), houses with pilasters, cornices, ledges, arched window frames, sills, balconies, doorsteps and gabled or crenellated roofs, warm and dark mullioned windows, stone arches, a far skyline fading into fog, hanging rock above, dust in the light, Lumi and the Hushlings drawn in the game's own style as billboards, Lumi as a light source, a song ring that lights the street as it rolls, five street lamps to relight and Hushlings that chase songs and flee from lit lamps. Drag to swim, tap ♪ to sing.

## The chime puzzle

From level 4, every cave hides chime stones (two at first, three from World 2, four from level 101), shuffled and spread out, and the portal stays sealed until they're rung in order. The order is shown under the HUD as colours and shapes (● blue, ◆ violet, ▲ gold, ★ pink, so it works without colour too). Swim into a chime to ring it: the right one sings its note, gives Lumi 22 light back and lights up; the wrong one just sounds dull and tells you which comes next. When the melody is complete it plays back and the portal wakes. Chimes stay hidden until light finds them, so each cave is a little search-and-route puzzle. The level's walk, par, song limit and timer all grow to cover the chime route.

## The lost city

The caves were a city before the Hush. In about half of every cave the walls are built, not raw: cut stone laid in courses with mortar, fading into rough rock deeper in, raised in the bump map so lights catch it. Arched windows are cut into the walls (some still glow warm, as if a lamp was left burning), round wooden doors sit at street level, stone pillars hold up the ceilings, old street lamps stand on the floors (a few still lit) and torn banners in the world's colour hang from above.

## Flare: Lumi's defense

From level 6 (when the Hushlings arrive, with a picture card), the ✦ button above the Sing button bursts Lumi's light: within three tiles, Hushlings shrink back, stop chasing and can't be stirred again for a few seconds, other creatures and Thornlings are dazzled for over two seconds, and Lumi is safe for a moment. It costs 3 light and recharges in 6 seconds (the button fills back up). With slide controls the button sits where the Sing button would be; on a keyboard, press F.

## The story

A great **Singer** used to sing every light in the deep to sleep with the same lullaby. One night a flood swept its littlest light away. It searched and sang for years, and nobody answered, until it couldn't bear any song that wasn't that one little voice. It swallowed them all and waited in the silence. The lights called it **the Hush**, after the first word of its song, and every tear it cries becomes a **Hushling**, chasing every song because they're looking for one voice. The littlest light was **Lumi**.

- Eight illustrated chapters open the first eight worlds, over a music-box lullaby. Lumi hears the Singer in the crystals, meets the Great Hush, learns the Hushlings are tears, hears the night of the flood, and finds its own name carved under the lullaby in the old mines.
- **Flick**, a tiny glow-moth who talks too much and is scared of everything, is Lumi's first friend. It flutters beside Lumi through the first three worlds, then flies straight at the Great Hush to save Lumi and is swallowed. Only the **whole lullaby** brings Flick back: finish without all eight lines and the ending tells you so ("The End?"); find the rest, sing to the Singer again, and Flick comes home, and stays at Lumi's side from then on.
- **Lumi's family** (Pip, Fern, Bell, Kindle, Wren, Tide, Penny, Nova) hide one per world. Each says something when found and remembers one line of the lullaby; the journal collects them.
- **The finale** is level 160. The Great Hush won't hurt Lumi and the portal won't open: you sing to it. The lullaby plays line by line, the Hush sings back, says "You came back", and its shadow breaks into the warm golden Singer; every Hushling in the cave turns to light, and the ending plays (it changes if you found all eight lines).
- World 9 opens "The Long Echo": a few lost Hushlings never heard the song, so Lumi goes back down to bring them home.

## 3D

The game is drawn in 3D by default (`echo/r3d.js`, Three.js 0.128 from a CDN, with the 2D view as a fallback and a **3D view** switch in Settings). The game itself is unchanged; only the drawing is new. Each cave is sculpted rock seen from close above at an angle, kept dark but alive: rounded boulders and pebbles that catch Lumi's light and throw moving shadows, small crystals growing from the rock in each world's colour, glow-worms twinkling at the foot of the walls, water dripping from far above and ringing out on the floor, faint shafts of light from cracks overhead, beetles scurrying along the walls, spores drifting upward, mist and fireflies. Lumi is always drawn on top, so it is never hidden, and Lumi's light casts real shadows from the rock. A shader reads the same visibility as the 2D view, so the dark stays dark until Lumi's light or a song reaches it. Glowing things are real lights (Lumi, the song, the nearest few lamps, crystals, chimes and lights), songs roll out as rings of light, and bloom finishes it. Lumi is a 3D glowing ball that squashes, leans into its swim, blinks and glows as it sings (in the look you picked). Hushlings are 3D shadows: unlit black with a glowing outline, ear tufts (a crown for the Great Hush), swaying tendrils and almond eyes that narrow to pink and a jagged grin when they hunt. The other creatures are the game's own drawings standing in the scene; chimes, street lamps, runes, gates, curtains, mushrooms, crystals, pillars, pools and the portal are 3D. A struggling phone drops the bloom first, then resolution. Tests serve Three.js from `node_modules` (`npm install`), so they run the 3D view offline.

## Fear and feel

- **Eyes in the dark:** an unlit Hushling within about nine tiles shows only two faint eyes (brighter when it's hunting, and they blink), in 2D and 3D, so a careful player can spot it first.
- **Sound you can steer by:** Hushlings nearby breathe in the dark from their side of the screen (best with headphones), the Great Hush breathes slow and deep, and while something hunts you close by your heart pounds, the phone thumps with it and the music thins into a low pulse and a dissonant drone.
- **Big moments:** in Run! caves the cave comes down behind you, with stones crashing around the Hunter, rumbling, the camera shaking and the phone buzzing. The first time you near the Great Hush in a world finale, the screen trembles and it breathes. Every cave opens with the camera sweeping down from above (from very high on the first level).
- **Closest call:** the results screen and the daily share say how close a Hushling came ("😱 a whisker from a Hushling").

## Coming back every day

- **Today's cave** sits on the title screen: Daily #N, the day's twist, time left, your streak and quest progress. Twists (the same for everyone): Quiet Waters, Hushling Night (extra Hushlings), Silent Day (few songs), Deep Dark, Star Shower (extra lights) and Swift Current (a timer). Daily caves stay one screen tall, a minute or two each.
- **Streaks** pay out: a night cap at 3 days, the Dawn look at 7, a halo at 14, Golden Lumi at 30. Every 7 days earns a **streak shield** (up to 2) that covers a missed day.
- **Three daily quests** (escape Hushlings, collect lights, finish quietly...) pay **glow**, as do lights and stars in every cave. All three in a day pays a bonus.
- **Lumi's home**: the family members you rescue live there, and glow buys decorations (mushrooms, a lantern, a moss rug, crystals, a glow-moth jar, a waterfall, a star mobile, a hammock).
- **Rare Hushlings**: about one cave in eighteen has a Golden, Sleepy, Tiny or Pale Hushling. Spotting one is a little event (+20 glow) and they're collected in the journal.
- **Share result**: after the daily cave, a spoiler-free result (stars, songs, time, streak) with a link; a friend who opens it sees your score to beat on their daily card and is told who won.
- After three levels, a one-time nudge to add Echo to the home screen.
- Daily reminder notifications need a push server, which a static GitHub Pages site doesn't have; they're the next step if Echo moves to an app store or gets a small backend.

## The website

The site is hosted for free on GitHub Pages, straight from the `main` branch. Everything is plain HTML, CSS and JavaScript, with no build step.

| File | What it is |
| --- | --- |
| `index.html` | The Skyrise game (the site's home page) |
| `echo.html` | Echo, a cave-exploring game where you see with sound: the page, its styles and screens |
| `echo/` | Echo's code, loaded in order by `echo.html`: `levels.js` (handmade caves, worlds and the level generator), `save.js`, `audio.js` (sounds and music), `render.js` (canvas, camera and cave art), `decor.js` (each world's decorations), `gl.js` (lights and shadows on the rock, using the phone's graphics chip), `story.js` (the story: chapters, pictures, the lullaby, Flick), `meta.js` (the daily ritual: twists, streaks, quests, Lumi's home, rare Hushlings, sharing), `game.js` (gameplay), `mobs.js` (each world's creatures), `draw.js` (drawing and the main loop) and `ui.js` (menus, rewards and settings) |
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

- 160 levels in 8 worlds of 20, shown on a winding level map. Each level unlocks when you finish the one before.
- Nothing in a cave shows until Lumi's light or a song reaches it: lights, moths, creatures, glowing decorations and the portal all stay hidden in the dark (Guiding glow in Settings shows them faintly).
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
- **Hushlings** (from level 6): shadow creatures that drift through rock. Sing within about five tiles of one (it hears through rock; a little further deeper in) or swim within two, and it chases you at about 2 tiles a second early on, rising to nearly 3 deep down (Lumi swims 4.6), for as long as it can see you. Run, or hide: break its line of sight behind rock and it searches where it last saw you, then gives up after a few seconds with a grumble and drifts home. Touching one costs light. Afterwards they rest for a while before they can be woken again. They're the caves' main villains: from level 6 every cave has at least three (four sometimes, deep down; the Great Hush counts as one). They have hooded shadow bodies, ear tufts, a smoky tail and almond eyes that follow Lumi; hunting, the eyes narrow and burn pink and a jagged grin opens.

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

The cave art is painted twice: a quick soft pass so a level starts at once, then a sharp pass at full screen resolution a few milliseconds per frame, swapped in when done. Rock has layers, cracks and grain. Each world has its own decorations, more of them deeper in: moon pools and roots, moss and ferns, crystal clusters, glowing lava veins and vents, icicles and snowdrifts, coral and seaweed, mine supports and lanterns, star crystals and constellations; the glowing ones light the cave around them. Each world has its own floating particles: snow in Frost Tunnels, embers in Ember Caverns, bubbles in Coral Depths and so on. Lumi's face shows its mood: scared near hunting Hushlings, happy after a find, sleepy when its light is low. Sounds from the left or right come from that side. Each cave fades in with its name. A bloom pass on the graphics chip lets the brightest things glow softly (at half size, so edges stay crisp; on a struggling phone the glow goes first, before the resolution drops), lights flicker gently, and light hangs in the air of open caves. There's no circle under your thumb: you just slide. Lumi has a swaying antenna, a soft light trail and a little squash and stretch when swimming; spores drift through the light, a faint far-away cave layer drifts behind the rock, and songs sparkle along their leading edge.

**Testing Echo**

`npm install` once (it installs [Playwright](https://playwright.dev)), then:

- `npm test` checks the ten caves' layouts, the gameplay, the core rules (fading echoes, blind Hushlings, sneaking, ring stones, light as health, the Hunter, the moth, the Great Hush), every screen at several phone sizes, a robot play-through of all ten caves and the daily cave, and random "chaos" input, then reports speed.
- `npm test -- --all` has the robot play all 160 levels and the daily cave (about a minute). The robot is a simple player, so the check passes if it finishes at least 99% and lists the caves it lost as the hardest ones.
- `npm run test:quick` skips the robot and chaos sections.

For testing on real phones with people, see [PLAYTEST.md](PLAYTEST.md).

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

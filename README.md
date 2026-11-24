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

## Lumen Rush

Play it at https://erlan1126.github.io/Test/echo.html.

**The city has blacked out. You are a being of light, swinging across the skyline on a tether of light.**

**Why you swing: someone is waiting.** At the end of every stage there's a home with a dark window and a person inside: Mara, Old Tomas, the night nurses... 60 people across six districts (Downtown, the Markets, the Harbour, the Arcade, the Park, the Tower). Reach them and their window lights up warm and they wave; the card tells you what the light gave back ("Now she can read to her son again"). The home screen counts **homes relit (n/60)**, the stages sheet keeps a journal of everyone you've reached, finishing a district's boss stage lights the whole district, and stage 60 brings back the dawn. The daily stage has a different neighbour each day. **Each district plays and looks different:** Downtown (midnight gold), the Markets (pink dusk, lantern strings that sway), the Harbour (rainy blue night, falling in the water is a splash that slows you instead of costing a heart), the Arcade (neon night, bounce pads on the rooftops), the Park (starlight, grabbable treetops for low swings) and the Tower (updrafts between the towers; the sky turns pink before dawn and stage 60 ends at sunrise). **Night shift** (Endless) opens once Downtown is lit and mixes every district; it counts the windows you light, with a best for the week. Each district has its own music (key, chords and tempo), and a warm chord rings when your light reaches a window. **Halfway lantern:** on long stages (800 m and up, from the Harbour on), passing the middle marks a checkpoint; if you fall after it, the fail card offers "From halfway": it relights the home but gives 1 ★ and no best time or ghost, so 3 stars still means the whole stage in one go. **Outage week:** each week one district (never Downtown) has power outages: a third of its plain anchors flicker dark for moments and can't be grabbed, but every light there counts double; the city map and home screen say where. **The city map** (City on the home screen) shows all six districts as skylines of ten homes each; a window lights up warm for everyone you reach, a finished district glows, a dawn bar fills toward 60, and tapping a building shows who lives there and lets you play it. Fail, and they're "still waiting in the dark".

- **Aim you can see:** the anchor you'll grab always wears a bright ring with a dashed line from you to it (the nearest reachable anchor ahead). **Hold anywhere** to grab exactly that one; if it's out of reach the ring is grey and a press says why ("Too far" / "Below you"). Keep holding and you **reel in**: the rope shortens and, like a skater pulling in their arms, you spin faster. **Let go** to fling yourself. Let go moving forward and up, fast, for a **Perfect** (a boost, +2 lights, a spin). The first run teaches both with slow motion.
- Every building you pass **lights back up** (a sweep of light climbs its facade, its roof edge glows, its street lamp comes on) and the skyline behind wakes with it. A **wave of darkness** follows you from behind; if it catches you it costs a heart.
- You can **land on rooftops** and run along them. The **street**, building **walls**, **live wires** between rooftops and patrolling **drones** cost a heart. Gold lights hang along the arcs between anchors.
- The night brightens toward dawn as you go. Districts have their own buildings and anchors: Downtown (hover-lamps and roof masts), Market Street (lanterns strung between rooftops), Waterfront (the harbour below, balloons), Neon Arcade (neon hoops, signs and screens everywhere) and Park Avenue (giant trees lit with fairy lights, balloons).
- Power-ups: **Magnet**, **Shield**, **Comet** (blaze straight across the sky). Events: **Light shower** and **The dark surges**. Fireworks every 500 m.
- **Locker:** forms of light with perks (Aurora; Ember: longer reach; Tide: extra heart; Volt: stronger Perfects; Nova: combo lights), glow colours, scarves (ribbon, long silk, comet tail, twin, ember, prism) and tether colours, with a live preview of your figure swinging. **Ranks:** homes relit, stars, this week's Night shift, today's daily and your fastest stage in each district. **Letter hunt:** find L-U-M-E-N in the sky in one day.
- **Honest physics:** just gravity and the rope (no hidden pushes); the rope starts at your real distance and reeling in is the only way to gain speed on a swing; the camera follows calmly; a wide Perfect window; hitting a wall turns into a **wall run** up and over; the first street touch is a free bounce (a second one soon after costs a heart); the darkness starts slow and ramps up after 150 m.
- **Story and the Heart of the Dark:** a short line of story as each district begins (who put the city out, and why it's coming back). Near the end of every district the **Heart of the Dark** rides the darkness after you: grab its three violet shards to break it (+60 lights, fireworks).
- **Weekly events:** Golden Week (double lights), Gold Rush Week (gold anchors everywhere), Dark Week (faster dark, ×1.5 score), Overdrive Week (Flow fills twice as fast), Spring Week (spring anchors everywhere).
- **Stages** (echo/stages.js): Play starts your next stage straight away. 60 short courses (about 15–50 s, longer and harder as you go) with a glowing finish gate, 1–3 stars (★ finish · ★★ catch half the lights · ★★★ catch 80% without a hit), an instant retry and a stage map. Every stage is the same course every time, so you can learn it; a high **sky route** of gold anchors and bonus lights rewards daring play.
- **Ghosts and challenges:** your best run on each stage races you as a see-through ghost; **Share** sends a picture of your best moment (a Perfect chain or the finish) and a link that lets a friend race your ghost on the same stage (Play turns into “Race your friend”).
- **Difficulty that climbs:** wires from stage 2, drones and crumbling anchors from 3, drifting anchors from 4, the street costs a heart from 5; the grab reach shortens, the Perfect window narrows and the darkness speeds up as you go; ★★★ also needs a par time. Every 10th stage is a **boss stage** (the Heart of the Dark from the start, 3 shards to break it). New elements get a one-line intro the first time.
- **Boost rings** on the flight paths (through one: speed, +3 lights, Flow); **graded releases** (a near-miss release is a "Good": +1 light and a small push); **wind stages** from stage 7 (gusts push you sideways, shown as streaks); afterimages on dashes, Perfects and rings.
- **Feel and polish:** the last heart shatters the figure into sparks with a moment of slow motion; a quick camera punch on rings and Perfects; boss stages and Overdrive play the full, intense soundtrack; the first lesson shows a ring that fills while you hold. The swing draws on an opaque canvas (cheaper for Safari to composite).
- **Star rewards:** stars from stages unlock looks for free (6★ Long silk scarf, 12★ Mint glow, 20★ Gold tether, 30★ Ember…); the stage map shows the next reward.
- **Daily stage:** one course for everyone each day, with your ghost and the streak. Nothing pops up over Play at launch.
- **Drawn in fast 2D** (echo/swing2d.js), no WebGL: buildings, glows and smoke are pre-drawn images; the sky and far skyline are one pre-drawn strip (dark and lit versions, lit left of the figure), so a frame is mostly cheap image copies at a steady 60 fps.
- **Feel:** a trajectory preview while you swing shows where you'd fly if you let go now (gold when it's a Perfect); chained Perfects pay more and chime higher (Perfect ×3! +4); a whoosh on release that matches your speed; a haptic tick on every grab.
- **Performance (phones):** no live background blur behind panels (solid glass instead), a resolution that adapts to the frame rate (1.5× down to 1×), nothing drawn when invisible, and the run pauses itself when you leave the app and stops redrawing while paused. **Settings → Show FPS** shows the real frame rate.
- **Flow and Overdrive:** Perfects, lights and gold anchors fill the Flow bar (it fades slowly, a hit halves it). Full Flow sets off **Overdrive** for 6 s: double lights, lights fly to you, a golden glow, and the dark falls back.
- **Air dash:** swipe forward in mid-air (or press →) for a burst of speed; one charge, back when you grab an anchor.
- **Special anchors:** **gold** (+5 lights and Flow), **crumbling** (orange; breaks if you hang on more than about a second), **drifting** (slides side to side) and **spring** (green; launches you upward on release).
- **Restore the city:** every relit building counts toward the whole city across all runs (shown on the home screen); every 150 pays 50 lights. **Light capsules** (for 600 m or 10 Perfects in a run) open in the Locker into lights or a random look.
- **Visuals:** windows flick on in steps with a burst ring, LED strips and blinking roof beacons; energy pulses run along the tether; a flash, ring and slow motion on every Perfect; shooting stars and an aurora at night, sun rays at dawn; drifting tendrils and violet lightning at the edge of the dark.

**Home and menus.** The home screen is the live swing playing itself behind the LUMEN RUSH wordmark, your lights, level, Locker and Settings at the top, the person waiting at your next stage and **Play**; under it the City (the map), Daily and Night shift tiles. One tab bar: Home, Locker, Shop (upgrades), Ranks and Today. Lists open as **sheets** that slide up from the bottom; tap outside to close. **Today** holds the seven-day gift calendar, three daily missions (the same for everyone), the **season** (a free 30-tier reward track that starts again every month) and the run missions. When a stage ends, a card shows your stars, time, lights and Perfects with Next, Retry and Share; when a Night shift ends, a card counts up your score, windows lit, your level and today's progress. **Settings:** music and sound volume, vibration, Reduce motion, Show FPS, and a backup code to move your progress to another phone.

**Sound.** A generated electronic soundtrack that builds with your speed; each district has its own key, chords and tempo.

Progress is saved in the browser. On phones, the Back button goes from a run (or Settings) back to the home screen instead of leaving the game.

## The website

The site is hosted for free on GitHub Pages, straight from the `main` branch. Everything is plain HTML, CSS and JavaScript, with no build step.

| File | What it is |
| --- | --- |
| `index.html` | The Skyrise game (the site's home page) |
| `echo.html` | Lumen Rush: the page, its styles and screens |
| `echo/` | Lumen Rush's code, loaded in order by `echo.html`: `core.js` (small shared helpers), `save.js`, `audio.js` (sounds and music), `city.js` (the sheets: city map, locker, shop, ranks, awards), `run.js` (the run shell: HUD, pause, keep going?, run-over card, the frame loop and the title's attract run), `swing.js` (the swing: physics, anchors, the skyline, power-ups, looks), `swing2d.js` (draws the swing), `stages.js` (60 stages, the people, the city map, the opening, ghosts and sharing), `progress.js` (gift calendar, daily missions, weekly events, awards, season, challenge links) and `ui.js` (home screen, Today, settings, backup, startup) |
| `tests/run.js`, `package.json` | Automated tests for Lumen Rush (see below) |
| `tools/bundle-echo.js` | Builds a single-file copy of Lumen Rush with all its code inlined |
| `echo.webmanifest`, `echo-icon*.png`, `echo-icon.svg`, `echo-apple-touch-icon.png` | Lets phones install Lumen Rush as its own app, with its own icon |
| `star-defender.html` | Star Defender, an earlier arcade space shooter |
| `manifest.webmanifest` | Lets phones install the game to the home screen, full screen like an app |
| `sw.js` | Saves both games for offline play after the first visit |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App and browser icons |
| `og.jpg` | The preview picture shown when the link is pasted into a chat or social app |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

If you rename the repository, update the site address in the `og:url`, `og:image` and `twitter:image` tags at the top of `index.html`.

**Testing Lumen Rush**

`npm install` once (it installs [Playwright](https://playwright.dev)), then `npm test`. It opens the game in a headless browser at phone size and checks the swing (the tether, Perfects, hits, rooftops, events, Flow, the dash, special anchors, the Heart of the Dark), the stages (finishing, stars, ghosts, the daily stage, bosses, districts, the halfway lantern, saving) and every screen (home, sheets, Today, settings, Back, backup and restore, old saves) at several phone sizes.

## Star Defender

A small arcade space shooter. Play it at https://erlan1126.github.io/Test/star-defender.html.

- **Move:** ← → or A / D (or drag on a touch screen)
- **Fire:** automatic
- **Pause:** P or Esc
- **Power-ups:** S spread shot · R rapid fire · O shield · + extra life

The game gets harder every 25 seconds, with faster spawns and new enemy types. Your best score is saved in the browser.

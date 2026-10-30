# Orbit Hop

A one-thumb space game for phones. Your comet circles a planet; tap to launch it off along its path and get caught by the next planet's pull. Climb as high as you can.

- **Hops are your score.** Each new planet you reach is one hop.
- **Perfect launches** (aimed straight at the next planet's center) build a combo, and each one pays a growing bonus: +1, +2, +3 and so on.
- **Stars** float between planets. Fly through them to collect them; they're saved between games.
- **It gets harder as you climb:** planets drift side to side from hop 8, asteroids cross your path from hop 14, and everything gets faster and farther apart.
- **You lose** if you fly off the screen, drift in space for too long, or hit an asteroid.

## Development

Built with [Phaser 3](https://phaser.io), TypeScript and Vite. Requires Node 18 or newer.

```bash
npm install
npm run dev        # play locally with hot reload
npm test           # unit tests for the game logic
npm run build      # type-check and build to dist/
npm run preview    # serve the built game
```

Add `?debug` to the URL to expose the running game scene as `window.__game` for testing.

## Project layout

| Path | What it is |
| --- | --- |
| `src/main.ts` | Creates the Phaser game and the shared services (save data, sound) |
| `src/logic/` | Game rules with no Phaser dependency: orbit math, level generation, seeded random numbers, save data |
| `src/scenes/BootScene.ts` | Draws every texture in code (planets, comet, stars, asteroids, sky), so there are no image files |
| `src/scenes/MenuScene.ts` | Title screen |
| `src/scenes/GameScene.ts` | The game itself |
| `src/scenes/GameOverScene.ts` | Results and the way back in |
| `src/audio.ts` | Sound effects synthesized with the Web Audio API |
| `tests/` | Vitest unit tests for `src/logic/` |

The game world is 720 × 1280. On screens with a different shape, the view expands to show more sky instead of adding black bars.

## Roadmap

- App store builds for iPhone and Android (with Capacitor)
- A shop for comet trails and skins, paid for with stars
- Daily challenge, missions and achievements
- Music

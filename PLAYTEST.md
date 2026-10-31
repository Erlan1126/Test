# Echo playtest checklist

A guide for testing Echo on real phones with friends. Scripts can check that every level can be finished, but only real players can tell whether it's fun, fair and clear.

## Before you start

1. Open **https://erlan1126.github.io/Test/echo.html** on the phone.
2. Add it to the home screen (iPhone: Share → Add to Home Screen; Android: menu → Install app or Add to Home screen) and open it from there. Sound and saving work best this way.
3. Turn the phone's silent switch off and the volume up.
4. To jump to any level: open **Settings**, tap the word **Settings** at the top five times, and switch on **Unlock all levels**.

Try to test on at least one iPhone and one Android phone, ideally including an older or cheaper one.

## Who to ask

- A young child (5–8). Use **Relaxed mode** for them too and compare.
- A teenager or adult who plays games often.
- Someone who rarely plays games.

Watch them play without explaining anything. Where they get confused is the most useful thing to write down.

## What to check

### First five minutes (levels 1–10)
- [ ] Do they understand "slide to swim" and the Sing button without help?
- [ ] Is it challenging by level 5? Too hard for younger players (try Relaxed mode)?
- [ ] Does swimming feel quick and easy? Does Lumi ever catch on walls?
- [ ] Is the music and sound pleasant? Too loud or too quiet?
- [ ] Do they understand the 3 stars on the results screen?

### Each new idea
Play the first level of each idea and note whether the picture card made it clear.

| Level | Idea | Check |
| --- | --- | --- |
| 3 | Light energy | Do they notice the bar and understand that lights refill it? |
| 5 | Thornlings | Do they hear the rattle and sing to spot them? Is dodging fun or frustrating? |
| 7 | Hushlings | Scary or fun? Fair? Can they escape? |
| 9 | Lost baby moths and long songs | Do they find the moth? Do they discover holding the Sing button? |
| 11 | Quiet caves | Is the song limit clear? Too strict? |
| 13 | Rune stones | Do they realise they have to sing close to the stones? |
| 15 | Dark caves | Too hard? Would they use Guiding glow? |
| 17 | Big caves | Does the scrolling feel smooth? |
| 19 | Races | Is the timer fair? Too tight or too loose? |
| 21 | Snapvines | Do they notice the shiver before the lunge? |
| 41 | Shardbats | Do they learn to sing, then move? |
| 61 | Cinder Crabs | Is crossing during the pause satisfying? |
| 81 | Frostwisps | Is being frozen fun or annoying? |
| 101 | Jellyglows | Easy to read when they'll pass? |

### Worlds and looks
- [ ] Does each world feel different (decorations, creatures, colours, music)?
- [ ] Does the cave look sharp up close on their phone, a second or two after a level starts?
- [ ] Do they ever see past the edge of a cave?

### Difficulty
For a handful of levels in each world (try 5, 15, 25, 50, 75, 120, 200, 400), write down:
- [ ] Did they finish? How many tries?
- [ ] Stars earned, and how many songs they used compared with the target
- [ ] Did their light ever run out? Did a race run out?
- [ ] Was it **too easy**, **about right** or **too hard**?

### Feel and polish
- [ ] Does the game ever stutter or slow down? On which phone?
- [ ] Does anything look broken: overlapping text, things off screen, flickering?
- [ ] Does the joystick size feel right? (Try Small, Medium and Large in Settings.)
- [ ] Is anything hard to read in bright light or for someone who wears glasses? Try High contrast.
- [ ] Close the game in the middle of a level and reopen it. Is progress kept?
- [ ] Copy the save code in Settings, erase progress, then restore it. Do the stars come back?

### Lighting and looks
- [ ] Does the rock look solid, with light falling on it from Lumi, crystals, lava and lanterns?
- [ ] Do any plants, spikes, icicles or mushrooms float in the air instead of sitting on rock?
- [ ] Do the creatures look like they belong in the cave (lit from Lumi's side, not like stickers)?
- [ ] If the game feels slow, turn off lighting in Settings. Does it get smoother?

### Daily cave and rewards
- [ ] Does today's cave card on the title screen make you want to play it? Is the twist clear?
- [ ] Are the daily quests fun, and is glow worth earning for Lumi's home?
- [ ] Share a daily result with a friend. Does their game show your score to beat?
- [ ] Play the daily cave on two different days. Does the streak count up?
- [ ] Do new looks and awards feel worth chasing?

## How to report a problem

For each issue, note:
- **Phone** (for example "iPhone 13, iOS 18" or "Samsung A12")
- **Level number** (shown at the top of the screen)
- **What happened**, and what they expected instead
- A **screenshot or screen recording** if possible

Then paste the notes into a chat with Claude so they can be fixed.

## Automated checks

Before each update, the automated tests check every level and the main features:

```
npm install
npm test            # about a minute
npm test -- --all   # the robot plays all 1,000 levels (about 5 minutes)
```

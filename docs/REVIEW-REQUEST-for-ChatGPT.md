Hi! Please do a full review of my mobile game **Skyrise** and tell me what to change.
You already know the game and you're connected to my GitHub.

**Where the code is:** repository `Erlan1126/Test`, branch `claude/skyrise-living-block`
(the newest work; `claude/new-session-klw8t6` is what the app builds use).
Please **read only** and **don't push to any branch**. If you want to suggest code, put it
in your answer (or open a pull request into `claude/skyrise-living-block` that I can review).

**What the game is now**
- You stack floors to build towers. Every tower's floors become office floors for
  "Skyhaven Inc.", a 3D business town on a floating island (Coffee Cart, Flower Kiosk,
  Bakery, Pizza Place, Cinema, Hotel, Mall, Airship Port, Starlight Stage, Space Port).
- Businesses earn money every few seconds; you buy levels, hire managers, grow each
  business through five stages by building its HQ tower, and start New Eras for Sky Gems.
- A small story: your first neighbor moves into your first tower, buys the first coffee,
  asks for a seat; your next tower opens a café terrace; then a flower market or playground.
- The town has shoppers walking into every shop, tappable customer reactions (tips),
  boats, seagulls, a kite, floating islets, day/night and weather shaders, and decorations
  you buy with Sky Crystals (yacht, Ferris wheel, balloon, statue, beach club, marina...).
- Screens: Shop (Town / Crystals / Towers / Deals), Company (business cards), an earnings
  panel (tap the money), Goals and a Sky Pass reward road, Me (profile, ranks, settings).
- Money: Sky Crystals (paid), a Sky Pass, VIP, starter pack, decorations, boosters.

**Recent changes to check especially**
1. The economy was rebalanced (src/data/tycoon.ts, src/logic/tycoon.ts): each business
   costs ~12× the last and earns ~5× more; ×2 speed at 10/25/50/100/150… levels; 25 free
   office floors plus 2 per tower floor; a ×2 grand opening for 20 minutes.
2. New screens: earnings panel, Sky Pass road, business cards with 3D building pictures.

**What I'd like from you**
1. Bugs, glitches or things that could crash or confuse a player (file and line if you can).
2. Is the economy fair and fun, like the best idle tycoon games? What would you change?
3. What still makes the town feel not alive enough? Your top 5 ideas, simplest first.
4. What would make players download it, stay hooked and buy things (without feeling
   pay-to-win)? Your top 5 ideas.
5. Anything that looks cheap or inconsistent in the menus.

Please keep it practical for a small team and explain simply.

# Growth and money plan

The short version: **Skyrise brings players in, the city game earns.** Each app shows a card
for the other, so players move between them.

## What the game already has
| Area | In the game now |
|---|---|
| Getting players | Daily tower (same tower for everyone), "beat my tower" links, Share with a picture/clip, weekly tournament, rankings, 5 languages |
| Bringing them back | Play streak with freezes, daily missions and chest, rewards calendar, reminders, Sky Pass |
| Money | Crystal packs, Starter Pack (once, after the 5th tower, 48 hours), VIP, Sky Pass, rewarded ads (ready, but no ad network yet) |
| Measuring | Anonymous stats to our own server (no personal data) |

## Added in this round
- **More measuring:** shop opened, purchase started / done / failed (per pack), first purchase,
  Starter Pack offered / shown, crystals spent (per item), ad watched / skipped (per place),
  share (per kind), challenge link opened, daily tower played.
- **The studio report:** one address that answers "do new players come back, and what do they buy?"
  (see below).
- **A second rewarded-ad spot:** "Watch an ad to double it" on the welcome-back card in the
  city (the strongest ad spot in idle games). Free for the player, counts toward the
  5-ads-a-day limit, and appears only when ads are set up.
- **Skyrise on its own:** `npm run build:skyrise` builds the tower game without the business
  city (no tycoon, no City Plan). `npm run build` still builds both together, as before.
  The stats say which app each install comes from.

## Ad and offer rules (checked)
- Rewarded ads only, always the player's choice, at most 5 a day. **No forced ads.** Keep it
  that way in the city game. In Skyrise, a rare between-runs ad plus a "Remove ads" purchase
  can come later, only if the numbers show it doesn't hurt day-1 returns.
- The Starter Pack appears once, after the 5th tower, never on the first launch.
- One pop-up at a time, never during a tower.
- Nothing sold makes you win: crystals buy speed, looks and comfort.

## What the studio needs to do (I can't do these for you)
1. **AdMob account** (Google, free): create one, add the two apps (iPhone and Android), and
   make one *rewarded* ad unit per app. Send me the app IDs and ad unit IDs. Then I'll add the
   ad plugin, so the two ad buttons start earning. Until then they stay hidden.
2. **Turn on the studio report:** in the `server` folder run
   `npx wrangler secret put STATS_KEY` and type a long password only you know, then
   `npx wrangler deploy`. To read the report:
   ```
   curl -H "x-stats-key: YOUR-PASSWORD" https://skyrise.erlanstudios.workers.dev/stats/report?days=30
   ```
   It shows how many new installs, the day-1 and day-7 return rates, how many installs
   reached each first-session step, purchases per pack (test purchases left out) and ads
   watched per spot.
3. **The split decisions** (see TWO_GAMES_PLAN.md): the city game's name and icon, whether
   crystals carry over, which app keeps the current listing.

## Targets for the soft launch (rough industry figures, not promises)
| Number | Good | Great |
|---|---|---|
| Come back the next day (day 1) | 35% | 45%+ |
| Come back after a week (day 7) | 10% | 18%+ |
| Players who ever buy something | 2% | 5%+ |

Start in a few countries (for example Canada, Australia, the Philippines). Fix the biggest
drop in the first-session steps first. Only pay for ads once day 1 is near the "good" line.

## Free ways to get players
- Post short clips often (TikTok, YouTube Shorts, Instagram Reels): a perfect-drop streak, a
  tower collapsing, the city growing. The game's Share button makes these.
- Store page: lead with the perfect-drop moment. Try 2–3 icons and screenshot sets with the
  stores' own A/B tests.
- Ask for a rating only after a good moment (the game already does this).
- Later languages with big casual audiences: Japanese, Korean, Turkish.

# Game Center setup (App Store Connect)

The game already signs players in to Game Center, posts their towers to two leaderboards
and reports every trophy as an achievement. App Store Connect just needs these created with
**exactly** these IDs (they're case-sensitive).

## 1. Turn it on

App Store Connect → Skyrise: Tower Stack → **iOS App Version** page → tick **Game Center**.

## 2. Leaderboards

Distribution ⌄ → **Game Center** → Leaderboards → **+** → **Classic Leaderboard**:

| Reference name | Leaderboard ID | Score format | Submission | Sort | Display name |
|---|---|---|---|---|---|
| Most people | skyrise.best_people | Integer | Best score | High to low | Most people |
| Tallest tower | skyrise.tallest_tower | Integer | Best score | High to low | Tallest tower |

For "Tallest tower", the score suffix (format) is ` m` (meters).

## 3. Achievements (26)

Game Center → Achievements → **+**. For each: Points 10 (any; 1000 max in total),
Hidden **No**, Achievable more than once **No**, and an English localization with the
title and description below. Each needs a 512×512 image (`launch/stores/gc-achievement.png`).

| Achievement ID | Title | Description |
|---|---|---|
| skyrise.trophy.first | Groundbreaker | Build your first tower |
| skyrise.trophy.f25 | Getting Tall | Build 40 floors in one tower |
| skyrise.trophy.f60 | Sky High | Build 100 floors in one tower |
| skyrise.trophy.liberty | Lady Liberty | Build taller than the Statue of Liberty |
| skyrise.trophy.eiffel | Parisian | Build taller than the Eiffel Tower |
| skyrise.trophy.burj | World Record | Build taller than the Burj Khalifa |
| skyrise.trophy.jeddah | Above the Clouds | Build taller than the Jeddah Tower |
| skyrise.trophy.s10 | In the Zone | Get a perfect streak of 15 |
| skyrise.trophy.s25 | Laser Focus | Get a perfect streak of 40 |
| skyrise.trophy.s60 | Untouchable | Get a perfect streak of 75 |
| skyrise.trophy.p1000 | Small Town | House 2,500 people in one tower |
| skyrise.trophy.p3000 | Big City | House 10,000 people in one tower |
| skyrise.trophy.gold3 | Golden Touch | Land 6 penthouses perfectly in one tower |
| skyrise.trophy.comeback | Second Wind | Build 25 floors after a rewind |
| skyrise.trophy.daily3 | Regular | Play the daily tower on 7 different days |
| skyrise.trophy.daily30 | Daily Devotee | Play the daily tower on 30 different days |
| skyrise.trophy.week | Dedicated | Claim the daily gift 14 days in a row |
| skyrise.trophy.zen50 | Inner Peace | Build 50 floors in one Zen tower |
| skyrise.trophy.skins6 | Collector | Unlock 10 tower skins |
| skyrise.trophy.challenger | Challenger | Complete 10 Journey stages |
| skyrise.trophy.towers25 | Busy Builder | Build 25 towers |
| skyrise.trophy.towers100 | Master Builder | Build 100 towers |
| skyrise.trophy.floors2000 | Skyline Maker | Build 2,000 floors in all |
| skyrise.trophy.perfect1000 | Perfectionist | Land 1,000 perfect drops in all |
| skyrise.trophy.level15 | Seasoned | Reach builder level 15 |
| skyrise.trophy.metropolis | Metropolis | Grow Skyhaven to 100,000 people |

## Buildaroo (the city game): 14 achievements

Same steps, in the **Buildaroo** app's App Store Connect page (Game Center → Achievements →
**+**). The game sends these IDs; they must match exactly. Points 10 each, Hidden **No**,
Achievable more than once **No**. The same trophies also show inside the game (Me ▸
Buildings), so Android players see them too.

| Achievement ID | Title | Description |
|---|---|---|
| buildaroo.first_sale | Open for Business | Sell your first coffee |
| buildaroo.manager | Delegator | Hire your first manager |
| buildaroo.named | Name on the Map | Give your city a name |
| buildaroo.hall3 | Town Hall | Reach City Hall level 3 |
| buildaroo.hall6 | Proper City | Reach City Hall level 6 |
| buildaroo.hall11 | Metropolis | Reach City Hall level 11 |
| buildaroo.homes10 | Neighbourhood | Build 10 homes |
| buildaroo.homes30 | Suburbia | Build 30 homes |
| buildaroo.skyscraper | Skyline | Grow a building to a skyscraper |
| buildaroo.million | Millionaire | Earn $1M in total |
| buildaroo.helper | Good Neighbour | Finish 5 neighbour requests |
| buildaroo.row | Collector | Find every design of one building level |
| buildaroo.book | Master Builder | Find all 50 building designs |
| buildaroo.holiday | Winter Lights | Win the giant holiday tree |

# Skyrise mobile game review

Reviewed November 19, 2026. Source snapshot [f6a00e4](https://github.com/Erlan1126/Test/commit/f6a00e4189fd4a16d3aecbe8b0700adf587c8b04), three commits ahead of the app-build branch at `0c559d5`. The rank system and earnings/card refinements are among those differences. Findings below refer to the review snapshot. I traced the UI handlers, save/load, town renderer and economy, ran the actual TypeScript economy and pass functions, and exercised two pacing scenarios. UI observations come from markup, styles and event paths. Native rendering, actual transactions, frame rates and player retention still need device testing. I did not run the whole app or the full test suite.

**First priority:** fix the full-office Build button, crystal warp quote and New Era rank loss. Then carry the first neighbor’s story one shop further. Watching someone use something you built is the clearest reason to build another tower.

## 1. Bugs and player-facing inconsistencies

| Priority | What happens | Change and acceptance check |
|---|---|---|
| High | **“Build more floors” can do nothing on the town card.** It sends a buy action from a button with class `floors`. The handler starts a tower only for `need-floors`, so a full company tries to buy zero levels and returns. The Company list uses the other class correctly. `src/ui/tycoon.ts:915, 952, 1567`, `src/logic/tycoon.ts:289`. | Give Build its own action. Fill all 25 initial offices across businesses, select a shop without a pending HQ and tap Build. Both card and list should take you straight to a tower. |
| High | **A crystal purchase advertises more cash than it delivers.** Earnings quotes the live rate, including the opening, rush and other short boosts. The warp credits the base managed rate. With level-one managed coffee during opening, I got a **$2,400 quote and $1,200 payout for 100 crystals**. The Boosts screen already uses the purchase rate. `src/ui/tycoon.ts:1789–1790, 1837–1843`, `src/logic/tycoon.ts:451–458`. | Use one quote function for both screens and the transaction. Check the amount credited by the warp separately from cash accrued during the tap. Also label hourly/day totals as projections at the current rate. The away estimate at `src/ui/tycoon.ts:1818–1821` currently extends expiring boosts through the entire vault window. |
| High | **A New Era takes away a “for good” town rank.** At 50 levels and $2M lifetime, the rules returned Village → one Sky Gem → Hamlet. Levels reset, taking the rank multiplier and rendered market with them. Previously seen rank notes stay dismissed. `src/logic/tycoon.ts:270–272, 414–429`, `src/app.ts:1785–1799`, `src/ui/tycoon.ts:1898–1909`. | Save the highest rank reached, including the bonus and landmarks. On migration use the higher of current rank and the highest recorded rank celebration. Check reset, reload and crossing 50 again. The market should survive and the bonus should apply exactly once. |
| High if legacy saves are in circulation | **Economy migration drops advisor ownership.** The version-mismatch path preserves built floors and the permanent booster, then returns a fresh company. Advisors can cost crystals. A player who owned one on an affected save can lose it while retaining the original debit. `src/logic/save.ts:564–571`, `src/logic/tycoon.ts:202–209`. | Check which distributed versions could contain both an older economy marker and advisors. Preserve recognized advisor IDs and unused earned picks where applicable. Test a real legacy fixture loaded twice before distributing a migration. |
| Medium | **Sky Pass promises a skin “now” at zero XP.** Buying premium succeeds, but claiming tier 1 returns null. Tier 1 takes 250 XP. The offer also pictures the final skin. `src/ui/daily.ts:220–231`, `src/data/pass.ts:7, 73–77`, `src/logic/pass.ts:54–64, 85–93`. | Show the first skin with “At tier 1 · 250 XP” and show the final skin separately as “Tier 30.” If an instant skin is intended, grant it at purchase and mark it claimed. Verify purchase at 0 XP and after reaching tier 1. |
| Medium | **Hiring the first manager from Earnings can leave the tutorial asking for a manager.** The normal hire path advances the tutorial to step 3. The Earnings shortcut hires directly and skips that update. `src/ui/tycoon.ts:161–165, 1555–1563`. | Route both buttons through one hire action. At the hire tutorial step, hire from Earnings, reopen Company, then reload. The manager should be working and the task complete. |
| Medium | **Offline and live payouts differ on an exact boost boundary.** I ran two managed three-second coffee cycles with opening ending at second six. One catch-up tick paid $4. Ticking at seconds three and six paid $3. The interval calculation prices the boundary cycle like the first cycle of its batch. `src/logic/tycoon.ts:330–339, 369–376`. | Partition finishes using the same expiry rule as the single-cycle function. Check one millisecond before, exactly at, and after expiry for opening, review and weekly festival changes. |
| Lower | **Buy quantity can hide an affordable new shop.** Selecting ×10 on an owned shop carries that setting to an unopened lot. “Open it” then quotes ten levels, and the quantity switch is visible only on owned lots. The reverse also happens near capacity, where “Buy ×10” can deliver fewer levels. `src/ui/tycoon.ts:905–926, 1568–1571`. | Open new shops at one level by default. For existing shops print the actual count and total, e.g. “Buy 3 · $84.” Test opening Flowers with $100, ten spare offices and ×10 previously selected. |

**Phone performance risk.** The Company thumbnails create another WebGL renderer, draw on the UI thread, export PNGs and decode them back to bytes. A thrown error sets a permanent failure flag for that session. The cache helps later visits. For ten businesses with five fixed stages, ship up to 50 pre-rendered images from the same models, plus the existing business icon as fallback. Time a cold Company open and scroll on an older Android phone and an iPhone with the town running. I did not reproduce a native crash. `src/render3d/thumbs.ts:32–80`, `src/ui/tycoon.ts:1323–1327, 1360`.

## 2. Economy and progression

**Keep the opening structure.** The 25-office allowance, two offices per built floor, visible speed milestones and 20-minute opening bonus give stacking a job. The starter coffee occupies one office, leaving 24 to fill. Village needs 50 total levels, so at least 13 built floors are required even with unlimited cash. Tell the player exactly what one more tower buys: “8 floors built · 16 offices added.” Show both the capacity and cash requirement for the next visible town change.

**The stated 12× cost curve ends at Cinema.** Hotel costs 23.5× Cinema, followed by roughly 30×, 33×, 37.5× and 40× jumps. First-level cash per second rises much more slowly. Base cycle time also doubles at every new business. These are direct calculations from `src/data/tycoon.ts:25–39`.

| Business | Opening price | First sale without speed milestones | Base level-one income/sec |
|---|---:|---:|---:|
| Coffee | $10 (starts owned) | 3 s | $0.33 |
| Bakery | $1,200 | 12 s | $9.17 |
| Cinema | $170,000 | 48 s | $187.50 |
| Hotel | $4M | 96 s | $833 |
| Mall | $120M | 3 min 12 s | $3,646 |
| Space Port | $6T | 25 min 36 s | $292,969 |

Space Port’s level-one price divided by its own unboosted income is about 237 days. **That is a payback ratio, not an unlock-time estimate.** Earlier shops, towers, levels and multipliers fund the purchase. The design problem is that the first launch can take longer than the entire grand opening. Give each newly opened shop a one-time first sale or service animation within five seconds, then show its normal schedule. Keep managers valuable for repeat sales.

### What the simulation actually did

| Scenario | Day 1 | Day 7 | Day 14 |
|---|---|---|---|
| Repository pace scenario | Hotel Lv 6, $1.23M/s | Space Port Lv 18, $4.04B/s | Space Port Lv 38, $9.14B/s |
| Short-session sensitivity check | Bakery Lv 4, $527/s | Hotel Lv 1, $925K/s | Mall Lv 17, $30.1M/s |

I executed the repository pacing test body with a lightweight local assertion harness. Its buyer shops every ten seconds, starts every available manual business each second, builds six 25-floor towers per day and passes height 999 to the HQ function. The shorter variant used two four-minute sessions, one eight-floor tower per session, 400 added population per tower, manual coffee attempts every five seconds, and eight-floor HQ attempts. Both used the same purchasing heuristic and offline logic. Neither spent crystals, started an Era or invoked the opening bonus. These are modeled outcomes, not observed players. `tests/tycoon-pace.test.ts:6–56`.

**What I would tune first**

1. **Improve the first sale before cutting prices.** Record when free players see the first neighbor, hire the first manager, reach the terrace and open Flowers. Each should have a visible payoff. The first two shops are the best place to learn whether players understand the loop.
2. **Give short-tower players a route through HQs.** Stage requirements are 15, 30, 50 and 80 floors. Keep a single skilled tower as the fastest route. Try one early HQ contract that accepts two shorter towers and compare completion. Keep the next milestone and the HQ objective distinct on the card.
3. **Make the first Era an informed decision.** $2M lifetime can buy one gem worth +2%. Show “Gain 1 Sky Gem · +2% permanent income,” what resets, what stays, and the next gem threshold. Give the first Era a visible keepsake on the island. Test acceptance and return after reset before raising the reward.
4. **Make the pacing tests assert the milestone dates in their comments.** The current test describes Space Port starting in week two, yet passes with level 18 on day seven. Assert first-open timestamps across two or three play styles and track time blocked by cash versus full offices. Tune the specific bottleneck those runs and playtests identify.

## 3. Five ways to make Skyhaven feel alive, simplest first

The café already has a moving truck, reserved queue slots, occupied seats and a recognizable neighbor. Elsewhere up to 18 shoppers pick businesses by stage, visit a door, take a colored bag and disappear along the sidewalk. The repeated ending makes a cinema, flower kiosk and bakery read like the same shop. Build on the café’s behavior. `src/render3d/block.ts:88–103, 306–358`, `src/render3d/bizcity.ts:1182–1246`.

1. **Give three shops a readable purchase.** Flowers gets a bouquet, Bakery gets a bread sleeve, Cinema gets a ticket on entry and a pair chatting on exit. Swap one prop or pose on the existing shopper. Check that a muted clip makes each business recognizable.
2. **Give each opening a witness.** When a business opens, have two nearby shoppers turn, one walk in and one leave with its signature item. Reserve the doorway as the café does. Keep control with the player and allow the celebration to finish while they continue.
3. **Give the first neighbor a second destination.** After the flower project, have the same resident carry flowers back to their terrace table. Leave the vase there between visits. One persistent prop makes a previous choice legible the next day.
4. **Give the tram two working stops.** At Town rank, use two fixed stops and two existing walkers. Pick them up at the homes, drop them near Cinema or the market, then send them to a destination. This gives the player a reason to follow the tram.
5. **Let a resident request change a block’s routine.** Start with one request after the terrace, e.g. the baker needs a delivery stop. Completing an HQ order adds a marked bay, a recurring morning delivery and a baker who comes outside. One authored request is enough for the first release.

## 4. Five ideas for downloads, retention and purchases

| Goal | Small-team experiment | How to judge it |
|---|---|---|
| 1. Earn the download | Make a six-second store preview from real play: perfect drop → first neighbor moves in → the same neighbor buys coffee. End on “Who moves into your next tower?” Pair it with one screenshot showing the tower and terrace together. | Compare store-page-to-install conversion against the current preview while keeping other artwork fixed. |
| 2. Earn a second tower | End tower one on the neighbor looking at the folded chairs. Put “Build the café terrace · 6 floors” on the main button, reflecting remaining floors. When it opens, show the neighbor take the first seat. | Track tower-one finish → second tower start → terrace used. Watch five new players do it without coaching. |
| 3. Give returning players a destination | Add one line to the existing earnings recap: “The terrace is ready” or “Your bakery can hire its first manager.” Tap it to visit the exact lot. Use actual saved state. | Track return → visit → meaningful action, plus next-day and seventh-day return. |
| 4. Sell a town look people can preview | Start with one evening waterfront set. Let players preview it at night in their own town. Let earned cash build the working pier and crystals buy the lanterns, awnings or boat finish. Paid and free appearances of the same amenity should earn equally. Preserve already purchased benefits. | Measure preview-to-purchase and check free-player time to the next district. Existing decor adds 3% per recognized item, so purchased appearance currently carries income value. `src/data/decor.ts:16–19`, `src/logic/decor.ts:22–25`. |
| 5. Give the Pass a visible theme | Put one distinctive seasonal façade or tram livery in the free lane and a coordinated matching district set in premium. Preview both on the island. Lead with what players keep. Leave VIP, the starter pack and time skips out of the first-neighbor sequence. | Track free claims, premium previews, purchases and return after season change. Keep the existing rollover grant for earned, unclaimed rewards. |

## 5. Menu polish

- **Company.** Make the 3D building portrait the hero. The room currently layers a sign, floor medal, stage dots, stars, props, walkers and several possible event tags. Keep the building, a plain level, income and one primary action visible. Show one timely badge such as “HQ ready.” Put the rest behind details. Use “Business level,” “Office space” and “Tower floors” consistently. `src/ui/tycoon.ts:1339–1375`.
- **Earnings.** Lead with “Managers earn $X/sec.” At zero managers say “Your coffee earns $X each time you serve it.” Manual shops currently get at least a 3% filled earnings bar even when their contribution is zero. Draw it empty. Show the next free improvement before a paid warp. Retain the per-shop breakdown for players who want it. `src/ui/tycoon.ts:1765–1792`.
- **Sky Pass.** Render Free → tier → Premium in the actual document order. The markup appends Premium first and CSS visually reverses it, giving keyboard and assistive-tech users a different sequence. On open, prefer a claimable row, then explicitly select the next row. The combined selector currently encounters the current tier first. Preserve sticky lane headings and Claim All. `src/ui/daily.ts:198–200, 246–284`, `src/styles.css:3651–3658`.
- **Me and Shop.** Use the existing drawn icon set consistently for navigation and currency. Me mixes platform emoji with custom SVG; the shop subtitle calls its currency “gems” while Sky Gems are the New Era reward. Name the paid currency **Sky Crystals**, reserve **Sky Gems** for Eras, and rename competitive “Ranks” to **Leaderboard** so **Town Rank** can mean one thing. `src/ui/tycoon.ts:1152–1167, 1800–1803, 1880`.
- **Small-screen check.** On the smallest supported iPhone and a mid-range Android, open Company cold, scroll the Pass, switch to Spanish, background/resume during opening, and buy an upgrade beside the bottom safe area. Check clipped text, double taps, focused buttons after refresh, and lost building images. These are device checks, not observed failures.

## Suggested order for the next build

1. Fix purchase quotes, tier-zero Pass wording, full-office routing, permanent town rank and the alternate manager-hire path. Check legacy entitlements before releasing any economy migration.
2. Add the first-sale animation for Flowers and the bouquet callback. Simplify that one Company card first, then apply the same layout to the other nine.
3. Put the build in front of five new players. Without prompting, can they build the terrace, tell what their tower earned, and point to something their neighbor now does? Measure those actions before commissioning another district or rebalancing every shop.

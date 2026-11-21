# ChatGPT Round 6 — Make Skyrise unforgettable, returnable, and shareable

**Scope:** Design/implementation recommendations only. Target: `claude/skyrise-living-block`. No game code changes.  
**North star:** **Grow Skyhaven from one neighbor into the Capital of the Sky.**

## Executive decision

**Positioning:** *“You don't just stack towers. You build a city that remembers you.”*

Do not sell Skyrise as an idle tycoon with more currencies. The differentiator is **a skill-based tower drop that permanently changes a tiny inhabited 3D world, whose original neighbor notices and remembers those changes**. A tower is not merely a score: it adds office capacity, supports businesses, brings people, and eventually changes the island's silhouette and the neighbor's life. Make this chain unmistakable in the first 60 seconds and in every share asset.

This is a proposed distinctive combination, **not a verified claim that no competing game offers it**. Market validation requires competitor playtests.

### Evidence from the branch

- `docs/PURPOSE-PLAN.md`: town rank is the core narrative, money is a means, and the neighbor, café terrace, flower market and playground are the emotional highlights. It explicitly warns about competing progress systems.
- `src/data/ranks.ts`: seven rank states (Hamlet, Village, Town, City, Big City, Metropolis, Sky Capital) with thresholds **0/50/150/300/500/800/1200** total business levels; each adds a visible landmark. Rank remains through a New Era per the purpose plan.
- `src/data/chapters.ts`: Mayor Pip's six rank-aligned chapters already connect towers, neighborhood projects, managers and business growth to the story.
- `src/ui/tycoon.ts`: the first-neighbor story, speech lines by rank, camera landmark visits, scrapbook, city UI, VIP/golden customers, daily activity and Community Spire are existing foundations.
- `src/render3d/bizcity.ts`: visible town landmarks, tram and passengers, parks, plaza, street furniture, airships, annex, sky tram, island environment and day/night effects already support cinematic moments.
- `src/app.ts`: `makeShareImage`, native sharing, existing challenge links and ghost racing, daily seeds, video camera flight, save/persistence and 3D/2D fallbacks provide reusable plumbing.
- `src/data/challenges.ts`: seeded fixed-rule Skyline Journey levels; `src/data/events.ts`: rotating weekly modifiers; `src/data/daily.ts`: streak, rent, weekly league and chest systems. **Do not add a parallel daily currency or another daily checklist.**
- `src/data/tycoon.ts`: 10 businesses with five visual growth stages and office/HQ requirements. Their visual evolution is more emotionally valuable than their giant coin totals.

**Important branch timing:** the guided first loop, “Why?” explanations, units, before/after scrapbook, expanded island, updated people/buildings/bars and performance improvements are being built concurrently. Treat those as **in progress**, not as proven shipped features. Integrate with them; don't duplicate their work.

## 1. What is genuinely distinctive? Make it the hero

### The three-part identity

1. **Stacking has consequences.** The tower the player physically builds becomes capacity and change in a persistent, visible town. After a run, show **tower → new floors → active business → visible person/landmark**, not merely a score.
2. **One neighbor becomes a witness.** The original resident is the through-line from a quiet meadow to the Sky Capital. Their terrace, flower vase, market visit and tram ride are tangible consequences, not anonymous quest rewards.
3. **The city has an autobiography.** The scrapbook, fixed town landmarks and rank camera visits can show “this is how my place changed.” This is stronger than generic idle progression because it is visually understandable without knowing the game's economy.

**Hero screen:** show the town, neighbor, and a single next visible transformation. Copy: **“One neighbor. One tower. A whole sky city.”** Secondary line: **“Build a tower. Watch Skyhaven come alive.”** Primary CTA: **“Build for Skyhaven.”** The player should see their first neighbor respond before being asked to understand managers, crystals, passes or eras.

**60-second hero proof:** drop floors → finish tower → fly to the block → neighbor arrives or reacts → café/cart starts serving → a permanent visual change appears → the game says “You built this.” Avoid interrupting this sequence with a bundle of reward modals.

**Brand guardrail:** don't claim exclusive ownership of stacker + city-building without competitor research. The defendable brand is the **specific cause-and-effect story**.

## 2. Top five daily-return hooks (ranked)

| Priority | Hook and player-facing moment | Smallest buildable implementation | Return trigger / guardrail |
|---|---|---|---|
| **1** | **“A note from your neighbor.”** On first daily visit, neighbor says one line tied to the newest permanent town change: “I rode the tram today!” Camera briefly shows that change. | Derive event from saved rank, terrace, projects, decor and a `lastSeenTownEvent` marker. Extend existing welcome-back flow in `src/ui/tycoon.ts`; reuse `visitLandmark` and neighbor speech. Start with 6–10 authored lines. | Once per local day **only if something meaningful changed**; otherwise a short ordinary greeting. No fake emergencies or guilt. |
| **2** | **“Tomorrow's little miracle.”** Town card previews the **next visible landmark**, with progress in business levels and one suggested action. | Reuse `RANKS`, `townRank`, chapter goals and the existing next-action card. Show a ghost/thumbnail of the upcoming market/tram/airship; do not create another quest track. | Player returns to finish a visible transformation. Never advertise a reward that cannot be reached with available actions. |
| **3** | **“Skyhaven at golden hour.”** One brief daily postcard: city at dawn, dusk or festival light, with one resident doing something distinctive. | Use existing day/night effects in `bizcity.ts` and a deterministic daily cosmetic scene seed. Render the postcard on demand, not a heavy continuous event. | New scene to admire/capture; no mechanical penalty for missing a day. Keep animation optional on low-end devices. |
| **4** | **“The same sky, one new challenge.”** One seeded Daily tower, with a clear friend-beatable score and a town-themed title (“Build the Tram Stop Tower”). | Reuse `dailySeed`, `src/data/challenges.ts`, `src/data/events.ts`, existing challenge/ghost plumbing in `src/app.ts`. Surface only one daily challenge prominently; rewards stay in existing stars/crystals. | Fresh fair skill test. Daily seed must be consistent across devices and independent of locale/time-zone ambiguity. |
| **5** | **“The town worked while you were away.”** Welcome back shows **one physical result** (a line at the bakery, a busy tram, a growing storefront) alongside cash and a single next action. | Extend existing offline-earnings summary in `tycoon.ts`; map earned business to a camera target and existing customer/stage visuals. Do **not** simulate permanent upgrades or residents that did not actually occur offline. | Satisfaction from returning without making the player feel punished for taking a break. |

**Why this order:** 1–3 reinforce identity; 4 supplies repeatable mastery; 5 gives idle satisfaction. The existing streak, rent, chest and weekly league can remain secondary, but should not all demand attention on arrival.

**First-week cadence:** Day 1 = neighbor arrives; Day 2 = neighbor remembers a change; Day 3 = first personal before/after; Days 4–6 = daily tower + next visible rank; Day 7 = a recap postcard of real progress. This is a presentation plan, not seven new reward systems.

## 3. Top five viral/share formats (ranked)

**Rule for every share:** the picture must be legible to someone who has never played. Include the city or tower, a **human-scale emotional detail**, a very short caption, a tasteful “Skyrise” mark and an optional working deep link. Share is opt-in; never auto-post.

### 1. “I started with one neighbor” — city transformation postcard

**Exact image:** split composition. Left: the starter tower and tiny café/neighbor on the early meadow. Right: the player's **actual** present-day 3D city, with its tram, skyline and islands as unlocked. Center: a subtle “THEN → NOW”; bottom: “Skyhaven • Hamlet → [actual rank]”. If still at Hamlet, show the real first/most recent build rather than pretending the player reached Village.

**Clip:** 7–12 seconds: fixed camera starts on the saved early scene, a wipe reveals successive saved milestones, and ends with the current town lit at dusk. Overlay “It started with one neighbor.” The 3D scene must match the player's save.

**Build:** use the in-progress scrapbook before/after data, `makeShareImage` and existing camera positioning. Store milestone snapshots or minimal scene-state descriptors; do not invent historic states. Fallback: still card.

**Why share:** a striking, instantly comprehensible transformation.

### 2. “Can you beat my impossible tower?” — friend challenge

**Exact image:** player's crooked, unusually tall tower, top 3/4 visible; bold “I reached **[actual] m**”; small “Can you beat it?”; QR/deep-link caption. For clip: 4–8 seconds of the final three dramatic drops and a final freeze-frame showing height and friend-challenge code.

**Build:** extend the existing `createChallenge`, `challengeIdFrom`, `fetchChallenge` and ghost racing in `src/app.ts`; use existing share-image and native-share functions. Challenge URLs must restore the same seed/rules and not trust user-submitted scores without validation.

**Why share:** a concrete dare, not a generic “play my game” link.

### 3. “The neighbor noticed” — tiny emotional story

**Exact image:** zoomed café terrace: the recognizable original neighbor carrying flowers or sitting beside the permanent vase, with the newly opened market in the background. Caption: **“I built her a flower market. She brought flowers home.”** Clip: market purchase → walk home → vase appears, 6–10 seconds.

**Build:** capture existing café-block state and scripted route; preserve the real story milestone. Add a one-tap “Save this moment” action after the scene; avoid an unrelated reward pop-up.

**Why share:** character and cause-and-effect are understandable outside the genre.

### 4. “Our cities, same challenge” — side-by-side result

**Exact image:** two vertically aligned tower silhouettes against the same sky, labeled “ME” and “FRIEND”, with heights in **m**, perfect-drop counts and the same seed/rules. The winning result gets a restrained crown; no shaming message. If friend data is unavailable, show a solo challenge invite rather than fabricated rival data.

**Build:** reuse daily challenge seed, challenge attempt fetch/post, existing ghost data and share canvas. A URL opens the challenge directly with a clear replay CTA. Define a server-verified result schema and rate-limit submissions.

**Why share:** friendly rivalry and a clear reason to click.

### 5. “Sky Capital coronation” — final rank spectacle

**Exact image:** wide island shot at twilight: the golden Skyhaven Tower, lit tram and streets, airships overhead, the first neighbor in the foreground, with “**FROM ONE NEIGHBOR TO SKY CAPITAL**” and the player's real time-to-capital if reliably recorded. Clip: camera rises from the neighbor's terrace past the busy city to the golden tower; 8–15 seconds, vertical-safe composition.

**Build:** trigger once when `townRank` first reaches index 6; reuse `visitLandmark`, rank scene elements, confetti/fireworks and share infrastructure. Let players replay the cinematic from the scrapbook. Do not force a share before the ending resolves.

**Why share:** a finish line that feels earned and visually spectacular.

### Distribution implementation notes

- Share sheet first; clipboard/download fallback; use native sharing when available. Offer 9:16 vertical clip framing and 1:1 still cards.
- Put a single, optional **“Show a friend”** button after the emotional payoff, never before.
- Deep links should use the existing public origin/share URL logic, preserve the incoming challenge token, and work after install/open.
- Do not place untrusted player text into HTML/canvas without escaping. Validate challenge IDs and URLs; no hidden personal identifiers in screenshots.
- Avoid promising downloadable video on devices where encoding is unsupported. Start with still cards, then short clips after performance profiling.

## 4. Signature feature: **SKYHAVEN REMEMBERS**

### The promise

**“Watch your little floating island become a capital — and watch your first neighbor grow with it.”**

A personal, replayable **City Memory Film** assembled from the player's *real* city milestones, with a consistent camera and the original neighbor as the visual anchor. It is both a long-term collection mechanic and the source of Skyrise's most compelling share clips.

### Minimum viable version

**Entry points:** a “Memories” button in the scrapbook; a gentle prompt on reaching a new rank; a replay option on Sky Capital completion. **Never** require posting.

**Memory events:** first neighbor arrives; café/terrace opens; flower market/project completes; each first-time rank increase; major HQ/stage upgrades when visually meaningful; final Sky Capital coronation. Keep a bounded event list (e.g. max 40–60) and deduplicate by stable event ID.

**Proposed saved shape** (adapt to the actual save schema and migration conventions):

```ts
type CityMemory = {
  id: string;                  // e.g. "rank:2", "project:flowers"
  at: number;                  // timestamp captured at real unlock
  kind: "neighbor" | "project" | "rank" | "business" | "capital";
  rank: number;                // rank at capture
  titleKey: string;            // localized display key
  scene: {
    rank: number;
    decor: string[];           // only unlocked decor
    projects: string[];        // only completed projects
    businessStages: Record<string, number>;
    annex?: string[];
    neighborBeat?: string;
  };
};
```

**Critical invariant:** a historical frame cannot show anything unlocked *after* its event. The current `buildBizCity` takes town rank, lots and café state; derive a minimal, versioned, serializable scene snapshot and reconstruct it for the memory viewer. For old saves without history, label the earliest reconstructed scene **“Recreated from your current progress”**; do not claim to have exact past footage. Preserve save compatibility with a migration.

**Playback:** fixed 3/4 camera framing and predictable positions across scenes. 0–2 s: earliest true snapshot, with original neighbor and starter tower. 2–8 s: 2–4 milestone transitions (market, tram, skyline, etc.), each with a small caption. 8–12 s: current town, neighbor reaction, city name/rank, tasteful game logo. For very early players, use just 2 frames and a 5-second version. Provide **Replay / Save image / Share**.

**Rendering plan:**
1. Add a pure `makeCityMemoryEvent(save, trigger)` helper, called **after successful persistence-worthy unlocks**, never per frame.
2. Add `memories` to `SaveData` with migration/defaults, stable IDs and bounded storage. Capture only structured state first; screenshots are expensive and brittle.
3. Extend the existing scrapbook UI with a timeline and a memory viewer. Use `buildBizCity` with a temporary snapshot scene or a dedicated low-cost render target; **do not mutate live game state** during replay.
4. Reuse `src/app.ts` sharing functions and `src/render/previews.ts` for static postcards. Introduce a clip exporter only after still-card sharing works reliably.
5. Reuse the rank landmark camera path and neighbor animation beats. For 2D/low-power mode, render still panels with crossfades instead of requiring full 3D video capture.
6. Guard WebGL context loss, cap render size/frame rate, stop/release temporary scenes on close, and keep the city responsive during export.
7. Localize text and include units; captions must never cover the neighbor or the skyline.

**Acceptance tests:**
- Fresh save → first neighbor → memory exists and matches the actual starter town.
- Village and Town unlocked → correct market/tram appear only in eligible memory frames.
- Reload/save migration → memories survive and do not duplicate.
- New Era → historical rank and unlocked permanent features remain correct.
- Existing older save → safe reconstructed fallback clearly labeled.
- Low-end/2D mode → postcard works without WebGL video.
- Share cancel/offline/unsupported API → game continues, no data loss.
- Memory replay never grants currency, unlocks, changes time, or mutates gameplay state.

**Success measure:** players voluntarily open memories, finish watching, share them, and bring friends back via challenge links. Instrument privacy-conscious events `memory_open`, `memory_complete`, `memory_share_tap`, `share_success_if_observable`, `challenge_link_open`, `friend_attempt`. Do not count tapping Share as a completed share.

### Suggested build slices

- **Slice A (small):** one real before/after **static** postcard, save/replay/share.
- **Slice B (medium):** 3–5 saved milestone states, timeline, deterministic camera.
- **Slice C (large):** 9:16 cinematic clip export and deep-link share cards.

Do not begin Slice C until the 3D city meets the lag/performance goals Claude is already working on.

## 5. What to cut or simplify

1. **Collapse visible progress to one north star.** Rank and next visible landmark are primary. Mayor Pip chapters explain the same rank; builder XP, Skyline Journey, weekly league, missions and Sky Pass move to secondary surfaces. Don't remove existing earned progress.
2. **One daily invitation, not five daily alarms.** The existing streak, chest, rent, golden customer, daily tower and weekly event are plenty. Show one “Today in Skyhaven” card with at most two optional actions; never stack welcome-back modals.
3. **Stop leading with economy math.** Cash, gems, crystals, boosts, managers, upgrades and New Era can remain, but foreground **what they build in town**. “Hire manager → bakery stays busy” beats “×1.5 income.” Keep exact math in the new “Why?” explanations.
4. **Defer more shops/islands/currencies.** Ten businesses, five stages, seven ranks, annex and island themes already offer enough scope. Prioritize personality, clear consequences and performance over adding another region or resource.
5. **Avoid expensive always-on spectacle.** No constant confetti, dense crowds or cinematic capture during ordinary play. Use a short scripted landmark moment, a lightweight postcard render and adaptive quality. Do not let viral effects worsen frame rate.

**Also cut:** nagging streak-loss copy, artificial “your neighbor needs you now” distress, forced referrals, fake friend activity, unverifiable leaderboards and pay-to-win challenge modifiers. They erode the emotional trust this game needs.

## 6. Practical priority and measurement

| Release | Ship | Why / metric |
|---|---|---|
| **P0** | Finish Claude's first-loop clarity/performance work; hero copy and one clear next visible change | Test 5 fresh players: can they explain “build towers to grow Skyhaven” without coaching? |
| **P1** | Neighbor daily note + accurate first before/after share card | Track day-1/day-7 return cohorts and share-card completion |
| **P2** | Seeded friend challenge deep link + side-by-side share card | Track link open → challenge start → completed attempt; protect fair play |
| **P3** | Memory timeline and milestone postcards | Track voluntary replay, memory completion and saves/shares |
| **P4** | Cinematic export and Sky Capital finale | Track actual successful exports and new players referred, not impressions alone |

**Experiment design:** establish a baseline before shipping; compare matched cohorts (or randomized exposure where practical) for D1/D7 retention, first-tower completion, first-rank completion, share-intent-to-share-success and challenge-link conversion. Report device/performance segments; a beautiful feature that increases crashes is a loss. Do not invent target uplift percentages without baseline data.

**Concrete 5-person usability test:** ask each player (1) What are you trying to grow? (2) What did the last tower change? (3) What do you want to see next? (4) Which moment would you show a friend? Watch actions before explaining anything. If answers center on coins, the hero loop still isn't visible enough.

## Final recommendation

**Ship the emotional postcard before the viral video.** One truthful, gorgeous “Then → Now” card and one lovable neighbor moment are cheaper, easier to test, and more aligned with the game's purpose than a new social system. Then make those moments repeatable through **Skyhaven Remembers**.

**The product promise is not “build the tallest tower.” It is “look what your tower made possible.”**

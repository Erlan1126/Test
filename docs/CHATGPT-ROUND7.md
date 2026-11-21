# Skyrise — ChatGPT Round 7: audit and immediate improvements

**Review target:** `Erlan1126/Test`, `claude/skyrise-living-block` (21 November 2026).  
**Scope:** Read-only assessment; no game source changed. The friend-versus-friend challenge card is being developed concurrently and is not presumed complete.  
**Evidence standard:** Distinguish demonstrable code-path problems from performance risks and UX proposals. Line numbers refer to the reviewed branch and may shift as Claude commits.

## 1. Bugs / correctness findings

### B1 — Memory share generation rejects rather than failing gracefully (confirmed)
**`src/ui/memories.ts:34–43, 68`**. `thenNowCard()` awaits `Promise.all([loadImg(then.img), loadImg(nowImg)])`; `loadImg` rejects on `Image.onerror`. A corrupted/unsupported historical data URL, or failed current screenshot, rejects the entire async operation despite the function's `Promise<Blob | null>` contract. The caller cannot count on a `null` failure result. **Fix:** wrap image decoding and canvas export in `try/catch`, return `null`, and show a non-blocking “Couldn't make this card” toast at the call site. Test with a valid-looking but undecodable `data:image/png;base64,...` value.

### B2 — “Once a day” neighbor note can be consumed without being shown (confirmed)
**`src/ui/tycoon.ts:734–755`**. `neighborNote()` writes `skyrise.neighbor.v1` at line 743 **before** the note is delivered in a delayed callback at line 753. If the player leaves the city, backgrounds the app, or opens an interrupting screen during the 700 ms delay, the day's note is already marked as delivered. **Fix:** set the day marker when the line is actually displayed; re-check `inCity`/modal state in the callback, or keep a pending note to deliver at the next safe moment. Persist the signature together with successful display, not scheduling.

### B3 — Clock changes can show a negative business progress bar (confirmed edge case)
**`src/logic/tycoon.ts:319–324`**, with UI consumers **`src/ui/tycoon.ts:666–696`**. `progressOf` computes `((now - start) % c) / c`; JavaScript's remainder is negative if `now < start`. The economy's `tick` repairs a future start when it runs (`src/logic/tycoon.ts:362–368`), but `progressOf` itself has no guard and is a public function. **Fix:** return 0 when `now <= start`, clamp the result to [0,1), and add a test for the clock moving backwards. This is a transient edge case, not evidence of lost earnings.

### B4 — Progress UI can miss multiple sales between frames (confirmed visual limitation, not lost coins)
**`src/ui/tycoon.ts:666–689`**. Sale effects are inferred from `p < was - 0.05` and gated to one pop per 450 ms. For short business cycles or a stalled/backgrounded frame, several completed cycles can be paid by `tick()` but yield zero or one visual sale. **Fix:** drive effects from a bounded count of completed cycles or the `tick` payout delta, aggregate into one labeled “+N sales” pop; keep the economy unchanged. Treat as a feedback defect, not a currency defect.

**Not asserted as bugs:** No runtime, device, build, or automated test execution was possible in this review. Do not classify untested concerns as production failures. In particular, the economy's offline-cap calculation and the Three.js disposal logic need targeted tests/profiling before changing their behavior.

## 2. Mobile performance: highest-value cuts and caches

1. **Throttle expensive 3D city work.** `src/render3d/renderer3d.ts:845–861` conditionally rebuilds the whole business city by calling `buildBizCity`, disposing the previous tree. The equality guards are good; keep them. Verify callers reuse the same `lots` and `bizCafe` references for unchanged state. Build a stable semantic scene key once per actual business/cafe mutation instead of recomputing JSON strings or rebuilding objects in hot paths. Do not rebuild scenery for coin counter changes.
2. **Reduce geometry/material count on phones.** `src/render3d/bizcity.ts:251–429` and following city-detail construction instantiate many separate meshes/geometries for roads, windows, trees, props and furniture. Merge static geometry by material or use `InstancedMesh` for repeated props; remove distant tiny props at low quality. Measure draw calls and triangle counts before/after.
3. **Limit postprocessing and pixel cost.** `src/render3d/renderer3d.ts:223–264` initializes antialiasing, half-float multisampled render target and bloom. On low-end/mobile GPUs, disable bloom and MSAA at low quality, cap device pixel ratio (e.g. 1–1.5), and use the existing adaptive render-scale mechanism rather than silently rendering at full device resolution.
4. **Stop unnecessary DOM work.** `src/ui/tycoon.ts:652–701` updates coin counters every animation frame and queries progress elements for each owned business, then refreshes the broader UI every ~300 ms. Cache business row/tag references until their containers are replaced; update counters only when formatted text changes; update progress CSS at 10–15 Hz on phones. Preserve the fast drop input/render loop.
5. **Pause idle work when hidden.** `src/ui/tycoon.ts:247` runs a 1-second interval; `src/app.ts:342–345` runs a 20-second interval. Make the interval callbacks cheap/no-op while hidden or outside the relevant screen. Existing visibility handlers already help with economic catch-up; avoid duplicate saves.
6. **Budget scrapbook memory.** `src/ui/memories.ts:11–31` reads and reserializes every rank's data-URL image into one localStorage object for each new snapshot. Store compressed thumbnails (e.g. 480–720 px JPEG/WebP), avoid repeated decoding, and consider IndexedDB for larger pictures. Keep the backup save free of image data, as intended.
7. **Dispose safely, not indiscriminately.** `src/render3d/renderer3d.ts:1465–1480` disposes geometries/materials while traversing groups. Confirm shared geometry/material ownership before changing this; disposing a shared asset from one group can break another. Use explicit ownership flags or a ref-counted cache.

**Suggested measurement:** Test cold load, 60 seconds in Skyhaven, first tower, and return-to-city on a budget Android device. Record median/95th-percentile frame time, draw calls, GPU memory where available, heap delta after 10 scene rebuilds, and battery/thermal behavior. Target stable 30 FPS on low-end phones before adding more street decoration.

## 3. Five small changes that improve play *today* (priority order)

1. **One clear next action, one tap.** The `tcy-next` button already exists (`index.html` / `src/ui/tycoon.ts`). Make its copy action-specific: “Tap Coffee Cart to sell,” “Hire your first manager — 120 coins,” or “Build 3 floors to unlock the next shop.” When a step is unaffordable, show the exact missing amount and a useful alternative. No new screen.
2. **Make each sale feel earned.** Add a short aggregated “+coins / +N sales” pop anchored to the building, with one subtle sound/haptic per burst, not per cycle. Fix B4 first. This makes automation feel alive without increasing simulation frequency.
3. **Make tower results lead directly back to growth.** On the result card, show one sentence: “Your 12 floors unlocked 24 office floors; next: Coffee Cart level 4,” plus a single “See it in Skyhaven” primary action. Use existing tower/tycoon state, not a new progression system.
4. **Explain the economy at first contact.** A dismissible three-step inline hint in Skyhaven: “Build towers → gain office floors → buy businesses → hire managers to earn while away.” Hide permanently after the player completes the first manager hire. Avoid a blocking tutorial modal.
5. **Make Then → Now robust and easy to find.** Put the scrapbook/share entry beside the current rank milestone, display “First photo” and “Today” dates, and gracefully handle a missing/unreadable old picture (B1). Avoid taking a full-size screenshot merely to populate a thumbnail.

Each is a small, testable change. Resist adding another currency, menu, or daily task in this round.

## 4. New-player friction to check

- **Two competing entry points:** `src/app.ts:290–303` automatically opens Skyhaven after a player has one tower, while `index.html` still prominently says “Tap anywhere to build.” Explain clearly whether the primary activity is stacking towers or managing the company, and preserve an obvious **Build** action on the city screen.
- **Office floors vs tower floors:** The build-sheet copy says each tower floor grants two office floors. Present both units together when awarding them, and explain that office floors are capacity rather than immediately spendable coins.
- **Manual vs managed business:** A player can start a manual cycle, but may not understand why it stops until a manager is hired. Show “Tap to run once” and “Hire manager for automatic sales” on the same card.
- **Mode availability:** `index.html` initially hides Daily, Journey and Zen chips. Show a compact “Unlocks at level X” explanation where appropriate instead of letting the player assume the game only has Classic.
- **Coins, crystals, stars, XP, floors:** At each first encounter, label what the reward is *for*; avoid relying on icon-only comprehension.
- **Camera gestures:** In Skyhaven, briefly teach “Drag to explore · Pinch to zoom · Tap a building” and ensure swipes do not accidentally buy/select.
- **Offline earnings:** Show the cap and what upgrades extend it before the player hits the cap; don't imply unlimited passive earnings.
- **Challenge links:** Since the friend card is under active development, verify invalid/expired link, offline fetch, equal seed, retry, and a clear “Your tower / Friend's tower” distinction before shipping it. These are acceptance checks, not claimed current bugs.
- **Accessibility:** Test 320px screens, reduced motion, keyboard/focus handling in modals, large text, color contrast, and non-color feedback for perfect drops and sales.

## 5. Recommended order and acceptance checks

**First pass (today):** B1 and B2; tighten first-action copy; add explicit manager/manual-cycle labels; improve result-card CTA.  
**Second pass:** B3 test and clamp; B4 aggregated feedback; cached DOM references and capped mobile pixel ratio.  
**After profiling:** Static prop instancing/merging and postprocessing tiers; do not refactor the whole renderer without baseline numbers.

**Minimal regression matrix:** fresh install; one completed tower; first business and first manager; return after 8+ hours; cross local midnight; change device clock backwards; corrupt one saved memory image; leave the city during neighbor-note delay; open/close ten city scenes; low-quality 3D and 2D fallback; challenge link offline.

**Review limitations:** This is a static, source-based audit. Specific source files were fetched from the named branch, including `src/app.ts`, `src/ui/tycoon.ts`, `src/ui/memories.ts`, `src/render3d/bizcity.ts`, `src/render3d/renderer3d.ts`, `src/logic/tycoon.ts`, `src/logic/save.ts`, `src/logic/daily.ts`, `src/logic/sim.ts`, `src/data/tycoon.ts`, `src/styles.css` and `index.html`. This review is not a claim that every line of every `src/logic/*.ts` and `src/data/*.ts` file was exhaustively inspected. No tests or builds were run; verify proposed fixes against concurrent changes before merging.

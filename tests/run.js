// Lumen Rush test suite. Run from the repository folder with:
//   npm install   (once, installs Playwright)
//   npm test
// It opens echo.html in a headless browser at phone size and checks the swing, the stages and
// every screen around them.

const { chromium } = require("playwright");
const path = require("path");

const http = require("http"), fs = require("fs");
// The game is served over http, as on the real site (fonts can't load from file:// pages).
const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
}).listen(0, "127.0.0.1");
let URL = "";
let passed = 0, failed = 0;

function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}
const section = name => console.log(`\n${name}`);

async function openGame(browser, size = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  const errors = [], requests = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (!r.url().startsWith(URL.replace(/echo\.html$/, "")) && !r.url().startsWith("data:")) requests.push(r.url()); });
  await page.goto(URL);
  // Start from a clean save.
  await page.evaluate(() => localStorage.clear());
  return { page, errors, requests };
}

(async () => {
  await new Promise(r => server.listening ? r() : server.once("listening", r));
  URL = `http://127.0.0.1:${server.address().port}/echo.html`;
  const browser = await chromium.launch();
  const t0 = Date.now();

  // ---------------------------------------------------------------- Lumen Rush: the swing
  section("Lumen Rush: the swing");
  {
    const { page, errors } = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {}, step = (n = 1) => { for (let q = 0; q < n; q++) runUpdate(1 / 60); };
      save.run = null; runSave(); save.run.tutDone = 1; startRun();
      const R = run;
      out.aRunStartsMidSwing = screen === "run" && R.mode3 === true && !!R.teth && R.hearts === 3;
      R.darkX = -1e4; step(30);
      out.theTetherHoldsYouOnAnArc = !!R.teth && Math.hypot(R.px - R.teth.x, R.py - R.teth.y) <= R.L + 0.05;
      // Let go when swinging forward and up: a Perfect.
      R.vx = 15; R.vy = 9;
      const p0 = R.perfects, v0 = Math.hypot(R.vx, R.vy); swingHold(false);
      out.lettingGoAtTheRightMomentIsPerfect = R.perfects === p0 + 1 && Math.hypot(R.vx, R.vy) > v0 && !R.teth;
      step(20); out.youFlyOnAfterLettingGo = R.vx > 5 && !R.teth;
      swingHold(true); out.holdingGrabsTheNextAnchorAhead = !!R.teth && R.teth.x > R.px - 3;
      // Aiming: the ringed anchor is exactly the one a press grabs; holding reels you in and speeds you up.
      { swingHold(false); const tgt = { x: R.px + 8, y: R.py + 9, kind: "lamp", id: 9100 }, other = { x: R.px + 12, y: R.py + 14, kind: "lamp", id: 9101 }; const keepA = R.anchors; R.anchors = [tgt, other]; R.roof = null; swingAim(R);
        out.theAimIsTheNearestAnchorAhead = R.aim === tgt && R.aimOk;
        swingHold(true); out.aPressGrabsExactlyTheAimedAnchor = R.teth === tgt;
        R.vx = 10; R.vy = -6; const L0 = R.L; let w0 = 0; { const dx = R.px - tgt.x, dy = R.py - tgt.y; w0 = Math.abs(R.vx * -dy + R.vy * dx) / (dx * dx + dy * dy); }
        step(20); const dx = R.px - tgt.x, dy = R.py - tgt.y, w1 = Math.abs(R.vx * -dy + R.vy * dx) / (dx * dx + dy * dy);
        out.holdingReelsYouIn = R.teth === tgt && R.L < L0 - 0.5;
        out.reelingInSpinsYouFaster = w1 > w0;
        swingHold(false); R.anchors = keepA; }
      { const far = { x: R.px + 60, y: R.py + 10, kind: "lamp", id: 9102 }; const keep = R.anchors; R.anchors = [far]; R.teth = null; swingHold(true); out.aFarAnchorIsNotGrabbed = !R.teth && R.aim === far && !R.aimOk; swingHold(false); R.anchors = keep; }
      // Lights and relit buildings.
      const l0 = R.lights; R.motes.push({ x: R.px, y: R.py + 0.9, line: 0 }); step(1);
      out.lightsAreCollected = R.lights > l0;
      for (let q = 0; q < 600; q++) { R.inv = 1; runnerAuto(); step(); }
      out.buildingsLightUpAsYouPass = R.lit >= 3 && R.blds.some(b => b.litT >= 0);
      out.theSkylineGoesOnAhead = runnerM() > 40 && R.anchors.some(a => a.x > R.px + 40);
      // Hits: the street, a wall, the darkness.
      R.blds.length = 0; R.haz.length = 0; R.power = null; R.od = 0; R.streetT = 0; R.inv = 0; R.teth = null; R.roof = null; R.hold = false; R.py = 0.6; R.vy = -8; step(3);
      out.theFirstStreetTouchIsAFreeBounce = R.hearts === 3 && R.vy > 0;
      R.py = 0.6; R.vy = -8; step(3);
      out.aSecondTouchSoonAfterCostsAHeart = R.hearts === 2;
      R.inv = 0; R.streetT = 2; R.power = { kind: "shield", t: 5 }; R.py = 0.6; R.vy = -8; step(3);
      out.aShieldTakesTheHit = R.hearts === 2 && !R.power;
      R.inv = 0; R.blds.push({ x0: R.px + 0.3, x1: R.px + 10, h: R.py + 10, style: 0, litT: -1, n: 999, seed: 0.5 }); R.teth = null; R.vx = 12; R.vy = 0; step(3);
      out.wallsAreRunUpNotCrashedInto = R.hearts === 2 && R.vy > 5;
      R.blds.pop(); R.inv = 0; R.hearts = 3; R.streetT = 0; R.power = null; R.py = 30; R.vy = 0; R.darkX = R.px + 2; step(1);
      out.theDarknessCatchesTheSlow = R.hearts === 2 && R.darkX < R.px - 10;
      // Landing on a roof: you run along it.
      R.inv = 1; R.teth = null; R.hold = false; R.power = null; R.ups.length = 0; R.haz.length = 0; R.boosts.length = 0; R.winds.length = 0; R.updrafts.length = 0; R.blds = R.blds.filter(q => q.x1 < R.px - 3 || q.x0 > R.px + 40); R.blds.push({ x0: R.px - 2, x1: R.px + 30, h: R.py - 0.5, style: 0, litT: -1, n: 998, seed: 0.3 }); R.vy = -3; step(10);
      out.youCanLandAndRunOnRooftops = !!R.roof && R.vx >= 9;
      { const keepA = R.anchors; R.anchors = []; R.hold = false; swingHold(true); out.tappingOnARoofWithNothingInReachJumps = !R.roof && R.vy > 10; R.anchors = keepA; swingHold(false); }
      { const keepA = R.anchors, keepB = R.blds; R.anchors = []; R.blds = []; R.roof = null; R.teth = null; R.hold = false; R.py = 25; R.vy = -5; R.dashes = 1; swingHold(true); const vy1 = R.vy; swingHold(false); R.vy = -5; swingHold(true); out.aTapInTheAirWithNothingInReachDashesOnce = vy1 >= 13 && R.vy === -5; swingHold(false); R.anchors = keepA; R.blds = keepB; }
      R.blds.pop(); R.roof = null;
      // Events.
      { const d0 = Math.floor(runnerM() / RUN.BIOME_M) * RUN.BIOME_M + 40; R.dist = d0 * RUN.M; R.px = d0; R.darkX = R.px - 50; } R.ev = null; R.nextEv = runnerM() - 1; R.tut = 0; step(1);
      out.eventsHappenOnTheWay = !!R.ev && ["shower", "surge"].includes(R.ev.kind);
      // Flow, Overdrive and the dash.
      R.ev = null; R.od = 0; R.flow = 0.9; swingFlow(R, 0.2);
      out.fullFlowSetsOffOverdrive = R.od > 5 && R.flow === 1;
      const lo = R.lights; R.motes.push({ x: R.px, y: R.py + 0.9, line: 0 }); step(1);
      out.overdriveDoublesLights = R.lights - lo >= 2;
      R.od = 0; R.flow = 0; R.teth = null; R.roof = null; R.dashes = 1; R.vx = 10; swingDash();
      out.aDashBurstsYouForward = R.vx >= 20 && R.dashes === 0;
      const v1 = R.vx; swingDash(); out.oneDashUntilYouGrabAgain = R.vx === v1;
      // Special anchors: spring, crumble, gold.
      R.anchors.push({ x: R.px + 6, y: R.py + 8, kind: "lamp", id: 9001, type: "spring" }); R.teth = R.anchors[R.anchors.length - 1]; R.L = 10; R.vy = 0; swingHold(false);
      out.aSpringAnchorLaunchesYou = R.vy >= 9;
      const cr = { x: R.px + 6, y: R.py + 8, kind: "lamp", id: 9002, type: "crumble" }; R.anchors.push(cr); R.teth = cr; R.L = 10; R.tethT = 0; R.hold = true; step(130);
      out.aCrumblingAnchorBreaks = cr.broken === true && R.teth !== cr;
      const gl = { x: R.px + 6, y: R.py + 8, kind: "lamp", id: 9003, type: "gold" }; R.anchors = [gl]; R.teth = null; R.hold = false; const lg = R.lights; swingAttach(R);
      out.goldAnchorsPayLights = R.teth === gl && R.lights === lg + 5;
      // The Heart of the Dark: three shards break it.
      R.over = 0; R.hearts = 3; R.inv = 5; R.paused = false; R.ev = null; R.hearted = {}; R.ups = R.ups.filter(u => u.kind !== "shard"); R.tut = 0; const mm = runnerM(); R.dist = (Math.floor(mm / RUN.BIOME_M) * RUN.BIOME_M + RUN.BIOME_M - 60) * RUN.M; R.px = R.dist / RUN.M; R.darkX = R.px - 50; R.teth = null; R.roof = null; R.py = 30; R.vy = 0; for (let q = 0; q < 10 && !R.ev; q++) step(1);
      out.theHeartOfTheDarkComesNearTheEndOfADistrict = !!R.ev && R.ev.kind === "heart" && R.ups.filter(u => u.kind === "shard").length === 3;
      const l9 = R.lights; for (let q = 0; q < 3; q++) { R.ups.push({ x: R.px, y: R.py + 0.9, kind: "shard" }); step(1); }
      out.threeShardsBreakTheHeart = !R.ev && R.lights >= l9 + 60;
      // The letter hunt.
      save.hunt = null; R.ups.push({ x: R.px, y: R.py + 0.9, kind: "letter", ch: "L" }); step(1);
      out.lettersCountForTheHunt = huntState().got === "L";
      run.continues = 2; run.hearts = 1; run.inv = 0; runHit();
      out.theRunEndsAndPays = !!run.over && save.run.best > 0 && (save.run.top || []).length >= 1;
      out.relitBuildingsRestoreTheCity = (save.city && save.city.lit) >= 3;
      save.capsules = 1; save.glow = 0; const got = openCapsule();
      out.capsulesOpenIntoRewards = !!got && save.capsules === 0 && (save.glow > 0 || /New/.test(got));
      // The locker and ranks.
      save.glow = 1000; save.look = null; openSheet("locker"); document.querySelector('#shopList button[data-lk="c:1"]').click();
      out.theLockerSellsAndEquipsForms = runnerLook().char === 1 && runnerLook().own.c1 === 1 && save.glow === 400;
      document.querySelector('#shopList button[data-lk="c:0"]').click(); out.ownedThingsCanBeWornAgainForFree = runnerLook().char === 0 && save.glow === 400;
      openSheet("ranks"); out.ranksListYourRuns = document.querySelectorAll("#shopList li").length > 5;
      document.getElementById("sheet").hidden = true;
      // The whole swing is drawn in 2D (no WebGL).
      save.run.tutDone = 1; startRun(); { const c = document.getElementById("runCanvas"), cx = c.getContext("2d"); for (let q = 0; q < 30; q++) { run.inv = 1; runnerAuto(); runUpdate(1 / 60); runDraw(cx, c.clientWidth || 390, c.clientHeight || 844); } }
      out.theSwingIsDrawnWithoutWebgl = run.scrAim !== undefined && !window.THREE;
      run = null;
      showTitle(); out.theTitleSwingsByItself = !!titleRun && titleRun.mode3 === true;
      return out;
    });
    for (const [k, v] of Object.entries(r)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Stages
  section("Lumen Rush: stages");
  {
    const { page, errors } = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {}; save.run = null; runSave(); save.run.tutDone = 1; save.stages = null;
      // Chapter cards: the first visit to a new district shows one, and a whole district lit unlocks something to wear.
      { save.chapSeen = {}; stageSave().unlocked = 60; startStage(11); out.aNewDistrictShowsItsChapterCard = !$("chapIntro").hidden && $("ciName").textContent === "The Markets"; $("ciGo").click(); out.thenTheStageStarts = run && run.stage === 11 && $("chapIntro").hidden; save.chapSeen = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }; }
      { const S = stageSave(); for (let n = 1; n <= 9; n++) S.best[n] = { stars: 1, time: 20 }; delete S.best[10]; save.chapDone = {}; startStage(10); const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen + 0.5; R.py = 30; runUpdate(1 / 60); const [k, i] = chapterRewardItem(0); out.lightingADistrictUnlocksItsReward = i >= 0 && !!runnerLook().own[k + i]; save.stages = null; }
      const play = n => { startStage(n); const R = run; for (let q = 0; q < 60 * 90 && !R.cleared && !R.failed; q++) { R.inv = 1; runnerAuto(); runUpdate(1 / 60); } return R; };
      out.playStartsStageOne = typeof stageNext === "function" && stageNext() === 1;
      const a = play(1);
      out.aStageHasAFinishAndYouCanReachIt = a.cleared === true && a.stageT > 5 && a.stageT < 80 && a.stageLen > 200;
      out.clearingGivesStarsAndUnlocksTheNext = a.stageStars >= 1 && stageSave().unlocked === 2 && stageStars(1) >= 1;
      out.yourBestRunIsKeptAsAGhost = !!stageSave().ghosts[1] && ghostDecode(stageSave().ghosts[1].g).length > 50;
      startStage(1); const x1 = run.anchors.slice(0, 6).map(q => q.x | 0).join(); startStage(1); const x2 = run.anchors.slice(0, 6).map(q => q.x | 0).join();
      out.aStageIsTheSameCourseEveryTime = x1 === x2;
      out.theGhostRacesYouOnTheSameStage = !!run.ghostTrace && run.ghostLabel === "BEST";
      const tr = a.trace, back = ghostDecode(ghostEncode(tr)), last = back[back.length - 1], orig = tr[tr.length - 1];
      out.ghostsSurviveTheTripThroughALink = back.length === tr.length && Math.abs(last[0] - orig[0]) < 1.5 && Math.abs(last[1] - orig[1]) < 1.5 && stageLink(1, 30, tr).length < 2000;
      // Running out of light: a retry card, no continue.
      startStage(1); run.inv = 0; run.hearts = 1; runHit();
      out.runningOutOfLightOffersARetry = run.failed === true;
      startStage(1); out.lockedStagesStayLocked = (startStage(9), run.stage === 1);
      const d = play(0);
      out.theDailyStageWorks = d.cleared && !!save.dailyStage && save.dailyStage.day === dayNumber();
      // Harder as you go.
      stageSave().unlocked = 60;
      startStage(10); out.everyTenthStageIsABossWithThreeShards = run.stageInfo.boss && run.ev && run.ev.kind === "heart" && run.ups.filter(u => u.kind === "shard").length === 3;
      startStage(6); { const R = run; R.blds.length = 0; R.teth = null; R.roof = null; R.inv = 0; R.streetT = 0; R.power = null; R.py = 0.6; R.vy = -8; for (let q = 0; q < 3; q++) runUpdate(1 / 60); out.fromStageFiveTheStreetCostsAHeart = R.hearts === 2; }
      out.thePerfectWindowNarrowsInLaterStages = (() => { startStage(1); const a = perfectWindow(run); startStage(30); const b = perfectWindow(run); return b[0] > a[0] && b[1] < a[1] && b[2] > a[2]; })();
      out.threeStarsNeedParTime = stageInfo(20).par > 10 && stageInfo(20).par < stageInfo(20).len / 20;
      save.settings.fps = true; run.paused = false; for (let q = 0; q < 40; q++) paceTick(0.016); out.theFpsCounterShows = !document.getElementById("fpsMeter").hidden; save.settings.fps = false; document.getElementById("fpsMeter").hidden = true;
      // Rings, Good releases, star rewards, wind.
      { const keep = WEEK_EVENTS.slice(), sig = () => { startStage(6); swingGen(run, 400); return run.anchors.map(a => `${a.x.toFixed(1)}:${a.type}`).join(); }; const sigs = []; for (const ev of keep) { WEEK_EVENTS.fill(ev); sigs.push(sig()); } keep.forEach((e, i) => (WEEK_EVENTS[i] = e)); out.aStageIsTheSameCourseEveryWeek = sigs.every(x => x === sigs[0]); }
      startStage(2); { const R = run; R.teth = null; R.roof = null; R.inv = 1; const v0 = R.vx, l0 = R.lights; R.boosts.push({ x: R.px, y: R.py + 0.9, r: 1.7 }); runUpdate(1 / 60); out.aBoostRingSpeedsYouUp = R.vx > v0 + 4 && R.lights >= l0 + 3; }
      { const R = run; const a = { x: R.px + 5, y: R.py + 8, kind: "lamp", id: 7777 }; R.teth = a; const [lo, hi, v] = perfectWindow(R); const ang = (hi + 8) * Math.PI / 180, sp = v + 2; R.vx = Math.cos(ang) * sp; R.vy = Math.sin(ang) * sp; const l1 = R.lights, p1 = R.perfects; swingHold(false); out.aNearMissReleaseIsStillGood = R.lights === l1 + 1 && R.perfects === p1; }
      save.look = null; stageSave().best = {}; for (let n = 1; n <= 6; n++) stageSave().best[n] = { stars: 1, time: 30 }; starRewards(); out.starsUnlockLooks = runnerLook().own.s1 === 1;
      startStage(7); out.windStagesHaveGusts = run.stageInfo.wind && run.winds.length > 0; { const R = run, w = R.winds[0]; R.teth = null; R.hold = false; R.roof = null; R.blds.length = 0; R.px = (w.x0 + w.x1) / 2; R.py = 30; R.vx = 10; R.vy = 0; R.inv = 1; for (let q = 0; q < 30; q++) runUpdate(1 / 60); out.windPushesYou = Math.sign(R.vx - 10 + (w.f < 0 ? 0 : 0)) === Math.sign(w.f) || Math.abs(R.vx - 10) > 1; }
      stageSave().unlocked = 60; startStage(21); { const R = run; R.blds.length = 0; R.teth = null; R.hold = false; R.roof = null; R.inv = 0; R.streetT = 0; R.power = null; R.py = 0.6; R.vy = -8; const h0 = R.hearts; for (let q = 0; q < 3; q++) runUpdate(1 / 60); out.theHarbourSplashesInsteadOfHurting = runnerTheme(R.px).water && R.hearts === h0 && !!R.splash; }
      { let done = false; save.opening = 0; playOpening(() => { done = true; }); const shown = !$("opening").hidden; $("opSkip").click(); out.theOpeningPlaysAndCanBeSkipped = shown && done && $("opening").hidden && save.opening === 1; }
      startStage(15); out.eachDistrictHasItsOwnMusic = music.district && music.district.base === 146.83; { const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen + 0.5; R.py = 30; for (let q = 0; q < 60; q++) runUpdate(1 / 60); out.theWindowChimesWhenYourLightLands = R.cleared && R.chimed === true; }
      { const od = outageDistrict(); startStage(od * 10 + 2); const R = run; out.theOutageDistrictFlickers = R.outage === true && R.anchors.some(a => a.flicker); let offSeen = false; for (let q = 0; q < 240; q++) { runUpdate(1 / 60); for (const a of R.anchors) if (a.off && a === R.aim) offSeen = true; } out.aDarkAnchorIsNeverTheTarget = !offSeen; }
      for (const n of [44, 45, 50]) { startStage(n); swingGen(run, run.stageLen + 60); if (run.anchors.some(a => a.tree && a.x > run.stageLen + 1 && a.x < run.stageLen + 17)) out.theHomePlotHasNoStrayTreetop = false; } if (out.theHomePlotHasNoStrayTreetop !== false) out.theHomePlotHasNoStrayTreetop = true;
      startStage(25); { const R = run; R.blds.length = 0; R.teth = null; R.hold = false; R.roof = null; R.anchors = []; R.py = 6; R.vy = -12; R.inv = 1; let md = 0; for (let q = 0; q < 30; q++) { runUpdate(1 / 60); md = Math.max(md, R.danger || 0); } out.noDangerGlowOverHarbourWater = md === 0; }
      { save.dm = { v: 2, day: today(), list: DM_POOL.map((_, i) => ({ i, prog: 0, done: false })), all: true }; startStage(2); const R = run; for (let q = 0; q < 60 * 60 && !R.cleared; q++) { runnerAuto(); R.inv = 1; R.hearts = 3; runUpdate(1 / 60); }
        const pr = k => save.dm.list.find(m => DM_POOL[m.i].k === k).prog; out.missionsCountWhatYouDo = pr("home") === 1 && pr("perfect") > 0 && pr("pchain") > 0 && pr("lights") > 0 && pr("free") > 0 && pr("stars") >= 1; }
      startStage(3); { const R = run; R.teth = null; R.hold = false; R.roof = null; R.blds.length = 0; R.inv = 2; R.px = 100; R.py = 30; R.vx = 10; R.vy = 0; const tt = 0.5; R.haz = [{ kind: "drone", x: 105, y0: 30 + 0.9 - SWING.G * tt * tt / 2, amp: 0, ph: 0 }]; runUpdate(1 / 60); runUpdate(1 / 60); out.aDroneOnYourPathWarnsYou = R.haz[0].warn > 0; }
      { const S = stageSave(); const a0 = (S.att && S.att[7]) || 0; startStage(7); startStage(7); out.attemptsCountEachTry = S.att[7] === a0 + 2 && run.attempt === a0 + 2;
        const R = run; R.teth = null; R.px = R.stageLen * 0.4; R.inv = 0; R.hearts = 1; delete (S.pct || {})[7]; swingHit(R, "test"); out.failingRecordsYourBestPercent = R.failPct === 40 && R.newBestPct === true && S.pct[7] === 40; }
      startStage(8); { const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen + 0.5; R.py = 30; for (let q = 0; q < 70; q++) runUpdate(1 / 60); out.youLandOnTheirRoofAtTheEnd = R.cleared && R.roof && R.roof.home && Math.abs(R.py - 17) < 0.01 && Math.abs(R.px - (R.stageLen + 6.5)) < 0.01; }
      startStage(9); { const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen + 0.5; R.py = 30; for (let q = 0; q < 60 * 6; q++) runUpdate(1 / 60); out.theDarkStaysBackAfterYouWin = R.px - R.darkX > 20; const l0 = R.lights; swingHold(true); swingHold(false); for (let q = 0; q < 5; q++) runUpdate(1 / 60); out.tapsDoNothingAfterTheFinish = !R.teth && R.lights === l0 && R.roof && R.roof.home; }
      { const S = stageSave(); S.pct = S.pct || {}; S.pct[11] = 30; startStage(11); const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen * 0.31; R.py = 30; runUpdate(1 / 60); out.passingYourBestCelebrates = R.passedBest === true && R.msgs.some(m => m.text === "New best!"); }
      { startStage(20); let R = run; const sh = R.ups.find(u => u.kind === "shard"); runUpdate(1 / 60); const x1 = sh.x; for (let q = 0; q < 30; q++) runUpdate(1 / 60); const drift = sh.x !== x1;
        startStage(30); R = run; R.stageT = 30; runUpdate(1 / 60); const tide = R.tide > 5; startStage(40); const glitch = run.glitch && run.anchors.some(a => a.flicker);
        out.everyBossHasItsOwnTwist = drift && tide && glitch && BOSSES.length === 6 && run.bossK === 3; }
      // Audit fixes: a cleared stage can't be failed; dying at the finish isn't a clear; one render loop; a release while paused counts.
      startStage(1); { const R = run; R.cleared = true; R.inv = 0; R.hearts = 1; swingHit(R, "test"); out.aClearedStageCantBeHit = R.hearts === 1 && !R.failed; }
      startStage(5); { const R = run; R.over = 0.001; R.px = R.stageLen + 1; R.inv = 1; runUpdate(1 / 60); out.dyingAtTheFinishIsNotAClear = !R.cleared; }
      startStage(1); startStage(1); out.retryingKeepsOneRenderLoop = runLoop.on === true;
      startStage(1); { const R = run; swingHold(true); R.paused = true; swingHold(false); R.paused = false; out.aReleaseWhilePausedCounts = R.hold === false; }
      // The Night shift's "keep going?" offer: pause can't open over it, and its clock waits while the app is hidden.
      { startRun({}); save.glow = 500; const R = run; R.inv = 0; R.hearts = 1; runHit(); const offered = !$("runContinue").hidden;
        $("runPauseBtn").click(); out.pauseCantOpenOverKeepGoing = offered && $("runPause").hidden; $("runContinueNo").click(); }
      // A helping hand: failing a stage again and again slows the dark a little; clearing it resets.
      { const S = stageSave(); S.unlocked = 60; S.fails = {}; delete S.best[12]; startStage(12); const a0 = run.assist; run.inv = 0; run.hearts = 1; runHit(); run.inv = 0; startStage(12); const a1 = run.assist; run.inv = 0; run.hearts = 1; runHit(); startStage(12); const a2 = run.assist;
        S.fails[12] = 9; startStage(12); const cap = run.assist; S.fails[40] = 9; startStage(40); const capB = run.assist; $("chapIntro").hidden = true;
        startStage(12); const R = run; R.teth = null; R.hold = false; R.inv = 9; R.px = R.stageLen + 0.5; R.py = 30; for (let q = 0; q < 60 && !R.cleared; q++) runUpdate(1 / 60);
        out.failingAgainSlowsTheDarkALittle = a0 === 0 && a1 > 0 && a2 > a1 && cap === 0.28 && capB === 0.4 && R.cleared && !S.fails[12]; }
      startStage(3); run.inv = 0; run.hearts = 1; runHit(); out.theLastHeartShattersTheFigure = Array.isArray(run.shatter) && run.shatter.length > 10;
            openSheet("stages"); out.theCityMapShowsSixtyHomes = document.querySelectorAll("#shopList .bld").length === 60 && document.querySelectorAll("#shopList .bld.boss").length === 6 && document.querySelectorAll("#shopList .district").length === 6;
            { const nb = document.querySelector("#shopList .bld:not([disabled])"); nb.click(); out.tappingAHomeShowsWhoLivesThere = document.querySelector("#shopList .map-pick").textContent.includes(stagePerson(Number(nb.dataset.pick))[0]); }
      document.getElementById("sheet").hidden = true; run = null;
      return out;
    });
    for (const [k, v] of Object.entries(r)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    check("no page errors", errors.length === 0, errors[0]);
    // The people: every stage has someone waiting; clearing it brings them light.
    {
      const pr = await page.evaluate(async () => {
        const o = {}; o.sixtyPeople = STAGE_PEOPLE.length === STAGES_N && STAGE_PEOPLE.every(p => p[0] && p[1]);
        stageSave().unlocked = 60; startStage(4); const R = run; R.inv = 9; R.px = R.stageLen + 0.5; runUpdate(1 / 60);
        await new Promise(r => setTimeout(r, 1500));
        o.theCardNamesWhoYouReached = $("stPerson").textContent.includes(stagePerson(4)[0]) && !$("stPerson").hidden;
        { startStage(5); const C = run; C.teth = null; C.hold = false; C.inv = 9; C.px = C.stageLen + 0.5; C.py = 30; for (let q = 0; q < 60 && !C.cleared; q++) runUpdate(1 / 60); await new Promise(r => setTimeout(r, 2300)); R.stageTime = C.stageTime; R.motesGot = C.motesGot; R.motesTotal = C.motesTotal; R.perfects = C.perfects; R.cleared2 = C.cleared; }
        o.theCardCountsUpTheRealNumbers = R.cleared2 && $("stTime").textContent === R.stageTime.toFixed(1) && $("stLights").textContent === `${R.motesGot}/${R.motesTotal}` && $("stPerf").textContent === String(R.perfects);
        // The last stage: the first clear ends on dawn over the city.
        { const S = stageSave(); for (let n = 1; n < STAGES_N; n++) S.best[n] = S.best[n] || { stars: 1, time: 30 }; S.unlocked = STAGES_N; save.dawnSeen = 0;
          startStage(STAGES_N); const L = run; L.teth = null; L.hold = false; L.inv = 9; L.px = L.stageLen + 0.5; L.py = 30; for (let q = 0; q < 60 && !L.cleared; q++) runUpdate(1 / 60);
          await new Promise(r => setTimeout(r, 1500));
          o.theLastStageOffersTheDawn = $("stNext").textContent === "See the dawn";
          $("stNext").click(); o.theDawnEndingShows = !$("chapIntro").hidden && $("ciName").textContent === "Dawn" && $("ciHomes").textContent.startsWith(`${STAGES_N} of ${STAGES_N}`);
          $("ciGo").click(); o.afterTheDawnYouGoHome = screen === "title" && save.dawnSeen === 1 && $("chapIntro").hidden;
          startStage(11); o.chapterCardsStillReadRight = $("chapIntro").hidden || ($("ciGo").textContent === "Bring the light" && $("ciCredits").hidden); $("chapIntro").hidden = true; }
        o.homesLitCountsClearedStages = homesLit() >= 1;
        run = null; showTitle(); o.homeShowsHomesRelit = $("homeBest").textContent === String(homesLit()) && $("tileCity").textContent.includes("/60");
        o.dailyHasANamedNeighbour = stagePerson(0)[0] && stagePerson(0)[0] !== "A stranger";
        return o;
      });
      for (const [k, v] of Object.entries(pr)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    }
    // The halfway lantern on long stages.
    {
      const cp = await page.evaluate(async () => {
        const o = {}; stageSave().unlocked = 60; delete stageSave().best[25]; delete stageSave().ghosts[25]; startStage(25); let R = run;
        for (let q = 0; q < 60 * 90 && !R.cp; q++) { runnerAuto(); R.inv = 1; R.hearts = 3; runUpdate(1 / 60); }
        o.passingHalfwaySetsACheckpoint = !!R.cp;
        R.inv = 0; R.hearts = 1; swingHit(R, "test"); await new Promise(r => setTimeout(r, 1300));
        o.theFailCardOffersHalfway = !$("stFromCp").hidden;
        $("stFromCp").click(); R = run;
        o.startingFromHalfwayIsPastTheMiddle = R.cpUsed === true && R.px > R.stageLen * 0.45 && !R.over;
        for (let q = 0; q < 60 * 90 && !R.cleared; q++) { runnerAuto(); R.inv = 1; R.hearts = 3; runUpdate(1 / 60); }
        o.aHalfwayClearIsOneStarAndNoGhost = R.cleared && R.stageStars === 1 && stageSave().best[25].stars === 1 && !stageSave().ghosts[25];
        return o;
      });
      for (const [k, v] of Object.entries(cp)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    }
    // Progress survives a reload (the swing game's saves used to be dropped by the loader).
    await page.evaluate(() => { stageSave().unlocked = 7; save.city = { lit: 12 }; persist(); });
    await page.reload(); await page.waitForTimeout(800);
    check("stage progress survives a reload", await page.evaluate(() => stageSave().unlocked === 7 && save.city && save.city.lit === 12));
    await page.close();
  }

  // ---------------------------------------------------------------- Screens
  section("Screens");
  {
    const { page, errors, requests } = await openGame(browser);
    const s = await page.evaluate(() => {
      const out = {}, on = id => document.getElementById(id).classList.contains("on");
      save.run = null; runSave(); save.run.tutDone = 1; save.glow = 600; showTitle();
      out.homeShowsTheNextStage = on("titleScreen") && $("heroWho").textContent === stageWaiting(1) && $("playLabel").textContent === "Bring the light" && $("homeBest").textContent === "0";
      out.theTitleSwingsBehindTheHome = !!titleRun && titleRun.attract && titleRun.mode3;
      out.theNightShiftWaitsForDowntown = $("hardBtn").classList.contains("locked");
      // The tab bar and the sheets.
      $("levelsBtn").click(); out.theLockerOpensWithItsPreview = !$("sheet").hidden && !!document.getElementById("lkCanvas") && document.querySelectorAll("#shopList .lk-tile").length > 10;
      $("looksBtn").click(); out.theLooksButtonOpensTheLocker = !$("sheet").hidden && $("shopTitle").textContent === "Locker";
      $("tabShop").click(); out.theShopListsUpgrades = $("shopTitle").textContent === "Shop" && document.querySelectorAll("#shopList button[data-run]").length === RUN.upgrades.length;
      document.querySelector('#shopList button[data-run="magnet"]').click(); out.buyingAnUpgradeSpendsLights = runUpg("magnet") === 1 && save.glow === 560;
      $("tabFriends").click(); out.ranksShowYourRecords = $("shopTitle").textContent === "Ranks" && document.querySelectorAll("#shopList .rk-card").length === 4;
      $("stagesBtn").click(); out.theCityTileOpensTheMap = document.querySelectorAll("#shopList .bld").length === 60;
      $("todayBtn").click(); out.todayOpensOverTheSheet = !$("todayPanel").hidden && $("sheet").hidden && document.querySelectorAll("#calGrid div").length === 7 && document.querySelectorAll("#dmList li").length === 3;
      const g0 = save.glow; $("calClaim").click(); out.theDailyGiftCanBeClaimedOnce = save.glow === g0 + CAL[0] && $("calClaim").disabled; $("calClaim").click(); out.aSecondClaimGivesNothing = save.glow === g0 + CAL[0];
      $("todayAwards").click(); out.awardsListEveryAward = $("shopTitle").textContent === "Awards" && document.querySelectorAll("#shopList li").length === RUN_ACHS.length;
      $("tabHome").click(); out.homeClosesTheSheets = $("sheet").hidden && $("todayPanel").hidden && on("titleScreen");
      // Settings.
      $("settingsBtn").click(); out.settingsOpen = on("settingsScreen") && document.querySelectorAll("#settingsScreen .toggle").length === 3;
      const c0 = !!save.settings.calm; $("setCalm").click(); out.reduceMotionToggles = save.settings.calm === !c0 && $("setCalm").getAttribute("aria-pressed") === String(!c0);
      $("setFps").click(); out.showFpsToggles = save.settings.fps === true && !$("fpsMeter").hidden; $("setFps").click();
      out.aboutShowsVersionAndPrivacy = $("aboutVersion").textContent.includes(GAME_VERSION) && /no tracking/i.test($("settingsScreen").textContent) && !!document.querySelector('#settingsScreen a[href^="mailto:"]') && !!document.querySelector('#settingsScreen a[href="lumen-rush-privacy.html"]');
      $("settingsBack").click(); out.doneGoesHome = on("titleScreen");
      // The Night shift opens once Downtown is lit, and ends on the run-over card.
      stageSave().best[10] = { stars: 1, time: 20 }; showTitle(); out.theNightShiftOpensAfterStageTen = !$("hardBtn").classList.contains("locked");
      return out;
    });
    // The phone's Back button leaves a run for the home screen.
    await page.evaluate(() => startStage(1));
    await page.goBack(); await page.waitForTimeout(200);
    s.backFromARunGoesHome = await page.evaluate(() => screen === "title");
    Object.assign(s, await page.evaluate(() => {
      const out = {};
      // Back up and restore.
      stageSave().unlocked = 9; save.glow = 321;
      const code = saveCode();
      stageSave().unlocked = 1; save.glow = 0;
      document.getElementById("saveCode").value = code;
      document.getElementById("restoreCode").click();
      out.backupRestores = stageSave().unlocked === 9 && save.glow === 321;
      document.getElementById("saveCode").value = "nonsense";
      document.getElementById("restoreCode").click();
      out.badCodeIsHarmless = stageSave().unlocked === 9;
      // An old save with keys this version doesn't use still loads.
      localStorage.setItem(SAVE_KEY, JSON.stringify({ stars: [3, 2], story: { 0: 1 }, skin: 2, glow: 99, stages: { unlocked: 4, best: { 1: { stars: 2, time: 30 } }, ghosts: {} } }));
      return out;
    }));
    await page.reload(); await page.waitForTimeout(500);
    s.anOldSaveStillLoads = await page.evaluate(() => save.glow === 99 && stageSave().unlocked === 4 && homesLit() === 1 && screen === "title");
    for (const [k, v] of Object.entries(s)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    for (const size of [{ width: 360, height: 640 }, { width: 430, height: 932 }, { width: 820, height: 1180 }]) {
      const { page: p2, errors: e2 } = await openGame(browser, size);
      const wide = await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      check(`no sideways scrolling at ${size.width}×${size.height}`, wide);
      check(`no page errors at ${size.width}×${size.height}`, e2.length === 0, e2[0]);
      await p2.close();
    }
    // On a wide screen (a computer, a phone on its side) the stage banner stays a sensible size.
    { const p4 = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await p4.goto(URL); await p4.evaluate(() => { localStorage.clear(); save.opening = 1; });
      const big = await p4.evaluate(() => { startStage(1); const c = document.createElement("canvas").getContext("2d"); let max = 0; const real = c.__proto__.fillText; CanvasRenderingContext2D.prototype.fillText = function (...a) { max = Math.max(max, parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)[1])); return real.apply(this, a); }; runDraw($("runCanvas").getContext("2d"), 1440, 900); CanvasRenderingContext2D.prototype.fillText = real; return max; });
      check("stage text stays readable, not huge, on a wide screen", big > 20 && big < 45, `${big}px`);
      const pr = await p4.goto(URL.replace("echo.html", "lumen-rush-privacy.html")); check("the privacy policy page is there", pr.ok() && /collect/i.test(await p4.textContent("main"))); await p4.close(); }
    check("nothing loads from other sites (the font comes with the game)", requests.length === 0, requests[0]);
    check("the game's own font is used", await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px "Inter"') && [...document.fonts].some(f => f.family.replace(/"/g, "") === "Inter" && f.status === "loaded"); }));
    // Reduce motion starts on when the phone asks for less motion.
    { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }); const p3 = await ctx.newPage(); await p3.goto(URL); await p3.evaluate(() => localStorage.clear()); await p3.reload();
      check("reduce motion follows the phone's setting", await p3.evaluate(() => save.settings.calm === true)); await ctx.close(); }
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed in ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

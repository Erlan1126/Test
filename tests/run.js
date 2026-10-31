// Echo test suite. Run from the repository folder with:
//   npm install   (once, installs Playwright)
//   npm test
// It opens echo.html in a headless browser at phone size and checks the levels, the gameplay,
// every screen, a robot play-through of a sample of levels, random-input "chaos" play, and speed.
// Add --quick to skip the slow robot and chaos sections, or --all to have the robot play every level.

const { chromium } = require("playwright");
const path = require("path");

const URL = "file://" + path.resolve(__dirname, "..", "echo.html");
const QUICK = process.argv.includes("--quick");
const ALL = process.argv.includes("--all");  // robot plays every level (takes several minutes)
let passed = 0, failed = 0;

function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}
const section = name => console.log(`\n${name}`);

async function openGame(browser, size = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  // Skip story and picture cards unless a test asks for them, and start from a clean save.
  await page.evaluate(() => {
    localStorage.clear();
    save.stars = []; save.ach = {}; save.story = {}; save.cards = {};
    for (let w = 0; w < WORLDS; w++) save.story[w] = 1;
    for (const k in CARDS) save.cards[k] = 1;
  });
  return { page, errors };
}

// Runs the game's own update loop many times in one go (no waiting for real time).
const SIM = `
  window.cardLevel = c => INTRO_LEVELS.find(i => INTRO[i].card === c);
  window.named = n => Object.keys(INTRO).map(Number).find(i => INTRO[i].name === n);
  window.__sim = (seconds, each) => {
    const steps = Math.round(seconds * 60);
    for (let k = 0; k < steps; k++) {
      if (each && each(k / 60) === false) return k / 60;
      if (screen !== "play") return k / 60;
      update(1 / 60);
    }
    return seconds;
  };
`;

(async () => {
  const browser = await chromium.launch();
  const t0 = Date.now();

  // ---------------------------------------------------------------- Levels
  section("Levels");
  {
    const { page, errors } = await openGame(browser);
    const r = await page.evaluate(() => {
      const bad = [], counts = { tall: 0, dark: 0, gates: 0, goals: 0 };
      let tooBusy = 0;
      const one = (lv, i) => {
        const m = lv.map, R = m.length;
        const Wd = m[0].length;
        if (![11, 17].includes(Wd) || m.some(row => row.length !== Wd)) return bad.push(i + ": wrong width");
        if ([...m[0], ...m[R - 1]].some(c => c !== "#") || m.some(row => row[0] !== "#" || row[Wd - 1] !== "#")) return bad.push(i + ": open border");
        let S, X, gate = null;
        const goals = [], runes = [];
        m.forEach((row, y) => [...row].forEach((c, x) => {
          if (c === "S") S = [x, y];
          if (c === "E") X = [x, y];
          if (c === "o" || c === "m" || c === "f") goals.push([x, y]);
          if (c === "r") runes.push([x, y]);
          if (c === "G") gate = [x, y];
        }));
        if (!S || !X) return bad.push(i + ": missing start or portal");
        if (!goals.some(([x, y]) => m[y][x] === "o")) bad.push(i + ": no lights");
        const reach = blockGate => {
          const seen = new Set([S + ""]), q = [S];
          while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy, c = m[ny] && m[ny][nx];
              if (!c || c === "#" || c === "W" || c === "z" || (blockGate && c === "G") || seen.has(nx + "," + ny)) continue;
              seen.add(nx + "," + ny);
              q.push([nx, ny]);
            }
          }
          return seen;
        };
        const all = reach(false), before = reach(true);
        for (const g of [X, ...goals]) if (!all.has(g + "")) bad.push(`${i}: ${m[g[1]][g[0]]} at ${g} can't be reached`);
        for (const g of runes) if (!before.has(g + "")) bad.push(`${i}: rune at ${g} is behind its gate`);
        if (gate && !runes.length) bad.push(i + ": gate with no runes");
        if (gate && before.has(X + "")) bad.push(i + ": gate can be skipped");
        if (lv.goal === "rescue" && !m.join("").includes("m")) bad.push(i + ": rescue level without a moth");
        const flat = m.join("");
        // Hushlings are in every cave once they've appeared, so they don't count as a big idea.
        const big = [R > 18 || Wd > 11, !!lv.dark, !!gate, flat.includes("D"), /[<>^v]/.test(flat), flat.includes("z"), lv.goal && lv.goal !== "explore"].filter(Boolean).length;
        if (i >= 10 && !INTRO[i] && big > 3) tooBusy++;
        if (i >= 19 && !flat.includes("g") && !flat.includes("B")) bad.push(i + ": no Hushlings");
        if (R > 18) counts.tall++;
        if (Wd > 11) counts.wide = (counts.wide || 0) + 1;
        if (lv.dark) counts.dark++;
        if (gate) counts.gates++;
        if (lv.goal && lv.goal !== "explore") counts.goals++;
      };
      for (let i = 0; i < TOTAL; i++) one(getLevel(i), i);
      one(getLevel(DAILY), "daily");
      const introsOk = INTRO_LEVELS.every(i => getLevel(i).card && CARDS[getLevel(i).card]);
      // Each idea should not appear before its introduction level.
      const early = [];
      for (let i = 10; i < 160; i++) {
        const lv = getLevel(i), f = lv.map.join("");
        if (INTRO[i]) continue;
        if (f.includes("G") && i < UNLOCK.runes) early.push(i + " runes");
        if (f.includes("g") && i < UNLOCK.gloom) early.push(i + " gloom");
        if (lv.dark && i < UNLOCK.dark) early.push(i + " dark");
        if (lv.map.length > 18 && i < UNLOCK.tall) early.push(i + " tall");
        if (lv.goal === "race" && i < UNLOCK.race) early.push(i + " race");
        if (lv.goal === "quiet" && i < UNLOCK.quiet) early.push(i + " quiet");
        if (lv.goal === "rescue" && i < UNLOCK.rescue) early.push(i + " rescue");
      }
      return { bad, counts, tooBusy, introsOk, early };
    });
    check("all 1,000 levels and the daily cave are well formed and completable", r.bad.length === 0, r.bad.slice(0, 5).join("; "));
    check("no generated level uses more than 3 big ideas", r.tooBusy === 0, r.tooBusy + " too busy");
    check("every introduction level has a picture card", r.introsOk);
    check("no idea appears before its introduction level", r.early.length === 0, r.early.slice(0, 5).join(", "));
    check("the mix includes tall, dark, gate and goal levels", Object.values(r.counts).every(n => n > 50), JSON.stringify(r.counts));
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Gameplay
  section("Gameplay");
  {
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const g = await page.evaluate(() => {
      const out = {};
      startLevel(0, true);
      const y0 = L.lumi.y;
      keys.arrowup = true; __sim(0.8); keys.arrowup = false;
      out.swims = L.lumi.y < y0 - 1.5;
      out.stops = (__sim(0.4), Math.hypot(L.lumi.vx, L.lumi.vy) < 0.4);
      Object.assign(L.lumi, { x: L.lights[0].x, y: L.lights[0].y }); __sim(0.1);
      out.collects = L.got === 1;
      L.pingCd = 0; ping();
      out.sings = L.pings === 1 && L.waves.length === 1;
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.5);
      out.finishes = screen === "result" && (save.stars[0] || 0) >= 1;
      startLevel(named("Sound Doors"), true);
      Object.assign(L.lumi, { x: 5.5, y: 4.5 }); L.pingCd = 0; ping(); __sim(0.3);
      out.doorOpens = L.door[3 * 11 + 5] > 0;
      startLevel(named("The Current"), true);
      Object.assign(L.lumi, { x: 1.5, y: 11.5, vx: 0, vy: 0 }); __sim(0.6);
      out.currentPushes = L.lumi.y < 11.2;
      startLevel(named("Sleepy Hollow"), true);
      const c = L.critters[0];
      Object.assign(L.lumi, { x: c.x, y: c.y + 0.5, vx: 0, vy: -2 }); __sim(0.1);
      out.snoozleWakes = c.awake > 0;
      // Tunnel assist: starting half a tile off a narrow opening still gets Lumi through.
      startLevel(0, true);
      Object.assign(L.lumi, { x: 4.4, y: 13.5, vx: 0, vy: 0 });
      keys.arrowup = true; __sim(0.8); keys.arrowup = false;
      out.tunnelAssist = L.lumi.y < 12.2 && Math.abs(L.lumi.x - 5.5) < 0.3;
      return out;
    });
    for (const [k, v] of Object.entries(g)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    // Joystick with a real pointer: quick to start, instant reversal, tap still sings.
    await page.evaluate(() => startLevel(0, true));
    await page.mouse.move(300, 700); await page.mouse.down();
    await page.mouse.move(300, 660, { steps: 4 });
    await page.waitForTimeout(150);
    const v1 = await page.evaluate(() => -L.lumi.vy);
    await page.mouse.move(300, 760, { steps: 4 });
    await page.waitForTimeout(200);
    const v2 = await page.evaluate(() => L.lumi.vy);
    await page.mouse.up();
    check("joystick reaches speed quickly", v1 > 3, v1.toFixed(2));
    check("joystick reverses quickly", v2 > 2.5, v2.toFixed(2));
    const pings = await page.evaluate(() => L.pings);
    await page.mouse.click(200, 400);
    check("tapping sings", (await page.evaluate(() => L.pings)) === pings + 1);
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Mechanics
  section("Mechanics and modes");
  {
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const m = await page.evaluate(() => {
      const out = {}, find = f => { for (let i = 10; i < TOTAL; i++) if (!INTRO[i] && f(getLevel(i))) return i; };
      startLevel(12, true); L.energy = 0.3; __sim(2);
      out.energyRunsOut = screen === "fail";
      startLevel(12, true); L.energy = 30; Object.assign(L.lumi, { x: L.lights[0].x, y: L.lights[0].y }); __sim(0.1);
      out.lightRefillsEnergy = L.energy > 60;
      startLevel(cardLevel("gloom"), true);
      const g = L.gloom[0]; g.hunt = 4; Object.assign(L.lumi, { x: g.x + 1.2, y: g.y });
      const e0 = L.energy; __sim(1.5);
      out.gloomlingCostsLight = L.hits === 1 && L.energy < e0 - 11;
      startLevel(cardLevel("runes"), true);
      out.gateStartsClosed = solidAt(Math.floor(L.gate.x), Math.floor(L.gate.y));
      const far = L.runes[0]; Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y + 3 }); L.pingCd = 0; ping(); __sim(1.2);
      out.runeIgnoresFarSongs = !far.on;
      for (const r of L.runes) { Object.assign(L.lumi, { x: r.x, y: r.y }); L.pingCd = 0; ping(); __sim(0.6); }
      out.gateOpensWhenAllRunesHear = L.gate.open > 0 && !solidAt(Math.floor(L.gate.x), Math.floor(L.gate.y));
      startLevel(cardLevel("rescue"), true);
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(0.3);
      out.portalSleepsWithoutMoth = !L.ending;
      Object.assign(L.lumi, { x: L.baby.x, y: L.baby.y }); __sim(0.2);
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.6);
      out.mothRescueFinishes = screen === "result";
      startLevel(cardLevel("quiet"), true);
      for (let k = 0; k < 20; k++) { L.pingCd = 0; ping(); }
      out.quietCaveLimitsSongs = L.pings === L.songLimit;
      startLevel(cardLevel("race"), true); L.timeLeft = 0.4; __sim(2);
      out.raceRunsOut = screen === "fail" && L.failWhy === "time";
      save.settings.relaxed = true;
      startLevel(cardLevel("race"), true);
      out.relaxedHasNoTimerOrEnergy = !L.timeLeft && !L.useEnergy;
      startLevel(cardLevel("gloom"), true);
      out.relaxedHasNoHushlings = L.gloom.length === 0;
      save.settings.relaxed = false;
      startLevel(cardLevel("dark"), true);
      out.darkCaveHidesLights = L.dark && L.lights.every(o => !L.seen[o.i]);
      save.settings.glow = true; startLevel(cardLevel("dark"), true);
      out.guidingGlowLightsDarkCaves = !L.dark;
      save.settings.glow = false;
      const tall = find(lv => lv.map.length === 34);
      startLevel(tall, true);
      const oy = OY; L.lumi.y = 3.5; __sim(1.5);
      out.cameraFollowsInTallCaves = L.scroll && OY > oy + 100;
      startLevel(DAILY, true);
      if (L.baby) { Object.assign(L.lumi, { x: L.baby.x, y: L.baby.y }); __sim(0.2); }
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.5);
      out.dailyStartsStreak = save.daily.streak >= 1 && save.daily.last === dayKey();
      // Thornlings patrol and cost light when touched.
      startLevel(cardLevel("thorns"), true);
      const th = L.thorns[0], p0 = [th.x, th.y]; __sim(0.5);
      out.thornlingsPatrol = Math.hypot(th.x - p0[0], th.y - p0[1]) > 0.2;
      const e1 = L.energy; Object.assign(L.lumi, { x: th.x, y: th.y }); __sim(0.05);
      out.thornlingsCostLight = L.hits >= 1 && L.energy < e1 - 10;
      // Long songs reach further than short ones.
      startLevel(12, true); L.pingCd = 0; ping(false); const shortRange = L.waves[0].range;
      L.waves = []; L.pingCd = 0; ping(true);
      out.longSongReachesFurther = L.waves[0].range > shortRange + 3;
      // Echo crystals sing a song onward.
      const ew = find(lv => lv.map.join("").includes("W"));
      startLevel(ew, true);
      const j = [...L.echoWalls][0], ex = j % L.cols, ey = (j / L.cols) | 0;
      const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [ex + dx, ey + dy]).find(([x, y]) => !solidAt(x, y));
      Object.assign(L.lumi, { x: spot[0] + 0.5, y: spot[1] + 0.5 }); L.pingCd = 0; ping(); __sim(0.4);
      out.echoCrystalBouncesSongs = L.waves.some(w => w.echo);
      // Sleeping Snoozles snore little pulses of light.
      startLevel(named("Sleepy Hollow"), true); __sim(5);
      out.snoozlesSnore = L.critters.some(c => c.snoreT != null) && L.critters.every(c => c.snoreT > 0);
      // Lumi's family.
      save.settings.controls = "dual";
      const fl = familyLevel(1);
      startLevel(fl, true);
      out.familyHidesInEachWorld = !!L.family;
      Object.assign(L.lumi, { x: L.family.x, y: L.family.y }); __sim(0.2);
      out.familyCanBeFound = !!(save.family && save.family[1]);
      // The Great Hush guards world finales from World 4.
      startLevel(79, true);
      out.greatGloomInFinales = L.gloom.some(g => g.big);
      // Weekly cave.
      startLevel(WEEKLY, true);
      if (L.baby) { Object.assign(L.lumi, { x: L.baby.x, y: L.baby.y }); __sim(0.2); }
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.5);
      out.weeklyCaveFinishes = screen === "result" && (save.weekly || {})[weekNumber()] >= 1;
      out.resultMapIsDrawn = document.getElementById("resultMap").width > 50;
      // Tap to move: Lumi finds its own way to a tapped tile.
      save.settings.controls = "tap";
      startLevel(1, true);
      travelTo(OX + 1.5 * TS, OY + 4.5 * TS);
      __sim(12, () => (L.autoPath ? undefined : false));
      out.tapToMoveArrives = Math.hypot(L.lumi.x - 1.5, L.lumi.y - 4.5) < 0.6;
      save.settings.controls = "stick";
      // Wide caves scroll sideways.
      const wide = find(lv => lv.map[0].length > 11);
      startLevel(wide, true);
      L.lumi.x = 1.5; __sim(1.5); const ox = OX;
      L.lumi.x = L.cols - 1.5; __sim(1.5);
      out.wideCavesScrollSideways = L.scrollX && OX < ox - 60;
      return out;
    });
    for (const [k, v] of Object.entries(m)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Screens
  section("Screens");
  {
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const s = await page.evaluate(() => {
      const out = {}, on = id => document.getElementById(id).classList.contains("on");
      showTitle(); out.title = on("titleScreen");
      openMap(); out.map = on("levelScreen") && document.querySelectorAll("#levelGrid .node").length === 20;
      renderLevels(49); out.lastWorld = document.getElementById("worldName").textContent.length > 0;
      renderLooks(); show("looks"); out.looks = document.querySelectorAll("#looksGrid .look").length === SKINS.length;
      renderAwards(); show("awards"); out.awards = document.querySelectorAll("#awardsList .award").length === ACHS.length;
      renderSettings(); show("settings"); out.settings = on("settingsScreen");
      renderChallenges(); show("challenges"); out.challenges = on("challengeScreen") && document.getElementById("weeklyInfo").textContent.length > 5;
      renderAwards(); awardsTab(true); show("awards"); out.journal = !document.getElementById("journal").hidden && document.querySelectorAll("#journal .award").length === JOURNAL.length + Object.keys(VARIANTS).length;
      renderHats(); out.accessories = document.querySelectorAll("#hatsGrid .look").length === HATS.length;
      // Daily ritual: today's card, its twist, quests, Lumi's home and the shared result.
      renderTitle(); out.todayCardShowsTheTwist = document.getElementById("todayName").textContent.includes(twistFor().name);
      out.dailyCaveHasTodaysTwist = getLevel(DAILY).twist === twistFor().id && getLevel(DAILY).map.length === 18;
      out.threeDistinctQuestsToday = new Set(todayQuests().map(q => q.id)).size === 3;
      save.glow = 100; renderHome(); show("home");
      out.homeShows = on("homeScreen") && document.querySelectorAll("#homeShop .shop-item").length === HOME_ITEMS.length && document.querySelectorAll("#homeQuests li").length === 3;
      document.querySelector("#homeShop .shop-item").click();
      out.buyingDecorSpendsGlow = save.glow === 80 && save.home.shrooms === 1 && document.getElementById("homeScene").innerHTML.includes("translate(46 150)");
      const d0 = save.daily; save.daily = { last: dayKey(dayNumber() - 3), streak: 9, best: 9, stars: {}, shields: 2 };
      dailyCleared(2); out.streakShieldsCoverMissedDays = save.daily.streak === 10 && save.daily.shields === 0;
      save.daily = { last: dayKey(dayNumber() - 3), streak: 9, best: 9, stars: {}, shields: 1 };
      dailyCleared(2); out.missingTooManyDaysResetsTheStreak = save.daily.streak === 1;
      save.daily = d0;
      save.story = {}; startLevel(0); out.story = screen === "story";
      document.getElementById("storyGo").click(); out.storyLeadsToLevel = screen === "play";
      save.cards = {}; startLevel(cardLevel("runes"), { story: true }); out.card = screen === "card";
      document.getElementById("cardGo").click(); out.cardLeadsToLevel = screen === "play" && L.def.name === "Listening Stones";
      pause(); out.pauseShowsGoal = screen === "pause" && document.getElementById("pauseGoal").textContent.length > 5;
      resume();
      return out;
    });
    // The phone's Back button pauses, then goes to the map, then to the title.
    const backs = [];
    for (let k = 0; k < 3; k++) { await page.goBack(); await page.waitForTimeout(150); backs.push(await page.evaluate(() => screen)); }
    s.backButtonStaysInGame = backs.join(",") === "pause,levels,title";
    Object.assign(s, await page.evaluate(() => {
      const out = {};
      // Back up and restore.
      save.stars[0] = 3; save.stars[1] = 2;
      const code = saveCode();
      save.stars = [];
      document.getElementById("saveCode").value = code;
      document.getElementById("restoreCode").click();
      out.backupRestores = save.stars[0] === 3 && save.stars[1] === 2;
      document.getElementById("saveCode").value = "nonsense";
      document.getElementById("restoreCode").click();
      out.badCodeIsHarmless = save.stars[0] === 3;
      return out;
    }));
    for (const [k, v] of Object.entries(s)) check(k.replace(/([A-Z])/g, " $1").toLowerCase(), v);
    for (const size of [{ width: 360, height: 640 }, { width: 430, height: 932 }, { width: 820, height: 1180 }]) {
      const { page: p2, errors: e2 } = await openGame(browser, size);
      const wide = await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      check(`no sideways scrolling at ${size.width}×${size.height}`, wide);
      check(`no page errors at ${size.width}×${size.height}`, e2.length === 0, e2[0]);
      await p2.close();
    }
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Robot play-through
  if (!QUICK) {
    section(`Robot play-through (${ALL ? "every level" : "sample of levels"})`);
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const sample = [];
    if (ALL) { for (let i = 0; i < 1000; i++) sample.push(i); sample.push(-1); }
    else {
      for (let i = 0; i < 10; i++) sample.push(i);
        for (let i = 10; i < 19; i++) sample.push(i);
      for (let i = 11; i < 400; i += 5) sample.push(i);
    }
    const res = await page.evaluate(list => {
      // A simple robot: walk tile paths to each light, the lost moth and each rune, then the
      // portal. Sing every few seconds, at closed doors and at runes.
      const out = [];
      for (const n of list) {
        startLevel(n, true);
        let target = null, path = [], lastSong = -9, stuckFor = 0, best = Infinity, reason = "";
        const blocked = (x, y) => {
          if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return true;
          const t = L.tile[y * L.cols + x];
          if (t === "#") return true;
          if (t === "G" && !L.gate.open) return true;
          return L.critters.some(c => Math.floor(c.hx) === x && Math.floor(c.hy) === y);
        };
        const route = (tx, ty) => {
          // Shortest swim, where going straight up a current counts as several tiles, the way a
          // player would rather go around if there's a reasonable way.
          const sx = Math.floor(L.lumi.x), sy = Math.floor(L.lumi.y), prev = new Map([[sx + "," + sy, null]]);
          const cost = new Map([[sx + "," + sy, 0]]), q = [[0, sx, sy]];
          while (q.length) {
            let m = 0;
            for (let j = 1; j < q.length; j++) if (q[j][0] < q[m][0]) m = j;
            const [c, x, y] = q.splice(m, 1)[0];
            if (c > cost.get(x + "," + y)) continue;
            if (x === tx && y === ty) break;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const k = (x + dx) + "," + (y + dy);
              if (blocked(x + dx, y + dy)) continue;
              const fl = L.flow[(y + dy) * L.cols + x + dx], nc = c + (fl && fl[0] === -dx && fl[1] === -dy ? 4 : 1);
              if (cost.has(k) && cost.get(k) <= nc) continue;
              cost.set(k, nc); prev.set(k, [x, y]);
              q.push([nc, x + dx, y + dy]);
            }
          }
          const p = [];
          for (let c = [tx, ty]; c; c = prev.get(c + "")) p.unshift(c);
          return prev.has(tx + "," + ty) ? p : null;
        };
        const pickTarget = () => {
          const list = [];
          for (const o of L.lights) if (!o.got) list.push([o.x, o.y]);
          if (L.baby && !L.baby.following) list.push([L.baby.hx, L.baby.hy]);
          for (const r of L.runes) if (!r.on) list.push([r.x, r.y]);
          let bestT = null, bestLen = Infinity;
          for (const t of list) { const p = route(Math.floor(t[0]), Math.floor(t[1])); if (p && p.length < bestLen) { bestLen = p.length; bestT = t; } }
          return bestT || [L.exit.x, L.exit.y];
        };
        const sing = t => { if (L.songLimit && L.pings >= L.songLimit - 1) return; L.pingCd = 0; ping(); lastSong = t; };
        const time = __sim(150, t => {
          if (L.ending || L.failing) return;
          if (!target || Math.hypot(target[0] - L.lumi.x, target[1] - L.lumi.y) < 0.35) {
            if (target) for (const r of L.runes) if (!r.on && Math.hypot(r.x - L.lumi.x, r.y - L.lumi.y) < 0.6) sing(t);
            target = pickTarget(); path = route(Math.floor(target[0]), Math.floor(target[1])) || []; best = Infinity;
          }
          // A careful player sings less when a Hushling is close, so as not to wake it.
          const gloomNear = L.gloom.some(gl => !gl.gone && !gl.calm && Math.hypot(gl.x - L.lumi.x, gl.y - L.lumi.y) < 6) ||
            L.mobs.some(mb => mb.kind === "a" && mb.state === "idle" && Math.hypot(mb.x - L.lumi.x, mb.y - L.lumi.y) < 6.5);
          if (t - lastSong > (L.songLimit ? 9 : gloomNear ? 7 : 3)) sing(t);
          const cx = Math.floor(L.lumi.x), cy = Math.floor(L.lumi.y);
          let k = path.findIndex(p => p[0] === cx && p[1] === cy);
          const next = path[Math.min(path.length - 1, k + 1)] || [Math.floor(target[0]), Math.floor(target[1])];
          if (L.tile[next[1] * L.cols + next[0]] === "D" && L.door[next[1] * L.cols + next[0]] <= 0 && L.pingCd <= 0) sing(t);
          const dx = next[0] + 0.5 - L.lumi.x, dy = next[1] + 0.5 - L.lumi.y;
          // Like a careful player, wait for a Thornling to pass instead of swimming into it.
          const hazards = L.thorns.concat(L.mobs.filter(mb => mb.kind !== "w" && (mb.kind !== "n" || mb.state !== "idle")));
          const danger = hazards.some(th => Math.hypot(th.x - (next[0] + 0.5), th.y - (next[1] + 0.5)) < 1.15 && Math.hypot(th.x - L.lumi.x, th.y - L.lumi.y) > 0.75);
          const wait = danger && (L.waitFor = (L.waitFor || 0) + 1 / 60) < 4;
          if (!danger) L.waitFor = 0;
          keys.arrowright = !wait && dx > 0.15; keys.arrowleft = !wait && dx < -0.15; keys.arrowdown = !wait && dy > 0.15; keys.arrowup = !wait && dy < -0.15;
          if (wait) stuckFor = 0;

          // Progress is measured along the path, since winding caves often lead away first.
          const d = (k >= 0 ? path.length - k : path.length + 5) + Math.hypot(next[0] + 0.5 - L.lumi.x, next[1] + 0.5 - L.lumi.y) * 0.1;
          if (d < best - 0.05) { best = d; stuckFor = 0; } else stuckFor += 1 / 60;
          if (stuckFor > 12) { reason = `stuck near ${cx},${cy}`; return false; }
        });
        for (const k of ["arrowright", "arrowleft", "arrowup", "arrowdown"]) keys[k] = false;
        const done = screen === "result" || (L.ending && (__sim(2), screen === "result"));
        if (!done && !reason) reason = L.failing ? (L.failWhy === "time" ? "ran out of time" : "ran out of light") : "timed out";
        out.push({ n, done, reason, time: Math.round(time), pings: L.pings, par: L.def.par, energy: Math.round(L.energy), goal: L.goal });
      }
      return out;
    }, sample);
    const fails = res.filter(r => !r.done);
    // The robot is a simple player (it waits for patrols but can't dodge well), so a handful of
    // the very hardest caves may beat it. More than 1% means something is genuinely unfair.
    const list = fails.slice(0, 12).map(f => `${f.n < 0 ? "daily" : "level " + (f.n + 1)} (${f.goal}): ${f.reason}`).join("; ");
    check(`robot finished ${res.length - fails.length} of ${res.length} sampled levels (at least 99%)`, fails.length <= res.length * 0.01, list);
    if (fails.length) console.log(`        hardest caves for the robot: ${list}`);
    const lowLight = res.filter(r => r.done && r.energy > 0 && r.energy < 15 && r.n >= 10);
    console.log(`        balance: ${lowLight.length} finished levels ended with under 15% light; ` +
      `the robot sang ${Math.round(res.reduce((a, r) => a + r.pings / r.par, 0) / res.length * 100)}% of par on average`);
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Chaos
  if (!QUICK) {
    section("Chaos: random controls on random levels");
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const c = await page.evaluate(() => {
      let seed = 12345, problems = [];
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 40; k++) {
        const n = k < 4 ? [DAILY, 40, 84, 100][k] : Math.floor(rnd() * 400);
        startLevel(n, true);
        __sim(20, t => {
          if (rnd() < 0.05) for (const d of ["arrowright", "arrowleft", "arrowup", "arrowdown"]) keys[d] = rnd() < 0.35;
          if (rnd() < 0.02) { L.pingCd = 0; ping(); }
          const x = L.lumi.x, y = L.lumi.y;
          if (!Number.isFinite(x) || !Number.isFinite(y)) { problems.push(`level ${n + 1}: Lumi position became ${x},${y}`); return false; }
          if (!L.ending && solidAt(Math.floor(x), Math.floor(y))) { problems.push(`level ${n + 1}: Lumi inside rock at ${x.toFixed(2)},${y.toFixed(2)}`); return false; }
        });
        for (const d of ["arrowright", "arrowleft", "arrowup", "arrowdown"]) keys[d] = false;
      }
      return problems;
    });
    check("Lumi never ends up inside rock or off the map", c.length === 0, c.slice(0, 4).join("; "));
    check("no page errors", errors.length === 0, errors[0]);
    await page.close();
  }

  // ---------------------------------------------------------------- Speed
  section("Speed (report only; headless browsers have no graphics chip)");
  {
    const { page } = await openGame(browser);
    for (const rows of [18, 34]) {
      const i = await page.evaluate(r => { for (let i = 85; i < TOTAL; i++) if (!INTRO[i] && getLevel(i).map.length === r) return i; }, rows);
      const ms = await page.evaluate(i => { const t = performance.now(); startLevel(i, true); return performance.now() - t; }, i);
      const fps = await page.evaluate(() => new Promise(done => {
        let n = 0; const start = performance.now();
        const tick = now => { n++; if (n % 20 === 0) { L.pingCd = 0; ping(); } if (now - start < 2000) requestAnimationFrame(tick); else done(Math.round(n / ((now - start) / 1000))); };
        requestAnimationFrame(tick);
      }));
      console.log(`        ${rows}-row cave (level ${i + 1}): builds in ${Math.round(ms)} ms, ${fps} frames per second`);
    }
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed in ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

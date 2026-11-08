// Echo test suite. Run from the repository folder with:
//   npm install   (once, installs Playwright)
//   npm test
// It opens echo.html in a headless browser at phone size and checks the levels, the gameplay,
// every screen, a robot play-through of a sample of levels, random-input "chaos" play, and speed.
// Add --quick to skip the slow robot and chaos sections, or --all to have the robot play every level.

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

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
  page.setDefaultNavigationTimeout(120000);  // the 3D view is slow without a graphics chip
  // Three.js for the 3D view comes from a CDN in the game; tests serve the same version from
  // node_modules (npm install), so they run offline and exercise the 3D renderer too.
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\//, route => {
    const file = path.resolve(__dirname, "..", "node_modules", "three", route.request().url().split("three@0.128.0/")[1]);
    if (fs.existsSync(file)) route.fulfill({ path: file, contentType: "application/javascript" });
    else route.abort();
  });
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
      const bad = [];
      const one = (lv, i) => {
        const m = lv.map, R = m.length;
        const Wd = m[0].length;
        if (![11, 17].includes(Wd) || m.some(row => row.length !== Wd)) return bad.push(i + ": wrong width");
        if ([...m[0], ...m[R - 1]].some(c => c !== "#") || m.some(row => row[0] !== "#" || row[Wd - 1] !== "#")) return bad.push(i + ": open border");
        let S, X;
        const goals = [];
        m.forEach((row, y) => [...row].forEach((c, x) => {
          if (c === "S") S = [x, y];
          if (c === "E") X = [x, y];
          if ("omfRl1234".includes(c)) goals.push([x, y]);
        }));
        if (!S || !X) return bad.push(i + ": missing start or portal");
        const seen = new Set([S + ""]), q = [S];
        while (q.length) {
          const [x, y] = q.shift();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, c = m[ny] && m[ny][nx];
            if (!c || c === "#" || c === "W" || c === "z" || c === "G" || seen.has(nx + "," + ny)) continue;
            seen.add(nx + "," + ny); q.push([nx, ny]);
          }
        }
        for (const g of [X, ...goals]) if (!seen.has(g + "")) bad.push(`${i}: ${m[g[1]][g[0]]} at ${g} can't be reached`);
        if (lv.goal === "rescue" && !m.join("").includes("m")) bad.push(i + ": rescue level without a moth");
      };
      for (let i = 0; i < TOTAL; i++) one(getLevel(i), i);
      one(getLevel(DAILY), "daily");
      const names = new Set(CORE_LEVELS.map(l => l.name));
      const flat = i => getLevel(i).map.join("");
      return {
        bad, ten: TOTAL === 10 && names.size === 10,
        startsGentle: [0, 1, 2].every(i => !/[gB]/.test(flat(i))),
        hushlingsArrive: /g/.test(flat(3)),
        stonesAppear: /R/.test(flat(4)),
        endsWithTheGreatHush: /B/.test(flat(9)) && STORY_FINALE === 9,
      };
    });
    check("the ten caves and the daily cave are well formed and completable", r.bad.length === 0, r.bad.slice(0, 5).join("; "));
    check("there are ten handmade caves, each with its own name", r.ten);
    check("the first three caves have no Hushlings", r.startsGentle);
    check("Hushlings arrive in cave 4", r.hushlingsArrive);
    check("ring stones arrive in cave 5", r.stonesAppear);
    check("the last cave is the Great Hush", r.endsWithTheGreatHush);
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
      // Tunnel assist: starting half a tile off a narrow opening still gets Lumi through.
      startLevel(0, true);
      Object.assign(L.lumi, { x: 4.4, y: 13.5, vx: 0, vy: 0 });
      keys.arrowup = true; __sim(0.8); keys.arrowup = false;
      out.tunnelAssist = L.lumi.y < 12.2 && Math.abs(L.lumi.x - 5.5) < 0.3;
      startLevel(0, true);
      keys.arrowup = true; keys.shift = true; __sim(0.6); const sneak = Math.hypot(L.lumi.vx, L.lumi.vy); keys.arrowup = false; keys.shift = false;
      out.shiftSneaksAtHalfSpeed = sneak > 1.5 && sneak < SWIM_MAX * 0.6;
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

  // ---------------------------------------------------------------- The core rules
  section("Echoes, sound and blind Hushlings");
  {
    const { page, errors } = await openGame(browser);
    await page.evaluate(SIM);
    const m = await page.evaluate(() => {
      const out = {};
      const only = n => { L.gloom = L.gloom.slice(0, n); };
      // Echoes light the walls, then the memory of them fades.
      startLevel(1, true);
      L.pingCd = 0; ping(); __sim(1);
      const lit = [...Array(L.n).keys()].filter(i => vis(i) > 0.3 && Math.hypot(i % L.cols + 0.5 - L.lumi.x, ((i / L.cols) | 0) + 0.5 - L.lumi.y) > 3);
      out.songShowsTheWalls = lit.length >= 8;
      __sim(13);
      out.memoryFades = lit.every(i => vis(i) < 0.06);
      out.songsAreFree = L.energy === 100;
      // A Hushling hears a song nearby and goes to where it was sung, not to Lumi.
      startLevel(3, true); only(1);
      const g = L.gloom[0];
      Object.assign(L.lumi, { x: 5.5, y: 10.5 }); L.pingCd = 0; ping();
      out.hushlingHearsNearbySong = g.hunt > 0 && g.lx === 5.5 && g.ly === 10.5;
      const d0 = Math.hypot(g.x - 5.5, g.y - 10.5);
      Object.assign(L.lumi, { x: 1.5, y: 4.5 }); __sim(1.2);
      out.hushlingGoesToTheSong = Math.hypot(g.x - 5.5, g.y - 10.5) < d0 - 1.5;
      startLevel(3, true); only(1);
      Object.assign(L.lumi, { x: 5.5, y: 13.5 }); L.pingCd = 0; ping(false);
      out.farTapIsNotHeard = L.gloom[0].hunt === 0;
      L.pingCd = 0; ping(true);
      out.longSongIsHeardFurther = L.gloom[0].hunt > 0;
      L.waves = []; L.pingCd = 0; ping(false); const shortRange = L.waves[0].range;
      L.waves = []; L.pingCd = 0; ping(true);
      out.longSongReachesFurther = L.waves[0].range > shortRange + 3;
      // Swimming fast is heard; swimming slowly is silent.
      const pass = speed => {
        startLevel(5, true);
        Object.assign(L.lumi, { x: 5.5, y: 11.5, vx: 0, vy: 0 });
        __sim(0.5, () => { L.lumi.vx = 0; L.lumi.vy = -speed; });
        return L.gloom.some(q => q.hunt > 0);
      };
      out.slowSwimIsSilent = !pass(1.6);
      out.fastSwimIsHeard = pass(SWIM_MAX);
      // A song reaching a ring stone makes it ring, and the Hushling goes to the stone.
      startLevel(4, true);
      const st = L.stones[0], h = L.gloom[0];
      Object.assign(L.lumi, { x: 6.5, y: 14.5 }); L.pingCd = 0; ping();
      out.farFromItTheSongIsNotHeard = h.hunt === 0;
      __sim(1.6);
      out.ringStoneRings = st.cd > 0;
      out.stoneCallsTheHushling = h.hunt > 0 && h.lx === st.x && h.ly === st.y;
      __sim(4);
      out.hushlingGoesToTheStone = Math.hypot(h.x - st.x, h.y - st.y) < 1.2;
      // Pebbles: thrown the way Lumi faces, they clatter where they land and Hushlings go to look.
      startLevel(5, true);
      out.lumiCarriesThreePebbles = L.pebblesLeft === 3;
      Object.assign(L.lumi, { x: 5.5, y: 13.5, look: -Math.PI / 2 }); throwPebble(); __sim(1);
      const pb = L.gloom.find(q => q.hunt > 0);
      out.pebbleClattersAndIsHeard = L.pebblesLeft === 2 && !!pb && pb.ly < 12 && Math.abs(pb.lx - 5.5) < 0.01;
      // Light is health: three touches and the try is over.
      startLevel(3, true); only(1);
      const hu = L.gloom[0];
      for (let k = 0; k < 3; k++) { L.invuln = 0; hu.gone = 0; hu.calm = 0; hu.hunt = 2; Object.assign(L.lumi, { x: hu.x + 0.2, y: hu.y }); __sim(0.05); }
      __sim(2);
      out.threeTouchesEndTheTry = L.hits === 3 && screen === "fail";
      // Run!: a Hunter rises behind Lumi and the cave comes down.
      startLevel(6, true);
      const hunter = L.gloom.find(q => q.chaser);
      Object.assign(L.lumi, { x: 5.5, y: 17.5 }); __sim(6, () => { L.invuln = 1; });
      out.hunterChasesInRunCaves = !!hunter && Math.hypot(hunter.x - hunter.hx, hunter.y - hunter.hy) > 0.5;
      out.runCaveComesDown = L.rocks.length > 0;
      // The lost moth.
      startLevel(7, true);
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(0.3);
      out.portalSleepsWithoutMoth = !L.ending;
      Object.assign(L.lumi, { x: L.baby.x, y: L.baby.y }); __sim(0.2);
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.6);
      out.mothRescueFinishes = screen === "result";
      // The Great Hush: sing to it and it remembers.
      startLevel(9, true);
      const king = L.gloom.find(q => q.final);
      Object.assign(L.lumi, { x: king.x, y: king.y + 2 }); L.pingCd = 0; ping(); __sim(10);
      out.singingToTheGreatHushHealsIt = !!king && king.heal >= 1 && L.healed;
      // Relaxed: no Hushlings and no light to lose.
      save.settings.relaxed = true;
      startLevel(3, true);
      out.relaxedHasNoHushlingsOrLightLoss = L.gloom.length === 0 && !L.useEnergy;
      save.settings.relaxed = false;
      // The daily cave still works underneath (hidden for now).
      startLevel(DAILY, true);
      if (L.baby) { Object.assign(L.lumi, { x: L.baby.x, y: L.baby.y }); __sim(0.2); }
      L.chimeNext = L.chimes.length + 1; for (const q of L.lamps) q.on = 1;
      Object.assign(L.lumi, { x: L.exit.x, y: L.exit.y }); __sim(1.5);
      out.dailyCaveStillWorks = screen === "result";
      out.resultMapIsDrawn = document.getElementById("resultMap").width > 50;
      // Tap to move: Lumi finds its own way to a tapped tile.
      save.settings.controls = "tap";
      startLevel(1, true);
      travelTo(OX + 9.5 * TS, OY + 9.5 * TS);
      __sim(20, () => (L.autoPath ? undefined : false));
      out.tapToMoveArrives = Math.hypot(L.lumi.x - 9.5, L.lumi.y - 9.5) < 0.6;
      save.settings.controls = "stick";
      // Tall caves scroll.
      startLevel(6, true);
      const oy = OY; L.lumi.y = 3.5; __sim(1.5);
      out.cameraFollowsInTallCaves = L.scroll && OY > oy + 100;
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
      openMap(); out.map = on("levelScreen") && document.querySelectorAll("#levelGrid .node").length === TOTAL;
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
      out.storyHasPicturesAndPages = document.querySelectorAll("#storyFx i").length > 0 && document.querySelectorAll("#storyDots i").length === CORE_CHAPTER.pages.length;
      document.getElementById("storyGo").click();
      out.storyTapShowsTheWholePageFirst = story && story.k === 0 && document.getElementById("storyText").classList.contains("all");
      for (let k = 0; k < 20 && screen === "story"; k++) document.getElementById("storyGo").click();
      out.storyLeadsToLevel = screen === "play";
      out.endingTellsTheWholeStory = endingPages().length === CORE_ENDING.length;
      save.cards = {}; startLevel(6, { story: true }); out.card = screen === "card";
      document.getElementById("cardGo").click(); out.cardLeadsToLevel = screen === "play" && L.def.name === "The Hunter";
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
    const sample = [], TOTAL_LEVELS = await page.evaluate(() => TOTAL);
    for (let i = 0; i < TOTAL_LEVELS; i++) sample.push(i);
    sample.push(-1);
    const res = await page.evaluate(list => {
      const TOTAL_LEVELS = TOTAL;
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
          const chime = L.chimes.find(c => c.n === L.chimeNext);
          if (chime) list.push([chime.x, chime.y]);
          for (const q of L.lamps) if (!q.on) list.push([q.x, q.y]);
          // Running from the Hunter, a player heads for the portal and only grabs what's close.
          if (L.goal === "escape") {
            const must = L.runes.filter(r => !r.on).map(r => [r.x, r.y]);
            const near = list.filter(t => Math.hypot(t[0] - L.lumi.x, t[1] - L.lumi.y) < 3);
            list.length = 0; list.push(...must, ...near);
          }
          let bestT = null, bestLen = Infinity;
          for (const t of list) { const p = route(Math.floor(t[0]), Math.floor(t[1])); if (p && p.length < bestLen) { bestLen = p.length; bestT = t; } }
          if (!bestT && L.finale && !L.healed) { const k = L.gloom.find(g => g.final); return [k.hx, k.hy]; }
          return bestT || [L.exit.x, L.exit.y];
        };
        const sing = t => { if (L.songLimit && L.pings >= L.songLimit - 1) return; L.pingCd = 0; ping(); lastSong = t; };
        const time = __sim(150, t => {
          if (L.ending || L.failing) return;
          if (!target || Math.hypot(target[0] - L.lumi.x, target[1] - L.lumi.y) < 0.35) {
            if (target) for (const r of L.runes.concat(L.lamps)) if (!r.on && Math.hypot(r.x - L.lumi.x, r.y - L.lumi.y) < 0.6) sing(t);
            target = pickTarget(); path = route(Math.floor(target[0]), Math.floor(target[1])) || []; best = Infinity;
          }
          // A careful player sings less when a Hushling is close, so as not to wake it.
          const gloomNear = L.gloom.some(gl => !gl.gone && !gl.final && !gl.chaser && Math.hypot(gl.x - L.lumi.x, gl.y - L.lumi.y) < (CORE ? 5 : 6)) ||
            L.mobs.some(mb => mb.kind === "a" && mb.state === "idle" && Math.hypot(mb.x - L.lumi.x, mb.y - L.lumi.y) < 6.5);
          if (CORE) {
            if (!gloomNear && t - lastSong > 1.5) sing(t);
            keys.shift = L.gloom.some(gl => !gl.gone && !gl.final && !gl.chaser && Math.hypot(gl.x - L.lumi.x, gl.y - L.lumi.y) < 3.3);
          } else if (t - lastSong > (L.songLimit ? 9 : gloomNear ? 7 : 3)) sing(t);
          const cx = Math.floor(L.lumi.x), cy = Math.floor(L.lumi.y);
          let k = path.findIndex(p => p[0] === cx && p[1] === cy);
          const next = path[Math.min(path.length - 1, k + 1)] || [Math.floor(target[0]), Math.floor(target[1])];
          if (L.tile[next[1] * L.cols + next[0]] === "D" && L.door[next[1] * L.cols + next[0]] <= 0 && L.pingCd <= 0) sing(t);
          const dx = next[0] + 0.5 - L.lumi.x, dy = next[1] + 0.5 - L.lumi.y;
          // Like a careful player, wait for a Thornling to pass instead of swimming into it.
          const hazards = L.thorns.concat(L.mobs.filter(mb => mb.kind !== "w" && (mb.kind !== "n" || mb.state !== "idle")));
          const danger = hazards.some(th => Math.hypot(th.x - (next[0] + 0.5), th.y - (next[1] + 0.5)) < 1.15 && Math.hypot(th.x - L.lumi.x, th.y - L.lumi.y) > 0.75);
          // Like a player, flare when something dangerous is about to reach Lumi.
          const close = hazards.concat(L.gloom.filter(gl => gl.hunt > 0 && !gl.gone)).some(th => Math.hypot(th.x - L.lumi.x, th.y - L.lumi.y) < 1.6);
          if (close && !(L.flareCd > 0)) flare();
          const wait = danger && (L.waitFor = (L.waitFor || 0) + 1 / 60) < 4;
          if (!danger) L.waitFor = 0;
          keys.arrowright = !wait && dx > 0.15; keys.arrowleft = !wait && dx < -0.15; keys.arrowdown = !wait && dy > 0.15; keys.arrowup = !wait && dy < -0.15;
          if (wait) stuckFor = 0;

          // Progress is measured along the path, since winding caves often lead away first.
          const d = (k >= 0 ? path.length - k : path.length + 5) + Math.hypot(next[0] + 0.5 - L.lumi.x, next[1] + 0.5 - L.lumi.y) * 0.1;
          if (d < best - 0.05) { best = d; stuckFor = 0; } else stuckFor += 1 / 60;
          if (stuckFor > 12) { reason = `stuck near ${cx},${cy}`; return false; }
        });
        for (const k of ["arrowright", "arrowleft", "arrowup", "arrowdown", "shift"]) keys[k] = false;
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
    // 1% of the sample, rounded up, so the quick 97-level sample may lose one cave too.
    check(`robot finished ${res.length - fails.length} of ${res.length} sampled levels (at least 99%)`, fails.length <= Math.ceil(res.length * 0.01), list);
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
        const n = k < 1 ? DAILY : Math.floor(rnd() * TOTAL);
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
    for (const rows of [18, 26]) {
      const i = await page.evaluate(r => { for (let i = 0; i < TOTAL; i++) if (getLevel(i).map.length === r) return i; }, rows);
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

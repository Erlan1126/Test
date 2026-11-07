// Echo: the 3D view. The game itself runs exactly as in 2D (game.js, mobs.js...); this file
// draws it as a lit miniature world seen from above at an angle. Each cave's shape becomes
// sculpted rock rising out of the cave floor, wearing its world's moss, snow or ash; the dark
// stays dark until Lumi's light or a song reaches it (a shader reads the same visibility the
// 2D view uses); and everything that glows is a real light, with bloom on top.
// If WebGL or Three.js isn't available, R3D is null and the 2D view is used.
"use strict";

const R3D = (() => {
  const T = window.THREE;
  if (!T) return null;
  const view = document.createElement("canvas");
  view.id = "game3d";
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: view, antialias: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  document.body.insertBefore(view, document.getElementById("game"));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, 1, 0.1, 200);
  const hemi = new T.HemisphereLight(0x6a7ac0, 0x0a0a12, 0.32);
  scene.add(hemi);
  const key = new T.DirectionalLight(0x9fb4ff, 0.35);
  key.position.set(-3, 10, 4);
  scene.add(key);
  let composer = null, bloom = null;
  if (T.EffectComposer && T.UnrealBloomPass) {
    composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.5, 0.35, 0.85);
    composer.addPass(bloom);
  }
  const WALL = 1.05;            // how high cave rock stands
  const col = (c, k = 1) => new T.Color(Math.min(255, c[0] * k) / 255, Math.min(255, c[1] * k) / 255, Math.min(255, c[2] * k) / 255);

  // ---------- Darkness: what hasn't been revealed stays dark ----------
  let visData = new Uint8Array(4), visTex = new T.DataTexture(visData, 1, 1, T.RGBAFormat);
  const uVis = { value: visTex }, uDims = { value: new T.Vector2(1, 1) }, uLumi = { value: new T.Vector3() };
  // cut: buildings between the camera and Lumi are cut down to their ground floor, like a
  // doll's house, so Lumi is never hidden behind a wall.
  function withVis(mat, floor = 0.035, cut = false) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uVis = uVis; sh.uniforms.uDims = uDims; sh.uniforms.uLumi = uLumi;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nuniform sampler2D uVis;\nuniform vec2 uDims;\nuniform vec3 uLumi;")
        .replace("#include <fog_fragment>", `${cut ? "if (vWPos.y > 0.62 && vWPos.z > uLumi.z + 0.45 && abs(vWPos.x - uLumi.x) < 2.6 && vWPos.z < uLumi.z + 7.0) discard;" : ""}
          float visK = texture2D(uVis, vec2(vWPos.x / uDims.x, vWPos.z / uDims.y)).r;
          gl_FragColor.rgb *= mix(${floor.toFixed(3)}, 1.0, smoothstep(0.0, 0.85, visK));
          #include <fog_fragment>`);
    };
    return mat;
  }

  // ---------- Painted sprites ----------
  const tex = (w, h, draw) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  };
  const GLOWT = tex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const glow = (color, size, opacity = 1) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: GLOWT, color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    s.scale.set(size, size, 1); return s;
  };
  const card = (map, w, h) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
    s.scale.set(w, h, 1); return s;
  };
  // Fine stone grain laid over all the rock and floor: pebbles, cracks and speckle, so the
  // ground stays crisp up close. A matching height map gives it relief under the lights.
  const grain = bump => {
    const t = tex(512, 512, (g, w) => {
      g.fillStyle = bump ? "#808080" : "#c8c8c8"; g.fillRect(0, 0, w, w);
      for (let k = 0; k < 900; k++) {
        const x = Math.random() * w, y = Math.random() * w, r = 2 + Math.random() * 9, v = bump ? 90 + Math.random() * 120 : 150 + Math.random() * 90;
        g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = bump ? "#303030" : "#8a8a8a"; g.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) { let x = Math.random() * w, y = Math.random() * w; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    if (bump) t.encoding = T.LinearEncoding;
    return t;
  };
  const GRAIN = grain(false), GRAIN_B = grain(true);
  // ---------- The lost city: stone facades, ground floors, roofs, cobbled streets ----------
  // Facades are one tile wide and two floors tall; a few windows still glow (the emissive map
  // holds just the lit glass). Ground floors have doors, shop arches or blind arcades.
  const ashlar = (g, w, h, rowH, tone) => {
    g.fillStyle = `rgb(${tone - 30},${tone - 28},${tone - 22})`; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += rowH) {
      let x = -Math.random() * 40;
      while (x < w) {
        const bw = 40 + Math.random() * 46, v = tone + (Math.random() - 0.5) * 28;
        g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.fillRect(x + 2, y + 2, bw - 4, rowH - 4);
        g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(x + 2, y + 2, bw - 4, 3);
        x += bw;
      }
    }
  };
  const archPath = (g, x, y, w, h) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); };
  const repeatTex = t => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
  const facade = () => {
    const lit = [Math.random() < 0.28, Math.random() < 0.22];
    const draw = emis => (g, w, h) => {
      if (emis) { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); } else ashlar(g, w, h, 32, 128);
      for (let f = 0; f < 2; f++) {
        const fy = f * 256, x = 76, y = fy + 52, ww = 104, wh = 150;
        if (!emis) {
          g.fillStyle = "rgb(150,152,160)"; archPath(g, x - 12, y - 12, ww + 24, wh + 20); g.fill();
          g.fillStyle = "rgb(120,122,130)"; g.fillRect(x - 20, y + wh + 6, ww + 40, 14);
          g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, fy + 236, w, 20);
          g.fillStyle = "rgb(140,142,150)"; g.fillRect(0, fy + 226, w, 12);
        }
        const glass = g.createLinearGradient(0, y, 0, y + wh);
        if (lit[f]) { glass.addColorStop(0, "#ffe3a8"); glass.addColorStop(1, "#ff9a3a"); } else { glass.addColorStop(0, emis ? "#000" : "#1a2236"); glass.addColorStop(1, emis ? "#000" : "#06080e"); }
        g.fillStyle = glass; archPath(g, x, y, ww, wh); g.fill();
        if (!emis || lit[f]) {
          g.strokeStyle = emis ? "#000" : "#151319"; g.lineWidth = 7;
          g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.moveTo(x, y + wh * 0.5); g.lineTo(x + ww, y + wh * 0.5); g.stroke();
        }
        if (lit[f] && !emis) { g.fillStyle = "rgba(70,30,10,0.5)"; g.fillRect(x + 8, y + wh * 0.62, ww * 0.38, wh * 0.3); }
      }
    };
    return { map: repeatTex(tex(256, 512, draw(false))), em: repeatTex(tex(256, 512, draw(true))) };
  };
  const groundFloor = kind => {
    const draw = emis => (g, w, h) => {
      if (emis) { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); } else ashlar(g, w, h, 32, 112);
      if (kind === 0) {           // a wooden door with a lamp above
        if (!emis) {
          g.fillStyle = "rgb(140,142,150)"; archPath(g, 70, 70, 116, 186); g.fill(); g.fillStyle = "#3a2414"; archPath(g, 82, 82, 92, 174); g.fill();
          g.strokeStyle = "#1c0f07"; g.lineWidth = 4; for (let q = 1; q < 4; q++) { g.beginPath(); g.moveTo(82 + q * 23, 110); g.lineTo(82 + q * 23, 256); g.stroke(); }
        }
        g.fillStyle = emis ? "#ffb050" : "#ffd27a"; g.fillRect(118, 40, 20, 22);
      } else if (kind === 1) {    // an open shop arch, dark inside, a warm counter light
        if (!emis) { g.fillStyle = "rgb(140,142,150)"; archPath(g, 30, 60, 196, 196); g.fill(); }
        const gr = g.createLinearGradient(0, 80, 0, 256); gr.addColorStop(0, emis ? "#000" : "#07080c"); gr.addColorStop(1, emis ? "#3a1a06" : "#2a1606");
        g.fillStyle = gr; archPath(g, 44, 74, 168, 182); g.fill();
      } else if (!emis) {         // a blind arcade
        for (let q = 0; q < 2; q++) { g.fillStyle = "rgb(96,98,106)"; archPath(g, 20 + q * 118, 90, 98, 166); g.fill(); g.fillStyle = "rgba(0,0,0,0.35)"; archPath(g, 28 + q * 118, 98, 82, 158); g.fill(); }
      }
      if (!emis) { g.fillStyle = "rgb(70,72,80)"; g.fillRect(0, 236, w, 20); }
    };
    return { map: repeatTex(tex(256, 256, draw(false))), em: repeatTex(tex(256, 256, draw(true))) };
  };
  const ROOF = repeatTex(tex(256, 256, (g, w) => {
    g.fillStyle = "#3a3d48"; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 22) for (let x = -((y / 22) % 2) * 20; x < w; x += 40) { const v = 60 + Math.random() * 30; g.fillStyle = `rgb(${v},${v + 2},${v + 10})`; g.beginPath(); g.ellipse(x + 20, y + 14, 19, 12, 0, 0, Math.PI); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, w);
  }));
  const COBBLE = repeatTex(tex(512, 512, (g, w) => {
    g.fillStyle = "#121318"; g.fillRect(0, 0, w, w);
    const rows = 16, rh = w / rows;
    for (let y = 0; y < rows; y++) { let x = -Math.random() * 20; while (x < w) { const sw = rh * (0.9 + Math.random() * 0.8), v = 70 + Math.random() * 50; g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.beginPath(); if (g.roundRect) g.roundRect(x + 2, y * rh + 2, sw - 4, rh - 4, rh * 0.3); else g.rect(x + 2, y * rh + 2, sw - 4, rh - 4); g.fill(); x += sw; } }
  }));
  COBBLE.anisotropy = 8;
  const FACADES = [facade(), facade(), facade()], GROUNDS = [groundFloor(0), groundFloor(1), groundFloor(2)];
  const MIST = repeatTex(tex(256, 256, (g, w) => {
    for (let k = 0; k < 60; k++) { const x = Math.random() * w, y = Math.random() * w, r = 20 + Math.random() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }));
  const BLOB = tex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,0.8)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const LUMI_T = tex(256, 256, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c - 18, c - 4, 6, c, c + 18, 70);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, "#d6f6ff"); gr.addColorStop(1, "#7fd8f5");
    g.fillStyle = gr; g.beginPath(); g.arc(c, c + 24, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#bfefff"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(c, c - 32); g.quadraticCurveTo(c + 6, c - 62, c + 2, c - 86); g.stroke();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(c + 2, c - 90, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#123049"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * 21, c + 18, 7, 10, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(255,150,190,0.45)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * 37, c + 36, 10, 6, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#123049"; g.lineWidth = 5; g.beginPath(); g.arc(c, c + 36, 12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  });
  const hushT = (hunting, big) => tex(256, 320, (g, w) => {
    const c = w / 2, top = big ? 96 : 70;
    for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(14,8,26,${0.55 - k * 0.1})`; g.beginPath(); g.moveTo(c - 70 + k * 12, 196); g.quadraticCurveTo(c - 30 + k * 18, 272, c - 10 + k * 22, 314); g.quadraticCurveTo(c + 10 + k * 8, 262, c + 70 - k * 12, 196); g.fill(); }
    const body = g.createRadialGradient(c - 20, top + 40, 10, c, top + 80, 110);
    body.addColorStop(0, hunting ? "#3c1c52" : "#2a1840"); body.addColorStop(0.7, "#140a22"); body.addColorStop(1, "#06030c");
    g.fillStyle = body;
    g.beginPath(); g.moveTo(c - 82, 206); g.bezierCurveTo(c - 92, 126, c - 70, top + 20, c - 50, top + 14); g.lineTo(c - 72, top - 40); g.lineTo(c - 22, top + 2);
    g.quadraticCurveTo(c, top - 4, c + 22, top + 2); g.lineTo(c + 72, top - 40); g.lineTo(c + 50, top + 14); g.bezierCurveTo(c + 70, top + 20, c + 92, 126, c + 82, 206); g.quadraticCurveTo(c, 240, c - 82, 206); g.fill();
    g.strokeStyle = "rgba(170,120,255,0.5)"; g.lineWidth = 4; g.stroke();
    if (big) { g.fillStyle = "#0c0616"; for (const [ox, hh] of [[-30, 40], [0, 58], [30, 40]]) { g.beginPath(); g.moveTo(c + ox - 12, top + 4); g.lineTo(c + ox, top - hh); g.lineTo(c + ox + 12, top + 4); g.fill(); } }
    const eye = hunting ? "#ff9ad0" : "#c9a8ff";
    for (const s of [-1, 1]) {
      g.save(); g.translate(c + s * 30, top + 70); g.rotate(hunting ? s * 0.35 : 0);
      g.shadowColor = eye; g.shadowBlur = 24; g.fillStyle = eye; g.beginPath(); g.ellipse(0, 0, 18, hunting ? 8 : 13, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.ellipse(2, 0, 5, hunting ? 4 : 7, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (hunting) { g.strokeStyle = "#ff9ad0"; g.lineWidth = 4; g.beginPath(); for (let q = 0; q <= 6; q++) g.lineTo(c - 34 + q * 11.3, top + 110 + (q % 2) * 10); g.stroke(); }
  });
  const HUSH = { calm: hushT(false, false), hunt: hushT(true, false), bigCalm: hushT(false, true), bigHunt: hushT(true, true) };
  const THORN_T = tex(128, 128, (g, w) => {
    const c = w / 2;
    g.strokeStyle = "#ff7a4a"; g.lineWidth = 6; g.lineCap = "round";
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 22, c + Math.sin(a) * 22); g.lineTo(c + Math.cos(a) * 54, c + Math.sin(a) * 54); g.stroke(); }
    const gr = g.createRadialGradient(c - 8, c - 8, 4, c, c, 30); gr.addColorStop(0, "#a8402c"); gr.addColorStop(1, "#4a120c");
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffd0b0"; for (const s of [-1, 1]) { g.beginPath(); g.arc(c + s * 10, c - 4, 5, 0, Math.PI * 2); g.fill(); }
  });
  const SNOOZE_T = tex(128, 96, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2 - 14, h / 2 - 10, 4, w / 2, h / 2 + 10, 56); gr.addColorStop(0, "#c6a8ff"); gr.addColorStop(1, "#6a4aa8");
    g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h / 2 + 10, 54, 36, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#3a2470"; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * 16, h / 2 + 6, 7, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
  });
  const MOTH_T = tex(128, 128, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#e8ffd8"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * 22, c, 22, 32, s * 0.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#fff8d0"; g.beginPath(); g.ellipse(c, c, 6, 16, 0, 0, Math.PI * 2); g.fill();
  });
  // The other creatures are drawn once with their own 2D painting code.
  const mobT = {};
  function mobTexture(kind) {
    if (mobT[kind]) return mobT[kind];
    const fn = { n: window.drawSnapvine, a: window.drawShardbat, k: window.drawCrab, w: window.drawWisp, j: window.drawJelly }[kind];
    mobT[kind] = tex(192, 192, g => {
      const saved = ctx;
      try {
        ctx = g;
        const m = { kind, x: 0, y: 0, hx: 0, hy: 0, bx: 0, by: 0, tx: 0, ty: 0, ph: 0, state: "idle", t: 0, cd: 0, dir: 1, open: 0.5 };
        if (typeof fn === "function") fn(m, 96, 96, 110);
      } catch (e) {
        g.fillStyle = "#c86a4a"; g.beginPath(); g.arc(96, 96, 40, 0, Math.PI * 2); g.fill();
      } finally { ctx = saved; }
    });
    return mobT[kind];
  }

  // ---------- The level ----------
  let built = null, root = new T.Group(), dyn = new T.Group();
  scene.add(root); scene.add(dyn);
  const pools = {};
  // Reuse sprites/meshes between frames: pool(name, make)(k) returns the k-th object.
  const pool = (name, make) => k => {
    const p = pools[name] || (pools[name] = []);
    while (p.length <= k) { const o = make(); dyn.add(o); p.push(o); }
    p[k].visible = true;
    return p[k];
  };
  const hideAll = () => { for (const p of Object.values(pools)) for (const o of p) o.visible = false; };
  const lightPool = Array.from({ length: 7 }, () => { const l = new T.PointLight(0xffffff, 0, 6, 1.6); scene.add(l); return l; });
  const lumiLight = new T.PointLight(0x9feeff, 1.2, 7, 1.5); scene.add(lumiLight);
  // Lumi's light also shines down from just above it and casts real shadows: the buildings
  // throw long shadows across the street as Lumi swims past.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const lumiSpot = new T.SpotLight(0xa8f0ff, 3.2, 11, 1.25, 0.65, 1.4);
  lumiSpot.castShadow = true;
  lumiSpot.shadow.mapSize.set(1024, 1024); lumiSpot.shadow.camera.near = 0.2; lumiSpot.shadow.camera.far = 12; lumiSpot.shadow.bias = -0.002;
  scene.add(lumiSpot); scene.add(lumiSpot.target);
  // Fireflies and dust: the dark is never quite still.
  const FLIES = 160, flyGeo = new T.BufferGeometry(), flyPos = new Float32Array(FLIES * 3), flyCol = new Float32Array(FLIES * 3), flySeed = new Float32Array(FLIES * 4);
  flyGeo.setAttribute("position", new T.BufferAttribute(flyPos, 3)); flyGeo.setAttribute("color", new T.BufferAttribute(flyCol, 3));
  const flies = new T.Points(flyGeo, new T.PointsMaterial({ map: GLOWT, size: 0.13, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  scene.add(flies);
  // Two thin layers of mist drifting along the streets.
  const mists = [0.12, 0.45].map((y, k) => {
    const map = MIST.clone(); map.needsUpdate = true;
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map, transparent: true, opacity: 0.16 - k * 0.05, depthWrite: false, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m;
  });
  let cityMats = [];
  const songLight = new T.PointLight(0xb0f2ff, 0, 1, 1.2); scene.add(songLight);
  const lumiCard = card(LUMI_T, 0.95, 0.95); lumiCard.renderOrder = 5; scene.add(lumiCard);
  const lumiGlow = glow(0x7ee8ff, 2.2, 0.45); lumiGlow.renderOrder = 2; scene.add(lumiGlow);
  const sparkGeo = new T.BufferGeometry(), SPARKS = 320, sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3);
  sparkGeo.setAttribute("position", new T.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new T.BufferAttribute(sparkCol, 3));
  const sparks = new T.Points(sparkGeo, new T.PointsMaterial({ map: GLOWT, size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  scene.add(sparks);
  const SPARK_RGB = { skin: [0.6, 0.95, 1], gold: [1, 0.8, 0.45], violet: [0.75, 0.55, 1], pink: [1, 0.6, 0.85], ember: [1, 0.5, 0.25], green: [0.6, 1, 0.7], cyan: [0.55, 0.9, 1], white: [1, 1, 1] };

  function build() {
    scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    root = new T.Group(); scene.add(root);
    for (const p of Object.values(pools)) for (const o of p) dyn.remove(o);
    for (const k in pools) delete pools[k];
    const { cols, rows } = L, th = themeOf(levelIndex), mat = SURFACES[themeIndex(levelIndex)], shape = levelShape();
    visData = new Uint8Array(cols * rows * 4);
    visTex.dispose();
    visTex = new T.DataTexture(visData, cols, rows, T.RGBAFormat);
    visTex.magFilter = visTex.minFilter = T.LinearFilter;
    uVis.value = visTex; uDims.value.set(cols, rows);
    const fogCol = col(th.deep, 0.55);
    scene.fog = new T.FogExp2(fogCol, 0.014);
    renderer.setClearColor(fogCol);
    hemi.color = col(th.rim, 0.55); hemi.groundColor = col(th.deep, 0.5);

    // Sculpted terrain: a fine grid over the cave whose height follows the rock field.
    const PAD = 7, S = 5, gw = (cols + PAD * 2) * S + 1, gh = (rows + PAD * 2) * S + 1;
    const posA = new Float32Array(gw * gh * 3), colA = new Float32Array(gw * gh * 3), uvA = new Float32Array(gw * gh * 2);
    const floorC = col(th.floor, 0.95), floor2 = col(th.floor2, 0.95), rockC = col(th.rock, 0.7), deepC = col(th.deep, 1.2), topC = mat ? col(mat.top, 0.62) : rockC, rimC = col(th.rim, 0.7);
    const tmp = new T.Color();
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const tx = i / S - PAD, ty = j / S - PAD, v = shape.at(tx, ty);
      const rk = smooth(TH - 0.05, TH + 0.2, v), top = smooth(TH + 0.12, TH + 0.4, v);
      const n1 = vnoise(tx * 1.3 + 7, ty * 1.3), n2 = vnoise(tx * 4.1, ty * 4.1 + 3);
      const h = (n2 - 0.5) * 0.015;
      const k = (j * gw + i) * 3;
      posA[k] = tx; posA[k + 1] = h; posA[k + 2] = ty;
      uvA[(j * gw + i) * 2] = tx * 0.6; uvA[(j * gw + i) * 2 + 1] = ty * 0.6;
      // Floor: the world's ground in patches; walls: banded stone; tops: moss, snow, ash...
      // The floor darkens where it meets the rock, so walls sit firmly in it.
      tmp.copy(floorC).lerp(floor2, vnoise(tx * 0.5, ty * 0.5)).multiplyScalar((0.75 + n2 * 0.4) * (1 - smooth(TH - 0.4, TH, v) * 0.55));
      const band = 0.85 + 0.15 * Math.sin(h * 9 + n1 * 4);
      const rockCol = rockC.clone().lerp(deepC, 0.35 * (1 - top)).multiplyScalar(band * (0.85 + n2 * 0.3));
      // Moss, snow or ash creeps out from the foot of the walls.
      tmp.lerp(topC.clone().multiplyScalar(0.7 + n1 * 0.4), smooth(TH - 0.3, TH, v) * (mat ? mat.top[3] * 0.5 : 0.2) * n1);
      colA[k] = tmp.r; colA[k + 1] = tmp.g; colA[k + 2] = tmp.b;
    }
    const idx = [];
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(posA, 3));
    geo.setAttribute("color", new T.BufferAttribute(colA, 3));
    geo.setAttribute("uv", new T.BufferAttribute(uvA, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const street = new T.Mesh(geo, withVis(new T.MeshStandardMaterial({ vertexColors: true, map: COBBLE, bumpMap: COBBLE, bumpScale: 0.012, roughness: 0.55, metalness: 0.08 })));
    street.receiveShadow = true;
    root.add(street);

    // The city: every rock tile is a stone building, and the city carries on past the cave's
    // edges into the fog, taller and taller. Walls are only built where they can be seen
    // (facing a street or a lower neighbour); the ground floor has doors and shop arches.
    const rock = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || L.tile[y * cols + x] === "#";
    const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
    const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7 + levelIndex * 13.7) * 43758.5453; return h - Math.floor(h); };
    const height = (x, y) => {
      const n = vnoise(x * 0.35 + 3, y * 0.35), r = hash(x, y);
      if (inside(x, y)) return 1.25 + n * 1.1 + (r > 0.9 ? 1.2 : 0);
      const far = Math.max(-x, x - cols + 1, -y, y - rows + 1, 0);
      return 1.8 + n * 1.8 + far * 0.25 + (r > 0.85 ? 2.5 : 0);
    };
    const B = { up: [[], [], []], gf: [[], [], []], roof: [] };
    const quad = (buf, a, b, c, d, nx, ny, nz, u0, u1, v0, v1) => {
      const base = buf.length / 8;
      for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [d, u0, v1]]) buf.push(p[0], p[1], p[2], nx, ny, nz, u, v);
      (buf.idx || (buf.idx = [])).push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const R = PAD;
    for (let y = -R; y < rows + R; y++) for (let x = -R; x < cols + R; x++) {
      if (!rock(x, y)) continue;
      const h = height(x, y), v = Math.floor(hash(y, x) * 3), gv = Math.floor(hash(x + 7, y) * 3);
      quad(B.roof, [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], 0, 1, 0, 0, 1, 0, 1);
      // Four sides: south (+y), north (-y), east (+x), west (-x), each wound to face outward.
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, nh = rock(nx, ny) ? height(nx, ny) : 0;
        if (nh >= h - 0.01) continue;
        let p0, p1;
        if (dy === 1) { p0 = [x, y + 1]; p1 = [x + 1, y + 1]; }
        else if (dy === -1) { p0 = [x + 1, y]; p1 = [x, y]; }
        else if (dx === 1) { p0 = [x + 1, y + 1]; p1 = [x + 1, y]; }
        else { p0 = [x, y]; p1 = [x, y + 1]; }
        const wall = (buf, y0, y1) => quad(buf, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], dx, 0, dy, 0, 1, y0 / 2, y1 / 2);
        const streetSide = nh === 0;
        if (streetSide) quad(B.gf[gv], [p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], Math.min(1, h), p1[1]], [p0[0], Math.min(1, h), p0[1]], dx, 0, dy, 0, 1, 0, Math.min(1, h));
        const from = streetSide ? Math.min(1, h) : nh;
        if (h > from) wall(B.up[v], from, h);
      }
    }
    const mesh = (buf, matl) => {
      if (!buf.length) return;
      const a = new Float32Array(buf), g = new T.BufferGeometry();
      const ib = new T.InterleavedBuffer(a, 8);
      g.setAttribute("position", new T.InterleavedBufferAttribute(ib, 3, 0));
      g.setAttribute("normal", new T.InterleavedBufferAttribute(ib, 3, 3));
      g.setAttribute("uv", new T.InterleavedBufferAttribute(ib, 2, 6));
      g.setIndex(buf.idx);
      const m = new T.Mesh(g, matl); m.castShadow = true; m.receiveShadow = true; root.add(m);
    };
    const stoneTint = col(th.rim, 0.5).lerp(new T.Color(0.62, 0.62, 0.66), 0.6);
    cityMats = [];
    FACADES.forEach((f, k) => { const m = withVis(new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.em, emissive: 0xffb860, emissiveIntensity: 1.3, color: stoneTint, roughness: 0.9 }), 0.16, true); cityMats.push(m); mesh(B.up[k], m); });
    GROUNDS.forEach((f, k) => { const m = withVis(new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.em, emissive: 0xffb860, emissiveIntensity: 1.1, color: stoneTint, roughness: 0.9 }), 0.16, true); cityMats.push(m); mesh(B.gf[k], m); });
    mesh(B.roof, withVis(new T.MeshStandardMaterial({ map: ROOF, color: mat ? col(mat.top, 1.5).lerp(new T.Color(0.75, 0.76, 0.82), 0.45) : new T.Color(0.7, 0.72, 0.8), roughness: 0.85 }), 0.035, true));

    // Mist over the whole city, and fireflies scattered through it.
    for (const m of mists) { m.scale.set(cols + PAD * 2, rows + PAD * 2, 1); m.position.x = cols / 2; m.position.z = rows / 2; m.material.map.repeat.set((cols + PAD * 2) / 6, (rows + PAD * 2) / 6); m.material.color = col(th.rim, 0.7); }
    for (let k = 0; k < FLIES; k++) {
      flySeed[k * 4] = Math.random() * cols; flySeed[k * 4 + 1] = Math.random() * rows; flySeed[k * 4 + 2] = Math.random() * 6.28; flySeed[k * 4 + 3] = 0.3 + Math.random() * 1.6;
      const c = Math.random() < 0.6 ? col(th.rim, 1.2) : new T.Color(1, 0.8, 0.45);
      flyCol[k * 3] = c.r; flyCol[k * 3 + 1] = c.g; flyCol[k * 3 + 2] = c.b;
    }
    flyGeo.attributes.color.needsUpdate = true;

    // Decorations from the 2D plan, made solid.
    const glowMat = (c, k = 1.6) => withVis(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 }), 0.0);
    const stone = withVis(new T.MeshStandardMaterial({ color: col(th.rim, 0.45), roughness: 0.8 }));
    const iron = withVis(new T.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5, metalness: 0.6 }));
    const shroomGeo = new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stemGeo = new T.CylinderGeometry(0.25, 0.32, 1, 8);
    const stemMat = withVis(new T.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 0.7 }));
    const capA = glowMat(0x1f8a6c, 0.35), capB = glowMat(0x8a2e66, 0.35);
    for (const m of L.shrooms || []) {
      const s = m.s * 0.9, g = new T.Group();
      const st = new T.Mesh(stemGeo, stemMat); st.scale.set(s, s * 1.2, s); st.position.y = s * 0.6; g.add(st);
      const cap = new T.Mesh(shroomGeo, m.pink ? capB : capA); cap.scale.set(s * 1.1, s * 0.8, s * 1.1); cap.position.y = s * 1.2; g.add(cap);
      g.position.set(m.x, 0.02, m.y - 0.45); root.add(g);
    }
    const crystal = glowMat(0x9a70ff, 1.4), coneGeo = new T.ConeGeometry(1, 1, 5);
    for (const d of L.decor || []) {
      if (d.k === "crystals") {
        for (let q = 0; q < 4; q++) {
          const c = new T.Mesh(coneGeo, crystal), s = d.s * (0.5 + q * 0.18);
          c.scale.set(s * 0.25, s * 1.4, s * 0.25); c.position.set(d.x + (q - 1.5) * 0.12, s * 0.7, d.y - 0.3); c.rotation.z = (q - 1.5) * 0.3; root.add(c);
        }
      } else if (d.k === "pillar" && d.top != null) {
        const p = new T.Mesh(new T.CylinderGeometry(0.14, 0.16, WALL + 0.2, 10), stone); p.position.set(d.x, (WALL + 0.2) / 2, (d.top + d.bot) / 2); root.add(p);
      } else if (d.k === "lamp") {
        const p = new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 1.1, 6), iron); p.position.set(d.x, 0.55, d.y - 0.35); root.add(p);
        if (d.lit) { const gl = new T.Mesh(new T.BoxGeometry(0.14, 0.18, 0.14), glowMat(0xffc070, 2)); gl.position.set(d.x, 1.15, d.y - 0.35); root.add(gl); }
      } else if (d.k === "pool") {
        const w = new T.Mesh(new T.CircleGeometry(d.s * 0.7, 24), withVis(new T.MeshStandardMaterial({ color: 0x0e2a3a, roughness: 0.05, metalness: 0.8, emissive: 0x0a3a50, emissiveIntensity: 0.5 })));
        w.rotation.x = -Math.PI / 2; w.position.set(d.x, 0.03, d.y - 0.3); root.add(w);
      }
    }
    built = L;
  }

  // ---------- Each frame ----------
  let vw = 0, vh = 0, vd = 0, camPos = new T.Vector3(), camLook = new T.Vector3(), waveSeen = new WeakMap();
  function resize(w, h, dpr) {
    vw = w; vh = h; vd = dpr;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 58 : 42; camera.updateProjectionMatrix();
    if (composer) { if (composer.setPixelRatio) composer.setPixelRatio(dpr); composer.setSize(w, h); }
  }
  function render(dt) {
    // Same size as the 2D canvas; the glow costs less at a lower resolution on small screens.
    const dpr = Math.min(DPR, qualityCap >= 2 ? 2 : 1.25);
    if (vw !== W || vh !== H || vd !== dpr) resize(W, H, dpr);
    if (built !== L) { build(); camPos.set(L.lumi.x, 8.6, L.lumi.y + 5.4); camLook.set(L.lumi.x, 0.3, L.lumi.y - 0.6); }
    const { cols, rows } = L, lumi = L.lumi;
    // Darkness texture from the same visibility the 2D view uses.
    for (let i = 0; i < L.n; i++) { const v = Math.min(255, vis(i) * 255) | 0, k = i * 4; visData[k] = v; visData[k + 1] = v; visData[k + 2] = v; visData[k + 3] = 255; }
    visTex.needsUpdate = true;

    // Camera: above and behind Lumi, looking down at an angle, held inside the cave.
    const tx = Math.max(Math.min(cols / 2, 2.4), Math.min(Math.max(cols / 2, cols - 2.4), lumi.x));
    const ty = lumi.y + 0.6;
    camPos.lerp(new T.Vector3(tx, 8.6, ty + 5.4), Math.min(1, dt * 4));
    camLook.lerp(new T.Vector3(tx, 0.3, ty - 0.6), Math.min(1, dt * 5));
    camera.position.copy(camPos); camera.lookAt(camLook);

    hideAll();
    const bob = Math.sin(clock * 2.4) * 0.06, shrink = L.ending ? Math.max(0, 1 - L.ending / 0.9) : 1;
    lumiCard.position.set(lumi.x, 0.75 + bob, lumi.y); lumiCard.scale.setScalar(0.95 * shrink);
    lumiGlow.position.set(lumi.x, 0.72 + bob, lumi.y - 0.05); lumiGlow.material.opacity = 0.4 + lumi.sing * 0.5;
    lumiLight.position.set(lumi.x, 1.0, lumi.y); lumiLight.intensity = (1.2 + lumi.sing * 1.5) * shrink;
    lumiSpot.position.set(lumi.x + 0.15, 2.6, lumi.y + 0.35); lumiSpot.target.position.set(lumi.x, 0, lumi.y);
    lumiSpot.intensity = (3.2 + lumi.sing * 3) * shrink;
    renderer.shadowMap.enabled = bloomOn;  // shadows go with the glow on a struggling phone
    uLumi.value.set(lumi.x, 0, lumi.y);
    for (let q = 0; q < cityMats.length; q++) cityMats[q].emissiveIntensity = 1.2 + Math.sin(clock * (1.3 + q * 0.7) + q) * 0.12 + Math.sin(clock * 7.1 + q * 3) * 0.04;
    mists.forEach((m, q) => { m.material.map.offset.set(clock * (0.012 + q * 0.008), clock * (0.006 - q * 0.004)); });
    for (let q = 0; q < FLIES; q++) {
      const sp = flySeed[q * 4 + 3], ph = flySeed[q * 4 + 2];
      flyPos[q * 3] = flySeed[q * 4] + Math.sin(clock * 0.3 * sp + ph) * 1.2;
      flyPos[q * 3 + 1] = 0.5 + Math.abs(Math.sin(clock * 0.5 + ph)) * 1.6;
      flyPos[q * 3 + 2] = flySeed[q * 4 + 1] + Math.cos(clock * 0.23 * sp + ph * 1.3) * 1.2;
    }
    flyGeo.attributes.position.needsUpdate = true;
    flies.material.size = 0.1 + Math.sin(clock * 3) * 0.015;
    // The song: a ring of light rolling out across the floor.
    const RING = pool("ring", () => { const m = new T.Mesh(new T.RingGeometry(0.94, 1, 96), new T.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; return m; });
    let wk = 0, strongest = 0;
    for (const w of L.waves) {
      if (!waveSeen.has(w)) waveSeen.set(w, { x: lumi.x, y: lumi.y });
      const o = waveSeen.get(w), fade = Math.max(0, 1 - w.r / (w.range + 1));
      const m = RING(wk++); m.position.set(o.x, 0.06, o.y); m.scale.setScalar(Math.max(0.2, w.r)); m.material.opacity = fade * 0.8;
      if (fade > strongest) { strongest = fade; songLight.position.set(o.x, 1.4, o.y); songLight.distance = 2 + w.r * 1.6; }
    }
    songLight.intensity = strongest * 2.2;

    // Lights in the cave, the nearest few as real lights.
    const lights = [];
    const add = (x, y, r, i, c) => { if (i > 0.02) lights.push({ x, y, r, i, c, d: Math.hypot(x - lumi.x, y - lumi.y) }); };
    for (const e of L.emitters || []) add(e.x, e.y, e.r * 3, e.a * 3 * (L.cityLit && e.color === "gold" ? 2 : knownAt(e.x, e.y)), LIGHT_RGB[e.color] || LIGHT_RGB.white);
    for (const c of L.crystals) if (c.on) add(c.x, c.y, 3.2, c.on * 1.4, LIGHT_RGB.violet);
    for (const o of L.lights) if (!o.got && (!L.hideLights || L.seen[o.i])) add(o.x, o.y, 2.4, 0.9, LIGHT_RGB.gold);
    for (const q of L.lamps) if (q.on) add(q.x, q.y - 0.3, 5, 2.4, LIGHT_RGB.gold);
    for (const c of L.chimes) if (c.rung) add(c.x, c.y, 2.6, 1.2, LIGHT_RGB[CHIMES[c.n - 1].glow] || LIGHT_RGB.cyan);
    for (const g of L.gloom) if (g.heal) add(g.x, g.y, 7, 3 * g.heal, LIGHT_RGB.gold);
    if (!L.hideLights || L.seen[L.exit.i]) add(L.exit.x, L.exit.y, 3, 1.2, LIGHT_RGB.violet);
    lights.sort((a, b) => a.d - b.d);
    lightPool.forEach((l, k) => {
      const s = lights[k];
      if (!s) { l.intensity = 0; return; }
      l.position.set(s.x, 1.1, s.y); l.distance = s.r * 1.4; l.intensity = s.i * 1.6; l.color.setRGB(s.c[0], s.c[1], s.c[2]);
    });

    const SHADOW = pool("shadow", () => { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; });
    let sk = 0;
    const blob = (x, y, size, a) => { const m = SHADOW(sk++); m.position.set(x, 0.03, y); m.scale.set(size, size, 1); m.material.opacity = a; };
    blob(lumi.x, lumi.y + 0.1, 0.9 * shrink, 0.5);
    for (const g of L.gloom) if (!g.gone && !(g.delay > 0) && sightAt(g.x, g.y) > 0.05) blob(g.x, g.y + 0.1, g.big ? 1.6 : 0.9, 0.55 * sightAt(g.x, g.y));
    for (const m of L.mobs) if (sightAt(m.x, m.y) > 0.05) blob(m.x, m.y + 0.1, 0.8, 0.5 * sightAt(m.x, m.y));
    // Lost lights: a warm orb bobbing above the floor.
    const ORB = pool("orb", () => glow(0xffd36e, 1, 1));
    let k = 0;
    for (const o of L.lights) {
      if (o.got) continue;
      const a = L.hideLights && !L.seen[o.i] ? vis(o.i) : Math.max(0.35, vis(o.i));
      if (a < 0.03) continue;
      const s = ORB(k++); s.position.set(o.x, 0.6 + Math.sin(clock * 2 + o.ph) * 0.08, o.y); s.scale.setScalar(0.9 + Math.sin(clock * 3 + o.ph) * 0.08); s.material.opacity = a;
    }
    // Crystals: a turning gem.
    const GEM = pool("gem", () => { const m = new T.Mesh(new T.OctahedronGeometry(0.2), new T.MeshStandardMaterial({ color: 0xb48cff, emissive: 0x7a50d0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3, transparent: true })); m.scale.y = 1.6; return m; });
    k = 0;
    for (const c of L.crystals) {
      const a = Math.max(c.on, vis(c.i) * 0.8); if (a < 0.03) continue;
      const m = GEM(k++); m.position.set(c.x, 0.65 + Math.sin(clock * 1.6 + c.x) * 0.05, c.y); m.rotation.y = clock * 0.9 + c.x; m.material.opacity = a; m.material.emissiveIntensity = 0.4 + c.on * 1.6;
    }
    // Hushlings and the Great Hush.
    const HU = pool("hush", () => card(HUSH.calm, 1, 1));
    k = 0;
    for (const g of L.gloom) {
      if (g.gone > 0 || g.delay > 0) continue;
      const a = Math.max(sightAt(g.x, g.y), save.settings.contrast ? 0.75 : 0, g.heal || 0);
      if (a < 0.03) continue;
      const s = HU(k++), hunting = g.hunt > 0, big = g.big, sz = big ? 1.9 : 1.05;
      s.material.map = big ? (hunting ? HUSH.bigHunt : HUSH.bigCalm) : hunting ? HUSH.hunt : HUSH.calm;
      s.material.opacity = a * (1 - (g.heal || 0)); s.scale.set(sz, sz * 1.25, 1);
      s.position.set(g.x, (big ? 1.25 : 0.85) + Math.sin(g.ph * 1.6) * 0.08, g.y);
    }
    // Other creatures: their 2D portraits standing in the cave.
    const MO = pool("mob", () => card(mobTexture("k"), 1, 1));
    k = 0;
    for (const m of L.mobs) {
      if (m.kind === "w" && m.cd > 0) continue;
      const a = Math.max(sightAt(m.x, m.y), save.settings.contrast ? 0.75 : 0); if (a < 0.03) continue;
      const s = MO(k++); s.material.map = mobTexture(m.kind); s.material.opacity = a; s.scale.set(1.1, 1.1, 1); s.position.set(m.x, 0.6, m.y);
    }
    const TH_ = pool("thorn", () => card(THORN_T, 0.7, 0.7));
    k = 0;
    for (const t of L.thorns) {
      const ti = Math.floor(t.y) * cols + Math.floor(t.x), a = Math.max(ti >= 0 && ti < L.n ? Math.max(L.lit[ti], L.glow[ti]) : 0, save.settings.contrast ? 0.7 : 0);
      if (a < 0.03) continue;
      const s = TH_(k++); s.position.set(t.x, 0.45, t.y); s.material.opacity = a; s.material.rotation = t.ph * 0.6;
    }
    const SN = pool("snooze", () => card(SNOOZE_T, 0.9, 0.68));
    k = 0;
    for (const c of L.critters) { const a = vis(c.i); if (a < 0.03) continue; const s = SN(k++); s.position.set(c.x, 0.4, c.y); s.material.opacity = a; }
    // Moths, the lost baby moth, Lumi's family.
    const MT = pool("moth", () => { const g = new T.Group(); g.add(card(MOTH_T, 0.36, 0.36)); g.add(glow(0x9dffbf, 1, 0.5)); return g; });
    k = 0;
    for (const m of L.moths) { const a = sightAt(m.x, m.y); if (a < 0.03) continue; const g = MT(k++); g.position.set(m.x, 0.8, m.y); g.children[0].scale.x = 0.36 * (0.4 + Math.abs(Math.sin(m.ph * 14)) * 0.6); }
    if (L.baby && (L.baby.following || knownAt(L.baby.hx, L.baby.hy) > 0.03)) { const g = MT(k++); g.position.set(L.baby.x, 0.9, L.baby.y); g.children[1].material.color.setHex(0xff9ad0); }
    if (L.family && !L.family.got && vis(L.family.i) > 0.05) { const g = MT(k++); g.position.set(L.family.x, 0.8, L.family.y); g.children[1].material.color.setHex(0xffd1ea); }
    // Chimes: a post with a coloured bell; rung ones shine.
    const CH = pool("chime", () => {
      const g = new T.Group();
      const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.06, 0.9, 8), new T.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.6 })); post.position.y = 0.45; g.add(post);
      const bell = new T.Mesh(new T.ConeGeometry(0.16, 0.24, 16, 1, true), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2, side: T.DoubleSide, metalness: 0.4, roughness: 0.3 })); bell.position.set(0.14, 0.78, 0); g.add(bell);
      const gl = glow(0xffffff, 1.2, 0); gl.position.set(0.14, 0.78, 0); g.add(gl);
      return g;
    });
    k = 0;
    for (const c of L.chimes) {
      const a = knownAt(c.x, c.y); if (a < 0.03) continue;
      const g = CH(k++), info = CHIMES[c.n - 1], bell = g.children[1], gl = g.children[2];
      g.position.set(c.x, 0, c.y);
      bell.material.color.set(info.color); bell.material.emissive.set(info.color); bell.material.emissiveIntensity = c.rung ? 2.2 : 0.25;
      bell.rotation.z = c.rung ? Math.sin(clock * 5 + c.ph) * 0.2 : 0;
      gl.material.color.set(info.color); gl.material.opacity = c.rung ? 0.8 : 0.15 * a;
    }
    // Street lamps to relight.
    const LP = pool("lamp", () => {
      const g = new T.Group();
      const post = new T.Mesh(new T.CylinderGeometry(0.035, 0.055, 1.3, 8), new T.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5, metalness: 0.6 })); post.position.y = 0.65; g.add(post);
      const glass = new T.Mesh(new T.CylinderGeometry(0.11, 0.08, 0.22, 6), new T.MeshStandardMaterial({ color: 0x4a5466, emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.3 })); glass.position.y = 1.38; g.add(glass);
      const gl = glow(0xffc070, 2.4, 0); gl.position.y = 1.38; g.add(gl);
      return g;
    });
    k = 0;
    for (const q of L.lamps) {
      const a = knownAt(q.x, q.y); if (a < 0.03) continue;
      const g = LP(k++); g.position.set(q.x, 0, q.y);
      g.children[1].material.emissiveIntensity = q.on ? 2.6 : 0; g.children[2].material.opacity = q.on ? 0.85 : 0;
    }
    // Rune stones: carved discs on the floor that light green.
    const RU = pool("rune", () => { const m = new T.Mesh(new T.CylinderGeometry(0.3, 0.34, 0.12, 20), new T.MeshStandardMaterial({ color: 0x2a3a40, emissive: 0x60ffa0, emissiveIntensity: 0, roughness: 0.6 })); m.position.y = 0.06; return m; });
    k = 0;
    for (const r of L.runes) { const a = Math.max(vis(r.i), r.on); if (a < 0.03) continue; const m = RU(k++); m.position.set(r.x, 0.06, r.y); m.material.emissiveIntensity = r.on * 1.8 + r.far * 0.6; }
    // Sound curtains: shimmering violet veils that part when sung to.
    const DR = pool("door", () => new T.Mesh(new T.PlaneGeometry(1, 1.3), new T.MeshBasicMaterial({ color: 0xb48cff, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })));
    k = 0;
    for (let i = 0; i < L.n; i++) {
      if (L.tile[i] !== "D") continue;
      const x = i % cols, y = (i / cols) | 0, o = L.doorAnim[i], a = Math.max(vis(i), 0.12) * (1 - o * 0.9);
      if (a < 0.03) continue;
      const m = DR(k++), across = !solidAt(x, y - 1) || !solidAt(x, y + 1);
      m.position.set(x + 0.5, 0.65, y + 0.5); m.rotation.y = across ? 0 : Math.PI / 2; m.material.opacity = a * (0.35 + Math.sin(clock * 4 + i) * 0.08);
    }
    // The rune gate: a stone slab that sinks into the floor.
    if (L.gate) {
      const GT = pool("gate", () => new T.Mesh(new T.BoxGeometry(1, 1.6, 1), withVis(new T.MeshStandardMaterial({ color: 0x4a5668, roughness: 0.7 }))));
      const m = GT(0), sink = Math.min(1, L.gate.open);
      m.position.set(Math.floor(L.gate.x) + 0.5, 0.8 - sink * 1.7, Math.floor(L.gate.y) + 0.5);
    }
    // The portal: a standing ring of violet light, dim while sealed.
    {
      const PO = pool("portal", () => { const g = new T.Group(); g.add(new T.Mesh(new T.TorusGeometry(0.45, 0.05, 12, 48), new T.MeshBasicMaterial({ color: 0xc9a8ff, toneMapped: false, transparent: true }))); g.add(glow(0xb48cff, 2.4, 0.6)); return g; });
      const e = L.exit, a = L.hideLights && !L.seen[e.i] ? vis(e.i) : Math.max(0.35, vis(e.i));
      if (a > 0.03) {
        const g = PO(0), sealed = (L.goal === "rescue" && L.baby && !L.baby.following) || (L.finale && !L.healed) || L.chimeNext <= L.chimes.length || L.lamps.some(q => !q.on);
        g.position.set(e.x, 0.65, e.y); g.lookAt(camera.position.x, 0.65, camera.position.z);
        g.children[0].rotation.z = clock * (sealed ? 0.3 : 1.4); g.children[0].material.opacity = a * (sealed ? 0.45 : 1); g.children[1].material.opacity = a * (sealed ? 0.25 : 0.7);
      }
    }
    // Sparks and bursts from the game's particles.
    let n = 0;
    for (const p of L.particles) {
      if (n >= SPARKS) break;
      const c = SPARK_RGB[p.color] || SPARK_RGB.white, f = Math.max(0, p.life / p.max);
      sparkPos[n * 3] = p.x; sparkPos[n * 3 + 1] = 0.5 + (1 - f) * 0.4; sparkPos[n * 3 + 2] = p.y;
      sparkCol[n * 3] = c[0] * f; sparkCol[n * 3 + 1] = c[1] * f; sparkCol[n * 3 + 2] = c[2] * f; n++;
    }
    sparkGeo.setDrawRange(0, n); sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;

    // On a struggling phone the frame loop turns bloom off (bloomOn) before lowering resolution.
    if (composer && bloomOn) composer.render(); else renderer.render(scene, camera);
  }
  return {
    get ok() { return true; },
    canvas: view,
    resize,
    render,
    show(on) { view.style.display = on ? "block" : "none"; },
  };
})();

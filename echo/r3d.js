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
  const uVis = { value: visTex }, uDims = { value: new T.Vector2(1, 1) };
  function withVis(mat, floor = 0.035) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uVis = uVis; sh.uniforms.uDims = uDims;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nuniform sampler2D uVis;\nuniform vec2 uDims;")
        .replace("#include <fog_fragment>", `float visK = texture2D(uVis, vec2(vWPos.x / uDims.x, vWPos.z / uDims.y)).r;
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
  const lumiLight = new T.PointLight(0x9feeff, 2.2, 9, 1.5); scene.add(lumiLight);
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
      const h = rk * (WALL + (n1 - 0.5) * 0.45 * top + (n2 - 0.5) * 0.1) + (1 - rk) * (n2 - 0.5) * 0.04;
      const k = (j * gw + i) * 3;
      posA[k] = tx; posA[k + 1] = h; posA[k + 2] = ty;
      uvA[(j * gw + i) * 2] = tx * 0.5; uvA[(j * gw + i) * 2 + 1] = ty * 0.5;
      // Floor: the world's ground in patches; walls: banded stone; tops: moss, snow, ash...
      // The floor darkens where it meets the rock, so walls sit firmly in it.
      tmp.copy(floorC).lerp(floor2, vnoise(tx * 0.5, ty * 0.5)).multiplyScalar((0.75 + n2 * 0.4) * (1 - smooth(TH - 0.4, TH, v) * 0.55));
      const band = 0.85 + 0.15 * Math.sin(h * 9 + n1 * 4);
      const rockCol = rockC.clone().lerp(deepC, 0.35 * (1 - top)).multiplyScalar(band * (0.85 + n2 * 0.3));
      tmp.lerp(rockCol, rk);
      tmp.lerp(topC.clone().multiplyScalar(0.8 + n1 * 0.4), top * (mat ? mat.top[3] * 0.85 : 0.3));
      tmp.lerp(rimC, Math.max(0, rk - top) * 0.12);
      // A bright lip where a wall's top meets its side, so every wall reads crisply from above.
      const lip = smooth(TH + 0.06, TH + 0.14, v) * (1 - smooth(TH + 0.16, TH + 0.26, v));
      tmp.lerp(rimC.clone().multiplyScalar(1.6), lip * 0.35);
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
    root.add(new T.Mesh(geo, withVis(new T.MeshStandardMaterial({ vertexColors: true, map: GRAIN, bumpMap: GRAIN_B, bumpScale: 0.018, roughness: 0.8, metalness: 0.02 }))));

    // Decorations from the 2D plan, made solid.
    const glowMat = (c, k = 1.6) => withVis(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 }), 0.0);
    const stone = withVis(new T.MeshStandardMaterial({ color: col(th.rim, 0.45), roughness: 0.8 }));
    const iron = withVis(new T.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5, metalness: 0.6 }));
    const shroomGeo = new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stemGeo = new T.CylinderGeometry(0.25, 0.32, 1, 8);
    const stemMat = withVis(new T.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 0.7 }));
    const capA = glowMat(0x2fa888, 0.55), capB = glowMat(0xb04a88, 0.55);
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
      } else if (d.k === "lava") {
        const l = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), glowMat(0xc8400c, 1.1)); l.position.set(d.x, WALL * 0.85, d.y); l.scale.set(2.4, 0.25, 0.8); root.add(l);
      }
    }
    built = L;
  }

  // ---------- Each frame ----------
  let vw = 0, vh = 0, vd = 0, camPos = new T.Vector3(), camLook = new T.Vector3(), waveSeen = new WeakMap();
  function resize(w, h, dpr) {
    vw = w; vh = h; vd = dpr;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 54 : 40; camera.updateProjectionMatrix();
    if (composer) { if (composer.setPixelRatio) composer.setPixelRatio(dpr); composer.setSize(w, h); }
  }
  function render(dt) {
    // Same size as the 2D canvas; the glow costs less at a lower resolution on small screens.
    const dpr = Math.min(DPR, qualityCap >= 2 ? 2 : 1.25);
    if (vw !== W || vh !== H || vd !== dpr) resize(W, H, dpr);
    if (built !== L) { build(); camPos.set(L.lumi.x, 15.5, L.lumi.y + 5.2); camLook.set(L.lumi.x, 0, L.lumi.y); }
    const { cols, rows } = L, lumi = L.lumi;
    // Darkness texture from the same visibility the 2D view uses.
    for (let i = 0; i < L.n; i++) { const v = Math.min(255, vis(i) * 255) | 0, k = i * 4; visData[k] = v; visData[k + 1] = v; visData[k + 2] = v; visData[k + 3] = 255; }
    visTex.needsUpdate = true;

    // Camera: above and behind Lumi, looking down at an angle, held inside the cave.
    const tx = Math.max(Math.min(cols / 2, 3.2), Math.min(Math.max(cols / 2, cols - 3.2), lumi.x));
    const ty = lumi.y + 0.6;
    camPos.lerp(new T.Vector3(tx, 15.5, ty + 5.2), Math.min(1, dt * 4));
    camLook.lerp(new T.Vector3(tx, 0, ty - 0.2), Math.min(1, dt * 5));
    camera.position.copy(camPos); camera.lookAt(camLook);

    hideAll();
    const bob = Math.sin(clock * 2.4) * 0.06, shrink = L.ending ? Math.max(0, 1 - L.ending / 0.9) : 1;
    lumiCard.position.set(lumi.x, 0.75 + bob, lumi.y); lumiCard.scale.setScalar(0.95 * shrink);
    lumiGlow.position.set(lumi.x, 0.72 + bob, lumi.y - 0.05); lumiGlow.material.opacity = 0.4 + lumi.sing * 0.5;
    lumiLight.position.set(lumi.x, 1.2, lumi.y); lumiLight.intensity = (2.2 + lumi.sing * 2) * shrink;
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

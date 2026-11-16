// Echo in 3D: the run drawn as a real city. The game itself is unchanged (run.js moves Bip,
// spawns hazards and checks hits on its flat 400-wide map); this file builds that map as a
// lit 3D scene: glass towers with windows and neon either side of the street Bip climbs,
// a skyline and clouds behind, a sky that turns from morning to night as you rise, glossy
// toy-like hazards, and bloom on everything that glows. The 2D canvas stays on top for the
// messages, combo ring and banners. If WebGL isn't there, RUN3D is null and the 2D city is drawn.
"use strict";

const RUN3D = (() => { try {
  const T = window.THREE;
  if (!T) return null;
  const view = document.createElement("canvas");
  view.id = "run3d";
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: view, antialias: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const U = 1 / 20;                 // map units to scene metres (the street view is 400 wide → 20 m)
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(46, 0.5, 0.5, 600);
  scene.fog = new T.Fog(0xffffff, 40, 170);
  const hemi = new T.HemisphereLight(0xffffff, 0x334455, 0.9); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 1.3); sun.position.set(-30, 40, 50); scene.add(sun); scene.add(sun.target);
  // Real shadows: the sun casts them from towers, ledges, Bip and everything in the street.
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  sun.castShadow = true;
  { const sm = typeof modestPhone !== "undefined" && modestPhone ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm); }
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 60, bottom: -60, near: 1, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  const SUN_DIR = new T.Vector3(-0.35, 0.5, 0.8).normalize();
  const bipLight = new T.PointLight(0x7ff0ff, 0, 16, 2); scene.add(bipLight);
  let composer = null, bloom = null;
  if (false) {
    composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.5, 0.45, 0.82);
    composer.addPass(bloom);
  }
  const C = c => new T.Color(c[0] / 255, c[1] / 255, c[2] / 255);
  const rgbArr = s => s.split(",").map(Number);
  const canvasTex = (w, h, paint) => { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };

  // ---------- Textures ----------
  const glowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  // A facade: slim frames and big glass panes (4 × 4 per tile); the lit map lights some panes.
  const facadeTex = canvasTex(512, 512, (g) => {
    g.fillStyle = "#eef1f5"; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * 128 + 10, y = r * 128 + 14, w = 108, h = 92, gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, "#5f748c"); gr.addColorStop(0.45, "#9db3ca"); gr.addColorStop(0.55, "#7f95ad"); gr.addColorStop(1, "#4d5f74");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = "#dfe5ec"; g.fillRect(x + w / 2 - 2, y, 4, h);
      g.fillStyle = "rgba(255,255,255,0.22)"; g.beginPath(); g.moveTo(x + 8, y + h); g.lineTo(x + 30, y); g.lineTo(x + 44, y); g.lineTo(x + 22, y + h); g.fill();
    }
    g.fillStyle = "#c9d1db"; for (let r = 0; r < 4; r++) g.fillRect(0, r * 128 + 112, 512, 10);
    g.fillStyle = "#b8c1cc"; for (let c = 0; c < 4; c++) g.fillRect(c * 128, 0, 3, 512);
  });
  const litTex = canvasTex(512, 512, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    const rnd = seeded(77);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (rnd() < 0.45) { const k = 0.55 + rnd() * 0.45, x = c * 128 + 10, y = r * 128 + 14; g.fillStyle = `rgba(255,${235 + rnd() * 20},${200 + rnd() * 55},${k})`; g.fillRect(x, y, 52, 92); g.fillRect(x + 56, y, 52, 92); }
  });
  // Roughness (green) and metalness (blue): glass panes are smooth mirrors, frames are matte.
  const rmTex = canvasTex(512, 512, (g) => {
    g.fillStyle = "rgb(0,150,20)"; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = "rgb(0,22,235)"; g.fillRect(c * 128 + 10, r * 128 + 14, 108, 92); g.fillStyle = "rgb(0,120,40)"; g.fillRect(c * 128 + 62, r * 128 + 14, 4, 92); }
  });
  rmTex.encoding = T.LinearEncoding;
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  for (const t of [facadeTex, litTex, glowTex, rmTex]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; }
  const signTex = {};
  const signFor = word => signTex[word] || (signTex[word] = canvasTex(128, 48, (g) => {
    g.strokeStyle = "#fff"; g.lineWidth = 4; g.strokeRect(4, 4, 120, 40);
    g.fillStyle = "#fff"; g.font = "800 26px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(word, 64, 25);
  }));
  const helpTex = canvasTex(96, 40, (g) => { g.fillStyle = "rgba(20,22,30,0.8)"; g.beginPath(); if (g.roundRect) g.roundRect(4, 4, 88, 32, 16); else g.rect(4, 4, 88, 32); g.fill(); g.fillStyle = "#fff"; g.font = "700 20px Inter, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("help!", 48, 21); });

  // ---------- The sky: a gradient dome, sun, moon, stars, clouds ----------
  const skyU = { top: { value: new T.Color() }, mid: { value: new T.Color() }, bot: { value: new T.Color() } };
  const skyMat = new T.ShaderMaterial({
    uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.1 ? mix(mid, top, smoothstep(0.1, 0.75, h)) : mix(bot, mid, smoothstep(-0.25, 0.1, h)); gl_FragColor = vec4(c, 1.0); }",
  });
  const sky = new T.Mesh(new T.SphereGeometry(500, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
  const starGeo = new T.BufferGeometry(), starPos = [], sr = seeded(5);
  for (let q = 0; q < 500; q++) { const a = sr() * Math.PI * 2, e = 0.05 + sr() * 1.3; starPos.push(Math.cos(a) * Math.cos(e) * 480, Math.sin(e) * 480, Math.sin(a) * Math.cos(e) * 480 - 0); }
  starGeo.setAttribute("position", new T.Float32BufferAttribute(starPos, 3));
  const stars = new T.Points(starGeo, new T.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xffffff, transparent: true, fog: false, depthWrite: false })); scene.add(stars);
  const sunSpr = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xfff4dc, transparent: true, fog: false, depthWrite: false, blending: T.AdditiveBlending })); sunSpr.scale.set(70, 70, 1); scene.add(sunSpr);
  const moon = new T.Mesh(new T.SphereGeometry(7, 24, 16), new T.MeshBasicMaterial({ color: 0xf6f3e6, fog: false, transparent: true })); scene.add(moon);
  const cloudTex = canvasTex(128, 64, (g) => { for (const [x, y, r] of [[40, 38, 22], [64, 30, 26], [90, 38, 20], [64, 44, 22]]) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.7, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
  const clouds = []; for (let q = 0; q < 10; q++) { const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false })); scene.add(s); clouds.push(s); }
  // Rain: streaks falling past the camera.
  const rainGeo = new T.BufferGeometry(), rainN = 260, rainPos = new Float32Array(rainN * 6);
  rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xbfdcff, transparent: true, opacity: 0.45, fog: false })); scene.add(rain);
  const rainSeed = []; for (let q = 0; q < rainN; q++) rainSeed.push([Math.random(), Math.random(), Math.random()]);

  // ---------- Pools: objects reused frame to frame ----------
  const pools = {};
  function pool(kind, make) {
    const P = pools[kind] || (pools[kind] = { list: [], used: 0, make });
    if (P.used >= P.list.length) {
      const o = make(); scene.add(o); P.list.push(o);
      o.traverse(m => { if (m.isMesh && !m.material.isMeshBasicMaterial && !m.material.transparent && m.userData.cast !== false) m.castShadow = true; });
    }
    const o = P.list[P.used++]; o.visible = true; return o;
  }
  function poolsReset() { for (const k in pools) { const P = pools[k]; for (let q = P.used; q < P.list.length; q++) P.list[q].visible = false; P.used = 0; } }
  function poolsHideRest() { for (const k in pools) { const P = pools[k]; for (let q = P.used; q < P.list.length; q++) P.list[q].visible = false; } }

  // ---------- Towers ----------
  const towerMats = [];
  for (let q = 0; q < 6; q++) {
    const map = facadeTex.clone(), em = litTex.clone(); map.needsUpdate = em.needsUpdate = true; map.anisotropy = em.anisotropy = aniso;
    map.repeat.set(1.5, 1); em.repeat.set(1.5, 1); map.offset.set(q * 0.25, q * 0.37); em.offset.copy(map.offset);
    towerMats.push(new T.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: rmTex, metalnessMap: rmTex, metalness: 1, roughness: 1, envMapIntensity: 1.1 }));
  }
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const neonMatL = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), neonMatR = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const ledgeMat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7 });
  const backMat = new T.MeshStandardMaterial({ map: facadeTex, emissiveMap: litTex, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: rmTex, metalnessMap: rmTex, metalness: 0.7, roughness: 1 });
  const signMats = {};
  // The back of the street: matte panelled concrete, so shadows read clearly and the street edges stay clear.
  const panelTex = canvasTex(256, 256, (g) => {
    g.fillStyle = "#e4e6ea"; g.fillRect(0, 0, 256, 256);
    const r = seeded(9); for (let q = 0; q < 900; q++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
    g.fillStyle = "rgba(0,0,0,0.16)"; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 2, 256); for (let y = 0; y < 256; y += 128) g.fillRect(0, y, 256, 2);
    g.fillStyle = "rgba(255,255,255,0.35)"; for (let x = 2; x < 256; x += 64) g.fillRect(x, 0, 1, 256);
  });
  panelTex.wrapS = panelTex.wrapT = T.RepeatWrapping; panelTex.repeat.set(3, 1); panelTex.anisotropy = aniso;
  const rearMat = new T.MeshStandardMaterial({ map: panelTex, roughness: 0.85, metalness: 0, envMapIntensity: 0.4 });
  const DEPTH = 10;                 // how deep the street-side towers are, front to back

  // ---------- Bip and friends: glossy little robots with a face screen ----------
  function faceTexture() { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = aniso; return t; }
  // Faces: idle, blink, happy, wow (a pulse), worried (danger close), hurt, star (a power).
  function paintFace(tex, expr, eye) {
    const g = tex.image.getContext("2d"), W = 256, H = 128, L = 96, Rr = 160, Y = 60;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1d263d"); bg.addColorStop(1, "#05070f"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.shadowColor = eye; g.shadowBlur = 16; g.fillStyle = eye; g.strokeStyle = eye; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); };
    if (expr === "blink") { for (const x of [L, Rr]) { g.beginPath(); g.moveTo(x - 13, Y + 4); g.lineTo(x + 13, Y + 4); g.stroke(); } }
    else if (expr === "happy") { for (const x of [L, Rr]) { g.beginPath(); g.arc(x, Y + 12, 15, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); } g.lineWidth = 6; g.beginPath(); g.arc(128, Y + 16, 13, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke(); }
    else if (expr === "hurt") { g.strokeStyle = g.shadowColor = "#ff6b8b"; for (const x of [L, Rr]) { g.beginPath(); g.moveTo(x - 11, Y - 11); g.lineTo(x + 11, Y + 11); g.moveTo(x + 11, Y - 11); g.lineTo(x - 11, Y + 11); g.stroke(); } g.lineWidth = 6; g.beginPath(); g.moveTo(114, Y + 32); g.lineTo(121, Y + 27); g.lineTo(128, Y + 32); g.lineTo(135, Y + 27); g.lineTo(142, Y + 32); g.stroke(); }
    else if (expr === "worried") { for (const x of [L, Rr]) rr(x - 10, Y - 10, 20, 30, 10); g.lineWidth = 5; g.beginPath(); g.moveTo(L - 16, Y - 16); g.lineTo(L + 10, Y - 25); g.moveTo(Rr + 16, Y - 16); g.lineTo(Rr - 10, Y - 25); g.stroke(); g.beginPath(); g.moveTo(118, Y + 32); g.quadraticCurveTo(128, Y + 25, 138, Y + 32); g.stroke(); }
    else if (expr === "wow") { g.lineWidth = 7; for (const x of [L, Rr]) { g.beginPath(); g.arc(x, Y, 15, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.ellipse(128, Y + 30, 7, 8, 0, 0, Math.PI * 2); g.fill(); }
    else if (expr === "star") { g.font = "900 46px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; for (const x of [L, Rr]) g.fillText("\u2605", x, Y + 3); }
    else { for (const x of [L, Rr]) rr(x - 12, Y - 20, 24, 40, 12); g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,0.9)"; for (const x of [L, Rr]) rr(x - 6, Y - 15, 7, 11, 3); }
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.07)"; g.beginPath(); g.ellipse(84, 20, 74, 13, -0.12, 0, Math.PI * 2); g.fill();
    tex.needsUpdate = true;
  }
  function setFace(bot, expr, eye) { const ud = bot.userData, key = expr + eye; if (ud.face === key) return; ud.face = key; paintFace(ud.faceTex, expr, eye); }
  function makeBot(scale) {
    const g = new T.Group();
    const shell = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 });
    const trim = new T.MeshStandardMaterial({ color: 0x8e9bb0, metalness: 0.85, roughness: 0.22 });
    const accent = new T.MeshBasicMaterial({ color: 0x7ff0ff, toneMapped: false });
    const head = new T.Group(); head.position.y = 0.26; g.add(head);
    const skull = new T.Mesh(new T.SphereGeometry(0.62, 40, 28), shell); skull.scale.set(1.18, 0.9, 1); head.add(skull);
    const faceTex = faceTexture();
    const visor = new T.Mesh(new T.SphereGeometry(0.636, 48, 20, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.56, 1.06),
      new T.MeshPhysicalMaterial({ color: 0xffffff, map: faceTex, emissiveMap: faceTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }));
    visor.scale.copy(skull.scale); head.add(visor);
    for (const sd of [-1, 1]) {
      const ear = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.16, 28), trim); ear.rotation.z = Math.PI / 2; ear.position.set(sd * 0.74, 0, 0); head.add(ear);
      const ring = new T.Mesh(new T.TorusGeometry(0.11, 0.025, 8, 28), accent); ring.rotation.y = Math.PI / 2; ring.position.set(sd * 0.825, 0, 0); head.add(ring);
    }
    const ant = new T.Mesh(new T.CylinderGeometry(0.022, 0.03, 0.34, 10), trim); ant.position.set(0, 0.72, 0); head.add(ant);
    const bulbMat = new T.MeshBasicMaterial({ color: 0x7ff0ff, toneMapped: false });
    const bulb = new T.Mesh(new T.SphereGeometry(0.09, 18, 12), bulbMat); bulb.position.set(0, 0.92, 0); head.add(bulb);
    const torso = new T.Mesh(new T.SphereGeometry(0.42, 32, 24), shell); torso.scale.set(1, 0.82, 0.88); torso.position.y = -0.5; g.add(torso);
    const belt = new T.Mesh(new T.TorusGeometry(0.4, 0.035, 10, 40), trim); belt.rotation.x = Math.PI / 2; belt.position.y = -0.56; g.add(belt);
    const core = new T.Mesh(new T.CircleGeometry(0.085, 28), accent); core.position.set(0, -0.44, 0.372); g.add(core);
    const hands = [];
    for (const sd of [-1, 1]) { const h = new T.Mesh(new T.SphereGeometry(0.13, 20, 14), shell); h.position.set(sd * 0.64, -0.45, 0.06); g.add(h); hands.push(h); }
    const flameMat = new T.MeshBasicMaterial({ color: 0xbff4ff, toneMapped: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const flames = [];
    for (const sd of [-1, 1]) {
      const pack = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.42, 20), trim); pack.position.set(sd * 0.2, -0.48, -0.36); g.add(pack);
      const nz = new T.Mesh(new T.CylinderGeometry(0.08, 0.11, 0.1, 16), new T.MeshStandardMaterial({ color: 0x2a2f3d, metalness: 0.8, roughness: 0.3 })); nz.position.set(sd * 0.2, -0.74, -0.36); g.add(nz);
      const fl = new T.Mesh(new T.ConeGeometry(0.1, 0.55, 16), flameMat); fl.rotation.x = Math.PI; fl.position.set(sd * 0.2, -1.05, -0.36); g.add(fl); flames.push(fl);
    }
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x7ff0ff, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false })); halo.scale.set(2.6, 2.6, 1); g.add(halo);
    g.scale.setScalar(scale);
    g.userData = { shell, accent, bulbMat, flames, flameMat, hands, head, faceTex, face: "", halo };
    paintFace(faceTex, "idle", "#7ff0ff");
    return g;
  }
  const bip = makeBot(1); scene.add(bip);
  bip.traverse(m => { if (m.isMesh && !m.material.isMeshBasicMaterial && !m.material.transparent) m.castShadow = true; });

  // Glitches: angry little screens. Two frames: steady, and torn.
  const glitchFaces = [0, 1].map(f => canvasTex(128, 96, (g) => {
    g.fillStyle = "#0a0410"; g.fillRect(0, 0, 128, 96);
    g.save(); g.shadowColor = "#ff2a6a"; g.shadowBlur = 10; g.fillStyle = "#ff3d7f";
    const off = f ? 7 : 0;
    g.beginPath(); g.moveTo(22 + off, 30); g.lineTo(56 + off, 40); g.lineTo(54 + off, 54); g.lineTo(24 + off, 50); g.fill();
    g.beginPath(); g.moveTo(106 - off, 30); g.lineTo(72 - off, 40); g.lineTo(74 - off, 54); g.lineTo(104 - off, 50); g.fill();
    g.fillStyle = "#ffffff"; g.fillRect(40 + off, 42, 6, 6); g.fillRect(82 - off, 42, 6, 6);
    g.fillStyle = "#ff3d7f"; g.beginPath(); g.moveTo(34, 70); for (let q = 0; q <= 6; q++) g.lineTo(34 + q * 10, q % 2 ? 62 : 76); g.lineTo(94, 70); g.lineTo(94, 78); g.lineTo(34, 78); g.fill();
    g.restore();
    if (f) { g.fillStyle = "rgba(34,238,255,0.8)"; g.fillRect(0, 36, 128, 5); g.fillStyle = "rgba(255,42,122,0.7)"; g.fillRect(0, 64, 128, 4); }
    g.fillStyle = "rgba(255,255,255,0.06)"; for (let y = 0; y < 96; y += 4) g.fillRect(0, y, 128, 1);
  }));

  // ---------- Item makers ----------
  const basic = (c, extra) => new T.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, extra || {}));
  const glowSpr = (c, s, a = 0.8) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: a, blending: T.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, 1); return sp; };
  const starGeo2 = new T.OctahedronGeometry(0.42, 0);
  const makers = {
    light: () => { const g = new T.Group(); g.add(new T.Mesh(starGeo2, basic(0xffc94a))); g.add(glowSpr(0xffb030, 1.5, 0.45)); return g; },
    heart: () => { const s = new T.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(-0.9, 0.1, -0.45, 0.75, 0, 0.3); s.bezierCurveTo(0.45, 0.75, 0.9, 0.1, 0, -0.5); const g = new T.Group(); const m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }), new T.MeshPhysicalMaterial({ color: 0xff4d7a, emissive: 0x661030, roughness: 0.25, clearcoat: 1 })); m.position.z = -0.12; g.add(m); g.add(glowSpr(0xff5d8a, 2.6, 0.5)); return g; },
    rock: () => {
      // A security drone: a glossy pod, a red camera eye that tracks Bip, four spinning props.
      const g = new T.Group();
      const metal = new T.MeshPhysicalMaterial({ color: 0x2b3142, metalness: 0.75, roughness: 0.28, clearcoat: 0.6 });
      const pod = new T.MeshPhysicalMaterial({ color: 0xeef1f6, metalness: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
      const body = new T.Mesh(new T.SphereGeometry(0.55, 36, 22), pod); body.scale.set(1.15, 0.6, 1); g.add(body);
      const band = new T.Mesh(new T.TorusGeometry(0.58, 0.06, 10, 48), metal); band.rotation.x = Math.PI / 2; band.scale.set(1.12, 1, 1); g.add(band);
      const lensRing = new T.Mesh(new T.TorusGeometry(0.2, 0.05, 12, 32), metal); lensRing.position.set(0, -0.04, 0.52); g.add(lensRing);
      const lensBack = new T.Mesh(new T.CircleGeometry(0.2, 28), new T.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.2 })); lensBack.position.set(0, -0.04, 0.5); g.add(lensBack);
      const eye = new T.Mesh(new T.SphereGeometry(0.1, 20, 14), basic(0xff2b4a)); eye.position.set(0, -0.04, 0.52); g.add(eye);
      const eyeGlow = glowSpr(0xff2b4a, 0.9, 0.7); eyeGlow.position.set(0, -0.04, 0.6); g.add(eyeGlow);
      const strip = new T.Mesh(boxGeo, basic(0xff3b5c)); strip.scale.set(0.5, 0.04, 0.04); strip.position.set(0, -0.3, 0.38); g.add(strip);
      const props = [], blade = new T.MeshStandardMaterial({ color: 0x1c2030, metalness: 0.5, roughness: 0.4 });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = dx * 0.95, pz = dz * 0.7, arm = new T.Mesh(boxGeo, metal); arm.scale.set(Math.hypot(px, pz) * 0.9, 0.07, 0.09); arm.position.set(px * 0.55, 0.06, pz * 0.55); arm.rotation.y = -Math.atan2(pz, px); g.add(arm);
        const hub = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.16, 16), metal); hub.position.set(px, 0.12, pz); g.add(hub);
        const prop = new T.Group(); prop.position.set(px, 0.22, pz); g.add(prop);
        for (const r of [0, Math.PI / 2]) { const b = new T.Mesh(boxGeo, blade); b.scale.set(0.78, 0.015, 0.07); b.rotation.y = r; prop.add(b); }
        const disc = new T.Mesh(new T.CircleGeometry(0.42, 32), new T.MeshBasicMaterial({ color: 0xd8e2f0, transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.set(px, 0.225, pz); g.add(disc);
        props.push(prop);
      }
      g.userData = { eye, eyeGlow, props }; return g;
    },
    shadow: () => {
      // A glitch: a glossy dark cube with an angry screen face, colour-split ghosts and orbiting shards.
      const g = new T.Group();
      const body = new T.Mesh(boxGeo, new T.MeshPhysicalMaterial({ color: 0x2a1442, roughness: 0.25, metalness: 0.5, clearcoat: 1, emissive: 0x14061e }));
      body.scale.set(1, 0.9, 0.9); g.add(body);
      const face = new T.Mesh(new T.PlaneGeometry(0.86, 0.68), new T.MeshBasicMaterial({ map: glitchFaces[0], toneMapped: false })); face.position.z = 0.452; g.add(face);
      const ghosts = [0x22eeff, 0xff2a7a].map(c => { const m = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); m.scale.copy(body.scale); g.add(m); return m; });
      const shards = []; for (let q = 0; q < 9; q++) { const m = new T.Mesh(boxGeo, basic(q % 3 === 0 ? 0x22eeff : q % 3 === 1 ? 0xff2a7a : 0xffffff)); m.scale.setScalar(0.09 + (q % 3) * 0.04); g.add(m); shards.push(m); }
      g.add(glowSpr(0xff2a7a, 2.4, 0.28));
      g.userData = { body, face, ghosts, shards }; return g;
    },
    laser: () => { const g = new T.Group(); const core = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1, 8), basic(0xffe6f0)); core.rotation.z = Math.PI / 2; g.add(core); const outer = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1, 8), basic(0xff2a6a, { transparent: true, opacity: 0.45, depthWrite: false })); outer.rotation.z = Math.PI / 2; g.add(outer); return g; },
    emitter: () => { const g = new T.Group(); const b = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0x1c1f2b, metalness: 0.6, roughness: 0.3 })); b.scale.set(0.35, 0.9, 0.5); g.add(b); const l = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), basic(0xff3d7f)); l.position.z = 0.26; g.add(l); return g; },
    steam: () => new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshStandardMaterial({ color: 0xf5f8ff, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false })),
    vent: () => { const g = new T.Group(); const b = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0x2a2e3a, metalness: 0.5, roughness: 0.4 })); b.scale.set(0.6, 1.1, 1.2); g.add(b); const glow = new T.Mesh(boxGeo, basic(0xffaa3c)); glow.scale.set(0.62, 0.5, 0.9); g.add(glow); g.userData = { glow }; return g; },
    pane: () => { const g = new T.Group(); const m = new T.Mesh(boxGeo, new T.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 })); m.scale.set(0.95, 1.35, 0.06); g.add(m); const fr = new T.Mesh(new T.EdgesGeometry(new T.BoxGeometry(0.95, 1.35, 0.06)), new T.LineBasicMaterial({ color: 0xffffff })); g.add(fr); return g; },
    mark: () => new T.Mesh(new T.RingGeometry(0.5, 0.62, 32), basic(0xffffff, { transparent: true, opacity: 0.5, depthWrite: false })),
    balloon: () => { const g = new T.Group(); const m = new T.Mesh(new T.SphereGeometry(0.75, 32, 24), new T.MeshPhysicalMaterial({ color: 0xff5a6e, roughness: 0.2, clearcoat: 1 })); m.scale.set(1, 1.18, 1); g.add(m); const s = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.3, 4), basic(0xffffff)); s.position.y = -1.5; g.add(s); g.userData = { m }; return g; },
    car: () => { const g = new T.Group(); const b = new T.Mesh(boxGeo, new T.MeshPhysicalMaterial({ color: 0xff4d64, roughness: 0.3, clearcoat: 1 })); b.scale.set(1.5, 1.05, 1.05); g.add(b); const w = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xffe0a0, emissiveIntensity: 0, roughness: 0.1 })); w.scale.set(1.3, 0.42, 1.08); w.position.y = 0.12; g.add(w); const rope = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1, 6), basic(0x3c4050)); rope.position.y = 0.5; g.add(rope); g.userData = { w, rope }; return g; },
    cable: () => { const m = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1, 6), basic(0x3c4050)); m.rotation.z = Math.PI / 2; return m; },
    search: () => {
      const g = new T.Group(); const base = new T.Mesh(new T.CylinderGeometry(0.45, 0.55, 0.5, 20), new T.MeshStandardMaterial({ color: 0x2a2e3a, metalness: 0.6, roughness: 0.3 })); base.rotation.x = Math.PI / 2; g.add(base);
      const beam = new T.Group(); g.add(beam);
      const cone = new T.Mesh(new T.ConeGeometry(2.6, 15, 24, 1, true), new T.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
      cone.rotation.z = Math.PI / 2; cone.position.x = 7.5; beam.add(cone);
      const lens = new T.Mesh(new T.SphereGeometry(0.3, 16, 10), basic(0xfff6d6)); lens.position.x = 0.3; beam.add(lens);
      g.userData = { beam, cone }; return g;
    },
    streak: () => new T.Mesh(boxGeo, basic(0xffffff, { transparent: true, opacity: 0.5, depthWrite: false })),
    power: () => { const g = new T.Group(); const core = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), new T.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.2, clearcoat: 1 })); g.add(core); const ring = new T.Mesh(new T.TorusGeometry(0.75, 0.05, 8, 40), basic(0xffffff)); g.add(ring); const gl = glowSpr(0xffffff, 3.4, 0.6); g.add(gl); g.userData = { core, ring, gl }; return g; },
    friend: () => { const g = new T.Group(); const b = makeBot(0.6); b.userData.shell.color.set(0xffe0ef); b.userData.accent.color.set(0xff9ad0); b.userData.bulbMat.color.set(0xff9ad0); b.userData.halo.material.color.set(0xff9ad0); setFace(b, "worried", "#ff9ad0"); g.add(b); const s = new T.Sprite(new T.SpriteMaterial({ map: helpTex, transparent: true, depthWrite: false })); s.scale.set(1.5, 0.62, 1); s.position.y = 1.2; g.add(s); g.userData = { b }; return g; },
    puff: () => new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshStandardMaterial({ color: 0x1c1a2c, roughness: 0.85, emissive: 0x0c0614 })),
    zap: () => { const g = new T.Group(); for (let q = 0; q < 7; q++) { const m = new T.Mesh(boxGeo, basic(0xe6dcff)); g.add(m); } g.add(glowSpr(0xb08cff, 6, 0.5)); return g; },
    beye: () => new T.Mesh(new T.SphereGeometry(1, 16, 10), basic(0xbe96ff)),
    pip: () => new T.Mesh(new T.SphereGeometry(0.12, 10, 8), basic(0xffd98a)),
    bolt: () => { const g = new T.Group(); g.add(new T.Mesh(new T.OctahedronGeometry(0.22, 0), basic(0xffffff))); g.add(glowSpr(0xaa78ff, 1.6, 0.9)); return g; },
    ring: () => new T.Mesh(new T.TorusGeometry(1, 0.035, 6, 64), basic(0x7ff0ff, { transparent: true, depthWrite: false })),
    spark: () => glowSpr(0xffffff, 0.6, 1),
    trail: () => glowSpr(0x7ff0ff, 1, 0.6),
    tower: () => { const m = new T.Mesh(boxGeo, towerMats[0]); m.receiveShadow = true; return m; },
    rear: () => { const m = new T.Mesh(boxGeo, rearMat); m.receiveShadow = true; m.userData.cast = false; return m; },
    neon: () => new T.Mesh(boxGeo, neonMatL),
    ledge: () => { const m = new T.Mesh(boxGeo, ledgeMat); m.receiveShadow = true; return m; },
    back: () => { const m = new T.Mesh(boxGeo, backMat); m.receiveShadow = true; m.userData.cast = false; return m; },
    sign: () => new T.Mesh(new T.PlaneGeometry(2.6, 1), new T.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false })),
    halo: () => glowSpr(0xffffff, 1, 0.3),
    nglow: () => glowSpr(0xffffff, 1, 0.5),
  };
  const get = kind => pool(kind, makers[kind]);
  const islandMeshes = new WeakMap();

  // ---------- Size and placement ----------
  let W0 = 0, H0 = 0, dpr0 = 0, envT = -9, pxU = 1, onFail = false;
  const v3 = new T.Vector3();
  function size(W, H) {
    const dpr = Math.min(typeof modestPhone !== "undefined" && modestPhone ? 1.5 : 2.5, window.devicePixelRatio || 1);
    if (W === W0 && H === H0 && dpr === dpr0) return;
    W0 = W; H0 = H; dpr0 = dpr;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    if (composer) { if (composer.setPixelRatio) composer.setPixelRatio(dpr); composer.setSize(W, H); }
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  const trail = [];
  let lastDist = -1;

  function draw(ctx2d, W, H, P) {
    if (onFail) return null;
    const R = run, t = R.t, canvas2d = ctx2d.canvas;
    if (view.parentNode !== canvas2d.parentNode) canvas2d.parentNode.insertBefore(view, canvas2d);
    size(W, H);
    const wx = x => (x - 200) * U, wy = at => (at - R.dist) * U;
    const night = P.night, day = 1 - night;
    // The camera: below and in front of Bip, looking up the street, a little to the side as Bip moves.
    const bx = wx(R.x), camX = (R.camX || 0) * U, speedK = Math.min(1, Math.max(0, (R.speed - 200) / 200));
    const shake = R.shake > 0 ? R.shake * 0.25 : 0;
    camera.fov = 30 + speedK * 4; camera.updateProjectionMatrix();
    const fit = Math.max(1, 0.5 / (W / H));    // pull back on narrow screens so the whole street fits
    camera.position.set(camX * 0.9 + bx * 0.25 + (Math.random() - 0.5) * shake, -6 + (Math.random() - 0.5) * shake, 44 * fit);
    camera.lookAt(camX * 0.9 + bx * 0.3, 5.5, 0);
    // Sky and light.
    skyU.top.value.copy(C(P.sky[0])); skyU.mid.value.copy(C(P.sky[1])); skyU.bot.value.copy(C(P.sky[2]));
    sky.position.copy(camera.position);
    scene.fog.color.copy(C(P.sky[2])).lerp(C(P.sky[1]), 0.4);
    scene.fog.near = 130 - night * 30; scene.fog.far = 420;
    hemi.color.copy(C(P.sky[1])).lerp(new T.Color(1, 1, 1), 0.5); hemi.groundColor.copy(C(P.tower)).multiplyScalar(0.4);
    hemi.intensity = 0.35 + day * 0.65;
    sun.color.copy(C(P.sky[2])).lerp(new T.Color(1, 1, 1), 0.5); sun.intensity = 0.15 + day * 1.25;
    bipLight.color.copy(R.power ? C(rgbArr(RUN_POWERS[R.power.kind].rgb)) : new T.Color(0x7ff0ff)); bipLight.intensity = 0.3 + night * 2.2; bipLight.position.set(bx, 0.5, 2.5);
    stars.material.opacity = Math.max(0, night - 0.35) / 0.65; stars.position.copy(camera.position);
    sunSpr.material.opacity = day * 0.8; sunSpr.position.set(camera.position.x + 150, camera.position.y + 190, -320);
    moon.material.opacity = Math.max(0, night - 0.3) / 0.7; moon.visible = night > 0.3; moon.position.set(camera.position.x - 90, camera.position.y + 170, -380);
    if (bloom) { bloom.strength = 0.12 + night * 0.75; bloom.threshold = 0.95 - night * 0.35; bloom.radius = 0.4; }
    renderer.toneMappingExposure = 1.0 + day * 0.1;
    // Clouds by day, drifting past as you climb.
    clouds.forEach((s, q) => {
      const span = 1400, base = Math.floor((R.dist + q * span / clouds.length) / span), r = seeded(base * 17 + q), at = base * span - q * span / clouds.length + r() * 300;
      s.position.set(camX + (r() - 0.5) * 70, wy(at + span * 0.5) * 0.6, -40 - r() * 50); const w = 18 + r() * 22; s.scale.set(w, w * 0.45, 1);
      s.material.opacity = Math.max(0, 0.75 - night) * 1.1; s.material.color.copy(C(P.sky[2])).lerp(new T.Color(1, 1, 1), 0.6);
    });
    // Rain.
    rain.visible = !!P.rain;
    if (P.rain) { for (let q = 0; q < rainN; q++) { const s = rainSeed[q], x = camX + (s[0] - 0.5) * 30, z = 6 - s[1] * 22, y = 26 - ((s[2] * 40 + t * 30) % 40) - 8; rainPos.set([x, y, z, x - 0.15, y - 1.2, z], q * 6); } rainGeo.attributes.position.needsUpdate = true; }

    poolsReset();
    // ---------- The street: towers either side ----------
    sun.target.position.set(camera.position.x, 12, -4); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 120);
    sun.shadow.radius = 2.5;
    try { skyEnv(P, night); } catch (e) { noEnv = true; scene.environment = null; }
    const tower = P.tower, k0 = Math.floor((R.dist - 520) / BLOCK), k1 = Math.ceil((R.dist + 1500) / BLOCK);
    towerMats.forEach((m, q) => { const sh = 0.84 + q * 0.05; m.color.copy(C(tower)).multiplyScalar(sh).lerp(new T.Color(1, 1, 1), day * 0.15); m.emissive.copy(C(P.winC)); m.emissiveIntensity = 0.04 + night * 1.6; });
    backMat.color.copy(C(tower)).multiplyScalar(0.8); backMat.emissive.copy(C(P.winC)); backMat.emissiveIntensity = night * 0.9;
    ledgeMat.color.copy(C(tower)).lerp(new T.Color(1, 1, 1), 0.5);
    rearMat.color.copy(C(tower)).lerp(C(P.sky[1]), 0.35).multiplyScalar(0.82 - night * 0.42);
    neonMatL.color.copy(C(P.neon)).multiplyScalar(0.35 + night * 1.6); neonMatR.color.copy(C(P.neon2)).multiplyScalar(0.35 + night * 1.6);
    for (let k = k0; k <= k1; k++) {
      const y0 = wy(k * BLOCK), h = BLOCK * U;
      // Some stretches have a glass building across the back of the street: everything in the
      // street casts its shadow onto it. Gaps between them show the skyline.
      { const bld = Math.floor(k / 3), rb = seeded(bld * 97 + 13); if (rb() < 0.6) { const xl = wx(blockEdge(k, -1)), xr = wx(blockEdge(k, 1)), m = get("rear"); m.scale.set(xr - xl + 2, h, 1.2); m.position.set((xl + xr) / 2, y0 + h / 2, -7.2); } }
      for (const side of [-1, 1]) {
        const r = seeded(k * 31 + (side > 0 ? 17 : 0)), ex = wx(blockEdge(k, side)), w = 26, z0 = 0; r();
        const bld = Math.floor(k / 3), m = get("tower"); m.material = towerMats[Math.floor(seeded(bld * 31 + side * 5)() * 6)];
        m.scale.set(w, h - 0.12, DEPTH); m.position.set(ex + side * w / 2, y0 + h / 2, z0 - DEPTH / 2 + 2);
        m.material.map.repeat.set(1.5, 1);
        if (k % 3 === 0) { const ld = get("ledge"); ld.scale.set(w + 0.8, 0.3, DEPTH + 0.8); ld.position.set(ex + side * (w / 2 - 0.4), y0 + 0.1, z0 - DEPTH / 2 + 2); }
        const n = get("neon"); n.material = side < 0 ? neonMatL : neonMatR; n.scale.set(0.14, h, 0.14); n.position.set(ex + side * 0.07, y0 + h / 2, z0 + 2.05);
        if (night > 0.3) { const ng = get("nglow"); ng.scale.set(1.4, h, 1); ng.position.set(ex + side * 0.1, y0 + h / 2, z0 + 2.2); ng.material.color.copy(C(side < 0 ? P.neon : P.neon2)); ng.material.opacity = (night - 0.3) * 0.7; }
        if (r() < 0.25) {
          const words = ["OPEN", "24H", "CAFE", "HOTEL", "BAR", "NEON", "TAXI", "ROBO"], word = words[Math.floor(r() * words.length)], nc = r() < 0.5 ? P.neon : P.neon2;
          const s = get("sign"), key = word + (nc === P.neon ? "a" : "b");
          s.material = signMats[key] || (signMats[key] = new T.MeshBasicMaterial({ map: signFor(word), transparent: true, toneMapped: false, depthWrite: false }));
          s.material.color.copy(C(nc)).multiplyScalar(0.6 + night * 1.6);
          s.position.set(ex + side * 2.2, y0 + h * 0.5, z0 + 2.08); s.rotation.set(0, 0, 0);
        }
        // A second row of taller towers further out, then the far skyline.
        const bm = get("back"), r2 = seeded(k * 53 + side * 7);
        bm.scale.set(14, h * (1 + Math.floor(r2() * 3)), 12); bm.position.set(ex + side * (w + 4 + r2() * 8), y0 + bm.scale.y / 2, -16 - r2() * 8);
      }
    }
    // The far skyline: tall towers whose rooftops you pass as you climb.
    for (let j = Math.floor((R.dist - 1500) / 700); j <= Math.floor((R.dist + 4000) / 700); j++) {
      for (let q = 0; q < 4; q++) {
        const r = seeded(j * 11 + q * 3 + 1), top = wy(j * 700 + r() * 700), bm = get("back"), hgt = top + 140;
        if (hgt <= 0) continue;
        bm.scale.set(10 + r() * 14, hgt, 10 + r() * 8); bm.position.set(camX + (q - 1.5) * 26 + (r() - 0.5) * 10, top - hgt / 2, -60 - r() * 60);
      }
    }
    // ---------- Things in the street ----------
    const yMin = -26, yMax = 70;
    for (const it of R.items) {
      if (it.gone && it.type !== "light") continue;
      const y = wy(it.at); if (y < yMin || y > yMax) continue;
      const mid = caveMid(it.at), hw = caveHalf(it.at, R.dist);
      switch (it.type) {
        case "light": {
          if (it.got != null) break;
          const o = get("light"); o.position.set(wx(it.x), y, 0); o.rotation.set(0, t * 2 + it.at, 0.4); o.children[0].material.color.set(night > 0.4 ? 0xffd25a : 0xffb21c);
          break;
        }
        case "heart": { const o = get("heart"); o.position.set(wx(it.x), y + Math.sin(t * 3) * 0.15, 0); o.rotation.set(0, Math.sin(t * 2) * 0.6, 0); o.scale.setScalar(0.9 + Math.sin(t * 6) * 0.05); break; }
        case "rock": {
          const o = get("rock"), s = it.r / 22, ud = o.userData; o.scale.setScalar(s);
          o.position.set(wx(it.x), y + Math.sin(t * 4 + it.seed) * 0.1, 0); o.rotation.set(0.25 + Math.sin(t * 1.7 + it.seed) * 0.06, Math.sin(t * 0.8 + it.seed) * 0.25, Math.sin(t * 2 + it.seed) * 0.08);
          ud.props.forEach((p, q) => (p.rotation.y = t * 38 + q));
          const lx = Math.max(-0.07, Math.min(0.07, (R.x - it.x) * 0.002)), ly = Math.max(-0.06, Math.min(0.03, (R.dist - it.at) * 0.0004));
          ud.eye.position.set(lx, -0.04 + ly, 0.52); ud.eyeGlow.position.set(lx, -0.04 + ly, 0.62); ud.eyeGlow.material.opacity = 0.5 + 0.4 * Math.sin(t * 6 + it.seed);
          break;
        }
        case "shadow": {
          if (it.freed) break;
          const o = get("shadow"), ud = o.userData, x = wx(it.cx ?? it.x), fr = Math.floor(t * 14 + (it.ph || 0) * 10), jr = seeded(fr * 7 + Math.floor(it.at));
          const torn = jr() < 0.16, look = Math.max(-1, Math.min(1, (R.x - (it.cx ?? it.x)) * 0.02));
          o.position.set(x + (torn ? (jr() - 0.5) * 0.35 : 0), y + Math.sin(t * 3 + it.ph) * 0.12, 0);
          o.rotation.set(Math.sin(t * 1.7 + it.ph) * 0.18, look * 0.35 + Math.sin(t * 1.3 + it.ph) * 0.25, Math.sin(t * 2.1 + it.ph) * 0.08);
          ud.face.material.map = glitchFaces[torn ? 1 : 0];
          ud.body.scale.set(torn ? 1.18 : 1, torn ? 0.78 : 0.9, 0.9);
          ud.ghosts.forEach((m, q) => { m.visible = torn || jr() < 0.25; m.scale.copy(ud.body.scale); m.position.set((q ? 1 : -1) * (0.07 + jr() * 0.14), (jr() - 0.5) * 0.08, 0); });
          ud.shards.forEach((m, q) => { const a = t * (1.4 + q * 0.12) + q * 0.7, r = 0.82 + Math.sin(t * 2 + q) * 0.12; m.position.set(Math.cos(a) * r, Math.sin(a * 1.3 + q) * 0.55, Math.sin(a) * r * 0.6); m.rotation.set(a, a * 1.2, 0); });
          break;
        }
        case "gate": {
          const gap = 34 + 30 * (0.5 + 0.5 * Math.sin(t * 1.6 + it.ph)) + (perk(3) ? 22 : 0);
          for (const side of [-1, 1]) {
            const x0 = mid + side * (hw + 6), x1 = mid + side * gap, len = Math.abs(x1 - x0) * U;
            for (const dy of [-0.22, 0.22]) { const l = get("laser"); l.scale.set(1, 1, 1); l.children.forEach(c => (c.scale.y = len)); l.position.set(wx((x0 + x1) / 2), y + dy, 0); }
            const e = get("emitter"); e.position.set(wx(x1) + side * 0.15, y, 0);
          }
          break;
        }
        case "lava": {
          const wall = mid + it.side * hw, warn = Math.max(0, Math.sin(t * 1.3 + it.ph - 0.6));
          const v = get("vent"); v.position.set(wx(wall) - it.side * 0.2, y, 0); v.userData.glow.material.color.setRGB(1, 0.66, 0.24).multiplyScalar(0.4 + warn * 1.4);
          if (it.len > 4) for (let q = 0; q < 8; q++) { const k = q / 7, s = get("steam"), r = (6 + k * 10) * U; s.scale.setScalar(r); s.position.set(wx(wall - it.side * it.len * k), y + Math.sin(t * 8 + q) * 0.12, 0); s.material.opacity = 0.85 - k * 0.5; }
          break;
        }
        case "ice": {
          const warn = Math.max(0, 1 - Math.abs(it.at - R.dist) / 320), o = get("pane"), fall = Math.max(0, y) * 0.0;
          o.position.set(wx(it.x), y + fall, 0); o.rotation.set(Math.sin(t * 3 + it.at) * 0.3, t * 1.5 + it.at, Math.sin(t * 2 + it.at) * 0.25);
          if (warn > 0) { const mk = get("mark"); mk.position.set(wx(it.x), 0, 0.02); mk.scale.setScalar(1 + (1 - warn)); mk.material.opacity = 0.6 * warn; mk.material.color.set(night > 0.5 ? 0xc8e6ff : 0x284a70); }
          break;
        }
        case "bubble": { const o = get("balloon"), c = [0xff5a6e, 0xffbe3c, 0x5ac8ff, 0xaa78ff][Math.floor(((it.ph || 0) * 10) % 4)]; o.userData.m.material.color.set(c); o.position.set(wx(it.x), y + Math.sin(t * 2 + it.ph) * 0.15, 0); o.rotation.z = Math.sin(t * 1.5 + it.ph) * 0.12; break; }
        case "lantern": {
          const x = wx(it.x || mid), ay = y + 7.5;
          const cb = get("cable"); cb.scale.set(1, hw * 2 * U + 2, 1); cb.position.set(wx(mid), ay, 0);
          const o = get("car"), dx = x - wx(mid + Math.sin(it.ph) * 10), ropeL = Math.hypot(dx, 7.5 - 0.5);
          o.position.set(x, y, 0); o.rotation.z = Math.atan2(dx, 7) * 0.6; o.userData.rope.scale.y = ropeL; o.userData.rope.position.y = 0.5 + ropeL / 2; o.userData.w.material.emissiveIntensity = night * 1.5;
          break;
        }
        case "eye": {
          const o = get("search"), ex = wx(mid + it.side * hw), ang = it.ang ?? 0;
          o.position.set(ex, y, 0); o.userData.beam.rotation.z = ang; o.userData.cone.material.opacity = 0.18 + Math.max(0, it.burn || 0) * 0.5 + night * 0.12;
          break;
        }
        case "current": {
          for (let q = 0; q < 12; q++) { const s = get("streak"), ph = ((t * 1.6 + q * 0.37) % 1), x0 = mid - hw + ph * hw * 2; s.scale.set(44 * U, 0.06, 0.06); s.position.set(wx(x0), wy(it.at + (q / 12) * it.len), 0.3); s.material.opacity = 0.35 + 0.3 * Math.sin(ph * Math.PI); }
          break;
        }
        case "power": {
          const o = get("power"), c = C(rgbArr(RUN_POWERS[it.kind].rgb)); o.position.set(wx(it.x), y + Math.sin(t * 3) * 0.15, 0);
          o.userData.core.material.color.copy(c); o.userData.core.material.emissive.copy(c); o.userData.ring.material.color.copy(c).multiplyScalar(1.6); o.userData.gl.material.color.copy(c);
          o.userData.core.rotation.set(t, t * 1.3, 0); o.userData.ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t, 0);
          break;
        }
        case "friend": { const o = get("friend"); o.position.set(wx(it.x), y + Math.sin(t * 2) * 0.25, 0); o.userData.b.rotation.set(0, Math.sin(t * 1.5) * 0.4, Math.sin(t * 3) * 0.1); break; }
        case "island": {
          let m = islandMeshes.get(it);
          if (!m) {
            const s = new T.Shape(), pts = [];
            for (let a = it.at; a <= it.at + it.len; a += 12) pts.push([wx(caveMid(a) - islandHalf(it, a)), (a - it.at) * U]);
            for (let a = it.at + it.len; a >= it.at; a -= 12) pts.push([wx(caveMid(a) + islandHalf(it, a)), (a - it.at) * U]);
            pts.forEach((p, q) => (q ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
            m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false }), towerMats[2]); scene.add(m); islandMeshes.set(it, m);
            it._m3 = true;
          }
          m.visible = true; m.position.set(0, y, -5); m.userData.f = R.t;
          break;
        }
      }
    }
    // Islands that have scrolled away are hidden.
    scene.children.forEach(o => { if (o.userData && o.userData.f != null && o.userData.f !== R.t) o.visible = false; });
    // The Blackout: a storm cloud with violet eyes, gold when it's listening.
    if (R.boss) {
      const B = R.boss, x = wx(B.x), y = wy(B.at), s = 1 + Math.sin(t * 2) * 0.04;
      for (let q = 0; q < 9; q++) { const a = q / 9 * Math.PI * 2 + t * 0.3, rr = (0.55 + 0.15 * Math.sin(t * 1.5 + q)) * 2.6 * s, p = get("puff"); p.scale.setScalar(rr); p.position.set(x + Math.cos(a) * 2.2, y - 1 + Math.sin(a) * 1.3, -1 + Math.sin(a * 2) * 0.6); p.material.color.set(B.hurt > 0 ? 0x5a4682 : 0x1c1a2c); }
      const core = get("puff"); core.scale.set(3.6, 2.4, 2); core.position.set(x, y - 1, 0);
      const listen = B.listen > 0;
      if ((Math.floor(t * 9) * 7919) % 11 < 1) { const z = get("zap"), zr = seeded(Math.floor(t * 9)); let zx = x + (zr() - 0.5) * 3, zy = y - 2.2; z.position.set(0, 0, 0.5); z.children.forEach((m, q) => { if (!m.isMesh) { m.position.set(zx, zy, 0); return; } const nx = zx + (zr() - 0.5) * 1.4, ny = zy - 0.9 - zr() * 0.6; m.position.set((zx + nx) / 2, (zy + ny) / 2, 0); m.scale.set(0.07, Math.hypot(nx - zx, ny - zy), 0.07); m.rotation.set(0, 0, Math.atan2(-(nx - zx), ny - zy) + Math.PI); zx = nx; zy = ny; }); }
      for (const sd of [-1, 1]) { const e = get("beye"); e.scale.set(0.5, listen ? 0.36 : 0.2, 0.2); e.position.set(x + sd * 1.1, y - 1.1, 2); e.rotation.z = sd * -0.3; e.material.color.set(listen ? 0xffd778 : 0xbe96ff); }
      for (let q = 0; q < B.hp; q++) { const p = get("pip"); p.position.set(x + (q - (B.hp - 1) / 2) * 0.6, y + 2.2, 1); }
      for (const bl of B.bolts) { const o = get("bolt"); o.position.set(wx(bl.x), wy(bl.at), 0.3); o.rotation.set(t * 4, t * 3, 0); }
    }
    // Pulses: rings spreading out from Bip.
    for (const ring of R.rings) { const k = ring.r / ring.max, o = get("ring"); o.position.set(wx(ring.x), wy(ring.at), 0.2); o.scale.setScalar(Math.max(0.01, ring.r * U)); o.material.opacity = 1 - k; o.material.color.set(night > 0.4 ? 0x7ff0ff : 0x1aa0ff); }
    for (const p of R.parts) { const o = get("spark"), s = (p.size || 8) * U * 2.2; o.scale.set(s, s, 1); o.position.set(wx(p.x), wy(p.at), 0.4); o.material.opacity = Math.min(1, p.life * 2); o.material.color.set(p.gold ? 0xffd782 : 0xaaf0ff); }
    // Bip's trail: glowing dots left behind.
    if (lastDist < 0 || Math.abs(R.dist - lastDist) > 400) trail.length = 0;
    lastDist = R.dist;
    trail.unshift([R.x, R.dist]); if (trail.length > 26) trail.length = 26;
    const tr = (RUN_TRAILS[(save.run || {}).trail || 0] || RUN_TRAILS[0]), trc = R.attract ? [150, 235, 255] : rgbArr(trailRgb(t));
    trail.forEach(([x, d], q) => { if (q % 1) return; const o = get("trail"), k = 1 - q / trail.length, s = (0.2 + k * 0.6); o.scale.set(s, s, 1); o.position.set(wx(x), wy(d) - 0.7, 0.1); o.material.opacity = k * 0.6; o.material.color.copy(C(trc)); });
    // Bip.
    const blinkOut = R.inv > 0.4 && Math.floor(R.inv * 12) % 2;
    bip.visible = !blinkOut;
    const tilt = R.tilt || 0, bob = Math.sin(t * 2.6) * 0.08;
    bip.position.set(bx, bob, 0.6);
    bip.rotation.set(0.12, -tilt * 0.9 + (R.happy > 0 ? (1 - Math.min(1, R.happy)) * Math.PI * 2 : 0), -tilt * 1.1);
    bip.scale.setScalar((!R.attract && perk(9) ? 0.8 : 1) * 1.35);
    const playingFriend = !R.attract && playingAs() >= 0, sk = playingFriend ? ["#fff4fa", "#ffd6ea", "#e98ab8"] : SKINS[save.skin] && skinUnlocked(save.skin) && SKINS[save.skin].body ? SKINS[save.skin].body : ["#ffffff", "#f2f5fa", "#a9b6c9"];
    const ud = bip.userData; ud.shell.color.set(sk[1]);
    const eyeHex = playingFriend ? "#ff9ad0" : "#7ff0ff", pc = R.power ? C(rgbArr(RUN_POWERS[R.power.kind].rgb)) : new T.Color(eyeHex);
    ud.accent.color.set(eyeHex); ud.bulbMat.color.copy(pc); ud.halo.material.color.copy(pc); ud.flameMat.color.copy(pc).lerp(new T.Color(1, 1, 1), 0.5);
    ud.halo.material.opacity = 0.05 + night * 0.35 + (R.songCd > 0.85 ? 0.3 : 0);
    const danger = R.items.some(it => ((it.type === "shadow" && !it.freed) || it.type === "rock" || it.type === "ice") && !it.gone && it.at > R.dist && it.at - R.dist < 120 && Math.abs((it.cx ?? it.x) - R.x) < 55);
    const expr = R.inv > 1.0 ? "hurt" : R.happy > 0 ? "happy" : R.songCd > 0.85 ? "wow" : R.power ? "star" : danger ? "worried" : (t % 3.4) < 0.12 ? "blink" : "idle";
    setFace(bip, expr, R.power && expr === "star" ? `rgb(${RUN_POWERS[R.power.kind].rgb})` : eyeHex);
    ud.head.rotation.set(0, Math.max(-0.35, Math.min(0.35, (R.vx || 0) * 0.002)), 0);
    ud.hands.forEach((h, q) => { const sd = q ? 1 : -1, up = R.happy > 0 ? 0.55 : expr === "worried" ? 0.25 : 0; h.position.set(sd * (0.64 + up * 0.15), -0.45 + Math.sin(t * 5 + q * 2) * 0.05 + up, 0.06 + up * 0.2); });
    const fl = 1 + Math.sin(t * 30) * 0.15 + speedK * 0.7; ud.flames.forEach((f, q) => { f.scale.set(1, fl * (1 + Math.sin(t * 27 + q) * 0.1), 1); f.position.y = -0.8 - 0.27 * fl; });
    poolsHideRest();
    // Glass reflects the sky: refresh the reflections now and then as the sky changes.
    try { if (composer) composer.render(); else renderer.render(scene, camera); } catch (e) { onFail = true; view.remove(); return null; }
    // How many screen pixels one map unit spans at Bip's depth, for the 2D overlays.
    const a = project(R.x, R.dist, W, H), b = project(R.x + 100, R.dist, W, H); pxU = Math.hypot(b[0] - a[0], b[1] - a[1]) / 100;
    return (x, at) => project(x, at, W, H);
  }
  function project(x, at, W, H) { v3.set((x - 200) * U, (at - run.dist) * U, 0).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  // Reflections: the sky dome rendered into an environment map for the glass and gloss.
  let pmrem = null, envRT = null, noEnv = false, envKey = "";
  const envCanvas = document.createElement("canvas"); envCanvas.width = 512; envCanvas.height = 256;
  const envTex = new T.CanvasTexture(envCanvas); envTex.mapping = T.EquirectangularReflectionMapping; envTex.encoding = T.sRGBEncoding;
  // The sky (and a city below the horizon) painted into a panorama that glass and gloss reflect.
  function skyEnv(P, night) {
    const key = P.sky.map(c => c.map(v => v >> 4).join(".")).join("|") + "|" + Math.round(night * 5);
    if (key === envKey || noEnv) return; envKey = key;
    const g = envCanvas.getContext("2d"), css = c => `rgb(${c.map(v => Math.round(v)).join(",")})`, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, css(P.sky[0])); gr.addColorStop(0.32, css(P.sky[1])); gr.addColorStop(0.49, css(P.sky[2]));
    gr.addColorStop(0.51, css(P.tower.map(v => v * (0.55 - night * 0.35)))); gr.addColorStop(1, "#06070b");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const r = seeded(3);
    for (let q = 0; q < 40; q++) { const x = r() * 512, w = 8 + r() * 26, h = 10 + r() * 40; g.fillStyle = css(P.tower.map(v => v * (0.5 - night * 0.3))); g.fillRect(x, 128 - h, w, h + 2); }
    if (night > 0.3) for (let q = 0; q < 260; q++) { g.fillStyle = `rgba(${P.winC.join(",")},${0.4 + r() * 0.6})`; g.fillRect(r() * 512, 100 + r() * 120, 2, 2); }
    if (night < 0.7) { const sg = g.createRadialGradient(380, 60, 0, 380, 60, 60); sg.addColorStop(0, `rgba(255,250,235,${1 - night})`); sg.addColorStop(1, "rgba(255,240,210,0)"); g.fillStyle = sg; g.fillRect(300, 0, 160, 130); }
    envTex.needsUpdate = true;
    if (!pmrem) pmrem = new T.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(envTex);
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
  }
  const envScene = new T.Scene(); const envSky = new T.Mesh(new T.SphereGeometry(100, 24, 12), skyMat); envScene.add(envSky);
  function refreshEnv() {
    if (noEnv) { scene.environment = null; return; }
    if (!pmrem) pmrem = new T.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.02);
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
  }
  function hide() { if (view.parentNode) view.remove(); }
  return { draw, hide, get pxU() { return pxU; }, view, _scene: scene, _r: renderer, set noEnv(v) { noEnv = v; } };
} catch (e) { console.warn("3D city unavailable", e); return null; } })();

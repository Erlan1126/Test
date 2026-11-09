// Echo: lit cave rendering on the graphics chip (WebGL). The painted cave comes with a bump map
// (which way each bit of rock faces), and nearby lights (Lumi, crystals, lava, lanterns...) shade
// it: rock facing a light brightens, rock facing away falls into shadow, and wet stone glints.
// What has been revealed (by songs, light and memory) still decides what can be seen at all.
// If WebGL isn't available, draw.js falls back to the plain 2D blend.
"use strict";

const GLR = (() => {
  const canvas = document.createElement("canvas");
  let gl = null;
  try { gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) {}
  if (!gl) return null;
  const MAX = 16;
  const vs = `
    attribute vec2 aPos;
    uniform vec4 uRect;   // where the cave art sits on screen, in clip space: x, y, w, h
    varying vec2 vUv;
    void main() {
      vUv = aPos;
      gl_Position = vec4(uRect.x + aPos.x * uRect.z, uRect.y - aPos.y * uRect.w, 0.0, 1.0);
    }`;
  const fs = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uAlbedo, uNormal, uVis;
    uniform vec2 uDims;          // size of the art, in tiles
    uniform vec4 uL[${MAX}];     // light: x, y (tiles), radius (tiles), strength
    uniform vec3 uC[${MAX}];     // light colour
    uniform int uN;
    uniform float uAmbient;
    uniform float uTime;
    void main() {
      vec4 alb = texture2D(uAlbedo, vUv);
      vec4 nm = texture2D(uNormal, vUv);
      vec3 n = normalize(nm.xyz * 2.0 - 1.0);
      float rock = nm.a;
      float vis = clamp(texture2D(uVis, vUv).a * 1.15, 0.0, 1.0);
      vec2 p = vUv * uDims;
      // Soft light from above-left keeps revealed rock readable even far from any lamp.
      vec3 sky = normalize(vec3(-0.35, -0.6, 0.72));
      vec3 lit = vec3(uAmbient * (0.55 + 0.6 * max(dot(n, sky), 0.0))), air = vec3(0.0);
      for (int i = 0; i < ${MAX}; i++) {
        if (i >= uN) break;
        vec4 L = uL[i];
        L.w *= 1.0 + 0.07 * sin(uTime * (2.3 + float(i) * 0.37) + float(i) * 1.7);
        vec2 d = L.xy - p;
        float a = clamp(1.0 - length(d) / L.z, 0.0, 1.0);
        a *= a;
        vec3 ld = normalize(vec3(d, 0.85));
        float diff = max(dot(n, ld), 0.0);
        vec3 h = normalize(ld + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(n, h), 0.0), 28.0) * rock * 0.55;
        lit += uC[i] * L.w * a * (0.25 + diff * 1.15 + spec);
        // Light hanging in the air of the open cave, like dust or mist catching it.
        air += uC[i] * L.w * a * a * 0.08 * (1.0 - rock);
      }
      vec3 col = alb.rgb * lit + air;
      gl_FragColor = vec4(col * vis, vis);
    }`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = name => gl.getUniformLocation(prog, name);
  const u = { time: U("uTime"), rect: U("uRect"), dims: U("uDims"), L: U("uL"), C: U("uC"), N: U("uN"), amb: U("uAmbient"),
    alb: U("uAlbedo"), nrm: U("uNormal"), vis: U("uVis") };
  const tex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tAlb = tex(), tNrm = tex(), tVis = tex();
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  let uploaded = -1, lost = false;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; });
  const Ls = new Float32Array(MAX * 4), Cs = new Float32Array(MAX * 3);

  return {
    canvas,
    get ok() { return !lost; },
    // Draws the lit cave into this canvas (sized w×h); the art covers rect (in canvas pixels).
    render(w, h, rect, dims, lights, ambient) {
      if (lost) return false;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (uploaded !== artVersion) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tAlb);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tNrm);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normArt);
        uploaded = artVersion;
      }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tVis);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lightCanvas);
      gl.uniform1i(u.alb, 0); gl.uniform1i(u.nrm, 1); gl.uniform1i(u.vis, 2);
      gl.uniform4f(u.rect, rect[0] / w * 2 - 1, 1 - rect[1] / h * 2, rect[2] / w * 2, rect[3] / h * 2);
      gl.uniform2f(u.dims, dims[0], dims[1]);
      const n = Math.min(MAX, lights.length);
      Ls.fill(0); Cs.fill(0);
      for (let k = 0; k < n; k++) {
        const l = lights[k];
        Ls.set([l.x, l.y, l.r, l.i], k * 4);
        Cs.set(l.c, k * 3);
      }
      gl.uniform4fv(u.L, Ls);
      gl.uniform3fv(u.C, Cs);
      gl.uniform1i(u.N, n);
      gl.uniform1f(u.amb, ambient);
      gl.uniform1f(u.time, clock);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
  };
})();

// Bloom: bright things (Lumi, lights, crystals, lava, songs) bleed a soft glow into the air
// around them. The finished frame is shrunk to half size, its brightest parts are blurred
// on the graphics chip, and the glow is added back over the frame. Only the brightest parts
// glow, at half size, so edges stay crisp.
const BLOOM = (() => {
  const canvas = document.createElement("canvas");
  let gl = null;
  try { gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false }); } catch (e) {}
  if (!gl) return null;
  const small = document.createElement("canvas"), sctx = small.getContext("2d");
  const vs = `attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;
  // pass 0: keep only bright parts, blurred across; pass 1: blurred down.
  const fs = `precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uStep; uniform float uPass;
    vec3 pick(vec2 uv) {
      vec3 c = texture2D(uTex, uv).rgb;
      if (uPass > 0.5) return c;
      float l = dot(c, vec3(0.3, 0.55, 0.15));
      return c * smoothstep(0.55, 0.95, l);
    }
    void main() {
      vec3 c = pick(vUv) * 0.227;
      c += (pick(vUv + uStep * 1.38) + pick(vUv - uStep * 1.38)) * 0.316;
      c += (pick(vUv + uStep * 3.23) + pick(vUv - uStep * 3.23)) * 0.07;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch (e) { return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uStep = gl.getUniformLocation(prog, "uStep"), uPass = gl.getUniformLocation(prog, "uPass");
  gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
  const tex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tSrc = tex(), tMid = tex(), fbo = gl.createFramebuffer();
  let fw = 0, fh = 0, lost = false;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; });
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return {
    // Adds the glow of `source` (the finished frame) onto ctx, which covers w×h.
    apply(source, target, w, h, strength) {
      if (lost) return;
      const bw = Math.max(16, Math.round(w / 2)), bh = Math.max(16, Math.round(h / 2));
      if (small.width !== bw || small.height !== bh) { small.width = bw; small.height = bh; }
      sctx.drawImage(source, 0, 0, bw, bh);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      if (fw !== bw || fh !== bh) {
        fw = bw; fh = bh;
        gl.bindTexture(gl.TEXTURE_2D, tMid);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tMid, 0);
      }
      gl.viewport(0, 0, bw, bh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tSrc);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, small);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.uniform2f(uStep, 1.5 / bw, 0); gl.uniform1f(uPass, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, tMid);
      gl.uniform2f(uStep, 0, 1.5 / bh); gl.uniform1f(uPass, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      target.save();
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.globalCompositeOperation = "lighter";
      target.globalAlpha = strength;
      target.drawImage(canvas, 0, 0, source.width, source.height);
      target.restore();
    },
  };
})();

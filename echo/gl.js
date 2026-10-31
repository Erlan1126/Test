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
    void main() {
      vec4 alb = texture2D(uAlbedo, vUv);
      vec4 nm = texture2D(uNormal, vUv);
      vec3 n = normalize(nm.xyz * 2.0 - 1.0);
      float rock = nm.a;
      float vis = clamp(texture2D(uVis, vUv).a * 1.15, 0.0, 1.0);
      vec2 p = vUv * uDims;
      // Soft light from above-left keeps revealed rock readable even far from any lamp.
      vec3 sky = normalize(vec3(-0.35, -0.6, 0.72));
      vec3 lit = vec3(uAmbient * (0.55 + 0.6 * max(dot(n, sky), 0.0)));
      for (int i = 0; i < ${MAX}; i++) {
        if (i >= uN) break;
        vec4 L = uL[i];
        vec2 d = L.xy - p;
        float a = clamp(1.0 - length(d) / L.z, 0.0, 1.0);
        a *= a;
        vec3 ld = normalize(vec3(d, 0.85));
        float diff = max(dot(n, ld), 0.0);
        vec3 h = normalize(ld + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(n, h), 0.0), 28.0) * rock * 0.55;
        lit += uC[i] * L.w * a * (0.25 + diff * 1.15 + spec);
      }
      vec3 col = alb.rgb * lit;
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
  const u = { rect: U("uRect"), dims: U("uDims"), L: U("uL"), C: U("uC"), N: U("uN"), amb: U("uAmbient"),
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
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
  };
})();

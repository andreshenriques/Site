/* RUMO 3D — visualizador WebGL sem dependências externas (SenseLab) */
(function () {
  'use strict';
  var D = Math.PI / 180;
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MODEL = null;

  function getModel() {
    if (MODEL) return MODEL;
    var s = window.RUMO_MODEL_B64;
    if (!s) return null;
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    var buf = u.buffer, dv = new DataView(buf), jl = dv.getUint32(0, true);
    var txt = '';
    for (var k = 0; k < jl; k++) txt += String.fromCharCode(u[4 + k]);
    var json = JSON.parse(txt), off = 4 + jl;
    MODEL = { json: json, vb: new Uint8Array(buf, off, json.vbytes), ib: new Uint16Array(buf, off + json.vbytes, json.icount) };
    window.RUMO_MODEL_B64 = null;
    return MODEL;
  }

  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor;',
    'uniform vec3 uMin, uExt; uniform mat4 uMV, uP;',
    'varying vec3 vN, vP;',
    'void main(){ vec3 p = uMin + aPos * uExt; vec4 mv = uMV * vec4(p, 1.0);',
    '  vP = mv.xyz; vN = mat3(uMV) * aNor; gl_Position = uP * mv; }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec3 vN, vP;',
    'uniform vec3 uCol, uEmis, uHi; uniform float uMetal, uRough, uGhost, uExpo, uCoat;',
    'float box(vec3 d, vec3 dir, float size, float r){ float e = mix(0.012, 0.55, r); return smoothstep(size - e, size + 0.02 + e * 0.4, dot(d, dir)); }',
    'vec3 env(vec3 d, float r){',
    '  vec3 c = mix(vec3(0.035, 0.04, 0.055), vec3(0.34, 0.37, 0.43), smoothstep(-0.9, 0.9, d.y));',
    '  c += vec3(3.4, 3.3, 3.2) * box(d, normalize(vec3(0.35, 0.72, 0.6)), 0.86, r);',
    '  c += vec3(1.5, 1.7, 2.3) * box(d, normalize(vec3(-0.85, 0.25, -0.2)), 0.88, r);',
    '  c += vec3(2.2, 0.95, 0.75) * box(d, normalize(vec3(0.8, -0.15, -0.45)), 0.9, r);',
    '  c += vec3(0.55, 0.5, 0.75) * exp(-d.y * d.y / (0.012 + r * 0.5)) * (0.5 + 0.5 * d.x);',
    '  return c; }',
    'void main(){',
    '  vec3 N = normalize(vN); vec3 V = normalize(-vP);',
    '  if (dot(N, V) < 0.0) N = -N;',
    '  float nv = max(dot(N, V), 0.0); vec3 R = reflect(-V, N);',
    '  vec3 base = mix(uCol, vec3(0.3, 0.37, 0.52), uGhost * 0.85);',
    '  vec3 F0 = mix(vec3(0.04), base, uMetal);',
    '  vec3 dc = base * (1.0 - uMetal);',
    '  float fr = pow(1.0 - nv, 5.0);',
    '  vec3 F = F0 + (max(vec3(1.0 - uRough), F0) - F0) * fr;',
    '  vec3 L = normalize(vec3(0.35, 0.72, 0.6));',
    '  vec3 irr = mix(vec3(0.16, 0.16, 0.2), vec3(0.95, 0.97, 1.05), N.y * 0.5 + 0.5) * 0.75 + vec3(1.9) * max(dot(N, L), 0.0)',
    '    + vec3(0.25, 0.3, 0.45) * max(dot(N, normalize(vec3(-0.85, 0.25, -0.2))), 0.0);',
    '  vec3 spec = env(R, uRough) * F * mix(1.0, 0.35, uRough * uRough);',
    '  spec += env(R, 0.12) * (0.04 + 0.96 * fr) * uCoat * 0.5;',
    '  vec3 col = dc * irr + spec + uEmis * 1.6 + uHi * (0.45 + 0.9 * pow(1.0 - nv, 2.0));',
    '  col *= uExpo;',
    '  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);',
    '  col = pow(col, vec3(1.0 / 2.2));',
    '  float a = mix(1.0, clamp(0.035 + 0.62 * pow(1.0 - nv, 2.0) + dot(spec, vec3(0.3)) * 0.22, 0.0, 0.9), uGhost);',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  function persp(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  }
  function lookAt(e, t) {
    var zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], l = Math.hypot(zx, zy, zz) || 1;
    zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;   // up(0,1,0) x z
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }

  var KEYS = ['theta', 'phi', 'radius', 'tx', 'ty', 'tz', 'roll'];

  function create(host, opt) {
    opt = opt || {};
    var model = getModel();
    if (!model) { host.classList.add('nogl'); return null; }
    var J = model.json;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var gl = null;
    try {
      var attrs = { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opt.preserve };
      gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    } catch (e) { gl = null; }
    if (!gl) { host.classList.add('nogl'); return null; }

    var prog, U = {}, vbo, ibo, aPos, aNor;
    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function initGL() {
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      ['uMin', 'uExt', 'uMV', 'uP', 'uCol', 'uEmis', 'uHi', 'uMetal', 'uRough', 'uGhost', 'uExpo', 'uCoat'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      aPos = gl.getAttribLocation(prog, 'aPos'); aNor = gl.getAttribLocation(prog, 'aNor');
      vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, model.vb, gl.STATIC_DRAW);
      ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.ib, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNor);
      gl.uniform3fv(U.uMin, J.min); gl.uniform3fv(U.uExt, J.ext);
    }
    try { initGL(); } catch (e) { if (window.console) console.error(e); host.classList.add('nogl'); return null; }

    var meshes = J.meshes.map(function (m) {
      var mat = J.mats[m.m];
      return { name: m.n, mat: mat, int: m.g === 'int', shell: mat.n === 'pla' || mat.n === 'tpu', motor: m.n.indexOf('Motor_') === 0, v: m.v, i: m.i, c: m.c, hi: false };
    });

    var cur = { theta: 0.5, phi: 1.25, radius: 0.7, tx: 0, ty: 0.04, tz: 0, roll: 0 }, goal = {};
    KEYS.forEach(function (k) { goal[k] = cur[k]; });
    var ghost = 0, ghostGoal = 0, anyHi = false, t0 = 0, last = 0;
    var autoRotate = !!opt.autoRotate && !RM, speed = (opt.speed || 12) * D;
    var dirty = true, visible = false, raf = 0, ready = false, lost = false;
    var W = 0, H = 0, P = null, PV = null, eye = [0, 0, 1];
    var spots = [];
    var fov = (opt.fov || 30) * D, expo = opt.exposure || 1, offX = 0, offY = 0;

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return false;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      if (w !== W || h !== H) { W = w; H = h; if (opt.onLayout) opt.onLayout(api, w / h, w, h); dirty = true; }
      return true;
    }

    function drawMesh(m, g) {
      var mt = m.mat;
      gl.uniform3fv(U.uCol, mt.c); gl.uniform3fv(U.uEmis, mt.e);
      gl.uniform1f(U.uMetal, mt.me); gl.uniform1f(U.uRough, mt.ro); gl.uniform1f(U.uCoat, mt.cc || 0);
      gl.uniform1f(U.uGhost, g);
      var h = 0;
      if (m.hi) h = RM ? 0.8 : 0.55 + 0.45 * Math.sin((last - t0) / 260);
      else if (m.motor && ghost > 0.02 && !anyHi) h = 0.5 * ghost;
      gl.uniform3f(U.uHi, 1.0 * h, 0.3 * h, 0.2 * h);
      gl.vertexAttribPointer(aPos, 3, gl.UNSIGNED_SHORT, true, 12, m.v * 12);
      gl.vertexAttribPointer(aNor, 3, gl.BYTE, true, 12, m.v * 12 + 8);
      gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, m.i * 2);
    }

    function draw() {
      var sp = Math.sin(cur.phi), t = [cur.tx, cur.ty, cur.tz];
      eye = [t[0] + cur.radius * sp * Math.sin(cur.theta), t[1] + cur.radius * Math.cos(cur.phi), t[2] + cur.radius * sp * Math.cos(cur.theta)];
      var V = mul(rotZ(cur.roll), lookAt(eye, t));
      P = persp(fov, W / H, Math.max(0.01, cur.radius * 0.1), cur.radius + 3);
      P[8] = -offX; P[9] = -offY;
      PV = mul(P, V);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.uniformMatrix4fv(U.uMV, false, V); gl.uniformMatrix4fv(U.uP, false, P); gl.uniform1f(U.uExpo, expo);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      var g = ghost, i, m;
      for (i = 0; i < meshes.length; i++) { m = meshes[i]; if (m.shell && g > 0.01) continue; if (m.int && g <= 0.01) continue; drawMesh(m, 0); }
      if (g > 0.01) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        for (i = 0; i < meshes.length; i++) { m = meshes[i]; if (m.shell) drawMesh(m, g); }
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      placeSpots();
      if (!ready) { ready = true; host.classList.add('ready'); if (opt.onReady) opt.onReady(api); }
    }

    function project(p) {
      var x = PV[0] * p[0] + PV[4] * p[1] + PV[8] * p[2] + PV[12], y = PV[1] * p[0] + PV[5] * p[1] + PV[9] * p[2] + PV[13], w = PV[3] * p[0] + PV[7] * p[1] + PV[11] * p[2] + PV[15];
      return [(x / w + 1) / 2 * W, (1 - y / w) / 2 * H, w];
    }
    function placeSpots() {
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], q = project(s.p);
        if (!isFinite(q[0]) || !isFinite(q[1])) continue;
        s.el.style.left = q[0].toFixed(1) + 'px'; s.el.style.top = q[1].toFixed(1) + 'px';
        var f = (eye[0] - s.p[0]) * s.n[0] + (eye[1] - s.p[1]) * s.n[1] + (eye[2] - s.p[2]) * s.n[2];
        if (f > 0 && q[2] > 0) s.el.setAttribute('data-visible', ''); else s.el.removeAttribute('data-visible');
      }
    }

    function frame(now) {
      raf = 0;
      if (lost || !visible) return;
      if (!resize()) return;
      var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      var moving = false, k = 1 - Math.exp(-dt * 7);
      if (autoRotate && !drag.on) { goal.theta += speed * dt; moving = true; }
      KEYS.forEach(function (key) {
        var d = goal[key] - cur[key];
        if (Math.abs(d) > 1e-4) { cur[key] += RM ? d : d * k; moving = true; } else cur[key] = goal[key];
      });
      var dg = ghostGoal - ghost;
      if (Math.abs(dg) > 0.004) { ghost += RM ? dg : dg * (1 - Math.exp(-dt * 5)); moving = true; } else ghost = ghostGoal;
      if (anyHi && !RM) moving = true;
      if (moving || dirty) { dirty = false; try { draw(); } catch (e) { if (window.console) console.error(e); if (opt.onError) opt.onError(e); return; } }
      if (moving) kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function touch() { dirty = true; kick(); }

    /* ---------- interação ---------- */
    var drag = { on: false }, pts = {}, active = false, coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    function clampGoal() {
      goal.phi = Math.min(Math.PI - 0.12, Math.max(0.12, goal.phi));
      goal.radius = Math.min(opt.maxRadius || 2.6, Math.max(opt.minRadius || 0.14, goal.radius));
    }
    if (opt.interactive !== false && !(opt.noTouch && coarse)) {
      canvas.style.touchAction = opt.touchAction || 'pan-y';
      canvas.style.cursor = 'grab';
      canvas.addEventListener('pointerdown', function (e) {
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        drag.on = true; active = true; canvas.style.cursor = 'grabbing';
        if (opt.stopOnTouch !== false) autoRotate = false;
        if (opt.onInteract) opt.onInteract();
        drag.pinch = 0;
      });
      canvas.addEventListener('pointermove', function (e) {
        var p = pts[e.pointerId]; if (!p) return;
        var ids = Object.keys(pts);
        if (ids.length >= 2 && opt.zoom) {
          p.x = e.clientX; p.y = e.clientY;
          var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (drag.pinch) { goal.radius *= drag.pinch / Math.max(d, 1); clampGoal(); }
          drag.pinch = d; touch(); return;
        }
        var dx = e.clientX - p.x, dy = -(e.clientY - p.y); p.x = e.clientX; p.y = e.clientY;
        var c = Math.cos(cur.roll), s = Math.sin(cur.roll), sx = c * dx + s * dy, sy = -s * dx + c * dy, K = 0.008;
        goal.theta -= sx * K; goal.phi += sy * K; clampGoal();
        cur.theta += (goal.theta - cur.theta) * 0.6; cur.phi += (goal.phi - cur.phi) * 0.6;
        touch();
      });
      var up = function (e) { delete pts[e.pointerId]; drag.pinch = 0; if (!Object.keys(pts).length) { drag.on = false; canvas.style.cursor = 'grab'; } };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('pointerleave', function () { if (!drag.on) active = false; });
      if (opt.zoom) canvas.addEventListener('wheel', function (e) {
        if (!(active || e.ctrlKey || e.metaKey)) return;
        e.preventDefault(); autoRotate = false;
        goal.radius *= Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0022); clampGoal(); touch();
      }, { passive: false });
    }

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', function () { try { initGL(); lost = false; touch(); } catch (e) {} });

    if (window.ResizeObserver) new ResizeObserver(function () { if (resize()) touch(); }).observe(host);
    else window.addEventListener('resize', touch);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) touch(); }, { rootMargin: '120px' }).observe(host);
    else visible = true;

    var api = {
      setView: function (v, now) {
        for (var k in v) if (k in goal) {
          var val = v[k];
          if (k === 'theta') { var d = val - goal.theta; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; val = goal.theta + d; }
          goal[k] = val; if (now) cur[k] = val;
        }
        if (v.target) { goal.tx = v.target[0]; goal.ty = v.target[1]; goal.tz = v.target[2]; if (now) { cur.tx = goal.tx; cur.ty = goal.ty; cur.tz = goal.tz; } }
        clampGoal(); touch();
      },
      nudge: function (dth, dph, zoom) { autoRotate = false; goal.theta += dth * D; goal.phi += dph * D; goal.radius *= zoom || 1; clampGoal(); touch(); },
      setGhost: function (on, now) { ghostGoal = on ? 1 : 0; if (now) ghost = ghostGoal; touch(); },
      highlight: function (prefixes) {
        anyHi = false; t0 = last;
        meshes.forEach(function (m) { m.hi = !!prefixes && prefixes.some(function (p) { return m.name.indexOf(p) === 0; }); if (m.hi) anyHi = true; });
        touch();
      },
      setOffset: function (x, y) { offX = x; offY = y; touch(); },
      setAutoRotate: function (on) { autoRotate = !!on && !RM; touch(); },
      addHotspot: function (el, p, n) { var l = Math.hypot(n[0], n[1], n[2]) || 1; spots.push({ el: el, p: p, n: [n[0] / l, n[1] / l, n[2] / l] }); touch(); },
      render: function () { visible = true; if (resize()) { dirty = false; draw(); } },
      canvas: canvas, state: cur, goal: goal
    };
    kick();
    return api;
  }

  window.RumoViewer = { create: create, supported: function () { return !!window.RUMO_MODEL_B64 || !!MODEL; } };
})();

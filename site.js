/* SenseLab — navegação, preferências de leitura, demonstração háptica e explorador 3D */
(function () {
  'use strict';
  var root = document.documentElement, D = Math.PI / 180;
  function $(id) { return document.getElementById(id); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- preferências de leitura ---------- */
  var bs = $('btn-size'), bt = $('btn-theme'), bm = $('btn-menu'), nav = $('nav');
  function setSize(on) {
    if (on) root.setAttribute('data-size', 'large'); else root.removeAttribute('data-size');
    bs.setAttribute('aria-pressed', on ? 'true' : 'false'); bs.setAttribute('aria-label', on ? 'Reduzir o texto' : 'Aumentar o texto'); store('sl-size', on ? '1' : '0');
  }
  function isDark() { var t = root.getAttribute('data-theme'); if (t) return t === 'dark'; return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function syncTheme() { var d = isDark(); bt.setAttribute('aria-pressed', d ? 'true' : 'false'); bt.setAttribute('aria-label', d ? 'Mudar para tema claro' : 'Mudar para tema escuro'); }
  bs.addEventListener('click', function () { setSize(bs.getAttribute('aria-pressed') !== 'true'); });
  bt.addEventListener('click', function () { var n = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', n); store('sl-theme', n); syncTheme(); });
  if (load('sl-size') === '1') setSize(true);
  var th = load('sl-theme'); if (th && !root.getAttribute('data-theme')) root.setAttribute('data-theme', th);
  syncTheme();
  function menu(open) { nav.classList.toggle('open', open); bm.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  bm.addEventListener('click', function () { menu(!nav.classList.contains('open')); });

  /* ---------- rotas ---------- */
  var VIEWS = ['inicio', 'rumo', 'como-funciona', 'app', 'sobre', 'suporte', 'politicas'];
  var POLS = ['privacidade', 'termos', 'garantia', 'seguranca', 'acessibilidade', 'cookies'];
  var TITLES = { inicio: 'SenseLab · RUMO Smart Cane', rumo: 'RUMO Smart Cane · SenseLab', 'como-funciona': 'Como funciona · SenseLab', app: 'App e cuidadores · SenseLab', sobre: 'Sobre nós · SenseLab', suporte: 'Suporte · SenseLab', politicas: 'Políticas · SenseLab' };
  var first = true, current = null;
  function route() {
    var h = (location.hash || '').replace('#', '') || 'inicio';
    var pol = POLS.indexOf(h) > -1 ? h : null;
    var v = pol ? 'politicas' : (VIEWS.indexOf(h) > -1 ? h : 'inicio');
    var els = document.querySelectorAll('.view'), i;
    for (i = 0; i < els.length; i++) els[i].classList.toggle('on', els[i].getAttribute('data-view') === v);
    var links = document.querySelectorAll('[data-nav]');
    for (i = 0; i < links.length; i++) { if (links[i].getAttribute('data-nav') === v) links[i].setAttribute('aria-current', 'page'); else links[i].removeAttribute('aria-current'); }
    var pl = document.querySelectorAll('[data-pol]');
    for (i = 0; i < pl.length; i++) pl[i].classList.toggle('cur', pl[i].getAttribute('data-pol') === pol);
    document.title = TITLES[v];
    menu(false);
    if (pol) { var t = $(pol); if (t) t.scrollIntoView(); }
    else if (!first || v !== 'inicio') window.scrollTo(0, 0);
    if (!first && v !== current) { try { $('conteudo').focus({ preventScroll: true }); } catch (e) {} }
    first = false; current = v;
    if (v === 'rumo') initExplorer();
  }
  window.addEventListener('hashchange', route);

  /* ---------- demonstração háptica ---------- */
  (function () {
    var f = $('d-front'), t = $('d-top'), h = $('d-head'); if (!f) return;
    var mf = $('m-front'), mt = $('m-top'), ml = $('m-left'), mr = $('m-right'), out = $('readout');
    function rate(d, a, b, c, e) { return d > a ? 0 : d > b ? 1 : d > c ? 2.5 : d > e ? 5 : -1; }
    function m(cm) { return (cm / 100).toFixed(2).replace('.', ',') + ' m'; }
    function txt(r) { return r === 0 ? 'sem vibração' : r === -1 ? 'vibração contínua' : r === 1 ? '1 pulso por segundo' : r === 2.5 ? '2 a 3 pulsos por segundo' : '5 pulsos por segundo'; }
    function set(el, r, delay) {
      el.classList.toggle('solid', r === -1); el.classList.toggle('on', r > 0);
      if (r > 0) { el.style.setProperty('--rate', (1 / r) + 's'); el.style.setProperty('--delay', (delay || 0) + 's'); }
    }
    function update() {
      var df = +f.value, dt = +t.value, dh = +h.value;
      var rf = rate(df, 250, 150, 80, 40), rt = rate(dt, 150, 100, 60, 30);
      $('o-front').textContent = m(df); $('o-top').textContent = m(dt);
      $('o-head').textContent = dh === 0 ? 'no rumo' : Math.abs(dh) + '° para a ' + (dh > 0 ? 'direita' : 'esquerda');
      set(mf, rf, 0); set(mt, rt, rf > 0 && rt > 0 ? 0.1 : 0);
      var dev = Math.abs(dh) >= 5;
      set(ml, dev && dh > 0 ? 1.5 : 0, 0); set(mr, dev && dh < 0 ? 1.5 : 0, 0);
      out.textContent = 'Frente: ' + txt(rf) + '. Cima: ' + txt(rt) + '. Rumo: ' + (dev ? 'virar para a ' + (dh > 0 ? 'esquerda' : 'direita') : 'alinhado') + '.';
    }
    [f, t, h].forEach(function (el) { el.addEventListener('input', update); });
    update();
  })();

  /* ---------- 3D ---------- */
  var HOME_T = [0, 0.049, 0.008];
  function initHero() {
    var host = $('hero3d'); if (!host || !window.RumoViewer) return;
    RumoViewer.create(host, {
      fov: 26, exposure: 1.08, autoRotate: true, speed: 16, noTouch: true, touchAction: 'pan-y', stopOnTouch: false,
      onLayout: function (v, asp, w) {
        var wide = w > 560;
        v.setOffset(wide ? 0.16 : 0.1, wide ? 0.04 : 0.02);
        v.setView({ phi: 80 * D, radius: wide ? 0.9 : 0.86, target: [0, 0.03, 0.006], roll: 50 * D }, true);
      }
    });
  }

  var PARTS = [
    { g: 'ext', hi: ['A02YYUW_frontal'], p: [0, -0.095, 0.037], n: [0, -0.6, 0.8], o: [8, 104, 0.3], k: 'Deteção', t: 'Sensor frontal', d: 'Ultrassónico à prova de água, apontado em frente. Deteta obstáculos de 20 cm a 4,5 m e faz vibrar o motor do dedo indicador.' },
    { g: 'ext', hi: ['A02YYUW_cima'], p: [0, -0.03, 0.041], n: [0, 0, 1], o: [10, 66, 0.3], k: 'Deteção', t: 'Sensor de cabeça', d: 'Segundo ultrassónico, inclinado para cima, para ramos, placas e outros obstáculos entre a cintura e a cabeça. Avisa pelo motor do polegar.' },
    { g: 'ext', hi: ['Botao_'], p: [0, 0.02, 0.021], n: [0, 0, 1], o: [14, 70, 0.24], k: 'Controlo', t: 'Botão', d: 'O único botão, à prova de água, debaixo do polegar. Bateria, descrição do ambiente, bloqueio de rumo e SOS, conforme o gesto.' },
    { g: 'ext', hi: ['LED_estado'], p: [0, 0.115, 0.0165], n: [0, 0, 1], o: [10, 70, 0.22], k: 'Estado', t: 'Luz de estado', d: 'Mostra a carga e a ligação ao telemóvel a quem acompanha o utilizador.' },
    { g: 'ext', hi: ['USB-C_'], p: [0, 0.2065, 0], n: [0, 1, 0.2], o: [30, 30, 0.24], k: 'Energia', t: 'Entrada USB-C', d: 'Carregamento por cabo, na ponta da pega, protegido por uma tampa de borracha.' },
    { g: 'int', hi: ['Celula_'], p: [0, 0.142, 0.0095], n: [0, 0, 1], o: [20, 74, 0.3], k: 'Energia', t: 'Bateria', d: 'Célula de iões de lítio de 3350 mAh, em invólucro metálico rígido. Fica ao longo do eixo, junto à mão, para a pega não pesar no pulso.' },
    { g: 'int', hi: ['Bobina_', 'Recetor_'], p: [0, 0.173, -0.016], n: [0, 0, -1], o: [160, 80, 0.3], k: 'Energia', t: 'Bobina de carregamento', d: 'Recebe energia por indução quando a pega é pousada na base. Sem fichas para acertar.' },
    { g: 'int', hi: ['ESP32-S3_'], p: [-0.0165, -0.04, 0.004], n: [-1, 0, 0.2], o: [-70, 80, 0.28], k: 'Eletrónica', t: 'Processador', d: 'O cérebro da bengala. Lê os sensores dez vezes por segundo, comanda os motores e liga-se ao telemóvel por Bluetooth encriptado.' },
    { g: 'int', hi: ['BNO085_'], p: [0.015, -0.066, 0.004], n: [1, 0, 0.2], o: [70, 84, 0.26], k: 'Eletrónica', t: 'Sensor de movimento', d: 'Acelerómetro, giroscópio e bússola num só componente. Dá a direção ao bloqueio de rumo e percebe quando a bengala cai.' },
    { g: 'int', hi: ['Buzzer'], p: [0, -0.015, -0.0105], n: [0, 0, -1], o: [170, 84, 0.26], k: 'Eletrónica', t: 'Sinal sonoro', d: 'Ajuda a encontrar a bengala caída e funciona como sirene de emergência.' },
    { g: 'int', hi: ['Motor_frente'], p: [-0.011, 0.009, 0.0155], n: [0, 0, 1], o: [-16, 74, 0.24], k: 'Vibração', t: 'Motor da frente', d: 'Junto ao dedo indicador. Vibra mais depressa à medida que um obstáculo à frente se aproxima.' },
    { g: 'int', hi: ['Motor_cima'], p: [0, 0.06, 0.016], n: [0, 0, 1], o: [10, 66, 0.24], k: 'Vibração', t: 'Motor de cima', d: 'Debaixo do polegar. Avisa de obstáculos à altura da cabeça.' },
    { g: 'int', hi: ['Motor_esquerdo'], p: [-0.0172, 0.065, 0], n: [-1, 0, 0], o: [-80, 80, 0.24], k: 'Vibração', t: 'Motor esquerdo', d: 'Na palma da mão. Pede uma correção para a esquerda quando se desvia do rumo fixado.' },
    { g: 'int', hi: ['Motor_direito'], p: [0.0178, 0.05, -0.007], n: [1, 0, 0], o: [80, 80, 0.24], k: 'Vibração', t: 'Motor direito', d: 'Sob as pontas dos dedos. Pede uma correção para a direita.' }
  ];
  var explorer = null;
  function initExplorer() {
    if (explorer || !window.RumoViewer) return;
    var host = $('mv'), wrap = $('viewer'), layer = $('hs-layer'), list = $('parts');
    var mode = 'ext', asp = 1.4, selected = null;
    function homeView() { return { theta: 24 * D, phi: 70 * D, target: HOME_T, radius: asp > 1.15 ? Math.min(0.9, Math.max(0.5, 0.21 / (0.268 * asp))) : 0.8 }; }
    function fullView() { return { theta: 24 * D, phi: 76 * D, target: [0, -0.26, 0], radius: asp > 1.15 ? Math.min(2.5, 0.52 / (0.268 * asp)) : 1.95 }; }
    var V = RumoViewer.create(host, {
      fov: 30, exposure: 1.05, zoom: true, autoRotate: true, speed: 9, touchAction: 'pan-y',
      onLayout: function (v, a) {
        var was = asp > 1.15; asp = a; var now = a > 1.15;
        v.setView({ roll: now ? -90 * D : 0 }, true);
        if (!selected || was !== now) v.setView(mode === 'full' ? fullView() : homeView(), true);
      },
      onError: function () { host.classList.add('nogl'); }
    });
    explorer = V || true;
    if (!V) return;
    var bE = $('mode-ext'), bI = $('mode-int'), bF = $('mode-full');
    function setMode(m, keepCam) {
      mode = m;
      V.setGhost(m === 'int'); wrap.classList.toggle('xray', m === 'int'); wrap.classList.toggle('full', m === 'full');
      bE.setAttribute('aria-pressed', m === 'ext' ? 'true' : 'false'); bI.setAttribute('aria-pressed', m === 'int' ? 'true' : 'false'); bF.setAttribute('aria-pressed', m === 'full' ? 'true' : 'false');
      if (keepCam) return;
      clearSel(); V.setView(m === 'full' ? fullView() : homeView());
    }
    function clearSel() {
      selected = null; V.highlight(null);
      PARTS.forEach(function (q) { q.hs.classList.remove('active'); q.li.setAttribute('aria-current', 'false'); });
    }
    function select(p) {
      setMode(p.g, true); selected = p;
      PARTS.forEach(function (q) { q.hs.classList.toggle('active', q === p); q.li.setAttribute('aria-current', q === p ? 'true' : 'false'); });
      $('part-k').textContent = p.k; $('part-t').textContent = p.t; $('part-d').textContent = p.d;
      V.setAutoRotate(false); V.highlight(p.hi);
      V.setView({ theta: p.o[0] * D, phi: p.o[1] * D, radius: p.o[2] * (asp > 1.15 ? 1.3 : 1.5), target: p.p });
    }
    var num = 0;
    [['ext', 'Exterior'], ['int', 'Interior']].forEach(function (grp) {
      var gh = document.createElement('li'); gh.className = 'grp'; gh.textContent = grp[1]; gh.setAttribute('aria-hidden', 'true'); list.appendChild(gh);
      PARTS.filter(function (p) { return p.g === grp[0]; }).forEach(function (p) {
        num++;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'hs ' + p.g; b.textContent = num; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
        b.addEventListener('click', function () { select(p); }); layer.appendChild(b); V.addHotspot(b, p.p, p.n); p.hs = b;
        var li = document.createElement('li'), lb = document.createElement('button'); lb.type = 'button';
        var n = document.createElement('span'); n.className = 'n ' + p.g; n.setAttribute('aria-hidden', 'true'); n.textContent = num;
        lb.appendChild(n); lb.appendChild(document.createTextNode(p.t)); lb.setAttribute('aria-current', 'false');
        lb.addEventListener('click', function () { select(p); }); li.appendChild(lb); list.appendChild(li); p.li = lb;
      });
    });
    bE.addEventListener('click', function () { setMode('ext'); });
    bI.addEventListener('click', function () { setMode('int'); });
    bF.addEventListener('click', function () { setMode('full'); });
    function nb(id, a, z) { $(id).addEventListener('click', function () { V.nudge(a, 0, z); }); }
    nb('cam-left', -40, 1); nb('cam-right', 40, 1); nb('cam-in', 0, 0.72); nb('cam-out', 0, 1.39);
    window.__explorer = { V: V, select: select, setMode: setMode, parts: PARTS };
  }

  function start() { try { initHero(); } catch (e) { if (window.console) console.error(e); } route(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

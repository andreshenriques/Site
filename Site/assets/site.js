/* SenseLab — navegação, preferências de leitura, demonstração háptica, explorador 3D e contacto (PT / EN) */
(function () {
  'use strict';
  var root = document.documentElement, D = Math.PI / 180;
  var EN = (root.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0;
  function L(pt, en) { return EN ? en : pt; }
  function $(id) { return document.getElementById(id); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- preferências de leitura ---------- */
  var bs = $('btn-size'), bt = $('btn-theme'), bm = $('btn-menu'), nav = $('nav'), lang = $('lang');
  function setSize(on) {
    if (on) root.setAttribute('data-size', 'large'); else root.removeAttribute('data-size');
    bs.setAttribute('aria-pressed', on ? 'true' : 'false');
    bs.setAttribute('aria-label', on ? L('Reduzir o texto', 'Make text smaller') : L('Aumentar o texto', 'Make text larger'));
    store('sl-size', on ? '1' : '0');
  }
  function isDark() { var t = root.getAttribute('data-theme'); if (t) return t === 'dark'; return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function syncTheme() {
    var d = isDark(); bt.setAttribute('aria-pressed', d ? 'true' : 'false');
    bt.setAttribute('aria-label', d ? L('Mudar para tema claro', 'Switch to light theme') : L('Mudar para tema escuro', 'Switch to dark theme'));
  }
  bs.addEventListener('click', function () { setSize(bs.getAttribute('aria-pressed') !== 'true'); });
  bt.addEventListener('click', function () { var n = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', n); store('sl-theme', n); syncTheme(); });
  if (load('sl-size') === '1') setSize(true);
  var th = load('sl-theme'); if (th && !root.getAttribute('data-theme')) root.setAttribute('data-theme', th);
  syncTheme();
  function menu(open) { nav.classList.toggle('open', open); bm.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  bm.addEventListener('click', function () { menu(!nav.classList.contains('open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { menu(false); bm.focus(); } });

  /* ---------- rotas ---------- */
  var VIEWS = ['inicio', 'rumo', 'como-funciona', 'app', 'sobre', 'suporte', 'politicas'];
  var POLS = ['privacidade', 'termos', 'garantia', 'seguranca', 'acessibilidade', 'cookies'];
  var TITLES = EN
    ? { inicio: 'SenseLab · RUMO Smart Cane', rumo: 'RUMO Smart Cane · SenseLab', 'como-funciona': 'How it works · SenseLab', app: 'App and carers · SenseLab', sobre: 'About us · SenseLab', suporte: 'Support · SenseLab', politicas: 'Policies · SenseLab' }
    : { inicio: 'SenseLab · RUMO Smart Cane', rumo: 'RUMO Smart Cane · SenseLab', 'como-funciona': 'Como funciona · SenseLab', app: 'App e cuidadores · SenseLab', sobre: 'Sobre nós · SenseLab', suporte: 'Suporte · SenseLab', politicas: 'Políticas · SenseLab' };
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
    if (lang) lang.setAttribute('href', lang.getAttribute('data-base') + (location.hash || ''));
    menu(false);
    if (pol) { var t = $(pol); if (t) t.scrollIntoView(); }
    else if (!first || v !== 'inicio') window.scrollTo(0, 0);
    if (!first && v !== current) { try { $('conteudo').focus({ preventScroll: true }); } catch (e) {} }
    first = false; current = v;
    if (v === 'rumo') initExplorer();
  }
  if (lang) lang.setAttribute('data-base', lang.getAttribute('href'));
  window.addEventListener('hashchange', route);

  /* ---------- demonstração háptica ---------- */
  (function () {
    var f = $('d-front'), t = $('d-top'), h = $('d-head'); if (!f) return;
    var mf = $('m-front'), mt = $('m-top'), ml = $('m-left'), mr = $('m-right'), out = $('readout');
    function rate(d, a, b, c, e) { return d > a ? 0 : d > b ? 1 : d > c ? 2.5 : d > e ? 5 : -1; }
    function m(cm) { var x = (cm / 100).toFixed(2); return (EN ? x : x.replace('.', ',')) + ' m'; }
    function txt(r) {
      return r === 0 ? L('sem vibração', 'no vibration') : r === -1 ? L('vibração contínua', 'continuous vibration') : r === 1 ? L('1 pulso por segundo', '1 pulse per second')
        : r === 2.5 ? L('2 a 3 pulsos por segundo', '2 to 3 pulses per second') : L('5 pulsos por segundo', '5 pulses per second');
    }
    function side(right) { return right ? L('direita', 'right') : L('esquerda', 'left'); }
    function set(el, r, delay) {
      el.classList.toggle('solid', r === -1); el.classList.toggle('on', r > 0);
      if (r > 0) { el.style.setProperty('--rate', (1 / r) + 's'); el.style.setProperty('--delay', (delay || 0) + 's'); }
    }
    function update() {
      var df = +f.value, dt = +t.value, dh = +h.value;
      var rf = rate(df, 250, 150, 80, 40), rt = rate(dt, 150, 100, 60, 30);
      $('o-front').textContent = m(df); $('o-top').textContent = m(dt);
      $('o-head').textContent = dh === 0 ? L('no rumo', 'on course') : Math.abs(dh) + '° ' + L('para a ', 'to the ') + side(dh > 0);
      set(mf, rf, 0); set(mt, rt, rf > 0 && rt > 0 ? 0.1 : 0);
      var dev = Math.abs(dh) >= 5;
      set(ml, dev && dh > 0 ? 1.5 : 0, 0); set(mr, dev && dh < 0 ? 1.5 : 0, 0);
      out.textContent = L('Frente: ', 'Ahead: ') + txt(rf) + L('. Cima: ', '. Overhead: ') + txt(rt) + L('. Rumo: ', '. Heading: ')
        + (dev ? L('virar para a ', 'turn ') + side(dh < 0) : L('alinhado', 'aligned')) + '.';
    }
    [f, t, h].forEach(function (el) { el.addEventListener('input', update); });
    update();
  })();

  /* ---------- formulário de contacto ---------- */
  (function () {
    var form = $('contact-form'); if (!form) return;
    var st = $('f-status'), to = form.getAttribute('data-to');
    var F = { name: $('f-name'), email: $('f-email'), msg: $('f-msg'), ok: $('f-ok') };
    function err(el, id, text) { $(id).textContent = text || ''; el.setAttribute('aria-invalid', text ? 'true' : 'false'); return !text; }
    function check() {
      var good = true, firstBad = null;
      function ck(el, id, text) { if (!err(el, id, text)) { good = false; if (!firstBad) firstBad = el; } }
      ck(F.name, 'e-name', F.name.value.trim() ? '' : L('Escreva o seu nome.', 'Please enter your name.'));
      var em = F.email.value.trim();
      ck(F.email, 'e-email', !em ? L('Escreva o seu email.', 'Please enter your email.') : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? L('Este email não parece completo. Exemplo: nome@exemplo.pt', 'This email does not look complete. Example: name@example.com') : '');
      ck(F.msg, 'e-msg', F.msg.value.trim().length < 10 ? L('Escreva uma mensagem com pelo menos 10 caracteres.', 'Please write a message of at least 10 characters.') : '');
      ck(F.ok, 'e-ok', F.ok.checked ? '' : L('Para continuar, aceite o uso dos dados para resposta.', 'To continue, please agree to us using your details to reply.'));
      return { good: good, first: firstBad };
    }
    [F.name, F.email, F.msg].forEach(function (el) { el.addEventListener('blur', function () { if (el.getAttribute('aria-invalid') === 'true') check(); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = check();
      if (!r.good) { st.innerHTML = ''; r.first.focus(); return; }
      var who = $('f-who').value, topic = $('f-topic').value;
      var subject = 'RUMO · ' + topic;
      var body = F.msg.value.trim() + '\n\n— \n' + F.name.value.trim() + '\n' + F.email.value.trim() + '\n' + L('Perfil: ', 'Profile: ') + who;
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      st.innerHTML = '';
      var b = document.createElement('b'); b.textContent = L('O seu programa de email deve abrir agora.', 'Your email app should open now.');
      var p = document.createElement('span');
      p.appendChild(document.createTextNode(L('Confirme e carregue em enviar. Se nada abrir, escreva diretamente para ', 'Check it and press send. If nothing opens, write to us directly at ')));
      var a = document.createElement('a'); a.href = href; a.textContent = to; p.appendChild(a); p.appendChild(document.createTextNode('.'));
      st.appendChild(b); st.appendChild(p);
      window.location.href = href;
    });
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
    { g: 'ext', hi: ['A02YYUW_frontal'], p: [0, -0.095, 0.037], n: [0, -0.6, 0.8], o: [8, 104, 0.3],
      k: L('Deteção', 'Detection'), t: L('Sensor frontal', 'Front sensor'),
      d: L('Ultrassónico à prova de água, apontado em frente. Deteta obstáculos de 20 cm a 4,5 m e faz vibrar o motor do dedo indicador.', 'Waterproof ultrasonic sensor pointing straight ahead. It detects obstacles from 20 cm to 4.5 m and drives the index-finger motor.') },
    { g: 'ext', hi: ['A02YYUW_cima'], p: [0, -0.03, 0.041], n: [0, 0, 1], o: [10, 66, 0.3],
      k: L('Deteção', 'Detection'), t: L('Sensor de cabeça', 'Head-height sensor'),
      d: L('Segundo ultrassónico, inclinado para cima, para ramos, placas e outros obstáculos entre a cintura e a cabeça. Avisa pelo motor do polegar.', 'A second ultrasonic sensor, tilted upwards, for branches, signs and other obstacles between waist and head. It warns through the thumb motor.') },
    { g: 'ext', hi: ['Botao_'], p: [0, 0.02, 0.021], n: [0, 0, 1], o: [14, 70, 0.24],
      k: L('Controlo', 'Control'), t: L('Botão', 'Button'),
      d: L('O único botão, à prova de água, debaixo do polegar. Bateria, descrição do ambiente, bloqueio de rumo e SOS, conforme o gesto.', 'The only button, waterproof, under the thumb. Battery level, scene description, heading lock and SOS, depending on the gesture.') },
    { g: 'ext', hi: ['LED_estado'], p: [0, 0.115, 0.0165], n: [0, 0, 1], o: [10, 70, 0.22],
      k: L('Estado', 'Status'), t: L('Luz de estado', 'Status light'),
      d: L('Mostra a carga e a ligação ao telemóvel a quem acompanha o utilizador.', 'Shows the charge level and phone connection to whoever is with the user.') },
    { g: 'ext', hi: ['USB-C_'], p: [0, 0.2065, 0], n: [0, 1, 0.2], o: [30, 30, 0.24],
      k: L('Energia', 'Power'), t: L('Entrada USB-C', 'USB-C port'),
      d: L('Carregamento por cabo, na ponta da pega, protegido por uma tampa de borracha.', 'Cable charging at the end of the handle, protected by a rubber cap.') },
    { g: 'int', hi: ['Celula_'], p: [0, 0.142, 0.0095], n: [0, 0, 1], o: [20, 74, 0.3],
      k: L('Energia', 'Power'), t: L('Bateria', 'Battery'),
      d: L('Célula de iões de lítio de 3350 mAh, em invólucro metálico rígido. Fica ao longo do eixo, junto à mão, para a pega não pesar no pulso.', '3350 mAh lithium-ion cell in a rigid metal case. It sits along the axis, close to the hand, so the handle does not strain the wrist.') },
    { g: 'int', hi: ['Bobina_', 'Recetor_'], p: [0, 0.173, -0.016], n: [0, 0, -1], o: [160, 80, 0.3],
      k: L('Energia', 'Power'), t: L('Bobina de carregamento', 'Charging coil'),
      d: L('Recebe energia por indução quando a pega é pousada na base. Sem fichas para acertar.', 'Receives power by induction when the handle rests on the base. No plugs to line up.') },
    { g: 'int', hi: ['ESP32-S3_'], p: [-0.0165, -0.04, 0.004], n: [-1, 0, 0.2], o: [-70, 80, 0.28],
      k: L('Eletrónica', 'Electronics'), t: L('Processador', 'Processor'),
      d: L('O cérebro da bengala. Lê os sensores dez vezes por segundo, comanda os motores e liga-se ao telemóvel por Bluetooth encriptado.', 'The brain of the cane. It reads the sensors ten times a second, drives the motors and connects to the phone over encrypted Bluetooth.') },
    { g: 'int', hi: ['BNO085_'], p: [0.015, -0.066, 0.004], n: [1, 0, 0.2], o: [70, 84, 0.26],
      k: L('Eletrónica', 'Electronics'), t: L('Sensor de movimento', 'Motion sensor'),
      d: L('Acelerómetro, giroscópio e bússola num só componente. Dá a direção ao bloqueio de rumo e percebe quando a bengala cai.', 'Accelerometer, gyroscope and compass in one part. It gives the heading lock its direction and notices when the cane falls.') },
    { g: 'int', hi: ['Buzzer'], p: [0, -0.015, -0.0105], n: [0, 0, -1], o: [170, 84, 0.26],
      k: L('Eletrónica', 'Electronics'), t: L('Sinal sonoro', 'Buzzer'),
      d: L('Ajuda a encontrar a bengala caída e funciona como sirene de emergência.', 'Helps you find a dropped cane and doubles as an emergency siren.') },
    { g: 'int', hi: ['Motor_frente'], p: [-0.011, 0.009, 0.0155], n: [0, 0, 1], o: [-16, 74, 0.24],
      k: L('Vibração', 'Vibration'), t: L('Motor da frente', 'Front motor'),
      d: L('Junto ao dedo indicador. Vibra mais depressa à medida que um obstáculo à frente se aproxima.', 'By the index finger. It vibrates faster as an obstacle ahead gets closer.') },
    { g: 'int', hi: ['Motor_cima'], p: [0, 0.06, 0.016], n: [0, 0, 1], o: [10, 66, 0.24],
      k: L('Vibração', 'Vibration'), t: L('Motor de cima', 'Top motor'),
      d: L('Debaixo do polegar. Avisa de obstáculos à altura da cabeça.', 'Under the thumb. It warns of obstacles at head height.') },
    { g: 'int', hi: ['Motor_esquerdo'], p: [-0.0172, 0.065, 0], n: [-1, 0, 0], o: [-80, 80, 0.24],
      k: L('Vibração', 'Vibration'), t: L('Motor esquerdo', 'Left motor'),
      d: L('Na palma da mão. Pede uma correção para a esquerda quando se desvia do rumo fixado.', 'In the palm. It asks you to correct to the left when you drift off the locked heading.') },
    { g: 'int', hi: ['Motor_direito'], p: [0.0178, 0.05, -0.007], n: [1, 0, 0], o: [80, 80, 0.24],
      k: L('Vibração', 'Vibration'), t: L('Motor direito', 'Right motor'),
      d: L('Sob as pontas dos dedos. Pede uma correção para a direita.', 'Under the fingertips. It asks you to correct to the right.') }
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
    [['ext', L('Exterior', 'Outside')], ['int', L('Interior', 'Inside')]].forEach(function (grp) {
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

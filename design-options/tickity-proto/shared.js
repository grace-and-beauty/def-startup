/* Tickity prototype: palette and font switcher (remembered across pages), demo panel, shared motion helpers. */
(function () {
  var PALS = [
    ['indigo', 'Індиго й лимон', '#0F1133', '#FFD84D'],
    ['bordo', 'Бордо й латунь', '#24090E', '#E7AE55'],
    ['emerald', 'Смарагд і корал', '#04241D', '#FF7D5C'],
    ['cobalt', 'Кобальт і рожевий', '#2130C8', '#FFB8D2'],
    ['graphite', 'Графіт і червоний (як було)', '#0E0F12', '#E5452D'],
    ['choco', 'Шоколад і м\'ята', '#24160F', '#8EE4C6'],
    ['plum', 'Слива й помаранч', '#26102F', '#FF9A3C'],
    ['ocean', 'Океан і бірюза', '#061C2E', '#35E0CF'],
    ['fog', 'Туман і ультрамарин (світла)', '#E6E9F2', '#3242F0'],
    ['sun', 'Сонце й томат (світла)', '#FFE45E', '#D2361F']
  ];
  var FONTS = [
    ['wix', 'Wix Madefor', "'Wix Madefor Display', sans-serif", 800],
    ['manrope', 'Manrope', "'Manrope', sans-serif", 800],
    ['sofia', 'Sofia Sans Condensed', "'Sofia Sans Extra Condensed', sans-serif", 900],
    ['russo', 'Russo One (як було)', "'Russo One', sans-serif", 400]
  ];
  var PAGES = [
    ['index.html', 'Головна'],
    ['pricing.html', 'Тарифи'],
    ['login.html', 'Вхід'],
    ['dashboard.html', 'Кабінет закладу'],
    ['card.html', 'Картка клієнта'],
    ['scanner.html', 'Сканер працівника']
  ];
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: choice lives for this page only */ } }
  };
  var root = document.documentElement;
  root.setAttribute('data-pal', store.get('tk-pal') || 'plum');
  root.setAttribute('data-font', store.get('tk-font') || 'wix');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- page transitions: five ticket-themed ones, taking turns ----------
     exit  = cover the current page, then navigate;
     enter = the next page starts covered (CSS, before first paint) and is revealed. */
  var PT_TYPES = ['flood', 'strips', 'dots', 'stamp', 'tear'];
  var PT_NAMES = { cycle: 'По черзі (усі різні)', flood: 'Розлив', strips: 'Смуги', dots: 'Дірочки', stamp: 'Печатка', tear: 'Відрив квитка' };
  var ss = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* no storage: next page opens without the reveal */ } },
    del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function nextType() {
    var mode = store.get('tk-pt-mode') || 'cycle';
    if (mode !== 'cycle' && PT_TYPES.indexOf(mode) >= 0) return mode;
    var last = ss.get('tk-pt-last');
    return PT_TYPES[(PT_TYPES.indexOf(last) + 1) % PT_TYPES.length];
  }
  var arrived = false, arrivedType = null;
  (function () {
    var raw = ss.get('tk-pt');
    if (!raw) return;
    ss.del('tk-pt');
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (reduce || !d || Date.now() - d.t > 5000 || PT_TYPES.indexOf(d.type) < 0) return;
    arrived = true; arrivedType = d.type;
    root.classList.add('pt-in');
  })();

  function layer(cls) {
    var o = document.createElement('div');
    o.className = 'pt-layer ' + (cls || '');
    o.setAttribute('aria-hidden', 'true');
    document.body.appendChild(o);
    return o;
  }
  function logo(o, show) {
    var l = document.createElement('span');
    l.className = 'pt-logo brand';
    l.textContent = 'Tickity';
    o.appendChild(l);
    l.animate(show ? [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }]
                   : [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.2)' }],
      { duration: show ? 300 : 260, delay: show ? 260 : 0, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'both' });
    return l;
  }
  function done(anims) { return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); })); }
  function mobile() { return window.innerWidth <= 860; }

  var EXIT = {
    flood: function (o, x, y) {
      o.classList.add('solid');
      var r = o.getBoundingClientRect(); x -= r.left; y -= r.top;
      var R = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) + 4;
      logo(o, true);
      return done([o.animate([{ clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)' }],
        { duration: 520, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' })]);
    },
    strips: function (o) {
      var n = mobile() ? 4 : 7, an = [];
      for (var i = 0; i < n; i++) {
        var s = document.createElement('i');
        s.className = 'pt-strip';
        s.style.left = (i * 100 / n) + '%'; s.style.width = 'calc(' + (100 / n) + '% + 1px)';
        o.appendChild(s);
        an.push(s.animate([{ transform: 'translateY(-101%)' }, { transform: 'none' }], { duration: 520, delay: i * 55, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' }));
      }
      logo(o, true).style.zIndex = 2;
      return done(an);
    },
    dots: function (o, x, y) {
      var r = o.getBoundingClientRect(); x -= r.left; y -= r.top;
      var cell = mobile() ? 56 : 84, size = cell * 1.5, an = [];
      var cols = Math.ceil(r.width / cell) + 1, rows = Math.ceil(r.height / cell) + 1;
      var maxD = Math.hypot(r.width, r.height);
      for (var cy = 0; cy < rows; cy++) for (var cx = 0; cx < cols; cx++) {
        var d = document.createElement('i');
        d.className = 'pt-dot';
        var px = cx * cell + cell / 2, py = cy * cell + cell / 2;
        d.style.width = d.style.height = size + 'px';
        d.style.left = (px - size / 2) + 'px'; d.style.top = (py - size / 2) + 'px';
        o.appendChild(d);
        an.push(d.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
          { duration: 300, delay: Math.hypot(px - x, py - y) / maxD * 520, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'both' }));
      }
      logo(o, true).style.zIndex = 2;
      return done(an);
    },
    stamp: function (o) {
      var r = o.getBoundingClientRect();
      var D = Math.min(window.innerWidth, window.innerHeight) * .55;
      var st = document.createElement('div');
      st.className = 'pt-stamp';
      st.style.width = st.style.height = D + 'px';
      st.innerHTML = '<b class="brand">Tickity</b><small>картка лояльності</small>';
      o.appendChild(st);
      var slam = st.animate([{ transform: 'translate(-50%,-50%) scale(2.6) rotate(-28deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-8deg)', opacity: 1 }],
        { duration: 300, easing: 'cubic-bezier(.6,0,.9,.6)', fill: 'both' });
      return slam.finished.then(function () {
        document.body.animate([{ transform: 'none' }, { transform: 'translateY(7px)' }, { transform: 'none' }], { duration: 180 });
        var cx = r.width / 2, cy = r.height / 2, R = Math.hypot(cx, cy) + 4;
        var ink = document.createElement('i');
        ink.className = 'pt-ink';
        o.insertBefore(ink, st);
        return done([ink.animate([{ clipPath: 'circle(' + (D / 2) + 'px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + cx + 'px ' + cy + 'px)' }],
          { duration: 380, delay: 120, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' })]);
      });
    },
    tear: function (o) {
      var sh = document.createElement('i');
      sh.className = 'pt-sheet perf-top';
      sh.style.top = '0'; sh.style.height = '100%';
      o.appendChild(sh);
      logo(o, true).style.zIndex = 2;
      return done([sh.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.75,0,.25,1)', fill: 'both' })]);
    }
  };

  var ENTER = {
    flood: function (o) {
      o.classList.add('solid');
      var r = o.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, R = Math.hypot(cx, cy) + 4;
      return new Promise(function (res) {
        var t0 = performance.now(), D = 760;
        (function f(t) {
          var p = Math.min(1, (t - t0) / D), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          var rad = R * e;
          var m = 'radial-gradient(circle at ' + cx + 'px ' + cy + 'px, transparent ' + rad + 'px, #000 ' + (rad + 1) + 'px)';
          o.style.webkitMaskImage = m; o.style.maskImage = m;
          if (p < 1) requestAnimationFrame(f); else res();
        })(t0);
      });
    },
    strips: function (o) {
      var n = mobile() ? 4 : 7, an = [];
      for (var i = 0; i < n; i++) {
        var s = document.createElement('i');
        s.className = 'pt-strip';
        s.style.borderRadius = '28px 28px 0 0';
        s.style.left = (i * 100 / n) + '%'; s.style.width = 'calc(' + (100 / n) + '% + 1px)';
        o.appendChild(s);
        an.push(s.animate([{ transform: 'none' }, { transform: 'translateY(101%)' }], { duration: 560, delay: 80 + i * 55, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' }));
      }
      return done(an);
    },
    dots: function (o) {
      var r = o.getBoundingClientRect(), x = r.width / 2, y = r.height / 2;
      var cell = mobile() ? 56 : 84, size = cell * 1.5, an = [];
      var cols = Math.ceil(r.width / cell) + 1, rows = Math.ceil(r.height / cell) + 1;
      var maxD = Math.hypot(r.width, r.height) / 2;
      for (var cy = 0; cy < rows; cy++) for (var cx = 0; cx < cols; cx++) {
        var d = document.createElement('i');
        d.className = 'pt-dot';
        var px = cx * cell + cell / 2, py = cy * cell + cell / 2;
        d.style.width = d.style.height = size + 'px';
        d.style.left = (px - size / 2) + 'px'; d.style.top = (py - size / 2) + 'px';
        o.appendChild(d);
        an.push(d.animate([{ transform: 'scale(1)' }, { transform: 'scale(0)' }],
          { duration: 320, delay: 60 + Math.hypot(px - x, py - y) / maxD * 480, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'both' }));
      }
      return done(an);
    },
    stamp: function (o) {
      var r = o.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, R = Math.hypot(cx, cy) + 4;
      var D = Math.min(window.innerWidth, window.innerHeight) * .55;
      var ink = document.createElement('i');
      ink.className = 'pt-ink';
      o.appendChild(ink);
      var st = document.createElement('div');
      st.className = 'pt-stamp';
      st.style.width = st.style.height = D + 'px';
      st.style.transform = 'translate(-50%,-50%) rotate(-8deg)';
      st.innerHTML = '<b class="brand">Tickity</b><small>картка лояльності</small>';
      o.appendChild(st);
      var shrink = ink.animate([{ clipPath: 'circle(' + R + 'px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + (D / 2) + 'px at ' + cx + 'px ' + cy + 'px)' }],
        { duration: 420, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' });
      return shrink.finished.then(function () {
        ink.remove();
        return done([st.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(-8deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5) rotate(6deg)', opacity: 0 }],
          { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' })]);
      });
    },
    tear: function (o) {
      var a = document.createElement('i'), b = document.createElement('i');
      a.className = 'pt-sheet perf-bottom'; a.style.top = '0'; a.style.height = '50%';
      b.className = 'pt-sheet perf-top'; b.style.top = '50%'; b.style.height = '50%';
      o.appendChild(a); o.appendChild(b);
      return done([
        a.animate([{ transform: 'none' }, { transform: 'translateY(-102%) rotate(-3deg)' }], { duration: 680, delay: 120, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'both' }),
        b.animate([{ transform: 'none' }, { transform: 'translateY(102%) rotate(3deg)' }], { duration: 680, delay: 120, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'both' })
      ]);
    }
  };

  function enter() {
    if (!arrived) return;
    var o = layer(arrivedType === 'flood' ? '' : 'clear');
    if (arrivedType !== 'stamp') logo(o, false).style.zIndex = 3;
    root.classList.add('pt-arrived');
    root.classList.remove('pt-in');
    ENTER[arrivedType](o).then(function () { o.remove(); });
    setTimeout(function () { o.remove(); }, 2200);
    setTimeout(function () { root.classList.remove('pt-arrived'); }, 1500);
  }

  var leaving = false;
  function go(href, x, y) {
    if (leaving) return;
    if (reduce) { location.href = href; return; }
    leaving = true;
    if (x == null || y == null) { x = window.innerWidth / 2; y = window.innerHeight / 2; }
    var type = nextType();
    ss.set('tk-pt-last', type);
    var o = layer('clear');
    var gone = false;
    function nav() {
      if (gone) return; gone = true;
      ss.set('tk-pt', JSON.stringify({ t: Date.now(), type: type }));
      location.href = href;
    }
    EXIT[type](o, x, y).then(function () { setTimeout(nav, 140); });
    setTimeout(nav, 1500);
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^[a-z][a-z0-9+.-]*:/i.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    var x = e.clientX, y = e.clientY;
    if (!e.detail) { var r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    go(href, x, y);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { leaving = false; document.querySelectorAll('.pt-layer').forEach(function (n) { n.remove(); }); root.classList.remove('pt-in'); }
  });

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i]; return list[0]; }

  /* Punched-out chips that fall from an element across the screen. */
  function chips(el, n, opts) {
    if (reduce || !el) return;
    opts = opts || {};
    var r = el.getBoundingClientRect();
    for (var i = 0; i < (n || 1); i++) {
      (function (k) {
        setTimeout(function () {
          var c = document.createElement('span');
          c.className = 'chipfx';
          if (opts.size) { c.style.width = c.style.height = opts.size + 'px'; }
          var s = opts.size || 18;
          c.style.left = (r.left + r.width / 2 - s / 2 + (Math.random() - .5) * (opts.jitter || 0)) + 'px';
          c.style.top = (r.top + r.height / 2 - s / 2) + 'px';
          document.body.appendChild(c);
          var dx = (Math.random() - .5) * (opts.spread || 260);
          var dy = (opts.fall || 300) + Math.random() * 260;
          var anim = c.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx > 0 ? 220 : -220) + 'deg) scale(.6)', opacity: 0 }
          ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.35,.1,.7,1)' });
          anim.onfinish = function () { c.remove(); };
        }, k * (opts.stagger || 70));
      })(i);
    }
  }

  /* Numbers that count up once on load. */
  function countUp(el, to, dur, suffix) {
    suffix = suffix || '';
    if (reduce) { el.textContent = to.toLocaleString('uk-UA') + suffix; return; }
    var start = performance.now();
    function tick(t) {
      var p = Math.min(1, (t - start) / (dur || 1200));
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString('uk-UA') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var panel;
  function sync() {
    if (!panel) return;
    var pal = root.getAttribute('data-pal'), font = root.getAttribute('data-font');
    panel.querySelectorAll('[data-pal-id]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pal-id') === pal)); });
    panel.querySelectorAll('[data-font-id]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-font-id') === font)); });
    var now = panel.querySelector('.now');
    if (now) now.textContent = find(PALS, pal)[1] + ' · ' + find(FONTS, font)[1];
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'demo';
    var saved = store.get('tk-demo-open');
    panel.setAttribute('data-open', saved ? saved : (window.innerWidth > 860 ? 'true' : 'false'));
    var here = (location.pathname.split('/').pop() || 'index.html');
    var html = '<button type="button" class="demo-toggle" aria-label="Стиль: кольори й шрифт" aria-expanded="' + panel.getAttribute('data-open') + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/><path d="M12 21a3 3 0 0 1 0-6h2"/></svg><span class="t">Стиль</span></button>' +
      '<div class="demo-body"><div class="grp" role="group" aria-label="Кольори"><span class="lbl">Кольори</span>';
    PALS.forEach(function (p) {
      html += '<button type="button" class="sw" data-pal-id="' + p[0] + '" title="' + p[1] + '" aria-label="' + p[1] + '" style="--sa:' + p[2] + ';--sb:' + p[3] + '"></button>';
    });
    html += '</div><div class="grp" role="group" aria-label="Шрифт заголовків"><span class="lbl">Шрифт</span>';
    FONTS.forEach(function (f) {
      html += '<button type="button" class="fb" data-font-id="' + f[0] + '" title="' + f[1] + '" aria-label="' + f[1] + '" style="font-family:' + f[2] + ';font-weight:' + f[3] + '">Аа</button>';
    });
    html += '</div><div class="grp"><label class="lbl" for="tk-page">Сторінка</label><select id="tk-page">';
    PAGES.forEach(function (p) { html += '<option value="' + p[0] + '"' + (p[0] === here ? ' selected' : '') + '>' + p[1] + '</option>'; });
    html += '</select></div><div class="grp"><label class="lbl" for="tk-pt">Перехід</label><select id="tk-pt">';
    var mode = store.get('tk-pt-mode') || 'cycle';
    ['cycle'].concat(PT_TYPES).forEach(function (k) { html += '<option value="' + k + '"' + (k === mode ? ' selected' : '') + '>' + PT_NAMES[k] + '</option>'; });
    html += '</select></div>';
    if (window.TK && window.TK.replayIntro) html += '<button type="button" class="replay">Заставка ще раз</button>';
    html += '<span class="now"></span></div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    panel.querySelector('.demo-toggle').addEventListener('click', function () {
      var open = panel.getAttribute('data-open') !== 'true';
      panel.setAttribute('data-open', String(open));
      this.setAttribute('aria-expanded', String(open));
      store.set('tk-demo-open', String(open));
    });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pal-id],[data-font-id]');
      if (!b) return;
      if (b.hasAttribute('data-pal-id')) { root.setAttribute('data-pal', b.getAttribute('data-pal-id')); store.set('tk-pal', b.getAttribute('data-pal-id')); }
      else { root.setAttribute('data-font', b.getAttribute('data-font-id')); store.set('tk-font', b.getAttribute('data-font-id')); }
      sync();
      document.dispatchEvent(new CustomEvent('tk:style'));
    });
    panel.querySelector('#tk-page').addEventListener('change', function () { go(this.value); });
    panel.querySelector('#tk-pt').addEventListener('change', function () { store.set('tk-pt-mode', this.value); });
    var rp = panel.querySelector('.replay');
    if (rp) rp.addEventListener('click', function () { window.TK.replayIntro(); });
    sync();
  }

  window.TK = window.TK || {};
  window.TK.reduce = reduce;
  window.TK.chips = chips;
  window.TK.countUp = countUp;
  window.TK.store = store;
  window.TK.go = go;
  window.TK.arrived = arrived;
  function boot() { enter(); build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

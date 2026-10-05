/* HacAUK deck engine.
   Turns <main class="deck"> full of <section class="slide"> into a presentation:
   scaled 16:9 stage, build steps, transitions, overview, speaker view, prompt sheet, pace clock. */
(function (root) {
  'use strict';

  var doc = document, body = doc.body;
  var deckEl = doc.querySelector('.deck');
  if (!deckEl) return;

  var W = 1920, H = 1080;
  var World = root.HacAUKWorld, Fx = root.HacAUKFx;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var el = function (tag, cls, html) { var n = doc.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var params = new URLSearchParams(location.search);
  var MODE = params.has('speaker') ? 'speaker' : (params.get('view') === 'prompts' ? 'sheet' : 'show');
  var deckId = deckEl.getAttribute('data-deck') || location.pathname;
  var deckTitle = deckEl.getAttribute('data-title') || doc.title;
  var homeHref = deckEl.getAttribute('data-home') || '../../index.html';
  var EASE_IN = 'cubic-bezier(.7,0,.84,0)', EASE_OUT = 'cubic-bezier(.16,1,.3,1)', EASE_IO = 'cubic-bezier(.76,0,.24,1)';

  var sysReduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionPref = null;
  try { motionPref = sessionStorage.getItem('hacauk:motion'); } catch (e) {}
  var calm = motionPref ? motionPref === 'calm' : sysReduced;

  /* ------------------------------------------------------------------ DOM */
  body.classList.add('is-deck');
  if (MODE === 'speaker') body.classList.add('is-speaker');
  if (MODE === 'sheet') body.classList.add('is-sheet');

  var viewport = el('div', 'viewport');
  var stage = el('div', 'stage');
  var world = el('div', 'world');
  world.innerHTML = World.markup();
  var slidesWrap = el('div', 'slides');
  var fxLayer = el('div', 'fx');
  var slideEls = $$('section.slide', deckEl);
  slideEls.forEach(function (s) { slidesWrap.appendChild(s); });
  stage.appendChild(world); stage.appendChild(slidesWrap); stage.appendChild(fxLayer);
  viewport.appendChild(stage);
  deckEl.appendChild(viewport);
  deckEl.setAttribute('aria-roledescription', 'presentation');

  ['grain', 'vignette', 'frame', 'blackout'].forEach(function (c) { body.appendChild(el('div', c)); });
  var toastEl = el('div', 'toast'); toastEl.setAttribute('role', 'status'); body.appendChild(toastEl);
  var progress = el('div', 'progress', '<i></i>'); body.appendChild(progress);

  // data-sheet-url on the deck: every room prompt card shows where to copy it from
  var sheetUrl = deckEl.getAttribute('data-sheet-url');
  if (sheetUrl && MODE !== 'sheet') {
    $$('.prompt', slidesWrap).forEach(function (card) {
      if (card.hasAttribute('data-nosheet') || card.hasAttribute('data-nocopy')) return;
      var bar = $('.prompt-bar', card), btn = bar && $('.prompt-copy', bar);
      if (!bar) return;
      var link = el('span', 'prompt-link', 'copy it at <b>' + esc(sheetUrl) + '</b>');
      btn ? bar.insertBefore(link, btn) : bar.appendChild(link);
    });
  }

  Fx.init(slidesWrap);

  /* ------------------------------------------------------------------ model */
  var slides = slideEls.map(function (s, i) {
    var stepEls = $$('[data-step]', s);
    stepEls.forEach(function (n) {
      if (!n.hasAttribute('data-anim') && !n.hasAttribute('data-split') && !n.hasAttribute('data-plain')) n.setAttribute('data-anim', 'rise');
    });
    var steps = Math.max.apply(null, [0, +(s.getAttribute('data-steps') || 0)].concat(stepEls.map(function (n) { return +n.getAttribute('data-step') || 0; })));

    // auto-stagger: entrance order follows DOM order unless data-delay is given
    var groups = {};
    $$('[data-anim],[data-split]', s).forEach(function (n) {
      var holder = n.hasAttribute('data-step') ? n : n.closest('[data-step]');
      var key = holder ? holder.getAttribute('data-step') : '0';
      var k = groups[key] = (groups[key] || 0);
      var explicit = n.getAttribute('data-delay');
      var first = key === '0' ? 220 : 0;
      n.style.setProperty('--delay', (explicit != null ? +explicit : first + k * 110) + 'ms');
      if (explicit == null) groups[key] = k + 1;
    });

    var scene = s.getAttribute('data-scene') || 'night';
    var notes = $('.notes', s);
    var heading = $('h1,h2', s);
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + slideEls.length);
    return {
      i: i, el: s, steps: steps, scene: scene,
      sun: World.parseSun(s.getAttribute('data-sun'), scene),
      // data-sun-at="1:960,1500,1.7; 3:..." moves the sun when a build step is reached
      sunAt: (s.getAttribute('data-sun-at') || '').split(';').map(function (part) {
        var m = /^\s*(\d+)\s*:(.+)$/.exec(part);
        return m ? { step: +m[1], sun: World.parseSun(m[2], scene) } : null;
      }).filter(Boolean).sort(function (a, b) { return a.step - b.step; }),
      transition: s.getAttribute('data-transition') || 'fade',
      minutes: parseFloat(s.getAttribute('data-minutes')) || 0,
      title: s.getAttribute('data-title') || (heading ? heading.textContent.trim() : 'Slide ' + (i + 1)),
      notes: notes ? notes.innerHTML : ''
    };
  });
  var total = slides.length;
  var plannedEnd = []; slides.reduce(function (acc, s, i) { return plannedEnd[i] = acc + s.minutes * 60; }, 0);
  var plannedTotal = plannedEnd[total - 1] || 0;

  var index = -1, step = 0, busy = false, queued = null, pendingStep = 0, arrivingBack = false;

  /* ------------------------------------------------------------------ layout */
  var scale = 1;
  function fit() {
    var r = viewport.getBoundingClientRect();
    if (!r.width || !r.height) return;
    scale = Math.min(r.width / W, r.height / H);
    stage.style.setProperty('--scale', scale.toFixed(5));
  }
  /* visible area in stage coordinates (the viewport can be wider/taller than 16:9) */
  function extent() {
    var r = viewport.getBoundingClientRect();
    var hw = r.width / scale / 2, hh = r.height / scale / 2;
    return { l: W / 2 - hw, r: W / 2 + hw, t: H / 2 - hh, b: H / 2 + hh, w: hw * 2, h: hh * 2 };
  }
  // refit after layout has settled: window resize, entering or leaving fullscreen, speaker panel changes
  function refit() { fit(); requestAnimationFrame(fit); }
  root.addEventListener('resize', refit);
  doc.addEventListener('fullscreenchange', refit);
  doc.addEventListener('webkitfullscreenchange', refit);
  if (root.ResizeObserver) new ResizeObserver(fit).observe(viewport);

  /* ------------------------------------------------------------------ steps */
  function paintSteps(s, n) {
    $$('[data-step]', s.el).forEach(function (node) {
      node.classList.toggle('is-shown', (+node.getAttribute('data-step') || 0) <= n);
    });
    for (var k = 1; k <= s.steps; k++) s.el.classList.toggle('step-' + k, k <= n);
    s.el.setAttribute('data-at', n);
  }
  function setStep(n, opts) {
    var s = slides[index]; if (!s) return;
    n = clamp(n, 0, s.steps);
    if (n === step) return;
    var prev = step; step = n;
    paintSteps(s, n);
    if (s.sunAt.length) applyWorld(s);
    s.el.dispatchEvent(new CustomEvent('deck:step', { bubbles: true, detail: { step: n, prev: prev, index: index } }));
    changed(opts);
  }

  /* ------------------------------------------------------------------ world */
  function sunFor(s, st) {
    var sun = s.sun;
    s.sunAt.forEach(function (o) { if (st >= o.step) sun = o.sun; });
    return sun;
  }
  function applyWorld(s, instant) {
    var st = s === slides[index] ? step : clamp(pendingStep, 0, s.steps);
    World.apply(world, s.scene, sunFor(s, st), instant || calm);
    body.setAttribute('data-scene', s.scene);
  }

  /* ------------------------------------------------------------------ enter / leave */
  function leave(s) {
    if (!s) return;
    s.el.classList.remove('is-active', 'is-leaving');
    s.el.style.removeProperty('--base');
    s.el.dispatchEvent(new CustomEvent('deck:leave', { bubbles: true, detail: { index: s.i } }));
  }
  function enter(s, base) {
    index = s.i; step = clamp(pendingStep, 0, s.steps);
    s.el.classList.remove('is-active', 'is-leaving');
    s.el.style.setProperty('--base', (base || 0) + 'ms');
    paintSteps(s, step);
    void s.el.offsetWidth;                    // restart entrance animations
    s.el.classList.add('is-active');
    s.el.dispatchEvent(new CustomEvent('deck:enter', { bubbles: true, detail: { step: step, index: s.i, back: arrivingBack } }));
  }

  /* ------------------------------------------------------------------ transitions */
  function anim(node, frames, opts) {
    try { return node.animate(frames, opts).finished.catch(function () {}); }
    catch (e) { return Promise.resolve(); }
  }
  function farthest(p, ex) {
    return Math.max(
      Math.hypot(p.x - ex.l, p.y - ex.t), Math.hypot(p.x - ex.r, p.y - ex.t),
      Math.hypot(p.x - ex.l, p.y - ex.b), Math.hypot(p.x - ex.r, p.y - ex.b));
  }

  var T = {
    cut: function (from, to) { applyWorld(to, true); leave(from); enter(to, 0); return Promise.resolve(); },

    fade: async function (from, to) {
      applyWorld(to);
      if (from) { from.el.classList.add('is-leaving'); await sleep(280); }
      leave(from); enter(to, 0);
    },

    /* the sun swallows the screen, then shrinks back into the next slide's sun */
    sun: async function (from, to) {
      var b = sunFor(to, clamp(pendingStep, 0, to.steps));
      var ex = extent(), a = from ? sunFor(from, step) : b;
      var disc = el('i', 'fx-disc');
      disc.style.left = a.x + 'px'; disc.style.top = a.y + 'px';
      fxLayer.appendChild(disc);
      var k1 = (farthest(a, ex) + 60) / 100, k2 = (farthest(b, ex) + 60) / 100;
      var s0 = from ? Math.max(.2, a.s * 4.1) : .2;
      await anim(disc, [{ transform: 'scale(' + s0 + ')' }, { transform: 'scale(' + k1 + ')' }], { duration: 520, easing: EASE_IN, fill: 'forwards' });
      applyWorld(to, true); leave(from); enter(to, 420);
      disc.style.left = b.x + 'px'; disc.style.top = b.y + 'px';
      disc.getAnimations().forEach(function (x) { x.cancel(); });
      disc.style.transform = 'scale(' + k2 + ')';
      await sleep(70);
      await anim(disc, [{ transform: 'scale(' + k2 + ')' }, { transform: 'scale(' + Math.max(.2, b.s * 4.1) + ')' }], { duration: 760, easing: EASE_OUT, fill: 'forwards' });
      await anim(disc, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
      disc.remove();
    },

    /* the poster's wing bars close across the screen and open again */
    stripes: async function (from, to, dir) {
      var ex = extent(), n = 9, h = ex.h / n, bars = [], tones = ['var(--amber)', 'var(--cream)', 'var(--amber-lo)'];
      for (var i = 0; i < n; i++) {
        var b = el('i', 'fx-bar');
        b.style.cssText = 'left:' + (ex.l - 4) + 'px;width:' + (ex.w + 8) + 'px;top:' + (ex.t + i * h - 1) + 'px;height:' + (h + 2) + 'px;background:' + tones[i % 3] + ';transform:scaleX(0)';
        fxLayer.appendChild(b); bars.push(b);
      }
      var fwd = dir >= 0;
      await Promise.all(bars.map(function (b, i) {
        b.style.transformOrigin = ((i % 2 === 0) === fwd ? '0' : '100%') + ' 50%';
        return anim(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 330, delay: i * 26, easing: EASE_IO, fill: 'forwards' });
      }));
      applyWorld(to, true); leave(from); enter(to, 300);
      await sleep(60);
      await Promise.all(bars.map(function (b, i) {
        b.getAnimations().forEach(function (x) { x.cancel(); });
        b.style.transform = 'scaleX(1)';
        b.style.transformOrigin = ((i % 2 === 0) === fwd ? '100%' : '0') + ' 50%';
        return anim(b, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 380, delay: i * 26, easing: EASE_IO, fill: 'forwards' });
      }));
      bars.forEach(function (b) { b.remove(); });
    },

    /* pixel-checker dissolve */
    pixels: async function (from, to) {
      var ex = extent(), size = 120, cols = Math.ceil(ex.w / size) + 1, rows = Math.ceil(ex.h / size) + 1, cells = [];
      var x0 = ex.l - (cols * size - ex.w) / 2, y0 = ex.t - (rows * size - ex.h) / 2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var p = el('i', 'fx-px');
        p.style.cssText = 'left:' + (x0 + c * size) + 'px;top:' + (y0 + r * size) + 'px;width:' + (size + 1) + 'px;height:' + (size + 1) + 'px;transform:scale(0)';
        if ((r + c) % 2) p.style.background = 'var(--cream)';
        // deterministic scatter so the pattern looks hand-placed rather than random noise
        p.__d = ((c * 7 + r * 13) % 11) * 17 + ((r + c) % 2) * 28;
        fxLayer.appendChild(p); cells.push(p);
      }
      await Promise.all(cells.map(function (p) { return anim(p, [{ transform: 'scale(0)' }, { transform: 'scale(1.02)' }], { duration: 230, delay: p.__d, easing: EASE_OUT, fill: 'forwards' }); }));
      applyWorld(to, true); leave(from); enter(to, 320);
      await sleep(60);
      await Promise.all(cells.map(function (p) {
        p.getAnimations().forEach(function (x) { x.cancel(); });
        p.style.transform = 'scale(1.02)';
        return anim(p, [{ transform: 'scale(1.02)' }, { transform: 'scale(0)' }], { duration: 240, delay: p.__d, easing: EASE_IN, fill: 'forwards' });
      }));
      cells.forEach(function (p) { p.remove(); });
    },

    /* camera pushes through the slide */
    zoom: async function (from, to, dir) {
      applyWorld(to);
      if (from) await anim(from.el, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + (dir >= 0 ? 1.28 : .8) + ')', opacity: 0 }], { duration: 340, easing: EASE_IN });
      leave(from); enter(to, 0);
      anim(to.el, [{ transform: 'scale(' + (dir >= 0 ? .82 : 1.22) + ')' }, { transform: 'scale(1)' }], { duration: 640, easing: EASE_OUT });
    },

    push: async function (from, to, dir) {
      applyWorld(to);
      var d = dir >= 0 ? 1 : -1;
      if (from) await anim(from.el, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + (-d * 320) + 'px)', opacity: 0 }], { duration: 300, easing: EASE_IN });
      leave(from); enter(to, 0);
      anim(to.el, [{ transform: 'translateX(' + (d * 320) + 'px)' }, { transform: 'translateX(0)' }], { duration: 620, easing: EASE_OUT });
    }
  };

  async function show(i, st, dir, opts) {
    opts = opts || {};
    i = clamp(i, 0, total - 1);
    if (busy) { queued = [i, st, dir, opts]; return; }
    var from = slides[index], to = slides[i];
    if (from === to) { setStep(st || 0, opts); return; }
    busy = true; pendingStep = st || 0; arrivingBack = dir < 0;
    var kind = opts.instant ? 'cut' : (calm ? 'fade' : (dir >= 0 ? to.transition : from.transition));
    if (!T[kind]) kind = 'fade';
    try { await T[kind](from, to, dir); }
    catch (err) {                                   // never strand the presenter on a broken transition
      console.error('[deck] transition failed', err);
      fxLayer.innerHTML = '';
      if (from) leave(from);
      applyWorld(to, true); enter(to, 0);
    }
    busy = false;
    changed(opts);
    if (queued) { var q = queued; queued = null; q[3] = Object.assign({}, q[3], { instant: true }); show(q[0], q[1], q[2], q[3]); }
  }

  function next() {
    var s = slides[index]; if (!s || busy) return;      // a second press mid-transition is ignored, so a bouncy clicker cannot skip a slide
    if (step < s.steps) return setStep(step + 1);
    if (index < total - 1) { startClock(); return show(index + 1, 0, 1); }
  }
  function prev() {
    var s = slides[index]; if (!s || busy) return;
    if (step > 0) return setStep(step - 1);
    if (index > 0) return show(index - 1, slides[index - 1].steps, -1);
  }

  /* ------------------------------------------------------------------ session clock + pace */
  var clockKey = 'hacauk:clock:' + deckId, t0 = 0;
  try { t0 = +sessionStorage.getItem(clockKey) || 0; } catch (e) {}
  function startClock() { if (t0) return; t0 = Date.now(); persistClock(); sync(); }
  function resetClock() { t0 = 0; persistClock(); paintClock(); sync(); toast('Session clock reset'); }
  function persistClock() { try { t0 ? sessionStorage.setItem(clockKey, t0) : sessionStorage.removeItem(clockKey); } catch (e) {} }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
  function pace() {
    if (!t0 || !plannedTotal) return { state: 'idle', label: 'not started' };
    var e = (Date.now() - t0) / 1000, start = index > 0 ? plannedEnd[index - 1] : 0, end = plannedEnd[index];
    if (e > end + 20) return { state: 'behind', label: '+' + mmss(e - end) + ' behind' };
    if (e < start - 20) return { state: 'ahead', label: mmss(start - e) + ' ahead' };
    return { state: 'on', label: 'on pace' };
  }

  /* ------------------------------------------------------------------ HUD */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 114 2c-.9.6-1.6 1.2-1.6 2.3M12 17.2v.1"/></svg>'
  };
  var hud = el('div', 'hud');
  hud.innerHTML =
    '<a class="hud-brand brandmark" href="' + esc(homeHref) + '" title="Back to the library">H<small>ac</small>AUK</a>' +
    '<span class="hud-title">' + esc(deckTitle) + '</span><span class="hud-space"></span>' +
    '<span class="hud-read hud-pace" data-state="idle"></span>' +
    '<span class="hud-read hud-clock" title="Session clock"></span>' +
    '<span class="hud-read hud-count"></span>' +
    '<button class="hud-btn" type="button" data-act="prev" aria-label="Previous">' + ICON.prev + '</button>' +
    '<button class="hud-btn" type="button" data-act="next" aria-label="Next">' + ICON.next + '</button>' +
    '<button class="hud-btn" type="button" data-act="overview" aria-label="All slides (O)" title="All slides (O)">' + ICON.grid + '</button>' +
    '<button class="hud-btn" type="button" data-act="speaker" aria-label="Speaker view (S)" title="Speaker view (S)">' + ICON.notes + '</button>' +
    '<button class="hud-btn" type="button" data-act="fullscreen" aria-label="Fullscreen (F)" title="Fullscreen (F)">' + ICON.full + '</button>' +
    '<button class="hud-btn" type="button" data-act="help" aria-label="Shortcuts (?)" title="Shortcuts (?)">' + ICON.help + '</button>';
  body.appendChild(hud);
  var hudCount = $('.hud-count', hud), hudClock = $('.hud-clock', hud), hudPace = $('.hud-pace', hud);
  hud.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    e.stopPropagation(); act(b.getAttribute('data-act')); b.blur();
  });

  var hudTimer = 0, idleTimer = 0;
  function wake() {
    body.classList.add('hud-on'); body.classList.remove('is-idle');
    clearTimeout(hudTimer); clearTimeout(idleTimer);
    hudTimer = setTimeout(function () { if (!hud.matches(':hover')) body.classList.remove('hud-on'); }, 2600);
    idleTimer = setTimeout(function () { if (!hud.matches(':hover')) body.classList.add('is-idle'); }, 3200);
  }
  doc.addEventListener('mousemove', wake);

  function paintClock() {
    var e = t0 ? (Date.now() - t0) / 1000 : 0, p = pace();
    hudClock.innerHTML = '<b>' + mmss(e) + '</b>' + (plannedTotal ? ' / ' + mmss(plannedTotal) : '');
    hudPace.textContent = p.label; hudPace.setAttribute('data-state', p.state);
    if (MODE === 'speaker') paintSpeakerClock(e, p);
  }
  setInterval(paintClock, 1000);

  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('is-on'); }, ms || 1800);
  }

  /* ------------------------------------------------------------------ after every change */
  function changed(opts) {
    var s = slides[index]; if (!s) return;
    hudCount.innerHTML = '<b>' + pad(index + 1) + '</b> / ' + pad(total);
    var done = total > 1 ? (index + (s.steps ? step / (s.steps + 1) : 0)) / (total - 1) : 1;
    progress.firstChild.style.width = (clamp(done, 0, 1) * 100).toFixed(2) + '%';
    var hash = '#' + (index + 1) + (step ? '.' + step : '');
    try { history.replaceState(null, '', location.pathname + location.search + hash); } catch (e) { location.hash = hash; }
    doc.title = (index + 1) + '. ' + s.title + ' — ' + deckTitle;
    paintClock();
    if (MODE === 'speaker') paintSpeaker();
    $$('.thumb', overviewGrid).forEach(function (t, i) { t.classList.toggle('is-current', i === index); });
    if (!(opts && opts.silent)) sync();
  }

  /* ------------------------------------------------------------------ overview */
  var overview = el('div', 'overview');
  overview.innerHTML = '<div class="overview-head"><h2>All slides</h2><p>Click a slide, or press <kbd>Esc</kbd></p></div><div class="overview-grid"></div>';
  body.appendChild(overview);
  var overviewGrid = $('.overview-grid', overview), overviewBuilt = false;

  function buildThumb(s, tag) {
    var t = el(tag || 'button', 'thumb'); if (!tag) t.type = 'button';
    var inner = el('div', 'thumb-stage');
    var w = el('div', 'world is-still'); w.innerHTML = World.markup();
    World.apply(w, s.scene, sunFor(s, s.steps), false);
    var clone = s.el.cloneNode(true);
    clone.classList.remove('is-leaving'); clone.classList.add('is-active', 'is-static');
    clone.removeAttribute('style'); clone.removeAttribute('aria-label');
    for (var k = 1; k <= s.steps; k++) clone.classList.add('step-' + k);
    clone.setAttribute('data-at', s.steps);
    $$('[data-step]', clone).forEach(function (n) { n.classList.add('is-shown'); });
    $$('[data-full]', clone).forEach(function (n) { n.textContent = n.getAttribute('data-full'); });
    $$('[id]', clone).forEach(function (n) { n.removeAttribute('id'); });
    $$('a,button,[tabindex]', clone).forEach(function (n) { n.setAttribute('tabindex', '-1'); });
    $$('.notes', clone).forEach(function (n) { n.remove(); });
    inner.appendChild(w); inner.appendChild(clone); t.appendChild(inner);
    t.appendChild(el('span', 'thumb-n', pad(s.i + 1)));
    t.appendChild(el('span', 'thumb-t', esc(s.title)));
    return t;
  }
  function openOverview() {
    if (!overviewBuilt) {
      slides.forEach(function (s) {
        var t = buildThumb(s);
        t.setAttribute('aria-label', 'Go to slide ' + (s.i + 1) + ': ' + s.title);
        t.addEventListener('click', function () { closeOverview(); show(s.i, 0, s.i >= index ? 1 : -1, { instant: true }); });
        overviewGrid.appendChild(t);
      });
      overviewBuilt = true;
    }
    $$('.thumb', overviewGrid).forEach(function (t, i) { t.classList.toggle('is-current', i === index); });
    body.classList.add('is-overview');
    var cur = $('.thumb.is-current', overviewGrid); if (cur) { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: 'center' }); }
  }
  function closeOverview() { body.classList.remove('is-overview'); if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); }

  /* ------------------------------------------------------------------ help */
  var KEYS = [
    ['→ Space', 'Next step or slide'], ['←', 'Back'], ['F', 'Fullscreen'], ['O', 'All slides'],
    ['S', 'Speaker view (notes, next slide, clock)'], ['D', 'Open this slide’s live demo (Shift+D: the second one)'],
    ['C', 'Copy this slide’s prompt'], ['T', 'Start / pause the activity timer'], ['R', 'Reset the timer (Shift+R: session clock)'],
    ['B', 'Black out the screen'], ['M', 'Calm / full motion'], ['1…9 Enter', 'Jump to a slide'], ['Home End', 'First / last slide']
  ];
  var help = el('div', 'help');
  help.innerHTML = '<div class="plaque help-card"><div class="help-in"><h2>Shortcuts</h2><dl class="help-keys">' +
    KEYS.map(function (k) { return '<div><dt>' + k[0].split(' ').map(function (x) { return '<kbd>' + esc(x) + '</kbd>'; }).join('') + '</dt><dd>' + esc(k[1]) + '</dd></div>'; }).join('') +
    '</dl></div></div>';
  body.appendChild(help);
  help.addEventListener('click', function () { body.classList.remove('is-help'); });

  /* ------------------------------------------------------------------ speaker view */
  var peer = null, speakerEls = null;
  function sync() {
    var msg = { __hacauk: deckId, type: 'state', index: index, step: step, t0: t0 };
    var targets = [];
    if (MODE === 'speaker' && root.opener && !root.opener.closed) targets.push(root.opener);
    if (peer && !peer.closed) targets.push(peer);
    targets.forEach(function (w) { try { w.postMessage(msg, '*'); } catch (e) {} });
  }
  root.addEventListener('message', function (e) {
    var m = e.data; if (!m || m.__hacauk !== deckId) return;
    if (m.type === 'hello') { if (MODE !== 'speaker') { peer = e.source; sync(); } return; }
    if (m.type !== 'state') return;
    if (m.t0 !== t0) { t0 = m.t0 || 0; persistClock(); paintClock(); }
    if (m.index === index && m.step === step) return;
    if (m.index === index) setStep(m.step, { silent: true });
    else show(m.index, m.step, m.index > index ? 1 : -1, { silent: true });
  });
  function openSpeaker() {
    if (MODE === 'speaker') return;
    var url = location.pathname + '?speaker=1' + location.hash;
    peer = root.open(url, 'hacauk-speaker', 'width=1280,height=760');
    if (!peer) toast('Allow pop-ups to open the speaker view', 3200);
  }
  function buildSpeaker() {
    var wrap = el('div', 'speaker');
    wrap.innerHTML =
      '<aside class="sp-side">' +
        '<div class="sp-clock"><div><span>Elapsed</span><b class="sp-elapsed">0:00</b></div>' +
        '<div class="sp-pace" data-state="idle"><span>Pace</span><b class="sp-pace-v">—</b></div>' +
        '<div><span>Slide</span><b class="sp-count"></b></div></div>' +
        '<div><p class="sp-h">Now</p><h2 class="sp-title"></h2></div>' +
        '<div><p class="sp-h">Notes</p><div class="sp-notes"></div></div>' +
        '<div class="sp-prompts-wrap"><p class="sp-h">Prompts on this slide · C copies the visible one</p><div class="sp-prompts"></div></div>' +
      '</aside>' +
      '<div class="sp-bottom"><div class="sp-next"><p class="sp-h">Next</p><div class="sp-next-slot"></div></div>' +
      '<p class="sp-keys">→ next &nbsp;·&nbsp; ← back &nbsp;·&nbsp; T timer &nbsp;·&nbsp; D demo &nbsp;·&nbsp; C copy prompt<br>This window drives the main screen, and follows it.</p></div>';
    body.appendChild(wrap);
    speakerEls = {
      elapsed: $('.sp-elapsed', wrap), pace: $('.sp-pace', wrap), paceV: $('.sp-pace-v', wrap), count: $('.sp-count', wrap),
      title: $('.sp-title', wrap), notes: $('.sp-notes', wrap), prompts: $('.sp-prompts', wrap), promptsWrap: $('.sp-prompts-wrap', wrap),
      next: $('.sp-next-slot', wrap)
    };
    if (root.opener) {
      var hello = function () { try { root.opener.postMessage({ __hacauk: deckId, type: 'hello' }, '*'); } catch (e) {} };
      hello(); setInterval(hello, 2500);
    }
  }
  function paintSpeakerClock(e, p) {
    if (!speakerEls) return;
    speakerEls.elapsed.textContent = mmss(e);
    speakerEls.paceV.textContent = p.label; speakerEls.pace.setAttribute('data-state', p.state);
  }
  function paintSpeaker() {
    if (!speakerEls) return;
    var s = slides[index], n = slides[index + 1];
    speakerEls.count.textContent = (index + 1) + ' / ' + total + (s.steps ? '  ·  step ' + step + '/' + s.steps : '');
    speakerEls.title.textContent = s.title + (s.minutes ? '  ·  ' + s.minutes + ' min' : '');
    speakerEls.notes.innerHTML = s.notes || '<p>No notes for this slide.</p>';
    var prompts = $$('.prompt', s.el).map(function (c) { return Fx.promptText(c); }).filter(Boolean);
    speakerEls.promptsWrap.style.display = prompts.length ? '' : 'none';
    speakerEls.prompts.innerHTML = prompts.map(function (t) { return '<p class="sp-prompt">' + esc(t).replace(/\n/g, '<br>') + '</p>'; }).join('');
    speakerEls.next.innerHTML = '';
    if (n) speakerEls.next.appendChild(buildThumb(n, 'div'));
    else speakerEls.next.appendChild(el('p', 'sp-keys', 'End of deck.'));
  }

  /* ------------------------------------------------------------------ prompt sheet */
  function buildSheet() {
    var page = el('main', 'sheet');
    var brand = el('a', 'brandmark sheet-brand'); brand.href = homeHref; brand.innerHTML = 'H<small>ac</small>AUK';
    page.appendChild(brand);
    page.appendChild(el('h1', '', esc(deckTitle)));
    page.appendChild(el('p', 'sheet-sub', 'Every prompt from the session · tap Copy'));
    var count = 0;
    slides.forEach(function (s) {
      var cards = $$('.prompt', s.el).filter(function (c) { return !c.hasAttribute('data-nosheet') && Fx.promptText(c); });
      if (!cards.length) return;
      var item = el('section', 'sheet-item');
      item.appendChild(el('h2', '', esc(s.title) + ' <span>slide ' + (s.i + 1) + '</span>'));
      cards.forEach(function (card) {
        var label = $('.prompt-label', card);
        var box = el('div', 'prompt');
        box.appendChild(el('div', 'prompt-bar', '<span class="prompt-label">' +
          esc(label ? label.textContent.trim() : (card.getAttribute('data-label') || 'Prompt')) +
          '</span><button class="prompt-copy" type="button">Copy</button>'));
        var text = el('p', 'prompt-text');
        text.dataset.copy = Fx.promptText(card);
        Fx.fill(text, text.dataset.copy);
        box.appendChild(text); item.appendChild(box); count++;
      });
      var links = $$('a.launch[href]', s.el);
      if (links.length) {
        var row = el('div', 'sheet-links');
        links.forEach(function (a) {
          var l = el('a', 'launch', esc((a.getAttribute('data-name') || a.textContent).trim()));
          l.href = a.href; l.target = '_blank'; l.rel = 'noopener'; row.appendChild(l);
        });
        item.appendChild(row);
      }
      page.appendChild(item);
    });
    if (!count) page.appendChild(el('p', '', 'This deck has no prompts yet.'));
    body.appendChild(page);
    doc.title = 'Prompts — ' + deckTitle;
  }

  /* ------------------------------------------------------------------ actions + input */
  function fullscreen() {
    var d = doc.documentElement;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else { var req = d.requestFullscreen || d.webkitRequestFullscreen; if (req) { var p = req.call(d); if (p && p.catch) p.catch(function () { toast('Fullscreen was blocked by the browser'); }); } }
  }
  function openDemo(nth) {
    var s = slides[index]; if (!s) return;
    var links = $$('a.launch[href]', s.el);
    var visible = links.filter(function (a) { var h = a.closest('[data-step]'); return !h || h.classList.contains('is-shown'); });
    var a = (visible.length ? visible : links)[nth || 0] || (visible.length ? visible : links)[0];
    if (!a) return toast('No live demo on this slide');
    root.open(a.href, '_blank', 'noopener');
  }
  var copyTurn = { slide: -1, n: 0 };
  function copyPrompt() {
    var s = slides[index]; if (!s) return;
    var cards = Fx.visiblePrompts(s.el);
    if (!cards.length) return toast('No prompt on screen');
    // a slide can carry a prompt and its follow-up: each press of C copies the next one
    if (copyTurn.slide !== index) copyTurn = { slide: index, n: 0 };
    var i = copyTurn.n % cards.length; copyTurn.n++;
    Fx.copy(Fx.promptText(cards[i])).then(function () {
      toast(cards.length > 1 ? 'Prompt ' + (i + 1) + ' of ' + cards.length + ' copied' : 'Prompt copied');
    }, function () { toast('Could not copy — select the text instead'); });
  }
  function timer(reset) {
    var s = slides[index]; if (!s) return;
    var cd = Fx.activeCountdown(s.el);
    if (!cd) return toast('No timer on this slide');
    reset ? cd.reset() : cd.toggle();
  }
  function setCalm(v) {
    calm = v; body.classList.toggle('motion-calm', calm); body.classList.toggle('motion-full', !calm);
    try { sessionStorage.setItem('hacauk:motion', calm ? 'calm' : 'full'); } catch (e) {}
  }
  function act(name) {
    switch (name) {
      case 'next': next(); break;
      case 'prev': prev(); break;
      case 'overview': body.classList.contains('is-overview') ? closeOverview() : openOverview(); break;
      case 'speaker': openSpeaker(); break;
      case 'fullscreen': fullscreen(); break;
      case 'help': body.classList.toggle('is-help'); break;
    }
  }

  var jump = '';
  doc.addEventListener('keydown', function (e) {
    if (MODE === 'sheet') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key, tgt = e.target;
    var onControl = tgt && tgt.closest && tgt.closest('a,button,input,textarea,select,[contenteditable]');
    if (body.classList.contains('is-help')) { body.classList.remove('is-help'); e.preventDefault(); return; }
    if (body.classList.contains('is-overview')) {
      if (k === 'Escape' || k === 'o' || k === 'O' || k === 'g' || k === 'G') { closeOverview(); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowDown' || k === 'ArrowUp') {
        var thumbs = $$('.thumb', overviewGrid), cur = thumbs.indexOf(doc.activeElement);
        if (cur < 0) cur = index;
        var cols = Math.max(1, Math.round(overviewGrid.clientWidth / (thumbs[0].offsetWidth + 22)));
        var nx = cur + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols);
        thumbs[clamp(nx, 0, thumbs.length - 1)].focus(); e.preventDefault();
      }
      return;
    }
    if (body.classList.contains('is-black')) { body.classList.remove('is-black'); e.preventDefault(); return; }
    if (/^[0-9]$/.test(k)) { jump += k; toast('Go to slide ' + jump + ' — press Enter', 1600); return; }
    if (k === 'Enter' && jump) { var n = parseInt(jump, 10); jump = ''; if (n >= 1 && n <= total) show(n - 1, 0, n - 1 >= index ? 1 : -1, { instant: true }); e.preventDefault(); return; }
    if (k !== 'Shift') jump = '';
    if ((k === ' ' || k === 'Enter') && onControl) return;      // let buttons and links work
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': show(0, 0, -1, { instant: true }); break;
      case 'End': show(total - 1, 0, 1, { instant: true }); break;
      case 'f': case 'F': fullscreen(); break;
      case 'o': case 'O': case 'g': case 'G': openOverview(); break;
      case 's': case 'S': openSpeaker(); break;
      case 'd': openDemo(0); break;
      case 'D': openDemo(1); break;
      case 'c': case 'C': copyPrompt(); break;
      case 't': case 'T': timer(false); break;
      case 'r': timer(true); break;
      case 'R': resetClock(); break;
      case 'b': case 'B': case '.': body.classList.add('is-black'); break;
      case 'm': case 'M': setCalm(!calm); toast(calm ? 'Calm motion' : 'Full motion'); break;
      case '?': case '/': case 'h': case 'H': body.classList.toggle('is-help'); break;
      default: return;
    }
    e.preventDefault();
  });

  // click anywhere that is not a control = next
  viewport.addEventListener('click', function (e) {
    if (e.target.closest('a,button,input,textarea,select,label,[data-interactive]')) return;
    if (root.getSelection && String(root.getSelection())) return;
    next();
  });
  doc.addEventListener('click', function (e) {
    if (!body.classList.contains('is-black')) return;
    body.classList.remove('is-black'); e.stopPropagation(); e.preventDefault();   // the click that wakes the screen should not also advance
  }, true);

  var touch = null;
  viewport.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  viewport.addEventListener('touchend', function (e) {
    if (!touch) return; var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { dx < 0 ? next() : prev(); e.preventDefault(); }
  });

  /* ------------------------------------------------------------------ boot */
  setCalm(calm);
  if (MODE === 'sheet') { buildSheet(); deckEl.classList.add('is-ready'); return; }
  if (MODE === 'speaker') buildSpeaker();
  fit();
  var m = /^#(\d+)(?:\.(\d+))?/.exec(location.hash);
  var startAt = m ? clamp(parseInt(m[1], 10) - 1, 0, total - 1) : 0;
  pendingStep = m && m[2] ? parseInt(m[2], 10) : 0;
  deckEl.classList.add('is-ready');
  applyWorld(slides[startAt], true);
  enter(slides[startAt], 150);
  changed({ silent: MODE !== 'speaker' });
  if (sysReduced && !motionPref) setTimeout(function () { toast('Reduced motion is on — press M for full motion', 4200); }, 900);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);

  root.HacAUKDeck = {
    next: next, prev: prev, go: function (n, s) { show(n, s || 0, n >= index ? 1 : -1, { instant: true }); },
    toast: toast, get index() { return index; }, get step() { return step; }, slides: slides
  };
})(window);

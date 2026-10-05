/* HacAUK fx — small self-contained slide behaviours:
   data-split (per-letter titles), data-type (typewriter), data-count (count-up),
   .countdown (activity timer), .prompt-copy (copy a prompt). */
(function (root) {
  'use strict';

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- per-letter split ---------- */
  function split(el) {
    if (el.__split) return;
    el.__split = true;
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var arc = parseFloat(el.getAttribute('data-arc') || '0');       // em the edges drop below the middle
    var lean = parseFloat(el.getAttribute('data-lean') || (arc ? '5' : '0')); // deg of rotation at the edges
    var total = label.replace(/\s/g, '').length;
    var ci = 0;

    function walk(node, out) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          n.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { out.appendChild(document.createTextNode(' ')); return; }
            var wd = document.createElement('span'); wd.className = 'wd';
            Array.from(part).forEach(function (c) {
              var ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c;
              ch.style.setProperty('--ci', ci);
              if (arc && total > 1) {
                var x = (ci / (total - 1)) * 2 - 1;
                ch.style.setProperty('--ty', (x * x * arc).toFixed(3) + 'em');
                ch.style.setProperty('--rz', (x * lean).toFixed(2) + 'deg');
              }
              ci++; wd.appendChild(ch);
            });
            out.appendChild(wd);
          });
        } else if (n.nodeType === 1) {
          var clone = n.cloneNode(false);
          if (n.childNodes.length) walk(n, clone);
          out.appendChild(clone);
        }
      });
    }
    var frag = document.createDocumentFragment();
    walk(el, frag);
    el.textContent = '';
    el.appendChild(frag);
    el.setAttribute('aria-label', label);
  }

  /* ---------- typewriter (keeps layout stable: untyped text stays in flow, hidden) ---------- */
  function prepType(el) {
    if (el.dataset.full != null) return;
    // keep deliberate line breaks (prompt cards use white-space: pre-line), collapse everything else
    el.dataset.full = el.textContent.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
    showFull(el);
  }
  /* write text into a node, wrapping [fill-in blanks] in <mark> so they stand out */
  function fill(node, text) {
    node.textContent = '';
    text.split(/(\[[^\]\n]+\])/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '[' && part.charAt(part.length - 1) === ']') {
        var m = document.createElement('mark'); m.textContent = part; node.appendChild(m);
      } else node.appendChild(document.createTextNode(part));
    });
  }
  function showFull(el) {
    cancelAnimationFrame(el.__raf);
    el.classList.remove('is-typing');
    el.textContent = '';
    var done = document.createElement('span'); done.className = 'type-done'; fill(done, el.dataset.full);
    el.appendChild(done);
  }
  function type(el, delay) {
    prepType(el);
    cancelAnimationFrame(el.__raf);
    var full = el.dataset.full, chars = Array.from(full);
    var speed = parseFloat(el.getAttribute('data-type')) || 0;           // ms per char; 0 = auto
    var dur = speed ? chars.length * speed : Math.max(450, Math.min(2400, chars.length * 20));
    el.textContent = '';
    var done = document.createElement('span'); done.className = 'type-done';
    var rest = document.createElement('span'); rest.className = 'type-rest'; rest.textContent = full;
    el.appendChild(done); el.appendChild(rest);
    el.classList.add('is-typing');
    var start = performance.now() + (delay || 0), last = -1;
    function tick(now) {
      var p = Math.max(0, Math.min(1, (now - start) / dur));
      var n = Math.floor(p * chars.length);
      if (n !== last) {
        last = n;
        fill(done, chars.slice(0, n).join(''));
        rest.textContent = chars.slice(n).join('');
      }
      if (p < 1) el.__raf = requestAnimationFrame(tick);
      else el.classList.remove('is-typing');
    }
    el.__raf = requestAnimationFrame(tick);
  }

  /* ---------- count-up ---------- */
  function count(el, delay) {
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    var dec = (String(el.getAttribute('data-count')).split('.')[1] || '').length;
    var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
    var dur = 1100, start = performance.now() + (delay || 0);
    cancelAnimationFrame(el.__raf);
    function tick(now) {
      var p = Math.max(0, Math.min(1, (now - start) / dur));
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + (to * e).toFixed(dec) + suf;
      if (p < 1) el.__raf = requestAnimationFrame(tick);
    }
    el.textContent = pre + (0).toFixed(dec) + suf;
    el.__raf = requestAnimationFrame(tick);
  }

  /* ---------- countdown ---------- */
  var audio = null;
  function chime() {
    try {
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      audio = audio || new AC();
      if (audio.state === 'suspended') audio.resume();
      var t0 = audio.currentTime;
      [[784, 0], [1046.5, 0.17], [1318.5, 0.34]].forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.7);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + n[1]); o.stop(t0 + n[1] + 0.75);
      });
    } catch (e) { /* sound is a nicety */ }
  }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function countdown(el) {
    if (el.__cd) return el.__cd;
    var total = parseFloat(el.getAttribute('data-seconds')) || 60;
    var R = 143, C = 2 * Math.PI * R;
    el.setAttribute('type', 'button');
    el.setAttribute('data-interactive', '');
    el.innerHTML =
      '<svg viewBox="0 0 300 300" aria-hidden="true"><circle class="cd-bg" cx="150" cy="150" r="' + R + '"/>' +
      '<circle class="cd-fg" cx="150" cy="150" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="0"/></svg>' +
      '<span class="cd-time">' + fmt(total) + '</span><span class="cd-hint">T to start</span>';
    var fg = el.querySelector('.cd-fg'), time = el.querySelector('.cd-time');
    var left = total, running = false, endAt = 0, timer = 0, silent = el.getAttribute('data-sound') === 'off';

    function paint() {
      time.textContent = fmt(left);
      fg.setAttribute('stroke-dashoffset', (C * (1 - left / total)).toFixed(2));
      el.classList.toggle('is-low', running && left <= Math.min(10, total / 3) && left > 0);
      el.setAttribute('aria-label', 'Timer, ' + fmt(left) + ' left. Press to ' + (running ? 'pause' : 'start') + '.');
    }
    function tick() {
      left = Math.max(0, (endAt - Date.now()) / 1000);
      paint();
      if (left <= 0) { stop(); el.classList.add('is-done'); if (!silent) chime(); }
    }
    function stop() { running = false; clearInterval(timer); el.classList.remove('is-running', 'is-low'); }
    var api = {
      start: function () {
        if (running) return;
        if (left <= 0) api.reset();
        running = true; endAt = Date.now() + left * 1000;
        el.classList.add('is-running'); el.classList.remove('is-done');
        if (!silent) { try { var AC = root.AudioContext || root.webkitAudioContext; audio = audio || (AC ? new AC() : null); if (audio && audio.state === 'suspended') audio.resume(); } catch (e) {} }
        timer = setInterval(tick, 100); tick();
      },
      pause: function () { if (!running) return; left = Math.max(0, (endAt - Date.now()) / 1000); stop(); paint(); },
      toggle: function () { running ? api.pause() : api.start(); },
      reset: function () { stop(); left = total; el.classList.remove('is-done'); paint(); },
      isRunning: function () { return running; }
    };
    el.addEventListener('click', function (e) { e.stopPropagation(); api.toggle(); });
    el.__cd = api; paint();
    return api;
  }

  /* the countdown that is currently visible on a slide (latest shown wins) */
  function activeCountdown(slideEl) {
    var all = $$('.countdown', slideEl).filter(function (c) {
      var holder = c.closest('[data-step]');
      return (!holder || holder.classList.contains('is-shown')) && c.offsetParent !== null;
    });
    return all.length ? countdown(all[all.length - 1]) : null;
  }

  /* ---------- copy ---------- */
  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text;
      ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    }
    if (navigator.clipboard && root.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }
  function promptText(card) {
    var t = card.querySelector('.prompt-text'); if (!t) return '';
    return (t.dataset.copy || t.dataset.full || t.textContent).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }
  /* prompt cards currently on screen, in reading order */
  function visiblePrompts(slideEl) {
    return $$('.prompt', slideEl).filter(function (c) {
      var holder = c.closest('[data-step]');
      return (!holder || holder.classList.contains('is-shown')) && c.offsetParent !== null &&
        getComputedStyle(c).visibility !== 'hidden' && !c.hasAttribute('data-nocopy');
    });
  }

  /* ---------- wiring ---------- */
  function stepOf(el) { var h = el.closest('[data-step]'); return h ? +h.getAttribute('data-step') : 0; }
  function delayOf(el) {
    var h = el.closest('[data-anim],[data-split]') || el;
    var d = parseFloat(getComputedStyle(h).getPropertyValue('--delay')) || 0;
    var b = parseFloat(getComputedStyle(h).getPropertyValue('--base')) || 0;
    return d + b;
  }
  function run(slideEl, fromStep, toStep, typeToo) {
    $$('[data-type]', slideEl).forEach(function (el) {
      var s = stepOf(el);
      if (s > toStep) return;
      if (s >= fromStep && typeToo) type(el, delayOf(el) + 150); else showFull(el);
    });
    $$('[data-count]', slideEl).forEach(function (el) {
      var s = stepOf(el);
      if (s >= fromStep && s <= toStep) count(el, delayOf(el));
    });
  }

  function init(scope) {
    $$('[data-split]', scope).forEach(split);
    $$('[data-type]', scope).forEach(prepType);
    $$('.countdown', scope).forEach(countdown);
  }

  document.addEventListener('deck:enter', function (e) {
    var d = e.detail || {};
    // arriving backwards shows every step at once: skip the typing, just show the text
    run(e.target, 0, d.step || 0, !d.back);
  });
  document.addEventListener('deck:step', function (e) {
    var d = e.detail || {};
    if (d.step > d.prev) run(e.target, d.prev + 1, d.step, true);
  });
  document.addEventListener('deck:leave', function (e) {
    $$('.countdown', e.target).forEach(function (c) { if (c.__cd) { c.__cd.pause(); if (c.classList.contains('is-done')) c.__cd.reset(); } });
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.prompt-copy');
    if (!btn) return;
    e.stopPropagation();
    var card = btn.closest('.prompt'); if (!card) return;
    copy(promptText(card)).then(function () {
      var old = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('is-done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('is-done'); }, 1400);
    }, function () { btn.textContent = 'Select + copy'; });
  });

  root.HacAUKFx = {
    init: init, split: split, type: type, showFull: showFull, fill: fill, count: count, countdown: countdown,
    activeCountdown: activeCountdown, visiblePrompts: visiblePrompts, promptText: promptText, copy: copy, chime: chime
  };
})(window);

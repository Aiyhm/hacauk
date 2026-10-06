/* HacAUK fx — small self-contained slide behaviours:
   data-split (per-letter titles), data-type (typewriter), data-count (count-up),
   .prompt-copy (copy a prompt). */
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
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.prompt-copy');
    if (!btn) return;
    e.stopPropagation();
    var card = btn.closest('.prompt'); if (!card) return;
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    copy(promptText(card)).then(function () {
      btn.textContent = 'Copied'; btn.classList.add('is-done');
      document.dispatchEvent(new CustomEvent('deck:copied', { detail: { ok: true } }));
      clearTimeout(btn.__t); btn.__t = setTimeout(function () { btn.textContent = old; btn.classList.remove('is-done'); }, 1600);
    }, function () {
      document.dispatchEvent(new CustomEvent('deck:copied', { detail: { ok: false } }));
    });
  });

  root.HacAUKFx = {
    init: init, split: split, type: type, showFull: showFull, fill: fill, count: count,
    visiblePrompts: visiblePrompts, promptText: promptText, copy: copy
  };
})(window);

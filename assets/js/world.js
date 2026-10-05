/* HacAUK world — the shared backdrop: sun, rays, orbits, sparkles, terrain, grid floor.
   Positions are driven by CSS custom properties on .world (see system.css). */
(function (root) {
  'use strict';

  // x, y in stage px (1920x1080), size px, twinkle delay s, tone
  var STARS = [
    [318, 232, 46, 0.0, 'amber'], [522, 322, 58, 1.4, 'amber'], [1562, 268, 70, 0.6, 'amber'],
    [1420, 344, 44, 2.2, 'amber'], [182, 520, 26, 3.1, 'cream'], [1748, 486, 30, 1.9, 'cream'],
    [742, 148, 22, 2.7, 'cream'], [1168, 124, 26, 0.9, 'amber'], [96, 300, 18, 3.6, 'amber'],
    [1838, 182, 20, 1.1, 'cream'], [640, 470, 16, 2.0, 'cream'], [1300, 520, 18, 3.3, 'amber']
  ];

  function stars() {
    return STARS.map(function (s) {
      return '<i class="spark w-star w-star--' + s[4] + '" style="left:' + s[0] + 'px;top:' + s[1] +
        'px;width:' + s[2] + 'px;animation-delay:' + s[3] + 's"></i>';
    }).join('');
  }

  var TERRAIN =
    '<svg viewBox="0 0 2880 1500" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="wt-far" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#2A2011"/><stop offset=".45" stop-color="#11100E"/><stop offset="1" stop-color="#05080F"/>' +
        '</linearGradient>' +
        '<linearGradient id="wt-near" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#0B0D14"/><stop offset="1" stop-color="#03050A"/>' +
        '</linearGradient>' +
        '<linearGradient id="wt-rim" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#F8AA0B" stop-opacity="0"/><stop offset=".3" stop-color="#F8AA0B" stop-opacity=".55"/>' +
          '<stop offset=".5" stop-color="#FFC53D" stop-opacity=".95"/><stop offset=".7" stop-color="#F8AA0B" stop-opacity=".55"/>' +
          '<stop offset="1" stop-color="#F8AA0B" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g class="wt-far">' +
        '<path fill="url(#wt-far)" d="M0 1500V712l120-34 96 22 132-58 84 36 108-18 96 62 132 30 120 58 150 24 132 40 168 18 102 12 110-10 150-26 138-36 120-18 126-64 114-28 96-52 132 34 150-44 144 30 158-22V1500Z"/>' +
        '<path fill="none" stroke="url(#wt-rim)" stroke-width="3" stroke-linejoin="round" d="M0 712l120-34 96 22 132-58 84 36 108-18 96 62 132 30 120 58 150 24 132 40 168 18 102 12 110-10 150-26 138-36 120-18 126-64 114-28 96-52 132 34 150-44 144 30 158-22"/>' +
      '</g>' +
      '<g class="wt-near">' +
        '<path fill="url(#wt-near)" d="M0 1500V818l156-36 120 26 114-34 126 46 108 30 114-4 96 44 162 28 180 36 204 22 198-4 204-20 176-32 120-30 102-34 96 12 108-52 138-22 162 24 196-34V1500Z"/>' +
        '<path fill="none" stroke="url(#wt-rim)" stroke-width="2" stroke-opacity=".7" stroke-linejoin="round" d="M0 818l156-36 120 26 114-34 126 46 108 30 114-4 96 44 162 28 180 36 204 22 198-4 204-20 176-32 120-30 102-34 96 12 108-52 138-22 162 24 196-34"/>' +
      '</g>' +
    '</svg>';

  var ORBITS =
    '<svg viewBox="-900 -420 1800 840" aria-hidden="true">' +
      '<ellipse class="wo-a" cx="0" cy="0" rx="840" ry="250" transform="rotate(-11)"/>' +
      '<ellipse class="wo-b" cx="0" cy="0" rx="690" ry="170" transform="rotate(13)"/>' +
    '</svg>';

  // the retro posters keep the rays in the sky: a stepped navy horizon sits in front of them
  var MESA =
    '<svg viewBox="0 0 2880 900" preserveAspectRatio="none" aria-hidden="true">' +
      '<path fill="#07112E" d="M0 80H600l40 50h270l40 50h230l40 50h440l40-50h230l40-50h270l40-50h600V900H0Z"/>' +
      '<path fill="none" stroke="#F8AA0B" stroke-width="5" stroke-linejoin="miter" d="M0 80H600l40 50h270l40 50h230l40 50h440l40-50h230l40-50h270l40-50h600"/>' +
      '<path fill="none" stroke="#F8AA0B" stroke-opacity=".45" stroke-width="3" d="M0 106H584l40 50h270l40 50h230l40 50h472l40-50h230l40-50h270l40-50h584"/>' +
    '</svg>';

  function markup() {
    return '' +
      '<div class="w-sky"></div>' +
      '<div class="w-anchor">' +
        '<div class="w-glow"></div>' +
        '<div class="w-rays"><i></i></div>' +
        '<div class="w-orbits">' + ORBITS + '</div>' +
        '<div class="w-sun"><i></i></div>' +
      '</div>' +
      '<div class="w-stars">' + stars() + '</div>' +
      '<div class="w-terrain">' + TERRAIN + '</div>' +
      '<div class="w-mesa">' + MESA + '</div>' +
      '<div class="w-floor"><div class="w-floor-plane"></div></div>' +
      '<div class="w-dim"></div>';
  }

  /* Apply a scene to a .world element. sun = {x, y, s} in stage px. */
  function apply(worldEl, scene, sun, instant) {
    if (!worldEl) return;
    if (instant) worldEl.classList.add('is-instant');
    worldEl.setAttribute('data-scene', scene || 'night');
    if (sun) {
      worldEl.style.setProperty('--sun-x', sun.x + 'px');
      worldEl.style.setProperty('--sun-y', sun.y + 'px');
      worldEl.style.setProperty('--sun-s', sun.s);
    }
    if (instant) {
      void worldEl.offsetWidth; // flush so the jump is not animated
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { worldEl.classList.remove('is-instant'); });
      });
    }
  }

  var DEFAULT_SUN = {
    night: { x: 960, y: 640, s: 1 },
    burst: { x: 960, y: 430, s: 0.32 },
    dusk: { x: 960, y: 860, s: 1.25 },
    void: { x: 960, y: 1180, s: 1.5 }
  };

  function parseSun(str, scene) {
    var d = DEFAULT_SUN[scene] || DEFAULT_SUN.night;
    if (!str) return { x: d.x, y: d.y, s: d.s };
    var p = String(str).split(',').map(function (n) { return parseFloat(n); });
    return {
      x: isFinite(p[0]) ? p[0] : d.x,
      y: isFinite(p[1]) ? p[1] : d.y,
      s: isFinite(p[2]) ? p[2] : d.s
    };
  }

  root.HacAUKWorld = { markup: markup, apply: apply, parseSun: parseSun };
})(window);

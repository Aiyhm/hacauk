(function () {
  'use strict';

  var ROUNDS = 5;

  // `ai` is the letter of the AI generated file: images/pair-NN-a.webp or -b.webp.
  var PAIRS = [
    { id: '01', subject: 'mountain lake', ai: 'b' },
    { id: '02', subject: 'toy figure on pavement', ai: 'a' },
    { id: '03', subject: 'golden dog running', ai: 'a' },
    { id: '04', subject: 'Rome', ai: 'b' },
    { id: '05', subject: 'messy bedroom', ai: 'b' },
    { id: '06', subject: 'scorpion', ai: 'a' },
    { id: '07', subject: 'New York street', ai: 'a' },
    { id: '08', subject: 'rainy window', ai: 'b' },
    { id: '09', subject: 'empty classroom', ai: 'a' },
    { id: '10', subject: 'car on a road', ai: 'b' }
  ];

  var RATINGS = [
    'The AI fooled you.',
    'The AI fooled you.',
    'Getting warmer.',
    'Good eye.',
    'Sharp eye.',
    'Perfect. Nothing gets past you.'
  ];

  // Block letters for the arcade lettering: only the characters the quiz prints.
  var GLYPHS = {
    A: ['..####..', '.######.', '###..###', '###..###', '########', '########', '###..###', '###..###', '###..###'],
    C: ['.#######', '########', '###.....', '###.....', '###.....', '###.....', '###.....', '########', '.#######'],
    E: ['########', '########', '###.....', '###.....', '#######.', '#######.', '###.....', '########', '########'],
    H: ['###..###', '###..###', '###..###', '###..###', '########', '########', '###..###', '###..###', '###..###'],
    I: ['####', '####', '####', '####', '####', '####', '####', '####', '####'],
    L: ['###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '########', '########'],
    M: ['###...###', '####.####', '#########', '#########', '###.#.###', '###.#.###', '###...###', '###...###', '###...###'],
    N: ['###..###', '####.###', '########', '########', '########', '###.####', '###..###', '###..###', '###..###'],
    O: ['.######.', '########', '###..###', '###..###', '###..###', '###..###', '###..###', '########', '.######.'],
    R: ['#######.', '########', '###..###', '###..###', '#######.', '#######.', '###.###.', '###..###', '###..###'],
    S: ['.#######', '########', '###.....', '#######.', '.#######', '.....###', '.....###', '########', '#######.'],
    T: ['########', '########', '..####..', '..####..', '..####..', '..####..', '..####..', '..####..', '..####..'],
    W: ['###...###', '###...###', '###.#.###', '###.#.###', '###.#.###', '#########', '#########', '####.####', '###...###'],
    0: ['.######.', '########', '###..###', '###..###', '###..###', '###..###', '###..###', '########', '.######.'],
    1: ['..####..', '.#####..', '######..', '..####..', '..####..', '..####..', '..####..', '########', '########'],
    2: ['.######.', '########', '###..###', '....####', '...####.', '..####..', '.####...', '########', '########'],
    3: ['#######.', '########', '.....###', '.....###', '.#######', '.#######', '.....###', '########', '#######.'],
    4: ['###..###', '###..###', '###..###', '###..###', '########', '########', '.....###', '.....###', '.....###'],
    5: ['########', '########', '###.....', '#######.', '########', '.....###', '.....###', '########', '#######.'],
    '/': ['......###.', '......###.', '.....###..', '.....###..', '....###...', '...###....', '...###....', '..###.....', '..###.....'],
    '!': ['####', '####', '####', '####', '####', '####', '....', '####', '####'],
    '?': ['.######.', '########', '###..###', '....####', '...####.', '...###..', '........', '...###..', '...###..']
  };
  var CELL = 10;
  var LINE_GAP = 1.6; // in cells, between stacked lines
  var TONES = {
    cream: { face: '#f8e8c3', depth: '#f5ab15', dots: 'rgba(185,116,12,.55)' },
    gold: { face: '#ffb317', depth: '#b9740c', dots: 'rgba(2,8,17,.3)' }
  };

  var $ = function (id) { return document.getElementById(id); };
  var screens = { start: $('start'), quiz: $('quiz'), result: $('result') };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var pixelId = 0;

  var deck = [];    // pairs not yet played, so the next player gets new pictures first
  var game = [];    // this game's pairs
  var results = []; // true or false for each answered pair
  var round = 0;

  // Arcade sounds, synthesized so there are no audio files to load.
  var audio = null;

  function getAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audio) audio = new Ctx();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function tone(freq, delay, length, type, volume) {
    var ctx = getAudio();
    if (!ctx) return;
    var at = ctx.currentTime + delay;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length);
  }

  var sounds = {
    tap: function () { tone(880, 0, 0.07, 'square', 0.12); },
    correct: function () {
      [523, 659, 784, 1047].forEach(function (freq, i) { tone(freq, 0.08 + i * 0.09, 0.16, 'square', 0.16); });
    },
    wrong: function () {
      [311, 233, 156].forEach(function (freq, i) { tone(freq, 0.08 + i * 0.14, 0.2, 'sawtooth', 0.14); });
    }
  };

  // Original background loop: bouncy jungle marimba, log drums and shaker.
  var STEP = 60 / 126 / 4; // sixteenth notes at 126 bpm
  var SWING = 0.018;
  var BARS = [
    { root: 45, notes: [[0, 69], [3, 72], [6, 76], [8, 74], [10, 72], [12, 69], [14, 67]] },
    { root: 41, notes: [[0, 65], [3, 69], [6, 72], [8, 74], [11, 72], [14, 69]] },
    { root: 43, notes: [[0, 67], [2, 71], [4, 74], [7, 79], [10, 76], [12, 74], [14, 71]] },
    { root: 40, notes: [[0, 71], [3, 67], [6, 64], [8, 67], [10, 71], [12, 74], [15, 76]] },
    { root: 48, notes: [[0, 79], [2, 76], [4, 72], [6, 76], [8, 79], [11, 81], [14, 79]] },
    { root: 43, notes: [[0, 74], [2, 71], [4, 67], [6, 71], [8, 74], [11, 76], [14, 74]] },
    { root: 41, notes: [[0, 72], [2, 69], [4, 65], [6, 69], [8, 72], [10, 74], [12, 76], [14, 77]] },
    { root: 40, notes: [[0, 76], [4, 71], [6, 68], [8, 71], [10, 74], [12, 76]] }
  ];
  var BASS_STEPS = { 0: 0, 3: 0, 6: 7, 8: 0, 11: 0, 14: 7 };
  var DRUM_STEPS = { 0: 95, 6: 95, 8: 140, 12: 95, 14: 140 };

  var musicOn = true;
  var musicStarted = false;
  var musicBus = null;
  var musicTimer = null;
  var noise = null;
  var nextStepAt = 0;
  var stepIndex = 0;

  function midi(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function musicTone(freq, at, length, type, volume, endFreq) {
    var ctx = audio;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain);
    gain.connect(musicBus);
    osc.start(at);
    osc.stop(at + length);
  }

  function shaker(at, volume) {
    var src = audio.createBufferSource();
    var filter = audio.createBiquadFilter();
    var gain = audio.createGain();
    src.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    src.start(at);
    src.stop(at + 0.05);
  }

  function playStep(index, at) {
    var bar = BARS[Math.floor(index / 16) % BARS.length];
    var step = index % 16;
    bar.notes.forEach(function (note) {
      if (note[0] !== step) return;
      // A marimba: the note plus a quick bright overtone.
      musicTone(midi(note[1]), at, 0.28, 'sine', 0.3);
      musicTone(midi(note[1]) * 4, at, 0.06, 'sine', 0.07);
    });
    if (step in BASS_STEPS) musicTone(midi(bar.root + BASS_STEPS[step]), at, 0.17, 'triangle', 0.32);
    if (step in DRUM_STEPS) musicTone(DRUM_STEPS[step] * 1.8, at, 0.15, 'sine', 0.32, DRUM_STEPS[step]);
    if (step % 2 === 0) shaker(at, step % 4 === 2 ? 0.1 : 0.05);
  }

  function scheduleMusic() {
    var now = audio.currentTime;
    // After the page has been in the background, carry on from now, not from the backlog.
    if (nextStepAt < now) nextStepAt = now + 0.05;
    while (nextStepAt < now + 0.2) {
      playStep(stepIndex, nextStepAt + (stepIndex % 2 ? SWING : 0));
      nextStepAt += STEP;
      stepIndex = (stepIndex + 1) % (BARS.length * 16);
    }
  }

  function startMusic() {
    var ctx = getAudio();
    if (!ctx || musicTimer) return;
    if (!musicBus) {
      musicBus = ctx.createGain();
      musicBus.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      var samples = noise.getChannelData(0);
      for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.5, ctx.currentTime);
    nextStepAt = ctx.currentTime + 0.05;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 40);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
    // Silences notes that were already scheduled ahead.
    if (musicBus) musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.02);
  }

  function renderMusicButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.music-toggle'), function (button) {
      button.textContent = 'Music: ' + (musicOn ? 'on' : 'off');
      button.setAttribute('aria-pressed', String(musicOn));
    });
  }

  function isMusicButton(target) {
    return target.closest && target.closest('.music-toggle');
  }

  // Browsers only allow sound after a first tap, so the music starts with that tap.
  function firstTap(event) {
    if (musicStarted) return;
    musicStarted = true;
    if (musicOn && !isMusicButton(event.target)) startMusic();
  }

  // Every touch or mouse press anywhere on the page gives a blip straight away.
  document.addEventListener('pointerdown', function (event) {
    sounds.tap();
    firstTap(event);
  });
  // Keyboard presses arrive as clicks with no pointer behind them.
  document.addEventListener('click', function (event) {
    if (event.detail !== 0) return;
    sounds.tap();
    firstTap(event);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.music-toggle'), function (button) {
    button.addEventListener('click', function () {
      musicStarted = true;
      musicOn = !musicOn;
      if (musicOn) startMusic();
      else stopMusic();
      renderMusicButtons();
    });
  });
  renderMusicButtons();

  function svgEl(name, attrs) {
    var el = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }

  function lineWidth(text) {
    var cells = 0;
    text.split('').forEach(function (ch, i) {
      cells += ch === ' ' ? 4 : GLYPHS[ch][0].length;
      if (i < text.length - 1) cells += 1;
    });
    return cells;
  }

  // Draws lines of block text as an SVG: navy outline, gold depth, halftone cream face.
  function pixelArt(lines) {
    var widest = Math.max.apply(null, lines.map(function (l) { return lineWidth(l.text); }));
    var uid = 'px' + (++pixelId);
    var DEPTH = 7;
    var OUTLINE = 9;
    var pad = OUTLINE + 2;
    var totalH = lines.length * 9 * CELL + (lines.length - 1) * LINE_GAP * CELL;
    var svg = svgEl('svg', {
      'class': 'pixel', 'aria-hidden': 'true',
      viewBox: [-pad, -pad, widest * CELL + DEPTH + pad * 2, totalH + DEPTH + pad * 2].join(' ')
    });

    var defs = svgEl('defs');
    Object.keys(TONES).forEach(function (tone) {
      var pattern = svgEl('pattern', { id: uid + tone, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      pattern.appendChild(svgEl('circle', { cx: 2.5, cy: 2.5, r: 1.15, fill: TONES[tone].dots }));
      defs.appendChild(pattern);
    });
    var fade = svgEl('linearGradient', { id: uid + 'fade', x1: 0, x2: 0, y1: 0, y2: 1 });
    fade.appendChild(svgEl('stop', { offset: '.35', 'stop-color': '#000' }));
    fade.appendChild(svgEl('stop', { offset: '1', 'stop-color': '#fff' }));
    defs.appendChild(fade);
    svg.appendChild(defs);

    var paths = lines.map(function (line, n) {
      var y0 = n * (9 + LINE_GAP) * CELL;
      var x = (widest - lineWidth(line.text)) / 2 * CELL;
      var d = '';
      line.text.split('').forEach(function (ch) {
        if (ch === ' ') { x += 5 * CELL; return; }
        var rows = GLYPHS[ch];
        rows.forEach(function (row, r) {
          var runs = row.match(/#+/g) || [];
          var at = 0;
          runs.forEach(function (run) {
            var start = row.indexOf(run, at);
            at = start + run.length;
            // A little overlap between rows stops hairline seams when scaled.
            d += 'M' + (x + start * CELL) + ' ' + (y0 + r * CELL) + 'h' + run.length * CELL + 'v' + (CELL + (r < 8 ? 0.5 : 0)) + 'h-' + run.length * CELL + 'z';
          });
        });
        x += (rows[0].length + 1) * CELL;
      });
      return { d: d, tone: TONES[line.tone] ? line.tone : 'cream' };
    });

    var layer = function (attrs, dx, dy, d) {
      var p = svgEl('path', attrs);
      p.setAttribute('d', d);
      if (dx || dy) p.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
      svg.appendChild(p);
    };
    var k;
    paths.forEach(function (p) {
      for (k = DEPTH; k >= 0; k -= 1) layer({ fill: '#020811', stroke: '#020811', 'stroke-width': OUTLINE, 'stroke-linejoin': 'miter' }, k, k, p.d);
    });
    paths.forEach(function (p) {
      for (k = DEPTH; k >= 1; k -= 1) layer({ fill: TONES[p.tone].depth }, k, k, p.d);
    });
    paths.forEach(function (p) {
      layer({ fill: TONES[p.tone].face }, 0, 0, p.d);
      layer({ fill: 'url(#' + uid + p.tone + ')' }, 0, 0, p.d);
    });
    return svg;
  }

  function setPixel(el, lines) {
    el.textContent = '';
    if (lines) el.appendChild(pixelArt(lines));
  }

  function src(pair, letter) {
    return 'images/pair-' + pair.id + '-' + letter + '.webp';
  }

  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function preload(pair) {
    ['a', 'b'].forEach(function (letter) { new Image().src = src(pair, letter); });
  }

  function show(name) {
    Object.keys(screens).forEach(function (key) { screens[key].hidden = key !== name; });
    window.scrollTo(0, 0);
  }

  function startGame() {
    if (deck.length < ROUNDS) deck = shuffled(PAIRS);
    game = deck.splice(0, ROUNDS);
    game.forEach(preload);
    results = [];
    round = 0;
    show('quiz');
    renderRound();
  }

  function score() {
    return results.filter(Boolean).length;
  }

  function renderProgress(active) {
    var bar = $('lamps');
    bar.textContent = '';
    for (var i = 0; i < ROUNDS; i++) {
      var seg = document.createElement('li');
      if (i < results.length) {
        seg.className = results[i] ? 'hit' : 'miss';
        seg.setAttribute('aria-label', 'Pair ' + (i + 1) + ': ' + (results[i] ? 'correct' : 'wrong'));
        if (!results[i]) seg.textContent = '×';
      } else {
        seg.className = active && i === round ? 'now' : '';
        seg.setAttribute('aria-label', 'Pair ' + (i + 1));
      }
      bar.appendChild(seg);
    }
    $('score-now').textContent = String(score());
  }

  function renderRound() {
    var pair = game[round];
    var pictures = $('pictures');
    pictures.textContent = '';

    shuffled(['a', 'b']).forEach(function (letter, position) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pic';
      button.dataset.letter = letter;

      var head = document.createElement('span');
      head.className = 'pic-head';
      head.textContent = 'Picture ' + (position === 0 ? 'A' : 'B');
      button.appendChild(head);

      var view = document.createElement('span');
      view.className = 'pic-view';
      var img = document.createElement('img');
      img.src = src(pair, letter);
      img.alt = 'Picture ' + (position === 0 ? 'A' : 'B') + ': ' + pair.subject;
      img.width = 1000;
      img.height = 667;
      view.appendChild(img);
      button.appendChild(view);

      button.addEventListener('click', function () { answer(letter); });
      pictures.appendChild(button);
    });

    $('round-label').textContent = 'Pair ' + (round + 1) + '/' + ROUNDS;
    $('verdict').className = 'verdict';
    setPixel($('verdict-main'));
    $('verdict-main').removeAttribute('aria-label');
    $('verdict-sub').textContent = 'Tap the picture you think is AI.';
    $('next').hidden = true;
    renderProgress(true);
    $('prompt').focus({ preventScroll: true });
  }

  function answer(letter) {
    var pair = game[round];
    var correct = letter === pair.ai;
    results.push(correct);
    (correct ? sounds.correct : sounds.wrong)();

    Array.prototype.forEach.call($('pictures').children, function (button) {
      var isAi = button.dataset.letter === pair.ai;
      button.disabled = true;
      button.classList.add(isAi ? 'is-ai' : 'is-real');
      button.querySelector('.pic-head').textContent = isAi ? 'AI generated' : 'Real photo';
      button.querySelector('img').alt += isAi ? ' (AI generated)' : ' (real photo)';

      if (button.dataset.letter === letter) {
        var pick = document.createElement('span');
        pick.className = 'pick';
        pick.textContent = 'Your pick';
        button.querySelector('.pic-view').appendChild(pick);
      }
    });

    $('verdict').className = 'verdict answered' + (correct ? '' : ' wrong');
    var headline = correct ? 'CORRECT!' : 'NOT THIS TIME!';
    setPixel($('verdict-main'), [{ text: headline, tone: correct ? 'gold' : 'cream' }]);
    $('verdict-main').setAttribute('aria-label', headline);
    $('verdict-sub').textContent = correct ? 'You got it. That one is AI generated.' : 'You picked the real photo.';

    $('next-label').textContent = round === ROUNDS - 1 ? 'See my score' : 'Next pair';
    $('next').hidden = false;
    $('next').focus({ preventScroll: true });

    round++;
    renderProgress(false);
  }

  function renderResult() {
    var total = score();
    var final = $('final');
    final.setAttribute('aria-label', 'Your score: ' + total + ' out of ' + ROUNDS);
    $('rating').textContent = '> ' + RATINGS[total];

    var review = $('review');
    review.textContent = '';
    game.forEach(function (pair, i) {
      var item = document.createElement('li');
      item.className = results[i] ? 'hit' : 'miss';
      item.style.animationDelay = (i * 0.07) + 's';

      var label = document.createElement('span');
      label.textContent = results[i] ? 'Spotted' : 'Missed';
      item.appendChild(label);

      var img = document.createElement('img');
      img.src = src(pair, pair.ai);
      img.alt = 'The AI generated ' + pair.subject + ' picture';
      item.appendChild(img);
      review.appendChild(item);
    });

    show('result');
    final.focus({ preventScroll: true });
    countUp(final, total);
  }

  var countTimer = null;

  function countUp(el, total) {
    var value = 0;
    var write = function () { setPixel(el, [{ text: value + '/' + ROUNDS, tone: 'cream' }]); };
    clearInterval(countTimer);
    if (reducedMotion) {
      value = total;
      write();
      return;
    }
    write();
    countTimer = setInterval(function () {
      if (value >= total) { clearInterval(countTimer); return; }
      value++;
      write();
    }, 220);
  }

  // The floors: lines fan out from the horizon while cross lines rush forward.
  function buildGrid(svg) {
    var line = function (x1, y1, x2, y2) {
      var el = svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2 });
      svg.appendChild(el);
      return el;
    };
    for (var x = -2400; x <= 3600; x += 200) line(600, 0, x, 300);

    var DURATION = 4;
    var COUNT = 6;
    for (var i = 0; i < COUNT; i++) {
      var rung = line(0, 0, 1200, 0);
      ['y1', 'y2'].forEach(function (attr) {
        rung.appendChild(svgEl('animate', {
          attributeName: attr, values: '0;300', dur: DURATION + 's',
          begin: (-DURATION / COUNT * i) + 's', repeatCount: 'indefinite',
          calcMode: 'spline', keyTimes: '0;1', keySplines: '.75 0 1 .7'
        }));
      });
    }
    if (reducedMotion) {
      svg.setCurrentTime(2);
      svg.pauseAnimations();
    }
  }

  $('begin').addEventListener('click', startGame);
  $('again').addEventListener('click', startGame);
  $('restart').addEventListener('click', startGame);
  $('next').addEventListener('click', function () {
    if (round >= ROUNDS) renderResult();
    else renderRound();
  });

  setPixel($('title'), [{ text: 'AI OR', tone: 'cream' }, { text: 'REAL?', tone: 'gold' }]);
  setPixel($('prompt'), [{ text: 'WHICH IS AI?', tone: 'cream' }]);
  Array.prototype.forEach.call(document.querySelectorAll('.grid'), buildGrid);
  deck = shuffled(PAIRS);
})();

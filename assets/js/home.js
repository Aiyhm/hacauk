/* HacAUK library page: paints the backdrop and lists the decks from decks.js. */
(function () {
  'use strict';

  var world = document.querySelector('.home .world');
  var stage = document.querySelector('.home-stage');
  if (world && window.HacAUKWorld) world.innerHTML = window.HacAUKWorld.markup();

  function cover() {
    if (!stage) return;
    var s = Math.max(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--scale', s.toFixed(4));
  }
  cover();
  window.addEventListener('resize', function () { cover(); requestAnimationFrame(cover); });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ticket(d) {
    var card = el('article', 'ticket plaque');
    var inner = el('div', 'ticket-in');

    var coverBox = el('div', 'ticket-cover' + (d.cover ? '' : ' ticket-cover--none'));
    if (d.cover) {
      var img = el('img'); img.src = d.cover; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', function () { img.remove(); coverBox.classList.add('ticket-cover--none'); });
      coverBox.appendChild(img);
    }

    var body = el('div', 'ticket-body');
    if (d.kicker) body.appendChild(el('span', 'label ticket-kicker', d.kicker));
    body.appendChild(el('h2', 'ticket-title', d.title));
    var meta = el('ul', 'ticket-meta');
    [d.date, d.time, d.place].filter(Boolean).forEach(function (m) { meta.appendChild(el('li', '', m)); });
    if (meta.children.length) body.appendChild(meta);
    if (d.presenter) {
      var by = el('p', 'ticket-by', 'Presented by ');
      by.appendChild(el('b', '', d.presenter));
      body.appendChild(by);
    }
    var actions = el('div', 'ticket-actions');
    var go = el('a', 'launch launch--play', 'Present'); go.href = d.href;
    var sheet = el('a', 'launch launch--ghost', 'Prompt sheet'); sheet.href = d.href + '?view=prompts';
    actions.appendChild(go); actions.appendChild(sheet);
    body.appendChild(actions);

    var stub = el('div', 'ticket-stub');
    if (d.slides) { stub.appendChild(el('b', '', String(d.slides))); stub.appendChild(el('span', '', 'slides')); }

    inner.appendChild(coverBox); inner.appendChild(body);
    if (stub.children.length) inner.appendChild(stub);
    card.appendChild(inner);
    return card;
  }

  var list = document.getElementById('decks');
  var decks = window.HACAUK_DECKS || [];
  if (list) {
    if (!decks.length) list.appendChild(el('p', 'shelf-empty', 'No decks yet. Add one in assets/js/decks.js.'));
    decks.forEach(function (d) { if (d && d.title && d.href) list.appendChild(ticket(d)); });
  }
})();

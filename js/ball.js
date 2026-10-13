/* The crystal ball overlay. Everything the crystal has to say is written inside the sphere, in the display face,
   wrapped around the glass: the invitation, suggestions drawn from the reader's own history, and the answers to
   a question. Click the sphere to take the suggestion or open the answer it is showing. Tarot cards lie around it. */
import { GOALS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';
import { createCrystal, curvedText } from './crystal.js';
import { esc } from './pages.js';
import { runeLayer } from './runes.js';

const TAROT = [
  'beef-wellington', 'ribeye-steak', 'beef-bourguignon', 'bulgogi', 'pot-roast',
  'strawberry-shortcake', 'black-forest-cake', 'matcha-mille-crepe-cake', 'new-york-cheesecake', 'chocolate-cake',
  'roast-chicken', 'chicken-pot-pie', 'butter-chicken', 'chicken-katsu-curry', 'chicken-noodle-soup',
  'grilled-salmon', 'fish-and-chips', 'miso-glazed-black-cod', 'whole-steamed-fish', 'baked-cod-with-herbs',
  'seafood-paella', 'mushroom-risotto', 'egg-fried-rice', 'bibimbap', 'jollof-rice',
  'tomato-basil-soup', 'french-onion-soup', 'pumpkin-soup', 'mushroom-cream-soup', 'minestrone',
  'sourdough-loaf', 'croissant', 'baguette', 'milk-bread', 'cinnamon-rolls',
  'dan-dan-noodles', 'udon-soup', 'shoyu-ramen', 'pad-thai', 'spaghetti-carbonara',
  'tonkatsu', 'char-siu', 'braised-pork-belly', 'barbecue-pork-ribs', 'pork-and-chive-dumplings',
  'rack-of-lamb', 'lamb-chops', 'lamb-curry', 'lamb-tagine', 'shepherds-pie'
];
/* how each of the six lies: [side, row, tilt]. Three a side: an outer card, an inner one stepped in and down, an outer one below. */
const HAND = [['l', 0, -12, 'out'], ['l', 1, 8, 'in'], ['l', 2, -6, 'out'], ['r', 0, 12, 'out'], ['r', 1, -8, 'in'], ['r', 2, 6, 'out']];
const DEFAULTS = ['chocolate cake', 'bodybuilding recipes', 'chicken', 'ramen', 'something with lemon', 'cheesecake', 'spicy'];
const pretty = (s) => String(s).replace(/-/g, ' ');

export function createBall(app) {
  const { rec } = app;
  const wrap = document.getElementById('ball');
  const scene = wrap.querySelector('.scene'), crystal = wrap.querySelector('.crystal'), textEl = wrap.querySelector('.ctext');
  const tarot = wrap.querySelector('.tarot');
  const form = wrap.querySelector('form'), input = wrap.querySelector('input'), reveal = wrap.querySelector('.reveal');
  const gl = createCrystal(wrap.querySelector('canvas'));
  const runes = document.createElement('div'); runes.className = 'crunes'; runes.setAttribute('aria-hidden', 'true'); scene.insertBefore(runes, scene.firstChild);
  let msgs = [], idx = -1, timer = 0, pending = 0, results = [];
  /* browsers without CSS 3D get the same words laid flat */
  if (!(window.CSS && CSS.supports && CSS.supports('transform-style', 'preserve-3d'))) textEl.classList.add('flat');

  function radius() { return crystal.getBoundingClientRect().width / 2 * 0.98; }
  function lay(m) {
    textEl.dataset.kind = m.kind;
    curvedText(textEl, m.text, radius());
    /* if the glyphs measured as nothing (fonts still loading, box not laid out yet) measure again on the next frame */
    const w = textEl.firstChild && textEl.firstChild.getBoundingClientRect().width;
    if (!w) requestAnimationFrame(() => { if (current() === m) curvedText(textEl, m.text, radius()); });
  }
  function paint(m) {
    textEl.classList.add('swap');
    setTimeout(() => { lay(m); textEl.classList.remove('swap'); }, 320);
  }
  /* the display face arrives after the first paint on a cold cache: lay the words out again in it */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (api.isOpen() && current()) lay(current()); });
  /* Phoenician letters popping and glowing around the sphere, never over the words inside it */
  const runeFx = runeLayer(runes, { every: 360, avoid: () => crystal.getBoundingClientRect() });
  function cycle() {
    clearTimeout(timer);
    if (!msgs.length) return;
    idx = (idx + 1) % msgs.length;
    paint(msgs[idx]);
    timer = setTimeout(cycle, msgs[idx].kind === 'info' ? 4200 : 3000);
  }
  function setMessages(list, keepIndex) {
    msgs = list; idx = keepIndex ? Math.min(idx, list.length - 1) : -1;
    cycle();
  }
  function current() { return msgs[idx] || null; }

  /* what the crystal proposes before you ask: tastes it has seen you linger on, your searches, your goal */
  function suggestions() {
    const out = [];
    const push = (s) => { s = pretty(s).trim(); if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s); };
    if (rec.goal) push(GOALS[rec.goal].label.toLowerCase() + ' plates');
    history.weightedReads().slice(0, 6).forEach((rd) => { const t = rd.tags || {}; if (t.flavors && t.flavors[0]) push(t.flavors[0]); if (t.dish) push(t.dish); if (t.cuisine && t.cuisine !== 'international') push(t.cuisine); });
    history.data.searches.slice(-4).reverse().forEach((s) => push(s.q));
    DEFAULTS.forEach(push);
    return out.slice(0, 7);
  }
  function idle(invite) {
    const list = [{ text: invite || 'Ask me anything', kind: 'ask' }];
    suggestions().forEach((s) => list.push({ text: s, kind: 'suggest', action: () => ask(s) }));
    results = [];
    setMessages(list);
  }
  /* Enter and Reveal do the same thing: find the dish and open it. Only when nothing matches, here or in the
     Wikibooks Cookbook, does the crystal keep the floor to say so. */
  async function ask(q) {
    q = (q || '').trim();
    if (!q) { input.focus(); return; }
    input.value = q;
    const id = ++pending;
    const local = rec.search(q);
    app.renderGoal && app.renderGoal();
    if (local.length) { results = local; app.reader.jumpTo(local[0], true); return; }
    results = [];
    setMessages([{ text: 'Searching the Wikibooks Cookbook', kind: 'info' }]);
    let live = null;
    if (navigator.onLine !== false) live = await wiki.searchRecipes(q, 6);
    if (id !== pending) return;
    if (live && live.length) {
      live.forEach((r) => history.cacheLive(r));
      rec.addToPool(live);
      const hits = rec.search(q);
      app.renderGoal && app.renderGoal();
      results = hits.length ? hits : live;
      app.reader.jumpTo(results[0], true);
      return;
    }
    nothing();
  }
  function nothing() {
    const list = [{ text: 'Nothing for that, my dood', kind: 'info' }];
    suggestions().forEach((s) => list.push({ text: s, kind: 'suggest', action: () => ask(s) }));
    results = [];
    setMessages(list);
    input.select();
  }
  function act() {
    const m = current();
    if (!m) return;
    if (m.action) m.action();
    else if (m.kind === 'ask') input.focus();
  }
  function dealTarot() {
    const deck = TAROT.filter((id) => app.byId(id)).sort(() => Math.random() - 0.5).slice(0, 6);
    tarot.innerHTML = deck.map((id, i) => {
      const r = app.byId(id);
      return '<button type="button" class="tcard" data-id="' + esc(id) + '" style="--r:' + HAND[i][2] + 'deg;--i:' + i + '" aria-label="' + esc(r.title) + '"><img src="assets/cards/' + esc(id) + '.webp" alt="' + esc(r.title) + '" loading="lazy"></button>';
    }).join('');
  }
  /* The hand lies either side of the sphere, measured from its real edges so a card never covers the sphere, whatever the
     screen: two staggered columns a side where there is room, a single column where there is not. */
  function placeTarot() {
    const cs = [...tarot.querySelectorAll('.tcard')];
    if (!cs.length) return;
    const sw = scene.clientWidth, d = crystal.offsetWidth;
    if (!sw || !d) return;
    const cw = cs[0].offsetWidth || 60, ch = cs[0].offsetHeight || cw * 1.45;
    const edge = (sw - d) / 2, gap = Math.max(6, d * 0.03);
    const two = edge - gap >= cw * 1.7;
    const rows = [0, (d - ch) / 2, d - ch];
    cs.forEach((c, i) => {
      const [side, row, tilt, col] = HAND[i];
      const inner = side === 'l' ? edge - gap - cw : sw - edge + gap;
      const step = two && col === 'out' ? cw * 0.78 : 0;
      let x = side === 'l' ? inner - step : inner + step;
      /* a tilted card reaches past its own box: keep the whole of it on the screen */
      const m = ch * Math.sin(Math.abs(tilt) * Math.PI / 180) / 2 + 3;
      x = Math.max(m, Math.min(sw - cw - m, x));
      c.style.setProperty('--x', x + 'px'); c.style.setProperty('--y', rows[row] + 'px');
    });
  }

  crystal.addEventListener('click', (e) => { if (e.target.closest('.x')) return; act(); });
  wrap.querySelector('.x').addEventListener('click', () => api.close());
  wrap.querySelector('.dim').addEventListener('click', () => api.close());
  tarot.addEventListener('click', (e) => { const c = e.target.closest('.tcard'); if (c) { const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r, true); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  reveal.addEventListener('click', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => e.stopPropagation());
  addEventListener('resize', () => { if (api.isOpen()) { placeTarot(); if (current()) lay(current()); } });

  const api = {
    open(invite) {
      input.value = '';
      dealTarot();
      wrap.hidden = false;
      placeTarot();
      document.body.classList.add('ball-open');
      requestAnimationFrame(() => wrap.classList.add('on'));
      gl && gl.start();
      runeFx.start();
      idle(invite);
      if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 650);
      app.setHash('crystal');
    },
    close() {
      if (wrap.hidden) return;
      wrap.classList.remove('on'); document.body.classList.remove('ball-open');
      clearTimeout(timer); gl && gl.stop();
      runeFx.stop();
      setTimeout(() => { wrap.hidden = true; }, 500);
      if (app.reader.active && app.reader.current) app.setHash('r/' + app.reader.current.recipe.id);
    },
    isOpen() { return !wrap.hidden; },
    ask
  };
  return api;
}

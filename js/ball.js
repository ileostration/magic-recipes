/* The crystal ball overlay. Everything the crystal has to say is written inside the sphere, in the display face,
   wrapped around the glass: the invitation, suggestions drawn from the reader's own history, and the answers to
   a question. Click the sphere to take the suggestion or open the answer it is showing. Tarot cards lie around it. */
import { GOALS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';
import { createCrystal, curvedText } from './crystal.js';
import { esc } from './pages.js';

const TAROT = ['beef-wellington', 'ribeye-steak', 'beef-bourguignon', 'bulgogi', 'pot-roast', 'strawberry-shortcake', 'black-forest-cake', 'matcha-mille-crepe-cake', 'new-york-cheesecake', 'chocolate-cake'];
const SPOTS = [ /* % of the scene box, like a loose hand of cards either side of the sphere */
  { x: 4, y: 8, r: -14 }, { x: 1, y: 44, r: -7 }, { x: 15, y: 26, r: 9 },
  { x: 80, y: 10, r: 12 }, { x: 84, y: 46, r: 6 }, { x: 69, y: 30, r: -10 }
];
const DEFAULTS = ['chocolate cake', 'bodybuilding recipes', 'chicken', 'ramen', 'something with lemon', 'cheesecake', 'spicy'];
const pretty = (s) => String(s).replace(/-/g, ' ');

export function createBall(app) {
  const { rec } = app;
  const wrap = document.getElementById('ball');
  const scene = wrap.querySelector('.scene'), crystal = wrap.querySelector('.crystal'), textEl = wrap.querySelector('.ctext');
  const tarot = wrap.querySelector('.tarot');
  const form = wrap.querySelector('form'), input = wrap.querySelector('input'), reveal = wrap.querySelector('.reveal');
  const gl = createCrystal(wrap.querySelector('canvas'));
  let msgs = [], idx = -1, timer = 0, pending = 0, results = [];

  function radius() { return crystal.getBoundingClientRect().width / 2 * 0.98; }
  function paint(m) {
    textEl.classList.add('swap');
    setTimeout(() => {
      textEl.dataset.kind = m.kind;
      curvedText(textEl, m.text, radius());
      textEl.classList.remove('swap');
    }, 320);
  }
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
  function answer(list, note) {
    results = list;
    const m = list.slice(0, 8).map((r) => ({ text: r.title, kind: 'result', action: () => app.reader.jumpTo(r) }));
    if (note) m.unshift({ text: note, kind: 'info' });
    if (!list.length) m.push({ text: 'Nothing for that. Try another craving', kind: 'info' });
    setMessages(m);
  }
  async function ask(q) {
    q = (q || '').trim();
    if (!q) return;
    input.value = q;
    const id = ++pending;
    const local = rec.search(q);
    let note = rec.goal && GOALS[rec.goal].words.test(q) ? GOALS[rec.goal].label + ' plates, about 500 kcal and 40 g protein' : (local.length ? '' : 'Searching the Wikibooks Cookbook');
    answer(local, note);
    if (navigator.onLine === false) return;
    const live = await wiki.searchRecipes(q, 6);
    if (id !== pending) return;
    if (!live) { if (!local.length) answer([], ''); return; }
    live.forEach((r) => history.cacheLive(r));
    rec.addToPool(live);
    answer(rec.search(q), '');
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
      const r = app.byId(id), s = SPOTS[i];
      return '<button type="button" class="tcard" data-id="' + esc(id) + '" style="--x:' + s.x + '%;--y:' + s.y + '%;--r:' + s.r + 'deg" aria-label="' + esc(r.title) + '"><img src="assets/cards/' + esc(id) + '.webp" alt="' + esc(r.title) + '" loading="lazy"></button>';
    }).join('');
  }

  crystal.addEventListener('click', (e) => { if (e.target.closest('.x')) return; act(); });
  wrap.querySelector('.x').addEventListener('click', () => api.close());
  wrap.querySelector('.dim').addEventListener('click', () => api.close());
  tarot.addEventListener('click', (e) => { const c = e.target.closest('.tcard'); if (c) { const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  reveal.addEventListener('click', (e) => { e.preventDefault(); const m = current(); if (results.length) { if (m && m.kind === 'result') m.action(); else app.reader.jumpTo(results[0]); } else ask(input.value); });
  input.addEventListener('keydown', (e) => e.stopPropagation());
  addEventListener('resize', () => { if (api.isOpen() && current()) curvedText(textEl, current().text, radius()); });

  const api = {
    open(invite) {
      input.value = '';
      dealTarot();
      wrap.hidden = false;
      document.body.classList.add('ball-open');
      requestAnimationFrame(() => wrap.classList.add('on'));
      gl && gl.start();
      idle(invite);
      app.setHash('crystal');
    },
    close() {
      if (wrap.hidden) return;
      wrap.classList.remove('on'); document.body.classList.remove('ball-open');
      clearTimeout(timer); gl && gl.stop();
      setTimeout(() => { wrap.hidden = true; }, 500);
      if (app.reader.active && app.reader.current) app.setHash('r/' + app.reader.current.recipe.id);
    },
    isOpen() { return !wrap.hidden; },
    ask
  };
  return api;
}

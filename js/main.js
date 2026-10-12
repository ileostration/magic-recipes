import recipes from '../data/recipes.js';
import { history } from './history.js';
import { Recommender } from './recommend.js';
import { createReader } from './reader.js';
import { createViews } from './views.js';
import { createBall } from './ball.js';
import { createLanding } from './landing.js';

const loader = window.__loader || { set() {}, done() {} };
loader.set(2);   /* the recipes are in */

const app = {
  recipes, history,
  rec: new Recommender(recipes.concat(history.liveRecipes()), history),
  byId(id) { return app.rec.all.find((r) => r.id === id); },
  meadow: null, landing: null, reader: null, views: null, ball: null, menu: null,
  setHash(h) { const want = '#' + h; if (location.hash !== want) window.history.replaceState(null, '', want); },
  /* scene two takes over: scene one is hidden and its meadow stops rendering entirely */
  openReader(r, fromLanding) {
    if (!r) { const got = app.rec.next() || app.rec.discover(); r = got && got.recipe; }
    if (!r) return;
    app.landing.hide();
    app.reader.open(r, !!fromLanding);
  },
  closeBook() {
    app.ball.close();
    app.views.closeAll();
    app.reader.close();
    app.landing.show(true);
    app.setHash('');
  }
};

/* meadow only when scene one is on screen */
try {
  const { createMeadow } = await import('./grass.js');
  app.meadow = createMeadow(document.getElementById('grass'));
} catch (e) { app.meadow = null; }
if (!app.meadow) document.body.classList.add('nogl');
loader.set(3);   /* the meadow is built */

app.reader = createReader(app);
app.views = createViews(app);
app.ball = createBall(app);
app.landing = createLanding(app);

/* the glass menu at the foot of the reader */
const menu = document.getElementById('menu');
app.menu = {
  refresh() {
    const n = history.bookmarks().length;
    menu.querySelector('.count').textContent = n ? String(n) : '';
    const v = app.views.open;
    menu.querySelector('[data-act="marks"]').classList.toggle('on', v === 'marks');
    menu.querySelector('[data-act="notes"]').classList.toggle('on', v === 'notes');
    menu.querySelector('[data-act="book"]').classList.toggle('on', !v);
    menu.querySelector('[data-act="wand"]').hidden = v !== 'marks';
    menu.querySelector('[data-act="wand"]').title = app.views.marksMode === 'cards' ? 'Show as a list' : 'Show as cards';
  }
};
menu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'marks') { app.views.open === 'marks' ? app.views.closeAll() : app.views.openMarks(); }
  else if (act === 'notes') { app.views.open === 'notes' ? app.views.closeAll() : app.views.openNotes(); }
  else if (act === 'orb') app.ball.open('');
  else if (act === 'wand') app.views.toggleMarksMode();
  else if (act === 'prev' || act === 'next') { const dir = act === 'next' ? 1 : -1; if (app.views.open) app.views.flip(dir); else dir > 0 ? app.reader.next() : app.reader.prev(); }
  else if (act === 'book') { app.ball.close(); app.views.closeAll(); }   /* back to where the reader was in the recipes */
});
app.menu.refresh();

document.getElementById('closer').addEventListener('click', () => app.closeBook());
function renderGoal() { document.getElementById('goal').hidden = !app.rec.goal; }
app.renderGoal = renderGoal;
document.getElementById('goal').addEventListener('click', () => { app.rec.setGoal(null); renderGoal(); });
renderGoal();

const panel = document.getElementById('credits');
document.getElementById('credits-btn').addEventListener('click', () => { panel.classList.add('on'); panel.setAttribute('aria-hidden', 'false'); });
document.getElementById('credits-close').addEventListener('click', () => { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); });
document.getElementById('forget').addEventListener('click', () => { history.clear(); app.rec.seed = null; app.rec.setGoal(null); app.rec.shown.clear(); renderGoal(); app.menu.refresh(); document.getElementById('forget').textContent = 'Forgotten'; });
panel.addEventListener('click', (e) => { if (e.target === panel) { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); } });

/* deep links: #r/<id> opens the reader straight away; anything else is the landing scene */
const m = /^#r\/(.+)$/.exec(location.hash);
const deep = m && app.byId(decodeURIComponent(m[1]));
if (deep) { app.landing.hide(); app.reader.open(deep, false); }
else app.landing.show(true);

/* the loading screen lifts only once the meadow has drawn with the book pressing on it and the display faces are in */
Promise.all([app.meadow && !deep ? app.meadow.ready : Promise.resolve(), document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => {
  loader.set(4);
  if (!deep) app.landing.settle();
  requestAnimationFrame(() => requestAnimationFrame(() => loader.done()));
});

window.__app = app;

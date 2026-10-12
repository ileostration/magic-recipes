import recipes from '../data/recipes.js';
import { createBook } from './book.js';
import { history } from './history.js';

let meadow = null;
try {
  const { createMeadow } = await import('./grass.js');
  meadow = createMeadow(document.getElementById('grass'));
} catch (e) { meadow = null; }
if (!meadow) document.body.classList.add('nogl');

const book = createBook({ recipes, meadow });

const panel = document.getElementById('credits');
document.getElementById('credits-btn').addEventListener('click', () => { panel.classList.add('on'); panel.setAttribute('aria-hidden', 'false'); });
document.getElementById('credits-close').addEventListener('click', () => { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); });
document.getElementById('forget').addEventListener('click', () => { history.clear(); book.rec.seed = null; book.rec.setGoal(null); book.rec.shown.clear(); document.getElementById('forget').textContent = 'Forgotten'; });
panel.addEventListener('click', (e) => { if (e.target === panel) { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); } });

/* handy for the console and for tests */
window.__book = book;

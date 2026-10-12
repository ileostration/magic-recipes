/* The Grimoire: a fixed pool of glass leaves whose faces are re-rendered on demand, so an endless stream of recipes
   fits in a finite book. Click sequence: closed -> float -> open (title page) -> read (spread fills the screen).
   The title page turns once to the first recipe. Within a recipe a flip turns one leaf; past the end of a recipe a
   cascade of leaves turns and the next recommendation lands on the new spread. Dwell time on each recipe feeds the
   recommender. Each recipe carries a photo page, its text, an estimated nutrition label and a page the reader can write on. */
import { Recommender, DWELL_MS, GOALS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';
import { createCrystal } from './crystal.js';

const NL = 18;            /* leaves in the pool */
const BASE = 2;           /* leaf a recipe's first text page sits on when the book is at rest (leaf 1 is the title) */
const CASCADE = 4;        /* leaves that turn between recipes */
const MAX_TEXT = 5;       /* text pages per recipe */
const GAP = 3;            /* px between stacked leaves */
const STAGGER = 110;      /* ms between leaves in a cascade */
const FLIP_MS = 1350;
const SUGGEST = ['bodybuilding recipes', 'chocolate cake', 'chicken', 'something with lemon', 'ramen', 'quick breakfast', 'spicy', 'italian', 'vegan bowl', 'cheesecake'];
const TAROT = ['beef-wellington', 'ribeye-steak', 'beef-bourguignon', 'bulgogi', 'pot-roast', 'strawberry-shortcake', 'black-forest-cake', 'matcha-mille-crepe-cake', 'new-york-cheesecake', 'chocolate-cake'];
const DV = { kcal: 2000, protein: 50, carbs: 275, fat: 78, fibre: 28, sugar: 50 };

export function createBook(opts) {
  const { recipes, meadow } = opts;
  const book = document.getElementById('book');
  const stage = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const closer = document.getElementById('closer');
  const photoBtn = document.getElementById('photo');
  const measure = document.getElementById('measure');
  const goalPill = document.getElementById('goal');
  const root = document.documentElement;
  const rec = new Recommender(recipes.concat(history.liveRecipes()), history);
  const byId = (id) => rec.all.find((x) => x.id === id);

  /* ---------- markup helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function frame() {
    let h = '<div class="frame"></div>';
    ['tl', 'tr', 'bl', 'br'].forEach((c) => { h += '<svg class="corner ' + c + '" viewBox="0 0 48 48" aria-hidden="true"><use href="#corner"/></svg>'; });
    return h;
  }
  const guards = () => ['tl', 'tr', 'bl', 'br'].map((c) => '<svg class="guard ' + c + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#guard"/></svg>').join('');
  const coverFace = () => '<div class="motif-band"></div>' + frame() + guards() + '<div class="in"><div class="cv">' +
    '<div class="cv-the">The</div><h1 class="cv-title gold">Grimoire<br>of<br>Delicacies</h1>' +
    '<svg class="div" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>';
  const titlePage = () => frame() + '<div class="in"><div class="tp">' +
    '<div class="the">The</div><h1 class="gold">Grimoire<br>of<br>Delicacies</h1>' +
    '<svg class="div" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<div class="vol">Volume I</div><div class="sub">Opens to what you crave</div>' +
    '<div class="turn">Turn the page</div></div></div>';
  const insideCover = () => frame() + '<div class="in"><div class="inside"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<div>Every reader’s copy opens to a different page. Linger on a recipe and the book learns what you like. Hurry past and it changes its mind.</div>' +
    '<div>Your reading history stays in this browser and nowhere else.</div></div></div>';
  const blankPage = () => frame() + '<div class="in"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div>';
  const fillerPage = () => frame() + '<div class="in"><div class="filler"><span class="rune-big">\u{10900}</span><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>';
  const bmBtn = (r) => '<button class="bm' + (history.isBookmarked(r.id) ? ' on' : '') + '" type="button" data-id="' + esc(r.id) + '" aria-pressed="' + history.isBookmarked(r.id) + '" aria-label="Bookmark ' + esc(r.title) + '"><svg viewBox="0 0 24 32" aria-hidden="true"><use href="#bookmark"/></svg></button>';

  function imagePage(r) {
    const im = r.image || {};
    const img = im.url ? '<img alt="' + esc(im.alt || r.title) + '" data-src="' + esc(im.url) + '">' : '';
    let credit = '';
    if (im.source === 'unsplash' && im.credit) credit = '<span class="cr">Photo: <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">' + esc(im.credit.name) + '</a> on <a href="' + esc(im.page) + '" target="_blank" rel="noopener">Unsplash</a></span>';
    else if (im.credit) credit = '<span class="cr">Photo: ' + esc(im.credit.artist) + ' · ' + esc(im.credit.license) + ' · <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">Commons</a></span>';
    else credit = '<span class="cr" data-credit></span>';
    return '<div class="in"><div class="ph" data-rid="' + esc(r.id) + '">' + img +
      '<div class="cap"><b>' + esc(r.title) + '</b><span>' + esc(r.origin || '') + '</span>' + credit + '</div></div>' + bmBtn(r) + '</div>';
  }
  function sourceLine(r) {
    if (r.source === 'wikibooks') return '<div class="src">From the <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Wikibooks Cookbook</a>, text under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</div>';
    return '';
  }
  function nutritionPage(r) {
    const n = r.nutrition;
    const row = (k, label, unit) => n ? '<div class="nrow"><span>' + label + '</span><b>' + n[k] + (unit || 'g') + '</b><i>' + Math.round(n[k] / DV[k] * 100) + '%</i></div>' : '';
    const fit = n && GOALS.bodybuilding.fits(r);
    const body = n ? '<div class="label"><div class="lhead">Nutrition</div><div class="lsub">Estimated per serving · serves ' + n.servings + '</div>' +
      '<div class="kcal"><span>Calories</span><b>' + n.kcal + '</b></div>' +
      row('protein', 'Protein') + row('carbs', 'Carbohydrates') + row('sugar', 'of which sugars') + row('fat', 'Fat') + row('fibre', 'Fibre') +
      '<div class="lfoot">Percentages are of a 2,000 kcal day. Estimated from the ingredient list; real values vary with brands and portions.</div></div>' +
      (fit ? '<div class="fit">✦ Fits a bodybuilding plate: about ' + n.kcal + ' kcal with ' + n.protein + ' g protein</div>' : '') : '<div class="label"><div class="lhead">Nutrition</div><div class="lsub">No estimate for this recipe.</div></div>';
    return frame() + '<div class="in"><div class="np">' + body + '</div>' + bmBtn(r) + '</div>';
  }
  function notesPage(r) {
    return frame() + '<div class="in"><div class="notes"><h2 class="gold">Notes</h2><div class="nsub">Your own words, kept in this browser</div>' +
      '<textarea class="note" data-id="' + esc(r.id) + '" maxlength="' + history.NOTE_MAX + '" spellcheck="true" placeholder="What did you change? Who did you cook it for?">' + esc(history.note(r.id)) + '</textarea>' +
      '<div class="ncount"></div></div>' + bmBtn(r) + '</div>';
  }

  /* split a recipe into pages that fit the measuring box exactly like a real face */
  function paginate(r, n) {
    const pages = [imagePage(r)];
    const head = '<div class="no">Recipe No. ' + n + '</div><h2 class="gold' + (r.title.length > 26 ? ' long' : '') + '">' + esc(r.title) + '</h2>' +
      '<div class="meta">' + esc([r.serves, r.time].filter(Boolean).join(' · ')) + '</div>' + (r.intro ? '<p class="intro">' + esc(r.intro) + '</p>' : '');
    const blocks = [];
    blocks.push({ t: 'h', html: '<h3>Ingredients</h3>' });
    r.ingredients.forEach((i) => blocks.push({ t: 'ul', html: '<li>' + esc(i) + '</li>' }));
    blocks.push({ t: 'h', html: '<h3>Method</h3>' });
    r.steps.forEach((s, i) => blocks.push({ t: 'ol', html: '<li>' + esc(s) + '</li>', step: i }));
    const src = sourceLine(r);
    const text = [];
    let pageHtml = head, list = null, listHtml = '', stepStart = 0;
    const fits = (html) => { measure.innerHTML = '<div class="rp">' + html + '</div>'; const el = measure.firstChild; return el.scrollHeight <= el.clientHeight + 1; };
    const close = () => (list ? '<' + list + (list === 'ol' ? ' style="--start:' + stepStart + '"' : '') + '>' + listHtml + '</' + list + '>' : '');
    const flush = (cont) => {
      text.push(frame() + '<div class="in"><div class="rp">' + pageHtml + close() + (cont ? '<div class="more">continued →</div>' : src) + '</div>' + bmBtn(r) + '</div>');
      pageHtml = ''; listHtml = '';
    };
    for (const b of blocks) {
      if (text.length >= MAX_TEXT - 1) { /* last page must take everything left */ }
      let next = pageHtml, nList = list, nListHtml = listHtml;
      if (b.t === 'h') { next += close(); nList = null; nListHtml = ''; next += b.html; }
      else { if (list !== b.t) { next += close(); nList = b.t; nListHtml = ''; if (b.t === 'ol') stepStart = b.step; } nListHtml += b.html; }
      const probe = next + (nList ? '<' + nList + '>' + nListHtml + '</' + nList + '>' : '') + '<div class="more">x</div>';
      if (fits(probe) || (!listHtml && !pageHtml) || text.length >= MAX_TEXT - 1) { pageHtml = next; list = nList; listHtml = nListHtml; }
      else {
        let carried = '';
        if (!list && /<h3>[^<]*<\/h3>$/.test(pageHtml)) { carried = pageHtml.match(/<h3>[^<]*<\/h3>$/)[0]; pageHtml = pageHtml.slice(0, -carried.length); }
        flush(true);
        if (b.t === 'h') { pageHtml = b.html; list = null; listHtml = ''; }
        else { pageHtml = carried || (b.t === 'ol' ? '<h3>Method, continued</h3>' : '<h3>Ingredients, continued</h3>'); list = b.t; listHtml = b.html; if (b.t === 'ol') stepStart = b.step; }
      }
    }
    flush(false);
    measure.innerHTML = '';
    pages.push(...text, nutritionPage(r), notesPage(r));
    if (pages.length % 2 === 1) pages.push(fillerPage());
    return pages;
  }

  /* ---------- leaves ---------- */
  let html = '<div class="rear"><div class="motif-band"></div>' + frame() + guards() + '</div><div class="spine"></div><div class="edge-r"></div><div class="edge-b"></div><div class="edge-t"></div>';
  for (let i = 0; i < NL; i++) {
    html += '<div class="leaf' + (i === 0 ? ' cover-leaf' : '') + '" data-i="' + i + '"><div class="face front"></div><div class="face back"></div>' +
      (i === 0 ? '<div class="cedge r"></div><div class="cedge t"></div><div class="cedge b"></div>' : '') + '</div>';
  }
  html += '<div class="runes" id="runes" aria-hidden="true"></div>';
  book.innerHTML = html;
  const leaves = [...book.querySelectorAll('.leaf')];
  const faces = leaves.map((l) => ({ front: l.querySelector('.front'), back: l.querySelector('.back') }));
  const runesLayer = document.getElementById('runes');
  function setFace(i, side, h, cls) {
    const f = faces[i][side];
    if (f.dataset.key === h) return;
    f.dataset.key = h;
    f.className = 'face ' + side + (cls ? ' ' + cls : '');
    f.innerHTML = h;
  }
  function resetFaces() {
    setFace(0, 'front', coverFace(), 'cover');
    setFace(0, 'back', insideCover());
    setFace(1, 'front', titlePage());
    for (let i = 1; i < NL; i++) { if (i > 1) setFace(i, 'front', blankPage()); setFace(i, 'back', blankPage()); }
  }
  /* face sequence for a recipe whose first text page sits on leaf `at` (its photo on the back of leaf at-1) */
  function placePages(pages, at) {
    for (let k = 0; k < pages.length; k++) {
      const side = k % 2 === 0 ? 'back' : 'front';
      const idx = side === 'back' ? at - 1 + k / 2 : at + (k - 1) / 2;
      if (idx >= 0 && idx < NL) setFace(idx, side, pages[k]);
    }
  }

  /* ---------- state ---------- */
  let state = 'closed', cur = 0, busy = false;
  let current = null;        /* { recipe, pages, n } */
  const trail = [];
  let shownAt = 0, counter = 0, timer = 0;
  const log = [];
  const note = (m) => { log.push(m); if (log.length > 60) log.shift(); };

  /* ---------- sizing ---------- */
  function layout() {
    const vw = innerWidth, vh = innerHeight;
    const portrait = vw / vh < 0.95;
    document.body.classList.toggle('portrait', portrait);
    const H = 600;
    const P = Math.round(portrait ? 400 : Math.min(Math.max(H * vw / vh / 2, 380), 560));
    const fs = Math.min(P * (portrait ? 0.033 : 0.029), H * 0.0235);
    const wide = vw / vh >= 1.2;
    const sr = portrait ? Math.min(vw / P, vh / H) : wide ? Math.max(vw / (2 * P), vh / H) : vw / (2 * P);
    const s = root.style;
    s.setProperty('--P', P + 'px'); s.setProperty('--H', H + 'px'); s.setProperty('--fs', fs + 'px');
    s.setProperty('--sc', Math.min(vw * 0.6 / P, vh * 0.78 / H));
    s.setProperty('--sf', Math.min(vw * 0.56 / P, vh * 0.72 / H));
    s.setProperty('--so', Math.min(vw * 0.88 / (2 * P), vh * 0.72 / H));
    s.setProperty('--sr', sr);
    updateShift();
  }
  let showPhoto = false;
  function updateShift() {
    const portrait = document.body.classList.contains('portrait');
    const P = parseFloat(getComputedStyle(root).getPropertyValue('--P'));
    const sr = parseFloat(getComputedStyle(root).getPropertyValue('--sr'));
    const shift = portrait && state === 'read' ? (showPhoto ? P / 2 : -P / 2) * sr : 0;
    root.style.setProperty('--shift', shift + 'px');
    if (photoBtn) photoBtn.textContent = showPhoto ? 'Recipe' : 'Photo';
  }
  layout();
  addEventListener('resize', () => { layout(); if (current && state === 'read') rerenderCurrent(); });

  function say(t) {
    hint.classList.add('off');
    clearTimeout(say.t);
    if (!t) return;
    say.t = setTimeout(() => { hint.textContent = t; hint.classList.remove('off'); }, 280);
  }
  function describe() {
    if (state === 'closed') return 'Click the book';
    if (state === 'open') return 'Click the title page to begin';
    if (state === 'read' && current) {
      const sp = cur - BASE + 1, tot = current.pages.length / 2;
      return current.recipe.title + (tot > 1 ? ' · page ' + sp + ' of ' + tot : '') + ' · right to turn, left to go back';
    }
    return '';
  }
  function setState(s) {
    state = s;
    document.body.dataset.state = s;
    say(describe());
    book.setAttribute('aria-label', s === 'closed' ? 'The Grimoire of Delicacies. Activate to open.' : 'The Grimoire of Delicacies, open');
    if (meadow) { if (s === 'read') meadow.pause(); else meadow.resume(); }
    updateShift();
    renderGoal();
  }

  function update(prev) {
    const lo = Math.min(prev, cur), hi = Math.max(prev, cur);
    const many = hi - lo > 1;
    const order = [];
    for (let i = lo; i < hi; i++) order.push(i);
    if (cur < prev) order.reverse();
    leaves.forEach((lf) => { lf.style.transitionDelay = '0ms'; });
    if (many) order.forEach((i, k) => { leaves[i].style.transitionDelay = (k * STAGGER) + 'ms'; });
    leaves.forEach((lf, i) => {
      const flipped = i < cur;
      const z = flipped ? -(NL - i) * GAP : -i * GAP;
      lf.style.transform = 'translateZ(' + z + 'px) rotateY(' + (flipped ? -180 : 0) + 'deg)';
      lf.classList.toggle('near', i === cur || i === cur - 1);
    });
    loadImages();
    wireNotes();
  }
  function goto(n) { const p = cur; cur = n; update(p); }
  function lock(ms) { busy = true; clearTimeout(timer); timer = setTimeout(() => { busy = false; }, ms); }
  function snapTo(n) {
    book.classList.add('snap');
    cur = n;
    leaves.forEach((lf) => { lf.style.transitionDelay = '0ms'; });
    update(n);
    void book.offsetWidth;
    book.classList.remove('snap');
  }

  resetFaces();
  update(0);

  /* ---------- images ---------- */
  const imgCache = new Map();
  function loadImages() {
    [cur - 1, cur].forEach((i) => {
      if (i < 0 || i >= NL) return;
      ['back', 'front'].forEach((side) => {
        const ph = faces[i][side].querySelector('.ph');
        if (!ph || ph.dataset.loaded) return;
        ph.dataset.loaded = '1';
        const img = ph.querySelector('img');
        if (img) attachImage(img, ph);
        else {
          const r = byId(ph.dataset.rid);
          if (r && r.wiki) resolveImage(r).then((im) => { if (!im) return; r.image = im; ph.insertAdjacentHTML('afterbegin', '<img alt="' + esc(r.title) + '" data-src="' + esc(im.url) + '">'); attachImage(ph.querySelector('img'), ph); });
        }
      });
    });
  }
  function attachImage(img, ph) {
    img.onload = () => { img.classList.add('on'); creditFor(ph); };
    img.onerror = () => { img.remove(); };
    img.src = img.dataset.src;
    if (img.complete && img.naturalWidth) { img.style.transition = 'none'; img.classList.add('on'); creditFor(ph); }
  }
  async function resolveImage(r) {
    if (imgCache.has(r.wiki)) return imgCache.get(r.wiki);
    const p = wiki.imageForPage(r.wiki);
    imgCache.set(r.wiki, p);
    return p;
  }
  async function creditFor(ph) {
    const r = byId(ph.dataset.rid);
    const slot = ph.querySelector('[data-credit]');
    if (!r || !r.image || !slot) return;
    if (!r.image.credit && r.image.file) r.image.credit = await wiki.imageCredit(r.image.file);
    if (r.image.credit) slot.innerHTML = 'Photo: ' + esc(r.image.credit.artist) + ' · ' + esc(r.image.credit.license) + ' · <a href="' + esc(r.image.credit.link) + '" target="_blank" rel="noopener">Commons</a>';
  }

  /* ---------- notes ---------- */
  function wireNotes() {
    book.querySelectorAll('textarea.note:not([data-wired])').forEach((ta) => {
      ta.dataset.wired = '1';
      const count = ta.parentElement.querySelector('.ncount');
      const show = () => { count.textContent = ta.value.length + ' / ' + history.NOTE_MAX; };
      show();
      ta.addEventListener('input', () => { const v = history.setNote(ta.dataset.id, ta.value); if (v !== ta.value) ta.value = v; show(); });
      ['pointerdown', 'pointerup', 'click'].forEach((ev) => ta.addEventListener(ev, (e) => e.stopPropagation()));
    });
  }

  /* ---------- bookmarks ---------- */
  const stack = document.getElementById('stack');
  function renderStack() {
    const ids = history.bookmarks();
    const latest = ids.slice(-7).reverse();
    stack.classList.toggle('empty', !ids.length);
    stack.querySelector('.count').textContent = ids.length ? String(ids.length) : '';
    stack.querySelector('.cards').innerHTML = latest.map((id, i) => {
      const r = byId(id);
      if (!r) return '';
      const th = r.image && (r.image.thumb || r.image.url);
      return '<button type="button" class="card" data-id="' + esc(id) + '" style="--i:' + i + ';--n:' + latest.length + '" aria-label="Open ' + esc(r.title) + '">' +
        (th ? '<img src="' + esc(th) + '" alt="">' : '') + '<span>' + esc(r.title) + '</span></button>';
    }).join('');
  }
  function toggleBookmark(id) {
    const on = history.toggleBookmark(id);
    book.querySelectorAll('.bm[data-id="' + id + '"]').forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    renderStack();
    say(on ? 'Bookmarked' : 'Bookmark removed');
    return on;
  }
  stack.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c) { const r = byId(c.dataset.id); if (r) jumpTo(r); return; }
    if (e.target.closest('.all')) openMarksPanel();
  });
  const marks = document.getElementById('marks');
  function openMarksPanel() {
    const ids = history.bookmarks().slice().reverse();
    marks.querySelector('.list').innerHTML = ids.length ? ids.map((id) => { const r = byId(id); return r ? '<button type="button" data-id="' + esc(id) + '">' + esc(r.title) + '</button>' : ''; }).join('') : '<p>No bookmarks yet. Tap the ribbon in a page’s corner.</p>';
    marks.classList.add('on'); marks.setAttribute('aria-hidden', 'false');
  }
  marks.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) { marks.classList.remove('on'); const r = byId(b.dataset.id); if (r) jumpTo(r); }
    if (e.target === marks || e.target.closest('.close')) { marks.classList.remove('on'); marks.setAttribute('aria-hidden', 'true'); }
  });
  renderStack();

  /* ---------- goal ---------- */
  function renderGoal() {
    const g = rec.goal && GOALS[rec.goal];
    goalPill.hidden = !g || state === 'closed';
    if (g) goalPill.querySelector('span').textContent = g.label + ' plates';
  }
  goalPill.addEventListener('click', () => { rec.setGoal(null); renderGoal(); say('Showing every recipe again'); });

  /* ---------- runes: Phoenician letters drifting up from the margins ---------- */
  const RUNE_FROM = 0x10900, RUNE_TO = 0x1091B;
  let runeTimer = 0;
  function runeZone() {
    const z = Math.random();
    const open = state !== 'read';
    /* x,y as fractions of the full two-page spread (left page = 0..0.5) */
    if (open && z < 0.5) return { x: 0.05 + Math.random() * 0.4, y: 0.12 + Math.random() * 0.55 };          /* inside cover, mostly empty */
    if (z < 0.25) return { x: Math.random(), y: 0.005 + Math.random() * 0.045 };
    if (z < 0.5) return { x: Math.random(), y: 0.95 + Math.random() * 0.045 };
    if (z < 0.75) return { x: 0.004 + Math.random() * 0.04, y: Math.random() };
    return { x: 0.955 + Math.random() * 0.04, y: Math.random() };
  }
  function spawnRune() {
    if (document.hidden || runesLayer.childElementCount > 14) return;
    const el = document.createElement('span');
    el.textContent = String.fromCodePoint(RUNE_FROM + Math.floor(Math.random() * (RUNE_TO - RUNE_FROM + 1)));
    const z = runeZone();
    el.style.left = (z.x * 100) + '%'; el.style.top = (z.y * 100) + '%';
    el.style.fontSize = (0.9 + Math.random() * 1.1) + 'em';
    el.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
    el.addEventListener('animationend', () => el.remove());
    runesLayer.appendChild(el);
  }
  function startRunes() { clearInterval(runeTimer); runeTimer = setInterval(spawnRune, 520); }
  startRunes();

  /* ---------- recipes in and out of the book ---------- */
  function showRecipe(r, at) {
    counter++;
    const pages = paginate(r, counter);
    placePages(pages, at);
    history.noteSeen(r.id);
    return { recipe: r, pages, n: counter };
  }
  function rerenderCurrent() {
    current.pages = paginate(current.recipe, current.n);
    placePages(current.pages, BASE);
    const last = BASE + current.pages.length / 2 - 1;
    if (cur > last) snapTo(last);
    loadImages(); wireNotes();
  }
  function restAt(entry, spread) {
    resetFaces();
    current = entry;
    placePages(entry.pages, BASE);
    snapTo(BASE + (spread || 0));
    shownAt = performance.now();
    say(describe());
  }
  function firstRecipe() {
    const got = rec.next() || rec.discover();
    return got ? got.recipe : null;
  }
  function spreads(entry) { return entry.pages.length / 2; }
  function lastSpread() { return BASE + spreads(current) - 1; }

  /* title -> first recipe: one leaf turns */
  function startReading(r) {
    note('startReading busy=' + busy + ' state=' + state);
    if (busy || state !== 'open') return;
    r = r || firstRecipe();
    if (!r) return;
    lock(FLIP_MS + 100);
    const entry = showRecipe(r, BASE);
    current = entry;
    goto(BASE);
    setState('read');
    shownAt = performance.now();
    say(describe());
  }

  function next() {
    note('next busy=' + busy + ' cur=' + cur);
    if (busy || state !== 'read' || !current) return;
    if (cur < lastSpread()) { lock(700); goto(cur + 1); say(describe()); return; }
    const dwell = performance.now() - shownAt;
    rec.noteFlip(current.recipe, dwell);
    if (rec.wantsBall()) { ball.open('The pages blur past… what are you really hungry for?'); rec.quick = 0; return; }
    const got = rec.next();
    if (!got) { ball.open('The book has shown you all it knows about ' + (rec.seed ? rec.seed.title : 'that') + '. Ask it for something else.'); rec.quick = 0; return; }
    cascadeTo(got.recipe);
  }
  function cascadeTo(r) {
    note('cascade ' + r.title + ' from ' + (current && current.recipe.title));
    trail.push(current);
    if (trail.length > 30) trail.shift();
    const landing = cur + CASCADE;
    const entry = showRecipe(r, landing);
    lock(FLIP_MS + CASCADE * STAGGER + 150);
    goto(landing);
    setTimeout(() => restAt(entry), FLIP_MS + CASCADE * STAGGER + 60);
    say(entry.recipe.source === 'wikibooks' ? 'From the Wikibooks Cookbook' : '');
  }
  function prev() {
    note('prev busy=' + busy + ' cur=' + cur + ' trail=' + trail.length);
    if (busy || state !== 'read' || !current) return;
    if (cur > BASE) { lock(700); goto(cur - 1); say(describe()); return; }
    const back = trail.pop();
    if (!back) { backToTitle(); return; }
    /* make room on the left without a visible change: shift the current recipe right, then turn back through the previous one */
    const k = CASCADE + spreads(back);
    resetFaces();
    placePages(current.pages, BASE + k);
    snapTo(BASE + k);
    placePages(back.pages, BASE + k - CASCADE - (spreads(back) - 1));
    lock(FLIP_MS + CASCADE * STAGGER + 150);
    goto(BASE + k - CASCADE);
    setTimeout(() => restAt(back, spreads(back) - 1), FLIP_MS + CASCADE * STAGGER + 60);
  }
  function backToTitle() {
    if (busy || state !== 'read') return;
    const n = cur - 1;
    lock(FLIP_MS + n * STAGGER + 150);
    goto(1); setState('open');
    setTimeout(() => { current = null; trail.length = 0; resetFaces(); }, FLIP_MS + n * STAGGER);
  }
  function openBook() {
    if (busy || state !== 'closed') return;
    lock(2900);
    setState('float');
    setTimeout(() => { goto(1); setState('open'); }, 1100);
  }
  function closeCover() {
    if (busy || state !== 'open') return;
    lock(2900);
    goto(0); setState('float');
    setTimeout(() => { setState('closed'); }, 1500);
  }
  function jumpTo(r) {
    note('jump ' + r.title + ' state=' + state + ' busy=' + busy);
    ball.close();
    if (state === 'closed') { openBook(); setTimeout(() => jumpTo(r), 3000); return; }
    if (state === 'open') { if (busy) { setTimeout(() => jumpTo(r), 300); return; } startReading(r); return; }
    if (busy) { setTimeout(() => jumpTo(r), 300); return; }
    if (current && current.recipe.id === r.id) return;
    rec.shown.add(r.id);
    cascadeTo(r);
  }

  /* ---------- the crystal ball ---------- */
  function createBall() {
    const wrap = document.getElementById('ball');
    const form = wrap.querySelector('form'), input = wrap.querySelector('input'), res = wrap.querySelector('.res'), st = wrap.querySelector('.st');
    const chips = wrap.querySelector('.chips'), tarotL = wrap.querySelector('.tarot.left'), tarotR = wrap.querySelector('.tarot.right');
    const askText = wrap.querySelector('#ask-text');
    const gl = createCrystal(wrap.querySelector('canvas'));
    let pending = 0, askTimer = 0, askIdx = -1;
    chips.innerHTML = SUGGEST.slice(0, 6).map((s) => '<button type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>').join('');
    chips.addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (b) { input.value = b.dataset.q; form.requestSubmit(); } });
    function cycleAsk() {
      askIdx = (askIdx + 1) % (SUGGEST.length + 1);
      const t = askIdx === 0 ? 'Ask me anything' : 'try “' + SUGGEST[askIdx - 1] + '”';
      askText.classList.add('swap');
      setTimeout(() => { askText.textContent = t; askText.classList.remove('swap'); }, 350);
      askTimer = setTimeout(cycleAsk, askIdx === 0 ? 3200 : 2400);
    }
    function dealTarot() {
      const deck = TAROT.filter((id) => byId(id)).sort(() => Math.random() - 0.5);
      const left = deck.slice(0, 3), right = deck.slice(3, 6);
      const card = (id, i, side) => {
        const r = byId(id);
        const rot = (side === 'left' ? -1 : 1) * (6 + Math.random() * 9) * (i % 2 ? -0.6 : 1);
        return '<button type="button" class="tcard" data-id="' + esc(id) + '" style="--rot:' + rot.toFixed(1) + 'deg;--dx:' + (Math.random() * 18 - 9).toFixed(0) + 'px;--i:' + i + '" aria-label="' + esc(r.title) + '"><img src="assets/cards/' + esc(id) + '.webp" alt="' + esc(r.title) + '" loading="lazy"></button>';
      };
      tarotL.innerHTML = left.map((id, i) => card(id, i, 'left')).join('');
      tarotR.innerHTML = right.map((id, i) => card(id, i, 'right')).join('');
    }
    wrap.addEventListener('click', (e) => { const c = e.target.closest('.tcard'); if (c) { const r = byId(c.dataset.id); if (r) jumpTo(r); } });
    function render(list, live) {
      res.innerHTML = list.slice(0, 6).map((r) => '<button type="button" data-id="' + esc(r.id) + '">' + esc(r.title) + (r.source === 'wikibooks' ? ' <small>Wikibooks</small>' : '') + (r.nutrition && rec.goal ? ' <small>' + r.nutrition.kcal + ' kcal · ' + r.nutrition.protein + ' g protein</small>' : '') + '</button>').join('');
      if (live === 'down') st.textContent = list.length ? 'The Wikibooks Cookbook could not be reached; these are from the grimoire itself.' : 'Nothing in the grimoire matches, and the Wikibooks Cookbook could not be reached.';
      else st.textContent = list.length ? (live ? 'Also searched the Wikibooks Cookbook.' : '') : (live ? 'Nothing found for that. Try another craving.' : 'Consulting the ether…');
      renderGoal();
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const id = ++pending;
      const local = rec.search(q);
      render(local, false);
      if (rec.goal) st.textContent = GOALS[rec.goal].label + ' plates: about 500 kcal with 40 g protein or more. ' + st.textContent;
      if (navigator.onLine !== false) {
        const live = await wiki.searchRecipes(q, 6);
        if (id !== pending) return;
        if (!live) { render(local, 'down'); return; }
        live.forEach((r) => history.cacheLive(r));
        rec.addToPool(live);
        render(rec.search(q), true);
      } else st.textContent = local.length ? '' : 'Offline, and nothing in the grimoire matches.';
    });
    res.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const r = byId(b.dataset.id);
      if (r) jumpTo(r);
    });
    wrap.querySelector('.x').addEventListener('click', () => api.close());
    wrap.querySelector('.dim').addEventListener('click', () => api.close());
    const api = {
      open(msg) {
        res.innerHTML = ''; st.textContent = msg || ''; input.value = '';
        dealTarot();
        wrap.classList.add('on'); wrap.setAttribute('aria-hidden', 'false'); document.body.classList.add('ball-open');
        gl && gl.start();
        clearTimeout(askTimer); askIdx = -1; askText.textContent = 'Ask me anything'; askTimer = setTimeout(cycleAsk, 3200);
        setTimeout(() => input.focus({ preventScroll: true }), 700);
        const rest = rec.remaining();
        if (rest.length && !msg) { render(rest, false); st.textContent = 'The grimoire still has a few ideas:'; }
        else if (rest.length) { render(rest, false); st.textContent = msg; }
      },
      close() {
        wrap.classList.remove('on'); wrap.setAttribute('aria-hidden', 'true'); document.body.classList.remove('ball-open');
        gl && gl.stop(); clearTimeout(askTimer);
        if (state === 'read') shownAt = performance.now();
      },
      isOpen() { return wrap.classList.contains('on'); }
    };
    return api;
  }
  const ball = createBall();

  /* ---------- input ---------- */
  stage.addEventListener('click', (e) => {
    if (ball.isOpen()) return;
    if (e.target.closest('a')) return;
    const bm = e.target.closest('.bm');
    if (bm) { e.stopPropagation(); toggleBookmark(bm.dataset.id); return; }
    if (e.target.closest('textarea')) return;
    const onBook = !!e.target.closest('.book');
    const right = e.clientX >= innerWidth / 2;
    if (state === 'closed') { if (onBook) openBook(); }
    else if (state === 'open') { if (onBook) { right ? startReading() : closeCover(); } }
    else if (state === 'read') { right ? next() : prev(); }
  });
  closer.addEventListener('click', () => { if (state === 'read') backToTitle(); else if (state === 'open') closeCover(); });
  if (photoBtn) photoBtn.addEventListener('click', () => { showPhoto = !showPhoto; updateShift(); });
  document.getElementById('orb').addEventListener('click', () => ball.open(''));
  let px = 0, py = 0;
  stage.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  stage.addEventListener('pointerup', (e) => {
    if (e.target.closest('textarea')) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && state === 'read') { dx < 0 ? next() : prev(); e.preventDefault(); }
  });
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
    if (ball.isOpen()) { if (e.key === 'Escape') ball.close(); return; }
    const k = e.key;
    if (state === 'closed' && (k === 'Enter' || k === ' ') && document.activeElement === book) { e.preventDefault(); openBook(); }
    else if (state === 'open' && (k === 'Enter' || k === ' ' || k === 'ArrowRight')) { e.preventDefault(); startReading(); }
    else if (state === 'open' && (k === 'ArrowLeft' || k === 'Escape')) closeCover();
    else if (state === 'read') {
      if (k === 'ArrowRight' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
      else if (k === 'ArrowLeft') prev();
      else if (k === 'Escape') backToTitle();
      else if (k === '/') { e.preventDefault(); ball.open(''); }
      else if (k === 'b' && current) toggleBookmark(current.recipe.id);
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (meadow && state !== 'read') meadow.pause(); } else if (meadow && state !== 'read') meadow.resume(); });

  return {
    get state() { return state; }, get current() { return current; }, log, rec, ball, next, prev, openBook, startReading, jumpTo, toggleBookmark,
    dwellMs: DWELL_MS
  };
}

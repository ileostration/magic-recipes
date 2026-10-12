/* The book: a fixed pool of glass leaves whose faces are re-rendered on demand, so an endless stream of recipes
   fits in a finite book. Click sequence: closed -> float -> open (title page) -> read (spread fills the screen).
   Within a recipe a flip turns one leaf; past the end of a recipe a cascade of leaves turns and the next
   recommendation lands on the new spread. Dwell time on each recipe feeds the recommender. */
import { Recommender, DWELL_MS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';

const NL = 18;            /* leaves in the pool */
const BASE = 8;           /* the leaf a recipe's first text page sits on when the book is at rest */
const CASCADE = 4;        /* leaves that turn between recipes */
const MAX_PAGES = 6;      /* image page + up to five text pages */
const GAP = 3;            /* px between stacked leaves */
const STAGGER = 110;      /* ms between leaves in a cascade */
const FLIP_MS = 1350;

export function createBook(opts) {
  const { recipes, meadow } = opts;
  const book = document.getElementById('book');
  const stage = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const closer = document.getElementById('closer');
  const photoBtn = document.getElementById('photo');
  const measure = document.getElementById('measure');
  const root = document.documentElement;
  const rec = new Recommender(recipes.concat(history.liveRecipes()), history);
  const ball = createBall();

  /* ---------- markup helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function frame() {
    let h = '<div class="frame"></div>';
    ['tl', 'tr', 'bl', 'br'].forEach((c) => { h += '<svg class="corner ' + c + '" viewBox="0 0 48 48" aria-hidden="true"><use href="#corner"/></svg>'; });
    return h;
  }
  const titlePage = () => frame() + '<div class="in"><div class="tp">' +
    '<div class="the gold">The</div><h1 class="gold">Recipe<br>Book</h1>' +
    '<svg class="div" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<div class="vol">Volume I</div><div class="sub">Opens to what you crave</div>' +
    '<div class="turn">Turn the page</div></div></div>';
  const insideCover = () => frame() + '<div class="in"><div class="inside"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<div>Every reader’s copy opens to a different page. Linger on a recipe and the book learns what you like. Hurry past and it changes its mind.</div>' +
    '<div>Your reading history stays in this browser and nowhere else.</div></div></div>';
  const blankPage = () => frame() + '<div class="in"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div>';
  const notesPage = () => frame() + '<div class="in"><div class="notes"><h2 class="gold">Notes</h2><div class="lines"></div></div></div>';

  function imagePage(r) {
    const img = r.image && r.image.url ? '<img alt="' + esc(r.title) + '" data-src="' + esc(r.image.url) + '">' : '';
    const credit = r.image && r.image.credit ? '<span class="cr">Photo: ' + esc(r.image.credit.artist) + ' · ' + esc(r.image.credit.license) + ' · <a href="' + esc(r.image.credit.link) + '" target="_blank" rel="noopener">Commons</a></span>' : '<span class="cr" data-credit></span>';
    return '<div class="in"><div class="ph" style="--h:' + (r.hue || 40) + '" data-rid="' + esc(r.id) + '">' + img +
      '<svg class="glyph" viewBox="0 0 64 60" aria-hidden="true"><use href="#image-glyph"/></svg>' +
      '<div class="cap"><b>' + esc(r.title) + '</b><span>' + esc(r.origin || '') + '</span>' + credit + '</div></div></div>';
  }
  function sourceLine(r) {
    if (r.source === 'wikibooks') return '<div class="src">From the <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Wikibooks Cookbook</a>, text under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</div>';
    return '';
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

    let pageHtml = head, list = null, listHtml = '', first = true, stepStart = 0, done = 0;
    const fits = (html) => { measure.innerHTML = '<div class="rp">' + html + '</div>'; const el = measure.firstChild; return el.scrollHeight <= el.clientHeight + 1; };
    const close = () => (list ? '<' + list + (list === 'ol' ? ' style="--start:' + stepStart + '"' : '') + '>' + listHtml + '</' + list + '>' : '');
    const flush = (cont) => {
      pages.push(frame() + '<div class="in"><div class="rp">' + pageHtml + close() + (cont ? '<div class="more">continued →</div>' : src) + '</div></div>');
      pageHtml = ''; listHtml = ''; first = false;
    };
    for (const b of blocks) {
      if (pages.length >= MAX_PAGES) break;
      let next = pageHtml, nList = list, nListHtml = listHtml;
      if (b.t === 'h') { next += close(); nList = null; nListHtml = ''; next += b.html; }
      else { if (list !== b.t) { next += close(); nList = b.t; nListHtml = ''; if (b.t === 'ol') stepStart = b.step; } nListHtml += b.html; }
      const probe = next + (nList ? '<' + nList + '>' + nListHtml + '</' + nList + '>' : '') + '<div class="more">x</div>';
      if (fits(probe) || (first && !listHtml && !pageHtml)) { pageHtml = next; list = nList; listHtml = nListHtml; done++; }
      else {
        /* never leave a heading stranded at the foot of a page: carry it over with its first item */
        let carried = '';
        if (!list && /<h3>[^<]*<\/h3>$/.test(pageHtml)) { carried = pageHtml.match(/<h3>[^<]*<\/h3>$/)[0]; pageHtml = pageHtml.slice(0, -carried.length); }
        flush(true);
        if (b.t === 'h') { pageHtml = b.html; list = null; listHtml = ''; }
        else { pageHtml = carried || (b.t === 'ol' ? '<h3>Method, continued</h3>' : '<h3>Ingredients, continued</h3>'); list = b.t; listHtml = b.html; if (b.t === 'ol') stepStart = b.step; }
        done++;
      }
    }
    flush(false);
    if (pages.length % 2 === 1) pages.push(notesPage());
    measure.innerHTML = '';
    return pages;
  }

  /* ---------- leaves ---------- */
  let html = '<div class="rear">' + frame() + '</div><div class="spine"></div><div class="edge-r"></div><div class="edge-b"></div><div class="edge-t"></div>';
  for (let i = 0; i < NL; i++) html += '<div class="leaf" data-i="' + i + '"><div class="face front"></div><div class="face back"></div></div>';
  book.innerHTML = html;
  const leaves = [...book.querySelectorAll('.leaf')];
  const faces = leaves.map((l) => ({ front: l.querySelector('.front'), back: l.querySelector('.back') }));
  function setFace(i, side, h, cls) {
    const f = faces[i][side];
    if (f.dataset.key === h) return;
    f.dataset.key = h;
    f.className = 'face ' + side + (cls ? ' ' + cls : '');
    f.innerHTML = h;
  }
  function resetFaces() {
    setFace(0, 'front', frame(), 'cover');
    setFace(0, 'back', insideCover());
    setFace(1, 'front', titlePage());
    for (let i = 1; i < NL; i++) { if (i > 1) setFace(i, 'front', blankPage()); setFace(i, 'back', blankPage()); }
  }
  /* face sequence for a recipe starting with its left page on leaf (at-1).back */
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
  const trail = [];          /* recipes already read this session, for going back */
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
    s.setProperty('--sc', Math.min(vw * 0.62 / P, vh * 0.8 / H));
    s.setProperty('--sf', Math.min(vw * 0.58 / P, vh * 0.74 / H));
    s.setProperty('--so', Math.min(vw * 0.88 / (2 * P), vh * 0.7 / H));
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
    book.setAttribute('aria-label', s === 'closed' ? 'The Recipe Book. Activate to open.' : 'The Recipe Book, open');
    if (s === 'read') meadow && meadow.pause(); else meadow && meadow.resume();
    updateShift();
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
  }
  function goto(n) { const p = cur; cur = n; update(p); }
  function lock(ms) { busy = true; clearTimeout(timer); timer = setTimeout(() => { busy = false; }, ms); }
  /* reposition the book without animation; used after a cascade so the pool never runs out */
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
          const r = rec.pool.find((x) => x.id === ph.dataset.rid);
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
    const r = rec.pool.find((x) => x.id === ph.dataset.rid);
    const slot = ph.querySelector('[data-credit]');
    if (!r || !r.image || !slot) return;
    if (!r.image.credit && r.image.file) r.image.credit = await wiki.imageCredit(r.image.file);
    if (r.image.credit) slot.innerHTML = 'Photo: ' + esc(r.image.credit.artist) + ' · ' + esc(r.image.credit.license) + ' · <a href="' + esc(r.image.credit.link) + '" target="_blank" rel="noopener">Commons</a>';
  }

  /* ---------- recipes in and out of the book ---------- */
  function showRecipe(r, at) {
    counter++;
    const pages = paginate(r, counter);
    placePages(pages, at);
    history.noteSeen(r.id);
    return { recipe: r, pages, n: counter };
  }
  function rerenderCurrent() {
    const pages = paginate(current.recipe, current.n);
    current.pages = pages;
    placePages(pages, BASE);
    const last = BASE + pages.length / 2 - 1;
    if (cur > last) snapTo(last);
    loadImages();
  }
  function restAt(entry) {
    resetFaces();
    current = entry;
    placePages(entry.pages, BASE);
    snapTo(BASE);
    shownAt = performance.now();
    say(describe());
  }
  function firstRecipe() {
    const got = rec.next() || rec.discover();
    return got ? got.recipe : null;
  }

  /* title -> first recipe: cascade of leaves, then rest */
  function startReading(r) {
    note('startReading busy=' + busy + ' state=' + state);
    if (busy || state !== 'open') return;
    r = r || firstRecipe();
    if (!r) return;
    lock(FLIP_MS + (BASE - 1) * STAGGER + 200);
    const entry = showRecipe(r, BASE);
    goto(BASE);
    setState('read');
    current = entry; shownAt = performance.now();
    say(describe());
  }
  function lastSpread() { return BASE + current.pages.length / 2 - 1; }

  function next() {
    note('next busy=' + busy + ' cur=' + cur);
    if (busy || state !== 'read' || !current) return;
    if (cur < lastSpread()) { lock(700); goto(cur + 1); say(describe()); return; }
    /* leaving the recipe: tell the recommender how long we stayed */
    const dwell = performance.now() - shownAt;
    rec.noteFlip(current.recipe, dwell);
    if (rec.wantsBall()) { ball.open('The pages blur past… what are you really hungry for?'); rec.quick = 0; return; }
    const got = rec.next();
    if (!got) { ball.open('The book has shown you all it knows about ' + (rec.seed ? rec.seed.title : 'that') + '. Ask it for something else.'); rec.quick = 0; return; }
    cascadeTo(got.recipe, +1);
  }
  function cascadeTo(r, dir) {
    note('cascade ' + r.title + ' from ' + (current && current.recipe.title));
    trail.push(current);
    if (trail.length > 30) trail.shift();
    const landing = cur + CASCADE;
    const entry = showRecipe(r, landing);
    lock(FLIP_MS + CASCADE * STAGGER + 150);
    goto(landing);
    setTimeout(() => restAt(entry), FLIP_MS + CASCADE * STAGGER + 60);
    say(dir > 0 && entry.recipe.source === 'wikibooks' ? 'From the Wikibooks Cookbook' : '');
  }
  function prev() {
    note('prev busy=' + busy + ' cur=' + cur + ' trail=' + trail.length);
    if (busy || state !== 'read' || !current) return;
    if (cur > BASE) { lock(700); goto(cur - 1); say(describe()); return; }
    const back = trail.pop();
    if (!back) { backToTitle(); return; }
    /* previous recipe lands with its last spread just left of here */
    const at = BASE - CASCADE - (back.pages.length / 2 - 1);
    placePages(back.pages, at);
    lock(FLIP_MS + CASCADE * STAGGER + 150);
    goto(at + back.pages.length / 2 - 1);
    setTimeout(() => { restAt(back); snapTo(lastSpread()); }, FLIP_MS + CASCADE * STAGGER + 60);
  }
  function backToTitle() {
    if (busy || state !== 'read') return;
    lock(FLIP_MS + (BASE - 1) * STAGGER + 200);
    goto(1); setState('open');
    setTimeout(() => { current = null; resetFaces(); }, FLIP_MS + (BASE - 1) * STAGGER);
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

  /* jump straight to a recipe the reader chose in the crystal ball */
  function jumpTo(r) {
    note('jump ' + r.title + ' state=' + state + ' busy=' + busy);
    ball.close();
    if (state === 'open') { startReading(r); return; }
    if (state !== 'read') return;
    if (busy) { setTimeout(() => jumpTo(r), 300); return; }
    rec.shown.add(r.id);
    cascadeTo(r, +1);
  }

  /* ---------- the crystal ball ---------- */
  function createBall() {
    const wrap = document.getElementById('ball');
    const form = wrap.querySelector('form'), input = wrap.querySelector('input'), res = wrap.querySelector('.res'), st = wrap.querySelector('.st'), ask = wrap.querySelector('.ask');
    let pending = 0;
    function render(list, live) {
      res.innerHTML = list.slice(0, 6).map((r) => '<button type="button" data-id="' + esc(r.id) + '">' + esc(r.title) + (r.source === 'wikibooks' ? ' <small>Wikibooks</small>' : '') + '</button>').join('');
      if (live === 'down') st.textContent = list.length ? 'The Wikibooks Cookbook could not be reached; these are from the book itself.' : 'Nothing in the book matches, and the Wikibooks Cookbook could not be reached.';
      else st.textContent = list.length ? (live ? 'Also searched the Wikibooks Cookbook.' : '') : (live ? 'Nothing found for that. Try another craving.' : 'Consulting the ether\u2026');
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const id = ++pending;
      const local = rec.search(q);
      render(local, false);
      if (navigator.onLine !== false) {
        const live = await wiki.searchRecipes(q, 6);
        if (id !== pending) return;
        if (!live) { render(local, 'down'); return; }
        live.forEach((r) => history.cacheLive(r));
        rec.addToPool(live);
        render(rec.search(q), true);
      } else st.textContent = local.length ? '' : 'Offline, and nothing in the book matches.';
    });
    res.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const r = rec.pool.find((x) => x.id === b.dataset.id);
      if (r) jumpTo(r);
    });
    wrap.querySelector('.x').addEventListener('click', () => api.close());
    wrap.querySelector('.dim').addEventListener('click', () => api.close());
    const api = {
      open(msg) {
        ask.textContent = msg || 'Ask the crystal';
        res.innerHTML = ''; st.textContent = ''; input.value = '';
        wrap.classList.add('on'); wrap.setAttribute('aria-hidden', 'false');
        setTimeout(() => input.focus(), 700);
        const rest = rec.remaining();
        if (rest.length) { st.textContent = 'Or keep turning:'; render(rest, false); st.textContent = 'The book still has a few ideas:'; }
      },
      close() { wrap.classList.remove('on'); wrap.setAttribute('aria-hidden', 'true'); if (state === 'read') shownAt = performance.now(); },
      isOpen() { return wrap.classList.contains('on'); }
    };
    return api;
  }

  /* ---------- input ---------- */
  stage.addEventListener('click', (e) => {
    if (ball.isOpen()) return;
    if (e.target.closest('a')) return;
    const onBook = !!e.target.closest('.book');
    let right = e.clientX >= innerWidth / 2;
    if (document.body.classList.contains('portrait') && state === 'read') right = e.clientX >= innerWidth * 0.5;
    if (state === 'closed') { if (onBook) openBook(); }
    else if (state === 'open') { if (onBook) { right ? startReading() : closeCover(); } }
    else if (state === 'read') { right ? next() : prev(); }
  });
  closer.addEventListener('click', () => { if (state === 'read') backToTitle(); else if (state === 'open') closeCover(); });
  if (photoBtn) photoBtn.addEventListener('click', () => { showPhoto = !showPhoto; updateShift(); });
  document.getElementById('orb').addEventListener('click', () => ball.open('Ask the crystal'));
  let px = 0, py = 0;
  stage.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && state === 'read') { dx < 0 ? next() : prev(); e.preventDefault(); }
  });
  addEventListener('keydown', (e) => {
    if (ball.isOpen()) { if (e.key === 'Escape') ball.close(); return; }
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key;
    if (state === 'closed' && (k === 'Enter' || k === ' ') && document.activeElement === book) { e.preventDefault(); openBook(); }
    else if (state === 'open' && (k === 'Enter' || k === ' ' || k === 'ArrowRight')) { e.preventDefault(); startReading(); }
    else if (state === 'open' && (k === 'ArrowLeft' || k === 'Escape')) closeCover();
    else if (state === 'read') {
      if (k === 'ArrowRight' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
      else if (k === 'ArrowLeft') prev();
      else if (k === 'Escape') backToTitle();
      else if (k === '/') { e.preventDefault(); ball.open('Ask the crystal'); }
    }
  });

  return {
    get state() { return state; }, get current() { return current; }, log, rec, ball, next, prev, openBook, startReading, jumpTo,
    dwellMs: DWELL_MS
  };
}

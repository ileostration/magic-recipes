/* Scene two: the reader. A flat two-column page (photo left, recipe right) with page-turn transitions.
   Within a recipe a click turns one page; past the end a short cascade turns and the next recommendation lands.
   Every page of a recipe carries a bookmark ribbon; the last page is a notes pad you can type and draw on. */
import { DWELL_MS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';
import { Flipbook } from './flipbook.js';
import { paginate, blankPage, esc, withBookmark } from './pages.js';
import { attachSketch, recognize } from './sketch.js';
import { findImage, creditHtml } from './images.js';

export function createReader(app) {
  const { rec } = app;
  const root = document.getElementById('reader');
  const area = root.querySelector('.spread');
  const measure = document.getElementById('measure');
  const hint = document.getElementById('hint');
  const fb = new Flipbook(area);
  const runesLayer = root.querySelector('.runes');

  /* the trail: every recipe shown this session in order, with a cursor. Back and forward walk it, so the reader
     meets the same recipes in the same order both ways; a new recommendation is only made past its end, and only
     the crystal ball starts a fresh trail. */
  let current = null, trail = [], pos = -1, shownAt = 0, counter = 0, busy = false, lockT = 0, active = false;

  const portrait = () => innerWidth / innerHeight < 0.95;
  function layout() { const p = portrait(); document.body.classList.toggle('portrait', p); fb.single = p; return p; }
  function say(t) {
    hint.classList.add('off');
    clearTimeout(say.t);
    if (!t) return;
    clearTimeout(say.h);
    say.t = setTimeout(() => { hint.textContent = t; hint.classList.remove('off'); say.h = setTimeout(() => hint.classList.add('off'), 2800); }, 250);   /* it names the page for a moment, then clears the text */
  }
  function describe() {
    if (!current) return '';
    const tot = fb.spreads, sp = fb.spread + 1;
    return current.recipe.title + (tot > 1 ? ' · page ' + sp + ' of ' + tot : '');
  }
  function lock(ms) { busy = true; clearTimeout(lockT); lockT = setTimeout(() => { busy = false; }, ms); }

  function entryFor(r, neutral) {
    counter++;
    const single = layout();
    return { recipe: r, pages: paginate(r, counter, measure, single), n: counter, single, neutral: !!neutral };
  }
  function cascadeLen(e) { return 3; }

  /* ---------- showing recipes ---------- */
  async function land(entry, mode, spread) {
    current = entry;
    history.noteSeen(entry.recipe.id);
    await fb.show(entry.pages, spread || 0, mode);
    wire();
    shownAt = performance.now();
    say(describe());
    app.setHash('r/' + entry.recipe.id);
  }
  function open(r, fromLanding) {
    active = true;
    root.hidden = false;
    document.body.dataset.scene = 'reader';
    if (fromLanding) { fb.left.innerHTML = blankPage(); fb.right.innerHTML = blankPage(); }
    const e = entryFor(r);
    trail = [e]; pos = 0;
    lock(1000);
    land(e, fromLanding ? 'next' : 'none', 0);
    app.menu.refresh();
  }
  function close() {
    active = false;
    root.hidden = true;
    current = null; trail = []; pos = -1;
    say('');
  }
  async function next() {
    if (!active || busy || fb.busy || !current) return;
    if (fb.spread < fb.spreads - 1) { lock(900); await fb.show(current.pages, fb.spread + 1, 'next'); wire(); say(describe()); return; }
    const dwell = performance.now() - shownAt;
    /* a recipe opened from the bookmarks or the planner is a visit, not a craving: it never re-seeds the book nor counts as a flip */
    if (pos < trail.length - 1) { if (dwell >= DWELL_MS && !current.neutral) rec.noteFlip(current.recipe, dwell); goTo(pos + 1, 1); return; } /* forward along the trail: the same recipe as before */
    if (!current.neutral) rec.noteFlip(current.recipe, dwell);
    if (rec.wantsBall()) { app.ball.open('The pages blur past. What are you really hungry for?'); rec.quick = 0; return; }
    const got = rec.next();
    if (!got) { app.ball.open('That is all the grimoire knows about ' + (rec.seed ? rec.seed.title : 'that') + '. Ask it for something else.'); rec.quick = 0; return; }
    goForward(got.recipe);
  }
  /* a new recipe after the current one. reset: the crystal ball starts the trail over; otherwise it is slotted in
     and whatever lay ahead stays ahead */
  function goForward(r, reset, neutral) {
    const e = entryFor(r, neutral);
    if (reset) { trail = [e]; pos = 0; }
    else { trail.splice(pos + 1, 0, e); pos++; if (trail.length > 60) { trail.shift(); pos--; } }
    lock(1500);
    land(e, { cascade: cascadeLen(e), dir: 1 }, 0);
    if (e.recipe.source === 'wikibooks') say('From the Wikibooks Cookbook');
  }
  function goTo(i, dir) {
    const e = trail[i];
    pos = i;
    lock(1500);
    const single = layout();
    if (e.single !== single) { e.pages = paginate(e.recipe, e.n, measure, single); e.single = single; }
    land(e, { cascade: cascadeLen(e), dir }, dir < 0 ? Math.ceil(e.pages.length / (single ? 1 : 2)) - 1 : 0);
  }
  async function prev() {
    if (!active || busy || fb.busy || !current) return;
    if (fb.spread > 0) { lock(900); await fb.show(current.pages, fb.spread - 1, 'prev'); wire(); say(describe()); return; }
    if (pos <= 0) { app.closeBook(); return; }
    goTo(pos - 1, -1);
  }
  /* reset is true when the crystal ball chose: the trail starts again from this recipe.
     neutral is true for a bookmark or planner visit: it is slotted into the trail but leaves the book's taste alone */
  function jumpTo(r, reset, neutral) {
    app.ball.close();
    app.views.closeAll();
    if (!active) { app.openReader(r); return; }
    if (busy || fb.busy) { setTimeout(() => jumpTo(r, reset, neutral), 300); return; }
    if (current && current.recipe.id === r.id) { if (reset) { trail = [current]; pos = 0; } return; }
    rec.shown.add(r.id);
    goForward(r, reset, neutral);
  }
  function openNotes(id) {
    const r = app.byId(id);
    if (!r) return;
    const go = () => { const idx = current.pages.findIndex((p) => p.includes('data-id="' + id + '"') && p.includes('class="pad ')); const s = fb.single ? idx : Math.floor(idx / 2); fb.show(current.pages, Math.max(0, s), 'none'); wire(); say(describe()); };
    if (current && current.recipe.id === id) go();
    else { jumpTo(r, false, true); setTimeout(go, 1800); }
  }

  /* ---------- live page wiring ---------- */
  function wire() {
    root.querySelectorAll('.page.left .bm, .page.right .bm').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); toggleBookmark(b.dataset.id); }; });
    root.querySelectorAll('.page.left .notes, .page.right .notes').forEach(wireNotes);
    root.querySelectorAll('.page.left .ph, .page.right .ph').forEach((ph) => {
      const im = ph.querySelector('img');
      if (im) {
        im.onerror = () => { im.classList.add('broken'); seek(ph); };
        if (im.complete && im.naturalWidth === 0) im.onerror();      /* it may have failed before this ran */
      }
      if (ph.classList.contains('seeking')) seek(ph);
    });
  }
  /* a picture for a photo page that has none, or whose picture would not load: the image finder, then the page is repainted in place */
  function seek(ph) {
    if (ph._seeking) return;
    ph._seeking = true;
    const r = app.byId(ph.dataset.rid) || (current && current.recipe);
    if (!r) return;
    ph.classList.add('seeking');
    findImage(r).then((im) => {
      if (!im || !ph.isConnected) { ph.classList.remove('seeking'); return; }
      const img = new Image();
      img.alt = r.title; img.loading = 'eager';
      img.onload = () => {
        ph.querySelectorAll('img').forEach((o) => o.remove());
        ph.insertBefore(img, ph.firstChild);
        ph.classList.remove('seeking');
        const cr = ph.querySelector('.cr'); if (cr) cr.innerHTML = creditHtml(im, esc);
      };
      img.onerror = () => ph.classList.remove('seeking');
      img.src = im.url;
    });
  }
  const MODE_KEY = 'grimoire.noteMode';
  function wireNotes(box) {
    if (box._wired) return;
    box._wired = true;
    const pad = box.querySelector('.pad');
    const id = pad.dataset.id;
    const ta = pad.querySelector('textarea'), ink = pad.querySelector('canvas');
    const count = box.querySelector('.ncount');
    const show = () => { count.textContent = ta.value.length + ' / ' + history.NOTE_MAX; };
    show();
    ta.addEventListener('input', () => { const n = history.setNote(id, { text: ta.value }); if (n.text !== ta.value) ta.value = n.text; show(); });
    ['pointerdown', 'pointerup', 'click', 'dblclick'].forEach((ev) => ta.addEventListener(ev, (e) => e.stopPropagation()));
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    const note = history.note(id);
    pad._sketch = attachSketch(ink, {
      initial: note.drawing,
      onTap(e) { pad._sketch.dot(e); },
      onChange(png) {
        history.setNote(id, { drawing: png, labels: [] });
        if (png) recognize(png).then((labels) => { if (labels.length) history.setNote(id, { labels }); });
      }
    });
    requestAnimationFrame(() => pad._sketch.size());
    /* Text or Draw: the choice is remembered for every notes page */
    const setMode = (m, focus) => {
      pad.classList.toggle('draw', m === 'draw'); pad.classList.toggle('text', m !== 'draw');
      box.querySelectorAll('.nmode button').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      try { localStorage.setItem(MODE_KEY, m); } catch (x) { /* private mode */ }
      if (m === 'draw') pad._sketch.size(); else if (focus) ta.focus({ preventScroll: true });
    };
    let saved = 'text'; try { saved = localStorage.getItem(MODE_KEY) || 'text'; } catch (x) { /* ignore */ }
    setMode(saved, false);
    box.querySelectorAll('.nmode button').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); setMode(b.dataset.mode, true); }; });
    box.querySelector('.nclear').onclick = (e) => { e.stopPropagation(); pad._sketch.clear(); say('Drawing cleared'); };
    box.querySelector('.nclear-text').onclick = (e) => { e.stopPropagation(); ta.value = ''; history.setNote(id, { text: '' }); show(); say('Notes cleared'); };
  }
  function toggleBookmark(id) { return setBookmark(id, !history.isBookmarked(id)); }
  function setBookmark(id, on) {
    history.setBookmark(id, on);
    root.querySelectorAll('.bm[data-id="' + id + '"]').forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    /* the pages not on screen are stored as mark-up: every page of this recipe, on every visit in the trail, follows */
    trail.forEach((e) => { if (e.recipe.id === id) { e.pages = e.pages.map((p) => withBookmark(p, id, on)); if (e === current) fb.pages = e.pages; } });
    app.menu.refresh();
    say(on ? 'Bookmarked' : 'Bookmark removed');
    return on;
  }

  /* ---------- input ---------- */
  area.addEventListener('click', (e) => {
    if (!active || app.ball.isOpen() || app.views.anyOpen()) return;
    if (e.target.closest('a, button, textarea, canvas, input, .menu')) return;
    const x = e.clientX / innerWidth;
    if (fb.single ? x < 0.33 : x < 0.5) prev(); else next();
  });
  let px = 0, py = 0, wheelT = 0;
  area.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  area.addEventListener('pointerup', (e) => {
    if (e.target.closest('textarea, canvas, button, input')) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx < 0 ? next() : prev(); }
  });
  area.addEventListener('wheel', (e) => {
    if (!active || app.ball.isOpen() || app.views.anyOpen() || e.target.closest('textarea')) return;
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 12 || wheelT) return;
    wheelT = setTimeout(() => { wheelT = 0; }, 900);
    d > 0 ? next() : prev();
  }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
    if (app.ball.isOpen()) { if (e.key === 'Escape') app.ball.close(); return; }
    if (app.views.anyOpen()) { if (e.key === 'Escape') app.views.closeAll(); return; }
    const k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft') prev();
    else if (k === 'Escape') app.closeBook();
    else if (k === '/') { e.preventDefault(); app.ball.open(''); }
    else if (k === 'b' && current) toggleBookmark(current.recipe.id);
  });
  let rt;
  /* lay the pages out again for the screen as it is now (or the type as it is now); unchanged pages are left alone */
  function repaginate() {
    if (!active || !current) return;
    const was = fb.single, single = layout();
    const pages = paginate(current.recipe, current.n, measure, single);
    if (was === single && pages.length === current.pages.length && pages.every((p, i) => p === current.pages[i])) return;
    current.pages = pages; current.single = single;
    fb.show(current.pages, was !== single ? 0 : Math.min(fb.spread, fb.spreads - 1), 'none'); wire();
  }
  addEventListener('resize', () => { if (!active || !current) return; clearTimeout(rt); rt = setTimeout(repaginate, 150); });
  /* a deep link paginates before the page's own faces have arrived: measure again once they have */
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => { if (!active || !current) return; clearTimeout(rt); rt = setTimeout(repaginate, 200); });

  /* ---------- runes drifting in the margins ---------- */
  const RUNE_FROM = 0x10900, RUNE_TO = 0x1091B;
  setInterval(() => {
    if (!active || document.hidden || app.ball.isOpen() || runesLayer.childElementCount > 10) return;
    const el = document.createElement('span');
    el.textContent = String.fromCodePoint(RUNE_FROM + Math.floor(Math.random() * (RUNE_TO - RUNE_FROM + 1)));
    const z = Math.random();
    let x, y;
    if (z < 0.3) { x = Math.random(); y = 0.004 + Math.random() * 0.035; }
    else if (z < 0.6) { x = Math.random(); y = 0.9 + Math.random() * 0.03; }
    else if (z < 0.8) { x = 0.004 + Math.random() * 0.03; y = Math.random(); }
    else { x = 0.965 + Math.random() * 0.03; y = Math.random(); }
    el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%';
    el.style.fontSize = (16 + Math.random() * 18) + 'px';
    el.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
    el.addEventListener('animationend', () => el.remove());
    runesLayer.appendChild(el);
  }, 600);

  return {
    get active() { return active; }, get current() { return current; }, get fb() { return fb; },
    open, close, next, prev, jumpTo, openNotes, toggleBookmark, setBookmark, esc, dwellMs: DWELL_MS
  };
}

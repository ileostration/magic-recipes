/* Scene two: the reader. A flat two-column page (photo left, recipe right) with page-turn transitions.
   Within a recipe a click turns one page; past the end a short cascade turns and the next recommendation lands.
   Every page of a recipe carries a bookmark ribbon; the last page is a notes pad you can type and draw on. */
import { DWELL_MS } from './recommend.js';
import { history } from './history.js';
import * as wiki from './wikibooks.js';
import { Flipbook } from './flipbook.js';
import { paginate, blankPage, esc } from './pages.js';
import { attachSketch, recognize } from './sketch.js';

export function createReader(app) {
  const { rec } = app;
  const root = document.getElementById('reader');
  const area = root.querySelector('.spread');
  const measure = document.getElementById('measure');
  const hint = document.getElementById('hint');
  const fb = new Flipbook(area);
  const runesLayer = root.querySelector('.runes');

  let current = null, trail = [], shownAt = 0, counter = 0, busy = false, lockT = 0, active = false;

  const portrait = () => innerWidth / innerHeight < 0.95;
  function say(t) {
    hint.classList.add('off');
    clearTimeout(say.t);
    if (!t) return;
    say.t = setTimeout(() => { hint.textContent = t; hint.classList.remove('off'); }, 250);
  }
  function describe() {
    if (!current) return '';
    const tot = fb.spreads, sp = fb.spread + 1;
    return current.recipe.title + (tot > 1 ? ' · page ' + sp + ' of ' + tot : '');
  }
  function lock(ms) { busy = true; clearTimeout(lockT); lockT = setTimeout(() => { busy = false; }, ms); }

  function entryFor(r) {
    counter++;
    fb.single = portrait();
    return { recipe: r, pages: paginate(r, counter, measure), n: counter };
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
    trail = [];
    lock(1000);
    land(e, fromLanding ? 'next' : 'none', 0);
    app.menu.refresh();
  }
  function close() {
    active = false;
    root.hidden = true;
    current = null; trail = [];
    say('');
  }
  async function next() {
    if (!active || busy || fb.busy || !current) return;
    if (fb.spread < fb.spreads - 1) { lock(900); await fb.show(current.pages, fb.spread + 1, 'next'); wire(); say(describe()); return; }
    const dwell = performance.now() - shownAt;
    rec.noteFlip(current.recipe, dwell);
    if (rec.wantsBall()) { app.ball.open('The pages blur past. What are you really hungry for?'); rec.quick = 0; return; }
    const got = rec.next();
    if (!got) { app.ball.open('That is all the grimoire knows about ' + (rec.seed ? rec.seed.title : 'that') + '. Ask it for something else.'); rec.quick = 0; return; }
    goForward(got.recipe);
  }
  function goForward(r) {
    trail.push(current); if (trail.length > 30) trail.shift();
    const e = entryFor(r);
    lock(1500);
    land(e, { cascade: cascadeLen(e), dir: 1 }, 0);
    if (e.recipe.source === 'wikibooks') say('From the Wikibooks Cookbook');
  }
  async function prev() {
    if (!active || busy || fb.busy || !current) return;
    if (fb.spread > 0) { lock(900); await fb.show(current.pages, fb.spread - 1, 'prev'); wire(); say(describe()); return; }
    const back = trail.pop();
    if (!back) { app.closeBook(); return; }
    lock(1500);
    fb.single = portrait();
    if (back.single !== fb.single) back.pages = paginate(back.recipe, back.n, measure);
    land(back, { cascade: cascadeLen(back), dir: -1 }, Math.ceil(back.pages.length / (fb.single ? 1 : 2)) - 1);
  }
  function jumpTo(r) {
    app.ball.close();
    app.views.closeAll();
    if (!active) { app.openReader(r); return; }
    if (busy || fb.busy) { setTimeout(() => jumpTo(r), 300); return; }
    if (current && current.recipe.id === r.id) return;
    rec.shown.add(r.id);
    goForward(r);
  }
  function openNotes(id) {
    const r = app.byId(id);
    if (!r) return;
    const go = () => { const idx = current.pages.findIndex((p) => p.includes('data-id="' + id + '"') && p.includes('class="pad"')); const s = fb.single ? idx : Math.floor(idx / 2); fb.show(current.pages, Math.max(0, s), 'none'); wire(); say(describe()); };
    if (current && current.recipe.id === id) go();
    else { jumpTo(r); setTimeout(go, 1800); }
  }

  /* ---------- live page wiring ---------- */
  function wire() {
    root.querySelectorAll('.page.left .bm, .page.right .bm').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); toggleBookmark(b.dataset.id); }; });
    root.querySelectorAll('.page.left .pad, .page.right .pad').forEach(wirePad);
    root.querySelectorAll('.page.left .nclear, .page.right .nclear').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const pad = b.closest('.notes').querySelector('.pad'); pad._sketch && pad._sketch.clear(); }; });
    root.querySelectorAll('.page img').forEach((im) => { im.onerror = () => { im.classList.add('broken'); }; });
  }
  function wirePad(pad) {
    if (pad._wired) return;
    pad._wired = true;
    const id = pad.dataset.id;
    const ta = pad.querySelector('textarea'), ink = pad.querySelector('canvas');
    const count = pad.parentElement.querySelector('.ncount');
    const show = () => { count.textContent = ta.value.length + ' / ' + history.NOTE_MAX; };
    show();
    ta.addEventListener('input', () => { const n = history.setNote(id, { text: ta.value }); if (n.text !== ta.value) ta.value = n.text; show(); });
    ['pointerdown', 'pointerup', 'click', 'dblclick'].forEach((ev) => ta.addEventListener(ev, (e) => e.stopPropagation()));
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    const note = history.note(id);
    pad._sketch = attachSketch(ink, {
      initial: note.drawing,
      onTap() { ta.focus({ preventScroll: true }); const v = ta.value.length; try { ta.setSelectionRange(v, v); } catch (x) { /* ignore */ } },
      onChange(png) {
        history.setNote(id, { drawing: png, labels: [] });
        if (png) recognize(png).then((labels) => { if (labels.length) history.setNote(id, { labels }); });
      }
    });
    requestAnimationFrame(() => pad._sketch.size());
  }
  function toggleBookmark(id) {
    const on = history.toggleBookmark(id);
    root.querySelectorAll('.bm[data-id="' + id + '"]').forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
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
    if (app.ball.isOpen() || app.views.anyOpen()) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft') prev();
    else if (k === 'Escape') app.closeBook();
    else if (k === '/') { e.preventDefault(); app.ball.open(''); }
    else if (k === 'b' && current) toggleBookmark(current.recipe.id);
  });
  let rt;
  addEventListener('resize', () => {
    if (!active || !current) return;
    clearTimeout(rt);
    rt = setTimeout(() => { const s = fb.single; fb.single = portrait(); if (s !== fb.single) { current.pages = paginate(current.recipe, current.n, measure); fb.show(current.pages, 0, 'none'); } else { current.pages = paginate(current.recipe, current.n, measure); fb.show(current.pages, Math.min(fb.spread, fb.spreads - 1), 'none'); } wire(); }, 150);
  });

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
    open, close, next, prev, jumpTo, openNotes, toggleBookmark, esc, dwellMs: DWELL_MS
  };
}

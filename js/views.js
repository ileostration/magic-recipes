/* The two views behind the glass menu: the bookmark shelf (cards standing in a row, or a table-of-contents list)
   and the notes planner (one grid cell per note, searchable by what you wrote and by what you drew). The list and
   the planner use the same page-turn flipbook as the reader. */
import { history } from './history.js';
import { Flipbook } from './flipbook.js';
import { frame, esc } from './pages.js';
import { recognize, sketchModel } from './sketch.js';
import { findImage } from './images.js';
import { runeLayer } from './runes.js';


export function createViews(app) {
  const marks = document.getElementById('view-marks');
  const notes = document.getElementById('view-notes');
  const shelf = marks.querySelector('.shelf'), shelfWrap = marks.querySelector('.shelf-wrap');
  const runeFx = runeLayer(marks.querySelector('.vrunes'), { every: 420 });
  const tocArea = marks.querySelector('.spread');
  const toc = new Flipbook(tocArea);
  const notesArea = notes.querySelector('.spread');
  const planner = new Flipbook(notesArea);
  const search = notes.querySelector('input');
  const nstatus = notes.querySelector('.nstatus');
  let marksMode = 'cards', openView = null;

  /* ---------- bookmark shelf ----------
     Every card stands turned sixty degrees. Cards to the left sit behind the ones to their right, a third of each
     showing. The row is centred on the screen whatever its length; past the width of the screen it can be dragged. */
  let dx = 0, lifted = -1;
  function cardHtml(r, i) {
    const im = r.image || history.image(r.id);
    const th = im && (im.thumb || im.url);
    const n = r.nutrition || {};
    const v = (k, unit) => (n[k] == null ? '\u2013' : n[k] + unit);
    return '<div class="scard" role="button" tabindex="0" data-id="' + esc(r.id) + '" data-i="' + i + '" style="--i:' + i + '" aria-label="' + esc(r.title) + '">' +
      (th ? '<img src="' + esc(th) + '" alt="" loading="lazy">' : '<img alt="" class="seek">') + '<span>' + esc(r.title) + '</span>' +
      '<button type="button" class="rx" aria-label="Remove bookmark: ' + esc(r.title) + '" title="Remove bookmark">&times;</button></div>' +
      '<div class="sinfo" data-for="' + i + '" style="--i:' + i + '"><b>' + esc(r.title) + '</b>' +
      '<i><em>Calories</em> ' + v('kcal', ' kcal') + '</i><i><em>Protein</em> ' + v('protein', ' g') + '</i><i><em>Carbs</em> ' + v('carbs', ' g') + '</i><i><em>Fat</em> ' + v('fat', ' g') + '</i><small>per serving</small></div>';
  }
  /* cards whose picture is missing or broken ask the image finder */
  function seekThumbs() {
    shelf.querySelectorAll('.scard img').forEach((im) => {
      const fill = () => { const r = app.byId(im.closest('.scard').dataset.id); if (r) findImage(r).then((found) => { if (found && im.isConnected) { im.classList.remove('seek'); im.src = found.thumb || found.url; } }); };
      if (im.classList.contains('seek')) fill(); else im.onerror = fill;
    });
  }
  function sizeShelf(N) {
    /* a card is 200 px wide at most; the row (half a card seen on the turn plus a third-of-a-card step per extra card)
       shrinks to fit the screen, and never so tall that a raised card leaves the top */
    const avail = Math.max(240, innerWidth - 48), tall = Math.max(240, innerHeight - 120);
    let w = Math.min(200, avail / (0.5 + (N - 1) / 6), tall / (1.8 * 4 / 3));
    w = Math.max(96, w);
    shelf.style.setProperty('--w', w + 'px');
    shelf.style.setProperty('--h', (w * 4 / 3) + 'px');
    shelf.style.setProperty('--step', (w / 6) + 'px');
    shelf.style.setProperty('--n', N);
    const row = w * 0.5 + w / 6 * (N - 1);
    return { w, row, over: Math.max(0, row - avail) };
  }
  function buildShelf() {
    const ids = history.bookmarks().slice().reverse();
    const N = ids.length;
    shelfWrap.classList.toggle('empty', !N);
    lifted = -1;
    if (!N) { shelf.innerHTML = ''; return; }
    sizeShelf(N);
    shelf.innerHTML = ids.map((id, i) => { const r = app.byId(id); return r ? cardHtml(r, i) : ''; }).join('');
    seekThumbs();
    setDx(0);
  }
  function setDx(v) {
    const N = history.bookmarks().length;
    const { over } = sizeShelf(Math.max(1, N));
    dx = over ? Math.max(-over / 2, Math.min(over / 2, v)) : 0;
    shelf.style.setProperty('--dx', dx + 'px');
  }
  function lift(i) {
    lifted = i;
    shelf.querySelectorAll('.scard').forEach((c) => c.classList.toggle('lift', +c.dataset.i === i));
    shelf.querySelectorAll('.sinfo').forEach((p) => p.classList.toggle('on', +p.dataset.for === i));
  }
  /* the row can be dragged when it is wider than the screen */
  let dragX = null, dragDx = 0, moved = false, lastJump = 0;
  const cardsMode = () => marksMode === 'cards' && !marks.hidden;
  marks.addEventListener('pointerdown', (e) => { if (!cardsMode() || e.target.closest('.menu, .rx')) return; dragX = e.clientX; dragDx = dx; moved = false; });
  marks.addEventListener('pointermove', (e) => {
    if (dragX != null) { const d = e.clientX - dragX; if (Math.abs(d) > 4) moved = true; if (moved) setDx(dragDx + d); return; }
    const c = e.target.closest('.scard');
    if (c && e.pointerType !== 'touch') lift(+c.dataset.i);
  });
  const endDrag = () => { dragX = null; };
  marks.addEventListener('pointerup', endDrag); marks.addEventListener('pointercancel', endDrag);
  marks.addEventListener('pointerleave', () => { endDrag(); if (cardsMode()) lift(-1); });
  shelfWrap.addEventListener('pointerover', (e) => { if (!e.target.closest('.scard, .sinfo') && e.pointerType !== 'touch') lift(-1); });
  marks.addEventListener('wheel', (e) => { if (!cardsMode()) return; const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX; if (shelf.style.getPropertyValue('--n') && Math.abs(d) > 2) { e.preventDefault(); setDx(dx - d * 0.6); } }, { passive: false });
  marks.addEventListener('click', (e) => {
    const x = e.target.closest('.rx');
    if (x) { e.stopPropagation(); askRemove(x.closest('.scard').dataset.id); return; }
    const c = e.target.closest('.scard');
    if (!c || moved || performance.now() - lastJump < 500) { moved = false; return; }
    /* on touch the first tap raises the card and shows its facts; the second opens it */
    if (!c.classList.contains('lift')) { lift(+c.dataset.i); return; }
    lastJump = performance.now();
    const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r, false, true);
  });
  marks.addEventListener('keydown', (e) => { const c = e.target.closest('.scard'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r, false, true); } });
  addEventListener('resize', () => { if (cardsMode()) setDx(dx); });

  /* ---------- removing a bookmark from its card ---------- */
  const confirmBox = document.getElementById('confirm');
  const SKIP_KEY = 'grimoire.skipRemoveAsk';
  let pendingRemove = null;
  const skipAsk = () => { try { return sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; } };
  function askRemove(id) {
    const r = app.byId(id);
    if (!r) return;
    if (skipAsk()) { removeBookmark(id); return; }
    pendingRemove = id;
    confirmBox.querySelector('.which').textContent = r.title;
    confirmBox.querySelector('#confirm-skip').checked = false;
    confirmBox.classList.add('on'); confirmBox.setAttribute('aria-hidden', 'false');
    confirmBox.querySelector('#confirm-no').focus();
  }
  function closeConfirm() { confirmBox.classList.remove('on'); confirmBox.setAttribute('aria-hidden', 'true'); pendingRemove = null; }
  function removeBookmark(id) {
    app.reader.setBookmark(id, false);
    buildShelf();
    toc.show(tocPages(), Math.min(toc.spread, Math.max(0, Math.ceil(tocPages().length / (toc.single ? 1 : 2)) - 1)), 'none');
    app.menu.refresh();
  }
  confirmBox.querySelector('#confirm-yes').addEventListener('click', () => {
    if (confirmBox.querySelector('#confirm-skip').checked) { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) { /* ignore */ } }
    const id = pendingRemove; closeConfirm(); if (id) removeBookmark(id);
  });
  confirmBox.querySelector('#confirm-no').addEventListener('click', closeConfirm);
  confirmBox.addEventListener('click', (e) => { if (e.target === confirmBox) closeConfirm(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && confirmBox.classList.contains('on')) closeConfirm(); });

  /* ---------- table of contents ---------- */
  function tocPages() {
    const ids = history.bookmarks().slice().reverse();
    const per = 9;
    const pages = [];
    for (let i = 0; i < Math.max(1, Math.ceil(ids.length / per)); i++) {
      const slice = ids.slice(i * per, i * per + per);
      pages.push(frame() + '<div class="in"><div class="toc">' + (i === 0 ? '<h2>Bookmarks</h2>' : '<h2 class="cont">Bookmarks, continued</h2>') +
        (slice.length ? '<ol start="' + (i * per + 1) + '">' + slice.map((id) => { const r = app.byId(id); return r ? '<li><button type="button" data-id="' + esc(id) + '"><span class="t">' + esc(r.title) + '</span><span class="dots"></span><span class="o">' + esc(r.origin || '') + '</span></button></li>' : ''; }).join('') + '</ol>' : '<p class="empty">No bookmarks yet. Tap the ribbon in a page’s corner.</p>') +
        '</div></div>');
    }
    if (pages.length % 2 === 1) pages.push(frame() + '<div class="in"><div class="toc"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>');
    return pages;
  }
  tocArea.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) { const r = app.byId(b.dataset.id); if (r) app.reader.jumpTo(r, false, true); return; }
    const x = e.clientX / innerWidth;
    flipBook(toc, x < 0.5 ? -1 : 1);
  });
  function flipBook(book, dir) {
    if (book.busy) return;
    const s = book.spread + dir;
    if (s < 0 || s >= book.spreads) return;
    book.show(book.pages, s, dir > 0 ? 'next' : 'prev');
  }
  function wheelFlip(book) { let t = 0; return (e) => { const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX; if (Math.abs(d) < 12 || t) return; t = setTimeout(() => { t = 0; }, 900); flipBook(book, d > 0 ? 1 : -1); }; }
  tocArea.addEventListener('wheel', wheelFlip(toc), { passive: true });
  notesArea.addEventListener('wheel', wheelFlip(planner), { passive: true });

  /* ---------- notes planner ---------- */
  function noteMatches(n, q) {
    if (!q) return true;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const r = app.byId(n.id);
    const hay = (n.text + ' ' + (r ? r.title : '') + ' ' + (n.labels || []).map((l) => l.label).join(' ')).toLowerCase();
    return words.every((w) => hay.includes(w) || hay.split(/\W+/).some((h) => h.startsWith(w) && w.length > 2));
  }
  function plannerPages(q) {
    const all = history.allNotes().filter((n) => noteMatches(n, q));
    const per = 4;
    const pages = [];
    const count = Math.max(1, Math.ceil(all.length / per));
    for (let i = 0; i < count; i++) {
      const slice = all.slice(i * per, i * per + per);
      pages.push(frame() + '<div class="in"><div class="planner">' + (i === 0 ? '<h2>Notes</h2>' : '<h2 class="cont">Notes, continued</h2>') +
        (slice.length ? '<div class="grid">' + slice.map((n) => {
          const r = app.byId(n.id);
          const d = n.at ? new Date(n.at) : null;
          return '<button type="button" class="ncell" data-id="' + esc(n.id) + '"><b>' + esc(r ? r.title : n.id) + '</b>' +
            (d ? '<time>' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '</time>' : '') +
            (n.drawing ? '<img src="' + n.drawing + '" alt="drawing">' : '') +
            '<p>' + esc(n.text || '') + '</p>' +
            (n.labels && n.labels.length ? '<small>' + n.labels.slice(0, 3).map((l) => esc(l.label)).join(' · ') + '</small>' : '') + '</button>';
        }).join('') + '</div>' : '<p class="empty">' + (q ? 'Nothing in your notes matches “' + esc(q) + '”.' : 'No notes yet. Every recipe ends with a page to write and draw on.') + '</p>') + '</div></div>');
    }
    if (pages.length % 2 === 1) pages.push(frame() + '<div class="in"><div class="planner"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>');
    return pages;
  }
  notesArea.addEventListener('click', (e) => {
    const c = e.target.closest('.ncell');
    if (c) { app.reader.openNotes(c.dataset.id); closeAll(); return; }
    const x = e.clientX / innerWidth;
    flipBook(planner, x < 0.5 ? -1 : 1);
  });
  let st = 0;
  search.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { planner.single = innerWidth / innerHeight < 0.95; planner.show(plannerPages(search.value.trim()), 0, 'none'); }, 180); });
  search.addEventListener('keydown', (e) => e.stopPropagation());
  /* label drawings that have none yet, so a sketch of a flower turns up for "flower" */
  async function labelPending() {
    const pending = history.allNotes().filter((n) => n.drawing && !(n.labels && n.labels.length));
    if (!pending.length) { nstatus.textContent = ''; return; }
    nstatus.textContent = 'Reading your drawings…';
    for (const n of pending) {
      const labels = await recognize(n.drawing);
      if (labels.length) history.setNote(n.id, { labels });
    }
    nstatus.textContent = sketchModel.state === 'failed' ? 'Drawing search needs an internet connection once, to fetch the sketch model.' : '';
    planner.show(plannerPages(search.value.trim()), planner.spread, 'none');
  }

  /* ---------- open / close ---------- */
  function openMarks() {
    closeAll();
    openView = 'marks';
    marks.hidden = false;
    document.body.classList.add('view-open');
    buildShelf();
    runeFx.start();
    toc.single = innerWidth / innerHeight < 0.95;
    toc.show(tocPages(), 0, 'none');
    setMarksMode(marksMode);
    app.menu.refresh();
  }
  function setMarksMode(m) {
    marksMode = m;
    marks.classList.toggle('cards', m === 'cards');
    marks.classList.toggle('list', m === 'list');
    app.menu.refresh();
  }
  function openNotes() {
    closeAll();
    openView = 'notes';
    notes.hidden = false;
    document.body.classList.add('view-open');
    planner.single = innerWidth / innerHeight < 0.95;
    search.value = '';
    planner.show(plannerPages(''), 0, 'none');
    labelPending();
    app.menu.refresh();
  }
  function closeAll() {
    openView = null;
    runeFx.stop();
    marks.hidden = true; notes.hidden = true;
    document.body.classList.remove('view-open');
    app.menu.refresh();
  }
  return {
    get open() { return openView; }, get marksMode() { return marksMode; },
    openMarks, openNotes, closeAll, anyOpen: () => !!openView,
    toggleMarksMode() { setMarksMode(marksMode === 'cards' ? 'list' : 'cards'); },
    /* the menu arrows: one card round the wheel, or one page of the list or the planner */
    flip(dir) {
      if (openView === 'marks') {
        if (marksMode === 'cards') { const N = history.bookmarks().length; if (!N) return; const i = lifted < 0 ? (dir > 0 ? 0 : N - 1) : Math.max(0, Math.min(N - 1, lifted + dir)); lift(i); const c = shelf.querySelector('.scard[data-i="' + i + '"]'); if (c) { const r = c.getBoundingClientRect(); if (r.left < 24) setDx(dx + (24 - r.left)); else if (r.right > innerWidth - 24) setDx(dx - (r.right - innerWidth + 24)); } }
        else flipBook(toc, dir);
      }
      else if (openView === 'notes') flipBook(planner, dir);
    }
  };
}

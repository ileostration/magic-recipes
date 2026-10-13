/* The two views behind the glass menu: the bookmark ring (cards on a turning wheel, or a table-of-contents list)
   and the notes planner (one grid cell per note, searchable by what you wrote and by what you drew). Both use the
   same page-turn flipbook as the reader. */
import { history } from './history.js';
import { Flipbook } from './flipbook.js';
import { frame, esc } from './pages.js';
import { recognize, sketchModel } from './sketch.js';
import { findImage } from './images.js';

const SLOTS = 10;

export function createViews(app) {
  const marks = document.getElementById('view-marks');
  const notes = document.getElementById('view-notes');
  const ring = marks.querySelector('.ring'), ringWrap = marks.querySelector('.ring-wrap');
  const tocArea = marks.querySelector('.spread');
  const toc = new Flipbook(tocArea);
  const notesArea = notes.querySelector('.spread');
  const planner = new Flipbook(notesArea);
  const search = notes.querySelector('input');
  const nstatus = notes.querySelector('.nstatus');
  let marksMode = 'cards', rot = 0, openView = null;

  /* ---------- bookmark ring ----------
     Up to ten slots around one axis. With ten cards or fewer every card has a slot and the wheel simply goes round.
     With more, the slots hold a sliding window of ten: turning forward past the tenth card brings the eleventh into
     the slot the first had, and so on round the whole list; turning back does the same the other way. */
  function cardHtml(r, k, step) {
    const im = r.image || history.image(r.id);
    const th = im && (im.thumb || im.url);
    return '<div class="rcard" role="button" tabindex="0" data-id="' + esc(r.id) + '" style="--a:' + (k * step) + 'deg">' +
      (th ? '<img src="' + esc(th) + '" alt="" loading="lazy">' : '<img alt="" class="seek">') + '<span>' + esc(r.title) + '</span>' +
      '<button type="button" class="rx" aria-label="Remove bookmark: ' + esc(r.title) + '" title="Remove bookmark">&times;</button></div>';
  }
  /* cards whose picture is missing or broken ask the image finder */
  function seekThumbs() {
    ring.querySelectorAll('.rcard img').forEach((im) => {
      const fill = () => { const r = app.byId(im.closest('.rcard').dataset.id); if (r) findImage(r).then((found) => { if (found && im.isConnected) { im.classList.remove('seek'); im.src = found.thumb || found.url; } }); };
      if (im.classList.contains('seek')) fill(); else im.onerror = fill;
    });
  }
  let lastKey = '';
  const mod = (a, n) => ((a % n) + n) % n;
  function buildRing(force) {
    const ids = history.bookmarks().slice().reverse();
    const N = ids.length;
    ringWrap.classList.toggle('empty', !N);
    if (!N) { ring.innerHTML = ''; lastKey = ''; return; }
    const slots = Math.min(N, SLOTS), step = 360 / slots;
    const y = Math.round(-rot / step);                        /* the card facing the reader, counted along the turning */
    let map;
    if (N <= SLOTS) map = ids.map((id, k) => [k, id]);
    else {
      const w = dir >= 0 ? y - (SLOTS - 1) : y;                /* the window of ten that holds the front card */
      map = [];
      for (let k = 0; k < SLOTS; k++) { const j = w + mod(k - w, SLOTS); map.push([k, ids[mod(j, N)]]); }
    }
    const key = map.map((m) => m[1]).join('|');
    if (!force && key === lastKey && ring.childElementCount) return;
    lastKey = key;
    ring.innerHTML = map.map(([k, id]) => { const r = app.byId(id); return r ? cardHtml(r, k, step) : ''; }).join('');
    seekThumbs();
  }
  let dir = 1;
  function setRot(v) {
    if (v !== rot) dir = v < rot ? 1 : -1;                     /* turning the wheel "forward" brings the next card round */
    rot = v; ring.style.setProperty('--rot', rot + 'deg'); buildRing();
  }
  /* turning the wheel works anywhere on the page: drag, swipe or scroll */
  let dragX = null, dragRot = 0, moved = false, lastJump = 0;
  const cardsMode = () => marksMode === 'cards' && !marks.hidden;
  marks.addEventListener('pointerdown', (e) => { if (!cardsMode() || e.target.closest('.menu, .rx')) return; dragX = e.clientX; dragRot = rot; moved = false; });
  marks.addEventListener('pointermove', (e) => { if (dragX == null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 4) moved = true; setRot(dragRot + dx * 0.35); });
  const endDrag = () => { dragX = null; };
  marks.addEventListener('pointerup', endDrag); marks.addEventListener('pointercancel', endDrag); marks.addEventListener('pointerleave', endDrag);
  marks.addEventListener('wheel', (e) => { if (!cardsMode()) return; e.preventDefault(); const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX; setRot(rot - d * 0.25); }, { passive: false });
  marks.addEventListener('click', (e) => {
    const x = e.target.closest('.rx');
    if (x) { e.stopPropagation(); askRemove(x.closest('.rcard').dataset.id); return; }
    const c = e.target.closest('.rcard');
    if (!c || moved || performance.now() - lastJump < 500) { moved = false; return; }
    lastJump = performance.now();
    const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r, false, true);
  });
  marks.addEventListener('keydown', (e) => { const c = e.target.closest('.rcard'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const r = app.byId(c.dataset.id); if (r) app.reader.jumpTo(r, false, true); } });

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
    buildRing(true);
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
    rot = 0; dir = 1; lastKey = ''; ring.style.setProperty('--rot', '0deg'); buildRing(true);
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
      if (openView === 'marks') { if (marksMode === 'cards') setRot(rot - dir * (360 / Math.min(Math.max(1, history.bookmarks().length), SLOTS))); else flipBook(toc, dir); }
      else if (openView === 'notes') flipBook(planner, dir);
    }
  };
}

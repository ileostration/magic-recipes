/* The bookmark shelf: every bookmarked recipe stands as a card in one row, centred on the screen.

   Shape (measured from the owner's reference picture): the card is squashed sideways and sheared so its two upright
   edges stay the same height while the top and bottom edges climb to the right. Each card to the left sits behind the
   one to its right, a little over a third of it showing.

   Hover model. The cards are never what the pointer hits: they are drawn with pointer-events off and everything is
   decided here from the card geometry, so a card that rises can never move out from under the cursor and drop again.
   Nothing waits: the moment the pointer leaves a card's area it comes down and the card under the pointer goes up.
     - an idle card answers only to its visible strip (the part not covered by its right-hand neighbour; the last
       card answers over its whole face);
     - a raised card answers over the whole card where it now is and over the strip where it stood, so it stays up for
       as long as the pointer is anywhere in either place; it keeps its place in the stack, so the cards to its right
       stay in front of it and their strips take the pointer from it;
     - nothing else answers: the air above a card, the shadow around it and the sheared corners are not part of it.
   The raised card shows a cross in its top left corner that removes the bookmark. The facts panel beside it is for
   reading only. A press that moves is a drag (the row slides if it is wider than the screen) and never a click; a
   press that stays put opens the recipe. On touch the first tap raises a card and the second opens it. */
import { history } from './history.js';
import { esc } from './pages.js';
import { findImage } from './images.js';

/* ratio: displayed width / height. slope: how steeply the top edge climbs (rise per unit of width).
   visible: share of a card's width left showing by the card in front. raise: how far a card rises, in card heights. */
export const SHAPE = { ratio: 0.647, slope: 0.31, visible: 0.42, raise: 0.8, natural: 0.75, edge: 40, top: 44, maxH: 320, minH: 150, drop: 0.1, bottom: 130 };
const DRAG_PX = { mouse: 7, pen: 7, touch: 10 };

export function createShelf(app, { wrap, onRemove }) {
  const stage = wrap.querySelector('.shelf');
  const info = wrap.querySelector('.sinfo');
  const edges = { l: wrap.querySelector('.edge.l'), r: wrap.querySelector('.edge.r') };
  let ids = [], cards = [], g = null;
  let dx = 0, lifted = -1, panel = null, active = false;   /* panel: where the facts are drawn (for reading only) */
  let pointer = null;                 /* last mouse position, local to the wrap, or null */
  let press = null;                   /* the press in progress: { id, x, y, dx0, type, dragging } */
  let anim = 0, target = 0;

  const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  /* ---------- geometry ---------- */
  function measure() {
    const vw = wrap.clientWidth, vh = wrap.clientHeight, N = ids.length, S = SHAPE;
    const k = 0.5 * (1 + S.ratio * S.slope);                  /* half the row's height, in card heights */
    let h = Math.min(S.maxH, (vh / 2 - S.top) / (k + S.raise), vw * 0.85);
    h = Math.max(S.minH, h);
    const wd = S.ratio * h, rise = S.slope * wd, step = S.visible * wd;
    const rowW = wd + Math.max(0, N - 1) * step;
    const over = Math.max(0, rowW - (vw - 2 * S.edge));
    /* the whole row sits lower than the middle so a raised card has room above it, but stays clear of the menu */
    const cy = Math.max(S.top + (k + S.raise) * h, Math.min(vh / 2 + S.drop * vh, vh - S.bottom - k * h));
    dx = Math.max(-over / 2, Math.min(over / 2, dx));
    return { vw, vh, N, h, wd, rise, step, rowW, over, up: S.raise * h, wn: S.natural * h, s: wd / (S.natural * h),
      left0: vw / 2 - rowW / 2 + dx, yTop: cy - (h + rise) / 2 };
  }
  const xOf = (i) => g.left0 + i * g.step;
  /* is the point on card i's face when the card is lifted by `up` px? (an exact test on the sheared shape) */
  function onFace(px, py, i, up) {
    const u = (px - xOf(i)) / g.wd;
    if (u < 0 || u > 1) return false;
    const top = g.yTop + g.rise * (1 - u) - up;
    return py >= top && py <= top + g.h;
  }
  /* the part of card i that shows when nothing is raised */
  function onStrip(px, py, i) {
    if (!onFace(px, py, i, 0)) return false;
    return i === g.N - 1 || (px - xOf(i)) / g.wd <= SHAPE.visible;
  }
  /* which card answers at this point */
  function zoneAt(px, py) {
    if (!g || !g.N) return null;
    if (lifted >= 0) {
      /* a card to the right of the raised one is in front of it: its strip takes the pointer */
      for (let i = g.N - 1; i > lifted; i--) if (onStrip(px, py, i)) return { i, part: 'card' };
      if (onFace(px, py, lifted, g.up) || onStrip(px, py, lifted)) return { i: lifted, part: 'card' };
    }
    for (let i = g.N - 1; i >= 0; i--) if (onStrip(px, py, i)) return { i, part: 'card' };
    return null;
  }

  /* ---------- drawing ---------- */
  const tf = (up) => 'translateY(' + (-up) + 'px) matrix(' + g.s + ',' + (-SHAPE.slope * g.s) + ',0,1,0,0)';
  function cardHtml(r, i) {
    const im = r.image || history.image(r.id);
    const th = im && (im.thumb || im.url);
    return '<div class="scard" role="button" tabindex="0" data-id="' + esc(r.id) + '" data-i="' + i + '" aria-label="' + esc(r.title) + '">' +
      (th ? '<img src="' + esc(th) + '" alt="" loading="lazy" draggable="false">' : '<img alt="" class="seek" draggable="false">') +
      '<i class="shade"></i><span>' + esc(r.title) + '</span>' +
      '<button type="button" class="rx" tabindex="-1" aria-label="Remove bookmark: ' + esc(r.title) + '" title="Remove bookmark">&times;</button></div>';
  }
  function seekThumbs() {
    stage.querySelectorAll('.scard img').forEach((im) => {
      const fill = () => { const r = app.byId(im.closest('.scard').dataset.id); if (r) findImage(r).then((found) => { if (!im.isConnected) return; if (found) { im.classList.remove('seek', 'broken'); im.src = found.thumb || found.url; } else im.classList.add('broken'); }); };
      if (im.classList.contains('seek')) fill(); else im.onerror = fill;
    });
  }
  function layout() {
    g = measure();
    wrap.classList.toggle('empty', !g.N);
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], st = c.style;
      st.left = xOf(i) + 'px'; st.top = (g.yTop + g.rise) + 'px'; st.width = g.wn + 'px'; st.height = g.h + 'px';
      st.transform = tf(i === lifted ? g.up : 0);
      st.zIndex = i;
    }
    stage.style.setProperty('--ux', 1 / g.s);                  /* the cross is drawn upright: it undoes the card's squash and shear */
    stage.style.setProperty('--um', SHAPE.slope);
    if (lifted >= 0) placePanel(lifted);
    updateEdges();
  }
  function updateEdges() {
    const left = g.N ? ids.filter((_, i) => xOf(i) + g.step <= 0).length : 0;
    const right = g.N ? ids.filter((_, i) => xOf(i) >= g.vw).length : 0;
    edges.l.hidden = !left; edges.r.hidden = !right;
    edges.l.querySelector('b').textContent = left; edges.r.querySelector('b').textContent = right;
  }

  /* the facts panel: beside the raised card on its right, else its left, else docked above the menu on a narrow screen */
  function fillPanel(i) {
    const r = app.byId(ids[i]);
    const n = (r && r.nutrition) || {};
    const v = (k, unit) => (n[k] == null ? '\u2013' : n[k] + unit);
    info.querySelector('.t').textContent = r ? r.title : '';
    info.querySelector('.kcal').textContent = v('kcal', ' kcal');
    info.querySelector('.pro').textContent = v('protein', ' g');
    info.querySelector('.carb').textContent = v('carbs', ' g');
    info.querySelector('.fat').textContent = v('fat', ' g');
  }
  function placePanel(i) {
    info.classList.remove('dock'); info.style.width = '';
    let pw = info.offsetWidth, ph = info.offsetHeight;
    const x = xOf(i), gap = 8, top = g.yTop - g.up;
    let l, t;
    if (x + g.wd + gap + pw <= g.vw - 8) { l = x + g.wd + gap; t = top; }                  /* beside the raised card, on its right */
    else if (x - gap - pw >= 8) { l = x - gap - pw; t = top; }                               /* ... or on its left */
    else {                                                                                   /* a narrow screen: docked above the menu */
      info.classList.add('dock'); pw = Math.min(380, g.vw - 24); info.style.width = pw + 'px'; ph = info.offsetHeight;
      l = (g.vw - pw) / 2; t = g.vh - 88 - ph;
    }
    info.style.left = l + 'px'; info.style.top = t + 'px';
    panel = { l, t, r: l + pw, b: t + ph };
  }
  function setLift(i) {
    if (i === lifted) return;
    lifted = i;
    for (let k = 0; k < cards.length; k++) {
      const up = k === i;
      cards[k].classList.toggle('lift', up);
      cards[k].style.transform = tf(up ? g.up : 0);
    }
    wrap.classList.toggle('has-lift', i >= 0);
    if (i >= 0) { fillPanel(i); info.classList.add('on'); placePanel(i); }
    else { info.classList.remove('on'); panel = null; }
  }

  /* ---------- the row slides ---------- */
  function setDx(v) {
    dx = v; layout();
    if (pointer && !press) hover(pointer.x, pointer.y);        /* cards moved under a still pointer: look again */
  }
  function animateTo(v) {
    const over = g.over / 2;
    target = Math.max(-over, Math.min(over, v));
    if (anim) return;
    const tick = () => {
      const d = target - dx;
      if (Math.abs(d) < 0.5) { anim = 0; setDx(target); return; }
      setDx(dx + d * 0.28);
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  function reveal(i) {
    const l = xOf(i), r = l + g.wd, m = SHAPE.edge;
    if (l < m) animateTo(dx + (m - l)); else if (r > g.vw - m) animateTo(dx - (r - g.vw + m));
  }

  /* ---------- pointer ---------- */
  /* no waiting: the card under the pointer goes up and any other comes down in the same moment */
  function hover(px, py) {
    const z = zoneAt(px, py);
    wrap.classList.toggle('over', !!z);
    setLift(z ? z.i : -1);
  }
  const ignore = (e) => !!e.target.closest('.edge, .rx');
  function open(i) { const r = app.byId(ids[i]); if (r) app.reader.jumpTo(r, false, true); }

  wrap.addEventListener('pointerdown', (e) => {
    if (!active || ignore(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = local(e);
    press = { id: e.pointerId, x: p.x, y: p.y, dx0: dx, type: e.pointerType, dragging: false };
    if (e.pointerType !== 'touch') pointer = p;
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!active || e.target.closest('.edge')) return;
    const p = local(e);
    if (e.pointerType !== 'touch') pointer = p;
    if (press && press.id === e.pointerId) {
      if (!press.dragging && Math.hypot(p.x - press.x, p.y - press.y) > (DRAG_PX[press.type] || 8)) {
        press.dragging = true;
        wrap.classList.add('dragging');
        try { wrap.setPointerCapture(e.pointerId); } catch (x) { /* pointer gone */ }
        setLift(-1);
      }
      if (press.dragging) { cancelAnimationFrame(anim); anim = 0; setDx(press.dx0 + (p.x - press.x)); return; }
    }
    if (e.pointerType !== 'touch') hover(p.x, p.y);
  });
  function finish(e, cancelled) {
    if (!press || press.id !== e.pointerId) return;
    const p = press, at = local(e);
    press = null;
    wrap.classList.remove('dragging');
    try { wrap.releasePointerCapture(e.pointerId); } catch (x) { /* not captured */ }
    if (p.type !== 'touch') pointer = at;
    if (p.dragging) { if (p.type !== 'touch' && !cancelled) hover(at.x, at.y); return; }    /* hover picks up where the drag left off */
    if (cancelled) return;
    const z = zoneAt(at.x, at.y);
    if (p.type === 'touch') {
      if (!z) { setLift(-1); return; }
      if (z.i === lifted) open(z.i); else setLift(z.i);
    } else if (z) open(z.i);
  }
  wrap.addEventListener('pointerup', (e) => finish(e, false));
  wrap.addEventListener('pointercancel', (e) => finish(e, true));
  /* an interrupted press (released over the menu, or off the page) must never leave the shelf thinking it is still dragging */
  addEventListener('pointerup', (e) => { if (press && press.id === e.pointerId) finish(e, false); });
  addEventListener('blur', () => { press = null; wrap.classList.remove('dragging'); });
  wrap.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = null; wrap.classList.remove('over');
    if (!press) setLift(-1);
  });
  /* scrolling: a wheel or a trackpad swipe slides the row; the side that still has cards off screen is the side it goes */
  function wheel(e) {
    if (!active || !g || !g.N) return;
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 1) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? g.vw : 1;
    animateTo((anim ? target : dx) - d * unit * 0.9);
  }
  edges.l.addEventListener('click', () => animateTo((anim ? target : dx) + g.step * 5));
  edges.r.addEventListener('click', () => animateTo((anim ? target : dx) - g.step * 5));
  /* the cross on the raised card */
  stage.addEventListener('click', (e) => { const x = e.target.closest('.rx'); if (!x) return; e.stopPropagation(); onRemove(x.closest('.scard').dataset.id); });

  /* keyboard: tab to a card, it rises; Enter opens it; the arrows walk the row */
  stage.addEventListener('focusin', (e) => { const c = e.target.closest('.scard'); if (c) { setLift(+c.dataset.i); reveal(+c.dataset.i); } });
  stage.addEventListener('keydown', (e) => {
    const c = e.target.closest('.scard'); if (!c) return;
    const i = +c.dataset.i;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(c.dataset.id); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = cards[Math.max(0, Math.min(cards.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))]; if (n) n.focus(); }
  });
  addEventListener('resize', () => { if (active) layout(); });

  return {
    /* rebuild from the saved bookmarks (newest on the left, so the oldest stands in front) */
    build() {
      active = true;
      ids = history.bookmarks().slice().reverse().filter((id) => app.byId(id));
      stage.innerHTML = ids.map((id, i) => cardHtml(app.byId(id), i)).join('');
      cards = [...stage.querySelectorAll('.scard')];
      lifted = -1; panel = null; info.classList.remove('on', 'dock'); wrap.classList.remove('has-lift', 'over', 'dragging');
      dx = 0; press = null;
      layout();
      seekThumbs();
    },
    stop() { active = false; setLift(-1); },
    wheel,
    /* the menu arrows: raise the next or previous card */
    step(dir) {
      if (!g || !g.N) return;
      const i = lifted < 0 ? (dir > 0 ? 0 : g.N - 1) : Math.max(0, Math.min(g.N - 1, lifted + dir));
      setLift(i); reveal(i);
    },
    /* for tests and the reader's own checks */
    zoneAt: (cx, cy) => { const r = wrap.getBoundingClientRect(); return zoneAt(cx - r.left, cy - r.top); },
    geometry: () => g && { ...g, lifted, ids: ids.slice(), panel },
    get lifted() { return lifted; }
  };
}

/* Scene one: the meadow and the closed grimoire. Click it and it floats and opens on its chant page; click the
   chant page and the reader takes over. Closing the book from the reader brings this scene back, book closed.
   Only four leaves exist here: the thick cover, the chant leaf and two blanks behind it. */
import { frame, marbleClass } from './pages.js';

const NL = 4, GAP = 3;

export function createLanding(app) {
  const section = document.getElementById('landing');
  const book = document.getElementById('book');
  const stage = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const root = document.documentElement;
  let state = 'closed', cur = 0, busy = false, timer = 0, single = false;

  const guards = () => ['tl', 'tr', 'bl', 'br'].map((c) => '<svg class="guard ' + c + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#guard"/></svg>').join('');
  const coverFace = () => '<div class="motif-band"></div>' + frame('cover-frame') + guards() + '<div class="in"><div class="cv">' +
    '<div class="cv-the">The</div><h1 class="cv-title gold">Grimoire<br>of<br>Delicacies</h1>' +
    '<svg class="div" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>';
  const insideCover = () => frame() + '<div class="in"><div class="inside"><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<div>Every reader’s copy opens to a different page. Linger on a recipe and the book learns what you like. Hurry past and it changes its mind.</div>' +
    '<div>Your reading history stays in this browser and nowhere else.</div></div></div>';
  const chantPage = () => frame() + '<div class="in"><div class="chant">' +
    '<div class="ch-head">Hear me, Grimoire</div>' +
    '<p>Bound in stone and morning light,<br>salt of the sea and ember’s bite,<br>leaf and flame and honeyed thyme,<br>wake, old book, and read my mind.</p>' +
    '<svg class="div" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg>' +
    '<p>Of every dish beneath the sun<br>show the one my heart would want,<br>and when I hurry past your pages<br>change your mind, as hunger does.</p>' +
    '<div class="turn">Turn the page to begin</div></div></div>';
  const blankPage = () => frame() + '<div class="in"></div>';

  let html = '<div class="rear ' + marbleClass() + '"><div class="motif-band"></div>' + frame('cover-frame') + guards() + '</div><div class="spine"></div><div class="edge-r"></div><div class="edge-b"></div><div class="edge-t"></div>';
  for (let i = 0; i < NL; i++) {
    html += '<div class="leaf' + (i === 0 ? ' cover-leaf' : '') + '" data-i="' + i + '"><div class="face front ' + marbleClass() + '"></div><div class="face back ' + marbleClass() + '"></div>' +
      (i === 0 ? '<div class="cedge r"></div><div class="cedge t"></div><div class="cedge b"></div>' : '') + '</div>';
  }
  html += '<div class="runes" id="runes-landing" aria-hidden="true"></div>';
  book.innerHTML = html;
  const leaves = [...book.querySelectorAll('.leaf')];
  const faces = leaves.map((l) => ({ front: l.querySelector('.front'), back: l.querySelector('.back') }));
  faces[0].front.innerHTML = coverFace(); faces[0].front.classList.add('cover');
  faces[0].back.innerHTML = insideCover();
  faces[1].front.innerHTML = chantPage(); faces[1].back.innerHTML = blankPage();
  faces[2].front.innerHTML = blankPage(); faces[2].back.innerHTML = blankPage();
  faces[3].front.innerHTML = blankPage(); faces[3].back.innerHTML = blankPage();
  const runes = document.getElementById('runes-landing');

  function layout() {
    const vw = innerWidth, vh = innerHeight;
    const portrait = vw / vh < 0.95;
    const H = 600;
    const P = Math.round(portrait ? 400 : Math.min(Math.max(H * vw / vh / 2, 380), 560));
    const fs = Math.min(P * (portrait ? 0.033 : 0.029), H * 0.0235);
    const s = root.style;
    s.setProperty('--P', P + 'px'); s.setProperty('--H', H + 'px'); s.setProperty('--fs', fs + 'px');
    s.setProperty('--sc', Math.min(vw * 0.6 / P, vh * 0.78 / H));
    s.setProperty('--sf', Math.min(vw * 0.56 / P, vh * 0.72 / H));
    /* held upright on a phone, two pages would be too small to read: the open book then shows its right page alone, centred */
    single = portrait && vw * 0.88 / (2 * P) < 0.75;
    s.setProperty('--so', single ? Math.min(vw * 0.9 / P, vh * 0.72 / H) : Math.min(vw * 0.88 / (2 * P), vh * 0.72 / H));
    if (single) { s.setProperty('--ox', '0px'); s.setProperty('--osx', '1.12'); } else { s.removeProperty('--ox'); s.removeProperty('--osx'); }
    if (state === 'open') say(openHint());
    footprint();
  }
  /* the book presses the grass down only while it rests closed; once clicked it lifts free of the meadow */
  function footprint() {
    if (!app.meadow || section.hidden) return;
    const r = book.getBoundingClientRect();
    app.meadow.setBook(r, state === 'closed' ? 1 : 0);
  }
  layout();
  addEventListener('resize', layout);

  const openHint = () => single ? 'Tap the page to begin' : 'Click the right page to begin';
  function say(t) { hint.classList.add('off'); clearTimeout(say.t); if (!t) return; say.t = setTimeout(() => { hint.textContent = t; hint.classList.remove('off'); }, 280); }
  function setState(s) {
    state = s;
    document.body.dataset.state = s;
    say(s === 'closed' ? 'Click the book' : s === 'open' ? openHint() : '');
    book.setAttribute('aria-label', s === 'closed' ? 'The Grimoire of Delicacies. Activate to open.' : 'The Grimoire of Delicacies, open');
    if (s === 'closed') setTimeout(footprint, 1550);
  }
  /* While the book is shut, nothing but the cover is drawn: the pages behind it (and the cover's own back) are not
     rendered at all, so no engine's ordering of 3D layers or culling of back faces can ever let one show through. They
     are drawn from the moment the cover starts to turn until it has closed again. */
  let holdUntil = 0, holdT = 0;
  function updateShut() { book.classList.toggle('shut', cur === 0 && performance.now() >= holdUntil); }
  function update() {
    updateShut();
    leaves.forEach((lf, i) => {
      const flipped = i < cur;
      const z = flipped ? -(NL - i) * GAP : -i * GAP;
      lf.style.transform = 'translateZ(' + z + 'px) rotateY(' + (flipped ? -180 : 0) + 'deg)';
      lf.classList.toggle('flipped', flipped);
      lf.classList.toggle('near', i === cur || i === cur - 1);
    });
  }
  function goto(n, instant) {
    if (n !== cur && !instant) { holdUntil = performance.now() + 1600; clearTimeout(holdT); holdT = setTimeout(updateShut, 1650); }
    if (instant) { holdUntil = 0; clearTimeout(holdT); }
    cur = n; update();
  }
  function lock(ms) { busy = true; clearTimeout(timer); timer = setTimeout(() => { busy = false; }, ms); }
  update();

  function openBook() {
    if (busy || state !== 'closed') return;
    lock(2900);
    app.meadow && app.meadow.setBook(null, 0);
    setState('float');
    setTimeout(() => { goto(1); setState('open'); }, 1100);
  }
  function closeCover() {
    if (busy || state !== 'open') return;
    lock(2900);
    goto(0); setState('float');
    setTimeout(() => setState('closed'), 1500);
  }
  function begin() {
    if (busy || state !== 'open') return;
    lock(1200);
    section.classList.add('leaving');
    setTimeout(() => { app.openReader(null, true); }, 450);
  }

  stage.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const onBook = !!e.target.closest('.book');
    const right = e.clientX >= innerWidth / 2;
    if (state === 'closed') { if (onBook) openBook(); }
    else if (state === 'open') { if (onBook) { (single || right) ? begin() : closeCover(); } else if (single) closeCover(); }
  });
  addEventListener('keydown', (e) => {
    if (section.hidden) return;
    const k = e.key;
    if (state === 'closed' && (k === 'Enter' || k === ' ')) { e.preventDefault(); openBook(); }
    else if (state === 'open' && (k === 'Enter' || k === ' ' || k === 'ArrowRight')) { e.preventDefault(); begin(); }
    else if (state === 'open' && (k === 'ArrowLeft' || k === 'Escape')) closeCover();
  });

  /* runes around the cover and the open spread */
  const RUNE_FROM = 0x10900, RUNE_TO = 0x1091B;
  setInterval(() => {
    if (section.hidden || document.hidden || runes.childElementCount > 10) return;
    const el = document.createElement('span');
    el.textContent = String.fromCodePoint(RUNE_FROM + Math.floor(Math.random() * (RUNE_TO - RUNE_FROM + 1)));
    const open = state === 'open';
    const z = Math.random();
    let x, y;
    if (open && z < 0.5) { x = 0.05 + Math.random() * 0.4; y = 0.1 + Math.random() * 0.55; }
    else if (!open) { x = 0.52 + Math.random() * 0.46; y = 0.06 + Math.random() * 0.2 + (Math.random() < 0.5 ? 0.6 : 0); }
    else { x = 0.52 + Math.random() * 0.46; y = z < 0.75 ? 0.01 + Math.random() * 0.05 : 0.93 + Math.random() * 0.05; }
    el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%';
    el.style.fontSize = (0.9 + Math.random() * 1.1) + 'em';
    el.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
    el.addEventListener('animationend', () => el.remove());
    runes.appendChild(el);
  }, 520);

  document.addEventListener('visibilitychange', () => { if (!app.meadow || section.hidden) return; document.hidden ? app.meadow.pause() : app.meadow.resume(); });

  return {
    get state() { return state; },
    show(closed) {
      section.hidden = false; section.classList.remove('leaving');
      document.body.dataset.scene = 'landing';
      app.meadow && app.meadow.resume();
      if (closed) { goto(0, true); setState('closed'); } else { goto(1, true); setState('open'); }
      layout();
    },
    hide() {
      section.hidden = true;
      app.meadow && app.meadow.pause();
    },
    openBook, closeCover, begin,
    settle() { layout(); footprint(); }
  };
}

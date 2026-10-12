/* A flat two-column page with a page-turn transition. Not a 3D object: the columns are plain DOM; only the
   transition is 3D, a temporary "flipper" that carries the old page on its front and the new page on its back
   and turns over the spine. In portrait there is one column and the whole page turns. */
import { marbleClass } from './pages.js';

const FLIP_MS = 850, STAGGER = 140;

export class Flipbook {
  constructor(root) {
    this.root = root;
    this.left = root.querySelector('.page.left');
    this.right = root.querySelector('.page.right');
    this.flips = root.querySelector('.flips');
    this.pages = [];
    this.spread = 0;
    this.single = false;
    this.busy = false;
  }
  get spreads() { return this.single ? this.pages.length : Math.ceil(this.pages.length / 2); }
  pagesAt(s) { return this.single ? [this.pages[s] || ''] : [this.pages[2 * s] || '', this.pages[2 * s + 1] || '']; }
  paint(el, html) { el.innerHTML = html; el.className = el.className.replace(/\bm\d o\d\b/g, '').trim() + ' ' + marbleClass(); }
  render(s) {
    const [a, b] = this.pagesAt(s);
    if (this.single) { this.paint(this.left, a); this.right.innerHTML = ''; }
    else { this.paint(this.left, a); this.paint(this.right, b); }
    this.root.classList.toggle('single', this.single);
  }
  /* show pages at spread s. mode: 'none' | 'next' | 'prev' | { cascade: n, dir: 1|-1 } */
  show(pages, s, mode) {
    const fromL = this.left.innerHTML, fromR = this.right.innerHTML;
    const fromClassL = this.left.className, fromClassR = this.right.className;
    this.pages = pages; this.spread = s;
    const [toL, toR] = this.pagesAt(s);
    if (!mode || mode === 'none') { this.render(s); return Promise.resolve(); }
    const dir = mode === 'prev' || (mode.dir === -1) ? -1 : 1;
    const n = mode.cascade ? Math.max(1, mode.cascade) : 1;
    this.render(s);
    const flippers = [];
    for (let i = 0; i < n; i++) {
      const first = i === 0, last = i === n - 1;
      const f = document.createElement('div');
      let front, back, cls;
      if (this.single) {
        cls = 'single ' + (dir > 0 ? 'fwd' : 'back');
        front = first ? fromL : ''; back = last ? toL : '';
        f.style.setProperty('--z', String(n - i));
      } else if (dir > 0) {
        cls = 'right fwd';
        front = first ? fromR : ''; back = last ? toL : '';
      } else {
        cls = 'left back';
        front = first ? fromL : ''; back = last ? toR : '';
      }
      f.className = 'flipper ' + cls;
      f.style.zIndex = String(50 + n - i);
      f.innerHTML = '<div class="page ff ' + (first ? (dir > 0 ? fromClassR : fromClassL).replace('page', '').replace(/left|right/g, '').trim() : marbleClass()) + '">' + front + '</div>' +
        '<div class="page fb ' + marbleClass() + '">' + back + '</div>';
      f.style.transitionDelay = (i * STAGGER) + 'ms';
      this.flips.appendChild(f);
      flippers.push(f);
    }
    this.busy = true;
    void this.flips.offsetWidth;
    flippers.forEach((f) => f.classList.add('go'));
    const total = FLIP_MS + (n - 1) * STAGGER + 40;
    return new Promise((res) => setTimeout(() => { flippers.forEach((f) => f.remove()); this.busy = false; res(); }, total));
  }
}

/* A flat two-column page with a real page turn. The columns are plain DOM; the turn is a temporary 3D "leaf"
   that lifts off one column and lands on the other, carrying the old page on its front and the new page on its back.
   What lies under the lifting leaf is revealed as it rises; what it lands on is covered, and only then swapped.
   Forward (two columns): the right page lifts, the next right page is revealed beneath it, and it lands on the
   left showing the next left page. Backward is the mirror. In portrait there is one column and the whole page turns. */
import { marbleClass } from './pages.js';

const FLIP_MS = 900, STAGGER = 150, LIFT = 3;

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
  pagesAt(s) { return this.single ? [this.pages[s] || '', ''] : [this.pages[2 * s] || '', this.pages[2 * s + 1] || '']; }
  classOf(el) { const m = /\bm\d o\d\b/.exec(el.className); return m ? m[0] : marbleClass(); }
  paint(el, html, cls) {
    el.innerHTML = html;
    el.className = el.className.replace(/\bm\d o\d\b/g, '').replace(/\s+/g, ' ').trim() + ' ' + (cls || marbleClass());
  }
  render(s) {
    const [a, b] = this.pagesAt(s);
    this.root.classList.toggle('single', this.single);
    this.paint(this.left, a);
    if (this.single) this.right.innerHTML = ''; else this.paint(this.right, b);
  }
  /* show the pages at spread s. mode: 'none' | 'next' | 'prev' | { cascade: n, dir: 1 | -1 } */
  show(pages, s, mode) {
    const oldL = { html: this.left.innerHTML, cls: this.classOf(this.left) };
    const oldR = { html: this.right.innerHTML, cls: this.classOf(this.right) };
    this.pages = pages; this.spread = s;
    this.root.classList.toggle('single', this.single);
    const [toL, toR] = this.pagesAt(s);
    if (!mode || mode === 'none' || this.busy) { this.render(s); return Promise.resolve(); }
    const dir = mode === 'prev' || mode.dir === -1 ? -1 : 1;
    const n = mode.cascade ? Math.max(1, mode.cascade) : 1;
    const single = this.single;
    const newClsL = marbleClass(), newClsR = marbleClass();

    /* what lies beneath the leaves while they turn: the page they reveal */
    if (single) { if (dir > 0) this.paint(this.left, toL, newClsL); this.right.innerHTML = ''; }
    else if (dir > 0) this.paint(this.right, toR, newClsR);
    else this.paint(this.left, toL, newClsL);

    const flippers = [];
    for (let i = 0; i < n; i++) {
      const first = i === 0, last = i === n - 1;
      const f = document.createElement('div');
      let front = '', back = '', frontCls = marbleClass(), backCls = marbleClass(), cls, from, to, z;
      if (single) {
        cls = 'single';
        if (dir > 0) { front = first ? oldL.html : ''; if (first) frontCls = oldL.cls; from = 0; to = -180; z = (n - i) * LIFT; }
        else { front = last ? toL : ''; if (last) frontCls = newClsL; from = -180; to = 0; z = -(n - i) * LIFT; }
      } else if (dir > 0) {
        cls = 'right'; front = first ? oldR.html : ''; if (first) frontCls = oldR.cls; back = last ? toL : ''; if (last) backCls = newClsL; from = 0; to = -180; z = (n - i) * LIFT;
      } else {
        cls = 'left'; front = first ? oldL.html : ''; if (first) frontCls = oldL.cls; back = last ? toR : ''; if (last) backCls = newClsR; from = 0; to = 180; z = (n - i) * LIFT;
      }
      f.className = 'flipper ' + cls;
      f.innerHTML = '<div class="page ff ' + frontCls + '">' + front + '</div><div class="page fb ' + backCls + '">' + back + '</div>';
      f.style.transform = 'rotateY(' + from + 'deg) translateZ(' + z + 'px)';
      f.dataset.to = 'rotateY(' + to + 'deg) translateZ(' + z + 'px)';
      f.style.transitionDelay = (i * STAGGER) + 'ms';
      this.flips.appendChild(f);
      flippers.push(f);
    }
    this.busy = true;
    void this.flips.offsetWidth;
    /* the turn lasts as long as the stylesheet says (reduced-motion shortens it), plus the stagger between leaves */
    const dur = parseFloat(getComputedStyle(flippers[0]).transitionDuration) * 1000 || FLIP_MS;
    flippers.forEach((f) => { f.classList.add('go'); f.style.transform = f.dataset.to; });
    const total = dur + (n - 1) * STAGGER + 30;
    return new Promise((res) => setTimeout(() => {
      /* the last leaf has landed: the column beneath takes over its page, then the leaves go */
      if (single) { if (dir < 0) this.paint(this.left, toL, newClsL); }
      else if (dir > 0) this.paint(this.left, toL, newClsL);
      else this.paint(this.right, toR, newClsR);
      flippers.forEach((f) => f.remove());
      this.busy = false;
      res();
    }, total));
  }
}

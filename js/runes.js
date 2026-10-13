/* Glowing Phoenician letters popping over a dark page, as around the crystal. runeLayer(el) spawns them inside el
   while running; pass avoid() returning a client rect to keep them off something (the words in the sphere). */
const FROM = 0x10900, TO = 0x1091B;

export function runeLayer(el, opts) {
  const o = { every: 380, max: 14, size: [20, 46], avoid: null, ...(opts || {}) };
  let timer = 0;
  function pop() {
    if (document.hidden || el.childElementCount > o.max) return;
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    const keep = o.avoid && o.avoid();
    const span = document.createElement('span');
    span.textContent = String.fromCodePoint(FROM + Math.floor(Math.random() * (TO - FROM + 1)));
    let x, y, tries = 0;
    do { x = Math.random() * box.width; y = Math.random() * box.height; tries++; }
    while (keep && tries < 12 && x + box.left > keep.left - 20 && x + box.left < keep.right + 20 && y + box.top > keep.top - 20 && y + box.top < keep.bottom + 20);
    span.style.left = x + 'px'; span.style.top = y + 'px';
    span.style.fontSize = (o.size[0] + Math.random() * (o.size[1] - o.size[0])) + 'px';
    span.style.animationDuration = (2.6 + Math.random() * 2) + 's';
    span.addEventListener('animationend', () => span.remove());
    el.appendChild(span);
  }
  return {
    start() { clearInterval(timer); timer = setInterval(pop, o.every); pop(); },
    stop() { clearInterval(timer); timer = 0; el.innerHTML = ''; }
  };
}

/* Page markup for the reader: photo page, recipe text pages (paginated against a measuring box the size of a
   real column), the nutrition label and the notes page. Shared by the recipe reader and the other views. */
import { GOALS } from './recommend.js';
import { estimate } from './nutrition.js';
import { history } from './history.js';
import { creditHtml } from './images.js';

const DV = { kcal: 2000, protein: 50, carbs: 275, fat: 78, fibre: 28, sugar: 50 };
export const MAX_TEXT = 5;
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* every page gets the same engraved frame: four acanthus corners, a head and tail piece (not on photo pages),
   and a 50% white veil over the marble inside the rule */
export function frame(cls) {
  const photo = cls === 'photo', cover = cls === 'cover-frame';
  return '<div class="frame' + (cls ? ' ' + cls : '') + '"><div class="veil-in"></div>' +
    '<i class="fo c tl"></i><i class="fo c tr"></i><i class="fo c bl"></i><i class="fo c br"></i>' +
    (photo || cover ? '' : '<i class="fo crest-t"></i><i class="fo crest-b"></i>') + '</div>';
}
export const marbleClass = () => 'm' + Math.floor(Math.random() * 4) + ' o' + Math.floor(Math.random() * 4);

export const bmBtn = (r) => { const on = history.isBookmarked(r.id); return '<button class="bm' + (on ? ' on' : '') + '" type="button" data-id="' + esc(r.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove bookmark: ' : 'Bookmark ') + esc(r.title) + '">' +
  '<svg viewBox="0 0 24 32" aria-hidden="true"><path class="r1" d="M2 0h20v31l-10-7.5L2 31z"/><path class="r2" d="M5.5 2.5h13v22.5l-6.5-4.9-6.5 4.9z"/><path class="r3" d="M8 8h8M8 12.5h8" /></svg></button>'; };

/* flip the ribbon on every stored page of one recipe (by id, so two dishes with the same name stay apart) */
export function withBookmark(html, id, on) {
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<button class="bm(?: on)?" type="button" data-id="' + safe + '" aria-pressed="(?:true|false)" aria-label="(?:Remove bookmark: |Bookmark )', 'g');
  return html.replace(re, '<button class="bm' + (on ? ' on' : '') + '" type="button" data-id="' + id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove bookmark: ' : 'Bookmark '));
}

export function imagePage(r) {
  const im = r.image || history.image(r.id) || null;
  const img = im && im.url ? '<img alt="' + esc(im.alt || r.title) + '" src="' + esc(im.url) + '" loading="eager">' : '';
  return frame('photo') + '<div class="in"><div class="ph' + (img ? '' : ' seeking') + '" data-rid="' + esc(r.id) + '">' + img +
    '<div class="cap"><b>' + esc(r.title) + '</b><span>' + esc(r.origin || '') + '</span><span class="cr">' + creditHtml(im, esc) + '</span></div></div></div>' + bmBtn(r);
}
function sourceLine(r) {
  if (r.source === 'wikibooks') return '<div class="src">From the <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Wikibooks Cookbook</a>, text under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</div>';
  return '';
}
const DV2 = { fat: 78, satfat: 20, chol: 300, sodium: 2300, carbs: 275, fibre: 28, added: 50, protein: 50, vitd: 20, calcium: 1300, iron: 18, potassium: 4700 };
export function nutritionPage(r, k) {
  const n = r.nutrition || (r.nutrition = estimate(r));
  const num = (v) => (v == null || isNaN(v) ? 0 : v);
  const pct = (k) => (DV2[k] ? '<i>' + Math.round(num(n[k]) / DV2[k] * 100) + '%</i>' : '<i></i>');
  const row = (label, k, unit, cls) => '<div class="lrow' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><b>' + num(n[k]) + unit + '</b>' + pct(k) + '</div>';
  const fit = GOALS.bodybuilding.fits(r);
  const netKg = n.net_g >= 1000 ? (n.net_g / 1000).toFixed(2).replace(/\.?0+$/, '') + ' kg' : n.net_g + ' g';
  const cov = n.coverage != null && n.coverage < 1 ? ' Read from ' + Math.round(n.coverage * 100) + '% of the ingredient lines.' : '';
  return frame() + '<div class="in"><div class="np"' + (k && k < 1 ? ' style="font-size:' + (0.9 * k).toFixed(3) + 'em"' : '') + '>' +
    '<div class="macro"><div class="mhead">Macros</div><div><b>' + num(n.protein) + 'g</b><span>Protein</span></div><div><b>' + num(n.fat) + 'g</b><span>Fat</span></div><div><b>' + num(n.carbs) + 'g</b><span>Carbs</span></div><small>per serving</small></div>' +
    '<div class="label2">' +
      '<div class="lhead">Nutrition Facts</div>' +
      '<div class="lrow top"><span>Serving size</span><b>1 serving (' + num(n.serving_g) + ' g)</b><i></i></div>' +
      '<div class="lrow top"><span>Servings per container</span><b>' + num(n.servings) + '</b><i></i></div>' +
      '<div class="kcal"><span>Calories</span><b>' + num(n.kcal) + '</b></div>' +
      '<div class="cols"><div class="col"><div class="dv">% Daily Value*</div>' +
        row('Total Fat', 'fat', 'g') + row('Saturated Fat', 'satfat', 'g', 'sub') + row('Trans Fat', 'transfat', 'g', 'sub') +
        row('Cholesterol', 'chol', 'mg') + row('Sodium', 'sodium', 'mg') +
        row('Total Carbohydrate', 'carbs', 'g') + row('Dietary Fiber', 'fibre', 'g', 'sub') + row('Total Sugars', 'sugar', 'g', 'sub') + row('Added Sugars', 'added', 'g', 'sub2') +
      '</div><div class="col"><div class="dv">% Daily Value*</div>' +
        row('Protein', 'protein', 'g') + row('Vitamin D', 'vitd', 'mcg') + row('Calcium', 'calcium', 'mg') + row('Iron', 'iron', 'mg') + row('Potassium', 'potassium', 'mg') +
        '<div class="lfoot">* The % Daily Value tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice. Worked out from this recipe\u2019s own ingredient list; real values vary with brands and portions.' + cov + '</div>' +
      '</div></div>' +
    '</div>' +
    '<div class="ingl"><b>Ingredients:</b> ' + esc((n.ingredients || []).join(', ')) + '.</div>' +
    '<div class="netc"><b>Net contents:</b> about ' + netKg + ' \u00b7 ' + num(n.servings) + ' servings' + (fit ? ' \u00b7 \u2726 fits a bodybuilding plate' : '') + '</div>' +
    '</div></div>' + bmBtn(r);
}
export function notesPage(r) {
  const n = history.note(r.id);
  return frame() + '<div class="in"><div class="notes"><div class="nhead"><h2>Notes</h2>' +
    '<div class="nmode" role="group" aria-label="Notes mode"><button type="button" data-mode="text" class="on" aria-pressed="true">Text</button><button type="button" data-mode="draw" aria-pressed="false">Draw</button></div></div>' +
    '<div class="nsub">Type on the lines, or switch to Draw and sketch with a finger, pen or mouse. Saved as you go.</div>' +
    '<div class="pad text" data-id="' + esc(r.id) + '"><textarea class="note" maxlength="' + history.NOTE_MAX + '" spellcheck="true" placeholder="What did you change? Who did you cook it for?">' + esc(n.text) + '</textarea><canvas class="ink" aria-label="Drawing area"></canvas></div>' +
    '<div class="nfoot"><span class="ncount"></span><span class="nbtns"><button type="button" class="nclear-text">Clear notes</button><button type="button" class="nclear">Clear drawing</button></span></div></div></div>' + bmBtn(r);
}
export const fillerPage = () => frame() + '<div class="in"><div class="filler"><span class="rune-big">\u{10900}</span><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>';
export const blankPage = () => frame() + '<div class="in"></div>';

/* split a recipe into pages that fit `measure`, an offscreen box the size of one column */
export function paginate(r, n, measure, single) {
  const head = '<div class="no">Recipe No. ' + n + '</div><h2 class="gold' + (r.title.length > 26 ? ' long' : '') + '">' + esc(r.title) + '</h2>' +
    '<div class="meta">' + esc([r.serves, r.time].filter(Boolean).join(' · ')) + '</div>' + (r.intro ? '<p class="intro">' + esc(r.intro) + '</p>' : '');
  const blocks = [];
  blocks.push({ t: 'h', html: '<h3>Ingredients</h3>' });
  r.ingredients.forEach((i) => blocks.push({ t: 'ul', html: '<li>' + esc(i) + '</li>' }));
  blocks.push({ t: 'h', html: '<h3>Method</h3>' });
  r.steps.forEach((s, i) => blocks.push({ t: 'ol', html: '<li>' + esc(s) + '</li>', step: i }));
  const src = sourceLine(r);
  const text = [];
  let pageHtml = head, list = null, listHtml = '', stepStart = 0;
  const fits = (html) => { measure.innerHTML = '<div class="page"><div class="rp">' + html + '</div></div>'; const el = measure.querySelector('.rp'); return el.scrollHeight <= el.clientHeight + 1; };
  const close = () => (list ? '<' + list + (list === 'ol' ? ' style="--start:' + stepStart + '"' : '') + '>' + listHtml + '</' + list + '>' : '');
  const flush = (cont) => {
    text.push(frame() + '<div class="in"><div class="rp">' + pageHtml + close() + (cont ? '<div class="more">continued →</div>' : src) + '</div></div>' + bmBtn(r));
    pageHtml = ''; listHtml = '';
  };
  for (const b of blocks) {
    let next = pageHtml, nList = list, nListHtml = listHtml;
    if (b.t === 'h') { next += close(); nList = null; nListHtml = ''; next += b.html; }
    else { if (list !== b.t) { next += close(); nList = b.t; nListHtml = ''; if (b.t === 'ol') stepStart = b.step; } nListHtml += b.html; }
    const probe = next + (nList ? '<' + nList + '>' + nListHtml + '</' + nList + '>' : '') + '<div class="more">x</div>';
    if (fits(probe) || (!listHtml && !pageHtml) || text.length >= MAX_TEXT - 1) { pageHtml = next; list = nList; listHtml = nListHtml; }
    else {
      let carried = '';
      if (!list && /<h3>[^<]*<\/h3>$/.test(pageHtml)) { carried = pageHtml.match(/<h3>[^<]*<\/h3>$/)[0]; pageHtml = pageHtml.slice(0, -carried.length); }
      flush(true);
      if (b.t === 'h') { pageHtml = b.html; list = null; listHtml = ''; }
      else { pageHtml = carried || (b.t === 'ol' ? '<h3>Method, continued</h3>' : '<h3>Ingredients, continued</h3>'); list = b.t; listHtml = b.html; if (b.t === 'ol') stepStart = b.step; }
    }
  }
  flush(false);
  /* the nutrition panel is one page: on a short screen its type steps down until the whole label fits */
  let k = 1;
  for (let i = 0; i < 16; i++) {
    measure.innerHTML = '<div class="page">' + nutritionPage(r, k) + '</div>';
    const el = measure.querySelector('.np');
    el.style.justifyContent = 'flex-start'; /* centred overflow hides its top edge from scrollHeight */
    if (el.scrollHeight <= el.clientHeight + 1 || k <= 0.4) break;
    k = Math.max(0.4, k * Math.min(0.96, el.clientHeight / el.scrollHeight));
  }
  measure.innerHTML = '';
  const pages = [imagePage(r), ...text, nutritionPage(r, k), notesPage(r)];
  if (!single && pages.length % 2 === 1) pages.push(fillerPage()); /* two columns want an even count; one column does not */
  return pages;
}

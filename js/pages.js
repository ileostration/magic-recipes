/* Page markup for the reader: photo page, recipe text pages (paginated against a measuring box the size of a
   real column), the nutrition label and the notes page. Shared by the recipe reader and the other views. */
import { GOALS } from './recommend.js';
import { history } from './history.js';

const DV = { kcal: 2000, protein: 50, carbs: 275, fat: 78, fibre: 28, sugar: 50 };
export const MAX_TEXT = 5;
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* every page gets the same engraved frame: four acanthus corners, a head and tail piece (not on photo pages),
   and a 50% white veil over the marble inside the rule */
export function frame(cls) {
  const photo = cls === 'photo', cover = cls === 'cover-frame';
  return '<div class="frame' + (cls ? ' ' + cls : '') + '"><div class="veil-in"></div>' +
    '<i class="orn c tl"></i><i class="orn c tr"></i><i class="orn c bl"></i><i class="orn c br"></i>' +
    (photo || cover ? '' : '<i class="orn crest-t"></i><i class="orn crest-b"></i>') + '</div>';
}
export const marbleClass = () => 'm' + Math.floor(Math.random() * 4) + ' o' + Math.floor(Math.random() * 4);

export const bmBtn = (r) => { const on = history.isBookmarked(r.id); return '<button class="bm' + (on ? ' on' : '') + '" type="button" data-id="' + esc(r.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove bookmark: ' : 'Bookmark ') + esc(r.title) + '">' +
  '<svg viewBox="0 0 24 32" aria-hidden="true"><path class="r1" d="M2 0h20v31l-10-7.5L2 31z"/><path class="r2" d="M5.5 2.5h13v22.5l-6.5-4.9-6.5 4.9z"/><path class="r3" d="M8 8h8M8 12.5h8" /></svg></button>'; };

export function imagePage(r) {
  const im = r.image || {};
  const img = im.url ? '<img alt="' + esc(im.alt || r.title) + '" src="' + esc(im.url) + '" loading="eager">' : '';
  let credit = '';
  if (im.source === 'unsplash' && im.credit) credit = '<span class="cr">Photo: <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">' + esc(im.credit.name) + '</a> on <a href="' + esc(im.page) + '" target="_blank" rel="noopener">Unsplash</a></span>';
  else if (im.credit) credit = '<span class="cr">Photo: ' + esc(im.credit.artist) + ' · ' + esc(im.credit.license) + ' · <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">Commons</a></span>';
  return frame('photo') + '<div class="in"><div class="ph" data-rid="' + esc(r.id) + '">' + img +
    '<div class="cap"><b>' + esc(r.title) + '</b><span>' + esc(r.origin || '') + '</span>' + credit + '</div></div></div>' + bmBtn(r);
}
function sourceLine(r) {
  if (r.source === 'wikibooks') return '<div class="src">From the <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Wikibooks Cookbook</a>, text under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</div>';
  return '';
}
export function nutritionPage(r) {
  const n = r.nutrition;
  const row = (k, label, unit) => n ? '<div class="nrow"><span>' + label + '</span><b>' + n[k] + (unit || 'g') + '</b><i>' + Math.round(n[k] / DV[k] * 100) + '%</i></div>' : '';
  const fit = n && GOALS.bodybuilding.fits(r);
  const body = n ? '<div class="label"><div class="lhead">Nutrition</div><div class="lsub">Estimated per serving · serves ' + n.servings + '</div>' +
    '<div class="kcal"><span>Calories</span><b>' + n.kcal + '</b></div>' +
    row('protein', 'Protein') + row('carbs', 'Carbohydrates') + row('sugar', 'of which sugars') + row('fat', 'Fat') + row('fibre', 'Fibre') +
    '<div class="lfoot">Percentages are of a 2,000 kcal day. Estimated from the ingredient list; real values vary with brands and portions.</div></div>' +
    (fit ? '<div class="fit">✦ Fits a bodybuilding plate: about ' + n.kcal + ' kcal with ' + n.protein + ' g protein</div>' : '') : '<div class="label"><div class="lhead">Nutrition</div><div class="lsub">No estimate for this recipe.</div></div>';
  return frame() + '<div class="in"><div class="np">' + body + '</div></div>' + bmBtn(r);
}
export function notesPage(r) {
  const n = history.note(r.id);
  return frame() + '<div class="in"><div class="notes"><h2>Notes</h2><div class="nsub">Write with the keyboard, draw with a finger, pen or mouse. Saved as you go.</div>' +
    '<div class="pad" data-id="' + esc(r.id) + '"><textarea class="note" maxlength="' + history.NOTE_MAX + '" spellcheck="true" placeholder="What did you change? Who did you cook it for?">' + esc(n.text) + '</textarea><canvas class="ink" aria-label="Drawing area"></canvas></div>' +
    '<div class="nfoot"><span class="ncount"></span><button type="button" class="nclear">Clear drawing</button></div></div></div>' + bmBtn(r);
}
export const fillerPage = () => frame() + '<div class="in"><div class="filler"><span class="rune-big">\u{10900}</span><svg class="orn" viewBox="0 0 200 20" aria-hidden="true"><use href="#divider"/></svg></div></div>';
export const blankPage = () => frame() + '<div class="in"></div>';

/* split a recipe into pages that fit `measure`, an offscreen box the size of one column */
export function paginate(r, n, measure) {
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
  measure.innerHTML = '';
  const pages = [imagePage(r), ...text, nutritionPage(r), notesPage(r)];
  if (pages.length % 2 === 1) pages.push(fillerPage());
  return pages;
}

/* Live recipes from the Wikibooks Cookbook (text CC BY-SA 4.0, photos per-file licences on Wikimedia Commons).
   Uses the public MediaWiki API with origin=* which allows anonymous cross-origin reads from any website.
   Everything here degrades to null on failure so the book keeps working offline. */
import { tagText } from './tagger.js';

const API = 'https://en.wikibooks.org/w/api.php';
const TIMEOUT = 9000;
const SKIP_TITLE = /^(Cookbook:(Table of Contents|Cuisines?|Recipes|Ingredients|Equipment|Techniques|Cookbook|Dishes|Meals|Glossary|About|Policy|Units|Weights|Recipe |Special)|Cookbook:.*\/)/i;
const SKIP_IMAGE = /(icon|logo|wikibooks|difficulty|star|serving|ambox|edit|question|commons|symbol|time|cookbook_|nutrition|checkmark|\.svg$)/i;

async function api(params) {
  const u = new URL(API);
  Object.entries({ format: 'json', origin: '*', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}

export function pageUrl(title) { return 'https://en.wikibooks.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')); }
export function fileUrl(name, width) {
  return 'https://en.wikibooks.org/w/index.php?title=Special:FilePath/' + encodeURIComponent(name.replace(/ /g, '_')) + '&width=' + (width || 900);
}
export function filePage(name) { return 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name.replace(/ /g, '_')); }

/* titles of Cookbook recipe pages matching a query */
export async function search(q, limit) {
  const j = await api({ action: 'query', list: 'search', srsearch: q + ' prefix:Cookbook:', srlimit: limit || 10, srnamespace: 0 });
  if (!j || !j.query) return null; /* unreachable, not merely empty */
  return j.query.search.map((r) => r.title).filter((t) => /^Cookbook:/.test(t) && !SKIP_TITLE.test(t));
}

function textOf(el) { return (el.textContent || '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim(); }

function listAfter(doc, headingRe) {
  const hs = [...doc.querySelectorAll('h2, h3')];
  const h = hs.find((x) => headingRe.test(textOf(x)));
  if (!h) return [];
  const items = [];
  let el = h.closest('.mw-heading') || h;
  el = el.nextElementSibling;
  while (el && !/^H[23]$/.test(el.tagName) && !el.classList.contains('mw-heading')) {
    if (/^(UL|OL)$/.test(el.tagName)) el.querySelectorAll(':scope > li').forEach((li) => { const t = textOf(li); if (t) items.push(t); });
    else if (el.tagName === 'P') { const t = textOf(el); if (t && headingRe === PROC) items.push(t); }
    el = el.nextElementSibling;
  }
  return items;
}
const ING = /^ingredients?/i, PROC = /^(procedure|method|directions|instructions|preparation)/i;

function infoRow(doc, label) {
  for (const tr of doc.querySelectorAll('tr')) {
    const th = tr.querySelector('th, td');
    if (th && new RegExp('^' + label, 'i').test(textOf(th))) {
      const tds = tr.querySelectorAll('td');
      const v = textOf(tds[tds.length - 1]);
      if (v && v !== textOf(th)) return v;
    }
  }
  return null;
}

function pickImage(images) {
  return (images || []).find((n) => !SKIP_IMAGE.test(n) && /\.(jpe?g|png|webp)$/i.test(n)) || null;
}

/* who to credit for a photo; falls back to a plain Commons credit */
export async function imageCredit(name) {
  const j = await api({ action: 'query', titles: 'File:' + name, prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName' });
  const pages = j && j.query && j.query.pages;
  const p = pages && Object.values(pages)[0];
  const md = p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata;
  const strip = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
  return {
    artist: strip(md && md.Artist && md.Artist.value) || 'Wikimedia Commons contributor',
    license: strip(md && md.LicenseShortName && md.LicenseShortName.value) || 'see file page',
    link: filePage(name)
  };
}

/* one Cookbook page turned into a recipe object the book can render and the engine can score */
export async function fetchRecipe(title) {
  const j = await api({ action: 'parse', page: title, prop: 'text|images|categories', disabletoc: 1, disableeditsection: 1 });
  if (!j || !j.parse) return null;
  const doc = new DOMParser().parseFromString(j.parse.text['*'], 'text/html');
  const ingredients = listAfter(doc, ING).slice(0, 24);
  const steps = listAfter(doc, PROC).slice(0, 14);
  if (ingredients.length < 2 || steps.length < 2) return null;
  const cats = (j.parse.categories || []).map((c) => c['*'].replace(/_/g, ' '));
  const name = title.replace(/^Cookbook:/, '').replace(/_/g, ' ');
  const tags = tagText(name, cats.join(' ') + ' ' + ingredients.join(' '));
  const img = pickImage(j.parse.images);
  return {
    id: 'wb:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: name, source: 'wikibooks', url: pageUrl(title), wiki: title,
    origin: tags.cuisine === 'international' ? 'Wikibooks Cookbook' : tags.cuisine.replace(/-/g, ' '),
    ...tags,
    serves: infoRow(doc, 'Servings|Yield') || '', time: infoRow(doc, 'Time') || '', difficulty: (infoRow(doc, 'Difficulty') || '').toLowerCase(),
    hue: 40,
    image: img ? { url: fileUrl(img, 900), file: img, credit: null } : null,
    intro: '', ingredients, steps
  };
}

/* search then fetch, in parallel, keeping only pages that parsed into real recipes */
export async function searchRecipes(q, limit) {
  const titles = await search(q, limit || 8);
  if (!titles) return null;
  const rs = await Promise.all(titles.map(fetchRecipe));
  return rs.filter(Boolean);
}

/* photo for a bundled recipe that names its Cookbook page */
export async function imageForPage(title) {
  const j = await api({ action: 'parse', page: title, prop: 'images' });
  const img = j && j.parse && pickImage(j.parse.images);
  return img ? { url: fileUrl(img, 900), file: img, credit: null } : null;
}

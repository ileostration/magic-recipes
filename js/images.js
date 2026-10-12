/* Finds a picture for any recipe that has none, or whose picture failed to load, without anyone searching by hand.
   Order: the recipe's own Wikibooks page images, then Wikipedia's lead image for the dish, then a Wikimedia Commons
   file search for the dish name. All three are public APIs that allow anonymous cross-origin reads; all give
   free-licensed pictures that are credited under the photo. Hits are cached in this browser. */
import { history } from './history.js';
import * as wiki from './wikibooks.js';

const WP = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const TIMEOUT = 9000;
const BAD = /(icon|logo|map|flag|diagram|chart|coat_of_arms|seal|emblem|wikibooks|ambox|edit|question|symbol|cookbook_|nutrition|checkmark|\.svg$|\.gif$)/i;
const PHOTO = /\.(jpe?g|png|webp)$/i;
const pending = new Map();

async function api(base, params) {
  const u = new URL(base);
  Object.entries({ format: 'json', origin: '*', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}
const strip = (s) => (s || '').replace(/<[^>]+>/g, '').trim();

/* who to credit: the file's own metadata on Commons, or on English Wikipedia for locally uploaded files */
async function creditFor(file) {
  for (const base of [COMMONS, WP]) {
    const j = await api(base, { action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName' });
    const p = j && j.query && j.query.pages && Object.values(j.query.pages)[0];
    const md = p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata;
    if (md) return { artist: strip(md.Artist && md.Artist.value) || 'Wikimedia contributor', license: strip(md.LicenseShortName && md.LicenseShortName.value) || 'see file page', link: (base === WP ? 'https://en.wikipedia.org/wiki/File:' : 'https://commons.wikimedia.org/wiki/File:') + encodeURIComponent(file.replace(/ /g, '_')) };
  }
  return { artist: 'Wikimedia contributor', license: 'see file page', link: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_')) };
}

/* the lead picture of the Wikipedia article that best matches the dish */
export async function fromWikipedia(title) {
  const j = await api(WP, { action: 'query', generator: 'search', gsrsearch: title, gsrlimit: 3, gsrnamespace: 0, prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: 900 });
  const pages = j && j.query && j.query.pages ? Object.values(j.query.pages).sort((a, b) => a.index - b.index) : [];
  for (const p of pages) {
    if (p.thumbnail && p.pageimage && PHOTO.test(p.pageimage) && !BAD.test(p.pageimage)) {
      return { url: p.thumbnail.source, file: p.pageimage, credit: null, source: 'wikipedia', page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')) };
    }
  }
  return null;
}

/* a photograph on Wikimedia Commons whose file name or description matches the dish */
export async function fromCommons(title) {
  const j = await api(COMMONS, { action: 'query', generator: 'search', gsrsearch: title + ' filetype:bitmap', gsrnamespace: 6, gsrlimit: 8, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: 900, iiextmetadatafilter: 'Artist|LicenseShortName' });
  const pages = j && j.query && j.query.pages ? Object.values(j.query.pages).sort((a, b) => a.index - b.index) : [];
  for (const p of pages) {
    const name = p.title.replace(/^File:/, '');
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || !PHOTO.test(name) || BAD.test(name)) continue;
    const md = ii.extmetadata || {};
    return { url: ii.thumburl || ii.url, file: name, source: 'commons', page: ii.descriptionurl,
      credit: { artist: strip(md.Artist && md.Artist.value) || 'Wikimedia contributor', license: strip(md.LicenseShortName && md.LicenseShortName.value) || 'see file page', link: ii.descriptionurl } };
  }
  return null;
}

/* a picture for this recipe, from the cache or the sources above; null only when every source fails */
export function findImage(r) {
  const cached = history.image(r.id);
  if (cached) return Promise.resolve(cached);
  if (pending.has(r.id)) return pending.get(r.id);
  const p = (async () => {
    let im = null;
    if (r.wiki) im = await wiki.imageForPage(r.wiki);
    const name = r.title.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (!im) im = await fromWikipedia(name);
    if (!im) im = await fromCommons(name);
    if (im && !im.credit && im.file) im.credit = await creditFor(im.file);
    if (im) history.cacheImage(r.id, im);
    pending.delete(r.id);
    return im;
  })();
  pending.set(r.id, p);
  return p;
}

/* mark-up for the credit line under a found picture */
export function creditHtml(im, esc) {
  if (!im) return '';
  if (im.source === 'unsplash' && im.credit) return 'Photo: <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">' + esc(im.credit.name) + '</a> on <a href="' + esc(im.page) + '" target="_blank" rel="noopener">Unsplash</a>';
  if (im.credit) return 'Photo: ' + esc(im.credit.artist) + ' · ' + esc(im.credit.license) + ' · <a href="' + esc(im.credit.link) + '" target="_blank" rel="noopener">' + (im.source === 'wikipedia' ? 'Wikipedia' : 'Commons') + '</a>';
  return '';
}

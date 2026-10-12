// Checks every bundled recipe's `wiki` title against the live Wikibooks API and reports which pages exist,
// which have a usable photo, and which titles need fixing. Needs network access to en.wikibooks.org.
// Run: node tools/check-wiki.mjs            (report only)
//      node tools/check-wiki.mjs --bake     (also writes the photo URL + credit into data/batch-*.json, then rebuild with build-data)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'data');
const API = 'https://en.wikibooks.org/w/api.php';
const SKIP_IMAGE = /(icon|logo|wikibooks|difficulty|star|serving|ambox|edit|question|commons|symbol|time|cookbook_|nutrition|checkmark|\.svg$)/i;
const bake = process.argv.includes('--bake');

async function api(params) {
  const u = new URL(API);
  Object.entries({ format: 'json', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'User-Agent': 'magic-recipes link check (github.com/ileostration/magic-recipes)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const fileUrl = (n) => 'https://en.wikibooks.org/w/index.php?title=Special:FilePath/' + encodeURIComponent(n.replace(/ /g, '_')) + '&width=900';

for (const f of readdirSync(dataDir).filter((x) => /^batch-.*\.json$/.test(x)).sort()) {
  const path = resolve(dataDir, f);
  const arr = JSON.parse(readFileSync(path, 'utf8'));
  let changed = false;
  for (const r of arr) {
    if (!r.wiki) { console.log('  -  ' + r.id + ': no wiki title'); continue; }
    try {
      const j = await api({ action: 'query', titles: r.wiki, prop: 'images', imlimit: 20, redirects: 1 });
      const page = Object.values(j.query.pages)[0];
      if (page.missing !== undefined) { console.log('  X  ' + r.id + ': page not found: ' + r.wiki); continue; }
      const imgs = (page.images || []).map((i) => i.title.replace(/^File:/, ''));
      const img = imgs.find((n) => !SKIP_IMAGE.test(n) && /\.(jpe?g|png|webp)$/i.test(n));
      let credit = null;
      if (img) {
        const m = await api({ action: 'query', titles: 'File:' + img, prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName' });
        const md = Object.values(m.query.pages)[0].imageinfo?.[0]?.extmetadata || {};
        const strip = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
        credit = { artist: strip(md.Artist?.value) || 'Wikimedia Commons contributor', license: strip(md.LicenseShortName?.value) || 'see file page', link: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(img.replace(/ /g, '_')) };
      }
      console.log('  ok ' + r.id + ': ' + page.title + (img ? ' [photo: ' + img + ']' : ' [no photo]'));
      if (bake && img) { r.image = { url: fileUrl(img), file: img, credit }; changed = true; }
    } catch (e) { console.log('  !  ' + r.id + ': ' + e.message); }
  }
  if (changed) { writeFileSync(path, JSON.stringify(arr, null, 2) + '\n'); console.log('wrote ' + f); }
}

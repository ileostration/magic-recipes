// Optional: refresh the per-100 g figures in data/foods.js from USDA FoodData Central (free API key from
// https://api.data.gov/signup/). Each row's `usda` phrase is searched in the SR Legacy and Foundation data sets and
// the first hit's nutrients replace the row's numbers; everything else in the row (portion sizes, class, density) is
// kept. Rows whose phrase finds nothing are left as they are and listed at the end.
// Run: FDC_API_KEY=your-key node tools/fetch-foods.mjs [--dry] [key ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'data', 'foods.js');
const { FOODS } = await import('../data/foods.js');
const key = process.env.FDC_API_KEY;
if (!key) { console.error('Set FDC_API_KEY (free at https://api.data.gov/signup/).'); process.exit(1); }
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.filter((a) => !a.startsWith('--'));
/* FoodData Central nutrient numbers, in the row order of data/foods.js */
const IDS = [1008, 1003, 1005, 1004, 1079, 2000, 1258, 1257, 1253, 1093, 1114, 1087, 1089, 1092];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(phrase) {
  const u = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  u.searchParams.set('api_key', key);
  u.searchParams.set('query', phrase);
  u.searchParams.set('dataType', 'SR Legacy,Foundation');
  u.searchParams.set('pageSize', '1');
  const r = await fetch(u);
  if (r.status === 429) { await sleep(4000); return lookup(phrase); }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + phrase);
  const j = await r.json();
  const hit = j.foods && j.foods[0];
  if (!hit) return null;
  const by = {};
  for (const nu of hit.foodNutrients || []) by[nu.nutrientId] = nu.value;
  /* energy: prefer kcal (1008); some Foundation rows only carry kJ (1062) */
  if (by[1008] == null && by[1062] != null) by[1008] = by[1062] / 4.184;
  return { name: hit.description, values: IDS.map((id) => (by[id] == null ? null : Math.round(by[id] * 100) / 100)) };
}

let src = readFileSync(file, 'utf8');
const missing = [];
for (const k of Object.keys(FOODS)) {
  if (only.length && !only.includes(k)) continue;
  const row = FOODS[k], opt = row[15] || {};
  if (!opt.usda) continue;
  let hit = null;
  try { hit = await lookup(opt.usda); } catch (e) { console.error(k + ': ' + e.message); continue; }
  if (!hit) { missing.push(k); continue; }
  const vals = hit.values.map((v, i) => (v == null ? row[i + 1] : v));
  console.log(k.padEnd(24), '<-', hit.name);
  if (!dry) {
    const re = new RegExp("('" + k.replace(/[-]/g, '\\-') + "': \\[')([^']*)(', )([^{]*)(\\{)");
    src = src.replace(re, (m, a, name, b, nums, c) => a + name + b + vals.join(', ') + ', ' + c);
  }
  await sleep(250); /* the free tier allows 1,000 requests an hour */
}
if (!dry) writeFileSync(file, src);
if (missing.length) console.log('no USDA match for: ' + missing.join(', '));
console.log(dry ? 'dry run, nothing written' : 'data/foods.js updated; run node tools/build-data.mjs');

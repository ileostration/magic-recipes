/* Precision-first recommendation engine.
   A "seed" is what the reader last cared about: a recipe they stayed on, or a search.
   Candidates are scored against the seed on explicit tags and sorted into three strict tiers:
     A  same dish, shares a taste            (chocolate cake -> other chocolate cakes)
     B  same taste family, different dish    (-> brownies, chocolate cookies, hot cocoa)
     C  same dish, different taste           (-> strawberry cake, mirror-glaze cake)
   Nothing weaker than tier C is ever shown; when the tiers run out the crystal ball takes over.
   Quick flips (the reader leaves before DWELL_MS) walk the tiers in sets of SET_SIZE; the ball appears
   on flip number BALL_AT. Reading a recipe resets the walk and re-seeds from that recipe. */
import { STAPLES, tagText } from './tagger.js';

export const DWELL_MS = 10000;
export const SET_SIZE = 3;
export const BALL_AT = 10;

const STRONG = new Set(['chocolate', 'coffee', 'caramel', 'coconut', 'peanut', 'cheese', 'spicy', 'smoky', 'berry', 'citrus', 'apple', 'banana', 'tropical', 'nut', 'cinnamon', 'sesame', 'umami', 'tomato', 'creamy', 'wine', 'honey']);

function seedFromRecipe(r) {
  return { kind: 'recipe', id: r.id, title: r.title, dish: r.dish, flavors: r.flavors || [], mains: r.mains || [], cuisine: r.cuisine, category: r.category, method: r.method || [], text: '' };
}
export function seedFromQuery(q) {
  const t = tagText(q, '');
  t.mains = t.mains.filter((m) => m !== 'fruit'); /* "lemon" names a taste, not a fruit course */
  return { kind: 'query', id: null, title: q, ...t, text: q.toLowerCase().trim() };
}
function seedFromTags(tags, title) { return { kind: 'recipe', id: null, title, text: '', method: [], ...tags }; }

function overlap(a, b) { let n = 0; for (const x of a || []) if ((b || []).includes(x)) n++; return n; }
const SWEET = new Set(['dessert', 'baking', 'drink', 'breakfast']);
const group = (c) => (SWEET.has(c) ? 'sweet' : 'savoury');
const nonStaple = (m) => (m || []).filter((x) => !STAPLES.has(x));
const wordRe = (w) => new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?([^a-z]|$)', 'i');
const TIER_CAP = 8;

export function score(seed, r) {
  let s = 0;
  if (seed.dish && r.dish === seed.dish) s += 6;
  const f = seed.flavors || [];
  f.forEach((fl, i) => { if ((r.flavors || []).includes(fl)) s += i === 0 ? 3.5 : 2; });
  (seed.mains || []).forEach((m) => { if ((r.mains || []).includes(m)) s += STAPLES.has(m) ? 0.3 : 1.6; });
  if (seed.category && r.category === seed.category) s += 2;
  if (seed.cuisine && seed.cuisine !== 'international' && r.cuisine === seed.cuisine) s += 1.5;
  s += 0.5 * overlap(seed.method, r.method);
  if (seed.text) {
    if (wordRe(seed.text).test(r.title)) s += 8;
    else seed.text.split(/\s+/).forEach((w) => { if (w.length > 2 && wordRe(w).test(r.title)) s += 2.5; });
  }
  return s;
}

/* Which tier, if any, a candidate belongs to for this seed. Strict on purpose. */
function tierOf(seed, r) {
  if (r.id === seed.id) return null;
  const sameDish = !!seed.dish && r.dish === seed.dish;
  const sharedF = (seed.flavors || []).filter((x) => (r.flavors || []).includes(x));
  const sharedM = nonStaple(seed.mains).filter((x) => (r.mains || []).includes(x));
  const strong = sharedF.some((x) => STRONG.has(x));

  if (seed.kind === 'query') {
    if (seed.text && wordRe(seed.text).test(r.title)) return 'A';
    if (!seed.dish) {
      /* "something with lemon", "spicy chicken": every named taste and ingredient must be present */
      const needF = seed.flavors || [], needM = nonStaple(seed.mains);
      if ((needF.length || needM.length) && needF.every((x) => (r.flavors || []).includes(x)) && needM.every((x) => (r.mains || []).includes(x))) return 'B';
      const words = seed.text.split(/\s+/).filter((w) => w.length > 2);
      if (!needF.length && !needM.length && words.some((w) => wordRe(w).test(r.title))) return 'A';
      return null;
    }
  }
  if (sameDish && (sharedF.length || sharedM.length)) return 'A';
  if (!sameDish && group(seed.category) === group(r.category)) {
    const sameCat = seed.category === r.category;
    if (sharedF.length >= 2) return 'B';
    if (strong && (sameCat || sharedM.length)) return 'B';
    if (sharedF.length >= 1 && sharedM.length >= 1 && sameCat) return 'B';
  }
  if (sameDish) return 'C';
  return null;
}

export function rank(seed, pool, exclude) {
  const tiers = { A: [], B: [], C: [] };
  for (const r of pool) {
    if (exclude && exclude.has(r.id)) continue;
    const t = tierOf(seed, r);
    if (t) tiers[t].push({ r, s: score(seed, r) });
  }
  for (const k in tiers) tiers[k] = tiers[k].sort((a, b) => b.s - a.s).map((x) => x.r).slice(0, TIER_CAP);
  return tiers;
}

export class Recommender {
  constructor(pool, history) {
    this.pool = pool.slice();
    this.history = history;
    this.seed = null;
    this.quick = 0;
    this.shown = new Set();
    this.tiers = null;
    this.restoreSeed();
  }
  addToPool(recipes) {
    const ids = new Set(this.pool.map((r) => r.id));
    for (const r of recipes) if (!ids.has(r.id)) { this.pool.push(r); ids.add(r.id); }
    this.tiers = null;
  }
  restoreSeed() {
    const last = this.history && this.history.lastInterest();
    if (!last) return;
    if (last.kind === 'search') this.seed = seedFromQuery(last.q);
    else {
      const r = this.pool.find((x) => x.id === last.id);
      this.seed = r ? seedFromRecipe(r) : seedFromTags(last.tags, last.title);
    }
  }
  setSeedRecipe(r) { this.seed = seedFromRecipe(r); this.quick = 0; this.tiers = null; }
  setSeedQuery(q) { this.seed = seedFromQuery(q); this.quick = 0; this.tiers = null; }
  get tierIndex() { return Math.min(2, Math.floor(this.quick / SET_SIZE)); }
  /* true when the next flip should summon the crystal ball instead of a recipe */
  wantsBall() { return this.quick >= BALL_AT - 1; }

  noteFlip(recipe, dwellMs) {
    if (!recipe) return;
    if (dwellMs >= DWELL_MS) {
      this.history && this.history.noteRead(recipe, dwellMs);
      this.setSeedRecipe(recipe);
    } else {
      this.quick++;
    }
  }

  /* next recipe for the current tier; walks forward through tiers when one is empty */
  next() {
    if (!this.seed) return this.discover();
    if (!this.tiers) this.tiers = rank(this.seed, this.pool, null);
    const order = ['A', 'B', 'C'];
    for (let i = this.tierIndex; i < 3; i++) {
      const list = this.tiers[order[i]].filter((r) => !this.shown.has(r.id));
      if (list.length) { this.shown.add(list[0].id); return { recipe: list[0], tier: order[i] }; }
    }
    /* seed exhausted: the crystal ball is the right next thing */
    return null;
  }
  /* anything the tiers still hold, for the ball to show as "you might also like" */
  remaining() {
    if (!this.seed) return [];
    if (!this.tiers) this.tiers = rank(this.seed, this.pool, null);
    return [...this.tiers.A, ...this.tiers.B, ...this.tiers.C].filter((r) => !this.shown.has(r.id));
  }

  /* no interest yet: well-loved dishes, avoiding ones this browser has recently seen */
  discover() {
    const seen = new Set(this.history ? this.history.recentlySeen(30) : []);
    const fresh = this.pool.filter((r) => !this.shown.has(r.id) && !seen.has(r.id) && r.source !== 'wikibooks');
    const list = fresh.length ? fresh : this.pool.filter((r) => !this.shown.has(r.id));
    if (!list.length) return null;
    const r = list[Math.floor(Math.random() * Math.min(list.length, 12))];
    this.shown.add(r.id);
    return { recipe: r, tier: 'D' };
  }

  /* search: local matches first, ranked by the same rules; returns the ranked list for the caller to display */
  search(q) {
    this.setSeedQuery(q);
    this.history && this.history.noteSearch(q, { dish: this.seed.dish, flavors: this.seed.flavors });
    this.shown = new Set();
    this.tiers = rank(this.seed, this.pool, null);
    return [...this.tiers.A, ...this.tiers.B, ...this.tiers.C];
  }
}

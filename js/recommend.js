/* Recommendation engine.
   Two signals are blended:
     1. explicit taste tags (dish, flavours, defining ingredients, category, cuisine) in strict tiers
     2. a scikit-learn nearest-neighbour table (data/similar.json, built offline by tools/similarity.py)
        over TF-IDF of tags + ingredient words, used to order within tiers and to fill a thin tier
   A "seed" is what the reader last cared about: a recipe they stayed on, or a search. Candidates fall into
     A  same dish, shares a taste            (chocolate cake -> other chocolate cakes)
     B  same taste family, different dish    (-> brownies, chocolate cookies, hot cocoa)
     C  same dish, different taste           (-> strawberry cake, mirror-glaze cake)
   Nothing weaker is shown; when the tiers run out the crystal ball takes over.
   A reader "goal" (e.g. bodybuilding) narrows the pool to recipes whose estimated nutrition fits it.
   Quick flips (leaving before DWELL_MS) walk the tiers in sets of SET_SIZE; the ball appears on flip BALL_AT.
   Reading a recipe resets the walk and re-seeds from that recipe. */
import { STAPLES, tagText } from './tagger.js';

export const DWELL_MS = 10000;
export const SET_SIZE = 3;
export const BALL_AT = 10;

export const GOALS = {
  bodybuilding: {
    label: 'Bodybuilding',
    words: /\b(bodybuild\w*|body building|high[- ]protein|protein|gym|muscle|macros?|bulk\w*|lean (meals?|eating)|cutting|gains?)\b/i,
    fits: (r) => (r.goal || []).includes('bodybuilding') || (r.nutrition && r.nutrition.protein >= 40 && r.nutrition.kcal >= 380 && r.nutrition.kcal <= 700)
  }
};
export function goalFromText(q) { for (const k in GOALS) if (GOALS[k].words.test(q)) return k; return null; }

const STRONG = new Set(['chocolate', 'coffee', 'caramel', 'coconut', 'peanut', 'cheese', 'spicy', 'smoky', 'berry', 'citrus', 'apple', 'banana', 'tropical', 'nut', 'cinnamon', 'sesame', 'umami', 'tomato', 'creamy', 'wine', 'honey', 'matcha']);
const SWEET = new Set(['dessert', 'baking', 'drink', 'breakfast']);
const group = (c) => (SWEET.has(c) ? 'sweet' : 'savoury');
const nonStaple = (m) => (m || []).filter((x) => !STAPLES.has(x));
const wordRe = (w) => new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?([^a-z]|$)', 'i');
const TIER_CAP = 8;

export function seedFromRecipe(r) {
  return { kind: 'recipe', id: r.id, title: r.title, dish: r.dish, flavors: r.flavors || [], mains: r.mains || [], cuisine: r.cuisine, category: r.category, method: r.method || [], text: '', sim: r.similar || [] };
}
export function seedFromQuery(q) {
  const t = tagText(q, '');
  t.mains = t.mains.filter((m) => m !== 'fruit'); /* "lemon" names a taste, not a fruit course */
  return { kind: 'query', id: null, title: q, ...t, text: q.toLowerCase().trim(), sim: [] };
}
function seedFromTags(tags, title) { return { kind: 'recipe', id: null, title, text: '', method: [], sim: [], ...tags }; }

function overlap(a, b) { let n = 0; for (const x of a || []) if ((b || []).includes(x)) n++; return n; }
function simTo(seed, id) { const hit = (seed.sim || []).find((p) => p[0] === id); return hit ? hit[1] : 0; }

export function score(seed, r) {
  let s = 0;
  if (seed.dish && r.dish === seed.dish) s += 6;
  const f = seed.flavors || [];
  f.forEach((fl, i) => { if ((r.flavors || []).includes(fl)) s += i === 0 ? 3.5 : 2; });
  (seed.mains || []).forEach((m) => { if ((r.mains || []).includes(m)) s += STAPLES.has(m) ? 0.3 : 1.6; });
  if (seed.category && r.category === seed.category) s += 2;
  if (seed.cuisine && seed.cuisine !== 'international' && r.cuisine === seed.cuisine) s += 1.5;
  s += 0.5 * overlap(seed.method, r.method);
  s += 8 * simTo(seed, r.id); /* scikit-learn neighbour score, 0..1 */
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
  const sim = simTo(seed, r.id);

  if (seed.kind === 'query') {
    if (seed.text && wordRe(seed.text).test(r.title)) return 'A';
    if (!seed.dish) {
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
    if (sim >= 0.42 && sameCat) return 'B';           /* the neighbour model is confident and it is the same kind of course */
  }
  if (sameDish) return 'C';
  if (sim >= 0.5 && group(seed.category) === group(r.category)) return 'C';
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
    this.all = pool.slice();
    this.history = history;
    this.goal = history ? history.goal : null;
    this.seed = null;
    this.quick = 0;
    this.shown = new Set();
    this.tiers = null;
    this.restoreSeed();
  }
  /* the pool the engine works on: everything, or only what fits the reader's goal */
  get pool() {
    const g = this.goal && GOALS[this.goal];
    if (!g) return this.all;
    const fit = this.all.filter(g.fits);
    return fit.length >= 4 ? fit : this.all;
  }
  setGoal(goal) {
    this.goal = goal && GOALS[goal] ? goal : null;
    this.history && this.history.setGoal(this.goal);
    this.tiers = null;
  }
  addToPool(recipes) {
    const ids = new Set(this.all.map((r) => r.id));
    for (const r of recipes) if (!ids.has(r.id)) { this.all.push(r); ids.add(r.id); }
    this.tiers = null;
  }
  restoreSeed() {
    const last = this.history && this.history.lastInterest();
    if (!last) return;
    if (last.kind === 'search') this.seed = seedFromQuery(last.q);
    else {
      const r = this.all.find((x) => x.id === last.id);
      this.seed = r ? seedFromRecipe(r) : seedFromTags(last.tags, last.title);
    }
  }
  setSeedRecipe(r) { this.seed = seedFromRecipe(r); this.quick = 0; this.tiers = null; }
  setSeedQuery(q) { this.seed = seedFromQuery(q); this.quick = 0; this.tiers = null; }
  get tierIndex() { return Math.min(2, Math.floor(this.quick / SET_SIZE)); }
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
    return null;
  }
  remaining() {
    if (!this.seed) return [];
    if (!this.tiers) this.tiers = rank(this.seed, this.pool, null);
    return [...this.tiers.A, ...this.tiers.B, ...this.tiers.C].filter((r) => !this.shown.has(r.id));
  }

  /* long-term taste: every recipe scored against the reader's recent reads, recency-weighted */
  profileScore(r) {
    const reads = this.history ? this.history.weightedReads() : [];
    let s = 0;
    for (const rd of reads) {
      if (rd.id === r.id) continue;
      const src = this.all.find((x) => x.id === rd.id);
      const seed = src ? seedFromRecipe(src) : seedFromTags(rd.tags, rd.title);
      s += rd.w * score(seed, r);
    }
    return s;
  }

  /* what to open to: the reader's taste profile if they have one, a crowd-pleaser otherwise */
  discover() {
    const seen = new Set(this.history ? this.history.recentlySeen(30) : []);
    const base = this.pool.filter((r) => !this.shown.has(r.id) && r.source !== 'wikibooks');
    let fresh = base.filter((r) => !seen.has(r.id));
    if (!fresh.length) fresh = base;
    if (!fresh.length) return null;
    const hasHistory = this.history && this.history.data.reads.length > 0;
    let pick;
    if (hasHistory) {
      const ranked = fresh.map((r) => ({ r, s: this.profileScore(r) })).sort((a, b) => b.s - a.s);
      const top = ranked.slice(0, 4).filter((x) => x.s > 0);
      pick = top.length ? top[Math.floor(Math.random() * top.length)].r : null;
    }
    if (!pick) {
      const goalFirst = this.goal ? fresh.filter((r) => (r.goal || []).includes(this.goal)) : [];
      const list = goalFirst.length ? goalFirst : fresh;
      pick = list[Math.floor(Math.random() * Math.min(list.length, 12))];
    }
    this.shown.add(pick.id);
    return { recipe: pick, tier: 'D' };
  }

  /* search: sets the seed (and a goal if the words imply one); returns ranked results */
  search(q) {
    const g = goalFromText(q);
    if (g) this.setGoal(g);
    this.setSeedQuery(q);
    this.history && this.history.noteSearch(q, { dish: this.seed.dish, flavors: this.seed.flavors, goal: g });
    this.shown = new Set();
    this.tiers = rank(this.seed, this.pool, null);
    let list = [...this.tiers.A, ...this.tiers.B, ...this.tiers.C];
    if (g && !list.length) {
      /* "bodybuilding recipes": no dish named, so the goal pool itself is the answer, best fits first */
      const near = (r) => (r.nutrition ? Math.abs(r.nutrition.kcal - 500) + Math.max(0, 40 - r.nutrition.protein) * 6 : 999);
      list = this.pool.filter((r) => GOALS[g].fits(r)).sort((a, b) => near(a) - near(b));
      this.seed = null;
    }
    return list;
  }
}

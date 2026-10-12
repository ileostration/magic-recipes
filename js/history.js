/* Per-browser memory of what the reader lingered on and searched for. Lives in localStorage only;
   nothing leaves the device. Every access is guarded because storage can be blocked or full. */
const KEY = 'recipe-book.v1';
const MAX_READS = 40, MAX_SEARCHES = 20, MAX_SEEN = 300;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d && typeof d === 'object') return d; }
  } catch (e) { /* ignore */ }
  return { reads: [], searches: [], seen: [], live: {} };
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

export const history = {
  data: load(),
  noteRead(recipe, dwellMs) {
    const d = this.data;
    d.reads = d.reads.filter((r) => r.id !== recipe.id);
    d.reads.push({ id: recipe.id, title: recipe.title, dwell: Math.round(dwellMs), at: Date.now(),
      tags: { dish: recipe.dish, flavors: recipe.flavors, mains: recipe.mains, cuisine: recipe.cuisine, category: recipe.category } });
    if (d.reads.length > MAX_READS) d.reads.splice(0, d.reads.length - MAX_READS);
    save(d);
  },
  noteSeen(id) {
    const d = this.data;
    d.seen = d.seen.filter((x) => x !== id);
    d.seen.push(id);
    if (d.seen.length > MAX_SEEN) d.seen.splice(0, d.seen.length - MAX_SEEN);
    save(d);
  },
  noteSearch(q, tags) {
    const d = this.data;
    d.searches.push({ q, tags, at: Date.now() });
    if (d.searches.length > MAX_SEARCHES) d.searches.splice(0, d.searches.length - MAX_SEARCHES);
    save(d);
  },
  /* the most recent thing the reader showed interest in: a search or a recipe they stayed on */
  lastInterest() {
    const d = this.data;
    const r = d.reads[d.reads.length - 1], s = d.searches[d.searches.length - 1];
    if (r && s) return r.at >= s.at ? { kind: 'read', ...r } : { kind: 'search', ...s };
    if (r) return { kind: 'read', ...r };
    if (s) return { kind: 'search', ...s };
    return null;
  },
  recentlySeen(n) { return this.data.seen.slice(-n); },
  cacheLive(recipe) {
    const d = this.data;
    d.live = d.live || {};
    d.live[recipe.id] = { ...recipe, cachedAt: Date.now() };
    const ids = Object.keys(d.live);
    if (ids.length > 60) { ids.sort((a, b) => d.live[a].cachedAt - d.live[b].cachedAt); ids.slice(0, ids.length - 60).forEach((k) => delete d.live[k]); }
    save(d);
  },
  liveRecipes() { return Object.values(this.data.live || {}); },
  clear() { this.data = { reads: [], searches: [], seen: [], live: {} }; save(this.data); }
};

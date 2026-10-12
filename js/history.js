/* Per-browser memory: what the reader lingered on, searched for, bookmarked and wrote.
   Lives in localStorage only; nothing leaves the device. Every access is guarded because storage can be blocked or full. */
const KEY = 'grimoire.v2';
const MAX_READS = 60, MAX_SEARCHES = 30, MAX_SEEN = 300, NOTE_MAX = 520;

function blank() { return { reads: [], searches: [], seen: [], live: {}, bookmarks: [], notes: {}, goal: null, images: {} }; }
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d && typeof d === 'object') return { ...blank(), ...d }; }
  } catch (e) { /* ignore */ }
  return blank();
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

/* plain text only: no tags, braces, backticks or control characters, and a hard length cap */
export function cleanNote(s) {
  return String(s || '').replace(/[<>{}`\\]/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, NOTE_MAX);
}

export const history = {
  data: load(),
  NOTE_MAX,
  noteRead(recipe, dwellMs) {
    const d = this.data;
    d.reads = d.reads.filter((r) => r.id !== recipe.id);
    d.reads.push({ id: recipe.id, title: recipe.title, dwell: Math.round(dwellMs), at: Date.now(),
      tags: { dish: recipe.dish, flavors: recipe.flavors, mains: recipe.mains, cuisine: recipe.cuisine, category: recipe.category, goal: recipe.goal || [] } });
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
  /* recent reads, newest first, with a recency weight 1 .. 0.2 */
  weightedReads() {
    const reads = this.data.reads.slice().reverse();
    return reads.map((r, i) => ({ ...r, w: Math.max(0.2, 1 - i * 0.08) }));
  },
  recentlySeen(n) { return this.data.seen.slice(-n); },

  get goal() { return this.data.goal; },
  setGoal(g) { this.data.goal = g || null; save(this.data); },

  isBookmarked(id) { return this.data.bookmarks.includes(id); },
  toggleBookmark(id) {
    const d = this.data;
    if (d.bookmarks.includes(id)) d.bookmarks = d.bookmarks.filter((x) => x !== id);
    else d.bookmarks.push(id);
    save(d);
    return d.bookmarks.includes(id);
  },
  bookmarks() { return this.data.bookmarks.slice(); },

  /* a note is { text, drawing (png data url or ''), labels [{label, score}], at } */
  note(id) {
    const n = this.data.notes[id];
    if (!n) return { text: '', drawing: '', labels: [], at: 0 };
    if (typeof n === 'string') return { text: n, drawing: '', labels: [], at: 0 };
    return { text: n.text || '', drawing: n.drawing || '', labels: n.labels || [], at: n.at || 0 };
  },
  setNote(id, patch) {
    const d = this.data;
    const cur = this.note(id);
    const next = { ...cur, ...patch, at: Date.now() };
    if ('text' in patch) next.text = cleanNote(patch.text);
    if (!next.text && !next.drawing) delete d.notes[id]; else d.notes[id] = next;
    save(d);
    return next;
  },
  allNotes() { return Object.keys(this.data.notes).map((id) => ({ id, ...this.note(id) })).sort((a, b) => b.at - a.at); },

  /* pictures found automatically for recipes that had none; kept for 30 days */
  image(id) { const im = (this.data.images || {})[id]; return im && Date.now() - (im.at || 0) < 30 * 864e5 ? im : null; },
  cacheImage(id, im) {
    const d = this.data; d.images = d.images || {};
    d.images[id] = { ...im, at: Date.now() };
    const ids = Object.keys(d.images);
    if (ids.length > 80) { ids.sort((a, b) => d.images[a].at - d.images[b].at); ids.slice(0, ids.length - 80).forEach((k) => delete d.images[k]); }
    save(d);
  },
  cacheLive(recipe) {
    const d = this.data;
    d.live = d.live || {};
    d.live[recipe.id] = { ...recipe, cachedAt: Date.now() };
    const ids = Object.keys(d.live);
    if (ids.length > 60) { ids.sort((a, b) => d.live[a].cachedAt - d.live[b].cachedAt); ids.slice(0, ids.length - 60).forEach((k) => delete d.live[k]); }
    save(d);
  },
  liveRecipes() { return Object.values(this.data.live || {}); },
  clear() { const keep = { bookmarks: this.data.bookmarks, notes: this.data.notes, images: this.data.images }; this.data = { ...blank(), ...keep }; save(this.data); }
};

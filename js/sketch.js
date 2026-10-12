/* Ink on the notes page: pointer drawing (finger, pen, mouse, trackpad) on a canvas laid over the ruled lines,
   with a tap (no movement) handing focus to the text area beneath. Drawings are saved as small PNGs.
   recognize() labels a drawing with a doodle classifier (Quick, Draw! categories) that runs in the browser via
   transformers.js, fetched on first use; without a network the labels simply stay empty and note search falls
   back to text. */
const TAP_PX = 5;

export function attachSketch(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let drawing = false, moved = false, last = null, dirty = 0, pid = null;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      const keep = canvas.width ? canvas.toDataURL() : null;
      canvas.width = w; canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      style();
      if (keep) restore(keep);
    }
  }
  function style() { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2d12'; ctx.lineWidth = 2.2; }
  function restore(url) {
    if (!url) return;
    const im = new Image();
    im.onload = () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(im, 0, 0, canvas.width, canvas.height); ctx.restore(); };
    im.src = url;
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    size();
    drawing = true; moved = false; last = pos(e); pid = e.pointerId;
    canvas.setPointerCapture(pid);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing || e.pointerId !== pid) return;
    e.stopPropagation();
    const p = pos(e);
    if (!moved && Math.hypot(p.x - last.x, p.y - last.y) < TAP_PX) return;
    if (!moved) { moved = true; opts.onStrokeStart && opts.onStrokeStart(); }
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  const end = (e) => {
    if (!drawing || (e && e.pointerId !== pid)) return;
    e && e.stopPropagation();
    drawing = false;
    try { canvas.releasePointerCapture(pid); } catch (x) { /* ignore */ }
    if (!moved) { opts.onTap && opts.onTap(e); return; }
    clearTimeout(dirty);
    dirty = setTimeout(() => opts.onChange && opts.onChange(exportPng()), 350);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  ['click', 'dblclick'].forEach((ev) => canvas.addEventListener(ev, (e) => e.stopPropagation()));
  function exportPng() {
    /* downscale to keep localStorage small */
    const W = 480, H = Math.round(480 * canvas.height / Math.max(1, canvas.width));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(canvas, 0, 0, W, H);
    return c.toDataURL('image/png');
  }
  size();
  if (opts.initial) restore(opts.initial);
  return { size, restore, clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); opts.onChange && opts.onChange(''); }, isEmpty() { return !canvas.width; } };
}

/* ---- doodle recognition ---- */
const MODEL = 'Xenova/quickdraw-mobilevit-small';
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2/dist/transformers.min.js';
let pipe = null, loading = null, failed = false;
export const sketchModel = {
  get state() { return failed ? 'failed' : pipe ? 'ready' : loading ? 'loading' : 'idle'; },
  async load() {
    if (pipe || failed) return pipe;
    if (!loading) {
      loading = (async () => {
        try {
          const tf = await import(/* webpackIgnore: true */ LIB);
          const p = await tf.pipeline('image-classification', MODEL, { dtype: 'q8' });
          pipe = async (dataUrl) => {
            const img = await tf.RawImage.fromURL(dataUrl);
            const out = await p(img, { top_k: 5 });
            return out.filter((o) => o.score > 0.04).map((o) => ({ label: o.label.toLowerCase(), score: Math.round(o.score * 100) / 100 }));
          };
          return pipe;
        } catch (e) { failed = true; return null; }
      })();
    }
    return loading;
  }
};

/* the classifier was trained on black strokes on white: flatten the transparent drawing before sending it */
function flatten(dataUrl) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
      const s = Math.min(256 / im.width, 256 / im.height);
      x.drawImage(im, (256 - im.width * s) / 2, (256 - im.height * s) / 2, im.width * s, im.height * s);
      resolve(c.toDataURL('image/png'));
    };
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}
export async function recognize(dataUrl) {
  if (!dataUrl) return [];
  const p = await sketchModel.load();
  if (!p) return [];
  const flat = await flatten(dataUrl);
  if (!flat) return [];
  try { return await p(flat); } catch (e) { return []; }
}

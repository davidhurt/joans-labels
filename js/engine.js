// Layout + drawing engine shared by labels and envelopes.
// Layout produces "ops" in inches; the same ops are drawn on screen (canvas)
// and into the PDF that gets printed, so what she sees is what prints.
import { labelRect } from './templates.js';

const { jsPDF } = window.jspdf;
const measurer = new jsPDF({ unit: 'in', format: 'letter' });

// Lettering choices. The three "builtin" ones are part of every PDF;
// the others are free Google fonts (in /fonts) that get loaded when chosen.
export const FONTS = [
  { id: 'helvetica', name: 'Helvetica', css: 'Helvetica, Arial, sans-serif', builtin: true },
  { id: 'lato', name: 'Modern', css: '"JL Lato", Helvetica, sans-serif',
    files: { normal: 'Lato-Regular.ttf', bold: 'Lato-Bold.ttf', italic: 'Lato-Italic.ttf', bolditalic: 'Lato-BoldItalic.ttf' } },
  { id: 'times', name: 'Classic', css: '"Times New Roman", Times, serif', builtin: true },
  { id: 'crimson', name: 'Elegant', css: '"JL Crimson", Georgia, serif',
    files: { normal: 'CrimsonText-Regular.ttf', bold: 'CrimsonText-Bold.ttf', italic: 'CrimsonText-Italic.ttf', bolditalic: 'CrimsonText-BoldItalic.ttf' } },
  { id: 'patrick', name: 'Handwritten', css: '"JL Patrick", "Comic Sans MS", cursive', files: { normal: 'PatrickHand-Regular.ttf' } },
  { id: 'greatvibes', name: 'Fancy Script', css: '"JL GreatVibes", "Snell Roundhand", cursive', files: { normal: 'GreatVibes-Regular.ttf' } },
  { id: 'courier', name: 'Typewriter', css: '"Courier New", Courier, monospace', builtin: true },
];
const fontById = (id) => FONTS.find(f => f.id === id) || FONTS[0];
export function fontCss(id) { return fontById(id).css; }

function wantedStyle(s) {
  return s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal';
}
/** The closest style this font really has (script fonts have no bold). */
function pdfStyle(s, fontId = s.font) {
  const want = wantedStyle(s);
  const f = fontById(fontId);
  if (f.builtin || !f.files) return want;
  for (const st of [want, want === 'bolditalic' ? 'bold' : null, want === 'bolditalic' ? 'italic' : null, 'normal']) {
    if (st && f.files[st]) return st;
  }
  return 'normal';
}

// ---- loading the extra fonts ----
const fontData = {};          // file name -> base64 text
const loaded = new Set();     // font ids ready to use
const loading = {};
async function fileB64(file) {
  if (fontData[file]) return fontData[file];
  const buf = new Uint8Array(await (await fetch(`fonts/${file}`)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return (fontData[file] = btoa(bin));
}
function registerIn(doc, f) {
  for (const [st, file] of Object.entries(f.files)) {
    doc.addFileToVFS(file, fontData[file]);
    doc.addFont(file, f.id, st);
  }
}
/** Make sure a font is ready for measuring, the screen picture and the PDF. */
export function ensureFont(id) {
  const f = fontById(id);
  if (f.builtin || loaded.has(f.id)) return Promise.resolve();
  if (!loading[f.id]) {
    loading[f.id] = (async () => {
      await Promise.all(Object.values(f.files).map(fileB64));
      registerIn(measurer, f);
      const fam = f.css.split(',')[0];
      await Promise.all(Object.keys(f.files).map(st => document.fonts.load(
        `${st.includes('italic') ? 'italic ' : ''}${st.includes('bold') ? 'bold ' : ''}16px ${fam}`).catch(() => {})));
      loaded.add(f.id);
    })().catch((e) => { console.warn('Font failed to load', id, e); delete loading[f.id]; });
  }
  return loading[f.id];
}
function usable(id) { const f = fontById(id); return f.builtin || loaded.has(f.id) ? f.id : 'helvetica'; }
/** Put the chosen extra font (if any) into a new PDF. */
function registerFor(doc, id) { const f = fontById(id); if (!f.builtin && loaded.has(f.id)) registerIn(doc, f); }

/** Replace characters the PDF fonts cannot show. */
export function cleanText(str) {
  return String(str || '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');
}

export function textWidth(str, font, style, sizePt) {
  const id = usable(font);
  measurer.setFont(id, pdfStyle(style, id));
  return measurer.getStringUnitWidth(str) * sizePt / 72;
}

const LINE = 1.18; // line height multiple

/** Break lines that are too wide at spaces. */
function wrapLines(lines, style, size, boxW) {
  const out = [];
  for (const line of lines) {
    if (textWidth(line, style.font, style, size) <= boxW) { out.push(line); continue; }
    const words = line.split(' ');
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (cur && textWidth(next, style.font, style, size) > boxW) { out.push(cur); cur = w; }
      else cur = next;
    }
    out.push(cur);
  }
  return out;
}

/**
 * Find the largest font size (<= maxPt) so the text fits in the box.
 * Long lines are wrapped onto a second line before the writing is made smaller.
 */
export function fitText(lines, style, boxW, boxH, maxPt, minPt = 5) {
  const fits = (ls, s) => !ls.some(l => textWidth(l, style.font, style, s) > boxW) && ls.length * s * LINE / 72 <= boxH;
  // 1) shrink a little (down to 80%) without breaking lines
  for (let s = maxPt; s >= Math.max(minPt, maxPt * 0.8); s -= 0.5) if (fits(lines, s)) return { size: s, lines };
  // 2) then allow long lines to wrap, shrinking further if needed
  for (let s = maxPt; s > minPt; s -= 0.5) {
    const w = wrapLines(lines, style, s, boxW);
    if (fits(w, s)) return { size: s, lines: w };
    if (fits(lines, s)) return { size: s, lines };
  }
  return { size: minPt, lines: wrapLines(lines, style, minPt, boxW) };
}

/** Lay out a block of text inside a box. */
export function layoutText(text, style, box, opts = {}) {
  let lines = cleanText(text).split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '' && lines.length > 1) lines.pop();
  if (lines.every(l => !l.trim())) return { ops: [], size: style.size, shrunk: false };
  let size = style.size;
  if (!opts.noShrink) ({ size, lines } = fitText(lines, style, box.w, box.h, style.size));
  const lh = size * LINE / 72;
  const blockH = lines.length * lh;
  let y;
  const va = style.valign || 'middle';
  if (va === 'top') y = box.y;
  else if (va === 'bottom') y = box.y + box.h - blockH;
  else y = box.y + (box.h - blockH) / 2;
  const ops = [];
  const align = style.align || 'left';
  // Left-aligned blocks are centred as a block (like Avery does) when asked.
  let blockX = box.x;
  if (align === 'left' && opts.centerBlock) {
    const maxW = Math.max(...lines.map(l => textWidth(l, style.font, style, size)));
    blockX = box.x + Math.max(0, (box.w - maxW) / 2);
  }
  lines.forEach((str, i) => {
    const base = y + i * lh + size * 0.78 / 72 + (lh - size / 72) / 2;
    let x = blockX;
    if (align === 'center') x = box.x + box.w / 2;
    if (align === 'right') x = box.x + box.w;
    const fid = usable(style.font);
    ops.push({ type: 'text', x, y: base, str, size, font: fid, fstyle: pdfStyle(style, fid), color: style.color || '#000000', align });
  });
  return { ops, size, shrunk: size < style.size - 0.01 };
}

// ---------- labels ----------

/** The area inside a label that is safe to print in. */
export function innerBox(t, r) {
  if (t.shape === 'round') {
    const k = 0.72;
    return { x: r.x + r.w * (1 - k) / 2, y: r.y + r.h * (1 - k) / 2, w: r.w * k, h: r.h * k };
  }
  const pad = Math.min(0.12, Math.min(r.w, r.h) * 0.1);
  const padX = Math.max(pad, Math.min(0.15, r.w * 0.06));
  return { x: r.x + padX, y: r.y + pad, w: r.w - padX * 2, h: r.h - pad * 2 };
}

/** Build drawing ops for one label. */
export function layoutLabel(t, r, text, design) {
  const style = design.style;
  let box = innerBox(t, r);
  const ops = [];
  let shrunk = false;
  const pic = design.picture;
  const hasText = String(text || '').trim().length > 0;
  if (pic && pic.src) {
    const ar = (pic.ar || 1);
    let ib;
    if (!hasText) {
      ib = { ...box };
    } else if (pic.pos === 'top') {
      ib = { x: box.x, y: box.y, w: box.w, h: box.h * 0.45 };
      box = { x: box.x, y: box.y + box.h * 0.5, w: box.w, h: box.h * 0.5 };
    } else {
      const s = Math.min(box.h, box.w * 0.35);
      ib = { x: box.x, y: box.y + (box.h - s) / 2, w: s, h: s };
      const gap = Math.min(0.08, box.w * 0.04);
      box = { x: box.x + s + gap, y: box.y, w: box.w - s - gap, h: box.h };
    }
    // contain image in ib
    let w = ib.w, h = ib.w / ar;
    if (h > ib.h) { h = ib.h; w = h * ar; }
    ops.push({ type: 'image', src: pic.src, x: ib.x + (ib.w - w) / 2, y: ib.y + (ib.h - h) / 2, w, h });
  }
  if (hasText) {
    const res = layoutText(text, style, box, { centerBlock: style.align === 'left' && style.centerBlock !== false });
    ops.push(...res.ops);
    shrunk = res.shrunk;
  }
  return { ops, shrunk };
}

/**
 * Work out what goes on each label of each page.
 * Returns { pages: [ [ {index, text} ... ] ], total }
 */
export function planLabels(t, design, addresses, formatAddress) {
  // Labels already peeled off the first sheet (only when she said the sheet is partly used).
  const used = new Set(design.partial ? (design.used || []).filter(i => i >= 0 && i < t.count) : []);
  if (!design.partial && design.startAt) for (let i = 0; i < Math.min(design.startAt, t.count); i++) used.add(i);
  // Every label used? Then there is nothing to print on that sheet: start on a fresh one.
  if (used.size >= t.count && design.mode !== 'each') used.clear();
  const free0 = t.count - used.size;
  const items = [];
  if (design.mode === 'addresses') {
    const ids = design.addressIds || [];
    const copies = Math.max(1, design.copiesEach || 1);
    for (const id of ids) {
      const a = addresses.find(x => x.id === id);
      if (!a) continue;
      for (let c = 0; c < copies; c++) items.push(formatAddress(a));
    }
  } else if (design.mode === 'same') {
    const sheets = Math.max(1, design.sheets || 1);
    const n = free0 + (sheets - 1) * t.count;
    for (let i = 0; i < n; i++) items.push(design.text || '');
  } else {
    // each label different, one sheet; used labels are left alone
    const pages = [[]];
    for (let i = 0; i < t.count; i++) {
      if (used.has(i)) continue;
      pages[0].push({ index: i, text: (design.each || {})[i] || '' });
    }
    return { pages, total: pages[0].filter(p => p.text.trim()).length, usedFirst: used };
  }
  const pages = [];
  let page = [], idx = 0, p = 0;
  const skip = (i) => p === 0 && used.has(i);
  for (const text of items) {
    while (idx < t.count && skip(idx)) idx++;
    if (idx >= t.count) { pages.push(page); page = []; idx = 0; p++; }
    page.push({ index: idx, text });
    idx++;
  }
  if (page.length || !pages.length) pages.push(page);
  return { pages, total: items.length, usedFirst: used };
}

// ---------- drawing ----------

const imgCache = new Map();
export function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  imgCache.set(src, p);
  return p;
}

/** Draw ops onto a canvas context. ctx is already scaled so 1 unit = 1 inch. */
export async function drawOpsCanvas(ctx, ops) {
  for (const op of ops) {
    if (op.type === 'text') {
      ctx.fillStyle = op.color;
      const st = (op.fstyle.includes('italic') ? 'italic ' : '') + (op.fstyle.includes('bold') ? 'bold ' : '');
      ctx.font = `${st}${op.size / 72}px ${fontCss(op.font)}`;
      ctx.textAlign = op.align === 'center' ? 'center' : op.align === 'right' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(op.str, op.x, op.y);
    } else if (op.type === 'image') {
      const im = await loadImage(op.src);
      if (im) ctx.drawImage(im, op.x, op.y, op.w, op.h);
    }
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#000000');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/** Make a transform for printer alignment (nudge + scale about page centre). */
export function makeTransform(pageW, pageH, nudge) {
  const k = (nudge && nudge.scale ? nudge.scale : 100) / 100;
  const dx = (nudge && nudge.x) || 0, dy = (nudge && nudge.y) || 0;
  const cx = pageW / 2, cy = pageH / 2;
  return {
    k,
    X: x => cx + (x - cx) * k + dx,
    Y: y => cy + (y - cy) * k + dy,
  };
}

export async function drawOpsPdf(doc, ops, tf) {
  for (const op of ops) {
    if (op.type === 'text') {
      doc.setFont(op.font, op.fstyle);
      doc.setFontSize(op.size * tf.k);
      doc.setTextColor(...hexToRgb(op.color));
      doc.text(op.str, tf.X(op.x), tf.Y(op.y), { align: op.align === 'center' ? 'center' : op.align === 'right' ? 'right' : 'left', baseline: 'alphabetic' });
    } else if (op.type === 'image') {
      const fmt = /^data:image\/jpe?g/i.test(op.src) ? 'JPEG' : 'PNG';
      try { doc.addImage(op.src, fmt, tf.X(op.x), tf.Y(op.y), op.w * tf.k, op.h * tf.k, undefined, 'FAST'); } catch (e) { console.warn(e); }
    }
  }
}

/** Build a PDF of label sheets. */
export async function labelsPdf(t, design, plan, nudge, { test = false } = {}) {
  await ensureFont(design.style.font);
  const doc = new jsPDF({ unit: 'in', format: [t.pageW, t.pageH], orientation: t.pageW > t.pageH ? 'landscape' : 'portrait' });
  registerFor(doc, design.style.font);
  const tf = makeTransform(t.pageW, t.pageH, nudge);
  for (let p = 0; p < plan.pages.length; p++) {
    if (p > 0) doc.addPage([t.pageW, t.pageH], t.pageW > t.pageH ? 'landscape' : 'portrait');
    if (test) {
      doc.setDrawColor(150); doc.setLineWidth(0.01);
      for (let i = 0; i < t.count; i++) {
        const r = labelRect(t, i);
        if (t.shape === 'round') doc.ellipse(tf.X(r.x + r.w / 2), tf.Y(r.y + r.h / 2), r.w / 2 * tf.k, r.h / 2 * tf.k);
        else doc.rect(tf.X(r.x), tf.Y(r.y), r.w * tf.k, r.h * tf.k);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text('TEST PAGE - plain paper. Hold it behind a label sheet up to a window to check the lines match.', t.pageW / 2, 0.22, { align: 'center' });
    }
    for (const cell of plan.pages[p]) {
      const r = labelRect(t, cell.index);
      const { ops } = layoutLabel(t, r, cell.text, design);
      await drawOpsPdf(doc, ops, tf);
    }
  }
  return doc;
}

// ---------- envelopes ----------

export function layoutEnvelope(env, to, from, style) {
  const ops = [];
  const s = { ...style };
  if (from && from.trim()) {
    const fs = { ...s, size: Math.min(s.size * 0.75, 12), bold: false, italic: false, align: 'left', valign: 'top' };
    const box = { x: 0.35, y: 0.3, w: env.w * 0.45, h: env.h * 0.32 };
    ops.push(...layoutText(from, fs, box).ops);
  }
  if (to && to.trim()) {
    const box = { x: env.w * 0.36, y: env.h * 0.38, w: env.w * 0.58, h: env.h * 0.5 };
    if (env.h > 6) { box.x = env.w * 0.3; box.y = env.h * 0.35; box.w = env.w * 0.6; box.h = env.h * 0.4; }
    ops.push(...layoutText(to, { ...s, align: 'left', valign: 'middle' }, box, { centerBlock: false }).ops);
  }
  return ops;
}

export async function envelopesPdf(env, list, style) {
  await ensureFont(style.font);
  const doc = new jsPDF({ unit: 'in', format: [env.w, env.h], orientation: 'landscape' });
  registerFor(doc, style.font);
  const tf = makeTransform(env.w, env.h, null);
  for (let i = 0; i < list.length; i++) {
    if (i > 0) doc.addPage([env.w, env.h], 'landscape');
    await drawOpsPdf(doc, layoutEnvelope(env, list[i].to, list[i].from, style), tf);
  }
  return doc;
}

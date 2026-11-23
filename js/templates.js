// Avery label templates and envelope sizes.
// All measurements are in inches. A template describes one sheet:
//   pageW/pageH  sheet size
//   w/h          size of one label
//   cols/rows    how many across / down
//   left/top     distance from sheet edge to the first label
//   hp/vp        distance from the start of one label to the start of the next
// If left/top/hp/vp are omitted the labels are spread evenly on the sheet.

const T = [];
function add(t) {
  const pageW = t.pageW || 8.5, pageH = t.pageH || 11;
  const out = { pageW, pageH, shape: 'rect', ...t };
  if (out.left == null) {
    const gx = (pageW - out.cols * out.w) / (out.cols + 1);
    out.left = gx; out.hp = out.w + gx;
  }
  if (out.top == null) {
    const gy = (pageH - out.rows * out.h) / (out.rows + 1);
    out.top = gy; out.vp = out.h + gy;
  }
  if (out.hp == null) out.hp = out.w;
  if (out.vp == null) out.vp = out.h;
  out.count = out.cols * out.rows;
  out.id = String(t.sku);
  T.push(out);
}

// ---------- Address & mailing ----------
add({ sku: 5160, cat: 'address', name: 'Address Labels', size: '1" × 2⅝"',
  w: 2.625, h: 1, cols: 3, rows: 10, left: 0.1875, top: 0.5, hp: 2.75, vp: 1, popular: true,
  also: [5260, 5520, 5630, 5660, 5810, 5960, 5970, 5971, 5972, 5979, 5980, 6240, 6460, 8160, 8250, 8460, 8660, 8810, 8920, 15160, 15660, 15700, 16460, 18160, 18260, 18660, 28660, 32660, 38260, 45160, 48160, 48260, 48360, 48460, 48860, 48960, 55160, 58160, 58660, 80509, 85560, 88560, 95520] });
add({ sku: 5161, cat: 'address', name: 'Address Labels (wide)', size: '1" × 4"',
  w: 4, h: 1, cols: 2, rows: 10, left: 0.15625, top: 0.5, hp: 4.1875, vp: 1,
  also: [5261, 5961, 8161, 8461, 18161, 48161] });
add({ sku: 5162, cat: 'address', name: 'Address Labels (large)', size: '1⅓" × 4"',
  w: 4, h: 4 / 3, cols: 2, rows: 7, left: 0.15625, top: 0.8333, hp: 4.1875, vp: 4 / 3,
  also: [5262, 5522, 5962, 8162, 8252, 8462, 15162, 18162, 48462, 48862] });
add({ sku: 5159, cat: 'address', name: 'Address Labels (1½")', size: '1½" × 4"',
  w: 4, h: 1.5, cols: 2, rows: 7, left: 0.15625, top: 0.25, hp: 4.1875, vp: 1.5,
  also: [8159] });

// ---------- Return address ----------
add({ sku: 5167, cat: 'return', name: 'Return Address Labels (small)', size: '½" × 1¾"',
  w: 1.75, h: 0.5, cols: 4, rows: 20, left: 0.28125, top: 0.5, hp: 2.0625, vp: 0.5, popular: true,
  also: [5267, 6467, 8167, 8667, 8927, 15267, 15667, 18167, 18667, 48267, 48467, 48767] });
add({ sku: 5195, cat: 'return', name: 'Return Address Labels', size: '⅔" × 1¾"',
  w: 1.75, h: 2 / 3, cols: 4, rows: 15, left: 0.28125, top: 0.5, hp: 2.0625, vp: 2 / 3,
  also: [5155, 8195, 15695, 18195, 18295, 48335] });

// ---------- Shipping ----------
add({ sku: 5163, cat: 'shipping', name: 'Shipping Labels', size: '2" × 4"',
  w: 4, h: 2, cols: 2, rows: 5, left: 0.15625, top: 0.5, hp: 4.1875, vp: 2, popular: true,
  also: [5263, 5523, 5963, 8163, 8253, 8463, 8763, 15163, 18163, 18863, 38863, 48163, 48863, 58163] });
add({ sku: 5164, cat: 'shipping', name: 'Shipping Labels (large)', size: '3⅓" × 4"',
  w: 4, h: 10 / 3, cols: 2, rows: 3, left: 0.15625, top: 0.5, hp: 4.1875, vp: 10 / 3,
  also: [5264, 5524, 8164, 8254, 8464, 48464] });
add({ sku: 5168, cat: 'shipping', name: 'Shipping Labels (4 per sheet)', size: '3½" × 5"',
  w: 3.5, h: 5, cols: 2, rows: 2, left: 0.5, top: 0.5, hp: 4, vp: 5, also: [8168] });
add({ sku: 5126, cat: 'shipping', name: 'Half-Sheet Labels', size: '5½" × 8½"',
  w: 8.5, h: 5.5, cols: 1, rows: 2, left: 0, top: 0, hp: 8.5, vp: 5.5,
  also: [5526, 8126, 15516, 18126] });
add({ sku: 5165, cat: 'shipping', name: 'Full-Sheet Label', size: '8½" × 11"',
  w: 8.5, h: 11, cols: 1, rows: 1, left: 0, top: 0, hp: 8.5, vp: 11,
  also: [5265, 8165, 8255, 8465, 15265, 18665] });

// ---------- Round & square (stickers, jars, gifts) ----------
add({ sku: 22807, cat: 'round', shape: 'round', name: 'Round Labels 2"', size: '2" circle',
  w: 2, h: 2, cols: 3, rows: 4, popular: true, also: [80510, 94503], checkFit: true });
add({ sku: 5294, cat: 'round', shape: 'round', name: 'Round Labels 2½"', size: '2½" circle',
  w: 2.5, h: 2.5, cols: 3, rows: 4, also: [22830], checkFit: true });
add({ sku: 5293, cat: 'round', shape: 'round', name: 'Round Labels 1⅔"', size: '1⅔" circle',
  w: 5 / 3, h: 5 / 3, cols: 4, rows: 6, also: [22808, 8293], checkFit: true });
add({ sku: 22817, cat: 'round', shape: 'round', name: 'Round Labels 3"', size: '3" circle',
  w: 3, h: 3, cols: 2, rows: 3, checkFit: true });
add({ sku: 22805, cat: 'round', name: 'Square Labels 1½"', size: '1½" square',
  w: 1.5, h: 1.5, cols: 4, rows: 6, checkFit: true, rounded: true });
add({ sku: 22806, cat: 'round', name: 'Square Labels 2"', size: '2" square',
  w: 2, h: 2, cols: 3, rows: 4, checkFit: true, rounded: true });

// ---------- Name badges ----------
add({ sku: 5395, cat: 'badge', name: 'Name Badges', size: '2⅓" × 3⅜"',
  w: 3.375, h: 7 / 3, cols: 2, rows: 4, left: 0.6875, top: 0.59375, hp: 3.75, vp: 2.5, popular: true,
  also: [8395, 45395, 5095, 74541] });
add({ sku: 5392, cat: 'badge', name: 'Name Badge Inserts', size: '3" × 4"',
  w: 4, h: 3, cols: 2, rows: 3, left: 0.25, top: 1, hp: 4, vp: 3, also: [5384] });

// ---------- Cards ----------
add({ sku: 5371, cat: 'cards', name: 'Business Cards', size: '2" × 3½"',
  w: 3.5, h: 2, cols: 2, rows: 5, left: 0.75, top: 0.5, hp: 3.5, vp: 2,
  also: [5376, 5377, 5871, 5874, 5876, 5877, 5911, 8371, 8471, 8859, 8869, 8871, 8873, 8876, 8877, 8879, 27871, 27881, 28371, 28877, 38371, 88220] });
add({ sku: 5389, cat: 'cards', name: 'Postcards (2 per sheet)', size: '4" × 6"',
  w: 6, h: 4, cols: 1, rows: 2, left: 1.25, top: 1, hp: 6, vp: 5, also: [8387] });
add({ sku: 5689, cat: 'cards', name: 'Postcards (4 per sheet)', size: '4¼" × 5½"',
  w: 4.25, h: 5.5, cols: 2, rows: 2, left: 0, top: 0, hp: 4.25, vp: 5.5, also: [3381, 8383, 8577] });

// ---------- File folders & binders ----------
add({ sku: 5366, cat: 'folder', name: 'File Folder Labels', size: '⅔" × 3 7⁄16"',
  w: 3.4375, h: 2 / 3, cols: 2, rows: 15, left: 0.53, top: 0.5, hp: 4, vp: 2 / 3, popular: true,
  also: [5066, 5166, 5266, 5366, 5966, 8066, 8366, 8478, 45366, 48266, 48366, 75366] });

export const LABEL_CATEGORIES = [
  { id: 'address', name: 'Address labels', icon: '🏠' },
  { id: 'return', name: 'Return address', icon: '↩️' },
  { id: 'shipping', name: 'Shipping & big labels', icon: '📦' },
  { id: 'round', name: 'Round & square', icon: '⭕' },
  { id: 'badge', name: 'Name badges', icon: '🙂' },
  { id: 'cards', name: 'Cards & postcards', icon: '🪪' },
  { id: 'folder', name: 'Folders & binders', icon: '🗂️' },
];

export const TEMPLATES = T;

export function findTemplate(id) {
  return T.find(t => t.id === String(id)) || null;
}

/** Search by Avery number (or words). Returns templates, best first. */
export function searchTemplates(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return T;
  const digits = q.replace(/[^0-9]/g, '');
  if (digits.length >= 3 && /^[a-z\s#-]*\d+\s*$/i.test(q)) {
    const exact = T.filter(t => String(t.sku) === digits || (t.also || []).map(String).includes(digits));
    if (exact.length) return exact;
    return T.filter(t => String(t.sku).startsWith(digits) || (t.also || []).some(a => String(a).startsWith(digits)));
  }
  const words = q.split(/\s+/);
  return T.filter(t => {
    const hay = `${t.name} ${t.size} ${t.cat} ${t.sku} ${(t.also || []).join(' ')}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** A custom template built from measurements. */
export function customTemplate(c) {
  const t = {
    id: 'custom', sku: 'Custom', cat: 'custom', name: 'My own size', shape: c.shape || 'rect',
    pageW: 8.5, pageH: 11, w: +c.w, h: +c.h, cols: +c.cols, rows: +c.rows,
  };
  if (c.left !== '' && c.left != null && c.hp) { t.left = +c.left; t.hp = +c.hp; }
  if (c.top !== '' && c.top != null && c.vp) { t.top = +c.top; t.vp = +c.vp; }
  const gx = (t.pageW - t.cols * t.w) / (t.cols + 1);
  const gy = (t.pageH - t.rows * t.h) / (t.rows + 1);
  if (t.left == null) { t.left = gx; t.hp = t.w + gx; }
  if (t.top == null) { t.top = gy; t.vp = t.h + gy; }
  t.count = t.cols * t.rows;
  t.size = `${fmtIn(t.h)} × ${fmtIn(t.w)}`;
  return t;
}

export function fmtIn(v) {
  const r = Math.round(v * 100) / 100;
  return `${r}"`;
}

/** Rectangle of label i on a sheet. */
export function labelRect(t, i) {
  const c = i % t.cols, r = Math.floor(i / t.cols);
  return { x: t.left + c * t.hp, y: t.top + r * t.vp, w: t.w, h: t.h };
}

// ---------- Envelopes ----------
export const ENVELOPES = [
  { id: '10', name: '#10 Business', size: '4⅛" × 9½"', w: 9.5, h: 4.125, use: 'Letters, bills, business mail', popular: true, mac: 'Envelope #10' },
  { id: '9', name: '#9', size: '3⅞" × 8⅞"', w: 8.875, h: 3.875, use: 'Reply envelopes', mac: 'Envelope #9' },
  { id: '6.75', name: '#6¾', size: '3⅝" × 6½"', w: 6.5, h: 3.625, use: 'Bill payments, checks', mac: 'Envelope #6 3/4' },
  { id: 'A2', name: 'A2 Card', size: '4⅜" × 5¾"', w: 5.75, h: 4.375, use: 'Small note cards, thank-yous', popular: true, mac: 'A2 Envelope' },
  { id: 'A6', name: 'A6 Card', size: '4¾" × 6½"', w: 6.5, h: 4.75, use: 'Greeting cards, photos', mac: 'A6 Envelope' },
  { id: 'A7', name: 'A7 Card', size: '5¼" × 7¼"', w: 7.25, h: 5.25, use: 'Invitations, 5×7 cards', popular: true, mac: 'A7 Envelope' },
  { id: '6x9', name: '6 × 9 Catalog', size: '6" × 9"', w: 9, h: 6, use: 'Booklets, folded papers', mac: '6 x 9' },
  { id: '9x12', name: '9 × 12 Large', size: '9" × 12"', w: 12, h: 9, use: 'Unfolded papers, documents', mac: '9 x 12' },
];

export function findEnvelope(id) {
  return ENVELOPES.find(e => e.id === id) || ENVELOPES[0];
}

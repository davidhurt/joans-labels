import { data, save, uid } from '../store.js';
import { h, go, toast, modal, confirmBox, formatAddress, myAddress, fmtDate, showPrint } from '../ui.js';
import { TEMPLATES, LABEL_CATEGORIES, searchTemplates, findTemplate, customTemplate, labelRect } from '../templates.js';
import { FONTS, planLabels, layoutLabel, drawOpsCanvas, labelsPdf } from '../engine.js';
import { CLIPART, emojiPng, readPhoto } from '../pictures.js';
import { addressPicker } from './addresses.js';
import { printTips } from './settings.js';

// ---------- sheet picture ----------
export function sheetSvg(t, maxH = 150) {
  const k = maxH / t.pageH;
  const W = t.pageW * k, H = t.pageH * k;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${t.pageW} ${t.pageH}`);
  svg.setAttribute('aria-hidden', 'true');
  const page = document.createElementNS(ns, 'rect');
  Object.entries({ x: 0, y: 0, width: t.pageW, height: t.pageH, fill: '#fff', stroke: '#9aa5b1', 'stroke-width': 0.05 }).forEach(([a, v]) => page.setAttribute(a, v));
  svg.append(page);
  for (let i = 0; i < t.count; i++) {
    const r = labelRect(t, i);
    let el;
    if (t.shape === 'round') {
      el = document.createElementNS(ns, 'ellipse');
      Object.entries({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 }).forEach(([a, v]) => el.setAttribute(a, v));
    } else {
      el = document.createElementNS(ns, 'rect');
      const rr = Math.min(0.1, r.h * 0.12);
      Object.entries({ x: r.x, y: r.y, width: r.w, height: r.h, rx: rr }).forEach(([a, v]) => el.setAttribute(a, v));
    }
    el.setAttribute('fill', '#dce9f5'); el.setAttribute('stroke', '#5b8bb8'); el.setAttribute('stroke-width', 0.04);
    svg.append(el);
  }
  return svg;
}

// ---------- library ----------
export function labelsView() {
  const hasSaved = data.labels.length > 0;
  let tab = hasSaved ? 'mine' : 'new';
  const body = h('div');
  const tabs = h('div.tabs');
  const drawTabs = () => {
    tabs.innerHTML = '';
    tabs.append(
      h('button.btn.big' + (tab === 'new' ? '.on' : ''), { onclick: () => { tab = 'new'; drawTabs(); } }, '➕ Start new labels'),
      h('button.btn.big' + (tab === 'mine' ? '.on' : ''), { onclick: () => { tab = 'mine'; drawTabs(); } }, `📁 My saved labels (${data.labels.length})`));
    body.innerHTML = '';
    body.append(tab === 'new' ? gallery() : myLabels());
  };
  drawTabs();
  return h('div', h('div.page-head', h('h1', '🏷️ Labels')), tabs, body);
}

function myLabels() {
  if (!data.labels.length) return h('div.card', h('p.lead', 'You have no saved labels yet.'), h('p', 'When you make labels they are saved here automatically so you can print them again.'));
  const list = [...data.labels].sort((a, b) => b.updated - a.updated);
  const wrap = h('div.list');
  for (const l of list) {
    const t = l.templateId === 'custom' ? customTemplate(l.custom) : findTemplate(l.templateId);
    wrap.append(h('div.item',
      h('span.ico', '🏷️'),
      h('a.t', { href: `#/labels/edit/${l.id}`, style: { color: 'inherit', textDecoration: 'none' } },
        h('b', l.name), h('small', `${t ? (t.id === 'custom' ? 'My own size' : 'Avery ' + t.sku) : ''} · changed ${fmtDate(l.updated)}`)),
      h('a.btn.primary', { href: `#/labels/edit/${l.id}` }, 'Open'),
      h('button.btn', { title: 'Make a copy', onclick: () => {
        const c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.name = l.name + ' (copy)'; c.updated = Date.now();
        data.labels.push(c); save('labels', true); go(`#/labels/edit/${c.id}`);
      } }, '📄 Copy'),
      h('button.btn.danger', { onclick: async () => {
        if (await confirmBox('Delete these labels?', `"${l.name}" will be deleted. This cannot be undone.`, 'Yes, delete')) {
          data.labels = data.labels.filter(x => x.id !== l.id); save('labels', true); wrap.replaceWith(myLabels()); toast('Deleted');
        } } }, '🗑️')));
  }
  return wrap;
}

function gallery() {
  let q = '', cat = '';
  const grid = h('div.gallery');
  const msg = h('div');
  const chips = h('div.chips');
  const drawChips = () => {
    chips.innerHTML = '';
    chips.append(h('button.btn' + (!cat ? '.on' : ''), { onclick: () => { cat = ''; drawChips(); draw(); } }, '⭐ Most used'));
    LABEL_CATEGORIES.forEach(c => chips.append(h('button.btn' + (cat === c.id ? '.on' : ''), { onclick: () => { cat = c.id; q = ''; input.value = ''; drawChips(); draw(); } }, `${c.icon} ${c.name}`)));
    chips.append(h('button.btn', { onclick: customDialog }, '📏 My own size'));
  };
  const draw = () => {
    grid.innerHTML = ''; msg.innerHTML = '';
    let list;
    if (q) list = searchTemplates(q);
    else if (cat) list = TEMPLATES.filter(t => t.cat === cat);
    else list = TEMPLATES.filter(t => t.popular);
    if (q && !list.length) {
      msg.append(h('div.note', h('p', { html: `We don't have Avery <b>${q.replace(/[<>&]/g, '')}</b> in the list yet.` }),
        h('p', 'Look on the package for the label size (for example "1 inch × 2⅝ inch") and how many are on a sheet, then use ', h('button.linkish', { onclick: customDialog }, 'My own size'), '.')));
    }
    if (q && list.length) {
      const digits = q.replace(/\D/g, '');
      const exact = list.find(t => String(t.sku) === digits || (t.also || []).map(String).includes(digits));
      if (exact && String(exact.sku) !== digits) msg.append(h('p.note.ok', { html: `Avery <b>${digits}</b> is the same size as Avery ${exact.sku}. Pick it below — it will fit your labels.` }));
    }
    for (const t of list) grid.append(templateCard(t));
  };
  const input = h('input', { type: 'search', inputMode: 'numeric', placeholder: 'Type the Avery number from the package, like 5160',
    'aria-label': 'Avery number', oninput: (e) => { q = e.target.value.trim(); if (q) { cat = ''; drawChips(); } draw(); } });
  drawChips(); draw();
  return h('div',
    h('p.lead', 'Find your labels. The number is on the front of the Avery package.'),
    h('div.search-big', input),
    chips, msg, grid);
}

function templateCard(t) {
  return h('button.tcard', { onclick: () => go(`#/labels/new/${t.id}`) },
    h('div.thumb', sheetSvg(t, 150)),
    h('span.sku', `Avery ${t.sku}`),
    h('span.nm', t.name),
    h('span.meta', `${t.size} · ${t.count} per sheet`),
    t.also && t.also.length ? h('span.meta.small', `Also fits: ${t.also.slice(0, 5).join(', ')}${t.also.length > 5 ? '…' : ''}`) : null);
}

function customDialog() {
  const c = { w: '2.625', h: '1', cols: '3', rows: '10', shape: 'rect' };
  const f = (k, label) => h('label.field', h('span', label), h('input', { type: 'text', inputMode: 'decimal', value: c[k], oninput: (e) => { c[k] = e.target.value; } }));
  const shape = h('div.seg');
  const drawShape = () => { shape.innerHTML = ''; [['rect', '▭ Rectangle'], ['round', '◯ Circle']].forEach(([id, nm]) => shape.append(h('button.btn' + (c.shape === id ? '.on' : ''), { onclick: () => { c.shape = id; drawShape(); } }, nm))); };
  drawShape();
  const m = modal('My own label size', [
    h('p', 'Look on your label package. Type the size of one label in inches (you can use decimals, like 2.625 for 2⅝).'),
    h('div.ab-grid', f('w', 'Label width (inches)'), f('h', 'Label height (inches)'), f('cols', 'Labels across'), f('rows', 'Labels down')),
    h('label.field', h('span', 'Shape'), shape),
    h('p.small.muted', 'The labels will be spread evenly on the sheet. Print a test on plain paper first to check.'),
    h('div.row.end', h('button.btn.big.primary', { onclick: () => {
      const v = { w: +eval2(c.w), h: +eval2(c.h), cols: parseInt(c.cols), rows: parseInt(c.rows) };
      if (!(v.w > 0 && v.h > 0 && v.cols > 0 && v.rows > 0) || v.w * v.cols > 8.5 || v.h * v.rows > 11) { toast('Those numbers do not fit on a sheet. Please check them.', 'bad'); return; }
      const id = uid();
      data.labels.push(newDesign(id, 'custom', { ...v, shape: c.shape }));
      save('labels', true); m.close(); go(`#/labels/edit/${id}`);
    } }, 'Continue ▶')),
  ]);
}
function eval2(s) {
  s = String(s).trim();
  const m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
  const f = s.match(/^(\d+)\/(\d+)$/); if (f) return f[1] / f[2];
  return parseFloat(s);
}

function newDesign(id, templateId, custom) {
  const t = templateId === 'custom' ? customTemplate(custom) : findTemplate(templateId);
  const isAddr = ['address', 'shipping'].includes(t.cat) || t.cat === 'custom';
  const isReturn = t.cat === 'return';
  return {
    id, templateId, custom: custom || null,
    name: `${t.name} – ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    mode: isAddr && data.addresses.length ? 'addresses' : 'same',
    text: isReturn ? myAddress() : '',
    each: {}, addressIds: [], copiesEach: 1, sheets: 1, startAt: 0,
    style: { font: 'helvetica', size: isReturn ? 9 : t.h < 1.2 ? 12 : t.h < 2.5 ? 16 : 24, bold: false, italic: false,
      align: t.shape === 'round' || t.cat === 'badge' || t.cat === 'round' ? 'center' : 'left', color: '#000000' },
    picture: null,
    created: Date.now(), updated: Date.now(),
  };
}

// ---------- editor ----------
export function labelEditorView({ id, templateId }) {
  let design, isNew = false;
  if (id) {
    design = data.labels.find(l => l.id === id);
    if (!design) { setTimeout(() => go('#/labels'), 0); return h('p', 'Not found.'); }
  } else {
    if (!findTemplate(templateId)) { setTimeout(() => go('#/labels'), 0); return h('p', 'Not found.'); }
    design = newDesign(uid(), templateId);
    isNew = true;
  }
  const t = design.templateId === 'custom' ? customTemplate(design.custom) : findTemplate(design.templateId);
  let selected = 0;      // label being typed on in "each" mode
  let pickingStart = false;
  let page = 0;

  const persist = () => {
    design.updated = Date.now();
    if (isNew) { data.labels.push(design); isNew = false; history.replaceState(null, '', `#/labels/edit/${design.id}`); }
    save('labels');
    savedNote.textContent = '✔ Saved';
  };
  const changed = () => { persist(); redraw(); };

  // ---- preview ----
  const canvas = h('canvas', { 'aria-label': 'Picture of your label sheet' });
  const pageInfo = h('span');
  const prevBtn = h('button.btn', { onclick: () => { page--; redraw(); } }, '◀ Page');
  const nextBtn = h('button.btn', { onclick: () => { page++; redraw(); } }, 'Page ▶');
  const summary = h('b');
  const fitNote = h('div');
  const hint = h('p.small.muted', { style: { textAlign: 'center', margin: '.5rem 0 0' } });
  const savedNote = h('span.small.muted', isNew ? '' : '✔ Saved');

  let drawing = 0;
  async function redraw() {
    const my = ++drawing;
    const plan = planLabels(t, design, data.addresses, formatAddress);
    page = Math.max(0, Math.min(page, plan.pages.length - 1));
    const cw = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth - 32 : 600, 720);
    const scale = Math.max(280, cw) / t.pageW;
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = Math.round(t.pageW * scale * dpr); off.height = Math.round(t.pageH * scale * dpr);
    const ctx = off.getContext('2d');
    ctx.scale(scale * dpr, scale * dpr);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, t.pageW, t.pageH);
    const cells = plan.pages[page] || [];
    const used = new Set(cells.map(c => c.index));
    let shrunk = false;
    for (let i = 0; i < t.count; i++) {
      const r = labelRect(t, i);
      ctx.beginPath();
      if (t.shape === 'round') ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      else roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(0.08, r.h * 0.1));
      const isUsedSpot = page === 0 && i < (design.startAt || 0);
      ctx.fillStyle = isUsedSpot ? '#e3e6ea' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.2 / scale;
      ctx.setLineDash([4 / scale, 3 / scale]);
      ctx.strokeStyle = '#a9b4c0';
      ctx.stroke();
      ctx.setLineDash([]);
      if (isUsedSpot) {
        ctx.fillStyle = '#8a939e'; ctx.font = `${Math.min(r.h * 0.35, 0.16)}px Helvetica, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('already used', r.x + r.w / 2, r.y + r.h / 2);
      }
      if (design.mode === 'each' && i === selected && !pickingStart) {
        ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#1f4e79'; ctx.stroke();
      }
    }
    for (const cell of cells) {
      const r = labelRect(t, cell.index);
      const res = layoutLabel(t, r, cell.text, design);
      if (res.shrunk) shrunk = true;
      await drawOpsCanvas(ctx, res.ops);
      if (my !== drawing) return;
    }
    if (my !== drawing) return;
    canvas.width = off.width; canvas.height = off.height;
    canvas.style.width = `${t.pageW * scale}px`;
    canvas.getContext('2d').drawImage(off, 0, 0);
    canvas._scale = scale;

    const n = plan.total;
    if (design.mode === 'addresses') summary.textContent = n ? `${n} label${n === 1 ? '' : 's'} · ${plan.pages.length} sheet${plan.pages.length === 1 ? '' : 's'}` : 'Pick people on the left';
    else if (design.mode === 'same') summary.textContent = `${n} label${n === 1 ? '' : 's'} · ${plan.pages.length} sheet${plan.pages.length === 1 ? '' : 's'}`;
    else summary.textContent = `${n} label${n === 1 ? '' : 's'} filled in`;
    pageInfo.textContent = plan.pages.length > 1 ? `Sheet ${page + 1} of ${plan.pages.length}` : '';
    prevBtn.style.display = nextBtn.style.display = plan.pages.length > 1 ? '' : 'none';
    prevBtn.disabled = page === 0; nextBtn.disabled = page >= plan.pages.length - 1;
    fitNote.innerHTML = '';
    if (shrunk) fitNote.append(h('p.note.small', 'ℹ️ Some writing was made a little smaller so it fits on the label.'));
    hint.textContent = pickingStart ? '👆 Click the first EMPTY label on your sheet.' : design.mode === 'each' ? '👆 Click any label to type on it.' : '';
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sc = rect.width / t.pageW;
    const x = (e.clientX - rect.left) / sc, y = (e.clientY - rect.top) / sc;
    for (let i = 0; i < t.count; i++) {
      const r = labelRect(t, i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (pickingStart) {
          design.startAt = i; pickingStart = false; page = 0; drawStart(); changed();
          toast(i === 0 ? 'Printing will start at the first label' : `Printing will start at label ${i + 1}`);
        } else if (design.mode === 'each') {
          selected = i; drawContent(); redraw();
          setTimeout(() => { const ta = contentEl.querySelector('textarea'); if (ta) ta.focus(); }, 10);
        }
        return;
      }
    }
  });

  // ---- step 1: what goes on labels ----
  const modeEl = h('div.picks');
  const modes = [
    ['addresses', '📇', 'Addresses from my Address Book', 'One label for each person you pick'],
    ['same', '🔁', 'The same thing on every label', 'Like your return address'],
    ['each', '✏️', 'Something different on each label', 'Click a label and type'],
  ];
  const drawModes = () => {
    modeEl.innerHTML = '';
    for (const [m, ico, title, sub] of modes) {
      modeEl.append(h('button.pick' + (design.mode === m ? '.on' : ''), { onclick: () => { design.mode = m; drawModes(); drawContent(); changed(); } },
        h('span.ico', ico), h('span', h('b', title), h('small', sub))));
    }
  };

  // ---- step 2: content ----
  const contentEl = h('div.stack');
  const drawContent = () => {
    contentEl.innerHTML = '';
    if (design.mode === 'addresses') {
      design.addressIds = design.addressIds || [];
      // drop people who were deleted
      design.addressIds = design.addressIds.filter(id => data.addresses.some(a => a.id === id));
      const copies = h('output', String(design.copiesEach || 1));
      contentEl.append(
        addressPicker(design.addressIds, changed),
        h('div.row', h('span', 'Labels for each person:'),
          h('span.stepper',
            h('button.btn', { 'aria-label': 'Fewer', onclick: () => { design.copiesEach = Math.max(1, (design.copiesEach || 1) - 1); copies.textContent = design.copiesEach; changed(); } }, '−'),
            copies,
            h('button.btn', { 'aria-label': 'More', onclick: () => { design.copiesEach = Math.min(t.count, (design.copiesEach || 1) + 1); copies.textContent = design.copiesEach; changed(); } }, '+'))));
    } else if (design.mode === 'same') {
      const ta = h('textarea', { value: design.text || '', placeholder: 'Type what goes on every label.\nPress Return to start a new line.', 'aria-label': 'Label text',
        oninput: (e) => { design.text = e.target.value; changed(); } });
      const sheets = h('output', String(design.sheets || 1));
      contentEl.append(ta,
        h('div.row',
          h('button.btn', { onclick: () => { if (!myAddress().trim()) { toast('First add your address in My Info.', 'bad'); return; } ta.value = design.text = myAddress(); changed(); } }, '↩️ Use my return address'),
          h('button.btn', { onclick: () => { ta.value = design.text = ''; changed(); ta.focus(); } }, 'Clear')),
        h('div.row', h('span', 'How many sheets:'),
          h('span.stepper',
            h('button.btn', { 'aria-label': 'Fewer sheets', onclick: () => { design.sheets = Math.max(1, (design.sheets || 1) - 1); sheets.textContent = design.sheets; changed(); } }, '−'),
            sheets,
            h('button.btn', { 'aria-label': 'More sheets', onclick: () => { design.sheets = Math.min(50, (design.sheets || 1) + 1); sheets.textContent = design.sheets; changed(); } }, '+'))));
    } else {
      design.each = design.each || {};
      const ta = h('textarea', { value: design.each[selected] || '', 'aria-label': `Text for label ${selected + 1}`,
        placeholder: 'Type on this label…', oninput: (e) => { design.each[selected] = e.target.value; changed(); } });
      contentEl.append(
        h('p', h('b', `Label ${selected + 1} of ${t.count}`), h('span.muted', ' — click another label on the sheet to type on it.')),
        ta,
        h('div.row',
          h('button.btn', { disabled: selected <= 0, onclick: () => { selected--; drawContent(); redraw(); } }, '◀ Previous label'),
          h('button.btn', { disabled: selected >= t.count - 1, onclick: () => { selected++; drawContent(); redraw(); } }, 'Next label ▶')),
        h('div.row',
          h('button.btn', { onclick: () => { const v = design.each[selected] || ''; for (let i = 0; i < t.count; i++) if (!(design.each[i] || '').trim()) design.each[i] = v; changed(); toast('Copied to every empty label'); } }, '📋 Copy this to all empty labels'),
          h('button.btn.danger', { onclick: async () => { if (await confirmBox('Clear all labels?', 'This wipes the writing from every label on the sheet.', 'Yes, clear')) { design.each = {}; drawContent(); changed(); } } }, 'Clear all')));
      setTimeout(() => ta.focus(), 0);
    }
  };

  // ---- step 3: look ----
  const lookEl = h('div.stack');
  const drawLook = () => {
    const s = design.style;
    lookEl.innerHTML = '';
    const size = h('output', String(s.size));
    const fonts = h('div.seg', FONTS.map(f => h('button.btn' + (s.font === f.id ? '.on' : ''), { style: { fontFamily: f.css }, onclick: () => { s.font = f.id; drawLook(); changed(); } }, f.name)));
    lookEl.replaceChildren(...[
      h('div', h('b', 'Lettering'), fonts),
      h('div.row', h('b', 'Size'),
        h('span.stepper',
          h('button.btn', { 'aria-label': 'Smaller', onclick: () => { s.size = Math.max(6, s.size - 1); size.textContent = s.size; changed(); } }, '−'),
          size,
          h('button.btn', { 'aria-label': 'Bigger', onclick: () => { s.size = Math.min(72, s.size + 1); size.textContent = s.size; changed(); } }, '+'))),
      h('div.seg',
        h('button.btn' + (s.bold ? '.on' : ''), { style: { fontWeight: 800 }, onclick: () => { s.bold = !s.bold; drawLook(); changed(); } }, 'B  Bold'),
        h('button.btn' + (s.italic ? '.on' : ''), { style: { fontStyle: 'italic' }, onclick: () => { s.italic = !s.italic; drawLook(); changed(); } }, 'I  Slanted'),
        h('button.btn' + (s.align === 'left' ? '.on' : ''), { onclick: () => { s.align = 'left'; drawLook(); changed(); } }, '☰ Left'),
        h('button.btn' + (s.align === 'center' ? '.on' : ''), { onclick: () => { s.align = 'center'; drawLook(); changed(); } }, '≡ Center')),
      h('div.row', h('b', 'Color'),
        ...[['#000000', 'Black'], ['#1f3c88', 'Blue'], ['#a3171e', 'Red'], ['#1d6b36', 'Green'], ['#6b3fa0', 'Purple']].map(([c, nm]) =>
          h('button.swatch' + (s.color === c ? '.on' : ''), { style: { background: c }, title: nm, 'aria-label': nm, onclick: () => { s.color = c; drawLook(); changed(); } }))),
      h('div', h('b', 'Picture'), h('div.seg',
        h('button.btn' + (!design.picture ? '.on' : ''), { onclick: () => { design.picture = null; drawLook(); changed(); } }, 'No picture'),
        h('button.btn' + (design.picture && design.picture.kind === 'clip' ? '.on' : ''), { onclick: clipDialog }, '🌸 Choose a picture'),
        h('button.btn' + (design.picture && design.picture.kind === 'photo' ? '.on' : ''), { onclick: () => photoIn.click() }, '🖼️ My own photo'))),
      design.picture ? h('div.seg', h('span', 'Put picture:'),
        h('button.btn' + (design.picture.pos !== 'top' ? '.on' : ''), { onclick: () => { design.picture.pos = 'left'; drawLook(); changed(); } }, 'On the left'),
        h('button.btn' + (design.picture.pos === 'top' ? '.on' : ''), { onclick: () => { design.picture.pos = 'top'; drawLook(); changed(); } }, 'On top')) : null,
    ].filter(Boolean));
  };
  const photoIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const p = await readPhoto(f, 900); design.picture = { kind: 'photo', src: p.src, ar: p.ar, pos: (design.picture && design.picture.pos) || 'left' }; drawLook(); changed(); }
    catch (err) { toast(err.message, 'bad'); }
    e.target.value = '';
  } });
  const clipDialog = () => {
    const m = modal('Choose a picture', CLIPART.map(g => h('div', { style: { marginBottom: '1rem' } }, h('h3', g.group),
      h('div.clip-grid', g.items.map(e => h('button', { 'aria-label': e, onclick: () => {
        design.picture = { kind: 'clip', emoji: e, src: emojiPng(e), ar: 1, pos: (design.picture && design.picture.pos) || 'left' };
        m.close(); drawLook(); changed();
      } }, e))))));
  };

  // ---- step 4: sheet ----
  const startEl = h('div.stack');
  const drawStart = () => {
    startEl.innerHTML = '';
    if (design.mode === 'each') { startEl.append(h('p.muted.small', 'Leave a label empty and nothing prints there.')); return; }
    const used = design.startAt || 0;
    startEl.append(
      h('p', used ? `Printing starts at label ${used + 1}. The grey ones are skipped.` : 'Printing starts at the first label.'),
      h('div.row',
        h('button.btn' + (pickingStart ? '.on' : ''), { onclick: () => { pickingStart = !pickingStart; drawStart(); redraw(); } }, pickingStart ? '👆 Now click on the sheet' : '📄 My sheet is partly used'),
        used ? h('button.btn', { onclick: () => { design.startAt = 0; drawStart(); changed(); } }, 'Start at the first label') : null));
  };

  // ---- name + print ----
  const nameIn = h('input.title-input', { type: 'text', value: design.name, 'aria-label': 'Name of these labels', oninput: (e) => { design.name = e.target.value || 'My labels'; persist(); } });

  const doPrint = async (test) => {
    const plan = planLabels(t, design, data.addresses, formatAddress);
    if (!plan.total && !test) { toast(design.mode === 'addresses' ? 'Pick at least one person first.' : 'Type something on the labels first.', 'bad'); return; }
    persist();
    const doc = await labelsPdf(t, design, plan, data.settings.nudge, { test });
    showPrint(doc, { title: test ? 'Test print on plain paper' : 'Ready to print your labels', filename: `${design.name}.pdf`, tips: printTips(test), preview: canvas, pages: plan.pages.length });
  };

  drawModes(); drawContent(); drawLook(); drawStart();

  const node = h('div',
    h('div.page-head',
      h('a.btn.back', { href: '#/labels' }, '◀ All labels'),
      h('div.grow', h('div.small.muted', t.id === 'custom' ? `My own size · ${t.size} · ${t.count} per sheet` : `Avery ${t.sku} · ${t.name} · ${t.size} · ${t.count} per sheet`), nameIn),
      savedNote),
    t.checkFit ? h('p.note.small', '💡 For this kind of label, do a ', h('b', 'Test print'), ' on plain paper the first time to check it lines up.') : null,
    h('div.editor',
      h('div.panel',
        h('div.step', h('h3', h('span.num', '1'), 'What goes on your labels?'), modeEl),
        h('div.step', h('h3', h('span.num', '2'), 'Fill them in'), contentEl),
        h('div.step', h('h3', h('span.num', '3'), 'How it looks'), lookEl, photoIn),
        h('div.step', h('h3', h('span.num', '4'), 'Your label sheet'), startEl)),
      h('div.preview-col',
        h('div.preview-bar', summary, h('span.pager', prevBtn, pageInfo, nextBtn)),
        h('div.sheet-wrap', canvas),
        hint, fitNote)),
    h('div.actions-bar',
      h('button.btn.big', { onclick: () => doPrint(true) }, '📄 Test print on plain paper'),
      h('button.btn.big.primary', { onclick: () => doPrint(false) }, '🖨️ Print labels')));

  const onResize = () => redraw();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => redraw());
  return { node, cleanup: () => window.removeEventListener('resize', onResize) };
}

function roundRect(ctx, x, y, w, hh, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

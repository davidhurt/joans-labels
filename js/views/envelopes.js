import { data, save } from '../store.js';
import { h, toast, formatAddress, myAddress, showPrint, isSafari } from '../ui.js';
import { ENVELOPES, findEnvelope } from '../templates.js';
import { FONTS, ensureFont, layoutEnvelope, drawOpsCanvas, envelopesPdf } from '../engine.js';
import { addressPicker } from './addresses.js';

export function envelopesView(params) {
  const s = data.settings;
  s.envelope = s.envelope || { size: '10', font: 'helvetica', size_pt: 14, bold: false, useReturn: true };
  const st = s.envelope;
  if (params.get('size')) st.size = params.get('size');
  const picked = [];
  const toParam = params.get('to');
  if (toParam && data.addresses.some(a => a.id === toParam)) picked.push(toParam);
  let typed = params.get('text') || '';
  let source = typed ? 'type' : (picked.length || data.addresses.length ? 'book' : 'type');
  let fromText = myAddress();
  let idx = 0;

  const persist = () => save('settings');
  const env = () => findEnvelope(st.size);

  // ---- size picker ----
  const sizesEl = h('div.gallery', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' } });
  const drawSizes = () => {
    sizesEl.innerHTML = '';
    for (const e of ENVELOPES) {
      const k = 120 / 12;
      sizesEl.append(h('button.tcard' + (st.size === e.id ? '.pick.on' : ''), { onclick: () => { st.size = e.id; persist(); drawSizes(); redraw(); }, 'aria-pressed': st.size === e.id ? 'true' : 'false' },
        h('div.thumb', { style: { height: '110px' } }, h('div.env-thumb', { style: { width: `${e.w * k}px`, height: `${e.h * k}px` } })),
        h('span.sku', e.name), h('span.meta', e.size), h('span.meta.small', e.use)));
    }
  };

  // ---- recipients ----
  const toEl = h('div.stack');
  const drawTo = () => {
    toEl.innerHTML = '';
    toEl.append(h('div.seg',
      h('button.btn' + (source === 'book' ? '.on' : ''), { onclick: () => { source = 'book'; idx = 0; drawTo(); redraw(); } }, '📇 From my Address Book'),
      h('button.btn' + (source === 'type' ? '.on' : ''), { onclick: () => { source = 'type'; idx = 0; drawTo(); redraw(); } }, '⌨️ Type it in')));
    if (source === 'book') toEl.append(addressPicker(picked, () => { idx = 0; redraw(); }));
    else toEl.append(h('textarea', { value: typed, placeholder: 'Mary Smith\n123 Main Street\nSpringfield, IL 62701', 'aria-label': 'Address to send to', oninput: (e) => { typed = e.target.value; redraw(); } }));
  };

  // ---- return address ----
  const fromEl = h('div.stack');
  const drawFrom = () => {
    fromEl.innerHTML = '';
    fromEl.append(h('label.row', { style: { cursor: 'pointer', fontWeight: 600 } },
      h('input', { type: 'checkbox', checked: st.useReturn, onchange: (e) => { st.useReturn = e.target.checked; persist(); drawFrom(); redraw(); } }),
      'Print my return address in the corner'));
    if (st.useReturn) {
      fromEl.append(h('textarea', { value: fromText, style: { minHeight: '5.5rem' }, 'aria-label': 'Return address', oninput: (e) => { fromText = e.target.value; redraw(); } }));
      if (!myAddress().trim()) fromEl.append(h('p.small.muted', 'Tip: save your address in ', h('a', { href: '#/settings' }, 'My Info'), ' so it is filled in for you.'));
    }
  };

  // ---- look ----
  const lookEl = h('div.stack');
  const drawLook = () => {
    lookEl.innerHTML = '';
    const size = h('output', String(st.size_pt));
    lookEl.append(
      h('div.font-pick', FONTS.map(f => h('button.btn' + (st.font === f.id ? '.on' : ''), { style: { fontFamily: f.css }, onclick: () => { st.font = f.id; persist(); drawLook(); redraw(); } }, f.name))),
      h('div.row', h('b', 'Size'), h('span.stepper',
        h('button.btn', { 'aria-label': 'Smaller', onclick: () => { st.size_pt = Math.max(9, st.size_pt - 1); size.textContent = st.size_pt; persist(); redraw(); } }, '−'), size,
        h('button.btn', { 'aria-label': 'Bigger', onclick: () => { st.size_pt = Math.min(28, st.size_pt + 1); size.textContent = st.size_pt; persist(); redraw(); } }, '+')),
        h('button.btn' + (st.bold ? '.on' : ''), { style: { fontWeight: 800 }, onclick: () => { st.bold = !st.bold; persist(); drawLook(); redraw(); } }, 'B  Bold')));
  };

  const list = () => {
    const from = st.useReturn ? fromText : '';
    if (source === 'type') return typed.trim() ? [{ to: typed, from }] : [];
    return picked.map(id => data.addresses.find(a => a.id === id)).filter(Boolean).map(a => ({ to: formatAddress(a), from }));
  };
  const style = () => ({ font: st.font, size: st.size_pt, bold: st.bold, italic: false, color: '#000000' });

  // ---- preview ----
  const canvas = h('canvas', { 'aria-label': 'Picture of your envelope' });
  const info = h('b');
  const prev = h('button.btn', { onclick: () => { idx--; redraw(); } }, '◀');
  const next = h('button.btn', { onclick: () => { idx++; redraw(); } }, '▶');
  let drawing = 0;
  async function redraw() {
    const my = ++drawing;
    await ensureFont(st.font);
    if (my !== drawing) return;
    const e = env(), L = list();
    idx = Math.max(0, Math.min(idx, L.length - 1));
    const item = L[idx] || { to: '', from: st.useReturn ? fromText : '' };
    const cw = Math.min((canvas.parentElement ? canvas.parentElement.clientWidth : 700) - 32, 760);
    const scale = Math.max(260, cw) / e.w;
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = Math.round(e.w * scale * dpr); off.height = Math.round(e.h * scale * dpr);
    const ctx = off.getContext('2d');
    ctx.scale(scale * dpr, scale * dpr);
    ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, e.w, e.h);
    // stamp box
    ctx.setLineDash([4 / scale, 3 / scale]); ctx.strokeStyle = '#c9bfa6'; ctx.lineWidth = 1.2 / scale;
    ctx.strokeRect(e.w - 1.25, 0.25, 1, 1.1); ctx.setLineDash([]);
    ctx.fillStyle = '#b5ab92'; ctx.font = `${0.13}px Helvetica`; ctx.textAlign = 'center'; ctx.fillText('stamp', e.w - 0.75, 0.85);
    await drawOpsCanvas(ctx, layoutEnvelope(e, item.to, item.from, style()));
    if (my !== drawing) return;
    canvas.width = off.width; canvas.height = off.height; canvas.style.width = `${e.w * scale}px`;
    canvas.getContext('2d').drawImage(off, 0, 0);
    info.textContent = L.length ? `${L.length} envelope${L.length === 1 ? '' : 's'}${L.length > 1 ? ` · showing ${idx + 1}` : ''}` : (source === 'book' ? 'Pick who it goes to' : 'Type the address');
    prev.style.display = next.style.display = L.length > 1 ? '' : 'none';
    prev.disabled = idx === 0; next.disabled = idx >= L.length - 1;
  }

  const doPrint = async () => {
    const L = list();
    if (!L.length) { toast(source === 'book' ? 'Pick at least one person first.' : 'Type the address first.', 'bad'); return; }
    const e = env();
    const doc = await envelopesPdf(e, L, style());
    const safari = isSafari();
    showPrint(doc, { title: `Ready to print ${L.length} envelope${L.length === 1 ? '' : 's'}`, filename: 'envelopes.pdf', preview: canvas, pages: L.length, tips: [
      `Put ${L.length === 1 ? 'the envelope' : 'the envelopes'} in your printer the way its little envelope picture shows (often face up, flap on the left).`,
      safari ? 'Click the big <b>Print</b> button. Your envelope opens in a new tab. Press <kbd>⌘</kbd> + <kbd>P</kbd>.' : 'Click the big <b>Print</b> button. A print window opens.',
      safari ? `Set <b>Paper Size</b> to <b>${e.mac}</b> (if you do not see it, click <b>Show Details</b>). Scale should be <b>100%</b>.` : `Click <b>More settings</b>, set <b>Paper size</b> to <b>${e.mac}</b> and <b>Scale</b> to <b>Actual size</b>.`,
      'Click the blue <b>Print</b> button. Then close that tab to come back here.',
      'First time? Try one on plain paper first.',
    ] });
  };

  drawSizes(); drawTo(); drawFrom(); drawLook();

  const node = h('div',
    h('div.page-head', h('h1', '✉️ Envelopes')),
    h('div.step', { style: { marginBottom: '1rem' } }, h('h3', h('span.num', '1'), 'Pick your envelope size'), sizesEl),
    h('div.editor',
      h('div.panel',
        h('div.step', h('h3', h('span.num', '2'), 'Who is it going to?'), toEl),
        h('div.step', h('h3', h('span.num', '3'), 'Your return address'), fromEl),
        h('div.step', h('h3', h('span.num', '4'), 'How it looks'), lookEl)),
      h('div.preview-col',
        h('div.preview-bar', info, h('span.pager', prev, next)),
        h('div.sheet-wrap', canvas))),
    h('div.actions-bar', h('button.btn.big.primary', { onclick: doPrint }, '🖨️ Print envelopes')));

  const onResize = () => redraw();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => redraw());
  return { node, cleanup: () => window.removeEventListener('resize', onResize) };
}

// Small helpers for building screens.
import { data } from './store.js';

/** Create an element: h('div.card#id', {onclick}, children...) */
export function h(tag, attrs, ...kids) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; });
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && k !== 'type') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function go(hash) { location.hash = hash; }

let toastTimer;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast');
  if (!t) { t = h('div#toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3200);
}

const openModals = new Set();
/** Close every pop-up (used when she moves to another screen). */
export function closeAllModals() { [...openModals].forEach(c => c()); }

/** A friendly pop-up window. Returns {el, close}. */
export function modal(title, body, { wide = false, onClose } = {}) {
  const back = h('div.modal-back');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; openModals.delete(close);
    back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose();
  };
  openModals.add(close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const box = h('div.modal' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.modal-head', h('h2', title), h('button.btn.ghost.close-x', { onclick: close, 'aria-label': 'Close' }, '✕ Close')),
    h('div.modal-body', body));
  back.append(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  const f = box.querySelector('input,textarea,select');
  if (f) setTimeout(() => f.focus(), 30);
  return { el: box, close };
}

export function confirmBox(title, message, yesText = 'Yes', noText = 'No, go back') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, [
      h('p.lead', message),
      h('div.row.end',
        h('button.btn.big', { onclick: () => { done = true; m.close(); resolve(false); } }, noText),
        h('button.btn.big.primary', { onclick: () => { done = true; m.close(); resolve(true); } }, yesText)),
    ], { onClose: () => { if (!done) resolve(false); } });
  });
}

export function isSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox/.test(ua);
}

export function formatAddress(a) {
  if (!a) return '';
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.name, a.company, a.line1, a.line2, cityLine].filter(x => x && String(x).trim()).join('\n');
}

export function myAddress() { return formatAddress(data.settings.me); }

export function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function todayLong() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Show the finished PDF and let her print it.
 * tips: array of short instructions shown next to the Print button.
 */
export function showPrint(doc, { title = 'Ready to print', tips = [], filename = 'print.pdf', preview = null, pages = 1 } = {}) {
  // Chrome's PDF viewer opens the print window by itself because of this.
  try { doc.autoPrint({ variant: 'non-conform' }); } catch {}
  const url = URL.createObjectURL(doc.output('blob'));
  const openWin = () => {
    const w = window.open(url, '_blank');
    if (!w) location.href = url; // pop-up blocked: open it here instead
  };
  const pic = preview ? h('img', { src: preview.toDataURL('image/png'), alt: 'Picture of what will print', style: { maxWidth: '100%', maxHeight: '62vh', background: '#fff', boxShadow: '0 4px 18px rgba(0,0,0,.25)' } }) : null;
  const m = modal(title, [
    h('div.print-wrap',
      h('div.print-preview', { style: { background: '#dfe4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', flexDirection: 'column', gap: '.5rem' } },
        pic, pages > 1 ? h('p.small', { style: { margin: 0 } }, `This shows the first of ${pages} pages. All ${pages} will print.`) : null),
      h('div.print-side',
        h('button.btn.huge.primary', { onclick: openWin }, '🖨️  Print'),
        h('ol.tips', tips.map(t => h('li', { html: t }))),
        h('a.btn', { href: url, download: filename }, '⬇️  Save as a PDF file'),
      )),
  ], { wide: true, onClose: () => setTimeout(() => URL.revokeObjectURL(url), 10 * 60000) });
  return m;
}

export function sheetSummary(n, perSheet) {
  const sheets = Math.ceil(n / perSheet);
  return `${n} label${n === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'}`;
}

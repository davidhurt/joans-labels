import { data, save, uid } from '../store.js';
import { h, go, toast, modal, confirmBox, formatAddress, fmtDate, todayLong, esc } from '../ui.js';
import { readPhoto } from '../pictures.js';
import { addressPicker } from './addresses.js';

// ---------- templates ----------
const F = (ph) => `<span class="fill" data-ph="${esc(ph)}">${esc(ph)}</span>`;
const br = (s) => esc(s).replace(/\n/g, '<br>');
function firstNames(name) {
  if (!name) return '';
  return name.replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+(?:and|&)\s+/i).map(p => p.trim().split(/\s+/)[0]).join(' and ');
}

export const LETTER_TEMPLATES = [
  { id: 'personal', ico: '💌', name: 'Personal letter', sub: 'A friendly letter to family or friends',
    make: (me, to) => `<p>${todayLong()}</p><p>Dear ${to ? esc(firstNames(to.name)) : F('Name')},</p><p>${F('Write your letter here.')}</p><p>With love,</p><p>${me.name ? esc(me.name.split(' ')[0]) : F('Your name')}</p>` },
  { id: 'thanks', ico: '🙏', name: 'Thank-you note', sub: 'Say thank you for a gift or kindness',
    make: (me, to) => `<p>${todayLong()}</p><p>Dear ${to ? esc(firstNames(to.name)) : F('Name')},</p><p>Thank you so much for ${F('the lovely gift')}. ${F('It was so thoughtful of you, and I will think of you every time I use it.')}</p><p>${F('I hope to see you soon.')}</p><p>With warm thanks,</p><p>${me.name ? esc(me.name.split(' ')[0]) : F('Your name')}</p>` },
  { id: 'sympathy', ico: '🕊️', name: 'Sympathy note', sub: 'Comfort someone who has lost a loved one',
    make: (me, to) => `<p>${todayLong()}</p><p>Dear ${to ? esc(firstNames(to.name)) : F('Name')},</p><p>I was so sorry to hear about ${F('the passing of your mother')}. ${F('She was a kind and wonderful person, and I will always remember her warmth.')}</p><p>Please know that you are in my thoughts and prayers. If there is anything I can do, I am here for you.</p><p>With deepest sympathy,</p><p>${me.name ? esc(me.name) : F('Your name')}</p>` },
  { id: 'birthday', ico: '🎂', name: 'Birthday letter', sub: 'Wish someone a happy birthday',
    make: (me, to) => `<p style="text-align:center"><font size="6">Happy Birthday!</font></p><p>${todayLong()}</p><p>Dear ${to ? esc(firstNames(to.name)) : F('Name')},</p><p>${F('Wishing you a wonderful birthday filled with love and happiness.')}</p><p>Love always,</p><p>${me.name ? esc(me.name.split(' ')[0]) : F('Your name')}</p>` },
  { id: 'holiday', ico: '🎄', name: 'Holiday letter', sub: 'A yearly family news letter',
    make: (me) => `<p style="text-align:center"><font size="6">${F('Season’s Greetings')}</font></p><p style="text-align:center">${new Date().getFullYear()}</p><p>Dear Friends and Family,</p><p>${F('Here is what has been happening this year…')}</p><p>Wishing you all a happy and healthy new year!</p><p>With love,<br>${me.name ? esc(me.name) : F('Your name')}</p>` },
  { id: 'business', ico: '🏢', name: 'Business letter', sub: 'To a company, bank, doctor or office',
    make: (me, to) => {
      const mine = formatAddress(me);
      const theirs = to ? formatAddress(to) : '';
      return `<p>${mine ? br(mine) : F('Your name and address')}</p><p>${todayLong()}</p><p>${theirs ? br(theirs) : F('Their name and address')}</p><p>Dear ${to && to.name ? esc(to.name) : F('Sir or Madam')}:</p><p>${F('I am writing about…')}</p><p>Thank you for your help.</p><p>Sincerely,</p><p><br><br>${me.name ? esc(me.name) : F('Your name')}</p>`;
    } },
  { id: 'blank', ico: '📄', name: 'Blank page', sub: 'Start with an empty page',
    make: () => '<p><br></p>' },
];

// ---------- library ----------
export function lettersView() {
  let tab = data.letters.length ? 'mine' : 'new';
  const tabs = h('div.tabs'), body = h('div');
  const draw = () => {
    tabs.innerHTML = '';
    tabs.append(
      h('button.btn.big' + (tab === 'new' ? '.on' : ''), { onclick: () => { tab = 'new'; draw(); } }, '➕ Write a new letter'),
      h('button.btn.big' + (tab === 'mine' ? '.on' : ''), { onclick: () => { tab = 'mine'; draw(); } }, `📁 My letters (${data.letters.length})`));
    body.innerHTML = '';
    body.append(tab === 'new' ? templatePicker() : myLetters(draw));
  };
  draw();
  return h('div', h('div.page-head', h('h1', '📝 Letters')), tabs, body);
}

function templatePicker() {
  return h('div',
    h('p.lead', 'What kind of letter? Pick one to start — you can change every word.'),
    h('div.tiles', LETTER_TEMPLATES.map(t => h('button.tile', { onclick: () => startLetter(t) }, h('span.ico', t.ico), h('b', t.name), h('span', t.sub)))));
}

function myLetters(redraw) {
  if (!data.letters.length) return h('div.card', h('p.lead', 'No letters yet.'), h('p', 'Letters you write are saved here by themselves.'));
  return h('div.list', [...data.letters].sort((a, b) => b.updated - a.updated).map(l => h('div.item',
    h('span.ico', '📝'),
    h('a.t', { href: `#/letters/edit/${l.id}`, style: { color: 'inherit', textDecoration: 'none' } }, h('b', l.title), h('small', `changed ${fmtDate(l.updated)}`)),
    h('a.btn.primary', { href: `#/letters/edit/${l.id}` }, 'Open'),
    h('button.btn', { onclick: () => {
      const c = { ...l, id: uid(), title: l.title + ' (copy)', created: Date.now(), updated: Date.now() };
      data.letters.push(c); save('letters', true); go(`#/letters/edit/${c.id}`);
    } }, '📄 Copy'),
    h('button.btn.danger', { onclick: async () => {
      if (await confirmBox('Delete this letter?', `"${l.title}" will be deleted. This cannot be undone.`, 'Yes, delete')) {
        data.letters = data.letters.filter(x => x.id !== l.id); save('letters', true); redraw(); toast('Deleted');
      } } }, '🗑️'))));
}

function startLetter(t) {
  if (t.id === 'blank' || t.id === 'holiday') return create(t, null);
  const picked = [];
  const m = modal('Who is this letter to?', [
    h('p', 'Pick someone from your address book, or skip and type the name yourself.'),
    addressPicker(picked, () => {}, { single: true }),
    h('div.row.end', { style: { marginTop: '1rem' } },
      h('button.btn.big', { onclick: () => { m.close(); create(t, null); } }, 'Skip'),
      h('button.btn.big.primary', { onclick: () => { const a = data.addresses.find(x => x.id === picked[0]); m.close(); create(t, a || null); } }, 'Continue ▶')),
  ]);
}

function create(t, to) {
  const me = data.settings.me;
  const l = {
    id: uid(), template: t.id,
    title: to ? `${t.name} to ${firstNames(to.name) || to.name}` : `${t.name} – ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    html: t.make(me, to), recipientId: to ? to.id : null,
    created: Date.now(), updated: Date.now(),
  };
  data.letters.push(l); save('letters', true);
  go(`#/letters/edit/${l.id}`);
}

// ---------- editor ----------
/** Keep only safe formatting (letters can come back from a backup file). */
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      const badSrc = n === 'src' && !v.startsWith('data:image/');
      const badLink = ['href', 'xlink:href', 'action', 'formaction'].includes(n) && !(v.startsWith('#') || v.startsWith('http'));
      if (n.startsWith('on') || badSrc || badLink) el.removeAttribute(a.name);
    }
  });
  return doc.body.firstChild.innerHTML;
}

export function letterEditorView(id) {
  const l = data.letters.find(x => x.id === id);
  if (!l) { setTimeout(() => go('#/letters'), 0); return h('p', 'Not found.'); }
  const savedNote = h('span.small.muted', '✔ Saved');
  const paper = h('div.paper', { contentEditable: 'true', spellcheck: true, html: cleanHtml(l.html), 'aria-label': 'Your letter' });

  const persist = () => {
    l.html = paper.innerHTML; l.updated = Date.now(); save('letters');
    savedNote.textContent = '✔ Saved';
  };
  // When she starts typing in a yellow blank, turn it into plain text first
  // (otherwise the browser copies the yellow color onto her words).
  paper.addEventListener('beforeinput', () => {
    const s = getSelection();
    if (!s.rangeCount) return;
    const r = s.getRangeAt(0);
    const el = (n) => n && (n.nodeType === 1 ? n : n.parentElement);
    const fill = el(r.startContainer) && el(r.startContainer).closest('.fill');
    if (!fill || !paper.contains(fill)) return;
    const pre = document.createRange(); pre.selectNodeContents(fill); pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    const inEnd = fill.contains(r.endContainer);
    let end = fill.textContent.length;
    if (inEnd) { const pe = document.createRange(); pe.selectNodeContents(fill); pe.setEnd(r.endContainer, r.endOffset); end = pe.toString().length; }
    const txt = document.createTextNode(fill.textContent);
    fill.replaceWith(txt);
    const nr = document.createRange(); nr.setStart(txt, start); nr.setEnd(txt, inEnd ? end : start);
    s.removeAllRanges(); s.addRange(nr);
  });
  paper.addEventListener('input', () => {
    // A yellow blank stops being yellow once she types in it.
    paper.querySelectorAll('.fill').forEach(el => {
      if (el.textContent !== el.dataset.ph) { el.classList.remove('fill'); el.removeAttribute('data-ph'); }
    });
    savedNote.textContent = 'Saving…';
    persist();
  });
  paper.addEventListener('click', (e) => {
    paper.querySelectorAll('img.sel').forEach(i => i.classList.remove('sel'));
    imgBar.style.display = 'none';
    const fill = e.target.closest('.fill');
    if (fill) {
      const r = document.createRange(); r.selectNodeContents(fill);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    if (e.target.tagName === 'IMG') { e.target.classList.add('sel'); selImg = e.target; imgBar.style.display = ''; }
  });
  // Paste as plain text so odd formatting from email/web does not come in.
  paper.addEventListener('paste', (e) => {
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (text != null) { e.preventDefault(); document.execCommand('insertText', false, text); }
  });

  const cmd = (c, v) => () => { paper.focus(); document.execCommand(c, false, v); persist(); };
  const keepFocus = (el) => { el.addEventListener('mousedown', (e) => e.preventDefault()); return el; };
  const B = (label, c, v, extra = {}) => keepFocus(h('button.btn', { onclick: cmd(c, v), title: extra.title || '', style: extra.style }, label));

  const sizeSel = h('select', { 'aria-label': 'Writing size', onchange: (e) => { paper.focus(); restoreSel(); document.execCommand('fontSize', false, e.target.value); e.target.value = ''; persist(); } },
    h('option', { value: '' }, 'Size…'),
    h('option', { value: '2' }, 'Small'), h('option', { value: '3' }, 'Normal'), h('option', { value: '4' }, 'Large'),
    h('option', { value: '5' }, 'Extra large'), h('option', { value: '6' }, 'Huge'));
  const fontSel = h('select', { 'aria-label': 'Lettering', onchange: (e) => { paper.focus(); restoreSel(); document.execCommand('fontName', false, e.target.value); e.target.value = ''; persist(); } },
    h('option', { value: '' }, 'Lettering…'),
    h('option', { value: 'Helvetica' }, 'Helvetica'),
    h('option', { value: 'JL Lato' }, 'Modern'),
    h('option', { value: 'Times New Roman' }, 'Classic'),
    h('option', { value: 'JL Crimson' }, 'Elegant'),
    h('option', { value: 'Georgia' }, 'Book'),
    h('option', { value: 'JL Patrick' }, 'Handwritten'),
    h('option', { value: 'JL GreatVibes' }, 'Fancy Script'),
    h('option', { value: 'Courier New' }, 'Typewriter'));
  // Remember the selection while a dropdown is open
  let savedRange = null;
  const remember = () => { const s = getSelection(); if (s.rangeCount && paper.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
  document.addEventListener('selectionchange', remember);
  const colorSel = h('select', { 'aria-label': 'Color', onchange: (e) => { paper.focus(); restoreSel(); document.execCommand('foreColor', false, e.target.value); e.target.value = ''; persist(); } },
    h('option', { value: '' }, 'Color…'),
    h('option', { value: '#000000' }, 'Black'), h('option', { value: '#1f3c88' }, 'Blue'), h('option', { value: '#a3171e' }, 'Red'), h('option', { value: '#1d6b36' }, 'Green'), h('option', { value: '#6b3fa0' }, 'Purple'));

  const photoIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const p = await readPhoto(f, 1400);
      paper.focus(); restoreSel();
      document.execCommand('insertHTML', false, `<img src="${p.src}" style="width:3.5in" alt="">`);
      persist(); toast('Picture added. Click it to make it bigger or smaller.');
    } catch (err) { toast(err.message, 'bad'); }
    e.target.value = '';
  } });

  let selImg = null;
  const sizeImg = (w) => () => { if (selImg) { selImg.style.width = w; persist(); } };
  const imgBar = h('div.row', { style: { display: 'none' } }, h('b', 'Picture:'),
    h('button.btn', { onclick: sizeImg('2in') }, 'Small'), h('button.btn', { onclick: sizeImg('3.5in') }, 'Medium'),
    h('button.btn', { onclick: sizeImg('6.5in') }, 'Large'),
    h('button.btn', { onclick: () => { if (selImg) { selImg.style.display = 'block'; selImg.style.margin = '0 auto'; persist(); } } }, 'Center it'),
    h('button.btn.danger', { onclick: () => { if (selImg) { selImg.remove(); selImg = null; imgBar.style.display = 'none'; persist(); } } }, 'Remove'));

  const titleIn = h('input.title-input', { type: 'text', value: l.title, 'aria-label': 'Name of this letter', oninput: (e) => { l.title = e.target.value || 'My letter'; persist(); } });

  const doPrint = async () => {
    const left = paper.querySelectorAll('.fill');
    if (left.length) {
      left[0].scrollIntoView({ block: 'center' });
      const ok = await confirmBox('Some yellow parts are not filled in', `There ${left.length === 1 ? 'is 1 yellow part' : `are ${left.length} yellow parts`} you have not changed yet (like "${left[0].dataset.ph}"). Print anyway?`, 'Print anyway', 'Go back and fix');
      if (!ok) return;
    }
    persist();
    const area = document.getElementById('print-area');
    // The empty header/footer rows repeat on every page and make the top and bottom margins.
    area.innerHTML = '<table class="print-page"><thead><tr><td class="pm"></td></tr></thead>'
      + `<tbody><tr><td class="pc">${paper.innerHTML}</td></tr></tbody>`
      + '<tfoot><tr><td class="pm"></td></tr></tfoot></table>';
    setTimeout(() => { window.print(); }, 50);
  };

  const envelope = () => {
    persist();
    if (l.recipientId && data.addresses.some(a => a.id === l.recipientId)) { go(`#/envelopes?to=${l.recipientId}`); return; }
    const picked = [];
    const m = modal('Envelope for this letter', [
      h('p', 'Who is the letter going to?'),
      addressPicker(picked, () => {}, { single: true }),
      h('div.row.end', { style: { marginTop: '1rem' } },
        h('button.btn.big', { onclick: () => { m.close(); go('#/envelopes'); } }, 'I\'ll type it'),
        h('button.btn.big.primary', { onclick: () => { if (!picked[0]) { toast('Pick a person first', 'bad'); return; } l.recipientId = picked[0]; persist(); m.close(); go(`#/envelopes?to=${picked[0]}`); } }, 'Continue ▶')),
    ]);
  };

  const node = h('div',
    h('div.page-head',
      h('a.btn.back', { href: '#/letters' }, '◀ All letters'),
      h('div.grow', h('div.small.muted', 'Letter name'), titleIn),
      savedNote),
    h('div.toolbar',
      B(h('b', 'B'), 'bold', null, { title: 'Bold' }), B(h('i', 'I'), 'italic', null, { title: 'Slanted' }), B(h('u', 'U'), 'underline', null, { title: 'Underline' }),
      h('span.sep'), sizeSel, fontSel, colorSel,
      h('span.sep'), B('☰ Left', 'justifyLeft'), B('≡ Center', 'justifyCenter'), B('Right ☰', 'justifyRight'),
      h('span.sep'), B('• List', 'insertUnorderedList'),
      keepFocus(h('button.btn', { onclick: () => { remember(); photoIn.click(); } }, '🖼️ Picture')), photoIn,
      h('span.sep'), B('↶ Undo', 'undo'), B('↷ Redo', 'redo'),
      h('span.grow'),
      h('button.btn', { onclick: envelope }, '✉️ Envelope'),
      h('button.btn.primary', { onclick: doPrint }, '🖨️ Print')),
    imgBar,
    paper.querySelector('.fill') || /class="fill"/.test(l.html) ? h('p.note.small', '💡 Click on a ', h('span', { style: { background: '#fff1a8', padding: '0 .3em' } }, 'yellow part'), ' and type to replace it. Spelling mistakes get a red line underneath — right-click (or Control-click) the word to fix it.') : null,
    h('div.desk', paper),
    h('div.actions-bar',
      h('button.btn.big', { onclick: envelope }, '✉️ Print an envelope for this letter'),
      h('button.btn.big.primary', { onclick: doPrint }, '🖨️ Print letter')));

  setTimeout(() => { paper.focus(); const f = paper.querySelector('.fill'); if (f) { const r = document.createRange(); r.selectNodeContents(f); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }, 50);
  return { node, cleanup: () => { document.removeEventListener('selectionchange', remember); persist(); } };
}

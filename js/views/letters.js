import { data, save, uid, putFile, getFile, delFile } from '../store.js';
import { h, go, toast, modal, confirmBox, formatAddress, fmtDate, todayLong, esc } from '../ui.js';
import { readPhoto, CLIPART, emojiPng } from '../pictures.js';
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
    h('a.t', { href: `#/letters/edit/${l.id}`, style: { color: 'inherit', textDecoration: 'none' } }, h('b', l.title), h('small', `changed ${fmtDate(l.updated)}`, (l.attachments || []).length ? ` · 📎 ${l.attachments.length} attached` : '')),
    h('a.btn.primary', { href: `#/letters/edit/${l.id}` }, 'Open'),
    h('button.btn', { onclick: async () => {
      const c = { ...l, id: uid(), title: l.title + ' (copy)', created: Date.now(), updated: Date.now(), attachments: [] };
      for (const a of l.attachments || []) {
        const f = await getFile(a.id);
        if (f) { const id = uid(); await putFile(id, f); c.attachments.push({ ...a, id }); }
      }
      data.letters.push(c); save('letters', true); go(`#/letters/edit/${c.id}`);
    } }, '📄 Copy'),
    h('button.btn.danger', { onclick: async () => {
      if (await confirmBox('Delete this letter?', `"${l.title}" will be deleted. This cannot be undone.`, 'Yes, delete')) {
        (l.attachments || []).forEach(a => delFile(a.id));
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

// The writing choices in the toolbar. They stay set until she changes them.
const SIZES = [['2', 'Small'], ['3', 'Normal'], ['4', 'Large'], ['5', 'Extra large'], ['6', 'Huge']];
const FACES = [['Helvetica', 'Helvetica'], ['JL Lato', 'Modern'], ['Times New Roman', 'Classic'], ['JL Crimson', 'Elegant'],
  ['Georgia', 'Book'], ['JL Patrick', 'Handwritten'], ['JL GreatVibes', 'Fancy Script'], ['Courier New', 'Typewriter']];
const COLORS = [['#000000', 'Black'], ['#1f3c88', 'Blue'], ['#a3171e', 'Red'], ['#1d6b36', 'Green'], ['#6b3fa0', 'Purple']];
const DEFAULT_PEN = { size: '3', face: 'Times New Roman', color: '#000000' };
const MAX_FILE = 20 * 1024 * 1024;

const firstFamily = (f) => String(f || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
function toHex(c) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
  if (!m) return String(c || '').toLowerCase();
  return '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('');
}
/** What size, lettering and color the writing has at this spot. */
export function formatAt(node, root) {
  const out = { size: null, face: null, color: null };
  for (let el = node && (node.nodeType === 1 ? node : node.parentElement); el && el !== root && root.contains(el); el = el.parentElement) {
    if (!out.size && el.tagName === 'FONT' && el.getAttribute('size')) out.size = el.getAttribute('size');
    if (!out.face) { const f = (el.tagName === 'FONT' && el.getAttribute('face')) || el.style.fontFamily; if (f) out.face = firstFamily(f); }
    if (!out.color) { const c = (el.tagName === 'FONT' && el.getAttribute('color')) || el.style.color; if (c) out.color = toHex(c); }
  }
  return { size: out.size || DEFAULT_PEN.size, face: out.face || DEFAULT_PEN.face.toLowerCase(), color: out.color || DEFAULT_PEN.color };
}
const fmtSize = (n) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const fileIcon = (t, name) => /^image\//.test(t) ? '🖼️' : /pdf/.test(t) ? '📕' : /word|\.docx?$|\.pages$/i.test(t + name) ? '📘' : /sheet|excel|csv|\.numbers$/i.test(t + name) ? '📗' : '📄';
// Only pictures and PDFs open inside the browser; anything else is saved to Downloads.
const opensInBrowser = (t) => /^image\/(png|jpe?g|gif|webp)$/.test(t) || t === 'application/pdf';
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => reject(fr.error); fr.readAsDataURL(file); });
}
async function dataUrlToBlob(url, type) { const b = await (await fetch(url)).blob(); return new Blob([b], { type }); }

export function letterEditorView(id) {
  const l = data.letters.find(x => x.id === id);
  if (!l) { setTimeout(() => go('#/letters'), 0); return h('p', 'Not found.'); }
  l.attachments = l.attachments || [];
  const pen = { ...DEFAULT_PEN, ...(l.pen || {}) };
  const savedNote = h('span.small.muted', '✔ Saved');
  const paper = h('div.paper', { contentEditable: 'true', spellcheck: true, html: cleanHtml(l.html), 'aria-label': 'Your letter' });

  const persist = () => {
    l.html = paper.innerHTML; l.pen = { ...pen }; l.updated = Date.now(); save('letters');
    savedNote.textContent = '✔ Saved';
  };
  let applying = false;
  paper.addEventListener('beforeinput', (e) => {
    if (applying) return;
    const s = getSelection();
    if (!s.rangeCount) return;
    const r = s.getRangeAt(0);
    // When she starts typing in a yellow blank, turn it into plain text first
    // (otherwise the browser copies the yellow color onto her words).
    const el = (n) => n && (n.nodeType === 1 ? n : n.parentElement);
    const fill = el(r.startContainer) && el(r.startContainer).closest('.fill');
    if (fill && paper.contains(fill)) {
      const pre = document.createRange(); pre.selectNodeContents(fill); pre.setEnd(r.startContainer, r.startOffset);
      const start = pre.toString().length;
      const inEnd = fill.contains(r.endContainer);
      let end = fill.textContent.length;
      if (inEnd) { const pe = document.createRange(); pe.selectNodeContents(fill); pe.setEnd(r.endContainer, r.endOffset); end = pe.toString().length; }
      const txt = document.createTextNode(fill.textContent);
      fill.replaceWith(txt);
      const nr = document.createRange(); nr.setStart(txt, start); nr.setEnd(txt, inEnd ? end : start);
      s.removeAllRanges(); s.addRange(nr);
    }
    // New writing uses the size, lettering and color chosen in the toolbar
    // (a yellow blank keeps its own look, like a big heading).
    if (fill || e.inputType !== 'insertText' || !e.data) return;
    const sel = s.getRangeAt(0);
    const at = formatAt(sel.collapsed ? sel.startContainer : sel.commonAncestorContainer, paper);
    const need = [];
    if (at.size !== pen.size) need.push(['fontSize', pen.size]);
    if (at.face !== pen.face.toLowerCase()) need.push(['fontName', pen.face]);
    if (at.color !== pen.color.toLowerCase()) need.push(['foreColor', pen.color]);
    if (!need.length) return;
    e.preventDefault();
    applying = true;
    try {
      if (!sel.collapsed) document.execCommand('delete');
      need.forEach(([c, v]) => document.execCommand(c, false, v));
      document.execCommand('insertText', false, e.data);
    } finally { applying = false; }
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
  // Paste: a copied photo goes in as a picture; text comes in plain so odd formatting does not.
  paper.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    const img = cd && [...cd.files].find(f => /^image\//.test(f.type));
    if (img) { e.preventDefault(); addPhoto(img); return; }
    const text = cd && cd.getData('text/plain');
    if (text != null) { e.preventDefault(); document.execCommand('insertText', false, text); }
  });
  // Drag a photo from the Photos app (or a file from Finder) onto the letter.
  const desk = h('div.desk', h('div.drop-msg', '📷 Let go to put the photo in your letter'), paper);
  desk.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); desk.classList.add('drop'); } });
  desk.addEventListener('dragleave', () => desk.classList.remove('drop'));
  desk.addEventListener('drop', (e) => {
    desk.classList.remove('drop');
    const files = e.dataTransfer ? [...e.dataTransfer.files] : [];
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r && paper.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); savedRange = r.cloneRange(); }
    files.forEach(f => /^image\//.test(f.type) || /\.hei[cf]$/i.test(f.name) ? addPhoto(f) : attachFile(f));
  });

  const keepFocus = (el) => { el.addEventListener('mousedown', (e) => e.preventDefault()); return el; };
  const cmd = (c, v) => () => { paper.focus(); document.execCommand(c, false, v); persist(); syncButtons(); };
  const B = (label, c, v, extra = {}) => keepFocus(h('button.btn', { onclick: cmd(c, v), title: extra.title || '', 'aria-label': extra.title || null }, label));

  // Remember the selection while a dropdown or pop-up is open
  let savedRange = null;
  const remember = () => { const s = getSelection(); if (s.rangeCount && paper.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); syncButtons(); };
  const restoreSel = () => { if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
  document.addEventListener('selectionchange', remember);

  // Size / Lettering / Color: show the choice, keep it until changed.
  const choose = (key, command) => (e) => {
    pen[key] = e.target.value;
    paper.focus(); restoreSel();
    const s = getSelection();
    if (s.rangeCount && !s.getRangeAt(0).collapsed) document.execCommand(command, false, pen[key]); // change the words she selected
    showPen(); persist();
  };
  const pick = (label, key, command, list) => {
    const sel = h('select', { 'aria-label': label, onchange: choose(key, command) }, list.map(([v, t]) => h('option', { value: v }, t)));
    return { sel, node: h('label.tsel', h('span', label), sel) };
  };
  const size = pick('Size', 'size', 'fontSize', SIZES);
  const face = pick('Lettering', 'face', 'fontName', FACES);
  const color = pick('Color', 'color', 'foreColor', COLORS);
  [...face.sel.options].forEach(o => { o.style.fontFamily = `"${o.value}"`; });
  [...color.sel.options].forEach(o => { o.style.color = o.value; });
  const showPen = () => {
    size.sel.value = pen.size; face.sel.value = pen.face; color.sel.value = pen.color;
    face.sel.style.fontFamily = `"${pen.face}"`;
    color.sel.style.color = pen.color;
  };
  showPen();

  const bold = B(h('b', 'B'), 'bold', null, { title: 'Bold' });
  const ital = B(h('i', 'I'), 'italic', null, { title: 'Slanted' });
  const under = B(h('u', 'U'), 'underline', null, { title: 'Underline' });
  const syncButtons = () => {
    const s = getSelection();
    if (!s.rangeCount || !paper.contains(s.anchorNode)) return;
    [[bold, 'bold'], [ital, 'italic'], [under, 'underline']].forEach(([b, c]) => {
      let on = false; try { on = document.queryCommandState(c); } catch {}
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  };

  // ---------- pictures ----------
  const insertImg = (src, width, alt = '') => {
    paper.focus(); restoreSel();
    document.execCommand('insertHTML', false, `<img src="${src}" style="width:${width}" alt="${esc(alt)}">`);
    persist();
  };
  const addPhoto = async (f) => {
    try {
      const p = await readPhoto(f, 1400);
      insertImg(p.src, '3.5in');
      toast('Picture added. Click it to make it bigger or smaller.');
    } catch (err) { toast(err.message, 'bad'); }
  };
  const photoIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: (e) => {
    const f = e.target.files[0]; if (f) addPhoto(f); e.target.value = '';
  } });
  const clipartMenu = () => {
    const m = modal('Choose a little picture', CLIPART.map(g => h('div', { style: { marginBottom: '1rem' } }, h('h3', g.group),
      h('div.clip-grid', g.items.map(em => h('button', { onclick: () => { m.close(); insertImg(emojiPng(em, 256), '1in'); toast('Picture added. Click it to make it bigger or smaller.'); }, 'aria-label': 'Picture ' + em }, em))))), { wide: true });
  };
  const pictureMenu = () => {
    remember();
    const m = modal('Add a picture', [
      h('div.tiles',
        h('button.tile', { onclick: () => { m.close(); photoIn.click(); } }, h('span.ico', '🌄'), h('b', 'A photo'),
          h('span', 'From your Photos library, or a picture saved on this computer')),
        h('button.tile', { onclick: () => { m.close(); clipartMenu(); } }, h('span.ico', '🌸'), h('b', 'A little picture'),
          h('span', 'Flowers, hearts, holidays and more'))),
      h('div.note.info', { style: { marginTop: '1rem' } },
        h('p', { style: { margin: '0 0 .4rem' } }, h('b', 'Finding your photos: '), 'after you click “A photo”, a window opens. Click ', h('b', 'Photos'), ' on the left side of that window to see your photo library.'),
        h('p', { style: { margin: 0 } }, h('b', 'Or: '), 'open the Photos app, and drag a photo straight onto your letter.')),
    ]);
  };

  let selImg = null;
  const sizeImg = (w) => () => { if (selImg) { selImg.style.width = w; persist(); } };
  const imgBar = h('div.row', { style: { display: 'none' } }, h('b', 'Picture:'),
    h('button.btn', { onclick: sizeImg('1in') }, 'Tiny'), h('button.btn', { onclick: sizeImg('2in') }, 'Small'), h('button.btn', { onclick: sizeImg('3.5in') }, 'Medium'),
    h('button.btn', { onclick: sizeImg('6.5in') }, 'Large'),
    h('button.btn', { onclick: () => { if (selImg) { selImg.style.display = 'block'; selImg.style.margin = '0 auto'; persist(); } } }, 'Center it'),
    h('button.btn.danger', { onclick: () => { if (selImg) { selImg.remove(); selImg = null; imgBar.style.display = 'none'; persist(); } } }, 'Remove'));

  // ---------- attachments ----------
  const attachBox = h('div.attach-box');
  const attachIn = h('input', { type: 'file', multiple: true, style: { display: 'none' }, onchange: async (e) => {
    for (const f of [...e.target.files]) await attachFile(f);
    e.target.value = '';
  } });
  async function attachFile(f) {
    if (f.size > MAX_FILE) { toast(`“${f.name}” is too big to attach (the limit is 20 MB).`, 'bad'); return; }
    try {
      const rec = { name: f.name, type: f.type || 'application/octet-stream', size: f.size, dataUrl: await readAsDataUrl(f) };
      const aid = uid();
      await putFile(aid, rec);
      l.attachments.push({ id: aid, name: rec.name, type: rec.type, size: rec.size });
      persist(); drawAttach();
      toast(`📎 “${f.name}” is attached to this letter.`);
    } catch (err) { console.error(err); toast('Sorry, that file could not be attached.', 'bad'); }
  }
  const openAttachment = async (a, print) => {
    const f = await getFile(a.id);
    if (!f) { toast('That file could not be found.', 'bad'); return; }
    const blob = await dataUrlToBlob(f.dataUrl, opensInBrowser(f.type) ? f.type : 'application/octet-stream');
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    if (print && /^image\//.test(f.type)) {
      const area = document.getElementById('print-area');
      area.innerHTML = '';
      area.append(h('div.print-photo', h('img', { src: url, alt: '' })));
      setTimeout(() => window.print(), 300);
      return;
    }
    if (opensInBrowser(f.type)) {
      const w = window.open(url, '_blank');
      if (!w) location.href = url;
      if (print) toast('When it opens, press ⌘ and P together to print it.');
      return;
    }
    const link = h('a', { href: url, download: f.name });
    document.body.append(link); link.click(); link.remove();
    toast(`“${f.name}” was saved to your Downloads folder. Open it from there.`);
  };
  const drawAttach = () => {
    attachBox.innerHTML = '';
    if (!l.attachments.length) return;
    attachBox.append(h('h3', `📎 Attached to this letter (${l.attachments.length})`),
      h('div.list', l.attachments.map(a => h('div.item',
        h('span.ico', fileIcon(a.type, a.name)),
        h('div.t', h('b', a.name), h('small', fmtSize(a.size))),
        h('button.btn', { onclick: () => openAttachment(a, false) }, opensInBrowser(a.type) ? '👀 Open' : '📂 Open'),
        /^image\//.test(a.type) || a.type === 'application/pdf' ? h('button.btn', { onclick: () => openAttachment(a, true) }, '🖨️ Print') : null,
        h('button.btn.danger', { 'aria-label': 'Remove ' + a.name, onclick: async () => {
          if (!await confirmBox('Remove this attachment?', `“${a.name}” will be taken off this letter.`, 'Yes, remove')) return;
          l.attachments = l.attachments.filter(x => x.id !== a.id); delFile(a.id); persist(); drawAttach();
        } }, '🗑️ Remove')))));
  };
  drawAttach();

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
    setTimeout(() => {
      window.print();
      if (l.attachments.length) toast('📎 Attachments print separately — use the 🖨️ Print button next to each one.');
    }, 50);
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
      bold, ital, under,
      h('span.sep'), size.node, face.node, color.node,
      h('span.sep'), B('☰ Left', 'justifyLeft'), B('≡ Center', 'justifyCenter'), B('Right ☰', 'justifyRight'),
      h('span.sep'), B('• List', 'insertUnorderedList'),
      keepFocus(h('button.btn', { onclick: pictureMenu }, '🖼️ Picture')), photoIn,
      keepFocus(h('button.btn', { onclick: () => { remember(); attachIn.click(); } }, '📎 Attach')), attachIn,
      h('span.sep'), B('↶ Undo', 'undo'), B('↷ Redo', 'redo'),
      h('span.grow'),
      h('button.btn', { onclick: envelope }, '✉️ Envelope'),
      h('button.btn.primary', { onclick: doPrint }, '🖨️ Print')),
    imgBar,
    paper.querySelector('.fill') || /class="fill"/.test(l.html) ? h('p.note.small', '💡 Click on a ', h('span', { style: { background: '#fff1a8', padding: '0 .3em' } }, 'yellow part'), ' and type to replace it. Spelling mistakes get a red line underneath — right-click (or Control-click) the word to fix it.') : null,
    attachBox,
    h('p.note.info.photo-tip', '📷 ', h('b', 'To add a photo: '), 'open the ', h('b', 'Photos'), ' app, then drag the photo onto your letter and let go. (Or click ', h('b', '🖼️ Picture'), ' above.)'),
    desk,
    h('div.actions-bar',
      h('button.btn.big', { onclick: envelope }, '✉️ Print an envelope for this letter'),
      h('button.btn.big.primary', { onclick: doPrint }, '🖨️ Print letter')));

  setTimeout(() => { paper.focus(); const f = paper.querySelector('.fill'); if (f) { const r = document.createRange(); r.selectNodeContents(f); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }, 50);
  return { node, cleanup: () => { document.removeEventListener('selectionchange', remember); persist(); } };
}

import { data, save, uid } from '../store.js';
import { h, modal, toast, confirmBox, formatAddress } from '../ui.js';

export function sortedAddresses() {
  return [...data.addresses].sort((a, b) => lastName(a).localeCompare(lastName(b)) || (a.name || '').localeCompare(b.name || ''));
}
function lastName(a) {
  const parts = String(a.name || '').trim().split(/\s+/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

/** Pop-up to add or change one address. Resolves with the saved address (or null). */
export function editAddress(existing) {
  return new Promise((resolve) => {
    const a = existing ? { ...existing } : { id: uid(), name: '', company: '', line1: '', line2: '', city: '', state: '', zip: '' };
    let saved = false;
    const f = (key, label, cls = '', ph = '') => h('label.field' + (cls ? '.' + cls : ''), h('span', label),
      h('input', { type: 'text', value: a[key] || '', placeholder: ph, autocomplete: 'off', oninput: (e) => { a[key] = e.target.value; } }));
    const doSave = () => {
      if (!String(a.name || '').trim() && !String(a.line1 || '').trim()) { toast('Please type at least a name.', 'bad'); return; }
      const i = data.addresses.findIndex(x => x.id === a.id);
      a.updated = Date.now();
      if (i >= 0) data.addresses[i] = a; else data.addresses.push(a);
      save('addresses', true);
      saved = true; m.close();
      toast(existing ? 'Address updated ✔' : 'Address saved ✔');
      resolve(a);
    };
    const m = modal(existing ? 'Change address' : 'Add a person', [
      h('div.ab-grid',
        f('name', 'Name', 'full', 'Mary and John Smith'),
        f('company', 'Company (if any)', 'full'),
        f('line1', 'Street address', 'full', '123 Main Street'),
        f('line2', 'Apartment, unit (if any)', 'full'),
        f('city', 'City'),
        h('div.row', { style: { flexWrap: 'nowrap' } },
          h('div', { style: { flex: '1' } }, f('state', 'State')),
          h('div', { style: { flex: '1.4' } }, f('zip', 'ZIP code')))),
      h('div.row.end',
        h('button.btn.big', { onclick: () => m.close() }, 'Cancel'),
        h('button.btn.big.primary', { onclick: doSave }, '✔ Save')),
    ], { onClose: () => { if (!saved) resolve(null); } });
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') doSave(); });
  });
}

export function addressesView() {
  const listEl = h('div');
  let q = '';
  const draw = () => {
    listEl.innerHTML = '';
    const all = sortedAddresses().filter(a => !q || formatAddress(a).toLowerCase().includes(q));
    if (!data.addresses.length) {
      listEl.append(h('div.card', h('p.lead', 'Your address book is empty.'),
        h('p', 'Click ', h('b', '➕ Add a person'), ' to type in an address, or bring them in from your Mac\'s Contacts app.')));
      return;
    }
    if (!all.length) { listEl.append(h('p.muted', 'Nobody matches that search.')); return; }
    listEl.append(h('table.ab-table', h('tbody', all.map(a => h('tr',
      h('td', { style: { whiteSpace: 'pre-line' } }, h('b', a.name || '(no name)'), '\n', formatAddress({ ...a, name: '' })),
      h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
        h('a.btn', { href: `#/envelopes?to=${a.id}` }, '✉️ Envelope'), ' ',
        h('button.btn', { onclick: async () => { if (await editAddress(a)) draw(); } }, '✏️ Change'), ' ',
        h('button.btn.danger', { onclick: async () => {
          if (await confirmBox('Remove this person?', `${a.name || 'This address'} will be taken out of your address book.`, 'Yes, remove')) {
            data.addresses = data.addresses.filter(x => x.id !== a.id); save('addresses', true); draw(); toast('Removed');
          } } }, '🗑️')))))));
  };
  draw();

  return h('div',
    h('div.page-head', h('h1', '📇 Address Book'), h('span.spacer'),
      h('button.btn.big', { onclick: () => importDialog(draw) }, '📥 Bring in from Contacts'),
      h('button.btn.big.primary', { onclick: async () => { if (await editAddress()) draw(); } }, '➕ Add a person')),
    h('div.search-big', h('input', { type: 'search', placeholder: '🔍 Find someone…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } })),
    h('p.muted', `${data.addresses.length} ${data.addresses.length === 1 ? 'person' : 'people'} in your address book`),
    listEl);
}

// ---------- import ----------

function importDialog(onDone) {
  const input = h('input', { type: 'file', accept: '.vcf,.csv,.txt,text/vcard,text/csv', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      let found = /BEGIN:VCARD/i.test(text) ? parseVcards(text) : parseCsv(text);
      const before = data.addresses.length;
      const key = a => (a.name + '|' + a.line1).toLowerCase().replace(/\s+/g, ' ');
      const have = new Set(data.addresses.map(key));
      let skipped = 0;
      for (const a of found) {
        if (!a.line1 && !a.city) { skipped++; continue; }
        if (have.has(key(a))) continue;
        have.add(key(a));
        data.addresses.push({ id: uid(), updated: Date.now(), company: '', line2: '', ...a });
      }
      save('addresses', true);
      m.close();
      const added = data.addresses.length - before;
      toast(`Added ${added} ${added === 1 ? 'person' : 'people'}${skipped ? ` (${skipped} had no street address)` : ''}`);
      onDone && onDone();
    } });
  const m = modal('Bring in addresses from Contacts', [
    h('p.lead', 'You can copy everyone from your Mac\'s Contacts app in a few steps:'),
    h('ol',
      h('li', 'Open the ', h('b', 'Contacts'), ' app (the brown address book).'),
      h('li', 'Click on any name, then press ', h('kbd', '⌘'), ' + ', h('kbd', 'A'), ' to pick everyone.'),
      h('li', 'At the top of the screen click ', h('b', 'File'), ' → ', h('b', 'Export'), ' → ', h('b', 'Export vCard…'), ' and save it to your Desktop.'),
      h('li', 'Come back here and click the button below, then pick that file.')),
    h('p.small.muted', 'Spreadsheet files (.csv) with columns like Name, Address, City, State, ZIP also work. People already in your address book are not added twice.'),
    h('div.row.end', input, h('button.btn.big.primary', { onclick: () => input.click() }, '📂 Choose the file')),
  ]);
}

function unfold(text) { return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); }
function vval(s) { return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\'); }

export function parseVcards(text) {
  const out = [];
  for (const card of unfold(text).split(/BEGIN:VCARD/i).slice(1)) {
    const lines = card.split('\n');
    let fn = '', n = '', org = '', adrs = [];
    for (const line of lines) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const head = line.slice(0, i).toUpperCase(), val = line.slice(i + 1).trim();
      const prop = head.split(';')[0].replace(/^ITEM\d+\./, '');
      if (prop === 'FN') fn = vval(val);
      else if (prop === 'N') n = val;
      else if (prop === 'ORG') org = vval(val.split(';')[0]);
      else if (prop === 'ADR') adrs.push({ home: /HOME/.test(head), pref: /PREF/.test(head), parts: val.split(';').map(vval) });
    }
    if (!fn && n) { const p = n.split(';'); fn = [p[1], p[0]].filter(Boolean).join(' '); }
    const adr = adrs.find(a => a.home) || adrs.find(a => a.pref) || adrs[0];
    const a = { name: fn || org, company: fn && org ? org : '', line1: '', line2: '', city: '', state: '', zip: '' };
    if (adr) {
      const [pobox, ext, street, city, region, zip, country] = adr.parts;
      const streetLines = String(street || '').split('\n');
      a.line1 = [pobox, streetLines[0]].filter(Boolean).join(' ');
      a.line2 = [ext, ...streetLines.slice(1), country && !/^(usa|us|united states( of america)?)$/i.test(country) ? country : ''].filter(Boolean).join(', ');
      a.city = city || ''; a.state = region || ''; a.zip = zip || '';
    }
    if (a.name || a.line1) out.push(a);
  }
  return out;
}

function splitCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

export function parseCsv(text) {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(x => x.toLowerCase().trim());
  const find = (...res) => head.findIndex(x => res.some(r => r.test(x)));
  const col = {
    first: find(/^first/), last: find(/^last/), name: find(/^(full )?name$/, /^names?$/, /^display/, /^addressee/),
    company: find(/company|organi[sz]ation/), line1: find(/^(street|address)( ?1| line 1)?$/, /street/, /^address/),
    line2: find(/address ?2|line 2|apt|suite|unit/), city: find(/city|town/), state: find(/^state|province|region/), zip: find(/zip|postal|post code/),
  };
  if (col.line2 === col.line1) col.line2 = -1;
  const g = (r, k) => (col[k] >= 0 ? (r[col[k]] || '').trim() : '');
  return rows.slice(1).map(r => ({
    name: g(r, 'name') || [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' '),
    company: g(r, 'company'), line1: g(r, 'line1'), line2: g(r, 'line2'), city: g(r, 'city'), state: g(r, 'state'), zip: g(r, 'zip'),
  })).filter(a => a.name || a.line1);
}

/**
 * A list of people with checkboxes (for labels/envelopes).
 * selected: array of ids (mutated). onChange called after changes.
 */
export function addressPicker(selected, onChange, { single = false } = {}) {
  const wrap = h('div.stack');
  let q = '';
  const listEl = h('div.addr-list');
  const count = h('span.muted.small');
  const draw = () => {
    listEl.innerHTML = '';
    const all = sortedAddresses().filter(a => !q || formatAddress(a).toLowerCase().includes(q));
    if (!data.addresses.length) listEl.append(h('p', { style: { padding: '.8rem' } }, 'No one in your address book yet.'));
    for (const a of all) {
      const on = selected.includes(a.id);
      const cb = h('input', { type: single ? 'radio' : 'checkbox', checked: on, tabIndex: -1, name: 'pick-addr' });
      listEl.append(h('div.addr-row', { role: single ? 'radio' : 'checkbox', 'aria-checked': on ? 'true' : 'false', tabIndex: 0,
        onclick: () => toggle(a.id), onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(a.id); } } },
        cb, h('div.t', h('b', a.name || '(no name)'), h('small', formatAddress({ ...a, name: '' }).replace(/\n/g, ', ')))));
    }
    count.textContent = single ? '' : `${selected.length} picked`;
  };
  const toggle = (id) => {
    const i = selected.indexOf(id);
    if (single) { selected.splice(0, selected.length, id); }
    else if (i >= 0) selected.splice(i, 1); else selected.push(id);
    draw(); onChange();
  };
  draw();
  wrap.append(...[
    h('input', { type: 'search', placeholder: '🔍 Find someone…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } }),
    !single ? h('div.row.between', count, h('div.row',
      h('button.btn', { onclick: () => { selected.splice(0, selected.length, ...sortedAddresses().filter(a => !q || formatAddress(a).toLowerCase().includes(q)).map(a => a.id)); draw(); onChange(); } }, 'Pick everyone'),
      h('button.btn', { onclick: () => { selected.splice(0); draw(); onChange(); } }, 'Clear'))) : null,
    listEl,
    h('button.btn', { onclick: async () => { const a = await editAddress(); if (a) { if (single) selected.splice(0, selected.length, a.id); else selected.push(a.id); draw(); onChange(); } } }, '➕ Add someone new'),
  ].filter(Boolean));
  wrap.refresh = draw;
  return wrap;
}

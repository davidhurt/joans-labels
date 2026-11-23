import { data, save } from '../store.js';
import { h, go, fmtDate } from '../ui.js';
import { findTemplate } from '../templates.js';
import { meForm } from './settings.js';

export function homeView() {
  const s = data.settings;
  const recent = [
    ...data.labels.map(l => ({ kind: 'label', ico: '🏷️', title: l.name, sub: labelSub(l), when: l.updated, href: `#/labels/edit/${l.id}` })),
    ...data.letters.map(l => ({ kind: 'letter', ico: '📝', title: l.title, sub: 'Letter', when: l.updated, href: `#/letters/edit/${l.id}` })),
  ].sort((a, b) => b.when - a.when).slice(0, 6);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (s.me.name || '').split(' ')[0];

  const node = h('div',
    h('div.hero',
      h('h1', `${hello}${first ? ', ' + first : ''}!`),
      h('p.lead.muted', 'What would you like to make today?')),
    h('div.tiles',
      tile('🏷️', 'Labels', 'Avery address labels, return labels, stickers, name tags and more', '#/labels'),
      tile('✉️', 'Envelopes', 'Print the address right on an envelope', '#/envelopes'),
      tile('📝', 'Letters', 'Write and print a letter or note', '#/letters'),
      tile('📇', 'Address Book', `${data.addresses.length} ${data.addresses.length === 1 ? 'person' : 'people'} saved`, '#/addresses'),
    ),
    recent.length ? [
      h('h2.section-title', 'Pick up where you left off'),
      h('div.list', recent.map(r => h('a.item', { href: r.href, style: { textDecoration: 'none', color: 'inherit' } },
        h('span.ico', r.ico),
        h('span.t', h('b', r.title), h('small', `${r.sub} · changed ${fmtDate(r.when)}`)),
        h('span.btn', 'Open')))),
    ] : null,
    h('div.row', { style: { marginTop: '2rem' } },
      h('a.btn.big', { href: '#/settings' }, '👤 My Info & Printer Setup'),
      h('a.btn.big', { href: '#/help' }, '❓ Help')),
  );

  if (!s.welcomed) setTimeout(() => welcome(), 50);
  return node;
}

function labelSub(l) {
  const t = findTemplate(l.templateId);
  return t ? `Avery ${t.sku} labels` : 'Labels';
}

function tile(ico, title, sub, href) {
  return h('a.tile', { href }, h('span.ico', ico), h('b', title), h('span', sub));
}

function welcome() {
  const back = h('div.modal-back');
  const done = () => { data.settings.welcomed = true; save('settings', true); back.remove(); go('#/'); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  const form = meForm();
  back.append(h('div.modal', { role: 'dialog', 'aria-modal': 'true' },
    h('div.modal-head', h('h2', '👋 Welcome!')),
    h('div.modal-body',
      h('p.lead', 'This is your place to print labels, envelopes and letters.'),
      h('p', 'First, type your own name and address. It will be used as your return address. You only do this once.'),
      form,
      h('div.row.end',
        h('button.btn.big', { onclick: done }, 'Skip for now'),
        h('button.btn.big.primary', { onclick: done }, 'Save and start')))));
  document.body.append(back);
}

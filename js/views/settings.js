import { data, save, backupJSON, restoreJSON } from '../store.js';
import { h, toast, showPrint, confirmBox, isSafari } from '../ui.js';
import { findTemplate } from '../templates.js';
import { labelsPdf } from '../engine.js';

/** Form for her own name and address (saves as she types). */
export function meForm() {
  const me = data.settings.me;
  const f = (key, label, cls = '', ph = '') => h('label.field' + (cls ? '.' + cls : ''), h('span', label),
    h('input', { type: 'text', value: me[key] || '', placeholder: ph, autocomplete: 'off',
      oninput: (e) => { me[key] = e.target.value; save('settings'); } }));
  return h('div.ab-grid',
    f('name', 'Your name', 'full', 'Joan Smith'),
    f('line1', 'Street address', 'full', '123 Main Street'),
    f('line2', 'Apartment, unit (if any)', 'full', ''),
    f('city', 'City', '', ''),
    h('div.row', { style: { gap: '.6rem', flexWrap: 'nowrap' } },
      h('div', { style: { flex: '1' } }, f('state', 'State', '', 'MA')),
      h('div', { style: { flex: '1.4' } }, f('zip', 'ZIP code', '', ''))));
}

export function settingsView() {
  const s = data.settings;
  const nudge = s.nudge;

  const sizeBtns = h('div.seg');
  const drawSize = () => {
    sizeBtns.innerHTML = '';
    [['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large']].forEach(([id, name]) =>
      sizeBtns.append(h('button.btn' + (s.textSize === id ? '.on' : ''), { onclick: () => { s.textSize = id; save('settings'); window.dispatchEvent(new Event('textsize')); drawSize(); } }, name)));
  };
  drawSize();

  const out = { x: h('output'), y: h('output'), k: h('output') };
  const showN = () => {
    out.x.textContent = fmtNudge(nudge.x, 'right', 'left');
    out.y.textContent = fmtNudge(nudge.y, 'down', 'up');
    out.k.textContent = `${nudge.scale}%`;
  };
  showN();
  const step = (key, d) => () => {
    if (key === 'scale') nudge.scale = Math.max(90, Math.min(110, Math.round((nudge.scale + d) * 10) / 10));
    else nudge[key] = Math.round((nudge[key] + d) * 1000) / 1000;
    save('settings'); showN();
  };

  const testPrint = async () => {
    const t = findTemplate('5160');
    const design = { mode: 'same', text: 'Alignment test\nJoan\'s Labels', style: { font: 'helvetica', size: 11, align: 'center', color: '#000000' } };
    const plan = { pages: [Array.from({ length: t.count }, (_, i) => ({ index: i, text: design.text }))] };
    const doc = await labelsPdf(t, design, plan, nudge, { test: true });
    showPrint(doc, { title: 'Printer alignment test', filename: 'alignment-test.pdf', tips: printTips(true) });
  };

  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const ok = await confirmBox('Restore from backup?', 'This will replace everything in the app with what is in the backup file.', 'Yes, restore');
      if (!ok) return;
      try { await restoreJSON(await file.text()); toast('Backup restored ✔'); setTimeout(() => location.reload(), 600); }
      catch (err) { toast(err.message || 'That file did not work.', 'bad'); }
    } });

  const doBackup = () => {
    const blob = new Blob([backupJSON()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `Labels-and-Letters-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    s.lastBackup = Date.now(); save('settings');
    toast('Backup saved to your Downloads folder ✔');
  };

  return h('div',
    h('div.page-head', h('h1', '👤 My Info & Printer Setup')),
    h('div.stack',
      h('div.card', h('h2', 'My name and address'), h('p.muted', 'Used as your return address on labels, envelopes and letters. Changes save by themselves.'), meForm()),
      h('div.card', h('h2', 'Size of the writing in this app'), sizeBtns),
      h('div.card',
        h('h2', 'Line up labels with my printer'),
        h('p', 'Every printer is a little different. If your labels print a bit off, fix it here once and it will be remembered.'),
        h('ol',
          h('li', 'Click ', h('b', 'Print a test page'), ' and print it on ', h('b', 'plain paper'), '.'),
          h('li', 'Put the test page on top of an empty label sheet and hold both up to a window.'),
          h('li', 'If the boxes are off, use the buttons below, then test again.')),
        h('button.btn.big.primary', { onclick: testPrint }, '🖨️ Print a test page'),
        h('div.stack', { style: { marginTop: '1rem' } },
          nudgeRow('Move left or right', step('x', -0.03), step('x', 0.03), out.x, '◀ Left', 'Right ▶'),
          nudgeRow('Move up or down', step('y', -0.03), step('y', 0.03), out.y, '▲ Up', 'Down ▼'),
          nudgeRow('Make bigger or smaller', step('scale', -0.5), step('scale', 0.5), out.k, '➖ Smaller', 'Bigger ➕'),
          h('button.btn', { onclick: () => { nudge.x = 0; nudge.y = 0; nudge.scale = 100; save('settings'); showN(); } }, 'Reset to normal'))),
      h('div.card',
        h('h2', 'Keep a backup'),
        h('p', 'Your addresses, labels and letters are saved inside this web browser on this computer. Save a backup file now and then so nothing is ever lost.'),
        s.lastBackup ? h('p.small.muted', `Last backup: ${new Date(s.lastBackup).toLocaleDateString()}`) : h('p.small.muted', 'No backup made yet.'),
        h('div.row',
          h('button.btn.big.primary', { onclick: doBackup }, '💾 Save a backup file'),
          h('button.btn.big', { onclick: () => fileIn.click() }, '📂 Restore from a backup'),
          fileIn)),
    ));
}

function fmtNudge(v, pos, neg) {
  if (!v) return 'not moved';
  const n = Math.round(Math.abs(v) * 32);
  return `${n}/32" ${v > 0 ? pos : neg}`;
}

function nudgeRow(label, minus, plus, out, a, b) {
  return h('div.row', h('b', { style: { minWidth: '14rem' } }, label),
    h('button.btn', { onclick: minus }, a), out, h('button.btn', { onclick: plus }, b));
}

export function printTips(isTest = false) {
  const safari = isSafari();
  const tips = [];
  if (isTest) tips.push('Use <b>plain paper</b> for this test.');
  else tips.push('Put the label sheet in the printer. Check the little picture on your printer for which side faces up.');
  if (safari) {
    tips.push('Click the big <b>Print</b> button. Your page opens in a new tab.');
    tips.push('Press <kbd>⌘</kbd> + <kbd>P</kbd> (or click <b>File</b> → <b>Print</b>).');
    tips.push('Make sure <b>Scale</b> says <b>100%</b>, then click <b>Print</b>.');
  } else {
    tips.push('Click the big <b>Print</b> button. A print window opens.');
    tips.push('Click <b>More settings</b> and set <b>Scale</b> to <b>Actual size</b> (not "Fit").');
    tips.push('Click the blue <b>Print</b> button.');
  }
  tips.push('When done, close that tab to come back here.');
  return tips;
}

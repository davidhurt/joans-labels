import { load, data, save } from './store.js';
import { h, toast, closeAllModals } from './ui.js';
import { homeView } from './views/home.js';
import { labelsView, labelEditorView } from './views/labels.js';
import { envelopesView } from './views/envelopes.js';
import { lettersView, letterEditorView } from './views/letters.js';
import { addressesView } from './views/addresses.js';
import { settingsView } from './views/settings.js';
import { helpView } from './views/help.js';

const app = document.getElementById('app');
let cleanup = null;

const routes = [
  [/^#?\/?$/, 'home', () => homeView()],
  [/^#\/labels\/?$/, 'labels', () => labelsView()],
  [/^#\/labels\/new\/([\w-]+)$/, 'labels', (m) => labelEditorView({ templateId: m[1] })],
  [/^#\/labels\/edit\/([\w-]+)$/, 'labels', (m) => labelEditorView({ id: m[1] })],
  [/^#\/envelopes\/?(?:\?(.*))?$/, 'envelopes', (m) => envelopesView(new URLSearchParams(m[1] || ''))],
  [/^#\/letters\/?$/, 'letters', () => lettersView()],
  [/^#\/letters\/edit\/([\w-]+)$/, 'letters', (m) => letterEditorView(m[1])],
  [/^#\/addresses\/?$/, 'addresses', () => addressesView()],
  [/^#\/settings\/?$/, 'settings', () => settingsView()],
  [/^#\/help\/?(?:\/(\w+))?$/, 'help', (m) => helpView(m[1])],
];

function render() {
  const hash = location.hash || '#/';
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  closeAllModals();
  for (const [re, nav, fn] of routes) {
    const m = hash.match(re);
    if (m) {
      document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
      app.innerHTML = '';
      const res = fn(m);
      const node = res && res.node ? res.node : res;
      cleanup = res && res.cleanup ? res.cleanup : null;
      app.append(node);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

function applyTextSize() {
  document.documentElement.dataset.size = data.settings.textSize || 'large';
}
window.addEventListener('textsize', applyTextSize);
window.addEventListener('save-error', () => toast('Could not save on this computer. Try making a backup in My Info.', 'bad'));

(async function start() {
  await load();
  applyTextSize();
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

export { save };

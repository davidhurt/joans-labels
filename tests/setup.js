// Lets the browser code run under Node for testing.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

globalThis.window = globalThis;
window.jspdf = require(path.join(ROOT, 'vendor/jspdf.umd.min.js'));
globalThis.document = globalThis.document || { fonts: { load: async () => [] } };
globalThis.fetch = async (url) => {
  const buf = await readFile(path.join(ROOT, String(url)));
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
// jsPDF prints harmless warnings for some ops; keep test output readable.
const warn = console.warn;
console.warn = (...a) => { if (!String(a[0]).includes('jsPDF')) warn(...a); };

export const engine = await import('../js/engine.js');
export const templates = await import('../js/templates.js');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine as E, templates as T } from './setup.js';

const EPS = 1e-6;
const addr = (a) => [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join('\n');
const PEOPLE = Array.from({ length: 45 }, (_, i) => ({ id: 'p' + i, name: `Person Number ${i}`, line1: `${100 + i} Main Street`, line2: i % 3 ? '' : 'Apt 2', city: 'Springfield', state: 'IL', zip: '62701' }));
const LONG = 'The Garcia-Montgomery Family Trust\n1600 Long Boulevard Northwest Extension\nSuite 1200, Building C\nSan Francisco, CA 94110-1234';
const style = (o = {}) => ({ font: 'helvetica', size: 14, bold: false, italic: false, align: 'left', color: '#000000', ...o });

// ---------- templates ----------
test('every template: labels sit on the page and never overlap', () => {
  for (const t of T.TEMPLATES) {
    assert.equal(t.count, t.cols * t.rows, `${t.sku} count`);
    assert.ok(t.hp >= t.w - EPS, `${t.sku} labels overlap sideways`);
    assert.ok(t.vp >= t.h - EPS, `${t.sku} labels overlap up/down`);
    for (let i = 0; i < t.count; i++) {
      const r = T.labelRect(t, i);
      assert.ok(r.x >= -EPS && r.y >= -EPS, `${t.sku} label ${i} off top/left`);
      assert.ok(r.x + r.w <= t.pageW + EPS && r.y + r.h <= t.pageH + EPS, `${t.sku} label ${i} off right/bottom`);
    }
  }
});

test('Avery 5160 matches Avery\'s published layout', () => {
  const t = T.findTemplate('5160');
  const first = T.labelRect(t, 0), last = T.labelRect(t, 29);
  assert.deepEqual([first.x, first.y, first.w, first.h], [0.1875, 0.5, 2.625, 1]);
  assert.ok(Math.abs(t.pageW - (last.x + last.w) - 0.1875) < EPS);
  assert.ok(Math.abs(t.pageH - (last.y + last.h) - 0.5) < EPS);
});

test('template ids are unique and every Avery number finds exactly one size', () => {
  const ids = new Set();
  const owner = new Map();
  for (const t of T.TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
    for (const n of [t.sku, ...(t.also || [])]) {
      const prev = owner.get(String(n));
      assert.ok(!prev || prev === t.id, `Avery ${n} listed under both ${prev} and ${t.id}`);
      owner.set(String(n), t.id);
    }
  }
  for (const [n, id] of owner) {
    const r = T.searchTemplates(n);
    assert.equal(r.length, 1, `search ${n} gave ${r.length} results`);
    assert.equal(r[0].id, id);
    assert.equal(T.searchTemplates(`Avery ${n}`)[0].id, id);
    assert.equal(T.searchTemplates(` #${n} `)[0].id, id);
  }
});

test('search by words and unknown numbers', () => {
  assert.ok(T.searchTemplates('round').length >= 4);
  assert.ok(T.searchTemplates('name badge').some(t => t.sku === 5395));
  assert.equal(T.searchTemplates('99999').length, 0);
  assert.equal(T.searchTemplates('').length, T.TEMPLATES.length);
});

test('custom size template spreads labels evenly and fits', () => {
  const t = T.customTemplate({ w: 2, h: 1, cols: 3, rows: 8, shape: 'rect' });
  const last = T.labelRect(t, t.count - 1);
  assert.ok(Math.abs(t.left - (8.5 - last.x - last.w)) < EPS);
  assert.ok(Math.abs(t.top - (11 - last.y - last.h)) < EPS);
});

// ---------- text fitting ----------
test('text always fits inside its box (all fonts, styles, sizes)', async () => {
  for (const f of E.FONTS) await E.ensureFont(f.id);
  const boxes = [{ w: 2.3, h: 0.8 }, { w: 1.5, h: 0.35 }, { w: 3.7, h: 1.8 }, { w: 1.2, h: 1.2 }];
  const texts = [LONG, 'Hi', 'A'.repeat(60), 'Strawberry Jam\nJune 2026', 'One\nTwo\nThree\nFour\nFive\nSix'];
  for (const f of E.FONTS) for (const bold of [false, true]) for (const italic of [false, true]) {
    for (const b of boxes) for (const text of texts) for (const size of [8, 14, 30]) {
      const s = style({ font: f.id, bold, italic, size });
      const box = { x: 1, y: 1, ...b };
      const { ops, size: used } = E.layoutText(text, s, box);
      assert.ok(used <= size + EPS);
      for (const op of ops) {
        const w = E.textWidth(op.str, op.font, { bold, italic, font: op.font }, op.size);
        if (op.size > 5) assert.ok(w <= box.w + 1e-3, `${f.id} "${op.str}" ${w.toFixed(2)}in > ${box.w}`);
        assert.ok(op.y <= box.y + box.h + 1e-6, `${f.id} text below box`);
        assert.ok(op.y >= box.y, `${f.id} text above box`);
      }
    }
  }
});

test('long address lines wrap before the writing gets tiny', () => {
  const r = E.layoutText('Person\n1600 Long Boulevard Northwest Extension\nSan Francisco, CA 94110', style({ size: 12 }), { x: 0, y: 0, w: 2.3, h: 0.8 });
  assert.ok(r.size >= 8, `size dropped to ${r.size}`);
});

test('cleanText keeps accents and removes things the printer fonts cannot show', () => {
  assert.equal(E.cleanText('José Müller'), 'José Müller');
  assert.equal(E.cleanText('“Hi” – it’s…'), '"Hi" - it\'s...');
  assert.equal(E.cleanText('Love ❤️ you 🎄'), 'Love  you ');
});

test('too much writing: never spills outside, and says so', () => {
  const r = E.layoutText('1\n2\n3\n4\n5\n6\n7\n8', style({ size: 12 }), { x: 0, y: 0, w: 1.5, h: 0.3 });
  assert.equal(r.overflow, true);
  assert.ok(r.ops.every(o => o.y >= 0 && o.y <= 0.3));
  assert.equal(E.layoutText('Hi', style(), { x: 0, y: 0, w: 2, h: 1 }).overflow, false);
});

test('empty text makes no drawing', () => {
  assert.equal(E.layoutText('', style(), { x: 0, y: 0, w: 2, h: 1 }).ops.length, 0);
  assert.equal(E.layoutText('\n\n  \n', style(), { x: 0, y: 0, w: 2, h: 1 }).ops.length, 0);
});

test('unknown or missing font falls back to Helvetica instead of crashing', () => {
  const r = E.layoutText('Hello', style({ font: 'nope' }), { x: 0, y: 0, w: 2, h: 1 });
  assert.equal(r.ops[0].font, 'helvetica');
});

// ---------- labels ----------
test('every label layout stays inside its label (every template)', () => {
  for (const t of T.TEMPLATES) {
    for (const pic of [null, { src: 'data:image/png;base64,AA', ar: 1, pos: 'left' }, { src: 'data:image/png;base64,AA', ar: 2, pos: 'top' }]) {
      const r = T.labelRect(t, 0);
      const { ops } = E.layoutLabel(t, r, LONG, { style: style({ size: 30 }), picture: pic });
      for (const op of ops) {
        if (op.type === 'image') {
          assert.ok(op.x >= r.x - EPS && op.y >= r.y - EPS && op.x + op.w <= r.x + r.w + EPS && op.y + op.h <= r.y + r.h + EPS, `${t.sku} picture outside label`);
        } else {
          const w = E.textWidth(op.str, op.font, {}, op.size);
          const left = op.align === 'center' ? op.x - w / 2 : op.x;
          assert.ok(left >= r.x - EPS && left + w <= r.x + r.w + 1e-3, `${t.sku} text outside label sideways`);
          assert.ok(op.y >= r.y && op.y <= r.y + r.h, `${t.sku} text outside label up/down`);
        }
      }
    }
  }
});

test('plan: same text fills the sheet, extra sheets, used labels skipped', () => {
  const t = T.findTemplate('5160');
  const base = { mode: 'same', text: 'Hi', sheets: 1, style: style() };
  assert.equal(E.planLabels(t, base, [], addr).total, 30);
  assert.equal(E.planLabels(t, { ...base, sheets: 3 }).pages.length, 3);
  const used = [0, 1, 2, 13, 29];
  const p = E.planLabels(t, { ...base, partial: true, used }, [], addr);
  assert.equal(p.total, 25);
  assert.ok(p.pages[0].every(c => !used.includes(c.index)));
  // used labels only count when "partly used" is chosen
  assert.equal(E.planLabels(t, { ...base, partial: false, used }, [], addr).total, 30);
});

test('plan: addresses spill onto more sheets, around used labels', () => {
  const t = T.findTemplate('5160');
  const d = { mode: 'addresses', addressIds: PEOPLE.map(p => p.id), copiesEach: 1, partial: true, used: [0, 1, 2, 3, 4], style: style() };
  const p = E.planLabels(t, d, PEOPLE, addr);
  assert.equal(p.total, 45);
  assert.equal(p.pages.length, 2);
  assert.equal(p.pages[0].length, 25);
  assert.equal(p.pages[1].length, 20);
  assert.equal(p.pages[1][0].index, 0, 'second sheet starts at the top');
  const idx = p.pages[0].map(c => c.index);
  assert.equal(new Set(idx).size, idx.length, 'no label used twice');
  // copies and deleted people
  const p2 = E.planLabels(t, { ...d, partial: false, addressIds: ['p0', 'gone', 'p1'], copiesEach: 3 }, PEOPLE, addr);
  assert.equal(p2.total, 6);
});

test('plan: blank text counts as nothing to print', () => {
  const t = T.findTemplate('5160');
  assert.equal(E.planLabels(t, { mode: 'same', text: '  ', sheets: 2, style: style() }, [], addr).total, 0);
});

test('plan: only one empty label in the middle of the sheet', () => {
  const t = T.findTemplate('5160');
  const used = Array.from({ length: 30 }, (_, i) => i).filter(i => i !== 14);
  const p = E.planLabels(t, { mode: 'same', text: 'x', sheets: 1, partial: true, used, style: style() }, [], addr);
  assert.deepEqual(p.pages[0].map(c => c.index), [14]);
});

test('plan: every label marked used prints on a fresh sheet, not a blank one', () => {
  const t = T.findTemplate('5160');
  const all = Array.from({ length: 30 }, (_, i) => i);
  const p = E.planLabels(t, { mode: 'addresses', addressIds: ['p0', 'p1'], partial: true, used: all, style: style() }, PEOPLE, addr);
  assert.equal(p.pages.length, 1);
  assert.equal(p.pages[0].length, 2);
});

test('plan: each-label mode and old "start at" saves', () => {
  const t = T.findTemplate('5160');
  const p = E.planLabels(t, { mode: 'each', each: { 0: 'a', 5: 'b' }, partial: true, used: [0], style: style() }, [], addr);
  assert.equal(p.total, 1);
  const old = E.planLabels(t, { mode: 'same', text: 'x', startAt: 10, style: style() }, [], addr);
  assert.equal(old.total, 20);
});

test('PDF: every template makes a page of the right size with labels in the right place', async () => {
  for (const t of T.TEMPLATES) {
    const d = { mode: 'same', text: 'Test', sheets: 1, style: style() };
    const doc = await E.labelsPdf(t, d, E.planLabels(t, d, [], addr), { x: 0, y: 0, scale: 100 }, { test: true });
    assert.equal(doc.getNumberOfPages(), 1);
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - t.pageW) < 1e-3, `${t.sku} width`);
    assert.ok(Math.abs(doc.internal.pageSize.getHeight() - t.pageH) < 1e-3, `${t.sku} height`);
    const out = doc.output();
    if (t.shape !== 'round') {
      const rects = out.match(/[\d.]+ [\d.]+ [\d.]+ -?[\d.]+ re/g) || [];
      assert.equal(rects.length, t.count, `${t.sku} outline count`);
      const [x, y, w, hh] = rects[0].split(' ').map(Number);
      const r = T.labelRect(t, 0);
      assert.ok(Math.abs(x - r.x * 72) < 0.02 && Math.abs(y - (t.pageH - r.y) * 72) < 0.02 && Math.abs(w - r.w * 72) < 0.02 && Math.abs(-hh - r.h * 72) < 0.02, `${t.sku} first label position`);
    }
  }
});

test('PDF: printer nudge moves and scales everything', async () => {
  const t = T.findTemplate('5160');
  const d = { mode: 'same', text: 'x', sheets: 1, style: style() };
  const doc = await E.labelsPdf(t, d, E.planLabels(t, d, [], addr), { x: 0.0625, y: -0.03125, scale: 100 }, { test: true });
  const [x, y] = doc.output().match(/[\d.]+ [\d.]+ [\d.]+ -?[\d.]+ re/)[0].split(' ').map(Number);
  assert.ok(Math.abs(x - (0.1875 + 0.0625) * 72) < 0.02);
  assert.ok(Math.abs(y - (11 - 0.5 + 0.03125) * 72) < 0.02);
  const tf = E.makeTransform(8.5, 11, { x: 0, y: 0, scale: 98 });
  assert.equal(tf.X(4.25), 4.25);
  assert.ok(Math.abs(tf.X(0) - 4.25 * 0.02) < EPS);
});

test('PDF: every font, bold and slanted, prints and gets built into the file', async () => {
  const t = T.findTemplate('5160');
  for (const f of E.FONTS) for (const bold of [false, true]) for (const italic of [false, true]) {
    const d = { mode: 'same', text: 'Mary Smith\n123 Main St', sheets: 1, style: style({ font: f.id, bold, italic }) };
    const doc = await E.labelsPdf(t, d, E.planLabels(t, d, [], addr), null);
    const out = doc.output();
    if (!f.builtin) {
      assert.ok(out.includes('/FontFile2'), `${f.id} font not embedded`);
      const others = E.FONTS.filter(o => !o.builtin && o.id !== f.id);
      for (const o of others) assert.ok(!out.includes(`/BaseFont /${o.id}`), `${f.id} PDF also carries ${o.id}`);
    }
    assert.ok(out.length < 1_500_000, `${f.id} PDF is ${out.length} bytes`);
  }
});

test('PDF: pictures are stored once even when on every label', async () => {
  const t = T.findTemplate('5160');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const d = { mode: 'same', text: 'Jam', sheets: 1, style: style(), picture: { src: png, ar: 1, pos: 'left' } };
  const out = (await E.labelsPdf(t, d, E.planLabels(t, d, [], addr), null)).output();
  // one picture (+ its see-through mask), drawn 30 times
  assert.ok((out.match(/\/Subtype \/Image/g) || []).length <= 2);
  assert.equal((out.match(/ Do/g) || []).length, 30);
});

// ---------- envelopes ----------
test('envelopes: every size is the right page size and the address stays clear of the stamp', async () => {
  for (const env of T.ENVELOPES) {
    const doc = await E.envelopesPdf(env, [{ to: LONG, from: 'Joan Example\n12 Maple Lane\nSpringfield, IL 62701' }, { to: 'A\nB', from: '' }], style());
    assert.equal(doc.getNumberOfPages(), 2);
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - env.w) < 1e-3 && Math.abs(doc.internal.pageSize.getHeight() - env.h) < 1e-3, `${env.id} size`);
    const ops = E.layoutEnvelope(env, LONG, 'Joan Example\n12 Maple Lane\nSpringfield, IL 62701', style());
    for (const op of ops) {
      const w = E.textWidth(op.str, op.font, {}, op.size);
      assert.ok(op.x >= 0.3 && op.x + w <= env.w - 0.25, `${env.id} text off the side`);
      assert.ok(op.y <= env.h - 0.25, `${env.id} text too low`);
      const inStamp = op.x + w > env.w - 1.3 && op.y < 1.4;
      assert.ok(!inStamp, `${env.id} "${op.str}" runs into the stamp corner`);
    }
  }
});

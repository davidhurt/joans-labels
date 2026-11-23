import { test } from 'node:test';
import assert from 'node:assert/strict';
import './setup.js';

const { parseVcards, parseCsv } = await import('../js/views/addresses.js');
const { formatAddress } = await import('../js/ui.js');

test('Mac Contacts vCard export: home address, folded lines, escaped commas', () => {
  const v = [
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Doe;Jane;;;', 'FN:Jane Doe', 'ORG:Acme\\, Inc.;',
    'item1.ADR;type=WORK;type=pref:;;1 Work Rd;Boston;MA;02101;USA',
    'item2.ADR;type=HOME:;;55 Elm St\\nApt 2;Salem;MA;01970;United States',
    'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Long Line Person', 'ADR;TYPE=HOME:;;123 Very Long Str', ' eet Name;Austin;TX;73301;', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Smith;Bob;;;', 'ADR:;;9 Oak;Erie;PA;16501;Canada', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:No Address', 'TEL:555', 'END:VCARD',
  ].join('\r\n');
  const r = parseVcards(v);
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], { name: 'Jane Doe', company: 'Acme, Inc.', line1: '55 Elm St', line2: 'Apt 2', city: 'Salem', state: 'MA', zip: '01970' });
  assert.equal(r[1].line1, '123 Very Long Street Name');
  assert.equal(r[2].name, 'Bob Smith');
  assert.equal(r[2].line2, 'Canada');
  assert.equal(r[3].line1, '');
});

test('spreadsheet (CSV) import: Excel, Numbers and Google formats', () => {
  const bom = '﻿';
  const excel = bom + 'Name,Address,City,State,Zip Code\r\n"Smith, Mary","12 Elm St, Apt 3",Boston,MA,02108\r\n';
  const r = parseCsv(excel);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'Smith, Mary');
  assert.equal(r[0].line1, '12 Elm St, Apt 3');
  assert.equal(r[0].zip, '02108');

  const split = 'First Name,Last Name,Street Address,Address 2,City,State,Postal Code\nBob,Ray,1 A St,Unit 3,Erie,PA,16501\n';
  assert.deepEqual(parseCsv(split)[0], { name: 'Bob Ray', company: '', line1: '1 A St', line2: 'Unit 3', city: 'Erie', state: 'PA', zip: '16501' });

  const tabs = 'Name\tAddress 1\tAddress 2\tCity\tState\tZIP\nAnn\t9 Pine\t\tAustin\tTX\t73301\n';
  assert.equal(parseCsv(tabs)[0].line1, '9 Pine');

  const quotes = 'Name,Address,City,State,Zip\n"Ann ""Nan"" Lee","5 Main\nRear",Erie,PA,16501\n';
  const q = parseCsv(quotes)[0];
  assert.equal(q.name, 'Ann "Nan" Lee');

  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('just a header'), []);
});

test('address formatting skips empty lines', () => {
  assert.equal(formatAddress({ name: 'A', company: '', line1: '1 St', line2: '', city: 'X', state: 'Y', zip: '1' }), 'A\n1 St\nX, Y 1');
  assert.equal(formatAddress({ name: 'A', city: '', state: '', zip: '' }), 'A');
  assert.equal(formatAddress({ name: 'A', city: 'Paris' }), 'A\nParis');
  assert.equal(formatAddress(null), '');
});

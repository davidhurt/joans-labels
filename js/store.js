// Saves everything on this computer (IndexedDB, with localStorage as a fallback).
const DB_NAME = 'joans-labels-letters';
const STORE = 'kv';
const KEYS = ['settings', 'addresses', 'labels', 'letters'];

export const data = {
  settings: {},
  addresses: [],
  labels: [],
  letters: [],
};

const DEFAULT_SETTINGS = {
  me: { name: '', line1: '', line2: '', city: '', state: '', zip: '' },
  nudge: { x: 0, y: 0, scale: 100 },
  textSize: 'large',
  welcomed: false,
  lastBackup: 0,
};

let dbPromise = null;
let useLocal = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function load() {
  for (const k of KEYS) {
    let v;
    try {
      v = useLocal ? JSON.parse(localStorage.getItem('jl_' + k) || 'null') : await idbGet(k);
    } catch (e) {
      useLocal = true;
      try { v = JSON.parse(localStorage.getItem('jl_' + k) || 'null'); } catch { v = null; }
    }
    if (v != null) data[k] = v;
  }
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings,
    me: { ...DEFAULT_SETTINGS.me, ...(data.settings.me || {}) },
    nudge: { ...DEFAULT_SETTINGS.nudge, ...(data.settings.nudge || {}) } };
  // Ask the browser to keep our data (helps Safari not clear it).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
}

const pending = {};
/** Save one part of the data (debounced a little so typing is smooth). */
export function save(key, now = false) {
  clearTimeout(pending[key]);
  const run = async () => {
    const value = JSON.parse(JSON.stringify(data[key]));
    try {
      if (useLocal) localStorage.setItem('jl_' + key, JSON.stringify(value));
      else await idbSet(key, value);
    } catch (e) {
      console.error('Save failed', e);
      window.dispatchEvent(new CustomEvent('save-error', { detail: e }));
    }
  };
  if (now) return run();
  pending[key] = setTimeout(run, 250);
}

export function flushAll() {
  return Promise.all(KEYS.map(k => save(k, true)));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function backupJSON() {
  return JSON.stringify({ app: 'joans-labels-letters', version: 1, saved: new Date().toISOString(), data }, null, 1);
}

export async function restoreJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || obj.app !== 'joans-labels-letters' || !obj.data) throw new Error('This is not a backup file from this app.');
  for (const k of KEYS) if (obj.data[k] != null) data[k] = obj.data[k];
  await flushAll();
}

export const defaults = DEFAULT_SETTINGS;

'use strict';
/* =====================================================================
   My Pantry: core
   Constants, storage, the event log, derived state, pricing, files.
   Every change is an event kept on this phone; phones sync by
   exchanging the log and merging it.
   ===================================================================== */

const APP = 'my-pantry';
const FORMAT = 1;
const DAY = 864e5;
const UNITS = ['pcs', 'pack', 'bottle', 'tin', 'can', 'jar', 'bag', 'box', 'roll', 'tube', 'kg', 'g', 'L', 'ml'];
const PLAIN = ['kg', 'g', 'L', 'ml', 'pcs'];
const DEFAULT_LOCS = [['pantry', 'Pantry', '🥫'], ['fridge', 'Fridge', '🧊'], ['freezer', 'Freezer', '❄️'], ['bathroom', 'Bathroom', '🛁'], ['cleaning', 'Cleaning', '🧽']];
const LOC_ICONS = ['🥫', '🧊', '❄️', '🛁', '🧽', '🍳', '🧺', '🚗', '🛏️', '🧸', '🐾', '💊', '📦'];
const OTHER = { id: '_other', name: 'Other', icon: '📦' };
const EDITABLE = ['name', 'emoji', 'loc', 'cat', 'unit', 'min', 'exp', 'notes', 'price', 'size'];
const EMOJIS = ['📦', '🍚', '🍝', '🥫', '🫒', '🌾', '🍞', '🥐', '🥣', '🍵', '☕', '🧃', '🥤', '🍷', '🥛', '🥚', '🧀', '🧈', '🍨', '🍎', '🍌', '🍊', '🍋', '🍇', '🍓', '🥑', '🍅', '🥔', '🥕', '🧅', '🧄', '🥬', '🥦', '🌶️', '🍗', '🥩', '🐟', '🍤', '🥜', '🍯', '🧂', '🍫', '🍪', '🧻', '🪥', '🧴', '🧼', '🧽', '🧺', '🗑️', '🧹', '🪣', '💡', '🔋', '💊', '🩹', '🐾'];

/* ---------- pricing units ---------- */
// Units that convert into each other. f = size in grams, millilitres or pieces.
const MEASURE = {
  g: { dim: 'mass', f: 1 }, '100 g': { dim: 'mass', f: 100 }, kg: { dim: 'mass', f: 1000 },
  ml: { dim: 'vol', f: 1 }, '100 ml': { dim: 'vol', f: 100 }, L: { dim: 'vol', f: 1000 },
  pcs: { dim: 'count', f: 1 }, dozen: { dim: 'count', f: 12 },
};
// [value, label] for "price per …"
const PRICE_PER = [
  ['kg', 'kg'], ['100 g', '100 g'], ['g', 'gram'], ['L', 'litre'], ['100 ml', '100 ml'], ['ml', 'ml'],
  ['pcs', 'piece'], ['dozen', 'dozen'], ['pack', 'pack'], ['can', 'can'], ['tin', 'tin'], ['bottle', 'bottle'],
  ['jar', 'jar'], ['bag', 'bag'], ['box', 'box'], ['roll', 'roll'], ['tube', 'tube'],
];
const SIZE_UNITS = ['g', 'kg', 'ml', 'L', 'pcs'];
const perName = (p) => (PRICE_PER.find(([k]) => k === p) || [p, p])[1];

const CURRENCIES = ['GBP', 'USD', 'EUR', 'PKR', 'INR', 'AED', 'SAR', 'QAR', 'KWD', 'BDT', 'CAD', 'AUD', 'NZD', 'NGN', 'ZAR', 'TRY', 'MYR', 'SGD', 'JPY', 'CNY'];
const REGION_CUR = {
  GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', PK: 'PKR', IN: 'INR', BD: 'BDT', AE: 'AED', SA: 'SAR', QA: 'QAR',
  KW: 'KWD', NG: 'NGN', ZA: 'ZAR', TR: 'TRY', MY: 'MYR', SG: 'SGD', JP: 'JPY', CN: 'CNY', IE: 'EUR', DE: 'EUR', FR: 'EUR',
  ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
};
// Rough conversion so example prices look sensible in any currency.
const EXAMPLE_RATE = { GBP: 1, USD: 1.3, EUR: 1.2, PKR: 360, INR: 110, AED: 4.8, SAR: 4.9, QAR: 4.7, KWD: 0.4, BDT: 155, CAD: 1.8, AUD: 2, NZD: 2.2, NGN: 2000, ZAR: 24, TRY: 44, MYR: 6, SGD: 1.75, JPY: 190, CNY: 9.4 };
function guessCurrency() {
  try { return REGION_CUR[new Intl.Locale(navigator.language || 'en-GB').maximize().region] || 'GBP'; } catch (e) { return 'GBP'; }
}

// Checked in order, so specific words come before words they contain ("toilet" before "oil").
const GUESS = [
  ['toilet', '🧻'], ['kitchen roll', '🧻'], ['tissue', '🧻'], ['toothpaste', '🪥'], ['toothbrush', '🪥'], ['peanut', '🥜'], ['chickpea', '🥫'],
  ['ice cream', '🍨'], ['juice', '🧃'], ['steak', '🥩'], ['milk', '🥛'], ['egg', '🥚'], ['cheese', '🧀'], ['cheddar', '🧀'], ['butter', '🧈'],
  ['yogurt', '🥣'], ['yoghurt', '🥣'], ['cereal', '🥣'], ['oat', '🥣'], ['bread', '🍞'], ['croissant', '🥐'], ['rice', '🍚'], ['pasta', '🍝'],
  ['spaghetti', '🍝'], ['noodle', '🍝'], ['flour', '🌾'], ['atta', '🌾'], ['oil', '🫒'], ['tea', '🍵'], ['coffee', '☕'], ['soda', '🥤'], ['cola', '🥤'],
  ['water', '🥤'], ['wine', '🍷'], ['apple', '🍎'], ['banana', '🍌'], ['orange', '🍊'], ['lemon', '🍋'], ['grape', '🍇'], ['strawberr', '🍓'],
  ['avocado', '🥑'], ['tomato', '🍅'], ['potato', '🥔'], ['carrot', '🥕'], ['onion', '🧅'], ['garlic', '🧄'], ['spinach', '🥬'], ['lettuce', '🥬'],
  ['broccoli', '🥦'], ['pea', '🥦'], ['chilli', '🌶️'], ['chili', '🌶️'], ['pepper', '🌶️'], ['chicken', '🍗'], ['beef', '🥩'], ['mince', '🥩'],
  ['lamb', '🥩'], ['mutton', '🥩'], ['meat', '🥩'], ['fish', '🐟'], ['salmon', '🐟'], ['tuna', '🐟'], ['prawn', '🍤'], ['shrimp', '🍤'], ['nut', '🥜'],
  ['honey', '🍯'], ['salt', '🧂'], ['sugar', '🧂'], ['spice', '🧂'], ['masala', '🧂'], ['chocolate', '🍫'], ['biscuit', '🍪'], ['cookie', '🍪'],
  ['shampoo', '🧴'], ['conditioner', '🧴'], ['lotion', '🧴'], ['soap', '🧼'], ['sponge', '🧽'], ['laundry', '🧺'], ['detergent', '🧺'],
  ['bin bag', '🗑️'], ['trash', '🗑️'], ['bleach', '🪣'], ['cleaner', '🪣'], ['bulb', '💡'], ['batter', '🔋'], ['paracetamol', '💊'],
  ['ibuprofen', '💊'], ['medicine', '💊'], ['vitamin', '💊'], ['plaster', '🩹'], ['bandage', '🩹'], ['dog', '🐾'], ['cat food', '🐾'],
  ['tin', '🥫'], ['bean', '🥫'], ['soup', '🥫'], ['lentil', '🥫'], ['daal', '🥫'], ['dal', '🥫'],
];

// name, emoji, location, category, qty, unit, warn below, expires in (days), [price in GBP, per], [pack size, unit]
const EXAMPLES = [
  ['Basmati Rice', '🍚', 'pantry', 'Grains', 2, 'kg', 1, 240, [2.4, 'kg']],
  ['Spaghetti', '🍝', 'pantry', 'Grains', 1, 'pack', 2, 300, [0.95, 'pack'], [500, 'g']],
  ['Chopped Tomatoes', '🥫', 'pantry', 'Tins', 6, 'tin', 3, 500, [0.55, 'tin'], [400, 'g']],
  ['Tea Bags', '🍵', 'pantry', 'Drinks', 1, 'box', 1, 365, [3.2, 'box']],
  ['Milk', '🥛', 'fridge', 'Dairy', 1, 'L', 2, 3, [1.15, 'L']],
  ['Eggs', '🥚', 'fridge', 'Dairy', 10, 'pcs', 6, 12, [3, 'dozen']],
  ['Spinach', '🥬', 'fridge', 'Veg', 1, 'bag', 1, 1, [1.1, 'bag'], [200, 'g']],
  ['Frozen Peas', '🥦', 'freezer', 'Veg', 2, 'bag', 1, 180, [1.4, 'kg'], [900, 'g']],
  ['Toilet Roll', '🧻', 'bathroom', 'Paper', 4, 'roll', 6, null, [0.45, 'roll']],
  ['Dish Soap', '🧼', 'cleaning', 'Kitchen', 1, 'bottle', 1, null, [1.2, 'bottle']],
];
function exampleAmount(gbp, cur) {
  const v = gbp * (EXAMPLE_RATE[cur] || 1);
  return v >= 100 ? Math.round(v / 5) * 5 : v >= 10 ? Math.round(v) : Math.round(v * 100) / 100;
}

/* ---------- icons ---------- */
const ICONS = {
  jar: '<path d="M8 3h8v3H8z"/><path d="M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M5 11h14M5 16h14"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12h11.8L22 7H6"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1-.8-1.4-.8-2.3 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  install: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 7v7M9 11l3 3 3-3"/>',
};
const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- small helpers ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phone';
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const byName = (a, b) => a.name.localeCompare(b.name);
function guessEmoji(name) {
  const n = String(name).toLowerCase();
  const hit = GUESS.find(([k]) => n.includes(k));
  return hit ? hit[1] : null;
}

/* ---------- storage: IndexedDB, else localStorage, else memory only ---------- */
const Store = (() => {
  const PREFIX = 'my-pantry:';
  const mem = {};
  let mode = 'memory';
  let idb = null;
  let queue = Promise.resolve();
  const api = { failed: false, get mode() { return mode; } };

  api.open = async () => {
    try {
      idb = await Promise.race([
        new Promise((res, rej) => {
          const r = indexedDB.open(APP, 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.onblocked = () => rej(new Error('blocked'));
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]);
      mode = 'idb';
      return mode;
    } catch (e) { idb = null; }
    try {
      localStorage.setItem(PREFIX + 'probe', '1');
      localStorage.removeItem(PREFIX + 'probe');
      mode = 'local';
    } catch (e) { mode = 'memory'; }
    return mode;
  };

  api.get = async (key) => {
    try {
      if (mode === 'idb') {
        return await new Promise((res, rej) => {
          const r = idb.transaction('kv').objectStore('kv').get(key);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      if (mode === 'local') {
        const v = localStorage.getItem(PREFIX + key);
        return v == null ? undefined : JSON.parse(v);
      }
    } catch (e) { console.warn('My Pantry: read failed', e); }
    return mem[key];
  };

  // Writes run one at a time, in order.
  api.put = (key, value) => {
    queue = queue.then(async () => {
      if (mode === 'idb') {
        await new Promise((res, rej) => {
          const tx = idb.transaction('kv', 'readwrite');
          if (value === undefined) tx.objectStore('kv').delete(key); else tx.objectStore('kv').put(value, key);
          tx.oncomplete = res;
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error);
        });
      } else if (mode === 'local') {
        if (value === undefined) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } else {
        mem[key] = value;
      }
      if (api.failed) { api.failed = false; render(); }
    }).catch((e) => {
      console.error('My Pantry: save failed', e);
      api.failed = true;
      render();
    });
    return queue;
  };
  return api;
})();

/* ---------- the event log ---------- */
let meta = null;        // this phone only: id, counter, last send/backup, preferences
let log = [];           // every event, sorted
let seen = new Set();   // event ids in the log
let S = emptyState();   // current state, rebuilt from the log

function newMeta() {
  return { deviceId: uid(), n: 0, lastSentAt: 0, lastBackupAt: 0, lastImport: null, persisted: false, theme: 'system', installHidden: false };
}
function emptyState() {
  return { pantryId: null, name: 'My Pantry', main: null, devices: {}, locs: [], items: {}, extras: {}, ticks: {}, soonDays: 7, currency: null, clock: 0 };
}
const order = (a, b) => a.t - b.t || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : a.n - b.n);

function normPrice(p) {
  if (!p || typeof p !== 'object') return null;
  const amt = +p.amt;
  if (!isFinite(amt) || amt < 0) return null;
  return { amt: round4(amt), per: String(p.per || 'pcs') };
}
function normSize(s) {
  if (!s || typeof s !== 'object') return null;
  const amt = +s.amt;
  if (!isFinite(amt) || amt <= 0 || !MEASURE[s.unit]) return null;
  return { amt: round4(amt), unit: s.unit };
}
function touch(it, e) { it.changed = e.t; it.by = e.dev; }
function clearTickIfStocked(s, it) { if (it.qty > 0 && it.qty >= it.min) delete s.ticks['i:' + it.id]; }

function apply(s, e) {
  const d = e.d || {};
  s.clock = Math.max(s.clock, e.t);
  const dv = s.devices[e.dev] || (s.devices[e.dev] = { id: e.dev, name: 'A phone', last: 0 });
  dv.last = Math.max(dv.last, e.t);
  const it = d.id != null ? s.items[d.id] : null;
  switch (e.type) {
    case 'pantry.create':
      if (!s.pantryId) { s.pantryId = d.pantryId; s.main = e.dev; if (d.name) s.name = String(d.name); }
      break;
    case 'pantry.main': if (d.dev) s.main = d.dev; break;
    case 'pantry.set':
      if (d.soonDays > 0) s.soonDays = +d.soonDays;
      if (d.name) s.name = String(d.name);
      if (d.currency) s.currency = String(d.currency);
      break;
    case 'device.name': if (d.name) dv.name = String(d.name); break;
    case 'loc.add':
      if (!s.locs.some((l) => l.id === d.id)) s.locs.push({ id: d.id, name: String(d.name || 'Location'), icon: d.icon || '📦', deleted: false });
      break;
    case 'loc.edit': {
      const l = s.locs.find((x) => x.id === d.id);
      if (l) { if (d.name) l.name = String(d.name); if (d.icon) l.icon = d.icon; }
      break;
    }
    case 'loc.del': {
      const l = s.locs.find((x) => x.id === d.id);
      if (l) l.deleted = true;
      break;
    }
    case 'item.add':
      if (!it) {
        s.items[d.id] = {
          id: d.id, name: String(d.name || 'Item'), emoji: d.emoji || '📦', loc: d.loc, cat: d.cat || '',
          qty: round(Math.max(0, +d.qty || 0)), unit: d.unit || 'pcs', min: Math.max(0, +d.min || 0), exp: d.exp || null,
          notes: d.notes || '', price: normPrice(d.price), size: normSize(d.size), example: !!d.example,
          deleted: null, purged: false, created: e.t, changed: e.t, by: e.dev,
        };
      }
      break;
    case 'item.edit':
      if (it) {
        for (const k of EDITABLE) {
          if (!(k in d)) continue;
          if (k === 'min') it.min = Math.max(0, +d.min || 0);
          else if (k === 'price') it.price = normPrice(d.price);
          else if (k === 'size') it.size = normSize(d.size);
          else it[k] = d[k];
        }
        touch(it, e);
        clearTickIfStocked(s, it);
      }
      break;
    case 'item.adj':
      if (it) { it.qty = round(Math.max(0, it.qty + (+d.delta || 0))); touch(it, e); clearTickIfStocked(s, it); }
      break;
    case 'item.set':
      if (it) { it.qty = round(Math.max(0, +d.qty || 0)); touch(it, e); clearTickIfStocked(s, it); }
      break;
    case 'item.del':
      if (it) { it.deleted = e.t; it.purged = !!d.purge; touch(it, e); delete s.ticks['i:' + it.id]; }
      break;
    case 'item.restore':
      if (it) { it.deleted = null; it.purged = false; touch(it, e); }
      break;
    case 'shop.add':
      s.extras[d.id] = { id: d.id, name: String(d.name || 'Item'), emoji: d.emoji || '🛒', note: d.note || '', t: e.t };
      break;
    case 'shop.del':
      delete s.extras[d.id];
      delete s.ticks['x:' + d.id];
      break;
    case 'shop.tick':
      if (d.on) s.ticks[d.key] = true; else delete s.ticks[d.key];
      break;
  }
}

function rebuild() {
  S = emptyState();
  for (const e of log) apply(S, e);
}

// Record a change made on this phone. Call commit() after one or more emits.
function emit(type, d) {
  meta.n += 1;
  const e = { id: meta.deviceId + '.' + meta.n, dev: meta.deviceId, n: meta.n, t: Math.max(Date.now(), S.clock + 1), type, d };
  log.push(e);
  seen.add(e.id);
  apply(S, e);
  return e;
}
function persist() { return Store.put('data', { meta, log }); }
function commit() { persist(); render(); }

function validEvent(e) {
  return !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.dev === 'string' && typeof e.type === 'string'
    && Number.isFinite(e.t) && Number.isFinite(e.n) && (e.d == null || typeof e.d === 'object');
}
// Add events from another phone. The same events always give the same result, in any order.
function merge(events) {
  let added = 0;
  for (const e of events) {
    if (!validEvent(e) || seen.has(e.id)) continue;
    log.push(e);
    seen.add(e.id);
    added++;
  }
  if (added) { log.sort(order); rebuild(); }
  return added;
}

/* ---------- reading the state ---------- */
const items = () => Object.values(S.items).filter((i) => !i.deleted);
const deletedItems = () => Object.values(S.items).filter((i) => i.deleted && !i.purged && Date.now() - i.deleted < 30 * DAY);
const activeLocs = () => S.locs.filter((l) => !l.deleted);
const locOf = (i) => S.locs.find((l) => l.id === i.loc && !l.deleted) || OTHER;
const status = (i) => (i.qty <= 0 ? 'out' : i.qty < i.min ? 'low' : 'ok');
const stepOf = (i) => (i.unit === 'kg' || i.unit === 'L' ? 0.5 : i.unit === 'g' || i.unit === 'ml' ? 100 : 1);
const unitText = (unit, q) => (PLAIN.includes(unit) || q === 1 ? unit : unit === 'box' ? 'boxes' : unit + 's');
const fmtQty = (i, q = i.qty) => `${round(q)} ${unitText(i.unit, round(q))}`;
const suggest = (i) => round(Math.max(i.min * 2 - i.qty, stepOf(i)));
const level = (i) => Math.max(0, Math.min(1, i.min > 0 ? i.qty / (i.min * 2) : i.qty > 0 ? 1 : 0));
function daysLeft(i) {
  if (!i.exp) return null;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const d = new Date(i.exp + 'T00:00');
  return isNaN(d) ? null : Math.round((d - t0) / DAY);
}
const expiring = (i) => { const d = daysLeft(i); return d !== null && d <= S.soonDays; };
function expiryLabel(i) {
  const d = daysLeft(i);
  if (d === null) return '';
  if (d < 0) return d === -1 ? 'Expired yesterday' : `Expired ${-d} days ago`;
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  if (d <= 14) return `Expires in ${d} days`;
  return 'Expires ' + new Date(i.exp + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function ago(t) {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const dd = Math.round(h / 24);
  if (dd === 1) return 'yesterday';
  if (dd < 7) return `${dd} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const nameOf = (dev) => (S.devices[dev] ? S.devices[dev].name : 'A phone');
const myName = () => nameOf(meta.deviceId);
const isMain = () => S.main === meta.deviceId;
const otherDevices = () => Object.values(S.devices).filter((d) => d.id !== meta.deviceId);
const pendingCount = () => log.filter((e) => e.dev === meta.deviceId && e.t > meta.lastSentAt).length;

/* ---------- money ---------- */
const currency = () => S.currency || guessCurrency();
const moneyFmt = {};
function money(v, precise) {
  if (v == null || !isFinite(v)) return '';
  const cur = currency();
  const key = cur + (precise ? ':p' : '');
  if (!moneyFmt[key]) {
    try {
      const dig = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits;
      moneyFmt[key] = new Intl.NumberFormat(undefined, {
        style: 'currency', currency: cur,
        minimumFractionDigits: precise ? Math.min(dig, 2) : dig, maximumFractionDigits: precise ? Math.max(dig, 3) : dig,
      });
    } catch (e) {
      moneyFmt[key] = { format: (x) => `${cur} ${x.toFixed(2)}` };
    }
  }
  return moneyFmt[key].format(v);
}
const moneySmart = (v) => money(v, v > 0 && v < 1);

// How many `per` units q of this item makes, or null if they can't be compared.
function qtyIn(i, q, per) {
  if (per === i.unit) return q;
  const a = MEASURE[i.unit];
  const b = MEASURE[per];
  if (a && b && a.dim === b.dim) return (q * a.f) / b.f;
  const s = i.size && MEASURE[i.size.unit];
  if (s) {
    if (!a && b && s.dim === b.dim) return (q * i.size.amt * s.f) / b.f;          // counted in packs, priced by weight
    if (a && !b && a.dim === s.dim) return (q * a.f) / (i.size.amt * s.f);         // counted by weight, priced per pack
  }
  return null;
}
function costOf(i, q) {
  if (!i.price) return null;
  const n = qtyIn(i, q, i.price.per);
  return n == null ? null : n * i.price.amt;
}
const priceLabel = (i) => (i.price ? `${moneySmart(i.price.amt)}/${perName(i.price.per)}` : '');
// Price per kg or per litre, for comparing. Null when it can't be worked out or is already per kg / L.
function comparePrice(i) {
  if (!i.price) return null;
  const a = MEASURE[i.unit];
  let base = null;
  if (a && a.dim !== 'count') base = { dim: a.dim, amt: a.f };
  else if (!a && i.size && MEASURE[i.size.unit] && MEASURE[i.size.unit].dim !== 'count') base = { dim: MEASURE[i.size.unit].dim, amt: i.size.amt * MEASURE[i.size.unit].f };
  const c1 = costOf(i, 1);
  if (!base || c1 == null) return null;
  const label = base.dim === 'mass' ? 'kg' : 'L';
  if (i.price.per === label) return null;
  return { v: (c1 / base.amt) * 1000, label };
}
function stockValue() {
  let v = 0; let priced = 0; let unpriced = 0;
  for (const i of items()) {
    const c = costOf(i, i.qty);
    if (c == null) { if (i.qty > 0) unpriced++; } else { v += c; priced++; }
  }
  return { v, priced, unpriced };
}
function priceHistory(id) {
  const out = [];
  for (const e of log) {
    if (!e.d || e.d.id !== id) continue;
    if ((e.type === 'item.add' || e.type === 'item.edit') && 'price' in e.d) {
      const p = normPrice(e.d.price);
      const last = out[out.length - 1];
      if (p && (!last || last.amt !== p.amt || last.per !== p.per)) out.push({ t: e.t, dev: e.dev, amt: p.amt, per: p.per });
    }
  }
  return out;
}
function monthSpend() {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  let v = 0;
  for (const e of log) {
    if (e.type !== 'item.adj' || !e.d || e.t < start.getTime() || !isFinite(e.d.cost)) continue;
    if (e.d.why === 'restock') v += e.d.cost;
    else if (e.d.why === 'undo') v -= e.d.cost;
  }
  return v;
}

function syncStatus() {
  if (Store.mode === 'memory' || Store.failed) return ['bad', 'Not saving on this phone'];
  if (otherDevices().length) {
    const p = pendingCount();
    if (p) return ['pending', `${p} change${p === 1 ? '' : 's'} not sent yet`];
    return ['', meta.lastSentAt ? `All changes sent · ${ago(meta.lastSentAt)}` : 'All changes sent'];
  }
  if (!meta.lastBackupAt) return ['pending', 'Only on this phone · no backup yet'];
  if (Date.now() - meta.lastBackupAt > 7 * DAY) return ['pending', `Last backup ${ago(meta.lastBackupAt)}`];
  return ['', `Backed up ${ago(meta.lastBackupAt)}`];
}

function describe(e) {
  const d = e.d || {};
  const it = d.id != null ? S.items[d.id] : null;
  const nm = it ? it.name : 'an item';
  switch (e.type) {
    case 'pantry.create': return 'Started this pantry';
    case 'pantry.main': return `${nameOf(d.dev)} became the main phone`;
    case 'pantry.set': return d.currency ? `Currency set to ${d.currency}` : 'Changed pantry settings';
    case 'device.name': return `Named a phone “${d.name}”`;
    case 'loc.add': return `Added location ${d.name}`;
    case 'loc.edit': return d.name ? `Renamed a location to ${d.name}` : 'Changed a location icon';
    case 'loc.del': return 'Removed a location';
    case 'item.add': return d.example ? `Added example item ${d.name}` : `Added ${d.name}`;
    case 'item.edit': {
      const p = 'price' in d ? normPrice(d.price) : null;
      if (p && Object.keys(d).length <= 2) return `${nm} price set to ${moneySmart(p.amt)}/${perName(p.per)}`;
      return `Edited ${nm}`;
    }
    case 'item.adj': {
      const q = Math.abs(+d.delta || 0);
      const f = it ? fmtQty(it, q) : q;
      if (d.why === 'restock') return `Restocked ${f} ${nm}${isFinite(d.cost) ? ` · ${money(d.cost)}` : ''}`;
      if (d.why === 'undo') return `Undid a restock of ${nm}`;
      return `${d.delta < 0 ? 'Used' : 'Added'} ${f} ${nm}`;
    }
    case 'item.set': return `Counted ${nm}: ${it ? fmtQty(it, +d.qty || 0) : d.qty}`;
    case 'item.del': return d.purge ? `Removed example ${nm}` : `Deleted ${nm}`;
    case 'item.restore': return `Restored ${nm}`;
    case 'shop.add': return `Added ${d.name} to the shopping list`;
    case 'shop.del': return d.bought ? `Bought ${d.name}` : `Took ${d.name} off the shopping list`;
    default: return null;
  }
}

function createPantry(phoneName, withExamples, cur) {
  emit('pantry.create', { pantryId: uid() + uid(), name: 'My Pantry' });
  emit('pantry.set', { currency: cur });
  emit('device.name', { name: phoneName });
  for (const [id, name, ic] of DEFAULT_LOCS) emit('loc.add', { id, name, icon: ic });
  if (withExamples) {
    for (const [name, emoji, loc, cat, qty, unit, min, exp, price, size] of EXAMPLES) {
      emit('item.add', {
        id: uid(), name, emoji, loc, cat, qty, unit, min, notes: '', example: true,
        exp: exp == null ? null : dateStr(new Date(Date.now() + exp * DAY)),
        price: price ? { amt: exampleAmount(price[0], cur), per: price[1] } : null,
        size: size ? { amt: size[0], unit: size[1] } : null,
      });
    }
  }
  commit();
  askPersist();
}

async function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      meta.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
      persist();
      render();
    }
  } catch (e) { /* not available here */ }
}

/* ---------- files: send, back up, receive ---------- */
function exportText() {
  return JSON.stringify({
    app: APP, format: FORMAT, pantryId: S.pantryId, pantryName: S.name,
    from: { dev: meta.deviceId, name: myName() }, exportedAt: Date.now(), events: log,
  });
}
const fileName = (kind) => `my-pantry-${kind}-${slug(myName())}-${dateStr(new Date())}.json`;

// Hand the file over: the share sheet for syncing, a download for backups, copy-and-paste as a last resort.
async function saveFile(name, text, kind) {
  if (kind === 'sync' && navigator.canShare) {
    try {
      const f = new File([text], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'My Pantry' }); return true; }
    } catch (err) { if (err && err.name === 'AbortError') return false; }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    return true;
  } catch (err) { /* fall through to copying */ }
  openSheet('copy', { text, kind });
  return false;
}

function importText(text, joinName) {
  const notOurs = { ok: false, msg: 'That isn’t a My Pantry file. Choose the .json file sent from your other phone.' };
  let data;
  try { data = JSON.parse(text); } catch (e) { return notOurs; }
  if (!data || data.app !== APP || !Array.isArray(data.events)) return notOurs;
  if (data.format > FORMAT) return { ok: false, msg: 'This file comes from a newer version of My Pantry. Update the app on this phone first.' };
  const joining = !S.pantryId;
  if (!joining && data.pantryId !== S.pantryId) {
    return { ok: false, msg: `This file belongs to a different pantry (“${data.pantryName || 'unnamed'}”). Nothing was changed.` };
  }
  const who = data.from && data.from.name ? String(data.from.name) : 'the other phone';
  const added = merge(data.events);
  if (joining) {
    if (!S.pantryId) { log = []; seen = new Set(); rebuild(); return { ok: false, msg: 'This file has no pantry in it. Nothing was changed.' }; }
    emit('device.name', { name: joinName || 'Second Phone' });
  }
  meta.lastImport = { from: who, at: Date.now() };
  commit();
  if (joining) { askPersist(); return { ok: true, msg: `Joined · ${items().length} items copied from ${who}` }; }
  return { ok: true, msg: added ? `Got ${added} change${added === 1 ? '' : 's'} from ${who}` : `Already up to date with ${who}` };
}

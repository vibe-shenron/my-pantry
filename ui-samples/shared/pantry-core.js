/* My Pantry — UI samples.
   Shared sample data, helpers and a tiny in-memory store used by all three designs.
   Nothing is saved: reload a page to reset it. The viewer is always "Main Phone". */
(function () {
  'use strict';

  const DAY = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const locations = [
    { id: 'pantry', name: 'Pantry', icon: '🥫' },
    { id: 'fridge', name: 'Fridge', icon: '🧊' },
    { id: 'freezer', name: 'Freezer', icon: '❄️' },
    { id: 'bathroom', name: 'Bathroom', icon: '🛁' },
    { id: 'cleaning', name: 'Cleaning', icon: '🧽' },
  ];

  // name, emoji, location, category, qty, unit, low-stock below, expires in (days)
  const rows = [
    ['Basmati Rice', '🍚', 'pantry', 'Grains', 2, 'kg', 1, 240],
    ['Spaghetti', '🍝', 'pantry', 'Grains', 1, 'pack', 2, 300],
    ['Olive Oil', '🫒', 'pantry', 'Oils & sauces', 1, 'bottle', 1, 400],
    ['Chopped Tomatoes', '🥫', 'pantry', 'Tins', 6, 'tin', 3, 500],
    ['Plain Flour', '🌾', 'pantry', 'Baking', 0.5, 'kg', 1, 120],
    ['Tea Bags', '🍵', 'pantry', 'Drinks', 40, 'bag', 20, 365],
    ['Coffee Beans', '☕', 'pantry', 'Drinks', 0, 'bag', 1, null],
    ['Milk', '🥛', 'fridge', 'Dairy', 1, 'L', 2, 2],
    ['Eggs', '🥚', 'fridge', 'Dairy', 10, 'pcs', 6, 12],
    ['Cheddar', '🧀', 'fridge', 'Dairy', 1, 'block', 1, 18],
    ['Butter', '🧈', 'fridge', 'Dairy', 2, 'pack', 1, 30],
    ['Spinach', '🥬', 'fridge', 'Veg', 1, 'bag', 1, 1],
    ['Greek Yogurt', '🥣', 'fridge', 'Dairy', 3, 'pot', 2, -1],
    ['Frozen Veg', '🥦', 'freezer', 'Veg', 2, 'bag', 1, 180],
    ['Chicken Breast', '🍗', 'freezer', 'Meat', 4, 'pcs', 2, 60],
    ['Ice Cream', '🍨', 'freezer', 'Dessert', 1, 'tub', 1, 90],
    ['Toilet Roll', '🧻', 'bathroom', 'Paper', 4, 'roll', 6, null],
    ['Toothpaste', '🪥', 'bathroom', 'Personal care', 2, 'tube', 1, null],
    ['Shampoo', '🧴', 'bathroom', 'Personal care', 1, 'bottle', 1, null],
    ['Dish Soap', '🧼', 'cleaning', 'Kitchen', 2, 'bottle', 1, null],
    ['Bin Bags', '🗑️', 'cleaning', 'Kitchen', 12, 'bag', 10, null],
    ['Laundry Pods', '🧺', 'cleaning', 'Laundry', 8, 'pod', 10, null],
  ];

  const PLAIN_UNITS = ['kg', 'g', 'L', 'ml', 'pcs'];
  const AGO = ['2 h ago', 'yesterday', '3 days ago', 'last week'];
  const stepFor = (unit) => (unit === 'kg' || unit === 'L' ? 0.5 : 1);
  let nextId = 1;

  const items = rows.map(([name, emoji, location, category, qty, unit, min, expiresIn], n) => ({
    id: nextId++, name, emoji, location, category, qty, unit, min,
    step: stepFor(unit),
    expiry: expiresIn == null ? null : new Date(today.getTime() + expiresIn * DAY),
    changedBy: 'Main Phone',
    changedAgo: AGO[n % AGO.length],
  }));
  items.filter((i) => i.name === 'Milk' || i.name === 'Eggs').forEach((i) => {
    i.changedBy = 'Second Phone';
    i.changedAgo = '25 min ago';
  });

  const activity = [
    { who: 'Second Phone', text: 'Used 1 L Milk', ago: '25 min ago' },
    { who: 'Second Phone', text: 'Used 2 pcs Eggs', ago: '25 min ago' },
    { who: 'Main Phone', text: 'Added 6 tins Chopped Tomatoes', ago: '2 h ago' },
    { who: 'Main Phone', text: 'Restocked 2 bags Frozen Veg', ago: 'yesterday' },
  ];

  const devices = [
    { name: 'Main Phone', role: 'main', lastSeen: 'now' },
    { name: 'Second Phone', role: 'member', lastSeen: '25 min ago' },
  ];

  const sync = { pending: 2, lastSync: '25 min ago', syncing: false };

  const extras = [
    { id: 'x1', name: 'Bananas', emoji: '🍌', note: '6', checked: false },
    { id: 'x2', name: 'Bread', emoji: '🍞', note: '1 loaf', checked: false },
  ];
  const ticked = new Set();

  /* ---------- helpers ---------- */
  const num = (n) => Math.round(n * 100) / 100;
  const unitText = (unit, qty) => (PLAIN_UNITS.includes(unit) || qty === 1 ? unit : unit + 's');
  const fmtQty = (item, qty = item.qty) => `${num(qty)} ${unitText(item.unit, qty)}`;
  const byId = (id) => items.find((i) => i.id === id);
  const loc = (id) => locations.find((l) => l.id === id);
  const status = (i) => (i.qty <= 0 ? 'out' : i.qty < i.min ? 'low' : 'ok');
  const daysLeft = (i) => (i.expiry ? Math.round((i.expiry - today) / DAY) : null);
  const expiring = (i) => { const d = daysLeft(i); return d !== null && d <= 7; };
  const level = (i) => Math.max(0, Math.min(1, i.qty / (i.min * 2)));
  const suggest = (i) => num(Math.max(i.min * 2 - i.qty, i.step));
  const shortDate = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  function expiryLabel(i) {
    const d = daysLeft(i);
    if (d === null) return '';
    if (d < 0) return d === -1 ? 'Expired yesterday' : `Expired ${-d} days ago`;
    if (d === 0) return 'Expires today';
    if (d === 1) return 'Expires tomorrow';
    if (d <= 14) return `Expires in ${d} days`;
    return 'Expires ' + shortDate(i.expiry);
  }
  function shortExpiry(i) {
    const d = daysLeft(i);
    if (d === null) return '';
    if (d < 0) return 'Expired';
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d <= 14) return `${d} days`;
    return shortDate(i.expiry);
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  /* ---------- store ---------- */
  const listeners = [];
  const on = (fn) => listeners.push(fn);
  const notify = () => listeners.forEach((fn) => fn());

  function record(text) {
    activity.unshift({ who: 'Main Phone', text, ago: 'just now' });
    sync.pending++;
  }
  function touch(i) {
    i.changedBy = 'Main Phone';
    i.changedAgo = 'just now';
  }

  function adjust(id, dir) {
    const i = byId(id);
    const next = num(Math.max(0, i.qty + dir * i.step));
    if (next === i.qty) return;
    const diff = num(Math.abs(next - i.qty));
    i.qty = next;
    touch(i);
    record(`${dir < 0 ? 'Used' : 'Added'} ${fmtQty(i, diff)} ${i.name}`);
    notify();
  }

  function addItem(d) {
    const i = {
      id: nextId++, name: d.name, emoji: d.emoji || '📦', location: d.location,
      category: d.category || 'Other', qty: num(+d.qty || 0), unit: d.unit || 'pcs',
      min: +d.min || 1, step: stepFor(d.unit), expiry: d.expiry || null,
      changedBy: 'Main Phone', changedAgo: 'just now',
    };
    items.unshift(i);
    record(`Added ${i.name}`);
    notify();
    return i;
  }

  function shoppingList() {
    const auto = items.filter((i) => status(i) !== 'ok').map((i) => ({
      key: 'i' + i.id, itemId: i.id, name: i.name, emoji: i.emoji, auto: true,
      note: 'Buy ' + fmtQty(i, suggest(i)), checked: ticked.has(i.id),
    }));
    return { auto, extras: extras.map((e) => ({ ...e, key: e.id })) };
  }
  function toggleShop(key) {
    if (key[0] === 'i') {
      const id = +key.slice(1);
      ticked.has(id) ? ticked.delete(id) : ticked.add(id);
    } else {
      const e = extras.find((x) => x.id === key);
      e.checked = !e.checked;
    }
    notify();
  }
  function addExtra(name) {
    extras.push({ id: 'x' + nextId++, name, emoji: '🛒', note: '', checked: false });
    record(`Added ${name} to the shopping list`);
    notify();
  }
  const checkedCount = () => ticked.size + extras.filter((e) => e.checked).length;
  function restock() {
    let n = 0;
    ticked.forEach((id) => {
      const i = byId(id);
      const add = suggest(i);
      i.qty = num(i.qty + add);
      touch(i);
      record(`Restocked ${fmtQty(i, add)} ${i.name}`);
      n++;
    });
    ticked.clear();
    for (let k = extras.length - 1; k >= 0; k--) {
      if (!extras[k].checked) continue;
      record(`Bought ${extras[k].name}`);
      extras.splice(k, 1);
      n++;
    }
    notify();
    return n;
  }

  function syncNow() {
    if (sync.syncing) return;
    sync.syncing = true;
    notify();
    setTimeout(() => {
      sync.syncing = false;
      sync.pending = 0;
      sync.lastSync = 'just now';
      devices[1].lastSeen = 'just now';
      notify();
    }, 1800);
  }

  function stats() {
    const count = (fn) => items.filter(fn).length;
    const { auto, extras: ex } = shoppingList();
    return {
      total: items.length,
      low: count((i) => status(i) === 'low'),
      out: count((i) => status(i) === 'out'),
      expiring: count(expiring),
      expiringOnly: count((i) => expiring(i) && status(i) === 'ok'),
      attention: count((i) => status(i) !== 'ok' || expiring(i)),
      shopping: auto.length + ex.length,
    };
  }

  /* ---------- visuals ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12h11.8L22 7H6"/>',
    sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
    alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // A QR-looking picture for the pairing screen. Not a real code.
  function fakeQR() {
    const n = 25;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
    let rects = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const f = finders.find(([ox, oy]) => x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7);
        let on;
        if (f) {
          const dx = x - f[0], dy = y - f[1];
          const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
          on = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        } else {
          on = rnd() < 0.48;
        }
        if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" fill="currentColor" shape-rendering="crispEdges" aria-label="Pairing code">${rects}</svg>`;
  }

  // Swap <i data-icon="name"></i> placeholders in the static markup for SVGs.
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.className);
  });

  window.Pantry = {
    locations, items, activity, devices, sync,
    num, unitText, fmtQty, byId, loc, status, daysLeft, expiring, level, suggest,
    expiryLabel, shortExpiry, esc, greeting,
    todayLabel: today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    pairCode: '482 913',
    units: ['pcs', 'pack', 'bottle', 'tin', 'bag', 'box', 'kg', 'g', 'L', 'ml'],
    emojis: ['🥫', '🍎', '🥕', '🧀', '🥩', '🍞', '🧃', '🧂', '🍫', '🧴', '🧻', '🧽', '📦'],
    on, adjust, addItem, shoppingList, toggleShop, addExtra, checkedCount, restock, syncNow, stats,
    icon, fakeQR,
  };
})();

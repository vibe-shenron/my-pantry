'use strict';
/* =====================================================================
   My Pantry: behaviour
   Actions, the Android back button, gestures, install, theme and startup.
   ===================================================================== */

const buzz = (p = 8) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* no haptics */ } };

/* ---------- layers, so the back button closes things instead of leaving the app ---------- */
const Nav = {
  stack: [], ignore: 0, backs: 0, timer: 0,
  push(kind) { this.stack.push(kind); history.pushState({ myPantry: this.stack.length }, ''); },
  pop(kind) {
    const k = this.stack.lastIndexOf(kind);
    if (k < 0) return;
    this.stack.splice(k, 1);
    this.backs++;
    if (!this.timer) {
      this.timer = setTimeout(() => {
        const n = this.backs;
        this.backs = 0;
        this.timer = 0;
        this.ignore++;
        history.go(-n);
      }, 0);
    }
  },
};
addEventListener('popstate', () => {
  if (Nav.ignore) { Nav.ignore--; return; }
  const top = Nav.stack.pop();
  if (top === 'dialog') closeDialog(false, true);
  else if (top === 'sheet') closeSheet(true);
  else if (top === 'tab') goTab('inventory', true);
});

function goTab(tab, fromHistory) {
  if (tab === ui.tab) { if (!fromHistory) scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.scroll[ui.tab] = scrollY;
  const from = ui.tab;
  ui.tab = tab;
  if (!fromHistory) {
    if (from === 'inventory') Nav.push('tab');
    else if (tab === 'inventory') Nav.pop('tab');
  }
  render();
  scrollTo(0, ui.scroll[tab] || 0);
  onScroll();
  buzz(5);
}

/* ---------- scrolling: collapse the title into the bar, shrink the add button ---------- */
let lastY = 0;
function onScroll() {
  const y = scrollY;
  $('#appbar').classList.toggle('scrolled', y > 46);
  const fab = $('#fab');
  if (y > lastY + 6 && y > 140) fab.classList.add('mini');
  else if (y < lastY - 6 || y < 80) fab.classList.remove('mini');
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- touch feedback ---------- */
document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active work on iOS
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('.press, .item-fg, .srow, .tab, .chip, .list-row, .icon-btn, .stepper button, .btn');
  if (!el || el.disabled || el.classList.contains('faded')) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'rip';
  s.style.cssText = `width:${size}px;height:${size}px;left:${ev.clientX - r.left - size / 2}px;top:${ev.clientY - r.top - size / 2}px`;
  el.appendChild(s);
  setTimeout(() => s.remove(), 650);
}, { passive: true });

/* ---------- gestures: swipe a row left to delete, drag a sheet down to close ---------- */
let drag = null;
let suppressClick = false;
const suppress = () => { suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); };

document.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const fg = ev.target.closest('[data-swipe]');
  if (fg && !ev.target.closest('button')) {
    drag = { kind: 'row', el: fg, x0: ev.clientX, y0: ev.clientY, dx: 0, active: false };
    return;
  }
  if (ui.sheet && ev.target.closest('.grabber, .sheet-head') && !ev.target.closest('button')) {
    drag = { kind: 'sheet', y0: ev.clientY, dy: 0, active: false, t0: performance.now() };
  }
});
document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (drag.kind === 'row') {
    const dx = ev.clientX - drag.x0;
    const dy = ev.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        drag.active = true;
        drag.el.classList.add('dragging');
        drag.el.parentElement.classList.add('swiping');
        try { drag.el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      } else return;
    }
    drag.dx = Math.min(0, dx);
    drag.el.style.transform = `translateX(${drag.dx}px)`;
  } else {
    const dy = ev.clientY - drag.y0;
    if (!drag.active) {
      if (dy > 6) { drag.active = true; $('#sheet').classList.add('dragging'); } else if (dy < -6) { drag = null; return; } else return;
    }
    drag.dy = Math.max(0, dy);
    $('#sheet').style.transform = `translateY(${drag.dy}px)`;
    $('#scrim').style.opacity = String(Math.max(0, 1 - drag.dy / 420));
  }
}, { passive: true });
function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.active) return;
  suppress();
  if (d.kind === 'row') {
    d.el.classList.remove('dragging');
    const w = d.el.offsetWidth;
    if (d.dx < -Math.min(150, w * 0.38)) {
      d.el.style.transform = `translateX(-${w}px)`;
      const id = d.el.dataset.swipe;
      setTimeout(() => deleteItem(id), 200);
    } else {
      d.el.style.transform = '';
      setTimeout(() => d.el.parentElement && d.el.parentElement.classList.remove('swiping'), 360);
    }
  } else {
    const sh = $('#sheet');
    sh.classList.remove('dragging');
    const speed = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 130 || speed > 0.6) closeSheet();
    else { sh.style.transform = ''; $('#scrim').style.opacity = ''; }
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- actions ---------- */
function deleteItem(id) {
  const i = S.items[id];
  if (!i || i.deleted) return;
  emit('item.del', { id });
  commit();
  buzz(14);
  snack(`${i.name} deleted`, 'Undo', () => { emit('item.restore', { id }); commit(); });
}

function restock() {
  const { auto, extras } = shoppingList();
  const undo = [];
  let n = 0;
  let spent = 0;
  for (const e of auto) {
    if (!e.checked) continue;
    const cost = e.cost != null ? round(e.cost) : null;
    emit('item.adj', { id: e.item.id, delta: e.qty, why: 'restock', ...(cost != null ? { cost } : {}) });
    emit('shop.tick', { key: e.key, on: false });
    undo.push(() => {
      emit('item.adj', { id: e.item.id, delta: -e.qty, why: 'undo', ...(cost != null ? { cost } : {}) });
      emit('shop.tick', { key: e.key, on: true });
    });
    if (cost) spent += cost;
    n++;
  }
  for (const e of extras) {
    if (!e.checked) continue;
    emit('shop.del', { id: e.id, name: e.name, bought: true });
    undo.push(() => { emit('shop.add', { id: e.id, name: e.name, emoji: e.emoji }); emit('shop.tick', { key: e.key, on: true }); });
    n++;
  }
  commit();
  buzz([10, 50, 20]);
  snack(`${n} item${n === 1 ? '' : 's'} restocked${spent ? ` · ${money(spent)}` : ''}`, 'Undo', () => { undo.forEach((f) => f()); commit(); });
}

function markSent(kind) {
  const now = Math.max(Date.now(), S.clock);
  meta.lastBackupAt = now;
  if (kind === 'sync') meta.lastSentAt = now;
  persist();
  render();
}
async function sendFile(kind) {
  const ok = await saveFile(fileName(kind), exportText(kind), kind);
  if (!ok) return;
  markSent(kind);
  snack(kind === 'sync' ? 'Sync file ready. Open it on your other phone with Receive.' : 'Backup saved to your downloads');
}
function handleImport(text) {
  if (!String(text || '').trim()) { snack('Paste the text first'); return; }
  const cfg = parseJoin(text);
  if (cfg) {
    snack('Joining…');
    joinFromGist(cfg, ui.joinName).then((r) => {
      if (r.ok) { closeSheet(); if (ui.tab !== 'inventory') goTab('inventory'); render(); buzz([10, 40, 10]); }
      snack(r.msg);
    });
    return;
  }
  const res = importText(text, ui.joinName);
  if (res.ok) { closeSheet(); if (ui.tab !== 'inventory') goTab('inventory'); render(); buzz([10, 40, 10]); }
  snack(res.msg);
}
async function copyText(kind) {
  const ta = $('#copy-out');
  let ok = false;
  try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) {
    try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e2) { ok = false; }
  }
  if (ok) { if (kind === 'sync' || kind === 'backup') markSent(kind); snack('Copied'); } else { ta.focus(); ta.select(); snack('Press and hold the text, then tap Copy'); }
}

const blankish = (v) => (v == null || v === '' ? null : v);
const same = (a, b) => JSON.stringify(blankish(a)) === JSON.stringify(blankish(b));

function saveItem(form) {
  const id = form.dataset.id;
  const f = new FormData(form);
  const name = String(f.get('name') || '').trim();
  if (!name) { snack('Give the item a name'); $('#f-name').focus(); return; }
  const unit = f.get('unit') || 'pcs';
  const priceRaw = String(f.get('price') || '').trim();
  const data = {
    name, emoji: ui.form.emoji, loc: ui.form.loc, cat: String(f.get('cat') || '').trim(), unit,
    min: Math.max(0, +f.get('min') || 0), exp: f.get('exp') || null, notes: String(f.get('notes') || '').trim(),
    price: priceRaw === '' ? null : normPrice({ amt: priceRaw, per: f.get('per') }),
    size: MEASURE[unit] ? null : normSize({ amt: f.get('size'), unit: f.get('sizeUnit') }),
  };
  const qty = round(Math.max(0, +f.get('qty') || 0));
  buzz(10);
  if (id) {
    const i = S.items[id];
    if (!i) { closeSheet(); return; }
    const changed = {};
    for (const k of EDITABLE) if (!same(i[k], data[k])) changed[k] = data[k];
    if (Object.keys(changed).length) emit('item.edit', { id, ...changed });
    if (qty !== i.qty) emit('item.set', { id, qty });
    commit();
    openSheet('detail', id);
    snack('Saved');
    return;
  }
  const nid = uid();
  emit('item.add', { id: nid, ...data, qty });
  commit();
  closeSheet();
  ui.filter = null;
  ui.q = '';
  $('#q').value = '';
  if (ui.loc !== 'all') ui.loc = data.loc;
  render();
  snack(`Added ${name}`);
  setTimeout(() => {
    const row = $(`[data-key="i:${nid}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
}

async function eraseAll() {
  closeSheet();
  const theme = meta.theme;
  meta = { ...newMeta(), theme };
  log = [];
  seen = new Set();
  S = emptyState();
  Object.assign(ui, { tab: 'inventory', loc: 'all', filter: null, q: '' });
  $('#q').value = '';
  $('#welcome').innerHTML = '';
  for (const id of ['#groups', '#chips', '#banners', '#shop-auto', '#shop-extras']) $(id).innerHTML = '';
  for (const id of ['#hero', '#shop-hero', '#sync-body']) { $(id).innerHTML = ''; $(id)._html = ''; }
  await persist();
  render();
  scrollTo(0, 0);
  snack('My Pantry was erased from this phone');
}

function chooseSheet(title, act, current, options) { openSheet('choose', { title, act, current, options }); }

async function onAction(act, el) {
  const id = el.dataset.id;
  const item = id != null ? S.items[id] : null;
  switch (act) {
    case 'tab': return goTab(el.dataset.tab);
    case 'toggle-examples':
      ui.examples = !ui.examples;
      $('#w-examples').classList.toggle('on', ui.examples);
      el.setAttribute('aria-checked', String(ui.examples));
      return buzz(6);
    case 'start':
      createPantry($('#w-name').value.trim() || 'Main Phone', ui.examples, $('#w-cur').value || guessCurrency());
      buzz([10, 40, 16]);
      meta.asPrompted = true;
      persist();
      setTimeout(() => openSheet('autosync-setup'), 650);
      return snack('Your pantry is ready');
    case 'join':
      ui.joinName = $('#w-name').value.trim() || 'Second Phone';
      return openSheet('receive');
    case 'add': buzz(8); return openSheet('item', null);
    case 'open': return openSheet('detail', id);
    case 'adj': {
      if (!item) return;
      const dir = +el.dataset.dir;
      if (dir < 0 && item.qty <= 0) { buzz([6, 30, 6]); return; }
      emit('item.adj', { id, delta: round(dir * Math.min(stepOf(item), dir < 0 ? item.qty : Infinity)) });
      commit();
      return buzz(6);
    }
    case 'filter': {
      const f = el.dataset.f;
      ui.filter = ui.filter === f ? null : f;
      renderInventory();
      buzz(6);
      if (ui.filter) $('#chips').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    case 'loc': ui.loc = id; renderInventory(); return buzz(5);
    case 'q-clear': ui.q = ''; $('#q').value = ''; renderInventory(); return $('#q').focus();
    case 'locs': return openSheet('locs');
    case 'remove-examples': {
      const ex = items().filter((i) => i.example);
      for (const i of ex) emit('item.del', { id: i.id, purge: true });
      commit();
      buzz(14);
      return snack(`${ex.length} example item${ex.length === 1 ? '' : 's'} removed`, 'Undo', () => { for (const i of ex) emit('item.restore', { id: i.id }); commit(); });
    }
    case 'tick': emit('shop.tick', { key: el.dataset.key, on: !S.ticks[el.dataset.key] }); commit(); return buzz(8);
    case 'del-extra': {
      const x = S.extras[id];
      if (!x) return;
      emit('shop.del', { id, name: x.name });
      commit();
      return snack(`${x.name} removed`, 'Undo', () => { emit('shop.add', { id: x.id, name: x.name, emoji: x.emoji, note: x.note }); commit(); });
    }
    case 'restock': return restock();
    case 'send': return sendFile('sync');
    case 'backup': return sendFile('backup');
    case 'receive': return openSheet('receive');
    case 'pick-file': return $('#file-in').click();
    case 'paste-load': return handleImport($('#paste-in').value);
    case 'copy-text': return copyText(ui.sheet && ui.sheet.arg.kind);
    case 'rename-phone': {
      const v = await ask({ title: 'Name this phone', text: 'Shown on your other phones.', input: { value: myName() }, ok: 'Save' });
      if (v && v.trim() && v.trim() !== myName()) { emit('device.name', { name: v.trim() }); commit(); }
      return;
    }
    case 'make-main': {
      const yes = await ask({ title: 'Make this the main phone?', text: 'Do this if your main phone is lost or replaced. Other phones learn about it the next time you sync.', ok: 'Make main' });
      if (yes) { emit('pantry.main', { dev: meta.deviceId }); commit(); snack('This is now the main phone'); }
      return;
    }
    case 'currency':
      return chooseSheet('Currency', 'set-currency', currency(), CURRENCIES.map((c) => [c, `${c} · ${currencySymbol(c)}`, currencyName(c)]));
    case 'soon':
      return chooseSheet('“Use soon” warning', 'set-soon', S.soonDays, [3, 5, 7, 14, 30].map((n) => [n, `${n} days before it expires`, n === 7 ? 'Recommended' : '']));
    case 'choose': {
      const a = ui.sheet && ui.sheet.arg.act;
      const v = el.dataset.v;
      if (a === 'set-currency' && v !== currency()) emit('pantry.set', { currency: v });
      if (a === 'set-soon' && +v !== S.soonDays) emit('pantry.set', { soonDays: +v });
      commit();
      closeSheet();
      buzz(8);
      return snack('Saved');
    }
    case 'theme':
      meta.theme = el.dataset.v;
      applyTheme();
      persist();
      render();
      return buzz(6);
    case 'activity': return openSheet('activity');
    case 'deleted': return openSheet('deleted');
    case 'restore':
      if (item) { emit('item.restore', { id }); commit(); snack(`${item.name} restored`); }
      return;
    case 'erase': {
      const yes = await ask({ title: 'Erase from this phone?', text: 'Everything on this phone is removed. Other phones keep their copy. Save a backup first if this is your only phone.', ok: 'Erase', danger: true });
      if (yes) eraseAll();
      return;
    }
    case 'close': return closeSheet();
    case 'set-count': {
      if (!item) return;
      const v = await ask({ title: `How many ${unitText(item.unit, 2)} of ${item.name}?`, text: 'Replaces the current count.', input: { type: 'number', value: round(item.qty) }, ok: 'Set' });
      if (v == null || v === '' || isNaN(+v)) return;
      const qty = round(Math.max(0, +v));
      if (qty !== item.qty) { emit('item.set', { id, qty }); commit(); buzz(8); }
      return;
    }
    case 'edit': return openSheet('item', id);
    case 'to-list':
      if (item) { emit('shop.add', { id: uid(), name: item.name, emoji: item.emoji }); commit(); buzz(8); snack('Added to the shopping list'); }
      return;
    case 'delete': closeSheet(); return deleteItem(id);
    case 'emoji':
      ui.form.emoji = el.dataset.e;
      ui.form.picked = true;
      $('#f-emojis').innerHTML = emojiButtons();
      return buzz(5);
    case 'form-loc':
      ui.form.loc = id;
      $('#f-locs').innerHTML = locPick();
      return buzz(5);
    case 'loc-icon': {
      const l = S.locs.find((x) => x.id === id);
      if (!l) return;
      emit('loc.edit', { id, icon: LOC_ICONS[(LOC_ICONS.indexOf(l.icon) + 1) % LOC_ICONS.length] });
      commit();
      renderSheet(true);
      return buzz(5);
    }
    case 'loc-del': {
      const l = S.locs.find((x) => x.id === id);
      if (!l) return;
      const n = items().filter((i) => i.loc === id).length;
      if (n) { buzz([6, 30, 6]); return snack(`Move or delete the ${n} item${n === 1 ? '' : 's'} in ${l.name} first`); }
      emit('loc.del', { id });
      commit();
      renderSheet(true);
      return snack(`${l.name} removed`, 'Undo', () => { emit('loc.add', { id: l.id, name: l.name, icon: l.icon }); rebuildLoc(l.id); commit(); if (ui.sheet && ui.sheet.kind === 'locs') renderSheet(true); });
    }
    case 'loc-add': {
      emit('loc.add', { id: uid(), name: 'New location', icon: '📦' });
      commit();
      renderSheet(true);
      const inputs = $$('[data-loc-name]');
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
      return;
    }
    case 'as-setup': return openSheet('autosync-setup');
    case 'as-later': ui.asLater = true; closeSheet(); render(); return snack('You can turn it on any time in Sync & settings');
    case 'as-link': {
      const r = await shareJoinLink();
      if (r === 'copied') snack('Join link copied. Send it to your other phone and open it there.');
      else if (r === 'shared') snack('Open the link on your other phone. It joins with sync on.');
      return;
    }
    case 'as-open': return openSheet('autosync');
    case 'as-connect': {
      const b = $('#as-connect');
      const msg = $('#as-msg');
      b.disabled = true;
      b.textContent = 'Connecting…';
      msg.textContent = '';
      const r = await connectAutosync($('#as-token').value);
      b.disabled = false;
      b.textContent = 'Connect';
      if (!r.ok) { msg.textContent = r.msg; buzz([6, 30, 6]); return; }
      buzz([10, 40, 16]);
      render();
      openSheet('autosync');
      return snack('Automatic sync is on');
    }
    case 'as-now': { const r = await autoSync(); return reportSync(r); }
    case 'as-add-phone': return sendFile('sync');
    case 'as-off': {
      const yes = await ask({ title: 'Turn off automatic sync?', text: 'This phone stops syncing by itself. Your pantry stays here, and you can still sync by file.', ok: 'Turn off' });
      if (yes) { meta.as = null; persist(); closeSheet(); render(); snack('Automatic sync is off on this phone'); }
      return;
    }
    case 'install': return promptInstall();
    case 'install-hide': meta.installHidden = true; persist(); return render();
    case 'dlg-ok': return closeDialog(true);
    case 'dlg-cancel': return closeDialog(false);
  }
}
// Undoing a removed location: loc.add is ignored for an existing id, so un-delete it directly and record that.
function rebuildLoc(id) {
  const l = S.locs.find((x) => x.id === id);
  if (l && l.deleted) { l.deleted = false; emit('loc.edit', { id, name: l.name }); }
}

/* ---------- wiring ---------- */
document.addEventListener('click', (ev) => {
  if (suppressClick) { suppressClick = false; ev.preventDefault(); ev.stopPropagation(); return; }
  if (ev.target.id === 'scrim') return closeSheet();
  if (ev.target.id === 'dialog') return closeDialog(false);
  if (ev.target.closest('#snack-act')) { const f = snackFn; hideSnack(); if (f) { f(); buzz(8); } return; }
  const el = ev.target.closest('[data-act]');
  if (el && !el.disabled) onAction(el.dataset.act, el);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!$('#dialog').hidden) return closeDialog(false);
    if (ui.sheet) return closeSheet();
  }
  if (ev.key === 'Enter' && ev.target.id === 'dlg-in') { ev.preventDefault(); return closeDialog(true); }
  const role = ev.target.getAttribute && ev.target.getAttribute('role');
  if ((ev.key === 'Enter' || ev.key === ' ') && (role === 'switch' || role === 'checkbox') && ev.target.dataset.act) {
    ev.preventDefault();
    onAction(ev.target.dataset.act, ev.target);
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'q') { ui.q = t.value; renderInventory(); return; }
  if (t.id === 'f-name' && ui.form && !ui.form.picked) {
    const g = guessEmoji(t.value);
    if (g && g !== ui.form.emoji) { ui.form.emoji = g; $('#f-emojis').innerHTML = emojiButtons(); }
  }
  if (t.closest && t.closest('#item-form')) updatePriceHint();
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'f-unit') {
    if (!$('#f-price').value && PRICE_PER.some(([k]) => k === t.value)) $('#f-per').value = t.value;
    updatePriceHint();
  }
  if (t.closest && t.closest('#item-form')) updatePriceHint();
  if (t.dataset && t.dataset.locName) {
    const l = S.locs.find((x) => x.id === t.dataset.locName);
    const v = t.value.trim();
    if (l && v && v !== l.name) { emit('loc.edit', { id: l.id, name: v }); commit(); } else if (l) t.value = l.name;
  }
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'item-form') return saveItem(ev.target);
  if (ev.target.id === 'extra-form') {
    const x = $('#extra');
    const v = x.value.trim();
    if (!v) return;
    x.value = '';
    emit('shop.add', { id: uid(), name: v, emoji: guessEmoji(v) || '🛒' });
    commit();
    buzz(6);
    x.focus();
  }
});

$('#file-in').addEventListener('change', async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  if (f.size > 20e6) { snack('That file is too big to be a My Pantry file.'); return; }
  try { handleImport(await f.text()); } catch (e) { snack('Couldn’t read that file. Try again.'); }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  render();
  backgroundUpdateCheck();
  autoSync().then((r) => reportSync(r, true));
});
addEventListener('online', () => autoSync().then((r) => reportSync(r, true)));
setInterval(() => { if (!document.hidden) autoSync().then((r) => reportSync(r, true)); }, 90000);
setInterval(() => { if (!document.hidden) render(); }, 60000);

/* ---------- install + theme ---------- */
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installOffer() { return !!meta && !!S.pantryId && !isStandalone() && !meta.installHidden && (!!deferredInstall || isIOS()); }
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; render(); });
addEventListener('appinstalled', () => { deferredInstall = null; render(); snack('Installed. Open My Pantry from your home screen.'); });
async function promptInstall() {
  if (deferredInstall) {
    const p = deferredInstall;
    deferredInstall = null;
    p.prompt();
    try { await p.userChoice; } catch (e) { /* dismissed */ }
    render();
    return;
  }
  if (isIOS()) ask({ title: 'Add to Home Screen', text: 'In Safari, tap the Share button, then “Add to Home Screen”.', ok: 'Got it', cancel: 'Close' });
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = meta ? meta.theme : 'system';
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && darkQuery.matches);
  $$('meta[name="theme-color"]').forEach((m) => { m.content = dark ? '#0C1310' : '#F3F5EF'; });
}
darkQuery.addEventListener('change', applyTheme);

/* ---------- updates: checked at launch, and again when the app comes back after a while ---------- */
const swOK = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost');
let swReg = Promise.resolve(null);
let reloadingForUpdate = false;
let lastUpdateCheck = 0;
if (swOK) {
  let hadController = !!navigator.serviceWorker.controller;
  swReg = navigator.serviceWorker.register('sw.js').catch((e) => { console.warn('Offline support unavailable', e); return null; });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (reloadingForUpdate) return;
    snack('A new version of My Pantry is ready', 'Update', () => location.reload());
  });
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
function bootMsg(text) {
  $('#boot-msg').textContent = text || '';
  $('#boot').classList.toggle('busy', !!text);
}
function session(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);
  } catch (e) { /* storage blocked */ }
  return null;
}
// Ask the server for a newer version. If there is one, wait for it to download, then restart into it.
// Returns true when the page is about to reload. Gives up quietly when offline or slow.
async function checkForAppUpdate() {
  lastUpdateCheck = Date.now();
  if (!swOK || !navigator.onLine || session('mp-updated')) return false;
  const reg = await withTimeout(swReg, 3000).catch(() => null);
  if (!reg) return false;
  bootMsg('Checking for updates…');
  try { await withTimeout(reg.update(), 5000); } catch (e) { return false; }
  const worker = reg.installing || reg.waiting;
  if (!worker) return false;
  bootMsg('Downloading the new version…');
  const ready = await new Promise((resolve) => {
    const check = () => { if (worker.state === 'activated') resolve(true); else if (worker.state === 'redundant') resolve(false); };
    worker.addEventListener('statechange', check);
    check();
    setTimeout(() => resolve(false), 20000);
  });
  if (!ready) return false;
  bootMsg('Updated. Starting…');
  session('mp-updated', '1');
  reloadingForUpdate = true;
  location.reload();
  return true;
}
// When the app comes back to the front after 30+ minutes, look for an update in the background.
async function backgroundUpdateCheck() {
  if (!swOK || !navigator.onLine || Date.now() - lastUpdateCheck < 30 * 60000) return;
  lastUpdateCheck = Date.now();
  const reg = await swReg;
  if (reg) reg.update().catch(() => {});
}

/* ---------- start ---------- */
async function boot() {
  $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className); });
  const params = new URLSearchParams(location.search);
  // A join link carries the sync settings in its #fragment. Keep them through a possible update restart.
  if (location.hash.startsWith('#join=')) session('mp-join', location.hash);
  if (params.toString() || location.hash) history.replaceState(null, '', location.pathname);
  else if (history.state && history.state.myPantry) { Nav.ignore++; history.go(-history.state.myPantry); }
  await Store.open();
  const saved = await Store.get('data');
  if (saved && saved.meta && Array.isArray(saved.log)) {
    meta = { ...newMeta(), ...saved.meta };
    log = saved.log.filter(validEvent).sort(order);
    seen = new Set(log.map((e) => e.id));
    rebuild();
  } else {
    meta = newMeta();
  }
  applyTheme();
  if (await checkForAppUpdate()) return;   // restarting into the new version
  bootMsg('');
  const justUpdated = !!session('mp-updated');
  session('mp-updated', null);
  let joinResult = null;
  const joinRaw = session('mp-join');
  if (joinRaw) {
    session('mp-join', null);
    const cfg = parseJoin(joinRaw);
    if (cfg) {
      bootMsg('Joining your pantry…');
      joinResult = await joinFromGist(cfg).catch(() => ({ ok: false, msg: 'Couldn’t join from that link. Try opening it again.' }));
      bootMsg('');
    }
  }
  let launchSync = null;
  if (!joinResult && asOn() && navigator.onLine) {
    bootMsg('Syncing your pantry…');
    launchSync = await withTimeout(autoSync(), 8000).catch(() => null);
    bootMsg('');
  }
  // Before 2.1 the currency was guessed from the phone's language, which picked USD or GBP for phones in
  // Pakistan set to English. Correct that once; after this, whatever is chosen in settings stays.
  let currencyFixed = false;
  if (S.pantryId && !meta.currencyChecked) {
    meta.currencyChecked = true;
    if (guessCurrency() === 'PKR' && currency() !== 'PKR') { emit('pantry.set', { currency: 'PKR' }); currencyFixed = true; }
    persist();
  }
  render();
  onScroll();
  if (joinResult) snack(joinResult.msg);
  else if (currencyFixed) snack('Prices now show in Pakistani rupees (Rs)');
  else if (launchSync && launchSync.added) reportSync(launchSync, true);
  else if (justUpdated) snack(`Updated to My Pantry ${APP_VERSION}`);
  // Automatic sync is on by default: until it's connected, bring up the setup once per install.
  if (S.pantryId && !asOn() && !meta.asPrompted) {
    meta.asPrompted = true;
    persist();
    setTimeout(() => { if (!ui.sheet) openSheet('autosync-setup'); }, 900);
  }
  setTimeout(() => $('#boot').classList.add('gone'), 260);
  if (S.pantryId) {
    const tab = params.get('tab');
    if (tab === 'shopping' || tab === 'sync') goTab(tab);
    if (params.get('action') === 'add') openSheet('item', null);
    if (!meta.persisted) askPersist();
  }
}
boot();

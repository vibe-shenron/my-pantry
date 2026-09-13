'use strict';
/* =====================================================================
   My Pantry: screens
   Rendering patches the page in place (keyed lists + morphing) instead of
   redrawing it, so numbers roll, bars glide and rows slide in and out.
   ===================================================================== */

const APP_VERSION = '2.2';
const ui = { tab: 'inventory', loc: 'all', filter: null, q: '', sheet: null, form: null, examples: true, joinName: '', scroll: {} };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const CHEV = () => icon('chevron', 'chev');

/* ---------- DOM patching ---------- */
const tpl = document.createElement('template');
function toNode(html) { tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; }
function roll(el) { el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); }

// Make `a` look like `b` while keeping a's nodes, so CSS transitions play.
function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return b; }
  if (a.nodeType === 3) { if (a.data !== b.data) a.data = b.data; return a; }
  if (a.nodeType !== 1) return a;
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  if (a.hasAttribute('data-roll')) {
    if (a.textContent !== b.textContent) { a.textContent = b.textContent; roll(a); }
    return a;
  }
  if (a === document.activeElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return a;
  const ac = [...a.childNodes];
  const bc = [...b.childNodes];
  for (let k = 0; k < bc.length; k++) { if (k < ac.length) morph(ac[k], bc[k]); else a.appendChild(bc[k]); }
  for (let k = bc.length; k < ac.length; k++) ac[k].remove();
  return a;
}

// Update an element's contents only when they changed.
function setHTML(el, html) {
  if (el._html === html) return;
  el._html = html;
  if (!el.firstChild) { el.innerHTML = html; return; }
  const b = el.cloneNode(false);
  b.innerHTML = html;
  morph(el, b);
}

// Keyed list update. entries: [{ key, html }]. Unchanged rows are left alone, changed rows are
// morphed, new rows animate in and missing rows animate out.
function patch(box, entries, { animate = true, stagger = false } = {}) {
  const old = new Map();
  for (const el of [...box.children]) if (el.dataset.key) old.set(el.dataset.key, el);
  let prev = null;
  let n = 0;
  for (const { key, html } of entries) {
    let el = old.get(key);
    if (el) {
      old.delete(key);
      if (el._html !== html) {
        const fresh = toNode(html);
        fresh.dataset.key = key;
        for (const c of ['enter']) if (el.classList.contains(c)) fresh.classList.add(c);
        el = morph(el, fresh);
        el._html = html;
      }
    } else {
      el = toNode(html);
      el.dataset.key = key;
      el._html = html;
      if (animate) {
        el.classList.add('enter');
        el.style.setProperty('--i', stagger ? Math.min(n, 12) : 0);
        el.addEventListener('animationend', () => { el.classList.remove('enter'); el.style.removeProperty('--i'); }, { once: true });
      }
    }
    n++;
    const want = prev ? prev.nextSibling : box.firstChild;
    if (el !== want) box.insertBefore(el, want);
    prev = el;
  }
  for (const el of old.values()) leave(el, animate);
}
function leave(el, animate) {
  delete el.dataset.key;
  if (!animate || !el.offsetHeight) { el.remove(); return; }
  el.style.height = el.offsetHeight + 'px';
  void el.offsetHeight;
  el.classList.add('leaving');
  el.style.height = '0px';
  el.style.marginTop = '0px';
  el.style.marginBottom = '0px';
  setTimeout(() => el.remove(), 320);
}

function tint(locId) {
  const idx = S.locs.findIndex((l) => l.id === locId);
  return idx < 0 ? 'var(--t-other)' : `var(--t${idx % 6})`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
const emptyHtml = (big, title, text) => `<div class="empty"><div class="big">${big}</div><b>${esc(title)}</b>${esc(text)}</div>`;
const banner = (kind, ic, title, text, actions = '') =>
  `<div class="banner ${kind}"><span class="bi">${icon(ic)}</span><span class="bt"><b>${esc(title)}</b><small>${esc(text)}</small></span>${actions}</div>`;
function currencyName(c) {
  try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'currency' }).of(c); } catch (e) { return c; }
}
function currencySymbol(c) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency').value; } catch (e) { return c; }
}

/* ---------- frame ---------- */
function render() {
  if (!meta) return;
  showScreens();
  renderChrome();
  if (!S.pantryId) {
    if (!$('#welcome').childElementCount) renderWelcome();
    return;
  }
  renderInventory();
  renderShop();
  renderSync();
  if (ui.sheet) renderSheet();
}

function showScreens() {
  const want = S.pantryId ? ui.tab : 'welcome';
  for (const id of ['welcome', 'inventory', 'shopping', 'sync']) {
    const el = $('#' + id);
    if (id === want) {
      if (el.hidden) { el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
    } else {
      el.hidden = true;
    }
  }
}

function renderChrome() {
  const has = !!S.pantryId;
  document.body.classList.toggle('welcome-mode', !has);
  if (!has) return;
  const titles = { inventory: S.name || 'My Pantry', shopping: 'Shopping', sync: 'Sync & settings' };
  $('#appbar-title').textContent = titles[ui.tab];
  const [cls, text] = syncStatus();
  $('#sdot').className = 'sdot ' + cls;
  $('#sync-btn').setAttribute('aria-label', text);
  $$('#nav .tab').forEach((b) => {
    const on = b.dataset.tab === ui.tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  const count = shoppingCount();
  const badge = $('#badge-shop');
  if (badge.textContent !== String(count)) { badge.textContent = count; badge.hidden = !count; if (count) { badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = ''; } }
  $('#badge-sync').hidden = cls === '';
  $('#fab').classList.toggle('away', ui.tab !== 'inventory' || !!ui.sheet);
}

/* ---------- welcome ---------- */
function currencyOptions(sel) {
  const list = CURRENCIES.includes(sel) ? CURRENCIES : [sel, ...CURRENCIES];
  return list.map((c) => `<option value="${c}"${c === sel ? ' selected' : ''}>${c} · ${esc(currencyName(c))}</option>`).join('');
}
function renderWelcome() {
  $('#welcome').innerHTML = `
    <div class="w-hero">
      <img src="icons/icon-192.png" alt="">
      <h1>My Pantry</h1>
      <p>Know what’s in the house, what it’s worth, and what to buy next.</p>
    </div>
    <div class="w-card stack">
      <div class="field"><label for="w-name">Name this phone</label><input class="input" id="w-name" maxlength="30" placeholder="Main Phone" autocomplete="off"></div>
      <div class="field"><label for="w-cur">Currency</label><select class="input" id="w-cur">${currencyOptions(guessCurrency())}</select></div>
      <div class="list-row press" style="padding:6px 4px;min-height:0" data-act="toggle-examples" role="switch" aria-checked="true" tabindex="0">
        <span class="lt"><b>Add example items</b><small>Ten everyday items with prices, to try it out</small></span><span class="switch on" id="w-examples"></span>
      </div>
      <button class="btn primary press" data-act="start">Start my pantry</button>
    </div>
    <div class="w-join"><button class="btn plain press" data-act="join">${icon('download')}Join from another phone</button></div>
    <div class="w-feats">
      <div class="w-feat"><span class="lead warm">${icon('alert')}</span>Running low? It goes on the shopping list by itself.</div>
      <div class="w-feat"><span class="lead brand">${icon('tag')}</span>Prices per kg, pack or can, and what your stock is worth.</div>
      <div class="w-feat"><span class="lead brand">${icon('sync')}</span>Share it with a second phone. Your data stays on your phones.</div>
    </div>`;
}

/* ---------- inventory ---------- */
function subline(i) {
  const st = status(i);
  if (st === 'out') return ['out', 'Out of stock'];
  if (expiring(i)) return [daysLeft(i) <= 1 ? 'out' : 'low', expiryLabel(i)];
  if (st === 'low') return ['low', `Low · below ${fmtQty(i, i.min)}`];
  return ['', i.cat || locOf(i).name];
}

function itemRow(i) {
  const [cls, text] = subline(i);
  const st = status(i);
  const id = esc(i.id);
  return `<div class="item">
    <div class="swipe-under">${icon('trash')}Delete</div>
    <div class="item-fg" data-act="open" data-id="${id}" data-swipe="${id}">
      <span class="itile" style="background:${tint(i.loc)}">${esc(i.emoji)}</span>
      <span class="imain">
        <span class="iname">${esc(i.name)}</span>
        <span class="isub ${cls}">${esc(text)}</span>
        <span class="meter"><i class="${st}" style="width:${Math.round(level(i) * 100)}%"></i></span>
      </span>
      <span class="iside">
        <span class="stepper">
          <button data-act="adj" data-dir="-1" data-id="${id}" aria-label="Use one ${esc(i.name)}">${icon('minus')}</button>
          <b><span data-roll>${esc(fmtQty(i))}</span></b>
          <button class="plus" data-act="adj" data-dir="1" data-id="${id}" aria-label="Add one ${esc(i.name)}">${icon('plus')}</button>
        </span>
        ${i.price ? `<span class="iprice">${esc(priceLabel(i))}</span>` : ''}
      </span>
    </div>
  </div>`;
}

function renderInventory() {
  const now = new Date();
  $('#inv-eyebrow').textContent = `${greeting()} · ${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`;
  $('#inv-title').textContent = S.name || 'My Pantry';
  if (ui.loc !== 'all' && !activeLocs().some((l) => l.id === ui.loc)) ui.loc = 'all';
  renderHero();
  renderBanners();
  renderChips();
  renderGroups();
  $('#q-clear').hidden = !ui.q;
}

function renderHero() {
  const all = items();
  const sv = stockValue();
  const lowN = all.filter((i) => status(i) !== 'ok').length;
  const soonN = all.filter(expiring).length;
  const shop = shoppingEstimate();
  const priced = sv.priced > 0;
  setHTML($('#hero'), `
    <div class="hero-top"><span>${priced ? 'Stock value' : 'In your pantry'}</span><span>${all.length} item${all.length === 1 ? '' : 's'} · ${activeLocs().length} places</span></div>
    <div class="hero-num"><span data-roll>${esc(priced ? money(sv.v) : `${all.length} item${all.length === 1 ? '' : 's'}`)}</span></div>
    <p class="hero-note">${priced ? (sv.unpriced ? `${sv.unpriced} item${sv.unpriced === 1 ? ' has' : 's have'} no price yet` : 'Every item has a price') : 'Add prices to see what your stock is worth'}</p>
    <div class="hero-stats">
      <button class="hstat press${ui.filter === 'low' ? ' on' : ''}" data-act="filter" data-f="low"><b><span data-roll>${lowN}</span></b><small>Low or out</small></button>
      <button class="hstat press${ui.filter === 'soon' ? ' on' : ''}" data-act="filter" data-f="soon"><b><span data-roll>${soonN}</span></b><small>Use soon</small></button>
      <button class="hstat press" data-act="tab" data-tab="shopping"><b><span data-roll>${esc(shop.v > 0 ? money(shop.v) : String(shop.count))}</span></b><small>${shop.v > 0 ? 'To buy' : 'On the list'}</small></button>
    </div>`);
}

function renderBanners() {
  const entries = [];
  if (Store.mode === 'memory' || Store.failed) {
    entries.push({ key: 'nosave', html: banner('bad', 'alert', 'This phone isn’t saving My Pantry', 'Changes will be lost when you close it. Open it in Chrome, not a private tab.') });
  }
  if (typeof installOffer === 'function' && installOffer()) {
    entries.push({ key: 'install', html: banner('info', 'install', 'Install My Pantry', 'Put it on your home screen. It opens full screen and works offline.',
      `<button class="text-btn press" data-act="install">Install</button><button class="icon-btn press" data-act="install-hide" aria-label="Not now">${icon('x')}</button>`) });
  }
  if (items().some((i) => i.example)) {
    entries.push({ key: 'examples', html: banner('info', 'sparkle', 'These are example items', 'Try the buttons, then remove them.', '<button class="text-btn press" data-act="remove-examples">Remove</button>') });
  }
  patch($('#banners'), entries);
}

function renderChips() {
  const all = items();
  const entries = [];
  if (ui.filter) {
    entries.push({ key: 'flt', html: `<button class="chip flt press" data-act="filter" data-f="${ui.filter}">${ui.filter === 'low' ? 'Low or out' : 'Use soon'} ${icon('x')}</button>` });
  }
  entries.push({ key: 'all', html: `<button class="chip press${ui.loc === 'all' ? ' on' : ''}" data-act="loc" data-id="all">All <span class="n">${all.length}</span></button>` });
  for (const l of activeLocs()) {
    const n = all.filter((i) => i.loc === l.id).length;
    entries.push({ key: 'l:' + l.id, html: `<button class="chip press${ui.loc === l.id ? ' on' : ''}" data-act="loc" data-id="${esc(l.id)}">${esc(l.icon)} ${esc(l.name)} <span class="n">${n}</span></button>` });
  }
  entries.push({ key: 'edit', html: `<button class="chip press" data-act="locs">${icon('edit')}Edit</button>` });
  patch($('#chips'), entries, { animate: false });
}

function renderGroups() {
  const all = items();
  const q = ui.q.trim().toLowerCase();
  const list = all.filter((i) =>
    (ui.loc === 'all' || i.loc === ui.loc) &&
    (!q || i.name.toLowerCase().includes(q) || String(i.cat).toLowerCase().includes(q)) &&
    (ui.filter !== 'low' || status(i) !== 'ok') &&
    (ui.filter !== 'soon' || expiring(i)));
  const groups = [...activeLocs(), OTHER]
    .map((l) => ({ l, rows: list.filter((i) => locOf(i).id === l.id).sort(byName) }))
    .filter((g) => g.rows.length);
  const box = $('#groups');
  const first = !box.childElementCount;
  const entries = groups.map(({ l }) => ({ key: 'g:' + l.id, html: '<section class="group"><div class="group-h"></div><div class="card rows"></div></section>' }));
  if (!all.length) entries.push({ key: 'empty-none', html: emptyHtml('🧺', 'Your pantry is empty', 'Tap “Add item” to add the first thing you keep at home.') });
  else if (!groups.length) entries.push({ key: 'empty-match', html: emptyHtml('🔎', 'Nothing matches', q ? 'Try a different word.' : 'Nothing here right now.') });
  patch(box, entries, { stagger: first });
  for (const { l, rows } of groups) {
    const sec = [...box.children].find((el) => el.dataset.key === 'g:' + l.id);
    const val = rows.reduce((s, i) => { const c = costOf(i, i.qty); return c == null ? s : s + c; }, 0);
    setHTML(sec.querySelector('.group-h'),
      `<span class="gtile" style="background:${tint(l.id)}">${esc(l.icon)}</span><b>${esc(l.name)}</b><span class="gcount">${rows.length}</span>${val > 0 ? `<span class="gval">${esc(money(val))}</span>` : ''}`);
    patch(sec.querySelector('.rows'), rows.map((i) => ({ key: 'i:' + i.id, html: itemRow(i) })), { stagger: first });
  }
}

/* ---------- shopping ---------- */
function shoppingList() {
  const auto = items().filter((i) => status(i) !== 'ok').sort(byName).map((i) => {
    const q = suggest(i);
    return { key: 'i:' + i.id, name: i.name, emoji: i.emoji, item: i, qty: q, cost: costOf(i, q), note: `Buy ${fmtQty(i, q)} · have ${fmtQty(i)}`, checked: !!S.ticks['i:' + i.id] };
  });
  const extras = Object.values(S.extras).sort((a, b) => a.t - b.t).map((x) => ({
    key: 'x:' + x.id, id: x.id, name: x.name, emoji: x.emoji, cost: null, note: x.note || 'Added by you', checked: !!S.ticks['x:' + x.id],
  }));
  return { auto, extras };
}
function shoppingEstimate() {
  const { auto, extras } = shoppingList();
  let v = 0;
  for (const e of auto) if (e.cost != null) v += e.cost;
  return { v, count: auto.length + extras.length };
}
const shoppingCount = () => { const { auto, extras } = shoppingList(); return auto.length + extras.length; };

function shopRow(e) {
  const side = e.id
    ? `<button class="icon-btn press" data-act="del-extra" data-id="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">${icon('x')}</button>`
    : e.cost != null ? `<span class="sprice">${esc(money(e.cost))}</span>` : '<span class="sprice none">No price</span>';
  return `<div class="srow${e.checked ? ' done' : ''}" data-act="tick" data-key="${esc(e.key)}" role="checkbox" aria-checked="${e.checked}" tabindex="0">
    <span class="check"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
    <span class="st"><b>${esc(e.emoji)} ${esc(e.name)}</b><small>${esc(e.note)}</small></span>
    ${side}
  </div>`;
}

function renderShop() {
  const { auto, extras } = shoppingList();
  const all = [...auto, ...extras];
  const ticked = all.filter((e) => e.checked);
  const est = auto.reduce((s, e) => s + (e.cost || 0), 0);
  const tickedCost = ticked.reduce((s, e) => s + (e.cost || 0), 0);
  const unpriced = all.filter((e) => e.cost == null).length;
  const spend = monthSpend();
  setHTML($('#shop-hero'), `
    <div class="hero-top"><span>Estimated total</span><span>${all.length} item${all.length === 1 ? '' : 's'}</span></div>
    <div class="hero-num"><span data-roll>${esc(money(est))}</span></div>
    <p class="hero-note">${all.length ? (unpriced ? `${unpriced} without a price` : 'Everything on the list has a price') : 'Nothing to buy right now'}${spend > 0 ? ` · ${esc(money(spend))} restocked this month` : ''}</p>
    <div class="progress" role="progressbar" aria-valuenow="${ticked.length}" aria-valuemax="${all.length}" aria-label="In the basket"><i style="width:${all.length ? Math.round((ticked.length / all.length) * 100) : 0}%"></i></div>`);
  $('#shop-auto-n').textContent = auto.length ? `${auto.length}` : '';
  $('#shop-extra-n').textContent = extras.length ? `${extras.length}` : '';
  patch($('#shop-auto'), auto.length
    ? auto.map((e) => ({ key: e.key, html: shopRow(e) }))
    : [{ key: 'none', html: '<p class="empty-sm">Nothing is running low 🎉</p>' }]);
  patch($('#shop-extras'), extras.map((e) => ({ key: e.key, html: shopRow(e) })));
  const btn = $('#restock');
  const n = ticked.length;
  btn.disabled = !n;
  const label = n ? `${icon('check')}Restock ${n} item${n === 1 ? '' : 's'}${tickedCost > 0 ? ` · ${esc(money(tickedCost))}` : ''}` : 'Tick items as you shop';
  if (btn._html !== label) { btn._html = label; btn.innerHTML = label; }
}

/* ---------- sync + settings ---------- */
function renderSync() {
  const me = S.devices[meta.deviceId];
  const others = otherDevices();
  const pend = pendingCount();
  const [, statusText] = syncStatus();
  const storage = Store.mode === 'memory' || Store.failed ? 'Not saving' : meta.persisted ? 'Protected by the browser' : 'Saved on this phone';
  const initial = (myName().trim()[0] || 'P').toUpperCase();
  const phoneRows = [me, ...others].filter(Boolean).map((d) => `
    <div class="list-row"><span class="lead">${icon('phone')}</span>
      <span class="lt"><b>${esc(d.name)}${d.id === meta.deviceId ? ' · this phone' : ''}</b><small>${d.id === meta.deviceId ? 'Last change ' + ago(d.last) : 'Newest change received ' + ago(d.last)}</small></span>
      ${d.id === S.main ? '<span class="role">Main</span>' : ''}</div>`).join('');
  const themes = [['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']]
    .map(([v, l]) => `<button class="${meta.theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('');
  setHTML($('#sync-body'), `
    <div class="card profile">
      <span class="avatar">${esc(initial)}</span>
      <span class="lt"><b>${esc(myName())}</b><small>${esc(statusText)}</small></span>
      <span class="role">${isMain() ? 'Main phone' : 'Member'}</span>
    </div>

    <div class="sec-label"><span>Sync with another phone</span></div>
    <div class="action-tiles">
      <button class="atile press" data-act="send"><span class="lead brand">${icon('share')}</span><span><b>Send</b><small>${esc(others.length && pend ? `${pend} change${pend === 1 ? '' : 's'} to send` : meta.lastSentAt ? 'Sent ' + ago(meta.lastSentAt) : 'Share a sync file')}</small></span></button>
      <button class="atile press" data-act="receive"><span class="lead brand">${icon('download')}</span><span><b>Receive</b><small>${esc(meta.lastImport ? `From ${meta.lastImport.from}, ${ago(meta.lastImport.at)}` : 'Open a sync file')}</small></span></button>
    </div>
    <p class="foot">Send on one phone and receive on the other, then the other way round. Changes from both phones are combined, so nothing is lost.</p>

    <div class="sec-label"><span>Phones in this pantry</span></div>
    <div class="card">
      ${phoneRows}
      <button class="list-row press" data-act="rename-phone"><span class="lead">${icon('edit')}</span><span class="lt"><b>Rename this phone</b></span>${CHEV()}</button>
      ${isMain() ? '' : `<button class="list-row press" data-act="make-main"><span class="lead">${icon('sparkle')}</span><span class="lt"><b>Make this the main phone</b><small>If the main phone is lost or replaced</small></span>${CHEV()}</button>`}
    </div>

    <div class="sec-label"><span>Pantry</span></div>
    <div class="card">
      <button class="list-row press" data-act="locs"><span class="lead">${icon('pin')}</span><span class="lt"><b>Locations</b><small>${esc(activeLocs().map((l) => l.name).join(', ') || 'None')}</small></span>${CHEV()}</button>
      <button class="list-row press" data-act="currency"><span class="lead">${icon('coins')}</span><span class="lt"><b>Currency</b></span><span class="lv">${esc(currency())}</span>${CHEV()}</button>
      <button class="list-row press" data-act="soon"><span class="lead">${icon('clock')}</span><span class="lt"><b>“Use soon” warning</b></span><span class="lv">${S.soonDays} days</span>${CHEV()}</button>
      <button class="list-row press" data-act="activity"><span class="lead">${icon('history')}</span><span class="lt"><b>Activity</b></span>${CHEV()}</button>
      <button class="list-row press" data-act="deleted"><span class="lead">${icon('trash')}</span><span class="lt"><b>Recently deleted</b></span><span class="lv">${deletedItems().length}</span>${CHEV()}</button>
    </div>

    <div class="sec-label"><span>Appearance</span></div>
    <div class="seg">${themes}</div>

    <div class="sec-label"><span>Backup</span></div>
    <div class="card">
      <button class="list-row press" data-act="backup"><span class="lead brand">${icon('upload')}</span><span class="lt"><b>Save a backup file</b><small>${meta.lastBackupAt ? 'Last backup ' + ago(meta.lastBackupAt) : 'No backup yet'}</small></span>${CHEV()}</button>
      <button class="list-row press" data-act="receive"><span class="lead">${icon('download')}</span><span class="lt"><b>Restore from a backup</b><small>Adds anything missing. Never deletes.</small></span>${CHEV()}</button>
      <div class="list-row"><span class="lead">${icon('info')}</span><span class="lt"><b>Storage</b><small>${esc(storage)}</small></span></div>
    </div>

    <div class="sec-label"><span>Coming soon</span></div>
    <div class="card">
      <div class="list-row faded"><span class="lead">${icon('sync')}</span><span class="lt"><b>Automatic sync</b><small>Phones stay in step without sending files</small></span></div>
      <div class="list-row faded"><span class="lead">${icon('search')}</span><span class="lt"><b>Barcode scanning</b><small>Add and find items with the camera</small></span></div>
    </div>

    <div class="sec-label"><span>Danger zone</span></div>
    <div class="card">
      ${items().some((i) => i.example) ? `<button class="list-row danger press" data-act="remove-examples"><span class="lead bad">${icon('sparkle')}</span><span class="lt"><b>Remove example items</b></span></button>` : ''}
      <button class="list-row danger press" data-act="erase"><span class="lead bad">${icon('trash')}</span><span class="lt"><b>Erase My Pantry from this phone</b></span></button>
    </div>
    <p class="foot">My Pantry ${APP_VERSION} · Your data stays on your phones.</p>`);
}

'use strict';
/* =====================================================================
   My Pantry: sheets, dialog, snackbar
   ===================================================================== */

// Sheets with text fields are drawn once when opened, so a background refresh never wipes what's typed.
const FORM_SHEETS = ['item', 'receive', 'copy', 'locs'];
const TALL_SHEETS = ['item', 'activity', 'receive', 'copy'];

function openSheet(kind, arg) {
  const wasOpen = !!ui.sheet;
  ui.sheet = { kind, arg };
  ui.form = null;
  renderSheet(true);
  const sh = $('#sheet');
  sh.classList.toggle('tall', TALL_SHEETS.includes(kind));
  sh.style.transform = '';
  sh.classList.add('open');
  $('#scrim').classList.add('open');
  $('#sheet-body').scrollTop = 0;
  $('#fab').classList.add('away');
  if (!wasOpen) Nav.push('sheet');
  if (kind === 'item') updatePriceHint();
}
function closeSheet(fromHistory) {
  if (!ui.sheet) return;
  ui.sheet = null;
  ui.form = null;
  const sh = $('#sheet');
  if (document.activeElement && sh.contains(document.activeElement)) document.activeElement.blur();
  sh.classList.remove('open', 'dragging');
  sh.style.transform = '';
  $('#scrim').classList.remove('open');
  $('#scrim').style.opacity = '';
  renderChrome();
  if (!fromHistory) Nav.pop('sheet');
}
function renderSheet(first) {
  const sh = ui.sheet;
  if (!sh || (!first && FORM_SHEETS.includes(sh.kind))) return;
  const html = {
    detail: sheetDetail, item: sheetItem, locs: sheetLocs, activity: sheetActivity, deleted: sheetDeleted,
    receive: sheetReceive, copy: sheetCopy, choose: sheetChoose,
  }[sh.kind](sh.arg);
  if (!ui.sheet) return;
  const body = $('#sheet-body');
  if (first) { body.innerHTML = html; body._html = html; } else setHTML(body, html);
}
const sheetHead = (title, extra = '') =>
  `<div class="sheet-head"><h2>${esc(title)}</h2>${extra}<button type="button" class="icon-btn press" data-act="close" aria-label="Close">${icon('x')}</button></div>`;

/* ---------- item detail ---------- */
function sheetDetail(id) {
  const i = S.items[id];
  if (!i || i.deleted) { closeSheet(); return ''; }
  const [cls, text] = subline(i);
  const l = locOf(i);
  const eid = esc(i.id);
  const st = status(i);
  const value = costOf(i, i.qty);
  const cmp = comparePrice(i);
  const ph = priceHistory(id);
  const hist = log.filter((e) => e.d && e.d.id === id && e.type.startsWith('item.')).slice(-6).reverse();
  const exp = i.exp ? new Date(i.exp + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date';
  let trend = '';
  if (ph.length >= 2) {
    const a = ph[ph.length - 2];
    const b = ph[ph.length - 1];
    if (a.per === b.per && a.amt > 0) {
      const pct = Math.round(((b.amt - a.amt) / a.amt) * 100);
      if (pct) trend = ` <span class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'}${Math.abs(pct)}%</span>`;
    }
  }
  return `
    <div class="sheet-head"><span style="flex:1"></span>
      <button class="icon-btn press" data-act="edit" data-id="${eid}" aria-label="Edit ${esc(i.name)}">${icon('edit')}</button>
      <button class="icon-btn press" data-act="close" aria-label="Close">${icon('x')}</button></div>
    <div class="d-hero"><span class="d-tile" style="background:${tint(i.loc)}">${esc(i.emoji)}</span>
      <div><h2>${esc(i.name)}</h2><p class="${cls}">${esc(text)}${cls ? '' : ` · ${esc(l.icon)} ${esc(l.name)}`}</p></div></div>
    <div class="card qty-card">
      <div style="flex:1;min-width:0">
        <div class="big"><span data-roll>${esc(String(round(i.qty)))}</span><small>${esc(unitText(i.unit, i.qty))}</small></div>
        <div class="meter"><i class="${st}" style="width:${Math.round(level(i) * 100)}%"></i></div>
      </div>
      <span class="stepper lg">
        <button data-act="adj" data-dir="-1" data-id="${eid}" aria-label="Use one">${icon('minus')}</button>
        <button class="plus" data-act="adj" data-dir="1" data-id="${eid}" aria-label="Add one">${icon('plus')}</button>
      </span>
    </div>
    <div class="tiles">
      <div class="tile"><span class="k">${icon('tag')}Price</span><div class="v">${i.price ? esc(priceLabel(i)) + trend : '—'}</div><div class="s">${cmp ? esc(`${money(cmp.v)} per ${cmp.label}`) : i.price ? '' : 'Tap ✎ to add one'}</div></div>
      <div class="tile"><span class="k">${icon('coins')}Worth</span><div class="v">${value != null ? esc(money(value)) : '—'}</div><div class="s">${value == null && i.price ? 'Add a pack size to work it out' : value != null ? 'for what you have' : ''}</div></div>
      <div class="tile"><span class="k">${icon('alert')}Warn below</span><div class="v">${i.min > 0 ? esc(fmtQty(i, i.min)) : 'Never'}</div></div>
      <div class="tile"><span class="k">${icon('clock')}Expires</span><div class="v">${esc(exp)}</div></div>
      ${i.size ? `<div class="tile wide"><span class="k">${icon('jar')}Pack size</span><div class="v">1 ${esc(i.unit)} = ${esc(`${round(i.size.amt)} ${i.size.unit}`)}</div></div>` : ''}
    </div>
    <div class="card" style="margin-top:10px">
      <button class="list-row press" data-act="set-count" data-id="${eid}"><span class="lead">${icon('edit')}</span><span class="lt"><b>Set exact count</b><small>After counting what’s on the shelf</small></span>${CHEV()}</button>
      <button class="list-row press" data-act="to-list" data-id="${eid}"><span class="lead brand">${icon('cart')}</span><span class="lt"><b>Add to shopping list</b></span>${CHEV()}</button>
    </div>
    ${i.notes ? `<div class="sec-label"><span>Notes</span></div><div class="card"><div class="list-row"><span class="lt notes-text">${esc(i.notes)}</span></div></div>` : ''}
    ${ph.length ? `<div class="sec-label"><span>Price history</span></div><div class="card">${ph.slice(-5).reverse().map((p) => `
      <div class="list-row"><span class="lead warm">${icon('tag')}</span><span class="lt"><b>${esc(moneySmart(p.amt))}/${esc(perName(p.per))}</b><small>${esc(nameOf(p.dev))} · ${ago(p.t)}</small></span></div>`).join('')}</div>` : ''}
    <div class="sec-label"><span>History</span></div>
    <div class="card">${hist.map((e) => `
      <div class="list-row"><span class="lt"><b>${esc(describe(e))}</b><small>${esc(nameOf(e.dev))} · ${ago(e.t)}</small></span></div>`).join('')}</div>
    <div class="card" style="margin-top:14px">
      <button class="list-row danger press" data-act="delete" data-id="${eid}"><span class="lead bad">${icon('trash')}</span><span class="lt"><b>Delete item</b></span></button>
    </div>`;
}

/* ---------- add / edit form ---------- */
function emojiButtons() {
  const list = EMOJIS.includes(ui.form.emoji) ? EMOJIS : [ui.form.emoji, ...EMOJIS];
  return list.map((e) => `<button type="button" data-act="emoji" data-e="${esc(e)}" class="${e === ui.form.emoji ? 'on' : ''}" aria-label="Icon ${esc(e)}">${esc(e)}</button>`).join('');
}
function locPick() {
  return activeLocs().map((l) => `<button type="button" class="press${ui.form.loc === l.id ? ' on' : ''}" data-act="form-loc" data-id="${esc(l.id)}">${esc(l.icon)} ${esc(l.name)}</button>`).join('');
}
function sheetItem(id) {
  const i = id ? S.items[id] : null;
  if (!ui.form) ui.form = { emoji: i ? i.emoji : '📦', picked: !!i, loc: i ? i.loc : ui.loc !== 'all' ? ui.loc : (activeLocs()[0] || OTHER).id };
  const cats = [...new Set(items().map((x) => x.cat).filter(Boolean))].sort();
  const unit = i ? i.unit : 'pcs';
  const units = i && !UNITS.includes(i.unit) ? [...UNITS, i.unit] : UNITS;
  const per = i && i.price ? i.price.per : unit;
  const pers = PRICE_PER.some(([k]) => k === per) ? PRICE_PER : [...PRICE_PER, [per, per]];
  const sym = currencySymbol(currency());
  const sizeUnit = i && i.size ? i.size.unit : 'g';
  return `<form id="item-form" data-id="${i ? esc(i.id) : ''}" novalidate autocomplete="off">
    ${sheetHead(i ? 'Edit item' : 'New item')}
    <div class="stack">
      <div class="field"><label for="f-name">Name</label><input class="input" id="f-name" name="name" maxlength="60" placeholder="e.g. Chickpeas" value="${i ? esc(i.name) : ''}" enterkeyhint="next"></div>
      <div class="field"><span class="fl">Icon</span><div class="emoji-row" id="f-emojis">${emojiButtons()}</div></div>
      <div class="field"><span class="fl">Kept in</span><div class="pick" id="f-locs">${locPick()}</div></div>
      <div class="grid2">
        <div class="field"><label for="f-qty">Quantity</label><input class="input" id="f-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" value="${i ? round(i.qty) : 1}"></div>
        <div class="field"><label for="f-unit">Unit</label><select class="input" id="f-unit" name="unit">${units.map((u) => `<option${u === unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
      </div>
      <div class="panel">
        <div class="panel-h">${icon('tag')}Price</div>
        <div class="grid2">
          <div class="field"><label for="f-price">Price</label><div class="affix"><span class="cur">${esc(sym)}</span><input class="input" id="f-price" name="price" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00" style="padding-left:${16 + sym.length * 10}px" value="${i && i.price ? i.price.amt : ''}"></div></div>
          <div class="field"><label for="f-per">Per</label><select class="input" id="f-per" name="per">${pers.map(([k, lbl]) => `<option value="${esc(k)}"${k === per ? ' selected' : ''}>per ${esc(lbl)}</option>`).join('')}</select></div>
        </div>
        <div class="field" id="f-size-field"><label for="f-size">Each ${esc(unit)} holds <span style="font-weight:600;color:var(--ink-3)">(optional)</span></label>
          <div class="grid2">
            <input class="input" id="f-size" name="size" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 400" value="${i && i.size ? i.size.amt : ''}">
            <select class="input" id="f-size-unit" name="sizeUnit">${SIZE_UNITS.map((u) => `<option${u === sizeUnit ? ' selected' : ''}>${u}</option>`).join('')}</select>
          </div>
        </div>
        <p class="hint" id="f-price-hint"></p>
      </div>
      <div class="grid2">
        <div class="field"><label for="f-min">Warn below</label><input class="input" id="f-min" name="min" type="number" min="0" step="any" inputmode="decimal" value="${i ? i.min : 1}"></div>
        <div class="field"><label for="f-exp">Expires</label><input class="input" id="f-exp" name="exp" type="date" value="${i && i.exp ? esc(i.exp) : ''}"></div>
      </div>
      <div class="field"><label for="f-cat">Category</label><input class="input" id="f-cat" name="cat" list="f-cats" maxlength="40" placeholder="Optional, e.g. Dairy" value="${esc(i ? i.cat : '')}"><datalist id="f-cats">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist></div>
      <div class="field"><label for="f-notes">Notes</label><textarea class="input" id="f-notes" name="notes" maxlength="500" placeholder="Brand, size, where to buy…">${esc(i ? i.notes : '')}</textarea></div>
    </div>
    <div class="sheet-foot"><button type="button" class="btn plain press" data-act="close">Cancel</button><button type="submit" class="btn primary press">${i ? 'Save' : 'Add item'}</button></div>
  </form>`;
}

// A throwaway item built from the form, for the live price preview.
function formItem() {
  const f = $('#item-form');
  if (!f) return null;
  const g = (n) => (f.elements[n] ? f.elements[n].value : '');
  const unit = g('unit');
  return {
    unit, qty: Math.max(0, +g('qty') || 0),
    price: g('price') === '' ? null : normPrice({ amt: g('price'), per: g('per') }),
    size: MEASURE[unit] ? null : normSize({ amt: g('size'), unit: g('sizeUnit') }),
  };
}
function updatePriceHint() {
  const t = formItem();
  if (!t) return;
  const container = !MEASURE[t.unit];
  const sizeField = $('#f-size-field');
  sizeField.hidden = !container;
  sizeField.querySelector('label').firstChild.textContent = `Each ${t.unit} holds `;
  const h = $('#f-price-hint');
  if (!t.price) {
    h.className = 'hint';
    h.textContent = 'Optional. With a price you’ll see what your stock is worth and what the shopping will cost.';
    return;
  }
  const c = costOf(t, t.qty);
  const cmp = comparePrice(t);
  if (c == null) {
    h.className = 'hint';
    h.textContent = container
      ? `To use a price per ${perName(t.price.per)}, say how much one ${t.unit} holds.`
      : `A price per ${perName(t.price.per)} doesn’t match ${t.unit}. Pick a matching “per”.`;
    return;
  }
  h.className = 'hint good';
  h.textContent = `Worth ${money(c)} now${cmp ? ` · ${money(cmp.v)} per ${cmp.label}` : ''}`;
}

/* ---------- other sheets ---------- */
function sheetLocs() {
  return sheetHead('Locations') + `
    <div class="card">
      ${activeLocs().map((l) => {
        const n = items().filter((i) => i.loc === l.id).length;
        return `<div class="list-row">
          <button class="lead press" style="background:${tint(l.id)}" data-act="loc-icon" data-id="${esc(l.id)}" aria-label="Change icon for ${esc(l.name)}">${esc(l.icon)}</button>
          <input class="loc-name" data-loc-name="${esc(l.id)}" value="${esc(l.name)}" maxlength="30" aria-label="Location name">
          <span class="lv">${n}</span>
          <button class="icon-btn press" data-act="loc-del" data-id="${esc(l.id)}" aria-label="Remove ${esc(l.name)}">${icon('trash')}</button>
        </div>`;
      }).join('')}
      <button class="list-row press" data-act="loc-add"><span class="lead brand">${icon('plus')}</span><span class="lt"><b style="color:var(--brand)">Add a location</b></span></button>
    </div>
    <p class="foot">Tap a name to rename it, or an icon to change it. A location has to be empty before you can remove it.</p>`;
}

function sheetActivity() {
  const rows = [];
  for (let k = log.length - 1; k >= 0 && rows.length < 200; k--) {
    const text = describe(log[k]);
    if (text) rows.push(`<div class="list-row"><span class="lt"><b>${esc(text)}</b><small>${esc(nameOf(log[k].dev))} · ${ago(log[k].t)}</small></span></div>`);
  }
  return sheetHead('Activity') + `<div class="card">${rows.join('') || '<p class="empty-sm">Nothing yet</p>'}</div>`;
}

function sheetDeleted() {
  const list = deletedItems().sort((a, b) => b.deleted - a.deleted);
  return sheetHead('Recently deleted') + `
    <div class="card">${list.map((i) => `
      <div class="list-row"><span class="lead" style="background:${tint(i.loc)}">${esc(i.emoji)}</span>
        <span class="lt"><b>${esc(i.name)}</b><small>Deleted ${ago(i.deleted)} on ${esc(nameOf(i.by))}</small></span>
        <button class="text-btn press" data-act="restore" data-id="${esc(i.id)}">Restore</button></div>`).join('') || '<p class="empty-sm">Nothing deleted in the last 30 days</p>'}</div>`;
}

function sheetReceive() {
  const joining = !S.pantryId;
  return sheetHead(joining ? 'Join a pantry' : 'Receive') + `
    <div class="stack">
      <button class="btn primary press" data-act="pick-file">${icon('download')}Choose the file</button>
      <p class="hint">${joining
        ? 'On your main phone, open Sync and tap <b>Send</b>. Send the file to this phone (WhatsApp, Quick Share or email), then choose it here.'
        : 'The .json file from your other phone, or a backup. Nothing on this phone is deleted. Only changes it doesn’t have are added.'}</p>
      <div class="field"><label for="paste-in">Or paste the text</label><textarea class="input code" id="paste-in" placeholder="Paste copied My Pantry text here" spellcheck="false"></textarea></div>
      <button class="btn tonal press" data-act="paste-load">Load pasted text</button>
    </div>`;
}

function sheetCopy(arg) {
  return sheetHead('Copy instead') + `
    <div class="stack">
      <p class="hint">Files can’t be saved here, so copy this text instead. ${arg.kind === 'sync'
        ? 'Paste it into a message to your other phone. There, open Sync → Receive and paste it.'
        : 'Paste it into a note or a message to yourself, and keep it safe.'}</p>
      <textarea class="input code" id="copy-out" readonly spellcheck="false">${esc(arg.text)}</textarea>
      <button class="btn primary press" data-act="copy-text">Copy text</button>
    </div>`;
}

// arg: { title, act, current, options: [[value, label, sub]] }
function sheetChoose(arg) {
  return sheetHead(arg.title) + `
    <div class="card">${arg.options.map(([v, label, sub]) => `
      <button class="list-row press" data-act="choose" data-v="${esc(v)}">
        <span class="lt"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
        ${String(v) === String(arg.current) ? `<span class="lead brand" style="width:30px;height:30px;border-radius:10px">${icon('check')}</span>` : ''}
      </button>`).join('')}</div>`;
}

/* ---------- dialog (in place of confirm/prompt) ---------- */
let dialogResolve = null;
function ask({ title, text = '', input = null, ok = 'OK', cancel = 'Cancel', danger = false }) {
  if (dialogResolve) closeDialog(false);
  return new Promise((resolve) => {
    dialogResolve = resolve;
    const field = input
      ? `<input class="input" id="dlg-in" type="${input.type === 'number' ? 'number' : 'text'}"${input.type === 'number' ? ' inputmode="decimal" step="any" min="0"' : ' maxlength="30"'} value="${esc(input.value == null ? '' : input.value)}" aria-label="${esc(title)}">`
      : '';
    $('#dialog-body').innerHTML = `
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${field}
      <div class="btns"><button class="press" data-act="dlg-cancel">${esc(cancel)}</button><button class="press${danger ? ' danger' : ''}" data-act="dlg-ok">${esc(ok)}</button></div>`;
    $('#dialog').hidden = false;
    Nav.push('dialog');
    const inp = $('#dlg-in');
    if (inp) { inp.focus(); inp.select(); } else $('[data-act="dlg-ok"]').focus();
  });
}
function closeDialog(ok, fromHistory) {
  if (!dialogResolve) return;
  const inp = $('#dlg-in');
  const value = ok ? (inp ? inp.value : true) : null;
  $('#dialog').hidden = true;
  $('#dialog-body').innerHTML = '';
  const r = dialogResolve;
  dialogResolve = null;
  if (!fromHistory) Nav.pop('dialog');
  r(value);
}

/* ---------- snackbar (with optional Undo) ---------- */
let snackTimer = 0;
let snackFn = null;
function snack(msg, action, fn) {
  const el = $('#snack');
  $('#snack-text').textContent = msg;
  const b = $('#snack-act');
  b.hidden = !action;
  b.textContent = action || '';
  snackFn = fn || null;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  document.body.classList.add('snack-up');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, action ? 5000 : 2200 + String(msg).length * 30);
}
function hideSnack() {
  $('#snack').classList.remove('show');
  document.body.classList.remove('snack-up');
  snackFn = null;
}
const toast = (msg) => snack(msg);

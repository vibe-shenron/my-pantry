'use strict';
/* =====================================================================
   My Pantry: automatic sync through a secret GitHub gist.
   Each phone keeps one file in the gist holding its whole log, compressed and
   encrypted on the phone (AES-GCM) with a key GitHub never sees. A sync reads
   every other phone's file, merges it, then rewrites this phone's own file.
   A phone only ever writes its own file, so phones never overwrite each other.
   ===================================================================== */

let GH_API = 'https://api.github.com';
const TOKEN_PAGE = 'https://github.com/settings/tokens/new?scopes=gist&description=My%20Pantry%20sync';

const asOn = () => !!(meta && meta.as && meta.as.on && S.pantryId);
const myFile = () => `phone-${meta.deviceId}.json`;

/* ---------- encryption ---------- */
function b64(bytes) {
  const u = new Uint8Array(bytes);
  let s = '';
  for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000));
  return btoa(s);
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const pipeBytes = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
async function newKey() {
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return b64(await crypto.subtle.exportKey('raw', k));
}
const keyCache = {};
function aesKey(raw) {
  if (!keyCache[raw]) keyCache[raw] = crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return keyCache[raw];
}
async function seal(obj, raw) {
  let bytes = new TextEncoder().encode(JSON.stringify(obj));
  let z = 0;
  if (typeof CompressionStream === 'function') { bytes = await pipeBytes(bytes, new CompressionStream('gzip')); z = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw), bytes);
  return JSON.stringify({ app: APP, v: 1, z, iv: b64(iv), data: b64(data) });
}
async function unseal(text, raw) {
  const o = JSON.parse(text);
  if (!o || o.app !== APP) throw new Error('not a My Pantry sync file');
  let bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, await aesKey(raw), unb64(o.data)));
  if (o.z) bytes = await pipeBytes(bytes, new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* ---------- GitHub ---------- */
function gh(method, path, token, body) {
  return fetch(GH_API + path, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const cloudPayload = () => ({ pantryId: S.pantryId, from: { dev: meta.deviceId, name: myName() }, at: Date.now(), events: log });

// First-time setup on one phone: check the key by creating the secret gist with this phone's file in it.
async function connectAutosync(token) {
  token = String(token || '').trim();
  if (!token) return { ok: false, msg: 'Paste the key from GitHub first.' };
  if (!navigator.onLine) return { ok: false, msg: 'Connect to the internet first.' };
  const key = await newKey();
  let res;
  try {
    res = await gh('POST', '/gists', token, {
      description: 'My Pantry sync (encrypted, managed by the app)',
      public: false,
      files: { [myFile()]: { content: await seal(cloudPayload(), key) } },
    });
  } catch (e) { return { ok: false, msg: 'Couldn’t reach GitHub. Check your connection and try again.' }; }
  if (res.status === 401) return { ok: false, msg: 'GitHub didn’t accept that key. Copy it again, all of it.' };
  if (res.status === 403 || res.status === 404) return { ok: false, msg: 'That key isn’t allowed to make gists. Create a new one with the “gist” box ticked.' };
  if (!res.ok) return { ok: false, msg: `GitHub couldn’t do it right now (error ${res.status}). Try again in a minute.` };
  const g = await res.json();
  meta.as = { on: true, gist: g.id, token, key, pushedLen: log.length, last: Date.now(), err: null };
  meta.lastSentAt = Math.max(Date.now(), S.clock);
  persist();
  return { ok: true };
}

// Take over the sync settings carried inside a sync file from another phone.
function adoptAutosync(cfg) {
  if (!cfg || typeof cfg.gist !== 'string' || typeof cfg.token !== 'string' || typeof cfg.key !== 'string') return false;
  meta.as = { on: true, gist: cfg.gist, token: cfg.token, key: cfg.key, pushedLen: -1, last: 0, err: null };
  return true;
}

/* ---------- syncing ---------- */
let syncRun = null;
let syncAgain = false;
let pushTimer = 0;
// Download the other phones' changes, merge them, and upload this phone's log if it changed.
// Resolves { added, from } after a sync, or null when it couldn't run (offline, key problem).
function autoSync() {
  if (!asOn() || !navigator.onLine) return Promise.resolve(null);
  if (syncRun) { syncAgain = true; return syncRun; }
  syncRun = (async () => {
    const as = meta.as;
    const fail = (err) => { as.err = err; persist(); render(); return null; };
    let res;
    try { res = await gh('GET', '/gists/' + as.gist, as.token); } catch (e) { return null; }
    if (res.status === 401) return fail('auth');
    if (res.status === 404) return fail('gone');
    if (!res.ok) return null;
    const g = await res.json();
    const files = g.files || {};
    let added = 0;
    const from = new Set();
    for (const [name, f] of Object.entries(files)) {
      if (name === myFile() || !/^phone-.+\.json$/.test(name)) continue;
      try {
        const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
        const p = await unseal(text, as.key);
        if (p.pantryId !== S.pantryId || !Array.isArray(p.events)) continue;
        const n = merge(p.events);
        if (n) { added += n; if (p.from && p.from.name) from.add(String(p.from.name)); }
      } catch (e) { console.warn('My Pantry: skipped a sync file', name, e); }
    }
    if (log.length !== as.pushedLen || !files[myFile()]) {
      const len = log.length;
      let put = null;
      try { put = await gh('PATCH', '/gists/' + as.gist, as.token, { files: { [myFile()]: { content: await seal(cloudPayload(), as.key) } } }); } catch (e) { /* try next time */ }
      if (put && put.status === 401) return fail('auth');
      if (put && put.ok) { as.pushedLen = len; meta.lastSentAt = Math.max(Date.now(), S.clock); }
    }
    as.last = Date.now();
    as.err = null;
    persist();
    render();
    return { added, from: [...from] };
  })().finally(() => {
    syncRun = null;
    if (syncAgain) { syncAgain = false; setTimeout(autoSync, 400); }
  });
  return syncRun;
}
// After a change on this phone, upload it a moment later (quick runs of changes go up together).
function queueAutoSync() {
  if (!asOn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(autoSync, 2500);
}
function reportSync(r, quiet) {
  if (r && r.added) snack(`Synced · ${r.added} change${r.added === 1 ? '' : 's'}${r.from.length ? ' from ' + r.from.join(', ') : ''}`);
  else if (!quiet) snack(r ? 'Everything is up to date' : navigator.onLine ? 'Couldn’t sync right now' : 'You’re offline. It will sync when you’re back online.');
}

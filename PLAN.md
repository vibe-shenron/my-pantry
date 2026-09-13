# My Pantry: plan

A household inventory app. It's web-based (HTML), so it runs on Android and iPhone from one codebase.
Your **main phone** holds the master copy. Other phones sync with it and catch up.

**Status (2026-09-13):** the first build is done as a single file, [index.html](index.html). It installs to the home screen and opens offline. It's live as a private Claude page until GitHub hosting is set up: https://claude.ai/code/artifact/cb119456-40c9-45b7-a41b-7a9f701f7559 Phones sync by file for now. The original UI samples are in [ui-samples/](ui-samples/index.html).

### What's in the single-file build
- Everything in v1 (§2): items, +/−, locations, search and filters, low stock, use soon, shopping list and restock, activity, recently deleted, backup and restore.
- **Sync by file** (from §4.3): *Send to another phone* makes a file, and *Receive* on the other phone merges it. It uses the same event log and merge rules as §4.4–4.5, so nothing needs redoing when automatic sync arrives.
- Example items you can remove with one tap; a first-launch choice between *Start a new pantry* and *Join from another phone*; "Make this the main phone".
- Follows the phone's light/dark setting.

### Next: GitHub hosting (right after the first build)
1. ✅ GitHub account created (2026-09-14). GitHub CLI installed. **Next: sign in on this computer with `gh auth login`.**
2. ✅ The app is now `index.html`, in a local Git repository. Still to do: create the `my-pantry` repository on GitHub, push, and switch on GitHub Pages.
3. ✅ Manifest, service worker and icons added. Tested locally: Chrome reports it installable, and it opens offline.
4. Add automatic phone-to-phone sync (Option A, PeerJS).
5. **Moving your data:** in the current version, go to Sync → *Save a backup file*. In the GitHub version, choose *Join from another phone* and open that file. Everything comes across.

### Decisions so far (2026-09-13)

| Topic | Decision |
|---|---|
| UI style | **B: Clean List** ([ui-samples/b-clean-list.html](ui-samples/b-clean-list.html)) |
| Phones | Both are **Android** today, but the app must also work on **iPhone** (either can be main or second) |
| Sync | Option A (direct phone-to-phone), because it's the only option that works for every Android/iPhone combination (§4.3) |
| Barcode scanning | **Deferred.** Stays in v3, to revisit later |
| Hosting | GitHub Pages, **deferred until after the first build**. Needs a free GitHub account (§5). Until then: a single file, published as a private Claude page |

---

## 1. Goals

- Know what's in the house without opening every cupboard.
- Never run out of the basics. Anything that drops below its level goes on the shopping list by itself.
- Use food before it expires.
- One app for Android and iPhone, installed to the home screen like a normal app.
- Works offline. Data stays on your phones: no laptop, no always-on computer, no account, no cloud copy.

---

## 2. Features

### v1: core (one phone)

| Feature | What it does |
|---|---|
| Items | Name, emoji icon, location, category, quantity and unit, low-stock level, expiry date (optional), notes |
| Quick +/− | One tap to log "used one" or "added one" |
| Locations | Pantry, Fridge, Freezer, Bathroom, Cleaning. Rename them or add your own |
| Search and filters | By name or category, by location, "running low", "use soon" |
| Low stock | When an item drops below its level it's flagged and added to the shopping list automatically |
| Use soon | Items expiring within 7 days (you can change this) are flagged on Home |
| Shopping list | Automatic items plus your own extras. Tick them off while shopping, then **Restock** adds the bought amounts back to the inventory in one go |
| Activity history | Who changed what, from which phone, and when |
| Backup | Export everything to one file, and restore from it |
| Install and offline | Add to the home screen, opens instantly, works without signal |

### v2: sync (two or more phones)

- Pair a phone by scanning a QR code shown on the main phone.
- The new phone downloads a full copy, then catches up whenever both apps are open.
- Changes made offline on either phone are merged (§4.5).
- A devices screen shows paired phones and when each was last seen. You can remove a phone.
- A sync indicator is always on screen: *synced*, *changes waiting*, or *main phone not reachable*.
- "Make this the main phone", for when the main phone is lost or replaced.

### v3: nice to have

- Barcode scanning to add or find items with the camera
- Item photos
- Usage insights ("you go through milk every 5 days") and smarter suggested quantities
- Recurring shopping items
- Expiry reminders (see the limit in §4.7)

---

## 3. UI

### Navigation

Style B: the app opens straight on the inventory list, with **+** in the top bar to add an item.
Tabs: **Inventory · Shopping · Sync**. There's no separate Home screen. The "needs attention" banner at the top of the list does that job.
A sync status line sits in the top bar on every screen.

### Screens

1. **Inventory**: search, location tabs, a "needs attention" banner (low, out, or expiring soon; tap it to filter), and items grouped by location, each with +/− buttons.
2. **Activity**: who changed what, from which phone. Reached from the Sync tab (not in the sample yet).
3. **Item detail** (a bottom sheet): quantity, low-stock level, expiry, and the last change and which phone made it. Edit or delete from here.
4. **Add item**: name, icon, location, quantity and unit, low-stock level, expiry. Barcode scanning comes in v3.
5. **Shopping**: the automatic list plus extras. Tick items off, then Restock.
6. **Sync**: this phone's role, sync status, paired phones, pairing a new phone (QR), backup and restore.
7. **First launch** (not in the samples): *Start a new pantry* (this phone becomes the main phone) or *Join a pantry* (scan the main phone's QR).

### Three sample directions

Open `ui-samples/index.html`. Everything in the samples works: +/−, search, filters, item sheets, adding items, ticking the shopping list and restocking, Sync now, and the pairing QR. Nothing is saved.

| | **A: Pantry Shelf** | **B: Clean List** | **C: Dashboard** |
|---|---|---|---|
| Feel | Warm and homey, a grid of cards | Looks like a built-in phone app, minimal | Dark, big numbers, stock meters |
| Best at | Browsing visually | Speed: most items per screen | Seeing stock levels at a glance |
| Home | Summary plus a "running low" shelf | None; opens on the list | Stats and location tiles |
| Dark mode | Not yet (can add) | Follows the phone setting | Always dark |

**Chosen: B.** A and C are kept for reference only.

---

## 4. Sync: the main phone as the server

### 4.1 The catch

**A web page can't be a server.** Browsers don't let pages accept incoming connections, and both Android and iOS pause apps that aren't on screen. Even a native iPhone app can't run as a 24/7 server. On Android it's only possible with workarounds.

So the design isn't "the main phone is a server that's always on". Instead:

> **Every phone keeps a full copy, the main phone has the final say, and phones sync whenever they can reach each other.**

In practice, you open the app on the second phone, it connects to the main phone, sends its changes and catches up in a couple of seconds. You can use either phone on its own at any time. Being offline never blocks anything.

### 4.2 Roles

- **Main phone:** holds the master copy, decides the final order of changes, and is where phones are paired and removed.
- **Other phones:** each holds a full copy and works offline. It queues its own changes, sends them to the main phone at the next sync, and receives everything it missed.

### 4.3 How the phones reach each other

**Option A: direct phone-to-phone (recommended)**

- The app's files are hosted on **GitHub Pages** (free). This is only where the app gets downloaded from, like an app store listing. It stores no data and there's nothing for you to keep running. It's needed because Android and iPhone only let you install a web app to the home screen from an HTTPS address. GitHub Pages is free for a public repository (the code is public, never your data). Netlify or Cloudflare Pages work too and allow a private repository.
- The phones connect **directly** using WebRTC (the same technology video-call apps use). The connection is encrypted end to end.
- To find each other, the phones use a free public "introduction" service (**PeerJS**). It only passes the connection handshake, never your inventory.
- Works on Android and iPhone, and either one can be the main phone.
- **Limits:** both apps must be open at the same time to sync. On the same Wi-Fi it's reliable. On mobile data it usually works, but some networks block direct connections. In that case the phone waits until you're on Wi-Fi, or we add a relay (TURN). A relay only forwards the encrypted data and can't read it.

**Option B: a real server on an Android main phone (Termux)**

- The main phone runs a small server inside Termux, so the second phone can sync even when the main phone's app is closed.
- The main phone must be Android. Android's battery saver still kills the server unless you turn off battery optimisation for it. Installing the web app needs HTTPS, which is awkward from a phone on home Wi-Fi. Syncing away from home would need Tailscale on both phones.
- More setup and more things that can break. Only worth it if Option A's "both apps open" limit bothers you in practice.

**Option C: a cloud mailbox (Firebase or Supabase free tier)**

- Syncs any time, even when the main phone is off. Least hassle.
- But your data sits in a cloud account, which is what you wanted to avoid. Kept as a fallback only.

**Always available: sync by file**

- Export a sync file on one phone, send it by Quick Share, AirDrop or WhatsApp, and import it on the other. No network needed. It's the same format as the backup file.

**Recommendation: build Option A, with file sync as the fallback.** The sync engine (§4.4) doesn't care how the data travels, so moving to B or adding C later won't touch the rest of the app.

### 4.3a Android and iPhone

Which options work for each combination of phones:

| Setup | A: direct phone-to-phone | B: Termux server | C: cloud mailbox | File sync |
|---|---|---|---|---|
| Android main + Android second (**you, today**) | ✅ | ✅ | ✅ | ✅ |
| Android main + iPhone second | ✅ | ⚠️ The iPhone can only install the app if the server has HTTPS, which means Tailscale on both phones | ✅ | ✅ (share the file by WhatsApp or email; AirDrop doesn't work with Android) |
| iPhone main + either | ✅ | ❌ an iPhone can't run a server | ✅ | ✅ |

**Option A is the only transport that works for every combination**, so it stays the choice. If an iPhone joins later, nothing needs rebuilding.

How it differs on each platform:

| | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Installing | Chrome offers **Install app**, or ⋮ → *Add to Home screen* | Safari → Share → **Add to Home Screen** (no automatic prompt; the app will show a one-time hint) |
| Must use browser | Chrome (Samsung Internet also works) | Safari (iOS 16.4+ also allows installing from other browsers) |
| Data safety | Stable once installed, and the app asks for persistent storage | Data can be cleared for sites not opened in 7 days. **Installing to the Home Screen exempts it**, so installing is required on iPhone |
| Sync (WebRTC) | ✅ | ✅ |
| While the app is closed | No sync (true for any option except B) | No sync |
| Notifications | Possible later, but needs a push server (out of scope) | Same; needs iOS 16.4+ and a push server |
| Barcode (later) | Built-in camera barcode reader | Needs a small JavaScript library (Safari has no built-in reader) |
| "Real app" package (optional, later) | The same web app can be wrapped as an APK (e.g. with PWABuilder) and installed without the Play Store | Needs an Apple developer account ($99/yr). Not worth it: Add to Home Screen does the job |

One codebase serves both. The only iPhone-specific work is the install hint and testing in Safari.

### 4.4 Sync engine

Every change is saved as a small **event**, not just as the new value:

```json
{ "id": "…", "device": "phone-2", "seq": 57, "time": "…", "type": "item.adjust", "item": "milk", "delta": -1 }
```

- Each phone stores the event log plus the current state built from it, in the browser's IndexedDB.
- Other phones also keep a queue of events the main phone hasn't confirmed yet.

**A sync, step by step:**

1. The second phone connects and sends its ID, its pairing token, the last main-phone number it saw (`lastSeq`) and its queued events.
2. The main phone checks the token, applies the queued events and numbers them in its log.
3. The main phone replies with every event after `lastSeq`. That includes the ones it just accepted, now in their final order.
4. The second phone replays them, clears its queue and stores the new `lastSeq`. Done.
5. While both apps stay open, each new change is sent immediately (live sync).

Pairing a new phone means sending a full snapshot plus `lastSeq`. Old events that every phone has confirmed get folded into a snapshot, so the log doesn't grow forever.

### 4.5 When both phones changed the same thing

- **Quantities are stored as changes** ("used 1", "added 3"), not totals. If both phones each log using one milk while offline, the result after syncing is −2, not −1. For an inventory app this is the most important rule.
- A **"set"** ("I counted: 4") overrides changes made before it. Changes made after it apply on top.
- **Other fields** (name, expiry, location): the newest edit wins, and the main phone breaks ties.
- **Delete vs edit:** delete wins, but the item stays in *Recently deleted* for 30 days.
- **Shopping ticks** merge per item.

### 4.6 Security and safety

- **Pairing:** the QR code on the main phone holds its connection ID and a one-time secret (it expires in 10 minutes). The new phone gets a long-term token, which the main phone can revoke.
- **Data** lives on your phones only. The introduction service sees two random IDs and nothing else.
- **Storage:** browsers can clear website data. The app asks for persistent storage and should be installed to the home screen. This matters most on iPhone, where Safari can clear data for sites you haven't opened in 7 days (home-screen web apps are exempt). There's also a weekly backup reminder, and the second phone is itself a live backup.
- **Main phone lost or broken:** on the second phone, choose *Make this the main phone*. It already has everything.

### 4.7 Known limits

- Expiry reminders as real push notifications would need a push server, which is out of scope. Instead, v1 shows them on Home when you open the app.
- With Option A, nothing syncs while both apps are closed. It catches up the next time they're both open.

---

## 5. Tech

- Plain **HTML, CSS and JavaScript**: no framework, no build step.
- **IndexedDB** for storage, a **service worker** for offline use, and a **web app manifest** for installing.
- **PeerJS** (WebRTC) for sync, and a QR library for pairing (later also for barcodes).
- Hosted on **GitHub Pages** (or Netlify or Cloudflare Pages).
- Test on Android (Chrome) and iPhone (Safari) early. iOS is the stricter of the two.

### Hosting setup: you'll need a free GitHub account

- **Yes, a free GitHub account is needed** (github.com → Sign up, about 5 minutes). It's where the app's files live and where your phones download it from. It also keeps every version of the code, so nothing gets lost.
- The repository has to be **public** on the free plan. That means the *code* is visible to anyone who looks, never your *pantry data*, which stays on your phones.
- After you sign up, I do the rest from here: create the repository, upload the files, turn on Pages. You log in once, with `gh auth login` in the terminal. Your app's address will look like `https://<your-username>.github.io/my-pantry/`.
- Alternatives (Cloudflare Pages, Netlify) also need a free account. They allow a private repository. There's no permanent no-account option, because the phones need an HTTPS address to install the app from.

Proposed structure:

```
my-pantry/
  index.html
  manifest.webmanifest
  sw.js                service worker (offline + install)
  css/app.css
  js/db.js             IndexedDB + event log
  js/store.js          state built from events; low-stock and expiry rules
  js/sync.js           pairing, PeerJS transport, sync protocol
  js/ui/*.js           one file per screen
  icons/
```

---

## 6. Build order

0. **Setup:** you create a GitHub account. I create the repository and hosting, and turn sample B into the real app's layout.
1. **Phase 1, one phone:** storage and event log, adding/editing items, locations, +/−, search and filters, low stock, use soon, shopping list and restock, backup export/import, offline and install. Use it on your main phone for a week.
2. **Phase 2, sync:** pairing QR, direct connection, the sync protocol, the devices screen, the file-sync fallback, and "make this the main phone". Test with both Android phones: on the same Wi-Fi, on mobile data, and with one phone offline for a day. If an iPhone is available, do a quick Safari check too.
3. **Phase 3, extras:** barcode scanning (deferred, to revisit), photos, usage insights.

---

## 7. Questions for you

Answered: phones (both Android, iPhone supported too), UI (B), barcode (deferred), hosting (GitHub; account needed).

Still open:

1. **GitHub account:** create one when you're ready and tell me the username.
2. **Public repository OK?** The code is visible, your data never is. If not, we use Cloudflare Pages with a private repository.
3. **PeerJS introduction service OK?** It only sees two random IDs, never your data.
4. **Prices and spending:** do you want to track them? That isn't planned right now.
5. **Units:** metric (kg, L) is assumed. Is that right?
6. **Starting locations:** are Pantry, Fridge, Freezer, Bathroom and Cleaning right? You can change them in the app anyway.

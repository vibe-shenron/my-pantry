# My Pantry

A household inventory app that runs in the browser and installs to your phone's home screen. It works on Android and iPhone.

- Items grouped by location, with quick +/− buttons
- Anything running low goes on the shopping list by itself; **Restock** adds it back in one tap
- Warnings for food that expires soon
- Prices per kg, 100 g, litre, piece, dozen, pack, can, bottle and more, with an optional pack size
  ("1 tin = 400 g"). From these it works out what your stock is worth, the estimated shopping total,
  a comparable price per kg or litre, price changes over time, and what you've spent restocking this month
- Works offline. Your data stays on your phones: nothing is uploaded, and there's no account

## Using it

Open the app's web address in Chrome (Android) or Safari (iPhone), then add it to the home screen:

- **Android:** Chrome menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone:** Share → *Add to Home Screen*

## Syncing two phones

The first phone to start a pantry is the **main phone**. To add another phone:

1. On the new phone, choose **Join from another phone**.
2. On the main phone, go to **Sync → Send to another phone** and send the file (WhatsApp, Quick Share, email).
3. On the new phone, choose that file.

After that, send a file either way whenever you want the phones to match. Changes made on both phones are combined, not overwritten.

## Project

- `index.html`: the app shell
- `css/app.css`: the look (palette, type, motion)
- `js/core.js`: storage, the event log, pricing maths, sync files
- `js/ui.js`: the screens, drawn by patching the page in place so changes animate
- `js/sheets.js`: pop-up sheets, dialogs and the Undo bar
- `js/app.js`: actions, the back button, gestures, install and startup
- `fonts/`: Figtree and Bricolage Grotesque, stored locally so the app works offline
- `manifest.webmanifest`, `sw.js`, `icons/`: installing and offline support. **Bump `VERSION` in `sw.js` on every release**
  so installed phones pick up the new version.
- `PLAN.md`: features, design decisions and roadmap
- `ui-samples/`: the three UI directions considered (style B was chosen)

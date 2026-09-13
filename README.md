# My Pantry

A household inventory app that runs in the browser and installs to your phone's home screen. It works on Android and iPhone.

- Items grouped by location, with quick +/− buttons
- Anything running low goes on the shopping list by itself; **Restock** adds it back in one tap
- Warnings for food that expires soon
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

- `index.html`: the whole app (HTML, CSS and JavaScript in one file)
- `manifest.webmanifest`, `sw.js`, `icons/`: installing and offline support
- `PLAN.md`: features, design decisions and roadmap
- `ui-samples/`: the three UI directions considered (style B was chosen)

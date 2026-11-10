# Daymark

A responsive daily, weekly and 365-day progress tracker inspired by the supplied paper planner.

## Use it

Open `index.html` in a browser, or serve this folder over HTTPS to use the installable app and browser reminders. The tracker includes daily priorities, five 0–10 ratings, routine check-ins, water tracking, reflection, attachments, weekly averages and a 365-day overview.

## Publish with GitHub Pages

1. Create a GitHub repository and add these site files to its `main` branch.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the publishing source.
3. The included workflow publishes the site on every push to `main`. GitHub will show the public address in **Settings → Pages** after the first successful run.

## Saved data and reminders

- Ratings, notes and check-ins are saved in the current browser on the current device.
- Attachments are stored in that browser's local file database and are not included in the JSON export. Keep originals if you need them elsewhere.
- Use **Export data** and **Import backup** to transfer your tracker entries between devices.
- A browser reminder can show while the app is open on this device. It is not a server-scheduled push notification.
- The WhatsApp button opens a prefilled reminder draft. Automatic WhatsApp delivery requires a WhatsApp Business sender, a server-side integration, and the recipient's number.
- Cross-device live syncing needs secure sign-in and a cloud database. This static GitHub Pages build does not transmit personal tracker data.

## Files

- `index.html`, `styles.css`, `app.js` — the site
- `manifest.webmanifest`, `icon.svg`, `sw.js` — install and offline support
- `.github/workflows/pages.yml` — GitHub Pages publishing workflow


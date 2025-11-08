# Commission Tracker PWA (Mobile-First)

- Offline PWA (Install to Home Screen)
- Stores data on device (IndexedDB)
- Tabs: Add / Daily / Monthly Report
- Exports: CSV + **Excel (XLS — SpreadsheetML)**
- Daily reminder 22:00 (in-app) + Calendar `.ics` file

## Deploy on GitHub Pages (All on Phone)
1. Install **GitHub** mobile app → sign in.
2. Create **New repository** → Name: `commission-tracker` (Public).
3. In the repo, tap **Add file → Upload files** → upload all files from this zip **to root** (no subfolder).
4. Open **Settings → Pages** → *Build and deployment* → **Source: Deploy from a branch** → Branch: **main**, Folder: **/(root)** → Save.
5. After a minute, open the **Pages URL** shown.
6. In the browser menu → **Add to Home screen**.
7. First load online once (to cache); later it works offline.

## Using
- Add your contracts in **Add** tab → press **ثبت**.
- **Daily** tab shows the list and total for chosen day.
- **Report** tab: choose month → chart + total; buttons: **CSV** / **Excel (XLS)**.
- **Enable daily reminder 22:00** in Add tab or add calendar `.ics` reminder.

## Notes
- If the Pages URL shows old content, do a hard refresh.
- XLS export is SpreadsheetML `.xls` (opens in Excel, Numbers, Google Sheets).
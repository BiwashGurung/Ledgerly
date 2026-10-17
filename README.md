# Ledgerly

**Personal finance, with clarity.**

Ledgerly is a local-first personal finance and budgeting application. Financial records stay in the browser; no account, backend, remote AI, or financial institution connection is required.

## What is included

- Transaction entry, editing, deletion, search, filtering, and CSV export.
- Monthly overview, income and expense summaries, category trends, budget progress, and cash-flow estimates.
- Category and all-category budgets, threshold notices, and optional positive-balance rollover.
- Savings goals with dated contributions and withdrawals.
- Recurring reminders and locally parsed, editable natural-language reminder drafts.
- No-spend challenges evaluated from recorded expenses.
- Versioned JSON backup/restore, merge and replacement, and encrypted portable transfer files.
- Optional PIN lock using PBKDF2 and AES-GCM encryption at rest.
- Responsive application shell, install metadata, and a service worker for the app shell and same-origin assets.

The app starts empty. It does not create sample transactions or balances.

## Requirements

- Node.js 20.19+ or 22.12+ (Vite 6 compatible runtime).
- npm.

## Install and develop

```bash
npm install
npm run dev
```

Vite prints the local URL. The data is saved in that browser profile and origin.

## Build and preview

```bash
npm test
npm run build
npm run preview
```

The static build is generated in `dist/`. Deploy that directory to static hosting. Configure the host to serve `index.html` for application navigation routes if routes are added later. The current application uses in-page navigation and does not need rewrite rules.

## PWA and offline behavior

The app includes a manifest, square SVG branding, and a versioned service worker. Production installation and service workers generally require HTTPS; localhost is suitable for development. After an initial successful online visit, the worker caches the app shell and same-origin HTML, scripts, styles, and images as they are requested. Private financial records are stored by Ledgerly in local storage, not in the service-worker cache.

The current worker was not verified here in a production browser with the network disconnected. Confirm installability and offline reopening on your chosen deployment origin. Browser notifications are best effort and may not run while the application is fully closed or offline. In-app reminders remain available when the app opens.

## Local storage and backups

- Data belongs to a browser profile and website origin. Clearing site data may delete it.
- Use **Settings → Backup and transfer → Export JSON** to make a versioned snapshot.
- Restore validates the package, then offers merge or replacement. Merge keeps current values for matching IDs and appends records with new IDs. Replacement requires an additional confirmation.
- CSV export contains transaction IDs, dates, descriptions, types, amounts, categories, payment methods, and notes. CSV amounts use the selected display currency's decimal precision.
- Create regular backups, especially before enabling the privacy lock.

## Cross-device transfer

The encrypted transfer feature creates a portable JSON snapshot protected with a separate passphrase using PBKDF2 and AES-GCM. Move the file to the other device and enter the passphrase when importing it. The passphrase is not saved in Ledgerly. This is manual transfer, not automatic synchronization; transfer a new snapshot to move later changes.

## Privacy lock

The optional PIN lock encrypts the stored application state using PBKDF2-SHA-256 (310,000 iterations) and AES-256-GCM. Every save creates a fresh IV. The raw PIN is not stored. Choose a strong PIN and keep a backup before enabling it. A forgotten PIN cannot be reset by Ledgerly, and the browser's local encryption is not absolute protection from a compromised device or malicious script while the app is unlocked.

## Currency

NPR is the default. USD, GBP, EUR, INR, and AUD are also available. Choosing a currency changes display formatting only; Ledgerly does not convert amounts or use exchange-rate data. Keep one currency consistent across the records in a profile.

## Reminder behavior

Natural-language reminder parsing is local and produces a draft that must be reviewed and saved. Interpretations can be incomplete, so check the date, time, recurrence, and amount. Browser notifications require permission and are best effort. A browser app without a push server cannot guarantee exact-time delivery while completely closed and offline.

## Data model notes

Amounts are stored as integer minor units using the selected currency's standard fraction digits. Income and expenses are the only transaction types. Goal contributions and withdrawals are internal allocations: they adjust available funds but are not ordinary income or spending. Budget rollover carries only positive prior-month remainder; overspending is not carried into the next month. Forecasts use the current month's recorded daily pace and are estimates, not predictions.

## Deployment checklist

1. Run `npm test` and `npm run build`.
2. Deploy `dist/` to an HTTPS static host.
3. Open the deployed site while online and allow the service worker to install and cache assets.
4. Verify installation, refresh, offline reopening, and local record creation in a production browser.
5. Make regular JSON backups. Do not claim offline behavior is verified until step 4 succeeds on the target host.

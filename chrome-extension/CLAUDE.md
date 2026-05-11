# Chrome Extension — Smart Products Hub

Claude / Claude Code instructions for the Chrome extension at:

```text
K:\ClaudeProjects\Octopus-Referral\internal-webapp\chrome-extension
```

Stay inside this folder unless the user explicitly expands scope.

---

## What This Is

Manifest V3 Chrome Extension for Octopus Energy Smart Products Specialists.

It wraps the internal Smart Products webapp into two extension surfaces:

1. **Popup** (`popup/`) — 330px toolbar mini-app with 4 independent pages
2. **Options** (`options/`) — full SPA using `src/App.jsx` + `HashRouter`

Backend: `https://octotool.app`.

All extension API calls from React code must use exported functions from `src/services/api.js`.

Backend metadata endpoints used by the extension:

- `/api/health` — live backend + Octopus upstream probe for System Health.
- `/api/version` — expected extension version. UI displays `1.0.0` as `v1.0.0`.
- `/api/feature-flags` — feature flags, enabled by default unless backend `FEATURE_FLAGS_JSON` overrides them.
- `/api/announcements` — team bulletin cache for popup banners and morning briefing.
- `/api/get-iog-eligibility-options` — live Intelligent Octopus Go compatibility catalogue via the backend's authenticated Octopus GraphQL proxy.

---

## Commands

```bash
npm install
npm run test
npm run build
npm run make-icons
```

Validation baseline:

- `npm run test`: 31 Vitest tests passing
- `npm run build`: 412 modules, 0 errors
- `npm audit --audit-level=high`: passes; current Vite/esbuild advisory is moderate only

There is no configured lint script, ESLint config, TypeScript config, or typecheck script. Do not report lint/typecheck as completed unless those tools are added.

No local dev server is needed. After building, reload the unpacked extension from `chrome://extensions` and select `dist/`.

Do not use `npm run dev` unless explicitly asked; it is a build watcher, not a served dev app.

---

## Current File Layout

```text
chrome-extension/
  public/manifest.json              MV3 manifest source
  vite.config.js                    Popup + options Vite inputs
  popup/
    popup.html
    popup-main.jsx
    popup.jsx                       Popup shell, shared data fetch, banners
    utils.js                        Shared popup helpers and tested logic
    utils.test.js                   Vitest tests
    pages/
      HomePage.jsx                  Agile now, carbon, grid mix, briefing
      LookupPage.jsx                IOG mini-tool + postcode lookup + enrichment + bill investigator
      RatesPage.jsx                 Rates and pinned region watchlist
      ToolsPage.jsx                 Agent-configurable favourite tool buttons
    components/
      IogEligibilityCard.jsx        Popup IOG compatibility tool
      BottomNav.jsx
      StatCard.jsx
      StatusCard.jsx
  options/
    options.html
    options-main.jsx                Applies theme and renders App
  src/
    App.jsx                         HashRouter routes and lazy-loaded heavy pages
    pages/
      SettingsPage.jsx              Region, credentials, alerts, theme
      [internal-webapp pages]
    components/
      [shared UI and chart components]
    services/
      api.js                        ApiClient + exported API functions
      iogEligibility.js             IOG option normalization + eligible/not-eligible verdicts
      storage.js                    chrome.storage helper API
    theme.js                        applyTheme(mode)
    index.css                       Tailwind + theme CSS variables
    constants/
      regions.js
      svt.js
  public/background/
    service-worker.js               Badge, Agile cache, notifications, context menu
```

---

## Critical Rules

- Do not rename backend API parameters: `region`, `postcode`, `dateFrom`, `dateTo`.
- Do not add a `Bearer` prefix. Auth is `Basic btoa(user:pass)`.
- Do not call raw `fetch()` from React code. Use `src/services/api.js`.
- Do not add TypeScript or PropTypes.
- Do not add the `tabs` permission to `public/manifest.json`.
- Do not change `BACKEND_URL` from `https://octotool.app` unless the user explicitly asks.
- Do not add Chart.js to the popup bundle.
- Do not call Octopus public-site GraphQL from the extension for IOG. Use the backend `/api/get-iog-eligibility-options` route.
- Do not use `filter: invert(1) hue-rotate(180deg)` for light mode.
- Do not hardcode canvas chart colours like `'white'` or `rgba(255,255,255,...)`; use the chart theme helper pattern.
- Do not implement Kraken/customer account lookup or a customer snapshot feature here. This extension has no Kraken/Octopus customer-data backend access.

---

## Authentication

Credentials are no longer bundled.

- `SettingsPage.jsx` is the credential manager.
- `src/services/storage.js` stores `authUsername` and `authPassword` in `chrome.storage.sync`.
- `src/services/api.js` reads credentials through `getAuthCredentials()` and sends Basic auth.
- The service worker reads the same sync keys before Agile refresh.
- On first install, the service worker opens `options.html#/settings` if credentials are missing.

Legacy password helper names may still exist for compatibility, but new code should use `getAuthCredentials()` / `saveAuthCredentials()`.

---

## API Client

`src/services/api.js` keeps exported function signatures stable while using an internal `ApiClient`.

Features:

- GET inflight deduplication
- Maximum 4 concurrent requests
- Error classes: `NetworkError`, `AuthError`, `ServerError`
- Timeout constants:
  - `TIMEOUT.DEFAULT = 10_000`
  - `TIMEOUT.HEALTH = 3_000`
  - `TIMEOUT.HISTORICAL = 25_000`

Keep API changes conservative. If adding a backend call, add it as an exported function in `api.js`.

The IOG popup flow must stay backend-backed through `getIogEligibilityOptions()`. Do not reintroduce popup-direct traffic to `octopus.energy`.

---

## Agile Current Rate Rule

For any "Now" Agile rate display, call:

```js
const agile = await getAgileRates(region);
```

Do not pass a date. The dated endpoint can exclude the current BST slot.

Filter Today/Tomorrow client-side:

```js
const todaySlots = agile.import.filter(r =>
  toDateString(new Date(r.valid_from)) === todayStr
);
```

When finding the current slot, guard missing `valid_to`:

```js
const to = r.valid_to
  ? new Date(r.valid_to)
  : new Date(from.getTime() + 30 * 60 * 1000);
```

Use `popup/utils.js` helpers for popup logic when possible:

- `toDateString`
- `currentSlot`
- `rateColor`
- `agileBadgeColor`
- `billingVerdict`
- `priceAlertType`

---

## Popup Architecture

`popup.jsx` is the shell. It has no router; navigation is `currentPage` state.

Shared shell responsibilities:

- Apply theme
- Load cached Agile rates or fetch current Agile rates
- Fetch carbon intensity, alert status, and grid mix
- Track offline/stale/error state
- Render red alert banners and offline/refresh banners above all pages

Popup width is fixed at `w-[330px]`. Do not change it.

Popup pages:

- `HomePage.jsx`: Agile now, carbon, grid mix, collapsible morning briefing
- `LookupPage.jsx`: collapsible IOG eligibility tool, postcode lookup, enrichment sections, billing investigator verdict/copy summary
- `RatesPage.jsx`: region selector, Agile/Tracker rate cards, up to 3 pinned Agile regions
- `ToolsPage.jsx`: agent-configurable favourite Options tools with static default fallback and Open Full App button

Use `popup/components/StatusCard.jsx` for standard loading/error display.

**Postcode validation pattern (LookupPage + RegionLookup):**

`UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i` is declared at **component scope** in both `popup/pages/LookupPage.jsx` and `src/pages/RegionLookup.jsx`. Validation runs as the first statement inside `doLookup(trimmed)` — not inside `handleLookup` — so that all entry paths are covered:
- Manual form submit → `handleLookup` → `doLookup`
- Context-menu session-storage handoff → `useEffect` → `doLookup`
- URL query-parameter auto-trigger → `useEffect` → `doLookup`

Do not move the regex back inside `handleLookup` alone. If adding another entry path, call `doLookup` and the guard will apply automatically.

---

## Options App

`options-main.jsx` applies `getLightMode().then(applyTheme)` before rendering React.

`src/App.jsx` uses `HashRouter`.

Lazy-loaded pages:

- `AgileTracker`
- `TrackerPriceTracker`
- `IntelligentReference`
- `OcppDiagnostics`

Settings route: `#/settings`.

---

## Storage Helpers

Use `src/services/storage.js`; avoid direct `chrome.storage` calls in React components.

| Purpose | Helper | Storage |
|---|---|---|
| Preferred region | `getPreferredRegion`, `savePreferredRegion` | sync `preferredRegion` |
| Theme | `getLightMode`, `saveLightMode` | sync `lightMode` |
| Credentials | `getAuthCredentials`, `saveAuthCredentials`, `clearAuthCredentials` | sync `authUsername`, `authPassword` |
| Price alerts | `getPriceAlertSettings`, `savePriceAlertSettings` | sync `priceAlertSettings` |
| Agile cache | `getCachedAgileRates`, `setCachedAgileRates` | local cache keys |
| Refresh errors | `getLastRefreshError`, `setLastRefreshError` | local error keys |
| Pinned regions | `getPinnedRegions`, `savePinnedRegions` | local `pinnedRegions` |
| IOG cache | `getIogEligibilityCache`, `setIogEligibilityCache` | local IOG cache keys |
| Feature flags | `getFeatureFlagCache`, `setFeatureFlagCache` | local `featureFlags`, `featureFlagsFetchedAt` |
| Version state | `getUpdateStatus`, `setUpdateStatus` | local update/version keys |
| Announcements | `getAnnouncementState`, `setAnnouncements`, `dismissAnnouncement` | local announcement keys |
| Tool shortcuts | `getToolShortcuts`, `saveToolShortcuts` | sync `toolShortcuts` |
| Release seen state | `getSeenReleaseVersion`, `setSeenReleaseVersion` | local `seenReleaseVersion` |

`chrome.storage.session` is used for right-click postcode handoff from the service worker.

`runStorageMigrations()` runs before Options renders. Keep it fail-soft and additive.

---

## System Health

`src/pages/SystemHealthPage.jsx` combines cached extension state with live backend metadata.

- Expected version is fetched live from `/api/version`, then cached with `setUpdateStatus()`.
- Installed and expected versions display with a `v` prefix.
- `/api/health` latency includes a live Octopus `/products/?page_size=1` probe, so 300-800ms is normal.
- Feature Flags spans the full card width and displays cached backend flags.
- Install Doctor checks required permissions, forbidden `tabs`, command shortcuts, credentials, alarm state, and build metadata.

---

## Service Worker

`public/background/service-worker.js` is plain JavaScript and does not import npm modules.

Responsibilities:

- Create `agile-refresh` alarm every 30 minutes
- Fetch Agile rates and Tracker rates for the preferred region; cache in `chrome.storage.local`
- **Both fetches use `AbortController` with `REQUEST_TIMEOUT_MS = 10_000` timeout** to prevent hung requests. Pattern: `const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); try { res = await fetch(..., { signal: controller.signal }); } finally { clearTimeout(timer); }`
- Update toolbar badge:
  - green under 10p
  - amber 10p to 25p
  - red over 25p
  - grey for stale/error state
- Write refresh failures to local storage
- Show `"??"` badge after 3 consecutive failures
- Use cached Agile data while offline
- Fire Chrome notifications for cheap/expensive Agile slots based on Settings thresholds
- Suppress duplicate notifications for the same region/slot/type
- Register context menu for selected postcode lookup

Manifest permissions live in `public/manifest.json`.

Current permissions:

```json
["storage", "alarms", "activeTab", "contextMenus", "scripting", "notifications"]
```

Do not add `tabs`.

---

## Theme and Charts

Theme behavior:

- Dark mode: no `data-theme` attribute
- Light mode: `data-theme="light"` on `<html>`
- CSS variable overrides live in `src/index.css`

Never reintroduce page-wide CSS filters for light mode.

Chart.js renders to canvas and ignores CSS. Any chart must compute theme-aware colours at render time, following the existing `getChartTheme()` pattern in chart components.

---

## Testing

Vitest is installed.

Run:

```bash
npm run test
```

Current tests are in `popup/utils.test.js` and `src/services/iogEligibility.test.js`, and cover:

- date formatting
- current slot detection
- UI and badge rate thresholds
- price alert classification
- billing verdict percentages
- stale/fresh data labels
- IOG compatibility catalogue normalization
- IOG eligible/not-eligible verdict mapping

When adding business logic, prefer pure helpers plus focused tests.

---

## Icons and Logo

Official logo: **Constantine the Octopus**.

| Surface | File |
|---|---|
| Toolbar icons | `public/logo.svg`, `public/icons/icon-*.png` |
| Options nav logo | `src/assets/logo.svg` |
| Popup header | inline SVG in `popup/popup.jsx` |

Regenerate PNGs with:

```bash
npm run make-icons
```

Inline SVG gradient IDs must be unique. Popup uses `pop-a` / `pop-b`.

Do not restore the old large logo asset.

---

## Deliberate Non-Features

These are intentionally not implemented:

- Kraken GraphQL / customer account API
- Quick customer snapshot in popup
- DataDeepDive page
- Telegram alerting
- CMS
- TypeScript migration

Do not build these unless the user explicitly revises the product scope and backend capabilities.

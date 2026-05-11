# Smart Products Hub — Chrome Extension

Codex operating instructions for the Chrome extension at `K:\ClaudeProjects\Octopus-Referral\internal-webapp\chrome-extension`.

This is an internal Chrome Extension (Manifest V3) for Octopus Energy Smart Products Specialists. It wraps the `internal-webapp` staff portal into:

- **Popup** (`popup/`) — 330px compact toolbar app, 4 pages, no React Router
- **Options** (`options/`) — full SPA via `src/App.jsx` + HashRouter

Backend: Express server at `https://octotool.app`. All extension API calls go through `src/services/api.js`.

Backend metadata endpoints used by the extension:
- `/api/health` — live backend + Octopus upstream probe for System Health.
- `/api/version` — expected extension version. UI displays `1.0.0` as `v1.0.0`.
- `/api/feature-flags` — feature flags, enabled by default unless backend `FEATURE_FLAGS_JSON` overrides them.
- `/api/announcements` — team bulletin cache for popup banners and morning briefing.
- `/api/get-iog-eligibility-options` — live Intelligent Octopus Go car + charger compatibility catalogue via the backend's authenticated Octopus GraphQL proxy.

Feature status: see `features.md`. Completed ship notes: see `CHANGELOG.md`.

---

## Workspace Boundary

Only edit files inside this folder:

```text
K:\ClaudeProjects\Octopus-Referral\internal-webapp\chrome-extension
```

Do not modify source files elsewhere in `internal-webapp` or the parent repo unless the user explicitly changes scope.

---

## Build, Test, and Commands

```bash
npm install
npm run test        # Vitest business-logic tests
npm run build       # Builds to dist/
npm run make-icons  # Regenerates PNG icons from public/icons/logo.svg via sharp
```

Current validated baseline:

- `npm run test` — 31 tests passing
- `npm run build` — 412 modules, 0 errors
- `npm audit --audit-level=high` — passes; current Vite/esbuild advisory is moderate only

There is no lint script, no ESLint config, and no TypeScript config. Do not claim lint/typecheck were run unless those tools are added.

No dev server is required. After every build: reload unpacked extension at `chrome://extensions` → select `dist/`.

> Do not run `npm run dev` unless explicitly asked. It is only `vite build --watch`, not a served app.

---

## Project Structure

```text
public/manifest.json          MV3 manifest source copied into dist/
vite.config.js                Two entry points: popup + options
popup/
  popup.html / popup-main.jsx / popup.jsx
  utils.js                    Shared popup helpers + tested business logic
  utils.test.js               Vitest coverage for popup business helpers
  pages/                      HomePage, LookupPage, RatesPage, ToolsPage
  components/                 BottomNav, IogEligibilityCard, StatCard, StatusCard
options/
  options.html / options-main.jsx
src/
  App.jsx                     HashRouter routes + lazy-loaded heavy pages
  pages/                      SettingsPage + internal-webapp pages
  components/                 Shared components and Chart.js charts
  services/
    api.js                    ApiClient, exported API functions, timeouts
    iogEligibility.js         Popup IOG catalogue normalization + verdict helper
    storage.js                All chrome.storage helpers
  theme.js                    applyTheme(mode) sets data-theme on <html>
  index.css                   CSS vars + Tailwind + light mode overrides
  constants/                  regions.js, svt.js
public/background/
  service-worker.js           30-min Agile refresh, badge, alerts, context menu
```

---

## Hard Rules — Never Violate

1. **Never rename API parameters.** `region`, `postcode`, `dateFrom`, `dateTo` must match backend route params exactly.
2. **Never add a `Bearer` prefix.** Auth headers are Basic auth only: `Basic btoa(user:pass)`.
3. **Never call raw `fetch()` from UI/pages/components.** Use exported functions from `src/services/api.js`. The service worker is plain JS and may use its own fetch logic.
4. **Never add TypeScript or PropTypes.** This project is plain JavaScript/JSX.
5. **Never pass a date argument to `getAgileRates(region)` for "Now" displays.** Use the rolling no-date call and filter Today/Tomorrow client-side.
6. **Never use `filter: invert(1) hue-rotate(180deg)` for light mode.** Light mode is CSS custom properties under `[data-theme="light"]`.
7. **Never add Chart.js to the popup bundle.** Popup bars/charts are CSS flex.
8. **Never add the `tabs` permission.** `chrome.tabs.create()` works without it in MV3.
9. **Never change `BACKEND_URL` (`https://octotool.app`) without explicit instruction.**
10. **Never hardcode `'white'` or `rgba(255,255,255,...)` in Chart.js config.** Use each chart component's `getChartTheme()` style pattern.
11. **Never implement customer account snapshot/Kraken lookup in this extension.** There is no Kraken/Octopus customer-data backend access here.
12. **Never call Octopus public-site GraphQL directly from the extension for IOG.** Use the backend `/api/get-iog-eligibility-options` route instead; the popup should not need `octopus.energy` host permissions.

---

## Authentication

Credentials are not bundled in source.

- `SettingsPage.jsx` is the credential manager.
- `storage.js` stores `authUsername` and `authPassword` in `chrome.storage.sync`.
- `api.js` reads credentials through `getAuthCredentials()` and emits Basic auth.
- The service worker reads the same sync keys before Agile refreshes.
- On first install, the service worker opens `options.html#/settings` if credentials are missing.

Keep the legacy `getOverridePassword()` wrapper only for compatibility if older code calls it; new code should use `getAuthCredentials()` / `saveAuthCredentials()`.

---

## API Client

`src/services/api.js` exports the same function names used throughout the app. Internally it uses `ApiClient`:

- GET inflight dedupe for identical concurrent GETs
- Request concurrency limit: 4
- Error classes: `NetworkError`, `AuthError`, `ServerError`
- Timeouts:
  - `TIMEOUT.DEFAULT = 10_000`
  - `TIMEOUT.HEALTH = 3_000`
  - `TIMEOUT.HISTORICAL = 25_000`

No exported API function signature should be changed casually.

The IOG popup tool must use `getIogEligibilityOptions()` from `api.js`, which talks to our backend. Do not reintroduce popup-direct requests to `octopus.energy`.

---

## Agile "Now" Rate — Correct Pattern

```js
// Correct: 72h rolling window, includes current BST slot.
const agile = await getAgileRates(region);

const todayStr = toDateString(new Date());
const todaySlots = agile.import.filter(r =>
  toDateString(new Date(r.valid_from)) === todayStr
);

const to = r.valid_to
  ? new Date(r.valid_to)
  : new Date(new Date(r.valid_from).getTime() + 30 * 60 * 1000);
```

Use shared popup helpers from `popup/utils.js` where possible: `toDateString`, `currentSlot`, `rateColor`, `agileBadgeColor`, `billingVerdict`, `priceAlertType`.

---

## Popup Architecture

- `popup.jsx` is the shell. It has **no React Router**.
- Navigation is `currentPage` state across Home, Lookup, Rates, Tools.
- Popup width is fixed at `w-[330px]`; do not change it.
- Shared data (`agile`, `ci`, `gridMix`, `alerts`, `loading`, freshness/error state) is fetched in the shell.
- Red alert banners live in `popup.jsx` and render across all tabs.
- Offline/freshness banners also live in `popup.jsx`.
- Use `popup/components/StatusCard.jsx` for standard loading/error shells.

Implemented popup features:

- Home: Agile now, carbon, live grid mix, collapsible morning briefing.
- Lookup: collapsible IOG eligibility mini-tool, postcode lookup, enrichment cards, billing investigator verdict and copy summary.
- Rates: region selector plus up to 3 pinned region watch cards stored in `chrome.storage.local`.
- Tools: agent-configurable favourite Options tools, stored in `chrome.storage.sync`, with a static default fallback.

**Postcode validation in Lookup surfaces:** `UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i` is declared at component scope in both `popup/pages/LookupPage.jsx` and `src/pages/RegionLookup.jsx`. The guard runs at the top of `doLookup()` — which covers all entry paths: manual form submit, context-menu session-storage handoff, and URL query-parameter auto-trigger. Do not move validation back inside `handleLookup` only, as that misses the automatic trigger paths.

---

## Options SPA

- `options-main.jsx` applies theme before React renders.
- `src/App.jsx` uses HashRouter.
- Heavy pages are lazy-loaded:
  - `AgileTracker`
  - `TrackerPriceTracker`
  - `IntelligentReference`
  - `OcppDiagnostics`

The Settings route is `#/settings`.

---

## Theme System

- Default: dark mode, no `data-theme` attribute.
- Light mode: `applyTheme('light')` sets `data-theme="light"` on `<html>`.
- `preferredRegion`, `lightMode`, credentials, and price alert settings are in `chrome.storage.sync`.
- Cached Agile data, refresh errors, pinned regions, and notification duplicate state are in `chrome.storage.local`.
- `options-main.jsx` listens to `chrome.storage.onChanged` for `lightMode` changes in the `sync` area only.

Chart.js components must compute theme-aware colours at render time. Future charts must follow the existing `getChartTheme()` pattern.

---

## Service Worker

`public/background/service-worker.js` is plain JS.

- Alarm `agile-refresh` fires every 30 minutes.
- On alarm: fetch Agile rates + Tracker rates for preferred region → cache in `chrome.storage.local` → update badge.
- **Both** `refreshAgileRates()` and `refreshTrackerRates()` wrap their `fetch()` in an `AbortController` with `REQUEST_TIMEOUT_MS = 10_000` timeout to prevent hung requests blocking the service worker.
- Badge thresholds: green `<10p`, amber `10–25p`, red `>25p`, grey when stale/error.
- Failures write `lastAgileRefreshError` and `agileRefreshFailureCount`.
- After 3 consecutive failures, badge becomes grey with `"??"`.
- Offline refresh uses cached Agile rates where available.
- Price alerts use `chrome.notifications.create()` when current Agile crosses Settings thresholds, with per-slot duplicate suppression.
- Storage changes to `preferredRegion`, `authUsername`, `authPassword`, or old `overridePassword` trigger immediate refresh.
- Context menu stores selected text in `chrome.storage.session` as `contextMenuPostcode` and opens `options.html#/region-lookup`.

Manifest permissions are in `public/manifest.json`: `storage`, `alarms`, `activeTab`, `contextMenus`, `scripting`, `notifications`. Do not add `tabs`.

---

## Storage Helpers (`src/services/storage.js`)

Always use these helpers instead of direct `chrome.storage` in React code.

| Function | Storage area/key | Default |
|---|---|---|
| `getPreferredRegion()` / `savePreferredRegion(r)` | sync `preferredRegion` | `'H'` |
| `getLightMode()` / `saveLightMode(mode)` | sync `lightMode` | `'dark'` |
| `getAuthCredentials()` / `saveAuthCredentials(user, pass)` | sync `authUsername`, `authPassword` | `null` |
| `getPriceAlertSettings()` / `savePriceAlertSettings(settings)` | sync `priceAlertSettings` | enabled, 5p cheap, 35p expensive |
| `getCachedAgileRates()` / `setCachedAgileRates(rates)` | local cached Agile keys | `null` |
| `getLastRefreshError()` / `setLastRefreshError(message, count)` | local refresh error keys | `null`, `0` |
| `getPinnedRegions()` / `savePinnedRegions(regions)` | local `pinnedRegions` | `[]` |
| `getIogEligibilityCache()` / `setIogEligibilityCache(data)` | local IOG cache keys | `null` |
| `getFeatureFlagCache()` / `setFeatureFlagCache(flags)` | local `featureFlags`, `featureFlagsFetchedAt` | `{}` |
| `getUpdateStatus()` / `setUpdateStatus(status)` | local version keys | no update |
| `getAnnouncementState()` / `setAnnouncements(announcements)` | local announcement keys | `[]` |
| `getToolShortcuts()` / `saveToolShortcuts(shortcuts)` | sync `toolShortcuts` | default tools |
| `getSeenReleaseVersion()` / `setSeenReleaseVersion(version)` | local `seenReleaseVersion` | `null` |

`runStorageMigrations()` runs before Options renders. Keep it fail-soft and additive.

---

## System Health

`src/pages/SystemHealthPage.jsx` reads both cached extension state and live backend metadata.

- Expected version is fetched live from `/api/version`, then cached with `setUpdateStatus()`.
- Installed and expected versions are displayed with a `v` prefix.
- `/api/health` latency includes the live Octopus probe, so 300-800ms is normal.
- Feature Flags spans the full card width and displays cached backend flags.
- Install Doctor checks required permissions, forbidden `tabs`, command shortcut values, credentials, alarm state, and build metadata.

---

## Testing

Vitest is configured via `npm run test`.

Current suite includes `popup/utils.test.js` and `src/services/iogEligibility.test.js`, 31 tests covering:

- `toDateString`
- `currentSlot`
- UI/badge rate thresholds
- price alert classification
- billing verdict calculation
- freshness labels
- IOG compatibility catalogue normalization
- IOG eligible/not-eligible verdict mapping

When adding business logic, prefer extracting pure helpers and adding focused tests.

---

## Logo

The official logo is **Constantine the Octopus**: pink (`#FF48D8`) body, white sclera, dark gradient pupils, eyebrow marks, subtle smile.

| Surface | File | Notes |
|---|---|---|
| Chrome toolbar icon | `public/logo.svg` + PNG set in `public/icons/` | Regenerate PNGs with `npm run make-icons` |
| Options SPA nav | `src/assets/logo.svg` | Imported by `Header.jsx` |
| Popup header | Inline JSX in `popup/popup.jsx` | Gradient IDs: `pop-a`, `pop-b` |

Gradient ID rule: every inline SVG instance needs unique IDs. Do not reuse `pop-a`/`pop-b` for another inline SVG.

Do not restore the old 889 kB logo. The current asset is intentionally small and Vite may inline it.

---

## Deliberate Non-Features

- No Kraken GraphQL / customer API key handling.
- No quick customer account snapshot in popup/options unless a real backend capability is added first.
- No DataDeepDive page.
- No Telegram alerting.
- No CMS.
- No TypeScript migration.
- Keep `ToolsPage` quick-link array static unless explicitly requested.

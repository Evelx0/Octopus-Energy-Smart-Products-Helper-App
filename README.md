# internal-webapp

Smart Products knowledge hub for Octopus Energy specialists, plus a companion Chrome extension.
All information used within this project is from either publicly available APIs or public information from the Octopus website or public API.

This repository is aimed at internal staff workflows, not public users. From a TechOps perspective, it is a small multi-surface application made up of:

- A React/Vite staff web app in `frontend/`
- An Express API in `backend/`
- A Manifest V3 Chrome extension in `chrome-extension/`
- Static reference material in `docs/`

## Purpose

The platform gives Smart Products agents a single place to:

- Check live Agile, Tracker, and Outgoing rates
- Run postcode-to-region and other internal lookups
- Access tariff reference content and onboarding guides
- Use popup tools from the Chrome extension while working
- Query live Intelligent Octopus Go compatibility data through the backend

It is intentionally not a customer-facing product. There is no customer login, no CMS, no public referral flow, and no Kraken customer account tooling.

## High-Level Architecture

```text
Chrome Extension popup/options
            |
            | Basic Auth over HTTPS
            v
      https://octotool.app
            |
            v
     Express backend (PM2)
            |
            +--> Octopus REST API
            +--> Octopus GraphQL API (IOG compatibility only)
            +--> Carbon Intensity API
            +--> Open-Meteo
            +--> Open Charge Map
            +--> Sheffield Solar
            +--> Elexon BMRS
```

## Repository Layout

```text
internal-webapp/
  backend/            Express API, PM2 target, upstream integrations
  frontend/           React 18 + Vite staff SPA
  chrome-extension/   MV3 extension popup + options app
  docs/               OCPP and related static reference documents
  AGENTS.md           Repository operating rules
  CLAUDE.md           Deep project notes and implementation details
```

## Tech Stack

### Frontend

- React 18
- Vite 5
- Tailwind CSS
- Chart.js / react-chartjs-2 for the full web app only

### Backend

- Node.js
- Express
- Axios
- Helmet
- CORS
- express-rate-limit
- express-basic-auth
- Morgan
- PM2 in production

### Chrome Extension

- Manifest V3
- React for popup and options UIs
- `chrome.storage`, `alarms`, `contextMenus`, `notifications`
- Built with Vite into `chrome-extension/dist/`

## Runtime Ports

Local defaults:

- Frontend: `5174`
- Backend: `3001`

These differ from the separate public-facing `js-app` project so both stacks can run side by side.

## Production Shape

The production deployment is split:

- Nginx serves the built frontend
- PM2 runs the backend process
- The Chrome extension talks to the same backend at `https://octotool.app`

Current PM2 app name:

- `octopus-smartproducts`

Documented backend PM2 config:

- [backend/ecosystem.config.js]

## Key Operational Dependencies

### Required backend secrets

The backend will not start correctly in production without:

- `OCTOPUS_API_KEY`
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASS`

Commonly configured additional keys:

- `OCM_API_KEY`
- `ELEXON_API_KEY`
- `ELEXON_QUEUE_NAME`
- `ELEXON_QUEUE_URL`

Optional behavior/config overrides:

- `FRONTEND_ORIGIN`
- `EXPECTED_EXTENSION_VERSION`
- `FEATURE_FLAGS_JSON`
- `ANNOUNCEMENTS_JSON`

### External services used

- Octopus Energy REST API
- Octopus Energy GraphQL API
- Carbon Intensity API
- Open-Meteo
- Open Charge Map
- Sheffield Solar
- Elexon BMRS

## Important Internal API Endpoints

The backend is primarily an internal aggregation/proxy layer. Common endpoints include:

- `POST /api/get-rates`
- `POST /api/get-agile-rates`
- `POST /api/get-historical-agile-rates`
- `POST /api/get-tracker-rates`
- `POST /api/get-historical-tracker-rates`
- `POST /api/get-outgoing-rates`
- `GET /api/get-comparison-rates`
- `GET /api/get-weather`
- `GET /api/get-nearby-chargers`
- `GET /api/get-regional-carbon`
- `GET /api/get-settlement-prices`

Extension support endpoints:

- `GET /api/health`
- `GET /api/version`
- `GET /api/feature-flags`
- `GET /api/announcements`
- `GET /api/get-iog-eligibility-options`

## Chrome Extension Notes

The extension is not standalone. It depends on the backend for all live data.

Two extension surfaces exist:

- Popup: compact 330px toolbar UI
- Options: full-screen configuration/reference app

Important extension behavior:

- Uses Basic Auth against the backend
- Does not talk directly to Kraken/customer APIs
- Does not require the `tabs` permission
- Uses backend route `GET /api/get-iog-eligibility-options` for Intelligent Octopus Go compatibility data
- No longer needs direct `octopus.energy` host permissions for the IOG checker

Operationally, if the backend is down or credentials are wrong, the extension will lose most live functionality.

## Security Model

Relevant TechOps points:

- Basic Auth is enforced at the backend
- API JSON responses are marked `Cache-Control: no-store`
- CORS is restricted to the staff frontend and `chrome-extension://` origins
- General API limiter: `100 requests / 15 minutes / IP`
- Historical/heavier routes limiter: `20 requests / 15 minutes / IP`
- Backend uses explicit timeouts for upstream API calls
- PM2 is expected to restart the backend on failure

Known intentional caveats are documented in:

- [AGENTS.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/AGENTS.md)
- [CLAUDE.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/CLAUDE.md)

## Local Development

### Backend

```bash
cd backend
npm install
node server.js
```

Validation:

```bash
node --check server.js
npm audit --audit-level=high
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

### Chrome Extension

```bash
cd chrome-extension
npm install
npm run test
npm run build
```

After building the extension, reload the unpacked extension from `chrome-extension/dist/`.

## Deployment Model

### Backend-only deploy

Typical backend-only release flow:

1. Upload changed files in `backend/`
2. Run `npm install` only if backend dependencies changed
3. Restart PM2
4. Check logs

Example:

```bash
cd /var/www/octotool/backend
pm2 restart octopus-smartproducts
pm2 logs octopus-smartproducts --lines 30
```

For the recent live IOG compatibility change, the minimal deploy was just:

- Upload `backend/server.js`
- Restart `octopus-smartproducts`

### Frontend-only deploy

Typical frontend-only release flow:

1. Build locally in `frontend/`
2. Upload `frontend/dist/`
3. No PM2 restart required

### Chrome extension deploy

Typical extension release flow:

1. Build locally in `chrome-extension/`
2. Reload unpacked extension internally, or package and redistribute the updated build

## Monitoring and Troubleshooting

### First things to check

- Is `octopus-smartproducts` running in PM2?
- Are the required environment variables present?
- Does `https://octotool.app/api/health` respond?
- Are upstream rate limits or third-party failures visible in PM2 logs?
- Did the extension version change without updating the deployed package?

### Useful checks

```bash
pm2 status
pm2 logs octopus-smartproducts --lines 50
curl -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASS" https://octotool.app/api/health
```

### Known sensitive areas

- Octopus upstream timeouts/rate limiting
- Open Charge Map API key issues
- Stale or missing backend env vars after VPS changes
- Extension breakage if backend route names or payload keys change

## Change Management Notes

If you are making infra or release decisions, treat these as interface contracts:

- Backend route names are consumed by both frontend and extension
- Request keys like `region`, `postcode`, `dateFrom`, `dateTo`, `productCode` are intentionally stable
- The extension `BACKEND_URL` is pinned to `https://octotool.app`
- The popup IOG checker is backend-backed by design; do not move it back to browser-direct Octopus requests

## Reference Docs

For deeper implementation detail, use:

- [AGENTS.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/AGENTS.md)
- [CLAUDE.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/CLAUDE.md)
- [chrome-extension/AGENTS.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/chrome-extension/AGENTS.md)
- [chrome-extension/CLAUDE.md](/K:/ClaudeProjects/Octopus-Referral/internal-webapp/chrome-extension/CLAUDE.md)


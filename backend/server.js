// internal-webapp — Express Backend
// Staff knowledge portal for Octopus Energy Smart Products Specialism team.
// No CMS, no customer account routes, no Telegram alerting, no visitor notify.

const express   = require('express');
const axios     = require('axios');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const basicAuth = require('express-basic-auth');
const path      = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const morgan    = require('morgan');
const { validateInput, REGION_RE, isRealDate, MIN_DATE } = require('./middleware/validation');

const app  = express();
const PORT = process.env.PORT || 3001;
const STARTED_AT = new Date();

const DEFAULT_EXTENSION_FEATURE_FLAGS = Object.freeze({
  betaKnowledgeBase: true,
  showDFSWatch: true,
  showGridStress: true,
  showAgileVolatility: true,
  showManagerAnnouncements: true,
  showTrackerRateAlerts: true,
  showLearningMode: true,
  showSessionSummary: true,
  showDeepLinks: true,
  showToolShortcuts: true,
  showAgileUsagePlanner: true,
  showCarbonAwarePlanner: true,
  showTariffRecommendationCopy: true,
  showReleaseNotes: true,
  showUpdateSummary: true,
  showAgileDayArchetype: true,
  showRegionalHeatmap: true,
  showTrackerMonthlyExplainer: true,
  showTariffFitMatrix: true,
});

function readJsonEnv(name, fallback) {
  if (!process.env[name]) return fallback;
  try {
    return JSON.parse(process.env[name]);
  } catch (error) {
    console.warn(`[CONFIG] ${name} is not valid JSON — using defaults.`);
    return fallback;
  }
}

function getExpectedExtensionVersion() {
  if (process.env.EXPECTED_EXTENSION_VERSION) return process.env.EXPECTED_EXTENSION_VERSION;
  try {
    // Local/deployment convenience: publish the checked-in extension version unless env overrides it.
    return require('../chrome-extension/package.json').version;
  } catch {
    return require('./package.json').version;
  }
}

function getFeatureFlags() {
  const overrides = readJsonEnv('FEATURE_FLAGS_JSON', {});
  return {
    ...DEFAULT_EXTENSION_FEATURE_FLAGS,
    ...overrides,
  };
}

function getAnnouncements() {
  const configured = readJsonEnv('ANNOUNCEMENTS_JSON', []);
  return Array.isArray(configured) ? configured : [];
}

// ── Basic Auth — first middleware, blocks all access until credentials supplied ─
const authUser = process.env.BASIC_AUTH_USER;
const authPass = process.env.BASIC_AUTH_PASS;

if (!authUser || !authPass) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] BASIC_AUTH_USER / BASIC_AUTH_PASS must be set in production. Refusing to start without access control.');
    process.exit(1);
  }
  console.warn('[AUTH] BASIC_AUTH_USER / BASIC_AUTH_PASS not set in .env — access control DISABLED (dev mode only)');
} else {
  app.use(basicAuth({
    users:     { [authUser]: authPass },
    challenge: true,                       // browser shows native credential popup
    realm:     'Smart Products Hub',
  }));
  console.log('[AUTH] Basic auth enabled — realm: Smart Products Hub');
}

// --- Security headers (explicit CSP + HSTS) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", 'data:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge:            31536000, // 1 year in seconds
    includeSubDomains: true,
    preload:           true,
  },
  crossOriginEmbedderPolicy: false, // Would break Chart.js web workers
  permissionsPolicy: {
    features: {
      camera:      [],  // deny
      microphone:  [],  // deny
      geolocation: [],  // deny
    },
  },
}));

// --- CORS ---
// Allows the staff web frontend and the Chrome extension popup/options pages.
// chrome-extension:// origins are safe to allow here because Basic Auth still
// gates every request before any route handler runs.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
app.use(cors({
  origin: (origin, callback) => {
    // Same-origin requests (Express serving the SPA) have no Origin header
    if (!origin) return callback(null, true);
    if (origin === FRONTEND_ORIGIN || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods:        ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// --- Rate limiting ---
const generalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Please try again shortly.' },
});

// Historical endpoints are expensive (probe many Octopus URLs) — lower limit
const historicalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many historical requests. Please wait before trying again.' },
});

app.use('/api/', generalLimiter);

// Prevent any proxy or browser from caching API JSON responses
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Request audit logging — Authorization header omitted to avoid logging credentials
app.use(morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms'));

// --- STARTUP CHECKS ---
const API_KEY = process.env.OCTOPUS_API_KEY;

if (!API_KEY) {
  console.error('[FATAL STARTUP ERROR] OCTOPUS_API_KEY is not configured in .env. The application will not work.');
  process.exit(1);
} else {
  console.log('[STARTUP SUCCESS] Octopus API Key loaded successfully.');
}

// Process-level safety nets
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[FATAL] Unhandled Promise Rejection:', err);
  process.exit(1);
});

app.use(express.json({ limit: '10kb' }));
app.set('trust proxy', 1);

// ── Octopus API client factory ────────────────────────────────────────────────
// All routes that call the Octopus REST API should use this instead of inline
// axios.create() so every outbound request gets a consistent 10-second timeout.
// Without a timeout, a slow/hung upstream response blocks the event loop slot
// for that request indefinitely and can exhaust the rate-limiter window.
function createOctopusApi() {
  return axios.create({
    baseURL: 'https://api.octopus.energy/v1',
    auth:    { username: API_KEY, password: '' },
    timeout: 10000,
  });
}

function createOctopusGraphqlApi(token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token;

  return axios.create({
    baseURL: 'https://api.octopus.energy/v1/graphql/',
    headers,
    timeout: 10000,
  });
}

const OBTAIN_KRAKEN_TOKEN_MUTATION = `
  mutation ObtainKrakenToken($input: ObtainJSONWebTokenInput!) {
    obtainKrakenToken(input: $input) {
      token
      refreshToken
      refreshExpiresIn
    }
  }
`;

const IOG_ELIGIBILITY_QUERY = `
  query GetElectricVehiclesAndChargePointVariants {
    electricVehicles {
      make
      models {
        vehicleId
        model
        integrationStatus
        batterySize
      }
    }
    chargePointVariants {
      make
      models {
        variantId
        model
        powerInKw
        integrationStatus
      }
    }
  }
`;

const IOG_CACHE_TTL = 6 * 60 * 60 * 1000;
const GRAPHQL_TOKEN_BUFFER_MS = 60 * 1000;

let graphqlAuthCache = {
  token: null,
  tokenExpiresAt: 0,
  refreshToken: null,
  refreshExpiresAt: 0,
};

let iogEligibilityCache = {
  data: null,
  timestamp: 0,
};

function getGraphqlData(response, fieldName) {
  const body = response?.data || {};
  if (Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0];
    const detail =
      first.extensions?.errorDescription ||
      first.message ||
      'Octopus GraphQL request failed.';
    const code = first.extensions?.errorCode;
    throw new Error(code ? `${detail} (${code})` : detail);
  }

  const data = body.data?.[fieldName];
  if (!data) throw new Error(`Octopus GraphQL response missing ${fieldName}.`);
  return data;
}

function cacheGraphqlAuth(authResult) {
  const now = Date.now();
  graphqlAuthCache = {
    token: authResult.token,
    tokenExpiresAt: now + (55 * 60 * 1000),
    refreshToken: authResult.refreshToken || null,
    refreshExpiresAt: authResult.refreshExpiresIn
      ? Number(authResult.refreshExpiresIn) * 1000
      : 0,
  };
}

async function requestGraphqlToken(input) {
  const graphqlApi = createOctopusGraphqlApi();
  const response = await graphqlApi.post('', {
    query: OBTAIN_KRAKEN_TOKEN_MUTATION,
    variables: { input },
  });

  const authResult = getGraphqlData(response, 'obtainKrakenToken');
  cacheGraphqlAuth(authResult);
  return authResult.token;
}

async function ensureOctopusGraphqlToken() {
  const now = Date.now();

  if (
    graphqlAuthCache.token &&
    now < (graphqlAuthCache.tokenExpiresAt - GRAPHQL_TOKEN_BUFFER_MS)
  ) {
    return graphqlAuthCache.token;
  }

  if (
    graphqlAuthCache.refreshToken &&
    now < (graphqlAuthCache.refreshExpiresAt - GRAPHQL_TOKEN_BUFFER_MS)
  ) {
    try {
      return await requestGraphqlToken({ refreshToken: graphqlAuthCache.refreshToken });
    } catch (error) {
      console.warn('[IOG] Refresh token exchange failed — falling back to primary key auth.');
    }
  }

  try {
    return await requestGraphqlToken({ organizationSecretKey: API_KEY });
  } catch (orgError) {
    try {
      return await requestGraphqlToken({ APIKey: API_KEY });
    } catch (apiKeyError) {
      throw new Error(
        `Could not authenticate with Octopus GraphQL. ${orgError.message} | ${apiKeyError.message}`
      );
    }
  }
}

async function postOctopusGraphql(query, variables = {}) {
  const token = await ensureOctopusGraphqlToken();
  const graphqlApi = createOctopusGraphqlApi(token);

  try {
    return await graphqlApi.post('', { query, variables });
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      graphqlAuthCache.token = null;
      const freshToken = await ensureOctopusGraphqlToken();
      const retryApi = createOctopusGraphqlApi(freshToken);
      return retryApi.post('', { query, variables });
    }
    throw error;
  }
}

function cleanIogText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parseIogNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatIogBattery(value) {
  return value == null ? null : `${value.toFixed(1)} kWh`;
}

function formatIogPower(value) {
  return value == null ? null : `${value.toFixed(1)}kW`;
}

function sortByLabel(a, b) {
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

function normalizeIogVehicle(make, model) {
  const cleanMake = cleanIogText(make);
  const cleanModel = cleanIogText(model?.model);
  const batterySize = parseIogNumber(model?.batterySize);
  const batteryLabel = formatIogBattery(batterySize);

  return {
    id: String(model?.vehicleId ?? ''),
    make: cleanMake,
    model: cleanModel,
    label: batteryLabel ? `${cleanModel} (${batteryLabel})` : cleanModel,
    integrationStatus: cleanIogText(model?.integrationStatus) || 'NOT_AVAILABLE',
  };
}

function normalizeIogCharger(make, model) {
  const cleanMake = cleanIogText(make);
  const cleanModel = cleanIogText(model?.model);
  const powerInKw = parseIogNumber(model?.powerInKw);
  const powerLabel = formatIogPower(powerInKw);

  return {
    id: String(model?.variantId ?? ''),
    make: cleanMake,
    model: cleanModel,
    label: powerLabel ? `${cleanModel} (${powerLabel})` : cleanModel,
    integrationStatus: cleanIogText(model?.integrationStatus) || 'NOT_AVAILABLE',
  };
}

function groupIogItemsByMake(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.make]) acc[item.make] = [];
    acc[item.make].push(item);
    return acc;
  }, {});
}

function normalizeIogCatalog(payload) {
  const vehicles = (payload?.electricVehicles || [])
    .flatMap(entry => (entry?.models || []).map(model => normalizeIogVehicle(entry.make, model)))
    .filter(item => item.id && item.make && item.model)
    .sort(sortByLabel);

  const chargers = (payload?.chargePointVariants || [])
    .flatMap(entry => (entry?.models || []).map(model => normalizeIogCharger(entry.make, model)))
    .filter(item => item.id && item.make && item.model)
    .sort(sortByLabel);

  const vehiclesByMake = groupIogItemsByMake(vehicles);
  const chargersByMake = groupIogItemsByMake(chargers);

  Object.values(vehiclesByMake).forEach(list => list.sort(sortByLabel));
  Object.values(chargersByMake).forEach(list => list.sort(sortByLabel));

  return {
    vehicleMakes: Object.keys(vehiclesByMake).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    chargerMakes: Object.keys(chargersByMake).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    vehiclesByMake,
    chargersByMake,
  };
}

async function getLiveIogCatalog() {
  const response = await postOctopusGraphql(IOG_ELIGIBILITY_QUERY);
  return getGraphqlData(response, 'electricVehicles')
    ? normalizeIogCatalog(response.data.data)
    : null;
}

// ── Module-level helpers — reused across multiple route handlers ──────────────
// `getVal`: extract first result value from a Promise.allSettled entry
const getVal = (r) =>
  r.status === 'fulfilled' && r.value?.data?.results?.length > 0
    ? r.value.data.results[0].value_inc_vat
    : null;

// `getResults`: extract results array from a Promise.allSettled entry
const getResults = (settled) =>
  settled.status === 'fulfilled' ? (settled.value.data.results || []) : [];

// ==================== AGILE PRODUCT CACHE ====================
let productCache = { data: null, timestamp: 0 };
const CACHE_TTL  = 60 * 60 * 1000; // 1 hour

async function findAgileProducts(octopusApi) {
  const now = Date.now();
  if (productCache.data && (now - productCache.timestamp < CACHE_TTL)) {
    console.log('[AGILE CACHE] Using cached product data.');
    return productCache.data;
  }

  console.log('[AGILE CACHE] Cache miss or expired. Fetching fresh product data.');
  const firstPage = await octopusApi.get('/products/', { params: { page_size: 100 } });
  const totalCount = firstPage.data.count;
  let allProducts = [...firstPage.data.results];

  if (totalCount > 100) {
    const totalPages = Math.min(Math.ceil(totalCount / 100), 8);
    const extraRequests = Array.from({ length: totalPages - 1 }, (_, i) =>
      octopusApi.get('/products/', { params: { page_size: 100, page: i + 2 } }).catch(() => null)
    );
    const extraResponses = await Promise.all(extraRequests);
    extraResponses.forEach(r => { if (r?.data?.results) allProducts = allProducts.concat(r.data.results); });
  }

  const importProduct = allProducts.find(p => p.code.startsWith('AGILE-'));
  let exportProduct = allProducts.find(p =>
    p.code.startsWith('OUTGOING-AGILE-') || p.code.startsWith('AGILE-OUTGOING-')
  );

  if (!exportProduct) {
    for (const code of ['OUTGOING-AGILE-24-11-01', 'OUTGOING-AGILE-22-02-28', 'AGILE-OUTGOING-19-05-13']) {
      try {
        const r = await octopusApi.get(`/products/${code}/`);
        if (r.data?.code) { exportProduct = { code: r.data.code }; break; }
      } catch (_) { /* not found — try next */ }
    }
  }

  const result = { allProducts, totalCount, importProduct, exportProduct };
  productCache = { data: result, timestamp: now };
  return result;
}

// Pre-warm Agile cache every 55 minutes — keep ref for graceful shutdown
const prewarmInterval = setInterval(async () => {
  productCache.timestamp = 0;
  const warmApi = createOctopusApi();
  try {
    await findAgileProducts(warmApi);
    console.log('[AGILE CACHE] Pre-warm complete.');
  } catch (err) {
    console.error('[AGILE CACHE] Pre-warm failed:', err.message);
  }
}, 55 * 60 * 1000);

// ==================== TRACKER PRODUCT CACHE ====================
// SILVER- products are unlisted — probe candidate codes directly.
let trackerProductCache = { data: null, timestamp: 0 };
const TRACKER_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function findTrackerProduct(octopusApi) {
  const now = Date.now();
  if (trackerProductCache.data && (now - trackerProductCache.timestamp < TRACKER_CACHE_TTL)) {
    return trackerProductCache.data;
  }

  const candidates = [];
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    const y = String(d.getFullYear()).slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    for (const day of ['01', '06', '07', '14', '28']) {
      candidates.push(`SILVER-${y}-${m}-${day}`);
    }
    d.setMonth(d.getMonth() - 1);
  }

  const results = await Promise.allSettled(
    candidates.map(code => octopusApi.get(`/products/${code}/`).then(r => r.data))
  );

  const nowDate = new Date();
  const active = results
    .filter(r => r.status === 'fulfilled' && r.value?.code?.startsWith('SILVER-'))
    .map(r => r.value)
    .filter(p => !p.available_to || new Date(p.available_to) > nowDate)
    .sort((a, b) => new Date(b.available_from || 0) - new Date(a.available_from || 0));

  if (!active.length) {
    throw new Error('Could not find an active SILVER- (Tracker) product via direct probe.');
  }

  const product = { code: active[0].code };
  trackerProductCache = { data: product, timestamp: now };
  console.log(`[TRACKER CACHE] Found active product: ${product.code}`);
  return product;
}

// ==================== PUBLIC RATE ENDPOINTS ====================

app.post('/api/get-rates', validateInput, async (req, res) => {
  const { postcode } = req.body;
  if (!postcode) return res.status(400).json({ error: 'Postcode is required.' });

  const sanitizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();

  try {
    const octopusApi = createOctopusApi();

    const gspResponse = await octopusApi.get('/industry/grid-supply-points/', {
      params: { postcode: sanitizedPostcode }
    });
    if (!gspResponse.data.results || gspResponse.data.results.length === 0) {
      return res.status(404).json({ error: 'Invalid postcode or no GSP found.' });
    }
    const gsp = gspResponse.data.results[0].group_id;
    console.log(`[GSP] Found GSP: ${gsp} for postcode ${sanitizedPostcode}`);

    const productsResponse = await octopusApi.get('/products/', { params: { page_size: 500 } });
    const allProducts = productsResponse.data.results;

    const flexibleProduct = allProducts.find(p => p.code.startsWith('VAR-') && !p.code.includes('PREPAY') && !p.code.includes('KDP'));
    const fixedProduct = allProducts
      .filter(p => p.code.startsWith('OE-FIX-') && !p.code.includes('PREPAY'))
      .sort((a, b) => new Date(b.available_from) - new Date(a.available_from))[0];

    if (!flexibleProduct) {
      return res.status(500).json({ error: 'Could not find current Flexible Octopus tariff.' });
    }

    const getRatesFromProduct = async (productCode) => {
      if (!productCode) return {
        electricity: { unit: null, standing: null },
        gas: { unit: null, standing: null }
      };
      const productDetailResponse = await octopusApi.get(`/products/${productCode}/`);
      const product = productDetailResponse.data;

      const elecTariffDetails = product.single_register_electricity_tariffs[gsp];
      const gasTariffDetails  = product.single_register_gas_tariffs[gsp];

      const elecTariff = elecTariffDetails?.direct_debit_monthly || elecTariffDetails?.varying;
      const gasTariff  = gasTariffDetails?.direct_debit_monthly  || gasTariffDetails?.varying;

      const elecUnitLink    = elecTariff?.links.find(l => l.rel === 'standard_unit_rates')?.href;
      const elecStandingLink = elecTariff?.links.find(l => l.rel === 'standing_charges')?.href;
      const gasUnitLink     = gasTariff?.links.find(l => l.rel === 'standard_unit_rates')?.href;
      const gasStandingLink  = gasTariff?.links.find(l => l.rel === 'standing_charges')?.href;

      const [elecUnitRes, elecStandingRes, gasUnitRes, gasStandingRes] = await Promise.allSettled([
        elecUnitLink    ? octopusApi.get(elecUnitLink)    : Promise.resolve(null),
        elecStandingLink ? octopusApi.get(elecStandingLink) : Promise.resolve(null),
        gasUnitLink     ? octopusApi.get(gasUnitLink)     : Promise.resolve(null),
        gasStandingLink  ? octopusApi.get(gasStandingLink)  : Promise.resolve(null),
      ]);

      return {
        electricity: { unit: getVal(elecUnitRes), standing: getVal(elecStandingRes) },
        gas:         { unit: getVal(gasUnitRes),  standing: getVal(gasStandingRes) },
      };
    };

    const [flexibleRates, fixedRates] = await Promise.all([
      getRatesFromProduct(flexibleProduct.code),
      getRatesFromProduct(fixedProduct?.code),
    ]);

    // Also fetch coordinates from postcodes.io for weather feature (non-fatal if it fails)
    let latitude = null, longitude = null;
    try {
      const pcRes = await axios.get(`https://api.postcodes.io/postcodes/${sanitizedPostcode}`, { timeout: 5000 });
      latitude  = pcRes.data.result?.latitude  ?? null;
      longitude = pcRes.data.result?.longitude ?? null;
    } catch (_) {
      // coordinates are optional — don't fail the whole request
    }

    res.json({ flexible: flexibleRates, fixed: fixedRates, gsp, latitude, longitude });

  } catch (error) {
    console.error(`[GET-RATES ERROR] postcode ${sanitizedPostcode}:`, error.response ? error.response.data : error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Invalid postcode or no rates found for this area.' });
    }
    res.status(500).json({ error: 'Could not retrieve Octopus Energy rates.' });
  }
});

app.post('/api/get-agile-rates', validateInput, async (req, res) => {
  const { region, date } = req.body;
  if (!region) return res.status(400).json({ error: 'A valid single-letter DNO region code is required.' });

  try {
    const octopusApi = createOctopusApi();

    const { allProducts, totalCount, importProduct, exportProduct } = await findAgileProducts(octopusApi);
    console.log(`[AGILE] Products scanned: ${allProducts.length}/${totalCount}. Import: ${importProduct?.code || 'NOT FOUND'}, Export: ${exportProduct?.code || 'NOT FOUND'}`);

    if (!importProduct) {
      return res.status(500).json({ error: 'Could not find Agile tariff product.' });
    }

    let period_from, period_to;
    if (date) {
      period_from = `${date}T00:00:00Z`;
      period_to   = `${date}T23:30:00Z`;
    } else {
      const now   = new Date();
      period_from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      period_to   = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    }

    const fetchRates = async (productCode) => {
      const tariffCode = `E-1R-${productCode}-${region}`;
      const url = `/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/`;
      const response = await octopusApi.get(url, { params: { period_from, period_to, page_size: 1500 } });
      return response.data.results;
    };

    const [importRates, exportRates] = await Promise.allSettled([
      fetchRates(importProduct.code),
      exportProduct ? fetchRates(exportProduct.code) : Promise.resolve([]),
    ]);

    res.json({
      import:           importRates.status === 'fulfilled' ? importRates.value : [],
      export:           exportRates.status === 'fulfilled' ? exportRates.value : [],
      agileProductCode: importProduct.code,
    });

  } catch (error) {
    console.error(`[AGILE ERROR] region ${region}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve Octopus Agile rates.' });
  }
});

app.post('/api/get-historical-agile-rates', historicalLimiter, validateInput, async (req, res) => {
  const { region, dateFrom, dateTo } = req.body;
  if (!region)              return res.status(400).json({ error: 'A valid single-letter DNO region code is required.' });
  if (!dateFrom || !dateTo) return res.status(400).json({ error: 'dateFrom and dateTo are required.' });

  try {
    const octopusApi = createOctopusApi();
    octopusApi.defaults.timeout = 30000; // longer timeout for paginated multi-product fetches

    const { importProduct, exportProduct } = await findAgileProducts(octopusApi);
    if (!importProduct) return res.status(500).json({ error: 'Could not find Agile tariff product.' });

    const period_from = `${dateFrom}T00:00:00Z`;
    const period_to   = `${dateTo}T23:30:00Z`;

    // Determine which Agile product codes cover the requested date range
    const importCodes = getRelevantProductCodes(KNOWN_AGILE_PRODUCTS, importProduct.code, dateFrom, dateTo);

    // Paginated fetch for a single (productCode, suffix) combination — follows next links
    async function fetchAllPages(productCode, suffix) {
      const tariffCode = `E-1R-${productCode}-${region}`;
      const baseUrl    = `/products/${productCode}/electricity-tariffs/${tariffCode}/${suffix}/`;
      let results  = [];
      let nextPath = null;
      const params = { period_from, period_to, page_size: 25000 };
      do {
        const response = nextPath
          ? await octopusApi.get(nextPath)
          : await octopusApi.get(baseUrl, { params });
        results  = results.concat(response.data.results || []);
        nextPath = response.data.next
          ? response.data.next.replace(/^https:\/\/api\.octopus\.energy\/v1/, '')
          : null;
      } while (nextPath);
      return results;
    }

    // Fetch import rates across all relevant product codes in parallel, then merge
    const importPerProduct = await Promise.allSettled(
      importCodes.map(code => fetchAllPages(code, 'standard-unit-rates'))
    );
    const rawImport = importPerProduct
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate by valid_from — adjacent products may share a boundary slot
    function dedupe(rates) {
      const seen = new Set();
      return rates.filter(r => {
        if (seen.has(r.valid_from)) return false;
        seen.add(r.valid_from);
        return true;
      });
    }

    // Export: single current product, paginated — export product history is not tracked
    let exportRates = [];
    if (exportProduct) {
      try { exportRates = await fetchAllPages(exportProduct.code, 'standard-unit-rates'); }
      catch (_) { /* export data is supplementary — ignore failures */ }
    }

    res.json({
      import: dedupe(rawImport),
      export: dedupe(exportRates),
    });

  } catch (error) {
    console.error(`[AGILE HIST ERROR] region ${region}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve historical Agile rates.' });
  }
});

app.post('/api/get-tracker-rates', validateInput, async (req, res) => {
  const { region } = req.body;
  if (!region) return res.status(400).json({ error: 'A valid single-letter DNO region code is required.' });

  try {
    const octopusApi = createOctopusApi();

    const trackerProduct = await findTrackerProduct(octopusApi);
    console.log(`[TRACKER] Using product: ${trackerProduct.code}`);

    const now      = new Date();
    const from14   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() +  2 * 24 * 60 * 60 * 1000);
    const period_from = from14.toISOString().slice(0, 10) + 'T00:00:00Z';
    const period_to   = tomorrow.toISOString().slice(0, 10) + 'T23:59:59Z';
    const params = { period_from, period_to, page_size: 100 };

    const elecBase = `/products/${trackerProduct.code}/electricity-tariffs/E-1R-${trackerProduct.code}-${region}`;
    const gasBase  = `/products/${trackerProduct.code}/gas-tariffs/G-1R-${trackerProduct.code}-${region}`;

    const [elecRates, elecStanding, gasRates, gasStanding] = await Promise.allSettled([
      octopusApi.get(`${elecBase}/standard-unit-rates/`, { params }),
      octopusApi.get(`${elecBase}/standing-charges/`,    { params }),
      octopusApi.get(`${gasBase}/standard-unit-rates/`,  { params }),
      octopusApi.get(`${gasBase}/standing-charges/`,     { params }),
    ]);

    res.json({
      electricity:        { rates: getResults(elecRates), standing: getResults(elecStanding) },
      gas:                { rates: getResults(gasRates),  standing: getResults(gasStanding)  },
      trackerProductCode: trackerProduct.code,
    });

  } catch (error) {
    console.error(`[TRACKER ERROR] region ${region}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve Octopus Tracker rates.' });
  }
});

// ==================== KNOWN TRACKER PRODUCTS ====================
// Hardcoded list of confirmed historical SILVER- product codes.
// The current live product is discovered dynamically by findTrackerProduct().
const KNOWN_TRACKER_PRODUCTS = [
  { code: 'SILVER-23-12-06', label: 'Tracker Dec 2023',  activeFrom: '2023-12-06' },
  { code: 'SILVER-24-04-01', label: 'Tracker Apr 2024',  activeFrom: '2024-04-01' },
  { code: 'SILVER-24-07-01', label: 'Tracker Jul 2024',  activeFrom: '2024-07-01' },
  { code: 'SILVER-24-10-01', label: 'Tracker Oct 2024',  activeFrom: '2024-10-01' },
  { code: 'SILVER-25-01-01', label: 'Tracker Jan 2025',  activeFrom: '2025-01-01' },
  { code: 'SILVER-25-04-01', label: 'Tracker Apr 2025',  activeFrom: '2025-04-01' },
  { code: 'SILVER-25-07-01', label: 'Tracker Jul 2025',  activeFrom: '2025-07-01' },
  { code: 'SILVER-25-10-01', label: 'Tracker Oct 2025',  activeFrom: '2025-10-01' },
  { code: 'SILVER-26-01-01', label: 'Tracker Jan 2026',  activeFrom: '2026-01-01' },
  { code: 'SILVER-26-04-01', label: 'Tracker Apr 2026',  activeFrom: '2026-04-01' },
];

// ==================== KNOWN AGILE PRODUCTS ====================
// Historical Agile product codes in chronological order.
// Used by the multi-product historical fetch to cover date ranges
// that span more than one Agile product revision.
const KNOWN_AGILE_PRODUCTS = [
  { code: 'AGILE-FLEX-22-11-25', activeFrom: '2022-11-25' },
  { code: 'AGILE-24-10-01',      activeFrom: '2024-10-01' },
];

/**
 * Returns the subset of a known-products list whose active window
 * overlaps with [dateFrom, dateTo]. Each entry needs { code, activeFrom }.
 * A product is considered active until the next entry's activeFrom.
 * currentCode (the live product) is always appended if not already in the list.
 */
function getRelevantProductCodes(knownProducts, currentCode, dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00Z');
  const to   = new Date(dateTo   + 'T23:59:59Z');

  const sorted = [...knownProducts].sort(
    (a, b) => new Date(a.activeFrom) - new Date(b.activeFrom)
  );

  if (currentCode && !sorted.some(p => p.code === currentCode)) {
    sorted.push({ code: currentCode, activeFrom: new Date().toISOString().slice(0, 10) });
  }

  const relevant = [];
  for (let i = 0; i < sorted.length; i++) {
    const productStart = new Date(sorted[i].activeFrom + 'T00:00:00Z');
    const productEnd   = sorted[i + 1]
      ? new Date(sorted[i + 1].activeFrom + 'T00:00:00Z')
      : new Date('2099-01-01T00:00:00Z');

    if (productStart < to && productEnd > from) {
      relevant.push(sorted[i].code);
    }
  }
  return relevant.length > 0 ? relevant : (currentCode ? [currentCode] : []);
}

app.get('/api/get-tracker-products', historicalLimiter, async (req, res) => {
  try {
    const octopusApi = createOctopusApi();
    const currentProduct = await findTrackerProduct(octopusApi);
    const currentCode = currentProduct.code;
    // Build list: known historical + current (deduplicated, current marked)
    const known = KNOWN_TRACKER_PRODUCTS.filter(p => p.code !== currentCode);
    const products = [
      { code: currentCode, label: `Current (${currentCode})`, activeFrom: null, isCurrent: true },
      ...known.reverse(), // most recent first
    ];
    res.json({ products });
  } catch (error) {
    console.error('[TRACKER PRODUCTS ERROR]', error.message);
    res.status(500).json({ error: 'Could not retrieve tracker product list.' });
  }
});

app.get('/api/get-iog-eligibility-options', historicalLimiter, async (req, res) => {
  try {
    const now = Date.now();
    if (iogEligibilityCache.data && (now - iogEligibilityCache.timestamp < IOG_CACHE_TTL)) {
      return res.json({
        ...iogEligibilityCache.data,
        checkedAt: new Date(iogEligibilityCache.timestamp).toISOString(),
        stale: false,
      });
    }

    const normalized = await getLiveIogCatalog();
    iogEligibilityCache = {
      data: normalized,
      timestamp: now,
    };

    res.json({
      ...normalized,
      checkedAt: new Date(now).toISOString(),
      stale: false,
    });
  } catch (error) {
    console.error('[IOG] Failed to refresh eligibility catalog:', error.message);

    if (iogEligibilityCache.data) {
      return res.json({
        ...iogEligibilityCache.data,
        checkedAt: new Date(iogEligibilityCache.timestamp).toISOString(),
        stale: true,
        warning: 'Using cached Intelligent Octopus Go compatibility data.',
      });
    }

    res.status(503).json({ error: 'Intelligent Octopus Go compatibility data is unavailable.' });
  }
});

app.post('/api/get-historical-tracker-rates', historicalLimiter, validateInput, async (req, res) => {
  const { region, dateFrom, dateTo, productCode } = req.body;
  if (!region)             return res.status(400).json({ error: 'A valid single-letter DNO region code is required.' });
  if (!dateFrom || !dateTo) return res.status(400).json({ error: 'dateFrom and dateTo are required.' });

  // Validate optional productCode against known list to prevent arbitrary injection.
  // Also accept the current live product code (discovered dynamically) in case it hasn't
  // yet been added to the KNOWN_TRACKER_PRODUCTS hardcoded list.
  // Use !== null/undefined check (not falsy) so empty string "" is caught, not silently skipped.
  if (productCode !== undefined && productCode !== null) {
    if (typeof productCode !== 'string' || productCode.trim() === '') {
      return res.status(400).json({ error: 'productCode must be a non-empty string if provided.' });
    }
    const validCodes = KNOWN_TRACKER_PRODUCTS.map(p => p.code);
    const currentCode = trackerProductCache.data?.code;
    if (currentCode && !validCodes.includes(currentCode)) validCodes.push(currentCode);
    if (!validCodes.includes(productCode)) {
      return res.status(400).json({ error: 'Unknown product code.' });
    }
  }

  try {
    const octopusApi = createOctopusApi();
    const period_from = `${dateFrom}T00:00:00Z`;
    const period_to   = `${dateTo}T23:59:59Z`;

    if (productCode) {
      // ── Single specific product (TrackerHistoricalData dropdown) ────────────
      console.log(`[TRACKER HIST] Using product: ${productCode}`);
      const params   = { period_from, period_to, page_size: 1500 };
      const elecBase = `/products/${productCode}/electricity-tariffs/E-1R-${productCode}-${region}`;
      const gasBase  = `/products/${productCode}/gas-tariffs/G-1R-${productCode}-${region}`;
      const [elecRates, elecStanding, gasRates, gasStanding] = await Promise.allSettled([
        octopusApi.get(`${elecBase}/standard-unit-rates/`, { params }),
        octopusApi.get(`${elecBase}/standing-charges/`,    { params }),
        octopusApi.get(`${gasBase}/standard-unit-rates/`,  { params }),
        octopusApi.get(`${gasBase}/standing-charges/`,     { params }),
      ]);
      return res.json({
        electricity:        { rates: getResults(elecRates), standing: getResults(elecStanding) },
        gas:                { rates: getResults(gasRates),  standing: getResults(gasStanding)  },
        trackerProductCode: productCode,
      });
    }

    // ── No specific product: aggregate across all relevant SILVER- products ───
    // Used by TariffCostComparison — covers multi-year date ranges correctly.
    octopusApi.defaults.timeout = 30000;
    const currentTrackerProduct = await findTrackerProduct(octopusApi);
    const relevantCodes = getRelevantProductCodes(
      KNOWN_TRACKER_PRODUCTS, currentTrackerProduct.code, dateFrom, dateTo
    );
    console.log(`[TRACKER HIST] Aggregating products: ${relevantCodes.join(', ')}`);

    async function fetchTrackerPath(code, path) {
      const params = { period_from, period_to, page_size: 1500 };
      try {
        const r = await octopusApi.get(path.replace(/\{CODE\}/g, code), { params });
        return r.data.results || [];
      } catch (_) { return []; }
    }

    // 4 fetches per product code — all launched in parallel
    const allFetches = relevantCodes.flatMap(code => [
      fetchTrackerPath(code, `/products/{CODE}/electricity-tariffs/E-1R-{CODE}-${region}/standard-unit-rates/`),
      fetchTrackerPath(code, `/products/{CODE}/electricity-tariffs/E-1R-{CODE}-${region}/standing-charges/`),
      fetchTrackerPath(code, `/products/{CODE}/gas-tariffs/G-1R-{CODE}-${region}/standard-unit-rates/`),
      fetchTrackerPath(code, `/products/{CODE}/gas-tariffs/G-1R-{CODE}-${region}/standing-charges/`),
    ]);
    const fetched = await Promise.all(allFetches);

    // fetched layout per product: index i*4+0=elecRates, i*4+1=elecSC, i*4+2=gasRates, i*4+3=gasSC
    function mergeByIndex(offset) {
      const merged = [];
      for (let i = 0; i < relevantCodes.length; i++) merged.push(...fetched[i * 4 + offset]);
      const seen = new Set();
      return merged.filter(r => {
        if (seen.has(r.valid_from)) return false;
        seen.add(r.valid_from);
        return true;
      });
    }

    res.json({
      electricity:        { rates: mergeByIndex(0), standing: mergeByIndex(1) },
      gas:                { rates: mergeByIndex(2), standing: mergeByIndex(3) },
      trackerProductCode: relevantCodes[relevantCodes.length - 1] ?? currentTrackerProduct.code,
    });

  } catch (error) {
    console.error(`[TRACKER HIST ERROR] region ${region}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve historical Tracker rates.' });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (req, res) => {
  const checkedAt = new Date();
  try {
    const probeApi = createOctopusApi();
    probeApi.defaults.timeout = 5000; // tighter timeout for health probes
    await probeApi.get('/products/', { params: { page_size: 1 } });
    res.json({
      status: 'ok',
      ok: true,
      octopus: true,
      checkedAt: checkedAt.toISOString(),
      startedAt: STARTED_AT.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: require('./package.json').version,
      extensionExpectedVersion: getExpectedExtensionVersion(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      ok: false,
      octopus: false,
      checkedAt: checkedAt.toISOString(),
      startedAt: STARTED_AT.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      error: 'Octopus API probe failed.',
    });
  }
});

// ==================== EXTENSION METADATA ====================
// These endpoints support the Chrome extension System Health, release banner,
// and feature-flag cache. They do not touch Octopus/Kraken API contracts.
app.get('/api/version', generalLimiter, (req, res) => {
  const expected = getExpectedExtensionVersion();
  res.json({
    expected,
    version: expected,
    checkedAt: new Date().toISOString(),
  });
});

app.get('/api/feature-flags', generalLimiter, (req, res) => {
  res.json(getFeatureFlags());
});

app.get('/api/announcements', generalLimiter, (req, res) => {
  res.json({
    announcements: getAnnouncements(),
    checkedAt: new Date().toISOString(),
  });
});

// ==================== ALERT STATUS ====================
// GET /api/get-alert-status — aggregates active alert conditions across two tiers:
//   red  : any sampled Agile region >50p or <0p in the current half-hour slot
//   green: national carbon intensity index = 'very low'
// Grid-stress (amber) is deferred until NESO CKAN credentials are available.

let alertStatusCache = { data: null, timestamp: 0 };
const ALERT_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

async function checkAgileExtremes() {
  const octopusApi = createOctopusApi();
  const { importProduct } = await findAgileProducts(octopusApi);
  if (!importProduct) return null;

  const todayStr      = new Date().toISOString().slice(0, 10);
  const SAMPLE_REGIONS = ['H', 'J', 'A', 'K'];

  const rateResults = await Promise.allSettled(
    SAMPLE_REGIONS.map(r => {
      const tariffCode = `E-1R-${importProduct.code}-${r}`;
      return octopusApi.get(
        `/products/${importProduct.code}/electricity-tariffs/${tariffCode}/standard-unit-rates/`,
        { params: { period_from: `${todayStr}T00:00:00Z`, period_to: `${todayStr}T23:30:00Z`, page_size: 48 } }
      );
    })
  );

  const now = new Date();
  const extremeRegions = [];
  rateResults.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const rates   = r.value.data.results || [];
    const current = rates.find(slot =>
      now >= new Date(slot.valid_from) && now < new Date(slot.valid_to)
    );
    if (current && (current.value_inc_vat > 50 || current.value_inc_vat < 0)) {
      extremeRegions.push(`${SAMPLE_REGIONS[i]} (${current.value_inc_vat.toFixed(1)}p)`);
    }
  });

  if (!extremeRegions.length) return null;
  return {
    tier:    'red',
    message: `🔴 Agile ALERT: Extreme rates in region(s) ${extremeRegions.join(', ')} — customers may call about costs`,
  };
}

async function checkCarbonExceptional() {
  const ciRes = await axios.get('https://api.carbonintensity.org.uk/intensity', { timeout: 8000 });
  const index = ciRes.data?.data?.[0]?.intensity?.index;
  if (index !== 'very low') return null;
  return {
    tier:    'green',
    message: '🟢 Exceptional: Grid carbon intensity is Very Low right now — great time for high-energy tasks',
  };
}

app.get('/api/get-alert-status', generalLimiter, async (req, res) => {
  const now = Date.now();
  if (alertStatusCache.data && (now - alertStatusCache.timestamp < ALERT_CACHE_TTL)) {
    return res.json(alertStatusCache.data);
  }

  const [redCheck, greenCheck] = await Promise.allSettled([
    checkAgileExtremes(),
    checkCarbonExceptional(),
  ]);

  const alerts = [];
  if (redCheck.status   === 'fulfilled' && redCheck.value)   alerts.push(redCheck.value);
  if (greenCheck.status === 'fulfilled' && greenCheck.value) alerts.push(greenCheck.value);

  const result = { alerts };
  alertStatusCache = { data: result, timestamp: now };
  console.log(`[ALERT STATUS] ${alerts.length} alert(s) active.`);
  res.json(result);
});

// ==================== CARBON INTENSITY ====================
app.get('/api/get-carbon-intensity', historicalLimiter, async (req, res) => {
  try {
    const now  = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to   = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const response = await axios.get(`https://api.carbonintensity.org.uk/intensity/${from.toISOString()}/${to.toISOString()}`, { timeout: 10000 });
    const count = response.data?.data?.length ?? 0;
    console.log(`[CARBON] OK — ${count} slots returned.`);
    res.json(response.data);

  } catch (error) {
    console.error('[CARBON ERROR]', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve Carbon Intensity data.' });
  }
});

// ==================== HISTORICAL CARBON INTENSITY ====================
// GET /api/get-historical-carbon-intensity?from=YYYY-MM-DD&to=YYYY-MM-DD
// Proxies to carbonintensity.org.uk — returns 30-min blocks matching Agile settlement periods.

const DATE_RE_CI = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/get-historical-carbon-intensity', historicalLimiter, async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Both from and to date parameters are required (YYYY-MM-DD).' });
  }
  if (typeof from !== 'string' || typeof to !== 'string' ||
      !DATE_RE_CI.test(from) || !DATE_RE_CI.test(to)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
  }
  if (!isRealDate(from) || !isRealDate(to)) {
    return res.status(400).json({ error: 'One or both dates are not valid calendar dates (e.g. Feb 30 is not valid).' });
  }

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate   = new Date(to   + 'T23:59:59Z');

  if (fromDate < MIN_DATE) {
    return res.status(400).json({ error: 'from date must be on or after 2016-01-01.' });
  }
  if (fromDate > toDate) {
    return res.status(400).json({ error: 'from date must be before or equal to to date.' });
  }
  const rangeDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
  if (rangeDays > 31) {
    return res.status(400).json({ error: 'Date range must not exceed 31 days for carbon intensity data.' });
  }

  try {
    const url = `https://api.carbonintensity.org.uk/intensity/${from}T00:00Z/${to}T23:30Z`;
    const response = await axios.get(url, { timeout: 10000 });
    const count = response.data?.data?.length ?? 0;
    console.log(`[HIST-CARBON] OK — ${count} slots from ${from} to ${to}`);
    res.json(response.data);
  } catch (error) {
    console.error('[HIST-CARBON ERROR]', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Could not retrieve historical carbon intensity data.' });
  }
});

// ==================== WEATHER ENDPOINT ====================

const POST_RE_WEATHER = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

app.get('/api/get-weather', historicalLimiter, async (req, res) => {
  const raw = (req.query.postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!raw || !POST_RE_WEATHER.test(raw)) {
    return res.status(400).json({ error: 'A valid UK postcode is required.' });
  }

  try {
    // 1. postcodes.io → lat/lng + district name
    const pcRes = await axios.get(`https://api.postcodes.io/postcodes/${raw}`, { timeout: 5000 });
    if (!pcRes.data.result) return res.status(404).json({ error: 'Postcode not found.' });
    const { latitude, longitude, admin_district } = pcRes.data.result;

    // 2. Open-Meteo archive — last 30 days (up to yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(yesterday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const fmt = (d) => d.toISOString().slice(0, 10);

    const weatherRes = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude,
        longitude,
        start_date:   fmt(thirtyDaysAgo),
        end_date:     fmt(yesterday),
        daily:        'sunshine_duration,temperature_2m_max,shortwave_radiation_sum,precipitation_sum',
        timezone:     'Europe/London',
      },
      timeout: 10000,
    });

    const daily = weatherRes.data.daily;

    // sunshine_duration comes in seconds — convert to hours
    const sunshineHours = (daily.sunshine_duration || []).map(s => parseFloat((s / 3600).toFixed(2)));

    res.json({
      location: {
        postcode:  raw,
        district:  admin_district || raw,
        lat:       latitude,
        lng:       longitude,
      },
      weather: {
        dates:        daily.time,
        sunshineHours,
        maxTemps:     daily.temperature_2m_max,
        radiation:    daily.shortwave_radiation_sum,
        precipitation: daily.precipitation_sum,
      },
    });

    console.log(`[WEATHER] OK — ${raw} (${admin_district}) — ${daily.time.length} days returned.`);

  } catch (error) {
    console.error('[WEATHER ERROR]', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not retrieve weather data for this postcode.' });
  }
});

// ==================== TARIFF COMPARISON RATES ====================
// Returns current Flexible + Fixed electricity unit rates + standing charges for a region,
// plus the Agile standing charge. Used by TariffCostComparison.jsx.

app.get('/api/get-comparison-rates', historicalLimiter, async (req, res) => {
  const region = (req.query.region || '').toUpperCase();
  if (!REGION_RE.test(region)) {
    return res.status(400).json({ error: 'Valid DNO region letter required (A–P, excluding I and O).' });
  }

  try {
    const octopusApi = createOctopusApi();

    // Octopus product API uses underscore-prefix GSP keys (e.g. "_H" not "H")
    const gspKey = `_${region}`;

    // Fetch product list + Agile cache in parallel
    const [productsRes, agileResult] = await Promise.allSettled([
      octopusApi.get('/products/', { params: { page_size: 500 } }),
      findAgileProducts(octopusApi),
    ]);

    if (productsRes.status !== 'fulfilled') {
      return res.status(500).json({ error: 'Could not fetch Octopus product list.' });
    }

    const allProducts = productsRes.value.data.results || [];
    const flexibleProduct = allProducts.find(
      p => p.code.startsWith('VAR-') && !p.code.includes('PREPAY') && !p.code.includes('KDP')
    );
    const fixedProduct = allProducts
      .filter(p => p.code.startsWith('OE-FIX-') && !p.code.includes('PREPAY'))
      .sort((a, b) => new Date(b.available_from) - new Date(a.available_from))[0];

    // Fetch the electricity unit rate + standing charge for a product code
    const getElecRatesForProduct = async (productCode) => {
      if (!productCode) return { unitRate: null, standingCharge: null };
      try {
        const productRes = await octopusApi.get(`/products/${productCode}/`);
        const tariffDetails = productRes.data.single_register_electricity_tariffs?.[gspKey];
        const tariff = tariffDetails?.direct_debit_monthly || tariffDetails?.varying;
        if (!tariff) return { unitRate: null, standingCharge: null };

        const unitLink     = tariff.links?.find(l => l.rel === 'standard_unit_rates')?.href;
        const standingLink = tariff.links?.find(l => l.rel === 'standing_charges')?.href;

        const [unitRes, standRes] = await Promise.allSettled([
          unitLink     ? octopusApi.get(unitLink)     : Promise.resolve(null),
          standingLink ? octopusApi.get(standingLink) : Promise.resolve(null),
        ]);

        return { unitRate: getVal(unitRes), standingCharge: getVal(standRes) };
      } catch {
        return { unitRate: null, standingCharge: null };
      }
    };

    // Agile standing charge (unit rates are half-hourly — fetched by frontend historical call)
    let agileStandingCharge = null;
    if (agileResult.status === 'fulfilled' && agileResult.value.importProduct) {
      try {
        const agileCode    = agileResult.value.importProduct.code;
        const agileRes     = await octopusApi.get(`/products/${agileCode}/`);
        const agileTariff  = agileRes.data.single_register_electricity_tariffs?.[gspKey];
        const agile        = agileTariff?.direct_debit_monthly || agileTariff?.varying;
        const standLink    = agile?.links?.find(l => l.rel === 'standing_charges')?.href;
        if (standLink) {
          const standRes = await octopusApi.get(standLink);
          agileStandingCharge = standRes.data.results?.[0]?.value_inc_vat ?? null;
        }
      } catch { /* non-fatal — comparison works without it */ }
    }

    const [flexRates, fixRates] = await Promise.all([
      getElecRatesForProduct(flexibleProduct?.code),
      getElecRatesForProduct(fixedProduct?.code),
    ]);

    console.log(`[COMPARISON RATES] Region ${region} — Flex: ${flexRates.unitRate}p, Fix: ${fixRates.unitRate}p, Agile SC: ${agileStandingCharge}p`);

    res.json({
      flexible: flexRates,
      fixed:    fixRates,
      agile:    { standingCharge: agileStandingCharge },
    });

  } catch (error) {
    console.error(`[COMPARISON RATES ERROR] region ${region}:`, error.message);
    res.status(500).json({ error: 'Could not retrieve comparison rates.' });
  }
});

// ==================== OUTGOING OCTOPUS RATES ====================
// POST /api/get-outgoing-rates — returns current Outgoing Octopus export rate for a region.
// Searches public product listing for active OUTGOING- products.

let outgoingProductCache = { data: null, timestamp: 0 };
const OUTGOING_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function findOutgoingProduct(octopusApi) {
  const now = Date.now();
  if (outgoingProductCache.data && (now - outgoingProductCache.timestamp < OUTGOING_CACHE_TTL)) {
    return outgoingProductCache.data;
  }

  const firstPage = await octopusApi.get('/products/', { params: { page_size: 100 } });
  let allProducts = [...firstPage.data.results];

  if (firstPage.data.count > 100) {
    const totalPages = Math.min(Math.ceil(firstPage.data.count / 100), 8);
    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        octopusApi.get('/products/', { params: { page_size: 100, page: i + 2 } }).catch(() => null)
      )
    );
    extras.forEach(r => { if (r?.data?.results) allProducts = allProducts.concat(r.data.results); });
  }

  const nowDate = new Date();
  // Prefer OUTGOING-OCTOPUS- prefix (standard SEG product), fallback to OUTGOING- prefix
  const candidates = allProducts.filter(p =>
    (p.code.startsWith('OUTGOING-OCTOPUS-') || p.code.startsWith('OUTGOING-FIX-')) &&
    (!p.available_to || new Date(p.available_to) > nowDate)
  );

  if (!candidates.length) {
    // Broader fallback — any OUTGOING- product that's active
    const broader = allProducts.filter(p =>
      p.code.startsWith('OUTGOING-') &&
      !p.code.startsWith('OUTGOING-AGILE') &&
      (!p.available_to || new Date(p.available_to) > nowDate)
    );
    if (!broader.length) throw new Error('No active Outgoing Octopus product found in product listing.');
    candidates.push(...broader);
  }

  // Pick most recently available
  candidates.sort((a, b) => new Date(b.available_from || 0) - new Date(a.available_from || 0));
  const product = { code: candidates[0].code };
  outgoingProductCache = { data: product, timestamp: now };
  console.log(`[OUTGOING CACHE] Found active product: ${product.code}`);
  return product;
}

app.post('/api/get-outgoing-rates', validateInput, async (req, res) => {
  const { region } = req.body;
  if (!region) return res.status(400).json({ error: 'A valid single-letter DNO region code is required.' });

  try {
    const octopusApi = createOctopusApi();
    const product    = await findOutgoingProduct(octopusApi);
    const productCode = product.code;
    const gspKey     = `_${region}`;

    const productDetail = await octopusApi.get(`/products/${productCode}/`);
    const tariffs = productDetail.data.single_register_electricity_tariffs?.[gspKey];
    const tariff  = tariffs?.direct_debit_monthly || tariffs?.varying;

    if (!tariff) {
      return res.status(404).json({ error: `No Outgoing tariff found for region ${region}.` });
    }

    const unitLink     = tariff.links?.find(l => l.rel === 'standard_unit_rates')?.href;
    const standingLink = tariff.links?.find(l => l.rel === 'standing_charges')?.href;

    const [unitRes, standRes] = await Promise.allSettled([
      unitLink     ? octopusApi.get(unitLink)     : Promise.resolve(null),
      standingLink ? octopusApi.get(standingLink) : Promise.resolve(null),
    ]);

    const exportRate     = getVal(unitRes);
    const standingCharge = getVal(standRes);

    console.log(`[OUTGOING] Region ${region} — export: ${exportRate}p, standing: ${standingCharge}p`);

    res.json({ exportRate, standingCharge, productCode, region });

  } catch (error) {
    console.error('[OUTGOING ERROR]', error.message);
    res.status(500).json({ error: 'Could not retrieve Outgoing Octopus rates.' });
  }
});

// ==================== THIRD-PARTY API INTEGRATIONS ====================
// Carbon Intensity (generation mix + regional), Sheffield Solar, Open Charge Map, Elexon BMRS.
// All purely additive — no existing endpoints modified.

// ── Module-level constants / caches ───────────────────────────────────────────

// Carbon Intensity API: Octopus DNO region letter (A–P) → CI regionid (1–14)
const CI_REGION_MAP = { A:9, B:10, C:8, D:6, E:5, F:4, G:3, H:14, J:13, K:11, L:12, M:1, N:2, P:7 };

// Sheffield Solar 15-min in-memory cache
let solarCache = { data: null, timestamp: 0 };
const SOLAR_CACHE_TTL = 15 * 60 * 1000;

// Elexon BMRS per-date cache (completed settlement days are immutable)
const settlementCache = new Map();
const SETTLEMENT_CACHE_TTL = 24 * 60 * 60 * 1000;

// OCM API key — must be set in .env
const OCM_API_KEY = process.env.OCM_API_KEY;
if (!OCM_API_KEY) {
  console.warn('[STARTUP] OCM_API_KEY not set in .env — GET /api/get-nearby-chargers will return 503.');
}

// ── GET /api/get-generation-mix ───────────────────────────────────────────────
// Proxies to carbonintensity.org.uk/generation — live UK fuel mix breakdown.
app.get('/api/get-generation-mix', generalLimiter, async (req, res) => {
  try {
    const response = await axios.get('https://api.carbonintensity.org.uk/generation', { timeout: 10000 });
    const count = response.data?.data?.generationmix?.length ?? 0;
    console.log(`[GEN-MIX] OK — ${count} fuel type(s) in mix.`);
    res.json(response.data);
  } catch (error) {
    console.error('[GEN-MIX ERROR]', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not retrieve UK generation mix data.' });
  }
});

// ── GET /api/get-regional-carbon?region=H ────────────────────────────────────
// Proxies to carbonintensity.org.uk/regional — filters to the matching DNO region.
app.get('/api/get-regional-carbon', generalLimiter, async (req, res) => {
  const region = (req.query.region || '').toUpperCase();
  if (!REGION_RE.test(region)) {
    return res.status(400).json({ error: 'Valid DNO region letter required (A–P, excluding I and O).' });
  }
  const regionId = CI_REGION_MAP[region];
  if (!regionId) {
    return res.status(400).json({ error: `No Carbon Intensity region mapping for region ${region}.` });
  }

  try {
    const response = await axios.get('https://api.carbonintensity.org.uk/regional', { timeout: 10000 });
    const regions = response.data?.data?.[0]?.regions || [];
    const match = regions.find(r => r.regionid === regionId);
    if (!match) {
      return res.status(404).json({ error: `Regional carbon data not found for region ${region}.` });
    }
    console.log(`[REGIONAL-CI] Region ${region} (CI id ${regionId} — ${match.shortname}) — index: ${match.intensity?.index}`);
    res.json({
      regionId,
      shortname:     match.shortname,
      intensity:     match.intensity,
      generationmix: match.generationmix || [],
    });
  } catch (error) {
    console.error('[REGIONAL-CI ERROR]', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not retrieve regional carbon intensity data.' });
  }
});

// ── GET /api/get-solar-generation ────────────────────────────────────────────
// Proxies to Sheffield Solar PV_Live — GSP 0 = national aggregate.
// Response: { data: [[gsp_id, datetime_gmt, generation_mw, capacity_mwp, uncertainty_mw]], meta: [...] }
// 15-min in-memory cache (upstream updates every 30 min). No API key required.
app.get('/api/get-solar-generation', generalLimiter, async (req, res) => {
  const now = Date.now();
  if (solarCache.data && (now - solarCache.timestamp < SOLAR_CACHE_TTL)) {
    console.log('[SOLAR] Using cached data.');
    return res.json(solarCache.data);
  }

  try {
    const response = await axios.get('https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0', { timeout: 10000 });
    const raw = response.data;
    solarCache = { data: raw, timestamp: now };
    const mw = Array.isArray(raw?.data?.[0]) ? raw.data[0][2] : '?';
    console.log(`[SOLAR] OK — national generation: ${mw} MW`);
    res.json(raw);
  } catch (error) {
    console.error('[SOLAR ERROR]', error.response?.data || error.message);
    // Serve stale cache if available rather than hard-failing
    if (solarCache.data) {
      console.warn('[SOLAR] Upstream failed — serving stale cache.');
      return res.json(solarCache.data);
    }
    res.status(500).json({ error: 'Could not retrieve solar generation data.' });
  }
});

// ── GET /api/get-nearby-chargers?postcode=SW1A1AA ────────────────────────────
// Step 1: postcodes.io → lat/lng. Step 2: Open Charge Map POI within 2 miles.
// Requires OCM_API_KEY in .env.
const POST_RE_CHARGER = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

app.get('/api/get-nearby-chargers', historicalLimiter, async (req, res) => {
  if (!OCM_API_KEY) {
    return res.status(503).json({ error: 'Charger lookup is not configured on this server.' });
  }
  const raw = (req.query.postcode || '').replace(/\s+/g, '').toUpperCase();
  if (!raw || !POST_RE_CHARGER.test(raw)) {
    return res.status(400).json({ error: 'A valid UK postcode is required.' });
  }

  try {
    // Step 1: resolve postcode → lat/lng
    const pcRes = await axios.get(`https://api.postcodes.io/postcodes/${raw}`, { timeout: 5000 });
    if (!pcRes.data.result) return res.status(404).json({ error: 'Postcode not found.' });
    const { latitude, longitude } = pcRes.data.result;

    // Step 2: Open Charge Map points of interest
    const ocmRes = await axios.get('https://api.openchargemap.io/v3/poi/', {
      params: {
        output:       'json',
        countrycode:  'GB',
        latitude,
        longitude,
        distance:     2,
        distanceunit: 'Miles',
        maxresults:   5,
        compact:      true,
        verbose:      false,
        key:          OCM_API_KEY,
      },
      timeout: 10000,
    });

    const pois = Array.isArray(ocmRes.data) ? ocmRes.data : [];

    // Normalise to a clean shape — never expose the raw OCM payload
    const chargers = pois.map(poi => ({
      name:       poi.AddressInfo?.Title || 'Unknown',
      distanceMi: typeof poi.AddressInfo?.Distance === 'number'
        ? Math.round(poi.AddressInfo.Distance * 10) / 10
        : null,
      address: [poi.AddressInfo?.AddressLine1, poi.AddressInfo?.Town]
        .filter(Boolean).join(', ') || null,
      status:     poi.StatusType?.Title || 'Unknown',
      connectors: (poi.Connections || []).map(c => ({
        type:    c.ConnectionType?.Title || 'Unknown',
        powerKW: c.PowerKW || null,
      })),
    }));

    console.log(`[CHARGERS] ${raw} — ${chargers.length} results within 2 miles.`);
    res.json({ postcode: raw, latitude, longitude, chargers });

  } catch (error) {
    console.error('[CHARGERS ERROR]', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not retrieve nearby charger data.' });
  }
});

// ── GET /api/get-settlement-prices?date=YYYY-MM-DD ───────────────────────────
// Proxies to Elexon BMRS settlement system prices (SBP/SSP).
// Data is published D+1 — max allowed date is yesterday.
// Per-date in-memory cache (historical data is immutable).
app.get('/api/get-settlement-prices', historicalLimiter, async (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD).' });
  if (!DATE_RE_CI.test(date)) return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });

  const dateObj = new Date(date + 'T00:00:00Z');
  if (isNaN(dateObj.getTime())) return res.status(400).json({ error: 'Invalid date value.' });

  // Max allowed: yesterday (D+1 latency)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  if (dateObj > yesterday) {
    return res.status(400).json({ error: 'Settlement price data is only available up to yesterday (published D+1).' });
  }

  // Elexon data available from NETA start date
  if (dateObj < new Date('2001-03-27T00:00:00Z')) {
    return res.status(400).json({ error: 'Settlement price data is only available from 2001-03-27.' });
  }

  // Check per-date cache
  const cached = settlementCache.get(date);
  if (cached && (Date.now() - cached.timestamp < SETTLEMENT_CACHE_TTL)) {
    console.log(`[SETTLEMENT] Cache hit for ${date}.`);
    return res.json(cached.data);
  }

  try {
    const url = `https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${date}`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { Accept: 'application/json' },
    });

    const raw = response.data?.data || response.data || [];
    const periods = (Array.isArray(raw) ? raw : []).map(p => ({
      period: p.settlementPeriod,
      from:   p.startTime || null,
      to:     p.endTime   || null,
      sbp:    typeof p.systemBuyPrice  === 'number' ? Math.round(p.systemBuyPrice  * 100) / 100 : null,
      ssp:    typeof p.systemSellPrice === 'number' ? Math.round(p.systemSellPrice * 100) / 100 : null,
    })).filter(p => p.period != null);

    const result = { date, periods };
    settlementCache.set(date, { data: result, timestamp: Date.now() });
    console.log(`[SETTLEMENT] ${date} — ${periods.length} settlement periods returned.`);
    res.json(result);

  } catch (error) {
    console.error('[SETTLEMENT ERROR]', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not retrieve settlement price data.' });
  }
});

// ── Dotfile protection — explicit block before static serving ────────────────
// express.static blocks dotfiles by default, but this ensures dotfile paths
// never reach the SPA catch-all or any other handler and return a clean 404.
app.use((req, res, next) => {
  if (/\/\./.test(req.path)) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
});

// ==================== PRODUCTION STATIC SERVING ====================
if (process.env.NODE_ENV === 'production') {
  // Vite content-hashes all JS/CSS filenames → safe to cache for 1 year
  app.use('/assets', express.static(path.join(__dirname, '../frontend/dist/assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // Everything else (index.html etc.) → always revalidate so deploys take effect immediately
  app.use(express.static(path.join(__dirname, '../frontend/dist'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// ==================== EXPRESS ERROR HANDLER ====================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[SERVER ERROR] ${req.method} ${req.path}:`, err.message);
  if (!res.headersSent) {
    res.status(statusCode).json({ error: 'An internal server error occurred. Please try again later.' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Internal webapp backend running on http://localhost:${PORT}`);
});

// ── Graceful shutdown — clear pre-warm interval so PM2/SIGTERM doesn't hang ──
function gracefulShutdown(signal) {
  console.log(`[SHUTDOWN] ${signal} received — closing server cleanly.`);
  clearInterval(prewarmInterval);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed.');
    process.exit(0);
  });
  // Force-exit after 10 s in case of hung connections
  setTimeout(() => { console.error('[SHUTDOWN] Forced exit after timeout.'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

const BASE = '/api';

// Default timeout for all API calls — prevents indefinite "Loading…" on a hung backend
const TIMEOUT_MS = 15000;

/**
 * Common fetch logic for all API requests. Extracts JSON and handles non-2xx responses.
 */
async function handleResponse(res) {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) ? data.error : `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`);
  return data;
}

/**
 * Returns an AbortController + auto-clear timer for TIMEOUT_MS.
 * Caller must wrap the fetch in try/catch — AbortError throws as
 * "Request timed out. Please try again."
 */
function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Standard POST request helper — includes 15-second AbortController timeout.
 */
async function post(url, body = {}) {
  const { signal, clear } = withTimeout();
  try {
    const options = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
    };
    if (Object.keys(body).length > 0) options.body = JSON.stringify(body);
    return await handleResponse(await fetch(url, options));
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  } finally {
    clear();
  }
}

/**
 * Standard GET request helper — includes 15-second AbortController timeout.
 */
async function get(url) {
  const { signal, clear } = withTimeout();
  try {
    return await handleResponse(await fetch(url, { signal }));
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  } finally {
    clear();
  }
}

// Returns flexible + fixed electricity/gas rates for the given postcode
// Also used by RegionLookup to extract the customer's GSP region letter
export async function getRates(postcode) {
  return post(`${BASE}/get-rates`, { postcode });
}

// date = 'YYYY-MM-DD' for a specific day, or null for the live 24h-back/48h-forward window
// Returns { import: [...], export: [...] }
export async function getAgileRates(region, date = null) {
  return post(`${BASE}/get-agile-rates`, { region, date });
}

// Returns { import: [...], export: [...] } for a historical date range
export async function getHistoricalAgileRates(region, dateFrom, dateTo) {
  return post(`${BASE}/get-historical-agile-rates`, { region, dateFrom, dateTo });
}

export async function getCarbonIntensity() {
  return get(`${BASE}/get-carbon-intensity`);
}

// Returns { octopus: true } if the Octopus API is reachable, throws on 503/network failure.
export async function checkApiHealth() {
  return get(`${BASE}/health`);
}

// Returns { electricity: { rates, standing }, gas: { rates, standing } }
// rates/standing items: { valid_from, valid_to, value_inc_vat }
export async function getTrackerRates(region) {
  return post(`${BASE}/get-tracker-rates`, { region });
}

// productCode = optional SILVER-XX-XX-XX code; if omitted uses the current live product
export async function getHistoricalTrackerRates(region, dateFrom, dateTo, productCode = null) {
  const body = { region, dateFrom, dateTo };
  if (productCode) body.productCode = productCode;
  return post(`${BASE}/get-historical-tracker-rates`, body);
}

// Returns { products: [{ code, label, activeFrom, isCurrent? }] }
export async function getTrackerProducts() {
  return get(`${BASE}/get-tracker-products`);
}

// Returns { location: { postcode, lat, lng }, weather: { dates, sunshineHours, maxTemps, radiation, precipitation } }
export async function getWeatherForPostcode(postcode) {
  return get(`${BASE}/get-weather?postcode=${encodeURIComponent(postcode)}`);
}

// Returns { flexible: { unitRate, standingCharge }, fixed: { unitRate, standingCharge }, agile: { standingCharge } }
// Used by TariffCostComparison to show current Flexible / Fixed rates alongside Agile / Tracker historical averages.
export async function getComparisonRates(region) {
  return get(`${BASE}/get-comparison-rates?region=${encodeURIComponent(region)}`);
}

// Returns { data: [{ from, to, intensity: { actual, forecast, index } }] }
// Max date range: 31 days. Matches Agile 30-min settlement periods.
export async function getHistoricalCarbonIntensity(from, to) {
  return get(`${BASE}/get-historical-carbon-intensity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

// Returns { exportRate, standingCharge, productCode, region }
export async function getOutgoingRates(region) {
  return post(`${BASE}/get-outgoing-rates`, { region });
}

// Returns CI API response: { data: [{ from, to, generationmix: [{ fuel, perc }] }] }
export async function getGenerationMix() {
  return get(`${BASE}/get-generation-mix`);
}

// Returns { regionId, shortname, intensity: { forecast, index }, generationmix: [...] }
export async function getRegionalCarbon(region) {
  return get(`${BASE}/get-regional-carbon?region=${encodeURIComponent(region)}`);
}

// Returns Sheffield Solar PV_Live national summary (outturn_MW, outturn_pct, etc.)
export async function getSolarGeneration() {
  return get(`${BASE}/get-solar-generation`);
}

// Returns { postcode, latitude, longitude, chargers: [{ name, distanceMi, address, status, connectors }] }
export async function getNearbyChargers(postcode) {
  return get(`${BASE}/get-nearby-chargers?postcode=${encodeURIComponent(postcode)}`);
}

// Returns { date, periods: [{ period, from, to, sbp, ssp }] }
// Max date = yesterday (Elexon publishes D+1)
export async function getSettlementPrices(date) {
  return get(`${BASE}/get-settlement-prices?date=${encodeURIComponent(date)}`);
}

// Returns { alerts: [{ tier: 'red'|'green', message: string }] }
// Empty alerts array when no conditions are active.
export async function getAlertStatus() {
  return get(`${BASE}/get-alert-status`);
}

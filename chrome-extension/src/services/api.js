import { getAuthCredentials } from './storage.js';

// ── Backend config ───────────────────────────────────────────────────────────
const BACKEND_URL      = 'https://octotool.app';
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `${BACKEND_URL}/api`;
const latencySamples = new Map();

export const TIMEOUT = {
  DEFAULT:    10_000,
  HEALTH:     3_000,
  HISTORICAL: 25_000,
};

export class NetworkError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'NetworkError';
    this.cause = options.cause;
  }
}

export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export class ServerError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ServerError';
    this.status = status;
  }
}

export class ApiClient {
  constructor({ baseUrl, concurrency = 4 } = {}) {
    this.baseUrl = baseUrl;
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
    this.inflight = new Map();
  }

  async get(url, options = {}) {
    const key = `${url}|${options.timeoutMs || TIMEOUT.DEFAULT}`;
    if (this.inflight.has(key)) return this.inflight.get(key);

    const promise = this.request('GET', url, null, options).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  async post(url, body = {}, options = {}) {
    return this.request('POST', url, body, options);
  }

  async request(method, url, body, { timeoutMs = TIMEOUT.DEFAULT } = {}) {
    return this.runLimited(async () => {
      const startedAt = performance.now();
      const { signal, clear } = this.withTimeout(timeoutMs);
      try {
        const Authorization = await this.getAuthHeader();
        const requestOptions = {
          method,
          headers: { Authorization },
          signal,
        };
        if (method === 'POST') {
          requestOptions.headers['Content-Type'] = 'application/json';
          if (body && Object.keys(body).length > 0) requestOptions.body = JSON.stringify(body);
        }
        return await this.handleResponse(await fetch(this.baseUrl + url, requestOptions));
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new NetworkError('Request timed out. Please try again.', { cause: err });
        }
        if (err instanceof AuthError || err instanceof ServerError || err instanceof NetworkError) throw err;
        if (err instanceof TypeError) throw new NetworkError('Network request failed. Please check your connection.', { cause: err });
        throw err;
      } finally {
        recordLatency(url, performance.now() - startedAt);
        clear();
      }
    });
  }

  runLimited(task) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.active += 1;
        try {
          resolve(await task());
        } catch (err) {
          reject(err);
        } finally {
          this.active -= 1;
          const next = this.queue.shift();
          if (next) next();
        }
      };

      if (this.active < this.concurrency) run();
      else this.queue.push(run);
    });
  }

  async getAuthHeader() {
    const credentials = await getAuthCredentials();
    if (!credentials) {
      throw new AuthError('Backend credentials are not configured. Open Settings to add them.', 401);
    }
    return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
  }

  async handleResponse(res) {
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Auth failures — fixed message so credential details are never echoed
      if (res.status === 401 || res.status === 403) {
        throw new AuthError('Authentication failed. Please check credentials in Settings.', res.status);
      }
      // Server errors (5xx) — never surface internal details to the UI
      if (res.status >= 500) {
        throw new ServerError('The server encountered an error. Please try again later.', res.status);
      }
      // Client errors (4xx) — validation/not-found messages are safe and useful for staff
      const message = (data && data.error) ? data.error : `HTTP ${res.status}`;
      throw new ServerError(message, res.status);
    }
    if (!data) throw new ServerError(`Server returned a non-JSON response (HTTP ${res.status})`, res.status);
    return data;
  }

  withTimeout(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
  }
}

const client = new ApiClient({ baseUrl: BASE });

function recordLatency(endpoint, durationMs) {
  const samples = latencySamples.get(endpoint) || [];
  samples.push(durationMs);
  latencySamples.set(endpoint, samples.slice(-10));
}

export function getApiLatencyReport() {
  return [...latencySamples.entries()].map(([endpoint, samples]) => ({
    endpoint,
    count: samples.length,
    averageMs: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
    lastMs: Math.round(samples[samples.length - 1]),
  })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

async function post(url, body = {}, options = {}) {
  return client.post(url, body, options);
}

async function get(url, options = {}) {
  return client.get(url, options);
}

export async function getRates(postcode) {
  return post('/get-rates', { postcode });
}

export async function getAgileRates(region, date = null) {
  return post('/get-agile-rates', { region, date });
}

export async function getHistoricalAgileRates(region, dateFrom, dateTo) {
  return post('/get-historical-agile-rates', { region, dateFrom, dateTo }, { timeoutMs: TIMEOUT.HISTORICAL });
}

export async function getCarbonIntensity() {
  return get('/get-carbon-intensity');
}

export async function checkApiHealth() {
  return get('/health', { timeoutMs: TIMEOUT.HEALTH });
}

export async function getTrackerRates(region) {
  return post('/get-tracker-rates', { region });
}

export async function getHistoricalTrackerRates(region, dateFrom, dateTo, productCode = null) {
  const body = { region, dateFrom, dateTo };
  if (productCode) body.productCode = productCode;
  return post('/get-historical-tracker-rates', body, { timeoutMs: TIMEOUT.HISTORICAL });
}

export async function getTrackerProducts() {
  return get('/get-tracker-products');
}

export async function getWeatherForPostcode(postcode) {
  return get(`/get-weather?postcode=${encodeURIComponent(postcode)}`);
}

export async function getComparisonRates(region) {
  return get(`/get-comparison-rates?region=${encodeURIComponent(region)}`);
}

export async function getHistoricalCarbonIntensity(from, to) {
  return get(`/get-historical-carbon-intensity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export async function getOutgoingRates(region) {
  return post('/get-outgoing-rates', { region });
}

export async function getGenerationMix() {
  return get('/get-generation-mix');
}

export async function getRegionalCarbon(region) {
  return get(`/get-regional-carbon?region=${encodeURIComponent(region)}`);
}

export async function getSolarGeneration() {
  return get('/get-solar-generation');
}

export async function getNearbyChargers(postcode) {
  return get(`/get-nearby-chargers?postcode=${encodeURIComponent(postcode)}`);
}

export async function getSettlementPrices(date) {
  return get(`/get-settlement-prices?date=${encodeURIComponent(date)}`);
}

export async function getAlertStatus() {
  return get('/get-alert-status');
}

export async function getFeatureFlags() {
  return get('/feature-flags', { timeoutMs: TIMEOUT.HEALTH });
}

export async function getExpectedVersion() {
  return get('/version', { timeoutMs: TIMEOUT.HEALTH });
}

export async function getAnnouncements() {
  return get('/announcements', { timeoutMs: TIMEOUT.HEALTH });
}

export async function getIogEligibilityOptions() {
  return get('/get-iog-eligibility-options', { timeoutMs: TIMEOUT.HISTORICAL });
}

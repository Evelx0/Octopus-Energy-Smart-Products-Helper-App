// Plain JS service worker — no React, no npm imports.

// ── Backend config (keep in sync with src/services/api.js) ───────────────────
const BACKEND_URL      = 'https://octotool.app';
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthHeader() {
  const { authUsername, authPassword } = await chromeStorageGet('sync', ['authUsername', 'authPassword']);
  if (!authUsername || !authPassword) {
    throw new Error('Backend credentials are not configured.');
  }
  return `Basic ${btoa(`${authUsername}:${authPassword}`)}`;
}
const ALARM_NAME     = 'agile-refresh';
const REFRESH_MINUTES = 30;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_PRICE_ALERTS = {
  enabled: true,
  cheapThreshold: 5,
  expensiveThreshold: 35,
};

// ── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes:  1,
    periodInMinutes: REFRESH_MINUTES,
  });

  const { authUsername, authPassword } = await chromeStorageGet('sync', ['authUsername', 'authPassword']);
  if (!authUsername || !authPassword) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html') + '#/settings',
    });
  }

  // Right-click context menu — appears on any text selection
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       'lookup-postcode',
      title:    '🐙 Look up "%s" in Smart Products Hub',
      contexts: ['selection'],
    });
  });
});

// ── Alarm handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) runScheduledRefresh();
});

// ── Re-fetch when preferred region changes ───────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    (area === 'sync' && (changes.preferredRegion || changes.authUsername || changes.authPassword)) ||
    (area === 'local' && changes.overridePassword)
  ) {
    runScheduledRefresh();
  }
});

// ── Message handler — popup can request cached data ──────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Reject messages from any source other than this extension itself
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'GET_CACHED_AGILE') {
    chrome.storage.local.get(['cachedAgileRates', 'agileRatesCachedAt', 'lastAgileRefreshError', 'agileRefreshFailureCount'], result => {
      sendResponse({
        rates:        result.cachedAgileRates    ?? null,
        cachedAt:     result.agileRatesCachedAt  ?? null,
        lastError:    result.lastAgileRefreshError ?? null,
        failureCount: result.agileRefreshFailureCount ?? 0,
      });
    });
    return true;
  }
});

// ── Core refresh logic ───────────────────────────────────────────────────────

async function runScheduledRefresh() {
  await chromeStorageSet('local', { agileRefreshLastFiredAt: Date.now() });
  await Promise.allSettled([
    refreshAgileRates(),
    refreshTrackerRates(),
    checkExpectedVersion(),
    refreshFeatureFlags(),
    refreshAnnouncements(),
  ]);
}

async function refreshAgileRates() {
  const syncPrefs = await chromeStorageGet('sync', ['preferredRegion']);
  const localPrefs = syncPrefs.preferredRegion ? {} : await chromeStorageGet('local', ['preferredRegion']);
  const region = syncPrefs.preferredRegion || localPrefs.preferredRegion || 'H';

  if (navigator.onLine === false) {
    const { cachedAgileRates } = await chromeStorageGet('local', ['cachedAgileRates']);
    if (cachedAgileRates?.import) updateBadge(cachedAgileRates.import, { stale: true });
    await recordRefreshFailure('Offline. Using cached Agile rates where available.');
    return;
  }

  try {
    const Authorization = await getAuthHeader();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${BACKEND_URL}/api/get-agile-rates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization },
        body:    JSON.stringify({ region }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    await chromeStorageSet('local', {
      cachedAgileRates:         data,
      agileRatesCachedAt:       Date.now(),
      lastAgileRefreshError:    null,
      agileRefreshFailureCount: 0,
    });
    updateBadge(data?.import ?? []);
    await maybeNotifyPriceAlert(data?.import ?? [], region);
  } catch (err) {
    const count = await recordRefreshFailure(err.name === 'AbortError' ? 'Agile refresh timed out.' : (err.message || 'Agile refresh failed.'));
    if (count >= 3) setBadge('??', '#6B7280');
    else {
      const { cachedAgileRates } = await chromeStorageGet('local', ['cachedAgileRates']);
      if (cachedAgileRates?.import) updateBadge(cachedAgileRates.import, { stale: true });
      else setBadge('', '#6B7280');
    }
  }
}

async function refreshTrackerRates() {
  const syncPrefs = await chromeStorageGet('sync', ['preferredRegion']);
  const localPrefs = syncPrefs.preferredRegion ? {} : await chromeStorageGet('local', ['preferredRegion']);
  const region = syncPrefs.preferredRegion || localPrefs.preferredRegion || 'H';
  if (navigator.onLine === false) return;

  try {
    const Authorization = await getAuthHeader();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${BACKEND_URL}/api/get-tracker-rates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization },
        body:    JSON.stringify({ region }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return;
    const data = await res.json();
    await maybeNotifyTrackerChange(data, region);
  } catch {
    // Tracker alerts are an enhancement only — silent fail is correct here.
  }
}

async function maybeNotifyTrackerChange(data, region) {
  const today = toDateString(new Date());
  const elec = findRateForDate(data?.electricity?.rates, today);
  const gas = findRateForDate(data?.gas?.rates, today);
  if (!elec && !gas) return;

  const current = {
    elec: elec?.value_inc_vat ?? null,
    gas: gas?.value_inc_vat ?? null,
  };
  const { lastKnownTrackerRates } = await chromeStorageGet('local', ['lastKnownTrackerRates']);
  const previous = lastKnownTrackerRates?.[region];

  await chromeStorageSet('local', {
    lastKnownTrackerRates: {
      ...(lastKnownTrackerRates || {}),
      [region]: current,
    },
  });

  if (!previous || !chrome.notifications) return;
  const elecChanged = current.elec != null && previous.elec != null && Math.abs(current.elec - previous.elec) > 0.1;
  const gasChanged = current.gas != null && previous.gas != null && Math.abs(current.gas - previous.gas) > 0.1;
  if (!elecChanged && !gasChanged) return;

  const parts = [];
  if (elecChanged) parts.push(`Elec ${previous.elec.toFixed(2)}p -> ${current.elec.toFixed(2)}p`);
  if (gasChanged) parts.push(`Gas ${previous.gas.toFixed(2)}p -> ${current.gas.toFixed(2)}p`);

  chrome.notifications.create(`tracker-${region}-${today}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Tracker rates updated',
    message: `Region ${region}: ${parts.join(' · ')}`,
    priority: 1,
  });
}

async function checkExpectedVersion() {
  try {
    const Authorization = await getAuthHeader();
    const res = await fetch(`${BACKEND_URL}/api/version`, { headers: { Authorization } });
    if (!res.ok) return;
    const data = await res.json();
    const current = chrome.runtime.getManifest().version;
    const expected = data.expected || data.version || null;
    await chromeStorageSet('local', {
      updateAvailable: Boolean(expected && expected !== current),
      expectedVersion: expected,
      versionCheckedAt: Date.now(),
    });
  } catch {
    // Backend endpoint may not exist yet.
  }
}

async function refreshFeatureFlags() {
  try {
    const Authorization = await getAuthHeader();
    const res = await fetch(`${BACKEND_URL}/api/feature-flags`, { headers: { Authorization } });
    if (!res.ok) return;
    await chromeStorageSet('local', {
      featureFlags: await res.json(),
      featureFlagsFetchedAt: Date.now(),
    });
  } catch {
    // Feature flags are optional.
  }
}

async function refreshAnnouncements() {
  try {
    const Authorization = await getAuthHeader();
    const res = await fetch(`${BACKEND_URL}/api/announcements`, { headers: { Authorization } });
    if (!res.ok) return;
    const data = await res.json();
    await chromeStorageSet('local', {
      announcements: Array.isArray(data) ? data : data.announcements || [],
      announcementsFetchedAt: Date.now(),
    });
  } catch {
    // Announcements are optional.
  }
}

function updateBadge(rates, { stale = false } = {}) {
  const current = findCurrentSlot(rates);

  if (!current) { setBadge('', '#6B7280'); return; }

  const p = current.value_inc_vat;
  // Guard against missing or non-numeric values to prevent NaN in badge text
  if (typeof p !== 'number' || isNaN(p)) { setBadge('', '#6B7280'); return; }

  const text  = p < 100 ? `${Math.round(p)}p` : `${(p / 100).toFixed(1)}`;
  const color = stale ? '#6B7280' : p < 10 ? '#00A69C' : p <= 25 ? '#F59E0B' : '#EF4444';
  setBadge(text, color);
}

function findCurrentSlot(rates, now = new Date()) {
  if (!Array.isArray(rates)) return null;
  return rates.find(r => {
    const from = new Date(r.valid_from);
    const to = r.valid_to
      ? new Date(r.valid_to)
      : new Date(from.getTime() + 30 * 60 * 1000);
    return now >= from && now < to;
  }) ?? null;
}

async function maybeNotifyPriceAlert(rates, region) {
  const current = findCurrentSlot(rates);
  if (!current || !chrome.notifications) return;

  const { priceAlertSettings } = await chromeStorageGet('sync', ['priceAlertSettings']);
  const settings = { ...DEFAULT_PRICE_ALERTS, ...(priceAlertSettings || {}) };
  if (!settings.enabled) return;

  const price = current.value_inc_vat;
  const alertType = price <= settings.cheapThreshold
    ? 'cheap'
    : price >= settings.expensiveThreshold
      ? 'expensive'
      : null;
  if (!alertType) return;

  const slotId = `${region}:${alertType}:${current.valid_from}`;
  const { lastPriceAlertSlot } = await chromeStorageGet('local', ['lastPriceAlertSlot']);
  if (lastPriceAlertSlot === slotId) return;

  await chromeStorageSet('local', { lastPriceAlertSlot: slotId });
  const title = alertType === 'cheap' ? 'Cheap Agile slot now' : 'Expensive Agile slot now';
  const message = alertType === 'cheap'
    ? `Region ${region} is ${price.toFixed(1)}p/kWh. Good time to shift flexible usage.`
    : `Region ${region} is ${price.toFixed(1)}p/kWh. Avoid flexible usage if possible.`;

  chrome.notifications.create(`agile-${slotId}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message,
    priority: alertType === 'expensive' ? 2 : 1,
  });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function findRateForDate(rates, dateStr) {
  if (!Array.isArray(rates)) return null;
  return rates.find(r => toDateString(new Date(r.valid_from)) === dateStr) || null;
}

async function recordRefreshFailure(message) {
  const { agileRefreshFailureCount } = await chromeStorageGet('local', ['agileRefreshFailureCount']);
  const nextCount = (agileRefreshFailureCount || 0) + 1;
  await chromeStorageSet('local', {
    lastAgileRefreshError: message,
    agileRefreshFailureCount: nextCount,
  });
  return nextCount;
}

function chromeStorageGet(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}

function chromeStorageSet(area, obj) {
  return new Promise(resolve => chrome.storage[area].set(obj, resolve));
}

// ── Context menu handler ─────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'lookup-postcode') return;

  const raw = (info.selectionText || '').trim().toUpperCase();
  if (!raw) return;

  // Store postcode in session storage — cleared by the page after reading
  chrome.storage.session.set({ contextMenuPostcode: raw }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html') + '#/region-lookup',
    });
  });
});

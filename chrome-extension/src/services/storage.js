// Storage helpers for user preferences, credentials, and cached extension data.

function getFrom(area, keys) {
  return new Promise(resolve => {
    chrome.storage[area].get(keys, resolve);
  });
}

function setIn(area, values) {
  return new Promise(resolve => {
    chrome.storage[area].set(values, resolve);
  });
}

function removeFrom(area, keys) {
  return new Promise(resolve => {
    chrome.storage[area].remove(keys, resolve);
  });
}

function sessionStorageAvailable() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.session);
}

async function getSyncWithLocalFallback(key, fallback) {
  const syncResult = await getFrom('sync', [key]);
  if (syncResult[key] !== undefined) return syncResult[key];

  const localResult = await getFrom('local', [key]);
  if (localResult[key] !== undefined) return localResult[key];

  return fallback;
}

/**
 * Read the user's preferred DNO region from storage.
 * Defaults to 'H' (South England) if not set.
 */
export async function getPreferredRegion() {
  return getSyncWithLocalFallback('preferredRegion', 'H');
}

export async function savePreferredRegion(region) {
  await setIn('sync', { preferredRegion: region });
  await removeFrom('local', ['preferredRegion']);
}

/**
 * Returns the stored backend credentials, or null until first-run setup completes.
 */
export async function getAuthCredentials() {
  const result = await getFrom('sync', ['authUsername', 'authPassword']);
  if (!result.authUsername || !result.authPassword) return null;
  return {
    username: result.authUsername,
    password: result.authPassword,
  };
}

export async function saveAuthCredentials(username, password) {
  await setIn('sync', {
    authUsername: username,
    authPassword: password,
  });
}

export async function clearAuthCredentials() {
  await removeFrom('sync', ['authUsername', 'authPassword']);
}

export async function hasAuthCredentials() {
  return Boolean(await getAuthCredentials());
}

export async function getOverridePassword() {
  const credentials = await getAuthCredentials();
  return credentials?.password ?? null;
}

export async function saveOverridePassword(password, username) {
  if (!username) throw new Error('Username is required.');
  await saveAuthCredentials(username, password);
}

export async function clearOverridePassword() {
  await clearAuthCredentials();
}

/**
 * Returns true if backend credentials are currently stored.
 */
export async function hasOverridePassword() {
  return hasAuthCredentials();
}

/**
 * Accessibility: 'dark' (default) or 'light'.
 */
export async function getLightMode() {
  return getSyncWithLocalFallback('lightMode', 'dark');
}

export async function saveLightMode(mode) {
  await setIn('sync', { lightMode: mode });
  await removeFrom('local', ['lightMode']);
}

/**
 * Cached Agile rates written by the service worker.
 */
export async function getCachedAgileRates() {
  const result = await getFrom('local', [
    'cachedAgileRates',
    'agileRatesCachedAt',
    'lastAgileRefreshError',
    'agileRefreshFailureCount',
  ]);

  return {
    rates:        result.cachedAgileRates || null,
    cachedAt:     result.agileRatesCachedAt || null,
    lastError:    result.lastAgileRefreshError || null,
    failureCount: result.agileRefreshFailureCount || 0,
  };
}

export async function setCachedAgileRates(rates) {
  await setIn('local', {
    cachedAgileRates:          rates,
    agileRatesCachedAt:        Date.now(),
    lastAgileRefreshError:     null,
    agileRefreshFailureCount:  0,
  });
}

export async function getLastRefreshError() {
  const result = await getFrom('local', ['lastAgileRefreshError', 'agileRefreshFailureCount']);
  return {
    message: result.lastAgileRefreshError || null,
    failureCount: result.agileRefreshFailureCount || 0,
  };
}

export async function setLastRefreshError(message, failureCount = 1) {
  await setIn('local', {
    lastAgileRefreshError: message,
    agileRefreshFailureCount: failureCount,
  });
}

const DEFAULT_PRICE_ALERTS = {
  enabled: true,
  cheapThreshold: 5,
  expensiveThreshold: 35,
};

export async function getPriceAlertSettings() {
  const result = await getFrom('sync', ['priceAlertSettings']);
  return {
    ...DEFAULT_PRICE_ALERTS,
    ...(result.priceAlertSettings || {}),
  };
}

export async function savePriceAlertSettings(settings) {
  const current = await getPriceAlertSettings();
  await setIn('sync', {
    priceAlertSettings: {
      ...current,
      ...settings,
    },
  });
}

export async function getPinnedRegions() {
  const result = await getFrom('local', ['pinnedRegions']);
  return Array.isArray(result.pinnedRegions) ? result.pinnedRegions.slice(0, 3) : [];
}

export async function savePinnedRegions(regions) {
  const unique = [...new Set(regions)].slice(0, 3);
  await setIn('local', { pinnedRegions: unique });
}

export async function getUpdateStatus() {
  const result = await getFrom('local', ['updateAvailable', 'expectedVersion', 'versionCheckedAt']);
  return {
    updateAvailable: Boolean(result.updateAvailable),
    expectedVersion: result.expectedVersion || null,
    checkedAt: result.versionCheckedAt || null,
  };
}

export async function setUpdateStatus(status) {
  await setIn('local', {
    updateAvailable: Boolean(status.updateAvailable),
    expectedVersion: status.expectedVersion || null,
    versionCheckedAt: Date.now(),
  });
}

export async function getFeatureFlagCache() {
  const result = await getFrom('local', ['featureFlags', 'featureFlagsFetchedAt']);
  return {
    flags: result.featureFlags || {},
    fetchedAt: result.featureFlagsFetchedAt || null,
  };
}

export async function setFeatureFlagCache(flags) {
  await setIn('local', {
    featureFlags: flags || {},
    featureFlagsFetchedAt: Date.now(),
  });
}

export async function getIogEligibilityCache() {
  const result = await getFrom('local', ['iogEligibilityData', 'iogEligibilityFetchedAt']);
  return {
    data: result.iogEligibilityData || null,
    fetchedAt: result.iogEligibilityFetchedAt || null,
  };
}

export async function setIogEligibilityCache(data) {
  await setIn('local', {
    iogEligibilityData: data || null,
    iogEligibilityFetchedAt: Date.now(),
  });
}

export async function getAnnouncementState() {
  const result = await getFrom('local', ['announcements', 'announcementsFetchedAt', 'dismissedAnnouncements']);
  return {
    announcements: Array.isArray(result.announcements) ? result.announcements : [],
    fetchedAt: result.announcementsFetchedAt || null,
    dismissed: Array.isArray(result.dismissedAnnouncements) ? result.dismissedAnnouncements : [],
  };
}

export async function setAnnouncements(announcements) {
  await setIn('local', {
    announcements: Array.isArray(announcements) ? announcements : [],
    announcementsFetchedAt: Date.now(),
  });
}

export async function dismissAnnouncement(id) {
  const state = await getAnnouncementState();
  await setIn('local', {
    dismissedAnnouncements: [...new Set([...state.dismissed, id])],
  });
}

export async function getLearningMode() {
  const result = await getFrom('sync', ['learningMode']);
  return Boolean(result.learningMode);
}

export async function saveLearningMode(enabled) {
  await setIn('sync', { learningMode: Boolean(enabled) });
}

export async function getToolShortcuts() {
  const result = await getFrom('sync', ['toolShortcuts']);
  return Array.isArray(result.toolShortcuts) ? result.toolShortcuts.slice(0, 6) : null;
}

export async function saveToolShortcuts(shortcuts) {
  await setIn('sync', { toolShortcuts: [...new Set(shortcuts)].slice(0, 6) });
}

export async function getSeenReleaseVersion() {
  const result = await getFrom('local', ['seenReleaseVersion']);
  return result.seenReleaseVersion || null;
}

export async function setSeenReleaseVersion(version) {
  await setIn('local', { seenReleaseVersion: version });
}

const CURRENT_STORAGE_SCHEMA = 1;

export async function runStorageMigrations() {
  const result = await getFrom('local', ['storageSchemaVersion', 'dismissedAnnouncements']);
  const currentVersion = result.storageSchemaVersion || 0;
  if (currentVersion >= CURRENT_STORAGE_SCHEMA) return;

  const syncPrefs = await getFrom('sync', ['preferredRegion', 'lightMode']);
  const localPrefs = await getFrom('local', ['preferredRegion', 'lightMode', 'overridePassword']);
  const updates = { storageSchemaVersion: CURRENT_STORAGE_SCHEMA };

  if (syncPrefs.preferredRegion === undefined && localPrefs.preferredRegion !== undefined) {
    await setIn('sync', { preferredRegion: localPrefs.preferredRegion });
  }
  if (syncPrefs.lightMode === undefined && localPrefs.lightMode !== undefined) {
    await setIn('sync', { lightMode: localPrefs.lightMode });
  }

  if (Array.isArray(result.dismissedAnnouncements)) {
    updates.dismissedAnnouncements = result.dismissedAnnouncements.slice(-50);
  }

  await setIn('local', updates);
  await removeFrom('local', ['preferredRegion', 'lightMode', 'overridePassword']);
}

const EMPTY_SESSION_SUMMARY = {
  lookups: 0,
  lookupRegions: {},
  billingChecks: 0,
  billingByTariff: {},
  tariffPages: 0,
  tariffPageHits: {},
  alertsAcknowledged: 0,
  startedAt: null,
  updatedAt: null,
};

export async function getSessionSummary() {
  if (!sessionStorageAvailable()) return EMPTY_SESSION_SUMMARY;
  const result = await getFrom('session', ['sessionSummary']);
  return {
    ...EMPTY_SESSION_SUMMARY,
    ...(result.sessionSummary || {}),
  };
}

export async function clearSessionSummary() {
  if (!sessionStorageAvailable()) return;
  await removeFrom('session', ['sessionSummary']);
}

export async function trackSessionEvent(type, payload = {}) {
  if (!sessionStorageAvailable()) return;
  const summary = await getSessionSummary();
  const now = Date.now();
  const next = {
    ...summary,
    startedAt: summary.startedAt || now,
    updatedAt: now,
  };

  if (type === 'lookup') {
    const region = payload.region || 'unknown';
    next.lookups += 1;
    next.lookupRegions = {
      ...next.lookupRegions,
      [region]: (next.lookupRegions[region] || 0) + 1,
    };
  }

  if (type === 'billing_check') {
    const tariff = payload.tariff || 'unknown';
    next.billingChecks += 1;
    next.billingByTariff = {
      ...next.billingByTariff,
      [tariff]: (next.billingByTariff[tariff] || 0) + 1,
    };
  }

  if (type === 'tariff_page') {
    const page = payload.page || 'unknown';
    next.tariffPages += 1;
    next.tariffPageHits = {
      ...next.tariffPageHits,
      [page]: (next.tariffPageHits[page] || 0) + 1,
    };
  }

  if (type === 'alert_acknowledged') {
    next.alertsAcknowledged += 1;
  }

  await setIn('session', { sessionSummary: next });
}

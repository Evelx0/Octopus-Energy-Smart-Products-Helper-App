import { useState, useEffect } from 'react';
import {
  getPreferredRegion, savePreferredRegion,
  getAuthCredentials, saveAuthCredentials, clearAuthCredentials,
  getLightMode, saveLightMode,
  getPriceAlertSettings, savePriceAlertSettings,
  getLearningMode, saveLearningMode,
} from '../services/storage.js';
import { applyTheme } from '../theme.js';

const REGIONS = [
  { value: 'A', label: 'A — East England' },
  { value: 'B', label: 'B — East Midlands' },
  { value: 'C', label: 'C — London' },
  { value: 'D', label: 'D — Merseyside & N Wales' },
  { value: 'E', label: 'E — West Midlands' },
  { value: 'F', label: 'F — North East England' },
  { value: 'G', label: 'G — North West England' },
  { value: 'H', label: 'H — South England' },
  { value: 'J', label: 'J — South East England' },
  { value: 'K', label: 'K — South Wales' },
  { value: 'L', label: 'L — South West England' },
  { value: 'M', label: 'M — Yorkshire' },
  { value: 'N', label: 'N — South Scotland' },
  { value: 'P', label: 'P — North Scotland' },
];

export default function SettingsPage() {
  const [region,       setRegion]       = useState('H');
  const [regionSaved,  setRegionSaved]  = useState(false);
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [passSaved,    setPassSaved]    = useState(false);
  const [passCleared,  setPassCleared]  = useState(false);
  const [lightMode,    setLightMode]    = useState('dark');
  const [learningMode, setLearningMode] = useState(false);
  const [priceAlerts,  setPriceAlerts]  = useState({ enabled: true, cheapThreshold: 5, expensiveThreshold: 35 });
  const [commands,     setCommands]     = useState([]);
  const [shortcutCopied, setShortcutCopied] = useState(false);
  const [alertsSaved,  setAlertsSaved]  = useState(false);
  const canSaveCredentials = Boolean(username.trim() && password.trim());
  const actionCommand = commands.find(command => command.name === '_execute_action');
  const actionShortcut = actionCommand?.shortcut || 'Not assigned';

  useEffect(() => {
    getPreferredRegion().then(setRegion);
    getAuthCredentials().then(credentials => {
      if (!credentials) return;
      setUsername(credentials.username);
      setHasCredentials(true);
    });
    getLightMode().then(setLightMode);
    getLearningMode().then(setLearningMode);
    getPriceAlertSettings().then(setPriceAlerts);
    if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
      chrome.commands.getAll(setCommands);
    }
  }, []);

  async function handleThemeToggle() {
    const next = lightMode === 'light' ? 'dark' : 'light';
    await saveLightMode(next);
    setLightMode(next);
    applyTheme(next);
  }

  async function handleLearningToggle() {
    const next = !learningMode;
    await saveLearningMode(next);
    setLearningMode(next);
  }

  async function handleRegionSave(e) {
    e.preventDefault();
    await savePreferredRegion(region);
    setRegionSaved(true);
    setTimeout(() => setRegionSaved(false), 2000);
  }

  async function handlePasswordSave(e) {
    e?.preventDefault();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    if (!cleanUsername || !cleanPassword) return;
    await saveAuthCredentials(cleanUsername, cleanPassword);
    setHasCredentials(true);
    setUsername(cleanUsername);
    setPassword('');
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2000);
  }

  async function handlePasswordClear() {
    await clearAuthCredentials();
    setHasCredentials(false);
    setUsername('');
    setPassword('');
    setPassCleared(true);
    setTimeout(() => setPassCleared(false), 2000);
  }

  async function handleAlertSave(e) {
    e.preventDefault();
    const next = {
      enabled: priceAlerts.enabled,
      cheapThreshold: Number(priceAlerts.cheapThreshold),
      expensiveThreshold: Number(priceAlerts.expensiveThreshold),
    };
    await savePriceAlertSettings(next);
    setPriceAlerts(next);
    setAlertsSaved(true);
    setTimeout(() => setAlertsSaved(false), 2000);
  }

  async function openShortcutSettings() {
    const url = 'chrome://extensions/shortcuts';
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
        return;
      }
    } catch {
      // Fall back to window.open/copy below.
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setShortcutCopied(true);
      setTimeout(() => setShortcutCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10 flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-black text-white mb-2">Preferences</h1>
        <p className="text-gray-300 text-sm">
          Configure your regional settings and backend credentials.
        </p>
      </div>

      {/* ── Region ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-4">Preferred Region</h2>

        {regionSaved && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-teal-900/50 border border-teal-600/40 text-teal-300 text-sm">
            ✓ Region saved.
          </div>
        )}

        <form onSubmit={handleRegionSave} className="flex flex-col gap-4">
          <div>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#2E2252] border border-white/10 text-white focus:outline-none focus:border-pink-500 text-sm"
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-300 mt-1">
              Used for the Agile rate shown on the toolbar icon badge.
            </p>
          </div>
          <button
            type="submit"
            className="py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm transition-colors"
          >
            Save Region
          </button>
        </form>
      </section>

      {/* ── Backend credentials ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-1">Backend Credentials</h2>
        <p className="text-xs text-gray-300 mb-4">
          Add the staff API credentials once. They are stored in Chrome sync storage and are not bundled with the extension.
        </p>

        {passSaved && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-teal-900/50 border border-teal-600/40 text-teal-300 text-sm">
            ✓ Password override saved.
          </div>
        )}
        {passCleared && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-900/50 border border-yellow-600/40 text-yellow-300 text-sm">
            Credentials cleared. API calls will pause until credentials are saved again.
          </div>
        )}
        {hasCredentials && !passSaved && !passCleared && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-purple-900/40 border border-purple-600/30 text-purple-300 text-xs">
            Backend credentials are configured.
          </div>
        )}

        <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username..."
              autoComplete="username"
              className="w-full px-4 py-2.5 rounded-xl bg-[#2E2252] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={hasCredentials ? 'Enter a new password to rotate...' : 'Enter password...'}
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl bg-[#2E2252] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!canSaveCredentials}
              className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors ${
                canSaveCredentials
                  ? 'bg-pink-600 hover:bg-pink-500 cursor-pointer'
                  : 'bg-pink-600 opacity-40 cursor-not-allowed'
              }`}
            >
              Save Credentials
            </button>
            {hasCredentials && (
              <button
                type="button"
                onClick={handlePasswordClear}
                className="px-4 py-2.5 rounded-xl bg-[#2E2252] hover:bg-purple-900 border border-white/10 text-gray-300 text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </section>
      {/* ── Price alerts ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-1">Agile Price Alerts</h2>
        <p className="text-xs text-gray-300 mb-4">
          Chrome notifications fire when the toolbar refresh sees the current Agile rate cross these thresholds.
        </p>

        {alertsSaved && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-teal-900/50 border border-teal-600/40 text-teal-300 text-sm">
            Price alerts saved.
          </div>
        )}

        <form onSubmit={handleAlertSave} className="flex flex-col gap-4 bg-[#2E2252] rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">Notifications</p>
              <p className="text-xs text-gray-300 mt-0.5">
                {priceAlerts.enabled ? 'Cheap and expensive Agile slots' : 'Alerts are paused'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPriceAlerts(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                priceAlerts.enabled ? 'bg-pink-600' : 'bg-gray-600'
              }`}
              role="switch"
              aria-checked={priceAlerts.enabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  priceAlerts.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-300 mb-1">Cheap at or below</span>
              <input
                type="number"
                min="-20"
                max="100"
                step="0.5"
                value={priceAlerts.cheapThreshold}
                onChange={e => setPriceAlerts(s => ({ ...s, cheapThreshold: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#150E38] border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-300 mb-1">Expensive at or above</span>
              <input
                type="number"
                min="-20"
                max="100"
                step="0.5"
                value={priceAlerts.expensiveThreshold}
                onChange={e => setPriceAlerts(s => ({ ...s, expensiveThreshold: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#150E38] border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500"
              />
            </label>
          </div>

          <button
            type="submit"
            className="py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm transition-colors"
          >
            Save Alert Settings
          </button>
        </form>
      </section>
      {/* ── Keyboard shortcut ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-1">Keyboard Shortcut</h2>
        <p className="text-xs text-gray-300 mb-4">
          Chrome manages extension shortcuts. Use the shortcut editor to change the key used to open the popup.
        </p>

        <div className="bg-[#2E2252] rounded-xl px-4 py-3 border border-white/10">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm text-white font-medium">Open Smart Products Hub</p>
              <p className="text-xs text-gray-300 mt-0.5">Current shortcut</p>
            </div>
            <kbd className="px-2 py-1 rounded-lg bg-[#150E38] border border-white/10 text-gray-200 text-xs font-semibold">
              {actionShortcut}
            </kbd>
          </div>
          <button
            type="button"
            onClick={openShortcutSettings}
            className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm transition-colors"
          >
            Open Chrome Shortcut Settings
          </button>
          {shortcutCopied && (
            <p className="text-xs text-teal-300 mt-2">
              Shortcut settings URL copied. Paste it into Chrome's address bar.
            </p>
          )}
        </div>
      </section>
      {/* ── Accessibility ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-1">Accessibility</h2>
        <p className="text-xs text-gray-300 mb-4">
          Light mode inverts the colour scheme — useful in bright environments or for users who prefer light backgrounds.
        </p>

        <div className="flex items-center justify-between gap-4 bg-[#2E2252] rounded-xl px-4 py-3">
          <div>
            <p className="text-sm text-white font-medium">
              {lightMode === 'light' ? '☀️ Light mode' : '🌙 Dark mode'}
            </p>
            <p className="text-xs text-gray-300 mt-0.5">
              {lightMode === 'light' ? 'Light background, dark text' : 'Default dark theme'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleThemeToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              lightMode === 'light' ? 'bg-pink-600' : 'bg-gray-600'
            }`}
            role="switch"
            aria-checked={lightMode === 'light'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                lightMode === 'light' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* ── Learning Mode ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-1">Learning Mode</h2>
        <p className="text-xs text-gray-300 mb-4">
          Adds short page-purpose notes for new starters without changing live data or API calls.
        </p>

        <div className="flex items-center justify-between gap-4 bg-[#2E2252] rounded-xl px-4 py-3">
          <div>
            <p className="text-sm text-white font-medium">
              {learningMode ? 'Learning notes enabled' : 'Learning notes disabled'}
            </p>
            <p className="text-xs text-gray-300 mt-0.5">
              {learningMode ? 'Options pages show extra orientation context' : 'Compact production view'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLearningToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              learningMode ? 'bg-pink-600' : 'bg-gray-600'
            }`}
            role="switch"
            aria-checked={learningMode}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                learningMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

    </div>
  );
}

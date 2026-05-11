import { useEffect, useState } from 'react';
import { checkApiHealth, getApiLatencyReport, getExpectedVersion } from '../services/api';
import { getAuthCredentials, getCachedAgileRates, getFeatureFlagCache, getLastRefreshError, getUpdateStatus, setUpdateStatus } from '../services/storage';
import buildMeta from '../constants/buildMeta.generated.json';

function formatTime(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HealthRow({ label, value, tone = 'text-white' }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 text-sm">
      <span className="text-gray-300">{label}</span>
      <span className={`${tone} font-semibold text-right`}>{value}</span>
    </div>
  );
}

function displayVersion(version) {
  if (!version) return 'Not published';
  return version.startsWith('v') ? version : `v${version}`;
}

function sameVersion(a, b) {
  return String(a || '').replace(/^v/i, '') === String(b || '').replace(/^v/i, '');
}

export default function SystemHealthPage() {
  const [state, setState] = useState({
    loading: true,
    health: null,
    healthLatency: null,
    healthError: null,
    cache: null,
    refreshMeta: null,
    alarm: null,
    lastError: null,
    update: null,
    flags: null,
    credentialsConfigured: false,
    latency: [],
  });

  async function loadHealth() {
    setState(s => ({ ...s, loading: true }));
    const startedAt = performance.now();

    const [healthRes, versionRes, cache, lastError, update, flags, refreshMeta, alarm, credentials] = await Promise.all([
      checkApiHealth().then(value => ({ status: 'fulfilled', value })).catch(error => ({ status: 'rejected', error })),
      getExpectedVersion().then(value => ({ status: 'fulfilled', value })).catch(error => ({ status: 'rejected', error })),
      getCachedAgileRates(),
      getLastRefreshError(),
      getUpdateStatus(),
      getFeatureFlagCache(),
      new Promise(resolve => chrome.storage.local.get(['agileRefreshLastFiredAt'], resolve)),
      new Promise(resolve => chrome.alarms.get('agile-refresh', resolve)),
      getAuthCredentials(),
    ]);
    const manifest = chrome.runtime.getManifest();
    const liveExpectedVersion = versionRes.status === 'fulfilled'
      ? (versionRes.value.expected || versionRes.value.version || null)
      : null;
    const mergedUpdate = liveExpectedVersion
      ? {
          ...update,
          expectedVersion: liveExpectedVersion,
          updateAvailable: !sameVersion(liveExpectedVersion, manifest.version),
          checkedAt: Date.now(),
        }
      : update;

    if (liveExpectedVersion) {
      setUpdateStatus(mergedUpdate).catch(() => {});
    }

    setState({
      loading: false,
      health: healthRes.status === 'fulfilled' ? healthRes.value : null,
      healthLatency: Math.round(performance.now() - startedAt),
      healthError: healthRes.status === 'rejected' ? (healthRes.error?.message || 'Health check failed') : null,
      cache,
      refreshMeta,
      alarm,
      lastError,
      update: mergedUpdate,
      flags,
      credentialsConfigured: Boolean(credentials),
      latency: getApiLatencyReport(),
    });
  }

  useEffect(() => { loadHealth(); }, []);

  const manifest = chrome.runtime.getManifest();
  const backendOk = state.health && !state.healthError;
  const command = manifest.commands?._execute_action;
  const commandValues = command?.suggested_key || {};
  const hasForbiddenTabs = manifest.permissions?.includes('tabs');
  const hasRequiredPermissions = ['storage', 'alarms', 'contextMenus', 'notifications']
    .every(permission => manifest.permissions?.includes(permission));

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-8">
      <header className="my-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">TechOps</p>
          <h1 className="text-4xl md:text-5xl font-black text-white">
            System <span className="octopus-text-gradient">Health</span>
          </h1>
          <p className="mt-3 text-gray-300 text-lg max-w-2xl">
            Local extension status, backend reachability, cached refreshes, and optional rollout controls.
          </p>
        </div>
        <button
          type="button"
          onClick={loadHealth}
          disabled={state.loading}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {state.loading ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="octopus-card-bg rounded-2xl p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">Backend</p>
          <HealthRow label="octotool.app /health" value={backendOk ? 'Reachable' : 'Issue detected'} tone={backendOk ? 'text-teal-400' : 'text-red-400'} />
          <HealthRow label="Live health latency" value={state.healthLatency ? `${state.healthLatency}ms` : '—'} />
          <HealthRow label="Response status" value={state.health?.status || state.health?.ok || '—'} />
          {state.healthError && <p className="mt-3 text-sm text-red-300">{state.healthError}</p>}
        </section>

        <section className="octopus-card-bg rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">Extension</p>
          <HealthRow label="Installed version" value={displayVersion(manifest.version)} />
          <HealthRow label="Expected version" value={displayVersion(state.update?.expectedVersion)} />
          <HealthRow label="Update available" value={state.update?.updateAvailable ? 'Yes' : 'No'} tone={state.update?.updateAvailable ? 'text-amber-300' : 'text-teal-400'} />
          <HealthRow label="Version checked" value={formatTime(state.update?.checkedAt)} />
          <HealthRow label="Build generated" value={formatTime(buildMeta.generatedAt)} />
          <HealthRow label="Build commit" value={buildMeta.gitCommit || 'Not available'} />
        </section>

        <section className="octopus-card-bg rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2">Service Worker</p>
          <HealthRow label="Last alarm fired" value={formatTime(state.refreshMeta?.agileRefreshLastFiredAt)} />
          <HealthRow label="Next scheduled alarm" value={formatTime(state.alarm?.scheduledTime)} />
          <HealthRow label="Agile cache updated" value={formatTime(state.cache?.cachedAt)} />
          <HealthRow label="Failure count" value={state.cache?.failureCount ?? 0} tone={state.cache?.failureCount ? 'text-amber-300' : 'text-teal-400'} />
          <HealthRow label="Credentials configured" value={state.credentialsConfigured ? 'Yes' : 'No'} tone={state.credentialsConfigured ? 'text-teal-400' : 'text-red-400'} />
          {(state.cache?.lastError || state.lastError?.message) && (
            <p className="mt-3 text-sm text-amber-300">{state.cache?.lastError || state.lastError.message}</p>
          )}
        </section>

        <section className="octopus-card-bg rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">Install Doctor</p>
          <HealthRow label="Required permissions" value={hasRequiredPermissions ? 'Present' : 'Missing'} tone={hasRequiredPermissions ? 'text-teal-400' : 'text-red-400'} />
          <HealthRow label="Forbidden tabs permission" value={hasForbiddenTabs ? 'Present' : 'Absent'} tone={hasForbiddenTabs ? 'text-red-400' : 'text-teal-400'} />
          <HealthRow label="Action command" value={command ? 'Configured' : 'Missing'} tone={command ? 'text-teal-400' : 'text-red-400'} />
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(commandValues).map(([platform, value]) => (
              <span key={platform} className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-mono">
                {platform}: {value}
              </span>
            ))}
          </div>
        </section>

        <section className="octopus-card-bg rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-2">Feature Flags</p>
          <HealthRow label="Last fetched" value={formatTime(state.flags?.fetchedAt)} />
          {Object.keys(state.flags?.flags || {}).length ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(state.flags.flags).map(([key, value]) => (
                <span key={key} className={`px-2 py-1 rounded-lg text-xs font-semibold ${value ? 'bg-teal-900/50 text-teal-300' : 'bg-white/5 text-gray-300'}`}>
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-300 mt-3">No backend flags cached. Defaults are being used.</p>
          )}
        </section>
      </div>

      <section className="octopus-card-bg rounded-2xl p-6 mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-4">API latency buffer</p>
        {state.latency.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-gray-300 font-medium">Endpoint</th>
                  <th className="text-right py-2 text-gray-300 font-medium">Avg</th>
                  <th className="text-right py-2 text-gray-300 font-medium">Last</th>
                  <th className="text-right py-2 text-gray-300 font-medium">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.latency.map(row => (
                  <tr key={row.endpoint}>
                    <td className="py-2 pr-4 text-white font-mono text-xs">{row.endpoint}</td>
                    <td className="py-2 text-right text-gray-300">{row.averageMs}ms</td>
                    <td className="py-2 text-right text-gray-300">{row.lastMs}ms</td>
                    <td className="py-2 text-right text-gray-300">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-300">No API calls recorded in this Options session yet.</p>
        )}
      </section>
    </main>
  );
}

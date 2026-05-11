// Postcode → Region Lookup
// Uses /api/get-rates to identify a customer's GSP region from their postcode.
// Also fetches 30-day weather for the area via /api/get-weather — used as a solar export talking point.

import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getRates, getWeatherForPostcode, getAgileRates, getRegionalCarbon, getTrackerRates, getNearbyChargers } from '../services/api';
import { REGION_INFO } from '../constants/regions';
import { SVT_CAP } from '../constants/svt';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CopyChip from '../components/ui/CopyChip';
import { trackSessionEvent } from '../services/storage';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// Extract region letter from a GSP group_id string like "_H" → "H"
function extractRegionFromGsp(gsp) {
  if (!gsp) return null;
  const clean = gsp.replace(/^_/, '').toUpperCase();
  return REGION_INFO[clean] ? clean : null;
}

// Derive a solar-export talking point from avg daily sunshine hours
function solarTier(avgHours) {
  if (avgHours >= 5)  return { label: 'Good solar potential', colour: 'text-teal-300',  icon: '☀️',  tip: 'Above-average sunshine for this area — strong case for discussing Outgoing Octopus.' };
  if (avgHours >= 3)  return { label: 'Moderate solar potential', colour: 'text-amber-300', icon: '⛅', tip: 'Decent sunshine over the past 30 days — worth discussing Outgoing Octopus if system is ≥3kW.' };
  return               { label: 'Lower solar period', colour: 'text-gray-300',  icon: '🌥️', tip: 'Last 30 days show lower sunshine. Factor in seasonal variation — annual average may tell a different story.' };
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Same signal logic as GoodTimeWidget — priority: No > Yes > Wait
function getSignal(currentRate, todayRates, svtCap) {
  if (currentRate == null || !todayRates.length) return null;
  const avg = todayRates.reduce((s, r) => s + r.value_inc_vat, 0) / todayRates.length;
  const pctAboveAvg = ((currentRate - avg) / avg) * 100;
  if (pctAboveAvg > 20 || currentRate >= svtCap) return 'no';
  if (pctAboveAvg < -20 && currentRate < svtCap) return 'yes';
  return 'wait';
}

const SIGNAL_CONFIG = {
  yes:  { label: '✅ Good time',       text: 'text-teal-400',  bg: 'bg-teal-900/40',  border: 'border-teal-500/30' },
  wait: { label: '🟡 Reasonable',      text: 'text-amber-400', bg: 'bg-amber-900/40', border: 'border-amber-500/30' },
  no:   { label: '🔴 Avoid if poss.',  text: 'text-red-400',   bg: 'bg-red-900/40',   border: 'border-red-500/30' },
};

const CI_COLOR = {
  'very low':  'text-teal-400',
  'low':       'text-teal-400',
  'moderate':  'text-amber-400',
  'high':      'text-red-400',
  'very high': 'text-red-500',
};

// ─── Weather Panel ────────────────────────────────────────────────────────────

function WeatherPanel({ postcode }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchedFor = useRef(null);

  useEffect(() => {
    if (!postcode || fetchedFor.current === postcode) return;
    fetchedFor.current = postcode;
    setLoading(true);
    setError(null);
    setData(null);

    getWeatherForPostcode(postcode)
      .then(setData)
      .catch(err => setError(err.message || 'Could not load weather data.'))
      .finally(() => setLoading(false));
  }, [postcode]);

  if (loading) {
    return (
      <div className="octopus-card-bg rounded-2xl p-6 mt-4">
        <LoadingSpinner message="Loading weather data…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="octopus-card-bg rounded-2xl p-5 mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">☀️ Solar Export Context</p>
        <p className="text-gray-300 text-sm">Weather data unavailable for this postcode.</p>
      </div>
    );
  }

  if (!data) return null;

  const { location, weather } = data;
  const { sunshineHours, maxTemps, dates, precipitation } = weather;

  const avgSun  = sunshineHours.reduce((a, b) => a + b, 0) / sunshineHours.length;
  const avgTemp = maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length;
  const totalRain = precipitation.reduce((a, b) => a + b, 0);
  const tier    = solarTier(avgSun);

  // Short date labels: "Apr 1"
  const dateLabels = dates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  });

  const chartData = {
    labels: dateLabels,
    datasets: [{
      label: 'Sunshine (hrs)',
      data: sunshineHours,
      backgroundColor: sunshineHours.map(h =>
        h >= 6 ? 'rgba(250, 204, 21, 0.7)'   // yellow — sunny
        : h >= 3 ? 'rgba(167, 139, 250, 0.6)' // purple — moderate
        : 'rgba(107, 114, 128, 0.5)'          // gray — low
      ),
      borderRadius: 3,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: {
      callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} hrs sunshine` },
    }},
    scales: {
      x: { ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' },
           title: { display: true, text: 'hrs', color: '#9ca3af', font: { size: 10 } } },
    },
  };

  return (
    <div className="octopus-card-bg rounded-2xl p-6 mt-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">☀️ Solar Export Context</p>
          <p className="text-white font-semibold">{location.district}</p>
          <p className="text-gray-300 text-xs">Last 30 days — weather data from Open-Meteo</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg bg-white/5 ${tier.colour}`}>{tier.icon} {tier.label}</span>
      </div>

      {/* 3 stat chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-300 mb-1">Avg sunshine/day</p>
          <p className="text-2xl font-black text-amber-300">{avgSun.toFixed(1)}<span className="text-sm font-normal ml-1">hrs</span></p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-300 mb-1">Avg high temp</p>
          <p className="text-2xl font-black text-orange-300">{avgTemp.toFixed(1)}<span className="text-sm font-normal ml-1">°C</span></p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-300 mb-1">Total rainfall</p>
          <p className="text-2xl font-black text-blue-300">{totalRain.toFixed(0)}<span className="text-sm font-normal ml-1">mm</span></p>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ height: 160 }} className="mb-4">
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Outgoing Octopus talking point */}
      <div className="bg-amber-900/25 border border-amber-600/30 rounded-xl p-4">
        <p className="text-amber-300 text-sm font-semibold mb-0.5">💬 Outgoing Octopus talking point</p>
        <p className="text-gray-300 text-sm">{tier.tip}</p>
        <p className="text-gray-300 text-xs mt-1.5">
          Outgoing Octopus is compatible with Agile, Tracker, Flexible, Cosy, and most fixed tariffs.
          Not compatible with Flux (which includes export already).
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RegionLookup() {
  const [searchParams] = useSearchParams();
  const [postcode,        setPostcode]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [result,          setResult]          = useState(null); // { regionCode, regionInfo, postcode }
  const [snapshot,        setSnapshot]        = useState(null); // { agile, carbon, tracker, chargers }
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Check session storage on mount — set by the context menu service worker handler
  useEffect(() => {
    const paramPostcode = searchParams.get('postcode');
    if (paramPostcode) {
      const clean = paramPostcode.trim().toUpperCase();
      setPostcode(clean);
      doLookup(clean);
      return;
    }
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
    chrome.storage.session.get(['contextMenuPostcode'], result => {
      const pc = result.contextMenuPostcode;
      if (!pc) return;
      chrome.storage.session.remove(['contextMenuPostcode']);
      setPostcode(pc);
      doLookup(pc);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

  async function doLookup(trimmed) {
    if (!UK_POSTCODE_RE.test(trimmed)) {
      setError('That doesn\'t look like a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSnapshot(null);

    try {
      const data = await getRates(trimmed);

      let regionCode = null;
      if (data.gsp) {
        regionCode = extractRegionFromGsp(data.gsp);
      }

      if (!regionCode) {
        setError('Could not determine region from this postcode. The postcode may be valid but the region code was not returned. Try again or check the postcode manually.');
        return;
      }

      setResult({ regionCode, regionInfo: REGION_INFO[regionCode], postcode: trimmed });
      trackSessionEvent('lookup', { region: regionCode });

      // Fire 4 parallel snapshot fetches for the identified region — failures are silently skipped
      setSnapshotLoading(true);
      const [agileRes, carbonRes, trackerRes, chargerRes] = await Promise.allSettled([
        getAgileRates(regionCode),
        getRegionalCarbon(regionCode),
        getTrackerRates(regionCode),
        getNearbyChargers(trimmed),
      ]);
      setSnapshot({
        agile:    agileRes.status   === 'fulfilled' ? agileRes.value   : null,
        carbon:   carbonRes.status  === 'fulfilled' ? carbonRes.value  : null,
        tracker:  trackerRes.status === 'fulfilled' ? trackerRes.value : null,
        chargers: chargerRes.status === 'fulfilled' ? chargerRes.value : null,
      });
      setSnapshotLoading(false);

    } catch (err) {
      if (err.message.includes('404') || err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('invalid')) {
        setError('Postcode not found or invalid. Please check the postcode and try again.');
      } else {
        setError(err.message || 'Could not look up this postcode. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLookup(e) {
    e.preventDefault();
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) return;
    if (!UK_POSTCODE_RE.test(trimmed)) {
      setError('Please enter a valid UK postcode (e.g. SW1A 1AA or EC1A 1BB).');
      return;
    }
    doLookup(trimmed);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Price Trackers</p>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
          Postcode → <span className="octopus-text-gradient">Region Lookup</span>
        </h1>
        <p className="text-gray-300">
          Enter a customer's postcode to instantly identify their DNO region, GSP code, and network operator.
          Then jump straight to the Agile or Tracker rates for their region.
        </p>
      </header>

      {/* Lookup form */}
      <form onSubmit={handleLookup} className="octopus-card-bg rounded-2xl p-6 space-y-4">
        <div>
          <label htmlFor="postcode" className="block text-sm font-medium text-white mb-1">
            Customer Postcode
          </label>
          <div className="flex gap-3">
            <input
              id="postcode"
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              placeholder="e.g. SW1A 2AA"
              maxLength={8}
              className="flex-1 bg-gray-900/50 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 uppercase"
              style={{ textTransform: 'uppercase' }}
            />
            <button
              type="submit"
              disabled={loading || !postcode.trim()}
              className="cta-button bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg"
            >
              Look Up
            </button>
          </div>
        </div>

        {loading && (
          <div className="pt-2">
            <LoadingSpinner message="Looking up postcode…" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </form>

      {/* Result */}
      {result && !loading && (
        <div className="mt-6 space-y-4">
          <div className="octopus-card-bg rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-4">Region Identified</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-300 mb-1">Region Letter</p>
                <div className="text-4xl font-black">
                  <CopyChip value={result.regionCode} className="text-4xl font-black" />
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-300 mb-1">GSP Code</p>
                <div className="text-4xl font-black">
                  <CopyChip value={result.regionInfo.gsp} className="text-4xl font-black" />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-300">Region Name</span>
                <span className="text-white font-medium">{result.regionInfo.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-300">DNO</span>
                <span className="text-white font-medium">{result.regionInfo.dno}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-300">Elec tariff suffix</span>
                <CopyChip value={`E-1R-...-${result.regionCode}`} className="text-sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Gas tariff suffix</span>
                <CopyChip value={`G-1R-...-${result.regionCode}`} className="text-sm" />
              </div>
            </div>
          </div>

          {/* Deep links to trackers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to={`/agile-tracker?region=${result.regionCode}`}
              className="octopus-card-bg rounded-xl p-4 flex items-center justify-between hover:bg-purple-900/30 transition-colors group"
            >
              <div>
                <p className="text-white font-semibold">View Agile Prices</p>
                <p className="text-gray-300 text-xs mt-0.5">Region {result.regionCode} — {result.regionInfo.name}</p>
              </div>
              <span className="text-pink-400 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              to={`/tracker-prices?region=${result.regionCode}`}
              className="octopus-card-bg rounded-xl p-4 flex items-center justify-between hover:bg-purple-900/30 transition-colors group"
            >
              <div>
                <p className="text-white font-semibold">View Tracker Prices</p>
                <p className="text-gray-300 text-xs mt-0.5">Region {result.regionCode} — {result.regionInfo.name}</p>
              </div>
              <span className="text-pink-400 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Customer Snapshot — live data panels for the identified region */}
          {snapshotLoading && (
            <div className="octopus-card-bg rounded-2xl p-6">
              <LoadingSpinner message="Loading live data…" />
            </div>
          )}

          {!snapshotLoading && snapshot && (
            <div className="grid grid-cols-2 gap-3">

              {/* Agile rate card */}
              <div className="octopus-card-bg rounded-2xl p-4 border border-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-3">⚡ Agile Rate</p>
                {(() => {
                  const importRates = snapshot.agile?.import || [];
                  const now = new Date();
                  const todayDateStr = toDateString(now);
                  const todayRates = importRates.filter(r => toDateString(new Date(r.valid_from)) === todayDateStr);
                  const currentSlotR = importRates.find(r => {
                    const from = new Date(r.valid_from);
                    const to   = r.valid_to ? new Date(r.valid_to) : new Date(from.getTime() + 30 * 60 * 1000);
                    return now >= from && now < to;
                  });
                  const currentRate = currentSlotR?.value_inc_vat ?? null;
                  const signal = getSignal(currentRate, todayRates, SVT_CAP.electricity.unitRate);
                  const cfg = signal ? SIGNAL_CONFIG[signal] : null;
                  return currentRate != null ? (
                    <>
                      <p className="text-3xl font-mono font-bold text-white leading-none">
                        {currentRate.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-300 mt-1 mb-3">p/kWh now · Region {result.regionCode}</p>
                      {cfg && (
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-300 text-xs">Rate data unavailable</p>
                  );
                })()}
              </div>

              {/* Carbon intensity card */}
              <div className="octopus-card-bg rounded-2xl p-4 border border-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3">🌿 Carbon Intensity</p>
                {snapshot.carbon?.intensity ? (
                  <>
                    <p className="text-3xl font-mono font-bold text-white leading-none">
                      {snapshot.carbon.intensity.forecast ?? '—'}
                    </p>
                    <p className="text-xs text-gray-300 mt-1 mb-3">gCO₂/kWh · Region {result.regionCode}</p>
                    <span className={`text-xs font-semibold ${CI_COLOR[snapshot.carbon.intensity.index] || 'text-gray-300'}`}>
                      {snapshot.carbon.intensity.index
                        ? snapshot.carbon.intensity.index.charAt(0).toUpperCase() + snapshot.carbon.intensity.index.slice(1)
                        : '—'}
                    </span>
                  </>
                ) : (
                  <p className="text-gray-300 text-xs">Carbon data unavailable</p>
                )}
              </div>

              {/* Tracker rate card — full width */}
              <div className="col-span-2 octopus-card-bg rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">📊 Octopus Tracker — Today</p>
                  <span className="text-xs text-gray-300">Region {result.regionCode}</span>
                </div>
                {snapshot.tracker ? (
                  (() => {
                    const todayStr     = toDateString(new Date());
                    const findToday    = (arr) => arr?.find(r => toDateString(new Date(r.valid_from)) === todayStr) ?? arr?.[arr.length - 1] ?? null;
                    const elecRate     = findToday(snapshot.tracker.electricity?.rates);
                    const elecSC       = findToday(snapshot.tracker.electricity?.standing);
                    const gasRate      = findToday(snapshot.tracker.gas?.rates);
                    const gasSC        = findToday(snapshot.tracker.gas?.standing);
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-300 mb-1">⚡ Electricity</p>
                          <p className="text-3xl font-mono font-bold text-cyan-300 leading-none">
                            {elecRate ? elecRate.value_inc_vat.toFixed(2) : '—'}
                          </p>
                          <p className="text-xs text-gray-300 mt-1">p/kWh</p>
                          {elecSC && <p className="text-xs text-gray-300 mt-2">SC: {elecSC.value_inc_vat.toFixed(2)}p/day</p>}
                        </div>
                        <div>
                          <p className="text-xs text-gray-300 mb-1">🔥 Gas</p>
                          <p className="text-3xl font-mono font-bold text-orange-300 leading-none">
                            {gasRate ? gasRate.value_inc_vat.toFixed(2) : '—'}
                          </p>
                          <p className="text-xs text-gray-300 mt-1">p/kWh</p>
                          {gasSC && <p className="text-xs text-gray-300 mt-2">SC: {gasSC.value_inc_vat.toFixed(2)}p/day</p>}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-300 text-xs">Tracker data unavailable</p>
                )}
              </div>

              {/* Nearby chargers card — full width */}
              <div className="col-span-2 octopus-card-bg rounded-2xl p-4 border border-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-3">🚗 Nearby Public Chargers</p>
                {snapshot.chargers?.chargers?.length > 0 ? (
                  <div className="space-y-2">
                    {snapshot.chargers.chargers.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-gray-300 font-mono w-5">{i + 1}.</span>
                        <span className="text-white flex-1 min-w-0 truncate">{c.name}</span>
                        {c.distanceMi != null && (
                          <span className="text-gray-300 flex-shrink-0">{c.distanceMi.toFixed(1)}mi</span>
                        )}
                        {c.connectors?.[0] && (
                          <span className="text-gray-300 flex-shrink-0">
                            {c.connectors[0].powerKW}kW · {c.connectors[0].type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-300 text-xs">
                    {snapshot.chargers === null
                      ? 'Charger data unavailable'
                      : 'No public chargers found within 2 miles'}
                  </p>
                )}
              </div>

            </div>
          )}

          {/* Weather panel — auto-loads for the looked-up postcode */}
          <WeatherPanel postcode={result.postcode} />
        </div>
      )}

      {/* Region map reference */}
      <div className="mt-8 octopus-card-bg rounded-2xl p-6">
        <p className="text-sm font-semibold text-white mb-3">All UK Regions Reference</p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {Object.entries(REGION_INFO).map(([code, info]) => (
            <div key={code} className={`flex items-center gap-2 p-2 rounded-lg ${result?.regionCode === code ? 'bg-pink-500/20 border border-pink-500/30' : 'bg-white/5'}`}>
              <span className="font-mono font-bold text-pink-400 w-5">{code}</span>
              <span className="text-gray-300">{info.name}</span>
              <span className="text-gray-300 ml-auto font-mono">{info.gsp}</span>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}

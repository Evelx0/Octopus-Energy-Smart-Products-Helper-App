// Outgoing Octopus Rate Tracker — live export rate by DNO region.
// Follows the TrackerPriceTracker pattern: region picker → live stat cards → reference tabs.

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { REGION_LIST } from '../constants/regions';
import { getOutgoingRates, getSolarGeneration, getWeatherForPostcode } from '../services/api';
import RefTabs from '../components/ui/RefTabs';
import CopyChip from '../components/ui/CopyChip';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

const TABS = [
  { id: 'live',      label: 'Live Rate' },
  { id: 'about',     label: 'About Outgoing' },
  { id: 'faq',       label: 'FAQ' },
];

function solarTier(avgHours) {
  if (avgHours >= 5) return { label: 'Good solar potential',     colour: 'text-teal-300',  tip: 'Strong Outgoing Octopus case — likely to export significant kWh in summer months.' };
  if (avgHours >= 3) return { label: 'Moderate solar potential', colour: 'text-amber-300', tip: 'Solid export potential — worth modelling annual earnings at the live export rate above.' };
  return               { label: 'Lower solar period',            colour: 'text-gray-400',  tip: 'Consider seasonal variation — total sunshine hours will be higher in spring/summer.' };
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/10 pt-3 mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between text-left text-gray-200 font-medium hover:text-white"
      >
        <span>{q}</span>
        <span className="ml-4 text-pink-400 text-xl leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-2 text-gray-300 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

export default function OutgoingRateTracker() {
  const location = useLocation();
  const [region,   setRegion]   = useState('H');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [activeTab, setActiveTab] = useState(
    location.state?.tab && TABS.some(t => t.id === location.state.tab)
      ? location.state.tab
      : 'live'
  );

  const [solarData,      setSolarData]      = useState(null);
  const [solarLoading,   setSolarLoading]   = useState(false);
  const [solarAttempted, setSolarAttempted] = useState(false); // prevents infinite retry on upstream failure

  // Postcode solar context
  const [weatherInput,    setWeatherInput]    = useState('');
  const [weatherPostcode, setWeatherPostcode] = useState('');
  const [weatherData,     setWeatherData]     = useState(null);
  const [weatherLoading,  setWeatherLoading]  = useState(false);
  const [weatherError,    setWeatherError]    = useState(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOutgoingRates(region);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load Outgoing Octopus rates.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [region]);

  const fetchSolar = useCallback(async () => {
    setSolarLoading(true);
    try {
      const result = await getSolarGeneration();
      setSolarData(result);
    } catch {
      // Graceful degradation — solar card simply won't render
    } finally {
      setSolarLoading(false);
      setSolarAttempted(true); // mark attempted so we don't retry on failure
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    if (!weatherPostcode) return;
    setWeatherLoading(true);
    setWeatherError(null);
    setWeatherData(null);
    try {
      const result = await getWeatherForPostcode(weatherPostcode);
      setWeatherData(result);
    } catch (err) {
      setWeatherError(err.message || 'Could not load weather data.');
    } finally {
      setWeatherLoading(false);
    }
  }, [weatherPostcode]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Fetch solar data once when Live Rate tab is active — solarAttempted prevents infinite retry on failure
  useEffect(() => {
    if (activeTab === 'live' && !solarAttempted && !solarLoading) {
      fetchSolar();
    }
  }, [activeTab, solarAttempted, solarLoading, fetchSolar]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  function fmtRate(p) {
    if (p == null) return '—';
    return `${p.toFixed(2)}p`;
  }

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Price Tracker</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Outgoing Octopus</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Live export rate for solar customers. Fixed rate per kWh exported to the grid — paid quarterly.
        </p>
      </header>

      {/* Region picker */}
      <div className="octopus-card-bg rounded-2xl p-4 md:p-6 mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          DNO Region
        </label>
        <div className="flex items-center gap-3">
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {REGION_LIST.map(r => (
              <option key={r.code} value={r.code} style={{ background: '#150E38' }}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchRates}
            disabled={loading}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {/* ── LIVE RATE ── */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Live Export Rate</h2>

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {error}
                <button onClick={fetchRates} className="ml-3 text-red-400 hover:text-red-200 underline">Retry</button>
              </div>
            )}

            {loading && !data && (
              <p className="text-gray-400 text-sm">Loading rates…</p>
            )}

            {data && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-xl p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">Export Rate</p>
                    <p className="text-4xl font-black text-white">{fmtRate(data.exportRate)}</p>
                    <p className="text-gray-400 text-xs mt-1">per kWh exported</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Standing Charge</p>
                    <p className="text-4xl font-black text-white">{fmtRate(data.standingCharge)}</p>
                    <p className="text-gray-400 text-xs mt-1">per day (inc. VAT)</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Product Code</p>
                    {data.productCode ? (
                      <CopyChip value={data.productCode} />
                    ) : (
                      <p className="text-gray-400 text-sm">—</p>
                    )}
                    <p className="text-gray-400 text-xs mt-2">Region {data.region}</p>
                  </div>
                </div>

                {/* National solar generation card */}
                {solarData && (() => {
                  // Sheffield Solar returns { data: [[gsp_id, datetime_gmt, generation_mw, capacity_mwp, ...]] }
                  // or { outturn_mw, outturn_pct, ... } depending on endpoint version
                  const raw = solarData?.data?.[0] || solarData;
                  const mw  = typeof raw?.outturn_mw  === 'number' ? raw.outturn_mw
                            : (Array.isArray(solarData?.data?.[0]) ? solarData.data[0][2] : null);
                  const pct = typeof raw?.outturn_pct === 'number' ? raw.outturn_pct : null;
                  if (mw == null) return null;
                  return (
                    <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4 text-sm text-gray-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-1">☀️ National Solar Now</p>
                          <p className="text-2xl font-bold text-white">{Math.round(mw).toLocaleString()} MW</p>
                          {pct != null && <p className="text-yellow-300 text-xs mt-0.5">{pct.toFixed(1)}% of national demand</p>}
                        </div>
                        <p className="text-xs text-gray-600 text-right">Sheffield Solar PV_Live<br/>updated every 30 min</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Context note */}
                <div className="bg-teal-900/20 border border-teal-500/20 rounded-xl p-4 text-sm text-gray-300">
                  <p className="font-semibold text-teal-300 mb-1">About this rate</p>
                  <p>This is a fixed export rate — it does not change half-hourly like Agile Outgoing. Customers receive this rate for every kWh of solar electricity exported to the grid. Payments are made quarterly by Octopus.</p>
                </div>

                {/* ☀️ Postcode solar context */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-3">☀️ Solar Context for Your Customer</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Customer postcode (e.g. SW1A 1AA)"
                      value={weatherInput}
                      onChange={e => setWeatherInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && setWeatherPostcode(weatherInput.replace(/\s/g, ''))}
                      className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button
                      onClick={() => setWeatherPostcode(weatherInput.replace(/\s/g, ''))}
                      disabled={weatherLoading || !weatherInput.trim()}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      {weatherLoading ? 'Loading…' : 'Look up'}
                    </button>
                  </div>

                  {weatherError && (
                    <p className="text-red-400 text-sm mb-2">{weatherError}</p>
                  )}

                  {!weatherData && !weatherLoading && !weatherError && (
                    <p className="text-gray-400 text-xs">Enter the customer's postcode to see their local sunshine data — useful for estimating export potential.</p>
                  )}

                  {weatherData && (() => {
                    const { weather, location } = weatherData;
                    const avgSun    = weather.sunshineHours.reduce((a, b) => a + b, 0) / weather.sunshineHours.length;
                    const avgTemp   = weather.maxTemps.reduce((a, b) => a + b, 0) / weather.maxTemps.length;
                    const totalRain = weather.precipitation.reduce((a, b) => a + b, 0);
                    const tier = solarTier(avgSun);

                    const chartData = {
                      labels: weather.dates.map(d =>
                        new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
                      ),
                      datasets: [{
                        label: 'Sunshine hours',
                        data: weather.sunshineHours,
                        backgroundColor: weather.sunshineHours.map(h =>
                          h >= 6 ? 'rgba(250,204,21,0.75)' : h >= 3 ? 'rgba(167,139,250,0.65)' : 'rgba(107,114,128,0.5)'
                        ),
                        borderRadius: 3,
                      }],
                    };
                    const chartOptions = {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} hrs sunshine` } },
                      },
                      scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
                        y: { ticks: { color: '#9ca3af', font: { size: 9 }, callback: v => `${v}h` }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      },
                    };

                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-400">{location.district} — last 30 days</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-amber-300 text-lg font-black">{avgSun.toFixed(1)}<span className="text-xs font-normal"> hrs/day</span></p>
                            <p className="text-gray-400 text-xs">avg sunshine</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-orange-300 text-lg font-black">{avgTemp.toFixed(1)}<span className="text-xs font-normal">°C</span></p>
                            <p className="text-gray-400 text-xs">avg high temp</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-blue-300 text-lg font-black">{totalRain.toFixed(0)}<span className="text-xs font-normal"> mm</span></p>
                            <p className="text-gray-400 text-xs">total rainfall</p>
                          </div>
                        </div>
                        <div style={{ height: 140 }}>
                          <Bar data={chartData} options={chartOptions} />
                        </div>
                        <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-3 text-sm">
                          <p className="font-semibold mb-1">
                            <span className={tier.colour}>{tier.label}</span>
                          </p>
                          <p className="text-gray-300 text-xs">{tier.tip}</p>
                          {data && (
                            <p className="text-gray-400 text-xs mt-1">
                              At the current export rate of <span className="text-white font-semibold">{fmtRate(data.exportRate)}</span> —{' '}
                              {avgSun >= 5
                                ? 'this customer could earn significantly on export.'
                                : avgSun >= 3
                                ? 'Outgoing Octopus should provide a useful quarterly credit.'
                                : 'encourage the customer to check their expected annual generation figure.'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ABOUT OUTGOING ── */}
        {activeTab === 'about' && (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">About Outgoing Octopus</h2>

            <p>Outgoing Octopus is Octopus Energy's standard solar export tariff. It pays a fixed rate per kWh exported to the national grid from a customer's solar panels.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">Eligibility</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-2"><span className="text-teal-400">✓</span>Solar PV panels installed</li>
                  <li className="flex gap-2"><span className="text-teal-400">✓</span>Export meter point (MPAN) registered with DNO</li>
                  <li className="flex gap-2"><span className="text-teal-400">✓</span>Smart export meter confirming actual export reads</li>
                  <li className="flex gap-2"><span className="text-gray-400">—</span>Battery storage not required (can have battery)</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">How Payments Work</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-2"><span className="text-white">→</span>Payments made <strong className="text-white">quarterly</strong> by Octopus</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Based on actual export meter reads</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Applied as credit to the energy account</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Rate shown is fixed (not time-variable like Agile Outgoing)</li>
                </ul>
              </div>
            </div>

            <div>
              <p className="font-semibold text-white mb-2">Compatible import tariff combinations</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { t: 'Agile Octopus', ok: true },
                  { t: 'Octopus Tracker', ok: true },
                  { t: 'Cosy Octopus', ok: true },
                  { t: 'Flexible Octopus', ok: true },
                  { t: 'Fixed tariff', ok: true },
                  { t: 'Octopus Flux', ok: false, note: 'Flux has bundled export' },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg p-2 text-center ${item.ok ? 'bg-teal-900/30 border border-teal-500/20' : 'bg-red-900/20 border border-red-500/20'}`}>
                    <span className={item.ok ? 'text-teal-300' : 'text-red-300'}>{item.ok ? '✓' : '✗'} {item.t}</span>
                    {item.note && <p className="text-gray-400 text-xs mt-0.5">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 font-semibold mb-1">Outgoing vs Agile Outgoing</p>
              <p className="text-sm">Outgoing Octopus is a <strong className="text-white">fixed rate</strong> — simpler but potentially lower-earning during peak demand periods. Agile Outgoing (Agile export) varies half-hourly and can pay significantly more during 4–7pm peak hours. For solar customers with the flexibility to export during peak windows, Agile Outgoing may be more valuable.</p>
            </div>
          </div>
        )}

        {/* ── FAQ ── */}
        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Questions</h2>
            <FAQ
              q="Can I combine Outgoing Octopus with Intelligent Octopus Go?"
              a="Yes. IO Go (import) and Outgoing Octopus (export) are compatible. A customer can have IO Go for their import and EV smart charging, while using Outgoing Octopus to earn on solar export."
            />
            <FAQ
              q="What's the minimum Ofgem SEG rate?"
              a="Ofgem's Smart Export Guarantee (SEG) requires suppliers with 150,000+ customers to offer a minimum export rate above zero. Octopus's Outgoing rate typically exceeds the bare minimum. The exact minimum varies — check the Ofgem SEG register for the current floor."
            />
            <FAQ
              q="Does Octopus guarantee a payment date?"
              a="Payments are made quarterly, but Octopus doesn't publish a fixed calendar date. They're applied as account credit after each quarterly meter read cycle. Customers can track export earnings in the Octopus app."
            />
            <FAQ
              q="Can a customer combine Outgoing Octopus with Octopus Flux?"
              a="No. Flux is a bundled import + export tariff — it includes its own export component. A customer on Flux already earns on exports through Flux's peak export rate. Outgoing Octopus is redundant and not compatible alongside Flux."
            />
            <FAQ
              q="What is the OUTGOING- product code prefix?"
              a="Outgoing Octopus products typically use the prefix OUTGOING-OCTOPUS- or OUTGOING-FIX-. Unlike Tracker products (which use the unlisted SILVER- prefix), Outgoing products appear in the public Octopus product catalogue."
            />
          </div>
        )}

      </div>
    </main>
  );
}

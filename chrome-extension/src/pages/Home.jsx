// Staff portal home page — Smart Products Knowledge Hub
// Fetches live Agile + Tracker mini-cards on mount (Region H default).

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAgileRates, getTrackerRates, getGenerationMix, getCarbonIntensity } from '../services/api';
import { getFeatureFlagCache } from '../services/storage';
import GoodTimeWidget from '../components/GoodTimeWidget';
import { REGION_LIST } from '../constants/regions';
import { AgileDayBadge } from '../components/AgileUsagePlanner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentAgilePrice(importRates) {
  if (!importRates?.length) return null;
  const now = new Date();
  const current = importRates.find(r => {
    const from = new Date(r.valid_from);
    const to   = new Date(r.valid_to);
    return now >= from && now < to;
  });
  return current ? current.value_inc_vat : null;
}

function getCheapestSlot(importRates) {
  if (!importRates?.length) return null;
  const now = new Date();
  const future = importRates.filter(r => new Date(r.valid_from) >= now);
  if (!future.length) return null;
  const sorted = [...future].sort((a, b) => a.value_inc_vat - b.value_inc_vat);
  return {
    price: sorted[0].value_inc_vat,
    time: new Date(sorted[0].valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

function findTodayRate(rates) {
  if (!rates?.length) return null;
  const todayStr = toDateString(new Date());
  return rates.find(r => toDateString(new Date(r.valid_from)) === todayStr) || null;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function stdDev(values) {
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getDfsWindow(rates) {
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates = (rates || [])
    .filter(rate => {
      const from = new Date(rate.valid_from);
      return from >= now && from <= end && rate.value_inc_vat < 2;
    })
    .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));

  let block = [];
  for (const rate of candidates) {
    const from = new Date(rate.valid_from);
    const expectedNext = block.length
      ? new Date(new Date(block[block.length - 1].valid_from).getTime() + 30 * 60 * 1000)
      : null;
    if (!block.length || from.getTime() === expectedNext.getTime()) block.push(rate);
    else block = [rate];
    if (block.length >= 2) {
      const avg = block.reduce((sum, item) => sum + item.value_inc_vat, 0) / block.length;
      const start = new Date(block[0].valid_from);
      const last = block[block.length - 1];
      const finish = last.valid_to ? new Date(last.valid_to) : new Date(new Date(last.valid_from).getTime() + 30 * 60 * 1000);
      return { start, finish, avg };
    }
  }
  return null;
}

function getRenewablePercent(mix) {
  if (!Array.isArray(mix)) return null;
  return mix
    .filter(item => ['wind', 'solar', 'hydro', 'biomass'].includes(item.fuel))
    .reduce((sum, item) => sum + (item.perc || 0), 0);
}

function getGridStress(carbonIndex, renewablePercent, currentPrice) {
  const ciScore = { 'very low': 1, low: 1, moderate: 3, high: 4, 'very high': 5 }[carbonIndex] || 3;
  const renewableScore = renewablePercent == null ? 3 : renewablePercent > 60 ? 1 : renewablePercent >= 30 ? 3 : 5;
  const priceScore = currentPrice == null ? 3 : currentPrice < 10 ? 1 : currentPrice <= 30 ? 3 : 5;
  const score = Math.round((ciScore + renewableScore + priceScore) / 3);
  if (score <= 2) return { label: 'Relaxed', icon: '🟢', tone: 'text-teal-400', text: 'Grid looks calm — cleaner mix, lower pressure, and manageable prices.' };
  if (score >= 4) return { label: 'Stressed', icon: '🔴', tone: 'text-red-400', text: 'Grid is stressed — higher carbon, lower renewable share, or prices elevated.' };
  return { label: 'Moderate', icon: '🟡', tone: 'text-amber-400', text: 'Grid pressure is mixed — worth checking price and carbon before advising flexible usage.' };
}

function GridIntelligenceCards() {
  const [state, setState] = useState({ loading: true, agile: null, carbon: null, mix: null, flags: {} });

  useEffect(() => {
    Promise.allSettled([
      getAgileRates('H'),
      getCarbonIntensity(),
      getGenerationMix(),
      getFeatureFlagCache(),
    ]).then(([agile, carbon, mix, flags]) => {
      setState({
        loading: false,
        agile: agile.status === 'fulfilled' ? agile.value : null,
        carbon: carbon.status === 'fulfilled' ? carbon.value : null,
        mix: mix.status === 'fulfilled' ? mix.value : null,
        flags: flags.status === 'fulfilled' ? flags.value.flags : {},
      });
    });
  }, []);

  const rates = state.agile?.import || [];
  const todayStr = toDateString(new Date());
  const todayRates = rates.filter(rate => toDateString(new Date(rate.valid_from)) === todayStr);
  const currentPrice = getCurrentAgilePrice(rates);
  const volatility = stdDev(todayRates.map(rate => rate.value_inc_vat));
  const dfsWindow = getDfsWindow(rates);
  const renewablePercent = getRenewablePercent(state.mix?.data?.generationmix);
  const carbonIndex = state.carbon?.data?.[0]?.intensity?.index;
  const stress = getGridStress(carbonIndex, renewablePercent, currentPrice);

  const showDFS = state.flags.showDFSWatch !== false;
  const showStress = state.flags.showGridStress !== false;
  const showVolatility = state.flags.showAgileVolatility !== false;
  if (!showDFS && !showStress && !showVolatility) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {showDFS && (
        <div className="octopus-card-bg rounded-2xl p-5 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-3">⚡ DFS Watch</p>
          {state.loading ? <p className="text-sm text-gray-300">Scanning next 24h…</p> : dfsWindow ? (
            <>
              <p className="text-white font-bold">{formatTime(dfsWindow.start)}-{formatTime(dfsWindow.finish)}</p>
              <p className="text-sm text-gray-300 mt-1">Potential low-price window averaging {dfsWindow.avg.toFixed(1)}p/kWh.</p>
            </>
          ) : (
            <p className="text-sm text-gray-300">No DFS-style low-price signal in the next 24h.</p>
          )}
        </div>
      )}
      {showStress && (
        <div className="octopus-card-bg rounded-2xl p-5 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3">🌍 Grid Stress</p>
          <p className={`text-lg font-bold ${stress.tone}`}>{stress.icon} {stress.label}</p>
          <p className="text-sm text-gray-300 mt-1">{stress.text}</p>
          {renewablePercent != null && <p className="text-xs text-gray-300 mt-3">Renewables: {renewablePercent.toFixed(0)}%</p>}
        </div>
      )}
      {showVolatility && (
        <div className="octopus-card-bg rounded-2xl p-5 border border-white/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-3">📊 Agile Volatility</p>
          {volatility == null ? <p className="text-sm text-gray-300">Waiting for today’s Agile slots.</p> : (
            <>
              <p className={`text-lg font-bold ${volatility > 10 ? 'text-amber-400' : volatility < 5 ? 'text-teal-400' : 'text-white'}`}>
                {volatility < 5 ? 'Stable day' : volatility > 10 ? 'Volatile day' : 'Mixed day'}
              </p>
              <p className="text-sm text-gray-300 mt-1">Rates swinging about ±{volatility.toFixed(1)}p today.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RegionalAgileHeatmap() {
  const [state, setState] = useState({ loading: true, rows: [], error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ loading: true, rows: [], error: null });
      const rows = [];
      for (const region of REGION_LIST) {
        if (cancelled) return;
        try {
          const agile = await getAgileRates(region.code);
          const slot = getCurrentAgilePrice(agile?.import || []);
          rows.push({ region, price: slot, error: null });
        } catch {
          rows.push({ region, price: null, error: 'Unavailable' });
        }
        if (!cancelled) setState({ loading: false, rows: [...rows], error: null });
      }
    }

    load().catch(() => {
      if (!cancelled) setState({ loading: false, rows: [], error: 'Regional comparison unavailable.' });
    });
    return () => { cancelled = true; };
  }, []);

  function tone(price) {
    if (price == null) return 'bg-white/5 text-gray-300 border-white/10';
    if (price < 10) return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    if (price <= 25) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-red-500/15 text-red-300 border-red-500/30';
  }

  const values = state.rows.map(row => row.price).filter(value => value != null);
  const lowest = values.length ? Math.min(...values) : null;
  const highest = values.length ? Math.max(...values) : null;

  return (
    <div className="octopus-card-bg rounded-2xl p-5 border border-white/5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Regional Agile Heatmap</p>
          <p className="text-sm text-gray-300 mt-1">Current Agile import price by GSP region, fetched one region at a time.</p>
        </div>
        {state.loading && <span className="text-xs text-gray-300">Loading {state.rows.length}/{REGION_LIST.length}…</span>}
      </div>

      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {(state.rows.length ? state.rows : REGION_LIST.map(region => ({ region, price: null }))).map(({ region, price }) => (
          <div key={region.code} className={`rounded-xl border p-3 ${tone(price)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold">{region.gsp}</span>
              <span className="text-[10px] text-gray-300">R{region.code}</span>
            </div>
            <p className="text-lg font-black mt-1">{price != null ? `${price.toFixed(1)}p` : '--'}</p>
            <p className="text-[10px] text-gray-300 truncate">{region.name}</p>
          </div>
        ))}
      </div>

      {lowest != null && highest != null && (
        <p className="text-xs text-gray-300 mt-3">
          Spread now: {lowest.toFixed(1)}p to {highest.toFixed(1)}p/kWh. Useful for spotting national vs regional price patterns.
        </p>
      )}
    </div>
  );
}

// ─── Nav card ─────────────────────────────────────────────────────────────────

function NavCard({ to, icon, title, description }) {
  return (
    <Link
      to={to}
      className="octopus-card-bg rounded-xl p-5 flex items-start gap-4 hover:bg-purple-900/30 transition-colors group border border-transparent hover:border-white/10"
    >
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-xl" aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white group-hover:text-pink-400 transition-colors text-sm">{title}</p>
        <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>
      <span className="text-gray-300 group-hover:text-pink-400 group-hover:translate-x-1 transition-all ml-auto">→</span>
    </Link>
  );
}

// ─── Live mini-cards ──────────────────────────────────────────────────────────

function AgileOverviewCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  function fetchAgile() {
    setLoading(true); setError(false);
    getAgileRates('H')
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchAgile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const importRates  = Array.isArray(data?.import) ? data.import : [];
  const currentPrice = getCurrentAgilePrice(importRates);
  const cheapest     = getCheapestSlot(importRates);

  return (
    <div className="octopus-card-bg rounded-2xl p-5 flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">⚡ Agile Octopus</p>
        <Link to="/agile-tracker" className="text-xs text-gray-300 hover:text-pink-400">Full tracker →</Link>
      </div>
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-white/5 rounded w-1/2" />
          <div className="h-8 bg-white/5 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm">
          Could not load rates.{' '}
          <button onClick={fetchAgile} className="underline hover:text-white">Retry</button>
        </p>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-300">Current import price</p>
            <p className="text-2xl font-bold text-white">
              {currentPrice != null ? `${currentPrice.toFixed(2)}p/kWh` : 'N/A'}
            </p>
          </div>
          {cheapest && (
            <div>
              <p className="text-xs text-gray-300">Cheapest upcoming slot</p>
              <p className="text-lg font-semibold text-green-400">
                {cheapest.price.toFixed(2)}p/kWh <span className="text-gray-300 text-sm font-normal">at {cheapest.time}</span>
              </p>
            </div>
          )}
          <AgileDayBadge rates={importRates} compact />
        </div>
      )}
      <p className="text-xs text-gray-300 mt-4 italic">Region H (Southern England)</p>
    </div>
  );
}

function TrackerOverviewCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  function fetchTracker() {
    setLoading(true); setError(false);
    getTrackerRates('H')
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchTracker(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elecRates = Array.isArray(data?.electricity?.rates) ? data.electricity.rates : [];
  const gasRates  = Array.isArray(data?.gas?.rates)         ? data.gas.rates         : [];
  const elecRate  = findTodayRate(elecRates);
  const gasRate   = findTodayRate(gasRates);

  return (
    <div className="octopus-card-bg rounded-2xl p-5 flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">🔥 Octopus Tracker</p>
        <Link to="/tracker-prices" className="text-xs text-gray-300 hover:text-amber-400">Full tracker →</Link>
      </div>
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-white/5 rounded w-1/2" />
          <div className="h-8 bg-white/5 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm">
          Could not load rates.{' '}
          <button onClick={fetchTracker} className="underline hover:text-white">Retry</button>
        </p>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-300">⚡ Elec today</p>
            <p className="text-xl font-bold text-white">
              {elecRate ? `${elecRate.value_inc_vat.toFixed(2)}p` : '—'}
            </p>
            <p className="text-xs text-gray-300">per kWh</p>
          </div>
          <div>
            <p className="text-xs text-gray-300">🔥 Gas today</p>
            <p className="text-xl font-bold text-white">
              {gasRate ? `${gasRate.value_inc_vat.toFixed(2)}p` : '—'}
            </p>
            <p className="text-xs text-gray-300">per kWh</p>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-300 mt-4 italic">Region H (Southern England)</p>
    </div>
  );
}

// ─── Live Grid Generation Mix ────────────────────────────────────────────────

const FUEL_COLOURS = {
  wind:    { bar: 'bg-teal-400',   label: 'text-teal-300',   name: 'Wind'    },
  solar:   { bar: 'bg-yellow-400', label: 'text-yellow-300', name: 'Solar'   },
  gas:     { bar: 'bg-orange-400', label: 'text-orange-300', name: 'Gas'     },
  nuclear: { bar: 'bg-purple-400', label: 'text-purple-300', name: 'Nuclear' },
  imports: { bar: 'bg-blue-400',   label: 'text-blue-300',   name: 'Imports' },
  hydro:   { bar: 'bg-cyan-400',   label: 'text-cyan-300',   name: 'Hydro'   },
  biomass: { bar: 'bg-green-400',  label: 'text-green-300',  name: 'Biomass' },
  coal:    { bar: 'bg-red-500',    label: 'text-red-400',    name: 'Coal'    },
  other:   { bar: 'bg-gray-400',   label: 'text-gray-300',   name: 'Other'   },
};

function GridMixCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  function fetchMix() {
    setLoading(true); setError(false);
    getGenerationMix()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchMix(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract and sort fuels from CI API response.
  // /generation returns data as a plain object (not an array).
  const fuels = (() => {
    const mix = data?.data?.generationmix;
    if (!Array.isArray(mix)) return [];
    return [...mix]
      .filter(f => f.perc > 0)
      .sort((a, b) => b.perc - a.perc);
  })();

  const updatedAt = data?.data?.from
    ? new Date(data.data.from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="octopus-card-bg rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">🌍 Live UK Grid Mix</p>
        <div className="flex items-center gap-2">
          {updatedAt && <span className="text-xs text-gray-300">Data from {updatedAt}</span>}
          <button
            onClick={fetchMix}
            disabled={loading}
            className="text-xs text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
            title="Refresh"
          >↻</button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm">
          Could not load grid data.{' '}
          <button onClick={fetchMix} className="underline hover:text-white">Retry</button>
        </p>
      )}

      {!loading && !error && fuels.length > 0 && (
        <>
          {/* Stacked proportional bar */}
          <div className="flex rounded-full overflow-hidden h-3 mb-3 gap-px">
            {fuels.map(f => {
              const c = FUEL_COLOURS[f.fuel] || FUEL_COLOURS.other;
              return (
                <div
                  key={f.fuel}
                  className={`${c.bar} transition-all`}
                  style={{ width: `${f.perc}%` }}
                  title={`${(FUEL_COLOURS[f.fuel] || FUEL_COLOURS.other).name}: ${f.perc}%`}
                />
              );
            })}
          </div>

          {/* Top fuels as chips */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {fuels.slice(0, 6).map(f => {
              const c = FUEL_COLOURS[f.fuel] || FUEL_COLOURS.other;
              return (
                <span key={f.fuel} className={`text-xs font-medium ${c.label}`}>
                  {c.name} {f.perc}%
                </span>
              );
            })}
          </div>
          <p className="text-xs text-gray-300 mt-2">Carbon Intensity API · updated every 30 min</p>
        </>
      )}
    </div>
  );
}

// ─── Situation Navigator ─────────────────────────────────────────────────────

const NAVIGATOR_TARIFFS = [
  { id: 'agile',   label: 'Agile Octopus',          colour: 'text-pink-400'  },
  { id: 'tracker', label: 'Octopus Tracker',         colour: 'text-amber-400' },
  { id: 'io-go',   label: 'Intelligent Octopus Go',  colour: 'text-teal-400'  },
  { id: 'flux',    label: 'Flux',                    colour: 'text-blue-400'  },
  { id: 'cosy',    label: 'Cosy Octopus',            colour: 'text-orange-400'},
  { id: 'none',    label: 'Not on a smart tariff',   colour: 'text-gray-300'  },
  { id: 'unknown', label: 'Unknown / not sure',      colour: 'text-gray-300'  },
];

const SITUATIONS = {
  agile:   [
    { id: 'rate-spike',  label: 'Rate is very high / price spike' },
    { id: 'billing',     label: 'Billing or statement question' },
    { id: 'switch-out',  label: 'Wants to switch away from Agile' },
    { id: 'switch-in',   label: 'Someone else wants to switch TO Agile' },
    { id: 'no-flex',     label: "Can't shift usage / inflexible schedule" },
  ],
  tracker: [
    { id: 'rate-spike',  label: 'Electricity rate is high this month' },
    { id: 'gas-bill',    label: 'Gas bill is unexpectedly high' },
    { id: 'switch-out',  label: 'Wants to switch away from Tracker' },
    { id: 'comparison',  label: 'Comparing Tracker vs Agile' },
  ],
  'io-go': [
    { id: 'no-charge',   label: "Car didn't charge last night" },
    { id: 'charger',     label: 'Charger or OCPP diagnostic issue' },
    { id: 'compat',      label: 'EV or charger compatibility question' },
    { id: 'switch-in',   label: 'Wants to switch TO IO Go' },
    { id: 'switch-out',  label: 'Wants to leave IO Go' },
  ],
  flux:    [
    { id: 'eligibility', label: 'Eligibility or requirements check' },
    { id: 'setup',       label: 'Solar + battery setup question' },
    { id: 'billing',     label: 'Peak / off-peak billing confusion' },
  ],
  cosy:    [
    { id: 'heat-pump',   label: 'Heat pump scheduling and savings' },
    { id: 'peak',        label: 'How to avoid the peak window' },
    { id: 'eligibility', label: 'Eligibility or suitability check' },
  ],
  none:    [
    { id: 'recommend',   label: 'Which smart tariff should I recommend?' },
    { id: 'cheapest',    label: 'Customer just wants the cheapest option' },
    { id: 'solar',       label: 'Customer has solar panels' },
    { id: 'ev',          label: 'Customer has an EV' },
    { id: 'heat-pump',   label: 'Customer has a heat pump' },
  ],
  unknown: [
    { id: 'recommend',   label: 'Help me recommend the right tariff' },
    { id: 'cheapest',    label: 'Customer wants the cheapest tariff' },
    { id: 'comparison',  label: 'General tariff comparison question' },
  ],
};

// Result content for each [tariff, situation] combination
const SCENARIO_RESULTS = {
  'agile|rate-spike': {
    title: 'Agile — Rate spike explanation',
    points: [
      'Spikes above 40p/kWh are normal during winter peak demand windows (4–9pm weekdays).',
      'Check the Agile Price Tracker for the exact period — Carbon Intensity correlates with price.',
      'Reassure: the spike is time-limited. 80%+ of the day trades below the SVT cap.',
      'Remind the customer their bill is based on actual consumption by half-hour slot — shifting usage helps.',
    ],
    pages: [
      { label: 'Agile Price Tracker', route: '/agile-tracker' },
      { label: 'Agile Reference → Rate Structure', route: '/tariffs/agile', tab: 'rate-structure' },
    ],
  },
  'agile|billing': {
    title: 'Agile — Billing question',
    points: [
      'Agile bills use half-hourly consumption data × the rate for each slot.',
      'High bills are usually caused by usage during peak evening windows (4–9pm).',
      'Check the cost comparison tool for their region and date range.',
      'Standing charge is fixed regardless of usage.',
    ],
    pages: [
      { label: 'Agile Reference → Rate Structure', route: '/tariffs/agile', tab: 'rate-structure' },
      { label: 'Cost Comparison (Agile Tracker)', route: '/agile-tracker' },
    ],
  },
  'agile|switch-out': {
    title: 'Agile — Customer wants to leave',
    points: [
      'Understand why: if inflexible usage, Agile may genuinely not suit them.',
      'Alternatives: Tracker (daily variable), Flexible (fixed month-to-month), Fixed (lock-in).',
      'If they have solar + battery → Flux might be a better fit.',
      'No exit fee on Agile. Switching takes up to 17 working days typically.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'agile|switch-in': {
    title: 'Switching a customer TO Agile',
    points: [
      'SMETS2 meter required (SMETS1 can work but half-hourly reads not guaranteed).',
      'No Economy 7 — Agile only supports single-register smart meters.',
      'Best suited to: EV owners, heat pump users, anyone flexible with usage timing.',
      'Check their region — rates vary significantly by DNO region.',
    ],
    pages: [
      { label: 'Agile Reference → Eligibility', route: '/tariffs/agile', tab: 'eligibility' },
      { label: 'Eligibility Checker', route: '/eligibility' },
      { label: 'Postcode → Region Lookup', route: '/region-lookup' },
    ],
  },
  'agile|no-flex': {
    title: 'Agile — Customer with inflexible usage',
    points: [
      'If they genuinely cannot shift any usage, Agile is likely not their best tariff.',
      'Suggest Tracker (wholesale-linked but daily), or a fixed tariff for certainty.',
      'Confirm: do they at least have overnight low usage? Even sleep-time charges help.',
      'Use the cost comparison tool to show a realistic estimate vs their alternatives.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Agile Reference → Pros & Cons', route: '/tariffs/agile', tab: 'pros-cons' },
      { label: 'Cost Comparison (Agile Tracker)', route: '/agile-tracker' },
    ],
  },
  'tracker|rate-spike': {
    title: 'Tracker — High electricity rate',
    points: [
      'Tracker electricity rates follow the wholesale market — winter cold snaps drive spikes.',
      'The Tracker price cap (Ofgem SVT) limits how high rates can go.',
      'Show the historical rate chart to contextualise vs the recent trend.',
      'Unlike Agile, Tracker rate is flat for the whole day — no peak/off-peak.',
    ],
    pages: [
      { label: 'Tracker Price Tracker', route: '/tracker-prices' },
      { label: 'Tracker Reference → Rate Structure', route: '/tariffs/tracker', tab: 'rate-structure' },
    ],
  },
  'tracker|gas-bill': {
    title: 'Tracker — High gas bill',
    points: [
      'Tracker covers BOTH electricity AND gas — both are wholesale-linked.',
      'Gas rates can spike significantly in winter; this is expected behaviour.',
      'Key context: what was the Tracker gas rate vs the SVT cap for the period?',
      'If they want certainty on gas, suggest moving gas to a fixed deal (Tracker elec can be kept separate).',
    ],
    pages: [
      { label: 'Tracker Price Tracker', route: '/tracker-prices' },
      { label: 'Tracker Reference → Rate Structure', route: '/tariffs/tracker', tab: 'rate-structure' },
    ],
  },
  'tracker|switch-out': {
    title: 'Tracker — Customer wants to leave',
    points: [
      'No exit fee on Tracker. Switching takes up to 17 working days.',
      'If they want price certainty: Fixed tariff. If flexibility: Flexible Octopus.',
      'If they have an EV and want smart charging: IO Go.',
      'If they have solar + battery: Flux.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'tracker|comparison': {
    title: 'Tracker vs Agile comparison',
    points: [
      'Tracker: one rate per day, covers both electricity and gas.',
      'Agile: 48 rates per day (half-hourly), electricity only, rewards flexible usage.',
      'Agile is better for customers who can shift usage to cheap slots.',
      'Tracker is better for customers who want wholesale transparency without timing pressure.',
      'Use the Bill Simulator to compare both against their usage estimate.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Bill Simulator', route: '/bill-calculator' },
    ],
  },
  'io-go|no-charge': {
    title: 'IO Go — Car didn\'t charge last night',
    points: [
      '1. Was the car plugged in by midnight? IO Go charging starts from ~midnight–7am.',
      '2. Was the battery already at the customer\'s set charge limit? Octopus won\'t charge beyond it.',
      '3. Is the charger connected (OCPP/WiFi)? Check the OCPP Diagnostics page for error codes.',
      '4. Post March 2026: 6-hour smart charge limit — if they hit it earlier, later windows won\'t fire.',
      '5. For Tesla/Ford: has the vehicle API auth expired? Customer needs to re-authorise in Octopus app.',
    ],
    pages: [
      { label: 'IO Go Reference → Smart Charging', route: '/tariffs/intelligent', tab: 'smart-charging' },
      { label: 'IO Go — Live Charging Context', route: '/tariffs/intelligent', tab: 'charging-live' },
      { label: 'IO Go — OCPP Diagnostics', route: '/tariffs/intelligent-ocpp' },
    ],
  },
  'io-go|charger': {
    title: 'IO Go — Charger / OCPP issue',
    points: [
      'Open the OCPP Diagnostics page and search for the error code from the charger log.',
      'Common issues: OCPP connection lost (charger offline), AuthenticationFailed, StopTransaction.',
      'Check if the charger firmware is up to date — outdated firmware causes many OCPP issues.',
      'Escalate to Charge Points team if: charger offline for >24h, repeated AuthFailure.',
    ],
    pages: [
      { label: 'IO Go — OCPP Diagnostics', route: '/tariffs/intelligent-ocpp' },
      { label: 'IO Go Reference → Smart Charging', route: '/tariffs/intelligent', tab: 'smart-charging' },
    ],
  },
  'io-go|compat': {
    title: 'IO Go — Compatibility check',
    points: [
      'Use the Vehicle Checker to confirm full integration vs charger-only (OCPP) compatibility.',
      'Full integration (car API): Tesla, VW Group, BMW, Hyundai/Kia, Ford, Polestar, Renault.',
      'Charger-only (OCPP path): MG, Nissan Leaf, Vauxhall — no car API, works via approved charger.',
      'Charger must be OCPP 1.6+ and Octopus-approved for charger-only path.',
    ],
    pages: [
      { label: 'IO Go — Vehicle Checker', route: '/tariffs/intelligent-vehicles' },
      { label: 'IO Go Reference → Requirements', route: '/tariffs/intelligent', tab: 'requirements' },
    ],
  },
  'io-go|switch-in': {
    title: 'Switching a customer TO IO Go',
    points: [
      'SMETS2 meter required. Compatible EV + home charger required.',
      'Walk through the onboarding guide for their specific vehicle path (Tesla/Ford/VW/Charger-only).',
      'Check vehicle compatibility first — both \'full\' and \'charger\' tier work.',
      'Confirm charger is Octopus-approved and OCPP-capable.',
    ],
    pages: [
      { label: 'IO Go — Vehicle Checker', route: '/tariffs/intelligent-vehicles' },
      { label: 'IO Go — Onboarding Guide', route: '/tariffs/intelligent-onboarding' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'io-go|switch-out': {
    title: 'IO Go — Customer wants to leave',
    points: [
      'No exit fee. Switching takes up to 17 working days.',
      'If they still have an EV: Agile can save money if they manually time charging to cheap slots.',
      'If they want simplicity: Flexible Octopus or Fixed.',
      'If they have solar: Flux might be worth discussing.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'flux|eligibility': {
    title: 'Flux — Eligibility check',
    points: [
      'Three hard requirements: solar PV, home battery storage, AND SMETS2 export meter.',
      'All three must be present — no exceptions.',
      'Flux bundles import AND export in one tariff — customer cannot add separate export tariff.',
      'Compatible with Outgoing Octopus? No — Flux already includes the export component.',
    ],
    pages: [
      { label: 'Flux Reference → Requirements', route: '/tariffs/flux', tab: 'requirements' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'flux|setup': {
    title: 'Flux — Solar + battery questions',
    points: [
      'Flux is self-contained: cheap off-peak (2–5am), standard day rate, expensive peak (4–7pm).',
      'Strategy: charge battery overnight (cheap), discharge during peak to avoid grid import.',
      'Export: sell to grid at the export rate during high-price periods.',
      'No separate SEG or Outgoing tariff needed — Flux covers everything.',
    ],
    pages: [
      { label: 'Flux Reference → Time-of-Use Bands', route: '/tariffs/flux', tab: 'tou-bands' },
      { label: 'Flux Reference → Overview', route: '/tariffs/flux', tab: 'overview' },
    ],
  },
  'flux|billing': {
    title: 'Flux — Peak/off-peak billing',
    points: [
      'Three bands: off-peak (~2–5am cheap), standard (most of the day), peak (4–7pm most expensive).',
      'Customer should NOT use grid power during 4–7pm — this is the key behaviour change.',
      'Battery should be charged overnight and covering peak demand from stored energy.',
      'Check Flux Reference → Time-of-Use Bands for exact band times and current rates.',
    ],
    pages: [
      { label: 'Flux Reference → Time-of-Use Bands', route: '/tariffs/flux', tab: 'tou-bands' },
    ],
  },
  'cosy|heat-pump': {
    title: 'Cosy — Heat pump scheduling',
    points: [
      'Cosy has three cheap windows per day: 04–07, 13–16, 22–00.',
      'Heat pump should be scheduled to run during these windows to maximise savings.',
      'Programme the heat pump thermostat to pre-heat/cool during cheap windows.',
      'Thermal mass of the home retains heat — running during cheap windows, resting during peak.',
    ],
    pages: [
      { label: 'Cosy Reference → Time-of-Use Bands', route: '/tariffs/cosy', tab: 'tou-bands' },
      { label: 'Cosy Reference → Heat Pump Guide', route: '/tariffs/cosy', tab: 'heat-pump' },
    ],
  },
  'cosy|peak': {
    title: 'Cosy — Avoiding the peak window',
    points: [
      'Peak window: 16–19 daily. Roughly 50% above the standard day rate.',
      'Heat pump should NOT run during 16–19 if avoidable — pre-heat before 16:00.',
      'Key message: the savings in cheap windows should outweigh the peak premium if timed well.',
      'Customers who absolutely cannot avoid 16–19 usage should reconsider Cosy.',
    ],
    pages: [
      { label: 'Cosy Reference → Time-of-Use Bands', route: '/tariffs/cosy', tab: 'tou-bands' },
    ],
  },
  'cosy|eligibility': {
    title: 'Cosy — Eligibility check',
    points: [
      'Smart meter (SMETS1 or SMETS2) required.',
      'Designed for homes with heat pumps, electric boilers, or electric radiators.',
      'NOT compatible with Agile, IO Go, Flux, or Tracker — customer must choose one import tariff.',
      'Can be combined with Outgoing Octopus for solar export.',
    ],
    pages: [
      { label: 'Cosy Reference → Overview', route: '/tariffs/cosy', tab: 'overview' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'none|recommend': {
    title: 'Recommending a smart tariff',
    points: [
      'EV → IO Go (if SMETS2 + compatible car/charger). If inflexible EV: Agile still viable.',
      'Solar + battery → Flux.',
      'Heat pump / electric heating → Cosy Octopus.',
      'Flexible usage, no EV/solar → Agile (best savings potential).',
      'Wants wholesale transparency without timing pressure → Tracker.',
      'Use the Eligibility Checker to confirm requirements quickly.',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Eligibility Checker', route: '/eligibility' },
      { label: 'Bill Simulator', route: '/bill-calculator' },
    ],
  },
  'none|cheapest': {
    title: 'Customer wants the cheapest tariff',
    points: [
      'Agile has the highest savings POTENTIAL but requires flexible usage timing.',
      'Run the Bill Simulator with their usage and region for a data-driven comparison.',
      'Remind: Agile average ≠ Agile cost if they shift usage to cheap slots — can be much lower.',
      'Fixed tariff = certainty; Tracker = wholesale-linked but no timing flexibility needed.',
    ],
    pages: [
      { label: 'Bill Simulator', route: '/bill-calculator' },
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
    ],
  },
  'none|solar': {
    title: 'Customer has solar panels',
    points: [
      'Do they also have a battery? → Flux (requires solar + battery + SMETS2 export meter).',
      'Solar only, no battery → Outgoing Octopus for export, Agile or Tracker for import.',
      'Agile export (Agile Outgoing) pays half-hourly variable export rates — good in summer.',
      'Check their export meter point exists before recommending any export tariff.',
    ],
    pages: [
      { label: 'Flux Reference → Requirements', route: '/tariffs/flux', tab: 'requirements' },
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Postcode → Region Lookup (solar context)', route: '/region-lookup' },
    ],
  },
  'none|ev': {
    title: 'Customer has an EV',
    points: [
      'IO Go is the primary recommendation: automated smart charging overnight.',
      'Check vehicle compatibility first — full integration vs charger-only (OCPP) path.',
      'If car is not compatible with IO Go: Agile is still excellent for EV owners (manual timing).',
      'SMETS2 required for IO Go. SMETS1/2 both work for Agile.',
    ],
    pages: [
      { label: 'IO Go — Vehicle Checker', route: '/tariffs/intelligent-vehicles' },
      { label: 'IO Go Reference → Overview', route: '/tariffs/intelligent', tab: 'overview' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'none|heat-pump': {
    title: 'Customer has a heat pump',
    points: [
      'Cosy Octopus is designed specifically for heat pump homes — cheap windows align with pre-heating.',
      'IO Go is also an option if they also have an EV.',
      'Agile works if they can schedule the heat pump to cheap half-hourly slots.',
      'Flux if they also have solar + battery.',
    ],
    pages: [
      { label: 'Cosy Reference → Heat Pump Guide', route: '/tariffs/cosy', tab: 'heat-pump' },
      { label: 'Eligibility Checker', route: '/eligibility' },
    ],
  },
  'unknown|recommend': {
    title: 'Help recommend the right tariff',
    points: [
      'Ask: Do they have an EV? → IO Go (if compatible car/charger) or Agile.',
      'Ask: Solar + battery? → Flux.',
      'Ask: Heat pump or electric heating? → Cosy Octopus.',
      'Ask: Flexible with usage timing? → Agile.',
      'None of the above / wants certainty → Tracker or Fixed.',
    ],
    pages: [
      { label: 'Eligibility Checker', route: '/eligibility' },
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
    ],
  },
  'unknown|cheapest': {
    title: 'Customer wants the cheapest tariff',
    points: [
      'Run the Bill Simulator — most accurate for their region and usage.',
      'Agile potential is highest but depends on usage flexibility.',
      'Tracker is transparent and no lock-in.',
      'Fixed gives certainty but misses out if wholesale prices fall.',
    ],
    pages: [
      { label: 'Bill Simulator', route: '/bill-calculator' },
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
    ],
  },
  'unknown|comparison': {
    title: 'General tariff comparison',
    points: [
      'Use the Compare All Tariffs page for a side-by-side feature breakdown.',
      'Use the Bill Simulator for a cost estimate by region and usage.',
      'Key differentiator: Agile (half-hourly), Tracker (daily), IO Go (EV smart charging), Flux (solar+battery).',
    ],
    pages: [
      { label: 'Compare All Tariffs', route: '/tariffs/comparison' },
      { label: 'Bill Simulator', route: '/bill-calculator' },
    ],
  },
};

function SituationNavigator() {
  const navigate = useNavigate();
  const [tariff,    setTariff]    = useState('');
  const [situation, setSituation] = useState('');

  function handleTariffChange(id) {
    setTariff(id);
    setSituation(''); // reset situation when tariff changes
  }

  const situations = tariff ? (SITUATIONS[tariff] || []) : [];
  const resultKey  = tariff && situation ? `${tariff}|${situation}` : null;
  const result     = resultKey ? SCENARIO_RESULTS[resultKey] : null;

  function goTo(route, tab) {
    navigate(route, tab ? { state: { tab } } : undefined);
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">Situation Navigator</p>
        <span className="text-xs text-gray-300 italic">— find the right page fast</span>
      </div>
      <div className="octopus-card-bg rounded-2xl p-5 space-y-4">
        {/* Row 1: Tariff selector */}
        <div>
          <p className="text-xs text-gray-300 font-medium mb-2">Customer is currently on:</p>
          <div className="flex flex-wrap gap-2">
            {NAVIGATOR_TARIFFS.map(t => (
              <button
                key={t.id}
                onClick={() => handleTariffChange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  tariff === t.id
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Situation selector (shown once tariff is picked) */}
        {tariff && situations.length > 0 && (
          <div>
            <p className="text-xs text-gray-300 font-medium mb-2">They're asking about / experiencing:</p>
            <div className="flex flex-wrap gap-2">
              {situations.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSituation(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    situation === s.id
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result panel */}
        {result && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white font-semibold text-sm">{result.title}</p>
            <ul className="space-y-1.5">
              {result.points.map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-teal-400 flex-shrink-0">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {result.pages.map((p, i) => (
                <button
                  key={i}
                  onClick={() => goTo(p.route, p.tab)}
                  className="px-3 py-1.5 bg-purple-700/50 hover:bg-purple-600/60 border border-purple-500/40 rounded-lg text-xs text-purple-200 hover:text-white transition-colors"
                >
                  → {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!tariff && (
          <p className="text-gray-300 text-xs italic">Select the customer's current tariff above to get started.</p>
        )}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8">

      {/* Hero */}
      <header className="text-center my-6 md:my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Internal Tool</p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
          Smart Products{' '}
          <span className="octopus-text-gradient">Knowledge Hub</span>
        </h1>
        <p className="mt-3 text-base text-gray-300 max-w-xl mx-auto">
          Live tariff data, product guides, and customer talking points.
        </p>
      </header>

      {/* Live rate mini-cards + timing widget */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">
          Live Rates — Region H (Southern England) · <Link to="/region-lookup" className="text-teal-400 hover:underline">Look up a customer's region →</Link>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AgileOverviewCard />
          <TrackerOverviewCard />
          <GoodTimeWidget />
        </div>
      </div>

      {/* Live Grid Generation Mix */}
      <div className="mb-8">
        <GridMixCard />
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">
          Grid Intelligence
        </p>
        <div className="space-y-4">
          <GridIntelligenceCards />
          <RegionalAgileHeatmap />
        </div>
      </div>

      {/* Situation Navigator */}
      <SituationNavigator />

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">Price Trackers</p>
        </div>
        <NavCard to="/agile-tracker"   icon="⚡" title="Agile Price Tracker"        description="Half-hourly import & export rates. Date navigation, historical data, carbon intensity." />
        <NavCard to="/tracker-prices"  icon="📊" title="Tracker Price Tracker"      description="Daily electricity and gas rates. Tomorrow's preview, 14-day chart, historical data." />
        <NavCard to="/region-lookup"   icon="📍" title="Postcode → Region Lookup"   description="Enter a customer's postcode to identify their DNO region, GSP code, and network operator." />

        <div className="lg:col-span-3 mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">Tariff Reference</p>
        </div>
        <NavCard to="/tariffs/agile"                  icon="⚡" title="Agile Octopus Guide"        description="Half-hourly pricing, smart meter requirements, pros/cons, customer talking points." />
        <NavCard to="/tariffs/tracker"                icon="📈" title="Octopus Tracker Guide"      description="Daily rates, SILVER- product code explained, gas coverage, rate cap details." />
        <NavCard to="/tariffs/intelligent"            icon="🚗" title="Intelligent Octopus Go"     description="EV smart charging, compatible vehicles/chargers, automated scheduling explained." />
        <NavCard to="/tariffs/intelligent-vehicles"   icon="🔍" title="IO Go — Vehicle Checker"    description="Instantly check if a customer's car is compatible and what tier of integration they get." />
        <NavCard to="/tariffs/intelligent-ocpp"       icon="🔌" title="IO Go — OCPP Diagnostics"   description="Decode OCPP payload codes from charger diagnostic logs — plain-English ELI5 explanations." />
        <NavCard to="/tariffs/intelligent-onboarding" icon="📱" title="IO Go — Onboarding Guide"   description="Step-by-step setup guide for Tesla, Ford, VW/BMW/Mercedes and charger-only paths." />
        <NavCard to="/tariffs/flux"                   icon="☀️" title="Flux Guide"                 description="Solar + battery time-of-use tariff. Three bands, import/export bundled." />
        <NavCard to="/tariffs/cosy"                   icon="🔥" title="Cosy Octopus Guide"         description="Heat pump & electric heating tariff. Triple-dip ToU bands, Cosy schedule optimisation." />
        <NavCard to="/tariffs/comparison"             icon="📋" title="Compare All Tariffs"        description="Side-by-side table: Agile, Tracker, IO Go, Go, Flux, Outgoing Octopus." />
        <NavCard to="/eligibility"                    icon="✅" title="Eligibility Checker"        description="Fill in customer's setup to see which tariffs they qualify for and why." />

        <div className="lg:col-span-3 mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">Reference</p>
        </div>
        <NavCard to="/knowledge-base" icon="🧠" title="Knowledge Base" description="Searchable FAQs, decision frameworks, call guidance, and troubleshooting quick references." />
        <NavCard to="/terminology" icon="📖" title="Terminology Glossary" description="Searchable definitions: MPAN, MPRN, GSP, DNO, SMETS2, SVT, ToU, SEG, and more." />
        <NavCard to="/system-health" icon="🩺" title="System Health" description="Backend health, version checks, refresh status, feature flags, and local API latency." />
      </div>

    </main>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTrackerRates, getCarbonIntensity, getTrackerProducts } from '../services/api';
import { REGION_INFO, REGION_LIST } from '../constants/regions';
import { SVT_CAP } from '../constants/svt';
import TrackerChart from '../components/TrackerChart';
import TrackerHistoricalData from '../components/TrackerHistoricalData';
import TariffCostComparison from '../components/TariffCostComparison';
import CarbonChart from '../components/CarbonChart';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CopyChip from '../components/ui/CopyChip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Find the rate entry that covers a given calendar date (in local time).
 * Tracker valid_from is in UTC (e.g. 2026-04-12T23:00:00Z = midnight BST = 13 Apr UK).
 */
function findRateForDate(rates, targetDateStr) {
  if (!rates || !rates.length) return null;
  return rates.find(r => toDateString(new Date(r.valid_from)) === targetDateStr) || null;
}

// ─── Fuel card ───────────────────────────────────────────────────────────────

function FuelCard({ label, colour, unitRate, standingCharge, svtUnitRate, prefix = '' }) {
  const belowSvt = unitRate != null && unitRate < svtUnitRate;
  return (
    <div className="octopus-card-bg rounded-2xl p-5 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: colour }}>
        {label}
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{prefix}Unit Rate</p>
          {unitRate != null ? (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white">
                {unitRate.toFixed(2)}<span className="text-lg font-normal text-gray-400 ml-1">p/kWh</span>
              </p>
              {belowSvt && (
                <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  Below SVT cap
                </span>
              )}
              {!belowSvt && unitRate != null && (
                <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  Above SVT cap
                </span>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Not available</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{prefix}Standing Charge</p>
          {standingCharge != null ? (
            <p className="text-xl font-semibold text-gray-200">
              {standingCharge.toFixed(2)}<span className="text-sm font-normal text-gray-400 ml-1">p/day</span>
            </p>
          ) : (
            <p className="text-gray-400 text-sm">Not available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrackerPriceTracker() {
  const [searchParams] = useSearchParams();
  const urlRegion = searchParams.get('region');
  const validUrlRegion = urlRegion && REGION_INFO[urlRegion] ? urlRegion : null;

  const [selectedRegion, setSelectedRegion] = useState(validUrlRegion || 'H');
  const [activeTab,      setActiveTab]      = useState('dashboard');

  const [trackerData,         setTrackerData]         = useState(null);
  const [trackerProductCode,  setTrackerProductCode]  = useState(null);
  const [carbonData,          setCarbonData]          = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState(null);

  // Historical product selector
  const [trackerProducts,     setTrackerProducts]     = useState([]);
  const [selectedProduct,     setSelectedProduct]     = useState(null); // null = current live

  const intervalRef = useRef(null);

  const fetchDashboardData = useCallback(async (region) => {
    setLoading(true);
    setError(null);
    try {
      const [tracker, carbon] = await Promise.allSettled([
        getTrackerRates(region),
        getCarbonIntensity(),
      ]);

      if (tracker.status === 'fulfilled') {
        setTrackerData(tracker.value);
        if (tracker.value.trackerProductCode) setTrackerProductCode(tracker.value.trackerProductCode);
      } else {
        throw tracker.reason;
      }

      if (carbon.status === 'fulfilled') {
        setCarbonData(carbon.value);
      }
    } catch (e) {
      setError(e.message || 'Failed to load Tracker rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    fetchDashboardData(selectedRegion);
    intervalRef.current = setInterval(
      () => fetchDashboardData(selectedRegion),
      30 * 60 * 1000,
    );
    return () => clearInterval(intervalRef.current);
  }, [selectedRegion, activeTab, fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData(selectedRegion);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch available tracker product list once on mount (for historical dropdown)
  useEffect(() => {
    getTrackerProducts()
      .then(data => {
        if (data && Array.isArray(data.products)) setTrackerProducts(data.products);
      })
      .catch(() => {/* non-critical — dropdown just won't populate */});
  }, []);

  const todayStr    = toDateString(new Date());
  const tomorrowStr = toDateString(addDays(new Date(), 1));

  const elecRates    = trackerData?.electricity?.rates    || [];
  const elecStanding = trackerData?.electricity?.standing || [];
  const gasRates     = trackerData?.gas?.rates            || [];
  const gasStanding  = trackerData?.gas?.standing         || [];

  const elecToday       = useMemo(() => findRateForDate(elecRates,    todayStr),    [elecRates,    todayStr]);
  const elecStandToday  = useMemo(() => findRateForDate(elecStanding, todayStr),    [elecStanding, todayStr]);
  const gasToday        = useMemo(() => findRateForDate(gasRates,     todayStr),    [gasRates,     todayStr]);
  const gasStandToday   = useMemo(() => findRateForDate(gasStanding,  todayStr),    [gasStanding,  todayStr]);

  const elecTomorrow      = useMemo(() => findRateForDate(elecRates,    tomorrowStr), [elecRates,    tomorrowStr]);
  const elecStandTomorrow = useMemo(() => findRateForDate(elecStanding, tomorrowStr), [elecStanding, tomorrowStr]);
  const gasTomorrow       = useMemo(() => findRateForDate(gasRates,     tomorrowStr), [gasRates,     tomorrowStr]);
  const gasStandTomorrow  = useMemo(() => findRateForDate(gasStanding,  tomorrowStr), [gasStanding,  tomorrowStr]);

  const hasTomorrow = elecTomorrow || gasTomorrow;
  const hasData     = elecRates.length > 0 || gasRates.length > 0;
  const regionInfo  = REGION_INFO[selectedRegion];

  return (
    <main className="max-w-7xl mx-auto p-6 md:p-8">

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="text-center my-12 md:my-16">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
          Live <span className="octopus-text-gradient">Octopus Tracker</span> Price Tracker
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
          Daily electricity and gas unit rates for the Octopus Tracker tariff. Rates are set each day
          and announced ~9–11pm for the following day. Covers both electricity and gas.
        </p>
      </header>

      {/* ── Region selector + GSP info ───────────────── */}
      <div className="octopus-card-bg rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start justify-between gap-6 mb-6">
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-white">
            Select Energy Region
          </label>
          <select
            id="region"
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="mt-1 block w-full md:w-72 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-pink-500 focus:border-pink-500"
          >
            {REGION_LIST.map(r => (
              <option key={r.code} value={r.code}>
                Region {r.code} — {r.name} (GSP: {r.gsp})
              </option>
            ))}
          </select>
        </div>

        {/* GSP info panel */}
        <div className="octopus-gradient-bg border border-white/10 rounded-xl p-4 text-sm min-w-[220px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">Region Info</p>
          <p className="text-white font-semibold">{regionInfo.name}</p>
          <p className="text-gray-300 mt-1">
            GSP Code: <CopyChip value={regionInfo.gsp} className="font-bold" />
          </p>
          <p className="text-gray-400 text-xs mt-1">DNO: {regionInfo.dno}</p>
          {trackerProductCode ? (
            <p className="text-gray-400 text-xs mt-2 space-y-0.5 flex flex-col gap-0.5">
              <CopyChip value={`E-1R-${trackerProductCode}-${selectedRegion}`} />
              <CopyChip value={`G-1R-${trackerProductCode}-${selectedRegion}`} />
            </p>
          ) : (
            <p className="text-gray-400 text-xs mt-2 italic">
              Elec: <span className="font-mono text-gray-400">E-1R-SILVER-…-{selectedRegion}</span>
              {' · '}Gas: <span className="font-mono text-gray-400">G-1R-SILVER-…-{selectedRegion}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── SVT context strip ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 italic">
        <span className="text-teal-400 not-italic font-semibold">SVT Cap Ref ({SVT_CAP.quarter}):</span>
        <span>Elec {SVT_CAP.electricity.unitRate}p/kWh · Standing {SVT_CAP.electricity.standingCharge}p/day</span>
        <span className="text-gray-600">|</span>
        <span>Gas {SVT_CAP.gas.unitRate}p/kWh · Standing {SVT_CAP.gas.standingCharge}p/day</span>
        <span className="text-gray-600 mx-1">·</span>
        <span className="text-gray-400">Rates below cap = savings vs default SVT</span>
      </div>

      {/* ── Tab strip ────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'dashboard',  label: '📊 Dashboard' },
          { id: 'historical', label: '📋 Historical Data' },
          { id: 'compare',    label: '💷 Cost Comparison' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          DASHBOARD TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">

          {loading && <LoadingSpinner message="Fetching Tracker rates…" />}

          {!loading && error && (
            <div className="text-center py-16 octopus-card-bg rounded-2xl">
              <p className="text-4xl mb-3">😢</p>
              <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
              <p className="mt-2 text-gray-300 text-sm">{error}</p>
              <button
                onClick={() => fetchDashboardData(selectedRegion)}
                className="cta-button mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && hasData && (
            <>
              {/* Today's rates */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Today's Rates — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <FuelCard
                    label="⚡ Electricity"
                    colour="rgb(0, 212, 255)"
                    unitRate={elecToday?.value_inc_vat}
                    standingCharge={elecStandToday?.value_inc_vat}
                    svtUnitRate={SVT_CAP.electricity.unitRate}
                  />
                  <FuelCard
                    label="🔥 Gas"
                    colour="rgb(251, 146, 60)"
                    unitRate={gasToday?.value_inc_vat}
                    standingCharge={gasStandToday?.value_inc_vat}
                    svtUnitRate={SVT_CAP.gas.unitRate}
                  />
                </div>
              </div>

              {/* Tomorrow's preview */}
              {hasTomorrow && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Tomorrow's Preview — {addDays(new Date(), 1).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <FuelCard
                      label="⚡ Electricity"
                      colour="rgb(0, 212, 255)"
                      unitRate={elecTomorrow?.value_inc_vat}
                      standingCharge={elecStandTomorrow?.value_inc_vat}
                      svtUnitRate={SVT_CAP.electricity.unitRate}
                      prefix="Tomorrow's "
                    />
                    <FuelCard
                      label="🔥 Gas"
                      colour="rgb(251, 146, 60)"
                      unitRate={gasTomorrow?.value_inc_vat}
                      standingCharge={gasStandTomorrow?.value_inc_vat}
                      svtUnitRate={SVT_CAP.gas.unitRate}
                      prefix="Tomorrow's "
                    />
                  </div>
                </div>
              )}

              {/* 14-day chart */}
              <TrackerChart electricityRates={elecRates} gasRates={gasRates} />

              {/* Carbon intensity */}
              {carbonData && <CarbonChart carbonData={carbonData} showNowLine={true} />}
            </>
          )}

          {!loading && !error && !hasData && (
            <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-400">
              No Tracker rate data available for this region. The Tracker tariff may not be active in your area.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          COST COMPARISON TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'compare' && (
        <TariffCostComparison region={selectedRegion} />
      )}

      {/* ══════════════════════════════════════════════════════
          HISTORICAL DATA TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'historical' && (
        <div className="space-y-4">
          {trackerProducts.length > 1 && (
            <div className="octopus-card-bg rounded-xl p-4 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Tracker product:</label>
              <select
                value={selectedProduct || ''}
                onChange={e => setSelectedProduct(e.target.value || null)}
                className="bg-gray-900/50 border border-gray-600 rounded-md py-1.5 px-3 text-white text-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              >
                {trackerProducts.map(p => (
                  <option key={p.code} value={p.isCurrent ? '' : p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <span className="text-xs text-pink-400 font-mono">{selectedProduct}</span>
              )}
            </div>
          )}
          <TrackerHistoricalData region={selectedRegion} productCode={selectedProduct} />
        </div>
      )}

    </main>
  );
}

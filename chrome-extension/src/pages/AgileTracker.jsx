import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAgileRates, getCarbonIntensity } from '../services/api';
import { REGION_INFO, REGION_LIST } from '../constants/regions';
import { SVT_CAP } from '../constants/svt';
import AgileChart from '../components/AgileChart';
import CarbonChart from '../components/CarbonChart';
import AgileHistoricalData from '../components/AgileHistoricalData';
import TariffCostComparison from '../components/TariffCostComparison';
import GoodTimeWidget from '../components/GoodTimeWidget';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CopyChip from '../components/ui/CopyChip';
import AgileUsagePlanner, { AgileDayBadge } from '../components/AgileUsagePlanner';

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

function stripTime(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return toDateString(a) === toDateString(b);
}

function updateDashboard(importRates) {
  const now = new Date();
  let currentRate = null;
  const futureRates = [];

  if (!importRates || importRates.length === 0) {
    return {
      currentPrice: 'N/A',
      cheapest: { price: '...', time: '...' },
      dearest:  { price: '...', time: '...' },
    };
  }

  importRates.forEach(rate => {
    const validFrom = new Date(rate.valid_from);
    const validTo   = new Date(rate.valid_to);
    if (now >= validFrom && now < validTo) currentRate = rate.value_inc_vat;
    if (validFrom >= now) futureRates.push(rate);
  });

  const currentPrice = currentRate != null ? currentRate.toFixed(2) : 'N/A';
  let cheapest = { price: '—', time: '' };
  let dearest  = { price: '—', time: '' };

  if (futureRates.length > 0) {
    const sorted = [...futureRates].sort((a, b) => a.value_inc_vat - b.value_inc_vat);
    cheapest = {
      price: sorted[0].value_inc_vat.toFixed(2),
      time:  new Date(sorted[0].valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
    dearest = {
      price: sorted[sorted.length - 1].value_inc_vat.toFixed(2),
      time:  new Date(sorted[sorted.length - 1].valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  return { currentPrice, cheapest, dearest };
}

// ─── Date nav bar ─────────────────────────────────────────────────────────────

function DateNavBar({ selectedDate, onSelectDate }) {
  const [showPicker, setShowPicker] = useState(false);
  const today    = useMemo(() => stripTime(new Date()), []);
  const tomorrow = useMemo(() => addDays(today, 1),     [today]);

  const dayButtons = useMemo(() => {
    const btns = [];
    for (let i = 6; i >= 2; i--) {
      const d = addDays(today, -i);
      btns.push({
        date:  d,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      });
    }
    btns.push({ date: addDays(today, -1), label: 'YDA' });
    btns.push({ date: today,              label: 'TDA' });
    btns.push({ date: tomorrow,           label: 'TMW' });
    return btns;
  }, [today, tomorrow]);

  function isActive(date) {
    return selectedDate && isSameDay(selectedDate, date);
  }

  const isRecent = !selectedDate && !showPicker;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => { onSelectDate(null); setShowPicker(false); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            isRecent ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          RECENT
        </button>
        <button
          onClick={() => setShowPicker(p => !p)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            showPicker ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          SPECIFIC DATE
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        {dayButtons.map(({ date, label }) => (
          <button
            key={label}
            onClick={() => { onSelectDate(date); setShowPicker(false); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isActive(date) ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {label}
            {isSameDay(date, today) ? ' ★' : ''}
          </button>
        ))}
      </div>
      {showPicker && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-gray-300 text-xs">Choose date:</label>
          <input
            type="date"
            max={toDateString(tomorrow)}
            defaultValue={selectedDate ? toDateString(selectedDate) : toDateString(today)}
            onChange={(e) => {
              if (e.target.value) {
                const [y, mo, d] = e.target.value.split('-').map(Number);
                onSelectDate(new Date(y, mo - 1, d));
              }
            }}
            className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/20 focus:outline-none focus:border-purple-400"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgileTracker() {
  const [searchParams] = useSearchParams();
  const urlRegion = searchParams.get('region');
  const urlDate = searchParams.get('date');
  const validUrlRegion = urlRegion && REGION_INFO[urlRegion] ? urlRegion : null;
  const validUrlDate = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)
    ? new Date(`${urlDate}T00:00:00`)
    : null;

  const [selectedRegion, setSelectedRegion] = useState(validUrlRegion || 'H');
  const [selectedDate,   setSelectedDate]   = useState(validUrlDate);
  const [activeTab,      setActiveTab]      = useState('dashboard');

  const [importRates,       setImportRates]       = useState([]);
  const [exportRates,       setExportRates]       = useState([]);
  const [agileProductCode,  setAgileProductCode]  = useState(null);
  const [carbonData,        setCarbonData]        = useState(null);
  const [dashboard,         setDashboard]         = useState({
    currentPrice: '…',
    cheapest: { price: '…', time: '' },
    dearest:  { price: '…', time: '' },
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const intervalRef = useRef(null);
  const today       = useMemo(() => stripTime(new Date()), []);

  const showNowLine = useMemo(() => {
    return !selectedDate || isSameDay(selectedDate, today);
  }, [selectedDate, today]);

  const apiDateParam = useMemo(() => {
    if (!selectedDate) return null;
    return toDateString(selectedDate);
  }, [selectedDate]);

  const fetchDashboardData = useCallback(async (region, date) => {
    setLoading(true);
    setError(null);
    try {
      const [agile, carbon] = await Promise.allSettled([
        getAgileRates(region, date),
        getCarbonIntensity(),
      ]);

      if (agile.status === 'fulfilled') {
        const { import: imp = [], export: exp = [], agileProductCode: code } = agile.value;
        setImportRates(imp);
        setExportRates(exp);
        if (code) setAgileProductCode(code);
        setDashboard(updateDashboard(imp));
      } else {
        throw agile.reason;
      }

      if (carbon.status === 'fulfilled') {
        setCarbonData(carbon.value);
      }
    } catch (e) {
      setError(e.message || 'Failed to load Agile rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    fetchDashboardData(selectedRegion, apiDateParam);
    if (!apiDateParam) {
      intervalRef.current = setInterval(
        () => fetchDashboardData(selectedRegion, null),
        15 * 60 * 1000,
      );
    }
    return () => clearInterval(intervalRef.current);
  }, [selectedRegion, apiDateParam, activeTab, fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData(selectedRegion, apiDateParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const hasData = importRates.length > 0;
  const regionInfo = REGION_INFO[selectedRegion];

  return (
    <main className="max-w-7xl mx-auto p-6 md:p-8">

      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="text-center my-12 md:my-16">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
          Live <span className="octopus-text-gradient">Agile Octopus</span> Price Tracker
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
          Half-hourly import and export rates for all UK regions. Select a region to see live data,
          find the cheapest upcoming slots, and review historical pricing.
        </p>
      </header>

      {/* ── Region selector + GSP info ─────────────────── */}
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
          <p className="text-gray-300 text-xs mt-1">DNO: {regionInfo.dno}</p>
          <p className="text-gray-300 text-xs mt-2 italic">
            Tariff:{' '}
            {agileProductCode
              ? <CopyChip value={`E-1R-${agileProductCode}-${selectedRegion}`} />
              : <span className="font-mono text-gray-300">E-1R-AGILE-…-{selectedRegion}</span>}
          </p>
        </div>
      </div>

      {/* ── SVT context strip ──────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 italic">
        <span className="text-teal-400 not-italic font-semibold">SVT Cap Ref ({SVT_CAP.quarter}):</span>
        <span>Electricity {SVT_CAP.electricity.unitRate}p/kWh</span>
        <span className="text-gray-300">·</span>
        <span>Standing {SVT_CAP.electricity.standingCharge}p/day</span>
        <span className="text-gray-300 mx-1">|</span>
        <span className="text-gray-300">Agile rates below this indicate savings vs the default cap</span>
      </div>

      {/* ── Tab strip ──────────────────────────────────────── */}
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
                : 'text-gray-300 hover:text-white hover:bg-white/10'
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
          <div className="octopus-card-bg rounded-2xl p-4">
            <DateNavBar
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setImportRates([]);
                setExportRates([]);
              }}
            />
          </div>

          {loading && <LoadingSpinner message="Fetching rates…" />}

          {!loading && error && (
            <div className="text-center py-16 octopus-card-bg rounded-2xl">
              <p className="text-4xl mb-3">😢</p>
              <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
              <p className="mt-2 text-gray-300 text-sm">{error}</p>
              <button
                onClick={() => fetchDashboardData(selectedRegion, apiDateParam)}
                className="cta-button mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && hasData && (
            <>
              {/* Stat cards — 4 cols including region GSP */}
              {showNowLine && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="octopus-card-bg rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Current Import Price</p>
                    <p className="text-3xl font-bold text-white">
                      {dashboard.currentPrice}
                      <span className="text-lg font-normal text-gray-300 ml-1">p/kWh</span>
                    </p>
                  </div>
                  <div className="octopus-card-bg rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Cheapest Upcoming Slot</p>
                    <p className="text-3xl font-bold text-green-400">
                      {dashboard.cheapest.price}
                      <span className="text-lg font-normal text-gray-300 ml-1">p/kWh</span>
                    </p>
                    <p className="text-sm text-gray-300">{dashboard.cheapest.time}</p>
                  </div>
                  <div className="octopus-card-bg rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Most Expensive Upcoming</p>
                    <p className="text-3xl font-bold text-red-400">
                      {dashboard.dearest.price}
                      <span className="text-lg font-normal text-gray-300 ml-1">p/kWh</span>
                    </p>
                    <p className="text-sm text-gray-300">{dashboard.dearest.time}</p>
                  </div>
                  <div className="octopus-card-bg rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">Region / GSP</p>
                    <p className="text-3xl font-bold text-teal-400 font-mono">{regionInfo.gsp}</p>
                    <p className="text-sm text-gray-300">{regionInfo.name}</p>
                  </div>
                  <AgileDayBadge rates={importRates} />
                </div>
              )}

              {showNowLine && (
                <AgileUsagePlanner
                  rates={importRates}
                  carbonData={carbonData}
                  regionLabel={`${regionInfo.name} (${regionInfo.gsp})`}
                />
              )}

              <AgileChart
                importRates={importRates}
                exportRates={exportRates}
                showNowLine={showNowLine}
              />

              {carbonData && (
                <CarbonChart carbonData={carbonData} showNowLine={showNowLine} />
              )}

              <GoodTimeWidget defaultRegion={selectedRegion} expanded />
            </>
          )}

          {!loading && !error && !hasData && (
            <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-300">
              No data available for the selected date and region.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          HISTORICAL DATA TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'historical' && (
        <AgileHistoricalData region={selectedRegion} />
      )}

      {/* ══════════════════════════════════════════════════════
          COST COMPARISON TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'compare' && (
        <TariffCostComparison region={selectedRegion} />
      )}

    </main>
  );
}

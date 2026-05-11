// TariffCostComparison.jsx
// Estimates what a customer would have spent under Agile, Tracker, Flexible, and Fixed Octopus
// for a given kWh amount over a date range.
// Used as the "Cost Comparison" tab on both AgileTracker and TrackerPriceTracker pages.

import { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  getComparisonRates,
  getHistoricalAgileRates,
  getHistoricalTrackerRates,
} from '../services/api';
import LoadingSpinner from './ui/LoadingSpinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function formatGBP(pounds) {
  if (pounds == null) return '—';
  return `£${pounds.toFixed(2)}`;
}

function defaultDates() {
  const yesterday   = new Date(Date.now() - 86400000);
  const thirtyAgo   = new Date(Date.now() - 30 * 86400000);
  const threeYrsAgo = new Date(Date.now() - 3 * 365 * 86400000);
  return {
    from: toDateString(thirtyAgo),
    to:   toDateString(yesterday),
    max:  toDateString(yesterday),
    min:  toDateString(threeYrsAgo),
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TariffCostComparison({ region }) {
  const { from: defaultFrom, to: defaultTo, max: maxDate, min: minDate } = defaultDates();

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo,   setDateTo]   = useState(defaultTo);
  const [kWh,      setKWh]      = useState('');

  const [compRates,    setCompRates]    = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError,   setRatesError]   = useState(null);

  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // ── Fetch current Flexible / Fixed / Agile-SC rates whenever region changes ──
  const fetchCompRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(null);
    setResults(null);
    try {
      const data = await getComparisonRates(region);
      setCompRates(data);
    } catch (err) {
      setRatesError(err.message || 'Could not load current tariff rates.');
    } finally {
      setRatesLoading(false);
    }
  }, [region]);

  useEffect(() => { fetchCompRates(); }, [fetchCompRates]);

  // ── Calculate ─────────────────────────────────────────────────────────────────
  async function handleCalculate(e) {
    e.preventDefault();

    const kWhNum = parseFloat(kWh);
    if (!kWh || isNaN(kWhNum) || kWhNum <= 0) {
      setError('Please enter a valid kWh amount greater than 0.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Please select both a start and end date.');
      return;
    }
    if (new Date(dateFrom) > new Date(dateTo)) {
      setError('Start date must be before end date.');
      return;
    }
    if (!compRates) {
      setError('Current tariff rate data is not yet loaded. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const [agileRes, trackerRes] = await Promise.allSettled([
        getHistoricalAgileRates(region, dateFrom, dateTo),
        getHistoricalTrackerRates(region, dateFrom, dateTo),
      ]);

      const days = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;

      const tariffs = [];

      // ── Agile ────────────────────────────────────────────────────────────────
      if (agileRes.status === 'fulfilled' && agileRes.value?.import?.length > 0) {
        const avgRate    = mean(agileRes.value.import.map(r => r.value_inc_vat));
        const unitCost   = (kWhNum * avgRate) / 100;
        const standingCost = compRates.agile?.standingCharge != null
          ? (days * compRates.agile.standingCharge) / 100
          : null;
        tariffs.push({
          id: 'agile', label: 'Agile Octopus',
          avgRate, unitCost, standingCost,
          totalCost: unitCost + (standingCost ?? 0),
          colour:   'rgba(0, 212, 255, 0.85)',
          scColour: 'rgba(0, 212, 255, 0.30)',
        });
      }

      // ── Tracker ──────────────────────────────────────────────────────────────
      if (trackerRes.status === 'fulfilled' && trackerRes.value?.electricity?.rates?.length > 0) {
        const avgRate    = mean(trackerRes.value.electricity.rates.map(r => r.value_inc_vat));
        const unitCost   = (kWhNum * avgRate) / 100;
        const trackerSC  = trackerRes.value.electricity.standing?.[0]?.value_inc_vat ?? null;
        const standingCost = trackerSC != null ? (days * trackerSC) / 100 : null;
        tariffs.push({
          id: 'tracker', label: 'Octopus Tracker',
          avgRate, unitCost, standingCost,
          totalCost: unitCost + (standingCost ?? 0),
          colour:   'rgba(251, 146, 60, 0.85)',
          scColour: 'rgba(251, 146, 60, 0.30)',
        });
      }

      // ── Flexible ─────────────────────────────────────────────────────────────
      if (compRates.flexible?.unitRate != null) {
        const unitCost   = (kWhNum * compRates.flexible.unitRate) / 100;
        const standingCost = compRates.flexible.standingCharge != null
          ? (days * compRates.flexible.standingCharge) / 100
          : null;
        tariffs.push({
          id: 'flexible', label: 'Flexible Octopus',
          avgRate: compRates.flexible.unitRate,
          unitCost, standingCost,
          totalCost: unitCost + (standingCost ?? 0),
          colour:   'rgba(0, 166, 156, 0.85)',
          scColour: 'rgba(0, 166, 156, 0.30)',
        });
      }

      // ── Fixed ────────────────────────────────────────────────────────────────
      if (compRates.fixed?.unitRate != null) {
        const unitCost   = (kWhNum * compRates.fixed.unitRate) / 100;
        const standingCost = compRates.fixed.standingCharge != null
          ? (days * compRates.fixed.standingCharge) / 100
          : null;
        tariffs.push({
          id: 'fixed', label: 'Fixed Octopus',
          avgRate: compRates.fixed.unitRate,
          unitCost, standingCost,
          totalCost: unitCost + (standingCost ?? 0),
          colour:   'rgba(139, 92, 246, 0.85)',
          scColour: 'rgba(139, 92, 246, 0.30)',
        });
      }

      if (tariffs.length === 0) {
        setError('Could not retrieve enough rate data to compare tariffs for this date range and region. Try a shorter range or check the region is supported.');
        return;
      }

      // Sort cheapest total cost first
      tariffs.sort((a, b) => a.totalCost - b.totalCost);
      setResults({ tariffs, kWh: kWhNum, days, dateFrom, dateTo });

    } catch (err) {
      setError(err.message || 'Failed to calculate comparison. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Chart config ─────────────────────────────────────────────────────────────
  const chartData = results ? {
    labels: results.tariffs.map(t => t.label),
    datasets: [
      {
        label: 'Unit cost (electricity)',
        data:            results.tariffs.map(t => parseFloat(t.unitCost.toFixed(2))),
        backgroundColor: results.tariffs.map(t => t.colour),
        borderColor:     results.tariffs.map((_, i) => i === 0 ? 'rgba(255,255,255,0.6)' : 'transparent'),
        borderWidth:     results.tariffs.map((_, i) => i === 0 ? 2 : 0),
        borderSkipped:   false,
        stack: 'costs',
      },
      {
        label: 'Standing charges',
        data:            results.tariffs.map(t => t.standingCost != null ? parseFloat(t.standingCost.toFixed(2)) : 0),
        backgroundColor: results.tariffs.map(t => t.scColour),
        borderWidth:     0,
        stack: 'costs',
      },
    ],
  } : null;

  const chartOptions = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels:  { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: £${ctx.parsed.y.toFixed(2)}`,
          footer: (items) => {
            const total = items.reduce((s, i) => s + i.parsed.y, 0);
            return `Total: £${total.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks:   { color: '#9ca3af', font: { size: 11 } },
        grid:    { display: false },
      },
      y: {
        stacked: true,
        ticks:   { color: '#9ca3af', font: { size: 11 }, callback: v => `£${v.toFixed(0)}` },
        grid:    { color: 'rgba(255,255,255,0.05)' },
        title:   { display: true, text: '£ estimated cost', color: '#9ca3af', font: { size: 11 } },
      },
    },
  };

  // ── Medal icons ───────────────────────────────────────────────────────────────
  const medals = ['🥇', '🥈', '🥉'];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Input form ─────────────────────────────────────────────────────────── */}
      <div className="octopus-card-bg rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-1">⚡ Cost Comparison</p>
        <p className="text-gray-300 text-sm mb-5">
          Enter a date range and the customer's total electricity usage to estimate what they would have paid
          under each tariff.
        </p>

        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">From date</label>
              <input
                type="date"
                value={dateFrom}
                min={minDate}
                max={maxDate}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">To date</label>
              <input
                type="date"
                value={dateTo}
                min={minDate}
                max={maxDate}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            {/* kWh */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Total electricity used <span className="text-gray-300">(kWh)</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={kWh}
                onChange={e => setKWh(e.target.value)}
                placeholder="e.g. 350"
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 placeholder-gray-600"
              />
            </div>
          </div>

          {/* Rate status line */}
          {ratesLoading && (
            <p className="text-xs text-gray-300 italic">Loading current tariff rates for Region {region}…</p>
          )}
          {ratesError && (
            <p className="text-xs text-red-400">⚠️ {ratesError} — Flexible and Fixed columns will be unavailable.</p>
          )}
          {!ratesLoading && !ratesError && compRates && (
            <p className="text-xs text-gray-300">
              Current rates for Region {region}:{' '}
              {compRates.flexible?.unitRate != null && (
                <span>Flexible <span className="text-teal-400 font-mono">{compRates.flexible.unitRate.toFixed(2)}p/kWh</span></span>
              )}
              {compRates.fixed?.unitRate != null && (
                <span> · Fixed <span className="text-purple-400 font-mono">{compRates.fixed.unitRate.toFixed(2)}p/kWh</span></span>
              )}
              {compRates.agile?.standingCharge != null && (
                <span> · Agile SC <span className="text-cyan-400 font-mono">{compRates.agile.standingCharge.toFixed(2)}p/day</span></span>
              )}
            </p>
          )}

          {/* Range info note for long periods */}
          {dateFrom && dateTo && (() => {
            const days = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
            if (days > 366) return (
              <p key="range-note" className="text-xs text-gray-300 italic">
                ℹ️ Ranges over a year fetch data across multiple historical product versions — this may take a few extra seconds.
              </p>
            );
            return null;
          })()}

          {/* Validation / API error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || ratesLoading || !kWh.trim()}
            className="cta-button bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg text-sm"
          >
            {loading ? 'Calculating…' : 'Calculate Comparison'}
          </button>
        </form>

        {loading && (
          <div className="mt-5">
            <LoadingSpinner message="Fetching historical rates and calculating…" />
          </div>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────────── */}
      {results && !loading && (
        <>
          {/* Context line */}
          <p className="text-sm text-gray-300">
            Estimated electricity costs for{' '}
            <span className="text-white font-semibold">{results.kWh} kWh</span> over{' '}
            <span className="text-white font-semibold">{results.days} days</span>{' '}
            <span className="text-gray-300">({results.dateFrom} → {results.dateTo})</span>
          </p>

          {/* Stacked bar chart */}
          <div className="octopus-card-bg rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">Cost comparison — sorted cheapest first</p>
            <div style={{ height: 260 }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Results table */}
          <div className="octopus-card-bg rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-4">Breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-300 border-b border-white/10">
                    <th className="text-left pb-2 pr-4 font-medium">Tariff</th>
                    <th className="text-right pb-2 px-4 font-medium">Avg rate</th>
                    <th className="text-right pb-2 px-4 font-medium">Unit cost</th>
                    <th className="text-right pb-2 px-4 font-medium">Standing charges</th>
                    <th className="text-right pb-2 pl-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {results.tariffs.map((t, i) => (
                    <tr
                      key={t.id}
                      className={`border-b border-white/5 ${i === 0 ? 'text-white' : 'text-gray-300'}`}
                    >
                      <td className="py-3 pr-4">
                        <span className="mr-1.5">{medals[i] || ' '}</span>
                        <span className={i === 0 ? 'font-semibold' : ''}>{t.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-gray-300">
                        {t.avgRate.toFixed(2)}p/kWh
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatGBP(t.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-300">
                        {t.standingCost != null ? formatGBP(t.standingCost) : '—'}
                      </td>
                      <td className={`py-3 pl-4 text-right font-mono font-bold ${i === 0 ? 'text-teal-300' : ''}`}>
                        {formatGBP(t.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Savings vs most expensive */}
            {results.tariffs.length > 1 && (() => {
              const cheapest  = results.tariffs[0];
              const dearest   = results.tariffs[results.tariffs.length - 1];
              const saving    = dearest.totalCost - cheapest.totalCost;
              return saving > 0.01 ? (
                <div className="mt-4 p-3 rounded-xl bg-teal-900/25 border border-teal-700/30 text-sm">
                  <span className="text-teal-300 font-semibold">
                    {cheapest.label} saves {formatGBP(saving)} vs {dearest.label}
                  </span>
                  <span className="text-gray-300"> over this period.</span>
                </div>
              ) : null;
            })()}
          </div>

          {/* Caveats */}
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4">
            <p className="text-amber-300 text-sm font-semibold mb-2">⚠️ Important caveats</p>
            <ul className="space-y-1.5 text-gray-300 text-sm">
              <li>
                <strong className="text-white">Historical data coverage:</strong> Agile data is available from November 2022; Tracker data from December 2023. Rates for earlier periods cannot be compared.
              </li>
              <li>
                <strong className="text-white">Agile cost</strong> uses the <em>average</em> half-hourly rate across this period. Actual cost depends on <em>when</em> electricity was used — customers who shift loads to cheap overnight slots pay significantly less than this average implies.
              </li>
              <li>
                <strong className="text-white">Flexible and Fixed</strong> rates are today's current rates. This tool does not track historical rate changes, so past periods use the current rate as a proxy.
              </li>
              <li>
                <strong className="text-white">Standing charges</strong> are electricity standing charges only. Gas standing charges apply separately on dual-fuel tariffs (Tracker, Flexible, Fixed) and are not included here.
              </li>
              <li>
                The kWh figure should be electricity consumption only for a fair comparison across all four tariffs.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

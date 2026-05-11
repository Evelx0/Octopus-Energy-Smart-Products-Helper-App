import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  TimeScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { getHistoricalAgileRates, getHistoricalCarbonIntensity, getSettlementPrices } from '../services/api';

ChartJS.register(CategoryScale, TimeScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ─── helpers ────────────────────────────────────────────────────────────────

function toDateString(date) {
  // Returns 'YYYY-MM-DD' in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDisplay(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeStats(rates) {
  if (!rates || rates.length === 0) return { avg: null, lowest: null, highest: null };
  const sorted = [...rates].sort((a, b) => a.value_inc_vat - b.value_inc_vat);
  const avg = rates.reduce((s, r) => s + r.value_inc_vat, 0) / rates.length;
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  return {
    avg,
    lowest:  { value: low.value_inc_vat,  time: low.valid_from  },
    highest: { value: high.value_inc_vat, time: high.valid_from },
  };
}

function fmtTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function buildCsvBlob(importRates, exportRates) {
  // Create a map keyed by valid_from for easy joining
  const exportMap = {};
  exportRates.forEach(r => { exportMap[r.valid_from] = r.value_inc_vat; });

  const header = 'Period From,Period To,Agile Import (p/kWh),Agile Export (p/kWh)\n';
  const rows = importRates
    .slice()
    .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from))
    .map(r => {
      const from = new Date(r.valid_from).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const to = new Date(r.valid_to).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const exp = exportMap[r.valid_from] != null ? exportMap[r.valid_from].toFixed(4) : '';
      return `"${from}","${to}",${r.value_inc_vat.toFixed(4)},${exp}`;
    })
    .join('\n');
  return new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, colour, stats }) {
  if (!stats || stats.avg === null) {
    return (
      <div className="octopus-card-bg rounded-xl p-4 flex-1 min-w-[200px]">
        <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-gray-300 text-sm">No data</p>
      </div>
    );
  }
  return (
    <div className="octopus-card-bg rounded-xl p-4 flex-1 min-w-[200px]">
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: colour }}>{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-300 text-xs">Average</span>
          <span className="text-white font-semibold">{stats.avg.toFixed(2)}p</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-300 text-xs">Lowest</span>
          <div className="text-right">
            <span className="text-green-400 font-semibold">{stats.lowest.value.toFixed(2)}p</span>
            <p className="text-gray-300 text-xs">{fmtTime(stats.lowest.time)}</p>
          </div>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-300 text-xs">Highest</span>
          <div className="text-right">
            <span className="text-red-400 font-semibold">{stats.highest.value.toFixed(2)}p</span>
            <p className="text-gray-300 text-xs">{fmtTime(stats.highest.time)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Historical chart (Bar, import + export side-by-side) ───────────────────

function HistoricalBarChart({ importRates, exportRates }) {
  const chartData = useMemo(() => {
    const sorted = [...importRates]
      .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
    const exportMap = {};
    exportRates.forEach(r => { exportMap[r.valid_from] = r.value_inc_vat; });

    return {
      datasets: [
        {
          label: 'Agile Import',
          data: sorted.map(r => ({ x: new Date(r.valid_from), y: r.value_inc_vat })),
          backgroundColor: 'rgba(0, 212, 255, 0.6)',
          borderColor: 'rgb(0, 212, 255)',
          borderWidth: 1,
          barPercentage: 0.9,
          categoryPercentage: 0.9,
        },
        {
          label: 'Agile Export',
          data: sorted.map(r => ({ x: new Date(r.valid_from), y: exportMap[r.valid_from] ?? null })),
          backgroundColor: 'rgba(255, 71, 160, 0.5)',
          borderColor: 'rgb(255, 71, 160)',
          borderWidth: 1,
          barPercentage: 0.9,
          categoryPercentage: 0.9,
        },
      ],
    };
  }, [importRates, exportRates]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', displayFormats: { day: 'dd MMM' } },
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: 'rgba(255,255,255,0.7)', maxRotation: 45 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: 'rgba(255,255,255,0.7)' },
        title: { display: true, text: 'Price (p/kWh)', color: 'rgba(255,255,255,0.6)' },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: { color: 'white', usePointStyle: true, pointStyle: 'circle', padding: 16 },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items.length && items[0].raw) {
              return new Date(items[0].raw.x).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              });
            }
            return '';
          },
          label: (ctx) => {
            if (ctx.raw && ctx.raw.y != null) return ` ${ctx.dataset.label}: ${ctx.raw.y.toFixed(2)}p`;
            return '';
          },
        },
      },
    },
  };

  return (
    <div className="h-[420px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// ─── Table view ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

function HistoricalTable({ importRates, exportRates }) {
  const [page, setPage] = useState(0);

  const exportMap = useMemo(() => {
    const m = {};
    exportRates.forEach(r => { m[r.valid_from] = r.value_inc_vat; });
    return m;
  }, [exportRates]);

  const rows = useMemo(() => {
    return [...importRates]
      .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
  }, [importRates]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible    = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-300 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Period From</th>
              <th className="text-left px-4 py-3">Period To</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(0,212,255)' }}>Import (p/kWh)</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(255,71,160)' }}>Export (p/kWh)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const expVal = exportMap[r.valid_from];
              return (
                <tr
                  key={r.valid_from}
                  className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}
                >
                  <td className="px-4 py-2 text-gray-300">
                    {new Date(r.valid_from).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-300">
                    {new Date(r.valid_to).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-cyan-300">
                    {r.value_inc_vat.toFixed(2)}p
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-pink-300">
                    {expVal != null ? `${expVal.toFixed(2)}p` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-300">
          <span>{rows.length} records · page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-lg bg-white/10 disabled:opacity-30 hover:bg-white/20 transition-colors"
            >
              ◀ Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 rounded-lg bg-white/10 disabled:opacity-30 hover:bg-white/20 transition-colors"
            >
              Next ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date stepper control ───────────────────────────────────────────────────

function DateStepper({ label, date, onChange }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-gray-300 text-xs uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(addDays(date, -1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Previous day"
        >
          ◀
        </button>

        {editing ? (
          <input
            type="date"
            defaultValue={toDateString(date)}
            max={toDateString(new Date())}
            autoFocus
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-').map(Number);
                onChange(new Date(y, m - 1, d));
              }
            }}
            onBlur={() => setEditing(false)}
            className="bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-white/20 focus:outline-none focus:border-purple-400"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-mono transition-colors min-w-[110px] text-center"
          >
            {formatDisplay(date)}
          </button>
        )}

        <button
          onClick={() => onChange(addDays(date, 1))}
          disabled={toDateString(addDays(date, 1)) > toDateString(new Date())}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
          title="Next day"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AgileHistoricalData({ region }) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo,   setDateTo]   = useState(today);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [data,     setData]     = useState({ import: [], export: [] });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // F3 — Spike context
  const [showSpikes,  setShowSpikes]  = useState(false);
  const [ciData,      setCiData]      = useState(null);
  const [ciLoading,   setCiLoading]   = useState(false);
  const [ciError,     setCiError]     = useState(null);

  // F5 — Elexon SBP correlation
  const [sbpData,    setSbpData]    = useState(new Map()); // keyed by 'YYYY-MM-DD'
  const [sbpLoading, setSbpLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getHistoricalAgileRates(
        region,
        toDateString(dateFrom),
        toDateString(dateTo),
      );
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load historical data');
    } finally {
      setLoading(false);
    }
  }, [region, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset spike context when dates change
  useEffect(() => {
    setShowSpikes(false);
    setCiData(null);
    setCiError(null);
    setSbpData(new Map());
  }, [dateFrom, dateTo]);

  const fetchCiContext = useCallback(async () => {
    const rangeDays = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24));
    if (rangeDays > 30) {
      setCiError('Carbon intensity overlay is only available for date ranges up to 30 days.');
      return;
    }
    setCiLoading(true);
    setCiError(null);
    try {
      const result = await getHistoricalCarbonIntensity(toDateString(dateFrom), toDateString(dateTo));
      setCiData(result);
    } catch (err) {
      setCiError(err.message || 'Failed to load carbon intensity data.');
    } finally {
      setCiLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Fetch Elexon SBP for all spike dates ≤ yesterday (D+1 latency)
  const fetchSbp = useCallback(async () => {
    const SPIKE_THRESHOLD = 40;
    const spikes = data.import.filter(r => r.value_inc_vat >= SPIKE_THRESHOLD);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);
    const uniqueDates = [...new Set(
      spikes.map(r => toDateString(new Date(r.valid_from)))
    )].filter(d => d <= yesterdayStr);
    if (uniqueDates.length === 0) return;
    setSbpLoading(true);
    try {
      const results = await Promise.allSettled(
        uniqueDates.map(date => getSettlementPrices(date))
      );
      const newMap = new Map();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') newMap.set(uniqueDates[i], r.value);
      });
      setSbpData(newMap);
    } finally {
      setSbpLoading(false);
    }
  }, [data.import]);

  function handleToggleSpikes() {
    if (!showSpikes && !ciData && !ciLoading) {
      fetchCiContext();
    }
    setShowSpikes(s => !s);
  }

  const importStats = useMemo(() => computeStats(data.import), [data.import]);
  const exportStats = useMemo(() => computeStats(data.export), [data.export]);

  function downloadCsv() {
    const blob = buildCsvBlob(data.import, data.export);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `agile-rates-${toDateString(dateFrom)}-to-${toDateString(dateTo)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasData = data.import.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Date range + controls ───────────────────────── */}
      <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-6 justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <DateStepper label="From" date={dateFrom} onChange={(d) => {
              setDateFrom(d);
              if (d > dateTo) setDateTo(d);
            }} />
            <span className="text-gray-300 self-end pb-1">→</span>
            <DateStepper label="To" date={dateTo} onChange={(d) => {
              setDateTo(d);
              if (d < dateFrom) setDateFrom(d);
            }} />
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
              >
                📋 Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-2 text-sm transition-colors ${viewMode === 'chart' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
              >
                📊 Chart
              </button>
            </div>

            {/* CSV download */}
            <button
              onClick={downloadCsv}
              disabled={!hasData}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              ⬇ Download CSV
            </button>

            {/* Spike context toggle */}
            {hasData && (
              <button
                onClick={handleToggleSpikes}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showSpikes
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                }`}
              >
                ⚡ {showSpikes ? 'Hide spike context' : 'Show spike context'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ───────────────────────────── */}
      {hasData && (
        <div className="flex flex-wrap gap-4">
          <StatCard label="Agile Import" colour="rgb(0,212,255)"  stats={importStats} />
          <StatCard label="Agile Export" colour="rgb(255,71,160)" stats={exportStats} />
        </div>
      )}

      {/* ── Loading / error / data ───────────────────────── */}
      {loading && (
        <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-300">
          Loading historical data…
        </div>
      )}

      {!loading && error && (
        <div className="octopus-card-bg rounded-2xl p-6 text-red-400 text-center">
          {error}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-300">
          No data available for the selected date range.
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-300 text-sm">
              {data.import.length} half-hour slots ·{' '}
              {formatDisplay(dateFrom)} — {formatDisplay(dateTo)}
            </p>
          </div>

          {viewMode === 'table' ? (
            <HistoricalTable importRates={data.import} exportRates={data.export} />
          ) : (
            <HistoricalBarChart importRates={data.import} exportRates={data.export} />
          )}
        </div>
      )}

      {/* ── Spike Context Panel (F3) ── */}
      {showSpikes && hasData && (() => {
        const SPIKE_THRESHOLD = 40; // p/kWh

        // Build CI map keyed by UTC half-hour start
        const ciMap = {};
        if (ciData?.data) {
          ciData.data.forEach(slot => {
            const key = new Date(slot.from).toISOString().slice(0, 16);
            ciMap[key] = slot.intensity;
          });
        }

        const spikes = [...data.import]
          .filter(r => r.value_inc_vat >= SPIKE_THRESHOLD)
          .sort((a, b) => b.value_inc_vat - a.value_inc_vat)
          .slice(0, 20);

        function categoriseSpike(rate, ciEntry, from) {
          const dt   = new Date(from);
          const hour = dt.getUTCHours() + (dt.getTimezoneOffset() < 0 ? 1 : 0); // rough UK offset
          const categories = [];
          if (rate >= 80) categories.push('Extreme grid stress');
          if (ciEntry?.actual >= 400) categories.push('Very high carbon generation');
          if (hour >= 16 && hour < 21) categories.push('Evening peak demand window');
          return categories.length ? categories.join(' · ') : 'High market demand';
        }

        function spikeSentence(rate, ciEntry, from, sbpPeriod) {
          const dt = new Date(from);
          const timeStr = dt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          const ci = ciEntry?.actual ?? null;
          const ciText = ci != null ? ` Carbon intensity was ${ci} gCO₂/kWh.` : '';
          const sbpText = sbpPeriod?.sbp != null ? ` System Buy Price: ${Number(sbpPeriod.sbp).toFixed(2)}p/kWh.` : '';
          return `This slot (${timeStr}, ${rate.toFixed(2)}p/kWh)${ciText ? ' —' + ciText : ''}${sbpText} ${categoriseSpike(rate, ciEntry, from)}.`;
        }

        return (
          <div className="octopus-card-bg rounded-2xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-white font-semibold">⚡ Spike Context</h3>
              <div className="flex items-center gap-3">
                {sbpData.size === 0 && !sbpLoading && (
                  <button
                    onClick={fetchSbp}
                    className="px-3 py-1 text-xs bg-blue-700/40 hover:bg-blue-600/50 border border-blue-500/30 text-blue-300 rounded-lg transition-colors"
                  >
                    Load System Buy Prices
                  </button>
                )}
                {sbpLoading && <span className="text-xs text-blue-400">Loading SBP…</span>}
                {sbpData.size > 0 && <span className="text-xs text-blue-400">SBP loaded</span>}
                <p className="text-xs text-gray-300">Slots ≥ {SPIKE_THRESHOLD}p/kWh · top 20 shown</p>
              </div>
            </div>
            {sbpData.size > 0 && (
              <p className="text-xs text-gray-300">Settlement prices published D+1 — today's data not available.</p>
            )}

            {ciLoading && <p className="text-gray-300 text-sm">Loading carbon intensity context…</p>}
            {ciError   && <p className="text-amber-400 text-sm">{ciError}</p>}

            {spikes.length === 0 && (
              <p className="text-gray-300 text-sm">No spikes above {SPIKE_THRESHOLD}p/kWh in this period.</p>
            )}

            {spikes.length > 0 && (
              <div className="space-y-2">
                {spikes.map((r, i) => {
                  const key = new Date(r.valid_from).toISOString().slice(0, 16);
                  const ciEntry = ciMap[key];
                  const spikeDateStr = toDateString(new Date(r.valid_from));
                  const sbpForDate = sbpData.get(spikeDateStr);
                  const spikeTs = new Date(r.valid_from).getTime();
                  const sbpPeriod = sbpForDate?.periods?.find(p => new Date(p.from).getTime() === spikeTs);
                  return (
                    <div key={i} className={`rounded-xl p-3 text-sm ${r.value_inc_vat >= 80 ? 'bg-red-900/30 border border-red-500/30' : 'bg-amber-900/30 border border-amber-500/30'}`}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className={`font-mono font-bold ${r.value_inc_vat >= 80 ? 'text-red-300' : 'text-amber-300'}`}>
                          {r.value_inc_vat.toFixed(2)}p/kWh
                        </p>
                        <p className="text-gray-300 text-xs">{fmtTime(r.valid_from)}</p>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed">{spikeSentence(r.value_inc_vat, ciEntry, r.valid_from, sbpPeriod)}</p>
                      <div className="flex flex-wrap gap-x-4 mt-1">
                        {ciEntry && (
                          <p className="text-gray-300 text-xs">
                            CI: {ciEntry.actual ?? '—'} gCO₂/kWh · {ciEntry.index ?? '—'}
                          </p>
                        )}
                        {sbpPeriod?.sbp != null && (
                          <p className="text-blue-400 text-xs">
                            SBP: {Number(sbpPeriod.sbp).toFixed(2)}p/kWh · SSP: {sbpPeriod.ssp != null ? Number(sbpPeriod.ssp).toFixed(2) + 'p' : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

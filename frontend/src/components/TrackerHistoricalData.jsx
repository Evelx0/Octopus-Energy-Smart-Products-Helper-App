import { useState, useEffect, useMemo, useCallback } from 'react';
import { getHistoricalTrackerRates } from '../services/api';
import TrackerChart from './TrackerChart';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateString(date) {
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
  return {
    avg,
    lowest:  { value: sorted[0].value_inc_vat,                time: sorted[0].valid_from },
    highest: { value: sorted[sorted.length - 1].value_inc_vat, time: sorted[sorted.length - 1].valid_from },
  };
}

function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildCsvBlob(data) {
  const header = 'Date,Elec Unit Rate (p/kWh),Elec Standing Charge (p/day),Gas Unit Rate (p/kWh),Gas Standing Charge (p/day)\n';

  // Build lookup maps keyed by date string (local date)
  const toKey = (isoStr) => new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const elecRateMap    = {};
  const elecStandMap   = {};
  const gasRateMap     = {};
  const gasStandMap    = {};
  (data.electricity?.rates   || []).forEach(r => { elecRateMap[toKey(r.valid_from)]  = r.value_inc_vat; });
  (data.electricity?.standing|| []).forEach(r => { elecStandMap[toKey(r.valid_from)] = r.value_inc_vat; });
  (data.gas?.rates            || []).forEach(r => { gasRateMap[toKey(r.valid_from)]   = r.value_inc_vat; });
  (data.gas?.standing         || []).forEach(r => { gasStandMap[toKey(r.valid_from)]  = r.value_inc_vat; });

  // Collect all unique dates
  const allDates = [...new Set([
    ...(data.electricity?.rates    || []).map(r => toKey(r.valid_from)),
    ...(data.electricity?.standing || []).map(r => toKey(r.valid_from)),
    ...(data.gas?.rates            || []).map(r => toKey(r.valid_from)),
    ...(data.gas?.standing         || []).map(r => toKey(r.valid_from)),
  ])].sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
  });

  const rows = allDates.map(d => {
    const fmt = v => v != null ? v.toFixed(4) : '';
    return `"${d}",${fmt(elecRateMap[d])},${fmt(elecStandMap[d])},${fmt(gasRateMap[d])},${fmt(gasStandMap[d])}`;
  });

  return new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, unit, colour, stats }) {
  if (!stats || stats.avg === null) {
    return (
      <div className="octopus-card-bg rounded-xl p-4 flex-1 min-w-[180px]">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-gray-400 text-sm">No data</p>
      </div>
    );
  }
  return (
    <div className="octopus-card-bg rounded-xl p-4 flex-1 min-w-[180px]">
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: colour }}>{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-xs">Average</span>
          <span className="text-white font-semibold">{stats.avg.toFixed(2)}{unit}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-xs">Lowest</span>
          <div className="text-right">
            <span className="text-green-400 font-semibold">{stats.lowest.value.toFixed(2)}{unit}</span>
            <p className="text-gray-400 text-xs">{fmtDate(stats.lowest.time)}</p>
          </div>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-xs">Highest</span>
          <div className="text-right">
            <span className="text-red-400 font-semibold">{stats.highest.value.toFixed(2)}{unit}</span>
            <p className="text-gray-400 text-xs">{fmtDate(stats.highest.time)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Date stepper ─────────────────────────────────────────────────────────────

function DateStepper({ label, date, onChange }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(addDays(date, -1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
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
        >
          ▶
        </button>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

function HistoricalTable({ data }) {
  const [page, setPage] = useState(0);

  // Build a map: localDateStr → { elecRate, elecStand, gasRate, gasStand }
  const rows = useMemo(() => {
    const map = {};
    const add = (arr, key) =>
      (arr || []).forEach(r => {
        const d = new Date(r.valid_from).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        if (!map[d]) map[d] = { date: d, sortKey: new Date(r.valid_from) };
        map[d][key] = r.value_inc_vat;
      });
    add(data.electricity?.rates,    'elecRate');
    add(data.electricity?.standing, 'elecStand');
    add(data.gas?.rates,            'gasRate');
    add(data.gas?.standing,         'gasStand');
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
  }, [data]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible    = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmt = (v) => v != null ? `${v.toFixed(2)}p` : '—';

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(0,212,255)' }}>Elec Unit</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(0,166,156)' }}>Elec Standing</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(251,146,60)' }}>Gas Unit</th>
              <th className="text-right px-4 py-3" style={{ color: 'rgb(234,179,8)' }}>Gas Standing</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.date}
                className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}
              >
                <td className="px-4 py-2 text-gray-300 font-mono text-xs">{row.date}</td>
                <td className="px-4 py-2 text-right font-mono text-cyan-300">{fmt(row.elecRate)}</td>
                <td className="px-4 py-2 text-right font-mono" style={{ color: 'rgb(0,166,156)' }}>{fmt(row.elecStand)}</td>
                <td className="px-4 py-2 text-right font-mono text-orange-300">{fmt(row.gasRate)}</td>
                <td className="px-4 py-2 text-right font-mono text-yellow-400">{fmt(row.gasStand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
          <span>{rows.length} days · page {page + 1} of {totalPages}</span>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrackerHistoricalData({ region, productCode = null }) {
  const today        = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo,   setDateTo]   = useState(today);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [data,     setData]     = useState({ electricity: { rates: [], standing: [] }, gas: { rates: [], standing: [] } });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchData = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getHistoricalTrackerRates(
        region,
        toDateString(dateFrom),
        toDateString(dateTo),
        productCode,
      );
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load historical Tracker data.');
    } finally {
      setLoading(false);
    }
  }, [region, dateFrom, dateTo, productCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const elecRateStats  = useMemo(() => computeStats(data.electricity?.rates),    [data]);
  const elecStandStats = useMemo(() => computeStats(data.electricity?.standing), [data]);
  const gasRateStats   = useMemo(() => computeStats(data.gas?.rates),            [data]);
  const gasStandStats  = useMemo(() => computeStats(data.gas?.standing),         [data]);

  const hasData = (data.electricity?.rates?.length > 0) || (data.gas?.rates?.length > 0);

  function downloadCsv() {
    const blob = buildCsvBlob(data);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tracker-rates-${toDateString(dateFrom)}-to-${toDateString(dateTo)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Date range + controls */}
      <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-6 justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <DateStepper label="From" date={dateFrom} onChange={(d) => {
              setDateFrom(d);
              if (d > dateTo) setDateTo(d);
            }} />
            <span className="text-gray-400 self-end pb-1">→</span>
            <DateStepper label="To" date={dateTo} onChange={(d) => {
              setDateTo(d);
              if (d < dateFrom) setDateFrom(d);
            }} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                📋 Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-2 text-sm transition-colors ${viewMode === 'chart' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                📊 Chart
              </button>
            </div>
            <button
              onClick={downloadCsv}
              disabled={!hasData}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Elec Unit Rate"      unit="p"  colour="rgb(0,212,255)"   stats={elecRateStats}  />
          <StatCard label="Elec Standing"        unit="p"  colour="rgb(0,166,156)"   stats={elecStandStats} />
          <StatCard label="Gas Unit Rate"        unit="p"  colour="rgb(251,146,60)"  stats={gasRateStats}   />
          <StatCard label="Gas Standing"         unit="p"  colour="rgb(234,179,8)"   stats={gasStandStats}  />
        </div>
      )}

      {/* Loading / error / data */}
      {loading && (
        <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-400">
          Loading historical Tracker data…
        </div>
      )}
      {!loading && error && (
        <div className="octopus-card-bg rounded-2xl p-6 text-red-400 text-center">
          {error}
          <button onClick={fetchData} className="block mx-auto mt-3 underline text-sm">Retry</button>
        </div>
      )}
      {!loading && !error && !hasData && (
        <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-400">
          No data available for the selected date range and region.
        </div>
      )}
      {!loading && !error && hasData && (
        <div className="octopus-card-bg rounded-2xl p-4 md:p-6">
          <p className="text-gray-400 text-sm mb-4">
            {formatDisplay(dateFrom)} — {formatDisplay(dateTo)}
          </p>
          {viewMode === 'table' ? (
            <HistoricalTable data={data} />
          ) : (
            <TrackerChart
              electricityRates={data.electricity?.rates || []}
              gasRates={data.gas?.rates || []}
            />
          )}
        </div>
      )}
    </div>
  );
}

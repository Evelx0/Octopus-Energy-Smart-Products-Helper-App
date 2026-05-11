// "Is Now a Good Time?" widget — Agile timing signal for EV / appliance use.
// Compact mode: region dropdown + current rate + two signal badges.
// Expanded mode: adds a mini-timeline of the next 4–6 half-hour slots.
// Self-contained: manages its own fetch + 30-minute auto-refresh.

import { useState, useEffect, useCallback } from 'react';
import { getAgileRates } from '../services/api';
import { REGION_LIST } from '../constants/regions';
import { SVT_CAP } from '../constants/svt';
import LoadingSpinner from './ui/LoadingSpinner';

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Derive Yes / Wait / No signal from the current rate vs today's average and the SVT cap.
// Priority: No > Yes > Wait (No beats both other conditions).
function getSignal(currentRate, todayRates, svtCap) {
  if (currentRate == null || !todayRates.length) return null;
  const avg        = todayRates.reduce((s, r) => s + r.value_inc_vat, 0) / todayRates.length;
  const pctAboveAvg = ((currentRate - avg) / avg) * 100;
  if (pctAboveAvg > 20 || currentRate >= svtCap) return 'no';
  if (pctAboveAvg < -20 && currentRate < svtCap) return 'yes';
  return 'wait';
}

const SIGNAL_CONFIG = {
  yes:  { label: '✅ Yes — good time',   bg: 'bg-teal-900/50',   text: 'text-teal-300',   border: 'border-teal-500/40' },
  wait: { label: '🟡 Wait — reasonable', bg: 'bg-amber-900/50',  text: 'text-amber-300',  border: 'border-amber-500/40' },
  no:   { label: '🔴 Avoid if possible', bg: 'bg-red-900/50',    text: 'text-red-300',    border: 'border-red-500/40' },
};

function SignalBadge({ signal, label }) {
  const cfg = SIGNAL_CONFIG[signal];
  if (!cfg) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {label || cfg.label}
    </span>
  );
}

export default function GoodTimeWidget({ defaultRegion = 'H', expanded = false }) {
  const [region,  setRegion]  = useState(defaultRegion);
  const [rates,   setRates]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchRates = useCallback(async (rgn) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAgileRates(rgn);
      setRates(data.import || []);
    } catch (err) {
      setError(err.message || 'Could not load Agile rates.');
      setRates(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + whenever region changes
  useEffect(() => {
    fetchRates(region);
  }, [region, fetchRates]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const id = setInterval(() => fetchRates(region), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [region, fetchRates]);

  const now = new Date();
  const svtCap = SVT_CAP.electricity.unitRate;

  const currentRate = rates
    ? (() => {
        const slot = rates.find(r => {
          const from = new Date(r.valid_from);
          const to   = r.valid_to ? new Date(r.valid_to) : new Date(from.getTime() + 30 * 60 * 1000);
          return now >= from && now < to;
        });
        return slot?.value_inc_vat ?? null;
      })()
    : null;

  const todayStr2  = toDateString(now);
  const todayRates = rates ? rates.filter(r => toDateString(new Date(r.valid_from)) === todayStr2) : [];
  const signal     = getSignal(currentRate, todayRates, svtCap);

  // Next 4–6 future slots for the expanded timeline
  const upcomingSlots = rates
    ? rates.filter(r => new Date(r.valid_from) >= now).slice(0, 6)
    : [];

  return (
    <div className="octopus-card-bg rounded-2xl p-5 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">
          ⚡ Is Now a Good Time?
        </p>
        {/* Region selector */}
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="bg-white/5 text-gray-300 text-xs rounded-lg px-2 py-1 border border-white/10 focus:outline-none focus:border-purple-500 cursor-pointer"
          aria-label="Select DNO region"
        >
          {REGION_LIST.map(r => (
            <option key={r.code} value={r.code} className="bg-[#2E2252]">
              {r.code} — {r.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner message="Loading rates…" />}

      {!loading && error && (
        <p className="text-gray-300 text-sm">{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* Current rate + signals */}
          <div className="flex items-end gap-3 mb-4">
            <div>
              <p className="text-4xl font-mono font-bold text-white leading-none">
                {currentRate != null ? currentRate.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-gray-300 mt-1">p/kWh now</p>
            </div>
          </div>

          {/* Signal badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-300">vs Today's Average</p>
              <SignalBadge signal={signal} label={
                signal === 'yes'  ? '✅ Below avg'  :
                signal === 'wait' ? '🟡 Near avg'   :
                signal === 'no'   ? '🔴 Above avg'  : '—'
              } />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-300">vs SVT Cap ({svtCap}p)</p>
              <SignalBadge signal={currentRate != null && currentRate < svtCap ? 'yes' : currentRate != null ? 'no' : null} label={
                currentRate != null
                  ? (currentRate < svtCap ? '✅ Below cap' : '🔴 Above cap')
                  : '—'
              } />
            </div>
          </div>

          {/* Today's average context */}
          {todayRates.length > 0 && (
            <p className="text-xs text-gray-300 mb-3">
              Today's avg: {(todayRates.reduce((s, r) => s + r.value_inc_vat, 0) / todayRates.length).toFixed(2)}p/kWh
              &nbsp;·&nbsp;{todayRates.length} slots
            </p>
          )}

          {/* Expanded: upcoming slot timeline */}
          {expanded && upcomingSlots.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Next Slots
              </p>
              <div className="space-y-2">
                {upcomingSlots.map(slot => {
                  const slotSignal = getSignal(slot.value_inc_vat, todayRates, svtCap);
                  const cfg        = SIGNAL_CONFIG[slotSignal] || {};
                  const time       = new Date(slot.valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={slot.valid_from}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 border ${cfg.bg || 'bg-white/5'} ${cfg.border || 'border-white/10'}`}
                    >
                      <span className="text-xs font-mono text-gray-300">{time}</span>
                      <span className={`text-xs font-mono font-bold ${cfg.text || 'text-gray-300'}`}>
                        {slot.value_inc_vat.toFixed(2)}p
                      </span>
                      <span className={`text-xs font-semibold ${cfg.text || 'text-gray-300'}`}>
                        {slotSignal === 'yes' ? '✅' : slotSignal === 'wait' ? '🟡' : '🔴'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

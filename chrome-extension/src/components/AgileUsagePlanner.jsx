import { useMemo, useState } from 'react';
import CopyButton from './ui/CopyButton';
import {
  bestCarbonBalancedWindow,
  classifyAgileDay,
  findCheapestWindow,
  formatWindow,
} from '../utils/insights';

const DURATIONS = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
];

function copySentence(duration, window, regionLabel) {
  if (!window) return '';
  return `For a ${duration.label} flexible usage window${regionLabel ? ` in ${regionLabel}` : ''}, the cheapest upcoming time is ${formatWindow(window)}.`;
}

export function AgileDayBadge({ rates, compact = false }) {
  const archetype = useMemo(() => classifyAgileDay(rates), [rates]);

  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-bold ${archetype.tone} ${compact ? 'text-sm' : 'text-base'}`}>
            {archetype.label}
          </p>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} text-gray-300 mt-1`}>
            {archetype.text}
          </p>
        </div>
        <span className="text-xs text-gray-300 uppercase tracking-wider shrink-0">Agile day</span>
      </div>
    </div>
  );
}

export default function AgileUsagePlanner({
  rates,
  carbonData = null,
  regionLabel = '',
  compact = false,
  showCarbon = true,
}) {
  const [duration, setDuration] = useState(DURATIONS[1]);

  const cheapest = useMemo(
    () => findCheapestWindow(rates, duration.minutes),
    [rates, duration],
  );

  const carbonSeries = Array.isArray(carbonData?.data) ? carbonData.data : [];
  const carbonPlan = useMemo(
    () => showCarbon ? bestCarbonBalancedWindow(rates, carbonSeries, duration.minutes) : null,
    [rates, carbonSeries, duration, showCarbon],
  );

  const sentence = copySentence(duration, cheapest, regionLabel);

  return (
    <div className={`rounded-2xl bg-white/5 border border-white/10 ${compact ? 'p-3' : 'p-4 md:p-5'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className={`font-semibold text-white ${compact ? 'text-sm' : 'text-base'}`}>Best time planner</p>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} text-gray-300`}>
            Cheapest contiguous Agile window in the next 24h.
          </p>
        </div>
        <CopyButton value={sentence} label="Copy" className="shrink-0" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {DURATIONS.map(item => (
          <button
            key={item.minutes}
            type="button"
            onClick={() => setDuration(item)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              duration.minutes === item.minutes
                ? 'bg-pink-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {cheapest ? (
        <div className="space-y-2">
          <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-teal-300`}>
            {formatWindow(cheapest)}
          </p>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-gray-300`}>
            Range: {cheapest.min.toFixed(1)}p to {cheapest.max.toFixed(1)}p/kWh across the block.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-300">Waiting for enough upcoming Agile slots.</p>
      )}

      {showCarbon && carbonPlan?.greenest && (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-xl bg-[#150E38]/70 p-3">
            <p className="text-[11px] text-gray-300 uppercase tracking-wider">Cheapest</p>
            <p className="text-xs text-white mt-1">{formatWindow(carbonPlan.cheapest)}</p>
          </div>
          <div className="rounded-xl bg-[#150E38]/70 p-3">
            <p className="text-[11px] text-gray-300 uppercase tracking-wider">Greenest</p>
            <p className="text-xs text-white mt-1">
              {formatWindow(carbonPlan.greenest)} · {Math.round(carbonPlan.greenest.carbon)}g CO2/kWh
            </p>
          </div>
          <div className="rounded-xl bg-[#150E38]/70 p-3">
            <p className="text-[11px] text-gray-300 uppercase tracking-wider">Balanced</p>
            <p className="text-xs text-white mt-1">
              {formatWindow(carbonPlan.balanced)} · {Math.round(carbonPlan.balanced.carbon || 0)}g CO2/kWh
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  CI_COLOR,
  CI_LABEL,
  FUEL_COLOR,
  FUEL_LABEL,
  currentSlot,
  formatAge,
  openOptionsPage,
  toDateString,
} from '../utils.js';
import StatusCard from '../components/StatusCard.jsx';
import { REGION_LIST } from '../../src/constants/regions.js';
import AgileUsagePlanner, { AgileDayBadge } from '../../src/components/AgileUsagePlanner.jsx';

function formatRate(value, digits = 1) {
  return value === null || value === undefined ? 'n/a' : `${value.toFixed(digits)}p/kWh`;
}

function minMaxAvg(rates) {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  const values = rates.map(r => r.value_inc_vat);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function MorningBriefing({ agile, ci, alerts, announcements }) {
  const now = new Date();
  const [open, setOpen] = useState(() => now.getHours() >= 7 && now.getHours() < 10);
  const today = toDateString(now);
  const rates = Array.isArray(agile?.import) ? agile.import : [];
  const todayRates = rates.filter(r => toDateString(new Date(r.valid_from)) === today);
  const overnight = todayRates.filter(r => new Date(r.valid_from).getHours() < 7);
  const overnightStats = minMaxAvg(overnight);
  const cheapest = todayRates.length
    ? [...todayRates].sort((a, b) => a.value_inc_vat - b.value_inc_vat)[0]
    : null;
  const redAlerts = Array.isArray(alerts) ? alerts.filter(a => a.tier === 'red') : [];
  const activeAnnouncements = Array.isArray(announcements) ? announcements : [];

  if (!agile && !ci && redAlerts.length === 0 && activeAnnouncements.length === 0) return null;

  return (
    <div className="bg-[#2E2252] rounded-xl px-3 py-3">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="text-[11px] text-gray-300 uppercase tracking-wider">Morning Briefing</span>
        <span className="text-[10px] text-gray-300">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-xs text-gray-300 leading-snug">
          <p>Overnight Agile: {overnightStats ? `${formatRate(overnightStats.min)} min, ${formatRate(overnightStats.max)} max, ${formatRate(overnightStats.avg)} avg` : 'not available yet'}</p>
          <p>Cheapest today: {cheapest ? `${formatRate(cheapest.value_inc_vat)} at ${new Date(cheapest.valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'not published yet'}</p>
          <p>Carbon: {ci?.forecast ?? ci?.actual ?? 'n/a'} gCO2/kWh{ci?.index ? `, ${ci.index}` : ''}</p>
          <p>Alerts: {redAlerts.length ? redAlerts.map(a => a.message).join(' | ') : 'no active red alerts'}</p>
          {activeAnnouncements.length > 0 && (
            <p>Announcements: {activeAnnouncements.map(a => a.text).join(' | ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage({ agile, ci, gridMix, alerts, announcements, region, onRegionChange, loading, lastUpdatedAt }) {
  const currentRate = currentSlot(agile?.import);

  const ratePence = currentRate?.value_inc_vat ?? null;
  const rateColor = ratePence === null ? 'text-gray-300'
    : ratePence < 10  ? 'text-teal-400'
    : ratePence <= 25 ? 'text-yellow-400'
    : 'text-red-400';

  const todayRates = Array.isArray(agile?.import)
    ? agile.import.filter(r => toDateString(new Date(r.valid_from)) === toDateString(new Date()))
    : [];
  const todayAvg = todayRates.length
    ? todayRates.reduce((s, r) => s + r.value_inc_vat, 0) / todayRates.length
    : null;
  const vsAvg = (ratePence !== null && todayAvg !== null)
    ? Math.round((ratePence - todayAvg) / todayAvg * 100)
    : null;

  const ciIndex = ci?.index?.toLowerCase() ?? null;
  const ciLabel = ciIndex ? (CI_LABEL[ciIndex] ?? ciIndex) : null;
  const updatedLabel = formatAge(lastUpdatedAt);
  const activeRegion = REGION_LIST.find(r => r.code === region);

  // Grid mix: sort descending, exclude near-zero entries
  const mix = Array.isArray(gridMix)
    ? [...gridMix].sort((a, b) => b.perc - a.perc).filter(f => f.perc >= 0.5)
    : [];

  return (
    <StatusCard loading={loading} loadingText="Loading dashboard...">
      <div className="flex flex-col gap-4">

      {/* Title */}
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest text-center">
        Smart Prod Specialist App
      </p>

      <label className="block">
        <span className="block text-[10px] text-gray-300 uppercase tracking-wider mb-1">
          Agile region
        </span>
        <select
          value={region}
          onChange={e => onRegionChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-[#2E2252] border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
        >
          {REGION_LIST.map(r => (
            <option key={r.code} value={r.code}>
              {r.gsp} · {r.name}
            </option>
          ))}
        </select>
        {activeRegion && (
          <span className="block text-[10px] text-gray-300 mt-1">
            Showing {activeRegion.gsp} · Region {activeRegion.code}
          </span>
        )}
      </label>

      {/* Compact stat row */}
      <div className="flex gap-2">
        {/* Agile */}
        <div className="basis-[44%] bg-[#2E2252] rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-1">⚡ Agile</p>
          <div className="min-w-0">
            <p className={`text-lg font-bold leading-tight ${rateColor}`}>
              {ratePence !== null ? `${ratePence.toFixed(1)}p` : '—'}
            </p>
            {updatedLabel && (
              <p className="text-[11px] text-gray-300 leading-tight">{updatedLabel}</p>
            )}
            {vsAvg !== null && (
              <p className={`text-[10px] leading-tight ${vsAvg > 0 ? 'text-red-400' : 'text-teal-400'}`}>
                {vsAvg > 0 ? `▲ ${vsAvg}% vs avg` : `▼ ${Math.abs(vsAvg)}% vs avg`}
              </p>
            )}
          </div>
        </div>
        {/* Carbon */}
        <div className="basis-[56%] bg-[#2E2252] rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-1 whitespace-nowrap">🌿 Carbon Intensity</p>
          <div className="min-w-0">
            <p className={`text-lg font-bold leading-tight ${CI_COLOR[ciIndex] ?? 'text-gray-300'}`}>
              {ci?.actual ?? ci?.forecast ?? '—'}
            </p>
            <p className="text-[11px] text-gray-300 leading-tight truncate">
              {ciLabel ? `${ciLabel} · gCO₂/kWh` : 'gCO₂/kWh'}
            </p>
          </div>
        </div>
      </div>

      <MorningBriefing agile={agile} ci={ci} alerts={alerts} announcements={announcements} />

      <AgileDayBadge rates={todayRates} compact />

      <AgileUsagePlanner
        rates={Array.isArray(agile?.import) ? agile.import : []}
        regionLabel={activeRegion ? `${activeRegion.name} (${activeRegion.gsp})` : ''}
        compact
        showCarbon={false}
      />

      {/* Live grid mix */}
      {mix.length > 0 && (
        <div className="bg-[#2E2252] rounded-xl px-3 py-3 flex flex-col gap-2">
          <p className="text-[11px] text-gray-300 uppercase tracking-wider">Live UK Grid Mix</p>

          {/* Stacked bar */}
          <div className="flex rounded overflow-hidden h-2.5 w-full">
            {mix.map(f => (
              <div
                key={f.fuel}
                title={`${FUEL_LABEL[f.fuel] ?? f.fuel}: ${f.perc.toFixed(1)}%`}
                style={{ width: `${f.perc}%`, backgroundColor: FUEL_COLOR[f.fuel] ?? '#9CA3AF' }}
              />
            ))}
          </div>

          {/* Legend — all fuels ≥ 0.5%, wrapping pills */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {mix.map(f => (
              <span key={f.fuel} className="flex items-center gap-1 text-[11px] text-gray-300">
                <span
                  className="w-2 h-2 rounded-sm shrink-0 inline-block"
                  style={{ backgroundColor: FUEL_COLOR[f.fuel] ?? '#9CA3AF' }}
                />
                {FUEL_LABEL[f.fuel] ?? f.fuel} {f.perc.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open full app */}
      <button
        type="button"
        onClick={() => openOptionsPage()}
        className="w-full text-center text-xs text-pink-400 hover:text-pink-300 transition-colors py-1"
      >
        Open Full App →
      </button>
      </div>
    </StatusCard>
  );
}

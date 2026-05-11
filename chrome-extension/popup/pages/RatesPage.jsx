import { useState, useEffect, useRef } from 'react';
import { getAgileRates, getTrackerRates, getComparisonRates } from '../../src/services/api.js';
import { getPinnedRegions, getPreferredRegion, savePinnedRegions } from '../../src/services/storage.js';
import { REGION_LIST } from '../../src/constants/regions.js';
import { currentSlot, openOptionsPage, rateColor, toDateString } from '../utils.js';
import StatusCard from '../components/StatusCard.jsx';

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function findRateForDate(rates, dateStr) {
  if (!rates?.length) return null;
  return rates.find(r => toDateString(new Date(r.valid_from)) === dateStr) || null;
}

function minMax(rates) {
  if (!Array.isArray(rates) || !rates.length) return null;
  const values = rates.map(r => r.value_inc_vat);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export default function RatesPage() {
  const [region,        setRegion]        = useState('H');
  const [pinnedRegions, setPinnedRegions] = useState([]);
  const [pinnedData,    setPinnedData]    = useState({});
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [agileToday,    setAgileToday]    = useState(null);
  const [tracker,       setTracker]       = useState(null);
  const [comparison,    setComparison]    = useState(null);
  const [ratesLoading,  setRatesLoading]  = useState(false);
  const [agileError,    setAgileError]    = useState(null);
  const [trackerError,  setTrackerError]  = useState(null);
  const fetchedFor = useRef(null);

  useEffect(() => {
    getPreferredRegion().then(r => {
      setRegion(r);
      fetchData(r);
    });
    getPinnedRegions().then(regions => {
      setPinnedRegions(regions);
      fetchPinnedRegions(regions);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData(r) {
    if (fetchedFor.current === r) return;
    fetchedFor.current = r;
    setRatesLoading(true);
    setAgileError(null);
    setTrackerError(null);

    const [agileRes, trackerRes, compRes] = await Promise.allSettled([
      getAgileRates(r),
      getTrackerRates(r),
      getComparisonRates(r),
    ]);

    if (agileRes.status === 'fulfilled') setAgileToday(agileRes.value);
    else setAgileError('Agile rates unavailable.');

    if (trackerRes.status === 'fulfilled') setTracker(trackerRes.value);
    else setTrackerError('Tracker rates unavailable.');

    if (compRes.status === 'fulfilled') setComparison(compRes.value);

    setRatesLoading(false);
  }

  function handleRegionChange(e) {
    const r = e.target.value;
    setRegion(r);
    setAgileToday(null);
    setTracker(null);
    setComparison(null);
    fetchedFor.current = null;
    fetchData(r);
  }

  async function fetchPinnedRegions(regions) {
    if (!regions.length) {
      setPinnedData({});
      return;
    }
    setPinnedLoading(true);
    const entries = await Promise.allSettled(regions.map(async r => [r, await getAgileRates(r)]));
    const next = {};
    entries.forEach((entry, index) => {
      const code = regions[index];
      if (entry.status === 'fulfilled') next[entry.value[0]] = { agile: entry.value[1], error: null };
      else next[code] = { agile: null, error: 'Unavailable' };
    });
    setPinnedData(next);
    setPinnedLoading(false);
  }

  async function togglePinnedRegion(code) {
    const next = pinnedRegions.includes(code)
      ? pinnedRegions.filter(r => r !== code)
      : [...pinnedRegions, code].slice(0, 3);
    setPinnedRegions(next);
    await savePinnedRegions(next);
    fetchPinnedRegions(next);
  }

  const todayStr    = toDateString(new Date());
  const tomorrowStr = toDateString(addDays(new Date(), 1));

  const nowRate       = currentSlot(agileToday?.import);
  const todaySlots    = Array.isArray(agileToday?.import) ? agileToday.import.filter(r => toDateString(new Date(r.valid_from)) === todayStr) : [];
  const tomorrowSlots = Array.isArray(agileToday?.import) ? agileToday.import.filter(r => toDateString(new Date(r.valid_from)) === tomorrowStr) : [];
  const todayMM       = minMax(todaySlots);
  const tomorrowMM    = tomorrowSlots.length ? minMax(tomorrowSlots) : null;

  const elecToday    = findRateForDate(tracker?.electricity?.rates, todayStr);
  const elecTomorrow = findRateForDate(tracker?.electricity?.rates, tomorrowStr);
  const gasToday     = findRateForDate(tracker?.gas?.rates, todayStr);
  const gasTomorrow  = findRateForDate(tracker?.gas?.rates, tomorrowStr);

  const elecStanding = findRateForDate(tracker?.electricity?.standing, todayStr);
  const gasStanding  = findRateForDate(tracker?.gas?.standing, todayStr);
  const canPin = pinnedRegions.includes(region) || pinnedRegions.length < 3;

  return (
    <div className="flex flex-col gap-3">
      {/* Region selector */}
      <div className="flex gap-2">
        <select
          value={region}
          onChange={handleRegionChange}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#2E2252] border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500"
        >
          {REGION_LIST.map(r => (
            <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canPin}
          onClick={() => togglePinnedRegion(region)}
          className="px-3 py-2 rounded-xl bg-[#2E2252] hover:bg-purple-900 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-xs text-gray-200 transition-colors"
        >
          {pinnedRegions.includes(region) ? 'Unpin' : 'Pin'}
        </button>
      </div>

      {pinnedRegions.length > 0 && (
        <StatusCard loading={pinnedLoading} loadingText="Loading pinned regions...">
          <div className="grid grid-cols-3 gap-2">
            {pinnedRegions.map(code => {
              const data = pinnedData[code];
              const slot = currentSlot(data?.agile?.import);
              const regionInfo = REGION_LIST.find(r => r.code === code);
              return (
                <div key={code} className="bg-[#2E2252] rounded-xl p-2 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white">{code}</p>
                      <p className="text-[9px] text-gray-300 truncate">{regionInfo?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePinnedRegion(code)}
                      className="text-[10px] text-gray-300 hover:text-pink-300"
                    >
                      x
                    </button>
                  </div>
                  {data?.error ? (
                    <p className="text-[10px] text-red-400 mt-2">{data.error}</p>
                  ) : (
                    <>
                      <p className={`text-base font-black mt-1 ${rateColor(slot?.value_inc_vat ?? null)}`}>
                        {slot ? `${slot.value_inc_vat.toFixed(1)}p` : '--'}
                      </p>
                      <p className="text-[10px] text-gray-300">Agile now</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </StatusCard>
      )}

      <StatusCard loading={ratesLoading} loadingText="Loading rates...">
        <>
          {/* ── Agile section ── */}
          <div className="bg-[#2E2252] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-300">Agile Octopus</p>
              <button
                type="button"
                onClick={() => openOptionsPage('/agile-tracker')}
                className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
              >
                Full details →
              </button>
            </div>

            {agileError ? (
              <p className="text-xs text-red-400">{agileError}</p>
            ) : (
              <>
                <div className="flex gap-2">
                  {/* Now */}
                  <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-2">
                    <p className="text-[11px] text-gray-300 mb-0.5">Now</p>
                    <p className={`text-xl font-black ${rateColor(nowRate?.value_inc_vat ?? null)}`}>
                      {nowRate ? `${nowRate.value_inc_vat.toFixed(1)}p` : '—'}
                    </p>
                  </div>
                  {/* Today min/max */}
                  <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-2">
                    <p className="text-[11px] text-gray-300 mb-0.5">Today</p>
                    {todayMM ? (
                      <>
                        <p className="text-xs leading-tight">
                          <span className="text-teal-400 font-semibold">{todayMM.min.toFixed(1)}p</span>
                          <span className="text-gray-300"> – </span>
                          <span className="text-red-400 font-semibold">{todayMM.max.toFixed(1)}p</span>
                        </p>
                        <p className="text-[10px] text-gray-300">min – max</p>
                      </>
                    ) : <p className="text-xs text-gray-300">—</p>}
                  </div>
                </div>
                {/* Tomorrow */}
                <div className="bg-[#150E38] rounded-lg px-2 py-2 flex items-center justify-between">
                  <p className="text-[11px] text-gray-300">Tomorrow</p>
                  {tomorrowMM ? (
                    <p className="text-xs">
                      <span className="text-teal-400 font-semibold">{tomorrowMM.min.toFixed(1)}p</span>
                      <span className="text-gray-300"> – </span>
                      <span className="text-red-400 font-semibold">{tomorrowMM.max.toFixed(1)}p</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-300">Not yet published (~4pm)</p>
                  )}
                </div>
                {comparison?.agile?.standingCharge != null && (
                  <p className="text-[11px] text-gray-300">SC: {comparison.agile.standingCharge.toFixed(2)}p/day</p>
                )}
              </>
            )}
          </div>

          {/* ── Tracker section ── */}
          <div className="bg-[#2E2252] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Octopus Tracker</p>
              <button
                type="button"
                onClick={() => openOptionsPage('/tracker-prices')}
                className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
              >
                Full details →
              </button>
            </div>

            {trackerError ? (
              <p className="text-xs text-red-400">{trackerError}</p>
            ) : (
              <table className="w-full text-xs border-separate" style={{ borderSpacing: '0 2px' }}>
                <thead>
                  <tr>
                    <th className="text-left text-[11px] text-gray-300 font-normal pb-1"></th>
                    <th className="text-right text-[11px] text-gray-300 font-normal pb-1">Today</th>
                    <th className="text-right text-[11px] text-gray-300 font-normal pb-1 pl-3">Tomorrow</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[#150E38]">
                    <td className="text-gray-300 px-2 py-1.5 rounded-l-lg">⚡ Elec</td>
                    <td className="text-right text-gray-200 font-semibold px-2 py-1.5">
                      {elecToday ? `${elecToday.value_inc_vat.toFixed(2)}p` : '—'}
                    </td>
                    <td className="text-right px-2 py-1.5 rounded-r-lg pl-3">
                      {elecTomorrow
                        ? <span className="text-gray-200 font-semibold">{elecTomorrow.value_inc_vat.toFixed(2)}p</span>
                        : <span className="text-gray-300 text-[11px]">Not published</span>}
                    </td>
                  </tr>
                  <tr className="bg-[#150E38]">
                    <td className="text-gray-300 px-2 py-1.5 rounded-l-lg">🔥 Gas</td>
                    <td className="text-right text-gray-200 font-semibold px-2 py-1.5">
                      {gasToday ? `${gasToday.value_inc_vat.toFixed(2)}p` : '—'}
                    </td>
                    <td className="text-right px-2 py-1.5 rounded-r-lg pl-3">
                      {gasTomorrow
                        ? <span className="text-gray-200 font-semibold">{gasTomorrow.value_inc_vat.toFixed(2)}p</span>
                        : <span className="text-gray-300 text-[11px]">Not published</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            {(elecStanding || gasStanding) && (
              <div className="flex gap-3 text-[11px] text-gray-300 mt-1">
                {elecStanding && <span>⚡ SC: {elecStanding.value_inc_vat.toFixed(2)}p/day</span>}
                {gasStanding  && <span>🔥 SC: {gasStanding.value_inc_vat.toFixed(2)}p/day</span>}
              </div>
            )}
          </div>
        </>
      </StatusCard>
    </div>
  );
}

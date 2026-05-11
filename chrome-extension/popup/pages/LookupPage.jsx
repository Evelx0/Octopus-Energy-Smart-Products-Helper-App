import { useState, useEffect } from 'react';
import { getRates, getNearbyChargers, getAgileRates, getTrackerRates, getWeatherForPostcode, getComparisonRates, getHistoricalAgileRates, getHistoricalTrackerRates } from '../../src/services/api.js';
import { REGION_INFO } from '../../src/constants/regions.js';
import { trackSessionEvent } from '../../src/services/storage.js';
import { billingVerdict, currentSlot, openOptionsPage, rateColor, toDateString } from '../utils.js';
import StatusCard from '../components/StatusCard.jsx';
import IogEligibilityCard from '../components/IogEligibilityCard.jsx';

function extractRegion(gsp) {
  if (!gsp) return null;
  const letter = gsp.replace(/^_/, '').toUpperCase();
  return REGION_INFO[letter] ? letter : null;
}

function findRateForDate(rates, dateStr) {
  if (!rates?.length) return null;
  return rates.find(r => toDateString(new Date(r.valid_from)) === dateStr) || null;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function subtractDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

function avgRate(rates) {
  if (!rates?.length) return null;
  return rates.reduce((s, r) => s + r.value_inc_vat, 0) / rates.length;
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function avgOf(arr) {
  if (!arr?.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function minMax(rates) {
  if (!Array.isArray(rates) || !rates.length) return null;
  const values = rates.map(r => r.value_inc_vat);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function solarTier(avgHours) {
  if (avgHours >= 5) return {
    icon: '☀️', color: 'text-amber-300', label: 'Good solar potential',
    tip: 'Strong case for Outgoing Octopus — above-average sunshine for this area.',
  };
  if (avgHours >= 3) return {
    icon: '⛅', color: 'text-yellow-400', label: 'Moderate solar potential',
    tip: 'Worth discussing Outgoing Octopus if the system is ≥3kW.',
  };
  return {
    icon: '🌥️', color: 'text-gray-300', label: 'Lower solar period',
    tip: 'Lower sunshine over the last 30 days — factor in seasonal variation.',
  };
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SectionDivider({ label }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">{label}</p>
    </div>
  );
}

function Spinner({ text }) {
  return <StatusCard loading loadingText={text} />;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function LookupPage() {
  const [postcode,        setPostcode]        = useState('');
  const [pcLoading,       setPcLoading]       = useState(false);
  const [pcError,         setPcError]         = useState(null);
  const [pcResult,        setPcResult]        = useState(null);

  const [agile,           setAgile]           = useState(null);
  const [agileLoading,    setAgileLoading]    = useState(false);
  const [agileError,      setAgileError]      = useState(null);

  const [chargers,        setChargers]        = useState(null);
  const [chargerLoading,  setChargerLoading]  = useState(false);
  const [chargerError,    setChargerError]    = useState(null);

  const [tracker,         setTracker]         = useState(null);
  const [trackerLoading,  setTrackerLoading]  = useState(false);
  const [trackerError,    setTrackerError]    = useState(null);

  const [weather,         setWeather]         = useState(null);
  const [weatherLoading,  setWeatherLoading]  = useState(false);
  const [weatherError,    setWeatherError]    = useState(null);

  const [comparison,      setComparison]      = useState(null);

  // Billing Investigator state
  const [invOpen,        setInvOpen]        = useState(false);
  const [invTariff,      setInvTariff]      = useState(null);
  const [invDate,        setInvDate]        = useState('');
  const [invDateTo,      setInvDateTo]      = useState('');
  const [invContextDays, setInvContextDays] = useState(7);
  const [invData,        setInvData]        = useState(null);
  const [invContext,     setInvContext]      = useState(null);
  const [invLoading,     setInvLoading]     = useState(false);
  const [invError,       setInvError]       = useState(null);
  const [invCopied,      setInvCopied]      = useState(false);

  // Check session storage on mount — set by the context menu service worker handler
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
    chrome.storage.session.get(['contextMenuPostcode'], result => {
      const pc = result.contextMenuPostcode;
      if (!pc) return;
      chrome.storage.session.remove(['contextMenuPostcode']);
      setPostcode(pc);
      doLookup(pc);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

  async function doLookup(trimmed) {
    if (!UK_POSTCODE_RE.test(trimmed)) {
      setPcError('That doesn\'t look like a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setPcLoading(true);
    setPcError(null);
    setPcResult(null);
    setAgile(null);       setAgileError(null);
    setChargers(null);    setChargerError(null);
    setTracker(null);     setTrackerError(null);
    setWeather(null);     setWeatherError(null);
    setComparison(null);
    setInvOpen(false);    setInvTariff(null);     setInvDate('');
    setInvDateTo('');     setInvData(null);        setInvContext(null);  setInvError(null); setInvCopied(false);

    try {
      const data   = await getRates(trimmed);
      const letter = extractRegion(data.gsp);
      if (!letter) throw new Error('Region not found for this postcode.');

      const result = { letter, info: REGION_INFO[letter], gsp: data.gsp, postcode: trimmed };
      setPcResult(result);
      trackSessionEvent('lookup', { region: letter });

      // Fire all four enrichment fetches in parallel, non-blocking
      setAgileLoading(true);
      getAgileRates(letter)
        .then(data => setAgile(data))
        .catch(() => setAgileError('Agile rates unavailable.'))
        .finally(() => setAgileLoading(false));

      // Comparison rates (standing charges) — silent, enhancement only
      getComparisonRates(letter)
        .then(d => setComparison(d))
        .catch(() => {});

      setChargerLoading(true);
      getNearbyChargers(trimmed)
        .then(d => setChargers(d))
        .catch(() => setChargerError('Charger data unavailable.'))
        .finally(() => setChargerLoading(false));

      setTrackerLoading(true);
      getTrackerRates(letter)
        .then(d => setTracker(d))
        .catch(() => setTrackerError('Tracker rates unavailable.'))
        .finally(() => setTrackerLoading(false));

      setWeatherLoading(true);
      getWeatherForPostcode(trimmed)
        .then(d => setWeather(d))
        .catch(() => setWeatherError('Solar data unavailable.'))
        .finally(() => setWeatherLoading(false));

    } catch (err) {
      setPcError(
        err.message?.toLowerCase().includes('not found') || err.message?.includes('404')
          ? 'Postcode not found.'
          : 'Lookup failed. Check postcode and try again.'
      );
    } finally {
      setPcLoading(false);
    }
  }

  function handleLookup(e) {
    e.preventDefault();
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) return;
    if (!UK_POSTCODE_RE.test(trimmed)) {
      setPcError('Please enter a valid UK postcode (e.g. SW1A 1AA or EC1A 1BB).');
      return;
    }
    doLookup(trimmed);
  }

  // Derived agile values
  const todayStr    = toDateString(new Date());
  const tomorrowStr = toDateString(addDays(new Date(), 1));
  const nowSlot     = currentSlot(agile?.import);
  const todayRates  = Array.isArray(agile?.import) ? agile.import.filter(r => toDateString(new Date(r.valid_from)) === todayStr) : [];
  const tomRates    = Array.isArray(agile?.import) ? agile.import.filter(r => toDateString(new Date(r.valid_from)) === tomorrowStr) : [];
  const todayMM     = minMax(todayRates);
  const tomorrowMM  = tomRates.length ? minMax(tomRates) : null;

  // Derived tracker values
  const elecToday = findRateForDate(tracker?.electricity?.rates, todayStr);
  const gasToday  = findRateForDate(tracker?.gas?.rates, todayStr);

  // Derived standing charges
  const elecStanding = findRateForDate(tracker?.electricity?.standing, todayStr);
  const gasStanding  = findRateForDate(tracker?.gas?.standing, todayStr);

  // Derived solar values
  const avgSun  = avgOf(weather?.weather?.sunshineHours);
  const tier    = avgSun !== null ? solarTier(avgSun) : null;

  // Billing Investigator — fetch handler
  async function handleInvestigate(e) {
    e.preventDefault();
    if (!invTariff || !invDate) return;
    if (invTariff === 'tracker' && !invDateTo) return;
    if (invTariff === 'tracker') {
      const diff = (new Date(invDateTo) - new Date(invDate)) / 86400000;
      if (diff > 31) { setInvError('Date range must be 31 days or less.'); return; }
      if (diff < 0)  { setInvError('End date must be after start date.'); return; }
    }
    setInvLoading(true); setInvError(null); setInvData(null); setInvContext(null); setInvCopied(false);
    const contextFrom = toDateString(subtractDays(new Date(invDate), invContextDays));
    const contextTo   = toDateString(subtractDays(new Date(invDate), 1));
    try {
      const [dataRes, ctxRes] = await Promise.allSettled(
        invTariff === 'agile'
          ? [getHistoricalAgileRates(pcResult.letter, invDate, invDate),
             getHistoricalAgileRates(pcResult.letter, contextFrom, contextTo)]
          : [getHistoricalTrackerRates(pcResult.letter, invDate, invDateTo),
             getHistoricalTrackerRates(pcResult.letter, contextFrom, contextTo)]
      );
      if (dataRes.status === 'fulfilled') setInvData(dataRes.value);
      else throw new Error('Failed to fetch rates for selected period.');
      if (ctxRes.status === 'fulfilled') setInvContext(ctxRes.value);
      trackSessionEvent('billing_check', { tariff: invTariff });
    } catch (err) {
      setInvError(err.message || 'Lookup failed.');
    } finally {
      setInvLoading(false);
    }
  }

  // Billing Investigator — re-fetch context when window changes (target data already loaded)
  useEffect(() => {
    if (!invData || !pcResult || !invDate) return;
    const contextFrom = toDateString(subtractDays(new Date(invDate), invContextDays));
    const contextTo   = toDateString(subtractDays(new Date(invDate), 1));
    const fetchFn = invTariff === 'agile'
      ? getHistoricalAgileRates(pcResult.letter, contextFrom, contextTo)
      : getHistoricalTrackerRates(pcResult.letter, contextFrom, contextTo);
    fetchFn.then(d => setInvContext(d)).catch(() => setInvContext(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invContextDays]);

  async function copyBillingSummary(summary) {
    if (!navigator.clipboard) {
      setInvError('Clipboard is unavailable in this browser context.');
      return;
    }
    await navigator.clipboard.writeText(summary);
    setInvCopied(true);
    setTimeout(() => setInvCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      <IogEligibilityCard />

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="text"
          value={postcode}
          onChange={e => setPostcode(e.target.value)}
          placeholder="Enter postcode…"
          maxLength={8}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#2E2252] border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-pink-500"
        />
        <button
          type="submit"
          disabled={pcLoading || !postcode.trim()}
          className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shrink-0"
        >
          {pcLoading ? '…' : 'Look up'}
        </button>
      </form>

      {pcError && <p className="text-xs text-red-400">{pcError}</p>}

      {pcResult && (
        <div className="bg-[#2E2252] rounded-xl p-3 flex flex-col gap-3">

          {/* ── Region ── */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#150E38] border border-white/10 shrink-0">
              <span className="text-2xl font-black text-pink-400 leading-none">{pcResult.letter}</span>
              <span className="text-[10px] text-gray-300 leading-tight">Region</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{pcResult.info.name}</p>
              <p className="text-xs text-gray-300">
                GSP <span className="text-gray-300 font-mono">{pcResult.gsp}</span>
              </p>
              <p className="text-xs text-gray-300">{pcResult.info.dno}</p>
            </div>
            <button
              type="button"
              onClick={() => openOptionsPage('/region-lookup')}
              className="shrink-0 text-xs text-pink-400 hover:text-pink-300 transition-colors font-medium"
            >
              More&nbsp;→
            </button>
          </div>

          {/* ── Agile rates ── */}
          {agileLoading && <Spinner text="Loading Agile rates…" />}
          {!agileLoading && agileError && (
            <p className="text-xs text-gray-300 border-t border-white/10 pt-3">{agileError}</p>
          )}
          {!agileLoading && agile && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">Agile Rates</p>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-2">
                  <p className="text-[11px] text-gray-300 mb-0.5">Now</p>
                  <p className={`text-base font-bold ${rateColor(nowSlot?.value_inc_vat ?? null)}`}>
                    {nowSlot ? `${nowSlot.value_inc_vat.toFixed(1)}p` : '—'}
                  </p>
                </div>
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
              <div className="bg-[#150E38] rounded-lg px-2 py-2 flex items-center justify-between">
                <p className="text-[11px] text-gray-300">Tomorrow</p>
                {tomorrowMM ? (
                  <p className="text-xs">
                    <span className="text-teal-400 font-semibold">{tomorrowMM.min.toFixed(1)}p</span>
                    <span className="text-gray-300"> – </span>
                    <span className="text-red-400 font-semibold">{tomorrowMM.max.toFixed(1)}p</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-300">Not yet published</p>
                )}
              </div>
              {comparison?.agile?.standingCharge != null && (
                <p className="text-[10px] text-gray-300 text-center mt-1">
                  SC: {comparison.agile.standingCharge.toFixed(2)}p/day
                </p>
              )}
            </div>
          )}

          {/* ── Tracker rates ── */}
          {trackerLoading && <Spinner text="Loading Tracker rates…" />}
          {!trackerLoading && trackerError && (
            <p className="text-xs text-gray-300 border-t border-white/10 pt-3">{trackerError}</p>
          )}
          {!trackerLoading && (elecToday || gasToday) && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">Tracker Rates — Today</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-2">
                  <p className="text-[11px] text-gray-300 mb-0.5">⚡ Electricity</p>
                  <p className="text-base font-bold text-cyan-300">
                    {elecToday ? `${elecToday.value_inc_vat.toFixed(2)}p` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-300">p/kWh</p>
                </div>
                <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-2">
                  <p className="text-[11px] text-gray-300 mb-0.5">🔥 Gas</p>
                  <p className="text-base font-bold text-orange-300">
                    {gasToday ? `${gasToday.value_inc_vat.toFixed(2)}p` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-300">p/kWh</p>
                </div>
              </div>
              {(elecStanding || gasStanding) && (
                <div className="flex gap-2 mt-1.5">
                  {elecStanding && <p className="flex-1 text-[10px] text-gray-300 text-center">⚡ SC: {elecStanding.value_inc_vat.toFixed(2)}p/day</p>}
                  {gasStanding  && <p className="flex-1 text-[10px] text-gray-300 text-center">🔥 SC: {gasStanding.value_inc_vat.toFixed(2)}p/day</p>}
                </div>
              )}
            </div>
          )}

          {/* ── EV Chargers ── */}
          {chargerLoading && <Spinner text="Finding nearby chargers…" />}
          {!chargerLoading && chargerError && (
            <p className="text-xs text-gray-300 border-t border-white/10 pt-3">{chargerError}</p>
          )}
          {!chargerLoading && chargers?.chargers?.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">Nearby EV Chargers</p>
              <div className="flex flex-col gap-2">
                {chargers.chargers.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-200 truncate flex-1">{c.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-gray-300">{c.distanceMi?.toFixed(1)}mi</span>
                      {c.connectors?.[0]?.powerKW && (
                        <span className="text-[11px] bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded">
                          {c.connectors[0].powerKW}kW
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!chargerLoading && chargers?.chargers?.length === 0 && (
            <p className="text-xs text-gray-300 border-t border-white/10 pt-3">No nearby chargers found.</p>
          )}

          {/* ── Solar export context ── */}
          {weatherLoading && <Spinner text="Loading solar context…" />}
          {!weatherLoading && weatherError && (
            <p className="text-xs text-gray-300 border-t border-white/10 pt-3">{weatherError}</p>
          )}
          {!weatherLoading && tier && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">Solar Export Context</p>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${tier.color}`}>
                  {tier.icon} {tier.label}
                </span>
                <span className="text-xs text-gray-300">
                  {avgSun.toFixed(1)} hrs/day avg
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-snug">{tier.tip}</p>
            </div>
          )}

          {/* ── Billing Investigator ── */}
          <div className="border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setInvOpen(o => !o)}
              className="w-full text-left text-xs text-gray-300 hover:text-white transition-colors flex items-center justify-between"
            >
              <span>📋 Investigate a bill</span>
              <span className="text-[10px]">{invOpen ? '▲' : '▼'}</span>
            </button>

            {invOpen && (
              <div className="mt-3 flex flex-col gap-3">

                {/* Tariff selector pills */}
                <div className="flex gap-2">
                  {['agile', 'tracker'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setInvTariff(t); setInvDate(''); setInvDateTo(''); setInvData(null); setInvContext(null); setInvError(null); setInvCopied(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${invTariff === t ? 'bg-pink-600 text-white' : 'bg-[#150E38] text-gray-300 hover:bg-purple-900'}`}
                    >
                      {t === 'agile' ? '⚡ Agile' : '📊 Tracker'}
                    </button>
                  ))}
                </div>

                {/* Date inputs */}
                {invTariff === 'agile' && (
                  <input
                    type="date"
                    value={invDate}
                    max={todayStr}
                    onChange={e => { setInvDate(e.target.value); setInvData(null); setInvCopied(false); }}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#150E38] border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                )}
                {invTariff === 'tracker' && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={invDate}
                      max={todayStr}
                      onChange={e => { setInvDate(e.target.value); setInvData(null); setInvCopied(false); }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-[#150E38] border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                    <input
                      type="date"
                      value={invDateTo}
                      max={todayStr}
                      onChange={e => { setInvDateTo(e.target.value); setInvData(null); setInvCopied(false); }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-[#150E38] border border-white/10 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>
                )}

                {/* Context window pills */}
                {invTariff && (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-[10px] text-gray-300 mr-1">vs last:</span>
                    {[7, 14, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setInvContextDays(d)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${invContextDays === d ? 'bg-pink-600 text-white' : 'bg-[#150E38] text-gray-300 hover:bg-purple-900'}`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                )}

                {/* Submit */}
                {invTariff && (
                  <button
                    type="button"
                    onClick={handleInvestigate}
                    disabled={invLoading || !invDate || (invTariff === 'tracker' && !invDateTo)}
                    className="w-full py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                  >
                    {invLoading ? 'Loading…' : 'Investigate'}
                  </button>
                )}

                {invError && <p className="text-xs text-red-400">{invError}</p>}

                {/* ── Agile result ── */}
                {!invLoading && invData && invTariff === 'agile' && (() => {
                  const rates  = invData.import ?? [];
                  const avg    = avgRate(rates);
                  const mm     = minMax(rates);
                  const peak   = rates.length ? rates.reduce((a, b) => b.value_inc_vat > a.value_inc_vat ? b : a, rates[0]) : null;
                  const cheap  = rates.length ? rates.reduce((a, b) => b.value_inc_vat < a.value_inc_vat ? b : a, rates[0]) : null;
                  const ctxAvg = avgRate(invContext?.import);
                  const verdict = billingVerdict(avg, ctxAvg);
                  const top5   = [...rates].sort((a, b) => b.value_inc_vat - a.value_inc_vat).slice(0, 5);
                  const maxVal = top5[0]?.value_inc_vat ?? 1;
                  const summary = [
                    `Billing summary (${pcResult.postcode}, Agile, ${formatDateShort(invDate)})`,
                    `Average: ${avg != null ? `${avg.toFixed(1)}p/kWh` : 'n/a'}`,
                    `Min: ${mm?.min != null ? `${mm.min.toFixed(1)}p/kWh` : 'n/a'}`,
                    `Max: ${mm?.max != null ? `${mm.max.toFixed(1)}p/kWh` : 'n/a'}`,
                    `Context: ${ctxAvg != null ? `${ctxAvg.toFixed(1)}p/kWh over previous ${invContextDays}d` : 'n/a'}`,
                    `Verdict: ${verdict?.label ?? 'Not enough context'}`,
                  ].join('\n');
                  return (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] text-gray-300 uppercase tracking-wider">
                        Agile — {formatDateShort(invDate)}
                      </p>
                      <div className="flex gap-2">
                        {[['Avg', avg], ['Min', mm?.min], ['Max', mm?.max]].map(([label, val]) => (
                          <div key={label} className="flex-1 bg-[#150E38] rounded-lg px-2 py-1.5 text-center">
                            <p className="text-[10px] text-gray-300">{label}</p>
                            <p className={`text-sm font-bold ${rateColor(val)}`}>{val != null ? `${val.toFixed(1)}p` : '—'}</p>
                          </div>
                        ))}
                      </div>
                      {peak && <p className="text-[10px] text-gray-300">Peak: {new Date(peak.valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} → <span className="text-red-400 font-semibold">{peak.value_inc_vat.toFixed(1)}p</span></p>}
                      {cheap && <p className="text-[10px] text-gray-300">Cheap: {new Date(cheap.valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} → <span className="text-teal-400 font-semibold">{cheap.value_inc_vat.toFixed(1)}p</span></p>}
                      {verdict && (
                        <div className={`border rounded-lg px-2 py-1.5 text-[10px] font-semibold ${verdict.className}`}>
                          {verdict.label} vs last {invContextDays}d
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => copyBillingSummary(summary)}
                        className="self-start text-[10px] px-2 py-1 rounded bg-[#150E38] hover:bg-purple-900 border border-white/10 text-gray-300 transition-colors"
                      >
                        {invCopied ? 'Copied' : 'Copy summary'}
                      </button>
                      {top5.length > 0 && (
                        <>
                          <p className="text-[10px] text-gray-300 uppercase tracking-wider mt-1">Top 5 slots</p>
                          {top5.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-300 w-10 shrink-0">
                                {new Date(s.valid_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div className="flex-1 bg-[#150E38] rounded overflow-hidden h-2">
                                <div className="h-full bg-pink-500" style={{ width: `${Math.max(0, s.value_inc_vat) / maxVal * 100}%` }} />
                              </div>
                              <span className={`text-[10px] font-semibold w-12 text-right ${rateColor(s.value_inc_vat)}`}>
                                {s.value_inc_vat.toFixed(1)}p
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── Tracker result ── */}
                {!invLoading && invData && invTariff === 'tracker' && (() => {
                  const elecRates = invData.electricity?.rates ?? [];
                  const gasRates  = invData.gas?.rates ?? [];
                  const elecAvg   = avgRate(elecRates);
                  const gasAvg    = avgRate(gasRates);
                  const ctxElec   = avgRate(invContext?.electricity?.rates);
                  const ctxGas    = avgRate(invContext?.gas?.rates);
                  const elecVerdict = billingVerdict(elecAvg, ctxElec);
                  const gasVerdict = billingVerdict(gasAvg, ctxGas);
                  const byDate = {};
                  elecRates.forEach(r => { const d = toDateString(new Date(r.valid_from)); byDate[d] = { ...(byDate[d] || {}), elec: r.value_inc_vat }; });
                  gasRates.forEach(r  => { const d = toDateString(new Date(r.valid_from)); byDate[d] = { ...(byDate[d] || {}), gas:  r.value_inc_vat }; });
                  const dates = Object.keys(byDate).sort();
                  const summary = [
                    `Billing summary (${pcResult.postcode}, Tracker, ${formatDateShort(invDate)}${invDateTo && invDateTo !== invDate ? ` to ${formatDateShort(invDateTo)}` : ''})`,
                    `Electricity average: ${elecAvg != null ? `${elecAvg.toFixed(2)}p/kWh` : 'n/a'}`,
                    `Gas average: ${gasAvg != null ? `${gasAvg.toFixed(2)}p/kWh` : 'n/a'}`,
                    `Electricity context: ${ctxElec != null ? `${ctxElec.toFixed(2)}p/kWh over previous ${invContextDays}d` : 'n/a'}`,
                    `Gas context: ${ctxGas != null ? `${ctxGas.toFixed(2)}p/kWh over previous ${invContextDays}d` : 'n/a'}`,
                    `Electricity verdict: ${elecVerdict?.label ?? 'Not enough context'}`,
                    `Gas verdict: ${gasVerdict?.label ?? 'Not enough context'}`,
                  ].join('\n');
                  return (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] text-gray-300 uppercase tracking-wider">
                        Tracker — {formatDateShort(invDate)}{invDateTo && invDateTo !== invDate ? ` to ${formatDateShort(invDateTo)}` : ''}
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-1.5">
                          <p className="text-[10px] text-gray-300 mb-0.5">⚡ Elec avg</p>
                          <p className="text-sm font-bold text-cyan-300">{elecAvg != null ? `${elecAvg.toFixed(2)}p` : '—'}</p>
                          {elecVerdict && <p className={`text-[10px] ${elecVerdict.pct > 0 ? 'text-red-400' : 'text-teal-400'}`}>{elecVerdict.label}</p>}
                        </div>
                        <div className="flex-1 bg-[#150E38] rounded-lg px-2 py-1.5">
                          <p className="text-[10px] text-gray-300 mb-0.5">🔥 Gas avg</p>
                          <p className="text-sm font-bold text-orange-300">{gasAvg != null ? `${gasAvg.toFixed(2)}p` : '—'}</p>
                          {gasVerdict && <p className={`text-[10px] ${gasVerdict.pct > 0 ? 'text-red-400' : 'text-teal-400'}`}>{gasVerdict.label}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyBillingSummary(summary)}
                        className="self-start text-[10px] px-2 py-1 rounded bg-[#150E38] hover:bg-purple-900 border border-white/10 text-gray-300 transition-colors"
                      >
                        {invCopied ? 'Copied' : 'Copy summary'}
                      </button>
                      {dates.length > 1 && (
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] text-gray-300 uppercase tracking-wider">Daily</p>
                          {dates.map(d => (
                            <div key={d} className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-300 w-12 shrink-0">{formatDateShort(d)}</span>
                              <span className="text-cyan-300">{byDate[d].elec != null ? `${byDate[d].elec.toFixed(2)}p` : '—'}</span>
                              <span className="text-orange-300">{byDate[d].gas  != null ? `${byDate[d].gas.toFixed(2)}p`  : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// Bill Simulation Calculator
// Uses existing API endpoints to show estimated monthly/annual costs across tariffs.
// No new backend routes needed — uses getHistoricalAgileRates, getTrackerRates, getComparisonRates.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SVT_CAP } from '../constants/svt';
import { REGION_INFO, REGION_LIST } from '../constants/regions';
import { getHistoricalAgileRates, getTrackerRates, getComparisonRates } from '../services/api';

const UK_AVG = { elec: 242, gas: 800 }; // kWh/month approx

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getRangeDates() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(thirtyAgo.getDate() - 31);
  return { from: toDateStr(thirtyAgo), to: toDateStr(yesterday) };
}

function avgRate(rates) {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  const sum = rates.reduce((acc, r) => acc + (r.value_inc_vat ?? 0), 0);
  return sum / rates.length;
}

function currentRate(rates) {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  // Find the most recently valid rate (highest valid_from that's in the past)
  const now = new Date();
  const valid = rates.filter(r => !r.valid_from || new Date(r.valid_from) <= now);
  if (!valid.length) return rates[0]?.value_inc_vat ?? null;
  return valid.sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))[0].value_inc_vat;
}

// Cost calculation: unit rate in p/kWh, standing in p/day, usage in kWh/month
// Returns { monthly, annual } in £
function calcCost(unitRatePence, standingPencePerDay, monthlyKwh) {
  if (unitRatePence == null) return null;
  const standing = (standingPencePerDay ?? 0) / 100 * 30;
  const units    = (unitRatePence / 100) * monthlyKwh;
  const monthly  = standing + units;
  return { monthly, annual: monthly * 12 };
}

// Difference vs SVT in £/year — positive means more expensive, negative means saving
function vsSvt(annualCost, svtAnnual) {
  if (annualCost == null || svtAnnual == null) return null;
  return annualCost - svtAnnual;
}

export default function BillCalculator() {
  const [searchParams] = useSearchParams();
  const urlRegion = searchParams.get('region');
  const [region,        setRegion]        = useState(urlRegion && REGION_INFO[urlRegion] ? urlRegion : 'H');
  const [elecKwh,       setElecKwh]       = useState(searchParams.get('elecKwh') || '');
  const [gasKwh,        setGasKwh]        = useState(searchParams.get('gasKwh') || '');
  const [results,       setResults]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  function applyPresets() {
    setElecKwh(String(UK_AVG.elec));
    setGasKwh(String(UK_AVG.gas));
  }

  async function handleCalculate(e) {
    e.preventDefault();
    const elec = parseFloat(elecKwh);
    if (!elec || elec <= 0) { setError('Please enter a valid monthly electricity usage.'); return; }
    const gas = parseFloat(gasKwh) || 0;

    setLoading(true);
    setError(null);
    setResults(null);

    const { from, to } = getRangeDates();

    const [agileRes, trackerRes, compRes] = await Promise.allSettled([
      getHistoricalAgileRates(region, from, to),
      getTrackerRates(region),
      getComparisonRates(region),
    ]);

    // Parse agile
    let agileUnitRate = null;
    if (agileRes.status === 'fulfilled') {
      const importRates = agileRes.value?.import;
      agileUnitRate = avgRate(importRates);
    }

    // Parse tracker
    let trackerElecRate   = null;
    let trackerElecStand  = null;
    let trackerGasRate    = null;
    let trackerGasStand   = null;
    if (trackerRes.status === 'fulfilled') {
      const { electricity, gas: gasData } = trackerRes.value || {};
      trackerElecRate  = currentRate(electricity?.rates);
      trackerElecStand = currentRate(electricity?.standing);
      trackerGasRate   = currentRate(gasData?.rates);
      trackerGasStand  = currentRate(gasData?.standing);
    }

    // Parse comparison rates (flexible + fixed)
    let flexElecRate   = null;
    let flexElecStand  = null;
    let fixedElecRate  = null;
    let fixedElecStand = null;
    let agileStand     = null;
    if (compRes.status === 'fulfilled') {
      const { flexible, fixed, agile } = compRes.value || {};
      flexElecRate   = flexible?.unitRate ?? null;
      flexElecStand  = flexible?.standingCharge ?? null;
      fixedElecRate  = fixed?.unitRate ?? null;
      fixedElecStand = fixed?.standingCharge ?? null;
      agileStand     = agile?.standingCharge ?? null;
    }

    // SVT
    const svtElecRate  = SVT_CAP.electricity.unitRate;
    const svtElecStand = SVT_CAP.electricity.standingCharge;
    const svtGasRate   = SVT_CAP.gas.unitRate;
    const svtGasStand  = SVT_CAP.gas.standingCharge;

    const svtElec = calcCost(svtElecRate, svtElecStand, elec);
    const svtGas  = gas > 0 ? calcCost(svtGasRate, svtGasStand, gas) : null;
    const svtTotal = svtElec ? {
      monthly: svtElec.monthly + (svtGas?.monthly ?? 0),
      annual:  svtElec.annual  + (svtGas?.annual  ?? 0),
    } : null;

    const agileElec    = calcCost(agileUnitRate, agileStand, elec);
    const trackerElec  = calcCost(trackerElecRate, trackerElecStand, elec);
    const trackerGas   = gas > 0 ? calcCost(trackerGasRate, trackerGasStand, gas) : null;
    const flexElec     = calcCost(flexElecRate, flexElecStand, elec);
    const fixedElec    = calcCost(fixedElecRate, fixedElecStand, elec);

    const trackerTotal = trackerElec ? {
      monthly: trackerElec.monthly + (trackerGas?.monthly ?? 0),
      annual:  trackerElec.annual  + (trackerGas?.annual  ?? 0),
    } : null;

    setResults({
      elec, gas,
      rows: [
        {
          tariff: 'Agile (30d avg)',
          unitRate: agileUnitRate,
          note: '30-day historical average import rate',
          elecCost: agileElec,
          gasCost: null,
          total: agileElec,
          error: agileRes.status !== 'fulfilled' ? 'Data unavailable' : null,
        },
        {
          tariff: 'Octopus Tracker',
          unitRate: trackerElecRate,
          note: "Today's Tracker electricity rate",
          elecCost: trackerElec,
          gasCost: trackerGas,
          total: trackerTotal,
          error: trackerRes.status !== 'fulfilled' ? 'Data unavailable' : null,
        },
        {
          tariff: 'Octopus Flexible',
          unitRate: flexElecRate,
          note: 'Current Flexible electricity rate',
          elecCost: flexElec,
          gasCost: null,
          total: flexElec,
          error: compRes.status !== 'fulfilled' ? 'Data unavailable' : null,
        },
        {
          tariff: 'Octopus Fixed',
          unitRate: fixedElecRate,
          note: 'Current Fixed electricity rate',
          elecCost: fixedElec,
          gasCost: null,
          total: fixedElec,
          error: compRes.status !== 'fulfilled' ? 'Data unavailable' : null,
        },
        {
          tariff: `SVT Cap (${SVT_CAP.quarter})`,
          unitRate: svtElecRate,
          note: 'Ofgem price cap electricity rate',
          elecCost: svtElec,
          gasCost: svtGas,
          total: svtTotal,
          error: null,
          isSvt: true,
        },
      ],
      svtTotal,
    });
    setLoading(false);
  }

  function fmtRate(p) {
    if (p == null) return '—';
    return `${p.toFixed(2)}p/kWh`;
  }

  function fmtGbp(n) {
    if (n == null) return '—';
    return `£${n.toFixed(2)}`;
  }

  function fmtDiff(n) {
    if (n == null) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}£${Math.abs(n).toFixed(0)}/yr`;
  }

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">
      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tools</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Bill Simulator</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Estimate monthly and annual costs across Octopus tariffs using current live rates.
          Enter the customer's typical monthly usage to compare.
        </p>
      </header>

      {/* Input form */}
      <form onSubmit={handleCalculate} className="octopus-card-bg rounded-2xl p-6 md:p-8 space-y-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Region */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
              DNO Region
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {REGION_LIST.map(r => (
                <option key={r.code} value={r.code} style={{ background: '#150E38' }}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Presets */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyPresets}
              className="text-sm text-teal-400 hover:text-teal-300 border border-teal-500/30 rounded-xl px-4 py-2.5 transition-colors hover:bg-teal-500/10"
            >
              ⚡ Use UK average usage
              <span className="block text-xs text-gray-300 font-normal mt-0.5">
                {UK_AVG.elec} kWh/month elec · {UK_AVG.gas} kWh/month gas
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Electricity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
              Electricity — kWh/month
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              step="1"
              value={elecKwh}
              onChange={e => setElecKwh(e.target.value)}
              placeholder="e.g. 242"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Gas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
              Gas — kWh/month <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              value={gasKwh}
              onChange={e => setGasKwh(e.target.value)}
              placeholder="e.g. 800"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-300 mt-1">Used for Tracker and SVT gas cost comparison</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto px-8 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {loading ? 'Fetching live rates…' : 'Calculate Estimates'}
        </button>
      </form>

      {/* Results */}
      {results && (
        <div className="octopus-card-bg rounded-2xl p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Estimated Costs</h2>
            <p className="text-gray-300 text-sm">
              Based on {results.elec} kWh/month electricity{results.gas > 0 ? ` + ${results.gas} kWh/month gas` : ''} in region {region}.
              Standing charges calculated at 30 days/month.
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-gray-300 font-medium">Tariff</th>
                  <th className="text-right py-2 pr-4 text-gray-300 font-medium">Elec rate</th>
                  <th className="text-right py-2 pr-4 text-gray-300 font-medium">Monthly</th>
                  <th className="text-right py-2 pr-4 text-gray-300 font-medium">Annual</th>
                  <th className="text-right py-2 text-gray-300 font-medium">vs SVT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.rows.map((row, i) => {
                  const annual  = row.total?.annual  ?? null;
                  const monthly = row.total?.monthly ?? null;
                  const diff    = vsSvt(annual, results.svtTotal?.annual ?? null);
                  const isCheap = diff != null && diff < 0;
                  const isExp   = diff != null && diff > 0;
                  return (
                    <tr key={i} className={row.isSvt ? 'opacity-60' : ''}>
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{row.tariff}</p>
                        <p className="text-xs text-gray-300">{row.note}</p>
                        {row.error && <p className="text-xs text-red-400">{row.error}</p>}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-300 font-mono text-xs">{fmtRate(row.unitRate)}</td>
                      <td className="py-3 pr-4 text-right">
                        {monthly != null ? (
                          <span className="text-white font-semibold">{fmtGbp(monthly)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {annual != null ? (
                          <span className="text-white font-semibold">{fmtGbp(annual)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 text-right">
                        {row.isSvt ? (
                          <span className="text-gray-300 text-xs">baseline</span>
                        ) : diff != null ? (
                          <span className={`font-semibold text-xs ${isCheap ? 'text-teal-400' : isExp ? 'text-red-400' : 'text-gray-300'}`}>
                            {isCheap ? '▼ ' : isExp ? '▲ ' : ''}{fmtDiff(diff)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Caveats */}
          <div className="bg-white/5 rounded-xl p-4 text-xs text-gray-300 space-y-1">
            <p>⚠️ <strong className="text-gray-300">Estimates only.</strong> Actual bills depend on standing charges by region, usage patterns, payment method, and tariff availability.</p>
            <p>• Agile estimate uses the 30-day historical average import rate — does not account for usage-shifting behaviour that typically reduces Agile bills further.</p>
            <p>• Tracker gas costs are shown where monthly gas usage was entered. Agile and Flexible/Fixed do not include gas.</p>
            <p>• SVT figures: {SVT_CAP.quarter} Ofgem price cap ({SVT_CAP.electricity.unitRate}p/kWh elec, {SVT_CAP.gas.unitRate}p/kWh gas).</p>
          </div>
        </div>
      )}
    </main>
  );
}

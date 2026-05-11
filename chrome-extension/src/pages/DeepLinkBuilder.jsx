import { useMemo, useState } from 'react';
import { REGION_INFO, REGION_LIST } from '../constants/regions';

function extensionUrl(hash) {
  try {
    return `${chrome.runtime.getURL('options/options.html')}#${hash}`;
  } catch {
    return `options/options.html#${hash}`;
  }
}

export default function DeepLinkBuilder() {
  const [type, setType] = useState('region');
  const [region, setRegion] = useState('H');
  const [postcode, setPostcode] = useState('');
  const [date, setDate] = useState('');
  const [elecKwh, setElecKwh] = useState('');
  const [gasKwh, setGasKwh] = useState('');
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    if (type === 'region') return extensionUrl(`/region-lookup${postcode ? `?postcode=${encodeURIComponent(postcode.trim().toUpperCase())}` : ''}`);
    if (type === 'agile') return extensionUrl(`/agile-tracker?region=${region}${date ? `&date=${date}` : ''}`);
    if (type === 'tracker') return extensionUrl(`/tracker-prices?region=${region}`);
    const params = new URLSearchParams({ region });
    if (elecKwh) params.set('elecKwh', elecKwh);
    if (gasKwh) params.set('gasKwh', gasKwh);
    return extensionUrl(`/bill-calculator?${params.toString()}`);
  }, [type, region, postcode, date, elecKwh, gasKwh]);

  async function copyLink() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">
      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tools</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          Deep-link <span className="octopus-text-gradient">Builder</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Build shareable extension links for handovers, training notes, and internal docs.
        </p>
      </header>

      <section className="octopus-card-bg rounded-2xl p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Workflow</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['region', 'Postcode lookup'],
              ['agile', 'Agile tracker'],
              ['tracker', 'Tracker prices'],
              ['bill', 'Bill simulator'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border ${type === id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {type === 'region' && (
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Postcode</span>
            <input value={postcode} onChange={e => setPostcode(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white placeholder-gray-400" placeholder="Optional, e.g. SW1A 1AA" />
          </label>
        )}

        {type !== 'region' && (
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Region</span>
            <select value={region} onChange={e => setRegion(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white">
              {REGION_LIST.map(r => <option key={r.code} value={r.code}>{r.code} — {r.name} ({REGION_INFO[r.code].gsp})</option>)}
            </select>
          </label>
        )}

        {type === 'agile' && (
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white" />
          </label>
        )}

        {type === 'bill' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={elecKwh} onChange={e => setElecKwh(e.target.value)} type="number" min="0" placeholder="Elec kWh/month" className="bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white placeholder-gray-400" />
            <input value={gasKwh} onChange={e => setGasKwh(e.target.value)} type="number" min="0" placeholder="Gas kWh/month" className="bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white placeholder-gray-400" />
          </div>
        )}

        <div className="bg-[#150E38] rounded-xl p-3 border border-white/10">
          <p className="text-xs text-gray-300 mb-1">Generated link</p>
          <p className="text-xs text-gray-200 font-mono break-all">{link}</p>
        </div>
        <button type="button" onClick={copyLink} className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </section>
    </main>
  );
}

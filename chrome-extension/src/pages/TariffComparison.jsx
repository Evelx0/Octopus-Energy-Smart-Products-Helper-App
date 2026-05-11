// Side-by-side comparison table of all Octopus smart tariffs.
// Static content — no API calls.

import { Link } from 'react-router-dom';
import CopyButton from '../components/ui/CopyButton';

const TARIFFS = [
  {
    id: 'agile',
    name: 'Agile Octopus',
    colour: '#FF47A0',
    refPath: '/tariffs/agile',
  },
  {
    id: 'tracker',
    name: 'Octopus Tracker',
    colour: '#f59e0b',
    refPath: '/tariffs/tracker',
  },
  {
    id: 'io-go',
    name: 'Intelligent Go',
    colour: '#00A69C',
    refPath: '/tariffs/intelligent',
  },
  {
    id: 'go',
    name: 'Octopus Go',
    colour: '#7c3aed',
    refPath: null,
  },
  {
    id: 'flux',
    name: 'Flux',
    colour: '#3b82f6',
    refPath: '/tariffs/flux',
  },
  {
    id: 'cosy',
    name: 'Cosy Octopus',
    colour: '#f97316',
    refPath: '/tariffs/cosy',
  },
  {
    id: 'outgoing',
    name: 'Outgoing Octopus',
    colour: '#10b981',
    refPath: null,
  },
];

const ROWS = [
  {
    label: 'Billing frequency',
    values: {
      agile:    'Half-hourly (48 slots/day)',
      tracker:  'Daily (1 rate/day per fuel)',
      'io-go':  'Monthly (fixed off-peak + standard rates)',
      go:       'Monthly (fixed off-peak + standard rates)',
      flux:     'Monthly (3 ToU bands)',
      cosy:     'Monthly (3 ToU bands)',
      outgoing: 'Monthly (fixed export rate)',
    },
  },
  {
    label: 'Rate type',
    values: {
      agile:    'Variable — wholesale market half-hourly',
      tracker:  'Variable — wholesale market daily',
      'io-go':  'Fixed off-peak (~8p/kWh 11:30pm–5:30am) + fixed standard rate',
      go:       'Fixed off-peak (cheaper than IO Go off-peak) + fixed standard rate',
      flux:     'Fixed — 3 ToU bands (off-peak, standard, peak)',
      cosy:     'Variable — 3 ToU bands (cheap, day, peak) changing seasonally',
      outgoing: 'Fixed rate per kWh exported',
    },
  },
  {
    label: 'Smart meter required',
    values: {
      agile:    'Yes — SMETS2 preferred; half-hourly reads required',
      tracker:  'Yes — SMETS1/2 both supported; daily reads sufficient',
      'io-go':  'Yes — SMETS2 required',
      go:       'Yes — SMETS2 required',
      flux:     'Yes — SMETS2 for both import and export',
      cosy:     'Yes — SMETS2 required',
      outgoing: 'Yes — export meter point required',
    },
  },
  {
    label: 'EV required',
    values: {
      agile:    'No',
      tracker:  'No',
      'io-go':  'Yes — compatible EV + home charging',
      go:       'No (but designed for EV owners)',
      flux:     'No',
      cosy:     'No',
      outgoing: 'No',
    },
  },
  {
    label: 'Solar required',
    values: {
      agile:    'No',
      tracker:  'No',
      'io-go':  'No',
      go:       'No',
      flux:     'Yes — solar PV required',
      cosy:     'No',
      outgoing: 'Yes — solar PV required',
    },
  },
  {
    label: 'Battery required',
    values: {
      agile:    'No',
      tracker:  'No',
      'io-go':  'No',
      go:       'No',
      flux:     'Yes — home battery storage required',
      cosy:     'No',
      outgoing: 'No',
    },
  },
  {
    label: 'Gas included',
    values: {
      agile:    'No — electricity only',
      tracker:  'Yes — both electricity and gas',
      'io-go':  'No — electricity only',
      go:       'No — electricity only',
      flux:     'No — electricity only',
      cosy:     'No — electricity only',
      outgoing: 'Export only — no import covered',
    },
  },
  {
    label: 'Export available',
    values: {
      agile:    'Yes — Agile Outgoing (also half-hourly variable)',
      tracker:  'No dedicated export product',
      'io-go':  'No built-in export — add Outgoing Octopus separately',
      go:       'No built-in export',
      flux:     'Yes — bundled import + export on same tariff',
      cosy:     'No built-in export — add Outgoing Octopus separately',
      outgoing: 'This IS the export tariff',
    },
  },
  {
    label: 'Ideal customer',
    values: {
      agile:    'Flexible users — EV owners, heat pump users, anyone shifting load to cheap slots',
      tracker:  'Customers who want wholesale price transparency on both fuels with no lock-in',
      'io-go':  'EV owners with compatible vehicle + home charger who want automated cheap overnight charging',
      go:       'EV owners wanting a simpler fixed off-peak rate without smart scheduling',
      flux:     'Solar + battery households wanting to maximise their setup value',
      cosy:     'Homes with heat pumps, electric boilers, or electric radiators wanting to shift heating load to cheap windows',
      outgoing: 'Solar households wanting a simple fixed export rate above the SEG minimum',
    },
  },
  {
    label: 'Key risk to communicate',
    highlight: true,
    values: {
      agile:    'Price spikes during peak demand (especially winter evenings 4–9pm). Not suitable for inflexible usage.',
      tracker:  'Winter gas and electricity volatility. Both fuels variable simultaneously.',
      'io-go':  'Standard day rate outside off-peak. 6-hour smart charging limit (Mar 2026) — Boost rate beyond 6hrs. Requires compatible EV/charger.',
      go:       'Less saving potential than IO Go for smart EV users. Simpler but less optimised.',
      flux:     'High peak import rate — avoid grid use 4–7pm. Needs solar AND battery upfront investment.',
      cosy:     'Peak window (4–7pm) is ~50% above day rate — must shift heating away from that window. Savings rely on customer adjusting heat pump schedule.',
      outgoing: 'Export rate can change. No import benefit — customer still needs a separate import tariff.',
    },
  },
];

const COMPATIBILITY_ROWS = [
  {
    scenario: 'IO Go + Outgoing Octopus (solar export)',
    outcome: 'compatible',
    outcomeLabel: '✅ Fully compatible',
    notes: 'Can export solar while having smart EV charging. Common and recommended combination.',
  },
  {
    scenario: 'Cosy Octopus + Outgoing Octopus (solar export)',
    outcome: 'compatible',
    outcomeLabel: '✅ Fully compatible',
    notes: 'Heat pump home with solar export works fine. Cosy covers import; Outgoing covers export.',
  },
  {
    scenario: 'Agile + Agile Outgoing (solar export)',
    outcome: 'compatible',
    outcomeLabel: '✅ Fully compatible',
    notes: 'Half-hourly import + half-hourly export. Ideal for solar homes that also shift usage.',
  },
  {
    scenario: 'Flux (import + export bundled)',
    outcome: 'compatible',
    outcomeLabel: '✅ Self-contained',
    notes: 'Flux bundles both import and export in one product — no separate export tariff needed or possible.',
  },
  {
    scenario: 'IO Go + Cosy Octopus',
    outcome: 'incompatible',
    outcomeLabel: '❌ Not possible',
    notes: 'Both are electricity import tariffs. Customer must choose one. See "EV + Heat Pump" row below.',
  },
  {
    scenario: 'Flux + IO Go',
    outcome: 'incompatible',
    outcomeLabel: '❌ Not possible',
    notes: 'Both are electricity import tariffs. Cannot hold two import tariffs simultaneously.',
  },
  {
    scenario: 'Flux + Cosy Octopus',
    outcome: 'incompatible',
    outcomeLabel: '❌ Not possible',
    notes: 'Both are electricity import tariffs. Flux also includes export — no room for a third product.',
  },
  {
    scenario: 'Tracker + any second electricity import tariff',
    outcome: 'incompatible',
    outcomeLabel: '❌ Not possible',
    notes: 'Tracker is itself the electricity import tariff. Cannot stack with Agile, IO Go, Cosy, Flux etc.',
  },
  {
    scenario: 'Customer has EV + heat pump — wants IO Go AND Cosy',
    outcome: 'flag',
    outcomeLabel: '⚠️ Must choose one',
    notes: 'Very common scenario. IO Go is usually the better fit — smart EV charging overnight saves more than Cosy cheap windows. Recommend IO Go unless the customer has no compatible EV/charger.',
  },
  {
    scenario: 'Tracker (electricity) + separate gas tariff',
    outcome: 'compatible',
    outcomeLabel: '✅ Fully compatible',
    notes: 'Tracker already includes gas. If a customer wants to split: they can keep Tracker for electricity and move gas to a fixed tariff, or vice versa.',
  },
];

const outcomeStyle = {
  compatible:   'text-teal-300',
  incompatible: 'text-red-400',
  flag:         'text-amber-300',
};

const RECOMMENDATION_CARDS = [
  {
    title: 'EV with home charging',
    tariff: 'Intelligent Octopus Go',
    why: 'Best fit when the customer has a compatible EV or charger and wants automated cheap overnight charging.',
    caveat: 'Requires SMETS2 and compatibility checks before onboarding.',
    next: '/tariffs/intelligent-vehicles',
  },
  {
    title: 'Flexible household',
    tariff: 'Agile Octopus',
    why: 'Best savings potential when usage can move away from peak periods into cheap half-hourly slots.',
    caveat: 'Explain winter evening spikes and budget uncertainty clearly.',
    next: '/agile-tracker',
  },
  {
    title: 'Solar plus battery',
    tariff: 'Flux',
    why: 'Designed for solar and battery customers who can charge cheap, avoid peak import, and export strategically.',
    caveat: 'Needs solar, battery, and a compatible smart export meter setup.',
    next: '/tariffs/flux',
  },
  {
    title: 'Wants simpler variable pricing',
    tariff: 'Octopus Tracker',
    why: 'Good fit when the customer wants wholesale-linked pricing without half-hourly behaviour changes.',
    caveat: 'Daily rates still move with the market, especially in winter.',
    next: '/tracker-prices',
  },
];

function cardCopy(card) {
  return [
    `Best-fit tariff: ${card.tariff}`,
    `Why: ${card.why}`,
    `Caveats: ${card.caveat}`,
    `Next page to check: ${card.next}`,
  ].join('\n');
}

export default function TariffComparison() {
  return (
    <main className="max-w-7xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tariff Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
          <span className="octopus-text-gradient">Compare All Tariffs</span>
        </h1>
        <p className="text-gray-300 max-w-2xl">
          Use this when a customer asks "which tariff is right for me?" or when assessing eligibility. See individual reference pages for full detail.
        </p>
        <p className="text-xs text-gray-300 mt-2">Tip: use the <Link to="/eligibility" className="text-teal-400 hover:underline">Eligibility Checker</Link> to filter tariffs by customer profile automatically.</p>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {RECOMMENDATION_CARDS.map(card => (
          <div key={card.title} className="octopus-card-bg rounded-xl p-4 border border-white/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">{card.title}</p>
            <p className="text-white font-bold mt-2">{card.tariff}</p>
            <p className="text-gray-300 text-xs mt-1 leading-relaxed">{card.why}</p>
            <div className="mt-3">
              <CopyButton label="Copy recommendation" value={cardCopy(card)} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Main comparison table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[1050px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[#150E38] text-left px-4 py-3 text-gray-300 font-semibold text-xs uppercase tracking-wider w-44 border-b border-white/10">
                Dimension
              </th>
              {TARIFFS.map(t => (
                <th key={t.id} className="px-4 py-3 text-center border-b border-white/10 min-w-[140px]">
                  <div className="font-bold text-sm" style={{ color: t.colour }}>{t.name}</div>
                  {t.refPath && (
                    <Link to={t.refPath} className="text-xs text-gray-300 hover:text-gray-300 underline">
                      Full guide →
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                <td className={`sticky left-0 px-4 py-3 font-medium border-b border-white/5 ${
                  i % 2 === 0 ? 'bg-[#1a1240]' : 'bg-[#150E38]'
                } ${row.highlight ? 'text-amber-300' : 'text-gray-300'}`}>
                  {row.label}
                </td>
                {TARIFFS.map(t => (
                  <td key={t.id} className={`px-4 py-3 text-gray-300 border-b border-white/5 align-top ${
                    row.highlight ? 'text-amber-200/80' : ''
                  }`}>
                    {row.values[t.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-300 italic space-y-1">
        <p>* Octopus Go is included for reference but does not have a dedicated reference page in this portal yet.</p>
        <p>* Outgoing Octopus is an export-only tariff and must be paired with a separate import tariff.</p>
        <p>* All rates and features current as of 2026-04 — verify with live Octopus documentation for the latest.</p>
      </div>

      {/* ── Tariff Compatibility Matrix ── */}
      <section className="mt-14">
        <h2 className="text-2xl font-black text-white mb-1">Tariff Compatibility Matrix</h2>
        <p className="text-gray-300 text-sm mb-6 max-w-2xl">
          A customer can only hold one electricity <em>import</em> tariff at a time. Use this table to answer "can these two products be combined?" quickly.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[680px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-gray-300 font-semibold text-xs uppercase tracking-wider border-b border-white/10 w-72">Scenario</th>
                <th className="text-left px-4 py-3 text-gray-300 font-semibold text-xs uppercase tracking-wider border-b border-white/10 w-44">Outcome</th>
                <th className="text-left px-4 py-3 text-gray-300 font-semibold text-xs uppercase tracking-wider border-b border-white/10">Staff notes</th>
              </tr>
            </thead>
            <tbody>
              {COMPATIBILITY_ROWS.map((row, i) => (
                <tr key={row.scenario} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                  <td className="px-4 py-3 text-gray-200 border-b border-white/5 align-top font-medium">{row.scenario}</td>
                  <td className={`px-4 py-3 border-b border-white/5 align-top font-semibold whitespace-nowrap ${outcomeStyle[row.outcome]}`}>{row.outcomeLabel}</td>
                  <td className="px-4 py-3 text-gray-300 border-b border-white/5 align-top text-xs leading-relaxed">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-300 italic">
          * Gas tariffs (Tracker gas component, or a standalone fixed gas deal) can always co-exist with any electricity import tariff — they are on separate fuel points.
        </p>
      </section>

    </main>
  );
}

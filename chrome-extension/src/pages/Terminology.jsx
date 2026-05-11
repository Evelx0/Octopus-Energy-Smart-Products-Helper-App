// Searchable glossary of energy industry terms.
// Static content — no API calls.

import { useState } from 'react';

const TERMS = [
  {
    term: 'MPAN',
    definition: 'Meter Point Administration Number — a 13-digit number that uniquely identifies an electricity supply point (meter connection). Used in all Octopus API calls for electricity consumption and meter lookups.',
  },
  {
    term: 'MPRN',
    definition: 'Meter Point Reference Number — a 10-digit number that uniquely identifies a gas supply point. The gas equivalent of MPAN.',
  },
  {
    term: 'GSP',
    definition: 'Grid Supply Point — the connection point between the national high-voltage transmission network and the local distribution network. Octopus uses a single letter code (A–P) to identify a customer\'s GSP region, which determines which Agile/Tracker tariff rates apply.',
  },
  {
    term: 'DNO',
    definition: 'Distribution Network Operator — the company that owns and operates the electricity cables and infrastructure in a local area. Examples: UK Power Networks (London, South East), Western Power Distribution (Midlands, Wales), Northern Powergrid (Yorkshire, North East). DNOs are different from suppliers like Octopus.',
  },
  {
    term: 'HH metering',
    definition: 'Half-Hourly metering — a smart meter configured to record and report consumption in 30-minute intervals. Required for Agile tariff billing. Not all smart meters are confirmed as sending HH reads to the supplier.',
  },
  {
    term: 'SMETS1',
    definition: 'Smart Meter Equipment Technical Specification 1 — the first generation of UK smart meters, deployed from around 2011–2019. SMETS1 meters use a proprietary communication system per supplier, so they may "go dumb" when switching suppliers. Most have now been enrolled into the DCC, restoring smart functionality with all suppliers.',
  },
  {
    term: 'SMETS2',
    definition: 'Second-generation UK smart meters. All SMETS2 meters communicate via the DCC (Data Communications Company), making them portable across suppliers. SMETS2 is the current standard and is preferred for Agile, Flux, and IO Go tariffs.',
  },
  {
    term: 'DCC',
    definition: 'Data Communications Company — the central hub that manages communications between smart meters and energy suppliers/network operators in Great Britain. When a SMETS1 meter is "enrolled in the DCC", it regains smart functionality with all suppliers.',
  },
  {
    term: 'SVT',
    definition: 'Standard Variable Tariff — the default electricity and gas tariff. Ofgem sets a price cap each quarter that limits the maximum unit rate and standing charge on the SVT. Used as a reference benchmark: e.g. Tracker rates are capped at 100% above the SVT cap.',
  },
  {
    term: 'Standing charge',
    definition: 'A fixed daily charge (in pence per day) for being connected to the energy network, regardless of how much energy is used. Covers network maintenance and metering costs. Shown separately from unit rates on all tariffs.',
  },
  {
    term: 'Unit rate',
    definition: 'The price charged per kilowatt-hour (kWh) of energy consumed or exported. Quoted in pence per kWh (p/kWh), inclusive of 5% VAT for domestic tariffs.',
  },
  {
    term: 'p/kWh',
    definition: 'Pence per kilowatt-hour — the standard unit for electricity and gas pricing in the UK. 100p = £1. A typical household uses around 3,000–4,000 kWh of electricity and 12,000 kWh of gas per year.',
  },
  {
    term: 'VAT',
    definition: 'Value Added Tax — applied at 5% on domestic energy in the UK (reduced from the standard 20% rate). All published Octopus tariff rates are quoted inclusive of 5% VAT unless explicitly stated otherwise.',
  },
  {
    term: 'Direct Debit (DD)',
    definition: 'The payment method required for most Octopus smart tariffs. Bills are calculated from actual smart meter readings each month. Direct debit ensures automatic payment on the due date.',
  },
  {
    term: 'ToU',
    definition: 'Time of Use — a tariff structure where energy prices vary depending on the time of day. Examples: Flux (3 fixed ToU bands), Agile (48 half-hourly market-rate bands), IO Go (off-peak vs standard).',
  },
  {
    term: 'Export tariff',
    definition: 'A tariff for energy sent back to the national grid from solar panels or batteries. Customers earn a rate (in p/kWh) for each unit exported. Examples: Agile Outgoing (half-hourly variable), Outgoing Octopus (fixed), Flux (bundled).',
  },
  {
    term: 'SEG',
    definition: 'Smart Export Guarantee — an Ofgem-mandated scheme requiring larger suppliers to offer a minimum export payment rate to solar customers. The minimum rate is set above zero but is typically lower than the rates Octopus offers on its export tariffs.',
  },
  {
    term: 'Agile',
    definition: 'Short for Agile Octopus — a half-hourly variable electricity tariff where prices change every 30 minutes and track the wholesale electricity market. Not to be confused with "Agile" software methodology.',
  },
  {
    term: 'SILVER-',
    definition: 'The product code prefix for the Octopus Tracker tariff (e.g. SILVER-26-04-01). Tracker products are unlisted in the Octopus public API product catalogue and must be accessed by directly probing known product codes. Do NOT search for a "TRACKER-" prefix — it does not exist.',
  },
  {
    term: 'IO Go',
    definition: 'Short for Intelligent Octopus Go — a smart EV charging tariff with a fixed low off-peak rate (11:30pm–5:30am) and automated smart scheduling via the customer\'s EV or charger API. Requires a compatible EV or charger.',
  },
  {
    term: 'Kraken',
    definition: 'Octopus Energy\'s internal customer and billing platform. All customer account management, tariff assignments, and device integrations are managed through Kraken. The Kraken GraphQL API is used for account-level operations (not needed in this portal).',
  },
  {
    term: 'Ofgem',
    definition: 'Office of Gas and Electricity Markets — the independent energy market regulator for Great Britain (excluding Northern Ireland, which has the Utility Regulator). Ofgem sets the SVT price cap, the SEG minimum rate, and oversees the licensing of energy suppliers.',
  },
  {
    term: 'Price cap',
    definition: 'The maximum unit rate and standing charge that energy suppliers can charge on default SVT tariffs, set quarterly by Ofgem. Tracker tariffs are capped at 100% above the SVT price cap for that quarter.',
  },
  {
    term: 'Economy 7',
    definition: 'A legacy two-rate electricity tariff with cheaper overnight rates (7 hours). Economy 7 meters have two registers and are NOT compatible with Agile Octopus (which requires a single-register meter for half-hourly billing).',
  },
  {
    term: 'Period_from / Period_to',
    definition: 'ISO 8601 datetime parameters used in Octopus API rate queries to specify the time window for which rates are requested. Must be formatted as YYYY-MM-DDTHH:MM:SSZ (UTC). Used in both Agile and Tracker rate endpoints.',
  },
];

export default function Terminology() {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? TERMS.filter(t =>
        t.term.toLowerCase().includes(filter.toLowerCase()) ||
        t.definition.toLowerCase().includes(filter.toLowerCase())
      )
    : TERMS;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">Terminology</h1>
        <p className="mt-3 text-gray-300">
          Definitions for energy industry terms, Octopus-specific concepts, and technical jargon used in the Smart Products Specialism team.
        </p>
      </header>

      {/* Filter input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter terms... (e.g. MPAN, GSP, Agile)"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-white/10 text-white placeholder-gray-400 rounded-xl px-4 py-3 border border-white/20 focus:outline-none focus:border-pink-500 text-sm"
        />
        {filter && (
          <p className="text-xs text-gray-300 mt-1.5">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{filter}"
          </p>
        )}
      </div>

      {/* Terms list */}
      <dl className="space-y-4">
        {filtered.length === 0 && (
          <p className="text-gray-300 text-center py-8">No terms match "{filter}"</p>
        )}
        {filtered.map(item => (
          <div key={item.term} className="octopus-card-bg rounded-xl p-4">
            <dt className="text-pink-400 font-bold text-base font-mono mb-1">{item.term}</dt>
            <dd className="text-gray-300 text-sm leading-relaxed">{item.definition}</dd>
          </div>
        ))}
      </dl>

    </main>
  );
}

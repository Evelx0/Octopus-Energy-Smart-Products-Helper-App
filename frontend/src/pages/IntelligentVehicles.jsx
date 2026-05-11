import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

// ─── Tier config ──────────────────────────────────────────────────────────────
const TIER = {
  full: {
    label:  'Compatible',
    icon:   '✅',
    color:  'text-teal-300',
    bg:     'bg-teal-900/30',
    border: 'border-teal-600/40',
    staffTip: 'Recommend confidently — customer can sign up directly.',
  },
  charger: {
    label:  'Via approved charger',
    icon:   '⚡',
    color:  'text-blue-300',
    bg:     'bg-blue-900/30',
    border: 'border-blue-600/40',
    staffTip: 'Works for smart overnight scheduling with an IO Go approved charger. May not sync SoC or departure time automatically.',
  },
  check: {
    label:  'Verify first',
    icon:   '🔎',
    color:  'text-yellow-300',
    bg:     'bg-yellow-900/30',
    border: 'border-yellow-600/40',
    staffTip: 'Direct customer to octopus.energy to confirm their specific model year.',
  },
};

// ─── Vehicle data ─────────────────────────────────────────────────────────────
// Source: Octopus Energy official IO Go communications + known integrations (April 2026).
// Update this list when Octopus adds new supported vehicles.
// tier: 'full' = confirmed IO Go API integration | 'charger' = OCPP smart scheduling | 'check' = verify
const VEHICLES = [
  // ── Volkswagen Group ─────────────────────────────────────────────────────────
  // Full integration via VW We Connect API
  { make: 'Volkswagen', model: 'ID.3',           years: '2020+', tier: 'full',    notes: 'Full IO Go integration via We Connect. Automatic SoC and departure time sync with Octopus app.' },
  { make: 'Volkswagen', model: 'ID.4',           years: '2021+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'Volkswagen', model: 'ID.5',           years: '2022+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'Volkswagen', model: 'ID.7',           years: '2023+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'Volkswagen', model: 'ID. Buzz',       years: '2022+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'CUPRA',      model: 'Born',           years: '2021+', tier: 'full',    notes: 'Full IO Go integration via We Connect (shared VW Group platform).' },
  { make: 'SKODA',      model: 'Enyaq iV',       years: '2021+', tier: 'full',    notes: 'Full IO Go integration via We Connect (shared VW Group platform).' },
  { make: 'SKODA',      model: 'Enyaq Coupé iV', years: '2022+', tier: 'full',    notes: 'Full IO Go integration via We Connect (shared VW Group platform).' },
  { make: 'Audi',       model: 'Q4 e-tron',      years: '2021+', tier: 'full',    notes: 'Full IO Go integration via We Connect (shared VW Group platform).' },
  { make: 'Audi',       model: 'Q4 Sportback e-tron', years: '2021+', tier: 'full', notes: 'Full IO Go integration via We Connect.' },
  { make: 'Audi',       model: 'Q8 e-tron',      years: '2023+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'Audi',       model: 'Q8 Sportback e-tron', years: '2023+', tier: 'full', notes: 'Full IO Go integration via We Connect.' },
  { make: 'Audi',       model: 'e-tron GT',       years: '2021+', tier: 'full',    notes: 'Full IO Go integration via We Connect.' },
  { make: 'Porsche',    model: 'Taycan',          years: '2019+', tier: 'full',    notes: 'Full IO Go integration via My Porsche / We Connect (shared VW Group platform).' },
  { make: 'Porsche',    model: 'Taycan Sport Turismo', years: '2021+', tier: 'full', notes: 'Full IO Go integration via My Porsche.' },
  { make: 'Porsche',    model: 'Taycan Cross Turismo', years: '2021+', tier: 'full', notes: 'Full IO Go integration via My Porsche.' },

  // ── Tesla ────────────────────────────────────────────────────────────────────
  // Integration via Tesla API (separate to OCPP charger)
  { make: 'Tesla', model: 'Model 3', years: '2019+', tier: 'full', notes: 'Requires Tesla account linked in the Octopus app. Compatible with all IO Go approved OCPP chargers.' },
  { make: 'Tesla', model: 'Model Y', years: '2020+', tier: 'full', notes: 'Requires Tesla account linked in the Octopus app. Compatible with all IO Go approved OCPP chargers.' },
  { make: 'Tesla', model: 'Model S', years: '2021+', tier: 'full', notes: 'Requires Tesla account linked in the Octopus app. Post-refresh models (2021+) confirmed.' },
  { make: 'Tesla', model: 'Model X', years: '2021+', tier: 'full', notes: 'Requires Tesla account linked in the Octopus app. Post-refresh models (2021+) confirmed.' },

  // ── BMW Group ────────────────────────────────────────────────────────────────
  // Integration via BMW ConnectedDrive API
  { make: 'BMW', model: 'i4',    years: '2022+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'i5',    years: '2024+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'i7',    years: '2023+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'iX',    years: '2022+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'iX1',   years: '2023+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'iX2',   years: '2024+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'BMW', model: 'iX3',   years: '2021+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'MINI', model: 'Electric (Cooper SE)', years: '2020+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API (shared platform).' },
  { make: 'MINI', model: 'Aceman E',             years: '2024+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },
  { make: 'MINI', model: 'Countryman E',         years: '2024+', tier: 'full', notes: 'Full IO Go integration via BMW ConnectedDrive API.' },

  // ── Polestar / Volvo ─────────────────────────────────────────────────────────
  { make: 'Polestar', model: '2',  years: '2021+', tier: 'full', notes: 'Full IO Go integration via Polestar API.' },
  { make: 'Polestar', model: '3',  years: '2023+', tier: 'full', notes: 'Full IO Go integration via Polestar API.' },
  { make: 'Polestar', model: '4',  years: '2024+', tier: 'full', notes: 'Full IO Go integration via Polestar API.' },
  { make: 'Volvo',    model: 'EX30', years: '2024+', tier: 'full', notes: 'Full IO Go integration via Volvo Cars API (shared Geely platform with Polestar).' },
  { make: 'Volvo',    model: 'EX40', years: '2020+', tier: 'full', notes: 'Full IO Go integration via Volvo Cars API. Previously named XC40 Recharge.' },
  { make: 'Volvo',    model: 'EC40', years: '2021+', tier: 'full', notes: 'Full IO Go integration via Volvo Cars API. Previously named C40 Recharge.' },
  { make: 'Volvo',    model: 'EX90', years: '2024+', tier: 'full', notes: 'Full IO Go integration via Volvo Cars API.' },

  // ── Mercedes-Benz ────────────────────────────────────────────────────────────
  // Integration via Mercedes me API
  { make: 'Mercedes-Benz', model: 'EQA',     years: '2021+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQB',     years: '2022+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQC',     years: '2020+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQE',     years: '2022+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQE SUV', years: '2023+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQS',     years: '2022+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },
  { make: 'Mercedes-Benz', model: 'EQS SUV', years: '2023+', tier: 'full', notes: 'Full IO Go integration via Mercedes me API.' },

  // ── Hyundai / Kia ────────────────────────────────────────────────────────────
  // Integration via Bluelink (Hyundai) and Kia Connect APIs
  { make: 'Hyundai', model: 'IONIQ 5', years: '2021+', tier: 'full', notes: 'Full IO Go integration via Hyundai Bluelink API.' },
  { make: 'Hyundai', model: 'IONIQ 6', years: '2023+', tier: 'full', notes: 'Full IO Go integration via Hyundai Bluelink API.' },
  { make: 'Kia',     model: 'EV6',     years: '2022+', tier: 'full', notes: 'Full IO Go integration via Kia Connect API.' },
  { make: 'Kia',     model: 'EV9',     years: '2023+', tier: 'full', notes: 'Full IO Go integration via Kia Connect API.' },

  // ── Renault ──────────────────────────────────────────────────────────────────
  { make: 'Renault', model: 'Megane E-Tech Electric', years: '2022+', tier: 'full',    notes: 'Full IO Go integration via My Renault API.' },
  { make: 'Renault', model: 'Scenic E-Tech',          years: '2024+', tier: 'full',    notes: 'Full IO Go integration via My Renault API.' },
  { make: 'Renault', model: 'Renault 5 E-Tech',       years: '2024+', tier: 'charger', notes: 'Smart scheduling via OCPP charger. Full API integration not yet confirmed.' },

  // ── Via charger tier — smart scheduling via OCPP, no car-API integration ─────
  { make: 'MG',      model: 'MG4',         years: '2022+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger. No direct car-API integration.' },
  { make: 'MG',      model: 'ZS EV',       years: '2020+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'MG',      model: 'MG5',         years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Nissan',  model: 'Ariya',       years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Vauxhall', model: 'Corsa Electric', years: '2020+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Vauxhall', model: 'Astra Electric', years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Vauxhall', model: 'Mokka Electric', years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Peugeot', model: 'e-208',       years: '2020+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Peugeot', model: 'e-2008',      years: '2020+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Peugeot', model: 'e-308',       years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Peugeot', model: 'e-3008',      years: '2024+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Citroën', model: 'ë-C4',        years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Citroën', model: 'ë-C5 Aircross', years: '2024+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'DS',      model: 'DS3 E-TENSE', years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger (Stellantis platform).' },
  { make: 'Ford',    model: 'Mustang Mach-E', years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Fiat',    model: '500e',         years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'BYD',     model: 'Atto 3',       years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'BYD',     model: 'Seal',         years: '2024+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'BYD',     model: 'Dolphin',      years: '2024+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Smart',   model: '#1',            years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Smart',   model: '#3',            years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Ora',     model: 'Funky Cat',    years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Jaguar',  model: 'I-PACE',       years: '2019+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger. No Jaguar API integration for IO Go.' },
  { make: 'Honda',   model: 'e Advance',    years: '2020+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Mazda',   model: 'MX-30',        years: '2021+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Toyota',  model: 'bZ4X',         years: '2022+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger.' },
  { make: 'Subaru',  model: 'Solterra',     years: '2023+', tier: 'charger', notes: 'Smart scheduling via IO Go approved OCPP charger (shares platform with Toyota bZ4X).' },

  // ── Verify first ─────────────────────────────────────────────────────────────
  { make: 'Nissan', model: 'Leaf',          years: '2013–2022', tier: 'check', notes: 'Uses CHAdeMO DC port (not CCS2). May work with specific chargers — check with Octopus. Leaf e+ has higher chance of compatibility.' },
  { make: 'Renault', model: 'Zoe',          years: '2013–2021', tier: 'check', notes: 'Older CCS/Type 2 only — no car API integration. Check with Octopus for specific year.' },
  { make: 'BMW',    model: 'i3',            years: '2013–2022', tier: 'check', notes: 'Older model, ConnectedDrive API may not be supported. Verify with Octopus.' },
  { make: 'Volkswagen', model: 'e-Golf',    years: '2014–2020', tier: 'check', notes: 'Pre-ID platform — no We Connect integration. Check with Octopus for charger-only compatibility.' },
  { make: 'Volkswagen', model: 'e-Up!',     years: '2014–2021', tier: 'check', notes: 'Pre-ID platform — no We Connect integration. Check with Octopus.' },
  { make: 'Hyundai', model: 'Kona Electric', years: '2018–2022', tier: 'check', notes: 'Earlier Bluelink app versions may not support IO Go integration. Verify model year.' },
  { make: 'Kia',    model: 'e-Niro',        years: '2019–2022', tier: 'check', notes: 'Kia Connect integration uncertain on earlier models. Verify with Octopus.' },
];

// ─── Derive unique makes for filter pills ─────────────────────────────────────
const ALL_MAKES = [...new Set(VEHICLES.map(v => v.make))].sort();

// ─── Component ────────────────────────────────────────────────────────────────
export default function IntelligentVehicles() {
  const [search,     setSearch]     = useState('');
  const [activeMake, setActiveMake] = useState('');

  const q = search.trim().toLowerCase();

  const results = useMemo(() => VEHICLES.filter(v => {
    const matchesSearch = !q ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.notes.toLowerCase().includes(q);
    const matchesMake = !activeMake || v.make === activeMake;
    return matchesSearch && matchesMake;
  }), [q, activeMake]);

  // Group results by tier for a structured display
  const fullList    = results.filter(v => v.tier === 'full');
  const chargerList = results.filter(v => v.tier === 'charger');
  const checkList   = results.filter(v => v.tier === 'check');

  const totalResults = results.length;
  const isFiltered   = q || activeMake;

  function handleMakePill(make) {
    setActiveMake(prev => prev === make ? '' : make);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">
          Intelligent Octopus Go
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Vehicle Checker</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Check if a customer's EV is compatible with Intelligent Octopus Go.
        </p>
        <Link
          to="/tariffs/intelligent"
          className="text-sm text-gray-400 hover:text-gray-300 underline mt-3 inline-block"
        >
          ← Back to Intelligent Octopus Go reference
        </Link>
      </header>

      {/* ── Tier legend ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {Object.entries(TIER).map(([key, t]) => (
          <div key={key} className={`${t.bg} border ${t.border} rounded-xl p-3`}>
            <p className={`font-semibold text-sm ${t.color} mb-1`}>{t.icon} {t.label}</p>
            <p className="text-gray-400 text-xs leading-relaxed">{t.staffTip}</p>
          </div>
        ))}
      </div>

      {/* ── Search box ───────────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by make or model (e.g. Tesla, ID.3, IONIQ 5, Polestar)…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          autoFocus
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Make filter pills ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveMake('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            !activeMake ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          All makes
        </button>
        {ALL_MAKES.map(make => (
          <button
            key={make}
            onClick={() => handleMakePill(make)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeMake === make ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {make}
          </button>
        ))}
      </div>

      {/* ── Result count ─────────────────────────────────────────────────────── */}
      {isFiltered && (
        <p className="text-sm text-gray-400 mb-5">
          {totalResults === 0
            ? 'No vehicles found'
            : <>{totalResults} vehicle{totalResults !== 1 ? 's' : ''}{q ? <> matching <span className="text-white font-mono">"{search}"</span></> : ''}{activeMake ? <> in <span className="text-white">{activeMake}</span></> : ''}</>
          }
        </p>
      )}

      {/* ── No results ───────────────────────────────────────────────────────── */}
      {isFiltered && totalResults === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔎</p>
          <p className="font-medium text-gray-300 mb-1">Car not found in our list</p>
          <p className="text-gray-400 text-sm mb-4">
            This doesn't mean it's incompatible — the list may not yet include it.
          </p>
          <a
            href="https://octopus.energy/smart/intelligent-octopus-go/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-pink-400 hover:underline"
          >
            Check on octopus.energy →
          </a>
        </div>
      )}

      {/* ── Results by tier ──────────────────────────────────────────────────── */}
      {totalResults > 0 && (
        <div className="space-y-8">
          <VehicleSection tier="full"    vehicles={fullList}    />
          <VehicleSection tier="charger" vehicles={chargerList} />
          <VehicleSection tier="check"   vehicles={checkList}   />
        </div>
      )}

      {/* ── Footer disclaimer ────────────────────────────────────────────────── */}
      {!isFiltered && (
        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-gray-400 text-xs">
            {VEHICLES.length} vehicles listed · Last updated April 2026
          </p>
          <p className="text-gray-600 text-xs mt-1">
            This list is accurate as of 18 April 2026 and may have changed — always double-check with Octopus support or the customer's account for the very latest compatibility.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: vehicle section per tier ──────────────────────────────────
function VehicleSection({ tier, vehicles }) {
  if (vehicles.length === 0) return null;
  const t = TIER[tier];

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{t.icon}</span>
        <h2 className={`text-sm font-bold uppercase tracking-wider ${t.color}`}>
          {t.label}
        </h2>
        <span className="text-gray-600 text-xs">({vehicles.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vehicles.map(v => (
          <VehicleCard key={`${v.make}-${v.model}`} vehicle={v} tier={tier} />
        ))}
      </div>
    </section>
  );
}

// ─── Sub-component: individual vehicle card ───────────────────────────────────
function VehicleCard({ vehicle: v, tier }) {
  const t = TIER[tier];
  return (
    <div className={`octopus-card-bg rounded-xl p-4 border ${t.border}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{v.make}</p>
          <p className="text-gray-300 text-sm leading-tight">{v.model}</p>
        </div>
        <span className={`text-xs font-mono shrink-0 ${t.bg} ${t.color} border ${t.border} px-2 py-0.5 rounded-full`}>
          {v.years}
        </span>
      </div>
      <p className="text-gray-400 text-xs leading-relaxed mt-2">{v.notes}</p>
    </div>
  );
}

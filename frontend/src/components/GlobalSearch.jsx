// Global search modal — opened via Cmd+K / Ctrl+K from anywhere in the app.
// Uses Fuse.js for fuzzy matching across routes, tariff tabs, and terminology.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';

// ─── Search index ─────────────────────────────────────────────────────────────
// Each entry: { id, title, category, text, route, tab? }
const SEARCH_INDEX = [
  // ── Top-level nav ──
  { id: 'home',          title: 'Home',                       category: 'Page',      text: 'portal home live rates overview',                       route: '/' },
  { id: 'agile-tracker', title: 'Agile Price Tracker',        category: 'Tracker',   text: 'agile live prices half-hourly rates today chart',       route: '/agile-tracker' },
  { id: 'tracker-track', title: 'Tracker Price Tracker',      category: 'Tracker',   text: 'tracker live prices daily rates gas electricity SILVER', route: '/tracker-prices' },
  { id: 'region-lookup', title: 'Postcode → Region Lookup',   category: 'Tools',     text: 'postcode GSP DNO region letter lookup',                  route: '/region-lookup' },
  { id: 'bill-calc',     title: 'Bill Simulator',             category: 'Tools',     text: 'bill cost estimate monthly annual kWh simulate tariff compare', route: '/bill-calculator' },
  { id: 'tariff-comp',   title: 'Compare All Tariffs',        category: 'Reference', text: 'tariff comparison side by side agile tracker flux cosy io go', route: '/tariffs/comparison' },
  { id: 'eligibility',   title: 'Tariff Eligibility Checker', category: 'Tools',     text: 'eligibility check smart meter SMETS2 EV solar battery decision tree', route: '/eligibility' },
  { id: 'terminology',   title: 'Terminology Glossary',       category: 'Reference', text: 'terms glossary MPAN GSP DNO SVT SMETS2 HH metering',    route: '/terminology' },
  { id: 'ocpp-diag',     title: 'IO Go OCPP Diagnostics',     category: 'IO Go',     text: 'OCPP diagnostics error codes charger 1.6 2.0.1 2.1 decoder', route: '/tariffs/intelligent-ocpp' },
  { id: 'vehicles',      title: 'IO Go Vehicle Checker',      category: 'IO Go',     text: 'EV compatible vehicle Tesla Ford Hyundai Kia charger IO Go', route: '/tariffs/intelligent-vehicles' },
  { id: 'onboarding',    title: 'IO Go Onboarding Guide',     category: 'IO Go',     text: 'IO Go onboarding setup steps EV Tesla Ford charger API link', route: '/tariffs/intelligent-onboarding' },

  // ── Agile reference tabs ──
  { id: 'agile-overview',    title: 'Agile — Overview',          category: 'Agile',   text: 'agile octopus tariff overview half-hourly rates 48 slots',     route: '/tariffs/agile', tab: 'overview' },
  { id: 'agile-talking',     title: 'Agile — Talking Points',    category: 'Agile',   text: 'agile customer talking points benefits flexible negative prices', route: '/tariffs/agile', tab: 'talking-points' },
  { id: 'agile-rate',        title: 'Agile — Rate Structure',    category: 'Agile',   text: 'agile rate structure unit rate standing charge cap 100p',        route: '/tariffs/agile', tab: 'rate-structure' },
  { id: 'agile-reqs',        title: 'Agile — Requirements',      category: 'Agile',   text: 'agile smart meter SMETS2 economy 7 incompatible',               route: '/tariffs/agile', tab: 'requirements' },
  { id: 'agile-elig',        title: 'Agile — Eligibility',       category: 'Agile',   text: 'agile eligibility no prepayment not economy 7',                  route: '/tariffs/agile', tab: 'eligibility' },
  { id: 'agile-pros',        title: 'Agile — Pros & Cons',       category: 'Agile',   text: 'agile advantages disadvantages pros cons predictability',         route: '/tariffs/agile', tab: 'pros-cons' },
  { id: 'agile-faq',         title: 'Agile — FAQ',               category: 'Agile',   text: 'agile frequently asked questions negative prices product code',   route: '/tariffs/agile', tab: 'faq' },
  { id: 'agile-obj',         title: 'Agile — Objections',        category: 'Agile',   text: 'agile objection handling scripts spike concerns unpredictable',   route: '/tariffs/agile', tab: 'objections' },
  { id: 'agile-quiz',        title: 'Agile — Knowledge Check',   category: 'Agile',   text: 'agile quiz knowledge self assessment test',                       route: '/tariffs/agile', tab: 'knowledge-check' },

  // ── Tracker reference tabs ──
  { id: 'tracker-overview',  title: 'Tracker — Overview',        category: 'Tracker', text: 'octopus tracker tariff daily variable both fuels gas electricity', route: '/tariffs/tracker', tab: 'overview' },
  { id: 'tracker-talking',   title: 'Tracker — Talking Points',  category: 'Tracker', text: 'tracker customer talking points transparency wholesale rate cap',  route: '/tariffs/tracker', tab: 'talking-points' },
  { id: 'tracker-rate',      title: 'Tracker — Rate Structure',  category: 'Tracker', text: 'tracker unit rate standing charge SILVER- product code',           route: '/tariffs/tracker', tab: 'rate-structure' },
  { id: 'tracker-faq',       title: 'Tracker — FAQ',             category: 'Tracker', text: 'tracker SILVER- product code announced 9pm 11pm rate cap',         route: '/tariffs/tracker', tab: 'faq' },
  { id: 'tracker-obj',       title: 'Tracker — Objections',      category: 'Tracker', text: 'tracker objection winter spike gas prices concern',                route: '/tariffs/tracker', tab: 'objections' },
  { id: 'tracker-quiz',      title: 'Tracker — Knowledge Check', category: 'Tracker', text: 'tracker quiz knowledge self assessment test',                      route: '/tariffs/tracker', tab: 'knowledge-check' },

  // ── IO Go reference tabs ──
  { id: 'iogo-overview',     title: 'IO Go — Overview',          category: 'IO Go',   text: 'intelligent octopus go EV charging tariff off-peak 11:30 5:30',  route: '/tariffs/intelligent', tab: 'overview' },
  { id: 'iogo-charging',     title: 'IO Go — Smart Charging',    category: 'IO Go',   text: 'smart charging dispatch 6 hour limit Charge Cap boost rate',      route: '/tariffs/intelligent', tab: 'smart-charging' },
  { id: 'iogo-reqs',         title: 'IO Go — Requirements',      category: 'IO Go',   text: 'IO Go requirements SMETS2 compatible EV charger Ohme Zappi',      route: '/tariffs/intelligent', tab: 'requirements' },
  { id: 'iogo-elig',         title: 'IO Go — Eligibility',       category: 'IO Go',   text: 'IO Go eligibility smart meter SMETS2 EV API',                     route: '/tariffs/intelligent', tab: 'eligibility' },
  { id: 'iogo-faq',          title: 'IO Go — FAQ',               category: 'IO Go',   text: 'IO Go FAQ car not charged 6 hour boost departure time',            route: '/tariffs/intelligent', tab: 'faq' },
  { id: 'iogo-live',         title: 'IO Go — Live Charging Context', category: 'IO Go', text: 'IO Go live charging carbon intensity dispatch timeline diagnostic', route: '/tariffs/intelligent', tab: 'charging-live' },
  { id: 'iogo-obj',          title: 'IO Go — Objections',        category: 'IO Go',   text: 'IO Go objection car not charged compatibility authentication',     route: '/tariffs/intelligent', tab: 'objections' },
  { id: 'iogo-quiz',         title: 'IO Go — Knowledge Check',   category: 'IO Go',   text: 'IO Go quiz knowledge self assessment test',                        route: '/tariffs/intelligent', tab: 'knowledge-check' },

  // ── Flux reference tabs ──
  { id: 'flux-overview',     title: 'Flux — Overview',           category: 'Flux',    text: 'octopus flux solar battery import export time of use ToU',        route: '/tariffs/flux', tab: 'overview' },
  { id: 'flux-bands',        title: 'Flux — Time-of-Use Bands',  category: 'Flux',    text: 'flux off-peak 02:00 standard peak 16:00 19:00 4pm 7pm',           route: '/tariffs/flux', tab: 'time-bands' },
  { id: 'flux-reqs',         title: 'Flux — Requirements',       category: 'Flux',    text: 'flux requirements solar battery SMETS2 export MPAN',              route: '/tariffs/flux', tab: 'requirements' },
  { id: 'flux-obj',          title: 'Flux — Objections',         category: 'Flux',    text: 'flux objection peak rate expensive solar only battery inverter',   route: '/tariffs/flux', tab: 'objections' },
  { id: 'flux-quiz',         title: 'Flux — Knowledge Check',    category: 'Flux',    text: 'flux quiz knowledge self assessment test',                         route: '/tariffs/flux', tab: 'knowledge-check' },

  // ── Cosy reference tabs ──
  { id: 'cosy-overview',     title: 'Cosy — Overview',           category: 'Cosy',    text: 'cosy octopus heat pump electric heating triple dip cheap windows', route: '/tariffs/cosy', tab: 'overview' },
  { id: 'cosy-bands',        title: 'Cosy — Time-of-Use Bands',  category: 'Cosy',    text: 'cosy ToU super cheap 04:00 07:00 13:00 16:00 22:00 peak',         route: '/tariffs/cosy', tab: 'tou-bands' },
  { id: 'cosy-hp',           title: 'Cosy — Heat Pump Guide',    category: 'Cosy',    text: 'cosy heat pump schedule pre-heat setback temperature guide',       route: '/tariffs/cosy', tab: 'heat-pump' },
  { id: 'cosy-obj',          title: 'Cosy — Objections',         category: 'Cosy',    text: 'cosy objection heat pump running peak house cold',                 route: '/tariffs/cosy', tab: 'objections' },
  { id: 'cosy-quiz',         title: 'Cosy — Knowledge Check',    category: 'Cosy',    text: 'cosy quiz knowledge self assessment test',                         route: '/tariffs/cosy', tab: 'knowledge-check' },

  // ── Outgoing Rate Tracker ──
  { id: 'outgoing-tracker', title: 'Outgoing Rate Tracker',      category: 'Outgoing', text: 'outgoing octopus solar export rate tracker live kWh SEG', route: '/tariffs/outgoing' },
  { id: 'outgoing-live',    title: 'Outgoing — Live Export Rate', category: 'Outgoing', text: 'outgoing live export rate per kWh standing charge product code region', route: '/tariffs/outgoing', tab: 'live' },
  { id: 'outgoing-about',   title: 'Outgoing — About',           category: 'Outgoing', text: 'outgoing octopus about eligibility solar export meter quarterly payment SEG', route: '/tariffs/outgoing', tab: 'about' },
  { id: 'outgoing-faq',     title: 'Outgoing — FAQ',             category: 'Outgoing', text: 'outgoing FAQ io go compatibility SEG minimum payment date flux incompatible', route: '/tariffs/outgoing', tab: 'faq' },

  // ── Key terminology (subset for quick look-up) ──
  { id: 'term-mpan',    title: 'Term: MPAN',           category: 'Terminology', text: 'MPAN meter point administration number electricity 13 digit',   route: '/terminology' },
  { id: 'term-mprn',    title: 'Term: MPRN',           category: 'Terminology', text: 'MPRN meter point reference number gas 10 digit',               route: '/terminology' },
  { id: 'term-gsp',     title: 'Term: GSP / Region',   category: 'Terminology', text: 'GSP grid supply point region letter A to P DNO',               route: '/terminology' },
  { id: 'term-smets2',  title: 'Term: SMETS2',         category: 'Terminology', text: 'SMETS2 smart meter second generation DCC mandatory agile flux', route: '/terminology' },
  { id: 'term-svt',     title: 'Term: SVT / Price Cap',category: 'Terminology', text: 'SVT standard variable tariff ofgem price cap quarterly',       route: '/terminology' },
  { id: 'term-hh',      title: 'Term: HH Metering',    category: 'Terminology', text: 'half hourly HH metering smart meter 30 min agile',             route: '/terminology' },
  { id: 'term-seg',     title: 'Term: SEG',             category: 'Terminology', text: 'SEG smart export guarantee solar export minimum rate',         route: '/terminology' },
  { id: 'term-e7',      title: 'Term: Economy 7',       category: 'Terminology', text: 'economy 7 two register legacy meter not compatible agile',     route: '/terminology' },
  { id: 'term-silver',  title: 'Term: SILVER- prefix',  category: 'Terminology', text: 'SILVER tracker product code unlisted',                        route: '/terminology' },
  { id: 'term-tou',     title: 'Term: ToU',             category: 'Terminology', text: 'time of use ToU tariff cosy flux agile',                      route: '/terminology' },
  { id: 'term-dno',     title: 'Term: DNO',             category: 'Terminology', text: 'DNO distribution network operator region cable infrastructure',route: '/terminology' },
];

const CATEGORY_COLORS = {
  'Agile':      'text-teal-400 bg-teal-400/10',
  'Tracker':    'text-cyan-400 bg-cyan-400/10',
  'IO Go':      'text-green-400 bg-green-400/10',
  'Flux':       'text-blue-400 bg-blue-400/10',
  'Cosy':       'text-orange-400 bg-orange-400/10',
  'Outgoing':   'text-yellow-400 bg-yellow-400/10',
  'Tools':      'text-pink-400 bg-pink-400/10',
  'Terminology':'text-purple-400 bg-purple-400/10',
  'Reference':  'text-gray-400 bg-gray-400/10',
  'Page':       'text-gray-400 bg-gray-400/10',
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || 'text-gray-400 bg-gray-400/10';
}

const QUICK_ACCESS = [
  SEARCH_INDEX.find(e => e.id === 'eligibility'),
  SEARCH_INDEX.find(e => e.id === 'vehicles'),
  SEARCH_INDEX.find(e => e.id === 'agile-tracker'),
  SEARCH_INDEX.find(e => e.id === 'ocpp-diag'),
  SEARCH_INDEX.find(e => e.id === 'bill-calc'),
].filter(Boolean);

export default function GlobalSearch({ open, onClose }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [sel,     setSel]     = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const fuse = useMemo(() => new Fuse(SEARCH_INDEX, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'text',  weight: 1 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    includeScore: true,
  }), []);

  // Reset and focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Update results on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSel(0);
      return;
    }
    const hits = fuse.search(query).slice(0, 12);
    setResults(hits.map(h => h.item));
    setSel(0);
  }, [query, fuse]);

  function goTo(item) {
    onClose();
    navigate(item.route, item.tab ? { state: { tab: item.tab } } : undefined);
  }

  function handleKey(e) {
    const list = query.trim() ? results : QUICK_ACCESS;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, list.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); return; }
    if (e.key === 'Enter' && list[sel]) { goTo(list[sel]); return; }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-[#1e1740] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pages, tariffs, tabs, terms…"
            className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm outline-none"
          />
          <kbd className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 flex-shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-[50vh] overflow-y-auto py-2">
            {results.map((item, i) => (
              <li key={item.id}>
                <button
                  onClick={() => goTo(item)}
                  onMouseEnter={() => setSel(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === sel ? 'bg-white/8 bg-white/[0.08]' : 'hover:bg-white/5'}`}
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${categoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.title}</p>
                    {item.tab && (
                      <p className="text-gray-400 text-xs truncate">Opens on "{item.tab}" tab</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-600 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query.trim() && results.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No results for "<span className="text-gray-400">{query}</span>"
          </div>
        )}

        {/* Quick access (empty state) */}
        {!query && (
          <div className="px-4 py-4">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">Quick access</p>
            <div className="space-y-1">
              {QUICK_ACCESS.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => goTo(item)}
                  onMouseEnter={() => setSel(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    sel === i ? 'bg-white/[0.08]' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${categoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  <span className="text-gray-300">{item.title}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4 text-center">↑ ↓ navigate · Enter open · Esc close</p>
          </div>
        )}
      </div>
    </div>
  );
}

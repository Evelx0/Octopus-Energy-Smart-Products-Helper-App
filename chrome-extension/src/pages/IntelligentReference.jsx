// Static staff reference page for Intelligent Octopus Go.
// No API calls. All content is hardcoded for agent use.

import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';
import QuizPanel from '../components/ui/QuizPanel';
import CallScriptsPanel from '../components/CallScriptsPanel';
import PrintButton from '../components/PrintButton';
import { getRegionalCarbon, getNearbyChargers } from '../services/api';

const TABS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'smart-charging',  label: 'Smart Charging' },
  { id: 'requirements',    label: 'Requirements' },
  { id: 'talking-points',  label: 'Talking Points' },
  { id: 'eligibility',     label: 'Eligibility' },
  { id: 'pros-cons',       label: 'Pros & Cons' },
  { id: 'faq',             label: 'FAQ' },
  { id: 'charging-live',   label: 'Live Charging Context' },
  { id: 'objections',      label: 'Objections' },
  { id: 'knowledge-check', label: 'Knowledge Check' },
];

// 24-hour IO Go charging profile — each entry covers one hour
const IO_GO_HOUR_PROFILE = [
  // 00:00–01:00 off-peak (whole-home cheap window starts 23:30)
  'offpeak',
  // 01:00–04:30 typical dispatch window
  'dispatch','dispatch','dispatch','dispatch',
  // 04:30–05:30 guaranteed off-peak tail (off-peak ends 05:30)
  'offpeak',
  // 05:30–23:30 standard rate
  'standard','standard','standard','standard','standard','standard','standard','standard','standard','standard',
  'standard','standard','standard','standard','standard','standard','standard',
  // 23:00 off-peak starts (23:30 rounded to hour)
  'offpeak',
];

const HOUR_STYLE = {
  offpeak:  { bg: 'bg-teal-600',    label: 'Off-Peak',        text: 'text-teal-300' },
  dispatch: { bg: 'bg-teal-400',    label: 'Typical Dispatch', text: 'text-teal-200' },
  standard: { bg: 'bg-gray-600',    label: 'Standard Rate',    text: 'text-gray-300' },
  peak:     { bg: 'bg-amber-600',   label: 'Peak (avoid)',     text: 'text-amber-300' },
};

const CI_INDEX_COLOR = {
  'very low':   'text-green-400',
  'low':        'text-green-300',
  'moderate':   'text-amber-300',
  'high':       'text-orange-400',
  'very high':  'text-red-400',
};

const OBJECTIONS = [
  {
    objection: "My car didn't charge overnight — what happened?",
    response: "Work through these in order: (1) Was the car plugged in? (2) Was a departure time and target charge level set in the Octopus app or car app? (3) Has the 6-hour smart charging limit been hit (Charge Cap ON)? Check the charging history in the app. (4) Was the charger offline — check charger app/LED status. (5) Was the battery already at or above the target %? Smart charging won't charge a battery that's already full.",
    escalateIf: ["Car plugged in, target set, Charge Cap OFF, charger online — and still didn't charge. May need Octopus dispatch team investigation."],
  },
  {
    objection: "The 6-hour smart charging limit feels unfair for my large-battery EV.",
    response: "Around 80% of IO Go customers are unaffected — they already charge within 6 hours. For large-battery EVs (80–100kWh+) charging from near-empty, 6 hours may not always be enough. Advise: (1) Keep Charge Cap OFF if they need full charges — extra charging continues at Boost (standard) rate. (2) Charge more frequently rather than letting the battery drain fully. The limit applies to smart dispatch, not the whole off-peak window.",
    escalateIf: ["Customer regularly needs more than 6 hours and is incurring unexpected Boost rate charges — review their usage pattern"],
  },
  {
    objection: "I'm not sure my EV is compatible — the list seems limited.",
    response: "Direct them to the Vehicle Checker on this portal for the full compatibility list. If the car isn't listed with direct API integration, check if they have or can install a compatible smart charger (Ohme, Zappi/MyEnergi, Indra, Hypervolt, Pod Point). The charger-only path works for many vehicles that don't have direct API support — Octopus controls charging via the charger's OCPP connection.",
    escalateIf: ["Vehicle is older than 5 years with no API and no compatible smart charger available"],
  },
  {
    objection: "I charged at public chargers all week — will that affect my IO Go bill?",
    response: "No. IO Go billing is based on home consumption only. Public charging is through the charging network's own account — it doesn't appear on the Octopus bill at all. The off-peak rate and smart charging only apply to home charging via the customer's setup.",
    escalateIf: [],
  },
  {
    objection: "Why is the off-peak window fixed at 11:30pm–5:30am? Agile can be cheaper at other times.",
    response: "Fixed window provides certainty and automation simplicity. With IO Go, the customer sets their departure time once and Octopus handles everything — no need to track prices or manually schedule. Agile requires active engagement. For most EV owners, 11:30pm–5:30am is the ideal overnight charging window. The fixed rate is also more predictable than Agile's variable overnight slots.",
    escalateIf: [],
  },
  {
    objection: "My car shows 'authentication expired' in the Octopus app.",
    response: "Vehicle API tokens expire periodically — this is normal and happens with Tesla, Ford, and other brands. The customer needs to re-link their vehicle in the Octopus app under the EV/smart charging settings. Common triggers: password change, app update, account token refresh. Once re-linked, smart charging resumes automatically.",
    escalateIf: ["Re-linking has been attempted multiple times and still fails — may be an API issue on the vehicle manufacturer side"],
  },
];

const IO_GO_QUIZ = [
  {
    q: "A customer reports their car didn't charge overnight. List the FIRST three things to check.",
    options: [
      { text: "Battery manufacturer, charger brand, and meter type.", correct: false, explanation: "These aren't the diagnostic starting points. Check: (1) Was the car plugged in? (2) Was departure time/target set in the app? (3) Was Charge Cap ON and the 6-hour limit hit?" },
      { text: "Was the car plugged in? Was departure time/target % set? Was the 6-hour Charge Cap triggered?", correct: true, explanation: "The three most common causes of missed overnight charging: car not plugged in, no departure/target set in the Octopus app, or the Charge Cap limit was hit (if ON). After confirming these, check charger online status and whether the battery was already at target %." },
      { text: "Whether the customer is in arrears, whether the meter is SMETS1, and their standing charge.", correct: false, explanation: "Arrears and meter type don't typically prevent smart charging dispatch. The immediate diagnostics are: plugged in, app settings, Charge Cap status." },
      { text: "Carbon intensity at 2am, grid frequency, and dispatch window timing.", correct: false, explanation: "Carbon intensity and grid frequency aren't primary IO Go diagnostic checks. The basics (plugged in, app settings, cap) should be checked first." },
    ],
  },
  {
    q: "What smart meter type does IO Go REQUIRE?",
    options: [
      { text: "SMETS1 or SMETS2 — both are compatible.", correct: false, explanation: "IO Go requires SMETS2 specifically. SMETS1 meters communicate differently and aren't supported for the half-hourly reads needed for IO Go's smart charging billing." },
      { text: "Any smart meter, including prepayment.", correct: false, explanation: "IO Go requires SMETS2 and is not available to prepayment customers. General 'any smart meter' is incorrect." },
      { text: "SMETS2 only.", correct: true, explanation: "IO Go requires a SMETS2 smart meter — not SMETS1. SMETS2 meters communicate via the DCC network and support the accurate half-hourly reads needed for IO Go's smart charging integration." },
      { text: "No smart meter required — IO Go works with traditional meters.", correct: false, explanation: "A SMETS2 smart meter is a hard requirement for IO Go. Traditional meters cannot provide the half-hourly billing data needed." },
    ],
  },
  {
    q: "A vehicle is listed as 'via approved charger' in the IO Go vehicle checker. What does this mean for the customer?",
    options: [
      { text: "The vehicle is incompatible — recommend switching to Agile instead.", correct: false, explanation: "'Via approved charger' is NOT incompatible — it means the vehicle can join IO Go through a compatible smart charger (Ohme, Zappi, etc.) rather than a direct car API integration." },
      { text: "The vehicle works via a compatible smart charger (Ohme, Zappi, etc.) — no direct car API integration, but smart charging still works.", correct: true, explanation: "Many vehicles don't have direct Octopus API integration but can be controlled via an OCPP-compatible smart charger. Octopus sends dispatch commands to the charger rather than the car. Full smart charging functionality is available via this path." },
      { text: "The customer must buy a new Octopus-branded charger.", correct: false, explanation: "There's no Octopus-branded charger. Compatible options include Ohme, MyEnergi Zappi, Indra, Hypervolt, and Pod Point. The customer may already have a compatible charger." },
      { text: "Smart charging is unavailable — the customer can only use the off-peak window manually.", correct: false, explanation: "Smart charging IS available via the charger path. Octopus controls the charger remotely, which controls the vehicle's charging. The customer experience is the same as direct car API integration." },
    ],
  },
  {
    q: "What is the IO Go guaranteed off-peak window?",
    options: [
      { text: "00:00–06:00 (midnight to 6am).", correct: false, explanation: "The IO Go off-peak window is 11:30pm to 5:30am — not midnight to 6am. The 30-minute offset matters for customers scheduling appliances." },
      { text: "11:30pm to 5:30am — 6 guaranteed hours at the fixed off-peak rate.", correct: true, explanation: "The off-peak window runs 23:30–05:30 UK local time. ALL home electricity consumption during this window is billed at the fixed off-peak rate — not just EV charging. Washing machines, dishwashers, etc. all benefit." },
      { text: "10pm to 5am — 7 hours at the off-peak rate.", correct: false, explanation: "The window is 11:30pm–5:30am (6 hours), not 10pm–5am." },
      { text: "The window is variable — Octopus adjusts it based on grid conditions.", correct: false, explanation: "The off-peak window (23:30–05:30) is fixed and guaranteed. Smart dispatch happens within this window, but the cheap rate for all home consumption is always available across the full 6-hour period." },
    ],
  },
  {
    q: "From March 2026, what happens when an IO Go customer's EV needs more than 6 hours of smart charging?",
    options: [
      { text: "Charging stops completely at 6 hours regardless — the car won't charge further until the next night.", correct: false, explanation: "This depends on the Charge Cap toggle. With Charge Cap ON: charging stops at 6 hours. With Charge Cap OFF: charging continues at the Boost (standard day) rate." },
      { text: "With Charge Cap ON: charging stops at 6 hours. With Charge Cap OFF: charging continues at the Boost (standard) rate.", correct: true, explanation: "The March 2026 update introduced a 6-hour smart charging limit. Customers choose via the Charge Cap toggle: ON = stops at 6 hours (possible missed target, notification sent). OFF = continues at Boost rate until target is reached. ~80% of customers are unaffected." },
      { text: "The customer is automatically charged at double the off-peak rate for any extra hours.", correct: false, explanation: "Extra charging beyond 6 hours is at the standard Boost rate (normal day rate) — not double the off-peak rate." },
      { text: "The 6-hour limit doesn't exist — this is a customer misunderstanding.", correct: false, explanation: "The 6-hour smart charging limit is real and was introduced in March 2026. It applies to smart dispatch, not to the whole off-peak window's off-peak billing." },
    ],
  },
  {
    q: "Does Intelligent Octopus Go cover gas as well as electricity?",
    options: [
      { text: "Yes — IO Go is dual-fuel like Tracker.", correct: false, explanation: "IO Go is electricity-only. Customers need a separate gas tariff — standard variable, fixed, or Tracker." },
      { text: "Yes, but only if the customer signs up to dual-fuel billing.", correct: false, explanation: "IO Go has no dual-fuel option. It covers electricity only, regardless of billing setup." },
      { text: "No — IO Go is electricity-only. A separate gas tariff is required.", correct: true, explanation: "IO Go covers electricity only — including both the home's general electricity and the EV charging. Gas must be on a separate tariff (standard variable, fixed, or Tracker). This is worth confirming with customers during onboarding so there's no confusion when two separate bills arrive." },
      { text: "No, but Octopus will automatically add Tracker for gas when a customer joins IO Go.", correct: false, explanation: "Octopus doesn't automatically add Tracker for gas. The customer must separately choose and sign up for a gas tariff." },
    ],
  },
];

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/10 pt-3 mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between text-left text-gray-200 font-medium hover:text-white"
      >
        <span>{q}</span>
        <span className="ml-4 text-pink-400 text-xl leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-2 text-gray-300 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

export default function IntelligentReference() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.state?.tab && TABS.some(t => t.id === location.state.tab)
      ? location.state.tab
      : 'overview'
  );
  const [ciRegion,  setCiRegion]  = useState('H');
  const [ciData,    setCiData]    = useState(null);
  const [ciLoading, setCiLoading] = useState(false);
  const [ciError,   setCiError]   = useState(null);

  // Nearby charger state (isolated — only triggered by user action)
  const [chargerPostcode, setChargerPostcode] = useState('');
  const [chargerData,     setChargerData]     = useState(null);
  const [chargerLoading,  setChargerLoading]  = useState(false);
  const [chargerError,    setChargerError]    = useState(null);

  const fetchCi = useCallback(async () => {
    setCiLoading(true);
    setCiError(null);
    setCiData(null);
    try {
      const data = await getRegionalCarbon(ciRegion);
      setCiData(data);
    } catch (err) {
      setCiError(err.message || 'Failed to load regional carbon intensity data.');
    } finally {
      setCiLoading(false);
    }
  }, [ciRegion]);

  // Auto-fetch regional CI when user opens the charging-live tab, or when region changes
  useEffect(() => {
    if (activeTab === 'charging-live') {
      fetchCi();
    }
  }, [activeTab, ciRegion, fetchCi]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChargers = useCallback(async () => {
    const postcode = chargerPostcode.trim().toUpperCase();
    if (!postcode) return;
    const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    if (!UK_POSTCODE_RE.test(postcode)) {
      setChargerError('Please enter a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setChargerLoading(true);
    setChargerError(null);
    setChargerData(null);
    try {
      const data = await getNearbyChargers(postcode);
      setChargerData(data);
    } catch (err) {
      setChargerError(err.message || 'Could not find nearby chargers.');
    } finally {
      setChargerLoading(false);
    }
  }, [chargerPostcode]);

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tariff Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Intelligent Octopus Go</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Smart EV charging tariff. Fixed low off-peak rate (11:30pm–5:30am) with automatic smart scheduling. EV required.
        </p>
        <Link to="/tariffs/comparison" className="text-sm text-gray-300 hover:text-gray-300 underline mt-4 inline-block">
          → Compare all tariffs
        </Link>
      </header>

      <div className="print:hidden flex justify-end mb-4">
        <PrintButton />
      </div>

      <CallScriptsPanel tariff="intelligent" />

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {activeTab === 'overview' && (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">What It Is</h2>
            <p>Intelligent Octopus Go is a time-of-use electricity tariff designed for electric vehicle owners. It features a fixed off-peak rate from <strong className="text-white">11:30pm to 5:30am</strong> (currently ~8p/kWh — check current rate in the Octopus app) and a standard rate for all other times.</p>
            <p><strong className="text-white">Smart charging:</strong> Octopus integrates with the customer's EV or charger to schedule charging automatically in the cheapest part of the off-peak window. The customer sets their departure time and desired charge level — Octopus handles the rest.</p>
            <p><strong className="text-white">Billing:</strong> Monthly direct debit. Standard electricity rate applies to all home consumption outside the off-peak window — not just EV charging.</p>

            {/* March 2026 update callout */}
            <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-4 mt-4">
              <p className="text-amber-300 text-sm font-semibold mb-1">⚠️ March 2026 update — 6-hour smart charging limit</p>
              <p className="text-gray-300 text-sm leading-relaxed">
                IO Go now includes a <strong className="text-white">6-hour daily smart charging limit</strong>. Any charging beyond 6 hours per 24-hour period is billed at the <strong className="text-white">Boost rate</strong> (standard/peak pricing). A new <strong className="text-white">Charge Cap</strong> toggle in the Octopus app lets customers choose whether to stop at 6 hours or continue at Boost rate to hit their target. ~80% of existing customers are unaffected (they already charge under 6 hours). See the <strong className="text-white">Smart Charging tab</strong> for full details.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'smart-charging' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-4">How Smart Charging Works</h2>
              <ol className="space-y-3 text-gray-300 text-sm list-none">
                <li className="flex gap-3"><span className="text-teal-400 font-bold">1.</span><span>Customer plugs in their EV at home and sets a <strong className="text-white">departure time</strong> and <strong className="text-white">target charge level</strong> in the Octopus app (or the car/charger app if integrated).</span></li>
                <li className="flex gap-3"><span className="text-teal-400 font-bold">2.</span><span>Octopus schedules charging within the off-peak window (11:30pm–5:30am) to minimise cost, prioritising the cheapest slots first.</span></li>
                <li className="flex gap-3"><span className="text-teal-400 font-bold">3.</span><span>If the car won't reach target charge during off-peak hours alone, Octopus will <strong className="text-white">boost charge</strong> at standard rate before the departure time.</span></li>
                <li className="flex gap-3"><span className="text-teal-400 font-bold">4.</span><span>The customer can <strong className="text-white">override</strong> at any time — manually forcing a charge or pausing via the app or the car.</span></li>
                <li className="flex gap-3"><span className="text-teal-400 font-bold">5.</span><span>For eligible vehicles and areas, Octopus may also dispatch energy back during <strong className="text-white">Saving Sessions</strong> or peak grid events (Vehicle-to-Grid capable cars only).</span></li>
              </ol>
            </div>

            {/* March 2026 — 6-hour cap */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-base font-bold text-white mb-1">
                ⚠️ 6-Hour Smart Charging Limit <span className="text-xs font-normal text-amber-400 ml-2">Updated March 2026</span>
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                From March 2026, IO Go includes a <strong className="text-white">6-hour daily smart charging limit</strong>. Charging beyond 6 hours per day is billed at the <strong className="text-white">Boost rate</strong> (the standard day rate). The 6 guaranteed off-peak hours for the whole home (11:30pm–5:30am) are unaffected.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4">
                  <p className="text-teal-300 font-semibold mb-1">Under 6 hours <span className="text-xs font-normal">(~80% of customers)</span></p>
                  <p className="text-gray-300">No change. Smart charging scheduled as normal, all at off-peak rate.</p>
                </div>
                <div className="bg-amber-900/30 border border-amber-600/30 rounded-xl p-4">
                  <p className="text-amber-300 font-semibold mb-1">Charge Cap ON</p>
                  <p className="text-gray-300">Charging stops at 6 hours. Customer receives a notification if target % wasn't reached. No Boost rate charges.</p>
                </div>
                <div className="bg-red-900/30 border border-red-600/30 rounded-xl p-4">
                  <p className="text-red-300 font-semibold mb-1">Charge Cap OFF</p>
                  <p className="text-gray-300">Charging continues past 6 hours at the Boost (standard) rate until target % is reached.</p>
                </div>
              </div>
              <p className="text-gray-300 text-xs mt-3">The Charge Cap toggle is in the Octopus app under the EV/smart charging settings. Advise customers to configure this during onboarding.</p>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Requirements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-3">EV Requirements</p>
                <ul className="space-y-1.5 text-gray-300">
                  <li className="flex gap-2"><span className="text-white">→</span>Compatible EV required (major brands: Tesla, VW, Audi, Hyundai, Kia, BMW, Jaguar, Polestar, Renault, and more)</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Vehicle must have an internet-connected API (not all older models have this)</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Customer must connect their vehicle account in the Octopus app during sign-up</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-3">Charger / Meter</p>
                <ul className="space-y-1.5 text-gray-300">
                  <li className="flex gap-2"><span className="text-white">→</span>Compatible home charger OR smart charging via car API — both work</li>
                  <li className="flex gap-2"><span className="text-white">→</span>Supported chargers: Ohme, Indra, MyEnergi (Zappi), Pod Point, Hypervolt</li>
                  <li className="flex gap-2"><span className="text-white">→</span>SMETS2 smart meter required</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'talking-points' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Key Customer Talking Points</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Fixed low off-peak rate</strong> — unlike Agile, the off-peak price is fixed and predictable. Great for customers who want certainty on charging costs.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Fully automated</strong> — no need to manually set timer schedules on the charger. Octopus manages it from the cloud.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">All home electricity benefits</strong> — the off-peak rate applies to ALL consumption (washing machine, dishwasher, etc.) between 11:30pm and 5:30am, not just the EV.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Works even without a smart charger</strong> — if the car has a compatible API, Octopus can control charging via the car itself (no charger upgrade needed).</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'eligibility' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Eligibility</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>Compatible EV with API access (see Octopus compatibility checker)</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>SMETS2 smart meter</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>Home charging setup (driveway or garage)</span></li>
              <li className="flex gap-2"><span className="text-red-400">✗</span><span>Public charging only — IO Go requires home charging</span></li>
              <li className="flex gap-2"><span className="text-red-400">✗</span><span>Hybrid vehicles (PHEVs) — eligibility varies; check Octopus compatibility list</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>Solar not required but can be combined with IO Go</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'pros-cons' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Pros & Cons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-teal-400 font-semibold mb-3">Pros</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Fixed off-peak rate — predictable EV running costs</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Fully automated smart charging</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>No charger upgrade always needed</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Off-peak applies to all home usage in the window</li>
                </ul>
              </div>
              <div>
                <p className="text-red-400 font-semibold mb-3">Cons</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-red-400">−</span>EV is mandatory — not available without one</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Off-peak window is fixed (11:30pm–5:30am) — less flexibility than Agile</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Requires compatible car/charger — older EVs may not qualify</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Standard day rate applies outside off-peak — not suitable for high daytime usage without solar</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Customer Questions</h2>
            <FAQ
              q="My EV isn't on the compatibility list — can I still join?"
              a="Possibly, if the customer has a compatible smart charger (Ohme, Zappi, etc.) that Octopus can control instead. Octopus can control charging through the charger API even when the car doesn't have a direct API integration. Direct the customer to check the full compatibility page on the Octopus website."
            />
            <FAQ
              q="What happens if the car isn't fully charged by 5:30am?"
              a="Octopus will initiate a 'boost' charge at the standard rate before the customer's set departure time to reach the target charge level. This ensures the customer always has enough range for their commute, even if overnight slots weren't sufficient."
            />
            <FAQ
              q="Can I still charge manually or at any time?"
              a="Yes. The customer retains full control. They can override smart charging at any time via the app or directly from the car/charger. Any charging outside the off-peak window is billed at the standard rate."
            />
            <FAQ
              q="Does IO Go cover gas as well?"
              a="No. IO Go is electricity-only. Customers will need a separate gas tariff (e.g. standard variable, or Tracker for both fuels)."
            />
            <FAQ
              q="What happens if my car needs more than 6 hours of charging? (March 2026 update)"
              a="From March 2026, IO Go has a 6-hour daily smart charging limit. If the customer's car needs more than 6 hours, they have two options via the Charge Cap toggle in the Octopus app: (1) Charge Cap ON — charging stops at 6 hours and they receive a notification if they didn't reach their target; (2) Charge Cap OFF — charging continues past 6 hours at the standard 'Boost rate' (day rate). Around 80% of customers are unaffected as they already charge within 6 hours. Large-battery vehicles (e.g. 100kWh+ from near-empty) may occasionally need more — advise those customers to leave Charge Cap OFF or to top up more regularly."
            />
          </div>
        )}

        {/* ── LIVE CHARGING CONTEXT (F4) ── */}
        {activeTab === 'charging-live' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">IO Go Live Charging Context</h2>
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 mb-6">
                ⚠️ Dispatch windows shown are <strong>typical patterns</strong>. Actual Octopus dispatch depends on grid conditions and is not available via public API.
              </div>
            </div>

            {/* 24hr timeline */}
            <div>
              <p className="text-gray-300 text-xs mb-3">Typical 24-hour IO Go profile (each block = 1 hour, starting midnight)</p>
              <div className="flex rounded-lg overflow-hidden">
                {IO_GO_HOUR_PROFILE.map((band, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-8 ${HOUR_STYLE[band]?.bg || 'bg-gray-600'} opacity-80`}
                    title={`${String(i).padStart(2,'0')}:00 — ${HOUR_STYLE[band]?.label || ''}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {Object.entries(HOUR_STYLE).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${v.bg}`} />
                    <span className={`text-xs ${v.text}`}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional Carbon Intensity */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-white font-semibold text-sm">Regional Carbon Intensity</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-300">Region:</label>
                  <select
                    value={ciRegion}
                    onChange={e => setCiRegion(e.target.value)}
                    className="bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {['A','B','C','D','E','F','G','H','J','K','L','M','N','P'].map(r => (
                      <option key={r} value={r} style={{ background: '#150E38' }}>{r}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchCi}
                    disabled={ciLoading}
                    className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50"
                  >
                    {ciLoading ? 'Loading…' : '↻ Refresh'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-300 mb-3 italic">Approximate — based on DNO region boundary mapping to Carbon Intensity API regions</p>

              {ciError && <p className="text-red-400 text-sm">{ciError}</p>}
              {ciLoading && <p className="text-gray-300 text-sm">Loading regional data…</p>}
              {ciData && !ciLoading && (() => {
                const intensity = ciData.intensity || {};
                const idx = (intensity.index || '').toLowerCase();
                const colorClass = CI_INDEX_COLOR[idx] || 'text-gray-300';
                const fuels = Array.isArray(ciData.generationmix)
                  ? [...ciData.generationmix].filter(f => f.perc > 0).sort((a, b) => b.perc - a.perc)
                  : [];
                const FUEL_BAR = { wind:'bg-teal-400', solar:'bg-yellow-400', gas:'bg-orange-400', nuclear:'bg-purple-400', imports:'bg-blue-400', hydro:'bg-cyan-400', biomass:'bg-green-400', coal:'bg-red-500', other:'bg-gray-400' };
                const FUEL_LABEL = { wind:'text-teal-300', solar:'text-yellow-300', gas:'text-orange-300', nuclear:'text-purple-300', imports:'text-blue-300', hydro:'text-cyan-300', biomass:'text-green-300', coal:'text-red-400', other:'text-gray-300' };
                return (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-300">{ciData.shortname}</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-300 mb-1">Forecast</p>
                        <p className={`text-2xl font-bold ${colorClass}`}>{intensity.forecast ?? '—'}</p>
                        <p className="text-xs text-gray-300">gCO₂/kWh</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-300 mb-1">Index</p>
                        <p className={`text-lg font-bold capitalize ${colorClass}`}>{intensity.index ?? '—'}</p>
                        <p className="text-xs text-gray-300">rating</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-300 mb-1">Region</p>
                        <p className="text-2xl font-bold text-white">{ciRegion}</p>
                        <p className="text-xs text-gray-300">DNO area</p>
                      </div>
                    </div>
                    {fuels.length > 0 && (
                      <div>
                        <div className="flex rounded-full overflow-hidden h-2.5 mb-2 gap-px">
                          {fuels.map(f => (
                            <div key={f.fuel}
                              className={`${FUEL_BAR[f.fuel] || FUEL_BAR.other} transition-all`}
                              style={{ width: `${f.perc}%` }}
                              title={`${f.fuel}: ${f.perc}%`}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {fuels.slice(0, 5).map(f => (
                            <span key={f.fuel} className={`text-xs ${FUEL_LABEL[f.fuel] || FUEL_LABEL.other}`}>
                              {f.fuel} {f.perc}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* "Why didn't my car charge?" checklist */}
            <div>
              <h3 className="text-base font-bold text-white mb-3">Why Didn't My Car Charge? — Diagnostic Checklist</h3>
              <div className="space-y-2">
                {[
                  { label: 'Car not plugged in', detail: 'Most common cause. Smart charging requires the cable to be connected.' },
                  { label: 'Battery already at target %', detail: 'IO Go won\'t charge a battery that\'s already at or above the set target level.' },
                  { label: 'Departure time / target % not set in app', detail: 'Smart dispatch requires a departure time and target charge to be configured in the Octopus app.' },
                  { label: '6-hour limit hit (Charge Cap ON)', detail: 'From March 2026: smart charging stops at 6 hours if Charge Cap is ON. Check charging history in the app.' },
                  { label: 'Charger offline / OCPP connection lost', detail: 'Check the charger LED status and the charger\'s own app. A power cycle often resolves this.' },
                  { label: 'Dispatch window cancelled by grid', detail: 'Rarely, Octopus may cancel or reduce a dispatch window if grid conditions change. This is uncommon.' },
                  { label: 'Vehicle authentication expired', detail: 'Tesla/Ford/other API tokens expire periodically. Re-link the vehicle in the Octopus app under EV settings.' },
                ].map((item, i) => (
                  <details key={i} className="group bg-white/5 rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between gap-3 cursor-pointer p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 text-sm">?</span>
                        <p className="text-white text-sm font-medium">{item.label}</p>
                      </div>
                      <span className="text-gray-300 text-lg group-open:rotate-45 transition-transform flex-shrink-0">+</span>
                    </summary>
                    <div className="px-4 pb-4 border-t border-white/5 pt-3">
                      <p className="text-gray-300 text-sm">{item.detail}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* Nearby EV Chargers lookup */}
            <div>
              <h3 className="text-base font-bold text-white mb-1">Find Nearby Public Chargers</h3>
              <p className="text-gray-300 text-xs mb-3">Fallback option if the customer's home charger can't complete a session tonight.</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={chargerPostcode}
                  onChange={e => setChargerPostcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchChargers()}
                  placeholder="Enter postcode e.g. SW1A 1AA"
                  className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={fetchChargers}
                  disabled={chargerLoading || !chargerPostcode.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {chargerLoading ? 'Searching…' : 'Find'}
                </button>
              </div>
              {chargerError && <p className="text-red-400 text-sm">{chargerError}</p>}
              {chargerData && (
                <div className="space-y-2">
                  {chargerData.chargers.length === 0 ? (
                    <p className="text-gray-300 text-sm">No public chargers found within 2 miles.</p>
                  ) : (
                    chargerData.chargers.map((c, i) => {
                      const statusColor = c.status.toLowerCase().includes('operational') && !c.status.toLowerCase().includes('not')
                        ? 'text-teal-400 bg-teal-400/10'
                        : c.status.toLowerCase().includes('not')
                          ? 'text-red-400 bg-red-400/10'
                          : 'text-gray-300 bg-gray-400/10';
                      return (
                        <div key={i} className="bg-white/5 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-white text-sm font-medium">{c.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>{c.status}</span>
                          </div>
                          {c.address && <p className="text-gray-300 text-xs mb-1.5">{c.address}</p>}
                          <div className="flex flex-wrap gap-2">
                            {c.distanceMi != null && (
                              <span className="text-xs text-gray-300">{c.distanceMi} mi</span>
                            )}
                            {c.connectors.slice(0, 3).map((conn, j) => (
                              <span key={j} className="text-xs text-gray-300 bg-white/5 px-2 py-0.5 rounded">
                                {conn.type}{conn.powerKW ? ` · ${conn.powerKW}kW` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <p className="text-xs text-gray-300 mt-1">Open Charge Map — community-maintained, status may not be real-time</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── OBJECTIONS ── */}
        {activeTab === 'objections' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-2">Handling Customer Objections</h2>
            <p className="text-gray-300 text-sm mb-6">Common concerns and how to address them. Escalate where indicated.</p>
            {OBJECTIONS.map((item, i) => (
              <details key={i} className="group bg-white/5 rounded-xl overflow-hidden">
                <summary className="flex items-start justify-between gap-4 cursor-pointer p-5 hover:bg-white/5 transition-colors">
                  <p className="text-white font-medium text-sm leading-snug">"{item.objection}"</p>
                  <span className="text-pink-400 text-xl leading-none mt-0.5 group-open:rotate-45 transition-transform flex-shrink-0">+</span>
                </summary>
                <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
                  <p className="text-gray-300 text-sm leading-relaxed">{item.response}</p>
                  {item.escalateIf.length > 0 && (
                    <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-amber-300 text-xs font-semibold mb-1">Escalate / reconsider if:</p>
                      <ul className="space-y-1">
                        {item.escalateIf.map((cond, j) => (
                          <li key={j} className="text-gray-300 text-xs flex gap-2"><span className="text-amber-400">→</span>{cond}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}

        {/* ── KNOWLEDGE CHECK ── */}
        {activeTab === 'knowledge-check' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">IO Go Knowledge Check</h2>
            <p className="text-gray-300 text-sm mb-6">Scenario-based questions to test your IO Go knowledge. Questions shuffle each session.</p>
            <QuizPanel questions={IO_GO_QUIZ} />
          </div>
        )}

      </div>
    </main>
  );
}

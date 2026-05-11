// Cosy Octopus Reference — static staff reference page.
// No API calls. All content hardcoded.

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';
import QuizPanel from '../components/ui/QuizPanel';
import CallScriptsPanel from '../components/CallScriptsPanel';
import PrintButton from '../components/PrintButton';

const TABS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'tou-bands',       label: 'Time-of-Use Bands' },
  { id: 'heat-pump',       label: 'Heat Pump Guide' },
  { id: 'faq',             label: 'FAQ' },
  { id: 'objections',      label: 'Objections' },
  { id: 'knowledge-check', label: 'Knowledge Check' },
];

const OBJECTIONS = [
  {
    objection: "My house feels cold during the 4–7pm peak — the strategy isn't working.",
    response: "The key is pre-heating during the afternoon cheap window (13:00–16:00). The heat pump should raise the home to 22°C during this dip so thermal mass carries through peak without the heat pump running. If it's still cold at peak, increase the afternoon target temp by 1°C and check that the heat pump schedule reflects the Cosy band times.",
    escalateIf: ["Home has very poor insulation — thermal mass may not hold heat through a 3-hour peak window"],
  },
  {
    objection: "My heat pump is running at full power during the expensive 4–7pm window.",
    response: "The heat pump's internal schedule should be set to setback (16–17°C) during 16:00–19:00. Check the heat pump controller or thermostat programming — many heat pumps have their own schedule that needs to be aligned with the Cosy bands. The Octopus app alone may not override the heat pump's own thermostat. Provide the heat pump schedule guide from the Heat Pump Guide tab.",
    escalateIf: ["Customer's heat pump controller doesn't support scheduling — rare but possible in older systems"],
  },
  {
    objection: "I have both an EV and a heat pump — which tariff should I choose, Cosy or IO Go?",
    response: "They're mutually exclusive (both electricity import tariffs). If the EV is a significant energy user (most modern EVs are 60–100kWh+), IO Go's automated smart charging typically saves more overall. Cosy is the better fit when there's no compatible EV but substantial electric heating. If truly unsure, use the Bill Simulator to model both scenarios with the customer's usage.",
    escalateIf: [],
  },
  {
    objection: "Does Cosy cover my gas bill?",
    response: "No — Cosy is electricity-only. The customer needs a separate gas tariff. They can add Octopus Tracker (which covers both fuels on a daily variable basis) or a fixed gas product. This is worth clarifying upfront so there's no confusion when the gas bill arrives on a different tariff.",
    escalateIf: [],
  },
  {
    objection: "I can only see two cheap windows in the app, not three.",
    response: "There are three Cosy cheap windows: 04:00–07:00, 13:00–16:00, and 22:00–00:00. The third window (22:00–00:00) is only 2 hours and may appear as a shorter block in some app displays. All three exist — direct the customer to the time-of-use bands section or the official Cosy tariff page.",
    escalateIf: [],
  },
  {
    objection: "Can I get Cosy if I also have solar panels?",
    response: "Yes — Outgoing Octopus (solar export tariff) is fully compatible with Cosy Octopus (import tariff). A customer can hold both simultaneously: Cosy for import, Outgoing for export. The two tariffs are independent of each other. What's NOT possible is Cosy + Flux together, since Flux includes its own import tariff.",
    escalateIf: [],
  },
];

const COSY_QUIZ = [
  {
    q: "What percentage ABOVE the day rate is the Cosy peak window (16:00–19:00)?",
    options: [
      { text: "25% above day rate.", correct: false, explanation: "The Cosy peak window is approximately 50% above the day rate, not 25%. This makes avoiding grid imports during peak significantly more valuable." },
      { text: "~50% above the day rate.", correct: true, explanation: "The Cosy peak window (16:00–19:00) is approximately 50% above the standard day rate. This is why the heat pump strategy focuses on pre-heating before 4pm and using stored thermal mass to avoid the pump running during peak." },
      { text: "~100% above day rate — same as Agile spikes.", correct: false, explanation: "Cosy's peak is ~50% above day rate, which is significant but structured and predictable. Agile spikes can be much higher (up to 100p/kWh cap) but are half-hourly and variable." },
      { text: "The same as day rate — peak only affects standing charge.", correct: false, explanation: "The Cosy peak window has a higher unit rate (~50% above day) that applies to all electricity consumed 16:00–19:00, not just the standing charge." },
    ],
  },
  {
    q: "What percentage BELOW the day rate are the Cosy super cheap windows?",
    options: [
      { text: "~30% cheaper than day rate.", correct: false, explanation: "The super cheap windows are approximately 51% cheaper than the day rate — roughly half price. This is a significant saving for loads that can be shifted into these windows." },
      { text: "~51% cheaper than day rate.", correct: true, explanation: "The three Cosy super cheap windows (04:00–07:00, 13:00–16:00, 22:00–00:00) are approximately 51% cheaper than the standard day rate. This is where heat pump operation, hot water heating, laundry, and EV charging (if not on IO Go) should be concentrated." },
      { text: "~75% cheaper than day rate — almost free.", correct: false, explanation: "The saving is ~51%, not 75%. While significant, energy in the cheap window isn't nearly free — it's roughly half the day rate." },
      { text: "Same as the day rate — super cheap only means 'no peak charge'.", correct: false, explanation: "Super cheap is a distinct lower rate tier, approximately 51% below the standard day rate — not just the absence of a peak surcharge." },
    ],
  },
  {
    q: "A customer's heat pump is still running at full blast during the 16:00–19:00 peak window. What's the most likely cause?",
    options: [
      { text: "The Octopus app has overridden the heat pump settings.", correct: false, explanation: "The Octopus app doesn't directly control heat pump scheduling on Cosy — unlike IO Go's smart EV charging. The heat pump follows its own thermostat/controller schedule. The issue is most likely the heat pump's own schedule isn't aligned with the Cosy bands." },
      { text: "The heat pump's own schedule hasn't been set to setback (16–17°C) during peak hours.", correct: true, explanation: "The heat pump's internal controller/thermostat needs to be programmed to match the Cosy bands — specifically a setback temperature (16–17°C) during 16:00–19:00. The pre-heat during 13:00–16:00 should store enough thermal energy. Provide the heat pump schedule guide from the Heat Pump Guide tab." },
      { text: "The customer's meter is billing incorrectly — raise a billing query.", correct: false, explanation: "Running the heat pump during peak is a scheduling issue, not a billing error. The meter is recording correctly — the customer is just using electricity at an expensive time." },
      { text: "Cosy doesn't have a peak window — the customer may be on the wrong tariff.", correct: false, explanation: "Cosy absolutely has a peak window (16:00–19:00) at ~50% above day rate. The customer is on the right tariff; the issue is heat pump scheduling." },
    ],
  },
  {
    q: "Cosy Octopus is compatible with Intelligent Octopus Go — true or false?",
    options: [
      { text: "True — they complement each other perfectly for heat pump + EV households.", correct: false, explanation: "False — Cosy and IO Go are both electricity IMPORT tariffs and are mutually exclusive. A customer can only hold one electricity import tariff at a time." },
      { text: "False — they are both electricity import tariffs and cannot be held simultaneously.", correct: true, explanation: "Cosy and IO Go are mutually exclusive. If a customer has both an EV and a heat pump, they must choose one import tariff. IO Go is typically better if EV charging is significant; Cosy is better for heat-pump-only households without a compatible EV." },
      { text: "True, but only for customers with a SMETS2 meter.", correct: false, explanation: "Meter type doesn't change the exclusivity. Cosy and IO Go cannot be combined regardless of meter type." },
      { text: "True for gas, false for electricity — they can share the electricity supply point.", correct: false, explanation: "Both Cosy and IO Go are electricity import tariffs. There is only one electricity import tariff per supply point. They cannot be combined." },
    ],
  },
  {
    q: "What type of heating system makes Cosy Octopus MOST valuable?",
    options: [
      { text: "A gas combi boiler with programmable thermostat.", correct: false, explanation: "Cosy is an electricity-only tariff. Gas boilers don't benefit from Cosy's cheap electricity windows — the savings are for systems that consume electricity for heating." },
      { text: "An air source or ground source heat pump with the ability to pre-heat the home.", correct: true, explanation: "Heat pumps are ideal for Cosy because: they run on electricity (benefiting from cheap windows), they can pre-heat a home to store thermal energy, and the building's thermal mass carries through the expensive peak window without the pump needing to run." },
      { text: "A standard electric panel heater with no timer.", correct: false, explanation: "Panel heaters without timers can't shift load into cheap windows — they just run on demand. The customer would pay peak rates whenever they turn them on. Smart storage heaters or timered systems would work, but uncontrolled panel heaters are the worst fit." },
      { text: "A biomass boiler — highest thermal output for a cheap price.", correct: false, explanation: "Biomass boilers run on fuel (wood pellets/chips), not electricity. They don't benefit from Cosy's electricity rate bands." },
    ],
  },
  {
    q: "A customer on Cosy has solar panels and asks if they can export to the grid. What do you tell them?",
    options: [
      { text: "No — Cosy customers cannot export solar. They need Flux instead.", correct: false, explanation: "Cosy customers CAN export solar. They need to add Outgoing Octopus (the export tariff) alongside Cosy. Flux is a different product (bundled import+export ToU for battery households) and is mutually exclusive with Cosy." },
      { text: "Yes — Outgoing Octopus (export tariff) is fully compatible with Cosy Octopus (import tariff). Both can be held simultaneously.", correct: true, explanation: "Cosy (import) and Outgoing Octopus (export) can be held at the same time — they serve different supply directions. What can't be combined with Cosy is another electricity import tariff (IO Go, Agile, Flux, Tracker)." },
      { text: "Only if they're on Cosy for both electricity and gas.", correct: false, explanation: "Cosy is electricity-only. Whether they have gas on Cosy is irrelevant to export eligibility. Export is via Outgoing Octopus, which is independent." },
      { text: "They must switch from Cosy to Flux to access solar export.", correct: false, explanation: "Switching to Flux is not required. Outgoing Octopus is the standard solar export product and is compatible with Cosy. Flux is for solar+battery households and has its own bundled export." },
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

// Hours of the day 0–23 mapped to their Cosy band
const COSY_HOUR_BANDS = [
  // 00:00–04:00 = day
  'day','day','day','day',
  // 04:00–07:00 = super cheap
  'cheap','cheap','cheap',
  // 07:00–13:00 = day
  'day','day','day','day','day','day',
  // 13:00–16:00 = super cheap
  'cheap','cheap','cheap',
  // 16:00–19:00 = peak
  'peak','peak','peak',
  // 19:00–22:00 = day
  'day','day','day',
  // 22:00–00:00 = super cheap
  'cheap','cheap',
];

const BAND_STYLE = {
  cheap: { bg: 'bg-teal-600',    label: 'Super Cheap', text: 'text-teal-300' },
  day:   { bg: 'bg-gray-600',    label: 'Day Rate',    text: 'text-gray-300' },
  peak:  { bg: 'bg-red-600',     label: 'Peak',        text: 'text-red-300'  },
};

export default function CosyOctopus() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.state?.tab && TABS.some(t => t.id === location.state.tab)
      ? location.state.tab
      : 'overview'
  );

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tariff Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Cosy Octopus</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Smart variable electricity tariff for homes with heat pumps and electric heating. Three time-of-use bands — including three daily cheap windows.
        </p>
        <Link to="/tariffs/comparison" className="text-sm text-gray-300 hover:text-gray-300 underline mt-4 inline-block">
          → Compare all tariffs
        </Link>
      </header>

      <div className="print:hidden flex justify-end mb-4">
        <PrintButton />
      </div>

      <CallScriptsPanel tariff="cosy" />

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">What It Is</h2>
            <p>
              Cosy Octopus is a variable time-of-use electricity tariff designed for homes with <strong className="text-white">electric heating</strong> — air source heat pumps, ground source heat pumps, electric boilers, and electric radiators. It uses a "triple dip" structure with three cheap windows each day.
            </p>
            <p>
              <strong className="text-white">How it works:</strong> Unlike a flat-rate tariff, Cosy has three rate tiers throughout the day. Customers save by shifting controllable loads (heating, hot water) into the cheap windows, and reducing usage during the evening peak.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4">
                <p className="text-teal-300 font-semibold mb-1">Super Cheap 🟢</p>
                <p className="text-gray-300 text-xs">04:00–07:00 · 13:00–16:00 · 22:00–00:00</p>
                <p className="text-gray-300 text-xs mt-1">~51% cheaper than Day rate</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white font-semibold mb-1">Day Rate ⬜</p>
                <p className="text-gray-300 text-xs">All other hours</p>
                <p className="text-gray-300 text-xs mt-1">Standard variable rate</p>
              </div>
              <div className="bg-red-900/30 border border-red-600/30 rounded-xl p-4">
                <p className="text-red-300 font-semibold mb-1">Peak 🔴</p>
                <p className="text-gray-300 text-xs">16:00–19:00</p>
                <p className="text-gray-300 text-xs mt-1">~50% above Day rate</p>
              </div>
            </div>
            <p className="mt-2">
              <strong className="text-white">Who it's for:</strong> Customers with air source or ground source heat pumps, electric boilers, or significant electric heating. The savings come from pre-heating the home during cheap windows and letting thermal mass carry through the expensive peak period.
            </p>
            <p>
              <strong className="text-white">Gas:</strong> Cosy is an electricity-only tariff. Gas is billed separately — the customer can add Tracker or a fixed gas tariff.
            </p>
            <div className="bg-amber-900/30 border border-amber-600/30 rounded-xl p-4 mt-2">
              <p className="text-amber-300 text-sm font-semibold mb-1">⚠️ Tariff compatibility</p>
              <p className="text-gray-300 text-sm">Cosy Octopus cannot be combined with IO Go, Agile, Tracker, or Flux — a customer can only hold one electricity import tariff. If a customer has both an EV and a heat pump, IO Go is usually the better choice (smart EV charging typically saves more). See the <Link to="/tariffs/comparison" className="text-pink-400 hover:underline">Tariff Comparison</Link> for the full compatibility matrix.</p>
            </div>
          </div>
        )}

        {/* ── TIME-OF-USE BANDS ── */}
        {activeTab === 'tou-bands' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Time-of-Use Bands</h2>

            {/* Visual hour-by-hour timeline */}
            <div>
              <p className="text-gray-300 text-xs mb-3">24-hour band overview (each block = 1 hour)</p>
              <div className="flex rounded-lg overflow-hidden">
                {COSY_HOUR_BANDS.map((band, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-8 ${BAND_STYLE[band].bg} opacity-80 relative group`}
                    title={`${String(i).padStart(2,'0')}:00 — ${BAND_STYLE[band].label}`}
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
                {Object.entries(BAND_STYLE).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${v.bg}`} />
                    <span className={`text-xs ${v.text}`}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed band table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">Band</th>
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">Hours</th>
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">vs Day rate</th>
                    <th className="text-left py-2 text-gray-300 font-medium">Best use</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 pr-4 text-teal-300 font-semibold">🟢 Super Cheap</td>
                    <td className="py-3 pr-4 text-white font-mono text-xs">04:00–07:00<br/>13:00–16:00<br/>22:00–00:00</td>
                    <td className="py-3 pr-4 text-teal-300">~51% cheaper</td>
                    <td className="py-3 text-gray-300">Heat pump heating boost · Hot water · Washing machine · EV (if not on IO Go)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-white font-semibold">⬜ Day Rate</td>
                    <td className="py-3 pr-4 text-white font-mono text-xs">All other hours</td>
                    <td className="py-3 pr-4 text-gray-300">Standard</td>
                    <td className="py-3 text-gray-300">Normal background consumption</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-red-300 font-semibold">🔴 Peak</td>
                    <td className="py-3 pr-4 text-white font-mono text-xs">16:00–19:00</td>
                    <td className="py-3 pr-4 text-red-300">~50% more expensive</td>
                    <td className="py-3 text-gray-300">Avoid heavy loads. Heat pump should run on stored thermal energy from earlier dip.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-300 text-sm">
                <strong className="text-white">Key strategy:</strong> Customers shift controllable loads (heating, hot water, laundry) into the three cheap windows. The heat pump pre-warms the home during cheap periods so thermal mass carries through the expensive 16:00–19:00 peak without the heating running. Estimated saving: ~£82/year vs a standard fixed tariff.
              </p>
            </div>
          </div>
        )}

        {/* ── HEAT PUMP GUIDE ── */}
        {activeTab === 'heat-pump' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-1">Heat Pump Schedule Optimisation</h2>
            <p className="text-gray-300 text-sm mb-4">
              Based on Octopus Energy's Cosy schedule recommendations. Customer adjusts their heat pump controller to follow this pattern.
            </p>

            {/* Temperature schedule table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">Time</th>
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">Rate</th>
                    <th className="text-left py-2 pr-4 text-gray-300 font-medium">Target temp</th>
                    <th className="text-left py-2 text-gray-300 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-white">00:00–04:00</td>
                    <td className="py-3 pr-4 text-gray-300 text-xs">Day rate</td>
                    <td className="py-3 pr-4">18–19°C</td>
                    <td className="py-3">Overnight background — don't overheat</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-teal-300">04:00–07:00</td>
                    <td className="py-3 pr-4 text-teal-300 text-xs">Super Cheap</td>
                    <td className="py-3 pr-4 text-teal-300 font-semibold">21–22°C</td>
                    <td className="py-3">Morning pre-heat — store cheap energy as warmth before the day starts</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-white">07:00–13:00</td>
                    <td className="py-3 pr-4 text-gray-300 text-xs">Day rate</td>
                    <td className="py-3 pr-4">20°C</td>
                    <td className="py-3">Normal daytime comfort — thermal mass from morning pre-heat helps</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-teal-300">13:00–16:00</td>
                    <td className="py-3 pr-4 text-teal-300 text-xs">Super Cheap</td>
                    <td className="py-3 pr-4 text-teal-300 font-semibold">22°C</td>
                    <td className="py-3">Afternoon pre-heat — boost before evening peak, store thermal energy</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-red-300">16:00–19:00</td>
                    <td className="py-3 pr-4 text-red-300 text-xs">Peak</td>
                    <td className="py-3 pr-4 text-red-300 font-semibold">16–17°C</td>
                    <td className="py-3">Setback — rely on stored heat from 13:00–16:00 pre-heat. Avoid running heat pump at peak rate.</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-white">19:00–22:00</td>
                    <td className="py-3 pr-4 text-gray-300 text-xs">Day rate</td>
                    <td className="py-3 pr-4">20°C</td>
                    <td className="py-3">Evening comfort at standard rate</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-xs text-teal-300">22:00–00:00</td>
                    <td className="py-3 pr-4 text-teal-300 text-xs">Super Cheap</td>
                    <td className="py-3 pr-4 text-teal-300 font-semibold">Raise 1–2°C</td>
                    <td className="py-3">Evening dip — opportunistic warmth before midnight if needed</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Hot water section */}
            <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4">
              <p className="text-teal-300 font-semibold mb-2">🚿 Hot water scheduling</p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>→ Schedule hot water tank heating during cheap dips: <strong className="text-white">04:00–05:00 or 13:00–14:00</strong></li>
                <li>→ Set storage temperature to <strong className="text-white">48–50°C</strong> (efficient while maintaining legionella safety)</li>
                <li>→ Hot water heating takes priority over space heating — schedule it first</li>
              </ul>
            </div>

            {/* Key rules */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Key rules for customers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white font-semibold mb-1">✅ Do</p>
                  <ul className="text-gray-300 space-y-1">
                    <li>→ Pre-heat by 1–2°C during cheap windows</li>
                    <li>→ Set setback temps during 16:00–19:00 peak</li>
                    <li>→ Schedule laundry/dishwasher during cheap dips</li>
                    <li>→ Keep the home warmer than normal during cheap periods to build up thermal mass</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white font-semibold mb-1">❌ Avoid</p>
                  <ul className="text-gray-300 space-y-1">
                    <li>→ Turning heating fully off when away — reheating costs more</li>
                    <li>→ Running heat pump at full blast during 16:00–19:00</li>
                    <li>→ Scheduling heavy loads during peak hours</li>
                    <li>→ Sudden large temperature swings — small adjustments are more efficient</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-gray-300 text-xs mt-2">
              Schedule recommendations sourced from octopus.energy/heat-pump-help/cosy-schedule/ — content accurate as of April 2026. Individual homes vary; encourage customers to experiment with their settings over a few weeks.
            </p>
          </div>
        )}

        {/* ── FAQ ── */}
        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Customer Questions</h2>
            <FAQ
              q="Is Cosy Octopus compatible with Intelligent Octopus Go?"
              a="No. A customer can only hold one electricity import tariff at a time. Cosy Octopus and IO Go are both electricity import tariffs — the customer must choose one. If the customer has both an EV and a heat pump, IO Go is usually the better choice as smart EV charging typically saves more. Cosy is better if there is no compatible EV but significant electric heating."
            />
            <FAQ
              q="Can I have Cosy Octopus and export solar at the same time?"
              a="Yes. Outgoing Octopus (the solar export tariff) is fully compatible with Cosy Octopus. The customer can be on Cosy for import and Outgoing Octopus for export simultaneously."
            />
            <FAQ
              q="Does Cosy Octopus cover gas?"
              a="No. Cosy is an electricity-only tariff. The customer needs a separate gas tariff — they can add Octopus Tracker (which covers both electricity AND gas) as their gas product, or a fixed gas tariff."
            />
            <FAQ
              q="Can I combine Cosy with Flux?"
              a="No. Flux is a whole-home import + export tariff (both are bundled). Cosy is an import-only tariff. These are mutually exclusive — a customer with solar and a heat pump should use Flux if they want import/export bundled, or Cosy + Outgoing Octopus separately."
            />
            <FAQ
              q="What kind of heating system does Cosy work best with?"
              a="Cosy works best with systems that can shift load and store thermal energy: air source heat pumps (ASHP), ground source heat pumps (GSHP), electric storage heaters, electric boilers, and underfloor heating. Wet radiator systems with heat pumps also benefit well. Gas boilers do NOT benefit — Cosy is an electricity-only tariff."
            />
            <FAQ
              q="How much can a customer save on Cosy?"
              a="Octopus estimates approximately £82/year compared to a standard fixed tariff, based on average usage patterns. Actual savings depend on how much the customer shifts usage into cheap windows. Heavy heat pump users with good thermal mass in their home can save significantly more."
            />
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
            <h2 className="text-xl font-bold text-white mb-1">Cosy Knowledge Check</h2>
            <p className="text-gray-300 text-sm mb-6">Scenario-based questions to test your Cosy knowledge. Questions shuffle each session.</p>
            <QuizPanel questions={COSY_QUIZ} />
          </div>
        )}

      </div>
    </main>
  );
}

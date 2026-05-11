// Static staff reference page for Octopus Flux.
// No API calls. All content is hardcoded for agent use.

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';
import QuizPanel from '../components/ui/QuizPanel';

const TABS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'time-bands',      label: 'Time-of-Use Bands' },
  { id: 'requirements',    label: 'Requirements' },
  { id: 'talking-points',  label: 'Talking Points' },
  { id: 'pros-cons',       label: 'Pros & Cons' },
  { id: 'faq',             label: 'FAQ' },
  { id: 'objections',      label: 'Objections' },
  { id: 'knowledge-check', label: 'Knowledge Check' },
];

const OBJECTIONS = [
  {
    objection: "The peak import rate at 4–7pm is expensive — what if I genuinely need power during those hours?",
    response: "The peak window is the designed trade-off: battery should have charged overnight and stored that energy for evening use. Key advice: pre-heat hot water and heating during cheap dip, keep high-wattage loads (oven, washing machine) outside 4–7pm. For unavoidable usage, the cost is still offset by the lower overnight import rate and higher peak export earnings.",
    escalateIf: ["Customer has a large household with unavoidable peak-hour loads (e.g. children home from school, cooking requirements)"],
  },
  {
    objection: "I only have solar, not a battery. Can I still get Flux?",
    response: "No — Flux requires both solar AND a home battery. Without a battery the off-peak overnight charging strategy doesn't work, and Octopus won't accept the application. For solar-only customers, recommend Outgoing Octopus instead — it provides a fixed export rate with no import ToU bands.",
    escalateIf: [],
  },
  {
    objection: "My battery inverter isn't on the Octopus compatibility list.",
    response: "The compatibility list is updated regularly but may lag behind new models. Many modern inverters work even if not explicitly listed — most support scheduled charge/discharge via their own app or via OCPP/Modbus. Advise the customer to check directly with Octopus for the latest confirmed compatibility, as the list changes quarterly.",
    escalateIf: ["Inverter is more than 5 years old or from an obscure manufacturer"],
  },
  {
    objection: "How much more can I earn on Flux vs standard SEG?",
    response: "The Ofgem SEG minimum is ~15p/kWh (guaranteed minimum). Flux peak export rate is significantly higher — particularly during the 4–7pm window when national demand is highest. The exact figure varies by product version. For customers with a well-sized battery, the extra export earnings during peak often more than offset the higher peak import rate.",
    escalateIf: [],
  },
  {
    objection: "Three rate bands seems really complicated to manage.",
    response: "In practice it's simple: charge battery overnight during the cheap window (02:00–05:00), use/export during the day at the standard rate, discharge/export during the 4–7pm peak for the highest earnings. The battery management handles the complexity automatically — especially if the inverter is Octopus-integrated for automated dispatch.",
    escalateIf: [],
  },
  {
    objection: "I have an EV too — can I combine Flux with IO Go?",
    response: "No. Both Flux and IO Go are electricity import tariffs — a customer can only hold one at a time. They'll need to choose: Flux if maximising solar+battery value is the priority, or IO Go if smart EV charging is the primary need. There's no combined tariff. If they have solar+battery+EV, Flux is generally the better fit for whole-home optimisation.",
    escalateIf: [],
  },
];

const FLUX_QUIZ = [
  {
    q: "What THREE things must a customer have to be eligible for Flux?",
    options: [
      { text: "Solar PV, a smart thermostat, and a SMETS2 meter.", correct: false, explanation: "A smart thermostat is not required for Flux. The three requirements are: solar PV panels, home battery storage, and a SMETS2 smart meter (plus an active export meter point)." },
      { text: "Solar PV panels, home battery storage, and a SMETS2 smart meter.", correct: true, explanation: "All three are mandatory: solar PV generates electricity, the home battery stores it for optimised dispatch, and the SMETS2 meter enables accurate half-hourly import AND export measurement. An active export MPAN is also needed." },
      { text: "Solar PV, an EV, and a compatible charger.", correct: false, explanation: "An EV is not required for Flux. Flux is designed for solar+battery households. IO Go is the EV-specific tariff." },
      { text: "Solar PV only — battery is optional for a reduced Flux rate.", correct: false, explanation: "Battery is mandatory, not optional. Without battery storage the off-peak charging strategy doesn't function and Octopus won't accept a Flux application." },
    ],
  },
  {
    q: "What is the Flux peak window and what should customers AVOID doing during it?",
    options: [
      { text: "02:00–05:00. Avoid using any electricity during this window.", correct: false, explanation: "02:00–05:00 is the OFF-PEAK (cheap) window — this is when customers SHOULD be charging the battery. The peak window is 16:00–19:00." },
      { text: "16:00–19:00 (4–7pm). Avoid grid imports — run large appliances outside this window. Battery should be discharging/exporting instead.", correct: true, explanation: "The peak window runs 16:00–19:00 and has the highest import AND export rate. During peak, the battery should be discharging to power the home or exporting to the grid. Heavy grid imports (oven, washing machine, etc.) should be avoided during this window." },
      { text: "07:00–16:00. Avoid all electricity usage — this is the most expensive period.", correct: false, explanation: "07:00–16:00 is the standard rate period — neither cheap nor peak. The peak window is 16:00–19:00 only." },
      { text: "19:00–23:00. Avoid importing during the evening standard rate.", correct: false, explanation: "19:00–02:00 is the standard rate period. The peak window is specifically 16:00–19:00." },
    ],
  },
  {
    q: "Flux covers import AND export on a single tariff — true or false?",
    options: [
      { text: "False — import and export must be separate Octopus tariffs.", correct: false, explanation: "Flux is specifically designed to bundle import and export on a single tariff. This is one of its key selling points vs Outgoing Octopus (export-only) + a separate import tariff." },
      { text: "True — import and export are both included in Flux, with time-of-use rates for each.", correct: true, explanation: "Flux bundles both import and export on one tariff with three time-of-use bands. The export rate is highest during the peak window (16:00–19:00) — this is when battery discharge or solar export earns the most." },
      { text: "True for import, but export requires adding Outgoing Octopus separately.", correct: false, explanation: "Export is included in Flux. Customers on Flux do not need a separate export tariff — Flux handles both." },
      { text: "True, but only for customers with a battery larger than 10kWh.", correct: false, explanation: "There is no 10kWh minimum battery size requirement for Flux. The bundled import+export applies to all eligible Flux customers regardless of battery size." },
    ],
  },
  {
    q: "What is the purpose of the Flux off-peak window (02:00–05:00)?",
    options: [
      { text: "Export solar generation to the grid at the highest rate.", correct: false, explanation: "02:00–05:00 is the cheapest IMPORT window — it's for charging the battery from the grid at low cost. Solar panels don't generate at night. Peak export earnings happen 16:00–19:00." },
      { text: "Import electricity from the grid at the cheapest rate to charge the home battery.", correct: true, explanation: "The off-peak window (02:00–05:00) is designed for overnight grid import at the lowest rate, filling the battery cheaply so it can power the home during the day and discharge/export during the expensive 4–7pm peak." },
      { text: "Discharge the battery to run overnight appliances cheaply.", correct: false, explanation: "The off-peak window is for CHARGING the battery, not discharging it. You want to fill the battery cheaply overnight to use the stored energy during the day and peak period." },
      { text: "This window has no special purpose — Flux has only two rate bands.", correct: false, explanation: "Flux has three rate bands: off-peak (02:00–05:00), standard (everything else), and peak (16:00–19:00). The off-peak window is specifically designed for cheap battery charging." },
    ],
  },
  {
    q: "A customer has solar panels but no battery. They ask about Flux. What do you tell them?",
    options: [
      { text: "They can join Flux with solar-only at a reduced rate.", correct: false, explanation: "There is no reduced-rate Flux for solar-only customers. Battery is a hard requirement — Octopus won't accept a Flux application without one." },
      { text: "Flux requires both solar AND battery — suggest Outgoing Octopus instead for solar-only customers.", correct: true, explanation: "Flux is designed specifically for solar+battery households. Without a battery, the off-peak charging strategy doesn't work. Outgoing Octopus (fixed export rate, no import ToU bands) is the right recommendation for solar-only customers." },
      { text: "They should wait until battery prices drop and apply then.", correct: false, explanation: "While practically true that they'd need a battery first, the immediate response is to clarify Flux's requirements and offer an alternative (Outgoing Octopus) for their current setup." },
      { text: "SMETS1 meters cannot support Flux — that may be why they're ineligible.", correct: false, explanation: "The reason in this case is no battery, not the meter type. Flux requires a SMETS2 meter, but the primary block here is the missing home battery." },
    ],
  },
  {
    q: "A customer with solar, a battery, AND an EV asks whether to choose Flux or IO Go. What do you advise?",
    options: [
      { text: "Both — they can combine Flux and IO Go for maximum savings.", correct: false, explanation: "Flux and IO Go are both electricity IMPORT tariffs — a customer can only hold one. They must choose." },
      { text: "IO Go only — it always saves more than Flux.", correct: false, explanation: "This isn't universally true. For a customer with significant solar+battery capacity, Flux's peak export earnings and overnight off-peak charging can save more than IO Go's EV-focused off-peak window. It depends on their specific setup and usage." },
      { text: "They must choose one — both are import tariffs. Flux is typically better if solar+battery optimisation is the priority; IO Go if EV charging is the primary saving.", correct: true, explanation: "Flux and IO Go are mutually exclusive. The right choice depends on the customer's priorities: Flux is designed to maximise solar+battery ROI with bundled import/export ToU; IO Go provides fixed cheap overnight EV charging with full automation. For large EV fleet or pure EV focus — IO Go. For whole-home solar+battery optimisation — Flux." },
      { text: "Flux is always the wrong choice if the customer has an EV.", correct: false, explanation: "Flux can work well for solar+battery+EV households if they prioritise solar optimisation. The EV can still be charged overnight in the Flux off-peak window. It just won't have IO Go's automated smart charging." },
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

export default function FluxReference() {
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
          <span className="octopus-text-gradient">Octopus Flux</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Time-of-use import and export tariff for customers with solar panels AND home battery storage. Bundled import/export on the same tariff.
        </p>
        <Link to="/tariffs/comparison" className="text-sm text-gray-400 hover:text-gray-300 underline mt-4 inline-block">
          → Compare all tariffs
        </Link>
      </header>

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {activeTab === 'overview' && (
          <div className="space-y-2 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">What It Is</h2>
            <p>Octopus Flux is a time-of-use (ToU) tariff designed exclusively for customers with <strong className="text-white">solar PV</strong> and <strong className="text-white">home battery storage</strong>. It covers both import from the grid and export to the grid on the same tariff, with rates that vary by time of day.</p>
            <p>The core strategy: <strong className="text-white">charge the battery from the cheap overnight rate, discharge or export at the peak evening rate</strong>. Customers can earn significantly more than the standard SEG export rate during peak hours.</p>
            <p><strong className="text-white">Billing:</strong> Monthly direct debit, calculated from actual smart meter readings for both import and export.</p>
          </div>
        )}

        {activeTab === 'time-bands' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Time-of-Use Bands</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-blue-900/40 border border-blue-500/30 rounded-xl p-4 text-center">
                  <p className="text-blue-300 font-semibold text-xs uppercase tracking-wider mb-1">Off-Peak</p>
                  <p className="text-white font-bold text-lg">02:00–05:00</p>
                  <p className="text-gray-400 text-xs mt-1">Cheapest import · Charge battery from grid</p>
                </div>
                <div className="bg-gray-700/40 border border-gray-400/30 rounded-xl p-4 text-center">
                  <p className="text-gray-300 font-semibold text-xs uppercase tracking-wider mb-1">Standard</p>
                  <p className="text-white font-bold text-lg">05:00–16:00<br/>19:00–02:00</p>
                  <p className="text-gray-400 text-xs mt-1">Mid rate for import + export</p>
                </div>
                <div className="bg-red-900/40 border border-red-500/30 rounded-xl p-4 text-center">
                  <p className="text-red-300 font-semibold text-xs uppercase tracking-wider mb-1">Peak</p>
                  <p className="text-white font-bold text-lg">16:00–19:00</p>
                  <p className="text-gray-400 text-xs mt-1">Highest import AND export rate · Discharge/export battery</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">Times are UK local time (BST/GMT adjusted). The peak window aligns with national evening demand — battery discharge or solar export during this window earns the highest export rate.</p>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Requirements</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span><strong className="text-white">Solar PV system</strong> — panels on the roof generating electricity</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span><strong className="text-white">Home battery storage</strong> — e.g. Tesla Powerwall, GivEnergy, Sonnen, Growatt, Solis, Huawei, SolarEdge, etc.</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span><strong className="text-white">SMETS2 smart meter</strong> — for both import and export metering</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span><strong className="text-white">Export meter point (MPAN)</strong> — must have an active export MPxN registered with the DNO</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>Battery must be able to be scheduled for overnight charging — most modern inverters support this; check compatibility</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'talking-points' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Key Customer Talking Points</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Maximise solar self-sufficiency</strong> — cheap overnight grid import fills the battery, so solar generation can be maximised for daytime use or peak exports.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Bundled import + export</strong> — both on the same tariff, simplifying the customer's energy account.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">High peak export earnings</strong> — exporting or discharging battery between 4–7pm earns the highest rate, well above the standard SEG guarantee.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Grid-interactive</strong> — for some batteries, Octopus can automate charge/discharge scheduling to align with Flux's ToU windows.</span></li>
            </ul>

            <div className="mt-6 bg-white/5 rounded-xl p-4 text-sm text-gray-300">
              <p className="text-white font-semibold mb-2">Ideal Customer Profile</p>
              <ul className="space-y-1">
                <li className="flex gap-2"><span className="text-teal-400">✓</span>Has solar panels AND a home battery (both are mandatory)</li>
                <li className="flex gap-2"><span className="text-teal-400">✓</span>Wants to maximise the value of their solar+battery investment</li>
                <li className="flex gap-2"><span className="text-teal-400">✓</span>Is comfortable with time-of-use billing — knows to shift high-use activities outside peak hours</li>
                <li className="flex gap-2"><span className="text-teal-400">✓</span>Has a reasonably large battery (5kWh+) to benefit from overnight charging</li>
                <li className="flex gap-2"><span className="text-teal-400">✓</span>Lives in a sunny region with good annual solar yield</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'pros-cons' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Pros & Cons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-teal-400 font-semibold mb-3">Pros</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Specifically designed for solar+battery households</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Import and export on one tariff</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>High peak export rate — earn more than standard SEG</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Cheap overnight import for battery charging</li>
                </ul>
              </div>
              <div>
                <p className="text-red-400 font-semibold mb-3">Cons</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-red-400">−</span>Requires solar AND battery — significant upfront investment</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Peak import rate is high — avoid grid imports in 4–7pm window</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Three rate bands to manage — more complex than flat or simple ToU</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Less suitable for smaller batteries (&lt;5kWh) where overnight fill has limited value</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Customer Questions</h2>
            <FAQ
              q="Do I need a specific battery brand?"
              a="No. Flux works with most modern battery inverter systems including Tesla Powerwall, GivEnergy, Sonnen, Huawei, Solis, SolarEdge, Growatt, and others. The battery needs to support scheduled charge/discharge, which most do. Check the Octopus compatibility list for the latest confirmed models."
            />
            <FAQ
              q="Can I get Flux without a battery?"
              a="No. Flux requires both solar panels and a home battery. Without a battery the customer cannot take advantage of the off-peak charging strategy, and Octopus won't accept the application. For solar-only customers, recommend Outgoing Octopus instead."
            />
            <FAQ
              q="What about Outgoing Octopus — how is Flux different?"
              a="Outgoing Octopus is a standalone export-only tariff (a fixed rate per kWh exported) with no time-of-use bands. Flux is a bundled import+export ToU tariff specifically designed for battery households. They serve different use cases — Outgoing is simpler, Flux is higher-earning for active battery management."
            />
            <FAQ
              q="What happens during the peak window if the customer's battery is empty?"
              a="If the battery is empty and the customer needs grid power during peak hours (4–7pm), they'll pay the peak import rate — which is higher than standard. This is why proper overnight battery charging is important. Octopus can automate this with compatible systems."
            />
          </div>
        )}

        {activeTab === 'objections' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-2">Handling Customer Objections</h2>
            <p className="text-gray-400 text-sm mb-6">Common concerns and how to address them. Escalate where indicated.</p>
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

        {activeTab === 'knowledge-check' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Flux Knowledge Check</h2>
            <p className="text-gray-400 text-sm mb-6">Scenario-based questions to test your Flux knowledge. Questions shuffle each session.</p>
            <QuizPanel questions={FLUX_QUIZ} />
          </div>
        )}

      </div>
    </main>
  );
}

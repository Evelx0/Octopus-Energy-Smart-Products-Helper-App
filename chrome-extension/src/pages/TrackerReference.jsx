// Static staff reference page for the Octopus Tracker tariff.
// No API calls. All content is hardcoded for agent use.

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';
import QuizPanel from '../components/ui/QuizPanel';
import CallScriptsPanel from '../components/CallScriptsPanel';
import PrintButton from '../components/PrintButton';

const TABS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'talking-points',  label: 'Talking Points' },
  { id: 'rate-structure',  label: 'Rate Structure' },
  { id: 'requirements',    label: 'Requirements' },
  { id: 'eligibility',     label: 'Eligibility' },
  { id: 'pros-cons',       label: 'Pros & Cons' },
  { id: 'faq',             label: 'FAQ' },
  { id: 'objections',      label: 'Objections' },
  { id: 'knowledge-check', label: 'Knowledge Check' },
];

const OBJECTIONS = [
  {
    objection: "What if gas prices spike massively in winter — like 2022?",
    response: "Tracker rates are capped at 100% above the Ofgem SVT price cap for that quarter. That provides a hard ceiling — Tracker cannot exceed double the regulated cap rate. Winter 2022 was exceptional; Octopus absorbed a significant portion of that wholesale shock. Tracker is transparent: when wholesale prices are low, customers genuinely benefit.",
    escalateIf: ["Customer is very risk-averse about energy bills", "Customer is in financial difficulty"],
  },
  {
    objection: "Why does my product code say SILVER- in the app? That doesn't seem right.",
    response: "SILVER- is the internal prefix Octopus uses for the Tracker tariff product codes (e.g. SILVER-26-04-01). It is correct and expected. Customer-facing interfaces show it as 'Octopus Tracker' — the SILVER- code is just how it's registered in the system. Do NOT direct customers to look for a TRACKER- product code — it doesn't exist.",
    escalateIf: [],
  },
  {
    objection: "Both fuels vary at the same time — if I can't hedge one against the other, what's the benefit?",
    response: "The benefit is full transparency: the customer pays what the wholesale market pays, with no supplier margin hidden in a fixed rate. When prices are low across both fuels (typically spring and summer), the savings can be significant. The rate cap on both fuels limits the worst-case scenario. Many customers find the annual average on Tracker beats the fixed rate available to them.",
    escalateIf: ["Customer genuinely needs fixed-cost certainty for budgeting"],
  },
  {
    objection: "I want a fixed tariff — I don't want to worry about my bill changing.",
    response: "That's a valid preference. Tracker may not be right for everyone. If the customer wants absolute certainty, a fixed tariff is the right product. But if they want to be on the right side of wholesale price movements — and understand there's a cap on the downside — Tracker's transparency is a genuine advantage. Offer to compare using the Tariff Comparison page.",
    escalateIf: ["Customer has explicitly decided they want a fixed tariff"],
  },
  {
    objection: "How is Tracker different from Agile? They both sound variable.",
    response: "Key differences: Tracker has one rate per day per fuel (announced ~9pm for tomorrow); Agile has 48 half-hourly rates per day (electricity only, announced ~4pm). Tracker covers gas AND electricity together; Agile is electricity-only. Tracker is simpler — customers don't need to track prices throughout the day. Agile rewards active usage-shifting; Tracker rewards being on the right side of daily wholesale averages.",
    escalateIf: [],
  },
  {
    objection: "Tomorrow's rate isn't showing in the app yet — is something broken?",
    response: "Not broken. Tracker rates for the following day are published between approximately 9pm and 11pm. If it's before 9pm, tomorrow's rate simply hasn't been set yet. Advise the customer to check back after 9pm — it will appear in the app once published.",
    escalateIf: ["It's past 11pm and tomorrow's rate is still not showing — may warrant investigation"],
  },
];

const TRACKER_QUIZ = [
  {
    q: "What product code prefix does Octopus Tracker use, and why is this important?",
    options: [
      { text: "TRACKER- — this is the publicly listed product name.", correct: false, explanation: "There is no TRACKER- product code. Tracker products are UNLISTED in the public Octopus catalogue and use the SILVER- prefix (e.g. SILVER-26-04-01). Directing customers to search for TRACKER- will result in them finding nothing." },
      { text: "SILVER- (e.g. SILVER-26-04-01) — the product is unlisted and won't appear in a standard API search.", correct: true, explanation: "Tracker products use the SILVER- prefix and are intentionally unlisted from the public product catalogue. This means standard API product searches won't find them. The internal portal uses direct probing of known SILVER- codes to get current rates." },
      { text: "VAR- — standing for 'variable' tariff.", correct: false, explanation: "VAR- is not a real Octopus product prefix. Tracker uses SILVER-." },
      { text: "GO- — same prefix as Octopus Go.", correct: false, explanation: "GO- is not the Tracker prefix. Tracker uses SILVER-. Octopus Go uses a different product code structure." },
    ],
  },
  {
    q: "A customer checks the Octopus app at 7:30pm and tomorrow's Tracker rate isn't showing yet. What do you tell them?",
    options: [
      { text: "There's a system outage — raise a ticket.", correct: false, explanation: "Not showing at 7:30pm is completely normal. Tracker rates are published ~9–11pm. No action needed." },
      { text: "Tomorrow's rates are published ~9–11pm each evening. If it's before 9pm, check back later.", correct: true, explanation: "Tracker rates for the following day are announced between approximately 9pm and 11pm. The customer just needs to check back after 9pm." },
      { text: "Rates are published at midnight — they should wait until then.", correct: false, explanation: "Rates are typically published 9–11pm, not midnight. Customers can see tomorrow's rate in the evening before bed." },
      { text: "Only the current day's rate is ever visible in the app.", correct: false, explanation: "Tomorrow's rate is visible as soon as it's published (~9–11pm the evening before). Customers can use this to plan their energy usage for the next day." },
    ],
  },
  {
    q: "Octopus Tracker covers both electricity AND gas on a single tariff — true or false?",
    options: [
      { text: "False — Tracker is electricity-only, like Agile.", correct: false, explanation: "Tracker covers BOTH electricity and gas. This is one of the key differences from Agile (electricity-only). Each fuel has its own daily unit rate and standing charge." },
      { text: "True — Tracker has daily rates for both electricity and gas.", correct: true, explanation: "Tracker is one of the few Octopus tariffs that covers both fuels on a single variable tariff. Each fuel has its own daily rate. It can also be taken as gas-only or electricity-only." },
      { text: "True, but only if the customer is dual-fuel with Octopus.", correct: false, explanation: "Tracker can be taken for either or both fuels. It's not restricted to dual-fuel customers — gas-only or electricity-only Tracker is also possible." },
      { text: "False — Tracker is gas-only. Agile handles the electricity.", correct: false, explanation: "Both Tracker and Agile can cover electricity. Tracker uniquely covers gas too. Agile is electricity-only." },
    ],
  },
  {
    q: "What is the maximum Tracker unit rate Ofgem allows?",
    options: [
      { text: "The same as the Agile cap: 100p/kWh.", correct: false, explanation: "Tracker and Agile have different caps. Tracker's cap is set at 100% above the SVT price cap for that quarter — so if SVT electricity is 24.5p, the cap is 49p/kWh. Agile's absolute cap is 100p/kWh." },
      { text: "Capped at 100% above the Ofgem SVT price cap for that quarter.", correct: true, explanation: "Ofgem's rule: Tracker rates cannot exceed double the SVT price cap rate for that quarter. Check constants/svt.js for the current SVT figures. This provides a hard ceiling for customers during price spikes." },
      { text: "There is no regulatory cap — Tracker is fully uncapped.", correct: false, explanation: "Tracker has a regulatory cap. Ofgem requires that Tracker rates do not exceed 100% above the SVT price cap." },
      { text: "Capped at 50% above SVT to protect vulnerable customers.", correct: false, explanation: "The cap is 100% above SVT (i.e. 2× the SVT rate), not 50%. The 100% figure is the Ofgem regulatory requirement." },
    ],
  },
  {
    q: "A customer is worried about a cold winter driving up their Tracker gas bills. What's the key context you give them?",
    options: [
      { text: "Tell them to switch to a fixed tariff immediately.", correct: false, explanation: "Before advising a switch, provide context: Tracker has a rate cap, and winter spikes are bounded. If after that context they still want certainty, then yes — explore a fixed tariff together." },
      { text: "Tracker gas rates are fixed in winter — they won't change during cold snaps.", correct: false, explanation: "Tracker rates are variable daily, including gas. They are not fixed in winter. The protection comes from the rate cap, not rate stability." },
      { text: "Gas rates are capped at 100% above the SVT gas cap, spring/summer rates have often been well below SVT, and the annual average frequently beats a fixed rate.", correct: true, explanation: "Key messages: (1) Ofgem's 100% cap protects against extreme spikes. (2) When wholesale gas is cheap, Tracker customers save meaningfully vs fixed. (3) Annual average matters more than worst-case days. Show the historical tracker chart for context." },
      { text: "Octopus guarantees that Tracker gas will always be cheaper than a fixed tariff.", correct: false, explanation: "No guarantee exists. Tracker may or may not be cheaper than a fixed rate in any given period — it depends on wholesale markets. The selling point is transparency and the potential to save when prices are low." },
    ],
  },
  {
    q: "Can a customer take Octopus Tracker for gas only, keeping a different tariff for electricity?",
    options: [
      { text: "No — Tracker must be taken as dual-fuel or not at all.", correct: false, explanation: "Tracker can be taken as gas-only, electricity-only, or dual-fuel. There is no requirement to take both fuels." },
      { text: "Yes — Tracker is available electricity-only, gas-only, or dual-fuel.", correct: true, explanation: "Tracker is flexible on fuel coverage. A customer can be on a fixed electricity tariff and Tracker for gas, or vice versa. Each fuel is billed independently." },
      { text: "Only if they don't have a smart gas meter.", correct: false, explanation: "Smart meter requirements apply for accurate billing — the option to take gas-only Tracker is not conditional on meter type." },
      { text: "No — gas-only tariffs from Octopus are not available.", correct: false, explanation: "Octopus does offer gas-only products. Tracker can be taken for gas without electricity." },
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

export default function TrackerReference() {
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
          <span className="octopus-text-gradient">Octopus Tracker</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Daily variable tariff for both electricity <em>and</em> gas. One unit rate per fuel per day, announced the evening before.
        </p>
        <div className="flex gap-3 mt-4">
          <Link to="/tracker-prices" className="text-sm text-teal-400 hover:text-teal-300 underline">
            → View live Tracker prices
          </Link>
          <Link to="/tariffs/comparison" className="text-sm text-gray-300 hover:text-gray-300 underline">
            → Compare all tariffs
          </Link>
        </div>
      </header>

      <div className="print:hidden flex justify-end mb-4">
        <PrintButton />
      </div>

      <CallScriptsPanel tariff="tracker" />

      {/* Critical internal note — always visible regardless of active tab */}
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 text-sm mb-6">
        <p className="font-semibold text-amber-300 mb-1">Internal Note — Product Code</p>
        <p className="text-gray-300">
          Tracker products use the prefix <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">SILVER-</span> (e.g. <span className="font-mono text-white">SILVER-26-04-01</span>).
          They are <strong className="text-white">unlisted</strong> in the public Octopus product catalogue and will <strong className="text-white">NOT</strong> appear in a standard API product listing.
          Do not tell customers to look for a "TRACKER-" product code — it does not exist.
        </p>
      </div>

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {activeTab === 'overview' && (
          <div className="space-y-2 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">What It Is</h2>
            <p>Octopus Tracker is a daily variable tariff covering <strong className="text-white">both electricity and gas</strong>. There is one unit rate and one standing charge per fuel per day — not half-hourly like Agile.</p>
            <p><strong className="text-white">Rate announcement:</strong> Rates for the following day are published by Octopus each evening, typically between 9pm and 11pm. Customers can see the next day's rate in the Octopus app.</p>
            <p><strong className="text-white">Rate cap:</strong> By Ofgem rule, Tracker rates cannot exceed 100% above the SVT price cap for that quarter. This protects customers from extreme wholesale spikes.</p>
            <p><strong className="text-white">Billing:</strong> Monthly direct debit, calculated from actual smart meter readings. Gas is also billed on actual usage — no estimated reads.</p>
          </div>
        )}

        {activeTab === 'talking-points' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Key Customer Talking Points</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Complete transparency</strong> — wholesale price passthrough means the customer pays what the market pays, with no hidden margin beyond Octopus's costs and profit.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Both fuels on one variable tariff</strong> — electricity and gas vary daily together, simplifying the customer's understanding of their energy costs.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Rate capped at 100% above SVT</strong> — Tracker cannot exceed double the Ofgem price cap rate, providing a safety ceiling against extreme volatility.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Next-day preview</strong> — customers can see tomorrow's rate each evening (~9–11pm) in the app, allowing some flexibility in usage.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">No lock-in</strong> — customers can leave at any time with no exit fees.</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'rate-structure' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Rate Structure</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Electricity Unit Rate</p>
                <p className="text-gray-300">One rate per day in p/kWh inc. VAT. Capped at 100% above the Ofgem SVT electricity cap for the quarter.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Gas Unit Rate</p>
                <p className="text-gray-300">One rate per day in p/kWh inc. VAT. Capped at 100% above the Ofgem SVT gas cap. Gas rates are typically lower than electricity.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Standing Charges</p>
                <p className="text-gray-300">Both electricity and gas standing charges vary daily. Published at the same time as unit rates each evening.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Rate Announcement</p>
                <p className="text-gray-300">~9–11pm for the following day. Octopus app shows tomorrow's rates as soon as published. Use the Tracker tracker on this portal to check.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Smart Meter Requirements</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span>Smart meter required for both electricity and gas for accurate daily billing</span></li>
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span>SMETS1 or SMETS2 both supported — Tracker billing is daily (not half-hourly), so full DCC enrolment is less critical than for Agile</span></li>
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span>Gas smart meter strongly preferred; estimated reads may be used if not available but will be corrected on reconciliation</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'eligibility' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Eligibility</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>Available to domestic customers with a smart meter</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>Covers both electricity and gas — can be gas-only or dual fuel</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>No EV, solar, or battery required</span></li>
              <li className="flex gap-2"><span className="text-red-400">✗</span><span>Not available to prepayment customers</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>Direct debit required for billing</span></li>
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
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Wholesale price passthrough — benefits from low market prices</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Covers both fuels on a single variable tariff</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Rate cap protects against extreme spikes</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>No lock-in, no exit fees</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Simpler than Agile — one rate per day vs 48 half-hourly slots</li>
                </ul>
              </div>
              <div>
                <p className="text-red-400 font-semibold mb-3">Cons</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-red-400">−</span>Rates volatile in winter — cold snaps drive up gas demand and prices</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Both fuels variable simultaneously — limited hedging</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Less predictable than a fixed tariff for budget planning</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>No export product — not suitable as primary tariff for solar households (though can be combined with a separate export product)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Customer Questions</h2>
            <FAQ
              q="What does SILVER- mean in the product code?"
              a="SILVER- is the internal product code prefix Octopus uses for the Tracker tariff (e.g. SILVER-26-04-01). It is not publicly listed in the products catalogue. Don't direct customers to search for a 'TRACKER-' product code — it doesn't exist under that name in the API."
            />
            <FAQ
              q="When is tomorrow's rate announced?"
              a="Rates for the following day are typically published between 9pm and 11pm. Customers can see them in the Octopus app as soon as they're published. If it's before ~9pm and tomorrow's rate isn't showing yet, that's expected."
            />
            <FAQ
              q="Is there a price cap on Tracker?"
              a="Yes. Ofgem requires Tracker rates to be capped at no more than 100% above the SVT price cap for that quarter. So if the electricity SVT cap is 24.5p/kWh, Tracker can't exceed 49p/kWh for electricity. Check constants/svt.js for the current cap figures."
            />
            <FAQ
              q="Can the customer get Tracker for gas only, not electricity?"
              a="Tracker is available as electricity-only, gas-only, or dual-fuel. Each fuel is billed separately. A customer can have Tracker for gas while on a different tariff for electricity, if they prefer."
            />
            <FAQ
              q="Is the Tracker tariff available in all regions?"
              a="Tracker is available in most GB regions but may not be available in some areas at certain times. Use the Tracker Price Tracker on this portal to check if rates are returned for the customer's region. If no data is returned, the tariff is not currently available there."
            />
          </div>
        )}

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

        {activeTab === 'knowledge-check' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Tracker Knowledge Check</h2>
            <p className="text-gray-300 text-sm mb-6">Scenario-based questions to test your Tracker knowledge. Questions shuffle each session.</p>
            <QuizPanel questions={TRACKER_QUIZ} />
          </div>
        )}

      </div>
    </main>
  );
}

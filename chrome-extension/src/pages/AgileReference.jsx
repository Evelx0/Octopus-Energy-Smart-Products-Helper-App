// Static staff reference page for the Agile Octopus tariff.
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
    objection: "Prices can spike to 100p/kWh — that's terrifying.",
    response: "Spikes are real but short-lived and predictable — they cluster around 4–9pm on cold weekday evenings. More than 80% of half-hourly slots over a typical month trade well below the SVT cap. Show the customer the 30-day average on the Agile Tracker. App alerts can notify them when rates are high so they can avoid the kettle.",
    escalateIf: ["Customer has completely inflexible usage and can't shift anything", "Customer is very anxious about variable bills"],
  },
  {
    objection: "My bill will be completely unpredictable month-to-month.",
    response: "Monthly direct debit is calculated from actual half-hourly reads, so it reflects real usage. Many Agile customers find their bills are consistently lower than on a fixed tariff — the peaks are visible but the cheap slots are much cheaper. The Octopus app shows a slot-by-slot cost breakdown so there are no surprises.",
    escalateIf: ["Customer relies on a strictly fixed budget and can't tolerate any variation"],
  },
  {
    objection: "I don't have time to check prices every 30 minutes.",
    response: "You don't need to. Most customers set appliance timers once and forget — washing machine overnight, dishwasher after midnight. App push notifications can alert for unusually cheap or expensive windows. EV and heat pump owners have charging automated by the tariff or smart controllers.",
    escalateIf: [],
  },
  {
    objection: "Negative prices — that sounds too good to be true.",
    response: "It's real. When the grid is flooded with renewable energy (overnight wind, sunny afternoons), wholesale prices go negative. Octopus automatically credits the account for consumption in those slots. Customers don't need to do anything — it shows up on the next bill.",
    escalateIf: [],
  },
  {
    objection: "I had a fixed tariff and felt safer. Why would I switch to something that varies?",
    response: "Fixed gives certainty; Agile gives potential savings. For customers who can shift even a portion of their usage, the annual average on Agile is often lower than the fixed rate. Show the 30-day average on the tracker vs the current Ofgem price cap. The 48h price preview means customers can plan their week.",
    escalateIf: ["Customer has had a bad experience with variable billing before", "Customer is elderly or vulnerable and prefers certainty"],
  },
  {
    objection: "Agile sounds too complicated — it's only for tech-savvy people.",
    response: "Setup is simple. Customers download the Octopus app, enable price notifications, and set a couple of timers on their appliances. Many non-technical customers on Agile report saving hundreds per year just by running the dishwasher before bed. The app does the heavy lifting.",
    escalateIf: [],
  },
];

const AGILE_QUIZ = [
  {
    q: "A customer calls at 6pm on a cold Monday. Their Agile rate is 72p/kWh. Is this normal? What do you tell them?",
    options: [
      { text: "Something is wrong — contact the billing team immediately.", correct: false, explanation: "72p/kWh during a cold weekday evening peak is within normal Agile behaviour. The 4–9pm peak window regularly sees elevated rates on cold winter evenings when national grid demand is highest." },
      { text: "Yes — this is expected during the 4–9pm peak window. Advise them to shift heavy usage to overnight or early morning slots.", correct: true, explanation: "Agile rates peak 4–9pm on cold weekday evenings. 72p/kWh is high but within the 100p cap. Reassure the customer: this window is short-lived, and overnight slots are typically 5–15p/kWh. App alerts can help them plan around it." },
      { text: "They should switch to a fixed tariff immediately.", correct: false, explanation: "A spike during peak hours doesn't mean Agile is wrong for this customer. First check their overall monthly average — if it's below the SVT cap, Agile is still working for them." },
      { text: "This is a billing error — Agile is capped at 50p/kWh.", correct: false, explanation: "The import cap is 100p/kWh, not 50p. Rates up to 100p are technically possible during extreme demand events." },
    ],
  },
  {
    q: "Which type of customer benefits MOST from Agile Octopus?",
    options: [
      { text: "A retired couple at home all day with no smart devices.", correct: false, explanation: "Without the ability to shift usage, a customer at home all day pays the going rate at all times, including peaks. They would likely do better on a flat-rate tariff." },
      { text: "An EV owner who charges overnight and can run appliances in off-peak slots.", correct: true, explanation: "Agile's biggest savings come from shifting large loads — EV charging, heat pump operation, washing — into overnight cheap windows (midnight–7am). EV owners with flexible lifestyles are the ideal Agile customer." },
      { text: "A prepayment customer who wants lower rates.", correct: false, explanation: "Agile is not available to prepayment customers. A credit meter is required." },
      { text: "A customer on Economy 7 who already has cheap overnight electricity.", correct: false, explanation: "Economy 7 is incompatible with Agile. E7 uses a two-register meter; Agile requires a single-register meter." },
    ],
  },
  {
    q: "How far ahead can a customer see their Agile prices?",
    options: [
      { text: "Up to 24 hours — published at midnight for the following day.", correct: false, explanation: "Agile prices cover a 4pm–4pm window, published at approximately 4pm each day. This gives up to 28–32 hours of advance visibility, not 24." },
      { text: "Only the current slot — prices are real-time only.", correct: false, explanation: "Agile is not real-time spot pricing. Customers can see all 48 half-hourly slots for the current 4pm–4pm period and the next one as soon as it's published." },
      { text: "Up to ~28–32 hours ahead — published at ~4pm for the next 4pm–4pm window.", correct: true, explanation: "Octopus publishes the next day's Agile prices at approximately 4pm each day. Since the window runs 4pm–4pm, by early morning customers can already see tomorrow evening's prices — giving 28–32+ hours of forward visibility." },
      { text: "7 days ahead — Agile prices are forecast weekly.", correct: false, explanation: "Agile prices are published daily, not weekly. Forecasts beyond the next 4pm–4pm window are not official Octopus data." },
    ],
  },
  {
    q: "A customer on Economy 7 wants to switch to Agile. What do you tell them?",
    options: [
      { text: "Economy 7 is fully compatible with Agile — they can switch immediately.", correct: false, explanation: "Economy 7 is NOT compatible with Agile. E7 uses a two-register meter which can't provide the single-register half-hourly reads that Agile requires." },
      { text: "Economy 7 is a soft block — they just need a meter upgrade first.", correct: false, explanation: "Economy 7 is a hard block for Agile. The customer would need a meter reconfiguration or replacement to move from two-register E7 to a single-register SMETS2 before Agile becomes possible." },
      { text: "Economy 7 metering is NOT compatible with Agile. They'd need a meter change before switching.", correct: true, explanation: "Agile requires a single-register smart meter sending half-hourly reads. Economy 7 uses a two-register setup that doesn't satisfy this. The customer would need their meter reconfigured — direct them to Octopus to assess feasibility." },
      { text: "Economy 7 customers get a better rate on Agile — recommend switching.", correct: false, explanation: "There is no Economy 7 + Agile combination. These are mutually exclusive metering setups." },
    ],
  },
  {
    q: "What is the maximum Agile import rate a customer can ever be charged?",
    options: [
      { text: "50p/kWh", correct: false, explanation: "The import cap is 100p/kWh, not 50p. 50p/kWh is high but not the ceiling." },
      { text: "100p/kWh", correct: true, explanation: "Agile import rates are capped at 100p/kWh inc. VAT. No import charge can exceed this, even during extreme grid stress events. Export rates can go negative (Octopus pays the customer)." },
      { text: "The SVT price cap — same as a standard tariff.", correct: false, explanation: "Agile's cap is 100p/kWh, which is higher than the Ofgem SVT cap. The SVT cap is a different regulatory instrument that applies to standard variable tariffs." },
      { text: "There is no cap — Agile is fully uncapped.", correct: false, explanation: "There is a cap of 100p/kWh on Agile import. This is a structural feature of the tariff, not a regulatory floor — Octopus applies it as part of the tariff design." },
    ],
  },
  {
    q: "A customer reports their bill showed a credit for energy used during a certain hour. What happened?",
    options: [
      { text: "There was a billing error — credit on consumption is impossible.", correct: false, explanation: "It's not a billing error — it's a negative price period. When Agile rates go negative, Octopus credits the customer for energy consumed in those slots." },
      { text: "The Agile rate went negative during that period — Octopus paid them to use electricity.", correct: true, explanation: "Negative rates happen during periods of surplus renewable generation (e.g. windy overnight periods). The import rate drops below zero, meaning Octopus credits the account for consumption in those slots. No action required from the customer." },
      { text: "The customer's solar export was incorrectly applied to their import bill.", correct: false, explanation: "Import and export are billed separately. A credit on import specifically indicates a negative import rate period, not a solar export mismatch." },
      { text: "The standing charge was waived for that day.", correct: false, explanation: "Standing charges are fixed daily amounts and are not waived. A consumption credit indicates a negative half-hourly rate." },
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

export default function AgileReference() {
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
          <span className="octopus-text-gradient">Agile Octopus</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Half-hourly variable electricity tariff. Prices track wholesale market rates and change every 30 minutes.
        </p>
        <div className="flex gap-3 mt-4">
          <Link to="/agile-tracker" className="text-sm text-teal-400 hover:text-teal-300 underline">
            → View live Agile prices
          </Link>
          <Link to="/tariffs/comparison" className="text-sm text-gray-300 hover:text-gray-300 underline">
            → Compare all tariffs
          </Link>
        </div>
      </header>

      <div className="print:hidden flex justify-end mb-4">
        <PrintButton />
      </div>

      <CallScriptsPanel tariff="agile" />

      <RefTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="octopus-card-bg rounded-2xl p-6 md:p-8">

        {activeTab === 'overview' && (
          <div className="space-y-2 text-gray-300 text-sm leading-relaxed">
            <h2 className="text-xl font-bold text-white mb-4">What It Is</h2>
            <p>Agile Octopus is a half-hourly variable electricity tariff. The unit rate changes every 30 minutes and tracks the wholesale electricity market. There are 48 pricing slots per day.</p>
            <p><strong className="text-white">Rate cycle:</strong> Prices cover a 4pm–4pm window. Octopus publishes rates at approximately 4pm each day for the following 4pm–4pm period.</p>
            <p><strong className="text-white">Price cap:</strong> Import rates are capped at 100p/kWh. Export rates can go negative (Octopus pays the customer).</p>
            <p><strong className="text-white">Billing:</strong> Monthly direct debit, calculated from actual smart meter readings.</p>
          </div>
        )}

        {activeTab === 'talking-points' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Key Customer Talking Points</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Prices can go negative</strong> — during periods of surplus renewable generation, the import price drops below zero, meaning customers are paid to use electricity.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Perfect for flexible usage</strong> — EV owners, heat pump users, and anyone who can shift washing, dishwashing, or charging to off-peak times can save significantly.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Full price transparency</strong> — customers can see every 30-minute price up to 48 hours ahead in the Octopus app, allowing them to plan energy use.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">Export available</strong> — solar customers can add Agile Outgoing for export rates that also vary half-hourly, paying the highest export rates during peak demand.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">App alerts</strong> — customers can set push notifications for when prices drop below a chosen threshold, or when rates are especially high.</span></li>
              <li className="flex gap-2"><span className="text-teal-400 mt-0.5">✓</span><span><strong className="text-white">No lock-in</strong> — customers can switch away at any time with no exit fees.</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'rate-structure' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Rate Structure</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Unit Rate</p>
                <p className="text-gray-300">48 half-hourly slots per day. Price in p/kWh inc. 5% VAT. Floor: can go negative. Cap: 100p/kWh.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Standing Charge</p>
                <p className="text-gray-300">Fixed daily charge (p/day) — does NOT vary half-hourly. Set per region. Shown on the customer's account.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Rate Window</p>
                <p className="text-gray-300">4pm to 4pm (UK local time). Published daily at ~4pm for the next full window.</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Billing</p>
                <p className="text-gray-300">Monthly direct debit. Calculated from actual half-hourly smart meter readings.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Smart Meter Requirements</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span><strong className="text-white">SMETS2 preferred</strong> — communicates via DCC, works reliably with all suppliers.</span></li>
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span><strong className="text-white">SMETS1 may work</strong> — if the meter has been enrolled in the DCC (most have been since ~2020). Check in the Octopus account tools if unsure.</span></li>
              <li className="flex gap-2"><span className="text-red-400 font-mono">✗</span><span><strong className="text-white">Economy 7 (E7) is NOT compatible</strong> — Agile requires a single-register meter. Economy 7 uses a two-register meter and will not work.</span></li>
              <li className="flex gap-2"><span className="text-white font-mono">→</span><span>The meter must be confirmed as sending half-hourly reads to Octopus before the customer can join Agile.</span></li>
            </ul>
          </div>
        )}

        {activeTab === 'eligibility' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Eligibility</h2>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>Available to all domestic Octopus customers with a compatible smart meter</span></li>
              <li className="flex gap-2"><span className="text-teal-400">✓</span><span>No EV, solar, or battery required</span></li>
              <li className="flex gap-2"><span className="text-red-400">✗</span><span>Not available to prepayment customers</span></li>
              <li className="flex gap-2"><span className="text-red-400">✗</span><span>Not available on Economy 7 metering</span></li>
              <li className="flex gap-2"><span className="text-amber-400">!</span><span>Business customers — Agile is a residential product; check with the business team</span></li>
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
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Potential for very low or negative prices during renewable surplus</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Full market transparency — no opaque markup</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>Excellent for EVs, heat pumps, and battery storage</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>48h price visibility allows advance planning</li>
                  <li className="flex gap-2"><span className="text-teal-400">+</span>No exit fees / no lock-in</li>
                </ul>
              </div>
              <div>
                <p className="text-red-400 font-semibold mb-3">Cons</p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex gap-2"><span className="text-red-400">−</span>Prices can spike significantly (especially 4–9pm weekdays in winter)</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Unsuitable for customers with inflexible usage patterns</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Bills are less predictable month-to-month vs a fixed tariff</li>
                  <li className="flex gap-2"><span className="text-red-400">−</span>Requires a compatible smart meter — not universally available</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Common Customer Questions</h2>
            <FAQ
              q="What if I forget to shift my usage to cheap slots?"
              a="The customer simply pays the going half-hourly rate for whatever they use. They won't be penalised — they just won't save as much. Agile is most beneficial for customers who actively engage with pricing."
            />
            <FAQ
              q="Can I combine Agile import with solar export?"
              a="Yes — Agile Outgoing (export product) can be paired with Agile Octopus for import. Export rates also vary half-hourly. Solar customers can earn the most during peak demand periods (4–7pm)."
            />
            <FAQ
              q="How does billing work if prices go negative?"
              a="When the import rate is negative, Octopus credits the customer's account for energy consumed during that period. This is automatically reflected in the monthly bill. The customer doesn't need to do anything."
            />
            <FAQ
              q="Why is the standing charge different in my region?"
              a="Standing charges are set per DNO region and reflect the local distribution network costs. They're fixed daily charges and don't vary half-hourly. Use the Agile tracker to see the standing charge for a specific region."
            />
            <FAQ
              q="What is the current Agile product code?"
              a="Agile product codes follow the pattern AGILE-YY-MM-DD (e.g. AGILE-24-10-01). The code changes when Octopus releases a new version of the tariff. Use the live tracker or /api/health to check the current active code."
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
            <h2 className="text-xl font-bold text-white mb-1">Agile Knowledge Check</h2>
            <p className="text-gray-300 text-sm mb-6">Scenario-based questions to test your Agile knowledge. Questions shuffle each session.</p>
            <QuizPanel questions={AGILE_QUIZ} />
          </div>
        )}

      </div>
    </main>
  );
}

// IO Go Onboarding Guide — interactive step-by-step slide cards for each setup path.
// No API calls. All content hardcoded. Images fetched as base64 URIs during build if added later.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import RefTabs from '../components/ui/RefTabs';

const TABS = [
  { id: 'ev-other',  label: 'EV Integration' },
  { id: 'tesla',     label: 'Tesla' },
  { id: 'ford',      label: 'Ford' },
  { id: 'charger',   label: 'Charger-Only Path' },
];

// ─── Multi-EV compatibility groups (source: octopus.energy/blog/intelligent-go-faqs/) ──
const MULTI_EV_GROUPS = [
  {
    group:     'Group 1',
    name:      'Universal',
    brands:    'Ford, Tesla',
    internal:  'Multiple cars supported. You can add any number of cars from this group.',
    combo:     'Fully combinable. Can be mixed with cars from Group 1, Group 2, and one car from Group 3.',
    internal_icon: '✅',
    combo_icon:    '✅',
  },
  {
    group:     'Group 2',
    name:      'Conditional',
    brands:    'Audi, BMW, Mini, CUPRA, Nissan, Porsche, SEAT, Skoda, Volkswagen',
    internal:  'Multiple cars supported, but they must be different brands.',
    combo:     'Fully combinable. Can be mixed with cars from Group 1, Group 2 (if different brands), and one car from Group 3.',
    internal_icon: '🆗',
    combo_icon:    '✅',
  },
  {
    group:     'Group 3',
    name:      'Limited',
    brands:    'Renault, Polestar',
    internal:  'Only one car from this group is allowed per account.',
    combo:     'Limited. Can be mixed with Group 1 or Group 2 cars. Cannot be mixed with another Group 3 car.',
    internal_icon: '⚠️',
    combo_icon:    '⚠️',
  },
  {
    group:     'Group 4',
    name:      'Chargers',
    brands:    'EVSE Integration',
    internal:  'Only one charger integration is allowed per account.',
    combo:     'Cannot be combined. Must be the only integration on the account. Cannot be mixed with any other group.',
    internal_icon: '❌',
    combo_icon:    '❌',
  },
];

// ─── Step content per path ──────────────────────────────────────────────────
// Each step: { title, instruction, staffTip?, warning?, multiEvTable? }

const STEPS = {
  'ev-other': [
    {
      title: 'Pre-flight check',
      instruction: 'Before starting, confirm the customer has all of the following: a compatible EV (check the Vehicle Checker tool) · SMETS2 smart meter active and sending half-hourly readings · Octopus app installed on their phone · car plugged in at home but NOT actively charging.',
      staffTip: 'Verify the exact car model on the IO Go Vehicle Checker before proceeding — some year variants have different compatibility. Note: VW Group (VW, Audi, Porsche, CUPRA, Skoda) uses We Connect; BMW/MINI uses BMW ConnectedDrive; Mercedes uses Mercedes me; Hyundai uses Bluelink; Kia uses Kia Connect; Polestar uses Polestar account; Volvo uses Volvo Cars; Renault uses My Renault. If the customer has multiple EVs, check the multi-EV compatibility table below — Group 2 cars (VW, BMW, etc.) require different brands to be mixed.',
      multiEvTable: true,
      warning: 'Customer must be within the 7-day connection window after switching to IO Go. If they have missed this window, they need to contact Octopus support to request an extension.',
    },
    {
      title: 'Open the Octopus app → Devices tab',
      instruction: 'Ask the customer to open their Octopus Energy app. At the bottom of the app, they should see a "Devices" tab. Tap it.',
      staffTip: 'If the Devices tab is not visible, this usually means the customer is not yet on the IO Go tariff, or the tariff has not fully activated yet. Confirm their tariff in the account section first.',
    },
    {
      title: 'Tap "Add Device" → "Electric Vehicle"',
      instruction: 'On the Devices screen, tap "Add Device". From the list of device types, select "Electric Vehicle".',
      staffTip: 'The car must be plugged in but not actively charging at this point. If the car is already charging, ask the customer to pause it before continuing.',
    },
    {
      title: 'Select EV make and model',
      instruction: 'A dropdown will appear asking for the car make and model. Ask the customer to select their exact vehicle. If multiple year options appear, select the correct year.',
      staffTip: 'Model selection affects battery capacity detection and smart charging calculations — accuracy here matters. If the customer is unsure of the trim/year, check their V5C or the car settings.',
    },
    {
      title: 'Select charger make and model',
      instruction: 'After selecting the car, the app asks for the home charger. Ask the customer to select their charger brand and model from the list.',
      staffTip: 'If the customer does not have a home charger, or their charger is not listed, the app may still work via car-API only — check if their car has direct EV integration. If charger is not listed, escalate to Octopus support or try the Charger-Only path.',
    },
    {
      title: 'Connect device — sign in with brand account',
      instruction: 'The app will show a brand-specific login screen. The customer needs to sign in with their EV brand account: VW/Audi/Porsche/CUPRA/Skoda → We Connect | BMW/MINI → BMW ConnectedDrive | Mercedes → Mercedes me | Hyundai → Bluelink | Kia → Kia Connect | Polestar → Polestar account | Volvo → Volvo Cars | Renault → My Renault. After signing in, authorise the connection.',
      staffTip: 'This is the most common failure point. The customer may not know their brand app credentials, or may have sharing/connectivity disabled in the car or brand app. Allow extra time here. If they need to reset a password, this can take a few minutes.',
      warning: 'Some brands require the customer to enable data sharing or vehicle connectivity in the car settings before the API connection will work. VW Group customers may need to enable "We Connect" connectivity in the car\'s infotainment system.',
    },
    {
      title: 'Confirm connection → Explore Dashboard',
      instruction: 'The app should show a green confirmation screen. Smart charging is now active. Ask the customer to set their "Ready by" time (departure time) and target charge percentage in the app.',
      staffTip: 'Recommend a "Ready by" time between 4am–8am for most customers — this gives the system flexibility to use the cheapest overnight slots. Recommend 80% as a sensible default charge target. Also remind the customer to check the March 2026 Charge Cap setting — if they have a large battery, they may want to configure this.',
    },
  ],

  'tesla': [
    {
      title: 'Pre-flight check',
      instruction: 'Confirm the customer has: IO Go tariff active · Octopus app installed · Tesla app installed and working on their phone · Mobile Access enabled in the Tesla car (Settings → Safety → Allow Mobile Access) · car plugged in at home but NOT actively charging.',
      staffTip: 'Multiple EVs can now be connected to one Octopus account — the old "one Tesla only" limit no longer applies. Tesla is Group 1 (Universal), so any number of Teslas are allowed. If the customer also has other EVs, check the multi-EV compatibility table below to confirm what combinations are supported. For pre-2021 Model S/X and leased vehicles, the virtual key step works differently — note this for step 5.',
      multiEvTable: true,
      warning: 'Customer must be within the 7-day connection window after switching to IO Go. If they have missed this window, contact Octopus support to request an extension.',
    },
    {
      title: 'Open Octopus app → Devices tab → Add Device',
      instruction: 'Ask the customer to open the Octopus Energy app. Tap the "Devices" tab at the bottom, then tap "Add Device". The car should be plugged in but not actively charging.',
      staffTip: 'If Devices tab is not visible, confirm the IO Go tariff is active on their account — it can take a few hours after the switch.',
    },
    {
      title: 'Select Tesla → choose model',
      instruction: 'From the "Add Device" screen, select "Electric Vehicle". Choose Tesla from the make dropdown, then select the specific model (Model 3, Model Y, Model S, or Model X).',
      staffTip: 'For pre-2021 Model S/X or leased Tesla vehicles, the connection flow is slightly different — virtual key addition is not required. If the customer is prompted for a virtual key and has a pre-2021 or leased car, they can skip that step.',
    },
    {
      title: 'Select charger make and model',
      instruction: 'Choose the home charger make and model from the list. Tesla works with all IO Go approved OCPP chargers. If the customer is using a Tesla Wall Connector, select this if available.',
      staffTip: 'If the customer does not have a dedicated home charger and uses a standard 3-pin plug, select the appropriate option. Smart charging still works via car-API without a smart charger.',
    },
    {
      title: 'Connect Tesla account — authorise access',
      instruction: 'The app will show a Tesla login screen. The customer signs in with their Tesla account credentials. After signing in, two permission checkboxes appear — both must be ticked: "Vehicle Information" and "Vehicle Charging Management". Then authorise the connection.',
      staffTip: 'The customer must tick BOTH permission boxes — "Vehicle Information" alone is not sufficient. If they miss one, the connection may appear to succeed but smart charging will not work correctly.',
      warning: 'For pre-2021 Model S/X and leased Teslas: virtual key addition is NOT required — if prompted, the customer can skip this step. Standard 2021+ models do require the virtual key to be added via Bluetooth.',
    },
    {
      title: 'Confirm connection → Explore Dashboard',
      instruction: 'Green confirmation screen appears — connection successful. Smart charging is now active. Advise the customer to set their "Ready by" departure time and target charge % in the Octopus app.',
      staffTip: 'Suggest the customer checks the Octopus app the following morning to verify the smart schedule activated and the car charged overnight. Also advise them to disable any pre-existing charging schedules on the Tesla app or car to avoid conflicts.',
    },
  ],

  'ford': [
    {
      title: 'Pre-flight check',
      instruction: 'Confirm the customer has: IO Go tariff active · Octopus app installed · Ford account credentials ready (the Ford.com account, not FordPass app login) · car plugged in at home but NOT actively charging.',
      staffTip: 'Ford setup uses the customer\'s Ford.com account credentials — not the FordPass app username. These are the same credentials used on ford.com. The customer may need to look these up before the call.',
      warning: 'Customer must be within the 7-day connection window after switching to IO Go.',
    },
    {
      title: 'Open Octopus app → Devices tab → Add Device',
      instruction: 'Ask the customer to open the Octopus Energy app. Tap "Devices" at the bottom, then tap "Add Device".',
    },
    {
      title: 'Select Electric Vehicle → Ford → Mustang Mach-E',
      instruction: 'Select "Electric Vehicle" as the device type. Choose Ford from the make dropdown, then select the Mustang Mach-E model.',
      staffTip: 'As of April 2026, the Ford Mustang Mach-E is the primary supported Ford model for full IO Go integration. If the customer has a different Ford EV, check the Vehicle Checker for their tier.',
    },
    {
      title: 'Select charger make and model',
      instruction: 'Choose the home charger from the list. If the customer has a Ford-supplied charger or compatible OCPP charger, select it. Otherwise select the most appropriate option.',
    },
    {
      title: 'Connect Ford account — authorise access',
      instruction: 'The app shows a Ford sign-in screen. The customer signs in with their Ford account credentials (the Ford.com login), selects their vehicle from the list, and authorises Octopus access.',
      staffTip: 'Remind the customer these are Ford.com credentials — not FordPass. If they\'ve forgotten their Ford account details, they\'ll need to reset via ford.com before continuing.',
    },
    {
      title: 'Confirm connection → Explore Dashboard',
      instruction: 'Confirmation screen appears — connection successful. Smart charging is now active. Advise the customer to set their "Ready by" time and target charge % in the Octopus app.',
      staffTip: 'Recommend disabling any existing charging schedule in the Ford app or on the charger to avoid conflicts with the IO Go smart schedule.',
    },
  ],

  'charger': [
    {
      title: 'Pre-flight check',
      instruction: 'This path is for cars without direct EV API integration — the charger handles the smart scheduling instead. Confirm: IO Go approved OCPP charger installed and connected · SMETS2 smart meter active · Octopus app installed · car plugged in but NOT actively charging.',
      staffTip: 'Check the Vehicle Checker — if the car shows "⚡ Via approved charger", this is the correct path. Cars on this path include MG, Nissan Ariya, Vauxhall, Peugeot, Citroën, DS, Fiat 500e, BYD, Smart, Ora, Jaguar I-PACE, Honda e, Mazda MX-30, Toyota bZ4X, Subaru Solterra.',
      warning: 'If the customer has an Ohme charger, there are additional configuration steps in the Ohme app after setup (step 5). Ohme users: do NOT skip the Ohme app configuration.',
    },
    {
      title: 'Open Octopus app → Devices tab → Add Device → Electric Vehicle',
      instruction: 'Open the Octopus app. Tap "Devices" at the bottom → "Add Device" → "Electric Vehicle". Select the car make and model from the dropdown.',
      staffTip: 'Even on the charger-only path, selecting the correct EV model helps Octopus with battery capacity estimates for scheduling calculations.',
    },
    {
      title: 'Select charger brand and model',
      instruction: 'After selecting the car, choose the charger make and model from the list. Tap "Connect Device" and follow the on-screen prompts to link the charger account if required.',
      staffTip: 'Most OCPP chargers (Ohme, Pod Point, Zappi, Hypervolt, Indra, EO, Rolec) connect via the charger\'s account credentials. The customer will need their charger app login details ready.',
    },
    {
      title: 'Confirm connection',
      instruction: 'Green confirmation appears. Smart scheduling via the OCPP charger is now active. Octopus will send charging schedules directly to the charger during the off-peak window.',
    },
    {
      title: 'Final configuration — disable conflicts & configure Ohme if applicable',
      instruction: 'Advise the customer to: (1) Disable any existing charging schedules on the car itself or in any charger app. (2) If they have an Ohme charger — open the Ohme app, enable "Dynamic Charging", set a "Ready by" time (4–11am recommended), set target charge %, and TURN OFF the "Price Cap" setting.',
      staffTip: 'The "Price Cap" setting in the Ohme app is a common issue — if left ON, it can interfere with the IO Go smart schedule. The smart charging rate is always billed at the off-peak rate regardless of Price Cap, so it should be OFF.',
      warning: 'Customers with Ohme: the Ohme app cost display is known to be inaccurate during the IO Go integration phase. All billing is correct in the Octopus account — not in the Ohme app.',
    },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MultiEvTable() {
  return (
    <div className="mt-3 mb-3">
      <p className="text-xs text-gray-300 font-semibold uppercase tracking-wide mb-2">Multi-EV Compatibility Rules</p>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-gray-300 border-b border-white/10">
              <th className="px-3 py-2 font-semibold whitespace-nowrap">Group</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">Name</th>
              <th className="px-3 py-2 font-semibold">Brands</th>
              <th className="px-3 py-2 font-semibold">Within Group</th>
              <th className="px-3 py-2 font-semibold">Mixing with Others</th>
            </tr>
          </thead>
          <tbody>
            {MULTI_EV_GROUPS.map((g, i) => (
              <tr
                key={g.group}
                className={`border-b border-white/5 align-top ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="px-3 py-2.5 text-purple-300 font-bold whitespace-nowrap">{g.group}</td>
                <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">{g.name}</td>
                <td className="px-3 py-2.5 text-gray-300">{g.brands}</td>
                <td className="px-3 py-2.5 text-gray-300">
                  <span className="mr-1">{g.internal_icon}</span>{g.internal}
                </td>
                <td className="px-3 py-2.5 text-gray-300">
                  <span className="mr-1">{g.combo_icon}</span>{g.combo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-300 mt-1.5">
        Source: <span className="text-gray-300">octopus.energy/blog/intelligent-go-faqs/</span> — to add a second EV, return to the Devices tab after connecting the first and repeat the process.
      </p>
    </div>
  );
}

function CompletionCard({ onRestart }) {
  return (
    <div className="octopus-card-bg rounded-2xl p-8 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-2xl font-black text-white mb-2">Setup complete!</h2>
      <p className="text-gray-300 text-sm mb-6 max-w-md mx-auto">
        The customer's EV is now connected to Intelligent Octopus Go. Smart charging will activate
        automatically during the next off-peak window.
      </p>
      <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
        <p className="text-teal-300 text-sm font-semibold mb-2">💡 Remind the customer to:</p>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>→ Set their "Ready by" departure time in the Octopus app</li>
          <li>→ Set a target charge % (80% recommended)</li>
          <li>→ Configure the Charge Cap setting (see March 2026 update)</li>
          <li>→ Disable any conflicting schedules on the car or charger app</li>
          <li>→ Enable app notifications for schedule alerts</li>
        </ul>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/tariffs/intelligent" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white">
          IO Go Reference Guide
        </Link>
        <Link to="/tariffs/intelligent-vehicles" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white">
          Vehicle Checker
        </Link>
        <Link to="/tariffs/intelligent-ocpp" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white">
          OCPP Diagnostics
        </Link>
      </div>
      <button
        onClick={onRestart}
        className="mt-4 text-xs text-gray-300 hover:text-gray-300 underline"
      >
        ← Start again
      </button>
    </div>
  );
}

function StepSlide({ steps, stepIndex, completed, onGoTo, onComplete }) {
  const step = steps[stepIndex];
  const total = steps.length;
  const isLast = stepIndex === total - 1;

  if (completed) {
    return <CompletionCard onRestart={() => onGoTo(0)} />;
  }

  return (
    <div className="octopus-card-bg rounded-2xl p-6 md:p-8">
      {/* Step counter */}
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-5xl font-black text-purple-400">{stepIndex + 1}</span>
        <span className="text-gray-300 text-sm">of {total}</span>
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-white mb-3">{step.title}</h2>

      {/* Instruction */}
      <p className="text-gray-300 text-sm leading-relaxed mb-4">{step.instruction}</p>

      {/* Staff tip */}
      {step.staffTip && (
        <div className="bg-teal-900/30 border border-teal-600/30 rounded-xl p-4 mb-3">
          <p className="text-teal-300 text-sm font-semibold mb-0.5">💡 Staff tip</p>
          <p className="text-gray-300 text-sm leading-relaxed">{step.staffTip}</p>
        </div>
      )}

      {/* Multi-EV compatibility table */}
      {step.multiEvTable && <MultiEvTable />}

      {/* Warning */}
      {step.warning && (
        <div className="bg-amber-900/30 border border-amber-600/30 rounded-xl p-4 mb-4">
          <p className="text-amber-300 text-sm leading-relaxed">⚠️ {step.warning}</p>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => onGoTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        {isLast ? (
          <button
            onClick={onComplete}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors"
          >
            Mark complete ✅
          </button>
        ) : (
          <button
            onClick={() => onGoTo(stepIndex + 1)}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            Next step →
          </button>
        )}
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-2 mt-5">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === stepIndex
                ? 'bg-purple-500'
                : i < stepIndex
                  ? 'bg-teal-600'
                  : 'bg-white/15 hover:bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IoGoOnboarding() {
  const [activeTab, setActiveTab] = useState('ev-other');
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  function handleTabChange(id) {
    setActiveTab(id);
    setStepIndex(0);
    setCompleted(false);
  }

  function handleGoTo(i) {
    const steps = STEPS[activeTab];
    if (i < 0 || i >= steps.length) return;
    setStepIndex(i);
    setCompleted(false);
  }

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Intelligent Octopus Go</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          <span className="octopus-text-gradient">Onboarding Guide</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Interactive step-by-step setup guide. Select the customer's setup path below, then work through each step together.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link to="/tariffs/intelligent" className="text-sm text-gray-300 hover:text-gray-300 underline">
            ← IO Go Reference
          </Link>
          <Link to="/tariffs/intelligent-vehicles" className="text-sm text-gray-300 hover:text-gray-300 underline">
            Vehicle Checker
          </Link>
        </div>
      </header>

      {/* Path info banners */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {[
          { id: 'ev-other', icon: '🔗', label: 'VW/BMW/Mercedes/Hyundai/Kia/Polestar/Volvo/Renault' },
          { id: 'tesla',    icon: '⚡', label: 'Tesla (all models)' },
          { id: 'ford',     icon: '🔵', label: 'Ford Mustang Mach-E' },
          { id: 'charger',  icon: '🔌', label: 'Charger-only (MG, Vauxhall, Peugeot, BYD & more)' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => handleTabChange(p.id)}
            className={`rounded-xl p-3 text-left transition-colors ${
              activeTab === p.id
                ? 'bg-purple-600/30 border border-purple-500/50'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="text-xl mb-1">{p.icon}</div>
            <p className="text-xs text-gray-300 leading-snug">{p.label}</p>
          </button>
        ))}
      </div>

      <RefTabs tabs={TABS} active={activeTab} onChange={handleTabChange} />

      {/* Step count indicator */}
      {!completed && (
        <p className="text-xs text-gray-300 mb-4">
          {STEPS[activeTab].length}-step guide · Step {stepIndex + 1} of {STEPS[activeTab].length}
        </p>
      )}

      <StepSlide
        steps={STEPS[activeTab]}
        stepIndex={stepIndex}
        completed={completed}
        onGoTo={handleGoTo}
        onComplete={() => setCompleted(true)}
      />

      {/* Footer notes */}
      <div className="mt-8 border-t border-white/10 pt-6">
        <p className="text-gray-300 text-xs">
          Setup guides sourced from Octopus Energy official onboarding pages (April 2026). Steps may change as Octopus updates the app — always verify with the customer's live Octopus app.
        </p>
        <p className="text-gray-300 text-xs mt-1">
          ⚠️ <strong className="text-gray-300">March 2026:</strong> IO Go now includes a 6-hour daily smart charging limit. Charging beyond 6 hours billed at Boost rate. See the IO Go Reference Guide → Smart Charging tab for full details.
        </p>
      </div>

    </main>
  );
}

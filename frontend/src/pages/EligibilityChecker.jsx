// Tariff Eligibility Checker
// Pure frontend logic — no API calls for the form itself.
// Optional postcode field triggers getRates() to identify region.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRates } from '../services/api';
import { REGION_INFO } from '../constants/regions';

const TARIFFS = [
  {
    id: 'agile',
    name: 'Agile Octopus',
    description: 'Half-hourly variable electricity. Best for flexible usage and EV/heat pump owners.',
    refPath: '/tariffs/agile',
    trackerPath: '/agile-tracker',
    colour: '#FF47A0',
    requires: {
      smartMeter: ['smets1', 'smets2'],
      noEconomy7: true,
    },
    notFor: ['prepay'],
  },
  {
    id: 'tracker',
    name: 'Octopus Tracker',
    description: 'Daily variable rate for both electricity and gas. Transparent wholesale pricing.',
    refPath: '/tariffs/tracker',
    trackerPath: '/tracker-prices',
    colour: '#f59e0b',
    requires: {
      smartMeter: ['smets1', 'smets2'],
    },
    notFor: ['prepay'],
  },
  {
    id: 'io-go',
    name: 'Intelligent Octopus Go',
    description: 'Fixed off-peak EV charging rate (11:30pm–5:30am). Fully automated smart scheduling.',
    refPath: '/tariffs/intelligent',
    colour: '#00A69C',
    requires: {
      smartMeter: ['smets2'],
      ev: true,
    },
    notFor: ['prepay'],
  },
  {
    id: 'go',
    name: 'Octopus Go',
    description: 'Simpler fixed off-peak rate without smart scheduling. Good for EV owners who prefer manual control.',
    refPath: null,
    colour: '#7c3aed',
    requires: {
      smartMeter: ['smets2'],
    },
    notFor: ['prepay'],
    note: 'Less saving potential than IO Go for EV owners who can use smart charging.',
  },
  {
    id: 'flux',
    name: 'Octopus Flux',
    description: 'Import + export time-of-use tariff for solar + battery households.',
    refPath: '/tariffs/flux',
    colour: '#3b82f6',
    requires: {
      smartMeter: ['smets2'],
      solar: true,
      battery: true,
    },
    notFor: ['prepay'],
  },
  {
    id: 'outgoing',
    name: 'Outgoing Octopus',
    description: 'Simple fixed export rate for solar households. Pairs with any import tariff.',
    refPath: null,
    colour: '#10b981',
    requires: {
      solar: true,
    },
    isExportOnly: true,
  },
];

function checkEligibility(tariff, form) {
  const reasons = [];
  const warnings = [];

  // Smart meter check
  if (tariff.requires?.smartMeter) {
    if (form.smartMeter === 'none') {
      return { eligible: false, reasons: ['No smart meter — a smart meter is required'] };
    }
    if (!tariff.requires.smartMeter.includes(form.smartMeter)) {
      if (form.smartMeter === 'smets1' && tariff.requires.smartMeter.includes('smets2')) {
        return { eligible: false, reasons: ['SMETS2 meter required — SMETS1 is not sufficient for this tariff'] };
      }
    }
    if (form.smartMeter === 'smets1' && tariff.requires.smartMeter.includes('smets2')) {
      return { eligible: false, reasons: ['SMETS2 required'] };
    }
    // SMETS1 warning for Agile
    if (form.smartMeter === 'smets1' && tariff.id === 'agile') {
      warnings.push('SMETS1 may not reliably support half-hourly reads — confirm DCC enrolment before recommending Agile');
    }
    reasons.push('Has compatible smart meter');
  }

  // Economy 7 block
  if (tariff.requires?.noEconomy7 && form.economy7 === 'yes') {
    return { eligible: false, reasons: ['Economy 7 metering is not compatible — a single-register meter is required'] };
  }

  // EV check
  if (tariff.requires?.ev) {
    if (form.ev !== 'yes') {
      return { eligible: false, reasons: ['Compatible EV with home charging required'] };
    }
    reasons.push('Has EV with home charging');
  }

  // Solar check
  if (tariff.requires?.solar) {
    if (form.solar !== 'yes') {
      return { eligible: false, reasons: ['Solar panels required'] };
    }
    reasons.push('Has solar panels');
  }

  // Battery check
  if (tariff.requires?.battery) {
    if (form.battery !== 'yes') {
      return { eligible: false, reasons: ['Home battery storage required'] };
    }
    reasons.push('Has home battery');
  }

  // Add EV/solar as positive notes where relevant but not required
  if (tariff.id === 'agile' && form.ev === 'yes') reasons.push('EV owner — high benefit potential for shifted overnight charging');
  if (tariff.id === 'agile' && form.solar === 'yes') reasons.push('Solar — can pair with Agile Outgoing for variable export rates');

  return { eligible: true, reasons, warnings };
}

// ─── Decision Tree mode ───────────────────────────────────────────────────────

const TREE_TARIFFS = [
  { id: 'agile',    name: 'Agile Octopus',          colour: '#FF47A0', refPath: '/tariffs/agile' },
  { id: 'tracker',  name: 'Octopus Tracker',         colour: '#f59e0b', refPath: '/tariffs/tracker' },
  { id: 'io-go',    name: 'Intelligent Octopus Go',  colour: '#00A69C', refPath: '/tariffs/intelligent' },
  { id: 'go',       name: 'Octopus Go',              colour: '#7c3aed', refPath: null },
  { id: 'flux',     name: 'Octopus Flux',            colour: '#3b82f6', refPath: '/tariffs/flux' },
  { id: 'cosy',     name: 'Cosy Octopus',            colour: '#f97316', refPath: '/tariffs/cosy' },
  { id: 'outgoing', name: 'Outgoing Octopus',        colour: '#10b981', refPath: null },
];

// Questions to ask per tariff (in sequence). answered[q.id] = value accumulates.
const TREE_QUESTIONS = {
  agile: [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2' },
      { value: 'smets1', label: 'SMETS1' },
      { value: 'none',   label: 'No smart meter / traditional' },
    ]},
    { id: 'economy7', q: 'Is the meter Economy 7 (dual-register)?', options: [
      { value: 'no',  label: 'No — single rate meter' },
      { value: 'yes', label: 'Yes — Economy 7 / dual register' },
    ]},
  ],
  tracker: [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2' },
      { value: 'smets1', label: 'SMETS1' },
      { value: 'none',   label: 'No smart meter / traditional' },
    ]},
  ],
  'io-go': [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2' },
      { value: 'smets1', label: 'SMETS1 or no smart meter' },
      { value: 'none',   label: 'No smart meter' },
    ]},
    { id: 'ev', q: 'Does the customer have an EV with a compatible home charger?', options: [
      { value: 'yes', label: 'Yes — EV + home charger' },
      { value: 'no',  label: 'No EV' },
    ]},
  ],
  go: [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2' },
      { value: 'smets1', label: 'SMETS1' },
      { value: 'none',   label: 'No smart meter' },
    ]},
  ],
  flux: [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2 (with export meter point)' },
      { value: 'smets1', label: 'SMETS1' },
      { value: 'none',   label: 'No smart meter' },
    ]},
    { id: 'solar', q: 'Does the customer have solar panels installed?', options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' },
    ]},
    { id: 'battery', q: 'Does the customer have a home battery storage system?', options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' },
    ]},
  ],
  cosy: [
    { id: 'smartMeter', q: 'What type of smart meter does the customer have?', options: [
      { value: 'smets2', label: 'SMETS2' },
      { value: 'smets1', label: 'SMETS1' },
      { value: 'none',   label: 'No smart meter' },
    ]},
  ],
  outgoing: [
    { id: 'solar', q: 'Does the customer have solar panels with an export meter point?', options: [
      { value: 'yes', label: 'Yes — has solar + export meter' },
      { value: 'no',  label: 'No solar or no export meter' },
    ]},
  ],
};

// Evaluate answers and return { eligible, reason, blockType, tip }
function evaluateTree(tariffId, answers) {
  const sm  = answers.smartMeter;
  const e7  = answers.economy7;
  const ev  = answers.ev;
  const sol = answers.solar;
  const bat = answers.battery;

  if (tariffId === 'agile') {
    if (sm === 'none') return { eligible: false, reason: 'Smart meter required (SMETS1 or SMETS2)', blockType: 'hard', tip: 'Customer needs a smart meter installed first.' };
    if (e7 === 'yes')  return { eligible: false, reason: 'Economy 7 / dual-register metering is not compatible', blockType: 'hard', tip: 'Agile requires a single-register smart meter. Economy 7 cannot be combined.' };
    const warn = sm === 'smets1' ? 'SMETS1 may not reliably support half-hourly reads — confirm DCC enrolment before proceeding.' : null;
    return { eligible: true, reason: 'Meets all requirements for Agile Octopus', warning: warn };
  }
  if (tariffId === 'tracker') {
    if (sm === 'none') return { eligible: false, reason: 'Smart meter required', blockType: 'hard', tip: 'Customer needs a smart meter installed first.' };
    return { eligible: true, reason: 'Meets all requirements for Octopus Tracker' };
  }
  if (tariffId === 'io-go') {
    if (sm !== 'smets2') return { eligible: false, reason: 'SMETS2 smart meter required', blockType: 'hard', tip: 'SMETS1 and traditional meters are not supported. Customer needs a SMETS2 upgrade.' };
    if (ev !== 'yes')   return { eligible: false, reason: 'Compatible EV with home charger required', blockType: 'soft', tip: 'Customer is eligible once they get a compatible EV. Check the Vehicle Checker for their model.' };
    return { eligible: true, reason: 'Meets all requirements for Intelligent Octopus Go' };
  }
  if (tariffId === 'go') {
    if (sm !== 'smets2') return { eligible: false, reason: 'SMETS2 smart meter required', blockType: 'hard', tip: 'SMETS1 and traditional meters are not supported.' };
    return { eligible: true, reason: 'Meets basic requirements for Octopus Go' };
  }
  if (tariffId === 'flux') {
    if (sm !== 'smets2') return { eligible: false, reason: 'SMETS2 smart meter with export meter point required', blockType: 'hard', tip: 'Flux requires a SMETS2 meter and an active export meter point.' };
    if (sol !== 'yes')   return { eligible: false, reason: 'Solar panels required', blockType: 'soft', tip: 'Customer is eligible once they have solar installed.' };
    if (bat !== 'yes')   return { eligible: false, reason: 'Home battery storage required', blockType: 'soft', tip: 'Customer is eligible once they have a battery installed. Solar alone is not sufficient.' };
    return { eligible: true, reason: 'Meets all three requirements for Octopus Flux (SMETS2 + solar + battery)' };
  }
  if (tariffId === 'cosy') {
    if (sm === 'none') return { eligible: false, reason: 'Smart meter required (SMETS1 or SMETS2)', blockType: 'hard', tip: 'Customer needs a smart meter installed first.' };
    return { eligible: true, reason: 'Meets requirements for Cosy Octopus', tip: 'Best suited for homes with heat pumps, electric boilers, or electric radiators.' };
  }
  if (tariffId === 'outgoing') {
    if (sol !== 'yes') return { eligible: false, reason: 'Solar panels + export meter required', blockType: 'soft', tip: 'Customer is eligible once they have solar with an export meter point.' };
    return { eligible: true, reason: 'Meets requirements for Outgoing Octopus' };
  }
  return { eligible: false, reason: 'Unknown tariff', blockType: 'hard' };
}

function DecisionTree() {
  const [step,     setStep]     = useState(0); // 0=tariff, 1..n=questions, final=result
  const [tariffId, setTariffId] = useState(null);
  const [answers,  setAnswers]  = useState({});

  const questions = tariffId ? (TREE_QUESTIONS[tariffId] || []) : [];
  const isResult  = tariffId && step > questions.length;
  const curQ      = !isResult && step > 0 ? questions[step - 1] : null;
  const tariffObj = TREE_TARIFFS.find(t => t.id === tariffId);
  const result    = isResult ? evaluateTree(tariffId, answers) : null;

  function pickTariff(id) {
    setTariffId(id);
    setAnswers({});
    setStep(1);
  }

  function answer(qId, val) {
    const newAnswers = { ...answers, [qId]: val };
    setAnswers(newAnswers);
    setStep(s => s + 1);
  }

  function reset() {
    setStep(0); setTariffId(null); setAnswers({});
  }

  function back() {
    if (step === 1) { setStep(0); setTariffId(null); setAnswers({}); }
    else { setStep(s => s - 1); }
  }

  return (
    <div className="octopus-card-bg rounded-2xl p-6 space-y-5">
      {/* Breadcrumb */}
      {step > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <button onClick={reset} className="hover:text-white transition-colors">Decision Tree</button>
          {tariffObj && <><span>›</span><span className="text-gray-300">{tariffObj.name}</span></>}
          {step > 1 && <><span>›</span><span className="text-gray-400">Step {step - 1} of {questions.length}</span></>}
          {isResult && <><span>›</span><span className="text-white font-medium">Result</span></>}
        </div>
      )}

      {/* Step 0: Pick tariff */}
      {step === 0 && (
        <div>
          <p className="text-white font-semibold mb-4">Which tariff are you checking eligibility for?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TREE_TARIFFS.map(t => (
              <button
                key={t.id}
                onClick={() => pickTariff(t.id)}
                className="octopus-card-bg border border-white/10 hover:border-white/30 rounded-xl p-3 text-left transition-colors group"
              >
                <p className="font-semibold text-sm group-hover:text-white" style={{ color: t.colour }}>{t.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step n: Current question */}
      {curQ && (
        <div>
          <p className="text-white font-semibold mb-4">{curQ.q}</p>
          <div className="flex flex-wrap gap-2">
            {curQ.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => answer(curQ.id, opt.value)}
                className="px-4 py-2.5 bg-white/5 hover:bg-purple-600/50 border border-white/10 hover:border-purple-500/60 rounded-xl text-sm text-gray-200 hover:text-white transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={back} className="mt-4 text-xs text-gray-400 hover:text-gray-300 transition-colors">← Back</button>
        </div>
      )}

      {/* Result */}
      {isResult && result && (
        <div>
          <div className={`rounded-xl p-4 border ${
            result.eligible
              ? 'bg-teal-900/20 border-teal-500/30'
              : 'bg-red-900/15 border-red-500/25'
          }`}>
            <p className={`text-lg font-bold mb-1 ${result.eligible ? 'text-teal-300' : 'text-red-300'}`}>
              {result.eligible ? '✅ Eligible' : '❌ Not eligible'}
            </p>
            <p className="text-white font-semibold text-sm">{tariffObj?.name}</p>
            <p className="text-gray-300 text-sm mt-1">{result.reason}</p>
            {result.warning && (
              <p className="text-amber-300 text-xs mt-2">⚠️ {result.warning}</p>
            )}
            {!result.eligible && result.blockType && (
              <p className="mt-2 text-xs">
                <span className={`font-semibold ${result.blockType === 'hard' ? 'text-red-400' : 'text-amber-400'}`}>
                  {result.blockType === 'hard' ? '🔴 Hard block' : '🟡 Soft block — fixable'}
                </span>
                {result.tip && <span className="text-gray-300 ml-1">— {result.tip}</span>}
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            {tariffObj?.refPath && (
              <Link to={tariffObj.refPath} className="text-xs text-purple-300 hover:text-white underline">
                Full {tariffObj.name} guide →
              </Link>
            )}
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-300 transition-colors ml-auto">
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EligibilityChecker() {
  const [mode, setMode] = useState('form'); // 'form' | 'tree'
  const [form, setForm] = useState({
    smartMeter: '',
    economy7:   'no',
    ev:         'no',
    solar:      'no',
    battery:    'no',
    prepay:     'no',
    postcode:   '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [regionResult, setRegionResult] = useState(null);
  const [regionLoading, setRegionLoading] = useState(false);

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);

    // Optional postcode lookup
    if (form.postcode.trim()) {
      setRegionLoading(true);
      try {
        const data = await getRates(form.postcode.trim());
        if (data.gsp) {
          const clean = data.gsp.replace(/^_/, '').toUpperCase();
          if (REGION_INFO[clean]) {
            setRegionResult({ code: clean, info: REGION_INFO[clean] });
          }
        }
      } catch (_) {
        // Postcode lookup is optional — silently ignore errors
      } finally {
        setRegionLoading(false);
      }
    }
  }

  const results = submitted
    ? TARIFFS.map(t => ({ tariff: t, ...checkEligibility(t, form) }))
    : [];

  const eligible   = results.filter(r => r.eligible);
  const ineligible = results.filter(r => !r.eligible);

  const RadioGroup = ({ label, field, options }) => (
    <div>
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label: optLabel }) => (
          <button
            key={value}
            type="button"
            onClick={() => setField(field, value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              form[field] === value
                ? 'bg-pink-500 border-pink-500 text-white'
                : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
            }`}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">

      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tariff Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
          <span className="octopus-text-gradient">Eligibility Checker</span>
        </h1>
        <p className="text-gray-300">
          Fill in the customer's setup to see which Octopus smart tariffs they're eligible for and why.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('form')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === 'form'
              ? 'bg-purple-600 border-purple-500 text-white'
              : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/40 hover:text-white'
          }`}
        >
          📋 Full Form
        </button>
        <button
          onClick={() => setMode('tree')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === 'tree'
              ? 'bg-purple-600 border-purple-500 text-white'
              : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/40 hover:text-white'
          }`}
        >
          🌳 Step-by-Step Tree
        </button>
      </div>

      {/* Decision Tree mode */}
      {mode === 'tree' && <DecisionTree />}

      {/* Form mode */}
      {mode === 'form' && <form onSubmit={handleSubmit} className="octopus-card-bg rounded-2xl p-6 space-y-6">

        <RadioGroup
          label="Smart meter type"
          field="smartMeter"
          options={[
            { value: 'smets2', label: 'SMETS2' },
            { value: 'smets1', label: 'SMETS1' },
            { value: 'none',   label: 'No smart meter' },
          ]}
        />

        <RadioGroup
          label="Economy 7 (dual-register) metering?"
          field="economy7"
          options={[
            { value: 'no',  label: 'No (single rate)' },
            { value: 'yes', label: 'Yes (Economy 7)' },
          ]}
        />

        <RadioGroup
          label="Electric vehicle with home charging?"
          field="ev"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no',  label: 'No' },
          ]}
        />

        <RadioGroup
          label="Solar panels?"
          field="solar"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no',  label: 'No' },
          ]}
        />

        <RadioGroup
          label="Home battery storage?"
          field="battery"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no',  label: 'No' },
          ]}
        />

        <RadioGroup
          label="Prepayment customer?"
          field="prepay"
          options={[
            { value: 'no',  label: 'No (credit)' },
            { value: 'yes', label: 'Yes (prepay)' },
          ]}
        />

        <div>
          <p className="text-sm font-medium text-white mb-2">Customer postcode (optional — identifies region)</p>
          <input
            type="text"
            value={form.postcode}
            onChange={e => setForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))}
            placeholder="e.g. SO15 2AE"
            maxLength={8}
            className="w-48 bg-gray-900/50 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 uppercase text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!form.smartMeter}
          className="w-full cta-button bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl"
        >
          Check Eligibility
        </button>
      </form>}

      {/* Results */}
      {mode === 'form' && submitted && (
        <div className="mt-8 space-y-6">

          {/* Region bonus */}
          {(regionLoading || regionResult) && (
            <div className="octopus-card-bg rounded-xl p-4 text-sm">
              {regionLoading && <p className="text-gray-400">Looking up region…</p>}
              {regionResult && !regionLoading && (
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-teal-400 font-semibold">Region Identified</p>
                    <p className="text-white">Region {regionResult.code} — {regionResult.info.name}</p>
                    <p className="text-gray-400 text-xs">GSP: {regionResult.info.gsp} · {regionResult.info.dno}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Link to={`/agile-tracker?region=${regionResult.code}`} className="text-xs text-pink-400 hover:underline">Agile rates →</Link>
                    <Link to={`/tracker-prices?region=${regionResult.code}`} className="text-xs text-teal-400 hover:underline">Tracker rates →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Eligible tariffs */}
          {eligible.length > 0 && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-400 mb-3">
                Compatible Tariffs ({eligible.length})
              </p>
              <div className="space-y-3">
                {eligible.map(({ tariff, reasons, warnings }) => (
                  <div key={tariff.id} className="octopus-card-bg rounded-xl p-4 border border-teal-500/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-white" style={{ color: tariff.colour }}>{tariff.name}</p>
                        <p className="text-gray-300 text-sm mt-0.5">{tariff.description}</p>
                        {tariff.isExportOnly && (
                          <p className="text-amber-400 text-xs mt-1">Export-only — customer still needs a separate import tariff</p>
                        )}
                        {tariff.note && (
                          <p className="text-amber-400 text-xs mt-1">{tariff.note}</p>
                        )}
                        <ul className="mt-2 space-y-0.5">
                          {reasons.map((r, i) => (
                            <li key={i} className="text-xs text-teal-300 flex gap-1.5">
                              <span>✓</span><span>{r}</span>
                            </li>
                          ))}
                          {warnings.map((w, i) => (
                            <li key={i} className="text-xs text-amber-300 flex gap-1.5">
                              <span>⚠</span><span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {tariff.refPath && (
                        <Link to={tariff.refPath} className="text-xs text-gray-400 hover:text-white whitespace-nowrap underline">
                          Full guide →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ineligible tariffs */}
          {ineligible.length > 0 && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Not Compatible ({ineligible.length})
              </p>
              <div className="space-y-2">
                {ineligible.map(({ tariff, reasons }) => (
                  <div key={tariff.id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-gray-400 font-medium text-sm">{tariff.name}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{reasons[0]}</p>
                    </div>
                    {tariff.refPath && (
                      <Link to={tariff.refPath} className="text-xs text-gray-600 hover:text-gray-400 underline whitespace-nowrap">
                        guide
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </main>
  );
}

import { useEffect, useState } from 'react';
import { clearSessionSummary, getSessionSummary, getToolShortcuts, saveToolShortcuts } from '../../src/services/storage.js';
import { openOptionsPage } from '../utils.js';

const TOOLS = [
  { label: '⚡ Agile Tracker',    hash: '/agile-tracker' },
  { label: '📈 Tracker Prices',   hash: '/tracker-prices' },
  { label: '🧮 Bill Simulator',   hash: '/bill-calculator' },
  { label: '✅ Eligibility',       hash: '/eligibility' },
  { label: '🔌 OCPP Diagnostics', hash: '/tariffs/intelligent-ocpp' },
  { label: '🚗 Vehicle Checker',  hash: '/tariffs/intelligent-vehicles' },
  { label: '🔗 Deep Links',       hash: '/deep-link-builder' },
  { label: '🧭 Fit Matrix',       hash: '/tariff-fit-matrix' },
  { label: '🧠 Knowledge Base',   hash: '/knowledge-base' },
];

const DEFAULT_TOOL_HASHES = TOOLS.slice(0, 6).map(tool => tool.hash);

export default function ToolsPage() {
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shortcutHashes, setShortcutHashes] = useState(DEFAULT_TOOL_HASHES);
  const [editingShortcuts, setEditingShortcuts] = useState(false);

  async function refreshSummary() {
    setSummary(await getSessionSummary());
  }

  useEffect(() => {
    refreshSummary();
    getToolShortcuts().then(saved => setShortcutHashes(saved || DEFAULT_TOOL_HASHES));
  }, []);

  async function toggleShortcut(hash) {
    const next = shortcutHashes.includes(hash)
      ? shortcutHashes.filter(item => item !== hash)
      : [...shortcutHashes, hash].slice(0, 6);
    setShortcutHashes(next);
    await saveToolShortcuts(next);
  }

  async function copySessionSummary() {
    if (!navigator.clipboard) return;
    const regions = Object.entries(summary?.lookupRegions || {})
      .map(([region, count]) => `${region} x${count}`)
      .join(', ') || 'none';
    const tariffs = Object.entries(summary?.billingByTariff || {})
      .map(([tariff, count]) => `${tariff} x${count}`)
      .join(', ') || 'none';
    await navigator.clipboard.writeText([
      `Session summary`,
      `Lookups: ${summary?.lookups || 0} (${regions})`,
      `Billing checks: ${summary?.billingChecks || 0} (${tariffs})`,
      `Tariff pages opened: ${summary?.tariffPages || 0}`,
      `Alerts acknowledged: ${summary?.alertsAcknowledged || 0}`,
    ].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function clearSummary() {
    await clearSessionSummary();
    await refreshSummary();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {TOOLS.filter(t => shortcutHashes.includes(t.hash)).map(t => (
          <button
            key={t.hash}
            type="button"
            onClick={() => openOptionsPage(t.hash)}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-[#2E2252] hover:bg-purple-800 text-gray-200 transition-colors text-left"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-[#2E2252] rounded-xl p-3 border border-white/10">
        <button
          type="button"
          onClick={() => setEditingShortcuts(value => !value)}
          className="w-full flex items-center justify-between text-left text-xs font-semibold text-white"
        >
          <span>⭐ Favourite Tools</span>
          <span className="text-[10px] text-gray-300">{editingShortcuts ? '▲' : '▼'}</span>
        </button>
        {editingShortcuts && (
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {TOOLS.map(tool => (
              <button
                key={tool.hash}
                type="button"
                onClick={() => toggleShortcut(tool.hash)}
                className={`text-left px-2 py-1.5 rounded-lg text-[11px] border ${shortcutHashes.includes(tool.hash) ? 'bg-purple-700/60 border-purple-500/50 text-white' : 'bg-[#150E38] border-white/10 text-gray-300'}`}
              >
                {shortcutHashes.includes(tool.hash) ? '✓ ' : ''}{tool.label}
              </button>
            ))}
            <p className="text-[10px] text-gray-300">Pick up to 6. Stored in Chrome sync.</p>
          </div>
        )}
      </div>
      <div className="bg-[#2E2252] rounded-xl p-3 border border-white/10">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-white">📊 My Session</p>
          <button type="button" onClick={refreshSummary} className="text-[11px] text-gray-300 hover:text-white">Refresh</button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-[#150E38] rounded-lg p-2">
            <p className="text-base font-bold text-white">{summary?.lookups || 0}</p>
            <p className="text-[10px] text-gray-300">Lookups</p>
          </div>
          <div className="bg-[#150E38] rounded-lg p-2">
            <p className="text-base font-bold text-white">{summary?.billingChecks || 0}</p>
            <p className="text-[10px] text-gray-300">Bills</p>
          </div>
          <div className="bg-[#150E38] rounded-lg p-2">
            <p className="text-base font-bold text-white">{summary?.tariffPages || 0}</p>
            <p className="text-[10px] text-gray-300">Pages</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copySessionSummary}
            className="flex-1 py-1.5 rounded-lg bg-[#150E38] hover:bg-purple-900 text-gray-200 text-xs transition-colors"
          >
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <button
            type="button"
            onClick={clearSummary}
            className="px-3 py-1.5 rounded-lg bg-[#150E38] hover:bg-purple-900 text-gray-300 text-xs transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openOptionsPage()}
        className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition-colors"
      >
        Open Full App →
      </button>
    </div>
  );
}

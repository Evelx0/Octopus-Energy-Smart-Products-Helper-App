/**
 * RefTabs — shared tab strip for reference pages.
 * Matches the visual style of the tab strips used in AgileTracker and TrackerPriceTracker.
 *
 * Props:
 *   tabs    — array of { id: string, label: string }
 *   active  — id of the currently active tab
 *   onChange — (id: string) => void
 */
export default function RefTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              active === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

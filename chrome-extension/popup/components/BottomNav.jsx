const TABS = [
  { id: 'home',   icon: '⚡', label: 'Home'   },
  { id: 'lookup', icon: '📍', label: 'Lookup' },
  { id: 'rates',  icon: '📊', label: 'Rates'  },
  { id: 'tools',  icon: '🔧', label: 'Tools'  },
];

export default function BottomNav({ current, onChange }) {
  return (
    <nav className="flex border-t border-white/10 bg-[#0d0924]">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-colors ${
            current === tab.id ? 'text-pink-400' : 'text-gray-300 hover:text-white'
          }`}
        >
          <span className="text-base leading-none">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

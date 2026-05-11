export default function StatCard({ label, value, unit, valueClass = 'text-white' }) {
  return (
    <div className="flex-1 bg-[#2E2252] rounded-xl px-3 py-3">
      <p className="text-xs text-gray-300 mb-1">{label}</p>
      <p className={`text-2xl font-black ${valueClass}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-300">{unit}</p>
    </div>
  );
}

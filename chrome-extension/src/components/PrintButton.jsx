export default function PrintButton({ label = 'Print / Save as PDF' }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold transition-colors"
    >
      <span aria-hidden="true">🖨</span>
      {label}
    </button>
  );
}

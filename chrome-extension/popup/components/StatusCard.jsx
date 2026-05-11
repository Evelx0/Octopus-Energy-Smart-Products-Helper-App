export default function StatusCard({ loading, error, loadingText = 'Loading...', children }) {
  if (loading) {
    return (
      <div className="bg-[#2E2252] rounded-xl p-3 text-center text-sm text-gray-300">
        {loadingText}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#2E2252] rounded-xl p-3 text-xs text-red-300 border border-red-700/40">
        {error}
      </div>
    );
  }

  return children;
}

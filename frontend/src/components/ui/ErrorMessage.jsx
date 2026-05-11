export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="text-center py-10">
      <p className="text-2xl text-red-400">😢</p>
      <h2 className="text-2xl font-bold text-red-400 mt-2">Something went wrong</h2>
      <p className="mt-2 text-gray-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="cta-button mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// Global alert banner — polls /api/get-alert-status every 5 minutes.
// Renders nothing when no alerts are active.
// Cycles through multiple alerts via a 4-second marquee.
// Session-dismissible: stores the current alert fingerprint in sessionStorage.

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAlertStatus } from '../services/api';

const TIER_STYLES = {
  red:   'bg-red-900/90 border-red-500/60 text-red-100',
  green: 'bg-teal-900/90 border-teal-500/60 text-teal-100',
};

const DISMISS_KEY = 'alertBannerDismissed';

function fingerprint(alerts) {
  return alerts.map(a => a.message).join('|');
}

export default function AlertBanner() {
  const [alerts,       setAlerts]       = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed,    setDismissed]    = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlertStatus();
      const incoming = data.alerts || [];
      setAlerts(incoming);
      setCurrentIndex(0);

      // Re-show if the alert set has changed since the user dismissed
      if (incoming.length > 0) {
        const stored = sessionStorage.getItem(DISMISS_KEY);
        if (stored !== fingerprint(incoming)) {
          setDismissed(false);
        }
      }
    } catch {
      // On error: keep existing state — don't flash a false clear
    }
  }, []);

  // Initial fetch + 5-minute poll
  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  // Cycle through multiple alerts every 4 seconds
  useEffect(() => {
    if (alerts.length <= 1) return;
    const id = setInterval(() => setCurrentIndex(i => (i + 1) % alerts.length), 4000);
    return () => clearInterval(id);
  }, [alerts]);

  // Nothing to show
  if (!alerts.length || dismissed) return null;

  const active = alerts[currentIndex] || alerts[0];
  const tierStyle = TIER_STYLES[active.tier] || TIER_STYLES.green;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, fingerprint(alerts));
    setDismissed(true);
  }

  return (
    <div
      className={`w-full border-b px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium ${tierStyle}`}
      role="alert"
    >
      <span className="flex-1 min-w-0 truncate">{active.message}</span>
      {alerts.length > 1 && (
        <span className="text-xs opacity-60 flex-shrink-0">
          {currentIndex + 1}/{alerts.length}
        </span>
      )}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity ml-2 text-base leading-none"
        aria-label="Dismiss alert banner"
      >
        ×
      </button>
    </div>
  );
}

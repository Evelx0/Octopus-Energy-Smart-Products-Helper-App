export const CI_LABEL = {
  'very low': 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very high': 'Very High',
};

export const CI_COLOR = {
  'very low': 'text-green-400',
  low: 'text-green-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  'very high': 'text-red-400',
};

export const FUEL_COLOR = {
  gas:     '#F97316',
  coal:    '#6B7280',
  nuclear: '#A855F7',
  wind:    '#06B6D4',
  solar:   '#EAB308',
  hydro:   '#3B82F6',
  biomass: '#22C55E',
  imports: '#EC4899',
  other:   '#9CA3AF',
};

export const FUEL_LABEL = {
  gas: 'Gas',
  coal: 'Coal',
  nuclear: 'Nuclear',
  wind: 'Wind',
  solar: 'Solar',
  hydro: 'Hydro',
  biomass: 'Biomass',
  imports: 'Imports',
  other: 'Other',
};

export function openOptionsPage(hash = '') {
  chrome.tabs.create({
    url: chrome.runtime.getURL('options/options.html') + (hash ? '#' + hash : ''),
  });
}

export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatAge(timestamp) {
  if (!timestamp) return null;
  const ageMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'updated just now';
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `updated ${days}d ago`;
}

export function currentSlot(rates, now = new Date()) {
  if (!Array.isArray(rates)) return null;
  return rates.find(r => {
    const from = new Date(r.valid_from);
    const to = r.valid_to ? new Date(r.valid_to) : new Date(from.getTime() + 30 * 60 * 1000);
    return now >= from && now < to;
  }) ?? null;
}

export function rateColor(pence) {
  if (pence === null || pence === undefined) return 'text-gray-300';
  return pence < 10 ? 'text-teal-400' : pence <= 25 ? 'text-yellow-400' : 'text-red-400';
}

export function agileBadgeColor(pence, { stale = false } = {}) {
  if (stale) return '#6B7280';
  if (pence < 10) return '#00A69C';
  if (pence <= 25) return '#F59E0B';
  return '#EF4444';
}

export function priceAlertType(pence, settings) {
  if (!settings?.enabled) return null;
  if (pence <= settings.cheapThreshold) return 'cheap';
  if (pence >= settings.expensiveThreshold) return 'expensive';
  return null;
}

export function billingVerdict(avg, contextAvg) {
  if (avg === null || avg === undefined || !contextAvg) return null;
  const pct = Math.round(((avg - contextAvg) / contextAvg) * 100);
  if (Math.abs(pct) < 5) {
    return {
      pct,
      label: 'In-line with market',
      className: 'bg-teal-900/40 text-teal-300 border-teal-600/40',
    };
  }
  if (pct > 0) {
    return {
      pct,
      label: `${pct}% above market average`,
      className: 'bg-yellow-900/40 text-yellow-300 border-yellow-600/40',
    };
  }
  return {
    pct,
    label: `${Math.abs(pct)}% below market average`,
    className: 'bg-pink-900/40 text-pink-300 border-pink-600/40',
  };
}

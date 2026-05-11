export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function findCheapestWindow(rates, durationMinutes, now = new Date()) {
  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / 30));
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const slots = (rates || [])
    .filter(rate => {
      const from = new Date(rate.valid_from);
      return from >= now && from <= end && Number.isFinite(rate.value_inc_vat);
    })
    .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));

  let best = null;
  for (let i = 0; i <= slots.length - slotsNeeded; i += 1) {
    const block = slots.slice(i, i + slotsNeeded);
    const contiguous = block.every((slot, idx) => {
      if (idx === 0) return true;
      const prev = new Date(block[idx - 1].valid_from);
      return new Date(slot.valid_from).getTime() === prev.getTime() + 30 * 60 * 1000;
    });
    if (!contiguous) continue;
    const avg = block.reduce((sum, slot) => sum + slot.value_inc_vat, 0) / block.length;
    if (!best || avg < best.avg) {
      const last = block[block.length - 1];
      best = {
        start: new Date(block[0].valid_from),
        end: last.valid_to ? new Date(last.valid_to) : new Date(new Date(last.valid_from).getTime() + 30 * 60 * 1000),
        avg,
        min: Math.min(...block.map(slot => slot.value_inc_vat)),
        max: Math.max(...block.map(slot => slot.value_inc_vat)),
      };
    }
  }
  return best;
}

export function classifyAgileDay(rates, now = new Date()) {
  const today = toDateString(now);
  const todayRates = (rates || []).filter(rate => toDateString(new Date(rate.valid_from)) === today);
  if (!todayRates.length) return { label: 'Waiting for rates', text: 'Today’s Agile profile is not available yet.', tone: 'text-gray-300' };

  const values = todayRates.map(rate => rate.value_inc_vat);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const evening = todayRates.filter(rate => {
    const hour = new Date(rate.valid_from).getHours();
    return hour >= 16 && hour < 21;
  });
  const eveningAvg = evening.length ? evening.reduce((sum, rate) => sum + rate.value_inc_vat, 0) / evening.length : avg;

  if (min < 0) return { label: 'Negative-price opportunity', text: 'At least one slot goes below 0p today.', tone: 'text-teal-400' };
  if (avg < 10 && max < 20) return { label: 'Flat cheap day', text: 'Prices stay broadly low across the day.', tone: 'text-teal-400' };
  if (eveningAvg > avg * 1.6 && eveningAvg > 25) return { label: 'Evening spike day', text: 'The main risk is concentrated in the 4pm-9pm window.', tone: 'text-amber-400' };
  if (max - min > 30) return { label: 'Volatile spread day', text: 'There is a wide gap between cheap and expensive slots.', tone: 'text-amber-400' };
  return { label: 'Normal day', text: 'Today looks close to a typical Agile profile.', tone: 'text-gray-200' };
}

export function bestCarbonBalancedWindow(rates, carbonSeries, durationMinutes) {
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const cheapest = findCheapestWindow(rates, durationMinutes, now);
  if (!cheapest) return null;
  if (!Array.isArray(carbonSeries) || !carbonSeries.length) {
    return { cheapest, greenest: null, balanced: cheapest };
  }

  const carbonByTime = new Map(carbonSeries.map(item => [new Date(item.from || item.valid_from).getTime(), item.intensity?.forecast ?? item.forecast ?? null]));
  const windows = [];
  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / 30));
  const sorted = (rates || [])
    .filter(rate => {
      const from = new Date(rate.valid_from);
      return from >= now && from <= end && Number.isFinite(rate.value_inc_vat);
    })
    .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
  for (let i = 0; i <= sorted.length - slotsNeeded; i += 1) {
    const block = sorted.slice(i, i + slotsNeeded);
    const contiguous = block.every((slot, idx) => {
      if (idx === 0) return true;
      const prev = new Date(block[idx - 1].valid_from);
      return new Date(slot.valid_from).getTime() === prev.getTime() + 30 * 60 * 1000;
    });
    if (!contiguous) continue;
    const price = block.reduce((sum, rate) => sum + rate.value_inc_vat, 0) / block.length;
    const carbonValues = block.map(rate => carbonByTime.get(new Date(rate.valid_from).getTime())).filter(value => value != null);
    if (!carbonValues.length) continue;
    const carbon = carbonValues.reduce((sum, value) => sum + value, 0) / carbonValues.length;
    const last = block[block.length - 1];
    windows.push({
      start: new Date(block[0].valid_from),
      end: last.valid_to ? new Date(last.valid_to) : new Date(new Date(last.valid_from).getTime() + 30 * 60 * 1000),
      avg: price,
      carbon,
    });
  }
  if (!windows.length) return { cheapest, greenest: null, balanced: cheapest };
  const greenest = [...windows].sort((a, b) => a.carbon - b.carbon)[0];
  const minPrice = Math.min(...windows.map(w => w.avg));
  const maxPrice = Math.max(...windows.map(w => w.avg));
  const minCarbon = Math.min(...windows.map(w => w.carbon));
  const maxCarbon = Math.max(...windows.map(w => w.carbon));
  const balanced = [...windows].sort((a, b) => {
    const score = w => ((w.avg - minPrice) / Math.max(1, maxPrice - minPrice)) + ((w.carbon - minCarbon) / Math.max(1, maxCarbon - minCarbon));
    return score(a) - score(b);
  })[0];
  return { cheapest, greenest, balanced };
}

export function formatWindow(window) {
  if (!window) return 'No suitable window found';
  const opts = { hour: '2-digit', minute: '2-digit' };
  return `${window.start.toLocaleTimeString('en-GB', opts)}-${window.end.toLocaleTimeString('en-GB', opts)} at ${window.avg.toFixed(1)}p/kWh`;
}

export function tariffFitScores(profile) {
  const scores = [
    { tariff: 'Intelligent Octopus Go', score: 0, reasons: [] },
    { tariff: 'Agile Octopus', score: 0, reasons: [] },
    { tariff: 'Octopus Tracker', score: 0, reasons: [] },
    { tariff: 'Flux', score: 0, reasons: [] },
    { tariff: 'Cosy Octopus', score: 0, reasons: [] },
  ];
  const add = (tariff, points, reason) => {
    const row = scores.find(item => item.tariff === tariff);
    row.score += points;
    row.reasons.push(reason);
  };

  if (profile.ev) {
    add('Intelligent Octopus Go', 4, 'EV with home charging');
    add('Agile Octopus', 2, 'EV can shift charging');
  }
  if (profile.solar && profile.battery) add('Flux', 5, 'Solar plus battery');
  if (profile.solar && !profile.battery) add('Agile Octopus', 1, 'Solar can pair with export');
  if (profile.heatPump) {
    add('Cosy Octopus', 4, 'Heat pump schedule fit');
    add('Agile Octopus', 1, 'Heat pump can shift if flexible');
  }
  if (profile.flexibleUsage) add('Agile Octopus', 4, 'Flexible usage');
  if (profile.certainty) {
    add('Octopus Tracker', 2, 'Simpler daily rate than half-hourly');
    add('Agile Octopus', -2, 'Less budget certainty');
  }
  if (!profile.ev && !profile.solar && !profile.heatPump) add('Octopus Tracker', 3, 'Simple smart tariff starting point');

  return scores.sort((a, b) => b.score - a.score);
}

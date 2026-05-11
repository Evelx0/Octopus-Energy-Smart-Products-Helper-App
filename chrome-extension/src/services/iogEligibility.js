import { getIogEligibilityOptions } from './api.js';
import { getIogEligibilityCache, setIogEligibilityCache } from './storage.js';

let inflightIogRequest = null;

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

export function formatBatterySize(value) {
  const num = typeof value === 'number' ? value : toNumber(value);
  return num == null ? null : `${num.toFixed(1)} kWh`;
}

export function formatPower(value) {
  const num = typeof value === 'number' ? value : toNumber(value);
  return num == null ? null : `${num.toFixed(1)}kW`;
}

function sortByLabel(a, b) {
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

function normalizeVehicle(vehicleMake, model) {
  const make = cleanText(vehicleMake);
  const modelName = cleanText(model?.model);
  const batterySize = toNumber(model?.batterySize);
  const batteryLabel = formatBatterySize(batterySize);

  return {
    id: String(model?.vehicleId ?? ''),
    make,
    model: modelName,
    integrationStatus: cleanText(model?.integrationStatus) || 'NOT_AVAILABLE',
    batterySize,
    label: batteryLabel ? `${modelName} (${batteryLabel})` : modelName,
  };
}

function normalizeCharger(chargerMake, model) {
  const make = cleanText(chargerMake);
  const modelName = cleanText(model?.model);
  const powerInKw = toNumber(model?.powerInKw);
  const powerLabel = formatPower(powerInKw);

  return {
    id: String(model?.variantId ?? ''),
    make,
    model: modelName,
    integrationStatus: cleanText(model?.integrationStatus) || 'NOT_AVAILABLE',
    powerInKw,
    label: powerLabel ? `${modelName} (${powerLabel})` : modelName,
  };
}

function groupByMake(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.make]) acc[item.make] = [];
    acc[item.make].push(item);
    return acc;
  }, {});
}

export function normalizeIogEligibilityData(payload) {
  const data = payload?.data ?? payload ?? {};

  const vehicles = (data.electricVehicles || [])
    .flatMap(entry => (entry?.models || []).map(model => normalizeVehicle(entry.make, model)))
    .filter(item => item.make && item.model && item.id)
    .sort(sortByLabel);

  const chargers = (data.chargePointVariants || [])
    .flatMap(entry => (entry?.models || []).map(model => normalizeCharger(entry.make, model)))
    .filter(item => item.make && item.model && item.id)
    .sort(sortByLabel);

  const vehiclesByMake = groupByMake(vehicles);
  const chargersByMake = groupByMake(chargers);
  const vehicleMakes = Object.keys(vehiclesByMake).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const chargerMakes = Object.keys(chargersByMake).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  Object.values(vehiclesByMake).forEach(list => list.sort(sortByLabel));
  Object.values(chargersByMake).forEach(list => list.sort(sortByLabel));

  return {
    vehicleMakes,
    chargerMakes,
    vehiclesByMake,
    chargersByMake,
  };
}

function buildIogErrorMessage(err) {
  if (err?.name === 'AbortError') return 'The IOG checker timed out. Please try again.';
  return err?.message || 'The live IOG checker could not be loaded.';
}

export async function getIogEligibilityData({ forceRefresh = false } = {}) {
  const cached = await getIogEligibilityCache();

  if (!forceRefresh && inflightIogRequest) return inflightIogRequest;

  inflightIogRequest = (async () => {
    try {
      const payload = await getIogEligibilityOptions();
      const normalized = payload?.vehicleMakes ? payload : normalizeIogEligibilityData(payload);
      const fetchedAt = payload?.checkedAt ? Date.parse(payload.checkedAt) : Date.now();
      await setIogEligibilityCache(normalized);
      return {
        ...normalized,
        fetchedAt,
        stale: Boolean(payload?.stale),
        warning: payload?.warning || null,
      };
    } catch (err) {
      if (cached?.data) {
        return {
          ...cached.data,
          fetchedAt: cached.fetchedAt,
          stale: true,
          error: buildIogErrorMessage(err),
        };
      }
      throw new Error(buildIogErrorMessage(err));
    } finally {
      inflightIogRequest = null;
    }
  })();

  return inflightIogRequest;
}

function isStatus(item, status) {
  return item?.integrationStatus === status;
}

export function getIogEligibilityOutcome({ vehicle, charger }) {
  if (!vehicle || !charger) return null;

  if (isStatus(vehicle, 'GENERALLY_AVAILABLE')) {
    return {
      level: 'success',
      title: 'Eligible',
      message: 'This setup is eligible for Intelligent Octopus Go.',
      detail: `${vehicle.make} ${vehicle.label} is marked as compatible.`,
    };
  }

  if (isStatus(charger, 'GENERALLY_AVAILABLE')) {
    return {
      level: 'success',
      title: 'Eligible',
      message: 'This setup is eligible for Intelligent Octopus Go.',
      detail: `Eligibility is coming through the ${charger.make} ${charger.label} charger path.`,
    };
  }

  return {
    level: 'error',
    title: 'Not eligible',
    message: 'This setup is not currently eligible for Intelligent Octopus Go.',
    detail: 'Neither the selected vehicle nor the selected charger is currently marked as compatible.',
  };
}

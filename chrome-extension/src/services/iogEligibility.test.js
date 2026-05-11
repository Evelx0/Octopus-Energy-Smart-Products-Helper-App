import { describe, expect, it } from 'vitest';
import {
  formatBatterySize,
  formatPower,
  getIogEligibilityOutcome,
  normalizeIogEligibilityData,
} from './iogEligibility.js';

const samplePayload = {
  data: {
    electricVehicles: [
      {
        make: 'BMW',
        models: [
          {
            vehicleId: 1878,
            model: 'X5 xDrive50e',
            integrationStatus: 'GENERALLY_AVAILABLE',
            batterySize: '25.70',
          },
          {
            vehicleId: 3000,
            model: ' i3 120 Ah ',
            integrationStatus: 'TESTING',
            batterySize: '37.90',
          },
        ],
      },
      {
        make: 'Abarth',
        models: [
          {
            vehicleId: 3057,
            model: '600e Scorpionissima',
            integrationStatus: 'NOT_AVAILABLE',
            batterySize: '50.80',
          },
        ],
      },
    ],
    chargePointVariants: [
      {
        make: 'Ohme',
        models: [
          {
            variantId: 901,
            model: 'Home Pro Charger',
            powerInKw: '7.000',
            integrationStatus: 'GENERALLY_AVAILABLE',
          },
        ],
      },
      {
        make: 'Zaptec',
        models: [
          {
            variantId: 330,
            model: 'Zaptec Go',
            powerInKw: '7.400',
            integrationStatus: 'TESTING',
          },
        ],
      },
    ],
  },
};

describe('normalizeIogEligibilityData', () => {
  it('groups and sorts live vehicles and chargers by make', () => {
    const normalized = normalizeIogEligibilityData(samplePayload);

    expect(normalized.vehicleMakes).toEqual(['Abarth', 'BMW']);
    expect(normalized.chargerMakes).toEqual(['Ohme', 'Zaptec']);
    expect(normalized.vehiclesByMake.BMW[0].label).toBe('i3 120 Ah (37.9 kWh)');
    expect(normalized.vehiclesByMake.BMW[1].label).toBe('X5 xDrive50e (25.7 kWh)');
    expect(normalized.chargersByMake.Ohme[0].label).toBe('Home Pro Charger (7.0kW)');
  });
});

describe('formatters', () => {
  it('formats battery sizes for display', () => {
    expect(formatBatterySize('25.70')).toBe('25.7 kWh');
  });

  it('formats charger power for display', () => {
    expect(formatPower('7.000')).toBe('7.0kW');
  });
});

describe('getIogEligibilityOutcome', () => {
  const normalized = normalizeIogEligibilityData(samplePayload);
  const bmw = normalized.vehiclesByMake.BMW[1];
  const abarth = normalized.vehiclesByMake.Abarth[0];
  const ohme = normalized.chargersByMake.Ohme[0];
  const zaptec = normalized.chargersByMake.Zaptec[0];

  it('prefers direct vehicle availability when the car is supported', () => {
    const outcome = getIogEligibilityOutcome({ vehicle: bmw, charger: ohme });
    expect(outcome.level).toBe('success');
    expect(outcome.title).toBe('Eligible');
    expect(outcome.detail).toContain('BMW X5 xDrive50e (25.7 kWh)');
  });

  it('falls back to charger availability when the vehicle is not supported', () => {
    const outcome = getIogEligibilityOutcome({ vehicle: abarth, charger: ohme });
    expect(outcome.level).toBe('success');
    expect(outcome.detail).toContain('Ohme Home Pro Charger (7.0kW)');
  });

  it('returns a rejection when neither path is available', () => {
    const unavailableCharger = { ...zaptec, integrationStatus: 'NOT_AVAILABLE' };
    const outcome = getIogEligibilityOutcome({ vehicle: abarth, charger: unavailableCharger });
    expect(outcome.level).toBe('error');
    expect(outcome.title).toBe('Not eligible');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  agileBadgeColor,
  billingVerdict,
  currentSlot,
  formatAge,
  priceAlertType,
  rateColor,
  toDateString,
} from './utils.js';

const slots = [
  { valid_from: '2026-05-08T00:00:00+01:00', valid_to: '2026-05-08T00:30:00+01:00', value_inc_vat: 4.2 },
  { valid_from: '2026-05-08T00:30:00+01:00', valid_to: '2026-05-08T01:00:00+01:00', value_inc_vat: 12.4 },
  { valid_from: '2026-05-08T01:00:00+01:00', value_inc_vat: 31.8 },
];

describe('toDateString', () => {
  it('formats a local date as yyyy-mm-dd', () => {
    expect(toDateString(new Date(2026, 4, 8))).toBe('2026-05-08');
  });

  it('pads single-digit month and day values', () => {
    expect(toDateString(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('does not emit time data', () => {
    expect(toDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('currentSlot', () => {
  it('finds the slot containing now', () => {
    expect(currentSlot(slots, new Date('2026-05-08T00:45:00+01:00'))).toBe(slots[1]);
  });

  it('treats valid_to as exclusive', () => {
    expect(currentSlot(slots, new Date('2026-05-08T00:30:00+01:00'))).toBe(slots[1]);
  });

  it('falls back to a 30 minute slot when valid_to is missing', () => {
    expect(currentSlot(slots, new Date('2026-05-08T01:15:00+01:00'))).toBe(slots[2]);
  });

  it('returns null when no rate matches', () => {
    expect(currentSlot(slots, new Date('2026-05-08T02:00:00+01:00'))).toBeNull();
  });

  it('returns null for non-array data', () => {
    expect(currentSlot(null, new Date('2026-05-08T00:45:00+01:00'))).toBeNull();
  });
});

describe('rate thresholds', () => {
  it('maps missing UI rates to neutral text', () => {
    expect(rateColor(null)).toBe('text-gray-300');
  });

  it('maps cheap UI rates to teal', () => {
    expect(rateColor(9.99)).toBe('text-teal-400');
  });

  it('maps mid UI rates to yellow', () => {
    expect(rateColor(25)).toBe('text-yellow-400');
  });

  it('maps expensive UI rates to red', () => {
    expect(rateColor(25.01)).toBe('text-red-400');
  });

  it('maps badge colours using Agile thresholds', () => {
    expect(agileBadgeColor(8)).toBe('#00A69C');
    expect(agileBadgeColor(18)).toBe('#F59E0B');
    expect(agileBadgeColor(35)).toBe('#EF4444');
  });

  it('uses grey for stale badge data', () => {
    expect(agileBadgeColor(8, { stale: true })).toBe('#6B7280');
  });
});

describe('priceAlertType', () => {
  const settings = { enabled: true, cheapThreshold: 5, expensiveThreshold: 35 };

  it('returns cheap below the configured threshold', () => {
    expect(priceAlertType(4.9, settings)).toBe('cheap');
  });

  it('returns expensive above the configured threshold', () => {
    expect(priceAlertType(35, settings)).toBe('expensive');
  });

  it('returns null between configured thresholds', () => {
    expect(priceAlertType(18, settings)).toBeNull();
  });

  it('returns null when alerts are disabled', () => {
    expect(priceAlertType(2, { ...settings, enabled: false })).toBeNull();
  });
});

describe('billingVerdict', () => {
  it('returns null without a usable context average', () => {
    expect(billingVerdict(12, 0)).toBeNull();
  });

  it('classifies rates within 5 percent as in-line', () => {
    expect(billingVerdict(102, 100)?.label).toBe('In-line with market');
  });

  it('classifies rates above context', () => {
    expect(billingVerdict(118, 100)?.label).toBe('18% above market average');
  });

  it('classifies rates below context', () => {
    expect(billingVerdict(78, 100)?.label).toBe('22% below market average');
  });
});

describe('formatAge', () => {
  it('formats very recent data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T10:00:20Z'));
    expect(formatAge(Date.parse('2026-05-08T10:00:00Z'))).toBe('updated just now');
    vi.useRealTimers();
  });

  it('formats minute-old data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T10:12:00Z'));
    expect(formatAge(Date.parse('2026-05-08T10:00:00Z'))).toBe('updated 12m ago');
    vi.useRealTimers();
  });

  it('formats hour-old data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    expect(formatAge(Date.parse('2026-05-08T10:00:00Z'))).toBe('updated 2h ago');
    vi.useRealTimers();
  });
});

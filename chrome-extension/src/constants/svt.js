// Ofgem SVT (Standard Variable Tariff) Price Cap Reference
//
// UPDATE THIS EACH QUARTER when Ofgem publishes new price cap figures.
// Current figures are for Q2 2026 (April–June 2026).
// Source: https://www.ofgem.gov.uk/check-if-energy-price-cap-affects-you
//
// All values are INCLUSIVE of 5% VAT, in pence.
// Unit rates: p/kWh. Standing charges: p/day.

export const SVT_CAP = {
  electricity: {
    unitRate:       24.50,   // p/kWh inc. VAT
    standingCharge: 61.64,   // p/day inc. VAT
  },
  gas: {
    unitRate:        6.24,   // p/kWh inc. VAT
    standingCharge: 31.65,   // p/day inc. VAT
  },
  quarter:   'Q2 2026 (Apr–Jun)',
  updatedAt: '2026-04-01',
};

// UK DNO Regions — 14 regions (A–P, excluding I and O)
// Used by AgileTracker, TrackerPriceTracker, RegionLookup, and EligibilityChecker
// to display GSP codes, region names, and DNO operators alongside rate data.

export const REGION_INFO = {
  A: { name: 'Eastern England',        gsp: '_A', dno: 'UK Power Networks' },
  B: { name: 'East Midlands',          gsp: '_B', dno: 'Western Power Distribution' },
  C: { name: 'London',                 gsp: '_C', dno: 'UK Power Networks' },
  D: { name: 'Merseyside & N Wales',   gsp: '_D', dno: 'SP Manweb' },
  E: { name: 'Midlands',               gsp: '_E', dno: 'Western Power Distribution' },
  F: { name: 'North East England',     gsp: '_F', dno: 'Northern Powergrid' },
  G: { name: 'North West England',     gsp: '_G', dno: 'Electricity North West' },
  H: { name: 'Southern England',       gsp: '_H', dno: 'Scottish & Southern (SSEN)' },
  J: { name: 'South East England',     gsp: '_J', dno: 'UK Power Networks' },
  K: { name: 'South West England',     gsp: '_K', dno: 'Western Power Distribution' },
  L: { name: 'Wales',                  gsp: '_L', dno: 'Western Power Distribution' },
  M: { name: 'West Midlands',          gsp: '_M', dno: 'Western Power Distribution' },
  N: { name: 'Yorkshire',              gsp: '_N', dno: 'Northern Powergrid' },
  P: { name: 'South Scotland',         gsp: '_P', dno: 'SP Energy Networks' },
};

// Ordered array for use in <select> elements and lists
export const REGION_LIST = Object.entries(REGION_INFO).map(([code, info]) => ({
  code,
  ...info,
}));

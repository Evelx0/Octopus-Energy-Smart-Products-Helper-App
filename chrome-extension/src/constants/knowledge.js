export const KNOWLEDGE_ARTICLES = [
  {
    id: 'agile-suitability',
    category: 'Agile',
    title: 'Is Agile a good fit?',
    summary: 'Agile works best when the customer can shift meaningful usage away from 4pm-9pm and into cheap or negative slots.',
    keywords: ['agile', 'suitability', 'flexible usage', 'ev', 'battery', 'shift'],
    points: [
      'Ask what can move: EV charging, dishwasher, washing machine, immersion heater, battery charging.',
      'If most usage is fixed in the evening peak, Tracker or a fixed tariff may be easier to explain and budget.',
      'Use the Agile tracker and Bill Simulator together: price potential plus realistic usage pattern.',
    ],
  },
  {
    id: 'agile-spikes',
    category: 'Agile',
    title: 'Explaining Agile price spikes',
    summary: 'Spikes are usually short-lived and visible ahead of time. The customer pays by the half-hour slot they actually use.',
    keywords: ['agile', 'spike', 'high price', 'peak', '4pm', '9pm'],
    points: [
      'Frame spikes as a timing signal, not a permanent price.',
      'Point out the cheapest upcoming slots and whether today is unusually volatile.',
      'For worried customers, compare the daily average and SVT reference rather than only the worst slot.',
    ],
  },
  {
    id: 'tracker-rate-change',
    category: 'Tracker',
    title: 'Tracker rate changes',
    summary: 'Tracker rates update daily, with product-level changes commonly noticed around monthly cap or formula changes.',
    keywords: ['tracker', 'rate change', 'silver', 'daily', 'gas', 'electricity'],
    points: [
      'Tracker is not fixed: electricity and gas can move independently.',
      'Use the Tracker page for today, tomorrow, and historical context.',
      'If the customer wants certainty rather than transparency, discuss fixed or Flexible alternatives.',
    ],
  },
  {
    id: 'ocpp-troubleshooting',
    category: 'IO Go',
    title: 'OCPP troubleshooting first checks',
    summary: 'Most charger issues start with connectivity, authorisation, or stale firmware before they become tariff problems.',
    keywords: ['ocpp', 'charger', 'diagnostics', 'io go', 'intelligent', 'error'],
    points: [
      'Confirm the charger is online and visible in the manufacturer app.',
      'Check the OCPP Diagnostics page for the exact payload or error string.',
      'Escalate repeated authentication failures or chargers offline for more than 24 hours.',
    ],
  },
  {
    id: 'flux-framework',
    category: 'Flux',
    title: 'Flux decision framework',
    summary: 'Flux is strongest when the customer has solar, a home battery, and can use the battery to avoid peak imports.',
    keywords: ['flux', 'solar', 'battery', 'export', 'peak'],
    points: [
      'Solar plus battery plus SMETS2 export is the core eligibility path.',
      'The behaviour change is simple: fill cheaply, avoid 4pm-7pm imports, export when valuable.',
      'Solar-only customers usually need Outgoing rather than Flux.',
    ],
  },
  {
    id: 'cosy-framework',
    category: 'Cosy',
    title: 'Cosy heat pump rhythm',
    summary: 'Cosy is about scheduling heat into the three cheap windows and reducing demand during the 4pm-7pm peak.',
    keywords: ['cosy', 'heat pump', 'schedule', 'cheap window', 'peak'],
    points: [
      'Pre-heat during 13:00-16:00 so the home can coast through the peak.',
      'Set the heat pump controller itself, not only the Octopus app.',
      'If the home cools too quickly, the issue may be insulation, emitter sizing, or heat pump settings.',
    ],
  },
  {
    id: 'smart-meter-terms',
    category: 'Glossary',
    title: 'Core smart product terms',
    summary: 'MPAN is electricity, MPRN is gas, GSP/DNO gives the region, and SMETS2 is the preferred smart meter generation.',
    keywords: ['mpan', 'mprn', 'gsp', 'dno', 'smets2', 'terminology'],
    points: [
      'GSP drives regional electricity rates and tariff suffixes.',
      'Half-hourly settlement means usage can be priced by 30-minute slots.',
      'Economy 7 and multi-register setups can block some smart tariffs.',
    ],
  },
];

export const KNOWLEDGE_CATEGORIES = ['All', ...new Set(KNOWLEDGE_ARTICLES.map(article => article.category))];

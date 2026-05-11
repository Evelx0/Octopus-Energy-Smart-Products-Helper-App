export const RELEASE_NOTES = [
  {
    version: '1.0.0',
    date: '2026-05-08',
    title: 'Pass 3 foundation',
    changes: [
      'Added System Health install checks, build metadata, storage migrations, and local error diagnostics.',
      'Added workflow helpers for deep links, favourite popup tools, duration planning, carbon-aware planning, and recommendation copy.',
      'Added release notes, update summary prompts, tariff fit guidance, and richer Agile/Tracker insight cards.',
    ],
    limitations: [
      'No customer/Kraken lookup is included.',
      'Telemetry remains local-only unless a backend contract is explicitly added.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-08',
    title: 'Pass 2 observability and knowledge',
    changes: [
      'Added System Health, Knowledge Base, announcements, feature flags, version banners, and local session summary.',
      'Added DFS Watch, Grid Stress, Agile volatility, Tracker timeline, print support, and call scripts.',
    ],
    limitations: [
      'Optional backend endpoints fail softly when absent.',
    ],
  },
];

export function latestReleaseNote() {
  return RELEASE_NOTES[0];
}

import { useState } from 'react';
import { tariffFitScores } from '../utils/insights';

const QUESTIONS = [
  ['ev', 'EV with home charging'],
  ['solar', 'Solar panels'],
  ['battery', 'Home battery'],
  ['heatPump', 'Heat pump or electric heating'],
  ['flexibleUsage', 'Can shift usage timing'],
  ['certainty', 'Strong preference for budget certainty'],
];

export default function TariffFitMatrix() {
  const [profile, setProfile] = useState({});
  const results = tariffFitScores(profile);

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">
      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Tools</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          Smart Tariff <span className="octopus-text-gradient">Fit Matrix</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          A local coaching aid for matching household traits to smart tariff conversations.
        </p>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <section className="octopus-card-bg rounded-2xl p-5 h-fit">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-3">Household traits</p>
          <div className="space-y-2">
            {QUESTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setProfile(p => ({ ...p, [key]: !p[key] }))}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${profile[key] ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}
              >
                {profile[key] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
        </section>

        <section className="octopus-card-bg rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-3">Best fit</p>
          <div className="space-y-3">
            {results.map((row, idx) => (
              <div key={row.tariff} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-white font-semibold">{idx + 1}. {row.tariff}</p>
                  <span className="text-xs text-gray-300">Score {row.score}</span>
                </div>
                <p className="text-sm text-gray-300">
                  {row.reasons.length ? row.reasons.join(' · ') : 'No strong fit signal from selected traits.'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KNOWLEDGE_ARTICLES, KNOWLEDGE_CATEGORIES } from '../constants/knowledge';
import CopyButton from '../components/ui/CopyButton';

function matches(article, query, category) {
  const categoryMatch = category === 'All' || article.category === category;
  if (!categoryMatch) return false;
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return [
    article.title,
    article.summary,
    article.category,
    ...article.keywords,
    ...article.points,
  ].join(' ').toLowerCase().includes(needle);
}

export default function KnowledgeBase() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const articles = useMemo(
    () => KNOWLEDGE_ARTICLES.filter(article => matches(article, query, category)),
    [query, category],
  );

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-8">
      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Reference</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          Knowledge <span className="octopus-text-gradient">Base</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          Searchable smart products answers, decision frameworks, and quick troubleshooting notes.
        </p>
      </header>

      <div className="octopus-card-bg rounded-2xl p-5 mb-6">
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Search</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search Agile, Tracker, OCPP, glossary..."
              className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full md:w-44 bg-gray-900/50 border border-gray-600 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-pink-500 focus:border-pink-500"
            >
              {KNOWLEDGE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4">
        {articles.map(article => (
          <article key={article.id} className="octopus-card-bg rounded-2xl p-5 border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div>
                <span className="inline-flex px-2 py-1 rounded-lg bg-pink-400/10 text-pink-400 text-xs font-semibold mb-2">
                  {article.category}
                </span>
                <h2 className="text-xl font-bold text-white">{article.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton
                  label="Copy answer"
                  value={[
                    article.title,
                    article.summary,
                    ...article.points.map(point => `- ${point}`),
                  ].join('\n')}
                />
                {article.category === 'Glossary' && (
                  <Link to="/terminology" className="text-xs text-teal-400 hover:underline">Open Terminology →</Link>
                )}
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-4">{article.summary}</p>
            <ul className="space-y-2 text-sm text-gray-300">
              {article.points.map(point => (
                <li key={point} className="flex gap-2">
                  <span className="text-teal-400">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {!articles.length && (
        <div className="octopus-card-bg rounded-2xl p-8 text-center text-gray-300">
          No matching knowledge articles.
        </div>
      )}
    </main>
  );
}

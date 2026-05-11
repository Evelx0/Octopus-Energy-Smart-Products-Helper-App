// Reusable self-assessment quiz panel for reference pages.
// No scoring — just scenario-based questions with explanations.
// Props: questions: [{ q, options: [{ text, correct, explanation }] }]

import { useState, useEffect, useRef } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPanel({ questions }) {
  const [shuffled, setShuffled]   = useState([]);
  const [current,  setCurrent]    = useState(0);
  const [chosen,   setChosen]     = useState(null); // index into options
  const [done,     setDone]       = useState(false);
  const topRef = useRef(null);

  // Shuffle once on mount (or when question set changes)
  useEffect(() => {
    setShuffled(shuffle(questions));
    setCurrent(0);
    setChosen(null);
    setDone(false);
  }, [questions]);

  function restart() {
    setShuffled(shuffle(questions));
    setCurrent(0);
    setChosen(null);
    setDone(false);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function next() {
    if (current + 1 >= shuffled.length) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
      setChosen(null);
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!shuffled.length) return null;

  if (done) {
    return (
      <div ref={topRef} className="text-center py-12 space-y-4">
        <p className="text-4xl">🎉</p>
        <p className="text-xl font-bold text-white">All {shuffled.length} questions complete!</p>
        <p className="text-gray-300 text-sm">This is a self-assessment — no score recorded. Come back to test yourself again.</p>
        <button
          onClick={restart}
          className="mt-4 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium text-sm transition-colors"
        >
          Restart quiz
        </button>
      </div>
    );
  }

  const q = shuffled[current];
  const answered = chosen !== null;
  const correctIdx = q.options.findIndex(o => o.correct);

  return (
    <div ref={topRef} className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-300 font-medium uppercase tracking-wider">
          Question {current + 1} of {shuffled.length}
        </p>
        <div className="flex gap-1">
          {shuffled.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < current  ? 'w-6 bg-teal-500' :
                i === current ? 'w-6 bg-purple-500' :
                'w-3 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="bg-white/5 rounded-xl p-5">
        <p className="text-white font-semibold leading-snug">{q.q}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {q.options.map((opt, i) => {
          let style = 'border-white/10 text-gray-200 hover:border-purple-500/50 hover:bg-purple-500/5';
          if (answered) {
            if (i === correctIdx)   style = 'border-teal-500 bg-teal-500/10 text-teal-200';
            else if (i === chosen)  style = 'border-red-500 bg-red-500/10 text-red-300';
            else                    style = 'border-white/5 text-gray-300 opacity-50';
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setChosen(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${style} ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="font-mono text-xs mr-3 opacity-50">{String.fromCharCode(65 + i)}.</span>
              {opt.text}
              {answered && i === correctIdx && <span className="ml-2 text-teal-400">✓</span>}
              {answered && i === chosen && i !== correctIdx && <span className="ml-2 text-red-400">✗</span>}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {answered && (
        <div className={`rounded-xl p-4 text-sm ${chosen === correctIdx ? 'bg-teal-900/30 border border-teal-500/30' : 'bg-amber-900/30 border border-amber-500/30'}`}>
          <p className={`font-semibold mb-1 ${chosen === correctIdx ? 'text-teal-300' : 'text-amber-300'}`}>
            {chosen === correctIdx ? '✓ Correct!' : `✗ Not quite — the answer is: ${q.options[correctIdx].text}`}
          </p>
          <p className="text-gray-300 leading-relaxed">{q.options[correctIdx].explanation}</p>
        </div>
      )}

      {/* Next button */}
      {answered && (
        <div className="flex justify-end">
          <button
            onClick={next}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium text-sm transition-colors"
          >
            {current + 1 >= shuffled.length ? 'Finish →' : 'Next question →'}
          </button>
        </div>
      )}
    </div>
  );
}

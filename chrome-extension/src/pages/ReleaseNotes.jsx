import { RELEASE_NOTES } from '../constants/releaseNotes';

export default function ReleaseNotes() {
  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">
      <header className="my-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">Release</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">
          Release <span className="octopus-text-gradient">Notes</span>
        </h1>
        <p className="mt-3 text-gray-300 text-lg max-w-2xl">
          What changed in the extension, what agents should notice, and known limitations.
        </p>
      </header>

      <div className="space-y-5">
        {RELEASE_NOTES.map(note => (
          <article key={note.version} className="octopus-card-bg rounded-2xl p-6 border border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider">{note.date}</p>
                <h2 className="text-2xl font-bold text-white">{note.version} — {note.title}</h2>
              </div>
            </div>
            <p className="text-sm font-semibold text-teal-400 mb-2">Changed</p>
            <ul className="space-y-2 text-sm text-gray-300 mb-4">
              {note.changes.map(change => <li key={change}>• {change}</li>)}
            </ul>
            {note.limitations?.length > 0 && (
              <>
                <p className="text-sm font-semibold text-amber-300 mb-2">Known limitations</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  {note.limitations.map(item => <li key={item}>• {item}</li>)}
                </ul>
              </>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

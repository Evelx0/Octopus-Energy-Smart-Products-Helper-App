import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSeenReleaseVersion, setSeenReleaseVersion } from '../services/storage';
import { latestReleaseNote } from '../constants/releaseNotes';

function manifestVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return latestReleaseNote()?.version || 'unknown';
  }
}

function openReleaseNotes() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('options/options.html#/release-notes'),
  });
}

export default function ReleaseUpdateBanner({ surface = 'options' }) {
  const [visible, setVisible] = useState(false);
  const note = latestReleaseNote();
  const version = manifestVersion();

  useEffect(() => {
    let mounted = true;
    getSeenReleaseVersion().then(seen => {
      if (mounted && seen !== version) setVisible(true);
    });
    return () => { mounted = false; };
  }, [version]);

  async function dismiss() {
    await setSeenReleaseVersion(version);
    setVisible(false);
  }

  if (!visible || !note) return null;

  const body = (
    <div className="flex-1">
      <p className="font-semibold text-white">What changed in v{version}</p>
      <p className="text-gray-300 mt-1">
        {note.changes.slice(0, surface === 'popup' ? 1 : 2).join(' ')}
      </p>
      {note.limitations?.[0] && (
        <p className="text-gray-300 mt-1">Limit: {note.limitations[0]}</p>
      )}
    </div>
  );

  if (surface === 'popup') {
    return (
      <div className="px-4 py-3 bg-purple-900/70 border-b border-purple-700/40 text-xs text-purple-100 flex items-start gap-2">
        {body}
        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" onClick={openReleaseNotes} className="text-pink-300 hover:text-white">Notes</button>
          <button type="button" onClick={dismiss} className="text-purple-200 hover:text-white" aria-label="Dismiss release update">x</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-4 print:hidden">
      <div className="octopus-card-bg rounded-xl border border-purple-500/30 p-4 flex items-start gap-4">
        {body}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/release-notes" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-gray-200">
            Release notes
          </Link>
          <button type="button" onClick={dismiss} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

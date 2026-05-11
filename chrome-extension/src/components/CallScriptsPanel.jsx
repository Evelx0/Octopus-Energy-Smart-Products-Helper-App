import { CALL_SCRIPTS } from '../constants/callScripts';
import CopyButton from './ui/CopyButton';

export default function CallScriptsPanel({ tariff }) {
  const scripts = CALL_SCRIPTS[tariff] || [];
  if (!scripts.length) return null;

  return (
    <details className="print:hidden octopus-card-bg rounded-2xl p-4 mb-6 border border-white/10">
      <summary className="cursor-pointer text-sm font-semibold text-white">
        📞 Call Scripts
      </summary>
      <div className="mt-4 grid gap-3">
        {scripts.map(script => (
          <div key={script.title} className="bg-white/5 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-pink-400">{script.title}</p>
              <CopyButton
                label="Copy response"
                value={[
                  script.title,
                  'Qualify:',
                  ...script.questions.map(question => `- ${question}`),
                  'Suggested response:',
                  script.response,
                ].join('\n')}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-300 mb-1">Qualify</p>
                <ul className="space-y-1 text-gray-300">
                  {script.questions.map(question => (
                    <li key={question}>• {question}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-300 mb-1">Suggested response</p>
                <p className="text-gray-200 leading-relaxed">{script.response}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

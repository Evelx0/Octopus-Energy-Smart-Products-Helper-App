import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', className = '' }) {
  const [copied, setCopied] = useState(false);

  function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }

  async function handleCopy() {
    if (!value) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      fallbackCopy(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className={`px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-200 transition-colors ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

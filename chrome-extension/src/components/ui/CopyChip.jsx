// CopyChip — click-to-copy inline component for codes, GSP letters, tariff strings.
// Usage: <CopyChip value="E-1R-AGILE-24-10-01-H" />
// Optional: <CopyChip value="H" label="Region H" /> when display text differs from copied value.

import { useState } from 'react';

export default function CopyChip({ value, label, className = '' }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Fallback for non-HTTPS or older browsers
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title={`Click to copy: ${value}`}
      className={`inline-flex items-center gap-1 font-mono cursor-pointer transition-colors select-none
        ${copied
          ? 'text-teal-400'
          : 'text-pink-400 hover:text-pink-300'
        } ${className}`}
    >
      <span>{label ?? value}</span>
      <span className={`text-xs transition-opacity ${copied ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}>
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  );
}

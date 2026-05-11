export function applyTheme(mode) {
  const root = document.documentElement;
  // Remove old filter-based hack (no-op on fresh installs, cleans up on upgrade)
  root.style.filter = '';
  root.style.background = '';

  if (mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // 'dark' is the default — remove the attribute so dark CSS vars are active
    root.removeAttribute('data-theme');
  }
}

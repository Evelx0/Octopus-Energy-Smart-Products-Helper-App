import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/App.jsx';
import '../src/index.css';
import { getLightMode, runStorageMigrations } from '../src/services/storage.js';
import { applyTheme } from '../src/theme.js';

runStorageMigrations().finally(() => getLightMode().then(applyTheme));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.lightMode) applyTheme(changes.lightMode.newValue || 'dark');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './popup.jsx';
import '../src/index.css';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary surface="Popup" title="The popup hit a render error.">
      <Popup />
    </ErrorBoundary>
  </React.StrictMode>
);

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import GlobalSearch from '../GlobalSearch';
import AlertBanner from '../AlertBanner';
import ReleaseUpdateBanner from '../ReleaseUpdateBanner';
import { getLearningMode, trackSessionEvent } from '../../services/storage';

const ROUTE_TITLES = {
  '/':                               'Home',
  '/agile-tracker':                  'Agile Tracker',
  '/tracker-prices':                 'Tracker Prices',
  '/tariffs/agile':                  'Agile Reference',
  '/tariffs/tracker':                'Tracker Reference',
  '/tariffs/intelligent':            'Intelligent Go Reference',
  '/tariffs/intelligent-ocpp':       'IO Go OCPP Diagnostics',
  '/tariffs/intelligent-vehicles':   'IO Go Vehicle Checker',
  '/tariffs/intelligent-onboarding': 'IO Go Onboarding Guide',
  '/tariffs/cosy':                   'Cosy Octopus',
  '/tariffs/flux':                   'Flux Reference',
  '/tariffs/comparison':             'Tariff Comparison',
  '/eligibility':                    'Eligibility Checker',
  '/region-lookup':                  'Region Lookup',
  '/terminology':                    'Terminology',
  '/knowledge-base':                 'Knowledge Base',
  '/release-notes':                  'Release Notes',
  '/deep-link-builder':              'Deep Link Builder',
  '/tariff-fit-matrix':              'Tariff Fit Matrix',
  '/system-health':                  'System Health',
  '/bill-calculator':                'Bill Simulator',
  '/tariffs/outgoing':               'Outgoing Rate Tracker',
  '/settings':                       'Settings',
};

const LEARNING_NOTES = {
  '/': 'Use this page as the starting point for live rates, grid context, and quick navigation to the right tariff tool.',
  '/agile-tracker': 'Use this when the conversation depends on half-hourly Agile prices, cheap slots, volatility, or historical Agile context.',
  '/tracker-prices': 'Use this when a customer asks about daily Tracker electricity or gas rates, tomorrow previews, or recent changes.',
  '/region-lookup': 'Use this to turn a postcode into a DNO region and GSP code. The postcode is not stored in the session summary.',
  '/knowledge-base': 'Use this as the searchable source of truth for common answers, frameworks, and troubleshooting prompts.',
  '/system-health': 'Use this to check whether the backend, service worker refresh, cached rates, and optional rollout controls are healthy.',
};

function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = ROUTE_TITLES[pathname] || 'Staff Portal';
    document.title = `${title} — Smart Products Hub`;
  }, [pathname]);
  return null;
}

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    getLearningMode().then(setLearningMode);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/tariffs/')) {
      trackSessionEvent('tariff_page', { page: location.pathname });
    }
  }, [location.pathname]);

  const learningNote = LEARNING_NOTES[location.pathname] || (
    location.pathname.startsWith('/tariffs/')
      ? 'Use this reference page for tariff rules, customer talking points, objections, and knowledge checks.'
      : null
  );

  return (
    <>
      <TitleManager />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <AlertBanner />
      <ReleaseUpdateBanner />
      {learningMode && learningNote && (
        <div className="max-w-6xl mx-auto px-6 pt-4 print:hidden">
          <details className="octopus-card-bg rounded-xl border border-white/10 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">What is this page for?</summary>
            <p className="text-sm text-gray-300 mt-2">{learningNote}</p>
          </details>
        </div>
      )}
      <Outlet />
      <Footer />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import GlobalSearch from '../GlobalSearch';
import AlertBanner from '../AlertBanner';

const ROUTE_TITLES = {
  '/':                              'Home',
  '/agile-tracker':                 'Agile Tracker',
  '/tracker-prices':                'Tracker Prices',
  '/tariffs/agile':                 'Agile Reference',
  '/tariffs/tracker':               'Tracker Reference',
  '/tariffs/intelligent':           'Intelligent Go Reference',
  '/tariffs/intelligent-ocpp':      'IO Go OCPP Diagnostics',
  '/tariffs/intelligent-vehicles':  'IO Go Vehicle Checker',
  '/tariffs/intelligent-onboarding': 'IO Go Onboarding Guide',
  '/tariffs/cosy':                  'Cosy Octopus',
  '/tariffs/flux':                  'Flux Reference',
  '/tariffs/comparison':            'Tariff Comparison',
  '/eligibility':                   'Eligibility Checker',
  '/region-lookup':                 'Region Lookup',
  '/terminology':                   'Terminology',
  '/bill-calculator':               'Bill Simulator',
  '/tariffs/outgoing':              'Outgoing Rate Tracker',
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

  return (
    <>
      <TitleManager />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <AlertBanner />
      <Outlet />
      <Footer />
    </>
  );
}

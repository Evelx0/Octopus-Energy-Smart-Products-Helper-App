import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Home from './pages/Home';
import AgileReference from './pages/AgileReference';
import TrackerReference from './pages/TrackerReference';
import FluxReference from './pages/FluxReference';
import TariffComparison from './pages/TariffComparison';
import EligibilityChecker from './pages/EligibilityChecker';
import RegionLookup from './pages/RegionLookup';
import Terminology from './pages/Terminology';
import IntelligentVehicles from './pages/IntelligentVehicles';
import IoGoOnboarding from './pages/IoGoOnboarding';
import CosyOctopus from './pages/CosyOctopus';
import BillCalculator from './pages/BillCalculator';
import OutgoingRateTracker from './pages/OutgoingRateTracker';
import SettingsPage from './pages/SettingsPage';
import KnowledgeBase from './pages/KnowledgeBase';
import SystemHealthPage from './pages/SystemHealthPage';
import DeepLinkBuilder from './pages/DeepLinkBuilder';
import ReleaseNotes from './pages/ReleaseNotes';
import TariffFitMatrix from './pages/TariffFitMatrix';

// Heavy pages — lazy loaded so Chart.js bundle is only downloaded when needed
const AgileTracker        = lazy(() => import('./pages/AgileTracker'));
const TrackerPriceTracker = lazy(() => import('./pages/TrackerPriceTracker'));
const IntelligentReference = lazy(() => import('./pages/IntelligentReference'));
const OcppDiagnostics = lazy(() => import('./pages/OcppDiagnostics'));

function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center p-8">
      <div>
        <p className="text-6xl font-black text-white mb-3">404</p>
        <p className="text-gray-300 mb-6">Page not found.</p>
        <Link to="/" className="text-pink-400 hover:underline">← Back to Home</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    // HashRouter is required for Chrome extensions — no web server to handle history-mode URLs
    <HashRouter>
      <ErrorBoundary surface="Options SPA" title="The Options page hit a render error.">
        <Suspense fallback={
          <div className="min-h-screen bg-[#150E38] flex items-center justify-center">
            <LoadingSpinner message="Loading…" />
          </div>
        }>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/"                               element={<Home />} />
              <Route path="/agile-tracker"                  element={<AgileTracker />} />
              <Route path="/tracker-prices"                 element={<TrackerPriceTracker />} />
              <Route path="/tariffs/agile"                  element={<AgileReference />} />
              <Route path="/tariffs/tracker"                element={<TrackerReference />} />
              <Route path="/tariffs/intelligent"            element={<IntelligentReference />} />
              <Route path="/tariffs/intelligent-ocpp"       element={<OcppDiagnostics />} />
              <Route path="/tariffs/intelligent-vehicles"   element={<IntelligentVehicles />} />
              <Route path="/tariffs/intelligent-onboarding" element={<IoGoOnboarding />} />
              <Route path="/tariffs/flux"                   element={<FluxReference />} />
              <Route path="/tariffs/cosy"                   element={<CosyOctopus />} />
              <Route path="/tariffs/comparison"             element={<TariffComparison />} />
              <Route path="/eligibility"                    element={<EligibilityChecker />} />
              <Route path="/region-lookup"                  element={<RegionLookup />} />
              <Route path="/terminology"                    element={<Terminology />} />
              <Route path="/knowledge-base"                 element={<KnowledgeBase />} />
              <Route path="/release-notes"                  element={<ReleaseNotes />} />
              <Route path="/deep-link-builder"              element={<DeepLinkBuilder />} />
              <Route path="/tariff-fit-matrix"              element={<TariffFitMatrix />} />
              <Route path="/system-health"                  element={<SystemHealthPage />} />
              <Route path="/bill-calculator"                element={<BillCalculator />} />
              <Route path="/tariffs/outgoing"               element={<OutgoingRateTracker />} />
              <Route path="/settings"                       element={<SettingsPage />} />
              <Route path="*"                               element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}

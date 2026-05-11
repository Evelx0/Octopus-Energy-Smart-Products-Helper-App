import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dismissAnnouncement,
  getAnnouncementState,
  getCachedAgileRates,
  getLightMode,
  getPreferredRegion,
  getUpdateStatus,
  savePreferredRegion,
  trackSessionEvent,
} from '../src/services/storage.js';
import { getCarbonIntensity, getAlertStatus, getAgileRates, getGenerationMix } from '../src/services/api.js';
import { applyTheme } from '../src/theme.js';
import BottomNav from './components/BottomNav.jsx';
import HomePage from './pages/HomePage.jsx';
import LookupPage from './pages/LookupPage.jsx';
import RatesPage from './pages/RatesPage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import { formatAge, openOptionsPage } from './utils.js';
import ReleaseUpdateBanner from '../src/components/ReleaseUpdateBanner.jsx';

export default function Popup() {
  const [currentPage, setCurrentPage] = useState('home');
  const [alerts,      setAlerts]      = useState([]);
  const [region,      setRegion]      = useState('H');
  const [ci,          setCi]          = useState(null);
  const [gridMix,     setGridMix]     = useState(null);
  const [agileCache,  setAgileCache]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [offline,     setOffline]     = useState(navigator.onLine === false);
  const [refreshError, setRefreshError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [updateStatus, setUpdateStatus] = useState({ updateAvailable: false, expectedVersion: null });
  const [announcementState, setAnnouncementState] = useState({ announcements: [], dismissed: [] });
  const hiddenAtRef = useRef(null);

  const loadData = useCallback(async ({ showLoading = true, regionOverride = null, useCache = true } = {}) => {
    if (showLoading) setLoading(true);
    setOffline(navigator.onLine === false);
    const activeRegion = regionOverride || await getPreferredRegion();
    setRegion(activeRegion);

    const cached = useCache ? await getCachedAgileRates() : { rates: null, cachedAt: null, lastError: null };
    if (cached.rates && !regionOverride) {
      setAgileCache(cached.rates);
      setLastUpdatedAt(cached.cachedAt);
    }
    setRefreshError(cached.lastError);

    if (navigator.onLine === false) {
      setLoading(false);
      return;
    }

    if (!cached.rates || regionOverride) {
      try {
        const data = await getAgileRates(activeRegion);
        setAgileCache(data);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        setRefreshError(err.message || 'Agile rates unavailable.');
      }
    }

    const [ciRes, alertRes, mixRes] = await Promise.allSettled([
      getCarbonIntensity(),
      getAlertStatus(),
      getGenerationMix(),
    ]);
    if (ciRes.status === 'fulfilled') setCi(ciRes.value?.data?.[0]?.intensity ?? null);
    if (alertRes.status === 'fulfilled') setAlerts(alertRes.value?.alerts ?? []);
    if (mixRes.status === 'fulfilled') setGridMix(mixRes.value?.data?.generationmix ?? null);
    if (ciRes.status === 'rejected' || alertRes.status === 'rejected' || mixRes.status === 'rejected') {
      setRefreshError('Some live data could not be refreshed.');
    }
    setLoading(false);
  }, []);

  const loadPopupMeta = useCallback(async () => {
    const [update, announcements] = await Promise.all([
      getUpdateStatus(),
      getAnnouncementState(),
    ]);
    setUpdateStatus(update);
    setAnnouncementState(announcements);
  }, []);

  const handleRegionChange = useCallback(async nextRegion => {
    setRegion(nextRegion);
    setAgileCache(null);
    await savePreferredRegion(nextRegion);
    loadData({ regionOverride: nextRegion, useCache: false });
  }, [loadData]);

  useEffect(() => {
    getLightMode().then(applyTheme);
    loadData();
    loadPopupMeta();

    function handleOnlineChange() {
      setOffline(navigator.onLine === false);
      if (navigator.onLine !== false) loadData({ showLoading: false });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > 5 * 60 * 1000) {
        loadData({ showLoading: false });
      }
    }

    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData, loadPopupMeta]);

  const dismissPopupAnnouncement = useCallback(async id => {
    await dismissAnnouncement(id);
    await trackSessionEvent('alert_acknowledged');
    loadPopupMeta();
  }, [loadPopupMeta]);

  const dataAge = formatAge(lastUpdatedAt);
  const activeAnnouncements = announcementState.announcements.filter(item => {
    if (!item?.id || announcementState.dismissed.includes(item.id)) return false;
    if (!item.expiresAt) return true;
    return new Date(item.expiresAt).getTime() >= Date.now();
  });

  return (
    <div className="w-[330px] bg-[#150E38] text-gray-200 flex flex-col" style={{ minWidth: 330 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"
           style={{ backgroundColor: 'rgba(156,111,255,0.20)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" aria-labelledby="title-constantine-popup" viewBox="0 0 141 156" role="img" className="h-6 w-auto">
            <title id="title-constantine-popup">Constantine the Octopus</title>
            <path fill="#FF48D8" d="M122.8 110.748c2.021-9.605 16.17-23.309 17.943-42.146C143.053 43.885 130.596 0 69.794 0S0 45.334 0 64.255c0 25.296 18.521 38.379 17.655 47.363.082.041.165.124.247.165.454 9.73-9.735 10.309-9.157 16.313.454 4.678 13.653 5.837 22.77.869-1.444 2.774-3.465 5.299-5.982 6.707-4.702 2.608-8.497 3.892-8.497 6.79s14.107 10.267 28.586 3.105c4.29-2.112 7.384-4.389 9.735-6.624.082.496.123.952.206 1.366.701 4.14 3.094 15.691 13.53 15.691s12.54-10.102 14.272-16.105c.124-.497.289-.994.413-1.491 2.35 2.443 5.65 4.927 10.312 7.246 14.479 7.162 28.586-.207 28.586-3.105 0-2.899-3.795-4.141-8.497-6.79-2.682-1.491-4.785-4.182-6.229-7.163 9.116 5.548 23.141 4.472 23.595-.372.577-6.128-10.107-6.583-9.117-17.016.083-.249.207-.331.372-.456Z"/>
            <path fill="#fff" d="M42.776 96.382c9.135 0 16.54-7.433 16.54-16.602s-7.405-16.602-16.54-16.602c-9.136 0-16.541 7.433-16.541 16.602 0 9.17 7.405 16.602 16.54 16.602Z"/>
            <path fill="url(#pop-a)" d="M43.889 94.064c6.424 0 11.632-5.227 11.632-11.675S50.313 70.714 43.89 70.714c-6.424 0-11.632 5.227-11.632 11.675s5.208 11.675 11.632 11.675Z"/>
            <path fill="#fff" d="M37.125 78.828a2.645 2.645 0 0 0 2.64-2.65 2.645 2.645 0 0 0-2.64-2.65 2.645 2.645 0 0 0-2.64 2.65 2.645 2.645 0 0 0 2.64 2.65ZM94.627 95.099c8.429 0 15.262-6.859 15.262-15.319s-6.833-15.318-15.262-15.318c-8.43 0-15.263 6.858-15.263 15.318S86.197 95.1 94.627 95.1Z"/>
            <path fill="url(#pop-b)" d="M94.585 93.98c6.402 0 11.591-5.208 11.591-11.633 0-6.425-5.189-11.634-11.59-11.634-6.402 0-11.592 5.209-11.592 11.634 0 6.425 5.19 11.634 11.591 11.634Z"/>
            <path fill="#fff" d="M88.604 78.331a2.686 2.686 0 0 0 2.681-2.69c0-1.487-1.2-2.692-2.68-2.692a2.686 2.686 0 0 0-2.682 2.691c0 1.486 1.2 2.691 2.681 2.691Z"/>
            <path fill="#100030" d="M111.085 49.143c.412.166.742.331 1.114.497.371.166.701.373 1.072.58.371.207.701.414 1.073.704.371.29.701.538 1.113 1.035.413.496.289 1.242-.206 1.656-.33.29-.784.33-1.196.165l-.454-.207c-.082-.041-.371-.165-.619-.29-.288-.082-.577-.207-.907-.29l-.99-.248c-.33-.083-.701-.124-.99-.165a1.816 1.816 0 0 1 .454-3.602c.165 0 .33.082.453.124l.083.041ZM28.916 54.401c-.29 0-.66.042-.99.083-.33.041-.66.083-.99.166-.33.082-.66.124-.95.207a4.662 4.662 0 0 0-.742.29l-.288.124a.905.905 0 0 1-1.197-.456 1.012 1.012 0 0 1 .083-.91c.33-.498.66-.787.99-1.036.33-.29.66-.538 1.031-.745.33-.207.701-.455 1.031-.62.372-.208.66-.373 1.073-.58l.082-.042c.908-.455 2.022-.041 2.475.87.454.91.042 2.028-.866 2.484a1.613 1.613 0 0 1-.742.165ZM62.823 105.78c.247.29.495.456.825.621.33.166.701.331 1.155.497.866.29 1.897.414 2.928.373a9.582 9.582 0 0 0 3.053-.621 7.425 7.425 0 0 0 1.279-.58l.412-.248c.124-.083.207-.125.33-.166l1.856-.952c.62-.29 1.362-.042 1.65.538l.124.373c.083.662.041 1.366-.165 1.945a2.03 2.03 0 0 1-.165.456l-.206.414c-.124.29-.289.497-.454.745-.619.911-1.402 1.532-2.186 2.07a10.642 10.642 0 0 1-5.321 1.698c-1.898.082-3.836-.332-5.569-1.449a7.032 7.032 0 0 1-2.269-2.277c-.577-.953-.907-2.236-.7-3.437.164-.869 1.03-1.407 1.897-1.242.37.083.66.249.866.497l.66.745Z"/>
            <defs>
              <linearGradient id="pop-a" x1="54.922" x2="31.93" y1="82.394" y2="82.394" gradientUnits="userSpaceOnUse">
                <stop/><stop offset=".448" stopColor="#100030"/><stop offset=".84" stopColor="#180070"/><stop offset="1"/>
              </linearGradient>
              <linearGradient id="pop-b" x1="83.064" x2="105.57" y1="82.329" y2="82.329" gradientUnits="userSpaceOnUse">
                <stop/><stop offset=".448" stopColor="#100030"/><stop offset=".84" stopColor="#180070"/><stop offset="1"/>
              </linearGradient>
            </defs>
          </svg>
        <button
          type="button"
          title="Preferences"
          onClick={() => openOptionsPage('/settings')}
          className="text-gray-300 hover:text-white transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Alert banners — visible on every tab */}
      {offline && (
        <div className="px-4 py-2 bg-yellow-900/60 border-b border-yellow-700/40 text-xs text-yellow-100">
          Offline — showing cached data{dataAge ? ` (${dataAge})` : ''}.
        </div>
      )}
      {!offline && refreshError && (
        <div className="px-4 py-2 bg-yellow-900/50 border-b border-yellow-700/40 text-xs text-yellow-100">
          ⚠ Last refresh issue: {refreshError}
        </div>
      )}
      {!offline && !refreshError && lastUpdatedAt && (Date.now() - lastUpdatedAt > 65 * 60 * 1000) && (
        <div className="px-4 py-2 bg-amber-900/50 border-b border-amber-700/40 text-xs text-amber-100">
          ⚠ Agile data may be stale — last updated {dataAge}. Rates may not reflect current prices.
        </div>
      )}
      {updateStatus.updateAvailable && (
        <div className="px-4 py-2 bg-yellow-900/50 border-b border-yellow-700/40 text-xs text-yellow-100">
          ⚠ New version available{updateStatus.expectedVersion ? ` (${updateStatus.expectedVersion})` : ''} — reload at chrome://extensions.
        </div>
      )}
      <ReleaseUpdateBanner surface="popup" />
      {activeAnnouncements.map(item => (
        <div key={item.id} className="px-4 py-2 bg-purple-900/60 border-b border-purple-700/40 text-xs text-purple-100 flex items-start gap-2">
          <span className="flex-1">{item.severity === 'warning' ? '⚠' : '📣'} {item.text}</span>
          <button
            type="button"
            onClick={() => dismissPopupAnnouncement(item.id)}
            className="text-purple-200 hover:text-white"
            aria-label="Dismiss announcement"
          >
            ×
          </button>
        </div>
      ))}
      {alerts.filter(a => a.tier === 'red').map((a, i) => (
        <div key={i} className="px-4 py-2 bg-red-900/60 border-b border-red-700/40 text-xs text-red-200">
          ⚠ {a.message}
        </div>
      ))}

      {/* Page content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {currentPage === 'home'   && <HomePage   agile={agileCache} ci={ci} gridMix={gridMix} alerts={alerts} announcements={activeAnnouncements} region={region} onRegionChange={handleRegionChange} loading={loading} lastUpdatedAt={lastUpdatedAt} />}
        {currentPage === 'lookup' && <LookupPage />}
        {currentPage === 'rates'  && <RatesPage  />}
        {currentPage === 'tools'  && <ToolsPage  />}
      </div>

      <BottomNav current={currentPage} onChange={setCurrentPage} />
    </div>
  );
}

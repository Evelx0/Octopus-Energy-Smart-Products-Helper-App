import { useEffect, useMemo, useState } from 'react';
import { formatAge } from '../utils.js';
import { getIogEligibilityData, getIogEligibilityOutcome } from '../../src/services/iogEligibility.js';
import StatusCard from './StatusCard.jsx';

const RESULT_STYLES = {
  success: 'bg-teal-900/20 border-teal-500/30 text-teal-200',
  error: 'bg-red-900/20 border-red-500/30 text-red-200',
};

function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-gray-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl bg-[#150E38] border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" style={{ background: '#150E38' }}>{label}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} style={{ background: '#150E38' }}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function IogEligibilityCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [chargerMake, setChargerMake] = useState('');
  const [chargerId, setChargerId] = useState('');

  async function loadEligibility({ forceRefresh = false } = {}) {
    setLoading(true);
    setError(null);
    try {
      const next = await getIogEligibilityData({ forceRefresh });
      setData(next);
      setError(next.error || null);
    } catch (err) {
      setError(err.message || 'The live IOG checker could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !data && !loading) {
      loadEligibility();
    }
  }, [open, data, loading]);

  const vehicleOptions = useMemo(() => {
    const list = data?.vehiclesByMake?.[vehicleMake] || [];
    return list.map(item => ({ value: item.id, label: item.label }));
  }, [data, vehicleMake]);

  const chargerOptions = useMemo(() => {
    const list = data?.chargersByMake?.[chargerMake] || [];
    return list.map(item => ({ value: item.id, label: item.label }));
  }, [data, chargerMake]);

  const selectedVehicle = useMemo(
    () => (data?.vehiclesByMake?.[vehicleMake] || []).find(item => item.id === vehicleId) || null,
    [data, vehicleMake, vehicleId]
  );

  const selectedCharger = useMemo(
    () => (data?.chargersByMake?.[chargerMake] || []).find(item => item.id === chargerId) || null,
    [data, chargerMake, chargerId]
  );

  const outcome = useMemo(
    () => getIogEligibilityOutcome({ vehicle: selectedVehicle, charger: selectedCharger }),
    [selectedVehicle, selectedCharger]
  );

  const freshness = data?.fetchedAt ? formatAge(data.fetchedAt) : null;

  return (
    <div className="bg-[#2E2252] rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full px-3 py-3 flex items-center justify-between text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">IOG Eligibility</p>
          <p className="text-[11px] text-gray-300">Live via our backend</p>
        </div>
        <span className="text-xs text-gray-300 shrink-0">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 pt-3">
            <p className="text-[11px] text-gray-300">
              {data?.stale ? 'Using cached backend IOG data.' : 'Sourced from Octopus GraphQL via our backend.'}
              {freshness ? ` ${freshness}.` : ''}
            </p>
            <button
              type="button"
              onClick={() => loadEligibility({ forceRefresh: true })}
              disabled={loading}
              className="shrink-0 text-[11px] text-pink-400 hover:text-pink-300 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {error && data?.stale && (
            <p className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg px-2 py-1.5">
              {error}
            </p>
          )}

          {data?.warning && (
            <p className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg px-2 py-1.5">
              {data.warning}
            </p>
          )}

          <StatusCard loading={loading && !data} error={!data ? error : null} loadingText="Loading live IOG checker..." />

          {data && (
            <>
              <SelectField
                label="Select car brand"
                value={vehicleMake}
                onChange={nextMake => {
                  setVehicleMake(nextMake);
                  setVehicleId('');
                }}
                options={data.vehicleMakes.map(make => ({ value: make, label: make }))}
              />

              <SelectField
                label="Select car model"
                value={vehicleId}
                onChange={setVehicleId}
                options={vehicleOptions}
                disabled={!vehicleMake}
              />

              <SelectField
                label="Select charger brand"
                value={chargerMake}
                onChange={nextMake => {
                  setChargerMake(nextMake);
                  setChargerId('');
                }}
                options={data.chargerMakes.map(make => ({ value: make, label: make }))}
              />

              <SelectField
                label="Select charger model"
                value={chargerId}
                onChange={setChargerId}
                options={chargerOptions}
                disabled={!chargerMake}
              />

              {!outcome && (
                <p className="text-[11px] text-gray-300">
                  Choose both the car and charger to check eligibility.
                </p>
              )}

              {outcome && (
                <div className={`rounded-xl border p-3 ${RESULT_STYLES[outcome.level] || RESULT_STYLES.error}`}>
                  <p className="text-sm font-semibold">{outcome.title}</p>
                  <p className="text-xs leading-relaxed mt-1">{outcome.message}</p>
                  {outcome.detail && (
                    <p className="text-[11px] text-gray-200/90 mt-2">{outcome.detail}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

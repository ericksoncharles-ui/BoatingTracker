import { marinas } from '../data'
import TripBriefing from './TripBriefing'

export default function Sidebar({
  startId, setStartId,
  destId, setDestId,
  tankSize, setTankSize,
  cruisingSpeed, setCruisingSpeed,
  fuelBurn, setFuelBurn,
  tripResult,
  onCalculate,
  onReset,
}) {
  const canCalculate = startId && destId && startId !== destId

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="header-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v20M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <div>
          <h1>Long Island Sound<br />Trip Planner</h1>
          <p className="subtitle">Plan your next adventure on the Sound</p>
        </div>
      </div>

      <div className="sidebar-form">
        <label>
          <span className="label-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
          </span>
          Starting Marina
          <select value={startId} onChange={(e) => setStartId(e.target.value)}>
            <option value="">Select a marina...</option>
            {marinas.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="label-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          Destination
          <select value={destId} onChange={(e) => setDestId(e.target.value)}>
            <option value="">Select a destination...</option>
            {marinas.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <div className="section-divider">
          <span>Boat Parameters</span>
        </div>

        <div className="input-row">
          <label>
            Tank (gal)
            <input
              type="number"
              value={tankSize}
              min={1}
              onChange={(e) => setTankSize(Number(e.target.value))}
            />
          </label>
          <label>
            Speed (kts)
            <input
              type="number"
              value={cruisingSpeed}
              min={1}
              onChange={(e) => setCruisingSpeed(Number(e.target.value))}
            />
          </label>
          <label>
            Burn (GPH)
            <input
              type="number"
              value={fuelBurn}
              min={1}
              onChange={(e) => setFuelBurn(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="btn-plan" onClick={onCalculate} disabled={!canCalculate}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Plan Trip
          </button>
          {tripResult && (
            <button className="btn-reset" onClick={onReset}>Clear</button>
          )}
        </div>
        {startId && destId && startId === destId && (
          <p className="form-error">Start and destination must be different.</p>
        )}
      </div>

      {tripResult && (
        <div className="sidebar-results">
          <h2>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Trip Summary
          </h2>

          <div className="result-grid">
            <div className="result-item">
              <span className="result-label">Distance</span>
              <span className="result-value">{tripResult.distanceNM} <small>NM</small></span>
            </div>
            <div className="result-item">
              <span className="result-label">Travel Time</span>
              <span className="result-value">{tripResult.travelTimeFormatted}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Fuel Used</span>
              <span className="result-value">{tripResult.fuelUsed} <small>gal</small></span>
            </div>
            <div className="result-item">
              <span className="result-label">Fuel Remaining</span>
              <span className="result-value">{tripResult.fuelRemaining} <small>gal</small></span>
            </div>
          </div>

          {tripResult.needsFuelWarning && (
            <div className="fuel-warning">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Fuel Stop Recommended — usage exceeds 70% of tank capacity ({tripResult.fuelPercentUsed}%)
            </div>
          )}

          <div className="fuel-gauge">
            <div className="fuel-gauge-label">
              <span>Fuel Usage</span>
              <span>{tripResult.fuelPercentUsed}%</span>
            </div>
            <div className="fuel-gauge-track">
              <div
                className={`fuel-gauge-fill ${tripResult.needsFuelWarning ? 'fuel-gauge-warning' : ''}`}
                style={{ width: `${Math.min(tripResult.fuelPercentUsed, 100)}%` }}
              />
            </div>
          </div>

          <h3>Points of Interest</h3>
          <ul className="poi-list">
            {tripResult.nearbyPOIs.map((poi) => (
              <li key={poi.id}>
                <strong>{poi.name}</strong>
                <span>{poi.description}</span>
              </li>
            ))}
          </ul>

          <TripBriefing tripResult={tripResult} />
        </div>
      )}

      {!tripResult && (
        <div className="sidebar-welcome">
          <div className="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" opacity="0" />
              <path d="M3 7c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
              <path d="M3 12c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
              <path d="M3 17c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
            </svg>
          </div>
          <p className="welcome-title">Ready to set sail?</p>
          <p className="welcome-text">Choose your departure marina and destination above, then hit <strong>Plan Trip</strong> to chart your course across the Sound.</p>
        </div>
      )}
    </aside>
  )
}

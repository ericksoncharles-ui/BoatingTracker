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
  onFocusPOI,
}) {
  const canCalculate = startId && destId && startId !== destId

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="header-icon">
          {/* New England lighthouse */}
          <svg viewBox="0 0 38 48" width="38" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Light rays */}
            <line x1="19" y1="8" x2="19" y2="2" stroke="#ECC94B" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="19" y1="8" x2="28" y2="4" stroke="#ECC94B" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="19" y1="8" x2="10" y2="4" stroke="#ECC94B" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="19" y1="8" x2="33" y2="9" stroke="#ECC94B" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
            <line x1="19" y1="8" x2="5"  y2="9" stroke="#ECC94B" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
            {/* Lantern cap */}
            <path d="M14 8 L19 2 L24 8 Z" fill="#ECC94B" opacity="0.9"/>
            {/* Lantern room */}
            <rect x="13" y="8" width="12" height="7" rx="1" fill="#1B2A4A" stroke="#90A4C4" strokeWidth="1.4"/>
            {/* Lantern window glow */}
            <rect x="15.5" y="9.5" width="7" height="4" rx="0.5" fill="#ECC94B" opacity="0.5"/>
            {/* Tower body — tapered */}
            <path d="M13 15 L9 34 L29 34 L25 15 Z" fill="#243660" stroke="#90A4C4" strokeWidth="1.4" strokeLinejoin="round"/>
            {/* Red/white stripe band */}
            <path d="M10.5 23.5 L9.8 26.5 L28.2 26.5 L27.5 23.5 Z" fill="#C53030" opacity="0.85"/>
            {/* Door arch */}
            <path d="M16.5 34 L16.5 29.5 A2.5 2.5 0 0 1 21.5 29.5 L21.5 34" fill="#1B2A4A" stroke="#90A4C4" strokeWidth="1.2" strokeLinejoin="round"/>
            {/* Base platform */}
            <rect x="7" y="34" width="24" height="2.5" rx="0.5" fill="#2D3E5E" stroke="#90A4C4" strokeWidth="1.2"/>
            {/* Rocky base */}
            <path d="M4 38 Q8 35.5 12 37.5 Q15.5 39 19 37.5 Q22.5 36 26 37.5 Q30 39.5 34 38" stroke="#90A4C4" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
            {/* Waves */}
            <path d="M1 43 Q5.5 40 10 43 Q14.5 46 19 43 Q23.5 40 28 43 Q31 44.5 37 43" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8"/>
            <path d="M1 46.5 Q7 44.5 13 46.5 Q19 48.5 25 46.5 Q30 44.5 37 46.5" stroke="#4A90C4" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.45"/>
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

          {tripResult.noWakeZones && tripResult.noWakeZones.length > 0 && (
            <div className="no-wake-info">
              <h3>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                No-Wake Zones ({tripResult.noWakeZones.length})
              </h3>
              <p className="no-wake-summary">
                +{tripResult.noWakeDelayMinutes} min added for {tripResult.noWakeZones.length} no-wake zone{tripResult.noWakeZones.length > 1 ? 's' : ''} (5 kt limit)
              </p>
              <ul className="no-wake-list">
                {tripResult.noWakeZones.map((zone) => (
                  <li key={zone.id}>
                    <span className="no-wake-name">{zone.name}</span>
                    <span className="no-wake-delay">+{zone.delayMinutes} min</span>
                  </li>
                ))}
              </ul>
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
                <div className="poi-header">
                  <strong>{poi.name}</strong>
                  <div className="poi-actions">
                    <button
                      className="poi-btn"
                      title="View on map"
                      onClick={() => onFocusPOI(poi)}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                      Map
                    </button>
                    <a
                      className="poi-btn"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name + ' ' + poi.description.split('—')[0].trim())}&center=${poi.lat},${poi.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Google Maps"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Google
                    </a>
                  </div>
                </div>
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
      <div className="sidebar-footer">
        Built by Charles Erickson
      </div>
    </aside>
  )
}

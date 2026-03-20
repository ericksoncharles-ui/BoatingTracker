import { marinas } from '../data'
import TripBriefing from './TripBriefing'

export default function Sidebar({
  startId, setStartId,
  destId, setDestId,
  tankSize, setTankSize,
  cruisingSpeed, setCruisingSpeed,
  fuelBurn, setFuelBurn,
  draft, setDraft,
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
          {/* Classic compass rose */}
          <svg viewBox="0 0 44 44" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer ring */}
            <circle cx="22" cy="22" r="20" stroke="#90A4C4" strokeWidth="1.2" opacity="0.5"/>
            <circle cx="22" cy="22" r="17" stroke="#90A4C4" strokeWidth="0.6" opacity="0.3"/>
            {/* Cardinal points — N/S/E/W */}
            <polygon points="22,2 25,18 22,16 19,18" fill="#C8D6E5" opacity="0.9"/>
            <polygon points="22,42 25,26 22,28 19,26" fill="#90A4C4" opacity="0.5"/>
            <polygon points="42,22 26,19 28,22 26,25" fill="#90A4C4" opacity="0.5"/>
            <polygon points="2,22 18,19 16,22 18,25" fill="#90A4C4" opacity="0.5"/>
            {/* Intercardinal points — NE/SE/SW/NW */}
            <polygon points="35.7,8.3 27,18 26,17 27,16" fill="#90A4C4" opacity="0.35"/>
            <polygon points="35.7,35.7 27,26 26,27 27,28" fill="#90A4C4" opacity="0.35"/>
            <polygon points="8.3,35.7 17,26 18,27 17,28" fill="#90A4C4" opacity="0.35"/>
            <polygon points="8.3,8.3 17,18 18,17 17,16" fill="#90A4C4" opacity="0.35"/>
            {/* Center */}
            <circle cx="22" cy="22" r="2.5" fill="#1B2A4A" stroke="#C8D6E5" strokeWidth="1"/>
            {/* N label */}
            <text x="22" y="10" textAnchor="middle" fill="#C8D6E5" fontSize="5" fontWeight="700" fontFamily="serif">N</text>
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
          <label>
            Draft (ft)
            <input
              type="number"
              value={draft}
              min={0}
              step={0.5}
              onChange={(e) => setDraft(Number(e.target.value))}
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

          {tripResult.draftWarnings && tripResult.draftWarnings.length > 0 && (
            <div className="draft-warning">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <strong>Draft Warning</strong> — Your {tripResult.draft} ft draft may exceed available depth:
                <ul className="draft-warning-list">
                  {tripResult.draftWarnings.map((w) => (
                    <li key={w.marina}>{w.marina} — approach depth {w.depth} ft (MLW)</li>
                  ))}
                </ul>
              </div>
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
        Built by Charles Erickson | SoundMind AI
      </div>
    </aside>
  )
}

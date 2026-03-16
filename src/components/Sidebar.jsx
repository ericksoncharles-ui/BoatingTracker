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
        <h1>Long Island Sound<br />Trip Planner</h1>
        <p className="subtitle">23&apos; Cobia Center Console</p>
      </div>

      <div className="sidebar-form">
        <label>
          Starting Marina
          <select value={startId} onChange={(e) => setStartId(e.target.value)}>
            <option value="">Select a marina...</option>
            {marinas.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label>
          Destination
          <select value={destId} onChange={(e) => setDestId(e.target.value)}>
            <option value="">Select a destination...</option>
            {marinas.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

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
          <h2>Trip Summary</h2>

          <div className="result-grid">
            <div className="result-item">
              <span className="result-label">Distance</span>
              <span className="result-value">{tripResult.distanceNM} NM</span>
            </div>
            <div className="result-item">
              <span className="result-label">Travel Time</span>
              <span className="result-value">{tripResult.travelTimeFormatted}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Fuel Used</span>
              <span className="result-value">{tripResult.fuelUsed} gal</span>
            </div>
            <div className="result-item">
              <span className="result-label">Fuel Remaining</span>
              <span className="result-value">{tripResult.fuelRemaining} gal</span>
            </div>
          </div>

          {tripResult.needsFuelWarning && (
            <div className="fuel-warning">
              Fuel Stop Recommended — usage exceeds 70% of tank capacity ({tripResult.fuelPercentUsed}%)
            </div>
          )}

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
    </aside>
  )
}

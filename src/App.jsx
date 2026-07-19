import { useState } from 'react'
import { marinas } from './data'
import { useTripCalculator } from './hooks/useTripCalculator'
import Sidebar from './components/Sidebar'
import TripMap from './components/TripMap'

export default function App() {
  const trip = useTripCalculator()
  const [focusPOI, setFocusPOI] = useState(null)
  const [activeTab, setActiveTab] = useState('planner')

  return (
    <div className="app">
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'planner' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Trip Planner
        </button>
        <button
          className={`tab-btn ${activeTab === 'chart' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('chart')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Nautical Chart
        </button>
      </div>

      {activeTab === 'planner' && (
        <div className="planner-layout">
          <Sidebar
            startId={trip.startId}
            setStartId={trip.setStartId}
            destId={trip.destId}
            setDestId={trip.setDestId}
            tankSize={trip.tankSize}
            setTankSize={trip.setTankSize}
            cruisingSpeed={trip.cruisingSpeed}
            setCruisingSpeed={trip.setCruisingSpeed}
            fuelBurn={trip.fuelBurn}
            setFuelBurn={trip.setFuelBurn}
            draft={trip.draft}
            setDraft={trip.setDraft}
            tripResult={trip.tripResult}
            onCalculate={trip.calculateTrip}
            onReset={trip.resetTrip}
            onFocusPOI={setFocusPOI}
          />
          <TripMap marinas={marinas} tripResult={trip.tripResult} focusPOI={focusPOI} />
        </div>
      )}

      {activeTab === 'chart' && (
        <div className="chart-layout">
          <TripMap marinas={marinas} tripResult={trip.tripResult} focusPOI={focusPOI} fullscreen />
          {trip.tripResult && (
            <div className="chart-overlay">
              <div className="chart-overlay-stats">
                <span><strong>{trip.tripResult.start.name}</strong> → <strong>{trip.tripResult.dest.name}</strong></span>
                <span className="chart-stat">{trip.tripResult.distanceNM} NM</span>
                <span className="chart-stat">{trip.tripResult.travelTimeFormatted}</span>
                <span className="chart-stat">{trip.tripResult.fuelUsed} gal fuel</span>
              </div>
            </div>
          )}
          {!trip.tripResult && (
            <div className="chart-overlay">
              <div className="chart-overlay-stats">
                <span>Plan a trip in the Trip Planner tab to see your route charted here</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

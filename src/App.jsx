import { useState, useRef, useEffect } from 'react'
import { marinas, shoalAreas } from './data'
import { useTripCalculator } from './hooks/useTripCalculator'
import Sidebar from './components/Sidebar'
import TripMap from './components/TripMap'

export default function App() {
  const trip = useTripCalculator()
  const [activeTab, setActiveTab] = useState('planner')
  const [sheetOpen, setSheetOpen] = useState(true)
  const [sheetDrag, setSheetDrag] = useState(null)
  const sheetRef = useRef(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const handleTouchStart = (e) => {
    if (!sheetRef.current) return
    startYRef.current = e.touches[0].clientY
    startHeightRef.current = sheetRef.current.getBoundingClientRect().height
    setSheetDrag(startHeightRef.current)
  }

  const handleTouchMove = (e) => {
    if (sheetDrag === null) return
    const delta = startYRef.current - e.touches[0].clientY
    const newHeight = Math.max(60, Math.min(window.innerHeight * 0.92, startHeightRef.current + delta))
    setSheetDrag(newHeight)
  }

  const handleTouchEnd = () => {
    if (sheetDrag === null) return
    const threshold = window.innerHeight * 0.25
    if (sheetDrag < threshold) {
      setSheetOpen(false)
    } else {
      setSheetOpen(true)
    }
    setSheetDrag(null)
  }

  useEffect(() => {
    if (trip.tripResult) setSheetOpen(true)
  }, [trip.tripResult])

  return (
    <div className="app">
      {/* Desktop tab bar */}
      <div className="tab-bar desktop-only">
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

      {/* Desktop layout */}
      {activeTab === 'planner' && (
        <div className="planner-layout desktop-only">
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
          />
          <TripMap marinas={marinas} shoalAreas={shoalAreas} />
        </div>
      )}

      {activeTab === 'chart' && (
        <div className="chart-layout desktop-only">
          <TripMap marinas={marinas} shoalAreas={shoalAreas} />
        </div>
      )}

      {/* Mobile layout: map always visible, sidebar as bottom sheet */}
      <div className="mobile-layout mobile-only">
        <div className="mobile-map">
          <TripMap marinas={marinas} shoalAreas={shoalAreas} />
        </div>

        <div
          ref={sheetRef}
          className={`mobile-sheet ${sheetOpen ? 'sheet-open' : 'sheet-collapsed'} ${activeTab === 'chart' ? 'sheet-hidden' : ''}`}
          style={sheetDrag !== null ? { height: `${sheetDrag}px`, transition: 'none' } : undefined}
        >
          <div
            className="sheet-handle"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="sheet-handle-bar" />
          </div>
          <div className="sheet-content">
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
            />
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="mobile-tab-bar">
          <button
            className={`mobile-tab ${activeTab === 'planner' ? 'mobile-tab-active' : ''}`}
            onClick={() => { setActiveTab('planner'); setSheetOpen(true) }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <span>Planner</span>
          </button>
          <button
            className={`mobile-tab ${activeTab === 'chart' ? 'mobile-tab-active' : ''}`}
            onClick={() => { setActiveTab('chart'); setSheetOpen(false) }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <span>Chart</span>
          </button>
          <button
            className={`mobile-tab ${activeTab === 'locate' ? 'mobile-tab-active' : ''}`}
            onClick={() => { setActiveTab('chart'); setSheetOpen(false) }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>
            <span>Locate</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

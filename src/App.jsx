import { useState, useRef, useEffect } from 'react'
import { marinas, shoalAreas } from './data'
import { useTripCalculator } from './hooks/useTripCalculator'
import Sidebar from './components/Sidebar'
import TripMap from './components/TripMap'
import ConditionsPanel from './components/ConditionsPanel'
import FishingReportPanel from './components/FishingReportPanel'
import ErrorBoundary from './components/ErrorBoundary'

const CONDITIONS_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
    <path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
    <path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3" />
  </svg>
)

const FISHING_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z" />
    <path d="M6.5 12L2 9m4.5 3L2 15" />
    <circle cx="16" cy="10" r="0.5" fill="currentColor" />
  </svg>
)

// The same compass rose used in the sidebar header, resized for the tab bar
// and the mobile map badge so the SoundCaptain mark stays visible on the
// Chart and Conditions tabs, which have no sidebar to carry it.
const BRAND_ICON = (
  <svg viewBox="0 0 44 44" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="20" stroke="#90A4C4" strokeWidth="1.2" opacity="0.5"/>
    <circle cx="22" cy="22" r="17" stroke="#90A4C4" strokeWidth="0.6" opacity="0.3"/>
    <polygon points="22,2 25,18 22,16 19,18" fill="#C8D6E5" opacity="0.9"/>
    <polygon points="22,42 25,26 22,28 19,26" fill="#90A4C4" opacity="0.5"/>
    <polygon points="42,22 26,19 28,22 26,25" fill="#90A4C4" opacity="0.5"/>
    <polygon points="2,22 18,19 16,22 18,25" fill="#90A4C4" opacity="0.5"/>
    <polygon points="35.7,8.3 27,18 26,17 27,16" fill="#90A4C4" opacity="0.35"/>
    <polygon points="35.7,35.7 27,26 26,27 27,28" fill="#90A4C4" opacity="0.35"/>
    <polygon points="8.3,35.7 17,26 18,27 17,28" fill="#90A4C4" opacity="0.35"/>
    <polygon points="8.3,8.3 17,18 18,17 17,16" fill="#90A4C4" opacity="0.35"/>
    <circle cx="22" cy="22" r="2.5" fill="#1B2A4A" stroke="#C8D6E5" strokeWidth="1"/>
    <text x="22" y="10" textAnchor="middle" fill="#C8D6E5" fontSize="5" fontWeight="700" fontFamily="serif">N</text>
  </svg>
)

// Both layouts stay in the DOM and are toggled with CSS, so anything rendered in
// each one mounts twice. Harmless for the planner, but the conditions panel would
// ask the locator for a fix twice and hit NOAA, open-meteo and the buoy feeds
// twice on every load — so it is mounted only in the tree the breakpoint shows.
const MOBILE_QUERY = '(max-width: 768px)'

function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = (event) => setIsMobile(event.matches)
    setIsMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export default function App() {
  const trip = useTripCalculator()
  const isMobileLayout = useIsMobileLayout()
  const startMarina = marinas.find((m) => m.id === trip.startId)
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
        <div className="tab-bar-brand">
          {BRAND_ICON}
          <span>SoundCaptain</span>
        </div>
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
        <button
          className={`tab-btn ${activeTab === 'conditions' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('conditions')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
          Tides &amp; Conditions
        </button>
        <button
          className={`tab-btn ${activeTab === 'fishing' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('fishing')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z"/><path d="M6.5 12L2 9m4.5 3L2 15"/><circle cx="16" cy="10" r="0.5" fill="currentColor"/></svg>
          Fishing Reports
        </button>
      </div>

      {/* Desktop layout. Each tab gets its own boundary so a crash in one
          leaves the tab bar alive — switching away and back remounts it. */}
      {activeTab === 'planner' && (
        <ErrorBoundary>
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
          <TripMap marinas={marinas} shoalAreas={shoalAreas} focus={startMarina} />
        </div>
        </ErrorBoundary>
      )}

      {activeTab === 'chart' && (
        <ErrorBoundary>
        <div className="chart-layout desktop-only">
          <TripMap marinas={marinas} shoalAreas={shoalAreas} focus={startMarina} />
        </div>
        </ErrorBoundary>
      )}

      {activeTab === 'conditions' && !isMobileLayout && (
        <ErrorBoundary>
        <div className="conditions-layout desktop-only">
          <ConditionsPanel fallbackMarinaId={trip.startId} />
        </div>
        </ErrorBoundary>
      )}

      {activeTab === 'fishing' && !isMobileLayout && (
        <ErrorBoundary>
        <div className="conditions-layout desktop-only">
          <FishingReportPanel fallbackMarinaId={trip.startId} />
        </div>
        </ErrorBoundary>
      )}

      {/* Mobile layout: map always visible, sidebar as bottom sheet */}
      <ErrorBoundary>
      <div className="mobile-layout mobile-only">
        <div className="mobile-map">
          <TripMap marinas={marinas} shoalAreas={shoalAreas} focus={startMarina} />
        </div>

        <div className="mobile-brand">
          {BRAND_ICON}
          <span>SoundCaptain</span>
        </div>

        <div
          ref={sheetRef}
          className={`mobile-sheet ${sheetOpen ? 'sheet-open' : 'sheet-collapsed'} ${activeTab === 'chart' || activeTab === 'conditions' || activeTab === 'fishing' ? 'sheet-hidden' : ''}`}
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

        {/* Conditions takes the full screen rather than the bottom sheet — it
            scrolls, and the map behind it isn't relevant to reading tides. */}
        {activeTab === 'conditions' && isMobileLayout && (
          <div className="mobile-conditions">
            <ConditionsPanel fallbackMarinaId={trip.startId} />
          </div>
        )}

        {activeTab === 'fishing' && isMobileLayout && (
          <div className="mobile-conditions">
            <FishingReportPanel fallbackMarinaId={trip.startId} />
          </div>
        )}

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
            className={`mobile-tab ${activeTab === 'conditions' ? 'mobile-tab-active' : ''}`}
            onClick={() => { setActiveTab('conditions'); setSheetOpen(false) }}
          >
            {CONDITIONS_ICON}
            <span>Tides</span>
          </button>
          <button
            className={`mobile-tab ${activeTab === 'fishing' ? 'mobile-tab-active' : ''}`}
            onClick={() => { setActiveTab('fishing'); setSheetOpen(false) }}
          >
            {FISHING_ICON}
            <span>Fishing</span>
          </button>
        </nav>
      </div>
      </ErrorBoundary>
    </div>
  )
}

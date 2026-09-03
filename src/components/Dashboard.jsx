import { useMemo, useState, useEffect } from 'react'
import { marinas, soundSpecies } from '../data'
import { degreesToCardinal } from '../utils'
import { useGeolocation } from '../hooks/useGeolocation'
import { useConditions } from '../hooks/useConditions'
import { estimateWindWaves } from '../services/forecast'

const ICONS = {
  compass: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
  ),
  wave: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
  ),
  fish: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z"/><path d="M6.5 12L2 9m4.5 3L2 15"/><circle cx="16" cy="10" r="0.5" fill="currentColor"/></svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/><path d="M17 8a3 3 0 1 0 3 5H2"/></svg>
  ),
  tide: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><polyline points="9 5 12 2 15 5"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  ),
}

// One representative harbor per region, west to east, so a skipper who has
// never opened the picker sees the range of the app before touching it. Ids
// point back into `marinas` rather than duplicating name/lat/lng, so a
// rename or a re-plotted approach in data.js stays in sync automatically.
const FEATURED_DESTINATION_IDS = [
  'mystic',
  'greenport',
  'block-island-new',
  'newport',
  'cuttyhunk',
  'nantucket',
]

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDateLong(date) {
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

// Same comfort bands ConditionsPanel uses for the wind outlook bars, repeated
// here rather than imported so this card can fail independently of that file
// ever changing its internal thresholds.
function windBand(kt) {
  if (kt == null) return 'unknown'
  if (kt < 10) return 'calm'
  if (kt < 18) return 'moderate'
  if (kt < 25) return 'brisk'
  return 'rough'
}

export default function Dashboard({ fallbackMarinaId, onOpenTab, onPickDestination }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const geo = useGeolocation({ autoStart: true, highAccuracy: false })
  const fallbackMarina =
    marinas.find((m) => m.id === fallbackMarinaId) || marinas.find((m) => m.id === 'stamford') || marinas[0]

  const place = geo.position
    ? { lat: geo.position.lat, lng: geo.position.lng, label: 'your location', source: 'gps' }
    : { lat: fallbackMarina.lat, lng: fallbackMarina.lng, label: fallbackMarina.name, source: 'fallback' }

  const conditions = useConditions({ lat: place.lat, lng: place.lng })
  const currentWeather = conditions.forecast.data?.current ?? null
  const tideData = conditions.tides.data ?? null
  const activeAlerts = conditions.alerts.data ?? []

  const seaState = useMemo(() => {
    if (currentWeather?.windKt == null) return null
    return estimateWindWaves(currentWeather.windKt, currentWeather.windDirDeg, tideData, place)
  }, [currentWeather, tideData, place.lat, place.lng])

  const nextTide = tideData?.nextHigh && tideData?.nextLow
    ? (tideData.nextHigh.at < tideData.nextLow.at ? tideData.nextHigh : tideData.nextLow)
    : tideData?.nextHigh || tideData?.nextLow || null
  const nextTideKind = nextTide === tideData?.nextHigh ? 'High' : 'Low'

  const monthNum = now.getMonth() + 1
  const inSeason = soundSpecies.filter((s) => s.months.includes(monthNum))

  const featuredDestinations = FEATURED_DESTINATION_IDS
    .map((id) => marinas.find((m) => m.id === id))
    .filter(Boolean)

  const band = windBand(currentWeather?.windKt)

  return (
    <div className="dashboard">
      <section className="dash-hero">
        <div className="dash-hero-grid" aria-hidden="true" />
        <div className="dash-hero-content">
          <p className="dash-hero-eyebrow">{formatDateLong(now)} · {formatClock(now)}</p>
          <h1 className="dash-hero-title">Fair winds, Captain.</h1>
          <p className="dash-hero-tagline">
            Your home waters, from Throgs Neck to Nantucket, plotted over a real
            nautical chart. Plan a run, check the water, or see what's biting.
          </p>
          <button className="dash-hero-cta" onClick={() => onOpenTab('planner')}>
            {ICONS.compass}
            Plan a Trip
            {ICONS.arrow}
          </button>
        </div>

        <div className="dash-glance">
          <div className="dash-glance-head">
            <span className="dash-glance-icon">{ICONS.pin}</span>
            <span>
              Conditions at {place.source === 'gps' ? 'your location' : fallbackMarina.name}
            </span>
          </div>
          <div className="dash-glance-metrics">
            <div className="dash-glance-metric">
              <span className="dash-glance-label">{ICONS.wind} Wind</span>
              <span className={`dash-glance-value dash-band-${band}`}>
                {currentWeather?.windKt != null ? `${currentWeather.windKt.toFixed(0)} kt` : '—'}
              </span>
              <span className="dash-glance-sub">
                {currentWeather?.windDirDeg != null ? `from ${degreesToCardinal(currentWeather.windDirDeg)}` : ''}
              </span>
            </div>
            <div className="dash-glance-metric">
              <span className="dash-glance-label">{ICONS.wave} Seas</span>
              <span className="dash-glance-value">
                {seaState ? `${seaState.heightFt.toFixed(1)} ft` : '—'}
              </span>
              <span className="dash-glance-sub">{seaState ? 'estimated' : ''}</span>
            </div>
            <div className="dash-glance-metric">
              <span className="dash-glance-label">{ICONS.tide} Tide</span>
              <span className="dash-glance-value">
                {nextTide ? `${nextTideKind} ${formatClock(nextTide.at)}` : '—'}
              </span>
              <span className="dash-glance-sub">{tideData?.station ? tideData.station.name : ''}</span>
            </div>
            <div className="dash-glance-metric">
              <span className="dash-glance-label">Air Temp</span>
              <span className="dash-glance-value">
                {currentWeather?.airTempF != null ? `${currentWeather.airTempF.toFixed(0)}°` : '—'}
              </span>
              <span className="dash-glance-sub">
                {currentWeather?.visibilityNM != null ? `${currentWeather.visibilityNM.toFixed(0)} NM vis` : ''}
              </span>
            </div>
          </div>
          <button className="dash-glance-link" onClick={() => onOpenTab('conditions')}>
            Full tides &amp; conditions {ICONS.arrow}
          </button>
        </div>
      </section>

      {activeAlerts.length > 0 && (
        <div className="dash-alerts">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className={`dash-alert dash-alert-${alert.severity.toLowerCase()}`}>
              <span className="dash-alert-icon">{ICONS.alert}</span>
              <div>
                <strong>{alert.event}</strong>
                {alert.headline && <p>{alert.headline}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="dash-section">
        <div className="dash-actions-grid">
          <button className="dash-action-card dash-action-planner" onClick={() => onOpenTab('planner')}>
            <span className="dash-action-icon">{ICONS.compass}</span>
            <span className="dash-action-title">Trip Planner</span>
            <span className="dash-action-desc">Distance, fuel burn, no-wake delays and draft warnings for any run.</span>
          </button>
          <button className="dash-action-card dash-action-chart" onClick={() => onOpenTab('chart')}>
            <span className="dash-action-icon">{ICONS.chart}</span>
            <span className="dash-action-title">Nautical Chart</span>
            <span className="dash-action-desc">NOAA chart tiles with shoals, marks and your live position.</span>
          </button>
          <button className="dash-action-card dash-action-conditions" onClick={() => onOpenTab('conditions')}>
            <span className="dash-action-icon">{ICONS.wave}</span>
            <span className="dash-action-title">Tides &amp; Conditions</span>
            <span className="dash-action-desc">Sea state, tide charts, wind outlook and active marine alerts.</span>
          </button>
          <button className="dash-action-card dash-action-fishing" onClick={() => onOpenTab('fishing')}>
            <span className="dash-action-icon">{ICONS.fish}</span>
            <span className="dash-action-title">Fishing Reports</span>
            <span className="dash-action-desc">Local shop reports summarized, plus what's in season now.</span>
          </button>
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section-head">
          <h2>Explore the coast</h2>
          <p>One stop per region, Long Island Sound out to Nantucket.</p>
        </div>
        <div className="dash-destinations">
          {featuredDestinations.map((dest) => (
            <button
              key={dest.id}
              className="dash-dest-card"
              onClick={() => onPickDestination(dest.id)}
            >
              <span className="dash-dest-region">{dest.region}</span>
              <span className="dash-dest-name">{dest.name}</span>
              <span className="dash-dest-cta">Plan a trip here {ICONS.arrow}</span>
            </button>
          ))}
        </div>
      </section>

      {inSeason.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Biting now</h2>
            <p>Species typically in season this month on Long Island Sound.</p>
          </div>
          <div className="dash-species-row">
            {inSeason.map((s) => (
              <span key={s.id} className="dash-species-pill" title={s.note}>
                {ICONS.fish}
                {s.name}
              </span>
            ))}
          </div>
          <button className="dash-glance-link" onClick={() => onOpenTab('fishing')}>
            See fishing reports {ICONS.arrow}
          </button>
        </section>
      )}

      <footer className="dash-footer">
        <p>
          Every number here runs client-side from charted data and live NOAA, NWS and
          Open-Meteo feeds — no account, no tracking. Sea state is always an estimate,
          never a measurement.
        </p>
      </footer>
    </div>
  )
}

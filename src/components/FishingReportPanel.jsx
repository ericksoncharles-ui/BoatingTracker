import { useMemo } from 'react'
import { marinas, fishingLinks } from '../data'
import { degreesToCardinal } from '../utils'
import { useConditions } from '../hooks/useConditions'

const ICONS = {
  fish: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z" />
      <path d="M6.5 12L2 9m4.5 3L2 15" />
      <circle cx="16" cy="10" r="0.5" fill="currentColor" />
    </svg>
  ),
  tide: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><polyline points="9 5 12 2 15 5"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
}

function formatClock(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

// The two hours or so around a tide change is when current is actively
// moving bait and fish around structure — a rule of thumb anglers on the
// Sound go by, not a guarantee. Dead slack (the middle of that window) and
// the long stretch between changes are the quiet times.
const PRIME_WINDOW_MINUTES = 90

function useBiteWindow(tideData) {
  return useMemo(() => {
    const extremes = tideData?.extremes
    if (!extremes?.length) return null
    const now = Date.now()
    let nearest = null
    for (const e of extremes) {
      const diff = Math.abs(e.at.getTime() - now)
      if (!nearest || diff < nearest.diff) nearest = { ...e, diff }
    }
    if (!nearest) return null
    const minutes = Math.round(nearest.diff / 60000)
    return {
      minutes,
      prime: minutes <= PRIME_WINDOW_MINUTES,
      past: nearest.at.getTime() < now,
      kind: nearest.kind,
    }
  }, [tideData])
}

function Metric({ label, value, unit, sub }) {
  return (
    <div className="cond-metric">
      <span className="cond-metric-label">{label}</span>
      <span className="cond-metric-value">
        {value == null ? '—' : value}
        {value != null && unit && <small>{unit}</small>}
      </span>
      {sub && <span className="cond-metric-sub">{sub}</span>}
    </div>
  )
}

const LINK_KIND_LABEL = { shop: 'Local Shop', aggregate: 'Aggregate Reports' }

export default function FishingReportPanel({ fallbackMarinaId }) {
  const marina =
    marinas.find((m) => m.id === fallbackMarinaId) || marinas.find((m) => m.id === 'stamford') || marinas[0]

  const conditions = useConditions({ lat: marina.lat, lng: marina.lng, enabled: true })
  const { tides, buoy, forecast, loading } = conditions

  const tideData = tides.status === 'ok' ? tides.data : null
  const buoyData = buoy.status === 'ok' || buoy.status === 'empty' ? buoy.data : null
  const currentWeather = forecast.status === 'ok' ? forecast.data.current : null
  const biteWindow = useBiteWindow(tideData)

  const nextChange = tideData?.rising ? tideData.nextHigh : tideData?.nextLow

  return (
    <div className="conditions-panel fishing-panel">
      <div className="cond-header">
        <div>
          <p className="brand-mark">SoundCaptain</p>
          <h2>Fishing Reports</h2>
          <p className="cond-location">
            Live water conditions near {marina.name.split(',')[0]}, plus reports from the shops and sites
            that cover the Sound.
          </p>
        </div>
      </div>

      <section className="cond-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.fish}</span>
            Bite Conditions
          </h3>
          {biteWindow && (
            <span className={`cond-badge ${biteWindow.prime ? 'cond-badge-estimated' : ''}`}>
              {biteWindow.prime ? 'Prime window' : 'Between changes'}
            </span>
          )}
        </header>

        {loading && !tideData && !currentWeather && <p className="cond-note">Loading…</p>}

        {!loading && !tideData && !currentWeather && (
          <p className="cond-error">
            Could not load live conditions — try again from the Tides &amp; Conditions tab.
          </p>
        )}

        {(tideData || currentWeather) && (
          <>
            <div className="cond-metrics">
              <Metric
                label="Tide"
                value={tideData?.rising == null ? null : tideData.rising ? 'Flooding' : 'Ebbing'}
                sub={nextChange ? `${tideData.rising ? 'high' : 'low'} at ${formatClock(nextChange.at)}` : null}
              />
              <Metric
                label="Water Temp"
                value={buoyData?.readings?.waterTempF?.toFixed(0)}
                unit="°F"
              />
              <Metric
                label="Wind"
                value={currentWeather?.windKt?.toFixed(0)}
                unit="kt"
                sub={
                  currentWeather?.windDirDeg != null
                    ? `from ${degreesToCardinal(currentWeather.windDirDeg)}`
                    : null
                }
              />
              <Metric label="Air Temp" value={currentWeather?.airTempF?.toFixed(0)} unit="°F" />
            </div>

            {biteWindow && (
              <p className={`cond-provenance ${biteWindow.prime ? '' : 'cond-provenance-warn'}`}>
                {biteWindow.prime
                  ? `Moving water — ${formatMinutes(biteWindow.minutes)} ${biteWindow.past ? 'since' : 'until'} the ${biteWindow.kind}. Current is actively pushing bait around structure.`
                  : `${formatMinutes(biteWindow.minutes)} ${biteWindow.past ? 'since' : 'until'} the ${biteWindow.kind} — slower water between tide changes.`}
              </p>
            )}

            {tideData?.station && (
              <p className="cond-note">
                Tide: {tideData.station.name} ({tideData.station.distanceNM} NM away)
                {buoyData?.station && <> · Water temp: {buoyData.station.name}</>}
              </p>
            )}
          </>
        )}
      </section>

      <section className="cond-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.tide}</span>
            Reports &amp; Tackle Shops
          </h3>
        </header>
        <p className="cond-note">
          Species, bait, and hot spots change week to week — check these before you head out.
        </p>
        <div className="cond-links">
          {fishingLinks.map((link) => (
            <a
              key={link.id}
              className="cond-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="cond-link-label">
                {link.label}
                <span className="cond-link-icon">{ICONS.external}</span>
                {link.kind && <span className="cond-badge cond-link-badge">{LINK_KIND_LABEL[link.kind]}</span>}
              </span>
              <span className="cond-link-desc">{link.description}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

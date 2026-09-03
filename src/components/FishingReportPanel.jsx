import { useMemo } from 'react'
import { marinas, fishingLinks, soundSpecies } from '../data'
import { degreesToCardinal } from '../utils'
import { useConditions } from '../hooks/useConditions'
import FishingSummary from './FishingSummary'

const ICONS = {
  fish: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c0-3.5 4-7 10-8-1 2-1.5 4-1.5 6s.5 4 1.5 6c-6-1-10-4.5-10-8z" />
      <path d="M6.5 12L2 9m4.5 3L2 15" />
      <circle cx="16" cy="10" r="0.5" fill="currentColor" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
  shop: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6"/></svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>
  ),
}

const LINK_KIND = {
  shop: { label: 'Local Shop', icon: ICONS.shop, accent: 'link-accent-gold' },
  aggregate: { label: 'Aggregate Reports', icon: ICONS.report, accent: 'link-accent-sea' },
  regs: { label: 'Regulations', icon: ICONS.shield, accent: 'link-accent-green' },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

export default function FishingReportPanel({ fallbackMarinaId }) {
  const marina =
    marinas.find((m) => m.id === fallbackMarinaId) || marinas.find((m) => m.id === 'stamford') || marinas[0]

  const conditions = useConditions({ lat: marina.lat, lng: marina.lng, enabled: true })
  const { tides, forecast, loading } = conditions

  const tideData = tides.status === 'ok' ? tides.data : null
  const currentWeather = forecast.status === 'ok' ? forecast.data.current : null
  const biteWindow = useBiteWindow(tideData)

  const nextChange = tideData?.rising ? tideData.nextHigh : tideData?.nextLow

  const monthIdx = new Date().getMonth()
  const runningNow = soundSpecies.filter((s) => s.months.includes(monthIdx))

  return (
    <div className="conditions-panel fishing-panel">
      <div className="cond-header">
        <div>
          <p className="brand-mark">SoundCaptain</p>
          <h2>Fishing Reports</h2>
          <p className="cond-location">
            Live water conditions near {marina.name.split(',')[0]}, plus what's running and where to find
            reports for the Sound.
          </p>
        </div>
      </div>

      <FishingSummary />

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

        {loading && !tideData && !currentWeather && (
          <div className="cond-metrics" aria-label="Loading" role="status">
            <div className="cond-skeleton" />
            <div className="cond-skeleton" />
            <div className="cond-skeleton" />
          </div>
        )}

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
              </p>
            )}
          </>
        )}
      </section>

      <section className="cond-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.fish}</span>
            Running Now — {MONTH_NAMES[monthIdx]}
          </h3>
        </header>

        {runningNow.length === 0 ? (
          <p className="cond-note">A quieter stretch on the Sound for these species — check the reports below.</p>
        ) : (
          <div className="species-grid">
            {runningNow.map((s) => (
              <div className="species-card" key={s.id}>
                <span className="species-name">{s.name}</span>
                <span className="species-note">{s.note}</span>
              </div>
            ))}
          </div>
        )}
        <p className="cond-note">
          General seasonal timing, not a live report — conditions shift year to year. Check current
          regulations before you keep anything.
        </p>
      </section>

      <section className="cond-card fishing-links-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.link}</span>
            Reports, Shops &amp; Regulations
          </h3>
        </header>
        <p className="cond-note">
          Species, bait, and hot spots change week to week — check these before you head out.
        </p>
        <div className="cond-links fishing-links">
          {fishingLinks.map((link) => {
            const kind = LINK_KIND[link.kind]
            return (
              <a
                key={link.id}
                className={`cond-link fishing-link ${kind?.accent || ''}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="cond-link-label">
                  {link.label}
                  <span className="cond-link-icon">{ICONS.external}</span>
                </span>
                <span className="cond-link-desc">{link.description}</span>
                {kind && (
                  <span className="fishing-link-kind">
                    {kind.icon}
                    {kind.label}
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </section>
    </div>
  )
}

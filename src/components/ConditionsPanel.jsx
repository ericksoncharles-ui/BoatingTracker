import { useEffect, useMemo, useState } from 'react'
import { marinas, lisicosLinks } from '../data'
import { degreesToCardinal } from '../utils'
import { useGeolocation } from '../hooks/useGeolocation'
import { useConditions } from '../hooks/useConditions'
import { estimateWindWaves } from '../services/forecast'
import TideChart from './TideChart'

const ICONS = {
  wave: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
  ),
  tide: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><polyline points="9 5 12 2 15 5"/><path d="M3 14c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/><path d="M3 20c0 0 2-3 5-3s5 3 5 3 2-3 5-3 5 3 5 3"/></svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/><path d="M17 8a3 3 0 1 0 3 5H2"/></svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  ),
}

function formatClock(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatAge(minutes) {
  if (minutes == null) return null
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m ago` : `${hours}h ago`
}

function formatCountdown(date) {
  if (!date) return null
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return 'now'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `in ${minutes}m`
  return `in ${hours}h ${minutes}m`
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function formatDayLabel(date) {
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return date.toLocaleDateString([], { weekday: 'short' })
}

// Comfort bands for the small boats this app plans for, on Long Island Sound.
// The Sound's short fetch means wind turns into a steep, close-spaced chop fast:
// under 10 kt is a flat day, by 18 kt it is uncomfortable, and 25 kt is where
// small craft advisories land.
function windBand(kt) {
  if (kt == null) return 'unknown'
  if (kt < 10) return 'calm'
  if (kt < 18) return 'moderate'
  if (kt < 25) return 'brisk'
  return 'rough'
}

// Bars are scaled against 30 kt rather than the week's own maximum, so a calm
// week reads as calm instead of stretching its lightest day to full width.
const WIND_BAR_MAX_KT = 30

// How long the panel holds off fetching while it waits for a first fix.
const GEO_GRACE_MS = 8000

// Wind direction is the direction the wind comes *from*, so the arrow has to
// point the opposite way — where it is pushing you.
function WindArrow({ deg }) {
  if (deg == null) return null
  return (
    <svg
      className="cond-wind-arrow"
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${(deg + 180) % 360}deg)` }}
    >
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="6 10 12 4 18 10" />
    </svg>
  )
}

function formatAgeFromMs(ms) {
  if (ms == null) return null
  return formatAge(Math.max(0, Math.round((Date.now() - ms) / 60000)))
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

// `substituted` means the card is showing usable numbers from another source
// despite its own being down. The outage then belongs in the provenance line
// under those numbers, not in a banner above them that reads like the card
// failed — and never as a raw fetch error the skipper can't act on.
function Card({ icon, title, badge, section, children, emptyMessage, substituted = false }) {
  const status = section?.status
  const showSpinner = status === 'loading' && !section?.data && !substituted

  return (
    <section className="cond-card">
      <header className="cond-card-head">
        <h3>
          <span className="cond-card-icon">{icon}</span>
          {title}
        </h3>
        {badge}
      </header>

      {showSpinner && <p className="cond-note">Loading…</p>}
      {status === 'error' && !substituted && (
        <p className="cond-error">
          {section.error || 'Could not load this data.'}
        </p>
      )}
      {status === 'empty' && !substituted && (
        <p className="cond-note">{emptyMessage || 'No data available.'}</p>
      )}
      {children}
    </section>
  )
}

export default function ConditionsPanel({ fallbackMarinaId }) {
  const geo = useGeolocation({ autoStart: true, highAccuracy: false })
  const [overrideId, setOverrideId] = useState('')
  // Countdowns and "x min ago" labels need to keep moving without a refetch.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const [geoGraceOver, setGeoGraceOver] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setGeoGraceOver(true), GEO_GRACE_MS)
    return () => clearTimeout(id)
  }, [])

  const fallbackMarina =
    marinas.find((m) => m.id === fallbackMarinaId) || marinas.find((m) => m.id === 'stamford') || marinas[0]
  const overrideMarina = overrideId ? marinas.find((m) => m.id === overrideId) : null

  // Geolocation hasn't answered yet — neither a fix nor a refusal.
  const geoPending = geo.tracking || (!geo.position && !geo.error)
  const searchingForGeo = !overrideMarina && geoPending

  const place = overrideMarina
    ? { lat: overrideMarina.lat, lng: overrideMarina.lng, label: overrideMarina.name, source: 'picked' }
    : geo.position
      ? { lat: geo.position.lat, lng: geo.position.lng, label: 'your location', source: 'gps' }
      : { lat: fallbackMarina.lat, lng: fallbackMarina.lng, label: fallbackMarina.name, source: 'fallback' }

  // Holding off on the fetch until the locator answers avoids a double round of
  // requests, but a locator that has to escalate can take most of a minute, and
  // a blank screen at the helm is worse than tides for the harbor you probably
  // left from. Wait a few seconds, then show the fallback — a fix arriving later
  // just moves the position and refetches.
  const waitingForGeo = searchingForGeo && !geoGraceOver

  const conditions = useConditions({ lat: place.lat, lng: place.lng, enabled: !waitingForGeo })
  const { tides, buoy, forecast, alerts, refresh, updatedAt, cachedAt, failedAt, loading } = conditions

  const buoyData = buoy.status === 'ok' || buoy.status === 'empty' ? buoy.data : null
  const currentWeather = forecast.status === 'ok' ? forecast.data.current : null

  // Wave height comes from the buoy when it has one. When it doesn't — sensor
  // down, or the buoy is out for the season — fall back to a wind-driven
  // estimate, labelled as such.
  const seaState = useMemo(() => {
    const readings = buoyData?.readings
    if (readings?.waveHeightFt != null) {
      return {
        source: 'observed',
        heightFt: readings.waveHeightFt,
        periodS: readings.wavePeriodS ?? readings.waveMeanPeriodS,
        dirDeg: readings.waveDirDeg,
      }
    }
    if (currentWeather?.windKt != null) {
      const estimate = estimateWindWaves(currentWeather.windKt, currentWeather.windDirDeg)
      if (estimate) {
        return {
          source: 'estimated',
          heightFt: estimate.heightFt,
          periodS: estimate.periodS,
          fetchNM: estimate.fetchNM,
          dirDeg: currentWeather.windDirDeg,
        }
      }
    }
    return null
  }, [buoyData, currentWeather])

  // The multi-day outlook is wind-first: peak wind, gusts, dominant direction
  // and the seas that combination would build. `daily` is optional so a payload
  // cached before this section existed still renders.
  const dailyOutlook = useMemo(() => {
    const days = forecast.status === 'ok' ? forecast.data.daily : null
    if (!days?.length) return []
    return days.map((day) => {
      const seas = estimateWindWaves(day.windKt, day.windDirDeg)
      return {
        ...day,
        band: windBand(day.windKt),
        barPct: Math.min(100, Math.round(((day.windKt ?? 0) / WIND_BAR_MAX_KT) * 100)),
        seasFt: seas?.heightFt ?? null,
      }
    })
  }, [forecast])

  // Why the wave numbers are estimated, in the fewest words that stay accurate.
  // The fetch walks every Sound buoy, so "empty" means all of them are silent
  // and "sensor down" means the nearest reporting buoy had no wave reading.
  const buoyOutage =
    buoy.status === 'empty'
      ? 'no Sound buoy reporting'
      : buoy.status === 'error'
        ? 'buoy feeds unreachable'
        : buoy.status === 'ok' && buoyData?.readings?.waveHeightFt == null
          ? `${buoyData?.station?.name || 'buoy'} wave sensor down`
          : null

  const activeAlerts = alerts.status === 'ok' ? alerts.data : []
  const tideData = tides.status === 'ok' ? tides.data : null

  const locationNote = {
    gps: 'Using your location',
    picked: `Showing ${place.label}`,
    fallback: searchingForGeo
      ? `Still finding your location — showing ${fallbackMarina.name}`
      : geo.error
        ? `${geo.error} — showing ${fallbackMarina.name}`
        : `Showing ${fallbackMarina.name}`,
  }[place.source]

  return (
    <div className="conditions-panel">
      <div className="cond-header">
        <div>
          <h2>On-Water Conditions</h2>
          <p className="cond-location">
            <span className="cond-location-icon">{ICONS.pin}</span>
            {waitingForGeo ? 'Finding your location…' : locationNote}
            {/* A failed fix used to be permanent until a reload. Locators fail
                transiently, so there has to be a way to ask again. */}
            {!searchingForGeo && place.source === 'fallback' && (
              <button className="cond-location-retry" onClick={geo.start}>
                Try again
              </button>
            )}
          </p>
        </div>
        <button
          className="cond-refresh"
          onClick={refresh}
          disabled={loading || waitingForGeo}
          title="Refresh conditions"
        >
          <span className={loading ? 'cond-spin' : undefined}>{ICONS.refresh}</span>
        </button>
      </div>

      <label className="cond-place-picker">
        Location
        <select
          value={overrideId}
          onChange={(e) => {
            const next = e.target.value
            setOverrideId(next)
            // Choosing "My location" back is how a skipper asks for another fix
            // after picking a marina to get past a failed one.
            if (!next && !geo.position) geo.start()
          }}
        >
          <option value="">My location{geo.error ? ' (unavailable)' : ''}</option>
          {marinas.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>

      {activeAlerts.length > 0 && (
        <div className="cond-alerts">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className={`cond-alert cond-alert-${alert.severity.toLowerCase()}`}>
              <span className="cond-alert-icon">{ICONS.alert}</span>
              <div>
                <strong>{alert.event}</strong>
                {alert.headline && <p>{alert.headline}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card
        icon={ICONS.wave}
        title="Sea State"
        section={buoy}
        emptyMessage={buoy.data?.message}
        substituted={seaState?.source === 'estimated'}
        badge={
          seaState && (
            <span className={`cond-badge ${seaState.source === 'observed' ? 'cond-badge-observed' : 'cond-badge-estimated'}`}>
              {seaState.source === 'observed'
                ? `Observed · ${buoyData?.station?.name || 'buoy'}`
                : 'Estimated'}
            </span>
          )
        }
      >
        {seaState && (
          <>
            <div className="cond-metrics">
              <Metric label="Wave Height" value={seaState.heightFt?.toFixed(1)} unit="ft" />
              <Metric label="Period" value={seaState.periodS?.toFixed(1)} unit="s" />
              <Metric
                label="Direction"
                value={seaState.dirDeg != null ? degreesToCardinal(seaState.dirDeg) : null}
                sub={seaState.dirDeg != null ? `${Math.round(seaState.dirDeg)}°` : null}
              />
              <Metric
                label="Water Temp"
                value={buoyData?.readings?.waterTempF?.toFixed(0)}
                unit="°F"
              />
            </div>

            {seaState.source === 'observed' ? (
              <p className="cond-provenance">
                Observed · {buoyData.station.name} ({buoyData.station.operator}) ·{' '}
                {formatAge(buoyData.ageMinutes) || 'time unknown'}
                {buoyData.distanceNM != null && (
                  <> · {buoyData.distanceNM} NM {buoyData.bearingCardinal} of you</>
                )}
              </p>
            ) : (
              <p className="cond-provenance cond-provenance-warn">
                Estimated from wind — not measured
                {buoyOutage && <> · {buoyOutage}</>}
                {seaState.fetchNM != null && <> · {seaState.fetchNM} NM fetch</>}
              </p>
            )}

            {buoyData?.regional && seaState.source === 'observed' && (
              <p className="cond-note">
                The buoy is {buoyData.distanceNM} NM away, so treat these as regional
                conditions rather than the water you're on.
              </p>
            )}

            {buoyData?.positionWarning && (
              <p className="cond-error">{buoyData.positionWarning}</p>
            )}

            {buoyData?.stale && (
              <p className="cond-note">
                Latest buoy report is {formatAge(buoyData.ageMinutes)} — the station may be
                reporting intermittently.
              </p>
            )}
          </>
        )}
      </Card>

      <Card
        icon={ICONS.tide}
        title="Tides"
        section={tides}
        badge={<span className="cond-badge">Predicted · NOAA CO-OPS</span>}
      >
        {tideData && (
          <>
            <p className="cond-station">
              {tideData.station.name}
              {tideData.station.state ? `, ${tideData.station.state}` : ''} ·{' '}
              {tideData.station.distanceNM} NM away
            </p>

            <div className="cond-metrics">
              <Metric
                label="Next High"
                value={tideData.nextHigh ? formatClock(tideData.nextHigh.at) : null}
                sub={
                  tideData.nextHigh
                    ? `${tideData.nextHigh.heightFt.toFixed(1)} ft · ${formatCountdown(tideData.nextHigh.at)}`
                    : null
                }
              />
              <Metric
                label="Next Low"
                value={tideData.nextLow ? formatClock(tideData.nextLow.at) : null}
                sub={
                  tideData.nextLow
                    ? `${tideData.nextLow.heightFt.toFixed(1)} ft · ${formatCountdown(tideData.nextLow.at)}`
                    : null
                }
              />
              <Metric
                label="Tide"
                value={tideData.rising == null ? null : tideData.rising ? 'Rising' : 'Falling'}
              />
              <Metric
                label="Observed"
                value={tideData.observed?.heightFt?.toFixed(1)}
                unit="ft"
                sub={tideData.observed ? `MLLW · ${formatClock(tideData.observed.at)}` : 'no sensor'}
              />
            </div>

            <TideChart curve={tideData.curve} extremes={tideData.extremes} />

            {tideData.extremes.length > 0 && (
              <ul className="cond-tide-list">
                {tideData.extremes.map((e) => (
                  <li key={`${e.kind}-${e.at.getTime()}`} className={e.at.getTime() < Date.now() ? 'cond-past' : undefined}>
                    <span className={`cond-tide-kind cond-tide-${e.kind}`}>
                      {e.kind === 'high' ? 'High' : 'Low'}
                    </span>
                    <span>{formatClock(e.at)}</span>
                    <span className="cond-tide-height">{e.heightFt.toFixed(1)} ft</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <Card
        icon={ICONS.wind}
        title="Wind & Weather"
        section={forecast}
        badge={<span className="cond-badge">Forecast · Open-Meteo</span>}
      >
        {currentWeather && (
          <>
            <div className="cond-metrics">
              <Metric
                label="Wind"
                value={currentWeather.windKt?.toFixed(0)}
                unit="kt"
                sub={
                  currentWeather.windDirDeg != null
                    ? `from ${degreesToCardinal(currentWeather.windDirDeg)} (${Math.round(currentWeather.windDirDeg)}°)`
                    : null
                }
              />
              <Metric label="Gusts" value={currentWeather.gustKt?.toFixed(0)} unit="kt" />
              <Metric
                label="Air Temp"
                value={currentWeather.airTempF?.toFixed(0)}
                unit="°F"
                sub={currentWeather.feelsLikeF != null ? `feels ${currentWeather.feelsLikeF.toFixed(0)}°` : null}
              />
              <Metric label="Pressure" value={currentWeather.pressureInHg?.toFixed(2)} unit="inHg" />
              <Metric
                label="Visibility"
                value={currentWeather.visibilityNM != null ? currentWeather.visibilityNM.toFixed(1) : null}
                unit="NM"
              />
              {buoyData?.readings?.windKt != null && (
                <Metric
                  label="Buoy Wind"
                  value={buoyData.readings.windKt.toFixed(0)}
                  unit="kt"
                  sub="observed"
                />
              )}
            </div>

            {forecast.data.hourly.length > 0 && (
              <>
                <h4 className="cond-subhead">Next 24 hours</h4>
                <ul className="cond-hourly">
                  {forecast.data.hourly.map((hour) => (
                    <li key={hour.at.getTime()} className={`cond-band-${windBand(hour.windKt)}`}>
                      <span className="cond-hour">
                        {hour.at.toLocaleTimeString([], { hour: 'numeric' })}
                      </span>
                      <span className="cond-hour-wind">{hour.windKt?.toFixed(0) ?? '—'} kt</span>
                      <span className="cond-hour-dir">
                        <WindArrow deg={hour.windDirDeg} />
                        {hour.windDirDeg != null ? degreesToCardinal(hour.windDirDeg) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {dailyOutlook.length > 0 && (
              <>
                <h4 className="cond-subhead">{dailyOutlook.length}-day wind outlook</h4>
                <ul className="cond-daily">
                  {dailyOutlook.map((day) => (
                    <li key={day.at.getTime()}>
                      <span className="cond-day">
                        {/* Computed at render, not memoised — "Today" has to
                            move if the app is left open past midnight. */}
                        {formatDayLabel(day.at)}
                        <small>{day.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</small>
                      </span>

                      <span className={`cond-day-bar cond-band-${day.band}`}>
                        <i style={{ width: `${day.barPct}%` }} />
                      </span>

                      <span className="cond-day-wind">
                        {day.windKt?.toFixed(0) ?? '—'}
                        <small>kt</small>
                        {day.gustKt != null && <em>G {day.gustKt.toFixed(0)}</em>}
                      </span>

                      <span className="cond-day-dir">
                        <WindArrow deg={day.windDirDeg} />
                        {day.windDirDeg != null ? degreesToCardinal(day.windDirDeg) : ''}
                      </span>

                      <span className="cond-day-seas">
                        {day.seasFt != null ? `~${day.seasFt.toFixed(1)} ft` : '—'}
                        {day.highF != null && (
                          <small>
                            {day.highF.toFixed(0)}°{day.lowF != null && `/${day.lowF.toFixed(0)}°`}
                          </small>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="cond-provenance">
                  Daily maximum wind and dominant direction — a day can be calmer than its
                  peak. Seas estimated from wind and Sound fetch, not measured; direction
                  beyond about five days out is a rough steer.
                </p>
              </>
            )}
          </>
        )}
      </Card>

      <section className="cond-card">
        <header className="cond-card-head">
          <h3>
            <span className="cond-card-icon">{ICONS.wave}</span>
            UConn LISICOS
          </h3>
        </header>
        <p className="cond-note">
          The Long Island Sound Integrated Coastal Observing System runs the Sound buoys these
          observations come from. Its own panels carry the full instrument set and plots.
        </p>
        <div className="cond-links">
          {lisicosLinks.map((link) => (
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
              </span>
              <span className="cond-link-desc">{link.description}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="cond-footer">
        {cachedAt ? (
          <span className="cond-stale">Stale — cached {formatAgeFromMs(cachedAt)}</span>
        ) : failedAt ? (
          <span className="cond-stale">All sources failed — {formatAgeFromMs(failedAt)}</span>
        ) : updatedAt ? (
          <span>Updated {formatAgeFromMs(updatedAt)}</span>
        ) : (
          <span>{waitingForGeo ? 'Waiting for location…' : 'Loading…'}</span>
        )}
        <span className="cond-sources">
          UConn LISICOS / NDBC · NOAA CO-OPS · NWS · Open-Meteo
        </span>
      </footer>
    </div>
  )
}

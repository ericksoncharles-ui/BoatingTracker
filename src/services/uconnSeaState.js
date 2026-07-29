import { calcDistanceNM, calcBearing, degreesToCardinal } from '../utils'
import { STALE_AFTER_MINUTES, REGIONAL_DISTANCE_NM } from './erddapBuoy'

// Client half of /api/sea-state: the server reads the UConn LISICOS buoy pages
// and returns every station's latest observation, and this picks the one that
// applies to where the boat actually is.
//
// The endpoint deliberately takes no position — all four buoys fit in one
// cached response, so choosing here keeps the skipper's location in the browser
// and lets every request share the same cache entry.
//
// The return shape matches fetchBuoyConditions so the Conditions tab can render
// either source through the same code, and the same age and distance thresholds
// are used so the two never disagree about what counts as stale or regional.

function round(value, places = 1) {
  if (value == null) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}

/**
 * Latest sea state from the nearest UConn buoy that is reporting one.
 *
 * Walks the buoys nearest-first and takes the first with a wave height, keeping
 * a waveless station as a fallback — waves from the next buoy up the Sound beat
 * no waves at all. Returns { status: 'off' } when the server has no API key and
 * { status: 'empty' } when no buoy reported anything; both are ordinary states
 * the caller should fall back from, not errors.
 */
export async function fetchUconnSeaState({ here, signal } = {}) {
  const response = await fetch('/api/sea-state', {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (response.status === 503) return { status: 'off' }
  if (!response.ok) throw new Error(`Sea state request failed: ${response.status}`)

  const payload = await response.json()
  const reporting = (payload?.buoys || []).filter((buoy) => buoy.status === 'ok')

  const distanceTo = (buoy) =>
    here?.lat != null && here?.lng != null
      ? calcDistanceNM(here.lat, here.lng, buoy.lat, buoy.lng)
      : null

  const ordered = [...reporting].sort((a, b) => (distanceTo(a) ?? 0) - (distanceTo(b) ?? 0))
  const chosen =
    ordered.find((buoy) => buoy.readings?.waveHeightFt != null) ||
    ordered.find((buoy) => Object.values(buoy.readings || {}).some((value) => value != null))

  if (!chosen) {
    return {
      status: 'empty',
      generatedAt: payload?.generatedAt ?? null,
      cached: Boolean(payload?.cached),
      buoys: payload?.buoys || [],
      message:
        'The UConn buoy pages are up but none of them is reporting conditions right now.',
    }
  }

  const observedAt = chosen.observedAt ? new Date(chosen.observedAt) : null
  const ageMinutes =
    observedAt && !Number.isNaN(observedAt.getTime())
      ? Math.max(0, Math.round((Date.now() - observedAt.getTime()) / 60000))
      : null

  const distanceRaw = distanceTo(chosen)
  const distanceNM = distanceRaw == null ? null : round(distanceRaw, 1)
  const bearingDeg =
    here?.lat != null && here?.lng != null
      ? Math.round(calcBearing(here.lat, here.lng, chosen.lat, chosen.lng))
      : null

  return {
    status: 'ok',
    station: {
      id: chosen.id,
      name: chosen.name,
      label: chosen.label,
      operator: chosen.operator,
      lat: chosen.lat,
      lng: chosen.lng,
    },
    source: chosen.source ?? null,
    observedAt,
    observedAtRaw: chosen.observedAtRaw ?? null,
    ageMinutes,
    stale: ageMinutes != null && ageMinutes > STALE_AFTER_MINUTES,
    distanceNM,
    bearingDeg,
    bearingCardinal: degreesToCardinal(bearingDeg),
    regional: distanceNM != null && distanceNM > REGIONAL_DISTANCE_NM,
    readings: chosen.readings,
    generatedAt: payload?.generatedAt ?? null,
    cached: Boolean(payload?.cached),
  }
}

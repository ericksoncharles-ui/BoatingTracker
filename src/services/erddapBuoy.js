import { calcDistanceNM, calcBearing, degreesToCardinal } from '../utils'
import { LIS_WAVE_STATIONS } from '../data'

// Observed conditions from UConn LISICOS's Long Island Sound buoys, read over
// ERDDAP's tabledap service as JSON.
//
// UConn's own ERDDAP (merlin.dms.uconn.edu:8080) is plain HTTP on a non-standard
// port. This app needs HTTPS for geolocation, and an HTTPS page may not fetch
// HTTP resources — the browser blocks it as mixed content. So the same buoy is
// read from HTTPS ERDDAP servers that mirror the national observing network.

const LOOKBACK_HOURS = 6

// Age past which a reading is shown as stale rather than current.
const STALE_AFTER_MINUTES = 90

// Beyond this distance the buoy describes the region, not the water you're in.
const REGIONAL_DISTANCE_NM = 25

// LISICOS recovers its buoys before the ice season and re-moors them in spring,
// so silence over the winter is expected rather than a fault. Blaming the season
// in July would be wrong, so the two cases are worded separately.
const RECOVERY_MONTHS = new Set([10, 11, 0, 1, 2, 3])

function describeOutage(now = new Date()) {
  return RECOVERY_MONTHS.has(now.getMonth())
    ? 'No Sound buoy is reporting. LISICOS recovers its buoys for the winter, so they are probably out of the water until spring.'
    : 'No Sound buoy is reporting right now. The buoys may be off station for servicing.'
}

const HOSTS = [
  {
    id: 'ioos',
    label: 'IOOS Sensors ERDDAP',
    // Per-station dataset, so no station constraint is needed. No column list
    // is given either: ERDDAP returns every variable, which keeps the query
    // working whatever CF standard names this dataset happens to publish.
    //
    // Dataset ids on this ERDDAP are hyphenated (confirmed via its dataset
    // search: "gov-ndbc-44040" for WLIS) — an earlier "gov_noaa_ndbc_" guess
    // 404'd for every station.
    url: (station) =>
      `https://erddap.sensors.ioos.us/erddap/tabledap/gov-ndbc-${station}.json` +
      `?&time%3E=now-${LOOKBACK_HOURS}hours&orderByMax(%22time%22)`,
  },
  {
    id: 'coastwatch',
    label: 'NOAA CoastWatch ERDDAP',
    // Nationwide NDBC aggregate. Its dataset id and column names are long
    // established, so they are named explicitly here — that also hedges the
    // all-columns form above in case a server rejects an empty variable list.
    url: (station) =>
      'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.json' +
      '?station,time,latitude,longitude,wvht,dpd,apd,mwd,wd,wspd,gst,atmp,wtmp,bar' +
      `&station=%22${station}%22&time%3E=now-${LOOKBACK_HOURS}hours&orderByMax(%22time%22)`,
  },
]

// Canonical field -> candidate column names, lowercased. IOOS Sensors ERDDAP
// publishes CF standard names; NDBC-derived datasets use NDBC's short codes.
// Matching against a synonym list means either scheme works, and column order
// never matters.
const COLUMN_SYNONYMS = {
  time: ['time'],
  lat: ['latitude', 'lat'],
  lng: ['longitude', 'lon', 'lng'],
  waveHeightM: ['sea_surface_wave_significant_height', 'wvht', 'significant_wave_height'],
  wavePeriodS: [
    'sea_surface_wave_peak_period',
    'sea_surface_wave_period_at_variance_spectral_density_maximum',
    'dpd',
    'dominant_wave_period',
  ],
  waveMeanPeriodS: ['sea_surface_wave_mean_period', 'apd', 'average_wave_period'],
  waveDirDeg: [
    'sea_surface_wave_from_direction',
    'sea_surface_wave_to_direction',
    'mwd',
    'wave_direction',
  ],
  windSpeedMs: ['wind_speed', 'wspd'],
  windGustMs: ['wind_speed_of_gust', 'gst', 'wind_gust'],
  windDirDeg: ['wind_from_direction', 'wd', 'wdir'],
  airTempC: ['air_temperature', 'atmp'],
  waterTempC: ['sea_water_temperature', 'wtmp'],
  pressureHpa: ['air_pressure', 'air_pressure_at_sea_level', 'bar', 'mbar'],
}

// ERDDAP datasets publish SI units, but a mis-typed dataset would sail straight
// into the UI as a plausible-looking number. Anything outside these ranges is
// dropped rather than displayed.
const PLAUSIBLE = {
  waveHeightFt: [0, 50],
  wavePeriodS: [0, 30],
  waveMeanPeriodS: [0, 30],
  windKt: [0, 150],
  gustKt: [0, 200],
  airTempF: [-30, 130],
  waterTempF: [20, 100],
  pressureInHg: [25, 33],
}

const M_TO_FT = 3.28084
const MS_TO_KT = 1.94384
const HPA_TO_INHG = 0.02953

function keep(field, value) {
  if (value == null || Number.isNaN(value)) return null
  const range = PLAUSIBLE[field]
  if (!range) return value
  return value >= range[0] && value <= range[1] ? value : null
}

function round(value, places = 1) {
  if (value == null) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}

/**
 * Scale a nullable reading, preserving a genuine zero — dead calm and flat water
 * are real observations, not missing ones.
 */
function scale(value, factor, places = 1) {
  return value == null ? null : round(value * factor, places)
}

function toFahrenheit(celsius) {
  return celsius == null ? null : round((celsius * 9) / 5 + 32, 1)
}

/**
 * Build a canonical field -> column index map from ERDDAP's columnNames array.
 */
function mapColumns(columnNames) {
  const lower = columnNames.map((c) => String(c).toLowerCase())
  const index = {}
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const synonym of synonyms) {
      const at = lower.indexOf(synonym)
      if (at !== -1) {
        index[field] = at
        break
      }
    }
  }
  return index
}

/**
 * Read one host. Resolves to a parsed row, or null when the host has no data
 * for the window; throws only on a genuine transport or format failure.
 */
async function readHost(host, station, signal) {
  const res = await fetch(host.url(station), { signal, headers: { Accept: 'application/json' } })

  // ERDDAP answers 404 when a query matches no rows. That is an ordinary
  // outcome here — LISICOS buoys are seasonal and are pulled for the winter —
  // so it must not surface as a failure.
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${host.label} returned ${res.status}`)

  const json = await res.json()
  const table = json?.table
  if (!table?.columnNames || !Array.isArray(table.rows)) {
    throw new Error(`${host.label} returned an unexpected response shape`)
  }
  if (table.rows.length === 0) return null

  const col = mapColumns(table.columnNames)
  // Latest row wins, in case orderByMax was ignored and several came back.
  const rows = [...table.rows]
  if (col.time != null) {
    rows.sort((a, b) => new Date(b[col.time]) - new Date(a[col.time]))
  }
  const row = rows[0]
  const num = (field) => {
    if (col[field] == null) return null
    const value = row[col[field]]
    if (value == null || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const observedAt = col.time != null ? new Date(row[col.time]) : null

  return {
    host,
    observedAt: observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt : null,
    position: { lat: num('lat'), lng: num('lng') },
    readings: {
      waveHeightFt: keep('waveHeightFt', scale(num('waveHeightM'), M_TO_FT)),
      wavePeriodS: keep('wavePeriodS', round(num('wavePeriodS'), 1)),
      waveMeanPeriodS: keep('waveMeanPeriodS', round(num('waveMeanPeriodS'), 1)),
      waveDirDeg: num('waveDirDeg'),
      windKt: keep('windKt', scale(num('windSpeedMs'), MS_TO_KT)),
      gustKt: keep('gustKt', scale(num('windGustMs'), MS_TO_KT)),
      windDirDeg: num('windDirDeg'),
      airTempF: keep('airTempF', toFahrenheit(num('airTempC'))),
      waterTempF: keep('waterTempF', toFahrenheit(num('waterTempC'))),
      pressureInHg: keep('pressureInHg', scale(num('pressureHpa'), HPA_TO_INHG, 2)),
    },
  }
}

/**
 * Latest observed conditions from the nearest reporting Long Island Sound buoy.
 *
 * Walks the LISICOS buoys nearest-first, trying each ERDDAP host per station.
 * A station answering without wave data is kept as a fallback but the walk
 * continues — waves from the next buoy up the Sound beat a wind estimate.
 * Returns { status: 'empty' } when no buoy is reporting anything — off for the
 * season, or sensors down — which callers should present as a normal state
 * rather than an error.
 *
 * `here` is the boat's position, used to order the stations and to describe how
 * far away the chosen buoy is.
 */
export async function fetchBuoyConditions({ here, signal } = {}) {
  const stations = [...LIS_WAVE_STATIONS]
  if (here?.lat != null && here?.lng != null) {
    stations.sort(
      (a, b) =>
        calcDistanceNM(here.lat, here.lng, a.lat, a.lng) -
        calcDistanceNM(here.lat, here.lng, b.lat, b.lng),
    )
  }

  const failures = []
  let attempts = 0
  let found = null
  let waveless = null

  for (const candidate of stations) {
    let row = null
    for (const host of HOSTS) {
      attempts += 1
      try {
        row = await readHost(host, candidate.id, signal)
        if (row) break
      } catch (err) {
        if (err.name === 'AbortError') throw err
        failures.push(`${candidate.name} via ${host.label}: ${err.message}`)
      }
    }
    if (!row) continue
    if (row.readings.waveHeightFt != null) {
      found = { station: candidate, row }
      break
    }
    if (!waveless) waveless = { station: candidate, row }
  }

  if (!found) found = waveless
  if (!found) {
    // Every attempt errored is a failure; anything answering "no rows" means
    // the buoys are genuinely silent, which is an ordinary outcome.
    if (attempts > 0 && failures.length === attempts) {
      throw new Error(failures.join('; '))
    }
    // A clean "no rows" 404 from one host can hide a broken host next to it —
    // the walk only throws when every attempt errors, so a wrong dataset URL
    // or a CORS-blocked mirror otherwise reads as an ordinary seasonal outage.
    // This is the only place that information isn't already visible somewhere.
    if (failures.length > 0) {
      console.warn(`[erddapBuoy] reporting empty after ${attempts} attempts; ${failures.length} errored:`, failures)
    }
    return {
      status: 'empty',
      failures,
      message: describeOutage(),
    }
  }

  const { station, row } = found

  // The station ids are hardcoded, so confirm the position ERDDAP handed back
  // is actually this station's mooring. Costs nothing — the coordinates are
  // already in the response — and stops a renamed dataset quietly feeding us
  // another buoy's readings.
  let positionWarning = null
  const { lat, lng } = row.position
  if (lat != null && lng != null) {
    const offBy = calcDistanceNM(lat, lng, station.lat, station.lng)
    if (offBy > station.toleranceNM) {
      positionWarning =
        `Station ${station.id} reported a position ${Math.round(offBy)} NM from ${station.name}'s ` +
        'expected mooring — these readings may be from a different buoy.'
    }
  }

  const ageMinutes = row.observedAt
    ? Math.max(0, Math.round((Date.now() - row.observedAt.getTime()) / 60000))
    : null

  const buoyLat = lat ?? station.lat
  const buoyLng = lng ?? station.lng
  let distanceNM = null
  let bearingDeg = null
  if (here?.lat != null && here?.lng != null) {
    distanceNM = round(calcDistanceNM(here.lat, here.lng, buoyLat, buoyLng), 1)
    bearingDeg = Math.round(calcBearing(here.lat, here.lng, buoyLat, buoyLng))
  }

  return {
    status: 'ok',
    station,
    source: { id: row.host.id, label: row.host.label },
    observedAt: row.observedAt,
    ageMinutes,
    stale: ageMinutes != null && ageMinutes > STALE_AFTER_MINUTES,
    positionWarning,
    failures,
    distanceNM,
    bearingDeg,
    bearingCardinal: degreesToCardinal(bearingDeg),
    regional: distanceNM != null && distanceNM > REGIONAL_DISTANCE_NM,
    readings: row.readings,
  }
}

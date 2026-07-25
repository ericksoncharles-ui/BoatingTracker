import { calcDistanceNM, calcBearing, degreesToCardinal } from '../utils'
import { WLIS_STATION } from '../data'

// Observed conditions from UConn LISICOS's WLIS buoy, read over ERDDAP's
// tabledap service as JSON.
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

const HOSTS = [
  {
    id: 'ioos',
    label: 'IOOS Sensors ERDDAP',
    // Per-station dataset, so no station constraint is needed. No column list
    // is given either: ERDDAP returns every variable, which keeps the query
    // working whatever CF standard names this dataset happens to publish.
    url: (station) =>
      `https://erddap.sensors.ioos.us/erddap/tabledap/gov_noaa_ndbc_${station}.json` +
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
  wavePeriodS: ['sea_surface_wave_peak_period', 'dpd', 'dominant_wave_period'],
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
 * Latest observed conditions from the WLIS buoy.
 *
 * Tries each ERDDAP host in turn. Returns { status: 'empty' } when the buoy is
 * reporting nothing — off for the season, or sensors down — which callers should
 * present as a normal state rather than an error.
 *
 * `here` is the boat's position, used only to describe how far away the buoy is.
 */
export async function fetchBuoyConditions({ here, signal } = {}) {
  const station = WLIS_STATION
  const failures = []
  let row = null

  for (const host of HOSTS) {
    try {
      row = await readHost(host, station.id, signal)
      if (row) break
    } catch (err) {
      if (err.name === 'AbortError') throw err
      failures.push(`${host.label}: ${err.message}`)
    }
  }

  if (!row) {
    // Every host answered, none had data — as opposed to every host erroring.
    if (failures.length === HOSTS.length) {
      throw new Error(failures.join('; '))
    }
    return {
      status: 'empty',
      station,
      failures,
      message: `No current observations from ${station.name}. The buoy may be out of service or recovered for the season.`,
    }
  }

  // The station id is hardcoded, so confirm the position ERDDAP handed back is
  // actually the WLIS mooring. Costs nothing — the coordinates are already in
  // the response — and stops a renamed dataset quietly feeding us another buoy.
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

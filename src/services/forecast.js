// Forecast conditions from Open-Meteo (keyless, CORS-enabled), plus a
// fetch-limited wind-wave estimate used when the buoy has no wave reading.
//
// Open-Meteo's defaults are requested deliberately (°C, km/h, hPa, metres) and
// converted here. Unit query params would be terser, but a param the server
// ignored would silently produce wrong numbers, whereas the defaults cannot
// change under us.

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

const KMH_TO_KT = 1 / 1.852
const HPA_TO_INHG = 0.02953
const M_TO_NM = 1 / 1852
const KT_TO_MS = 0.514444
const G = 9.81

// Long Island Sound runs roughly WSW-ENE. Wind blowing along that axis has a
// long fetch to build sea; wind across it runs out of water quickly.
const SOUND_AXIS_DEG = 70
const FETCH_ALONG_KM = 60
const FETCH_ACROSS_KM = 18

function round(value, places = 1) {
  if (value == null || Number.isNaN(value)) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}

function toFahrenheit(celsius) {
  return celsius == null ? null : round((celsius * 9) / 5 + 32, 1)
}

function scale(value, factor, places = 1) {
  return value == null ? null : round(value * factor, places)
}

/**
 * Effective wind fetch across the Sound for a given wind direction, modelled as
 * an ellipse aligned to the Sound's long axis.
 */
function fetchMetresFor(windDirDeg) {
  // Angle between the wind and the Sound's axis, folded into 0-90 degrees.
  // A reciprocal direction has the same fetch, hence the modulo 180.
  let offAxis = 45
  if (windDirDeg != null && Number.isFinite(windDirDeg)) {
    const folded = (((windDirDeg - SOUND_AXIS_DEG) % 180) + 180) % 180
    offAxis = folded > 90 ? 180 - folded : folded
  }

  const delta = (offAxis * Math.PI) / 180
  const along = FETCH_ALONG_KM * 1000
  const across = FETCH_ACROSS_KM * 1000
  const cos = Math.cos(delta)
  const sin = Math.sin(delta)
  // Along the axis this returns FETCH_ALONG, across it returns FETCH_ACROSS.
  return 1 / Math.sqrt((cos * cos) / (along * along) + (sin * sin) / (across * across))
}

/**
 * Fetch-limited significant wave height and peak period from wind speed, using
 * the simplified SMB relations. This is an estimate for when the buoy has no
 * wave data — never present it as a measurement.
 *
 * Sanity check: 20 kt across the Sound gives roughly 2.4 ft at about 3.6 s,
 * which is the right ballpark for Long Island Sound chop.
 */
export function estimateWindWaves(windKt, windDirDeg) {
  if (windKt == null || !Number.isFinite(windKt)) return null
  const fetchM = fetchMetresFor(windDirDeg)
  const u = windKt * KT_TO_MS
  if (u <= 0) {
    return { waveHeightFt: 0, periodS: 0, fetchNM: round(fetchM * M_TO_NM, 0), estimated: true }
  }
  const heightM = 0.0016 * u * Math.sqrt(fetchM / G)
  const periodS = 0.286 * (u / G) * Math.cbrt((G * fetchM) / (u * u))
  return {
    waveHeightFt: round(heightM * 3.28084, 1),
    periodS: round(periodS, 1),
    fetchNM: round(fetchM * M_TO_NM, 0),
    estimated: true,
  }
}

/**
 * Current and near-term forecast weather for a position.
 */
export async function fetchForecast({ lat, lng, signal }) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'visibility',
      'precipitation',
    ].join(','),
    hourly: ['temperature_2m', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m'].join(','),
    forecast_days: '2',
    timezone: 'auto',
  })

  const res = await fetch(`${OPEN_METEO}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`)
  const json = await res.json()
  if (json?.error) throw new Error(json.reason || 'Forecast request rejected')

  const c = json.current || {}
  const current = {
    at: c.time ? new Date(c.time) : null,
    airTempF: toFahrenheit(c.temperature_2m),
    feelsLikeF: toFahrenheit(c.apparent_temperature),
    pressureInHg: scale(c.pressure_msl, HPA_TO_INHG, 2),
    windKt: scale(c.wind_speed_10m, KMH_TO_KT),
    gustKt: scale(c.wind_gusts_10m, KMH_TO_KT),
    windDirDeg: c.wind_direction_10m ?? null,
    visibilityNM: scale(c.visibility, M_TO_NM),
    precipitationIn: scale(c.precipitation, 1 / 25.4, 2),
  }

  const h = json.hourly || {}
  const times = h.time || []
  const nowMs = Date.now()
  const hourly = times
    .map((time, i) => ({
      at: new Date(time),
      airTempF: toFahrenheit(h.temperature_2m?.[i]),
      windKt: scale(h.wind_speed_10m?.[i], KMH_TO_KT),
      gustKt: scale(h.wind_gusts_10m?.[i], KMH_TO_KT),
      windDirDeg: h.wind_direction_10m?.[i] ?? null,
    }))
    .filter((row) => !Number.isNaN(row.at.getTime()) && row.at.getTime() >= nowMs - 60 * 60 * 1000)
    .slice(0, 12)

  return { current, hourly }
}

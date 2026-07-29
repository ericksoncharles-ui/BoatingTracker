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

// The Sound's tidal wave enters from the ocean at its eastern end (through The
// Race), so through most of the Sound flood current sets west, into the Sound,
// and ebb sets east, back out — the same axis the fetch model uses. That is a
// simplification (it reverses near the Hell Gate node at the western end) but
// matches what boaters on the open Sound actually see.
const FLOOD_SET_DEG = (SOUND_AXIS_DEG + 180) % 360
const EBB_SET_DEG = SOUND_AXIS_DEG

// How much wind running against the current can steepen (or, running with it,
// ease) the estimate at full spring-like current strength. Wind against tide
// shortens and steepens a sea; wind with tide lengthens and flattens it — a
// well-known effect on the water, kept modest here since this is layered on
// top of an already-approximate wind estimate.
const WIND_AGAINST_TIDE_HEIGHT = 0.25
const WIND_AGAINST_TIDE_PERIOD = 0.15

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

function angleDiffDeg(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * How strongly the tide is running right now, from 0 (slack, at a high or low)
 * to 1 (maximum, at the midpoint between them). A simple harmonic tide's
 * current is the rate of change of its height, so it peaks exactly halfway
 * between extremes and vanishes at them — the same shape whether the extremes
 * come from today's predictions or span midnight.
 */
function currentPhaseStrength(extremes, now = Date.now()) {
  if (!Array.isArray(extremes) || extremes.length < 2) return 0
  let prev = null
  let next = null
  for (const e of extremes) {
    const t = e.at.getTime()
    if (t <= now) prev = e
    else if (!next) next = e
  }
  if (!prev || !next) return 0
  const span = next.at.getTime() - prev.at.getTime()
  if (span <= 0) return 0
  const frac = (now - prev.at.getTime()) / span
  return Math.sin(frac * Math.PI)
}

/**
 * Height and period multipliers from wind running with or against the tidal
 * current. `tide` is the payload from fetchTides (`{ rising, extremes }`);
 * pass null/undefined to skip the adjustment entirely — the daily outlook does
 * this since NOAA's predictions only reach a day or two ahead, not the full
 * week it shows.
 */
function windTideMultipliers(windDirDeg, tide) {
  if (windDirDeg == null || tide?.rising == null) return { heightMult: 1, periodMult: 1 }
  const phase = currentPhaseStrength(tide.extremes)
  if (phase === 0) return { heightMult: 1, periodMult: 1 }

  const currentSetDeg = tide.rising ? FLOOD_SET_DEG : EBB_SET_DEG
  const windTowardDeg = (windDirDeg + 180) % 360
  // 0 when the wind blows the same way the current is setting (with the
  // tide), 1 when it blows squarely into it (against the tide).
  const opposition = angleDiffDeg(windTowardDeg, currentSetDeg) / 180
  const effect = (opposition * 2 - 1) * phase // -phase (with tide) .. +phase (against tide)

  return {
    heightMult: 1 + effect * WIND_AGAINST_TIDE_HEIGHT,
    periodMult: 1 - effect * WIND_AGAINST_TIDE_PERIOD,
  }
}

/**
 * Fetch-limited significant wave height and peak period from wind speed, using
 * the simplified SMB relations, then adjusted for wind running with or against
 * the tidal current. This is the app's only source for sea state — never
 * present it as a measurement.
 *
 * Sanity check: 20 kt across the Sound gives roughly 2.4 ft at about 3.6 s
 * before the tide adjustment, which is the right ballpark for Long Island
 * Sound chop.
 */
export function estimateWindWaves(windKt, windDirDeg, tide) {
  if (windKt == null || !Number.isFinite(windKt)) return null
  const fetchM = fetchMetresFor(windDirDeg)
  const u = windKt * KT_TO_MS
  if (u <= 0) {
    return { heightFt: 0, periodS: 0, fetchNM: round(fetchM * M_TO_NM, 0), estimated: true }
  }
  const heightM = 0.0016 * u * Math.sqrt(fetchM / G)
  const periodS = 0.286 * (u / G) * Math.cbrt((G * fetchM) / (u * u))
  const { heightMult, periodMult } = windTideMultipliers(windDirDeg, tide)
  return {
    heightFt: round(heightM * heightMult * 3.28084, 1),
    periodS: round(periodS * periodMult, 1),
    fetchNM: round(fetchM * M_TO_NM, 0),
    tideEffect: tide?.rising == null ? null : heightMult > 1.02 ? 'against' : heightMult < 0.98 ? 'with' : null,
    estimated: true,
  }
}

/**
 * Current, hourly and multi-day forecast weather for a position.
 *
 * Seven days is as far as this is worth showing: past about day five the wind
 * direction is a guess, and a skipper planning a weekend needs the whole
 * weekend visible from any day of the week.
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
    daily: [
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'temperature_2m_max',
      'temperature_2m_min',
    ].join(','),
    forecast_days: '7',
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
    .slice(0, 24)

  const d = json.daily || {}
  const days = d.time || []
  const daily = days
    .map((day, i) => ({
      // Open-Meteo returns a bare date. Anchoring it at local noon keeps the day
      // label right either side of a DST change and across the UTC date line —
      // parsing "2026-07-25" alone would land on the previous evening here.
      at: new Date(`${day}T12:00:00`),
      // Daily wind is the day's maximum, not an average: what matters when
      // deciding whether to go is the worst of it, not the mean.
      windKt: scale(d.wind_speed_10m_max?.[i], KMH_TO_KT),
      gustKt: scale(d.wind_gusts_10m_max?.[i], KMH_TO_KT),
      windDirDeg: d.wind_direction_10m_dominant?.[i] ?? null,
      highF: toFahrenheit(d.temperature_2m_max?.[i]),
      lowF: toFahrenheit(d.temperature_2m_min?.[i]),
    }))
    .filter((row) => !Number.isNaN(row.at.getTime()))

  return { current, hourly, daily }
}

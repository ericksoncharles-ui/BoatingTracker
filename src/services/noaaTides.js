import { calcDistanceNM } from '../utils'
import { LIS_BBOX } from '../data'

// Tide predictions from NOAA CO-OPS. Station ids are discovered from NOAA's own
// metadata API rather than hardcoded — a wrong id would silently show another
// harbour's tides, which is worse than no tides at all.

const CO_OPS = 'https://api.tidesandcurrents.noaa.gov'
const STATION_CACHE_KEY = 'bt.tideStations.v1'
const STATION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Fetch and parse a CO-OPS response.
 *
 * datagetter reports bad requests as HTTP 200 with an { error: { message } }
 * body, so a healthy status code is not on its own evidence the call worked.
 */
async function coopsJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`NOAA tides request failed (${res.status})`)
  const json = await res.json()
  if (json?.error?.message) throw new Error(json.error.message)
  return json
}

function readCachedStations() {
  try {
    const raw = localStorage.getItem(STATION_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (!Array.isArray(cached?.stations) || cached.stations.length === 0) return null
    if (Date.now() - cached.savedAt > STATION_CACHE_TTL_MS) return null
    return cached.stations
  } catch {
    return null
  }
}

function writeCachedStations(stations) {
  try {
    localStorage.setItem(STATION_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), stations }))
  } catch {
    // A full or unavailable localStorage costs us the cache, nothing more.
  }
}

/**
 * Every NOAA tide-prediction station inside the Long Island Sound bounding box.
 * Cached locally — the nationwide list is large and changes rarely.
 */
export async function fetchTideStations(signal) {
  const cached = readCachedStations()
  if (cached) return cached

  const json = await coopsJson(
    `${CO_OPS}/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english`,
    signal,
  )

  const stations = (json?.stations || [])
    .map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      lat: Number(s.lat ?? s.latitude),
      lng: Number(s.lng ?? s.longitude),
    }))
    .filter(
      (s) =>
        s.id &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        s.lat >= LIS_BBOX.minLat &&
        s.lat <= LIS_BBOX.maxLat &&
        s.lng >= LIS_BBOX.minLng &&
        s.lng <= LIS_BBOX.maxLng,
    )

  if (stations.length === 0) throw new Error('No Long Island Sound tide stations found')
  writeCachedStations(stations)
  return stations
}

/**
 * Nearest tide station to a position, with its distance in nautical miles.
 */
export function pickNearestStation(stations, lat, lng) {
  let best = null
  for (const station of stations) {
    const distanceNM = calcDistanceNM(lat, lng, station.lat, station.lng)
    if (!best || distanceNM < best.distanceNM) best = { ...station, distanceNM }
  }
  return best ? { ...best, distanceNM: Math.round(best.distanceNM * 10) / 10 } : null
}

function yyyymmdd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * CO-OPS returns local station time as "YYYY-MM-DD HH:mm" (time_zone=lst_ldt).
 * Replacing the space with a T parses it in the viewer's local zone, which is
 * the same zone for anyone actually boating on the Sound.
 */
function parseCoopsTime(text) {
  const date = new Date(String(text).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function predictionsUrl(stationId, interval) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const params = new URLSearchParams({
    product: 'predictions',
    application: 'LongIslandSoundTripPlanner',
    station: stationId,
    begin_date: yyyymmdd(today),
    end_date: yyyymmdd(tomorrow),
    datum: 'MLLW',
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
  })
  // hilo gives the high/low extremes; h gives an hourly series for the curve.
  if (interval) params.set('interval', interval)
  return `${CO_OPS}/api/prod/datagetter?${params}`
}

/**
 * Latest measured water level. Only stations with a physical sensor have this —
 * subordinate prediction-only stations legitimately have none, so failure here
 * is not worth surfacing.
 */
async function fetchObservedLevel(stationId, signal) {
  try {
    const params = new URLSearchParams({
      product: 'water_level',
      application: 'LongIslandSoundTripPlanner',
      station: stationId,
      date: 'latest',
      datum: 'MLLW',
      units: 'english',
      time_zone: 'lst_ldt',
      format: 'json',
    })
    const json = await coopsJson(`${CO_OPS}/api/prod/datagetter?${params}`, signal)
    const row = json?.data?.[0]
    if (!row) return null
    const heightFt = Number(row.v)
    if (!Number.isFinite(heightFt)) return null
    return { heightFt: Math.round(heightFt * 100) / 100, at: parseCoopsTime(row.t) }
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return null
  }
}

/**
 * Tide picture for a position: nearest station, today's highs and lows, the next
 * high and low ahead of now, an hourly curve, and the observed level if the
 * station measures one.
 */
export async function fetchTides({ lat, lng, signal }) {
  const stations = await fetchTideStations(signal)
  const station = pickNearestStation(stations, lat, lng)
  if (!station) throw new Error('No tide station near this position')

  const [hiloJson, curveJson, observed] = await Promise.all([
    coopsJson(predictionsUrl(station.id, 'hilo'), signal),
    coopsJson(predictionsUrl(station.id, 'h'), signal),
    fetchObservedLevel(station.id, signal),
  ])

  const extremes = (hiloJson?.predictions || [])
    .map((p) => ({
      at: parseCoopsTime(p.t),
      heightFt: Number(p.v),
      kind: p.type === 'H' ? 'high' : 'low',
    }))
    .filter((p) => p.at && Number.isFinite(p.heightFt))
    .sort((a, b) => a.at - b.at)

  const curve = (curveJson?.predictions || [])
    .map((p) => ({ at: parseCoopsTime(p.t), heightFt: Number(p.v) }))
    .filter((p) => p.at && Number.isFinite(p.heightFt))
    .sort((a, b) => a.at - b.at)

  const now = Date.now()
  const upcoming = extremes.filter((p) => p.at.getTime() > now)

  return {
    station,
    extremes,
    curve,
    observed,
    nextHigh: upcoming.find((p) => p.kind === 'high') || null,
    nextLow: upcoming.find((p) => p.kind === 'low') || null,
    // Rising when the next extreme ahead of us is a high.
    rising: upcoming.length > 0 ? upcoming[0].kind === 'high' : null,
  }
}

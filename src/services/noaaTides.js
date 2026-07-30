import { calcDistanceNM } from '../utils'
import { TIDE_STATION_BBOX } from '../data'

// Tide predictions from NOAA CO-OPS. Station ids are discovered from NOAA's own
// metadata API rather than hardcoded — a wrong id would silently show another
// harbour's tides, which is worse than no tides at all.

const CO_OPS = 'https://api.tidesandcurrents.noaa.gov'
// v2 carried each station's harmonic/subordinate classification; v3 widens the
// bounding box east to Nantucket. Both are cache-invalidating: a v2 entry was
// filtered to Long Island Sound, so keeping it would resolve a Nantucket trip to
// a station in the Sound for the next thirty days — the exact silent wrong answer
// discovering station ids at runtime is meant to avoid.
const STATION_CACHE_KEY = 'bt.tideStations.v3'
const LEGACY_STATION_CACHE_KEYS = ['bt.tideStations.v1', 'bt.tideStations.v2']
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
    for (const key of LEGACY_STATION_CACHE_KEYS) localStorage.removeItem(key)
  } catch {
    // A full or unavailable localStorage costs us the cache, nothing more.
  }
}

/**
 * CO-OPS publishes tide predictions for two classes of station, and the
 * difference decides what can be asked of them.
 *
 * A harmonic (reference) station has tidal constants, so NOAA can compute a
 * continuous water level for it at any interval. A subordinate station has
 * none — its predictions are a reference station's highs and lows shifted in
 * time and scaled in height — so NOAA publishes the extremes and *rejects*
 * every other interval outright. Most of the Sound's small harbors are
 * subordinate, which is why the hourly curve has to be optional.
 *
 * Only a positive marker counts. When the metadata is silent the hourly
 * request is attempted anyway and tolerated if it fails, so being wrong here
 * costs one request rather than the whole tide card.
 */
function isSubordinateStation(station) {
  const marker = String(station?.type ?? '').trim().toUpperCase()
  return marker === 'S' || marker === 'SUBORDINATE'
}

/**
 * Every NOAA tide-prediction station inside the planner's bounding box, which
 * runs from the western Sound to east of Nantucket. Cached locally — the
 * nationwide list is large and changes rarely.
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
      type: s.type ?? null,
      lat: Number(s.lat ?? s.latitude),
      lng: Number(s.lng ?? s.longitude),
    }))
    .filter(
      (s) =>
        s.id &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        s.lat >= TIDE_STATION_BBOX.minLat &&
        s.lat <= TIDE_STATION_BBOX.maxLat &&
        s.lng >= TIDE_STATION_BBOX.minLng &&
        s.lng <= TIDE_STATION_BBOX.maxLng,
    )

  if (stations.length === 0) throw new Error('No tide stations found for these waters')
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
 * Hourly predicted series, used only to draw the curve.
 *
 * Optional by design. A subordinate station has no continuous prediction to
 * serve at all, and even a harmonic one can have a bad minute — but a station
 * that cannot draw a curve can still say when the next high is, which is the
 * part a skipper actually leaves the dock on. So a failure here returns null
 * and the curve gets interpolated from the extremes instead.
 */
async function fetchCurveRows(station, signal) {
  if (isSubordinateStation(station)) return null
  try {
    const json = await coopsJson(predictionsUrl(station.id, 'h'), signal)
    return (json?.predictions || [])
      .map((p) => ({ at: parseCoopsTime(p.t), heightFt: Number(p.v) }))
      .filter((p) => p.at && Number.isFinite(p.heightFt))
      .sort((a, b) => a.at - b.at)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return null
  }
}

const CURVE_STEP_MS = 30 * 60 * 1000

/**
 * A tide curve drawn between known highs and lows, for the stations that have
 * no hourly series to fetch.
 *
 * Between one extreme and the next a simple harmonic tide follows a half
 * cosine — the same shape behind the mariner's rule of twelfths, so this is
 * how a skipper already reads water level off a printed tide table rather than
 * something invented here. The extremes themselves are NOAA's numbers; only
 * the water between them is filled in.
 */
function interpolateCurve(extremes) {
  if (extremes.length < 2) return []

  const points = []
  for (let i = 0; i < extremes.length - 1; i++) {
    const from = extremes[i]
    const to = extremes[i + 1]
    const startMs = from.at.getTime()
    const spanMs = to.at.getTime() - startMs
    if (spanMs <= 0) continue

    for (let ms = startMs; ms < startMs + spanMs; ms += CURVE_STEP_MS) {
      const frac = (ms - startMs) / spanMs
      const heightFt =
        from.heightFt + ((to.heightFt - from.heightFt) * (1 - Math.cos(Math.PI * frac))) / 2
      points.push({ at: new Date(ms), heightFt: Math.round(heightFt * 100) / 100 })
    }
  }

  const last = extremes[extremes.length - 1]
  points.push({ at: last.at, heightFt: last.heightFt })
  return points
}

/**
 * Tide picture for a position: nearest station, the highs and lows for today
 * and tomorrow, the next high and low ahead of now, a curve, and the observed
 * level if the station measures one.
 *
 * Predictions deliberately run through tomorrow — otherwise an evening high
 * would leave "next high" empty for the rest of the night.
 */
export async function fetchTides({ lat, lng, signal }) {
  const stations = await fetchTideStations(signal)
  const station = pickNearestStation(stations, lat, lng)
  if (!station) throw new Error('No tide station near this position')

  const [hiloJson, curveRows, observed] = await Promise.all([
    coopsJson(predictionsUrl(station.id, 'hilo'), signal),
    fetchCurveRows(station, signal),
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

  const curveInterpolated = !curveRows?.length
  const curve = curveInterpolated ? interpolateCurve(extremes) : curveRows

  const now = Date.now()
  const upcoming = extremes.filter((p) => p.at.getTime() > now)

  return {
    station,
    extremes,
    curve,
    // True when the curve was filled in between NOAA's extremes rather than
    // read from NOAA's own hourly series, so the card can say so.
    curveInterpolated: curveInterpolated && curve.length > 0,
    observed,
    nextHigh: upcoming.find((p) => p.kind === 'high') || null,
    nextLow: upcoming.find((p) => p.kind === 'low') || null,
    // Rising when the next extreme ahead of us is a high.
    rising: upcoming.length > 0 ? upcoming[0].kind === 'high' : null,
  }
}

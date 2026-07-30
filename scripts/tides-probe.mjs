// Prints which tide station each dropdown location resolves to, whether that
// station is harmonic or subordinate, and whether NOAA actually serves it an
// hourly curve — so a Tides card that shows an error can be traced to the
// station rather than guessed at. Run with: npm run tides:probe
//
// Subordinate stations have no tidal constants, so CO-OPS publishes their highs
// and lows and rejects every other interval. That is the normal case for most
// of the Sound's small harbors, and the app interpolates the curve for them; a
// line below reading "hourly: rejected" next to "subordinate" is expected, not
// a fault.
import { marinas, LIS_BBOX } from '../src/data.js'
import { calcDistanceNM } from '../src/utils.js'

const CO_OPS = 'https://api.tidesandcurrents.noaa.gov'

async function coopsJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  // datagetter reports bad requests as HTTP 200 with an error body.
  if (json?.error?.message) throw new Error(json.error.message)
  return json
}

function yyyymmdd(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}${m}${d}`
}

const today = new Date()
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)

function predictionsUrl(stationId, interval) {
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
    interval,
  })
  return `${CO_OPS}/api/prod/datagetter?${params}`
}

const meta = await coopsJson(
  `${CO_OPS}/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english`,
)

const stations = (meta?.stations || [])
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
      s.lat >= LIS_BBOX.minLat &&
      s.lat <= LIS_BBOX.maxLat &&
      s.lng >= LIS_BBOX.minLng &&
      s.lng <= LIS_BBOX.maxLng,
  )

console.log(`${stations.length} prediction stations inside LIS_BBOX`)
// Worth eyeballing: the box reaches into the Hudson, the East River and the
// south shore of Long Island, and the nearest station is picked by straight-line
// distance with no regard for land in between.
const classes = stations.reduce((acc, s) => {
  const key = s.type ?? '(no type field)'
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log(`station "type" values: ${JSON.stringify(classes)}`)
console.log()

let hilo = 0
let hourly = 0

for (const place of marinas) {
  let best = null
  for (const s of stations) {
    const distanceNM = calcDistanceNM(place.lat, place.lng, s.lat, s.lng)
    if (!best || distanceNM < best.distanceNM) best = { ...s, distanceNM }
  }

  if (!best) {
    console.log(`${place.name}\n  NO STATION FOUND`)
    continue
  }

  const results = []
  for (const interval of ['hilo', 'h']) {
    try {
      const json = await coopsJson(predictionsUrl(best.id, interval))
      const count = (json?.predictions || []).length
      results.push(`${interval}: ${count} rows`)
      if (interval === 'hilo' && count > 0) hilo += 1
      if (interval === 'h' && count > 0) hourly += 1
    } catch (error) {
      results.push(`${interval}: rejected (${error.message})`)
    }
  }

  const klass = best.type === 'S' ? 'subordinate' : best.type === 'R' ? 'harmonic' : `type=${best.type}`
  console.log(`${place.name}`)
  console.log(
    `  -> ${best.name} (${best.id}, ${klass}) ${best.distanceNM.toFixed(1)} NM · ${results.join(' · ')}`,
  )
}

console.log()
console.log(`${hilo}/${marinas.length} locations get highs and lows`)
console.log(`${hourly}/${marinas.length} also get a NOAA hourly curve (the rest are interpolated)`)

// Highs and lows are what the card is built on. Losing those is the real failure.
if (hilo < marinas.length) process.exitCode = 1

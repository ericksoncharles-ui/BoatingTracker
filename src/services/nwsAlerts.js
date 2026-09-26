// Active National Weather Service alerts for a position, filtered to the ones
// that matter on the water.

const NWS_ALERTS = 'https://api.weather.gov/alerts/active'

// Matched as substrings against the alert's event name, lowercased.
const MARINE_EVENTS = [
  'small craft advisory',
  'gale',
  'storm warning',
  'storm watch',
  'special marine',
  'marine weather statement',
  'hazardous seas',
  'dense fog',
  'freezing spray',
  'high wind',
  'severe thunderstorm',
  'tornado',
  'tropical storm',
  'hurricane',
  'tsunami',
  'coastal flood',
  'rip current',
]

const SEVERITY_RANK = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }

function isMarine(event) {
  const name = String(event || '').toLowerCase()
  return MARINE_EVENTS.some((marine) => name.includes(marine))
}

/**
 * Marine-relevant alerts in force at one point.
 *
 * api.weather.gov rejects coordinates with more than four decimal places, so
 * the position is rounded before it goes into the query.
 */
async function alertsAt({ lat, lng }, signal) {
  const point = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const res = await fetch(`${NWS_ALERTS}?point=${point}`, {
    signal,
    headers: { Accept: 'application/geo+json' },
  })
  if (!res.ok) throw new Error(`Weather alerts request failed (${res.status})`)
  const json = await res.json()

  return (json?.features || [])
    .map((feature) => feature?.properties)
    .filter((p) => p && isMarine(p.event))
    .map((p) => ({
      id: p.id,
      event: p.event,
      headline: p.headline,
      severity: p.severity || 'Unknown',
      urgency: p.urgency,
      description: p.description,
      endsAt: p.ends || p.expires || null,
    }))
}

/**
 * Marine-relevant active alerts, most severe first.
 *
 * NWS issues the Small Craft Advisory for a marine zone, and a point query
 * only returns the zones that point sits in. A marina's coordinates are at the
 * dock, which can fall in the land forecast zone instead, so `water`, an open
 * water point outside the harbor (the approach), is asked about as well and the
 * two answers are merged. One of the two failing still leaves the other.
 */
export async function fetchMarineAlerts({ lat, lng, water, signal }) {
  const points = [{ lat, lng }, ...(water ? [water] : [])]
  const results = await Promise.allSettled(points.map((p) => alertsAt(p, signal)))
  const answered = results.filter((r) => r.status === 'fulfilled')
  if (answered.length === 0) throw results[0].reason

  const byId = new Map()
  for (const { value } of answered) for (const alert of value) byId.set(alert.id, alert)
  return [...byId.values()]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4))
}

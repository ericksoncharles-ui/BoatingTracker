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
 * Marine-relevant active alerts, most severe first.
 *
 * api.weather.gov rejects coordinates with more than four decimal places, so
 * the position is rounded before it goes into the query.
 */
export async function fetchMarineAlerts({ lat, lng, signal }) {
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
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4))
}
